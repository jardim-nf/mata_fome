import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs, onSnapshot } from 'firebase/firestore';

export function usePdvProducts(estabelecimentoAtivo) {
    const [produtos, setProdutos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [carregandoProdutos, setCarregandoProdutos] = useState(true);
    const [categoriaAtiva, setCategoriaAtiva] = useState('todos');
    const [busca, setBusca] = useState('');
    const [triggerRecarregar, setTriggerRecarregar] = useState(0);

    const recarregar = () => setTriggerRecarregar(prev => prev + 1);

    useEffect(() => {
        if (!estabelecimentoAtivo) return;
        
        setCarregandoProdutos(true);
        const qCat = query(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'cardapio'), orderBy('ordem', 'asc'));

        let itemListeners = [];

        const unsubscribeCats = onSnapshot(qCat, (catsSnapshot) => {
            const cArray = catsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setCategorias([{ id: 'todos', name: 'Todos' }, ...cArray.map(x => ({ id: x.nome || x.id, name: x.nome || x.id }))]);

            // Clean up previous item listeners
            itemListeners.forEach(unsub => unsub());
            itemListeners = [];

            if (cArray.length === 0) {
                setProdutos([]);
                setCarregandoProdutos(false);
                return;
            }

            const itemsMap = {};
            let loadedCategories = new Set();

            cArray.forEach((k) => {
                const itemsRef = collection(db, 'estabelecimentos', estabelecimentoAtivo, 'cardapio', k.id, 'itens');
                const unsub = onSnapshot(itemsRef, (itensSnap) => {
                    const catItems = itensSnap.docs
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

                    itemsMap[k.id] = catItems;
                    loadedCategories.add(k.id);

                    // Reassemble all items from categories that have loaded at least once
                    const allItems = [];
                    cArray.forEach(cat => {
                        if (itemsMap[cat.id]) {
                            allItems.push(...itemsMap[cat.id]);
                        }
                    });

                    setProdutos(allItems);

                    // Only turn off loading once we've heard from all category snapshots at least once
                    if (loadedCategories.size >= cArray.length) {
                        setCarregandoProdutos(false);
                    }
                }, (error) => {
                    console.error(`Erro ao carregar itens da categoria PDV ${k.id}:`, error);
                });

                itemListeners.push(unsub);
            });
        }, (error) => {
            console.error("Erro ao carregar categorias PDV:", error);
            setCarregandoProdutos(false);
        });

        return () => {
            unsubscribeCats();
            itemListeners.forEach(unsub => unsub());
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
