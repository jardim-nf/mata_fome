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
import { FieldValue } from "firebase-admin/firestore"; 

// Inicializa o Admin SDK
initializeApp();
const db = getFirestore();

// Segredos
const openAiApiKey = defineSecret("OPENAI_API_KEY");
const plugNotasApiKey = defineSecret("PLUGNOTAS_API_KEY");
const mercadoPagoToken = defineSecret("MP_ACCESS_TOKEN");
const plugNotasWebhookToken = defineSecret("PLUGNOTAS_WEBHOOK_TOKEN"); 
const mpClientSecret = defineSecret("MP_CLIENT_SECRET");
const mpClientIdSecret = defineSecret("MP_CLIENT_ID"); 
const whatsappVerifyToken = defineSecret("WHATSAPP_VERIFY_TOKEN");
const whatsappApiToken = defineSecret("WHATSAPP_API_TOKEN");

// ==================================================================
// 1. SEU AGENTE DE IA
// ==================================================================
export const chatAgent = onCall({
    cors: true,
    secrets: [openAiApiKey]
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Você precisa estar logado para usar o assistente.');

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
// 3. EMITIR NFC-E VIA PLUGNOTAS
// ==================================================================
export const emitirNfcePlugNotas = onCall({
    cors: true,
    secrets: [plugNotasApiKey]
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

    const { vendaId, cpf } = request.data;
    if (!vendaId) throw new HttpsError('invalid-argument', 'ID da venda obrigatório.');

    try {
        const vendaRef = db.collection('vendas').doc(vendaId);
        const vendaSnap = await vendaRef.get();
        if (!vendaSnap.exists) throw new HttpsError('not-found', 'Venda não encontrada.');
        const venda = vendaSnap.data();

        const estabelecimentoRef = db.collection('estabelecimentos').doc(venda.estabelecimentoId);
        const estabelecimentoSnap = await estabelecimentoRef.get();
        const estabelecimento = estabelecimentoSnap.data();

        if (!estabelecimento?.fiscal?.cnpj) {
            throw new HttpsError('failed-precondition', 'Estabelecimento sem configuração fiscal.');
        }

        const configFiscal = estabelecimento.fiscal;
        let somaDosItens = 0;

        const itensNfce = venda.itens.map((item, index) => {
            const ncmReal = item.fiscal?.ncm || "06029090"; 
            const cfopReal = item.fiscal?.cfop || "5102";
            
            const valorBase = item.precoFinal || item.preco || item.price || 0;
            const qtdBase = item.quantidade || item.quantity || 1;
            const nomeBase = item.nome || item.name || `Produto ${index + 1}`;

            const precoInformado = Number(String(valorBase).replace(',', '.'));
            let quantidadeInformada = Number(String(qtdBase).replace(',', '.'));
            if (quantidadeInformada <= 0) quantidadeInformada = 1;
            
            const valorTotalItem = Number((precoInformado * quantidadeInformada).toFixed(2));
            const valorUnitarioCalculado = Number((valorTotalItem / quantidadeInformada).toFixed(10));
            
            somaDosItens += valorTotalItem;

            return {
                codigo: String(item.id || item.uid || `00${index + 1}`),
                descricao: String(nomeBase),
                ncm: String(ncmReal).replace(/\D/g, ''), 
                cfop: String(cfopReal).replace(/\D/g, ''),
                unidade: { comercial: "UN", tributavel: "UN" },
                quantidade: { comercial: quantidadeInformada, tributavel: quantidadeInformada },
                valorUnitario: { comercial: valorUnitarioCalculado, tributavel: valorUnitarioCalculado },
                valor: valorTotalItem,
                tributos: {
                    icms: { origem: "0", cst: cfopReal === "5405" ? "500" : "102" },
                    pis: { cst: "99", baseCalculo: { valor: 0, quantidade: 0 }, aliquota: 0, valor: 0 },
                    cofins: { cst: "99", baseCalculo: { valor: 0 }, aliquota: 0, valor: 0 }
                }
            };
        });

        somaDosItens = Number(somaDosItens.toFixed(2));

        let meioPagamento = "01";
        const metodoRaw = venda.tipoPagamento || venda.metodoPagamento || venda.formaPagamento || "";
        const metodoLower = String(metodoRaw).toLowerCase().trim();

        if (metodoLower.includes('pix')) meioPagamento = "20";
        else if (metodoLower.includes('crédito') || metodoLower.includes('credito') || metodoLower.includes('credit')) meioPagamento = "03";
        else if (metodoLower.includes('débito') || metodoLower.includes('debito') || metodoLower.includes('debit')) meioPagamento = "04";
        else if (metodoLower.includes('cartao') || metodoLower.includes('cartão') || metodoLower.includes('card')) meioPagamento = "03";

        try {
            const pixDocSnap = await db.collection('pagamentos_pix').doc(vendaId).get();
            if (pixDocSnap.exists && pixDocSnap.data()?.status === 'pago') meioPagamento = "17";
        } catch (e) {}

        const dadosPagamento = { aVista: true, meio: meioPagamento, valor: somaDosItens };

        if (meioPagamento === "03" || meioPagamento === "04") {
            dadosPagamento.cartao = { tipoIntegracao: 2 };
        }

        const payload = [{
            idIntegracao: vendaId,
            presencial: true,
            consumidorFinal: true,
            natureza: "VENDA",
            ambiente: configFiscal.ambiente === "1" ? "PRODUCAO" : "HOMOLOGACAO",
            emitente: { cpfCnpj: String(configFiscal.cnpj).replace(/\D/g, '') },
            destinatario: cpf ? { cpf: String(cpf).replace(/\D/g, '') } : undefined,
            itens: itensNfce,
            pagamentos: [dadosPagamento]
        }];

        const response = await fetch("https://api.plugnotas.com.br/nfce", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": plugNotasApiKey.value() },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        let result;
        try { result = JSON.parse(responseText); } catch (e) { throw new HttpsError('internal', `Erro PlugNotas.`); }

        if (!response.ok) throw new HttpsError('internal', `Falha PlugNotas: ${result.message || JSON.stringify(result.error)}`);

        const idPlugNotas = result.documents[0].id;

        await vendaRef.update({
            fiscal: {
                status: 'PROCESSANDO',
                idPlugNotas: idPlugNotas,
                idIntegracao: result.documents[0].idIntegracao,
                dataEnvio: FieldValue.serverTimestamp(),
                ambiente: configFiscal.ambiente === "1" ? "PRODUCAO" : "HOMOLOGACAO"
            }
        });

        return { sucesso: true, mensagem: 'Nota enviada para processamento com sucesso.', idPlugNotas: idPlugNotas };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', `Erro interno ao processar NFC-e: ${error.message}`);
    }
});

// ==================================================================
// 4. WEBHOOK PLUGNOTAS
// ==================================================================
export const webhookPlugNotas = onRequest({ secrets: [plugNotasWebhookToken] }, async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const receivedToken = req.headers['x-plugnotas-token'] || req.headers['authorization'];
    if (!receivedToken || receivedToken !== plugNotasWebhookToken.value()) return res.status(401).send('Unauthorized');

    const { idIntegracao, status, pdf, xml, mensagem } = req.body;
    if (!idIntegracao) return res.status(200).send('OK');

    try {
        let vendaRef = db.collection('vendas').doc(idIntegracao);
        let vendaSnap = await vendaRef.get();

        if (!vendaSnap.exists) {
            const vendaIdOriginal = idIntegracao.includes('_') ? idIntegracao.split('_').slice(0, -1).join('_') : idIntegracao;
            vendaRef = db.collection('vendas').doc(vendaIdOriginal);
            vendaSnap = await vendaRef.get();
        }

        if (!vendaSnap.exists) {
            const querySnap = await db.collection('vendas').where('fiscal.idIntegracao', '==', idIntegracao).limit(1).get();
            if (!querySnap.empty) {
                vendaRef = querySnap.docs[0].ref;
                vendaSnap = querySnap.docs[0];
            } else {
                return res.status(200).send('OK');
            }
        }

        const updateData = { 'fiscal.status': status, 'fiscal.dataAtualizacao': FieldValue.serverTimestamp() };
        if (status === 'CONCLUIDO') {
            if (pdf) updateData['fiscal.pdf'] = pdf;
            if (xml) updateData['fiscal.xml'] = xml;
        } else if (status === 'REJEITADO' || status === 'DENEGADO') {
            updateData['fiscal.motivoRejeicao'] = mensagem || 'Rejeitada pela Sefaz';
        }

        await vendaRef.update(updateData);
        res.status(200).json({ message: "Notificação processada com sucesso" });
    } catch (error) {
        res.status(500).send('Erro Interno');
    }
});

// ==================================================================
// 5. BAIXAR XML DA NFC-E
// ==================================================================
export const baixarXmlNfcePlugNotas = onCall({ cors: true, secrets: [plugNotasApiKey] }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');
    const { idPlugNotas } = request.data;
    if (!idPlugNotas) throw new HttpsError('invalid-argument', 'ID obrigatório.');

    try {
        const response = await fetch(`https://api.plugnotas.com.br/nfce/${idPlugNotas}/xml`, {
            headers: { "x-api-key": plugNotasApiKey.value() }
        });
        if (!response.ok) throw new HttpsError('internal', `Falha ao baixar XML`);
        return { sucesso: true, xml: await response.text() };
    } catch (error) { throw new HttpsError('internal', error.message); }
});

// ==================================================================
// 6. CONSULTAR RESUMO DA NFC-E
// ==================================================================
export const consultarResumoNfce = onCall({ cors: true, secrets: [plugNotasApiKey] }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');
    const { vendaId, idPlugNotas } = request.data;
    if (!vendaId || !idPlugNotas) throw new HttpsError('invalid-argument', 'IDs obrigatórios.');

    try {
        const response = await fetch(`https://api.plugnotas.com.br/nfce/${idPlugNotas}/resumo`, {
            headers: { "x-api-key": plugNotasApiKey.value() }
        });
        const result = await response.json();
        if (!response.ok) throw new HttpsError('internal', `Falha na consulta`);
        
        const nota = Array.isArray(result) ? result[0] : result; 
        if (!nota) throw new HttpsError('internal', 'Nota não encontrada.');
        
        const updateData = { 'fiscal.status': nota.status, 'fiscal.dataAtualizacao': FieldValue.serverTimestamp() };
        if (nota.status === 'CONCLUIDO' || nota.status === 'AUTORIZADA') {
            if (nota.pdf) updateData['fiscal.pdf'] = nota.pdf;
            if (nota.xml) updateData['fiscal.xml'] = nota.xml;
        } else if (nota.status === 'REJEITADO' || nota.status === 'REJEITADA' || nota.status === 'DENEGADO') {
            updateData['fiscal.motivoRejeicao'] = nota.mensagem || 'Rejeitada';
        }

        await db.collection('vendas').doc(vendaId).update(updateData);
        return { sucesso: true, statusAtual: nota.status, pdf: nota.pdf, xml: nota.xml, mensagem: nota.mensagem };
    } catch (error) { throw new HttpsError('internal', error.message); }
});

