// functions/index.js
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import OpenAI from "openai";

import { MercadoPagoConfig, Payment } from 'mercadopago';
// --- IMPORTS FIREBASE ADMIN ---
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore"; // Mantenha esta linha específica
// Inicializa o Admin SDK
initializeApp();
const db = getFirestore();

// Segredos
const openAiApiKey = defineSecret("OPENAI_API_KEY");
const plugNotasApiKey = defineSecret("PLUGNOTAS_API_KEY");
const mercadoPagoToken = defineSecret("MP_ACCESS_TOKEN");
// ==================================================================
// 1. SEU AGENTE DE IA
// ==================================================================

export const chatAgent = onCall({
    cors: true,
    secrets: [openAiApiKey]
}, async (request) => {

    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Você precisa estar logado para usar o assistente.');
    }

    const openai = new OpenAI({ apiKey: openAiApiKey.value() });
    const data = request.data || {};
    const { message, context = {} } = data;
    const history = context.history || [];

    if (!message) throw new HttpsError('invalid-argument', 'Mensagem vazia.');

    try {
        const systemPrompt = `
            Você é o GARÇOM DIGITAL do restaurante ${context.estabelecimentoNome}.
            🚨 REGRA DE OURO: Sempre use ||ADD:...|| para itens confirmados.
            CARDÁPIO: ${context.produtosPopulares}
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: message }],
            temperature: 0,
            max_tokens: 500,
        });

        return { reply: completion.choices[0].message.content };
    } catch (error) {
        logger.error("❌ Erro OpenAI:", error);
        return { reply: "⚠️ Opa! Tive um probleminha aqui. Pode repetir? 😅" };
    }
});

// ==================================================================
// 2. CRIAR PEDIDO SEGURO
// ==================================================================
export const criarPedidoSeguro = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');

    const dadosPedido = request.data;
    const { itens, estabelecimentoId, ...outrosDados } = dadosPedido;

    if (!itens || !estabelecimentoId) throw new HttpsError('invalid-argument', 'Dados do pedido incompletos.');

    let totalCalculado = 0;
    const itensProcessados = [];

    try {
        for (const item of itens) {
            if (!item.id) continue;

            const produtoRef = db.doc(`estabelecimentos/${estabelecimentoId}/cardapio/${item.id}`);
            const produtoSnap = await produtoRef.get();

            if (!produtoSnap.exists) {
                throw new HttpsError('not-found', `Produto indisponível: ${item.nome || 'Item removido'}`);
            }

            const produtoReal = produtoSnap.data();
            let precoUnitarioReal = Number(produtoReal.preco) || 0;

            if (item.variacaoSelecionada) {
                const variacoesReais = produtoReal.variacoes || [];
                const variacaoEncontrada = variacoesReais.find(v =>
                    (item.variacaoSelecionada.id && v.id === item.variacaoSelecionada.id) ||
                    (item.variacaoSelecionada.nome && v.nome === item.variacaoSelecionada.nome)
                );
                if (variacaoEncontrada) precoUnitarioReal = Number(variacaoEncontrada.preco);
            }

            let totalAdicionais = 0;
            if (Array.isArray(item.adicionais)) {
                totalAdicionais = item.adicionais.reduce((acc, ad) => acc + (Number(ad.preco) || 0), 0);
            }

            const precoFinalItem = precoUnitarioReal + totalAdicionais;
            totalCalculado += precoFinalItem * (Number(item.quantidade) || 1);

            itensProcessados.push({
                ...item,
                preco: precoUnitarioReal,
                precoFinal: precoFinalItem,
                // Passa os dados fiscais reais do produto para o pedido
                fiscal: produtoReal.fiscal || null
            });
        }

        const vendaFinal = {
            ...outrosDados,
            estabelecimentoId,
            userId: request.auth.uid,
            itens: itensProcessados,
            total: totalCalculado,
            status: 'pendente',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            origem: 'app_web_seguro'
        };

        const novaVendaRef = db.collection('vendas').doc();
        await novaVendaRef.set(vendaFinal);

        logger.info(`✅ Pedido Criado: ${novaVendaRef.id} | Total: R$ ${totalCalculado}`);

        return {
            success: true,
            vendaId: novaVendaRef.id,
            totalValidado: totalCalculado
        };

    } catch (error) {
        logger.error("❌ Falha em criarPedidoSeguro:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'Erro interno ao processar pedido.', error.message);
    }
});

// ==================================================================
// 3. EMITIR NFC-E VIA PLUGNOTAS (CORRIGIDO PARA O PADRÃO PLUGNOTAS)
// ==================================================================
export const emitirNfcePlugNotas = onCall({
    cors: true,
    secrets: [plugNotasApiKey]
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

    const { vendaId, cpf } = request.data;
    if (!vendaId) throw new HttpsError('invalid-argument', 'ID da venda obrigatório.');

    try {
        logger.info(`🧾 Iniciando emissão no PlugNotas para Venda: ${vendaId} | CPF: ${cpf || 'N/A'}`);

        // 1. Busca a venda
        const vendaRef = db.collection('vendas').doc(vendaId);
        const vendaSnap = await vendaRef.get();
        if (!vendaSnap.exists) throw new HttpsError('not-found', 'Venda não encontrada.');
        const venda = vendaSnap.data();

        // 2. Busca os dados do Estabelecimento (Configuração Fiscal)
        const estabelecimentoRef = db.collection('estabelecimentos').doc(venda.estabelecimentoId);
        const estabelecimentoSnap = await estabelecimentoRef.get();
        const estabelecimento = estabelecimentoSnap.data();

        if (!estabelecimento?.fiscal?.cnpj) {
            throw new HttpsError('failed-precondition', 'Estabelecimento sem configuração fiscal (CNPJ faltando).');
        }

        const configFiscal = estabelecimento.fiscal;

        // 3. Montar os itens dinamicamente no PADRÃO PLUGNOTAS
        let somaDosItens = 0;

        const itensNfce = venda.itens.map((item, index) => {
            const ncmReal = item.fiscal?.ncm || "06029090"; 
            const cfopReal = item.fiscal?.cfop || "5102";
            
            // A MÁGICA ACONTECE AQUI: Agora lemos 'price', 'quantity' e 'name'
            const valorBase = item.precoFinal || item.preco || item.price || 0;
            const qtdBase = item.quantidade || item.quantity || 1;
            const nomeBase = item.nome || item.name || `Produto ${index + 1}`;

            const precoInformado = Number(String(valorBase).replace(',', '.'));
            let quantidadeInformada = Number(String(qtdBase).replace(',', '.'));
            
            if (quantidadeInformada <= 0) quantidadeInformada = 1;
            
            // 2. CRAVAMOS O VALOR TOTAL DO ITEM (Exatamente 2 casas decimais)
            const valorTotalItem = Number((precoInformado * quantidadeInformada).toFixed(2));
            
            // 3. Cálculo de trás para frente com 10 casas decimais para matemática perfeita da Sefaz
            const valorUnitarioCalculado = Number((valorTotalItem / quantidadeInformada).toFixed(10));
            
            somaDosItens += valorTotalItem;

            return {
                codigo: String(item.id || item.uid || `00${index + 1}`),
                descricao: String(nomeBase), // Agora vai pegar o "ÁGUA MINERAL..." corretamente
                ncm: String(ncmReal).replace(/\D/g, ''), 
                cfop: String(cfopReal).replace(/\D/g, ''),
                unidade: {
                    comercial: "UN",
                    tributavel: "UN"
                },
                quantidade: {
                    comercial: quantidadeInformada,
                    tributavel: quantidadeInformada
                },
                valorUnitario: {
                    comercial: valorUnitarioCalculado,
                    tributavel: valorUnitarioCalculado
                },
                valor: valorTotalItem,
                tributos: {
                    icms: {
                        origem: "0",
                        cst: cfopReal === "5405" ? "500" : "102"
                    },
                    pis: {
                        cst: "99",
                        baseCalculo: { valor: 0, quantidade: 0 },
                        aliquota: 0,
                        valor: 0
                    },
                    cofins: {
                        cst: "99",
                        baseCalculo: { valor: 0 },
                        aliquota: 0,
                        valor: 0
                    }
                }
            };
        });

        // Garantir que a soma geral para os Pagamentos também é absolutamente redonda
        somaDosItens = Number(somaDosItens.toFixed(2));

        // Mapear o tipo de pagamento do seu PDV para o PlugNotas
        let meioPagamento = "01"; // Padrão: Dinheiro
        const metodoLower = String(venda.tipoPagamento || venda.metodoPagamento || venda.formaPagamento || "").toLowerCase();

        if (metodoLower.includes('pix')) meioPagamento = "17";
        else if (metodoLower.includes('crédito') || metodoLower.includes('credito') || metodoLower.includes('cartao')) meioPagamento = "03";
        else if (metodoLower.includes('débito') || metodoLower.includes('debito')) meioPagamento = "04";

        // 4. Montar o Payload Principal
        const payload = [{
            idIntegracao: vendaId,
            presencial: true,
            consumidorFinal: true,
            natureza: "VENDA",
            ambiente: configFiscal.ambiente === "1" ? "PRODUCAO" : "HOMOLOGACAO",
            emitente: {
                cpfCnpj: String(configFiscal.cnpj).replace(/\D/g, '')
            },
            destinatario: cpf ? { cpf: String(cpf).replace(/\D/g, '') } : undefined,
            itens: itensNfce,
            pagamentos: [{
                aVista: true,
                meio: meioPagamento,
                valor: somaDosItens
            }]
        }];

        logger.info("📦 [DEBUG PLUGNOTAS] Payload enviado:", JSON.stringify(payload, null, 2));

        // 5. Disparar para a API do PlugNotas
        const response = await fetch("https://api.plugnotas.com.br/nfce", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": plugNotasApiKey.value()
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        // Se a API retornar erro de validação
        if (!response.ok) {
            logger.error("❌ Erro retornado pelo PlugNotas:", result);
            throw new HttpsError('internal', `Falha no PlugNotas: ${result.message || JSON.stringify(result.error)}`);
        }

        const idPlugNotas = result.documents[0].id;

        const fiscalData = {
            status: 'PROCESSANDO',
            idPlugNotas: idPlugNotas,
            idIntegracao: result.documents[0].idIntegracao,
            dataEnvio: FieldValue.serverTimestamp(),
            ambiente: configFiscal.ambiente === "1" ? "PRODUCAO" : "HOMOLOGACAO"
        };

        // 6. Atualiza a venda no banco com o status
        await vendaRef.update({ fiscal: fiscalData });

        logger.info(`✅ Venda enviada ao PlugNotas. ID PlugNotas: ${idPlugNotas}`);

        return {
            sucesso: true,
            mensagem: 'Nota enviada para processamento com sucesso.',
            idPlugNotas: idPlugNotas
        };

    } catch (error) {
        logger.error("❌ Erro na Emissão NFC-e:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', `Erro interno ao processar NFC-e: ${error.message}`);
    }
});

// ==================================================================
// 4. WEBHOOK PLUGNOTAS (RETORNO ASSÍNCRONO DA SEFAZ)
// ==================================================================
export const webhookPlugNotas = onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const data = req.body;
    logger.info(`🔔 Webhook Recebido do PlugNotas:`, data);

    try {
        const { id, idIntegracao, status, pdf, xml, mensagem } = data;

        if (!idIntegracao) {
            logger.warn("Webhook ignorado: Sem idIntegracao.");
            res.status(200).send('OK');
            return;
        }

        const vendaRef = db.collection('vendas').doc(idIntegracao);
        const vendaSnap = await vendaRef.get();

        if (!vendaSnap.exists) {
            logger.warn(`Venda não encontrada para o ID Integração: ${idIntegracao}`);
            res.status(200).send('OK');
            return;
        }

        const updateData = {
            'fiscal.status': status,
            'fiscal.dataAtualizacao': FieldValue.serverTimestamp()
        };

        if (status === 'CONCLUIDO') {
            if (pdf) updateData['fiscal.pdf'] = pdf;
            if (xml) updateData['fiscal.xml'] = xml;
        } else if (status === 'REJEITADO' || status === 'DENEGADO') {
            updateData['fiscal.motivoRejeicao'] = mensagem || 'Rejeitada pela Sefaz';
        }

        await vendaRef.update(updateData);
        logger.info(`✅ Venda ${idIntegracao} atualizada via Webhook: ${status}`);

        res.status(200).json({ message: "Notificação processada com sucesso" });

    } catch (error) {
        logger.error("❌ Erro ao processar Webhook do PlugNotas:", error);
        res.status(500).send('Erro Interno');
    }
});

// ==================================================================
// 5. BAIXAR XML DA NFC-E (DIRETO DA API PLUGNOTAS)
// ==================================================================
export const baixarXmlNfcePlugNotas = onCall({
    cors: true,
    secrets: [plugNotasApiKey]
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');
    
    const { idPlugNotas } = request.data;
    if (!idPlugNotas) throw new HttpsError('invalid-argument', 'ID do PlugNotas obrigatório.');

    try {
        const response = await fetch(`https://api.plugnotas.com.br/nfce/${idPlugNotas}/xml`, {
            method: "GET",
            headers: {
                "x-api-key": plugNotasApiKey.value()
            }
        });

        if (!response.ok) {
            const erro = await response.json().catch(() => ({}));
            throw new HttpsError('internal', `Erro no PlugNotas: ${erro.message || 'Falha ao baixar XML'}`);
        }

        // O Plugnotas retorna o XML puro em formato de texto nesta rota
        const xmlString = await response.text();
        
        return {
            sucesso: true,
            xml: xmlString
        };

    } catch (error) {
        logger.error("❌ Erro ao baixar XML:", error);
        throw new HttpsError('internal', error.message);
    }
});

