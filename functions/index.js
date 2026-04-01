// functions/index.js
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentUpdated, onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import OpenAI from "openai";
import archiver from "archiver";
import nodemailer from "nodemailer";

import { MercadoPagoConfig, Payment } from 'mercadopago';
// --- IMPORTS FIREBASE ADMIN ---
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// Inicializa o Admin SDK
initializeApp();
const db = getFirestore();
const bucket = getStorage().bucket();

// ==================================================================
// FUNÇÃO AUXILIAR: Salvar XML no Firebase Storage
// ==================================================================
async function salvarArquivoNoStorage(estabelecimentoId, vendaId, urlOriginal, tipo, apiKey) {
    try {
        if (!urlOriginal || !estabelecimentoId || !vendaId) return null;

        const response = await fetch(urlOriginal, {
            headers: apiKey ? { "x-api-key": apiKey } : {}
        });
        if (!response.ok) {
            logger.warn(`Falha ao baixar ${tipo} de ${urlOriginal}: ${response.status}`);
            return null;
        }

        const contentBuffer = Buffer.from(await response.arrayBuffer());
        const agora = new Date();
        const ano = agora.getFullYear();
        const mes = String(agora.getMonth() + 1).padStart(2, '0');
        const filePath = `nfce/${estabelecimentoId}/${ano}/${mes}/xml_${vendaId}.xml`;

        const file = bucket.file(filePath);
        await file.save(contentBuffer, {
            metadata: {
                contentType,
                metadata: {
                    vendaId,
                    estabelecimentoId,
                    tipo,
                    dataUpload: agora.toISOString()
                }
            }
        });

        logger.info(`✅ ${tipo.toUpperCase()} salvo no Storage: ${filePath}`);
        return filePath;
    } catch (error) {
        logger.error(`❌ Erro ao salvar ${tipo} no Storage:`, error);
        return null;
    }
}

