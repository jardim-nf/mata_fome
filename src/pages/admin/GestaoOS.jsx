import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { uploadFile } from '../../utils/firebaseStorageService';
import { osService } from '../../services/osService';
import ModalOrdemServico from '../../components/ModalOrdemServico';
import BackButton from '../../components/BackButton';
import { toast } from 'react-toastify';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { motion } from 'framer-motion';
import {
  IoBuildOutline,
  IoSearch,
  IoAdd,
  IoEyeOutline,
  IoPencilOutline,
  IoTrashOutline,
  IoTimeOutline,
  IoCheckmarkCircleOutline,
  IoChevronForwardOutline,
  IoWalletOutline,
  IoDocumentsOutline
} from 'react-icons/io5';
import { FiSun, FiMoon } from 'react-icons/fi';

// Helper de Cores para Badge de Status
export const getStatusBadgeStyle = (status, isDark = true) => {
  switch (status) {
    case 'em_analise':
      return {
        label: 'Em Análise',
        bg: isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/25' : 'bg-amber-50 text-amber-700 border-amber-200',
        icon: '🔍'
      };
    case 'aguardando_orcamento':
      return {
        label: 'Aguardando Aprovação',
        bg: isDark ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25' : 'bg-indigo-50 text-indigo-700 border-indigo-200',
        icon: '⏳'
      };
    case 'orcamento_aprovado':
      return {
        label: 'Orçamento Aprovado',
        bg: isDark ? 'bg-emerald-500/10 text-emerald-455 border-emerald-500/25' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: '🟢'
      };
    case 'orcamento_rejeitado':
      return {
        label: 'Orçamento Rejeitado',
        bg: isDark ? 'bg-rose-500/10 text-rose-400 border-rose-500/25' : 'bg-rose-50 text-rose-700 border-rose-200',
        icon: '🔴'
      };
    case 'em_manutencao':
      return {
        label: 'Em Manutenção',
        bg: isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/25' : 'bg-blue-50 text-blue-700 border-blue-200',
        icon: '🔧'
      };
    case 'aguardando_peca':
      return {
        label: 'Aguardando Peça',
        bg: isDark ? 'bg-orange-500/10 text-orange-400 border-orange-500/25' : 'bg-orange-50 text-orange-700 border-orange-200',
        icon: '⚙️'
      };
    case 'garantia':
      return {
        label: 'Em Garantia',
        bg: isDark ? 'bg-purple-500/10 text-purple-400 border-purple-500/25' : 'bg-purple-50 text-purple-700 border-purple-200',
        icon: '🛡️'
      };
    case 'pronto':
      return {
        label: 'Pronto / Concluído',
        bg: isDark ? 'bg-teal-500/10 text-teal-400 border-teal-500/25' : 'bg-teal-50 text-teal-700 border-teal-200',
        icon: '✅'
      };
    case 'entregue':
      return {
        label: 'Entregue',
        bg: isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700/50' : 'bg-zinc-100 text-zinc-600 border-zinc-200',
        icon: '📦'
      };
    case 'sem_conserto':
      return {
        label: 'Sem Conserto',
        bg: isDark ? 'bg-zinc-900 text-zinc-500 border-zinc-800' : 'bg-zinc-100 text-zinc-500 border-zinc-200',
        icon: '❌'
      };
    default:
      return {
        label: 'Desconhecido',
        bg: isDark ? 'bg-zinc-900 text-zinc-500 border-zinc-800' : 'bg-zinc-100 text-zinc-500 border-zinc-200',
        icon: '•'
      };
  }
};

