import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, orderBy, where, getDocs } from 'firebase/firestore'; 
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger'; 
import { 
  FaArrowLeft, FaPlus, FaEdit, FaTrash, FaPowerOff, FaCheck,
  FaRedo, FaStore, FaUserShield, FaUser, FaUsersCog, FaCheckCircle, FaBolt
} from 'react-icons/fa';
import { IoSearchOutline, IoLogOutOutline } from 'react-icons/io5';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SkeletonRow = () => (
  <div className="bg-white border border-[#E5E5EA] p-6 rounded-[2rem] shadow-sm animate-pulse flex flex-col gap-4">
    <div className="flex justify-between items-start">
        <div className="w-12 h-12 rounded-[1rem] bg-[#F5F5F7] border border-[#E5E5EA]"></div>
        <div className="w-16 h-6 rounded-full bg-[#F5F5F7]"></div>
    </div>
    <div className="space-y-2">
        <div className="h-4 bg-[#F5F5F7] rounded-lg w-32"></div>
        <div className="h-3 bg-[#F5F5F7] rounded-lg w-48"></div>
    </div>
    <div className="pt-4 border-t border-[#F5F5F7] mt-2 flex justify-between">
        <div className="h-4 bg-[#F5F5F7] rounded-lg w-20"></div>
        <div className="h-6 bg-[#F5F5F7] rounded-lg w-16"></div>
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
    active: usuarios.filter(u => u.ativo !== false).length,
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
    if (user.isMasterAdmin) return <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FFF9EB] text-[#F59E0B] border border-[#FDE68A]"><FaUserShield size={10} /> Master</span>;
    if (user.isAdmin) return <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#EFF6FF] text-[#3B82F6] border border-[#BFDBFE]">Admin</span>;
    return <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#F5F5F7] text-[#86868B] border border-[#E5E5EA]">Cliente</span>;
  };

  if (authLoading) return <div className="flex h-screen items-center justify-center bg-[#F5F5F7]"><FaBolt className="text-[#86868B] text-4xl animate-pulse" /></div>;

  return (
    <div className="bg-[#F5F5F7] min-h-screen font-sans text-[#1D1D1F] pb-24 pt-4 px-4 sm:px-8">
      
      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className="max-w-[1400px] mx-auto bg-white/70 backdrop-blur-xl border border-white/50 shadow-sm rounded-full h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/master-dashboard')} className="w-9 h-9 bg-[#F5F5F7] hover:bg-[#E5E5EA] rounded-full flex items-center justify-center transition-colors">
            <FaArrowLeft className="text-[#86868B] text-sm" />
          </button>
          <div className="hidden sm:block border-l border-[#E5E5EA] pl-4">
            <h1 className="font-semibold text-sm tracking-tight text-black">Acessos & Usuários</h1>
            <p className="text-[11px] text-[#86868B] font-medium">{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-px h-6 bg-[#E5E5EA] hidden sm:block" />
          <button onClick={async () => { await logout(); navigate('/'); }} className="w-9 h-9 bg-red-50 hover:bg-red-100 rounded-full flex items-center justify-center transition-colors">
            <IoLogOutOutline className="text-red-500" size={16} />
          </button>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto mt-8">
        
        {/* HEADER DA PÁGINA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 px-2">
          <div>
            <div className="flex items-center gap-3 mb-2">
                <span className="bg-[#F5F5F7] border border-[#E5E5EA] text-[#86868B] text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full">Controle de Segurança</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-[#1D1D1F]">Gestão de Usuários</h1>
            <p className="text-[#86868B] text-sm mt-1 font-medium">Controle de clientes, administradores e privilégios do sistema.</p>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={handleRefreshUsers} className="flex items-center gap-2 px-5 py-3 bg-white border border-[#E5E5EA] rounded-full hover:border-[#86868B] transition-colors text-xs font-bold text-[#1D1D1F] shadow-sm">
               <FaRedo /> Sincronizar
             </button>
             <Link to="/master/usuarios/criar" state={{ refresh: true }} className="flex items-center gap-2 px-5 py-3 bg-[#1D1D1F] text-white rounded-full hover:bg-black transition-colors text-xs font-bold shadow-sm">
               <FaPlus /> Novo Usuário
             </Link>
          </div>
        </div>

        {/* STAT CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Registrados', value: stats.total, icon: <FaUsersCog />, isDark: false },
            { label: 'Admins', value: stats.admins, icon: <FaUserShield />, isDark: false },
            { label: 'Contas Ativas', value: stats.active, icon: <FaCheckCircle />, isDark: true },
            { label: 'Clientes', value: stats.clients, icon: <FaUser />, isDark: false },
          ].map((card, i) => (
            <div key={i} className={`rounded-[2rem] p-6 shadow-sm border ${card.isDark ? 'bg-[#1D1D1F] border-[#1D1D1F] text-white' : 'bg-white border-[#E5E5EA] text-[#1D1D1F]'} hover:shadow-md transition-shadow`}>
                <div className="flex justify-between items-start mb-4">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${card.isDark ? 'text-white/60' : 'text-[#86868B]'}`}>{card.label}</p>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${card.isDark ? 'bg-white/10 text-white' : 'bg-[#F5F5F7] text-[#1D1D1F]'}`}>
                        {card.icon}
                    </div>
                </div>
                <h3 className="text-3xl font-black">{card.value}</h3>
            </div>
          ))}
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-600 p-4 mb-6 rounded-2xl text-sm font-bold flex items-center gap-2"><FaPowerOff /> {error}</div>}

        {/* FILTROS PILL-STYLE */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
            <div className="relative w-full sm:flex-1 bg-white border border-[#E5E5EA] rounded-full px-5 py-3 flex items-center shadow-sm hover:border-[#86868B] transition-colors focus-within:border-black">
                <IoSearchOutline className="text-[#86868B] shrink-0" size={16} />
                <input 
                    type="text" 
                    placeholder="Buscar por nome ou e-mail..."
                    className="bg-transparent border-none outline-none text-sm ml-3 w-full font-bold text-[#1D1D1F] placeholder:text-[#86868B] placeholder:font-medium"
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                />
            </div>
            
            <div className="flex gap-4 w-full sm:w-auto">
                <div className="relative w-full sm:w-auto bg-white border border-[#E5E5EA] rounded-full px-5 py-3 flex items-center shadow-sm hover:border-[#86868B] transition-colors">
                    <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="bg-transparent border-none outline-none text-xs w-full sm:min-w-[140px] font-bold text-[#1D1D1F] cursor-pointer appearance-none">
                        <option value="todos">Todos os Papéis</option>
                        <option value="isClient">Clientes</option>
                        <option value="isAdmin">Admins</option>
                        <option value="isMasterAdmin">Masters</option>
                    </select>
                    <div className="pointer-events-none absolute right-5 text-[#86868B] text-[10px]">▼</div>
                </div>
                <div className="relative w-full sm:w-auto bg-white border border-[#E5E5EA] rounded-full px-5 py-3 flex items-center shadow-sm hover:border-[#86868B] transition-colors">
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-transparent border-none outline-none text-xs w-full sm:min-w-[140px] font-bold text-[#1D1D1F] cursor-pointer appearance-none">
                        <option value="todos">Todos os Status</option>
                        <option value="ativo">Ativos</option>
                        <option value="inativo">Inativos</option>
                    </select>
                    <div className="pointer-events-none absolute right-5 text-[#86868B] text-[10px]">▼</div>
                </div>
            </div>
        </div>

        {/* BENTO GRID: LISTA DE USUÁRIOS */}
        {loadingUsers && usuarios.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[1,2,3,4].map(i => <SkeletonRow key={i} />)}
            </div>
        ) : filteredUsers.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-[2rem] border border-[#E5E5EA] shadow-sm">
                <div className="w-16 h-16 bg-[#F5F5F7] border border-[#E5E5EA] rounded-full mx-auto flex items-center justify-center mb-4">
                    <FaUser className="text-2xl text-[#86868B]" />
                </div>
                <h3 className="text-lg font-bold text-[#1D1D1F] tracking-tight">Nenhum Usuário Encontrado</h3>
                <p className="text-[#86868B] font-medium text-sm mt-1">Refine sua busca ou cadastre um novo acesso.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredUsers.map(user => (
                    <div key={user.id} className="bg-white border border-[#E5E5EA] p-6 rounded-[2rem] shadow-sm hover:shadow-md hover:border-black/20 transition-all duration-300 relative group flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-[1rem] bg-[#F5F5F7] border border-[#E5E5EA] flex items-center justify-center text-[#1D1D1F] font-black text-lg shadow-sm">
                                {user.nome ? user.nome.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                {getRoleBadge(user)}
                                {user.ativo !== false ? (
                                    <span className="text-[10px] w-fit font-bold flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 uppercase tracking-widest"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Ativo</span>
                                ) : (
                                    <span className="text-[10px] w-fit font-bold flex items-center gap-1.5 text-red-600 bg-red-50 px-2 py-1 rounded-md border border-red-100 uppercase tracking-widest"><span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> Inativo</span>
                                )}
                            </div>
                        </div>

                        <div className="mb-4">
                            <h3 className="text-lg font-black text-[#1D1D1F] line-clamp-1 truncate" title={user.nome || 'Sem Nome'}>
                                {user.nome || 'Sem Nome'}
                            </h3>
                            <p className="text-sm text-[#86868B] font-medium truncate" title={user.email}>
                                {user.email}
                            </p>
                        </div>

                        <div className="bg-[#F5F5F7] p-3 rounded-2xl mb-6 flex-1 border border-[#E5E5EA] border-dashed text-center flex flex-col items-center justify-center min-h-[60px]">
                            {user.estabelecimentosGerenciados && user.estabelecimentosGerenciados.length > 0 ? (
                                <>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#86868B] mb-2"><FaStore className="inline mb-0.5 mr-1" /> Lojas Vinculadas</p>
                                    <div className="flex -space-x-2">
                                    {user.estabelecimentosGerenciados.slice(0, 4).map(eid => (
                                        <div key={eid} className="w-8 h-8 rounded-full bg-white border border-[#E5E5EA] flex items-center justify-center text-[10px] font-black text-[#1D1D1F] shadow-sm relative z-10 hover:z-20 hover:scale-110 transition-transform cursor-help" title={estabelecimentosMap[eid] || eid}>
                                           {(estabelecimentosMap[eid] || 'L').charAt(0).toUpperCase()}
                                        </div>
                                    ))}
                                    {user.estabelecimentosGerenciados.length > 4 && (
                                        <div className="w-8 h-8 rounded-full bg-[#1D1D1F] border border-[#1D1D1F] flex items-center justify-center text-[10px] font-bold text-white relative z-10">
                                           +{user.estabelecimentosGerenciados.length - 4}
                                        </div>
                                    )}
                                    </div>
                                </>
                            ) : (
                                <p className="text-xs font-bold text-[#86868B]">Sem Lojas Vinculadas</p>
                            )}
                        </div>

                        <div className="pt-4 border-t border-[#F5F5F7] flex items-center justify-end gap-2">
                            <Link to={`/master/usuarios/${user.id}/editar`} className="w-9 h-9 flex items-center justify-center bg-[#F5F5F7] border border-[#E5E5EA] hover:bg-[#1D1D1F] hover:text-white rounded-full text-[#1D1D1F] transition-all" title="Editar">
                                <FaEdit size={12} />
                            </Link>

                            <button onClick={() => toggleUserAtivo(user.id, user.ativo !== false, user.nome)} disabled={currentUser.uid === user.id}
                                className={`w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${user.ativo !== false ? 'bg-[#F5F5F7] border border-[#E5E5EA] text-[#1D1D1F] hover:bg-red-500 hover:text-white hover:border-red-500' : 'bg-emerald-500 text-white border border-emerald-500'}`}
                                title={user.ativo !== false ? "Desativar Conta" : "Ativar Conta"}>
                                {user.ativo !== false ? <FaPowerOff size={12} /> : <FaCheck size={12} />}
                            </button>
                            
                            <button onClick={() => handleDeleteUser(user.id, user.nome)} disabled={currentUser.uid === user.id}
                                className="w-9 h-9 flex items-center justify-center bg-[#F5F5F7] border border-[#E5E5EA] hover:bg-red-500 hover:text-white hover:border-red-500 text-[#1D1D1F] rounded-full transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed" title="Deletar">
                                <FaTrash size={12} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
      `}</style>
    </div>
  );
}

export default ListarUsuariosMaster;