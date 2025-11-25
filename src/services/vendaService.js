// src/services/vendaService.js
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  query,
  where,
  orderBy,
  getDocs 
} from 'firebase/firestore';
import { db } from '../firebase';

export const vendaService = {
  // Salvar venda no Firebase
  async salvarVenda(vendaData) {
    try {
      const vendaComData = {
        ...vendaData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'vendas'), vendaComData);
      console.log('Venda salva com ID:', docRef.id);
      
      return {
        success: true,
        vendaId: docRef.id
      };
    } catch (error) {
      console.error('Erro ao salvar venda:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Buscar vendas por estabelecimento
  async buscarVendasPorEstabelecimento(estabelecimentoId, limite = 50) {
    try {
      const q = query(
        collection(db, 'vendas'),
        where('estabelecimentoId', '==', estabelecimentoId),
        orderBy('createdAt', 'desc'),
        limite(limite)
      );
      
      const querySnapshot = await getDocs(q);
      const vendas = [];
      
      querySnapshot.forEach((doc) => {
        vendas.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return vendas;
    } catch (error) {
      console.error('Erro ao buscar vendas:', error);
      return [];
    }
  },

  // Buscar venda por ID
  async buscarVendaPorId(vendaId) {
    try {
      const docRef = doc(db, 'vendas', vendaId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Erro ao buscar venda:', error);
      return null;
    }
  }
};