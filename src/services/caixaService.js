// src/services/caixaService.js
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  limit
} from 'firebase/firestore';
import { db } from '../firebase'; 

export const caixaService = {
  // 1. Verificar se já tem caixa aberto
  async verificarCaixaAberto(usuarioId, estabelecimentoId) {
    try {
      const q = query(
        collection(db, 'caixas'),
        where('usuarioId', '==', usuarioId),
        where('estabelecimentoId', '==', estabelecimentoId),
        where('status', '==', 'aberto'),
        limit(1)
      );
      
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docData = snapshot.docs[0];
        // Retorna os dados do caixa + o ID do documento
        return { id: docData.id, ...docData.data() };
      }
      return null;
    } catch (error) {
      console.error("Erro ao verificar caixa:", error);
      return null;
    }
  },

  // 2. Abrir Caixa
  async abrirCaixa(dados) {
    try {
      const novoCaixa = {
        usuarioId: dados.usuarioId,
        estabelecimentoId: dados.estabelecimentoId,
        dataAbertura: serverTimestamp(),
        saldoInicial: parseFloat(dados.saldoInicial), 
        status: 'aberto'
      };

      const docRef = await addDoc(collection(db, 'caixas'), novoCaixa);
      return { success: true, id: docRef.id, ...novoCaixa };
    } catch (error) {
      console.error("Erro ao abrir caixa:", error);
      return { success: false, error: error.message };
    }
  },

  // 3. Fechar Caixa
  async fecharCaixa(caixaId, dadosFechamento) {
    try {
      const caixaRef = doc(db, 'caixas', caixaId);
      
      await updateDoc(caixaRef, {
        status: 'fechado',
        dataFechamento: serverTimestamp(),
        saldoFinalInformado: parseFloat(dadosFechamento.saldoFinalInformado),
        diferenca: parseFloat(dadosFechamento.diferenca),
        resumoVendas: dadosFechamento.resumoVendas
      });

      return { success: true };
    } catch (error) {
      console.error("Erro ao fechar caixa:", error);
      return { success: false, error: error.message };
    }
  }
};