// functions/index.js

// Imports necessários para as Cloud Functions (usando sintaxe ES Modules)
import { onCall, HttpsError } from 'firebase-functions/v2/https'; // Importação principal para funções chamáveis
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onSchedule } from 'firebase-functions/v2/scheduler'; // Importação para funções agendadas
import nodemailer from 'nodemailer'; // Para envio de e-mails
import { logger } from "firebase-functions"; // Logger para as funções

// --- INICIALIZAÇÃO DO FIREBASE ADMIN SDK ---
// Garante que o aplicativo Admin SDK é inicializado uma única vez.
if (!getApps().length) {
    initializeApp();
}

// Inicializa os serviços do Admin SDK
const db = getFirestore();
const auth = getAuth();

// =========================================================================
// Configurações de E-mail para Nodemailer (Necessário para funções agendadas)
// Necessário configurar MAIL_USER e MAIL_PASS como variáveis de ambiente nas Cloud Functions:
// Ex: firebase functions:config:set mail.user="seu_email@gmail.com" mail.pass="sua_senha_app_gerada_do_gmail"
// =========================================================================
const mailTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_USER, // Acessado via process.env
        pass: process.env.MAIL_PASS, // Acessado via process.env
    },
});

const APP_NAME = 'DeuFome Admin';
// E-mail do Master Admin para receber alertas de sistema. ALTERE ESTE E-MAIL!
const MASTER_ADMIN_EMAIL = 'seu_email_master_admin@exemplo.com'; 

