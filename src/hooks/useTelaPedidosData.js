import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../firebase';
import { 
    doc, getDoc, collection, getDocs, onSnapshot, updateDoc, 
    serverTimestamp, writeBatch, addDoc 
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import { toast as rtToast } from 'react-toastify';

const getToastConfig = (type, opts) => {
    const bgColors = {
        success: '#10B981',
        error: '#EF4444',
        info: '#3B82F6',
        warning: '#F59E0B'
    };
    return {
        position: "top-center",
        autoClose: 2000,
        hideProgressBar: true,
        closeButton: false,
        theme: "dark",
        ...opts,
        style: {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 99999,
            borderRadius: '16px',
            minHeight: '48px',
            padding: '12px 24px',
            fontWeight: '900',
            fontSize: '15px',
            color: '#FFFFFF',
            backgroundColor: bgColors[type] || '#1F2937',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            width: 'max-content',
            maxWidth: '90%',
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...opts?.style
        }
    };
};

const toast = {
    success: (msg, opts) => rtToast.success(msg, getToastConfig('success', opts)),
    error: (msg, opts) => rtToast.error(msg, getToastConfig('error', opts)),
    info: (msg, opts) => rtToast.info(msg, getToastConfig('info', opts)),
    warning: (msg, opts) => rtToast.warning(msg, getToastConfig('warning', opts)),
    loading: (msg, opts) => {
        const config = getToastConfig('info', opts);
        return rtToast.loading(msg, { 
            position: "top-center", 
            ...opts, 
            style: config.style 
        });
    },
    update: (id, opts) => {
        const config = getToastConfig(opts?.type || 'info', opts);
        return rtToast.update(id, { 
            position: "top-center", 
            ...opts, 
            style: config.style 
        });
    },
    dismiss: (id) => rtToast.dismiss(id),
};
import { estoqueService } from '../services/estoqueService';

const normalizarTexto = (texto) => {
    if (!texto) return '';
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

const CACHE_KEY = 'mf_pdv_cardapio_cache_';
const CACHE_TTL = 5 * 60 * 1000;

function getCachedData(id) {
    try {
        const raw = localStorage.getItem(CACHE_KEY + id);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch { return null; }
}

function setCachedData(id, data) {
    try {
        localStorage.setItem(CACHE_KEY + id, JSON.stringify({
            ...data,
            _cachedAt: Date.now()
        }));
    } catch (e) {
        try {
            Object.keys(localStorage)
                .filter(k => k.startsWith(CACHE_KEY))
                .forEach(k => localStorage.removeItem(k));
        } catch { /* ignore */ }
    }
}

export function useTelaPedidosData(estabelecimentoId, mesaId, userData, user) {
    const navigate = useNavigate();

    // Estados do Banco e Estrutura
    const [loading, setLoading] = useState(true);
    const [mesa, setMesa] = useState(null);
    const [cardapio, setCardapio] = useState([]);
    const [categorias, setCategorias] = useState(['Todos']);
    const [coresEstabelecimento, setCoresEstabelecimento] = useState({
        primaria: '#111827', destaque: '#059669', background: '#f9fafb', texto: { principal: '#111827' }
    });
    const [ordemCategorias, setOrdemCategorias] = useState([]);
    const [senhaMasterEstabelecimento, setSenhaMasterEstabelecimento] = useState('');
    const [tipoNegocio, setTipoNegocio] = useState('restaurante');

    // Estados Voláteis (Controlados pelo Banco em tempo real e UI)
    const [resumoPedido, setResumoPedido] = useState([]);
    const [ocupantes, setOcupantes] = useState(['Mesa']);
    const [clienteSelecionado, setClienteSelecionado] = useState('Mesa');
    
    const [termoBusca, setTermoBusca] = useState('');
    const [categoriaAtiva, setCategoriaAtiva] = useState('Todos');
    const [salvando, setSalvando] = useState(false);
    const [pedidoRecemEnviadoId, setPedidoRecemEnviadoId] = useState(null);

    const hasHydratedFromCache = useRef(false);

    // Carga Pesada Principal: Cardápio
    useEffect(() => {
        if (!estabelecimentoId) return;
        let isMounted = true;

        const cached = getCachedData(estabelecimentoId);
        if (cached && !hasHydratedFromCache.current) {
            hasHydratedFromCache.current = true;
            if (cached.cores) setCoresEstabelecimento(prev => ({ ...prev, ...cached.cores }));
            if (cached.ordemCategorias) setOrdemCategorias(cached.ordemCategorias);
            if (cached.senhaMaster) setSenhaMasterEstabelecimento(cached.senhaMaster);
            if (cached.tipoNegocio) setTipoNegocio(cached.tipoNegocio);
            if (cached.cardapio) setCardapio(cached.cardapio);
            if (cached.categorias) setCategorias(cached.categorias);
            setLoading(false);

            if (Date.now() - (cached._cachedAt || 0) < CACHE_TTL) {
                return; // Cache fresco
            }
        }

        const carregarConfigECardapio = async () => {
            if (!cached) setLoading(true);
            try {
                const estabRef = doc(db, 'estabelecimentos', estabelecimentoId);
                const estabSnap = await getDoc(estabRef);
                
                let coresUpdate = null;
                let ordemUpdate = null;
                let senhaUpdate = null;
                let tipoNegocioUpdate = 'restaurante';

                if (estabSnap.exists()) {
                    const dados = estabSnap.data();
                    if (dados.cores) coresUpdate = dados.cores;
                    if (dados.ordemCategorias) ordemUpdate = dados.ordemCategorias;
                    if (dados.senhaMaster) senhaUpdate = String(dados.senhaMaster);
                    if (dados.tipoNegocio) tipoNegocioUpdate = dados.tipoNegocio;
                }

                if (!isMounted) return;
                if (coresUpdate) setCoresEstabelecimento(prev => ({ ...prev, ...coresUpdate }));
                if (ordemUpdate) setOrdemCategorias(ordemUpdate);
                if (senhaUpdate) setSenhaMasterEstabelecimento(senhaUpdate);
                if (tipoNegocioUpdate) setTipoNegocio(tipoNegocioUpdate);

                const categoriasRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio');
                const categoriasSnap = await getDocs(categoriasRef);

                let listaCats = ['Todos'];
                const catsAtivas = [];
                categoriasSnap.docs.forEach(cDoc => {
                    if (cDoc.data().ativo !== false) {
                        const nome = cDoc.data().nome || cDoc.id;
                        listaCats.push(nome);
                        catsAtivas.push({ id: cDoc.id, nome });
                    }
                });

                const categoryPromises = catsAtivas.map(async (cat) => {
                    const [itensSnap, produtosSnap] = await Promise.all([
                        getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', cat.id, 'itens')),
                        getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', cat.id, 'produtos'))
                    ]);
                    
                    return [...itensSnap.docs, ...produtosSnap.docs]
                        .filter(d => d.data().ativo !== false && d.data().exibirSalao !== false)
                        .map(docItem => ({
                            ...docItem.data(),
                            id: docItem.id,
                            categoria: cat.nome,
                            categoriaId: cat.id,
                            tipoColecao: itensSnap.docs.some(i => i.id === docItem.id) ? 'itens' : 'produtos'
                        }));
                });

                const results = await Promise.all(categoryPromises);
                const produtosFinaisBrutosRaw = results.flat();
                
                const produtosUnicosMap = new Map();
                produtosFinaisBrutosRaw.forEach(p => {
                    if (!produtosUnicosMap.has(p.id)) {
                        produtosUnicosMap.set(p.id, p);
                    }
                });
                const produtosFinaisBrutos = Array.from(produtosUnicosMap.values());
                
                const catsFinais = [...new Set(listaCats)];

                if (!isMounted) return;
                setCardapio(produtosFinaisBrutos);
                setCategorias(catsFinais);

                setCachedData(estabelecimentoId, {
                    cores: coresUpdate,
                    ordemCategorias: ordemUpdate,
                    senhaMaster: senhaUpdate,
                    tipoNegocio: tipoNegocioUpdate,
                    cardapio: produtosFinaisBrutos,
                    categorias: catsFinais
                });

            } catch (error) {
                console.error("Erro ao carregar cardápio:", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        carregarConfigECardapio();
        
        return () => { isMounted = false; };
    }, [estabelecimentoId]);

    // Listener de Tempo Real: Mesa
    useEffect(() => {
        if (!estabelecimentoId || !mesaId) return;
        
        const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
        const unsubscribe = onSnapshot(mesaRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setMesa({ id: docSnap.id, ...data });
                if (data.itens) setResumoPedido(data.itens);
                
                if (data.nomesOcupantes && data.nomesOcupantes.length > 0) {
                    const pessoasPagas = data.pessoasPagas || [];
                    let nomesAtivos = data.nomesOcupantes.filter(n => !pessoasPagas.includes(n));
                    if (nomesAtivos.length === 0) nomesAtivos = ['Mesa'];
                    
                    setOcupantes(nomesAtivos);
                    setClienteSelecionado(prev => nomesAtivos.includes(prev) ? prev : (nomesAtivos[0] || 'Mesa'));
                } else {
                    setOcupantes(['Mesa']);
                }
            } else {
                navigate('/controle-salao');
            }
        });
        
        return () => unsubscribe();
    }, [estabelecimentoId, mesaId, navigate]);

    // ==========================================
    // MÉTODOS DE NEGÓCIO E COMPUTAÇÃO (MIGRADOS)
    // ==========================================

    const enrichWithGlobalAdicionais = useCallback((item) => {
        const termosAdicionais = ['adicionais', 'adicional', 'extra', 'extras', 'complemento', 'complementos', 'acrescimo', 'acrescimos', 'molho', 'molhos', 'opcoes', 'opções'];
        const categoriaItemNorm = normalizarTexto(item.categoria || '');
        const categoriaIdNorm = normalizarTexto(item.categoriaId || '');
        
        const palavrasItem = categoriaItemNorm.split(/[^a-z0-9]+/);
        if (termosAdicionais.some(t => palavrasItem.includes(t))) return item;

        const categoriasComAdicionais = [
            'classico', 'classicos', 'clássico', 'clássicos', 'os-classicos', 'os classicos',
            'novato', 'novatos', 'os-novatos', 'os novatos',
            'queridinho', 'queridinhos', 'os-queridinhos', 'os queridinhos',
            'grande', 'grandes', 'grandes-fomes', 'grandes fomes',
            'hamburguer', 'hamburgueres', 'hambúrguer', 'hambúrgueres', 'burger', 'burgers',
            'artesanal', 'artesanais', 'smash', 'gourmet'
        ];

        const permitido = categoriasComAdicionais.some(cat => 
            categoriaItemNorm.includes(cat) || categoriaIdNorm.includes(cat)
        );

        if (!permitido) return item;

        const globais = cardapio.filter(p => {
            const cat = normalizarTexto(p.categoria || '');
            const palavras = cat.split(/[^a-z0-9]+/);
            return termosAdicionais.some(termo => palavras.includes(termo));
        });

        const idsExistentes = new Set((item.adicionais || []).map(a => a.id));
        const globaisFiltrados = globais.filter(g => !idsExistentes.has(g.id));

        return { ...item, adicionais: [...(item.adicionais || []), ...globaisFiltrados] };
    }, [cardapio]);

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
            (!termoBusca || (p.nome || '').toLowerCase().includes((termoBusca || '').toLowerCase())) &&
            (categoriaAtiva === 'Todos' || p.categoria === categoriaAtiva)
        );
    }, [cardapio, termoBusca, categoriaAtiva]);

    const quantidadesNoCarrinho = useMemo(() => {
        const mapa = {};
        resumoPedido.forEach(item => {
            if (item.status === 'cancelado') return;
            const idOrig = item.produtoIdOriginal;
            if (idOrig) {
                if (!mapa[idOrig]) mapa[idOrig] = 0;
                mapa[idOrig] += item.quantidade;
            }
        });
        return mapa;
    }, [resumoPedido]);

    const itensAgrupados = useMemo(() => {
        return resumoPedido.reduce((acc, item) => {
            const k = item.cliente || 'Mesa';
            if (!acc[k]) acc[k] = []; acc[k].push(item); return acc;
        }, {});
    }, [resumoPedido]);

    const totalGeral = useMemo(() => {
        return resumoPedido.reduce((acc, i) => i.status === 'cancelado' ? acc : acc + (i.preco * i.quantidade), 0);
    }, [resumoPedido]);

    const totalItens = useMemo(() => {
        return resumoPedido.reduce((acc, i) => i.status === 'cancelado' ? acc : acc + i.quantidade, 0);
    }, [resumoPedido]);

    const temItensPendentes = useMemo(() => {
        return resumoPedido.some(i => (!i.status || i.status === 'pendente') && i.status !== 'cancelado');
    }, [resumoPedido]);

    const pedidosEnviados = useMemo(() => {
        if (!resumoPedido || resumoPedido.length === 0) return [];

        const grupos = {};
        resumoPedido.forEach(item => {
            if (item.status === 'cancelado') return;
            if (!item.status || item.status === 'pendente') return; // Apenas itens já enviados

            const pedId = item.pedidoCozinhaId || 'legacy';
            if (!grupos[pedId]) {
                grupos[pedId] = {
                    id: pedId,
                    adicionadoEm: item.adicionadoEm || item.createdAt || null,
                    adicionadoPor: item.adicionadoPor || item.funcionario || 'Garçom',
                    itens: []
                };
            }
            grupos[pedId].itens.push(item);
        });

        return Object.values(grupos).sort((a, b) => {
            const timeA = a.adicionadoEm ? (a.adicionadoEm.toDate ? a.adicionadoEm.toDate().getTime() : new Date(a.adicionadoEm).getTime()) : 0;
            const timeB = b.adicionadoEm ? (b.adicionadoEm.toDate ? b.adicionadoEm.toDate().getTime() : new Date(b.adicionadoEm).getTime()) : 0;
            return timeB - timeA;
        });
    }, [resumoPedido]);

    // Função interna para checar subcoleções e enriquecer
    const prepararProdutoParaSelecao = async (prod) => {
        let itemAtualizado = { ...prod };
        const precisaBuscarAdicionais = itemAtualizado.adicionais === undefined;
        const precisaBuscarVariacoes = itemAtualizado.variacoes === undefined;

        if (precisaBuscarAdicionais || precisaBuscarVariacoes) {
            const toastId = toast.loading("Carregando opções...", { autoClose: false });
            try {
                if (precisaBuscarAdicionais) {
                    const adicsSnap = await getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', prod.categoriaId, prod.tipoColecao, prod.id, 'adicionais'));
                    itemAtualizado.adicionais = adicsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                }
                if (precisaBuscarVariacoes) {
                    const varsSnap = await getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', prod.categoriaId, prod.tipoColecao, prod.id, 'variacoes'));
                    itemAtualizado.variacoes = varsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                }
                
                setCardapio(prev => prev.map(p => p.id === prod.id ? itemAtualizado : p));
                toast.dismiss(toastId);
            } catch (e) {
                console.error("Erro ao buscar subcoleções:", e);
                toast.dismiss(toastId);
            }
        }

        let itemEnriquecido = enrichWithGlobalAdicionais(itemAtualizado);
        
        // 🔥 Buscar variações para os adicionais globais que são produtos/itens e ainda não tem variações carregadas
        if (itemEnriquecido.adicionais && itemEnriquecido.adicionais.length > 0) {
            const toastIdAdics = toast.loading("Carregando extras...", { autoClose: false });
            try {
                const adicsPromises = itemEnriquecido.adicionais.map(async (adic) => {
                    if (adic.tipoColecao && !adic.variacoes && !adic.opcoes && !adic.itens) {
                        const varsSnap = await getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', adic.categoriaId, adic.tipoColecao, adic.id, 'variacoes'));
                        const variacoes = varsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                        return { ...adic, variacoes };
                    }
                    return adic;
                });
                itemEnriquecido.adicionais = await Promise.all(adicsPromises);
                toast.dismiss(toastIdAdics);
            } catch (e) {
                console.error("Erro ao buscar subcoleções dos adicionais:", e);
                toast.dismiss(toastIdAdics);
            }
        }

        const temOpcoes = (itemEnriquecido.opcoes && itemEnriquecido.opcoes.length > 0) || 
                          (itemEnriquecido.variacoes && itemEnriquecido.variacoes.length > 0) || 
                          (itemEnriquecido.tamanhos && itemEnriquecido.tamanhos.length > 0) || 
                          (itemEnriquecido.adicionais && itemEnriquecido.adicionais.length > 0);

        return { itemEnriquecido, itemAtualizado, temOpcoes };
    };

    const confirmarAdicaoAoCarrinho = async (itemConfig) => {
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

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
                   i.status !== 'cancelado' &&
                   mesmosAdics;
        });

        const toastConfigNinja = {
            position: "top-center", 
            autoClose: 800,         
            hideProgressBar: true,  
            closeButton: false,     
            theme: "dark",          
            style: { 
                borderRadius: '50px', 
                minHeight: '40px', 
                padding: '8px 20px', 
                fontWeight: '900', 
                fontSize: '13px', 
                textAlign: 'center',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
            }
        };

        if (indexExistente >= 0) {
            novaLista[indexExistente].quantidade += 1;
            novaLista[indexExistente].adicionadoPor = nomeGarcom;
            toast.success(`+1 ${nomeFinal}`, toastConfigNinja);
        } else {
            const novoItem = {
                ...restoDoItem,
                id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, 
                produtoIdOriginal: itemConfig.id, 
                categoriaId: itemConfig.categoriaId,
                categoria: itemConfig.categoria || '', 
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
            toast.success(`Adicionado: ${nomeFinal}`, toastConfigNinja);
        }

        setResumoPedido(novaLista);

        try {
            const novoTotal = novaLista.reduce((acc, i) => i.status === 'cancelado' ? acc : acc + (i.preco * i.quantidade), 0);
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), { 
                itens: novaLista,
                total: novoTotal,
                updatedAt: serverTimestamp()
            });
        } catch(e) { console.error(e); }
    };

    const confirmarNovaPessoa = async (novoNomeTemp) => {
        if (!novoNomeTemp.trim()) return false;
        const novoNome = novoNomeTemp.trim();
        const novosOcupantes = [...ocupantes, novoNome];
        setOcupantes(novosOcupantes); 
        setClienteSelecionado(novoNome); 

        try {
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), { 
                nomesOcupantes: novosOcupantes,
                updatedAt: serverTimestamp()
            });
        } catch (e) {
            console.error("Erro ao adicionar ocupante:", e);
        }
        
        return true;
    };

    const salvarEdicaoPessoa = async (index, novoNomeTemp) => {
        if (!novoNomeTemp.trim()) return false;
        const nomeAntigo = ocupantes[index];
        const novoNome = novoNomeTemp.trim();
        if (nomeAntigo === novoNome) return false;
        
        const novosOcupantes = [...ocupantes];
        novosOcupantes[index] = novoNome;
        setOcupantes(novosOcupantes);
        
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
            console.error("Erro ao editar ocupante:", e);
        }

        return true;
    };

    const confirmarExclusao = async (itemParaExcluir, qtdExcluir, senhaDigitada) => {
        if(senhaMasterEstabelecimento && senhaDigitada !== senhaMasterEstabelecimento) {
            toast.error("Senha errada");
            return false;
        }
        
        try {
            const functions = getFunctions();
            const cancelarItem = httpsCallable(functions, 'cancelarItemMesaBackend');
            
            const res = await cancelarItem({
                estabelecimentoId,
                mesaId,
                itemParaExcluir,
                qtdExcluir,
                mesaNumero: mesa?.numero
            });

            if (res.data?.success) {
                toast.info(res.data.cancelaInteiro ? "Item cancelado com sucesso!" : `${res.data.qtdRemover}x removido(s) com sucesso!`);
            }
        } catch (e) {
            console.error('[AUDIT] Erro ao cancelar item:', e);
            toast.error("Erro ao cancelar o item.");
            return false;
        }
        
        return true;
    };

    const ajustarQuantidade = async (id, qtd) => {
        if (navigator.vibrate) navigator.vibrate(20);
        const novaLista = resumoPedido.map(i => i.id === id ? { ...i, quantidade: qtd } : i).filter(i => i.quantidade > 0);
        setResumoPedido(novaLista);
        
        const novoTotal = novaLista.reduce((acc, i) => i.status === 'cancelado' ? acc : acc + (i.preco * i.quantidade), 0);
        
        try {
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), { 
                itens: novaLista,
                total: novoTotal,
                updatedAt: serverTimestamp()
            });
        } catch (e) {
            console.error("Erro ao ajustar quantidade:", e);
        }
    };

    const dispararImpressao = async (setor, onSucesso = () => {}, pedidoIdOverride = null) => {
        const toastId = toast.loading("Enviando sinal para o Caixa...");
        const nomeGarcom = userData?.nome || user?.displayName || "Garçom";
        try {
            const functions = getFunctions();
            const impressaoBackend = httpsCallable(functions, 'dispararImpressaoMesaBackend');
            
            await impressaoBackend({
                estabelecimentoId,
                mesaId,
                pedidoRecemEnviadoId: pedidoIdOverride !== null ? pedidoIdOverride : pedidoRecemEnviadoId,
                setor,
                nomeGarcom
            });
            
            toast.update(toastId, { render: `Impressão enviada com sucesso! ${setor ? `(${setor})` : ''} — ${nomeGarcom}`, type: "success", isLoading: false, autoClose: 2000 });
            onSucesso();
        } catch (error) {
            toast.update(toastId, { render: "Erro ao comunicar com o Caixa.", type: "error", isLoading: false, autoClose: 3000 });
        }
    };

    const salvarAlteracoes = async () => {
        setSalvando(true);
        try {
            const nomeGarcom = userData?.nome || user?.displayName || "Garçom";
            
            const functions = getFunctions();
            const salvarBackend = httpsCallable(functions, 'salvarPedidoMesaBackend');
            
            const payload = {
                estabelecimentoId,
                mesaId,
                resumoPedido,
                userDataNome: userData?.nome,
                userDisplayName: user?.displayName
            };

            const sanitizeNaNs = (obj) => {
                if (obj === null || obj === undefined) return obj;
                if (typeof obj === 'number' && Number.isNaN(obj)) return 0;
                
                if (obj instanceof Date) return obj.toISOString();
                if (typeof obj === 'object' && obj !== null) {
                    if (typeof obj.toDate === 'function') return obj.toDate().toISOString();
                    if (obj.seconds !== undefined && obj.nanoseconds !== undefined) return new Date(obj.seconds * 1000).toISOString();
                    if (obj._seconds !== undefined && obj._nanoseconds !== undefined) return new Date(obj._seconds * 1000).toISOString();
                }

                if (Array.isArray(obj)) return obj.map(sanitizeNaNs);
                if (typeof obj === 'object') {
                    const newObj = {};
                    for (const key in obj) {
                        newObj[key] = sanitizeNaNs(obj[key]);
                    }
                    return newObj;
                }
                return obj;
            };

            const cleanPayload = sanitizeNaNs(payload);

            const result = await salvarBackend(cleanPayload);

            toast.success("Pedido confirmado com sucesso!", { position: "top-center", autoClose: 2000, theme: "colored" });
            
            if (result.data && result.data.idPedidoGerado) {
                setPedidoRecemEnviadoId(result.data.idPedidoGerado);
            }

        } catch(error) { 
            console.error("Erro fatal ao salvar pedido:", error); 
            toast.error("Erro na internet! Tente novamente.", { position: "top-center", theme: "colored", autoClose: 4000 }); 
        } finally { 
            setSalvando(false); 
        }
    };

    return {
        // Variáveis de Estado Principal
        loading,
        mesa,
        categoriasOrdenadas,
        produtosFiltrados,
        coresEstabelecimento,
        senhaMasterEstabelecimento,
        tipoNegocio,
        
        // Estados Voláteis (Carrinho / Busca)
        resumoPedido,
        quantidadesNoCarrinho,
        itensAgrupados,
        totalGeral,
        totalItens,
        temItensPendentes,
        ocupantes,
        clienteSelecionado, setClienteSelecionado,
        termoBusca, setTermoBusca,
        categoriaAtiva, setCategoriaAtiva,
        salvando,
        pedidoRecemEnviadoId,
        pedidosEnviados,
        
        // Funções de Negócio Embutidas
        prepararProdutoParaSelecao,
        confirmarAdicaoAoCarrinho,
        confirmarNovaPessoa,
        salvarEdicaoPessoa,
        confirmarExclusao,
        ajustarQuantidade,
        dispararImpressao,
        salvarAlteracoes
    };
}