// Segredos
const openAiApiKey = defineSecret("OPENAI_API_KEY");
const plugNotasApiKey = defineSecret("PLUGNOTAS_API_KEY");
const mercadoPagoToken = defineSecret("MP_ACCESS_TOKEN");
const plugNotasWebhookToken = defineSecret("PLUGNOTAS_WEBHOOK_TOKEN"); 
const mpClientSecret = defineSecret("MP_CLIENT_SECRET");
const mpClientIdSecret = defineSecret("MP_CLIENT_ID"); 
const whatsappVerifyToken = defineSecret("WHATSAPP_VERIFY_TOKEN");
const whatsappApiToken = defineSecret("WHATSAPP_API_TOKEN");
// iFood Partner API — lidos via process.env (já configurados como env vars no Cloud Run)
// Não usar defineSecret para evitar conflito com env vars normais existentes
// const meshyApiKey = defineSecret("MESHY_API_KEY"); // desativado - 3D feito manual

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

            // === AUTO-SALVAR XML NO FIREBASE STORAGE ===
            const vendaData = vendaSnap.data();
            const estabId = vendaData?.estabelecimentoId;
            if (estabId && xml) {
                const vendaIdReal = vendaRef.id;
                const xmlPath = await salvarArquivoNoStorage(estabId, vendaIdReal, xml, 'xml');
                if (xmlPath) updateData['fiscal.xmlStorage'] = xmlPath;
            }
        } else if (status === 'REJEITADO' || status === 'DENEGADO') {
            updateData['fiscal.motivoRejeicao'] = mensagem || 'Rejeitada pela Sefaz';
        }

        await vendaRef.update(updateData);
        res.status(200).json({ message: "Notificação processada com sucesso" });
    } catch (error) {
        logger.error('❌ Erro no webhook PlugNotas:', error);
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

            // === AUTO-SALVAR XML NO FIREBASE STORAGE ===
            const vendaSnap = await db.collection('vendas').doc(vendaId).get();
            const estabId = vendaSnap.data()?.estabelecimentoId;
            if (estabId && nota.xml) {
                const xmlPath = await salvarArquivoNoStorage(estabId, vendaId, nota.xml, 'xml', plugNotasApiKey.value());
                if (xmlPath) updateData['fiscal.xmlStorage'] = xmlPath;
            }
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
// 11. EXPORTAR XMLs PARA O CONTADOR (ZIP)
// ==================================================================
export const exportarXmlsContador = onCall({
    cors: true,
    timeoutSeconds: 540,
    memory: '512MiB'
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

    const { estabelecimentoId, ano, mes } = request.data;
    if (!estabelecimentoId || !ano || !mes) {
        throw new HttpsError('invalid-argument', 'estabelecimentoId, ano e mes são obrigatórios.');
    }

    const mesStr = String(mes).padStart(2, '0');
    const prefix = `nfce/${estabelecimentoId}/${ano}/${mesStr}/`;

    try {
        const [files] = await bucket.getFiles({ prefix });
        const xmlFiles = files.filter(f => f.name.endsWith('.xml'));

        if (xmlFiles.length === 0) {
            throw new HttpsError('not-found', `Nenhum XML encontrado para ${mesStr}/${ano}.`);
        }

        // Gerar ZIP em memória
        const zipBuffer = await new Promise((resolve, reject) => {
            const chunks = [];
            const archive = archiver('zip', { zlib: { level: 9 } });

            archive.on('data', chunk => chunks.push(chunk));
            archive.on('end', () => resolve(Buffer.concat(chunks)));
            archive.on('error', reject);

            const downloadPromises = xmlFiles.map(async (file) => {
                const [content] = await file.download();
                const fileName = file.name.split('/').pop();
                archive.append(content, { name: fileName });
            });

            Promise.all(downloadPromises).then(() => archive.finalize()).catch(reject);
        });

        logger.info(`✅ ZIP gerado: ${xmlFiles.length} XMLs de ${mesStr}/${ano} para estab ${estabelecimentoId}`);

        return {
            sucesso: true,
            zipBase64: zipBuffer.toString('base64'),
            nomeArquivo: `xmls_nfce_${mesStr}_${ano}.zip`,
            totalArquivos: xmlFiles.length
        };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        logger.error('❌ Erro ao exportar XMLs:', error);
        throw new HttpsError('internal', `Erro ao gerar ZIP: ${error.message}`);
    }
});

// ==================================================================
// 12. ENVIAR XMLs PARA O CONTADOR POR EMAIL
// ==================================================================
export const enviarXmlsContadorEmail = onCall({
    cors: true,
    timeoutSeconds: 540,
    memory: '512MiB'
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

    const { estabelecimentoId, ano, mes, emailContador } = request.data;
    if (!estabelecimentoId || !ano || !mes || !emailContador) {
        throw new HttpsError('invalid-argument', 'estabelecimentoId, ano, mes e emailContador são obrigatórios.');
    }

    const mesStr = String(mes).padStart(2, '0');
    const prefix = `nfce/${estabelecimentoId}/${ano}/${mesStr}/`;

    try {
        // Buscar config de email do estabelecimento
        const estabSnap = await db.collection('estabelecimentos').doc(estabelecimentoId).get();
        if (!estabSnap.exists) throw new HttpsError('not-found', 'Estabelecimento não encontrado.');
        const estab = estabSnap.data();

        const smtpConfig = estab.fiscal?.smtp || estab.smtp;
        if (!smtpConfig?.user || !smtpConfig?.pass) {
            throw new HttpsError('failed-precondition',
                'Configure as credenciais SMTP do estabelecimento em fiscal.smtp (user, pass, host, port).');
        }

        const [files] = await bucket.getFiles({ prefix });
        const xmlFiles = files.filter(f => f.name.endsWith('.xml'));

        if (xmlFiles.length === 0) {
            throw new HttpsError('not-found', `Nenhum XML encontrado para ${mesStr}/${ano}.`);
        }

        // Gerar ZIP
        const zipBuffer = await new Promise((resolve, reject) => {
            const chunks = [];
            const archive = archiver('zip', { zlib: { level: 9 } });

            archive.on('data', chunk => chunks.push(chunk));
            archive.on('end', () => resolve(Buffer.concat(chunks)));
            archive.on('error', reject);

            const downloadPromises = xmlFiles.map(async (file) => {
                const [content] = await file.download();
                const fileName = file.name.split('/').pop();
                archive.append(content, { name: fileName });
            });

            Promise.all(downloadPromises).then(() => archive.finalize()).catch(reject);
        });

        const nomeArquivo = `xmls_nfce_${mesStr}_${ano}.zip`;
        const nomeEstab = estab.nome || estab.nomeFantasia || 'Estabelecimento';

        // Enviar email
        const transporter = nodemailer.createTransport({
            host: smtpConfig.host || 'smtp.gmail.com',
            port: smtpConfig.port || 587,
            secure: smtpConfig.port === 465,
            auth: { user: smtpConfig.user, pass: smtpConfig.pass }
        });

        await transporter.sendMail({
            from: `"${nomeEstab}" <${smtpConfig.user}>`,
            to: emailContador,
            subject: `XMLs NFC-e - ${nomeEstab} - ${mesStr}/${ano}`,
            html: `
                <p>Olá,</p>
                <p>Segue em anexo o arquivo ZIP contendo <strong>${xmlFiles.length}</strong> XML(s) de NFC-e referentes ao período <strong>${mesStr}/${ano}</strong> do estabelecimento <strong>${nomeEstab}</strong>.</p>
                <p>Atenciosamente,<br>${nomeEstab}</p>
            `,
            attachments: [{ filename: nomeArquivo, content: zipBuffer }]
        });

        // Registrar envio no Firestore
        await db.collection('estabelecimentos').doc(estabelecimentoId)
            .collection('enviosContador').add({
                emailContador,
                periodo: `${mesStr}/${ano}`,
                totalXmls: xmlFiles.length,
                dataEnvio: FieldValue.serverTimestamp(),
                enviadoPor: request.auth.uid
            });

        logger.info(`✅ Email enviado para ${emailContador} com ${xmlFiles.length} XMLs de ${mesStr}/${ano}`);

        return {
            sucesso: true,
            mensagem: `${xmlFiles.length} XML(s) enviados para ${emailContador}.`,
            totalArquivos: xmlFiles.length
        };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        logger.error('❌ Erro ao enviar XMLs por email:', error);
        throw new HttpsError('internal', `Erro ao enviar email: ${error.message}`);
    }
});

// ==================================================================
// 13. GERAR PIX MERCADO PAGO
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

      if (body?.event === 'messages.upsert' || body?.data?.key) {
        isUazapi = true;
        const msgData = body.data || body.data?.[0];
        if (!msgData || msgData.key?.fromMe) return res.status(200).send('OK'); 
        from = msgData.key.remoteJid.split('@')[0];
        messageText = msgData.message?.conversation || msgData.message?.extendedTextMessage?.text || '';
        instanceId = body.instance;
      } else if (body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
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
      if (!conversas[chatKey]) conversas[chatKey] = { etapa: 'inicio', itens: [], nome: '', enderecoEntrega: '', bairro: '', taxaEntrega: 0 };
      const chat = conversas[chatKey];

      let resposta = '';
      const msgLower = messageText.toLowerCase().trim();

      // ——— REINICIAR ———
      if (['cancelar', 'sair', 'reiniciar'].includes(msgLower)) {
        delete conversas[chatKey];
        resposta = '🔄 Pedido cancelado. Digite *"oi"* para recomeçar.';

      // ——— CARDÁPIO / INÍCIO ———
      } else if (chat.etapa === 'inicio' || ['oi', 'olá', 'menu', 'cardápio', 'cardapio'].includes(msgLower)) {
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
            const preco = Number(String(p.preco).replace(',', '.')) || 0;
            cardapioTexto += `${i + 1}. ${p.nome} — R$ ${preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
          });
          cardapioTexto += '\n';
        });
        cardapioTexto += `_Digite o nome do item e quantidade. Ex: *2 X-Bacon*_\n\nDigite *"finalizar"* para concluir o pedido.`;
        resposta = cardapioTexto;
        chat.etapa = 'pedindo';
        chat.itens = [];

      // ——— ADICIONANDO ITENS ———
      } else if (chat.etapa === 'pedindo') {
        if (msgLower === 'finalizar') {
          if (chat.itens.length === 0) {
            resposta = '⚠️ Seu pedido está vazio! Adicione itens primeiro.';
          } else {
            // Buscar bairros cadastrados no Firestore
            const taxasSnap = await db.collection(`estabelecimentos/${estabId}/taxasDeEntrega`).orderBy('nomeBairro').get();
            chat.bairrosLista = taxasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            let subtotal = 0;
            let resumo = '📋 *Resumo do Pedido:*\n\n';
            chat.itens.forEach(item => {
              const sub = item.preco * item.qtd;
              subtotal += sub;
              resumo += `• ${item.qtd}x ${item.nome} — R$ ${sub.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
            });
            resumo += `\n💰 *Subtotal: R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n`;

            if (chat.bairrosLista.length > 0) {
              resumo += `🛵 *Selecione seu bairro de entrega:*\n`;
              chat.bairrosLista.forEach((b, i) => {
                const taxa = Number(b.valorTaxa) || 0;
                resumo += `*${i + 1}.* ${b.nomeBairro} — Taxa: R$ ${taxa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
              });
              resumo += `\nDigite o *número* do seu bairro:`;
              chat.etapa = 'bairro';
            } else {
              chat.bairro = '';
              chat.taxaEntrega = 0;
              resumo += `📍 *Digite seu endereço de entrega:*\n_Ex: Rua das Flores, 123_`;
              chat.etapa = 'endereco';
            }
            resposta = resumo;
          }
        } else {
          // Adicionar item ao pedido
          const match = messageText.match(/^(\d+)\s*[xX]?\s*(.+)$/) || messageText.match(/^(.+?)\s+(\d+)$/);
          let qtd = 1; let nomeProduto = messageText;
          if (match) {
            if (/^\d+$/.test(match[1])) { qtd = parseInt(match[1]); nomeProduto = match[2].trim(); }
            else { nomeProduto = match[1].trim(); qtd = parseInt(match[2]); }
          }
          const prod = produtos.find(p => p.nome.toLowerCase().includes(nomeProduto.toLowerCase()) || nomeProduto.toLowerCase().includes(p.nome.toLowerCase()));
          if (prod) {
            const preco = Number(String(prod.preco).replace(',', '.')) || 0;
            chat.itens.push({ nome: prod.nome, preco, qtd, id: prod.id });
            resposta = `✅ *${qtd}x ${prod.nome}* adicionado! (R$ ${(preco * qtd).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})\n\nContinue adicionando ou digite *"finalizar"*.`;
          } else {
            resposta = `❌ Não encontrei "${nomeProduto}" no cardápio.\nDigite *"menu"* para ver os itens.`;
          }
        }

      // ——— SELEÇÃO DE BAIRRO ———
      } else if (chat.etapa === 'bairro') {
        const idx = parseInt(msgLower) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < (chat.bairrosLista || []).length) {
          const bairroSel = chat.bairrosLista[idx];
          chat.bairro = bairroSel.nomeBairro;
          chat.taxaEntrega = Number(bairroSel.valorTaxa) || 0;
          const subtotal = chat.itens.reduce((acc, i) => acc + i.preco * i.qtd, 0);
          const totalComTaxa = subtotal + chat.taxaEntrega;
          resposta = `✅ *Bairro:* ${chat.bairro}\n🛵 *Taxa:* R$ ${chat.taxaEntrega.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n💰 *Total c/ taxa: R$ ${totalComTaxa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n📍 *Agora, informe seu endereço de entrega:*\n_Ex: Rua das Flores, 123 — Apto 4_`;
          chat.etapa = 'endereco';
        } else {
          resposta = `❌ Opção inválida. Digite o *número* do bairro:\n`;
          (chat.bairrosLista || []).forEach((b, i) => {
            resposta += `*${i + 1}.* ${b.nomeBairro} — R$ ${Number(b.valorTaxa).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
          });
        }

      // ——— ENDEREÇO ———
      } else if (chat.etapa === 'endereco') {
        if (messageText.trim().length < 5) {
          resposta = '⚠️ Informe um endereço válido.\n_Ex: Rua das Flores, 123_';
        } else {
          chat.enderecoEntrega = messageText.trim();
          chat.etapa = 'nome';
          resposta = `✅ *Endereço:* ${chat.enderecoEntrega}\n\n*Qual é o seu nome?*`;
        }

      // ——— NOME E CONFIRMAÇÃO ———
      } else if (chat.etapa === 'nome') {
        chat.nome = messageText.trim();

        let subtotal = 0;
        const itensFormatados = chat.itens.map(item => {
          subtotal += item.preco * item.qtd;
          return { nome: item.nome, quantidade: item.qtd, preco: item.preco, id: item.id };
        });
        const taxaEntrega = chat.taxaEntrega || 0;
        const totalFinal = subtotal + taxaEntrega;

        const pedidoRef = await db.collection(`estabelecimentos/${estabId}/pedidos`).add({
          itens: itensFormatados,
          cliente: { nome: chat.nome, telefone: from },
          status: 'recebido',
          subtotal,
          taxaEntrega,
          totalFinal,
          bairro: chat.bairro || '',
          enderecoEntrega: chat.enderecoEntrega || '',
          source: 'whatsapp',
          tipo: 'delivery',
          createdAt: FieldValue.serverTimestamp(),
          observacao: `Pedido via WhatsApp — ${from}`
        });

        const taxaTexto = taxaEntrega > 0 ? `\n🛵 Taxa: R$ ${taxaEntrega.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '';
        resposta = `✅ *Pedido confirmado!*\n\n🆔 #${pedidoRef.id.slice(-6).toUpperCase()}\n👤 ${chat.nome}\n📍 ${chat.enderecoEntrega}${chat.bairro ? ` — ${chat.bairro}` : ''}${taxaTexto}\n💰 *Total: R$ ${totalFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\nSeu pedido está sendo preparado! 🎉\nDigite *"oi"* para novo pedido.`;
        delete conversas[chatKey];

      } else {
        resposta = 'Olá! 👋 Digite *"oi"* ou *"menu"* para começar seu pedido!';
      }

      // ─── RESPONDER (UAZAPI OU META) ───
      if (wConfig.serverUrl && wConfig.apiKey && wConfig.instanceName) {
         const urlFormatada = wConfig.serverUrl.endsWith('/') ? wConfig.serverUrl.slice(0, -1) : wConfig.serverUrl;
         const numeroLimpo = from.replace(/\D/g, '');
         const telFinal = numeroLimpo.startsWith('55') ? numeroLimpo : `55${numeroLimpo}`;
         await fetch(`${urlFormatada}/send/text`, {
            method: 'POST',
            headers: { 'token': wConfig.apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: telFinal, text: resposta })
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

      const payloadEnvio = {
        number: telFinal,
        text: mensagem
      };

      await fetch(`${urlFormatada}/send/text`, {
        method: 'POST',
        headers: { 'token': wConfig.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadEnvio)
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

// Helper: envia texto via UAZAPI (mesmo padrão da notificarClienteWhatsApp)
async function enviarWhatsAppUAZAPI(wConfig, telefone, texto) {
  const tel = telefone.replace(/\D/g, '');
  const telFinal = tel.startsWith('55') ? tel : `55${tel}`;
  const urlBase = wConfig.serverUrl.endsWith('/') ? wConfig.serverUrl.slice(0, -1) : wConfig.serverUrl;
  const fullUrl = `${urlBase}/send/text`;

  const res = await fetch(fullUrl, {
    method: 'POST',
    headers: { 'token': wConfig.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: telFinal, text: texto })
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body, telefone: telFinal };
}

export const marketingAutomatico = onSchedule({ schedule: "every day 10:00", timeZone: "America/Sao_Paulo" }, async () => {
  logger.info('🚀 Marketing automático iniciado');

  try {
    // 1. Buscar todos os estabelecimentos
    const estabsSnap = await db.collection('estabelecimentos').get();
    
    for (const estabDoc of estabsSnap.docs) {
      const estab = estabDoc.data();
      const mktConfig = estab.marketing || {};
      const wConfig = estab.whatsapp || {};
      const nomeEstab = estab.nome || 'Restaurante';

      // Pula se marketing desativado ou WhatsApp não configurado
      if (!mktConfig.ativo) continue;
      if (!wConfig.ativo || !wConfig.instanceName || !wConfig.serverUrl || !wConfig.apiKey) {
        logger.warn(`⚠️ ${nomeEstab} (${estabDoc.id}): marketing ativo mas WhatsApp não configurado`);
        continue;
      }

      const diasInativo = mktConfig.diasInativo || 7;
      const limiteDiario = mktConfig.limiteDiario || 20;
      const mensagemBase = mktConfig.mensagem || 'Ei! Faz tempo que você não pede! 🍔 Que tal pedir hoje?';

      logger.info(`📊 Processando ${nomeEstab} (${estabDoc.id}) | diasInativo=${diasInativo} | limite=${limiteDiario}`);

      // 2. Buscar todos os pedidos para mapear clientes
      const pedidosSnap = await db.collection('estabelecimentos').doc(estabDoc.id)
        .collection('pedidos').get();

      if (pedidosSnap.empty) {
        logger.info(`📭 ${nomeEstab}: nenhum pedido encontrado`);
        continue;
      }

      // 3. Montar mapa de clientes com último pedido
      const clientesMap = new Map(); // telefone -> { nome, ultimoPedido, dataNascimento }
      const agora = new Date();
      const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

      pedidosSnap.forEach(pedidoDoc => {
        const p = pedidoDoc.data();
        const tel = p.cliente?.telefone || p.clienteTelefone || '';
        if (!tel || tel.replace(/\D/g, '').length < 10) return;

        const telLimpo = tel.replace(/\D/g, '');
        const nome = p.cliente?.nome || p.clienteNome || 'Cliente';
        
        // Data do pedido (Firestore Timestamp ou Date)
        let dataPedido = null;
        if (p.criadoEm?.toDate) dataPedido = p.criadoEm.toDate();
        else if (p.criadoEm) dataPedido = new Date(p.criadoEm);
        else if (p.data?.toDate) dataPedido = p.data.toDate();
        else if (p.data) dataPedido = new Date(p.data);

        const existente = clientesMap.get(telLimpo);
        if (!existente || (dataPedido && (!existente.ultimoPedido || dataPedido > existente.ultimoPedido))) {
          clientesMap.set(telLimpo, {
            nome,
            telefone: telLimpo,
            ultimoPedido: dataPedido,
            dataNascimento: p.cliente?.dataNascimento || existente?.dataNascimento || null
          });
        }
      });

      logger.info(`👥 ${nomeEstab}: ${clientesMap.size} clientes mapeados`);

      // 4. Filtrar clientes inativos
      const limiteData = new Date(hoje);
      limiteData.setDate(limiteData.getDate() - diasInativo);

      const clientesInativos = [];
      const aniversariantes = [];

      for (const [tel, cliente] of clientesMap) {
        // Cliente inativo = último pedido antes do limite
        if (cliente.ultimoPedido && cliente.ultimoPedido < limiteData) {
          clientesInativos.push(cliente);
        }

        // Aniversário hoje — também verifica opt-out
        if (mktConfig.aniversario && cliente.dataNascimento && !telOptouts.has(cliente.telefone)) {
          let nascimento = null;
          if (cliente.dataNascimento?.toDate) nascimento = cliente.dataNascimento.toDate();
          else if (typeof cliente.dataNascimento === 'string') nascimento = new Date(cliente.dataNascimento);
          
          if (nascimento && nascimento.getDate() === hoje.getDate() && nascimento.getMonth() === hoje.getMonth()) {
            aniversariantes.push(cliente);
          }
        }
      }

      logger.info(`📤 ${nomeEstab}: ${clientesInativos.length} inativos | ${aniversariantes.length} aniversariantes`);

        // 👇 Pré-carregar lista de optouts para não fazer query por cliente
      const optoutsSnap = await db.collection('estabelecimentos').doc(estabDoc.id)
        .collection('optout').get();
      const telOptouts = new Set(optoutsSnap.docs.map(d => d.id));

      // 5. Enviar mensagens para inativos (até o limite diário)
      let enviadosHoje = 0;

      for (const cliente of clientesInativos) {
        if (enviadosHoje >= limiteDiario) {
          logger.info(`⏸️ ${nomeEstab}: limite diário atingido (${limiteDiario})`);
          break;
        }

        // 🚫 Pular clientes que fizeram opt-out
        if (telOptouts.has(cliente.telefone)) {
          logger.info(`🚫 Opt-out: pulando ${cliente.telefone}`);
          continue;
        }

        try {
          // Personalizar mensagem com nome do cliente e do estabelecimento
          const mensagemFinal = `*${nomeEstab}*\n\nOlá, ${cliente.nome}! ${mensagemBase}`;
          
          const result = await enviarWhatsAppUAZAPI(wConfig, cliente.telefone, mensagemFinal);
          
          if (result.ok) {
            enviadosHoje++;
            logger.info(`✅ Marketing enviado para ${result.telefone} (${cliente.nome})`);
          } else {
            logger.warn(`❌ Falha marketing para ${result.telefone}: HTTP ${result.status} | ${result.body}`);
          }

          // Registrar campanha no Firestore
          await db.collection('estabelecimentos').doc(estabDoc.id)
            .collection('campanhas').add({
              tipo: 'reengajamento',
              clienteNome: cliente.nome,
              clienteTelefone: cliente.telefone,
              mensagem: mensagemFinal,
              sucesso: result.ok,
              erro: result.ok ? null : `HTTP ${result.status}`,
              enviadoEm: FieldValue.serverTimestamp(),
              diasInativo
            });

          // Delay entre envios para não sobrecarregar a API
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (err) {
          logger.error(`❌ Erro ao enviar para ${cliente.telefone}:`, err);
        }
      }

      // 6. Enviar mensagens de aniversário (não conta no limite diário)
      if (mktConfig.aniversario) {
        const descontoAniv = mktConfig.aniversarioDesconto || 15;
        const msgAnivBase = mktConfig.aniversarioMsg || '🎂 Feliz aniversário! Toma um desconto especial pra comemorar!';

        for (const cliente of aniversariantes) {
          try {
            const msgAniv = `*${nomeEstab}*\n\n${cliente.nome}, ${msgAnivBase}\n\n🎁 Use o cupom *ANIVER${descontoAniv}* e ganhe *${descontoAniv}% OFF* no seu pedido de hoje!`;

            const result = await enviarWhatsAppUAZAPI(wConfig, cliente.telefone, msgAniv);

            if (result.ok) {
              logger.info(`🎂 Aniversário enviado para ${result.telefone} (${cliente.nome})`);
            } else {
              logger.warn(`❌ Falha aniversário para ${result.telefone}: HTTP ${result.status}`);
            }

            await db.collection('estabelecimentos').doc(estabDoc.id)
              .collection('campanhas').add({
                tipo: 'aniversario',
                clienteNome: cliente.nome,
                clienteTelefone: cliente.telefone,
                mensagem: msgAniv,
                sucesso: result.ok,
                erro: result.ok ? null : `HTTP ${result.status}`,
                enviadoEm: FieldValue.serverTimestamp(),
                desconto: descontoAniv
              });

            await new Promise(resolve => setTimeout(resolve, 2000));

          } catch (err) {
            logger.error(`❌ Erro aniversário para ${cliente.telefone}:`, err);
          }
        }
      }

      logger.info(`✅ ${nomeEstab}: marketing concluído | ${enviadosHoje} reengajamentos enviados`);
    }

    logger.info('🏁 Marketing automático finalizado');

  } catch (error) {
    logger.error('❌ Erro fatal no marketing automático:', error);
  }
});

// ==================================================================
// 17. CONFIGURAR MARKETING
// ==================================================================
export const configurarMarketing = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado');

  const { estabelecimentoId, config } = request.data || {};
  if (!estabelecimentoId || !config) throw new HttpsError('invalid-argument', 'Dados incompletos');

  try {
    // Validar campos
    const configLimpa = {
      ativo: !!config.ativo,
      diasInativo: Math.max(1, Math.min(90, Number(config.diasInativo) || 7)),
      mensagem: (config.mensagem || '').substring(0, 500),
      limiteDiario: Math.max(1, Math.min(100, Number(config.limiteDiario) || 20)),
      aniversario: !!config.aniversario,
      aniversarioDesconto: Math.max(5, Math.min(50, Number(config.aniversarioDesconto) || 15)),
      aniversarioMsg: (config.aniversarioMsg || '').substring(0, 500),
      atualizadoEm: FieldValue.serverTimestamp(),
      atualizadoPor: uid
    };

    await db.collection('estabelecimentos').doc(estabelecimentoId).update({
      marketing: configLimpa
    });

    logger.info(`✅ Marketing configurado para ${estabelecimentoId} por ${uid}`);
    return { sucesso: true, config: configLimpa };

  } catch (error) {
    logger.error('❌ Erro ao configurar marketing:', error);
    throw new HttpsError('internal', error.message);
  }
});

// ==================================================================
// 17.5 CONTAR CLIENTES DO ESTABELECIMENTO
// ==================================================================
export const countEstablishmentClientsCallable = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado');

  const { estabelecimentoId } = request.data || {};
  if (!estabelecimentoId) throw new HttpsError('invalid-argument', 'estabelecimentoId obrigatório');

  try {
    // Usa select() para trazer APENAS os campos de telefone — muito mais rápido
    const pedidosSnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('pedidos')
      .select('cliente.telefone', 'clienteTelefone')
      .get();

    const telefonesUnicos = new Set();

    pedidosSnap.forEach(pedidoDoc => {
      const p = pedidoDoc.data();
      const tel = p.cliente?.telefone || p.clienteTelefone || '';
      const telLimpo = tel.replace(/\D/g, '');
      if (telLimpo.length >= 10) {
        telefonesUnicos.add(telLimpo);
      }
    });

    logger.info(`📊 Contagem de clientes para ${estabelecimentoId}: ${telefonesUnicos.size}`);
    return { uniqueClientCount: telefonesUnicos.size };

  } catch (error) {
    logger.error('❌ Erro ao contar clientes:', error);
    throw new HttpsError('internal', error.message);
  }
});

// ==================================================================
// 17.6 ENVIAR MENSAGEM EM MASSA PARA CLIENTES DO ESTABELECIMENTO
// ==================================================================
export const sendEstablishmentMessageCallable = onCall({ cors: true, timeoutSeconds: 540 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado');

  const { estabelecimentoId, message } = request.data || {};
  if (!estabelecimentoId || !message?.trim()) {
    throw new HttpsError('invalid-argument', 'estabelecimentoId e message são obrigatórios');
  }

  try {
    // 1. Buscar config do WhatsApp do estabelecimento
    const estabDoc = await db.collection('estabelecimentos').doc(estabelecimentoId).get();
    if (!estabDoc.exists) throw new HttpsError('not-found', 'Estabelecimento não encontrado');

    const estab = estabDoc.data();
    const wConfig = estab.whatsapp || {};
    const nomeEstab = estab.nome || 'Restaurante';

    if (!wConfig.ativo || !wConfig.instanceName || !wConfig.serverUrl || !wConfig.apiKey) {
      throw new HttpsError('failed-precondition', 'WhatsApp Bot não está configurado. Configure em Configurações > WhatsApp Bot.');
    }

    // 2. Buscar todos os pedidos e extrair telefones únicos com nomes
    const pedidosSnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('pedidos').get();

    const clientesMap = new Map(); // telefone -> nome
    pedidosSnap.forEach(pedidoDoc => {
      const p = pedidoDoc.data();
      const tel = p.cliente?.telefone || p.clienteTelefone || '';
      const telLimpo = tel.replace(/\D/g, '');
      if (telLimpo.length >= 10) {
        const nome = p.cliente?.nome || p.clienteNome || 'Cliente';
        if (!clientesMap.has(telLimpo)) {
          clientesMap.set(telLimpo, nome);
        }
      }
    });

    if (clientesMap.size === 0) {
      return { message: 'Nenhum cliente encontrado com telefone válido', total: 0, enviados: 0, falhas: 0 };
    }

    // 🚫 Carregar opt-outs e filtrar
    const optoutsSnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('optout').get();
    const telOptouts = new Set(optoutsSnap.docs.map(d => d.id));
    for (const tel of telOptouts) clientesMap.delete(tel);

    logger.info(`📤 Envio em massa para ${estabelecimentoId}: ${clientesMap.size} clientes (${telOptouts.size} opt-outs removidos) | por ${uid}`);

    if (clientesMap.size === 0) {
      return { message: 'Todos os clientes fizeram opt-out', total: 0, enviados: 0, falhas: 0 };
    }
    // 3. Enviar mensagem para cada cliente
    let enviados = 0;
    let falhas = 0;

    for (const [telefone, nome] of clientesMap) {
      try {
        const mensagemFinal = `*${nomeEstab}*\n\nOlá, ${nome}! ${message.trim()}`;
        const result = await enviarWhatsAppUAZAPI(wConfig, telefone, mensagemFinal);

        if (result.ok) {
          enviados++;
          logger.info(`✅ Mensagem enviada para ${result.telefone} (${nome})`);
        } else {
          falhas++;
          logger.warn(`❌ Falha para ${result.telefone}: HTTP ${result.status} | ${result.body}`);
        }

        // Registrar no Firestore
        await db.collection('estabelecimentos').doc(estabelecimentoId)
          .collection('campanhas').add({
            tipo: 'envio_massa',
            clienteNome: nome,
            clienteTelefone: telefone,
            mensagem: mensagemFinal,
            sucesso: result.ok,
            erro: result.ok ? null : `HTTP ${result.status}`,
            enviadoEm: FieldValue.serverTimestamp(),
            enviadoPor: uid
          });

        // Delay de 2s entre envios para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (err) {
        falhas++;
        logger.error(`❌ Erro ao enviar para ${telefone}:`, err);
      }
    }

    const resumo = `${enviados} mensagens enviadas com sucesso (${falhas} falhas) de ${clientesMap.size} clientes`;
    logger.info(`🏁 ${nomeEstab}: ${resumo}`);

    return {
      message: resumo,
      total: clientesMap.size,
      enviados,
      falhas
    };

  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error('❌ Erro fatal no envio em massa:', error);
    throw new HttpsError('internal', error.message);
  }
});

// ==================================================================
// 18. NOTIFICAÇÃO AUTOMÁTICA WHATSAPP (Trigger de status UAZAPI)
// ==================================================================
function formatarValor(valor) {
  if (!valor && valor !== 0) return 'R$ 0,00';
  return `R$ ${Number(valor).toFixed(2).replace('.', ',')}`;
}

const MENSAGENS_STATUS = {
  recebido: (p) => `🔥 *${p.nomeEstab}*\n*\nOlá, ${p.nome}! Seu pedido no valor de *${p.valor}* foi recebido! ✅${p.pixManual ? `\n\n🧾 *Seu pagamento foi no PIX via chave* — por favor, envie o comprovante por aqui para confirmarmos.` : `\n\nEm instantes você receberá atualizações sobre o preparo. 🍔`}`,
  preparo: (p) => `🔥 *${p.nomeEstab}*\n*\nOlá, ${p.nome}! Seu pedido no valor de *${p.valor}* já está sendo preparado! 👨‍🍳${p.pixManual ? `\n\n💳 *Pagamento via PIX* — Por favor, envie o comprovante de pagamento.` : ''}`,
  em_entrega: (p) => `🛵 *${p.nomeEstab}*\n\nÓtima notícia, ${p.nome}! Seu pedido no valor de *${p.valor}* saiu para entrega!${p.motoboy ? `\n🏍️ Entregador: *${p.motoboy}*` : ''}`,
  pronto_para_servir: (p) => `✅ *${p.nomeEstab}*\n\n${p.nome}, seu pedido no valor de *${p.valor}* está *pronto*! Pode retirar. 🎉`,
  finalizado: (p) => `✅ *${p.nomeEstab}*\n\nPedido entregue! Obrigado pela preferência, ${p.nome}! 😊\nValor: *${p.valor}*\n\nVolte sempre! 💛`
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
      const totalPedido = depois.totalFinal || depois.total || depois.valorTotal || 0;
      const formaPagamento = depois.formaPagamento || depois.pagamento || '';
      const isPixManual = formaPagamento === 'PIX_MANUAL' || formaPagamento === 'pix_manual';

      const mensagem = gerarMensagem({
        nome: nomeCliente,
        nomeEstab,
        valor: formatarValor(totalPedido),
        motoboy: depois.motoboyNome || '',
        pixManual: isPixManual
      });
      
      const tel = telefoneCliente.replace(/\D/g, '');
      const telFinal = tel.startsWith('55') ? tel : `55${tel}`;
      const urlFormatada = wConfig.serverUrl.endsWith('/') ? wConfig.serverUrl.slice(0, -1) : wConfig.serverUrl;

      // 🔥 PAYLOAD UAZAPI — endpoint /send/text com token da instância
      const payloadEnvio = {
        number: telFinal,
        text: mensagem
      };

      const fullUrl = `${urlFormatada}/send/text`;
      logger.info(`🔍 DEBUG UAZAPI | URL: ${fullUrl} | serverUrl: ${wConfig.serverUrl} | instanceName: ${wConfig.instanceName} | tokenLength: ${(wConfig.apiKey || '').length} | payload: ${JSON.stringify(payloadEnvio)}`);

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'token': wConfig.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadEnvio)
      });

      const responseBody = await response.text();
      if (response.ok) {
        logger.info(`📱 ✅ UAZAPI enviou para ${telFinal} | Status: ${depois.status} | Response: ${responseBody}`);
      } else {
        logger.warn(`⚠️ ❌ Falha UAZAPI para ${telFinal} | HTTP ${response.status} | URL: ${fullUrl} | Response: ${responseBody}`);
      }
    } catch (error) {
      logger.error('❌ Erro no trigger de notificação WhatsApp:', error);
    }
  }
);

