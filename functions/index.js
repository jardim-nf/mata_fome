// functions/index.js

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Certifique-se de que admin.initializeApp() é chamado apenas uma vez
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Cloud Function para buscar a chave PIX de um estabelecimento.
 * Apenas administradores do estabelecimento ou o Master Admin podem acessá-la.
 */
exports.getEstablishmentPixKey = functions.https.onCall(async (data, context) => {
    // --- 1. Verificação de Autenticação e Permissões do Chamador ---
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem acessar esta função.');
    }

    const userId = context.auth.uid;
    const userDoc = await admin.firestore().collection('usuarios').doc(userId).get();

    // Verifica se o usuário existe E se é um isAdmin OU isMasterAdmin
    if (!userDoc.exists || (userDoc.data().isAdmin !== true && userDoc.data().isMasterAdmin !== true)) {
        throw new functions.https.HttpsError('permission-denied', 'Apenas administradores podem acessar esta função.');
    }

    // --- 2. Validação dos Dados de Entrada ---
    const establishmentId = data.establishmentId;

    if (!establishmentId) {
        throw new functions.https.HttpsError('invalid-argument', 'O ID do estabelecimento é obrigatório.');
    }

    // --- 3. Busca Segura da Chave PIX ---
    const establishmentDoc = await admin.firestore().collection('estabelecimentos').doc(establishmentId).get();

    if (!establishmentDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Estabelecimento não encontrado.');
    }

    // --- 4. Verificação de Vínculo de Administrador OU Permissão de Master Admin ---
    const adminUIDDoEstabelecimento = establishmentDoc.data().adminUID;
    const isMasterAdminCaller = userDoc.data().isMasterAdmin === true;

    // Se o chamador NÃO é o admin direto do estabelecimento E NÃO é um Master Admin
    if (adminUIDDoEstabelecimento !== userId && !isMasterAdminCaller) {
        throw new functions.https.HttpsError('permission-denied', 'Você não tem permissão para acessar a chave PIX deste estabelecimento.');
    }

    // --- 5. Retorna a Chave PIX ---
    const chavePix = establishmentDoc.data().chavePix;

    if (!chavePix) {
        throw new functions.https.HttpsError('not-found', 'Chave PIX não configurada para este estabelecimento.');
    }

    return { chavePix: chavePix };
});

/**
 * NOVA FUNÇÃO: Cloud Function para criar um novo usuário (cliente ou admin) por um Master Admin.
 * Esta função é chamada do frontend pelo Master Admin.
 */
exports.createUserByMasterAdmin = functions.https.onCall(async (data, context) => {
    // 1. **Autenticação e Autorização do Chamador (Master Admin)**
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem criar outros usuários.');
    }

    const masterAdminUid = context.auth.uid;
    const masterAdminDoc = await admin.firestore().collection('usuarios').doc(masterAdminUid).get();

    if (!masterAdminDoc.exists || masterAdminDoc.data().isMasterAdmin !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Apenas o Administrador Master pode criar novos usuários.');
    }

    // 2. **Validação dos Dados Recebidos para o Novo Usuário**
    const { email, password, name, phoneNumber, addressStreet, addressNumber, addressNeighborhood, addressCity, addressComplement, isAdmin, isMasterAdmin } = data;

    if (!email || !password || !name || password.length < 6) {
        throw new functions.https.HttpsError('invalid-argument', 'Email, Senha (mín. 6 caracteres) e Nome são obrigatórios.');
    }

    // 3. **Criação do Usuário no Firebase Authentication**
    try {
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            displayName: name,
            // phoneNumber é opcional, só passa se não for nulo/vazio
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
            criadoEm: admin.firestore.FieldValue.serverTimestamp(), // Usa o timestamp do servidor
        };

        await admin.firestore().collection('usuarios').doc(userRecord.uid).set(userProfile);

        // Opcional: Se a coleção 'clientes' ainda for usada para clientes comuns
        // e não para administradores (já que 'usuarios' agora contém todos).
        if (!isAdmin && !isMasterAdmin) {
            await admin.firestore().collection('clientes').doc(userRecord.uid).set({
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
                criadoEm: admin.firestore.FieldValue.serverTimestamp(),
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
        throw new functions.https.HttpsError(errorCode, errorMessage);
    }
});