import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { db } from '../firebaseCore.js';
import { verifyAdminAccess } from '../authUtils.js';

/**
 * Função para registrar histórico de movimentação de estoque.
 */
const registrarHistoricoEstoque = async (estabelecimentoId, insumoId, nome, quantidadeAnterior, quantidadeNova, tipo, uid) => {
  try {
    const historicoRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('historico_estoque');
    await historicoRef.add({
      insumoId,
      nome,
      quantidadeAnterior,
      quantidadeNova,
      tipo,
      data: FieldValue.serverTimestamp(),
      usuario: uid,
    });
    logger.info(`🔍 Histórico de estoque registrado para insumo: ${insumoId}`);
  } catch (error) {
    logger.error('Erro ao registrar histórico de estoque:', error);
  }
};

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

  await verifyAdminAccess(request, estabelecimentoId);

  try {
    const produtoRef = db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('cardapio').doc(produtoId);

    const produtoSnapshot = await produtoRef.get();
    const produtoData = produtoSnapshot.data();
    const quantidadeAnterior = produtoData.estoque;

    const update = { atualizadoEm: FieldValue.serverTimestamp() };

    if (controlaEstoque !== undefined) update.controlaEstoque = !!controlaEstoque;
    if (quantidade !== undefined) update.estoque = Number(quantidade);
    if (estoqueMinimo !== undefined) update.estoqueMinimo = Number(estoqueMinimo) || 0;

    await produtoRef.update(update);

    logger.info(`📦 Estoque atualizado: ${produtoId} → qty=${quantidade}`);

    if (quantidade !== undefined) {
      await registrarHistoricoEstoque(estabelecimentoId, produtoId, produtoData.nome, quantidadeAnterior, quantidade, 'correção', uid);
    }

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

  await verifyAdminAccess(request, estabelecimentoId);

  const batch = db.batch();
  const historicoTransactions = [];

  for (const item of itens) {
    if (!item.produtoId) continue;

    const ref = db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('cardapio').doc(item.produtoId);
    const produtoSnapshot = await ref.get();
    const produtoData = produtoSnapshot.data();
    const quantidadeAnterior = produtoData.estoque;

    batch.update(ref, {
      estoque: Number(item.quantidade) || 0,
      atualizadoEm: FieldValue.serverTimestamp()
    });

    historicoTransactions.push(
      registrarHistoricoEstoque(estabelecimentoId, item.produtoId, produtoData.nome, quantidadeAnterior, item.quantidade, 'entrada', uid)
    );
  }

  await Promise.all([
    batch.commit(),
    ...historicoTransactions
  ]);

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

  await verifyAdminAccess(request, estabelecimentoId);

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

  const { estabelecimentoId, itens, operacao } = request.data || {};
  
  if (!estabelecimentoId || !itens || !Array.isArray(itens) || itens.length === 0) {
    return { success: true, alertas: [] };
  }

  try {
    const { alterarEstoqueSeguro } = await import('../estoqueHelper.js');
    const result = await alterarEstoqueSeguro(estabelecimentoId, itens, operacao || 'saida', uid);
    logger.info(`📦 Movimentação de estoque (${operacao || 'saida'}) processada no servidor.`);
    return result;
  } catch (error) {
    logger.error('Erro ao processar estoque:', error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', error.message);
  }
});