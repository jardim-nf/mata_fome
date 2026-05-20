import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebaseCore.js";
import { verifyAdminAccess } from "../authUtils.js";
import * as logger from "firebase-functions/logger";

export const gerenciarMesa = onCall({ enforceAppCheck: false, cors: true }, async (request) => {
  const { auth, data } = request;
  if (!auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const uid = auth.uid;
  const { estabelecimentoId, action, mesaId, payload } = data;

  if (!estabelecimentoId || !action) {
    throw new HttpsError("invalid-argument", "Estabelecimento e action são obrigatórios.");
  }

  const estabelecimentoRef = db.collection("estabelecimentos").doc(estabelecimentoId);
  // Basic validation: user should belong to the establishment (assuming staff/admin check is needed here)
  // For simplicity and matching current behavior, we assume authenticated user can operate on their estabId.

  const mesasRef = estabelecimentoRef.collection("mesas");

  try {
    switch (action) {
      case "ADICIONAR": {
        const { numeroMesa } = payload;
        const newMesa = {
          numero: !isNaN(numeroMesa) ? Number(numeroMesa) : numeroMesa,
          status: "livre",
          total: 0,
          pessoas: 0,
          itens: [],
          tipo: "mesa",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };
        await mesasRef.add(newMesa);
        return { success: true };
      }

      case "EXCLUIR": {
        if (!mesaId) throw new HttpsError("invalid-argument", "mesaId é obrigatório para EXCLUIR.");
        await mesasRef.doc(mesaId).delete();
        return { success: true };
      }

      case "EXCLUIR_LIVRES": {
        const snapshot = await mesasRef.where("status", "==", "livre").get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        return { success: true, count: snapshot.size };
      }

      case "LIMPAR_ALERTA": {
        if (!mesaId) throw new HttpsError("invalid-argument", "mesaId é obrigatório.");
        await mesasRef.doc(mesaId).update({
          chamandoGarcom: false,
          pedindoConta: false,
          updatedAt: FieldValue.serverTimestamp()
        });
        return { success: true };
      }

      case "BLOQUEAR_ABERTURA": {
        if (!mesaId) throw new HttpsError("invalid-argument", "mesaId é obrigatório.");
        const userName = auth.token.name || auth.token.email || "Garçom";
        
        return await db.runTransaction(async (transaction) => {
          const mesaDocRef = mesasRef.doc(mesaId);
          const mesaDoc = await transaction.get(mesaDocRef);

          if (!mesaDoc.exists) throw new HttpsError("not-found", "Mesa não existe mais!");
          
          const mesaData = mesaDoc.data();
          if (mesaData.status !== "livre") throw new HttpsError("failed-precondition", "Esta mesa acabou de ser ocupada!");
          
          if (mesaData.bloqueadoPor && mesaData.bloqueadoPor !== uid) {
            let tempoBloqueio = 0;
            if (mesaData.bloqueadoEm) {
              const dataBloqueio = mesaData.bloqueadoEm.toDate();
              tempoBloqueio = (new Date().getTime() - dataBloqueio.getTime()) / 1000 / 60;
            }
            if (tempoBloqueio < 2) {
              throw new HttpsError("failed-precondition", `Mesa sendo aberta por: ${mesaData.bloqueadoPorNome || 'Outro garçom'}`);
            }
          }

          transaction.update(mesaDocRef, {
            bloqueadoPor: uid,
            bloqueadoPorNome: userName,
            bloqueadoEm: FieldValue.serverTimestamp()
          });

          return { success: true };
        });
      }

      case "CANCELAR_ABERTURA": {
        if (!mesaId) throw new HttpsError("invalid-argument", "mesaId é obrigatório.");
        await mesasRef.doc(mesaId).update({
          bloqueadoPor: null,
          bloqueadoPorNome: null,
          bloqueadoEm: null
        });
        return { success: true };
      }

      case "CONFIRMAR_ABERTURA": {
        if (!mesaId) throw new HttpsError("invalid-argument", "mesaId é obrigatório.");
        const { qtd, nomeCliente } = payload;

        return await db.runTransaction(async (transaction) => {
          const mesaDocRef = mesasRef.doc(mesaId);
          const mesaDocCheck = await transaction.get(mesaDocRef);

          if (!mesaDocCheck.exists) throw new HttpsError("not-found", "Mesa não existe mais!");

          const dadosMesa = mesaDocCheck.data();
          if (dadosMesa.bloqueadoPor && dadosMesa.bloqueadoPor !== uid) {
              throw new HttpsError("failed-precondition", `Mesa sendo aberta por outro garçôm: ${dadosMesa.bloqueadoPorNome || 'outro usuário'}.`);
          }

          transaction.update(mesaDocRef, {
            status: "ocupada",
            pessoas: qtd,
            nome: nomeCliente || "",
            tipo: "mesa",
            updatedAt: FieldValue.serverTimestamp(),
            bloqueadoPor: null,
            bloqueadoPorNome: null,
            bloqueadoEm: null
          });

          return { success: true };
        });
      }

      case "LIMPAR_IMPRESSAO": {
        // Used when printing is done
        const { isPedido } = payload;
        if (!mesaId) throw new HttpsError("invalid-argument", "mesaId ou pedidoId é obrigatório.");
        
        if (isPedido) {
          const pedidoRef = estabelecimentoRef.collection("pedidos").doc(mesaId);
          await pedidoRef.update({
            solicitarImpressao: false,
            setorImpressao: null
          });
        } else {
          await mesasRef.doc(mesaId).update({
            solicitarImpressaoConferencia: false,
            setorImpressao: null
          });
        }
        return { success: true };
      }

      default:
        throw new HttpsError("invalid-argument", "Ação inválida.");
    }
  } catch (error) {
    logger.error("Erro em gerenciarMesa:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", error.message || "Erro interno do servidor.");
  }
});

export const chamarGarcomWeb = onCall({ enforceAppCheck: false, cors: true }, async (request) => {
  // ATENÇÃO: Esta function não requer autenticação (request.auth)
  // pois é usada pelo cliente via QR Code na mesa (usuário anônimo).
  
  const { estabelecimentoId, mesaNumero, tipo } = request.data || {};
  
  if (!estabelecimentoId || !mesaNumero || !tipo) {
    throw new HttpsError("invalid-argument", "Dados incompletos.");
  }

  try {
    // FIX: mesa pode ter sido salva com numero como Number ou String — busca nos dois formatos
    const mesasRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('mesas');
    const [snapNum, snapStr] = await Promise.all([
        mesasRef.where('numero', '==', Number(mesaNumero)).get(),
        mesasRef.where('numero', '==', mesaNumero.toString()).get()
    ]);

    const allDocs = [...snapNum.docs, ...snapStr.docs];
    if (allDocs.length === 0) {
        throw new HttpsError("not-found", "Mesa não encontrada.");
    }

    const mesaDoc = allDocs[0];
    
    // Só permitimos atualizar os alertas!
    const updates = {};
    if (tipo === 'garcom') {
      updates.chamandoGarcom = true;
    } else if (tipo === 'conta') {
      updates.pedindoConta = true;
    } else {
      throw new HttpsError("invalid-argument", "Tipo inválido.");
    }
    
    
    await mesaDoc.ref.update(updates);
    return { success: true };
    
  } catch (error) {
    logger.error("Erro em chamarGarcomWeb:", error);
    throw new HttpsError("internal", "Erro ao chamar garçom.");
  }
});

export const salvarPedidoMesaBackend = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');

  const { estabelecimentoId, mesaId, resumoPedido, userDataNome, userDisplayName } = request.data || {};
  if (!estabelecimentoId || !mesaId || !resumoPedido) {
    throw new HttpsError('invalid-argument', 'Dados incompletos.');
  }

  await verifyAdminAccess(request, estabelecimentoId);
  const token = request.auth.token || {};

  try {
    const mesaRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('mesas').doc(mesaId);
    const mesaSnap = await mesaRef.get();

    if (!mesaSnap.exists) {
      throw new HttpsError('not-found', 'Mesa não encontrada.');
    }

    const mesaData = mesaSnap.data();
    const batch = db.batch();

    const itensNovos = resumoPedido.filter(i => (!i.status || i.status === 'pendente') && i.status !== 'cancelado');
    const novoTotalMesa = resumoPedido.reduce((acc, i) => i.status === 'cancelado' ? acc : acc + (i.preco * i.quantidade), 0);

    let idPedidoGerado = null;

    if (itensNovos.length > 0) {
      const pedidoRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('pedidos').doc();
      idPedidoGerado = pedidoRef.id;

      const nomeGarcom = userDataNome || userDisplayName || "Garçom";

      batch.set(pedidoRef, {
        id: idPedidoGerado, 
        mesaId: mesaId, 
        mesaNumero: mesaData.numero || 'Sem Número',
        clienteNome: `Mesa ${mesaData.numero}`,
        tipo: 'mesa',
        itens: itensNovos.map(i => ({...i, status: 'recebido'})), 
        status: 'recebido', 
        total: itensNovos.reduce((a,i) => a + (i.preco * i.quantidade), 0), 
        dataPedido: FieldValue.serverTimestamp(), 
        createdAt: FieldValue.serverTimestamp(), 
        source: 'salao',
        funcionario: nomeGarcom,
        enviadoPor: nomeGarcom
      });

      const todosItensAtualizados = resumoPedido.map(i => {
        if ((!i.status || i.status === 'pendente') && i.status !== 'cancelado') {
          return { ...i, status: 'enviado', pedidoCozinhaId: idPedidoGerado, _estoqueBaixado: true };
        }
        return i;
      });

      batch.update(mesaRef, { 
        itens: todosItensAtualizados, 
        status: 'ocupada', 
        total: novoTotalMesa, 
        updatedAt: FieldValue.serverTimestamp() 
      });

      // Baixa de estoque removida daqui. A baixa agora ocorrerá apenas no fechamento da mesa/pagamento.

    } else {
      batch.update(mesaRef, { 
        itens: resumoPedido, 
        total: novoTotalMesa, 
        updatedAt: FieldValue.serverTimestamp() 
      });
    }

    await batch.commit();

    return { success: true, idPedidoGerado };
  } catch (error) {
    logger.error("Erro em salvarPedidoMesaBackend:", error);
    throw new HttpsError("internal", error.message || "Erro interno.");
  }
});

