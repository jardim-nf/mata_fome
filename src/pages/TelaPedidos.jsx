// src/pages/TelaPedidos.jsx - VERSÃO MELHORADA

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; 
import { db } from '../firebase';
import { getDocs, doc, getDoc, updateDoc, query, where, collectionGroup } from 'firebase/firestore'; 
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

// --- COMPONENTE DO PRODUTO MELHORADO ---
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

// --- COMPONENTE PRINCIPAL DA PÁGINA MELHORADO ---
const TelaPedidos = () => {
    const { id: mesaId } = useParams();
    const { estabelecimentoId } = useAuth();
    const navigate = useNavigate(); 
    
    const [mesa, setMesa] = useState(null);
    const [cardapio, setCardapio] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [resumoPedido, setResumoPedido] = useState([]);
    const [loading, setLoading] = useState(true);
    const [termoBusca, setTermoBusca] = useState('');
    const [categoriaAtiva, setCategoriaAtiva] = useState('todas');

    useEffect(() => {
        if (!estabelecimentoId) return;

        const fetchData = async () => {
            try {
                setLoading(true);

                const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
                const mesaSnap = await getDoc(mesaRef);
                if (mesaSnap.exists()) {
                    const mesaData = mesaSnap.data();
                    setMesa(mesaData);
                    setResumoPedido(mesaData.itens || []);
                }

                const itensRef = collectionGroup(db, 'itens');
                const q = query(itensRef, where('estabelecimentoId', '==', estabelecimentoId));
                
                const cardapioSnap = await getDocs(q);
                const produtosList = cardapioSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setCardapio(produtosList);

                const categoriasUnicas = ['todas', ...new Set(produtosList.map(p => p.categoria).filter(Boolean))];
                setCategorias(categoriasUnicas);

            } catch (error) {
                console.error("ERRO CRÍTICO AO BUSCAR DADOS:", error);
                toast.error("❌ Ocorreu um erro ao carregar o cardápio.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [estabelecimentoId, mesaId]);

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
            return [...prev, { ...produto, quantidade: 1 }];
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

    const salvarAlteracoes = async () => {
        try {
            const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
            await updateDoc(mesaRef, { 
                itens: resumoPedido,
                status: resumoPedido.length > 0 ? 'com_pedido' : 'livre',
                total: totalPedido,
                atualizadoEm: new Date()
            });
            
            setMesa(prev => ({...prev, itens: resumoPedido }));
            toast.success("💾 Pedido salvo com sucesso!");
        } catch (error) {
            console.error("Erro ao salvar alterações:", error);
            toast.error("❌ Falha ao salvar o pedido.");
        }
    };

    const handleVoltar = () => {
        const itemsSalvos = JSON.stringify(mesa?.itens || []);
        const itemsAtuais = JSON.stringify(resumoPedido);

        if (itemsSalvos !== itemsAtuais) {
            if (window.confirm("⚠️ Você tem alterações não salvas. Deseja realmente sair?")) {
                navigate('/controle-salao');
            }
        } else {
            navigate('/controle-salao');
        }
    };

    // Filtros combinados
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
                    <p className="mt-4 text-gray-600">Carregando cardápio...</p>
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
                                <h1 className="text-xl font-bold text-gray-900">
                                    Mesa {mesa?.numero || 'N/A'}
                                </h1>
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
                    {/* Barra de Pesquisa e Filtros */}
                    <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                            <div className="relative flex-1 md:max-w-md">
                                <IoSearchOutline className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg" />
                                <input 
                                    type="text" 
                                    placeholder="Pesquisar produtos..." 
                                    value={termoBusca} 
                                    onChange={e => setTermoBusca(e.target.value)} 
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                />
                            </div>
                            
                            <div className="flex space-x-2 overflow-x-auto pb-2 md:pb-0">
                                {categorias.map(categoria => (
                                    <button
                                        key={categoria}
                                        onClick={() => setCategoriaAtiva(categoria)}
                                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                                            categoriaAtiva === categoria
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        }`}
                                    >
                                        {categoria === 'todas' ? '📦 Todas' : categoria}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Grid de Produtos */}
                    {produtosFiltrados.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                            {produtosFiltrados.map(produto => (
                                <ProdutoCard key={produto.id} produto={produto} onAdicionar={adicionarItem} />
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <IoSearchOutline className="text-2xl text-gray-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum produto encontrado</h3>
                            <p className="text-gray-600">Tente ajustar os filtros ou termos de pesquisa.</p>
                        </div>
                    )}
                </div>

                {/* Resumo do Pedido */}
                <aside className="lg:col-span-1">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 sticky top-24">
                        {/* Header do Resumo */}
                        <div className="p-4 border-b border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center">
                                <IoCartOutline className="mr-2 text-blue-600" />
                                Resumo do Pedido
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">Mesa {mesa?.numero}</p>
                        </div>

                        {/* Lista de Itens */}
                        <div className="p-4 max-h-96 overflow-y-auto">
                            {resumoPedido.length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <IoCartOutline className="text-xl text-gray-400" />
                                    </div>
                                    <p className="text-gray-500 text-sm">Nenhum item adicionado</p>
                                </div>
                            ) : (
                                <ul className="space-y-3">
                                    {resumoPedido.map(item => (
                                        <li key={item.id} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                                            <div className="flex-1">
                                                <span className="font-medium text-gray-900 text-sm block">
                                                    {item.quantidade}x {item.nome}
                                                </span>
                                                <span className="text-blue-600 font-semibold text-sm">
                                                    R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}
                                                </span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <button 
                                                    onClick={() => ajustarQuantidade(item.id, item.quantidade - 1)}
                                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                                >
                                                    <IoRemoveCircleOutline />
                                                </button>
                                                <span className="text-sm font-medium w-6 text-center">{item.quantidade}</span>
                                                <button 
                                                    onClick={() => ajustarQuantidade(item.id, item.quantidade + 1)}
                                                    className="text-gray-400 hover:text-green-500 transition-colors"
                                                >
                                                    <IoAddCircleOutline />
                                                </button>
                                                <button 
                                                    onClick={() => removerItem(item.id)}
                                                    className="text-gray-400 hover:text-red-500 ml-2 transition-colors"
                                                >
                                                    <IoTrashOutline />
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Total e Botão Salvar */}
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
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                                >
                                    <IoSaveOutline className="text-lg" />
                                    <span>Salvar Pedido</span>
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