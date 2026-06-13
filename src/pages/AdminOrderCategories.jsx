// src/pages/AdminOrderCategories.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, updateDoc, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import GerenciarOrdemCategoria from '../components/GerenciarOrdemCategoria';
import { toast } from 'react-toastify';
import { FaPlus } from 'react-icons/fa';
import BackButton from '../components/BackButton';
import { useEstablishment } from '../hooks/useEstablishment';

const AdminOrderCategories = () => {
  const navigate = useNavigate();
  const { estabelecimentosGerenciados, estabelecimentoIdPrincipal } = useAuth();
  
  const estabelecimentoId = estabelecimentoIdPrincipal || (estabelecimentosGerenciados && estabelecimentosGerenciados.length > 0 
    ? estabelecimentosGerenciados[0] 
    : null);

  const [categoriasDisponiveis, setCategoriasDisponiveis] = useState(['PROMOÇÕES', 'HAMBÚRGUERES', 'BEBIDAS', 'ACOMPANHAMENTOS', 'SOBREMESAS']);
  const [ordemAtual, setOrdemAtual] = useState(['PROMOÇÕES', 'HAMBÚRGUERES', 'ACOMPANHAMENTOS', 'BEBIDAS', 'SOBREMESAS']);
  const [loading, setLoading] = useState(false);
  const [nomeEstabelecimento, setNomeEstabelecimento] = useState('IdeaFood Burger - Teste');
  const [novaCategoria, setNovaCategoria] = useState('');

  const themeClasses = {
    dark: {
      bg: 'bg-gradient-to-br from-slate-955 via-[#0d1220] to-slate-955 text-slate-100',
      surface: 'bg-slate-900/60 backdrop-blur-xl',
      border: 'border-slate-800/80',
      text: 'text-slate-100',
      textSecondary: 'text-slate-400',
      textMuted: 'text-slate-500',
      buttonPrimary: 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white transition-all shadow-md shadow-[var(--color-primary)]/20',
      buttonSecondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700',
    },
    light: {
      bg: 'bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#f8fafc] text-slate-800',
      surface: 'bg-white/80 backdrop-blur-md',
      border: 'border-slate-200/60',
      text: 'text-slate-800',
      textSecondary: 'text-slate-600',
      textMuted: 'text-slate-400',
      buttonPrimary: 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white transition-all shadow-md shadow-[var(--color-primary)]/20',
      buttonSecondary: 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200',
    }
  };

  const theme = 'light';
  const t = themeClasses.light;
  const isDark = false;

  // Buscar cores da loja
  const { coresEstabelecimento } = useEstablishment(estabelecimentoId);
  const cores = coresEstabelecimento || { primaria: '#EA1D2C', destaque: '#059669', background: '#FFFFFF' };
  const primaryColor = cores.primaria || '#EA1D2C';
  const primaryColorHover = cores.destaque || '#d31825';

  // Injetar variáveis CSS da cor da marca
  useEffect(() => {
    const root = document.documentElement;
    
    const isColorDark = (hex) => {
      if (!hex || typeof hex !== 'string') return true;
      const cleaned = hex.replace('#', '');
      if (cleaned.length !== 3 && cleaned.length !== 6) return true;
      let r, g, b;
      if (cleaned.length === 3) {
        r = parseInt(cleaned[0] + cleaned[0], 16);
        g = parseInt(cleaned[1] + cleaned[1], 16);
        b = parseInt(cleaned[2] + cleaned[2], 16);
      } else {
        r = parseInt(cleaned.substring(0, 2), 16);
        g = parseInt(cleaned.substring(2, 4), 16);
        b = parseInt(cleaned.substring(4, 6), 16);
      }
      const hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
      return hsp < 120;
    };

    let adjustedPrimary = primaryColor;
    let adjustedHover = primaryColorHover;

    if (isDark && isColorDark(primaryColor)) {
      adjustedPrimary = '#EA1D2C';
      adjustedHover = '#d31825';
    }

    const adjustedAlpha = adjustedPrimary.startsWith('#') ? `${adjustedPrimary}20` : 'rgba(234, 29, 44, 0.2)';

    root.style.setProperty('--color-primary', adjustedPrimary);
    root.style.setProperty('--color-primary-hover', adjustedHover);
    root.style.setProperty('--color-primary-alpha', adjustedAlpha);
  }, [primaryColor, primaryColorHover, isDark]);

  useEffect(() => {
    const fetchData = async () => {
      if (!estabelecimentoId) {
        setLoading(false);
        return;
      }
      try {
        const estabelecimentoRef = doc(db, 'estabelecimentos', estabelecimentoId);
        const estabelecimentoDoc = await getDoc(estabelecimentoRef);

        if (estabelecimentoDoc.exists()) {
          const data = estabelecimentoDoc.data();
          setNomeEstabelecimento(data.nome);
        }

        await fetchCategoriasDoCardapio(estabelecimentoId);

      } catch (error) {
        console.error('💥 Erro:', error);
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [estabelecimentoId, navigate]);

  const fetchCategoriasDoCardapio = async (idDoEstabelecimento) => {
    try {
      const cardapioRef = collection(db, 'estabelecimentos', idDoEstabelecimento, 'cardapio');
      const snapshot = await getDocs(cardapioRef);
      
      const categoriasNosProdutos = [];
      snapshot.forEach((doc) => {
        const categoriaData = doc.data();
        if (categoriaData.nome) {
            categoriasNosProdutos.push(categoriaData.nome.trim());
        }
      });

      const estabelecimentoRef = doc(db, 'estabelecimentos', idDoEstabelecimento);
      const estabelecimentoDoc = await getDoc(estabelecimentoRef);
      
      let categoriasSalvasNoBanco = [];
      if (estabelecimentoDoc.exists()) {
        const data = estabelecimentoDoc.data();
        if (data.ordemCategorias && Array.isArray(data.ordemCategorias)) {
            categoriasSalvasNoBanco = data.ordemCategorias;
        }
      }

      const todasCategoriasUnicas = [...new Set([...categoriasNosProdutos, ...categoriasSalvasNoBanco])];

      if (todasCategoriasUnicas.length === 0) {
        setCategoriasDisponiveis([]);
        return;
      }

      setCategoriasDisponiveis(todasCategoriasUnicas);

      if (categoriasSalvasNoBanco.length > 0) {
        const novasQueNaoEstavamNaOrdem = todasCategoriasUnicas.filter(cat => !categoriasSalvasNoBanco.includes(cat));
        setOrdemAtual([...categoriasSalvasNoBanco, ...novasQueNaoEstavamNaOrdem]);
      } else {
        setOrdemAtual(todasCategoriasUnicas.sort((a, b) => a.localeCompare(b)));
      }

    } catch (error) {
      console.error('❌ Erro ao buscar categorias:', error);
      toast.error('Erro ao carregar categorias');
    }
  };

  const handleAddCategoria = () => {
    if (!novaCategoria.trim()) {
      toast.warning('Digite o nome da categoria');
      return;
    }

    const novaFormatada = novaCategoria.trim().toUpperCase();

    if (categoriasDisponiveis.includes(novaFormatada)) {
      toast.warning('Esta categoria já existe!');
      return;
    }

    const novasCategorias = [...categoriasDisponiveis, novaFormatada];
    const novaOrdem = [novaFormatada, ...ordemAtual];

    setCategoriasDisponiveis(novasCategorias);
    setOrdemAtual(novaOrdem);
    setNovaCategoria('');
    toast.success(`Categoria "${novaFormatada}" adicionada! Lembre de salvar.`);
  };

  const salvarOrdemNoFirebase = async (novaOrdem) => {
    if (!estabelecimentoId) return;

    try {
      const estabelecimentoRef = doc(db, 'estabelecimentos', estabelecimentoId);
      await updateDoc(estabelecimentoRef, {
        ordemCategorias: novaOrdem,
        atualizadoEm: new Date()
      });
      
      setOrdemAtual(novaOrdem);
      toast.success('✅ Ordem e novas categorias salvas!');
      
      await atualizarOrdemNosProdutos(novaOrdem);
      
    } catch (error) {
      console.error('❌ Erro ao salvar:', error);
      toast.error('Erro ao salvar ordem');
    }
  };

  const atualizarOrdemNosProdutos = async (novaOrdem) => {
    try {
      const cardapioRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio');
      const snapshot = await getDocs(cardapioRef);
      const updates = [];
      const categoriasExistentesNoBanco = [];
      
      const ordemMap = {};
      novaOrdem.forEach((cat, index) => {
        ordemMap[cat] = index + 1;
      });
      
      snapshot.forEach((docSnapshot) => {
        const categoriaDoc = docSnapshot.data();
        if (categoriaDoc.nome) {
           const nomeNormalizado = categoriaDoc.nome.trim().toUpperCase();
           categoriasExistentesNoBanco.push(nomeNormalizado);
           
           if (ordemMap[categoriaDoc.nome]) {
              updates.push(
                updateDoc(docSnapshot.ref, { 
                  ordem: ordemMap[categoriaDoc.nome],
                  atualizadoEm: new Date() 
                })
              );
           }
        }
      });

      // Adiciona categorias novas que ainda não têm documento no Firestore subcoleção 'cardapio'
      novaOrdem.forEach((cat) => {
        const nomeNormalizado = cat.trim().toUpperCase();
        if (!categoriasExistentesNoBanco.includes(nomeNormalizado)) {
          updates.push(
            addDoc(cardapioRef, {
              nome: cat.trim(),
              ordem: ordemMap[cat],
              ativo: true,
              criadoEm: new Date(),
              atualizadoEm: new Date()
            })
          );
        }
      });
      
      if (updates.length > 0) {
        await Promise.all(updates);
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar ou criar categorias:', error);
      toast.error('Erro ao registrar novas categorias no banco');
    }
  };

  const handleClose = () => {
    navigate('/dashboard');
  };

  const handleDeletarCategoria = async (nomeCategoria) => {
    if (!window.confirm(`Tem certeza que deseja excluir a categoria "${nomeCategoria}"?`)) {
      return;
    }
    
    setLoading(true);
    try {
      const cardapioRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio');
      const snapshot = await getDocs(cardapioRef);
      
      let catDocParaDeletar = null;
      for (const d of snapshot.docs) {
        if (d.data().nome && d.data().nome.trim().toUpperCase() === nomeCategoria.trim().toUpperCase()) {
          catDocParaDeletar = d;
          break;
        }
      }
      
      if (!catDocParaDeletar) {
        setCategoriasDisponiveis(prev => prev.filter(c => c !== nomeCategoria));
        setOrdemAtual(prev => prev.filter(c => c !== nomeCategoria));
        toast.success(`Categoria "${nomeCategoria}" removida.`);
        return;
      }
      
      const itensRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', catDocParaDeletar.id, 'itens');
      const produtosRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', catDocParaDeletar.id, 'produtos');
      
      const [itensSnap, produtosSnap] = await Promise.all([
        getDocs(itensRef),
        getDocs(produtosRef)
      ]);
      
      const totalItens = itensSnap.size + produtosSnap.size;
      
      if (totalItens > 0) {
        toast.error(`Não é possível excluir a categoria "${nomeCategoria}" porque ela possui ${totalItens} produto(s) cadastrado(s). Remova ou mova os produtos antes.`);
        return;
      }
      
      await deleteDoc(catDocParaDeletar.ref);
      
      const novaOrdem = ordemAtual.filter(c => c !== nomeCategoria);
      const estabelecimentoRef = doc(db, 'estabelecimentos', estabelecimentoId);
      await updateDoc(estabelecimentoRef, {
        ordemCategorias: novaOrdem,
        atualizadoEm: new Date()
      });
      
      setCategoriasDisponiveis(prev => prev.filter(c => c !== nomeCategoria));
      setOrdemAtual(novaOrdem);
      
      toast.success(`Categoria "${nomeCategoria}" excluída com sucesso!`);
    } catch (error) {
      console.error("Erro ao deletar categoria:", error);
      toast.error("Erro ao excluir categoria.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center font-sans ${t.bg}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[var(--color-primary)] border-t-transparent"></div>
          <p className={`text-base font-bold ${t.textSecondary}`}>Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-4 md:p-8 font-sans pb-32 relative overflow-hidden transition-colors duration-500 w-full ${t.bg}`}>
      {/* Glow blobs premium */}
      <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-gradient-to-tr ${isDark ? 'from-emerald-500/10 to-teal-500/5 blur-[120px]' : 'from-emerald-300/10 to-teal-300/10 blur-[120px]'} pointer-events-none`}></div>
      <div className={`absolute bottom-[20%] right-[-10%] w-[35%] h-[35%] rounded-full bg-gradient-to-br ${isDark ? 'from-teal-500/10 to-emerald-500/5 blur-[100px]' : 'from-teal-300/10 to-emerald-300/10 blur-[100px]'} pointer-events-none`}></div>

      <div className="max-w-4xl mx-auto relative z-10">
        <div className={`backdrop-blur-md rounded-[2.5rem] shadow-lg border p-6 md:p-8 ${t.surface} ${t.border}`}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className={`text-2xl md:text-3xl font-black ${t.text}`}>Gerenciar Categorias</h1>
              <p className={`text-sm font-medium mt-1 ${t.textSecondary}`}>Crie novas categorias ou reordene as existentes para o cardápio</p>
            </div>
            <div className="flex items-center gap-3">
              <BackButton onClick={handleClose} />
            </div>
          </div>

          <div className={`backdrop-blur-sm border rounded-2xl p-4 mb-8 flex items-center justify-between ${isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-450' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h3 className="font-bold text-base md:text-lg">
                Loja Ativa: {nomeEstabelecimento}
              </h3>
            </div>
          </div>

          {/* --- NOVA ÁREA DE CRIAÇÃO --- */}
          <div className={`mb-8 p-5 md:p-6 rounded-2xl border shadow-inner ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50/50 border-slate-200/50'}`}>
            <label className={`block text-base font-bold mb-2 uppercase tracking-wider ${t.textSecondary}`}>Criar Nova Categoria</label>
            <div className="flex gap-3">
              <input 
                type="text"
                value={novaCategoria}
                onChange={(e) => setNovaCategoria(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddCategoria()}
                placeholder="Ex: PROMOÇÕES, BURGERS..."
                className={`flex-1 px-4 py-3 border rounded-xl outline-none transition-all duration-300 font-bold text-base ${isDark ? 'bg-slate-950 border-slate-800/80 focus:bg-slate-900 focus:border-[var(--color-primary)] text-white focus:ring-4 focus:ring-[var(--color-primary)]/10' : 'bg-white border-slate-200 focus:bg-white focus:border-[var(--color-primary)] text-slate-800 focus:ring-4 focus:ring-[var(--color-primary)]/10'} uppercase`}
              />
              <button 
                onClick={handleAddCategoria}
                className={`px-6 py-3 rounded-xl flex items-center gap-2 font-bold text-base transition-all transform hover:scale-[1.02] active:scale-[0.98] ${t.buttonPrimary}`}
              >
                <FaPlus /> Adicionar
              </button>
            </div>
            <p className="text-sm text-slate-400 mt-2">
              * A categoria será adicionada e pode ser ordenada na lista abaixo antes de salvar.
            </p>
          </div>
          {/* --------------------------- */}

          {categoriasDisponiveis.length > 0 ? (
            <GerenciarOrdemCategoria
              key={estabelecimentoId}
              estabelecimentoId={estabelecimentoId}
              categorias={categoriasDisponiveis}
              ordemAtual={ordemAtual}
              onClose={handleClose}
              onSave={salvarOrdemNoFirebase}
              onDelete={handleDeletarCategoria}
              t={t}
              isDark={isDark}
              nomeEstabelecimento={nomeEstabelecimento}
            />
          ) : (
            <div className="text-center py-12">
              <p className={`text-base font-medium mb-4 ${t.textSecondary}`}>Nenhuma categoria encontrada.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminOrderCategories;