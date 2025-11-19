// src/pages/TelaPedidos.jsx - VERSÃO FINAL CORRIGIDA E OTIMIZADA

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; 
import { db } from '../firebase';
// 🛠️ IMPORTAÇÃO COMPLETA: serverTimestamp, collectionGroup (mantida para robustez)
import { getDocs, doc, getDoc, updateDoc, collection, serverTimestamp, query, where, collectionGroup } from 'firebase/firestore'; 
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { 
    IoArrowBack, 
    IoCartOutline, 
    IoTrashOutline, 
    IoSearchOutline,
    IoAddCircleOutline,
    IoRemoveCircleOutline,
    IoSaveOutline,
    IoRestaurantOutline,
    IoReceiptOutline,
    IoCheckmarkCircleOutline,
    IoChevronDownOutline,
    IoChevronUpOutline,
    IoGridOutline,
    IoListOutline
} from 'react-icons/io5';

// 🎯 FUNÇÃO DE LÓGICA INTELIGENTE: Verifica se o item pode ser adicionado diretamente
const podeAdicionarDireto = (produto) => {
    const hasVariations = produto.variacoes && produto.variacoes.length > 0;
    
    if (!hasVariations) {
        return true; // 0 variações: Adiciona Direto
    }

    const variacoesAtivas = produto.variacoes.filter(v => 
        v.ativo !== false 
    );

    // 1 variação ativa: Adiciona Direto (automaticamente)
    if (variacoesAtivas.length === 1) {
        return true; 
    }

    return false; // 2+ variações: Precisa escolher
};


