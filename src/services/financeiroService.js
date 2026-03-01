import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  orderBy, 
  getDocs,
  where,
  Timestamp 
} from 'firebase/firestore';

const COLLECTION = 'faturas';

export const financeiroService = {
  // 1. Criar uma nova cobrança para um estabelecimento
  criarFatura: async (dados) => {
    try {
      await addDoc(collection(db, COLLECTION), {
        ...dados,
        status: 'pendente', // pendente, pago, cancelado
        criadoEm: Timestamp.now(),
        // Garante que vencimento seja Timestamp
        vencimento: Timestamp.fromDate(new Date(dados.vencimento))
      });
      return { success: true };
    } catch (error) {
      console.error("Erro ao criar fatura:", error);
      throw error;
    }
  },

  // 2. Listar todas as faturas (para o seu painel Master)
  listarTodasFaturas: async () => {
    try {
      const q = query(collection(db, COLLECTION), orderBy('vencimento', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
      console.error("Erro ao listar faturas:", error);
      throw error;
    }
  },

  // 3. Marcar como PAGO (Baixa manual)
  marcarComoPago: async (faturaId) => {
    try {
      const docRef = doc(db, COLLECTION, faturaId);
      await updateDoc(docRef, {
        status: 'pago',
        dataPagamento: Timestamp.now()
      });
      return { success: true };
    } catch (error) {
      console.error("Erro ao dar baixa:", error);
      throw error;
    }
  },

  // 4. Reabrir fatura (caso tenha marcado errado)
  reabrirFatura: async (faturaId) => {
    try {
      const docRef = doc(db, COLLECTION, faturaId);
      await updateDoc(docRef, {
        status: 'pendente',
        dataPagamento: null
      });
      return { success: true };
    } catch (error) {
      console.error("Erro ao reabrir:", error);
      throw error;
    }
  }
};