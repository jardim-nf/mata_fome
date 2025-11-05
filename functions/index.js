import { onRequest } from 'firebase-functions/v2/https';
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
const corsHandler = cors({
  origin: ['https://appdeufome.netlify.app', 'http://localhost:5173'],
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// ✅ Função HTTPS com CORS resolvido
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
      await auth.setCustomUserClaims(userRecord.uid, {
        isAdmin: !!isAdmin,
        isMasterAdmin: !!isMasterAdmin,
        estabelecimentos: estabelecimentos || [],
      });

      // Salva no Firestore
      await db.collection('usuarios').doc(userRecord.uid).set({
        nome,
        email,
        estabelecimentos: estabelecimentos || [],
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
