import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

const CORES_PADRAO = {
  primaria: '#EA1D2C',
  destaque: '#059669',
  background: '#f9fafb',
  texto: {
    principal: '#111827',
    secundario: '#4B5563',
    placeholder: '#9CA3AF',
    destaque: '#FBBF24',
    erro: '#EF4444',
    sucesso: '#10B981'
  }
};

// ============================================================
// 🚀 CACHE LOCAL — Stale-While-Revalidate
// Mostra dados cacheados INSTANTANEAMENTE, atualiza no background
// ============================================================
const CACHE_KEY = 'mf_cardapio_cache_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos — se o cache é mais novo que isso, nem refetch

function getCachedData(slug) {
  try {
    const raw = localStorage.getItem(CACHE_KEY + slug);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    return cached;
  } catch { return null; }
}

function setCachedData(slug, data) {
  try {
    localStorage.setItem(CACHE_KEY + slug, JSON.stringify({
      ...data,
      _cachedAt: Date.now()
    }));
  } catch (e) {
    // localStorage cheio — limpa caches antigos
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(CACHE_KEY))
        .forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }
  }
}

// ============================================================
// 🚀 CARREGAMENTO RÁPIDO — Todas as categorias em paralelo
// ============================================================
async function carregarProdutosRapido(estabId) {
  try {
    const snapshot = await getDocs(collection(db, 'estabelecimentos', estabId, 'cardapio'));
    if (snapshot.empty) return { produtos: [], docRefs: [] };

    const categoriasAtivas = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(cat => cat.ativo !== false);

    const docRefs = [];

    // 🚀 TODAS as categorias em paralelo
    const categoryPromises = categoriasAtivas.map(async (cat) => {
      const [itensSnap, produtosSnap] = await Promise.all([
        getDocs(collection(db, 'estabelecimentos', estabId, 'cardapio', cat.id, 'itens')),
        getDocs(collection(db, 'estabelecimentos', estabId, 'cardapio', cat.id, 'produtos'))
      ]);

      return [...itensSnap.docs, ...produtosSnap.docs]
        .filter(d => d.data().ativo !== false)
        .map(docItem => {
          const dados = docItem.data();
          docRefs.push({ ref: docItem.ref, id: docItem.id });
          
          return {
            ...dados,
            id: docItem.id,
            categoria: cat.nome || 'Geral',
            categoriaId: cat.id,
            adicionais: Array.isArray(dados.adicionais) && dados.adicionais.length > 0 ? dados.adicionais : [],
            variacoes: Array.isArray(dados.variacoes) && dados.variacoes.length > 0 ? dados.variacoes : [],
            _needsEnrichment: !(
              (Array.isArray(dados.adicionais) && dados.adicionais.length > 0) ||
              (Array.isArray(dados.variacoes) && dados.variacoes.length > 0)
            )
          };
        });
    });

    const results = await Promise.all(categoryPromises);
    return { produtos: results.flat(), docRefs };
  } catch (error) {
    console.error('Erro ao carregar produtos:', error);
    return { produtos: [], docRefs: [] };
  }
}

// 🚀 Enriquecimento em background (adicionais/variações)
async function enriquecerProdutos(produtos, docRefs) {
  const toEnrich = produtos.filter(p => p._needsEnrichment);
  if (toEnrich.length === 0) return produtos;

  const BATCH = 5;
  const enrichedMap = new Map();

  for (let i = 0; i < toEnrich.length; i += BATCH) {
    const batch = toEnrich.slice(i, i + BATCH);
    await Promise.all(batch.map(async (produto) => {
      const info = docRefs.find(r => r.id === produto.id);
      if (!info) return;
      try {
        const [addSnap, varSnap] = await Promise.all([
          getDocs(collection(info.ref, 'adicionais')).catch(() => ({ docs: [] })),
          getDocs(collection(info.ref, 'variacoes')).catch(() => ({ docs: [] }))
        ]);
        const adicionais = addSnap.docs.map(a => ({ id: a.id, ...a.data() }));
        const variacoes = varSnap.docs.map(v => ({ id: v.id, ...v.data() }));
        if (adicionais.length > 0 || variacoes.length > 0) {
          enrichedMap.set(produto.id, { adicionais, variacoes });
        }
      } catch { /* silencioso */ }
    }));
  }

  if (enrichedMap.size === 0) return produtos;
  return produtos.map(p => {
    const e = enrichedMap.get(p.id);
    if (!e) return p;
    return { ...p, adicionais: e.adicionais.length > 0 ? e.adicionais : p.adicionais, variacoes: e.variacoes.length > 0 ? e.variacoes : p.variacoes, _needsEnrichment: false };
  });
}

