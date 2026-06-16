import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query } from 'firebase/firestore';
import { 
  FiArrowLeft, FiSun, FiMoon, FiLogOut, FiPercent, FiTrash2, 
  FiHome, FiSearch, FiCalendar, FiTrendingUp, FiActivity, FiLayers,
  FiAlertCircle
} from 'react-icons/fi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';

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
          Carregando campanhas e ofertas...
          <span className="block mt-1 text-[10px] text-slate-500 animate-pulse">Sincronizando cupons da rede</span>
        </p>
      </div>
    </div>
  </div>
);

// ─── Skeleton Loader (Bento Grid) ───
const SkeletonCard = ({ themeClass }) => (
  <div className={`p-6 rounded-[2rem] border animate-pulse flex flex-col justify-between h-68 ${themeClass.cardBg} ${themeClass.border}`}>
    <div className="flex justify-between items-start">
      <div className={`w-11 h-11 rounded-[1rem] ${themeClass.inputBg}`}></div>
      <div className={`w-20 h-6 rounded-full ${themeClass.inputBg}`}></div>
    </div>
    <div className="space-y-2 mt-4">
      <div className={`h-6 rounded-lg w-3/4 ${themeClass.inputBg}`}></div>
      <div className={`h-4 rounded-lg w-1/2 ${themeClass.inputBg}`}></div>
    </div>
    <div className={`h-12 rounded-xl mt-6 w-full ${themeClass.inputBg}`}></div>
  </div>
);

const isCupomAtivoHelper = (cupom) => {
  if (cupom.ativo === false) return false;
  if (cupom.validadeFim) {
    let date = null;
    if (typeof cupom.validadeFim.toDate === 'function') {
      date = cupom.validadeFim.toDate();
    } else if (cupom.validadeFim.seconds) {
      date = new Date(cupom.validadeFim.seconds * 1000);
    } else {
      date = new Date(cupom.validadeFim);
    }
    
    if (!isNaN(date.getTime())) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const validadeDate = new Date(date);
      validadeDate.setHours(0, 0, 0, 0);
      if (validadeDate < hoje) return false;
    }
  }
  return true;
};

const isCupomExpiradoHelper = (cupom) => {
  if (!cupom.validadeFim) return false;
  let date = null;
  if (typeof cupom.validadeFim.toDate === 'function') {
    date = cupom.validadeFim.toDate();
  } else if (cupom.validadeFim.seconds) {
    date = new Date(cupom.validadeFim.seconds * 1000);
  } else {
    date = new Date(cupom.validadeFim);
  }
  
  if (isNaN(date.getTime())) return false;
  
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const validadeDate = new Date(date);
  validadeDate.setHours(0, 0, 0, 0);
  return validadeDate < hoje;
};

