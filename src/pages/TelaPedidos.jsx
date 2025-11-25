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
    writeBatch
} from 'firebase/firestore'; 
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { 
    IoArrowBack, IoCart, IoSearch, IoAdd,
    IoRemove, IoRestaurant, 
    IoCheckmark, IoClose, IoPerson,
    IoPencil, IoAddCircle, IoCheckmarkCircle, IoPersonAdd
} from 'react-icons/io5';

// --- COMPONENTE PRINCIPAL ---
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

    // COMANDA INDIVIDUAL
    const [ocupantes, setOcupantes] = useState(['Mesa']); 
    const [clienteSelecionado, setClienteSelecionado] = useState('Mesa');
    
    // Estados para edição de nome e feedback
    const [editandoNomeIndex, setEditandoNomeIndex] = useState(null);
    const [novoNomeTemp, setNovoNomeTemp] = useState('');
    const [mostrarDicaAdd, setMostrarDicaAdd] = useState(true);

    // --- NOVOS ESTADOS PARA O MODAL DE OPÇÕES ---
    const [produtoEmSelecao, setProdutoEmSelecao] = useState(null);
    const [opcaoSelecionada, setOpcaoSelecionada] = useState(null);
    const [observacaoItem, setObservacaoItem] = useState('');
// Em src/pages/TelaPedidos.jsx

