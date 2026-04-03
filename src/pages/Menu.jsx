import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

export default function Menu() {
    const { estabelecimentoSlug } = useParams();
    const navigate = useNavigate();
    const { currentUser, currentClientData, loading: authLoading, isAdmin, isMasterAdmin, logout } = useAuth();
    const { isWidgetOpen } = useAI();

    const { loading, allProdutos, estabelecimentoInfo, actualEstabelecimentoId, ordemCategorias, bairrosDisponiveis, coresEstabelecimento } = useEstablishment(estabelecimentoSlug);
    const { carrinho, subtotalCalculado, adicionarItem, alterarQuantidade, removerItem, limparCarrinho, adicionarBrinde, carrinhoRecuperado, descartarRecuperacao } = useCart();
    
    // Custom Hooks
    const { currentTime, isLojaAberta } = useMenuTime(estabelecimentoInfo);
    const authActions = useMenuAuth(authLoading, currentUser, logout, limparCarrinho);

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
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [produtosFiltrados, setProdutosFiltrados] = useState([]);
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
        localStorage.removeItem('ideafood_repetir_pedido');
        try {
            const itens = JSON.parse(repetir);
            let adicionados = 0;
            itens.forEach(item => {
                const pEncontrado = allProdutos.find(p => p.nome === item.nome);
                if (pEncontrado) { for (let i = 0; i < (item.quantidade || 1); i++) { adicionarItem({ ...pEncontrado, observacao: item.observacoes || '' }); } adicionados++; }
            });
            if (adicionados > 0) toast.success(`🔁 ${adicionados} itens adicionados!`);
        } catch (e) { console.warn(e); }
    }, [loading, allProdutos, adicionarItem]);

    useEffect(() => {
        if (triggerCheckout && carrinho.length > 0) { setTriggerCheckout(false); setTimeout(() => { scrollToResumo(); toast.info('👇 Confira seu pedido e finalize aqui!'); }, 200); }
    }, [carrinho, triggerCheckout, scrollToResumo]);

    useEffect(() => {
        setProdutosFiltrados(searchTerm ? allProdutos.filter(prod => prod.nome.toLowerCase().includes(searchTerm.toLowerCase())) : [...allProdutos]);
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

    const menuAgrupado = useMemo(() => produtosFiltrados.reduce((acc, p) => { const cat = p.categoria || 'Outros'; if (!acc[cat]) acc[cat] = []; acc[cat].push(p); return acc; }, {}), [produtosFiltrados]);
    const categoriasOrdenadas = useMemo(() => Object.keys(menuAgrupado).sort((a, b) => (!ordemCategorias.length ? a.localeCompare(b) : ordemCategorias.indexOf(a) - ordemCategorias.indexOf(b))), [menuAgrupado, ordemCategorias]);

    const enrichWithGlobalAdicionais = useCallback((item) => {
        const termosAdicionais = ['adicionais','adicional','extra','extras','complemento','complementos','acrescimo','acrescimos','molho','molhos','opcoes','opções'];
        const catNorm = normalizarTexto(item.categoria || '');
        if (termosAdicionais.some(t => catNorm.includes(t))) return item;

        const catsHamburguer = ['classico', 'classicos', 'novato', 'novatos', 'queridinho', 'queridinhos', 'grande', 'grandes', 'hamburguer', 'hamburgueres', 'burger', 'burgers', 'artesanal', 'artesanais', 'smash', 'gourmet'];
        if (!catsHamburguer.some(cat => catNorm.includes(cat) || normalizarTexto(item.categoriaId || '').includes(cat))) return item;

        const globais = allProdutos.filter(p => termosAdicionais.some(t => normalizarTexto(p.categoria || '').includes(t)));
        const idsExistentes = new Set((item.adicionais || []).map(a => a.id));
        return { ...item, adicionais: [...(item.adicionais || []), ...globais.filter(g => !idsExistentes.has(g.id))] };
    }, [allProdutos]);

    const handleAdicionarItem = (itemConfigurado) => {
        adicionarItem({ ...itemConfigurado, precoFinal: Number(itemConfigurado.precoFinal || 0) }); setItemParaVariacoes(null); if (itemConfigurado.isBuyNow) setTriggerCheckout(true);
    };

    const handleClickItemModal = useCallback((item, isBuyNow = false) => {
        if (!isLojaAberta) return toast.error('A loja está fechada!');
        if (!currentUser) return authActions.handleAbrirLogin();
        const itemComAds = enrichWithGlobalAdicionais({ ...item, observacao: '', isBuyNow });
        if (itemComAds.variacoes?.length > 0 || itemComAds.adicionais?.length > 0) setItemParaVariacoes(itemComAds);
        else handleAdicionarItem(itemComAds);
    }, [isLojaAberta, currentUser, authActions, enrichWithGlobalAdicionais]);

    if (loading || authLoading) return <MenuSkeleton />;
    const isAdminPreview = currentUser && (isAdmin || isMasterAdmin);

    return (
        <div className="w-full relative min-h-screen text-left" style={{ backgroundColor: coresEstabelecimento.background, color: coresEstabelecimento.texto.principal, paddingBottom: '150px' }}>
            <div className="max-w-7xl mx-auto px-4 w-full">
                {isAdminPreview && (
                    <div className="bg-amber-100 border border-amber-300 rounded-xl p-3 mb-4 flex items-center justify-between">
                        <p className="text-amber-800 text-sm font-bold">👁️ Modo Preview — Visualizando como cliente</p>
                        <button onClick={() => navigate('/painel')} className="bg-amber-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-600 transition-all">← Painel</button>
                    </div>
                )}
                
                <EstablishmentHeader estabelecimentoInfo={estabelecimentoInfo} coresEstabelecimento={coresEstabelecimento} isLojaAberta={isLojaAberta} currentTime={currentTime} currentUser={currentUser} onLogout={authActions.handleLogout} />
                <CategoryFilter searchTerm={searchTerm} onSearchChange={setSearchTerm} categorias={categoriasOrdenadas} selectedCategory={selectedCategory} onCategoryClick={handleCategoryClick} coresEstabelecimento={coresEstabelecimento} />

                {carrinho.length > 0 && <SugestoesCardapio carrinho={carrinho} allProdutos={allProdutos} handleAbrirModalProduto={(it) => handleClickItemModal(it, false)} />}

                {categoriasOrdenadas.map(cat => {
                    const items = menuAgrupado[cat];
                    const visible = visibleItemsCount[cat] || 4;
                    return (
                        <div key={cat} id={`categoria-${cat}`} className="mb-8">
                            <h2 className="text-2xl font-bold mb-4">{cat}</h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                {items.slice(0, visible).map(item => (
                                    <div key={item.id} className={`bg-white rounded-xl shadow-sm border border-gray-100 p-2 overflow-hidden ${!isLojaAberta ? 'opacity-75 grayscale-[0.3]' : ''}`}>
                                        <CardapioItem item={item} onAddItem={() => handleClickItemModal(item, false)} onPurchase={() => handleClickItemModal(item, true)} coresEstabelecimento={coresEstabelecimento} />
                                    </div>
                                ))}
                            </div>
                            {visible < items.length && <LoadMoreSentinel category={cat} onLoadMore={handleLoadMore} />}
                        </div>
                    );
                })}

                <div className="flex flex-col lg:grid lg:grid-cols-2 gap-8 mt-12 pb-24">
                    <CustomerForm nomeCliente={nomeCliente} setNomeCliente={setNomeCliente} telefoneCliente={telefoneCliente} setTelefoneCliente={setTelefoneCliente} rua={rua} setRua={setRua} numero={numero} setNumero={setNumero} bairro={bairro} setBairro={setBairro} pontoReferencia={pontoReferencia} setPontoReferencia={setPontoReferencia} isRetirada={isRetirada} setIsRetirada={setIsRetirada} bairrosDisponiveis={bairrosDisponiveis} />
                    <CartSection carrinho={carrinho} subtotalCalculado={subtotalCalculado} taxaAplicada={checkoutActions.taxaAplicada} discountAmount={checkoutActions.discountAmount} finalOrderTotal={checkoutActions.finalOrderTotal} isRetirada={isRetirada} bairro={bairro} bairrosDisponiveis={bairrosDisponiveis} isLojaAberta={isLojaAberta} couponCodeInput={checkoutActions.couponCodeInput} setCouponCodeInput={checkoutActions.setCouponCodeInput} appliedCoupon={checkoutActions.appliedCoupon} couponLoading={checkoutActions.couponLoading} onApplyCoupon={checkoutActions.handleApplyCoupon} onRemoveCoupon={checkoutActions.handleRemoveCoupon} alterarQuantidade={alterarQuantidade} removerItem={removerItem} onCheckout={() => checkoutActions.prepararParaPagamento(isLojaAberta)} />
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
                {itemParaVariacoes && <VariacoesModal item={itemParaVariacoes} onConfirm={handleAdicionarItem} onClose={() => setItemParaVariacoes(null)} coresEstabelecimento={coresEstabelecimento} />}
                {checkoutActions.showPaymentModal && checkoutActions.pedidoParaPagamento && <PaymentModal isOpen={checkoutActions.showPaymentModal} onClose={() => checkoutActions.setShowPaymentModal(false)} amount={checkoutActions.finalOrderTotal} orderId={checkoutActions.pedidoParaPagamento.vendaId} cartItems={carrinho} onSuccess={checkoutActions.handlePagamentoSucesso} coresEstabelecimento={coresEstabelecimento} pixKey={estabelecimentoInfo?.chavePix} establishmentName={estabelecimentoInfo?.nome} estabelecimentoId={actualEstabelecimentoId} hasMercadoPago={!!estabelecimentoInfo?.tokenMercadoPago} />}
                {checkoutActions.showRaspadinha && <RaspadinhaModal onGanhar={handleGanharRaspadinha} onClose={() => checkoutActions.setShowRaspadinha?.(false)} config={estabelecimentoInfo?.raspadinhaConfig} />}
                {estabelecimentoInfo && (authActions.showAICenter || isWidgetOpen) && <AIChatAssistant estabelecimento={estabelecimentoInfo} produtos={allProdutos} carrinho={carrinho} clienteNome={nomeCliente} taxaEntrega={checkoutActions.taxaEntregaCalculada} enderecoAtual={{ rua, numero, bairro, cidade }} isRetirada={isRetirada} onAddDirect={() => 'ADDED'} onCheckout={() => checkoutActions.prepararParaPagamento(isLojaAberta)} onClose={() => authActions.setShowAICenter(false)} onRequestLogin={() => { authActions.setShowAICenter(false); authActions.setDeveReabrirChat(true); authActions.handleAbrirLogin(); }} onSetDeliveryMode={(m) => setIsRetirada(m === 'retirada')} onUpdateAddress={(d) => { if (d.rua) setRua(d.rua); if (d.numero) setNumero(d.numero); if (d.bairro) setBairro(d.bairro); if (d.cidade) setCidade(d.cidade); if (d.referencia) setComplemento(d.referencia); }} />}
                <AIWidgetButton bottomOffset={carrinho.length > 0 ? '100px' : '24px'} />
            </Suspense>

            {checkoutActions.showOrderConfirmationModal && (
                <div className="fixed inset-0 bg-black/80 z-[5000] flex items-center justify-center p-4">
                    <div className="bg-white p-8 rounded-2xl text-center max-w-sm w-full shadow-2xl">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex mx-auto mb-4 items-center justify-center text-4xl">✅</div>
                        <h2 className="text-3xl font-bold">Pedido Enviado!</h2>
                        {checkoutActions.ultimoPedidoId && <p className="text-xs bg-gray-50 py-2 px-3 mt-2 rounded">#{checkoutActions.ultimoPedidoId.slice(-6).toUpperCase()}</p>}
                        <div className="space-y-3 mt-4">
                            <button onClick={() => { checkoutActions.setShowOrderConfirmationModal(false); navigate('/historico-pedidos'); }} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold">📋 Acompanhar Meu Pedido</button>
                            <button onClick={() => { checkoutActions.setShowOrderConfirmationModal(false); setTimeout(() => checkoutActions.setShowReviewModal(true), 500); }} className="w-full bg-amber-500 text-white py-3 rounded-xl font-bold">⭐ Avaliar Pedido</button>
                            <button onClick={() => checkoutActions.setShowOrderConfirmationModal(false)} className="w-full bg-gray-100 text-gray-600 py-3 rounded-xl font-bold">Continuar</button>
                        </div>
                    </div>
                </div>
            )}

            <AuthModal
                show={authActions.showLoginPrompt} forceLogin={authActions.forceLogin} isRegistering={authActions.isRegisteringInModal} setIsRegistering={authActions.setIsRegisteringInModal} loginLoading={authActions.loginLoading}
                emailAuthModal={authActions.emailAuthModal} setEmailAuthModal={authActions.setEmailAuthModal} passwordAuthModal={authActions.passwordAuthModal} setPasswordAuthModal={authActions.setPasswordAuthModal}
                nomeAuthModal={authActions.nomeAuthModal} setNomeAuthModal={authActions.setNomeAuthModal} telefoneAuthModal={authActions.telefoneAuthModal} setTelefoneAuthModal={authActions.setTelefoneAuthModal}
                ruaAuthModal={authActions.ruaAuthModal} setRuaAuthModal={authActions.setRuaAuthModal} numeroAuthModal={authActions.numeroAuthModal} setNumeroAuthModal={authActions.setNumeroAuthModal}
                bairroAuthModal={authActions.bairroAuthModal} setBairroAuthModal={authActions.setBairroAuthModal} cidadeAuthModal={authActions.cidadeAuthModal} setCidadeAuthModal={authActions.setCidadeAuthModal}
                referenciaAuthModal={authActions.referenciaAuthModal} setReferenciaAuthModal={authActions.setReferenciaAuthModal} bairrosDisponiveis={bairrosDisponiveis}
                onLogin={authActions.handleLoginModal} onRegister={authActions.handleRegisterModal} onClose={() => authActions.setShowLoginPrompt(false)}
            />
            
            <Suspense fallback={null}>
                <ReviewModal isOpen={checkoutActions.showReviewModal} onClose={() => checkoutActions.setShowReviewModal(false)} pedidoId={checkoutActions.ultimoPedidoId} estabelecimentoId={actualEstabelecimentoId} clienteNome={nomeCliente} clienteId={currentUser?.uid} />
            </Suspense>

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
        'pizzas': ['bebidas', 'refrigerante', 'sobremesas'],
        'hot dog': ['bebidas', 'refrigerante', 'porcoes'],
        'esfihas': ['bebidas', 'refrigerante', 'sobremesas'],
        'acai': ['complementos', 'adicionais'],
        'bebidas': ['lanches', 'hamburgueres', 'pizzas', 'porcoes'],
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
                {sugestoes.map(item => (
                    <button key={item.id} onClick={() => handleAbrirModalProduto(item)} className="bg-white rounded-xl p-3 border border-amber-100 flex items-center gap-3 hover:shadow-md hover:border-amber-200 transition-all text-left active:scale-[0.98]">
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