function MasterCupons() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  const [cupons, setCupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estabMap, setEstabMap] = useState({});
  const [estabList, setEstabList] = useState([]);
  const [filterEstab, setFilterEstab] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');

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

  // Configura título SEO
  useEffect(() => {
    document.title = "IdeaFood - Hub de Promoções da Rede";
  }, []);

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
    if (!currentUser || !isMasterAdmin) return;
    
    const fetchCupons = async () => {
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

        // Busca paralela por subcoleção para evitar collectionGroup lenta ou indexErrors
        const promises = elist.map(est => {
          return getDocs(collection(db, 'estabelecimentos', est.id, 'cupons'));
        });
        const snaps = await Promise.all(promises);
        
        let data = [];
        snaps.forEach((snap, idx) => {
          const est = elist[idx];
          snap.forEach(d => {
            data.push({
              id: d.id,
              ...d.data(),
              _path: d.ref.path,
              estabelecimentoId: est.id,
              estabelecimentoNome: est.nome
            });
          });
        });
        
        // Ordena por ativos primeiro, depois por código
        data.sort((a, b) => {
          const statusA = isCupomAtivoHelper(a) ? 1 : 0;
          const statusB = isCupomAtivoHelper(b) ? 1 : 0;
          if (statusB !== statusA) return statusB - statusA;
          return (a.codigo || a.id).localeCompare(b.codigo || b.id);
        });

        setCupons(data);
      } catch (err) {
        console.error('Erro ao buscar cupons globais', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCupons();
  }, [currentUser, isMasterAdmin]);

  const getEstabId = (cupom) => {
    if (cupom.estabelecimentoId) return cupom.estabelecimentoId;
    if (cupom._path) {
      const parts = cupom._path.split('/');
      const idx = parts.indexOf('estabelecimentos');
      if (idx >= 0) return parts[idx+1];
    }
    return 'desconhecido';
  };

  const cuponsFiltrados = useMemo(() => {
    return cupons.filter(cupom => {
      if (filterEstab !== 'todos') {
        const estabId = getEstabId(cupom);
        if (estabId !== filterEstab) return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const code = (cupom.codigo || cupom.id || '').toLowerCase();
        if (!code.includes(q)) return false;
      }
      return true;
    });
  }, [cupons, filterEstab, searchTerm]);

  // Cálculo das métricas gerais (KPIs Bento)
  const kpiStats = useMemo(() => {
    const total = cuponsFiltrados.length;
    const ativos = cuponsFiltrados.filter(c => isCupomAtivoHelper(c)).length;
    const expirados = total - ativos;

    const pctCupons = cuponsFiltrados.filter(c => c.tipo === 'porcentagem' || c.tipoDesconto === 'percentual');
    const avgPct = pctCupons.length > 0 
      ? pctCupons.reduce((acc, c) => acc + Number(c.valor || c.valorDesconto || 0), 0) / pctCupons.length 
      : 0;

    const uniqueStores = new Set(cuponsFiltrados.map(c => getEstabId(c))).size;

    return { total, ativos, expirados, avgPct, uniqueStores };
  }, [cuponsFiltrados]);

  // Label amigável do Desconto
  const getDescontoLabel = (cupom) => {
    const tipo = cupom.tipo || cupom.tipoDesconto;
    const valor = cupom.valor || cupom.valorDesconto || 0;
    
    if (tipo === 'freteGratis') return 'Frete Grátis';
    if (tipo === 'porcentagem' || tipo === 'percentual') return `${valor}% OFF`;
    return `R$ ${Number(valor).toFixed(2).replace('.', ',')} OFF`;
  };

  // Safe formatting para data de validade
  const formatValidade = (validade) => {
    if (!validade) return 'Sem validade';
    let date = null;
    if (typeof validade.toDate === 'function') date = validade.toDate();
    else if (validade.seconds) date = new Date(validade.seconds * 1000);
    else date = new Date(validade);
    
    if (isNaN(date.getTime())) return 'Sem validade';
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  };

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const themeClasses = {
    dark: {
      bg: 'bg-[#080c16] bg-cyber-grid-dark text-slate-100',
      surface: 'bg-slate-950/45 backdrop-blur-xl border border-white/5 shadow-2xl',
      border: 'border-white/5',
      text: 'text-slate-100 font-space',
      textSecondary: 'text-slate-400 font-space font-medium',
      textMuted: 'text-slate-500 font-space',
      cardBg: 'bg-slate-950/30 backdrop-blur-xl border border-white/5 shadow-2xl',
      inputBg: 'bg-slate-950/30 border-white/10 text-slate-100 focus:border-cyan-500/50 focus:bg-slate-950/50',
      voucherBorder: 'border-white/10',
      voucherActiveBorder: 'border-indigo-500/30 bg-indigo-500/5 text-indigo-400',
      voucherInactiveBorder: 'border-slate-800/80 bg-slate-900/10 text-slate-500',
    },
    light: {
      bg: 'bg-[#fbfbfa] bg-cyber-grid-light text-stone-900',
      surface: 'bg-white/95 backdrop-blur-md border border-stone-200 shadow-md',
      border: 'border-stone-200',
      text: 'text-stone-900 font-space font-bold',
      textSecondary: 'text-stone-650 font-space font-medium',
      textMuted: 'text-stone-400 font-space',
      cardBg: 'bg-[#f5f5f4]/80 backdrop-blur-md border border-stone-200 shadow-sm',
      inputBg: 'bg-[#f5f5f4] border-stone-200 text-stone-900 focus:border-stone-400 focus:bg-white',
      voucherBorder: 'border-stone-200',
      voucherActiveBorder: 'border-indigo-300 bg-indigo-50/50 text-indigo-700',
      voucherInactiveBorder: 'border-stone-200 bg-[#f5f5f4]/45 text-stone-450',
    }
  };

  const t = themeClasses[theme];
  const isDark = theme === 'dark';

  if (authLoading) return <LoadingScreen />;

  if (!currentUser || !isMasterAdmin) {
    return (
      <div className={`min-h-screen ${t.bg} flex items-center justify-center p-10 text-center`}>
        <div className={`p-8 rounded-3xl border ${t.surface} ${t.border} max-w-sm`}>
          <FiAlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className={`text-xl font-bold ${t.text} mb-2`}>Acesso Negado</h2>
          <p className={`text-sm ${t.textSecondary} mb-4`}>Privilégios administrativos insuficientes.</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-black text-white rounded-xl text-sm font-semibold hover:bg-slate-800">Ir para Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${t.bg} transition-colors duration-500 relative overflow-hidden pb-24 pt-4 px-4 sm:px-8 font-space`}>
      
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

      {/* Círculos luminosos flutuantes no fundo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-[-10%] left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tr ${theme === 'dark' ? 'from-blue-500/5 to-transparent' : 'from-blue-500/3 to-transparent'} blur-[140px]`} />
        <div className={`absolute top-1/3 right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr ${theme === 'dark' ? 'from-purple-500/4 to-transparent' : 'from-purple-500/2 to-transparent'} blur-[120px]`} />
      </div>

      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className={`max-w-[1400px] mx-auto backdrop-blur-xl border rounded-full h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all duration-300 ${t.surface} ${t.border}`}>
        <div className="flex items-center gap-4">
          <button id="btn-back-master-dashboard" onClick={() => navigate('/master-dashboard')} className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${theme === 'dark' ? 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white' : 'bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-black'}`}>
            <FiArrowLeft size={16} />
          </button>
          <div className="hidden sm:block border-l pl-4 border-current opacity-60">
            <span className="font-semibold text-sm tracking-tight font-bricolage">Hub de Promoções</span>
            <p className="text-[10px] font-mono-jb font-semibold">{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            id="btn-toggle-theme"
            onClick={toggleTheme}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${theme === 'dark' ? 'bg-slate-900 hover:bg-slate-800 text-yellow-400' : 'bg-stone-100 hover:bg-stone-200 text-amber-600'}`}
            title="Alternar Tema"
          >
            {isDark ? <FiSun size={15} /> : <FiMoon size={15} />}
          </button>
          
          <div className={`w-px h-6 hidden sm:block ${theme === 'dark' ? 'bg-white/10' : 'bg-stone-200'}`} />
          
          <button id="btn-logout" onClick={async () => { await logout(); navigate('/'); }} className="w-9 h-9 bg-red-500/10 hover:bg-red-500/20 rounded-full flex items-center justify-center transition-colors" title="Sair">
            <FiLogOut className="text-red-500" size={15} />
          </button>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto mt-12 relative z-10">
        
        {/* ─── HEADER DA PÁGINA ─── */}
        <div className="flex flex-col mb-10 px-2 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full inline-flex items-center gap-2 ${theme === 'dark' ? 'bg-slate-900 text-cyan-400 border border-cyan-500/20' : 'bg-stone-200 text-stone-900 border border-stone-300'}`}>
              <FiPercent className="text-pink-500" /> Rede Global de Campanhas
            </span>
          </div>
          <h1 id="page-cupons-title" className="text-4xl font-bold tracking-tight font-bricolage">Cupons da Rede</h1>
          <p className={`${t.textSecondary} text-sm mt-2 font-medium`}>Gestão consolidada de todas as ofertas ativas na plataforma de delivery.</p>
        </div>

        {/* ─── METRICAS DE PROMOÇÃO BENTO GRID ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          
          {/* Cupons Ativos */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-[2rem] border p-8 shadow-sm flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${t.cardBg} ${t.border} ${theme === 'dark' ? 'hover:border-emerald-500/30' : 'hover:border-emerald-500/20'}`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-r-full" />
            <div className="flex justify-between items-start mb-6">
               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}><FiPercent size={22} /></div>
               <p className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                 isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
               }`}>Ativos</p>
            </div>
            <div>
               <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${t.textMuted}`}>Cupons Disponíveis</p>
               <p className="text-3xl font-black font-mono-jb leading-tight">{kpiStats.ativos}</p>
            </div>
          </motion.div>

          {/* Cupons Expirados */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className={`rounded-[2rem] border p-8 shadow-sm flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${t.cardBg} ${t.border} ${theme === 'dark' ? 'hover:border-slate-500/30' : 'hover:border-slate-500/20'}`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-500 rounded-r-full" />
            <div className="flex justify-between items-start mb-6">
               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-slate-500/10 text-slate-400' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}><FiActivity size={22} /></div>
               <p className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                 isDark ? 'bg-slate-700/10 text-slate-400' : 'bg-slate-100 text-slate-650'
               }`}>Esgotados</p>
            </div>
            <div>
               <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${t.textMuted}`}>Expirados / Inativos</p>
               <p className="text-3xl font-black font-mono-jb leading-tight">{kpiStats.expirados}</p>
            </div>
          </motion.div>

          {/* Media de Desconto */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`rounded-[2rem] border p-8 shadow-sm flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${t.cardBg} ${t.border} ${theme === 'dark' ? 'hover:border-teal-500/30' : 'hover:border-teal-500/20'}`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-500 rounded-r-full" />
            <div className="flex justify-between items-start mb-6">
               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-50 text-teal-600 border border-teal-100'}`}><FiTrendingUp size={22} /></div>
               <p className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                 isDark ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-50 text-teal-700'
               }`}>Média</p>
            </div>
            <div>
               <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${t.textMuted}`}>Média das Ofertas (%)</p>
               <p className="text-3xl font-black font-mono-jb leading-tight">{kpiStats.avgPct.toFixed(0)}% OFF</p>
            </div>
          </motion.div>

          {/* Lojas Participantes */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`rounded-[2rem] border p-8 shadow-sm flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${t.cardBg} ${t.border} ${theme === 'dark' ? 'hover:border-blue-500/30' : 'hover:border-blue-500/20'}`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full" />
            <div className="flex justify-between items-start mb-6">
               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}><FiLayers size={22} /></div>
               <p className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                 isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-55 text-blue-700'
               }`}>Lojas</p>
            </div>
            <div>
               <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${t.textMuted}`}>Unidades Participantes</p>
               <p className="text-3xl font-black font-mono-jb leading-tight">{kpiStats.uniqueStores}</p>
            </div>
          </motion.div>
        </div>

        {/* ─── FILTROS PILL-STYLE ─── */}
        <div className={`p-4 rounded-3xl border mb-8 flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-300 ${t.surface} ${t.border}`}>
            
            {/* Store Filter */}
            <div className={`relative w-full md:w-80 border rounded-2xl px-4 py-2.5 flex items-center shadow-sm transition-all duration-300 ${t.inputBg} ${t.border}`}>
                <FiHome className={`${t.textSecondary} shrink-0`} size={15} />
                <select 
                    id="select-franchise-cupons"
                    className={`bg-transparent border-none outline-none text-xs ml-3 w-full font-bold cursor-pointer appearance-none focus:ring-0 ${t.text}`}
                    value={filterEstab}
                    onChange={e => setFilterEstab(e.target.value)}
                >
                    <option value="todos" className={isDark ? 'bg-[#080c16] text-slate-100' : 'bg-white text-slate-900'}>Filtrar por todas as Franquias</option>
                    {estabList.map(e => (
                      <option key={e.id} value={e.id} className={isDark ? 'bg-[#080c16] text-slate-100' : 'bg-white text-slate-900'}>
                        {e.nome}
                      </option>
                    ))}
                </select>
                <div className={`pointer-events-none absolute right-4 text-xs ${t.textSecondary}`}>▼</div>
            </div>

            {/* Search Input */}
            <div className={`relative w-full md:w-96 border rounded-2xl px-4 py-2.5 flex items-center shadow-sm transition-all duration-300 ${t.inputBg} ${t.border}`}>
                <FiSearch className={`${t.textSecondary} shrink-0`} size={16} />
                <input 
                    id="input-cupons-search"
                    type="text" 
                    placeholder="Buscar por código de cupom..." 
                    className={`bg-transparent border-none outline-none text-xs ml-3 w-full font-semibold focus:ring-0 placeholder-gray-500 ${t.text}`}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        {/* ─── LISTA DE CUPONS GRID (Voucher Style) ─── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1,2,3,4,5,6,7,8].map(i => <SkeletonCard key={i} themeClass={t} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {cuponsFiltrados.length > 0 ? (
              cuponsFiltrados.map((cupom, idx) => {
                const realNome = cupom.estabelecimentoNome || estabMap[cupom.estabelecimentoId] || 'Geral';
                const isAtivo = isCupomAtivoHelper(cupom);
                const isExpirado = isCupomExpiradoHelper(cupom);
                
                return (
                  <motion.div 
                    key={cupom.id || idx} 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                    className={`border p-6 rounded-[2rem] shadow-md transition-all duration-300 relative group flex flex-col justify-between h-68 overflow-hidden ${t.cardBg} ${t.border} ${theme === 'dark' ? 'hover:bg-slate-900/50 hover:border-slate-700/50 hover:scale-[1.01] hover:shadow-[0_8px_32px_rgba(99,102,241,0.06)]' : 'hover:bg-white hover:border-stone-300/60 hover:scale-[1.01] hover:shadow-[0_8px_30px_rgba(99,102,241,0.02)]'}`}
                  >
                    {/* Linha pontilhada estilizada do voucher */}
                    <div className={`absolute right-0 top-0 bottom-0 w-px border-r-2 border-dashed pointer-events-none mr-24 hidden sm:block ${theme === 'dark' ? 'border-slate-800' : 'border-stone-200'}`} />
                    
                    <div>
                      {/* Badge e Ícone */}
                      <div className="flex justify-between items-start mb-4">
                        <div className={`w-11 h-11 rounded-[1rem] border flex items-center justify-center transition-colors duration-300 ${t.inputBg} ${t.border} text-indigo-400`}>
                            <FiPercent size={18} />
                        </div>
                        
                        {isAtivo ? (
                            <span className={`px-3 py-1.5 rounded-full text-[9px] font-extrabold border uppercase tracking-widest flex items-center gap-1.5 ${theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Ativo
                            </span>
                        ) : isExpirado ? (
                            <span className={`px-3 py-1.5 rounded-full text-[9px] font-extrabold border uppercase tracking-widest flex items-center gap-1.5 ${theme === 'dark' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span> Expirado
                            </span>
                        ) : (
                            <span className={`px-3 py-1.5 rounded-full text-[9px] font-extrabold border uppercase tracking-widest flex items-center gap-1.5 ${theme === 'dark' ? 'bg-slate-900/50 text-slate-400 border-slate-800' : 'bg-stone-100 text-stone-500 border-stone-200'}`}>
                                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span> Inativo
                            </span>
                        )}
                      </div>

                      {/* Código do Cupom */}
                      <div className={`inline-block px-3 py-1.5 rounded-xl border-2 border-dashed font-mono-jb font-black text-sm mb-3 tracking-wider ${
                        isAtivo 
                          ? t.voucherActiveBorder 
                          : t.voucherInactiveBorder
                      }`}>
                        {(cupom.codigo || cupom.id).toUpperCase()}
                      </div>

                      {/* Desconto */}
                      <h3 className="text-2xl font-black tracking-tight mb-2 font-bricolage">
                        {getDescontoLabel(cupom)}
                      </h3>

                      {/* Detalhes de Regra (Validade e Mínimo) */}
                      <div className="space-y-1.5 mb-4 text-[11px] font-semibold">
                        <p className={`flex items-center gap-1.5 ${t.textSecondary}`}>
                          <FiCalendar size={12} className="shrink-0 text-slate-400" />
                          <span className="font-mono-jb">Validade: {formatValidade(cupom.validadeFim)}</span>
                        </p>
                        {cupom.minimoPedido > 0 && (
                          <p className={`flex items-center gap-1.5 ${t.textSecondary}`}>
                            <FiTrendingUp size={12} className="shrink-0 text-slate-400" />
                            <span className="font-mono-jb">Mínimo: R$ {fmt(cupom.minimoPedido)}</span>
                          </p>
                        )}
                        {cupom.usosMaximos > 0 && (
                          <p className={`flex items-center gap-1.5 ${t.textSecondary}`}>
                            <FiActivity size={12} className="shrink-0 text-slate-400" />
                            <span className="font-mono-jb">Usos: {cupom.usosAtuais || 0} / {cupom.usosMaximos}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Unidade */}
                    <div className={`pt-4 border-t ${theme === 'dark' ? 'border-slate-800/80' : 'border-stone-200'}`}>
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-1">Unidade Vinculada</span>
                      <p className={`text-xs font-bold truncate flex items-center gap-1.5 ${t.textSecondary}`} title={realNome}>
                          <FiHome size={12} className="text-indigo-400" /> {realNome}
                      </p>
                    </div>

                  </motion.div>
                );
              })
            ) : (
               <div className={`col-span-full py-20 text-center rounded-[2rem] border shadow-sm transition-all duration-300 ${t.surface} ${t.border}`}>
                 <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 ${t.inputBg}`}>
                    <FiLayers className={`text-xl ${t.textSecondary}`} />
                 </div>
                 <h3 className="text-lg font-bold font-bricolage">Nenhuma Oferta Rastreada</h3>
                 <p className={`text-xs font-semibold ${t.textSecondary} mt-1`}>Nenhum cupom promocional coincide com os filtros aplicados.</p>
               </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default MasterCupons;