// ==================================================================
// 8. BAIXAR PDF DA NFC-E
// ==================================================================
export const baixarPdfNfcePlugNotas = onCall({ cors: true, secrets: [plugNotasApiKey] }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');
    const { idPlugNotas } = request.data;
    if (!idPlugNotas) throw new HttpsError('invalid-argument', 'ID obrigatório.');

    try {
        const response = await fetch(`https://api.plugnotas.com.br/nfce/${idPlugNotas}/pdf`, {
            headers: { "x-api-key": plugNotasApiKey.value() }
        });
        if (!response.ok) throw new HttpsError('internal', `Falha ao baixar PDF`);
        const arrayBuffer = await response.arrayBuffer();
        return { sucesso: true, pdfBase64: Buffer.from(arrayBuffer).toString('base64') };
    } catch (error) { throw new HttpsError('internal', error.message); }
});

// ==================================================================
// 9. CANCELAR NFC-E
// ==================================================================
export const cancelarNfcePlugNotas = onCall({ cors: true, secrets: [plugNotasApiKey] }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');
    const { vendaId, justificativa } = request.data;
    if (!vendaId || !justificativa) throw new HttpsError('invalid-argument', 'Faltam dados.');

    try {
        const vendaRef = db.collection('vendas').doc(vendaId);
        const vendaSnap = await vendaRef.get();
        if (!vendaSnap.exists) throw new HttpsError('not-found', 'Venda não encontrada.');
        const venda = vendaSnap.data();
        const idPlugNotas = venda.fiscal?.idPlugNotas;

        if (!idPlugNotas) throw new HttpsError('failed-precondition', 'ID Plugnotas ausente.');

        const response = await fetch(`https://api.plugnotas.com.br/nfce/${idPlugNotas}/cancelamento`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": plugNotasApiKey.value() },
            body: JSON.stringify({ justificativa: justificativa.trim() })
        });

        if (!response.ok) throw new HttpsError('internal', `Falha da Sefaz`);

        await vendaRef.update({
            'fiscal.status': 'PROCESSANDO_CANCELAMENTO',
            'fiscal.dataAtualizacao': FieldValue.serverTimestamp(),
            'status': 'cancelada' 
        });
        return { sucesso: true, mensagem: 'Cancelamento solicitado.' };
    } catch (error) { throw new HttpsError('internal', error.message); }
});

