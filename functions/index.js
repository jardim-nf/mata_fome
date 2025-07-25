// functions/index.js

// Imports necessários para as Cloud Functions (usando sintaxe ES Modules)
// Certifique-se de que seu package.json na pasta 'functions' tem "type": "module",
// ou use a sintaxe 'require()' se estiver em CommonJS.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import nodemailer from 'nodemailer'; // Para envio de e-mails
import { onDocumentWritten } from 'firebase-functions/v2/firestore'; // Gatilho para Firestore
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import axios from "axios";
// >>>>> NOVO IMPORT NECESSÁRIO PARA A FUNÇÃO DE WHATSAPP (se for usar API externa como Axios/Twilio) <<<<<
// import axios from 'axios'; // Exemplo: se usar axios para outras APIs de WhatsApp
// const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN); // Exemplo para Twilio (se estiver usando CommonJS ou Babel)

// --- INICIALIZAÇÃO DO FIREBASE ADMIN SDK ---
// Garante que o aplicativo Admin SDK é inicializado uma única vez.
if (!getApps().length) {
    initializeApp();
}

// Inicializa os serviços do Admin SDK
const db = getFirestore();
const auth = getAuth();

// =========================================================================
// Configurações de E-mail para Nodemailer
// Necessário configurar MAIL_USER e MAIL_PASS como variáveis de ambiente nas Cloud Functions:
// Ex: firebase functions:config:set mail.user="seu_email@gmail.com" mail.pass="sua_senha_app_gerada_do_gmail"
// =========================================================================
// **Lembre-se de configurar estas variáveis de ambiente no Firebase:**
// firebase functions:config:set mail.user="seu_email@gmail.com" mail.pass="sua_senha_app_gerada_do_gmail"
const mailTransport = nodemailer.createTransport({
    service: 'gmail', // Ou 'smtp.seuservidor.com' para outros serviços
    auth: {
        user: process.env.MAIL_USER, 
        pass: process.env.MAIL_PASS, 
    },
});

const APP_NAME = 'DeuFome Admin';
// E-mail do Master Admin para receber alertas de sistema. ALTERE ESTE E-MAIL!
const MASTER_ADMIN_EMAIL = 'seu_email_master_admin@exemplo.com'; 

// =========================================================================
// Cloud Function: getEstablishmentPixKey
// Descrição: Permite que admins (Master ou de Estabelecimento) acessem a chave PIX de um estabelecimento.
// A verificação de permissão é feita através das custom claims do token do chamador.
// =========================================================================
export const getEstablishmentPixKey = onCall(async (data, context) => {
    // Apenas usuários autenticados podem chamar esta função
if (!context.auth) {
  throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem enviar mensagens.');
}

    const callerClaims = context.auth.token;
    const isCallerAdmin = callerClaims.isAdmin === true;
    const isCallerMasterAdmin = callerClaims.isMasterAdmin === true;

    // Se o chamador não é nem admin nem master admin, nega o acesso.
    if (!isCallerAdmin && !isCallerMasterAdmin) {
        throw new HttpsError('permission-denied', 'Apenas administradores podem acessar esta função.');
    }

    const establishmentId = data.establishmentId;
    if (!establishmentId) {
        throw new HttpsError('invalid-argument', 'O ID do estabelecimento é obrigatório.');
    }

    const establishmentDoc = await db.collection('estabelecimentos').doc(establishmentId).get();
    if (!establishmentDoc.exists) {
        throw new HttpsError('not-found', 'Estabelecimento não encontrado.');
    }

    const adminUIDDoEstabelecimento = establishmentDoc.data().adminUID;

    // Se o chamador não é Master Admin, deve ser o admin específico do estabelecimento.
    if (adminUIDDoEstabelecimento !== context.auth.uid && !isCallerMasterAdmin) {
        throw new HttpsError('permission-denied', 'Você não tem permissão para acessar a chave PIX deste estabelecimento.');
    }

    const chavePix = establishmentDoc.data().chavePix;
    if (!chavePix) {
        throw new HttpsError('not-found', 'Chave PIX não configurada para este estabelecimento.');
    }

    return { chavePix: chavePix };
});