export default function GestaoOS() {
  const { estabelecimentoIdPrincipal } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [ordens, setOrdens] = useState([]);
  
  // Modais
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOsId, setSelectedOsId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  
  // Filtros
  const [filtroStatus, setFiltroStatus] = useState('ativos'); // 'todos' | 'ativos' | status específico
  const [termoBusca, setTermoBusca] = useState('');

  const [activeTab, setActiveTab] = useState('lista'); // 'lista' | 'configuracao'
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [configOS, setConfigOS] = useState({
    empresaNome: '',
    empresaLogo: '',
    empresaEndereco: '',
    empresaCNPJ: '',
    empresaTelefone: '',
    termosGarantiaPadrao: ''
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [logoImageFile, setLogoImageFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');

  useEffect(() => {
    if (!estabelecimentoIdPrincipal || activeTab !== 'configuracao') return;
    
    const carregarConfigOS = async () => {
      setLoadingConfig(true);
      try {
        const configRef = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'config', 'ordensServico');
        const snap = await getDoc(configRef);
        if (snap.exists()) {
          const data = snap.data();
          setConfigOS({
            empresaNome: data.empresaNome || '',
            empresaLogo: data.empresaLogo || '',
            empresaEndereco: data.empresaEndereco || '',
            empresaCNPJ: data.empresaCNPJ || '',
            empresaTelefone: data.empresaTelefone || '',
            termosGarantiaPadrao: data.termosGarantiaPadrao || ''
          });
          setLogoPreview(data.empresaLogo || '');
        }
      } catch (err) {
        console.error("Erro ao carregar configurações da OS:", err);
        toast.error("Erro ao carregar configurações.");
      } finally {
        setLoadingConfig(false);
      }
    };
    
    carregarConfigOS();
  }, [estabelecimentoIdPrincipal, activeTab]);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      let finalLogoUrl = configOS.empresaLogo;
      
      if (logoImageFile) {
        const logoName = `os_logos/${estabelecimentoIdPrincipal}_${Date.now()}`;
        finalLogoUrl = await uploadFile(logoImageFile, logoName);
      }
      
      const configRef = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'config', 'ordensServico');
      await setDoc(configRef, {
        empresaNome: configOS.empresaNome,
        empresaLogo: finalLogoUrl,
        empresaEndereco: configOS.empresaEndereco,
        empresaCNPJ: configOS.empresaCNPJ,
        empresaTelefone: configOS.empresaTelefone,
        termosGarantiaPadrao: configOS.termosGarantiaPadrao
      }, { merge: true });
      
      setConfigOS(prev => ({ ...prev, empresaLogo: finalLogoUrl }));
      setLogoImageFile(null);
      toast.success("Configurações da OS salvas com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar configurações.");
    } finally {
      setSavingConfig(false);
    }
  };

  // Tema
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('dashboard_theme');
    return saved || 'dark';
  });

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('dashboard_theme', newTheme);
  };

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'dashboard_theme') {
        setTheme(e.newValue || 'dark');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

    const isDark = theme === 'dark';

  const styles = {
    bg: isDark
      ? 'bg-gradient-to-br from-zinc-950 via-black to-zinc-900 text-slate-300'
      : 'bg-gradient-to-br from-slate-50 via-slate-100 to-zinc-100 text-slate-700',
    title: isDark ? 'text-white' : 'text-slate-800',
    subtitle: isDark ? 'text-zinc-400' : 'text-slate-500',
    headerBorder: isDark ? 'border-white/5' : 'border-slate-200',
    kpiTitle: isDark ? 'text-zinc-400' : 'text-slate-600',
    kpiVal: isDark ? 'text-white' : 'text-black font-black',
    filterContainer: isDark
      ? 'bg-zinc-900/40 backdrop-blur-xl border border-white/5 shadow-2xl'
      : 'bg-white border border-slate-200 shadow-md',
    btnFilterActive: isDark
      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/10'
      : 'bg-indigo-100 text-black border-indigo-500 shadow-md shadow-indigo-500/10',
    btnFilterInactive: isDark
      ? 'bg-zinc-950/60 text-zinc-400 border border-white/5 hover:bg-zinc-800/60 hover:text-white'
      : 'bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200/80 hover:text-black',
    searchInput: isDark
      ? 'bg-zinc-950/80 hover:bg-zinc-900/60 focus:bg-zinc-950 border border-white/10 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-white placeholder:text-zinc-600 shadow-inner'
      : 'bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-black placeholder:text-slate-500 shadow-inner',
    searchIcon: isDark ? 'text-zinc-500' : 'text-slate-500',
    tableWrap: isDark
      ? 'border border-white/5 bg-zinc-950/20'
      : 'border border-slate-200 bg-white/70 shadow-sm',
    tableHeaderRow: isDark
      ? 'bg-zinc-900/60 text-zinc-400 border-b border-white/5'
      : 'bg-slate-100 text-slate-800 border-b border-slate-200',
    tableRowBorder: isDark ? 'divide-white/5' : 'divide-slate-200',
    tableRowHover: isDark ? 'hover:bg-white/5 text-zinc-300' : 'hover:bg-slate-50 text-slate-800',
    tableTextWhite: isDark ? 'text-white' : 'text-black font-black',
    tableTextZinc: isDark ? 'text-zinc-200' : 'text-slate-800',
    tableTextZincMuted: isDark ? 'text-zinc-400' : 'text-slate-500',
    actionBtn: isDark
      ? 'bg-zinc-900 hover:bg-zinc-800 hover:text-white text-zinc-400 border border-white/5'
      : 'bg-slate-50 hover:bg-slate-100 hover:text-black text-slate-800 border border-slate-200',
    actionEditBtn: isDark
      ? 'bg-zinc-900 hover:bg-amber-500/10 hover:text-amber-400 text-zinc-400 border border-white/5'
      : 'bg-slate-50 hover:bg-amber-100 hover:text-amber-700 text-slate-800 border border-slate-200',
    actionDeleteBtn: isDark
      ? 'bg-zinc-900 hover:bg-red-500/10 hover:text-red-400 text-zinc-500 border border-white/5'
      : 'bg-slate-50 hover:bg-red-100 hover:text-red-700 text-slate-800 border border-slate-200',
    emptyStateBorder: isDark ? 'border border-dashed border-white/5 bg-zinc-950/40' : 'border border-dashed border-slate-200 bg-slate-50/50',
    emptyStateText: isDark ? 'text-zinc-300' : 'text-slate-800',
    emptyStateSubtext: isDark ? 'text-zinc-500' : 'text-slate-600',
    emptyIcon: isDark ? 'text-zinc-500' : 'text-slate-500',
    loaderSpin: isDark ? 'border-white/10 border-t-indigo-500' : 'border-slate-200 border-t-indigo-600',
    loaderText: isDark ? 'text-zinc-400' : 'text-slate-600',
    formLabel: isDark ? 'text-zinc-400 font-extrabold uppercase tracking-widest text-[10px]' : 'text-slate-600 font-extrabold uppercase tracking-widest text-[10px]',
    formInput: isDark 
      ? 'bg-zinc-950/80 border border-white/10 text-white placeholder-zinc-650 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 rounded-2xl p-3.5 text-xs font-bold transition-all outline-none w-full' 
      : 'bg-slate-50 border border-slate-200 text-black placeholder-slate-400 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 rounded-2xl p-3.5 text-xs font-bold transition-all outline-none w-full',
    formCard: isDark
      ? 'bg-zinc-900/40 backdrop-blur-xl border border-white/5 shadow-2xl p-6 rounded-[2.2rem] space-y-6 relative'
      : 'bg-white border border-slate-200 shadow-md p-6 rounded-[2.2rem] space-y-6 relative',
  };

  const carregarDados = async () => {
    if (!estabelecimentoIdPrincipal) return;
    setLoading(true);
    try {
      const list = await osService.listarOrdensServico(estabelecimentoIdPrincipal);
      setOrdens(list);
    } catch (err) {
      toast.error("Erro ao carregar Ordens de Serviço.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [estabelecimentoIdPrincipal]);

  const handleDelete = (osId) => {
    setDeleteConfirmId(osId);
  };

  // KPIs
  const stats = useMemo(() => {
    let ativas = 0;
    let aguardando = 0;
    let manutencao = 0;
    let prontas = 0;
    
    ordens.forEach(os => {
      if (!['entregue', 'sem_conserto', 'orcamento_rejeitado'].includes(os.status)) {
        ativas++;
      }
      if (os.status === 'aguardando_orcamento') aguardando++;
      if (os.status === 'em_manutencao') manutencao++;
      if (os.status === 'pronto') prontas++;
    });
    
    return { total: ordens.length, ativas, aguardando, manutencao, prontas };
  }, [ordens]);

  // Lista Filtrada
  const ordensFiltradas = useMemo(() => {
    return ordens.filter(os => {
      // 1. Filtro de Status
      if (filtroStatus === 'ativos') {
        if (['entregue', 'sem_conserto', 'orcamento_rejeitado'].includes(os.status)) return false;
      } else if (filtroStatus !== 'todos') {
        if (os.status !== filtroStatus) return false;
      }
      
      // 2. Filtro de Texto
      if (termoBusca) {
        const queryClean = termoBusca
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
          
        const matchesClient = os.cliente?.nome?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(queryClean);
        const matchesPhone = os.cliente?.telefone?.includes(queryClean);
        const matchesModel = os.equipamento?.modelo?.toLowerCase().includes(queryClean);
        const matchesBrand = os.equipamento?.marca?.toLowerCase().includes(queryClean);
        const matchesOSNum = String(os.numeroOS).includes(queryClean);
        const matchesIMEI = os.equipamento?.nSeriesOrImei || os.equipamento?.nSerieOrImei; // check both keys
        const matchesIMEIClean = matchesIMEI?.includes(queryClean);
        const matchesPlaca = os.equipamento?.placa?.toLowerCase().includes(queryClean);
        
        return matchesClient || matchesPhone || matchesModel || matchesBrand || matchesOSNum || matchesIMEIClean || matchesPlaca;
      }
      
      return true;
    });
  }, [ordens, filtroStatus, termoBusca]);

  // Framer Motion variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className={`space-y-6 font-sans min-h-screen -mx-4 sm:-mx-6 lg:-mx-8 -my-6 md:-my-8 p-6 md:p-8 relative overflow-hidden transition-colors duration-300 ${styles.bg}`}>
      {/* Background neon glows */}
      {isDark && (
        <>
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-10 left-10 w-80 h-80 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
        </>
      )}
      {!isDark && (
        <>
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-10 left-10 w-80 h-80 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
        </>
      )}

      {/* HEADER BAR */}
      <div className={`relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5 ${styles.headerBorder}`}>
        <div className="flex items-center gap-3">
          <BackButton to="/admin/dashboard" className={isDark ? "bg-zinc-900/50 border-white/10 hover:bg-zinc-800/50 text-white" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-800"} />
          <div>
            <h1 className={`text-2xl font-black tracking-tight ${styles.title}`}>Ordem de Serviço (OS)</h1>
            <p className={`text-xs font-medium ${styles.subtitle}`}>Gerencie manutenções, peças e status técnicos dos dispositivos</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={toggleTheme}
            className={`p-3 rounded-2xl border transition-all ${
              isDark 
                ? 'bg-zinc-900/50 border-white/10 hover:bg-zinc-800/50 text-zinc-400 hover:text-white' 
                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800'
            }`}
            title={isDark ? 'Modo Claro' : 'Modo Escuro'}
          >
            {isDark ? <FiSun size={18} /> : <FiMoon size={18} />}
          </button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { setSelectedOsId(null); setModalOpen(true); }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-600/20"
          >
            <IoAdd size={18} /> ABRIR NOVA OS
          </motion.button>
        </div>
      </div>

      {/* TABS SWITCHER */}
      <div className="no-print relative z-10 flex gap-2 border-b border-white/5 pb-1">
        <button
          onClick={() => setActiveTab('lista')}
          className={`px-6 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-xl transition-all border-b-2 ${
            activeTab === 'lista'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          📋 Ordens de Serviço
        </button>
        <button
          onClick={() => setActiveTab('configuracao')}
          className={`px-6 py-2.5 text-xs font-black uppercase tracking-wider rounded-t-xl transition-all border-b-2 ${
            activeTab === 'configuracao'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          ⚙️ Configurações da OS
        </button>
      </div>

      {activeTab === 'lista' && (
        <>
          {/* KPI METRIC CARDS */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative z-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4"
      >
        {[
          { label: 'Total de OS', val: stats.total, icon: IoDocumentsOutline, darkColor: 'text-zinc-300', lightColor: 'text-slate-600', darkBg: 'bg-white/5 border-white/5', lightBg: 'bg-slate-100 border-slate-200/60', glow: 'shadow-[0_0_15px_rgba(255,255,255,0.03)]' },
          { label: 'OS Ativas', val: stats.ativas, icon: IoBuildOutline, darkColor: 'text-indigo-400', lightColor: 'text-indigo-600', darkBg: 'bg-indigo-500/10 border-indigo-500/20', lightBg: 'bg-indigo-50 border-indigo-200/50', glow: 'shadow-[0_0_15px_rgba(99,102,241,0.08)]' },
          { label: 'Aguardando Aprov.', val: stats.aguardando, icon: IoTimeOutline, darkColor: 'text-amber-400', lightColor: 'text-amber-600', darkBg: 'bg-amber-500/10 border-amber-500/20', lightBg: 'bg-amber-50 border-amber-200/50', glow: 'shadow-[0_0_15px_rgba(245,158,11,0.08)]' },
          { label: 'Em Conserto', val: stats.manutencao, icon: IoBuildOutline, darkColor: 'text-blue-400', lightColor: 'text-blue-600', darkBg: 'bg-blue-500/10 border-blue-500/20', lightBg: 'bg-blue-50 border-blue-200/50', glow: 'shadow-[0_0_15px_rgba(59,130,246,0.08)]' },
          { label: 'Prontas p/ Retirada', val: stats.prontas, icon: IoCheckmarkCircleOutline, darkColor: 'text-emerald-400', lightColor: 'text-emerald-600', darkBg: 'bg-emerald-500/10 border-emerald-500/20', lightBg: 'bg-emerald-50 border-emerald-200/50', glow: 'shadow-[0_0_15px_rgba(16,185,129,0.08)]' }
        ].map((kpi, idx) => {
          const KpiIcon = kpi.icon;
          return (
            <motion.div
              variants={itemVariants}
              whileHover={{ y: -4, border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(99,102,241,0.2)' }}
              key={idx}
              className={`border p-5 rounded-[2rem] flex items-center justify-between transition-colors ${
                isDark 
                  ? `border-white/5 bg-zinc-900/40 backdrop-blur-xl ${kpi.glow}` 
                  : 'border-slate-200 bg-white shadow-md'
              }`}
            >
              <div className="space-y-1">
                <p className={`text-[10px] font-black uppercase tracking-wider ${styles.kpiTitle}`}>{kpi.label}</p>
                <p className={`text-2xl font-black ${styles.kpiVal}`}>{kpi.val}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shadow-sm ${
                isDark ? `${kpi.darkBg} ${kpi.darkColor}` : `${kpi.lightBg} ${kpi.lightColor}`
              }`}>
                <KpiIcon size={20} />
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* FILTER & SEARCH */}
      <div className={`relative z-10 rounded-[2.2rem] p-5 space-y-4 ${styles.filterContainer}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Status Filter Buttons */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'ativos', label: 'Ativas' },
              { id: 'todos', label: 'Ver Todas' },
              { id: 'em_analise', label: 'Em Análise' },
              { id: 'aguardando_orcamento', label: 'Aguardando Aprov.' },
              { id: 'orcamento_aprovado', label: 'Aprovadas' },
              { id: 'em_manutencao', label: 'Manutenção' },
              { id: 'aguardando_peca', label: 'Aguardando Peça' },
              { id: 'garantia', label: 'Em Garantia' },
              { id: 'pronto', label: 'Prontas' },
              { id: 'entregue', label: 'Entregues' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltroStatus(f.id)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all border ${
                  filtroStatus === f.id
                    ? styles.btnFilterActive
                    : styles.btnFilterInactive
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          
          {/* Text Search Box */}
          <div className="relative w-full lg:w-80 shrink-0">
            <IoSearch className={`absolute left-4 top-1/2 -translate-y-1/2 ${styles.searchIcon}`} size={18} />
            <input
              type="text"
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              placeholder="Buscar por cliente, IMEI ou OS..."
              className={`w-full pl-11 pr-4 py-3 rounded-2xl text-xs font-bold outline-none transition-all ${styles.searchInput}`}
            />
          </div>
          
        </div>

        {/* DATA TABLE */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className={`animate-spin w-10 h-10 border-4 rounded-full mb-3 ${styles.loaderSpin}`}></div>
            <p className={`text-xs font-black ${styles.loaderText}`}>Buscando ordens de serviço no banco...</p>
          </div>
        ) : ordensFiltradas.length === 0 ? (
          <div className={`text-center py-16 rounded-[1.8rem] flex flex-col items-center justify-center ${styles.emptyStateBorder}`}>
            <IoBuildOutline className={`mb-3 ${styles.emptyIcon}`} size={40} />
            <h3 className={`font-extrabold text-sm ${styles.emptyStateText}`}>Nenhuma Ordem de Serviço Encontrada</h3>
            <p className={`text-xs font-bold mt-1 ${styles.emptyStateSubtext}`}>Experimente mudar o status do filtro ou iniciar uma nova OS</p>
          </div>
        ) : (
          <div className={`overflow-x-auto rounded-[1.8rem] ${styles.tableWrap}`}>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className={`text-[10px] font-black uppercase tracking-wider ${styles.tableHeaderRow}`}>
                  <th className="p-4 w-20">Nº OS</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Equipamento</th>
                  <th className="p-4">Técnico</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Total</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className={`divide-y font-bold ${styles.tableRowBorder} ${styles.tableTextZinc}`}>
                {ordensFiltradas.map((os) => {
                  const statusStyle = getStatusBadgeStyle(os.status, isDark);
                  return (
                    <tr key={os.id} className={`transition-colors group ${styles.tableRowHover}`}>
                      
                      {/* OS ID */}
                      <td className={`p-4 font-black ${styles.tableTextWhite}`}>#{os.numeroOS}</td>
                      
                      {/* Customer Info */}
                      <td className="p-4">
                        <p className={`font-extrabold text-xs ${styles.tableTextWhite}`}>{os.cliente?.nome}</p>
                        <p className={`text-[10px] font-semibold mt-0.5 ${styles.tableTextZincMuted}`}>{os.cliente?.telefone}</p>
                      </td>
                      
                      {/* Equipment Info */}
                      <td className="p-4">
                        <p className={`font-bold text-xs ${styles.tableTextWhite}`}>{os.equipamento?.marca} {os.equipamento?.modelo}</p>
                        {os.equipamento?.nSerieOrImei && (
                          <p className={`text-[9px] font-mono mt-0.5 ${styles.tableTextZincMuted}`}>IMEI: {os.equipamento?.nSerieOrImei}</p>
                        )}
                      </td>
                      
                      {/* Technician */}
                      <td className={`p-4 font-semibold ${styles.tableTextZincMuted}`}>{os.tecnicoResponsavel?.nome || 'Nenhum'}</td>
                      
                      {/* Status Badge */}
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase whitespace-nowrap inline-flex items-center gap-1 ${statusStyle.bg}`}>
                          <span>{statusStyle.icon}</span>
                          <span>{statusStyle.label}</span>
                        </span>
                      </td>
                      
                      {/* Financial Total */}
                      <td className={`p-4 text-right font-black text-xs ${styles.tableTextWhite}`}>
                        R$ {parseFloat(os.total || 0).toFixed(2)}
                        <p className={`text-[8px] font-black uppercase tracking-wider mt-0.5 ${os.situacaoFinanceira === 'pago' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {os.situacaoFinanceira === 'pago' ? 'Pago' : 'Pendente'}
                        </p>
                      </td>
                      
                      {/* Actions */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/os/${os.id}`)}
                            title="Visualizar OS"
                            className={`p-2 rounded-xl transition-all active:scale-95 border ${styles.actionBtn}`}
                          >
                            <IoEyeOutline size={16} />
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => { setSelectedOsId(os.id); setModalOpen(true); }}
                            title="Editar OS"
                            className={`p-2 rounded-xl transition-all active:scale-95 border ${styles.actionEditBtn}`}
                          >
                            <IoPencilOutline size={16} />
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => handleDelete(os.id)}
                            title="Excluir OS"
                            className={`p-2 rounded-xl transition-all active:scale-95 border ${styles.actionDeleteBtn}`}
                          >
                            <IoTrashOutline size={16} />
                          </button>
                          
                        </div>
                      </td>
                      
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}

      {activeTab === 'configuracao' && (
        <div className="relative z-10 max-w-4xl mx-auto space-y-6">
          {loadingConfig ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className={`animate-spin w-10 h-10 border-4 rounded-full mb-3 ${styles.loaderSpin}`}></div>
              <p className={`text-xs font-black ${styles.loaderText}`}>Carregando configurações...</p>
            </div>
          ) : (
            <motion.form
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleSaveConfig}
              className={styles.formCard}
            >
              <div>
                <h2 className={`text-sm font-black uppercase tracking-wider ${styles.title}`}>⚙️ Configurações de Identificação da Empresa</h2>
                <p className={`text-[10px] font-medium ${styles.subtitle} mt-1`}>Essas informações serão impressas no cabeçalho dos recibos de Ordem de Serviço</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Nome da Empresa */}
                <div className="space-y-1.5">
                  <label className={styles.formLabel}>Nome Fantasia / Razão Social</label>
                  <input
                    type="text"
                    required
                    value={configOS.empresaNome}
                    onChange={(e) => setConfigOS(prev => ({ ...prev, empresaNome: e.target.value }))}
                    placeholder="Ex: Assistência Técnica Express"
                    className={styles.formInput}
                  />
                </div>

                {/* CNPJ */}
                <div className="space-y-1.5">
                  <label className={styles.formLabel}>CNPJ (opcional)</label>
                  <input
                    type="text"
                    value={configOS.empresaCNPJ}
                    onChange={(e) => setConfigOS(prev => ({ ...prev, empresaCNPJ: e.target.value }))}
                    placeholder="00.000.000/0001-00"
                    className={styles.formInput}
                  />
                </div>

                {/* Telefone */}
                <div className="space-y-1.5">
                  <label className={styles.formLabel}>Telefone / WhatsApp de Contato</label>
                  <input
                    type="text"
                    required
                    value={configOS.empresaTelefone}
                    onChange={(e) => setConfigOS(prev => ({ ...prev, empresaTelefone: e.target.value }))}
                    placeholder="(81) 99999-9999"
                    className={styles.formInput}
                  />
                </div>

                {/* Endereço */}
                <div className="space-y-1.5">
                  <label className={styles.formLabel}>Endereço Completo</label>
                  <input
                    type="text"
                    required
                    value={configOS.empresaEndereco}
                    onChange={(e) => setConfigOS(prev => ({ ...prev, empresaEndereco: e.target.value }))}
                    placeholder="Rua, Número, Bairro, Cidade - UF"
                    className={styles.formInput}
                  />
                </div>
              </div>

              {/* Upload de Logo */}
              <div className="space-y-2 border-t border-white/5 pt-5">
                <label className={styles.formLabel}>Logotipo da Empresa</label>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {logoPreview ? (
                    <div className={`w-24 h-24 rounded-2xl overflow-hidden border flex items-center justify-center p-2 bg-white transition-colors duration-300 ${
                      isDark ? 'border-zinc-700' : 'border-slate-350'
                    }`}>
                      <img src={logoPreview} alt="Preview Logo" className="max-w-full max-h-full object-contain" />
                    </div>
                  ) : (
                    <div className={`w-24 h-24 rounded-2xl border-2 border-dashed flex items-center justify-center text-[10px] text-center font-bold px-2 transition-colors duration-300 ${
                      isDark ? 'border-white/10 text-zinc-500' : 'border-slate-300 text-slate-400'
                    }`}>
                      Sem Logo
                    </div>
                  )}

                  <div className="flex-1 space-y-2 w-full">
                    <input
                      type="file"
                      accept="image/*"
                      id="logo-upload"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setLogoImageFile(file);
                          setLogoPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="hidden"
                    />
                    <div className="flex flex-wrap gap-2">
                      <label
                        htmlFor="logo-upload"
                        className="cursor-pointer bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl border border-white/5 transition-colors shadow-sm inline-block"
                      >
                        📷 Escolher Imagem
                      </label>
                      {logoPreview && (
                        <button
                          type="button"
                          onClick={() => {
                            setLogoImageFile(null);
                            setLogoPreview('');
                            setConfigOS(prev => ({ ...prev, empresaLogo: '' }));
                          }}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-extrabold text-xs px-4 py-2.5 rounded-xl transition-colors"
                        >
                          Remover Logo
                        </button>
                      )}
                    </div>
                    <p className={`text-[9px] font-medium ${styles.subtitle}`}>Selecione um arquivo de imagem quadrado ou retangular leve (PNG, JPG).</p>
                  </div>
                </div>
              </div>

              {/* Termos de Garantia Padrão */}
              <div className="space-y-1.5 border-t border-white/5 pt-5">
                <label className={styles.formLabel}>Termos de Garantia Padrão</label>
                <textarea
                  value={configOS.termosGarantiaPadrao}
                  onChange={(e) => setConfigOS(prev => ({ ...prev, termosGarantiaPadrao: e.target.value }))}
                  placeholder="Escreva os termos de garantia padrão que serão exibidos nos recibos e impressões. Você pode detalhar prazos, exclusões e regras gerais."
                  rows={4}
                  className={`${styles.formInput} font-normal leading-relaxed`}
                />
              </div>

              {/* Botão de Enviar */}
              <div className="flex justify-end pt-4 border-t border-white/5">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={savingConfig}
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {savingConfig ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      <span>SALVANDO CONFIGURAÇÕES...</span>
                    </>
                  ) : (
                    <span>SALVAR CONFIGURAÇÕES</span>
                  )}
                </motion.button>
              </div>
            </motion.form>
          )}
        </div>
      )}

      {/* FORM MODAL */}
      <ModalOrdemServico
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        estabelecimentoId={estabelecimentoIdPrincipal}
        osId={selectedOsId}
        onSaved={carregarDados}
        theme={theme}
      />

      {deleteConfirmId && (
        <ConfirmDialog
          open={true}
          title="Excluir Ordem de Serviço"
          message="Deseja realmente excluir esta ordem de serviço? Esta ação não pode ser desfeita."
          variant="danger"
          confirmText="Excluir"
          cancelText="Cancelar"
          onConfirm={async () => {
            const osId = deleteConfirmId;
            setDeleteConfirmId(null);
            try {
              await osService.excluirOrdemServico(estabelecimentoIdPrincipal, osId);
              toast.success("Ordem de serviço excluída!");
              carregarDados();
            } catch (err) {
              toast.error("Erro ao excluir OS.");
            }
          }}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}
    </div>
  );
}
