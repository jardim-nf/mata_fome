// src/pages/admin/ListarUsuariosMaster.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, getDocs, limit, startAfter, orderBy, endBefore, limitToLast } from 'firebase/firestore'; 
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger'; 

const ITEMS_PER_PAGE = 10; 

// --- Componente de Header Master Dashboard (reutilizado) ---
// Normalmente, isso estaria em um Layout.jsx ou componente separado.
// Mantido aqui para demonstração completa.
function DashboardHeader({ currentUser, logout, navigate }) {
  const userEmailPrefix = currentUser.email ? currentUser.email.split('@')[0] : 'Usuário';

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Você foi desconectado com sucesso!');
      navigate('/');
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      toast.error('Ocorreu um erro ao tentar desconectar.');
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-20 p-6 flex justify-between items-center bg-black shadow-md border-b border-gray-800">
      <div className="font-extrabold text-2xl text-white cursor-pointer hover:text-gray-200 transition-colors duration-300" onClick={() => navigate('/')}>
        DEU FOME <span className="text-yellow-500">.</span>
      </div>
      <div className="flex items-center space-x-4">
        <span className="text-white text-md font-medium">Olá, {userEmailPrefix}!</span>
        <Link to="/master-dashboard" className="px-4 py-2 rounded-full text-black bg-yellow-500 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-yellow-600 hover:shadow-md">
            Dashboard
        </Link>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-full text-white border border-gray-600 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-gray-800 hover:border-gray-500"
        >
          Sair
        </button>
      </div>
    </header>
  );
}
// --- Fim DashboardHeader ---


