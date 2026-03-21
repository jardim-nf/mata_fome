// functions/index.js
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
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
const plugNotasWebhookToken = defineSecret("PLUGNOTAS_WEBHOOK_TOKEN"); // Token secreto configurado no painel PlugNotas
const mpClientSecret = defineSecret("MP_CLIENT_SECRET");
const mpClientIdSecret = defineSecret("MP_CLIENT_ID"); // Movido de hardcoded para secret
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

            // Validação server-side dos adicionais: busca o preço real no banco
            let totalAdicionais = 0;
            if (Array.isArray(item.adicionais) && item.adicionais.length > 0) {
                const adicionaisValidados = await Promise.all(
                    item.adicionais.map(async (ad) => {
                        if (!ad.id) return 0;
                        try {
                            const adRef = db.doc(`estabelecimentos/${estabelecimentoId}/adicionais/${ad.id}`);
                            const adSnap = await adRef.get();
                            if (!adSnap.exists) return 0;
                            return Number(adSnap.data().preco) || 0;
                        } catch {
                            return 0;
                        }
                    })
                );
                totalAdicionais = adicionaisValidados.reduce((acc, v) => acc + v, 0);
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
        const metodoRaw = venda.tipoPagamento || venda.metodoPagamento || venda.formaPagamento || "";
        const metodoLower = String(metodoRaw).toLowerCase().trim();

        // Detectar PIX em todas as variações: 'pix', 'pix_manual', 'PIX', 'Pix', etc.
        if (metodoLower.includes('pix')) {
            meioPagamento = "17"; // PIX
        } else if (metodoLower.includes('crédito') || metodoLower.includes('credito') || metodoLower.includes('credit')) {
            meioPagamento = "03"; // Cartão de Crédito
        } else if (metodoLower.includes('débito') || metodoLower.includes('debito') || metodoLower.includes('debit')) {
            meioPagamento = "04"; // Cartão de Débito
        } else if (metodoLower.includes('cartao') || metodoLower.includes('cartão') || metodoLower.includes('card')) {
            meioPagamento = "03"; // Cartão genérico → Crédito como padrão
        } else if (metodoLower.includes('dinheiro') || metodoLower.includes('cash')) {
            meioPagamento = "01"; // Dinheiro
        }

        // Verificação adicional: se há registro de pagamento via PIX no Firestore, forçar código 17
        try {
            const pixDocRef = db.collection('pagamentos_pix').doc(vendaId);
            const pixDocSnap = await pixDocRef.get();
            if (pixDocSnap.exists && pixDocSnap.data()?.status === 'pago') {
                logger.info(`💡 Pagamento PIX confirmado no Firestore para venda ${vendaId}. Forçando código 17.`);
                meioPagamento = "17";
            }
        } catch (pixCheckError) {
            logger.warn(`⚠️ Não foi possível verificar pagamentos_pix: ${pixCheckError.message}`);
        }

        logger.info(`💳 Forma de pagamento: "${metodoRaw}" → Código PlugNotas: "${meioPagamento}"`);

// 4. Montar os dados de Pagamento com a regra do Cartão
        const dadosPagamento = {
            aVista: true,
            meio: meioPagamento,
            valor: somaDosItens
        };

        // 🔥 CORREÇÃO: Se for Crédito (03) ou Débito (04), a Sefaz exige que você diga 
        // se a maquininha é integrada (TEF=1) ou não integrada (POS=2).
        if (meioPagamento === "03" || meioPagamento === "04") {
            dadosPagamento.cartao = {
                tipoIntegracao: 2 // 2 = Pagamento não integrado (Maquininha de cartão avulsa)
            };
        }

        // 5. Montar o Payload Principal
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
            pagamentos: [dadosPagamento]
        }];

        logger.info("🚀 [V3] Forma pagamento:", metodoRaw, "→ Código:", meioPagamento);
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

        // Tratar resposta de forma segura (pode vir HTML em vez de JSON)
        const responseText = await response.text();
        let result;
        try {
            result = JSON.parse(responseText);
        } catch (parseError) {
            logger.error("❌ PlugNotas retornou resposta inválida (não JSON):", responseText.slice(0, 500));
            throw new HttpsError('internal', `Erro de comunicação com PlugNotas. Tente novamente em alguns minutos.`);
        }

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
export const webhookPlugNotas = onRequest({ secrets: [plugNotasWebhookToken] }, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    // Verificação de autenticidade: o header deve conter o token secreto configurado no PlugNotas
    const receivedToken = req.headers['x-plugnotas-token'] || req.headers['authorization'];
    const expectedToken = plugNotasWebhookToken.value();
    if (!receivedToken || receivedToken !== expectedToken) {
        logger.warn('🚫 Webhook do PlugNotas recusado: token inválido ou ausente.');
        res.status(401).send('Unauthorized');
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

        // Tentar encontrar a venda: primeiro pelo idIntegracao direto, 
        // depois sem o sufixo de reenvio (ex: "vendaId_m1a2b3c" → "vendaId")
        let vendaRef = db.collection('vendas').doc(idIntegracao);
        let vendaSnap = await vendaRef.get();

        if (!vendaSnap.exists) {
            // Tentar sem o sufixo de timestamp (gerado nos reenvios)
            const vendaIdOriginal = idIntegracao.includes('_') 
                ? idIntegracao.split('_').slice(0, -1).join('_')
                : idIntegracao;
            
            logger.info(`🔍 Buscando venda pelo ID original: ${vendaIdOriginal}`);
            vendaRef = db.collection('vendas').doc(vendaIdOriginal);
            vendaSnap = await vendaRef.get();
        }

        if (!vendaSnap.exists) {
            // Última tentativa: buscar por idIntegracao no campo fiscal
            const querySnap = await db.collection('vendas')
                .where('fiscal.idIntegracao', '==', idIntegracao)
                .limit(1)
                .get();
            
            if (!querySnap.empty) {
                vendaRef = querySnap.docs[0].ref;
                vendaSnap = querySnap.docs[0];
                logger.info(`✅ Venda encontrada por query fiscal.idIntegracao: ${vendaRef.id}`);
            } else {
                logger.warn(`Venda não encontrada para o ID Integração: ${idIntegracao}`);
                res.status(200).send('OK');
                return;
            }
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
// mpClientSecret e mpClientIdSecret já foram definidos no topo do arquivo

// ==================================================================
// 13. VINCULAR CONTA DO LOJISTA (OAuth) - VERSÃO SEGURA
// ==================================================================
export const vincularMercadoPago = onCall({ 
    secrets: [mpClientSecret, mpClientIdSecret] 
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
                client_id: mpClientIdSecret.value(), // Lido do cofre de secrets
                client_secret: mpClientSecret.value(),
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

// ==================================================================
// 14. WHATSAPP BUSINESS API — WEBHOOK (Recebe mensagens dos clientes)
// ==================================================================
const whatsappVerifyToken = defineSecret("WHATSAPP_VERIFY_TOKEN");
const whatsappApiToken = defineSecret("WHATSAPP_API_TOKEN");

// Cache de conversas em memória (reseta quando a function recicla)
const conversas = {};

export const webhookWhatsApp = onRequest(
  { secrets: [whatsappVerifyToken, whatsappApiToken], maxInstances: 5 },
  async (req, res) => {

    // ─── VERIFICAÇÃO DO WEBHOOK (Meta envia GET na configuração) ───
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (mode === 'subscribe' && token === whatsappVerifyToken.value()) {
        logger.info('✅ WhatsApp webhook verificado');
        return res.status(200).send(challenge);
      }
      return res.status(403).send('Token inválido');
    }

    // ─── PROCESSAR MENSAGEM (POST) ───
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
      const body = req.body;
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (!value?.messages?.[0]) {
        return res.status(200).send('OK'); // Notification de status, ignorar
      }

      const msg = value.messages[0];
      const from = msg.from; // Número do cliente (5511999999999)
      const phoneNumberId = value.metadata?.phone_number_id; // ID do número que recebeu
      const messageText = msg.text?.body?.trim() || '';

      if (!from || !messageText) return res.status(200).send('OK');

      logger.info(`📱 WhatsApp de ${from}: "${messageText}"`);

      // ─── ENCONTRAR O ESTABELECIMENTO PELO NÚMERO ───
      const estabQuery = await db.collection('estabelecimentos')
        .where('whatsapp.phoneNumberId', '==', phoneNumberId)
        .limit(1)
        .get();

      if (estabQuery.empty) {
        logger.warn(`⚠️ Nenhum estabelecimento com phoneNumberId: ${phoneNumberId}`);
        return res.status(200).send('OK');
      }

      const estabDoc = estabQuery.docs[0];
      const estabId = estabDoc.id;
      const estab = estabDoc.data();
      const accessToken = estab.whatsapp?.accessToken || whatsappApiToken.value();

      // ─── CARREGAR CARDÁPIO ───
      const cardapioSnap = await db.collection(`estabelecimentos/${estabId}/cardapio`).where('ativo', '==', true).get();
      const produtos = cardapioSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // ─── ESTADO DA CONVERSA ───
      const chatKey = `${estabId}_${from}`;
      if (!conversas[chatKey]) {
        conversas[chatKey] = { etapa: 'inicio', itens: [], nome: '' };
      }
      const chat = conversas[chatKey];

      let resposta = '';
      const msgLower = messageText.toLowerCase();

      // ─── LÓGICA DO BOT ───
      if (chat.etapa === 'inicio' || msgLower === 'oi' || msgLower === 'olá' || msgLower === 'menu' || msgLower === 'cardápio' || msgLower === 'cardapio') {
        // SAUDAÇÃO + CARDÁPIO
        const categorias = {};
        produtos.forEach(p => {
          const cat = p.categoria || 'Outros';
          if (!categorias[cat]) categorias[cat] = [];
          categorias[cat].push(p);
        });

        let cardapioTexto = `🍔 *${estab.nome || 'Nosso Cardápio'}*\n\n`;
        Object.entries(categorias).forEach(([cat, items]) => {
          cardapioTexto += `*📌 ${cat}*\n`;
          items.forEach((p, i) => {
            const preco = Number(p.preco || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            cardapioTexto += `${i + 1}. ${p.nome} — R$ ${preco}\n`;
          });
          cardapioTexto += '\n';
        });

        cardapioTexto += `_Para pedir, digite o nome do item e a quantidade._\nEx: *2 X-Bacon*\n\nDigite *"finalizar"* para fechar o pedido.`;

        resposta = cardapioTexto;
        chat.etapa = 'pedindo';
        chat.itens = [];

      } else if (chat.etapa === 'pedindo' && msgLower === 'finalizar') {
        if (chat.itens.length === 0) {
          resposta = '⚠️ Seu pedido está vazio! Diga o que deseja pedir primeiro.';
        } else {
          chat.etapa = 'nome';
          let resumo = '📋 *Resumo do Pedido:*\n\n';
          let total = 0;
          chat.itens.forEach(item => {
            const subtotal = item.preco * item.qtd;
            total += subtotal;
            resumo += `• ${item.qtd}x ${item.nome} — R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
          });
          resumo += `\n💰 *Total: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n`;
          resumo += 'Para confirmar, *digite seu nome:*';
          resposta = resumo;
        }

      } else if (chat.etapa === 'nome') {
        chat.nome = messageText;
        chat.etapa = 'confirmado';

        // ─── CRIAR PEDIDO NO FIREBASE ───
        let total = 0;
        const itensFormatados = chat.itens.map(item => {
          total += item.preco * item.qtd;
          return { nome: item.nome, quantidade: item.qtd, preco: item.preco, id: item.id };
        });

        const novoPedido = {
          itens: itensFormatados,
          cliente: { nome: chat.nome, telefone: from },
          status: 'recebido',
          totalFinal: total,
          source: 'whatsapp',
          tipo: 'delivery',
          createdAt: FieldValue.serverTimestamp(),
          observacao: `Pedido via WhatsApp de ${from}`
        };

        const pedidoRef = await db.collection(`estabelecimentos/${estabId}/pedidos`).add(novoPedido);

        resposta = `✅ *Pedido confirmed!*\n\n🧑 ${chat.nome}\n📱 ${from}\n🆔 #${pedidoRef.id.slice(-6).toUpperCase()}\n\nSeu pedido foi recebido e está sendo preparado! 🎉\n\nDigite *"oi"* para fazer novo pedido.`;

        // Reset conversa
        delete conversas[chatKey];

      } else if (chat.etapa === 'pedindo') {
        // ─── INTERPRETAR ITEM ───
        // Tenta parsear "2 X-Bacon" ou "X-Bacon 2" ou "X-Bacon"
        const match = messageText.match(/^(\d+)\s*[xX]?\s*(.+)$/) || messageText.match(/^(.+?)\s+(\d+)$/);
        let qtd = 1;
        let nomeProduto = messageText;

        if (match) {
          if (/^\d+$/.test(match[1])) {
            qtd = parseInt(match[1]);
            nomeProduto = match[2].trim();
          } else {
            nomeProduto = match[1].trim();
            qtd = parseInt(match[2]);
          }
        }

        // Busca fuzzy no cardápio
        const produtoEncontrado = produtos.find(p =>
          p.nome.toLowerCase().includes(nomeProduto.toLowerCase()) ||
          nomeProduto.toLowerCase().includes(p.nome.toLowerCase())
        );

        if (produtoEncontrado) {
          chat.itens.push({ nome: produtoEncontrado.nome, preco: Number(produtoEncontrado.preco), qtd, id: produtoEncontrado.id });
          const subtotal = Number(produtoEncontrado.preco) * qtd;
          resposta = `✅ *${qtd}x ${produtoEncontrado.nome}* adicionado! (R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})\n\nContinue adicionando ou digite *"finalizar"*.`;
        } else {
          resposta = `❌ Não encontrei "${nomeProduto}" no cardápio.\n\nDigite *"menu"* para ver os itens disponíveis.`;
        }

      } else {
        resposta = 'Olá! 👋 Digite *"oi"* ou *"menu"* para começar seu pedido!';
      }

      // ─── ENVIAR RESPOSTA VIA WHATSAPP API ───
      await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: from,
          type: 'text',
          text: { body: resposta }
        })
      });

      res.status(200).send('OK');

    } catch (error) {
      logger.error('❌ Erro WhatsApp Webhook:', error);
      res.status(200).send('OK'); // Sempre 200 pro Meta não reenviar
    }
  }
);

// ==================================================================
// 15. ENVIAR MENSAGEM WHATSAPP (Do admin para o cliente)
// ==================================================================
export const enviarMensagemWhatsApp = onCall(
  { secrets: [whatsappApiToken] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

    const { telefone, mensagem, estabelecimentoId } = request.data;
    if (!telefone || !mensagem || !estabelecimentoId) {
      throw new HttpsError('invalid-argument', 'Telefone, mensagem e estabelecimentoId são obrigatórios.');
    }

    try {
      const estabDoc = await db.collection('estabelecimentos').doc(estabelecimentoId).get();
      const estab = estabDoc.data();
      const phoneNumberId = estab?.whatsapp?.phoneNumberId;
      const accessToken = estab?.whatsapp?.accessToken || whatsappApiToken.value();

      if (!phoneNumberId) throw new HttpsError('failed-precondition', 'WhatsApp não configurado.');

      // Formata telefone
      const tel = telefone.replace(/\D/g, '');
      const telFinal = tel.startsWith('55') ? tel : `55${tel}`;

      await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: telFinal,
          type: 'text',
          text: { body: mensagem }
        })
      });

      return { sucesso: true };
    } catch (error) {
      logger.error('❌ Erro enviar WhatsApp:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

// ==================================================================
// 16. MARKETING AUTOMÁTICO — SCHEDULER (Roda 1x por dia)
// ==================================================================
import { onSchedule } from "firebase-functions/v2/scheduler";

export const marketingAutomatico = onSchedule(
  { schedule: "every day 10:00", timeZone: "America/Sao_Paulo", secrets: [whatsappApiToken] },
  async () => {
    try {
      const estabsSnap = await db.collection('estabelecimentos').get();

      for (const estabDoc of estabsSnap.docs) {
        const estab = estabDoc.data();
        const config = estab.marketing || {};

        if (!config.ativo) continue;

        const diasInativo = config.diasInativo || 7;
        const mensagem = config.mensagem || `Faz tempo que você não pede no ${estab.nome || 'nosso restaurante'}! 🍔 Que tal pedir hoje?`;
        const limitePorDia = config.limiteDiario || 20;

        // Buscar pedidos dos últimos 90 dias para encontrar clientes
        const agora = new Date();
        const limite = new Date(agora.getTime() - (90 * 24 * 60 * 60 * 1000));

        const pedidosSnap = await db.collection(`estabelecimentos/${estabDoc.id}/pedidos`)
          .where('createdAt', '>=', limite)
          .get();

        // Mapa: cliente → último pedido
        const clientes = {};
        pedidosSnap.docs.forEach(d => {
          const p = d.data();
          const tel = p.cliente?.telefone || p.telefone;
          const nome = p.cliente?.nome || p.nomeCliente || 'Cliente';
          if (!tel) return;

          const dt = p.createdAt?.toDate?.() || new Date(p.createdAt?.seconds * 1000);
          if (!clientes[tel] || dt > clientes[tel].ultimoPedido) {
            clientes[tel] = { nome, telefone: tel, ultimoPedido: dt };
          }
        });

        // Filtrar: clientes que não pedem há X dias
        const inativos = Object.values(clientes).filter(c => {
          const diasSemPedir = (agora - c.ultimoPedido) / (1000 * 60 * 60 * 24);
          return diasSemPedir >= diasInativo;
        }).slice(0, limitePorDia);

        logger.info(`📧 Marketing ${estab.nome}: ${inativos.length} clientes inativos (>${diasInativo} dias)`);

        // Registrar campanha
        for (const cliente of inativos) {
          await db.collection(`estabelecimentos/${estabDoc.id}/campanhas`).add({
            tipo: 'reengajamento',
            clienteNome: cliente.nome,
            clienteTelefone: cliente.telefone,
            mensagem,
            enviadoEm: FieldValue.serverTimestamp(),
            diasInativo: Math.floor((agora - cliente.ultimoPedido) / (1000 * 60 * 60 * 24)),
            status: 'registrado'
          });
        }

        logger.info(`✅ Campanha registrada: ${inativos.length} clientes para ${estab.nome}`);
      }
    } catch (error) {
      logger.error('❌ Erro Marketing Automático:', error);
    }
  }
);

// ==================================================================
// 17. CONFIGURAR MARKETING (Callable — admin)
// ==================================================================
export const configurarMarketing = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId, config } = request.data;
  if (!estabelecimentoId || !config) throw new HttpsError('invalid-argument', 'Dados incompletos.');

  try {
    await db.collection('estabelecimentos').doc(estabelecimentoId).update({
      marketing: {
        ativo: config.ativo || false,
        diasInativo: config.diasInativo || 7,
        mensagem: config.mensagem || '',
        limiteDiario: config.limiteDiario || 20
      }
    });
    return { sucesso: true };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

// ==================================================================
// 18. NOTIFICAÇÃO AUTOMÁTICA WHATSAPP (Trigger de status do pedido)
// ==================================================================
const MENSAGENS_STATUS = {
  preparo: (nome, nomeEstab) => `🔥 *${nomeEstab}*\n\nOlá, ${nome}! Seu pedido já está sendo preparado! 👨‍🍳`,
  em_entrega: (nome, nomeEstab, motoboyNome) => `🛵 *${nomeEstab}*\n\nÓtima notícia, ${nome}! Seu pedido saiu para entrega!${motoboyNome ? `\n🏍️ Entregador: *${motoboyNome}*` : ''}`,
  pronto_para_servir: (nome, nomeEstab) => `✅ *${nomeEstab}*\n\n${nome}, seu pedido está *pronto*! Pode retirar. 🎉`,
  finalizado: (nome, nomeEstab) => `✅ *${nomeEstab}*\n\nPedido entregue! Obrigado pela preferência, ${nome}! 😊\n\nVolte sempre! 💛`
};

export const notificarClienteWhatsApp = onDocumentUpdated(
  {
    document: 'estabelecimentos/{estabId}/pedidos/{pedidoId}',
    secrets: [whatsappApiToken],
    maxInstances: 5
  },
  async (event) => {
    try {
      const antes = event.data?.before?.data();
      const depois = event.data?.after?.data();

      if (!antes || !depois) return;

      // Só dispara se o status realmente mudou
      const statusAntes = antes.status;
      const statusDepois = depois.status;
      if (statusAntes === statusDepois) return;

      // Só notifica para status relevantes
      const gerarMensagem = MENSAGENS_STATUS[statusDepois];
      if (!gerarMensagem) return;

      // Pega o telefone do cliente
      const telefoneCliente = depois.cliente?.telefone || depois.clienteTelefone || '';
      if (!telefoneCliente) {
        logger.info(`📱 Pedido ${event.params.pedidoId}: Sem telefone, pulando WhatsApp.`);
        return;
      }

      // Busca config WhatsApp do estabelecimento
      const estabId = event.params.estabId;
      const estabSnap = await db.collection('estabelecimentos').doc(estabId).get();
      if (!estabSnap.exists) return;

      const estab = estabSnap.data();
      const whatsappConfig = estab.whatsapp;

      // Só envia se o WhatsApp está ativo e configurado
      if (!whatsappConfig?.ativo || !whatsappConfig?.phoneNumberId) {
        return;
      }

      const accessToken = whatsappConfig.accessToken || whatsappApiToken.value();
      const phoneNumberId = whatsappConfig.phoneNumberId;
      const nomeEstab = estab.nome || 'Restaurante';
      const nomeCliente = depois.cliente?.nome || depois.clienteNome || 'Cliente';
      const motoboyNome = depois.motoboyNome || '';

      // Gera a mensagem personalizada
      const mensagem = gerarMensagem(nomeCliente, nomeEstab, motoboyNome);

      // Formata o telefone
      const tel = telefoneCliente.replace(/\D/g, '');
      const telFinal = tel.startsWith('55') ? tel : `55${tel}`;

      // Envia pelo WhatsApp Business API
      const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: telFinal,
          type: 'text',
          text: { body: mensagem }
        })
      });

      if (response.ok) {
        logger.info(`📱 WhatsApp enviado para ${telFinal} | Status: ${statusDepois} | Estab: ${nomeEstab}`);
      } else {
        const erro = await response.json().catch(() => ({}));
        logger.warn(`⚠️ Falha ao enviar WhatsApp para ${telFinal}:`, erro);
      }

    } catch (error) {
      // Nunca deixa o trigger falhar — apenas loga
      logger.error('❌ Erro no trigger de notificação WhatsApp:', error);
    }
  }
);