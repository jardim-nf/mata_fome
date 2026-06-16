import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';

import { useAuth } from '../context/AuthContext';
import { useAI } from '../context/AIContext';
import { useCart } from '../hooks/useCart';
import { useEstablishment } from '../hooks/useEstablishment';

import { useMenuTime } from '../hooks/useMenuTime';
import { useMenuAuth } from '../hooks/useMenuAuth';
import { useMenuCheckout } from '../hooks/useMenuCheckout';

import CardapioItem from '../components/CardapioItem';
import EstablishmentHeader from '../components/menu/EstablishmentHeader';
import CategoryFilter from '../components/menu/CategoryFilter';
import CustomerForm from '../components/menu/CustomerForm';
import CartSection from '../components/menu/CartSection';
import CartBar from '../components/menu/CartBar';
import AuthModal from '../components/menu/AuthModal';
import MenuSkeleton from '../components/menu/MenuSkeleton';
import WaiterCallWidget from '../components/menu/WaiterCallWidget';
import CartelaFidelidade from '../components/menu/CartelaFidelidade';
import { getTerminology } from '../utils/terminologyUtils';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const VariacoesModal = lazy(() => import('../components/VariacoesModal'));
const PaymentModal = lazy(() => import('../components/PaymentModal'));
const RaspadinhaModal = lazy(() => import('../components/RaspadinhaModal'));
const AIChatAssistant = lazy(() => import('../components/ai/AIChatAssistant'));
const AIWidgetButton = lazy(() => import('../components/AIWidgetButton'));
const ReviewModal = lazy(() => import('../components/ReviewModal'));

function normalizarTexto(texto) {
    if (!texto) return '';
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function LoadMoreSentinel({ category, onLoadMore }) {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) onLoadMore(category); }, { rootMargin: '200px' });
        observer.observe(el);
        return () => observer.disconnect();
    }, [category, onLoadMore]);
    return <div ref={ref} className="h-1" />;
}