// ==================================================================
// 🧊 GERAR MODELO 3D VIA MESHY (IMAGE-TO-3D) — DESATIVADO (3D feito manual)
// ==================================================================
// export const generateModel3D = onCall({ ... }); // desativado - sem MESHY_API_KEY

// ==================================================================
// 19. NOTIFICAÇÃO AUTOMÁTICA WHATSAPP — PEDIDO NOVO (onCreate)
// ==================================================================
export const notificarPedidoNovo = onDocumentCreated(
  { document: 'estabelecimentos/{estabId}/pedidos/{pedidoId}' },
  async (event) => {
    try {
      const pedido = event.data?.data();
      if (!pedido) return;

      // Só notifica pedidos delivery (não mesa/salão)
      if (pedido.source === 'salao' || pedido.tipo === 'mesa') return;

      const telefoneCliente = pedido.cliente?.telefone || pedido.clienteTelefone || '';
      if (!telefoneCliente) return;

      const estabSnap = await db.collection('estabelecimentos').doc(event.params.estabId).get();
      if (!estabSnap.exists) return;

      const estab = estabSnap.data();
      const wConfig = estab.whatsapp || {};

      if (!wConfig.ativo || !wConfig.instanceName || !wConfig.serverUrl) return;

      const nomeEstab = estab.nome || 'Restaurante';
      const nomeCliente = pedido.cliente?.nome || pedido.clienteNome || 'Cliente';
      const totalPedido = pedido.totalFinal || pedido.total || pedido.valorTotal || 0;
      const formaPagamento = pedido.formaPagamento || pedido.pagamento || '';
      const isPixManual = formaPagamento === 'PIX_MANUAL' || formaPagamento === 'pix_manual' || formaPagamento.toLowerCase() === 'pix';

      const gerarMensagem = MENSAGENS_STATUS['recebido'];
      const mensagem = gerarMensagem({
        nome: nomeCliente,
        nomeEstab,
        valor: formatarValor(totalPedido),
        motoboy: '',
        pixManual: isPixManual
      });

      const tel = telefoneCliente.replace(/\D/g, '');
      const telFinal = tel.startsWith('55') ? tel : `55${tel}`;
      const urlFormatada = wConfig.serverUrl.endsWith('/') ? wConfig.serverUrl.slice(0, -1) : wConfig.serverUrl;
      const fullUrl = `${urlFormatada}/send/text`;

      logger.info(`📱 Enviando notificação de NOVO PEDIDO para ${telFinal} via UAZAPI`);

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'token': wConfig.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: telFinal, text: mensagem })
      });

      const responseBody = await response.text();
      if (response.ok) {
        logger.info(`📱 ✅ Pedido novo notificado! ${telFinal} | Response: ${responseBody}`);
      } else {
        logger.warn(`⚠️ ❌ Falha ao notificar pedido novo ${telFinal} | HTTP ${response.status} | Response: ${responseBody}`);
      }
    } catch (error) {
      logger.error('❌ Erro no trigger de notificação pedido novo:', error);
    }
  }
);

