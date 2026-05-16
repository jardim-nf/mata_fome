import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { db } from '../firebaseCore.js';

// ==================================================================
// 21. CONTROLE DE ESTOQUE
// ==================================================================

/**
 * Atualiza o estoque de um produto (chamado pelo admin no painel de cardápio)
 */
export const atualizarEstoque = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId, produtoId, quantidade, controlaEstoque, estoqueMinimo } = request.data || {};
  if (!estabelecimentoId || !produtoId) {
    throw new HttpsError('invalid-argument', 'estabelecimentoId e produtoId são obrigatórios.');
  }

  const token = request.auth.token;
  const isMaster = token.isMasterAdmin === true || token.role === 'master';
  const hasAccess = token.estabelecimentos && token.estabelecimentos.includes(estabelecimentoId);

  if (!isMaster && !hasAccess) {
      throw new HttpsError('permission-denied', 'Acesso negado a este estabelecimento.');
  }

  try {
    const produtoRef = db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('cardapio').doc(produtoId);

    const update = { atualizadoEm: FieldValue.serverTimestamp() };

    if (controlaEstoque !== undefined) update.controlaEstoque = !!controlaEstoque;
    if (quantidade !== undefined) update.estoque = Number(quantidade);
    if (estoqueMinimo !== undefined) update.estoqueMinimo = Number(estoqueMinimo) || 0;

    await produtoRef.update(update);

    logger.info(`📦 Estoque atualizado: ${produtoId} → qty=${quantidade}`);
    return { sucesso: true };
  } catch (error) {
    logger.error('❌ Erro ao atualizar estoque:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Repõe/ajusta estoque em lote (ex: reabastecimento do dia)
 */
export const reporEstoque = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId, itens } = request.data || {};
  // itens: [{ produtoId, quantidade }]
  if (!estabelecimentoId || !Array.isArray(itens)) {
    throw new HttpsError('invalid-argument', 'Dados incompletos.');
  }

  const token = request.auth.token;
  const isMaster = token.isMasterAdmin === true || token.role === 'master';
  const hasAccess = token.estabelecimentos && token.estabelecimentos.includes(estabelecimentoId);

  if (!isMaster && !hasAccess) {
      throw new HttpsError('permission-denied', 'Acesso negado a este estabelecimento.');
  }

  const batch = db.batch();
  for (const item of itens) {
    if (!item.produtoId) continue;
    const ref = db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('cardapio').doc(item.produtoId);
    batch.update(ref, {
      estoque: Number(item.quantidade) || 0,
      atualizadoEm: FieldValue.serverTimestamp()
    });
  }
  await batch.commit();

  logger.info(`📦 Reposição em lote: ${itens.length} produtos para ${estabelecimentoId}`);
  return { sucesso: true, atualizados: itens.length };
});

/**
 * Busca relatório de estoque de um estabelecimento
 */
export const buscarRelatorioEstoque = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId } = request.data || {};
  if (!estabelecimentoId) throw new HttpsError('invalid-argument', 'estabelecimentoId obrigatório.');

  const token = request.auth.token;
  const isMaster = token.isMasterAdmin === true || token.role === 'master';
  const hasAccess = token.estabelecimentos && token.estabelecimentos.includes(estabelecimentoId);

  if (!isMaster && !hasAccess) {
      throw new HttpsError('permission-denied', 'Acesso negado a este estabelecimento.');
  }

  try {
    const snap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('cardapio')
      .where('controlaEstoque', '==', true)
      .get();

    const produtos = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        nome: data.nome || data.name || 'Sem nome',
        estoque: data.estoque ?? -1,
        estoqueMinimo: data.estoqueMinimo || 0,
        disponivel: data.disponivel !== false,
        baixoEstoque: data.estoqueMinimo > 0 && (data.estoque ?? 0) <= data.estoqueMinimo,
        esgotado: data.estoque !== undefined && data.estoque !== -1 && data.estoque <= 0,
        categoria: data.categoria || data.categoriaId || '',
        preco: data.preco || 0
      };
    });

    // Ordenar: esgotados primeiro, depois baixo estoque, depois normal
    produtos.sort((a, b) => {
      if (a.esgotado && !b.esgotado) return -1;
      if (!a.esgotado && b.esgotado) return 1;
      if (a.baixoEstoque && !b.baixoEstoque) return -1;
      if (!a.baixoEstoque && b.baixoEstoque) return 1;
      return a.nome.localeCompare(b.nome);
    });

    return { sucesso: true, produtos };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Processa a baixa de estoque ao realizar uma venda.
 * Calcula ficha técnica (insumos) e atualiza produtos originais no Firestore via Transaction.
 */
