import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { db, adminAuth } from '../firebaseCore.js';

import { verifyAdminAccess } from '../authUtils.js';

// ==================================================================
// 1.5 CRIAR USUÁRIO (MASTER ADMIN)
// ==================================================================
import { createMasterUser } from '../createMasterUser';

export const createUserByMasterAdminHttp = onCall({ cors: true }, async (request) => {
    // 1. Auth checkpoint
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Usuário não autenticado.');
    }
    
    // 2. Validate token claims: ONLY Master Admin can create other users (especially admins)
    const token = request.auth.token;
    if (token.isMasterAdmin !== true && token.role !== 'master') {
        throw new HttpsError('permission-denied', 'Apenas Master Admins podem criar usuários.');
    }
    
    const data = request.data;
    if (!data.email || !data.password) {
        throw new HttpsError('invalid-argument', 'O email e a senha são obrigatórios.');
    }

    try {
        const result = await createMasterUser(data.email, data.password);

        return {
            sucesso: result.success,
            uid: result.uid,
            mensagem: result.message,
        };
    } catch (error) {
        logger.error('Erro ao criar/atualizar usuário:', error);
        throw new HttpsError('internal', 'Erro ao configurar o usuário no Firebase: ' + error.message);
    }
});

// ==================================================================
// 2. FLUXO DE CAIXA SEGURANÇA (Secure-by-Design)
// ==================================================================

export const abrirCaixaBackend = onCall({ cors: true }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');

    const { estabelecimentoId, dados } = request.data || {};
    if (!estabelecimentoId || !dados) {
        throw new HttpsError('invalid-argument', 'Dados incompletos.');
    }

    await verifyAdminAccess(request, estabelecimentoId);

    try {
        const caixasRef = db.collection('caixas');
        const snapshot = await caixasRef
            .where('estabelecimentoId', '==', estabelecimentoId)
            .where('status', '==', 'aberto')
            .limit(1)
            .get();
        
        if (!snapshot.empty) {
            return { success: false, error: 'Já existe um turno aberto para este estabelecimento.' };
        }

        const newDoc = await caixasRef.add({
            ...dados,
            dataAbertura: FieldValue.serverTimestamp(),
            status: 'aberto'
        });

        return { success: true, id: newDoc.id };
    } catch (e) {
        logger.error('Erro ao abrir caixa:', e);
        if (e instanceof HttpsError) throw e;
        throw new HttpsError('internal', e.message || 'Erro interno.');
    }
});

