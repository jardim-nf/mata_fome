import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';

export const estoqueService = {
  /**
   * Dá baixa automática no estoque quando uma venda é realizada.
   * 
   * FICHA TÉCNICA: Se o produto tem `fichaTecnica` (array de insumos),
   * a baixa é feita nos INSUMOS proporcionalmente, NÃO no produto em si.
   * Caso contrário, mantém o comportamento legado (baixa 1:1 no produto/variação).
   *
   * Suporta ambos os campos: `estoqueAtual` (legado) e `estoque` (novo).
   * Também atualiza o estoque das variações se houver.
   */
  async darBaixaEstoque(estabelecimentoId, itens) {
    console.log('🚨🚨🚨 [estoqueService] darBaixaEstoque CHAMADO!', { estabelecimentoId, qtdItens: itens?.length, itens });
    if (!estabelecimentoId || !itens || itens.length === 0) {
      console.log('⚠️ [estoqueService] Ignorando baixa (sem estabelecimento ou sem itens)');
      return { success: true };
    }

    const alertas = []; // Produtos/insumos com estoque baixo/zerado

    try {
      await runTransaction(db, async (transaction) => {
        const produtosParaAtualizar = {}; // { path: { ref, data, nome, totalBaixa, variacoesBaixa } }
        // Mapa de insumos que precisam ser atualizados (agrega se vários produtos usam o mesmo insumo)
        const insumosParaBaixar = {}; // { insumoId: { ref, data, totalBaixa, nome, unidade } }

        // 1. PRIMEIRO: Ler todos os documentos dos produtos
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
            const produtoData = itemDoc.data();
            const quantidadeComprada = item.quantidade || item.quantity || item.qtd || 1;

            // ✅ FICHA TÉCNICA: Se o produto tem insumos vinculados, acumula a baixa nos insumos
            if (Array.isArray(produtoData.fichaTecnica) && produtoData.fichaTecnica.length > 0) {
              console.log(`📋 [fichaTecnica] Produto "${produtoData.nome}" tem ${produtoData.fichaTecnica.length} insumos na ficha`);
              for (const ficha of produtoData.fichaTecnica) {
                const baixaTotal = ficha.quantidade * quantidadeComprada;
                if (!insumosParaBaixar[ficha.insumoId]) {
                  insumosParaBaixar[ficha.insumoId] = {
                    ref: null, // será preenchido depois
                    data: null,
                    totalBaixa: 0,
                    nome: ficha.nomeInsumo || 'Insumo',
                    unidade: ficha.unidade || 'g',
                  };
                }
                insumosParaBaixar[ficha.insumoId].totalBaixa += baixaTotal;
              }
            } else {
              // 🔄 COMPORTAMENTO LEGADO: baixa 1:1 no produto/variação agrupada para não sobrescrever em concorrência na transação
              if (!produtosParaAtualizar[itemRef.path]) {
                produtosParaAtualizar[itemRef.path] = {
                  ref: itemRef,
                  data: produtoData,
                  nome: item.nome || produtoData.nome || 'Produto',
                  totalBaixa: 0,
                  variacoesBaixa: {}
                };
              }
              produtosParaAtualizar[itemRef.path].totalBaixa += quantidadeComprada;
              if (extratoVariacaoId) {
                produtosParaAtualizar[itemRef.path].variacoesBaixa[extratoVariacaoId] = (produtosParaAtualizar[itemRef.path].variacoesBaixa[extratoVariacaoId] || 0) + quantidadeComprada;
              } else {
                produtosParaAtualizar[itemRef.path].variacoesBaixa['padrao_fallback'] = (produtosParaAtualizar[itemRef.path].variacoesBaixa['padrao_fallback'] || 0) + quantidadeComprada;
              }
            }
          }
        }

        // 2. LER DOCUMENTOS DOS INSUMOS (dentro da mesma transaction)
        for (const insumoId of Object.keys(insumosParaBaixar)) {
          const insumoRef = doc(db, 'estabelecimentos', estabelecimentoId, 'insumos', insumoId);
          const insumoDoc = await transaction.get(insumoRef);
          if (insumoDoc.exists()) {
            insumosParaBaixar[insumoId].ref = insumoRef;
            insumosParaBaixar[insumoId].data = insumoDoc.data();
          } else {
            console.warn(`⚠️ Insumo ${insumoId} (${insumosParaBaixar[insumoId].nome}) não encontrado no Firebase!`);
          }
        }

        // 3. APLICAR BAIXA NOS INSUMOS
        for (const insumoId of Object.keys(insumosParaBaixar)) {
          const info = insumosParaBaixar[insumoId];
          if (!info.ref || !info.data) continue;

          const estoqueAtual = Number(info.data.estoqueAtual) || 0;
          const novoEstoque = estoqueAtual - info.totalBaixa;
          const estoqueMinimo = Number(info.data.estoqueMinimo) || 0;

          console.log(`📦 [insumo] ${info.nome}: ${estoqueAtual} ${info.unidade} → ${novoEstoque} ${info.unidade} (baixa de ${info.totalBaixa})`);

          transaction.update(info.ref, {
            estoqueAtual: novoEstoque,
            ultimaBaixa: new Date(),
          });

          if (novoEstoque <= estoqueMinimo) {
            alertas.push({
              nome: `🧪 ${info.nome}`,
              estoque: novoEstoque,
              minimo: estoqueMinimo,
              tipo: 'insumo',
              unidade: info.unidade,
            });
          }
        }

        // 4. APLICAR BAIXA LEGADA NOS PRODUTOS (sem ficha técnica)
        for (const path of Object.keys(produtosParaAtualizar)) {
          const info = produtosParaAtualizar[path];
          const dados = info.data;
          const updates = {};

          // Calcula estoque geral
          let estoqueAtualGeral = typeof dados.estoque === 'number' ? dados.estoque : (typeof dados.estoqueAtual === 'number' ? dados.estoqueAtual : 0);
          let novoEstoqueGeral = estoqueAtualGeral - info.totalBaixa;
          
          updates.estoque = novoEstoqueGeral;
          // Atualiza também o legado para garantir compatibilidade
          if (dados.estoqueAtual !== undefined) {
             updates.estoqueAtual = novoEstoqueGeral;
          }

          if (novoEstoqueGeral <= (dados.estoqueMinimo || 3)) {
            alertas.push({ nome: info.nome, estoque: novoEstoqueGeral, minimo: dados.estoqueMinimo || 3 });
          }

          // Atualiza variações (se aplicável)
          let atualizouVariacao = false;
          if (Array.isArray(dados.variacoes)) {
            const variacoes = dados.variacoes.map(v => {
              let qtyToDeduct = info.variacoesBaixa[v.id] || 0;
              // Fallback se comprou variação Padrão mas não passou id da variacao corretamente no cart
              if (info.variacoesBaixa['padrao_fallback'] && v.nome === 'Padrão' && dados.variacoes.length === 1) {
                qtyToDeduct += info.variacoesBaixa['padrao_fallback'];
              }

              if (qtyToDeduct > 0) {
                atualizouVariacao = true;
                let novoEstoqueVar = (Number(v.estoque) || 0) - qtyToDeduct;
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
            transaction.update(info.ref, updates);
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