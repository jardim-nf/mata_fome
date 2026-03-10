import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  orderBy, 
  where, 
  getDocs  
} from 'firebase/firestore'; 
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger'; 
import { 
  FaArrowLeft, 
  FaPlus, 
  FaSearch, 
  FaEdit, 
  FaTrash, 
  FaPowerOff, 
  FaCheck, 
  FaFilter, 
  FaRedo,
  FaStore,
  FaSignOutAlt,
  FaUserShield,
  FaUser,
  FaUsersCog,
  FaCheckCircle,
  FaIdBadge
} from 'react-icons/fa';

// --- Header Premium (Reutilizado) ---
const DashboardHeader = ({ currentUser, logout, navigate }) => {
  const userEmailPrefix = currentUser.email ? currentUser.email.split('@')[0] : 'Admin';
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/50 shadow-sm h-16 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex justify-between items-center h-full">
          {/* LOGO AREA */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
            <div className="flex items-center gap-2">
                <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 text-white font-bold p-1.5 rounded-lg shadow-md transform -skew-x-6 group-hover:rotate-3 transition-transform">
                    <svg className="w-5 h-5 drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                </div>
                <span className="text-gray-900 font-black text-xl tracking-tighter">
                    Idea<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-yellow-600">Food</span>
                </span>
            </div>
          </div>

          {/* USER AREA */}
          <div className="flex items-center gap-5">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-bold text-gray-800 tracking-tight">{userEmailPrefix}</span>
              <span className="text-[9px] uppercase tracking-widest text-yellow-600 font-bold bg-yellow-50 px-2 py-0.5 rounded-full border border-yellow-100 mt-0.5">Master Access</span>
            </div>
            <div className="h-8 w-px bg-gray-200 mx-2 hidden md:block"></div>
            <button 
                onClick={logout} 
                className="text-gray-400 hover:text-red-500 transition-all duration-300 p-2 rounded-xl hover:bg-red-50/80 active:scale-95"
                title="Encerrar Sessão"
            >
              <FaSignOutAlt size={18} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

// --- Mini Componente de Card de Estatística Premium ---
const UserStatCard = ({ title, value, icon, type = 'default' }) => {
  const styles = {
    dark: 'bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 text-white shadow-xl shadow-gray-900/20',
    warning: 'bg-white border-gray-100 shadow-sm hover:shadow-md text-gray-900',
    success: 'bg-white border-gray-100 shadow-sm hover:shadow-md text-gray-900'
  };

  const iconStyles = {
    dark: 'bg-gray-800 text-yellow-400 border border-gray-700 shadow-inner',
    warning: 'bg-amber-50 text-amber-500',
    success: 'bg-emerald-50 text-emerald-500'
  };

  const currentStyle = styles[type];
  const currentIconStyle = iconStyles[type];

  return (
    <div className={`relative overflow-hidden p-6 rounded-3xl border transition-all duration-500 group hover:-translate-y-1 hover:shadow-lg ${currentStyle}`}>
      <div className="flex justify-between items-center relative z-10">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${type === 'dark' ? 'text-gray-400' : 'text-gray-400'}`}>
            {title}
          </p>
          <p className="text-3xl font-black tracking-tight">{value}</p>
        </div>
        <div className={`p-4 rounded-2xl transition-transform duration-500 group-hover:scale-110 ${currentIconStyle}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

function ListarUsuariosMaster() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, isMasterAdmin, loading: authLoading, logout, reloadUserData } = useAuth();

  const [usuarios, setUsuarios] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState('');
  const [estabelecimentosMap, setEstabelecimentosMap] = useState({});

  // Estados para busca e filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');

  const [unsubscribe, setUnsubscribe] = useState(null);

  // --- CARREGAMENTO INICIAL ---
  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isMasterAdmin) {
        navigate('/master-dashboard');
      }
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  // Detectar refresh via URL
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get('refresh') === 'true') {
      handleRefreshUsers();
      navigate('/master/usuarios', { replace: true });
    }
  }, [location.search, navigate]);

  // Carregar nomes dos estabelecimentos
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

  // --- LISTENER REALTIME ---
  useEffect(() => {
    if (!isMasterAdmin || !currentUser) { setLoadingUsers(false); return; }

    setLoadingUsers(true);
    let baseQueryRef = collection(db, 'usuarios');
    let queryConstraints = [];

    if (filterRole === 'isAdmin') queryConstraints.push(where('isAdmin', '==', true));
    else if (filterRole === 'isMasterAdmin') queryConstraints.push(where('isMasterAdmin', '==', true));
    else if (filterRole === 'isClient') queryConstraints.push(where('isAdmin', '==', false), where('isMasterAdmin', '==', false));
    
    if (filterStatus === 'ativo') queryConstraints.push(where('ativo', '==', true));
    else if (filterStatus === 'inativo') queryConstraints.push(where('ativo', '==', false));

    const q = query(baseQueryRef, ...queryConstraints, orderBy('nome', 'asc'));

    const unsub = onSnapshot(q, (snap) => {
        setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoadingUsers(false);
      },
      (err) => {
        console.error(err);
        setError("Erro ao carregar usuários.");
        setLoadingUsers(false);
      }
    );

    setUnsubscribe(() => unsub);
    return () => { if (unsub) unsub(); };
  }, [isMasterAdmin, currentUser, filterRole, filterStatus]);

  const handleRefreshUsers = useCallback(() => {
    setSearchTerm(''); setFilterRole('todos'); setFilterStatus('todos');
    if (unsubscribe) unsubscribe();
    setLoadingUsers(true);
    if (reloadUserData) reloadUserData();
    setTimeout(() => window.location.reload(), 800);
  }, [unsubscribe, reloadUserData]);

  // --- FILTROS E ESTATÍSTICAS ---
  const filteredUsers = useMemo(() => {
    return usuarios.filter(user => {
        const term = searchTerm.toLowerCase();
        return (user.nome && user.nome.toLowerCase().includes(term)) || 
               (user.email && user.email.toLowerCase().includes(term));
    });
  }, [usuarios, searchTerm]);

  const stats = useMemo(() => {
      return {
          total: usuarios.length,
          admins: usuarios.filter(u => u.isAdmin || u.isMasterAdmin).length,
          active: usuarios.filter(u => u.ativo).length
      };
  }, [usuarios]);

  // --- AÇÕES ---
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

  if (authLoading || loadingUsers && usuarios.length === 0) {
    return <div className="flex h-screen items-center justify-center bg-[#f8fafc]"><div className="w-12 h-12 border-4 border-gray-200 border-t-yellow-400 rounded-full animate-spin shadow-lg"></div></div>;
  }

  return (
    <div className="bg-[#f8fafc] min-h-screen pt-24 pb-12 px-4 sm:px-6 font-sans selection:bg-yellow-200 selection:text-black">
      <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} /> 
      
      <main className="max-w-7xl mx-auto">
        
        {/* HEADER DA PÁGINA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
            <div>
                <button 
                  onClick={() => navigate('/master-dashboard')} 
                  className="text-gray-400 hover:text-yellow-600 flex items-center gap-2 mb-4 text-sm font-bold transition-colors group"
                >
                  <span className="bg-white p-1.5 rounded-lg shadow-sm border border-gray-100 group-hover:border-yellow-200 transition-colors">
                    <FaArrowLeft />
                  </span> 
                  Voltar ao Painel Master
                </button>
                <div className="flex items-center gap-3 mb-2">
                    <span className="bg-gray-900 text-yellow-400 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-sm">Controle de Acessos</span>
                </div>
                <h1 className="text-4xl font-black text-gray-900 tracking-tight">Usuários</h1>
                <p className="text-gray-500 text-sm mt-2 font-medium">Gerencie clientes, administradores e privilégios do sistema.</p>
            </div>
            <div className="flex flex-wrap gap-3">
                <button 
                  onClick={handleRefreshUsers} 
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:border-yellow-400 hover:text-yellow-600 transition-all text-sm font-bold shadow-sm active:scale-95 group"
                >
                    <FaRedo className="text-gray-400 group-hover:text-yellow-500" /> Sincronizar
                </button>
                <Link 
                  to="/master/usuarios/criar" 
                  state={{ refresh: true }} 
                  className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black px-6 py-2.5 rounded-xl hover:from-yellow-500 hover:to-yellow-600 transition-all shadow-lg shadow-yellow-500/30 font-bold text-sm active:scale-95"
                >
                    <FaPlus /> Novo Usuário
                </Link>
            </div>
        </div>

        {/* KPIs RÁPIDOS PREMIUM */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <UserStatCard title="Total Registrados" value={stats.total} icon={<FaUsersCog size={24} />} type="dark" />
            <UserStatCard title="Privilégios Admin" value={stats.admins} icon={<FaUserShield size={24} />} type="warning" />
            <UserStatCard title="Contas Ativas" value={stats.active} icon={<FaCheckCircle size={24} />} type="success" />
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 mb-6 rounded-2xl text-sm font-bold flex items-center gap-3 shadow-sm animate-in fade-in">
            <FaPowerOff className="text-rose-500 text-lg" /> {error}
          </div>
        )}

        {/* BARRA DE FILTROS */}
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/30 border border-gray-100 p-4 mb-8 flex flex-col md:flex-row gap-4 relative z-10">
            <div className="flex-1 relative">
                <FaSearch className="absolute left-5 top-4 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Buscar por nome ou e-mail do usuário..." 
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border-2 border-transparent hover:border-gray-100 rounded-2xl focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/10 focus:bg-white transition-all font-semibold text-gray-700 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="flex gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-48 group">
                    <FaIdBadge className="absolute left-4 top-4 text-gray-400 z-10" />
                    <select 
                        className="w-full pl-10 pr-4 py-3.5 bg-gray-50/50 border-2 border-transparent hover:border-gray-100 rounded-2xl focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/10 focus:bg-white transition-all font-semibold text-gray-700 text-sm appearance-none cursor-pointer relative z-0" 
                        value={filterRole} 
                        onChange={(e) => setFilterRole(e.target.value)}
                    >
                        <option value="todos">Todos os Papéis</option>
                        <option value="isClient">Apenas Clientes</option>
                        <option value="isAdmin">Apenas Admins</option>
                        <option value="isMasterAdmin">Masters</option>
                    </select>
                </div>
                <div className="relative flex-1 md:w-48 group">
                    <FaFilter className="absolute left-4 top-4 text-gray-400 z-10" />
                    <select 
                        className="w-full pl-10 pr-4 py-3.5 bg-gray-50/50 border-2 border-transparent hover:border-gray-100 rounded-2xl focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/10 focus:bg-white transition-all font-semibold text-gray-700 text-sm appearance-none cursor-pointer relative z-0" 
                        value={filterStatus} 
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="todos">Todos os Status</option>
                        <option value="ativo">Apenas Ativos</option>
                        <option value="inativo">Apenas Inativos</option>
                    </select>
                </div>
            </div>
        </div>

        {/* TABELA DE USUÁRIOS */}
        <div className="bg-white rounded-[2rem] shadow-xl shadow-gray-200/40 border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
                {filteredUsers.length === 0 ? (
                    <div className="text-center py-24 flex flex-col items-center justify-center">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-5 shadow-inner">
                            <FaUser className="text-4xl text-gray-300" />
                        </div>
                        <h3 className="text-xl font-black text-gray-800 tracking-tight">Nenhum usuário encontrado</h3>
                        <p className="text-gray-400 text-sm mt-2 font-medium">Verifique os filtros ou crie um novo cadastro.</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-white border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-5 text-[10px] uppercase tracking-widest text-gray-400 font-black">Perfil do Usuário</th>
                                <th className="px-6 py-5 text-[10px] uppercase tracking-widest text-gray-400 font-black">Nível de Acesso</th>
                                <th className="px-6 py-5 text-[10px] uppercase tracking-widest text-gray-400 font-black">Lojas Vinculadas</th>
                                <th className="px-6 py-5 text-[10px] uppercase tracking-widest text-gray-400 font-black">Status</th>
                                <th className="px-6 py-5 text-[10px] uppercase tracking-widest text-gray-400 font-black text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-yellow-50/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-500 font-black text-lg shadow-sm border border-white">
                                                {user.nome ? user.nome.charAt(0).toUpperCase() : 'U'}
                                            </div>
                                            <div>
                                                <div className="text-sm font-black text-gray-900 tracking-tight">{user.nome || 'Usuário Sem Nome'}</div>
                                                <div className="text-xs font-medium text-gray-500 mt-0.5">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.isMasterAdmin ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-gray-900 text-yellow-400 shadow-sm">
                                                <FaUserShield /> Master
                                            </span>
                                        ) : user.isAdmin ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                                                Admin Loja
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200">
                                                Cliente
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.isAdmin && user.estabelecimentosGerenciados?.length > 0 ? (
                                            <div className="flex -space-x-2">
                                                {user.estabelecimentosGerenciados.slice(0, 3).map(eid => (
                                                    <div key={eid} className="w-8 h-8 rounded-full bg-white border-2 border-gray-100 flex items-center justify-center text-[10px] font-black text-gray-600 shadow-sm hover:z-10 hover:scale-110 transition-transform cursor-help" title={estabelecimentosMap[eid] || eid}>
                                                        {(estabelecimentosMap[eid] || 'L').charAt(0).toUpperCase()}
                                                    </div>
                                                ))}
                                                {user.estabelecimentosGerenciados.length > 3 && (
                                                    <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-gray-500 shadow-sm z-0">
                                                        +{user.estabelecimentosGerenciados.length - 3}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-400 font-medium italic">Sem vínculo</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.ativo ? (
                                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md text-xs font-bold border border-emerald-100">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Ativo
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-2.5 py-1 rounded-md text-xs font-bold border border-rose-100">
                                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Inativo
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Link 
                                                to={`/master/usuarios/${user.id}/editar`} 
                                                className="w-9 h-9 flex items-center justify-center bg-gray-50 hover:bg-white border border-transparent hover:border-yellow-400 rounded-xl text-gray-500 hover:text-yellow-600 transition-all shadow-sm hover:shadow-md" 
                                                title="Editar Usuário"
                                            >
                                                <FaEdit size={14} />
                                            </Link>
                                            
                                            <button 
                                                onClick={() => toggleUserAtivo(user.id, user.ativo, user.nome)} 
                                                disabled={currentUser.uid === user.id}
                                                className={`w-9 h-9 flex items-center justify-center rounded-xl text-white transition-all shadow-sm active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed
                                                    ${user.ativo ? 'bg-gray-300 hover:bg-rose-500 text-gray-600 hover:text-white' : 'bg-emerald-500 hover:bg-emerald-600'}
                                                `}
                                                title={user.ativo ? "Desativar Acesso" : "Ativar Acesso"}
                                            >
                                                {user.ativo ? <FaPowerOff size={14} /> : <FaCheck size={14} />}
                                            </button>

                                            <button 
                                                onClick={() => handleDeleteUser(user.id, user.nome)} 
                                                disabled={currentUser.uid === user.id}
                                                className="w-9 h-9 flex items-center justify-center bg-white border border-gray-200 hover:bg-rose-500 hover:border-rose-500 text-gray-400 hover:text-white rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Deletar Usuário"
                                            >
                                                <FaTrash size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>

      </main>
    </div>
  );
}

export default ListarUsuariosMaster;