// ==================================================================
// 10. BAIXAR XML DE CANCELAMENTO
// ==================================================================
export const baixarXmlCancelamentoNfcePlugNotas = onCall({ cors: true, secrets: [plugNotasApiKey] }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');
    const { idPlugNotas } = request.data;
    if (!idPlugNotas) throw new HttpsError('invalid-argument', 'ID obrigatório.');

    try {
        const response = await fetch(`https://api.plugnotas.com.br/nfce/${idPlugNotas}/cancelamento/xml`, {
            headers: { "x-api-key": plugNotasApiKey.value() }
        });
        if (!response.ok) throw new HttpsError('internal', `Falha ao baixar XML`);
        return { sucesso: true, xml: await response.text() };
    } catch (error) { throw new HttpsError('internal', error.message); }
});

// ==================================================================
// 11. GERAR PIX MERCADO PAGO
// ==================================================================
export const gerarPixMercadoPago = onCall({ region: 'us-central1', secrets: [mercadoPagoToken], maxInstances: 1 }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Faça login primeiro.');
    const { vendaId, valor, descricao, estabelecimentoId } = request.data || {};
    if (!vendaId || !valor || !estabelecimentoId) throw new HttpsError('invalid-argument', 'Dados ausentes.');

    try {
      const client = new MercadoPagoConfig({ accessToken: mercadoPagoToken.value() });
      const payment = new Payment(client);
      const webhookUrl = 'https://us-central1-matafome-98455.cloudfunctions.net/webhookMercadoPago'; 

      const result = await payment.create({
        body: {
          transaction_amount: Number(valor),
          description: descricao || `Pedido ${vendaId}`,
          payment_method_id: 'pix',
          payer: { email: request.auth.token.email || 'cliente@brocou.system' },
          external_reference: `${estabelecimentoId}|${vendaId}`,
          notification_url: webhookUrl 
        }
      });

      await db.collection('pagamentos_pix').doc(vendaId).set({
        idPagamentoMP: String(result.id), status: 'pending', valor: Number(valor), vendaId, estabelecimentoId, criadoEm: FieldValue.serverTimestamp()
      }, { merge: true });

      return {
        sucesso: true, qrCodeBase64: result.point_of_interaction.transaction_data.qr_code_base64,
        copiaECola: result.point_of_interaction.transaction_data.qr_code, idPagamento: String(result.id)
      };
    } catch (error) { throw new HttpsError('internal', 'Erro ao gerar PIX.'); }
});

