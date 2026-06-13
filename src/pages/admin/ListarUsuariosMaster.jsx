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
  FiSearch, FiLogOut, FiSun, FiMoon
} from 'react-icons/fi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SkeletonRow = ({ isDark }) => (
  <div className={`p-6 rounded-[2rem] border animate-pulse flex flex-col gap-4 ${isDark ? 'bg-slate-900/40 border-slate-800/80 shadow-md' : 'bg-white/70 border-slate-200/60 shadow-sm'}`}>
    <div className="flex justify-between items-start">
        <div className={`w-12 h-12 rounded-[1rem] border ${isDark ? 'bg-slate-800 border-slate-700/50' : 'bg-slate-100 border-slate-200/60'}`}></div>
        <div className={`w-16 h-6 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    </div>
    <div className="space-y-2">
        <div className={`h-4 rounded-lg w-32 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
        <div className={`h-3 rounded-lg w-48 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    </div>
    <div className={`pt-4 border-t mt-2 flex justify-between ${isDark ? 'border-slate-800/60' : 'border-slate-100'}`}>
        <div className={`h-4 rounded-lg w-20 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
        <div className={`h-6 rounded-lg w-16 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
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
    if (user.isMasterAdmin) return <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FFF9EB] text-[#F59E0B] border border-[#FDE68A]/60 shadow-inner"><FiShield size={10} /> Master</span>;
    if (user.isAdmin) return <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#EFF6FF] text-[#3B82F6] border border-[#BFDBFE]/60 shadow-inner"><FiUser size={10} /> Admin</span>;
    return <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#F5F5F7] text-[#86868B] border border-[#E5E5EA]/60 shadow-inner">Cliente</span>;
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
      gradient: 'from-blue-550 to-purple-650',
      cardBg: 'bg-white/70 backdrop-blur-md',
      inputBg: 'bg-slate-100/50',
    }
  };

  const t = themeClasses[theme];
  const isDark = theme === 'dark';

  if (authLoading) return <div className={`flex h-screen items-center justify-center ${t.bg}`}><FiActivity className="text-blue-500 text-4xl animate-spin" /></div>;

  return (
    <div className={`min-h-screen ${t.bg} transition-colors duration-500 relative overflow-hidden pb-24 pt-4 px-4 sm:px-8`}>
      {/* Glow effects */}
      <div className="absolute top-[-10%] left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-violet-500/10 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-blue-500/8 to-transparent blur-[120px] pointer-events-none" />

      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className={`max-w-[1400px] mx-auto ${t.surface} border ${t.border} shadow-lg rounded-3xl h-16 flex items-center justify-between px-6 sticky top-4 z-40 transition-all`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/master-dashboard')} 
            className={`w-9 h-9 ${t.inputBg} hover:opacity-80 rounded-xl flex items-center justify-center border ${t.border} transition-colors`}
          >
            <FiArrowLeft className={`${t.textSecondary} text-sm`} />
          </button>
          <div className="border-l border-slate-700/50 pl-4">
            <h1 className={`font-bold text-sm tracking-tight ${t.text}`}>Acessos & Segurança</h1>
            <p className={`text-[10px] ${t.textSecondary} font-semibold uppercase`}>
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-xl ${t.inputBg} ${t.border} border ${t.textSecondary} hover:${t.text} transition-all`}
          >
            {theme === 'dark' ? <FiSun size={15} /> : <FiMoon size={15} />}
          </button>
          <div className="w-px h-6 bg-slate-700/50" />
          <button 
            onClick={async () => { await logout(); navigate('/'); }} 
            className="w-9 h-9 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 rounded-xl flex items-center justify-center transition-colors"
          >
            <FiLogOut className="text-red-500" size={16} />
          </button>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto mt-10">
        
        {/* HEADER DA PÁGINA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 px-2">
          <div>
            <div className="flex items-center gap-3 mb-2">
                <span className={`border ${t.border} ${t.inputBg} ${t.textSecondary} text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full`}>Controle de Segurança da Rede</span>
            </div>
            <h2 className={`text-4xl font-extrabold tracking-tight ${t.text}`}>Gestão de Usuários</h2>
            <p className={`text-sm ${t.textSecondary} mt-1 font-medium`}>Controle de administradores corporativos, franqueados e privilégios de acesso do sistema.</p>
          </div>
          <div className="flex items-center gap-3">
             <button 
               onClick={handleRefreshUsers} 
               className={`flex items-center gap-2 px-5 py-3 ${t.cardBg} border ${t.border} rounded-2xl hover:opacity-85 transition-colors text-xs font-bold ${t.text} shadow-md`}
             >
               <FiRefreshCw /> Sincronizar
             </button>
             <Link to="/master/usuarios/criar" state={{ refresh: true }} className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-bold text-xs shadow-lg hover:opacity-95 hover:scale-[1.01] transition-all">
               <FiPlus /> Novo Usuário
             </Link>
          </div>
        </div>

        {/* STAT CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 px-2">
          {[
            { label: 'Administradores da Rede', value: stats.admins, icon: <FiUser />, textCol: 'text-blue-500' },
            { label: 'Master Corporativos', value: stats.masters, icon: <FiShield />, textCol: 'text-amber-500' },
            { label: 'Acessos Ativos', value: stats.active, icon: <FiCheckCircle />, textCol: 'text-emerald-500' },
          ].map((card, i) => (
            <div 
              key={i} 
              className={`rounded-3xl p-6 border ${t.border} ${t.cardBg} shadow-lg relative overflow-hidden group transition-all duration-300`}
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-slate-500/5 to-transparent rounded-bl-full pointer-events-none" />
              <div className="flex justify-between items-start mb-4">
                <p className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted}`}>{card.label}</p>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-slate-500/10 ${card.textCol}`}>
                  {card.icon}
                </div>
              </div>
              <h3 className={`text-3xl font-extrabold tracking-tight ${t.text}`}>{card.value}</h3>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 mb-6 rounded-2xl text-xs font-bold flex items-center gap-2">
            <FiPower /> {error}
          </div>
        )}

        {/* FILTROS PILL-STYLE */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-8 px-2">
          <div className={`relative w-full sm:flex-1 ${t.cardBg} border ${t.border} rounded-2xl px-5 py-3.5 flex items-center shadow-md focus-within:border-blue-500/50 transition-colors`}>
            <FiSearch className={`${t.textMuted} shrink-0`} size={16} />
            <input 
              type="text" 
              placeholder="Buscar por nome, e-mail ou telefone..."
              className={`bg-transparent border-none outline-none text-sm ml-3 w-full font-bold ${t.text} placeholder:${t.textMuted}`}
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          
          <div className="flex gap-4 w-full sm:w-auto">
            <div className={`relative w-full sm:w-auto ${t.cardBg} border ${t.border} rounded-2xl px-5 py-3.5 flex items-center shadow-md`}>
              <select 
                value={filterRole} 
                onChange={(e) => setFilterRole(e.target.value)} 
                className={`bg-transparent border-none outline-none text-xs w-full sm:min-w-[140px] font-bold ${t.text} cursor-pointer appearance-none outline-none`}
              >
                <option value="todos" className={isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}>Todos os Cargos</option>
                <option value="isAdmin" className={isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}>Administradores</option>
                <option value="isMasterAdmin" className={isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}>Masters</option>
              </select>
              <div className={`pointer-events-none absolute right-5 text-xs ${t.textMuted}`}>▼</div>
            </div>
            <div className={`relative w-full sm:w-auto ${t.cardBg} border ${t.border} rounded-2xl px-5 py-3.5 flex items-center shadow-md`}>
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)} 
                className={`bg-transparent border-none outline-none text-xs w-full sm:min-w-[140px] font-bold ${t.text} cursor-pointer appearance-none outline-none`}
              >
                <option value="todos" className={isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}>Todos os Status</option>
                <option value="ativo" className={isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}>Ativos</option>
                <option value="inativo" className={isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}>Inativos</option>
              </select>
              <div className={`pointer-events-none absolute right-5 text-xs ${t.textMuted}`}>▼</div>
            </div>
          </div>
        </div>

        {/* BENTO GRID: LISTA DE USUÁRIOS */}
        {loadingUsers && usuarios.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-2">
            {[1, 2, 3, 4].map(i => <SkeletonRow key={i} isDark={isDark} />)}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className={`py-20 text-center ${t.cardBg} border ${t.border} rounded-[2rem] shadow-sm max-w-[1400px] mx-auto`}>
            <div className={`w-16 h-16 ${t.inputBg} border ${t.border} rounded-full mx-auto flex items-center justify-center mb-4`}>
              <FiUser className={`text-2xl ${t.textSecondary}`} />
            </div>
            <h3 className={`text-lg font-bold ${t.text} tracking-tight`}>Nenhum Usuário Encontrado</h3>
            <p className={`${t.textSecondary} font-medium text-sm mt-1`}>Refine sua busca ou cadastre um novo acesso.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-2">
            {filteredUsers.map(user => {
              // Avatars baseados em cores
              const char = user.nome ? user.nome.charAt(0).toUpperCase() : 'U';
              const charCode = char.charCodeAt(0);
              const gradColor = charCode % 3 === 0 
                ? 'from-blue-500 to-indigo-500'
                : charCode % 3 === 1 
                  ? 'from-emerald-500 to-teal-500' 
                  : 'from-amber-500 to-orange-500';

              return (
                <div 
                  key={user.id} 
                  className={`${t.cardBg} border ${t.border} ${t.surfaceHover} p-6 rounded-3xl transition-all duration-300 relative group flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${gradColor} flex items-center justify-center text-white font-black text-lg shadow-lg`}>
                        {char}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getRoleBadge(user)}
                        {user.ativo !== false ? (
                          <span className="text-[9px] w-fit font-bold flex items-center gap-1.5 text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 uppercase tracking-widest">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Ativo
                          </span>
                        ) : (
                          <span className="text-[9px] w-fit font-bold flex items-center gap-1.5 text-red-500 bg-red-500/10 px-2.5 py-1 rounded-md border border-red-500/20 uppercase tracking-widest">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> Inativo
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mb-4">
                      <h3 className={`text-base font-extrabold ${t.text} line-clamp-1 truncate`} title={user.nome || 'Sem Nome'}>
                        {user.nome || 'Sem Nome'}
                      </h3>
                      <p className={`text-xs ${t.textSecondary} font-semibold truncate mt-0.5`} title={user.email}>
                        {user.email}
                      </p>
                      {user.telefone && (
                        <p className={`text-xs ${t.textSecondary} font-medium truncate mt-1 flex items-center gap-1`} title={user.telefone}>
                          <span>📞</span> {user.telefone}
                        </p>
                      )}
                    </div>

                    <div className={`p-4 rounded-2xl mb-6 ${t.inputBg} border ${t.border} border-dashed text-center flex flex-col items-center justify-center min-h-[70px]`}>
                      {user.estabelecimentosGerenciados && user.estabelecimentosGerenciados.length > 0 ? (
                        <>
                          <p className={`text-[9px] font-black uppercase tracking-widest ${t.textSecondary} mb-2.5 flex items-center justify-center gap-1`}>
                            <FiHome className="inline mb-0.5 mr-0.5" /> Lojas Vinculadas
                          </p>
                          <div className="flex -space-x-2">
                            {user.estabelecimentosGerenciados.slice(0, 4).map(eid => (
                              <div 
                                key={eid} 
                                className={`w-8 h-8 rounded-full ${t.cardBg} border ${t.border} flex items-center justify-center text-[10px] font-black ${t.text} shadow-md relative z-10 hover:z-20 hover:scale-110 transition-transform cursor-help`} 
                                title={estabelecimentosMap[eid] || eid}
                              >
                                {(estabelecimentosMap[eid] || 'L').charAt(0).toUpperCase()}
                              </div>
                            ))}
                            {user.estabelecimentosGerenciados.length > 4 && (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 border border-slate-700/30 flex items-center justify-center text-[9px] font-bold text-white relative z-10">
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

                  <div className={`pt-4 border-t ${t.border} flex items-center justify-end gap-2`}>
                    <Link 
                      to={`/master/usuarios/${user.id}/editar`} 
                      className={`w-9 h-9 flex items-center justify-center ${t.inputBg} border ${t.border} hover:bg-blue-500/10 hover:text-blue-500 rounded-xl ${t.textSecondary} transition-all`} 
                      title="Editar"
                    >
                      <FiEdit3 size={14} />
                    </Link>

                    <button 
                      onClick={() => toggleUserAtivo(user.id, user.ativo !== false, user.nome)} 
                      disabled={currentUser.uid === user.id}
                      className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${
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
                      className={`w-9 h-9 flex items-center justify-center ${t.inputBg} border ${t.border} hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 rounded-xl ${t.textSecondary} transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed`} 
                      title="Deletar"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        * { font-family: 'Outfit', -apple-system, system-ui, sans-serif; }
      `}</style>
    </div>
  );
}

export default ListarUsuariosMaster;