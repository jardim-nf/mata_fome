import { useState, useCallback, useMemo, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, arrayUnion, increment, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';
import { estoqueService } from '../services/estoqueService';

function normalizarTexto(texto) {
    if (!texto) return '';
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function cleanData(obj) {
    if (obj === null || obj === undefined) return obj;
    return Object.entries(obj).reduce((acc, [key, value]) => {
        if (value === undefined) {
            acc[key] = null;
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            if (value instanceof Date || value.seconds !== undefined || ('_methodName' in value)) {
                acc[key] = value;
            } else {
                acc[key] = cleanData(value);
            }
        } else if (Array.isArray(value)) {
            acc[key] = value.map(item => (typeof item === 'object' ? cleanData(item) : item));
        } else {
            acc[key] = value;
        }
        return acc;
    }, {});
}

export function useMenuCheckout({ 
    actualEstabelecimentoId, isRetirada, bairro, subtotalCalculado, carrinho, 
    nomeCliente, telefoneCliente, rua, numero, cidade, complemento, pontoReferencia, 
    currentUser, handleAbrirLogin, limparCarrinho 
}) {
    // Taxas
    const [taxaEntregaCalculada, setTaxaEntregaCalculada] = useState(0);

    // Cupom
    const [couponCodeInput, setCouponCodeInput] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [couponLoading, setCouponLoading] = useState(false);

    // Raspadinha
    const [premioRaspadinha, setPremioRaspadinha] = useState(null);
    const [jaJogouRaspadinha, setJaJogouRaspadinha] = useState(false);

    // Pagamento
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [pedidoParaPagamento, setPedidoParaPagamento] = useState(null);
    const [processandoPagamento, setProcessandoPagamento] = useState(false);
    const [showOrderConfirmationModal, setShowOrderConfirmationModal] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [ultimoPedidoId, setUltimoPedidoId] = useState(null);

    // Cashback
    const [saldoCarteira, setSaldoCarteira] = useState(0);
    const [usarCashback, setUsarCashback] = useState(false);
    const [clienteDocRefIdUtilizado, setClienteDocRefIdUtilizado] = useState(null);

    // Buscar Cashback
    useEffect(() => {
        const fetchCashback = async () => {
            if (!actualEstabelecimentoId || !currentUser) return;
            
            let saldoEncontrado = 0;
            let docParaDescontar = null;
            try {
                const clienteRefId = doc(db, 'estabelecimentos', actualEstabelecimentoId, 'clientes', currentUser.uid);
                const clienteDocId = await getDoc(clienteRefId);
                if (clienteDocId.exists()) {
                   const sc = Number(clienteDocId.data().saldoCashback) || Number(clienteDocId.data().saldoCarteira) || 0;
                   if (sc > 0) {
                     saldoEncontrado += sc;
                     docParaDescontar = clienteRefId;
                   }
                }

                const t = telefoneCliente || currentUser?.phoneNumber || '';
                let telefoneFormatado = t.replace(/\D/g, '');
                
                const telefonesParaTestar = new Set();
                if (telefoneFormatado) telefonesParaTestar.add(telefoneFormatado);
                if (telefoneFormatado.length === 10 || telefoneFormatado.length === 11) telefonesParaTestar.add(`55${telefoneFormatado}`);
                if (telefoneFormatado.startsWith('55') && (telefoneFormatado.length === 12 || telefoneFormatado.length === 13)) telefonesParaTestar.add(telefoneFormatado.substring(2));

                console.log("[Cashback Debug] UID:", currentUser.uid, "| Telefone State:", telefoneCliente, "| Telefones a testar:", Array.from(telefonesParaTestar));

                for (const tTeste of telefonesParaTestar) {
                    if (tTeste && tTeste !== currentUser.uid) {
                       const clienteRefTel = doc(db, 'estabelecimentos', actualEstabelecimentoId, 'clientes', tTeste);
                       const clienteDocTel = await getDoc(clienteRefTel);
                       if (clienteDocTel.exists()) {
                           const st = Number(clienteDocTel.data().saldoCashback) || Number(clienteDocTel.data().saldoCarteira) || 0;
                           if (st > 0) {
                             saldoEncontrado += st;
                             if (!docParaDescontar) docParaDescontar = clienteRefTel;
                             break; // Interrompe para não somar duas vezes caso existam docs espelhados
                           }
                       }
                    }
                }
                
                setSaldoCarteira(saldoEncontrado);
                setClienteDocRefIdUtilizado(docParaDescontar);
            } catch (e) {
                console.error("Erro ao buscar cashback:", e);
                // Exibe o erro na tela para o usuário ver se é bloqueio de Firestore Rules
                if (e.message?.includes('permission')) {
                    alert('Erro de Permissão Firebase: As regras do banco impediram a leitura do saldo do telefone.');
                }
            }
        };
        fetchCashback();
    }, [actualEstabelecimentoId, currentUser, telefoneCliente]);

    useEffect(() => {
        const calcularTaxa = async () => {
            if (!actualEstabelecimentoId || !bairro || isRetirada) { 
                setTaxaEntregaCalculada(0); 
                return; 
            }
            try {
                const taxasSnap = await getDocs(collection(db, 'estabelecimentos', actualEstabelecimentoId, 'taxasDeEntrega'));
                const bairroNorm = normalizarTexto(bairro);
                let taxa = 0;
                let matchExato = null;
                let matchParcial = null;
                taxasSnap.forEach(doc => {
                    const nomeNorm = normalizarTexto(doc.data().nomeBairro || '');
                    if (nomeNorm === bairroNorm) matchExato = Number(doc.data().valorTaxa);
                    else if (!matchParcial && nomeNorm.includes(bairroNorm)) matchParcial = Number(doc.data().valorTaxa);
                });
                taxa = matchExato ?? matchParcial ?? 0;
                setTaxaEntregaCalculada(taxa);
            } catch { 
                setTaxaEntregaCalculada(0); 
            }
        };
        const timer = setTimeout(calcularTaxa, 800);
        return () => clearTimeout(timer);
    }, [bairro, actualEstabelecimentoId, isRetirada]);

    const taxaAplicada = useMemo(() => {
        if (isRetirada || premioRaspadinha?.type === 'frete') return 0;
        return taxaEntregaCalculada;
    }, [isRetirada, taxaEntregaCalculada, premioRaspadinha]);

    const cashbackAplicado = useMemo(() => {
        if (!usarCashback) return 0;
        const totalSemCashback = Math.max(0, subtotalCalculado + taxaAplicada - discountAmount);
        return Math.min(saldoCarteira, totalSemCashback);
    }, [usarCashback, saldoCarteira, subtotalCalculado, taxaAplicada, discountAmount]);

    const finalOrderTotal = useMemo(() => {
        return Math.max(0, subtotalCalculado + taxaAplicada - discountAmount - cashbackAplicado);
    }, [subtotalCalculado, taxaAplicada, discountAmount, cashbackAplicado]);

    const handleApplyCoupon = async () => {
        if (!couponCodeInput) return;
        setCouponLoading(true);
        try {
            const q = query(
                collection(db, 'estabelecimentos', actualEstabelecimentoId, 'cupons'),
                where('codigo', '==', couponCodeInput.trim().toUpperCase()),
                where('ativo', '==', true)
            );
            const snap = await getDocs(q);
            if (snap.empty) { toast.error('Cupom inválido ou expirado.'); return; }

            const cupomDoc = snap.docs[0];
            const cupom = cupomDoc.data();
            const cupomId = cupomDoc.id;

            if (cupom.validadeFim.toDate() < new Date()) { toast.error('Este cupom já expirou.'); return; }
            if (cupom.minimoPedido && subtotalCalculado < cupom.minimoPedido) {
                toast.warn(`Valor mínimo: R$ ${cupom.minimoPedido.toFixed(2)}`); return;
            }

            if (currentUser && Array.isArray(cupom.usuariosQueUsaram) && cupom.usuariosQueUsaram.includes(currentUser.uid)) {
                toast.error('Você já utilizou este cupom anteriormente.'); return;
            }

            if (cupom.usosMaximos && (cupom.usosAtuais || 0) >= cupom.usosMaximos) {
                toast.error('Este cupom atingiu o limite máximo de usos.'); return;
            }

            let valorDesc = 0;
            if (cupom.tipoDesconto === 'percentual') valorDesc = (subtotalCalculado * cupom.valorDesconto) / 100;
            else if (cupom.tipoDesconto === 'valorFixo') valorDesc = cupom.valorDesconto;
            else if (cupom.tipoDesconto === 'freteGratis') valorDesc = taxaAplicada;

            setAppliedCoupon({ ...cupom, _docId: cupomId });
            setDiscountAmount(valorDesc);
            toast.success('Cupom aplicado com sucesso!');
        } catch { 
            toast.error('Erro ao validar cupom.'); 
        } finally { 
            setCouponLoading(false); 
        }
    };

    const handleRemoveCoupon = () => { 
        setAppliedCoupon(null); 
        setDiscountAmount(0); 
        setCouponCodeInput(''); 
    };

    const prepararParaPagamento = (isLojaAberta) => {
        if (!isLojaAberta) return toast.error('A loja está fechada no momento!');
        if (!currentUser) return handleAbrirLogin();
        if (carrinho.length === 0) return toast.warn('Carrinho vazio.');
        if (!nomeCliente.trim()) { toast.error('Preencha seu NOME.'); document.getElementById('input-nome')?.focus(); return; }
        if (!telefoneCliente.trim()) { toast.error('Preencha seu TELEFONE.'); document.getElementById('input-telefone')?.focus(); return; }
        if (!isRetirada && !bairro) { toast.error('Selecione o BAIRRO.'); return; }
        if (!isRetirada && (!rua.trim() || !numero.trim())) { toast.error('Preencha o ENDEREÇO.'); return; }

        const formatarItem = (item) => {
            let nome = item.nome;
            if (item.variacaoSelecionada?.nome) nome += ` - ${item.variacaoSelecionada.nome}`;
            if (item.adicionaisSelecionados?.length > 0) nome += ` (+ ${item.adicionaisSelecionados.map(a => a.nome).join(', ')})`;
            if (item.observacao) nome += ` (Obs: ${item.observacao})`;
            return nome;
        };

        setPedidoParaPagamento({
            vendaId: `ord_${Date.now()}`,
            cliente: { 
                nome: nomeCliente, 
                telefone: telefoneCliente, 
                endereco: isRetirada ? null : { rua, numero, bairro, cidade, complemento, referencia: pontoReferencia }, 
                userId: currentUser.uid 
            },
            estabelecimentoId: actualEstabelecimentoId,
            itens: carrinho.map(item => ({ 
                nome: formatarItem(item), 
                quantidade: item.qtd, 
                preco: Number(item.precoFinal), 
                adicionais: item.adicionaisSelecionados || [], 
                variacao: item.variacaoSelecionada || null, 
                produtoIdOriginal: item.id, 
                categoriaId: item.categoriaId, 
                categoria: item.categoria || item.categoriaId || '' 
            })),
            totalFinal: Number(finalOrderTotal),
            taxaEntrega: Number(taxaAplicada),
            descontoAplicado: discountAmount,
            cashbackResgatado: cashbackAplicado, // NOVO
            createdAt: serverTimestamp(),
            status: 'aguardando_pagamento'
        });
        setShowPaymentModal(true);
    };

    const handlePagamentoSucesso = async (result) => {
        if (processandoPagamento) return;
        setProcessandoPagamento(true);
        try {
            let formaPagamento = 'A Combinar';
            let trocoPara = '';
            if (result.method === 'pix') formaPagamento = 'pix';
            else if (result.method === 'pix_manual') formaPagamento = 'pix_manual';
            else if (result.method === 'card') formaPagamento = result.details?.type || 'cartao';
            else if (result.method === 'cash') { formaPagamento = 'dinheiro'; trocoPara = result.details?.trocoPara || ''; }

            const pedidoFinal = cleanData({
                ...pedidoParaPagamento,
                status: 'recebido',
                source: 'menu',
                dataPedido: serverTimestamp(),
                pagamento: {
                    formaPagamento,
                    metodoPagamento: formaPagamento,
                    trocoPara: Number(trocoPara) || 0,
                    desconto: discountAmount,
                },
                cashbackResgatado: cashbackAplicado,
                totalFinal: finalOrderTotal,
                tipoEntrega: isRetirada ? 'retirada' : 'delivery'
            });

            const idPedido = result.vendaId || pedidoParaPagamento.vendaId;
            await setDoc(doc(db, 'estabelecimentos', actualEstabelecimentoId, 'pedidos', idPedido), pedidoFinal);

            // Subtrai cashback usado
            if (cashbackAplicado > 0 && clienteDocRefIdUtilizado) {
                try {
                   const cDoc = await getDoc(clienteDocRefIdUtilizado);
                   if (cDoc.exists()) {
                      const saldoAtual = Number(cDoc.data().saldoCashback) || Number(cDoc.data().saldoCarteira) || 0;
                      const novoSaldo = Math.max(0, saldoAtual - cashbackAplicado);
                      await updateDoc(clienteDocRefIdUtilizado, {
                          saldoCashback: novoSaldo
                      });
                   }
                } catch (errCB) {
                   console.error("Erro ao abater cashback", errCB);
                }
            }

            try { await estoqueService.darBaixaEstoque(actualEstabelecimentoId, carrinho); }
            catch (e) { console.warn('Erro estoque:', e); }

            if (appliedCoupon?._docId && currentUser) {
                try {
                    const cupomRef = doc(db, 'estabelecimentos', actualEstabelecimentoId, 'cupons', appliedCoupon._docId);
                    const novoTotal = (appliedCoupon.usosAtuais || 0) + 1;
                    const updateCupom = {
                        usosAtuais: increment(1),
                        totalDescontoGerado: increment(discountAmount),
                        usuariosQueUsaram: arrayUnion(currentUser.uid)
                    };
                    if (appliedCoupon.usosMaximos && novoTotal >= appliedCoupon.usosMaximos) { updateCupom.ativo = false; }
                    await updateDoc(cupomRef, updateCupom);
                } catch (e) { console.warn('Erro ao dar baixa no cupom:', e); }
            }

            setShowOrderConfirmationModal(true);
            setUltimoPedidoId(idPedido);
            limparCarrinho();
            setShowPaymentModal(false);
            toast.success('Pedido enviado com sucesso!');
            
            import('../utils/notifications.js').then(({ pedirPermissaoNotificacao }) => pedirPermissaoNotificacao());
        } catch (e) {
            console.error('Erro ao salvar pedido:', e);
            toast.error('Erro ao finalizar pedido. Tente novamente.');
        } finally {
            setProcessandoPagamento(false);
        }
    };

    return {
        couponCodeInput, setCouponCodeInput,
        appliedCoupon, discountAmount, couponLoading,
        handleApplyCoupon, handleRemoveCoupon,
        taxaEntregaCalculada, setTaxaEntregaCalculada,
        taxaAplicada, finalOrderTotal,
        saldoCarteira, usarCashback, setUsarCashback, cashbackAplicado, // EXPORTANDO OS ESTADOS DO CASHBACK
        premioRaspadinha, setPremioRaspadinha,
        jaJogouRaspadinha, setJaJogouRaspadinha,
        showPaymentModal, setShowPaymentModal,
        pedidoParaPagamento, processandoPagamento,
        showOrderConfirmationModal, setShowOrderConfirmationModal,
        showReviewModal, setShowReviewModal,
        ultimoPedidoId, setUltimoPedidoId,
        prepararParaPagamento, handlePagamentoSucesso
    };
}