// ==================================================================
// 6. CONSULTAR RESUMO DA NFC-E (ATUALIZAÇÃO MANUAL)
// ==================================================================
export const consultarResumoNfce = onCall({
    cors: true,
    secrets: [plugNotasApiKey]
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

    const { vendaId, idPlugNotas } = request.data;
    if (!vendaId || !idPlugNotas) throw new HttpsError('invalid-argument', 'IDs obrigatórios.');

    try {
        // CORREÇÃO 1: Adicionado o /resumo no final da URL
        const response = await fetch(`https://api.plugnotas.com.br/nfce/${idPlugNotas}/resumo`, {
            method: "GET",
            headers: {
                "x-api-key": plugNotasApiKey.value()
            }
        });

        const result = await response.json();

        if (!response.ok) {
            throw new HttpsError('internal', `Erro no PlugNotas: ${result.message || 'Falha na consulta'}`);
        }

        // CORREÇÃO 2: A rota /resumo devolve uma Array, então pegamos o item [0]
        const nota = Array.isArray(result) ? result[0] : result; 
        
        if (!nota) {
            throw new HttpsError('internal', 'Nota não encontrada no retorno da API.');
        }
        
        // Monta os dados para atualizar o Firestore
        const updateData = {
            'fiscal.status': nota.status,
            'fiscal.dataAtualizacao': FieldValue.serverTimestamp()
        };

        if (nota.status === 'CONCLUIDO' || nota.status === 'AUTORIZADA') {
            if (nota.pdf) updateData['fiscal.pdf'] = nota.pdf;
            if (nota.xml) updateData['fiscal.xml'] = nota.xml;
        } else if (nota.status === 'REJEITADO' || nota.status === 'REJEITADA' || nota.status === 'DENEGADO') {
            updateData['fiscal.motivoRejeicao'] = nota.mensagem || 'Rejeitada pela Sefaz';
        }

        // Atualiza a venda no banco de dados
        await db.collection('vendas').doc(vendaId).update(updateData);

        return {
            sucesso: true,
            statusAtual: nota.status,
            pdf: nota.pdf || null,
            xml: nota.xml || null,
            mensagem: nota.mensagem || null
        };

    } catch (error) {
        logger.error("❌ Erro ao consultar resumo:", error);
        throw new HttpsError('internal', error.message);
    }
});

