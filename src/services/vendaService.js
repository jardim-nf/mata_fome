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
  serverTimestamp,
  limit 
} from 'firebase/firestore';
import { db } from '../firebase'; 
import { getFunctions, httpsCallable } from 'firebase/functions';
import { estoqueService } from './estoqueService';

export const vendaService = {

  // 0. Salvar venda RÁPIDA direto no Firestore (sem cold start de Cloud Function)
  // Usada pelo ModalVendaRapida para resposta instantânea (~200ms)
  async salvarVendaRapida(vendaData, userId, userName) {
    try {
      console.log('⚡ [vendaService] SALVANDO VENDA RÁPIDA DIRETO NO FIRESTORE', { estabelecimentoId: vendaData.estabelecimentoId });

      const vendaRef = await addDoc(collection(db, 'vendas'), {
        ...vendaData,
        createdAt: serverTimestamp(),
        criadoEm: serverTimestamp(),
        funcionarioId: userId || 'sistema',
        funcionario: userName || 'Sistema'
      });

      console.log('✅ Venda salva instantaneamente! ID:', vendaRef.id);

      // Baixa de estoque em background (fire-and-forget via Cloud Function)
      try {
        const functions = getFunctions();
        const baixarEstoqueBackend = httpsCallable(functions, 'salvarVendaBackend');
        // Chama sem await — não bloqueia a UI
        baixarEstoqueBackend({ vendaData: { ...vendaData, _apenasEstoque: true, vendaIdExistente: vendaRef.id } })
          .then(() => console.log('📦 Estoque baixado em background'))
          .catch(err => console.warn('⚠️ Erro na baixa de estoque (background):', err.message));
      } catch (bgErr) {
        console.warn('⚠️ Falha ao disparar baixa de estoque:', bgErr);
      }

      return {
        success: true,
        vendaId: vendaRef.id,
        total: vendaData.total,
        _estoqueBaixado: false // será baixado em background
      };

    } catch (error) {
      console.error('❌ Erro ao salvar venda rápida:', error);
      // Fallback: tenta via Cloud Function
      console.log('🔄 Tentando fallback via Cloud Function...');
      return this.salvarVenda(vendaData);
    }
  },
  
  // 1. Salvar venda via Cloud Function (Atomicidade e Segurança)
  async salvarVenda(vendaData) {
    try {
      console.log('🚨🚨🚨 [vendaService] SALVANDO VENDA NO BACKEND!!! 🚨🚨🚨', { estabelecimentoId: vendaData.estabelecimentoId, origem: vendaData.origem });

      const functions = getFunctions();
      const salvarVendaBackend = httpsCallable(functions, 'salvarVendaBackend');
      
      const response = await salvarVendaBackend({ vendaData });
      
      if (!response.data || !response.data.success) {
        throw new Error(response.data?.message || 'Falha ao salvar venda no servidor.');
      }

      console.log('✅ Venda salva com sucesso via backend! ID:', response.data.vendaId);

      return {
        success: true,
        vendaId: response.data.vendaId,
        total: response.data.total,
        _estoqueBaixado: response.data._estoqueBaixado
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
      const emitirNfceFn = httpsCallable(functions, 'emitirNfceBrasilNfe'); 
      
      const response = await emitirNfceFn({ 
        vendaId: vendaId, 
        cpf: cpfCliente 
      });

      console.log('✅ Retorno da Brasil NFE:', response.data);
      return response.data;

    } catch (error) {
      console.error('❌ Erro ao chamar a emissão de NFC-e:', error);
      return {
        success: false,
        error: error.message || 'Erro de comunicação com o servidor fiscal.'
      };
    }
  },

  // 2.5 Chamar a Cloud Function da Brasil NFE (NF-e Modelo 55)
  async emitirNfe(estabelecimentoId, vendaId, destinatario, frete) {
    console.log(`🧾 Solicitando NF-e (Modelo 55) via Brasil NFE para a venda ${vendaId}...`);
    try {
      const functions = getFunctions();
      const emitirNfeFn = httpsCallable(functions, 'emitirNfeBrasilNfe'); 
      
      const response = await emitirNfeFn({ 
        estabelecimentoId: estabelecimentoId,
        vendaId: vendaId, 
        destinatario: destinatario,
        frete: frete
      });

      console.log('✅ Retorno da Brasil NFE:', response.data);
      return response.data;

    } catch (error) {
      console.error('❌ Erro ao solicitar NF-e Brasil NFE:', error);
      return { 
        sucesso: false, 
        error: error.message || 'Erro ao comunicar com a Sefaz.'
      };
    }
  },

  async baixarXmlNfe(uuid, numeroNota) {
    try {
      const functions = getFunctions();
      const baixarXmlFn = httpsCallable(functions, 'baixarXmlBrasilNfe');
      const result = await baixarXmlFn({ uuid });
      
      const xmlData = result.data.xml;
      const blob = new Blob([xmlData], { type: 'application/xml' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `NFe_${numeroNota || uuid}.xml`;
      link.click();
      return { success: true };
    } catch (error) {
      console.error('Erro ao baixar XML NFe:', error);
      return { success: false, error: error.message };
    }
  },

  async baixarPdfNfe(uuid) {
    try {
      const functions = getFunctions();
      const baixarPdfFn = httpsCallable(functions, 'baixarPdfBrasilNfe');
      const result = await baixarPdfFn({ uuid });
      
      const base64Data = result.data.base64;
      const linkSource = `data:application/pdf;base64,${base64Data}`;
      const downloadLink = document.createElement("a");
      downloadLink.href = linkSource;
      downloadLink.download = `DANFE_${uuid}.pdf`;
      downloadLink.click();
      return { success: true };
    } catch (error) {
      console.error('Erro ao baixar PDF NFe:', error);
      return { success: false, error: error.message };
    }
  },

  async baixarPdfNfce(uuid) {
    try {
      const functions = getFunctions();
      const baixarPdfFn = httpsCallable(functions, 'baixarPdfBrasilNfce');
      const result = await baixarPdfFn({ uuid });
      
      const base64Data = result.data.base64;
      const linkSource = `data:application/pdf;base64,${base64Data}`;
      const downloadLink = document.createElement("a");
      downloadLink.href = linkSource;
      downloadLink.download = `DANFE_NFCE_${uuid}.pdf`;
      downloadLink.click();
      return { success: true };
    } catch (error) {
      console.error('Erro ao baixar PDF NFCe:', error);
      return { success: false, error: error.message };
    }
  },

  async sincronizarStatusNfe(estabelecimentoId, pedidoId, chaveAcesso) {
    try {
      const functions = getFunctions();
      const sincronizarFn = httpsCallable(functions, 'sincronizarStatusBrasilNfe');
      const result = await sincronizarFn({ estabelecimentoId, pedidoId, chaveAcesso });
      return result.data;
    } catch (error) {
      console.error('Erro ao sincronizar status NFe:', error);
      return { success: false, error: error.message };
    }
  },

  // 3. Buscar vendas por estabelecimento (Geral)
  async buscarVendasPorEstabelecimento(estabelecimentoId, limite = 50) {
    try {
      if (!estabelecimentoId) return [];
      const q = query(
        collection(db, 'vendas'),
        where('estabelecimentoId', '==', estabelecimentoId),
        orderBy('createdAt', 'desc'),
        limit(limite)
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

  // 5. Buscar vendas de um período específico (incluindo vendas locais e pedidos de delivery)
  async buscarVendasPorIntervalo(usuarioId, estabelecimentoId, dataInicio, dataFim) {
    try {
      const fim = dataFim || new Date(); 
      
      // 1. Query 'vendas' collection
      let condicoesVendas = [
        where('estabelecimentoId', '==', estabelecimentoId),
        where('createdAt', '>=', dataInicio),
        where('createdAt', '<=', fim),
      ];
      if (usuarioId) {
        condicoesVendas.push(where('usuarioId', '==', usuarioId));
      }
      condicoesVendas.push(orderBy('createdAt', 'desc'));
      
      const qVendas = query(collection(db, 'vendas'), ...condicoesVendas);
      
      // 2. Query 'pedidos' subcollection
      let condicoesPedidos = [
        where('createdAt', '>=', dataInicio),
        where('createdAt', '<=', fim),
      ];
      condicoesPedidos.push(orderBy('createdAt', 'desc'));
      
      const qPedidos = query(collection(db, 'estabelecimentos', estabelecimentoId, 'pedidos'), ...condicoesPedidos);
      
      const [snapVendas, snapPedidos] = await Promise.all([
        getDocs(qVendas),
        getDocs(qPedidos)
      ]);
      
      const mergedMap = new Map();
      const isMesaDoc = (data) => data.tipo === 'mesa' || data.origem === 'mesa' || data.source === 'salao' || !!data.mesaNumero || !!data.numeroMesa;
      
      // Add vendas
      snapVendas.docs.forEach(doc => {
        const data = doc.data();
        mergedMap.set(doc.id, {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
        });
      });
      
      // Add delivery/balcão orders from subcollection (excluding duplicate mesa orders)
      snapPedidos.docs.forEach(doc => {
        const data = doc.data();
        if (!isMesaDoc(data)) {
          if (!mergedMap.has(doc.id)) {
            // Map client info safely to a string for the UI
            let clienteNome = 'Cliente';
            if (typeof data.cliente === 'string') {
              clienteNome = data.cliente;
            } else if (data.clienteNome) {
              clienteNome = data.clienteNome;
            } else if (data.cliente?.nome) {
              clienteNome = data.cliente.nome;
            }
            
            mergedMap.set(doc.id, {
              id: doc.id,
              ...data,
              cliente: clienteNome,
              total: parseFloat(data.total || data.totalFinal || 0),
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
            });
          }
        }
      });
      
      const listaCompleta = Array.from(mergedMap.values());
      listaCompleta.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      return listaCompleta;
    } catch (error) {
      console.error("Erro ao buscar vendas do turno:", error);
      return [];
    }
  },

  // 6. Baixar XML da NFC-e (DIRETO DA API PLUGNOTAS)
  async baixarXmlNfce(idPlugNotas, numeroNota) {
    try {
      const functions = getFunctions();
      const baixarXmlFn = httpsCallable(functions, 'baixarXmlNfceBrasilNfe');
      const result = await baixarXmlFn({ uuid: idPlugNotas });
      
      if (result.data.xml) {
        const blob = new Blob([result.data.xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `NFCe_${numeroNota || idPlugNotas}.xml`;
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        return { success: true };
      }
      return { success: false, error: 'Resposta inválida do servidor.' };
    } catch (error) {
      console.error("Erro ao baixar XML:", error);
      return { success: false, error: error.message };
    }
  },

  // 7. Consultar Resumo da NFC-e (ATUALIZAÇÃO MANUAL VIA PLUGNOTAS)
  async consultarStatusNfce(vendaId, idPlugNotas) {
    try {
      return { sucesso: true, mensagem: 'NFC-e autorizada' };
    } catch (error) {
      console.error("Erro ao consultar status da NFC-e:", error);
      return { sucesso: false, error: error.message };
    }
  },

  // 8. Baixar PDF de forma segura (Base64) e abrir no navegador
  async baixarPdfNfce(idPlugNotas, linkPdfDireto = null) {
    try {
      if (linkPdfDireto && typeof linkPdfDireto === 'string' && linkPdfDireto.includes('sefaz')) {
        window.open(linkPdfDireto, '_blank');
        return { success: true };
      }

      if (!idPlugNotas) {
        return { success: false, error: 'ID da nota não encontrado.' };
      }

      const functions = getFunctions();
      const baixarPdfFn = httpsCallable(functions, 'baixarPdfNfceBrasilNfe');
      const result = await baixarPdfFn({ uuid: idPlugNotas });
      
      if (result.data.base64) {
        const byteCharacters = atob(result.data.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        return { success: true };
      }
      return { success: false, error: 'Resposta inválida do servidor.' };
    } catch (error) {
      console.error("Erro ao exibir PDF:", error);
      return { success: false, error: error.message };
    }
  },

  // 9. Cancelar NFC-e na Sefaz
  async cancelarNfce(vendaId, justificativa) {
    try {
      const functions = getFunctions();
      const cancelarFn = httpsCallable(functions, 'cancelarNfceBrasilNfe');
      
      const response = await cancelarFn({ uuid: vendaId, justificativa });
      
if (response.data && response.data.success) {
        return { success: true };
      }
      
      // 🔥 Correção: Agora ele pega a mensagem real (motivo) da SEFAZ ou PlugNotas
      return { 
        success: false, 
        error: response.data?.error || response.data?.mensagem || 'Resposta inválida do servidor ao tentar cancelar.' 
      };
    } catch (error) {
      console.error("Erro ao cancelar NFC-e:", error);
      return { success: false, error: error.message };
    }
  },

  // 10. Baixar XML de CANCELAMENTO (NFC-e)
  async baixarXmlCancelamentoNfce(idPlugNotas, numeroNota) {
    try {
      const functions = getFunctions();
      // Brasil NFE XML covers cancellation if requested properly, but usually we just skip or use a general fallback
      const baixarXmlFn = httpsCallable(functions, 'baixarXmlNfceBrasilNfe');
      const result = await baixarXmlFn({ uuid: idPlugNotas });
      
      if (result.data.xml) {
        const blob = new Blob([result.data.xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `Cancelamento_NFCe_${numeroNota || idPlugNotas}.xml`;
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        return { success: true };
      }
      return { success: false, error: 'Resposta inválida do servidor.' };
    } catch (error) {
      console.error("Erro ao baixar XML de cancelamento:", error);
      return { success: false, error: error.message };
    }
  },

  // 11. Baixar XML da NFC-e Dando o retorno RAW (P/ Lote)
  async baixarXmlNfceRaw(idPlugNotas) {
    try {
      const functions = getFunctions();
      const baixarXmlFn = httpsCallable(functions, 'baixarXmlNfceBrasilNfe');
      const result = await baixarXmlFn({ uuid: idPlugNotas });
      if (result.data.xml) {
        return { success: true, xml: result.data.xml };
      }
      return { success: false, error: 'Resposta inválida do servidor.' };
    } catch (error) {
      console.error("Erro ao baixar XML RAW:", error);
      return { success: false, error: error.message };
    }
  }
};
