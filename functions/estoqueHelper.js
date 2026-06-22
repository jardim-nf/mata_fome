// functions/estoqueHelper.js
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firebaseCore.js';
import * as logger from 'firebase-functions/logger';
import { HttpsError } from 'firebase-functions/v2/https';

/**
 * Função interna para registrar histórico de movimentação de estoque.
 */
const registrarHistoricoEstoqueLocal = async (estabelecimentoId, insumoId, nome, quantidadeAnterior, quantidadeNova, tipo, uid) => {
  try {
    const historicoRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('historico_estoque');
    await historicoRef.add({
      insumoId,
      nome,
      quantidadeAnterior: quantidadeAnterior !== undefined ? quantidadeAnterior : null,
      quantidadeNova: quantidadeNova !== undefined ? quantidadeNova : null,
      tipo,
      data: FieldValue.serverTimestamp(),
      usuario: uid || 'sistema',
    });
    logger.info(`🔍 Histórico de estoque registrado para: ${insumoId} (${tipo})`);
  } catch (error) {
    logger.error('Erro ao registrar histórico de estoque:', error);
  }
};

/**
 * Lógica unificada para alteração de estoque (baixa ou estorno).
 * Roda de forma atômica e segura, suportando produtos com variações e insumos (ficha técnica).
 * 
 * @param {string} estabelecimentoId ID do estabelecimento
 * @param {Array} itens Lista de itens do pedido/venda
 * @param {string} operacao 'saida' (baixa/venda) ou 'entrada' (estorno/cancelamento)
 * @param {string} uidId ID do usuário/funcionário
 * @param {Transaction} txn (Opcional) Instância de transação existente
 */
