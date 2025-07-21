// functions/index.js

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// --- INICIALIZAÇÃO DO FIREBASE ADMIN SDK ---
if (!getApps().length) {
    initializeApp();
}

const db = getFirestore();
const auth = getAuth();

/**
 * Cloud Function para buscar a chave PIX de um estabelecimento.
 * DEFINIDA AGORA COMO FUNÇÃO DE 2ª GERAÇÃO (v2) com sintaxe ES Module.
 * Apenas administradores do estabelecimento ou o Master Admin podem acessá-la.
 */
export const getEstablishmentPixKey = onCall(async (data, context) => {
    // --- 1. Verificação de Autenticação e Permissões do Chamador ---
    if (!context.auth) {
        throw new HttpsError('unauthenticated', 'Apenas usuários autenticados podem acessar esta função.');
    }

    const userId = context.auth.uid;
    const userDoc = await db.collection('usuarios').doc(userId).get();

    if (!userDoc.exists || (userDoc.data() && (userDoc.data().isAdmin !== true && userDoc.data().isMasterAdmin !== true))) {
        throw new HttpsError('permission-denied', 'Apenas administradores podem acessar esta função.');
    }

    // --- 2. Validação dos Dados de Entrada ---
    const establishmentId = data.establishmentId;

    if (!establishmentId) {
        throw new HttpsError('invalid-argument', 'O ID do estabelecimento é obrigatório.');
    }

    // --- 3. Busca Segura da Chave PIX ---
    const establishmentDoc = await db.collection('estabelecimentos').doc(establishmentId).get();

    if (!establishmentDoc.exists) {
        throw new HttpsError('not-found', 'Estabelecimento não encontrado.');
    }

    // --- 4. Verificação de Vínculo de Administrador OU Permissão de Master Admin ---
    const adminUIDDoEstabelecimento = establishmentDoc.data().adminUID;
    const isMasterAdminCaller = (userDoc.data() && userDoc.data().isMasterAdmin === true);

    if (adminUIDDoEstabelecimento !== userId && !isMasterAdminCaller) {
        throw new HttpsError('permission-denied', 'Você não tem permissão para acessar a chave PIX deste estabelecimento.');
    }

    // --- 5. Retorna a Chave PIX ---
    const chavePix = establishmentDoc.data().chavePix;

    if (!chavePix) {
        throw new HttpsError('not-found', 'Chave PIX não configurada para este estabelecimento.');
    }

    return { chavePix: chavePix };
});

/**
 * NOVA FUNÇÃO: Cloud Function para criar um novo usuário (cliente ou admin) por um Master Admin.
 * Esta função é chamada do frontend pelo Master Admin.
 * DEFINIDA AGORA COMO FUNÇÃO DE 2ª GERAÇÃO (v2) com sintaxe ES Module.
 */
