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
    IoRemove, IoRestaurant, IoCheckmark, IoClose, 
    IoPerson, IoPencil, IoAddCircle, IoCheckmarkCircle, 
    IoPersonAdd, IoPricetag
} from 'react-icons/io5';

// IMPORTS DOS MODAIS
import VariacoesModal from '../components/VariacoesModal';
import AdicionaisModal from '../components/AdicionaisModal';

// --- COMPONENTE AUXILIAR PARA RENDERIZAR PRODUTO ---
const CardapioItem = React.memo(({ produto, abrirModalOpcoes, cores }) => {
    const hasOpcoes = useMemo(() => {
        const opcoes = produto.opcoes || produto.variacoes || produto.tamanhos || [];
        return opcoes.length > 0;
    }, [produto]);

    const precoExibicao = useMemo(() => {
        return parseFloat(produto.preco || 0).toFixed(2);
    }, [produto.preco]);

    return (
        <div 
            onClick={() => abrirModalOpcoes(produto)} 
            className="bg-white p-3 rounded-xl border border-gray-200 flex gap-3 active:scale-[0.98] transition-transform cursor-pointer shadow-sm hover:shadow-md"
        >
            {produto.imageUrl ? (
                <img src={produto.imageUrl} className="w-20 h-20 rounded-lg object-cover bg-gray-100 flex-shrink-0" alt={produto.nome}/>
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
                    {/* Preço com a cor de destaque */}
                    <p className="font-black text-sm flex items-center gap-1" style={{ color: cores.destaque }}>
                        R$ {precoExibicao}
                        {!hasOpcoes && <IoPricetag className="text-xs opacity-60"/>}
                    </p>
                    
                    {/* Botão + com cor de destaque */}
                    <button 
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: cores.destaque, backgroundColor: `${cores.destaque}15` }}
                    >
                        <IoAddCircle className="text-xl"/>
                    </button>
                </div>
            </div>
        </div>
    );
});


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
    
    // Estados para edição de nome
    const [editandoNomeIndex, setEditandoNomeIndex] = useState(null);
    const [novoNomeTemp, setNovoNomeTemp] = useState('');
    const [mostrarDicaAdd, setMostrarDicaAdd] = useState(true);

    // --- NOVOS ESTADOS PARA O MODAL DE OPÇÕES ---
    const [produtoEmSelecao, setProdutoEmSelecao] = useState(null);
    
    // CORES
    const [coresEstabelecimento, setCoresEstabelecimento] = useState({
        primaria: '#111827', 
        destaque: '#059669', 
        background: '#f9fafb',
        texto: { principal: '#111827', secundario: '#6b7280' }
    });

    // 1. ESTADO PARA A ORDEM DAS CATEGORIAS
    const [ordemCategorias, setOrdemCategorias] = useState([]);

    const fetchData = useCallback(async () => {
        if (!estabelecimentoId) return;
        try {
            setLoading(true);
            
            const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
            const categoriasRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio');
            const estabRef = doc(db, 'estabelecimentos', estabelecimentoId);
            
            const [mesaSnap, categoriasSnap, estabSnap] = await Promise.all([
                getDoc(mesaRef),
                getDocs(categoriasRef),
                getDoc(estabRef)
            ]);

            // CARREGA AS CORES E A ORDEM DO BANCO
            if (estabSnap.exists()) {
                const dadosEstab = estabSnap.data();
                if (dadosEstab.cores) {
                    setCoresEstabelecimento({
                        primaria: dadosEstab.cores.primaria || '#111827',
                        destaque: dadosEstab.cores.destaque || '#059669',
                        background: dadosEstab.cores.background || '#f9fafb',
                        texto: dadosEstab.cores.texto || { principal: '#111827', secundario: '#6b7280' }
                    });
                }
                if (dadosEstab.ordemCategorias) {
                    setOrdemCategorias(dadosEstab.ordemCategorias);
                }
            }

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

            const promessasItens = categoriasAtivas.map(async (cat) => {
                const itensRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', cat.id, 'itens');
                const snapshot = await getDocs(itensRef);
                return snapshot.docs.map(doc => ({
                    ...doc.data(),
                    id: doc.id,
                    categoria: cat.nome
                }));
            });

            const resultadosItens = await Promise.all(promessasItens);
            const todosProdutos = resultadosItens.flat();

            setCardapio(todosProdutos);
            setCategorias([...new Set(listaCategorias)]);

        } catch (error) { 
            console.error("Erro:", error);
            toast.error("Erro ao carregar dados"); 
        } finally { 
            setLoading(false); 
        }
    }, [estabelecimentoId, mesaId]);

    useEffect(() => { 
        fetchData(); 
        const timer = setTimeout(() => setMostrarDicaAdd(false), 5000);
        return () => clearTimeout(timer);
    }, [fetchData]);

    // 2. ORDENAÇÃO DOS BOTÕES DE CATEGORIA
    const categoriasOrdenadas = useMemo(() => {
        return [...categorias].sort((a, b) => {
            if (a === 'Todos') return -1;
            if (b === 'Todos') return 1;
            if (!ordemCategorias || ordemCategorias.length === 0) return a.localeCompare(b);

            const indexA = ordemCategorias.indexOf(a);
            const indexB = ordemCategorias.indexOf(b);

            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [categorias, ordemCategorias]);

    // 3. ORDENAÇÃO E FILTRAGEM DOS PRODUTOS (AGORA RESPEITA A ORDEM DAS CATEGORIAS)
    const produtosFiltrados = useMemo(() => {
        // Primeiro filtra
        const filtrados = cardapio.filter(p => 
            (!termoBusca || p.nome.toLowerCase().includes(termoBusca.toLowerCase())) && 
            (categoriaAtiva === 'Todos' || p.categoria === categoriaAtiva)
        );

        // Depois ordena
        return filtrados.sort((a, b) => {
            // Se estamos vendo "Todos", a prioridade é a ordem da Categoria
            if (categoriaAtiva === 'Todos') {
                const indexA = ordemCategorias.indexOf(a.categoria);
                const indexB = ordemCategorias.indexOf(b.categoria);

                // Se categorias são diferentes, usa a ordem definida
                if (a.categoria !== b.categoria) {
                    if (indexA !== -1 && indexB !== -1) return indexA - indexB; // Ambos na lista
                    if (indexA !== -1) return -1; // Só A na lista
                    if (indexB !== -1) return 1;  // Só B na lista
                    // Nenhum na lista (alfabético da categoria)
                    return a.categoria.localeCompare(b.categoria);
                }
            }

            // Desempate (ou se for a mesma categoria): Ordem Alfabética do Produto
            return a.nome.localeCompare(b.nome);
        });
    }, [cardapio, termoBusca, categoriaAtiva, ordemCategorias]);

    // --- LÓGICA DE PRODUTOS ---
    const getOpcoesProduto = (produto) => {
        if (!produto) return [];
        return produto.opcoes || produto.variacoes || produto.tamanhos || [];
    };

    const abrirModalOpcoes = (produto) => {
        const opcoes = getOpcoesProduto(produto);
        if (opcoes.length === 0) {
            const itemConfigurado = { ...produto, precoFinal: parseFloat(produto.preco), quantidade: 1 };
            confirmarAdicaoAoCarrinho(itemConfigurado);
        } else {
            setProdutoEmSelecao(produto);
        }
    };

    const fecharModalOpcoes = () => setProdutoEmSelecao(null);

    const confirmarAdicaoAoCarrinho = (itemConfigurado) => {
        const { nome, variacaoSelecionada, observacao, precoFinal } = itemConfigurado;
        let nomeFinal = nome;
        if (variacaoSelecionada) nomeFinal = `${nome} - ${variacaoSelecionada.nome}`;

        const idUnicoItem = `${itemConfigurado.id}_${variacaoSelecionada ? variacaoSelecionada.nome : 'padrao'}_${(observacao || '').replace(/\s+/g, '')}`;

        const itemParaAdicionar = {
            ...itemConfigurado,
            id: idUnicoItem, 
            produtoIdOriginal: itemConfigurado.id, 
            nome: nomeFinal,
            preco: precoFinal,
            observacao: observacao || '',
            quantidade: 1,
            cliente: clienteSelecionado,
            adicionadoEm: new Date(),
            status: 'pendente'
        };

        setResumoPedido(prev => {
            const itemExistente = prev.find(item => 
                item.id === idUnicoItem && item.cliente === clienteSelecionado &&
                item.observacao === (observacao || '') && (item.status === 'pendente' || !item.status)
            ); 
            
            if (itemExistente) {
                return prev.map(item => (item === itemExistente) ? { ...item, quantidade: item.quantidade + 1 } : item);
            }
            return [...prev, itemParaAdicionar];
        });

        toast.success(`+1 ${nomeFinal}`, { autoClose: 1000, position: "bottom-center", hideProgressBar: true });
        fecharModalOpcoes();
    };

    // --- AUXILIARES ---
    const iniciarEdicaoNome = (nome, index) => {
        setClienteSelecionado(nome);
        setEditandoNomeIndex(index);
        setNovoNomeTemp(nome);
    };

    const salvarNomePessoa = async (index, novoNome) => {
        if (!novoNome.trim()) { setEditandoNomeIndex(null); return; }
        const novosOcupantes = [...ocupantes];
        const nomeAntigo = novosOcupantes[index];
        novosOcupantes[index] = novoNome;
        setOcupantes(novosOcupantes);
        setEditandoNomeIndex(null);
        if (clienteSelecionado === nomeAntigo) setClienteSelecionado(novoNome);
        try {
            const novosItens = resumoPedido.map(item => {
                if (item.cliente === nomeAntigo) return { ...item, cliente: novoNome };
                if (item.destinatario === nomeAntigo) return { ...item, destinatario: novoNome };
                if (item.clienteNome === nomeAntigo) return { ...item, clienteNome: novoNome };
                return item;
            });
            setResumoPedido(novosItens);
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), {
                nomesOcupantes: novosOcupantes, itens: novosItens, updatedAt: serverTimestamp()
            });
        } catch(e) { toast.error('Erro ao salvar nome'); }
    };

    const adicionarPessoaNova = () => {
        const n = `Pessoa ${ocupantes.length}`; 
        const novos = [...ocupantes, n];
        setOcupantes(novos);
        iniciarEdicaoNome(n, novos.length - 1); 
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
            return prev.map(item => (item.id === produtoId && item.cliente === clienteDoItem) ? { ...item, quantidade: novaQuantidade } : item);
        });
    }, []);

    const salvarAlteracoes = async () => {
        setSalvando(true);
        try {
            const itensNovos = resumoPedido.filter(item => item.status === 'pendente' || !item.status);
            const totalGeral = resumoPedido.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);

            if (itensNovos.length === 0) {
                await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), {
                    itens: resumoPedido, total: totalGeral, updatedAt: serverTimestamp()
                });
                navigate('/controle-salao');
                return;
            }

            const batch = writeBatch(db);
            const timestampAtual = Date.now();
            const idPedidoCozinha = `pedido_${mesaId}_${timestampAtual}`;
            const pedidoRef = doc(db, 'estabelecimentos', estabelecimentoId, 'pedidos', idPedidoCozinha);

            batch.set(pedidoRef, {
                id: idPedidoCozinha, mesaId: mesaId, mesaNumero: mesa?.numero,
                itens: itensNovos.map(item => ({ ...item, status: 'recebido', clienteNome: item.cliente || 'Mesa', destinatario: item.cliente || 'Mesa' })),
                status: 'recebido', total: itensNovos.reduce((acc, item) => acc + (item.preco * item.quantidade), 0),
                dataPedido: serverTimestamp(), source: 'salao', updatedAt: serverTimestamp()
            });

            const itensMesaAtualizados = resumoPedido.map(item => {
                if (item.status === 'pendente' || !item.status) {
                    return { ...item, status: 'enviado', pedidoCozinhaId: idPedidoCozinha, clienteNome: item.cliente, destinatario: item.cliente };
                }
                return item;
            });

            const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
            batch.update(mesaRef, { itens: itensMesaAtualizados, status: 'com_pedido', total: totalGeral, updatedAt: serverTimestamp() });

            await batch.commit();
            toast.success(`Pedido enviado! 🚀`, { position: "bottom-center" });
            setShowOrderSummary(false);
            setTimeout(() => navigate('/controle-salao'), 500);
        } catch (error) { toast.error("Erro ao enviar pedido"); } 
        finally { setSalvando(false); }
    };

    const totalPedido = resumoPedido.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
    const totalItens = resumoPedido.reduce((acc, item) => acc + item.quantidade, 0);

    const itensAgrupados = useMemo(() => {
        if (!Array.isArray(resumoPedido) || resumoPedido.length === 0) return {};
        return resumoPedido.reduce((acc, item) => {
            const nome = item.cliente || item.destinatario || 'Mesa';
            if (!acc[nome]) acc[nome] = [];
            acc[nome].push(item);
            return acc;
        }, {});
    }, [resumoPedido]);

    if (loading) return <div className="fixed inset-0 bg-gray-50 flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;

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
                            Cliente: <span className="font-bold" style={{ color: coresEstabelecimento.destaque }}>{clienteSelecionado}</span>
                        </p>
                    </div>
                    
                    {/* Botão Carrinho */}
                    <button 
                        onClick={() => setShowOrderSummary(true)} 
                        className="relative text-white p-2.5 rounded-xl shadow-md active:scale-95 transition-all"
                        style={{ backgroundColor: coresEstabelecimento.destaque }}
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
                    {/* Lista de Pessoas */}
                    <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar py-2">
                        {ocupantes
                            .map((nome, originalIndex) => ({ nome, originalIndex }))
                            .filter(item => item.nome !== 'Mesa') 
                            .map(({ nome, originalIndex }) => (
                            <div key={originalIndex} className="relative flex-shrink-0">
                                {editandoNomeIndex === originalIndex ? (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
                                        <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm animate-in zoom-in duration-200">
                                            <h3 className="font-bold text-lg text-gray-900 mb-4">Renomear Cliente</h3>
                                            <input 
                                                autoFocus
                                                className="w-full px-3 py-2.5 text-base font-bold rounded-xl border border-gray-300 outline-none text-gray-800 focus:ring-2"
                                                style={{ borderColor: coresEstabelecimento.destaque, '--tw-ring-color': coresEstabelecimento.destaque }}
                                                value={novoNomeTemp}
                                                onChange={(e) => setNovoNomeTemp(e.target.value)}
                                                onBlur={() => novoNomeTemp.trim() ? salvarNomePessoa(originalIndex, novoNomeTemp.trim()) : setEditandoNomeIndex(null)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && novoNomeTemp.trim()) salvarNomePessoa(originalIndex, novoNomeTemp.trim());
                                                    if (e.key === 'Escape') setEditandoNomeIndex(null);
                                                }}
                                                maxLength={15}
                                            />
                                            <div className="flex gap-3 mt-4">
                                                <button onClick={() => setEditandoNomeIndex(null)} className="flex-1 py-2 rounded-xl bg-gray-200 text-gray-700 font-bold hover:bg-gray-300">Cancelar</button>
                                                <button onClick={() => novoNomeTemp.trim() ? salvarNomePessoa(originalIndex, novoNomeTemp.trim()) : setEditandoNomeIndex(null)} className="flex-1 py-2 rounded-xl text-white font-bold" style={{ backgroundColor: coresEstabelecimento.destaque }}>Salvar</button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => iniciarEdicaoNome(nome, originalIndex)}
                                        className={`group relative px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap border-2 transition-all duration-200 select-none ${clienteSelecionado === nome ? 'text-white shadow-md transform scale-105 z-10' : 'bg-white text-gray-600 border-gray-100 hover:bg-gray-50'}`}
                                        style={clienteSelecionado === nome ? { backgroundColor: coresEstabelecimento.destaque, borderColor: coresEstabelecimento.destaque } : {}}
                                    >
                                        <div className="flex items-center gap-2">
                                            <IoPerson className={clienteSelecionado === nome ? 'text-white' : 'text-gray-400'} />
                                            {nome}
                                        </div>
                                        {clienteSelecionado === nome && (
                                            <span className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-gray-100" style={{ color: coresEstabelecimento.destaque }}>
                                                <IoPencil className="text-[8px]" />
                                            </span>
                                        )}
                                    </button>
                                )}
                            </div>
                        ))}

                        <div className="relative flex-shrink-0">
                            <button onClick={adicionarPessoaNova} className="w-11 h-11 rounded-xl bg-gray-50 border-2 border-dashed border-gray-300 text-gray-400 hover:text-white flex items-center justify-center transition-all active:scale-95" style={{ '--hover-color': coresEstabelecimento.destaque }} onMouseEnter={(e) => {e.currentTarget.style.borderColor=coresEstabelecimento.destaque; e.currentTarget.style.backgroundColor=coresEstabelecimento.destaque}} onMouseLeave={(e) => {e.currentTarget.style.borderColor='#D1D5DB'; e.currentTarget.style.backgroundColor='#F9FAFB'}}>
                                <IoPersonAdd className="text-xl"/>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filtros de Categoria (ORDENADOS) */}
                <div className="px-4 pb-3 border-t border-gray-50 pt-3 bg-white">
                    <div className="flex gap-2 mb-3">
                        <div className="flex-1 relative">
                            <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                            <input 
                                type="text" 
                                placeholder="Buscar no cardápio..." 
                                value={termoBusca} 
                                onChange={e => setTermoBusca(e.target.value)} 
                                className="w-full pl-9 pr-4 py-2.5 bg-gray-100 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:border-transparent text-sm transition-all"
                                style={{ '--tw-ring-color': coresEstabelecimento.destaque }}
                            />
                        </div>
                    </div>
                    
                    <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                        {categoriasOrdenadas.map(cat => (
                            <button 
                                key={cat} 
                                onClick={() => setCategoriaAtiva(cat)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${categoriaAtiva === cat ? 'text-white' : 'bg-white text-gray-600 border-gray-200'}`}
                                style={categoriaAtiva === cat ? { backgroundColor: coresEstabelecimento.primaria, borderColor: coresEstabelecimento.primaria } : {}}
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
                        {/* AQUI ESTÁ A LISTA DE PRODUTOS JÁ ORDENADA PELO USEMEMO */}
                        {produtosFiltrados.map((produto, idx) => (
                            <CardapioItem 
                                key={`${produto.id}-${idx}`} 
                                produto={produto} 
                                abrirModalOpcoes={abrirModalOpcoes}
                                cores={coresEstabelecimento}
                            />
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
                            className="text-white px-6 py-3.5 rounded-xl font-bold text-sm flex items-center gap-3 shadow-lg active:scale-95 transition-all"
                            style={{ backgroundColor: coresEstabelecimento.destaque }}
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

            {produtoEmSelecao && (
                <VariacoesModal
                    item={produtoEmSelecao}
                    onConfirm={confirmarAdicaoAoCarrinho}
                    onClose={fecharModalOpcoes}
                    coresEstabelecimento={coresEstabelecimento}
                />
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
                                    <div className="text-white px-4 py-3" style={{ backgroundColor: coresEstabelecimento.primaria }}>
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
                                                            <p className="text-xs font-medium mt-0.5 bg-gray-100 inline-block px-1.5 py-0.5 rounded" style={{ color: coresEstabelecimento.destaque }}>
                                                                Obs: {item.observacao}
                                                            </p>
                                                        )}
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            Status: <span className="capitalize">{item.status || 'pendente'}</span> 
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
                                                                onClick={(e) => { e.stopPropagation(); ajustarQuantidade(item.id, item.cliente, item.quantidade - 1); }}
                                                                className="w-8 h-8 flex items-center justify-center bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                                                            >
                                                                <IoRemove className="text-sm"/>
                                                            </button>
                                                            <span className="font-bold text-gray-900 w-6 text-center">{item.quantidade}</span>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); ajustarQuantidade(item.id, item.cliente, item.quantidade + 1); }}
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
                                            <span className="font-black text-lg" style={{ color: coresEstabelecimento.destaque }}>
                                                R$ {itens.reduce((sum, item) => sum + (item.preco * item.quantidade), 0).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="text-white p-4" style={{ backgroundColor: coresEstabelecimento.primaria }}>
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-bold">TOTAL GERAL</span>
                                <span className="text-2xl font-black">R$ {totalPedido.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-white safe-area-bottom">
                            <button 
                                onClick={salvarAlteracoes}
                                disabled={salvando}
                                className="w-full text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                                style={{ backgroundColor: coresEstabelecimento.destaque, boxShadow: `0 10px 15px -3px ${coresEstabelecimento.destaque}40` }}
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
            <style>{`
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