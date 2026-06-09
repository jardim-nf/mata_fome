import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collectionGroup, collection, getDocs, query, limit, doc, updateDoc } from 'firebase/firestore';
import { 
  FiArrowLeft, FiUsers, FiPhone, FiMail, FiClock, FiSearch, 
  FiSun, FiMoon, FiShield, FiTrendingUp, FiLogOut, FiActivity,
  FiChevronDown, FiAlertCircle, FiAward, FiEye, FiCheck, FiX, FiSquare, FiCheckSquare, FiHome
} from 'react-icons/fi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Skeleton Loader (Bento Style) ───
const SkeletonRow = ({ isDark }) => (
  <div className={`p-6 flex flex-col lg:flex-row lg:items-center gap-6 animate-pulse border-b ${isDark ? 'border-slate-800/60' : 'border-slate-100'}`}>
    <div className={`w-14 h-14 rounded-2xl shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    <div className="flex-1 space-y-2">
      <div className={`h-4 rounded-lg w-40 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
      <div className={`h-3 rounded-lg w-24 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    </div>
    <div className="flex-1 space-y-2">
      <div className={`h-6 rounded-full w-32 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
      <div className={`h-6 rounded-full w-24 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    </div>
    <div className="w-16 space-y-1">
      <div className={`h-3 rounded-md w-12 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
      <div className={`h-6 rounded-md w-8 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    </div>
    <div className="flex-1 flex gap-1.5 lg:justify-end">
      <div className={`h-6 rounded-full w-20 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
      <div className={`h-6 rounded-full w-24 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    </div>
  </div>
);

function MasterClientes() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [estabMap, setEstabMap] = useState({});
  const [estabList, setEstabList] = useState([]);
  const [filterEstab, setFilterEstab] = useState('todos');
  const [sortBy, setSortBy] = useState('engajamento_desc'); // 'engajamento_desc' | 'engajamento_asc' | 'recent' | 'oldest' | 'nome_asc' | 'nome_desc'

  // Controle do Modal de Permissões
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminTargetUser, setAdminTargetUser] = useState(null);
  const [adminSelectedStores, setAdminSelectedStores] = useState([]);

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
      gradient: 'from-blue-555 to-purple-650',
      cardBg: 'bg-white/70 backdrop-blur-md',
      inputBg: 'bg-slate-100/50',
    }
  };

  const t = themeClasses[theme];
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return;
    
    const fetchClientes = async () => {
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

        // Query pedidos directly
        const qPed = query(collectionGroup(db, 'pedidos'), limit(1000));
        const [usersSnap, snap] = await Promise.all([
           getDocs(collection(db, 'usuarios')),
           getDocs(qPed)
        ]);

        const mapByPhone = {};

        // 1. Popular com usuários registrados
        usersSnap.docs.forEach(d => {
           const u = d.data();
           const rawPhone = u.telefone || '';
           const phone = rawPhone.replace(/\D/g, '') || d.id;

           mapByPhone[phone] = {
             userId: d.id,
             nome: u.nome || u.displayName || 'Não Registrado',
             whatsapp: rawPhone || 'Sem número',
             email: u.email || '',
             lojas: new Set(['App Geral (Web)']),
             pedidosAcumulados: 0,
             dataCadastro: u.createdAt?.toDate ? u.createdAt.toDate() : (u.createdAt ? new Date(u.createdAt) : new Date()),
             isAdmin: !!(u.isAdmin || u.isMasterAdmin),
             estabelecimentosAdmin: u.estabelecimentosGerenciados || [],
             isRegistered: true
           };
        });

        // 2. Popular/Atualizar com base nos pedidos
        let data = snap.docs.map(d => ({ id: d.id, ...d.data(), _path: d.ref.path }));

        data.forEach(p => {
          const cli = p.cliente || {};
          const rawPhone = cli.telefone || p.clienteTelefone || p.telefone || '';
          const phone = rawPhone.replace(/\D/g, '') || 'Sem número';
          
          if (!mapByPhone[phone]) {
            mapByPhone[phone] = {
              nome: cli.nome || p.nome || 'Não Registrado',
              whatsapp: rawPhone || 'Sem número',
              email: cli.email || p.email || '',
              lojas: new Set(),
              estabelecimentosAdmin: [],
              pedidosAcumulados: 0,
              dataCadastro: null
            };
          }
          
          let estabId = 'desconhecido';
          if (p._path) {
            const parts = p._path.split('/');
            const idx = parts.indexOf('estabelecimentos');
            if (idx >= 0 && parts.length > idx + 1) estabId = parts[idx+1];
          }
          if (estabId && estabId !== 'desconhecido') {
             mapByPhone[phone].lojas.add(estabId);
          }
          
          mapByPhone[phone].pedidosAcumulados += 1;
          
          if (!mapByPhone[phone].nome || mapByPhone[phone].nome === 'Não Registrado') {
             if (cli.nome || p.nome) mapByPhone[phone].nome = cli.nome || p.nome;
          }

          if (!mapByPhone[phone].email) {
             if (cli.email || p.email) mapByPhone[phone].email = cli.email || p.email;
          }

          const rawDate = p.createdAt || p.dataPedido || null;
          let currentData = null;
          if (rawDate) {
              if (typeof rawDate.toDate === 'function') currentData = rawDate.toDate();
              else if (rawDate instanceof Date) currentData = rawDate;
              else currentData = new Date(rawDate);
          }

          if (currentData && !isNaN(currentData.getTime())) {
              const currentTimestamp = currentData.getTime();
              const existingTimestamp = mapByPhone[phone].dataCadastro ? new Date(mapByPhone[phone].dataCadastro).getTime() : Infinity;
              if (currentTimestamp < existingTimestamp) {
                  mapByPhone[phone].dataCadastro = currentData;
              }
          }
        });

        let merged = Object.values(mapByPhone).map(c => {
          let lojasArr = Array.from(c.lojas);
          if (lojasArr.length === 0) lojasArr = ['desconhecido'];
          return { ...c, lojasArray: lojasArr };
        });

        setClientes(merged);
      } catch (err) {
        console.error('Erro ao buscar clientes globais', err);
        toast.error('Erro ao sincronizar consumidores.');
      } finally {
        setLoading(false);
      }
    };
    fetchClientes();
  }, [currentUser, isMasterAdmin]);

  const openAdminModal = (cli) => {
    setAdminTargetUser(cli);
    setAdminSelectedStores(cli.estabelecimentosAdmin || []);
    setAdminModalOpen(true);
  };

  const handleSaveAdminAccess = async () => {
    if (!adminTargetUser) return;
    try {
      const hasAccess = adminSelectedStores.length > 0;
      await updateDoc(doc(db, 'usuarios', adminTargetUser.userId), {
          isAdmin: hasAccess,
          estabelecimentosGerenciados: adminSelectedStores
      });
      
      setClientes(prev => prev.map(c => {
         if (c.userId === adminTargetUser.userId) {
            return { ...c, isAdmin: hasAccess, estabelecimentosAdmin: adminSelectedStores };
         }
         return c;
      }));
      
      toast.success('Permissões de acesso atualizadas!');
      setAdminModalOpen(false);
    } catch(err) {
      console.error(err);
      toast.error('Erro ao salvar acessos administrativos.');
    }
  };

  // Cálculo das métricas gerais (KPIs)
  const kpiStats = useMemo(() => {
    const total = clientes.length;
    let vip = 0;
    let novos = 0;
    let totalPedidos = 0;
    
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

    clientes.forEach(c => {
      totalPedidos += c.pedidosAcumulados;
      if (c.pedidosAcumulados >= 5) vip += 1;
      if (c.dataCadastro && c.dataCadastro >= trintaDiasAtras) novos += 1;
    });

    return { total, vip, novos, totalPedidos };
  }, [clientes]);

  // Filtro inteligente
  const filt_clientes = useMemo(() => {
    return clientes.filter(c => {
      const textMatch = (c.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (c.email || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (c.whatsapp || c.telefone || '').includes(searchTerm);
      if (!textMatch) return false;
      if (filterEstab !== 'todos' && !Array.from(c.lojas || []).includes(filterEstab)) return false;
      return true;
    });
  }, [clientes, searchTerm, filterEstab]);

  // Ordenação inteligente
  const sortedClientes = useMemo(() => {
    let result = [...filt_clientes];
    if (sortBy === 'engajamento_desc') {
      result.sort((a, b) => b.pedidosAcumulados - a.pedidosAcumulados);
    } else if (sortBy === 'engajamento_asc') {
      result.sort((a, b) => a.pedidosAcumulados - b.pedidosAcumulados);
    } else if (sortBy === 'recent') {
      result.sort((a, b) => {
        const da = a.dataCadastro ? new Date(a.dataCadastro).getTime() : 0;
        const db = b.dataCadastro ? new Date(b.dataCadastro).getTime() : 0;
        return db - da;
      });
    } else if (sortBy === 'oldest') {
      result.sort((a, b) => {
        const da = a.dataCadastro ? new Date(a.dataCadastro).getTime() : Infinity;
        const db = b.dataCadastro ? new Date(b.dataCadastro).getTime() : Infinity;
        return da - db;
      });
    } else if (sortBy === 'nome_asc') {
      result.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    } else if (sortBy === 'nome_desc') {
      result.sort((a, b) => (b.nome || '').localeCompare(a.nome || ''));
    }
    
    // Admins continuam no topo para facilitar a governança, a menos que uma ordenação estrita seja necessária.
    // Vamos manter ordenação pura para que o usuário veja exatamente o que pediu.
    return result;
  }, [filt_clientes, sortBy]);

  // Cores de iniciais dinâmicas
  const getAvatarGradient = (nome) => {
    const char = nome ? nome.charAt(0).toUpperCase() : '?';
    const code = char.charCodeAt(0);
    if (code < 70) return 'from-blue-500 to-cyan-500';
    if (code < 78) return 'from-purple-500 to-pink-500';
    if (code < 85) return 'from-emerald-500 to-teal-500';
    return 'from-amber-500 to-orange-500';
  };

  // Nível de fidelidade dinâmico
  const getFidelityLevel = (pedidosAcumulados) => {
    if (pedidosAcumulados >= 10) {
      return { 
        label: 'VIP Ouro', 
        color: isDark 
          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
          : 'bg-amber-50 text-amber-700 border-amber-200' 
      };
    }
    if (pedidosAcumulados >= 5) {
      return { 
        label: 'VIP Prata', 
        color: isDark 
          ? 'bg-slate-400/10 text-slate-300 border-slate-400/20' 
          : 'bg-slate-50 text-slate-650 border-slate-200' 
      };
    }
    if (pedidosAcumulados >= 1) {
      return { 
        label: 'Bronze', 
        color: isDark 
          ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' 
          : 'bg-orange-50 text-orange-700 border-orange-200' 
      };
    }
    return { 
      label: 'Novo', 
      color: isDark 
        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
        : 'bg-blue-50 text-blue-600 border-blue-100' 
    };
  };

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
      
      {/* Círculos luminosos decorativos de fundo */}
      <div className="absolute top-[-10%] left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-blue-500/10 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-purple-500/8 to-transparent blur-[120px] pointer-events-none" />

      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className={`max-w-[1400px] mx-auto backdrop-blur-xl border shadow-lg rounded-3xl h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all ${t.surface} ${t.border}`}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/master-dashboard')} className={`w-9 h-9 ${t.inputBg} hover:opacity-80 rounded-xl flex items-center justify-center transition-all`}>
            <FiArrowLeft className={`${t.text} text-sm`} />
          </button>
          <div className="hidden sm:block border-l border-slate-700/50 pl-4">
            <h1 className={`font-bold text-sm tracking-tight ${t.text}`}>Hub de CRM Geral</h1>
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
        
        {/* Title */}
        <div className="mb-8 px-2">
          <h1 className={`text-4xl font-extrabold tracking-tight ${t.text}`}>Consumidores da Rede</h1>
          <p className={`${t.textSecondary} text-sm mt-1 font-semibold`}>Base unificada de CRM. Encontramos <span className={`${t.text} font-black`}>{sortedClientes.length}</span> perfis de clientes.</p>
        </div>

        {/* ─── METRICAS KPI BENTO GRID ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          
          {/* Card 1 */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${t.cardBg} rounded-2xl p-6 border ${t.border} hover:border-blue-500/40 transition-all duration-300 relative overflow-hidden`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full" />
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
                <FiUsers size={18} />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${t.textMuted}`}>Base Geral</span>
            </div>
            <h3 className={`text-3xl font-black ${t.text} mb-1`}>{kpiStats.total}</h3>
            <p className={`text-xs ${t.textSecondary} font-semibold`}>Consumidores cadastrados</p>
          </motion.div>

          {/* Card 2 */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className={`${t.cardBg} rounded-2xl p-6 border ${t.border} hover:border-amber-500/40 transition-all duration-300 relative overflow-hidden`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-r-full" />
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400">
                <FiAward size={18} />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${t.textMuted}`}>Clientes Fidelizados</span>
            </div>
            <h3 className={`text-3xl font-black ${t.text} mb-1`}>{kpiStats.vip}</h3>
            <p className={`text-xs ${t.textSecondary} font-semibold`}>VIPs com 5+ compras</p>
          </motion.div>

          {/* Card 3 */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`${t.cardBg} rounded-2xl p-6 border ${t.border} hover:border-emerald-500/40 transition-all duration-300 relative overflow-hidden`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-r-full" />
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
                <FiTrendingUp size={18} />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${t.textMuted}`}>Crescimento</span>
            </div>
            <h3 className={`text-3xl font-black ${t.text} mb-1`}>{kpiStats.novos}</h3>
            <p className={`text-xs ${t.textSecondary} font-semibold`}>Novos clientes (últimos 30d)</p>
          </motion.div>

          {/* Card 4 */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`${t.cardBg} rounded-2xl p-6 border ${t.border} hover:border-purple-500/40 transition-all duration-300 relative overflow-hidden`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500 rounded-r-full" />
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-400">
                <FiActivity size={18} />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${t.textMuted}`}>Pedidos Totais</span>
            </div>
            <h3 className={`text-3xl font-black ${t.text} mb-1`}>{kpiStats.totalPedidos}</h3>
            <p className={`text-xs ${t.textSecondary} font-semibold`}>Pedidos acumulados</p>
          </motion.div>

        </div>

        {/* ─── FILTROS PILL-STYLE ─── */}
        <div className={`p-4 rounded-3xl border mb-6 flex flex-col md:flex-row items-center justify-between gap-4 ${t.surface} ${t.border}`}>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              {/* Dropdown Franquia */}
              <div className={`relative w-full sm:w-64 border rounded-2xl px-4 py-2.5 flex items-center shadow-sm ${t.inputBg} ${t.border}`}>
                  <FiHome className={`${t.textSecondary} shrink-0`} size={14} />
                  <select 
                      className="bg-transparent border-none outline-none text-xs ml-3 w-full font-bold text-[#1D1D1F] dark:text-slate-100 cursor-pointer appearance-none"
                      value={filterEstab}
                      onChange={e => setFilterEstab(e.target.value)}
                  >
                      <option value="todos" className={isDark ? 'bg-slate-905 text-slate-100' : 'bg-white text-slate-900'}>Todas as Franquias</option>
                      {estabList.map(e => (
                        <option key={e.id} value={e.id} className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>
                          {e.nome}
                        </option>
                      ))}
                  </select>
                  <FiChevronDown className={`${t.textSecondary} pointer-events-none absolute right-4 text-xs`} />
              </div>

              {/* Dropdown Ordenacao */}
              <div className={`relative w-full sm:w-60 border rounded-2xl px-4 py-2.5 flex items-center shadow-sm ${t.inputBg} ${t.border}`}>
                  <FiActivity className={`${t.textSecondary} shrink-0`} size={14} />
                  <select 
                      className="bg-transparent border-none outline-none text-xs ml-3 w-full font-bold text-[#1D1D1F] dark:text-slate-100 cursor-pointer appearance-none"
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value)}
                  >
                      <option value="engajamento_desc" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Mais Engajados (Maior → Menor)</option>
                      <option value="engajamento_asc" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Menos Engajados (Menor → Maior)</option>
                      <option value="recent" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Cadastro Mais Recente</option>
                      <option value="oldest" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Cadastro Mais Antigo</option>
                      <option value="nome_asc" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Nome (A → Z)</option>
                      <option value="nome_desc" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Nome (Z → A)</option>
                  </select>
                  <FiChevronDown className={`${t.textSecondary} pointer-events-none absolute right-4 text-xs`} />
              </div>
            </div>

            {/* Barra de Busca Geral */}
            <div className={`relative w-full md:w-80 border rounded-2xl px-4 py-2.5 flex items-center shadow-sm ${t.inputBg} ${t.border}`}>
                <FiSearch className={`${t.textSecondary} shrink-0`} size={15} />
                <input 
                    type="text" 
                    placeholder="Buscar nome, e-mail ou telefone..." 
                    className={`bg-transparent border-none outline-none text-xs ml-3 w-full font-semibold placeholder-gray-400 ${t.text}`}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            
        </div>

        {/* ─── TABELA BENTO STYLE ─── */}
        <div className={`rounded-3xl shadow-xl border overflow-hidden ${t.surface} ${t.border}`}>
            {loading ? (
                <div className="divide-y divide-slate-800/40">
                    {[1,2,3,4,5].map(i => <SkeletonRow key={i} isDark={isDark} />)}
                </div>
            ) : sortedClientes.length === 0 ? (
                <div className="p-20 text-center">
                    <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 ${t.inputBg}`}>
                        <FiSearch className={`text-xl ${t.textSecondary}`} />
                    </div>
                    <h3 className={`text-lg font-bold ${t.text} mb-1`}>Nenhum Consumidor Encontrado</h3>
                    <p className={`text-xs font-semibold ${t.textSecondary}`}>A busca ou filtros atuais não retornaram clientes.</p>
                </div>
            ) : (
                <div className="divide-y divide-slate-700/30">
                    {sortedClientes.slice(0, 100).map((cli, i) => {
                        let dataCad = 'Sem data';
                        if (cli.dataCadastro) {
                            const d = new Date(cli.dataCadastro);
                            if (!isNaN(d.getTime())) dataCad = format(d, "dd/MM/yyyy", { locale: ptBR });
                        }
                        
                        const avatarGrad = getAvatarGradient(cli.nome);
                        const fidelity = getFidelityLevel(cli.pedidosAcumulados);
                        
                        return (
                            <motion.div 
                              key={cli.userId || cli.whatsapp || i}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: Math.min(i * 0.02, 0.3) }}
                              className={`p-6 flex flex-col lg:flex-row lg:items-center gap-6 transition-all ${t.surfaceHover}`}
                            >
                                {/* Identificacao & Avatar */}
                                <div className="flex items-center gap-4 flex-[2] min-w-[240px]">
                                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${avatarGrad} flex items-center justify-center shadow-md shrink-0 font-extrabold text-xl`}>
                                        {cli.nome ? cli.nome.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <div className="min-w-0">
                                        <div className={`font-bold text-base ${t.text} flex flex-wrap items-center gap-2 min-w-0`}>
                                            <span className="truncate">{cli.nome || 'Consumidor Não Registrado'}</span>
                                            
                                            {/* Badges de Acesso / Admin */}
                                            <div className="flex gap-1 shrink-0">
                                              {cli.isAdmin && (
                                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/20" title="Administrador de Franquia">
                                                  <FiShield size={8} /> Admin
                                                </span>
                                              )}
                                              {cli.isRegistered && cli.userId && (
                                                  <button 
                                                      onClick={() => openAdminModal(cli)}
                                                      className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full border transition-all ${
                                                        cli.isAdmin 
                                                          ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' 
                                                          : `${t.inputBg} ${t.border} ${t.textSecondary} hover:${t.text} hover:border-blue-500/50`
                                                      }`}
                                                  >
                                                      {cli.isAdmin ? 'Acessos' : '+ Permitir Acessos'}
                                                  </button>
                                              )}
                                            </div>
                                        </div>
                                        <p className={`text-xs font-semibold ${t.textSecondary} flex items-center gap-1.5 mt-1`}>
                                            <FiClock className="shrink-0 text-[11px]" />
                                            <span>Membro desde {dataCad}</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Contato (Tel/Email) */}
                                <div className="flex-1 min-w-[200px] flex flex-col gap-1.5 items-start">
                                    <div className={`inline-flex items-center gap-2 text-[11px] font-bold px-3 py-1 rounded-full border ${t.inputBg} ${t.border} ${t.text}`}>
                                        <FiPhone className={`${t.textSecondary} text-[10px]`} />
                                        {cli.whatsapp || cli.telefone || 'Sem número'}
                                    </div>
                                    {cli.email && (
                                        <div className={`inline-flex items-center gap-2 text-[11px] font-semibold px-3 py-1 rounded-full border truncate max-w-full ${t.inputBg} ${t.border} ${t.textSecondary}`}>
                                            <FiMail className={`${t.textSecondary} text-[10px] shrink-0`} />
                                            <span className="truncate">{cli.email}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Fidelidade (Badge Ouro/Prata/Bronze) */}
                                <div className="flex-1 min-w-[120px] flex flex-col items-start gap-1">
                                    <p className={`text-[9px] font-bold uppercase tracking-wider ${t.textMuted}`}>Fidelidade</p>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${fidelity.color}`}>
                                        {fidelity.label}
                                    </span>
                                </div>

                                {/* Pedidos Acumulados */}
                                <div className="w-24 text-left lg:text-center shrink-0">
                                    <p className={`text-[9px] font-bold uppercase tracking-wider ${t.textMuted} mb-1`}>Pedidos</p>
                                    <p className={`font-black text-2xl tracking-tight ${t.text}`}>{cli.pedidosAcumulados}</p>
                                </div>

                                {/* Praças / Lojas Interagidas */}
                                <div className="flex-[2] min-w-[220px] lg:text-right mt-2 lg:mt-0">
                                    <p className={`text-[9px] font-bold uppercase tracking-wider ${t.textMuted} mb-2 lg:mb-1`}>Praças Vinculadas</p>
                                    <div className="flex flex-wrap lg:justify-end gap-1.5">
                                        {cli.lojasArray.map(l => {
                                            const realName = estabMap[l] || l;
                                            return (
                                                <span 
                                                  key={l} 
                                                  className={`text-[9px] font-bold px-2.5 py-1 rounded-full border truncate max-w-[120px] ${t.inputBg} ${t.border} ${t.textSecondary}`} 
                                                  title={realName}
                                                >
                                                    {realName}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
      </main>

      {/* ─── MODAL DE CONFIGURAÇÃO DE ADMIN ─── */}
      <AnimatePresence>
        {adminModalOpen && adminTargetUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className={`rounded-[2rem] p-8 w-full max-w-md shadow-2xl border ${t.surface} ${t.border} relative overflow-hidden`}
             >
                <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />

                <h2 className={`text-2xl font-black ${t.text} mb-2 leading-tight`}>Acessos Administrativos</h2>
                <p className={`text-xs ${t.textSecondary} mb-6 font-semibold`}>
                    Selecione quais franquias de hamburgueria o usuário <strong>{adminTargetUser.nome}</strong> pode governar no sistema.
                </p>
                
                <div className="max-h-60 overflow-y-auto space-y-2 mb-6 custom-scrollbar pr-2">
                   {estabList.map(e => {
                      const isSelected = adminSelectedStores.includes(e.id);
                      return (
                        <label 
                          key={e.id} 
                          className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-colors shadow-sm ${
                            isSelected 
                              ? (isDark ? 'border-blue-500/40 bg-blue-500/5 text-blue-400' : 'border-blue-300 bg-blue-50 text-blue-800') 
                              : `${t.inputBg} ${t.border} hover:opacity-85`
                          }`}
                        >
                           <button
                             type="button"
                             onClick={(ev) => {
                               ev.preventDefault();
                               if(isSelected) setAdminSelectedStores(prev => prev.filter(id => id !== e.id));
                               else setAdminSelectedStores(prev => [...prev, e.id]);
                             }}
                             className={`p-1 rounded-md border ${isSelected ? 'border-blue-500 text-blue-400 bg-blue-500/10' : `${t.border} text-slate-500`}`}
                           >
                             {isSelected ? <FiCheck size={14} /> : <div className="w-3.5 h-3.5" />}
                           </button>
                           <span className={`font-semibold text-sm ${isSelected ? (isDark ? 'text-blue-300' : 'text-blue-800') : t.text}`}>{e.nome}</span>
                        </label>
                      );
                   })}
                   {estabList.length === 0 && <p className="text-sm text-gray-500 text-center font-bold">Nenhuma franquia ativa no sistema.</p>}
                </div>

                <div className="flex gap-3 pt-2">
                   <button 
                     onClick={() => setAdminModalOpen(false)} 
                     className={`flex-1 py-3.5 rounded-2xl font-bold text-xs ${t.inputBg} ${t.border} ${t.textSecondary} hover:${t.text} hover:opacity-80 transition-all`}
                   >
                     Cancelar
                   </button>
                   <button 
                     onClick={handleSaveAdminAccess} 
                     className="flex-1 py-3.5 rounded-2xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-lg"
                   >
                     Salvar Permissões
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MasterClientes;
