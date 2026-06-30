import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ptBR } from 'date-fns/locale';
import DateRangeFilter from '../components/DateRangeFilter';
import { toast } from 'react-toastify';
import { useMasterDashboardData } from '../hooks/useMasterDashboardData';
import { motion, AnimatePresence } from 'framer-motion';
import { auditLogger } from '../utils/auditLogger';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  FiHome, FiUsers, FiFileText, FiUpload, FiTag, FiShield, FiImage,
  FiLogOut, FiShoppingCart, FiDollarSign, FiRefreshCw,
  FiTrendingUp, FiZap, FiAward, FiBell, FiSearch,
  FiSun, FiMoon, FiChevronDown, FiChevronUp, FiMessageSquare,
  FiPackage, FiSettings, FiBarChart2, FiGrid, FiActivity,
  FiMapPin, FiPhone, FiMail, FiClock, FiAlertCircle
} from 'react-icons/fi';

import { OverviewTab } from '../components/admin/master/OverviewTab';
import { StoresTab } from '../components/admin/master/StoresTab';
import { FinancialTab } from '../components/admin/master/FinancialTab';
import { SecurityTab } from '../components/admin/master/SecurityTab';

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
        <h3 className="text-lg font-black tracking-wider uppercase font-bricolage mb-1.5 text-white">
          Iniciando Ambiente
        </h3>
        <p className="text-sm font-bold text-slate-400">
          Sincronizando módulos e estabelecimentos...
          <span className="block mt-1 text-sm text-slate-500 animate-pulse">Carregando painel master IdeaFood</span>
        </p>
      </div>
    </div>
  </div>
);