// ==================================================================
// 8. BAIXAR PDF DA NFC-E (DIRETO DA API PLUGNOTAS)
// ==================================================================
export const baixarPdfNfcePlugNotas = onCall({
    cors: true,
    secrets: [plugNotasApiKey]
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');
    
    const { idPlugNotas } = request.data;
    if (!idPlugNotas) throw new HttpsError('invalid-argument', 'ID do PlugNotas obrigatório.');

    try {
        const response = await fetch(`https://api.plugnotas.com.br/nfce/${idPlugNotas}/pdf`, {
            method: "GET",
            headers: {
                "x-api-key": plugNotasApiKey.value()
            }
        });

        if (!response.ok) {
            const erro = await response.json().catch(() => ({}));
            throw new HttpsError('internal', `Erro no PlugNotas: ${erro.message || 'Falha ao baixar PDF'}`);
        }

        // O Plugnotas retorna o PDF como um arquivo binário. Transformamos em Base64 para enviar ao Frontend.
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        
        return {
            sucesso: true,
            pdfBase64: base64
        };

    } catch (error) {
        logger.error("❌ Erro ao baixar PDF:", error);
        throw new HttpsError('internal', error.message);
    }
});

// ==================================================================
// 9. CANCELAR NFC-E VIA PLUGNOTAS
// ==================================================================
export const cancelarNfcePlugNotas = onCall({
    cors: true,
    secrets: [plugNotasApiKey]
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

    const { vendaId, justificativa } = request.data;
    
    if (!vendaId || !justificativa) {
        throw new HttpsError('invalid-argument', 'O ID da venda e a justificativa são obrigatórios.');
    }

    try {
        const vendaRef = db.collection('vendas').doc(vendaId);
        const vendaSnap = await vendaRef.get();
        if (!vendaSnap.exists) throw new HttpsError('not-found', 'Venda não encontrada.');
        
        const venda = vendaSnap.data();
        const idPlugNotas = venda.fiscal?.idPlugNotas;
        const statusAtual = venda.fiscal?.status;

        // VALIDAÇÃO 1: Só permite cancelar se estiver CONCLUIDO/AUTORIZADA
        if (statusAtual !== 'CONCLUIDO' && statusAtual !== 'AUTORIZADA') {
             throw new HttpsError('failed-precondition', `Não é possível cancelar. O status atual da nota é: ${statusAtual || 'Desconhecido'}. A nota precisa estar CONCLUIDA.`);
        }

        if (!idPlugNotas) {
            throw new HttpsError('failed-precondition', 'Esta venda não possui um ID válido na Plugnotas para cancelar.');
        }

        const payload = { justificativa: justificativa.trim() };

        const response = await fetch(`https://api.plugnotas.com.br/nfce/${idPlugNotas}/cancelamento`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": plugNotasApiKey.value()
            },
            body: JSON.stringify(payload)
        });

        // Captura o erro real devolvido pela Plugnotas
        const textResult = await response.text();
        let result = {};
        try { result = JSON.parse(textResult); } catch(e) { result = { message: textResult }; }

        if (!response.ok) {
            logger.error("❌ Erro ao cancelar no PlugNotas:", result);
            // Mostra o erro exato da Plugnotas no ecrã (ex: "Prazo de cancelamento expirado")
            throw new HttpsError('internal', `Falha da Sefaz/Plugnotas: ${result.message || JSON.stringify(result)}`);
        }

        // Se deu sucesso, atualiza a base de dados
        await vendaRef.update({
            'fiscal.status': 'PROCESSANDO_CANCELAMENTO',
            'fiscal.dataAtualizacao': FieldValue.serverTimestamp(),
            'status': 'cancelada' 
        });

        logger.info(`✅ Solicitação de cancelamento enviada para NFC-e: ${idPlugNotas}`);

        return {
            sucesso: true,
            mensagem: 'Cancelamento solicitado com sucesso à Sefaz.'
        };

    } catch (error) {
        logger.error("❌ Erro no Cancelamento NFC-e:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message);
    }
});

