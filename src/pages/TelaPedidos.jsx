import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; 
import { db } from '../firebase';
import { 
    getDocs, 
    doc, 
    getDoc, 
    updateDoc, 
    collection, 
    serverTimestamp, 
    query, 
    where,
    writeBatch
} from 'firebase/firestore'; 
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { 
    IoArrowBack, IoCart, IoTrash, IoSearch, IoAdd,
    IoRemove, IoSave, IoRestaurant, IoReceipt,
    IoCheckmark, IoChevronDown, IoClose, IoPerson,
    IoPencil, IoAddCircle, IoRemoveCircle, IoGrid,
    IoList, IoTime, IoCheckmarkCircle, IoChevronUp,
    IoAddOutline, IoRemoveOutline
} from 'react-icons/io5';

// --- COMPONENTE PRODUTO CARD MOBILE-FIRST ---
const ProdutoCard = ({ produto, onAdicionar, estaNoCarrinho, layout = 'grid' }) => {
    const [mostrarVariacoes, setMostrarVariacoes] = useState(false);
    const [variacaoSelecionada, setVariacaoSelecionada] = useState(null);
    const temVariacoes = produto.variacoes && produto.variacoes.length > 0;
    const podeAdicionar = !temVariacoes || produto.variacoes.filter(v => v.ativo !== false).length === 1;

    const handleAdicionar = useCallback(() => {
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
            toast.success('✅ Adicionado!', { position: "bottom-center" });
            return;
        }
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
        toast.success('✅ Adicionado!', { position: "bottom-center" });
    }, [produto, temVariacoes, variacaoSelecionada, onAdicionar, podeAdicionar]);

    // Layout Mobile Otimizado
    return (
        <div className="bg-white rounded-lg border border-gray-200 hover:border-blue-300 active:scale-95 transition-all duration-150 overflow-hidden flex flex-col h-full">
            {produto.imageUrl ? (
                <div className="relative h-24 overflow-hidden">
                    <img 
                        src={produto.imageUrl} 
                        alt={produto.nome} 
                        className="w-full h-full object-cover"
                    />
                    {estaNoCarrinho && (
                        <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-1 shadow-lg">
                            <IoCheckmark className="text-xs" />
                        </div>
                    )}
                </div>
            ) : (
                <div className="w-full h-24 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                    <IoRestaurant className="text-xl text-blue-400" />
                </div>
            )}
            
            <div className="p-2 flex flex-col flex-grow">
                <div className="flex-grow mb-1">
                    <h3 className="text-gray-900 font-semibold text-xs leading-tight line-clamp-2 mb-1">{produto.nome}</h3>
                    {produto.descricao && (
                        <p className="text-gray-500 text-[10px] line-clamp-2 leading-tight">{produto.descricao}</p>
                    )}
                </div>

                {temVariacoes && !podeAdicionar && mostrarVariacoes && (
                    <div className="mb-1 p-1 bg-blue-50 rounded border border-blue-100">
                        <div className="space-y-1 max-h-20 overflow-y-auto">
                            {produto.variacoes.map((variacao, index) => (
                                <button 
                                    key={index} 
                                    onClick={() => setVariacaoSelecionada(variacao)}
                                    className={`w-full text-left p-1 rounded text-[10px] flex justify-between items-center transition-all ${
                                        variacaoSelecionada === variacao 
                                            ? 'bg-blue-500 text-white' 
                                            : 'bg-white text-gray-700 border border-gray-200'
                                    }`}
                                >
                                    <span className="font-medium truncate">{variacao.nome || variacao.tamanho}</span>
                                    <span className="font-bold whitespace-nowrap">R$ {parseFloat(variacao.preco || produto.preco).toFixed(2)}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between mt-auto">
                    <span className="text-blue-600 font-bold text-xs">R$ {parseFloat(produto.preco).toFixed(2)}</span>
                    <button 
                        onClick={handleAdicionar}
                        disabled={!podeAdicionar && temVariacoes && mostrarVariacoes && !variacaoSelecionada}
                        className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-0.5 transition-all active:scale-95 ${
                            estaNoCarrinho 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-blue-500 hover:bg-blue-600 text-white'
                        } ${(!podeAdicionar && temVariacoes && mostrarVariacoes && !variacaoSelecionada) ? 'opacity-50' : ''}`}
                    >
                        {temVariacoes && !podeAdicionar && !mostrarVariacoes ? (
                            <>
                                Opções
                                <IoChevronDown className="text-[8px]"/>
                            </>
                        ) : (
                            <>
                                <IoAdd className="text-[10px]"/> 
                                Add
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL MOBILE-FIRST ---
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
    const [salvando, setSalvando] = useState(false);
    const [showOrderSummary, setShowOrderSummary] = useState(false);
    const [layout, setLayout] = useState('grid');

    // COMANDA INDIVIDUAL
    const [ocupantes, setOcupantes] = useState(['Mesa']); 
    const [clienteSelecionado, setClienteSelecionado] = useState('Mesa');
    const [editandoNomeIndex, setEditandoNomeIndex] = useState(null);
    const [novoNomeTemp, setNovoNomeTemp] = useState('');

    const fetchData = useCallback(async () => {
        if (!estabelecimentoId) return;
        try {
            setLoading(true);
            const mesaSnap = await getDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId));

            if (mesaSnap.exists()) {
                const mesaData = mesaSnap.data();
                setMesa(mesaData);
                setResumoPedido(mesaData.itens || []);
                
                if (mesaData.nomesOcupantes && mesaData.nomesOcupantes.length > 0) {
                    setOcupantes(mesaData.nomesOcupantes);
                    setClienteSelecionado(mesaData.nomesOcupantes[0]);
                }
            }

            // Carregar cardápio
            const snap = await getDocs(query(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio'), where('ativo', '==', true)));
            const produtos = snap.docs.map(d => ({...d.data(), id: d.id}));
            setCardapio(produtos);
            setCategorias(['Todos', ...new Set(produtos.map(p => p.categoria).filter(Boolean))]);

        } catch (error) { 
            toast.error("Erro ao carregar", { position: "bottom-center" }); 
        } finally { 
            setLoading(false); 
        }
    }, [estabelecimentoId, mesaId]);

    useEffect(() => { 
        fetchData(); 
    }, [fetchData]);

    const salvarNomePessoa = async (index, novoNome) => {
        if (!novoNome.trim()) return;
        
        const novosOcupantes = [...ocupantes];
        novosOcupantes[index] = novoNome;
        setOcupantes(novosOcupantes);
        setEditandoNomeIndex(null);
        
        // Se estava editando o cliente selecionado, atualiza também
        if (clienteSelecionado === ocupantes[index]) {
            setClienteSelecionado(novoNome);
        }

        try {
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), {
                nomesOcupantes: novosOcupantes,
                updatedAt: serverTimestamp()
            });
            toast.success('Nome atualizado! ✏️', { position: "bottom-center" });
        } catch(e) { 
            console.error("Erro ao salvar nome", e);
            toast.error('Erro ao salvar nome', { position: "bottom-center" });
        }
    };

    const adicionarItem = useCallback((produto) => {
        setResumoPedido(prev => {
            const itemExistente = prev.find(item => 
                item.id === produto.id && 
                item.cliente === clienteSelecionado &&
                (item.status === 'pendente' || !item.status)
            ); 
            
            if (itemExistente) {
                return prev.map(item => 
                    (item.id === produto.id && item.cliente === clienteSelecionado && (item.status === 'pendente' || !item.status)) 
                        ? { ...item, quantidade: item.quantidade + 1 } 
                        : item
                );
            }
            
            return [...prev, { 
                ...produto, 
                quantidade: 1, 
                preco: parseFloat(produto.preco), 
                nome: produto.nomeCompleto || produto.nome,
                cliente: clienteSelecionado,
                adicionadoEm: new Date(),
                status: 'pendente'
            }];
        });
    }, [clienteSelecionado]);

    const ajustarQuantidade = useCallback((produtoId, clienteDoItem, novaQuantidade) => {
        setResumoPedido(prev => {
            const itemAlvo = prev.find(item => item.id === produtoId && item.cliente === clienteDoItem);
            
            if (itemAlvo && (itemAlvo.status === 'enviado' || itemAlvo.status === 'entregue')) {
                toast.info("Item já enviado", { position: "bottom-center" });
                return prev;
            }

            if (novaQuantidade < 1) {
                toast.info('🗑️ Removido', { position: "bottom-center" });
                return prev.filter(item => !(item.id === produtoId && item.cliente === clienteDoItem));
            }
            
            return prev.map(item => 
                (item.id === produtoId && item.cliente === clienteDoItem) 
                    ? { ...item, quantidade: novaQuantidade } 
                    : item
            );
        });
    }, []);

    const salvarAlteracoes = async () => {
        setSalvando(true);
        try {
            const itensNovos = resumoPedido.filter(item => item.status === 'pendente' || !item.status);
            const totalGeral = resumoPedido.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);

            if (itensNovos.length === 0) {
                await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), {
                    itens: resumoPedido,
                    nomesOcupantes: ocupantes,
                    total: totalGeral,
                    updatedAt: serverTimestamp()
                });
                toast.success("✅ Mesa salva", { position: "bottom-center" });
                navigate('/controle-salao');
                return;
            }

            const batch = writeBatch(db);
            const timestampAtual = Date.now();
            const idPedidoCozinha = `pedido_${mesaId}_${timestampAtual}`;
            const pedidoRef = doc(db, 'estabelecimentos', estabelecimentoId, 'pedidos', idPedidoCozinha);

            batch.set(pedidoRef, {
                id: idPedidoCozinha,
                mesaId: mesaId,
                mesaNumero: mesa?.numero,
                itens: itensNovos.map(item => ({ ...item, status: 'recebido' })),
                status: 'recebido',
                total: itensNovos.reduce((acc, item) => acc + (item.preco * item.quantidade), 0),
                dataPedido: serverTimestamp(),
                source: 'salao',
                updatedAt: serverTimestamp()
            });

            const itensMesaAtualizados = resumoPedido.map(item => {
                if (item.status === 'pendente' || !item.status) {
                    return { ...item, status: 'enviado', pedidoCozinhaId: idPedidoCozinha };
                }
                return item;
            });

            const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
            batch.update(mesaRef, {
                itens: itensMesaAtualizados,
                nomesOcupantes: ocupantes,
                status: 'com_pedido',
                total: totalGeral,
                updatedAt: serverTimestamp()
            });

            await batch.commit();
            toast.success(`✅ ${itensNovos.length} itens enviados!`, { position: "bottom-center" });
            setShowOrderSummary(false);
            setTimeout(() => navigate('/controle-salao'), 800);
            
        } catch (error) { 
            toast.error("❌ Erro ao enviar", { position: "bottom-center" }); 
        } finally { setSalvando(false); }
    };

    const produtosFiltrados = cardapio.filter(p => 
        (!termoBusca || p.nome.toLowerCase().includes(termoBusca.toLowerCase())) && 
        (categoriaAtiva === 'Todos' || p.categoria === categoriaAtiva)
    );

    const totalPedido = resumoPedido.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
    const totalItens = resumoPedido.reduce((acc, item) => acc + item.quantidade, 0);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
                    <p className="text-gray-600 text-sm">Carregando...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 safe-area-bottom">
            {/* Header Mobile Otimizado */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-40 safe-area-top">
                <div className="px-3 py-2">
                    {/* Top Bar Compacta */}
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <button 
                                onClick={() => navigate('/controle-salao')} 
                                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors active:scale-95 flex-shrink-0"
                            >
                                <IoArrowBack className="text-base text-gray-600"/>
                            </button>
                            <div className="min-w-0 flex-1">
                                <h1 className="font-bold text-base text-gray-900 truncate">Mesa {mesa?.numero}</h1>
                                <p className="text-gray-500 text-xs truncate">Pedindo para: {clienteSelecionado}</p>
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => setShowOrderSummary(true)} 
                            className="relative bg-blue-500 text-white p-2 rounded-lg font-semibold text-sm flex items-center gap-1 shadow-sm hover:bg-blue-600 transition-colors active:scale-95 flex-shrink-0"
                        >
                            <IoCart className="text-base"/>
                            {totalItens > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                                    {totalItens}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Seleção de Pessoa - Edição com 1 Clique */}
                    <div className="flex gap-1 overflow-x-auto pb-1 hide-scrollbar">
                        {ocupantes.map((nome, index) => (
                            <div key={index} className="relative flex-shrink-0">
                                {editandoNomeIndex === index ? (
                                    // Modo Edição
                                    <div className="flex items-center gap-2 bg-white border-2 border-blue-500 rounded-xl p-2">
                                        <input 
                                            autoFocus
                                            className="w-20 px-2 py-1 text-sm rounded border border-gray-300 focus:ring-1 focus:ring-blue-500 outline-none"
                                            value={novoNomeTemp}
                                            onChange={(e) => setNovoNomeTemp(e.target.value)}
                                            onBlur={() => {
                                                if (novoNomeTemp.trim()) {
                                                    salvarNomePessoa(index, novoNomeTemp.trim());
                                                } else {
                                                    setEditandoNomeIndex(null);
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    if (novoNomeTemp.trim()) {
                                                        salvarNomePessoa(index, novoNomeTemp.trim());
                                                    }
                                                }
                                                if (e.key === 'Escape') {
                                                    setEditandoNomeIndex(null);
                                                }
                                            }}
                                            placeholder="Nome"
                                            maxLength={15}
                                        />
                                    </div>
                                ) : (
                                    // Botão Normal - 1 Clique para Editar (se não for "Mesa")
                                    <button
                                        onClick={() => {
                                            if (nome !== 'Mesa') {
                                                setEditandoNomeIndex(index);
                                                setNovoNomeTemp(nome);
                                            }
                                            setClienteSelecionado(nome);
                                        }}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors active:scale-95 ${
                                            clienteSelecionado === nome 
                                                ? 'bg-blue-500 text-white shadow-sm' 
                                                : 'bg-gray-100 text-gray-700 active:bg-gray-200'
                                        }`}
                                    >
                                        <IoPerson className="text-xs"/>
                                        {nome}
                                        
                                        {nome !== 'Mesa' && clienteSelecionado === nome && (
                                            <div className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 shadow-lg">
                                                <IoPencil className="text-[8px]" />
                                            </div>
                                        )}
                                    </button>
                                )}
                            </div>
                        ))}
                        
                        <button 
                            onClick={() => { 
                                const n = `P${ocupantes.length}`; 
                                setOcupantes([...ocupantes, n]); 
                                setClienteSelecionado(n); 
                            }} 
                            className="w-8 h-8 rounded bg-gray-100 border border-dashed border-gray-300 active:border-blue-400 flex items-center justify-center text-gray-500 active:text-blue-500 transition-colors flex-shrink-0 active:scale-95"
                        >
                            <IoAdd className="text-sm"/>
                        </button>
                    </div>
                </div>

                {/* Barra de Busca e Filtros */}
                <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
                    <div className="flex gap-2 mb-2">
                        {/* Busca */}
                        <div className="flex-1 relative">
                            <IoSearch className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm"/>
                            <input 
                                type="text" 
                                placeholder="Buscar produtos..." 
                                value={termoBusca} 
                                onChange={e => setTermoBusca(e.target.value)} 
                                className="w-full pl-7 pr-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-transparent text-sm"
                            />
                        </div>
                        
                        {/* Layout Toggle */}
                        <div className="flex bg-white border border-gray-200 rounded-lg p-0.5">
                            <button
                                onClick={() => setLayout('grid')}
                                className={`p-1.5 rounded transition-colors ${layout === 'grid' ? 'bg-blue-500 text-white' : 'text-gray-500'}`}
                            >
                                <IoGrid className="text-xs"/>
                            </button>
                            <button
                                onClick={() => setLayout('list')}
                                className={`p-1.5 rounded transition-colors ${layout === 'list' ? 'bg-blue-500 text-white' : 'text-gray-500'}`}
                            >
                                <IoList className="text-xs"/>
                            </button>
                        </div>
                    </div>
                    
                    {/* Categorias - Scroll Horizontal */}
                    <div className="flex gap-1 overflow-x-auto hide-scrollbar">
                        {categorias.map(cat => (
                            <button 
                                key={cat} 
                                onClick={() => setCategoriaAtiva(cat)}
                                className={`whitespace-nowrap px-2 py-1 rounded text-xs font-medium transition-colors flex-shrink-0 active:scale-95 ${
                                    categoriaAtiva === cat 
                                        ? 'bg-blue-500 text-white' 
                                        : 'bg-white text-gray-600 active:bg-gray-100 border border-gray-200'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            {/* Lista de Produtos - Mobile First */}
            <main className="p-2">
                {produtosFiltrados.length > 0 ? (
                    layout === 'grid' ? (
                        <div className="grid grid-cols-3 gap-2">
                            {produtosFiltrados.map(produto => (
                                <ProdutoCard 
                                    key={produto.id} 
                                    produto={produto} 
                                    onAdicionar={adicionarItem} 
                                    estaNoCarrinho={resumoPedido.some(item => item.id === produto.id && item.cliente === clienteSelecionado)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {produtosFiltrados.map(produto => (
                                <div key={produto.id} className="bg-white rounded-lg border border-gray-200 p-2 flex items-center gap-2 active:scale-95 transition-transform">
                                    {produto.imageUrl ? (
                                        <img src={produto.imageUrl} alt={produto.nome} className="w-10 h-10 rounded object-cover flex-shrink-0"/>
                                    ) : (
                                        <div className="w-10 h-10 rounded bg-blue-50 flex items-center justify-center flex-shrink-0">
                                            <IoRestaurant className="text-blue-400 text-sm"/>
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-sm text-gray-900 truncate">{produto.nome}</h3>
                                        <p className="text-blue-600 font-bold text-xs">R$ {parseFloat(produto.preco).toFixed(2)}</p>
                                    </div>
                                    <button 
                                        onClick={() => adicionarItem(produto)}
                                        className="bg-blue-500 hover:bg-blue-600 text-white p-1.5 rounded-lg transition-colors active:scale-90 flex-shrink-0"
                                    >
                                        <IoAdd className="text-xs"/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    <div className="text-center py-8">
                        <IoSearch className="text-3xl text-gray-300 mx-auto mb-2"/>
                        <p className="text-gray-500 text-sm">Nenhum produto encontrado</p>
                        <p className="text-gray-400 text-xs">Tente ajustar os filtros ou busca</p>
                    </div>
                )}
            </main>

            {/* Barra Flutuante Mobile - Otimizada */}
            {resumoPedido.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 shadow-lg safe-area-padding">
                    <div className="flex justify-between items-center">
                        <div className="flex-1">
                            <p className="text-gray-500 text-xs">Total do pedido</p>
                            <p className="font-bold text-gray-900 text-lg">R$ {totalPedido.toFixed(2)}</p>
                        </div>
                        <button 
                            onClick={() => setShowOrderSummary(true)} 
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold text-sm flex items-center gap-2 transition-colors active:scale-95 whitespace-nowrap"
                        >
                            <IoCart className="text-base"/> 
                            Ver Pedido
                            {totalItens > 0 && (
                                <span className="bg-white text-blue-500 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                                    {totalItens}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Bottom Sheet Mobile - Nativo */}
            {showOrderSummary && (
                <>
                    <div 
                        className="fixed inset-0 bg-black/50 z-40 transition-opacity" 
                        onClick={() => setShowOrderSummary(false)} 
                    />
                    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[85vh] overflow-hidden animate-slide-up">
                        {/* Handle */}
                        <div className="flex justify-center pt-2 pb-1">
                            <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
                        </div>
                        
                        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                            <h2 className="font-bold text-lg text-gray-900">Pedido da Mesa {mesa?.numero}</h2>
                            <button 
                                onClick={() => setShowOrderSummary(false)} 
                                className="p-1 active:bg-gray-100 rounded-lg transition-colors"
                            >
                                <IoClose className="text-xl text-gray-500"/>
                            </button>
                        </div>
                        
                        {/* Lista de Itens com Scroll */}
                        <div className="px-4 py-3 space-y-3 overflow-y-auto max-h-[45vh]">
                            {resumoPedido.filter(item => item.cliente === clienteSelecionado).length === 0 ? (
                                <div className="text-center py-8">
                                    <IoCart className="text-3xl text-gray-300 mx-auto mb-2"/>
                                    <p className="text-gray-500 text-sm">Nenhum item para {clienteSelecionado}</p>
                                    <p className="text-gray-400 text-xs">Adicione itens ao pedir</p>
                                </div>
                            ) : (
                                resumoPedido.filter(item => item.cliente === clienteSelecionado).map((item, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm text-gray-900 truncate">{item.nome}</p>
                                            <p className="text-gray-500 text-xs">R$ {item.preco.toFixed(2)} cada</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2 bg-white rounded-lg px-2 py-1 border border-gray-200">
                                                <button 
                                                    onClick={() => ajustarQuantidade(item.id, item.cliente, item.quantidade - 1)}
                                                    className="text-red-500 active:text-red-600 p-1"
                                                >
                                                    <IoRemoveCircle className="text-base"/>
                                                </button>
                                                <span className="font-bold text-sm w-6 text-center">{item.quantidade}</span>
                                                <button 
                                                    onClick={() => ajustarQuantidade(item.id, item.cliente, item.quantidade + 1)}
                                                    className="text-green-500 active:text-green-600 p-1"
                                                >
                                                    <IoAddCircle className="text-base"/>
                                                </button>
                                            </div>
                                            <p className="font-bold text-sm w-16 text-right">R$ {(item.preco * item.quantidade).toFixed(2)}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        
                        {/* Footer Fixo */}
                        <div className="px-4 py-3 border-t border-gray-200 bg-white">
                            <div className="flex justify-between items-center mb-3">
                                <span className="font-semibold text-gray-900">Total</span>
                                <span className="font-bold text-xl text-gray-900">R$ {totalPedido.toFixed(2)}</span>
                            </div>
                            <button 
                                onClick={salvarAlteracoes} 
                                disabled={salvando}
                                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                            >
                                {salvando ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        <IoSave className="text-lg"/>
                                        Enviar para Cozinha
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* CSS para Safe Areas (iPhone) */}
            <style jsx>{`
                .safe-area-bottom {
                    padding-bottom: env(safe-area-inset-bottom);
                }
                .safe-area-top {
                    padding-top: env(safe-area-inset-top);
                }
                .safe-area-padding {
                    padding-left: env(safe-area-inset-left);
                    padding-right: env(safe-area-inset-right);
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slide-up 0.2s ease-out;
                }
            `}</style>
        </div>
    );
};

export default TelaPedidos;