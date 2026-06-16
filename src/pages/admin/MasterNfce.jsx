import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { 
  FiArrowLeft, FiSun, FiMoon, FiLogOut, FiFileText, FiDollarSign, 
  FiTrendingUp, FiClock, FiSearch, FiHome, FiCheckCircle, FiChevronDown, FiActivity,
  FiRefreshCw
} from 'react-icons/fi';
import DateRangeFilter, { getPresetRange } from '../../components/DateRangeFilter';
import { vendaService } from '../../services/vendaService';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Skeleton Loader (Bento Style) ───
const SkeletonRow = ({ isDark }) => (
  <div className={`p-6 flex flex-col sm:flex-row sm:items-center gap-4 animate-pulse border-b ${isDark ? 'border-slate-800/60' : 'border-slate-100'}`}>
    <div className={`w-12 h-12 rounded-2xl shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    <div className="flex-1 space-y-2">
      <div className={`h-4 rounded-lg w-40 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
      <div className={`h-3 rounded-lg w-24 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    </div>
    <div className={`h-6 rounded-lg w-20 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    <div className={`h-8 rounded-full w-24 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
  </div>
);

const LoadingSpinner = ({ t, isDark }) => (
  <div className="text-center py-24 flex flex-col items-center justify-center font-space animate-pulse">
    <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl border border-white/5 bg-slate-950/40 backdrop-blur-xl shadow-md p-3 mx-auto mb-5">
      <motion.img 
        src="/logo-idea-solucoes-transp.png" 
        alt="Logo" 
        animate={{ scale: [0.92, 1.05, 0.92] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        className={`h-8 w-auto object-contain ${isDark ? 'brightness-0 invert' : ''}`} 
      />
    </div>
    <p className={`font-bold text-xs ${t.textSecondary}`}>Escaneando transações fiscais...</p>
  </div>
);

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
          Carregando registros de NFC-e da rede...
          <span className="block mt-1 text-[10px] text-slate-550 animate-pulse">Sincronizando com PlugNotas</span>
        </p>
      </div>
    </div>
  </div>
);

function MasterNfce() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  const [nfces, setNfces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estabMap, setEstabMap] = useState({});
  const [estabList, setEstabList] = useState([]);
  const [filterEstab, setFilterEstab] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingAcao, setLoadingAcao] = useState(null);

  const [datePreset, setDatePreset] = useState('30d');
  const [dateRange, setDateRange] = useState(getPresetRange('30d') || { start: null, end: null });

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

  const themeClasses = {
    dark: {
      bg: 'bg-[#080c16] bg-cyber-grid-dark text-slate-100',
      surface: 'bg-slate-950/45 backdrop-blur-xl border border-white/5 shadow-2xl',
      surfaceHover: 'hover:bg-slate-900/50 hover:border-cyan-500/30 hover:shadow-[0_12px_40px_rgba(6,182,212,0.15)] hover:scale-[1.015] hover:-translate-y-0.5 transition-all duration-300',
      border: 'border-white/5',
      text: 'text-slate-100 font-space',
      textSecondary: 'text-slate-400 font-space font-medium',
      textMuted: 'text-slate-500 font-space font-semibold',
      accent: 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]',
      accentHover: 'hover:bg-cyan-600',
      gradient: 'from-cyan-400 via-violet-500 to-fuchsia-500',
      cardBg: 'bg-slate-950/30 backdrop-blur-xl border border-white/5 shadow-2xl',
      inputBg: 'bg-slate-950/75 border-white/5 focus-within:border-cyan-500/50',
      buttonBg: 'bg-slate-900/80 border-white/5 text-slate-355 hover:border-cyan-500/30 hover:text-white',
    },
    light: {
      bg: 'bg-[#fbfbfa] bg-cyber-grid-light text-stone-900',
      surface: 'bg-white/95 backdrop-blur-md border border-stone-200 shadow-md',
      surfaceHover: 'hover:bg-white hover:border-stone-300 hover:shadow-[0_12px_45px_rgba(28,25,23,0.06)] hover:scale-[1.015] hover:-translate-y-0.5 transition-all duration-300',
      border: 'border-stone-200',
      text: 'text-stone-900 font-space font-bold',
      textSecondary: 'text-stone-750 font-space font-medium',
      textMuted: 'text-stone-400 font-space font-semibold',
      accent: 'bg-[#ff6b35] shadow-sm',
      accentHover: 'hover:bg-[#e85a2a]',
      gradient: 'from-[#ff6b35] via-amber-500 to-[#e85a2a]',
      cardBg: 'bg-[#f5f5f4]/80 backdrop-blur-md border border-stone-200 shadow-sm',
      inputBg: 'bg-stone-100/70 border-stone-200 focus-within:border-[#ff6b35]',
      buttonBg: 'bg-white border-stone-200 text-stone-700 hover:border-stone-400 hover:text-black',
    }
  };

  const selectStyle = theme === 'dark'
      ? "bg-transparent border-none outline-none text-xs ml-3 w-full font-bold text-white cursor-pointer appearance-none"
      : "bg-transparent border-none outline-none text-xs ml-3 w-full font-bold text-stone-900 cursor-pointer appearance-none";

  const t = themeClasses[theme];
  const isDark = theme === 'dark';

  // Configura título SEO
  useEffect(() => {
    document.title = "IdeaFood - Monitoramento Fiscal NFC-e";
  }, []);

  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return;
    
    const fetchNfces = async () => {
      setLoading(true);
      try {
        const estabSnap = await getDocs(collection(db, 'estabelecimentos'));
        const emap = {};
        const elist = [];
        estabSnap.forEach(d => {
            emap[d.id] = d.data().nome || d.id;
            elist.push({ id: d.id, nome: d.data().nome || d.id });
        });
        setEstabMap(emap);
        setEstabList(elist.sort((a,b) => a.nome.localeCompare(b.nome)));

        // Determinação dos limites de data com fallback resiliente
        const start = dateRange.start ? new Date(dateRange.start) : new Date();
        if (!dateRange.start) {
          start.setDate(start.getDate() - 30);
        }
        start.setHours(0,0,0,0);
        
        const end = dateRange.end ? new Date(dateRange.end) : new Date();
        end.setHours(23,59,59,999);

        // Busca paralela por subcoleção para pedidos (que é subcoleção) e busca direta na raiz para vendas (que é coleção raiz)
        const pedPromises = elist.map(est => {
          const pedRef = collection(db, 'estabelecimentos', est.id, 'pedidos');
          return getDocs(query(pedRef, where('createdAt', '>=', start), where('createdAt', '<=', end)));
        });

        const venQuery = query(
          collection(db, 'vendas'),
          where('createdAt', '>=', start),
          where('createdAt', '<=', end)
        );
        const venPromise = getDocs(venQuery);

        const snaps = await Promise.all([...pedPromises, venPromise]);

        const extrairData = (c) => {
          if (!c) return null;
          if (typeof c.toDate === 'function') return c.toDate();
          if (c.seconds) return new Date(c.seconds * 1000);
          const d = new Date(c); return isNaN(d.getTime()) ? null : d;
        };
        const getDate = (item) => extrairData(item.createdAt) || extrairData(item.dataPedido) || extrairData(item.adicionadoEm) || extrairData(item.updatedAt);

        let todosFiltrados = [];

        // Processa snaps de pedidos
        const pedSnaps = snaps.slice(0, elist.length);
        const venSnap = snaps[elist.length];

        pedSnaps.forEach(snap => {
          snap.forEach(d => {
            let data = { id: d.id, ...d.data(), _path: d.ref.path };
            if ((data.fiscal && (data.fiscal.status === 'autorizado' || data.fiscal.status === 'CONCLUIDO')) || !!data.url_danfe || !!data?.fiscal?.urlDanfe) {
              const dt = getDate(data) || new Date(0);
              data._dataCalculada = dt; 
              todosFiltrados.push(data);
            }
          });
        });

        // Processa snap de vendas
        venSnap.forEach(d => {
          let data = { id: d.id, ...d.data(), _path: d.ref.path };
          if ((data.fiscal && (data.fiscal.status === 'autorizado' || data.fiscal.status === 'CONCLUIDO')) || !!data.url_danfe || !!data?.fiscal?.urlDanfe) {
            const dt = getDate(data) || new Date(0);
            data._dataCalculada = dt; 
            todosFiltrados.push(data);
          }
        });

        todosFiltrados.sort((a, b) => b._dataCalculada - a._dataCalculada);
        setNfces(todosFiltrados);
      } catch (err) {
        console.error('Erro ao buscar NFC-es globais', err);
        toast.error('Erro ao buscar dados das franquias.');
      } finally {
        setLoading(false);
      }
    };
    fetchNfces();
  }, [currentUser, isMasterAdmin, dateRange.start, dateRange.end]);

  const handleDatePresetChange = (preset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      const range = getPresetRange(preset);
      if (range) setDateRange(range);
    }
  };

  const handleDateRangeChange = (range) => {
    setDateRange(range);
  };

  const handleDateClear = () => {
    setDatePreset(null);
    setDateRange({ start: null, end: null });
  };

  const getEstabId = (nota) => {
    if (nota.estabelecimentoId) return nota.estabelecimentoId;
    if (nota.estabelecimento_id) return nota.estabelecimento_id;
    if (nota._path) {
      const parts = nota._path.split('/');
      const idx = parts.indexOf('estabelecimentos');
      if (idx >= 0 && parts.length > idx + 1) return parts[idx+1];
    }
    return 'desconhecido';
  };

  const getTotal = (item) => Number(item.totalFinal) || Number(item.total) || Number(item.valorFinal) || Number(item.valorTotal) || 0;

  const nfcesFiltradas = useMemo(() => {
    return nfces.filter(nota => {
      if (filterEstab !== 'todos') {
        const eId = getEstabId(nota);
        if (eId !== filterEstab) return false;
      }
      const txtMatch = (nota.id || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                       (nota.cliente?.nome || nota.clienteNome || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!txtMatch) return false;
      return true;
    });
  }, [nfces, filterEstab, searchTerm]);

  // Cálculo das métricas gerais (KPIs Bento)
  const kpiStats = useMemo(() => {
    const totalNotas = nfcesFiltradas.length;
    const faturamentoFiscal = nfcesFiltradas.reduce((acc, n) => acc + getTotal(n), 0);
    const ticketFiscalMedio = totalNotas > 0 ? faturamentoFiscal / totalNotas : 0;
    
    let ultimaNotaData = null;
    if (totalNotas > 0) {
      const datas = nfcesFiltradas.map(n => n._dataCalculada).filter(Boolean);
      if (datas.length > 0) {
        ultimaNotaData = new Date(Math.max(...datas.map(d => d.getTime())));
      }
    }
    
    return {
      totalNotas,
      faturamentoFiscal,
      ticketFiscalMedio,
      ultimaNota: ultimaNotaData ? format(ultimaNotaData, "dd/MM 'às' HH:mm", { locale: ptBR }) : '--/--'
    };
  }, [nfcesFiltradas]);

  const handleBaixarPdf = async (nota) => {
    const idPlugNotas = nota.fiscal?.idPlugNotas;
    if (!idPlugNotas) {
      toast.error('NFC-e sem identificador PlugNotas. Não é possível baixar o PDF em tempo real.');
      return;
    }
    setLoadingAcao(nota.id);
    try {
      const res = await vendaService.baixarPdfNfce(idPlugNotas, nota.fiscal?.pdf);
      if (res && res.success) {
         // Window opens silently via API response logic
      } else {
        toast.warning(res.error || 'Falha ao baixar o PDF.');
      }
    } catch (err) {
      toast.error('Erro ao baixar PDF da NFC-e');
    } finally {
      setLoadingAcao(null);
    }
  };

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!isMasterAdmin) {
    return (
      <div className={`min-h-screen ${t.bg} flex items-center justify-center p-10 text-center`}>
        <div className={`p-8 rounded-3xl border ${t.surface} ${t.border} max-w-sm`}>
          <FiHome size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className={`text-xl font-bold ${t.text} mb-2`}>Acesso Negado</h2>
          <p className={`text-sm ${t.textSecondary} mb-4`}>Esta área é restrita para administradores master do sistema.</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-black text-white rounded-xl text-sm font-semibold hover:bg-slate-800">Ir para Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${t.bg} transition-colors duration-500 relative overflow-hidden pb-24 pt-4 px-4 sm:px-8 font-space`}>
      
      {/* Estilos e Variáveis Injetadas */}
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
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(99, 102, 241, 0.15);
          border-radius: 10px;
        }
      `}</style>

      {/* Círculos luminosos decorativos de fundo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            x: [0, 50, -30, 0],
            y: [0, -60, 35, 0],
            scale: [1, 1.22, 0.88, 1],
          }}
          transition={{
            duration: 24,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-[-10%] left-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-cyan-500/10 to-transparent blur-[120px]"
        />
        <motion.div
          animate={{
            x: [0, -35, 45, 0],
            y: [0, 45, -45, 0],
            scale: [1, 0.92, 1.18, 1],
          }}
          transition={{
            duration: 26,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-1/3 right-[8%] w-[450px] h-[450px] rounded-full bg-gradient-to-tr from-violet-500/10 to-transparent blur-[100px]"
        />
      </div>

      {/* ─── FLOATING PILL NAVBAR ─── */}
      <div className={`max-w-[1400px] mx-auto border shadow-sm rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between mb-8 gap-4 relative z-10 ${t.cardBg} ${t.border}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/master-dashboard')} className={`p-2.5 rounded-xl border transition-all active:scale-95 ${t.buttonBg} ${t.border}`} title="Voltar ao Painel">
            <FiArrowLeft size={14} />
          </button>
          <button onClick={toggleTheme} className={`p-2.5 rounded-xl border transition-all active:scale-95 ${t.buttonBg} ${t.border}`} title={theme === 'dark' ? "Mudar para tema claro" : "Mudar para tema escuro"}>
            {theme === 'dark' ? <FiSun size={14} className="text-amber-400" /> : <FiMoon size={14} />}
          </button>
          <div>
            <h1 className={`font-black text-sm tracking-tight font-bricolage ${t.text}`}>Monitoramento Fiscal</h1>
            <p className={`text-[11px] font-bold font-space ${t.textSecondary}`}>{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <AnimatePresence>
            {loading && (
              <motion.span 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1.5 text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider border bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              >
                <FiRefreshCw className="animate-spin" size={10} /> Sincronizando
              </motion.span>
            )}
          </AnimatePresence>
          <div className="w-px h-6 bg-white/5 hidden sm:block" />
          <button onClick={async () => { await logout(); navigate('/'); }} className={`p-2.5 rounded-xl border transition-all active:scale-95 shrink-0 ${
            theme === 'dark' ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' : 'bg-red-50 border-red-200 text-red-650 hover:bg-red-100'
          }`} title="Sair">
            <FiLogOut size={14} />
          </button>
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto mt-8 relative z-10">
        
        {/* ─── HEADER & DATE RANGE FILTER ─── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6 px-2 relative z-30 font-space">
          <div>
            <h1 id="page-nfce-title" className={`text-4xl font-black tracking-tight font-bricolage ${t.text}`}>Declarações Fiscais NFC-e</h1>
            <p className={`${t.textSecondary} text-sm mt-1 font-medium`}>Acompanhamento em tempo real de notas fiscais de consumidor emitidas na rede.</p>
          </div>
          
          <div className={`p-2.5 rounded-2xl border shadow-sm flex items-center relative z-40 ${t.cardBg} ${t.border}`}>
            <DateRangeFilter
              activePreset={datePreset}
              dateRange={dateRange}
              onPresetChange={handleDatePresetChange}
              onRangeChange={handleDateRangeChange}
              onClear={handleDateClear}
            />
          </div>
        </div>

        {/* ─── METRICAS FISCAIS BENTO GRID ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8 font-space">
          
          {/* Notas Emitidas */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${t.cardBg} rounded-[2rem] border ${t.border} p-8 shadow-sm flex flex-col justify-between hover:border-emerald-500/40 hover:scale-[1.01] transition-all duration-300 relative overflow-hidden`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-r-full" />
            <div className="flex justify-between items-start mb-6">
               <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-500/20"><FiFileText size={22} /></div>
               <p className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                 isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-250'
               }`}>Emitidas</p>
            </div>
            <div>
               <p className={`text-[10px] font-black ${t.textMuted} uppercase tracking-wider mb-1`}>NFC-es Autorizadas</p>
               <p className={`text-3xl font-black tracking-tight font-mono-jb ${t.text}`}>{kpiStats.totalNotas}</p>
            </div>
          </motion.div>

          {/* Faturamento Fiscalizado */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className={`${t.cardBg} rounded-[2rem] border ${t.border} p-8 shadow-sm flex flex-col justify-between hover:border-indigo-500/40 hover:scale-[1.01] transition-all duration-300 relative overflow-hidden`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r-full" />
            <div className="flex justify-between items-start mb-6">
               <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20"><FiDollarSign size={22} /></div>
               <p className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                 isDark ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-indigo-50 text-indigo-700 border-indigo-250'
               }`}>Volume</p>
            </div>
            <div>
               <p className={`text-[10px] font-black ${t.textMuted} uppercase tracking-wider mb-1`}>Faturamento Emitido</p>
               <p className={`text-3xl font-black tracking-tight font-mono-jb ${t.text}`}>R$ {fmt(kpiStats.faturamentoFiscal)}</p>
            </div>
          </motion.div>

          {/* Ticket Medio Fiscal */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`${t.cardBg} rounded-[2rem] border ${t.border} p-8 shadow-sm flex flex-col justify-between hover:border-teal-500/40 hover:scale-[1.01] transition-all duration-300 relative overflow-hidden`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-500 rounded-r-full" />
            <div className="flex justify-between items-start mb-6">
               <div className="w-14 h-14 bg-teal-500/10 rounded-2xl flex items-center justify-center text-teal-400 border border-teal-500/20"><FiTrendingUp size={22} /></div>
               <p className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                 isDark ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 'bg-teal-50 text-teal-700 border-teal-250'
               }`}>Ticket Médio</p>
            </div>
            <div>
               <p className={`text-[10px] font-black ${t.textMuted} uppercase tracking-wider mb-1`}>Ticket Médio Fiscal</p>
               <p className={`text-3xl font-black tracking-tight font-mono-jb ${t.text}`}>R$ {fmt(kpiStats.ticketFiscalMedio)}</p>
            </div>
          </motion.div>

          {/* Ultima Transacao */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`${t.cardBg} rounded-[2rem] border ${t.border} p-8 shadow-sm flex flex-col justify-between hover:border-blue-500/40 hover:scale-[1.01] transition-all duration-300 relative overflow-hidden`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full" />
            <div className="flex justify-between items-start mb-6">
               <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-500/20"><FiClock size={22} /></div>
               <p className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                 isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-700 border-blue-250'
               }`}>Atualização</p>
            </div>
            <div>
               <p className={`text-[10px] font-black ${t.textMuted} uppercase tracking-wider mb-1`}>Última Emissão Concluída</p>
               <p className={`text-3xl font-black tracking-tight font-mono-jb ${t.text}`}>{kpiStats.ultimaNota}</p>
            </div>
          </motion.div>
        </div>

        {/* ─── FILTROS PILL-STYLE ─── */}
        <div className={`p-4 rounded-3xl border mb-6 flex flex-col md:flex-row items-center justify-between gap-4 font-space ${t.cardBg} ${t.border}`}>
            
            {/* Store Filter */}
            <div className={`relative w-full md:w-80 border rounded-2xl px-4 py-2.5 flex items-center shadow-sm ${t.inputBg} ${t.border}`}>
                <FiHome className={`${t.textSecondary} shrink-0`} size={15} />
                <select 
                    id="select-franchise-filter"
                    className={selectStyle}
                    value={filterEstab}
                    onChange={e => setFilterEstab(e.target.value)}
                >
                    <option value="todos" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Filtrar por todas as Franquias</option>
                    {estabList.map(e => (
                      <option key={e.id} value={e.id} className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>
                        {e.nome}
                      </option>
                    ))}
                </select>
                <FiChevronDown className={`${t.textSecondary} pointer-events-none absolute right-4 text-xs`} />
            </div>

            {/* General Search */}
            <div className={`relative w-full md:w-96 border rounded-2xl px-4 py-2.5 flex items-center shadow-sm ${t.inputBg} ${t.border}`}>
                <FiSearch className={`${t.textSecondary} shrink-0`} size={15} />
                <input 
                    id="input-nfce-search"
                    type="text" 
                    placeholder="Buscar Venda ou Cliente..." 
                    className={`bg-transparent border-none outline-none text-xs ml-3 w-full font-bold placeholder-slate-500 focus:outline-none ${t.text}`}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        {/* ─── LISTA FISCAL BENTO STYLE ─── */}
        <div className={`rounded-[2rem] border overflow-hidden ${t.cardBg} ${t.border}`}>
            {loading ? (
                <div className="divide-y divide-white/5">
                    {[1,2,3,4,5,6].map(i => <SkeletonRow key={i} isDark={isDark} />)}
                </div>
            ) : nfcesFiltradas.length === 0 ? (
                <div className="p-20 text-center font-space">
                    <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 ${t.inputBg}`}>
                        <FiFileText className={`text-xl ${t.textSecondary}`} />
                    </div>
                    <h3 className={`text-lg font-black font-bricolage ${t.text}`}>Nenhum Registro Fiscal</h3>
                    <p className={`text-xs font-semibold ${t.textSecondary}`}>Nenhuma nota fiscal foi emitida para a pesquisa ou período informados.</p>
                </div>
            ) : (
                <div className="divide-y divide-white/5 font-space">
                    {nfcesFiltradas.map((nota, idx) => {
                        const dataCad = nota._dataCalculada ? format(nota._dataCalculada, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '';
                        const estabId = getEstabId(nota);
                        const realNome = estabMap[estabId] || estabId.toUpperCase();
                        const valNum = getTotal(nota);
                        
                        return (
                            <motion.div 
                                key={nota.id || idx} 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                                className={`p-6 flex flex-col lg:flex-row lg:items-center gap-6 transition-all ${t.surfaceHover}`}
                            >
                                {/* Indicator & Identifier */}
                                <div className="flex items-center gap-4 flex-[1.5] min-w-[200px]">
                                    <div className={`w-12 h-12 rounded-2xl border flex flex-col items-center justify-center shrink-0 ${
                                      isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                    }`}>
                                        <FiCheckCircle className="text-sm mb-0.5" />
                                        <span className="text-[8px] font-black tracking-wider uppercase">AUT</span>
                                    </div>
                                    <div>
                                        <p className={`font-black text-sm tracking-tight font-bricolage ${t.text}`}>#{nota.id.substring(0,8).toUpperCase()}</p>
                                        <p className={`text-[11px] font-medium font-space ${t.textSecondary} mt-0.5`}>{dataCad}</p>
                                    </div>
                                </div>

                                {/* Cliente & Valor */}
                                <div className="flex-1 min-w-[150px]">
                                    <p className={`text-sm font-black font-bricolage ${t.text}`}>{nota.cliente?.nome || nota.clienteNome || 'Consumidor Não Identificado'}</p>
                                    <p className={`text-xs font-black font-mono-jb ${t.textMuted} mt-0.5`}>R$ {fmt(valNum)}</p>
                                </div>

                                {/* Franquia Emissora */}
                                <div className="flex-1 min-w-[150px]">
                                    <span className={`text-[10px] uppercase font-bold border px-3.5 py-1.5 rounded-full inline-block truncate max-w-[160px] ${
                                      isDark ? 'bg-slate-900 border-white/5 text-slate-400' : 'bg-stone-100 border-stone-200 text-stone-700'
                                    }`} title={realNome}>
                                        {realNome}
                                    </span>
                                </div>

                                {/* Ações */}
                                <div className="flex-[0.5] min-w-[150px] lg:text-right mt-2 lg:mt-0 flex lg:justify-end">
                                    <button 
                                        onClick={() => handleBaixarPdf(nota)}
                                        disabled={loadingAcao === nota.id}
                                        className={`inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-2xl text-xs font-black transition-all disabled:opacity-50 w-full md:w-auto active:scale-95 shadow-md ${
                                          isDark ? 'bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-cyan-500/15' : 'bg-stone-900 hover:bg-stone-850 text-white'
                                        }`}
                                    >
                                        {loadingAcao === nota.id ? (
                                          <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0"></div>
                                        ) : (
                                          <FiFileText size={13} />
                                        )}
                                        {loadingAcao === nota.id ? 'Baixando...' : 'Obter DANFE'}
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
      </main>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

export default MasterNfce;
