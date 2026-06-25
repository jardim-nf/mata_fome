import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useContasReceberChatbot } from '../../hooks/useContasReceberChatbot';
import { 
  FiArrowLeft, FiSun, FiMoon, FiLogOut, FiPlus, FiLayers, FiCheck, FiX,
  FiDollarSign, FiCalendar, FiAlertCircle, FiCheckCircle,
  FiClock, FiSearch, FiBriefcase, FiPhone, FiMessageCircle, FiRotateCcw,
  FiTrash2, FiEdit2, FiUsers, FiFileText, FiActivity, FiChevronDown
} from 'react-icons/fi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

// --- Skeleton loaders ---
const SkeletonRow = ({ isDark }) => (
  <div className={`p-6 flex flex-col lg:flex-row lg:items-center gap-6 animate-pulse border-b ${isDark ? 'border-slate-800/60' : 'border-slate-100'}`}>
    <div className={`w-12 h-12 rounded-2xl shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
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

function ContasReceberChatbot() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  const {
    clientes, faturas, loading, activeTab, setActiveTab,
    filtroStatus, setFiltroStatus, searchQuery, setSearchQuery, sortBy, setSortBy,
    resumo, faturasFiltradas, clientesFiltrados,
    modalClienteOpen, setModalClienteOpen, novoCliente, setNovoCliente, editingClienteId,
    abrirNovoCliente, abrirEditarCliente, handleSalvarCliente, handleExcluirCliente, handleToggleAtivoCliente,
    modalFaturaOpen, setModalFaturaOpen, novaFatura, setNovaFatura, handleCriarFatura, handleBaixa, handleExcluirFatura,
    modalEditFaturaOpen, setModalEditFaturaOpen, faturaEmEdicao, setFaturaEmEdicao, abrirModalEditarFatura, handleEditarFatura,
    modalMassaOpen, setModalMassaOpen, loadingMassa, massaConfig, setMassaConfig, handleCobrancasEmMassa,
    formatData, getVencimentoStatus, parseDate, enviarWhatsAppCobranca
  } = useContasReceberChatbot();

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Confirmar',
    isDanger: false,
  });

  const confirmarBaixa = (fatura) => {
    const isPago = fatura.status === 'pago';
    setConfirmModal({
      isOpen: true,
      title: isPago ? 'Estornar Lançamento' : 'Confirmar Recebimento',
      message: isPago 
        ? `Deseja realmente reabrir/estornar a cobrança de R$ ${fmt(fatura.valor)} de "${fatura.clienteNome}"?`
        : `Deseja confirmar o recebimento do valor de R$ ${fmt(fatura.valor)} de "${fatura.clienteNome}"?`,
      confirmText: isPago ? 'Estornar' : 'Confirmar Recebido',
      isDanger: isPago,
      onConfirm: () => handleBaixa(fatura),
    });
  };

  const confirmarExcluirFatura = (faturaId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Cobrança',
      message: 'Deseja realmente excluir esta fatura permanentemente? Esta ação não poderá ser desfeita.',
      confirmText: 'Excluir Cobrança',
      isDanger: true,
      onConfirm: () => handleExcluirFatura(faturaId),
    });
  };

  const confirmarExcluirCliente = (clienteId, clienteNome) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remover Cliente',
      message: `Deseja realmente excluir o cliente "${clienteNome}"? Isso NÃO removerá as faturas já emitidas para ele.`,
      confirmText: 'Excluir Cliente',
      isDanger: true,
      onConfirm: () => handleExcluirCliente(clienteId),
    });
  };

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

  // Sincroniza o tema entre abas do dashboard
  React.useEffect(() => {
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
    const labels = { pago: 'PAGO', atrasado: 'ATRASADO', vencendo: 'VENCE HOJE', pendente: 'PENDENTE' };

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-full uppercase tracking-wider border ${styles[status]}`}>
        {icons[status]} {labels[status]}
      </span>
    );
  };

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (authLoading) {
    return (
      <div className={`min-h-screen ${t.bg} flex items-center justify-center`}>
        <div className="w-12 h-12 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
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
      <div className={`max-w-[1800px] mx-auto border shadow-sm rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between mb-8 gap-4 relative z-10 ${t.cardBg} ${t.border}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/master-dashboard')} className={`p-2.5 rounded-xl border transition-all active:scale-95 ${t.buttonBg} ${t.border}`} title="Voltar ao Painel">
            <FiArrowLeft size={14} />
          </button>
          <button onClick={toggleTheme} className={`p-2.5 rounded-xl border transition-all active:scale-95 ${t.buttonBg} ${t.border}`} title={theme === 'dark' ? "Mudar para tema claro" : "Mudar para tema escuro"}>
            {theme === 'dark' ? <FiSun size={14} className="text-amber-400" /> : <FiMoon size={14} />}
          </button>
          <div>
            <h1 className={`font-black text-sm tracking-tight font-bricolage ${t.text}`}>Contas a Receber</h1>
            <p className={`text-[11px] font-bold font-space ${t.textSecondary}`}>{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
      </div>

      <main className="max-w-[1800px] mx-auto mt-8 relative z-10">
        
        {/* ─── HEADER ─── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 px-2">
          <div>
            <h1 className={`text-4xl font-black tracking-tight font-bricolage ${t.text}`}>Contas a Receber</h1>
            <p className={`${t.textSecondary} text-sm mt-1 font-medium font-space`}>Gerencie seus clientes, mensalidades recorrentes e recebíveis.</p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {activeTab === 'receber' ? (
              <>
                <button 
                  onClick={() => setModalFaturaOpen(true)} 
                  className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs transition-all active:scale-95 shadow-md ${
                    theme === 'dark' ? 'bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-cyan-500/15' : 'bg-[#ff6b35] hover:bg-[#e85a2a] text-white'
                  }`}
                >
                  <FiPlus size={14} /> Novo Lançamento
                </button>
                <button 
                  onClick={() => setModalMassaOpen(true)}
                  className={`flex items-center gap-2 border px-5 py-3 rounded-2xl shadow-sm font-black text-xs transition-all active:scale-95 ${t.buttonBg} ${t.border} ${t.text}`}
                >
                  <FiLayers size={14} /> Faturar Mês
                </button>
              </>
            ) : (
              <button 
                onClick={abrirNovoCliente}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs transition-all active:scale-95 shadow-md ${
                  theme === 'dark' ? 'bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-cyan-500/15' : 'bg-[#ff6b35] hover:bg-[#e85a2a] text-white'
                }`}
              >
                <FiPlus size={14} /> Novo Cliente
              </button>
            )}
          </div>
        </div>

        {/* ─── TABS ─── */}
        <div className="flex gap-2 mb-6 px-2 border-b border-white/5 pb-4 font-space">
          <button 
            onClick={() => { setActiveTab('receber'); setFiltroStatus('todos'); }}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 border ${
              activeTab === 'receber'
                ? (theme === 'dark' ? 'bg-cyan-500 border-cyan-500 text-slate-950 shadow-md shadow-cyan-500/15' : 'bg-[#ff6b35] border-[#ff6b35] text-white shadow-md')
                : `${t.buttonBg} ${t.border} ${t.textSecondary} hover:${t.text}`
            }`}
          >
            <FiFileText size={14} /> Contas a Receber
          </button>
          <button 
            onClick={() => { setActiveTab('clientes'); }}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 border ${
              activeTab === 'clientes'
                ? (theme === 'dark' ? 'bg-cyan-500 border-cyan-500 text-slate-950 shadow-md shadow-cyan-500/15' : 'bg-[#ff6b35] border-[#ff6b35] text-white shadow-md')
                : `${t.buttonBg} ${t.border} ${t.textSecondary} hover:${t.text}`
            }`}
          >
            <FiUsers size={14} /> Clientes Cadastrados
          </button>
        </div>

        {/* ─── METRICAS FINANCEIRAS BENTO GRID ─── */}
        {activeTab === 'receber' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8 font-space">
            
            {/* Caixa Recebido */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${t.cardBg} rounded-[2rem] border ${t.border} p-8 shadow-sm flex flex-col justify-between hover:border-emerald-500/40 hover:scale-[1.01] transition-all duration-300 relative overflow-hidden`}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-r-full" />
              <div className="flex justify-between items-start mb-6">
                 <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-450 border border-emerald-500/20"><FiCheckCircle size={22} /></div>
                 <p className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                   isDark ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-250'
                 }`}>{resumo.pagosCount} pagos</p>
              </div>
              <div>
                 <p className={`text-[10px] font-black ${t.textMuted} uppercase tracking-wider mb-1`}>Caixa Recebido</p>
                 <p className={`text-3xl font-black tracking-tight font-mono-jb ${t.text}`}>R$ {fmt(resumo.pago)}</p>
              </div>
            </motion.div>

            {/* A Receber */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className={`${t.cardBg} rounded-[2rem] border ${t.border} p-8 shadow-sm flex flex-col justify-between hover:border-cyan-500/40 hover:scale-[1.01] transition-all duration-300 relative overflow-hidden`}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500 rounded-r-full" />
              <div className="flex justify-between items-start mb-6">
                 <div className="w-14 h-14 bg-cyan-500/10 rounded-2xl flex items-center justify-center text-cyan-400 border border-cyan-500/20"><FiClock size={22} /></div>
                 <p className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                   isDark ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-slate-50 text-slate-700 border-slate-205'
                 }`}>{resumo.pendentesCount} abertos</p>
              </div>
              <div>
                 <p className={`text-[10px] font-black ${t.textMuted} uppercase tracking-wider mb-1`}>A Receber</p>
                 <p className={`text-3xl font-black tracking-tight font-mono-jb ${t.text}`}>R$ {fmt(resumo.pendente)}</p>
              </div>
            </motion.div>

            {/* Em Atraso */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`rounded-[2rem] p-8 shadow-md flex flex-col justify-between relative overflow-hidden group border hover:scale-[1.01] transition-all duration-300 ${
                resumo.atrasados > 0 
                  ? (isDark ? 'bg-red-500/5 border-red-500/30' : 'bg-red-50 border-red-200 text-red-950') 
                  : `${t.cardBg} ${t.border} hover:border-red-500/20`
              }`}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-r-full" />
              <div className="relative z-10 flex justify-between items-start mb-6">
                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${
                   resumo.atrasados > 0 
                     ? 'bg-red-100 text-red-650 border-red-500/20' 
                     : (isDark ? 'bg-slate-700/10 text-slate-400 border-slate-700/20' : 'bg-slate-100 text-slate-500 border-slate-200')
                 }`}><FiAlertCircle size={22} /></div>
                 <p className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                   resumo.atrasados > 0 
                     ? (isDark ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-700 border-red-200') 
                     : (isDark ? 'bg-slate-700/25 text-slate-400 border-slate-700/20' : 'bg-slate-100 text-slate-650 border-slate-200')
                 }`}>
                   {resumo.atrasados > 0 ? `${resumo.atrasados} atrasados` : 'Sem pendências 🎉'}
                 </p>
              </div>
              <div className="relative z-10">
                 <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${resumo.atrasados > 0 ? 'text-red-400' : t.textMuted}`}>Em Atraso</p>
                 <p className={`text-3xl font-black tracking-tight font-mono-jb ${resumo.atrasados > 0 ? 'text-red-500' : t.text}`}>R$ {fmt(resumo.valorAtrasado)}</p>
              </div>
            </motion.div>

            {/* Total Lançado */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className={`rounded-[2rem] border p-8 shadow-md flex flex-col justify-between relative overflow-hidden group hover:scale-[1.01] transition-all duration-300 ${
                isDark ? 'bg-slate-950/45 border-white/5' : 'bg-stone-900 border-stone-900 text-white'
              }`}
            >
              <div className="absolute -left-10 -bottom-10 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="relative z-10 flex justify-between items-start mb-6">
                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${isDark ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-white/10 text-violet-300 border-white/20'}`}><FiDollarSign size={22} /></div>
              </div>
              <div className="relative z-10 font-space">
                 <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-350'}`}>Total Lançado</p>
                 <p className={`text-3xl font-black tracking-tight mb-2 font-mono-jb ${isDark ? 'text-white' : 'text-white'}`}>R$ {fmt(resumo.total)}</p>
                 <div className={`w-full rounded-full h-1 overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-white/20'}`}>
                   <div className="bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 h-1" style={{width: `${resumo.total > 0 ? (resumo.pago / resumo.total * 100) : 0}%`}}></div>
                 </div>
              </div>
            </motion.div>

          </div>
        )}

        {/* ─── FILTROS PILL-STYLE ─── */}
        <div className={`p-4 rounded-3xl border mb-6 flex flex-col md:flex-row items-center justify-between gap-4 font-space ${t.cardBg} ${t.border}`}>
          {/* Status Filters (Only for invoices) */}
          {activeTab === 'receber' ? (
            <div className="flex overflow-x-auto hide-scrollbar gap-2 w-full md:w-auto">
              {[
                { id: 'todos', label: 'Todos Débitos', count: faturas.length },
                { id: 'pendente', label: 'Pendentes', count: resumo.pendentesCount },
                { id: 'atrasado', label: 'Atrasados', count: resumo.atrasados },
                { id: 'pago', label: 'Histórico Pago', count: resumo.pagosCount },
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
          ) : (
            <div className="flex items-center gap-2 text-xs font-bold text-[#86868B] px-2 py-1">
              <FiUsers /> Total de {clientes.length} clientes cadastrados
            </div>
          )}

          {/* Controls: Search & Sorting */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto font-space">
            {activeTab === 'receber' && (
              <div className={`relative w-full sm:w-60 border rounded-2xl px-4 py-2.5 flex items-center shadow-sm ${t.inputBg} ${t.border}`}>
                <FiCalendar className={`${t.textSecondary} shrink-0`} size={14} />
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className={selectStyle}
                >
                  <option value="data_desc" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Data (Recente)</option>
                  <option value="data_asc" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Data (Antigo)</option>
                  <option value="valor_desc" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Valor (Maior)</option>
                  <option value="valor_asc" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Valor (Menor)</option>
                  <option value="nome_asc" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Cliente (A-Z)</option>
                </select>
                <FiChevronDown className={`${t.textSecondary} pointer-events-none absolute right-4 text-xs`} />
              </div>
            )}

            {/* Search */}
            <div className={`relative w-full sm:w-60 md:w-72 border rounded-2xl px-4 py-2.5 flex items-center shadow-sm ${t.inputBg} ${t.border}`}>
              <FiSearch className={`${t.textSecondary} shrink-0`} size={15} />
              <input 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)}
                className={`bg-transparent border-none outline-none text-xs ml-3 w-full font-bold placeholder-slate-500 focus:outline-none ${t.text}`}
                placeholder={activeTab === 'receber' ? "Buscar cobrança..." : "Buscar cliente..."} 
              />
            </div>
          </div>
        </div>

        {/* ─── LIST VIEW (Minimalist Table Bento Format) ─── */}
        <div className={`rounded-[2rem] border overflow-hidden ${t.cardBg} ${t.border}`}>
          {loading ? (
            <div className="divide-y divide-white/5">
               {[1,2,3,4].map(i => <SkeletonRow key={i} isDark={isDark} />)}
            </div>
          ) : activeTab === 'receber' ? (
            // CONTAS A RECEBER TAB
            faturasFiltradas.length === 0 ? (
              <div className="p-20 text-center font-space">
                <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 ${t.inputBg}`}>
                  <FiSearch className={`text-xl ${t.textSecondary}`} />
                </div>
                <h3 className={`text-lg font-black ${t.text} font-bricolage`}>Sem Lançamentos</h3>
                <p className={`text-xs font-semibold ${t.textSecondary}`}>Nenhuma fatura de cliente cadastrada para este filtro.</p>
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
                    {/* Identity */}
                    <div className="flex items-center gap-4 flex-[2] min-w-[220px]">
                      <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${t.inputBg} ${t.border}`}>
                        <FiBriefcase className={`${t.textSecondary}`} size={16} />
                      </div>
                      <div>
                        <p className={`font-black text-sm tracking-tight font-bricolage ${t.text} line-clamp-1`}>{fatura.clienteNome}</p>
                        <p className={`text-[11px] font-medium font-space ${t.textSecondary} mt-0.5`}>{fatura.descricao}</p>
                      </div>
                    </div>

                    {/* Vencimento e Valor */}
                    <div className="flex flex-row justify-between lg:flex-col lg:justify-center flex-1 gap-1.5 font-space">
                       <p className={`text-[11px] font-bold ${t.textSecondary} flex items-center gap-1.5`}>
                         <FiCalendar size={11} /> <span className="font-mono-jb">{formatData(fatura.vencimento)}</span>
                       </p>
                       <p className={`font-black text-xl font-mono-jb ${t.text}`}>R$ {fmt(fatura.valor)}</p>
                    </div>

                    {/* Status */}
                    <div className="flex-[1.5] flex items-center gap-2 font-space">
                       {getStatusBadge(fatura)}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-row items-center gap-2 justify-end flex-1 mt-4 lg:mt-0 pt-4 lg:pt-0 border-t border-white/5 lg:border-0 font-space">
                      {fatura.status === 'pendente' && (
                         <button 
                           onClick={() => enviarWhatsAppCobranca(fatura)}
                           className={`w-10 h-10 border rounded-xl flex items-center justify-center transition-all active:scale-95 shrink-0 ${
                             theme === 'dark' ? 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20' : 'bg-green-50 border-green-200 text-green-600 hover:bg-green-100'
                           }`}
                           title="Lembrete WhatsApp"
                         >
                           <FiMessageCircle size={16} />
                         </button>
                      )}
                      
                      {fatura.status === 'pago' ? (
                          <button 
                            onClick={() => confirmarBaixa(fatura)}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 border ${
                              theme === 'dark' ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' : 'bg-red-50 border-red-200 text-red-650 hover:bg-red-100'
                            }`}
                          >
                            <FiRotateCcw size={12} /> Estornar
                          </button>
                      ) : (
                          <button 
                            onClick={() => confirmarBaixa(fatura)}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-1.5 border shadow-md ${
                              theme === 'dark' ? 'bg-cyan-500 border-cyan-500 text-slate-950 hover:bg-cyan-600' : 'bg-stone-900 border-stone-900 text-white hover:bg-stone-850'
                            }`}
                          >
                            <FiCheck size={12} /> Receber
                          </button>
                      )}

                      <button 
                        onClick={() => abrirModalEditarFatura(fatura)}
                        className={`w-10 h-10 border rounded-xl flex items-center justify-center transition-all active:scale-95 shrink-0 ${
                          theme === 'dark' ? 'bg-blue-500/10 border-blue-500/20 text-blue-450 hover:bg-blue-500/20' : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'
                        }`}
                        title="Editar Cobrança"
                      >
                        <FiEdit2 size={14} />
                      </button>

                      <button 
                        onClick={() => confirmarExcluirFatura(fatura.id)}
                        className={`w-10 h-10 border rounded-xl flex items-center justify-center transition-all active:scale-95 shrink-0 ${
                          theme === 'dark' ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' : 'bg-red-50 border-red-200 text-red-650 hover:bg-red-100'
                        }`}
                        title="Deletar Fatura"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>

                  </motion.div>
                ))}
              </div>
            )
          ) : (
            // CLIENTS TAB
            clientesFiltrados.length === 0 ? (
              <div className="p-20 text-center font-space">
                <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 ${t.inputBg}`}>
                  <FiUsers className={`text-xl ${t.textSecondary}`} />
                </div>
                <h3 className={`text-lg font-black ${t.text} font-bricolage`}>Sem Clientes</h3>
                <p className={`text-xs font-semibold ${t.textSecondary}`}>Nenhum cliente cadastrado.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {clientesFiltrados.map((cliente, idx) => (
                  <motion.div
                    key={cliente.id || idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                    className={`p-6 flex flex-col lg:flex-row lg:items-center gap-6 transition-all ${t.surfaceHover}`}
                  >
                    {/* Identity */}
                    <div className="flex items-center gap-4 flex-[2] min-w-[220px]">
                      <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${t.inputBg} ${t.border}`}>
                        <FiUsers className={`${t.textSecondary}`} size={16} />
                      </div>
                      <div>
                        <p className={`font-black text-sm tracking-tight font-bricolage ${t.text}`}>{cliente.nome}</p>
                        <p className={`text-[11px] font-medium font-space ${t.textSecondary} mt-0.5`}>{cliente.descricao || 'Sem descrição'}</p>
                      </div>
                    </div>

                    {/* Mensalidade e Dia de vencimento */}
                    <div className="flex flex-row justify-between lg:flex-col lg:justify-center flex-1 gap-1.5 font-space">
                       <p className={`text-[11px] font-bold ${t.textSecondary} flex items-center gap-1.5`}>
                         Vencimento dia: <span className={`font-extrabold ${t.text}`}>{cliente.diaVencimento}</span>
                       </p>
                       <p className={`font-black text-xl font-mono-jb ${t.text}`}>R$ {fmt(cliente.mensalidade)} /mês</p>
                    </div>

                    {/* WhatsApp */}
                    <div className="flex-1 flex items-center gap-2 font-space">
                       {cliente.telefone ? (
                          <a 
                            href={`https://wa.me/55${cliente.telefone.replace(/\D/g, '')}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className={`flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-full border ${
                              theme === 'dark' ? 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20' : 'bg-green-50 border-green-200 text-green-700'
                            }`}
                          >
                            <FiPhone size={12} /> <span className="font-mono-jb">{cliente.telefone}</span>
                          </a>
                       ) : (
                         <span className={`text-xs font-semibold ${t.textMuted}`}>Sem número</span>
                       )}
                    </div>

                    {/* Status toggle & Actions */}
                    <div className="flex flex-row items-center gap-2 justify-end flex-1 mt-4 lg:mt-0 pt-4 lg:pt-0 border-t border-white/5 lg:border-0 font-space">
                      <button 
                        onClick={() => handleToggleAtivoCliente(cliente)}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all border ${
                          cliente.ativo 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' 
                            : 'bg-slate-700/10 border-slate-700/20 text-slate-400 hover:bg-slate-700/20'
                        }`}
                      >
                        {cliente.ativo ? 'Ativo' : 'Inativo'}
                      </button>

                      <button 
                        onClick={() => abrirEditarCliente(cliente)}
                        className={`w-10 h-10 border rounded-xl flex items-center justify-center transition-all active:scale-95 shrink-0 ${t.buttonBg} ${t.border}`}
                        title="Editar Cliente"
                      >
                        <FiEdit2 size={14} />
                      </button>

                      <button 
                        onClick={() => confirmarExcluirCliente(cliente.id, cliente.nome)}
                        className={`w-10 h-10 border rounded-xl flex items-center justify-center transition-all active:scale-95 shrink-0 ${
                          theme === 'dark' ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' : 'bg-red-50 border-red-200 text-red-650 hover:bg-red-100'
                        }`}
                        title="Excluir Cliente"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>

                  </motion.div>
                ))}
              </div>
            )
          )}
        </div>

        {/* ─── MODAL: NOVO/EDITAR CLIENTE ─── */}
        <AnimatePresence>
          {modalClienteOpen && (
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[100] px-4 font-space">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`rounded-[2rem] p-8 w-full max-w-lg shadow-2xl border relative overflow-hidden ${t.cardBg} ${t.border}`}
              >
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className={`text-2xl font-black font-bricolage tracking-tight ${t.text}`}>
                      {editingClienteId ? 'Editar Cliente' : 'Cadastrar Cliente'}
                    </h2>
                    <p className={`text-xs font-bold ${t.textSecondary} mt-1`}>Insira as especificações do cliente.</p>
                  </div>
                  <button 
                    onClick={() => setModalClienteOpen(false)} 
                    className={`w-9 h-9 flex items-center justify-center rounded-xl border hover:opacity-85 ${t.buttonBg} ${t.border} ${t.text}`}
                  >
                    <FiX size={16} />
                  </button>
                </div>
                
                <form onSubmit={handleSalvarCliente} className="space-y-6">
                  <div>
                    <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Nome do Cliente *</label>
                    <input 
                      type="text" placeholder="Ex: Pizzaria Italiana" required
                      className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-bold ${t.inputBg} ${t.border} ${t.text}`}
                      value={novoCliente.nome}
                      onChange={e => setNovoCliente({...novoCliente, nome: e.target.value})} 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Mensalidade *</label>
                      <div className="relative">
                        <span className={`absolute left-4 top-[14px] text-sm font-black ${t.textMuted}`}>R$</span>
                        <input 
                          type="number" step="0.01" placeholder="0.00" required
                          className={`w-full border pl-10 pr-4 py-3 rounded-2xl outline-none transition-all font-bold text-base font-mono-jb ${t.inputBg} ${t.border} ${t.text}`}
                          value={novoCliente.mensalidade}
                          onChange={e => setNovoCliente({...novoCliente, mensalidade: e.target.value})} 
                        />
                      </div>
                    </div>
                    <div>
                      <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Dia Vencimento *</label>
                      <input 
                        type="number" min="1" max="31" placeholder="10" required
                        className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-bold ${t.inputBg} ${t.border} ${t.text}`}
                        value={novoCliente.diaVencimento}
                        onChange={e => setNovoCliente({...novoCliente, diaVencimento: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Telefone WhatsApp (Apenas Números com DDD)</label>
                    <input 
                      type="text" placeholder="Ex: 11999999999"
                      className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-bold ${t.inputBg} ${t.border} ${t.text}`}
                      value={novoCliente.telefone}
                      onChange={e => setNovoCliente({...novoCliente, telefone: e.target.value})} 
                    />
                  </div>

                   <div>
                    <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Descrição do Projeto</label>
                    <input 
                      type="text" placeholder="Ex: Prestação de serviços ou sistemas"
                      className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-bold ${t.inputBg} ${t.border} ${t.text}`}
                      value={novoCliente.descricao}
                      onChange={e => setNovoCliente({...novoCliente, descricao: e.target.value})} 
                    />
                  </div>

                  <div className="flex gap-3 mt-8 pt-4 border-t border-white/5">
                    <button 
                      type="button" 
                      onClick={() => setModalClienteOpen(false)} 
                      className={`flex-[0.5] py-3.5 rounded-2xl font-black text-xs ${t.buttonBg} ${t.border} ${t.textSecondary} hover:${t.text} transition-colors`}
                    >
                      Voltar
                    </button>
                    <button 
                      type="submit" 
                      className={`flex-1 py-3.5 rounded-2xl font-black text-xs text-white transition-all active:scale-95 shadow-lg ${
                        theme === 'dark' ? 'bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-cyan-500/15' : 'bg-stone-900 hover:bg-stone-850'
                      }`}
                    >
                      {editingClienteId ? 'Confirmar Edição' : 'Cadastrar Cliente'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ─── MODAL: LANÇAR FATURA ÚNICA ─── */}
        <AnimatePresence>
          {modalFaturaOpen && (
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[100] px-4 font-space">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`rounded-[2rem] p-8 w-full max-w-lg shadow-2xl border relative overflow-hidden ${t.cardBg} ${t.border}`}
              >
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className={`text-2xl font-black font-bricolage tracking-tight ${t.text}`}>Lançar Cobrança Avulsa</h2>
                    <p className={`text-xs font-bold ${t.textSecondary} mt-1`}>Selecione o cliente e defina os parâmetros do débito.</p>
                  </div>
                  <button 
                    onClick={() => setModalFaturaOpen(false)} 
                    className={`w-9 h-9 flex items-center justify-center rounded-xl border hover:opacity-85 ${t.buttonBg} ${t.border} ${t.text}`}
                  >
                    <FiX size={16} />
                  </button>
                </div>
                
                <form onSubmit={handleCriarFatura} className="space-y-6">
                  <div>
                    <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Cliente *</label>
                    <div className="relative">
                      <select 
                        className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-bold cursor-pointer appearance-none ${t.inputBg} ${t.border} ${t.text}`}
                        value={novaFatura.clienteId}
                        onChange={e => {
                          const cid = e.target.value;
                          const client = clientes.find(c => c.id === cid);
                          setNovaFatura({
                            ...novaFatura,
                            clienteId: cid,
                            valor: client ? client.mensalidade : '',
                            descricao: client ? `Mensalidade - ${client.nome}` : 'Mensalidade'
                          });
                        }}
                        required
                      >
                        <option value="" className="bg-white text-slate-900">Selecione o cliente...</option>
                        {clientes.map(c => (
                          <option key={c.id} value={c.id} className="bg-white text-slate-900 font-bold">
                            {c.nome} (R$ {fmt(c.mensalidade)})
                          </option>
                        ))}
                      </select>
                      <FiChevronDown className={`${t.textSecondary} pointer-events-none absolute right-4 top-4 text-xs`} />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Valor Cobrança *</label>
                      <div className="relative">
                        <span className={`absolute left-4 top-[14px] text-sm font-black ${t.textMuted}`}>R$</span>
                        <input 
                          type="number" step="0.01" placeholder="0.00" required
                          className={`w-full border pl-10 pr-4 py-3 rounded-2xl outline-none transition-all font-bold text-base font-mono-jb ${t.inputBg} ${t.border} ${t.text}`}
                          value={novaFatura.valor}
                          onChange={e => setNovaFatura({...novaFatura, valor: e.target.value})} 
                        />
                      </div>
                    </div>
                    <div>
                      <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Data Vencimento *</label>
                      <input 
                        type="date" required
                        className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-bold ${t.inputBg} ${t.border} ${t.text}`}
                        value={novaFatura.vencimento}
                        onChange={e => setNovaFatura({...novaFatura, vencimento: e.target.value})} 
                      />
                    </div>
                  </div>
  
                  <div>
                    <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Descrição da Fatura</label>
                    <input 
                      type="text" placeholder="Ex: Mensalidade - Setup e Instalação"
                      className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-bold ${t.inputBg} ${t.border} ${t.text}`}
                      value={novaFatura.descricao}
                      onChange={e => setNovaFatura({...novaFatura, descricao: e.target.value})} 
                    />
                  </div>
  
                  <div className="flex gap-3 mt-8 pt-4 border-t border-white/5">
                    <button 
                      type="button" 
                      onClick={() => setModalFaturaOpen(false)} 
                      className={`flex-[0.5] py-3.5 rounded-2xl font-black text-xs ${t.buttonBg} ${t.border} ${t.textSecondary} hover:${t.text} transition-colors`}
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      className={`flex-1 py-3.5 rounded-2xl font-black text-xs text-white transition-all active:scale-95 shadow-lg ${
                        theme === 'dark' ? 'bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-cyan-500/15' : 'bg-stone-900 hover:bg-stone-850'
                      }`}
                    >
                      Gerar Débito
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ─── MODAL: EDITAR COBRANÇA ─── */}
        <AnimatePresence>
          {modalEditFaturaOpen && (
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[100] px-4 font-space">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`rounded-[2rem] p-8 w-full max-w-lg shadow-2xl border relative overflow-hidden ${t.cardBg} ${t.border}`}
              >
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className={`text-2xl font-black font-bricolage tracking-tight ${t.text}`}>Editar Cobrança</h2>
                    <p className={`text-xs font-bold ${t.textSecondary} mt-1`}>Altere os parâmetros do débito lançado.</p>
                  </div>
                  <button 
                    onClick={() => setModalEditFaturaOpen(false)} 
                    className={`w-9 h-9 flex items-center justify-center rounded-xl border hover:opacity-85 ${t.buttonBg} ${t.border} ${t.text}`}
                  >
                    <FiX size={16} />
                  </button>
                </div>
                
                <form onSubmit={handleEditarFatura} className="space-y-6">
                  <div>
                    <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Cliente</label>
                    <input 
                      type="text" 
                      readOnly 
                      disabled
                      className={`w-full border px-4 py-3 rounded-2xl outline-none opacity-60 text-xs font-bold ${t.inputBg} ${t.border} ${t.text}`}
                      value={faturaEmEdicao.clienteNome}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Valor Cobrança *</label>
                      <div className="relative">
                        <span className={`absolute left-4 top-[14px] text-sm font-black ${t.textMuted}`}>R$</span>
                        <input 
                          type="number" step="0.01" placeholder="0.00" required
                          className={`w-full border pl-10 pr-4 py-3 rounded-2xl outline-none transition-all font-bold text-base font-mono-jb ${t.inputBg} ${t.border} ${t.text}`}
                          value={faturaEmEdicao.valor}
                          onChange={e => setFaturaEmEdicao({...faturaEmEdicao, valor: e.target.value})} 
                        />
                      </div>
                    </div>
                    <div>
                      <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Data Vencimento *</label>
                      <input 
                        type="date" required
                        className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-bold ${t.inputBg} ${t.border} ${t.text}`}
                        value={faturaEmEdicao.vencimento}
                        onChange={e => setFaturaEmEdicao({...faturaEmEdicao, vencimento: e.target.value})} 
                      />
                    </div>
                  </div>
  
                  <div>
                    <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Descrição da Fatura</label>
                    <input 
                      type="text" placeholder="Ex: Mensalidade - Setup e Instalação"
                      className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-bold ${t.inputBg} ${t.border} ${t.text}`}
                      value={faturaEmEdicao.descricao}
                      onChange={e => setFaturaEmEdicao({...faturaEmEdicao, descricao: e.target.value})} 
                    />
                  </div>
  
                  <div className="flex gap-3 mt-8 pt-4 border-t border-white/5">
                    <button 
                      type="button" 
                      onClick={() => setModalEditFaturaOpen(false)} 
                      className={`flex-[0.5] py-3.5 rounded-2xl font-black text-xs ${t.buttonBg} ${t.border} ${t.textSecondary} hover:${t.text} transition-colors`}
                    >
                      Cancelar
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

        {/* ─── MODAL: GERAR FATURAMENTO EM LOTE ─── */}
        <AnimatePresence>
          {modalMassaOpen && (
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[100] px-4 font-space">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`rounded-[2rem] p-8 w-full max-w-lg shadow-2xl border relative overflow-hidden ${t.cardBg} ${t.border}`}
              >
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className={`text-2xl font-black font-bricolage tracking-tight ${t.text}`}>Geração Automática (Mês)</h2>
                    <p className={`text-xs font-bold ${t.textSecondary} mt-1`}>Crie as faturas do mês corrente para todos os clientes ativos de uma vez só.</p>
                  </div>
                  <button 
                    onClick={() => setModalMassaOpen(false)} 
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
                    <p className={`font-black text-xs mb-0.5 ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>Segurança Antiduplicidade</p>
                    <p className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-650'}`}>
                      O sistema analisa se o cliente já possui uma cobrança gerada para o mês escolhido, impedindo faturamentos repetidos!
                    </p>
                  </div>
                </div>
                
                <form onSubmit={handleCobrancasEmMassa} className="space-y-6">
                  <div>
                    <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Mês de Referência *</label>
                    <input 
                      type="month" required
                      className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-bold ${t.inputBg} ${t.border} ${t.text}`}
                      value={massaConfig.mesReferencia}
                      onChange={e => setMassaConfig({...massaConfig, mesReferencia: e.target.value})} 
                    />
                  </div>

                  <div>
                    <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-2`}>Descrição Opcional do Lote</label>
                    <input 
                      type="text" placeholder="Ex: Mensalidade - Setor Operações"
                      className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-bold ${t.inputBg} ${t.border} ${t.text}`}
                      value={massaConfig.descricao}
                      onChange={e => setMassaConfig({...massaConfig, descricao: e.target.value})} 
                    />
                  </div>

                  <div className="flex gap-3 mt-8 pt-4 border-t border-white/5">
                    <button 
                      type="button" 
                      onClick={() => setModalMassaOpen(false)} 
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
                      {loadingMassa ? 'Processando Lote...' : 'Gerar Faturamento'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>

      {/* ─── CUSTOM CONFIRMATION MODAL ─── */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop blur */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm"
            />
            
            {/* Modal Container */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className={`relative z-10 max-w-md w-full rounded-[2.5rem] border p-8 shadow-2xl ${
                theme === 'dark' ? 'bg-[#0b132b] border-white/10 text-white' : 'bg-white border-stone-200 text-stone-900'
              }`}
            >
              <div className="flex flex-col items-center text-center">
                {/* Icon */}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ${
                  confirmModal.isDanger 
                    ? 'bg-red-500/10 text-red-500' 
                    : (theme === 'dark' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-50 text-cyan-600')
                }`}>
                  <FiAlertCircle size={28} />
                </div>
                
                <h3 className="text-xl font-bold font-bricolage mb-3">
                  {confirmModal.title}
                </h3>
                
                <p className={`text-sm mb-8 leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-stone-600'}`}>
                  {confirmModal.message}
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <button
                    onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    className={`flex-1 py-3.5 rounded-full text-xs font-black uppercase tracking-wider transition-all border ${
                      theme === 'dark' ? 'bg-slate-900 border-white/5 text-slate-300 hover:text-white' : 'bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200 hover:text-stone-900'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      if (confirmModal.onConfirm) {
                        await confirmModal.onConfirm();
                      }
                      setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    }}
                    style={{ backgroundColor: confirmModal.isDanger ? '#ef4444' : (theme === 'dark' ? '#06b6d4' : '#1c1917') }}
                    className={`flex-1 py-3.5 rounded-full text-xs font-black uppercase tracking-wider transition-all text-white hover:opacity-90 active:scale-95`}
                  >
                    {confirmModal.confirmText}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .tabular-nums { font-variant-numeric: tabular-nums; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

export default ContasReceberChatbot;
