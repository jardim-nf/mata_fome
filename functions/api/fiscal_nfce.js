import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { BrasilNFe } from "brasilnfe";
import { db } from "../firebaseCore.js";
import { FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

const brasilNfeApiKey = defineSecret('BRASILNFE_API_KEY');

export const emitirNfceBrasilNfe = onCall({
    cors: true,
    secrets: [brasilNfeApiKey],
    timeoutSeconds: 120
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

    const { vendaId, cpf } = request.data;
    if (!vendaId) {
        logger.warn('Falha: ID da venda obrigatório.', { data: request.data });
        throw new HttpsError('invalid-argument', 'ID da venda obrigatório.');
    }

    try {
        const vendaRef = db.collection('vendas').doc(vendaId);
        const vendaSnap = await vendaRef.get();
        if (!vendaSnap.exists) {
            logger.warn(`Falha: Venda não encontrada (${vendaId}).`);
            throw new HttpsError('not-found', 'Venda não encontrada.');
        }
        const venda = vendaSnap.data();

        const isClient = request.auth.uid === venda.userId;

        if (!isClient) {
            const { verifyAdminAccess } = await import('../authUtils.js');
            try {
                await verifyAdminAccess(request, venda.estabelecimentoId);
            } catch (e) {
                logger.warn(`Falha: Acesso negado. UID: ${request.auth.uid}, VendaId: ${vendaId}, VendaEstab: ${venda.estabelecimentoId}`);
                throw new HttpsError('permission-denied', 'Acesso negado a esta venda.');
            }
        }

        const estabelecimentoRef = db.collection('estabelecimentos').doc(venda.estabelecimentoId);
        const estabelecimentoSnap = await estabelecimentoRef.get();
        const estabelecimento = estabelecimentoSnap.data();

        const ie = estabelecimento?.fiscal?.ie || estabelecimento?.fiscal?.inscricaoEstadual;
        if (!estabelecimento?.fiscal?.cnpj || !ie) {
            logger.warn(`Falha: Estabelecimento sem configuração fiscal completa (ID: ${venda.estabelecimentoId})`);
            throw new HttpsError('failed-precondition', 'Estabelecimento sem configuração fiscal (CNPJ/IE).');
        }

        const configFiscal = estabelecimento.fiscal;
        let somaDosItens = 0;

        // Filtra itens cancelados ou removidos da comanda para não irem na NFCe
        const itensValidos = venda.itens?.filter(i => i.status !== 'cancelado' && i.status !== 'removido' && !i.excluido) || [];

        if (itensValidos.length === 0) {
            logger.warn(`Fallback ativado: Venda ${vendaId} sem itens. Injetando item genérico de consumo.`);
            itensValidos.push({
                id: '999999',
                nome: 'Consumo Diversos',
                preco: venda.total > 0 ? venda.total : 0.01,
                quantidade: 1,
                precoFinal: venda.total > 0 ? venda.total : 0.01,
                fiscal: {
                    ncm: configFiscal.padraoNcm || "21069090",
                    cfop: configFiscal.padraoCfop || "5102"
                }
            });
        }

        const itensNfce = itensValidos.map((item, index) => {
            const ncmReal = item.fiscal?.ncm || configFiscal.padraoNcm || "21069090"; 
            const cfopReal = item.fiscal?.cfop || configFiscal.padraoCfop || "5102";
            
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
                numero_item: index + 1,
                codigo: String(item.id || item.uid || `00${index + 1}`).substring(0, 30),
                descricao: String(nomeBase).substring(0, 120),
                ncm: String(ncmReal).replace(/\D/g, ''),
                cfop: String(cfopReal).replace(/\D/g, ''),
                unidade: String(item.unidade || "UN").toUpperCase(),
                quantidade: quantidadeInformada,
                valor_unitario: valorUnitarioCalculado,
                valor_total: valorTotalItem,
                icms_origem: "0",
                icms_cst: configFiscal.regimeTributario === '3' ? "00" : "102"
            };
        });

        somaDosItens = Number(somaDosItens.toFixed(2));

        let pagamentosNfce = [];

        if (venda.pagamentos && typeof venda.pagamentos === 'object' && Object.keys(venda.pagamentos).length > 0) {
            const keys = Object.keys(venda.pagamentos);
            let somaPagamentosRaw = 0;
            for (const key of keys) {
                somaPagamentosRaw += Number(venda.pagamentos[key].valor) || 0;
            }

            let somaProcessada = 0;
            let indexGeral = 0;
            const validKeys = keys.filter(k => (Number(venda.pagamentos[k].valor) || 0) > 0);

            for (const key of validKeys) {
                const pag = venda.pagamentos[key];
                const valorBruto = Number(pag.valor) || 0;

                let valorCalculado = Number(((valorBruto / somaPagamentosRaw) * somaDosItens).toFixed(2));
                if (indexGeral === validKeys.length - 1) {
                    valorCalculado = Number((somaDosItens - somaProcessada).toFixed(2));
                }
                
                somaProcessada += valorCalculado;
                indexGeral++;

                const metodoLower = String(pag.formaPagamento || pag.metodo || "").toLowerCase().trim();
                let meio_pagamento = "01";
                if (metodoLower.includes('pix')) meio_pagamento = "17";
                else if (metodoLower.includes('crédito') || metodoLower.includes('credito') || metodoLower.includes('credit')) meio_pagamento = "03";
                else if (metodoLower.includes('débito') || metodoLower.includes('debito') || metodoLower.includes('debit')) meio_pagamento = "04";
                else if (metodoLower.includes('cartao') || metodoLower.includes('cartão') || metodoLower.includes('card')) meio_pagamento = "03";

                pagamentosNfce.push({ meio_pagamento, valor: valorCalculado });
            }
        }

        if (pagamentosNfce.length === 0) {
            let meio_pagamento = "01";
            const metodoRaw = venda.tipoPagamento || venda.metodoPagamento || venda.formaPagamento || "";
            const metodoLower = String(metodoRaw).toLowerCase().trim();

            if (metodoLower.includes('pix')) meio_pagamento = "17";
            else if (metodoLower.includes('crédito') || metodoLower.includes('credito') || metodoLower.includes('credit')) meio_pagamento = "03";
            else if (metodoLower.includes('débito') || metodoLower.includes('debito') || metodoLower.includes('debit')) meio_pagamento = "04";
            else if (metodoLower.includes('cartao') || metodoLower.includes('cartão') || metodoLower.includes('card')) meio_pagamento = "03";

            pagamentosNfce.push({ meio_pagamento, valor: somaDosItens });
        }

        try {
            const pixDocSnap = await db.collection('pagamentos_pix').doc(vendaId).get();
            if (pixDocSnap.exists && pixDocSnap.data()?.status === 'pago') {
                if (pagamentosNfce.length > 0) {
                    pagamentosNfce[0].meio_pagamento = "17";
                }
            }
        } catch (e) {}

        const payload = {
            TipoAmbiente: Number(configFiscal.ambiente === "1" ? "1" : "2"),
            ModeloDocumento: 65,
            NaturezaOperacao: "Venda de mercadoria",
            Cliente: cpf ? {
                CpfCnpj: String(cpf).replace(/\D/g, ''),
                NmCliente: 'Consumidor Final'
            } : null,
            Produtos: itensNfce.map(item => ({
                NmProduto: item.descricao,
                NCM: item.ncm,
                CFOP: Number(item.cfop),
                Quantidade: item.quantidade,
                ValorUnitario: item.valor_unitario
            })),
            ValorFrete: 0,
            ValorTotal: somaDosItens
        };

        if (!payload.Cliente) delete payload.Cliente;

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
        try { result = JSON.parse(responseText); } catch (e) { throw new HttpsError('internal', `Erro Brasil NFE.`); }

        if (!response.ok) {
            console.error('Brasil NFE NFC-e erro:', result);
            throw new HttpsError('internal', `Falha Brasil NFE: ${result.Mensagem || JSON.stringify(result)}`);
        }

        console.log('Brasil NFC-E sucesso emissão:', result);
        
        const returnNF = result.ReturnNF || {};
        const chaveAcesso = returnNF.ChaveNF || result.ChaveAcesso || result.Id;

        if (!chaveAcesso) {
            throw new HttpsError('internal', `BrasilNFE não devolveu ID/Chave. Dump: ${JSON.stringify(result)}`);
        }

        const statusSefaz = returnNF.DsStatusRespostaSefaz || result.Status || 'PROCESSANDO';
        const protocolo = returnNF.Protocolo || result.Protocolo || '';

        await vendaRef.update({
            'fiscal.status': 'PROCESSANDO_NFE',
            'fiscal.chaveAcesso': chaveAcesso,
            'fiscal.idBrasilNfe': chaveAcesso,
            'fiscal.protocolo': protocolo,
            'fiscal.statusSefaz': statusSefaz,
            'fiscal.dataEnvio': FieldValue.serverTimestamp(),
            'fiscal.ambiente': configFiscal.ambiente === "1" ? "PRODUCAO" : "HOMOLOGACAO",
            'fiscal.modelo': '65'
        });

        return { 
            sucesso: true, 
            mensagem: 'NFC-e enviada com sucesso.', 
            chaveAcesso: chaveAcesso,
            statusSefaz: statusSefaz,
            uuid: chaveAcesso 
        };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', `Erro interno: ${error.message}`);
    }
});