export const alterarEstoqueSeguro = async (estabelecimentoId, itens, operacao = 'saida', uidId = 'sistema', txn = null) => {
  if (!estabelecimentoId || !itens || !Array.isArray(itens) || itens.length === 0) {
    logger.info('⚠️ [alterarEstoqueSeguro] Ignorando alteração (sem estabelecimento ou sem itens)');
    return { success: true, alertas: [] };
  }

  const executarLogica = async (transaction) => {
    const produtosParaAtualizar = {};
    const insumosParaAtualizar = {};
    const historicoTransactions = [];
    const alertas = [];

    const produtosRefMap = new Map();

    for (const item of itens) {
      const categoriaId = item.categoriaId || item.category || item.categoria;
      const produtoId = item.produtoIdOriginal || item.id;
      const extratoVariacaoId = item.variacaoId || item.variacaoSelecionada?.id || null;

      if (!categoriaId || !produtoId) continue;

      // Caminho correto da coleção: itens
      const tipoColecao = item.tipoColecao || 'itens';

      const itemRef = db.collection('estabelecimentos').doc(estabelecimentoId)
        .collection('cardapio').doc(categoriaId)
        .collection(tipoColecao).doc(produtoId);

      const key = itemRef.path;
      if (!produtosRefMap.has(key)) {
        produtosRefMap.set(key, { ref: itemRef, itensList: [] });
      }
      produtosRefMap.get(key).itensList.push({ item, extratoVariacaoId });
    }

    const refList = Array.from(produtosRefMap.values());
    if (refList.length === 0) return { success: true, alertas: [] };

    // Carrega todos os produtos na transação de uma vez
    const produtoDocs = await Promise.all(
      refList.map(info => transaction.get(info.ref))
    );

    refList.forEach((info, index) => {
      const itemDoc = produtoDocs[index];
      if (!itemDoc.exists) {
        logger.warn(`⚠️ [alterarEstoqueSeguro] Produto não encontrado no banco: ${info.ref.path}`);
        return;
      }

      const produtoData = itemDoc.data();

      for (const ocorrencia of info.itensList) {
        const itemObj = ocorrencia.item;
        const extratoVariacaoId = ocorrencia.extratoVariacaoId;
        const quantidadeComprada = Number(itemObj.quantidade || itemObj.quantity || itemObj.qtd) || 1;
        const multiplicador = operacao === 'saida' ? -1 : 1;
        const delta = quantidadeComprada * multiplicador;

        const quantidadeAnterior = produtoData.estoque;

        // Ficha técnica (Insumos)
        if (Array.isArray(produtoData.fichaTecnica) && produtoData.fichaTecnica.length > 0) {
          for (const ficha of produtoData.fichaTecnica) {
            const baixaTotal = (Number(ficha.quantidade) || 0) * delta;
            if (!insumosParaAtualizar[ficha.insumoId]) {
              insumosParaAtualizar[ficha.insumoId] = {
                ref: db.collection('estabelecimentos').doc(estabelecimentoId).collection('insumos').doc(ficha.insumoId),
                delta: 0,
                nome: ficha.nomeInsumo || 'Insumo',
                unidade: ficha.unidade || 'g',
              };
            }
            insumosParaAtualizar[ficha.insumoId].delta += baixaTotal;
          }
        } else {
          // Produto comum
          if (!produtosParaAtualizar[info.ref.path]) {
            produtosParaAtualizar[info.ref.path] = {
              ref: info.ref,
              data: produtoData,
              nome: itemObj.nome || produtoData.nome || 'Produto',
              deltaTotal: 0,
              variacoesDelta: {}
            };
          }
          produtosParaAtualizar[info.ref.path].deltaTotal += delta;
          
          let variacaoResolvida = null;
          if (Array.isArray(produtoData.variacoes) && produtoData.variacoes.length > 0) {
            const varId = extratoVariacaoId;
            const varNome = itemObj.variacaoNome || itemObj.variacaoSelecionada?.nome || itemObj.variacao || itemObj.opcaoSelecionada || null;

            if (varId) {
              variacaoResolvida = produtoData.variacoes.find(v => v.id === varId);
            }
            if (!variacaoResolvida && varNome) {
              variacaoResolvida = produtoData.variacoes.find(v => v.nome === varNome);
            }
            if (!variacaoResolvida && produtoData.variacoes.length === 1) {
              variacaoResolvida = produtoData.variacoes[0];
            }
          }

          if (variacaoResolvida) {
            const keyVar = variacaoResolvida.id || variacaoResolvida.nome;
            produtosParaAtualizar[info.ref.path].variacoesDelta[keyVar] = (produtosParaAtualizar[info.ref.path].variacoesDelta[keyVar] || 0) + delta;
          } else {
            produtosParaAtualizar[info.ref.path].variacoesDelta['padrao_fallback'] = (produtosParaAtualizar[info.ref.path].variacoesDelta['padrao_fallback'] || 0) + delta;
          }
        }

        const estoqueAtualGeral = typeof produtoData.estoque === 'number' ? produtoData.estoque : 0;
        const novoEstoqueGeral = estoqueAtualGeral + delta;

        historicoTransactions.push(
          registrarHistoricoEstoqueLocal(estabelecimentoId, info.ref.id, produtoData.nome, quantidadeAnterior, novoEstoqueGeral, operacao, uidId)
        );
      }
    });

    // 1. Atualizar Insumos
    const insumosValues = Object.values(insumosParaAtualizar);
    if (insumosValues.length > 0) {
      const insumoDocs = await Promise.all(insumosValues.map(info => transaction.get(info.ref)));
      insumosValues.forEach((info, index) => {
        const docSnap = insumoDocs[index];
        if (docSnap.exists) {
          const dataInsumo = docSnap.data();
          const estoqueAtual = Number(dataInsumo.estoqueAtual) || 0;
          const novoEstoque = estoqueAtual + info.delta;
          const estoqueMinimo = Number(dataInsumo.estoqueMinimo) || 0;

          transaction.update(info.ref, {
            estoqueAtual: novoEstoque,
            ultimaBaixa: FieldValue.serverTimestamp(),
          });

          if (operacao === 'saida' && novoEstoque <= estoqueMinimo) {
            alertas.push({ nome: `🧪 ${info.nome}`, estoque: novoEstoque, minimo: estoqueMinimo, tipo: 'insumo', unidade: info.unidade });
          }
        }
      });
    }

    // 2. Atualizar Produtos
    for (const path of Object.keys(produtosParaAtualizar)) {
      const info = produtosParaAtualizar[path];
      const dados = info.data;
      const updates = {};

      let estoqueAtualGeral = typeof dados.estoque === 'number' ? dados.estoque : 0;
      let novoEstoqueGeral = estoqueAtualGeral + info.deltaTotal;
      
      if (typeof dados.estoque === 'number' && dados.controlaEstoque !== false && operacao === 'saida' && novoEstoqueGeral < 0) {
        throw new HttpsError(
          'failed-precondition',
          `Estoque insuficiente para o produto "${info.nome}". Estoque atual: ${estoqueAtualGeral}, solicitado: ${Math.abs(info.deltaTotal)}.`
        );
      }
      if (novoEstoqueGeral < 0) novoEstoqueGeral = 0;
      
      updates.estoque = novoEstoqueGeral;
      // Manter retrocompatibilidade com o campo estoqueAtual se existia
      if (dados.estoqueAtual !== undefined || dados.estoque !== undefined) {
        updates.estoqueAtual = novoEstoqueGeral;
      }

      if (operacao === 'saida' && novoEstoqueGeral <= (dados.estoqueMinimo || 3)) {
        alertas.push({ nome: info.nome, estoque: novoEstoqueGeral, minimo: dados.estoqueMinimo || 3 });
      }

      let atualizouVariacao = false;
      if (Array.isArray(dados.variacoes)) {
        const variacoes = [];
        for (const v of dados.variacoes) {
          const keyVar = v.id || v.nome;
          let qtyDelta = info.variacoesDelta[keyVar] || 0;
          if (info.variacoesDelta['padrao_fallback'] && dados.variacoes.length === 1) {
            qtyDelta += info.variacoesDelta['padrao_fallback'];
          }
          if (qtyDelta !== 0) {
            atualizouVariacao = true;
            let novoEstoqueVar = (Number(v.estoque) || 0) + qtyDelta;
            if (typeof v.estoque === 'number' && dados.controlaEstoque !== false && operacao === 'saida' && novoEstoqueVar < 0) {
              throw new HttpsError(
                'failed-precondition',
                `Estoque insuficiente para o produto "${info.nome}" (Variação: "${v.nome}"). Estoque atual: ${v.estoque || 0}, solicitado: ${Math.abs(qtyDelta)}.`
              );
            }
            if (novoEstoqueVar < 0) novoEstoqueVar = 0;
            variacoes.push({ ...v, estoque: novoEstoqueVar });
          } else {
            variacoes.push(v);
          }
        }

        if (atualizouVariacao) {
          updates.variacoes = variacoes;
          const somaVariacoes = variacoes.reduce((acc, v) => acc + (Number(v.estoque) || 0), 0);
          updates.estoque = somaVariacoes;
          updates.estoqueAtual = somaVariacoes;
        }
      }

      if (Object.keys(updates).length > 0) {
        updates.ultimaBaixa = FieldValue.serverTimestamp();
        transaction.update(info.ref, updates);
      }
    }

    await Promise.all(historicoTransactions);
    return { success: true, alertas };
  };

  if (txn) {
    return await executarLogica(txn);
  } else {
    return await db.runTransaction(executarLogica);
  }
};
