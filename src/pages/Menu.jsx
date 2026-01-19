import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, Timestamp, setDoc as setDocFirestore, doc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import CardapioItem from '../components/CardapioItem';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import AdicionaisModal from '../components/AdicionaisModal';
import VariacoesModal from '../components/VariacoesModal';
import { v4 as uuidv4 } from 'uuid';
import PaymentModal from '../components/PaymentModal';
import CarrinhoFlutuante from '../components/CarrinhoFlutuante';
import RaspadinhaModal from '../components/RaspadinhaModal';

// 🔥 IMPORTS DA INTELIGÊNCIA ARTIFICIAL
import { useAI } from '../context/AIContext';
import AIChatAssistant from '../components/AIChatAssistant';
import AIWidgetButton from '../components/AIWidgetButton';

import { IoLocationSharp, IoTime, IoLogOutOutline, IoPerson } from 'react-icons/io5';

function Menu() {
    const { estabelecimentoSlug } = useParams();
    const navigate = useNavigate();

    const { currentUser, currentClientData, loading: authLoading, isAdmin, isMasterAdmin, logout } = useAuth();
    const { isWidgetOpen } = useAI();
    const [showAICenter, setShowAICenter] = useState(true);

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

    const [nomeEstabelecimento, setNomeEstabelecimento] = useState("Carregando...");
    const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
    const [actualEstabelecimentoId, setActualEstabelecimentoId] = useState(null);

    const [showOrderConfirmationModal, setShowOrderConfirmationModal] = useState(false);
    const [confirmedOrderDetails, setConfirmedOrderDetails] = useState(null);
    
    // --- ESTADOS DO LOGIN ---
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [isRegisteringInModal, setIsRegisteringInModal] = useState(false);

    const [emailAuthModal, setEmailAuthModal] = useState('');
    const [passwordAuthModal, setPasswordAuthModal] = useState('');
    const [nomeAuthModal, setNomeAuthModal] = useState('');
    const [telefoneAuthModal, setTelefoneAuthModal] = useState('');
    const [ruaAuthModal, setRuaAuthModal] = useState('');
    const [numeroAuthModal, setNumeroAuthModal] = useState('');
    const [bairroAuthModal, setBairroAuthModal] = useState('');
    const [cidadeAuthModal, setCidadeAuthModal] = useState('');
    const [complementoAuthModal, setComplementoAuthModal] = useState('');
    const auth = getAuth();

    const [couponCodeInput, setCouponCodeInput] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [couponLoading, setCouponLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todos');

    const [showRaspadinha, setShowRaspadinha] = useState(false);
    const [jaJogouRaspadinha, setJaJogouRaspadinha] = useState(false);
    const [premioRaspadinha, setPremioRaspadinha] = useState(null);

    const [itemParaAdicionais, setItemParaAdicionais] = useState(null);
    const [itemParaVariacoes, setItemParaVariacoes] = useState(null);
    const [visibleItemsCount, setVisibleItemsCount] = useState({});

    const [loading, setLoading] = useState(true);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [pedidoParaPagamento, setPedidoParaPagamento] = useState(null);
    const [processandoPagamento, setProcessandoPagamento] = useState(false);

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

    // --- 1. FUNÇÕES AUXILIARES ---

    const scrollToResumo = useCallback(() => {
        const elementoResumo = document.getElementById('resumo-carrinho');
        if (elementoResumo) elementoResumo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    const handleAbrirLogin = () => {
        setIsRegisteringInModal(false); 
        setShowLoginPrompt(true);
    };

    const formatarHorarios = useCallback((horarios) => {
        if (!horarios || typeof horarios !== 'object') return "Horário não informado";
        return Object.entries(horarios).map(([dia, horario]) => {
            if (!horario?.abertura || !horario?.fechamento) return `${dia}: Fechado`;
            return `${dia}: ${horario.abertura} - ${horario.fechamento}`;
        }).join(' | ');
    }, []);

    const normalizarTexto = (texto) => {
        if (!texto) return '';
        return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    };

    const superNormalizar = (t) => normalizarTexto(t).replace(/[^a-z0-9]/g, '');

    const formatarItemCarrinho = (item) => {
        let nome = item.nome;
        if (item.variacaoSelecionada?.nome) nome += ` - ${item.variacaoSelecionada.nome}`;
        if (item.observacao) nome += ` (Obs: ${item.observacao})`;
        return nome;
    };

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

    // --- 2. CÁLCULOS FINANCEIROS ---

    const subtotalCalculado = useMemo(() => carrinho.reduce((acc, item) => acc + (item.precoFinal * item.qtd), 0), [carrinho]);

    const taxaAplicada = useMemo(() => {
        if (isRetirada) return 0;
        if (premioRaspadinha?.type === 'frete') return 0;
        return taxaEntregaCalculada;
    }, [isRetirada, taxaEntregaCalculada, premioRaspadinha]);

    const finalOrderTotal = useMemo(() => {
        let total = subtotalCalculado + taxaAplicada - discountAmount;
        if (premioRaspadinha?.type === 'desconto') {
            const valorDesconto = subtotalCalculado * (premioRaspadinha.valor / 100);
            total -= valorDesconto;
        }
        return Math.max(0, total);
    }, [subtotalCalculado, taxaAplicada, discountAmount, premioRaspadinha]);

    // --- 3. LÓGICA DE PRODUTOS E IA ---

    const carregarProdutosRapido = async (estabId) => {
        try {
            const cardapioRef = collection(db, 'estabelecimentos', estabId, 'cardapio');
            const categoriasSnapshot = await getDocs(query(cardapioRef, where('ativo', '==', true)));
            
            const promessas = categoriasSnapshot.docs.map(async (catDoc) => {
                const categoriaData = catDoc.data();
                const itensRef = collection(db, 'estabelecimentos', estabId, 'cardapio', catDoc.id, 'itens');
                const itensSnapshot = await getDocs(query(itensRef, where('ativo', '==', true)));

                return itensSnapshot.docs.map(itemDoc => ({
                    ...itemDoc.data(),
                    id: itemDoc.id,
                    categoria: categoriaData.nome || 'Geral',
                    categoriaId: catDoc.id
                }));
            });

            const resultados = await Promise.all(promessas);
            const todosProdutos = resultados.flat();

            const produtosValidos = todosProdutos.filter(item => 
                item.preco !== undefined || 
                item.precoFinal !== undefined || 
                (item.variacoes && item.variacoes.length > 0)
            );

            return produtosValidos;

        } catch (error) {
            console.error("❌ Erro ao carregar:", error);
            return [];
        }
    };

    const handleAdicionarPorIA = useCallback((comandoCompleto) => {
        let nomeProduto = comandoCompleto;
        let nomeOpcao = null;
        let observacaoIA = '';
        let quantidadeIA = 1;

        if (comandoCompleto.includes('-- Qtd:')) {
            const partesQtd = comandoCompleto.split('-- Qtd:');
            quantidadeIA = parseInt(partesQtd[1].trim()) || 1;
            nomeProduto = partesQtd[0].trim();
        }

        if (nomeProduto.includes('-- Opcao:')) {
            const splitOpcao = nomeProduto.split('-- Opcao:');
            nomeProduto = splitOpcao[0].trim();
            const resto = splitOpcao[1];
            nomeOpcao = resto.split('-- Obs:')[0].trim();
            if (resto.includes('-- Obs:')) observacaoIA = resto.split('-- Obs:')[1].trim();
        }

        const termoBusca = superNormalizar(nomeProduto);
        
        const produtoEncontrado = allProdutos.find(p => {
            const nomeDb = superNormalizar(p.nome);
            return nomeDb === termoBusca || nomeDb.includes(termoBusca) || termoBusca.includes(nomeDb);
        });

        if (!produtoEncontrado) return 'NOT_FOUND';

        let variacaoSelecionada = null;
        if (nomeOpcao) {
            const termoOpcao = superNormalizar(nomeOpcao);
            variacaoSelecionada = produtoEncontrado.variacoes?.find(v => 
                superNormalizar(v.nome) === termoOpcao || superNormalizar(v.nome).includes(termoOpcao)
            );
        } else if (produtoEncontrado.variacoes?.length === 1) {
            variacaoSelecionada = produtoEncontrado.variacoes[0];
        }

        if (variacaoSelecionada || (!produtoEncontrado.variacoes?.length && !produtoEncontrado.adicionais?.length)) {
            const precoFinal = variacaoSelecionada 
                ? Number(variacaoSelecionada.preco || variacaoSelecionada.precoFinal)
                : Number(produtoEncontrado.preco || produtoEncontrado.precoFinal || 0);

            setCarrinho(prev => [...prev, {
                ...produtoEncontrado,
                variacaoSelecionada,
                precoFinal,
                observacao: observacaoIA,
                qtd: quantidadeIA,
                cartItemId: uuidv4()
            }]);
            toast.success(`${quantidadeIA}x ${produtoEncontrado.nome} adicionado!`);
            return 'ADDED';
        }

        setShowAICenter(false);
        handleAbrirModalProduto(produtoEncontrado);
        return 'MODAL';
    }, [allProdutos]);

    // --- 4. AÇÕES DO USUÁRIO ---

    const handleAbrirModalProduto = (item) => {
        if (!currentUser) { 
            toast.info('Faça login para continuar.'); 
            handleAbrirLogin(); 
            return; 
        }
        if (item.variacoes && item.variacoes.length > 0) { setItemParaVariacoes(item); }
        else if (item.adicionais && item.adicionais.length > 0) { setItemParaAdicionais(item); }
        else { handleAdicionarRapido(item); }
    };

    const handleAdicionarRapido = (item) => {
        if (!currentUser) { handleAbrirLogin(); return; }
        const preco = item.precoFinal !== undefined ? item.precoFinal : item.preco;
        setCarrinho(prev => [...prev, { ...item, qtd: 1, cartItemId: uuidv4(), precoFinal: preco }]);
        toast.success(`${item.nome} adicionado!`);
    };

    const handleConfirmarVariacoes = (itemConfigurado) => {
        const preco = Number(itemConfigurado.variacaoSelecionada?.preco || itemConfigurado.preco);
        setCarrinho(prev => [...prev, { ...itemConfigurado, qtd: 1, cartItemId: uuidv4(), precoFinal: preco }]);
        setItemParaVariacoes(null);
    };

    const handleConfirmarAdicionais = (itemConfigurado) => {
        const preco = Number(itemConfigurado.precoFinal || itemConfigurado.preco);
        setCarrinho(prev => [...prev, { ...itemConfigurado, qtd: 1, cartItemId: uuidv4(), precoFinal: preco }]);
        setItemParaAdicionais(null);
    };

    const removerDoCarrinho = (cartItemId) => {
        const item = carrinho.find((p) => p.cartItemId === cartItemId);
        if (!item) return;
        if (item.qtd === 1) setCarrinho(carrinho.filter((p) => p.cartItemId !== cartItemId));
        else setCarrinho(carrinho.map((p) => (p.cartItemId === cartItemId ? { ...p, qtd: p.qtd - 1 } : p)));
    };

    const handleLogout = async () => {
        try { await logout(); setCarrinho([]); window.location.reload(); } 
        catch (e) { console.error(e); }
    };

    const handleApplyCoupon = async () => {
        if (!currentUser) { handleAbrirLogin(); return; }
        if (!couponCodeInput.trim()) return;
        setCouponLoading(true);
        try {
            const couponsRef = collection(db, 'estabelecimentos', actualEstabelecimentoId, 'cupons');
            const q = query(couponsRef, where('codigo', '==', couponCodeInput.toUpperCase().trim()));
            const snap = await getDocs(q);
            if (snap.empty) throw new Error('Cupom inválido.');
            const data = { id: snap.docs[0].id, ...snap.docs[0].data() };
            
            let discount = 0;
            if (data.tipoDesconto === 'percentual') discount = subtotalCalculado * (data.valorDesconto / 100);
            else if (data.tipoDesconto === 'valorFixo') discount = Math.min(data.valorDesconto, subtotalCalculado);
            else if (data.tipoDesconto === 'freteGratis') discount = taxaAplicada;
            
            setAppliedCoupon(data);
            setDiscountAmount(discount);
            toast.success('Cupom aplicado!');
        } catch (e) { toast.error(e.message); } 
        finally { setCouponLoading(false); }
    };

    const prepararParaPagamento = () => {
        if (!currentUser) return handleAbrirLogin();
        if (carrinho.length === 0) return toast.warn('Carrinho vazio.');
        
        const itensFormatados = carrinho.map(item => ({
            nome: formatarItemCarrinho(item),
            quantidade: item.qtd,
            preco: Number(item.precoFinal)
        }));

        const pedidoRaw = {
            cliente: { nome: nomeCliente, telefone: telefoneCliente, endereco: isRetirada ? null : { rua, numero, bairro, cidade }, userId: currentUser.uid },
            estabelecimentoId: actualEstabelecimentoId,
            itens: itensFormatados,
            totalFinal: Number(finalOrderTotal),
            taxaEntrega: Number(taxaAplicada),
            createdAt: serverTimestamp(),
            status: 'aguardando_pagamento'
        };

        setPedidoParaPagamento(pedidoRaw);
        setShowPaymentModal(true);
    };

    const handlePagamentoSucesso = async (result) => {
        setProcessandoPagamento(true);
        try {
            const pedidoFinal = cleanData({ ...pedidoParaPagamento, status: 'recebido', transactionId: result.transactionId });
            const docRef = await addDoc(collection(db, 'pedidos'), pedidoFinal);
            setConfirmedOrderDetails({ id: docRef.id });
            setShowOrderConfirmationModal(true);
            setCarrinho([]);
            setShowPaymentModal(false);
        } catch (e) { console.error(e); } 
        finally { setProcessandoPagamento(false); }
    };

    const handlePagamentoFalha = (error) => toast.error(`Falha: ${error.message}`);
    const handleGanharRaspadinha = (premio) => { setPremioRaspadinha(premio); setJaJogouRaspadinha(true); };

    const handleLoginModal = async (e) => { 
        e.preventDefault(); 
        try { 
            await signInWithEmailAndPassword(auth, emailAuthModal, passwordAuthModal); 
            setShowLoginPrompt(false); 
        } catch { 
            toast.error("Erro no login"); 
        } 
    };
    
    const handleRegisterModal = async (e) => { 
        e.preventDefault(); 
        try { 
            const cred = await createUserWithEmailAndPassword(auth, emailAuthModal, passwordAuthModal); 
            await setDocFirestore(doc(db, 'clientes', cred.user.uid), { 
                nome: nomeAuthModal, 
                telefone: telefoneAuthModal, 
                email: emailAuthModal, 
                endereco: { rua: ruaAuthModal, numero: numeroAuthModal, bairro: bairroAuthModal, cidade: cidadeAuthModal }, 
                criadoEm: Timestamp.now() 
            }); 
            setShowLoginPrompt(false); 
        } catch { 
            toast.error("Erro ao criar conta."); 
        } 
    };

    // --- 5. EFFECTS ---

    useEffect(() => {
        if (!estabelecimentoSlug) return;
        const load = async () => {
            setLoading(true);
            try {
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
                if (data.ordemCategorias) setOrdemCategorias(data.ordemCategorias);
                setAllProdutos(prods);
            } catch (err) { console.error(err); } 
            finally { setLoading(false); }
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
            }
        }
    }, [currentUser, currentClientData, authLoading]);

    useEffect(() => {
        const calcularTaxa = async () => {
            if (!actualEstabelecimentoId || !bairro || isRetirada) { setTaxaEntregaCalculada(0); return; }
            try {
                const bairroNorm = normalizarTexto(bairro);
                const taxasSnap = await getDocs(collection(db, 'estabelecimentos', actualEstabelecimentoId, 'taxas'));
                let taxa = 0;
                taxasSnap.forEach(doc => {
                    const data = doc.data();
                    if (normalizarTexto(data.bairro || '').includes(bairroNorm)) taxa = Number(data.valor);
                });
                setTaxaEntregaCalculada(taxa);
            } catch (e) { setTaxaEntregaCalculada(0); }
        };
        const timer = setTimeout(calcularTaxa, 800);
        return () => clearTimeout(timer);
    }, [bairro, actualEstabelecimentoId, isRetirada]);

    useEffect(() => {
        let p = [...allProdutos];
        if (selectedCategory !== 'Todos') p = p.filter(prod => prod.categoria === selectedCategory);
        if (searchTerm) p = p.filter(prod => prod.nome.toLowerCase().includes(searchTerm.toLowerCase()));
        setProdutosFiltrados(p);
    }, [allProdutos, selectedCategory, searchTerm]);

    const menuAgrupado = useMemo(() => {
        return produtosFiltrados.reduce((acc, p) => {
            const cat = p.categoria || 'Outros';
            if (!acc[cat]) acc[cat] = []; acc[cat].push(p); return acc;
        }, {});
    }, [produtosFiltrados]);

    const categoriasOrdenadas = useMemo(() => Object.keys(menuAgrupado).sort((a, b) => {
        if (!ordemCategorias.length) return a.localeCompare(b);
        return ordemCategorias.indexOf(a) - ordemCategorias.indexOf(b);
    }), [menuAgrupado, ordemCategorias]);

    const handleShowMore = (cat) => setVisibleItemsCount(p => ({ ...p, [cat]: (p[cat] || 4) + 4 }));
    const handleShowLess = (cat) => setVisibleItemsCount(p => ({ ...p, [cat]: 4 }));

    if (loading || authLoading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;

    if (currentUser && (isAdmin || isMasterAdmin)) return <div className="p-10 text-center">Acesso Admin. Saia para ver o cardápio.<button onClick={handleLogout} className="block mx-auto mt-4 bg-red-600 text-white p-2 rounded">Sair</button></div>;

    return (
        <div className="w-full relative min-h-screen text-left" style={{ backgroundColor: coresEstabelecimento.background, color: coresEstabelecimento.texto.principal, paddingBottom: '150px' }}>
            
            <div className="max-w-7xl mx-auto px-4 w-full">
                
                {/* INFO E CABEÇALHO */}
                {estabelecimentoInfo && (
                    <div className="bg-white rounded-xl p-4 md:p-6 mb-6 mt-6 border flex flex-col md:flex-row gap-4 md:gap-6 items-center shadow-lg relative text-center md:text-left">
                        {/* Botão de Login */}
                        <div className="absolute top-3 right-3 z-10 md:top-4 md:right-4">
                             {currentUser ? (
                                <button onClick={handleLogout} className="flex items-center gap-2 text-xs md:text-sm text-red-500 bg-red-50 px-3 py-1.5 rounded-full border border-red-100 hover:bg-red-100 transition-colors">
                                    <IoLogOutOutline size={18} />
                                    <span>Sair</span>
                                </button>
                             ) : (
                                <button type="button" onClick={handleAbrirLogin} className="flex items-center gap-2 text-xs md:text-sm font-bold text-white px-3 py-1.5 md:px-4 md:py-2 rounded-full shadow-md hover:opacity-90 transition-all" style={{ backgroundColor: coresEstabelecimento.destaque }}>
                                    <IoPerson size={16} />
                                    <span>Entrar</span>
                                </button>
                             )}
                        </div>

                        <img src={estabelecimentoInfo.logoUrl} className="w-20 h-20 md:w-24 md:h-24 rounded-xl object-cover border-2 shadow-sm" style={{ borderColor: coresEstabelecimento.primaria }} alt="Logo" />
                        <div className="flex-1 w-full">
                            <h1 className="text-2xl md:text-3xl font-bold mb-2 leading-tight">{estabelecimentoInfo.nome}</h1>
                            <div className="text-sm text-gray-600 flex flex-col md:flex-row gap-2 justify-center md:justify-start items-center">
                                <p className="flex items-center gap-1"><IoLocationSharp className="text-red-500" /> <span className="truncate max-w-[200px]">{estabelecimentoInfo.endereco?.rua}</span></p>
                                <span className="hidden md:inline text-gray-300">|</span>
                                <p className="flex items-center gap-1"><IoTime className="text-blue-500" /> <span className="truncate max-w-[200px]">{formatarHorarios(estabelecimentoInfo.horarioFuncionamento)}</span></p>
                            </div>
                        </div>
                    </div>
                )}

                {/* FILTROS E BUSCA */}
                <div className="bg-white p-3 md:p-4 mb-6 sticky top-0 z-30 shadow-sm rounded-b-xl md:rounded-lg border-b border-gray-100">
                    {/* 🔥 STYLE: fontSize: 16px previne ZOOM no iPhone */}
                    <input 
                        type="text" 
                        placeholder="🔍 Buscar produto..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="w-full p-3 mb-3 border rounded-full bg-gray-50 text-gray-900 focus:bg-white focus:ring-2 outline-none transition-all" 
                        style={{ fontSize: '16px', focusRing: coresEstabelecimento.destaque }}
                    />
                    <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide mask-linear-fade">
                        {['Todos', ...categoriasOrdenadas].map(cat => (
                            <button 
                                key={cat} 
                                onClick={() => setSelectedCategory(cat)} 
                                className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all shadow-sm active:scale-95 ${selectedCategory === cat ? 'text-white' : 'bg-gray-100 text-gray-600 border border-transparent'}`} 
                                style={{ backgroundColor: selectedCategory === cat ? coresEstabelecimento.destaque : undefined }}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* LISTAGEM DE PRODUTOS */}
                {categoriasOrdenadas.map(cat => {
                    const items = menuAgrupado[cat];
                    const visible = visibleItemsCount[cat] || 4;
                    return (
                        <div key={cat} id={`categoria-${cat}`} className="mb-8">
                            <h2 className="text-xl md:text-2xl font-bold mb-4 px-1 border-l-4 pl-3" style={{ borderColor: coresEstabelecimento.destaque }}>{cat}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {items.slice(0, visible).map(item => (
                                    <CardapioItem 
                                        key={item.id} 
                                        item={item} 
                                        onAddItem={handleAbrirModalProduto} 
                                        onQuickAdd={handleAdicionarRapido} 
                                        coresEstabelecimento={coresEstabelecimento} 
                                    />
                                ))}
                            </div>
                            {items.length > 4 && (
                                <button onClick={() => visible >= items.length ? handleShowLess(cat) : handleShowMore(cat)} className="w-full mt-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 font-bold hover:bg-gray-100 transition-colors">
                                    {visible >= items.length ? 'Ver menos' : `Ver mais (${items.length - visible})`}
                                </button>
                            )}
                        </div>
                    );
                })}

                {/* DADOS E RESUMO */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mt-12 pb-10">
                    
                    {/* FORMULÁRIO DE DADOS */}
                    <div className="bg-white p-5 md:p-6 rounded-xl border shadow-lg text-left order-2 md:order-1">
                        <h3 className="text-xl font-bold mb-4 text-gray-900 flex items-center gap-2"><IoPerson/> Seus Dados</h3>
                        {currentUser ? 
                            <div className="mb-4 bg-green-50 text-green-700 px-3 py-2 rounded-lg text-sm border border-green-100">Logado como: <strong>{currentUser.email}</strong></div> : 
                            <button type="button" onClick={handleAbrirLogin} className="w-full bg-blue-50 text-blue-600 border border-blue-200 py-3 rounded-lg font-bold mb-4 hover:bg-blue-100 transition">🔑 Fazer Login para agilizar</button>
                        }
                        
                        <div className="space-y-3">
                            <input style={{ fontSize: '16px' }} className="w-full p-3 rounded-lg border bg-gray-50 text-gray-900 outline-none focus:ring-1 focus:bg-white transition" placeholder="Nome Completo *" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} />
                            <input style={{ fontSize: '16px' }} className="w-full p-3 rounded-lg border bg-gray-50 text-gray-900 outline-none focus:ring-1 focus:bg-white transition" placeholder="Telefone (WhatsApp) *" value={telefoneCliente} onChange={e => setTelefoneCliente(e.target.value)} type="tel" />
                            
                            {!isRetirada && (
                                <div className="space-y-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <p className="text-xs font-bold text-gray-500 uppercase">Endereço de Entrega</p>
                                    <div className="flex gap-2">
                                        <input style={{ fontSize: '16px' }} className="flex-1 p-3 rounded-lg border bg-white text-gray-900" placeholder="Rua *" value={rua} onChange={e => setRua(e.target.value)} />
                                        <input style={{ fontSize: '16px' }} className="w-24 p-3 rounded-lg border bg-white text-center text-gray-900" placeholder="Nº *" value={numero} onChange={e => setNumero(e.target.value)} />
                                    </div>
                                    <input style={{ fontSize: '16px' }} className="w-full p-3 rounded-lg border bg-white text-gray-900" placeholder="Bairro *" value={bairro} onChange={e => setBairro(e.target.value)} />
                                    <input style={{ fontSize: '16px' }} className="w-full p-3 rounded-lg border bg-white text-gray-900" placeholder="Cidade" value={cidade} onChange={e => setCidade(e.target.value)} />
                                </div>
                            )}
                            
                            <div className="flex gap-2 pt-2">
                                <button onClick={() => setIsRetirada(false)} className={`flex-1 p-3 rounded-xl font-bold border-2 transition-all ${!isRetirada ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-200 text-gray-400'}`}>🚚 Entrega</button>
                                <button onClick={() => setIsRetirada(true)} className={`flex-1 p-3 rounded-xl font-bold border-2 transition-all ${isRetirada ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-200 text-gray-400'}`}>🏪 Retirada</button>
                            </div>
                        </div>
                    </div>

                    {/* RESUMO DO PEDIDO */}
                    <div id="resumo-carrinho" className="bg-white p-5 md:p-6 rounded-xl border shadow-lg text-left text-gray-900 order-1 md:order-2 h-fit">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">🛒 Resumo do Pedido</h3>
                        {carrinho.length === 0 ? <div className="text-center py-10 bg-gray-50 rounded-lg text-gray-400">Seu carrinho está vazio.</div> : (
                            <>
                                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto scrollbar-thin pr-1">
                                    {carrinho.map(item => (
                                        <div key={item.cartItemId} className="flex justify-between items-start border-b border-dashed pb-3 last:border-0">
                                            <div className="flex-1 pr-2">
                                                <p className="font-bold text-sm text-gray-800">{formatarItemCarrinho(item)}</p>
                                                <p className="text-xs text-gray-500 mt-1">R$ {item.precoFinal.toFixed(2)} x {item.qtd}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-gray-900 text-sm">R$ {(item.precoFinal * item.qtd).toFixed(2)}</span>
                                                <button onClick={() => removerDoCarrinho(item.cartItemId)} className="w-6 h-6 flex items-center justify-center bg-red-100 text-red-500 rounded-full text-xs font-bold hover:bg-red-200">✕</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="border-t-2 border-dashed pt-4 space-y-2 text-sm">
                                    <div className="flex justify-between text-gray-600"><span>Subtotal:</span> <span>R$ {subtotalCalculado.toFixed(2)}</span></div>
                                    {!isRetirada && <div className="flex justify-between text-gray-600"><span>Taxa de Entrega:</span> <span>R$ {taxaAplicada.toFixed(2)}</span></div>}
                                    {discountAmount > 0 && <div className="flex justify-between text-green-600 font-bold bg-green-50 p-2 rounded"><span>Desconto:</span> <span>- R$ {discountAmount.toFixed(2)}</span></div>}
                                    {premioRaspadinha && <div className="flex justify-between text-purple-600 font-bold bg-purple-50 p-2 rounded"><span>🎁 Prêmio:</span> <span>{premioRaspadinha.label}</span></div>}
                                    
                                    <div className="flex gap-2 mt-4">
                                        <input style={{ fontSize: '16px' }} placeholder="Código do Cupom" value={couponCodeInput} onChange={e => setCouponCodeInput(e.target.value)} className="flex-1 p-2 border rounded-lg uppercase text-sm bg-gray-50" />
                                        <button onClick={handleApplyCoupon} disabled={couponLoading} className="px-4 bg-gray-800 text-white rounded-lg text-sm font-bold hover:bg-gray-900">{couponLoading ? '...' : 'Aplicar'}</button>
                                    </div>
                                    
                                    <div className="flex justify-between text-2xl font-bold pt-4 mt-2 border-t" style={{ color: coresEstabelecimento.destaque }}>
                                        <span>Total:</span> 
                                        <span>R$ {finalOrderTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                                <button onClick={prepararParaPagamento} className="w-full mt-6 py-4 rounded-xl font-bold text-lg text-white shadow-lg active:scale-95 transition-all bg-green-600 hover:bg-green-700 flex justify-center items-center gap-2">
                                    ✅ Finalizar Pedido
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ELEMENTOS FLUTUANTES (Z-INDEX ALTO) */}
            {!isWidgetOpen && (
                <CarrinhoFlutuante carrinho={carrinho} coresEstabelecimento={coresEstabelecimento} onClick={scrollToResumo} />
            )}

            {estabelecimentoInfo && (
                <AIChatAssistant 
                    estabelecimento={estabelecimentoInfo} 
                    produtos={allProdutos} 
                    onAddDirect={handleAdicionarPorIA} 
                    onCheckout={scrollToResumo} 
                    mode={showAICenter ? "center" : "widget"}
                    onClose={() => setShowAICenter(false)}
                    clienteNome={nomeCliente}
                    onRequestLogin={handleAbrirLogin}
                    carrinho={carrinho}
                    onClick={prepararParaPagamento}
                />
            )}

            <AIWidgetButton />

            {/* MODAIS (Sistema) */}
            {itemParaVariacoes && <VariacoesModal item={itemParaVariacoes} onConfirm={handleConfirmarVariacoes} onClose={() => setItemParaVariacoes(null)} coresEstabelecimento={coresEstabelecimento} />}
            {itemParaAdicionais && <AdicionaisModal item={itemParaAdicionais} onConfirm={handleConfirmarAdicionais} onClose={() => setItemParaAdicionais(null)} coresEstabelecimento={coresEstabelecimento} />}
            {showPaymentModal && pedidoParaPagamento && <PaymentModal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} amount={finalOrderTotal} orderId={`ord_${Date.now()}`} cartItems={carrinho} customer={pedidoParaPagamento.cliente} onSuccess={handlePagamentoSucesso} onError={handlePagamentoFalha} coresEstabelecimento={coresEstabelecimento} pixKey={estabelecimentoInfo?.chavePix} establishmentName={estabelecimentoInfo?.nome} />}
            {showOrderConfirmationModal && <div className="fixed inset-0 bg-black/80 z-[5000] flex items-center justify-center p-4 text-gray-900"><div className="bg-white p-8 rounded-2xl text-center shadow-2xl animate-bounce-in"><h2 className="text-3xl font-bold mb-4 text-green-600">🎉 Pedido Recebido!</h2><p className="mb-6 text-gray-600">Acompanhe pelo seu WhatsApp ou Painel.</p><button onClick={() => setShowOrderConfirmationModal(false)} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg">Fechar</button></div></div>}
            {showRaspadinha && <RaspadinhaModal onGanhar={handleGanharRaspadinha} onClose={() => setShowRaspadinha(false)} />}
            
            {/* 🔥 MODAL DE LOGIN (Responsivo com Scroll) */}
            {showLoginPrompt && (
                <div className="fixed inset-0 z-[5000] bg-black/80 flex items-center justify-center p-4 text-gray-900 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-md relative text-left shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto">
                        <button onClick={() => setShowLoginPrompt(false)} className="absolute top-4 right-4 text-2xl text-gray-400 hover:text-gray-800 transition-colors bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center">&times;</button>
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl"><IoPerson/></div>
                            <h2 className="text-2xl font-bold">{isRegisteringInModal ? 'Criar Conta' : 'Bem-vindo de volta!'}</h2>
                            <p className="text-sm text-gray-500">Faça login para continuar seu pedido.</p>
                        </div>
                        
                        <form onSubmit={isRegisteringInModal ? handleRegisterModal : handleLoginModal} className="space-y-4">
                            {isRegisteringInModal && (
                                <>
                                    <input style={{ fontSize: '16px' }} placeholder="Nome Completo" value={nomeAuthModal} onChange={e => setNomeAuthModal(e.target.value)} className="w-full p-3.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-200 outline-none transition" required />
                                    <input style={{ fontSize: '16px' }} placeholder="Telefone (WhatsApp)" value={telefoneAuthModal} onChange={e => setTelefoneAuthModal(e.target.value)} className="w-full p-3.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-200 outline-none transition" required type="tel" />
                                </>
                            )}
                            <input style={{ fontSize: '16px' }} type="email" placeholder="Seu E-mail" value={emailAuthModal} onChange={e => setEmailAuthModal(e.target.value)} className="w-full p-3.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-200 outline-none transition" required />
                            <input style={{ fontSize: '16px' }} type="password" placeholder="Sua Senha" value={passwordAuthModal} onChange={e => setPasswordAuthModal(e.target.value)} className="w-full p-3.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-200 outline-none transition" required />
                            
                            <button type="submit" className="w-full bg-green-600 text-white py-3.5 rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg active:scale-95">{isRegisteringInModal ? 'Criar Conta' : 'Entrar'}</button>
                        </form>
                        
                        <div className="mt-6 pt-6 border-t text-center">
                             <button type="button" onClick={() => setIsRegisteringInModal(!isRegisteringInModal)} className="text-green-600 text-sm font-bold hover:underline">
                                {isRegisteringInModal ? 'Já tem conta? Clique para entrar' : 'Não tem cadastro? Crie grátis agora'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Menu;