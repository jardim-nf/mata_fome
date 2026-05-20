import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
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

  const { estabelecimentoId, pedidoId, novoStatus, newStatus } = request.data || {};
  const statusToUpdate = novoStatus || newStatus;
  if (!estabelecimentoId || !pedidoId || !statusToUpdate) {
    throw new HttpsError('invalid-argument', 'Dados incompletos (estabelecimentoId, pedidoId, novoStatus ou newStatus).');
  }

  const { verifyAdminAccess } = await import('../authUtils.js');
  await verifyAdminAccess(request, estabelecimentoId);

  try {
    const pedidoRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('pedidos').doc(pedidoId);
    await pedidoRef.update({
      status: statusToUpdate,
      updatedAt: FieldValue.serverTimestamp()
    });
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

export const atualizarFormaPagamentoPedidoBackend = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');

  const { estabelecimentoId, pedidoId, formaPagamento, novaForma } = request.data || {};
  const pgtoToUpdate = formaPagamento || novaForma;
  if (!estabelecimentoId || !pedidoId || !pgtoToUpdate) {
    throw new HttpsError('invalid-argument', 'Dados incompletos.');
  }

  const { verifyAdminAccess } = await import('../authUtils.js');
  await verifyAdminAccess(request, estabelecimentoId);

  try {
    const pedidoRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('pedidos').doc(pedidoId);
    await pedidoRef.update({
      formaPagamento: pgtoToUpdate,
      updatedAt: FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    logger.error("Erro em atualizarFormaPagamentoPedidoBackend:", error);
    throw new HttpsError('internal', error.message);
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
    const vendaRef = db.collection('vendas').doc();
    
    const novaVenda = {
        ...vendaData,
        id: vendaRef.id, // Força ter o ID dentro do documento
        createdAt: FieldValue.serverTimestamp(),
        criadoEm: FieldValue.serverTimestamp(), // Necessário para filtros de datas e relatórios
        funcionarioId: uid,
        funcionario: request.auth.token?.name || request.auth.token?.email || 'Sistema'
    };

    batch.set(vendaRef, novaVenda);

    // Baixa de estoque para cada item
    const itens = vendaData.itens || vendaData.pedidos || [];
    itens.forEach((item) => {
        const categoriaId = item.categoriaId || item.category || item.categoria;
        const produtoId = item.produtoIdOriginal || item.id;
        const tipoColecao = item.tipoColecao || 'produtos';
        
        if (!categoriaId || !produtoId) return;
        
        const qtd = Number(item.quantidade || item.qtd) || 1;
        
        if (Array.isArray(item.fichaTecnica) && item.fichaTecnica.length > 0) {
            item.fichaTecnica.forEach((ficha) => {
                if (ficha.insumoId) {
                    const iRef = db.doc(`estabelecimentos/${estabelecimentoId}/insumos/${ficha.insumoId}`);
                    batch.set(iRef, {
                        estoqueAtual: FieldValue.increment(-(ficha.quantidade * qtd)),
                        ultimaBaixa: FieldValue.serverTimestamp()
                    }, { merge: true });
                }
            });
        } else {
            const pRef = db.doc(`estabelecimentos/${estabelecimentoId}/cardapio/${categoriaId}/${tipoColecao}/${produtoId}`);
            batch.set(pRef, {
                estoqueAtual: FieldValue.increment(-qtd),
                ultimaBaixa: FieldValue.serverTimestamp()
            }, { merge: true });
        }
    });

    // Se veio de um pedido (Delivery), precisamos atualizar o pedido original para marcar como pago/finalizado
    if (vendaData.pedidoId || vendaData.id) {
        const pedidoId = vendaData.pedidoId || vendaData.id;
        // Só atualiza se o ID não for temporário/inexistente e a origem for apropriada
        if (vendaData.origem !== 'pdv' && pedidoId && pedidoId !== vendaRef.id) {
            const pedidoRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('pedidos').doc(pedidoId);
            batch.update(pedidoRef, {
                pago: true,
                status: 'finalizado',
                dataFinalizado: FieldValue.serverTimestamp(),
                formaPagamento: vendaData.formaPagamento || 'N/A'
            });
        }
    }

    await batch.commit();

    return { 
        success: true, 
        vendaId: vendaRef.id, 
        total: vendaData.total,
        _estoqueBaixado: true 
    };

  } catch (error) {
    logger.error("Erro em salvarVendaBackend:", error);
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
        const { 
            estabelecimentoId, 
            carrinho, 
            clienteDados, 
            pagamento, 
            cupom, 
            usarCashback, 
            premioRaspadinha 
        } = dados;

        if (!estabelecimentoId || !carrinho || carrinho.length === 0) {
            throw new HttpsError('invalid-argument', 'Carrinho vazio ou loja não informada.');
        }

        // 1. Validar se a loja está aberta
        const estabRef = db.doc(`estabelecimentos/${estabelecimentoId}`);
        const estabSnap = await estabRef.get();
        if (!estabSnap.exists) throw new HttpsError('not-found', 'Loja não encontrada.');
        const estabData = estabSnap.data();

        if (estabData.forcadoFechado) {
            throw new HttpsError('failed-precondition', 'O restaurante está fechado no momento.');
        }
        // Obs: Horários podem ser validados aqui usando estabData.horarios se necessário

        // 2. Recalcular Total e Validar Itens
        let subtotalReal = 0;
        const itensValidados = [];

        for (const item of carrinho) {
            const produtoId = item.produtoIdOriginal || item.id;
            const categoriaId = item.categoriaId || item.category || item.categoria;
            
            if (!produtoId || !categoriaId) continue;

            subtotalReal += (item.precoFinal || 0) * (item.qtd || 1);
            
            // SANITIZAÇÃO DE SEGURANÇA: Removemos 'adicionais' por completo para impedir 
            // poluição no banco de dados, oriunda de versões antigas do frontend em cache.
            // O sistema passa a utilizar apenas 'adicionaisSelecionados'.
            if (item.adicionais) {
                delete item.adicionais;
            }

            itensValidados.push(item);
        }

        // 3. Processar Taxa de Entrega
        let taxaEntrega = 0;
        if (clienteDados?.endereco?.bairro) {
            const taxasSnap = await db.collection(`estabelecimentos/${estabelecimentoId}/taxasDeEntrega`).get();
            // Simples normalização
            const normalize = (str) => str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';
            const bairroNorm = normalize(clienteDados.endereco.bairro);
            
            taxasSnap.forEach(docSnap => {
                const data = docSnap.data();
                if (normalize(data.nomeBairro || '').includes(bairroNorm)) {
                    taxaEntrega = Number(data.valorTaxa);
                }
            });
        }

        // 4. Aplicar Descontos (Cupom, Raspadinha)
        let descontoValor = 0;
        if (premioRaspadinha?.type === 'desconto') {
            descontoValor += subtotalReal * (Number(premioRaspadinha.valor) / 100);
        } else if (premioRaspadinha?.type === 'frete') {
            taxaEntrega = 0;
        }

        // Processar Cupom — transação atômica para evitar uso acima do limite
        let cupomAplicadoId = null;
        if (cupom) {
            const cupomRef = db.collection(`estabelecimentos/${estabelecimentoId}/cupons`).doc(cupom);
            const cupomDesconto = await db.runTransaction(async (txn) => {
                const cupomSnap = await txn.get(cupomRef);
                if (!cupomSnap.exists) {
                    throw new HttpsError('not-found', 'Cupom não encontrado.');
                }
                const cData = cupomSnap.data();
                if (cData.ativo === false || subtotalReal < (cData.valorMinimo || 0)) {
                    throw new HttpsError('failed-precondition', 'O cupom é inválido ou o valor mínimo não foi atingido.');
                }
                if (cData.limiteUso && (cData.usos || 0) >= cData.limiteUso) {
                    throw new HttpsError('failed-precondition', 'Este cupom já atingiu o limite de usos.');
                }
                // Incrementar usos atomicamente dentro da transação
                txn.update(cupomRef, { usos: FieldValue.increment(1) });

                let desconto = 0;
                if (cData.tipo === 'porcentagem') {
                    desconto = subtotalReal * (cData.valor / 100);
                } else if (cData.tipo === 'fixo') {
                    desconto = cData.valor;
                }
                return desconto;
            });
            descontoValor += cupomDesconto;
            cupomAplicadoId = cupom;
        }

        let subtotalETaxas = subtotalReal + taxaEntrega - descontoValor;

        // 5. Aplicar Cashback — transação atômica para evitar double-spend
        let cashbackAplicado = 0;
        let clienteDocRef = null;

        if (usarCashback) {
            // Encontrar o doc do cliente (por UID ou telefone)
            const clienteRefUid = db.doc(`estabelecimentos/${estabelecimentoId}/clientes/${uid}`);
            const cSnap = await clienteRefUid.get();

            if (cSnap.exists) {
                clienteDocRef = clienteRefUid;
            } else if (clienteDados?.telefone) {
                const tForm = clienteDados.telefone.replace(/\D/g, '');
                const clienteRefTel = db.doc(`estabelecimentos/${estabelecimentoId}/clientes/${tForm}`);
                const tSnap = await clienteRefTel.get();
                if (tSnap.exists) clienteDocRef = clienteRefTel;
            }

            if (clienteDocRef) {
                // Transação atômica: lê saldo atual e deduz de forma segura (sem double-spend)
                cashbackAplicado = await db.runTransaction(async (txn) => {
                    const snap = await txn.get(clienteDocRef);
                    if (!snap.exists) return 0;
                    const saldo = Number(snap.data().saldoCashback) || Number(snap.data().saldoCarteira) || 0;
                    const deducao = Math.min(saldo, subtotalETaxas);
                    if (deducao > 0) {
                        txn.update(clienteDocRef, { saldoCashback: FieldValue.increment(-deducao) });
                    }
                    return deducao;
                });
            }
        }

        const totalFinal = Math.max(0, subtotalETaxas - cashbackAplicado);

        // 6. Batch (cashback já foi deduzido na transação acima)
        const batch = db.batch();

        const pedidoRef = db.collection(`estabelecimentos/${estabelecimentoId}/pedidos`).doc();
        const pedidoObj = {
            clienteId: uid,
            clienteNome: clienteDados?.nome || 'Cliente App',
            clienteTelefone: clienteDados?.telefone || '',
            endereco: clienteDados?.endereco || { rua: 'S/N' },
            itens: itensValidados,
            total: totalFinal,
            subtotal: subtotalReal,
            taxaEntrega,
            descontoAplicado: descontoValor,
            cashbackResgatado: cashbackAplicado,
            formaPagamento: typeof pagamento === 'object' ? pagamento.formaPagamento : (pagamento || 'Não selecionado'),
            metodoPagamento: typeof pagamento === 'object' ? pagamento.formaPagamento : pagamento,
            trocoPara: typeof pagamento === 'object' ? (pagamento.trocoPara || 0) : 0,
            tipoEntrega: 'delivery',
            status: 'recebido',
            createdAt: FieldValue.serverTimestamp(),
            dataPedido: FieldValue.serverTimestamp(),
            premioRaspadinha: premioRaspadinha ? premioRaspadinha.type : null,
            cupomAplicado: cupomAplicadoId,
            estabelecimentoId
        };

        batch.set(pedidoRef, pedidoObj);

        // Cashback já deduzido atomicamente acima via runTransaction

        // Cupom usos já incrementado atomicamente na transação acima

        // Abater Estoque
        itensValidados.forEach((item) => {
            const categoriaId = item.categoriaId || item.category || item.categoria;
            const produtoId = item.produtoIdOriginal || item.id;
            const tipoColecao = item.tipoColecao || 'produtos';
            
            if (!categoriaId || !produtoId) return;
            
            const qtd = Number(item.quantidade || item.qtd) || 1;
            
            if (Array.isArray(item.fichaTecnica) && item.fichaTecnica.length > 0) {
                item.fichaTecnica.forEach((ficha) => {
                    if (ficha.insumoId) {
                        const iRef = db.doc(`estabelecimentos/${estabelecimentoId}/insumos/${ficha.insumoId}`);
                        batch.set(iRef, { estoqueAtual: FieldValue.increment(-(ficha.quantidade * qtd)) }, { merge: true });
                    }
                });
            } else {
                const pRef = db.doc(`estabelecimentos/${estabelecimentoId}/cardapio/${categoriaId}/${tipoColecao}/${produtoId}`);
                batch.set(pRef, { estoqueAtual: FieldValue.increment(-qtd) }, { merge: true });
            }
        });

        await batch.commit();

        logger.info(`✅ [Delivery] Pedido ${pedidoRef.id} criado com sucesso. Total: R$ ${totalFinal}`);
        return { success: true, pedidoId: pedidoRef.id, totalFinal };

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
            batch.update(clienteRef, {
                saldoCashback: FieldValue.increment(pedidoData.cashbackResgatado)
            });
        }

        // 3. Estornar Usos do Cupom
        if (pedidoData.cupomAplicado) {
            const cupomRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('cupons').doc(pedidoData.cupomAplicado);
            batch.update(cupomRef, {
                usos: FieldValue.increment(-1)
            });
        }

        // 4. Estornar Estoque
        const itens = pedidoData.itens || [];
        itens.forEach((item) => {
            const categoriaId = item.categoriaId || item.category || item.categoria;
            const produtoId = item.produtoIdOriginal || item.id;
            const tipoColecao = item.tipoColecao || 'produtos';
            
            if (!categoriaId || !produtoId) return;
            
            const qtd = Number(item.quantidade || item.qtd) || 1;
            
            if (Array.isArray(item.fichaTecnica) && item.fichaTecnica.length > 0) {
                item.fichaTecnica.forEach((ficha) => {
                    if (ficha.insumoId) {
                        const iRef = db.doc(`estabelecimentos/${estabelecimentoId}/insumos/${ficha.insumoId}`);
                        batch.set(iRef, { estoqueAtual: FieldValue.increment(ficha.quantidade * qtd) }, { merge: true });
                    }
                });
            } else {
                const pRef = db.doc(`estabelecimentos/${estabelecimentoId}/cardapio/${categoriaId}/${tipoColecao}/${produtoId}`);
                batch.set(pRef, { estoqueAtual: FieldValue.increment(qtd) }, { merge: true });
            }
        });

        await batch.commit();

        logger.info(`✅ Pedido ${pedidoId} cancelado com sucesso por ${uid}. Estoque e cashback estornados se aplicável.`);

        return { success: true, message: 'Pedido cancelado e recursos estornados com sucesso.' };

    } catch (error) {
        logger.error("Erro em cancelarPedidoBackend:", error);
        throw new HttpsError('internal', error.message);
    }
});