function MasterDashboard() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout, setEstabelecimentoAtual } = useAuth();

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
    setSelectedStore,
    auditLogs,
    ultimosEstabelecimentos,
    sparklines,
    modoManutencao,
    toggleModoManutencao,
    topItensCardapio,
    atividadesLojas,
    metaMensal,
    dadosRegiao,
    topClientes,
    distribuicaoPlanos,
    dadosBrutos,
    dadosFiltradosBrutos
  } = useMasterDashboardData(currentUser, isMasterAdmin);

  const [selectedLoja, setSelectedLoja] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showNotifications, setShowNotifications] = useState(false);

  // Estados locais para controle de Ações de Comando da Rede
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendLojaId, setSuspendLojaId] = useState('');
  const [suspendMotivo, setSuspendMotivo] = useState('');
  const [isSuspending, setIsSuspending] = useState(false);

  const [showComunicadoModal, setShowComunicadoModal] = useState(false);
  const [comunicadoTexto, setComunicadoTexto] = useState('');
  const [isSendingComunicado, setIsSendingComunicado] = useState(false);

  // Estados locais para Seletor de Lojas
  const [showStoreSelector, setShowStoreSelector] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');
  const storeSelectorRef = useRef(null);

  // Estados locais para Auditoria e Exportação
  const [filterLevel, setFilterLevel] = useState('all');
  const [isExporting, setIsExporting] = useState(false);

  // Splits de Canais de Venda
  const canaisVenda = useMemo(() => {
    if (financeiroFiltrado && financeiroFiltrado.canais) {
      return financeiroFiltrado.canais;
    }
    return financeiro.canaisHoje || { deliveryTotal: 0, deliveryQtd: 0, salaoTotal: 0, salaoQtd: 0, balcaoTotal: 0, balcaoQtd: 0 };
  }, [financeiroFiltrado, financeiro.canaisHoje]);

  const totalCanais = useMemo(() => {
    return (canaisVenda.deliveryTotal || 0) + (canaisVenda.salaoTotal || 0) + (canaisVenda.balcaoTotal || 0);
  }, [canaisVenda]);

  const pctDelivery = useMemo(() => {
    return totalCanais > 0 ? Math.round((canaisVenda.deliveryTotal / totalCanais) * 100) : 0;
  }, [canaisVenda, totalCanais]);

  const pctSalao = useMemo(() => {
    return totalCanais > 0 ? Math.round((canaisVenda.salaoTotal / totalCanais) * 100) : 0;
  }, [canaisVenda, totalCanais]);

  const pctBalcao = useMemo(() => {
    return totalCanais > 0 ? Math.round((canaisVenda.balcaoTotal / totalCanais) * 100) : 0;
  }, [canaisVenda, totalCanais]);

  const pieChartData = useMemo(() => {
    return [
      { name: 'Delivery', value: canaisVenda.deliveryTotal || 0, qty: canaisVenda.deliveryQtd || 0, color: '#22d3ee', pct: pctDelivery },
      { name: 'Salão', value: canaisVenda.salaoTotal || 0, qty: canaisVenda.salaoQtd || 0, color: '#a855f7', pct: pctSalao },
      { name: 'Balcão/Retirada', value: canaisVenda.balcaoTotal || 0, qty: canaisVenda.balcaoQtd || 0, color: '#10b981', pct: pctBalcao }
    ].filter(item => item.value > 0);
  }, [canaisVenda, pctDelivery, pctSalao, pctBalcao]);

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

  // Fechar o seletor de lojas ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (storeSelectorRef.current && !storeSelectorRef.current.contains(e.target)) {
        setShowStoreSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredStoresForSelect = useMemo(() => {
    if (!storeSearch.trim()) return contatosEstabelecimentos;
    return contatosEstabelecimentos.filter(e =>
      e.nome.toLowerCase().includes(storeSearch.toLowerCase())
    );
  }, [contatosEstabelecimentos, storeSearch]);

  const selectedStoreName = useMemo(() => {
    if (!selectedStore) return 'Toda a Rede (Consolidado)';
    const estab = contatosEstabelecimentos.find(e => e.id === selectedStore);
    return estab ? estab.nome : 'Loja Selecionada';
  }, [selectedStore, contatosEstabelecimentos]);

  // Função utilitária para gerar caminhos SVG de Sparklines
  const generateSparklinePath = (points, width = 120, height = 30) => {
    if (!points || points.length < 2) return '';
    const max = Math.max(...points, 1);
    const min = Math.min(...points, 0);
    const range = max - min || 1;
    
    return points.map((val, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((val - min) / range) * height - 2; // Offset para não cortar a linha no topo
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${Math.max(2, y).toFixed(1)}`;
    }).join(' ');
  };

  const generateSparklineFill = (points, width = 120, height = 30) => {
    const linePath = generateSparklinePath(points, width, height);
    if (!linePath) return '';
    return `${linePath} L ${width} ${height} L 0 ${height} Z`;
  };

  // Filtragem de Logs de Auditoria por nível de severidade
  const filteredLogs = useMemo(() => {
    if (filterLevel === 'all') return auditLogs;
    return auditLogs.filter(log => {
      const lvl = String(log.level || 'info').toLowerCase();
      if (filterLevel === 'danger') return lvl === 'danger' || lvl === 'error';
      return lvl === filterLevel;
    });
  }, [auditLogs, filterLevel]);

  // Exportação simulada de logs de auditoria
  const handleExportLogs = () => {
    setIsExporting(true);
    toast.info("Compilando auditoria em formato RFC 4180...");
    setTimeout(() => {
      setIsExporting(false);
      toast.success("Relatório de logs exportado com sucesso (auditoria-master.csv)!");
    }, 1500);
  };

  // Bloqueio Expresso de Estabelecimento
  const handleSuspendLoja = async () => {
    if (!suspendLojaId) {
      toast.warn("Selecione um estabelecimento para bloquear.");
      return;
    }
    if (!suspendMotivo.trim()) {
      toast.warn("Escreva o motivo da suspensão.");
      return;
    }
    setIsSuspending(true);
    toast.info("Processando suspensão no Firestore...");
    try {
      const docRef = doc(db, 'estabelecimentos', suspendLojaId);
      await updateDoc(docRef, {
        ativo: false,
        suspensaoMotivo: suspendMotivo,
        dataSuspensao: new Date()
      });
      
      const actor = {
        uid: currentUser?.uid || 'sistema',
        email: currentUser?.email || 'sistema@automacao',
        role: isMasterAdmin ? 'master' : 'admin'
      };
      await auditLogger(
        'LOJA_SUSPENSA',
        actor,
        { type: 'estabelecimento', id: suspendLojaId, name: estabelecimentosMap[suspendLojaId] || 'Estabelecimento' },
        { motivo: suspendMotivo },
        'danger'
      );

      setIsSuspending(false);
      setShowSuspendModal(false);
      toast.error(`Estabelecimento bloqueado e faturas suspensas!`);
      // Reseta formulário
      setSuspendLojaId('');
      setSuspendMotivo('');
      if (fetchHistoricalData) {
        fetchHistoricalData();
      }
    } catch (error) {
      console.error("Erro ao suspender estabelecimento no Firestore:", error);
      toast.error("Erro ao suspender estabelecimento no banco de dados.");
      setIsSuspending(false);
    }
  };

  const handleQuickSuspendSetup = (lojaId, motivoSugerido) => {
    setSuspendLojaId(lojaId);
    setSuspendMotivo(motivoSugerido);
    setShowSuspendModal(true);
  };


  // Disparo de Comunicado Interno da Rede
  const handleSendComunicado = () => {
    if (!comunicadoTexto.trim()) {
      toast.warn("Digite a mensagem do comunicado.");
      return;
    }
    setIsSendingComunicado(true);
    toast.info("Publicando comunicado nos painéis...");
    setTimeout(() => {
      setIsSendingComunicado(false);
      setShowComunicadoModal(false);
      toast.success("Comunicado interno publicado com sucesso!");
      setComunicadoTexto('');
    }, 1200);
  };

  const searchInputRef = useRef(null);

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

  // Sincroniza o tema entre abas
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'dashboard_theme') {
        setTheme(e.newValue || 'dark');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

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
        { to: '/master/estabelecimentos', label: 'Estabelecimentos', icon: <FiHome size={18} />, desc: 'Gerenciar lojas parceiras' },
        { to: '/master/clientes', label: 'Clientes', icon: <FiUsers size={18} />, desc: 'Base de clientes' },
        { to: '/master/pedidos', label: 'Pedidos', icon: <FiShoppingCart size={18} />, desc: 'Acompanhar entregas' },
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
        { to: '/master/financeiro', label: 'Faturamento', icon: <FiBarChart2 size={18} />, desc: 'Visão consolidada' },
        { to: '/master/contas-receber', label: 'Contas a Receber', icon: <FiUsers size={18} />, desc: 'Cobranças e mensalidades' },
        { to: '/master/nfce', label: 'NFC-e', icon: <FiFileText size={18} />, desc: 'Documentos fiscais' },
        { to: '/master/departamentos-fiscais', label: 'Fiscal', icon: <FiShield size={18} />, desc: 'Configurações fiscais' },
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
        { to: '/master/plans', label: 'Planos', icon: <FiTag size={18} />, desc: 'Gerenciar assinaturas' },
        { to: '/master/cupons-rede', label: 'Cupons', icon: <FiZap size={18} />, desc: 'Campanhas promocionais' },
        { to: '/master/mensagens', label: 'Mensagens', icon: <FiMessageSquare size={18} />, desc: 'Comunicação via WhatsApp' },
      ]
    },
    {
      id: 'admin',
      title: 'Administração',
      icon: <FiSettings size={20} />,
      colorClass: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
      accentColor: 'hover:border-orange-400/40 hover:shadow-orange-950/10',
      tagColor: 'text-orange-400',
      items: [
        { to: '/master/usuarios', label: 'Usuários', icon: <FiUsers size={18} />, desc: 'Controle de acessos' },
        { to: '/master/importar-cardapio', label: 'Importação', icon: <FiUpload size={18} />, desc: 'Cardápio via CSV' },
        { to: '/master/associar-imagens', label: 'Imagens', icon: <FiImage size={18} />, desc: 'Banco de imagens' },
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

    const hoursHoje = {};
    const hoursOntem = {};
    for (let i = 0; i < 24; i++) {
      hoursHoje[i] = 0;
      hoursOntem[i] = 0;
    }

    const dataAtualOperacional = new Date(Date.now() - (6 * 60 * 60 * 1000));
    const hojeStart = new Date(dataAtualOperacional.getTime());
    hojeStart.setHours(0, 0, 0, 0);

    allSales.forEach(sale => {
      const total = Number(sale.totalFinal) || Number(sale.total) || Number(sale.valorFinal) || 0;
      let date = null;

      try {
        if (sale.dataPedido?.toDate) date = sale.dataPedido.toDate();
        else if (sale.createdAt?.toDate) date = sale.createdAt.toDate();
        else if (sale.createdAt?.seconds) date = new Date(sale.createdAt.seconds * 1000);
        else if (sale.dataPedido?.seconds) date = new Date(sale.dataPedido.seconds * 1000);

        if (date) {
          const hour = date.getHours();
          const opDate = new Date(date.getTime() - (6 * 60 * 60 * 1000));
          if (opDate.getTime() >= hojeStart.getTime()) {
            hoursHoje[hour] += total;
          } else {
            hoursOntem[hour] += total;
          }
        }
      } catch (e) { }
    });

    const dataArr = [];
    for (let i = 0; i < 24; i++) {
      if (hoursHoje[i] > 0 || hoursOntem[i] > 0) {
        dataArr.push({
          hour: `${String(i).padStart(2, '0')}:00`,
          hoje: Math.round(hoursHoje[i] * 100) / 100,
          ontem: Math.round(hoursOntem[i] * 100) / 100
        });
      }
    }
    return dataArr;
  }, [financeiro, financeiroFiltrado]);

  const themeClasses = {
    dark: {
      bg: 'bg-[#080c16] bg-cyber-grid-dark text-slate-100',
      surface: 'bg-slate-950/45 backdrop-blur-xl border border-white/5 shadow-2xl',
      surfaceHover: 'hover:bg-slate-900/50 hover:border-cyan-500/30 hover:shadow-[0_12px_40px_rgba(6,182,212,0.15)] hover:scale-[1.015] hover:-translate-y-0.5 transition-all duration-300',
      border: 'border-white/5',
      text: 'text-slate-100 font-space',
      textSecondary: 'text-slate-400 font-space font-medium',
      textMuted: 'text-slate-500 font-space font-semibold',
      accent: 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)] text-slate-950 font-black',
      accentHover: 'hover:bg-cyan-600',
      gradient: 'from-cyan-400 via-violet-500 to-fuchsia-500',
      cardBg: 'bg-slate-950/30 backdrop-blur-xl border border-white/5 shadow-2xl',
      inputBg: 'bg-slate-950/30 border-white/10 text-slate-100 focus-within:border-cyan-500/50 focus-within:bg-slate-950/50',
    },
    light: {
      bg: 'bg-[#fbfbfa] bg-cyber-grid-light text-stone-900',
      surface: 'bg-white/95 backdrop-blur-md border border-stone-200 shadow-md',
      surfaceHover: 'hover:bg-white hover:border-stone-300 hover:shadow-[0_12px_45px_rgba(28,25,23,0.06)] hover:scale-[1.015] hover:-translate-y-0.5 transition-all duration-300',
      border: 'border-stone-200',
      text: 'text-stone-900 font-space font-bold',
      textSecondary: 'text-stone-700 font-space font-medium',
      textMuted: 'text-stone-400 font-space font-semibold',
      accent: 'bg-stone-900 text-white font-bold',
      accentHover: 'hover:bg-black',
      gradient: 'from-[#ff6b35] via-amber-500 to-[#e85a2a]',
      cardBg: 'bg-[#f5f5f4]/80 backdrop-blur-md border border-stone-200 shadow-sm',
      inputBg: 'bg-[#f5f5f4] border-stone-200 text-stone-900 focus-within:border-stone-400 focus-within:bg-white',
    }
  };

  const t = themeClasses[theme];
  const isDark = theme === 'dark';

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className={`p-4 rounded-2xl border backdrop-blur-xl shadow-2xl ${
          isDark
            ? 'bg-slate-950/95 border-cyan-500/30 text-white shadow-[0_0_20px_rgba(6,182,212,0.15)]'
            : 'bg-white/95 border-stone-200 text-stone-900 shadow-[0_10px_35px_rgba(28,25,23,0.06)]'
        }`}>
          <p className="text-sm font-black uppercase tracking-widest text-slate-450 mb-2 font-space">{label}</p>
          <div className="space-y-1.5">
            {payload.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${p.dataKey === 'hoje' ? 'bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.6)]' : 'bg-indigo-400'}`} />
                <p className="text-[11px] font-bold text-slate-400 font-space">{p.name}:</p>
                <p className="text-sm font-black font-mono-jb">{formatCurrency(p.value)}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  if (authLoading || loadingDashboard) return <LoadingScreen />;


  const dashboardState = {
    t, isDark, theme, loadingDashboard, searchQuery, setSearchQuery, financeiro, stats, estabelecimentosMap,
    alertas, datePreset, dateRange, handleDatePresetChange, handleDateRangeChange, handleDateClear,
    fetchHistoricalData, financeiroFiltrado, crescimento, ticketMedio, contatosEstabelecimentos,
    selectedStore, setSelectedStore, auditLogs, ultimosEstabelecimentos, sparklines,
    modoManutencao, toggleModoManutencao, topItensCardapio, atividadesLojas, metaMensal,
    dadosRegiao, topClientes, distribuicaoPlanos, selectedLoja, setSelectedLoja,
    activeTab, setActiveTab, showNotifications, setShowNotifications,
    showSuspendModal, setShowSuspendModal, suspendLojaId, setSuspendLojaId, suspendMotivo, setSuspendMotivo, isSuspending, setIsSuspending,
    showComunicadoModal, setShowComunicadoModal, comunicadoTexto, setComunicadoTexto, isSendingComunicado, setIsSendingComunicado,
    showStoreSelector, setShowStoreSelector, storeSearch, setStoreSearch, storeSelectorRef,
    filterLevel, setFilterLevel, isExporting, setIsExporting, canaisVenda, totalCanais, pctDelivery, pctSalao, pctBalcao, pieChartData,
    statsLoja, filteredStoresForSelect, selectedStoreName, generateSparklinePath, generateSparklineFill, filteredLogs, handleExportLogs, handleQuickSuspendSetup, handleSendComunicado, handleSuspendLoja, hourlyData, filteredModules, dadosBrutos, dadosFiltradosBrutos
  };

  return (
    <div className={`min-h-screen ${t.bg} transition-colors duration-500 relative overflow-hidden pb-12 font-space`}>
      
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
        @keyframes rotate-gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient-border {
          background-size: 200% 200%;
          animation: rotate-gradient 5s ease infinite;
        }
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
            x: [0, 60, -40, 0],
            y: [0, -70, 40, 0],
            scale: [1, 1.25, 0.85, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-[-15%] left-1/4 w-[650px] h-[650px] rounded-full bg-gradient-to-tr from-cyan-500/5 to-transparent blur-[140px]"
        />
        <motion.div
          animate={{
            x: [0, -40, 50, 0],
            y: [0, 50, -50, 0],
            scale: [1, 0.9, 1.2, 1],
          }}
          transition={{
            duration: 28,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-1/3 right-[5%] w-[550px] h-[550px] rounded-full bg-gradient-to-tr from-violet-500/5 to-transparent blur-[120px]"
        />
        <motion.div
          animate={{
            x: [0, 50, -30, 0],
            y: [0, 40, 30, 0],
            scale: [1, 1.15, 0.9, 1],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-emerald-500/4 to-transparent blur-[110px]"
        />
      </div>

      {/* Main Layout Container */}
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10 space-y-6">

        {/* HEADER GLASS CARD */}
        <header className={`p-6 rounded-[2.5rem] border backdrop-blur-xl transition-all duration-300 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 relative z-50 ${t.surface} ${t.border}`}>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            {/* Avatar com anel de gradiente giratório */}
            <div className="relative p-0.5 rounded-2xl overflow-hidden bg-gradient-to-tr from-cyan-400 via-indigo-500 to-purple-650 shadow-lg shrink-0">
              <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center font-bricolage font-black text-xl ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-stone-900'}`}>
                {userName[0].toUpperCase()}
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-1.5 font-bricolage">
                {saudacao}, <span className="bg-gradient-to-r from-cyan-400 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">{userName}</span>
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className={`text-sm font-semibold ${t.textSecondary}`}>
                  {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}
                </p>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-black uppercase border ${
                  isDark ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  ONLINE
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 w-full sm:w-auto shrink-0">
            {/* Seletor Rápido de Lojas */}
            <div className="relative z-40 shrink-0" ref={storeSelectorRef}>
              <button
                onClick={() => setShowStoreSelector(!showStoreSelector)}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl border transition-all duration-300 active:scale-95 text-sm font-black uppercase tracking-wider ${t.surface} ${t.border} ${t.textSecondary} hover:text-cyan-400`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${selectedStore ? 'bg-emerald-500 animate-pulse' : 'bg-cyan-400'}`} />
                <span className="truncate max-w-[130px]">{selectedStoreName}</span>
                <FiChevronDown className={`transition-transform duration-300 ${showStoreSelector ? 'rotate-180' : ''}`} size={18} />
              </button>

              <AnimatePresence>
                {showStoreSelector && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className={`absolute right-0 mt-2.5 w-72 rounded-3xl border p-4 shadow-2xl z-50 transition-all duration-300 ${t.surface} ${t.border}`}
                  >
                    <div className="mb-3">
                      <div className={`flex items-center rounded-xl px-3 py-2 border ${t.inputBg}`}>
                        <FiSearch className={t.textSecondary} size={18} />
                        <input
                          type="text"
                          placeholder="Buscar loja..."
                          value={storeSearch}
                          onChange={(e) => setStoreSearch(e.target.value)}
                          className={`bg-transparent border-none outline-none ml-2 flex-1 text-[11px] font-bold placeholder-slate-500 focus:outline-none focus:ring-0 ${t.text}`}
                        />
                      </div>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-1.5 no-scrollbar">
                      <button
                        onClick={() => { 
                          setSelectedStore(''); 
                          setEstabelecimentoAtual(null); 
                          setShowStoreSelector(false); 
                        }}
                        className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left text-[11px] font-black uppercase border border-transparent transition-all hover:bg-cyan-500/10 hover:border-cyan-500/20 hover:text-cyan-400 ${
                          !selectedStore ? 'bg-cyan-500/10 border-cyan-500/15 text-cyan-400' : t.textSecondary
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        Toda a Rede (Consolidado)
                      </button>

                      {filteredStoresForSelect.map(store => (
                        <button
                          key={store.id}
                          onClick={() => { 
                            setSelectedStore(store.id); 
                            setEstabelecimentoAtual(store.id);
                            setShowStoreSelector(false); 
                          }}
                          className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left text-[11px] font-black uppercase border border-transparent transition-all hover:bg-emerald-500/10 hover:border-emerald-500/20 hover:text-emerald-400 ${
                            selectedStore === store.id ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-450' : t.textSecondary
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {store.nome}
                        </button>
                      ))}

                      {filteredStoresForSelect.length === 0 && (
                        <p className={`text-sm text-center py-4 ${t.textMuted}`}>Nenhuma loja localizada</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bell/Alerts Panel */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-3 rounded-2xl border transition-all duration-300 relative active:scale-95 ${t.surface} ${t.border} ${t.textSecondary} hover:text-cyan-400`}
              >
                <FiBell size={18} />
                {(alertas.certVencidos.length > 0 || alertas.mensalidadeAtrasada.length > 0) && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-sm flex items-center justify-center font-black border-2 border-slate-950">
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
                    className={`absolute right-0 mt-3 w-80 rounded-3xl border p-4 shadow-2xl z-50 transition-all duration-300 ${t.surface} ${t.border}`}
                  >
                    <h4 className={`text-sm font-black uppercase tracking-wider ${t.text} mb-3 pb-2 border-b ${t.border} font-bricolage`}>Alertas Administrativos</h4>
                    <div className="max-h-60 overflow-y-auto space-y-2 no-scrollbar">
                      {alertas.certVencidos.length === 0 && alertas.mensalidadeAtrasada.length === 0 ? (
                        <p className={`text-sm text-center py-4 ${t.textMuted}`}>Nenhum alerta pendente</p>
                      ) : (
                        <>
                          {alertas.certVencidos.map((estab) => (
                            <div key={estab.id} className="flex gap-2.5 p-3 rounded-2xl bg-red-500/5 border border-red-500/10 text-sm font-medium">
                              <FiAlertCircle className="text-red-400 shrink-0 mt-0.5" size={16} />
                              <div className="flex-1 space-y-0.5">
                                <p className={`font-black ${t.text}`}>{estab.nome}</p>
                                <p className="text-red-400 text-sm font-bold font-mono-jb">Certificado digital vencido</p>
                              </div>
                            </div>
                          ))}
                          {alertas.mensalidadeAtrasada.map((estab) => (
                            <div key={estab.id} className="flex gap-2.5 p-3 rounded-2xl bg-orange-500/5 border border-orange-500/10 text-sm font-medium">
                              <FiAlertCircle className="text-orange-400 shrink-0 mt-0.5" size={16} />
                              <div className="flex-1 space-y-0.5">
                                <p className={`font-black ${t.text}`}>{estab.nome}</p>
                                <p className="text-orange-400 text-sm font-bold font-mono-jb">Mensalidade em atraso</p>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                    <Link
                      to="/master/estabelecimentos"
                      onClick={() => setShowNotifications(false)}
                      className={`block text-center text-sm font-black text-cyan-500 hover:text-cyan-400 mt-3 pt-3 border-t ${t.border}`}
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
              className={`p-3 rounded-2xl border transition-all duration-300 active:scale-95 ${t.surface} ${t.border} ${t.textSecondary} hover:text-cyan-400`}
            >
              {theme === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
            </button>

            {/* Logout */}
            <button
              onClick={async () => { await logout(); navigate('/'); }}
              className="p-3 rounded-2xl border text-red-500 hover:bg-red-500/10 hover:border-red-500/30 transition-all duration-300 active:scale-95 bg-red-500/5 border-red-500/10"
            >
              <FiLogOut size={18} />
            </button>
          </div>
        </header>

        {/* GLOBAL GLASS SEARCH BAR */}
        <div className="relative">
          <div className={`flex items-center rounded-2xl px-4 py-3.5 border transition-all duration-300 shadow-md ${t.inputBg}`}>
            <FiSearch className={t.textSecondary} size={18} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar módulos, funcionalidades..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`bg-transparent border-none outline-none ml-3 flex-1 text-sm font-bold placeholder-slate-500 focus:outline-none focus:ring-0 ${t.text}`}
            />
            <div className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-lg border text-sm font-black select-none ${
              isDark ? 'border-slate-800 bg-slate-950 text-slate-500 font-mono-jb' : 'border-stone-250 bg-stone-150 text-stone-600'
            }`}>
              <span>Ctrl</span>
              <span>+</span>
              <span>K</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center justify-start gap-3.5 pb-2">
          {[
            { id: 'overview', label: 'Visão Geral', icon: <FiGrid size={18} /> },
            { id: 'stores', label: 'Lojas & Operação', icon: <FiHome size={18} /> },
            { id: 'financial', label: 'Métricas & Metas', icon: <FiBarChart2 size={18} /> },
            { id: 'security', label: 'Segurança & Auditoria', icon: <FiShield size={18} /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl border transition-all duration-300 font-bricolage text-xs font-black uppercase tracking-wider active:scale-95 ${
                activeTab === tab.id
                  ? (theme === 'dark' 
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)] font-black' 
                      : 'bg-stone-900 text-white border-stone-850 font-bold shadow-md')
                  : `${t.surface} ${t.border} ${t.textSecondary} hover:text-cyan-400 hover:border-cyan-500/25`
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* CENTRAL DE COMANDOS DE REDE (Ações Rápidas) */}
        {activeTab === 'stores' && <StoresTab {...dashboardState} />}

        {/* KPIS STATS GRID (4 Columns) */}
        {activeTab === 'overview' && <OverviewTab {...dashboardState} />}

        {/* RANKINGS E MIX DE PRODUTOS */}
        {activeTab === 'financial' && <FinancialTab {...dashboardState} />}

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
                <h3 className={`text-sm font-black uppercase tracking-wider ${t.text}`}>Ação Administrativa Necessária</h3>
                <p className={`text-sm font-bold ${t.textSecondary}`}>
                  Detectamos {alertas.certVencidos.length + alertas.mensalidadeAtrasada.length} lojas com certificados vencidos ou débitos pendentes.
                </p>
              </div>
            </div>
            <Link
              to="/master/estabelecimentos"
              className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-black tracking-wider uppercase transition-colors"
            >
              Resolver Pendências
            </Link>
          </motion.div>
        )}

        {/* TIMELINE DE LOGS DE AUDITORIA E SEGURANÇA MESTRE */}
        {activeTab === 'security' && <SecurityTab {...dashboardState} />}

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
                className={`w-screen max-w-md border-l flex flex-col justify-between shadow-2xl relative overflow-hidden transition-all duration-300 rounded-l-[2.5rem] ${t.border} ${t.surface}`}
              >
                {/* Decorative blob */}
                <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />

                {/* Header */}
                <div className={`p-6 border-b relative z-10 bg-slate-950/20 backdrop-blur-md ${t.border}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-black uppercase tracking-wider font-bricolage">
                      {estabelecimentosMap[selectedLoja.id] || selectedLoja.nomeSalvoNoPedido || 'Detalhes da Loja'}
                    </h3>
                    <button
                      onClick={() => setSelectedLoja(null)}
                      className={`p-2.5 rounded-xl border transition-all active:scale-95 duration-300 ${t.border} ${t.surface}`}
                    >
                      <FiChevronDown className="rotate-270" size={18} />
                    </button>
                  </div>

                  {/* Summary values */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className={`p-3 rounded-2xl border transition-all duration-300 ${t.inputBg} ${t.border}`}>
                      <span className={`block text-sm font-black uppercase tracking-wider mb-1 ${t.textSecondary}`}>Total Faturado</span>
                      <span className="text-md font-black text-cyan-500 font-mono-jb">{formatCurrency(selectedLoja.total)}</span>
                    </div>
                    <div className={`p-3 rounded-2xl border transition-all duration-300 ${t.inputBg} ${t.border}`}>
                      <span className={`block text-sm font-black uppercase tracking-wider mb-1 ${t.textSecondary}`}>Pedidos</span>
                      <span className="text-md font-black font-mono-jb">{selectedLoja.pedidos}</span>
                    </div>
                  </div>

                  {/* Splits: Delivery vs Salão */}
                  <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-dashed border-slate-700/50">
                    <div className={`p-3 rounded-2xl border transition-colors duration-300 ${theme === 'dark' ? 'bg-cyan-500/5 border-cyan-500/15' : 'bg-cyan-50 border-cyan-200'}`}>
                      <span className="block text-sm font-black uppercase tracking-wider text-cyan-400 mb-1">🏍️ Delivery</span>
                      <span className="block text-sm font-black text-cyan-400 font-mono-jb">{formatCurrency(statsLoja.deliveryTotal)}</span>
                      <span className={`text-sm font-bold ${t.textSecondary}`}>{statsLoja.deliveryQtd} pedidos</span>
                    </div>
                    <div className={`p-3 rounded-2xl border transition-colors duration-300 ${theme === 'dark' ? 'bg-purple-500/5 border-purple-500/15' : 'bg-purple-50 border-purple-200'}`}>
                      <span className="block text-sm font-black uppercase tracking-wider text-purple-400 mb-1">🍽️ Salão / PDV</span>
                      <span className="block text-sm font-black text-purple-400 font-mono-jb">{formatCurrency(statsLoja.salaoTotal)}</span>
                      <span className={`text-sm font-bold ${t.textSecondary}`}>{statsLoja.salaoQtd} vendas</span>
                    </div>
                  </div>
                </div>

                {/* Orders History inside Drawer */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3 relative z-10 no-scrollbar">
                  <h4 className={`text-sm font-black uppercase tracking-widest mb-2 font-bricolage ${t.textSecondary}`}>Fila Operacional Recente</h4>

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
                            className={`flex items-center justify-between p-3.5 rounded-2xl border transition-colors duration-300 ${t.inputBg} ${t.border} hover:border-cyan-500/20`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-black font-space">Transação #{idx + 1}</p>
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-lg text-sm font-black uppercase border ${
                                  isDelivery
                                    ? (theme === 'dark' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/15' : 'bg-cyan-50 text-cyan-600 border-cyan-200')
                                    : (theme === 'dark' ? 'bg-purple-500/10 text-purple-400 border-purple-500/15' : 'bg-purple-50 text-purple-650 border-purple-500/15')
                                }`}>
                                  {isDelivery ? 'Delivery' : 'Salão/PDV'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <FiClock className={t.textMuted} size={18} />
                                <p className={`text-sm font-bold font-mono-jb ${t.textMuted}`}>{dateStr}</p>
                              </div>
                            </div>
                            <div className="text-right space-y-0.5">
                              <p className="text-sm font-black text-cyan-500 font-mono-jb">{formatCurrency(total)}</p>
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-lg text-sm font-black border uppercase ${
                                theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}>
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
                      <p className={`text-sm font-bold ${t.textMuted}`}>Nenhum registro operacional.</p>
                    </div>
                  )}
                </div>

                {/* Footer close button */}
                <div className={`p-6 border-t bg-slate-950/20 backdrop-blur-md relative z-10 ${t.border}`}>
                  <button
                    onClick={() => setSelectedLoja(null)}
                    className="w-full py-3.5 text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:opacity-95 shadow-lg shadow-indigo-500/25 active:scale-95 transition-all font-bricolage bg-gradient-to-r from-blue-500 to-indigo-650"
                  >
                    Fechar Detalhes
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE SUSPENSÃO DE ESTABELECIMENTOS */}
      <AnimatePresence>
        {showSuspendModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
              onClick={() => setShowSuspendModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className={`w-full max-w-md rounded-[2.5rem] border p-6 shadow-2xl relative z-10 overflow-hidden ${t.cardBg} ${t.border}`}
            >
              <h3 className="text-lg font-black uppercase tracking-wider font-bricolage mb-1 text-red-500">
                Bloqueio Expresso de Estabelecimento
              </h3>
              <p className={`text-[11px] font-bold ${t.textSecondary} mb-4`}>
                Suspenda o acesso operacional e suspenda as vendas da loja selecionada.
              </p>

              <div className="space-y-4">
                {/* Seleção de Loja */}
                <div className="space-y-1.5">
                  <label className={`text-sm font-black uppercase tracking-wider ${t.textSecondary}`}>Selecione o Estabelecimento</label>
                  <select
                    value={suspendLojaId}
                    onChange={(e) => setSuspendLojaId(e.target.value)}
                    className={`w-full px-4 py-3 rounded-2xl border text-sm font-bold outline-none transition-all focus:border-red-500/50 ${t.inputBg} ${t.border}`}
                  >
                    <option value="">Selecione uma loja...</option>
                    {contatosEstabelecimentos.map(store => (
                      <option key={store.id} value={store.id}>{store.nome}</option>
                    ))}
                  </select>
                </div>

                {/* Motivo do Bloqueio */}
                <div className="space-y-1.5">
                  <label className={`text-sm font-black uppercase tracking-wider ${t.textSecondary}`}>Motivo da Suspensão</label>
                  <textarea
                    rows="3"
                    value={suspendMotivo}
                    onChange={(e) => setSuspendMotivo(e.target.value)}
                    placeholder="Ex: Fatura vencida há mais de 15 dias ou descumprimento dos termos de serviço..."
                    className={`w-full px-4 py-3 rounded-2xl border text-sm font-bold outline-none transition-all focus:border-red-500/50 resize-none ${t.inputBg} ${t.border}`}
                  />
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowSuspendModal(false)}
                  className={`flex-1 py-3.5 rounded-2xl font-black text-sm uppercase border transition-all active:scale-95 ${t.border} ${t.textSecondary} hover:bg-slate-800/10`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSuspendLoja}
                  disabled={isSuspending}
                  className="flex-1 py-3.5 bg-red-600 text-white rounded-2xl font-black text-sm uppercase transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-600/20 font-space"
                >
                  {isSuspending ? 'Bloqueando...' : 'Confirmar Bloqueio'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE COMUNICADO INTERNO */}
      <AnimatePresence>
        {showComunicadoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
              onClick={() => setShowComunicadoModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className={`w-full max-w-md rounded-[2.5rem] border p-6 shadow-2xl relative z-10 overflow-hidden ${t.cardBg} ${t.border}`}
            >
              <h3 className="text-lg font-black uppercase tracking-wider font-bricolage mb-1 text-indigo-400">
                Disparar Comunicado Interno
              </h3>
              <p className={`text-[11px] font-bold ${t.textSecondary} mb-4`}>
                Publique uma notificação importante que será exibida no cabeçalho de todas as lojas parceiras.
              </p>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className={`text-sm font-black uppercase tracking-wider ${t.textSecondary}`}>Texto do Comunicado</label>
                  <textarea
                    rows="4"
                    value={comunicadoTexto}
                    onChange={(e) => setComunicadoTexto(e.target.value)}
                    placeholder="Digite aqui o texto do aviso global (ex: instabilidade no gateway de cartões, manutenções programadas...)"
                    className={`w-full px-4 py-3 rounded-2xl border text-sm font-bold outline-none transition-all focus:border-indigo-500/50 resize-none ${t.inputBg} ${t.border}`}
                  />
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowComunicadoModal(false)}
                  className={`flex-1 py-3.5 rounded-2xl font-black text-sm uppercase border transition-all active:scale-95 ${t.border} ${t.textSecondary} hover:bg-slate-800/10`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSendComunicado}
                  disabled={isSendingComunicado}
                  className="flex-1 py-3.5 bg-indigo-650 text-white rounded-2xl font-black text-sm uppercase transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-550/20 font-space"
                >
                  {isSendingComunicado ? 'Publicando...' : 'Publicar Aviso'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MasterDashboard;