import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiArrowLeft, FiSun, FiMoon, FiLogOut, FiDollarSign, FiShoppingCart, 
  FiTrendingUp, FiLayers, FiActivity, FiPieChart, FiBarChart2, FiHome
} from 'react-icons/fi';
import DateRangeFilter, { getPresetRange } from '../../components/DateRangeFilter';
import { useMasterAnalyticsData } from '../../hooks/useMasterAnalyticsData';
import { useAuth } from '../../context/AuthContext';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement, Filler } from 'chart.js';
import { Line, Pie, Bar } from 'react-chartjs-2';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement, Filler);

function MasterAnalytics() {
  const navigate = useNavigate();
  const { isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  const [datePreset, setDatePreset] = useState('30d');
  const [dateRange, setDateRange] = useState(getPresetRange('30d') || { start: null, end: null });

  const { metrics, loading, pedidos, vendas, estabelecimentos } = useMasterAnalyticsData(dateRange, datePreset);

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

  const handleDateClear = () => {
    setDatePreset(null);
    setDateRange({ start: null, end: null });
  };

  // Cores dinâmicas para os gráficos
  const chartColors = useMemo(() => {
    if (isDark) {
      return {
        lineStroke: '#6366f1',
        lineFill: 'rgba(99, 102, 241, 0.08)',
        barColor: '#3b82f6',
        pieColors: ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6']
      };
    } else {
      return {
        lineStroke: '#4f46e5',
        lineFill: 'rgba(79, 70, 229, 0.06)',
        barColor: '#2563eb',
        pieColors: ['#4f46e5', '#2563eb', '#16a34a', '#d97706', '#dc2626', '#db2777', '#7c3aed']
      };
    }
  }, [isDark]);

  // Opções dinâmicas de gráficos baseadas no tema
  const lineOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        titleColor: isDark ? '#f8fafc' : '#0f172a',
        bodyColor: isDark ? '#cbd5e1' : '#334155',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        borderWidth: 1,
        titleFont: { family: 'Inter', weight: 'bold' },
        bodyFont: { family: 'Inter' },
        callbacks: { label: (ctx) => ` Faturamento: R$ ${ctx.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { family: 'Inter', size: 11 }, color: isDark ? '#94a3b8' : '#64748b' }
      },
      y: {
        border: { display: false },
        grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
        ticks: {
          font: { family: 'Inter', size: 11 },
          color: isDark ? '#94a3b8' : '#64748b',
          callback: (v) => `R$ ${Number(v).toLocaleString('pt-BR', { notation: 'compact', compactDisplay: 'short' })}`
        }
      }
    }
  }), [isDark]);

  const barOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        titleColor: isDark ? '#f8fafc' : '#0f172a',
        bodyColor: isDark ? '#cbd5e1' : '#334155',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        borderWidth: 1,
        titleFont: { family: 'Inter', weight: 'bold' },
        bodyFont: { family: 'Inter' },
        callbacks: { label: (ctx) => ` Faturamento: R$ ${ctx.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { family: 'Inter', size: 11 }, color: isDark ? '#94a3b8' : '#64748b' }
      },
      y: {
        border: { display: false },
        grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
        ticks: {
          font: { family: 'Inter', size: 11 },
          color: isDark ? '#94a3b8' : '#64748b',
          callback: (v) => `R$ ${Number(v).toLocaleString('pt-BR', { notation: 'compact', compactDisplay: 'short' })}`
        }
      }
    }
  }), [isDark]);

  const pieOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          usePointStyle: true,
          font: { family: 'Inter', size: 11, weight: 'bold' },
          color: isDark ? '#f1f5f9' : '#0f172a',
          padding: 15
        }
      },
      tooltip: {
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        titleColor: isDark ? '#f8fafc' : '#0f172a',
        bodyColor: isDark ? '#cbd5e1' : '#334155',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        borderWidth: 1,
        callbacks: { label: (ctx) => ` ${ctx.label}: R$ ${ctx.parsed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` }
      }
    }
  }), [isDark]);

  // Cálculos de métricas adicionais (Delivery vs PDV e Ticket Médio)
  const extraStats = useMemo(() => {
    if (!pedidos || !vendas) return { deliveryTotal: 0, deliveryCount: 0, pdvTotal: 0, pdvCount: 0, ticketMedio: 0 };
    
    const getTotal = (item) => Number(item.totalFinal) || Number(item.total) || Number(item.valorFinal) || Number(item.valorTotal) || 0;
    
    let deliveryTotal = 0;
    let deliveryCount = 0;
    pedidos.forEach(p => {
      deliveryTotal += getTotal(p);
      deliveryCount++;
    });

    let pdvTotal = 0;
    let pdvCount = 0;
    vendas.forEach(v => {
      pdvTotal += getTotal(v);
      pdvCount++;
    });

    const totalFaturamento = deliveryTotal + pdvTotal;
    const totalTransacoes = deliveryCount + pdvCount;
    const ticketMedio = totalTransacoes > 0 ? totalFaturamento / totalTransacoes : 0;

    return {
      deliveryTotal,
      deliveryCount,
      pdvTotal,
      pdvCount,
      ticketMedio
    };
  }, [pedidos, vendas]);

  // Construção detalhada da lista de unidades (Lojas)
  const listaLojasDetalhadas = useMemo(() => {
    if (!pedidos || !vendas || !estabelecimentos) return [];
    
    const rawStore = {};
    const getTotal = (item) => Number(item.totalFinal) || Number(item.total) || Number(item.valorFinal) || Number(item.valorTotal) || 0;
    const getEstabId = (item) => {
      if (item.estabelecimentoId) return item.estabelecimentoId;
      if (item.estabelecimento_id) return item.estabelecimento_id;
      if (item._path) {
        const parts = item._path.split('/');
        const idx = parts.indexOf('estabelecimentos');
        if (idx >= 0 && parts.length > idx + 1) return parts[idx+1];
      }
      return 'desconhecido';
    };

    [...pedidos, ...vendas].forEach(item => {
      const eId = getEstabId(item);
      const valor = getTotal(item);
      if (!rawStore[eId]) {
        rawStore[eId] = { id: eId, nome: estabelecimentos[eId] || `Loja ${eId.slice(0, 4)}`, faturamento: 0, transacoes: 0 };
      }
      rawStore[eId].faturamento += valor;
      rawStore[eId].transacoes += 1;
    });

    return Object.values(rawStore)
      .map(store => ({
        ...store,
        ticketMedio: store.transacoes > 0 ? store.faturamento / store.transacoes : 0
      }))
      .sort((a, b) => b.faturamento - a.faturamento);
  }, [pedidos, vendas, estabelecimentos]);

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
          <FiHome size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className={`text-xl font-bold ${t.text} mb-2`}>Acesso Negado</h2>
          <p className={`text-sm ${t.textSecondary} mb-4`}>Esta área é restrita para administradores master do sistema.</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">Ir para Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${t.bg} transition-colors duration-500 relative overflow-hidden pb-24 pt-4 px-4 sm:px-8`}>
      
      {/* Luzes neon decorativas no fundo */}
      <div className="absolute top-[-10%] left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-blue-500/10 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-purple-500/8 to-transparent blur-[120px] pointer-events-none" />

      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className={`max-w-[1400px] mx-auto backdrop-blur-xl border shadow-lg rounded-3xl h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all ${t.surface} ${t.border}`}>
        <div className="flex items-center gap-4">
          <button id="btn-back-master-dashboard" onClick={() => navigate('/master-dashboard')} className={`w-9 h-9 ${t.inputBg} hover:opacity-85 rounded-xl flex items-center justify-center transition-all`}>
            <FiArrowLeft className={`${t.text} text-sm`} />
          </button>
          <div className="hidden sm:block border-l border-slate-700/50 pl-4">
            <span className={`font-bold text-sm tracking-tight ${t.text}`}>Hub de Analytics</span>
            <p className={`text-[10px] ${t.textSecondary} font-semibold`}>{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            id="btn-toggle-theme"
            onClick={toggleTheme}
            className={`p-2.5 rounded-xl border ${t.inputBg} ${t.border} ${t.textSecondary} hover:${t.text} transition-all`}
            title="Alternar Tema"
          >
            {isDark ? <FiSun size={15} /> : <FiMoon size={15} />}
          </button>
          
          <div className="w-px h-6 bg-slate-700/50 hidden sm:block" />
          
          <button id="btn-logout" onClick={async () => { await logout(); navigate('/'); }} className="w-9 h-9 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl flex items-center justify-center transition-all" title="Sair">
            <FiLogOut className="text-red-400" size={15} />
          </button>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto mt-8 relative z-10">
        
        {/* ─── HEADER & FILTER ─── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6 px-2 relative z-30">
          <div>
            <h1 id="page-analytics-title" className={`text-4xl font-extrabold tracking-tight ${t.text}`}>Inteligência em Dados</h1>
            <p className={`${t.textSecondary} text-sm mt-1 font-semibold`}>Extração de volumetria de vendas e projeção de faturamento da rede.</p>
          </div>
          
          <div className={`p-2 rounded-2xl border shadow-sm flex items-center relative z-40 ${t.cardBg} ${t.border}`}>
            <DateRangeFilter 
                activePreset={datePreset} 
                dateRange={dateRange} 
                onPresetChange={setDatePreset} 
                onRangeChange={setDateRange} 
                onClear={handleDateClear}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-32">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-8">
              
              {/* ─── STATS BENTO GRID ─── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                
                {/* GMV total */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`${t.cardBg} rounded-[2rem] border ${t.border} p-8 shadow-sm flex flex-col justify-between hover:border-indigo-500/40 transition-all duration-300 relative overflow-hidden`}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r-full" />
                  <div className="flex justify-between items-start mb-6">
                     <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400"><FiDollarSign size={22} /></div>
                     <p className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                       isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-750'
                     }`}>Volume Rede</p>
                  </div>
                  <div>
                     <p className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider mb-1`}>Volume de Faturamento (GMV)</p>
                     <p className={`text-3xl font-black tracking-tight ${t.text}`}>R$ {fmt(metrics.faturamentoTotal)}</p>
                  </div>
                </motion.div>

                {/* Transações */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className={`${t.cardBg} rounded-[2rem] border ${t.border} p-8 shadow-sm flex flex-col justify-between hover:border-blue-500/40 transition-all duration-300 relative overflow-hidden`}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full" />
                  <div className="flex justify-between items-start mb-6">
                     <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400"><FiShoppingCart size={22} /></div>
                     <p className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                       isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-750'
                     }`}>Pedidos</p>
                  </div>
                  <div>
                     <p className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider mb-1`}>Transações Concluídas</p>
                     <p className={`text-3xl font-black tracking-tight ${t.text}`}>{metrics.qtdTransacoes}</p>
                  </div>
                </motion.div>

                {/* Ticket Médio */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={`${t.cardBg} rounded-[2rem] border ${t.border} p-8 shadow-sm flex flex-col justify-between hover:border-teal-500/40 transition-all duration-300 relative overflow-hidden`}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-500 rounded-r-full" />
                  <div className="flex justify-between items-start mb-6">
                     <div className="w-14 h-14 bg-teal-500/10 rounded-2xl flex items-center justify-center text-teal-400"><FiTrendingUp size={22} /></div>
                     <p className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                       isDark ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-50 text-teal-750'
                     }`}>Ticket Médio</p>
                  </div>
                  <div>
                     <p className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider mb-1`}>Ticket Médio da Rede</p>
                     <p className={`text-3xl font-black tracking-tight ${t.text}`}>R$ {fmt(extraStats.ticketMedio)}</p>
                  </div>
                </motion.div>

                {/* Canais */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className={`${t.cardBg} rounded-[2rem] border ${t.border} p-8 shadow-sm flex flex-col justify-between hover:border-amber-500/40 transition-all duration-300 relative overflow-hidden`}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-r-full" />
                  <div className="flex justify-between items-start mb-6">
                     <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-400"><FiLayers size={22} /></div>
                     <p className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                       isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-750'
                     }`}>Canais</p>
                  </div>
                  <div>
                     <div className={`flex justify-between items-center text-[10px] font-bold uppercase tracking-wider ${t.textMuted} mb-1.5`}>
                       <span>🏍️ Delivery</span>
                       <span>🍽️ Balcão/PDV</span>
                     </div>
                     <div className="flex justify-between items-baseline font-black tracking-tight">
                       <span className={`text-base ${t.text}`}>R$ {fmt(extraStats.deliveryTotal)}</span>
                       <span className={`text-base ${t.text}`}>R$ {fmt(extraStats.pdvTotal)}</span>
                     </div>
                  </div>
                </motion.div>
              </div>

              {/* ─── CHARTS BENTO GRID ─── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                  
                  {/* Evolução de Faturamento */}
                  <div className={`${t.cardBg} border ${t.border} p-8 rounded-[2rem] shadow-sm lg:col-span-2 flex flex-col justify-between`}>
                      <div className="mb-6">
                          <h3 className={`text-lg font-bold ${t.text} flex items-center gap-2`}>
                              <FiActivity size={18} className="text-indigo-400" /> Evolução de Fluxo (Gross GMV)
                          </h3>
                          <p className={`text-xs ${t.textSecondary} mt-0.5`}>Histórico de vendas consolidadas no período selecionado.</p>
                      </div>
                      <div className="h-[300px] w-full">
                          {metrics.evolucao.labels.length > 0 ? (
                              <Line 
                                  data={{ 
                                      labels: metrics.evolucao.labels, 
                                      datasets: [{ 
                                          label: 'Faturamento R$', 
                                          data: metrics.evolucao.data, 
                                          borderColor: chartColors.lineStroke, 
                                          backgroundColor: chartColors.lineFill, 
                                          fill: true,
                                          tension: 0.4,
                                          pointBackgroundColor: chartColors.lineStroke,
                                          pointBorderColor: isDark ? '#0f172a' : '#fff',
                                          pointBorderWidth: 2,
                                          pointRadius: 4,
                                          pointHoverRadius: 6
                                      }] 
                                  }} 
                                  options={lineOptions} 
                              />
                          ) : (
                              <div className={`h-full flex items-center justify-center font-semibold ${t.textSecondary} ${t.inputBg} rounded-[1.5rem]`}>Sem dados no período</div>
                          )}
                      </div>
                  </div>

                  {/* Participação de Mercado */}
                  <div className={`${t.cardBg} border ${t.border} p-8 rounded-[2rem] shadow-sm flex flex-col justify-between`}>
                      <div className="mb-6">
                          <h3 className={`text-lg font-bold ${t.text} flex items-center gap-2`}>
                              <FiPieChart size={18} className="text-pink-400" /> Share de Mercado (GMV)
                          </h3>
                          <p className={`text-xs ${t.textSecondary} mt-0.5`}>Distribuição de faturamento entre as franquias da rede.</p>
                      </div>
                      <div className="h-[300px] w-full flex items-center justify-center">
                          {metrics.participacao.labels.length > 0 ? (
                              <Pie 
                                  data={{ 
                                      labels: metrics.participacao.labels, 
                                      datasets: [{ 
                                          data: metrics.participacao.data, 
                                          backgroundColor: chartColors.pieColors,
                                          borderWidth: isDark ? 2 : 1,
                                          borderColor: isDark ? '#1e293b' : '#ffffff'
                                      }] 
                                  }} 
                                  options={pieOptions} 
                              />
                          ) : (
                              <div className={`h-full w-full flex items-center justify-center font-semibold ${t.textSecondary} ${t.inputBg} rounded-[1.5rem]`}>Sem dados de participação</div>
                          )}
                      </div>
                  </div>

                  {/* Ranking de Franquias */}
                  <div className={`${t.cardBg} border ${t.border} p-8 rounded-[2rem] shadow-sm lg:col-span-3 flex flex-col justify-between`}>
                      <div className="mb-6">
                          <h3 className={`text-lg font-bold ${t.text} flex items-center gap-2`}>
                              <FiBarChart2 size={18} className="text-blue-400" /> Ranking de Lojas Nacionais
                          </h3>
                          <p className={`text-xs ${t.textSecondary} mt-0.5`}>Faturamento acumulado por loja no período.</p>
                      </div>
                      <div className="h-[350px] w-full">
                          {metrics.rankLojas.labels.length > 0 ? (
                              <Bar 
                                  data={{ 
                                      labels: metrics.rankLojas.labels, 
                                      datasets: [{ 
                                          label: 'Faturamento R$', 
                                          data: metrics.rankLojas.data, 
                                          backgroundColor: chartColors.barColor,
                                          borderRadius: 8,
                                          barThickness: 'flex',
                                          maxBarThickness: 32
                                      }] 
                                  }} 
                                  options={barOptions} 
                              />
                          ) : (
                              <div className={`h-full flex items-center justify-center font-semibold ${t.textSecondary} ${t.inputBg} rounded-[1.5rem]`}>Nenhum dado comercial disponível</div>
                          )}
                      </div>
                  </div>

              </div>

              {/* ─── TABELA DE LOJAS DETALHADA ─── */}
              <div className={`rounded-3xl shadow-xl border overflow-hidden ${t.surface} ${t.border}`}>
                <div className="p-6 border-b border-slate-700/20">
                  <h3 className={`text-lg font-bold ${t.text}`}>Desempenho Detalhado por Unidade</h3>
                  <p className={`text-xs ${t.textSecondary} mt-0.5`}>Volume, tickets e ticket médio individualizado de cada loja no período selecionado.</p>
                </div>
                
                {listaLojasDetalhadas.length === 0 ? (
                  <div className="p-16 text-center">
                    <p className={`text-sm ${t.textSecondary} font-semibold`}>Nenhum dado comercial disponível no período.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className={`border-b border-slate-700/20 text-[10px] font-bold uppercase tracking-widest ${t.textSecondary} bg-slate-500/5`}>
                          <th className="py-4 px-6">Unidade</th>
                          <th className="py-4 px-6 text-right">Volume (GMV)</th>
                          <th className="py-4 px-6 text-right">Pedidos / Tickets</th>
                          <th className="py-4 px-6 text-right">Ticket Médio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/15">
                        {listaLojasDetalhadas.map((loja, idx) => (
                          <tr key={loja.id || idx} className={`transition-all ${t.surfaceHover}`}>
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${t.inputBg} ${t.border}`}>
                                  <FiHome className={`${t.textSecondary}`} size={14} />
                                </div>
                                <span className={`font-bold text-sm ${t.text}`}>{loja.nome}</span>
                              </div>
                            </td>
                            <td className={`py-4 px-6 text-right font-black text-sm tabular-nums ${t.text}`}>
                              R$ {fmt(loja.faturamento)}
                            </td>
                            <td className={`py-4 px-6 text-right font-bold text-sm ${t.textSecondary} tabular-nums`}>
                              {loja.transacoes}
                            </td>
                            <td className="py-4 px-6 text-right font-bold text-sm text-teal-400 tabular-nums">
                              R$ {fmt(loja.ticketMedio)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

          </div>
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

export default MasterAnalytics;