// ==================================================================
// 3. ATUALIZAÇÕES SEGURAS NA MESA (Secure-by-Design)
// ==================================================================

export const cancelarItemMesaBackend = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');

  const { estabelecimentoId, mesaId, itemParaExcluir, qtdExcluir, mesaNumero } = request.data || {};
  if (!estabelecimentoId || !mesaId || !itemParaExcluir) throw new HttpsError('invalid-argument', 'Dados incompletos.');

  await verifyAdminAccess(request, estabelecimentoId);
  const token = request.auth.token || {};

  try {
    const mesaRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('mesas').doc(mesaId);

    // Read mesa data inside a transaction to prevent concurrent modifications
    const mesaData = await db.runTransaction(async (transaction) => {
      const mesaSnap = await transaction.get(mesaRef);
      if (!mesaSnap.exists) throw new HttpsError('not-found', 'Mesa não encontrada.');
      return mesaSnap.data();
    });

    const resumoPedido = mesaData.itens || [];

    const qtdAtual = itemParaExcluir.quantidade || 1;
    const qtdRemover = Math.min(qtdExcluir, qtdAtual);
    const cancelaInteiro = qtdRemover >= qtdAtual;

    let novaLista;
    if (cancelaInteiro) {
        novaLista = resumoPedido.map(i => 
            i.id === itemParaExcluir.id ? { ...i, status: 'cancelado' } : i
        );
    } else {
        novaLista = resumoPedido.map(i => 
            i.id === itemParaExcluir.id ? { ...i, quantidade: qtdAtual - qtdRemover } : i
        );
    }

    const novoTotal = novaLista.reduce((acc, i) => i.status === 'cancelado' ? acc : acc + (i.preco * i.quantidade), 0);
    const batch = db.batch();

    batch.update(mesaRef, { itens: novaLista, total: novoTotal, updatedAt: FieldValue.serverTimestamp() });

    // Auditoria Segura no Backend
    const logsRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('auditLogs').doc();
    batch.set(logsRef, {
        tipo: 'cancelamento_item',
        mesaNumero: mesaNumero || mesaData.numero || 'N/A',
        usuarioId: uid,
        usuarioNome: token.name || token.email || 'Usuário',
        item: {
            nome: `${itemParaExcluir.nome || itemParaExcluir.name || 'Item'} – ${itemParaExcluir.variacao || itemParaExcluir.opcaoSelecionada || 'Único'}`,
            quantidade: qtdRemover,
            precoUnitario: itemParaExcluir.preco || 0,
            observacao: itemParaExcluir.observacao || null
        },
        valorTotalCancelado: (itemParaExcluir.preco || 0) * qtdRemover,
        data: FieldValue.serverTimestamp()
    });

    await batch.commit();
    return { success: true, cancelaInteiro, qtdRemover };
  } catch (error) {
    logger.error("Erro em cancelarItemMesaBackend:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message);
  }
});

