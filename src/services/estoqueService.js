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

          let itemRef = doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', categoriaId, 'itens', produtoId);
          if (item.tipoColecao) {
            itemRef = doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', categoriaId, item.tipoColecao, produtoId);
          }
          
          let itemDoc = await transaction.get(itemRef);
          
          // Fallback: se não achar na subcoleção definida/padrão, tenta na outra
          if (!itemDoc.exists()) {
            const outraColecao = (item.tipoColecao === 'produtos' || (!item.tipoColecao && itemRef.path.includes('/itens/'))) ? 'produtos' : 'itens';
            const fallbackRef = doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', categoriaId, outraColecao, produtoId);
            const fallbackDoc = await transaction.get(fallbackRef);
            if (fallbackDoc.exists()) {
              itemRef = fallbackRef;
              itemDoc = fallbackDoc;
            }
          }
          
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

          // 1. Calcula estoque geral
          let estoqueAtualGeral = typeof dados.estoque === 'number' ? dados.estoque : (typeof dados.estoqueAtual === 'number' ? dados.estoqueAtual : 0);
          let novoEstoqueGeral = estoqueAtualGeral - itemAt.quantidadeComprada;
          
          updates.estoque = novoEstoqueGeral;
          // Atualiza também o legado para garantir compatibilidade
          if (dados.estoqueAtual !== undefined) {
             updates.estoqueAtual = novoEstoqueGeral;
          }

          if (novoEstoqueGeral <= (dados.estoqueMinimo || 3)) {
            alertas.push({ nome: itemAt.nome, estoque: novoEstoqueGeral, minimo: dados.estoqueMinimo || 3 });
          }

          // 2. Atualiza variações (se aplicável)
          let atualizouVariacao = false;
          if (Array.isArray(dados.variacoes)) {
            const variacoes = dados.variacoes.map(v => {
              // Se tivermos o variacaoId, abatemos nele.
              // Se não tivermos (foi vendido 'Padrão' mas não passou variacaoId), tentamos achar a variação filha "Padrão" / ID 'v-unique' ou apenas debitamos geral se não achar.
              if ((itemAt.variacaoId && v.id === itemAt.variacaoId) || (!itemAt.variacaoId && v.nome === 'Padrão' && dados.variacoes.length === 1)) {
                atualizouVariacao = true;
                let novoEstoqueVar = (Number(v.estoque) || 0) - itemAt.quantidadeComprada;
                return { ...v, estoque: novoEstoqueVar };
              }
              return v;
            });

            if (atualizouVariacao) {
              updates.variacoes = variacoes;
              // Recalcula estoque total somando as variações já que mexemos em uma
              const somaVariacoes = variacoes.reduce((acc, v) => acc + (Number(v.estoque) || 0), 0);
              updates.estoque = somaVariacoes;
              if (dados.estoqueAtual !== undefined) {
                 updates.estoqueAtual = somaVariacoes;
              }
            }
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