export const createUserByMasterAdmin = onCall(async (data, context) => {
    // *** LOG DE DEBUG DO CONTEXTO DE AUTENTICAÇÃO NO BACKEND ***
    console.log("Cloud Function 'createUserByMasterAdmin' chamada.");
    console.log("Context.auth recebido:", context.auth);
    if (context.auth && context.auth.token) {
        console.log("UID do token:", context.auth.uid);
        console.log("Email do token:", context.auth.token.email);
        console.log("Claims do token (isAdmin, isMasterAdmin):", context.auth.token.isAdmin, context.auth.token.isMasterAdmin);
    } else {
        console.error("Context.auth é nulo ou token ausente. Requisicao não autenticada.");
    }
    // *********************************************************

    // 1. **Autenticação e Autorização do Chamador (Master Admin)**
    if (!context.auth) {
        throw new HttpsError('unauthenticated', 'Apenas usuários autenticados podem criar outros usuários.');
    }

    const masterAdminUid = context.auth.uid;
    const masterAdminDoc = await db.collection('usuarios').doc(masterAdminUid).get();

    if (!masterAdminDoc.exists || (masterAdminDoc.data() && masterAdminDoc.data().isMasterAdmin !== true)) {
        throw new HttpsError('permission-denied', 'Apenas o Administrador Master pode criar novos usuários.');
    }

    // 2. **Validação dos Dados Recebidos para o Novo Usuário**
    const { email, password, name, phoneNumber, addressStreet, addressNumber, addressNeighborhood, addressCity, addressComplement, isAdmin, isMasterAdmin } = data;

    if (!email || !password || !name || password.length < 6) {
        throw new HttpsError('invalid-argument', 'Email, Senha (mín. 6 caracteres) e Nome são obrigatórios.');
    }

    // 3. **Criação do Usuário no Firebase Authentication**
    try {
        const userRecord = await auth.createUser({
            email: email,
            password: password,
            displayName: name,
            phoneNumber: phoneNumber && phoneNumber.trim() !== '' ? phoneNumber.trim() : undefined
        });

        // 4. **Salvar o Perfil do Usuário no Firestore (`usuarios` collection)**
        const userProfile = {
            nome: name.trim(),
            email: email.trim(),
            telefone: phoneNumber && phoneNumber.trim() !== '' ? phoneNumber.trim() : null,
            endereco: {
                rua: addressStreet && addressStreet.trim() !== '' ? addressStreet.trim() : null,
                numero: addressNumber && addressNumber.trim() !== '' ? addressNumber.trim() : null,
                bairro: addressNeighborhood && addressNeighborhood.trim() !== '' ? addressNeighborhood.trim() : null,
                cidade: addressCity && addressCity.trim() !== '' ? addressCity.trim() : null,
                complemento: addressComplement && addressComplement.trim() !== '' ? addressComplement.trim() : null,
            },
            isAdmin: isAdmin || false,
            isMasterAdmin: isMasterAdmin || false,
            criadoEm: FieldValue.serverTimestamp(),
        };

        await db.collection('usuarios').doc(userRecord.uid).set(userProfile);

        // Opcional: Se a coleção 'clientes' ainda for usada para clientes comuns
        if (!isAdmin && !isMasterAdmin) {
            await db.collection('clientes').doc(userRecord.uid).set({
                nome: name.trim(),
                email: email.trim(),
                telefone: phoneNumber && phoneNumber.trim() !== '' ? phoneNumber.trim() : null,
                endereco: {
                    rua: addressStreet && addressStreet.trim() !== '' ? addressStreet.trim() : null,
                    numero: addressNumber && addressNumber.trim() !== '' ? addressNumber.trim() : null,
                    bairro: addressNeighborhood && addressNeighborhood.trim() !== '' ? addressNeighborhood.trim() : null,
                    cidade: addressCity && addressCity.trim() !== '' ? addressCity.trim() : null,
                    complemento: addressComplement && addressComplement.trim() !== '' ? addressComplement.trim() : null,
                },
                criadoEm: FieldValue.serverTimestamp(),
            });
        }

        return { success: true, uid: userRecord.uid, message: `Usuário ${name} criado com sucesso!` };

    } catch (error) {
        console.error("Erro na Cloud Function createUserByMasterAdmin:", error);
        let errorCode = 'unknown';
        let errorMessage = 'Erro ao criar usuário.';

        if (error.code) {
            switch (error.code) {
                case 'auth/email-already-exists':
                    errorCode = 'email-already-in-use';
                    errorMessage = 'Este email já está cadastrado.';
                    break;
                case 'auth/invalid-password':
                    errorCode = 'weak-password';
                    errorMessage = 'A senha é muito fraca. Deve ter pelo menos 6 caracteres.';
                    break;
                case 'auth/invalid-email':
                    errorCode = 'invalid-email';
                    errorMessage = 'O formato do email é inválido.';
                    break;
                default:
                    errorMessage = `Erro do Firebase: ${error.message}`;
            }
        }
        throw new HttpsError(errorCode, errorMessage);
    }
});