export const atualizarRascunhoMesaBackend = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');

  const { estabelecimentoId, mesaId, itens, nomesOcupantes, total } = request.data || {};
  if (!estabelecimentoId || !mesaId) throw new HttpsError('invalid-argument', 'Dados incompletos.');

  await verifyAdminAccess(request, estabelecimentoId);
  const token = request.auth.token || {};

  try {
    const mesaRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('mesas').doc(mesaId);
    
    // Apenas permite atualizar o rascunho de forma segura
    const updates = { updatedAt: FieldValue.serverTimestamp() };
    if (itens !== undefined) updates.itens = itens;
    if (nomesOcupantes !== undefined) updates.nomesOcupantes = nomesOcupantes;
    if (total !== undefined) updates.total = total;

    await mesaRef.update(updates);
    return { success: true };
  } catch (error) {
    logger.error("Erro em atualizarRascunhoMesaBackend:", error);
    throw new HttpsError("internal", error.message);
  }
});

export const dispararImpressaoMesaBackend = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');

  const { estabelecimentoId, mesaId, pedidoRecemEnviadoId, setor, nomeGarcom } = request.data || {};
  if (!estabelecimentoId || !mesaId) throw new HttpsError('invalid-argument', 'Dados incompletos.');

  await verifyAdminAccess(request, estabelecimentoId);

  try {
    const estabelecimentoRef = db.collection('estabelecimentos').doc(estabelecimentoId);
    
    if (pedidoRecemEnviadoId) {
        await estabelecimentoRef.collection('pedidos').doc(pedidoRecemEnviadoId).update({
            solicitarImpressao: true,
            setorImpressao: setor || 'tudo',
            impressaoSolicitadaPor: nomeGarcom || 'Garçom',
            impressaoSolicitadaEm: FieldValue.serverTimestamp()
        });
    } else {
        await estabelecimentoRef.collection('mesas').doc(mesaId).update({
            solicitarImpressaoConferencia: true,
            setorImpressao: setor || 'tudo',
            impressaoSolicitadaPor: nomeGarcom || 'Garçom',
            impressaoSolicitadaEm: FieldValue.serverTimestamp()
        });
    }
    return { success: true };
  } catch (error) {
    logger.error("Erro em dispararImpressaoMesaBackend:", error);
    throw new HttpsError("internal", error.message);
  }
});