function CheckoutStepper({ currentStep, coresEstabelecimento }) {
    const steps = [
        { number: 1, label: 'Itens na Sacola', desc: 'Carrinho' },
        { number: 2, label: 'Identificação e Entrega', desc: 'Dados' },
        { number: 3, label: 'Pagamento e Finalização', desc: 'Confirmação' }
    ];

    const corPrimaria = coresEstabelecimento?.primaria || '#059669';

    return (
        <div className="w-full max-w-4xl mx-auto mb-8 mt-12 bg-white rounded-2xl p-6 shadow-md border border-gray-100 animate-fade-in text-gray-800">
            <div className="flex items-center justify-between relative">
                {/* Linha de progresso cinza de fundo */}
                <div className="absolute top-5 left-[10%] right-[10%] h-[3px] bg-gray-100 -translate-y-1/2 z-0 rounded-full" />
                
                {/* Linha de progresso ativa colorida */}
                <div 
                    className="absolute top-5 left-[10%] h-[3px] -translate-y-1/2 z-0 rounded-full transition-all duration-500 ease-in-out" 
                    style={{ 
                        backgroundColor: corPrimaria, 
                        width: currentStep === 2 ? '40%' : currentStep === 3 ? '80%' : '0%' 
                    }}
                />

                {steps.map((step) => {
                    const isActive = step.number === currentStep;
                    const isCompleted = step.number < currentStep;
                    
                    return (
                        <div key={step.number} className="relative z-10 flex flex-col items-center flex-1">
                            <div 
                                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-all duration-300 border-2 ${
                                    isCompleted 
                                        ? 'text-white' 
                                        : isActive 
                                            ? 'bg-white scale-110' 
                                            : 'bg-white text-gray-400 border-gray-200'
                                }`}
                                style={
                                    isCompleted 
                                        ? { backgroundColor: corPrimaria, borderColor: corPrimaria } 
                                        : isActive 
                                            ? { borderColor: corPrimaria, color: corPrimaria } 
                                            : {}
                                }
                            >
                                {isCompleted ? '✓' : step.number}
                            </div>
                            <span 
                                className={`text-xs md:text-sm font-bold mt-2 text-center transition-all ${
                                    isActive ? 'text-gray-900 font-extrabold' : 'text-gray-500'
                                }`}
                            >
                                {step.label}
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium hidden md:block">
                                {step.desc}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function Menu() {
    const { estabelecimentoSlug } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const lastOpenedProdutoId = useRef(null);
    const { currentUser, currentClientData, loading: authLoading, isAdmin, isMasterAdmin, logout, modoManutencao } = useAuth();
    const { isWidgetOpen } = useAI();

    const { loading, allProdutos, estabelecimentoInfo, actualEstabelecimentoId, ordemCategorias, bairrosDisponiveis, coresEstabelecimento } = useEstablishment(estabelecimentoSlug);
    const { carrinho, subtotalCalculado, adicionarItem, alterarQuantidade, removerItem, limparCarrinho, adicionarBrinde, carrinhoRecuperado, descartarRecuperacao } = useCart();
    
    // Custom Hooks
    const { currentTime, isLojaAberta } = useMenuTime(estabelecimentoInfo);
    const authActions = useMenuAuth(authLoading, currentUser, logout, limparCarrinho);

    const [availableCoupons, setAvailableCoupons] = useState([]);

    useEffect(() => {
        const fetchCoupons = async () => {
            if (!actualEstabelecimentoId) return;
            try {
                const q = query(
                    collection(db, 'estabelecimentos', actualEstabelecimentoId, 'cupons'),
                    where('ativo', '==', true)
                );
                const snap = await getDocs(q);
                const now = new Date();
                const active = [];
                snap.forEach(docSnap => {
                    const data = docSnap.data();
                    const vFim = data.validadeFim?.toDate();
                    const vIni = data.validadeInicio?.toDate();
                    
                    const isExpirado = vFim && vFim < now;
                    const isFuturo = vIni && vIni > now;
                    const esgotado = data.usosMaximos && (data.usosAtuais || 0) >= data.usosMaximos;

                    if (!isExpirado && !isFuturo && !esgotado) {
                        active.push({ id: docSnap.id, ...data });
                    }
                });
                setAvailableCoupons(active);
            } catch (e) {
                console.error("Erro ao carregar cupons disponíveis:", e);
            }
        };
        fetchCoupons();
    }, [actualEstabelecimentoId]);

    // Endereço Cliente Local
    const [nomeCliente, setNomeCliente] = useState('');
    const [telefoneCliente, setTelefoneCliente] = useState('');
    const [rua, setRua] = useState('');
    const [numero, setNumero] = useState('');
    const [bairro, setBairro] = useState('');
    const [cidade, setCidade] = useState('');
    const [complemento, setComplemento] = useState('');
    const [pontoReferencia, setPontoReferencia] = useState('');
    const [isRetirada, setIsRetirada] = useState(false);

    useEffect(() => {
        if (!authLoading && currentUser && currentClientData) {
            setNomeCliente(currentClientData.nome || '');
            setTelefoneCliente(currentClientData.telefone || '');
            if (currentClientData.endereco) {
                setRua(currentClientData.endereco.rua || '');
                setNumero(currentClientData.endereco.numero || '');
                setBairro(currentClientData.endereco.bairro || '');
                setCidade(currentClientData.endereco.cidade || '');
                setPontoReferencia(currentClientData.endereco.referencia || '');
            }
        }
    }, [currentUser, currentClientData, authLoading]);

    const checkoutParams = {
        actualEstabelecimentoId, isRetirada, bairro, subtotalCalculado, carrinho,
        nomeCliente, telefoneCliente, rua, numero, cidade, complemento, pontoReferencia,
        currentUser, handleAbrirLogin: authActions.handleAbrirLogin, limparCarrinho
    };
    const checkoutActions = useMenuCheckout(checkoutParams);

    // Setup Local
    const [searchTerm, setSearchTerm] = useState(searchParams.get('busca') || '');
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [itemParaVariacoes, setItemParaVariacoes] = useState(null);
    const [triggerCheckout, setTriggerCheckout] = useState(false);
    const [valorGatilhoRaspadinha, setValorGatilhoRaspadinha] = useState(9999);

    const [visibleItemsCount, setVisibleItemsCount] = useState({});
    const handleLoadMore = useCallback((cat) => setVisibleItemsCount(prev => ({ ...prev, [cat]: (prev[cat] || 4) + 4 })), []);

    const scrollToResumo = useCallback(() => {
        const el = document.getElementById('resumo-carrinho');
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.classList.add('ring-4', 'ring-green-400'); setTimeout(() => el.classList.remove('ring-4', 'ring-green-400'), 1000); }
    }, []);

    const handleCategoryClick = (cat) => {
        setSelectedCategory(cat);
        if (cat === 'Todos') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
        const el = document.getElementById(`categoria-${cat}`);
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 180, behavior: 'smooth' });
    };

    // Pedir de Novo
    useEffect(() => {
        if (loading || allProdutos.length === 0) return;
        const repetir = localStorage.getItem('ideafood_repetir_pedido');
        if (!repetir) return;
        
        try {
            const itens = JSON.parse(repetir);
            let adicionados = 0;
            itens.forEach(item => {
                let pEncontrado = allProdutos.find(p => p.id === item.id);
                if (!pEncontrado) {
                    const nomeO = normalizarTexto(item.nomeOriginal || '');
                    const nomeA = normalizarTexto(item.nome || '');
                    pEncontrado = allProdutos.find(p => {
                        const pNome = normalizarTexto(p.nome || '');
                        return pNome === nomeO || pNome === nomeA || (nomeA.includes(pNome) && pNome.length > 3);
                    });
                }
                
                // FALLBACK SUPREMO: Produto "Fantasma". Se o dono deletou do sistema, a gente recria na memória!
                if (!pEncontrado) {
                    pEncontrado = {
                        id: item.id || `recuperado_${Math.random()}`,
                        nome: (item.variacaoSelecionada || item.adicionaisSelecionados?.length > 0) ? (item.nomeOriginal || item.nome) : item.nome,
                        preco: item.preco
                    };
                }
                
                if (pEncontrado) { 
                    const itemReconstruido = {
                       ...pEncontrado,
                       observacao: item.observacao,
                       variacaoSelecionada: item.variacaoSelecionada,
                       adicionaisSelecionados: item.adicionaisSelecionados,
                       precoFinal: item.preco // Respeitamos o preço exato que ele pagou ou calculou antes
                    };
                    for (let i = 0; i < (item.quantidade || 1); i++) { 
                       adicionarItem(itemReconstruido); 
                    } 
                    adicionados++; 
                }
            });
            
            if (adicionados > 0) {
               toast.success(`🔁 ${adicionados} itens recuperados para o carrinho!`);
               scrollToResumo();
            } else {
               toast.warn(`Não conseguimos localizar os itens originais no ${getTerminology('cardapio', estabelecimentoInfo?.tipoNegocio).toLowerCase()} atual.`);
            }
            
            // Remover depois de processar (seguro contra strict mode)
            localStorage.removeItem('ideafood_repetir_pedido');
        } catch (e) { 
            console.warn(e); 
            localStorage.removeItem('ideafood_repetir_pedido');
        }
    }, [loading, allProdutos, adicionarItem, scrollToResumo]);

    useEffect(() => {
        if (triggerCheckout && carrinho.length > 0) { setTriggerCheckout(false); setTimeout(() => { scrollToResumo(); toast.info('👇 Confira seu pedido e finalize aqui!'); }, 200); }
    }, [carrinho, triggerCheckout, scrollToResumo]);

    // 🚀 useMemo em vez de useEffect+setState — elimina 1 ciclo de render extra
    const produtosFiltrados = useMemo(() => {
        if (!searchTerm) return [...allProdutos];
        const term = searchTerm.toLowerCase();
        return allProdutos.filter(prod => {
            const matchNome = prod.nome?.toLowerCase().includes(term);
            const matchDesc = prod.descricao?.toLowerCase().includes(term);
            const matchVar = Array.isArray(prod.variacoes) && prod.variacoes.some(v => v.nome?.toLowerCase().includes(term));
            return matchNome || matchDesc || matchVar;
        });
    }, [allProdutos, searchTerm]);

    useEffect(() => { setValorGatilhoRaspadinha(estabelecimentoInfo?.valorMinimoRaspadinha ? parseFloat(estabelecimentoInfo.valorMinimoRaspadinha) : 100); }, [estabelecimentoInfo]);
    
    useEffect(() => {
        if (subtotalCalculado >= valorGatilhoRaspadinha && !checkoutActions.jaJogouRaspadinha && !checkoutActions.premioRaspadinha) {
            const timer = setTimeout(() => checkoutActions.setShowRaspadinha?.(true), 1000);
            return () => clearTimeout(timer);
        }
    }, [subtotalCalculado, checkoutActions.jaJogouRaspadinha, checkoutActions.premioRaspadinha, valorGatilhoRaspadinha, checkoutActions]);

    const handleGanharRaspadinha = (premio) => {
        checkoutActions.setShowRaspadinha?.(false);
        checkoutActions.setJaJogouRaspadinha?.(true);
        checkoutActions.setPremioRaspadinha?.(premio);
        if (premio.type === 'desconto') { checkoutActions.setDiscountAmount?.(subtotalCalculado * (premio.valor / 100)); toast.success(`🎉 Ganhou ${premio.valor}% de desconto!`); }
        else if (premio.type === 'frete') { checkoutActions.setTaxaEntregaCalculada?.(0); toast.success('🎉 Ganhou Frete Grátis!'); }
        else if (premio.type === 'brinde') { adicionarBrinde(premio.produto); toast.success(`🎉 Ganhou ${premio.produto.nome}!`); }
    };

    const menuAgrupado = useMemo(() => {
        const termosAdicionais = ['adicionais','adicional','extra','extras','complemento','complementos','acrescimo','acrescimos','molho','molhos','opcoes','opções'];
        return produtosFiltrados.reduce((acc, p) => {
            const cat = p.categoria || 'Outros';
            const catNorm = normalizarTexto(cat);
            const palavras = catNorm.split(/[^a-z0-9]+/);
            if (termosAdicionais.some(t => palavras.includes(t))) return acc;
            
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(p);
            return acc;
        }, {});
    }, [produtosFiltrados]);
    const categoriasOrdenadas = useMemo(() => Object.keys(menuAgrupado).sort((a, b) => (!ordemCategorias.length ? a.localeCompare(b) : ordemCategorias.indexOf(a) - ordemCategorias.indexOf(b))), [menuAgrupado, ordemCategorias]);

    const upsellItems = useMemo(() => {
        if (carrinho.length === 0 || allProdutos.length === 0) return [];
        const categoriasNoCarrinho = new Set(carrinho.map(c => (c.categoria || '').toLowerCase()));
        const idsNoCarrinho = new Set(carrinho.map(c => c.id));
        const sugestaoMap = {
            'lanches': ['bebidas', 'refrigerante', 'sucos', 'sobremesas', 'porcoes'],
            'hamburgueres': ['bebidas', 'refrigerante', 'acompanhamentos', 'porcoes'],
            'baguetes': ['bebidas', 'refrigerante', 'acompanhamentos', 'porcoes'],
            'pizzas': ['bebidas', 'refrigerante', 'sobremesas'],
            'hot dog': ['bebidas', 'refrigerante', 'porcoes'],
            'esfihas': ['bebidas', 'refrigerante', 'sobremesas'],
            'acai': ['complementos', 'adicionais'],
            'bebidas': ['lanches', 'hamburgueres', 'baguetes', 'pizzas', 'porcoes'],
            'porcoes': ['bebidas', 'refrigerante', 'sucos'],
        };
        const catsSugeridas = new Set();
        categoriasNoCarrinho.forEach(cat => {
            Object.entries(sugestaoMap).forEach(([key, vals]) => { if (cat.includes(key)) vals.forEach(v => catsSugeridas.add(v)); });
        });
        if (catsSugeridas.size === 0) { catsSugeridas.add('bebidas'); catsSugeridas.add('sobremesas'); }
        return allProdutos.filter(p => !idsNoCarrinho.has(p.id) && p.ativo !== false && [...catsSugeridas].some(s => (p.categoria || '').toLowerCase().includes(s))).slice(0, 5);
    }, [carrinho, allProdutos]);

    const enrichWithGlobalAdicionais = useCallback((item) => {
        const termosAdicionais = ['adicionais','adicional','extra','extras','complemento','complementos','acrescimo','acrescimos','molho','molhos','opcoes','opções'];
        const catNorm = normalizarTexto(item.categoria || '');
        const palavrasItem = catNorm.split(/[^a-z0-9]+/);
        if (termosAdicionais.some(t => palavrasItem.includes(t))) return item;

        const catsHamburguer = ['classico', 'classicos', 'novato', 'novatos', 'queridinho', 'queridinhos', 'grande', 'grandes', 'hamburguer', 'hamburgueres', 'burger', 'burgers', 'artesanal', 'artesanais', 'smash', 'gourmet'];
        if (!catsHamburguer.some(cat => catNorm.includes(cat) || normalizarTexto(item.categoriaId || '').includes(cat))) return item;

        const globais = allProdutos.filter(p => {
            const cat = normalizarTexto(p.categoria || '');
            const palavras = cat.split(/[^a-z0-9]+/);
            return termosAdicionais.some(t => palavras.includes(t));
        });
        const idsExistentes = new Set((item.adicionais || []).map(a => a.id));
        return { ...item, adicionais: [...(item.adicionais || []), ...globais.filter(g => !idsExistentes.has(g.id))] };
    }, [allProdutos]);

    const handleAdicionarItem = (itemConfigurado) => {
        const precoFinalCalculado = itemConfigurado.precoFinal !== undefined ? itemConfigurado.precoFinal : itemConfigurado.preco;
        adicionarItem({ ...itemConfigurado, precoFinal: Number(precoFinalCalculado || 0) }); 
        setItemParaVariacoes(null); 
        setSearchParams(params => { params.delete('produto'); return params; }, { replace: true });
        if (itemConfigurado.isBuyNow) setTriggerCheckout(true);
    };

    const handleClickItemModal = useCallback((item, isBuyNow = false) => {
        if (!isLojaAberta) return toast.error('A loja está fechada!');
        if (!currentUser) return authActions.handleAbrirLogin();
        const itemComAds = enrichWithGlobalAdicionais({ ...item, observacao: '', isBuyNow });
        if (itemComAds.variacoes?.length > 0 || itemComAds.adicionais?.length > 0) {
            setItemParaVariacoes(itemComAds);
            lastOpenedProdutoId.current = itemComAds.id;
            setSearchParams(params => { params.set('produto', itemComAds.id); return params; }, { replace: true });
        } else {
            handleAdicionarItem(itemComAds);
        }
    }, [isLojaAberta, currentUser, authActions, enrichWithGlobalAdicionais, setSearchParams]);

    const handleItemAdd = useCallback((item) => {
        handleClickItemModal(item, false);
    }, [handleClickItemModal]);

    const handleItemPurchase = useCallback((item) => {
        handleClickItemModal(item, true);
    }, [handleClickItemModal]);

    // Deep Linking: Abrir Produto Específico via URL (?produto=id)
    useEffect(() => {
        if (loading || authLoading || allProdutos.length === 0) return;
        
        const produtoId = searchParams.get('produto');
        
        // Limpa o ref quando a URL não tem mais o produto
        if (!produtoId) {
            lastOpenedProdutoId.current = null;
            return;
        }

        // Se já lidamos com esse ID recentemente, ignora
        if (produtoId && lastOpenedProdutoId.current !== produtoId) {
            lastOpenedProdutoId.current = produtoId; // Marca como lidado imediatamente
            const produtoEncontrado = allProdutos.find(p => p.id === produtoId);
            
            if (produtoEncontrado) {
                if (!isLojaAberta) {
                    toast.error('A loja está fechada! Não é possível pedir no momento.');
                    setSearchParams(params => { params.delete('produto'); return params; }, { replace: true });
                } else if (!currentUser) {
                    authActions.handleAbrirLogin();
                } else {
                    handleClickItemModal(produtoEncontrado);
                }
            } else {
                setSearchParams(params => { params.delete('produto'); return params; }, { replace: true });
            }
        }
    }, [loading, authLoading, allProdutos, searchParams, setSearchParams, handleClickItemModal, isLojaAberta, currentUser, authActions]);

    // Sincronização foi removida do useEffect para evitar race-condition (piscar o modal).
    // Agora fazemos a alteração da URL direto nos handlers (onClose, handleAdicionarItem, handleClickItemModal).

    if (loading || authLoading) return <MenuSkeleton />;

    const isAdminPreview = currentUser && (isAdmin || isMasterAdmin);
    const isSuspended = estabelecimentoInfo?.ativo === false && !isAdminPreview;
    const underMaintenance = modoManutencao && !isMasterAdmin;

    if (underMaintenance) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden text-slate-100 font-sans p-6 text-center">
                {/* Background glow effects */}
                <div className="absolute top-[20%] left-1/4 w-[300px] h-[300px] rounded-full bg-orange-500/10 blur-[80px]" />
                <div className="absolute bottom-[20%] right-1/4 w-[300px] h-[300px] rounded-full bg-yellow-500/10 blur-[80px]" />
                
                <div className="relative z-10 flex flex-col items-center gap-6 max-w-md">
                    <div className="relative w-24 h-24 rounded-3xl border border-white/5 bg-slate-900/40 backdrop-blur-xl shadow-2xl p-5 flex items-center justify-center animate-pulse">
                        <span className="text-5xl">🔧</span>
                    </div>
                    <div>
                        <h2 className="text-3xl font-black bg-gradient-to-r from-orange-400 to-yellow-500 bg-clip-text text-transparent mb-3 uppercase tracking-tight">
                            Sistema em Manutenção
                        </h2>
                        <p className="text-base text-slate-400 font-medium">
                            Estamos realizando melhorias em nossa rede para te atender melhor. O sistema estará de volta em instantes!
                        </p>
                    </div>
                    <div className="w-16 h-1 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full mt-2" />
                </div>
            </div>
        );
    }

    if (isSuspended) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden text-slate-100 font-sans p-6 text-center">
                {/* Background glow effects */}
                <div className="absolute top-[20%] left-1/4 w-[300px] h-[300px] rounded-full bg-red-500/10 blur-[80px]" />
                <div className="absolute bottom-[20%] right-1/4 w-[300px] h-[300px] rounded-full bg-rose-500/10 blur-[80px]" />
                
                <div className="relative z-10 flex flex-col items-center gap-6 max-w-md">
                    <div className="relative w-24 h-24 rounded-3xl border border-white/5 bg-slate-900/40 backdrop-blur-xl shadow-2xl p-5 flex items-center justify-center">
                        <span className="text-5xl">🚫</span>
                    </div>
                    <div>
                        <h2 className="text-3xl font-black bg-gradient-to-r from-red-400 to-rose-500 bg-clip-text text-transparent mb-3 uppercase tracking-tight">
                            Loja Indisponível
                        </h2>
                        <p className="text-base text-slate-400 font-medium">
                            Este estabelecimento está temporariamente suspenso. Se você é o proprietário, entre em contato com o suporte para regularizar a situação.
                        </p>
                    </div>
                    <div className="w-16 h-1 bg-gradient-to-r from-red-500 to-rose-500 rounded-full mt-2" />
                    <button 
                        onClick={() => navigate('/cardapio')} 
                        className="mt-6 px-8 py-3.5 bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-200 active:scale-95 text-slate-300"
                    >
                        Ver Outros Estabelecimentos
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full relative min-h-screen text-left" style={{ backgroundColor: coresEstabelecimento.background, color: coresEstabelecimento.texto.principal, paddingBottom: '150px' }}>
            <div className="max-w-7xl mx-auto px-4 w-full">
                {isAdminPreview && (
                    <div className="bg-amber-100 border border-amber-300 rounded-xl p-3 mb-4 flex items-center justify-between">
                        <p className="text-amber-800 text-sm font-bold">👁️ Modo Preview — Visualizando como cliente</p>
                        <button onClick={() => navigate('/painel')} className="bg-amber-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-600 transition-all">← Painel</button>
                    </div>
                )}
                
                <EstablishmentHeader 
                    estabelecimentoInfo={estabelecimentoInfo} 
                    coresEstabelecimento={coresEstabelecimento} 
                    isLojaAberta={isLojaAberta} 
                    currentTime={currentTime} 
                    currentUser={currentUser} 
                    onLogout={authActions.handleLogout} 
                    saldoCarteira={checkoutActions.saldoCarteira} 
                    fidelidadeConfig={checkoutActions.fidelidadeConfig}
                    fidelidadeCliente={checkoutActions.fidelidadeCliente}
                    onResgatarFidelidade={checkoutActions.fidelidadeCliente?.premioDisponivel ? () => {
                        toast.success(`🎁 Prêmio "${checkoutActions.fidelidadeConfig.premio}" será aplicado neste pedido! Mencione no campo de observação.`);
                    } : null}
                    onViewHistory={() => navigate(actualEstabelecimentoId ? `/historico-pedidos?lojaId=${actualEstabelecimentoId}` : '/historico-pedidos')} 
                />

                {/* 🎟️ CUPONS DISPONÍVEIS BANNER */}
                {availableCoupons.length > 0 && (
                    <div className="mb-6 bg-gradient-to-r from-amber-50 to-amber-100 rounded-2xl p-3.5 border border-amber-200">
                        <p className="text-xs font-black text-amber-800 uppercase tracking-widest mb-2 flex items-center gap-1.5">🎟️ Cupons Promocionais Disponíveis</p>
                        <div className="flex gap-3 overflow-x-auto pb-1.5 snap-x hide-scrollbar animate-fade-in" style={{ scrollbarWidth: 'none' }}>
                            {availableCoupons.map((cupom) => {
                                const isFreteGratis = cupom.tipoDesconto === 'freteGratis' || cupom.tipo === 'freteGratis';
                                const descDesconto = isFreteGratis
                                    ? 'Frete Grátis'
                                    : (cupom.tipoDesconto === 'percentual' || cupom.tipo === 'percentual' || cupom.tipo === 'porcentagem')
                                        ? `${cupom.valorDesconto || cupom.valor}% OFF`
                                        : `R$ ${parseFloat(cupom.valorDesconto || cupom.valor || 0).toFixed(2)} OFF`;
                                const minimo = cupom.minimoPedido ? ` (pedido mín. R$ ${cupom.minimoPedido})` : '';
                                
                                return (
                                    <div 
                                        key={cupom.id}
                                        className="min-w-[210px] max-w-[210px] bg-white border border-amber-200 rounded-xl p-3 flex flex-col justify-between shrink-0 snap-center relative shadow-sm"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center justify-between gap-1 mb-1">
                                                <span className="text-xs font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-200 truncate uppercase">{cupom.codigo}</span>
                                                <span className="text-[10px] font-black text-emerald-600 shrink-0">{descDesconto}</span>
                                            </div>
                                            <p className="text-[10px] text-gray-500 font-semibold truncate leading-tight mt-1">
                                                {isFreteGratis ? 'Aproveite entrega sem taxa!' : `Desconto no seu pedido`}{minimo}
                                            </p>
                                        </div>
                                        
                                        <button 
                                            onClick={async () => {
                                                await checkoutActions.handleApplyCoupon(cupom.codigo);
                                                scrollToResumo();
                                            }}
                                            className="mt-3.5 w-full bg-amber-500 hover:bg-amber-600 text-amber-955 font-black text-[11px] py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer shadow-sm shadow-amber-500/10"
                                        >
                                            Aplicar Cupom
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                        <style dangerouslySetInnerHTML={{__html: `
                            .hide-scrollbar::-webkit-scrollbar { display: none; }
                        `}} />
                    </div>
                )}

                <CategoryFilter searchTerm={searchTerm} onSearchChange={setSearchTerm} categorias={categoriasOrdenadas} selectedCategory={selectedCategory} onCategoryClick={handleCategoryClick} coresEstabelecimento={coresEstabelecimento} />

                {carrinho.length > 0 && <SugestoesCardapio carrinho={carrinho} allProdutos={allProdutos} handleAbrirModalProduto={handleItemAdd} />}

                {categoriasOrdenadas.map(cat => {
                    const items = menuAgrupado[cat];
                    const visible = visibleItemsCount[cat] || 4;
                    return (
                        <div key={cat} id={`categoria-${cat}`} className="mb-8">
                            <h2 className="text-2xl font-bold mb-4">{cat}</h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                {items.slice(0, visible).map((item, index) => (
                                    <div key={`${cat}-${item.id}-${index}`} className={`bg-white rounded-xl shadow-sm border border-gray-100 p-2 overflow-hidden ${!isLojaAberta ? 'opacity-75 grayscale-[0.3]' : ''}`}>
                                        <CardapioItem item={item} onAddItem={handleItemAdd} onPurchase={handleItemPurchase} coresEstabelecimento={coresEstabelecimento} isCatalog={window.location.pathname.startsWith('/catalogo')} />
                                    </div>
                                ))}
                            </div>
                            {visible < items.length && <LoadMoreSentinel category={cat} onLoadMore={handleLoadMore} />}
                        </div>
                    );
                })}

                {carrinho.length > 0 && (
                    <CheckoutStepper 
                        currentStep={checkoutActions.showPaymentModal ? 3 : 2} 
                        coresEstabelecimento={coresEstabelecimento} 
                    />
                )}

                <div className="flex flex-col lg:grid lg:grid-cols-2 gap-8 mt-12 pb-24">
                    <CustomerForm nomeCliente={nomeCliente} setNomeCliente={setNomeCliente} telefoneCliente={telefoneCliente} setTelefoneCliente={setTelefoneCliente} rua={rua} setRua={setRua} numero={numero} setNumero={setNumero} bairro={bairro} setBairro={setBairro} pontoReferencia={pontoReferencia} setPontoReferencia={setPontoReferencia} isRetirada={isRetirada} setIsRetirada={setIsRetirada} bairrosDisponiveis={bairrosDisponiveis} />
                    <CartSection carrinho={carrinho} subtotalCalculado={subtotalCalculado} taxaAplicada={checkoutActions.taxaAplicada} discountAmount={checkoutActions.discountAmount} finalOrderTotal={checkoutActions.finalOrderTotal} isRetirada={isRetirada} bairro={bairro} bairrosDisponiveis={bairrosDisponiveis} isLojaAberta={isLojaAberta} couponCodeInput={checkoutActions.couponCodeInput} setCouponCodeInput={checkoutActions.setCouponCodeInput} appliedCoupon={checkoutActions.appliedCoupon} couponLoading={checkoutActions.couponLoading} onApplyCoupon={checkoutActions.handleApplyCoupon} onRemoveCoupon={checkoutActions.handleRemoveCoupon} alterarQuantidade={alterarQuantidade} removerItem={removerItem} onCheckout={() => checkoutActions.prepararParaPagamento(isLojaAberta)} saldoCarteira={checkoutActions.saldoCarteira} usarCashback={checkoutActions.usarCashback} setUsarCashback={checkoutActions.setUsarCashback} cashbackAplicado={checkoutActions.cashbackAplicado} upsellItems={upsellItems} onAddUpsell={handleItemAdd} />

                </div>
            </div>

            {carrinhoRecuperado && carrinho.length > 0 && (
                <div className="fixed bottom-20 left-0 right-0 z-[200] px-4 animate-slide-up">
                    <div className="max-w-lg mx-auto bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 shadow-2xl flex justify-between items-center text-white">
                        <div>
                            <p className="font-black text-sm">🛒 Esqueceu algo?</p>
                            <p className="text-[11px] opacity-90">{carrinho.length} itens — R$ {subtotalCalculado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={descartarRecuperacao} className="px-3 py-2 bg-white/20 rounded-xl text-xs font-bold hover:bg-white/30">Descartar</button>
                            <button onClick={() => scrollToResumo()} className="px-3 py-2 bg-white text-orange-600 rounded-xl text-xs font-black">Ver Pedido</button>
                        </div>
                    </div>
                </div>
            )}

            <CartBar carrinho={carrinho} finalOrderTotal={checkoutActions.finalOrderTotal} isWidgetOpen={isWidgetOpen} coresEstabelecimento={coresEstabelecimento} onScrollToResumo={scrollToResumo} />

            <Suspense fallback={null}>
                {itemParaVariacoes && <VariacoesModal item={itemParaVariacoes} onConfirm={handleAdicionarItem} onClose={() => { setItemParaVariacoes(null); setSearchParams(params => { params.delete('produto'); return params; }, { replace: true }); }} coresEstabelecimento={coresEstabelecimento} isCatalog={window.location.pathname.startsWith('/catalogo')} />}
                {checkoutActions.showPaymentModal && checkoutActions.pedidoParaPagamento && <PaymentModal isOpen={checkoutActions.showPaymentModal} onClose={() => checkoutActions.setShowPaymentModal(false)} amount={checkoutActions.finalOrderTotal} orderId={checkoutActions.pedidoParaPagamento.vendaId} cartItems={carrinho} onSuccess={checkoutActions.handlePagamentoSucesso} coresEstabelecimento={coresEstabelecimento} pixKey={estabelecimentoInfo?.chavePix} establishmentName={estabelecimentoInfo?.nome} estabelecimentoId={actualEstabelecimentoId} hasMercadoPago={!!estabelecimentoInfo?.tokenMercadoPago} loading={checkoutActions.processandoPagamento} />}
                {checkoutActions.showRaspadinha && <RaspadinhaModal onGanhar={handleGanharRaspadinha} onClose={() => checkoutActions.setShowRaspadinha?.(false)} config={estabelecimentoInfo?.raspadinhaConfig} />}
                {estabelecimentoInfo && (authActions.showAICenter || isWidgetOpen) && <AIChatAssistant estabelecimento={estabelecimentoInfo} produtos={allProdutos} carrinho={carrinho} clienteNome={nomeCliente} taxaEntrega={checkoutActions.taxaEntregaCalculada} enderecoAtual={{ rua, numero, bairro, cidade }} isRetirada={isRetirada} onAddDirect={() => 'ADDED'} onCheckout={() => checkoutActions.prepararParaPagamento(isLojaAberta)} onClose={() => authActions.setShowAICenter(false)} onRequestLogin={() => { authActions.setShowAICenter(false); authActions.setDeveReabrirChat(true); authActions.handleAbrirLogin(); }} onSetDeliveryMode={(m) => setIsRetirada(m === 'retirada')} onUpdateAddress={(d) => { if (d.rua) setRua(d.rua); if (d.numero) setNumero(d.numero); if (d.bairro) setBairro(d.bairro); if (d.cidade) setCidade(d.cidade); if (d.referencia) setComplemento(d.referencia); }} />}
                <AIWidgetButton bottomOffset={carrinho.length > 0 ? '100px' : '24px'} />
            </Suspense>

            {checkoutActions.showOrderConfirmationModal && (
                <div className="fixed inset-0 bg-black/80 z-[5000] flex items-center justify-center p-4">
                    <div className="bg-white p-8 rounded-2xl text-center max-w-sm w-full shadow-2xl text-gray-900">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex mx-auto mb-4 items-center justify-center text-4xl">✅</div>
                        <h2 className="text-3xl font-bold">Pedido Enviado!</h2>
                        {checkoutActions.ultimoPedidoId && <p className="text-xs bg-gray-100 py-2 px-3 mt-2 rounded text-gray-600">#{checkoutActions.ultimoPedidoId.slice(-6).toUpperCase()}</p>}
                        <div className="space-y-3 mt-4">
                            <button onClick={() => { checkoutActions.setShowOrderConfirmationModal(false); navigate(actualEstabelecimentoId ? `/historico-pedidos?lojaId=${actualEstabelecimentoId}` : '/historico-pedidos'); }} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold">📋 Acompanhar Meu Pedido</button>
                            <button onClick={() => { checkoutActions.setShowOrderConfirmationModal(false); setTimeout(() => checkoutActions.setShowReviewModal(true), 500); }} className="w-full bg-amber-500 text-white py-3 rounded-xl font-bold">⭐ Avaliar Pedido</button>
                            <button onClick={() => checkoutActions.setShowOrderConfirmationModal(false)} className="w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-bold">Continuar</button>
                        </div>
                    </div>
                </div>
            )}

            <AuthModal
                show={authActions.showLoginPrompt} forceLogin={authActions.forceLogin} isRegistering={authActions.isRegisteringInModal} setIsRegistering={authActions.setIsRegisteringInModal} loginLoading={authActions.loginLoading}
                authMethod={authActions.authMethod} setAuthMethod={authActions.setAuthMethod}
                emailAuthModal={authActions.emailAuthModal} setEmailAuthModal={authActions.setEmailAuthModal} passwordAuthModal={authActions.passwordAuthModal} setPasswordAuthModal={authActions.setPasswordAuthModal}
                nomeAuthModal={authActions.nomeAuthModal} setNomeAuthModal={authActions.setNomeAuthModal} telefoneAuthModal={authActions.telefoneAuthModal} setTelefoneAuthModal={authActions.setTelefoneAuthModal}
                ruaAuthModal={authActions.ruaAuthModal} setRuaAuthModal={authActions.setRuaAuthModal} numeroAuthModal={authActions.numeroAuthModal} setNumeroAuthModal={authActions.setNumeroAuthModal}
                bairroAuthModal={authActions.bairroAuthModal} setBairroAuthModal={authActions.setBairroAuthModal} cidadeAuthModal={authActions.cidadeAuthModal} setCidadeAuthModal={authActions.setCidadeAuthModal}
                referenciaAuthModal={authActions.referenciaAuthModal} setReferenciaAuthModal={authActions.setReferenciaAuthModal} bairrosDisponiveis={bairrosDisponiveis}
                onLogin={authActions.handleLoginModal} onRegister={authActions.handleRegisterModal} onClose={() => authActions.setShowLoginPrompt(false)}
            />
            
            <Suspense fallback={null}>
                <ReviewModal isOpen={checkoutActions.showReviewModal} onClose={() => checkoutActions.setShowReviewModal(false)} pedidoId={checkoutActions.ultimoPedidoId} estabelecimentoId={actualEstabelecimentoId} clienteNome={nomeCliente} clienteId={currentUser?.uid} whatsappLoja={estabelecimentoInfo?.telefone} />
            </Suspense>

            <WaiterCallWidget estabelecimentoId={actualEstabelecimentoId} tipoNegocio={estabelecimentoInfo?.tipoNegocio} />

            <style>{`@keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } } .animate-slide-up { animation: slide-up 0.3s ease-out; }`}</style>
        </div>
    );
}

// Subcomponente de Sugestões de Carrinho para limpar o Render 
function SugestoesCardapio({ carrinho, allProdutos, handleAbrirModalProduto }) {
    const categoriasNoCarrinho = new Set(carrinho.map(c => (c.categoria || '').toLowerCase()));
    const idsNoCarrinho = new Set(carrinho.map(c => c.id));
    const sugestaoMap = {
        'lanches': ['bebidas', 'refrigerante', 'sucos', 'sobremesas', 'porcoes'],
        'hamburgueres': ['bebidas', 'refrigerante', 'acompanhamentos', 'porcoes'],
        'baguetes': ['bebidas', 'refrigerante', 'acompanhamentos', 'porcoes'],
        'pizzas': ['bebidas', 'refrigerante', 'sobremesas'],
        'hot dog': ['bebidas', 'refrigerante', 'porcoes'],
        'esfihas': ['bebidas', 'refrigerante', 'sobremesas'],
        'acai': ['complementos', 'adicionais'],
        'bebidas': ['lanches', 'hamburgueres', 'baguetes', 'pizzas', 'porcoes'],
        'porcoes': ['bebidas', 'refrigerante', 'sucos'],
    };
    const catsSugeridas = new Set();
    categoriasNoCarrinho.forEach(cat => {
        Object.entries(sugestaoMap).forEach(([key, vals]) => { if (cat.includes(key)) vals.forEach(v => catsSugeridas.add(v)); });
    });
    if (catsSugeridas.size === 0) { catsSugeridas.add('bebidas'); catsSugeridas.add('sobremesas'); }
    const sugestoes = allProdutos.filter(p => !idsNoCarrinho.has(p.id) && p.ativo !== false && [...catsSugeridas].some(s => (p.categoria || '').toLowerCase().includes(s))).slice(0, 4);
    
    if (sugestoes.length === 0) return null;
    return (
        <div className="mb-8 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-100">
            <h3 className="text-base font-black text-gray-800 mb-3 flex items-center gap-2">💡 Vai bem com o que você pediu</h3>
            <div className="grid grid-cols-2 gap-2">
                {sugestoes.map((item, index) => (
                    <button key={`sugestao-${item.id}-${index}`} onClick={() => handleAbrirModalProduto(item)} className="bg-white rounded-xl p-3 border border-amber-100 flex items-center gap-3 hover:shadow-md hover:border-amber-200 transition-all text-left active:scale-[0.98]">
                        <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">{item.imageUrl && <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />}</div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-800 truncate">{item.nome}</p>
                            <p className="text-[10px] font-bold text-emerald-600">R$ {(Number(item.preco) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}