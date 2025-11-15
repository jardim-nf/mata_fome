// src/pages/TelaPedidos.jsx - VERSÃO COMPLETA CORRIGIDA

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; 
import { db } from '../firebase';
import { getDocs, doc, getDoc, updateDoc, collection } from 'firebase/firestore'; 
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
    IoCheckmarkCircleOutline
} from 'react-icons/io5';

// --- COMPONENTE DO PRODUTO MELHORADO ---
const ProdutoCard = ({ produto, onAdicionar, estaNoCarrinho }) => (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col group hover:border-amber-200">
        {produto.imageUrl ? (
            <div className="relative overflow-hidden">
                <img 
                    src={produto.imageUrl} 
                    alt={produto.nome} 
                    className="w-full h-36 object-cover transition-transform duration-500 group-hover:scale-110" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                {estaNoCarrinho && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1 shadow-lg">
                        <IoCheckmarkCircleOutline className="text-lg" />
                    </div>
                )}
            </div>
        ) : (
            <div className="w-full h-36 bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center group-hover:from-amber-100 group-hover:to-orange-200 transition-all duration-300">
                <IoRestaurantOutline className="text-3xl text-amber-400" />
            </div>
        )}
        <div className="p-4 flex flex-col flex-grow">
            <div className="flex-grow mb-3">
                <h3 className="text-gray-900 font-bold text-sm leading-tight mb-1 line-clamp-2">{produto.nome}</h3>
                {produto.descricao && (
                    <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{produto.descricao}</p>
                )}
                {produto.categoria && (
                    <span className="inline-block bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full mt-2">
                        {produto.categoria}
                    </span>
                )}
            </div>
            <div className="flex items-center justify-between">
                <span className="text-amber-600 font-bold text-lg">
                    R$ {parseFloat(produto.preco).toFixed(2).replace('.', ',')}
                </span>
                <button 
                    onClick={() => onAdicionar(produto)} 
                    className={`font-semibold py-2 px-4 rounded-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-2 ${
                        estaNoCarrinho 
                            ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg' 
                            : 'bg-amber-500 hover:bg-amber-600 text-white shadow-md'
                    }`}
                >
                    <IoAddCircleOutline className="text-lg" />
                    <span className="text-sm">{estaNoCarrinho ? 'Adicionar +' : 'Adicionar'}</span>
                </button>
            </div>
        </div>
    </div>
);