// ============================================================
// 🚀 HOOK PRINCIPAL
// ============================================================
export function useEstablishment(estabelecimentoSlug) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [allProdutos, setAllProdutos] = useState([]);
  const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
  const [actualEstabelecimentoId, setActualEstabelecimentoId] = useState(null);
  const [ordemCategorias, setOrdemCategorias] = useState([]);
  const [bairrosDisponiveis, setBairrosDisponiveis] = useState([]);
  const [coresEstabelecimento, setCoresEstabelecimento] = useState(CORES_PADRAO);
  const hasHydratedFromCache = useRef(false);

  useEffect(() => {
    if (!estabelecimentoSlug) return;
    let isMounted = true;

    // ============================================
    // 🚀 PASSO 0: Cache instantâneo (0ms)
    // ============================================
    const cached = getCachedData(estabelecimentoSlug);
    if (cached && !hasHydratedFromCache.current) {
      hasHydratedFromCache.current = true;
      setEstabelecimentoInfo(cached.info);
      setActualEstabelecimentoId(cached.estabId);
      setAllProdutos(cached.produtos || []);
      if (cached.ordemCategorias) setOrdemCategorias(cached.ordemCategorias);
      if (cached.bairros) setBairrosDisponiveis(cached.bairros);
      if (cached.cores) setCoresEstabelecimento(cached.cores);
      setLoading(false); // ← TELA APARECE INSTANTANEAMENTE!

      // Se o cache tem menos de 5 min, nem precisa refetch
      if (Date.now() - (cached._cachedAt || 0) < CACHE_TTL) {
        return; // Cache fresco — não gasta dados do cliente
      }
    }

    // ============================================
    // 🚀 PASSO 1: Fetch real do Firestore
    // ============================================
    const load = async () => {
      if (!cached) setLoading(true);
      
      try {
        let snap = await getDocs(query(collection(db, 'estabelecimentos'), where('slug', '==', estabelecimentoSlug)));
        let data, id;

        if (!snap.empty) {
          data = snap.docs[0].data();
          id = snap.docs[0].id;
        } else {
          const docRef = doc(db, 'estabelecimentos', estabelecimentoSlug);
          const docSnap = await getDoc(docRef);
          if (!docSnap.exists()) { navigate('/cardapio'); return; }
          data = docSnap.data();
          id = docSnap.id;
        }

        if (!isMounted) return;
        setEstabelecimentoInfo({ ...data, id });
        setActualEstabelecimentoId(id);
        if (data.ordemCategorias) setOrdemCategorias(data.ordemCategorias);

        let cores = CORES_PADRAO;
        if (data.cores) {
          cores = { ...CORES_PADRAO, ...data.cores, texto: { ...CORES_PADRAO.texto, ...(data.cores.texto || {}) } };
          setCoresEstabelecimento(cores);
        }

        // Dados + Taxas em paralelo
        const [fase1, taxasSnap] = await Promise.all([
          carregarProdutosRapido(id),
          getDocs(collection(db, 'estabelecimentos', id, 'taxasDeEntrega'))
        ]);

        if (!isMounted) return;
        const bairros = [...new Set(taxasSnap.docs.map(d => d.data().nomeBairro))].sort();
        
        setAllProdutos(fase1.produtos);
        setBairrosDisponiveis(bairros);
        setLoading(false);

        // 🚀 Salva no cache para próxima visita ser instantânea
        setCachedData(estabelecimentoSlug, {
          info: { ...data, id },
          estabId: id,
          produtos: fase1.produtos,
          ordemCategorias: data.ordemCategorias || [],
          bairros,
          cores
        });

        // Fase 2: enriquece em background
        const enriched = await enriquecerProdutos(fase1.produtos, fase1.docRefs);
        if (isMounted && enriched !== fase1.produtos) {
          setAllProdutos(enriched);
          // Atualiza cache com dados enriquecidos
          setCachedData(estabelecimentoSlug, {
            info: { ...data, id },
            estabId: id,
            produtos: enriched,
            ordemCategorias: data.ordemCategorias || [],
            bairros,
            cores
          });
        }

      } catch (err) {
        console.error(err);
        if (isMounted) setLoading(false);
      }
    };

    load();
    return () => { isMounted = false; };
  }, [estabelecimentoSlug, navigate]);

  return { loading, allProdutos, estabelecimentoInfo, actualEstabelecimentoId, ordemCategorias, bairrosDisponiveis, coresEstabelecimento };
}