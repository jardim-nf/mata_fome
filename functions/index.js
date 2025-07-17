// functions/index.js

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

exports.getEstablishmentPixKey = functions.https.onCall(async (data, context) => {
    // --- 1. Verificação de Autenticação e Permissões ---
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem acessar esta função.');
    }

    const userId = context.auth.uid;
    const userDoc = await admin.firestore().collection('usuarios').doc(userId).get();

    if (!userDoc.exists || userDoc.data().isAdmin !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Apenas administradores podem acessar esta função.');
    }

    // --- 2. Validação dos Dados de Entrada ---
    const establishmentId = data.establishmentId;

    if (!establishmentId) {
        throw new new functions.https.HttpsError('invalid-argument', 'O ID do estabelecimento é obrigatório.');
    }

    // --- 3. Busca Segura da Chave PIX ---
    const establishmentDoc = await admin.firestore().collection('estabelecimentos').doc(establishmentId).get();

    if (!establishmentDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Estabelecimento não encontrado.');
    }

    // --- 4. Verificação de Vínculo de Administrador ---
    const adminUIDDoEstabelecimento = establishmentDoc.data().adminUID;

    if (adminUIDDoEstabelecimento !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Você não tem permissão para acessar a chave PIX deste estabelecimento.');
    }

    // --- 5. Retorna a Chave PIX ---
    const chavePix = establishmentDoc.data().chavePix;

    if (!chavePix) {
        throw new functions.https.HttpsError('not-found', 'Chave PIX não configurada para este estabelecimento.');
    }

    return { chavePix: chavePix };
});