import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { differenceInDays } from 'date-fns';
import { useFinanceiroMasterData } from '../../hooks/useFinanceiroMasterData';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { 
  FiArrowLeft, FiSun, FiMoon, FiLogOut, FiPlus, FiLayers, FiCheck, FiX,
  FiDollarSign, FiCalendar, FiAlertCircle, FiCheckCircle, FiTrendingUp,
  FiClock, FiSearch, FiBriefcase, FiPhone, FiMail, FiMessageCircle, FiActivity, FiRotateCcw
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
    resumo,
    handleCriarFatura, handleBaixa, handleCobrancaEmMassa, handleLembreteWhatsApp,
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

  const themeClasses = {
    dark: {
      bg: 'bg-gradient-to-br from-slate-950 via-[#0d1220] to-slate-950',
      surface: 'bg-slate-900/60 backdrop-blur-xl',
      surfaceHover: 'hover:bg-slate-800/80 hover:shadow-[0_8px_32px_rgba(99,102,241,0.06)] hover:scale-[1.005] hover:border-slate-700/50',
      border: 'border-slate-800/80',
      text: 'text-slate-100',
      textSecondary: 'text-slate-400',
      textMuted: 'text-slate-500',
      accent: 'bg-blue-600',
      accentHover: 'hover:bg-blue-700',
      gradient: 'from-blue-500 to-indigo-600',
      cardBg: 'bg-slate-900/40 backdrop-blur-xl',
      inputBg: 'bg-slate-950/60',
    },
    light: {
      bg: 'bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#f8fafc]',
      surface: 'bg-white/80 backdrop-blur-md',
      surfaceHover: 'hover:bg-white hover:shadow-[0_8px_30px_rgba(99,102,241,0.02)] hover:scale-[1.005] hover:border-slate-300/50',
      border: 'border-slate-200/60',
      text: 'text-slate-900',
      textSecondary: 'text-slate-650',
      textMuted: 'text-slate-400',
      accent: 'bg-blue-500',
      accentHover: 'hover:bg-blue-600',
      gradient: 'from-blue-550 to-purple-650',
      cardBg: 'bg-white/70 backdrop-blur-md',
      inputBg: 'bg-slate-100/50',
    }
  };

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
    <div className={`min-h-screen ${t.bg} transition-colors duration-500 relative overflow-hidden pb-24 pt-4 px-4 sm:px-8`}>
      
      {/* Luzes neon de fundo */}
      <div className="absolute top-[-10%] left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-blue-500/10 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-purple-500/8 to-transparent blur-[120px] pointer-events-none" />

      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className={`max-w-[1400px] mx-auto backdrop-blur-xl border shadow-lg rounded-3xl h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all ${t.surface} ${t.border}`}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/master-dashboard')} className={`w-9 h-9 ${t.inputBg} hover:opacity-80 rounded-xl flex items-center justify-center transition-all`}>
            <FiArrowLeft className={`${t.text} text-sm`} />
          </button>
          <div className="hidden sm:block border-l border-slate-700/50 pl-4">
            <h1 className={`font-bold text-sm tracking-tight ${t.text}`}>Módulo Financeiro</h1>
            <p className={`text-[10px] ${t.textSecondary} font-semibold`}>{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className={`p-2.5 rounded-xl border ${t.inputBg} ${t.border} ${t.textSecondary} hover:${t.text} transition-all`}
            title="Alternar Tema"
          >
            {isDark ? <FiSun size={15} /> : <FiMoon size={15} />}
          </button>
          
          <div className="w-px h-6 bg-slate-700/50 hidden sm:block" />
          
          <button onClick={async () => { await logout(); navigate('/'); }} className="w-9 h-9 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl flex items-center justify-center transition-all" title="Sair">
            <FiLogOut className="text-red-400" size={15} />
          </button>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto mt-8 relative z-10">
        
        {/* ─── HEADER ─── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 px-2">
          <div>
            <h1 className={`text-4xl font-extrabold tracking-tight ${t.text}`}>Recebíveis da Rede</h1>
            <p className={`${t.textSecondary} text-sm mt-1 font-semibold`}>Gestão de mensalidades, cobranças e faturamento consolidado.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setModalOpen(true)} 
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-5 py-3 rounded-2xl hover:opacity-90 shadow-md font-bold text-xs transition-all active:scale-95">
              <FiPlus size={14} /> Nova Cobrança
            </button>
            <button onClick={() => setModalMassa(true)}
              className={`flex items-center gap-2 border px-5 py-3 rounded-2xl shadow-sm font-bold text-xs transition-all active:scale-95 ${t.inputBg} ${t.border} ${t.text} hover:opacity-90`}>
              <FiLayers size={14} /> Em Massa
            </button>
          </div>
        </div>

        {/* ─── QUICK STATS BAR ─── */}
        <div className="flex flex-wrap items-center gap-2.5 mb-6 px-2">
          <span className={`rounded-full px-4 py-2 border shadow-sm text-[10px] font-bold flex items-center gap-2 ${t.surface} ${t.border} ${t.text}`}>
            <span className="w-2 h-2 rounded-full bg-blue-500"></span> {resumo.totalFaturas} lançamentos processados
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
        <div className={`p-4 rounded-3xl border mb-6 flex flex-col md:flex-row items-center justify-between gap-4 ${t.surface} ${t.border}`}>
          {/* Status Filters */}
          <div className="flex overflow-x-auto hide-scrollbar gap-2 w-full md:w-auto">
            {[
              { id: 'todos', label: 'Histórico Completo', count: resumo.totalFaturas },
              { id: 'pendente', label: 'Pendentes', count: resumo.pendentesCount },
              { id: 'atrasado', label: 'Atrasados', count: resumo.atrasados },
              { id: 'pago', label: 'Caixa Efetuado', count: resumo.pagosCount },
            ].map(s => (
              <button key={s.id} onClick={() => setFiltroStatus(s.id)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap border
                  ${filtroStatus === s.id 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20' 
                    : `${t.inputBg} ${t.border} ${t.textSecondary} hover:${t.text} hover:opacity-95`
                  }`}
              >
                {s.label}
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  filtroStatus === s.id 
                    ? 'bg-white text-blue-600' 
                    : (isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')
                }`}>{s.count}</span>
              </button>
            ))}
          </div>

          {/* Controls: Sort & Search */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* Sort Dropdown */}
            <div className={`relative border rounded-2xl px-4 py-2.5 flex items-center shadow-sm ${t.inputBg} ${t.border}`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${t.textMuted} mr-2`}>Ordenar:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className={`bg-transparent border-none outline-none text-xs font-bold cursor-pointer appearance-none pr-6 ${t.text}`}
                style={{ WebkitAppearance: 'none' }}
              >
                <option value="data_desc" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Data (Mais Recente)</option>
                <option value="data_asc" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Data (Mais Antigo)</option>
                <option value="valor_desc" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Valor (Maior)</option>
                <option value="valor_asc" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Valor (Menor)</option>
                <option value="nome_asc" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Loja (A-Z)</option>
              </select>
              <div className="pointer-events-none absolute right-3.5 flex items-center">
                <svg className={`fill-current h-4 w-4 ${t.textSecondary}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
            </div>

            {/* Search Pill */}
            <div className={`relative w-full sm:w-60 md:w-72 border rounded-2xl px-4 py-2.5 flex items-center shadow-sm ${t.inputBg} ${t.border}`}>
              <FiSearch className={`${t.textSecondary}`} size={16} />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className={`bg-transparent border-none outline-none text-xs ml-2 w-full font-semibold placeholder-gray-400 ${t.text}`}
                placeholder="Buscar por loja..." />
            </div>
          </div>
        </div>

        {/* ─── LIST VIEW (Minimalist Table Bento Format) ─── */}
        <div className={`rounded-3xl shadow-xl border overflow-hidden ${t.surface} ${t.border}`}>
          {loading ? (
            <div className="divide-y divide-slate-800/40">
               {[1,2,3,4,5].map(i => <SkeletonRow key={i} isDark={isDark} />)}
            </div>
          ) : faturasFiltradas.length === 0 ? (
            <div className="p-20 text-center">
              <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 ${t.inputBg}`}>
                <FiSearch className={`text-xl ${t.textSecondary}`} />
              </div>
              <h3 className={`text-lg font-bold ${t.text} mb-1`}>Sem Lançamentos</h3>
              <p className={`text-xs font-semibold ${t.textSecondary}`}>Nenhuma fatura registrada foi encontrada para esta busca.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/30">
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
                        <p className={`font-bold text-base ${t.text} line-clamp-1`}>{fatura.estabelecimentoNome}</p>
                        <p className={`text-xs font-semibold ${t.textSecondary} mt-0.5`}>{fatura.descricao}</p>
                      </div>
                    </div>
 
                    {/* Block: Date and Amount */}
                    <div className="flex flex-row justify-between lg:flex-col lg:justify-center flex-1 gap-1.5">
                       <p className={`text-xs font-bold ${t.textSecondary} flex items-center gap-1.5`}>
                         <FiCalendar size={11} /> {formatData(fatura.vencimento)}
                       </p>
                       <p className={`font-black text-xl tabular-nums ${t.text}`}>R$ {fmt(fatura.valor)}</p>
                    </div>
 
                    {/* Block: Status Badge */}
                    <div className="flex-[1.5] w-full lg:w-auto flex items-center gap-2 flex-wrap">
                       {getStatusBadge(fatura)}
                       {getVencimentoStatus(fatura) === 'atrasado' && (
                          <span className="text-[10px] font-bold text-red-500 animate-pulse bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                             (+{differenceInDays(new Date(), parseDate(fatura.vencimento))} dias)
                          </span>
                       )}
                    </div>
 
                    {/* Block: Actions */}
                    <div className="flex flex-row items-center gap-2 justify-end flex-1 mt-4 lg:mt-0 pt-4 lg:pt-0 border-t border-slate-700/20 lg:border-0">
                      {getVencimentoStatus(fatura) === 'atrasado' && (
                         <button 
                           onClick={() => handleLembreteWhatsApp(fatura)}
                           className="w-10 h-10 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-center text-green-400 hover:bg-green-500/20 transition-all active:scale-95 shrink-0"
                           title="Notificar via WhatsApp"
                         >
                           <FiMessageCircle size={16} />
                         </button>
                      )}
                      
                      {fatura.status === 'pago' ? (
                          <button 
                            onClick={() => handleBaixa(fatura)}
                            className="bg-red-500/10 border border-red-500/20 px-5 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/20 transition-all active:scale-95 flex items-center gap-1.5"
                          >
                            <FiRotateCcw size={12} /> Estornar
                          </button>
                      ) : (
                          <button 
                            onClick={() => handleBaixa(fatura)}
                            className="bg-blue-600 border border-blue-600 px-5 py-2.5 rounded-xl text-xs font-bold text-white hover:bg-blue-700 transition-all shadow-md active:scale-95 flex items-center gap-1.5"
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
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`rounded-[2rem] p-8 w-full max-w-lg shadow-2xl border relative overflow-hidden ${t.surface} ${t.border}`}
              >
                <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className={`text-2xl font-bold tracking-tight ${t.text}`}>Lançar Cobrança</h2>
                    <p className={`text-xs font-semibold ${t.textSecondary} mt-1`}>Configure o valor e a data base para faturamento da loja.</p>
                  </div>
                  <button 
                    onClick={() => setModalOpen(false)} 
                    className={`w-9 h-9 flex items-center justify-center rounded-xl border hover:opacity-85 ${t.inputBg} ${t.border} ${t.text}`}
                  >
                    <FiX size={16} />
                  </button>
                </div>
                
                <form onSubmit={handleCriarFatura} className="space-y-6">
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.textSecondary} mb-2`}>Selecione o Estabelecimento</label>
                    <select 
                      className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-semibold cursor-pointer appearance-none ${t.inputBg} ${t.border} ${t.text}`}
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
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.textSecondary} mb-2`}>Valor Fatura</label>
                      <div className="relative">
                        <span className={`absolute left-4 top-[14px] text-sm font-bold ${t.textMuted}`}>R$</span>
                        <input 
                          type="number" step="0.01" placeholder="0.00"
                          className={`w-full border pl-10 pr-4 py-3 rounded-2xl outline-none transition-all font-bold text-base tabular-nums ${t.inputBg} ${t.border} ${t.text}`}
                          value={novaFatura.valor}
                          onChange={e => setNovaFatura({...novaFatura, valor: e.target.value})} 
                        />
                      </div>
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.textSecondary} mb-2`}>Vencimento</label>
                      <input 
                        type="date" 
                        className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-semibold ${t.inputBg} ${t.border} ${t.text}`}
                        value={novaFatura.vencimento}
                        onChange={e => setNovaFatura({...novaFatura, vencimento: e.target.value})} 
                      />
                    </div>
                  </div>
  
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.textSecondary} mb-2`}>Descrição da Cobrança</label>
                    <input 
                      type="text" placeholder="Ex: Mensalidade - Hospedagem Nuvem"
                      className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-semibold ${t.inputBg} ${t.border} ${t.text}`}
                      value={novaFatura.descricao}
                      onChange={e => setNovaFatura({...novaFatura, descricao: e.target.value})} 
                    />
                  </div>
  
                  <div className="flex gap-3 mt-8 pt-4 border-t border-slate-700/20">
                    <button 
                      type="button" 
                      onClick={() => setModalOpen(false)} 
                      className={`flex-[0.5] py-3.5 rounded-xl font-bold text-xs ${t.inputBg} ${t.border} ${t.textSecondary} hover:${t.text} transition-colors`}
                    >
                      Descartar
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold text-xs shadow-md hover:opacity-95 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <FiCheckCircle size={14} /> Registrar Recebível
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
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`rounded-[2rem] p-8 w-full max-w-lg shadow-2xl border relative overflow-hidden ${t.surface} ${t.border}`}
              >
                <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className={`text-2xl font-bold tracking-tight ${t.text} flex items-center gap-2`}>
                      Faturamento em Lote
                    </h2>
                    <p className={`text-xs font-semibold ${t.textSecondary} mt-1`}>Emita a cobrança base mensal para todas as franquias da rede.</p>
                  </div>
                  <button 
                    onClick={() => setModalMassa(false)} 
                    className={`w-9 h-9 flex items-center justify-center rounded-xl border hover:opacity-85 ${t.inputBg} ${t.border} ${t.text}`}
                  >
                    <FiX size={16} />
                  </button>
                </div>
  
                <div className={`border rounded-2xl p-4 mb-6 flex items-start gap-3 ${
                  isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-250/20'
                }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-white text-amber-700 shadow-sm'
                  }`}>
                    <FiAlertCircle size={16} />
                  </div>
                  <div>
                    <p className={`font-bold text-sm mb-0.5 ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>Ação Definitiva e Global</p>
                    <p className={`text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Será disparado cobranças simultâneas para <span className="font-extrabold text-blue-500">{estabs.length} franquias</span>. Confirme as informações antes de rodar.
                    </p>
                  </div>
                </div>
                
                <form onSubmit={handleCobrancaEmMassa} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.textSecondary} mb-2`}>Valor Cobrança Fixo</label>
                      <div className="relative">
                        <span className={`absolute left-4 top-[14px] text-sm font-bold ${t.textMuted}`}>R$</span>
                        <input 
                          type="number" step="0.01" placeholder="0.00"
                          className={`w-full border pl-10 pr-4 py-3 rounded-2xl outline-none transition-all font-bold text-base tabular-nums ${t.inputBg} ${t.border} ${t.text}`}
                          value={massaConfig.valor}
                          onChange={e => setMassaConfig({...massaConfig, valor: e.target.value})} 
                        />
                      </div>
                    </div>
                    <div>
                       <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.textSecondary} mb-2`}>Vencimento Global</label>
                      <input 
                        type="date" 
                        className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-semibold ${t.inputBg} ${t.border} ${t.text}`}
                        value={massaConfig.vencimento}
                        onChange={e => setMassaConfig({...massaConfig, vencimento: e.target.value})} 
                      />
                    </div>
                  </div>
  
                   <div>
                     <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.textSecondary} mb-2`}>Descrição do Lote</label>
                    <input 
                      type="text" placeholder="Ex: Mensalidade Padrão - Setembro"
                      className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-semibold ${t.inputBg} ${t.border} ${t.text}`}
                      value={massaConfig.descricao}
                      onChange={e => setMassaConfig({...massaConfig, descricao: e.target.value})} 
                    />
                  </div>
  
                  <div className="flex gap-3 mt-8 pt-4 border-t border-slate-700/20">
                    <button 
                      type="button" 
                      onClick={() => setModalMassa(false)} 
                      className={`flex-[0.5] py-3.5 rounded-xl font-bold text-xs ${t.inputBg} ${t.border} ${t.textSecondary} hover:${t.text} transition-colors`}
                    >
                      Abortar
                    </button>
                    <button 
                      type="submit" disabled={loadingMassa}
                      className="flex-1 py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold text-xs shadow-md hover:opacity-95 transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
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
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
        .tabular-nums { font-variant-numeric: tabular-nums; }
      `}</style>
    </div>
  );
}

export default FinanceiroMaster;