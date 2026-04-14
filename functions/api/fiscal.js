import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import archiver from 'archiver';
import nodemailer from 'nodemailer';
import { db, bucket } from '../firebaseCore.js';

const plugNotasApiKey = defineSecret('PLUGNOTAS_API_KEY');
const plugNotasWebhookToken = defineSecret('PLUGNOTAS_WEBHOOK_TOKEN');

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

        // Filtra itens cancelados ou removidos da comanda para não irem na NFCe
        const itensValidos = venda.itens.filter(i => i.status !== 'cancelado' && i.status !== 'removido' && !i.excluido);

        if (itensValidos.length === 0) {
            throw new HttpsError('failed-precondition', 'Nenhum item válido para emitir nota.');
        }

        const itensNfce = itensValidos.map((item, index) => {
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

