// src/pages/admin/ListarEstabelecimentos.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, getDocs, limit, startAfter, orderBy, endBefore, limitToLast } from 'firebase/firestore'; 
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger'; 
import { getAuth } from 'firebase/auth'; 

const ITEMS_PER_PAGE = 10; 

// --- Componente de Header Master Dashboard ---
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
    <header className="fixed top-0 left-0 right-0 z-20 p-6 flex justify-between items-center bg-black shadow-lg border-b border-gray-800">
      <div className="font-extrabold text-2xl text-white cursor-pointer hover:text-yellow-500 transition-colors duration-300" onClick={() => navigate('/')}>
        DEU FOME <span className="text-yellow-500">.</span>
      </div>
      <div className="flex items-center space-x-4">
        <span className="text-white text-md font-medium">Olá, {userEmailPrefix}!</span>
        <Link to="/master-dashboard" className="px-4 py-2 rounded-full text-black bg-yellow-500 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-yellow-600 hover:shadow-md">
            Dashboard
        </Link>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-full text-white border border-yellow-500 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-yellow-500 hover:text-black"
        >
          Sair
        </button>
      </div>
    </header>
  );
}
// --- Fim DashboardHeader ---


function ListarEstabelecimentos() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth(); 

  const [estabelecimentos, setEstabelecimentos] = useState([]); 
  const [loadingEstabs, setLoadingEstabs] = useState(true); 
  const [error, setError] = useState('');

  // Estados para busca e filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');

  // ESTADOS DE PAGINAÇÃO
  const [lastVisible, setLastVisible] = useState(null);
  const [firstVisible, setFirstVisible] = useState(null); 
  const [currentPage, setCurrentPage] = useState(0); 
  const [hasMore, setHasMore] = useState(true); 
  const [hasPrevious, setHasPrevious] = useState(false); 


  // Efeito para controle de acesso inicial e redirecionamento
  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isMasterAdmin) { 
        toast.error('Acesso negado. Você não tem permissões de Master Administrador.');
        navigate('/master-dashboard');
        return;
      }
      setLoadingEstabs(false);
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  // Função para carregar estabelecimentos com paginação e filtros
  const fetchEstabelecimentos = useCallback(async (direction = 'next', startDoc = null, resetPagination = false) => {
    if (!isMasterAdmin || !currentUser) { 
      setLoadingEstabs(false);
      return;
    }

    setLoadingEstabs(true);
    setError('');

    let baseQueryRef = collection(db, 'estabelecimentos');
    let queryConstraints = [];

    if (filterStatus === 'ativo') {
      queryConstraints.push(where('ativo', '==', true));
    } else if (filterStatus === 'inativo') {
      queryConstraints.push(where('ativo', '==', false));
    }

    const orderByField = 'nome'; // Campo para ordenação principal

    let q;
    if (resetPagination) { 
      q = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'asc'), limit(ITEMS_PER_PAGE));
    } else if (direction === 'next' && startDoc) { 
      q = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'asc'), startAfter(startDoc), limit(ITEMS_PER_PAGE));
    } else if (direction === 'prev' && startDoc) { 
      // CORREÇÃO AQUI: Para paginação reversa, usamos orderBy('desc') e endBefore
      // E depois revertemos os resultados.
      q = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'desc'), endBefore(startDoc), limitToLast(ITEMS_PER_PAGE));
    } else { 
      q = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'asc'), limit(ITEMS_PER_PAGE));
    }

    try {
      const documentSnapshots = await getDocs(q);
      let fetchedEstabs = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Se foi navegação "anterior", precisamos reverter a ordem.
      if (direction === 'prev') { 
        fetchedEstabs.reverse(); 
      }

      setEstabelecimentos(fetchedEstabs);
      
      if (documentSnapshots.docs.length > 0) {
        setFirstVisible(documentSnapshots.docs[0]);
        setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
        
        // Verificar se há mais páginas à frente
        const nextQueryCheck = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'asc'), startAfter(documentSnapshots.docs[documentSnapshots.docs.length - 1]), limit(1));
        const nextSnapshotCheck = await getDocs(nextQueryCheck);
        setHasMore(!nextSnapshotCheck.empty);

        // Verificar se há páginas anteriores
        // Para isso, fazemos uma query reversa a partir do primeiro item da página atual
        const prevQueryCheck = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'desc'), startAfter(documentSnapshots.docs[0]), limit(1)); 
        const prevSnapshotCheck = await getDocs(prevQueryCheck);
        setHasPrevious(!prevSnapshotCheck.empty);

      } else { 
        setFirstVisible(null);
        setLastVisible(null);
        setHasMore(false);
        setHasPrevious(false);
      }
      
    } catch (err) {
      console.error("Erro ao carregar estabelecimentos:", err);
      setError("Erro ao carregar a lista de estabelecimentos. Verifique suas permissões.");
    } finally {
      setLoadingEstabs(false);
    }
  }, [isMasterAdmin, currentUser, filterStatus, searchTerm]); // searchTerm agora é uma dependência aqui para acionar a busca

  // Efeito para carregar estabelecimentos na montagem e quando filtros/paginação mudam
  useEffect(() => {
    // Só carrega estabelecimentos se o AuthContext já terminou de carregar E for Master Admin
    if (!authLoading && isMasterAdmin && currentUser) {
      // Resetar paginação e disparar a busca quando filtros mudam
      setCurrentPage(0); 
      setLastVisible(null);
      setFirstVisible(null);
      setHasMore(true);
      setHasPrevious(false);
      fetchEstabelecimentos('next', null, true); // True para resetPagination (primeira página)
    } else if (!authLoading && (!currentUser || !isMasterAdmin)) {
      // Se não é master admin (após autenticação), parar loading
      setLoadingEstabs(false); 
    }
  }, [authLoading, isMasterAdmin, currentUser, filterStatus, searchTerm, fetchEstabelecimentos]); 

  // Gerenciamento de Paginação (handlers)
  const handleNextPage = () => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
      fetchEstabelecimentos('next', lastVisible);
    }
  };

  const handlePreviousPage = () => {
    if (hasPrevious) { 
      setCurrentPage(prev => prev - 1);
      fetchEstabelecimentos('prev', firstVisible);
    }
  };

  // Filtragem por termo de busca no frontend (opera sobre a lista 'estabelecimentos' já carregada)
  const filteredEstabelecimentosBySearchTerm = estabelecimentos.filter(estab => {
    const term = searchTerm.toLowerCase();
    const matchesName = (estab.nome && estab.nome.toLowerCase().includes(term));
    const matchesSlug = (estab.slug && estab.slug.toLowerCase().includes(term));
    const matchesAdminUID = (estab.adminUID && estab.adminUID.toLowerCase().includes(term));
    return matchesName || matchesSlug || matchesAdminUID;
  });

  // Funções de Ação do Estabelecimento
  const toggleEstabelecimentoAtivo = async (estabelecimentoId, currentStatus, estabelecimentoNome) => {
    console.log(`Tentando alternar status para estabelecimento: ${estabelecimentoNome} (ID: ${estabelecimentoId}) de ${currentStatus} para ${!currentStatus}`);
    try {
      // Master Admin pode alterar, conforme regras do Firestore
      const estabRef = doc(db, 'estabelecimentos', estabelecimentoId);
      await updateDoc(estabRef, { ativo: !currentStatus });
      
      auditLogger(
          currentStatus ? 'ESTABELECIMENTO_DESATIVADO' : 'ESTABELECIMENTO_ATIVADO',
          { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
          { type: 'estabelecimento', id: estabelecimentoId, name: estabelecimentoNome },
          { oldValue: currentStatus, newValue: !currentStatus }
      );
      toast.success(`Estabelecimento ${estabelecimentoNome} ${currentStatus ? 'desativado' : 'ativado'} com sucesso!`);
    } catch (error) {
      console.error("Erro ao alternar status do estabelecimento:", error);
      if (error.code === 'permission-denied') {
        toast.error('Permissão negada. Você não pode alterar o status deste estabelecimento.');
      } else {
        toast.error("Erro ao alternar status do estabelecimento.");
      }
    }
  };

  const handleDeleteEstabelecimento = async (estabelecimentoId, estabelecimentoNome) => {
    console.log(`Tentando deletar estabelecimento: ${estabelecimentoNome} (ID: ${estabelecimentoId})`);
    if (window.confirm(`Tem certeza que deseja DELETAR o estabelecimento "${estabelecimentoNome}"? Esta ação é irreversível.`)) {
      try {
        // Master Admin pode deletar, conforme regras do Firestore
        await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId));
        auditLogger(
            'ESTABELECIMENTO_DELETADO',
            { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
            { type: 'estabelecimento', id: estabelecimentoId, name: estabelecimentoNome }
        );
        toast.success(`Estabelecimento "${estabelecimentoNome}" deletado com sucesso!`);
      } catch (error) {
        console.error("Erro ao deletar estabelecimento:", error);
        if (error.code === 'permission-denied') {
          toast.error('Permissão negada. Você não pode deletar este estabelecimento.');
        } else {
          toast.error(`Erro ao deletar o estabelecimento "${estabelecimentoNome}".`);
        }
      }
    }
  };

  // Renderização condicional para loading e erros
  if (authLoading || loadingEstabs) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
          <p className="text-xl text-black">Carregando estabelecimentos...</p>
        </div>
    );
  }

  // Se não é Master Admin, ou não está logado, já foi redirecionado pelo useEffect inicial
  if (!currentUser || !isMasterAdmin) { 
    return null; 
  }

  return (
    <div className="bg-gray-50 min-h-screen pt-24 pb-8 px-4">
      <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} /> 
      <div className="max-w-7xl mx-auto">
        {/* Título da Página e Botão Voltar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h1 className="text-3xl font-extrabold text-black text-center sm:text-left">
            Gerenciar Estabelecimentos
            <div className="w-24 h-1 bg-yellow-500 mx-auto sm:mx-0 mt-2 rounded-full"></div>
          </h1>
          <Link
            to="/master-dashboard"
            className="bg-gray-200 text-gray-700 font-semibold px-5 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-300 flex items-center gap-2 shadow-md"
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"></path></svg>
            Voltar ao Dashboard
          </Link>
        </div>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md" role="alert">
            <p className="font-bold">Erro:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Seção de Filtro e Busca */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-100">
          <h2 className="text-xl font-bold mb-4 text-black">Filtrar Estabelecimentos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700 mb-1">Buscar por Nome/Admin UID:</label>
              <input
                type="text"
                id="searchTerm"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 p-2 text-gray-800"
                placeholder="Pesquisar estabelecimentos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="filterStatus" className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Status:</label>
              <select
                id="filterStatus"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 p-2 bg-white text-gray-800"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="ativos">Ativos</option>
                <option value="inativos">Inativos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Cards de Estabelecimentos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredEstabelecimentosBySearchTerm.length === 0 ? (
            <p className="text-gray-500 text-center py-8 col-span-full">Nenhum estabelecimento encontrado com os critérios de busca/filtro.</p>
          ) : (
            filteredEstabelecimentosBySearchTerm.map(estab => (
              <div key={estab.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-100 flex flex-col items-center text-center">
                <h3 className="text-xl font-bold mb-2 text-black">{estab.nome}</h3>
                <p className="text-sm text-gray-600 mb-1">Slug: {estab.slug}</p>
                <p className="text-sm text-gray-600 mb-4">Admin UID: {estab.adminUID ? estab.adminUID.substring(0, 10) + '...' : 'N/A'}</p>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold mb-4 ${
                  estab.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {estab.ativo ? 'Ativo' : 'Inativo'}
                </span>
                <div className="flex flex-wrap justify-center gap-2 mt-auto">
                  <Link 
                    to={`/master/estabelecimentos/${estab.id}/editar`} 
                    className="px-4 py-2 rounded-md bg-black hover:bg-gray-800 text-white text-sm font-semibold transition-colors duration-300"
                  >
                    Editar
                  </Link>
                  <button
                    onClick={() => toggleEstabelecimentoAtivo(estab.id, estab.ativo, estab.nome)}
                    className={`px-4 py-2 rounded-md text-white text-sm font-semibold transition-colors duration-300 ${
                      estab.ativo ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                    }`}
                  >
                    {estab.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    onClick={() => handleDeleteEstabelecimento(estab.id, estab.nome)}
                    className="px-4 py-2 rounded-md bg-gray-500 hover:bg-gray-600 text-white text-sm font-semibold transition-colors duration-300"
                  >
                    Deletar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* CONTROLES DE PAGINAÇÃO */}
        <div className="flex justify-center items-center mt-8 space-x-4">
          <button
            onClick={handlePreviousPage}
            disabled={!hasPrevious || loadingEstabs}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md font-semibold hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300"
          >
            Anterior
          </button>
          <span className="text-gray-700 font-medium">Página {currentPage + 1}</span>
          <button
            onClick={handleNextPage}
            disabled={!hasMore || loadingEstabs}
            className="px-4 py-2 bg-yellow-500 text-black rounded-md font-semibold hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}

export default ListarEstabelecimentos;