// ==================================================================
// 10. BAIXAR XML DE CANCELAMENTO DA NFC-E (DIRETO DA API PLUGNOTAS)
// ==================================================================
export const baixarXmlCancelamentoNfcePlugNotas = onCall({
    cors: true,
    secrets: [plugNotasApiKey]
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');
    
    const { idPlugNotas } = request.data;
    if (!idPlugNotas) throw new HttpsError('invalid-argument', 'ID do PlugNotas obrigatório.');

    try {
        // ROTA ESPECÍFICA DA DOCUMENTAÇÃO PARA O XML DE CANCELAMENTO
        const response = await fetch(`https://api.plugnotas.com.br/nfce/${idPlugNotas}/cancelamento/xml`, {
            method: "GET",
            headers: {
                "x-api-key": plugNotasApiKey.value()
            }
        });

        if (!response.ok) {
            const erro = await response.json().catch(() => ({}));
            throw new HttpsError('internal', `Erro no PlugNotas: ${erro.message || 'Falha ao baixar XML de cancelamento'}`);
        }

        const xmlString = await response.text();
        
        return {
            sucesso: true,
            xml: xmlString
        };

    } catch (error) {
        logger.error("❌ Erro ao baixar XML de cancelamento:", error);
        throw new HttpsError('internal', error.message);
    }
});