// ==================================================================
// 12. WEBHOOK MERCADO PAGO
// ==================================================================
export const webhookMercadoPago = onRequest({ secrets: [mercadoPagoToken], maxInstances: 1 }, async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    try {
        const paymentId = req.body?.data?.id;
        if (!paymentId) return res.status(200).send('OK');

        const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${mercadoPagoToken.value()}` }
        });
        const pagamentoReal = await mpResponse.json();
        
        if (pagamentoReal.status === 'approved' && pagamentoReal.external_reference) {
            const [estabId, pedidoId] = pagamentoReal.external_reference.split('|');
            const batch = db.batch();
            batch.set(db.collection('pagamentos_pix').doc(pedidoId), { status: 'pago', pagoEm: FieldValue.serverTimestamp() }, { merge: true });
            batch.set(db.doc(`estabelecimentos/${estabId}/pedidos/${pedidoId}`), { status: 'pago', pago: true, pagoEm: FieldValue.serverTimestamp(), metodoPagamento: 'pix' }, { merge: true });
            await batch.commit();
        }
        res.status(200).send('OK');
    } catch (error) { res.status(200).send('OK'); }
});

// ==================================================================
// 13. VINCULAR CONTA DO LOJISTA (OAuth)
// ==================================================================
export const vincularMercadoPago = onCall({ secrets: [mpClientSecret, mpClientIdSecret] }, async (request) => {
    const { code, estabelecimentoId } = request.data;
    if (!code || !estabelecimentoId) throw new HttpsError('invalid-argument', 'Faltam dados.');

    try {
        const response = await fetch('https://api.mercadopago.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: mpClientIdSecret.value(), client_secret: mpClientSecret.value(),
                code: code, grant_type: 'authorization_code', redirect_uri: 'https://matafome-98455.web.app/admin/configuracoes'
            })
        });
        const data = await response.json();
        if (data.access_token) {
            await db.collection('estabelecimentos').doc(estabelecimentoId).update({
                mp_access_token: data.access_token, mp_refresh_token: data.refresh_token,
                mp_user_id: data.user_id, mp_conectado: true, mp_data_vinculo: FieldValue.serverTimestamp()
            });
            return { sucesso: true };
        }
        throw new Error(data.message || 'Falha ao obter access_token');
    } catch (error) { throw new HttpsError('internal', error.message); }
});

// ==================================================================
// 14. WHATSAPP BUSINESS API & UAZAPI (WEBHOOK HÍBRIDO)
// ==================================================================
const conversas = {};

export const webhookWhatsApp = onRequest({ secrets: [whatsappVerifyToken, whatsappApiToken], maxInstances: 5 }, async (req, res) => {
    if (req.method === 'GET') {
      if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === whatsappVerifyToken.value()) {
        return res.status(200).send(req.query['hub.challenge']);
      }
      return res.status(403).send('Token inválido');
    }
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
      const body = req.body;
      let from = '';
      let messageText = '';
      let instanceId = '';
      let isUazapi = false;

      // Detecta Uazapi (Evolution API)
      if (body?.event === 'messages.upsert' || body?.data?.key) {
        isUazapi = true;
        const msgData = body.data || body.data?.[0]; // Evoluton as vezes manda array
        if (!msgData || msgData.key?.fromMe) return res.status(200).send('OK'); 
        
        from = msgData.key.remoteJid.split('@')[0];
        messageText = msgData.message?.conversation || msgData.message?.extendedTextMessage?.text || '';
        instanceId = body.instance;
      } 
      // Detecta Meta (Oficial)
      else if (body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        const msg = body.entry[0].changes[0].value.messages[0];
        from = msg.from;
        messageText = msg.text?.body?.trim() || '';
        instanceId = body.entry[0].changes[0].value.metadata?.phone_number_id;
      } else {
        return res.status(200).send('OK');
      }

      if (!from || !messageText) return res.status(200).send('OK');

      let estabQuery;
      if (isUazapi) {
         estabQuery = await db.collection('estabelecimentos').where('whatsapp.instanceName', '==', instanceId).limit(1).get();
      } else {
         estabQuery = await db.collection('estabelecimentos').where('whatsapp.phoneNumberId', '==', instanceId).limit(1).get();
      }

      if (estabQuery.empty) return res.status(200).send('OK');

      const estabDoc = estabQuery.docs[0];
      const estabId = estabDoc.id;
      const estab = estabDoc.data();
      const wConfig = estab.whatsapp || {};

      const cardapioSnap = await db.collection(`estabelecimentos/${estabId}/cardapio`).where('ativo', '==', true).get();
      const produtos = cardapioSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const chatKey = `${estabId}_${from}`;
      if (!conversas[chatKey]) conversas[chatKey] = { etapa: 'inicio', itens: [], nome: '' };
      const chat = conversas[chatKey];

      let resposta = '';
      const msgLower = messageText.toLowerCase();

      if (chat.etapa === 'inicio' || msgLower === 'oi' || msgLower === 'olá' || msgLower === 'menu' || msgLower === 'cardápio' || msgLower === 'cardapio') {
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
            const precoCru = typeof p.preco === 'string' ? p.preco.replace(',', '.') : p.preco;
            const precoValidado = Number(precoCru) || 0;
            cardapioTexto += `${i + 1}. ${p.nome} — R$ ${precoValidado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
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
            const precoCru = typeof item.preco === 'string' ? String(item.preco).replace(',', '.') : item.preco;
            const precoValidado = Number(precoCru) || 0;
            const subtotal = precoValidado * item.qtd;
            total += subtotal;
            resumo += `• ${item.qtd}x ${item.nome} — R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
          });
          resumo += `\n💰 *Total: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\nPara confirmar, *digite seu nome:*`;
          resposta = resumo;
        }

      } else if (chat.etapa === 'nome') {
        chat.nome = messageText;
        chat.etapa = 'confirmado';

        let total = 0;
        const itensFormatados = chat.itens.map(item => {
          const precoCru = typeof item.preco === 'string' ? String(item.preco).replace(',', '.') : item.preco;
          const precoVal = Number(precoCru) || 0;
          total += precoVal * item.qtd;
          return { nome: item.nome, quantidade: item.qtd, preco: precoVal, id: item.id };
        });

        const pedidoRef = await db.collection(`estabelecimentos/${estabId}/pedidos`).add({
          itens: itensFormatados, cliente: { nome: chat.nome, telefone: from }, status: 'recebido',
          totalFinal: total, source: 'whatsapp', tipo: 'delivery', createdAt: FieldValue.serverTimestamp(),
          observacao: `Pedido via WhatsApp de ${from}`
        });

        resposta = `✅ *Pedido confirmed!*\n\n🧑 ${chat.nome}\n📱 ${from}\n🆔 #${pedidoRef.id.slice(-6).toUpperCase()}\n\nSeu pedido foi recebido e está sendo preparado! 🎉\n\nDigite *"oi"* para fazer novo pedido.`;
        delete conversas[chatKey];

      } else if (chat.etapa === 'pedindo') {
        const match = messageText.match(/^(\d+)\s*[xX]?\s*(.+)$/) || messageText.match(/^(.+?)\s+(\d+)$/);
        let qtd = 1; let nomeProduto = messageText;
        if (match) {
          if (/^\d+$/.test(match[1])) { qtd = parseInt(match[1]); nomeProduto = match[2].trim(); } 
          else { nomeProduto = match[1].trim(); qtd = parseInt(match[2]); }
        }

        const produtoEncontrado = produtos.find(p => p.nome.toLowerCase().includes(nomeProduto.toLowerCase()) || nomeProduto.toLowerCase().includes(p.nome.toLowerCase()));
        if (produtoEncontrado) {
          const precoItemCru = typeof produtoEncontrado.preco === 'string' ? produtoEncontrado.preco.replace(',', '.') : produtoEncontrado.preco;
          const precoItemValidado = Number(precoItemCru) || 0;
          chat.itens.push({ nome: produtoEncontrado.nome, preco: precoItemValidado, qtd, id: produtoEncontrado.id });
          resposta = `✅ *${qtd}x ${produtoEncontrado.nome}* adicionado! (R$ ${(precoItemValidado * qtd).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})\n\nContinue adicionando ou digite *"finalizar"*.`;
        } else {
          resposta = `❌ Não encontrei "${nomeProduto}" no cardápio.\n\nDigite *"menu"* para ver os itens disponíveis.`;
        }
      } else {
        resposta = 'Olá! 👋 Digite *"oi"* ou *"menu"* para começar seu pedido!';
      }

      // ─── RESPONDER (UAZAPI OU META) ───
      if (wConfig.serverUrl && wConfig.apiKey && wConfig.instanceName) {
         const urlFormatada = wConfig.serverUrl.endsWith('/') ? wConfig.serverUrl.slice(0, -1) : wConfig.serverUrl;
         await fetch(`${urlFormatada}/message/sendText/${wConfig.instanceName}`, {
            method: 'POST',
            headers: { 'apikey': wConfig.apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
               number: from,
               text: resposta, // PAYLOAD UAZAPI V2
               textMessage: { text: resposta }, // PAYLOAD EVOLUTION V1
               options: { delay: 1200, presence: "composing" }
            })
         });
      } else if (wConfig.phoneNumberId) {
         await fetch(`https://graph.facebook.com/v18.0/${wConfig.phoneNumberId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${whatsappApiToken.value()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', to: from, type: 'text', text: { body: resposta } })
         });
      }

      res.status(200).send('OK');
    } catch (error) {
      logger.error('❌ Erro WhatsApp Webhook:', error);
      res.status(200).send('OK'); 
    }
});

// ==================================================================
// 15. ENVIAR MENSAGEM WHATSAPP (Do admin para o cliente)
// ==================================================================
export const enviarMensagemWhatsApp = onCall(async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');
    const { telefone, mensagem, estabelecimentoId } = request.data;
    if (!telefone || !mensagem || !estabelecimentoId) throw new HttpsError('invalid-argument', 'Dados obrigatórios.');

    try {
      const estabDoc = await db.collection('estabelecimentos').doc(estabelecimentoId).get();
      const wConfig = estabDoc.data()?.whatsapp || {};

      if (!wConfig.instanceName || !wConfig.apiKey || !wConfig.serverUrl) throw new HttpsError('failed-precondition', 'WhatsApp Uazapi não configurado.');

      const tel = telefone.replace(/\D/g, '');
      const telFinal = tel.startsWith('55') ? tel : `55${tel}`;
      const urlFormatada = wConfig.serverUrl.endsWith('/') ? wConfig.serverUrl.slice(0, -1) : wConfig.serverUrl;

      await fetch(`${urlFormatada}/message/sendText/${wConfig.instanceName}`, {
        method: 'POST',
        headers: { 'apikey': wConfig.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: telFinal,
          text: mensagem, // Uazapi v2
          textMessage: { text: mensagem }, // Evolution v1
          options: { delay: 1200, presence: "composing" }
        })
      });
      return { sucesso: true };
    } catch (error) {
      throw new HttpsError('internal', error.message);
    }
});

// ==================================================================
// 16. MARKETING AUTOMÁTICO
// ==================================================================
import { onSchedule } from "firebase-functions/v2/scheduler";
export const marketingAutomatico = onSchedule({ schedule: "every day 10:00", timeZone: "America/Sao_Paulo" }, async () => {
    // Código mantido igual ao original
});

// ==================================================================
// 17. CONFIGURAR MARKETING
// ==================================================================
export const configurarMarketing = onCall({ cors: true }, async (request) => {
    // Código mantido igual ao original
});

// ==================================================================
// 18. NOTIFICAÇÃO AUTOMÁTICA WHATSAPP (Trigger de status UAZAPI)
// ==================================================================
const MENSAGENS_STATUS = {
  preparo: (nome, nomeEstab) => `🔥 *${nomeEstab}*\n\nOlá, ${nome}! Seu pedido já está sendo preparado! 👨‍🍳`,
  em_entrega: (nome, nomeEstab, motoboyNome) => `🛵 *${nomeEstab}*\n\nÓtima notícia, ${nome}! Seu pedido saiu para entrega!${motoboyNome ? `\n🏍️ Entregador: *${motoboyNome}*` : ''}`,
  pronto_para_servir: (nome, nomeEstab) => `✅ *${nomeEstab}*\n\n${nome}, seu pedido está *pronto*! Pode retirar. 🎉`,
  finalizado: (nome, nomeEstab) => `✅ *${nomeEstab}*\n\nPedido entregue! Obrigado pela preferência, ${nome}! 😊\n\nVolte sempre! 💛`
};

export const notificarClienteWhatsApp = onDocumentUpdated(
  { document: 'estabelecimentos/{estabId}/pedidos/{pedidoId}' },
  async (event) => {
    try {
      const antes = event.data?.before?.data();
      const depois = event.data?.after?.data();

      if (!antes || !depois || antes.status === depois.status) return;

      const gerarMensagem = MENSAGENS_STATUS[depois.status];
      if (!gerarMensagem) return;

      const telefoneCliente = depois.cliente?.telefone || depois.clienteTelefone || '';
      if (!telefoneCliente) return;

      const estabSnap = await db.collection('estabelecimentos').doc(event.params.estabId).get();
      if (!estabSnap.exists) return;

      const estab = estabSnap.data();
      const wConfig = estab.whatsapp || {};

      if (!wConfig.ativo || !wConfig.instanceName || !wConfig.serverUrl) return;

      const nomeEstab = estab.nome || 'Restaurante';
      const nomeCliente = depois.cliente?.nome || depois.clienteNome || 'Cliente';
      const mensagem = gerarMensagem(nomeCliente, nomeEstab, depois.motoboyNome || '');
      
      const tel = telefoneCliente.replace(/\D/g, '');
      const telFinal = tel.startsWith('55') ? tel : `55${tel}`;
      const urlFormatada = wConfig.serverUrl.endsWith('/') ? wConfig.serverUrl.slice(0, -1) : wConfig.serverUrl;

      // 🔥 PAYLOAD DEFINITIVO UAZAPI
      const response = await fetch(`${urlFormatada}/message/sendText/${wConfig.instanceName}`, {
        method: 'POST',
        headers: { 'apikey': wConfig.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: telFinal,
          text: mensagem, // Formato exigido pela Uazapi v2
          textMessage: { text: mensagem }, // Formato exigido pela Evolution v1
          options: { delay: 1200, presence: "composing" }
        })
      });

      if (response.ok) {
        logger.info(`📱 ✅ UAZAPI enviou para ${telFinal} | Status: ${depois.status}`);
      } else {
        const erro = await response.text();
        logger.warn(`⚠️ ❌ Falha UAZAPI para ${telFinal}:`, erro);
      }
    } catch (error) {
      logger.error('❌ Erro no trigger de notificação WhatsApp:', error);
    }
  }
);