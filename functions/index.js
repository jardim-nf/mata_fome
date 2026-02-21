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
const plugNotasApiKey = defineSecret("PLUGNOTAS_API_KEY"); // 🔓 Liberado

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
// 3. EMITIR NFC-E VIA PLUGNOTAS (INTEGRAÇÃO REAL)
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
            throw new HttpsError('failed-precondition', 'Estabelecimento sem configuração fiscal.');
        }

        const configFiscal = estabelecimento.fiscal;

        // 3. Montar os itens para o padrão PlugNotas
        const itensNfce = venda.itens.map(item => ({
            codigo: item.id || "001",
            descricao: item.nome,
            ncm: item.ncm || "21069090", // NCM Genérico para alimentação (ajuste conforme necessário)
            cfop: "5102", // Venda de mercadoria adquirida/recebida de terceiros
            valorUnitario: item.precoFinal,
            quantidade: item.quantidade,
            tributos: {
                // Configuração básica para Simples Nacional (CSOSN 102)
                icms: { origem: "0", csosn: "102" },
                pis: { cst: "99" },
                cofins: { cst: "99" }
            }
        }));

        // 4. Montar o Payload Principal
        const payload = [{
            idIntegracao: vendaId, // Seu ID interno para rastrear
            presencial: true,
            consumidorFinal: true,
            naturezaOperacao: "Venda de Mercadoria",
            ambiente: configFiscal.ambiente === "1" ? "PRODUCAO" : "HOMOLOGACAO",
            destinatario: cpf ? { cpf: cpf.replace(/\D/g, '') } : undefined, // Envia CPF apenas se existir
            itens: itensNfce,
            pagamentos: [{
                // Mapeia o tipo de pagamento da sua venda (01=Dinheiro, 03=Crédito, 04=Débito, 17=PIX)
                tPag: venda.metodoPagamento === "PIX" ? "17" : "01", 
                vPag: venda.total
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

        if (!response.ok) {
            logger.error("❌ Erro retornado pelo PlugNotas:", result);
            throw new HttpsError('internal', `Falha no PlugNotas: ${result.message || 'Erro desconhecido'}`);
        }

        // A API retorna o ID do processamento
        const idPlugNotas = result.documents[0].id;

        const fiscalData = {
            status: 'PROCESSANDO', 
            idPlugNotas: idPlugNotas,
            idIntegracao: result.documents[0].idIntegracao,
            dataEnvio: FieldValue.serverTimestamp(),
            ambiente: configFiscal.ambiente === "1" ? "PRODUCAO" : "HOMOLOGACAO"
        };

        // 6. Atualiza a venda no banco com o status de processamento
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
        throw new HttpsError('internal', 'Erro interno ao processar NFC-e.');
    }
});

// ==================================================================
// 4. WEBHOOK PLUGNOTAS (RETORNO ASSÍNCRONO DA SEFAZ)
// ==================================================================
export const webhookPlugNotas = onRequest(async (req, res) => {
    // O PlugNotas envia um POST com os dados do processamento
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const data = req.body;
    logger.info(`🔔 Webhook Recebido do PlugNotas:`, data);

    try {
        // idIntegracao é o ID da nossa venda que enviamos na emissão
        const { id, idIntegracao, status, pdf, xml, mensagem } = data;

        if (!idIntegracao) {
            logger.warn("Webhook ignorado: Sem idIntegracao (ID da Venda).");
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

        // Prepara a atualização no banco
        const updateData = {
            'fiscal.status': status,
            'fiscal.dataAtualizacao': FieldValue.serverTimestamp()
        };

        // Se a Sefaz autorizou, salva os links
        if (status === 'CONCLUIDO') {
            if (pdf) updateData['fiscal.pdf'] = pdf;
            if (xml) updateData['fiscal.xml'] = xml;
        } 
        // Se deu erro, salva o motivo
        else if (status === 'REJEITADO' || status === 'DENEGADO') {
            updateData['fiscal.motivoRejeicao'] = mensagem || 'Rejeitada pela Sefaz';
        }

        // Aplica a atualização no Firestore
        await vendaRef.update(updateData);
        logger.info(`✅ Venda ${idIntegracao} atualizada com status: ${status}`);

        // Responde 200 rápido para o PlugNotas saber que a notificação foi recebida
        res.status(200).json({ message: "Notificação processada com sucesso" });

    } catch (error) {
        logger.error("❌ Erro ao processar Webhook do PlugNotas:", error);
        res.status(500).send('Erro Interno');
    }
});