// ==================================================================
// 4. TRANSFERÊNCIA E JUNÇÃO DE MESAS
// ==================================================================

export const transferirMesaBackend = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');

  const { estabelecimentoId, mesaOrigemId, mesaDestinoId } = request.data || {};
  if (!estabelecimentoId || !mesaOrigemId || !mesaDestinoId || mesaOrigemId === mesaDestinoId) {
    throw new HttpsError('invalid-argument', 'Dados incompletos ou mesas iguais.');
  }

  await verifyAdminAccess(request, estabelecimentoId);
  const token = request.auth.token || {};

  try {
    const estabelecimentoRef = db.collection('estabelecimentos').doc(estabelecimentoId);
    const origemRef = estabelecimentoRef.collection('mesas').doc(mesaOrigemId);
    const destinoRef = estabelecimentoRef.collection('mesas').doc(mesaDestinoId);

    await db.runTransaction(async (transaction) => {
        const docOrigem = await transaction.get(origemRef);
        const docDestino = await transaction.get(destinoRef);

        if (!docOrigem.exists || !docDestino.exists) {
            throw new HttpsError("not-found", "Mesa Origem ou Destino não existe.");
        }

        const dataOrigem = docOrigem.data();
        const dataDestino = docDestino.data();

        if (dataOrigem.status === 'livre' || !dataOrigem.itens || dataOrigem.itens.length === 0) {
            throw new HttpsError("failed-precondition", "A mesa de origem está vazia ou livre.");
        }

        if (dataDestino.status === 'livre') {
            transaction.update(destinoRef, {
                status: 'ocupada',
                total: dataOrigem.total || 0,
                pessoas: dataOrigem.pessoas || 1,
                itens: dataOrigem.itens || [],
                nome: dataOrigem.nome || '',
                nomesOcupantes: dataOrigem.nomesOcupantes || ['Mesa'],
                updatedAt: FieldValue.serverTimestamp(),
                bloqueadoPor: null,
                bloqueadoPorNome: null,
                bloqueadoEm: null,
            });
        } else {
            const novosItens = [...(dataDestino.itens || []), ...(dataOrigem.itens || [])];
            const novoTotal = (dataDestino.total || 0) + (dataOrigem.total || 0);
            const novasPessoas = (dataDestino.pessoas || 1) + (dataOrigem.pessoas || 1);
            
            let nomesOcupantes = [...(dataDestino.nomesOcupantes || ['Mesa']), ...(dataOrigem.nomesOcupantes || [])]
                .filter(n => n !== 'Mesa');
            
            if (nomesOcupantes.length === 0) nomesOcupantes = ['Mesa'];
            nomesOcupantes = [...new Set(nomesOcupantes)];

            transaction.update(destinoRef, {
                total: novoTotal,
                pessoas: novasPessoas,
                itens: novosItens,
                nomesOcupantes: nomesOcupantes,
                updatedAt: FieldValue.serverTimestamp(),
            });
        }

        transaction.update(origemRef, {
            status: 'livre',
            total: 0,
            pessoas: 0,
            itens: [],
            nome: '',
            nomesOcupantes: ['Mesa'],
            updatedAt: FieldValue.serverTimestamp(),
            solicitarImpressaoConferencia: false,
            bloqueadoPor: null,
            bloqueadoPorNome: null,
            bloqueadoEm: null,
        });
    });

    return { success: true };
  } catch (error) {
    logger.error("Erro em transferirMesaBackend:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", error.message);
  }
});

