import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { BrasilNFe } from "brasilnfe";
import { db } from "../firebaseCore.js";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAdminAccess } from "../authUtils.js";

const brasilNfeApiKey = defineSecret('BRASILNFE_API_KEY');

export const emitirNfeBrasilNfe = onCall({
    cors: true,
    secrets: [brasilNfeApiKey],
    timeoutSeconds: 120
}, async (request) => {
    const { estabelecimentoId, vendaId, destinatario, frete } = request.data;
    const uid = request.auth?.uid;

    if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');
    if (!estabelecimentoId) throw new HttpsError('invalid-argument', 'ID do estabelecimento obrigatório.');
    if (!vendaId) throw new HttpsError('invalid-argument', 'ID da venda obrigatório.');
    if (!destinatario || !destinatario.cpfCnpj) throw new HttpsError('invalid-argument', 'Destinatário (com CPF/CNPJ) obrigatório para NF-e.');

    try {
        await verifyAdminAccess(request, estabelecimentoId);

        const vendaRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('pedidos').doc(vendaId);
        const vendaSnap = await vendaRef.get();
        if (!vendaSnap.exists) throw new HttpsError('not-found', 'Venda não encontrada.');
        const venda = vendaSnap.data();

        const estabRef = db.collection('estabelecimentos').doc(estabelecimentoId);
        const estabSnap = await estabRef.get();
        if (!estabSnap.exists) throw new HttpsError('failed-precondition', 'Estabelecimento não encontrado.');
        const estabData = estabSnap.data();
        const configFiscal = estabData.fiscal || estabData; // Fallback to estabData if flat

        const ie = configFiscal.ie || configFiscal.inscricaoEstadual;
        if (!configFiscal.cnpj || !ie) {
            console.warn(`CNPJ ou IE ausentes. EstabId: ${estabelecimentoId}`);
            console.warn(`configFiscal keys: ${Object.keys(configFiscal)}`);
            console.warn(`configFiscal.cnpj: ${configFiscal.cnpj}`);
            console.warn(`configFiscal.ie: ${configFiscal.ie}`);
            throw new HttpsError('failed-precondition', 'CNPJ ou IE do emitente não configurados.');
        }

        let somaDosItens = 0;
        const listaItens = venda.itens || venda.carrinho || [];
        const itensNfe = listaItens.map((item, index) => {
            const precoUnit = Number(item.precoAtual || item.preco || 0);
            let totalItem = precoUnit * Number(item.quantidade || 1);
            somaDosItens += totalItem;

            let cfopReal = item.cfop || configFiscal.padraoCfop || "5102";

            return {
                numero_item: index + 1,
                codigo: String(item.id).substring(0, 30),
                descricao: String(item.nome || 'Produto sem nome').substring(0, 120),
                ncm: String(item.ncm || configFiscal.padraoNcm || "21069090").replace(/\D/g, '').substring(0, 8),
                cfop: String(cfopReal).replace(/\D/g, '').substring(0, 4),
                unidade: String(item.unidade || "UN").toUpperCase(),
                quantidade: Number(item.quantidade || 1),
                valor_unitario: precoUnit,
                valor_total: totalItem,
                icms_origem: "0",
                icms_cst: configFiscal.regimeTributario === '3' ? "00" : "102"
            };
        });

        somaDosItens = Number(somaDosItens.toFixed(2));
        const valorFrete = Number(frete?.valor || 0);
        const valorTotalNota = Number((somaDosItens + valorFrete).toFixed(2));

        let meioPagamento = "01"; // Dinheiro default
        const metodoLower = String(venda.metodoPagamento || venda.formaPagamento || "").toLowerCase().trim();
        if (metodoLower.includes('pix')) meioPagamento = "17";
        else if (metodoLower.includes('crédito') || metodoLower.includes('credit')) meioPagamento = "03";
        else if (metodoLower.includes('débito') || metodoLower.includes('debit')) meioPagamento = "04";

        const payload = {
            TipoAmbiente: Number(configFiscal.ambiente === "1" ? "1" : "2"),
            ModeloDocumento: 55,
            NaturezaOperacao: "Venda de mercadoria",
            Cliente: {
                CpfCnpj: String(destinatario.cpfCnpj).replace(/\D/g, '').substring(0, 14),
                NmCliente: destinatario.razaoSocial || destinatario.nome || 'Consumidor Final',
                Endereco: destinatario.endereco?.logradouro || 'N/A',
                Numero: destinatario.endereco?.numero || 'S/N',
                Bairro: destinatario.endereco?.bairro || 'N/A',
                Cidade: destinatario.endereco?.cidade || 'Rio de Janeiro',
                UF: destinatario.endereco?.uf || 'RJ',
                CEP: String(destinatario.endereco?.cep || '').replace(/\D/g, '')
            },
            Produtos: itensNfe.map(item => ({
                NmProduto: item.descricao,
                NCM: item.ncm,
                CFOP: Number(item.cfop),
                Quantidade: item.quantidade,
                ValorUnitario: item.valor_unitario
            })),
            Pagamentos: [
                {
                    TipoPagamento: 1, // 1 = Dinheiro (default). 3 = Credito, 4 = Debito, 17 = PIX
                    ValorPagamento: valorTotalNota
                }
            ],
            ValorFrete: valorFrete,
            ValorTotal: valorTotalNota
        };

        if (metodoLower.includes('pix')) payload.Pagamentos[0].TipoPagamento = 17;
        else if (metodoLower.includes('crédito') || metodoLower.includes('credit')) payload.Pagamentos[0].TipoPagamento = 3;
        else if (metodoLower.includes('débito') || metodoLower.includes('debit')) payload.Pagamentos[0].TipoPagamento = 4;

        const response = await fetch("https://api.brasilnfe.com.br/services/Fiscal/EnviarNotaFiscal", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Token": brasilNfeApiKey.value()
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        let result;
        try { 
            result = JSON.parse(responseText); 
        } catch (e) { 
            console.error('Brasil NFE retornou algo que não é JSON:', responseText);
            throw new HttpsError('internal', `Erro Brasil NFE (Não é JSON). Resposta: ${responseText.substring(0, 200)}`); 
        }

        if (!response.ok) {
            console.error('Brasil NFE erro:', result);
            throw new HttpsError('internal', `Falha Brasil NFE: ${result.Mensagem || JSON.stringify(result)}`);
        }

        console.log('Brasil NFE sucesso emissão:', result);
        const returnNF = result.ReturnNF || {};
        const chaveAcesso = returnNF.ChaveNF || result.ChaveAcesso || result.chaveAcesso || result.Id || result.id;
        
        if (!chaveAcesso) {
            throw new HttpsError('internal', `BrasilNFE não devolveu ID/Chave. Dump: ${JSON.stringify(result)}`);
        }

        const statusSefaz = returnNF.DsStatusRespostaSefaz || result.Status || result.status || 'PROCESSANDO';
        const protocolo = returnNF.Protocolo || result.Protocolo || result.protocolo || '';

        let fiscalStatus = 'PROCESSANDO_NFE';
        const statusSefazUpper = String(statusSefaz).toUpperCase();
        if (statusSefazUpper.includes('AUTORIZADO')) {
            fiscalStatus = 'EMITIDA';
        } else if (statusSefazUpper.includes('REJEIÇÃO') || statusSefazUpper.includes('REJEITAD') || statusSefazUpper.includes('FALHA') || statusSefazUpper.includes('ERRO')) {
            fiscalStatus = 'ERRO';
        }

        await vendaRef.update({
            'fiscal.status': fiscalStatus,
            'fiscal.chaveAcesso': chaveAcesso,
            'fiscal.idBrasilNfe': chaveAcesso,
            'fiscal.protocolo': protocolo,
            'fiscal.statusSefaz': statusSefaz,
            'fiscal.dataEnvio': FieldValue.serverTimestamp(),
            'fiscal.ambiente': configFiscal.ambiente === "1" ? "PRODUCAO" : "HOMOLOGACAO",
            'fiscal.modelo': '55'
        });

        // Se a API já devolveu o DANFE e o XML em Base64, podemos até salvar em algum lugar (Storage) 
        // ou avisar a venda, mas por enquanto retornamos pro client.

        return { 
            sucesso: true, 
            mensagem: 'NF-e enviada com sucesso.', 
            chaveAcesso: chaveAcesso,
            statusSefaz: statusSefaz,
            danfe: result.Base64Danfe ? true : false,
            uuid: chaveAcesso 
        };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', `Erro interno: ${error.message}`);
    }
});

export const baixarXmlBrasilNfe = onCall({ cors: true, secrets: [brasilNfeApiKey] }, async (request) => {
    const { uuid } = request.data;
    if (!uuid) throw new HttpsError('invalid-argument', 'UUID obrigatório.');

    try {
        const client = new BrasilNFe(brasilNfeApiKey.value());
        const xmlBuffer = await client.arquivos.obterArquivoNotaFiscal({
            ChaveNF: uuid,
            FileType: 1 // XML
        });
        return { xml: xmlBuffer.toString('utf-8') };
    } catch (error) {
        throw new HttpsError('internal', `Erro ao baixar XML: ${error.message}`);
    }
});

export const baixarPdfBrasilNfe = onCall({ cors: true, secrets: [brasilNfeApiKey] }, async (request) => {
    const { uuid } = request.data;
    if (!uuid) throw new HttpsError('invalid-argument', 'UUID obrigatório.');

    try {
        const client = new BrasilNFe(brasilNfeApiKey.value());
        const pdfBuffer = await client.arquivos.obterArquivoNotaFiscal({
            ChaveNF: uuid,
            FileType: 2 // PDF/DANFE
        });
        
        return { base64: pdfBuffer.toString('base64') };
    } catch (error) {
        throw new HttpsError('internal', `Erro ao baixar DANFE: ${error.message}`);
    }
});

export const sincronizarStatusBrasilNfe = onCall({ cors: true, secrets: [brasilNfeApiKey] }, async (request) => {
    const { estabelecimentoId, pedidoId, chaveAcesso } = request.data;
    if (!estabelecimentoId || !pedidoId || !chaveAcesso) {
        throw new HttpsError('invalid-argument', 'Faltam parâmetros.');
    }

    // Se a chave for AGUARDANDO, significa que a emissão falhou em pegar o ID original, não há o que sincronizar na Sefaz.
    if (chaveAcesso === 'AGUARDANDO') {
        await db.doc(`estabelecimentos/${estabelecimentoId}/pedidos/${pedidoId}`).update({
            'fiscal.status': 'ERRO'
        });
        return { success: false, pending: false, message: 'Falha de Emissão: Não foi possível obter o ID da nota. Reemita.' };
    }

    try {
        const client = new BrasilNFe(brasilNfeApiKey.value());
        
        // Tenta baixar o XML (mais leve que o PDF) para ver se já gerou
        const xmlBuffer = await client.arquivos.obterArquivoNotaFiscal({
            ChaveNF: chaveAcesso,
            FileType: 1 // XML
        });
        
        // A API as vezes retorna um JSON ou string de erro sem quebrar o HTTP (ex: "Arquivo não encontrado" ou "Chave inválida")
        if (xmlBuffer.length < 100) {
            const msgError = xmlBuffer.toString().toLowerCase();
            if (msgError.includes('não encontrado') || msgError.includes('inválid') || msgError.includes('erro') || msgError.includes('error')) {
                throw new Error(xmlBuffer.toString()); 
            }
            return { success: false, pending: true, message: 'A SEFAZ ainda está processando a nota.' };
        }
        
        const vendaRef = db.doc(`estabelecimentos/${estabelecimentoId}/pedidos/${pedidoId}`);
        await vendaRef.update({
            'fiscal.status': 'EMITIDA',
            'fiscal.statusSefaz': 'Autorizado o uso da NF-e / NFC-e'
        });
        
        return { success: true, message: 'Nota fiscal sincronizada e emitida com sucesso!' };
    } catch (error) {
        // Se der erro de "Arquivo não encontrado", significa que ainda está processando OU foi rejeitada
        if (error.message.includes('não encontrado')) {
            const vendaSnap = await db.doc(`estabelecimentos/${estabelecimentoId}/pedidos/${pedidoId}`).get();
            if (vendaSnap.exists) {
                const venda = vendaSnap.data();
                const statusSefaz = venda.fiscal?.statusSefaz || '';
                const statusSefazUpper = String(statusSefaz).toUpperCase();
                
                if (statusSefazUpper.includes('REJEIÇÃO') || statusSefazUpper.includes('REJEITAD') || statusSefazUpper.includes('ERRO') || statusSefazUpper.includes('FALHA')) {
                    await db.doc(`estabelecimentos/${estabelecimentoId}/pedidos/${pedidoId}`).update({
                        'fiscal.status': 'ERRO'
                    });
                    return { success: false, pending: false, message: statusSefaz };
                }
                
                // Fallback: se passou mais de 2 minutos e a nota ainda não gerou XML, ou se não tem data, 99% de chance de erro
                let dataEnvio = null;
                const fieldData = venda.fiscal?.dataEnvio || venda.createdAt;
                if (fieldData) {
                    if (typeof fieldData.toDate === 'function') dataEnvio = fieldData.toDate();
                    else if (fieldData._seconds) dataEnvio = new Date(fieldData._seconds * 1000);
                    else if (fieldData.seconds) dataEnvio = new Date(fieldData.seconds * 1000);
                    else dataEnvio = new Date(fieldData);
                }

                // Se a dataEnvio não existir, for inválida (NaN), ou for mais antiga que 2 minutos (ou negativa por erro de fuso), forçamos o erro
                const isInvalidDate = !dataEnvio || isNaN(dataEnvio.getTime());
                const tempoPassado = isInvalidDate ? 0 : (new Date() - dataEnvio);
                const isOlderThan2Mins = !isInvalidDate && (tempoPassado > 2 * 60 * 1000 || tempoPassado < 0);
                const isAguardando = chaveAcesso === 'AGUARDANDO';

                if (isInvalidDate || isOlderThan2Mins || isAguardando) {
                    await db.doc(`estabelecimentos/${estabelecimentoId}/pedidos/${pedidoId}`).update({
                        'fiscal.status': 'ERRO'
                    });
                    return { success: false, pending: false, message: `Falha de Emissão: Rejeição ou Falha (API)` };
                }
            }
            return { success: false, pending: true, message: 'A SEFAZ ainda está processando a nota.' };
        }
        console.error("Erro na sincronização:", error);
        throw new HttpsError('internal', `Erro ao sincronizar: ${error.message}`);
    }
});
