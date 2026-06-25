// src/services/caixaService.js
import { 
  collection, query, where, getDocs, doc, limit, orderBy, updateDoc, deleteDoc 
} from 'firebase/firestore';
import { db } from '../firebase'; 
import { getFunctions, httpsCallable } from 'firebase/functions'; 

export const caixaService = {
  // ... (Mantenha verificarCaixaAberto, abrirCaixa, fecharCaixa e listarTurnos IGUAIS) ...
  // Apenas adicione estas duas novas funções no final do objeto:

  // 🆕 1. Registrar Sangria ou Suprimento
  async adicionarMovimentacao(caixaId, dados) {
    try {
      const functions = getFunctions();
      const addMovimentacao = httpsCallable(functions, 'adicionarMovimentacaoCaixaBackend');
      await addMovimentacao({ 
          estabelecimentoId: dados.estabelecimentoId, 
          caixaId, 
          dados 
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
      let totalSuprimentoDinheiro = 0;
      let totalSangria = 0;
      let totalSangriaDinheiro = 0;
      const itens = [];

      snapshot.forEach(doc => {
        const d = doc.data();
        itens.push({ id: doc.id, ...d });
        if (d.tipo && d.tipo.startsWith('suprimento')) {
          totalSuprimento += Number(d.valor);
          if (d.tipo === 'suprimento') {
            totalSuprimentoDinheiro += Number(d.valor);
          }
        }
        if (d.tipo && d.tipo.startsWith('sangria')) {
          totalSangria += Number(d.valor);
          if (d.tipo === 'sangria') {
            totalSangriaDinheiro += Number(d.valor);
          }
        }
      });

      return { totalSuprimento, totalSuprimentoDinheiro, totalSangria, totalSangriaDinheiro, itens };
    } catch (error) {
      return { totalSuprimento: 0, totalSuprimentoDinheiro: 0, totalSangria: 0, totalSangriaDinheiro: 0, itens: [] };
    }
  },

  // (Mantenha as outras funções que já existiam aqui...)
  async verificarCaixaAberto(usuarioId, estabelecimentoId) {
    try {
        const q = query(collection(db, 'caixas'), where('estabelecimentoId', '==', estabelecimentoId), where('status', '==', 'aberto'), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) { const d = snapshot.docs[0].data(); return { id: snapshot.docs[0].id, ...d, dataAbertura: d.dataAbertura?.toDate ? d.dataAbertura.toDate() : new Date() }; }
        return null;
    } catch (e) { return null; }
  },
  async fecharCaixa(id, dados) {
      try { 
        const functions = getFunctions();
        const fecharCaixa = httpsCallable(functions, 'fecharCaixaBackend');
        await fecharCaixa({ 
            estabelecimentoId: dados.estabelecimentoId, 
            caixaId: id, 
            dados 
        });
        return { success: true }; 
      } catch (e) { return { success: false, error: e.message }; }
  },
  async listarTurnos(usuarioId, estabelecimentoId) {
    try {
      const q = query(collection(db, 'caixas'), where('usuarioId', '==', usuarioId), where('estabelecimentoId', '==', estabelecimentoId), orderBy('dataAbertura', 'desc'), limit(10));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => { const d = doc.data(); return { id: doc.id, ...d, dataAbertura: d.dataAbertura?.toDate ? d.dataAbertura.toDate() : null, dataFechamento: d.dataFechamento?.toDate ? d.dataFechamento.toDate() : null }; });
    } catch (e) { console.error(e); return []; }
  },
  async listarTodosTurnos(estabelecimentoId) {
    try {
      const q = query(collection(db, 'caixas'), where('estabelecimentoId', '==', estabelecimentoId));
      const snapshot = await getDocs(q);
      const lista = snapshot.docs.map(doc => { 
        const d = doc.data(); 
        return { 
          id: doc.id, 
          ...d, 
          dataAbertura: d.dataAbertura?.toDate ? d.dataAbertura.toDate() : null, 
          dataFechamento: d.dataFechamento?.toDate ? d.dataFechamento.toDate() : null 
        }; 
      });
      return lista.sort((a, b) => (b.dataAbertura || 0) - (a.dataAbertura || 0));
    } catch (e) { console.error("Erro ao listar todos os turnos:", e); return []; }
  },
  async abrirCaixa(dados) {
      try { 
          const functions = getFunctions();
          const abrirCaixa = httpsCallable(functions, 'abrirCaixaBackend');
          const result = await abrirCaixa({ 
              estabelecimentoId: dados.estabelecimentoId, 
              dados 
          });
          
          if (!result.data.success) {
              return { success: false, error: result.data.error || 'Erro ao abrir caixa' };
          }
          
          return { success: true, id: result.data.id }; 
      } catch (e) { 
          return { success: false, error: e.message }; 
      }
  },
  
  async atualizarMovimentacao(caixaId, movId, dados) {
      try {
          const ref = doc(db, 'caixas', caixaId, 'movimentacoes', movId);
          await updateDoc(ref, dados);
          return { success: true };
      } catch (error) {
          console.error("Erro ao atualizar movimentação:", error);
          return { success: false, error: error.message };
      }
  },

  async excluirMovimentacao(caixaId, movId) {
      try {
          const ref = doc(db, 'caixas', caixaId, 'movimentacoes', movId);
          await deleteDoc(ref);
          return { success: true };
      } catch (error) {
          console.error("Erro ao excluir movimentação:", error);
          return { success: false, error: error.message };
      }
  },
};