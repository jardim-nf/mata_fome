import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger';
import { 
  FaStore, 
  FaCloudUploadAlt, 
  FaFileCode, 
  FaCheckCircle, 
  FaExclamationTriangle, 
  FaTrash,
  FaPlusCircle,
  FaExchangeAlt,
  FaBolt
} from 'react-icons/fa';
import { 
  FiArrowLeft, FiSun, FiMoon, FiLogOut, FiAlertCircle 
} from 'react-icons/fi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FaWandMagicSparkles } from 'react-icons/fa6';
import { motion } from 'framer-motion';

// --- LÓGICA DE NEGÓCIO (Inteligência Artificial Mock e Conversões) ---
function textToMenuParser(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const categorias = [];
  let currentCategoria = null;
  let currentItem = null;

  const getPrice = (t) => {
    const match = t.match(/(?:R\$)?\s*(\d+[.,]\d{2})/i);
    return match ? parseFloat(match[1].replace(',', '.')) : null;
  };

  lines.forEach(line => {
    const price = getPrice(line);
    if (price !== null) {
      if (!currentCategoria) {
        currentCategoria = { nome: "Menu Importado", ordem: 0, observacao: "", itens: [] };
        categorias.push(currentCategoria);
      }
      let name = line.replace(/(?:R\$)?\s*\d+[.,]\d{2}/i, '').replace(/[-•—:]/g, '').trim();
      if (!name) name = "Item Sem Nome";
      currentItem = {
        nome: name,
        descricao: "",
        preco: price,
        variacoes: [],
        ativo: true,
        estoque: 0,
        estoqueMinimo: 0,
        custo: 0
      };
      currentCategoria.itens.push(currentItem);
    } else {
      if (line.length > 30 || line.toLowerCase().includes('ingredientes') || line.toLowerCase().includes('acompanha')) {
        if (currentItem) {
          currentItem.descricao = currentItem.descricao ? currentItem.descricao + ' ' + line : line;
        } else {
             if (!currentCategoria) {
                currentCategoria = { nome: "Menu Importado", ordem: 0, observacao: "", itens: [] };
                categorias.push(currentCategoria);
             }
             currentCategoria.observacao = line;
        }
      } else {
        currentCategoria = { nome: line, ordem: categorias.length, observacao: "", itens: [] };
        categorias.push(currentCategoria);
        currentItem = null;
      }
    }
  });

  return { categorias: categorias.filter(c => c.itens.length > 0) };
}

// --- LÓGICA DE NEGÓCIO (Mantida Intacta) ---
function converterJSONParaSistema(seuJSON) {
  const cardapioConvertido = {
    categorias: seuJSON.categorias.map(categoria => ({
      nome: categoria.nome,
      ordem: categoria.ordem || 0,
      observacao: categoria.observacao || '',
      itens: categoria.itens.map(item => {
        const variacoes = item.variacoes.map((variacao, index) => ({
          id: `var-${index + 1}`,
          nome: variacao.tipo,
          preco: Number(variacao.preco),
          descricao: variacao.descricao || '',
          ativo: true
        }));

        return {
          nome: item.nome,
          descricao: item.descricao || '',
          preco: Math.min(...variacoes.map(v => Number(v.preco))),
          variacoes: variacoes,
          ativo: true,
          estoque: 0,
          estoqueMinimo: 0,
          custo: 0
        };
      })
    }))
  };
  return cardapioConvertido;
}

// --- Componentes Visuais Bento ---
const StatBox = ({ label, value, icon, iconColorClass, themeClass }) => (
    <div className={`p-6 rounded-[2rem] border flex items-center gap-4 transition-all duration-300 ${themeClass.cardBg} ${themeClass.border} hover:shadow-md`}>
        <div className={`w-14 h-14 rounded-[1.2rem] flex items-center justify-center text-xl shrink-0 ${iconColorClass}`}>
            {icon}
        </div>
        <div>
            <p className={`text-[10px] font-black tracking-widest uppercase ${themeClass.textSecondary}`}>{label}</p>
            <p className="text-3xl font-black font-mono-jb leading-tight">{value}</p>
        </div>
    </div>
);