export const fecharCaixaBackend = onCall({ cors: true }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');

    const { estabelecimentoId, caixaId, dados } = request.data || {};
    if (!estabelecimentoId || !caixaId || !dados) throw new HttpsError('invalid-argument', 'Dados incompletos.');

    await verifyAdminAccess(request, estabelecimentoId);

    try {
        await db.collection('caixas').doc(caixaId).update({
            ...dados,
            status: 'fechado',
            dataFechamento: FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (e) {
        logger.error('Erro ao fechar caixa:', e);
        if (e instanceof HttpsError) throw e;
        throw new HttpsError('internal', e.message || 'Erro interno.');
    }
});

export const adicionarMovimentacaoCaixaBackend = onCall({ cors: true }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');

    const { estabelecimentoId, caixaId, dados } = request.data || {};
    if (!estabelecimentoId || !caixaId || !dados) throw new HttpsError('invalid-argument', 'Dados incompletos.');

    await verifyAdminAccess(request, estabelecimentoId);

    try {
        await db.collection('caixas').doc(caixaId).collection('movimentacoes').add({
            ...dados,
            createdAt: FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (e) {
        logger.error('Erro ao adicionar movimentacao:', e);
        if (e instanceof HttpsError) throw e;
        throw new HttpsError('internal', e.message || 'Erro interno.');
    }
});

// ==================================================================
// 3. GERENCIAMENTO DE CUPONS (Secure-by-Design)
// ==================================================================

export const gerenciarCupomBackend = onCall({ cors: true }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');

    const { estabelecimentoId, action, cupomId, dados } = request.data || {};
    if (!estabelecimentoId || !action) throw new HttpsError('invalid-argument', 'Dados incompletos.');

    await verifyAdminAccess(request, estabelecimentoId);

    try {
        const cuponsRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('cupons');

        switch (action) {
            case 'CREATE': {
                // Verificar se cupom já existe
                const snapshot = await cuponsRef.where('codigo', '==', dados.codigo).get();
                if (!snapshot.empty) {
                    throw new HttpsError('already-exists', 'Já existe um cupom com este código.');
                }
                
                // Tratar datas que chegam como timestamp no payload (se serializado corretamente do JS)
                // Ou string
                const inicio = dados.validadeInicio ? new Date(dados.validadeInicio) : new Date();
                const fim = dados.validadeFim ? new Date(dados.validadeFim) : new Date();
                
                const novoCupom = await cuponsRef.add({
                    ...dados,
                    validadeInicio: Timestamp.fromDate(inicio),
                    validadeFim: Timestamp.fromDate(fim),
                    criadoEm: FieldValue.serverTimestamp()
                });
                return { success: true, id: novoCupom.id };
            }
            case 'UPDATE': {
                if (!cupomId) throw new HttpsError('invalid-argument', 'ID do cupom não informado.');
                
                const updates = { ...dados, atualizadoEm: FieldValue.serverTimestamp() };
                if (dados.validadeInicio) updates.validadeInicio = Timestamp.fromDate(new Date(dados.validadeInicio));
                if (dados.validadeFim) updates.validadeFim = Timestamp.fromDate(new Date(dados.validadeFim));
                
                await cuponsRef.doc(cupomId).update(updates);
                return { success: true };
            }
            case 'DELETE': {
                if (!cupomId) throw new HttpsError('invalid-argument', 'ID do cupom não informado.');
                await cuponsRef.doc(cupomId).delete();
                return { success: true };
            }
            default:
                throw new HttpsError('invalid-argument', 'Ação inválida.');
        }
    } catch (e) {
        logger.error('Erro em gerenciarCupomBackend:', e);
        if (e instanceof HttpsError) throw e;
        throw new HttpsError('internal', e.message);
    }
});

// ==================================================================
// 4. RELATÓRIOS E DASHBOARDS OTIMIZADOS
// ==================================================================

export const gerarRelatorioBackend = onCall({ cors: true }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');

    const { estabelecimentoId, startDate, endDate } = request.data || {};
    if (!estabelecimentoId || !startDate || !endDate) {
        throw new HttpsError('invalid-argument', 'Parâmetros insuficientes.');
    }

    await verifyAdminAccess(request, estabelecimentoId);

    // Fuso horário do Brasil (UTC-3) ajustado para turno noturno (dia financeiro das 06:00 às 05:59 do dia seguinte)
    // Se a data de início é '2026-05-16', queremos começar às 06:00:00 do Brasil (09:00:00 UTC)
    const [yS, mS, dS] = startDate.split('-').map(Number);
    const startTs = Timestamp.fromDate(new Date(Date.UTC(yS, mS - 1, dS, 9, 0, 0, 0)));

    // E terminar às 05:59:59.999 do Brasil do dia seguinte ao endDate (08:59:59.999 UTC)
    // Usamos 32 horas (24 + 8) no Date.UTC para representar 08:59:59.999 UTC do próximo dia
    const [yE, mE, dE] = endDate.split('-').map(Number);
    const endTs = Timestamp.fromDate(new Date(Date.UTC(yE, mE - 1, dE, 32, 59, 59, 999)));

    try {
        const pedidosRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('pedidos');
        const vendasRef = db.collection('vendas'); // Global, mas filtra por estabelecimento
        const pedidosGlobalRef = db.collection('pedidos'); // Casos antigos

        const qSub = pedidosRef.where('createdAt', '>=', startTs).where('createdAt', '<=', endTs).get();
        const qGlob = pedidosGlobalRef.where('estabelecimentoId', '==', estabelecimentoId).where('createdAt', '>=', startTs).where('createdAt', '<=', endTs).get();
        const qMesa = vendasRef.where('estabelecimentoId', '==', estabelecimentoId).where('criadoEm', '>=', startTs).where('criadoEm', '<=', endTs).get();

        const [snapSub, snapGlob, snapMesa] = await Promise.all([qSub, qGlob, qMesa]);

        let allDataMap = new Map();
        const isMesaDoc = (data) => data.tipo === 'mesa' || data.origem === 'mesa' || data.source === 'salao' || !!data.mesaNumero || !!data.numeroMesa;

        const safeNum = (val) => {
            const n = Number(val);
            return isNaN(n) ? 0 : n;
        };

        // Mapeamento simples
        const extractData = (doc, origem) => {
            const data = doc.data();
            const dateVal = data.createdAt || data.criadoEm || data.data;
            const parsedDate = dateVal?.toDate ? dateVal.toDate() : (dateVal ? new Date(dateVal) : new Date());

            const isMesa = isMesaDoc(data) || origem === 'mesa';

            const base = {
                id: doc.id,
                origem,
                dataStr: parsedDate.toISOString(),
                totalFinal: safeNum(data.totalFinal !== undefined ? data.totalFinal : data.total),
                taxaEntrega: safeNum(data.taxaEntrega),
                tipo: isMesa ? 'mesa' : (data.tipo || 'delivery'),
                status: data.status || (isMesa ? 'finalizada' : ''),
                formaPagamento: data.formaPagamento || '',
                pagamentos: data.pagamentos || {},
                clienteNome: data.clienteNome || data.nomeCliente || data.cliente || '',
                motoboyId: data.motoboyId || '',
                motoboyNome: data.motoboyNome || '',
                bairro: data.endereco?.bairro || data.bairro || '',
                mesaNumero: data.mesaNumero || data.numeroMesa || null,
                itens: (data.itens || []).map(it => ({
                    nome: it.nome || 'Item',
                    preco: safeNum(it.preco),
                    quantidade: safeNum(it.quantidade || 1),
                    status: it.status || ''
                })),
                pedidoId: data.pedidoId || null
            };

            if (!allDataMap.has(base.id)) {
                allDataMap.set(base.id, base);
            }
        };

        snapSub.docs.forEach(d => { if (!isMesaDoc(d.data())) extractData(d, 'delivery'); });
        snapGlob.docs.forEach(d => { if (!isMesaDoc(d.data())) extractData(d, 'delivery'); });
        // Para vendas: respeitar o campo 'origem' do documento ao invés de forçar tudo como 'mesa'
        snapMesa.docs.forEach(d => {
            const data = d.data();
            const origemReal = isMesaDoc(data) ? 'mesa' : (data.origem || 'mesa');
            extractData(d, origemReal);
        });

        // Filtrar redundâncias: se uma venda tem pedidoId que já existe como pedido, remover o pedido duplicado
        let dedup = Array.from(allDataMap.values());

        // Remover pedidos que já possuem uma venda correspondente (evita contar 2x)
        const pedidoIdsComVenda = new Set();
        dedup.forEach(item => {
            if (item.pedidoId && item.pedidoId !== item.id) {
                pedidoIdsComVenda.add(item.pedidoId);
            }
        });
        dedup = dedup.filter(item => !pedidoIdsComVenda.has(item.id));

        // Ordenar do mais novo para o mais velho
        dedup.sort((a, b) => new Date(b.dataStr) - new Date(a.dataStr));

        // Sanitização recursiva agressiva para impedir que qualquer NaN chegue ao Firebase Encode
        const sanitizePayload = (obj) => {
            if (obj === null || obj === undefined) return null;
            if (typeof obj === 'number') {
                return (isNaN(obj) || !isFinite(obj)) ? 0 : obj;
            }
            if (typeof obj === 'string' || typeof obj === 'boolean') {
                return obj;
            }
            if (Array.isArray(obj)) {
                return obj.map(item => sanitizePayload(item));
            }
            if (typeof obj === 'object') {
                const newObj = {};
                for (const key of Object.keys(obj)) {
                    newObj[key] = sanitizePayload(obj[key]);
                }
                return newObj;
            }
            return null;
        };

        const safeDedup = sanitizePayload(dedup);

        return { success: true, pedidos: safeDedup };

    } catch (error) {
        logger.error('Erro em gerarRelatorioBackend:', error);
        throw new HttpsError('internal', error.message);
    }
});

// Endpoint temporário para consertar vendas sem criadoEm
export const fixVendasEndpoint = onRequest({ cors: true, maxInstances: 1 }, async (req, res) => {
    try {
        const vendasSnap = await db.collection('vendas').get();
        let count = 0;
        let batch = db.batch();
        
        const commitPromises = [];

        vendasSnap.forEach(doc => {
            const data = doc.data();
            if (data.createdAt && !data.criadoEm) {
                batch.update(doc.ref, { criadoEm: data.createdAt });
                count++;
                if (count % 400 === 0) {
                    commitPromises.push(batch.commit());
                    batch = db.batch();
                }
            }
        });
        if (count % 400 !== 0) {
            commitPromises.push(batch.commit());
        }
        
        await Promise.all(commitPromises);
        
        res.status(200).send({ success: true, count, message: "Vendas corrigidas" });
    } catch (e) {
        res.status(500).send({ error: e.message });
    }
});

// ==================================================================
// 5. GERENCIAMENTO DE TAXAS DE ENTREGA E CONFIGURAÇÕES
// ==================================================================

export const gerenciarTaxasBackend = onCall({ cors: true }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');

    const { estabelecimentoId, action, taxaId, dados, payloadBatch } = request.data || {};
    if (!estabelecimentoId || !action) throw new HttpsError('invalid-argument', 'Dados incompletos.');

    await verifyAdminAccess(request, estabelecimentoId);

    try {
        const taxasRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('taxasDeEntrega');

        switch (action) {
            case 'CREATE': {
                const novaTaxa = await taxasRef.add({
                    ...dados,
                    criadoEm: FieldValue.serverTimestamp(),
                    ativo: true
                });
                return { success: true, id: novaTaxa.id };
            }
            case 'UPDATE': {
                if (!taxaId) throw new HttpsError('invalid-argument', 'ID da taxa não informado.');
                await taxasRef.doc(taxaId).update({
                    ...dados,
                    atualizadoEm: FieldValue.serverTimestamp()
                });
                return { success: true };
            }
            case 'DELETE': {
                if (!taxaId) throw new HttpsError('invalid-argument', 'ID da taxa não informado.');
                await taxasRef.doc(taxaId).delete();
                return { success: true };
            }
            case 'BATCH_UPDATE': {
                if (!payloadBatch || !Array.isArray(payloadBatch)) throw new HttpsError('invalid-argument', 'Payload inválido.');
                const batch = db.batch();
                
                for (const item of payloadBatch) {
                    const docRef = taxasRef.doc(item.id);
                    batch.update(docRef, {
                        valorTaxa: item.novoValor,
                        atualizadoEm: FieldValue.serverTimestamp()
                    });
                }
                
                await batch.commit();
                return { success: true };
            }
            default:
                throw new HttpsError('invalid-argument', 'Ação inválida.');
        }
    } catch (e) {
        logger.error('Erro em gerenciarTaxasBackend:', e);
        if (e instanceof HttpsError) throw e;
        throw new HttpsError('unknown', e.message || 'Erro desconhecido');
    }
});
