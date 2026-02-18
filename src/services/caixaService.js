// src/services/caixaService.js
import { 
  collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, limit, orderBy 
} from 'firebase/firestore';
import { db } from '../firebase'; 

export const caixaService = {
  // ... (Mantenha verificarCaixaAberto, abrirCaixa, fecharCaixa e listarTurnos IGUAIS) ...
  // Apenas adicione estas duas novas funções no final do objeto:

  // 🆕 1. Registrar Sangria ou Suprimento
  async adicionarMovimentacao(caixaId, dados) {
    try {
      // Salva na subcoleção 'movimentacoes' dentro do caixa
      await addDoc(collection(db, 'caixas', caixaId, 'movimentacoes'), {
        ...dados,
        createdAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error("Erro movimentação:", error);
      return { success: false, error: error.message };
    }
  },

  // 🆕 2. Buscar Movimentações do Turno (Para o Fechamento)
  async buscarMovimentacoes(caixaId) {
    try {
      const q = query(collection(db, 'caixas', caixaId, 'movimentacoes'));
      const snapshot = await getDocs(q);
      
      let totalSuprimento = 0;
      let totalSangria = 0;
      const itens = [];

      snapshot.forEach(doc => {
        const d = doc.data();
        itens.push(d);
        if (d.tipo === 'suprimento') totalSuprimento += Number(d.valor);
        if (d.tipo === 'sangria') totalSangria += Number(d.valor);
      });

      return { totalSuprimento, totalSangria, itens };
    } catch (error) {
      return { totalSuprimento: 0, totalSangria: 0, itens: [] };
    }
  },

  // (Mantenha as outras funções que já existiam aqui...)
  async verificarCaixaAberto(usuarioId, estabelecimentoId) {
    try {
        const q = query(collection(db, 'caixas'), where('usuarioId', '==', usuarioId), where('estabelecimentoId', '==', estabelecimentoId), where('status', '==', 'aberto'), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) { const d = snapshot.docs[0].data(); return { id: snapshot.docs[0].id, ...d, dataAbertura: d.dataAbertura?.toDate ? d.dataAbertura.toDate() : new Date() }; }
        return null;
    } catch (e) { return null; }
  },
  async abrirCaixa(dados) {
      try { const ref = await addDoc(collection(db, 'caixas'), { ...dados, dataAbertura: serverTimestamp(), status: 'aberto' }); return { success: true, id: ref.id }; } catch (e) { return { success: false, error: e.message }; }
  },
  async fecharCaixa(id, dados) {
      try { await updateDoc(doc(db, 'caixas', id), { ...dados, status: 'fechado', dataFechamento: serverTimestamp() }); return { success: true }; } catch (e) { return { success: false, error: e.message }; }
  },
  async listarTurnos(usuarioId, estabelecimentoId) {
    try {
      const q = query(collection(db, 'caixas'), where('usuarioId', '==', usuarioId), where('estabelecimentoId', '==', estabelecimentoId), orderBy('dataAbertura', 'desc'), limit(10));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => { const d = doc.data(); return { id: doc.id, ...d, dataAbertura: d.dataAbertura?.toDate ? d.dataAbertura.toDate() : null, dataFechamento: d.dataFechamento?.toDate ? d.dataFechamento.toDate() : null }; });
    } catch (e) { console.error(e); return []; }
  }
};