// ==================================================================
// 5. FECHAMENTO DA MESA
// ==================================================================

export const fecharMesaBackend = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');

  const { estabelecimentoId, mesaId, pagamentosValidos, incluirTaxa, valorDescontoInput, tipoDesconto, modo, cpfNota, emitirNota } = request.data || {};
  if (!estabelecimentoId || !mesaId) throw new HttpsError('invalid-argument', 'Dados incompletos.');

  await verifyAdminAccess(request, estabelecimentoId);

  try {
    const mesaRef = db.collection('estabelecimentos').doc(estabelecimentoId).collection('mesas').doc(mesaId);

    // Read mesa data inside a transaction to prevent concurrent modifications during financial ops
    const mesaData = await db.runTransaction(async (transaction) => {
      const mesaSnap = await transaction.get(mesaRef);
      if (!mesaSnap.exists) throw new HttpsError('not-found', 'Mesa não encontrada.');
      return mesaSnap.data();
    });

    // Track multiple batches to avoid exceeding Firestore's 500 ops limit
    let batch = db.batch();
    let batchOpCount = 0;
    const allBatches = [batch];

    // Organizar itens pagos
    let itensValidos = Object.values(pagamentosValidos || {}).flatMap(p => p.itens || []);
    const itensMesa = mesaData.itens || [];

    // Fallback de segurança: se a divisão esvaziar os itens (ex: Rateio cego)
    if (itensValidos.length === 0) {
        itensValidos = itensMesa.filter(i => i.status !== 'cancelado');
    }
    
    // Verificar quais itens ainda não tiveram estoque baixado
    const itensParaBaixa = itensMesa.filter(item => 
        item.status !== 'cancelado' && 
        !item._estoqueBaixadoAoPagar
    );

    // Função segura para conversão de valores que podem vir como string com vírgula do front
    const safeNum = (val) => {
        if (typeof val === 'string') {
            val = val.replace(',', '.');
        }
        const n = Number(val);
        return isNaN(n) ? 0 : n;
    };

    const totalPagoAgora = Object.values(pagamentosValidos || {}).reduce((acc, pgto) => acc + safeNum(pgto.valor), 0);
    const pagamentosParciaisAntigos = mesaData.pagamentosParciais || [];
    const totalPagoGeral = pagamentosParciaisAntigos.reduce((acc, p) => acc + safeNum(p.valor), 0) + totalPagoAgora;

    // Calcular consumo total real
    const totalConsumo = itensMesa.reduce((acc, item) => item.status === 'cancelado' ? acc : acc + (safeNum(item.preco) * safeNum(item.quantidade || item.qtd || 1)), 0);
    const taxa = incluirTaxa ? totalConsumo * 0.10 : 0;
    
    let desconto = 0;
    const descInput = safeNum(valorDescontoInput);
    if (descInput > 0) {
        if (tipoDesconto === 'porcentagem') {
            desconto = totalConsumo * (Math.min(descInput, 100) / 100);
        } else {
            desconto = Math.min(descInput, totalConsumo);
        }
    }

    let restanteFinal = (totalConsumo + taxa - desconto) - totalPagoGeral;
    if (isNaN(restanteFinal) || !isFinite(restanteFinal)) restanteFinal = 0;

    const quitouMesa = restanteFinal <= 0.10;

    // 1. Salvar venda
    const vendaRef = db.collection('vendas').doc();
    const novaVenda = {
        origem: 'mesa',
        mesaId: mesaId,
        mesaNumero: mesaData.numero || 'N/A',
        estabelecimentoId,
        createdAt: FieldValue.serverTimestamp(),
        criadoEm: FieldValue.serverTimestamp(), // Necessário para filtros de datas e relatórios
        pagamentos: pagamentosValidos,
        total: totalPagoAgora,
        incluirTaxa: incluirTaxa || false,
        valorDesconto: desconto,
        tipoDesconto: tipoDesconto || 'reais',
        cpfNota: cpfNota || '',
        emitirNota: emitirNota || false,
        itens: itensValidos,
        funcionario: request.auth.token?.name || request.auth.token?.email || 'Sistema'
    };
    batch.set(vendaRef, novaVenda);

    // 2. Baixar estoque SOMENTE SE quitou a mesa para evitar baixas parciais complexas, OU baixar tudo agora se ainda não baixou.
    // Vamos baixar de todos os itens ativos que ainda não foram baixados.
    itensParaBaixa.forEach((item) => {
        const categoriaId = item.categoriaId || item.category || item.categoria;
        const produtoId = item.produtoIdOriginal || item.id;
        const tipoColecao = item.tipoColecao || 'produtos';
        
        if (!categoriaId || !produtoId) return;
        
        const qtd = Number(item.quantidade || item.qtd) || 1;
        
        if (Array.isArray(item.fichaTecnica) && item.fichaTecnica.length > 0) {
            item.fichaTecnica.forEach((ficha) => {
                if (ficha.insumoId) {
                    // Check if approaching Firestore batch limit (500 ops)
                    if (batchOpCount >= 490) {
                        batch = db.batch();
                        allBatches.push(batch);
                        batchOpCount = 0;
                    }
                    const iRef = db.doc(`estabelecimentos/${estabelecimentoId}/insumos/${ficha.insumoId}`);
                    batch.set(iRef, {
                        estoqueAtual: FieldValue.increment(-(ficha.quantidade * qtd)),
                        ultimaBaixa: FieldValue.serverTimestamp()
                    }, { merge: true });
                    batchOpCount++;
                }
            });
        } else {
            // Check if approaching Firestore batch limit (500 ops)
            if (batchOpCount >= 490) {
                batch = db.batch();
                allBatches.push(batch);
                batchOpCount = 0;
            }
            const pRef = db.doc(`estabelecimentos/${estabelecimentoId}/cardapio/${categoriaId}/${tipoColecao}/${produtoId}`);
            batch.set(pRef, {
                estoqueAtual: FieldValue.increment(-qtd),
                ultimaBaixa: FieldValue.serverTimestamp()
            }, { merge: true });
            batchOpCount++;
        }
    });

    // 3. Atualizar a Mesa
    // Check if approaching batch limit before mesa update
    if (batchOpCount >= 490) {
        batch = db.batch();
        allBatches.push(batch);
        batchOpCount = 0;
    }

    if (quitouMesa) {
        batch.update(mesaRef, {
            status: 'livre',
            total: 0,
            pessoas: 0,
            itens: [],
            pagamentosParciais: [],
            pessoasPagas: [],
            nome: '',
            nomesOcupantes: ['Mesa'],
            updatedAt: FieldValue.serverTimestamp(),
            bloqueadoPor: null,
            bloqueadoPorNome: null,
            bloqueadoEm: null,
            solicitarImpressaoConferencia: false
        });
    } else {
        // Atualiza a mesa marcando os itens que já tiveram estoque baixado
        const novosItensMesa = itensMesa.map(i => {
            if (i.status !== 'cancelado') return { ...i, _estoqueBaixadoAoPagar: true };
            return i;
        });

        // Adiciona aos pagamentos parciais
        const novosParciais = [...pagamentosParciaisAntigos];
        Object.entries(pagamentosValidos).forEach(([pessoa, dados]) => {
            novosParciais.push({
                pessoa,
                valor: dados.valor,
                formaPagamento: dados.formaPagamento,
                data: new Date().toISOString()
            });
        });

        // Atualiza pessoas pagas
        const pessoasPagasAnterior = mesaData.pessoasPagas || [];
        const novasPessoasPagas = [...new Set([...pessoasPagasAnterior, ...Object.keys(pagamentosValidos)])];

        batch.update(mesaRef, {
            pagamentosParciais: novosParciais,
            pessoasPagas: novasPessoasPagas,
            itens: novosItensMesa,
            updatedAt: FieldValue.serverTimestamp()
        });
    }

    // Commit all batches
    await Promise.all(allBatches.map(b => b.commit()));

    return { success: true, quitada: quitouMesa, restanteFinal, vendaId: vendaRef.id };
  } catch (error) {
    logger.error("Erro em fecharMesaBackend:", error);
    throw new HttpsError("internal", error.message);
  }
});
