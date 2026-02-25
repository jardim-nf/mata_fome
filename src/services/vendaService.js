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
import { getFunctions, httpsCallable } from 'firebase/functions'; // NOVO IMPORT

export const vendaService = {
  
  // 1. Salvar venda DIRETO no Firestore
  async salvarVenda(vendaData) {
    try {
      console.log('💾 Salvando venda no banco de dados...', vendaData);

      const dadosLimpos = {
        ...vendaData,
        usuarioId: vendaData.usuarioId || null,
        clienteCpf: vendaData.clienteCpf || null,
        status: vendaData.status || 'finalizada',
        createdAt: serverTimestamp(), 
        origem: 'pdv_web'
      };

      const payloadFinal = JSON.parse(JSON.stringify(dadosLimpos));
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
      return {
        success: false,
        error: error.message || 'Erro ao salvar no banco de dados.'
      };
    }
  },

  // 2. Chamar a Cloud Function da PlugNotas (NFC-e)
  async emitirNfce(vendaId, cpfCliente) {
    console.log(`🧾 Solicitando NFC-e via PlugNotas para a venda ${vendaId}...`);
    try {
      const functions = getFunctions();
      // O nome aqui deve coincidir com o nome exportado no functions/index.js
      const emitirNfcePlugNotas = httpsCallable(functions, 'emitirNfcePlugNotas'); 
      
      const response = await emitirNfcePlugNotas({ 
        vendaId: vendaId, 
        cpf: cpfCliente 
      });

      console.log('✅ Retorno da PlugNotas:', response.data);
      return response.data; // Retorna { sucesso: true, idPlugNotas: "..." }

    } catch (error) {
      console.error('❌ Erro ao chamar a emissão de NFC-e:', error);
      return {
        success: false,
        error: error.message || 'Erro de comunicação com o servidor fiscal.'
      };
    }
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
        vendas.push({ id: doc.id, ...data, createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date() });
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
        return { id: docSnap.id, ...data, createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null };
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar venda:', error);
      return null;
    }
  },

  // 5. Buscar vendas de um período específico
  async buscarVendasPorIntervalo(usuarioId, estabelecimentoId, dataInicio, dataFim) {
    try {
      const fim = dataFim || new Date(); 
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
        return { id: doc.id, ...data, createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt) };
      });
    } catch (error) {
      console.error("Erro ao buscar vendas do turno:", error);
      return [];
    }
  }
};