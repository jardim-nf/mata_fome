import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';

export const estoqueService = {
  /**
   * Dá baixa automática no estoque quando uma venda é realizada.
   * Suporta ambos os campos: `estoqueAtual` (legado) e `estoque` (novo).
   * Também atualiza o estoque das variações se houver.
   */
  async darBaixaEstoque(estabelecimentoId, itens) {
    console.log('🚨🚨🚨 [estoqueService] darBaixaEstoque CHAMADO!', { estabelecimentoId, qtdItens: itens?.length, itens });
    if (!estabelecimentoId || !itens || itens.length === 0) {
      console.log('⚠️ [estoqueService] Ignorando baixa (sem estabelecimento ou sem itens)');
      return { success: true };
    }

    const alertas = []; // Produtos com estoque baixo/zerado

    try {
      await runTransaction(db, async (transaction) => {
        const itensParaAtualizar = [];

        // 1. PRIMEIRO: Ler todos os documentos
        for (const item of itens) {
          console.log("🛠️ processando item baixa:", item);
          const categoriaId = item.categoriaId || item.category || item.categoria;
          // 🔥 CORREÇÃO: Usa o produtoIdOriginal (ID real do Firestore) ao invés do id gerado localmente
          const produtoId = item.produtoIdOriginal || item.id;
          
          // Tenta extrair a variacaoId de vários lugares (PDV, Delivery, Salão)
          const extratoVariacaoId = item.variacaoId || item.variacaoSelecionada?.id || null;
          
          console.log("🛠️ categoriaId:", categoriaId, "produtoId:", produtoId, "variacaoId:", extratoVariacaoId);
          if (!categoriaId || !produtoId) {
             console.log("⚠️ item sem categoria ou produto, ignorando:", item);
             continue;
          }

          const itemRef = doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', categoriaId, 'itens', produtoId);
          const itemDoc = await transaction.get(itemRef);
          
          if (itemDoc.exists()) {
            itensParaAtualizar.push({
              ref: itemRef,
              data: itemDoc.data(),
              nome: item.nome || itemDoc.data().nome || 'Produto',
              quantidadeComprada: item.quantidade || item.quantity || item.qtd || 1, // 'qtd' is used in delivery
              variacaoId: extratoVariacaoId
            });
          }
        }

        // 2. SEGUNDO: Aplicar as atualizações
        for (const itemAt of itensParaAtualizar) {
          const dados = itemAt.data;
          const updates = {};

          // --- Campo `estoqueAtual` (legado com flag controlaEstoque) ---
          if (dados.controlaEstoque === true && typeof dados.estoqueAtual === 'number') {
            let novoEstoque = dados.estoqueAtual - itemAt.quantidadeComprada;
            updates.estoqueAtual = novoEstoque;

            if (novoEstoque <= (dados.estoqueMinimo || 3)) {
              alertas.push({ nome: itemAt.nome, estoque: novoEstoque, minimo: dados.estoqueMinimo || 3 });
            }
          }

          // --- Campo `estoque` (novo padrão do AdminMenuManagement) ---
          if (typeof dados.estoque === 'number') {
            let novoEstoque = dados.estoque - itemAt.quantidadeComprada;
            updates.estoque = novoEstoque;

            if (novoEstoque <= (dados.estoqueMinimo || 3)) {
              alertas.push({ nome: itemAt.nome, estoque: novoEstoque, minimo: dados.estoqueMinimo || 3 });
            }
          }

          // --- Atualiza variações (se existem) ---
          console.log("🛠️ checkando variações...", { isArray: Array.isArray(dados.variacoes), variacaoIdItem: itemAt.variacaoId, variacoesCadastradas: dados.variacoes });
          
          if (Array.isArray(dados.variacoes) && itemAt.variacaoId) {
            const variacoes = dados.variacoes.map(v => {
              if (v.id === itemAt.variacaoId) {
                let novoEstoque = (Number(v.estoque) || 0) - itemAt.quantidadeComprada;
                console.log(`🛠️ variação ${v.id} bateu! antigo: ${v.estoque}, novo: ${novoEstoque}`);
                return { ...v, estoque: novoEstoque };
              }
              return v;
            });
            updates.variacoes = variacoes;
            // Recalcula estoque total baseado nas variações
            updates.estoque = variacoes.reduce((acc, v) => acc + (Number(v.estoque) || 0), 0);
            console.log("🛠️ novas variacoes:", updates.variacoes, "estoque somado:", updates.estoque);
          }

          if (Object.keys(updates).length > 0) {
            updates.ultimaBaixa = new Date();
            transaction.update(itemAt.ref, updates);
          }
        }
      });

      console.log('📦 Baixa de estoque realizada com sucesso!');
      return { success: true, alertas };
    } catch (error) {
      console.error('❌ Erro ao processar baixa de estoque:', error);
      return { success: false, error, alertas: [] };
    }
  }
};