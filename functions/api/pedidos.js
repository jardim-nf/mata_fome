import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import * as functionsV1 from 'firebase-functions';
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { db } from '../firebaseCore.js';

// ==================================================================
// 2. CRIAR PEDIDO SEGURO
// ==================================================================
export const criarPedidoSeguro = onCall({ cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');

    const dadosPedido = request.data;
    const { itens, estabelecimentoId, ...outrosDados } = dadosPedido;

    if (!itens || !estabelecimentoId) throw new HttpsError('invalid-argument', 'Dados do pedido incompletos.');

    let totalCalculado = 0;
    const itensProcessados = [];

    try {
        for (const item of itens) {
            if (!item.id) continue;

            // FIX: caminho correto da subcoleção do cardápio
            const categoriaId = item.categoriaId || item.category || item.categoria;
            if (!categoriaId) {
                throw new HttpsError('invalid-argument', `Item sem categoriaId: ${item.nome || item.id}`);
            }
            const produtoRef = db.doc(`estabelecimentos/${estabelecimentoId}/cardapio/${categoriaId}/itens/${item.id}`);
            const produtoSnap = await produtoRef.get();

            if (!produtoSnap.exists) {
                throw new HttpsError('not-found', `Produto indisponível: ${item.nome || 'Item removido'}`);
            }

            const produtoReal = produtoSnap.data();
            let precoUnitarioReal = Number(produtoReal.preco) || 0;

            if (item.variacaoSelecionada) {
                const variacoesReais = produtoReal.variacoes || [];
                const variacaoEncontrada = variacoesReais.find(v =>
                    (item.variacaoSelecionada.id && v.id === item.variacaoSelecionada.id) ||
                    (item.variacaoSelecionada.nome && v.nome === item.variacaoSelecionada.nome)
                );
                if (variacaoEncontrada) precoUnitarioReal = Number(variacaoEncontrada.preco);
            }

            let totalAdicionais = 0;
            if (Array.isArray(item.adicionais) && item.adicionais.length > 0) {
                const adicionaisValidados = await Promise.all(
                    item.adicionais.map(async (ad) => {
                        if (!ad.id) return 0;
                        try {
                            const adRef = db.doc(`estabelecimentos/${estabelecimentoId}/adicionais/${ad.id}`);
                            const adSnap = await adRef.get();
                            if (!adSnap.exists) return 0;
                            return Number(adSnap.data().preco) || 0;
                        } catch {
                            return 0;
                        }
                    })
                );
                totalAdicionais = adicionaisValidados.reduce((acc, v) => acc + v, 0);
            }

            const precoFinalItem = precoUnitarioReal + totalAdicionais;
            totalCalculado += precoFinalItem * (Number(item.quantidade) || 1);

            itensProcessados.push({
                ...item,
                preco: precoUnitarioReal,
                precoFinal: precoFinalItem,
                fiscal: produtoReal.fiscal || null
            });
        }

        const vendaFinal = {
            ...outrosDados,
            estabelecimentoId,
            userId: request.auth.uid,
            itens: itensProcessados,
            total: totalCalculado,
            status: 'pendente',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            origem: 'app_web_seguro'
        };

        const novaVendaRef = db.collection('vendas').doc();
        await novaVendaRef.set(vendaFinal);

        logger.info(`✅ Pedido Criado: ${novaVendaRef.id} | Total: R$ ${totalCalculado}`);

        return {
            success: true,
            vendaId: novaVendaRef.id,
            totalValidado: totalCalculado
        };

    } catch (error) {
        logger.error("❌ Falha em criarPedidoSeguro:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'Erro interno ao processar pedido.', error.message);
    }
});

export const atualizarStatusPedidoBackend = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');

  const { estabelecimentoId, pedidoId, novoStatus, newStatus, formaPagamento } = request.data || {};
  const statusToUpdate = novoStatus || newStatus;
  
  if (!estabelecimentoId || !pedidoId) {
    throw new HttpsError('invalid-argument', 'Dados incompletos (estabelecimentoId, pedidoId).');
  }
  
  if (!statusToUpdate && !formaPagamento) {
      throw new HttpsError('invalid-argument', 'Nenhuma atualização fornecida.');
  }

  const { verifyAdminAccess } = await import('../authUtils.js');
  await verifyAdminAccess(request, estabelecimentoId);

  try {
    const pedidoRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('pedidos').doc(pedidoId);
    
    const updateData = { updatedAt: FieldValue.serverTimestamp() };
    if (statusToUpdate) updateData.status = statusToUpdate;
    if (formaPagamento) updateData.formaPagamento = formaPagamento;
    
    await pedidoRef.update(updateData);
    return { success: true };
  } catch (error) {
    logger.error("Erro em atualizarStatusPedidoBackend:", error);
    throw new HttpsError('internal', error.message);
  }
});