// =========================================================================
// >>>>> NOVA CLOUD FUNCTION: sendWhatsappMessage <<<<<
// Descrição: Envia uma mensagem via WhatsApp ao cliente quando o pedido muda de status.
// =========================================================================
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import axios from "axios";

export const sendWhatsappMessage = onCall(async (data, context) => {
  logger.info("sendWhatsappMessage: [DEBUG START]");
  logger.info("context.auth:", context.auth ? { uid: context.auth.uid } : "null/undefined");

  const callerClaims = context.auth?.token;
  if (!context.auth) throw new HttpsError("unauthenticated", "Usuário não autenticado.");

  if (!callerClaims?.isAdmin && !callerClaims?.isMasterAdmin) {
    throw new HttpsError("permission-denied", "Apenas administradores podem enviar mensagens.");
  }

  const { to, messageType, clientName, orderValue, orderDateTime, estabelecimentoName, orderIdShort } = data;
  if (!to || !messageType || !clientName || orderValue === undefined || !orderDateTime || !estabelecimentoName || !orderIdShort) {
    throw new HttpsError("invalid-argument", "Dados incompletos para enviar a mensagem.");
  }

  const formattedTo = to.replace(/\D/g, "");
  let messageText = "";

  switch (messageType) {
    case "preparo":
      messageText = `✨ Oi ${clientName}! Seu pedido #${orderIdShort} no *${estabelecimentoName}* (R$ ${orderValue.toFixed(2).replace('.', ',')}) está em preparo. Logo chega! 🚀\n${orderDateTime}`;
      break;
    case "em_entrega":
      messageText = `🚚 ${clientName}, seu pedido #${orderIdShort} no *${estabelecimentoName}* (R$ ${orderValue.toFixed(2).replace('.', ',')}) saiu para entrega!\n${orderDateTime}`;
      break;
    case "finalizado":
      messageText = `🎉 ${clientName}, seu pedido #${orderIdShort} do *${estabelecimentoName}* foi entregue! Obrigado pela preferência! ❤️`;
      break;
    default:
      throw new HttpsError("invalid-argument", "Tipo de mensagem inválido.");
  }

  try {
    // ⚠️ Substitua abaixo com seu endpoint e token da Z-API:
    const ZAPI_INSTANCE_ID = "SUA_INSTANCIA"; // Ex: 123456
    const ZAPI_TOKEN = "SEU_TOKEN"; // Ex: abc123xyz

    const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;

    const response = await axios.post(zapiUrl, {
      phone: `55${formattedTo}`, // DDD + número, sem + ou traços
      message: messageText
    });

    logger.info("Mensagem enviada com sucesso via Z-API:", response.data);
    return { success: true, message: "Mensagem enviada com sucesso." };

  } catch (error) {
    logger.error("Erro ao enviar mensagem via Z-API:", error.response?.data || error.message);
    throw new HttpsError("internal", "Erro ao enviar mensagem via Z-API.");
  }
});

// =========================================================================