export const baixarXmlNfceBrasilNfe = onCall({ cors: true, secrets: [brasilNfeApiKey] }, async (request) => {
    const { uuid } = request.data;
    if (!uuid) throw new HttpsError('invalid-argument', 'UUID obrigatório.');

    try {
        const response = await fetch(`https://api.brasilnfe.com.br/v1/nfce/${uuid}/xml`, {
            headers: { "Authorization": `Bearer ${brasilNfeApiKey.value()}` }
        });
        if (!response.ok) throw new Error('Falha ao baixar XML da NFC-e');
        const xml = await response.text();
        return { xml };
    } catch (error) {
        throw new HttpsError('internal', `Erro interno: ${error.message}`);
    }
});

export const baixarPdfBrasilNfce = onCall({ cors: true, secrets: [brasilNfeApiKey] }, async (request) => {
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
        throw new HttpsError('internal', `Erro ao baixar DANFCE: ${error.message}`);
    }
});

export const cancelarNfceBrasilNfe = onCall({ cors: true, secrets: [brasilNfeApiKey] }, async (request) => {
    const { uuid, justificativa } = request.data;
    if (!uuid) throw new HttpsError('invalid-argument', 'UUID obrigatório.');

    try {
        const response = await fetch(`https://api.brasilnfe.com.br/v1/nfce/${uuid}/cancelamento`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${brasilNfeApiKey.value()}` 
            },
            body: JSON.stringify({ justificativa: justificativa || "Cancelamento solicitado pelo cliente." })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || JSON.stringify(result.error));
        return { success: true, result };
    } catch (error) {
        throw new HttpsError('internal', `Erro ao cancelar: ${error.message}`);
    }
});