export const atribuirMotoboyBackend = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');

  const { estabelecimentoId, pedidoId, motoboyId, motoboyNome } = request.data || {};
  if (!estabelecimentoId || !pedidoId || !motoboyId) {
    throw new HttpsError('invalid-argument', 'Dados incompletos (estabelecimentoId, pedidoId ou motoboyId).');
  }

  const { verifyAdminAccess } = await import('../authUtils.js');
  await verifyAdminAccess(request, estabelecimentoId);

  try {
    const pedidoRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('pedidos').doc(pedidoId);
    await pedidoRef.update({
      motoboyId,
      motoboyNome: motoboyNome || '',
      status: 'em_entrega',
      updatedAt: FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    logger.error("Erro em atribuirMotoboyBackend:", error);
    throw new HttpsError('internal', error.message);
  }
});

export const atualizarFormaPagamentoPedidoBackend = functionsV1.https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) throw new functionsV1.https.HttpsError('unauthenticated', 'Usuário não autenticado.');

  const { estabelecimentoId, pedidoId, formaPagamento, novaForma } = data || {};
  const pgtoToUpdate = formaPagamento || novaForma;
  if (!estabelecimentoId || !pedidoId || !pgtoToUpdate) {
    throw new functionsV1.https.HttpsError('invalid-argument', 'Dados incompletos.');
  }

  const { verifyAdminAccess } = await import('../authUtils.js');
  await verifyAdminAccess({ auth: context.auth }, estabelecimentoId);

  try {
    const pedidoRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('pedidos').doc(pedidoId);
    await pedidoRef.update({
      formaPagamento: pgtoToUpdate,
      updatedAt: FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    logger.error("Erro em atualizarFormaPagamentoPedidoBackend:", error);
    throw new functionsV1.https.HttpsError('internal', error.message);
  }
});

// ==================================================================
// 4. SALVAR VENDA GERAL (PDV / DELIVERY)
// ==================================================================

export const salvarVendaBackend = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');

  const { vendaData } = request.data || {};
  if (!vendaData || !vendaData.estabelecimentoId) {
    throw new HttpsError('invalid-argument', 'Dados de venda incompletos.');
  }

  const { estabelecimentoId } = vendaData;
  const { verifyAdminAccess } = await import('../authUtils.js');
  await verifyAdminAccess(request, estabelecimentoId);

  try {
    const batch = db.batch();
    
    // Se _apenasEstoque, a venda já foi salva diretamente pelo frontend (Venda Rápida)
    // Nesse caso, só precisamos fazer a baixa de estoque
    const apenasEstoque = vendaData._apenasEstoque === true;
    const itens = vendaData.itens || vendaData.pedidos || [];
    
    if (!apenasEstoque) {
      if (vendaData.pedidoId) {
        const querySnap = await db.collection('vendas')
          .where('pedidoId', '==', vendaData.pedidoId)
          .limit(1)
          .get();
        if (!querySnap.empty) {
          const docExistente = querySnap.docs[0];
          logger.info(`🚨 [salvarVendaBackend] Venda já existente para o pedidoId ${vendaData.pedidoId}. Ignorando criação e retornando ID: ${docExistente.id}`);
          return {
            success: true,
            vendaId: docExistente.id,
            total: docExistente.data().total,
            _estoqueBaixado: true
          };
        }
      }

      const vendaRef = db.collection('vendas').doc();
      
      const novaVenda = {
          ...vendaData,
          id: vendaRef.id,
          createdAt: FieldValue.serverTimestamp(),
          criadoEm: FieldValue.serverTimestamp(),
          funcionarioId: uid,
          funcionario: request.auth.token?.name || request.auth.token?.email || 'Sistema'
      };

      batch.set(vendaRef, novaVenda);
      // Usado no retorno
      vendaData._vendaRefId = vendaRef.id;
    }

    // Se veio de um pedido (Delivery), precisamos atualizar o pedido original para marcar como pago/finalizado
    if (!apenasEstoque && (vendaData.pedidoId || vendaData.id)) {
        const pedidoId = vendaData.pedidoId || vendaData.id;
        const refId = vendaData._vendaRefId || '';
        // Só atualiza se o ID não for temporário/inexistente e a origem for apropriada
        if (vendaData.origem !== 'pdv' && pedidoId && pedidoId !== refId) {
            const pedidoRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('pedidos').doc(pedidoId);
            batch.update(pedidoRef, {
                pago: true,
                status: 'finalizado',
                dataFinalizado: FieldValue.serverTimestamp(),
                formaPagamento: vendaData.formaPagamento || 'N/A'
            });
        }
    }

    // Executa a baixa de estoque de forma segura pré-venda
    const { alterarEstoqueSeguro } = await import('../estoqueHelper.js');
    await alterarEstoqueSeguro(estabelecimentoId, itens, 'saida', uid);

    if (!apenasEstoque) {
        await batch.commit();
    }

    return { 
        success: true, 
        vendaId: vendaData._vendaRefId || vendaData.vendaIdExistente || 'estoque-only', 
        total: vendaData.total,
        _estoqueBaixado: true 
    };

  } catch (error) {
    logger.error("Erro em salvarVendaBackend:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message);
  }
});