// ==================================================================
// iFood PARTNER API — INTEGRAÇÃO REAL
// ==================================================================

const IFOOD_BASE_URL = 'https://merchant-api.ifood.com.br';

// ------------------------------------------------------------------
// HELPER: Obter (ou renovar) token OAuth2 do iFood por estabelecimento
// ------------------------------------------------------------------
async function getIfoodToken(estabelecimentoId) {
    const tokenRef = db.collection('estabelecimentos').doc(estabelecimentoId)
        .collection('integracoes').doc('ifood_token');
    const tokenSnap = await tokenRef.get();

    if (tokenSnap.exists) {
        const t = tokenSnap.data();
        // Usa token em cache se ainda válido (com 60s de margem)
        if (t.expiresAt && t.expiresAt.toMillis() > Date.now() + 60000) {
            return t.accessToken;
        }
        // Tenta renovar com refresh_token
        if (t.refreshToken) {
            try {
                const res = await fetch(`${IFOOD_BASE_URL}/authentication/v1.0/oauth/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        grantType: 'refresh_token',
                        clientId: process.env.IFOOD_CLIENT_ID,
                        clientSecret: process.env.IFOOD_CLIENT_SECRET,
                        refreshToken: t.refreshToken
                    }).toString()
                });
                if (res.ok) {
                    const data = await res.json();
                    const expiresAt = new Date(Date.now() + (data.expiresIn || 3600) * 1000);
                    await tokenRef.set({
                        accessToken: data.accessToken,
                        refreshToken: data.refreshToken || t.refreshToken,
                        expiresAt: FieldValue.serverTimestamp(),
                        atualizadoEm: FieldValue.serverTimestamp()
                    }, { merge: true });
                    return data.accessToken;
                }
            } catch(e) {
                logger.warn('iFood: falha ao renovar refresh_token, tentando client_credentials...', e.message);
            }
        }
    }

    // Fallback: client_credentials (acesso somente leitura/sandbox)
    const res = await fetch(`${IFOOD_BASE_URL}/authentication/v1.0/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grantType: 'client_credentials',
            clientId: process.env.IFOOD_CLIENT_ID,
            clientSecret: process.env.IFOOD_CLIENT_SECRET
        }).toString()
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`iFood auth falhou: ${res.status} - ${err}`);
    }

    const data = await res.json();
    await tokenRef.set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || null,
        expiresAt: new Date(Date.now() + (data.expiresIn || 3600) * 1000),
        atualizadoEm: FieldValue.serverTimestamp()
    }, { merge: true });

    return data.accessToken;
}

// ------------------------------------------------------------------
// HELPER: Mapear pedido iFood → modelo interno Mata Fome
// ------------------------------------------------------------------
function mapearPedidoIfood(ifoodOrder, estabelecimentoId) {
    const mapStatus = {
        'PLACED': 'recebido',
        'CONFIRMED': 'preparo',
        'READY_TO_PICKUP': 'pronto_para_servir',
        'DISPATCHED': 'em_entrega',
        'CONCLUDED': 'finalizado',
        'CANCELLED': 'cancelado'
    };

    const mapPagamento = {
        'CREDIT': 'cartao_credito',
        'DEBIT': 'cartao_debito',
        'MEAL_VOUCHER': 'voucher',
        'DIGITAL_WALLET': 'carteira_digital',
        'PIX': 'pix',
        'CASH': 'dinheiro'
    };

    const itens = (ifoodOrder.items || []).map(item => ({
        id: item.externalCode || item.id,
        nome: item.name,
        quantidade: item.quantity,
        preco: (item.unitPrice || 0) / 100,
        precoFinal: (item.totalPrice || 0) / 100,
        categoria: item.externalCode ? 'ifood' : 'outros',
        observacao: item.observations || '',
        adicionais: (item.subItems || []).map(sub => ({
            nome: sub.name,
            quantidade: sub.quantity,
            preco: (sub.unitPrice || 0) / 100
        }))
    }));

    const pagamento = ifoodOrder.payments?.methods?.[0];
    const formaPagamento = pagamento ? (mapPagamento[pagamento.method] || pagamento.method.toLowerCase()) : 'outros';

    const endereco = ifoodOrder.deliveryAddress ? {
        rua: ifoodOrder.deliveryAddress.streetName || '',
        numero: ifoodOrder.deliveryAddress.streetNumber || '',
        bairro: ifoodOrder.deliveryAddress.neighborhood || '',
        cidade: ifoodOrder.deliveryAddress.city || '',
        estado: ifoodOrder.deliveryAddress.state || '',
        cep: ifoodOrder.deliveryAddress.postalCode || '',
        complemento: ifoodOrder.deliveryAddress.complement || '',
        referencia: ifoodOrder.deliveryAddress.reference || ''
    } : null;

    return {
        vendaId: `ifood_${ifoodOrder.id}`,
        ifoodOrderId: ifoodOrder.id,
        source: 'ifood',
        tipo: ifoodOrder.orderType === 'TAKEOUT' ? 'retirada' : 'delivery',
        tipoEntrega: ifoodOrder.orderType === 'TAKEOUT' ? 'retirada' : 'delivery',
        status: mapStatus[ifoodOrder.status] || 'recebido',
        estabelecimentoId,
        cliente: {
            nome: ifoodOrder.customer?.name || 'Cliente iFood',
            telefone: ifoodOrder.customer?.phone || '',
            userId: null
        },
        endereco,
        itens,
        totalFinal: (ifoodOrder.displayTotalPrice || ifoodOrder.totalPrice || 0) / 100,
        taxaEntrega: (ifoodOrder.deliveryFee || 0) / 100,
        formaPagamento,
        metodoPagamento: formaPagamento,
        observacoes: ifoodOrder.observations || '',
        createdAt: FieldValue.serverTimestamp(),
        atualizadoEm: FieldValue.serverTimestamp(),
        dataPedido: FieldValue.serverTimestamp()
    };
}

// ==================================================================
// FUNÇÃO 1: Webhook — iFood envia pedidos em tempo real
// ==================================================================
export const ifoodWebhook = onRequest({
    cors: false
}, async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const eventos = req.body;
        logger.info('📦 iFood Webhook recebido:', JSON.stringify(eventos).slice(0, 500));

        if (!Array.isArray(eventos) || eventos.length === 0) {
            return res.status(200).send('OK');
        }

        for (const evento of eventos) {
            const { code, orderId, merchantId, fullCode } = evento;

            if (!orderId || !merchantId) continue;

            // Buscar o estabelecimentoId no Firestore pelo merchantId do iFood
            const estabSnap = await db.collection('estabelecimentos')
                .where('ifoodMerchantId', '==', merchantId)
                .limit(1).get();

            if (estabSnap.empty) {
                logger.warn(`iFood: merchantId ${merchantId} não encontrado no Firestore.`);
                continue;
            }

            const estabelecimentoId = estabSnap.docs[0].id;

            // Buscar detalhes do pedido na API
            try {
                const token = await getIfoodToken(estabelecimentoId);
                const orderRes = await fetch(`${IFOOD_BASE_URL}/order/v1.0/orders/${orderId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!orderRes.ok) {
                    logger.error(`iFood: falha ao buscar pedido ${orderId}: ${orderRes.status}`);
                    continue;
                }

                const ifoodOrder = await orderRes.json();
                const pedidoMapeado = mapearPedidoIfood(ifoodOrder, estabelecimentoId);

                // Salvar/atualizar no Firestore
                const pedidoRef = db.collection('estabelecimentos')
                    .doc(estabelecimentoId)
                    .collection('pedidos')
                    .doc(pedidoMapeado.vendaId);

                await pedidoRef.set(pedidoMapeado, { merge: true });

                // Dar ACK para o iFood (confirmar recebimento do evento)
                await fetch(`${IFOOD_BASE_URL}/order/v1.0/events/acknowledgment`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify([{ id: evento.id }])
                });

                logger.info(`✅ iFood: pedido ${orderId} salvo como ${pedidoMapeado.vendaId}`);

            } catch (e) {
                logger.error(`❌ iFood: erro ao processar evento ${orderId}:`, e.message);
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        logger.error('❌ iFood Webhook erro geral:', error);
        res.status(200).send('OK'); // Sempre 200 para o iFood não retentar em loop
    }
});

// ==================================================================
// FUNÇÃO 2: Polling — buscar pedidos pendentes periodicamente
// ==================================================================
export const ifoodPolling = onCall({
    cors: true
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

    const { estabelecimentoId } = request.data || {};
    if (!estabelecimentoId) throw new HttpsError('invalid-argument', 'estabelecimentoId obrigatório.');

    try {
        const token = await getIfoodToken(estabelecimentoId);

        // Buscar eventos pendentes (pedidos não confirmados)
        const eventsRes = await fetch(`${IFOOD_BASE_URL}/order/v1.0/events:polling`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!eventsRes.ok) {
            const err = await eventsRes.text();
            throw new HttpsError('internal', `iFood API erro: ${eventsRes.status} - ${err}`);
        }

        const eventos = await eventsRes.json();
        logger.info(`📡 iFood Polling: ${eventos?.length || 0} eventos encontrados`);

        if (!eventos || eventos.length === 0) {
            return { sucesso: true, pedidosNovos: 0, mensagem: 'Nenhum pedido novo.' };
        }

        let pedidosNovos = 0;
        const idsParaACK = [];

        for (const evento of eventos) {
            const { orderId } = evento;
            if (!orderId) continue;

            const orderRes = await fetch(`${IFOOD_BASE_URL}/order/v1.0/orders/${orderId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!orderRes.ok) continue;

            const ifoodOrder = await orderRes.json();
            const pedidoMapeado = mapearPedidoIfood(ifoodOrder, estabelecimentoId);

            const pedidoRef = db.collection('estabelecimentos')
                .doc(estabelecimentoId)
                .collection('pedidos')
                .doc(pedidoMapeado.vendaId);

            const existe = await pedidoRef.get();
            if (!existe.exists) {
                await pedidoRef.set(pedidoMapeado);
                pedidosNovos++;
            }

            if (evento.id) idsParaACK.push({ id: evento.id });
        }

        // Confirmar recebimento de todos os eventos
        if (idsParaACK.length > 0) {
            await fetch(`${IFOOD_BASE_URL}/order/v1.0/events/acknowledgment`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(idsParaACK)
            });
        }

        return {
            sucesso: true,
            pedidosNovos,
            mensagem: `${pedidosNovos} pedido(s) novos sincronizados do iFood.`
        };

    } catch (error) {
        if (error instanceof HttpsError) throw error;
        logger.error('❌ ifoodPolling erro:', error);
        throw new HttpsError('internal', `Erro no polling iFood: ${error.message}`);
    }
});

