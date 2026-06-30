import { FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { db } from '../firebaseCore.js';

export async function processarCheckoutDeliveryService(uid, dados) {
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
        throw new Error('Carrinho vazio ou loja não informada.');
    }

    // 1. Validar se a loja está aberta
    const estabRef = db.doc(`estabelecimentos/${estabelecimentoId}`);
    const estabSnap = await estabRef.get();
    if (!estabSnap.exists) throw new Error('Loja não encontrada.');
    const estabData = estabSnap.data();

    if (estabData.forcadoFechado) {
        throw new Error('O restaurante está fechado no momento.');
    }

    // 1.5 FALLBACK DE ENDEREÇO
    const enderecoRecebido = clienteDados?.endereco;
    const enderecoVazio = !enderecoRecebido || !enderecoRecebido.rua || enderecoRecebido.rua.trim() === '' || enderecoRecebido.rua === 'S/N';
    
    if (enderecoVazio && uid) {
        try {
            const clienteGlobalRef = db.doc(`clientes/${uid}`);
            const clienteGlobalSnap = await clienteGlobalRef.get();
            
            if (clienteGlobalSnap.exists) {
                const clienteGlobal = clienteGlobalSnap.data();
                if (clienteGlobal.endereco && clienteGlobal.endereco.rua) {
                    logger.info(`📍 Endereço recuperado do cadastro do cliente ${uid}`);
                    if (clienteDados) {
                        clienteDados.endereco = {
                            rua: clienteGlobal.endereco.rua || '',
                            numero: clienteGlobal.endereco.numero || '',
                            bairro: clienteGlobal.endereco.bairro || '',
                            cidade: clienteGlobal.endereco.cidade || '',
                            complemento: clienteGlobal.endereco.complemento || '',
                            referencia: clienteGlobal.endereco.referencia || '',
                        };
                    }
                    if (!dados.bairro && clienteGlobal.endereco.bairro) {
                        dados.bairro = clienteGlobal.endereco.bairro;
                    }
                }
            }
        } catch (e) {
            logger.warn('⚠️ Falha ao buscar endereço do cadastro do cliente:', e.message);
        }
    }

    // 2. Recalcular Total e Validar Itens
    let subtotalReal = 0;
    const itensValidados = [];

    for (const item of carrinho) {
        const produtoId = item.produtoIdOriginal || item.id;
        const categoriaId = item.categoriaId || item.category || item.categoria;
        
        if (!produtoId || !categoriaId) continue;

        subtotalReal += (item.precoFinal || 0) * (item.qtd || 1);
        
        if (item.adicionais) {
            delete item.adicionais;
        }

        itensValidados.push(item);
    }

    const { alterarEstoqueSeguro } = await import('../estoqueHelper.js');
    await alterarEstoqueSeguro(estabelecimentoId, itensValidados, 'saida', uid || 'delivery-app');

    // 3. Processar Taxa de Entrega
    let taxaEntrega = 0;
    const bairroParaTaxa = clienteDados?.endereco?.bairro || dados.bairro || '';
    if (bairroParaTaxa) {
        const taxasSnap = await db.collection(`estabelecimentos/${estabelecimentoId}/taxasDeEntrega`).get();
        const normalize = (str) => str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';
        const bairroNorm = normalize(bairroParaTaxa);
        
        taxasSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (normalize(data.nomeBairro || '').includes(bairroNorm)) {
                taxaEntrega = Number(data.valorTaxa);
            }
        });
    }

    // 4. Aplicar Descontos
    let descontoValor = 0;
    if (premioRaspadinha?.type === 'desconto') {
        descontoValor += subtotalReal * (Number(premioRaspadinha.valor) / 100);
    } else if (premioRaspadinha?.type === 'frete') {
        taxaEntrega = 0;
    }

    let cupomAplicadoId = null;
    if (cupom) {
        const cupomRef = db.collection(`estabelecimentos/${estabelecimentoId}/cupons`).doc(cupom);
        const cupomDesconto = await db.runTransaction(async (txn) => {
            const cupomSnap = await txn.get(cupomRef);
            if (!cupomSnap.exists) {
                throw new Error('Cupom não encontrado.');
            }
            const cData = cupomSnap.data();
            const valorMinimo = cData.valorMinimo !== undefined ? cData.valorMinimo : cData.minimoPedido;
            if (cData.ativo === false || subtotalReal < (valorMinimo || 0)) {
                throw new Error('O cupom é inválido ou o valor mínimo não foi atingido.');
            }
            const limiteUso = cData.limiteUso !== undefined ? cData.limiteUso : cData.usosMaximos;
            const usosAtuais = cData.usos !== undefined ? cData.usos : cData.usosAtuais;
            if (limiteUso && (usosAtuais || 0) >= limiteUso) {
                throw new Error('Este cupom já atingiu o limite de usos.');
            }
            txn.update(cupomRef, { 
                usos: FieldValue.increment(1),
                usosAtuais: FieldValue.increment(1)
            });

            let desconto = 0;
            const tipo = cData.tipo || cData.tipoDesconto;
            const valor = cData.valor !== undefined ? cData.valor : cData.valorDesconto;
            if (tipo === 'porcentagem' || tipo === 'percentual') {
                desconto = subtotalReal * (Number(valor) / 100);
            } else if (tipo === 'fixo' || tipo === 'valorFixo') {
                desconto = Number(valor);
            } else if (tipo === 'freteGratis') {
                desconto = taxaEntrega;
            }
            return desconto;
        });
        descontoValor += cupomDesconto;
        cupomAplicadoId = cupom;
    }

    let subtotalETaxas = subtotalReal + taxaEntrega - descontoValor;

    // 5. Aplicar Cashback
    let cashbackAplicado = 0;
    let clienteDocRef = null;

    if (usarCashback) {
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

    // 6. Batch
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
    await batch.commit();

    return { success: true, pedidoId: pedidoRef.id, totalFinal };
}
