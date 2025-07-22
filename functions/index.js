import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import nodemailer from 'nodemailer';
// CORRECTED IMPORTS for Firestore triggers in v2
import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted
} from 'firebase-functions/v2/firestore';

// --- INICIALIZAÇÃO DO FIREBASE ADMIN SDK ---
if (!getApps().length) {
    initializeApp();
}

const db = getFirestore();
const auth = getAuth();

// =========================================================================
// Configurações de E-mail para Nodemailer
// =========================================================================
const mailTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },
});

const APP_NAME = 'DeuFome Admin';
const MASTER_ADMIN_EMAIL = 'seu_email_master_admin@exemplo.com'; // ALtere para o seu e-mail

// =========================================================================
// Cloud Function: getEstablishmentPixKey
// =========================================================================
export const getEstablishmentPixKey = onCall(async (data, context) => {
    if (!context.auth) throw new HttpsError('unauthenticated', 'Apenas usuários autenticados podem acessar esta função.');
    const userDoc = await db.collection('usuarios').doc(context.auth.uid).get();
    if (!userDoc.exists || !(userDoc.data()?.isAdmin === true || userDoc.data()?.isMasterAdmin === true)) {
        throw new HttpsError('permission-denied', 'Apenas administradores podem acessar esta função.');
    }
    const establishmentId = data.establishmentId;
    if (!establishmentId) throw new HttpsError('invalid-argument', 'O ID do estabelecimento é obrigatório.');
    const establishmentDoc = await db.collection('estabelecimentos').doc(establishmentId).get();
    if (!establishmentDoc.exists) throw new HttpsError('not-found', 'Estabelecimento não encontrado.');
    const adminUIDDoEstabelecimento = establishmentDoc.data().adminUID;
    const isMasterAdminCaller = userDoc.data()?.isMasterAdmin === true;
    if (adminUIDDoEstabelecimento !== context.auth.uid && !isMasterAdminCaller) {
        throw new HttpsError('permission-denied', 'Você não tem permissão para acessar a chave PIX deste estabelecimento.');
    }
    const chavePix = establishmentDoc.data().chavePix;
    if (!chavePix) throw new HttpsError('not-found', 'Chave PIX não configurada para este estabelecimento.');
    return { chavePix: chavePix };
});

