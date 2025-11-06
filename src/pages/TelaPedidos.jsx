// src/pages/TelaPedidos.jsx - VERSÃO CORRIGIDA COM ESTRUTURA REAL

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
    IoSaveOutline
} from 'react-icons/io5';

// --- COMPONENTE DO PRODUTO ---
const ProdutoCard = ({ produto, onAdicionar }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col group">
        {produto.imageUrl ? (
            <div className="relative overflow-hidden">
                <img 
                    src={produto.imageUrl} 
                    alt={produto.nome} 
                    className="w-full h-32 object-cover transition-transform duration-300 group-hover:scale-105" 
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-5 transition-all duration-300"></div>
            </div>
        ) : (
            <div className="w-full h-32 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <span className="text-xs text-gray-400">📷 Sem imagem</span>
            </div>
        )}
        <div className="p-4 flex flex-col flex-grow">
            <h3 className="text-gray-900 font-semibold text-sm leading-tight flex-grow mb-2">{produto.nome}</h3>
            <p className="text-blue-600 font-bold text-lg mb-3">
                R$ {parseFloat(produto.preco).toFixed(2).replace('.', ',')}
            </p>
            <button 
                onClick={() => onAdicionar(produto)} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-2"
            >
                <IoAddCircleOutline className="text-lg" />
                <span>Adicionar</span>
            </button>
        </div>
    </div>
);

