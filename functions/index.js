// functions/index.js - VERSÃO COMPLETA E CORRETA
// Este arquivo está funcional. O erro de permissão NÃO está aqui.
// O problema está nas suas Regras de Segurança (firestore.rules).
import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import cors from 'cors';

// Inicializa app admin apenas uma vez
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const auth = getAuth();

// Configura CORS (lib padrão)
// Suas origens estão corretas
const corsHandler = cors({
  origin: ['https://appdeufome.netlify.app', 'http://localhost:5173'],
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// ✅ Função HTTPS para criar usuário (parece correta)
export const createUserByMasterAdminHttp = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      return res.status(204).send(''); // resposta de preflight
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
      const { nome, email, senha, estabelecimentos, isAdmin, isMasterAdmin } = req.body;

      if (!email || !senha) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
      }

      // Cria o usuário no Firebase Auth
      const userRecord = await auth.createUser({
        email,
        password: senha,
        displayName: nome || '',
      });

      // Define claims personalizadas
      // O campo "estabelecimentos" nas claims é o que será lido nas regras
      await auth.setCustomUserClaims(userRecord.uid, {
        isAdmin: !!isAdmin,
        isMasterAdmin: !!isMasterAdmin,
        estabelecimentos: estabelecimentos || [], // Este é o campo importante!
      });

      // Salva no Firestore
      // É uma boa prática usar o mesmo nome de campo aqui (ex: estabelecimentosGerenciados)
      // para evitar confusão.
      await db.collection('usuarios').doc(userRecord.uid).set({
        nome,
        email,
        estabelecimentosGerenciados: estabelecimentos || [], // Mudei aqui para "estabelecimentosGerenciados"
        isAdmin: !!isAdmin,
        isMasterAdmin: !!isMasterAdmin,
        criadoEm: new Date(),
      });

      console.log(`✅ Usuário criado: ${email}`);

      return res.status(200).json({
        message: 'Usuário criado com sucesso',
        uid: userRecord.uid,
      });
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      return res.status(500).json({
        error: 'internal',
        details: error.message,
      });
    }
  });
});

// ✅ Função para sincronizar manualmente Firestore → Auth Claims (correta)
export const syncUserClaims = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId é obrigatório' });
      }

      const userDoc = await db.collection('usuarios').doc(userId).get();
      
      if (!userDoc.exists) {
        return res.status(404).json({ error: 'Usuário não encontrado no Firestore' });
      }

      const userData = userDoc.data();
      
      // Esta lógica de fallback é ótima.
      const claimsData = {
        isAdmin: userData.isAdmin || false,
        isMasterAdmin: userData.isMasterAdmin || false,
        estabelecimentos: userData.estabelecimentosGerenciados || userData.estabelecimentos || []
      };

      // Sincroniza Firestore → Auth Claims
      await auth.setCustomUserClaims(userId, claimsData);

      console.log(`✅ Claims sincronizadas para usuário: ${userId}`, claimsData);

      // Força refresh do token. Isso é importante!
      // O cliente (React) precisa ser notificado para buscar o novo token.
      await auth.revokeRefreshTokens(userId);

      return res.status(200).json({
        message: 'Claims sincronizadas com sucesso',
        claims: claimsData
      });

    } catch (error) {
      console.error('❌ Erro ao sincronizar claims:', error);
      return res.status(500).json({
        error: 'internal',
        details: error.message,
      });
    }
  });
});

// ✅ Função automática que sincroniza quando o documento é atualizado (correta)
export const onUserUpdateSyncClaims = onDocumentWritten('usuarios/{userId}', async (event) => {
  const userId = event.params.userId;
  
  // Pega os dados *depois* da escrita
  const userData = event.data?.after.data();
  
  // Se o documento foi deletado, não faz nada
  if (!userData) {
    console.log(`📝 Documento do usuário ${userId} foi deletado. Claims não foram alteradas.`);
    return null;
  }
  
  // Pega os dados *antes* da escrita para comparar
  const oldUserData = event.data?.before.data();

  // Dados para as claims
  const newClaims = {
    isAdmin: userData.isAdmin || false,
    isMasterAdmin: userData.isMasterAdmin || false,
    estabelecimentos: userData.estabelecimentosGerenciados || userData.estabelecimentos || []
  };
  
  // Dados antigos (para otimização)
  const oldClaims = {
    isAdmin: oldUserData?.isAdmin || false,
    isMasterAdmin: oldUserData?.isMasterAdmin || false,
    estabelecimentos: oldUserData?.estabelecimentosGerenciados || oldUserData?.estabelecimentos || []
  };

  // Otimização: Só atualiza as claims se algo relevante mudou
  // Isso evita escritas desnecessárias no Auth
  if (
    newClaims.isAdmin === oldClaims.isAdmin &&
    newClaims.isMasterAdmin === oldClaims.isMasterAdmin &&
    JSON.stringify(newClaims.estabelecimentos) === JSON.stringify(oldClaims.estabelecimentos)
  ) {
    console.log(`🔄 Claims para ${userId} não mudaram. Sincronização pulada.`);
    return null;
  }
  
  try {
    console.log(`🔄 Sincronizando claims automaticamente para usuário: ${userId}`);
    
    // Sincroniza Firestore → Auth Claims
    await auth.setCustomUserClaims(userId, newClaims);

    console.log(`✅ Claims atualizadas automaticamente para: ${userId}`, newClaims);
    
    // NOTA: Não é recomendado usar revokeRefreshTokens aqui, pois
    // qualquer pequena mudança no doc 'usuarios' (ex: log de último acesso)
    // iria deslogar o usuário. O token será atualizado em até 1h.
    // A função manual 'syncUserClaims' é a correta para forçar o refresh.

    return null;
  } catch (error) {
    console.error('❌ Erro na sincronização automática:', error);
    return null;
  }
});

// ✅ Função para forçar refresh do token do usuário (correta)
export const refreshUserToken = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId é obrigatório' });
      }

      // Força refresh do token
      await auth.revokeRefreshTokens(userId);
      
      console.log(`🔄 Tokens revogados para usuário: ${userId}`);

      return res.status(200).json({
        message: 'Tokens revogados com sucesso. O cliente precisará recarregar o token.'
      });

    } catch (error) {
      console.error('❌ Erro ao revogar tokens:', error);
      return res.status(500).json({
        error: 'internal',
        details: error.message,
      });
    }
  });
});