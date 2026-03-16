import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import {
    getDocs, doc, getDoc, updateDoc, collection, serverTimestamp, writeBatch, onSnapshot, increment, query, where
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import {
    IoArrowBack, IoCart, IoSearch, IoAdd,
    IoRemove, IoRestaurant, IoClose,
    IoPerson, IoPencil, IoAddCircle, IoCheckmarkCircle,
    IoPersonAdd, IoTrash, IoCheckmarkDoneCircle, IoPrint
} from 'react-icons/io5';

import VariacoesModal from '../components/VariacoesModal';

// --- HELPER PARA IDENTIFICAR SETOR (BAR OU COZINHA) ---
const getSetorItem = (categoria) => {
    const c = (categoria || '').toLowerCase();
    const isBebida = ['bebida', 'drink', 'suco', 'refrigerante', 'agua', 'cerveja'].some(t => c.includes(t));
    return isBebida 
        ? { nome: 'Bar', icon: '🍺', corTexto: 'text-blue-600', corBg: 'bg-blue-50', border: 'border-blue-200' }
        : { nome: 'Cozinha', icon: '🍳', corTexto: 'text-orange-600', corBg: 'bg-orange-50', border: 'border-orange-200' };
};

// --- COMPONENTE ITEM DO CARDÁPIO (ETIQUETA ENTRE NOME E DESCRIÇÃO) ---
const CardapioItem = React.memo(({ produto, abrirModalOpcoes, cores }) => {
    const hasOpcoes = useMemo(() => {
        return (produto.opcoes && produto.opcoes.length > 0) || 
               (produto.variacoes && produto.variacoes.length > 0) || 
               (produto.tamanhos && produto.tamanhos.length > 0) ||
               (produto.adicionais && produto.adicionais.length > 0);
    }, [produto]);

    const precoExibicao = parseFloat(produto.preco || 0).toFixed(2);
    const setor = getSetorItem(produto.categoria);

    return (
        <div
            onClick={() => abrirModalOpcoes(produto)}
            className="bg-white p-2 rounded-xl border border-gray-200 flex gap-2.5 active:scale-[0.98] transition-all cursor-pointer shadow-sm hover:shadow-md group h-full"
        >
            <div className="relative flex-shrink-0">
                {produto.imageUrl ? (
                    <img src={produto.imageUrl} className="w-20 h-20 rounded-lg object-cover bg-gray-50 border border-gray-100" alt={produto.nome} />
                ) : (
                    <div className="w-20 h-20 rounded-lg bg-gray-50 flex items-center justify-center text-gray-300 border border-gray-100">
                        <IoRestaurant className="text-2xl opacity-50" />
                    </div>
                )}
                <div className="absolute -bottom-1.5 -right-1.5 bg-white rounded-full p-0.5 shadow-sm">
                    <IoAddCircle className="text-2xl transition-transform group-hover:scale-110" style={{ color: cores.destaque }} />
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-center min-w-0 py-0.5">
                {/* 1. NOME DO PRODUTO LIVRE NO TOPO */}
                <h3 className="font-bold text-gray-900 text-sm leading-tight pr-1 mb-1">{produto.nome}</h3>
                
                {/* 2. ETIQUETA DO SETOR BEM AQUI (ENTRE O NOME E A DESCRIÇÃO) */}
                <div className="mb-1">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap inline-flex items-center gap-1 w-fit ${setor.corBg} ${setor.corTexto} ${setor.border}`}>
                        {setor.icon} {setor.nome}
                    </span>
                </div>

                {/* 3. DESCRIÇÃO DO PRODUTO LOGO ABAIXO */}
                <p className="text-[11px] text-gray-500 line-clamp-2 mb-1 leading-tight">{produto.descricao || 'Sem descrição'}</p>
                
                <div className="flex items-center gap-2 mt-auto pt-1">
                    <span className="font-black text-sm" style={{ color: cores.destaque }}>R$ {precoExibicao}</span>
                    {hasOpcoes && <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Opções</span>}
                </div>
            </div>
        </div>
    );
});

const TelaPedidos = () => {
    const { id: mesaId, estabelecimentoId: urlEstabelecimentoId } = useParams();
    const { estabelecimentoIdPrincipal } = useAuth();
    const navigate = useNavigate();
    const { user, userData } = useAuth(); 
    
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

    const [pedidoRecemEnviadoId, setPedidoRecemEnviadoId] = useState(null);

    const [ocupantes, setOcupantes] = useState(['Mesa']);
    const [clienteSelecionado, setClienteSelecionado] = useState('Mesa');

    const [isAddingPerson, setIsAddingPerson] = useState(false);
    const [editandoNomeIndex, setEditandoNomeIndex] = useState(null);
    const [novoNomeTemp, setNovoNomeTemp] = useState('');

    const [produtoEmSelecao, setProdutoEmSelecao] = useState(null);
    const [modalSenhaAberto, setModalSenhaAberto] = useState(false);
    const [itemParaExcluir, setItemParaExcluir] = useState(null);
    const [senhaDigitada, setSenhaDigitada] = useState('');

    const [coresEstabelecimento, setCoresEstabelecimento] = useState({
        primaria: '#111827', destaque: '#059669', background: '#f9fafb', texto: { principal: '#111827' }
    });
    const [ordemCategorias, setOrdemCategorias] = useState([]);
    const [senhaMasterEstabelecimento, setSenhaMasterEstabelecimento] = useState('');

    const normalizarTexto = (texto) => {
        if (!texto) return '';
        return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    };

    const enrichWithGlobalAdicionais = (item) => {
        const termosAdicionais = ['adicionais', 'adicional', 'extra', 'extras', 'complemento', 'complementos', 'acrescimo', 'acrescimos', 'molho', 'molhos', 'opcoes', 'opções'];
        const categoriaItemNorm = normalizarTexto(item.categoria || '');
        
        if (termosAdicionais.some(t => categoriaItemNorm.includes(t))) return item;

        const categoriasBloqueadas = [
            'bomboniere', 'bombonieres', 'doce', 'doces', 'chocolate', 'chocolates',
            'bebida', 'bebidas', 'refrigerante', 'refrigerantes', 'suco', 'sucos', 'agua', 'água',
            'cerveja', 'cervejas', 'drink', 'drinks', 'alcool', 'álcool',
            'sobremesa', 'sobremesas', 'sorvete', 'sorvetes', 'gelado',
            'mercearia', 'mercearias', 'tabacaria', 'cigarro'
        ];

        if (categoriasBloqueadas.some(bloq => categoriaItemNorm.includes(bloq))) return item;

        const globais = cardapio.filter(p => {
            const cat = normalizarTexto(p.categoria || '');
            return termosAdicionais.some(termo => cat.includes(termo));
        });

        const idsExistentes = new Set((item.adicionais || []).map(a => a.id));
        const globaisFiltrados = globais.filter(g => !idsExistentes.has(g.id));

        return { ...item, adicionais: [...(item.adicionais || []), ...globaisFiltrados] };
    };

    useEffect(() => {
        if (!estabelecimentoId) return;

        const carregarConfigECardapio = async () => {
            try {
                const estabRef = doc(db, 'estabelecimentos', estabelecimentoId);
                const estabSnap = await getDoc(estabRef);
                if (estabSnap.exists()) {
                    const dados = estabSnap.data();
                    if (dados.cores) setCoresEstabelecimento(prev => ({ ...prev, ...dados.cores }));
                    if (dados.ordemCategorias) setOrdemCategorias(dados.ordemCategorias);
                    if (dados.senhaMaster) setSenhaMasterEstabelecimento(String(dados.senhaMaster));
                }

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
                    const itensRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', cat.id, 'itens');
                    const produtosRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', cat.id, 'produtos'); 

                    const [itensSnap, produtosSnap] = await Promise.all([
                        getDocs(query(itensRef)),
                        getDocs(query(produtosRef))
                    ]);

                    const processarDocs = async (docsSnapshot) => {
                        return Promise.all(docsSnapshot.docs.map(async (docItem) => {
                            const dados = docItem.data();
                            if (dados.ativo === false) return null;

                            let listaAdicionais = [];
                            try {
                                const adicsSnap = await getDocs(collection(docItem.ref, 'adicionais'));
                                listaAdicionais = adicsSnap.docs.map(a => ({ id: a.id, ...a.data() }));
                            } catch(e) {}

                            let listaVariacoes = [];
                            try {
                                const varsSnap = await getDocs(collection(docItem.ref, 'variacoes'));
                                listaVariacoes = varsSnap.docs.map(v => ({ id: v.id, ...v.data() }));
                            } catch(e) {}

                            return {
                                ...dados,
                                id: docItem.id,
                                categoria: cat.nome,
                                categoriaId: cat.id,
                                adicionais: (dados.adicionais && dados.adicionais.length > 0) ? dados.adicionais : listaAdicionais,
                                variacoes: (dados.variacoes && dados.variacoes.length > 0) ? dados.variacoes : listaVariacoes,
                            };
                        }));
                    };

                    const itensProcessados = await processarDocs(itensSnap);
                    const produtosProcessados = await processarDocs(produtosSnap);

                    return [...itensProcessados, ...produtosProcessados].filter(i => i !== null);
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
                    setClienteSelecionado(prev => data.nomesOcupantes.includes(prev) ? prev : (data.nomesOcupantes[0] || 'Mesa'));
                } else {
                    setOcupantes(['Mesa']);
                }
            } else {
                navigate('/controle-salao');
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [estabelecimentoId, mesaId, navigate]);

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

    const confirmarAdicaoAoCarrinho = async (itemConfig) => {
        const { nome, variacaoSelecionada, observacao, precoFinal, adicionaisSelecionados, ...restoDoItem } = itemConfig;
        
        let nomeFinal = nome;
        if (variacaoSelecionada) nomeFinal += ` - ${variacaoSelecionada.nome}`;
        
        const temAdicionais = adicionaisSelecionados && adicionaisSelecionados.length > 0;
        const listaFinalAdicionais = temAdicionais ? adicionaisSelecionados : [];

        if (temAdicionais) {
             const nomesAdics = listaFinalAdicionais.map(a => a.nome).join(', ');
             nomeFinal += ` (+ ${nomesAdics})`;
        }

        const nomeGarcom = userData?.nome || user?.displayName || "Garçom";
        const novaLista = [...resumoPedido];
        
        const indexExistente = novaLista.findIndex(i => {
            const adicsAtuais = i.adicionaisSelecionados || [];
            const adicsNovos = listaFinalAdicionais;
            const mesmaQtd = adicsAtuais.length === adicsNovos.length;
            const mesmosAdics = mesmaQtd && adicsAtuais.every(a => adicsNovos.some(b => b.nome === a.nome));

            return i.produtoIdOriginal === itemConfig.id && 
                   i.nome === nomeFinal &&
                   i.observacao === (observacao || '') &&
                   i.cliente === clienteSelecionado &&
                   (!i.status || i.status === 'pendente') &&
                   mesmosAdics;
        });

        if (indexExistente >= 0) {
            novaLista[indexExistente].quantidade += 1;
            novaLista[indexExistente].adicionadoPor = nomeGarcom;
            toast.success(`+1 ${nomeFinal}`);
        } else {
            const novoItem = {
                ...restoDoItem,
                id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, 
                produtoIdOriginal: itemConfig.id, 
                categoriaId: itemConfig.categoriaId,
                nome: nomeFinal, 
                preco: precoFinal,
                observacao: observacao || '', 
                quantidade: 1, 
                cliente: clienteSelecionado,
                adicionadoEm: new Date(), 
                status: 'pendente',
                adicionadoPor: nomeGarcom,
                adicionaisSelecionados: listaFinalAdicionais,
                adicionais: listaFinalAdicionais, 
                variacaoSelecionada: variacaoSelecionada || null
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

    const iniciarAdicaoPessoa = () => { setIsAddingPerson(true); setNovoNomeTemp(''); };
    const confirmarNovaPessoa = async () => {
        if (!novoNomeTemp.trim()) { setIsAddingPerson(false); return; }
        const novoNome = novoNomeTemp.trim();
        const novosOcupantes = [...ocupantes, novoNome];
        setOcupantes(novosOcupantes); setClienteSelecionado(novoNome); setIsAddingPerson(false); setNovoNomeTemp('');
        await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), { nomesOcupantes: novosOcupantes });
    };
    const iniciarEdicaoPessoa = (index, nome) => { setEditandoNomeIndex(index); setNovoNomeTemp(nome); };
    const salvarEdicaoPessoa = async (index) => {
        if (editandoNomeIndex === null) return;
        if (!novoNomeTemp.trim()) { setEditandoNomeIndex(null); return; }
        const nomeAntigo = ocupantes[index];
        const novoNome = novoNomeTemp.trim();
        if (nomeAntigo === novoNome) { setEditandoNomeIndex(null); return; }
        const novosOcupantes = [...ocupantes];
        novosOcupantes[index] = novoNome;
        setOcupantes(novosOcupantes); setEditandoNomeIndex(null);
        if (clienteSelecionado === nomeAntigo) setClienteSelecionado(novoNome);
        const novosItens = resumoPedido.map(i => (i.cliente === nomeAntigo ? { ...i, cliente: novoNome } : i));
        setResumoPedido(novosItens);
        await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), { nomesOcupantes: novosOcupantes, itens: novosItens });
    };
    const confirmarExclusao = async () => {
        if(senhaMasterEstabelecimento && senhaDigitada !== senhaMasterEstabelecimento) return toast.error("Senha errada");
        const novaLista = resumoPedido.filter(i => i !== itemParaExcluir);
        const novoTotal = novaLista.reduce((acc, i) => acc + (i.preco * i.quantidade), 0);
        await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), { itens: novaLista, total: novoTotal });
        setModalSenhaAberto(false);
    };
    const ajustarQuantidade = async (id, cliente, qtd) => {
        const novaLista = resumoPedido.map(i => i.id === id ? { ...i, quantidade: qtd } : i).filter(i => i.quantidade > 0);
        setResumoPedido(novaLista);
        await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), { itens: novaLista, total: novaLista.reduce((acc, i) => acc + (i.preco * i.quantidade), 0) });
    };

    const dispararImpressao = (pedidoIdParaImpressao, setor) => {
        const idAlvo = pedidoIdParaImpressao || mesaId;
        let url = `/impressao-isolada?pedidoId=${idAlvo}`;
        if (setor) url += `&setor=${setor}`;
        window.open(url, '_blank', 'width=800,height=600');
    };

    const salvarAlteracoes = async () => {
        setSalvando(true);
        try {
            const novos = resumoPedido.filter(i => !i.status || i.status === 'pendente');
            const total = resumoPedido.reduce((acc, i) => acc + (i.preco * i.quantidade), 0);
            
            const batch = writeBatch(db);
            const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
            let idPedidoGerado = null;

            const promessas = novos.map(async item => {
                if(!item.categoriaId || !item.produtoIdOriginal) return null;
                try {
                    let ref = doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', item.categoriaId, 'itens', item.produtoIdOriginal);
                    let snap = await getDoc(ref);
                    if(!snap.exists()) {
                        ref = doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', item.categoriaId, 'produtos', item.produtoIdOriginal);
                        snap = await getDoc(ref);
                    }
                    if(snap.exists()) return { item, itemRef: ref, itemSnap: snap };
                } catch(e) {}
                return null;
            });
            
            const resultados = await Promise.all(promessas);
            
            resultados.forEach(res => {
                if(!res || !res.itemSnap.exists()) return;
                const data = res.itemSnap.data();
                const itemV = res.item;
                const ref = res.itemRef;
                
                try {
                    if(itemV.variacaoSelecionada && data.variacoes && Array.isArray(data.variacoes)) {
                        const novasVars = data.variacoes.map(v => {
                            const ehEssa = (v.id && v.id === itemV.variacaoSelecionada.id) || (v.nome === itemV.variacaoSelecionada.nome);
                            if(ehEssa) return { ...v, estoque: (Number(v.estoque)||0) - itemV.quantidade };
                            return v;
                        });
                        const novoTotal = novasVars.reduce((acc, v) => acc + (Number(v.estoque)||0), 0);
                        batch.update(ref, { variacoes: novasVars, estoque: novoTotal });
                    } else {
                        batch.update(ref, { estoque: increment(-itemV.quantidade) });
                    }
                } catch (e) {}
            });

            if(novos.length > 0) {
                idPedidoGerado = `pedido_${mesaId}_${Date.now()}`;
                
                const pedidoRef = doc(db, 'estabelecimentos', estabelecimentoId, 'pedidos', idPedidoGerado);
                batch.set(pedidoRef, {
                    id: idPedidoGerado, 
                    mesaId, 
                    mesaNumero: mesa?.numero, 
                    itens: novos.map(i => ({...i, status: 'recebido'})), 
                    status: 'recebido', 
                    total: novos.reduce((a,i)=>a+(i.preco*i.quantidade),0), 
                    dataPedido: serverTimestamp(), 
                    createdAt: serverTimestamp(), 
                    source: 'salao'
                });

                const itensUpd = resumoPedido.map(i => (!i.status || i.status === 'pendente') ? { ...i, status: 'enviado', pedidoCozinhaId: idPedidoGerado } : i);
                
                batch.update(mesaRef, { 
                    itens: itensUpd, 
                    status: 'ocupada', 
                    total: total, 
                    updatedAt: serverTimestamp() 
                });
            } else {
                batch.update(mesaRef, { 
                    itens: resumoPedido, 
                    total: total, 
                    updatedAt: serverTimestamp() 
                });
            }

            await batch.commit();
            toast.success("Pedido enviado!");
            
            if (idPedidoGerado) {
                setPedidoRecemEnviadoId(idPedidoGerado);
            }

        } catch(e) { 
            console.error("Erro ao salvar:", e); 
            toast.error("Erro ao enviar pedido. Tente novamente."); 
        } finally { 
            setSalvando(false); 
        }
    };

    const itensAgrupados = useMemo(() => {
        return resumoPedido.reduce((acc, item) => {
            const k = item.cliente || 'Mesa';
            if (!acc[k]) acc[k] = []; acc[k].push(item); return acc;
        }, {});
    }, [resumoPedido]);

    const totalGeral = resumoPedido.reduce((acc, i) => acc + (i.preco * i.quantidade), 0);
    const totalItens = resumoPedido.reduce((acc, i) => acc + i.quantidade, 0);

    const temItensPendentes = resumoPedido.some(i => !i.status || i.status === 'pendente');

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>;

    return (
        <div className="fixed inset-0 bg-gray-50 z-50 overflow-hidden flex flex-col w-full">
            
{/* NOVO HEADER COM BLOCOS FANTASMAS PARA PROTEGER AS SOMBRAS */}
<header className="bg-white py-3 flex flex-col gap-3 shadow-sm z-10 shrink-0 w-full">
    
    {/* TOPO: VOLTAR E CARRINHO */}
    <div className="flex items-center justify-between w-full px-4">
        <div className="flex items-center gap-3">
            <button onClick={() => navigate('/controle-salao')} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><IoArrowBack className="text-xl" /></button>
            <div>
                <h1 className="font-black text-xl text-gray-900 leading-none">Mesa {mesa?.numero}</h1>
                <p className="text-xs text-gray-500 font-medium truncate max-w-[150px]">
                    Pedindo para: <span className="font-bold truncate" style={{ color: coresEstabelecimento.destaque }}>{clienteSelecionado}</span>
                </p>
            </div>
        </div>
        <button onClick={() => setShowOrderSummary(true)} className="relative p-3 rounded-2xl text-white shadow-lg active:scale-95 transition-all" style={{ backgroundColor: coresEstabelecimento.destaque }}>
            <IoCart className="text-xl" />
            {totalItens > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full border-2 border-white">{totalItens}</span>}
        </button>
    </div>
    
    {/* LISTA DE OCUPANTES (SCROLL HORIZONTAL) */}
    {/* Note o pl-4 aqui para dar o recuo esquerdo */}
    <div className="flex items-center gap-2 overflow-x-auto py-3 pl-4 hide-scrollbar w-full">
        {ocupantes.filter(n => n !== 'Mesa').map((nome, idx) => (
            <div key={idx} className="flex-shrink-0">
                {editandoNomeIndex === idx ? (
                    <input autoFocus className="px-3 py-2 rounded-xl border-2 outline-none font-bold text-sm min-w-[120px] w-auto shadow-md" style={{ borderColor: coresEstabelecimento.destaque }} value={novoNomeTemp} onChange={e => setNovoNomeTemp(e.target.value)} onBlur={() => salvarEdicaoPessoa(idx)} onKeyDown={e => e.key === 'Enter' && salvarEdicaoPessoa(idx)} />
                ) : (
                    <button onClick={() => setClienteSelecionado(nome)} className={`group relative px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 border transition-all whitespace-nowrap ${clienteSelecionado === nome ? 'text-white shadow-md transform scale-105' : 'bg-white text-gray-500 border-gray-200'}`} style={clienteSelecionado === nome ? { backgroundColor: coresEstabelecimento.destaque, borderColor: coresEstabelecimento.destaque } : {}}>
                        <IoPerson className={clienteSelecionado === nome ? 'opacity-100' : 'opacity-50'} />{nome}
                        {clienteSelecionado === nome && (<div onClick={(e) => { e.stopPropagation(); iniciarEdicaoPessoa(idx, nome); }} className="ml-1 p-1 bg-white/20 rounded-full hover:bg-white/40 transition-colors" title="Editar nome"><IoPencil className="text-[10px] text-white" /></div>)}
                    </button>
                )}
            </div>
        ))}
        
        <div className="flex-shrink-0">
            {isAddingPerson ? (
                <input 
                    autoFocus 
                    className="px-3 py-2 rounded-xl border-2 outline-none font-bold text-sm w-36 shadow-md animate-in fade-in zoom-in duration-200" 
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
                    className="px-4 py-2 h-full min-h-[38px] rounded-xl bg-gray-50 text-gray-500 flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all active:scale-95"
                >
                    <IoPersonAdd className="text-lg" />
                    <span className="text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                        Adicionar Pessoa
                    </span>
                </button>
            )}
        </div>
        
        {/* 🔥 O SEGREDO DEFINITIVO AQUI: Um bloco com um PONTO INVISÍVEL */}
        <div className="flex-shrink-0 w-6 h-1 text-transparent select-none pointer-events-none">
            .
        </div>
    </div>

    {/* BUSCA DE PRODUTOS */}
    <div className="relative w-full px-4">
        <IoSearch className="absolute left-7 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
        <input type="text" placeholder="Buscar item no cardápio..." value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} className="w-full pl-10 pr-10 py-2.5 bg-gray-100 border-transparent border-2 focus:bg-white rounded-xl text-sm outline-none transition-all placeholder-gray-400 font-medium" style={{ '--tw-ring-color': coresEstabelecimento.destaque, '--tw-ring-opacity': '0.5' }} onFocus={(e) => e.target.style.borderColor = coresEstabelecimento.destaque} onBlur={(e) => e.target.style.borderColor = 'transparent'} />
        {termoBusca && (<button onClick={() => setTermoBusca('')} className="absolute right-7 top-1/2 -translate-y-1/2 bg-gray-200 hover:bg-gray-300 text-gray-500 rounded-full p-1 transition-colors"><IoClose className="text-xs" /></button>)}
    </div>

    {/* CATEGORIAS (SCROLL HORIZONTAL) */}
    <div className="flex gap-2 overflow-x-auto hide-scrollbar py-3 pl-4 w-full">
        {categoriasOrdenadas.map(cat => (<button key={cat} onClick={() => setCategoriaAtiva(cat)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${categoriaAtiva === cat ? 'text-white border-transparent shadow-md' : 'bg-white text-gray-500 border-gray-200'}`} style={categoriaAtiva === cat ? { backgroundColor: coresEstabelecimento.primaria } : {}}>{cat}</button>))}
        
        {/* 🔥 Ponto invisível nas categorias também para garantir */}
        <div className="flex-shrink-0 w-6 h-1 text-transparent select-none pointer-events-none">
            .
        </div>
    </div>
