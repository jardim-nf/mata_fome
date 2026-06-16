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
 * Exporta a função para registrar o histórico de movimentação de estoque.
 */
export const historicoMovimentacaoEstoque = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId, insumoId, nome, quantidadeAnterior, quantidadeNova, tipo } = request.data;
  if (!estabelecimentoId || !insumoId || !nome || quantidadeAnterior === undefined || quantidadeNova === undefined || !tipo) {
    throw new HttpsError('invalid-argument', 'Parâmetros incompletos.');
  }

  await verifyAdminAccess(request, estabelecimentoId);

  await registrarHistoricoEstoque(estabelecimentoId, insumoId, nome, quantidadeAnterior, quantidadeNova, tipo, uid);

  return { sucesso: true, mensagem: 'Histórico registrado com sucesso.' };
});