import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';

export function usePdvProducts(estabelecimentoAtivo) {
    const [produtos, setProdutos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [carregandoProdutos, setCarregandoProdutos] = useState(true);
    const [categoriaAtiva, setCategoriaAtiva] = useState('todos');
    const [busca, setBusca] = useState('');
    const [triggerRecarregar, setTriggerRecarregar] = useState(0);

    const recarregar = () => setTriggerRecarregar(prev => prev + 1);

    useEffect(() => {
        let isFornecedormounted = true;
        if (!estabelecimentoAtivo) return;
        
        const carregarCardapio = async () => {
            setCarregandoProdutos(true);
            setProdutos([]);
            setCategorias([]);

            try {
                // 1) Puxar as categorias primeiro (UMA leitura)
                const qCat = query(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'cardapio'), orderBy('ordem', 'asc'));
                const catsSnapshot = await getDocs(qCat);
                const cArray = catsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                
                if (!isFornecedormounted) return;
                setCategorias([{ id: 'todos', name: 'Todos' }, ...cArray.map(x => ({ id: x.nome || x.id, name: x.nome || x.id }))]);

                if (cArray.length === 0) {
                    setProdutos([]);
                    setCarregandoProdutos(false);
                    return;
                }

                // 2) Puxar todos os itens da categoria em batch promise (UMA leitura de docs para cada cat, em paralelo, apenas na montagem)
                const promises = cArray.map(async (k) => {
                    const itensSnap = await getDocs(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'cardapio', k.id, 'itens'));
                    return itensSnap.docs.map(i => {
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

                const resultadosMatriz = await Promise.all(promises);
                if (!isFornecedormounted) return;
                
                setProdutos(resultadosMatriz.flat());
                setCarregandoProdutos(false);

            } catch (error) {
                console.error("Erro ao carregar menu PDV via getDocs:", error);
                if (isFornecedormounted) setCarregandoProdutos(false);
            }
        };

        carregarCardapio();

        return () => {
            isFornecedormounted = false;
        };
    }, [estabelecimentoAtivo, triggerRecarregar]);

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

    return {
        produtos,
        categorias,
        carregandoProdutos,
        categoriaAtiva,
        setCategoriaAtiva,
        busca,
        setBusca,
        produtosFiltrados,
        recarregar
    };
}
