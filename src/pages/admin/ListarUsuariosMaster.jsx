// src/pages/admin/ListarUsuariosMaster.jsx
import React, { useState, useEffect, useCallback } from 'react';
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
  FaUserCheck, 
  FaUserTimes,
  FaUsers,
  FaFilter,
  FaRedo
} from 'react-icons/fa';

// --- Componente de Header Master Dashboard ---
function DashboardHeader({ currentUser, logout, navigate }) {
  const userEmailPrefix = currentUser.email ? currentUser.email.split('@')[0] : 'Master';

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logout realizado com sucesso!');
      navigate('/');
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      toast.error('Erro ao fazer logout.');
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div 
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => navigate('/')}
          >
            <div className="bg-yellow-500 w-10 h-10 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-black font-bold text-xl">D</span>
            </div>
            <div>
              <span className="text-gray-900 font-bold text-2xl group-hover:text-yellow-600 transition-colors duration-300">
                DEU FOME
              </span>
              <span className="block text-xs text-gray-500 font-medium">MASTER DASHBOARD</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-3 bg-gray-50 rounded-lg px-4 py-2">
              <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center shadow-sm">
                <span className="text-black font-bold text-sm">M</span>
              </div>
              <div className="text-right">
                <p className="text-gray-900 text-sm font-semibold">Master Admin</p>
                <p className="text-gray-500 text-xs">{userEmailPrefix}</p>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-sm"
            >
              <FaUserTimes className="text-sm" />
              <span className="text-sm font-medium">Sair</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

