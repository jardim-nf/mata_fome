// Imports principais
import * as functions from 'firebase-functions';
import { onRequest, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import axios from 'axios';
import cors from 'cors';

// Inicializa o Firebase Admin (somente uma vez)
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const auth = getAuth();

// Configura o CORS (apenas para seu domínio de produção)
const corsHandler = cors({
  origin: ['https://appdeufome.netlify.app'],
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// ======================================================
// 🔹 CREATE USER BY MASTER ADMIN (via HTTP + CORS)
// ======================================================
export const createUserByMasterAdmin = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    // Apenas método POST é permitido
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido. Use POST.' });
    }

    try {
      const {
        email,
        password,
        name,
        isAdmin,
        ativo,
        estabelecimentosGerenciados,
      } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
      }

      // Cria o usuário no Firebase Authentication
      const userRecord = await auth.createUser({
        email,
        password,
        displayName: name,
      });

      // Define custom claims para o novo usuário
      await auth.setCustomUserClaims(userRecord.uid, {
        isAdmin: !!isAdmin,
        isMasterAdmin: false,
      });

      // Adiciona os dados do usuário no Firestore
      await db.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        email,
        name,
        isAdmin: !!isAdmin,
        isMasterAdmin: false,
        ativo: ativo ?? true,
        estabelecimentosGerenciados: estabelecimentosGerenciados || [],
        createdAt: FieldValue.serverTimestamp(),
      });

      functions.logger.info(`✅ Usuário criado com sucesso: ${email}`);

      return res.status(200).json({
        success: true,
        message: 'Usuário criado com sucesso!',
        uid: userRecord.uid,
      });
    } catch (error) {// FUNÇÃO ATUALIZADA PARA CRIAR USUÁRIO VIA FETCH (HTTP REQUEST)
// FUNÇÃO ATUALIZADA PARA CRIAR USUÁRIO VIA FETCH (HTTP REQUEST)
const handleSubmit = async (e) => {
  e.preventDefault();
  setLoadingForm(true);
  setFormError('');

  try {
    const userDataForCF = {
      email: formData.email,
      password: formData.senha,
      name: formData.nome,
      isAdmin: formData.isAdmin,
      isMasterAdmin: formData.isMasterAdmin,
      ativo: formData.ativo,
      estabelecimentosGerenciados: formData.estabelecimentosGerenciados,
    };

    // 🌐 Chamada HTTP para Cloud Function (onRequest)
    const response = await fetch(
      'https://us-central1-matafome-98455.cloudfunctions.net/createUserByMasterAdmin',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // opcional: pode adicionar token JWT futuramente para segurança
        },
        body: JSON.stringify(userDataForCF),
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Erro desconhecido ao criar usuário');
    }

    console.log('✅ Resultado da Cloud Function:', result);

    auditLogger(
      'USUARIO_CRIADO_VIA_CF',
      { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
      { type: 'usuario', id: result.uid, name: formData.nome },
      { ...userDataForCF, success: result.success }
    );

    toast.success(result.message || 'Usuário criado com sucesso!');
    navigate('/master/usuarios');
  } catch (error) {
    console.error('❌ Erro ao criar usuário via Cloud Function:', error);
    let errorMessage = error.message || 'Erro ao criar usuário.';

    if (error.message.includes('email')) {
      errorMessage = 'Este e-mail já está em uso.';
    }

    setFormError(errorMessage);
    toast.error(errorMessage);
  } finally {
    setLoadingForm(false);
  }
};


      console.error('❌ Erro ao criar usuário:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });
});

// ======================================================
// 🔹 DELETE USER BY MASTER ADMIN (mantém onCall ou pode migrar também)
// ======================================================
export const deleteUserByMasterAdmin = onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido. Use POST.' });
    }

    try {
      const { uid } = req.body;

      if (!uid) {
        return res.status(400).json({ error: 'UID do usuário é obrigatório.' });
      }

      // Remove do Auth
      await auth.deleteUser(uid);

      // Remove do Firestore
      await db.collection('users').doc(uid).delete();

      functions.logger.info(`🗑️ Usuário deletado com sucesso: ${uid}`);

      return res.status(200).json({
        success: true,
        message: 'Usuário deletado com sucesso!',
      });
    } catch (error) {
      console.error('❌ Erro ao deletar usuário:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });
});

// ======================================================
// 🔹 CHECK LATE PAYMENTS
// ======================================================
export const checkLatePayments = onSchedule('every 24 hours', async (event) => {
  try {
    const snapshot = await db.collection('payments').where('status', '==', 'pending').get();

    for (const doc of snapshot.docs) {
      const payment = doc.data();
      const now = new Date();

      if (payment.dueDate && payment.dueDate.toDate() < now) {
        await doc.ref.update({ status: 'late' });
        functions.logger.warn(`Pagamento em atraso: ${doc.id}`);
      }
    }
  } catch (error) {
    functions.logger.error('Erro ao verificar pagamentos atrasados:', error);
  }
});

// ======================================================
// 🔹 ALERT LONG INACTIVE ESTABLISHMENTS
// ======================================================
export const alertLongInactiveEstablishments = onSchedule('every 24 hours', async () => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const estabelecimentosSnapshot = await db.collection('estabelecimentos').get();

    for (const doc of estabelecimentosSnapshot.docs) {
      const data = doc.data();
      if (data.ultimoPedido && data.ultimoPedido.toDate() < thirtyDaysAgo) {
        functions.logger.warn(`Estabelecimento inativo há mais de 30 dias: ${data.nome}`);
      }
    }
  } catch (error) {
    functions.logger.error('Erro ao verificar estabelecimentos inativos:', error);
  }
});
