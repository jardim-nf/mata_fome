// functions/index.js
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params"; 
import OpenAI from "openai";

// --- IMPORTS FIREBASE ADMIN ---
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Inicializa o Admin SDK
initializeApp();
const db = getFirestore();

// Segredos
const openAiApiKey = defineSecret("OPENAI_API_KEY");
const plugNotasApiKey = defineSecret("PLUGNOTAS_API_KEY"); 

// ==================================================================
// 1. SEU AGENTE DE IA
// ==================================================================
export const chatAgent = onCall({ 
    cors: true,
    secrets: [openAiApiKey] 
}, async (request) => {
    
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
        const itensNfce = venda.itens.map((item, index) => {
            const ncmReal = item.fiscal?.ncm || "21069090"; 
            const cfopReal = item.fiscal?.cfop || "5102";
            const unidadeReal = item.fiscal?.unidade || "UN";
            
            const precoFinal = Number(item.precoFinal || item.preco || 0);
            const quantidade = Number(item.quantidade || 1);
            const valorTotalItem = precoFinal * quantidade;

            // Define se a empresa é Simples Nacional (1) ou Regime Normal (3)
            const isSimplesNacional = configFiscal.regimeTributario === "1";
            
            const tributosIcms = { origem: "0" };
            if (isSimplesNacional) {
                tributosIcms.csosn = cfopReal === "5405" ? "500" : "102";
            } else {
                // Se a API pede CST, preenchemos o CST para Regime Normal
                tributosIcms.cst = cfopReal === "5405" ? "60" : "00";
            }

            return {
                codigo: String(item.id || `00${index + 1}`),
                // CORREÇÃO 1: Garante que a descrição nunca vá vazia
                descricao: item.nome ? String(item.nome) : `Produto ${index + 1}`,
                ncm: String(ncmReal).replace(/\D/g, ''), 
                cfop: String(cfopReal).replace(/\D/g, ''),
                // CORREÇÃO 2: Garante que a unidade seja sempre uma String válida
                unidade: String(unidadeReal), 
                valorUnitario: {
                    comercial: precoFinal,
                    tributavel: precoFinal
                },
                valor: valorTotalItem,
                tributos: {
                    // CORREÇÃO 3: Envia 'cst' ou 'csosn' dependendo do regime tributário
                    icms: tributosIcms,
                    pis: { cst: "99" },
                    cofins: { cst: "99" }
                }
            };
        });

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
            natureza: "VENDA", // Alterado de naturezaOperacao para natureza
            ambiente: configFiscal.ambiente === "1" ? "PRODUCAO" : "HOMOLOGACAO",
            emitente: {
                cpfCnpj: String(configFiscal.cnpj).replace(/\D/g, '') // Garante que envia apenas números
            },
            destinatario: cpf ? { cpf: String(cpf).replace(/\D/g, '') } : undefined,
            itens: itensNfce,
            pagamentos: [{
                aVista: true, // Propriedade exigida pelo PlugNotas
                meio: meioPagamento, // Alterado de tPag
                valor: Number(venda.total || 0) // Alterado de vPag
            }]
        }];

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