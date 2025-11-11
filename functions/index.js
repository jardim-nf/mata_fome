// functions/index.js - VERSÃO COM NOMES PADRONIZADOS
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

const corsHandler = cors({
  origin: ['https://appdeufome.netlify.app', 'http://localhost:5173'],
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

export const createUserByMasterAdminHttp = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
      const { nome, email, senha, estabelecimentos, isAdmin, isMasterAdmin } = req.body;

      if (!email || !senha) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
      }

      const userRecord = await auth.createUser({
        email,
        password: senha,
        displayName: nome || '',
      });

      // ✅ CORREÇÃO: Usando 'estabelecimentosGerenciados' para claims
      await auth.setCustomUserClaims(userRecord.uid, {
        isAdmin: !!isAdmin,
        isMasterAdmin: !!isMasterAdmin,
        estabelecimentosGerenciados: estabelecimentos || [], // Nome padronizado
      });

      // Salva no Firestore
      await db.collection('usuarios').doc(userRecord.uid).set({
        nome,
        email,
        estabelecimentosGerenciados: estabelecimentos || [], 
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
      
      const claimsData = {
        isAdmin: userData.isAdmin || false,
        isMasterAdmin: userData.isMasterAdmin || false,
        // ✅ CORREÇÃO: Usando 'estabelecimentosGerenciados' como campo de claim
        estabelecimentosGerenciados: userData.estabelecimentosGerenciados || userData.estabelecimentos || []
      };

      await auth.setCustomUserClaims(userId, claimsData);
      console.log(`✅ Claims sincronizadas para usuário: ${userId}`, claimsData);

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

export const onUserUpdateSyncClaims = onDocumentWritten('usuarios/{userId}', async (event) => {
  const userId = event.params.userId;
  
  const userData = event.data?.after.data();
  
  if (!userData) {
    console.log(`📝 Documento do usuário ${userId} foi deletado. Claims não foram alteradas.`);
    return null;
  }
  
  const oldUserData = event.data?.before.data();

  const newClaims = {
    isAdmin: userData.isAdmin || false,
    isMasterAdmin: userData.isMasterAdmin || false,
    // ✅ CORREÇÃO: Usando 'estabelecimentosGerenciados' como campo de claim
    estabelecimentosGerenciados: userData.estabelecimentosGerenciados || userData.estabelecimentos || []
  };
  
  const oldClaims = {
    isAdmin: oldUserData?.isAdmin || false,
    isMasterAdmin: oldUserData?.isMasterAdmin || false,
    // ✅ CORREÇÃO: Usando 'estabelecimentosGerenciados' como campo de claim
    estabelecimentosGerenciados: oldUserData?.estabelecimentosGerenciados || oldUserData?.estabelecimentos || []
  };

  if (
    newClaims.isAdmin === oldClaims.isAdmin &&
    newClaims.isMasterAdmin === oldClaims.isMasterAdmin &&
    JSON.stringify(newClaims.estabelecimentosGerenciados) === JSON.stringify(oldClaims.estabelecimentosGerenciados)
  ) {
    console.log(`🔄 Claims para ${userId} não mudaram. Sincronização pulada.`);
    return null;
  }
  
  try {
    console.log(`🔄 Sincronizando claims automaticamente para usuário: ${userId}`);
    
    await auth.setCustomUserClaims(userId, newClaims);

    console.log(`✅ Claims atualizadas automaticamente para: ${userId}`, newClaims);
    
    return null;
  } catch (error) {
    console.error('❌ Erro na sincronização automática:', error);
    return null;
  }
});

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