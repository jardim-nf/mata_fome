import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';

export const estoqueService = {
  /**
   * Dá baixa automática no estoque quando uma venda é realizada.
   * Suporta ambos os campos: `estoqueAtual` (legado) e `estoque` (novo).
   * Também atualiza o estoque das variações se houver.
   */
  async darBaixaEstoque(estabelecimentoId, itens) {
    if (!estabelecimentoId || !itens || itens.length === 0) return { success: true };

    const alertas = []; // Produtos com estoque baixo/zerado

    try {
      await runTransaction(db, async (transaction) => {
        const itensParaAtualizar = [];

        // 1. PRIMEIRO: Ler todos os documentos
        for (const item of itens) {
          const categoriaId = item.categoriaId || item.category || item.categoria;
          if (!categoriaId || !item.id) continue;

          const itemRef = doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', categoriaId, 'itens', item.id);
          const itemDoc = await transaction.get(itemRef);
          
          if (itemDoc.exists()) {
            itensParaAtualizar.push({
              ref: itemRef,
              data: itemDoc.data(),
              nome: item.nome || itemDoc.data().nome || 'Produto',
              quantidadeComprada: item.quantidade || item.quantity || 1,
              variacaoId: item.variacaoId || null
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
            if (novoEstoque < 0) novoEstoque = 0;
            updates.estoqueAtual = novoEstoque;
            if (novoEstoque === 0) updates.disponivel = false;

            if (novoEstoque <= (dados.estoqueMinimo || 3)) {
              alertas.push({ nome: itemAt.nome, estoque: novoEstoque, minimo: dados.estoqueMinimo || 3 });
            }
          }

          // --- Campo `estoque` (novo padrão do AdminMenuManagement) ---
          if (typeof dados.estoque === 'number') {
            let novoEstoque = dados.estoque - itemAt.quantidadeComprada;
            if (novoEstoque < 0) novoEstoque = 0;
            updates.estoque = novoEstoque;
            
            if (novoEstoque === 0) updates.ativo = false; // Pausa o produto se zerou

            if (novoEstoque <= (dados.estoqueMinimo || 3)) {
              alertas.push({ nome: itemAt.nome, estoque: novoEstoque, minimo: dados.estoqueMinimo || 3 });
            }
          }

          // --- Atualiza variações (se existem) ---
          if (Array.isArray(dados.variacoes) && itemAt.variacaoId) {
            const variacoes = dados.variacoes.map(v => {
              if (v.id === itemAt.variacaoId) {
                let novoEstoque = (Number(v.estoque) || 0) - itemAt.quantidadeComprada;
                if (novoEstoque < 0) novoEstoque = 0;
                return { ...v, estoque: novoEstoque };
              }
              return v;
            });
            updates.variacoes = variacoes;
            // Recalcula estoque total baseado nas variações
            updates.estoque = variacoes.reduce((acc, v) => acc + (Number(v.estoque) || 0), 0);
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