// ==================================================================
// 5. FINALIZAR CHECKOUT DELIVERY (Seguro)
// ==================================================================
export const finalizarCheckoutDelivery = onCall({ cors: true }, async (request) => {
    try {
        const uid = request.auth?.uid;
        if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');

        const dados = request.data;
        
        // Import dynamic to avoid circular dependencies if any
        const { processarCheckoutDeliveryService } = await import('../services/pedidosService.js');
        const result = await processarCheckoutDeliveryService(uid, dados);
        
        logger.info(`✅ [Delivery] Pedido ${result.pedidoId} criado com sucesso. Total: R$ ${result.totalFinal}`);
        return result;

    } catch (e) {
        logger.error("Erro interno ao finalizar checkout (Geral):", e);
        if (e instanceof HttpsError) throw e;
        throw new HttpsError('internal', e.message || 'Erro interno ao finalizar checkout.');
    }
});

// ==================================================================
// 6. CANCELAR PEDIDO BACKEND
// ==================================================================
export const cancelarPedidoBackend = onCall({ cors: true }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');

    const { estabelecimentoId, pedidoId } = request.data || {};
    if (!estabelecimentoId || !pedidoId) {
        throw new HttpsError('invalid-argument', 'Dados incompletos (estabelecimentoId ou pedidoId).');
    }

    const { verifyAdminAccess } = await import('../authUtils.js');
    await verifyAdminAccess(request, estabelecimentoId);

    try {
        const pedidoRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('pedidos').doc(pedidoId);
        const pedidoSnap = await pedidoRef.get();
        
        if (!pedidoSnap.exists) {
            throw new HttpsError('not-found', 'Pedido não encontrado.');
        }

        const pedidoData = pedidoSnap.data();
        if (pedidoData.status === 'cancelado') {
            throw new HttpsError('failed-precondition', 'Este pedido já está cancelado.');
        }

        const batch = db.batch();

        // 1. Atualizar status para cancelado
        batch.update(pedidoRef, {
            status: 'cancelado',
            updatedAt: FieldValue.serverTimestamp(),
            canceladoEm: FieldValue.serverTimestamp(),
            canceladoPor: uid
        });

        // 2. Estornar Cashback (se houve resgate)
        if (pedidoData.cashbackResgatado > 0 && pedidoData.clienteId) {
            const clienteRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('clientes').doc(pedidoData.clienteId);
            batch.set(clienteRef, {
                saldoCashback: FieldValue.increment(pedidoData.cashbackResgatado)
            }, { merge: true });
        }

        // 3. Estornar Usos do Cupom
        if (pedidoData.cupomAplicado) {
            const cupomRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('cupons').doc(pedidoData.cupomAplicado);
            batch.set(cupomRef, {
                usos: FieldValue.increment(-1)
            }, { merge: true });
        }

        // 4. Sincronizar cancelamento de itens na mesa comanda (se aplicável)
        if (pedidoData.mesaId) {
            try {
                const mesaRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('mesas').doc(pedidoData.mesaId);
                const mesaSnap = await mesaRef.get();
                if (mesaSnap.exists) {
                    const mesaData = mesaSnap.data();
                    const mesaItens = mesaData.itens || [];

                    const novosItensMesa = mesaItens.map(item => {
                        if (item.pedidoCozinhaId === pedidoId) {
                            return { ...item, status: 'cancelado' };
                        }
                        return item;
                    });

                    const novoTotalMesa = novosItensMesa.reduce((acc, i) => 
                        i.status === 'cancelado' ? acc : acc + ((Number(i.preco) || 0) * (Number(i.quantidade) || 1)), 
                        0
                    );

                    batch.update(mesaRef, {
                        itens: novosItensMesa,
                        total: novoTotalMesa,
                        updatedAt: FieldValue.serverTimestamp()
                    });
                }
            } catch (mesaError) {
                logger.error("⚠️ Erro ao atualizar mesa comanda durante cancelamento de pedido:", mesaError);
            }
        }

        await batch.commit();

        // Estorno de estoque seguro
        try {
          if (pedidoData.itens && pedidoData.itens.length > 0) {
            const { alterarEstoqueSeguro } = await import('../estoqueHelper.js');
            await alterarEstoqueSeguro(estabelecimentoId, pedidoData.itens, 'entrada', uid);
          }
        } catch (estError) {
          logger.error("⚠️ Falha no estorno de estoque seguro pós-cancelamento:", estError);
        }

        logger.info(`✅ Pedido ${pedidoId} cancelado com sucesso por ${uid}. Estoque e cashback estornados se aplicável.`);

        return { success: true, message: 'Pedido cancelado e recursos estornados com sucesso.' };

    } catch (error) {
        logger.error("Erro em cancelarPedidoBackend:", error);
        throw new HttpsError('internal', error.message);
    }
});
