// src/pages/Menu.jsx - VERSÃO COMPLETA E CORRIGIDA PARA MOBILE
import React, { useState, useEffect, useMemo } from 'react';
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
import CarrinhoFlutuante from '../components/CarrinhoFlutuante';
import PaymentModal from '../components/PaymentModal';

function Menu() {
    const { estabelecimentoSlug } = useParams();
    const navigate = useNavigate();
    const { currentUser, currentClientData, loading: authLoading, userData } = useAuth();
    // eslint-disable-next-line no-unused-vars
    const { processPayment, paymentLoading } = usePayment();

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
    const [taxasBairro, setTaxasBairro] = useState([]); // Mantido caso implemente lógica futura
    const [taxaEntregaCalculada, setTaxaEntregaCalculada] = useState(0);
    const [isRetirada, setIsRetirada] = useState(false);
    const [nomeEstabelecimento, setNomeEstabelecimento] = useState("Carregando Cardápio...");
    const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
    const [actualEstabelecimentoId, setActualEstabelecimentoId] = useState(null);
    const [showOrderConfirmationModal, setShowOrderConfirmationModal] = useState(false);
    const [confirmedOrderDetails, setConfirmedOrderDetails] = useState(null);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [isRegisteringInModal, setIsRegisteringInModal] = useState(false);
    
    // Estados Auth Modal
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

    // Cupons e Busca
    const [couponCodeInput, setCouponCodeInput] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [couponLoading, setCouponLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [availableCategories, setAvailableCategories] = useState([]);
    
    // Modais de Produto
    const [itemParaAdicionais, setItemParaAdicionais] = useState(null);
    const [itemParaVariacoes, setItemParaVariacoes] = useState(null);
    const [visibleItemsCount, setVisibleItemsCount] = useState({});
    const [loading, setLoading] = useState(true);

    // ESTADOS DO SISTEMA DE PAGAMENTO
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [pedidoParaPagamento, setPedidoParaPagamento] = useState(null);
    // eslint-disable-next-line no-unused-vars
    const [processandoPagamento, setProcessandoPagamento] = useState(false);

    // CORES
    const [coresEstabelecimento, setCoresEstabelecimento] = useState({
        primaria: '#0b0b0bff',
        destaque: '#059669',
        background: '#000000',
        texto: {
            principal: '#FFFFFF',
            secundario: '#9CA3AF',
            placeholder: '#6B7280',
            destaque: '#FBBF24',
            erro: '#EF4444',
            sucesso: '#10B981'
        }
    });

    // --- CÁLCULOS ---
    const subtotalCalculado = useMemo(() => carrinho.reduce((acc, item) => acc + (item.precoFinal * item.qtd), 0), [carrinho]);
    const taxaAplicada = isRetirada ? 0 : taxaEntregaCalculada;
    const finalOrderTotal = useMemo(() => Math.max(0, subtotalCalculado + taxaAplicada - discountAmount), [subtotalCalculado, taxaAplicada, discountAmount]);

    // --- FUNÇÕES AUXILIARES ---
    const formatarHorarios = (horarios) => {
        if (!horarios || typeof horarios !== 'object') return "Horário não informado";
        const diasSemana = { seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta', sex: 'Sexta', sab: 'Sábado', dom: 'Domingo' };
        return Object.entries(horarios)
            .map(([dia, horario]) => {
                const diaNome = diasSemana[dia] || dia;
                if (!horario || !horario.abertura || !horario.fechamento) return `${diaNome}: Fechado`;
                return `${diaNome}: ${horario.abertura} - ${horario.fechamento}`;
            })
            .join(' | ');
    };

// CARREGAMENTO OTIMIZADO (Prioriza busca direta)
    const carregarProdutosRapido = async (estabId) => {
        try {
            let todosProdutos = [];

            // 1. TENTATIVA RÁPIDA: Busca direta na coleção 'cardapio' (onde costumam ficar os itens ativos)
            // Isso evita o loop de categorias se os produtos estiverem na raiz
            const cardapioDiretoRef = collection(db, 'estabelecimentos', estabId, 'cardapio');
            // Busca itens que tenham nome E preço (para evitar pegar documentos que são só categorias)
            const qDireta = query(cardapioDiretoRef, where('ativo', '==', true)); 
            
            const snapshotDireto = await getDocs(qDireta);

            if (!snapshotDireto.empty) {
                // Filtra apenas o que parece ser produto (tem preço)
                todosProdutos = snapshotDireto.docs
                    .map(doc => ({
                        ...doc.data(),
                        id: doc.id,
                        categoria: doc.data().categoria || 'Geral',
                        categoriaId: 'direto'
                    }))
                    .filter(item => item.preco !== undefined || item.precoFinal !== undefined); // Garante que é produto
            }

            // 2. Se a busca rápida retornou produtos, ótimo. Retorna eles.
            if (todosProdutos.length > 0) {
                return todosProdutos;
            }

            // 3. FALLBACK: Se não achou nada, tenta o método antigo (Lento: Categorias -> Subcoleções)
            // Só entra aqui se o método rápido falhar
            console.log("Tentando carregamento profundo (subcoleções)...");
            const categoriasSnapshot = await getDocs(cardapioDiretoRef);
            
            if (!categoriasSnapshot.empty) {
                const promessas = categoriasSnapshot.docs.map(catDoc => {
                    const categoriaId = catDoc.id;
                    const categoriaData = catDoc.data();
                    // Se o documento da categoria tem 'preco', ele é um produto, não pasta. Já pegamos no passo 1.
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
            console.error("Erro carregamento:", error);
            return [];
        }
    };

    // MANIPULAÇÃO DO CARRINHO
    const handleAbrirModalProduto = (item) => {
        if (!currentUser) {
            toast.warn('Faça login para adicionar itens.');
            setShowLoginPrompt(true);
            return;
        }
        if (item.variacoes && Array.isArray(item.variacoes) && item.variacoes.length > 0) {
            setItemParaVariacoes(item);
        } else {
            // Se não tem variação, mas pode ter adicionais, checa se quer abrir adicionais ou add direto
            // Aqui simplificado: se não tem variação, adiciona direto ou abre adicionais se existirem?
            // Dependendo da sua lógica, pode abrir modal de adicionais aqui. 
            // Para manter simples e igual ao original:
            if(item.adicionais && item.adicionais.length > 0) {
                setItemParaAdicionais(item); // Assume que abre modal se tiver adicionais
            } else {
                handleAdicionarRapido(item);
            }
        }
    };

    const handleAdicionarRapido = (item) => {
        if (!currentUser) {
            toast.warn('Faça login para adicionar itens.');
            setShowLoginPrompt(true);
            return;
        }
        const precoParaCarrinho = item.precoFinal !== undefined && item.precoFinal !== null ? item.precoFinal : item.preco;
        const novoItemNoCarrinho = {
            ...item,
            qtd: 1,
            cartItemId: uuidv4(),
            precoFinal: precoParaCarrinho
        };
        setCarrinho(prev => [...prev, novoItemNoCarrinho]);
        toast.success(`${item.nome} adicionado!`, { autoClose: 1000, hideProgressBar: true });
    };

    const handleConfirmarVariacoes = (itemConfigurado) => {
        if (itemConfigurado.adicionais && itemConfigurado.adicionais.length > 0) {
            setItemParaAdicionais(itemConfigurado);
            setItemParaVariacoes(null);
        } else {
            const novoItemNoCarrinho = {
                ...itemConfigurado,
                qtd: 1,
                cartItemId: uuidv4(),
                precoFinal: itemConfigurado.precoSelecionado || itemConfigurado.preco
            };
            setCarrinho(prev => [...prev, novoItemNoCarrinho]);
            toast.success(`${itemConfigurado.nome} adicionado!`, { autoClose: 1000, hideProgressBar: true });
            setItemParaVariacoes(null);
        }
    };

    const handleConfirmarAdicionais = (itemConfigurado) => {
        const novoItemNoCarrinho = {
            ...itemConfigurado,
            qtd: 1,
            cartItemId: uuidv4(),
            precoFinal: itemConfigurado.precoFinal || itemConfigurado.precoSelecionado || itemConfigurado.preco
        };
        setCarrinho(prev => [...prev, novoItemNoCarrinho]);
        toast.success(`${itemConfigurado.nome} adicionado!`, { autoClose: 1000, hideProgressBar: true });
        setItemParaAdicionais(null);
    };

    const removerDoCarrinho = (cartItemId) => {
        const produtoNoCarrinho = carrinho.find((p) => p.cartItemId === cartItemId);
        if (!produtoNoCarrinho) return;
        if (produtoNoCarrinho.qtd === 1) {
            setCarrinho(carrinho.filter((p) => p.cartItemId !== cartItemId));
        } else {
            setCarrinho(carrinho.map((p) => (p.cartItemId === cartItemId ? { ...p, qtd: p.qtd - 1 } : p)));
        }
    };

    const formatarItemCarrinho = (item) => {
        let nomeFormatado = item.nome;
        if (item.variacaoSelecionada && item.variacaoSelecionada.nome) nomeFormatado += ` - ${item.variacaoSelecionada.nome}`;
        if (item.adicionais && item.adicionais.length > 0) nomeFormatado += ` (${item.adicionais.map(ad => `+ ${ad.nome}`).join(', ')})`;
        if (item.removidos && item.removidos.length > 0) nomeFormatado += ` (Sem: ${item.removidos.join(', ')})`;
        if (item.observacao) nomeFormatado += ` (Obs: ${item.observacao})`;
        return nomeFormatado;
    };

    // CUPOM
    const handleApplyCoupon = async () => {
        if (!currentUser) return toast.warn('Faça login para aplicar cupom.');
        if (!couponCodeInput.trim()) return toast.warn('Digite o código do cupom.');
        setCouponLoading(true);
        try {
            const couponsRef = collection(db, 'estabelecimentos', actualEstabelecimentoId, 'cupons');
            const q = query(couponsRef, where('codigo', '==', couponCodeInput.toUpperCase().trim()));
            const couponSnap = await getDocs(q);
            
            if (couponSnap.empty) throw new Error('Cupom inválido.');
            const couponData = { id: couponSnap.docs[0].id, ...couponSnap.docs[0].data() };
            
            if (!couponData.ativo) throw new Error('Cupom inativo.');
            const now = Timestamp.now();
            if (couponData.validadeInicio && couponData.validadeInicio.seconds > now.seconds) throw new Error('Cupom não vigente.');
            if (couponData.validadeFim && couponData.validadeFim.seconds < now.seconds) throw new Error('Cupom expirado.');
            if (couponData.usosMaximos !== null && couponData.usosAtuais >= couponData.usosMaximos) throw new Error('Limite de usos atingido.');
            if (couponData.minimoPedido !== null && subtotalCalculado < couponData.minimoPedido) throw new Error(`Mínimo R$ ${couponData.minimoPedido.toFixed(2)}`);

            let discount = 0;
            if (couponData.tipoDesconto === 'percentual') discount = subtotalCalculado * (couponData.valorDesconto / 100);
            else if (couponData.tipoDesconto === 'valorFixo') discount = Math.min(couponData.valorDesconto, subtotalCalculado);
            else if (couponData.tipoDesconto === 'freteGratis') discount = taxaAplicada;

            setAppliedCoupon(couponData);
            setDiscountAmount(discount);
            toast.success('Cupom aplicado!');
        } catch (error) {
            toast.error(error.message);
            setAppliedCoupon(null);
            setDiscountAmount(0);
        } finally {
            setCouponLoading(false);
        }
    };

    const removeAppliedCoupon = () => {
        setAppliedCoupon(null);
        setDiscountAmount(0);
        setCouponCodeInput('');
        toast.info('Cupom removido.');
    };

    // --- PAGAMENTO E PEDIDO ---

    const prepararParaPagamento = () => {
        if (!currentUser) return setShowLoginPrompt(true);
        if (!actualEstabelecimentoId) return toast.error('Erro de carregamento. Atualize a página.');
        if (!nomeCliente.trim() || !telefoneCliente.trim() || carrinho.length === 0) return toast.warn('Preencha seus dados e adicione itens.');
        if (!isRetirada && (!rua.trim() || !numero.trim() || !bairro.trim() || !cidade.trim())) return toast.warn('Endereço incompleto.');

        const itensFormatados = carrinho.map(item => ({
            nome: formatarItemCarrinho(item),
            nomeBase: item.nome,
            quantidade: item.qtd,
            preco: Number(item.precoFinal),
            imageUrl: item.imageUrl || null,
            adicionais: item.adicionais || [],
            variacaoSelecionada: item.variacaoSelecionada || null,
            removidos: item.removidos || [],
            observacao: item.observacao || null
        }));

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
            itens: itensFormatados,
            status: 'aguardando_pagamento',
            createdAt: serverTimestamp(),
            tipo: isRetirada ? 'retirada' : 'delivery',
            formaPagamento: 'processando',
            taxaEntrega: taxaAplicada,
            totalFinal: finalOrderTotal,
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

        setPedidoParaPagamento(pedido);
        setShowPaymentModal(true);
    };

    const handlePagamentoSucesso = async (paymentResult) => {
        if (!pedidoParaPagamento) {
            console.error("Pedido perdido no estado.");
            toast.error("Erro interno: Pedido não encontrado.");
            return;
        }

        setProcessandoPagamento(true);
        
        try {
            // BLINDAGEM CONTRA UNDEFINED
            const pedidoFinal = {
                ...pedidoParaPagamento,
                status: 'recebido',
                formaPagamento: paymentResult.method || 'desconhecido',
                statusPagamento: 'aprovado',
                transactionId: paymentResult.transactionId || `tx_${Date.now()}`, 
                paymentData: {
                    method: paymentResult.method || 'desconhecido',
                    amount: paymentResult.amount || 0,
                    timestamp: new Date().toISOString()
                }
            };

            // Processar Cupom
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

            const docRef = await addDoc(collection(db, 'pedidos'), pedidoFinal);
            
            setConfirmedOrderDetails({
                id: docRef.id,
                ...pedidoFinal
            });

            setShowOrderConfirmationModal(true);
            toast.success('🎉 Pedido confirmado com sucesso!');
            
            setCarrinho([]);
            setAppliedCoupon(null);
            setDiscountAmount(0);
            setCouponCodeInput('');
            setShowPaymentModal(false);
            setPedidoParaPagamento(null);

        } catch (error) {
            console.error("❌ Erro CRÍTICO ao salvar pedido:", error);
            toast.error(`Erro ao salvar: ${error.message}`);
        } finally {
            setProcessandoPagamento(false);
        }
    };

    const handlePagamentoFalha = (error) => {
        toast.error(`Falha no pagamento: ${error.message}`);
    };

    // --- AUTH MODAL ---
    const handleLoginModal = async (e) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, emailAuthModal, passwordAuthModal);
            toast.success('Login realizado!');
            setShowLoginPrompt(false);
        } catch (error) {
            toast.error("Erro no login. Verifique senha/email.");
        }
    };

    const handleRegisterModal = async (e) => {
        e.preventDefault();
        if (!nomeAuthModal || !telefoneAuthModal || !ruaAuthModal) return toast.error("Preencha todos os campos.");
        try {
            const cred = await createUserWithEmailAndPassword(auth, emailAuthModal, passwordAuthModal);
            await setDocFirestore(doc(db, 'clientes', cred.user.uid), {
                nome: nomeAuthModal, telefone: telefoneAuthModal, email: emailAuthModal,
                endereco: { rua: ruaAuthModal, numero: numeroAuthModal, bairro: bairroAuthModal, cidade: cidadeAuthModal, complemento: complementoAuthModal || null },
                criadoEm: Timestamp.now()
            });
            toast.success('Conta criada!');
            setShowLoginPrompt(false);
        } catch (error) {
            toast.error("Erro ao criar conta.");
        }
    };

    // --- EFEITOS ---
    useEffect(() => {
        if (!actualEstabelecimentoId) return;
        const unsubscribe = onSnapshot(doc(db, 'estabelecimentos', actualEstabelecimentoId), (doc) => {
            if (doc.exists() && doc.data().cores) setCoresEstabelecimento(doc.data().cores);
        });
        return () => unsubscribe();
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
            
            const produtos = await carregarProdutosRapido(id);
            
            setEstabelecimentoInfo({ ...data, id });
            setActualEstabelecimentoId(id);
            setNomeEstabelecimento(data.nome);
            if (data.cores) setCoresEstabelecimento(data.cores);
            
            setAllProdutos(produtos);
            const cats = ['Todos', ...new Set(produtos.map(p => p.categoria).filter(Boolean))];
            setAvailableCategories(cats);
            
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
        let processados = [...allProdutos];
        if (selectedCategory !== 'Todos') processados = processados.filter(p => p.categoria === selectedCategory);
        if (searchTerm) processados = processados.filter(p => p.nome.toLowerCase().includes(searchTerm.toLowerCase()));
        setProdutosFiltrados(processados);
    }, [allProdutos, selectedCategory, searchTerm]);

    const ordenarCategorias = (categorias, ordemPersonalizada) => {
        const semTodos = categorias.filter(c => c !== 'Todos');
        if (!ordemPersonalizada) return ['Todos', ...semTodos.sort((a, b) => {
            const countA = allProdutos.filter(p => p.categoria === a).length;
            const countB = allProdutos.filter(p => p.categoria === b).length;
            return countB - countA;
        })];
        const ordenados = ordemPersonalizada.filter(c => semTodos.includes(c));
        const novos = semTodos.filter(c => !ordenados.includes(c));
        return ['Todos', ...ordenados, ...novos];
    };

    const handleShowMore = (cat) => setVisibleItemsCount(p => ({ ...p, [cat]: (p[cat] || 4) + 4 }));
    const handleShowLess = (cat) => setVisibleItemsCount(p => ({ ...p, [cat]: 4 }));

    // COMPONENTES VISUAIS
    const InfoEstabelecimento = () => (
        estabelecimentoInfo ? (
            <div className="bg-gray-800 rounded-xl p-6 mb-6 border border-gray-700 flex flex-col md:flex-row gap-6 items-start">
                {estabelecimentoInfo.logoUrl && <img src={estabelecimentoInfo.logoUrl} className="w-24 h-24 rounded-xl object-cover border-2" style={{ borderColor: coresEstabelecimento.primaria }} alt="Logo" />}
                <div className="flex-1">
                    <h1 className="text-3xl font-bold mb-2" style={{ color: coresEstabelecimento.texto.principal }}>{estabelecimentoInfo.nome}</h1>
                    <p className="text-lg mb-4" style={{ color: coresEstabelecimento.texto.secundario }}>{estabelecimentoInfo.descricao}</p>
                    <div className="grid md:grid-cols-2 gap-4 text-sm" style={{ color: coresEstabelecimento.texto.secundario }}>
                        {estabelecimentoInfo.endereco?.rua && <p>📍 {estabelecimentoInfo.endereco.rua}, {estabelecimentoInfo.endereco.numero}</p>}
                        {estabelecimentoInfo.telefone && <p>📞 {estabelecimentoInfo.telefone}</p>}
                        {estabelecimentoInfo.horarioFuncionamento && <p>🕒 {formatarHorarios(estabelecimentoInfo.horarioFuncionamento)}</p>}
                    </div>
                </div>
            </div>
        ) : null
    );

    // RENDERIZAÇÃO
    if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-white">Carregando...</div>;
    
    const menuAgrupado = produtosFiltrados.reduce((acc, p) => {
        const cat = p.categoria || 'Outros';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(p);
        return acc;
    }, {});

return (
        // MUDANÇA AQUI: style com pb-200px força o scroll passar por baixo de tudo
        <div 
            className="w-full relative overflow-x-hidden" 
            style={{ 
                backgroundColor: coresEstabelecimento.background, 
                color: coresEstabelecimento.texto.principal,
                minHeight: '100vh',
                paddingBottom: '200px' // Força bruta para não cortar no mobile
            }}
        >
            
            <div className="py-4 px-4 shadow-lg mb-6 w-full" style={{ backgroundColor: coresEstabelecimento.primaria }}>
                <h1 className="text-center text-2xl font-bold text-white truncate">{nomeEstabelecimento}</h1>
            </div>

            <div className="max-w-7xl mx-auto px-4 w-full">
                <InfoEstabelecimento />
                
                {/* Filtros */}
                <div className="bg-gray-900 p-4 mb-8 border-b border-gray-700 sticky top-0 z-40 shadow-xl -mx-4 px-8 md:mx-0 md:px-4 md:rounded-lg">
                  <div className="max-w-7xl mx-auto">
                    <input 
                      type="text" 
                      placeholder="🔍 Buscar produto..." 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full p-3 mb-4 bg-gray-800 rounded-lg border border-gray-600 focus:outline-none focus:border-green-500 text-base"
                      style={{ color: coresEstabelecimento.texto.principal }}
                    />
                    <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
                      {ordenarCategorias(availableCategories, estabelecimentoInfo?.ordemCategorias).map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                            selectedCategory === cat 
                              ? 'text-white shadow-lg transform scale-105' 
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                          }`}
                          style={{ 
                            backgroundColor: selectedCategory === cat ? coresEstabelecimento.primaria : '',
                            border: selectedCategory === cat ? `2px solid ${coresEstabelecimento.destaque}` : '2px solid transparent'
                          }}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Lista de Produtos */}
                {Object.keys(menuAgrupado).length === 0 ? (
                    <p className="text-center text-gray-500 mt-10">Nenhum produto encontrado.</p>
                ) : (
                    ordenarCategorias(Object.keys(menuAgrupado), estabelecimentoInfo?.ordemCategorias).map(cat => {
                        if (cat === 'Todos' || !menuAgrupado[cat]) return null;
                        const items = menuAgrupado[cat];
                        const visible = visibleItemsCount[cat] || 4;
                        
                        return (
                            <div key={cat} id={`categoria-${cat}`} className="mb-8">
                                <h2 className="text-2xl font-bold mb-4 flex justify-between items-center">
                                    {cat} <span className="text-sm font-normal bg-gray-800 px-2 py-1 rounded text-gray-400">{items.length}</span>
                                </h2>
                                <div className="grid gap-4">
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
                                    <button 
                                        onClick={() => visible >= items.length ? handleShowLess(cat) : handleShowMore(cat)}
                                        className="w-full mt-2 py-2 text-sm font-bold text-gray-400 hover:text-white bg-gray-800 rounded-lg transition"
                                    >
                                        {visible >= items.length ? 'Ver menos' : `Ver mais (${items.length - visible})`}
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}

                {/* Dados do Cliente e Carrinho */}
                <div className="grid md:grid-cols-2 gap-8 mt-12 pb-12">
                    {/* Formulário Cliente */}
                    <div className="bg-gray-900 p-6 rounded-xl border border-gray-700">
                        <h3 className="text-xl font-bold mb-4">👤 Seus Dados</h3>
                        <div className="space-y-4">
                            <input className="w-full p-3 bg-gray-800 rounded border border-gray-600 text-base" placeholder="Nome *" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} />
                            <input className="w-full p-3 bg-gray-800 rounded border border-gray-600 text-base" placeholder="Telefone (WhatsApp) *" type="tel" value={telefoneCliente} onChange={e => setTelefoneCliente(e.target.value)} />
                            
                            <div className="flex gap-2">
                                <button onClick={() => setIsRetirada(false)} className={`flex-1 p-3 rounded font-bold transition-colors ${!isRetirada ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}>🚚 Entrega</button>
                                <button onClick={() => setIsRetirada(true)} className={`flex-1 p-3 rounded font-bold transition-colors ${isRetirada ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300'}`}>🏪 Retirada</button>
                            </div>

                            {!isRetirada && (
                                <>
                                    <div className="flex gap-2">
                                        <input className="flex-1 p-3 bg-gray-800 rounded border border-gray-600 text-base" placeholder="Rua *" value={rua} onChange={e => setRua(e.target.value)} />
                                        <input className="w-24 p-3 bg-gray-800 rounded border border-gray-600 text-base" placeholder="Nº *" value={numero} onChange={e => setNumero(e.target.value)} />
                                    </div>
                                    <input className="w-full p-3 bg-gray-800 rounded border border-gray-600 text-base" placeholder="Bairro *" value={bairro} onChange={e => setBairro(e.target.value)} />
                                    <input className="w-full p-3 bg-gray-800 rounded border border-gray-600 text-base" placeholder="Cidade *" value={cidade} onChange={e => setCidade(e.target.value)} />
                                    <input className="w-full p-3 bg-gray-800 rounded border border-gray-600 text-base" placeholder="Complemento" value={complemento} onChange={e => setComplemento(e.target.value)} />
                                </>
                            )}
                        </div>
                    </div>

                    {/* Resumo do Pedido */}
                    <div className="bg-gray-900 p-6 rounded-xl border border-gray-700 mb-8">
                        <h3 className="text-xl font-bold mb-4">🛒 Resumo</h3>
                        {carrinho.length === 0 ? <p className="text-gray-500">Seu carrinho está vazio.</p> : (
                            <>
                                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                    {carrinho.map(item => (
                                        <div key={item.cartItemId} className="flex justify-between items-start bg-gray-800 p-3 rounded">
                                            <div className="flex-1 pr-2">
                                                <p className="font-bold text-sm text-white">{formatarItemCarrinho(item)}</p>
                                                <p className="text-xs text-gray-400">R$ {item.precoFinal.toFixed(2)} x {item.qtd}</p>
                                            </div>
                                            <button onClick={() => removerDoCarrinho(item.cartItemId)} className="text-red-500 font-bold p-1 hover:bg-gray-700 rounded">✕</button>
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="border-t border-gray-700 pt-4 space-y-2 text-sm">
                                    <div className="flex justify-between text-gray-300"><span>Subtotal:</span> <span>R$ {subtotalCalculado.toFixed(2)}</span></div>
                                    {!isRetirada && <div className="flex justify-between text-gray-300"><span>Taxa de Entrega:</span> <span>R$ {taxaAplicada.toFixed(2)}</span></div>}
                                    {discountAmount > 0 && <div className="flex justify-between text-green-400 font-bold"><span>Desconto:</span> <span>- R$ {discountAmount.toFixed(2)}</span></div>}
                                    
                                    <div className="flex gap-2 mt-4 pt-2 border-t border-gray-800">
                                        <input 
                                            placeholder="CUPOM" 
                                            value={couponCodeInput} 
                                            onChange={e => setCouponCodeInput(e.target.value)} 
                                            className="flex-1 bg-gray-800 p-2 rounded border border-gray-600 text-sm text-white uppercase"
                                        />
                                        <button 
                                            onClick={appliedCoupon ? removeAppliedCoupon : handleApplyCoupon} 
                                            disabled={couponLoading}
                                            className={`px-3 rounded text-sm font-bold ${appliedCoupon ? 'bg-red-600' : 'bg-green-600'} text-white`}
                                        >
                                            {couponLoading ? '...' : (appliedCoupon ? 'Remover' : 'Aplicar')}
                                        </button>
                                    </div>

                                    <div className="flex justify-between text-xl font-bold mt-4 pt-4 border-t border-gray-700 text-white">
                                        <span>Total:</span>
                                        <span style={{ color: coresEstabelecimento.destaque }}>R$ {finalOrderTotal.toFixed(2)}</span>
                                    </div>
                                </div>

                                <button 
                                    onClick={prepararParaPagamento}
                                    className="w-full mt-6 py-4 rounded-xl font-bold text-lg text-white shadow-lg transform active:scale-95 transition-all"
                                    style={{ backgroundColor: coresEstabelecimento.destaque }}
                                >
                                    ✅ Finalizar Pedido
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* MODAIS E CARRINHO FLUTUANTE */}
            <div className="relative z-50">
                 <CarrinhoFlutuante carrinho={carrinho} coresEstabelecimento={coresEstabelecimento} />
            </div>
            
            {showPaymentModal && pedidoParaPagamento && (
                <PaymentModal
                    isOpen={showPaymentModal}
                    onClose={() => setShowPaymentModal(false)}
                    amount={finalOrderTotal}
                    orderId={`ord_${Date.now()}`}
                    cartItems={carrinho}
                    customer={pedidoParaPagamento.cliente}
                    onSuccess={handlePagamentoSucesso}
                    onError={handlePagamentoFalha}
                    coresEstabelecimento={coresEstabelecimento}
                    pixKey={estabelecimentoInfo?.chavePix} 
                    establishmentName={estabelecimentoInfo?.nome}
                />
            )}

            {/* Resto dos modais (Login, Variacoes, Confirmation) ficam aqui igual antes... */}
            {showOrderConfirmationModal && confirmedOrderDetails && (
                <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 p-8 rounded-2xl max-w-md w-full text-center border border-gray-700">
                        <div className="text-6xl mb-4">🎉</div>
                        <h2 className="text-3xl font-bold text-white mb-2">Pedido Confirmado!</h2>
                        <p className="text-gray-400 mb-6">ID: {confirmedOrderDetails.id}</p>
                        <button onClick={() => setShowOrderConfirmationModal(false)} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold">Fechar</button>
                    </div>
                </div>
            )}

            {showLoginPrompt && (
                <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 px-4">
                    <div className="bg-gray-900 p-6 rounded-2xl w-full max-w-md border border-gray-700 relative">
                        <button onClick={() => setShowLoginPrompt(false)} className="absolute top-4 right-4 text-gray-400 text-2xl">&times;</button>
                        <h2 className="text-2xl font-bold text-white mb-6 text-center">{isRegisteringInModal ? 'Criar Conta' : 'Login'}</h2>
                        <form onSubmit={isRegisteringInModal ? handleRegisterModal : handleLoginModal} className="space-y-4">
                            {isRegisteringInModal && (
                                <>
                                    <input placeholder="Nome" value={nomeAuthModal} onChange={e => setNomeAuthModal(e.target.value)} className="w-full p-3 bg-gray-800 rounded border border-gray-600 text-base" />
                                    <input placeholder="Telefone" value={telefoneAuthModal} onChange={e => setTelefoneAuthModal(e.target.value)} className="w-full p-3 bg-gray-800 rounded border border-gray-600 text-base" />
                                    <input placeholder="Rua" value={ruaAuthModal} onChange={e => setRuaAuthModal(e.target.value)} className="w-full p-3 bg-gray-800 rounded border border-gray-600 text-base" />
                                </>
                            )}
                            <input type="email" placeholder="Email" value={emailAuthModal} onChange={e => setEmailAuthModal(e.target.value)} className="w-full p-3 bg-gray-800 rounded border border-gray-600 text-base" />
                            <input type="password" placeholder="Senha" value={passwordAuthModal} onChange={e => setPasswordAuthModal(e.target.value)} className="w-full p-3 bg-gray-800 rounded border border-gray-600 text-base" />
                            <button type="submit" className="w-full bg-green-600 text-white py-3 rounded font-bold">{isRegisteringInModal ? 'Cadastrar' : 'Entrar'}</button>
                        </form>
                        <button onClick={() => setIsRegisteringInModal(!isRegisteringInModal)} className="w-full mt-4 text-green-500 text-sm">{isRegisteringInModal ? 'Já tenho conta' : 'Criar conta'}</button>
                    </div>
                </div>
            )}

            {itemParaVariacoes && <VariacoesModal item={itemParaVariacoes} onConfirm={handleConfirmarVariacoes} onClose={() => setItemParaVariacoes(null)} coresEstabelecimento={coresEstabelecimento} />}
            {itemParaAdicionais && <AdicionaisModal item={itemParaAdicionais} onConfirm={handleConfirmarAdicionais} onClose={() => setItemParaAdicionais(null)} coresEstabelecimento={coresEstabelecimento} />}
        </div>
    );
}

export default Menu;