// ==================================================================
// 11. GERAR PIX MERCADO PAGO (CORRIGIDO)
// ==================================================================
export const gerarPixMercadoPago = onCall(
  {
    region: 'us-central1',
    secrets: [mercadoPagoToken],
    maxInstances: 1
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Faça login primeiro.');

    const { vendaId, valor, descricao, estabelecimentoId } = request.data || {};

    if (!vendaId || !valor || !estabelecimentoId) {
      throw new HttpsError('invalid-argument', 'Dados ausentes: vendaId, valor ou estabelecimentoId.');
    }

    try {
      const client = new MercadoPagoConfig({ accessToken: mercadoPagoToken.value() });
      const payment = new Payment(client);

      // 🔥 URL CORRIGIDA COM SEU ID DE PROJETO
const webhookUrl = 'https://us-central1-matafome-98455.cloudfunctions.net/webhookMercadoPago'; // 🔥 Coloquei o seu ID real aqui
      const result = await payment.create({
        body: {
          transaction_amount: Number(valor),
          description: descricao || `Pedido ${vendaId}`,
          payment_method_id: 'pix',
          payer: { email: request.auth.token.email || 'cliente@brocou.system' },
          external_reference: `${estabelecimentoId}|${vendaId}`,
          notification_url: webhookUrl // Avisa o MP para usar esta URL
        }
      });

      const transactionData = result?.point_of_interaction?.transaction_data;

      // Salva na raiz para o Modal espiar
      await db.collection('pagamentos_pix').doc(vendaId).set({
        idPagamentoMP: String(result.id),
        status: 'pending',
        valor: Number(valor),
        vendaId,
        estabelecimentoId,
        criadoEm: FieldValue.serverTimestamp()
      }, { merge: true });

      return {
        sucesso: true,
        qrCodeBase64: transactionData.qr_code_base64,
        copiaECola: transactionData.qr_code,
        idPagamento: String(result.id)
      };
    } catch (error) {
      logger.error('❌ Erro gerarPix:', error);
      throw new HttpsError('internal', error?.message || 'Erro ao gerar PIX.');
    }
  }
);

