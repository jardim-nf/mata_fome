import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { db } from '../firebaseCore.js';

// ==================================================================
// 22. ACERTO COM MOTOBOYS
// ==================================================================

/**
 * Gera relatório de acerto para um motoboy em um período
 */
export const gerarAcertoMotoboy = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId, motoboyId, dataInicio, dataFim } = request.data || {};
  if (!estabelecimentoId || !motoboyId || !dataInicio || !dataFim) {
    throw new HttpsError('invalid-argument', 'estabelecimentoId, motoboyId, dataInicio e dataFim são obrigatórios.');
  }

  try {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    fim.setHours(23, 59, 59, 999);

    // Buscar pedidos do motoboy no período
    const pedidosSnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('pedidos')
      .where('motoboyId', '==', motoboyId)
      .get();

    // Filtrar por período manualmente (Firestore não suporta múltiplos where em campos diferentes sem índice)
    const pedidosFiltrados = [];
    pedidosSnap.forEach(doc => {
      const p = doc.data();
      const dataEntrega = p.dataEntrega?.toDate?.() || (p.dataEntrega ? new Date(p.dataEntrega) : null);
      const dataCriadoEm = p.criadoEm?.toDate?.() || (p.criadoEm ? new Date(p.criadoEm) : null);
      const dataRef = dataEntrega || dataCriadoEm;

      if (dataRef && dataRef >= inicio && dataRef <= fim) {
        pedidosFiltrados.push({
          id: doc.id,
          ...p,
          _dataRef: dataRef
        });
      }
    });

    // Buscar dados do motoboy
    const motoboySnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('entregadores').doc(motoboyId).get();
    const motoboyData = motoboySnap.exists() ? motoboySnap.data() : {};

    // Calcular totais
    let totalEntregas = 0;
    let totalValor = 0;

    const pedidosAcerto = pedidosFiltrados.map(p => {
      const taxaEntrega = Number(p.taxaEntregaMotoboy || p.taxaEntrega || motoboyData.valorPorEntrega || 0);
      totalEntregas++;
      totalValor += taxaEntrega;
      return {
        pedidoId: p.id,
        vendaId: p.vendaId || p.id,
        clienteNome: p.cliente?.nome || p.clienteNome || 'Cliente',
        totalPedido: p.totalFinal || p.total || 0,
        taxaEntrega,
        dataEntrega: p._dataRef?.toISOString?.() || null,
        status: p.status || 'finalizado',
        formaPagamento: p.formaPagamento || '',
        enderecoEntrega: p.endereco?.rua ? `${p.endereco.rua}, ${p.endereco.numero}` : ''
      };
    });

    // Salvar o acerto no Firestore
    const acertoRef = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('acertos').add({
        motoboyId,
        motoboyNome: motoboyData.nome || 'Motoboy',
        motoboyTelefone: motoboyData.telefone || '',
        motoboyPix: motoboyData.pixKey || '',
        periodo: { inicio: inicio, fim: fim },
        periodo_str: `${inicio.toLocaleDateString('pt-BR')} a ${fim.toLocaleDateString('pt-BR')}`,
        pedidos: pedidosAcerto,
        totalEntregas,
        totalValor,
        status: 'pendente',
        pago: false,
        criadoEm: FieldValue.serverTimestamp(),
        criadoPor: uid
      });

    logger.info(`✅ Acerto gerado: ${acertoRef.id} | motoboy=${motoboyId} | entregas=${totalEntregas} | R$${totalValor}`);

    return {
      sucesso: true,
      acertoId: acertoRef.id,
      motoboyNome: motoboyData.nome || 'Motoboy',
      totalEntregas,
      totalValor,
      pedidos: pedidosAcerto
    };
  } catch (error) {
    logger.error('❌ Erro ao gerar acerto:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Marca um acerto como pago
 */
export const marcarAcertoPago = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId, acertoId } = request.data || {};
  if (!estabelecimentoId || !acertoId) throw new HttpsError('invalid-argument', 'Dados incompletos.');

  try {
    await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('acertos').doc(acertoId).update({
        pago: true,
        status: 'pago',
        pagoEm: FieldValue.serverTimestamp(),
        pagoPor: uid
      });

    logger.info(`✅ Acerto ${acertoId} marcado como pago por ${uid}`);
    return { sucesso: true };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Lista acertos de um estabelecimento (com filtro opcional por motoboy)
 */
export const listarAcertosMotoboy = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId, motoboyId } = request.data || {};
  if (!estabelecimentoId) throw new HttpsError('invalid-argument', 'estabelecimentoId obrigatório.');

  try {
    let q = db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('acertos').orderBy('criadoEm', 'desc').limit(50);

    const snap = await q.get();
    let lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (motoboyId) {
      lista = lista.filter(a => a.motoboyId === motoboyId);
    }

    return { sucesso: true, lista };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