// ==================================================================
// FUNÇÃO 3: Atualizar status do pedido no iFood
// ==================================================================
export const ifoodAtualizarStatus = onCall({
    cors: true
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

    const { estabelecimentoId, ifoodOrderId, novoStatus } = request.data || {};
    if (!estabelecimentoId || !ifoodOrderId || !novoStatus) {
        throw new HttpsError('invalid-argument', 'estabelecimentoId, ifoodOrderId e novoStatus são obrigatórios.');
    }

    // Mapa de status interno → endpoint iFood
    const endpointMap = {
        'preparo':          `/order/v1.0/orders/${ifoodOrderId}/startPreparation`,
        'pronto_para_servir': `/order/v1.0/orders/${ifoodOrderId}/readyToPickup`,
        'em_entrega':       `/order/v1.0/orders/${ifoodOrderId}/dispatch`,
        'finalizado':       `/order/v1.0/orders/${ifoodOrderId}/conclude`,
        'cancelado':        `/order/v1.0/orders/${ifoodOrderId}/requestCancellation`
    };

    const endpoint = endpointMap[novoStatus];
    if (!endpoint) {
        return { sucesso: true, mensagem: 'Status não precisa ser sincronizado com o iFood.' };
    }

    try {
        const token = await getIfoodToken(estabelecimentoId);

        const res = await fetch(`${IFOOD_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) {
            const errBody = await res.text();
            logger.warn(`iFood status update falhou: ${res.status} - ${errBody}`);
            // Não lança erro — o painel interno já atualizou, iFood é best-effort
            return { sucesso: false, mensagem: `iFood retornou ${res.status}: ${errBody}` };
        }

        logger.info(`✅ iFood: pedido ${ifoodOrderId} → status "${novoStatus}" sincronizado.`);
        return { sucesso: true, mensagem: `Status "${novoStatus}" enviado ao iFood com sucesso.` };

    } catch (error) {
        logger.error('❌ ifoodAtualizarStatus erro:', error);
        throw new HttpsError('internal', `Erro ao atualizar status iFood: ${error.message}`);
    }
});

// ==================================================================
// FUNÇÃO 4: Testar autenticação OAuth2 do iFood (para a tela de config)
// ==================================================================
export const ifoodTestarConexao = onCall({
    cors: true
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

    const { estabelecimentoId } = request.data || {};
    if (!estabelecimentoId) throw new HttpsError('invalid-argument', 'estabelecimentoId obrigatório.');

    try {
        const token = await getIfoodToken(estabelecimentoId);

        // Tentar buscar merchants vinculados para confirmar que o token funciona
        const res = await fetch(`${IFOOD_BASE_URL}/merchant/v1.0/merchants`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        let merchants = [];
        if (res.ok) {
            const data = await res.json();
            merchants = Array.isArray(data) ? data : (data.merchants || []);
        }

        // Salvar merchantId no estabelecimento (se encontrado)
        if (merchants.length > 0) {
            await db.collection('estabelecimentos').doc(estabelecimentoId).update({
                ifoodMerchantId: merchants[0].id,
                ifoodMerchantName: merchants[0].name,
                ifoodConectado: true,
                ifoodTestadoEm: FieldValue.serverTimestamp()
            });
        }

        logger.info(`✅ iFood conexão testada com sucesso para ${estabelecimentoId}`);
        return {
            sucesso: true,
            merchants,
            mensagem: merchants.length > 0
                ? `Conectado! ${merchants.length} restaurante(s) encontrado(s).`
                : 'Token válido. Nenhum merchant vinculado ainda (aguardando aprovação iFood).'
        };

    } catch (error) {
        logger.error('❌ ifoodTestarConexao erro:', error);
        throw new HttpsError('internal', `Falha na conexão com iFood: ${error.message}`);
    }
});

// ==================================================================
// FUNÇÃO 5: Configurar URL do webhook no iFood
// ==================================================================
export const ifoodConfigurarWebhook = onCall({
    cors: true
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

    const { estabelecimentoId, merchantId } = request.data || {};
    if (!estabelecimentoId || !merchantId) {
        throw new HttpsError('invalid-argument', 'estabelecimentoId e merchantId são obrigatórios.');
    }

    try {
        const token = await getIfoodToken(estabelecimentoId);
        const webhookUrl = `https://us-central1-matafome-98455.cloudfunctions.net/ifoodWebhook`;

        const res = await fetch(`${IFOOD_BASE_URL}/merchant/v1.0/merchant/${merchantId}/webhook`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: webhookUrl, events: ['PLACED', 'CONFIRMED', 'READY_TO_PICKUP', 'DISPATCHED', 'CONCLUDED', 'CANCELLED'] })
        });

        if (!res.ok) {
            const errBody = await res.text();
            throw new HttpsError('internal', `iFood webhook config falhou: ${res.status} - ${errBody}`);
        }

        await db.collection('estabelecimentos').doc(estabelecimentoId).update({
            ifoodWebhookConfigurado: true,
            ifoodWebhookUrl: webhookUrl,
            ifoodWebhookConfigEm: FieldValue.serverTimestamp()
        });

        logger.info(`✅ iFood webhook configurado para ${merchantId}: ${webhookUrl}`);
        return { sucesso: true, webhookUrl, mensagem: 'Webhook configurado com sucesso no iFood!' };

    } catch (error) {
        if (error instanceof HttpsError) throw error;
        logger.error('❌ ifoodConfigurarWebhook erro:', error);
        throw new HttpsError('internal', `Erro ao configurar webhook: ${error.message}`);
    }
});

// ==================================================================
// 20. OPT-OUT DE MARKETING
// ==================================================================

/**
 * Registra opt-out de um cliente (via chamada direta ou webhook WhatsApp).
 * Salva em estabelecimentos/{estabId}/optout/{telefone}
 */
export const registrarOptout = onCall({ cors: true }, async (request) => {
  const { estabelecimentoId, telefone, motivo } = request.data || {};
  if (!estabelecimentoId || !telefone) {
    throw new HttpsError('invalid-argument', 'estabelecimentoId e telefone são obrigatórios.');
  }

  const telLimpo = String(telefone).replace(/\D/g, '');
  if (telLimpo.length < 10) throw new HttpsError('invalid-argument', 'Telefone inválido.');

  try {
    await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('optout').doc(telLimpo).set({
        telefone: telLimpo,
        motivo: motivo || 'solicitado pelo cliente',
        criadoEm: FieldValue.serverTimestamp()
      });

    logger.info(`✅ Opt-out registrado: ${telLimpo} para ${estabelecimentoId}`);
    return { sucesso: true, mensagem: 'Descadastro realizado com sucesso.' };
  } catch (error) {
    logger.error('❌ Erro ao registrar opt-out:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Remove opt-out de um cliente (admin reativa o cliente)
 */
export const removerOptout = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId, telefone } = request.data || {};
  if (!estabelecimentoId || !telefone) throw new HttpsError('invalid-argument', 'Dados incompletos.');

  const telLimpo = String(telefone).replace(/\D/g, '');
  try {
    await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('optout').doc(telLimpo).delete();
    return { sucesso: true };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Lista todos os opt-outs de um estabelecimento
 */
export const listarOptouts = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId } = request.data || {};
  if (!estabelecimentoId) throw new HttpsError('invalid-argument', 'estabelecimentoId obrigatório.');

  try {
    const snap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('optout').orderBy('criadoEm', 'desc').limit(200).get();
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { sucesso: true, lista };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Webhook HTTP para receber mensagens do WhatsApp (UAZAPI).
 * Detecta "SAIR", "PARAR", "STOP", "CANCELAR" e registra opt-out automaticamente.
 */
export const webhookWhatsAppOptout = onRequest({ cors: false }, async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const body = req.body;
    // UAZAPI envia: { phone, message: { text }, ... }
    const telefone = body?.phone || body?.from || body?.numero || '';
    const texto = String(body?.message?.text || body?.text || body?.mensagem || '').trim().toUpperCase();
    const estabId = req.query.estabId || body?.estabId || '';

    logger.info(`📨 WebhookOptout: from=${telefone} | texto="${texto}" | estabId=${estabId}`);

    const palavrasOptout = ['SAIR', 'PARAR', 'STOP', 'PARE', 'CANCELAR', 'DESCADASTRAR', 'NAO QUERO', 'NÃO QUERO', 'REMOVER'];
    const isOptout = palavrasOptout.some(p => texto === p || texto.startsWith(p + ' '));

    if (isOptout && estabId && telefone) {
      const telLimpo = String(telefone).replace(/\D/g, '');
      await db.collection('estabelecimentos').doc(estabId)
        .collection('optout').doc(telLimpo).set({
          telefone: telLimpo,
          motivo: `cliente enviou: "${body?.message?.text || texto}"`,
          criadoEm: FieldValue.serverTimestamp(),
          viaWhatsapp: true
        });

      // Responder automaticamente confirmando o descadastro
      const estabSnap = await db.collection('estabelecimentos').doc(estabId).get();
      if (estabSnap.exists()) {
        const estab = estabSnap.data();
        const wConfig = estab.whatsapp || {};
        if (wConfig.ativo && wConfig.serverUrl && wConfig.apiKey) {
          const nomeEstab = estab.nome || 'o estabelecimento';
          try {
            await enviarWhatsAppUAZAPI(wConfig, telLimpo,
              `✅ Você foi descadastrado das mensagens automáticas de *${nomeEstab}*.\n\nVocê não receberá mais nossas promoções automáticas. Obrigado!`
            );
          } catch (e) {
            logger.warn('Falha ao enviar confirmação de optout:', e.message);
          }
        }
      }

      logger.info(`✅ Opt-out automático registrado: ${telLimpo} para ${estabId}`);
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    logger.error('❌ Erro webhookWhatsAppOptout:', error);
    res.status(200).json({ ok: false }); // Sempre 200 para webhook
  }
});

// ==================================================================
// 21. CONTROLE DE ESTOQUE
// ==================================================================

/**
 * Atualiza o estoque de um produto (chamado pelo admin no painel de cardápio)
 */
export const atualizarEstoque = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId, produtoId, quantidade, controlaEstoque, estoqueMinimo } = request.data || {};
  if (!estabelecimentoId || !produtoId) {
    throw new HttpsError('invalid-argument', 'estabelecimentoId e produtoId são obrigatórios.');
  }

  try {
    const produtoRef = db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('cardapio').doc(produtoId);

    const update = { atualizadoEm: FieldValue.serverTimestamp() };

    if (controlaEstoque !== undefined) update.controlaEstoque = !!controlaEstoque;
    if (quantidade !== undefined) update.estoque = Number(quantidade);
    if (estoqueMinimo !== undefined) update.estoqueMinimo = Number(estoqueMinimo) || 0;

    await produtoRef.update(update);

    logger.info(`📦 Estoque atualizado: ${produtoId} → qty=${quantidade}`);
    return { sucesso: true };
  } catch (error) {
    logger.error('❌ Erro ao atualizar estoque:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Repõe/ajusta estoque em lote (ex: reabastecimento do dia)
 */
export const reporEstoque = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId, itens } = request.data || {};
  // itens: [{ produtoId, quantidade }]
  if (!estabelecimentoId || !Array.isArray(itens)) {
    throw new HttpsError('invalid-argument', 'Dados incompletos.');
  }

  const batch = db.batch();
  for (const item of itens) {
    if (!item.produtoId) continue;
    const ref = db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('cardapio').doc(item.produtoId);
    batch.update(ref, {
      estoque: Number(item.quantidade) || 0,
      atualizadoEm: FieldValue.serverTimestamp()
    });
  }
  await batch.commit();

  logger.info(`📦 Reposição em lote: ${itens.length} produtos para ${estabelecimentoId}`);
  return { sucesso: true, atualizados: itens.length };
});

/**
 * Busca relatório de estoque de um estabelecimento
 */
export const buscarRelatorioEstoque = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId } = request.data || {};
  if (!estabelecimentoId) throw new HttpsError('invalid-argument', 'estabelecimentoId obrigatório.');

  try {
    const snap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('cardapio')
      .where('controlaEstoque', '==', true)
      .get();

    const produtos = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        nome: data.nome || data.name || 'Sem nome',
        estoque: data.estoque ?? -1,
        estoqueMinimo: data.estoqueMinimo || 0,
        disponivel: data.disponivel !== false,
        baixoEstoque: data.estoqueMinimo > 0 && (data.estoque ?? 0) <= data.estoqueMinimo,
        esgotado: data.estoque !== undefined && data.estoque !== -1 && data.estoque <= 0,
        categoria: data.categoria || data.categoriaId || '',
        preco: data.preco || 0
      };
    });

    // Ordenar: esgotados primeiro, depois baixo estoque, depois normal
    produtos.sort((a, b) => {
      if (a.esgotado && !b.esgotado) return -1;
      if (!a.esgotado && b.esgotado) return 1;
      if (a.baixoEstoque && !b.baixoEstoque) return -1;
      if (!a.baixoEstoque && b.baixoEstoque) return 1;
      return a.nome.localeCompare(b.nome);
    });

    return { sucesso: true, produtos };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

// ==================================================================
// 22. ACERTO COM MOTOBOYS
// ==================================================================

/**
 * Gera relatório de acerto para um motoboy em um período
 */
