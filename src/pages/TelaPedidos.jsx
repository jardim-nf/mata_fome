import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import {
    getDocs, doc, getDoc, updateDoc, collection, serverTimestamp, writeBatch, onSnapshot, increment
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import {
    IoArrowBack, IoCart, IoSearch, IoAdd,
    IoRemove, IoRestaurant, IoClose,
    IoPerson, IoPencil, IoAddCircle, IoCheckmarkCircle,
    IoPersonAdd, IoTrash, IoCheckmarkDoneCircle
} from 'react-icons/io5';

// IMPORTS DOS MODAIS
import VariacoesModal from '../components/VariacoesModal';

// --- COMPONENTE ITEM DO CARDÁPIO ---
const CardapioItem = React.memo(({ produto, abrirModalOpcoes, cores }) => {
    const hasOpcoes = useMemo(() => {
        const opcoes = produto.opcoes || produto.variacoes || produto.tamanhos || [];
        return opcoes.length > 0;
    }, [produto]);

    const precoExibicao = parseFloat(produto.preco || 0).toFixed(2);

    return (
        <div
            onClick={() => abrirModalOpcoes(produto)}
            className="bg-white p-3 rounded-2xl border border-gray-100 flex gap-4 active:scale-[0.98] transition-all cursor-pointer shadow-sm hover:shadow-md group"
        >
            <div className="relative flex-shrink-0">
                {produto.imageUrl ? (
                    <img src={produto.imageUrl} className="w-24 h-24 rounded-xl object-cover bg-gray-50" alt={produto.nome} />
                ) : (
                    <div className="w-24 h-24 rounded-xl bg-gray-50 flex items-center justify-center text-gray-300">
                        <IoRestaurant className="text-3xl opacity-50" />
                    </div>
                )}
                <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-1 shadow-sm">
                    <IoAddCircle className="text-3xl transition-transform group-hover:scale-110" style={{ color: cores.destaque }} />
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-center min-w-0 py-1">
                <h3 className="font-bold text-gray-900 text-base leading-tight mb-1 truncate">{produto.nome}</h3>
                <p className="text-xs text-gray-500 line-clamp-2 mb-2 leading-relaxed">{produto.descricao || 'Sem descrição'}</p>
                <div className="flex items-center gap-2">
                    <span className="font-black text-sm" style={{ color: cores.destaque }}>R$ {precoExibicao}</span>
                    {hasOpcoes && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Opções</span>}
                </div>
            </div>
        </div>
    );
});

// --- TELA PEDIDOS PRINCIPAL ---
const TelaPedidos = () => {
    const { id: mesaId, estabelecimentoId: urlEstabelecimentoId } = useParams();
    const { estabelecimentoIdPrincipal } = useAuth();
    const navigate = useNavigate();
    
    // 🔥 IMPORTANTE: Trazendo userData para pegar o 'nome' do banco
    const { user, userData } = useAuth(); 
    
    const estabelecimentoId = estabelecimentoIdPrincipal || urlEstabelecimentoId;

    // Estados de Dados
    const [mesa, setMesa] = useState(null);
    const [cardapio, setCardapio] = useState([]);
    const [categorias, setCategorias] = useState(['Todos']);
    const [resumoPedido, setResumoPedido] = useState([]);
    const [loading, setLoading] = useState(true);

    // UI e Filtros
    const [termoBusca, setTermoBusca] = useState('');
    const [categoriaAtiva, setCategoriaAtiva] = useState('Todos');
    const [salvando, setSalvando] = useState(false);
    const [showOrderSummary, setShowOrderSummary] = useState(false);

    // Gestão de Pessoas
    const [ocupantes, setOcupantes] = useState(['Mesa']);
    const [clienteSelecionado, setClienteSelecionado] = useState('Mesa');

    // Estados para Edição/Adição de Nome
    const [isAddingPerson, setIsAddingPerson] = useState(false);
    const [editandoNomeIndex, setEditandoNomeIndex] = useState(null);
    const [novoNomeTemp, setNovoNomeTemp] = useState('');

    // Modais e Configurações
    const [produtoEmSelecao, setProdutoEmSelecao] = useState(null);
    const [modalSenhaAberto, setModalSenhaAberto] = useState(false);
    const [itemParaExcluir, setItemParaExcluir] = useState(null);
    const [senhaDigitada, setSenhaDigitada] = useState('');

    const [coresEstabelecimento, setCoresEstabelecimento] = useState({
        primaria: '#111827', destaque: '#059669', background: '#f9fafb', texto: { principal: '#111827' }
    });
    const [ordemCategorias, setOrdemCategorias] = useState([]);
    const [senhaMasterEstabelecimento, setSenhaMasterEstabelecimento] = useState('');

    // --- CARREGAMENTO INICIAL (Config e Cardápio) ---
    useEffect(() => {
        if (!estabelecimentoId) return;

        const carregarConfigECardapio = async () => {
            try {
                // Carrega configs do estabelecimento
                const estabRef = doc(db, 'estabelecimentos', estabelecimentoId);
                const estabSnap = await getDoc(estabRef);
                if (estabSnap.exists()) {
                    const dados = estabSnap.data();
                    if (dados.cores) setCoresEstabelecimento(prev => ({ ...prev, ...dados.cores }));
                    if (dados.ordemCategorias) setOrdemCategorias(dados.ordemCategorias);
                    if (dados.senhaMaster) setSenhaMasterEstabelecimento(String(dados.senhaMaster));
                }

                // Carrega Cardápio
                const categoriasRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio');
                const categoriasSnap = await getDocs(categoriasRef);

                let listaCats = ['Todos'];
                const catsAtivas = [];
                categoriasSnap.docs.forEach(doc => {
                    if (doc.data().ativo !== false) {
                        const nome = doc.data().nome || doc.id;
                        listaCats.push(nome);
                        catsAtivas.push({ id: doc.id, nome });
                    }
                });

                const itensPromises = catsAtivas.map(async (cat) => {
                    const snap = await getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', cat.id, 'itens'));
                    return snap.docs.map(d => ({ ...d.data(), id: d.id, categoria: cat.nome, categoriaId: cat.id }));
                });

                const itens = (await Promise.all(itensPromises)).flat();
                setCardapio(itens);
                setCategorias([...new Set(listaCats)]);

            } catch (error) {
                console.error("Erro ao carregar cardápio:", error);
            }
        };

        carregarConfigECardapio();
    }, [estabelecimentoId]);

    // --- REALTIME LISTENER DA MESA ---
    useEffect(() => {
        if (!estabelecimentoId || !mesaId) return;

        setLoading(true);
        const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);

        const unsubscribe = onSnapshot(mesaRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setMesa({ id: docSnap.id, ...data });

                if (data.itens) setResumoPedido(data.itens);

                if (data.nomesOcupantes?.length > 0) {
                    setOcupantes(data.nomesOcupantes);
                    setClienteSelecionado(prev => {
                        return data.nomesOcupantes.includes(prev) ? prev : (data.nomesOcupantes[0] || 'Mesa');
                    });
                } else {
                    setOcupantes(['Mesa']);
                }
            } else {
                toast.error("Mesa não encontrada!");
                navigate('/controle-salao');
            }
            setLoading(false);
        }, (error) => {
            console.error("Erro realtime mesa:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [estabelecimentoId, mesaId, navigate]);


    // --- FILTROS E ORDENAÇÃO ---
    const categoriasOrdenadas = useMemo(() => {
        return [...categorias].sort((a, b) => {
            if (a === 'Todos') return -1;
            if (b === 'Todos') return 1;
            if (!ordemCategorias.length) return a.localeCompare(b);
            const idxA = ordemCategorias.indexOf(a), idxB = ordemCategorias.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b);
        });
    }, [categorias, ordemCategorias]);

    const produtosFiltrados = useMemo(() => {
        return cardapio.filter(p =>
            (!termoBusca || p.nome.toLowerCase().includes(termoBusca.toLowerCase())) &&
            (categoriaAtiva === 'Todos' || p.categoria === categoriaAtiva)
        );
    }, [cardapio, termoBusca, categoriaAtiva]);

    // --- FUNÇÃO ADICIONAR (SALVA NOME DO GARÇOM) ---
    const confirmarAdicaoAoCarrinho = async (itemConfig) => {
        const { nome, variacaoSelecionada, observacao, precoFinal } = itemConfig;
        const nomeFinal = variacaoSelecionada ? `${nome} - ${variacaoSelecionada.nome}` : nome;

        // 🔥 AQUI ESTÁ A MÁGICA: Pega o nome do cadastro (userData.nome)
        const nomeGarcom = userData?.nome || user?.displayName || "Garçom";

        const novaLista = [...resumoPedido];
        const indexExistente = novaLista.findIndex(i => 
            i.produtoIdOriginal === itemConfig.id && 
            i.nome === nomeFinal &&
            i.observacao === (observacao || '') &&
            i.cliente === clienteSelecionado &&
            (!i.status || i.status === 'pendente')
        );

        if (indexExistente >= 0) {
            novaLista[indexExistente].quantidade += 1;
            // Atualiza quem mexeu por último
            novaLista[indexExistente].adicionadoPor = nomeGarcom;
            toast.success(`+1 ${nomeFinal}`);
        } else {
            const novoItem = {
                ...itemConfig,
                id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, 
                produtoIdOriginal: itemConfig.id, 
                nome: nomeFinal, 
                preco: precoFinal,
                observacao: observacao || '', 
                quantidade: 1, 
                cliente: clienteSelecionado,
                adicionadoEm: new Date(), 
                status: 'pendente',
                // Salva o nome real
                adicionadoPor: nomeGarcom 
            };
            novaLista.push(novoItem);
            toast.success(`${nomeFinal} adicionado!`);
        }

        setResumoPedido(novaLista);
        setProdutoEmSelecao(null);

        try {
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), { 
                itens: novaLista,
                total: novaLista.reduce((acc, i) => acc + (i.preco * i.quantidade), 0),
                updatedAt: serverTimestamp()
            });
        } catch(e) { console.error(e); }
    };

    // --- FUNÇÕES DE PESSOAS ---
    const iniciarAdicaoPessoa = () => {
        setIsAddingPerson(true);
        setNovoNomeTemp('');
    };

    const confirmarNovaPessoa = async () => {
        if (!novoNomeTemp.trim()) {
            setIsAddingPerson(false);
            return;
        }

        const novoNome = novoNomeTemp.trim();
        if (ocupantes.includes(novoNome)) {
            toast.warning("Esse nome já existe!");
            return;
        }

        const novosOcupantes = [...ocupantes, novoNome];

        setOcupantes(novosOcupantes);
        setClienteSelecionado(novoNome);
        setIsAddingPerson(false);
        setNovoNomeTemp('');

        try {
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), {
                nomesOcupantes: novosOcupantes,
                updatedAt: serverTimestamp()
            });
        } catch (e) {
            console.error(e);
            toast.error("Erro ao salvar pessoa");
        }
    };

    const iniciarEdicaoPessoa = (index, nomeAtual) => {
        setEditandoNomeIndex(index);
        setNovoNomeTemp(nomeAtual);
    };

    const salvarEdicaoPessoa = async (index) => {
        if (editandoNomeIndex === null) return;

        if (!novoNomeTemp.trim()) {
            setEditandoNomeIndex(null);
            return;
        }

        const nomeAntigo = ocupantes[index];
        const novoNome = novoNomeTemp.trim();

        if (nomeAntigo === novoNome) {
            setEditandoNomeIndex(null);
            return;
        }

        const novosOcupantes = [...ocupantes];
        novosOcupantes[index] = novoNome;

        setOcupantes(novosOcupantes);
        setEditandoNomeIndex(null);

        if (clienteSelecionado === nomeAntigo) setClienteSelecionado(novoNome);

        const novosItens = resumoPedido.map(i => (i.cliente === nomeAntigo ? { ...i, cliente: novoNome } : i));
        setResumoPedido(novosItens);

        try {
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), {
                nomesOcupantes: novosOcupantes,
                itens: novosItens,
                updatedAt: serverTimestamp()
            });
        } catch (e) {
            console.error(e);
            toast.error("Erro ao atualizar nome");
        }
    };

    // --- FUNÇÃO SALVAR E BAIXAR ESTOQUE ---
    const salvarAlteracoes = async () => {
        setSalvando(true);
        try {
            const novos = resumoPedido.filter(i => !i.status || i.status === 'pendente');
            const total = resumoPedido.reduce((acc, i) => acc + (i.preco * i.quantidade), 0);
            const batch = writeBatch(db);
            const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);

            const promessasDeLeitura = novos.map(async (item) => {
                if (!item.categoriaId || !item.produtoIdOriginal) return null;
                const itemRef = doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', item.categoriaId, 'itens', item.produtoIdOriginal);
                const itemSnap = await getDoc(itemRef);
                return { item, itemRef, itemSnap };
            });

            const resultados = await Promise.all(promessasDeLeitura);

            resultados.forEach((res) => {
                if (!res || !res.itemSnap.exists()) return;
                const data = res.itemSnap.data();
                const itemVendido = res.item;
                const ref = res.itemRef;

                if (itemVendido.variacaoSelecionada && data.variacoes && Array.isArray(data.variacoes)) {
                    const novasVariacoes = data.variacoes.map(v => {
                        const ehEssa = (v.id && v.id === itemVendido.variacaoSelecionada.id) || 
                                       (v.nome === itemVendido.variacaoSelecionada.nome);
                        if (ehEssa) {
                            const estoqueAtual = Number(v.estoque) || 0;
                            return { ...v, estoque: estoqueAtual - itemVendido.quantidade };
                        }
                        return v;
                    });
                    const novoTotalEstoque = novasVariacoes.reduce((acc, v) => acc + (Number(v.estoque) || 0), 0);
                    batch.update(ref, { variacoes: novasVariacoes, estoque: novoTotalEstoque });
                } else {
                    batch.update(ref, { estoque: increment(-itemVendido.quantidade) });
                }
            });

            if (novos.length > 0) {
                const idPedido = `pedido_${mesaId}_${Date.now()}`;
                
                const isBebida = (cat) => {
                    const c = (cat || '').toLowerCase();
                    return c.includes('bebida') || c.includes('drink') || c.includes('suco') || 
                           c.includes('refrigerante') || c.includes('água') || c.includes('agua') || 
                           c.includes('cerveja') || c.includes('dose') || c.includes('vinho') || c.includes('bar');
                };

                const itensParaCozinha = novos.filter(i => !isBebida(i.categoria));

                if (itensParaCozinha.length > 0) {
                    const pedidoRef = doc(db, 'estabelecimentos', estabelecimentoId, 'pedidos', idPedido);
                    batch.set(pedidoRef, {
                        id: idPedido, mesaId, mesaNumero: mesa?.numero,
                        itens: itensParaCozinha.map(i => ({ ...i, status: 'recebido' })),
                        status: 'recebido', 
                        total: itensParaCozinha.reduce((a,i) => a + (i.preco * i.quantidade), 0),
                        dataPedido: serverTimestamp(), source: 'salao'
                    });
                }

                const itensAtualizados = resumoPedido.map(i => {
                    if (!i.status || i.status === 'pendente') {
                        return { 
                            ...i, 
                            status: 'enviado', 
                            pedidoCozinhaId: itensParaCozinha.length > 0 ? idPedido : null 
                        };
                    }
                    return i;
                });

                batch.update(mesaRef, { itens: itensAtualizados, status: 'com_pedido', total, updatedAt: serverTimestamp() });
            } else {
                batch.update(mesaRef, { itens: resumoPedido, total, updatedAt: serverTimestamp() });
            }

            await batch.commit();
            
            setCardapio(prev => prev.map(prod => {
                const itemVendido = novos.find(i => i.produtoIdOriginal === prod.id);
                if (itemVendido) {
                     return { ...prod, estoque: (Number(prod.estoque) || 0) - itemVendido.quantidade };
                }
                return prod;
            }));

            toast.success("Pedido enviado e estoque atualizado!");
            setShowOrderSummary(false);
            navigate('/controle-salao');
        } catch (e) { 
            console.error(e);
            toast.error("Erro ao salvar: " + e.message); 
        } finally { 
            setSalvando(false); 
        }
    };

    const confirmarExclusao = async () => {
        if (senhaMasterEstabelecimento && senhaDigitada !== senhaMasterEstabelecimento) return toast.error("Senha incorreta");
        if (!itemParaExcluir) return;

        const novaLista = resumoPedido.filter(i => i !== itemParaExcluir);
        const novoTotal = novaLista.reduce((acc, i) => acc + (i.preco * i.quantidade), 0);

        try {
            const batch = writeBatch(db);
            batch.update(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), { itens: novaLista, total: novoTotal });
            await batch.commit();

            setModalSenhaAberto(false);
            setItemParaExcluir(null);
            toast.success("Item removido.");
        } catch (e) { toast.error("Erro ao excluir"); }
    };

    const ajustarQuantidade = async (id, cliente, qtd) => {
        const novaLista = resumoPedido.map(i => {
            if (i.id === id) {
                return { ...i, quantidade: qtd };
            }
            return i;
        }).filter(i => i.quantidade > 0);

        setResumoPedido(novaLista);

        try {
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), { 
                itens: novaLista,
                total: novaLista.reduce((acc, i) => acc + (i.preco * i.quantidade), 0)
            });
        } catch (e) { console.error(e); }
    };

    const itensAgrupados = useMemo(() => {
        return resumoPedido.reduce((acc, item) => {
            const k = item.cliente || 'Mesa';
            if (!acc[k]) acc[k] = []; acc[k].push(item); return acc;
        }, {});
    }, [resumoPedido]);

    const totalGeral = resumoPedido.reduce((acc, i) => acc + (i.preco * i.quantidade), 0);
    const totalItens = resumoPedido.reduce((acc, i) => acc + i.quantidade, 0);

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>;

    return (
        <div className="fixed inset-0 bg-gray-50 z-50 overflow-hidden flex flex-col">

            {/* Header */}
            <header className="bg-white px-4 py-3 flex flex-col gap-3 shadow-sm z-10 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/controle-salao')} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><IoArrowBack className="text-xl" /></button>
                        <div>
                            <h1 className="font-black text-xl text-gray-900 leading-none">Mesa {mesa?.numero}</h1>
                            <p className="text-xs text-gray-500 font-medium truncate max-w-[150px]">
                                Pedindo para: <span className="font-bold truncate" style={{ color: coresEstabelecimento.destaque }}>{clienteSelecionado}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowOrderSummary(true)}
                        className="relative p-3 rounded-2xl text-white shadow-lg active:scale-95 transition-all"
                        style={{ backgroundColor: coresEstabelecimento.destaque }}
                    >
                        <IoCart className="text-xl" />
                        {totalItens > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full border-2 border-white">{totalItens}</span>}
                    </button>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 px-1 hide-scrollbar w-full">
                    {ocupantes.filter(n => n !== 'Mesa').map((nome, idx) => (
                        <div key={idx} className="flex-shrink-0">
                            {editandoNomeIndex === idx ? (
                                <input
                                    autoFocus
                                    className="px-3 py-2 rounded-xl border-2 outline-none font-bold text-sm min-w-[120px] w-auto shadow-md"
                                    style={{ borderColor: coresEstabelecimento.destaque }}
                                    value={novoNomeTemp}
                                    onChange={e => setNovoNomeTemp(e.target.value)}
                                    onBlur={() => salvarEdicaoPessoa(idx)}
                                    onKeyDown={e => e.key === 'Enter' && salvarEdicaoPessoa(idx)}
                                />
                            ) : (
                                <button
                                    onClick={() => setClienteSelecionado(nome)}
                                    className={`group relative px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 border transition-all whitespace-nowrap ${clienteSelecionado === nome ? 'text-white shadow-md transform scale-105' : 'bg-white text-gray-500 border-gray-200'}`}
                                    style={clienteSelecionado === nome ? { backgroundColor: coresEstabelecimento.destaque, borderColor: coresEstabelecimento.destaque } : {}}
                                >
                                    <IoPerson className={clienteSelecionado === nome ? 'opacity-100' : 'opacity-50'} />
                                    {nome}
                                    {clienteSelecionado === nome && (
                                        <div
                                            onClick={(e) => { e.stopPropagation(); iniciarEdicaoPessoa(idx, nome); }}
                                            className="ml-1 p-1 bg-white/20 rounded-full hover:bg-white/40 transition-colors"
                                            title="Editar nome"
                                        >
                                            <IoPencil className="text-[10px] text-white" />
                                        </div>
                                    )}
                                </button>
                            )}
                        </div>
                    ))}

                    <div className="flex-shrink-0">
                        {isAddingPerson ? (
                            <input
                                autoFocus
                                className="px-3 py-2 rounded-xl border-2 outline-none font-bold text-sm w-32 shadow-md animate-in fade-in zoom-in duration-200"
                                style={{ borderColor: coresEstabelecimento.destaque }}
                                placeholder="Nome..."
                                value={novoNomeTemp}
                                onChange={e => setNovoNomeTemp(e.target.value)}
                                onBlur={confirmarNovaPessoa}
                                onKeyDown={e => e.key === 'Enter' && confirmarNovaPessoa()}
                            />
                        ) : (
                            <button
                                onClick={iniciarAdicaoPessoa}
                                className="w-10 h-10 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center border-2 border-dashed border-gray-300 hover:border-gray-400 hover:text-gray-600 transition-colors active:scale-95"
                            >
                                <IoPersonAdd className="text-lg" />
                            </button>
                        )}
                    </div>
                    <div className="w-2 flex-shrink-0"></div>
                </div>

                <div className="relative w-full">
                    <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                    <input
                        type="text"
                        placeholder="Buscar item no cardápio..."
                        value={termoBusca}
                        onChange={(e) => setTermoBusca(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 bg-gray-100 border-transparent border-2 focus:bg-white rounded-xl text-sm outline-none transition-all placeholder-gray-400 font-medium"
                        style={{
                            '--tw-ring-color': coresEstabelecimento.destaque,
                            '--tw-ring-opacity': '0.5'
                        }}
                        onFocus={(e) => e.target.style.borderColor = coresEstabelecimento.destaque}
                        onBlur={(e) => e.target.style.borderColor = 'transparent'}
                    />
                    {termoBusca && (
                        <button
                            onClick={() => setTermoBusca('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 bg-gray-200 hover:bg-gray-300 text-gray-500 rounded-full p-1 transition-colors"
                        >
                            <IoClose className="text-xs" />
                        </button>
                    )}
                </div>

                <div className="flex gap-2 overflow-x-auto hide-scrollbar px-1 pb-1">
                    {categoriasOrdenadas.map(cat => (
                        <button
                            key={cat} onClick={() => setCategoriaAtiva(cat)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${categoriaAtiva === cat ? 'text-white border-transparent shadow-md' : 'bg-white text-gray-500 border-gray-200'}`}
                            style={categoriaAtiva === cat ? { backgroundColor: coresEstabelecimento.primaria } : {}}
                        >
                            {cat}
                        </button>
                    ))}
                    <div className="w-2 flex-shrink-0"></div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
                {produtosFiltrados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                        <IoSearch className="text-4xl mb-2 opacity-20" />
                        <p className="text-sm font-medium">Nenhum produto encontrado</p>
                    </div>
                ) : (
                    produtosFiltrados.map((prod, idx) => (
                        <CardapioItem
                            key={`${prod.id}-${idx}`}
                            produto={prod}
                            abrirModalOpcoes={(p) => {
                                const temOpcoes = (p.opcoes && p.opcoes.length > 0) ||
                                    (p.variacoes && p.variacoes.length > 0) ||
                                    (p.tamanhos && p.tamanhos.length > 0);

                                if (temOpcoes) {
                                    setProdutoEmSelecao(p);
                                } else {
                                    confirmarAdicaoAoCarrinho({ ...p, precoFinal: parseFloat(p.preco), quantidade: 1 });
                                }
                            }}
                            cores={coresEstabelecimento}
                        />
                    ))
                )}
            </main>

            {resumoPedido.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40">
                    <div className="flex justify-between items-center max-w-md mx-auto">
                        <div>
                            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Parcial</span>
                            <div className="text-2xl font-black text-gray-900">R$ {totalGeral.toFixed(2)}</div>
                        </div>
                        <button onClick={() => setShowOrderSummary(true)} className="px-6 py-3 rounded-xl text-white font-bold shadow-lg active:scale-95 transition-all" style={{ backgroundColor: coresEstabelecimento.destaque }}>
                            Ver Comanda
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL DE RESUMO */}
            {showOrderSummary && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowOrderSummary(false)} />
                    <div className="relative w-full max-w-lg bg-gray-50 h-[90vh] sm:h-auto sm:max-h-[85vh] sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col animate-slide-up overflow-hidden">

                        <div className="bg-white p-5 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-black text-gray-900">Resumo da Mesa</h2>
                                <p className="text-xs text-gray-500 mt-0.5">Confira os itens antes de enviar</p>
                            </div>
                            <button onClick={() => setShowOrderSummary(false)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"><IoClose /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {Object.entries(itensAgrupados).map(([pessoa, itens]) => (
                                <div key={pessoa} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
                                        <div className="flex items-center gap-2 font-bold text-gray-700">
                                            <IoPerson className="text-gray-400" /> {pessoa}
                                        </div>
                                        <span className="text-sm font-bold text-gray-900">R$ {itens.reduce((a, i) => a + (i.preco * i.quantidade), 0).toFixed(2)}</span>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {itens.map((item, idx) => {
                                            const isEnviado = item.status && item.status !== 'pendente';
                                            return (
                                                <div key={idx} className="p-4 flex gap-3">
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-start">
                                                            <h4 className="font-bold text-gray-900">
                                                                {item.quantidade > 1 && (
                                                                    <span className="text-red-500 mr-1">{item.quantidade}x</span>
                                                                )}
                                                                {item.nome}
                                                            </h4>
                                                            <span className="font-bold text-gray-900 text-sm">R$ {(item.preco * item.quantidade).toFixed(2)}</span>
                                                        </div>
                                                        {item.observacao && <p className="text-xs text-orange-600 mt-1">Obs: {item.observacao}</p>}
                                                        
                                                        {/* --- MOSTRAR NOME DO GARÇOM --- */}
                                                        {item.adicionadoPor && (
                                                            <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400 font-medium">
                                                                <IoPersonAdd className="text-gray-300" size={10} /> 
                                                                <span>Add por: {item.adicionadoPor}</span>
                                                            </div>
                                                        )}

                                                        <div className="mt-3 flex items-center justify-between">
                                                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md border ${isEnviado ? 'bg-green-50 text-green-700 border-green-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>
                                                                {isEnviado ? 'Enviado' : 'Pendente'}
                                                            </span>

                                                            {isEnviado ? (
                                                                <button onClick={() => { setItemParaExcluir(item); setSenhaDigitada(''); setModalSenhaAberto(true); }} className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1 px-2 py-1 rounded border border-red-100 hover:bg-red-50">
                                                                    <IoTrash /> Excluir
                                                                </button>
                                                            ) : (
                                                                <div className="flex items-center gap-3 bg-gray-100 rounded-lg p-1">
                                                                    <button onClick={() => ajustarQuantidade(item.id, item.cliente, item.quantidade - 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-red-500"><IoRemove /></button>
                                                                    <span className="font-bold text-sm w-4 text-center">{item.quantidade}</span>
                                                                    <button onClick={() => ajustarQuantidade(item.id, item.cliente, item.quantidade + 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-green-600"><IoAdd /></button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-4 bg-white border-t border-gray-100">
                            <div className="flex justify-between items-end mb-4">
                                <span className="text-sm text-gray-500 font-bold">Total Geral</span>
                                <span className="text-3xl font-black text-gray-900">R$ {totalGeral.toFixed(2)}</span>
                            </div>
                            <button
                                onClick={salvarAlteracoes}
                                disabled={salvando}
                                className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                                style={{ backgroundColor: coresEstabelecimento.destaque }}
                            >
                                {salvando ? 'Processando...' : (
                                    <> <IoCheckmarkDoneCircle className="text-2xl" /> Confirmar Pedido </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Senha Master */}
            {modalSenhaAberto && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-xs text-center shadow-2xl">
                        <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3"><IoTrash className="text-2xl" /></div>
                        <h3 className="font-bold text-lg text-gray-900">Excluir Item Enviado?</h3>
                        <p className="text-sm text-gray-500 mb-4">Digite a senha master para confirmar.</p>
                        <input type="password" autoFocus className="w-full text-center text-2xl font-black tracking-widest p-3 border-2 rounded-xl mb-4 focus:border-red-500 outline-none" placeholder="••••" value={senhaDigitada} onChange={e => setSenhaDigitada(e.target.value)} />
                        <div className="flex gap-2">
                            <button onClick={() => setModalSenhaAberto(false)} className="flex-1 py-3 font-bold text-gray-600 bg-gray-100 rounded-xl">Cancelar</button>
                            <button onClick={confirmarExclusao} className="flex-1 py-3 font-bold text-white bg-red-500 rounded-xl shadow-lg">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            {produtoEmSelecao && (
                <VariacoesModal
                    item={produtoEmSelecao}
                    onConfirm={confirmarAdicaoAoCarrinho}
                    onClose={() => setProdutoEmSelecao(null)}
                    coresEstabelecimento={coresEstabelecimento}
                    estabelecimentoId={estabelecimentoId}
                />
            )}

            <style>{`
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
                .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
            `}</style>
        </div>
    );
};

export default TelaPedidos;