// =========================================================================
// Cloud Function: createUserByMasterAdmin
// =========================================================================
export const createUserByMasterAdmin = onCall(async (data, context) => {
    logger.info("Cloud Function 'createUserByMasterAdmin' chamada.");

    // 1. Verificação de Permissão: Apenas quem já é Master Admin (via claim) pode criar.
    if (!context.auth || context.auth.token.isMasterAdmin !== true) {
        throw new HttpsError('permission-denied', 'Apenas o Administrador Master pode criar novos usuários.');
    }

    // 2. Validação dos Dados Recebidos
    const { email, password, name, phoneNumber, addressStreet, addressNumber, addressNeighborhood, addressCity, addressComplement, isAdmin, isMasterAdmin, ativo, estabelecimentosGerenciados } = data;

    if (!email || !password || !name || password.length < 6) {
        throw new HttpsError('invalid-argument', 'Email, Senha (mín. 6 caracteres) e Nome são obrigatórios.');
    }

    try {
        // 3. Criar usuário no Firebase Authentication
        const userRecord = await auth.createUser({
            email: email,
            password: password,
            displayName: name,
            disabled: ativo === false
        });

        // 4. Definir Custom Claims no Firebase Authentication
        const customClaims = {
            isMasterAdmin: isMasterAdmin === true, 
            isAdmin: isAdmin === true,            
            isEstabelecimentoAtivo: ativo === true, 
            ...(isAdmin === true && estabelecimentosGerenciados && estabelecimentosGerenciados.length > 0
                ? { estabelecimentoId: estabelecimentosGerenciados[0] } 
                : {})
        };
        await auth.setCustomUserClaims(userRecord.uid, customClaims);

        // 5. Criar documento no Firestore (Coleção 'usuarios')
        const userProfile = {
            uid: userRecord.uid,
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
            isAdmin: customClaims.isAdmin,
            isMasterAdmin: customClaims.isMasterAdmin,
            ativo: customClaims.isEstabelecimentoAtivo, 
            estabelecimentosGerenciados: estabelecimentosGerenciados || [],
            criadoEm: FieldValue.serverTimestamp(),
        };
        await db.collection('usuarios').doc(userRecord.uid).set(userProfile);

        // 6. Opcional: Criar documento na Coleção 'clientes'
        if (!isAdmin && !isMasterAdmin) { 
            await db.collection('clientes').doc(userRecord.uid).set({
                uid: userRecord.uid,
                nome: name.trim(),
                email: email.trim(),
                telefone: phoneNumber && phoneNumber.trim() !== '' ? phoneNumber.trim() : null,
                endereco: userProfile.endereco,
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
// Cloud Function: deleteUserByMasterAdmin
// =========================================================================
export const deleteUserByMasterAdmin = onCall(async (data, context) => {
    if (!context.auth) {
        throw new HttpsError('unauthenticated', 'Apenas usuários autenticados podem deletar outros usuários.');
    }
    
    const callerClaims = context.auth.token;
    if (callerClaims.isMasterAdmin !== true) {
        throw new HttpsError('permission-denied', 'Apenas o Administrador Master pode deletar usuários.');
    }

    const { targetUid } = data;
    if (!targetUid) {
        throw new HttpsError('invalid-argument', 'O UID do usuário a ser deletado é obrigatório.');
    }
    if (targetUid === context.auth.uid) {
        throw new HttpsError('permission-denied', 'Você não pode deletar sua própria conta.');
    }

    try {
        const targetUserDoc = await db.collection('usuarios').doc(targetUid).get();
        const targetUserName = targetUserDoc.exists ? targetUserDoc.data().nome : 'UID Desconhecido';

        // 1. Deletar usuário do Firebase Authentication
        await auth.deleteUser(targetUid);
        logger.info(`Usuário ${targetUid} deletado do Firebase Authentication.`); 

        // 2. Deletar documento(s) do Firestore (usuarios e clientes)
        await db.collection('usuarios').doc(targetUid).delete();
        await db.collection('clientes').doc(targetUid).delete().catch(e => logger.warn(`Documento de cliente não existia para deletar: ${e.message}`)); 
        logger.info(`Documento(s) do usuário ${targetUid} deletado(s) do Firestore.`);

        // 3. Desvincular estabelecimentos
        const estabQuery = await db.collection('estabelecimentos').where('adminUID', '==', targetUid).get();
        const estabBatch = db.batch();
        estabQuery.forEach(doc => {
            estabBatch.update(doc.ref, { adminUID: null }); 
            logger.info(`Estabelecimento ${doc.id} desvinculado de ${targetUid}.`); 
        });
        await estabBatch.commit();
        
        // 4. Registrar a ação em AuditLogs
        const auditLogRef = db.collection('auditLogs').doc();
        await auditLogRef.set({
            timestamp: FieldValue.serverTimestamp(),
            actionType: 'USUARIO_DELETADO_COMPLETO',
            actor: { 
                uid: context.auth.uid, 
                email: callerClaims.email || 'N/A', 
                role: callerClaims.isMasterAdmin ? 'masterAdmin' : (callerClaims.isAdmin ? 'admin' : 'user') 
            }, 
            target: { type: 'usuario', id: targetUid, name: targetUserName },
            details: { method: 'cloud_function_delete' } 
        });

        return { success: true, message: `Usuário ${targetUid} deletado completamente.` };

    } catch (error) {
        logger.error(`Erro na Cloud Function deleteUserByMasterAdmin para ${targetUid}:`, error); 
        throw new HttpsError('internal', `Falha ao deletar usuário: ${error.message}`);
    }
});

// =========================================================================
// Cloud Function Agendada: checkLatePayments
// =========================================================================
export const checkLatePayments = onSchedule('0 2 * * *', async (context) => { // Executa toda noite às 02:00 (GMT)
    logger.info("Executando checkLatePayments agendado..."); 
    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    try {
        // Busca estabelecimentos ativos cuja próxima data de cobrança já passou
        const querySnapshot = await db.collection('estabelecimentos')
            .where('ativo', '==', true)
            .where('nextBillingDate', '<=', today)
            .get();

        if (querySnapshot.empty) {
            logger.info('Nenhum estabelecimento com pagamento atrasado encontrado hoje.'); 
            return null; 
        }

        const latePayments = [];
        const batch = db.batch(); 

        for (const doc of querySnapshot.docs) {
            const estabData = doc.data();
            latePayments.push({ id: doc.id, ...estabData }); // Inclui o ID aqui

            const estabDocRef = db.collection('estabelecimentos').doc(doc.id);
            // Desativa o estabelecimento e registra a data de desativação
            batch.update(estabDocRef, { ativo: false, desativadoEm: FieldValue.serverTimestamp() });

            // Registrar a ação no log de auditoria do sistema
            const auditLogRef = db.collection('auditLogs').doc();
            batch.set(auditLogRef, {
                timestamp: FieldValue.serverTimestamp(),
                actionType: 'PAGAMENTO_ATRASADO_E_DESATIVADO',
                actor: { uid: 'system', email: 'system@example.com', role: 'system_cron' }, 
                target: { type: 'estabelecimento', id: doc.id, name: estabData.nome || 'N/A' },
                details: { 
                    nextBillingDate: estabData.nextBillingDate ? estabData.nextBillingDate.toDate().toISOString() : 'N/A', 
                    newStatus: false 
                }
            });
        }

        await batch.commit(); 

        // Envio de e-mail de alerta para o Master Admin
        const emailContent = latePayments.map(estab =>
            `- ${estab.nome} (ID: ${estab.id}) - Vencimento: ${estab.nextBillingDate ? estab.nextBillingDate.toDate().toLocaleDateString('pt-BR') : 'N/A'}`
        ).join('\n');

        const mailOptions = {
            from: `${APP_NAME} <${process.env.MAIL_USER}>`,
            to: MASTER_ADMIN_EMAIL,
            subject: `🚨 ALERTA: ${latePayments.length} Pagamento(s) Atrasado(s) - ${APP_NAME}`,
            html: `<p>Olá Master Admin,</p>
                    <p>Identificamos ${latePayments.length} estabelecimento(s) com pagamento atrasado:</p>
                    <pre>${emailContent}</pre>
                    <p>Os estabelecimentos foram desativados automaticamente.</p>
                    <p>Por favor, tome as medidas necessárias.</p>
                    <p>Atenciosamente,<br>Equipe ${APP_NAME}</p>`,
        };
        await mailTransport.sendMail(mailOptions);
        logger.info(`Alerta de pagamento atrasado enviado para ${MASTER_ADMIN_EMAIL}.`); 
        return null; 

    } catch (error) {
        logger.error('Erro na Cloud Function checkLatePayments:', error); 
        const errorMailOptions = {
            from: `${APP_NAME} <${process.env.MAIL_USER}>`,
            to: MASTER_ADMIN_EMAIL,
            subject: `❌ ERRO NA CLOUD FUNCTION: checkLatePayments - ${APP_NAME}`,
            html: `<p>Ocorreu um erro na função checkLatePayments: ${error.message}</p><pre>${error.stack}</pre>`,
        };
        await mailTransport.sendMail(errorMailOptions);
        return null; 
    }
});

// =========================================================================
// Cloud Function Agendada: alertLongInactiveEstablishments
// =========================================================================
export const alertLongInactiveEstablishments = onSchedule('0 3 * * 1', async (context) => { // Executa toda segunda-feira às 03:00 (GMT)
    logger.info("Executando alertLongInactiveEstablishments agendado..."); 
    const thresholdDays = 60; // Limite de 60 dias para inatividade
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - thresholdDays);
    sixtyDaysAgo.setHours(0, 0, 0, 0); 

    try {
        const querySnapshot = await db.collection('estabelecimentos')
            .where('ativo', '==', false) // Busca estabelecimentos inativos
            .where('desativadoEm', '<=', sixtyDaysAgo) // Que foram desativados antes ou no limite
            .get();

        if (querySnapshot.empty) {
            logger.info('Nenhum estabelecimento inativo por mais de 60 dias encontrado.'); 
            return null; 
        }

        const longInactiveEstabs = [];
        for (const doc of querySnapshot.docs) { 
            longInactiveEstabs.push({ id: doc.id, ...doc.data() }); // Inclui o ID
        }

        // Prepara o conteúdo do e-mail
        const emailContent = longInactiveEstabs.map(estab =>
            `- ${estab.nome} (ID: ${estab.id}) - Desativado Em: ${estab.desativadoEm ? estab.desativadoEm.toDate().toLocaleDateString('pt-BR') : 'N/A'}`
        ).join('\n');

        const mailOptions = {
            from: `${APP_NAME} <${process.env.MAIL_USER}>`,
            to: MASTER_ADMIN_EMAIL,
            subject: `⚠️ ALERTA: ${longInactiveEstabs.length} Estabelecimentos Inativos por Muito Tempo - ${APP_NAME}`,
            html: `<p>Olá Master Admin,</p>
                    <p>Identificamos ${longInactiveEstabs.length} estabelecimento(s) que estão inativos por mais de ${thresholdDays} dias:</p>
                    <pre>${emailContent}</pre>
                    <p>Por favor, revise o status desses estabelecimentos.</p>
                    <p>Atenciosamente,<br>Equipe ${APP_NAME}</p>`,
        };
        await mailTransport.sendMail(mailOptions);
        logger.info(`Alerta de inatividade longa enviado para ${MASTER_ADMIN_EMAIL}.`); 
        return null;

    } catch (error) {
        logger.error('Erro ao verificar estabelecimentos inativos por muito tempo:', error); 
        return null;
    }
});