export const gerarAcertoMotoboy = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId, motoboyId, dataInicio, dataFim } = request.data || {};
  if (!estabelecimentoId || !motoboyId || !dataInicio || !dataFim) {
    throw new HttpsError('invalid-argument', 'estabelecimentoId, motoboyId, dataInicio e dataFim são obrigatórios.');
  }

  try {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    fim.setHours(23, 59, 59, 999);

    // Buscar pedidos do motoboy no período
    const pedidosSnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('pedidos')
      .where('motoboyId', '==', motoboyId)
      .get();

    // Filtrar por período manualmente (Firestore não suporta múltiplos where em campos diferentes sem índice)
    const pedidosFiltrados = [];
    pedidosSnap.forEach(doc => {
      const p = doc.data();
      const dataEntrega = p.dataEntrega?.toDate?.() || (p.dataEntrega ? new Date(p.dataEntrega) : null);
      const dataCriadoEm = p.criadoEm?.toDate?.() || (p.criadoEm ? new Date(p.criadoEm) : null);
      const dataRef = dataEntrega || dataCriadoEm;

      if (dataRef && dataRef >= inicio && dataRef <= fim) {
        pedidosFiltrados.push({
          id: doc.id,
          ...p,
          _dataRef: dataRef
        });
      }
    });

    // Buscar dados do motoboy
    const motoboySnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('entregadores').doc(motoboyId).get();
    const motoboyData = motoboySnap.exists() ? motoboySnap.data() : {};

    // Calcular totais
    let totalEntregas = 0;
    let totalValor = 0;

    const pedidosAcerto = pedidosFiltrados.map(p => {
      const taxaEntrega = Number(p.taxaEntregaMotoboy || p.taxaEntrega || motoboyData.valorPorEntrega || 0);
      totalEntregas++;
      totalValor += taxaEntrega;
      return {
        pedidoId: p.id,
        vendaId: p.vendaId || p.id,
        clienteNome: p.cliente?.nome || p.clienteNome || 'Cliente',
        totalPedido: p.totalFinal || p.total || 0,
        taxaEntrega,
        dataEntrega: p._dataRef?.toISOString?.() || null,
        status: p.status || 'finalizado',
        formaPagamento: p.formaPagamento || '',
        enderecoEntrega: p.endereco?.rua ? `${p.endereco.rua}, ${p.endereco.numero}` : ''
      };
    });

    // Salvar o acerto no Firestore
    const acertoRef = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('acertos').add({
        motoboyId,
        motoboyNome: motoboyData.nome || 'Motoboy',
        motoboyTelefone: motoboyData.telefone || '',
        motoboyPix: motoboyData.pixKey || '',
        periodo: { inicio: inicio, fim: fim },
        periodo_str: `${inicio.toLocaleDateString('pt-BR')} a ${fim.toLocaleDateString('pt-BR')}`,
        pedidos: pedidosAcerto,
        totalEntregas,
        totalValor,
        status: 'pendente',
        pago: false,
        criadoEm: FieldValue.serverTimestamp(),
        criadoPor: uid
      });

    logger.info(`✅ Acerto gerado: ${acertoRef.id} | motoboy=${motoboyId} | entregas=${totalEntregas} | R$${totalValor}`);

    return {
      sucesso: true,
      acertoId: acertoRef.id,
      motoboyNome: motoboyData.nome || 'Motoboy',
      totalEntregas,
      totalValor,
      pedidos: pedidosAcerto
    };
  } catch (error) {
    logger.error('❌ Erro ao gerar acerto:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Marca um acerto como pago
 */
export const marcarAcertoPago = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId, acertoId } = request.data || {};
  if (!estabelecimentoId || !acertoId) throw new HttpsError('invalid-argument', 'Dados incompletos.');

  try {
    await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('acertos').doc(acertoId).update({
        pago: true,
        status: 'pago',
        pagoEm: FieldValue.serverTimestamp(),
        pagoPor: uid
      });

    logger.info(`✅ Acerto ${acertoId} marcado como pago por ${uid}`);
    return { sucesso: true };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Lista acertos de um estabelecimento (com filtro opcional por motoboy)
 */
export const listarAcertosMotoboy = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId, motoboyId } = request.data || {};
  if (!estabelecimentoId) throw new HttpsError('invalid-argument', 'estabelecimentoId obrigatório.');

  try {
    let q = db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('acertos').orderBy('criadoEm', 'desc').limit(50);

    const snap = await q.get();
    let lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (motoboyId) {
      lista = lista.filter(a => a.motoboyId === motoboyId);
    }

    return { sucesso: true, lista };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

// ==================================================================
// 23. INDICAÇÃO DE CLIENTES (REFERRAL COM CASHBACK)
// ==================================================================

/**
 * Gera ou retorna o código de indicação único de um cliente
 */
export const gerarCodigoIndicacao = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId } = request.data || {};
  if (!estabelecimentoId) throw new HttpsError('invalid-argument', 'estabelecimentoId obrigatório.');

  const uid = request.auth.uid;

  try {
    // Verificar se já tem código
    const clienteRef = db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('clientes').doc(uid);
    const clienteSnap = await clienteRef.get();

    if (clienteSnap.exists() && clienteSnap.data().codigoIndicacao) {
      return { sucesso: true, codigo: clienteSnap.data().codigoIndicacao, geradoAgora: false };
    }

    // Gerar código único de 6 chars (ex: MTF7X2)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const gerarCodigo = () => Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

    let codigo = gerarCodigo();
    let tentativas = 0;

    // Garantir que não exista outro com o mesmo código
    while (tentativas < 10) {
      const existeSnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
        .collection('codigos_indicacao').doc(codigo).get();
      if (!existeSnap.exists()) break;
      codigo = gerarCodigo();
      tentativas++;
    }

    // Registrar o código
    await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('codigos_indicacao').doc(codigo).set({
        uid,
        criadoEm: FieldValue.serverTimestamp(),
        totalIndicados: 0,
        cashbackGerado: 0
      });

    // Salvar no perfil do cliente
    await clienteRef.set({
      codigoIndicacao: codigo,
      uid,
      criadoEm: FieldValue.serverTimestamp()
    }, { merge: true });

    logger.info(`🎁 Código de indicação gerado: ${codigo} para ${uid}`);
    return { sucesso: true, codigo, geradoAgora: true };
  } catch (error) {
    logger.error('❌ Erro ao gerar código de indicação:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Valida e processa uma indicação — chamado ao criar pedido com código
 * Credita cashback ao INDICADOR (quem indicou), não a quem foi indicado
 */
export const processarIndicacao = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId, codigoIndicacao, pedidoId, valorPedido } = request.data || {};
  if (!estabelecimentoId || !codigoIndicacao) {
    throw new HttpsError('invalid-argument', 'Dados incompletos.');
  }

  const uidIndicado = request.auth.uid; // Quem está fazendo o pedido

  try {
    // 1. Buscar o código de indicação
    const codigoRef = db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('codigos_indicacao').doc(codigoIndicacao.toUpperCase());
    const codigoSnap = await codigoRef.get();

    if (!codigoSnap.exists()) {
      return { sucesso: false, mensagem: 'Código de indicação inválido.' };
    }

    const codigoData = codigoSnap.data();
    const uidIndicador = codigoData.uid;

    // Não pode usar o próprio código
    if (uidIndicador === uidIndicado) {
      return { sucesso: false, mensagem: 'Você não pode usar seu próprio código.' };
    }

    // Verificar se esse cliente já usou um código antes (primeira compra apenas)
    const clienteIndicadoRef = db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('clientes').doc(uidIndicado);
    const clienteIndicadoSnap = await clienteIndicadoRef.get();

    if (clienteIndicadoSnap.exists() && clienteIndicadoSnap.data().indicadoPor) {
      return { sucesso: false, mensagem: 'Você já usou um código de indicação anteriormente.' };
    }

    // 2. Buscar configuração de cashback por indicação do estabelecimento
    const estabSnap = await db.collection('estabelecimentos').doc(estabelecimentoId).get();
    const estab = estabSnap.data() || {};
    const configIndicacao = estab.indicacao || {};
    const tipoRecompensa = configIndicacao.tipo || 'fixo'; // 'fixo' ou 'percentual'
    const valorRecompensa = Number(configIndicacao.valor || 5); // R$5 padrão
    const percentualRecompensa = Number(configIndicacao.percentual || 5); // 5% padrão

    // Calcular cashback
    let cashbackValor = 0;
    if (tipoRecompensa === 'fixo') {
      cashbackValor = valorRecompensa;
    } else {
      cashbackValor = ((Number(valorPedido) || 0) * percentualRecompensa) / 100;
    }
    cashbackValor = Math.round(cashbackValor * 100) / 100; // 2 casas decimais

    // 3. Creditar cashback ao INDICADOR
    const clienteIndicadorRef = db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('clientes').doc(uidIndicador);

    await clienteIndicadorRef.set({
      cashbackPendente: FieldValue.increment(cashbackValor),
      cashbackTotal: FieldValue.increment(cashbackValor),
      totalIndicados: FieldValue.increment(1),
      atualizadoEm: FieldValue.serverTimestamp()
    }, { merge: true });

    // 4. Registrar que o indicado usou o código (para não usar de novo)
    await clienteIndicadoRef.set({
      indicadoPor: codigoIndicacao.toUpperCase(),
      uidIndicador,
      indicadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp()
    }, { merge: true });

    // 5. Atualizar stats do código
    await codigoRef.update({
      totalIndicados: FieldValue.increment(1),
      cashbackGerado: FieldValue.increment(cashbackValor),
      ultimaIndicacaoEm: FieldValue.serverTimestamp()
    });

    // 6. Registrar indicação no histórico
    await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('indicacoes').add({
        codigoIndicacao: codigoIndicacao.toUpperCase(),
        uidIndicador,
        uidIndicado,
        pedidoId: pedidoId || null,
        valorPedido: Number(valorPedido) || 0,
        cashbackCreditado: cashbackValor,
        tipoRecompensa,
        criadoEm: FieldValue.serverTimestamp()
      });

    // 7. Notificar indicador via WhatsApp (se configurado)
    try {
      const wConfig = estab.whatsapp || {};
      if (wConfig.ativo && wConfig.serverUrl && wConfig.apiKey) {
        const indicadorSnap = await clienteIndicadorRef.get();
        const indicadorData = indicadorSnap.data() || {};
        const telefoneIndicador = indicadorData.telefone || '';
        if (telefoneIndicador) {
          const nomeEstab = estab.nome || 'Restaurante';
          await enviarWhatsAppUAZAPI(wConfig, telefoneIndicador,
            `🎉 *${nomeEstab}*\n\nParabéns! Um amigo fez o primeiro pedido usando seu código de indicação!\n\n💰 Você ganhou *R$ ${cashbackValor.toFixed(2).replace('.', ',')}* de cashback!\n\nContinue indicando e acumule mais!`
          );
        }
      }
    } catch (e) {
      logger.warn('Falha ao notificar indicador:', e.message);
    }

    logger.info(`🎁 Indicação processada: indicador=${uidIndicador} | cashback=R$${cashbackValor}`);
    return {
      sucesso: true,
      cashbackCreditado: cashbackValor,
      mensagem: `Código válido! O indicador ganhou R$ ${cashbackValor.toFixed(2).replace('.', ',')} de cashback.`
    };
  } catch (error) {
    logger.error('❌ Erro ao processar indicação:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Configura as regras de indicação de um estabelecimento
 */
export const configurarIndicacao = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId, config } = request.data || {};
  if (!estabelecimentoId || !config) throw new HttpsError('invalid-argument', 'Dados incompletos.');

  try {
    await db.collection('estabelecimentos').doc(estabelecimentoId).update({
      indicacao: {
        ativo: !!config.ativo,
        tipo: config.tipo === 'percentual' ? 'percentual' : 'fixo',
        valor: Math.max(0, Math.min(100, Number(config.valor) || 5)),
        percentual: Math.max(0, Math.min(50, Number(config.percentual) || 5)),
        atualizadoEm: FieldValue.serverTimestamp()
      }
    });

    logger.info(`✅ Configuração de indicação atualizada para ${estabelecimentoId}`);
    return { sucesso: true };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Busca ranking de indicadores de um estabelecimento
 */
export const buscarRankingIndicadores = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId } = request.data || {};
  if (!estabelecimentoId) throw new HttpsError('invalid-argument', 'estabelecimentoId obrigatório.');

  try {
    const snap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('clientes')
      .where('totalIndicados', '>', 0)
      .orderBy('totalIndicados', 'desc')
      .limit(20)
      .get();

    const ranking = snap.docs.map((d, i) => {
      const data = d.data();
      return {
        posicao: i + 1,
        uid: d.id,
        nome: data.nome || 'Cliente',
        telefone: data.telefone || '',
        totalIndicados: data.totalIndicados || 0,
        cashbackTotal: data.cashbackTotal || 0,
        codigoIndicacao: data.codigoIndicacao || ''
      };
    });

    return { sucesso: true, ranking };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

// ==================================================================
// 🤖 BOT DE PEDIDOS VIA WHATSAPP (OpenAI + UAZAPI)
// ==================================================================

// Helper: busca cardápio formatado do Firestore
async function buscarCardapioFormatado(estabelecimentoId) {
  try {
    // Buscar categorias do cardápio
    const categoriasSnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('cardapio').get();

    if (categoriasSnap.empty) return 'Cardápio não disponível no momento.';

    let texto = '';
    let totalProdutos = 0;

    // Para cada categoria, buscar os itens na subcoleção
    for (const catDoc of categoriasSnap.docs) {
      const catData = catDoc.data();
      const catNome = catData.nome || catDoc.id;

      const itensSnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
        .collection('cardapio').doc(catDoc.id)
        .collection('itens').where('ativo', '!=', false).get();

      if (itensSnap.empty) continue;

      texto += `\n*${catNome.toUpperCase()}*\n`;
      itensSnap.docs.forEach(itemDoc => {
        const p = itemDoc.data();
        const preco = Number(p.preco || p.precoFinal || 0).toFixed(2);
        texto += `• ${p.nome} — R$ ${preco}`;
        if (p.descricao) texto += ` (${p.descricao.slice(0, 60)})`;
        texto += ` [ID:${itemDoc.id}]\n`;
        // Variações (só mostrar se tiver mais de 1 ou for diferente do preço base)
        const precoBase = Number(p.preco || p.precoFinal || 0);
        const variacoesFiltradas = (p.variacoes || []).filter(v =>
          v.nome && v.preco > 0 && (
            (p.variacoes.length > 1) || // múltiplas variações
            (Math.abs(Number(v.preco) - precoBase) > 0.01) // preço diferente
          )
        );
        variacoesFiltradas.forEach(v => {
          texto += `  - ${v.nome}: R$ ${Number(v.preco).toFixed(2)}\n`;
        });
        totalProdutos++;
      });
    }

    if (totalProdutos === 0) return 'Cardápio não disponível no momento.';
    return texto;
  } catch (e) {
    logger.error('Erro ao buscar cardápio:', e);
    return 'Cardápio indisponível.';
  }
}

// Helper: busca taxa de entrega por bairro/endereço
async function buscarTaxaEntrega(estabelecimentoId, enderecoTexto) {
  try {
    const snap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('taxasDeEntrega').get();
    if (snap.empty) return { taxa: 0, bairro: null };

    // Normalizar o endereço para busca
    const endLower = (enderecoTexto || '').toLowerCase();
    let melhor = null;

    snap.docs.forEach(doc => {
      const t = doc.data();
      const bairroLower = (t.nomeBairro || '').toLowerCase();
      if (bairroLower && endLower.includes(bairroLower)) {
        melhor = { taxa: Number(t.valorTaxa || 0), bairro: t.nomeBairro, id: doc.id };
      }
    });

    // Se não encontrou por bairro, retornar taxa padrão (menor taxa)
    if (!melhor) {
      const taxas = snap.docs.map(d => ({ taxa: Number(d.data().valorTaxa || 0), bairro: d.data().nomeBairro }));
      taxas.sort((a, b) => a.taxa - b.taxa);
      return taxas[0] || { taxa: 0, bairro: null };
    }
    return melhor;
  } catch (e) {
    return { taxa: 0, bairro: null };
  }
}

// Helper: busca nome do cliente em pedidos anteriores (tenta múltiplos formatos de fone)
async function buscarNomeCliente(estabelecimentoId, telefone) {
  try {
    const digitos = telefone.replace(/\D/g, '').replace('cus', '').replace('swhatsappnet', '');
    const sem55 = digitos.startsWith('55') ? digitos.slice(2) : digitos;
    const com55 = digitos.startsWith('55') ? digitos : `55${digitos}`;
    const formatos = [telefone, digitos, sem55, com55];

    for (const fmt of formatos) {
      try {
        const snap = await db.collection('estabelecimentos').doc(estabelecimentoId)
          .collection('pedidos')
          .where('clienteTelefone', '==', fmt)
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();
        if (!snap.empty) {
          const nome = snap.docs[0].data().clienteNome;
          if (nome && nome !== 'Cliente WhatsApp') {
            logger.info(`👤 Nome encontrado para ${fmt}: ${nome}`);
            return nome;
          }
        }
      } catch (_) { /* continua para próximo formato */ }
    }
    return null;
  } catch (e) {
    logger.warn(`buscarNomeCliente erro: ${e.message}`);
    return null;
  }
}

// Helper: salva/atualiza sessão de conversa
async function getOuCriarSessao(estabelecimentoId, telefone) {
  const ref = db.collection('estabelecimentos').doc(estabelecimentoId)
    .collection('bot_sessoes').doc(telefone);
  const snap = await ref.get();

  if (snap.exists) {
    const data = snap.data();
    // Sessão expira em 30 minutos de inatividade
    const ultimaMensagem = data.ultimaMensagem?.toDate?.() || new Date(0);
    const minutosPassados = (Date.now() - ultimaMensagem.getTime()) / 60000;
    if (minutosPassados > 30) {
      // Reseta sessão expirada
      await ref.set({ historico: [], estado: 'saudacao', criadoEm: FieldValue.serverTimestamp(), ultimaMensagem: FieldValue.serverTimestamp() });
      return { historico: [], estado: 'saudacao' };
    }
    return { historico: data.historico || [], estado: data.estado || 'saudacao', pedidoAtual: data.pedidoAtual || null };
  }

  await ref.set({ historico: [], estado: 'saudacao', criadoEm: FieldValue.serverTimestamp(), ultimaMensagem: FieldValue.serverTimestamp() });
  return { historico: [], estado: 'saudacao', pedidoAtual: null };
}

// Helper: envia mensagem WhatsApp via UAZAPI (meunumero.uazapi.com)
// Endpoint: POST /send/text | Headers: token | Body: { number, text }
async function enviarMensagemBot(wConfig, telefone, mensagem) {
  try {
    const url = `${wConfig.serverUrl}/send/text`;
    logger.info(`📤 Enviando para ${telefone} via ${url}`);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'token': wConfig.apiKey   // UAZAPI usa 'token', não 'apikey'
      },
      body: JSON.stringify({
        number: telefone,         // campo 'number' (não 'phone')
        text: mensagem            // campo 'text'
      })
    });
    const data = await res.json().catch(() => ({}));
    logger.info(`📤 Resposta UAZAPI: status=${res.status} | ${JSON.stringify(data).slice(0, 200)}`);
    return res.ok;
  } catch (e) {
    logger.error('Erro ao enviar mensagem bot:', e.message);
    return false;
  }
}

async function salvarSessao(estabelecimentoId, telefone, historico, estado, pedidoAtual = null) {
  const ref = db.collection('estabelecimentos').doc(estabelecimentoId)
    .collection('bot_sessoes').doc(telefone);
  await ref.set({
    historico: historico.slice(-20), // manter últimas 20 mensagens
    estado,
    pedidoAtual,
    ultimaMensagem: FieldValue.serverTimestamp()
  }, { merge: true });
}


async function criarPedidoBot({ estabelecimentoId, itens, clienteNome, clienteTelefone, observacoes, enderecoEntrega, taxaEntrega, bairroEntrega }) {
  let totalCalculado = 0;
  const itensProcessados = [];

  // Buscar TODOS os produtos reais (nas subcoleções itens de cada categoria)
  const categoriasSnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
    .collection('cardapio').get();

  const todosProdutos = [];
  for (const catDoc of categoriasSnap.docs) {
    const itensSnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('cardapio').doc(catDoc.id).collection('itens').get();
    itensSnap.docs.forEach(itemDoc => {
      todosProdutos.push({ id: itemDoc.id, catId: catDoc.id, ...itemDoc.data() });
    });
  }

  for (const item of itens) {
    let produtoReal = null;

    if (item.id && !['ID_DO_PRODUTO', 'id', ''].includes(item.id)) {
      produtoReal = todosProdutos.find(p => p.id === item.id);
    }
    if (!produtoReal && item.nome) {
      const nomeQuery = item.nome.toLowerCase().trim();
      produtoReal = todosProdutos.find(p =>
        p.nome && (
          p.nome.toLowerCase() === nomeQuery ||
          p.nome.toLowerCase().includes(nomeQuery) ||
          nomeQuery.includes(p.nome.toLowerCase())
        )
      );
    }
    if (!produtoReal) { logger.warn(`⚠️ Não encontrado: ${item.id}/${item.nome}`); continue; }

    let preco = Number(produtoReal.preco || produtoReal.precoFinal) || 0;
    let nomeItem = produtoReal.nome;
    if (item.observacao && produtoReal.variacoes?.length > 0) {
      const varMatch = produtoReal.variacoes.find(v =>
        v.nome && item.observacao.toLowerCase().includes(v.nome.toLowerCase())
      );
      if (varMatch && varMatch.preco > 0) { preco = Number(varMatch.preco); nomeItem = `${produtoReal.nome} (${varMatch.nome})`; }
    }
    const qtd = Number(item.quantidade) || 1;
    totalCalculado += preco * qtd;
    itensProcessados.push({ id: produtoReal.id, nome: nomeItem, preco, quantidade: qtd, observacao: item.observacao || '' });
  }

  if (itensProcessados.length === 0) return null;

  const taxaFrete = Number(taxaEntrega) || 0;
  const totalComFrete = totalCalculado + taxaFrete;

  const pedido = {
    estabelecimentoId,
    itens: itensProcessados,
    subtotal: totalCalculado,
    taxaEntrega: taxaFrete,
    totalFinal: totalComFrete,
    clienteNome: clienteNome || 'Cliente WhatsApp',
    clienteTelefone,
    // objeto `cliente` para compatibilidade com Painel e ComandaParaImpressao
    cliente: { nome: clienteNome || 'Cliente WhatsApp', telefone: clienteTelefone },
    observacoes: observacoes || '',
    enderecoEntrega: enderecoEntrega || '',
    bairro: bairroEntrega || '',           // campo principal lido pela comanda
    bairroEntrega: bairroEntrega || '',    // retrocompatibilidade
    formaPagamento: 'cobrar_na_entrega',   // exibe "COBRAR NA ENTREGA" na comanda
    status: 'pendente',
    origem: 'whatsapp_bot',
    source: 'whatsapp',
    tipo: 'delivery',
    tipoEntrega: enderecoEntrega?.trim().toUpperCase() === 'RETIRADA' ? 'retirada' : 'delivery',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  const ref = await db.collection('estabelecimentos').doc(estabelecimentoId)
    .collection('pedidos').add(pedido);

  logger.info(`🤖 Pedido criado: ${ref.id} | ${clienteTelefone} | subtotal=R$${totalCalculado} frete=R$${taxaFrete} total=R$${totalComFrete}`);
  return { pedidoId: ref.id, subtotal: totalCalculado, taxaEntrega: taxaFrete, totalFinal: totalComFrete, itens: itensProcessados };
}

// ==================================================================
// WEBHOOK PRINCIPAL DO BOT
// POST /webhookBotPedidos?estabId=XXX
// Configurar este URL no UAZAPI como webhook de mensagens recebidas
// ==================================================================
export const webhookBotPedidos = onRequest({ // v4-202603312127

  cors: true,
  secrets: [openAiApiKey]
}, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).send('');

  const estabelecimentoId = req.query.estabId;
  if (!estabelecimentoId) return res.status(400).json({ erro: 'estabId obrigatório' });

  try {
    const body = req.body;
    logger.info('🤖 Webhook recebido:', JSON.stringify(body).slice(0, 800));

    // ================================================================
    // PARSER UNIVERSAL — suporta múltiplos formatos do UAZAPI
    // ================================================================
    let telefone = '';
    let mensagemTexto = '';
    let fromMe = false;

    // Log diagnóstico: ver estrutura completa do payload
    logger.info(`🔍 body keys=${Object.keys(body).join(',')} | chat=${JSON.stringify(body.chat||{})} | messages[0]=${JSON.stringify((body.messages||[])[0]||{}).slice(0,300)}`);

    if (body.BaseUrl) {
      // Formato A — meunumero.uazapi.com
      const msgArr = body.messages || (body.message ? [body.message] : []);
      const msg = msgArr[0] || {};

      // Prioridade: remoteJid no messages[] > phone/sender/from na raiz > chat.phone
      // NAO usar chat.id — é ID interno do UAZAPI, não número WhatsApp
      telefone = msg?.key?.remoteJid
        || msg?.remoteJid
        || body?.phone
        || body?.sender
        || body?.from
        || body?.chat?.phone
        || body?.chat?.number
        || '';

      mensagemTexto = msg?.message?.conversation
        || msg?.message?.extendedTextMessage?.text
        || msg?.text || msg?.body
        || body?.text || body?.body || body?.content || '';
      fromMe = msg?.key?.fromMe ?? msg?.fromMe ?? body?.fromMe ?? false;

    } else if (body?.data?.key?.remoteJid) {
      // Formato B
      telefone      = body.data.key.remoteJid;
      mensagemTexto = body.data?.message?.conversation
        || body.data?.message?.extendedTextMessage?.text || '';
      fromMe        = body.data.key.fromMe || false;
    } else if (body?.key?.remoteJid) {
      // Formato C — legado
      telefone      = body.key.remoteJid;
      mensagemTexto = body.message?.conversation
        || body.message?.extendedTextMessage?.text || '';
      fromMe        = body.key.fromMe || false;
    }

    // Limpar telefone
    telefone = String(telefone).replace(/@[\w.]+/g, '').replace(/[^0-9]/g, '');
    logger.info(`📱 tel=${telefone} fromMe=${fromMe} msg="${String(mensagemTexto).slice(0, 80)}"`);

    // Ignorar: próprio bot, grupos, sem telefone/texto
    if (fromMe || !telefone || !mensagemTexto || telefone.length < 8) {
      return res.status(200).json({ ok: true, ignorado: true, motivo: `fromMe=${fromMe} tel='${telefone}' msg=${!!mensagemTexto}` });
    }

    mensagemTexto = String(mensagemTexto).trim();
    logger.info(`📩 Mensagem de ${telefone}: "${mensagemTexto}"`);

    // Buscar configuração do estabelecimento
    const estabSnap = await db.collection('estabelecimentos').doc(estabelecimentoId).get();
    if (!estabSnap.exists) return res.status(404).json({ erro: 'Estabelecimento não encontrado' });

    const estab = estabSnap.data();
    const wConfig = estab.whatsapp || {};
    const botConfig = estab.botPedidos || {};
    const nomeEstab = estab.nome || 'Restaurante';

    // Verificar se o bot está ativo
    if (!botConfig.ativo) return res.status(200).json({ ok: true, botDesativado: true });

    // Verificar opt-out
    const optoutSnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('optout').doc(telefone).get();
    if (optoutSnap.exists) return res.status(200).json({ ok: true, optout: true });

    if (!wConfig.instanceName || !wConfig.serverUrl || !wConfig.apiKey) {
      logger.warn(`Bot: WhatsApp não configurado para ${estabelecimentoId}`);
      return res.status(200).json({ ok: true });
    }

    // Buscar sessão, cardápio, nome do cliente e taxas em paralelo
    const [sessao, cardapioTexto, nomeClienteSalvo, taxasEntregaSnap] = await Promise.all([
      getOuCriarSessao(estabelecimentoId, telefone),
      buscarCardapioFormatado(estabelecimentoId),
      buscarNomeCliente(estabelecimentoId, telefone),
      db.collection('estabelecimentos').doc(estabelecimentoId).collection('taxasDeEntrega').get()
    ]);

    // Formatar taxas: lista interna para o prompt + lista numerada para mostrar ao cliente
    let taxasTexto = '';
    let listaBairrosCliente = '';
    if (!taxasEntregaSnap.empty) {
      const taxasOrdenadas = taxasEntregaSnap.docs
        .map(d => ({ nome: d.data().nomeBairro || '', taxa: Number(d.data().valorTaxa || 0) }))
        .filter(t => t.nome)
        .sort((a, b) => a.nome.localeCompare(b.nome));

      // Lista interna (para o GPT saber os valores)
      const taxasInternas = taxasOrdenadas
        .map(t => `  ${t.nome}: R$ ${t.taxa.toFixed(2).replace('.', ',')}`)
        .join('\n');

      // Lista formatada para ENVIAR ao cliente no WhatsApp
      listaBairrosCliente = taxasOrdenadas
        .map((t, i) => `${i + 1}. *${t.nome}* — R$ ${t.taxa.toFixed(2).replace('.', ',')}`)
        .join('\n');

      taxasTexto = `\n\nBAIRROS ATENDIDOS E TAXAS:\n${taxasInternas}\n\nQUANDO PEDIR O BAIRRO, SEMPRE ENVIE ESTE TEXTO EXATO AO CLIENTE:\n"Qual é o seu bairro? Atendemos os seguintes:\n${listaBairrosCliente}\nDigite o número ou o nome do seu bairro! 📍"`;
    } else {
      taxasTexto = '\n\nENTREGA: Sem bairros cadastrados. Combine a taxa com o cliente.';
    }

    // ================================================================
    // HANDOFF HUMANO: detecta pedido de atendente
    // ================================================================
    const PALAVRAS_HUMANO = [
      'falar com atendente', 'falar com responsavel', 'falar com o responsavel',
      'falar com humano', 'falar com pessoa', 'atendente humano',
      'quero atendente', 'chamar atendente', 'responsavel', 'gerente',
      'falar com voces', 'falar com vocês', 'atendimento humano',
      'preciso de ajuda humana', 'me passa pra atendente', 'me passa para atendente'
    ];
    const PALAVRAS_RETOMAR = ['bot', 'voltar bot', 'continuar', 'fazer pedido', 'cardapio', 'cardápio', 'menu'];

    const msgLower = mensagemTexto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Se está em atendimento humano, verifica se quer retomar o bot
    if (sessao.estado === 'atendimento_humano') {
      const querRetomar = PALAVRAS_RETOMAR.some(p => msgLower.includes(p));
      if (querRetomar) {
        await salvarSessao(estabelecimentoId, telefone, sessao.historico, 'saudacao');
        const msgRetomada = `🤖 Bot reativado! Olá${nomeClienteSalvo ? `, ${nomeClienteSalvo}` : ''}! Como posso ajudar? 😊`;
        await enviarMensagemBot(wConfig, telefone, msgRetomada);
        return res.status(200).json({ ok: true, retomouBot: true });
      }
      // Bot está pausado — não responde automaticamente
      logger.info(`🙋 ${telefone} em atendimento_humano — bot pausado`);
      return res.status(200).json({ ok: true, pause: true });
    }

    // Detecta pedido de atendente humano
    const querHumano = PALAVRAS_HUMANO.some(p => msgLower.includes(p));
    if (querHumano) {
      // Pausar o bot para este cliente
      await salvarSessao(estabelecimentoId, telefone, sessao.historico, 'atendimento_humano');

      // Avisar o cliente
      const msgCliente = `👋 Claro! Vou chamar um de nossos atendentes agora.\n\nEm instantes alguém entrará em contato com você. ⏳\n\n_Para retomar o pedido pelo bot, digite *bot*._`;
      await enviarMensagemBot(wConfig, telefone, msgCliente);

      // Notificar o dono (telefone_whatsapp do estabelecimento)
      const telefoneDono = estab.informacoes_contato?.telefone_whatsapp || estab.telefone || null;
      if (telefoneDono) {
        const telDonoNum = String(telefoneDono).replace(/\D/g, '');
        const telDonoFmt = telDonoNum.startsWith('55') ? telDonoNum : `55${telDonoNum}`;
        const nomeClienteMsg = nomeClienteSalvo || telefone;
        const msgDono = `🔔 *ATENÇÃO — ${nomeEstab}*\n\nO cliente *${nomeClienteMsg}* (${telefone}) quer falar com um atendente!\n\n📱 Clique para responder: https://wa.me/${telefone}`;
        await enviarMensagemBot(wConfig, telDonoFmt, msgDono);
        logger.info(`🔔 Notificação enviada ao dono ${telDonoFmt}`);
      } else {
        logger.warn(`⚠️ Telefone do dono não cadastrado em informacoes_contato.telefone_whatsapp`);
      }

      return res.status(200).json({ ok: true, handoff: true });
    }

    const openai = new OpenAI({ apiKey: openAiApiKey.value() });

    // System prompt do bot
    const jsonExNome = nomeClienteSalvo ? `"${nomeClienteSalvo}"` : '"Nome do cliente"';
    const jsonExample = `{"acao":"CRIAR_PEDIDO","itens":[{"id":"ID_DO_PRODUTO","nome":"Nome do produto exato do cardápio","quantidade":1,"observacao":""}],"clienteNome":${jsonExNome},"enderecoEntrega":"Endereço ou RETIRADA","observacoes":""}`;

    const regrasCliente = nomeClienteSalvo
      ? `CLIENTE FIEL: O nome dele é "${nomeClienteSalvo}". NUNCA peça o nome dele. Cumprimente-o pelo nome. No JSON do pedido use sempre clienteNome: "${nomeClienteSalvo}".`
      : `CLIENTE NOVO: Você precisa perguntar o nome completo ANTES de confirmar o pedido. Só pergunte uma vez.`;

    const systemPrompt = `Você é o atendente virtual do *${nomeEstab}* no WhatsApp. Seja simpático, direto e use emojis com moderação.

${regrasCliente}

CARDÁPIO DISPONÍVEL (use EXATAMENTE os IDs entre [ID:...] ao criar pedidos):
${cardapioTexto}
${taxasTexto}

REGRAS:
1. Apresente o cardápio organizado por categoria quando solicitado
2. ${nomeClienteSalvo ? `NÃO peça o nome — já é "${nomeClienteSalvo}". Pergunte só o endereço e bairro.` : 'Primeiro colete o pedido, depois peça: nome completo + endereço + bairro.'}
3. OBRIGATÓRIO: Sempre que pedir o bairro, envie a lista de bairros EXATAMENTE como descrita acima (com números e taxas). NÃO pergunte só "qual é seu bairro?" sem mostrar a lista.
4. Após o cliente escolher o bairro (pelo número ou nome), confirme: "Bairro X — taxa R$ Y." e mostre o resumo: subtotal + frete + total
5. Quando o cliente CONFIRMAR, retorne APENAS (JSON puro, sem markdown, uma linha):
PEDIDO_JSON:${jsonExample}:FIM_JSON
6. Se quiser cancelar: CANCELAR_PEDIDO
7. Nunca invente produtos fora do cardápio
8. Valores exatamente como no cardápio
9. Se o bairro não está na lista, avise e mostre a lista novamente
10. No JSON, coloque em "bairro" o nome EXATO do bairro escolhido e em "enderecoEntrega" apenas rua e número
11. Se o cliente quiser falar com atendente/responsável/humano, responda APENAS: "Claro, vou chamar um atendente! 🙋" — nunca tente resolver a questão sozinho`;

    // Montar histórico para GPT
    const messages = [
      { role: 'system', content: systemPrompt },
      ...sessao.historico,
      { role: 'user', content: mensagemTexto }
    ];

    // Chamar GPT
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.3,
      max_tokens: 800
    });

    const respostaGPT = completion.choices[0].message.content;
    logger.info(`🤖 Resposta GPT para ${telefone}: ${respostaGPT.slice(0, 300)}`);

    // Parser: detecta PEDIDO_JSON:...:FIM_JSON ou CANCELAR_PEDIDO
    const jsonMatch = respostaGPT.match(/PEDIDO_JSON:([\s\S]*?):FIM_JSON/);
    const isCancelar = respostaGPT.includes('CANCELAR_PEDIDO');
    let respostaFinal = respostaGPT.replace(/PEDIDO_JSON:[\s\S]*?:FIM_JSON/g, '').replace('CANCELAR_PEDIDO', '').trim();
    let novoEstado = 'conversando';
    let pedidoCriado = null;

    if (isCancelar) {
      novoEstado = 'saudacao';
      respostaFinal = '🙆 Tudo bem! Pedido cancelado. Se quiser fazer um novo pedido é só chamar! 😊';
    } else if (jsonMatch) {
      try {
        const dadosPedido = JSON.parse(jsonMatch[1].trim());

        if (dadosPedido.acao === 'CRIAR_PEDIDO' && dadosPedido.itens?.length > 0) {
          // Buscar taxa de entrega pelo endereço informado
          const enderecoInfo = dadosPedido.enderecoEntrega || '';
          const isRetirada = enderecoInfo.trim().toUpperCase() === 'RETIRADA';
          let taxaInfo = { taxa: 0, bairro: null };
          if (!isRetirada && enderecoInfo) {
            taxaInfo = await buscarTaxaEntrega(estabelecimentoId, enderecoInfo);
          }

          // Criar pedido no Firestore
          pedidoCriado = await criarPedidoBot({
            estabelecimentoId,
            itens: dadosPedido.itens,
            clienteNome: dadosPedido.clienteNome || nomeClienteSalvo || 'Cliente WhatsApp',
            clienteTelefone: telefone,
            observacoes: dadosPedido.observacoes,
            enderecoEntrega: enderecoInfo,
            taxaEntrega: taxaInfo.taxa,
            bairroEntrega: taxaInfo.bairro || ''
          });

          if (pedidoCriado) {
            novoEstado = 'pedido_realizado';
            const resumoItens = pedidoCriado.itens.map(i => `• ${i.quantidade}x ${i.nome}`).join('\n');
            respostaFinal = `✅ *Pedido registrado com sucesso!* 🎉\n\n*Resumo do seu pedido:*\n${resumoItens}\n\n💰 *Total: R$ ${pedidoCriado.totalFinal.toFixed(2).replace('.', ',')}*\n\n⏱️ Em breve você receberá atualizações do status. Obrigado, ${dadosPedido.clienteNome}! 🍔`;
          } else {
            respostaFinal = '❌ Ops! Não consegui processar seu pedido. Algum item pode estar indisponível. Pode repetir?';
          }
        }
      } catch (parseErr) {
        logger.warn('Erro ao parsear JSON do GPT:', parseErr);
        // Resposta normal sem JSON
        respostaFinal = respostaGPT.replace(/```json[\s\S]*?```/g, '').trim();
      }
    }

    // Enviar resposta ao cliente
    await enviarMensagemBot(wConfig, telefone, respostaFinal);

    // Atualizar histórico da sessão
    const novoHistorico = [
      ...sessao.historico,
      { role: 'user', content: mensagemTexto },
      { role: 'assistant', content: respostaGPT }
    ];
    await salvarSessao(estabelecimentoId, telefone, novoHistorico, novoEstado, pedidoCriado);

    // Registrar conversa no Firestore para auditoria
    await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('bot_conversas').add({
        telefone,
        mensagemCliente: mensagemTexto,
        respostaBot: respostaFinal,
        pedidoCriado: !!pedidoCriado,
        pedidoId: pedidoCriado?.pedidoId || null,
        timestamp: FieldValue.serverTimestamp()
      });

    return res.status(200).json({ ok: true, respondido: true, pedidoCriado: !!pedidoCriado });

  } catch (error) {
    logger.error('❌ Erro no webhookBotPedidos:', error);
    return res.status(500).json({ erro: error.message });
  }
});

