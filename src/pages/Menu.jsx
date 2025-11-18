// src/pages/Menu.jsx - VERSÃO CORRIGIDA E ATUALIZADA
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, Timestamp, getDoc as getDocFirestore, setDoc as setDocFirestore, runTransaction, doc, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import CardapioItem from '../components/CardapioItem';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import AdicionaisModal from '../components/AdicionaisModal';
import VariacoesModal from '../components/VariacoesModal';
import { v4 as uuidv4 } from 'uuid';
import { useAI } from '../context/AIContext';
import AIChatAssistant from '../components/AIChatAssistant';
import { IoChatbubbleEllipses, IoCart, IoClose, IoChevronUp, IoChevronDown } from 'react-icons/io5';
import CarrinhoFlutuante from '../components/CarrinhoFlutuante';

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
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [availableCategories, setAvailableCategories] = useState([]);
    const [itemParaAdicionais, setItemParaAdicionais] = useState(null);
    const [itemParaVariacoes, setItemParaVariacoes] = useState(null);
    const [visibleItemsCount, setVisibleItemsCount] = useState({});
    const [loading, setLoading] = useState(true);

    // 🆕 ESTADOS DAS MELHORIAS
    const [showAIChat, setShowAIChat] = useState(false);
    const [navegacaoRapidaVisivel, setNavegacaoRapidaVisivel] = useState(true);

    // 🎨 CORES DO ESTABELECIMENTO
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

    // 🔧 Verificar se o usuário é admin
    const isUserAdmin = useMemo(() => {
        return userData?.isAdmin || false;
    }, [userData]);

    const isUserMasterAdmin = useMemo(() => {
        return userData?.isMasterAdmin || false;
    }, [userData]);

    // 🕒 FUNÇÃO PARA FORMATAR HORÁRIOS DE FUNCIONAMENTO
    const formatarHorarios = (horarios) => {
        if (!horarios || typeof horarios !== 'object') {
            return "Horário não informado";
        }

        const diasSemana = {
            seg: 'Segunda',
            ter: 'Terça',
            qua: 'Quarta',
            qui: 'Quinta',
            sex: 'Sexta',
            sab: 'Sábado',
            dom: 'Domingo'
        };

        return Object.entries(horarios)
            .map(([dia, horario]) => {
                const diaNome = diasSemana[dia] || dia;
                if (!horario || !horario.abertura || !horario.fechamento) {
                    return `${diaNome}: Fechado`;
                }
                return `${diaNome}: ${horario.abertura} - ${horario.fechamento}`;
            })
            .join(' | ');
    };

    // 🚀 FUNÇÃO ULTRA RÁPIDA PARA CARREGAR PRODUTOS
    const carregarProdutosRapido = async (estabId) => {
        console.log("🚀 CARREGAMENTO RÁPIDO INICIADO");

        try {
            const todasCategoriasRef = collection(db, 'estabelecimentos', estabId, 'cardapio');
            const categoriasSnapshot = await getDocs(todasCategoriasRef);

            let todosProdutos = [];
            const promessas = [];

            if (!categoriasSnapshot.empty) {
                console.log(`📂 Encontradas ${categoriasSnapshot.docs.length} categorias`);

                categoriasSnapshot.docs.forEach(catDoc => {
                    const categoriaData = catDoc.data();
                    const categoriaId = catDoc.id;

                    const promessa = getDocs(
                        collection(db, 'estabelecimentos', estabId, 'cardapio', categoriaId, 'itens')
                    ).then(itensSnapshot => {
                        if (!itensSnapshot.empty) {
                            const itensDaCategoria = itensSnapshot.docs.map(itemDoc => ({
                                ...itemDoc.data(),
                                id: itemDoc.id,
                                categoria: categoriaData.nome || 'Geral',
                                categoriaId: categoriaId
                            }));
                            return itensDaCategoria;
                        }
                        return [];
                    }).catch(error => {
                        console.log(`ℹ️ Nenhum item na categoria ${categoriaId}`);
                        return [];
                    });

                    promessas.push(promessa);
                });

                const resultados = await Promise.all(promessas);
                todosProdutos = resultados.flat();
            }

            if (todosProdutos.length === 0) {
                console.log("🔄 Tentando estrutura alternativa...");
                const cardapioDiretoRef = collection(db, 'estabelecimentos', estabId, 'cardapio');
                const qAtivos = query(cardapioDiretoRef, where('ativo', '==', true));
                const snapshotDireto = await getDocs(qAtivos);

                if (!snapshotDireto.empty) {
                    todosProdutos = snapshotDireto.docs.map(doc => ({
                        ...doc.data(),
                        id: doc.id,
                        categoria: doc.data().categoria || 'Geral',
                        categoriaId: 'direto'
                    }));
                }
            }

            console.log(`🎉 CARREGAMENTO CONCLUÍDO: ${todosProdutos.length} produtos`);
            return todosProdutos;

        } catch (error) {
            console.error("❌ Erro no carregamento rápido:", error);
            return [];
        }
    };

    // 🎯 FUNÇÕES CORRIGIDAS - SEM DUPLICAÇÃO
    const handleAbrirModalProduto = (item) => {
        if (!currentUser) {
            toast.warn('Para adicionar itens, por favor, faça login ou cadastre-se.');
            setShowLoginPrompt(true);
            return;
        }

        // Só abre modal se tiver variações (CardapioItem.jsx garante que só chega aqui se tiver 2+ variações)
        if (item.variacoes && Array.isArray(item.variacoes) && item.variacoes.length > 0) {
            setItemParaVariacoes(item);
        }
        // Se não tem variações, NÃO faz nada - o CardapioItem já chamou onQuickAdd
    };

    const handleAdicionarRapido = (item) => {
        if (!currentUser) {
            toast.warn('Para adicionar itens, por favor, faça login ou cadastre-se.');
            setShowLoginPrompt(true);
            return;
        }

        // Adiciona direto. O item já vem com 'variacaoSelecionada' e 'precoFinal' se tiver 1 variação.
        const precoParaCarrinho = item.precoFinal !== undefined && item.precoFinal !== null ? item.precoFinal : item.preco;

        const novoItemNoCarrinho = {
            ...item,
            qtd: 1,
            cartItemId: uuidv4(),
            precoFinal: precoParaCarrinho // Usa precoFinal (vindo de 1 variação ou base)
        };
        setCarrinho(prevCarrinho => [...prevCarrinho, novoItemNoCarrinho]);
        toast.success(`${item.nome} foi adicionado ao carrinho! 🎉`);
    };

    const handleConfirmarVariacoes = (itemConfigurado) => {
        // Se o item tiver adicionais, abre modal de adicionais
        if (itemConfigurado.adicionais && Array.isArray(itemConfigurado.adicionais) && itemConfigurado.adicionais.length > 0) {
            setItemParaAdicionais(itemConfigurado);
            setItemParaVariacoes(null);
        } else {
            // Se não tem adicionais, adiciona direto ao carrinho
            const novoItemNoCarrinho = {
                ...itemConfigurado,
                qtd: 1,
                cartItemId: uuidv4(),
                precoFinal: itemConfigurado.precoSelecionado || itemConfigurado.preco
            };
            setCarrinho(prevCarrinho => [...prevCarrinho, novoItemNoCarrinho]);
            toast.success(`${itemConfigurado.nome} foi adicionado ao carrinho!`);
            setItemParaVariacoes(null);
        }
    };

    const handleFecharModalVariacoes = () => {
        setItemParaVariacoes(null);
    };

    const handleFecharModalAdicionais = () => {
        setItemParaAdicionais(null);
    };

    const handleConfirmarAdicionais = (itemConfigurado) => {
        const novoItemNoCarrinho = {
            ...itemConfigurado,
            qtd: 1,
            cartItemId: uuidv4(),
            precoFinal: itemConfigurado.precoFinal || itemConfigurado.precoSelecionado || itemConfigurado.preco
        };
        setCarrinho(prevCarrinho => [...prevCarrinho, novoItemNoCarrinho]);
        toast.success(`${itemConfigurado.nome} foi adicionado ao carrinho!`);
        handleFecharModalAdicionais();
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

    // 🆕 FUNÇÃO PARA FORMATAR ITENS NO CARRINHO
    const formatarItemCarrinho = (item) => {
        let nomeFormatado = item.nome;

        if (item.variacaoSelecionada && item.variacaoSelecionada.nome) {
            nomeFormatado += ` - ${item.variacaoSelecionada.nome}`;
        }

        if (item.adicionais && item.adicionais.length > 0) {
            nomeFormatado += ` (${item.adicionais.map(ad => `+ ${ad.nome}`).join(', ')})`;
        }

        if (item.removidos && item.removidos.length > 0) {
            nomeFormatado += ` (Sem: ${item.removidos.join(', ')})`;
        }

        if (item.observacao) {
            nomeFormatado += ` (Obs: ${item.observacao})`;
        }

        return nomeFormatado;
    };

    // 🔧 FUNÇÃO APLICAR CUPOM
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

    // 🔧 FUNÇÕES DE AUTENTICAÇÃO
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

    // --- EFEITOS OTIMIZADOS ---

    // 🚀 EFEITO PRINCIPAL - CARREGAMENTO COMPLETO DO ESTABELECIMENTO
    useEffect(() => {
        if (!estabelecimentoSlug) return;

        const carregarTudoRapidamente = async () => {
            try {
                setLoading(true);
                console.log("🚀 INICIANDO CARREGAMENTO COMPLETO");

                // 1. Buscar estabelecimento pelo slug
                const qEstabBySlug = query(
                    collection(db, 'estabelecimentos'),
                    where('slug', '==', estabelecimentoSlug)
                );
                const estabSnapshotBySlug = await getDocs(qEstabBySlug);

                if (estabSnapshotBySlug.empty) {
                    console.error("❌ Estabelecimento não encontrado");
                    toast.error("Estabelecimento não encontrado.");
                    setLoading(false);
                    navigate('/');
                    return;
                }

                const estabDoc = estabSnapshotBySlug.docs[0];
                const estabData = estabDoc.data();
                const idDoEstabelecimentoReal = estabDoc.id;

                console.log("✅ Estabelecimento encontrado:", estabData.nome);
                console.log("📋 Ordem de categorias do Firebase:", estabData.ordemCategorias);

                // 🎯 CARREGAMENTO PARALELO: Estabelecimento + Produtos
                const [produtos] = await Promise.all([
                    carregarProdutosRapido(idDoEstabelecimentoReal)
                ]);

                // 🏪 DEFINIR TODOS OS DADOS DO ESTABELECIMENTO
                const estabelecimentoInfoCompleta = {
                    ...estabData,
                    id: idDoEstabelecimentoReal,
                    nome: estabData.nome || "Cardápio",
                    descricao: estabData.descricao || "",
                    endereco: estabData.endereco || {},
                    horarioFuncionamento: estabData.horarioFuncionamento || {},
                    telefone: estabData.telefone || "",
                    whatsapp: estabData.whatsapp || "",
                    logoUrl: estabData.logoUrl || "",
                    ordemCategorias: estabData.ordemCategorias || [],
                    cores: estabData.cores || {
                        primaria: '#000000ff',
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
                    }
                };

                setEstabelecimentoInfo(estabelecimentoInfoCompleta);
                setNomeEstabelecimento(estabData.nome || "Cardápio");
                setActualEstabelecimentoId(idDoEstabelecimentoReal);

                // 📦 CONFIGURAR PRODUTOS
                if (produtos.length > 0) {
                    setAllProdutos(produtos);
                    const categoriasUnicas = ['Todos', ...new Set(produtos.map(item => item.categoria).filter(Boolean))];
                    setAvailableCategories(categoriasUnicas);

                    console.log("📊 Categorias disponíveis:", categoriasUnicas);
                    console.log("🎯 Ordem que será aplicada:", estabelecimentoInfoCompleta.ordemCategorias);

                    const initialVisibleCounts = {};
                    categoriasUnicas.forEach(cat => {
                        if (cat !== 'Todos') {
                            initialVisibleCounts[cat] = 4;
                        }
                    });
                    setVisibleItemsCount(initialVisibleCounts);
                } else {
                    setAllProdutos([]);
                    setAvailableCategories(['Todos']);
                }

                console.log("🎊 CARREGAMENTO COMPLETO CONCLUÍDO!");
                setLoading(false);

            } catch (error) {
                console.error("❌ Erro no carregamento completo:", error);
                toast.error("Erro ao carregar o cardápio.");
                setLoading(false);
            }
        };

        carregarTudoRapidamente();
    }, [estabelecimentoSlug, navigate]);

    // 🎯 FUNÇÃO PARA ORDENAR CATEGORIAS DINAMICAMENTE - VERSÃO CORRIGIDA
    const ordenarCategorias = (categorias, ordemPersonalizada) => {
        console.log('🔀 Ordenando categorias:', {
            categoriasDisponiveis: categorias,
            ordemPersonalizada: ordemPersonalizada
        });

        // "Todos" sempre deve ser o primeiro
        const categoriasSemTodos = categorias.filter(cat => cat !== 'Todos');

        if (!ordemPersonalizada || ordemPersonalizada.length === 0) {
            console.log('ℹ️ Usando ordem por quantidade de itens');
            // Se não tem ordem definida, ordena por quantidade de itens (mais popular primeiro)
            const categoriasOrdenadas = categoriasSemTodos
                .map(category => {
                    const quantidadeItens = allProdutos.filter(item => item.categoria === category).length;
                    return { category, quantidadeItens };
                })
                .sort((a, b) => b.quantidadeItens - a.quantidadeItens)
                .map(({ category }) => category);

            return ['Todos', ...categoriasOrdenadas];
        }

        console.log('✅ Aplicando ordem personalizada do estabelecimento');

        // Filtrar apenas categorias que existem atualmente
        const ordemFiltrada = ordemPersonalizada.filter(category =>
            categoriasSemTodos.includes(category)
        );

        // Adicionar categorias novas que não estão na ordem
        const categoriasNovas = categoriasSemTodos.filter(category =>
            !ordemFiltrada.includes(category)
        );

        const categoriasOrdenadas = ['Todos', ...ordemFiltrada, ...categoriasNovas];

        console.log('📋 Resultado da ordenação:', categoriasOrdenadas);
        return categoriasOrdenadas;
    };

    // 🆕 FUNÇÃO PARA NAVEGAÇÃO RÁPIDA ENTRE CATEGORIAS
    const scrollToCategory = (categoria) => {
        const element = document.getElementById(`categoria-${categoria}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // Efeito para dados do usuário
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

    // Efeito para taxas de entrega
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

    // Efeito para filtrar produtos
    useEffect(() => {
        let produtosProcessados = [...allProdutos];

        if (selectedCategory && selectedCategory !== 'Todos') {
            produtosProcessados = produtosProcessados.filter(item =>
                item.categoria?.toLowerCase() === selectedCategory.toLowerCase()
            );
        }

        if (searchTerm.trim() !== '') {
            const lowerCaseSearchTerm = searchTerm.trim().toLowerCase();
            produtosProcessados = produtosProcessados.filter(item =>
                item.nome?.toLowerCase().includes(lowerCaseSearchTerm) ||
                item.descricao?.toLowerCase().includes(lowerCaseSearchTerm)
            );
        }

        produtosProcessados.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        setProdutosFiltrados(produtosProcessados);
    }, [allProdutos, selectedCategory, searchTerm]);

    // Efeito para carregar pedido anterior
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

    // Efeito para redirecionar admins
    useEffect(() => {
        if (!authLoading && (isUserAdmin || isUserMasterAdmin)) {
            toast.error('Acesso negado. Esta página é exclusiva para clientes.', { toastId: 'admin-redirect' });
        }
    }, [authLoading, isUserAdmin, isUserMasterAdmin]);

    // Funções para mostrar mais/menos itens
    const handleShowMore = (categoryName) => {
        setVisibleItemsCount(prev => ({
            ...prev,
            [categoryName]: (prev[categoryName] || 4) + 4
        }));
    };

    const handleShowLess = (categoryName) => {
        setVisibleItemsCount(prev => ({
            ...prev,
            [categoryName]: 4
        }));
    };

    // 🏪 COMPONENTE DE INFORMAÇÕES DO ESTABELECIMENTO
    const InfoEstabelecimento = () => {
        if (!estabelecimentoInfo) return null;

        return (
            <div className="bg-gray-800 rounded-xl md:rounded-2xl shadow-lg p-4 md:p-6 mb-6 md:mb-8 border border-gray-700">
                <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start">
                    {/* LOGO */}
                    {estabelecimentoInfo.logoUrl && (
                        <div className="flex-shrink-0 mx-auto md:mx-0">
                            <img
                                src={estabelecimentoInfo.logoUrl}
                                alt={`Logo ${estabelecimentoInfo.nome}`}
                                className="w-20 h-20 md:w-32 md:h-32 rounded-xl md:rounded-2xl object-cover border-2"
                                style={{ borderColor: coresEstabelecimento.primaria }}
                            />
                        </div>
                    )}

                    {/* INFORMAÇÕES */}
                    <div className="flex-1 space-y-3 md:space-y-4">
                        {/* NOME E DESCRIÇÃO */}
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2 text-center md:text-left" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                {estabelecimentoInfo.nome}
                            </h1>
                            {estabelecimentoInfo.descricao && (
                                <p className="text-base md:text-lg text-center md:text-left" style={{ color: coresEstabelecimento.texto?.secundario || '#9CA3AF' }}>
                                    {estabelecimentoInfo.descricao}
                                </p>
                            )}
                        </div>

                        {/* GRADE DE INFORMAÇÕES */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            {/* ENDEREÇO */}
                            {estabelecimentoInfo.endereco && estabelecimentoInfo.endereco.rua && (
                                <div className="flex items-start gap-2 md:gap-3">
                                    <span className="text-lg md:text-xl mt-1">📍</span>
                                    <div>
                                        <p className="font-semibold text-sm md:text-base" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                            Endereço
                                        </p>
                                        <p className="text-xs md:text-sm" style={{ color: coresEstabelecimento.texto?.secundario || '#9CA3AF' }}>
                                            {estabelecimentoInfo.endereco.rua}, {estabelecimentoInfo.endereco.numero}
                                            {estabelecimentoInfo.endereco.bairro && ` - ${estabelecimentoInfo.endereco.bairro}`}
                                            {estabelecimentoInfo.endereco.cidade && `, ${estabelecimentoInfo.endereco.cidade}`}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* HORÁRIO */}
                            {estabelecimentoInfo.horarioFuncionamento && (
                                <div className="flex items-start gap-2 md:gap-3">
                                    <span className="text-lg md:text-xl mt-1">🕒</span>
                                    <div>
                                        <p className="font-semibold text-sm md:text-base" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                            Horário
                                        </p>
                                        <p className="text-xs md:text-sm" style={{ color: coresEstabelecimento.texto?.secundario || '#9CA3AF' }}>
                                            {formatarHorarios(estabelecimentoInfo.horarioFuncionamento)}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* TELEFONE */}
                            {estabelecimentoInfo.telefone && (
                                <div className="flex items-start gap-2 md:gap-3">
                                    <span className="text-lg md:text-xl mt-1">📞</span>
                                    <div>
                                        <p className="font-semibold text-sm md:text-base" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                            Telefone
                                        </p>
                                        <p className="text-xs md:text-sm" style={{ color: coresEstabelecimento.texto?.secundario || '#9CA3AF' }}>
                                            {estabelecimentoInfo.telefone}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* WHATSAPP */}
                            {estabelecimentoInfo.whatsapp && (
                                <div className="flex items-start gap-2 md:gap-3">
                                    <span className="text-lg md:text-xl mt-1">💬</span>
                                    <div>
                                        <p className="font-semibold text-sm md:text-base" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                            WhatsApp
                                        </p>
                                        <p className="text-xs md:text-sm" style={{ color: coresEstabelecimento.texto?.secundario || '#9CA3AF' }}>
                                            {estabelecimentoInfo.whatsapp}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // 🆕 COMPONENTE DE NAVEGAÇÃO RÁPIDA
    const NavegacaoRapida = () => {
        if (availableCategories.length <= 1) return null;

        return (
            <div className="bg-gray-800 rounded-xl p-4 mb-6 sticky top-4 z-40 shadow-lg">
                <h3 className="font-semibold mb-3 text-sm" style={{ color: coresEstabelecimento.texto?.principal }}>
                    🎯 Navegação Rápida
                </h3>
                <div className="flex flex-wrap gap-2">
                    {ordenarCategorias(
                        availableCategories,
                        estabelecimentoInfo?.ordemCategorias
                    )
                        .slice(0, 8)
                        .map((categoria) => (
                            <button
                                key={categoria}
                                onClick={() => scrollToCategory(categoria)}
                                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-medium transition-colors"
                                style={{
                                    color: coresEstabelecimento.texto?.secundario,
                                    backgroundColor: selectedCategory === categoria ? coresEstabelecimento.primaria : ''
                                }}
                            >
                                {categoria === 'Todos' ? '📋 Todos' : categoria}
                            </button>
                        ))}
                </div>
            </div>
        );
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: coresEstabelecimento.background }}>
                <div className="text-center">
                    <div
                        className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
                        style={{ borderColor: coresEstabelecimento.primaria }}
                    ></div>
                    <p className="text-lg font-medium" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                        Carregando cardápio...
                    </p>
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
        <div className="min-h-screen pb-32 md:pb-0" style={{
            backgroundColor: coresEstabelecimento.background,
            color: coresEstabelecimento.texto?.principal || '#FFFFFF'
        }}>
            {/* Header Simplificado */}
            <div className="shadow-lg" style={{ backgroundColor: coresEstabelecimento.primaria }}>
                <div className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-6">
                    <div className="text-center text-white">
                        <h1 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2 drop-shadow-sm">
                            {nomeEstabelecimento}
                        </h1>
                        <p className="text-white text-opacity-90 text-sm md:text-base">
                            Cardápio Digital
                        </p>
                    </div>
                </div>
            </div>

            {/* Conteúdo Principal */}
            <div className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-6">
                {/* 🏪 INFORMAÇÕES DO ESTABELECIMENTO */}

                {/* Search and Filters - VERSÃO RESPONSIVA */}
                <div className="bg-gray-900 rounded-xl md:rounded-2xl shadow-xl p-4 md:p-6 mb-6 md:mb-8 border border-gray-700">
                    {/* Search */}
                    <div className="mb-4 md:mb-6">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="🔍 Buscar por nome ou descrição..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-4 md:px-6 py-3 md:py-4 border border-gray-600 rounded-xl md:rounded-2xl text-base md:text-lg focus:ring-2 focus:border-transparent outline-none transition-all duration-200 bg-gray-800 text-white"
                                style={{
                                    focusRingColor: coresEstabelecimento.primaria,
                                    borderColor: `${coresEstabelecimento.primaria}30`
                                }}
                            />
                        </div>
                    </div>

                    {/* BARRA DE CATEGORIAS RESPONSIVA */}
                    <div className="relative">
                        <div className="flex overflow-x-auto gap-2 md:gap-3 pb-3 -mb-3 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                            {/* Todas as categorias ordenadas dinamicamente */}
                            {ordenarCategorias(
                                availableCategories,
                                estabelecimentoInfo?.ordemCategorias
                            ).map((category) => (
                                <button
                                    key={category}
                                    onClick={() => setSelectedCategory(category)}
                                    className={`px-3 md:px-4 py-2 md:py-3 rounded-full text-xs md:text-sm font-semibold transition-all duration-200 transform hover:scale-105 whitespace-nowrap flex-shrink-0 ${selectedCategory === category
                                            ? 'text-white shadow-lg'
                                            : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                                        }`}
                                    style={
                                        selectedCategory === category
                                            ? { backgroundColor: coresEstabelecimento.primaria }
                                            : {}
                                    }
                                >
                                    {category === 'Todos' ? '📋 Todos' : category}
                                </button>
                            ))}

                            {/* Botão Limpar Filtros */}
                            {(searchTerm || selectedCategory !== 'Todos') && (
                                <button
                                    onClick={() => { setSearchTerm(''); setSelectedCategory('Todos'); }}
                                    className="px-3 md:px-4 py-2 md:py-3 rounded-full text-xs md:text-sm font-semibold bg-gray-600 text-white hover:bg-gray-500 transition-all duration-200 transform hover:scale-105 whitespace-nowrap flex-shrink-0"
                                >
                                    🗑️ Limpar
                                </button>
                            )}
                        </div>

                        {/* Sombra indicativa de scroll */}
                        <div className="absolute right-0 top-0 bottom-0 w-6 md:w-8 bg-gradient-to-l from-gray-900 to-transparent pointer-events-none"></div>
                    </div>
                </div>

                {/* Menu Items - VERSÃO RESPONSIVA */}
                {produtosFiltrados.length === 0 && allProdutos.length > 0 ? (
                    <div className="text-center py-8">
                        <p style={{ color: coresEstabelecimento.texto?.secundario || '#9CA3AF' }}>
                            Nenhum item encontrado com os filtros selecionados.
                        </p>
                    </div>
                ) : allProdutos.length === 0 ? (
                    <div className="text-center py-8">
                        <p style={{ color: coresEstabelecimento.texto?.secundario || '#9CA3AF' }}>
                            Este estabelecimento ainda não possui itens no cardápio.
                        </p>
                    </div>
                ) : selectedCategory === 'Todos' ? (
                    // QUANDO "TODOS" ESTÁ SELECIONADO - VERSÃO RESPONSIVA
                    ordenarCategorias(
                        Object.keys(menuAgrupado).filter(cat => cat !== 'Outros'),
                        estabelecimentoInfo?.ordemCategorias
                    )
                        .filter(categoria => categoria !== 'Todos')
                        .map((categoria) => {
                            const itemsNestaCategoria = menuAgrupado[categoria] || [];
                            const totalItemsVisiveis = visibleItemsCount[categoria] || 4;
                            const todosItensVisiveis = totalItemsVisiveis >= itemsNestaCategoria.length;

                            if (itemsNestaCategoria.length === 0) return null;

                            return (
                                <div key={categoria} id={`categoria-${categoria}`} className="mb-6 md:mb-8">
                                    {/* CABEÇALHO DA CATEGORIA */}
                                    <div className="flex items-center justify-between mb-3 md:mb-4">
                                        <h2 className="text-xl md:text-2xl font-bold" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                            {categoria}
                                        </h2>
                                        <span className="bg-gray-800 px-2 md:px-3 py-1 rounded-full text-xs md:text-sm" style={{ color: coresEstabelecimento.texto?.secundario || '#9CA3AF' }}>
                                            {itemsNestaCategoria.length} {itemsNestaCategoria.length === 1 ? 'item' : 'itens'}
                                        </span>
                                    </div>

                                    {/* LISTA DE ITENS */}
                                    <div className="space-y-3">
                                        {itemsNestaCategoria.slice(0, totalItemsVisiveis).map((item) => (
                                            <CardapioItem
                                                key={item.id}
                                                item={item}
                                                onAddItem={handleAbrirModalProduto}        // Para produtos com 2+ variações
                                                onQuickAdd={handleAdicionarRapido}         // Para produtos únicos ou com 1 variação
                                                coresEstabelecimento={coresEstabelecimento}
                                            />
                                        ))}
                                    </div>
                                    {itemsNestaCategoria.length > 4 && (
                                        <div className="text-center mt-3 md:mt-4">
                                            {todosItensVisiveis ? (
                                          <button
                                          
    onClick={() => handleShowLess(categoria)}
    className="font-medium text-xs md:text-sm transition-colors px-4 py-2 bg-white text-gray-900 rounded-lg hover:bg-gray-100 shadow-sm border border-gray-200"
>
    ↑ Ver menos
</button>
                                            ) : (
                                               <button
    onClick={() => handleShowMore(categoria)}
    className="font-medium text-xs md:text-sm transition-colors px-4 py-2 bg-white text-gray-900 rounded-lg hover:bg-gray-100 shadow-sm border border-gray-200"
>
    ↓ Ver mais ({itemsNestaCategoria.length - totalItemsVisiveis} restantes)
</button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                ) : (
                    // QUANDO UMA CATEGORIA ESPECÍFICA ESTÁ SELECIONADA - VERSÃO RESPONSIVA
                    (() => {
                        const categoriaSelecionada = selectedCategory;
                        const itemsNestaCategoria = menuAgrupado[categoriaSelecionada] || [];
                        const totalItemsVisiveis = visibleItemsCount[categoriaSelecionada] || 4;
                        const todosItensVisiveis = totalItemsVisiveis >= itemsNestaCategoria.length;

                        return (
                            <div key={categoriaSelecionada} id={`categoria-${categoriaSelecionada}`} className="mb-6 md:mb-8">
                                {/* CABEÇALHO DA CATEGORIA */}
                                <div className="flex items-center justify-between mb-3 md:mb-4">
                                    <h2 className="text-xl md:text-2xl font-bold" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                        {categoriaSelecionada}
                                    </h2>
                                    <span className="bg-gray-800 px-2 md:px-3 py-1 rounded-full text-xs md:text-sm" style={{ color: coresEstabelecimento.texto?.secundario || '#9CA3AF' }}>
                                        {itemsNestaCategoria.length} {itemsNestaCategoria.length === 1 ? 'item' : 'itens'}
                                    </span>
                                </div>

                                {/* LISTA DE ITENS */}
                                <div className="space-y-3">
                                    {itemsNestaCategoria.slice(0, totalItemsVisiveis).map((item) => (
                                        <CardapioItem
                                            key={item.id}
                                            item={item}
                                            onAddItem={handleAbrirModalProduto}
                                            onQuickAdd={handleAdicionarRapido}
                                            coresEstabelecimento={coresEstabelecimento}
                                        />
                                    ))}
                                </div>

                                {/* BOTÃO VER MAIS/VER MENOS */}
                                {itemsNestaCategoria.length > 4 && (
                                    <div className="text-center mt-3 md:mt-4">
                                        {todosItensVisiveis ? (
                                            <button
                                                onClick={() => handleShowLess(categoriaSelecionada)}
                                                style={{ color: coresEstabelecimento.texto?.secundario || '#9CA3AF' }}
                                                className="hover:text-gray-300 font-medium text-xs md:text-sm transition-colors px-4 py-2"
                                            >
                                                ↑ Ver menos
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleShowMore(categoriaSelecionada)}
                                                className="font-medium text-xs md:text-sm transition-colors px-4 py-2"
                                                style={{ color: coresEstabelecimento.primaria }}
                                            >
                                                ↓ Ver mais ({itemsNestaCategoria.length - totalItemsVisiveis} restantes)
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })()
                )}

                {/* Seção de Dados do Cliente - VERSÃO RESPONSIVA */}
                <div className="bg-gray-900 rounded-xl md:rounded-2xl shadow-xl p-4 md:p-6 mt-8 md:mt-12 border border-gray-700">
                    <h2 className="font-bold text-2xl md:text-3xl mb-4 md:mb-6 flex items-center gap-2 md:gap-3" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                        <span>👤</span>
                        Seus Dados
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
                        <div>
                            <label className="block font-semibold mb-2 text-sm md:text-base" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                Nome *
                            </label>
                            <input
                                type="text"
                                value={nomeCliente}
                                onChange={(e) => setNomeCliente(e.target.value)}
                                className="w-full border border-gray-600 rounded-lg md:rounded-xl p-3 focus:ring-2 focus:border-transparent outline-none transition-all duration-200 bg-gray-800 text-white text-sm md:text-base"
                                placeholder="Seu nome completo"
                                required
                                style={{
                                    focusRingColor: coresEstabelecimento.primaria,
                                    color: coresEstabelecimento.texto?.principal || '#FFFFFF'
                                }}
                            />
                        </div>
                        <div>
                            <label className="block font-semibold mb-2 text-sm md:text-base" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                Telefone *
                            </label>
                            <input
                                type="tel"
                                value={telefoneCliente}
                                onChange={(e) => setTelefoneCliente(e.target.value)}
                                className="w-full border border-gray-600 rounded-lg md:rounded-xl p-3 focus:ring-2 focus:border-transparent outline-none transition-all duration-200 bg-gray-800 text-white text-sm md:text-base"
                                placeholder="(11) 99999-9999"
                                required
                                style={{
                                    focusRingColor: coresEstabelecimento.primaria,
                                    color: coresEstabelecimento.texto?.principal || '#FFFFFF'
                                }}
                            />
                        </div>
                    </div>

                    {/* Tipo de Entrega */}
                    <div className="mb-4 md:mb-6">
                        <label className="block font-semibold mb-3 text-sm md:text-base" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                            Tipo de Entrega
                        </label>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                type="button"
                                onClick={() => setIsRetirada(false)}
                                className={`flex-1 py-3 rounded-lg md:rounded-xl font-semibold transition-all duration-200 text-sm md:text-base ${!isRetirada
                                        ? 'text-white shadow-lg'
                                        : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                                    }`}
                                style={
                                    !isRetirada
                                        ? { backgroundColor: coresEstabelecimento.primaria }
                                        : {}
                                }
                            >
                                🚚 Entrega
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsRetirada(true)}
                                className={`flex-1 py-3 rounded-lg md:rounded-xl font-semibold transition-all duration-200 text-sm md:text-base ${isRetirada
                                        ? 'text-white shadow-lg'
                                        : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                                    }`}
                                style={
                                    isRetirada
                                        ? { backgroundColor: coresEstabelecimento.primaria }
                                        : {}
                                }
                            >
                                🏪 Retirada
                            </button>
                        </div>
                    </div>

                    {/* Endereço (apenas para entrega) */}
                    {!isRetirada && (
                        <div className="space-y-4 mb-4 md:mb-6">
                            <h3 className="text-lg md:text-xl font-semibold" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                📍 Endereço de Entrega
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                {/* Rua */}
                                <div className="md:col-span-2">
                                    <label className="block font-semibold mb-2 text-sm md:text-base" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                        Rua *
                                    </label>
                                    <input
                                        type="text"
                                        value={rua}
                                        onChange={(e) => setRua(e.target.value)}
                                        className="w-full border border-gray-600 rounded-lg md:rounded-xl p-3 focus:ring-2 focus:border-transparent outline-none transition-all duration-200 bg-gray-800 text-white text-sm md:text-base"
                                        placeholder="Nome da rua, avenida, etc."
                                        required
                                        style={{
                                            focusRingColor: coresEstabelecimento.primaria,
                                            color: coresEstabelecimento.texto?.principal || '#FFFFFF'
                                        }}
                                    />
                                </div>

                                {/* Número */}
                                <div>
                                    <label className="block font-semibold mb-2 text-sm md:text-base" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                        Número *
                                    </label>
                                    <input
                                        type="text"
                                        value={numero}
                                        onChange={(e) => setNumero(e.target.value)}
                                        className="w-full border border-gray-600 rounded-lg md:rounded-xl p-3 focus:ring-2 focus:border-transparent outline-none transition-all duration-200 bg-gray-800 text-white text-sm md:text-base"
                                        placeholder="Número"
                                        required
                                        style={{
                                            focusRingColor: coresEstabelecimento.primaria,
                                            color: coresEstabelecimento.texto?.principal || '#FFFFFF'
                                        }}
                                    />
                                </div>

                                {/* Bairro */}
                                <div>
                                    <label className="block font-semibold mb-2 text-sm md:text-base" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                        Bairro *
                                    </label>
                                    <input
                                        type="text"
                                        value={bairro}
                                        onChange={(e) => setBairro(e.target.value)}
                                        className="w-full border border-gray-600 rounded-lg md:rounded-xl p-3 focus:ring-2 focus:border-transparent outline-none transition-all duration-200 bg-gray-800 text-white text-sm md:text-base"
                                        placeholder="Seu bairro"
                                        required
                                        style={{
                                            focusRingColor: coresEstabelecimento.primaria,
                                            color: coresEstabelecimento.texto?.principal || '#FFFFFF'
                                        }}
                                    />
                                </div>

                                {/* Cidade */}
                                <div>
                                    <label className="block font-semibold mb-2 text-sm md:text-base" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                        Cidade *
                                    </label>
                                    <input
                                        type="text"
                                        value={cidade}
                                        onChange={(e) => setCidade(e.target.value)}
                                        className="w-full border border-gray-600 rounded-lg md:rounded-xl p-3 focus:ring-2 focus:border-transparent outline-none transition-all duration-200 bg-gray-800 text-white text-sm md:text-base"
                                        placeholder="Sua cidade"
                                        required
                                        style={{
                                            focusRingColor: coresEstabelecimento.primaria,
                                            color: coresEstabelecimento.texto?.principal || '#FFFFFF'
                                        }}
                                    />
                                </div>

                                {/* Complemento */}
                                <div className="md:col-span-2">
                                    <label className="block font-semibold mb-2 text-sm md:text-base" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                        Complemento (Opcional)
                                    </label>
                                    <input
                                        type="text"
                                        value={complemento}
                                        onChange={(e) => setComplemento(e.target.value)}
                                        className="w-full border border-gray-600 rounded-lg md:rounded-xl p-3 focus:ring-2 focus:border-transparent outline-none transition-all duration-200 bg-gray-800 text-white text-sm md:text-base"
                                        placeholder="Apartamento, bloco, referência, casa, etc."
                                        style={{
                                            focusRingColor: coresEstabelecimento.primaria,
                                            color: coresEstabelecimento.texto?.principal || '#FFFFFF'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Mensagem de bairro não encontrado - CORRIGIDA */}
                            {bairroNaoEncontrado && !isRetirada && bairro.trim() && (
                                <div className="bg-yellow-900 border border-yellow-700 rounded-lg md:rounded-xl p-3 md:p-4">
                                    <p className="text-xs md:text-sm" style={{ color: coresEstabelecimento.texto?.erro || '#EF4444' }}>
                                        ⚠️ O bairro "<strong>{bairro}</strong>" não foi encontrado na nossa lista de áreas de entrega.
                                        A taxa de entrega é R$ 0,00, mas podem ser aplicadas taxas adicionais na confirmação do pedido.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Forma de Pagamento */}
                    <div className="mb-4 md:mb-6">
                        <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                            💳 Forma de Pagamento
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                            {['dinheiro', 'cartão crédito', 'cartão débito', 'pix'].map((pagamento) => (
                                <button
                                    key={pagamento}
                                    type="button"
                                    onClick={() => setFormaPagamento(pagamento)}
                                    className={`py-2 md:py-3 rounded-lg md:rounded-xl font-semibold transition-all duration-200 text-xs md:text-sm ${formaPagamento === pagamento
                                            ? 'text-white shadow-lg'
                                            : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                                        }`}
                                    style={
                                        formaPagamento === pagamento
                                            ? { backgroundColor: coresEstabelecimento.primaria }
                                            : {}
                                    }
                                >
                                    {pagamento === 'dinheiro' && '💵 Dinheiro'}
                                    {pagamento === 'cartão crédito' && '💳 Crédito'}
                                    {pagamento === 'cartão débito' && '💳 Débito'}
                                    {pagamento === 'pix' && '📱 PIX'}
                                </button>
                            ))}
                        </div>

                        {formaPagamento === 'dinheiro' && (
                            <div className="mt-3 md:mt-4">
                                <label className="block font-semibold mb-2 text-sm md:text-base" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                    Troco para quanto? (Opcional)
                                </label>
                                <input
                                    type="number"
                                    value={trocoPara}
                                    onChange={(e) => setTrocoPara(e.target.value)}
                                    className="w-full md:w-1/2 border border-gray-600 rounded-lg md:rounded-xl p-3 focus:ring-2 focus:border-transparent outline-none transition-all duration-200 bg-gray-800 text-white text-sm md:text-base"
                                    placeholder="Ex: 50,00"
                                    step="0.01"
                                    min={finalOrderTotal}
                                    style={{
                                        focusRingColor: coresEstabelecimento.primaria,
                                        color: coresEstabelecimento.texto?.principal || '#FFFFFF'
                                    }}
                                />
                                <p className="text-xs md:text-sm mt-2" style={{ color: coresEstabelecimento.texto?.secundario || '#9CA3AF' }}>
                                    Deixe em branco se não precisar de troco.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Cart and Order Section - VERSÃO RESPONSIVA */}
                <div id="secao-pagamento" className="bg-gray-900 rounded-xl md:rounded-2xl shadow-xl p-4 md:p-6 mt-6 md:mt-8 border border-gray-700">
                    <h2 className="font-bold text-2xl md:text-3xl mb-4 md:mb-6 flex items-center gap-2 md:gap-3" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                        <span>🛒</span>

                        Seu Pedido
                    </h2>

                    {carrinho.length === 0 ? (
                        <div className="text-center py-6 md:py-8">
                            <div className="text-4xl md:text-6xl mb-3 md:mb-4" style={{ color: coresEstabelecimento.texto?.secundario || '#9CA3AF' }}>🛒</div>
                            <p className="text-base md:text-lg font-medium" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                Nenhum item adicionado ainda.
                            </p>
                            <p className="mt-1 md:mt-2 text-sm md:text-base" style={{ color: coresEstabelecimento.texto?.secundario || '#9CA3AF' }}>
                                Explore nosso cardápio e adicione itens deliciosos!
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-3 md:space-y-4 mb-4 md:mb-6">
                                {carrinho.map((item) => (
                                    <div key={item.cartItemId} className="bg-gray-800 p-3 md:p-4 rounded-lg md:rounded-xl border border-gray-700 hover:shadow-md transition-all duration-200">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 mr-3 md:mr-4">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <span className="font-semibold text-sm md:text-base" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                                            {formatarItemCarrinho(item)}
                                                        </span>
                                                        <span className="text-xs md:text-sm ml-1 md:ml-2" style={{ color: coresEstabelecimento.texto?.secundario || '#9CA3AF' }}>
                                                            ({item.qtd}x)
                                                        </span>
                                                    </div>
                                                    <span className="font-bold text-base md:text-lg" style={{ color: coresEstabelecimento.texto?.destaque || '#FBBF24' }}>
                                                        R$ {(item.precoFinal * item.qtd).toFixed(2).replace('.', ',')}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => removerDoCarrinho(item.cartItemId)}
                                                className="text-white w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center font-bold transition-colors duration-200 flex-shrink-0 text-xs md:text-base"
                                                style={{ backgroundColor: coresEstabelecimento.primaria }}
                                            >
                                                -
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-gray-700 pt-4 md:pt-6 space-y-3 md:space-y-4">
                                <div className="flex justify-between items-center text-base md:text-lg">
                                    <span style={{ color: coresEstabelecimento.texto?.secundario || '#9CA3AF' }}>Subtotal:</span>
                                    <span className="font-semibold" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                        R$ {subtotalCalculado.toFixed(2).replace('.', ',')}
                                    </span>
                                </div>

                                {!isRetirada && (
                                    <div className="flex justify-between items-center text-base md:text-lg">
                                        <span style={{ color: coresEstabelecimento.texto?.secundario || '#9CA3AF' }}>Taxa de Entrega:</span>
                                        <span className="font-semibold" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                            R$ {taxaAplicada.toFixed(2).replace('.', ',')}
                                        </span>
                                    </div>
                                )}

                                {!appliedCoupon ? (
                                    <div className="flex flex-col sm:flex-row items-center gap-2 md:gap-3 pt-3 md:pt-4 border-t border-gray-600">
                                        <input
                                            type="text"
                                            placeholder="🎁 Código do Cupom"
                                            value={couponCodeInput}
                                            onChange={(e) => setCouponCodeInput(e.target.value)}
                                            className="flex-1 border border-gray-600 rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-3 focus:ring-2 focus:border-transparent outline-none transition-all duration-200 bg-gray-800 text-white text-sm md:text-base"
                                            disabled={couponLoading}
                                            style={{
                                                focusRingColor: coresEstabelecimento.primaria,
                                                color: coresEstabelecimento.texto?.principal || '#FFFFFF'
                                            }}
                                        />
                                        <button
                                            onClick={handleApplyCoupon}
                                            disabled={couponLoading || !couponCodeInput.trim()}
                                            className="text-white px-4 md:px-6 py-2 md:py-3 rounded-lg md:rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 disabled:bg-gray-600 disabled:cursor-not-allowed text-sm md:text-base w-full sm:w-auto"
                                            style={{
                                                backgroundColor: couponLoading || !couponCodeInput.trim() ? '#4B5563' : coresEstabelecimento.primaria
                                            }}
                                        >
                                            {couponLoading ? 'Aplicando...' : 'Aplicar'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center bg-green-900 p-3 md:p-4 rounded-lg md:rounded-xl border border-green-700 mt-3 md:mt-4">
                                        <div>
                                            <p className="font-semibold text-sm md:text-base" style={{ color: coresEstabelecimento.texto?.sucesso || '#10B981' }}>
                                                🎉 Cupom: {appliedCoupon.codigo}
                                            </p>
                                            <p className="text-xs md:text-sm" style={{ color: coresEstabelecimento.texto?.sucesso || '#10B981' }}>
                                                Desconto aplicado com sucesso!
                                            </p>
                                        </div>
                                        <button
                                            onClick={removeAppliedCoupon}
                                            className="font-semibold text-xs md:text-sm transition-colors duration-200"
                                            style={{ color: coresEstabelecimento.texto?.erro || '#EF4444' }}
                                        >
                                            Remover
                                        </button>
                                    </div>
                                )}

                                {discountAmount > 0 && (
                                    <div className="flex justify-between items-center text-base md:text-lg font-semibold">
                                        <span style={{ color: coresEstabelecimento.texto?.sucesso || '#10B981' }}>Desconto:</span>
                                        <span style={{ color: coresEstabelecimento.texto?.sucesso || '#10B981' }}>
                                            - R$ {discountAmount.toFixed(2).replace('.', ',')}
                                        </span>
                                    </div>
                                )}

                                <div className="flex justify-between items-center text-xl md:text-2xl font-bold pt-3 md:pt-4 border-t border-gray-600">
                                    <span style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>TOTAL:</span>
                                    <span style={{ color: coresEstabelecimento.texto?.destaque || '#FBBF24' }}>
                                        R$ {finalOrderTotal.toFixed(2).replace('.', ',')}
                                    </span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            {/* 🆕 CARRINHO FLUTUANTE - APENAS ATALHO */}
            <CarrinhoFlutuante
                carrinho={carrinho}
                coresEstabelecimento={coresEstabelecimento}
            />

            {/* Fixed Order Button - VERSÃO RESPONSIVA */}
            {carrinho.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-gray-900 p-3 md:p-4 shadow-2xl border-t border-gray-700 md:relative md:p-0 md:mt-6 md:shadow-none md:border-none">
                    <div className="max-w-7xl mx-auto">
                        <button
                            onClick={enviarPedido}
                            disabled={!currentUser || !nomeCliente.trim() || !telefoneCliente.trim() || !formaPagamento || (!isRetirada && (!rua.trim() || !numero.trim() || !bairro.trim() || !cidade.trim()))}
                            className="w-full px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl font-bold text-base md:text-lg disabled:bg-gray-600 disabled:cursor-not-allowed text-white transition-all duration-200 transform hover:scale-105 shadow-lg"
                            style={{
                                backgroundColor: (!currentUser || !nomeCliente.trim() || !telefoneCliente.trim() || !formaPagamento || (!isRetirada && (!rua.trim() || !numero.trim() || !bairro.trim() || !cidade.trim())))
                                    ? '#4B5563'
                                    : coresEstabelecimento.destaque
                            }}
                        >
                            🚀 Enviar Pedido - R$ {finalOrderTotal.toFixed(2).replace('.', ',')}
                        </button>
                    </div>
                </div>
            )}

            {/* Order Confirmation Modal */}
            {showOrderConfirmationModal && confirmedOrderDetails && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-gray-900 rounded-xl md:rounded-2xl p-6 md:p-8 max-w-md w-full text-center border border-gray-700">
                        <div className="text-4xl md:text-6xl mb-3 md:mb-4">🎉</div>
                        <h2 className="text-2xl md:text-3xl font-bold mb-3 md:mb-4" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                            Pedido Enviado!
                        </h2>
                        <div className="space-y-2 md:space-y-3 text-left mb-4 md:mb-6">
                            <p className="text-sm md:text-base">
                                <strong style={{ color: coresEstabelecimento.texto?.secundario || '#9CA3AF' }}>ID:</strong>
                                <span className="font-mono ml-2" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                    {confirmedOrderDetails.id.substring(0, 8)}...
                                </span>
                            </p>
                            <p className="text-sm md:text-base">
                                <strong style={{ color: coresEstabelecimento.texto?.secundario || '#9CA3AF' }}>Total:</strong>
                                <span className="ml-2" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                    R$ {confirmedOrderDetails.totalFinal.toFixed(2).replace('.', ',')}
                                </span>
                            </p>
                            <p className="text-sm md:text-base">
                                <strong style={{ color: coresEstabelecimento.texto?.secundario || '#9CA3AF' }}>Forma de Pagamento:</strong>
                                <span className="ml-2" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                    {confirmedOrderDetails.formaPagamento}
                                </span>
                            </p>
                        </div>
                        <button
                            onClick={() => setShowOrderConfirmationModal(false)}
                            className="w-full text-white py-2 md:py-3 rounded-lg md:rounded-xl font-semibold transition-all duration-200 text-sm md:text-base"
                            style={{ backgroundColor: coresEstabelecimento.destaque }}
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}

            {/* Login Modal */}
            {showLoginPrompt && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-3 md:p-4 z-[1000]">
                    <div className="bg-gray-900 rounded-xl md:rounded-2xl shadow-2xl p-4 md:p-6 max-w-md w-full relative border border-gray-700">
                        <button
                            onClick={() => { setShowLoginPrompt(false); }}
                            className="absolute top-2 md:top-4 right-2 md:right-4 text-gray-400 hover:text-gray-300 text-xl md:text-2xl font-bold transition-colors duration-200"
                            aria-label="Fechar"
                        >
                            &times;
                        </button>

                        <div className="text-center mb-4 md:mb-6">
                            <div className="text-3xl md:text-4xl mb-2 md:mb-4">🔐</div>
                            <h2 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2" style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}>
                                {isRegisteringInModal ? 'Criar Conta' : 'Fazer Login'}
                            </h2>
                            <p className="text-sm md:text-base" style={{ color: coresEstabelecimento.texto?.secundario || '#9CA3AF' }}>
                                {isRegisteringInModal ? 'Preencha seus dados para criar uma conta.' : 'Para acessar o cardápio e fazer pedidos.'}
                            </p>
                        </div>

                        {errorAuthModal && (
                            <div className="bg-red-900 border border-red-700 rounded-lg md:rounded-xl p-3 md:p-4 mb-4 md:mb-6">
                                <p className="text-xs md:text-sm" style={{ color: coresEstabelecimento.texto?.erro || '#EF4444' }}>
                                    {errorAuthModal}
                                </p>
                            </div>
                        )}

                        {isRegisteringInModal ? (
                            <form onSubmit={handleRegisterModal} className="space-y-3 md:space-y-4">
                                <input
                                    type="text"
                                    placeholder="Seu Nome Completo *"
                                    className="w-full border border-gray-600 rounded-lg md:rounded-xl p-2 md:p-3 focus:ring-2 focus:border-transparent outline-none transition-all duration-200 bg-gray-800 text-white text-sm md:text-base"
                                    value={nomeAuthModal}
                                    onChange={(e) => setNomeAuthModal(e.target.value)}
                                    required
                                    style={{
                                        focusRingColor: coresEstabelecimento.primaria,
                                        color: coresEstabelecimento.texto?.principal || '#FFFFFF'
                                    }}
                                />
                                <input
                                    type="tel"
                                    placeholder="Seu Telefone (com DDD) *"
                                    className="w-full border border-gray-600 rounded-lg md:rounded-xl p-2 md:p-3 focus:ring-2 focus:border-transparent outline-none transition-all duration-200 bg-gray-800 text-white text-sm md:text-base"
                                    value={telefoneAuthModal}
                                    onChange={(e) => setTelefoneAuthModal(e.target.value)}
                                    required
                                    style={{
                                        focusRingColor: coresEstabelecimento.primaria,
                                        color: coresEstabelecimento.texto?.principal || '#FFFFFF'
                                    }}
                                />
                                <input
                                    type="email"
                                    placeholder="Email *"
                                    className="w-full border border-gray-600 rounded-lg md:rounded-xl p-2 md:p-3 focus:ring-2 focus:border-transparent outline-none transition-all duration-200 bg-gray-800 text-white text-sm md:text-base"
                                    value={emailAuthModal}
                                    onChange={(e) => setEmailAuthModal(e.target.value)}
                                    required
                                    style={{
                                        focusRingColor: coresEstabelecimento.primaria,
                                        color: coresEstabelecimento.texto?.principal || '#FFFFFF'
                                    }}
                                />
                                <input
                                    type="password"
                                    placeholder="Senha (mín. 6 caracteres) *"
                                    className="w-full border border-gray-600 rounded-lg md:rounded-xl p-2 md:p-3 focus:ring-2 focus:border-transparent outline-none transition-all duration-200 bg-gray-800 text-white text-sm md:text-base"
                                    value={passwordAuthModal}
                                    onChange={(e) => setPasswordAuthModal(e.target.value)}
                                    required
                                    style={{
                                        focusRingColor: coresEstabelecimento.primaria,
                                        color: coresEstabelecimento.texto?.principal || '#FFFFFF'
                                    }}
                                />
                                <input
                                    type="text"
                                    placeholder="Rua *"
                                    className="w-full border border-gray-600 rounded-lg md:rounded-xl p-2 md:p-3 focus:ring-2 focus:border-transparent outline-none transition-all duration-200 bg-gray-800 text-white text-sm md:text-base"
                                    value={ruaAuthModal}
                                    onChange={(e) => setRuaAuthModal(e.target.value)}
                                    required
                                    style={{
                                        focusRingColor: coresEstabelecimento.primaria,
                                        color: coresEstabelecimento.texto?.principal || '#FFFFFF'
                                    }}
                                />
                                <input
                                    type="text"
                                    placeholder="Número *"
                                    className="w-full border border-gray-600 rounded-lg md:rounded-xl p-2 md:p-3 focus:ring-2 focus:border-transparent outline-none transition-all duration-200 bg-gray-800 text-white text-sm md:text-base"
                                    value={numeroAuthModal}
                                    onChange={(e) => setNumeroAuthModal(e.target.value)}
                                    required
                                    style={{
                                        focusRingColor: coresEstabelecimento.primaria,
                                        color: coresEstabelecimento.texto?.principal || '#FFFFFF'
                                    }}
                                />
                                <input
                                    type="text"
                                    placeholder="Bairro *"
                                    className="w-full border border-gray-600 rounded-lg md:rounded-xl p-2 md:p-3 focus:ring-2 focus:border-transparent outline-none transition-all duration-200 bg-gray-800 text-white text-sm md:text-base"
                                    value={bairroAuthModal}
                                    onChange={(e) => setBairroAuthModal(e.target.value)}
                                    required
                                    style={{
                                        focusRingColor: coresEstabelecimento.primaria,
                                        color: coresEstabelecimento.texto?.principal || '#FFFFFF'
                                    }}
                                />
                                <input
                                    type="text"
                                    placeholder="Cidade *"
                                    className="w-full border border-gray-600 rounded-lg md:rounded-xl p-2 md:p-3 focus:ring-2 focus:border-transparent outline-none transition-all duration-200 bg-gray-800 text-white text-sm md:text-base"
                                    value={cidadeAuthModal}
                                    onChange={(e) => setCidadeAuthModal(e.target.value)}
                                    required
                                    style={{
                                        focusRingColor: coresEstabelecimento.primaria,
                                        color: coresEstabelecimento.texto?.principal || '#FFFFFF'
                                    }}
                                />
                                <input
                                    type="text"
                                    placeholder="Complemento (Opcional)"
                                    className="w-full border border-gray-600 rounded-lg md:rounded-xl p-2 md:p-3 focus:ring-2 focus:border-transparent outline-none transition-all duration-200 bg-gray-800 text-white text-sm md:text-base"
                                    value={complementoAuthModal}
                                    onChange={(e) => setComplementoAuthModal(e.target.value)}
                                    style={{
                                        focusRingColor: coresEstabelecimento.primaria,
                                        color: coresEstabelecimento.texto?.principal || '#FFFFFF'
                                    }}
                                />
                                <button
                                    type="submit"
                                    className="w-full text-white font-semibold py-2 md:py-3 rounded-lg md:rounded-xl transition-all duration-200 transform hover:scale-105 text-sm md:text-base"
                                    style={{ backgroundColor: coresEstabelecimento.primaria }}
                                >
                                    Cadastrar e Entrar
                                </button>
                                <p className="text-xs md:text-sm text-center" style={{ color: coresEstabelecimento.texto?.secundario || '#9CA3AF' }}>
                                    Já tem uma conta?{' '}
                                    <button
                                        type="button"
                                        onClick={() => setIsRegisteringInModal(false)}
                                        className="underline font-semibold transition-colors duration-200"
                                        style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}
                                    >
                                        Fazer Login
                                    </button>
                                </p>
                            </form>
                        ) : (
                            <form onSubmit={handleLoginModal} className="space-y-3 md:space-y-4">
                                <input
                                    type="email"
                                    placeholder="Email"
                                    className="w-full border border-gray-600 rounded-lg md:rounded-xl p-2 md:p-3 focus:ring-2 focus:border-transparent outline-none transition-all duration-200 bg-gray-800 text-white text-sm md:text-base"
                                    value={emailAuthModal}
                                    onChange={(e) => setEmailAuthModal(e.target.value)}
                                    required
                                    style={{
                                        focusRingColor: coresEstabelecimento.primaria,
                                        color: coresEstabelecimento.texto?.principal || '#FFFFFF'
                                    }}
                                />
                                <input
                                    type="password"
                                    placeholder="Senha"
                                    className="w-full border border-gray-600 rounded-lg md:rounded-xl p-2 md:p-3 focus:ring-2 focus:border-transparent outline-none transition-all duration-200 bg-gray-800 text-white text-sm md:text-base"
                                    value={passwordAuthModal}
                                    onChange={(e) => setPasswordAuthModal(e.target.value)}
                                    required
                                    style={{
                                        focusRingColor: coresEstabelecimento.primaria,
                                        color: coresEstabelecimento.texto?.principal || '#FFFFFF'
                                    }}
                                />
                                <button
                                    type="submit"
                                    className="w-full text-white font-semibold py-2 md:py-3 rounded-lg md:rounded-xl transition-all duration-200 transform hover:scale-105 text-sm md:text-base"
                                    style={{ backgroundColor: coresEstabelecimento.destaque }}
                                >
                                    Entrar
                                </button>
                                <p className="text-xs md:text-sm text-center" style={{ color: coresEstabelecimento.texto?.secundario || '#9CA3AF' }}>
                                    Não tem uma conta?{' '}
                                    <button
                                        type="button"
                                        onClick={() => setIsRegisteringInModal(true)}
                                        className="underline font-semibold transition-colors duration-200"
                                        style={{ color: coresEstabelecimento.texto?.principal || '#FFFFFF' }}
                                    >
                                        Cadastre-se
                                    </button>
                                </p>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* 🆕 Modal de Variações */}
            {itemParaVariacoes && (
                <VariacoesModal
                    item={itemParaVariacoes}
                    onConfirm={handleConfirmarVariacoes}
                    onClose={handleFecharModalVariacoes}
                    coresEstabelecimento={coresEstabelecimento}
                />
            )}

            {/* Modal de Adicionais */}
            {itemParaAdicionais && (
                <AdicionaisModal
                    item={itemParaAdicionais}
                    onConfirm={handleConfirmarAdicionais}
                    onClose={handleFecharModalAdicionais}
                    coresEstabelecimento={coresEstabelecimento}
                />
            )}
        </div>
    );
}

export default Menu;