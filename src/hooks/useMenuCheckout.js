import { useState, useCallback, useMemo, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, arrayUnion, increment, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'react-toastify';
import { estoqueService } from '../services/estoqueService';

function normalizarTexto(texto) {
    if (!texto) return '';
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function cleanData(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'number') {
        return isNaN(obj) ? 0 : obj;
    }
    if (typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
        return obj.map(item => cleanData(item));
    }
    
    if (obj instanceof Date || typeof obj?.toDate === 'function' || obj.seconds !== undefined || ('_methodName' in obj) || (obj.isEqual && typeof obj.isEqual === 'function')) {
        return obj;
    }
    
    return Object.entries(obj).reduce((acc, [key, value]) => {
        if (value === undefined) {
            acc[key] = null;
        } else {
            acc[key] = cleanData(value);
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

    // Cartão Fidelidade
    const [fidelidadeConfig, setFidelidadeConfig] = useState(null); // { ativo, metaCompras, premio, descricaoExtra }
    const [fidelidadeCliente, setFidelidadeCliente] = useState({ carimbos: 0, premioDisponivel: false, cartelasCompletadas: 0 });

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

                // Só busca por telefone se NÃO encontrou saldo no doc por UID (evita soma duplicada)
                if (saldoEncontrado === 0) {
                    const t = telefoneCliente || currentUser?.phoneNumber || '';
                    let telefoneFormatado = t.replace(/\D/g, '');
                    
                    const telefonesParaTestar = new Set();
                    if (telefoneFormatado) telefonesParaTestar.add(telefoneFormatado);
                    if (telefoneFormatado.length === 10 || telefoneFormatado.length === 11) telefonesParaTestar.add(`55${telefoneFormatado}`);
                    if (telefoneFormatado.startsWith('55') && (telefoneFormatado.length === 12 || telefoneFormatado.length === 13)) telefonesParaTestar.add(telefoneFormatado.substring(2));

                    if (import.meta.env.DEV) console.log("[Cashback Debug] UID:", currentUser.uid, "| Telefones a testar:", Array.from(telefonesParaTestar));

                    for (const tTeste of telefonesParaTestar) {
                        if (tTeste && tTeste !== currentUser.uid) {
                           const clienteRefTel = doc(db, 'estabelecimentos', actualEstabelecimentoId, 'clientes', tTeste);
                           const clienteDocTel = await getDoc(clienteRefTel);
                           if (clienteDocTel.exists()) {
                               const st = Number(clienteDocTel.data().saldoCashback) || Number(clienteDocTel.data().saldoCarteira) || 0;
                               if (st > 0) {
                                 saldoEncontrado += st;
                                 if (!docParaDescontar) docParaDescontar = clienteRefTel;
                                 break;
                               }
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

    // Buscar Cartão Fidelidade (config do estabelecimento + progresso do cliente)
    useEffect(() => {
        const fetchFidelidade = async () => {
            if (!actualEstabelecimentoId || !currentUser) return;
            try {
                // 1. Config do estabelecimento
                const estabSnap = await getDoc(doc(db, 'estabelecimentos', actualEstabelecimentoId));
                const configFid = estabSnap.data()?.cartelaFidelidade;
                if (!configFid || !configFid.ativo) {
                    setFidelidadeConfig(null);
                    return;
                }
                setFidelidadeConfig(configFid);

                // 2. Progresso do cliente
                const clienteRef = doc(db, 'estabelecimentos', actualEstabelecimentoId, 'clientes', currentUser.uid);
                const clienteSnap = await getDoc(clienteRef);
                if (clienteSnap.exists() && clienteSnap.data().fidelidade) {
                    setFidelidadeCliente(clienteSnap.data().fidelidade);
                }
            } catch (e) {
                if (import.meta.env.DEV) console.warn('[Fidelidade] Erro ao buscar:', e);
            }
        };
        fetchFidelidade();
    }, [actualEstabelecimentoId, currentUser]);

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
                    const data = doc.data();
                    const nomeNorm = normalizarTexto(data.nomeBairro || '');
                    let rawVal = data.valorTaxa;
                    if (typeof rawVal === 'string') rawVal = rawVal.replace(',', '.');
                    const numVal = parseFloat(rawVal) || 0;
                    
                    if (nomeNorm === bairroNorm) matchExato = numVal;
                    else if (!matchParcial && nomeNorm.includes(bairroNorm)) matchParcial = numVal;
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

    const handleApplyCoupon = async (codeOverride) => {
        const targetCode = codeOverride || couponCodeInput;
        if (!targetCode) return;
        setCouponLoading(true);
        try {
            const q = query(
                collection(db, 'estabelecimentos', actualEstabelecimentoId, 'cupons'),
                where('codigo', '==', targetCode.trim().toUpperCase()),
                where('ativo', '==', true)
            );
            const snap = await getDocs(q);
            if (snap.empty) { toast.error('Cupom inválido ou expirado.'); return; }

            const cupomDoc = snap.docs[0];
            const cupom = cupomDoc.data();
            const cupomId = cupomDoc.id;

            if (cupom.validadeFim.toDate() < new Date()) { toast.error('Este cupom já expirou.'); return; }
            
            const valorMinimo = cupom.valorMinimo !== undefined ? cupom.valorMinimo : (cupom.minimoPedido || 0);
            if (valorMinimo && subtotalCalculado < valorMinimo) {
                toast.warn(`Valor mínimo: R$ ${valorMinimo.toFixed(2)}`); return;
            }

            if (currentUser && Array.isArray(cupom.usuariosQueUsaram) && cupom.usuariosQueUsaram.includes(currentUser.uid)) {
                toast.error('Você já utilizou este cupom anteriormente.'); return;
            }

            const limiteUso = cupom.limiteUso !== undefined ? cupom.limiteUso : cupom.usosMaximos;
            const usosAtuais = cupom.usos !== undefined ? cupom.usos : (cupom.usosAtuais || 0);
            if (limiteUso && usosAtuais >= limiteUso) {
                toast.error('Este cupom atingiu o limite máximo de usos.'); return;
            }

            let valorDesc = 0;
            const tipo = cupom.tipo || cupom.tipoDesconto;
            const valor = cupom.valor !== undefined ? cupom.valor : (cupom.valorDesconto || 0);

            if (tipo === 'porcentagem' || tipo === 'percentual') {
                valorDesc = (subtotalCalculado * Number(valor)) / 100;
            } else if (tipo === 'fixo' || tipo === 'valorFixo') {
                valorDesc = Number(valor);
            } else if (tipo === 'freteGratis') {
                valorDesc = taxaAplicada;
            }

            setCouponCodeInput(targetCode.trim().toUpperCase());
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

            // ---- REFATORAÇÃO DE SEGURANÇA: ENVIAR PARA A CLOUD FUNCTION ----
            const finalizarPedidoBackend = httpsCallable(functions, 'finalizarCheckoutDelivery');
            
            // 🔥 CORREÇÃO: Limpar o carrinho para evitar o envio de `item.adicionais` poluído com todos os globais
            const carrinhoLimpo = carrinho.map(item => ({
                id: item.id,
                produtoIdOriginal: item.produtoIdOriginal || item.id,
                nome: item.nome,
                qtd: item.qtd || item.quantidade,
                quantidade: item.qtd || item.quantidade,
                preco: item.preco,
                precoFinal: item.precoFinal,
                categoria: item.categoria || item.categoriaId || '',
                categoriaId: item.categoriaId || item.categoria || '',
                tipoColecao: item.tipoColecao || 'produtos', // Adicionado para correção de estoque no backend
                observacao: item.observacao || '',
                variacaoSelecionada: item.variacaoSelecionada || null,
                adicionaisSelecionados: item.adicionaisSelecionados || [],
                // NOTA: Ignoramos propositalmente `item.adicionais` aqui, pois no Menu.jsx ele contém todos os globais
            }));

            const reqData = cleanData({
                estabelecimentoId: actualEstabelecimentoId,
                carrinho: carrinhoLimpo,
                clienteDados: {
                    nome: nomeCliente,
                    telefone: telefoneCliente,
                    endereco: isRetirada ? null : { rua, numero, bairro, cidade, complemento, referencia: pontoReferencia },
                },
                tipoEntrega: isRetirada ? 'retirada' : 'delivery',
                bairro: bairro,
                cupom: appliedCoupon?._docId || appliedCoupon?.codigo || null,
                usarCashback: usarCashback,
                premioRaspadinha: premioRaspadinha || null,
                pagamento: {
                    formaPagamento,
                    trocoPara: Number(trocoPara) || 0
                }
            });

            const response = await finalizarPedidoBackend(reqData);
            
            if (!response.data || !response.data.success) {
                throw new Error(response.data?.message || 'Falha ao processar pedido no servidor.');
            }

            const idPedidoGerado = response.data.pedidoId;
            // ---------------------------------------------------------------

            setShowOrderConfirmationModal(true);
            setUltimoPedidoId(idPedidoGerado);
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
        fidelidadeConfig, fidelidadeCliente, // CARTÃO FIDELIDADE
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