// --- Loading Screen de Boot com a Logo corporativa ---
const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-500 bg-[#080c16] text-slate-100 font-space">
    {/* Grade cibernética de fundo */}
    <div className="absolute inset-0 bg-cyber-grid-dark opacity-50 pointer-events-none" />

    {/* Círculos luminosos */}
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute top-[20%] left-1/3 w-[300px] h-[300px] rounded-full bg-gradient-to-tr from-cyan-500/10 to-transparent blur-[80px]" />
      <div className="absolute bottom-[20%] right-1/3 w-[300px] h-[300px] rounded-full bg-gradient-to-tr from-violet-500/10 to-transparent blur-[80px]" />
    </div>

    <div className="relative z-10 flex flex-col items-center gap-6 text-center px-4">
      {/* Container com a logo pulsante */}
      <div className="relative flex items-center justify-center w-24 h-24 rounded-3xl border border-white/5 bg-slate-950/40 backdrop-blur-xl shadow-2xl p-4">
        {/* Glow externo rotativo */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute -inset-1 rounded-[2rem] border border-dashed border-cyan-500/30 opacity-60"
        />
        <motion.img 
          src="/logo-idea-solucoes-transp.png" 
          alt="Logo Idea Soluções" 
          animate={{ scale: [0.95, 1.08, 0.95] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="h-12 w-auto object-contain brightness-0 invert" 
        />
      </div>

      <div>
        <h3 className="text-base font-black tracking-wider uppercase font-bricolage mb-1.5 text-white">
          Iniciando Ambiente
        </h3>
        <p className="text-xs font-bold text-slate-400">
          Carregando estabelecimentos e cardápios...
          <span className="block mt-1 text-[10px] text-slate-500 animate-pulse">Sincronizando banco de dados</span>
        </p>
      </div>
    </div>
  </div>
);

function ImportarCardapioMaster() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [estabelecimentosList, setEstabelecimentosList] = useState([]);
  const [selectedEstabelecimentoId, setSelectedEstabelecimentoId] = useState('');
  const [file, setFile] = useState(null);
  const [importMode, setImportMode] = useState('json'); // 'json' or 'text'
  const [rawText, setRawText] = useState('');
  const [modoSubstituicao, setModoSubstituicao] = useState('substituir');
  const [importing, setImporting] = useState(false);
  const [importStats, setImportStats] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Controle do Tema
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('dashboard_theme');
    return saved || 'dark';
  });

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('dashboard_theme', newTheme);
  };

  // Carrega fontes customizadas
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@300;400;500;650;700&display=swap';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Sincroniza o tema entre abas do dashboard
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'dashboard_theme') {
        setTheme(e.newValue || 'dark');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isMasterAdmin) {
        navigate('/master-dashboard');
        return;
      }
      setLoading(false);
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  useEffect(() => {
    const fetchEstabelecimentos = async () => {
      if (!isMasterAdmin || !currentUser) return;
      try {
        const q = query(collection(db, 'estabelecimentos'), orderBy('nome'));
        const querySnapshot = await getDocs(q);
        setEstabelecimentosList(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (_error) {
        toast.error('Erro ao carregar estabelecimentos.');
      }
    };
    fetchEstabelecimentos();
  }, [isMasterAdmin, currentUser]);

  // Handlers de Arquivo
  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) validateAndSetFile(e.target.files[0]);
  };

  const validateAndSetFile = (selectedFile) => {
    if (selectedFile.type !== 'application/json' && !selectedFile.name.endsWith('.json')) {
        toast.error('Apenas arquivos .json são permitidos.');
        return;
    }
    setFile(selectedFile);
    setImportStats(null);
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!selectedEstabelecimentoId) return toast.warn('Selecione a loja alvo.');
    if (importMode === 'json' && !file) return toast.warn('Anexe o arquivo JSON.');
    if (importMode === 'text' && !rawText.trim()) return toast.warn('Cole o cardápio em texto.');

    setImporting(true);
    setImportStats(null);

    try {
      let dataToImport;
      let dadosParaImportar;

      if (importMode === 'json') {
          const fileContent = await file.text();
          dataToImport = JSON.parse(fileContent); 
          dadosParaImportar = dataToImport;
          
          // Detecção de formato antigo e conversão
          if (dataToImport.categorias && dataToImport.categorias[0]?.itens?.[0]?.variacoes?.[0]?.tipo) {
            dadosParaImportar = converterJSONParaSistema(dataToImport);
          }
      } else {
          // Motor de Inteligência Analítica Mock (Smart Text Parser)
          dadosParaImportar = textToMenuParser(rawText);
          dataToImport = dadosParaImportar;
      }

      if (!dadosParaImportar || !Array.isArray(dadosParaImportar.categorias)) {
        throw new Error('Nenhuma categoria extraída. Revise o formato de origem.');
      }

      const batch = writeBatch(db);
      const estabelecimentoDocRef = doc(db, 'estabelecimentos', selectedEstabelecimentoId);
      const categoriasCollectionRef = collection(estabelecimentoDocRef, 'cardapio');

      // 1. Limpeza (Deletar antigo caso modo = substituir)
      const oldCategoriesSnapshot = await getDocs(query(categoriasCollectionRef));
      let deletedItemsCount = 0;
      
      if (modoSubstituicao === 'substituir') {
        for (const categoryDoc of oldCategoriesSnapshot.docs) {
          const itemsSnapshot = await getDocs(query(collection(categoriasCollectionRef, categoryDoc.id, 'itens')));
          itemsSnapshot.docs.forEach(itemDoc => {
              batch.delete(itemDoc.ref);
              deletedItemsCount++;
          });
          batch.delete(categoryDoc.ref);
        }
      }

      // 2. Inserção (Novos dados)
      let addedItemsCount = 0;
      dadosParaImportar.categorias.forEach(categoria => {
        const categoryId = categoria.nome.toLowerCase().replace(/\s/g, '-').replace(/[^\w-]+/g, '');
        const categoryDocRef = doc(categoriasCollectionRef, categoryId);
        
        batch.set(categoryDocRef, {
          nome: categoria.nome,
          ordem: categoria.ordem || 0,
          observacao: categoria.observacao || '',
          updatedAt: new Date()
        });

        const itemsCollectionRef = collection(categoryDocRef, 'itens');
        if (categoria.itens) {
          categoria.itens.forEach(item => {
            const itemId = item.id || item.nome.toLowerCase().replace(/\s/g, '-').replace(/[^\w-]+/g, '');
            batch.set(doc(itemsCollectionRef, itemId), {
              ...item,
              categoriaNome: categoria.nome, 
              estabelecimentoId: selectedEstabelecimentoId,
              updatedAt: new Date()
            });
            addedItemsCount++;
          });
        }
      });

      await batch.commit();
      
      const stats = {
        produtosAdicionados: addedItemsCount,
        produtosRemovidos: deletedItemsCount,
        categoriasProcessadas: dadosParaImportar.categorias.length,
        fileName: importMode === 'json' ? file.name : 'Importação via IA Textual',
        conversaoEfetuada: dataToImport !== dadosParaImportar && importMode === 'json'
      };

      await auditLogger('CARDAPIO_IMPORTADO', 
        { uid: currentUser.uid, email: currentUser.email }, 
        { id: selectedEstabelecimentoId }, 
        stats
      );

      setImportStats(stats);
      toast.success(`Importação concluída! ${addedItemsCount} itens processados.`);
      setFile(null);

    } catch (error) {
      console.error(error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const selectedEstabelecimento = estabelecimentosList.find(e => e.id === selectedEstabelecimentoId);

  const themeClasses = {
    dark: {
      bg: 'bg-[#080c16] bg-cyber-grid-dark text-slate-100',
      surface: 'bg-slate-950/45 backdrop-blur-xl border border-white/5 shadow-2xl',
      border: 'border-white/5',
      text: 'text-slate-100 font-space',
      textSecondary: 'text-slate-400 font-space font-medium',
      inputBg: 'bg-slate-950/30 border-white/10 text-slate-100 focus:border-cyan-500/50 focus:bg-slate-950/50',
      dropzoneBg: 'border-white/10 bg-slate-950/30 hover:bg-slate-900/30 hover:border-cyan-500/50',
      dropzoneActive: 'border-cyan-500 bg-cyan-500/10 text-cyan-400',
      tabActive: 'bg-slate-900 text-cyan-400 border border-cyan-500/30 shadow-sm',
      tabInactive: 'text-slate-400 hover:text-white',
      btnPrimary: 'bg-cyan-500 text-slate-950 hover:bg-cyan-600',
      btnSecondary: 'bg-slate-900 border-white/5 text-slate-300 hover:border-cyan-500/30 hover:text-white',
      alertWarning: 'bg-red-950/30 border-red-500/20 text-red-200',
      alertWarningIcon: 'bg-red-500/20 text-red-400',
      alertSuccess: 'bg-emerald-950/30 border-emerald-500/20 text-emerald-200',
      alertSuccessIcon: 'bg-emerald-500/20 text-emerald-400',
      cardBg: 'bg-slate-950/30 backdrop-blur-xl border border-white/5 shadow-2xl',
    },
    light: {
      bg: 'bg-[#fbfbfa] bg-cyber-grid-light text-stone-900',
      surface: 'bg-white/95 backdrop-blur-md border border-stone-200 shadow-md',
      border: 'border-stone-200',
      text: 'text-stone-900 font-space font-bold',
      textSecondary: 'text-stone-600 font-space font-medium',
      inputBg: 'bg-[#f5f5f4] border-stone-200 text-stone-900 focus:border-stone-400 focus:bg-white',
      dropzoneBg: 'border-stone-200 bg-[#f5f5f4] hover:bg-white hover:border-stone-400',
      dropzoneActive: 'border-stone-900 bg-stone-100 text-stone-900',
      tabActive: 'bg-white text-stone-950 border border-stone-200 shadow-sm',
      tabInactive: 'text-stone-500 hover:text-black',
      btnPrimary: 'bg-stone-900 text-white hover:bg-black',
      btnSecondary: 'bg-white border-stone-200 text-stone-700 hover:border-stone-400 hover:text-black',
      alertWarning: 'bg-red-50 border-red-100 text-red-800',
      alertWarningIcon: 'bg-red-100 text-red-500',
      alertSuccess: 'bg-emerald-50 border-emerald-100 text-emerald-800',
      alertSuccessIcon: 'bg-emerald-100 text-emerald-500',
      cardBg: 'bg-[#f5f5f4]/80 backdrop-blur-md border border-stone-200 shadow-sm',
    }
  };

  const t = themeClasses[theme];

  if (authLoading || loading) return <LoadingScreen />;

  return (
    <div className={`min-h-screen ${t.bg} transition-colors duration-500 pb-24 pt-4 px-4 sm:px-8 font-space relative overflow-hidden`}>
      
      {/* ESTILOS E FONTES INJETADOS */}
      <style>{`
        .font-bricolage {
          font-family: 'Bricolage Grotesque', sans-serif !important;
        }
        .font-space {
          font-family: 'Space Grotesk', sans-serif !important;
        }
        .font-mono-jb {
          font-family: 'JetBrains Mono', monospace !important;
        }
        .bg-cyber-grid-dark {
          background-image: 
            linear-gradient(to right, rgba(99, 102, 241, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .bg-cyber-grid-light {
          background-image: 
            linear-gradient(to right, rgba(28, 25, 23, 0.018) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(28, 25, 23, 0.018) 1px, transparent 1px);
          background-size: 40px 40px;
        }
      `}</style>

      {/* Círculos luminosos decorativos no fundo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-[10%] left-[5%] w-[450px] h-[450px] rounded-full bg-gradient-to-tr ${theme === 'dark' ? 'from-cyan-500/5 to-transparent' : 'from-cyan-500/3 to-transparent'} blur-[100px]`} />
        <div className={`absolute bottom-[15%] right-[5%] w-[450px] h-[450px] rounded-full bg-gradient-to-tr ${theme === 'dark' ? 'from-indigo-500/5 to-transparent' : 'from-indigo-500/3 to-transparent'} blur-[100px]`} />
      </div>

      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className={`max-w-[1400px] mx-auto backdrop-blur-xl border rounded-full h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all duration-300 ${t.surface} ${t.border}`}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/master-dashboard')} className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${theme === 'dark' ? 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white' : 'bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-black'}`}>
            <FiArrowLeft size={16} />
          </button>
          <div className="hidden sm:block border-l pl-4 border-current opacity-60">
            <h1 className="font-semibold text-sm tracking-tight font-bricolage">Importador Universal</h1>
            <p className="text-[11px] font-mono-jb font-medium">{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${theme === 'dark' ? 'bg-slate-900 hover:bg-slate-800 text-yellow-400' : 'bg-stone-100 hover:bg-stone-200 text-amber-600'}`}
            type="button"
            title="Alternar Tema"
          >
            {theme === 'dark' ? <FiSun size={16} /> : <FiMoon size={16} />}
          </button>
          <div className={`w-px h-6 hidden sm:block ${theme === 'dark' ? 'bg-white/10' : 'bg-stone-200'}`} />
          <button onClick={async () => { await logout(); navigate('/'); }} className="w-9 h-9 bg-red-500/10 hover:bg-red-500/20 rounded-full flex items-center justify-center transition-colors">
            <FiLogOut className="text-red-500" size={16} />
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto mt-12 pb-12 relative z-10">
        
        {/* HEADER DA PÁGINA */}
        <div className="flex flex-col mb-10 px-2 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full inline-flex items-center gap-2 ${theme === 'dark' ? 'bg-slate-900 text-cyan-400 border border-cyan-500/20' : 'bg-stone-200 text-stone-900 border border-stone-300'}`}>
                    <FaBolt className="text-yellow-400 animate-pulse" /> Ferramenta de Carga
                </span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight font-bricolage">Importar Cardápio</h1>
            <p className={`${t.textSecondary} text-sm mt-2 font-medium`}>Substitua o catálogo de produtos de qualquer operação enviando um arquivo JSON master ou via inteligência textual.</p>
        </div>

        {/* Card Principal de Importação */}
        <div className={`rounded-[2rem] border overflow-hidden mb-8 transition-all duration-300 ${t.surface} ${t.border}`}>
            <div className="p-8 md:p-10">
                <form onSubmit={handleImport} className="space-y-8">
                    
                    {/* Seleção de Loja */}
                    <div>
                        <label className={`block text-[11px] font-black uppercase tracking-widest mb-3 ${t.textSecondary}`}>Selecione a Loja Alvo</label>
                        <div className="relative">
                            <select
                                value={selectedEstabelecimentoId}
                                onChange={(e) => setSelectedEstabelecimentoId(e.target.value)}
                                className={`w-full border text-sm font-bold rounded-2xl block p-5 transition-all appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-current ${t.inputBg} ${t.border}`}
                                required
                            >
                                <option value="" disabled hidden className={`${theme === 'dark' ? 'bg-[#080c16]' : 'bg-white'}`}>Selecione uma loja...</option>
                                {estabelecimentosList.map(est => (
                                    <option key={est.id} value={est.id} className={`${theme === 'dark' ? 'bg-[#080c16]' : 'bg-white'}`}>{est.nome}</option>
                                ))}
                            </select>
                            <div className={`pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 font-bold text-[10px] ${t.textSecondary}`}>▼</div>
                        </div>
                    </div>

                    {/* Tipo de Inserção (Substituir vs Adicionar) */}
                    <div>
                        <label className={`block text-[11px] font-black uppercase tracking-widest mb-3 ${t.textSecondary}`}>Ação na Base de Dados</label>
                        <div className={`flex p-1 rounded-[1.5rem] border ${theme === 'dark' ? 'bg-slate-950/20 border-white/5' : 'bg-stone-100 border-stone-200'}`}>
                            <button
                                type="button"
                                onClick={() => setModoSubstituicao('substituir')}
                                className={`flex-1 py-3 px-4 rounded-[1.25rem] text-sm font-bold transition-all flex items-center justify-center gap-2 ${modoSubstituicao === 'substituir' ? (theme === 'dark' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-white text-red-600 shadow-sm border border-red-100') : 'text-stone-500 hover:text-red-500'}`}
                            >
                                <FaTrash /> Substituir Tudo
                            </button>
                            <button
                                type="button"
                                onClick={() => setModoSubstituicao('adicionar')}
                                className={`flex-1 py-3 px-4 rounded-[1.25rem] text-sm font-bold transition-all flex items-center justify-center gap-2 ${modoSubstituicao === 'adicionar' ? (theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white text-emerald-600 shadow-sm border border-emerald-100') : 'text-stone-500 hover:text-emerald-500'}`}
                            >
                                <FaPlusCircle /> Apenas Adicionar
                            </button>
                        </div>
                    </div>

                    {/* Sub-Navegação (Abas) */}
                    <div className={`flex p-1 rounded-[1.5rem] border ${theme === 'dark' ? 'bg-slate-950/20 border-white/5' : 'bg-stone-100 border-stone-200'}`}>
                        <button
                            type="button"
                            onClick={() => { setImportMode('json'); setImportStats(null); }}
                            className={`flex-1 py-3 px-6 rounded-[1.25rem] text-sm font-bold transition-all flex items-center justify-center gap-2 ${importMode === 'json' ? t.tabActive : t.tabInactive}`}
                        >
                            <FaFileCode /> Arquivo Estruturado (JSON)
                        </button>
                        <button
                            type="button"
                            onClick={() => { setImportMode('text'); setImportStats(null); }}
                            className={`flex-1 py-3 px-6 rounded-[1.25rem] text-sm font-bold transition-all flex items-center justify-center gap-2 ${importMode === 'text' ? (theme === 'dark' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'bg-stone-900 text-white shadow-sm') : t.tabInactive}`}
                        >
                            <FaWandMagicSparkles /> Motor IA / Texto Livre
                        </button>
                    </div>

                    {importMode === 'json' ? (
                        <div>
                            <label className={`block text-[11px] font-black uppercase tracking-widest mb-3 ${t.textSecondary}`}>Arquivo JSON de Origem</label>
                            <div
                                className={`relative border-2 border-dashed rounded-[2rem] p-12 text-center transition-all duration-300 cursor-pointer group ${
                                    dragActive 
                                    ? t.dropzoneActive 
                                    : `${t.dropzoneBg} ${t.border}`
                                }`}
                                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                            >
                                <input type="file" accept=".json" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" id="file-upload" />
                                
                                <div className="flex flex-col items-center pointer-events-none">
                                    <div className={`w-20 h-20 rounded-[1.5rem] flex items-center justify-center mb-6 transition-all shadow-sm ${theme === 'dark' ? 'bg-slate-900 border border-white/5 text-cyan-400 group-hover:scale-105' : 'bg-white border border-stone-200 text-stone-900 group-hover:scale-105'}`}>
                                        {file ? <FaFileCode className="text-3xl" /> : <FaCloudUploadAlt className="text-3xl" />}
                                    </div>
                                    <p className="text-xl font-bold transition-colors tracking-tight font-space">
                                        {file ? file.name : 'Arraste o arquivo ou clique aqui'}
                                    </p>
                                    <p className={`text-sm font-semibold mt-2 font-mono-jb ${t.textSecondary}`}>
                                        {file ? `${(file.size / 1024).toFixed(2)} KB` : 'Suporta apenas arquivos no formato JSON'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className={`block text-[11px] font-black uppercase tracking-widest mb-3 flex justify-between items-center ${t.textSecondary}`}>
                                Cardápio em Texto / PDF Bruto
                                <span className={`text-[9px] px-2 py-1 rounded font-bold font-mono-jb ${theme === 'dark' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-800'}`}>BETA</span>
                            </label>
                            <textarea
                                value={rawText}
                                onChange={(e) => setRawText(e.target.value)}
                                placeholder={`Cole aqui o cardápio.\nExemplo:\n\nHamburguers\nX-Salada R$ 25,00\nPão, carne, queijo e salada\n\nX-Bacon R$ 30,00`}
                                className={`w-full h-64 border p-5 rounded-2xl text-sm transition-all focus:outline-none focus:ring-1 focus:ring-current resize-none ${t.inputBg} ${t.border}`}
                            />
                            <p className={`text-xs mt-2 font-medium ${t.textSecondary}`}>O motor inteligente processará linhas com preços (R$ X,XX) como produtos, e as demais como categorias e descrições.</p>
                        </div>
                    )}

                    {/* Aviso e Botão */}
                    {selectedEstabelecimento && modoSubstituicao === 'substituir' && (
                        <div className={`border rounded-2xl p-5 flex gap-4 items-start ${t.alertWarning}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${t.alertWarningIcon}`}>
                                <FaExclamationTriangle size={16} />
                            </div>
                            <div className="text-sm leading-relaxed font-medium">
                                <span className="font-bold block mb-1">Ação Irreversível</span>
                                Iniciar a importação para <strong className={`px-1.5 py-0.5 rounded shadow-sm mx-1 ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-stone-900'}`}>{selectedEstabelecimento.nome}</strong> apagará completamente o cardápio atuante. Certifique-se da escolha antes de acionar.
                            </div>
                        </div>
                    )}
                    
                    {selectedEstabelecimento && modoSubstituicao === 'adicionar' && (
                        <div className={`border rounded-2xl p-5 flex gap-4 items-start ${t.alertSuccess}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${t.alertSuccessIcon}`}>
                                <FaPlusCircle size={16} />
                            </div>
                            <div className="text-sm leading-relaxed font-medium">
                                <span className="font-bold block mb-1">Modo Mesclagem</span>
                                Os itens antigos de <strong className={`px-1.5 py-0.5 rounded shadow-sm mx-1 ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-stone-900'}`}>{selectedEstabelecimento.nome}</strong> serão mantidos. As novas categorias e produtos serão somados ao cardápio atual.
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={!selectedEstabelecimentoId || (importMode === 'json' ? !file : !rawText) || importing}
                        className={`w-full py-5 rounded-[1.5rem] font-bold text-lg hover:scale-[1.01] transition-all shadow-md disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-95 ${t.btnPrimary}`}
                    >
                        {importing ? (
                            <><div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Injetando Dados...</>
                        ) : (
                            <>Executar Importação Global</>
                        )}
                    </button>
                </form>
            </div>
        </div>

        {/* Resultado (Stats) */}
        {importStats && (
            <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 mb-6 px-2">
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${theme === 'dark' ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-500'}`}>
                        <FaCheckCircle className="text-sm" />
                    </div>
                    <h3 className="font-bold text-xl tracking-tight font-bricolage">Operação Concluída com Sucesso</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
                    <StatBox label="Novos Produtos" value={importStats.produtosAdicionados} icon={<FaPlusCircle />} iconColorClass="bg-emerald-500/10 text-emerald-400" themeClass={t} />
                    <StatBox label="Categorias" value={importStats.categoriasProcessadas} icon={<FaStore />} iconColorClass="bg-cyan-500/10 text-cyan-400" themeClass={t} />
                    <StatBox label="Substituídos" value={importStats.produtosRemovidos} icon={<FaTrash />} iconColorClass="bg-red-500/10 text-red-400" themeClass={t} />
                </div>

                {importStats.conversaoEfetuada && (
                    <div className={`p-5 border rounded-2xl text-sm flex items-center gap-3 font-semibold shadow-sm font-space ${theme === 'dark' ? 'bg-blue-950/30 border-blue-500/20 text-blue-200' : 'bg-blue-50 border-blue-100 text-blue-800'}`}>
                        <FaExchangeAlt className={`${theme === 'dark' ? 'text-blue-400' : 'text-blue-500'}`} /> Estrutura antiga detectada e convertida para o motor de cardápio atual (IdeaFood v2 Spec).
                    </div>
                )}
            </div>
        )}

        {/* Guia Rápido */}
        <div className="mt-16 pt-10 border-t border-current opacity-20">
            <h4 className={`text-[11px] font-black uppercase tracking-widest mb-8 text-center md:text-left ${t.textSecondary}`}>Critérios de Carga</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="flex flex-col gap-3">
                    <div className={`w-10 h-10 rounded-[1rem] border shadow-sm flex items-center justify-center font-black text-sm font-mono-jb ${theme === 'dark' ? 'bg-slate-900 border-white/5 text-slate-100' : 'bg-white border-stone-200 text-stone-900'}`}>01</div>
                    <div>
                        <p className="font-bold text-base mb-1 font-space">Matriz Obrigatória</p>
                        <p className={`text-sm font-medium leading-relaxed ${t.textSecondary}`}>O arquivo matriz deve encapsular todo seu conteúdo num array root sinalizado por "categorias".</p>
                    </div>
                </div>
                <div className="flex flex-col gap-3">
                    <div className={`w-10 h-10 rounded-[1rem] border shadow-sm flex items-center justify-center font-black text-sm font-mono-jb ${theme === 'dark' ? 'bg-slate-900 border-white/5 text-slate-100' : 'bg-white border-stone-200 text-stone-900'}`}>02</div>
                    <div>
                        <p className="font-bold text-base mb-1 font-space">Retrocompatibilidade</p>
                        <p className={`text-sm font-medium leading-relaxed ${t.textSecondary}`}>JSONs exportados nas versões legadas do sistema terão as chaves e valores auto-convertidos no push.</p>
                    </div>
                </div>
                <div className="flex flex-col gap-3">
                    <div className={`w-10 h-10 rounded-[1rem] border shadow-sm flex items-center justify-center font-black text-sm font-mono-jb ${theme === 'dark' ? 'bg-slate-900 border-white/5 text-slate-100' : 'bg-white border-stone-200 text-stone-900'}`}>03</div>
                    <div>
                        <p className="font-bold text-base mb-1 font-space">Overwrite Silencioso</p>
                        <p className={`text-sm font-medium leading-relaxed ${t.textSecondary}`}>A carga nova é destrutiva para o cardápio da loja-alvo. Mantenha controle de versão de exportação.</p>
                    </div>
                </div>
            </div>
        </div>

      </main>
    </div>
  );
}

export default ImportarCardapioMaster;