// --- COMPONENTE DO PRODUTO EM GRID ---
const ProdutoCardGrid = ({ produto, onAdicionar, estaNoCarrinho }) => {
    const [mostrarVariacoes, setMostrarVariacoes] = useState(false);
    const [variacaoSelecionada, setVariacaoSelecionada] = useState(null);

    const temVariacoes = produto.variacoes && produto.variacoes.length > 0;
    const podeAdicionar = podeAdicionarDireto(produto);

    const handleAdicionar = useCallback(() => {
        // 1. ADIÇÃO DIRETA (0 ou 1 VARIAÇÃO ATIVA)
        if (podeAdicionar) {
             let itemParaAdicionar = produto;
             
             if (produto.variacoes && produto.variacoes.length === 1) {
                 const variacaoUnica = produto.variacoes.find(v => v.ativo !== false);
                 itemParaAdicionar = {
                     ...produto,
                     id: `${produto.id}-${variacaoUnica.nome || variacaoUnica.tamanho}`,
                     nomeCompleto: `${produto.nome} - ${variacaoUnica.nome || variacaoUnica.tamanho}`,
                     preco: parseFloat(variacaoUnica.preco || produto.preco)
                 };
             }
             
             onAdicionar(itemParaAdicionar);
             return;
        }

        // 2. ADIÇÃO VIA SELETOR (2+ VARIAÇÕES)
        if (temVariacoes && !variacaoSelecionada) {
            setMostrarVariacoes(true);
            return;
        }

        const produtoParaAdicionar = {
            ...produto,
            ...variacaoSelecionada,
            id: `${produto.id}-${variacaoSelecionada.nome || variacaoSelecionada.tamanho}`,
            nomeCompleto: `${produto.nome} - ${variacaoSelecionada.nome || variacaoSelecionada.tamanho}`,
            preco: parseFloat(variacaoSelecionada.preco || produto.preco)
        }; 

        onAdicionar(produtoParaAdicionar);
        setVariacaoSelecionada(null);
        setMostrarVariacoes(false);
    }, [produto, temVariacoes, variacaoSelecionada, onAdicionar, podeAdicionar]);

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col group hover:border-amber-200">
            {produto.imageUrl ? (
                <div className="relative overflow-hidden">
                    <img 
                        src={produto.imageUrl} 
                        alt={produto.nome} 
                        className="w-full h-24 object-cover transition-transform duration-200 group-hover:scale-105" 
                        loading="lazy"
                    />
                    {estaNoCarrinho && (
                        <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-0.5 shadow-sm">
                            <IoCheckmarkCircleOutline className="text-xs" />
                        </div>
                    )}
                </div>
            ) : (
                <div className="w-full h-24 bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
                    <IoRestaurantOutline className="text-xl text-amber-400" />
                </div>
            )}
            
            <div className="p-2 flex flex-col flex-grow">
                <div className="flex-grow mb-1">
                    <h3 className="text-gray-900 font-semibold text-xs leading-tight mb-1 line-clamp-2">{produto.nome}</h3>
                    {produto.descricao && (
                        <p className="text-gray-500 text-xs leading-relaxed line-clamp-2 mb-1">{produto.descricao}</p>
                    )}
                </div>

                {/* Seção de Variações - VISÍVEL APENAS SE HOUVER OPÇÕES PARA ESCOLHER */}
                {temVariacoes && !podeAdicionar && mostrarVariacoes && (
                    <div className="mb-1 p-1 bg-gray-50 rounded border border-gray-200">
                        <p className="text-xs text-gray-600 mb-1 font-medium">Opções:</p>
                        <div className="space-y-1 max-h-20 overflow-y-auto">
                            {produto.variacoes.slice(0, 3).map((variacao, index) => (
                                <button
                                    key={index}
                                    onClick={() => setVariacaoSelecionada(variacao)}
                                    className={`w-full text-left p-1 rounded border transition-all duration-200 text-xs ${
                                        variacaoSelecionada === variacao
                                            ? 'bg-amber-500 text-white border-amber-500'
                                            : 'bg-white text-gray-700 border-gray-300 hover:border-amber-300'
                                    }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <span className="font-medium truncate">
                                            {variacao.nome || variacao.tamanho || `Opção ${index + 1}`}
                                        </span>
                                        <span className="font-bold whitespace-nowrap">
                                            R$ {parseFloat(variacao.preco || produto.preco).toFixed(2).replace('.', ',')}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center space-x-1">
                        <span className="text-amber-600 font-bold text-sm">
                            R$ {parseFloat(produto.preco).toFixed(2).replace('.', ',')}
                        </span>
                        {/* Botão de abrir seletor, visível apenas se houver 2+ variações */}
                        {temVariacoes && !podeAdicionar && !mostrarVariacoes && (
                            <button 
                                onClick={() => setMostrarVariacoes(!mostrarVariacoes)}
                                className="text-blue-500 hover:text-blue-600 text-xs"
                            >
                                <IoChevronDownOutline />
                            </button>
                        )}
                    </div>
                    <button 
                        onClick={handleAdicionar}
                        // Desabilita se for item de 2+ variações E o seletor estiver aberto E nada selecionado
                        disabled={!podeAdicionar && temVariacoes && mostrarVariacoes && !variacaoSelecionada}
                        className={`font-semibold py-1 px-2 rounded text-xs transition-all duration-200 flex items-center space-x-1 ${
                            estaNoCarrinho 
                                ? 'bg-green-500 hover:bg-green-600 text-white' 
                                : podeAdicionar || (temVariacoes && variacaoSelecionada)
                                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                    >
                        <IoAddCircleOutline className="text-xs" />
                        <span>{podeAdicionar ? 'Add' : 'Opções'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE DO PRODUTO EM LISTA (Lógica idêntica ao Grid) ---
const ProdutoCardLista = ({ produto, onAdicionar, estaNoCarrinho }) => {
    const [mostrarVariacoes, setMostrarVariacoes] = useState(false);
    const [variacaoSelecionada, setVariacaoSelecionada] = useState(null);

    const temVariacoes = produto.variacoes && produto.variacoes.length > 0;
    const podeAdicionar = podeAdicionarDireto(produto);

    const handleAdicionar = useCallback(() => {
        // 1. ADIÇÃO DIRETA (0 ou 1 VARIAÇÃO ATIVA)
        if (podeAdicionar) {
             let itemParaAdicionar = produto;
             
             if (produto.variacoes && produto.variacoes.length === 1) {
                 const variacaoUnica = produto.variacoes.find(v => v.ativo !== false);
                 itemParaAdicionar = {
                     ...produto,
                     id: `${produto.id}-${variacaoUnica.nome || variacaoUnica.tamanho}`,
                     nomeCompleto: `${produto.nome} - ${variacaoUnica.nome || variacaoUnica.tamanho}`,
                     preco: parseFloat(variacaoUnica.preco || produto.preco)
                 };
             }
             
             onAdicionar(itemParaAdicionar);
             return;
        }

        // 2. ADIÇÃO VIA SELETOR (2+ VARIAÇÕES)
        if (temVariacoes && !variacaoSelecionada) {
            setMostrarVariacoes(true);
            return;
        }

        const produtoParaAdicionar = {
            ...produto,
            ...variacaoSelecionada,
            id: `${produto.id}-${variacaoSelecionada.nome || variacaoSelecionada.tamanho}`,
            nomeCompleto: `${produto.nome} - ${variacaoSelecionada.nome || variacaoSelecionada.tamanho}`,
            preco: parseFloat(variacaoSelecionada.preco || produto.preco)
        }; 

        onAdicionar(produtoParaAdicionar);
        setVariacaoSelecionada(null);
        setMostrarVariacoes(false);
    }, [produto, temVariacoes, variacaoSelecionada, onAdicionar, podeAdicionar]);

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200 p-2 group hover:border-amber-200">
            <div className="flex items-start gap-2">
                {/* Imagem do produto */}
                <div className="flex-shrink-0">
                    {produto.imageUrl ? (
                        <div className="relative">
                            <img 
                                src={produto.imageUrl} 
                                alt={produto.nome} 
                                className="w-12 h-12 object-cover rounded transition-transform duration-200 group-hover:scale-105" 
                                loading="lazy"
                            />
                            {estaNoCarrinho && (
                                <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-0.5 shadow-sm">
                                    <IoCheckmarkCircleOutline className="text-xs" />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-50 to-orange-100 rounded flex items-center justify-center">
                            <IoRestaurantOutline className="text-base text-amber-400" />
                        </div>
                    )}
                </div>

                {/* Conteúdo do produto */}
                <div className="flex-grow min-w-0">
                    <div className="flex items-start justify-between mb-1">
                        <div className="flex-grow min-w-0">
                            <h3 className="text-gray-900 font-semibold text-xs leading-tight truncate">{produto.nome}</h3>
                            {produto.descricao && (
                                <p className="text-gray-500 text-xs leading-relaxed line-clamp-1 mt-0.5">{produto.descricao}</p>
                            )}
                        </div>
                        <div className="flex-shrink-0 ml-2">
                            <span className="text-amber-600 font-bold text-sm whitespace-nowrap">
                                R$ {parseFloat(produto.preco).toFixed(2).replace('.', ',')}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-1">
                            {produto.categoria && (
                                <span className="inline-block bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">
                                    {produto.categoria}
                                </span>
                            )}
                            {/* Botão de opções, visível apenas se houver 2+ variações */}
                            {temVariacoes && !podeAdicionar && (
                                <button 
                                    onClick={() => setMostrarVariacoes(!mostrarVariacoes)}
                                    className="inline-block bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full hover:bg-blue-200 transition-colors flex items-center gap-0.5"
                                >
                                    {mostrarVariacoes ? <IoChevronUpOutline /> : <IoChevronDownOutline />}
                                    <span>{produto.variacoes.length} opções</span>
                                </button>
                            )}
                        </div>

                        <button 
                            onClick={handleAdicionar}
                            disabled={!podeAdicionar && temVariacoes && mostrarVariacoes && !variacaoSelecionada}
                            className={`font-semibold py-1 px-2 rounded text-xs transition-all duration-200 flex items-center justify-center space-x-1 ${
                                estaNoCarrinho 
                                    ? 'bg-green-500 hover:bg-green-600 text-white' 
                                    : podeAdicionar || (temVariacoes && variacaoSelecionada)
                                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            <IoAddCircleOutline className="text-xs" />
                            <span>{podeAdicionar ? 'Add' : 'Opções'}</span>
                        </button>
                    </div>

                    {/* Seção de Variações em Lista - VISÍVEL APENAS SE HOUVER OPÇÕES PARA ESCOLHER */}
                    {temVariacoes && !podeAdicionar && mostrarVariacoes && (
                        <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                            <p className="text-xs text-gray-600 mb-1 font-medium">Selecione uma opção:</p>
                            <div className="grid grid-cols-1 gap-1">
                                {produto.variacoes.slice(0, 3).map((variacao, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setVariacaoSelecionada(variacao)}
                                        className={`text-left p-1.5 rounded border transition-all duration-200 text-xs ${
                                            variacaoSelecionada === variacao
                                                ? 'bg-amber-500 text-white border-amber-500'
                                                : 'bg-white text-gray-700 border-gray-300 hover:border-amber-300'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium truncate">
                                                {variacao.nome || variacao.tamanho || `Opção ${index + 1}`}
                                            </span>
                                            <span className="font-bold whitespace-nowrap">
                                                R$ {parseFloat(variacao.preco || produto.preco).toFixed(2).replace('.', ',')}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// 🚀 FUNÇÃO ULTRA RÁPIDA V2: Múltiplas buscas paralelas (Promise.all)
// Esta função é o fallback mais rápido sem Collection Group
const carregarProdutosRapido = async (estabId) => {
    try {
        let todosProdutos = [];

        const todasCategoriasRef = collection(db, 'estabelecimentos', estabId, 'cardapio');
        const categoriasSnapshot = await getDocs(todasCategoriasRef);
        
        const promessas = [];

        if (!categoriasSnapshot.empty) {
            categoriasSnapshot.docs.forEach(catDoc => {
                const categoriaData = catDoc.data();
                const categoriaId = catDoc.id;

                // Busca os itens desta categoria em paralelo
                promessas.push(getDocs(
                    query(
                        collection(db, 'estabelecimentos', estabId, 'cardapio', categoriaId, 'itens'),
                        where('ativo', '==', true)
                    )
                ).then(itensSnapshot => {
                    return itensSnapshot.docs.map(itemDoc => ({
                        ...itemDoc.data(),
                        id: itemDoc.id,
                        categoria: categoriaData.nome || 'Geral', // Pega o nome da categoria do doc pai
                        categoriaId: categoriaId,
                        // Adiciona o nome da categoria ao item para ordenação e filtro
                        categoriaNome: categoriaData.nome || 'Geral' 
                    }));
                }).catch(() => [])); 
            });
            
            const resultados = await Promise.all(promessas);
            todosProdutos = resultados.flat();
        }

        // Lógica de fallback para estrutura alternativa (se existir)
        if (todosProdutos.length === 0) {
            const cardapioDiretoRef = collection(db, 'estabelecimentos', estabId, 'cardapio');
            const qAtivos = query(cardapioDiretoRef, where('ativo', '==', true));
            const snapshotDireto = await getDocs(qAtivos);

            if (!snapshotDireto.empty) {
                todosProdutos = snapshotDireto.docs.map(doc => ({
                    ...doc.data(),
                    id: doc.id,
                    categoria: doc.data().categoria || 'Geral',
                    categoriaId: 'direto',
                    categoriaNome: doc.data().categoria || 'Geral'
                }));
            }
        }
        
        return todosProdutos;

    } catch (error) {
        console.error("❌ Erro no carregamento rápido:", error);
        return [];
    }
};


const TelaPedidos = () => {
    const { id: mesaId, estabelecimentoId: urlEstabelecimentoId } = useParams();
    const { estabelecimentoIdPrincipal } = useAuth();
    const navigate = useNavigate(); 
    
    const estabelecimentoId = estabelecimentoIdPrincipal || urlEstabelecimentoId; 

    const [mesa, setMesa] = useState(null);
    const [cardapio, setCardapio] = useState([]);
    const [categorias, setCategorias] = useState(['Todos']);
    const [resumoPedido, setResumoPedido] = useState([]);
    const [loading, setLoading] = useState(true);
    const [termoBusca, setTermoBusca] = useState('');
    const [categoriaAtiva, setCategoriaAtiva] = useState('Todos');
    const [estabelecimentoNome, setEstabelecimentoNome] = useState('Carregando...');
    const [salvando, setSalvando] = useState(false);
    const [visualizacao, setVisualizacao] = useState('grid');
    const [showOrderSummary, setShowOrderSummary] = useState(false);

    // Função para carregar dados
    const fetchData = useCallback(async () => {
        if (!estabelecimentoId) {
            setLoading(false);
            toast.error("Estabelecimento não identificado.");
            return;
        }

        try {
            setLoading(true);
            console.log("🔄 Iniciando carregamento do cardápio...");

            // 1. Buscar dados básicos
            const [estabSnap, mesaSnap] = await Promise.all([
                getDoc(doc(db, 'estabelecimentos', estabelecimentoId)),
                getDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId))
            ]);

            // Configurar estabelecimento e mesa
            if (estabSnap.exists()) {
                setEstabelecimentoNome(estabSnap.data().nome || 'Estabelecimento');
            }

            if (mesaSnap.exists()) {
                const mesaData = mesaSnap.data();
                setMesa(mesaData);
                setResumoPedido(mesaData.itens || []);
            } else {
                toast.error("Mesa não encontrada.");
            }

            // 2. Buscar produtos de forma RÁPIDA
            const todosProdutos = await carregarProdutosRapido(estabelecimentoId);
            
            console.log("🎯 TOTAL DE PRODUTOS CARREGADOS:", todosProdutos.length);

            // Ordenação (mantida a ordem por categoria/nome, mas você pode usar ordem personalizada aqui)
            todosProdutos.sort((a, b) => {
                const categoriaCompare = a.categoria.localeCompare(b.categoria);
                if (categoriaCompare !== 0) return categoriaCompare;
                
                const ordemA = a.ordem || 999;
                const ordemB = b.ordem || 999;
                if (ordemA !== ordemB) return ordemA - ordemB;
                
                return a.nome.localeCompare(b.nome);
            });

            setCardapio(todosProdutos);

            // Criar lista de categorias (e ordenar alfabeticamente)
            let categoriasUnicas = ['Todos', ...new Set(todosProdutos.map(p => p.categoria).filter(Boolean))];
            
            // 🎨 Forçar ordem alfabética para os botões de controle
            categoriasUnicas = categoriasUnicas.sort((a, b) => {
                if (a === 'Todos') return -1;
                if (b === 'Todos') return 1;
                return a.localeCompare(b);
            });

            setCategorias(categoriasUnicas);

            if (todosProdutos.length === 0) {
                console.warn("⚠️ Nenhum produto ativo encontrado");
                toast.warn("Nenhum produto ativo encontrado no cardápio.");
            } else {
                toast.success(`🎉 ${todosProdutos.length} produtos carregados!`);
            }

        } catch (error) {
            console.error("❌ ERRO CRÍTICO:", error);
            toast.error("❌ Falha ao carregar dados.");
        } finally {
            setLoading(false);
        }
    }, [estabelecimentoId, mesaId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- FUNÇÕES DE PEDIDO ---
    const adicionarItem = useCallback((produto) => {
        setResumoPedido(prev => {
            const itemExistente = prev.find(item => item.id === produto.id); 
            if (itemExistente) {
                return prev.map(item => 
                    item.id === produto.id 
                        ? { ...item, quantidade: item.quantidade + 1 } 
                        : item
                );
            }
            return [...prev, { 
                ...produto, 
                quantidade: 1, 
                preco: parseFloat(produto.preco),
                nome: produto.nomeCompleto || produto.nome
            }];
        });
        
        toast.success(`✅ ${produto.nomeCompleto || produto.nome} adicionado!`, {
            position: "bottom-right",
            autoClose: 1000 // Adição rápida
        });
    }, []);

    const ajustarQuantidade = useCallback((produtoId, novaQuantidade) => {
        if (novaQuantidade < 1) {
            setResumoPedido(prev => prev.filter(item => item.id !== produtoId));
            return;
        }
        setResumoPedido(prev =>
            prev.map(item =>
                item.id === produtoId
                    ? { ...item, quantidade: novaQuantidade }
                    : item
            )
        );
    }, []);

    const removerItem = useCallback((produtoId) => {
        const itemRemovido = resumoPedido.find(item => item.id === produtoId);
        setResumoPedido(prev => prev.filter(item => item.id !== produtoId));
        
        if (itemRemovido) {
            toast.warn(`🗑️ ${itemRemovido.nome} removido!`, {
                position: "bottom-right",
                autoClose: 1000
            });
        }
    }, [resumoPedido]);

    const salvarAlteracoes = async () => {
        setSalvando(true);
        const totalPedido = resumoPedido.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
        
        try {
            const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
            
            await updateDoc(mesaRef, {
                itens: resumoPedido,
                status: resumoPedido.length > 0 ? 'com_pedido' : 'livre',
                total: totalPedido,
                // ✅ CORRIGIDO: Usando serverTimestamp()
                updatedAt: serverTimestamp()
            });

            setMesa(prev => ({...prev, itens: resumoPedido }));
            
            toast.success("💾 Pedido salvo com sucesso!");
            
            setTimeout(() => {
                navigate('/controle-salao');
            }, 800);
            
        } catch (error) {
            console.error("Erro ao salvar alterações:", error);
            toast.error("❌ Falha ao salvar o pedido.");
        } finally {
            setSalvando(false);
        }
    };

    const finalizarMesa = async () => {
        if (resumoPedido.length === 0) {
            toast.warn("Não é possível finalizar um pedido vazio.");
            return;
        }

        const totalPedido = resumoPedido.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);

        try {
            const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
            
            await updateDoc(mesaRef, {
                itens: resumoPedido,
                status: 'pagamento',
                total: totalPedido,
                // ✅ CORRIGIDO: Usando serverTimestamp()
                updatedAt: serverTimestamp()
            });

            toast.success("✅ Mesa finalizada para pagamento!");
            navigate('/controle-salao'); 

        } catch (error) {
            console.error("Erro ao finalizar mesa:", error);
            toast.error("❌ Falha ao finalizar a mesa.");
        }
    };

    const handleVoltar = () => {
        if (resumoPedido.length > 0) {
            const confirmar = window.confirm("Tem alterações não salvas. Deseja realmente voltar?");
            if (!confirmar) return;
        }
        navigate('/controle-salao');
    };

    const produtoEstaNoCarrinho = useCallback((produtoId) => {
        return resumoPedido.some(item => item.id === produtoId);
    }, [resumoPedido]);

    // Filtros
    const produtosFiltrados = cardapio.filter(produto => {
        const buscaMatch = !termoBusca || 
            produto.nome.toLowerCase().includes(termoBusca.toLowerCase()) ||
            (produto.descricao && produto.descricao.toLowerCase().includes(termoBusca.toLowerCase()));
        
        const categoriaMatch = categoriaAtiva === 'Todos' || produto.categoria === categoriaAtiva;
        
        return buscaMatch && categoriaMatch;
    });

    const totalPedido = resumoPedido.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
    const totalItens = resumoPedido.reduce((acc, item) => acc + item.quantidade, 0);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-700 font-medium">Carregando cardápio...</p>
                    <p className="text-gray-500 text-sm mt-2">Aguarde um momento</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-amber-200 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-3 py-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <button 
                                onClick={handleVoltar}
                                className="flex items-center space-x-1 bg-white hover:bg-amber-50 text-gray-700 text-sm py-1.5 px-3 rounded-lg border border-amber-300 transition-all duration-200"
                            >
                                <IoArrowBack className="text-sm"/>
                                <span>Voltar</span>
                            </button>
                            <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center shadow">
                                    <span className="text-white font-bold text-sm">{mesa?.numero || '?'}</span>
                                </div>
                                <div>
                                    <h1 className="text-sm font-bold text-gray-900">Mesa {mesa?.numero || 'N/A'}</h1>
                                    <p className="text-xs text-gray-600 truncate max-w-[120px]">{estabelecimentoNome}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                            <div className="lg:hidden">
                                <button 
                                    onClick={() => setShowOrderSummary(!showOrderSummary)}
                                    className="flex items-center space-x-1 bg-amber-500 hover:bg-amber-600 text-white text-sm py-1.5 px-3 rounded-lg transition-all duration-200 shadow"
                                >
                                    <IoCartOutline className="text-sm" />
                                    <span>{totalItens}</span>
                                </button>
                            </div>
                            
                            <div className="hidden lg:flex items-center space-x-2">
                                <div className="bg-amber-100 text-amber-800 px-3 py-1 rounded-lg font-semibold text-sm">
                                    <span className="flex items-center space-x-1">
                                        <IoCartOutline className="text-sm" />
                                        <span>{totalItens} itens</span>
                                    </span>
                                </div>
                                <button 
                                    onClick={salvarAlteracoes}
                                    disabled={salvando}
                                    className="flex items-center space-x-1 bg-green-500 hover:bg-green-600 text-white text-sm py-1.5 px-3 rounded-lg transition-all duration-200 disabled:opacity-50 shadow"
                                >
                                    {salvando ? (
                                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <IoSaveOutline className="text-sm" />
                                    )}
                                    <span>{salvando ? 'Salvando...' : 'Salvar'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-3">
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Seção do Cardápio */}
                    <div className="flex-1">
                        {/* Busca e Filtros */}
                        <div className="bg-white rounded-lg shadow-sm border border-amber-200 p-3 mb-4">
                            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                                <div className="flex-1 min-w-0 w-full">
                                    <div className="relative">
                                        <IoSearchOutline className="absolute left-2 top-1/2 transform -translate-y-1/2 text-amber-400 text-sm" />
                                        <input
                                            type="text"
                                            placeholder="Buscar produtos..."
                                            value={termoBusca}
                                            onChange={(e) => setTermoBusca(e.target.value)}
                                            className="w-full pl-8 pr-3 py-2 border border-amber-300 rounded-lg focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all duration-200 bg-amber-50 text-sm"
                                        />
                                    </div>
                                </div>
                                
                                <div className="w-full sm:w-auto">
                                    <div className="flex gap-1 overflow-x-auto pb-1">
                                        {categorias.map(categoria => (
                                            <button
                                                key={categoria}
                                                onClick={() => setCategoriaAtiva(categoria)}
                                                className={`px-2 py-1.5 rounded-lg font-medium text-xs whitespace-nowrap transition-all duration-200 ${
                                                    categoriaAtiva === categoria
                                                        ? 'bg-amber-500 text-white shadow'
                                                        : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                                }`}
                                            >
                                                {categoria}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center space-x-1 bg-amber-100 rounded-lg p-0.5">
                                    <button
                                        onClick={() => setVisualizacao('grid')}
                                        className={`p-1 rounded transition-all duration-200 ${
                                            visualizacao === 'grid'
                                                ? 'bg-white text-amber-600 shadow-sm'
                                                : 'text-amber-500 hover:text-amber-600'
                                        }`}
                                    >
                                        <IoGridOutline className="text-sm" />
                                    </button>
                                    <button
                                        onClick={() => setVisualizacao('lista')}
                                        className={`p-1 rounded transition-all duration-200 ${
                                            visualizacao === 'lista'
                                                ? 'bg-white text-amber-600 shadow-sm'
                                                : 'text-amber-500 hover:text-amber-600'
                                        }`}
                                    >
                                        <IoListOutline className="text-sm" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Grid de Produtos */}
                        {produtosFiltrados.length > 0 ? (
                            <div>
                                <div className="mb-3 p-2 bg-white rounded-lg shadow-xs border border-amber-200">
                                    <p className="text-gray-700 text-xs">
                                        Mostrando <span className="text-amber-600 font-bold">{produtosFiltrados.length}</span> de <span className="text-amber-600 font-bold">{cardapio.length}</span> produtos
                                    </p>
                                </div>

                                {/* Grade de Produtos */}
                                {visualizacao === 'grid' ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                                        {produtosFiltrados.map(produto => (
                                            <ProdutoCardGrid
                                                key={produto.id}
                                                produto={produto}
                                                onAdicionar={adicionarItem}
                                                estaNoCarrinho={produtoEstaNoCarrinho(produto.id)}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {produtosFiltrados.map(produto => (
                                            <ProdutoCardLista
                                                key={produto.id}
                                                produto={produto}
                                                onAdicionar={adicionarItem}
                                                estaNoCarrinho={produtoEstaNoCarrinho(produto.id)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg shadow-sm border border-amber-200 p-8 text-center">
                                <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-2xl">🍕</span>
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">
                                    {cardapio.length === 0 ? 'Cardápio vazio' : 'Nenhum produto encontrado'}
                                </h3>
                                <p className="text-gray-600 text-sm">
                                    {cardapio.length === 0 
                                        ? 'Adicione produtos ao cardápio primeiro.' 
                                        : 'Tente ajustar os filtros de busca.'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Resumo do Pedido */}
                    <div className={`
                        ${showOrderSummary ? 'block' : 'hidden'} 
                        lg:block 
                        lg:w-64 
                        transition-all duration-300
                    `}>
                        <div className="bg-white rounded-lg shadow-md border border-amber-200 lg:sticky lg:top-16">
                            <div className="p-3 border-b border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-lg">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-sm font-bold text-gray-900 flex items-center space-x-2">
                                        <IoReceiptOutline className="text-lg text-amber-500" />
                                        <span>Resumo</span>
                                    </h2>
                                    <button 
                                        onClick={() => setShowOrderSummary(false)}
                                        className="lg:hidden text-gray-500 hover:text-gray-700 text-sm"
                                    >
                                        ✕
                                    </button>
                                </div>
                                {resumoPedido.length > 0 && (
                                    <p className="text-amber-600 text-xs mt-0.5">
                                        {totalItens} {totalItens === 1 ? 'item' : 'itens'}
                                    </p>
                                )}
                            </div>

                            <div className="p-2 max-h-64 overflow-y-auto">
                                {resumoPedido.length > 0 ? (
                                    <div className="space-y-2">
                                        {resumoPedido.map(item => (
                                            <div key={item.id} className="bg-amber-50 rounded-lg p-2 border border-amber-200">
                                                <div className="flex items-start justify-between mb-1">
                                                    <p className="font-semibold text-gray-900 text-xs leading-tight truncate flex-1">{item.nome}</p>
                                                    <button 
                                                        onClick={() => removerItem(item.id)}
                                                        className="flex-shrink-0 ml-1 text-red-500 hover:text-red-700"
                                                    >
                                                        <IoTrashOutline className="text-xs" />
                                                    </button>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-1 bg-white rounded p-0.5">
                                                        <button 
                                                            onClick={() => ajustarQuantidade(item.id, item.quantidade - 1)}
                                                            className="w-6 h-6 bg-amber-100 hover:bg-amber-200 rounded flex items-center justify-center"
                                                        >
                                                            <IoRemoveCircleOutline className="text-amber-600 text-xs" />
                                                        </button>
                                                        <span className="font-bold text-gray-900 text-xs min-w-6 text-center">
                                                            {item.quantidade}
                                                        </span>
                                                        <button 
                                                            onClick={() => ajustarQuantidade(item.id, item.quantidade + 1)}
                                                            className="w-6 h-6 bg-amber-500 hover:bg-amber-600 rounded flex items-center justify-center"
                                                        >
                                                            <IoAddCircleOutline className="text-white text-xs" />
                                                        </button>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-amber-600 font-semibold text-sm">
                                                            R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-6">
                                        <IoCartOutline className="text-2xl text-amber-400 mx-auto mb-2" />
                                        <p className="text-gray-500 text-xs">Nenhum item adicionado</p>
                                    </div>
                                )}
                            </div>

                            {resumoPedido.length > 0 && (
                                <div className="p-3 border-t border-amber-200 bg-amber-50 rounded-b-lg">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="font-bold text-gray-900 text-sm">Total:</span>
                                        <span className="text-lg font-bold text-green-600">
                                            R$ {totalPedido.toFixed(2).replace('.', ',')}
                                        </span>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <button 
                                            onClick={salvarAlteracoes}
                                            disabled={salvando}
                                            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-3 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
                                        >
                                            {salvando ? (
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <IoSaveOutline className="text-sm" />
                                            )}
                                            <span>{salvando ? 'Salvando...' : 'Salvar Pedido'}</span>
                                        </button>
                                        
                                        <button 
                                            onClick={finalizarMesa}
                                            className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold py-2 px-3 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 text-sm"
                                        >
                                            <IoReceiptOutline className="text-sm" />
                                            <span>Finalizar / Pagar</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default TelaPedidos;