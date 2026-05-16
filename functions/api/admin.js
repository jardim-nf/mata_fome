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
        let userRecord;
        try {
            // Tenta criar o usuário no Firebase Auth
            userRecord = await adminAuth.createUser({
                email: data.email,
                password: data.password,
                displayName: data.displayName || '',
            });
        } catch (createError) {
            if (createError.code === 'auth/email-already-exists') {
                logger.info(`Usuário ${data.email} já existe no Auth. Reutilizando registro.`);
                userRecord = await adminAuth.getUserByEmail(data.email);
                
                // Opcional: Se a senha foi fornecida, podemos atualizá-la
                if (data.password) {
                    await adminAuth.updateUser(userRecord.uid, { password: data.password });
                }
            } else {
                throw createError;
            }
        }

        // Set Custom Claims and Save User info in Firestore concurrently
        const claimsPromise = adminAuth.setCustomUserClaims(userRecord.uid, {
            role: data.role || 'usuario',
            isAdmin: data.isAdmin || false,
            isMasterAdmin: data.isMasterAdmin || false,
            estabelecimentos: data.estabelecimentos || []
        });

        const firestorePromise = db.collection('usuarios').doc(userRecord.uid).set({
            nome: data.displayName || '',
            email: data.email,
            role: data.role || 'usuario',
            isAdmin: data.isAdmin || false,
            isMasterAdmin: data.isMasterAdmin || false,
            ativo: data.ativo !== false,
            estabelecimentosGerenciados: data.estabelecimentos || [],
            criadoEm: FieldValue.serverTimestamp(),
        }, { merge: true });

        await Promise.all([claimsPromise, firestorePromise]);

        return {
            sucesso: true,
            uid: userRecord.uid,
            mensagem: 'Usuário configurado com sucesso (criado ou atualizado).',
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
            .where('usuarioId', '==', dados.usuarioId)
            .where('estabelecimentoId', '==', estabelecimentoId)
            .where('status', '==', 'aberto')
            .limit(1)
            .get();
        
        if (!snapshot.empty) {
            return { success: false, error: 'Já existe um turno aberto. Feche-o antes de abrir um novo.' };
        }

        const newDoc = await caixasRef.add({
            ...dados,
            dataAbertura: FieldValue.serverTimestamp(),
            status: 'aberto'
        });

        return { success: true, id: newDoc.id };
    } catch (e) {
        logger.error('Erro ao abrir caixa:', e);
        return { success: false, error: e.message };
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
        return { success: false, error: e.message };
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
        return { success: false, error: e.message };
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
        throw new HttpsError('invalid-argument', 'Parâmetros incompletos.');
    }

    await verifyAdminAccess(request, estabelecimentoId);

    try {
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T23:59:59');
        const startTs = Timestamp.fromDate(start);
        const endTs = Timestamp.fromDate(end);

        const pedidosRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('pedidos');
        const vendasRef = db.collection('vendas'); // Global, mas filtra por estabelecimento
        const pedidosGlobalRef = db.collection('pedidos'); // Casos antigos

        const qSub = pedidosRef.where('createdAt', '>=', startTs).where('createdAt', '<=', endTs).get();
        const qGlob = pedidosGlobalRef.where('estabelecimentoId', '==', estabelecimentoId).where('createdAt', '>=', startTs).where('createdAt', '<=', endTs).get();
        const qMesa = vendasRef.where('estabelecimentoId', '==', estabelecimentoId).where('criadoEm', '>=', startTs).where('criadoEm', '<=', endTs).get();

        const [snapSub, snapGlob, snapMesa] = await Promise.all([qSub, qGlob, qMesa]);

        let allDataMap = new Map();
        
        const isMesaDoc = (data) => data.tipo === 'mesa' || data.source === 'salao' || !!data.mesaNumero || !!data.numeroMesa;

        // Mapeamento simples
        const extractData = (doc, origem) => {
            const data = doc.data();
            const dateVal = data.createdAt || data.criadoEm || data.data;
            const parsedDate = dateVal?.toDate ? dateVal.toDate() : (dateVal ? new Date(dateVal) : new Date());

            const base = {
                id: doc.id,
                origem,
                dataStr: parsedDate.toISOString(),
                totalFinal: Number(data.totalFinal || data.total || 0),
                taxaEntrega: Number(data.taxaEntrega || 0),
                tipo: data.tipo || 'delivery',
                status: data.status || '',
                formaPagamento: data.formaPagamento || '',
                pagamentos: data.pagamentos || {},
                clienteNome: data.clienteNome || data.nomeCliente || '',
                motoboyId: data.motoboyId || '',
                motoboyNome: data.motoboyNome || '',
                bairro: data.endereco?.bairro || data.bairro || '',
                mesaNumero: data.mesaNumero || data.numeroMesa || null,
                itens: (data.itens || []).map(it => ({
                    nome: it.nome || 'Item',
                    preco: Number(it.preco || 0),
                    quantidade: Number(it.quantidade || 1),
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
        snapMesa.docs.forEach(d => extractData(d, 'mesa'));

        // Filtrar redundâncias e ref_ids no backend para economizar payload
        let dedup = Array.from(allDataMap.values());

        // Ordenar do mais novo para o mais velho
        dedup.sort((a, b) => new Date(b.dataStr) - new Date(a.dataStr));

        return { success: true, pedidos: dedup };

    } catch (error) {
        logger.error('Erro em gerarRelatorioBackend:', error);
        throw new HttpsError('internal', error.message);
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