const fetchData = useCallback(async () => {
    if (!estabelecimentoId) return;
    try {
        setLoading(true);
        
        // 1. Buscamos Mesa e Categorias em paralelo (primeiro nível de otimização)
        const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
        const categoriasRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio');
        
        const [mesaSnap, categoriasSnap] = await Promise.all([
            getDoc(mesaRef),
            getDocs(categoriasRef)
        ]);

        // Processar Mesa
        if (mesaSnap.exists()) {
            const mesaData = mesaSnap.data();
            setMesa(mesaData);
            setResumoPedido(mesaData.itens || []);
            if (mesaData.nomesOcupantes?.length > 0) {
                setOcupantes(mesaData.nomesOcupantes);
                const primeiroCliente = mesaData.nomesOcupantes.find(n => n !== 'Mesa');
                setClienteSelecionado(primeiroCliente || 'Mesa');
            }
        }

        // 2. Processar Categorias e preparar promessas de busca de itens
        let listaCategorias = ['Todos'];
        const categoriasAtivas = [];

        categoriasSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.ativo !== false) {
                const nome = data.nome || doc.id;
                listaCategorias.push(nome);
                categoriasAtivas.push({ id: doc.id, nome });
            }
        });

        // 3. O GRANDE TRUQUE: Disparar todas as buscas de itens AO MESMO TEMPO
        const promessasItens = categoriasAtivas.map(async (cat) => {
            const itensRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', cat.id, 'itens');
            const snapshot = await getDocs(itensRef);
            return snapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id,
                categoria: cat.nome
            }));
        });

        // Aguarda todas as buscas terminarem juntas
        const resultadosItens = await Promise.all(promessasItens);
        
        // "Achata" o array de arrays em um único array de produtos
        const todosProdutos = resultadosItens.flat();

        setCardapio(todosProdutos);
        setCategorias([...new Set(listaCategorias)]); // Remove duplicatas se houver

    } catch (error) { 
        console.error("Erro cardapio:", error);
        toast.error("Erro ao carregar cardápio"); 
    } finally { 
        setLoading(false); 
    }
}, [estabelecimentoId, mesaId]);
    useEffect(() => { 
        fetchData(); 
        const timer = setTimeout(() => setMostrarDicaAdd(false), 5000);
        return () => clearTimeout(timer);
    }, [fetchData]);

    // --- LÓGICA DE SELEÇÃO DE PRODUTO (MODAL) ---

    // Helper para identificar as opções independente do nome do campo no banco
    const getOpcoesProduto = (produto) => {
        if (!produto) return [];
        return produto.opcoes || produto.variacoes || produto.tamanhos || [];
    };

    const abrirModalOpcoes = (produto) => {
        setProdutoEmSelecao(produto);
        setObservacaoItem('');
        setOpcaoSelecionada(null);
        
        const opcoes = getOpcoesProduto(produto);

        // Se NÃO tiver opções, seleciona automaticamente o padrão para liberar o botão
        if (opcoes.length === 0) {
            setOpcaoSelecionada({ 
                nome: 'Padrão', 
                preco: parseFloat(produto.preco) 
            });
        }
    };

    const fecharModalOpcoes = () => {
        setProdutoEmSelecao(null);
        setOpcaoSelecionada(null);
        setObservacaoItem('');
    };

    const confirmarAdicaoAoCarrinho = () => {
        if (!produtoEmSelecao || !opcaoSelecionada) {
            toast.warning("Selecione uma opção!");
            return;
        }

        const precoFinal = parseFloat(opcaoSelecionada.preco);
        const opcoes = getOpcoesProduto(produtoEmSelecao);
        
        const nomeFinal = opcoes.length > 0 
            ? `${produtoEmSelecao.nome} - ${opcaoSelecionada.nome}`
            : produtoEmSelecao.nome;

        const idUnicoItem = `${produtoEmSelecao.id}_${opcaoSelecionada.nome.replace(/\s+/g, '')}`;

        const itemParaAdicionar = {
            ...produtoEmSelecao,
            id: idUnicoItem, 
            produtoIdOriginal: produtoEmSelecao.id, 
            nome: nomeFinal,
            preco: precoFinal,
            observacao: observacaoItem,
            quantidade: 1,
            cliente: clienteSelecionado,
            adicionadoEm: new Date(),
            status: 'pendente'
        };

        setResumoPedido(prev => {
            const itemExistente = prev.find(item => 
                item.id === idUnicoItem && 
                item.cliente === clienteSelecionado &&
                item.observacao === observacaoItem && 
                (item.status === 'pendente' || !item.status)
            ); 
            
            if (itemExistente) {
                return prev.map(item => 
                    (item === itemExistente) 
                        ? { ...item, quantidade: item.quantidade + 1 } 
                        : item
                );
            }
            
            return [...prev, itemParaAdicionar];
        });

        toast.success(`+1 ${nomeFinal}`, { autoClose: 1000, position: "bottom-center", hideProgressBar: true });
        fecharModalOpcoes();
    };

    // --- FUNÇÕES AUXILIARES ---
    const salvarNomePessoa = async (index, novoNome) => {
        if (!novoNome.trim()) return;
        const novosOcupantes = [...ocupantes];
        const nomeAntigo = novosOcupantes[index];
        novosOcupantes[index] = novoNome;
        setOcupantes(novosOcupantes);
        setEditandoNomeIndex(null);
        if (clienteSelecionado === nomeAntigo) setClienteSelecionado(novoNome);
        try {
            const novosItensCarrinho = resumoPedido.map(item => {
                if (item.cliente === nomeAntigo) return { ...item, cliente: novoNome };
                if (item.destinatario === nomeAntigo) return { ...item, destinatario: novoNome };
                if (item.clienteNome === nomeAntigo) return { ...item, clienteNome: novoNome };
                return item;
            });
            setResumoPedido(novosItensCarrinho);
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), {
                nomesOcupantes: novosOcupantes,
                itens: novosItensCarrinho,
                updatedAt: serverTimestamp()
            });
            if(nomeAntigo.startsWith("Pessoa")) {
                toast.success(`👋 Olá, ${novoNome}!`, { position: "top-center", autoClose: 2000 });
            } else {
                toast.success(`Renomeado para ${novoNome}`, { position: "bottom-center", autoClose: 1000 });
            }
        } catch(e) { 
            toast.error('Erro ao salvar nome', { position: "bottom-center" });
        }
    };

    const adicionarPessoaNova = () => {
        const n = `Pessoa ${ocupantes.length}`; 
        const novos = [...ocupantes, n];
        setOcupantes(novos);
        setClienteSelecionado(n);
        salvarNomePessoa(novos.length - 1, n);
        setMostrarDicaAdd(false);
    };

    const ajustarQuantidade = useCallback((produtoId, clienteDoItem, novaQuantidade) => {
        setResumoPedido(prev => {
            const itemAlvo = prev.find(item => item.id === produtoId && item.cliente === clienteDoItem);
            
            if (itemAlvo && (itemAlvo.status === 'enviado' || itemAlvo.status === 'entregue')) {
                toast.info("Item já enviado para cozinha", { position: "bottom-center" });
                return prev;
            }

            if (novaQuantidade < 1) {
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
                    total: totalGeral,
                    updatedAt: serverTimestamp()
                });
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
                itens: itensNovos.map(item => ({ 
                    ...item, 
                    status: 'recebido',
                    clienteNome: item.cliente || 'Mesa', 
                    destinatario: item.cliente || 'Mesa'
                })),
                status: 'recebido',
                total: itensNovos.reduce((acc, item) => acc + (item.preco * item.quantidade), 0),
                dataPedido: serverTimestamp(),
                source: 'salao',
                updatedAt: serverTimestamp()
            });

            const itensMesaAtualizados = resumoPedido.map(item => {
                if (item.status === 'pendente' || !item.status) {
                    return { 
                        ...item, 
                        status: 'enviado', 
                        pedidoCozinhaId: idPedidoCozinha,
                        clienteNome: item.cliente,
                        destinatario: item.cliente 
                    };
                }
                return item;
            });

            const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
            batch.update(mesaRef, {
                itens: itensMesaAtualizados,
                status: 'com_pedido',
                total: totalGeral,
                updatedAt: serverTimestamp()
            });

            await batch.commit();
            toast.success(`Pedido enviado! 🚀`, { position: "bottom-center" });
            setShowOrderSummary(false);
            setTimeout(() => navigate('/controle-salao'), 500);
            
        } catch (error) { 
            console.error(error);
            toast.error("Erro ao enviar pedido", { position: "bottom-center" }); 
        } finally { setSalvando(false); }
    };

    const produtosFiltrados = cardapio.filter(p => 
        (!termoBusca || p.nome.toLowerCase().includes(termoBusca.toLowerCase())) && 
        (categoriaAtiva === 'Todos' || p.categoria === categoriaAtiva)
    );

    const totalPedido = resumoPedido.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
    const totalItens = resumoPedido.reduce((acc, item) => acc + item.quantidade, 0);

    const itensAgrupados = useMemo(() => {
        return resumoPedido.reduce((acc, item) => {
            const nome = item.cliente || item.destinatario || 'Mesa';
            if (!acc[nome]) acc[nome] = [];
            acc[nome].push(item);
            return acc;
        }, {});
    }, [resumoPedido]);

    if (loading) {
        return (
            <div className="fixed inset-0 bg-gray-50 z-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto pb-24">
            {/* Header Fixo */}
            <header className="bg-white sticky top-0 z-40 shadow-sm border-b border-gray-100">
                <div className="px-4 py-3 flex items-center gap-3">
                    <button onClick={() => navigate('/controle-salao')} className="p-2 -ml-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors">
                        <IoArrowBack className="text-xl"/>
                    </button>
                    <div className="flex-1">
                        <h1 className="font-black text-lg text-gray-900 leading-none">Mesa {mesa?.numero}</h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Pedindo para: <span className="font-bold text-blue-600">{clienteSelecionado}</span>
                        </p>
                    </div>
                    
                    <button 
                        onClick={() => setShowOrderSummary(true)} 
                        className="relative bg-blue-600 text-white p-2.5 rounded-xl shadow-md active:scale-95 transition-all"
                    >
                        <IoCart className="text-xl"/>
                        {totalItens > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full border-2 border-white">
                                {totalItens}
                            </span>
                        )}
                    </button>
                </div>

                <div className="px-4 pb-1">
                    <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar py-2">
                        {ocupantes
                            .map((nome, originalIndex) => ({ nome, originalIndex }))
                            .filter(item => item.nome !== 'Mesa') 
                            .map(({ nome, originalIndex }) => (
                            <div key={originalIndex} className="relative flex-shrink-0">
                                {editandoNomeIndex === originalIndex ? (
                                    <div className="flex items-center bg-white border-2 border-blue-500 rounded-xl p-1 shadow-lg animate-in zoom-in duration-200">
                                        <input 
                                            autoFocus
                                            className="w-24 px-2 py-1.5 text-sm font-bold rounded border-none outline-none text-gray-800 bg-transparent"
                                            value={novoNomeTemp}
                                            onChange={(e) => setNovoNomeTemp(e.target.value)}
                                            onBlur={() => novoNomeTemp.trim() ? salvarNomePessoa(originalIndex, novoNomeTemp.trim()) : setEditandoNomeIndex(null)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && novoNomeTemp.trim()) salvarNomePessoa(originalIndex, novoNomeTemp.trim());
                                                if (e.key === 'Escape') setEditandoNomeIndex(null);
                                            }}
                                            maxLength={15}
                                        />
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setClienteSelecionado(nome)} 
                                        onDoubleClick={() => { 
                                            setEditandoNomeIndex(originalIndex);
                                            setNovoNomeTemp(nome);
                                        }}
                                        className={`
                                            group relative px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap border-2 transition-all duration-200 select-none
                                            ${clienteSelecionado === nome 
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105 z-10' 
                                                : 'bg-white text-gray-600 border-gray-100 hover:border-blue-200 hover:bg-gray-50'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center gap-2">
                                            <IoPerson className={clienteSelecionado === nome ? 'text-white' : 'text-gray-400'} />
                                            {nome}
                                        </div>
                                        {clienteSelecionado === nome && (
                                            <span className="absolute -top-1 -right-1 bg-white text-blue-600 rounded-full p-0.5 shadow-sm border border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <IoPencil className="text-[8px]" />
                                            </span>
                                        )}
                                    </button>
                                )}
                            </div>
                        ))}

                        <div className="relative flex-shrink-0">
                            <button 
                                onClick={adicionarPessoaNova}
                                className="w-11 h-11 rounded-xl bg-gray-50 border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 flex items-center justify-center transition-all active:scale-95"
                            >
                                <IoPersonAdd className="text-xl"/>
                            </button>

                            {mostrarDicaAdd && ocupantes.length <= 2 && (
                                <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded w-max animate-bounce z-20">
                                    Adicionar pessoa
                                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Busca e Filtros */}
                <div className="px-4 pb-3 border-t border-gray-50 pt-3 bg-white">
                    <div className="flex gap-2 mb-3">
                        <div className="flex-1 relative">
                            <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                            <input 
                                type="text" 
                                placeholder="Buscar no cardápio..." 
                                value={termoBusca} 
                                onChange={e => setTermoBusca(e.target.value)} 
                                className="w-full pl-9 pr-4 py-2.5 bg-gray-100 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                            />
                        </div>
                    </div>
                    
                    <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                        {categorias.map(cat => (
                            <button 
                                key={cat} 
                                onClick={() => setCategoriaAtiva(cat)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                                    categoriaAtiva === cat 
                                        ? 'bg-gray-900 text-white border-gray-900' 
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="p-4">
                {produtosFiltrados.length > 0 ? (
                    <div className="space-y-3">
                        {produtosFiltrados.map((produto, idx) => (
                            <div 
                                key={`${produto.id}-${idx}`} 
                                onClick={() => abrirModalOpcoes(produto)} 
                                className="bg-white p-3 rounded-xl border border-gray-200 flex gap-3 active:scale-[0.98] transition-transform cursor-pointer shadow-sm hover:shadow-md"
                            >
                                {produto.imageUrl ? (
                                    <img src={produto.imageUrl} className="w-20 h-20 rounded-lg object-cover bg-gray-100 flex-shrink-0" alt=""/>
                                ) : (
                                    <div className="w-20 h-20 rounded-lg bg-gray-50 flex items-center justify-center text-gray-300 flex-shrink-0">
                                        <IoRestaurant className="text-2xl"/>
                                    </div>
                                )}
                                
                                <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-sm leading-tight mb-1 truncate">{produto.nome}</h3>
                                        <p className="text-xs text-gray-500 line-clamp-2 leading-tight">{produto.descricao}</p>
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        <p className="text-blue-600 font-black text-sm">
                                            R$ {parseFloat(produto.preco || 0).toFixed(2)}
                                        </p>
                                        
                                        <button className="bg-blue-50 text-blue-600 p-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                                            <IoAddCircle className="text-xl"/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-gray-400">
                        <IoSearch className="text-4xl mx-auto mb-2 opacity-30"/>
                        <p>Nenhum produto encontrado</p>
                    </div>
                )}
            </main>

            {resumoPedido.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-8 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] z-40">
                    <div className="flex justify-between items-center max-w-4xl mx-auto">
                        <div>
                            <p className="text-xs text-gray-500 font-medium">Total do pedido</p>
                            <p className="text-2xl font-black text-gray-900">R$ {totalPedido.toFixed(2)}</p>
                        </div>
                        <button 
                            onClick={() => setShowOrderSummary(true)} 
                            className="bg-gray-900 text-white px-6 py-3.5 rounded-xl font-bold text-sm flex items-center gap-3 shadow-lg active:scale-95 transition-all"
                        >
                            <div className="flex items-center gap-2">
                                <IoCart className="text-lg"/>
                                Ver Pedido
                            </div>
                            <span className="bg-white/20 px-2 py-0.5 rounded-md text-xs">
                                {totalItens}
                            </span>
                        </button>
                    </div>
                </div>
            )}

            {/* --- MODAL DE OPÇÕES DO PRODUTO (CORRIGIDO) --- */}
            {produtoEmSelecao && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={fecharModalOpcoes}></div>
                    
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative z-10 animate-in zoom-in-95 duration-200">
                        
                        <div className="bg-amber-500 p-4 text-white relative">
                            <button onClick={fecharModalOpcoes} className="absolute top-4 right-4 text-white/80 hover:text-white">
                                <IoClose className="text-2xl" />
                            </button>
                            <h2 className="text-sm font-medium uppercase opacity-90">Escolha a opção</h2>
                            <h1 className="text-2xl font-black mt-1 leading-tight">{produtoEmSelecao.nome}</h1>
                        </div>

                        <div className="p-5 max-h-[60vh] overflow-y-auto">
                            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                                {produtoEmSelecao.descricao || "Sem descrição disponível."}
                            </p>

                            {/* AQUI ESTÁ A CORREÇÃO: PROCURA POR opcoes OU variacoes */}
                            {(() => {
                                const opcoesRender = getOpcoesProduto(produtoEmSelecao);
                                
                                if (opcoesRender.length > 0) {
                                    return (
                                        <div className="mb-6">
                                            <h3 className="font-bold text-gray-800 mb-3 text-sm">Selecione uma opção:</h3>
                                            <div className="space-y-2">
                                                {opcoesRender.map((opcao, idx) => (
                                                    <label 
                                                        key={idx} 
                                                        className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                                            opcaoSelecionada?.nome === opcao.nome 
                                                                ? 'border-amber-500 bg-amber-50' 
                                                                : 'border-gray-100 hover:border-gray-200'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                                                opcaoSelecionada?.nome === opcao.nome ? 'border-amber-500' : 'border-gray-300'
                                                            }`}>
                                                                {opcaoSelecionada?.nome === opcao.nome && (
                                                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                                                )}
                                                            </div>
                                                            <span className="font-medium text-gray-700">{opcao.nome}</span>
                                                        </div>
                                                        <span className="font-bold text-amber-600">
                                                            R$ {parseFloat(opcao.preco).toFixed(2)}
                                                        </span>
                                                        <input 
                                                            type="radio" 
                                                            name="opcaoProduto" 
                                                            className="hidden"
                                                            onChange={() => setOpcaoSelecionada({ nome: opcao.nome, preco: parseFloat(opcao.preco) })}
                                                            checked={opcaoSelecionada?.nome === opcao.nome}
                                                        />
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            <div>
                                <h3 className="font-bold text-gray-800 mb-2 text-sm text-amber-800">Observações</h3>
                                <textarea
                                    value={observacaoItem}
                                    onChange={(e) => setObservacaoItem(e.target.value)}
                                    placeholder="Ex: Sem cebola, ponto da carne, gelo e limão..."
                                    className="w-full p-3 bg-yellow-50/50 border border-yellow-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none text-sm min-h-[80px] text-gray-700 placeholder-gray-400"
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col gap-3">
                            <div className="flex justify-between items-center px-2">
                                <span className="text-gray-600 font-bold">Total:</span>
                                <span className="text-2xl font-black text-amber-600">
                                    R$ {opcaoSelecionada ? parseFloat(opcaoSelecionada.preco).toFixed(2) : parseFloat(produtoEmSelecao.preco || 0).toFixed(2)}
                                </span>
                            </div>
                            
                            <div className="flex gap-3 h-12">
                                <button 
                                    onClick={fecharModalOpcoes}
                                    className="flex-1 rounded-xl font-bold text-gray-500 bg-gray-200 hover:bg-gray-300 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={confirmarAdicaoAoCarrinho}
                                    disabled={getOpcoesProduto(produtoEmSelecao).length > 0 && !opcaoSelecionada}
                                    className={`flex-1 rounded-xl font-bold text-white transition-all ${
                                        (getOpcoesProduto(produtoEmSelecao).length > 0 && !opcaoSelecionada)
                                            ? 'bg-gray-300 cursor-not-allowed'
                                            : 'bg-green-500 hover:bg-green-600 shadow-lg shadow-green-200 active:scale-95'
                                    }`}
                                >
                                    Continuar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showOrderSummary && (
                <>
                    <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm transition-opacity" onClick={() => setShowOrderSummary(false)} />
                    <div className="fixed bottom-0 left-0 right-0 bg-white z-50 rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col animate-slide-up">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-3xl">
                            <div>
                                <h2 className="text-xl font-black text-gray-900">Resumo da Mesa</h2>
                                <p className="text-xs text-gray-500">Confira os itens de cada pessoa</p>
                            </div>
                            <button onClick={() => setShowOrderSummary(false)} className="bg-white p-2 rounded-full shadow-sm text-gray-500 hover:text-red-500 transition-colors">
                                <IoClose className="text-xl"/>
                            </button>
                        </div>

                        <div className="overflow-y-auto p-4 space-y-6 flex-1">
                            {Object.entries(itensAgrupados).map(([nomePessoa, itens]) => (
                                <div key={nomePessoa} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                                    <div className="bg-gray-900 text-white px-4 py-3">
                                        <h3 className="font-bold text-lg">{nomePessoa}</h3>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {itens.map((item, idx) => (
                                            <div key={idx} className="p-4">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex-1">
                                                        <p className="font-bold text-gray-900 text-base">
                                                            {item.quantidade}x {item.nome}
                                                        </p>
                                                        {item.observacao && (
                                                            <p className="text-xs text-amber-600 font-medium mt-0.5 bg-amber-50 inline-block px-1.5 py-0.5 rounded">
                                                                Obs: {item.observacao}
                                                            </p>
                                                        )}
                                                        <p className="text-sm text-gray-500 mt-1">
                                                            {item.status || 'enviado'}
                                                        </p>
                                                        <p className="text-sm text-gray-500">
                                                            R$ {item.preco.toFixed(2)} un
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-gray-900 text-lg">
                                                            R$ {(item.preco * item.quantidade).toFixed(2)}
                                                        </p>
                                                    </div>
                                                </div>
                                                {(item.status === 'pendente' || !item.status) && (
                                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                                                        <span className="text-sm text-gray-600">Ajustar quantidade:</span>
                                                        <div className="flex items-center gap-2">
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    ajustarQuantidade(item.id, item.cliente, item.quantidade - 1);
                                                                }}
                                                                className="w-8 h-8 flex items-center justify-center bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                                                            >
                                                                <IoRemove className="text-sm"/>
                                                            </button>
                                                            <span className="font-bold text-gray-900 w-6 text-center">{item.quantidade}</span>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    ajustarQuantidade(item.id, item.cliente, item.quantidade + 1);
                                                                }}
                                                                className="w-8 h-8 flex items-center justify-center bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                                                            >
                                                                <IoAdd className="text-sm"/>
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-gray-700">Subtotal {nomePessoa}:</span>
                                            <span className="font-black text-blue-600 text-lg">
                                                R$ {itens.reduce((sum, item) => sum + (item.preco * item.quantidade), 0).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-gray-900 text-white p-4">
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-bold">TOTAL GERAL</span>
                                <span className="text-2xl font-black">R$ {totalPedido.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-white safe-area-bottom">
                            <button 
                                onClick={salvarAlteracoes}
                                disabled={salvando}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-200 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                            >
                                {salvando ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        <IoCheckmarkCircle className="text-xl"/>
                                        Confirmar e Enviar Pedido
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </>
            )}
            <style jsx>{`
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
            `}</style>
        </div>
    );
};

export default TelaPedidos;