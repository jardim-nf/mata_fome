import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, Timestamp, setDoc as setDocFirestore, runTransaction, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import CardapioItem from '../components/CardapioItem';
import { useAuth } from '../context/AuthContext';
import { usePayment } from '../context/PaymentContext';
import { toast } from 'react-toastify';
import AdicionaisModal from '../components/AdicionaisModal';
import VariacoesModal from '../components/VariacoesModal';
import { v4 as uuidv4 } from 'uuid';
import PaymentModal from '../components/PaymentModal';
import CarrinhoFlutuante from '../components/CarrinhoFlutuante';

// Ícones
import { IoLocationSharp, IoTime, IoCall, IoLogOutOutline } from 'react-icons/io5';

function Menu() {
    const { estabelecimentoSlug } = useParams();
    const navigate = useNavigate();
    
    const { currentUser, currentClientData, loading: authLoading, isAdmin, isMasterAdmin, logout } = useAuth();
    
    // eslint-disable-next-line no-unused-vars
    const { processPayment, paymentLoading } = usePayment();

    // --- ESTADOS ---
    const [allProdutos, setAllProdutos] = useState([]);
    const [produtosFiltrados, setProdutosFiltrados] = useState([]);
    const [carrinho, setCarrinho] = useState([]);
    const [ordemCategorias, setOrdemCategorias] = useState([]); 

    const [nomeCliente, setNomeCliente] = useState('');
    const [telefoneCliente, setTelefoneCliente] = useState('');
    const [rua, setRua] = useState('');
    const [numero, setNumero] = useState('');
    const [bairro, setBairro] = useState('');
    const [cidade, setCidade] = useState('');
    const [complemento, setComplemento] = useState('');
    
    const [taxaEntregaCalculada, setTaxaEntregaCalculada] = useState(0);
    const [isRetirada, setIsRetirada] = useState(false);
    // eslint-disable-next-line no-unused-vars
    const [nomeEstabelecimento, setNomeEstabelecimento] = useState("Carregando...");
    const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
    const [actualEstabelecimentoId, setActualEstabelecimentoId] = useState(null);
    
    const [showOrderConfirmationModal, setShowOrderConfirmationModal] = useState(false);
    const [confirmedOrderDetails, setConfirmedOrderDetails] = useState(null);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [isRegisteringInModal, setIsRegisteringInModal] = useState(false);
    
    // Auth States (Modal)
    const [emailAuthModal, setEmailAuthModal] = useState('');
    const [passwordAuthModal, setPasswordAuthModal] = useState('');
    const [nomeAuthModal, setNomeAuthModal] = useState('');
    const [telefoneAuthModal, setTelefoneAuthModal] = useState('');
    const [ruaAuthModal, setRuaAuthModal] = useState('');
    const [numeroAuthModal, setNumeroAuthModal] = useState('');
    const [bairroAuthModal, setBairroAuthModal] = useState('');
    const [cidadeAuthModal, setCidadeAuthModal] = useState('');
    // eslint-disable-next-line no-unused-vars
    const [complementoAuthModal, setComplementoAuthModal] = useState('');
    const auth = getAuth();

    // Coupon & Search
    const [couponCodeInput, setCouponCodeInput] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [couponLoading, setCouponLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    // eslint-disable-next-line no-unused-vars
    const [availableCategories, setAvailableCategories] = useState([]);
    
    // Modals
    const [itemParaAdicionais, setItemParaAdicionais] = useState(null);
    const [itemParaVariacoes, setItemParaVariacoes] = useState(null);
    const [visibleItemsCount, setVisibleItemsCount] = useState({});
    
    const [loading, setLoading] = useState(true);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [pedidoParaPagamento, setPedidoParaPagamento] = useState(null); 
    // eslint-disable-next-line no-unused-vars
    const [processandoPagamento, setProcessandoPagamento] = useState(false);

    // 🎨 Cores padrão Claras
    const [coresEstabelecimento, setCoresEstabelecimento] = useState({
        primaria: '#ffffff',
        destaque: '#059669', 
        background: '#f9fafb',
        texto: { 
            principal: '#111827',
            secundario: '#4B5563', 
            placeholder: '#9CA3AF', 
            destaque: '#FBBF24', 
            erro: '#EF4444', 
            sucesso: '#10B981' 
        }
    });

    // CÁLCULOS
    const subtotalCalculado = useMemo(() => carrinho.reduce((acc, item) => acc + (item.precoFinal * item.qtd), 0), [carrinho]);
    const taxaAplicada = isRetirada ? 0 : taxaEntregaCalculada;
    const finalOrderTotal = useMemo(() => Math.max(0, subtotalCalculado + taxaAplicada - discountAmount), [subtotalCalculado, taxaAplicada, discountAmount]);

    // --- FUNÇÕES AUXILIARES ---
    const cleanData = (obj) => {
        if (obj === null || obj === undefined) return obj;
        return Object.entries(obj).reduce((acc, [key, value]) => {
            if (value === undefined) {
                acc[key] = null;
            } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                if (value instanceof Date || (value.seconds !== undefined) || ('_methodName' in value && value._methodName.includes('serverTimestamp'))) { 
                    acc[key] = value;
                } else {
                    acc[key] = cleanData(value);
                }
            } else if (Array.isArray(value)) {
                acc[key] = value.map(item => typeof item === 'object' ? cleanData(item) : item);
            } else {
                acc[key] = value;
            }
            return acc;
        }, {});
    };

    const normalizarTexto = (texto) => {
        if (!texto) return '';
        return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    };

    const scrollToResumo = () => {
        const elementoResumo = document.getElementById('resumo-carrinho');
        if (elementoResumo) elementoResumo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const formatarHorarios = (horarios) => {
        if (!horarios || typeof horarios !== 'object') return "Horário não informado";
        return Object.entries(horarios).map(([dia, horario]) => {
            if (!horario?.abertura || !horario?.fechamento) return `${dia}: Fechado`;
            return `${dia}: ${horario.abertura} - ${horario.fechamento}`;
        }).join(' | ');
    };

    // Função de Logout
    const handleLogout = async () => {
        try {
            await logout(); 
            setNomeCliente('');
            setTelefoneCliente('');
            setRua('');
            setNumero('');
            setBairro('');
            setCidade('');
            setCarrinho([]);
            window.location.reload(); 
        } catch (error) {
            console.error("Erro ao sair", error);
        }
    };

    // DELIVERY FEE
    useEffect(() => {
        const calcularTaxa = async () => {
            if (!actualEstabelecimentoId || !bairro || isRetirada) {
                setTaxaEntregaCalculada(0);
                return;
            }
            try {
                const bairroCliente = normalizarTexto(bairro);
                const taxasRef1 = collection(db, 'estabelecimentos', actualEstabelecimentoId, 'taxas');
                const taxasRef2 = collection(db, 'estabelecimentos', actualEstabelecimentoId, 'taxasDeEntrega'); 
                const [snap1, snap2] = await Promise.all([getDocs(taxasRef1), getDocs(taxasRef2)]);
                const todasTaxas = [...snap1.docs, ...snap2.docs];
                
                let taxaEncontrada = 0;
                let encontrou = false;

                todasTaxas.forEach(doc => {
                    const data = doc.data();
                    const bairroDb = normalizarTexto(data.bairro || data.nome || data.nomeBairro || '');
                    const valor = Number(data.valor || data.valorTaxa || 0);
                    if (bairroDb && (bairroCliente.includes(bairroDb) || bairroDb.includes(bairroCliente))) {
                        if (valor > 0) {
                            taxaEncontrada = valor;
                            encontrou = true;
                        }
                    }
                });
                setTaxaEntregaCalculada(encontrou ? taxaEncontrada : 0);
            } catch (error) {
                console.error("Critical error calculating fee:", error);
                setTaxaEntregaCalculada(0);
            }
        };
        const delayDebounceFn = setTimeout(() => { calcularTaxa(); }, 800);
        return () => clearTimeout(delayDebounceFn);
    }, [bairro, actualEstabelecimentoId, isRetirada]);

    const carregarProdutosRapido = async (estabId) => {
        try {
            let todosProdutos = [];
            const cardapioDiretoRef = collection(db, 'estabelecimentos', estabId, 'cardapio');
            const qDireta = query(cardapioDiretoRef, where('ativo', '==', true)); 
            const snapshotDireto = await getDocs(qDireta);

            if (!snapshotDireto.empty) {
                todosProdutos = snapshotDireto.docs
                    .map(doc => ({ ...doc.data(), id: doc.id, categoria: doc.data().categoria || 'Geral' }))
                    .filter(item => item.preco !== undefined || item.precoFinal !== undefined);
            }

            if (todosProdutos.length > 0) return todosProdutos;

            const categoriasSnapshot = await getDocs(cardapioDiretoRef);
            if (!categoriasSnapshot.empty) {
                const promessas = categoriasSnapshot.docs.map(catDoc => {
                    const categoriaId = catDoc.id;
                    const categoriaData = catDoc.data();
                    if (categoriaData.preco) return Promise.resolve([]); 
                    return getDocs(collection(db, 'estabelecimentos', estabId, 'cardapio', categoriaId, 'itens'))
                        .then(itensSnapshot => itensSnapshot.docs.map(itemDoc => ({
                            ...itemDoc.data(),
                            id: itemDoc.id,
                            categoria: categoriaData.nome || 'Geral',
                            categoriaId: categoriaId
                        })));
                });
                const resultados = await Promise.all(promessas);
                todosProdutos = resultados.flat();
            }
            return todosProdutos;
        } catch (error) {
            console.error("Error loading products:", error);
            return [];
        }
    };

    // CARRINHO ACTIONS
    
    const handleAbrirModalProduto = (item) => {
        if (!currentUser || !currentUser.uid) { 
            toast.info('Por favor, faça login para continuar.'); 
            setShowLoginPrompt(true); 
            return; 
        }

        if (item.variacoes && item.variacoes.length > 0) { setItemParaVariacoes(item); } 
        else if(item.adicionais && item.adicionais.length > 0) { setItemParaAdicionais(item); } 
        else { handleAdicionarRapido(item); }
    };

    const handleAdicionarRapido = (item) => {
        if (!currentUser || !currentUser.uid) { 
            toast.info('Por favor, faça login para continuar.'); 
            setShowLoginPrompt(true); 
            return; 
        }

        const precoParaCarrinho = item.precoFinal !== undefined ? item.precoFinal : item.preco;
        setCarrinho(prev => [...prev, { ...item, qtd: 1, cartItemId: uuidv4(), precoFinal: precoParaCarrinho }]);
        toast.success(`${item.nome} adicionado!`, { autoClose: 1000, hideProgressBar: true });
    };

    // --- FUNÇÕES DE CONFIRMAÇÃO CORRIGIDAS ---
    const handleConfirmarVariacoes = (itemConfigurado) => {
        // CORREÇÃO: Forçar o uso do preço da variação como preço base
        let precoBaseReal = Number(itemConfigurado.preco);
        
        if (itemConfigurado.variacaoSelecionada && itemConfigurado.variacaoSelecionada.preco) {
            precoBaseReal = Number(itemConfigurado.variacaoSelecionada.preco);
        }

        // Cria um objeto atualizado onde o 'preco' base agora é o da variação
        const itemAtualizado = {
            ...itemConfigurado,
            preco: precoBaseReal, // Isso garante que o modal de adicionais calcule corretamente
            precoFinal: precoBaseReal
        };

        if (itemConfigurado.adicionais && itemConfigurado.adicionais.length > 0) {
            setItemParaAdicionais(itemAtualizado);
            setItemParaVariacoes(null);
        } else {
            setCarrinho(prev => [...prev, { 
                ...itemAtualizado, 
                qtd: 1, 
                cartItemId: uuidv4(), 
                precoFinal: precoBaseReal 
            }]);
            
            toast.success(`${itemConfigurado.nome} adicionado!`, { autoClose: 1000, hideProgressBar: true });
            setItemParaVariacoes(null);
        }
    };

    const handleConfirmarAdicionais = (itemConfigurado) => {
        setCarrinho(prev => [...prev, { 
            ...itemConfigurado, 
            qtd: 1, 
            cartItemId: uuidv4(), 
            // Usa o precoFinal que vem calculado do modal de adicionais
            precoFinal: Number(itemConfigurado.precoFinal || itemConfigurado.preco) 
        }]);
        toast.success(`${itemConfigurado.nome} adicionado!`, { autoClose: 1000, hideProgressBar: true });
        setItemParaAdicionais(null);
    };
    // ------------------------------------------

    const removerDoCarrinho = (cartItemId) => {
        const item = carrinho.find((p) => p.cartItemId === cartItemId);
        if (!item) return;
        if (item.qtd === 1) setCarrinho(carrinho.filter((p) => p.cartItemId !== cartItemId));
        else setCarrinho(carrinho.map((p) => (p.cartItemId === cartItemId ? { ...p, qtd: p.qtd - 1 } : p)));
    };

    const formatarItemCarrinho = (item) => {
        let nome = item.nome;
        if (item.variacaoSelecionada?.nome) nome += ` - ${item.variacaoSelecionada.nome}`;
        if (item.adicionais?.length > 0) nome += ` (${item.adicionais.map(ad => `+ ${ad.nome}`).join(', ')})`;
        if (item.removidos?.length > 0) nome += ` (Sem: ${item.removidos.join(', ')})`;
        if (item.observacao) nome += ` (Obs: ${item.observacao})`;
        return nome;
    };

    // CUPOM
    const handleApplyCoupon = async () => {
        if (!currentUser) { toast.warn('Faça login.'); setShowLoginPrompt(true); return; }
        if (!couponCodeInput.trim()) return toast.warn('Digite o código.');
        setCouponLoading(true);
        try {
            const couponsRef = collection(db, 'estabelecimentos', actualEstabelecimentoId, 'cupons');
            const q = query(couponsRef, where('codigo', '==', couponCodeInput.toUpperCase().trim()));
            const snap = await getDocs(q);
            if (snap.empty) throw new Error('Cupom inválido.');
            const data = { id: snap.docs[0].id, ...snap.docs[0].data() };
            if (!data.ativo) throw new Error('Cupom inativo.');
            
            let discount = 0;
            if (data.tipoDesconto === 'percentual') discount = subtotalCalculado * (data.valorDesconto / 100);
            else if (data.tipoDesconto === 'valorFixo') discount = Math.min(data.valorDesconto, subtotalCalculado);
            else if (data.tipoDesconto === 'freteGratis') discount = taxaAplicada;

            setAppliedCoupon(data);
            setDiscountAmount(discount);
            toast.success('Cupom aplicado!');
        } catch (e) { toast.error(e.message); setAppliedCoupon(null); setDiscountAmount(0); }
        finally { setCouponLoading(false); }
    };

    const removeAppliedCoupon = () => { setAppliedCoupon(null); setDiscountAmount(0); setCouponCodeInput(''); };

    // PAGAMENTO
    const prepararParaPagamento = () => {
        if (!currentUser) return setShowLoginPrompt(true);
        if (!actualEstabelecimentoId || !nomeCliente.trim() || !telefoneCliente.trim() || carrinho.length === 0) return toast.warn('Dados incompletos.');
        if (!isRetirada && (!rua.trim() || !numero.trim() || !bairro.trim() || !cidade.trim())) return toast.warn('Endereço incompleto.');

        const itensFormatados = carrinho.map(item => ({
            nome: formatarItemCarrinho(item), nomeBase: item.nome, quantidade: item.qtd,
            preco: Number(item.precoFinal), imageUrl: item.imageUrl || null, adicionais: item.adicionais || [],
            variacaoSelecionada: item.variacaoSelecionada || null, removidos: item.removidos || [], observacao: item.observacao || null
        }));

        const pedidoRaw = {
            cliente: {
                nome: nomeCliente.trim(),
                telefone: telefoneCliente.trim(),
                endereco: isRetirada ? null : { 
                    rua: rua.trim(), numero: numero.trim(), bairro: bairro.trim(), cidade: cidade.trim(), complemento: complemento.trim() 
                },
                userId: currentUser.uid
            },
            estabelecimentoId: actualEstabelecimentoId,
            itens: itensFormatados,
            status: 'aguardando_pagamento',
            createdAt: serverTimestamp(),
            tipo: isRetirada ? 'retirada' : 'delivery',
            formaPagamento: 'processando',
            taxaEntrega: Number(taxaAplicada || 0),
            totalFinal: Number(finalOrderTotal || 0),
            cupomAplicado: appliedCoupon ? { ...appliedCoupon, descontoCalculado: discountAmount } : null
        };

        setPedidoParaPagamento(pedidoRaw); 
        setShowPaymentModal(true);
    };

    const handlePagamentoSucesso = async (paymentResult) => {
        setProcessandoPagamento(true);
        try {
            const pedidoFinalRaw = {
                ...pedidoParaPagamento,
                status: 'recebido',
                formaPagamento: paymentResult.method || 'desconhecido',
                statusPagamento: 'aprovado',
                transactionId: paymentResult.transactionId || `tx_${Date.now()}`,
                paymentData: { method: paymentResult.method, amount: paymentResult.amount, timestamp: new Date().toISOString() }
            };
            if (appliedCoupon) { 
                await runTransaction(db, async (transaction) => {
                    const couponRef = doc(db, 'estabelecimentos', actualEstabelecimentoId, 'cupons', appliedCoupon.id);
                    const couponSnap = await transaction.get(couponRef);
                    if (couponSnap.exists()) {
                        const currentUsos = couponSnap.data().usosAtuais || 0;
                        transaction.update(couponRef, { usosAtuais: currentUsos + 1 });
                    }
                });
            }

            const pedidoFinal = cleanData(pedidoFinalRaw); 
            const docRef = await addDoc(collection(db, 'pedidos'), pedidoFinal);

            setConfirmedOrderDetails({ id: docRef.id, ...pedidoFinal });
            setShowOrderConfirmationModal(true);
            toast.success('Pedido confirmado!');
            setCarrinho([]); setAppliedCoupon(null); setDiscountAmount(0); setCouponCodeInput(''); setShowPaymentModal(false); setPedidoParaPagamento(null);
        } catch (e) { console.error("Error saving order:", e); toast.error(`Erro: ${e.message}`); } 
        finally { setProcessandoPagamento(false); }
    };

    const handlePagamentoFalha = (error) => {
        toast.error(`Falha no pagamento: ${error.message}`);
        setProcessandoPagamento(false);
    };

    const handleLoginModal = async (e) => {
        e.preventDefault();
        try { await signInWithEmailAndPassword(auth, emailAuthModal, passwordAuthModal); toast.success('Login OK'); setShowLoginPrompt(false); }
        catch { toast.error("Erro no login"); }
    };
    
    const handleRegisterModal = async (e) => {
        e.preventDefault();
        try { 
            const cred = await createUserWithEmailAndPassword(auth, emailAuthModal, passwordAuthModal);
            await setDocFirestore(doc(db, 'clientes', cred.user.uid), {
                nome: nomeAuthModal, telefone: telefoneAuthModal, email: emailAuthModal,
                endereco: { rua: ruaAuthModal, numero: numeroAuthModal, bairro: bairroAuthModal, cidade: cidadeAuthModal },
                criadoEm: Timestamp.now()
            });
            toast.success('Conta criada!'); setShowLoginPrompt(false);
        } catch { toast.error("Erro ao criar conta."); }
    };

    // EFFECTS
    useEffect(() => {
        if (!actualEstabelecimentoId) return;
        const unsub = onSnapshot(doc(db, 'estabelecimentos', actualEstabelecimentoId), (d) => { if(d.exists() && d.data().cores) setCoresEstabelecimento(d.data().cores); });
        return () => unsub();
    }, [actualEstabelecimentoId]);

    useEffect(() => {
        if (!estabelecimentoSlug) return;
        const load = async () => {
            setLoading(true);
            const q = query(collection(db, 'estabelecimentos'), where('slug', '==', estabelecimentoSlug));
            const snap = await getDocs(q);
            if (snap.empty) { navigate('/'); return; }
            
            const data = snap.docs[0].data();
            const id = snap.docs[0].id;
            
            const prods = await carregarProdutosRapido(id);
            setEstabelecimentoInfo({ ...data, id });
            setActualEstabelecimentoId(id);
            setNomeEstabelecimento(data.nome);
            if (data.cores) setCoresEstabelecimento(data.cores);
            
            if (data.ordemCategorias) {
                setOrdemCategorias(data.ordemCategorias);
            }

            setAllProdutos(prods);
            setAvailableCategories(['Todos', ...new Set(prods.map(p => p.categoria).filter(Boolean))]);
            setLoading(false);
        };
        load();
    }, [estabelecimentoSlug, navigate]);

    useEffect(() => {
        if (!authLoading && currentUser && currentClientData) {
            setNomeCliente(currentClientData.nome || '');
            setTelefoneCliente(currentClientData.telefone || '');
            if (currentClientData.endereco) {
                setRua(currentClientData.endereco.rua || '');
                setNumero(currentClientData.endereco.numero || '');
                setBairro(currentClientData.endereco.bairro || '');
                setCidade(currentClientData.endereco.cidade || '');
                setComplemento(currentClientData.endereco.complemento || '');
            }
        }
    }, [currentUser, currentClientData, authLoading]);

    useEffect(() => {
        let p = [...allProdutos];
        if (selectedCategory !== 'Todos') p = p.filter(prod => prod.categoria === selectedCategory);
        if (searchTerm) p = p.filter(prod => prod.nome.toLowerCase().includes(searchTerm.toLowerCase()));
        setProdutosFiltrados(p);
    }, [allProdutos, selectedCategory, searchTerm]);

    const handleShowMore = (cat) => setVisibleItemsCount(p => ({ ...p, [cat]: (p[cat] || 4) + 4 }));
    const handleShowLess = (cat) => setVisibleItemsCount(p => ({ ...p, [cat]: 4 }));

    // --- AGRUPAMENTO E ORDENAÇÃO DE CATEGORIAS ---
    const menuAgrupado = produtosFiltrados.reduce((acc, p) => { 
        const cat = p.categoria || 'Outros'; 
        if (!acc[cat]) acc[cat] = []; 
        acc[cat].push(p); 
        return acc; 
    }, {});

    const categoriasDisponiveis = Object.keys(menuAgrupado);

    const categoriasOrdenadas = categoriasDisponiveis.sort((a, b) => {
        if (!ordemCategorias || ordemCategorias.length === 0) return a.localeCompare(b);
        const indexA = ordemCategorias.indexOf(a);
        const indexB = ordemCategorias.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    // --- COMPONENTE INFO CORRIGIDO (LATERAL) ---
    const InfoEstabelecimento = () => (
        estabelecimentoInfo ? (
            <div className="bg-white rounded-xl p-6 mb-6 mt-6 border border-gray-200 flex flex-row gap-6 items-center shadow-lg">
                {(estabelecimentoInfo.logoUrl || estabelecimentoInfo.imageUrl) && (
                    <img 
                        src={estabelecimentoInfo.logoUrl || estabelecimentoInfo.imageUrl} 
                        className="w-24 h-24 rounded-xl object-cover border-2 shrink-0" 
                        style={{ borderColor: coresEstabelecimento.primaria }} 
                        alt="Logo" 
                    />
                )}
                <div className="flex-1 text-left">
                    <h1 className="text-3xl font-bold mb-2" style={{ color: coresEstabelecimento.texto.principal }}>{estabelecimentoInfo.nome}</h1>
                    {estabelecimentoInfo.descricao && (
                        <p className="text-sm mb-3 text-gray-500 max-w-2xl">{estabelecimentoInfo.descricao}</p>
                    )}
                    
                    <div className="flex flex-col gap-1 text-sm text-gray-600">
                        {estabelecimentoInfo.endereco?.rua && (
                            <div className="flex items-center gap-2">
                                <IoLocationSharp className="text-red-500" />
                                <p>{estabelecimentoInfo.endereco.rua}, {estabelecimentoInfo.endereco.numero}</p>
                            </div>
                        )}
                        {estabelecimentoInfo.telefone && (
                            <div className="flex items-center gap-2">
                                <IoCall className="text-green-500" />
                                <p>{estabelecimentoInfo.telefone}</p>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <IoTime className="text-blue-500" />
                            <p>{estabelecimentoInfo.horarioFuncionamento ? formatarHorarios(estabelecimentoInfo.horarioFuncionamento) : "Aberto"}</p>
                        </div>
                    </div>
                </div>
            </div>
        ) : null
    );

    // 🔒 BLOQUEIO DE RENDERIZAÇÃO:
    if (loading || authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-900">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-green-600"></div>
                    <p className="text-gray-500 font-medium animate-pulse">Carregando cardápio...</p>
                </div>
            </div>
        );
    }

    // 🛡️ 2. AQUI ESTÁ A TELA DE BLOQUEIO DE ADMIN
    if (currentUser && (isAdmin || isMasterAdmin)) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-gray-200">
                    <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-4xl">🛡️</span>
                    </div>
                    
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Acesso Administrativo</h1>
                    
                    <p className="text-gray-600 mb-8 leading-relaxed">
                        Você está logado como <strong>{isMasterAdmin ? 'Master Admin' : 'Administrador'}</strong> ({currentUser.email}).
                        <br/><br/>
                        O cardápio é exclusivo para a visão do cliente. Para fazer pedidos de teste, saia da conta administrativa.
                    </p>

                    <div className="space-y-3">
                        <button
                            onClick={() => navigate(isMasterAdmin ? '/master/estabelecimentos' : '/admin/dashboard')}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                            Ir para o Painel
                        </button>

                        <button
                            onClick={handleLogout}
                            className="w-full bg-white hover:bg-red-50 text-red-600 py-3.5 rounded-xl font-bold border-2 border-red-100 transition-all flex items-center justify-center gap-2"
                        >
                            <IoLogOutOutline size={20} />
                            Sair e Acessar como Cliente
                        </button>
                    </div>
                </div>
            </div>
        );
    }
    
    return (
        <div className="w-full relative overflow-x-hidden" style={{ backgroundColor: coresEstabelecimento.background, color: coresEstabelecimento.texto.principal, minHeight: '100vh', paddingBottom: '200px' }}>
            
            <div className="max-w-7xl mx-auto px-4 w-full">
                {/* CABEÇALHO COM LOGO LATERAL */}
                <InfoEstabelecimento />
                
                <div className="bg-white p-4 mb-8 border-b border-gray-200 sticky top-0 z-40 shadow-sm -mx-4 px-8 md:mx-0 md:px-4 md:rounded-lg">
                    <div className="max-w-7xl mx-auto">
                        <input 
                            type="text" 
                            placeholder="🔍 Buscar produto..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="w-full p-3 mb-4 bg-gray-50 rounded-lg border border-gray-300 focus:outline-none focus:border-green-500 text-base text-gray-900 placeholder-gray-400 shadow-inner" 
                        />
                        <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
                            {['Todos', ...categoriasOrdenadas].map(cat => (
                                <button 
                                    key={cat} 
                                    onClick={() => setSelectedCategory(cat)} 
                                    className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                                        selectedCategory === cat 
                                            ? 'text-white shadow-md transform scale-105' 
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                                    }`} 
                                    style={{ 
                                        backgroundColor: selectedCategory === cat ? coresEstabelecimento.primaria : undefined, 
                                        border: selectedCategory === cat ? `2px solid ${coresEstabelecimento.destaque}` : undefined 
                                    }}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {categoriasOrdenadas.length === 0 ? <p className="text-center text-gray-500 mt-10">Nenhum produto encontrado.</p> : 
                    categoriasOrdenadas.map(cat => {
                        const items = menuAgrupado[cat];
                        const visible = visibleItemsCount[cat] || 4;
                        return (
                            <div key={cat} id={`categoria-${cat}`} className="mb-8">
                                <h2 className="text-2xl font-bold mb-4 flex justify-between items-center text-gray-900">{cat} <span className="text-sm font-normal bg-gray-100 px-2 py-1 rounded text-gray-500 border border-gray-200">{items.length}</span></h2>
                                <div className="grid gap-4">{items.slice(0, visible).map(item => <CardapioItem key={item.id} item={item} onAddItem={handleAbrirModalProduto} onQuickAdd={handleAdicionarRapido} coresEstabelecimento={coresEstabelecimento} />)}</div>
                                {items.length > 4 && <button onClick={() => visible >= items.length ? handleShowLess(cat) : handleShowMore(cat)} className="w-full mt-2 py-2 text-sm font-bold text-gray-500 hover:text-gray-900 bg-gray-100 border border-gray-200 hover:bg-gray-200 rounded-lg transition shadow-sm">{visible >= items.length ? 'Ver menos' : `Ver mais (${items.length - visible})`}</button>}
                            </div>
                        );
                    })
                }

                <div className="grid md:grid-cols-2 gap-8 mt-12 pb-12">
                    <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-200 shadow-lg w-full max-w-full overflow-hidden">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-gray-900">👤 Seus Dados</h3>
                            {currentUser ? (
                                <button 
                                    onClick={handleLogout}
                                    className="text-xs text-red-500 flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded transition-colors border border-red-200"
                                >
                                    <IoLogOutOutline size={16} />
                                    Sair ({currentUser.email})
                                </button>
                            ) : (
                                <button 
                                    onClick={() => setShowLoginPrompt(true)}
                                    className="text-xs text-green-600 flex items-center gap-1 hover:bg-green-50 px-2 py-1 rounded transition-colors border border-green-200"
                                >
                                    Fazer Login
                                </button>
                            )}
                        </div>
                        <div className="space-y-4">
                            <input className="w-full p-3 bg-gray-50 rounded border border-gray-300 text-base min-w-0 text-gray-900 placeholder-gray-400" placeholder="Nome *" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} />
                            <input className="w-full p-3 bg-gray-50 rounded border border-gray-300 text-base min-w-0 text-gray-900 placeholder-gray-400" placeholder="Telefone *" type="tel" value={telefoneCliente} onChange={e => setTelefoneCliente(e.target.value)} />
                            <div className="flex gap-2 w-full">
                                <button onClick={() => setIsRetirada(false)} className={`flex-1 p-3 rounded font-bold transition-colors text-sm md:text-base shadow-sm ${!isRetirada ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>🚚 Entrega</button>
                                <button onClick={() => setIsRetirada(true)} className={`flex-1 p-3 rounded font-bold transition-colors text-sm md:text-base shadow-sm ${isRetirada ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>🏪 Retirada</button>
                            </div>
                            {!isRetirada && (
                                <>
                                    <div className="flex gap-2 w-full"><div className="flex-1 min-w-0"><input className="w-full p-3 bg-gray-50 rounded border border-gray-300 text-base min-w-0 text-gray-900 placeholder-gray-400" placeholder="Rua *" value={rua} onChange={e => setRua(e.target.value)} /></div><div className="w-20 md:w-24 flex-shrink-0"><input className="w-full p-3 bg-gray-50 rounded border border-gray-300 text-base text-center text-gray-900 placeholder-gray-400" placeholder="Nº *" value={numero} onChange={e => setNumero(e.target.value)} /></div></div>
                                    <input className="w-full p-3 bg-gray-50 rounded border border-gray-300 text-base min-w-0 text-gray-900 placeholder-gray-400" placeholder="Bairro *" value={bairro} onChange={e => setBairro(e.target.value)} />
                                    <input className="w-full p-3 bg-gray-50 rounded border border-gray-300 text-base min-w-0 text-gray-900 placeholder-gray-400" placeholder="Cidade *" value={cidade} onChange={e => setCidade(e.target.value)} />
                                    <input className="w-full p-3 bg-gray-50 rounded border border-gray-300 text-base min-w-0 text-gray-900 placeholder-gray-400" placeholder="Complemento" value={complemento} onChange={e => setComplemento(e.target.value)} />
                                </>
                            )}
                        </div>
                    </div>

                    <div id="resumo-carrinho" className="bg-white p-6 rounded-xl border border-gray-200 shadow-lg mb-8">
                        <h3 className="text-xl font-bold mb-4 text-gray-900">🛒 Resumo</h3>
                        {carrinho.length === 0 ? <p className="text-gray-500">Seu carrinho está vazio.</p> : (
                            <>
                                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">{carrinho.map(item => (<div key={item.cartItemId} className="flex justify-between items-start bg-gray-50 border border-gray-200 p-3 rounded"><div className="flex-1 pr-2"><p className="font-bold text-sm text-gray-900">{formatarItemCarrinho(item)}</p><p className="text-xs text-gray-500">R$ {item.precoFinal.toFixed(2)} x {item.qtd}</p></div><button onClick={() => removerDoCarrinho(item.cartItemId)} className="text-red-500 font-bold p-1 hover:bg-red-50 rounded">✕</button></div>))}</div>
                                <div className="border-t border-gray-200 pt-4 space-y-2 text-sm">
                                    <div className="flex justify-between text-gray-600"><span>Subtotal:</span> <span>R$ {subtotalCalculado.toFixed(2)}</span></div>
                                    {!isRetirada && <div className="flex justify-between text-gray-600"><span>Taxa de Entrega:</span> <span>R$ {taxaAplicada.toFixed(2)}</span></div>}
                                    {discountAmount > 0 && <div className="flex justify-between text-green-600 font-bold"><span>Desconto:</span> <span>- R$ {discountAmount.toFixed(2)}</span></div>}
                                    <div className="flex gap-2 mt-4 pt-2 border-t border-gray-200"><input placeholder="CUPOM" value={couponCodeInput} onChange={e => setCouponCodeInput(e.target.value)} className="flex-1 bg-gray-50 p-2 rounded border border-gray-300 text-sm text-gray-900 uppercase" /><button onClick={appliedCoupon ? removeAppliedCoupon : handleApplyCoupon} disabled={couponLoading} className={`px-3 rounded text-sm font-bold ${appliedCoupon ? 'bg-red-600' : 'bg-green-600'} text-white shadow-sm`}>{couponLoading ? '...' : (appliedCoupon ? 'Remover' : 'Aplicar')}</button></div>
                                    <div className="flex justify-between text-xl font-bold mt-4 pt-4 border-t border-gray-200 text-gray-900"><span>Total:</span><span style={{ color: coresEstabelecimento.destaque }}>R$ {finalOrderTotal.toFixed(2)}</span></div>
                                </div>
                                <button onClick={prepararParaPagamento} className="w-full mt-6 py-4 rounded-xl font-bold text-lg text-white shadow-lg transform active:scale-95 transition-all" style={{ backgroundColor: coresEstabelecimento.destaque }}>✅ Finalizar Pedido</button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <CarrinhoFlutuante carrinho={carrinho} coresEstabelecimento={coresEstabelecimento} onClick={scrollToResumo} />
            
            {showPaymentModal && pedidoParaPagamento && <PaymentModal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} amount={finalOrderTotal} orderId={`ord_${Date.now()}`} cartItems={carrinho} customer={pedidoParaPagamento.cliente} onSuccess={handlePagamentoSucesso} onError={handlePagamentoFalha} coresEstabelecimento={coresEstabelecimento} pixKey={estabelecimentoInfo?.chavePix} establishmentName={estabelecimentoInfo?.nome} />}
            
            {showOrderConfirmationModal && confirmedOrderDetails && <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"><div className="bg-white p-8 rounded-2xl max-w-md w-full text-center border border-gray-200 shadow-2xl"><div className="text-6xl mb-4">🎉</div><h2 className="text-3xl font-bold text-gray-900 mb-2">Pedido Confirmado!</h2><p className="text-gray-500 mb-6">ID: {confirmedOrderDetails.id}</p><button onClick={() => setShowOrderConfirmationModal(false)} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg">Fechar</button></div></div>}
            
            {/* --- MODAL DE LOGIN / CRIAR CONTA ATUALIZADO --- */}
            {showLoginPrompt && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 px-4">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-md border border-gray-200 shadow-2xl relative">
                        <button onClick={() => setShowLoginPrompt(false)} className="absolute top-4 right-4 text-gray-400 text-2xl hover:text-gray-600">&times;</button>
                        
                        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">{isRegisteringInModal ? 'Criar Conta' : 'Login'}</h2>
                        
                        <form onSubmit={isRegisteringInModal ? handleRegisterModal : handleLoginModal} className="space-y-4">
                            {isRegisteringInModal && (
                                <>
                                    <input placeholder="Nome" value={nomeAuthModal} onChange={e => setNomeAuthModal(e.target.value)} className="w-full p-3 bg-gray-50 rounded border border-gray-300 text-base text-gray-900" />
                                    <input placeholder="Telefone" value={telefoneAuthModal} onChange={e => setTelefoneAuthModal(e.target.value)} className="w-full p-3 bg-gray-50 rounded border border-gray-300 text-base text-gray-900" />
                                    
                                    {/* --- CAMPOS ADICIONADOS PARA ENDEREÇO COMPLETO --- */}
                                    <input placeholder="Rua" value={ruaAuthModal} onChange={e => setRuaAuthModal(e.target.value)} className="w-full p-3 bg-gray-50 rounded border border-gray-300 text-base text-gray-900" />
                                    <div className="flex gap-2">
                                        <input placeholder="Nº" value={numeroAuthModal} onChange={e => setNumeroAuthModal(e.target.value)} className="w-1/3 p-3 bg-gray-50 rounded border border-gray-300 text-base text-gray-900" />
                                        <input placeholder="Bairro" value={bairroAuthModal} onChange={e => setBairroAuthModal(e.target.value)} className="w-2/3 p-3 bg-gray-50 rounded border border-gray-300 text-base text-gray-900" />
                                    </div>
                                    <input placeholder="Cidade" value={cidadeAuthModal} onChange={e => setCidadeAuthModal(e.target.value)} className="w-full p-3 bg-gray-50 rounded border border-gray-300 text-base text-gray-900" />
                                </>
                            )}
                            <input type="email" placeholder="Email" value={emailAuthModal} onChange={e => setEmailAuthModal(e.target.value)} className="w-full p-3 bg-gray-50 rounded border border-gray-300 text-base text-gray-900" />
                            <input type="password" placeholder="Senha" value={passwordAuthModal} onChange={e => setPasswordAuthModal(e.target.value)} className="w-full p-3 bg-gray-50 rounded border border-gray-300 text-base text-gray-900" />
                            
                            <button type="submit" className="w-full bg-green-600 text-white py-3 rounded font-bold shadow-md">{isRegisteringInModal ? 'Cadastrar' : 'Entrar'}</button>
                        </form>
                        
                        <button onClick={() => setIsRegisteringInModal(!isRegisteringInModal)} className="w-full mt-4 text-green-600 text-sm font-semibold">{isRegisteringInModal ? 'Já tenho conta' : 'Criar conta'}</button>
                    </div>
                </div>
            )}

            {itemParaVariacoes && <VariacoesModal item={itemParaVariacoes} onConfirm={handleConfirmarVariacoes} onClose={() => setItemParaVariacoes(null)} coresEstabelecimento={coresEstabelecimento} />}
            {itemParaAdicionais && <AdicionaisModal item={itemParaAdicionais} onConfirm={handleConfirmarAdicionais} onClose={() => setItemParaAdicionais(null)} coresEstabelecimento={coresEstabelecimento} />}
        </div>
    );
}

export default Menu;