const TelaPedidos = () => {
    const { id: mesaId, estabelecimentoId: urlEstabelecimentoId } = useParams();
    const { estabelecimentoIdPrincipal } = useAuth();
    const navigate = useNavigate(); 
    
    const estabelecimentoId = estabelecimentoIdPrincipal || urlEstabelecimentoId; 

    const [mesa, setMesa] = useState(null);
    const [cardapio, setCardapio] = useState([]);
    const [categorias, setCategorias] = useState(['todas']);
    const [resumoPedido, setResumoPedido] = useState([]);
    const [loading, setLoading] = useState(true);
    const [termoBusca, setTermoBusca] = useState('');
    const [categoriaAtiva, setCategoriaAtiva] = useState('todas');
    const [estabelecimentoNome, setEstabelecimentoNome] = useState('Carregando...');
    const [salvando, setSalvando] = useState(false);

    useEffect(() => {
        if (!estabelecimentoId) {
            setLoading(false);
            toast.error("Estabelecimento não identificado.");
            return;
        }

        const fetchData = async () => {
            try {
                setLoading(true);

                // 1. Buscar NOME DO ESTABELECIMENTO
                const estabRef = doc(db, 'estabelecimentos', estabelecimentoId);
                const estabSnap = await getDoc(estabRef);

                if (estabSnap.exists()) {
                    setEstabelecimentoNome(estabSnap.data().nome || 'Estabelecimento');
                } else {
                    setEstabelecimentoNome('Estabelecimento Desconhecido');
                }

                // 2. Buscar dados da Mesa
                const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
                const mesaSnap = await getDoc(mesaRef);
                
                if (mesaSnap.exists()) {
                    const mesaData = mesaSnap.data();
                    setMesa(mesaData);
                    setResumoPedido(mesaData.itens || []);
                } else {
                    toast.error("Mesa não encontrada.");
                }

                // 3. BUSCAR CATEGORIAS
                const cardapioRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio');
                const categoriasSnap = await getDocs(cardapioRef);
                
                const categoriasEncontradas = categoriasSnap.docs.map(doc => ({
                    id: doc.id, 
                    nome: doc.data().nome || doc.id,
                    data: doc.data()
                }));
                
                console.log("🔍 CATEGORIAS ENCONTRADAS:", categoriasEncontradas);

                let todosProdutos = [];

                // 4. BUSCAR PRODUTOS COMO DOCUMENTOS DIRETOS DENTRO DE CADA CATEGORIA
                for (const categoria of categoriasEncontradas) {
                    try {
                        console.log(`🔍 Buscando produtos na categoria: ${categoria.id}`);
                        
                        // Lista todos os documentos dentro da categoria
                        const produtosRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', categoria.id);
                        const produtosSnap = await getDocs(produtosRef);
                        
                        console.log(`📂 Documentos encontrados em ${categoria.id}:`, produtosSnap.docs.map(doc => doc.id));
                        
                        const produtosDaCategoria = [];
                        
                        for (const doc of produtosSnap.docs) {
                            const produtoData = doc.data();
                            console.log(`📄 Documento ${doc.id}:`, produtoData);
                            
                            // Considera como produto se tiver nome e preço
                            if (produtoData.nome && produtoData.preco !== undefined) {
                                produtosDaCategoria.push({
                                    id: doc.id,
                                    categoria: categoria.nome,
                                    categoriaId: categoria.id,
                                    ...produtoData
                                });
                            }
                        }
                        
                        todosProdutos = [...todosProdutos, ...produtosDaCategoria];
                        console.log(`✅ ${produtosDaCategoria.length} produtos válidos em ${categoria.nome}`);
                        
                    } catch (error) {
                        console.log(`❌ Erro na categoria ${categoria.nome}:`, error.message);
                    }
                }

                console.log("🎯 TODOS OS PRODUTOS ENCONTRADOS:", todosProdutos);
                setCardapio(todosProdutos);

                // 5. ATUALIZA A LISTA DE CATEGORIAS VISÍVEIS PARA FILTRO
                const categoriasUnicas = ['todas', ...new Set(categoriasEncontradas.map(c => c.nome).filter(Boolean))];
                setCategorias(categoriasUnicas);

                if (todosProdutos.length === 0) {
                    toast.warn("Nenhum produto encontrado. Verifique se os produtos estão cadastrados como documentos dentro de cada categoria.");
                } else {
                    toast.success(`🎉 ${todosProdutos.length} produtos carregados!`);
                }

            } catch (error) {
                console.error("ERRO AO BUSCAR DADOS:", error);
                if (error.code === 'permission-denied') {
                    toast.error("❌ Erro de Permissão. O cardápio está inacessível. Verifique as Regras do Firestore!");
                } else {
                    toast.error("❌ Erro ao carregar cardápio.");
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [estabelecimentoId, mesaId]);

    // --- FUNÇÕES DE LÓGICA DE PEDIDO MELHORADAS ---
    const adicionarItem = (produto) => {
        setResumoPedido(prev => {
            const itemExistente = prev.find(item => item.id === produto.id); 
            if (itemExistente) {
                return prev.map(item => 
                    item.id === produto.id 
                        ? { ...item, quantidade: item.quantidade + 1 } 
                        : item
                );
            }
            return [...prev, { ...produto, quantidade: 1, preco: parseFloat(produto.preco) }];
        });
        toast.success(`✅ ${produto.nome} adicionado!`, {
            icon: '🛒',
            position: "bottom-right"
        });
    };

    const ajustarQuantidade = (produtoId, novaQuantidade) => {
        if (novaQuantidade < 1) {
            removerItem(produtoId);
            return;
        }
        setResumoPedido(prev =>
            prev.map(item =>
                item.id === produtoId
                    ? { ...item, quantidade: novaQuantidade }
                    : item
            )
        );
    };

    const removerItem = (produtoId) => {
        const itemRemovido = resumoPedido.find(item => item.id === produtoId);
        setResumoPedido(prev => prev.filter(item => item.id !== produtoId));
        toast.warn(`🗑️ ${itemRemovido?.nome} removido!`, {
            position: "bottom-right"
        });
    };

    const salvarAlteracoes = async () => {
        setSalvando(true);
        const totalPedido = resumoPedido.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
        try {
            const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
            await updateDoc(mesaRef, { 
                itens: resumoPedido,
                status: resumoPedido.length > 0 ? 'com_pedido' : 'livre',
                total: totalPedido,
                updatedAt: new Date()
            });
            setMesa(prev => ({...prev, itens: resumoPedido }));
            toast.success("💾 Pedido salvo com sucesso!", {
                position: "bottom-right"
            });
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
                updatedAt: new Date()
            });

            toast.success("✅ Mesa finalizada para pagamento!", {
                position: "bottom-right"
            });
            navigate('/controle-salao'); 

        } catch (error) {
            console.error("Erro ao finalizar mesa para pagamento:", error);
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

    // Função para verificar se produto está no carrinho
    const produtoEstaNoCarrinho = (produtoId) => {
        return resumoPedido.some(item => item.id === produtoId);
    };

    // Filtros combinados e cálculos
    const produtosFiltrados = cardapio.filter(produto => {
        const buscaMatch = produto.nome.toLowerCase().includes(termoBusca.toLowerCase()) ||
                          (produto.descricao && produto.descricao.toLowerCase().includes(termoBusca.toLowerCase()));
        const categoriaMatch = categoriaAtiva === 'todas' || produto.categoria === categoriaAtiva;
        return buscaMatch && categoriaMatch;
    });

    const totalPedido = resumoPedido.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
    const totalItens = resumoPedido.reduce((acc, item) => acc + item.quantidade, 0);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-700 font-medium">Carregando cardápio de {estabelecimentoNome}...</p>
                    <p className="text-gray-500 text-sm mt-2">Isso pode levar alguns segundos</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">           
            {/* Header Aprimorado */}
            <header className="bg-white shadow-lg border-b border-amber-200 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <button 
                                onClick={handleVoltar}
                                className="flex items-center space-x-2 bg-white hover:bg-amber-50 text-gray-700 font-medium py-2 px-4 rounded-xl border border-amber-300 transition-all duration-200 hover:shadow-md"
                            >
                                <IoArrowBack className="text-lg"/>
                                <span>Voltar</span>
                            </button>
                            <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                                    <span className="text-white font-bold text-lg">{mesa?.numero || '?'}</span>
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-gray-900">Mesa {mesa?.numero || 'N/A'}</h1>
                                    <p className="text-sm text-gray-600">{estabelecimentoNome}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                            <div className="bg-amber-100 text-amber-800 px-4 py-2 rounded-xl font-semibold shadow-sm">
                                <span className="flex items-center space-x-2">
                                    <IoCartOutline className="text-lg" />
                                    <span>{totalItens} {totalItens === 1 ? 'item' : 'itens'}</span>
                                </span>
                            </div>
                            <button 
                                onClick={salvarAlteracoes}
                                disabled={salvando}
                                className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                            >
                                {salvando ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <IoSaveOutline className="text-lg" />
                                )}
                                <span>{salvando ? 'Salvando...' : 'Salvar'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Seção do Cardápio Aprimorada */}
                <div className="lg:col-span-3">
                    {/* Busca e Filtros Melhorados */}
                    <div className="bg-white rounded-2xl shadow-lg border border-amber-200 p-6 mb-6">
                        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
                            {/* Barra de Busca Aprimorada */}
                            <div className="flex-1 min-w-0 w-full">
                                <div className="relative">
                                    <IoSearchOutline className="absolute left-4 top-1/2 transform -translate-y-1/2 text-amber-400 text-xl" />
                                    <input
                                        type="text"
                                        placeholder="🔍 Buscar produtos por nome ou descrição..."
                                        value={termoBusca}
                                        onChange={(e) => setTermoBusca(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all duration-300 bg-amber-50 text-gray-800 placeholder-amber-400"
                                    />
                                </div>
                            </div>
                            
                            {/* Filtro de Categorias com Visual Melhorado */}
                            <div className="w-full lg:w-auto">
                                <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-thin scrollbar-thumb-amber-300 scrollbar-track-amber-100">
                                    {categorias.map(categoria => (
                                        <button
                                            key={categoria}
                                            onClick={() => setCategoriaAtiva(categoria)}
                                            className={`px-4 py-3 rounded-xl font-semibold whitespace-nowrap transition-all duration-200 transform hover:scale-105 ${
                                                categoriaAtiva === categoria
                                                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                                                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200 shadow-sm'
                                            }`}
                                            style={{ flexShrink: 0 }}
                                        >
                                            {categoria === 'todas' ? '📦 Todas' : `🍽️ ${categoria}`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Grid de Produtos Aprimorado */}
                    {produtosFiltrados.length > 0 ? (
                        <div>
                            <div className="mb-6 p-4 bg-white rounded-2xl shadow-sm border border-amber-200">
                                <div className="flex items-center justify-between">
                                    <p className="text-gray-700 font-medium">
                                        📊 Mostrando <span className="text-amber-600 font-bold">{produtosFiltrados.length}</span> de <span className="text-amber-600 font-bold">{cardapio.length}</span> produtos disponíveis
                                    </p>
                                    {termoBusca && (
                                        <button 
                                            onClick={() => setTermoBusca('')}
                                            className="text-amber-600 hover:text-amber-700 text-sm font-medium"
                                        >
                                            Limpar busca
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                                {produtosFiltrados.map(produto => (
                                    <ProdutoCard
                                        key={produto.id}
                                        produto={produto}
                                        onAdicionar={adicionarItem}
                                        estaNoCarrinho={produtoEstaNoCarrinho(produto.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-lg border border-amber-200 p-16 text-center">
                            <div className="w-24 h-24 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                <span className="text-4xl">🍕</span>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-3">
                                {cardapio.length === 0 ? 'Cardápio vazio' : 'Nenhum produto encontrado'}
                            </h3>
                            <p className="text-gray-600 mb-8 text-lg max-w-md mx-auto">
                                {cardapio.length === 0 
                                    ? 'Adicione produtos ao cardápio primeiro para começar a vender.' 
                                    : 'Tente ajustar os termos de busca ou selecione outra categoria.'}
                            </p>
                            {cardapio.length === 0 && (
                                <button 
                                    onClick={() => navigate('/cardapio')}
                                    className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg inline-flex items-center space-x-3"
                                >
                                    <IoRestaurantOutline className="text-xl" />
                                    <span>Ir para Gerenciar Cardápio</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Resumo do Pedido Aprimorado */}
                <aside className="lg:col-span-1">
                    <div className="bg-white rounded-2xl shadow-xl border border-amber-200 sticky lg:top-24 transition-all duration-300 hover:shadow-2xl">
                        <div className="p-6 border-b border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-2xl">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-3">
                                <IoReceiptOutline className="text-2xl text-amber-500" />
                                <span>Resumo do Pedido</span>
                            </h2>
                            {resumoPedido.length > 0 && (
                                <p className="text-amber-600 text-sm mt-1 font-medium">
                                    {totalItens} {totalItens === 1 ? 'item' : 'itens'} no pedido
                                </p>
                            )}
                        </div>

                        <div className="p-4 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-amber-300 scrollbar-track-amber-50">
                            {resumoPedido.length > 0 ? (
                                <div className="space-y-3">
                                    {resumoPedido.map(item => (
                                        <div key={item.id} className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200 hover:border-amber-300 transition-all duration-200">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-gray-900 text-sm leading-tight truncate">{item.nome}</p>
                                                    <p className="text-amber-600 font-semibold text-lg">
                                                        R$ {parseFloat(item.preco * item.quantidade).toFixed(2).replace('.', ',')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2 bg-white rounded-lg p-1 shadow-inner">
                                                    <button 
                                                        onClick={() => ajustarQuantidade(item.id, item.quantidade - 1)}
                                                        className="w-8 h-8 bg-amber-100 hover:bg-amber-200 rounded-lg flex items-center justify-center transition-colors duration-200"
                                                    >
                                                        <IoRemoveCircleOutline className="text-amber-600" />
                                                    </button>
                                                    <span className="font-bold text-gray-900 min-w-8 text-center text-lg">
                                                        {item.quantidade}
                                                    </span>
                                                    <button 
                                                        onClick={() => ajustarQuantidade(item.id, item.quantidade + 1)}
                                                        className="w-8 h-8 bg-amber-500 hover:bg-amber-600 rounded-lg flex items-center justify-center transition-colors duration-200"
                                                    >
                                                        <IoAddCircleOutline className="text-white" />
                                                    </button>
                                                </div>
                                                <button 
                                                    onClick={() => removerItem(item.id)}
                                                    className="w-8 h-8 bg-red-100 hover:bg-red-200 rounded-lg flex items-center justify-center transition-colors duration-200 ml-2"
                                                >
                                                    <IoTrashOutline className="text-red-600 text-sm" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <div className="w-20 h-20 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                                        <IoCartOutline className="text-3xl text-amber-400" />
                                    </div>
                                    <p className="text-gray-500 font-medium">Nenhum item adicionado</p>
                                    <p className="text-sm text-gray-400 mt-2">Adicione produtos do cardápio ao lado</p>
                                </div>
                            )}
                        </div>

                        {/* Total e Botões Finais Aprimorados */}
                        {resumoPedido.length > 0 && (
                            <div className="p-6 border-t border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 rounded-b-2xl">
                                <div className="flex justify-between items-center mb-6">
                                    <span className="font-bold text-gray-900 text-lg">Total do Pedido:</span>
                                    <span className="text-2xl font-bold text-green-600">
                                        R$ {totalPedido.toFixed(2).replace('.', ',')}
                                    </span>
                                </div>
                                
                                <div className="space-y-3">
                                    <button 
                                        onClick={salvarAlteracoes}
                                        disabled={salvando}
                                        className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-4 rounded-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-3 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {salvando ? (
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <IoSaveOutline className="text-xl" />
                                        )}
                                        <span className="text-lg">{salvando ? 'Salvando...' : 'Salvar Pedido'}</span>
                                    </button>
                                    
                                    <button 
                                        onClick={finalizarMesa}
                                        className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold py-4 px-4 rounded-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-3 shadow-lg"
                                    >
                                        <IoReceiptOutline className="text-xl" />
                                        <span className="text-lg">Finalizar Mesa / Pagar</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </aside>
            </main>
        </div>
    );
};

export default TelaPedidos;