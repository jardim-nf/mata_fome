// functions/index.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
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
// const plugNotasApiKey = defineSecret("PLUGNOTAS_API_KEY"); // 🔒 Comentado até você ter a chave

// ==================================================================
// 1. SEU AGENTE DE IA (MANTIDO)
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
// 2. CRIAR PEDIDO SEGURO (MANTIDO)
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
                precoFinal: precoFinalItem
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
// 3. 🆕 EMITIR NFC-e (MODO SIMULAÇÃO / PLACEHOLDER)
// ==================================================================
export const emitirNfcePlugNotas = onCall({ cors: true }, async (request) => {
    // 1. Validação básica
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');
    
    const { vendaId, cpf } = request.data;
    if (!vendaId) throw new HttpsError('invalid-argument', 'ID da venda obrigatório.');

    try {
        logger.info(`🧾 Iniciando emissão (SIMULAÇÃO) para Venda: ${vendaId} | CPF: ${cpf || 'N/A'}`);

        // 2. Busca a venda para garantir que existe
        const vendaRef = db.collection('vendas').doc(vendaId);
        const vendaSnap = await vendaRef.get();

        if (!vendaSnap.exists) throw new HttpsError('not-found', 'Venda não encontrada.');

        // 3. Simula tempo de processamento da Sefaz (1.5 segundos)
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 4. Cria dados fiscais fictícios para teste visual
        // Link de um PDF de exemplo público para você ver funcionando na tela
        const fakePdfUrl = "https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=URCYvjVMIzI="; 
        const fakeXmlUrl = "https://exemplo.com/fake.xml";

        const fiscalData = {
            status: 'AUTORIZADA', // Status de sucesso da Sefaz
            protocolo: '1234567890001',
            idPlugNotas: 'simulacao_id_' + Date.now(),
            dataEmissao: FieldValue.serverTimestamp(),
            pdf: fakePdfUrl,
            xml: fakeXmlUrl,
            ambiente: 'HOMOLOGACAO_SIMULADA'
        };

        // 5. Atualiza a venda no banco
        await vendaRef.update({ fiscal: fiscalData });

        logger.info(`✅ Emissão Simulada com Sucesso: ${vendaId}`);

        return {
            sucesso: true,
            mensagem: 'Nota emitida com sucesso (Simulação).',
            pdfUrl: fakePdfUrl,
            xmlUrl: fakeXmlUrl
        };

    } catch (error) {
        logger.error("❌ Erro na Emissão (Simulação):", error);
        throw new HttpsError('internal', 'Erro ao processar emissão simulada.');
    }
});