// ==================================================================
// CONFIGURAR/ATIVAR O BOT DE PEDIDOS (Admin)
// ==================================================================
export const configurarBotPedidos = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId, ativo, mensagemBoasVindas, horarioAtendimento } = request.data;
  if (!estabelecimentoId) throw new HttpsError('invalid-argument', 'estabelecimentoId obrigatório.');

  try {
    await db.collection('estabelecimentos').doc(estabelecimentoId).update({
      botPedidos: {
        ativo: ativo !== false,
        mensagemBoasVindas: mensagemBoasVindas || `Olá! 👋 Bem-vindo ao nosso cardápio digital via WhatsApp!\nDigite *CARDÁPIO* para ver nossos produtos ou já me diga o que deseja pedir! 😊`,
        horarioAtendimento: horarioAtendimento || null,
        configuradoEm: FieldValue.serverTimestamp()
      }
    });

    return { sucesso: true, mensagem: ativo ? 'Bot ativado com sucesso!' : 'Bot desativado.' };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

// ==================================================================
// BUSCAR CONVERSAS DO BOT (Admin)
// ==================================================================
export const buscarConversasBot = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId, limite = 50 } = request.data;
  if (!estabelecimentoId) throw new HttpsError('invalid-argument', 'estabelecimentoId obrigatório.');

  try {
    const snap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('bot_conversas')
      .orderBy('timestamp', 'desc')
      .limit(limite)
      .get();

    const conversas = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      timestamp: d.data().timestamp?.toDate?.()?.toISOString() || null
    }));

    // Sessões ativas (últimos 30 min)
    const sessoesSnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('bot_sessoes')
      .where('ultimaMensagem', '>=', new Date(Date.now() - 30 * 60 * 1000))
      .get();

    return {
      sucesso: true,
      conversas,
      sessoesAtivas: sessoesSnap.size
    };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