export const processarBaixaEstoque = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId, itens } = request.data || {};
  
  if (!estabelecimentoId || !itens || !Array.isArray(itens) || itens.length === 0) {
    return { success: true, alertas: [] };
  }

  const alertas = [];

  try {
    await db.runTransaction(async (transaction) => {
      const produtosParaAtualizar = {}; 
      const insumosParaBaixar = {}; 

      // 1. PRIMEIRO: Ler todos os documentos dos produtos
      const produtosRefMap = new Map();
      
      for (const item of itens) {
        const categoriaId = item.categoriaId || item.category || item.categoria;
        const produtoId = item.produtoIdOriginal || item.id;
        const extratoVariacaoId = item.variacaoId || item.variacaoSelecionada?.id || null;

        if (!categoriaId || !produtoId) continue;

        let itemRef = db.collection('estabelecimentos').doc(estabelecimentoId)
          .collection('cardapio').doc(categoriaId)
          .collection('itens').doc(produtoId);
          
        if (item.tipoColecao) {
           itemRef = db.collection('estabelecimentos').doc(estabelecimentoId)
             .collection('cardapio').doc(categoriaId)
             .collection(item.tipoColecao).doc(produtoId);
        }

        produtosRefMap.set(itemRef.path, { ref: itemRef, item, extratoVariacaoId });
      }

      const produtoDocs = await Promise.all(
        Array.from(produtosRefMap.values()).map(info => transaction.get(info.ref))
      );

      Array.from(produtosRefMap.values()).forEach((info, index) => {
        const itemDoc = produtoDocs[index];
        if (!itemDoc.exists) return;

        const produtoData = itemDoc.data();
        const quantidadeComprada = info.item.quantidade || info.item.quantity || info.item.qtd || 1;

        if (Array.isArray(produtoData.fichaTecnica) && produtoData.fichaTecnica.length > 0) {
          for (const ficha of produtoData.fichaTecnica) {
            const baixaTotal = ficha.quantidade * quantidadeComprada;
            if (!insumosParaBaixar[ficha.insumoId]) {
              insumosParaBaixar[ficha.insumoId] = {
                ref: db.collection('estabelecimentos').doc(estabelecimentoId).collection('insumos').doc(ficha.insumoId),
                totalBaixa: 0,
                nome: ficha.nomeInsumo || 'Insumo',
                unidade: ficha.unidade || 'g',
              };
            }
            insumosParaBaixar[ficha.insumoId].totalBaixa += baixaTotal;
          }
        } else {
          if (!produtosParaAtualizar[info.ref.path]) {
            produtosParaAtualizar[info.ref.path] = {
              ref: info.ref,
              data: produtoData,
              nome: info.item.nome || produtoData.nome || 'Produto',
              totalBaixa: 0,
              variacoesBaixa: {}
            };
          }
          produtosParaAtualizar[info.ref.path].totalBaixa += quantidadeComprada;
          if (info.extratoVariacaoId) {
            produtosParaAtualizar[info.ref.path].variacoesBaixa[info.extratoVariacaoId] = (produtosParaAtualizar[info.ref.path].variacoesBaixa[info.extratoVariacaoId] || 0) + quantidadeComprada;
          } else {
            produtosParaAtualizar[info.ref.path].variacoesBaixa['padrao_fallback'] = (produtosParaAtualizar[info.ref.path].variacoesBaixa['padrao_fallback'] || 0) + quantidadeComprada;
          }
        }
      });

      // 2. Ler Insumos
      const insumosValues = Object.values(insumosParaBaixar);
      const insumoDocs = await Promise.all(insumosValues.map(info => transaction.get(info.ref)));

      insumosValues.forEach((info, index) => {
        const docSnap = insumoDocs[index];
        if (docSnap.exists) {
           info.data = docSnap.data();
        }
      });

      // 3. Atualizar Insumos
      for (const info of insumosValues) {
        if (!info.data) continue;
        const estoqueAtual = Number(info.data.estoqueAtual) || 0;
        const novoEstoque = estoqueAtual - info.totalBaixa;
        const estoqueMinimo = Number(info.data.estoqueMinimo) || 0;

        transaction.update(info.ref, {
          estoqueAtual: novoEstoque,
          ultimaBaixa: FieldValue.serverTimestamp(),
        });

        if (novoEstoque <= estoqueMinimo) {
          alertas.push({ nome: `🧪 ${info.nome}`, estoque: novoEstoque, minimo: estoqueMinimo, tipo: 'insumo', unidade: info.unidade });
        }
      }

      // 4. Atualizar Produtos sem Ficha Técnica
      for (const path of Object.keys(produtosParaAtualizar)) {
        const info = produtosParaAtualizar[path];
        const dados = info.data;
        const updates = {};

        let estoqueAtualGeral = typeof dados.estoque === 'number' ? dados.estoque : (typeof dados.estoqueAtual === 'number' ? dados.estoqueAtual : 0);
        let novoEstoqueGeral = estoqueAtualGeral - info.totalBaixa;
        
        updates.estoque = novoEstoqueGeral;
        if (dados.estoqueAtual !== undefined) updates.estoqueAtual = novoEstoqueGeral;

        if (novoEstoqueGeral <= (dados.estoqueMinimo || 3)) {
          alertas.push({ nome: info.nome, estoque: novoEstoqueGeral, minimo: dados.estoqueMinimo || 3 });
        }

        let atualizouVariacao = false;
        if (Array.isArray(dados.variacoes)) {
          const variacoes = dados.variacoes.map(v => {
            let qtyToDeduct = info.variacoesBaixa[v.id] || 0;
            if (info.variacoesBaixa['padrao_fallback'] && v.nome === 'Padrão' && dados.variacoes.length === 1) {
              qtyToDeduct += info.variacoesBaixa['padrao_fallback'];
            }
            if (qtyToDeduct > 0) {
              atualizouVariacao = true;
              return { ...v, estoque: (Number(v.estoque) || 0) - qtyToDeduct };
            }
            return v;
          });

          if (atualizouVariacao) {
            updates.variacoes = variacoes;
            const somaVariacoes = variacoes.reduce((acc, v) => acc + (Number(v.estoque) || 0), 0);
            updates.estoque = somaVariacoes;
            if (dados.estoqueAtual !== undefined) updates.estoqueAtual = somaVariacoes;
          }
        }

        if (Object.keys(updates).length > 0) {
          updates.ultimaBaixa = FieldValue.serverTimestamp();
          transaction.update(info.ref, updates);
        }
      }
    });

    logger.info('📦 Baixa de estoque processada no servidor com sucesso.');
    return { success: true, alertas };
  } catch (error) {
    logger.error('Erro ao processar baixa de estoque:', error);
    throw new HttpsError('internal', error.message);
  }
});