function ListarUsuariosMaster() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth(); // Adicionei logout para o header

  const [usuarios, setUsuarios] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState('');
  const [estabelecimentosMap, setEstabelecimentosMap] = useState({});

  // Estados para busca e filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');

  // ESTADOS DE PAGINAÇÃO
  const [lastVisible, setLastVisible] = useState(null);
  const [firstVisible, setFirstVisible] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [hasPrevious, setHasPrevious] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isMasterAdmin) {
        toast.error('Acesso negado. Você não tem permissões de Master Administrador.');
        navigate('/master-dashboard');
        return;
      }
      // O setLoadingUsers(false) agora é chamado após o fetchUsuarios na primeira carga
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  useEffect(() => {
    const fetchEstabelecimentos = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'estabelecimentos'));
        const map = {};
        querySnapshot.forEach(doc => {
          map[doc.id] = doc.data().nome;
        });
        setEstabelecimentosMap(map);
      } catch (err) {
        console.error("Erro ao carregar nomes de estabelecimentos:", err);
      }
    };
    fetchEstabelecimentos();
  }, []);

  // Função para carregar usuários com paginação e filtros
  const fetchUsuarios = useCallback(async (direction = 'next', startDoc = null) => {
    if (!isMasterAdmin || !currentUser) return;

    setLoadingUsers(true);
    setError('');

    let baseQuery = collection(db, 'usuarios');
    let queryConstraints = [];

    // Filtros de Role e Status (aplicados na query do Firestore)
    if (filterRole === 'isAdmin') {
      queryConstraints.push(where('isAdmin', '==', true));
    } else if (filterRole === 'isMasterAdmin') {
      queryConstraints.push(where('isMasterAdmin', '==', true));
    } else if (filterRole === 'isClient') { // Adicionado filtro para clientes comuns
        queryConstraints.push(where('isAdmin', '==', false), where('isMasterAdmin', '==', false));
    }
    
    if (filterStatus === 'ativo') {
      queryConstraints.push(where('ativo', '==', true));
    } else if (filterStatus === 'inativo') {
      queryConstraints.push(where('ativo', '==', false));
    }

    // A paginação sempre precisa de uma ordenação consistente
    queryConstraints.push(orderBy('nome', 'asc')); 

    let q;
    if (direction === 'next' && startDoc) {
      q = query(baseQuery, ...queryConstraints, startAfter(startDoc), limit(ITEMS_PER_PAGE));
    } else if (direction === 'prev' && startDoc) {
        // Para paginação reversa, precisamos de um truque: ordernar decrescente, pegar o limite, e reverter a ordem
        q = query(baseQuery, ...queryConstraints, endBefore(startDoc), limitToLast(ITEMS_PER_PAGE));
    } else { // Primeira carga ou reset de filtros
      q = query(baseQuery, ...queryConstraints, limit(ITEMS_PER_PAGE));
    }

    try {
      const documentSnapshots = await getDocs(q);
      let fetchedUsers = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Se for "anterior", precisamos reverter a ordem se a query usou limitToLast
      if (direction === 'prev') {
        fetchedUsers.reverse();
      }

      setUsuarios(fetchedUsers);
      
      if (documentSnapshots.docs.length > 0) {
        setFirstVisible(documentSnapshots.docs[0]);
        setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
        
        // Verificar se há mais páginas à frente
        const nextQueryCheck = query(baseQuery, ...queryConstraints, startAfter(documentSnapshots.docs[documentSnapshots.docs.length - 1]), limit(1));
        const nextSnapshotCheck = await getDocs(nextQueryCheck);
        setHasMore(!nextSnapshotCheck.empty);

        // Verificar se há páginas anteriores (se não for a primeira página)
        if (currentPage > 0) {
            const prevQueryCheck = query(baseQuery, ...queryConstraints, endBefore(documentSnapshots.docs[0]), limit(1));
            const prevSnapshotCheck = await getDocs(prevQueryCheck);
            setHasPrevious(!prevSnapshotCheck.empty);
        } else {
            setHasPrevious(false);
        }

      } else {
        setFirstVisible(null);
        setLastVisible(null);
        setHasMore(false);
        setHasPrevious(false);
      }
      
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
      setError("Erro ao carregar a lista de usuários.");
    } finally {
      setLoadingUsers(false);
    }
  }, [isMasterAdmin, currentUser, filterRole, filterStatus, currentPage]); 

  // Efeito para carregar usuários na montagem e quando filtros/paginação mudam
  useEffect(() => {
    // Apenas carrega os usuários se o authLoading já terminou E for master admin
    if (!authLoading && isMasterAdmin && currentUser) {
        setLastVisible(null);
        setFirstVisible(null);
        setCurrentPage(0);
        setHasMore(true);
        setHasPrevious(false);
        fetchUsuarios('next', null);
    } else if (!authLoading && (!currentUser || !isMasterAdmin)) {
        // Se não é master admin, a mensagem de acesso negado já foi exibida
        setLoadingUsers(false); // Para parar o loading state
    }
  }, [authLoading, isMasterAdmin, currentUser, filterRole, filterStatus]); // Removido fetchUsuarios das deps para evitar loop

  // Gerenciamento de Paginação
  const handleNextPage = () => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
      fetchUsuarios('next', lastVisible);
    }
  };

  const handlePreviousPage = () => {
    if (hasPrevious) { // Usa hasPrevious para verificar se há página anterior
      setCurrentPage(prev => prev - 1);
      fetchUsuarios('prev', firstVisible); // Passa firstVisible para endBefore
    }
  };

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
      await updateDoc(userRef, { ativo: !currentStatus });
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
        // Nota: A exclusão do usuário do Firebase Auth deve ser feita no backend (Cloud Functions)
        // por razões de segurança e permissões. Apenas o documento do Firestore é deletado aqui.
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
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
          <p className="text-xl text-black">Carregando usuários...</p>
        </div>
    );
  }

  if (!currentUser || !isMasterAdmin) {
    return null; // O redirecionamento já é tratado no useEffect inicial
  }

  return (
    <div className="bg-gray-50 min-h-screen pt-24 pb-8 px-4"> {/* Fundo principal levemente cinza */}
      <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} /> 
      <div className="max-w-7xl mx-auto">
        {/* Título da Página e Botões de Ação */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h1 className="text-3xl font-extrabold text-black text-center sm:text-left">
            Gerenciar Usuários
            <div className="w-24 h-1 bg-yellow-500 mx-auto sm:mx-0 mt-2 rounded-full"></div>
          </h1>
          <div className="flex flex-wrap gap-3 justify-center sm:justify-end">
            <Link 
              to="/master-dashboard" 
              className="bg-gray-200 text-gray-700 font-semibold px-5 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-300 flex items-center gap-2 shadow-md"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"></path></svg>
              Voltar
            </Link>
            <Link to="/master/usuarios/criar" 
                  className="bg-yellow-500 text-black font-semibold px-5 py-2 rounded-lg hover:bg-yellow-600 transition-colors duration-300 flex items-center gap-2 shadow-md">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"></path></svg>
              Criar Novo Usuário
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md" role="alert">
            <p className="font-bold">Erro:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Seção de Filtro e Busca */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-100">
          <h2 className="text-xl font-bold mb-4 text-black">Filtrar Usuários</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700 mb-1">Buscar por Nome/E-mail:</label>
              <input
                type="text"
                id="searchTerm"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 p-2 text-gray-800"
                placeholder="Pesquisar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="filterRole" className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Papel:</label>
              <select
                id="filterRole"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 p-2 bg-white text-gray-800"
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
              >
                <option value="todos">Todos os Papéis</option>
                <option value="isClient">Clientes Comuns</option> {/* NOVO: Opção para Clientes Comuns */}
                <option value="isAdmin">Administradores Estabelecimento</option>
                <option value="isMasterAdmin">Master Administradores</option>
              </select>
            </div>
            <div>
              <label htmlFor="filterStatus" className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Status:</label>
              <select
                id="filterStatus"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 p-2 bg-white text-gray-800"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="todos">Todos os Status</option>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabela de Usuários */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
          <h2 className="text-xl font-bold mb-4 text-black">Lista de Usuários</h2>
          <div className="overflow-x-auto">
            {filteredUsuariosBySearchTerm.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhum usuário encontrado com os critérios de busca/filtro.</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">Nome</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">E-mail</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">Admin Estab.</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">Master Admin</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">Estabelecimentos Gerenciados</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-black uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsuariosBySearchTerm.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.nome || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {user.email || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.isAdmin ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600' // Amarelo para Sim, Cinza para Não
                        }`}>
                          {user.isAdmin ? 'Sim' : 'Não'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.isMasterAdmin ? 'bg-yellow-500 text-black' : 'bg-gray-100 text-gray-600' // Amarelo forte para Master Admin
                        }`}>
                          {user.isMasterAdmin ? 'Sim' : 'Não'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-normal text-sm text-gray-600 max-w-xs">
                          {user.isAdmin && user.estabelecimentosGerenciados && user.estabelecimentosGerenciados.length > 0 ? (
                              user.estabelecimentosGerenciados.map((estabId, index) => (
                                  <span key={estabId} className="block text-xs text-gray-600">
                                      {estabelecimentosMap[estabId] || `ID: ${estabId.substring(0, 5)}...`}
                                      {index < user.estabelecimentosGerenciados.length - 1 ? ',' : ''}
                                  </span>
                              ))
                          ) : user.isAdmin ? <span className="text-gray-500 text-xs">Nenhum</span> : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800' // Manter verde/vermelho para status ativo/inativo
                        }`}>
                          {user.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-2">
                        <Link
                          to={`/master/usuarios/${user.id}/editar`}
                          className="px-3 py-1 rounded-md bg-black hover:bg-gray-800 text-white transition-colors duration-300"
                        >
                          Editar
                        </Link>
                        <button
                          onClick={() => toggleUserAtivo(user.id, user.ativo, user.nome)}
                          className={`px-3 py-1 rounded-md text-white ${
                            user.ativo ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600' // Manter vermelho/verde para Ativar/Desativar
                          }`}
                          disabled={currentUser.uid === user.id}
                        >
                          {user.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.nome)}
                          className="px-3 py-1 rounded-md bg-gray-500 hover:bg-gray-600 text-white"
                          disabled={currentUser.uid === user.id}
                        >
                          Deletar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* CONTROLES DE PAGINAÇÃO */}
          <div className="flex justify-center items-center mt-8 space-x-4">
            <button
              onClick={handlePreviousPage}
              disabled={!hasPrevious || loadingUsers}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md font-semibold hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300"
            >
              Anterior
            </button>
            <span className="text-gray-700 font-medium">Página {currentPage + 1}</span>
            <button
              onClick={handleNextPage}
              disabled={!hasMore || loadingUsers}
              className="px-4 py-2 bg-yellow-500 text-black rounded-md font-semibold hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ListarUsuariosMaster;