// =========================================================================
// Cloud Function: createUserByMasterAdmin
// =========================================================================
export const createUserByMasterAdmin = onCall(async (data, context) => {
    console.log("Cloud Function 'createUserByMasterAdmin' chamada.");
    if (!context.auth) throw new HttpsError('unauthenticated', 'Apenas usuários autenticados podem criar outros usuários.');
    const masterAdminDoc = await db.collection('usuarios').doc(context.auth.uid).get();
    if (!masterAdminDoc.exists || masterAdminDoc.data()?.isMasterAdmin !== true) {
        throw new HttpsError('permission-denied', 'Apenas o Administrador Master pode criar novos usuários.');
    }
    const { email, password, name, phoneNumber, addressStreet, addressNumber, addressNeighborhood, addressCity, addressComplement, isAdmin, isMasterAdmin, estabelecimentosGerenciados } = data;
    if (!email || !password || !name || password.length < 6) {
        throw new HttpsError('invalid-argument', 'Email, Senha (mín. 6 caracteres) e Nome são obrigatórios.');
    }
    try {
        const userRecord = await auth.createUser({
            email: email, password: password, displayName: name,
            phoneNumber: phoneNumber && phoneNumber.trim() !== '' ? phoneNumber.trim() : undefined
        });
        const userProfile = {
            uid: userRecord.uid, nome: name.trim(), email: email.trim(),
            telefone: phoneNumber && phoneNumber.trim() !== '' ? phoneNumber.trim() : null,
            endereco: {
                rua: addressStreet && addressStreet.trim() !== '' ? addressStreet.trim() : null,
                numero: addressNumber && addressNumber.trim() !== '' ? addressNumber.trim() : null,
                bairro: addressNeighborhood && addressNeighborhood.trim() !== '' ? addressNeighborhood.trim() : null,
                cidade: addressCity && addressCity.trim() !== '' ? addressCity.trim() : null,
                complemento: addressComplement && addressComplement.trim() !== '' ? addressComplement.trim() : null,
            },
            isAdmin: isAdmin || false, isMasterAdmin: isMasterAdmin || false, ativo: true,
            estabelecimentosGerenciados: estabelecimentosGerenciados || [], criadoEm: FieldValue.serverTimestamp(),
        };
        await db.collection('usuarios').doc(userRecord.uid).set(userProfile);
        if (!isAdmin && !isMasterAdmin) {
            await db.collection('clientes').doc(userRecord.uid).set({
                nome: name.trim(), email: email.trim(), telefone: phoneNumber && phoneNumber.trim() !== '' ? phoneNumber.trim() : null,
                endereco: {
                    rua: addressStreet && addressStreet.trim() !== '' ? addressStreet.trim() : null,
                    numero: addressNumber && addressNumber.trim() !== '' ? addressNumber.trim() : null,
                    bairro: addressNeighborhood && addressNeighborhood.trim() !== '' ? addressNeighborhood.trim() : null,
                    cidade: addressCity && addressCity.trim() !== '' ? addressCity.trim() : null,
                    complemento: addressComplement && addressComplement.trim() !== '' ? addressComplement.trim() : null,
                }, criadoEm: FieldValue.serverTimestamp(),
            });
        }
        return { success: true, uid: userRecord.uid, message: `Usuário ${name} criado com sucesso!` };
    } catch (error) {
        console.error("Erro na Cloud Function createUserByMasterAdmin:", error);
        let errorCode = 'unknown'; let errorMessage = 'Erro ao criar usuário.';
        if (error.code) {
            switch (error.code) {
                case 'auth/email-already-exists': errorCode = 'email-already-in-use'; errorMessage = 'Este email já está cadastrado.'; break;
                case 'auth/invalid-password': errorCode = 'weak-password'; errorMessage = 'A senha é muito fraca. Deve ter pelo menos 6 caracteres.'; break;
                case 'auth/invalid-email': errorCode = 'invalid-email'; errorMessage = 'O formato do email é inválido.'; break;
                default: errorMessage = `Erro do Firebase: ${error.message}`;
            }
        }
        throw new HttpsError(errorCode, errorMessage);
    }
});

// =========================================================================
// Cloud Function Agendada: Verifica Pagamentos Atrasados Diariamente
// =========================================================================
export const checkLatePayments = onSchedule('0 2 * * *', async (context) => {
    console.log("Executando checkLatePayments agendado...");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    try {
        const querySnapshot = await db.collection('estabelecimentos').where('ativo', '==', true).where('nextBillingDate', '<=', today).get();
        if (querySnapshot.empty) { console.log('Nenhum estabelecimento com pagamento atrasado encontrado hoje.'); return null; }
        const latePayments = []; const batch = db.batch();
        for (const doc of querySnapshot.docs) {
            const estabData = doc.data(); latePayments.push(estabData);
            const estabDocRef = db.collection('estabelecimentos').doc(doc.id);
            batch.update(estabDocRef, { ativo: false, desativadoEm: FieldValue.serverTimestamp() }); // 'ativo' (corrigido)
            const auditLogRef = db.collection('auditLogs').doc();
            batch.set(auditLogRef, {
                timestamp: FieldValue.serverTimestamp(), actionType: 'PAGAMENTO_ATRASADO_E_DESATIVADO',
                actor: { uid: 'system', email: 'system@example.com', role: 'system_cron' },
                target: { type: 'estabelecimento', id: doc.id, name: estabData.nome || 'N/A' },
                details: { nextBillingDate: estabData.nextBillingDate ? estabData.nextBillingDate.toDate() : 'N/A', newStatus: false }
            });
        }
        await batch.commit();
        const emailContent = latePayments.map(estab => `- ${estab.nome} (ID: ${estab.id}) - Vencimento: ${estab.nextBillingDate ? estab.nextBillingDate.toDate().toLocaleDateString('pt-BR') : 'N/A'}`).join('\n');
        const mailOptions = {
            from: `${APP_NAME} <${process.env.MAIL_USER}>`, to: MASTER_ADMIN_EMAIL,
            subject: `🚨 ALERTA: ${latePayments.length} Pagamento(s) Atrasado(s) - ${APP_NAME}`,
            html: `<p>Olá Master Admin,</p><p>Identificamos ${latePayments.length} estabelecimento(s) com pagamento atrasado:</p><pre>${emailContent}</pre><p>Os estabelecimentos foram desativados automaticamente.</p><p>Por favor, tome as medidas necessárias.</p><p>Atenciosamente,</p><p>Equipe ${APP_NAME}</p>`,
        };
        await mailTransport.sendMail(mailOptions);
        console.log(`Alerta de pagamento atrasado enviado para ${MASTER_ADMIN_EMAIL}.`);
        return null;
    } catch (error) {
        console.error('Erro na Cloud Function checkLatePayments:', error);
        const errorMailOptions = {
            from: `${APP_NAME} <${process.env.MAIL_USER}>`, to: MASTER_ADMIN_EMAIL,
            subject: `❌ ERRO NA CLOUD FUNCTION: checkLatePayments - ${APP_NAME}`,
            html: `<p>Ocorreu um erro na função checkLatePayments: ${error.message}</p><pre>${error.stack}</pre>`,
        };
        await mailTransport.sendMail(errorMailOptions);
        return null;
    }
});

