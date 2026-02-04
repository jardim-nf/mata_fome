import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, Timestamp, setDoc as setDocFirestore, doc, serverTimestamp, writeBatch, increment, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import CardapioItem from '../components/CardapioItem';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import VariacoesModal from '../components/VariacoesModal';
import { v4 as uuidv4 } from 'uuid';
import PaymentModal from '../components/PaymentModal';
import RaspadinhaModal from '../components/RaspadinhaModal';

import { useAI } from '../context/AIContext';
import AIChatAssistant from '../components/AIChatAssistant';
import AIWidgetButton from '../components/AIWidgetButton';

import { IoLocationSharp, IoTime, IoLogOutOutline, IoPerson, IoCart, IoChevronForward, IoAdd, IoRemove, IoTrash } from 'react-icons/io5';

function Menu() {
    const { estabelecimentoSlug } = useParams();
    const navigate = useNavigate();

    const { currentUser, currentClientData, loading: authLoading, isAdmin, isMasterAdmin, logout } = useAuth();
    const { isWidgetOpen, closeWidget, openWidget } = useAI();
    
    const [showAICenter, setShowAICenter] = useState(false);
    const [deveReabrirChat, setDeveReabrirChat] = useState(false);

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
    const [forceLogin, setForceLogin] = useState(false);
    const [isRegisteringInModal, setIsRegisteringInModal] = useState(false);

    const [emailAuthModal, setEmailAuthModal] = useState('');
    const [passwordAuthModal, setPasswordAuthModal] = useState('');
    
    const [nomeAuthModal, setNomeAuthModal] = useState('');
    const [telefoneAuthModal, setTelefoneAuthModal] = useState('');
    const [ruaAuthModal, setRuaAuthModal] = useState('');
    const [numeroAuthModal, setNumeroAuthModal] = useState('');
    const [bairroAuthModal, setBairroAuthModal] = useState('');
    const [cidadeAuthModal, setCidadeAuthModal] = useState('');
    
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

    const [itemParaVariacoes, setItemParaVariacoes] = useState(null);
    const [visibleItemsCount, setVisibleItemsCount] = useState({});

    const [triggerCheckout, setTriggerCheckout] = useState(false);

    const [loading, setLoading] = useState(true);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [pedidoParaPagamento, setPedidoParaPagamento] = useState(null);
    const [processandoPagamento, setProcessandoPagamento] = useState(false);

    const [coresEstabelecimento, setCoresEstabelecimento] = useState({
        primaria: '#EA1D2C', 
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

    // --- FORÇAR LOGIN ---
    useEffect(() => {
        if (!authLoading) {
            if (!currentUser) {
                setForceLogin(true);
                setShowLoginPrompt(true);
            } else {
                setForceLogin(false);
                setShowLoginPrompt(false);
            }
        }
    }, [authLoading, currentUser]);

    // --- AUTO-CHECKOUT ---
    useEffect(() => {
        if (triggerCheckout && carrinho.length > 0) {
            setTriggerCheckout(false);
            setTimeout(() => {
                scrollToResumo();
                toast.info("👇 Confira seu pedido e finalize aqui!", { autoClose: 4000 });
            }, 200);
        }
    }, [carrinho, triggerCheckout]);

    // --- FUNÇÕES AUXILIARES ---

    const scrollToResumo = useCallback(() => {
        const elementoResumo = document.getElementById('resumo-carrinho');
        if (elementoResumo) {
            elementoResumo.scrollIntoView({ behavior: 'smooth', block: 'start' });
            elementoResumo.classList.add('ring-4', 'ring-green-400');
            setTimeout(() => elementoResumo.classList.remove('ring-4', 'ring-green-400'), 1000);
        }
    }, []);

    const handleCategoryClick = (cat) => {
        setSelectedCategory(cat); 
        if (cat === 'Todos') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            const element = document.getElementById(`categoria-${cat}`);
            if (element) {
                const headerOffset = 180; 
                const elementPosition = element.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                window.scrollTo({ top: offsetPosition, behavior: "smooth" });
            }
        }
    };

    const handleAbrirLogin = () => { setIsRegisteringInModal(false); setShowLoginPrompt(true); };
    const handleLoginDoChat = () => { setShowAICenter(false); setDeveReabrirChat(true); handleAbrirLogin(); };
    const verificarReaberturaChat = () => { if (deveReabrirChat) { setShowAICenter(true); setDeveReabrirChat(false); } };

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
        if (item.adicionaisSelecionados && item.adicionaisSelecionados.length > 0) {
            const nomesAdicionais = item.adicionaisSelecionados.map(a => a.nome).join(', ');
            nome += ` (+ ${nomesAdicionais})`;
        }
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

    // --- CÁLCULOS ---

    const subtotalCalculado = useMemo(() => {
        return carrinho.reduce((acc, item) => {
            const precoBase = item.precoFinal || 0;
            return acc + (precoBase * item.qtd);
        }, 0);
    }, [carrinho]);

    const taxaAplicada = useMemo(() => {
        if (isRetirada) return 0;
        if (premioRaspadinha?.type === 'frete') return 0;
        return taxaEntregaCalculada;
    }, [isRetirada, taxaEntregaCalculada, premioRaspadinha]);

    const finalOrderTotal = useMemo(() => {
        let total = subtotalCalculado + taxaAplicada - discountAmount;
        return Math.max(0, total);
    }, [subtotalCalculado, taxaAplicada, discountAmount, premioRaspadinha]);

    const formatarMoeda = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    const carregarProdutosRapido = async (estabId) => {
        try {
            console.log("🔍 Buscando cardápio para ID:", estabId);
            const cardapioRef = collection(db, 'estabelecimentos', estabId, 'cardapio');
            const snapshot = await getDocs(cardapioRef);
            
            if (snapshot.empty) return [];

            const categoriasDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            const categoriasAtivas = categoriasDocs.filter(cat => cat.ativo !== false);

            const promessasCategorias = categoriasAtivas.map(async (cat) => {
                const itensRef = collection(db, 'estabelecimentos', estabId, 'cardapio', cat.id, 'itens');
                const produtosRef = collection(db, 'estabelecimentos', estabId, 'cardapio', cat.id, 'produtos');
                
                const [itensSnap, produtosSnap] = await Promise.all([
                    getDocs(query(itensRef, where('ativo', '==', true))),
                    getDocs(query(produtosRef, where('ativo', '==', true)))
                ]);

                const processarDocs = async (docsSnapshot) => {
                    return Promise.all(docsSnapshot.docs.map(async (docItem) => {
                        const dados = docItem.data();
                        const id = docItem.id;

                        let listaAdicionais = [];
                        try {
                            const addRef = collection(docItem.ref, 'adicionais');
                            const addSnap = await getDocs(addRef);
                            listaAdicionais = addSnap.docs.map(a => ({ id: a.id, ...a.data() }));
                        } catch (e) { /* Ignora */ }

                        let listaVariacoes = [];
                        try {
                            const varRef = collection(docItem.ref, 'variacoes');
                            const varSnap = await getDocs(varRef);
                            listaVariacoes = varSnap.docs.map(v => ({ id: v.id, ...v.data() }));
                        } catch (e) { /* Ignora */ }

                        const adicionaisFinais = (dados.adicionais && dados.adicionais.length > 0) ? dados.adicionais : listaAdicionais;
                        const variacoesFinais = (dados.variacoes && dados.variacoes.length > 0) ? dados.variacoes : listaVariacoes;

                        return {
                            ...dados,
                            id,
                            categoria: cat.nome || 'Geral',
                            categoriaId: cat.id,
                            adicionais: adicionaisFinais,
                            variacoes: variacoesFinais
                        };
                    }));
                };

                const itensProcessados = await processarDocs(itensSnap);
                const produtosProcessados = await processarDocs(produtosSnap);

                return [...itensProcessados, ...produtosProcessados];
            });

            const resultados = await Promise.all(promessasCategorias);
            return resultados.flat();

        } catch (error) {
            console.error("❌ Erro ao carregar produtos:", error);
            return [];
        }
    };

    // --- FUNÇÕES DE ADIÇÃO E MANIPULAÇÃO ---

    const enrichWithGlobalAdicionais = (item) => {
        const termosAdicionais = ['adicionais', 'adicional', 'extra', 'extras', 'complemento', 'complementos', 'acrescimo', 'acrescimos', 'molho', 'molhos', 'opcoes', 'opções'];
        const categoriaItemNorm = normalizarTexto(item.categoria || '');
        if (termosAdicionais.some(t => categoriaItemNorm.includes(t))) return item;

        const categoriasBloqueadas = [
            'bomboniere', 'bombonieres', 'doce', 'doces', 'chocolate', 'chocolates',
            'bebida', 'bebidas', 'refrigerante', 'refrigerantes', 'suco', 'sucos', 'agua', 'água',
            'cerveja', 'cervejas', 'drink', 'drinks', 'alcool', 'álcool',
            'sobremesa', 'sobremesas', 'sorvete', 'sorvetes', 'gelado',
            'mercearia', 'mercearias', 'tabacaria', 'cigarro'
        ];

        if (categoriasBloqueadas.some(bloq => categoriaItemNorm.includes(bloq))) {
            return item;
        }

        const globais = allProdutos.filter(p => {
            const cat = normalizarTexto(p.categoria || '');
            return termosAdicionais.some(termo => cat.includes(termo));
        });

        const idsExistentes = new Set((item.adicionais || []).map(a => a.id));
        const globaisFiltrados = globais.filter(g => !idsExistentes.has(g.id));

        return { ...item, adicionais: [...(item.adicionais || []), ...globaisFiltrados] };
    };

    const handleAdicionarRapido = (item) => {
        if (!currentUser) { handleAbrirLogin(); return; }
        
        const precoBase = item.precoFinal !== undefined ? item.precoFinal : item.preco;
        const preco = Number(precoBase) || 0;

        setCarrinho(prev => [...prev, { 
            ...item, 
            qtd: 1, 
            cartItemId: uuidv4(), 
            precoFinal: preco,
            observacao: '' 
        }]);
        toast.success(`✅ ${item.nome} adicionado!`);

        if (item.isBuyNow) setTriggerCheckout(true);
    };

    const handleComprarAgora = (item) => {
        if (!currentUser) { toast.info('Faça login para continuar.'); handleAbrirLogin(); return; }

        const itemLimpo = { ...item, observacao: '', isBuyNow: true };
        const itemComAdicionais = enrichWithGlobalAdicionais(itemLimpo);

        const temVariacao = itemComAdicionais.variacoes && itemComAdicionais.variacoes.length > 0;
        const temAdicional = itemComAdicionais.adicionais && itemComAdicionais.adicionais.length > 0;

        if (temVariacao || temAdicional) { setItemParaVariacoes(itemComAdicionais); } 
        else { handleAdicionarRapido(itemComAdicionais); }
    };

    const handleAbrirModalProduto = (item) => {
        if (!currentUser) { toast.info('Faça login para continuar.'); handleAbrirLogin(); return; }
        
        const itemLimpo = { ...item, observacao: '' };
        const itemComAdicionais = enrichWithGlobalAdicionais(itemLimpo);

        const temVariacao = itemComAdicionais.variacoes && itemComAdicionais.variacoes.length > 0;
        const temAdicional = itemComAdicionais.adicionais && itemComAdicionais.adicionais.length > 0;

        if (temVariacao || temAdicional) { setItemParaVariacoes(itemComAdicionais); } 
        else { handleAdicionarRapido(itemComAdicionais); }
    };

    const handleConfirmarVariacoes = (itemConfigurado) => {
        const preco = Number(itemConfigurado.precoFinal || 0);
        setCarrinho(prev => [...prev, { 
            ...itemConfigurado, 
            qtd: 1, 
            cartItemId: uuidv4(), 
            precoFinal: preco 
        }]);
        setItemParaVariacoes(null);
        toast.success(`✅ ${itemConfigurado.nome} adicionado!`);

        if (itemConfigurado.isBuyNow) setTriggerCheckout(true);
    };

    const alterarQuantidade = (cartItemId, delta) => {
        setCarrinho(prev => prev.map(item => {
            if (item.cartItemId === cartItemId) {
                const novaQtd = Math.max(1, item.qtd + delta);
                return { ...item, qtd: novaQtd };
            }
            return item;
        }));
    };

    const removerDoCarrinho = (cartItemId) => {
        setCarrinho(prev => prev.filter(item => item.cartItemId !== cartItemId));
    };

    const handleAdicionarPorIA = useCallback((dadosDoChat) => { return 'ADDED'; }, [allProdutos, currentUser]);
    const handleLogout = async () => { try { await logout(); setCarrinho([]); window.location.reload(); } catch (e) { console.error(e); } };
    const handleApplyCoupon = async () => { /* ... */ };

    // 🔥 PREPARAR PAGAMENTO COM VALIDAÇÃO FORTE 🔥
    const prepararParaPagamento = () => {
        if (!currentUser) return handleAbrirLogin();
        if (carrinho.length === 0) return toast.warn('Carrinho vazio.');
        
        // Validação de Dados
        if (!nomeCliente.trim()) {
            toast.error("Por favor, preencha seu NOME.");
            document.getElementById('input-nome')?.focus();
            return;
        }
        if (!telefoneCliente.trim()) {
            toast.error("Por favor, preencha seu TELEFONE.");
            document.getElementById('input-telefone')?.focus();
            return;
        }
        if (!isRetirada) {
            if (!rua.trim() || !numero.trim() || !bairro.trim()) {
                toast.error("Preencha o ENDEREÇO completo para entrega.");
                document.getElementById('input-rua')?.focus();
                return;
            }
        }

        const itensFormatados = carrinho.map(item => ({
            nome: formatarItemCarrinho(item),
            quantidade: item.qtd,
            preco: Number(item.precoFinal),
            adicionais: item.adicionaisSelecionados || [],
            variacao: item.variacaoSelecionada || null,
            produtoIdOriginal: item.id,
            categoriaId: item.categoriaId
        }));

        const pedidoRaw = {
            cliente: { nome: nomeCliente, telefone: telefoneCliente, endereco: isRetirada ? null : { rua, numero, bairro, cidade, complemento }, userId: currentUser.uid },
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

    const baixarEstoque = async (itensVendidos) => { /* ... */ };
    
    // Função chamada ao finalizar o pagamento no Modal
    const handlePagamentoSucesso = async (result) => {
        setProcessandoPagamento(true);
        try {
            const pedidoFinal = cleanData({ ...pedidoParaPagamento, status: 'recebido', transactionId: result.transactionId });
            const docRef = await addDoc(collection(db, 'pedidos'), pedidoFinal);
            
            try {
                await baixarEstoque(pedidoParaPagamento.itens);
            } catch (errEstoque) {
                console.warn("Erro estoque:", errEstoque);
            }

            setConfirmedOrderDetails({ id: docRef.id });
            setShowOrderConfirmationModal(true);
            setCarrinho([]);
            setShowPaymentModal(false);
        } catch (e) { console.error("Erro:", e); toast.error("Erro ao salvar pedido."); } 
        finally { setProcessandoPagamento(false); }
    };

    const handlePagamentoFalha = (error) => toast.error(`Falha: ${error.message}`);
    const handleGanharRaspadinha = (premio) => { /* ... */ };
    const handleLoginModal = async (e) => { /* ... */ };
    const handleRegisterModal = async (e) => { /* ... */ };

    // --- EFFECTS ---
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
                
                if (data.cores) {
                    let coresVindas = data.cores;
                    if (coresVindas.primaria && coresVindas.primaria.toLowerCase() === '#ffffff') {
                        coresVindas.primaria = '#EA1D2C'; 
                        coresVindas.texto = { ...coresVindas.texto, principal: '#111827' };
                    }
                    setCoresEstabelecimento(coresVindas);
                }
                
                if (data.ordemCategorias) setOrdemCategorias(data.ordemCategorias);
                setAllProdutos(prods);
            } catch (err) { console.error(err); } finally { setLoading(false); }
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
                const taxasSnap = await getDocs(collection(db, 'estabelecimentos', actualEstabelecimentoId, 'taxasDeEntrega'));
                let taxa = 0;
                taxasSnap.forEach(doc => {
                    const data = doc.data();
                    if (normalizarTexto(data.nomeBairro || '').includes(bairroNorm)) taxa = Number(data.valorTaxa);
                });
                setTaxaEntregaCalculada(taxa);
            } catch (e) { setTaxaEntregaCalculada(0); }
        };
        const timer = setTimeout(calcularTaxa, 800);
        return () => clearTimeout(timer);
    }, [bairro, actualEstabelecimentoId, isRetirada]);

    useEffect(() => {
        let p = [...allProdutos];
        if (searchTerm) p = p.filter(prod => prod.nome.toLowerCase().includes(searchTerm.toLowerCase()));
        setProdutosFiltrados(p);
    }, [allProdutos, searchTerm]);

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
                {/* CABEÇALHO */}
                {estabelecimentoInfo && (
                    <div className="rounded-xl p-6 mb-6 mt-6 border flex gap-6 items-center shadow-lg relative" style={{ backgroundColor: coresEstabelecimento.primaria }}>
                        <div className="absolute top-4 right-4 z-10">
                             {currentUser && (
                                <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-red-500 bg-white px-3 py-1 rounded-full border border-red-100 hover:bg-gray-100 transition-colors"><IoLogOutOutline size={18} /><span>Sair</span></button>
                             )}
                        </div>
                        <img src={estabelecimentoInfo.logoUrl} className="w-24 h-24 rounded-xl object-cover border-4 border-white bg-white" alt="Logo" />
                        <div className="flex-1 text-white">
                            <h1 className="text-3xl font-bold mb-2">{estabelecimentoInfo.nome}</h1>
                            <div className="text-sm text-white/90 font-medium">
                                <p className="flex items-center gap-2"><IoLocationSharp className="text-white" /> {estabelecimentoInfo.endereco?.rua}</p>
                                <p className="flex items-center gap-2"><IoTime className="text-white" /> {formatarHorarios(estabelecimentoInfo.horarioFuncionamento)}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* FILTROS */}
                <div className="bg-white p-4 mb-8 sticky top-0 z-40 shadow-sm md:rounded-lg">
                    <input type="text" placeholder="🔍 Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-3 mb-4 border rounded-lg text-gray-900 text-base" />
                    <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
                        {['Todos', ...categoriasOrdenadas].map(cat => (
                            <button key={cat} onClick={() => handleCategoryClick(cat)} className={`px-4 py-2 rounded-full font-bold whitespace-nowrap transition-all ${selectedCategory === cat ? 'text-white' : 'bg-gray-100 text-gray-600'}`} style={{ backgroundColor: selectedCategory === cat ? coresEstabelecimento.destaque : undefined }}>{cat}</button>
                        ))}
                    </div>
                </div>

                {/* PRODUTOS */}
                {categoriasOrdenadas.map(cat => {
                    const items = menuAgrupado[cat];
                    const visible = visibleItemsCount[cat] || 4;
                    return (
                        <div key={cat} id={`categoria-${cat}`} className="mb-8">
                            <h2 className="text-2xl font-bold mb-4">{cat}</h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                {items.slice(0, visible).map(item => (
                                    <div key={item.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 p-2">
                                        <CardapioItem 
                                            item={item} 
                                            onAddItem={() => handleAbrirModalProduto(item)} 
                                            onPurchase={() => handleComprarAgora(item)} 
                                            coresEstabelecimento={coresEstabelecimento} 
                                        />
                                    </div>
                                ))}
                            </div>
                            {items.length > 4 && <button onClick={() => visible >= items.length ? handleShowLess(cat) : handleShowMore(cat)} className="w-full mt-4 py-2 bg-gray-100 rounded-lg text-gray-500 font-bold">{visible >= items.length ? 'Ver menos' : 'Ver mais'}</button>}
                        </div>
                    );
                })}

                {/* RESUMO E DADOS */}
                <div className="flex flex-col lg:grid lg:grid-cols-2 gap-8 mt-12 pb-24">
                    <div className="bg-white p-6 rounded-xl border shadow-lg text-left w-full">
                         <h3 className="text-xl font-bold mb-4 text-gray-900">👤 Seus Dados</h3>
                         <div className="space-y-4">
                            <input id="input-nome" className="w-full p-3 rounded border text-gray-900 text-base" placeholder="Nome *" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} />
                            <input id="input-telefone" className="w-full p-3 rounded border text-gray-900 text-base" placeholder="Telefone *" value={telefoneCliente} onChange={e => setTelefoneCliente(e.target.value)} />
                            {!isRetirada && (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-[1fr_90px] gap-3">
                                        <input id="input-rua" className="w-full p-3 rounded border text-gray-900 text-base" placeholder="Rua *" value={rua} onChange={e => setRua(e.target.value)} />
                                        <input className="w-full p-3 rounded border text-center text-gray-900 text-base" placeholder="Nº *" value={numero} onChange={e => setNumero(e.target.value)} />
                                    </div>
                                    <input className="w-full p-3 rounded border text-gray-900 text-base" placeholder="Bairro *" value={bairro} onChange={e => setBairro(e.target.value)} />
                                </div>
                            )}
                            <div className="flex gap-2">
                                <button onClick={() => setIsRetirada(false)} className={`flex-1 p-3 rounded font-bold ${!isRetirada ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}>🚚 Entrega</button>
                                <button onClick={() => setIsRetirada(true)} className={`flex-1 p-3 rounded font-bold ${isRetirada ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}>🏪 Retirada</button>
                            </div>
                        </div>
                    </div>

                    <div id="resumo-carrinho" className="bg-white p-6 rounded-xl border shadow-lg text-left text-gray-900 w-full transition-all duration-300">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <IoCart className="text-green-600"/> Resumo do Pedido
                        </h3>
                        {carrinho.length === 0 ? <p className="text-gray-500 py-4 text-center">Seu carrinho está vazio.</p> : (
                            <>
                                <div className="space-y-4 mb-4 max-h-60 overflow-y-auto">
                                    {carrinho.map(item => (
                                        <div key={item.cartItemId} className="flex justify-between items-start border-b pb-3">
                                            <div className="flex-1">
                                                <p className="font-bold text-sm text-gray-900">{formatarItemCarrinho(item)}</p>
                                                <p className="text-xs text-gray-500">R$ {item.precoFinal.toFixed(2)} cada</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center border border-gray-200 rounded-lg">
                                                    <button onClick={() => alterarQuantidade(item.cartItemId, -1)} className="px-2 py-1 text-red-500 hover:bg-gray-100 rounded-l-lg"><IoRemove /></button>
                                                    <span className="px-2 text-sm font-bold">{item.qtd}</span>
                                                    <button onClick={() => alterarQuantidade(item.cartItemId, 1)} className="px-2 py-1 text-green-600 hover:bg-gray-100 rounded-r-lg"><IoAdd /></button>
                                                </div>
                                                <button onClick={() => removerDoCarrinho(item.cartItemId)} className="text-red-500 p-1 hover:bg-red-50 rounded"><IoTrash /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t pt-4 space-y-2 text-sm">
                                    <div className="flex justify-between"><span>Subtotal:</span> <span>R$ {subtotalCalculado.toFixed(2)}</span></div>
                                    {!isRetirada && <div className="flex justify-between"><span>Taxa de Entrega:</span> <span>R$ {taxaAplicada.toFixed(2)}</span></div>}
                                    <div className="flex justify-between text-xl font-bold pt-4 border-t" style={{ color: coresEstabelecimento.destaque }}><span>Total:</span> <span>R$ {finalOrderTotal.toFixed(2)}</span></div>
                                </div>
                                <button onClick={prepararParaPagamento} className="w-full mt-6 py-4 rounded-xl font-bold text-lg text-white shadow-lg active:scale-95 transition-all bg-green-600 hover:bg-green-700 animate-pulse-subtle">
                                    ✅ Finalizar Pedido
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* BARRA FIXA */}
            {carrinho.length > 0 && !isWidgetOpen && (
                <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.15)] z-[49] flex items-center justify-between animate-slide-up"
                     style={{ backgroundColor: '#ffffff' }}>
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 font-bold uppercase">Total a Pagar</span>
                        <span className="text-2xl font-black text-gray-900">{formatarMoeda(finalOrderTotal)}</span>
                        <span className="text-xs text-green-600 font-medium">{carrinho.length} itens</span>
                    </div>
                    <button 
                        onClick={scrollToResumo}
                        className="px-6 py-3 rounded-xl font-bold text-white flex items-center gap-2 shadow-lg active:scale-95 transition-transform"
                        style={{ backgroundColor: coresEstabelecimento.primaria }}
                    >
                        <span>Ver Sacola</span>
                        <IoChevronForward size={20} />
                    </button>
                </div>
            )}

            {estabelecimentoInfo && (showAICenter || isWidgetOpen) && <AIChatAssistant estabelecimento={estabelecimentoInfo} produtos={allProdutos} carrinho={carrinho} clienteNome={nomeCliente} taxaEntrega={taxaEntregaCalculada} enderecoAtual={{ rua, numero, bairro, cidade }} isRetirada={isRetirada} onAddDirect={handleAdicionarPorIA} onCheckout={prepararParaPagamento} onClose={() => setShowAICenter(false)} onRequestLogin={handleLoginDoChat} onSetDeliveryMode={(modo) => setIsRetirada(modo === 'retirada')} onUpdateAddress={(dados) => { if (dados.rua) setRua(dados.rua); if (dados.numero) setNumero(dados.numero); if (dados.bairro) setBairro(dados.bairro); if (dados.cidade) setCidade(dados.cidade); if (dados.referencia) setComplemento(dados.referencia); }} />}
            <AIWidgetButton bottomOffset={carrinho.length > 0 ? '100px' : '24px'} />

            {itemParaVariacoes && <VariacoesModal item={itemParaVariacoes} onConfirm={handleConfirmarVariacoes} onClose={() => setItemParaVariacoes(null)} coresEstabelecimento={coresEstabelecimento} />}
            
            {showPaymentModal && pedidoParaPagamento && <PaymentModal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} amount={finalOrderTotal} orderId={`ord_${Date.now()}`} cartItems={carrinho} customer={pedidoParaPagamento.cliente} onSuccess={handlePagamentoSucesso} onError={handlePagamentoFalha} coresEstabelecimento={coresEstabelecimento} pixKey={estabelecimentoInfo?.chavePix} establishmentName={estabelecimentoInfo?.nome} />}
            {showOrderConfirmationModal && <div className="fixed inset-0 bg-black/80 z-[5000] flex items-center justify-center p-4 text-gray-900"><div className="bg-white p-8 rounded-2xl text-center shadow-2xl"><h2 className="text-3xl font-bold mb-4">🎉 Sucesso!</h2><button onClick={() => setShowOrderConfirmationModal(false)} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold">Fechar</button></div></div>}
            {showRaspadinha && <RaspadinhaModal onGanhar={handleGanharRaspadinha} onClose={() => setShowRaspadinha(false)} config={estabelecimentoInfo?.raspadinhaConfig} />}
            {showLoginPrompt && (
                <div className="fixed inset-0 z-[5000] bg-black/80 flex items-center justify-center p-4 text-gray-900">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-md relative text-left shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto">
                        {!forceLogin && (
                            <button onClick={() => setShowLoginPrompt(false)} className="absolute top-4 right-4 text-2xl text-gray-500 hover:text-gray-800">&times;</button>
                        )}
                        <h2 className="text-2xl font-bold mb-6 text-center">{isRegisteringInModal ? 'Criar Conta' : 'Login'}</h2>
                        <form onSubmit={isRegisteringInModal ? handleRegisterModal : handleLoginModal} className="space-y-4">
                            {isRegisteringInModal && (
                                <>
                                    <input placeholder="Nome Completo" value={nomeAuthModal} onChange={e => setNomeAuthModal(e.target.value)} className="w-full p-3 rounded border border-gray-300 text-base" required />
                                    <input placeholder="Telefone (WhatsApp)" value={telefoneAuthModal} onChange={e => setTelefoneAuthModal(e.target.value)} className="w-full p-3 rounded border border-gray-300 text-base" required />
                                    <div className="grid grid-cols-[1fr_90px] gap-2">
                                        <input placeholder="Rua" value={ruaAuthModal} onChange={e => setRuaAuthModal(e.target.value)} className="w-full p-3 rounded border border-gray-300 text-base" required />
                                        <input placeholder="Nº" value={numeroAuthModal} onChange={e => setNumeroAuthModal(e.target.value)} className="w-full p-3 rounded border border-gray-300 text-base text-center" required />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input placeholder="Bairro" value={bairroAuthModal} onChange={e => setBairroAuthModal(e.target.value)} className="w-full p-3 rounded border border-gray-300 text-base" required />
                                        <input placeholder="Cidade" value={cidadeAuthModal} onChange={e => setCidadeAuthModal(e.target.value)} className="w-full p-3 rounded border border-gray-300 text-base" required />
                                    </div>
                                </>
                            )}
                            <input type="email" placeholder="Email" value={emailAuthModal} onChange={e => setEmailAuthModal(e.target.value)} className="w-full p-3 rounded border border-gray-300 text-base" required />
                            <input type="password" placeholder="Senha" value={passwordAuthModal} onChange={e => setPasswordAuthModal(e.target.value)} className="w-full p-3 rounded border border-gray-300 text-base" required />
                            <button type="submit" className="w-full bg-green-600 text-white py-3 rounded font-bold hover:bg-green-700 transition-colors">{isRegisteringInModal ? 'Cadastrar' : 'Entrar'}</button>
                        </form>
                        <button type="button" onClick={() => setIsRegisteringInModal(!isRegisteringInModal)} className="w-full mt-4 text-green-600 text-sm hover:underline text-center block font-medium">{isRegisteringInModal ? 'Já tenho conta? Entrar' : 'Não tem conta? Criar agora'}</button>
                    </div>
                </div>
            )}
            
            <style>{`
                @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
                .animate-slide-up { animation: slide-up 0.3s ease-out; }
            `}</style>
        </div>
    );
}

export default Menu;