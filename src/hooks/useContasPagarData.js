import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, serverTimestamp, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';

export function useContasPagarData(estabId) {
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Totais mensais/globais
  const [resumo, setResumo] = useState({
    totalPendente: 0,
    totalPago: 0,
    aVencerBreve: 0, // Conta vencendo em menos de 5 dias
    atrasadas: 0 
  });

  useEffect(() => {
    if (!estabId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'estabelecimentos', estabId, 'contas_a_pagar'),
      orderBy('dataVencimento', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setContas(docs);

      // Calcular o resumo
      let tPendente = 0;
      let tPago = 0;
      let vencendoCount = 0;
      let atrasadasCount = 0;
      const hj = new Date();
      hj.setHours(0,0,0,0);

      docs.forEach(c => {
        const val = Number(c.valor) || 0;
        if (c.status === 'pago') {
          tPago += val;
        } else {
          tPendente += val;
          // Verificar se tá vencendo ou atrasado
          if (c.dataVencimento) {
            // considerar YYYY-MM-DD local
            const args = c.dataVencimento.split('-');
            const vData = new Date(args[0], args[1] - 1, args[2]);
            const pDias = (vData - hj) / (1000 * 60 * 60 * 24);

            if (pDias < 0) atrasadasCount++;
            else if (pDias <= 5) vencendoCount++;
          }
        }
      });

      setResumo({
        totalPendente: tPendente,
        totalPago: tPago,
        aVencerBreve: vencendoCount,
        atrasadas: atrasadasCount
      });
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar contas a pagar:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [estabId]);

  const addConta = async (dados) => {
    if (!estabId) return;
    try {
      await addDoc(collection(db, 'estabelecimentos', estabId, 'contas_a_pagar'), {
        ...dados,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Erro ao salvar conta: ", err);
      throw err;
    }
  };

  const updateConta = async (contaId, updateData) => {
    if (!estabId || !contaId) return;
    try {
      const r = doc(db, 'estabelecimentos', estabId, 'contas_a_pagar', contaId);
      await updateDoc(r, updateData);
    } catch (err) {
      console.error("Erro ao atualizar conta: ", err);
      throw err;
    }
  };

  const deleteConta = async (contaId) => {
    if (!estabId || !contaId) return;
    try {
      const r = doc(db, 'estabelecimentos', estabId, 'contas_a_pagar', contaId);
      await deleteDoc(r);
    } catch (err) {
      console.error("Erro ao excluir conta: ", err);
      throw err;
    }
  };

  const togglePago = async (conta) => {
    if (!estabId || !conta?.id) return;
    try {
      const novoStatus = conta.status === 'pago' ? 'pendente' : 'pago';
      const updatePayload = {
        status: novoStatus,
      };
      if (novoStatus === 'pago') {
        updatePayload.dataPagamento = new Date().toISOString().split('T')[0];
      } else {
        updatePayload.dataPagamento = null;
      }
      const r = doc(db, 'estabelecimentos', estabId, 'contas_a_pagar', conta.id);
      await updateDoc(r, updatePayload);
    } catch(err) {
      console.error("Erro no toggle pagamento:", err);
      throw err;
    }
  };

  return {
    contas,
    loading,
    resumo,
    addConta,
    updateConta,
    deleteConta,
    togglePago
  };
}
