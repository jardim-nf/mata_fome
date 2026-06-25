import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  query, 
  orderBy, 
  getDocs,
  where,
  Timestamp,
  getDoc
} from 'firebase/firestore';

const CLIENTES_COLL = 'chatbot_clientes';
const FATURAS_COLL = 'chatbot_faturas';

export const chatbotFinanceiroService = {
  // === CLIENTS CRUD ===
  
  criarCliente: async (dados) => {
    try {
      const docRef = await addDoc(collection(db, CLIENTES_COLL), {
        ...dados,
        ativo: dados.ativo !== false,
        mensalidade: parseFloat(dados.mensalidade || 0),
        diaVencimento: parseInt(dados.diaVencimento || 10),
        criadoEm: Timestamp.now()
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error("Erro ao criar cliente de chatbot:", error);
      throw error;
    }
  },

  atualizarCliente: async (clienteId, dados) => {
    try {
      const docRef = doc(db, CLIENTES_COLL, clienteId);
      await updateDoc(docRef, {
        ...dados,
        mensalidade: parseFloat(dados.mensalidade || 0),
        diaVencimento: parseInt(dados.diaVencimento || 10),
        updatedAt: Timestamp.now()
      });
      return { success: true };
    } catch (error) {
      console.error("Erro ao atualizar cliente de chatbot:", error);
      throw error;
    }
  },

  listarClientes: async () => {
    try {
      const q = query(collection(db, CLIENTES_COLL), orderBy('nome', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
      console.error("Erro ao listar clientes de chatbot:", error);
      throw error;
    }
  },

  excluirCliente: async (clienteId) => {
    try {
      const docRef = doc(db, CLIENTES_COLL, clienteId);
      await deleteDoc(docRef);
      return { success: true };
    } catch (error) {
      console.error("Erro ao excluir cliente de chatbot:", error);
      throw error;
    }
  },

  // === INVOICES (FATURAS) CRUD ===

  criarFatura: async (dados) => {
    try {
      const docRef = await addDoc(collection(db, FATURAS_COLL), {
        ...dados,
        valor: parseFloat(dados.valor || 0),
        status: dados.status || 'pendente', // pendente, pago
        criadoEm: Timestamp.now(),
        vencimento: Timestamp.fromDate(new Date(dados.vencimento))
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error("Erro ao criar fatura de chatbot:", error);
      throw error;
    }
  },

  listarTodasFaturas: async () => {
    try {
      const q = query(collection(db, FATURAS_COLL), orderBy('vencimento', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
      console.error("Erro ao listar faturas de chatbot:", error);
      throw error;
    }
  },

  marcarComoPago: async (faturaId) => {
    try {
      const docRef = doc(db, FATURAS_COLL, faturaId);
      await updateDoc(docRef, {
        status: 'pago',
        dataPagamento: Timestamp.now()
      });
      return { success: true };
    } catch (error) {
      console.error("Erro ao marcar fatura como paga:", error);
      throw error;
    }
  },

  reabrirFatura: async (faturaId) => {
    try {
      const docRef = doc(db, FATURAS_COLL, faturaId);
      await updateDoc(docRef, {
        status: 'pendente',
        dataPagamento: null
      });
      return { success: true };
    } catch (error) {
      console.error("Erro ao reabrir fatura:", error);
      throw error;
    }
  },

  excluirFatura: async (faturaId) => {
    try {
      const docRef = doc(db, FATURAS_COLL, faturaId);
      await deleteDoc(docRef);
      return { success: true };
    } catch (error) {
      console.error("Erro ao excluir fatura:", error);
      throw error;
    }
  },

  // Atualizar fatura (alterar valor/vencimento/descrição)
  atualizarFatura: async (faturaId, dados) => {
    try {
      const docRef = doc(db, FATURAS_COLL, faturaId);
      await updateDoc(docRef, {
        ...dados,
        vencimento: Timestamp.fromDate(new Date(dados.vencimento))
      });
      return { success: true };
    } catch (error) {
      console.error("Erro ao atualizar fatura de chatbot:", error);
      throw error;
    }
  },

  // === BATCH OPERATIONS ===
  
  gerarMensalidadesEmLote: async (mesReferencia, descricaoCustomizada) => {
    // mesReferencia format: "YYYY-MM" (e.g. "2026-06")
    try {
      const [ano, mes] = mesReferencia.split('-').map(Number);
      
      // 1. Get all active chatbot clients
      const q = query(collection(db, CLIENTES_COLL), where('ativo', '==', true));
      const snapClientes = await getDocs(q);
      
      // 2. Get existing invoices for this month to avoid duplicates
      // We'll read all invoices for the month of reference
      const startDate = new Date(ano, mes - 1, 1);
      const endDate = new Date(ano, mes, 1);
      
      const qFaturas = query(
        collection(db, FATURAS_COLL),
        where('vencimento', '>=', Timestamp.fromDate(startDate)),
        where('vencimento', '<', Timestamp.fromDate(endDate))
      );
      const snapFaturas = await getDocs(qFaturas);
      const existingClientIds = new Set(snapFaturas.docs.map(d => d.data().clienteId));

      let count = 0;
      for (const clienteDoc of snapClientes.docs) {
        const clientData = clienteDoc.data();
        const clienteId = clienteDoc.id;
        
        // Skip if already generated
        if (existingClientIds.has(clienteId)) continue;
        
        // Compute due date for this specific client in this specific month
        // Handle month end date issues (e.g. day 31 in a 30-day month)
        const day = Math.min(clientData.diaVencimento || 10, new Date(ano, mes, 0).getDate());
        const vencimentoDate = new Date(ano, mes - 1, day);
        
        const desc = descricaoCustomizada || `Mensalidade - ${clientData.nome} - ${mes}/${ano}`;
        
        await addDoc(collection(db, FATURAS_COLL), {
          clienteId,
          clienteNome: clientData.nome,
          clienteTelefone: clientData.telefone || '',
          valor: parseFloat(clientData.mensalidade || 0),
          status: 'pendente',
          descricao: desc,
          vencimento: Timestamp.fromDate(vencimentoDate),
          criadoEm: Timestamp.now()
        });
        
        count++;
      }
      
      return { success: true, count };
    } catch (error) {
      console.error("Erro ao gerar mensalidades em lote:", error);
      throw error;
    }
  }
};
