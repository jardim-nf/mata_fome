// src/services/vendaService.js
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  getDoc,
  addDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase'; 

export const vendaService = {
  
  // 1. Salvar venda DIRETO no Firestore
  async salvarVenda(vendaData) {
    try {
      console.log('💾 Salvando venda no banco de dados...', vendaData);

      // Sanitização de Dados (Evita erro de 'undefined' no Firestore)
      const dadosLimpos = {
        ...vendaData,
        usuarioId: vendaData.usuarioId || null,
        clienteCpf: vendaData.clienteCpf || null,
        status: vendaData.status || 'finalizada',
        createdAt: serverTimestamp(), 
        origem: 'pdv_web'
      };

      // Remove chaves que porventura ainda estejam undefined
      const payloadFinal = JSON.parse(JSON.stringify(dadosLimpos));
      // Restaura o serverTimestamp (o JSON.stringify remove funções/objetos especiais)
      payloadFinal.createdAt = serverTimestamp();

      const vendasRef = collection(db, 'vendas');
      const docRef = await addDoc(vendasRef, payloadFinal);

      console.log('✅ Venda salva com sucesso! ID:', docRef.id);
      
      return {
        success: true,
        vendaId: docRef.id,
        total: vendaData.total
      };

    } catch (error) {
      console.error('❌ Erro ao salvar venda:', error);
      let mensagem = 'Erro ao salvar no banco de dados.';
      
      if (error.code === 'permission-denied') {
        mensagem = 'Sem permissão para salvar. Verifique as Regras do Firestore.';
      } else if (error.message && error.message.includes('undefined')) {
        mensagem = 'Erro de dados: Um campo indefinido foi enviado ao banco.';
      }

      return {
        success: false,
        error: mensagem,
        details: error.message
      };
    }
  },

  // 2. Placeholder para NFC-e
  async emitirNfce(vendaId, cpfCliente) {
    console.log(`🧾 Solicitando NFC-e para venda ${vendaId}`);
    await new Promise(r => setTimeout(r, 1000));
    return {
        success: false,
        error: 'API Fiscal ainda não configurada no sistema.'
    };
  },

  // 3. Buscar vendas por estabelecimento (Geral)
  async buscarVendasPorEstabelecimento(estabelecimentoId, limite = 50) {
    try {
      if (!estabelecimentoId) return [];
      
      const q = query(
        collection(db, 'vendas'),
        where('estabelecimentoId', '==', estabelecimentoId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const vendas = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        vendas.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date()
        });
      });
      
      return vendas;
    } catch (error) {
      console.error('Erro ao buscar vendas:', error);
      return [];
    }
  },

  // 4. Buscar venda por ID
  async buscarVendaPorId(vendaId) {
    try {
      const docRef = doc(db, 'vendas', vendaId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null
        };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Erro ao buscar venda:', error);
      return null;
    }
  },

  // 5. 🆕 Buscar vendas de um período específico (para o histórico de turnos)
  async buscarVendasPorIntervalo(usuarioId, estabelecimentoId, dataInicio, dataFim) {
    try {
      const fim = dataFim || new Date(); // Se não tem fim, usa agora
      
      const q = query(
        collection(db, 'vendas'),
        where('estabelecimentoId', '==', estabelecimentoId),
        where('usuarioId', '==', usuarioId),
        where('createdAt', '>=', dataInicio),
        where('createdAt', '<=', fim),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
        };
      });
    } catch (error) {
      console.error("Erro ao buscar vendas do turno:", error);
      return [];
    }
  }

}; // <-- O objeto vendaService fecha aqui!