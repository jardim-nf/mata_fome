// src/pages/Menu.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, Timestamp, setDoc as setDocFirestore, runTransaction, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import CardapioItem from '../components/CardapioItem';
import { useAuth } from '../context/AuthContext';
import { usePayment } from '../context/PaymentContext';
import { toast } from 'react-toastify';
import AdicionaisModal from '../components/AdicionaisModal';
import VariacoesModal from '../components/VariacoesModal';
import { v4 as uuidv4 } from 'uuid';
import PaymentModal from '../components/PaymentModal';
import CarrinhoFlutuante from '../components/CarrinhoFlutuante';
import RaspadinhaModal from '../components/RaspadinhaModal';

// 🔥 IMPORTS IA
import { useAI } from '../context/AIContext';
import AIChatAssistant from '../components/AIChatAssistant';
import AIWidgetButton from '../components/AIWidgetButton';

import { IoLocationSharp, IoTime, IoCall, IoLogOutOutline } from 'react-icons/io5';

function Menu() {
    const { estabelecimentoSlug } = useParams();
    const navigate = useNavigate();
    const { currentUser, currentClientData, loading: authLoading, isAdmin, isMasterAdmin, logout } = useAuth();
    const { isWidgetOpen } = useAI();
    
    // --- ESTADOS ---
    const [allProdutos, setAllProdutos] = useState([]);
    const [produtosFiltrados, setProdutosFiltrados] = useState([]);
    const [carrinho, setCarrinho] = useState([]);
    const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
    const [actualEstabelecimentoId, setActualEstabelecimentoId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [visibleItemsCount, setVisibleItemsCount] = useState({});
    const [showAICenter, setShowAICenter] = useState(true);

    // Auth & Checkout
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
    
    const [nomeCliente, setNomeCliente] = useState('');
    const [telefoneCliente, setTelefoneCliente] = useState('');
    const [rua, setRua] = useState('');
    const [numero, setNumero] = useState('');
    const [bairro, setBairro] = useState('');
    const [cidade, setCidade] = useState('');
    const [complemento, setComplemento] = useState('');

    const [isRetirada, setIsRetirada] = useState(false);
    const [taxaEntregaCalculada, setTaxaEntregaCalculada] = useState(0);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [couponCodeInput, setCouponCodeInput] = useState('');
    const [couponLoading, setCouponLoading] = useState(false);

    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [pedidoParaPagamento, setPedidoParaPagamento] = useState(null);
    const [showOrderConfirmationModal, setShowOrderConfirmationModal] = useState(false);
    const [confirmedOrderDetails, setConfirmedOrderDetails] = useState(null);

    const [itemParaAdicionais, setItemParaAdicionais] = useState(null);
    const [itemParaVariacoes, setItemParaVariacoes] = useState(null);
    
    // 🎁 RASPADINHA
    const [showRaspadinha, setShowRaspadinha] = useState(false);
    const [jaJogouRaspadinha, setJaJogouRaspadinha] = useState(false);
    const [premioRaspadinha, setPremioRaspadinha] = useState(null);
    
    const [ordemCategorias, setOrdemCategorias] = useState([]);

    const auth = getAuth();
    const [coresEstabelecimento, setCoresEstabelecimento] = useState({
        primaria: '#ffffff', destaque: '#059669', background: '#f9fafb',
        texto: { principal: '#111827', secundario: '#4B5563', placeholder: '#9CA3AF' }
    });

    // --- FUNÇÕES DE AUXÍLIO ---

    const scrollToResumo = useCallback(() => {
        const elementoResumo = document.getElementById('resumo-carrinho');
        if (elementoResumo) elementoResumo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    const formatarHorarios = useCallback((horarios) => {
        if (!horarios || typeof horarios !== 'object') return "Horário não informado";
        return Object.entries(horarios).map(([dia, horario]) => {
            if (!horario?.abertura || !horario?.fechamento) return `${dia}: Fechado`;
            return `${dia}: ${horario.abertura} - ${horario.fechamento}`;
        }).join(' | ');
    }, []);

    const superNormalizar = (t) => {
        if (!t) return '';
        return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    };

    const formatarItemCarrinho = (item) => {
        let nome = item.nome;
        if (item.variacaoSelecionada?.nome) nome += ` - ${item.variacaoSelecionada.nome}`;
        if (item.observacao) nome += ` (Obs: ${item.observacao})`;
        return nome;
    };

    const cleanData = (obj) => {
        if (!obj) return obj;
        return Object.entries(obj).reduce((acc, [key, value]) => {
            if (value === undefined) acc[key] = null;
            else acc[key] = value;
            return acc;
        }, {});
    };

    const subtotalCalculado = useMemo(() => carrinho.reduce((acc, item) => acc + (item.precoFinal * item.qtd), 0), [carrinho]);
    
    // 🔥 LÓGICA DA RASPADINHA: Se passar de 100, exibe o modal
    useEffect(() => {
        if (subtotalCalculado >= 100 && !jaJogouRaspadinha && !premioRaspadinha) {
            const timer = setTimeout(() => {
                setShowRaspadinha(true);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [subtotalCalculado, jaJogouRaspadinha, premioRaspadinha]);

    const handleGanharRaspadinha = (premio) => {
        setShowRaspadinha(false);
        setJaJogouRaspadinha(true);
        setPremioRaspadinha(premio);

        if (premio.type === 'brinde') {
            const brindeItem = {
                ...premio.produto,
                id: 'brinde-' + uuidv4(),
                cartItemId: uuidv4(),
                qtd: 1,
                preco: 0,
                precoFinal: 0,
                observacao: '🎁 Ganho na Raspadinha'
            };
            setCarrinho(prev => [...prev, brindeItem]);
            toast.success(`🎁 Parabéns! Você ganhou: ${premio.label}`);
        } else {
            toast.success(`🎉 Parabéns! Você ganhou: ${premio.label}`);
        }
    };

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

    // --- CARREGAMENTO ---
    const carregarProdutosRapido = async (estabId) => {
        try {
            const cardapioRef = collection(db, 'estabelecimentos', estabId, 'cardapio');
            const categoriasSnapshot = await getDocs(query(cardapioRef, where('ativo', '==', true)));
            
            const promessas = categoriasSnapshot.docs.map(async (catDoc) => {
                const categoriaData = catDoc.data();
                const itensRef = collection(db, 'estabelecimentos', estabId, 'cardapio', catDoc.id, 'itens');
                const itensSnapshot = await getDocs(query(itensRef, where('ativo', '==', true)));
                return itensSnapshot.docs.map(itemDoc => ({
                    ...itemDoc.data(), id: itemDoc.id, categoria: categoriaData.nome || 'Geral', categoriaId: catDoc.id
                }));
            });

            const resultados = await Promise.all(promessas);
            const todosProdutos = resultados.flat();
            return todosProdutos.filter(p => p.preco !== undefined || p.precoFinal !== undefined || (p.variacoes && p.variacoes.length > 0));
        } catch (error) { console.error("Erro:", error); return []; }
    };

    // --- IA HANDLER ---
    const handleAdicionarPorIA = useCallback((comandoCompleto) => {
        console.log("🤖 IA Processando:", comandoCompleto);
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
            const split = nomeProduto.split('-- Opcao:');
            nomeProduto = split[0].trim();
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
            variacaoSelecionada = produtoEncontrado.variacoes?.find(v => superNormalizar(v.nome) === termoOpcao || superNormalizar(v.nome).includes(termoOpcao));
        } else if (produtoEncontrado.variacoes?.length === 1) {
            variacaoSelecionada = produtoEncontrado.variacoes[0];
        }

        if (variacaoSelecionada || (!produtoEncontrado.variacoes?.length && !produtoEncontrado.adicionais?.length)) {
            const precoFinal = variacaoSelecionada ? Number(variacaoSelecionada.preco || variacaoSelecionada.precoFinal) : Number(produtoEncontrado.preco || produtoEncontrado.precoFinal || 0);
            setCarrinho(prev => [...prev, { ...produtoEncontrado, variacaoSelecionada, precoFinal, observacao: observacaoIA, qtd: quantidadeIA, cartItemId: uuidv4() }]);
            toast.success(`${quantidadeIA}x ${produtoEncontrado.nome} adicionado!`);
            return 'ADDED';
        }

        setShowAICenter(false);
        handleAbrirModalProduto(produtoEncontrado);
        return 'MODAL';
    }, [allProdutos]);

    // --- ACTIONS ---
    const handleAbrirModalProduto = (item) => {
        if (!currentUser) { setShowLoginPrompt(true); return; }
        if (item.variacoes?.length > 0) setItemParaVariacoes(item);
        else if (item.adicionais?.length > 0) setItemParaAdicionais(item);
        else handleAdicionarRapido(item);
    };

    const handleAdicionarRapido = (item) => {
        if (!currentUser) { setShowLoginPrompt(true); return; }
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

    const prepararParaPagamento = () => {
        if (!currentUser) {
            toast.info("Faça login para finalizar.");
            setShowLoginPrompt(true);
            return;
        }
        if (carrinho.length === 0) {
            toast.warn('Seu carrinho está vazio.');
            return;
        }
        if (!isRetirada && (!rua || !numero || !bairro)) {
            toast.warn("Preencha o endereço de entrega.");
            const formElement = document.getElementById('form-dados-cliente');
            if (formElement) formElement.scrollIntoView({ behavior: 'smooth' });
            return;
        }

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
            premioRaspadinha: premioRaspadinha ? { tipo: premioRaspadinha.type, label: premioRaspadinha.label, valor: premioRaspadinha.valor || 0 } : null,
            cupomAplicado: appliedCoupon ? { ...appliedCoupon, descontoCalculado: discountAmount } : null,
            createdAt: serverTimestamp(),
            status: 'aguardando_pagamento'
        };

        setPedidoParaPagamento(pedidoRaw);
        setShowPaymentModal(true);
    };

    const handlePagamentoSucesso = async (result) => {
        const docRef = await addDoc(collection(db, 'pedidos'), { ...pedidoParaPagamento, status: 'recebido', transactionId: result.transactionId });
        setConfirmedOrderDetails({ id: docRef.id });
        setShowOrderConfirmationModal(true);
        setCarrinho([]);
        setShowPaymentModal(false);
        setPremioRaspadinha(null); 
        setJaJogouRaspadinha(false);
    };

    const handleApplyCoupon = async () => {
        if (!currentUser) { setShowLoginPrompt(true); return; }
        setCouponLoading(true);
        try {
            const q = query(collection(db, 'estabelecimentos', actualEstabelecimentoId, 'cupons'), where('codigo', '==', couponCodeInput.toUpperCase().trim()));
            const snap = await getDocs(q);
            if (snap.empty) throw new Error('Cupom inválido.');
            const data = snap.docs[0].data();
            
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

    const handleLogout = async () => { try { await logout(); setCarrinho([]); window.location.reload(); } catch(e){} };
    const handleLoginModal = async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, emailAuthModal, passwordAuthModal); setShowLoginPrompt(false); } catch { toast.error("Erro no login"); } };
    const handleRegisterModal = async (e) => { e.preventDefault(); try { const cred = await createUserWithEmailAndPassword(auth, emailAuthModal, passwordAuthModal); await setDocFirestore(doc(db, 'clientes', cred.user.uid), { nome: nomeAuthModal, telefone: telefoneAuthModal, email: emailAuthModal, endereco: { rua: ruaAuthModal, numero: numeroAuthModal, bairro: bairroAuthModal, cidade: cidadeAuthModal }, criadoEm: Timestamp.now() }); setShowLoginPrompt(false); } catch { toast.error("Erro ao criar conta."); } };

    // --- EFFECTS ---
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
            setEstabelecimentoInfo({ ...data, id }); setActualEstabelecimentoId(id); setNomeEstabelecimento(data.nome);
            if (data.cores) setCoresEstabelecimento(data.cores);
            if (data.ordemCategorias) setOrdemCategorias(data.ordemCategorias);
            setAllProdutos(prods); setLoading(false);
        };
        load();
    }, [estabelecimentoSlug, navigate]);

    useEffect(() => {
        if (!authLoading && currentUser && currentClientData) {
            setNomeCliente(currentClientData.nome || ''); setTelefoneCliente(currentClientData.telefone || '');
            if (currentClientData.endereco) {
                setRua(currentClientData.endereco.rua || ''); setNumero(currentClientData.endereco.numero || '');
                setBairro(currentClientData.endereco.bairro || ''); setCidade(currentClientData.endereco.cidade || '');
            }
        }
    }, [currentUser, currentClientData, authLoading]);

    // Cálculo da Taxa
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
            <div className="max-w-7xl mx-auto px-4 py-8">
                
                {/* INFO */}
                {estabelecimentoInfo && (
                    <div className="bg-white rounded-xl p-6 mb-6 mt-6 border flex gap-6 items-center shadow-lg">
                        <img src={estabelecimentoInfo.logoUrl} className="w-24 h-24 rounded-xl object-cover border-2" style={{ borderColor: coresEstabelecimento.primaria }} />
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold mb-2">{estabelecimentoInfo.nome}</h1>
                            <div className="text-sm text-gray-600">
                                <p className="flex items-center gap-2"><IoLocationSharp className="text-red-500" /> {estabelecimentoInfo.endereco?.rua}</p>
                                <p className="flex items-center gap-2"><IoTime className="text-blue-500" /> {formatarHorarios(estabelecimentoInfo.horarioFuncionamento)}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* FILTROS */}
                <div className="bg-white p-4 mb-8 sticky top-0 z-40 shadow-sm md:rounded-lg">
                    <input type="text" placeholder="🔍 Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-3 mb-4 bg-gray-50 rounded-lg border" />
                    <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
                        {['Todos', ...categoriasOrdenadas].map(cat => (
                            <button key={cat} onClick={() => setSelectedCategory(cat)} className="px-4 py-2 rounded-full font-bold bg-gray-100 text-gray-600">{cat}</button>
                        ))}
                    </div>
                </div>

                {categoriasOrdenadas.map(cat => (
                    <div key={cat} className="mb-8">
                        <h2 className="text-2xl font-bold mb-4">{cat}</h2>
                        <div className="grid gap-4 md:grid-cols-2">
                            {menuAgrupado[cat].map(item => <CardapioItem key={item.id} item={item} onAddItem={handleAbrirModalProduto} coresEstabelecimento={coresEstabelecimento} />)}
                        </div>
                    </div>
                ))}

                {/* RESUMO CARRINHO */}
                <div id="resumo-carrinho" className="bg-white p-6 rounded-xl border shadow-lg mt-12 text-gray-900">
                    <h3 className="text-xl font-bold mb-4">🛒 Resumo do Pedido</h3>
                    {carrinho.length === 0 ? <p className="text-gray-500">Seu carrinho está vazio.</p> : (
                        <div>
                            {carrinho.map(item => (
                                <div key={item.cartItemId} className="flex justify-between py-2 border-b">
                                    <span>{formatarItemCarrinho(item)} (x{item.qtd})</span>
                                    <span>R$ {(item.precoFinal * item.qtd).toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="text-right font-bold text-xl mt-4">Total: R$ {finalOrderTotal.toFixed(2)}</div>
                            {premioRaspadinha && <div className="text-right text-purple-600 font-bold mt-1">🎁 Prêmio: {premioRaspadinha.label}</div>}
                            <button onClick={prepararParaPagamento} className="w-full bg-green-600 text-white py-4 rounded-xl font-bold mt-4 shadow-lg">Finalizar Pedido</button>
                        </div>
                    )}
                </div>

                {/* DADOS DO CLIENTE */}
                <div id="form-dados-cliente" className="bg-white p-6 rounded-xl border shadow-lg mt-8 text-left">
                    <h3 className="text-xl font-bold mb-4 text-gray-900">👤 Seus Dados</h3>
                    {currentUser ? <button onClick={handleLogout} className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded mb-4">Sair ({currentUser.email})</button> : <button onClick={() => setShowLoginPrompt(true)} className="text-xs text-green-600 border border-green-200 px-2 py-1 rounded mb-4">Entrar</button>}
                    <div className="space-y-4">
                        <input className="w-full p-3 rounded border text-gray-900" placeholder="Nome *" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} />
                        <input className="w-full p-3 rounded border text-gray-900" placeholder="Telefone *" value={telefoneCliente} onChange={e => setTelefoneCliente(e.target.value)} />
                        {!isRetirada && (
                            <div className="space-y-2">
                                <div className="flex gap-2"><input className="flex-1 p-3 rounded border text-gray-900" placeholder="Rua *" value={rua} onChange={e => setRua(e.target.value)} /><input className="w-24 p-3 rounded border text-center text-gray-900" placeholder="Nº *" value={numero} onChange={e => setNumero(e.target.value)} /></div>
                                <input className="w-full p-3 rounded border text-gray-900" placeholder="Bairro *" value={bairro} onChange={e => setBairro(e.target.value)} />
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button onClick={() => setIsRetirada(false)} className={`flex-1 p-3 rounded font-bold ${!isRetirada ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}>🚚 Entrega</button>
                            <button onClick={() => setIsRetirada(true)} className={`flex-1 p-3 rounded font-bold ${isRetirada ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}>🏪 Retirada</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 🔥 CARRINHO FLUTUANTE CONDICIONAL */}
            {!isWidgetOpen && (
                <CarrinhoFlutuante carrinho={carrinho} coresEstabelecimento={coresEstabelecimento} onClick={scrollToResumo} />
            )}

            {/* 🔥 IA: onCheckout abre PREPARAR PARA PAGAMENTO */}
            {estabelecimentoInfo && (
                <AIChatAssistant 
                    estabelecimento={estabelecimentoInfo} 
                    produtos={allProdutos} 
                    onAddDirect={handleAdicionarPorIA} 
                    onCheckout={prepararParaPagamento} 
                    mode={showAICenter ? "center" : "widget"}
                    onClose={() => setShowAICenter(false)}
                    clienteNome={nomeCliente}
                    onRequestLogin={() => setShowLoginPrompt(true)}
                    carrinho={carrinho}
                />
            )}

            <AIWidgetButton />

            {/* MODAIS */}
            {itemParaVariacoes && <VariacoesModal item={itemParaVariacoes} onConfirm={(i) => {setCarrinho([...carrinho, {...i, cartItemId:uuidv4(), qtd:1}]); setItemParaVariacoes(null)}} onClose={() => setItemParaVariacoes(null)} coresEstabelecimento={coresEstabelecimento} />}
            {showPaymentModal && <PaymentModal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} amount={finalOrderTotal} cartItems={carrinho} customer={pedidoParaPagamento?.cliente} onSuccess={handlePagamentoSucesso} coresEstabelecimento={coresEstabelecimento} />}
            {showOrderConfirmationModal && <div className="fixed inset-0 bg-black/80 z-[5000] flex items-center justify-center p-4 text-gray-900"><div className="bg-white p-8 rounded-2xl text-center shadow-2xl"><h2 className="text-3xl font-bold mb-4 text-gray-900">🎉 Pedido Recebido!</h2><button onClick={() => window.location.reload()} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold">Fechar</button></div></div>}
            {showRaspadinha && <RaspadinhaModal onGanhar={handleGanharRaspadinha} onClose={() => setShowRaspadinha(false)} />}
            {showLoginPrompt && <div className="fixed inset-0 bg-black/80 z-[5000] flex items-center justify-center p-4"><div className="bg-white p-6 rounded-2xl w-full max-w-md"><h2 className="text-center font-bold text-xl mb-4">Login Necessário</h2><form onSubmit={handleLoginModal}><input className="w-full p-3 border mb-3 rounded" placeholder="Email" value={emailAuthModal} onChange={e=>setEmailAuthModal(e.target.value)} /><input className="w-full p-3 border mb-3 rounded" type="password" placeholder="Senha" value={passwordAuthModal} onChange={e=>setPasswordAuthModal(e.target.value)} /><button className="w-full bg-green-600 text-white p-3 rounded">Entrar</button></form><button onClick={() => setShowLoginPrompt(false)} className="block w-full text-center text-red-500 mt-4">Fechar</button></div></div>}
        </div>
    );
}

export default Menu;