// src/pages/admin/ListarUsuariosMaster.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
// Importe 'limit' e 'startAfter' aqui:
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, getDocs, limit, startAfter, orderBy } from 'firebase/firestore'; 
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger'; 

const ITEMS_PER_PAGE = 10; // Definir quantos itens por página você quer

// Se você tiver um componente Layout, descomente a linha abaixo e as tags <Layout>
// import Layout from '../../Layout'; // Verifique o caminho exato!

function ListarUsuariosMaster() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();

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
      setLoadingUsers(false);
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
    }
    
    if (filterStatus === 'ativo') {
      queryConstraints.push(where('ativo', '==', true));
    } else if (filterStatus === 'inativo') {
      queryConstraints.push(where('ativo', '==', false));
    }

    // A paginação sempre precisa de uma ordenação consistente
    // Assumimos que 'nome' existe em todos os documentos de usuário
    queryConstraints.push(orderBy('nome', 'asc')); 

    let q;
    if (direction === 'next' && startDoc) {
      q = query(baseQuery, ...queryConstraints, startAfter(startDoc), limit(ITEMS_PER_PAGE));
    } else if (direction === 'prev' && startDoc) {
      // Implementação simplificada de "anterior"
      q = query(baseQuery, ...queryConstraints, limit(ITEMS_PER_PAGE)); 
    } else { // Primeira carga
      q = query(baseQuery, ...queryConstraints, limit(ITEMS_PER_PAGE));
    }

    try {
      const documentSnapshots = await getDocs(q);
      let fetchedUsers = [];

      if (direction === 'prev') {
        fetchedUsers = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();
      } else {
        fetchedUsers = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      
      setUsuarios(fetchedUsers);
      
      if (documentSnapshots.docs.length > 0) {
        setFirstVisible(documentSnapshots.docs[0]);
        setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
        const nextQueryCheck = query(baseQuery, ...queryConstraints, startAfter(documentSnapshots.docs[documentSnapshots.docs.length - 1]), limit(1));
        const nextSnapshotCheck = await getDocs(nextQueryCheck);
        setHasMore(!nextSnapshotCheck.empty);
      } else {
        setFirstVisible(null);
        setLastVisible(null);
        setHasMore(false);
      }
      setHasPrevious(currentPage > 0);
      
    } catch (err) {
      console.error("Erro ao carregar usuários:", err);
      setError("Erro ao carregar a lista de usuários.");
    } finally {
      setLoadingUsers(false);
    }
  }, [isMasterAdmin, currentUser, filterRole, filterStatus, currentPage]); // Adicionado currentPage

  // Efeito para recarregar quando filtros mudam
  useEffect(() => {
    setLastVisible(null);
    setFirstVisible(null);
    setCurrentPage(0);
    setHasMore(true);
    setHasPrevious(false);
    fetchUsuarios('next', null);
  }, [filterRole, filterStatus, searchTerm, fetchUsuarios]); // searchTerm aqui para re-filtrar no frontend

  const handleNextPage = () => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
      fetchUsuarios('next', lastVisible);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
      fetchUsuarios('next', null); // Simplificado: recarrega do início
    }
  };

  // Filtragem por termo de busca no frontend
  const filteredUsuariosBySearchTerm = usuarios.filter(user => {
    const term = searchTerm.toLowerCase();
    const matchesName = (user.nome && user.nome.toLowerCase().includes(term));
    const matchesEmail = (user.email && user.email.toLowerCase().includes(term));
    return matchesName || matchesEmail;
  });


  if (authLoading || loadingUsers) {
    return (
      // <Layout>
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
          <p className="text-xl text-gray-700">Carregando usuários...</p>
        </div>
      // </Layout>
    );
  }

  if (!currentUser || !isMasterAdmin) {
    return null;
  }

  return (
    // <Layout>
      <div className="p-4 bg-gray-100 min-h-screen">
        <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-lg p-6">
          {/* Cabeçalho */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              Gerenciar Usuários
            </h1>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
              {/* BOTÃO "VOLTAR" PADRONIZADO AQUI */}
              <Link 
                to="/master-dashboard" 
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md font-semibold hover:bg-gray-300 flex items-center gap-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"></path></svg>
                Voltar
              </Link>
              <Link to="/master/usuarios/criar" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-md flex items-center gap-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                Criar Novo Usuário
              </Link>
            </div>
          </div>

          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
              <p className="font-bold">Erro:</p>
              <p>{error}</p>
            </div>
          )}

          {/* Seção de Filtro e Busca */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Filtrar Usuários</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700 mb-1">Buscar por Nome/E-mail:</label>
                <input
                  type="text"
                  id="searchTerm"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                  placeholder="Pesquisar usuários..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="filterRole" className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Papel:</label>
                <select
                  id="filterRole"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                >
                  <option value="todos">Todos os Papéis</option>
                  <option value="isAdmin">Administradores Estabelecimento</option>
                  <option value="isMasterAdmin">Master Administradores</option>
                </select>
              </div>
              <div>
                <label htmlFor="filterStatus" className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Status:</label>
                <select
                  id="filterStatus"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
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
          <div className="overflow-x-auto mt-8">
            {filteredUsuariosBySearchTerm.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhum usuário encontrado com os critérios de busca/filtro.</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nome
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      E-mail
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Admin Estab.
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Master Admin
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estabelecimentos Gerenciados
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsuariosBySearchTerm.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.nome || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.email || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.isAdmin ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.isAdmin ? 'Sim' : 'Não'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.isMasterAdmin ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.isMasterAdmin ? 'Sim' : 'Não'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-normal text-sm text-gray-500 max-w-xs">
                          {user.isAdmin && user.estabelecimentosGerenciados && user.estabelecimentosGerenciados.length > 0 ? (
                              user.estabelecimentosGerenciados.map((estabId, index) => (
                                  <span key={estabId} className="block text-xs text-gray-600">
                                      {estabelecimentosMap[estabId] || `ID: ${estabId}`}
                                      {index < user.estabelecimentosGerenciados.length - 1 ? ',' : ''}
                                  </span>
                              ))
                          ) : user.isAdmin ? 'Nenhum' : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {user.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-2">
                        <Link
                          to={`/master/usuarios/${user.id}/editar`}
                          className="px-3 py-1 rounded-md bg-blue-500 hover:bg-blue-600 text-white"
                        >
                          Editar
                        </Link>
                        <button
                          onClick={() => toggleUserAtivo(user.id, user.ativo, user.nome)}
                          className={`px-3 py-1 rounded-md text-white ${
                            user.ativo ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
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
              disabled={currentPage === 0 || loadingUsers}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md font-semibold hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-gray-700">Página {currentPage + 1}</span>
            <button
              onClick={handleNextPage}
              disabled={!hasMore || loadingUsers}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>
    // </Layout>
  );
}

export default ListarUsuariosMaster;