const TelaPedidos = () => {
    const { id: mesaId } = useParams();
    const { estabelecimentoIdPrincipal } = useAuth();
    const navigate = useNavigate(); 
    
    const [mesa, setMesa] = useState(null);
    const [cardapio, setCardapio] = useState([]);
    const [categorias, setCategorias] = useState(['todas']);
    const [resumoPedido, setResumoPedido] = useState([]);
    const [loading, setLoading] = useState(true);
    const [termoBusca, setTermoBusca] = useState('');
    const [categoriaAtiva, setCategoriaAtiva] = useState('todas');

    useEffect(() => {
        if (!estabelecimentoIdPrincipal) {
            setLoading(false);
            toast.error("Estabelecimento não identificado.");
            return;
        }

        const fetchData = async () => {
            try {
                setLoading(true);

                // 1. Buscar dados da Mesa
                const mesaRef = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'mesas', mesaId);
                const mesaSnap = await getDoc(mesaRef);
                
                if (mesaSnap.exists()) {
                    const mesaData = mesaSnap.data();
                    setMesa(mesaData);
                    setResumoPedido(mesaData.itens || []);
                } else {
                    toast.error("Mesa não encontrada.");
                    setLoading(false);
                    return;
                }

                // 2. Buscar TODOS os produtos de TODAS as categorias
                // Baseado na sua estrutura real do Firestore
                const categoriasComSubcolecoes = [
                    { id: 'bebidas', nome: 'Bebidas' },
                    { id: 'burguers-artesanais', nome: 'Burguers Artesanais' },
                    { id: 'burguers-convencionais', nome: 'Burguers Convencionais' },
                    { id: 'combos', nome: 'Combos' },
                    { id: 'porcoes-petiscos', nome: 'Porções e Petiscos' }
                ];

                let todosProdutos = [];

                for (const categoria of categoriasComSubcolecoes) {
                    try {
                        // Tentar diferentes nomes de subcoleções
                        const possiveisSubcolecoes = ['itens', 'produtos', 'items'];
                        
                        for (const subcolecao of possiveisSubcolecoes) {
                            try {
                                const produtosRef = collection(
                                    db, 
                                    'estabelecimentos', 
                                    estabelecimentoIdPrincipal, 
                                    'cardapio', 
                                    categoria.id, 
                                    subcolecao
                                );
                                const produtosSnap = await getDocs(produtosRef);
                                
                                if (!produtosSnap.empty) {
                                    const produtosDaCategoria = produtosSnap.docs.map(doc => ({
                                        id: doc.id,
                                        categoria: categoria.nome,
                                        categoriaId: categoria.id,
                                        ...doc.data()
                                    }));
                                    todosProdutos = [...todosProdutos, ...produtosDaCategoria];
                                    console.log(`✅ Encontrados ${produtosDaCategoria.length} produtos em ${categoria.nome}/${subcolecao}`);
                                    break; // Sai do loop de subcoleções se encontrou
                                }
                            } catch (error) {
                                // Continua para a próxima subcoleção
                                console.log(`❌ Subcoleção ${subcolecao} não encontrada em ${categoria.nome}`);
                            }
                        }
                    } catch (error) {
                        console.log(`❌ Erro na categoria ${categoria.nome}:`, error.message);
                    }
                }

                console.log("🎯 TODOS OS PRODUTOS ENCONTRADOS:", todosProdutos);
                setCardapio(todosProdutos);

                // Extrair categorias únicas dos produtos
                const categoriasUnicas = ['todas', ...new Set(todosProdutos.map(p => p.categoria).filter(Boolean))];
                setCategorias(categoriasUnicas);

                if (todosProdutos.length === 0) {
                    toast.warn("Nenhum produto encontrado. Verifique se os produtos estão cadastrados nas subcoleções.");
                } else {
                    toast.success(`🎉 ${todosProdutos.length} produtos carregados!`);
                }

            } catch (error) {
                console.error("ERRO AO BUSCAR DADOS:", error);
                toast.error("❌ Erro ao carregar cardápio.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [estabelecimentoIdPrincipal, mesaId]);

    // --- FUNÇÕES DE LÓGICA DE PEDIDO ---
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
            return [...prev, { ...produto, quantidade: 1, preco: produto.preco }];
        });
        toast.success(`✅ ${produto.nome} adicionado!`);
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
        setResumoPedido(prev => prev.filter(item => item.id !== produtoId));
        toast.warn("🗑️ Item removido.");
    };

    // FUNÇÃO 1: SALVAR ALTERAÇÕES
    const salvarAlteracoes = async () => {
        const totalPedido = resumoPedido.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
        try {
            const mesaRef = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'mesas', mesaId);
            await updateDoc(mesaRef, { 
                itens: resumoPedido,
                status: resumoPedido.length > 0 ? 'com_pedido' : 'livre',
                total: totalPedido,
                atualizadoEm: new Date()
            });
            setMesa(prev => ({...prev, itens: resumoPedido }));
            toast.success("💾 Pedido salvo com sucesso!");
            navigate('/controle-salao'); 
        } catch (error) {
            console.error("Erro ao salvar alterações:", error);
            toast.error("❌ Falha ao salvar o pedido.");
        }
    };

    // FUNÇÃO 2: FINALIZAR MESA PARA PAGAMENTO
    const finalizarMesa = async () => {
        if (resumoPedido.length === 0) {
            toast.warn("Não é possível finalizar um pedido vazio.");
            return;
        }

        const totalPedido = resumoPedido.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);

        try {
            const mesaRef = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'mesas', mesaId);
            
            await updateDoc(mesaRef, { 
                itens: resumoPedido,
                status: 'pagamento',
                total: totalPedido,
                atualizadoEm: new Date()
            });

            toast.success("✅ Mesa finalizada para pagamento!");
            navigate('/controle-salao'); 

        } catch (error) {
            console.error("Erro ao finalizar mesa para pagamento:", error);
            toast.error("❌ Falha ao finalizar a mesa.");
        }
    };

    const handleVoltar = () => {
        navigate('/controle-salao');
    };

    // Filtros combinados e cálculos
    const produtosFiltrados = cardapio.filter(produto => {
        const buscaMatch = produto.nome.toLowerCase().includes(termoBusca.toLowerCase());
        const categoriaMatch = categoriaAtiva === 'todas' || produto.categoria === categoriaAtiva;
        return buscaMatch && categoriaMatch;
    });

    const totalPedido = resumoPedido.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
    const totalItens = resumoPedido.reduce((acc, item) => acc + item.quantidade, 0);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 text-gray-600">Carregando cardápio da BlackBurguer...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">           
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <button 
                                onClick={handleVoltar}
                                className="flex items-center space-x-2 bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-lg border border-gray-300 transition-colors"
                            >
                                <IoArrowBack className="text-lg"/>
                                <span>Voltar</span>
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Mesa {mesa?.numero || 'N/A'} - BlackBurguer</h1>
                                <p className="text-sm text-gray-600">Adicionando itens ao pedido</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                            <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                                {totalItens} itens
                            </div>
                            <button 
                                onClick={salvarAlteracoes}
                                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                            >
                                <IoSaveOutline className="text-lg"/>
                                <span>Salvar</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Seção do Cardápio */}
                <div className="lg:col-span-3">
                    {/* Busca e Filtros */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                        <div className="flex flex-col md:flex-row gap-4">
                            {/* Barra de Busca */}
                            <div className="flex-1">
                                <div className="relative">
                                    <IoSearchOutline className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg" />
                                    <input
                                        type="text"
                                        placeholder="Buscar produtos..."
                                        value={termoBusca}
                                        onChange={(e) => setTermoBusca(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                    />
                                </div>
                            </div>
                            
                            {/* Filtro de Categorias */}
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {categorias.map(categoria => (
                                    <button
                                        key={categoria}
                                        onClick={() => setCategoriaAtiva(categoria)}
                                        className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                                            categoriaAtiva === categoria
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        {categoria === 'todas' ? 'Todas' : categoria}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Grid de Produtos */}
                    {produtosFiltrados.length > 0 ? (
                        <div>
                            <div className="mb-4">
                                <p className="text-gray-600">
                                    Mostrando {produtosFiltrados.length} produtos de {cardapio.length} disponíveis
                                </p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {produtosFiltrados.map(produto => (
                                    <ProdutoCard
                                        key={produto.id}
                                        produto={produto}
                                        onAdicionar={adicionarItem}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-3xl">🍔</span>
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                {cardapio.length === 0 ? 'Cardápio vazio' : 'Nenhum produto encontrado'}
                            </h3>
                            <p className="text-gray-600 mb-6">
                                {cardapio.length === 0 
                                    ? 'Adicione produtos ao cardápio primeiro.' 
                                    : 'Tente ajustar os filtros de busca.'}
                            </p>
                            {cardapio.length === 0 && (
                                <button 
                                    onClick={() => navigate('/cardapio')}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors inline-flex items-center space-x-2"
                                >
                                    <span>Ir para Cardápio</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Resumo do Pedido */}
                <aside className="lg:col-span-1">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 sticky top-24">
                        <div className="p-4 border-b border-gray-200">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center space-x-2">
                                <IoCartOutline className="text-xl" />
                                <span>Resumo do Pedido</span>
                            </h2>
                        </div>

                        <div className="p-4 max-h-96 overflow-y-auto">
                            {resumoPedido.length > 0 ? (
                                <div className="space-y-3">
                                    {resumoPedido.map(item => (
                                        <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex-1">
                                                <p className="font-semibold text-gray-900 text-sm">{item.nome}</p>
                                                <p className="text-blue-600 font-bold">
                                                    R$ {parseFloat(item.preco).toFixed(2).replace('.', ',')}
                                                </p>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <button 
                                                    onClick={() => ajustarQuantidade(item.id, item.quantidade - 1)}
                                                    className="w-8 h-8 bg-gray-200 hover:bg-gray-300 rounded-full flex items-center justify-center transition-colors"
                                                >
                                                    <IoRemoveCircleOutline className="text-gray-700" />
                                                </button>
                                                <span className="font-bold text-gray-900 min-w-8 text-center">
                                                    {item.quantidade}
                                                </span>
                                                <button 
                                                    onClick={() => ajustarQuantidade(item.id, item.quantidade + 1)}
                                                    className="w-8 h-8 bg-blue-100 hover:bg-blue-200 rounded-full flex items-center justify-center transition-colors"
                                                >
                                                    <IoAddCircleOutline className="text-blue-600" />
                                                </button>
                                                <button 
                                                    onClick={() => removerItem(item.id)}
                                                    className="w-8 h-8 bg-red-100 hover:bg-red-200 rounded-full flex items-center justify-center transition-colors ml-2"
                                                >
                                                    <IoTrashOutline className="text-red-600 text-sm" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <IoCartOutline className="text-2xl text-gray-400" />
                                    </div>
                                    <p className="text-gray-500">Nenhum item adicionado</p>
                                    <p className="text-sm text-gray-400 mt-1">Adicione produtos do cardápio</p>
                                </div>
                            )}
                        </div>

                        {/* Total e Botões Finais */}
                        {resumoPedido.length > 0 && (
                            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="font-semibold text-gray-900">Total:</span>
                                    <span className="text-xl font-bold text-green-600">
                                        R$ {totalPedido.toFixed(2).replace('.', ',')}
                                    </span>
                                </div>
                                
                                <button 
                                    onClick={salvarAlteracoes}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 mb-3"
                                >
                                    <IoSaveOutline className="text-lg" />
                                    <span>Salvar Pedido</span>
                                </button>
                                
                                <button 
                                    onClick={finalizarMesa}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                                >
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
                                    </svg>
                                    <span>Finalizar Mesa / Pagar</span>
                                </button>
                            </div>
                        )}
                    </div>
                </aside>
            </main>
        </div>
    );
};

export default TelaPedidos;