import { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs, onSnapshot } from 'firebase/firestore';

const CACHE_KEY = 'mf_pdv_cache_';
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
        // ignora erro de limite de quota
    }
}

export function usePdvProducts(estabelecimentoAtivo) {
    const [produtos, setProdutos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [carregandoProdutos, setCarregandoProdutos] = useState(true);
    const [categoriaAtiva, setCategoriaAtiva] = useState('todos');
    const [busca, setBusca] = useState('');
    const [triggerRecarregar, setTriggerRecarregar] = useState(0);

    const hasHydratedFromCache = useRef(false);

    const recarregar = () => {
        hasHydratedFromCache.current = false;
        setTriggerRecarregar(prev => prev + 1);
    };

    useEffect(() => {
        if (!estabelecimentoAtivo) return;
        
        let isMounted = true;

        const carregarMenu = async () => {
            // SWR: Tenta carregar do cache primeiro
            const cached = getCachedData(estabelecimentoAtivo);
            
            if (cached && !hasHydratedFromCache.current) {
                hasHydratedFromCache.current = true;
                setCategorias(cached.categorias);
                setProdutos(cached.produtos);
                setCarregandoProdutos(false);
                
                // Se o cache for fresco e não foi forçado o recarregar, não faz requisição de fundo
                if (Date.now() - (cached._cachedAt || 0) < CACHE_TTL) {
                    return; 
                }
            } else if (!cached) {
                setCarregandoProdutos(true);
            }

            try {
                const qCat = query(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'cardapio'), orderBy('ordem', 'asc'));
                const catsSnapshot = await getDocs(qCat);
                
                const cArray = catsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                const novasCategorias = [{ id: 'todos', name: 'Todos' }, ...cArray.map(x => ({ id: x.nome || x.id, name: x.nome || x.id }))];
                
                if (cArray.length === 0) {
                    if (isMounted) {
                        setCategorias(novasCategorias);
                        setProdutos([]);
                        setCarregandoProdutos(false);
                    }
                    return;
                }

                // Busca paralela otimizada (Promise.all)
                const categoryPromises = cArray.map(async (k) => {
                    const itemsRef = collection(db, 'estabelecimentos', estabelecimentoAtivo, 'cardapio', k.id, 'itens');
                    const itensSnap = await getDocs(itemsRef);
                    
                    return itensSnap.docs
                        .filter(i => i.data().ativo !== false && i.data().exibirPdv !== false)
                        .map(i => {
                            const d = i.data();
                            const vs = d.variacoes?.filter(v => v.ativo) || [];
                            return {
                                ...d, id: i.id,
                                name: d.nome || "S/ Nome",
                                categoria: k.nome || "Geral",
                                categoriaId: k.id,
                                price: vs.length > 0 ? Math.min(...vs.map(x => Number(x.preco))) : Number(d.preco || 0),
                                temVariacoes: vs.length > 0,
                                variacoes: vs
                            };
                        });
                });

                const results = await Promise.all(categoryPromises);
                const todosProdutos = results.flat();

                if (isMounted) {
                    setCategorias(novasCategorias);
                    setProdutos(todosProdutos);
                    setCarregandoProdutos(false);
                    
                    setCachedData(estabelecimentoAtivo, {
                        categorias: novasCategorias,
                        produtos: todosProdutos
                    });
                }
            } catch (error) {
                console.error("Erro ao carregar cardápio PDV:", error);
                if (isMounted) setCarregandoProdutos(false);
            }
        };

        carregarMenu();

        return () => {
            isMounted = false;
        };
    }, [estabelecimentoAtivo, triggerRecarregar]);

    const [limiteExibicao, setLimiteExibicao] = useState(40);

    // Reset rendering limit when search or category changes
    useEffect(() => {
        setLimiteExibicao(40);
    }, [busca, categoriaAtiva]);

    const produtosFiltrados = useMemo(() => {
        const termo = busca?.toLowerCase().trim() || "";
        return produtos.filter(p => {
            if (categoriaAtiva !== 'todos' && p.categoria !== categoriaAtiva && p.categoriaId !== categoriaAtiva) return false;
            if (!termo) return true;
            return (p.name?.toLowerCase() || "").includes(termo) || 
                   (p.codigoBarras ? String(p.codigoBarras).toLowerCase() : "").includes(termo) || 
                   (p.id ? String(p.id).toLowerCase() : "").includes(termo) || 
                   (p.referencia ? String(p.referencia).toLowerCase() : "").includes(termo);
        });
    }, [produtos, categoriaAtiva, busca]);

    const produtosExibidos = useMemo(() => {
        return produtosFiltrados.slice(0, limiteExibicao);
    }, [produtosFiltrados, limiteExibicao]);

    const temMaisProdutos = produtosFiltrados.length > limiteExibicao;

    const carregarMaisProdutos = () => {
        setLimiteExibicao(prev => prev + 40);
    };

    return {
        produtos,
        categorias,
        carregandoProdutos,
        categoriaAtiva,
        setCategoriaAtiva,
        busca,
        setBusca,
        produtosFiltrados,
        produtosExibidos,
        temMaisProdutos,
        carregarMaisProdutos,
        recarregar
    };
}