</header>

            {/* AQUI FOI ALTERADO PARA APROVEITAR 100% DA TELA COM ITENS MAIS APERTADOS */}
            <main className="flex-1 overflow-y-auto p-2 sm:p-4 lg:px-6 pb-28 w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2 sm:gap-3 w-full">
                    {produtosFiltrados.map((prod, idx) => (
                        <CardapioItem
                            key={`${prod.id}-${idx}`}
                            produto={prod}
                            abrirModalOpcoes={(p) => {
                                const itemEnriquecido = enrichWithGlobalAdicionais(p);
                                const temOpcoes = (itemEnriquecido.opcoes && itemEnriquecido.opcoes.length > 0) || (itemEnriquecido.variacoes && itemEnriquecido.variacoes.length > 0) || (itemEnriquecido.tamanhos && itemEnriquecido.tamanhos.length > 0) || (itemEnriquecido.adicionais && itemEnriquecido.adicionais.length > 0);
                                if (temOpcoes) setProdutoEmSelecao(itemEnriquecido);
                                else confirmarAdicaoAoCarrinho({ ...itemEnriquecido, precoFinal: parseFloat(p.preco), quantidade: 1 });
                            }}
                            cores={coresEstabelecimento}
                        />
                    ))}
                </div>
            </main>

            {resumoPedido.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 lg:p-5 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] z-40">
                    {/* BARRA INFERIOR EXPANDIDA PARA ENCOSTAR NAS LATERAIS */}
                    <div className="flex justify-between items-center w-full px-2 sm:px-6 lg:px-10">
                        <div>
                            <span className="text-xs md:text-sm text-gray-400 font-bold uppercase tracking-wider">Total Parcial</span>
                            <div className="text-2xl md:text-3xl font-black text-gray-900">R$ {totalGeral.toFixed(2)}</div>
                        </div>
                        <button onClick={() => setShowOrderSummary(true)} className="px-8 py-3 md:py-4 rounded-xl text-white font-bold shadow-xl active:scale-95 transition-all text-base md:text-lg" style={{ backgroundColor: coresEstabelecimento.destaque }}>
                            Ver Comanda
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL PRINCIPAL: RESUMO DO PEDIDO */}
            {showOrderSummary && (
                <div className="fixed inset-0 z-[50] flex items-end sm:items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setShowOrderSummary(false)} />
                    
                    {/* AQUI ESTÁ A CORREÇÃO: Voltou para max-w-lg para não ficar gigante no meio do ecrã */}
                    <div className="relative w-full max-w-lg bg-gray-50 h-[90vh] sm:h-auto sm:max-h-[85vh] sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col animate-slide-up overflow-hidden">
                        
                        <div className="bg-white p-5 border-b border-gray-100 flex justify-between items-center shrink-0">
                            <div><h2 className="text-xl font-black text-gray-900">Resumo da Mesa</h2><p className="text-xs text-gray-500 mt-0.5">Confira e envie para produção</p></div>
                            <button onClick={() => setShowOrderSummary(false)} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"><IoClose /></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {Object.entries(itensAgrupados).map(([pessoa, itens]) => (
                                <div key={pessoa} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
                                        <div className="flex items-center gap-2 font-bold text-gray-700"><IoPerson className="text-gray-400" /> {pessoa}</div>
                                        <span className="text-sm font-bold text-gray-900">R$ {itens.reduce((a, i) => a + (i.preco * i.quantidade), 0).toFixed(2)}</span>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {itens.map((item, idx) => {
                                            const setorItem = getSetorItem(item.categoria);
                                            return (
                                            <div key={idx} className="p-4 flex gap-3">
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="font-bold text-gray-900 pr-2">{item.quantidade > 1 && <span className="text-red-500 mr-1">{item.quantidade}x</span>}{item.nome}</h4>
                                                        <span className="font-bold text-gray-900 text-sm">R$ {(item.preco * item.quantidade).toFixed(2)}</span>
                                                    </div>

                                                    <div className="flex items-center gap-2 mt-1 mb-1">
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${setorItem.corBg} ${setorItem.corTexto} ${setorItem.border}`}>
                                                            {setorItem.icon} {setorItem.nome}
                                                        </span>
                                                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${item.status && item.status !== 'pendente' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-600 border-orange-200'}`}>
                                                            {item.status && item.status !== 'pendente' ? 'Enviado' : 'Pendente'}
                                                        </span>
                                                    </div>

                                                    {item.observacao && <p className="text-xs text-orange-600 mt-1">Obs: {item.observacao}</p>}
                                                    {item.adicionaisSelecionados && item.adicionaisSelecionados.length > 0 && (
                                                        <p className="text-[10px] text-gray-500 mt-0.5 font-bold">+ {item.adicionaisSelecionados.map(a => a.nome).join(', ')}</p>
                                                    )}
                                                    
                                                    <div className="mt-3 flex items-center justify-between">
                                                        {item.adicionadoPor ? (<div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium"><IoPersonAdd className="text-gray-300" size={10} /> <span>{item.adicionadoPor}</span></div>) : <div></div>}
                                                        {item.status && item.status !== 'pendente' ? (
                                                            <button onClick={() => { setItemParaExcluir(item); setSenhaDigitada(''); setModalSenhaAberto(true); }} className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1 px-2 py-1 rounded border border-red-100 hover:bg-red-50"><IoTrash /> Excluir</button>
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
                                        )})}
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {/* RODAPÉ INTELIGENTE DO MODAL */}
                        <div className="p-4 bg-white border-t border-gray-100 shrink-0">
                            <div className="flex justify-between items-end mb-4">
                                <span className="text-sm text-gray-500 font-bold">Total Geral</span>
                                <span className="text-3xl font-black text-gray-900">R$ {totalGeral.toFixed(2)}</span>
                            </div>
                            
                            {temItensPendentes ? (
                                <button onClick={salvarAlteracoes} disabled={salvando} className="w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70" style={{ backgroundColor: coresEstabelecimento.destaque }}>
                                    {salvando ? 'Processando...' : (<> <IoCheckmarkDoneCircle className="text-2xl" /> Confirmar Pedido </>)}
                                </button>
                            ) : (
                                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 animate-in slide-in-from-bottom-2 duration-300">
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex justify-center mb-3">
                                        <IoPrint className="mr-1 text-sm" /> Mande para a Impressora:
                                    </span>
                                    <div className="flex gap-2">
                                        <button onClick={() => dispararImpressao(pedidoRecemEnviadoId, 'cozinha')} className="flex-1 bg-orange-100 hover:bg-orange-500 hover:text-white text-orange-700 py-3 rounded-lg font-bold text-xs transition-colors flex flex-col items-center gap-1 border border-orange-200 hover:border-transparent">
                                            <span className="text-xl">🍳</span> Cozinha
                                        </button>
                                        <button onClick={() => dispararImpressao(pedidoRecemEnviadoId, 'bar')} className="flex-1 bg-blue-100 hover:bg-blue-500 hover:text-white text-blue-700 py-3 rounded-lg font-bold text-xs transition-colors flex flex-col items-center gap-1 border border-blue-200 hover:border-transparent">
                                            <span className="text-xl">🍺</span> Bar
                                        </button>
                                        <button onClick={() => dispararImpressao(pedidoRecemEnviadoId, '')} className="flex-1 bg-gray-200 hover:bg-gray-800 hover:text-white text-gray-700 py-3 rounded-lg font-bold text-xs transition-colors flex flex-col items-center gap-1 border border-gray-300 hover:border-transparent">
                                            <span className="text-xl">🧾</span> Tudo
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {modalSenhaAberto && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-xs text-center shadow-2xl">
                        <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3"><IoTrash className="text-2xl" /></div>
                        <h3 className="font-bold text-lg text-gray-900">Excluir Item Enviado?</h3>
                        <p className="text-sm text-gray-500 mb-4">Digite a senha master para confirmar.</p>
                        <input type="password" autoFocus className="w-full text-center text-2xl font-black tracking-widest p-3 border-2 rounded-xl mb-4 focus:border-red-500 outline-none" placeholder="••••" value={senhaDigitada} onChange={e => setSenhaDigitada(e.target.value)} />
                        <div className="flex gap-2"><button onClick={() => setModalSenhaAberto(false)} className="flex-1 py-3 font-bold text-gray-600 bg-gray-100 rounded-xl">Cancelar</button><button onClick={confirmarExclusao} className="flex-1 py-3 font-bold text-white bg-red-500 rounded-xl shadow-lg">Confirmar</button></div>
                    </div>
                </div>
            )}

            {produtoEmSelecao && (<VariacoesModal item={produtoEmSelecao} onConfirm={confirmarAdicaoAoCarrinho} onClose={() => setProdutoEmSelecao(null)} coresEstabelecimento={coresEstabelecimento} estabelecimentoId={estabelecimentoId} />)}
            <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; } @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } } .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }`}</style>
        </div>
    );
};

export default TelaPedidos;