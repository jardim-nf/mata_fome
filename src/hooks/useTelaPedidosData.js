import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../firebase';
import { 
    doc, getDoc, collection, getDocs, onSnapshot, updateDoc, 
    serverTimestamp, writeBatch, addDoc, query, orderBy, limit
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import { toast as rtToast } from 'react-toastify';

const hasRealVariations = (item) => {
    return Array.isArray(item?.variacoes) && (
        item.variacoes.length > 1 || 
        (item.variacoes.length === 1 && 
         item.variacoes[0]?.nome !== 'Padrão' && 
         item.variacoes[0]?.nome !== 'PADRÃO' && 
         item.variacoes[0]?.nome?.trim() !== '')
    );
};

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
        className: `mf-toast mf-toast-${type} ${opts?.className || ''}`,
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
            whiteSpace: 'nowrap',
            wordBreak: 'keep-all',
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
import { getTerminology } from '../utils/terminologyUtils';

const normalizarTexto = (texto) => {
    if (!texto) return '';
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

const formatarErroEstoque = (msg) => {
    if (!msg) return "Sem estoque disponível para este item.";
    if (msg.includes("Estoque insuficiente para") || msg.includes("insuficiente para o produto")) {
        const prodMatch = msg.match(/produto "([^"]+)"/);
        const varMatch = msg.match(/\(Variação: "([^"]+)"\)/);
        const estoqueMatch = msg.match(/(?:Estoque atual|Estoque disponível):\s*(\d+)/);
        
        const produto = prodMatch ? prodMatch[1] : "";
        const variacao = varMatch ? varMatch[1] : "";
        const estoqueQtd = estoqueMatch ? parseInt(estoqueMatch[1], 10) : 0;
        
        const itemNome = variacao ? `${produto} (${variacao})` : produto;
        
        if (estoqueQtd <= 0) {
            return `🚫 Desculpe! "${itemNome}" está totalmente esgotado no estoque.`;
        } else {
            return `⚠️ Ops! Estoque insuficiente para "${itemNome}". Temos apenas ${estoqueQtd} unidade(s) disponível(is).`;
        }
    }
    return msg;
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

const deepSanitizeNaN = (obj) => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'number') {
        return Number.isNaN(obj) ? 0 : obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => deepSanitizeNaN(item));
    }
    if (typeof obj === 'object') {
        const clean = {};
        for (const [key, val] of Object.entries(obj)) {
            clean[key] = deepSanitizeNaN(val);
        }
        return clean;
    }
    return obj;
};

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
    const [roteamentoImpressao, setRoteamentoImpressao] = useState({});

    // Estados Voláteis (Controlados pelo Banco em tempo real e UI)
    const [resumoPedido, setResumoPedido] = useState([]);
    const [ocupantes, setOcupantes] = useState(['Mesa']);
    const [clienteSelecionado, setClienteSelecionado] = useState('Mesa');
    
    const [termoBusca, setTermoBusca] = useState('');
    const [categoriaAtiva, setCategoriaAtiva] = useState('Todos');
    const [salvando, setSalvando] = useState(false);
    const [pedidoRecemEnviadoId, setPedidoRecemEnviadoId] = useState(null);
    const [triggerRecarregar, setTriggerRecarregar] = useState(0);

    const hasHydratedFromCache = useRef(false);

    const recarregar = () => {
        hasHydratedFromCache.current = false;
        setTriggerRecarregar(prev => prev + 1);
    };

    // Cache local de subcoleções (variações/adicionais) para evitar chamadas de rede repetidas
    const subcollectionsCache = useRef({
        adicionais: {},
        variacoes: {},
        adicVariacoes: {}
    });

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
            if (cached.roteamentoImpressao) setRoteamentoImpressao(cached.roteamentoImpressao);
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

                let roteamentoUpdate = null;

                if (estabSnap.exists()) {
                    const dados = estabSnap.data();
                    if (dados.cores) coresUpdate = dados.cores;
                    if (dados.ordemCategorias) ordemUpdate = dados.ordemCategorias;
                    if (dados.senhaMaster) senhaUpdate = String(dados.senhaMaster);
                    if (dados.tipoNegocio) tipoNegocioUpdate = dados.tipoNegocio;
                    if (dados.roteamentoImpressao) roteamentoUpdate = dados.roteamentoImpressao;
                }

                if (!isMounted) return;
                if (coresUpdate) setCoresEstabelecimento(prev => ({ ...prev, ...coresUpdate }));
                if (ordemUpdate) setOrdemCategorias(ordemUpdate);
                if (senhaUpdate) setSenhaMasterEstabelecimento(senhaUpdate);
                if (tipoNegocioUpdate) setTipoNegocio(tipoNegocioUpdate);
                if (roteamentoUpdate) setRoteamentoImpressao(roteamentoUpdate);

                const [categoriasSnap, pedidosSnap] = await Promise.all([
                    getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio')),
                    getDocs(query(
                        collection(db, 'estabelecimentos', estabelecimentoId, 'pedidos'),
                        orderBy('createdAt', 'desc'),
                        limit(150)
                    )).catch(() => ({ docs: [] }))
                ]);

                const vendasContagem = {};
                if (pedidosSnap && pedidosSnap.docs) {
                    pedidosSnap.docs.forEach(docPed => {
                        const ped = docPed.data();
                        if (ped.status === 'cancelado') return;
                        (ped.itens || []).forEach(item => {
                            const nomeItem = item.nome;
                            const idItem = item.produtoIdOriginal || item.id;
                            if (idItem) {
                                vendasContagem[idItem] = (vendasContagem[idItem] || 0) + (item.quantidade || 1);
                            }
                            if (nomeItem) {
                                vendasContagem[nomeItem] = (vendasContagem[nomeItem] || 0) + (item.quantidade || 1);
                            }
                        });
                    });
                }

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
                        .map(docItem => {
                            const dados = docItem.data();
                            const totalVendido = (vendasContagem[docItem.id] || 0) + (vendasContagem[dados.nome] || 0);
                            return {
                                ...dados,
                                id: docItem.id,
                                categoria: cat.nome,
                                categoriaId: cat.id,
                                tipoColecao: itensSnap.docs.some(i => i.id === docItem.id) ? 'itens' : 'produtos',
                                totalVendido
                            };
                        });
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
                    roteamentoImpressao: roteamentoUpdate || {},
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
    }, [estabelecimentoId, triggerRecarregar]);

    // Prefetch de subcoleções em segundo plano para o MacBook / outros dispositivos (desativado em mobile para economizar processamento e cota Firestore)
    useEffect(() => {
        if (loading || !cardapio || cardapio.length === 0 || !estabelecimentoId) return;
        
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        if (isMobileDevice) return;

        let isMounted = true;
        
        const prefetchSubcollections = async () => {
            // 1. Prefetch sequencial para não estourar conexões
            for (const prod of cardapio) {
                if (!isMounted) break;
                
                const hasAdics = prod.adicionais !== undefined || subcollectionsCache.current.adicionais[prod.id] !== undefined;
                const hasVars = prod.variacoes !== undefined || subcollectionsCache.current.variacoes[prod.id] !== undefined;
                
                if (hasAdics && hasVars) continue;
                
                try {
                    let adics = prod.adicionais;
                    let vars = prod.variacoes;
                    
                    if (adics === undefined && subcollectionsCache.current.adicionais[prod.id] === undefined) {
                        const adicsSnap = await getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', prod.categoriaId, prod.tipoColecao, prod.id, 'adicionais'));
                        adics = adicsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                        subcollectionsCache.current.adicionais[prod.id] = adics;
                    }
                    
                    if (vars === undefined && subcollectionsCache.current.variacoes[prod.id] === undefined) {
                        const varsSnap = await getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', prod.categoriaId, prod.tipoColecao, prod.id, 'variacoes'));
                        vars = varsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                        subcollectionsCache.current.variacoes[prod.id] = vars;
                    }
                    
                    if (isMounted) {
                        setCardapio(prev => prev.map(p => p.id === prod.id ? { ...p, adicionais: adics, variacoes: vars } : p));
                    }
                } catch (e) {
                    console.warn(`Erro no prefetch do produto ${prod.id}:`, e);
                }
            }

            // 2. Prefetch de variações de adicionais globais
            const termosAdicionais = ['adicionais', 'adicional', 'extra', 'extras', 'complemento', 'complementos', 'acrescimo', 'acrescimos', 'molho', 'molhos', 'opcoes', 'opções'];
            const globais = cardapio.filter(p => {
                const cat = normalizarTexto(p.categoria || '');
                const palavras = cat.split(/[^a-z0-9]+/);
                return termosAdicionais.some(termo => palavras.includes(termo));
            });

            for (const adic of globais) {
                if (!isMounted) break;
                if (!adic.tipoColecao || adic.opcoes || adic.itens) continue;
                
                const hasAdicVars = adic.variacoes !== undefined || subcollectionsCache.current.adicVariacoes[adic.id] !== undefined;
                if (hasAdicVars) continue;

                try {
                    const varsSnap = await getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', adic.categoriaId, adic.tipoColecao, adic.id, 'variacoes'));
                    const vList = varsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    
                    subcollectionsCache.current.adicVariacoes[adic.id] = vList;
                    
                    if (isMounted) {
                        setCardapio(prev => prev.map(p => p.id === adic.id ? { ...p, variacoes: vList } : p));
                    }
                } catch (e) {
                    console.warn(`Erro no prefetch do adicional ${adic.id}:`, e);
                }
            }
        };

        const timer = setTimeout(prefetchSubcollections, 1000);
        return () => { isMounted = false; clearTimeout(timer); };
    }, [cardapio.length, loading, estabelecimentoId]);

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
        const filtrados = cardapio.filter(p =>
            (!termoBusca || (p.nome || '').toLowerCase().includes((termoBusca || '').toLowerCase())) &&
            (categoriaAtiva === 'Todos' || p.categoria === categoriaAtiva)
        );

        return [...filtrados].sort((a, b) => {
            const vendasA = a.totalVendido || 0;
            const vendasB = b.totalVendido || 0;
            if (vendasB !== vendasA) {
                return vendasB - vendasA;
            }
            return (a.nome || '').localeCompare(b.nome || '');
        });
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
                    adicionadoPor: item.adicionadoPor || item.funcionario || getTerminology('garcom', tipoNegocio),
                    itens: []
                };
            }
            grupos[pedId].itens.push(item);
        });

        const getTimestamp = (val) => {
            if (!val) return 0;
            if (val.toDate) return val.toDate().getTime();
            if (val.seconds !== undefined) return val.seconds * 1000;
            if (val._seconds !== undefined) return val._seconds * 1000;
            const d = new Date(val);
            if (!isNaN(d.getTime())) return d.getTime();
            
            if (typeof val === 'string') {
                const match = val.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
                if (match) {
                    const day = parseInt(match[1], 10);
                    const month = parseInt(match[2], 10) - 1;
                    const year = parseInt(match[3], 10);
                    const hour = match[4] ? parseInt(match[4], 10) : 0;
                    const minute = match[5] ? parseInt(match[5], 10) : 0;
                    const second = match[6] ? parseInt(match[6], 10) : 0;
                    const dBr = new Date(year, month, day, hour, minute, second);
                    if (!isNaN(dBr.getTime())) return dBr.getTime();
                }
            }
            return 0;
        };

        return Object.values(grupos).sort((a, b) => {
            const timeA = getTimestamp(a.adicionadoEm);
            const timeB = getTimestamp(b.adicionadoEm);
            return timeB - timeA;
        });
    }, [resumoPedido]);

    // Função interna para checar subcoleções e enriquecer
    const prepararProdutoParaSelecao = useCallback(async (prod) => {
        let itemAtualizado = { ...prod };
        
        let adicionais = itemAtualizado.adicionais;
        let variacoes = itemAtualizado.variacoes;
        
        if (adicionais === undefined) {
            adicionais = subcollectionsCache.current.adicionais[prod.id];
        }
        if (variacoes === undefined) {
            variacoes = subcollectionsCache.current.variacoes[prod.id];
        }

        const precisaBuscarAdicionais = adicionais === undefined;
        const precisaBuscarVariacoes = variacoes === undefined;

        if (precisaBuscarAdicionais || precisaBuscarVariacoes) {
            try {
                if (precisaBuscarAdicionais) {
                    const adicsSnap = await getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', prod.categoriaId, prod.tipoColecao, prod.id, 'adicionais'));
                    adicionais = adicsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    subcollectionsCache.current.adicionais[prod.id] = adicionais;
                }
                if (precisaBuscarVariacoes) {
                    const varsSnap = await getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', prod.categoriaId, prod.tipoColecao, prod.id, 'variacoes'));
                    variacoes = varsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    subcollectionsCache.current.variacoes[prod.id] = variacoes;
                }
                
                itemAtualizado.adicionais = adicionais;
                itemAtualizado.variacoes = variacoes;
                
                setCardapio(prev => prev.map(p => p.id === prod.id ? itemAtualizado : p));
            } catch (e) {
                console.error("Erro ao buscar subcoleções:", e);
            }
        } else {
            itemAtualizado.adicionais = adicionais;
            itemAtualizado.variacoes = variacoes;
        }

        let itemEnriquecido = enrichWithGlobalAdicionais(itemAtualizado);
        
        // 2. Buscar variações para os adicionais globais
        if (itemEnriquecido.adicionais && itemEnriquecido.adicionais.length > 0) {
            const adicsQuePrecisamDeBusca = itemEnriquecido.adicionais.filter(adic => 
                adic.tipoColecao && 
                adic.variacoes === undefined && 
                subcollectionsCache.current.adicVariacoes[adic.id] === undefined &&
                !adic.opcoes && 
                !adic.itens
            );

            if (adicsQuePrecisamDeBusca.length > 0) {
                try {
                    const updatesCardapio = {};
                    
                    await Promise.all(adicsQuePrecisamDeBusca.map(async (adic) => {
                        const varsSnap = await getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', adic.categoriaId, adic.tipoColecao, adic.id, 'variacoes'));
                        const vList = varsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                        
                        subcollectionsCache.current.adicVariacoes[adic.id] = vList;
                        updatesCardapio[adic.id] = vList;
                    }));

                    // Atualiza o cardapio global com as variações dos adicionais
                    setCardapio(prev => prev.map(p => {
                        if (updatesCardapio[p.id] !== undefined) {
                            return { ...p, variacoes: updatesCardapio[p.id] };
                        }
                        return p;
                    }));
                } catch (e) {
                    console.error("Erro ao buscar subcoleções dos adicionais:", e);
                }
            }

            // Mapear as variações resolvidas do cache/estado para cada adicional
            itemEnriquecido.adicionais = itemEnriquecido.adicionais.map(adic => {
                let vList = adic.variacoes;
                if (vList === undefined) {
                    vList = subcollectionsCache.current.adicVariacoes[adic.id] || [];
                }
                return { ...adic, variacoes: vList };
            });
        }

        const temOpcoes = (itemEnriquecido.opcoes && itemEnriquecido.opcoes.length > 0) || 
                          hasRealVariations(itemEnriquecido) || 
                          (itemEnriquecido.tamanhos && itemEnriquecido.tamanhos.length > 0) || 
                          (itemEnriquecido.adicionais && itemEnriquecido.adicionais.length > 0);

        return { itemEnriquecido, itemAtualizado: itemEnriquecido, temOpcoes };
    }, [estabelecimentoId, enrichWithGlobalAdicionais]);

    const confirmarAdicaoAoCarrinho = useCallback(async (itemConfig) => {
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

        const nomeGarcom = userData?.nome || user?.displayName || getTerminology('garcom', tipoNegocio);
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
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                whiteSpace: 'nowrap',
                wordBreak: 'keep-all'
            }
        };

        // Validação local de estoque
        if (itemConfig.controlaEstoque === true) {
            let estoqueDisponivel = 0;
            if (variacaoSelecionada) {
                const vMatch = itemConfig.variacoes?.find(v => v.id === variacaoSelecionada.id);
                estoqueDisponivel = vMatch ? (Number(vMatch.estoque) || 0) : 0;
            } else {
                estoqueDisponivel = Number(itemConfig.estoque) || 0;
            }

            // Conta quantos deste item (e variação) já estão pendentes no resumoPedido
            const qtdNoCarrinho = resumoPedido.reduce((acc, i) => {
                if (i.produtoIdOriginal === itemConfig.id && i.status === 'pendente') {
                    if (variacaoSelecionada) {
                        return i.variacaoSelecionada?.id === variacaoSelecionada.id ? acc + i.quantidade : acc;
                    } else {
                        return acc + i.quantidade;
                    }
                }
                return acc;
            }, 0);

            if (qtdNoCarrinho + 1 > estoqueDisponivel) {
                toast.error(`Estoque insuficiente! Disponível: ${estoqueDisponivel}`);
                return;
            }
        }

        let itemId;
        if (indexExistente >= 0) {
            novaLista[indexExistente].quantidade += 1;
            novaLista[indexExistente].adicionadoPor = nomeGarcom;
            novaLista[indexExistente]._estoqueBaixado = false;
            itemId = novaLista[indexExistente].id;
            toast.success(`+1 ${nomeFinal}`, toastConfigNinja);
        } else {
            itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const novoItem = {
                ...restoDoItem,
                id: itemId, 
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
                variacaoSelecionada: variacaoSelecionada || null,
                _estoqueBaixado: false
            };
            novaLista.push(novoItem);
            toast.success(`Adicionado: ${nomeFinal}`, toastConfigNinja);
        }

        const sanitizedLista = deepSanitizeNaN(novaLista);
        setResumoPedido(sanitizedLista);

        try {
            const novoTotal = sanitizedLista.reduce((acc, i) => i.status === 'cancelado' ? acc : acc + (i.preco * i.quantidade), 0);
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), { 
                itens: sanitizedLista,
                total: novoTotal,
                updatedAt: serverTimestamp()
            });
        } catch(e) { 
            console.error(e); 
        }

        // Disparar reserva de estoque no background
        const itemParaBaixa = {
            id: itemConfig.id,
            categoriaId: itemConfig.categoriaId,
            variacaoId: variacaoSelecionada?.id || null,
            quantidade: 1,
            tipoColecao: itemConfig.tipoColecao || 'itens'
        };

        const functions = getFunctions();
        const processarBaixaEstoqueFn = httpsCallable(functions, 'processarBaixaEstoque');

        processarBaixaEstoqueFn({
            estabelecimentoId,
            itens: [itemParaBaixa],
            operacao: 'saida'
        }).then(async () => {
            try {
                const mesaDocRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
                const snap = await getDoc(mesaDocRef);
                if (snap.exists()) {
                    const currentItens = snap.data().itens || [];
                    const updatedItens = currentItens.map(i => i.id === itemId ? { ...i, _estoqueBaixado: true } : i);
                    await updateDoc(mesaDocRef, { itens: updatedItens });
                }
            } catch (err) {
                console.error("Erro ao atualizar _estoqueBaixado após sucesso:", err);
            }
        }).catch(async (error) => {
            console.error("Erro ao baixar estoque em background:", error);
            const errMsg = formatarErroEstoque(error.message);
            toast.error(`Falha ao reservar estoque: ${errMsg}`);

            try {
                const mesaDocRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
                const snap = await getDoc(mesaDocRef);
                if (snap.exists()) {
                    const currentItens = snap.data().itens || [];
                    const targetItem = currentItens.find(i => i.id === itemId);
                    let updatedItens;
                    if (targetItem && targetItem.quantidade > 1) {
                        updatedItens = currentItens.map(i => i.id === itemId ? { ...i, quantidade: i.quantidade - 1 } : i);
                    } else {
                        updatedItens = currentItens.filter(i => i.id !== itemId);
                    }
                    const novoTotal = updatedItens.reduce((acc, i) => i.status === 'cancelado' ? acc : acc + (i.preco * i.quantidade), 0);
                    await updateDoc(mesaDocRef, { 
                        itens: updatedItens,
                        total: novoTotal,
                        updatedAt: serverTimestamp()
                    });
                }
            } catch (err) {
                console.error("Erro ao reverter item da comanda:", err);
            }
        });
    }, [estabelecimentoId, mesaId, userData, user, tipoNegocio, resumoPedido, clienteSelecionado]);

    const confirmarNovaPessoa = useCallback(async (novoNomeTemp) => {
        if (!novoNomeTemp.trim()) return false;
        const novoNome = novoNomeTemp.trim();

        // Check for duplicates
        const existe = ocupantes.some(n => n.toLowerCase() === novoNome.toLowerCase());
        if (existe) {
            toast.error("Este nome já está na mesa.");
            return false;
        }

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
    }, [estabelecimentoId, mesaId, ocupantes]);

    const salvarEdicaoPessoa = useCallback(async (index, novoNomeTemp) => {
        if (!novoNomeTemp.trim()) return false;
        const nomeAntigo = ocupantes[index];
        const novoNome = novoNomeTemp.trim();
        if (nomeAntigo === novoNome) return false;

        // Check for duplicates (excluding current index)
        const existe = ocupantes.some((n, idx) => idx !== index && n.toLowerCase() === novoNome.toLowerCase());
        if (existe) {
            toast.error("Este nome já está na mesa.");
            return false;
        }
        
        const novosOcupantes = [...ocupantes];
        novosOcupantes[index] = novoNome;
        setOcupantes(novosOcupantes);
        
        if (clienteSelecionado === nomeAntigo) setClienteSelecionado(novoNome);
        
        const novosItens = resumoPedido.map(i => (i.cliente === nomeAntigo ? { ...i, cliente: novoNome } : i));
        const sanitizedItens = deepSanitizeNaN(novosItens);
        setResumoPedido(sanitizedItens);
        
        try {
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), { 
                nomesOcupantes: novosOcupantes,
                itens: sanitizedItens,
                updatedAt: serverTimestamp()
            });
        } catch (e) {
            console.error("Erro ao editar ocupante:", e);
        }

        return true;
    }, [estabelecimentoId, mesaId, ocupantes, clienteSelecionado, resumoPedido]);

    const excluirPessoa = useCallback(async (nomeParaDeletar) => {
        if (nomeParaDeletar === 'Mesa') return false;

        const novosOcupantes = ocupantes.filter(n => n !== nomeParaDeletar);
        setOcupantes(novosOcupantes);

        if (clienteSelecionado === nomeParaDeletar) {
            setClienteSelecionado('Mesa');
        }

        const novosItens = resumoPedido.map(i => (i.cliente === nomeParaDeletar ? { ...i, cliente: 'Mesa' } : i));
        const sanitizedItens = deepSanitizeNaN(novosItens);
        setResumoPedido(sanitizedItens);

        try {
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), { 
                nomesOcupantes: novosOcupantes,
                itens: sanitizedItens,
                updatedAt: serverTimestamp()
            });
            toast.info(`Cliente "${nomeParaDeletar}" removido da mesa.`);
        } catch (e) {
            console.error("Erro ao excluir ocupante:", e);
            toast.error("Erro ao remover cliente.");
        }

        return true;
    }, [estabelecimentoId, mesaId, ocupantes, clienteSelecionado, resumoPedido]);

    const confirmarExclusao = useCallback(async (itemParaExcluir, qtdExcluir, senhaDigitada) => {
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
    }, [estabelecimentoId, mesaId, senhaMasterEstabelecimento, mesa?.numero]);

    const ajustarQuantidade = useCallback(async (id, qtd) => {
        const itemObj = resumoPedido.find(i => i.id === id);
        if (!itemObj) return;

        const oldQtd = itemObj.quantidade || 0;
        const diff = qtd - oldQtd;
        if (diff === 0) return;

        if (navigator.vibrate) navigator.vibrate(20);

        // Validação local de estoque
        const prodNoCardapio = cardapio.find(p => p.id === itemObj.produtoIdOriginal);
        if (prodNoCardapio && prodNoCardapio.controlaEstoque === true) {
            let estoqueDisponivel = 0;
            if (itemObj.variacaoSelecionada) {
                const vMatch = prodNoCardapio.variacoes?.find(v => v.id === itemObj.variacaoSelecionada.id);
                estoqueDisponivel = vMatch ? (Number(vMatch.estoque) || 0) : 0;
            } else {
                estoqueDisponivel = Number(prodNoCardapio.estoque) || 0;
            }

            // Conta quantos do mesmo produto (e variação) já estão no resumoPedido (excluindo este para comparar)
            const outrosItensQtd = resumoPedido.reduce((acc, i) => {
                if (i.id !== id && i.produtoIdOriginal === itemObj.produtoIdOriginal && i.status === 'pendente') {
                    if (itemObj.variacaoSelecionada) {
                        return i.variacaoSelecionada?.id === itemObj.variacaoSelecionada.id ? acc + i.quantidade : acc;
                    } else {
                        return acc + i.quantidade;
                    }
                }
                return acc;
            }, 0);

            if (outrosItensQtd + qtd > estoqueDisponivel) {
                toast.error(`Estoque insuficiente! Disponível: ${estoqueDisponivel}`);
                return;
            }
        }

        const novaLista = resumoPedido.map(i => {
            if (i.id === id) {
                const novoEstoqueBaixado = diff > 0 ? false : i._estoqueBaixado;
                return { ...i, ...i, quantidade: qtd, _estoqueBaixado: novoEstoqueBaixado };
            }
            return i;
        }).filter(i => i.quantidade > 0);
        const sanitizedLista = deepSanitizeNaN(novaLista);
        setResumoPedido(sanitizedLista);
        
        const novoTotal = sanitizedLista.reduce((acc, i) => i.status === 'cancelado' ? acc : acc + (i.preco * i.quantidade), 0);
        
        try {
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), { 
                itens: sanitizedLista,
                total: novoTotal,
                updatedAt: serverTimestamp()
            });
        } catch (e) {
            console.error("Erro ao ajustar quantidade:", e);
        }

        // Disparar reserva/estorno de estoque no background apenas se necessário
        const precisaEstorno = diff < 0 && (itemObj._estoqueBaixado === true || itemObj._estoqueBaixadoAoPagar === true);
        const precisaProcessar = diff > 0 || precisaEstorno;

        if (precisaProcessar) {
            const itemParaBaixa = {
                id: itemObj.produtoIdOriginal || itemObj.id,
                categoriaId: itemObj.categoriaId,
                variacaoId: itemObj.variacaoSelecionada?.id || null,
                quantidade: Math.abs(diff),
                tipoColecao: itemObj.tipoColecao || 'itens'
            };

            const functions = getFunctions();
            const processarBaixaEstoqueFn = httpsCallable(functions, 'processarBaixaEstoque');

            processarBaixaEstoqueFn({
                estabelecimentoId,
                itens: [itemParaBaixa],
                operacao: diff > 0 ? 'saida' : 'entrada'
            }).then(async () => {
                if (diff > 0) {
                    try {
                        const mesaDocRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
                        const snap = await getDoc(mesaDocRef);
                        if (snap.exists()) {
                            const currentItens = snap.data().itens || [];
                            const updatedItens = currentItens.map(i => i.id === id ? { ...i, _estoqueBaixado: true } : i);
                            await updateDoc(mesaDocRef, { itens: updatedItens });
                        }
                    } catch (err) {
                        console.error("Erro ao atualizar _estoqueBaixado em ajuste:", err);
                    }
                }
            }).catch(async (error) => {
                console.error("Erro ao processar estoque no ajuste em background:", error);
                const errMsg = formatarErroEstoque(error.message);
                toast.error(`Falha ao alterar estoque: ${errMsg}`);

                try {
                    const mesaDocRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
                    const snap = await getDoc(mesaDocRef);
                    if (snap.exists()) {
                        const currentItens = snap.data().itens || [];
                        const updatedItens = currentItens.map(i => {
                            if (i.id === id) {
                                return { ...i, quantidade: oldQtd, _estoqueBaixado: itemObj._estoqueBaixado };
                            }
                            return i;
                        }).filter(i => i.quantidade > 0);
                        
                        const novoTotal = updatedItens.reduce((acc, i) => i.status === 'cancelado' ? acc : acc + (i.preco * i.quantidade), 0);
                        await updateDoc(mesaDocRef, { 
                            itens: updatedItens,
                            total: novoTotal,
                            updatedAt: serverTimestamp()
                        });
                    }
                } catch (err) {
                    console.error("Erro ao reverter ajuste de quantidade:", err);
                }
            });
        }
    }, [estabelecimentoId, mesaId, resumoPedido, cardapio]);

    const dispararImpressao = useCallback(async (setor, onSucesso = () => {}, pedidoIdOverride = null) => {
        const toastId = toast.loading("Enviando sinal para o Caixa...");
        const nomeGarcom = userData?.nome || user?.displayName || getTerminology('garcom', tipoNegocio);
        try {
            const targetPedidoId = pedidoIdOverride !== null ? pedidoIdOverride : pedidoRecemEnviadoId;
            
            if (targetPedidoId) {
                const pedidoRef = doc(db, 'estabelecimentos', estabelecimentoId, 'pedidos', targetPedidoId);
                await updateDoc(pedidoRef, {
                    solicitarImpressao: true,
                    setorImpressao: setor || 'tudo',
                    impressaoSolicitadaPor: nomeGarcom || 'Garçom',
                    impressaoSolicitadaEm: serverTimestamp()
                });
            } else {
                const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
                await updateDoc(mesaRef, {
                    solicitarImpressaoConferencia: true,
                    setorImpressao: setor || 'tudo',
                    impressaoSolicitadaPor: nomeGarcom || 'Garçom',
                    impressaoSolicitadaEm: serverTimestamp()
                });
            }
            
            toast.update(toastId, { render: `Sinal enviado com sucesso! ${setor ? `(${setor})` : ''}`, type: "success", isLoading: false, autoClose: 1200 });
            onSucesso();
        } catch (error) {
            console.error("Erro ao enviar sinal de impressao:", error);
            toast.update(toastId, { render: "Erro ao enviar sinal.", type: "error", isLoading: false, autoClose: 2000 });
        }
    }, [estabelecimentoId, mesaId, userData, user, tipoNegocio, pedidoRecemEnviadoId]);

    const salvarAlteracoes = useCallback(async () => {
        setSalvando(true);
        try {
            const nomeGarcom = userData?.nome || user?.displayName || getTerminology('garcom', tipoNegocio);
            
            const sanitizeItem = (item) => {
                const clean = { ...item };
                if (clean.preco === undefined || Number.isNaN(clean.preco)) clean.preco = 0;
                if (clean.quantidade === undefined || Number.isNaN(clean.quantidade)) clean.quantidade = 1;
                
                // Tratar datas do Firebase e JS
                if (clean.adicionadoEm) {
                    if (typeof clean.adicionadoEm.toDate === 'function') {
                        clean.adicionadoEm = clean.adicionadoEm.toDate();
                    } else if (clean.adicionadoEm.seconds !== undefined) {
                        clean.adicionadoEm = new Date(clean.adicionadoEm.seconds * 1000);
                    } else if (clean.adicionadoEm._seconds !== undefined) {
                        clean.adicionadoEm = new Date(clean.adicionadoEm._seconds * 1000);
                    } else if (!(clean.adicionadoEm instanceof Date)) {
                        let d = new Date(clean.adicionadoEm);
                        if (isNaN(d.getTime()) && typeof clean.adicionadoEm === 'string') {
                            // Tentar parsear formato brasileiro DD/MM/YYYY HH:mm:ss ou DD/MM/YYYY HH:mm
                            const match = clean.adicionadoEm.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
                            if (match) {
                                const day = parseInt(match[1], 10);
                                const month = parseInt(match[2], 10) - 1;
                                const year = parseInt(match[3], 10);
                                const hour = match[4] ? parseInt(match[4], 10) : 0;
                                const minute = match[5] ? parseInt(match[5], 10) : 0;
                                const second = match[6] ? parseInt(match[6], 10) : 0;
                                d = new Date(year, month, day, hour, minute, second);
                            }
                        }
                        clean.adicionadoEm = isNaN(d.getTime()) ? new Date() : d;
                    }
                } else {
                    clean.adicionadoEm = new Date();
                }
                
                if (clean.adicionaisSelecionados) {
                    clean.adicionaisSelecionados = clean.adicionaisSelecionados.map(a => {
                        const cleanA = { ...a };
                        if (cleanA.preco === undefined || Number.isNaN(cleanA.preco)) cleanA.preco = 0;
                        return cleanA;
                    });
                }
                return clean;
            };

            const cleanResumoPedido = deepSanitizeNaN(resumoPedido.map(item => {
                const clean = sanitizeItem(item);
                if (clean.adicionadoEm instanceof Date && !isNaN(clean.adicionadoEm.getTime())) {
                    clean.adicionadoEm = clean.adicionadoEm.toISOString();
                } else {
                    clean.adicionadoEm = new Date().toISOString();
                }
                return clean;
            }));
            
            const functions = getFunctions();
            const salvarPedidoMesaBackendFn = httpsCallable(functions, 'salvarPedidoMesaBackend');
            const res = await salvarPedidoMesaBackendFn({
                estabelecimentoId,
                mesaId,
                resumoPedido: cleanResumoPedido,
                userDataNome: nomeGarcom,
                userDisplayName: user?.displayName
            });

            const idPedidoGerado = res.data?.idPedidoGerado || null;

            toast.success("Pedido confirmado com sucesso!", { position: "top-center", autoClose: 2000, theme: "colored" });
            
            if (idPedidoGerado) {
                setPedidoRecemEnviadoId(idPedidoGerado);
            } else {
                // Retorna à visualização do painel
                navigate('/painel');
            }
        } catch(error) { 
            console.error("Erro fatal ao salvar pedido:", error); 
            const errMsg = formatarErroEstoque(error.message || "Erro ao salvar o pedido. Tente novamente.");
            toast.error(errMsg, { position: "top-center", theme: "colored", autoClose: 4000 }); 
        } finally { 
            setSalvando(false); 
        }
    }, [estabelecimentoId, mesaId, userData, user, tipoNegocio, resumoPedido, navigate]);

    return {
        // Variáveis de Estado Principal
        loading,
        mesa,
        categoriasOrdenadas,
        produtosFiltrados,
        coresEstabelecimento,
        senhaMasterEstabelecimento,
        tipoNegocio,
        roteamentoImpressao,
        
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
        excluirPessoa,
        confirmarExclusao,
        ajustarQuantidade,
        dispararImpressao,
        salvarAlteracoes,
        recarregar
    };
}