// =========================================================================
// Cloud Function Agendada: Alerta Estabelecimentos Inativos por Longo Período
// =========================================================================
export const alertLongInactiveEstablishments = onSchedule('0 3 * * 1', async (context) => {
    console.log("Executando alertLongInactiveEstablishments agendado...");
    const thresholdDays = 60; const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - thresholdDays);
    sixtyDaysAgo.setHours(0, 0, 0, 0);
    try {
        const querySnapshot = await db.collection('estabelecimentos').where('ativo', '==', false).where('desativadoEm', '<=', sixtyDaysAgo).get();
        if (querySnapshot.empty) { console.log('Nenhum estabelecimento inativo por mais de 60 dias encontrado.'); return null; }
        const longInactiveEstabs = [];
        for (const doc of querySnapshot.docs) { longInactiveEstabs.push(doc.data()); }
        const emailContent = longInactiveEstabs.map(estab => `- ${estab.nome} (ID: ${estab.id}) - Desativado Em: ${estab.desativadoEm ? estab.desativadoEm.toDate().toLocaleDateString('pt-BR') : 'N/A'}`).join('\n');
        const mailOptions = {
            from: `${APP_NAME} <${process.env.MAIL_USER}>`, to: MASTER_ADMIN_EMAIL,
            subject: `⚠️ ALERTA: ${longInactiveEstabs.length} Estabelecimentos Inativos por Muito Tempo - ${APP_NAME}`,
            html: `<p>Olá Master Admin,</p><p>Identificamos ${longInactiveEstabs.length} estabelecimento(s) que estão inativos por mais de ${thresholdDays} dias:</p><pre>${emailContent}</pre><p>Por favor, revise o status desses estabelecimentos.</p><p>Atenciosamente,</p><p>Equipe ${APP_NAME}</p>`,
        };
        await mailTransport.sendMail(mailOptions);
        console.log(`Alerta de inatividade longa enviado para ${MASTER_ADMIN_EMAIL}.`); return null;
    } catch (error) {
        console.error('Erro ao verificar estabelecimentos inativos por muito tempo:', error); return null;
    }
});