// =========================================================================
// Cloud Function: createUserByMasterAdmin
// Descrição: Permite que um Master Admin crie novos usuários no Firebase Auth e Firestore,
// atribuindo papéis (claims) no momento da criação.
// =========================================================================
export const createUserByMasterAdmin = onCall(async (data, context) => {
    console.log("Cloud Function 'createUserByMasterAdmin' chamada.");

    // 1. Verificação de Permissão: Apenas quem já é Master Admin (via claim) pode criar.
    if (!context.auth || context.auth.token.isMasterAdmin !== true) {
        throw new HttpsError('permission-denied', 'Apenas o Administrador Master pode criar novos usuários.');
    }

    // 2. Validação dos Dados Recebidos do frontend
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
            disabled: ativo === false // Define se o usuário começa ativo ou desabilitado no Auth
        });

        // 4. Definir Custom Claims no Firebase Authentication (CRÍTICO para as Regras do Firestore)
        // Essas claims serão usadas pelas regras de segurança do Firestore para autorização.
        const customClaims = {
            isMasterAdmin: isMasterAdmin === true, // Garante que é booleano
            isAdmin: isAdmin === true,             // Garante que é booleano
            isEstabelecimentoAtivo: ativo === true, // <--- ADICIONADO AQUI! Sincroniza 'ativo' do Firestore/Input com a claim
            // Adiciona 'estabelecimentoId' como claim APENAS SE for Admin e gerenciar UM ÚNICO estabelecimento.
            ...(isAdmin === true && estabelecimentosGerenciados && estabelecimentosGerenciados.length > 0
                ? { estabelecimentoId: estabelecimentosGerenciados[0] } // Pega o primeiro ID do array
                : {})
        };
        await auth.setCustomUserClaims(userRecord.uid, customClaims);

        // 5. Criar documento no Firestore (Coleção 'usuarios')
        // Este documento espelha as informações principais do usuário e suas claims para facilitar consultas no front-end.
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
            // Espelha as claims no documento Firestore para facilitar consultas e exibição na UI
            isAdmin: customClaims.isAdmin,
            isMasterAdmin: customClaims.isMasterAdmin,
            ativo: customClaims.isEstabelecimentoAtivo, // Sincroniza com a claim que foi definida
            estabelecimentosGerenciados: estabelecimentosGerenciados || [],
            criadoEm: FieldValue.serverTimestamp(),
        };
        await db.collection('usuarios').doc(userRecord.uid).set(userProfile);

        // 6. Opcional: Criar documento na Coleção 'clientes' (apenas se for um cliente comum)
        if (!isAdmin && !isMasterAdmin) { // Se não é admin nem master admin, é um cliente comum
            await db.collection('clientes').doc(userRecord.uid).set({
                uid: userRecord.uid,
                nome: name.trim(),
                email: email.trim(),
                telefone: phoneNumber && phoneNumber.trim() !== '' ? phoneNumber.trim() : null,
                endereco: userProfile.endereco, // Reutiliza o objeto de endereço já validado
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
// Descrição: Permite que um Master Admin delete um usuário completamente
// (Auth, documentos Firestore e desvincula estabelecimentos).
// =========================================================================
export const deleteUserByMasterAdmin = onCall(async (data, context) => {
    // Apenas usuários autenticados Master Admin podem chamar esta função.
    if (!context.auth) {
        throw new HttpsError('unauthenticated', 'Apenas usuários autenticados podem deletar outros usuários.');
    }
    
    // Verifica se quem chamou é Master Admin (via claim)
    const callerClaims = context.auth.token;
    if (callerClaims.isMasterAdmin !== true) {
        throw new HttpsError('permission-denied', 'Apenas o Administrador Master pode deletar usuários.');
    }

    const { targetUid } = data;
    if (!targetUid) {
        throw new HttpsError('invalid-argument', 'O UID do usuário a ser deletado é obrigatório.');
    }
    // Master Admin não pode deletar sua própria conta através desta função.
    if (targetUid === context.auth.uid) {
        throw new HttpsError('permission-denied', 'Você não pode deletar sua própria conta.');
    }

    try {
        // Obter informações do usuário alvo ANTES de deletar para o log de auditoria
        const targetUserDoc = await db.collection('usuarios').doc(targetUid).get();
        const targetUserName = targetUserDoc.exists ? targetUserDoc.data().nome : 'UID Desconhecido';

        // 1. Deletar usuário do Firebase Authentication
        await auth.deleteUser(targetUid);
        console.log(`Usuário ${targetUid} deletado do Firebase Authentication.`);

        // 2. Deletar documento(s) do Firestore (usuarios e clientes)
        await db.collection('usuarios').doc(targetUid).delete();
        // Tenta deletar da coleção 'clientes', mas não faPausa a função se o documento não existir
        await db.collection('clientes').doc(targetUid).delete().catch(e => console.log("Documento de cliente não existia para deletar: ", e.message)); 
        console.log(`Documento(s) do usuário ${targetUid} deletado(s) do Firestore.`);

        // 3. Desvincular estabelecimentos (se o usuário era admin de algum)
        // Atualiza 'adminUID' para null nos estabelecimentos que eram gerenciados por este usuário.
        const estabQuery = await db.collection('estabelecimentos').where('adminUID', '==', targetUid).get();
        const estabBatch = db.batch();
        estabQuery.forEach(doc => {
            estabBatch.update(doc.ref, { adminUID: null }); 
            console.log(`Estabelecimento ${doc.id} desvinculado de ${targetUid}.`);
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
            }, // Captura a role precisa do Master Admin
            target: { type: 'usuario', id: targetUid, name: targetUserName },
            details: { method: 'cloud_function_delete' } // Detalhe adicional para o log
        });

        return { success: true, message: `Usuário ${targetUid} deletado completamente.` };

    } catch (error) {
        console.error(`Erro na Cloud Function deleteUserByMasterAdmin para ${targetUid}:`, error);
        // Lança um HttpsError para o frontend
        throw new HttpsError('internal', `Falha ao deletar usuário: ${error.message}`);
    }
});

// =========================================================================
// Cloud Function Agendada: checkLatePayments
// Descrição: Verifica diariamente pagamentos atrasados de estabelecimentos.
// Se atrasado, desativa o estabelecimento e envia um e-mail de alerta ao Master Admin.
// =========================================================================
export const checkLatePayments = onSchedule('0 2 * * *', async (context) => { // Executa toda noite às 02:00 (GMT)
    console.log("Executando checkLatePayments agendado...");
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Zera a hora para comparar apenas a data

    try {
        // Busca estabelecimentos ativos cuja próxima data de cobrança já passou
        const querySnapshot = await db.collection('estabelecimentos')
            .where('ativo', '==', true)
            .where('nextBillingDate', '<=', today)
            .get();

        if (querySnapshot.empty) {
            console.log('Nenhum estabelecimento com pagamento atrasado encontrado hoje.');
            return null; // Nenhuma ação necessária
        }

        const latePayments = [];
        const batch = db.batch(); // Usa batch para atualizações eficientes

        for (const doc of querySnapshot.docs) {
            const estabData = doc.data();
            latePayments.push(estabData);

            const estabDocRef = db.collection('estabelecimentos').doc(doc.id);
            // Desativa o estabelecimento e registra a data de desativação
            batch.update(estabDocRef, { ativo: false, desativadoEm: FieldValue.serverTimestamp() });

            // Registrar a ação no log de auditoria do sistema
            const auditLogRef = db.collection('auditLogs').doc();
            batch.set(auditLogRef, {
                timestamp: FieldValue.serverTimestamp(),
                actionType: 'PAGAMENTO_ATRASADO_E_DESATIVADO',
                actor: { uid: 'system', email: 'system@example.com', role: 'system_cron' }, // Ação executada pelo sistema
                target: { type: 'estabelecimento', id: doc.id, name: estabData.nome || 'N/A' },
                details: { 
                    nextBillingDate: estabData.nextBillingDate ? estabData.nextBillingDate.toDate().toISOString() : 'N/A', 
                    newStatus: false 
                }
            });

            // ATENÇÃO: Se o estabelecimento for desativado aqui, você também PRECISA
            // atualizar a custom claim 'isEstabelecimentoAtivo' para 'false' para o adminUID associado a ele.
            // Isso requer uma busca pelo adminUID e uma chamada setCustomUserClaims.
            // Isso é feito na função onDocumentWritten('usuarios/{userId}') quando o campo 'ativo'
            // do documento 'usuarios' é alterado. Se você não tem um campo 'ativo' no 'usuarios'
            // que reflete o 'ativo' do 'estabelecimentos', você precisaria de uma função separada
            // ou de uma forma de notificar 'syncUserClaimsOnWrite' sobre essa mudança.
            // POR ENQUANTO, VAMOS ASSUMIR QUE syncUserClaimsOnWrite (no gatilho de 'usuarios')
            // se encarrega disso se o adminUID for atualizado.
        }

        await batch.commit(); // Executa todas as atualizações em batch

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
        console.log(`Alerta de pagamento atrasado enviado para ${MASTER_ADMIN_EMAIL}.`);
        return null; // Indica sucesso (não retorna dados para o chamador HTTP)

    } catch (error) {
        console.error('Erro na Cloud Function checkLatePayments:', error);
        // Envia um e-mail de erro para o Master Admin se a função falhar
        const errorMailOptions = {
            from: `${APP_NAME} <${process.env.MAIL_USER}>`,
            to: MASTER_ADMIN_EMAIL,
            subject: `❌ ERRO NA CLOUD FUNCTION: checkLatePayments - ${APP_NAME}`,
            html: `<p>Ocorreu um erro na função checkLatePayments: ${error.message}</p><pre>${error.stack}</pre>`,
        };
        await mailTransport.sendMail(errorMailOptions);
        return null; // Indica falha
    }
});

// =========================================================================
// Cloud Function Agendada: alertLongInactiveEstablishments
// Descrição: Alerta o Master Admin sobre estabelecimentos que estão inativos há mais de um período (ex: 60 dias).
// =========================================================================
export const alertLongInactiveEstablishments = onSchedule('0 3 * * 1', async (context) => { // Executa toda segunda-feira às 03:00 (GMT)
    console.log("Executando alertLongInactiveEstablishments agendado...");
    const thresholdDays = 60; // Limite de 60 dias para inatividade
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - thresholdDays);
    sixtyDaysAgo.setHours(0, 0, 0, 0); // Zera hora para comparação de data

    try {
        const querySnapshot = await db.collection('estabelecimentos')
            .where('ativo', '==', false) // Busca estabelecimentos inativos
            .where('desativadoEm', '<=', sixtyDaysAgo) // Que foram desativados antes ou no limite
            .get();

        if (querySnapshot.empty) {
            console.log('Nenhum estabelecimento inativo por mais de 60 dias encontrado.');
            return null; // Nenhuma ação necessária
        }

        const longInactiveEstabs = [];
        for (const doc of querySnapshot.docs) { 
            longInactiveEstabs.push(doc.data()); 
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
        console.log(`Alerta de inatividade longa enviado para ${MASTER_ADMIN_EMAIL}.`);
        return null;

    } catch (error) {
        console.error('Erro ao verificar estabelecimentos inativos por muito tempo:', error);
        return null;
    }
});

// =========================================================================
// Cloud Function: syncUserClaimsOnWrite (Gatilho Firestore)
// Descrição: Dispara sempre que um documento 'usuarios/{userId}' é criado, atualizado ou deletado.
// Sincroniza o status 'disabled' e as custom claims (isAdmin, isMasterAdmin, estabelecimentoId, isEstabelecimentoAtivo)
// no Firebase Authentication para uso nas regras de segurança do Firestore.
// =========================================================================
export const syncUserClaimsOnWrite = onDocumentWritten('usuarios/{userId}', async (event) => {
    const userId = event.params.userId;
    const userDocAfter = event.data?.after.data(); // Estado do documento APÓS a escrita
    const userDocBefore = event.data?.before.data(); // Estado do documento ANTES da escrita

    // CASO 1: Documento do usuário foi DELETADO no Firestore
    // Remove as claims e desabilita o usuário no Auth se o documento Firestore sumir.
    if (!event.data?.after.exists) {
        console.log(`[syncUserClaimsOnWrite] Documento do usuário ${userId} deletado no Firestore. Removendo claims e desabilitando no Auth.`);
        await auth.setCustomUserClaims(userId, null); // Remove todas as custom claims
        await auth.updateUser(userId, { disabled: true }) // Desabilita o usuário no Auth
            .catch(e => console.warn(`[syncUserClaimsOnWrite] Falha ao desabilitar usuário ${userId} no Auth (talvez já desabilitado ou não exista):`, e.message));
        return;
    }

    // CASO 2: Documento foi CRIADO ou ATUALIZADO no Firestore
    const newIsAdmin = userDocAfter.isAdmin || false;
    const newIsMasterAdmin = userDocAfter.isMasterAdmin || false;
    const newEstabelecimentoIdFromDoc = userDocAfter.estabelecimentoId || null;
    const newAtivo = userDocAfter.ativo === true; // Pega o status 'ativo' do documento 'usuarios'

    console.log(`[syncUserClaimsOnWrite] Processing user ${userId}. New data: isAdmin=${newIsAdmin}, isMasterAdmin=${newIsMasterAdmin}, estabId=${newEstabelecimentoIdFromDoc}, ativo=${newAtivo}`);

    // Tenta obter as custom claims ATUAIS do usuário no Firebase Authentication.
    let currentClaims;
    try {
        currentClaims = (await auth.getUser(userId)).customClaims || {};
        console.log(`[syncUserClaimsOnWrite] Current Auth Claims for ${userId}:`, currentClaims);
    } catch (e) {
        // Se o usuário não existe no Auth (raro, mas pode acontecer se foi deletado por fora), encerra.
        console.warn(`[syncUserClaimsOnWrite] Usuário ${userId} não encontrado no Firebase Auth. Não é possível sincronizar claims.`, e.message);
        return; 
    }

    // A) Sincroniza o status 'disabled' no Firebase Authentication com o campo 'ativo' do Firestore.
    const activeStatusChanged = userDocBefore?.ativo !== newAtivo;
    if (activeStatusChanged) {
        await auth.updateUser(userId, { disabled: !newAtivo });
        console.log(`[syncUserClaimsOnWrite] User ${userId} auth disabled status updated to: ${!newAtivo}`);
    }

    // B) Prepara as novas custom claims a serem setadas no token.
    const customClaimsToSet = {
        isAdmin: newIsAdmin,
        isMasterAdmin: newIsMasterAdmin,
        isEstabelecimentoAtivo: newAtivo, // <--- ADICIONADO: A claim 'isEstabelecimentoAtivo' agora é definida aqui!
    };

    // Adiciona 'estabelecimentoId' à claim se for admin de estabelecimento e houver um ID válido
    if (newIsMasterAdmin === false && newIsAdmin === true && newEstabelecimentoIdFromDoc) {
        customClaimsToSet.estabelecimentoId = newEstabelecimentoIdFromDoc;
    }

    // --- LÓGICA DE LIMPEZA DE CLAIMS ANTIGAS ---
    // Remove claims se o papel do usuário for rebaixado ou o estabelecimentoId for removido.
    if (!newIsAdmin && currentClaims.isAdmin) {
        delete customClaimsToSet.isAdmin;
    }
    if (!newIsMasterAdmin && currentClaims.isMasterAdmin) {
        delete customClaimsToSet.isMasterAdmin;
    }
    // Se não é admin de estabelecimento OU o estabelecimentoId foi removido/alterado no documento,
    // e a claim 'estabelecimentoId' existia, remova-a do token.
    if ((!newIsAdmin || !newEstabelecimentoIdFromDoc) && currentClaims.estabelecimentoId) {
        delete customClaimsToSet.estabelecimentoId;
    }
    // Se o status 'ativo' mudou para false, e a claim 'isEstabelecimentoAtivo' existia, remova-a (ou defina como false).
    // Já estamos definindo `isEstabelecimentoAtivo: newAtivo`, então um `delete` aqui só seria útil
    // se quiséssemos remover a claim completamente em vez de defini-la como false.
    // Manter como está, definindo explicitamente `false` é mais consistente.
    
    // C) Verifica se as custom claims *relevantes* mudaram para evitar writes desnecessárias no Auth.
    const claimsRolesChanged = currentClaims.isAdmin !== newIsAdmin || currentClaims.isMasterAdmin !== newIsMasterAdmin;
    const claimsEstabIdChanged = currentClaims.estabelecimentoId !== customClaimsToSet.estabelecimentoId; // Compara com o que será definido
    const claimsEstabAtivoChanged = currentClaims.isEstabelecimentoAtivo !== newAtivo; // <--- Nova verificação de mudança

    // Atualiza as custom claims no token APENAS SE houver mudança nos papéis, no estabelecimentoId da claim,
    // OU no status 'ativo' do estabelecimento, OU se o documento do usuário foi recém-criado no Firestore.
    if (!event.data?.before.exists || claimsRolesChanged || claimsEstabIdChanged || claimsEstabAtivoChanged) {
        try {
            await auth.setCustomUserClaims(userId, customClaimsToSet);
            console.log(`[syncUserClaimsOnWrite] Sucesso! Claims para o usuário ${userId} atualizadas para:`, customClaimsToSet);
            // IMPORTANTE: Revogar o token para que o usuário obtenha o novo token imediatamente
            await auth.revokeRefreshTokens(userId);
            console.log(`[syncUserClaimsOnWrite] Tokens de refresh revogados para ${userId}. O usuário precisará fazer login novamente.`);
        } catch (error) {
            console.error(`[syncUserClaimsOnWrite] Erro ao definir claims para o usuário ${userId}:`, error);
        }
    } else {
        console.log(`[syncUserClaimsOnWrite] Nenhuma mudança de permissão relevante detectada para ${userId}. Claims não serão atualizadas.`);
    }
});