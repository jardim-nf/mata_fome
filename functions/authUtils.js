import { HttpsError } from 'firebase-functions/v2/https';
import { db } from './firebaseCore.js';

export async function verifyAdminAccess(request, estabelecimentoId) {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');

    const token = request.auth.token || {};
    let isMaster = token.isMasterAdmin === true || token.role === 'master';
    let hasAccess = false;
    if (token.estabelecimentos) {
        hasAccess = Array.isArray(token.estabelecimentos) 
            ? token.estabelecimentos.includes(estabelecimentoId)
            : !!token.estabelecimentos[estabelecimentoId];
    }

    // Se já é master ou já tem acesso via token, libera direto sem query lenta.
    if (isMaster || hasAccess) return;

    // Se o token não tiver as infos (comum por limite de bytes), busca no Firestore
    const userDoc = await db.collection('usuarios').doc(uid).get();
    if (userDoc.exists) {
        const data = userDoc.data();
        isMaster = data.isMasterAdmin === true || data.role === 'master';
        
        if (data.estabelecimentosGerenciados) {
            hasAccess = Array.isArray(data.estabelecimentosGerenciados)
                ? data.estabelecimentosGerenciados.includes(estabelecimentoId)
                : !!data.estabelecimentosGerenciados[estabelecimentoId];
        }
        if (!hasAccess && data.estabelecimentos) {
            hasAccess = Array.isArray(data.estabelecimentos)
                ? data.estabelecimentos.includes(estabelecimentoId)
                : !!data.estabelecimentos[estabelecimentoId];
        }
    }

    if (!isMaster && !hasAccess) {
        throw new HttpsError('permission-denied', 'Acesso negado.');
    }
}
