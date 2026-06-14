import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DateRangeFilter from '../components/DateRangeFilter';
import { useMasterDashboardData } from '../hooks/useMasterDashboardData';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  FiHome, FiUsers, FiFileText, FiUpload, FiTag, FiShield, FiImage,
  FiLogOut, FiShoppingCart, FiDollarSign, FiRefreshCw,
  FiTrendingUp, FiZap, FiAward, FiBell, FiSearch,
  FiSun, FiMoon, FiChevronDown, FiChevronUp, FiMessageSquare,
  FiPackage, FiSettings, FiBarChart2, FiGrid, FiActivity,
  FiMapPin, FiPhone, FiMail, FiClock, FiAlertCircle
} from 'react-icons/fi';

function MasterDashboard() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();

  const {
    loadingDashboard,
    searchQuery,
    setSearchQuery,
    financeiro,
    stats,
    estabelecimentosMap,
    alertas,
    datePreset,
    dateRange,
    handleDatePresetChange,
    handleDateRangeChange,
    handleDateClear,
    fetchHistoricalData,
    financeiroFiltrado,
    crescimento,
    ticketMedio,
    contatosEstabelecimentos,
    selectedStore,
    setSelectedStore
  } = useMasterDashboardData(currentUser, isMasterAdmin);

  const [selectedLoja, setSelectedLoja] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);

  const statsLoja = useMemo(() => {
    if (!selectedLoja || !selectedLoja.itens) return { deliveryTotal: 0, deliveryQtd: 0, salaoTotal: 0, salaoQtd: 0 };
    
    let deliveryTotal = 0;
    let deliveryQtd = 0;
    let salaoTotal = 0;
    let salaoQtd = 0;

    selectedLoja.itens.forEach(venda => {
      const isMesa = venda.tipo === 'mesa' || venda.source === 'salao' || !!venda.mesaNumero || !!venda.numeroMesa;
      const isPedidoCol = venda._path && venda._path.includes('/pedidos/');
      const total = Number(venda.totalFinal) || Number(venda.total) || Number(venda.valorFinal) || 0;
      
      if (isPedidoCol && !isMesa) {
        deliveryTotal += total;
        deliveryQtd += 1;
      } else {
        salaoTotal += total;
        salaoQtd += 1;
      }
    });

    return { deliveryTotal, deliveryQtd, salaoTotal, salaoQtd };
  }, [selectedLoja]);

  const searchInputRef = useRef(null);

  // Carrega fontes customizadas de alta estética
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700;800&display=swap';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('dashboard_theme');
    return saved || 'dark';
  });

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('dashboard_theme', newTheme);
  };

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const userName = currentUser?.displayName || currentUser?.nome || currentUser?.email?.split('@')[0] || 'Admin';

  const formatCurrency = (value) => {
    return Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const modules = useMemo(() => [
    {
      id: 'operations',
      title: 'Operações',
      icon: <FiPackage size={20} />,
      colorClass: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
      accentColor: 'hover:border-cyan-500/40 hover:shadow-cyan-950/10',
      tagColor: 'text-cyan-400',
      items: [
        { to: '/master/estabelecimentos', label: 'Estabelecimentos', icon: <FiHome size={14} />, desc: 'Gerenciar lojas parceiras' },
        { to: '/master/clientes', label: 'Clientes', icon: <FiUsers size={14} />, desc: 'Base de clientes' },
        { to: '/master/pedidos', label: 'Pedidos', icon: <FiShoppingCart size={14} />, desc: 'Acompanhar entregas' },
      ]
    },
    {
      id: 'financial',
      title: 'Financeiro',
      icon: <FiDollarSign size={20} />,
      colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      accentColor: 'hover:border-emerald-500/40 hover:shadow-emerald-950/10',
      tagColor: 'text-emerald-400',
      items: [
        { to: '/master/financeiro', label: 'Faturamento', icon: <FiBarChart2 size={14} />, desc: 'Visão consolidada' },
        { to: '/master/contas-receber', label: 'Contas a Receber', icon: <FiUsers size={14} />, desc: 'Cobranças e mensalidades' },
        { to: '/master/nfce', label: 'NFC-e', icon: <FiFileText size={14} />, desc: 'Documentos fiscais' },
        { to: '/master/departamentos-fiscais', label: 'Fiscal', icon: <FiShield size={14} />, desc: 'Configurações fiscais' },
      ]
    },
    {
      id: 'marketing',
      title: 'Marketing',
      icon: <FiTrendingUp size={20} />,
      colorClass: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
      accentColor: 'hover:border-violet-500/40 hover:shadow-violet-950/10',
      tagColor: 'text-violet-400',
      items: [
        { to: '/master/plans', label: 'Planos', icon: <FiTag size={14} />, desc: 'Gerenciar assinaturas' },
        { to: '/master/cupons-rede', label: 'Cupons', icon: <FiZap size={14} />, desc: 'Campanhas promocionais' },
        { to: '/master/mensagens', label: 'Mensagens', icon: <FiMessageSquare size={14} />, desc: 'Comunicação via WhatsApp' },
      ]
    },
    {
      id: 'admin',
      title: 'Administração',
      icon: <FiSettings size={20} />,
      colorClass: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
      accentColor: 'hover:border-orange-500/40 hover:shadow-orange-950/10',
      tagColor: 'text-orange-400',
      items: [
        { to: '/master/usuarios', label: 'Usuários', icon: <FiUsers size={14} />, desc: 'Controle de acessos' },
        { to: '/master/importar-cardapio', label: 'Importação', icon: <FiUpload size={14} />, desc: 'Cardápio via CSV' },
        { to: '/master/associar-imagens', label: 'Imagens', icon: <FiImage size={14} />, desc: 'Banco de imagens' },
      ]
    }
  ], []);

  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return modules;

    const query = searchQuery.toLowerCase();
    return modules.map(category => ({
      ...category,
      items: category.items.filter(item =>
        item.label.toLowerCase().includes(query) ||
        item.desc.toLowerCase().includes(query)
      )
    })).filter(category => category.items.length > 0);
  }, [searchQuery, modules]);

  const hourlyData = useMemo(() => {
    const ranking = financeiroFiltrado ? financeiroFiltrado.topLojas : financeiro.topLojas;
    const allSales = ranking ? ranking.flatMap(loja => loja.itens || []) : [];

    const hours = {};
    for (let i = 0; i < 24; i++) hours[i] = 0;

    allSales.forEach(sale => {
      const total = Number(sale.totalFinal) || Number(sale.total) || Number(sale.valorFinal) || 0;
      let date = null;

      try {
        if (sale.dataPedido?.toDate) date = sale.dataPedido.toDate();
        else if (sale.createdAt?.toDate) date = sale.createdAt.toDate();
        else if (sale.createdAt?.seconds) date = new Date(sale.createdAt.seconds * 1000);
        else if (sale.dataPedido?.seconds) date = new Date(sale.dataPedido.seconds * 1000);

        if (date) hours[date.getHours()] += total;
      } catch (e) { }
    });

    return Object.entries(hours)
      .filter(([_, value]) => value > 0)
      .map(([hour, value]) => ({
        hour: `${hour.padStart(2, '0')}:00`,
        value: Math.round(value * 100) / 100
      }));
  }, [financeiro, financeiroFiltrado]);

  // Design Systems adaptados de acordo com o Cookbook
  const themeClasses = {
    dark: {
      bg: 'bg-[#080d19]',
      surface: 'bg-slate-900/40 backdrop-blur-xl border border-white/5 shadow-2xl',
      surfaceHover: 'hover:bg-slate-900/60 hover:border-indigo-500/25 hover:shadow-[0_12px_40px_rgba(99,102,241,0.08)] hover:scale-[1.015] hover:-translate-y-0.5',
      border: 'border-white/5',
      text: 'text-white font-outfit',
      textSecondary: 'text-slate-400 font-outfit font-medium',
      textMuted: 'text-slate-500 font-outfit font-semibold',
      accent: 'bg-indigo-600 shadow-indigo-950/20',
      accentHover: 'hover:bg-indigo-700',
      gradient: 'from-cyan-400 via-indigo-500 to-purple-600',
      cardBg: 'bg-slate-900/25 backdrop-blur-lg border border-white/5 shadow-xl',
      inputBg: 'bg-slate-950/60 border-white/5 focus-within:border-indigo-500/50',
    },
    light: {
      bg: 'bg-[#f4f6fc]',
      surface: 'bg-white/80 backdrop-blur-md border border-slate-200/50 shadow-lg',
      surfaceHover: 'hover:bg-white hover:border-blue-500/20 hover:shadow-[0_12px_40px_rgba(59,130,246,0.06)] hover:scale-[1.015] hover:-translate-y-0.5',
      border: 'border-slate-200/50',
      text: 'text-slate-900 font-outfit font-bold',
      textSecondary: 'text-slate-650 font-outfit font-medium',
      textMuted: 'text-slate-400 font-outfit font-semibold',
      accent: 'bg-blue-600 shadow-blue-100',
      accentHover: 'hover:bg-blue-700',
      gradient: 'from-blue-600 via-indigo-600 to-purple-700',
      cardBg: 'bg-white/60 backdrop-blur-md border border-slate-200/50 shadow-md',
      inputBg: 'bg-slate-100/50 border-slate-200/50 focus-within:border-blue-550/50',
    }
  };

  const t = themeClasses[theme];

  // Tooltip customizado com layout "HUD" Sci-fi
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className={`p-4 rounded-2xl border backdrop-blur-xl shadow-2xl ${
          theme === 'dark'
            ? 'bg-slate-950/90 border-indigo-500/30 text-white'
            : 'bg-white/90 border-slate-200/80 text-slate-900'
        }`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-450 mb-1.5">{label}</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
            <p className="text-sm font-black font-space-grotesk">{formatCurrency(payload[0].value)}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (authLoading) {
    return (
      <div className={`min-h-screen ${t.bg} flex items-center justify-center font-sans`}>
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 border-4 border-slate-800 rounded-full" />
            <div className="absolute inset-0 border-4 border-t-indigo-500 rounded-full animate-spin" />
          </div>
          <p className={`text-xs font-black uppercase tracking-wider ${t.textSecondary}`}>Carregando Módulos Master...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${t.bg} transition-colors duration-500 relative overflow-hidden pb-12 font-outfit`}>
      
      {/* Estilos e Variáveis Injetadas */}
      <style>{`
        .font-space-grotesk {
          font-family: 'Space Grotesk', sans-serif !important;
        }
        .font-outfit {
          font-family: 'Outfit', sans-serif !important;
        }
        @keyframes rotate-gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient-border {
          background-size: 200% 200%;
          animation: rotate-gradient 5s ease infinite;
        }
        /* Oculta barra de rolagem */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Esferas de luz ambiente flutuantes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            x: [0, 50, -30, 0],
            y: [0, -60, 30, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-[-15%] left-1/4 w-[650px] h-[650px] rounded-full bg-gradient-to-tr from-cyan-550/8 to-transparent blur-[140px]"
        />
        <motion.div
          animate={{
            x: [0, -30, 40, 0],
            y: [0, 40, -40, 0],
            scale: [1, 0.95, 1.15, 1],
          }}
          transition={{
            duration: 28,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-1/3 right-[5%] w-[550px] h-[550px] rounded-full bg-gradient-to-tr from-purple-550/8 to-transparent blur-[120px]"
        />
        <motion.div
          animate={{
            x: [0, 40, -20, 0],
            y: [0, 30, 20, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-emerald-550/5 to-transparent blur-[110px]"
        />
      </div>

      {/* Main Layout Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10 space-y-6">

        {/* HEADER GLASS CARD */}
        <header className={`p-6 rounded-[2.5rem] border backdrop-blur-xl transition-all shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 ${t.surface} ${t.border}`}>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            {/* Avatar com anel de gradiente giratório */}
            <div className="relative p-0.5 rounded-2xl overflow-hidden bg-gradient-to-tr from-cyan-400 via-indigo-500 to-purple-600 shadow-lg shrink-0">
              <div className="w-12 h-12 rounded-[14px] bg-slate-900 flex items-center justify-center text-white font-space-grotesk font-black text-lg">
                {userName[0].toUpperCase()}
              </div>
            </div>
            <div>
              <h1 className={`text-xl font-black tracking-tight ${t.text} flex items-center gap-1.5`}>
                {saudacao}, <span className="bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-600 bg-clip-text text-transparent">{userName}</span>
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className={`text-xs ${t.textSecondary}`}>
                  {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                  theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-550/15' : 'bg-emerald-50 text-emerald-600 border-emerald-250/20'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  ONLINE
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 w-full sm:w-auto shrink-0">
            {/* Bell/Alerts Panel */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-3 rounded-2xl ${t.surface} ${t.border} border ${t.textSecondary} hover:text-white hover:border-indigo-500/30 transition-all relative active:scale-95`}
              >
                <FiBell size={18} />
                {(alertas.certVencidos.length > 0 || alertas.mensalidadeAtrasada.length > 0) && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-black border-2 border-slate-950">
                    {alertas.certVencidos.length + alertas.mensalidadeAtrasada.length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className={`absolute right-0 mt-3 w-80 rounded-3xl border p-4 shadow-2xl z-50 ${t.surface} ${t.border}`}
                  >
                    <h4 className={`text-xs font-black uppercase tracking-wider ${t.text} mb-3 pb-2 border-b ${t.border}`}>Alertas Administrativos</h4>
                    <div className="max-h-60 overflow-y-auto space-y-2 no-scrollbar">
                      {alertas.certVencidos.length === 0 && alertas.mensalidadeAtrasada.length === 0 ? (
                        <p className={`text-xs text-center py-4 ${t.textMuted}`}>Nenhum alerta pendente</p>
                      ) : (
                        <>
                          {alertas.certVencidos.map((estab) => (
                            <div key={estab.id} className="flex gap-2.5 p-3 rounded-2xl bg-red-500/5 border border-red-500/10 text-xs font-medium">
                              <FiAlertCircle className="text-red-400 shrink-0 mt-0.5" size={16} />
                              <div className="flex-1 space-y-0.5">
                                <p className={`font-black ${t.text}`}>{estab.nome}</p>
                                <p className="text-red-450 text-[10px] font-bold">Certificado digital vencido</p>
                              </div>
                            </div>
                          ))}
                          {alertas.mensalidadeAtrasada.map((estab) => (
                            <div key={estab.id} className="flex gap-2.5 p-3 rounded-2xl bg-orange-500/5 border border-orange-500/10 text-xs font-medium">
                              <FiAlertCircle className="text-orange-400 shrink-0 mt-0.5" size={16} />
                              <div className="flex-1 space-y-0.5">
                                <p className={`font-black ${t.text}`}>{estab.nome}</p>
                                <p className="text-orange-450 text-[10px] font-bold">Mensalidade em atraso</p>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                    <Link
                      to="/master/estabelecimentos"
                      onClick={() => setShowNotifications(false)}
                      className={`block text-center text-xs font-black text-blue-500 hover:text-blue-600 mt-3 pt-3 border-t ${t.border}`}
                    >
                      GERENCIAR ESTABELECIMENTOS
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={`p-3 rounded-2xl ${t.surface} ${t.border} border ${t.textSecondary} hover:text-white hover:border-indigo-500/30 transition-all active:scale-95`}
            >
              {theme === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
            </button>

            {/* Logout */}
            <button
              onClick={async () => { await logout(); navigate('/'); }}
              className={`p-3 rounded-2xl border text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all active:scale-95 ${t.surface} ${t.border}`}
            >
              <FiLogOut size={18} />
            </button>
          </div>
        </header>

        {/* GLOBAL GLASS SEARCH BAR */}
        <div className="relative">
          <div className={`flex items-center rounded-2xl px-4 py-3.5 border transition-all shadow-md focus-within:shadow-[0_0_25px_rgba(99,102,241,0.15)] ${t.inputBg}`}>
            <FiSearch className={t.textSecondary} size={18} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar módulos, funcionalidades..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`bg-transparent border-none outline-none ml-3 flex-1 text-xs font-bold placeholder-slate-500 focus:outline-none ${t.text}`}
            />
            <div className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-black select-none ${
              theme === 'dark' ? 'border-slate-800 bg-slate-950 text-slate-500' : 'border-slate-350 bg-slate-100 text-slate-600'
            }`}>
              <span>Ctrl</span>
              <span>+</span>
              <span>K</span>
            </div>
          </div>
        </div>

        {/* KPIS STATS GRID (4 Columns) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Hoje / Faturamento */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-[2rem] p-6 border transition-all duration-300 relative overflow-hidden group ${t.cardBg} ${t.surfaceHover}`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-r-full" />
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-450 rounded-xl">
                <FiDollarSign size={18} />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted}`}>FATURAMENTO</span>
            </div>
            <h3 className={`text-2xl font-black font-space-grotesk tracking-tight ${t.text}`}>
              {formatCurrency(financeiroFiltrado ? financeiroFiltrado.faturamento : financeiro.faturamentoHoje)}
            </h3>
            <p className={`text-[10px] mt-1 uppercase tracking-wider font-bold ${t.textSecondary}`}>
              {financeiroFiltrado ? 'Período Filtrado' : 'Faturamento de Hoje'}
            </p>
            {!financeiroFiltrado && (
              <div className={`flex items-center gap-1 mt-3 ${crescimento >= 0 ? 'text-emerald-400' : 'text-rose-450'}`}>
                {crescimento >= 0 ? <FiTrendingUp size={14} /> : <FiChevronDown size={14} />}
                <span className="text-[10px] font-black uppercase">{Math.abs(crescimento).toFixed(1)}% vs ontem</span>
              </div>
            )}
          </motion.div>

          {/* Card 2: Pedidos / Ticket */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`rounded-[2rem] p-6 border transition-all duration-300 relative overflow-hidden group ${t.cardBg} ${t.surfaceHover}`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-emerald-400 to-teal-500 rounded-r-full" />
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 rounded-xl">
                <FiShoppingCart size={18} />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted}`}>PEDIDOS</span>
            </div>
            <h3 className={`text-2xl font-black font-space-grotesk tracking-tight ${t.text}`}>
              {financeiroFiltrado ? financeiroFiltrado.qtd : financeiro.qtdHoje}
            </h3>
            <p className={`text-[10px] mt-1 uppercase tracking-wider font-bold ${t.textSecondary}`}>Volume Recente</p>
            <div className="mt-3">
              <span className={`text-[9px] font-black uppercase tracking-wide bg-slate-950/40 border ${t.border} px-2 py-0.5 rounded-lg ${t.textMuted}`}>
                Ticket: {formatCurrency(financeiroFiltrado ? financeiroFiltrado.ticketMedio : ticketMedio)}
              </span>
            </div>
          </motion.div>

          {/* Card 3: Lojas Ativas */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`rounded-[2rem] p-6 border transition-all duration-300 relative overflow-hidden group ${t.cardBg} ${t.surfaceHover}`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-purple-500 to-pink-500 rounded-r-full" />
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 text-purple-450 rounded-xl">
                <FiHome size={18} />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted}`}>PARCEIROS</span>
            </div>
            <h3 className={`text-2xl font-black font-space-grotesk tracking-tight ${t.text}`}>
              {stats.estabelecimentosAtivos}
            </h3>
            <p className={`text-[10px] mt-1 uppercase tracking-wider font-bold ${t.textSecondary}`}>Lojas Ativas</p>
            <div className="mt-3">
              <span className={`text-[9px] font-black uppercase tracking-wide bg-slate-950/40 border ${t.border} px-2 py-0.5 rounded-lg ${t.textMuted}`}>
                Total: {stats.totalEstabelecimentos} cadastradas
              </span>
            </div>
          </motion.div>

          {/* Card 4: Usuários */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`rounded-[2rem] p-6 border transition-all duration-300 relative overflow-hidden group ${t.cardBg} ${t.surfaceHover}`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-orange-400 to-red-500 rounded-r-full" />
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 text-orange-450 rounded-xl">
                <FiUsers size={18} />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted}`}>USUÁRIOS</span>
            </div>
            <h3 className={`text-2xl font-black font-space-grotesk tracking-tight ${t.text}`}>
              {stats.totalUsuarios}
            </h3>
            <p className={`text-[10px] mt-1 uppercase tracking-wider font-bold ${t.textSecondary}`}>Contas Criadas</p>
            <div className="mt-3">
              <span className={`text-[9px] font-black uppercase tracking-wide bg-slate-950/40 border ${t.border} px-2 py-0.5 rounded-lg ${t.textMuted}`}>
                Acesso unificado
              </span>
            </div>
          </motion.div>
        </div>

        {/* INTERACTIVE DATA VISUALS (Chart & Top Store) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Chart Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`lg:col-span-2 rounded-[2.5rem] p-6 border ${t.cardBg}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className={`text-sm font-black uppercase tracking-widest ${t.text}`}>Faturamento por Hora</h3>
                <p className={`text-[11px] font-bold ${t.textSecondary}`}>Distribuição consolidada do faturamento operacional</p>
              </div>
              <DateRangeFilter
                activePreset={datePreset}
                dateRange={dateRange}
                onPresetChange={handleDatePresetChange}
                onRangeChange={handleDateRangeChange}
                onClear={handleDateClear}
              />
            </div>

            <div className="h-64">
              {hourlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="chartStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#22d3ee" />
                        <stop offset="50%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#ec4899" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'} />
                    <XAxis
                      dataKey="hour"
                      stroke={theme === 'dark' ? '#475569' : '#94a3b8'}
                      fontSize={10}
                      fontWeight="bold"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke={theme === 'dark' ? '#475569' : '#94a3b8'}
                      fontSize={10}
                      fontWeight="bold"
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="url(#chartStroke)"
                      strokeWidth={3}
                      fill="url(#chartFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <span className="text-xl">📊</span>
                  <p className={`text-xs font-bold mt-2 ${t.textMuted}`}>Nenhum faturamento registrado no período selecionado.</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Top Store Award Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="p-[1.5px] bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 rounded-[2.5rem] flex relative overflow-hidden lg:col-span-1 animate-gradient-border"
          >
            <div className={`rounded-[2.4rem] p-6 flex flex-col justify-between flex-1 relative overflow-hidden ${t.surface}`}>
              {/* Decorative radial background */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-400/20 to-transparent rounded-full blur-2xl pointer-events-none" />

              <div className="relative space-y-4 flex flex-col h-full justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <FiAward className="text-yellow-500 animate-bounce" size={20} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-yellow-500">LÍDER DE VENDAS</span>
                  </div>
                  <span className="text-xs bg-yellow-550/10 text-yellow-500 border border-yellow-550/20 px-2 py-0.5 rounded-lg font-black">Top 1</span>
                </div>

                {(() => {
                  const ranking = financeiroFiltrado ? financeiroFiltrado.topLojas : financeiro.topLojas;
                  const topStore = ranking?.[0];

                  if (!topStore) {
                    return (
                      <div className="text-center py-8">
                        <p className={`text-xs font-bold ${t.textMuted}`}>Sem faturamento operacional.</p>
                      </div>
                    );
                  }

                  return (
                    <>
                      <div>
                        <h4 className={`text-lg font-black font-space-grotesk tracking-tight truncate ${t.text} mb-1`}>
                          {estabelecimentosMap[topStore.id] || topStore.nomeSalvoNoPedido || 'Loja Parceira'}
                        </h4>
                        <p className="text-3xl font-black font-space-grotesk text-yellow-500">
                          {formatCurrency(topStore.total)}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className={`flex items-center justify-between p-3 rounded-2xl border ${t.inputBg}`}>
                          <span className={`text-[10px] font-black uppercase tracking-wider ${t.textSecondary}`}>Pedidos</span>
                          <span className={`text-xs font-black ${t.text}`}>{topStore.pedidos}</span>
                        </div>
                        <div className={`flex items-center justify-between p-3 rounded-2xl border ${t.inputBg}`}>
                          <span className={`text-[10px] font-black uppercase tracking-wider ${t.textSecondary}`}>Ticket Médio</span>
                          <span className={`text-xs font-black ${t.text}`}>
                            {formatCurrency(topStore.total / topStore.pedidos)}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedLoja(topStore)}
                        className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:opacity-90 shadow-lg shadow-orange-500/20 transition-all active:scale-95"
                      >
                        Ver Ficha Completa
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>
          </motion.div>
        </div>

        {/* SYSTEM MODULES LIST GRID */}
        <div>
          <h2 className={`text-sm font-black uppercase tracking-widest ${t.text} mb-4`}>Módulos Administrativos</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredModules.map((category, idx) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + idx * 0.1 }}
                className={`rounded-[2.5rem] p-6 border ${t.cardBg}`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2.5 rounded-xl border ${category.colorClass}`}>
                    {category.icon}
                  </div>
                  <h3 className={`text-sm font-black uppercase tracking-wider ${t.text}`}>{category.title}</h3>
                </div>

                <div className="space-y-2">
                  {category.items.map((item, itemIdx) => (
                    <Link
                      key={itemIdx}
                      to={item.to}
                      className={`flex items-center gap-3.5 p-3 rounded-2xl border border-transparent transition-all group ${t.surfaceHover}`}
                    >
                      <div className={`p-2 rounded-xl border border-transparent group-hover:border-slate-800 transition-all ${t.inputBg}`}>
                        {React.cloneElement(item.icon, { className: `${category.tagColor} group-hover:scale-110 transition-transform` })}
                      </div>
                      <div className="flex-1">
                        <p className={`text-xs font-black group-hover:text-indigo-400 transition-colors ${t.text}`}>
                          {item.label}
                        </p>
                        <p className={`text-[10px] font-bold ${t.textMuted}`}>{item.desc}</p>
                      </div>
                      <FiChevronDown className={`${t.textMuted} group-hover:text-indigo-400 transition-all -rotate-90 group-hover:translate-x-1`} size={16} />
                    </Link>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          {filteredModules.length === 0 && (
            <div className="text-center py-12 bg-slate-900/10 rounded-3xl border border-dashed border-slate-850">
              <FiSearch className={`mx-auto mb-3 ${t.textMuted}`} size={42} />
              <p className={`text-sm font-black uppercase tracking-wider ${t.text}`}>Nenhum módulo localizado</p>
              <p className={`text-xs ${t.textSecondary}`}>Revise os termos digitados na busca.</p>
            </div>
          )}
        </div>

        {/* RANKING & QUICK CONTACTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ranking */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className={`rounded-[2.5rem] p-6 border ${t.cardBg}`}
          >
            <h3 className={`text-sm font-black uppercase tracking-widest ${t.text} mb-4`}>Faturamento das Lojas</h3>

            <div className="space-y-2">
              {(() => {
                const ranking = financeiroFiltrado ? financeiroFiltrado.topLojas : financeiro.topLojas;
                const stores = ranking?.slice(1, 6) || [];

                if (stores.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <FiActivity className={`mx-auto mb-2 ${t.textMuted}`} size={28} />
                      <p className={`text-xs font-bold ${t.textMuted}`}>Sem faturamento de outras lojas.</p>
                    </div>
                  );
                }

                const maxValue = Math.max(...stores.map(s => s.total), 1);

                return stores.map((store, idx) => (
                  <div
                    key={store.id}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${t.inputBg} ${t.surfaceHover}`}
                    onClick={() => setSelectedLoja(store)}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-black ${
                          idx === 0 ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-550/15' :
                          idx === 1 ? 'bg-slate-500/10 text-slate-400 border border-slate-700' :
                          'bg-indigo-500/10 text-indigo-400 border border-indigo-550/15'
                        }`}>
                          #{idx + 2}
                        </span>
                        <div>
                          <p className={`text-xs font-black truncate max-w-[150px] sm:max-w-xs ${t.text}`}>
                            {estabelecimentosMap[store.id] || store.nomeSalvoNoPedido || 'Loja'}
                          </p>
                          <p className={`text-[9px] font-bold ${t.textMuted}`}>{store.pedidos} pedidos realizados</p>
                        </div>
                      </div>
                      <p className="text-xs font-black text-indigo-400 font-space-grotesk">
                        {formatCurrency(store.total)}
                      </p>
                    </div>
                    {/* Glowing progress bar */}
                    <div className={`w-full h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-200'}`}>
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-indigo-550 rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(99,102,241,0.3)]"
                        style={{ width: `${(store.total / maxValue) * 100}%` }}
                      />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </motion.div>

          {/* Quick Contacts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
            className={`rounded-[2.5rem] p-6 border ${t.cardBg}`}
          >
            <h3 className={`text-sm font-black uppercase tracking-widest ${t.text} mb-4`}>Contatos de Parceiros</h3>

            <div className="space-y-2">
              {contatosEstabelecimentos.length === 0 ? (
                <div className="text-center py-8">
                  <FiPhone className={`mx-auto mb-2 ${t.textMuted}`} size={28} />
                  <p className={`text-xs font-bold ${t.textMuted}`}>Nenhum contato localizado.</p>
                </div>
              ) : (
                contatosEstabelecimentos.map((estab) => {
                  const phone = estab.telefone?.replace(/\D/g, '') || '';
                  const hasPhone = phone.length >= 10;
                  const whatsappNumber = hasPhone ? `55${phone}` : '';
                  const message = encodeURIComponent(`Olá ${estab.nome}! Tudo bem?`);

                  return (
                    <div
                      key={estab.id}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border ${t.inputBg}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-400/15 via-indigo-500/15 to-purple-600/15 border border-indigo-500/15 flex items-center justify-center text-indigo-400 font-space-grotesk font-black">
                          {estab.nome.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className={`text-xs font-black truncate max-w-[150px] sm:max-w-xs ${t.text}`}>{estab.nome}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {hasPhone ? (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className={`text-[9px] font-bold ${t.textMuted}`}>{estab.telefone}</span>
                              </>
                            ) : (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                <span className={`text-[9px] font-bold ${t.textMuted}`}>Sem número cadastrado</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {hasPhone ? (
                        <a
                          href={`https://wa.me/${whatsappNumber}?text=${message}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all active:scale-95 shadow-md shadow-emerald-700/10"
                        >
                          <FiMessageSquare size={14} />
                        </a>
                      ) : (
                        <div className={`p-3 rounded-xl ${t.border} border bg-slate-900/10`}>
                          <FiPhone className={t.textMuted} size={14} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>

        {/* ALERTS SYSTEM */}
        {(alertas.certVencidos.length > 0 || alertas.mensalidadeAtrasada.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-red-500/10 border border-red-500/20 rounded-[2.2rem] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg"
          >
            <div className="flex items-center gap-3">
              <FiAlertCircle className="text-red-500 shrink-0" size={24} />
              <div className="space-y-0.5">
                <h3 className={`text-xs font-black uppercase tracking-wider ${t.text}`}>Ação Administrativa Necessária</h3>
                <p className={`text-[10px] font-bold ${t.textSecondary}`}>
                  Detectamos {alertas.certVencidos.length + alertas.mensalidadeAtrasada.length} lojas com certificados vencidos ou débitos pendentes.
                </p>
              </div>
            </div>
            <Link
              to="/master/estabelecimentos"
              className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-colors"
            >
              Resolver Pendências
            </Link>
          </motion.div>
        )}
      </div>

      {/* STORE DETAIL SLIDE DRAWER (Tokyo Night style) */}
      <AnimatePresence>
        {selectedLoja && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
              onClick={() => setSelectedLoja(null)}
            />

            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className={`w-screen max-w-md border-l flex flex-col justify-between shadow-2xl relative overflow-hidden ${t.border} ${t.surface}`}
              >
                {/* Decorative blob */}
                <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-indigo-550/10 to-transparent rounded-full blur-2xl pointer-events-none" />

                {/* Header */}
                <div className={`p-6 border-b relative z-10 bg-slate-950/20 backdrop-blur-md ${t.border}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-sm font-black uppercase tracking-wider ${t.text}`}>
                      {estabelecimentosMap[selectedLoja.id] || selectedLoja.nomeSalvoNoPedido || 'Detalhes da Loja'}
                    </h3>
                    <button
                      onClick={() => setSelectedLoja(null)}
                      className={`p-2.5 rounded-xl border transition-all active:scale-95 ${t.border} ${t.surface}`}
                    >
                      <FiChevronDown className="rotate-270" size={18} />
                    </button>
                  </div>

                  {/* Summary values */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className={`p-3 rounded-2xl border ${t.inputBg}`}>
                      <span className={`block text-[9px] font-black uppercase tracking-wider ${t.textMuted} mb-1`}>Total Faturado</span>
                      <span className="text-md font-black text-indigo-400 font-space-grotesk">{formatCurrency(selectedLoja.total)}</span>
                    </div>
                    <div className={`p-3 rounded-2xl border ${t.inputBg}`}>
                      <span className={`block text-[9px] font-black uppercase tracking-wider ${t.textMuted} mb-1`}>Pedidos</span>
                      <span className={`text-md font-black ${t.text}`}>{selectedLoja.pedidos}</span>
                    </div>
                  </div>

                  {/* Splits: Delivery vs Salão */}
                  <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-dashed border-slate-700/50">
                    <div className={`p-3 rounded-2xl border ${theme === 'dark' ? 'bg-cyan-500/5 border-cyan-550/15' : 'bg-cyan-50 border-cyan-200'}`}>
                      <span className="block text-[9px] font-black uppercase tracking-wider text-cyan-400 mb-1">🏍️ Delivery</span>
                      <span className="block text-xs font-black text-cyan-300 font-space-grotesk">{formatCurrency(statsLoja.deliveryTotal)}</span>
                      <span className="text-[8px] font-bold text-slate-500">{statsLoja.deliveryQtd} pedidos</span>
                    </div>
                    <div className={`p-3 rounded-2xl border ${theme === 'dark' ? 'bg-purple-500/5 border-purple-550/15' : 'bg-purple-50 border-purple-200'}`}>
                      <span className="block text-[9px] font-black uppercase tracking-wider text-purple-400 mb-1">🍽️ Salão / PDV</span>
                      <span className="block text-xs font-black text-purple-300 font-space-grotesk">{formatCurrency(statsLoja.salaoTotal)}</span>
                      <span className="text-[8px] font-bold text-slate-500">{statsLoja.salaoQtd} vendas</span>
                    </div>
                  </div>
                </div>

                {/* Orders History inside Drawer */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3 relative z-10 no-scrollbar">
                  <h4 className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted} mb-2`}>Fila Operacional Recente</h4>

                  {selectedLoja.itens?.length > 0 ? (
                    <div className="space-y-2.5">
                      {[...selectedLoja.itens].reverse().map((venda, idx) => {
                        const total = Number(venda.totalFinal) || Number(venda.total) || Number(venda.valorFinal) || 0;
                        let dateStr = 'Data indisponível';

                        try {
                          let date = null;
                          if (venda.dataPedido?.toDate) date = venda.dataPedido.toDate();
                          else if (venda.createdAt?.toDate) date = venda.createdAt.toDate();
                          else if (venda.createdAt?.seconds) date = new Date(venda.createdAt.seconds * 1000);
                          else if (venda.dataPedido?.seconds) date = new Date(venda.dataPedido.seconds * 1000);

                          if (date) dateStr = format(date, "dd/MM/yyyy 'às' HH:mm");
                        } catch (e) { }

                        const isMesa = venda.tipo === 'mesa' || venda.source === 'salao' || !!venda.mesaNumero || !!venda.numeroMesa;
                        const isPedidoCol = venda._path && venda._path.includes('/pedidos/');
                        const isDelivery = isPedidoCol && !isMesa;

                        return (
                          <motion.div
                            key={venda.id || idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(idx * 0.04, 0.35) }}
                            className={`flex items-center justify-between p-3.5 rounded-2xl border ${t.inputBg} hover:border-indigo-500/20 transition-all`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className={`text-xs font-black ${t.text}`}>Transação #{idx + 1}</p>
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-lg text-[8px] font-black uppercase border ${
                                  isDelivery
                                    ? (theme === 'dark' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-550/15' : 'bg-cyan-50 text-cyan-600 border-cyan-200')
                                    : (theme === 'dark' ? 'bg-purple-500/10 text-purple-400 border-purple-550/15' : 'bg-purple-50 text-purple-600 border-purple-200')
                                }`}>
                                  {isDelivery ? 'Delivery' : 'Salão/PDV'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <FiClock className={t.textMuted} size={10} />
                                <p className={`text-[9px] font-bold ${t.textMuted}`}>{dateStr}</p>
                              </div>
                            </div>
                            <div className="text-right space-y-0.5">
                              <p className="text-xs font-black text-indigo-400 font-space-grotesk">{formatCurrency(total)}</p>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-lg text-[8px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-550/15 uppercase">
                                Pago
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 flex flex-col items-center justify-center text-center">
                      <FiAlertCircle className={`mb-2 ${t.textMuted}`} size={28} />
                      <p className={`text-xs font-bold ${t.textMuted}`}>Nenhum registro operacional.</p>
                    </div>
                  )}
                </div>

                {/* Footer close button */}
                <div className={`p-6 border-t bg-slate-950/20 backdrop-blur-md relative z-10 ${t.border}`}>
                  <button
                    onClick={() => setSelectedLoja(null)}
                    className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider hover:opacity-95 shadow-lg shadow-indigo-650/25 active:scale-95 transition-all"
                  >
                    Fechar Detalhes
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MasterDashboard;