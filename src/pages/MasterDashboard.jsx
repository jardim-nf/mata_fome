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
      icon: <FiPackage size={18} />,
      color: 'blue',
      items: [
        { to: '/master/estabelecimentos', label: 'Estabelecimentos', icon: <FiHome size={14} />, desc: 'Gerenciar lojas parceiras' },
        { to: '/master/clientes', label: 'Clientes', icon: <FiUsers size={14} />, desc: 'Base de clientes' },
        { to: '/master/pedidos', label: 'Pedidos', icon: <FiShoppingCart size={14} />, desc: 'Acompanhar entregas' },
      ]
    },
    {
      id: 'financial',
      title: 'Financeiro',
      icon: <FiDollarSign size={18} />,
      color: 'green',
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
      icon: <FiTrendingUp size={18} />,
      color: 'purple',
      items: [
        { to: '/master/plans', label: 'Planos', icon: <FiTag size={14} />, desc: 'Gerenciar assinaturas' },
        { to: '/master/cupons-rede', label: 'Cupons', icon: <FiZap size={14} />, desc: 'Campanhas promocionais' },
        { to: '/master/mensagens', label: 'Mensagens', icon: <FiMessageSquare size={14} />, desc: 'Comunicação via WhatsApp' },
      ]
    },
    {
      id: 'admin',
      title: 'Administração',
      icon: <FiSettings size={18} />,
      color: 'orange',
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

  const themeClasses = {
    dark: {
      bg: 'bg-gradient-to-br from-slate-950 via-[#0d1220] to-slate-950',
      surface: 'bg-slate-900/60 backdrop-blur-xl',
      surfaceHover: 'hover:bg-slate-800/80 hover:shadow-[0_8px_32px_rgba(99,102,241,0.06)] hover:scale-[1.01] hover:border-slate-700/50',
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
      surfaceHover: 'hover:bg-white hover:shadow-[0_8px_30px_rgba(99,102,241,0.02)] hover:scale-[1.01] hover:border-slate-300/50',
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

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className={`p-4 rounded-xl border backdrop-blur-md shadow-2xl ${
          theme === 'dark'
            ? 'bg-slate-950/85 border-slate-800/80 text-slate-100'
            : 'bg-white/85 border-slate-200/60 text-slate-900'
        }`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
            <p className="text-sm font-bold">{formatCurrency(payload[0].value)}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (authLoading) {
    return (
      <div className={`min-h-screen ${t.bg} flex items-center justify-center`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className={`text-sm font-medium ${t.textSecondary}`}>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${t.bg} transition-colors duration-500 relative overflow-hidden`}>
      {/* Style block for advanced custom animations */}
      <style>{`
        @keyframes rotate-gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient-border {
          background-size: 200% 200%;
          animation: rotate-gradient 5s ease infinite;
        }
      `}</style>

      {/* Glowing ambient light spheres with Framer Motion floating animation */}
      <motion.div
        animate={{
          x: [0, 30, -20, 0],
          y: [0, -40, 20, 0],
          scale: [1, 1.15, 0.95, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-[-10%] left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-blue-500/10 to-transparent blur-[140px] pointer-events-none"
      />
      <motion.div
        animate={{
          x: [0, -20, 30, 0],
          y: [0, 30, -30, 0],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{
          duration: 28,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-1/3 right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-purple-500/8 to-transparent blur-[120px] pointer-events-none"
      />
      <motion.div
        animate={{
          x: [0, 20, -10, 0],
          y: [0, 20, 10, 0],
          scale: [1, 1.05, 0.95, 1],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute bottom-[-10%] left-[-5%] w-[450px] h-[450px] rounded-full bg-gradient-to-tr from-emerald-500/5 to-transparent blur-[100px] pointer-events-none"
      />

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">

        {/* Header Glassmorphism Card */}
        <header className={`mb-8 p-6 rounded-3xl border backdrop-blur-md transition-all shadow-[0_8px_32px_rgba(0,0,0,0.01)] ${t.surface} ${t.border}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                {userName[0].toUpperCase()}
              </div>
              <div>
                <h1 className={`text-2xl font-bold ${t.text}`}>
                  {saudacao}, <span className="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">{userName}</span>
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <p className={`text-sm ${t.textSecondary}`}>
                    {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
                  </p>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-250/20'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Sistema Online
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`p-2.5 rounded-xl ${t.surface} ${t.border} border ${t.textSecondary} hover:${t.text} transition-all relative`}
                >
                  <FiBell size={18} />
                  {(alertas.certVencidos.length > 0 || alertas.mensalidadeAtrasada.length > 0) && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
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
                      className={`absolute right-0 mt-2 w-80 rounded-2xl border ${t.surface} ${t.border} p-4 shadow-2xl z-50`}
                    >
                      <h4 className={`text-sm font-semibold ${t.text} mb-3 pb-2 border-b ${t.border}`}>Alertas Administrativos</h4>
                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {alertas.certVencidos.length === 0 && alertas.mensalidadeAtrasada.length === 0 ? (
                          <p className={`text-xs text-center py-4 ${t.textMuted}`}>Nenhum alerta pendente</p>
                        ) : (
                          <>
                            {alertas.certVencidos.map((estab) => (
                              <div key={estab.id} className="flex gap-2 p-2.5 rounded-xl bg-red-500/5 border border-red-500/10 text-xs">
                                <FiAlertCircle className="text-red-500 shrink-0 mt-0.5" size={14} />
                                <div className="flex-1">
                                  <p className={`font-semibold ${t.text}`}>{estab.nome}</p>
                                  <p className="text-red-400 mt-0.5">Certificado vencido ou próximo do vencimento</p>
                                </div>
                              </div>
                            ))}
                            {alertas.mensalidadeAtrasada.map((estab) => (
                              <div key={estab.id} className="flex gap-2 p-2.5 rounded-xl bg-orange-500/5 border border-orange-500/10 text-xs">
                                <FiAlertCircle className="text-orange-500 shrink-0 mt-0.5" size={14} />
                                <div className="flex-1">
                                  <p className={`font-semibold ${t.text}`}>{estab.nome}</p>
                                  <p className="text-orange-400 mt-0.5">Mensalidade em atraso</p>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                      <Link
                        to="/master/estabelecimentos"
                        onClick={() => setShowNotifications(false)}
                        className={`block text-center text-xs font-semibold text-blue-500 hover:text-blue-600 mt-3 pt-2 border-t ${t.border}`}
                      >
                        Gerenciar Estabelecimentos
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={toggleTheme}
                className={`p-2.5 rounded-xl ${t.surface} ${t.border} border ${t.textSecondary} hover:${t.text} transition-all`}
              >
                {theme === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
              </button>

              <button
                onClick={async () => { await logout(); navigate('/'); }}
                className={`p-2.5 rounded-xl ${t.surface} ${t.border} border text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all`}
              >
                <FiLogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Search Bar */}
        <div className="mb-6">
          <div className={`flex items-center ${t.inputBg} rounded-2xl px-4 py-3 border ${t.border} focus-within:border-blue-500 transition-all shadow-sm focus-within:shadow-[0_0_20px_rgba(59,130,246,0.1)]`}>
            <FiSearch className={t.textSecondary} size={18} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar módulos, funcionalidades..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`bg-transparent border-none outline-none ml-3 flex-1 text-sm placeholder-gray-400 ${t.text}`}
            />
            <div className={`hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold select-none ${
              theme === 'dark' ? 'border-slate-800 bg-slate-900/60 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-500'
            }`}>
              <span>Ctrl</span>
              <span>+</span>
              <span>K</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${t.cardBg} rounded-2xl p-6 border ${t.border} hover:border-blue-500/40 hover:shadow-[0_0_30px_rgba(59,130,246,0.12)] hover:scale-[1.01] transition-all duration-300 cursor-pointer relative overflow-hidden`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-r-full" />
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <FiDollarSign className="text-blue-500" size={20} />
              </div>
              <span className={`text-xs font-semibold ${t.textMuted}`}>Hoje</span>
            </div>
            <h3 className={`text-2xl font-bold ${t.text} mb-1`}>
              {formatCurrency(financeiroFiltrado ? financeiroFiltrado.faturamento : financeiro.faturamentoHoje)}
            </h3>
            <p className={`text-sm ${t.textSecondary}`}>Faturamento Total</p>
            {!financeiroFiltrado && (
              <div className={`flex items-center gap-2 mt-2 ${crescimento >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {crescimento >= 0 ? <FiTrendingUp size={14} /> : <FiChevronDown size={14} />}
                <span className="text-xs font-semibold">{Math.abs(crescimento).toFixed(1)}% vs ontem</span>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`${t.cardBg} rounded-2xl p-6 border ${t.border} hover:border-emerald-500/40 hover:shadow-[0_0_30px_rgba(16,185,129,0.12)] hover:scale-[1.01] transition-all duration-300 cursor-pointer relative overflow-hidden`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-500 to-teal-600 rounded-r-full" />
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-500/10 rounded-xl">
                <FiShoppingCart className="text-emerald-500" size={20} />
              </div>
            </div>
            <h3 className={`text-2xl font-bold ${t.text} mb-1`}>
              {financeiroFiltrado ? financeiroFiltrado.qtd : financeiro.qtdHoje}
            </h3>
            <p className={`text-sm ${t.textSecondary}`}>Pedidos Realizados</p>
            <div className="mt-2">
              <span className={`text-xs ${t.textMuted}`}>
                Ticket Médio: {formatCurrency(financeiroFiltrado ? financeiroFiltrado.ticketMedio : ticketMedio)}
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`${t.cardBg} rounded-2xl p-6 border ${t.border} hover:border-purple-500/40 hover:shadow-[0_0_30px_rgba(139,92,246,0.12)] hover:scale-[1.01] transition-all duration-300 cursor-pointer relative overflow-hidden`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 to-violet-600 rounded-r-full" />
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-500/10 rounded-xl">
                <FiHome className="text-purple-500" size={20} />
              </div>
            </div>
            <h3 className={`text-2xl font-bold ${t.text} mb-1`}>
              {stats.estabelecimentosAtivos}
            </h3>
            <p className={`text-sm ${t.textSecondary}`}>Lojas Ativas</p>
            <div className="mt-2">
              <span className={`text-xs ${t.textMuted}`}>
                Total: {stats.totalEstabelecimentos} lojas
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`${t.cardBg} rounded-2xl p-6 border ${t.border} hover:border-orange-500/40 hover:shadow-[0_0_30px_rgba(249,115,22,0.12)] hover:scale-[1.01] transition-all duration-300 cursor-pointer relative overflow-hidden`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-500 to-amber-600 rounded-r-full" />
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-500/10 rounded-xl">
                <FiUsers className="text-orange-500" size={20} />
              </div>
            </div>
            <h3 className={`text-2xl font-bold ${t.text} mb-1`}>
              {stats.totalUsuarios}
            </h3>
            <p className={`text-sm ${t.textSecondary}`}>Usuários Totais</p>
          </motion.div>
        </div>

        {/* Charts & Top Store */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`lg:col-span-2 ${t.cardBg} rounded-2xl p-6 border ${t.border}`}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className={`text-lg font-semibold ${t.text}`}>Faturamento por Hora</h3>
                <p className={`text-sm ${t.textSecondary}`}>Distribuição ao longo do dia</p>
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
                  <AreaChart data={hourlyData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#3B82F6" />
                        <stop offset="100%" stopColor="#6366F1" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
                    <XAxis
                      dataKey="hour"
                      stroke={theme === 'dark' ? '#6B7280' : '#9CA3AF'}
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke={theme === 'dark' ? '#6B7280' : '#9CA3AF'}
                      fontSize={11}
                      tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="url(#colorStroke)"
                      strokeWidth={3}
                      fill="url(#colorValue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className={`text-sm ${t.textMuted}`}>Sem dados disponíveis para o período</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Top Store Card with Glowing Border */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="p-[1.5px] bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-600 rounded-2xl flex relative overflow-hidden lg:col-span-1 animate-gradient-border"
          >
            <div className={`rounded-[15px] p-6 flex flex-col justify-between flex-1 relative overflow-hidden ${t.surface}`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-400/20 to-transparent rounded-full blur-3xl pointer-events-none" />

              <div className="relative">
                <div className="flex items-center gap-2 mb-4">
                  <FiAward className="text-yellow-500 animate-pulse" size={20} />
                  <span className={`text-sm font-semibold ${t.text}`}>Top 1 Loja</span>
                </div>

              {(() => {
                const ranking = financeiroFiltrado ? financeiroFiltrado.topLojas : financeiro.topLojas;
                const topStore = ranking?.[0];

                if (!topStore) {
                  return (
                    <div className="text-center py-8">
                      <p className={`text-sm ${t.textMuted}`}>Nenhum dado disponível</p>
                    </div>
                  );
                }

                return (
                  <>
                    <h4 className={`text-xl font-bold ${t.text} mb-2`}>
                      {estabelecimentosMap[topStore.id] || topStore.nomeSalvoNoPedido || 'Loja'}
                    </h4>
                    <p className="text-2xl font-bold text-yellow-500 mb-4">
                      {formatCurrency(topStore.total)}
                    </p>

                    <div className="space-y-3">
                      <div className={`flex items-center justify-between p-3 rounded-xl ${t.inputBg} border ${t.border}`}>
                        <span className={`text-sm ${t.textSecondary}`}>Pedidos</span>
                        <span className={`text-sm font-semibold ${t.text}`}>{topStore.pedidos}</span>
                      </div>
                      <div className={`flex items-center justify-between p-3 rounded-xl ${t.inputBg} border ${t.border}`}>
                        <span className={`text-sm ${t.textSecondary}`}>Ticket Médio</span>
                        <span className={`text-sm font-semibold ${t.text}`}>
                          {formatCurrency(topStore.total / topStore.pedidos)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedLoja(topStore)}
                      className="w-full mt-4 px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-semibold text-sm hover:opacity-90 shadow-md hover:shadow-lg transition-all"
                    >
                      Ver Detalhes
                    </button>
                  </>
                );
              })()}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Modules Grid */}
        <div className="mb-8">
          <h2 className={`text-xl font-bold ${t.text} mb-6`}>Módulos do Sistema</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredModules.map((category, idx) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + idx * 0.1 }}
                className={`${t.cardBg} rounded-2xl p-6 border ${t.border}`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-xl bg-${category.color}-500/10 text-${category.color}-500`}>
                    {category.icon}
                  </div>
                  <h3 className={`text-lg font-semibold ${t.text}`}>{category.title}</h3>
                </div>

                <div className="space-y-3">
                  {category.items.map((item, itemIdx) => (
                    <Link
                      key={itemIdx}
                      to={item.to}
                      className={`flex items-center gap-3 p-3 rounded-xl ${t.surfaceHover} transition-all group border border-transparent hover:${t.border}`}
                    >
                      <div className={`p-2 rounded-lg ${t.inputBg}`}>
                        {item.icon}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${t.text} group-hover:text-blue-500 transition-colors`}>
                          {item.label}
                        </p>
                        <p className={`text-xs ${t.textMuted}`}>{item.desc}</p>
                      </div>
                      <FiChevronDown className={`${t.textMuted} group-hover:text-blue-500 transition-colors -rotate-90`} size={16} />
                    </Link>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          {filteredModules.length === 0 && (
            <div className="text-center py-12">
              <FiSearch className={`mx-auto mb-4 ${t.textMuted}`} size={48} />
              <p className={`text-lg font-medium ${t.text}`}>Nenhum módulo encontrado</p>
              <p className={`text-sm ${t.textSecondary}`}>Tente buscar por outro termo</p>
            </div>
          )}
        </div>

        {/* Ranking & Contacts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Ranking */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className={`${t.cardBg} rounded-2xl p-6 border ${t.border}`}
          >
            <h3 className={`text-lg font-semibold ${t.text} mb-4`}>Ranking de Lojas</h3>

            <div className="space-y-3">
              {(() => {
                const ranking = financeiroFiltrado ? financeiroFiltrado.topLojas : financeiro.topLojas;
                const stores = ranking?.slice(1, 6) || [];

                if (stores.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <FiActivity className={`mx-auto mb-2 ${t.textMuted}`} size={32} />
                      <p className={`text-sm ${t.textMuted}`}>Sem dados de faturamento</p>
                    </div>
                  );
                }

                const maxValue = Math.max(...stores.map(s => s.total), 1);

                return stores.map((store, idx) => (
                  <div
                    key={store.id}
                    className={`p-4 rounded-xl ${t.inputBg} border ${t.border} ${t.surfaceHover} transition-all cursor-pointer`}
                    onClick={() => setSelectedLoja(store)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${idx === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                            idx === 1 ? 'bg-gray-400/20 text-gray-400' :
                              'bg-blue-500/20 text-blue-500'
                          }`}>
                          #{idx + 2}
                        </span>
                        <div>
                          <p className={`text-sm font-medium ${t.text}`}>
                            {estabelecimentosMap[store.id] || store.nomeSalvoNoPedido || 'Loja'}
                          </p>
                          <p className={`text-xs ${t.textMuted}`}>{store.pedidos} pedidos</p>
                        </div>
                      </div>
                      <p className={`text-sm font-bold text-blue-500`}>
                        {formatCurrency(store.total)}
                      </p>
                    </div>
                    <div className={`w-full h-1.5 rounded-full ${t.inputBg} overflow-hidden`}>
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500"
                        style={{ width: `${(store.total / maxValue) * 100}%` }}
                      />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </motion.div>

          {/* Contacts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            className={`${t.cardBg} rounded-2xl p-6 border ${t.border}`}
          >
            <h3 className={`text-lg font-semibold ${t.text} mb-4`}>Contatos Rápidos</h3>

            <div className="space-y-3">
              {contatosEstabelecimentos.length === 0 ? (
                <div className="text-center py-8">
                  <FiPhone className={`mx-auto mb-2 ${t.textMuted}`} size={32} />
                  <p className={`text-sm ${t.textMuted}`}>Nenhum contato disponível</p>
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
                      className={`flex items-center justify-between p-4 rounded-xl ${t.inputBg} border ${t.border}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold`}>
                          {estab.nome.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${t.text}`}>{estab.nome}</p>
                          <p className={`text-xs ${t.textMuted}`}>
                            {hasPhone ? estab.telefone : 'Sem telefone'}
                          </p>
                        </div>
                      </div>

                      {hasPhone ? (
                        <a
                          href={`https://wa.me/${whatsappNumber}?text=${message}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
                        >
                          <FiMessageSquare size={16} />
                        </a>
                      ) : (
                        <div className={`p-2.5 rounded-xl ${t.inputBg} border ${t.border}`}>
                          <FiPhone className={t.textMuted} size={16} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>

        {/* Alerts Section */}
        {(alertas.certVencidos.length > 0 || alertas.mensalidadeAtrasada.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 bg-red-500/10 border border-red-500/20 rounded-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FiAlertCircle className="text-red-500" size={24} />
                <div>
                  <h3 className={`text-lg font-semibold ${t.text}`}>Atenção Necessária</h3>
                  <p className={`text-sm ${t.textSecondary}`}>
                    {alertas.certVencidos.length + alertas.mensalidadeAtrasada.length} estabelecimentos com pendências
                  </p>
                </div>
              </div>
              <Link
                to="/master/estabelecimentos"
                className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors"
              >
                Resolver
              </Link>
            </div>
          </motion.div>
        )}
      </div>

      {/* Store Details Drawer */}
      <AnimatePresence>
        {selectedLoja && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
              onClick={() => setSelectedLoja(null)}
            />

            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className={`w-screen max-w-md border-l ${t.border} ${t.surface} backdrop-blur-2xl flex flex-col justify-between shadow-2xl relative overflow-hidden`}
              >
                <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />

                {/* Header */}
                <div className={`p-6 border-b ${t.border} relative z-10 bg-slate-950/10`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-xl font-bold ${t.text}`}>
                      {estabelecimentosMap[selectedLoja.id] || selectedLoja.nomeSalvoNoPedido || 'Loja'}
                    </h3>
                    <button
                      onClick={() => setSelectedLoja(null)}
                      className={`p-2.5 rounded-xl hover:${t.inputBg} ${t.border} border ${t.textSecondary} hover:${t.text} transition-colors`}
                    >
                      <FiChevronDown className="rotate-270" size={20} />
                    </button>
                  </div>

                  {/* Quick Info Badges */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className={`p-3 rounded-xl ${t.inputBg} border ${t.border}`}>
                      <span className={`block text-xs ${t.textMuted} mb-1`}>Total Faturado</span>
                      <span className="text-lg font-bold text-blue-500">{formatCurrency(selectedLoja.total)}</span>
                    </div>
                    <div className={`p-3 rounded-xl ${t.inputBg} border ${t.border}`}>
                      <span className={`block text-xs ${t.textMuted} mb-1`}>Pedidos</span>
                      <span className={`text-lg font-bold ${t.text}`}>{selectedLoja.pedidos}</span>
                    </div>
                  </div>

                  {/* Breakdown Delivery vs Salão */}
                  <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-dashed border-slate-700/50">
                    <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-blue-500/5 border-blue-500/10' : 'bg-blue-50/50 border-blue-100'} border`}>
                      <span className={`block text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} mb-1`}>🏍️ Delivery</span>
                      <span className={`block text-sm font-bold ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>{formatCurrency(statsLoja.deliveryTotal)}</span>
                      <span className={`text-[10px] ${t.textSecondary}`}>{statsLoja.deliveryQtd} pedidos</span>
                    </div>
                    <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-purple-500/5 border-purple-500/10' : 'bg-purple-50/50 border-purple-100'} border`}>
                      <span className={`block text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'} mb-1`}>🍽️ Salão / PDV</span>
                      <span className={`block text-sm font-bold ${theme === 'dark' ? 'text-purple-300' : 'text-purple-700'}`}>{formatCurrency(statsLoja.salaoTotal)}</span>
                      <span className={`text-[10px] ${t.textSecondary}`}>{statsLoja.salaoQtd} vendas</span>
                    </div>
                  </div>
                </div>

                {/* Sales List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3 relative z-10">
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${t.textSecondary} mb-3`}>Histórico de Pedidos</h4>

                  {selectedLoja.itens?.length > 0 ? (
                    <div className="space-y-3">
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
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(idx * 0.04, 0.35) }}
                            className={`flex items-center justify-between p-4 rounded-xl ${t.inputBg} border ${t.border} hover:border-blue-500/25 transition-colors`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <p className={`text-sm font-semibold ${t.text}`}>Pedido #{idx + 1}</p>
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                                  isDelivery
                                    ? (theme === 'dark' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200')
                                    : (theme === 'dark' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-purple-50 text-purple-600 border-purple-200')
                                }`}>
                                  {isDelivery ? 'Delivery' : 'Salão/PDV'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <FiClock className={t.textMuted} size={12} />
                                <p className={`text-xs ${t.textMuted}`}>{dateStr}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-sm font-bold text-blue-500`}>{formatCurrency(total)}</p>
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-1">
                                Sucesso
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 flex flex-col items-center justify-center text-center">
                      <FiAlertCircle className={`mb-2 ${t.textMuted}`} size={32} />
                      <p className={`text-sm ${t.textMuted}`}>Nenhum pedido registrado.</p>
                    </div>
                  )}
                </div>

                {/* Footer Button */}
                <div className={`p-6 border-t ${t.border} bg-slate-950/20 backdrop-blur-md relative z-10`}>
                  <button
                    onClick={() => setSelectedLoja(null)}
                    className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold text-sm hover:opacity-95 transition-opacity shadow-lg"
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