// Componente de Card de Filtro
const FilterCard = ({ title, children }) => (
  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
      <FaFilter className="mr-2 text-yellow-600" />
      {title}
    </h3>
    {children}
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

  // Estado para unsubscribe do snapshot
  const [unsubscribe, setUnsubscribe] = useState(null);

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isMasterAdmin) {
        toast.error('Acesso negado. Você não tem permissões de Master Administrador.');
        navigate('/master-dashboard');
        return;
      }
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  // Efeito para detectar refresh da URL
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
        console.log("🏪 Carregando mapa de estabelecimentos...");
        const estabelecimentosSnapshot = await getDocs(collection(db, 'estabelecimentos'));
        const map = {};
        estabelecimentosSnapshot.forEach(doc => {
          map[doc.id] = doc.data().nome || `Estabelecimento ${doc.id.substring(0, 8)}`;
        });
        setEstabelecimentosMap(map);
        console.log("✅ Mapa de estabelecimentos carregado:", Object.keys(map).length, "estabelecimentos");
      } catch (err) {
        console.error("❌ Erro ao carregar nomes de estabelecimentos:", err);
        toast.error("Erro ao carregar estabelecimentos.");
      }
    };
    
    if (isMasterAdmin) {
      fetchEstabelecimentos();
    }
  }, [isMasterAdmin]);

  // Efeito principal para escutar usuários em tempo real
  useEffect(() => {
    if (!isMasterAdmin || !currentUser) {
      setLoadingUsers(false);
      return;
    }

    console.log("🔄 Iniciando escuta de usuários em tempo real...");
    setLoadingUsers(true);

    let baseQueryRef = collection(db, 'usuarios');
    let queryConstraints = [];

    // Aplicar filtros
    if (filterRole === 'isAdmin') {
      queryConstraints.push(where('isAdmin', '==', true));
    } else if (filterRole === 'isMasterAdmin') {
      queryConstraints.push(where('isMasterAdmin', '==', true));
    } else if (filterRole === 'isClient') { 
      queryConstraints.push(where('isAdmin', '==', false), where('isMasterAdmin', '==', false));
    }
    
    if (filterStatus === 'ativo') {
      queryConstraints.push(where('ativo', '==', true));
    } else if (filterStatus === 'inativo') {
      queryConstraints.push(where('ativo', '==', false));
    }

    const orderByField = 'nome';
    const q = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'asc'));

    const unsubscribeSnapshot = onSnapshot(q, 
      (querySnapshot) => {
        const fetchedUsers = querySnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        
        console.log(`✅ ${fetchedUsers.length} usuários carregados em tempo real`);
        setUsuarios(fetchedUsers);
        setLoadingUsers(false);
      },
      (error) => {
        console.error("❌ Erro ao carregar usuários:", error);
        setError("Erro ao carregar a lista de usuários.");
        toast.error('Erro ao carregar usuários.');
        setLoadingUsers(false);
      }
    );

    setUnsubscribe(() => unsubscribeSnapshot);

    // Cleanup
    return () => {
      if (unsubscribeSnapshot) {
        console.log("🧹 Limpando escuta de usuários");
        unsubscribeSnapshot();
      }
    };
  }, [isMasterAdmin, currentUser, filterRole, filterStatus]);

  // Função para recarregar manualmente
  const handleRefreshUsers = useCallback(() => {
    console.log("🔄 Recarregando usuários manualmente...");
    setSearchTerm('');
    setFilterRole('todos');
    setFilterStatus('todos');
    
    if (unsubscribe) {
      unsubscribe();
    }
    
    setLoadingUsers(true);
    toast.info('Recarregando usuários...');
    
    // Recarrega os dados do usuário e força refresh
    if (reloadUserData) {
      reloadUserData();
    }
    
    // Pequeno delay para garantir o cleanup
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }, [unsubscribe, reloadUserData]);

  // Filtragem por termo de busca no frontend
  const filteredUsuariosBySearchTerm = usuarios.filter(user => {
    const term = searchTerm.toLowerCase();
    const matchesName = (user.nome && user.nome.toLowerCase().includes(term));
    const matchesEmail = (user.email && user.email.toLowerCase().includes(term));
    return matchesName || matchesEmail;
  });

  // Funções de Ação do Usuário
  const toggleUserAtivo = async (userId, currentStatus, userName) => {
    if (currentUser.uid === userId) {
      toast.error('Você não pode desativar ou ativar sua própria conta.');
      return;
    }
    try {
      const userRef = doc(db, 'usuarios', userId);
      await updateDoc(userRef, { 
        ativo: !currentStatus,
        dataAtualizacao: new Date()
      });
      
      auditLogger(
        currentStatus ? 'USUARIO_DESATIVADO' : 'USUARIO_ATIVADO',
        { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
        { type: 'usuario', id: userId, name: userName },
        { oldValue: currentStatus, newValue: !currentStatus }
      );
      
      toast.success(`Usuário ${userName} ${currentStatus ? 'desativado' : 'ativado'} com sucesso!`);
    } catch (error) {
      console.error("Erro ao alternar status do usuário:", error);
      toast.error("Erro ao alternar status do usuário.");
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (currentUser.uid === userId) {
      toast.error('Você não pode deletar sua própria conta.');
      return;
    }
    
    if (window.confirm(`Tem certeza que deseja DELETAR o usuário "${userName}"? Esta ação é irreversível.`)) {
      try {
        await deleteDoc(doc(db, 'usuarios', userId));
        auditLogger(
          'USUARIO_DELETADO',
          { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
          { type: 'usuario', id: userId, name: userName }
        );
        toast.success(`Usuário "${userName}" deletado com sucesso!`);
      } catch (error) {
        console.error("Erro ao deletar usuário:", error);
        toast.error(`Erro ao deletar o usuário "${userName}".`);
      }
    }
  };

  if (authLoading || loadingUsers) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-900">
        <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xl font-semibold">Carregando usuários...</p>
      </div>
    );
  }

  if (!currentUser || !isMasterAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-8 px-4">
      <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} /> 
      
      <main className="max-w-7xl mx-auto">
        {/* Header da Página */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Gerenciar Usuários
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Controle completo de todos os usuários da plataforma
          </p>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <div className="flex items-center space-x-4">
            <Link 
              to="/master-dashboard" 
              className="flex items-center space-x-3 px-6 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-300 shadow-sm"
            >
              <FaArrowLeft />
              <span>Voltar ao Dashboard</span>
            </Link>
            
            <button
              onClick={handleRefreshUsers}
              disabled={loadingUsers}
              className="flex items-center space-x-3 px-6 py-3 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition-all duration-300 shadow-sm transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaRedo className={loadingUsers ? 'animate-spin' : ''} />
              <span>{loadingUsers ? 'Carregando...' : 'Recarregar'}</span>
            </button>
          </div>
          
          <Link 
            to="/master/usuarios/criar" 
            className="flex items-center space-x-3 px-6 py-3 bg-yellow-500 text-white font-semibold rounded-xl hover:bg-yellow-600 transition-all duration-300 shadow-sm transform hover:scale-105"
            state={{ refresh: true }}
          >
            <FaPlus />
            <span>Criar Novo Usuário</span>
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-xl" role="alert">
            <p className="font-bold">Erro:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Seção de Filtros */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <FilterCard title="Buscar Usuários">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all duration-300"
                placeholder="Pesquisar por nome ou e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </FilterCard>

          <FilterCard title="Filtrar por Papel">
            <select
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all duration-300 bg-white"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
            >
              <option value="todos">Todos os Papéis</option>
              <option value="isClient">Clientes Comuns</option>
              <option value="isAdmin">Administradores</option>
              <option value="isMasterAdmin">Master Admins</option>
            </select>
          </FilterCard>

          <FilterCard title="Filtrar por Status">
            <select
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all duration-300 bg-white"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="todos">Todos os Status</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </FilterCard>
        </div>

        {/* Tabela de Usuários */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <FaUsers className="mr-2 text-yellow-600" />
              Lista de Usuários
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({filteredUsuariosBySearchTerm.length} usuários)
              </span>
              <span className="ml-2 text-xs font-normal text-green-600 bg-green-100 px-2 py-1 rounded-full">
                Atualização em tempo real
              </span>
            </h2>
          </div>

          <div className="overflow-x-auto">
            {filteredUsuariosBySearchTerm.length === 0 ? (
              <div className="text-center py-12">
                <FaUsers className="text-gray-300 text-4xl mx-auto mb-4" />
                <p className="text-gray-500 text-lg">Nenhum usuário encontrado</p>
                <p className="text-gray-400 text-sm mt-2">Tente ajustar os filtros de busca</p>
                <button
                  onClick={handleRefreshUsers}
                  className="mt-4 flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-300 mx-auto"
                >
                  <FaRedo />
                  <span>Recarregar</span>
                </button>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Usuário
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Papel
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Estabelecimentos
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsuariosBySearchTerm.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.nome || 'Nome não informado'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {user.email}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            ID: {user.id.substring(0, 8)}...
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col space-y-1">
                          {user.isMasterAdmin && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Master Admin
                            </span>
                          )}
                          {user.isAdmin && !user.isMasterAdmin && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Admin Estabelecimento
                            </span>
                          )}
                          {!user.isAdmin && !user.isMasterAdmin && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              Cliente
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                        {user.isAdmin && user.estabelecimentosGerenciados && Array.isArray(user.estabelecimentosGerenciados) && user.estabelecimentosGerenciados.length > 0 ? (
                          <div className="space-y-1">
                            {user.estabelecimentosGerenciados.slice(0, 2).map((estabId) => (
                              <div key={estabId} className="text-xs text-gray-600">
                                {estabelecimentosMap[estabId] || `ID: ${estabId.substring(0, 8)}...`}
                              </div>
                            ))}
                            {user.estabelecimentosGerenciados.length > 2 && (
                              <div className="text-xs text-gray-400">
                                +{user.estabelecimentosGerenciados.length - 2} mais
                              </div>
                            )}
                          </div>
                        ) : user.isAdmin ? (
                          <span className="text-gray-400 text-xs">Nenhum estabelecimento</span>
                        ) : (
                          <span className="text-gray-400 text-xs">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {user.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center space-x-2">
                          <Link
                            to={`/master/usuarios/${user.id}/editar`}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-300"
                          >
                            <FaEdit className="mr-1" />
                            Editar
                          </Link>
                          <button
                            onClick={() => toggleUserAtivo(user.id, user.ativo, user.nome)}
                            disabled={currentUser.uid === user.id}
                            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-white transition-colors duration-300 ${
                              user.ativo 
                                ? 'bg-red-500 hover:bg-red-600' 
                                : 'bg-green-500 hover:bg-green-600'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {user.ativo ? <FaUserTimes className="mr-1" /> : <FaUserCheck className="mr-1" />}
                            {user.ativo ? 'Desativar' : 'Ativar'}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id, user.nome)}
                            disabled={currentUser.uid === user.id}
                            className="inline-flex items-center px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <FaTrash className="mr-1" />
                            Deletar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer com informações */}
          <div className="px-6 py-3 border-t border-gray-200 bg-green-50">
            <div className="text-center">
              <span className="text-green-700 text-sm font-medium">
                ✅ {usuarios.length} usuários carregados - Atualização em tempo real ativa
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ListarUsuariosMaster;