// src/pages/admin/ListarUsuariosMaster.jsx
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
  FaUser
} from 'react-icons/fa';

// --- Header Minimalista (Reutilizado) ---
const DashboardHeader = ({ currentUser, logout, navigate }) => {
  const userEmailPrefix = currentUser.email ? currentUser.email.split('@')[0] : 'Admin';
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 h-16 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex justify-between items-center h-full">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
             <div className="flex items-center gap-1">
                <div className="bg-yellow-400 text-black font-bold p-1 rounded-sm transform -skew-x-12">
                    <FaStore />
                </div>
                <span className="text-gray-900 font-extrabold text-xl tracking-tight">
                    Na<span className="text-yellow-500">Mão</span>
                </span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-semibold text-gray-800">{userEmailPrefix}</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Master Admin</span>
            </div>
            <button 
                onClick={logout} 
                className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
                title="Sair"
            >
              <FaSignOutAlt />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

// Componente de Card de Estatística
const StatCard = ({ title, value, icon, colorClass }) => (
  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
    <div className={`p-3 rounded-xl ${colorClass} text-white`}>
      {icon}
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
          admins: usuarios.filter(u => u.isAdmin).length,
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
        toast.success("Usuário deletado.");
      } catch (error) { toast.error("Erro ao deletar."); }
    }
  };

  if (authLoading || loadingUsers) return <div className="flex h-screen items-center justify-center bg-gray-50"><div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="bg-gray-50 min-h-screen pt-20 pb-12 px-4 sm:px-6 font-sans">
      <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} /> 
      
      <main className="max-w-7xl mx-auto">
        
        {/* Header da Página */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
                <button onClick={() => navigate('/master-dashboard')} className="text-gray-400 hover:text-gray-600 flex items-center gap-2 mb-2 text-sm font-medium transition-colors">
                    <FaArrowLeft /> Voltar ao Dashboard
                </button>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Usuários</h1>
                <p className="text-gray-500 text-sm mt-1">Gerencie acessos e permissões do sistema.</p>
            </div>
            <div className="flex gap-3">
                <button onClick={handleRefreshUsers} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all text-sm font-bold shadow-sm">
                    <FaRedo /> Recarregar
                </button>
                <Link to="/master/usuarios/criar" state={{ refresh: true }} className="flex items-center gap-2 bg-black text-white px-5 py-3 rounded-xl hover:bg-gray-800 transition-all shadow-lg font-bold text-sm">
                    <FaPlus /> Novo Usuário
                </Link>
            </div>
        </div>

        {/* KPIs Rápidos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatCard title="Total Usuários" value={stats.total} icon={<FaUser />} colorClass="bg-gray-900" />
            <StatCard title="Administradores" value={stats.admins} icon={<FaUserShield />} colorClass="bg-yellow-500" />
            <StatCard title="Contas Ativas" value={stats.active} icon={<FaCheck />} colorClass="bg-green-500" />
        </div>

        {error && <div className="bg-red-50 text-red-600 p-4 mb-6 rounded-xl text-sm border border-red-100">{error}</div>}

        {/* Barra de Filtros */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
                <FaSearch className="absolute left-4 top-3.5 text-gray-300" />
                <input 
                    type="text" 
                    placeholder="Buscar nome ou email..." 
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:border-yellow-400 focus:bg-white transition-all text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="flex gap-4">
                <div className="relative">
                    <FaFilter className="absolute left-4 top-3.5 text-gray-300" />
                    <select className="pl-10 pr-8 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:border-yellow-400 text-sm appearance-none cursor-pointer" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                        <option value="todos">Todos Papéis</option>
                        <option value="isClient">Clientes</option>
                        <option value="isAdmin">Admins</option>
                        <option value="isMasterAdmin">Masters</option>
                    </select>
                </div>
                <div className="relative">
                    <FaCheck className="absolute left-4 top-3.5 text-gray-300" />
                    <select className="pl-10 pr-8 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:border-yellow-400 text-sm appearance-none cursor-pointer" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                        <option value="todos">Todos Status</option>
                        <option value="ativo">Ativos</option>
                        <option value="inativo">Inativos</option>
                    </select>
                </div>
            </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
                {filteredUsers.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300 text-2xl"><FaUser /></div>
                        <p className="text-gray-500 font-medium">Nenhum usuário encontrado.</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50/50 text-gray-400 text-xs uppercase font-bold tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Usuário</th>
                                <th className="px-6 py-4">Função</th>
                                <th className="px-6 py-4">Lojas</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-sm">
                                                {user.nome ? user.nome.charAt(0).toUpperCase() : 'U'}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-gray-900">{user.nome || 'Sem Nome'}</div>
                                                <div className="text-xs text-gray-500">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.isMasterAdmin ? (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-black text-white">Master</span>
                                        ) : user.isAdmin ? (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-yellow-100 text-yellow-700">Admin Loja</span>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-gray-100 text-gray-600">Cliente</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {user.isAdmin && user.estabelecimentosGerenciados?.length > 0 ? (
                                            <div className="flex -space-x-2">
                                                {user.estabelecimentosGerenciados.slice(0, 3).map(eid => (
                                                    <div key={eid} className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500" title={estabelecimentosMap[eid] || eid}>
                                                        {(estabelecimentosMap[eid] || 'L').charAt(0)}
                                                    </div>
                                                ))}
                                                {user.estabelecimentosGerenciados.length > 3 && (
                                                    <div className="w-6 h-6 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-[8px] font-bold text-gray-500">+{user.estabelecimentosGerenciados.length - 3}</div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-300">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={`flex items-center gap-1.5 text-xs font-bold ${user.ativo ? 'text-green-600' : 'text-red-500'}`}>
                                            <span className={`w-2 h-2 rounded-full ${user.ativo ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                            {user.ativo ? 'Ativo' : 'Inativo'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Link to={`/master/usuarios/${user.id}/editar`} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors" title="Editar">
                                                <FaEdit />
                                            </Link>
                                            <button 
                                                onClick={() => toggleUserAtivo(user.id, user.ativo, user.nome)} 
                                                disabled={currentUser.uid === user.id}
                                                className={`p-2 rounded-lg text-white transition-colors ${user.ativo ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'} disabled:opacity-50`}
                                                title={user.ativo ? "Desativar" : "Ativar"}
                                            >
                                                <FaPowerOff />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteUser(user.id, user.nome)} 
                                                disabled={currentUser.uid === user.id}
                                                className="p-2 bg-white border border-gray-200 hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-gray-400 rounded-lg transition-colors disabled:opacity-50"
                                                title="Deletar"
                                            >
                                                <FaTrash />
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