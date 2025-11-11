// src/pages/Menu.jsx - (VERSÃO CORRIGIDA - CORES AMARELO/PRETO/CINZA)
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
    const { currentUser, currentClientData, loading: authLoading, isAdmin, isMasterAdmin, userData } = useAuth();

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
    const [loading, setLoading] = useState(true);

    // --- CÁLCULOS ---
    const subtotalCalculado = useMemo(() => carrinho.reduce((acc, item) => acc + (item.precoFinal * item.qtd), 0), [carrinho]);
    const taxaAplicada = isRetirada ? 0 : taxaEntregaCalculada;
    const finalOrderTotal = useMemo(() => Math.max(0, subtotalCalculado + taxaAplicada - discountAmount), [subtotalCalculado, taxaAplicada, discountAmount]);

    // 🔧 CORREÇÃO: Verificar se o usuário é admin baseado na estrutura correta
    const isUserAdmin = useMemo(() => {
        return userData?.isAdmin || false;
    }, [userData]);

    const isUserMasterAdmin = useMemo(() => {
        return userData?.isMasterAdmin || false;
    }, [userData]);

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
        if (!currentUser) { 
            toast.warn('Você precisa estar logado para aplicar um cupom.'); 
            return; 
        }
        if (!couponCodeInput.trim()) { 
            toast.warn('Por favor, digite o código do cupom.'); 
            return; 
        }
        setCouponLoading(true); 
        setAppliedCoupon(null); 
        setDiscountAmount(0);
        try {
            const couponsRef = collection(db, 'estabelecimentos', actualEstabelecimentoId, 'cupons');
            const q = query(couponsRef, where('codigo', '==', couponCodeInput.toUpperCase().trim()));
            const couponSnap = await getDocs(q);
            if (couponSnap.empty) { 
                toast.error('Cupom inválido ou não encontrado.'); 
                setCouponLoading(false); 
                return; 
            }
            const couponDoc = couponSnap.docs[0];
            const couponData = { id: couponDoc.id, ...couponDoc.data() };
            const now = Timestamp.now();
            if (!couponData.ativo) { 
                toast.error('Cupom inativo.'); 
                setCouponLoading(false); 
                return; 
            }
            if (couponData.validadeInicio && couponData.validadeInicio.seconds > now.seconds) { 
                toast.error('Cupom ainda não válido.'); 
                setCouponLoading(false); 
                return; 
            }
            if (couponData.validadeFim && couponData.validadeFim.seconds < now.seconds) { 
                toast.error('Cupom expirado.'); 
                setCouponLoading(false); 
                return; 
            }
            if (couponData.usosMaximos !== null && couponData.usosAtuais >= couponData.usosMaximos) { 
                toast.error('Cupom atingiu o limite máximo de usos.'); 
                setCouponLoading(false); 
                return; 
            }
            if (couponData.minimoPedido !== null && subtotalCalculado < couponData.minimoPedido) { 
                toast.error(`Pedido mínimo de R$ ${couponData.minimoPedido.toFixed(2).replace('.', ',')} para usar este cupom.`); 
                setCouponLoading(false); 
                return; 
            }

            let calculatedDiscount = 0;
            if (couponData.tipoDesconto === 'percentual') { 
                calculatedDiscount = subtotalCalculado * (couponData.valorDesconto / 100); 
            }
            else if (couponData.tipoDesconto === 'valorFixo') { 
                calculatedDiscount = couponData.valorDesconto; 
                if (calculatedDiscount > subtotalCalculado) { 
                    calculatedDiscount = subtotalCalculado; 
                } 
            }
            else if (couponData.tipoDesconto === 'freteGratis') { 
                calculatedDiscount = taxaAplicada; 
            }
            setAppliedCoupon(couponData); 
            setDiscountAmount(calculatedDiscount);
            toast.success(`Cupom ${couponData.codigo} aplicado! Desconto de R$ ${calculatedDiscount.toFixed(2).replace('.', ',')}.`);
            setCouponLoading(false);
        } catch (error) {
            console.error("Erro ao aplicar cupom:", error); 
            toast.error('Erro ao aplicar cupom. Tente novamente.');
            setCouponLoading(false); 
            setAppliedCoupon(null); 
            setDiscountAmount(0);
        }
    };

    const removeAppliedCoupon = () => {
        setAppliedCoupon(null); 
        setDiscountAmount(0); 
        setCouponCodeInput(''); 
        toast.info('Cupom removido.');
    };

    const enviarPedido = async () => {
        if (!currentUser) { 
            toast.warn('Você precisa estar logado para enviar um pedido.'); 
            setShowLoginPrompt(true); 
            return; 
        }
        if (!actualEstabelecimentoId) { 
            toast.error('Erro: Estabelecimento não carregado corretamente. Por favor, recarregue a página.'); 
            return; 
        }
        if (!nomeCliente.trim() || !telefoneCliente.trim() || carrinho.length === 0 || !formaPagamento) { 
            toast.warn('Por favor, preencha todos os seus dados (Nome, Telefone), adicione itens ao carrinho e selecione uma forma de pagamento.'); 
            return; 
        }
        if (!isRetirada && (!rua.trim() || !numero.trim() || !bairro.trim() || !cidade.trim())) { 
            toast.warn('Para entrega, por favor, preencha o endereço completo (Rua, Número, Bairro, Cidade).'); 
            return; 
        }
        if (!isRetirada && bairroNaoEncontrado && taxaEntregaCalculada === 0) {
            const confirmacao = window.confirm(`O bairro "${bairro.trim()}" não foi encontrado na nossa lista de áreas de entrega e a taxa é R$ 0,00. Deseja continuar? (Podem ser aplicadas taxas adicionais na entrega)`);
            if (!confirmacao) { 
                return; 
            }
        }
        let valorTrocoPara = null;
        if (formaPagamento === 'dinheiro' && trocoPara.trim() !== '') {
            const trocoNum = Number(trocoPara);
            if (trocoNum > finalOrderTotal) { 
                valorTrocoPara = trocoNum; 
            }
            else { 
                toast.warn(`O valor para troco (R$ ${trocoNum.toFixed(2).replace('.', ',')}) deve ser maior que o total do pedido (R$ ${finalOrderTotal.toFixed(2).replace('.', ',')}).`); 
                return; 
            }
        }
        const pedido = {
            cliente: { 
                nome: nomeCliente.trim(), 
                telefone: telefoneCliente.trim(), 
                endereco: isRetirada ? null : { 
                    rua: rua.trim(), 
                    numero: numero.trim(), 
                    bairro: bairro.trim(), 
                    cidade: cidade.trim(), 
                    complemento: complemento.trim() || null 
                }, 
                userId: currentUser.uid 
            },
            estabelecimentoId: actualEstabelecimentoId,
            itens: carrinho.map(item => ({ 
                nome: item.nome, 
                quantidade: item.qtd, 
                preco: Number(item.precoFinal), 
                imageUrl: item.imageUrl || null, 
                adicionais: item.adicionais || [] 
            })),
            status: 'recebido',
            createdAt: serverTimestamp(),
            tipo: isRetirada ? 'retirada' : 'delivery',
            formaPagamento: formaPagamento,
            trocoPara: valorTrocoPara,
            taxaEntrega: taxaAplicada,
            totalFinal: finalOrderTotal,
            ...(formaPagamento === 'pix' && { statusPagamentoPix: 'aguardando_pagamento' }),
            ...(appliedCoupon && { 
                cupomAplicado: { 
                    id: appliedCoupon.id, 
                    codigo: appliedCoupon.codigo, 
                    tipoDesconto: appliedCoupon.tipoDesconto, 
                    valorDesconto: appliedCoupon.valorDesconto, 
                    descontoCalculado: discountAmount 
                } 
            })
        };
        try {
            if (appliedCoupon) {
                await runTransaction(db, async (transaction) => {
                    const couponRef = doc(db, 'estabelecimentos', actualEstabelecimentoId, 'cupons', appliedCoupon.id);
                    const couponSnap = await transaction.get(couponRef);
                    if (!couponSnap.exists()) { 
                        throw new Error("Cupom não existe mais!"); 
                    }
                    const currentUsosAtuais = couponSnap.data().usosAtuais || 0;
                    if (couponSnap.data().usosMaximos !== null && currentUsosAtuais >= couponSnap.data().usosMaximos) { 
                        throw new Error("Cupom já atingiu o limite total de usos."); 
                    }
                    transaction.update(couponRef, { usosAtuais: currentUsosAtuais + 1 });
                });
            }
            const docRef = await addDoc(collection(db, 'pedidos'), pedido);
            setConfirmedOrderDetails({
                id: docRef.id, 
                cliente: pedido.cliente, 
                itens: pedido.itens, 
                subtotal: subtotalCalculado, 
                taxaEntrega: taxaAplicada, 
                totalFinal: finalOrderTotal, 
                formaPagamento: formaPagamento, 
                trocoPara: valorTrocoPara, 
                tipoEntrega: pedido.tipo, 
                cupomAplicado: appliedCoupon ? { 
                    codigo: appliedCoupon.codigo, 
                    desconto: discountAmount 
                } : null
            });
            setShowOrderConfirmationModal(true);
            toast.success('Seu pedido foi enviado com sucesso! 🎉');
            setCarrinho([]); 
            setFormaPagamento(''); 
            setTrocoPara(''); 
            setCouponCodeInput(''); 
            setAppliedCoupon(null); 
            setDiscountAmount(0);
        } catch (error) {
            console.error("Erro ao enviar pedido ou aplicar cupom (transação): ", error);
            if (error.message && (error.message.includes("limite total de usos") || error.message.includes("Cupom não existe mais"))) { 
                toast.error(`❌ Erro no cupom: ${error.message}`); 
            }
            else { 
                toast.error(`❌ Ocorreu um erro ao enviar seu pedido. Por favor, tente novamente.`); 
            }
        }
    };

    const handleLoginModal = async (e) => {
        e.preventDefault(); 
        setErrorAuthModal('');
        try {
            await signInWithEmailAndPassword(auth, emailAuthModal, passwordAuthModal);
            toast.success('Login realizado com sucesso!');
            setShowLoginPrompt(false); 
            setIsRegisteringInModal(false); 
            setEmailAuthModal(''); 
            setPasswordAuthModal(''); 
            setErrorAuthModal('');
        } catch (error) {
            let msg = "Erro no login. Verifique suas credenciais.";
            if (error.code === 'auth/user-not-found') msg = "Usuário não encontrado. Crie uma conta.";
            else if (error.code === 'auth/wrong-password') msg = "Senha incorreta.";
            setErrorAuthModal(msg); 
            toast.error(msg);
        }
    };

    const handleRegisterModal = async (e) => {
        e.preventDefault(); 
        setErrorAuthModal('');
        if (!nomeAuthModal.trim() || !telefoneAuthModal.trim() || !emailAuthModal.trim() || !passwordAuthModal.trim() || !ruaAuthModal.trim() || !numeroAuthModal.trim() || !bairroAuthModal.trim() || !cidadeAuthModal.trim()) {
            setErrorAuthModal('Por favor, preencha todos os campos obrigatórios, incluindo o endereço completo.');
            toast.error('Por favor, preencha todos os campos obrigatórios, incluindo o endereço completo.'); 
            return;
        }
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, emailAuthModal, passwordAuthModal);
            const user = userCredential.user;
            await setDocFirestore(doc(db, 'clientes', user.uid), {
                nome: nomeAuthModal.trim(), 
                telefone: telefoneAuthModal.trim(), 
                email: emailAuthModal.trim(),
                endereco: { 
                    rua: ruaAuthModal.trim(), 
                    numero: numeroAuthModal.trim(), 
                    bairro: bairroAuthModal.trim(), 
                    cidade: cidadeAuthModal.trim(), 
                    complemento: complementoAuthModal.trim() || null 
                },
                criadoEm: Timestamp.now(),
            });

            // Preenche o formulário principal com os dados que acabaram de ser cadastrados
            setNomeCliente(nomeAuthModal.trim());
            setTelefoneCliente(telefoneAuthModal.trim());
            setRua(ruaAuthModal.trim());
            setNumero(numeroAuthModal.trim());
            setBairro(bairroAuthModal.trim());
            setCidade(cidadeAuthModal.trim());
            setComplemento(complementoAuthModal.trim() || null);
            setIsRetirada(false);

            toast.success('Cadastro realizado com sucesso! Você está logado.');
            setShowLoginPrompt(false); 
            setIsRegisteringInModal(false); 
            setEmailAuthModal(''); 
            setPasswordAuthModal(''); 
            setNomeAuthModal(''); 
            setTelefoneAuthModal(''); 
            setRuaAuthModal(''); 
            setNumeroAuthModal(''); 
            setBairroAuthModal(''); 
            setCidadeAuthModal(''); 
            setComplementoAuthModal(''); 
            setErrorAuthModal('');
        } catch (error) {
            let msg = "Erro no cadastro. Tente novamente.";
            if (error.code === 'auth/email-already-in-use') msg = "Este email já está cadastrado.";
            else if (error.code === 'auth/weak-password') msg = "Senha muito fraca (mín. 6 caracteres).";
            setErrorAuthModal(msg); 
            toast.error(msg);
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

    // ✅ Efeito principal para carregar (ESTRUTURA ANINHADA)
    useEffect(() => {
        if (!estabelecimentoSlug) return;
        let unsubscribeTotal = () => {};

        const fetchEstabelecimento = async () => {
            try {
                setLoading(true);
                console.log("🔍 Iniciando busca do estabelecimento...");
                console.log("📌 Parâmetro recebido:", estabelecimentoSlug);

                const qEstabBySlug = query(
                    collection(db, 'estabelecimentos'), 
                    where('slug', '==', estabelecimentoSlug)
                );
                const estabSnapshotBySlug = await getDocs(qEstabBySlug);

                if (estabSnapshotBySlug.empty) {
                    toast.error("Estabelecimento não encontrado.");
                    setLoading(false);
                    navigate('/'); // Redireciona se não achar
                    return;
                }
                
                const estabDoc = estabSnapshotBySlug.docs[0];
                const estabData = estabDoc.data();
                const idDoEstabelecimentoReal = estabDoc.id;
                console.log("✅ Encontrado por SLUG:", estabData.nome);

                setEstabelecimentoInfo(estabData);
                setNomeEstabelecimento(estabData.nome || "Cardápio");
                setActualEstabelecimentoId(idDoEstabelecimentoReal);

                // ✅ Lógica de busca de cardápio aninhado
                console.log("📋 Buscando itens do cardápio (estrutura ANINHADA)...");
                
                const categoriasRef = collection(db, 'estabelecimentos', idDoEstabelecimentoReal, 'cardapio');
                const qCategorias = query(
                    categoriasRef, 
                    where('ativo', '==', true), 
                    orderBy('ordem', 'asc')
                );

                // Configura o listener principal
                const unsubscribeCardapio = onSnapshot(qCategorias, (categoriasSnapshot) => {
                    console.log("📁 Categorias ativas encontradas:", categoriasSnapshot.docs.length);
                    
                    const unsubscribers = [];
                    let allItems = [];
                    let categoriesList = ['Todos'];
                    let initialVisibleCounts = {};

                    if (categoriasSnapshot.empty) {
                        console.log("ℹ️ Nenhuma categoria ativa encontrada.");
                        setAllProdutos([]);
                        setAvailableCategories(['Todos']);
                        setVisibleItemsCount({});
                        setLoading(false);
                        return;
                    }

                    categoriasSnapshot.forEach(catDoc => {
                        const categoriaData = catDoc.data();
                        const categoriaId = catDoc.id;
                        categoriesList.push(categoriaData.nome);
                        initialVisibleCounts[categoriaData.nome] = 3; // Define contagem inicial
                        
                        console.log(`🔍 Buscando itens na categoria: ${categoriaId} (${categoriaData.nome})`);

                        const itensRef = collection(
                            db,
                            'estabelecimentos',
                            idDoEstabelecimentoReal,
                            'cardapio',
                            categoriaId,
                            'itens'
                        );
                        const qItens = query(
                            itensRef, 
                            where('ativo', '==', true), 
                            orderBy('nome', 'asc')
                        );

                        const unsubscribeItens = onSnapshot(qItens, (itensSnapshot) => {
                            console.log(`📦 Itens ativos na categoria ${categoriaId}:`, itensSnapshot.docs.length);

                            const itemsDaCategoria = itensSnapshot.docs.map(itemDoc => ({
                                ...itemDoc.data(),
                                id: itemDoc.id,
                                categoria: categoriaData.nome,
                                categoriaId: categoriaId,
                            }));

                            allItems = [
                                ...allItems.filter(item => item.categoriaId !== categoriaId),
                                ...itemsDaCategoria
                            ];

                            setAllProdutos(allItems);
                        }, (error) => {
                            console.error(`❌ Erro ao ouvir itens da categoria ${categoriaId}:`, error);
                            toast.error("❌ Erro ao carregar itens de uma categoria.");
                        });

                        unsubscribers.push(unsubscribeItens);
                    });

                    setAvailableCategories(categoriesList);
                    setVisibleItemsCount(initialVisibleCounts);
                    setLoading(false);

                    // Função para limpar todos os listeners de itens
                    unsubscribeTotal = () => {
                        console.log("🧹 Limpando listeners de itens");
                        unsubscribers.forEach(unsub => unsub());
                        unsubscribeCardapio(); // Limpa o listener das categorias
                    };
                }, (error) => {
                    console.error("❌ Erro ao carregar o estabelecimento (categorias):", error);
                    toast.error("Não foi possível carregar o estabelecimento.");
                    setLoading(false);
                });
            
            } catch (error) {
                console.error("❌ Erro no fetchEstabelecimento:", error);
                toast.error("Erro crítico ao carregar a página.");
                setLoading(false);
            }
        };

        fetchEstabelecimento();

        return () => {
            unsubscribeTotal(); // Limpa todos os listeners quando o componente desmonta
        };
    }, [estabelecimentoSlug, navigate]);

    useEffect(() => {
        let produtosProcessados = [...allProdutos];
        
        // Filtrar por categoria
        if (selectedCategory && selectedCategory !== 'Todos') {
            produtosProcessados = produtosProcessados.filter(item => 
                item.categoria?.toLowerCase() === selectedCategory.toLowerCase()
            );
        }
        
        // Filtrar por termo de busca
        if (debouncedSearchTerm.trim() !== '') {
            const lowerCaseSearchTerm = debouncedSearchTerm.trim().toLowerCase();
            produtosProcessados = produtosProcessados.filter(item =>
                item.nome?.toLowerCase().includes(lowerCaseSearchTerm) ||
                item.descricao?.toLowerCase().includes(lowerCaseSearchTerm)
            );
        }
        
        // Ordenar por nome
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
        if (!authLoading && (isUserAdmin || isUserMasterAdmin)) {
            toast.error('Acesso negado. Esta página é exclusiva para clientes.', { toastId: 'admin-redirect' });
        }
    }, [authLoading, isUserAdmin, isUserMasterAdmin]);

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 text-lg">Carregando cardápio...</p>
                </div>
            </div>
        );
    }

    if (isUserAdmin || isUserMasterAdmin) {
        return <Navigate to={isUserMasterAdmin ? '/master-dashboard' : '/painel'} replace />;
    }

    // Agrupar produtos por categoria para exibição
    const menuAgrupado = produtosFiltrados.reduce((acc, produto) => {
        const categoria = produto.categoria || 'Outros';
        if (!acc[categoria]) acc[categoria] = [];
        acc[categoria].push(produto);
        return acc;
    }, {});

    return (
        <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-gray-50 pb-48 md:pb-0">
            {/* Header com fundo amarelo */}
            <div className="bg-gradient-to-r from-yellow-500 to-yellow-400 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-8">
                    <div className="text-center text-black">
                        <h1 className="text-4xl font-bold mb-3">
                            {nomeEstabelecimento}
                        </h1>
                        {estabelecimentoInfo?.descricao && (
                            <p className="text-yellow-900 text-lg max-w-2xl mx-auto">
                                {estabelecimentoInfo.descricao}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="max-w-7xl mx-auto px-4 py-6">
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-yellow-200">
                    <div className="mb-6">
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder="🔍 Buscar por nome ou descrição..." 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                                className="w-full px-6 py-4 border border-yellow-300 rounded-2xl text-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200" 
                            />
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-3 justify-center">
                        {availableCategories.map((category) => (
                            <button 
                                key={category} 
                                onClick={() => setSelectedCategory(category)}
                                className={`px-6 py-3 rounded-full text-sm font-semibold transition-all duration-200 transform hover:scale-105 ${
                                    selectedCategory === category 
                                        ? 'bg-yellow-500 text-black shadow-lg' 
                                        : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                }`}
                            >
                                {category}
                            </button>
                        ))}
                        {(searchTerm || selectedCategory !== 'Todos') && (
                            <button 
                                onClick={() => { setSearchTerm(''); setSelectedCategory('Todos'); }}
                                className="px-6 py-3 rounded-full text-sm font-semibold bg-gray-500 text-white hover:bg-gray-600 transition-all duration-200 transform hover:scale-105"
                            >
                                Limpar Filtros
                            </button>
                        )}
                    </div>
                </div>

                {/* Menu Items */}
                {produtosFiltrados.length === 0 && allProdutos.length > 0 ? (
                    <div className="text-center py-12">
                        <div className="text-yellow-400 text-6xl mb-4">🔍</div>
                        <p className="text-yellow-600 text-xl font-medium">Nenhum item encontrado com os filtros selecionados.</p>
                        <p className="text-yellow-500 mt-2">Tente alterar sua busca ou categoria.</p>
                    </div>
                ) : allProdutos.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-yellow-400 text-6xl mb-4">🍽️</div>
                        <p className="text-yellow-600 text-xl font-medium">Este estabelecimento ainda não possui itens no cardápio.</p>
                        <p className="text-yellow-500 mt-2">Volte em breve para conferir as novidades!</p>
                    </div>
                ) : (
                    Object.keys(menuAgrupado).sort().map(categoria => {
                        const itemsNestaCategoria = menuAgrupado[categoria];
                        const totalItemsVisiveis = visibleItemsCount[categoria] || 3;
                        const todosItensVisiveis = totalItemsVisiveis >= itemsNestaCategoria.length;
                        
                        return (
                            <div key={categoria} className="mb-12">
                                <div className="flex items-center justify-between mb-8">
                                    <h2 className="text-3xl font-bold text-yellow-800">{categoria}</h2>
                                    <span className="text-yellow-600 bg-yellow-100 px-3 py-1 rounded-full text-sm">
                                        {itemsNestaCategoria.length} {itemsNestaCategoria.length === 1 ? 'item' : 'itens'}
                                    </span>
                                </div>
                                
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {itemsNestaCategoria.slice(0, totalItemsVisiveis).map((item) => (
                                        <CardapioItem key={item.id} item={item} onAddItem={handleAbrirModalAdicionais} />
                                    ))}
                                </div>
                                
                                {itemsNestaCategoria.length > 3 && (
                                    <div className="text-center mt-8">
                                        {todosItensVisiveis ? (
                                            <button 
                                                onClick={() => handleShowLess(categoria)}
                                                className="bg-yellow-200 text-yellow-800 font-semibold py-3 px-8 rounded-lg hover:bg-yellow-300 transition-all duration-200 transform hover:scale-105"
                                            >
                                                Ver menos
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleShowMore(categoria)}
                                                className="bg-yellow-500 text-black font-semibold py-3 px-8 rounded-lg hover:bg-yellow-600 transition-all duration-200 transform hover:scale-105 shadow-lg"
                                            >
                                                Ver mais ({itemsNestaCategoria.length - totalItemsVisiveis} restantes)
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}

                {/* Cart and Order Section */}
                <div className="bg-white rounded-2xl shadow-xl p-6 mt-12 border border-yellow-200">
                    <h2 className="font-bold text-3xl mb-6 text-yellow-800 flex items-center gap-3">
                        <span>🛒</span>
                        Seu Pedido
                    </h2>
                    
                    {carrinho.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="text-yellow-400 text-6xl mb-4">🛒</div>
                            <p className="text-yellow-600 text-lg font-medium">Nenhum item adicionado ainda.</p>
                            <p className="text-yellow-500 mt-2">Explore nosso cardápio e adicione itens deliciosos!</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4 mb-6">
                                {carrinho.map((item) => (
                                    <div key={item.cartItemId} className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 hover:shadow-md transition-all duration-200">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 mr-4">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <span className="font-semibold text-yellow-900">{item.nome}</span>
                                                        <span className="text-sm text-yellow-600 ml-2">({item.qtd}x)</span>
                                                    </div>
                                                    <span className="font-bold text-yellow-900 text-lg">
                                                        R$ {(item.precoFinal * item.qtd).toFixed(2).replace('.', ',')}
                                                    </span>
                                                </div>
                                                {item.adicionais && item.adicionais.length > 0 && (
                                                    <div className="text-sm text-yellow-700 pl-2 mt-2 border-l-2 border-yellow-500">
                                                        {item.adicionais.map(ad => `+ ${ad.nome}`).join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                            <button 
                                                onClick={() => removerDoCarrinho(item.cartItemId)}
                                                className="bg-yellow-500 text-black w-8 h-8 rounded-full flex items-center justify-center font-bold hover:bg-yellow-600 transition-colors duration-200 flex-shrink-0"
                                            >
                                                -
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="border-t border-yellow-200 pt-6 space-y-4">
                                <div className="flex justify-between items-center text-lg">
                                    <span className="text-yellow-700">Subtotal:</span>
                                    <span className="font-semibold text-yellow-900">R$ {subtotalCalculado.toFixed(2).replace('.', ',')}</span>
                                </div>
                                
                                {!isRetirada && (
                                    <div className="flex justify-between items-center text-lg">
                                        <span className="text-yellow-700">Taxa de Entrega:</span>
                                        <span className="font-semibold text-yellow-900">R$ {taxaAplicada.toFixed(2).replace('.', ',')}</span>
                                    </div>
                                )}
                                
                                {!appliedCoupon ? (
                                    <div className="flex items-center gap-3 pt-4 border-t border-yellow-200">
                                        <input 
                                            type="text" 
                                            placeholder="🎁 Código do Cupom" 
                                            value={couponCodeInput} 
                                            onChange={(e) => setCouponCodeInput(e.target.value)} 
                                            className="flex-1 border border-yellow-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                                            disabled={couponLoading}
                                        />
                                        <button 
                                            onClick={handleApplyCoupon} 
                                            disabled={couponLoading || !couponCodeInput.trim()}
                                            className="bg-yellow-500 text-black px-6 py-3 rounded-xl font-semibold hover:bg-yellow-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
                                        >
                                            {couponLoading ? 'Aplicando...' : 'Aplicar'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center bg-green-50 p-4 rounded-xl border border-green-200 mt-4">
                                        <div>
                                            <p className="text-green-800 font-semibold">🎉 Cupom: {appliedCoupon.codigo}</p>
                                            <p className="text-green-600 text-sm">Desconto aplicado com sucesso!</p>
                                        </div>
                                        <button 
                                            onClick={removeAppliedCoupon} 
                                            className="text-red-600 hover:text-red-700 font-semibold text-sm transition-colors duration-200"
                                        >
                                            Remover
                                        </button>
                                    </div>
                                )}
                                
                                {discountAmount > 0 && (
                                    <div className="flex justify-between items-center text-lg text-green-600 font-semibold">
                                        <span>Desconto:</span>
                                        <span>- R$ {discountAmount.toFixed(2).replace('.', ',')}</span>
                                    </div>
                                )}
                                
                                <div className="flex justify-between items-center text-2xl font-bold pt-4 border-t border-yellow-300">
                                    <span className="text-yellow-900">TOTAL:</span>
                                    <span className="text-yellow-600">R$ {finalOrderTotal.toFixed(2).replace('.', ',')}</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Customer Info Section */}
                <div className="bg-white rounded-2xl shadow-xl p-6 mt-8 border border-yellow-200">
                    <h3 className="font-bold text-2xl mb-6 text-yellow-800 flex items-center gap-3">
                        <span>👤</span>
                        Seus Dados
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="nomeCliente" className="block text-sm font-medium text-yellow-700 mb-2">Seu Nome *</label>
                            <input 
                                id="nomeCliente" 
                                value={nomeCliente} 
                                onChange={(e) => setNomeCliente(e.target.value)} 
                                className="w-full border border-yellow-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                                required 
                            />
                        </div>
                        <div>
                            <label htmlFor="telefoneCliente" className="block text-sm font-medium text-yellow-700 mb-2">Seu Telefone *</label>
                            <input 
                                id="telefoneCliente" 
                                value={telefoneCliente} 
                                onChange={(e) => setTelefoneCliente(e.target.value)} 
                                className="w-full border border-yellow-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                                type="tel" 
                                required 
                            />
                        </div>
                    </div>
                    
                    <div className="mt-8 pt-6 border-t border-yellow-200">
                        <h3 className="font-bold text-2xl mb-4 text-yellow-800">Tipo de Entrega *</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="flex items-center p-4 border-2 border-yellow-200 rounded-xl cursor-pointer hover:border-yellow-500 transition-all duration-200">
                                <input 
                                    type="radio" 
                                    name="deliveryType" 
                                    checked={isRetirada} 
                                    onChange={() => setIsRetirada(true)} 
                                    className="mr-3 h-5 w-5 text-yellow-600 focus:ring-yellow-500"
                                />
                                <div>
                                    <span className="font-semibold text-yellow-900">🛵 Retirada no Local</span>
                                    <p className="text-sm text-yellow-600 mt-1">Você busca seu pedido</p>
                                </div>
                            </label>
                            <label className="flex items-center p-4 border-2 border-yellow-200 rounded-xl cursor-pointer hover:border-yellow-500 transition-all duration-200">
                                <input 
                                    type="radio" 
                                    name="deliveryType" 
                                    checked={!isRetirada} 
                                    onChange={() => setIsRetirada(false)} 
                                    className="mr-3 h-5 w-5 text-yellow-600 focus:ring-yellow-500"
                                />
                                <div>
                                    <span className="font-semibold text-yellow-900">🚚 Entrega em Casa</span>
                                    <p className="text-sm text-yellow-600 mt-1">Entregamos no seu endereço</p>
                                </div>
                            </label>
                        </div>
                    </div>
                    
                    {!isRetirada && (
                        <div className="mt-8 pt-6 border-t border-yellow-200">
                            <h3 className="font-bold text-2xl mb-6 text-yellow-800">📍 Endereço de Entrega</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label htmlFor="rua" className="block text-sm font-medium text-yellow-700 mb-2">Rua *</label>
                                    <input 
                                        id="rua" 
                                        value={rua} 
                                        onChange={(e) => setRua(e.target.value)} 
                                        className="w-full border border-yellow-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                                        required={!isRetirada} 
                                    />
                                </div>
                                <div>
                                    <label htmlFor="numero" className="block text-sm font-medium text-yellow-700 mb-2">Número *</label>
                                    <input 
                                        id="numero" 
                                        value={numero} 
                                        onChange={(e) => setNumero(e.target.value)} 
                                        className="w-full border border-yellow-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                                        required={!isRetirada} 
                                    />
                                </div>
                                <div>
                                    <label htmlFor="bairro" className="block text-sm font-medium text-yellow-700 mb-2">Bairro *</label>
                                    <input 
                                        id="bairro" 
                                        value={bairro} 
                                        onChange={(e) => setBairro(e.target.value)} 
                                        className="w-full border border-yellow-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                                        required={!isRetirada} 
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label htmlFor="cidade" className="block text-sm font-medium text-yellow-700 mb-2">Cidade *</label>
                                    <input 
                                        id="cidade" 
                                        value={cidade} 
                                        onChange={(e) => setCidade(e.target.value)} 
                                        className="w-full border border-yellow-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                                        required={!isRetirada} 
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label htmlFor="complemento" className="block text-sm font-medium text-yellow-700 mb-2">Complemento</label>
                                    <input 
                                        id="complemento" 
                                        value={complemento} 
                                        onChange={(e) => setComplemento(e.target.value)} 
                                        className="w-full border border-yellow-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                                    />
                                </div>
                            </div>
                            {bairroNaoEncontrado && (
                                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                                    <p className="text-yellow-800 text-sm">
                                        ⚠️ Bairro não encontrado na nossa lista de áreas de entrega. 
                                        Entre em contato para confirmar a disponibilidade.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                    
                    <div className="mt-8 pt-6 border-t border-yellow-200">
                        <h3 className="font-bold text-2xl mb-6 text-yellow-800">💳 Forma de Pagamento *</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <label className="flex items-center p-4 border-2 border-yellow-200 rounded-xl cursor-pointer hover:border-green-500 transition-all duration-200">
                                <input 
                                    type="radio" 
                                    name="paymentMethod" 
                                    value="pix" 
                                    checked={formaPagamento === 'pix'} 
                                    onChange={(e) => setFormaPagamento(e.target.value)} 
                                    className="mr-3 h-5 w-5 text-green-600 focus:ring-green-500"
                                />
                                <div>
                                    <span className="font-semibold text-yellow-900">📱 PIX</span>
                                    <p className="text-sm text-yellow-600 mt-1">Pagamento instantâneo</p>
                                </div>
                            </label>
                            <label className="flex items-center p-4 border-2 border-yellow-200 rounded-xl cursor-pointer hover:border-blue-500 transition-all duration-200">
                                <input 
                                    type="radio" 
                                    name="paymentMethod" 
                                    value="cartao" 
                                    checked={formaPagamento === 'cartao'} 
                                    onChange={(e) => setFormaPagamento(e.target.value)} 
                                    className="mr-3 h-5 w-5 text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                    <span className="font-semibold text-yellow-900">💳 Cartão</span>
                                    <p className="text-sm text-yellow-600 mt-1">Crédito/Débito na entrega</p>
                                </div>
                            </label>
                            <label className="flex items-center p-4 border-2 border-yellow-200 rounded-xl cursor-pointer hover:border-yellow-500 transition-all duration-200">
                                <input 
                                    type="radio" 
                                    name="paymentMethod" 
                                    value="dinheiro" 
                                    checked={formaPagamento === 'dinheiro'} 
                                    onChange={(e) => setFormaPagamento(e.target.value)} 
                                    className="mr-3 h-5 w-5 text-yellow-600 focus:ring-yellow-500"
                                />
                                <div>
                                    <span className="font-semibold text-yellow-900">💰 Dinheiro</span>
                                    <p className="text-sm text-yellow-600 mt-1">Pagamento na entrega</p>
                                </div>
                            </label>
                        </div>
                        
                        {formaPagamento === 'dinheiro' && (
                            <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                                <label htmlFor="troco" className="block text-sm font-medium text-yellow-800 mb-2">
                                    💵 Precisa de troco para?
                                </label>
                                <input 
                                    id="troco" 
                                    type="number" 
                                    value={trocoPara} 
                                    onChange={(e) => setTrocoPara(e.target.value)} 
                                    className="w-full border border-yellow-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                                    placeholder={`Ex: R$ ${(finalOrderTotal + 10).toFixed(2).replace('.', ',')}`}
                                />
                                <p className="text-yellow-700 text-sm mt-2">
                                    Informe o valor em dinheiro que você vai pagar para calcularmos o troco.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Fixed Order Button */}
            {carrinho.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white p-4 shadow-2xl border-t border-yellow-200 md:relative md:p-0 md:mt-8 md:shadow-none md:border-none">
                    <div className="max-w-7xl mx-auto">
                        <button 
                            onClick={enviarPedido} 
                            disabled={!currentUser || !nomeCliente.trim() || !telefoneCliente.trim() || !formaPagamento || (!isRetirada && (!rua.trim() || !numero.trim() || !bairro.trim() || !cidade.trim()))}
                            className="w-full px-6 py-4 rounded-2xl font-bold text-lg disabled:bg-gray-400 disabled:cursor-not-allowed bg-green-500 text-white hover:bg-green-600 transition-all duration-200 transform hover:scale-105 shadow-lg"
                        >
                            🚀 Enviar Pedido Agora! - R$ {finalOrderTotal.toFixed(2).replace('.', ',')}
                        </button>
                    </div>
                </div>
            )}

            {/* Order Confirmation Modal */}
            {showOrderConfirmationModal && confirmedOrderDetails && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
                        <div className="text-6xl mb-4">🎉</div>
                        <h2 className="text-3xl font-bold mb-4 text-yellow-800">Pedido Enviado!</h2>
                        <div className="space-y-3 text-left mb-6">
                            <p><strong className="text-yellow-700">ID:</strong> <span className="font-mono">{confirmedOrderDetails.id.substring(0, 8)}...</span></p>
                            <p><strong className="text-yellow-700">Total:</strong> R$ {confirmedOrderDetails.totalFinal.toFixed(2).replace('.', ',')}</p>
                            <p><strong className="text-yellow-700">Forma de Pagamento:</strong> {confirmedOrderDetails.formaPagamento}</p>
                        </div>
                        <button 
                            onClick={() => setShowOrderConfirmationModal(false)} 
                            className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold hover:bg-green-600 transition-all duration-200"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}
            
            {/* Login Modal */}
            {showLoginPrompt && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[1000]">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full relative">
                        <button 
                            onClick={() => { setShowLoginPrompt(false); }} 
                            className="absolute top-4 right-4 text-yellow-500 hover:text-yellow-600 text-2xl font-bold transition-colors duration-200" 
                            aria-label="Fechar"
                        >
                            &times;
                        </button>
                        
                        <div className="text-center mb-6">
                            <div className="text-4xl mb-4">🔐</div>
                            <h2 className="text-3xl font-bold text-yellow-800 mb-2">
                                {isRegisteringInModal ? 'Criar Conta' : 'Fazer Login'}
                            </h2>
                            <p className="text-yellow-600">
                                {isRegisteringInModal ? 'Preencha seus dados para criar uma conta.' : 'Para acessar o cardápio e fazer pedidos.'}
                            </p>
                        </div>
                        
                        {errorAuthModal && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                                <p className="text-red-700 text-sm">{errorAuthModal}</p>
                            </div>
                        )}
                        
                        {isRegisteringInModal ? (
                            <form onSubmit={handleRegisterModal} className="space-y-4">
                                <input 
                                    type="text" 
                                    placeholder="Seu Nome Completo *" 
                                    className="w-full border border-yellow-300 rounded-xl p-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                                    value={nomeAuthModal} 
                                    onChange={(e) => setNomeAuthModal(e.target.value)} 
                                    required 
                                />
                                <input 
                                    type="tel" 
                                    placeholder="Seu Telefone (com DDD) *" 
                                    className="w-full border border-yellow-300 rounded-xl p-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                                    value={telefoneAuthModal} 
                                    onChange={(e) => setTelefoneAuthModal(e.target.value)} 
                                    required 
                                />
                                <input 
                                    type="email" 
                                    placeholder="Email *" 
                                    className="w-full border border-yellow-300 rounded-xl p-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                                    value={emailAuthModal} 
                                    onChange={(e) => setEmailAuthModal(e.target.value)} 
                                    required 
                                />
                                <input 
                                    type="password" 
                                    placeholder="Senha (mín. 6 caracteres) *" 
                                    className="w-full border border-yellow-300 rounded-xl p-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                                    value={passwordAuthModal} 
                                    onChange={(e) => setPasswordAuthModal(e.target.value)} 
                                    required 
                                />
                                <input 
                                    type="text" 
                                    placeholder="Rua *" 
                                    className="w-full border border-yellow-300 rounded-xl p-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                                    value={ruaAuthModal} 
                                    onChange={(e) => setRuaAuthModal(e.target.value)} 
                                    required 
                                />
                                <input 
                                    type="text" 
                                    placeholder="Número *" 
                                    className="w-full border border-yellow-300 rounded-xl p-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                                    value={numeroAuthModal} 
                                    onChange={(e) => setNumeroAuthModal(e.target.value)} 
                                    required 
                                />
                                <input 
                                    type="text" 
                                    placeholder="Bairro *" 
                                    className="w-full border border-yellow-300 rounded-xl p-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                                    value={bairroAuthModal} 
                                    onChange={(e) => setBairroAuthModal(e.target.value)} 
                                    required 
                                />
                                <input 
                                    type="text" 
                                    placeholder="Cidade *" 
                                    className="w-full border border-yellow-300 rounded-xl p-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                                    value={cidadeAuthModal} 
                                    onChange={(e) => setCidadeAuthModal(e.target.value)} 
                                    required 
                                />
                                <input 
                                    type="text" 
                                    placeholder="Complemento (Opcional)" 
                                    className="w-full border border-yellow-300 rounded-xl p-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                                    value={complementoAuthModal} 
                                    onChange={(e) => setComplementoAuthModal(e.target.value)} 
                                />
                                <button 
                                    type="submit" 
                                    className="w-full bg-yellow-500 text-black font-semibold py-3 rounded-xl hover:bg-yellow-600 transition-all duration-200 transform hover:scale-105"
                                >
                                    Cadastrar e Entrar
                                </button>
                                <p className="text-sm text-center text-yellow-600">
                                    Já tem uma conta?{' '}
                                    <button 
                                        type="button" 
                                        onClick={() => setIsRegisteringInModal(false)} 
                                        className="text-yellow-500 underline font-semibold hover:text-yellow-600 transition-colors duration-200"
                                    >
                                        Fazer Login
                                    </button>
                                </p>
                            </form>
                        ) : (
                            <form onSubmit={handleLoginModal} className="space-y-4">
                                <input 
                                    type="email" 
                                    placeholder="Email" 
                                    className="w-full border border-yellow-300 rounded-xl p-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                                    value={emailAuthModal} 
                                    onChange={(e) => setEmailAuthModal(e.target.value)} 
                                    required 
                                />
                                <input 
                                    type="password" 
                                    placeholder="Senha" 
                                    className="w-full border border-yellow-300 rounded-xl p-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
                                    value={passwordAuthModal} 
                                    onChange={(e) => setPasswordAuthModal(e.target.value)} 
                                    required 
                                />
                                <button 
                                    type="submit" 
                                    className="w-full bg-green-500 text-white font-semibold py-3 rounded-xl hover:bg-green-600 transition-all duration-200 transform hover:scale-105"
                                >
                                    Entrar
                                </button>
                                <p className="text-sm text-center text-yellow-600">
                                    Não tem uma conta?{' '}
                                    <button 
                                        type="button" 
                                        onClick={() => setIsRegisteringInModal(true)} 
                                        className="text-yellow-500 underline font-semibold hover:text-yellow-600 transition-colors duration-200"
                                    >
                                        Cadastre-se
                                    </button>
                                </p>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* Adicionais Modal */}
            {itemParaAdicionais && (
                <AdicionaisModal 
                    item={itemParaAdicionais} 
                    onConfirm={handleConfirmarAdicionais} 
                    onClose={handleFecharModal} 
                />
            )}
        </div>
    );
}

export default Menu;