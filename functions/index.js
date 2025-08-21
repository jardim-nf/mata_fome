// functions/index.js

// Imports necessários para as Cloud Functions (usando sintaxe ES Modules)
// Certifique-se de que seu package.json na pasta 'functions' tem "type": "module".
import { onCall, HttpsError } from 'firebase-functions/v2/https'; // Importação principal
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import nodemailer from 'nodemailer'; // Para envio de e-mails
import { onDocumentWritten } from 'firebase-functions/v2/firestore'; // Gatilho para Firestore
import { logger } from "firebase-functions"; // Logger para as funções
import axios from "axios"; // Para fazer requisições HTTP (Z-API)

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
// Nota: com ES Modules, `process.env` nem sempre é a forma preferida para variáveis de ambiente do Functions.
// É mais comum usar `functions.config()`. Se `mail.user` e `mail.pass` forem configurados como `mail.user` e `mail.pass`
// no `functions:config:set`, você os acessaria como `functions.config().mail.user`.
// Por enquanto, mantenho `process.env` como estava no seu código para evitar quebrar a parte de e-mail.
const mailTransport = nodemailer.createTransport({
    service: 'gmail', // Ou 'smtp.seuservidor.com' para outros serviços
    auth: {
        user: process.env.MAIL_USER, // Acessado via process.env se configurado diretamente ou via .env local
        pass: process.env.MAIL_PASS, // Acessado via process.env se configurado diretamente ou via .env local
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
        throw new HttpsError('unauthenticated', 'Apenas usuários autenticados podem acessar esta função.');
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
// >>>>> NOVA CLOUD FUNCTION: sendWhatsappMessage (REVISADA) <<<<<
// Descrição: Envia uma mensagem via WhatsApp ao cliente quando o pedido muda de status.
// =========================================================================
// Nota: Removi a importação duplicada de onCall, HttpsError e axios aqui,
// pois já estão no topo do arquivo.
// import { onCall, HttpsError } from "firebase-functions/v2/https";
// import { logger } from "firebase-functions"; // Já importado acima
// import axios from "axios"; // Já importado acima

export const sendWhatsappMessage = onCall(async (data, context) => {
    logger.info("sendWhatsappMessage: [DEBUG START]");
    logger.info("context.auth:", context.auth ? { uid: context.auth.uid } : "null/undefined");

    // --- 1. Validação de Autenticação e Permissão ---
    const callerClaims = context.auth?.token;
    if (!context.auth) {
        throw new HttpsError("unauthenticated", "Usuário não autenticado.");
    }
    if (!callerClaims?.isAdmin && !callerClaims?.isMasterAdmin) {
        throw new HttpsError("permission-denied", "Apenas administradores podem enviar mensagens de WhatsApp.");
    }

    // --- 2. Acessar as Credenciais da Z-API (Variáveis de Ambiente!) ---
    // Este é o método CORRETO para acessar variáveis de ambiente configuradas via `firebase functions:config:set`
    const ZAPI_INSTANCE_ID = functions.config().zapi?.instance_id;
    const ZAPI_TOKEN = functions.config().zapi?.token;

    // Verificação básica se as credenciais estão configuradas
    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
        logger.error("Credenciais da Z-API não configuradas! Verifique firebase functions:config:set zapi.instance_id e zapi.token");
        throw new HttpsError(
            'failed-precondition',
            'As credenciais da Z-API (instance_id e token) não estão configuradas nas variáveis de ambiente do Firebase Functions.'
        );
    }

    // --- 3. Extrair Dados da Requisição do Frontend ---
    const { to, messageType, clientName, orderValue, orderDateTime, estabelecimentoName, orderIdShort } = data;

    // --- 4. Validação dos Dados Recebidos ---
    if (!to || !messageType || !clientName || orderValue === undefined || !orderDateTime || !estabelecimentoName || !orderIdShort) {
        logger.error("Dados incompletos recebidos para enviar mensagem Z-API:", { to, messageType, clientName, orderValue, orderDateTime, estabelecimentoName, orderIdShort });
        throw new HttpsError("invalid-argument", "Dados incompletos para enviar a mensagem. Verifique os campos obrigatórios.");
    }

    // --- 5. Formatar o Número de Telefone para a Z-API ---
    // Remove todos os caracteres não-numéricos e adiciona o DDI 55 se não estiver presente
    let formattedTo = String(to).replace(/\D/g, '');
    if (!formattedTo.startsWith('55')) {
        // Assume Brasil (DDI 55). Se o número já tem um DDD brasileiro válido (ex: 11, 21),
        // ele será 11 dígitos para celular ou 10 para fixo.
        // Se for 9 digitos, é celular sem DDD. Se for 8, fixo sem DDD.
        // É importante que o 'to' que vem do frontend já seja DDD+NUMERO.
        // Se o seu `to` do frontend já vem com o DDD (ex: "11999999999"), esta lógica está ok.
        // Se ele vem puro (ex: "999999999"), você precisará de uma forma de adicionar o DDD aqui.
        // Por enquanto, presumo que 'to' já tem o DDD (ex: "11987654321").
        formattedTo = `55${formattedTo}`;
    }

    // --- 6. Construir a Mensagem de Texto com base no messageType ---
    let messageText = "";
    const nomeCliente = clientName || 'Cliente';
    const nomeEstabelecimento = estabelecimentoName || 'nosso estabelecimento';
    const idPedidoCurto = orderIdShort ? `#${orderIdShort.toUpperCase()}` : 'do seu pedido';
    const valorPedido = orderValue !== undefined ? `R$ ${orderValue.toFixed(2).replace('.', ',')}` : 'o valor total';


    switch (messageType) {
        case "preparo":
            messageText = `✨ Oi ${nomeCliente}! Seu pedido ${idPedidoCurto} no *${nomeEstabelecimento}* (${valorPedido}) está em preparo. Logo chega! 🚀\nData/Hora do Pedido: ${orderDateTime}`;
            break;
        case "em_entrega":
            messageText = `🚚 ${nomeCliente}, seu pedido ${idPedidoCurto} no *${nomeEstabelecimento}* (${valorPedido}) saiu para entrega!\nData/Hora do Pedido: ${orderDateTime}`;
            break;
        case "finalizado":
            messageText = `🎉 ${nomeCliente}, seu pedido ${idPedidoCurto} do *${nomeEstabelecimento}* (${valorPedido}) foi entregue! Obrigado pela preferência! ❤️`;
            break;
        // Adicione outros cases se houverem outros tipos de mensagem (como 'pagamento_pix_pendente' se o frontend enviar)
        default:
            logger.error(`Tipo de mensagem inválido ou não suportado: ${messageType}`);
            throw new HttpsError("invalid-argument", "Tipo de mensagem inválido ou não suportado.");
    }

    // --- 7. Construir a URL da Z-API ---
    const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;

    // --- 8. Logar Dados para Depuração (MUITO IMPORTANTE!) ---
    logger.info(`[Z-API Debug] Tentando enviar mensagem via Z-API:`);
    logger.info(`  - Instância ID: ${ZAPI_INSTANCE_ID}`);
    logger.info(`  - URL: ${zapiUrl}`);
    logger.info(`  - Telefone Formatado (para Z-API): ${formattedTo}`);
    logger.info(`  - Mensagem Final (para Z-API): "${messageText}"`);
    logger.info(`  - Dados Originais Recebidos do Frontend:`, data); // Útil para ver o que veio do frontend

    // --- 9. Fazer a Requisição POST para a Z-API ---
    try {
        const response = await axios.post(zapiUrl, {
            phone: formattedTo,
            message: messageText
        });

        // --- 10. Logar Sucesso e Retornar Resposta ---
        logger.info("Mensagem enviada com sucesso via Z-API:", response.data);
        return { success: true, message: "Mensagem enviada com sucesso.", zapiResponse: response.data };

    } catch (error) {
        // --- 11. Logar Erro Detalhado e Lançar HttpsError ---
        const errorMessage = error.response?.data?.message || error.message || 'Erro desconhecido ao chamar Z-API.';
        const errorDetails = error.response?.data || error.message;

        logger.error(`[Z-API Error] Erro ao enviar mensagem para ${formattedTo}:`, errorMessage);
        logger.error(`[Z-API Error] Detalhes completos do erro da Z-API:`, errorDetails);

        throw new HttpsError(
            "internal",
            "Erro ao enviar mensagem via Z-API. Verifique os logs do Firebase Functions para mais detalhes.",
            errorDetails // Passa os detalhes do erro para o frontend
        );
    }
});

// =========================================================================


// =========================================================================
// Cloud Function: createUserByMasterAdmin
// Descrição: Permite que um Master Admin crie novos usuários no Firebase Auth e Firestore,
// atribuindo papéis (claims) no momento da criação.
// =========================================================================
export const createUserByMasterAdmin = onCall(async (data, context) => {
    logger.info("Cloud Function 'createUserByMasterAdmin' chamada.");

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
            isEstabelecimentoAtivo: ativo === true, // Sincroniza 'ativo' do Firestore/Input com a claim
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
        logger.info(`Usuário ${targetUid} deletado do Firebase Authentication.`); // Use logger.info

        // 2. Deletar documento(s) do Firestore (usuarios e clientes)
        await db.collection('usuarios').doc(targetUid).delete();
        // Tenta deletar da coleção 'clientes', mas não pausa a função se o documento não existir
        await db.collection('clientes').doc(targetUid).delete().catch(e => logger.warn(`Documento de cliente não existia para deletar: ${e.message}`)); // Use logger.warn
        logger.info(`Documento(s) do usuário ${targetUid} deletado(s) do Firestore.`);

        // 3. Desvincular estabelecimentos (se o usuário era admin de algum)
        // Atualiza 'adminUID' para null nos estabelecimentos que eram gerenciados por este usuário.
        const estabQuery = await db.collection('estabelecimentos').where('adminUID', '==', targetUid).get();
        const estabBatch = db.batch();
        estabQuery.forEach(doc => {
            estabBatch.update(doc.ref, { adminUID: null }); 
            logger.info(`Estabelecimento ${doc.id} desvinculado de ${targetUid}.`); // Use logger.info
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
        logger.error(`Erro na Cloud Function deleteUserByMasterAdmin para ${targetUid}:`, error); // Use logger.error
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
    logger.info("Executando checkLatePayments agendado..."); // Use logger.info
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Zera a hora para comparar apenas a data

    try {
        // Busca estabelecimentos ativos cuja próxima data de cobrança já passou
        const querySnapshot = await db.collection('estabelecimentos')
            .where('ativo', '==', true)
            .where('nextBillingDate', '<=', today)
            .get();

        if (querySnapshot.empty) {
            logger.info('Nenhum estabelecimento com pagamento atrasado encontrado hoje.'); // Use logger.info
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
        logger.info(`Alerta de pagamento atrasado enviado para ${MASTER_ADMIN_EMAIL}.`); // Use logger.info
        return null; // Indica sucesso (não retorna dados para o chamador HTTP)

    } catch (error) {
        logger.error('Erro na Cloud Function checkLatePayments:', error); // Use logger.error
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
    logger.info("Executando alertLongInactiveEstablishments agendado..."); // Use logger.info
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
            logger.info('Nenhum estabelecimento inativo por mais de 60 dias encontrado.'); // Use logger.info
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
        logger.info(`Alerta de inatividade longa enviado para ${MASTER_ADMIN_EMAIL}.`); // Use logger.info
        return null;

    } catch (error) {
        logger.error('Erro ao verificar estabelecimentos inativos por muito tempo:', error); // Use logger.error
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
        logger.info(`[syncUserClaimsOnWrite] Documento do usuário ${userId} deletado no Firestore. Removendo claims e desabilitando no Auth.`); // Use logger.info
        await auth.setCustomUserClaims(userId, null); // Remove todas as custom claims
        await auth.updateUser(userId, { disabled: true }) // Desabilita o usuário no Auth
            .catch(e => logger.warn(`[syncUserClaimsOnWrite] Falha ao desabilitar usuário ${userId} no Auth (talvez já desabilitado ou não exista): ${e.message}`)); // Use logger.warn
        return;
    }

    // CASO 2: Documento foi CRIADO ou ATUALIZADO no Firestore
    const newIsAdmin = userDocAfter.isAdmin || false;
    const newIsMasterAdmin = userDocAfter.isMasterAdmin || false;
    const newEstabelecimentoIdFromDoc = userDocAfter.estabelecimentoId || null;
    const newAtivo = userDocAfter.ativo === true; // Pega o status 'ativo' do documento 'usuarios'

    logger.info(`[syncUserClaimsOnWrite] Processing user ${userId}. New data: isAdmin=${newIsAdmin}, isMasterAdmin=${newIsMasterAdmin}, estabId=${newEstabelecimentoIdFromDoc}, ativo=${newAtivo}`); // Use logger.info

    // Tenta obter as custom claims ATUAIS do usuário no Firebase Authentication.
    let currentClaims;
    try {
        currentClaims = (await auth.getUser(userId)).customClaims || {};
        logger.info(`[syncUserClaimsOnWrite] Current Auth Claims for ${userId}:`, currentClaims); // Use logger.info
    } catch (e) {
        // Se o usuário não existe no Auth (raro, mas pode acontecer se foi deletado por fora), encerra.
        logger.warn(`[syncUserClaimsOnWrite] Usuário ${userId} não encontrado no Firebase Auth. Não é possível sincronizar claims: ${e.message}`); // Use logger.warn
        return; 
    }

    // A) Sincroniza o status 'disabled' no Firebase Authentication com o campo 'ativo' do Firestore.
    const activeStatusChanged = userDocBefore?.ativo !== newAtivo;
    if (activeStatusChanged) {
        await auth.updateUser(userId, { disabled: !newAtivo });
        logger.info(`[syncUserClaimsOnWrite] User ${userId} auth disabled status updated to: ${!newAtivo}`); // Use logger.info
    }

    // B) Prepara as novas custom claims a serem setadas no token.
    const customClaimsToSet = {
        isAdmin: newIsAdmin,
        isMasterAdmin: newIsMasterAdmin,
        isEstabelecimentoAtivo: newAtivo, // A claim 'isEstabelecimentoAtivo' agora é definida aqui!
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
    const claimsEstabAtivoChanged = currentClaims.isEstabelecimentoAtivo !== newAtivo; // Nova verificação de mudança

    // Atualiza as custom claims no token APENAS SE houver mudança nos papéis, no estabelecimentoId da claim,
    // OU no status 'ativo' do estabelecimento, OU se o documento do usuário foi recém-criado no Firestore.
    if (!event.data?.before.exists || claimsRolesChanged || claimsEstabIdChanged || claimsEstabAtivoChanged) {
        try {
            await auth.setCustomUserClaims(userId, customClaimsToSet);
            logger.info(`[syncUserClaimsOnWrite] Sucesso! Claims para o usuário ${userId} atualizadas para:`, customClaimsToSet); // Use logger.info
            // IMPORTANTE: Revogar o token para que o usuário obtenha o novo token imediatamente
            await auth.revokeRefreshTokens(userId);
            logger.info(`[syncUserClaimsOnWrite] Tokens de refresh revogados para ${userId}. O usuário precisará fazer login novamente.`); // Use logger.info
        } catch (error) {
            logger.error(`[syncUserClaimsOnWrite] Erro ao definir claims para o usuário ${userId}:`, error); // Use logger.error
        }
    } else {
        logger.info(`[syncUserClaimsOnWrite] Nenhuma mudança de permissão relevante detectada para ${userId}. Claims não serão atualizadas.`); // Use logger.info
    }
});

//=========================================================================
// >>>>> NOVA CLOUD FUNCTION: calculateCashbackOnOrderFinalized (Gatilho Firestore) <<<<<
// Descrição: Concede cashback ao cliente quando um pedido é marcado como 'finalizado'.
//=========================================================================
export const calculateCashbackOnOrderFinalized = onDocumentWritten('pedidos/{pedidoId}', async (event) => {
    const pedidoDepois = event.data?.after.data();
    const pedidoAntes = event.data?.before.data();

    // A função só executa se o status mudou para 'finalizado'
    if (pedidoDepois?.status === 'finalizado' && pedidoAntes?.status !== 'finalizado') {
        const clienteId = pedidoDepois.clienteId;
        const valorTotal = pedidoDepois.valorTotal;
        const estabelecimentoId = pedidoDepois.estabelecimentoId;

        if (!clienteId || !valorTotal || !estabelecimentoId) {
            logger.error('Pedido finalizado sem clienteId, valorTotal ou estabelecimentoId.', { pedidoId: event.params.pedidoId });
            return;
        }

        try {
            // Pega a porcentagem de cashback do estabelecimento
            const estabDoc = await db.collection('estabelecimentos').doc(estabelecimentoId).get();
            const cashbackPercent = estabDoc.data()?.cashbackPercent || 0; // Ex: 5 para 5%

            if (cashbackPercent <= 0) {
                logger.info(`Cashback não ativado para o estabelecimento ${estabelecimentoId}.`);
                return;
            }

            const cashbackAmount = (valorTotal * cashbackPercent) / 100;

            const clienteRef = db.collection('clientes').doc(clienteId);

            // Adiciona o cashback ao saldo do cliente
            await clienteRef.update({
                cashbackBalance: FieldValue.increment(cashbackAmount),
                lastCashbackEarned: FieldValue.serverTimestamp()
            });

            logger.info(`Cashback de R$${cashbackAmount.toFixed(2)} concedido ao cliente ${clienteId} pelo pedido ${event.params.pedidoId}.`);

        } catch (error) {
            logger.error(`Erro ao conceder cashback para o cliente ${clienteId}:`, error);
        }
    }
});


// =========================================================================
// >>>>> NOVA CLOUD FUNCTION: useCashbackOnNewOrder (Chamável) <<<<<
// Descrição: Permite que um cliente autenticado use seu saldo de cashback em um novo pedido.
// =========================================================================
export const useCashbackOnNewOrder = onCall(async (data, context) => {
    if (!context.auth) {
        throw new HttpsError('unauthenticated', 'Apenas clientes autenticados podem usar cashback.');
    }

    const { orderId, amountToUse } = data;
    const clienteId = context.auth.uid;

    if (!orderId || typeof amountToUse !== 'number' || amountToUse <= 0) {
        throw new HttpsError('invalid-argument', 'ID do pedido e valor a ser usado são obrigatórios.');
    }

    const clienteRef = db.collection('clientes').doc(clienteId);
    const pedidoRef = db.collection('pedidos').doc(orderId);

    try {
        await db.runTransaction(async (transaction) => {
            const clienteDoc = await transaction.get(clienteRef);
            const pedidoDoc = await transaction.get(pedidoRef);

            if (!clienteDoc.exists) {
                throw new HttpsError('not-found', 'Cliente não encontrado.');
            }
            if (!pedidoDoc.exists) {
                throw new HttpsError('not-found', 'Pedido não encontrado.');
            }

            const cashbackBalance = clienteDoc.data().cashbackBalance || 0;
            const valorTotalPedido = pedidoDoc.data().valorTotal || 0;

            if (amountToUse > cashbackBalance) {
                throw new HttpsError('failed-precondition', 'Saldo de cashback insuficiente.');
            }

            if (amountToUse > valorTotalPedido) {
                throw new HttpsError('failed-precondition', 'O valor do cashback não pode ser maior que o valor do pedido.');
            }

            // Subtrai o cashback do saldo do cliente
            transaction.update(clienteRef, {
                cashbackBalance: FieldValue.increment(-amountToUse)
            });

            // Aplica o desconto no pedido e registra o uso do cashback
            transaction.update(pedidoRef, {
                valorTotal: FieldValue.increment(-amountToUse),
                cashbackUsed: amountToUse,
                desconto: FieldValue.increment(amountToUse)
            });
        });

        logger.info(`Cliente ${clienteId} usou R$${amountToUse.toFixed(2)} de cashback no pedido ${orderId}.`);
        return { success: true, message: 'Cashback aplicado com sucesso!' };

    } catch (error) {
        logger.error(`Erro ao aplicar cashback para o cliente ${clienteId} no pedido ${orderId}:`, error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', 'Ocorreu um erro ao tentar aplicar o cashback.');
    }
});

// functions/index.js

// ... (todas as suas outras importações e funções)


// =========================================================================
// >>>>> NOVA FUNÇÃO OTIMIZADA: createOrderWithCashback (Chamável) <<<<<
// Descrição: Cria o pedido e debita o cashback do cliente em uma única operação (transação).
// =========================================================================
export const createOrderWithCashback = onCall(async (data, context) => {
    // 1. Validação de Autenticação
    if (!context.auth) {
        throw new HttpsError('unauthenticated', 'Apenas usuários autenticados podem criar pedidos.');
    }
    const clienteId = context.auth.uid;
    const { cashbackUsado, ...pedidoData } = data; // Separa o cashback do resto dos dados

    try {
        let newOrderId;
        let newOrderIdShort;

        // 2. Executa uma Transação do Firestore
        // Isso garante que ou TUDO funciona, ou NADA é salvo.
        await db.runTransaction(async (transaction) => {
            const clienteRef = db.collection('clientes').doc(clienteId);
            const clienteDoc = await transaction.get(clienteRef);

            if (!clienteDoc.exists) {
                throw new HttpsError('not-found', 'Dados do cliente não encontrados.');
            }

            // 3. Verifica o saldo de cashback (se for usar)
            if (cashbackUsado > 0) {
                const cashbackBalance = clienteDoc.data().cashbackBalance || 0;
                if (cashbackUsado > cashbackBalance) {
                    throw new HttpsError('failed-precondition', 'Saldo de cashback insuficiente.');
                }
                // Debita o cashback do saldo do cliente
                transaction.update(clienteRef, {
                    cashbackBalance: FieldValue.increment(-cashbackUsado)
                });
            }

            // 4. Cria o novo pedido
            const pedidoRef = db.collection('pedidos').doc(); // Cria uma referência com ID automático
            newOrderId = pedidoRef.id;
            newOrderIdShort = newOrderId.substring(0, 5); // ID curto para o cliente

            transaction.set(pedidoRef, {
                ...pedidoData, // Todos os dados do pedido vindos do frontend
                clienteId: clienteId, // Garante o ID do usuário autenticado
                status: 'pendente',
                timestamp: FieldValue.serverTimestamp(),
                orderIdShort: newOrderIdShort
            });
        });

        // 5. Retorna sucesso
        logger.info(`Pedido ${newOrderId} criado com sucesso para o cliente ${clienteId}, usando ${cashbackUsado} de cashback.`);
        return { success: true, orderId: newOrderId, orderIdShort: newOrderIdShort };

    } catch (error) {
        logger.error(`Erro na transação createOrderWithCashback para o cliente ${clienteId}:`, error);
        if (error instanceof HttpsError) {
            throw error; // Re-lança o erro específico para o frontend
        }
        throw new HttpsError('internal', 'Ocorreu um erro ao criar seu pedido. Tente novamente.');
    }
});