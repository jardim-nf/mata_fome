import { db } from '../firebase';
import { 
  doc, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  orderBy, 
  runTransaction 
} from 'firebase/firestore';

const generateKeywords = (nome, telefone, imei, marca, modelo, numero, placa) => {
  const keywordsSet = new Set();
  
  const addWords = (text) => {
    if (!text) return;
    const cleanText = String(text)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/gi, '')
      .toLowerCase()
      .trim();
      
    cleanText.split(/\s+/).forEach(word => {
      if (word.length > 0) {
        keywordsSet.add(word);
        // Prefix sub-words for auto-complete typing search
        for (let i = 1; i <= word.length; i++) {
          keywordsSet.add(word.substring(0, i));
        }
      }
    });
  };
  
  addWords(nome);
  addWords(telefone);
  addWords(imei);
  addWords(marca);
  addWords(modelo);
  addWords(placa);
  if (numero) {
    keywordsSet.add(String(numero));
  }
  
  return Array.from(keywordsSet);
};

export const osService = {
  // 1. Criar OS com Número Corretamente Sequencial usando Transação
  async criarOrdemServico(estabelecimentoId, dados) {
    if (!estabelecimentoId) throw new Error("ID do estabelecimento é obrigatório.");
    
    try {
      const configOSRef = doc(db, 'estabelecimentos', estabelecimentoId, 'config', 'ordensServico');
      const osColRef = collection(db, 'estabelecimentos', estabelecimentoId, 'ordensServico');
      
      const novoDocRef = await runTransaction(db, async (transaction) => {
        const configSnap = await transaction.get(configOSRef);
        
        let proximoNumero = 1; // Inicia em 1
        if (configSnap.exists()) {
          const configData = configSnap.data();
          if (configData.ultimoNumeroOS) {
            proximoNumero = Number(configData.ultimoNumeroOS) + 1;
          }
        }
        
        // Atualiza o contador na transação
        transaction.set(configOSRef, { ultimoNumeroOS: proximoNumero }, { merge: true });
        
        const keywords = generateKeywords(
          dados.cliente?.nome,
          dados.cliente?.telefone,
          dados.equipamento?.nSerieOrImei,
          dados.equipamento?.marca,
          dados.equipamento?.modelo,
          proximoNumero,
          dados.equipamento?.placa
        );
        
        const osData = {
          ...dados,
          numeroOS: proximoNumero,
          status: dados.status || 'em_analise',
          situacaoFinanceira: dados.situacaoFinanceira || 'pendente',
          createdAt: new Date(),
          updatedAt: new Date(),
          keywords,
          timeline: [
            {
              status: dados.status || 'em_analise',
              data: new Date(),
              anotacao: 'Abertura da Ordem de Serviço concluída.',
              tecnico: dados.tecnicoResponsavel?.nome || 'Técnico Geral'
            }
          ]
        };
        
        // Cria uma referência de doc vazia e insere os dados
        const newOSRef = doc(osColRef);
        transaction.set(newOSRef, osData);
        
        return { ref: newOSRef, number: proximoNumero };
      });
      
      return { success: true, id: novoDocRef.ref.id, numeroOS: novoDocRef.number };
    } catch (error) {
      console.error("Erro ao criar Ordem de Serviço:", error);
      throw error;
    }
  },
  
  // 2. Atualizar OS e Recriar as Keywords de busca
  async atualizarOrdemServico(estabelecimentoId, osId, dados) {
    if (!estabelecimentoId || !osId) throw new Error("ID do estabelecimento e da OS são obrigatórios.");
    
    try {
      const osRef = doc(db, 'estabelecimentos', estabelecimentoId, 'ordensServico', osId);
      
      // Obtemos o documento atual para reter o número da OS original nas keywords
      const currentSnap = await getDoc(osRef);
      if (!currentSnap.exists()) throw new Error("Ordem de serviço não encontrada.");
      const currentData = currentSnap.data();
      
      const keywords = generateKeywords(
        dados.cliente?.nome || currentData.cliente?.nome,
        dados.cliente?.telefone || currentData.cliente?.telefone,
        dados.equipamento?.nSerieOrImei || currentData.equipamento?.nSerieOrImei,
        dados.equipamento?.marca || currentData.equipamento?.marca,
        dados.equipamento?.modelo || currentData.equipamento?.modelo,
        currentData.numeroOS,
        dados.equipamento?.placa || currentData.equipamento?.placa
      );
      
      const updateData = {
        ...dados,
        keywords,
        updatedAt: new Date()
      };
      
      if (dados.status && dados.status !== currentData.status) {
        const statusLabels = {
          em_analise: 'Em Análise',
          aguardando_orcamento: 'Aguardando Aprovação',
          orcamento_aprovado: 'Orçamento Aprovado',
          orcamento_rejeitado: 'Orçamento Rejeitado',
          em_manutencao: 'Em Manutenção',
          aguardando_peca: 'Aguardando Peça',
          garantia: 'Em Garantia',
          pronto: 'Pronto / Concluído',
          entregue: 'Entregue',
          sem_conserto: 'Sem Conserto'
        };
        const label = statusLabels[dados.status] || dados.status;
        const currentTimeline = currentData.timeline || [];
        updateData.timeline = [
          ...currentTimeline,
          {
            status: dados.status,
            data: new Date(),
            anotacao: `Status alterado para: ${label}.`,
            tecnico: dados.tecnicoResponsavel?.nome || currentData.tecnicoResponsavel?.nome || 'Sistema'
          }
        ];
      }
      
      await updateDoc(osRef, updateData);
      return { success: true };
    } catch (error) {
      console.error("Erro ao atualizar Ordem de Serviço:", error);
      throw error;
    }
  },
  
  // 3. Buscar OS por ID
  async obterOrdemServicoPorId(estabelecimentoId, osId) {
    if (!estabelecimentoId || !osId) throw new Error("ID do estabelecimento e da OS são obrigatórios.");
    try {
      const osRef = doc(db, 'estabelecimentos', estabelecimentoId, 'ordensServico', osId);
      const snap = await getDoc(osRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() };
      }
      return null;
    } catch (error) {
      console.error("Erro ao obter OS:", error);
      throw error;
    }
  },
  
  // 4. Listar todas as OS do estabelecimento
  async listarOrdensServico(estabelecimentoId) {
    if (!estabelecimentoId) throw new Error("ID do estabelecimento é obrigatório.");
    try {
      const osColRef = collection(db, 'estabelecimentos', estabelecimentoId, 'ordensServico');
      const q = query(osColRef, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      
      return snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error("Erro ao listar OSs:", error);
      throw error;
    }
  },
  
  // 5. Excluir OS
  async excluirOrdemServico(estabelecimentoId, osId) {
    if (!estabelecimentoId || !osId) throw new Error("ID do estabelecimento e da OS são obrigatórios.");
    try {
      const osRef = doc(db, 'estabelecimentos', estabelecimentoId, 'ordensServico', osId);
      await deleteDoc(osRef);
      return { success: true };
    } catch (error) {
      console.error("Erro ao excluir OS:", error);
      throw error;
    }
  }
};
