import { useState, useEffect } from 'react';
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

async function carregarProdutosRapido(estabId) {
  try {
    const snapshot = await getDocs(collection(db, 'estabelecimentos', estabId, 'cardapio'));
    if (snapshot.empty) return [];

    const categoriasAtivas = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(cat => cat.ativo !== false);

    const processarDocs = async (docsSnapshot, catNome, catId) => {
      // Filter client-side: treat items without the `ativo` field as active
      const activeDocs = docsSnapshot.docs.filter(d => d.data().ativo !== false);
      return Promise.all(activeDocs.map(async (docItem) => {
        const dados = docItem.data();

        let listaAdicionais = [];
        try {
          const addSnap = await getDocs(collection(docItem.ref, 'adicionais'));
          listaAdicionais = addSnap.docs.map(a => ({ id: a.id, ...a.data() }));
        } catch (e) {
          console.warn(`[useEstablishment] Erro ao carregar adicionais do item ${docItem.id}:`, e);
        }

        let listaVariacoes = [];
        try {
          const varSnap = await getDocs(collection(docItem.ref, 'variacoes'));
          listaVariacoes = varSnap.docs.map(v => ({ id: v.id, ...v.data() }));
        } catch (e) {
          console.warn(`[useEstablishment] Erro ao carregar variações do item ${docItem.id}:`, e);
        }

        return {
          ...dados,
          id: docItem.id,
          categoria: catNome || 'Geral',
          categoriaId: catId,
          adicionais: dados.adicionais?.length > 0 ? dados.adicionais : listaAdicionais,
          variacoes: dados.variacoes?.length > 0 ? dados.variacoes : listaVariacoes,
        };
      }));
    };

    const resultados = await Promise.all(categoriasAtivas.map(async (cat) => {
      // Fetch all items/products without Firestore ativo filter — 
      // items missing the `ativo` field are treated as active (filtered client-side above)
      const [itensSnap, produtosSnap] = await Promise.all([
        getDocs(collection(db, 'estabelecimentos', estabId, 'cardapio', cat.id, 'itens')),
        getDocs(collection(db, 'estabelecimentos', estabId, 'cardapio', cat.id, 'produtos')),
      ]);
      const itens = await processarDocs(itensSnap, cat.nome, cat.id);
      const produtos = await processarDocs(produtosSnap, cat.nome, cat.id);
      return [...itens, ...produtos];
    }));

    return resultados.flat();
  } catch (error) {
    console.error('Erro ao carregar produtos:', error);
    return [];
  }
}

export function useEstablishment(estabelecimentoSlug) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [allProdutos, setAllProdutos] = useState([]);
  const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
  const [actualEstabelecimentoId, setActualEstabelecimentoId] = useState(null);
  const [ordemCategorias, setOrdemCategorias] = useState([]);
  const [bairrosDisponiveis, setBairrosDisponiveis] = useState([]);
  const [coresEstabelecimento, setCoresEstabelecimento] = useState(CORES_PADRAO);

  useEffect(() => {
    if (!estabelecimentoSlug) return;
    const load = async () => {
      setLoading(true);
      try {
        // 1. Tenta buscar por slug
        let snap = await getDocs(query(collection(db, 'estabelecimentos'), where('slug', '==', estabelecimentoSlug)));
        
        let data, id;
        
        if (!snap.empty) {
          // Encontrou por slug
          data = snap.docs[0].data();
          id = snap.docs[0].id;
        } else {
          // 2. Fallback: tenta buscar pelo ID do documento diretamente
          const docRef = doc(db, 'estabelecimentos', estabelecimentoSlug);
          const docSnap = await getDoc(docRef);
          
          if (!docSnap.exists()) {
            console.warn('Estabelecimento não encontrado:', estabelecimentoSlug);
            navigate('/cardapio');
            return;
          }
          
          data = docSnap.data();
          id = docSnap.id;
        }

        setEstabelecimentoInfo({ ...data, id });
        setActualEstabelecimentoId(id);
        setAllProdutos(await carregarProdutosRapido(id));

        if (data.ordemCategorias) setOrdemCategorias(data.ordemCategorias);

        if (data.cores) {
          const coresDB = data.cores;
          const cores = {
            ...CORES_PADRAO,
            ...coresDB,
            texto: {
              ...CORES_PADRAO.texto,
              ...(coresDB.texto || {})
            }
          };
          
          setCoresEstabelecimento(cores);
        }

        const taxasSnap = await getDocs(collection(db, 'estabelecimentos', id, 'taxasDeEntrega'));
        const bairros = [...new Set(taxasSnap.docs.map(d => d.data().nomeBairro))].sort();
        setBairrosDisponiveis(bairros);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [estabelecimentoSlug, navigate]);

  return { loading, allProdutos, estabelecimentoInfo, actualEstabelecimentoId, ordemCategorias, bairrosDisponiveis, coresEstabelecimento };
}