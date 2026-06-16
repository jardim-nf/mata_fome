import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, orderBy, where, getDocs, or } from 'firebase/firestore'; 
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger'; 
import { 
  FiArrowLeft, FiPlus, FiEdit3, FiTrash2, FiPower, FiCheck,
  FiRefreshCw, FiHome, FiShield, FiUser, FiUsers, FiCheckCircle, FiActivity,
  FiSearch, FiLogOut, FiSun, FiMoon, FiAlertCircle
} from 'react-icons/fi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';

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
        <h3 className="text-base font-black tracking-wider uppercase font-bricolage mb-1.5 text-white">
          Iniciando Ambiente
        </h3>
        <p className="text-xs font-bold text-slate-400">
          Carregando privilégios e acessos...
          <span className="block mt-1 text-[10px] text-slate-500 animate-pulse">Sincronizando infraestrutura de segurança</span>
        </p>
      </div>
    </div>
  </div>
);

const SkeletonRow = ({ themeClass }) => (
  <div className={`p-6 rounded-[2rem] border animate-pulse flex flex-col gap-4 ${themeClass.cardBg} ${themeClass.border} shadow-md`}>
    <div className="flex justify-between items-start">
        <div className={`w-12 h-12 rounded-[1rem] border ${themeClass.inputBg} ${themeClass.border}`}></div>
        <div className={`w-16 h-6 rounded-full ${themeClass.inputBg}`}></div>
    </div>
    <div className="space-y-2">
        <div className={`h-4 rounded-lg w-32 ${themeClass.inputBg}`}></div>
        <div className={`h-3 rounded-lg w-48 ${themeClass.inputBg}`}></div>
    </div>
    <div className={`pt-4 border-t mt-2 flex justify-between ${themeClass.border}`}>
        <div className={`h-4 rounded-lg w-20 ${themeClass.inputBg}`}></div>
        <div className={`h-6 rounded-lg w-16 ${themeClass.inputBg}`}></div>
    </div>
  </div>
);

function ListarUsuariosMaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, isMasterAdmin, loading: authLoading, logout, reloadUserData } = useAuth();

  const [usuarios, setUsuarios] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState('');
  const [estabelecimentosMap, setEstabelecimentosMap] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [unsubscribe, setUnsubscribe] = useState(null);

  // Sync theme with localStorage
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('dashboard_theme');
    return saved || 'dark';
  });

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('dashboard_theme', newTheme);
  };

  // SEO Page Title
  useEffect(() => {
    document.title = "IdeaFood - Gestão de Acessos & Usuários";
  }, []);

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

  useEffect(() => {
    if (!authLoading && (!currentUser || !isMasterAdmin)) navigate('/master-dashboard');
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get('refresh') === 'true') { handleRefreshUsers(); navigate('/master/usuarios', { replace: true }); }
  }, [location.search, navigate]);

  useEffect(() => {
    const fetchEstabelecimentos = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'estabelecimentos'));
        const map = {};
        snapshot.forEach(doc => { map[doc.id] = doc.data().nome; });
        setEstabelecimentosMap(map);
      } catch (err) { console.error(err); }
    };
    if (isMasterAdmin) fetchEstabelecimentos();
  }, [isMasterAdmin]);

  useEffect(() => {
    if (!isMasterAdmin || !currentUser) { setLoadingUsers(false); return; }
    setLoadingUsers(true);
    let baseQueryRef = collection(db, 'usuarios');
    let queryConstraints = [];

    if (filterRole === 'isAdmin') {
      queryConstraints.push(where('isAdmin', '==', true));
    } else if (filterRole === 'isMasterAdmin') {
      queryConstraints.push(where('isMasterAdmin', '==', true));
    } else {
      // Por padrão, traz apenas masters ou admins (excluindo clientes comuns)
      queryConstraints.push(or(where('isAdmin', '==', true), where('isMasterAdmin', '==', true)));
    }
    
    if (filterStatus === 'ativo') queryConstraints.push(where('ativo', '==', true));
    else if (filterStatus === 'inativo') queryConstraints.push(where('ativo', '==', false));

    let activeUnsub = null;

    try {
      const q = query(baseQueryRef, ...queryConstraints, orderBy('nome', 'asc'));
      activeUnsub = onSnapshot(q, (snap) => {
        setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoadingUsers(false);
      }, (err) => {
        console.warn("Query ordenada com or falhou. Tentando fallback sem ordenação...", err);
        try {
          const qFallback = query(baseQueryRef, ...queryConstraints);
          if (activeUnsub) activeUnsub();
          
          activeUnsub = onSnapshot(qFallback, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
            setUsuarios(list);
            setLoadingUsers(false);
          }, (errFallback) => {
            console.error("Erro na query de fallback:", errFallback);
            setError("Erro ao carregar infraestrutura de segurança.");
            setLoadingUsers(false);
          });
          setUnsubscribe(() => activeUnsub);
        } catch (e) {
          console.error(e);
          setError("Erro ao carregar infraestrutura de segurança.");
          setLoadingUsers(false);
        }
      });
      setUnsubscribe(() => activeUnsub);
    } catch (errOuter) {
      console.error(errOuter);
      setLoadingUsers(false);
    }

    return () => {
      if (activeUnsub) activeUnsub();
    };
  }, [isMasterAdmin, currentUser, filterRole, filterStatus]);

  const handleRefreshUsers = useCallback(() => {
    setSearchTerm(''); setFilterRole('todos'); setFilterStatus('todos');
    if (unsubscribe) unsubscribe();
    setLoadingUsers(true);
    if (reloadUserData) reloadUserData();
    setTimeout(() => window.location.reload(), 800);
  }, [unsubscribe, reloadUserData]);

  const filteredUsers = useMemo(() => {
    return usuarios.filter(user => {
      const term = searchTerm.toLowerCase();
      return (user.nome && user.nome.toLowerCase().includes(term)) || 
             (user.email && user.email.toLowerCase().includes(term)) ||
             (user.telefone && user.telefone.toLowerCase().includes(term));
    });
  }, [usuarios, searchTerm]);

  const stats = useMemo(() => ({
    total: usuarios.length,
    admins: usuarios.filter(u => u.isAdmin && !u.isMasterAdmin).length,
    active: usuarios.filter(u => u.ativo !== false).length,
    masters: usuarios.filter(u => u.isMasterAdmin).length,
  }), [usuarios]);

  const toggleUserAtivo = async (userId, currentStatus, userName) => {
    if (currentUser.uid === userId) return toast.error('Não pode alterar seu próprio status.');
    try {
      await updateDoc(doc(db, 'usuarios', userId), { ativo: !currentStatus, dataAtualizacao: new Date() });
      auditLogger(currentStatus ? 'USUARIO_DESATIVADO' : 'USUARIO_ATIVADO', { uid: currentUser.uid, email: currentUser.email }, { id: userId, name: userName });
      toast.success(`Status de ${userName} alterado.`);
    } catch (error) { toast.error("Erro ao alterar status."); }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (currentUser.uid === userId) return toast.error('Não pode deletar sua própria conta.');
    if (window.confirm(`ATENÇÃO: Deletar "${userName}" é irreversível. Continuar?`)) {
      try {
        await deleteDoc(doc(db, 'usuarios', userId));
        auditLogger('USUARIO_DELETADO', { uid: currentUser.uid, email: currentUser.email }, { id: userId, name: userName });
        toast.success("Usuário deletado com sucesso.");
      } catch (error) { toast.error("Erro ao deletar usuário."); }
    }
  };

  const getRoleBadge = (user) => {
    if (user.isMasterAdmin) return <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-250'}`}><FiShield size={10} /> Master</span>;
    if (user.isAdmin) return <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-blue-50 text-blue-750 border border-blue-200'}`}><FiUser size={10} /> Admin</span>;
    return <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'bg-slate-900 text-slate-400 border border-slate-800' : 'bg-stone-105 text-stone-600 border border-stone-200'}`}><FiUser size={10} /> Cliente</span>;
  };

  const themeClasses = {
    dark: {
      bg: 'bg-[#080c16] bg-cyber-grid-dark text-slate-100',
      surface: 'bg-slate-950/45 backdrop-blur-xl border border-white/5 shadow-2xl',
      border: 'border-white/5',
      text: 'text-slate-100 font-space',
      textSecondary: 'text-slate-400 font-space font-medium',
      textMuted: 'text-slate-500 font-space',
      cardBg: 'bg-slate-950/30 backdrop-blur-xl border border-white/5 shadow-2xl',
      inputBg: 'bg-slate-950/30 border-white/10 text-slate-100 focus:border-cyan-500/50 focus:bg-slate-950/50',
      btnSecondary: 'bg-slate-900 border-white/5 text-slate-300 hover:border-cyan-500/30 hover:text-white',
    },
    light: {
      bg: 'bg-[#fbfbfa] bg-cyber-grid-light text-stone-900',
      surface: 'bg-white/95 backdrop-blur-md border border-stone-200 shadow-md',
      border: 'border-stone-200',
      text: 'text-stone-900 font-space font-bold',
      textSecondary: 'text-stone-650 font-space font-medium',
      textMuted: 'text-stone-400 font-space',
      cardBg: 'bg-[#f5f5f4]/80 backdrop-blur-md border border-stone-200 shadow-sm',
      inputBg: 'bg-[#f5f5f4] border-stone-200 text-stone-900 focus:border-stone-400 focus:bg-white',
      btnSecondary: 'bg-white border-stone-200 text-stone-700 hover:border-stone-400 hover:text-black',
    }
  };

  const t = themeClasses[theme];
  const isDark = theme === 'dark';

  if (authLoading) return <LoadingScreen />;

  return (
    <div className={`min-h-screen ${t.bg} transition-colors duration-500 relative overflow-hidden pb-24 pt-4 px-4 sm:px-8 font-space`}>
      
      {/* ESTILOS E FONTES INJETADOS */}
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
      `}</style>

      {/* Círculos luminosos flutuantes no fundo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-[-10%] left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tr ${theme === 'dark' ? 'from-indigo-500/5 to-transparent' : 'from-indigo-500/3 to-transparent'} blur-[140px]`} />
        <div className={`absolute bottom-[-10%] right-[10%] w-[550px] h-[550px] rounded-full bg-gradient-to-tr ${theme === 'dark' ? 'from-blue-500/4 to-transparent' : 'from-blue-500/2 to-transparent'} blur-[120px]`} />
      </div>

      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className={`max-w-[1400px] mx-auto backdrop-blur-xl border rounded-full h-16 flex items-center justify-between px-6 sticky top-4 z-40 transition-all duration-300 ${t.surface} ${t.border}`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/master-dashboard')} 
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${theme === 'dark' ? 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white' : 'bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-black'}`}
          >
            <FiArrowLeft size={16} />
          </button>
          <div className="hidden sm:block border-l pl-4 border-current opacity-60">
            <h1 className="font-semibold text-sm tracking-tight font-bricolage">Acessos & Segurança</h1>
            <p className="text-[10px] font-mono-jb font-semibold">
              {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${theme === 'dark' ? 'bg-slate-900 hover:bg-slate-800 text-yellow-400' : 'bg-stone-100 hover:bg-stone-200 text-amber-600'}`}
            title="Alternar Tema"
          >
            {theme === 'dark' ? <FiSun size={15} /> : <FiMoon size={15} />}
          </button>
          <div className={`w-px h-6 hidden sm:block ${theme === 'dark' ? 'bg-white/10' : 'bg-stone-200'}`} />
          <button 
            onClick={async () => { await logout(); navigate('/'); }} 
            className="w-9 h-9 bg-red-500/10 hover:bg-red-500/20 rounded-full flex items-center justify-center transition-colors"
            title="Sair"
          >
            <FiLogOut className="text-red-500" size={15} />
          </button>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto mt-12 relative z-10">
        
        {/* HEADER DA PÁGINA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6 px-2">
          <div>
            <div className="flex items-center gap-3 mb-2 justify-center md:justify-start">
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 ${theme === 'dark' ? 'bg-slate-900 text-cyan-400 border-cyan-500/20' : 'bg-stone-200 text-stone-900 border-stone-300'}`}><FiShield /> Controle de Acessos Corporativos</span>
            </div>
            <h2 className="text-4xl font-bold tracking-tight font-bricolage text-center md:text-left">Gestão de Usuários</h2>
            <p className={`${t.textSecondary} text-sm mt-2 font-medium text-center md:text-left`}>Controle de administradores corporativos, franqueados e privilégios de acesso do sistema.</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto justify-center md:justify-end">
             <button 
               onClick={handleRefreshUsers} 
               className={`flex items-center gap-2 px-5 py-3 border rounded-2xl hover:scale-[1.01] active:scale-95 transition-all text-xs font-bold shadow-md ${t.btnSecondary}`}
             >
               <FiRefreshCw className="animate-spin-slow" /> Sincronizar
             </button>
             <Link to="/master/usuarios/criar" state={{ refresh: true }} className={`flex items-center gap-2 px-5 py-3 text-white rounded-2xl font-bold text-xs shadow-lg hover:opacity-95 hover:scale-[1.01] active:scale-95 transition-all ${theme === 'dark' ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-stone-900'}`}>
               <FiPlus /> Novo Usuário
             </Link>
          </div>
        </div>

        {/* STAT CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 px-2">
          {[
            { label: 'Administradores da Rede', value: stats.admins, icon: <FiUser />, textCol: 'bg-blue-500/10 text-blue-400' },
            { label: 'Master Corporativos', value: stats.masters, icon: <FiShield />, textCol: 'bg-amber-500/10 text-amber-400' },
            { label: 'Acessos Ativos', value: stats.active, icon: <FiCheckCircle />, textCol: 'bg-emerald-500/10 text-emerald-400' },
          ].map((card, i) => (
            <div 
              key={i} 
              className={`rounded-[2rem] p-6 border shadow-lg relative overflow-hidden group transition-all duration-300 ${t.cardBg} ${t.border}`}
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-slate-500/5 to-transparent rounded-bl-full pointer-events-none" />
              <div className="flex justify-between items-start mb-4">
                <p className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted}`}>{card.label}</p>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.textCol}`}>
                  {card.icon}
                </div>
              </div>
              <h3 className="text-3xl font-black font-mono-jb leading-tight">{card.value}</h3>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-5 mb-6 rounded-2xl text-sm font-semibold flex items-center gap-2 font-space">
            <FiAlertCircle className="shrink-0" size={16} /> {error}
          </div>
        )}

        {/* FILTROS PILL-STYLE */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-8 px-2">
          <div className={`relative w-full sm:flex-1 border rounded-2xl px-5 py-3.5 flex items-center shadow-md focus-within:border-cyan-500/50 transition-colors ${t.inputBg} ${t.border}`}>
            <FiSearch className={`${t.textMuted} shrink-0`} size={16} />
            <input 
              type="text" 
              placeholder="Buscar por nome, e-mail ou telefone..."
              className={`bg-transparent border-none outline-none text-sm ml-3 w-full font-bold focus:ring-0 placeholder:${t.textMuted} ${t.text}`}
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          
          <div className="flex gap-4 w-full sm:w-auto">
            <div className={`relative w-full sm:w-auto border rounded-2xl px-5 py-3.5 flex items-center shadow-md ${t.inputBg} ${t.border}`}>
              <select 
                value={filterRole} 
                onChange={(e) => setFilterRole(e.target.value)} 
                className={`bg-transparent border-none outline-none text-xs w-full sm:min-w-[140px] font-bold cursor-pointer appearance-none focus:ring-0 ${t.text}`}
              >
                <option value="todos" className={isDark ? 'bg-[#080c16] text-white' : 'bg-white text-slate-900'}>Todos os Cargos</option>
                <option value="isAdmin" className={isDark ? 'bg-[#080c16] text-white' : 'bg-white text-slate-900'}>Administradores</option>
                <option value="isMasterAdmin" className={isDark ? 'bg-[#080c16] text-white' : 'bg-white text-slate-900'}>Masters</option>
              </select>
              <div className={`pointer-events-none absolute right-5 text-xs ${t.textMuted}`}>▼</div>
            </div>
            <div className={`relative w-full sm:w-auto border rounded-2xl px-5 py-3.5 flex items-center shadow-md ${t.inputBg} ${t.border}`}>
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)} 
                className={`bg-transparent border-none outline-none text-xs w-full sm:min-w-[140px] font-bold cursor-pointer appearance-none focus:ring-0 ${t.text}`}
              >
                <option value="todos" className={isDark ? 'bg-[#080c16] text-white' : 'bg-white text-slate-900'}>Todos os Status</option>
                <option value="ativo" className={isDark ? 'bg-[#080c16] text-white' : 'bg-white text-slate-900'}>Ativos</option>
                <option value="inativo" className={isDark ? 'bg-[#080c16] text-white' : 'bg-white text-slate-900'}>Inativos</option>
              </select>
              <div className={`pointer-events-none absolute right-5 text-xs ${t.textMuted}`}>▼</div>
            </div>
          </div>
        </div>

        {/* BENTO GRID: LISTA DE USUÁRIOS */}
        {loadingUsers && usuarios.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-2">
            {[1, 2, 3, 4].map(i => <SkeletonRow key={i} themeClass={t} />)}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className={`py-20 text-center border rounded-[2rem] shadow-sm max-w-[1400px] mx-auto transition-all duration-300 ${t.surface} ${t.border}`}>
            <div className={`w-16 h-16 border rounded-full mx-auto flex items-center justify-center mb-4 ${t.inputBg} ${t.border}`}>
              <FiUser className={`text-2xl ${t.textSecondary}`} />
            </div>
            <h3 className="text-lg font-bold font-bricolage tracking-tight">Nenhum Usuário Encontrado</h3>
            <p className={`${t.textSecondary} font-medium text-sm mt-1`}>Refine sua busca ou cadastre um novo acesso.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-2">
            {filteredUsers.map((user, idx) => {
              // Avatars baseados em cores
              const char = user.nome ? user.nome.charAt(0).toUpperCase() : 'U';
              const charCode = char.charCodeAt(0);
              const gradColor = charCode % 3 === 0 
                ? 'from-cyan-500 to-indigo-500'
                : charCode % 3 === 1 
                  ? 'from-emerald-500 to-teal-500' 
                  : 'from-amber-500 to-orange-500';

              return (
                <motion.div 
                  key={user.id} 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                  className={`border p-6 rounded-[2rem] transition-all duration-300 relative group flex flex-col justify-between ${t.cardBg} ${t.border} ${theme === 'dark' ? 'hover:bg-slate-900/50 hover:border-slate-700/50 hover:scale-[1.01] hover:shadow-[0_8px_32px_rgba(99,102,241,0.06)]' : 'hover:bg-white hover:border-stone-300/60 hover:scale-[1.01] hover:shadow-[0_8px_30px_rgba(99,102,241,0.02)]'}`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${gradColor} flex items-center justify-center text-white font-black text-lg shadow-lg`}>
                        {char}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getRoleBadge(user)}
                        {user.ativo !== false ? (
                          <span className={`text-[9px] w-fit font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-md border uppercase tracking-widest ${theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Ativo
                          </span>
                        ) : (
                          <span className={`text-[9px] w-fit font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-md border uppercase tracking-widest ${theme === 'dark' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-750 border-red-100'}`}>
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> Inativo
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mb-4">
                      <h3 className="text-base font-extrabold font-space truncate leading-snug" title={user.nome || 'Sem Nome'}>
                        {user.nome || 'Sem Nome'}
                      </h3>
                      <p className="text-xs font-mono-jb font-semibold truncate mt-0.5 text-indigo-400" title={user.email}>
                        {user.email}
                      </p>
                      {user.telefone && (
                        <p className={`text-xs font-mono-jb font-medium truncate mt-1.5 flex items-center gap-1.5 ${t.textSecondary}`} title={user.telefone}>
                          <span className="opacity-80">📞</span> {user.telefone}
                        </p>
                      )}
                    </div>

                    <div className={`p-4 rounded-2xl mb-6 border border-dashed text-center flex flex-col items-center justify-center min-h-[85px] transition-colors duration-300 ${t.inputBg} ${t.border}`}>
                      {user.estabelecimentosGerenciados && user.estabelecimentosGerenciados.length > 0 ? (
                        <>
                          <p className={`text-[9px] font-black uppercase tracking-widest mb-3.5 flex items-center justify-center gap-1 ${t.textSecondary}`}>
                            <FiHome className="inline mb-0.5 mr-0.5" /> Lojas Vinculadas
                          </p>
                          <div className="flex -space-x-2">
                            {user.estabelecimentosGerenciados.slice(0, 4).map(eid => (
                              <div 
                                key={eid} 
                                className={`w-8 h-8 rounded-full border flex items-center justify-center text-[10px] font-black shadow-md relative z-10 hover:z-20 hover:scale-110 transition-transform cursor-help ${t.cardBg} ${t.border}`} 
                                title={estabelecimentosMap[eid] || eid}
                              >
                                {(estabelecimentosMap[eid] || 'L').charAt(0).toUpperCase()}
                              </div>
                            ))}
                            {user.estabelecimentosGerenciados.length > 4 && (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 border border-white/10 flex items-center justify-center text-[9px] font-bold text-white relative z-10">
                                 +{user.estabelecimentosGerenciados.length - 4}
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className={`text-xs font-bold ${t.textMuted}`}>Sem Lojas Vinculadas</p>
                      )}
                    </div>
                  </div>

                  <div className={`pt-4 border-t flex items-center justify-end gap-2 ${theme === 'dark' ? 'border-slate-800/80' : 'border-stone-250'}`}>
                    <Link 
                      to={`/master/usuarios/${user.id}/editar`} 
                      className={`w-9 h-9 flex items-center justify-center border hover:bg-blue-500/10 hover:text-blue-500 rounded-xl transition-all ${t.inputBg} ${t.border} ${t.textSecondary}`} 
                      title="Editar"
                    >
                      <FiEdit3 size={14} />
                    </Link>

                    <button 
                      onClick={() => toggleUserAtivo(user.id, user.ativo !== false, user.nome)} 
                      disabled={currentUser.uid === user.id}
                      className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-95 disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed ${
                        user.ativo !== false 
                          ? `${t.inputBg} border ${t.border} ${t.textSecondary} hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20` 
                          : 'bg-emerald-500 text-white border border-emerald-500 hover:opacity-90'
                      }`}
                      title={user.ativo !== false ? "Desativar Conta" : "Ativar Conta"}
                    >
                      {user.ativo !== false ? <FiPower size={14} /> : <FiCheck size={14} />}
                    </button>
                    
                    <button 
                      onClick={() => handleDeleteUser(user.id, user.nome)} 
                      disabled={currentUser.uid === user.id}
                      className={`w-9 h-9 flex items-center justify-center border hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 rounded-xl transition-all active:scale-95 disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed ${t.inputBg} ${t.border} ${t.textSecondary}`} 
                      title="Deletar"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default ListarUsuariosMaster;