// =========================================================================
// Cloud Function: deleteUserByMasterAdmin
// =========================================================================
export const deleteUserByMasterAdmin = onCall(async (data, context) => {
    if (!context.auth) throw new HttpsError('unauthenticated', 'Apenas usuários autenticados podem deletar outros usuários.');
    const callerUid = context.auth.uid;
    const callerDoc = await db.collection('usuarios').doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data()?.isMasterAdmin !== true) {
        throw new HttpsError('permission-denied', 'Apenas o Administrador Master pode deletar usuários.');
    }

    const { targetUid } = data;
    if (!targetUid) throw new HttpsError('invalid-argument', 'O UID do usuário a ser deletado é obrigatório.');
    if (targetUid === callerUid) throw new HttpsError('permission-denied', 'Você não pode deletar sua própria conta.');

    try {
        await auth.deleteUser(targetUid);
        console.log(`Usuário ${targetUid} deletado do Firebase Authentication.`);

        await db.collection('usuarios').doc(targetUid).delete();
        console.log(`Documento do usuário ${targetUid} deletado do Firestore.`);

        const estabQuery = await db.collection('estabelecimentos').where('adminUID', '==', targetUid).get();
        const estabBatch = db.batch();
        estabQuery.forEach(doc => {
            estabBatch.update(doc.ref, { adminUID: null });
            console.log(`Estabelecimento ${doc.id} desvinculado de ${targetUid}.`);
        });
        await estabBatch.commit();
        
        const targetUserDoc = await db.collection('usuarios').doc(targetUid).get();
        const targetUserName = targetUserDoc.exists ? targetUserDoc.data().nome : 'UID Desconhecido';

        const auditLogRef = db.collection('auditLogs').doc();
        await auditLogRef.set({
            timestamp: FieldValue.serverTimestamp(), actionType: 'USUARIO_DELETADO_COMPLETO',
            actor: { uid: callerUid, email: callerDoc.data()?.email || 'N/A', role: 'masterAdmin' },
            target: { type: 'usuario', id: targetUid, name: targetUserName },
            details: { method: 'cloud_function' }
        });

        return { success: true, message: `Usuário ${targetUid} deletado completamente.` };

    } catch (error) {
        console.error(`Erro na Cloud Function deleteUserByMasterAdmin para ${targetUid}:`, error);
        throw new HttpsError('internal', `Falha ao deletar usuário: ${error.message}`);
    }
});


// =========================================================================
// Cloud Function: updateUserCustomClaims
// =========================================================================
export const updateUserCustomClaims = onDocumentUpdated('usuarios/{userId}', async (event) => { // Usando onDocumentUpdated
    const userId = event.params.userId;
    const userData = event.data.after.data();
    const previousUserData = event.data.before.data();

    const rolesChanged = previousUserData.isAdmin !== userData.isAdmin ||
                         previousUserData.isMasterAdmin !== userData.isMasterAdmin;
    
    if (previousUserData.ativo === true && userData.ativo === false) {
        await auth.updateUser(userId, { disabled: true });
        console.log(`Usuário ${userId} desabilitado no Firebase Authentication devido à inatividade.`);
        const auditLogRef = db.collection('auditLogs').doc();
        await auditLogRef.set({
            timestamp: FieldValue.serverTimestamp(), actionType: 'USUARIO_AUTHDISABLED',
            actor: { uid: 'system', email: 'system@example.com', role: 'system_trigger' },
            target: { type: 'usuario', id: userId, name: userData.nome || 'N/A' },
            details: { newStatus: 'disabled_by_system' }
        });
    } else if (previousUserData.ativo === false && userData.ativo === true) {
        await auth.updateUser(userId, { disabled: false });
        console.log(`Usuário ${userId} habilitado no Firebase Authentication devido à reativação.`);
        const auditLogRef = db.collection('auditLogs').doc();
        await auditLogRef.set({
            timestamp: FieldValue.serverTimestamp(), actionType: 'USUARIO_AUTHENABLED',
            actor: { uid: 'system', email: 'system@example.com', role: 'system_trigger' },
            target: { type: 'usuario', id: userId, name: userData.nome || 'N/A' },
            details: { newStatus: 'enabled_by_system' }
        });
    }

    if (rolesChanged || previousUserData.ativo !== userData.ativo) {
        const customClaims = {
            isAdmin: userData.isAdmin || false,
            isMasterAdmin: userData.isMasterAdmin || false,
        };
        await auth.setCustomUserClaims(userId, customClaims);
        console.log(`Custom claims para o usuário ${userId} atualizados para:`, customClaims);
    }
    
    return null;
});

// Gatilho para quando um usuário é criado no Firestore (para definir claims iniciais)
export const onUserCreatedSetClaims = onDocumentCreated('usuarios/{userId}', async (event) => { // Usando onDocumentCreated
    const userId = event.params.userId;
    const userData = event.data.data();

    try {
        const customClaims = {
            isAdmin: userData.isAdmin || false,
            isMasterAdmin: userData.isMasterAdmin || false,
        };
        await auth.setCustomUserClaims(userId, customClaims);
        console.log(`Claims iniciais para o novo usuário ${userId} definidos:`, customClaims);
        return null;
    } catch (error) {
        console.error(`Erro ao definir claims iniciais para o usuário ${userId}:`, error);
        return null;
    }
});