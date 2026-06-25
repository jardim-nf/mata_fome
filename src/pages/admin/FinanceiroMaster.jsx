import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { differenceInDays } from 'date-fns';
import { useFinanceiroMasterData } from '../../hooks/useFinanceiroMasterData';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { 
  FiArrowLeft, FiSun, FiMoon, FiLogOut, FiPlus, FiLayers, FiCheck, FiX,
  FiDollarSign, FiCalendar, FiAlertCircle, FiCheckCircle, FiTrendingUp,
  FiClock, FiSearch, FiBriefcase, FiPhone, FiMail, FiMessageCircle, FiActivity, FiRotateCcw, FiChevronDown,
  FiTrash2, FiEdit2
} from 'react-icons/fi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Skeleton Loader (Bento Mosaico) ───
const SkeletonRow = ({ isDark }) => (
  <div className={`p-6 flex flex-col lg:flex-row lg:items-center gap-6 animate-pulse border-b ${isDark ? 'border-slate-800/60' : 'border-slate-100'}`}>
    <div className={`w-14 h-14 rounded-2xl shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    <div className="flex-1 space-y-2">
      <div className={`h-4 rounded-lg w-40 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
      <div className={`h-3 rounded-lg w-24 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    </div>
    <div className="w-24 space-y-1">
      <div className={`h-3 rounded-md w-12 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
      <div className={`h-6 rounded-md w-16 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    </div>
    <div className="flex-1">
      <div className={`h-6 rounded-full w-24 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    </div>
    <div className="flex-1 flex gap-2 lg:justify-end">
      <div className={`h-10 rounded-full w-10 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
      <div className={`h-10 rounded-full w-32 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    </div>
  </div>
);

function FinanceiroMaster() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  const [confirmDialog, setConfirmDialog] = useState(null);

  const showConfirm = (message, title = 'Confirmação', variant = 'default', confirmText = 'Confirmar', cancelText = 'Cancelar') => {
    return new Promise(resolve => {
      setConfirmDialog({
        title,
        message,
        variant,
        confirmText,
        cancelText,
        resolve
      });
    });
  };

  const {
    faturasFiltradas, estabs, loading, 
    filtroStatus, setFiltroStatus,
    searchQuery, setSearchQuery,
    sortBy, setSortBy,
    modalOpen, setModalOpen,
    novaFatura, setNovaFatura,
    modalMassa, setModalMassa,
    massaConfig, setMassaConfig,
    loadingMassa,
    modalEditOpen, setModalEditOpen,
    faturaEmEdicao, setFaturaEmEdicao,
    abrirModalEdicao, handleEditarFatura,
    resumo,
    handleCriarFatura, handleBaixa, handleCobrancaEmMassa, handleLembreteWhatsApp, handleExcluirFatura,
    formatData, getVencimentoStatus, parseDate
  } = useFinanceiroMasterData(showConfirm);

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
  React.useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@300;400;500;650;700&display=swap';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
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

  const getStatusBadge = (fatura) => {
    const status = getVencimentoStatus(fatura);
    const styles = {
      pago: isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
      atrasado: isDark ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-700 border-red-200',
      vencendo: isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200',
      pendente: isDark ? 'bg-slate-700/10 text-slate-300 border-slate-700/20' : 'bg-slate-50 text-slate-600 border-slate-200',
    };
    
    const icons = {
      pago: <FiCheckCircle className="shrink-0" size={12} />, 
      atrasado: <FiAlertCircle className="shrink-0" size={12} />,
      vencendo: <FiClock className="shrink-0" size={12} />, 
      pendente: <FiCalendar className="shrink-0" size={12} />,
    };
    const labels = { pago: 'PAGO', atrasado: 'ATRASADO', vencendo: 'VENCE LOGO', pendente: 'PENDENTE' };

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-full uppercase tracking-wider border ${styles[status]} ${status === 'atrasado' ? 'animate-pulse' : ''}`}>
        {icons[status]} {labels[status]}
      </span>
    );
  };

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Admin';

  if (authLoading) {
    return (
      <div className={`min-h-screen ${t.bg} flex items-center justify-center`}>
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isMasterAdmin) {
    return (
      <div className={`min-h-screen ${t.bg} flex items-center justify-center p-10 text-center`}>
        <div className={`p-8 rounded-3xl border ${t.surface} ${t.border} max-w-sm`}>
          <FiAlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className={`text-xl font-bold ${t.text} mb-2`}>Acesso Negado</h2>
          <p className={`text-sm ${t.textSecondary} mb-4`}>Esta área é restrita para administradores master do sistema.</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">Ir para Home</button>
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
      <div className={`max-w-[1400px] mx-auto border shadow-sm rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between mb-8 gap-4 relative z-10 ${t.cardBg} ${t.border}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/master-dashboard')} className={`p-2.5 rounded-xl border transition-all active:scale-95 ${t.buttonBg} ${t.border}`} title="Voltar ao Painel">
            <FiArrowLeft size={14} />
          </button>
          <button onClick={toggleTheme} className={`p-2.5 rounded-xl border transition-all active:scale-95 ${t.buttonBg} ${t.border}`} title={theme === 'dark' ? "Mudar para tema claro" : "Mudar para tema escuro"}>
            {theme === 'dark' ? <FiSun size={14} className="text-amber-400" /> : <FiMoon size={14} />}
          </button>
          <div>
            <h1 className={`font-black text-sm tracking-tight font-bricolage ${t.text}`}>Módulo Financeiro</h1>
            <p className={`text-[11px] font-bold font-space ${t.textSecondary}`}>{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto mt-8 relative z-10">
        
        {/* ─── HEADER ─── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 px-2">
          <div>
            <h1 className={`text-4xl font-black tracking-tight font-bricolage ${t.text}`}>Recebíveis da Rede</h1>
            <p className={`${t.textSecondary} text-sm mt-1 font-medium font-space`}>Gestão de mensalidades, cobranças e faturamento consolidado.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setModalOpen(true)} 
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs transition-all active:scale-95 shadow-md ${
                theme === 'dark' ? 'bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-cyan-500/15' : 'bg-[#ff6b35] hover:bg-[#e85a2a] text-white'
              }`}
            >
              <FiPlus size={14} /> Nova Cobrança
            </button>
            <button 
              onClick={() => setModalMassa(true)}
              className={`flex items-center gap-2 border px-5 py-3 rounded-2xl shadow-sm font-black text-xs transition-all active:scale-95 ${t.buttonBg} ${t.border} ${t.text}`}
            >
              <FiLayers size={14} /> Em Massa
            </button>
          </div>
        </div>

        {/* ─── QUICK STATS BAR ─── */}
        <div className="flex flex-wrap items-center gap-2.5 mb-6 px-2 font-space">
          <span className={`rounded-full px-4 py-2 border shadow-sm text-[10px] font-bold flex items-center gap-2 ${t.cardBg} ${t.border} ${t.text}`}>
            <span className="w-2 h-2 rounded-full bg-cyan-500"></span> {resumo.totalFaturas} lançamentos processados
          </span>
          {resumo.vencendoHoje > 0 && (
            <span className={`rounded-full px-4 py-2 border text-[10px] font-bold flex items-center gap-2 animate-pulse ${
              isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              ⏰ {resumo.vencendoHoje} faturas vencendo hoje
            </span>
          )}
        </div>

        {/* ─── METRICAS FINANCEIRAS BENTO GRID ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          
          {/* Caixa Recebido */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${t.cardBg} rounded-[2rem] border ${t.border} p-8 shadow-sm flex flex-col justify-between hover:border-emerald-500/40 transition-all duration-300 relative overflow-hidden`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-r-full" />
            <div className="flex justify-between items-start mb-6">
               <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400"><FiCheckCircle size={22} /></div>
               <p className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                 isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
               }`}>{resumo.pagosCount} pagos</p>
            </div>
            <div>
               <p className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider mb-1`}>Caixa Recebido</p>
               <p className={`text-3xl font-black tracking-tight ${t.text}`}>R$ {fmt(resumo.pago)}</p>
            </div>
          </motion.div>

          {/* A Receber */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className={`${t.cardBg} rounded-[2rem] border ${t.border} p-8 shadow-sm flex flex-col justify-between hover:border-blue-500/40 transition-all duration-300 relative overflow-hidden`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full" />
            <div className="flex justify-between items-start mb-6">
               <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400"><FiClock size={22} /></div>
               <p className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                 isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700'
               }`}>{resumo.pendentesCount} abertos</p>
            </div>
            <div>
               <p className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider mb-1`}>A Receber</p>
               <p className={`text-3xl font-black tracking-tight ${t.text}`}>R$ {fmt(resumo.pendente)}</p>
            </div>
          </motion.div>

          {/* Em Atraso */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`rounded-[2rem] p-8 shadow-md flex flex-col justify-between relative overflow-hidden group border transition-all duration-300 ${
              resumo.atrasados > 0 
                ? (isDark ? 'bg-red-500/5 border-red-500/30' : 'bg-red-50 border-red-200') 
                : `${t.cardBg} ${t.border} hover:border-red-500/20`
            }`}
          >
            {resumo.atrasados > 0 && <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl pointer-events-none"></div>}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-r-full" />
            <div className="relative z-10 flex justify-between items-start mb-6">
               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                 resumo.atrasados > 0 
                   ? 'bg-red-500/10 text-red-400' 
                   : (isDark ? 'bg-slate-700/10 text-slate-400' : 'bg-slate-100 text-slate-500')
               }`}><FiAlertCircle size={22} /></div>
               <p className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                 resumo.atrasados > 0 
                   ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700') 
                   : (isDark ? 'bg-slate-700/25 text-slate-400' : 'bg-slate-100 text-slate-650')
               }`}>
                 {resumo.atrasados > 0 ? `${resumo.atrasados} atrasados` : 'Sem pendências 🎉'}
               </p>
            </div>
            <div className="relative z-10">
               <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${resumo.atrasados > 0 ? 'text-red-400' : t.textMuted}`}>Em Atraso</p>
               <p className={`text-3xl font-black tracking-tight ${resumo.atrasados > 0 ? 'text-red-500' : t.text}`}>R$ {fmt(resumo.valorAtrasado)}</p>
            </div>
          </motion.div>

          {/* Total Movimentado */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`rounded-[2rem] border p-8 shadow-md flex flex-col justify-between relative overflow-hidden group transition-all duration-300 ${
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-900 border-slate-900 text-white'
            }`}
          >
            <div className="absolute -left-10 -bottom-10 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="relative z-10 flex justify-between items-start mb-6">
               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-white/10 text-blue-300'}`}><FiDollarSign size={22} /></div>
            </div>
            <div className="relative z-10">
               <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-300'}`}>Total Movimentado</p>
               <p className={`text-3xl font-black tracking-tight mb-2 ${isDark ? 'text-white' : 'text-white'}`}>R$ {fmt(resumo.total)}</p>
               <div className={`w-full rounded-full h-1 overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-white/20'}`}>
                 <div className="bg-gradient-to-r from-blue-500 to-indigo-500 h-1" style={{width: `${resumo.total > 0 ? (resumo.pago / resumo.total * 100) : 0}%`}}></div>
               </div>
            </div>
          </motion.div>

        </div>

        {/* ─── FILTROS PILL-STYLE ─── */}
        <div className={`p-4 rounded-3xl border mb-6 flex flex-col md:flex-row items-center justify-between gap-4 font-space ${t.cardBg} ${t.border}`}>
          {/* Status Filters */}
          <div className="flex overflow-x-auto hide-scrollbar gap-2 w-full md:w-auto">
            {[
              { id: 'todos', label: 'Histórico Completo', count: resumo.totalFaturas },
              { id: 'pendente', label: 'Pendentes', count: resumo.pendentesCount },
              { id: 'atrasado', label: 'Atrasados', count: resumo.atrasados },
              { id: 'pago', label: 'Caixa Efetuado', count: resumo.pagosCount },
            ].map(s => (
              <button key={s.id} onClick={() => setFiltroStatus(s.id)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap border
                  ${filtroStatus === s.id 
                    ? (theme === 'dark' ? 'bg-cyan-500 border-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'bg-[#ff6b35] border-[#ff6b35] text-white shadow-md shadow-[#ff6b35]/20') 
                    : `${t.buttonBg} ${t.border} ${t.textSecondary} hover:${t.text} hover:opacity-95`
                  }`}
              >
                {s.label}
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  filtroStatus === s.id 
                    ? (theme === 'dark' ? 'bg-slate-950 text-cyan-400' : 'bg-white text-[#ff6b35]') 
                    : (isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')
                }`}>{s.count}</span>
              </button>
            ))}
          </div>

          {/* Controls: Sort & Search */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto font-space">
            {/* Sort Dropdown */}
            <div className={`relative w-full sm:w-60 border rounded-2xl px-4 py-2.5 flex items-center shadow-sm ${t.inputBg} ${t.border}`}>
              <FiCalendar className={`${t.textSecondary} shrink-0`} size={14} />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className={selectStyle}
              >
                <option value="data_desc" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Data (Mais Recente)</option>
                <option value="data_asc" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Data (Mais Antigo)</option>
                <option value="valor_desc" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Valor (Maior)</option>
                <option value="valor_asc" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Valor (Menor)</option>
                <option value="nome_asc" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Loja (A-Z)</option>
              </select>
              <FiChevronDown className={`${t.textSecondary} pointer-events-none absolute right-4 text-xs`} />
            </div>

            {/* Search Pill */}
            <div className={`relative w-full sm:w-60 md:w-72 border rounded-2xl px-4 py-2.5 flex items-center shadow-sm ${t.inputBg} ${t.border}`}>
              <FiSearch className={`${t.textSecondary} shrink-0`} size={15} />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className={`bg-transparent border-none outline-none text-xs ml-3 w-full font-bold placeholder-slate-500 focus:outline-none ${t.text}`}
                placeholder="Buscar por loja..." />
            </div>
          </div>
        </div>

        {/* ─── LIST VIEW (Minimalist Table Bento Format) ─── */}
        <div className={`rounded-[2rem] border overflow-hidden ${t.cardBg} ${t.border}`}>
          {loading ? (
            <div className="divide-y divide-white/5">
               {[1,2,3,4,5].map(i => <SkeletonRow key={i} isDark={isDark} />)}
            </div>
          ) : faturasFiltradas.length === 0 ? (
            <div className="p-20 text-center">
              <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 ${t.inputBg}`}>
                <FiSearch className={`text-xl ${t.textSecondary}`} />
              </div>
              <h3 className={`text-lg font-black ${t.text} font-bricolage`}>Sem Lançamentos</h3>
              <p className={`text-xs font-semibold ${t.textSecondary} font-space`}>Nenhuma fatura registrada foi encontrada para esta busca.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
               {faturasFiltradas.map((fatura, idx) => (
                 <motion.div 
                    key={fatura.id || idx} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                    className={`p-6 flex flex-col lg:flex-row lg:items-center gap-6 transition-all ${t.surfaceHover}`}
                 >
                    
                    {/* Block: Identity */}
                    <div className="flex items-center gap-4 flex-[2] min-w-[220px]">
                      <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${t.inputBg} ${t.border}`}>
                        <FiBriefcase className={`${t.textSecondary}`} size={16} />
                      </div>
                      <div>
                        <p className={`font-black text-sm tracking-tight font-bricolage ${t.text} line-clamp-1`}>{fatura.estabelecimentoNome}</p>
                        <p className={`text-[11px] font-medium font-space ${t.textSecondary} mt-0.5`}>{fatura.descricao}</p>
                      </div>
                    </div>

                    {/* Block: Date and Amount */}
                    <div className="flex flex-row justify-between lg:flex-col lg:justify-center flex-1 gap-1.5 font-space">
                       <p className={`text-[11px] font-bold ${t.textSecondary} flex items-center gap-1.5`}>
                         <FiCalendar size={11} /> <span className="font-mono-jb">{formatData(fatura.vencimento)}</span>
                       </p>
                       <p className={`font-black text-xl font-mono-jb ${t.text}`}>R$ {fmt(fatura.valor)}</p>
                    </div>

                    {/* Block: Status Badge */}
                    <div className="flex-[1.5] w-full lg:w-auto flex items-center gap-2 flex-wrap font-space">
                       {getStatusBadge(fatura)}
                       {getVencimentoStatus(fatura) === 'atrasado' && (
                          <span className="text-[9px] font-black text-red-500 animate-pulse bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 font-mono-jb">
                             (+{differenceInDays(new Date(), parseDate(fatura.vencimento))} dias)
                          </span>
                       )}
                    </div>

                    {/* Block: Actions */}
                    <div className="flex flex-row items-center gap-2 justify-end flex-1 mt-4 lg:mt-0 pt-4 lg:pt-0 border-t border-white/5 lg:border-0 font-space">
                      {getVencimentoStatus(fatura) === 'atrasado' && (
                         <button 
                           onClick={() => handleLembreteWhatsApp(fatura)}
                           className={`w-10 h-10 border rounded-xl flex items-center justify-center transition-all active:scale-95 shrink-0 ${
                             theme === 'dark' ? 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20' : 'bg-green-50 border-green-200 text-green-600 hover:bg-green-100'
                           }`}
                           title="Notificar via WhatsApp"
                         >
                           <FiMessageCircle size={16} />
                         </button>
                      )}
                      
                      <button 
                        onClick={() => handleExcluirFatura(fatura)}
                        className={`w-10 h-10 border rounded-xl flex items-center justify-center transition-all active:scale-95 shrink-0 ${
                          theme === 'dark' ? 'bg-rose-500/10 border-rose-500/20 text-rose-450 hover:bg-rose-500/20' : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                        }`}
                        title="Excluir Fatura"
                      >
                        <FiTrash2 size={16} />
                      </button>
                      
                      <button 
                        onClick={() => abrirModalEdicao(fatura)}
                        className={`w-10 h-10 border rounded-xl flex items-center justify-center transition-all active:scale-95 shrink-0 ${
                          theme === 'dark' ? 'bg-blue-500/10 border-blue-500/20 text-blue-450 hover:bg-blue-500/20' : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'
                        }`}
                        title="Editar Cobrança"
                      >
                        <FiEdit2 size={16} />
                      </button>
                      
                      {fatura.status === 'pago' ? (
                          <button 
                            onClick={() => handleBaixa(fatura)}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 border ${
                              theme === 'dark' ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' : 'bg-red-50 border-red-200 text-red-655 hover:bg-red-100'
                            }`}
                          >
                            <FiRotateCcw size={12} /> Estornar
                          </button>
                      ) : (
                          <button 
                            onClick={() => handleBaixa(fatura)}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 border shadow-md ${
                              theme === 'dark' ? 'bg-cyan-500 border-cyan-500 text-slate-950 hover:bg-cyan-600' : 'bg-stone-900 border-stone-900 text-white hover:bg-stone-850'
                            }`}
                          >
                            <FiCheck size={12} /> Baixar
                          </button>
                      )}
                    </div>

                 </motion.div>
               ))}
            </div>
          )}
        </div>

        {/* ─── MODAL: NOVA COBRANÇA (BENTO) ─── */}
        <AnimatePresence>
          {modalOpen && (
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[100] px-4 font-space">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`rounded-[2rem] p-8 w-full max-w-lg shadow-2xl border relative overflow-hidden ${t.cardBg} ${t.border}`}
              >
                <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className={`text-2xl font-black font-bricolage tracking-tight ${t.text}`}>Lançar Cobrança</h2>
                    <p className={`text-xs font-bold ${t.textSecondary} mt-1`}>Configure o valor e a data base para faturamento da loja.</p>
                  </div>
                  <button 
                    onClick={() => setModalOpen(false)} 
                    className={`w-9 h-9 flex items-center justify-center rounded-xl border hover:opacity-85 ${t.buttonBg} ${t.border} ${t.text}`}
                  >
                    <FiX size={16} />
                  </button>
                </div>
                
                <form onSubmit={handleCriarFatura} className="space-y-6">
                  <div>
                    <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Selecione o Estabelecimento</label>
                    <div className="relative">
                      <select 
                        className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-bold cursor-pointer appearance-none ${t.inputBg} ${t.border} ${t.text}`}
                        value={novaFatura.estabelecimentoId}
                        onChange={e => setNovaFatura({...novaFatura, estabelecimentoId: e.target.value})}
                      >
                        <option value="" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Buscar estabelecimento...</option>
                        {estabs.map(e => (
                          <option key={e.id} value={e.id} className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>
                            {e.nome}
                          </option>
                        ))}
                      </select>
                      <FiChevronDown className={`${t.textSecondary} pointer-events-none absolute right-4 top-4 text-xs`} />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Valor Fatura</label>
                      <div className="relative">
                        <span className={`absolute left-4 top-[14px] text-sm font-black ${t.textMuted}`}>R$</span>
                        <input 
                          type="number" step="0.01" placeholder="0.00"
                          className={`w-full border pl-10 pr-4 py-3 rounded-2xl outline-none transition-all font-bold text-base font-mono-jb ${t.inputBg} ${t.border} ${t.text}`}
                          value={novaFatura.valor}
                          onChange={e => setNovaFatura({...novaFatura, valor: e.target.value})} 
                        />
                      </div>
                    </div>
                    <div>
                      <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Vencimento</label>
                      <input 
                        type="date" 
                        className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-bold ${t.inputBg} ${t.border} ${t.text}`}
                        value={novaFatura.vencimento}
                        onChange={e => setNovaFatura({...novaFatura, vencimento: e.target.value})} 
                      />
                    </div>
                  </div>
   
                  <div>
                    <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Descrição da Cobrança</label>
                    <input 
                      type="text" placeholder="Ex: Mensalidade - Hospedagem Nuvem"
                      className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-bold ${t.inputBg} ${t.border} ${t.text}`}
                      value={novaFatura.descricao}
                      onChange={e => setNovaFatura({...novaFatura, descricao: e.target.value})} 
                    />
                  </div>
   
                  <div className="flex gap-3 mt-8 pt-4 border-t border-white/5">
                    <button 
                      type="button" 
                      onClick={() => setModalOpen(false)} 
                      className={`flex-[0.5] py-3.5 rounded-2xl font-black text-xs ${t.buttonBg} ${t.border} ${t.textSecondary} hover:${t.text} transition-colors`}
                    >
                      Descartar
                    </button>
                    <button 
                      type="submit" 
                      className={`flex-1 py-3.5 rounded-2xl font-black text-xs text-white transition-all active:scale-95 shadow-lg ${
                        theme === 'dark' ? 'bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-cyan-500/15' : 'bg-stone-900 hover:bg-stone-850'
                      }`}
                    >
                      Registrar Recebível
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
 
        {/* ─── MODAL: COBRANÇAS EM MASSA (BENTO) ─── */}
        <AnimatePresence>
          {modalMassa && (
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[100] px-4 font-space">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`rounded-[2rem] p-8 w-full max-w-lg shadow-2xl border relative overflow-hidden ${t.cardBg} ${t.border}`}
              >
                <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className={`text-2xl font-black font-bricolage tracking-tight ${t.text} flex items-center gap-2`}>
                      Faturamento em Lote
                    </h2>
                    <p className={`text-xs font-bold ${t.textSecondary} mt-1`}>Emita a cobrança base mensal para todas as franquias da rede.</p>
                  </div>
                  <button 
                    onClick={() => setModalMassa(false)} 
                    className={`w-9 h-9 flex items-center justify-center rounded-xl border hover:opacity-85 ${t.buttonBg} ${t.border} ${t.text}`}
                  >
                    <FiX size={16} />
                  </button>
                </div>
   
                <div className={`border rounded-2xl p-4 mb-6 flex items-start gap-3 ${
                  isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-white text-[#ff6b35] shadow-sm border border-stone-200'
                  }`}>
                    <FiAlertCircle size={16} />
                  </div>
                  <div>
                    <p className={`font-black text-xs mb-0.5 ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>Ação Definitiva e Global</p>
                    <p className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-650'}`}>
                      Será disparado cobranças simultâneas para <span className="font-extrabold text-cyan-400">{estabs.length} franquias</span>. Confirme as informações antes de rodar.
                    </p>
                  </div>
                </div>
                
                <form onSubmit={handleCobrancaEmMassa} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Valor Cobrança Fixo</label>
                      <div className="relative">
                        <span className={`absolute left-4 top-[14px] text-sm font-black ${t.textMuted}`}>R$</span>
                        <input 
                          type="number" step="0.01" placeholder="0.00"
                          className={`w-full border pl-10 pr-4 py-3 rounded-2xl outline-none transition-all font-bold text-base font-mono-jb ${t.inputBg} ${t.border} ${t.text}`}
                          value={massaConfig.valor}
                          onChange={e => setMassaConfig({...massaConfig, valor: e.target.value})} 
                        />
                      </div>
                    </div>
                    <div>
                       <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Vencimento Global</label>
                      <input 
                        type="date" 
                        className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-bold ${t.inputBg} ${t.border} ${t.text}`}
                        value={massaConfig.vencimento}
                        onChange={e => setMassaConfig({...massaConfig, vencimento: e.target.value})} 
                      />
                    </div>
                  </div>
   
                   <div>
                     <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Descrição do Lote</label>
                    <input 
                      type="text" placeholder="Ex: Mensalidade Padrão - Setembro"
                      className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-bold ${t.inputBg} ${t.border} ${t.text}`}
                      value={massaConfig.descricao}
                      onChange={e => setMassaConfig({...massaConfig, descricao: e.target.value})} 
                    />
                  </div>
   
                  <div className="flex gap-3 mt-8 pt-4 border-t border-white/5">
                    <button 
                      type="button" 
                      onClick={() => setModalMassa(false)} 
                      className={`flex-[0.5] py-3.5 rounded-2xl font-black text-xs ${t.buttonBg} ${t.border} ${t.textSecondary} hover:${t.text} transition-colors`}
                    >
                      Abortar
                    </button>
                    <button 
                      type="submit" disabled={loadingMassa}
                      className={`flex-1 py-3.5 rounded-2xl font-black text-xs text-white transition-all active:scale-95 shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                        theme === 'dark' ? 'bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-cyan-500/15' : 'bg-stone-900 hover:bg-stone-850'
                      }`}
                    >
                      {loadingMassa ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div> : <FiLayers size={14} />}
                      {loadingMassa ? 'Disparando Lotes...' : 'Processar Lote Geral'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ─── MODAL: EDITAR COBRANÇA (BENTO) ─── */}
        <AnimatePresence>
          {modalEditOpen && (
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[100] px-4 font-space">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`rounded-[2rem] p-8 w-full max-w-lg shadow-2xl border relative overflow-hidden ${t.cardBg} ${t.border}`}
              >
                <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className={`text-2xl font-black font-bricolage tracking-tight ${t.text}`}>Editar Cobrança</h2>
                    <p className={`text-xs font-bold ${t.textSecondary} mt-1`}>
                      Atualizando dados de faturamento para {faturaEmEdicao.estabelecimentoNome}.
                    </p>
                  </div>
                  <button 
                    onClick={() => setModalEditOpen(false)} 
                    className={`w-9 h-9 flex items-center justify-center rounded-xl border hover:opacity-85 ${t.buttonBg} ${t.border} ${t.text}`}
                  >
                    <FiX size={16} />
                  </button>
                </div>
                
                <form onSubmit={handleEditarFatura} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Valor Fatura</label>
                      <div className="relative">
                        <span className={`absolute left-4 top-[14px] text-sm font-black ${t.textMuted}`}>R$</span>
                        <input 
                          type="number" step="0.01" placeholder="0.00"
                          className={`w-full border pl-10 pr-4 py-3 rounded-2xl outline-none transition-all font-bold text-base font-mono-jb ${t.inputBg} ${t.border} ${t.text}`}
                          value={faturaEmEdicao.valor}
                          onChange={e => setFaturaEmEdicao({...faturaEmEdicao, valor: e.target.value})} 
                        />
                      </div>
                    </div>
                    <div>
                      <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Vencimento</label>
                      <input 
                        type="date" 
                        className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-bold ${t.inputBg} ${t.border} ${t.text}`}
                        value={faturaEmEdicao.vencimento}
                        onChange={e => setFaturaEmEdicao({...faturaEmEdicao, vencimento: e.target.value})} 
                      />
                    </div>
                  </div>
   
                  <div>
                    <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Descrição da Cobrança</label>
                    <input 
                      type="text" placeholder="Ex: Mensalidade - Hospedagem Nuvem"
                      className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-bold ${t.inputBg} ${t.border} ${t.text}`}
                      value={faturaEmEdicao.descricao}
                      onChange={e => setFaturaEmEdicao({...faturaEmEdicao, descricao: e.target.value})} 
                    />
                  </div>
   
                  <div className="flex gap-3 mt-8 pt-4 border-t border-white/5">
                    <button 
                      type="button" 
                      onClick={() => setModalEditOpen(false)} 
                      className={`flex-[0.5] py-3.5 rounded-2xl font-black text-xs ${t.buttonBg} ${t.border} ${t.textSecondary} hover:${t.text} transition-colors`}
                    >
                      Descartar
                    </button>
                    <button 
                      type="submit" 
                      className={`flex-1 py-3.5 rounded-2xl font-black text-xs text-white transition-all active:scale-95 shadow-lg ${
                        theme === 'dark' ? 'bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-cyan-500/15' : 'bg-stone-900 hover:bg-stone-850'
                      }`}
                    >
                      Salvar Alterações
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
 
        {confirmDialog && (
          <ConfirmDialog
            open={true}
            title={confirmDialog.title}
            message={confirmDialog.message}
            variant={confirmDialog.variant}
            confirmText={confirmDialog.confirmText}
            cancelText={confirmDialog.cancelText}
            onConfirm={() => {
              confirmDialog.resolve(true);
              setConfirmDialog(null);
            }}
            onCancel={() => {
              confirmDialog.resolve(false);
              setConfirmDialog(null);
            }}
          />
        )}
   
      </main>
   
      <style>{`
        .tabular-nums { font-variant-numeric: tabular-nums; }
      `}</style>
    </div>
  );
}

export default FinanceiroMaster;