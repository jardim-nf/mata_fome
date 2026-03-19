// src/pages/admin/ListarUsuariosMaster.jsx — Premium Light v2
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, orderBy, where, getDocs } from 'firebase/firestore'; 
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger'; 
import { 
  FaArrowLeft, FaPlus, FaEdit, FaTrash, FaPowerOff, FaCheck, FaSignOutAlt,
  FaSearch, FaRedo, FaStore, FaUserShield, FaUser, FaUsersCog, FaCheckCircle,
  FaBolt, FaCrown
} from 'react-icons/fa';
import { IoSearchOutline } from 'react-icons/io5';

// Skeleton Row
const SkeletonRow = () => (
  <div className="p-5 flex items-center gap-4 animate-pulse border-b border-slate-50">
    <div className="w-10 h-10 bg-slate-100 rounded-xl"></div>
    <div className="flex-1 space-y-2"><div className="h-4 bg-slate-100 rounded-lg w-32"></div><div className="h-3 bg-slate-50 rounded-lg w-48"></div></div>
    <div className="h-6 bg-slate-100 rounded-lg w-20 hidden md:block"></div>
    <div className="h-6 bg-slate-100 rounded-lg w-16 hidden md:block"></div>
    <div className="h-8 bg-slate-100 rounded-lg w-24 hidden md:block"></div>
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

    if (filterRole === 'isAdmin') queryConstraints.push(where('isAdmin', '==', true));
    else if (filterRole === 'isMasterAdmin') queryConstraints.push(where('isMasterAdmin', '==', true));
    else if (filterRole === 'isClient') queryConstraints.push(where('isAdmin', '==', false), where('isMasterAdmin', '==', false));
    
    if (filterStatus === 'ativo') queryConstraints.push(where('ativo', '==', true));
    else if (filterStatus === 'inativo') queryConstraints.push(where('ativo', '==', false));

    const q = query(baseQueryRef, ...queryConstraints, orderBy('nome', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingUsers(false);
    }, (err) => { console.error(err); setError("Erro ao carregar usuários."); setLoadingUsers(false); });

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

  const filteredUsers = useMemo(() => {
    return usuarios.filter(user => {
      const term = searchTerm.toLowerCase();
      return (user.nome && user.nome.toLowerCase().includes(term)) || (user.email && user.email.toLowerCase().includes(term));
    });
  }, [usuarios, searchTerm]);

  const stats = useMemo(() => ({
    total: usuarios.length,
    admins: usuarios.filter(u => u.isAdmin || u.isMasterAdmin).length,
    active: usuarios.filter(u => u.ativo).length,
    clients: usuarios.filter(u => !u.isAdmin && !u.isMasterAdmin).length,
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
    if (user.isMasterAdmin) return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-yellow-50 text-yellow-700 border border-yellow-200"><FaUserShield className="text-[8px]" /> Master</span>;
    if (user.isAdmin) return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">Admin</span>;
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-50 text-slate-500 border border-slate-200">Cliente</span>;
  };

  const userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Admin';

  if (authLoading) return <div className="flex h-screen items-center justify-center bg-slate-50"><div className="w-12 h-12 border-4 border-slate-200 border-t-yellow-400 rounded-full animate-spin"></div></div>;

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-amber-50/20 min-h-screen font-sans">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 h-16 border-b border-slate-100 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-md shadow-yellow-400/25 group-hover:scale-105 transition-transform">
              <FaBolt className="text-white text-xs" />
            </div>
            <span className="text-slate-900 font-black text-lg tracking-tight">Idea<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-amber-500">Food</span></span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center justify-center"><FaCrown className="text-yellow-600 text-[10px]" /></div>
              <span className="text-sm font-bold text-slate-700">{userName}</span>
            </div>
            <button onClick={async () => { await logout(); navigate('/'); }} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"><FaSignOutAlt size={14} /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-16">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <button onClick={() => navigate('/master-dashboard')} className="text-slate-400 hover:text-yellow-600 flex items-center gap-2 mb-4 text-sm font-bold transition-colors group">
              <span className="bg-white p-1.5 rounded-lg shadow-sm border border-slate-100 group-hover:border-yellow-200 transition-colors"><FaArrowLeft /></span> Voltar ao Dashboard
            </button>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-yellow-50 text-yellow-700 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-yellow-200">Controle de Acessos</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Usuários</h1>
            <p className="text-slate-500 text-sm mt-1 font-medium">Gerencie clientes, administradores e privilégios.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={handleRefreshUsers} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:border-yellow-400 hover:text-yellow-600 transition-all text-[11px] font-bold shadow-sm active:scale-95">
              <FaRedo className="text-slate-400" /> Sincronizar
            </button>
            <Link to="/master/usuarios/criar" state={{ refresh: true }}
              className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-white px-5 py-2.5 rounded-xl hover:shadow-xl hover:shadow-yellow-400/30 transition-all shadow-lg shadow-yellow-400/20 font-black text-[11px] active:scale-95">
              <FaPlus /> Novo Usuário
            </Link>
          </div>
        </div>

        {/* STAT CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Registrados', value: stats.total, icon: <FaUsersCog />, color: 'yellow' },
            { label: 'Admins', value: stats.admins, icon: <FaUserShield />, color: 'amber' },
            { label: 'Contas Ativas', value: stats.active, icon: <FaCheckCircle />, color: 'emerald' },
            { label: 'Clientes', value: stats.clients, icon: <FaUser />, color: 'slate' },
          ].map((card, i) => (
            <div key={i} className={`group relative overflow-hidden rounded-2xl border p-5 hover:shadow-lg transition-all duration-300 ${
              card.color === 'yellow' ? 'border-yellow-100 bg-gradient-to-br from-yellow-50 to-amber-50/50' :
              card.color === 'amber' ? 'border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50/50' :
              card.color === 'emerald' ? 'border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50/50' :
              'border-slate-100 bg-white'
            }`}>
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">{card.label}</p>
                  <p className="text-2xl font-black text-slate-900">{card.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${
                  card.color === 'yellow' ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-md shadow-yellow-400/25' :
                  card.color === 'amber' ? 'bg-white text-amber-500 shadow-sm' :
                  card.color === 'emerald' ? 'bg-white text-emerald-500 shadow-sm' :
                  'bg-white text-slate-400 shadow-sm'
                }`}>{card.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-600 p-4 mb-6 rounded-xl text-sm font-bold flex items-center gap-2"><FaPowerOff /> {error}</div>}

        {/* FILTER BAR */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <IoSearchOutline className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar por nome ou e-mail..."
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 focus:bg-white transition-all font-semibold text-slate-700 text-sm"
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-600 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 appearance-none cursor-pointer">
              <option value="todos">Todos Papéis</option>
              <option value="isClient">Clientes</option>
              <option value="isAdmin">Admins</option>
              <option value="isMasterAdmin">Masters</option>
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-600 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 appearance-none cursor-pointer">
              <option value="todos">Todos Status</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </select>
          </div>
        </div>

        {/* TABLE / CARDS */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {loadingUsers && usuarios.length === 0 ? (
            <div>{[1,2,3,4,5,6].map(i => <SkeletonRow key={i} />)}</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FaUser className="text-2xl text-slate-200" />
              </div>
              <p className="font-black text-slate-500 text-sm">Nenhum usuário encontrado</p>
              <p className="text-[11px] text-slate-400 mt-1">Verifique os filtros ou crie um novo cadastro.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-4 text-[10px] uppercase tracking-widest text-slate-400 font-black">Perfil</th>
                      <th className="px-5 py-4 text-[10px] uppercase tracking-widest text-slate-400 font-black">Acesso</th>
                      <th className="px-5 py-4 text-[10px] uppercase tracking-widest text-slate-400 font-black">Lojas</th>
                      <th className="px-5 py-4 text-[10px] uppercase tracking-widest text-slate-400 font-black">Status</th>
                      <th className="px-5 py-4 text-[10px] uppercase tracking-widest text-slate-400 font-black text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredUsers.map(user => (
                      <tr key={user.id} className="hover:bg-yellow-50/20 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 font-black text-sm">
                              {user.nome ? user.nome.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-800 tracking-tight">{user.nome || 'Sem Nome'}</p>
                              <p className="text-[11px] text-slate-400 font-medium">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">{getRoleBadge(user)}</td>
                        <td className="px-5 py-4">
                          {user.isAdmin && user.estabelecimentosGerenciados?.length > 0 ? (
                            <div className="flex -space-x-1.5">
                              {user.estabelecimentosGerenciados.slice(0, 3).map(eid => (
                                <div key={eid} className="w-7 h-7 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-[9px] font-black text-slate-500 shadow-sm hover:z-10 hover:scale-110 transition-transform cursor-help" title={estabelecimentosMap[eid] || eid}>
                                  {(estabelecimentosMap[eid] || 'L').charAt(0).toUpperCase()}
                                </div>
                              ))}
                              {user.estabelecimentosGerenciados.length > 3 && (
                                <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-400">
                                  +{user.estabelecimentosGerenciados.length - 3}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-300 font-medium italic">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {user.ativo ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md text-[10px] font-bold border border-emerald-100">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 px-2.5 py-1 rounded-md text-[10px] font-bold border border-red-100">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span> Inativo
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Link to={`/master/usuarios/${user.id}/editar`}
                              className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-white border border-transparent hover:border-yellow-400 rounded-lg text-slate-400 hover:text-yellow-600 transition-all" title="Editar">
                              <FaEdit size={12} />
                            </Link>
                            <button onClick={() => toggleUserAtivo(user.id, user.ativo, user.nome)} disabled={currentUser.uid === user.id}
                              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed ${user.ativo ? 'bg-slate-100 hover:bg-red-500 text-slate-400 hover:text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`}
                              title={user.ativo ? "Desativar" : "Ativar"}>
                              {user.ativo ? <FaPowerOff size={10} /> : <FaCheck size={10} />}
                            </button>
                            <button onClick={() => handleDeleteUser(user.id, user.nome)} disabled={currentUser.uid === user.id}
                              className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 hover:bg-red-500 hover:border-red-500 text-slate-300 hover:text-white rounded-lg transition-all active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed" title="Deletar">
                              <FaTrash size={10} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-slate-50">
                {filteredUsers.map(user => (
                  <div key={user.id} className="p-4 hover:bg-yellow-50/20 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 font-black text-sm">
                          {user.nome ? user.nome.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <p className="font-black text-slate-800 text-sm">{user.nome || 'Sem Nome'}</p>
                          <p className="text-[11px] text-slate-400">{user.email}</p>
                        </div>
                      </div>
                      {getRoleBadge(user)}
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                      <div className="flex items-center gap-2">
                        {user.ativo ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md text-[10px] font-bold border border-emerald-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 px-2 py-0.5 rounded-md text-[10px] font-bold border border-red-100">Inativo</span>
                        )}
                        {user.isAdmin && user.estabelecimentosGerenciados?.length > 0 && (
                          <span className="text-[10px] text-slate-400 font-medium"><FaStore className="inline mr-1" />{user.estabelecimentosGerenciados.length} lojas</span>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <Link to={`/master/usuarios/${user.id}/editar`} className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-yellow-50 rounded-lg text-slate-400 hover:text-yellow-600 transition-all">
                          <FaEdit size={12} />
                        </Link>
                        <button onClick={() => toggleUserAtivo(user.id, user.ativo, user.nome)} disabled={currentUser.uid === user.id}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-95 disabled:opacity-20 ${user.ativo ? 'bg-slate-100 hover:bg-red-500 text-slate-400 hover:text-white' : 'bg-emerald-500 text-white'}`}>
                          {user.ativo ? <FaPowerOff size={10} /> : <FaCheck size={10} />}
                        </button>
                        <button onClick={() => handleDeleteUser(user.id, user.nome)} disabled={currentUser.uid === user.id}
                          className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 hover:bg-red-500 hover:text-white text-slate-300 rounded-lg transition-all active:scale-95 disabled:opacity-20">
                          <FaTrash size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Quick stats footer */}
        <div className="flex items-center justify-center gap-3 mt-6 text-[11px] font-bold text-slate-300">
          <span>{stats.total} registros</span>
          <span>•</span>
          <span>{stats.active} ativos</span>
          <span>•</span>
          <span>{stats.admins} privilegiados</span>
        </div>
      </main>
    </div>
  );
}

export default ListarUsuariosMaster;