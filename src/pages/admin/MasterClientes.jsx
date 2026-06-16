import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collectionGroup, collection, getDocs, query, limit, doc, updateDoc } from 'firebase/firestore';
import { 
  FiArrowLeft, FiUsers, FiPhone, FiMail, FiClock, FiSearch, 
  FiSun, FiMoon, FiShield, FiTrendingUp, FiLogOut, FiActivity,
  FiChevronDown, FiAlertCircle, FiAward, FiEye, FiCheck, FiX, FiHome, FiMessageCircle
} from 'react-icons/fi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Skeleton Loader (Bento Style) ───
const SkeletonRow = ({ isDark }) => (
  <div className={`p-6 flex flex-col lg:flex-row lg:items-center gap-6 animate-pulse border-b ${isDark ? 'border-slate-800/60' : 'border-slate-100'}`}>
    <div className="w-14 h-14 rounded-2xl shrink-0 bg-slate-850"></div>
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-slate-800 rounded-lg w-40"></div>
      <div className="h-3 bg-slate-800 rounded-lg w-24"></div>
    </div>
    <div className="flex-1 space-y-2">
      <div className="h-6 bg-slate-800 rounded-full w-32"></div>
      <div className="h-6 bg-slate-800 rounded-full w-24"></div>
    </div>
    <div className="w-16 space-y-1">
      <div className="h-3 bg-slate-800 rounded-md w-12"></div>
      <div className="h-6 bg-slate-800 rounded-md w-8"></div>
    </div>
    <div className="flex-1 flex gap-1.5 lg:justify-end">
      <div className="h-6 bg-slate-800 rounded-full w-20"></div>
      <div className="h-6 bg-slate-800 rounded-full w-24"></div>
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
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'oldest' | 'nome_asc' | 'nome_desc'

  // Controle do Modal de Permissões
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminTargetUser, setAdminTargetUser] = useState(null);
  const [adminSelectedStores, setAdminSelectedStores] = useState([]);

  // Controle do Tema
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('dashboard_theme');
    return saved || 'dark';
  });

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

  // Sincroniza o tema entre abas do dashboard
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'dashboard_theme') {
        setTheme(e.newValue || 'dark');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('dashboard_theme', newTheme);
  };

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
      buttonBg: 'bg-slate-900/80 border-white/5 text-slate-350 hover:border-cyan-500/30 hover:text-white',
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
              dataCadastro: null,
              isRegistered: false
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
    let registrados = 0;
    let visitantes = 0;
    let novos = 0;
    
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

    clientes.forEach(c => {
      if (c.isRegistered) registrados += 1;
      else visitantes += 1;
      if (c.dataCadastro && c.dataCadastro >= trintaDiasAtras) novos += 1;
    });

    return { total, registrados, visitantes, novos };
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
    if (sortBy === 'recent') {
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

  // Tipo de cadastro dinâmico
  const getRegistrationBadge = (isRegistered) => {
    if (isRegistered) {
      return {
        label: 'Registrado',
        color: isDark
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
      };
    }
    return {
      label: 'Visitante',
      color: isDark
        ? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
        : 'bg-slate-50 text-slate-650 border-slate-200'
    };
  };

  const selectStyle = theme === 'dark'
      ? "bg-transparent border-none outline-none text-xs ml-3 w-full font-bold text-white cursor-pointer appearance-none"
      : "bg-transparent border-none outline-none text-xs ml-3 w-full font-bold text-stone-900 cursor-pointer appearance-none";

  if (authLoading) {
    return (
      <div className={`min-h-screen bg-[#080d19] flex items-center justify-center font-sans`}>
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 border-4 border-slate-800 rounded-full" />
            <div className="absolute inset-0 border-4 border-t-cyan-500 rounded-full animate-spin" />
          </div>
          <p className="text-xs font-black uppercase tracking-wider text-slate-400 font-space">Carregando Clientes...</p>
        </div>
      </div>
    );
  }

  if (!isMasterAdmin) {
    return (
      <div className={`min-h-screen ${t.bg} flex items-center justify-center p-10 text-center`}>
        <div className={`p-8 rounded-3xl border ${t.surface} ${t.border} max-w-sm`}>
          <FiAlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Acesso Negado</h2>
          <p className="text-sm mb-4">Esta área é restrita para administradores master do sistema.</p>
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
          <Link to="/master-dashboard" className={`p-2.5 rounded-xl border transition-all active:scale-95 ${t.buttonBg} ${t.border}`} title="Voltar ao Painel">
            <FiArrowLeft size={14} />
          </Link>
          <button onClick={toggleTheme} className={`p-2.5 rounded-xl border transition-all active:scale-95 ${t.buttonBg} ${t.border}`} title={theme === 'dark' ? "Mudar para tema claro" : "Mudar para tema escuro"}>
            {theme === 'dark' ? <FiSun size={14} className="text-amber-400" /> : <FiMoon size={14} />}
          </button>
          <div>
            <h1 className={`font-black text-sm tracking-tight font-bricolage ${t.text}`}>CRM</h1>
            <p className={`text-[11px] font-bold font-space ${t.textSecondary}`}>{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto relative z-10">
        
        {/* Title */}
        <div className="mb-8 px-2">
          <h1 className={`text-4xl font-black tracking-tight font-bricolage ${t.text}`}>Consumidores da Rede</h1>
          <p className={`${t.textSecondary} text-sm mt-1 font-medium`}>Base unificada de CRM. Encontramos <span className="font-bold text-cyan-400">{filt_clientes.length}</span> perfis de clientes.</p>
        </div>

        {/* ─── METRICAS KPI BENTO GRID ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          
          <div className={`border rounded-[2rem] p-6 shadow-sm relative overflow-hidden group transition-all duration-300 ${t.cardBg} ${t.border} ${t.surfaceHover}`}>
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-r-full" />
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-xl border ${theme==='dark' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600'}`}>
                <FiUsers size={18} />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted} font-bricolage`}>Base Geral</span>
            </div>
            <h3 className={`text-3xl font-black font-mono-jb tracking-tight ${t.text}`}>{kpiStats.total}</h3>
            <p className={`text-[10px] mt-1 uppercase tracking-wider font-bold ${t.textSecondary} font-space`}>Consumidores cadastrados</p>
          </div>

          <div className={`border rounded-[2rem] p-6 shadow-sm relative overflow-hidden group transition-all duration-300 ${t.cardBg} ${t.border} ${t.surfaceHover}`}>
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-purple-500 to-violet-650 rounded-r-full" />
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-xl border ${theme==='dark' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-purple-50 border-purple-200 text-purple-600'}`}>
                <FiShield size={18} />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted} font-bricolage`}>Registrados</span>
            </div>
            <h3 className={`text-3xl font-black font-mono-jb tracking-tight ${t.text}`}>{kpiStats.registrados}</h3>
            <p className={`text-[10px] mt-1 uppercase tracking-wider font-bold ${t.textSecondary} font-space`}>Contas ativas na plataforma</p>
          </div>

          <div className={`border rounded-[2rem] p-6 shadow-sm relative overflow-hidden group transition-all duration-300 ${t.cardBg} ${t.border} ${t.surfaceHover}`}>
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-400 to-orange-500 rounded-r-full" />
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-xl border ${theme==='dark' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
                <FiActivity size={18} />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted} font-bricolage`}>Visitantes</span>
            </div>
            <h3 className={`text-3xl font-black font-mono-jb tracking-tight ${t.text}`}>{kpiStats.visitantes}</h3>
            <p className={`text-[10px] mt-1 uppercase tracking-wider font-bold ${t.textSecondary} font-space`}>Compraram sem registro</p>
          </div>

          <div className={`border rounded-[2rem] p-6 shadow-sm relative overflow-hidden group transition-all duration-300 ${t.cardBg} ${t.border} ${t.surfaceHover}`}>
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-emerald-400 to-teal-500 rounded-r-full" />
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-xl border ${theme==='dark' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                <FiTrendingUp size={18} />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted} font-bricolage`}>Crescimento</span>
            </div>
            <h3 className={`text-3xl font-black font-mono-jb tracking-tight ${t.text}`}>{kpiStats.novos}</h3>
            <p className={`text-[10px] mt-1 uppercase tracking-wider font-bold ${t.textSecondary} font-space`}>Novos clientes (últimos 30d)</p>
          </div>

        </div>

        {/* ─── FILTROS PILL-STYLE ─── */}
        <div className={`p-4 rounded-3xl border mb-6 flex flex-col md:flex-row items-center justify-between gap-4 ${t.cardBg} ${t.border}`}>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              {/* Dropdown Franquia */}
              <div className={`relative w-full sm:w-64 border rounded-2xl px-4 py-2.5 flex items-center shadow-sm ${t.inputBg} ${t.border}`}>
                  <FiHome className={`${t.textSecondary} shrink-0`} size={14} />
                  <select 
                      className={selectStyle}
                      value={filterEstab}
                      onChange={e => setFilterEstab(e.target.value)}
                  >
                      <option value="todos" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Todas as Franquias</option>
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
                  <FiClock className={`${t.textSecondary} shrink-0`} size={14} />
                  <select 
                      className={selectStyle}
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value)}
                  >
                      <option value="recent" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Mais Recentes</option>
                      <option value="oldest" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Mais Antigos</option>
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
                    placeholder="Buscar nome, e-mail, telefone..." 
                    className={`bg-transparent border-none outline-none text-xs ml-3 w-full font-bold placeholder-slate-500 focus:outline-none ${t.text}`}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            
        </div>

        {/* ─── TABELA BENTO STYLE ─── */}
        <div className={`rounded-[2rem] border overflow-hidden ${t.cardBg} ${t.border}`}>
            {loading ? (
                <div className="divide-y divide-white/5">
                    {[1,2,3,4,5].map(i => <SkeletonRow key={i} isDark={isDark} />)}
                </div>
            ) : sortedClientes.length === 0 ? (
                <div className="p-20 text-center">
                    <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 ${t.inputBg}`}>
                        <FiSearch className={`text-xl ${t.textSecondary}`} />
                    </div>
                    <h3 className={`font-black text-base ${t.text} font-bricolage`}>Nenhum Consumidor Encontrado</h3>
                    <p className={`text-sm mt-1 ${t.textSecondary}`}>A busca ou filtros atuais não retornaram clientes.</p>
                </div>
            ) : (
                <div className="divide-y divide-white/5">
                    {sortedClientes.slice(0, 100).map((cli, i) => {
                        let dataCad = 'Sem data';
                        if (cli.dataCadastro) {
                            const d = new Date(cli.dataCadastro);
                            if (!isNaN(d.getTime())) dataCad = format(d, "dd/MM/yyyy", { locale: ptBR });
                        }
                        
                        const avatarGrad = getAvatarGradient(cli.nome);
                        const regBadge = getRegistrationBadge(cli.isRegistered);
                        
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
                                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${avatarGrad} flex items-center justify-center shadow-md shrink-0 font-black text-xl text-white font-bricolage`}>
                                        {cli.nome ? cli.nome.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                                            <span className={`font-black text-sm tracking-tight font-bricolage ${t.text} truncate`}>{cli.nome || 'Consumidor Não Registrado'}</span>
                                            
                                            {/* Badges de Acesso / Admin */}
                                            <div className="flex gap-1 shrink-0">
                                              {cli.isAdmin && (
                                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20" title="Administrador de Franquia">
                                                  <FiShield size={8} /> Admin
                                                </span>
                                              )}
                                              {cli.isRegistered && cli.userId && (
                                                  <button 
                                                      onClick={() => openAdminModal(cli)}
                                                      className={`text-[9px] uppercase tracking-wider font-black px-2.5 py-0.5 rounded-full border transition-all ${
                                                        cli.isAdmin 
                                                          ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' 
                                                          : `${t.buttonBg} ${t.border} ${t.textSecondary} hover:${t.text} hover:border-cyan-500/30`
                                                      }`}
                                                  >
                                                      {cli.isAdmin ? 'Gerenciar Acessos' : '+ Permitir Acessos'}
                                                  </button>
                                              )}
                                            </div>
                                        </div>
                                        <p className={`text-[10px] font-bold ${t.textSecondary} flex items-center gap-1.5 mt-1`}>
                                            <FiClock className="shrink-0 text-[11px] text-cyan-400" />
                                            <span>Membro desde {dataCad}</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Contato (Tel/Email) */}
                                <div className="flex-1 min-w-[200px] flex flex-col gap-1.5 items-start">
                                    <div className={`inline-flex items-center gap-2 text-[10px] font-black font-mono-jb px-3 py-1.5 rounded-full border ${t.inputBg} ${t.border} ${t.text}`}>
                                        <FiPhone className={`${t.textSecondary} text-[10px]`} />
                                        {cli.whatsapp || cli.telefone || 'Sem número'}
                                    </div>
                                    {cli.email && (
                                        <div className={`inline-flex items-center gap-2 text-[10px] font-bold px-3 py-1 rounded-full border truncate max-w-full ${t.inputBg} ${t.border} ${t.textSecondary}`}>
                                            <FiMail className={`${t.textSecondary} text-[10px] shrink-0`} />
                                            <span className="truncate">{cli.email}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Tipo de Cadastro */}
                                <div className="flex-1 min-w-[150px] flex flex-col items-start gap-1">
                                    <p className={`text-[9px] font-black uppercase tracking-wider ${t.textMuted}`}>Tipo de Cadastro</p>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${regBadge.color}`}>
                                        {regBadge.label}
                                    </span>
                                </div>

                                {/* Praças / Lojas Interagidas */}
                                <div className="flex-[2] min-w-[220px] lg:text-right mt-2 lg:mt-0">
                                    <p className={`text-[9px] font-black uppercase tracking-wider ${t.textMuted} mb-2 lg:mb-1`}>Praças Vinculadas</p>
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
               className={`rounded-[2rem] p-8 w-full max-w-md shadow-2xl border ${t.cardBg} ${t.border} relative overflow-hidden`}
             >
                <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />

                <h2 className={`text-2xl font-black font-bricolage ${t.text} mb-2 leading-tight`}>Acessos Administrativos</h2>
                <p className={`text-xs ${t.textSecondary} mb-6 font-bold`}>
                    Selecione quais franquias de hamburgueria o usuário <strong className={t.text}>{adminTargetUser.nome}</strong> pode governar no sistema.
                </p>
                
                <div className="max-h-60 overflow-y-auto space-y-2 mb-6 custom-scrollbar pr-2">
                   {estabList.map(e => {
                      const isSelected = adminSelectedStores.includes(e.id);
                      return (
                        <label 
                          key={e.id} 
                          className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-colors shadow-sm ${
                            isSelected 
                              ? (isDark ? 'border-cyan-500/40 bg-cyan-500/5 text-cyan-400' : 'border-[#ff6b35] bg-[#ff6b35]/5 text-[#ff6b35]') 
                              : `${t.inputBg} ${t.border} hover:opacity-85`
                          }`}
                        >
                           <span className={`font-bold text-xs ${isSelected ? (isDark ? 'text-cyan-300' : 'text-[#e85a2a]') : t.text}`}>{e.nome}</span>
                           <button
                             type="button"
                             onClick={(ev) => {
                                ev.preventDefault();
                                if(isSelected) setAdminSelectedStores(prev => prev.filter(id => id !== e.id));
                                else setAdminSelectedStores(prev => [...prev, e.id]);
                             }}
                             className={`p-1.5 rounded-lg border transition-all ${
                               isSelected 
                                 ? (isDark ? 'border-cyan-500 text-cyan-400 bg-cyan-500/15' : 'border-[#ff6b35] text-[#ff6b35] bg-[#ff6b35]/10') 
                                 : `${t.border} text-slate-500`
                             }`}
                           >
                             {isSelected ? <FiCheck size={14} /> : <div className="w-3.5 h-3.5" />}
                           </button>
                        </label>
                      );
                   })}
                   {estabList.length === 0 && <p className="text-sm text-gray-500 text-center font-bold">Nenhuma franquia ativa no sistema.</p>}
                </div>

                <div className="flex gap-3 pt-2">
                   <button 
                     onClick={() => setAdminModalOpen(false)} 
                     className={`flex-1 py-3.5 rounded-2xl font-black text-xs ${t.buttonBg} ${t.border} ${t.textSecondary} hover:${t.text} hover:opacity-80 transition-all`}
                   >
                     Cancelar
                   </button>
                   <button 
                     onClick={handleSaveAdminAccess} 
                     className={`flex-1 py-3.5 rounded-2xl font-black text-xs text-white transition-all active:scale-95 shadow-lg ${
                       theme === 'dark' ? 'bg-cyan-500 hover:bg-cyan-600 shadow-cyan-500/15' : 'bg-stone-900 hover:bg-stone-850'
                     }`}
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
