// src/services/vendaService.js
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  getDoc 
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase'; // Importamos 'functions' aqui

export const vendaService = {
  // 🔒 Salvar venda via Cloud Function (SEGURO)
  async salvarVenda(vendaData) {
    try {
      console.log('🔒 Iniciando processamento seguro do pedido...');

      // Chama a função que criamos no backend 'functions/index.js'
      const criarPedidoFunction = httpsCallable(functions, 'criarPedidoSeguro');
      
      // Envia os dados e aguarda a resposta do servidor
      // O servidor vai validar preços, estoque e calcular o total real
      const result = await criarPedidoFunction(vendaData);
      
      console.log('✅ Venda processada pelo servidor:', result.data);
      
      return {
        success: true,
        vendaId: result.data.vendaId,
        total: result.data.totalValidado
      };

    } catch (error) {
      console.error('❌ Erro ao salvar venda via servidor:', error);
      
      // Mensagens amigáveis para erros comuns
      let msg = 'Erro ao processar o pedido. Tente novamente.';
      if (error.code === 'not-found') msg = 'Algum produto do seu pedido não está mais disponível.';
      if (error.code === 'unauthenticated') msg = 'Você precisa estar logado para fazer o pedido.';

      return {
        success: false,
        error: msg,
        details: error.message
      };
    }
  },

  // Buscar vendas por estabelecimento (Mantido Leitura direta para performance)
  async buscarVendasPorEstabelecimento(estabelecimentoId, limite = 50) {
    try {
      const q = query(
        collection(db, 'vendas'),
        where('estabelecimentoId', '==', estabelecimentoId),
        orderBy('createdAt', 'desc')
        // limite(limite) // Remova o comentário se quiser limitar a qtd
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