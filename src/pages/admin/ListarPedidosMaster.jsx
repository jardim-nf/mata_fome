import React, { useEffect, useState, useCallback, useRef } from 'react';
import DateRangeFilter, { getPresetRange } from '../../components/DateRangeFilter';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  FiClock, FiHome, FiMapPin, FiCheckCircle, FiAlertCircle, 
  FiPackage, FiArrowLeft, FiLogOut, FiSearch, FiCalendar, 
  FiChevronDown, FiChevronUp, FiRefreshCw, FiActivity, FiUser,
  FiSun, FiMoon
} from 'react-icons/fi';
import { formatCurrency } from '../../utils/formatCurrency';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

// Importa todas as constantes e inteligência do Hook Refatorado
import { 
  useListarPedidosMasterData, 
  STATUS_OPTIONS, 
  LOAD_MORE_ITEMS,
  formatId,
  formatDate,
  getOrderDate
} from '../../hooks/useListarPedidosMasterData';

// --- COMPONENTES VISUAIS PREMIUM ---

const StatusBadge = ({ statusRaw, statusLabel, isDark }) => {
  let statusKey = 'default';
  
  if (['recebido', 'aberto', 'pendente', 'novo'].some(s => statusRaw.includes(s))) statusKey = 'recebido';
  else if (['preparo', 'aceito', 'cozinha'].some(s => statusRaw.includes(s))) statusKey = 'preparo';
  else if (['entrega', 'saiu'].some(s => statusRaw.includes(s))) statusKey = 'em_entrega';
  else if (['finalizado', 'entregue', 'concluido', 'fechado', 'pago'].some(s => statusRaw.includes(s))) statusKey = 'finalizado';
  else if (['cancelado', 'recusado'].some(s => statusRaw.includes(s))) statusKey = 'cancelado';

  const styles = {
    recebido: isDark ? 'bg-slate-700/10 text-slate-300 border-slate-700/20' : 'bg-slate-50 text-slate-650 border-slate-200',
    preparo: isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200',
    em_entrega: isDark ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-cyan-50 text-cyan-700 border-cyan-200',
    finalizado: isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cancelado: isDark ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-700 border-red-200',
    default: isDark ? 'bg-slate-700/10 text-slate-300 border-slate-700/20' : 'bg-slate-50 text-slate-650 border-slate-200',
  };

  const icons = {
    recebido: <FiClock size={12} className="shrink-0" />,
    preparo: <FiActivity size={12} className="shrink-0 animate-pulse" />,
    em_entrega: <FiMapPin size={12} className="shrink-0 animate-bounce" />,
    finalizado: <FiCheckCircle size={12} className="shrink-0" />,
    cancelado: <FiAlertCircle size={12} className="shrink-0" />,
    default: <FiPackage size={12} className="shrink-0" />,
  };

  const labels = {
    recebido: 'NOVO / RECEBIDO',
    preparo: 'EM PREPARO',
    em_entrega: 'EM ENTREGA',
    finalizado: 'FINALIZADO',
    cancelado: 'CANCELADO',
    default: 'DESCONHECIDO',
  };

  const styleClass = styles[statusKey] || styles.default;
  const icon = icons[statusKey] || icons.default;
  const label = statusLabel || labels[statusKey] || labels.default;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${styleClass}`}>
      {icon} {label}
    </span>
  );
};

const OrderCard = ({ item, onViewDetails, t, isDark, idx }) => {
  const orderDate = getOrderDate(item);
  const formattedDate = formatDate(orderDate);
  const formattedId = formatId(item.id);
  const formattedValue = formatCurrency(item.valorFinal);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.02, 0.3) }}
      className={`rounded-[2rem] border shadow-sm transition-all duration-300 flex flex-col overflow-hidden relative ${t.cardBg} ${t.border} ${t.surfaceHover}`}
    >
      <div className={`h-1.5 w-full ${item.tipoExibicao === 'SALÃO' ? 'bg-cyan-500' : (isDark ? 'bg-violet-500' : 'bg-stone-900')}`} />

      <div className="p-8 flex flex-col h-full relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-3">
                <span className={`font-black text-2xl tracking-tight font-bricolage ${t.text}`}>{formattedId}</span>
                <span className={`text-[9px] px-2.5 py-1 rounded-md font-black uppercase tracking-wider border ${
                    item.tipoExibicao === 'SALÃO' 
                      ? (isDark ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-cyan-50 text-cyan-700 border-cyan-200') 
                      : (isDark ? 'bg-violet-500/10 text-violet-450 border-violet-500/20' : 'bg-stone-100 text-stone-900 border-stone-250')
                  }`}
                >
                  {item.tipoExibicao}
                </span>
              </div>
              <span className={`text-[11px] font-medium mt-1.5 flex items-center gap-1.5 ${t.textSecondary}`}>
                <FiClock size={12} /> <span className="font-mono-jb">{formattedDate}</span>
              </span>
            </div>
            <StatusBadge statusRaw={item.statusRaw} statusLabel={item.status} isDark={isDark} />
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-8 font-space">
            <div className={`p-4 rounded-3xl border flex flex-col justify-center ${t.inputBg} ${t.border}`}>
              <span className={`text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 mb-1.5 ${t.textMuted}`}>
                <FiHome size={11} /> Operação
              </span>
              <span className={`block font-bold text-sm truncate ${t.text}`} title={item.estabelecimentoNomeFinal}>
                {item.estabelecimentoNomeFinal}
              </span>
            </div>
            <div className={`p-4 rounded-3xl border flex flex-col justify-center ${t.inputBg} ${t.border}`}>
              <span className={`text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 mb-1.5 ${t.textMuted}`}>
                <FiUser size={11} /> Consumidor
              </span>
              <span className={`block font-bold text-sm truncate ${t.text}`} title={item.clienteNomeFinal}>
                {item.clienteNomeFinal}
              </span>
            </div>
          </div>

          <div className="mt-auto flex justify-between items-center pt-6 border-t border-white/5 font-space">
            <div>
              <span className={`text-[9px] font-black uppercase tracking-wider block mb-1 ${t.textMuted}`}>Fechamento</span>
              <span className={`font-black text-2xl tracking-tighter font-mono-jb ${t.text}`}>
                {formattedValue}
              </span>
            </div>
            <button 
              onClick={() => onViewDetails(item.id, item._path)} 
              className={`flex items-center gap-2 px-6 py-3 rounded-full text-xs font-black transition-all active:scale-95 shadow-md ${
                isDark ? 'bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-cyan-500/15' : 'bg-stone-900 hover:bg-stone-850 text-white'
              }`}
            >
              Ver Detalhes
            </button>
          </div>
      </div>
    </motion.div>
  );
};

const FilterBar = ({ 
  searchTerm, onSearchChange, filterEstabelecimento, onEstabelecimentoChange, estabelecimentosList, filterStatus, onStatusChange, totalItems, displayedItems, t, isDark, theme, selectStyle
}) => {
  return (
    <div className={`p-4 rounded-[2rem] border mb-8 flex flex-col xl:flex-row gap-4 relative z-10 w-full font-space ${t.cardBg} ${t.border}`}>
      <div className={`flex-1 relative border rounded-2xl px-4 py-2.5 flex items-center shadow-sm ${t.inputBg} ${t.border}`}>
        <FiSearch className={`${t.textSecondary} shrink-0`} size={15} />
        <input 
          type="text" 
          placeholder="Buscar Ticket (Código, Cliente ou Franquia)..." 
          className={`bg-transparent border-none outline-none text-xs ml-3 w-full font-bold placeholder-slate-500 focus:outline-none ${t.text}`}
          value={searchTerm} 
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3 xl:w-auto w-full">
        <div className={`relative border rounded-2xl px-4 py-2.5 flex items-center shadow-sm ${t.inputBg} ${t.border} min-w-[200px]`}>
          <select 
            className={selectStyle} 
            value={filterEstabelecimento} 
            onChange={e => onEstabelecimentoChange(e.target.value)}
          >
            <option value="todos" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Varrer Todas as Lojas</option>
            {estabelecimentosList.map(e => (
              <option key={e.id} value={e.id} className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>{e.nome}</option>
            ))}
          </select>
          <FiChevronDown className={`${t.textSecondary} pointer-events-none absolute right-4 text-xs`} />
        </div>

        <div className={`relative border rounded-2xl px-4 py-2.5 flex items-center shadow-sm ${t.inputBg} ${t.border} min-w-[180px]`}>
          <select 
            className={selectStyle} 
            value={filterStatus} 
            onChange={e => onStatusChange(e.target.value)}
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value} className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>{opt.label}</option>
            ))}
          </select>
          <FiChevronDown className={`${t.textSecondary} pointer-events-none absolute right-4 text-xs`} />
        </div>

        <div className={`flex items-center justify-center px-5 py-2.5 rounded-2xl text-xs font-black border whitespace-nowrap font-mono-jb ${t.buttonBg} ${t.border} ${t.text}`}>
          {displayedItems} / {totalItems} tickets
        </div>
      </div>
    </div>
  );
};

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
    <p className={`font-bold text-xs ${t.textSecondary}`}>Escaneando transações em tempo real...</p>
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
          Estabelecendo conexão segura com a rede logística...
          <span className="block mt-1 text-[10px] text-slate-550 animate-pulse">Sincronizando banco de dados</span>
        </p>
      </div>
    </div>
  </div>
);

const EmptyState = ({ onClearFilters, t }) => (
  <div className={`col-span-1 xl:col-span-2 text-center py-20 rounded-[2rem] border flex flex-col items-center justify-center font-space ${t.cardBg} ${t.border}`}>
    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${t.inputBg}`}>
      <FiPackage className={`text-xl ${t.textSecondary}`} />
    </div>
    <h3 className={`text-lg font-black font-bricolage ${t.text}`}>Oceano Azul</h3>
    <p className={`text-xs font-semibold ${t.textSecondary} mt-1`}>Nenhum ticket encontrado para este período ou filtro.</p>
    <button 
      onClick={onClearFilters} 
      className={`mt-6 px-6 py-3 rounded-2xl font-black text-xs transition-all border ${t.buttonBg} ${t.border} ${t.text}`}
    >
      Limpar todos os filtros
    </button>
  </div>
);

