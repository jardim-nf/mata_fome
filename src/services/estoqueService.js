import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';

export const estoqueService = {
  async darBaixaEstoque(estabelecimentoId, itens) {
    if (!estabelecimentoId || !itens || itens.length === 0) return { success: true };

    try {
      await runTransaction(db, async (transaction) => {
        const itensParaAtualizar = [];

        // 1. PRIMEIRO: Ler todos os documentos (regra do Firestore para transações)
        for (const item of itens) {
          // Precisamos da categoria para achar o caminho exato do produto
          const categoriaId = item.categoriaId || item.category || item.categoria;
          if (!categoriaId || !item.id) continue;

          const itemRef = doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', categoriaId, 'itens', item.id);
          const itemDoc = await transaction.get(itemRef);
          
          if (itemDoc.exists()) {
            itensParaAtualizar.push({
              ref: itemRef,
              data: itemDoc.data(),
              quantidadeComprada: item.quantidade || item.quantity || 1
            });
          }
        }

        // 2. SEGUNDO: Aplicar as atualizações
        for (const itemAt of itensParaAtualizar) {
          // Só dá baixa se o produto tiver a flag controlaEstoque ativada e um número definido
          if (itemAt.data.controlaEstoque === true && typeof itemAt.data.estoqueAtual === 'number') {
            let novoEstoque = itemAt.data.estoqueAtual - itemAt.quantidadeComprada;
            if (novoEstoque < 0) novoEstoque = 0; // Evita estoque negativo
            
            transaction.update(itemAt.ref, { 
              estoqueAtual: novoEstoque,
              // Se o estoque zerar, já tira a disponibilidade (opcional)
              disponivel: novoEstoque > 0 ? itemAt.data.disponivel : false 
            });
          }
        }
      });

      console.log('📦 Baixa de estoque realizada com sucesso!');
      return { success: true };
    } catch (error) {
      console.error('❌ Erro ao processar baixa de estoque:', error);
      return { success: false, error };
    }
  }
};