// ==================================================================
// 12. WEBHOOK MERCADO PAGO (VERSÃO SEM BLOQUEIO)
// ==================================================================
export const webhookMercadoPago = onRequest(
  { secrets: [mercadoPagoToken], maxInstances: 1 }, 
  async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { data } = req.body;
        const paymentId = data?.id;
        if (!paymentId) return res.status(200).send('OK');

        const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${mercadoPagoToken.value()}` }
        });
        
        const pagamentoReal = await mpResponse.json();
        const reference = pagamentoReal.external_reference;

        if (pagamentoReal.status === 'approved' && reference) {
            const [estabId, pedidoId] = reference.split('|');
            const batch = db.batch();

            // 1. Atualiza o status global (que o Modal espia)
            batch.set(db.collection('pagamentos_pix').doc(pedidoId), {
                status: 'pago',
                pagoEm: FieldValue.serverTimestamp()
            }, { merge: true });

            // 2. 🔥 ATUALIZA O PEDIDO NO PAINEL (Cria se não existir)
            batch.set(db.doc(`estabelecimentos/${estabId}/pedidos/${pedidoId}`), {
                status: 'pago',
                pago: true,
                pagoEm: FieldValue.serverTimestamp(),
                metodoPagamento: 'pix'
            }, { merge: true });

            await batch.commit();
            logger.info(`✅ SUCESSO: Pedido ${pedidoId} APROVADO!`);
        }
        res.status(200).send('OK');
    } catch (error) {
        logger.error("❌ Erro Webhook:", error);
        res.status(200).send('OK');
    }
});
// No topo do arquivo, defina o novo segredo
const mpClientSecret = defineSecret("MP_CLIENT_SECRET");
const mpClientId = "310854362032422"; // O ID é público, pode ficar aqui ou no Secret também

// ==================================================================
// 13. VINCULAR CONTA DO LOJISTA (OAuth) - VERSÃO SEGURA
// ==================================================================
export const vincularMercadoPago = onCall({ 
    secrets: [mpClientSecret] 
}, async (request) => {
    const { code, estabelecimentoId } = request.data;
    
    if (!code || !estabelecimentoId) {
        throw new HttpsError('invalid-argument', 'Código ou ID do estabelecimento ausentes.');
    }

    try {
        const response = await fetch('https://api.mercadopago.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: mpClientId,
                client_secret: mpClientSecret.value(), // Puxa do cofre com segurança
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: 'https://matafome-98455.web.app/admin/configuracoes'
            })
        });

        const data = await response.json();

        if (data.access_token) {
            // 🔥 Vincula o Token Real do lojista ao restaurante dele
            await db.collection('estabelecimentos').doc(estabelecimentoId).update({
                mp_access_token: data.access_token,
                mp_refresh_token: data.refresh_token,
                mp_user_id: data.user_id,
                mp_conectado: true,
                mp_data_vinculo: FieldValue.serverTimestamp()
            });

            logger.info(`✅ Restaurante ${estabelecimentoId} conectado ao Mercado Pago.`);
            return { sucesso: true };
        }
        
        throw new Error(data.message || 'Falha ao obter access_token');
    } catch (error) {
        logger.error("❌ Erro OAuth:", error);
        throw new HttpsError('internal', error.message);
    }
});