// --- COMPONENTE PRINCIPAL ---
function ListarPedidosMaster() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const containerRef = useRef(null);

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
      surfaceHover: 'hover:bg-white hover:border-stone-400 hover:shadow-[5px_5px_0px_0px_rgba(28,25,23,0.9)] hover:scale-[1.01] hover:-translate-y-0.5 transition-all duration-300',
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

  // Instanciando The One Hook!
  const {
    searchTerm, setSearchTerm,
    filterEstabelecimento, setFilterEstabelecimento,
    filterStatus, setFilterStatus,
    dateRange, setDateRange,
    datePreset, setDatePreset,
    dateInicio, setDateInicio,
    dateFim, setDateFim,
    estabelecimentos,
    ordersLoading,
    estabError, ordersError,
    listaFinal,
    displayed,
    displayedPaginated,
    handleClearFilters,
    handleLoadMore
  } = useListarPedidosMasterData({ currentUser, isMasterAdmin });

  // Handlers
  const handleViewDetails = useCallback((orderId, docPath) => {
    navigate(`/master/pedidos/${orderId}?p=${encodeURIComponent(docPath || '')}`);
  }, [navigate]);

  // DateRangeFilter handlers formatados para a lib Component DateRange
  const handleDatePresetChange = useCallback((preset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      const range = getPresetRange(preset);
      if (range) {
        setDateRange(range);
        setDateInicio(range.start);
        setDateFim(range.end);
      }
    }
  }, [setDatePreset, setDateRange, setDateInicio, setDateFim]);

  const handleDateRangeChange = useCallback((range) => {
    setDateRange(range);
    setDateInicio(range.start);
    setDateFim(range.end);
  }, [setDateRange, setDateInicio, setDateFim]);

  const handleDateClear = useCallback(() => {
    setDatePreset(null);
    setDateRange({ start: null, end: null });
    setDateInicio(null);
    setDateFim(null);
  }, [setDatePreset, setDateRange, setDateInicio, setDateFim]);

  // Scroll to top button Event
  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        setShowScrollTop(containerRef.current.scrollTop > 400);
      }
    };
    const currentRef = containerRef.current;
    if (currentRef) {
      currentRef.addEventListener('scroll', handleScroll);
      return () => currentRef.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scrollToTop = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (authLoading) {
    return <LoadingScreen />;
  }

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

  const error = estabError || ordersError;

  return (
    <div 
      ref={containerRef}
      className={`min-h-screen ${t.bg} transition-colors duration-500 relative overflow-auto pb-24 pt-4 px-4 sm:px-8 font-space`}
    >
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
            <h1 className={`font-black text-sm tracking-tight font-bricolage ${t.text}`}>Monitoramento Logístico</h1>
            <p className={`text-[11px] font-bold font-space ${t.textSecondary}`}>{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <AnimatePresence>
            {ordersLoading && (
              <motion.span 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1.5 text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider border bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              >
                <FiRefreshCw className="animate-spin" size={10} /> Escaneando Rede
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

      <div className="max-w-[1400px] mx-auto mt-8 relative z-10">
        
        {/* HEADER DA PÁGINA */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-8 gap-6 px-2">
          <div>
            <h1 className={`text-4xl font-black tracking-tight font-bricolage ${t.text}`}>Tickets Abertos (Geral)</h1>
            <p className={`text-sm mt-1 font-medium font-space ${t.textSecondary}`}>Comutação global de recebimento — Delivery e Salão.</p>
          </div>
          <div className={`border rounded-2xl px-4 py-2.5 shadow-sm flex items-center ${t.cardBg} ${t.border}`}>
            <DateRangeFilter
              datePreset={datePreset}
              dateRange={dateRange}
              onPresetChange={handleDatePresetChange}
              onRangeChange={handleDateRangeChange}
              onClear={handleDateClear}
            />
          </div>
        </div>
        
        {/* BARRA DE FILTROS */}
        <FilterBar 
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filterEstabelecimento={filterEstabelecimento}
          onEstabelecimentoChange={setFilterEstabelecimento}
          estabelecimentosList={estabelecimentos}
          filterStatus={filterStatus}
          onStatusChange={setFilterStatus}
          totalItems={listaFinal.length}
          displayedItems={displayedPaginated.length}
          t={t}
          isDark={isDark}
          theme={theme}
          selectStyle={selectStyle}
        />

        {/* ERROR STATE */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-3xl text-sm font-bold flex items-center gap-2 font-space">
            <FiAlertCircle className="shrink-0" /> {error}
            <button onClick={() => window.location.reload()} className="ml-auto underline hover:text-white">Forçar Recarregamento</button>
          </div>
        )}

        {/* LISTA DE PEDIDOS */}
        {ordersLoading && displayed.length === 0 ? (
          <LoadingSpinner t={t} isDark={isDark} />
        ) : (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8 pb-12">
              {displayedPaginated.length > 0 ? (
                displayedPaginated.map((item, idx) => (
                  <OrderCard 
                    key={item.id} 
                    item={item} 
                    onViewDetails={handleViewDetails}
                    t={t}
                    isDark={isDark}
                    idx={idx}
                  />
                ))
              ) : (
                <EmptyState onClearFilters={handleClearFilters} t={t} />
              )}
            </div>

            {/* LOAD MORE BUTTON */}
            {displayedPaginated.length < displayed.length && (
              <div className="flex justify-center pb-8 font-space">
                <button
                  onClick={handleLoadMore}
                  className={`px-8 py-4 rounded-full font-black text-xs transition-all border shadow-sm active:scale-95 ${t.buttonBg} ${t.border} ${t.text}`}
                >
                  Continuar listagem ({Math.min(LOAD_MORE_ITEMS, displayed.length - displayedPaginated.length)} tickets)
                </button>
              </div>
            )}
          </>
        )}

        {/* SCROLL TO TOP BUTTON */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className={`fixed bottom-8 right-8 p-4 rounded-full shadow-lg transition-all active:scale-95 z-50 flex items-center justify-center w-14 h-14 ${
              isDark ? 'bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-cyan-500/15' : 'bg-stone-900 hover:bg-stone-850 text-white'
            }`}
            aria-label="Voltar ao topo"
          >
            <FiChevronUp size={18} />
          </button>
        )}
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

export default ListarPedidosMaster;