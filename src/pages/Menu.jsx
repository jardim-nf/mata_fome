// src/pages/Menu.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, Timestamp, getDoc as getDocFirestore, setDoc as setDocFirestore, runTransaction, doc, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import CardapioItem from '../components/CardapioItem';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import AdicionaisModal from '../components/AdicionaisModal';
import { v4 as uuidv4 } from 'uuid';

function Menu() {
    const { estabelecimentoSlug } = useParams();
    const navigate = useNavigate();
    const { currentUser, currentClientData, loading: authLoading, isAdmin, isMasterAdmin } = useAuth();

    // --- ESTADOS ---
    const [allProdutos, setAllProdutos] = useState([]);
    const [produtosFiltrados, setProdutosFiltrados] = useState([]);
    const [carrinho, setCarrinho] = useState([]);
    const [nomeCliente, setNomeCliente] = useState('');
    const [telefoneCliente, setTelefoneCliente] = useState('');
    const [rua, setRua] = useState('');
    const [numero, setNumero] = useState('');
    const [bairro, setBairro] = useState('');
    const [cidade, setCidade] = useState('');
    const [complemento, setComplemento] = useState('');
    const [formaPagamento, setFormaPagamento] = useState('');
    const [trocoPara, setTrocoPara] = useState('');
    const [taxasBairro, setTaxasBairro] = useState([]);
    const [taxaEntregaCalculada, setTaxaEntregaCalculada] = useState(0);
    const [bairroNaoEncontrado, setBairroNaoEncontrado] = useState(false);
    const [isRetirada, setIsRetirada] = useState(false);
    const [nomeEstabelecimento, setNomeEstabelecimento] = useState("Carregando Cardápio...");
    const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
    const [actualEstabelecimentoId, setActualEstabelecimentoId] = useState(null);
    const [showOrderConfirmationModal, setShowOrderConfirmationModal] = useState(false);
    const [confirmedOrderDetails, setConfirmedOrderDetails] = useState(null);
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
    const [errorAuthModal, setErrorAuthModal] = useState('');
    const auth = getAuth();
    const [couponCodeInput, setCouponCodeInput] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [couponLoading, setCouponLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [availableCategories, setAvailableCategories] = useState([]);
    const [itemParaAdicionais, setItemParaAdicionais] = useState(null);
    const [visibleItemsCount, setVisibleItemsCount] = useState({});

    // --- CÁLCULOS ---
    const subtotalCalculado = useMemo(() => carrinho.reduce((acc, item) => acc + (item.precoFinal * item.qtd), 0), [carrinho]);
    const taxaAplicada = isRetirada ? 0 : taxaEntregaCalculada;
    const finalOrderTotal = useMemo(() => Math.max(0, subtotalCalculado + taxaAplicada - discountAmount), [subtotalCalculado, taxaAplicada, discountAmount]);

    // --- FUNÇÕES ---
    const handleShowMore = (categoryName) => {
        setVisibleItemsCount(prev => ({ ...prev, [categoryName]: (prev[categoryName] || 3) + 3 }));
    };
    const handleShowLess = (categoryName) => {
        setVisibleItemsCount(prev => ({ ...prev, [categoryName]: 3 }));
    };
    const handleAbrirModalAdicionais = (item) => {
        if (item.adicionais && Array.isArray(item.adicionais) && item.adicionais.length > 0) {
            setItemParaAdicionais(item);
        } else {
            adicionarItemSimplesAoCarrinho(item);
        }
    };
    const handleFecharModal = () => {
        setItemParaAdicionais(null);
    };
    const adicionarItemSimplesAoCarrinho = (item) => {
        if (!currentUser) {
            toast.warn('Para adicionar itens, por favor, faça login ou cadastre-se.');
            setShowLoginPrompt(true);
            return;
        }
        const itemExistente = carrinho.find(p => p.id === item.id && (!p.adicionais || p.adicionais.length === 0));
        if (itemExistente) {
            setCarrinho(prevCarrinho => prevCarrinho.map(p => p.cartItemId === itemExistente.cartItemId ? { ...p, qtd: p.qtd + 1 } : p));
        } else {
            const novoItemNoCarrinho = { ...item, qtd: 1, cartItemId: uuidv4(), precoFinal: item.preco, adicionais: [] };
            setCarrinho(prevCarrinho => [...prevCarrinho, novoItemNoCarrinho]);
        }
        toast.success(`${item.nome} adicionado ao carrinho!`);
    };
    const handleConfirmarAdicionais = (itemConfigurado) => {
        if (!currentUser) {
            toast.warn('Para adicionar itens com adicionais, por favor, faça login ou cadastre-se.');
            setShowLoginPrompt(true);
            return;
        }
        const novoItemNoCarrinho = { ...itemConfigurado, qtd: 1, cartItemId: uuidv4() };
        setCarrinho(prevCarrinho => [...prevCarrinho, novoItemNoCarrinho]);
        toast.success(`${itemConfigurado.nome} foi adicionado ao carrinho!`);
        handleFecharModal();
    };
    const removerDoCarrinho = (cartItemId) => {
        const produtoNoCarrinho = carrinho.find((p) => p.cartItemId === cartItemId);
        if (!produtoNoCarrinho) return;
        if (produtoNoCarrinho.qtd === 1) {
            setCarrinho(carrinho.filter((p) => p.cartItemId !== cartItemId));
            toast.info(`${produtoNoCarrinho.nome} removido do carrinho.`);
        } else {
            setCarrinho(carrinho.map((p) => (p.cartItemId === cartItemId ? { ...p, qtd: p.qtd - 1 } : p)));
        }
    };
    const handleApplyCoupon = async () => {
        if (!currentUser) { toast.warn('Você precisa estar logado para aplicar um cupom.'); return; }
        if (!couponCodeInput.trim()) { toast.warn('Por favor, digite o código do cupom.'); return; }
        setCouponLoading(true); setAppliedCoupon(null); setDiscountAmount(0);
        try {
            const couponsRef = collection(db, 'estabelecimentos', actualEstabelecimentoId, 'cupons');
            const q = query(couponsRef, where('codigo', '==', couponCodeInput.toUpperCase().trim()));
            const couponSnap = await getDocs(q);
            if (couponSnap.empty) { toast.error('Cupom inválido ou não encontrado.'); setCouponLoading(false); return; }
            const couponDoc = couponSnap.docs[0];
            const couponData = { id: couponDoc.id, ...couponDoc.data() };
            const now = Timestamp.now();
            if (!couponData.ativo) { toast.error('Cupom inativo.'); setCouponLoading(false); return; }
            if (couponData.validadeInicio && couponData.validadeInicio.seconds > now.seconds) { toast.error('Cupom ainda não válido.'); setCouponLoading(false); return; }
            if (couponData.validadeFim && couponData.validadeFim.seconds < now.seconds) { toast.error('Cupom expirado.'); setCouponLoading(false); return; }
            if (couponData.usosMaximos !== null && couponData.usosAtuais >= couponData.usosMaximos) { toast.error('Cupom atingiu o limite máximo de usos.'); setCouponLoading(false); return; }
            if (couponData.minimoPedido !== null && subtotalCalculado < couponData.minimoPedido) { toast.error(`Pedido mínimo de R$ ${couponData.minimoPedido.toFixed(2).replace('.', ',')} para usar este cupom.`); setCouponLoading(false); return; }

            let calculatedDiscount = 0;
            if (couponData.tipoDesconto === 'percentual') { calculatedDiscount = subtotalCalculado * (couponData.valorDesconto / 100); }
            else if (couponData.tipoDesconto === 'valorFixo') { calculatedDiscount = couponData.valorDesconto; if (calculatedDiscount > subtotalCalculado) { calculatedDiscount = subtotalCalculado; } }
            else if (couponData.tipoDesconto === 'freteGratis') { calculatedDiscount = taxaAplicada; }
            setAppliedCoupon(couponData); setDiscountAmount(calculatedDiscount);
            toast.success(`Cupom ${couponData.codigo} aplicado! Desconto de R$ ${calculatedDiscount.toFixed(2).replace('.', ',')}.`);
            setCouponLoading(false);
        } catch (error) {
            console.error("Erro ao aplicar cupom:", error); toast.error('Erro ao aplicar cupom. Tente novamente.');
            setCouponLoading(false); setAppliedCoupon(null); setDiscountAmount(0);
        }
    };
    const removeAppliedCoupon = () => {
        setAppliedCoupon(null); setDiscountAmount(0); setCouponCodeInput(''); toast.info('Cupom removido.');
    };
    const enviarPedido = async () => {
        if (!currentUser) { toast.warn('Você precisa estar logado para enviar um pedido.'); setShowLoginPrompt(true); return; }
        if (!actualEstabelecimentoId) { toast.error('Erro: Estabelecimento não carregado corretamente. Por favor, recarregue a página.'); return; }
        if (!nomeCliente.trim() || !telefoneCliente.trim() || carrinho.length === 0 || !formaPagamento) { toast.warn('Por favor, preencha todos os seus dados (Nome, Telefone), adicione itens ao carrinho e selecione uma forma de pagamento.'); return; }
        if (!isRetirada && (!rua.trim() || !numero.trim() || !bairro.trim() || !cidade.trim())) { toast.warn('Para entrega, por favor, preencha o endereço completo (Rua, Número, Bairro, Cidade).'); return; }
        if (!isRetirada && bairroNaoEncontrado && taxaEntregaCalculada === 0) {
            const confirmacao = window.confirm(`O bairro "${bairro.trim()}" não foi encontrado na nossa lista de áreas de entrega e a taxa é R$ 0,00. Deseja continuar? (Podem ser aplicadas taxas adicionais na entrega)`);
            if (!confirmacao) { return; }
        }
        let valorTrocoPara = null;
        if (formaPagamento === 'dinheiro' && trocoPara.trim() !== '') {
            const trocoNum = Number(trocoPara);
            if (trocoNum > finalOrderTotal) { valorTrocoPara = trocoNum; }
            else { toast.warn(`O valor para troco (R$ ${trocoNum.toFixed(2).replace('.', ',')}) deve ser maior que o total do pedido (R$ ${finalOrderTotal.toFixed(2).replace('.', ',')}).`); return; }
        }
        const pedido = {
            cliente: { nome: nomeCliente.trim(), telefone: telefoneCliente.trim(), endereco: isRetirada ? null : { rua: rua.trim(), numero: numero.trim(), bairro: bairro.trim(), cidade: cidade.trim(), complemento: complemento.trim() || null }, userId: currentUser.uid },
            estabelecimentoId: actualEstabelecimentoId,
            itens: carrinho.map(item => ({ nome: item.nome, quantidade: item.qtd, preco: Number(item.precoFinal), imageUrl: item.imageUrl || null, adicionais: item.adicionais || [] })),
            status: 'recebido',
            createdAt: serverTimestamp(),
            tipo: isRetirada ? 'retirada' : 'delivery',
            formaPagamento: formaPagamento,
            trocoPara: valorTrocoPara,
            taxaEntrega: taxaAplicada,
            totalFinal: finalOrderTotal,
            ...(formaPagamento === 'pix' && { statusPagamentoPix: 'aguardando_pagamento', }),
            ...(appliedCoupon && { cupomAplicado: { id: appliedCoupon.id, codigo: appliedCoupon.codigo, tipoDesconto: appliedCoupon.tipoDesconto, valorDesconto: appliedCoupon.valorDesconto, descontoCalculado: discountAmount } })
        };
        try {
            if (appliedCoupon) {
                await runTransaction(db, async (transaction) => {
                    const couponRef = doc(db, 'estabelecimentos', actualEstabelecimentoId, 'cupons', appliedCoupon.id);
                    const couponSnap = await transaction.get(couponRef);
                    if (!couponSnap.exists()) { throw new Error("Cupom não existe mais!"); }
                    const currentUsosAtuais = couponSnap.data().usosAtuais || 0;
                    if (couponSnap.data().usosMaximos !== null && currentUsosAtuais >= couponSnap.data().usosMaximos) { throw new Error("Cupom já atingiu o limite total de usos."); }
                    transaction.update(couponRef, { usosAtuais: currentUsosAtuais + 1 });
                });
            }
            const docRef = await addDoc(collection(db, 'pedidos'), pedido);
            setConfirmedOrderDetails({
                id: docRef.id, cliente: pedido.cliente, itens: pedido.itens, subtotal: subtotalCalculado, taxaEntrega: taxaAplicada, totalFinal: finalOrderTotal, formaPagamento: formaPagamento, trocoPara: valorTrocoPara, tipoEntrega: pedido.tipo, cupomAplicado: appliedCoupon ? { codigo: appliedCoupon.codigo, desconto: discountAmount } : null
            });
            setShowOrderConfirmationModal(true);
            toast.success('Seu pedido foi enviado com sucesso! 🎉');
            setCarrinho([]); setFormaPagamento(''); setTrocoPara(''); setCouponCodeInput(''); setAppliedCoupon(null); setDiscountAmount(0);
        } catch (error) {
            console.error("Erro ao enviar pedido ou aplicar cupom (transação): ", error);
            if (error.message && (error.message.includes("limite total de usos") || error.message.includes("Cupom não existe mais"))) { toast.error(`❌ Erro no cupom: ${error.message}`); }
            else { toast.error(`❌ Ocorreu um erro ao enviar seu pedido. Por favor, tente novamente.`); }
        }
    };
    const handleLoginModal = async (e) => {
        e.preventDefault(); setErrorAuthModal('');
        try {
            await signInWithEmailAndPassword(auth, emailAuthModal, passwordAuthModal);
            toast.success('Login realizado com sucesso!');
            setShowLoginPrompt(false); setIsRegisteringInModal(false); setEmailAuthModal(''); setPasswordAuthModal(''); setErrorAuthModal('');
        } catch (error) {
            let msg = "Erro no login. Verifique suas credenciais.";
            if (error.code === 'auth/user-not-found') msg = "Usuário não encontrado. Crie uma conta.";
            else if (error.code === 'auth/wrong-password') msg = "Senha incorreta.";
            setErrorAuthModal(msg); toast.error(msg);
        }
    };
    const handleRegisterModal = async (e) => {
        e.preventDefault(); setErrorAuthModal('');
        if (!nomeAuthModal.trim() || !telefoneAuthModal.trim() || !emailAuthModal.trim() || !passwordAuthModal.trim() || !ruaAuthModal.trim() || !numeroAuthModal.trim() || !bairroAuthModal.trim() || !cidadeAuthModal.trim()) {
            setErrorAuthModal('Por favor, preencha todos os campos obrigatórios, incluindo o endereço completo.');
            toast.error('Por favor, preencha todos os campos obrigatórios, incluindo o endereço completo.'); return;
        }
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, emailAuthModal, passwordAuthModal);
            const user = userCredential.user;
            await setDocFirestore(doc(db, 'clientes', user.uid), {
                nome: nomeAuthModal.trim(), telefone: telefoneAuthModal.trim(), email: emailAuthModal.trim(),
                endereco: { rua: ruaAuthModal.trim(), numero: numeroAuthModal.trim(), bairro: bairroAuthModal.trim(), cidade: cidadeAuthModal.trim(), complemento: complementoAuthModal.trim() || null },
                criadoEm: Timestamp.now(),
            });

            // --- INÍCIO DA CORREÇÃO ---
            // Preenche o formulário principal com os dados que acabaram de ser cadastrados.
            setNomeCliente(nomeAuthModal.trim());
            setTelefoneCliente(telefoneAuthModal.trim());
            setRua(ruaAuthModal.trim());
            setNumero(numeroAuthModal.trim());
            setBairro(bairroAuthModal.trim());
            setCidade(cidadeAuthModal.trim());
            setComplemento(complementoAuthModal.trim() || null);
            setIsRetirada(false); // Acabou de preencher endereço, então não é retirada
            // --- FIM DA CORREÇÃO ---

            toast.success('Cadastro realizado com sucesso! Você está logado.');
            setShowLoginPrompt(false); setIsRegisteringInModal(false); setEmailAuthModal(''); setPasswordAuthModal(''); setNomeAuthModal(''); setTelefoneAuthModal(''); setRuaAuthModal(''); setNumeroAuthModal(''); setBairroAuthModal(''); setCidadeAuthModal(''); setComplementoAuthModal(''); setErrorAuthModal('');
        } catch (error) {
            let msg = "Erro no cadastro. Tente novamente.";
            if (error.code === 'auth/email-already-in-use') msg = "Este email já está cadastrado.";
            else if (error.code === 'auth/weak-password') msg = "Senha muito fraca (mín. 6 caracteres).";
            setErrorAuthModal(msg); toast.error(msg);
        }
    };

    // --- EFEITOS (useEffect) ---
    useEffect(() => {
        const handler = setTimeout(() => { setDebouncedSearchTerm(searchTerm); }, 300);
        return () => { clearTimeout(handler); };
    }, [searchTerm]);

    useEffect(() => {
        if (authLoading === false) {
            setShowLoginPrompt(currentUser === null);
        }
    }, [authLoading, currentUser]);

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
                setIsRetirada(false);
            } else {
                setIsRetirada(true);
            }
        }
    }, [currentUser, currentClientData, authLoading]);

    useEffect(() => {
        if (!actualEstabelecimentoId) return;
        const taxasRef = collection(db, 'estabelecimentos', actualEstabelecimentoId, 'taxasDeEntrega');
        const q = query(taxasRef, orderBy('nomeBairro'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setTaxasBairro(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
        });
        return () => unsubscribe();
    }, [actualEstabelecimentoId]);

    useEffect(() => {
        if (isRetirada || !bairro.trim() || !cidade.trim()) {
            setTaxaEntregaCalculada(0);
            setBairroNaoEncontrado(false);
            return;
        }
        const bairroEncontrado = taxasBairro.find((taxa) => taxa.nomeBairro.toLowerCase() === bairro.trim().toLowerCase());
        if (bairroEncontrado) {
            setTaxaEntregaCalculada(bairroEncontrado.valorTaxa);
            setBairroNaoEncontrado(false);
        } else {
            setTaxaEntregaCalculada(0);
            setBairroNaoEncontrado(true);
        }
    }, [bairro, cidade, taxasBairro, isRetirada]);

    useEffect(() => {
        if (!estabelecimentoSlug) return;
        let unsubscribeCardapio = () => { };

        const fetchEstabelecimento = async () => {
            try {
                const qEstab = query(collection(db, 'estabelecimentos'), where('slug', '==', estabelecimentoSlug));
                const estabSnapshot = await getDocs(qEstab);

                if (estabSnapshot.empty) {
                    setNomeEstabelecimento("Estabelecimento não encontrado.");
                    setAllProdutos([]);
                    return;
                }

                const estabDoc = estabSnapshot.docs[0];
                const estabData = estabDoc.data();
                const idDoEstabelecimentoReal = estabDoc.id;

                if (!estabData.ativo) {
                    setNomeEstabelecimento(`${estabData.nome} (Inativo)`);
                    setAllProdutos([]);
                    return;
                }

                setEstabelecimentoInfo(estabData);
                setNomeEstabelecimento(estabData.nome || "Cardápio");
                setActualEstabelecimentoId(idDoEstabelecimentoReal);

                const categoriasRef = collection(db, 'estabelecimentos', idDoEstabelecimentoReal, 'cardapio');
                const qCategorias = query(categoriasRef, orderBy('ordem', 'asc'));

                unsubscribeCardapio = onSnapshot(qCategorias, async (categoriasSnapshot) => {
                    const categoriesList = ['Todos'];
                    const allItems = [];
                    const initialVisibleCounts = {};

                    for (const catDoc of categoriasSnapshot.docs) {
                        const categoriaData = catDoc.data();
                        const itensRef = collection(db, 'estabelecimentos', idDoEstabelecimentoReal, 'cardapio', catDoc.id, 'itens');
                        const qItens = query(itensRef, where('ativo', '==', true), orderBy('nome', 'asc'));
                        const itensSnapshot = await getDocs(qItens);
                        const itemsDaCategoria = itensSnapshot.docs.map(itemDoc => ({
                            ...itemDoc.data(),
                            id: itemDoc.id,
                            categoria: categoriaData.nome
                        }));

                        if (itemsDaCategoria.length > 0) {
                            categoriesList.push(categoriaData.nome);
                            initialVisibleCounts[categoriaData.nome] = 3;
                            allItems.push(...itemsDaCategoria);
                        }
                    }
                    
                    setAvailableCategories(categoriesList);
                    setVisibleItemsCount(initialVisibleCounts);
                    setAllProdutos(allItems);

                }, (error) => {
                    console.error("Erro ao carregar cardápio em tempo real:", error);
                    toast.error("Erro ao atualizar o cardápio.");
                });
            } catch (error) {
                console.error("Erro ao carregar o estabelecimento:", error);
                toast.error("Não foi possível carregar o estabelecimento.");
            }
        };

        fetchEstabelecimento();
        return () => unsubscribeCardapio();
    }, [estabelecimentoSlug]);

    useEffect(() => {
        let produtosProcessados = [...allProdutos];
        if (selectedCategory && selectedCategory !== 'Todos') {
            produtosProcessados = produtosProcessados.filter(item => item.categoria?.toLowerCase() === selectedCategory.toLowerCase());
        }
        if (debouncedSearchTerm.trim() !== '') {
            const lowerCaseSearchTerm = debouncedSearchTerm.trim().toLowerCase();
            produtosProcessados = produtosProcessados.filter(item =>
                item.nome?.toLowerCase().includes(lowerCaseSearchTerm) ||
                item.descricao?.toLowerCase().includes(lowerCaseSearchTerm)
            );
        }
        produtosProcessados.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        setProdutosFiltrados(produtosProcessados);
    }, [allProdutos, selectedCategory, debouncedSearchTerm]);

    useEffect(() => {
        const storedReorderItems = localStorage.getItem('reorderItems');
        if (storedReorderItems) {
            try {
                const parsedItems = JSON.parse(storedReorderItems);
                if (Array.isArray(parsedItems) && parsedItems.length > 0) {
                    setCarrinho(parsedItems);
                    toast.success('Seu pedido anterior foi carregado no carrinho!');
                }
            } catch (e) {
                console.error("Erro ao parsear reorderItems:", e);
            } finally {
                localStorage.removeItem('reorderItems');
            }
        }
    }, []);

    useEffect(() => {
        if (!authLoading && (isAdmin || isMasterAdmin)) {
            toast.error('Acesso negado. Esta página é exclusiva para clientes.', { toastId: 'admin-redirect' });
        }
    }, [authLoading, isAdmin, isMasterAdmin]);


    if (authLoading) {
        return (<div className="flex justify-center items-center h-screen"><p>Verificando status de login...</p></div>);
    }

    if (isAdmin || isMasterAdmin) {
        return <Navigate to={isMasterAdmin ? '/master-dashboard' : '/painel'} replace />;
    }

    return (
        <div className="p-4 max-w-3xl mx-auto pb-48 md:pb-0">
            <h1 className="text-3xl font-bold text-center text-[var(--vermelho-principal)] mb-4">
                Cardápio de {nomeEstabelecimento}
            </h1>
            {estabelecimentoInfo?.descricao && (
                <p className="text-center text-[var(--cinza-texto)] mb-8">{estabelecimentoInfo.descricao}</p>
            )}

            <div className="mb-8 p-4 bg-white rounded-lg shadow-md border border-gray-200">
                <div className="mb-4">
                    <input type="text" placeholder="Buscar por nome ou descrição..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                    {availableCategories.map((category) => (<button key={category} onClick={() => setSelectedCategory(category)} className={`px-4 py-2 rounded-full text-sm font-semibold ${selectedCategory === category ? 'bg-[var(--vermelho-principal)] text-black' : 'bg-gray-200'}`} > {category} </button>))}
                    {(searchTerm || selectedCategory !== 'Todos') && (<button onClick={() => { setSearchTerm(''); setSelectedCategory('Todos'); }} className="px-4 py-2 rounded-full text-sm font-semibold bg-gray-400" > Limpar Filtros </button>)}
                </div>
            </div>

            {(() => {
                const menuAgrupado = produtosFiltrados.reduce((acc, produto) => {
                    const categoria = produto.categoria || 'Outros';
                    if (!acc[categoria]) acc[categoria] = [];
                    acc[categoria].push(produto);
                    return acc;
                }, {});
                if (produtosFiltrados.length === 0 && allProdutos.length > 0) {
                    return <p className="text-center italic mt-8">Nenhum item encontrado com os filtros selecionados.</p>;
                }
                if (allProdutos.length === 0 && nomeEstabelecimento !== "Carregando Cardápio..." && nomeEstabelecimento !== "Estabelecimento não encontrado.") {
                    return <p className="text-center italic mt-8">Este estabelecimento ainda não possui itens no cardápio.</p>;
                }
                return Object.keys(menuAgrupado).sort().map(categoria => {
                    const itemsNestaCategoria = menuAgrupado[categoria];
                    const totalItemsVisiveis = visibleItemsCount[categoria] || 3;
                    const todosItensVisiveis = totalItemsVisiveis >= itemsNestaCategoria.length;
                    return (
                        <div key={categoria} className="mt-8">
                            <h2 className="text-2xl font-bold mb-4 text-[var(--marrom-escuro)] border-b-2 border-[var(--vermelho-principal)] pb-2">{categoria}</h2>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {itemsNestaCategoria.slice(0, totalItemsVisiveis).map((item) => (
                                    <CardapioItem key={item.id} item={item} onAddItem={handleAbrirModalAdicionais} />
                                ))}
                            </div>
                            {itemsNestaCategoria.length > 3 && (
                                <div className="text-center mt-6">
                                    {todosItensVisiveis ? (
                                        <button onClick={() => handleShowLess(categoria)} className="bg-gray-200 font-semibold py-2 px-6 rounded-lg">Ver menos</button>
                                    ) : (
                                        <button onClick={() => handleShowMore(categoria)} className="border-2 border-[var(--vermelho-principal)] text-[var(--vermelho-principal)] font-semibold py-2 px-6 rounded-lg hover:bg-[var(--vermelho-principal)] hover:text-white">Ver mais</button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                });
            })()}

            <div className="bg-white p-6 mt-10 rounded-lg shadow-xl border border-gray-200">
                <h2 className="font-bold text-2xl mb-4 text-[var(--marrom-escuro)]">Seu Pedido</h2>
                {carrinho.length === 0 ? (<p className="text-gray-500 italic text-center py-4">🛒 Nenhum item adicionado ainda.</p>) : (
                    <>
                        <ul className="mb-4 space-y-3">
                            {carrinho.map((item) => (
                                <li key={item.cartItemId} className="bg-gray-50 p-3 rounded-md border">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 mr-2">
                                            <span className="font-medium">{item.nome} <span className="text-sm text-gray-500">({item.qtd}x)</span></span>
                                            {item.adicionais && item.adicionais.length > 0 && (<div className="text-xs text-gray-500 pl-2 mt-1">{item.adicionais.map(ad => `+ ${ad.nome}`).join(', ')}</div>)}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => removerDoCarrinho(item.cartItemId)} className="bg-red-500 text-white w-7 h-7 rounded-full flex items-center justify-center font-bold">-</button>
                                            <span className="font-semibold">R$ {(item.precoFinal * item.qtd).toFixed(2).replace('.', ',')}</span>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <div className="border-t pt-4 mt-4">
                            <div className="flex justify-between items-center text-lg mb-1"><span>Subtotal:</span><span>R$ {subtotalCalculado.toFixed(2).replace('.', ',')}</span></div>
                            {!isRetirada && (<div className="flex justify-between items-center text-lg mb-2"><span>Taxa de Entrega:</span><span>R$ {taxaAplicada.toFixed(2).replace('.', ',')}</span></div>)}
                            {!appliedCoupon ? (
                                <div className="flex items-center gap-2 pt-4 border-t mt-4">
                                    <input type="text" placeholder="Código do Cupom" value={couponCodeInput} onChange={(e) => setCouponCodeInput(e.target.value)} className="flex-1 border rounded-md px-3 py-2" disabled={couponLoading} />
                                    <button onClick={handleApplyCoupon} className="bg-blue-500 text-white px-4 py-2 rounded-md font-semibold" disabled={couponLoading || !couponCodeInput.trim()}>{couponLoading ? 'Aplicando...' : 'Aplicar'}</button>
                                </div>
                            ) : (
                                <div className="flex justify-between items-center bg-green-50 p-2 rounded-md mt-4 border-t pt-4">
                                    <p className="text-green-800 font-semibold">Cupom: {appliedCoupon.codigo}</p>
                                    <button onClick={removeAppliedCoupon} className="text-red-600 text-sm">Remover</button>
                                </div>
                            )}
                            {discountAmount > 0 && (<div className="flex justify-between items-center text-lg mt-2 text-green-700"><span>Desconto:</span><span>- R$ {discountAmount.toFixed(2).replace('.', ',')}</span></div>)}
                            <div className="flex justify-between items-center text-2xl font-bold mt-4"><span>TOTAL:</span><span>R$ {finalOrderTotal.toFixed(2).replace('.', ',')}</span></div>
                        </div>
                    </>
                )}
            </div>

            <div className="bg-white p-6 mt-6 rounded-lg shadow-xl border border-gray-200">
                <h3 className="font-bold text-xl mb-3">Seus Dados</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label htmlFor="nomeCliente" className="block text-sm font-medium mb-1">Seu Nome *</label><input id="nomeCliente" value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} className="w-full border rounded-md px-3 py-2" required /></div>
                    <div><label htmlFor="telefoneCliente" className="block text-sm font-medium mb-1">Seu Telefone *</label><input id="telefoneCliente" value={telefoneCliente} onChange={(e) => setTelefoneCliente(e.target.value)} className="w-full border rounded-md px-3 py-2" type="tel" required /></div>
                </div>
                <div className="mt-6 pt-4 border-t">
                    <h3 className="font-bold text-xl mb-3">Tipo de Entrega *</h3>
                    <div className="flex gap-4"><label className="flex items-center cursor-pointer"><input type="radio" name="deliveryType" checked={isRetirada} onChange={() => setIsRetirada(true)} className="mr-2" /> Retirada</label><label className="flex items-center cursor-pointer"><input type="radio" name="deliveryType" checked={!isRetirada} onChange={() => setIsRetirada(false)} className="mr-2" /> Entrega</label></div>
                </div>
                {!isRetirada && (
                    <div className="mt-4 pt-4 border-t">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2"><label htmlFor="rua" className="block text-sm font-medium mb-1">Rua *</label><input id="rua" value={rua} onChange={(e) => setRua(e.target.value)} className="w-full border rounded-md px-3 py-2" required={!isRetirada} /></div>
                            <div><label htmlFor="numero" className="block text-sm font-medium mb-1">Número *</label><input id="numero" value={numero} onChange={(e) => setNumero(e.target.value)} className="w-full border rounded-md px-3 py-2" required={!isRetirada} /></div>
                            <div><label htmlFor="bairro" className="block text-sm font-medium mb-1">Bairro *</label><input id="bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} className="w-full border rounded-md px-3 py-2" required={!isRetirada} /></div>
                            <div className="md:col-span-2"><label htmlFor="cidade" className="block text-sm font-medium mb-1">Cidade *</label><input id="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} className="w-full border rounded-md px-3 py-2" required={!isRetirada} /></div>
                            <div className="md:col-span-2"><label htmlFor="complemento" className="block text-sm font-medium mb-1">Complemento</label><input id="complemento" value={complemento} onChange={(e) => setComplemento(e.target.value)} className="w-full border rounded-md px-3 py-2" /></div>
                        </div>
                        {bairroNaoEncontrado && <p className="text-red-500 text-sm mt-2">Bairro não atendido para entrega.</p>}
                    </div>
                )}
                <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="font-bold text-xl mb-3 text-[var(--marrom-escuro)]">Forma de Pagamento *</h3>
                    <div className="space-y-3">
                        <label className="flex items-center text-base text-[var(--cinza-texto)] cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                            <input type="radio" name="paymentMethod" value="pix" checked={formaPagamento === 'pix'} onChange={(e) => setFormaPagamento(e.target.value)} className="mr-3 h-5 w-5 text-[var(--vermelho-principal)] focus:ring-[var(--vermelho-principal)]" />
                            PIX
                        </label>
                        <label className="flex items-center text-base text-[var(--cinza-texto)] cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                            <input type="radio" name="paymentMethod" value="cartao" checked={formaPagamento === 'cartao'} onChange={(e) => setFormaPagamento(e.target.value)} className="mr-3 h-5 w-5 text-[var(--vermelho-principal)] focus:ring-[var(--vermelho-principal)]" />
                            Cartão (Crédito/Débito na entrega)
                        </label>
                        <label className="flex items-center text-base text-[var(--cinza-texto)] cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                            <input type="radio" name="paymentMethod" value="dinheiro" checked={formaPagamento === 'dinheiro'} onChange={(e) => setFormaPagamento(e.target.value)} className="mr-3 h-5 w-5 text-[var(--vermelho-principal)] focus:ring-[var(--vermelho-principal)]" />
                            Dinheiro
                        </label>
                    </div>
                    {formaPagamento === 'dinheiro' && (
                        <div className="mt-4">
                            <label htmlFor="troco" className="block text-sm font-medium text-[var(--cinza-texto)] mb-1">Precisa de troco para? (Opcional)</label>
                            <input id="troco" type="number" value={trocoPara} onChange={(e) => setTrocoPara(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2" placeholder={`Ex: R$ ${(finalOrderTotal + 10).toFixed(2).replace('.', ',')}`} />
                        </div>
                    )}
                </div>
            </div>

            {carrinho.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white p-4 md:relative md:p-0 md:mt-8">
                    <button onClick={enviarPedido} disabled={!currentUser || !nomeCliente.trim() || !telefoneCliente.trim() || !formaPagamento || (!isRetirada && (!rua.trim() || !numero.trim() || !bairro.trim() || !cidade.trim()))} className="w-full px-6 py-3 rounded-lg font-semibold text-lg disabled:bg-gray-400 disabled:cursor-not-allowed bg-green-600 text-white hover:bg-green-700">
                        Enviar Pedido Agora!
                    </button>
                </div>
            )}

            {showOrderConfirmationModal && confirmedOrderDetails && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]"><div className="bg-white rounded-lg p-6 max-w-sm w-full"><h2 className="text-2xl font-bold mb-4 text-center">Pedido Enviado! 🎉</h2><p><strong>ID:</strong> {confirmedOrderDetails.id.substring(0, 8)}...</p><p><strong>Total:</strong> R$ {confirmedOrderDetails.totalFinal.toFixed(2).replace('.', ',')}</p><button onClick={() => setShowOrderConfirmationModal(false)} className="w-full mt-4 bg-green-500 text-white py-2 rounded">Fechar</button></div></div>)}
            
            {showLoginPrompt && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[1000]">
                    <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full relative text-center">
                        <button 
                            onClick={() => { setShowLoginPrompt(false); }} 
                            className="absolute top-2 right-3 text-gray-600 hover:text-red-600 text-2xl font-bold" 
                            aria-label="Fechar"
                        >
                            &times;
                        </button>
                        <h2 className="text-2xl font-bold text-[var(--vermelho-principal)] mb-4">
                            {isRegisteringInModal ? 'Cadastre-se' : 'Faça Login'}
                        </h2>
                        <p className="text-gray-700 mb-6">
                            {isRegisteringInModal ? 'Preencha seus dados para criar uma conta.' : 'Para acessar o cardápio e fazer pedidos, você precisa estar logado.'}
                        </p>
                        {errorAuthModal && <p className="text-red-500 text-sm mb-4">{errorAuthModal}</p>}
                        {isRegisteringInModal ? (
                            <form onSubmit={handleRegisterModal} className="space-y-4 text-left">
                                <input type="text" placeholder="Seu Nome Completo *" className="w-full border rounded p-2" value={nomeAuthModal} onChange={(e) => setNomeAuthModal(e.target.value)} required />
                                <input type="tel" placeholder="Seu Telefone (com DDD) *" className="w-full border rounded p-2" value={telefoneAuthModal} onChange={(e) => setTelefoneAuthModal(e.target.value)} required />
                                <input type="email" placeholder="Email *" className="w-full border rounded p-2" value={emailAuthModal} onChange={(e) => setEmailAuthModal(e.target.value)} required />
                                <input type="password" placeholder="Senha (mín. 6 caracteres) *" className="w-full border rounded p-2" value={passwordAuthModal} onChange={(e) => setPasswordAuthModal(e.target.value)} required />
                                <input type="text" placeholder="Rua *" className="w-full border rounded p-2" value={ruaAuthModal} onChange={(e) => setRuaAuthModal(e.target.value)} required />
                                <input type="text" placeholder="Número *" className="w-full border rounded p-2" value={numeroAuthModal} onChange={(e) => setNumeroAuthModal(e.target.value)} required />
                                <input type="text" placeholder="Bairro *" className="w-full border rounded p-2" value={bairroAuthModal} onChange={(e) => setBairroAuthModal(e.gexgett.value)} required />
                                <input type="text" placeholder="Cidade *" className="w-full border rounded p-2" value={cidadeAuthModal} onChange={(e) => setCidadeAuthModal(e.target.value)} required />
                                <input type="text" placeholder="Complemento (Opcional)" className="w-full border rounded p-2" value={complementoAuthModal} onChange={(e) => setComplementoAuthModal(e.target.value)} />
                                <button type="submit" className="w-full bg-[var(--vermelho-principal)] text-black font-semibold py-2 rounded hover:bg-red-700 transition-colors">Cadastrar e Entrar</button>
                                <p className="text-sm text-center text-gray-600">Já tem uma conta?{' '}
                                    <button type="button" onClick={() => setIsRegisteringInModal(false)} className="text-[var(--vermelho-principal)] underline font-semibold">Fazer Login</button>
                                </p>
                            </form>
                        ) : (
                            <form onSubmit={handleLoginModal} className="space-y-4">
                                <input type="email" placeholder="Email" className="w-full border rounded p-2" value={emailAuthModal} onChange={(e) => setEmailAuthModal(e.target.value)} required />
                                <input type="password" placeholder="Senha" className="w-full border rounded p-2" value={passwordAuthModal} onChange={(e) => setPasswordAuthModal(e.target.value)} required />
                                <button type="submit" className="w-full bg-green-500 text-white font-semibold py-2 rounded hover:bg-green-600 transition-colors">Entrar</button>
                                <p className="text-sm text-gray-600">Não tem uma conta?{' '}
                                    <button type="button" onClick={() => setIsRegisteringInModal(true)} className="text-[var(--vermelho-principal)] underline font-semibold">Cadastre-se</button>
                                </p>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {itemParaAdicionais && (<AdicionaisModal item={itemParaAdicionais} onConfirm={handleConfirmarAdicionais} onClose={handleFecharModal} />)}
        </div>
    );
}

export default Menu;