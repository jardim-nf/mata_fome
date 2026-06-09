import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collectionGroup, collection, getDocs, query, where } from 'firebase/firestore';
import { 
  FiArrowLeft, FiSun, FiMoon, FiLogOut, FiFileText, FiDollarSign, 
  FiTrendingUp, FiClock, FiSearch, FiHome, FiCheckCircle
} from 'react-icons/fi';
import DateRangeFilter, { getPresetRange } from '../../components/DateRangeFilter';
import { vendaService } from '../../services/vendaService';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';

// ─── Skeleton Loader (Bento Style) ───
const SkeletonRow = ({ isDark }) => (
  <div className={`p-6 flex flex-col sm:flex-row sm:items-center gap-4 animate-pulse border-b ${isDark ? 'border-slate-800/60' : 'border-slate-100'}`}>
    <div className={`w-12 h-12 rounded-2xl shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    <div className="flex-1 space-y-2">
      <div className={`h-4 rounded-lg w-40 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
      <div className={`h-3 rounded-lg w-24 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    </div>
    <div className={`h-6 rounded-lg w-20 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    <div className={`h-8 rounded-full w-24 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
  </div>
);

function MasterNfce() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  const [nfces, setNfces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estabMap, setEstabMap] = useState({});
  const [estabList, setEstabList] = useState([]);
  const [filterEstab, setFilterEstab] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingAcao, setLoadingAcao] = useState(null);

  const [datePreset, setDatePreset] = useState('30d');
  const [dateRange, setDateRange] = useState(getPresetRange('30d') || { start: null, end: null });

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

  // Configura título SEO
  useEffect(() => {
    document.title = "IdeaFood - Monitoramento Fiscal NFC-e";
  }, []);

  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return;
    
    const fetchNfces = async () => {
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

        // Determinação dos limites de data com fallback resiliente
        const start = dateRange.start ? new Date(dateRange.start) : new Date();
        if (!dateRange.start) {
          start.setDate(start.getDate() - 30);
        }
        start.setHours(0,0,0,0);
        
        const end = dateRange.end ? new Date(dateRange.end) : new Date();
        end.setHours(23,59,59,999);

        // Busca paralela por subcoleção para pedidos (que é subcoleção) e busca direta na raiz para vendas (que é coleção raiz)
        const pedPromises = elist.map(est => {
          const pedRef = collection(db, 'estabelecimentos', est.id, 'pedidos');
          return getDocs(query(pedRef, where('createdAt', '>=', start), where('createdAt', '<=', end)));
        });

        const venQuery = query(
          collection(db, 'vendas'),
          where('createdAt', '>=', start),
          where('createdAt', '<=', end)
        );
        const venPromise = getDocs(venQuery);

        const snaps = await Promise.all([...pedPromises, venPromise]);

        const extrairData = (c) => {
          if (!c) return null;
          if (typeof c.toDate === 'function') return c.toDate();
          if (c.seconds) return new Date(c.seconds * 1000);
          const d = new Date(c); return isNaN(d.getTime()) ? null : d;
        };
        const getDate = (item) => extrairData(item.createdAt) || extrairData(item.dataPedido) || extrairData(item.adicionadoEm) || extrairData(item.updatedAt);

        let todosFiltrados = [];

        // Processa snaps de pedidos
        const pedSnaps = snaps.slice(0, elist.length);
        const venSnap = snaps[elist.length];

        pedSnaps.forEach(snap => {
          snap.forEach(d => {
            let data = { id: d.id, ...d.data(), _path: d.ref.path };
            if ((data.fiscal && (data.fiscal.status === 'autorizado' || data.fiscal.status === 'CONCLUIDO')) || !!data.url_danfe || !!data?.fiscal?.urlDanfe) {
              const dt = getDate(data) || new Date(0);
              data._dataCalculada = dt; 
              todosFiltrados.push(data);
            }
          });
        });

        // Processa snap de vendas
        venSnap.forEach(d => {
          let data = { id: d.id, ...d.data(), _path: d.ref.path };
          if ((data.fiscal && (data.fiscal.status === 'autorizado' || data.fiscal.status === 'CONCLUIDO')) || !!data.url_danfe || !!data?.fiscal?.urlDanfe) {
            const dt = getDate(data) || new Date(0);
            data._dataCalculada = dt; 
            todosFiltrados.push(data);
          }
        });

        todosFiltrados.sort((a, b) => b._dataCalculada - a._dataCalculada);
        setNfces(todosFiltrados);
      } catch (err) {
        console.error('Erro ao buscar NFC-es globais', err);
        toast.error('Erro ao buscar dados das franquias.');
      } finally {
        setLoading(false);
      }
    };
    fetchNfces();
  }, [currentUser, isMasterAdmin, dateRange.start, dateRange.end]);

  const handleDatePresetChange = (preset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      const range = getPresetRange(preset);
      if (range) setDateRange(range);
    }
  };

  const handleDateRangeChange = (range) => {
    setDateRange(range);
  };

  const handleDateClear = () => {
    setDatePreset(null);
    setDateRange({ start: null, end: null });
  };

  const getEstabId = (nota) => {
    if (nota.estabelecimentoId) return nota.estabelecimentoId;
    if (nota.estabelecimento_id) return nota.estabelecimento_id;
    if (nota._path) {
      const parts = nota._path.split('/');
      const idx = parts.indexOf('estabelecimentos');
      if (idx >= 0 && parts.length > idx + 1) return parts[idx+1];
    }
    return 'desconhecido';
  };

  const getTotal = (item) => Number(item.totalFinal) || Number(item.total) || Number(item.valorFinal) || Number(item.valorTotal) || 0;

  const nfcesFiltradas = useMemo(() => {
    return nfces.filter(nota => {
      if (filterEstab !== 'todos') {
        const eId = getEstabId(nota);
        if (eId !== filterEstab) return false;
      }
      const txtMatch = (nota.id || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                       (nota.cliente?.nome || nota.clienteNome || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (!txtMatch) return false;
      return true;
    });
  }, [nfces, filterEstab, searchTerm]);

  // Cálculo das métricas gerais (KPIs Bento)
  const kpiStats = useMemo(() => {
    const totalNotas = nfcesFiltradas.length;
    const faturamentoFiscal = nfcesFiltradas.reduce((acc, n) => acc + getTotal(n), 0);
    const ticketFiscalMedio = totalNotas > 0 ? faturamentoFiscal / totalNotas : 0;
    
    let ultimaNotaData = null;
    if (totalNotas > 0) {
      const datas = nfcesFiltradas.map(n => n._dataCalculada).filter(Boolean);
      if (datas.length > 0) {
        ultimaNotaData = new Date(Math.max(...datas.map(d => d.getTime())));
      }
    }
    
    return {
      totalNotas,
      faturamentoFiscal,
      ticketFiscalMedio,
      ultimaNota: ultimaNotaData ? format(ultimaNotaData, "dd/MM 'às' HH:mm", { locale: ptBR }) : '--/--'
    };
  }, [nfcesFiltradas]);

  const handleBaixarPdf = async (nota) => {
    const idPlugNotas = nota.fiscal?.idPlugNotas;
    if (!idPlugNotas) {
      toast.error('NFC-e sem identificador PlugNotas. Não é possível baixar o PDF em tempo real.');
      return;
    }
    setLoadingAcao(nota.id);
    try {
      const res = await vendaService.baixarPdfNfce(idPlugNotas, nota.fiscal?.pdf);
      if (res && res.success) {
         // Window opens silently via API response logic
      } else {
        toast.warning(res.error || 'Falha ao baixar o PDF.');
      }
    } catch (err) {
      toast.error('Erro ao baixar PDF da NFC-e');
    } finally {
      setLoadingAcao(null);
    }
  };

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
      
      {/* Luzes neon de fundo */}
      <div className="absolute top-[-10%] left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-blue-500/10 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-purple-500/8 to-transparent blur-[120px] pointer-events-none" />

      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className={`max-w-[1400px] mx-auto backdrop-blur-xl border shadow-lg rounded-3xl h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all ${t.surface} ${t.border}`}>
        <div className="flex items-center gap-4">
          <button id="btn-back-master-dashboard" onClick={() => navigate('/master-dashboard')} className={`w-9 h-9 ${t.inputBg} hover:opacity-80 rounded-xl flex items-center justify-center transition-all`}>
            <FiArrowLeft className={`${t.text} text-sm`} />
          </button>
          <div className="hidden sm:block border-l border-slate-700/50 pl-4">
            <span className={`font-bold text-sm tracking-tight ${t.text}`}>Monitoramento Fiscal</span>
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
        
        {/* ─── HEADER & DATE RANGE FILTER ─── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6 px-2 relative z-30">
          <div>
            <h1 id="page-nfce-title" className={`text-4xl font-extrabold tracking-tight ${t.text}`}>Declarações Fiscais NFC-e</h1>
            <p className={`${t.textSecondary} text-sm mt-1 font-semibold`}>Acompanhamento em tempo real de notas fiscais de consumidor emitidas na rede.</p>
          </div>
          
          <div className={`p-2 rounded-2xl border shadow-sm flex items-center relative z-40 ${t.cardBg} ${t.border}`}>
            <DateRangeFilter
              activePreset={datePreset}
              dateRange={dateRange}
              onPresetChange={handleDatePresetChange}
              onRangeChange={handleDateRangeChange}
              onClear={handleDateClear}
            />
          </div>
        </div>

        {/* ─── METRICAS FISCAIS BENTO GRID ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          
          {/* Notas Emitidas */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${t.cardBg} rounded-[2rem] border ${t.border} p-8 shadow-sm flex flex-col justify-between hover:border-emerald-500/40 transition-all duration-300 relative overflow-hidden`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-r-full" />
            <div className="flex justify-between items-start mb-6">
               <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400"><FiFileText size={22} /></div>
               <p className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                 isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
               }`}>Emitidas</p>
            </div>
            <div>
               <p className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider mb-1`}>NFC-es Autorizadas</p>
               <p className={`text-3xl font-black tracking-tight ${t.text}`}>{kpiStats.totalNotas}</p>
            </div>
          </motion.div>

          {/* Faturamento Fiscalizado */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className={`${t.cardBg} rounded-[2rem] border ${t.border} p-8 shadow-sm flex flex-col justify-between hover:border-indigo-500/40 transition-all duration-300 relative overflow-hidden`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r-full" />
            <div className="flex justify-between items-start mb-6">
               <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400"><FiDollarSign size={22} /></div>
               <p className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                 isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-700'
               }`}>Volume</p>
            </div>
            <div>
               <p className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider mb-1`}>Faturamento Emitido</p>
               <p className={`text-3xl font-black tracking-tight ${t.text}`}>R$ {fmt(kpiStats.faturamentoFiscal)}</p>
            </div>
          </motion.div>

          {/* Ticket Medio Fiscal */}
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
                 isDark ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-50 text-teal-700'
               }`}>Ticket Médio</p>
            </div>
            <div>
               <p className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider mb-1`}>Ticket Médio Fiscal</p>
               <p className={`text-3xl font-black tracking-tight ${t.text}`}>R$ {fmt(kpiStats.ticketFiscalMedio)}</p>
            </div>
          </motion.div>

          {/* Ultima Transacao */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`${t.cardBg} rounded-[2rem] border ${t.border} p-8 shadow-sm flex flex-col justify-between hover:border-blue-500/40 transition-all duration-300 relative overflow-hidden`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full" />
            <div className="flex justify-between items-start mb-6">
               <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400"><FiClock size={22} /></div>
               <p className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                 isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700'
               }`}>Atualização</p>
            </div>
            <div>
               <p className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider mb-1`}>Última Emissão Concluída</p>
               <p className={`text-3xl font-black tracking-tight ${t.text}`}>{kpiStats.ultimaNota}</p>
            </div>
          </motion.div>
        </div>

        {/* ─── FILTROS PILL-STYLE ─── */}
        <div className={`p-4 rounded-3xl border mb-6 flex flex-col md:flex-row items-center justify-between gap-4 ${t.surface} ${t.border}`}>
            
            {/* Store Filter */}
            <div className={`relative w-full md:w-80 border rounded-2xl px-4 py-2.5 flex items-center shadow-sm ${t.inputBg} ${t.border}`}>
                <FiHome className={`${t.textSecondary} shrink-0`} size={15} />
                <select 
                    id="select-franchise-filter"
                    className={`bg-transparent border-none outline-none text-xs ml-3 w-full font-bold cursor-pointer appearance-none ${t.text}`}
                    value={filterEstab}
                    onChange={e => setFilterEstab(e.target.value)}
                >
                    <option value="todos" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Filtrar por todas as Franquias</option>
                    {estabList.map(e => (
                      <option key={e.id} value={e.id} className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>
                        {e.nome}
                      </option>
                    ))}
                </select>
                <div className={`pointer-events-none absolute right-4 text-xs ${t.textSecondary}`}>▼</div>
            </div>

            {/* General Search */}
            <div className={`relative w-full md:w-96 border rounded-2xl px-4 py-2.5 flex items-center shadow-sm ${t.inputBg} ${t.border}`}>
                <FiSearch className={`${t.textSecondary} shrink-0`} size={16} />
                <input 
                    id="input-nfce-search"
                    type="text" 
                    placeholder="Buscar Código da Venda ou Cliente..." 
                    className={`bg-transparent border-none outline-none text-xs ml-3 w-full font-semibold placeholder-gray-400 ${t.text}`}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        {/* ─── LISTA FISCAL BENTO STYLE ─── */}
        <div className={`rounded-3xl shadow-xl border overflow-hidden ${t.surface} ${t.border}`}>
            {loading ? (
                <div className="divide-y divide-slate-700/30">
                    {[1,2,3,4,5,6].map(i => <SkeletonRow key={i} isDark={isDark} />)}
                </div>
            ) : nfcesFiltradas.length === 0 ? (
                <div className="p-20 text-center">
                    <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 ${t.inputBg}`}>
                        <FiFileText className={`text-xl ${t.textSecondary}`} />
                    </div>
                    <h3 className={`text-lg font-bold ${t.text} mb-1`}>Nenhum Registro Fiscal</h3>
                    <p className={`text-xs font-semibold ${t.textSecondary}`}>Nenhuma nota fiscal foi emitida para a pesquisa ou período informados.</p>
                </div>
            ) : (
                <div className="divide-y divide-slate-700/20">
                    {nfcesFiltradas.map((nota, idx) => {
                        const dataCad = nota._dataCalculada ? format(nota._dataCalculada, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '';
                        const estabId = getEstabId(nota);
                        const realNome = estabMap[estabId] || estabId.toUpperCase();
                        const valNum = getTotal(nota);
                        
                        return (
                            <motion.div 
                                key={nota.id || idx} 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                                className={`p-6 flex flex-col lg:flex-row lg:items-center gap-6 transition-all ${t.surfaceHover}`}
                            >
                                {/* Indicator & Identifier */}
                                <div className="flex items-center gap-4 flex-[1.5] min-w-[200px]">
                                    <div className={`w-12 h-12 rounded-xl border flex flex-col items-center justify-center shrink-0 ${
                                      isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                    }`}>
                                        <FiCheckCircle className="text-sm mb-0.5" />
                                        <span className="text-[8px] font-black tracking-wider uppercase">AUT</span>
                                    </div>
                                    <div>
                                        <p className={`font-bold text-sm tracking-tight ${t.text}`}>#{nota.id.substring(0,8).toUpperCase()}</p>
                                        <p className={`text-[10px] font-semibold ${t.textSecondary} mt-0.5`}>{dataCad}</p>
                                    </div>
                                </div>

                                {/* Cliente & Valor */}
                                <div className="flex-1 min-w-[150px]">
                                    <p className={`text-sm font-bold ${t.text}`}>{nota.cliente?.nome || nota.clienteNome || 'Consumidor Não Identificado'}</p>
                                    <p className={`text-xs font-black ${t.textMuted} mt-0.5 tabular-nums`}>R$ {fmt(valNum)}</p>
                                </div>

                                {/* Franquia Emissora */}
                                <div className="flex-1 min-w-[150px]">
                                    <span className={`text-[10px] uppercase font-bold border px-3 py-1.5 rounded-full inline-block truncate max-w-[160px] ${t.inputBg} ${t.border} ${t.textSecondary}`} title={realNome}>
                                        {realNome}
                                    </span>
                                </div>

                                {/* Ações */}
                                <div className="flex-[0.5] min-w-[150px] lg:text-right mt-2 lg:mt-0 flex lg:justify-end">
                                    <button 
                                        onClick={() => handleBaixarPdf(nota)}
                                        disabled={loadingAcao === nota.id}
                                        className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 w-full md:w-auto active:scale-95 shadow-md hover:opacity-90"
                                    >
                                        {loadingAcao === nota.id ? (
                                          <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0"></div>
                                        ) : (
                                          <FiFileText size={13} />
                                        )}
                                        {loadingAcao === nota.id ? 'Baixando...' : 'Obter DANFE'}
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
        .tabular-nums { font-variant-numeric: tabular-nums; }
      `}</style>
    </div>
  );
}

export default MasterNfce;
