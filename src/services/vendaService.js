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
import { getFunctions, httpsCallable } from 'firebase/functions';

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
  },

  // 6. Baixar XML da NFC-e (DIRETO DA API PLUGNOTAS)
  async baixarXmlNfce(idPlugNotas, numeroNota) {
    try {
      const functions = getFunctions();
      const baixarXmlFn = httpsCallable(functions, 'baixarXmlNfcePlugNotas');
      const result = await baixarXmlFn({ idPlugNotas });
      
      if (result.data.sucesso) {
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
      const functions = getFunctions();
      const consultarFn = httpsCallable(functions, 'consultarResumoNfce');
      const response = await consultarFn({ vendaId, idPlugNotas });
      return response.data;
    } catch (error) {
      console.error("Erro ao consultar status da NFC-e:", error);
      return { sucesso: false, error: error.message };
    }
  },

// 8. Baixar PDF de forma segura (Base64) e abrir no navegador
  async baixarPdfNfce(idPlugNotas, linkPdfDireto = null) {
    try {
      // CORREÇÃO: Se o link for da SEFAZ (público), abrimos direto.
      // Se for da API da Plugnotas, NÃO podemos abrir direto porque exige token.
      if (linkPdfDireto && typeof linkPdfDireto === 'string' && linkPdfDireto.includes('sefaz')) {
        window.open(linkPdfDireto, '_blank');
        return { success: true };
      }

      if (!idPlugNotas) {
        return { success: false, error: 'ID da nota não encontrado.' };
      }

      // Se for link da Plugnotas ou não tiver link, pede ao Backend (Firebase Functions)
      // O Backend tem a x-api-key guardada em segurança e consegue fazer o download!
      const functions = getFunctions();
      const baixarPdfFn = httpsCallable(functions, 'baixarPdfNfcePlugNotas');
      const result = await baixarPdfFn({ idPlugNotas });
      
      if (result.data.sucesso && result.data.pdfBase64) {
        // Transforma o PDF que veio em código (Base64) num ficheiro PDF real na tela do cliente
        const byteCharacters = atob(result.data.pdfBase64);
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
};
// ==================================================================
// 9. CANCELAR NFC-E VIA PLUGNOTAS
// ==================================================================
export const cancelarNfcePlugNotas = onCall({
    cors: true,
    secrets: [plugNotasApiKey]
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

    const { vendaId, justificativa } = request.data;
    
    if (!vendaId || !justificativa) {
        throw new HttpsError('invalid-argument', 'O ID da venda e a justificativa são obrigatórios.');
    }

    try {
        const vendaRef = db.collection('vendas').doc(vendaId);
        const vendaSnap = await vendaRef.get();
        if (!vendaSnap.exists) throw new HttpsError('not-found', 'Venda não encontrada.');
        
        const venda = vendaSnap.data();
        const idPlugNotas = venda.fiscal?.idPlugNotas;

        if (!idPlugNotas) {
            throw new HttpsError('failed-precondition', 'Esta venda não possui um ID válido na Plugnotas para cancelar.');
        }

        // A API da Plugnotas exige que o cancelamento seja um array com o ID interno e a justificativa
        const payload = [{
            id: idPlugNotas,
            justificativa: justificativa
        }];

        const response = await fetch("https://api.plugnotas.com.br/nfce/cancelar", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": plugNotasApiKey.value()
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            logger.error("❌ Erro ao cancelar no PlugNotas:", result);
            throw new HttpsError('internal', `Falha na Sefaz: ${result.message || JSON.stringify(result.error)}`);
        }

        // Atualiza a base de dados para indicar que o cancelamento foi enviado
        await vendaRef.update({
            'fiscal.status': 'PROCESSANDO_CANCELAMENTO',
            'fiscal.dataAtualizacao': FieldValue.serverTimestamp(),
            'status': 'cancelada' // Muda o status geral do pedido para cancelado
        });

        logger.info(`✅ Solicitação de cancelamento enviada para NFC-e: ${idPlugNotas}`);

        return {
            sucesso: true,
            mensagem: 'Cancelamento solicitado com sucesso à Sefaz.'
        };

    } catch (error) {
        logger.error("❌ Erro no Cancelamento NFC-e:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message);
    }
});