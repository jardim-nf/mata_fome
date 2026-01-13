import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, doc, updateDoc, deleteDoc, getDocs, limit, startAfter, orderBy, endBefore, limitToLast, where } from 'firebase/firestore'; 
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
    <header className="fixed top-0 left-0 right-0 z-50 p-6 flex justify-between items-center bg-white shadow-lg border-b border-gray-200 backdrop-blur-sm bg-white/95">
      <div className="font-extrabold text-2xl text-gray-900 cursor-pointer hover:text-yellow-500 transition-colors duration-300 flex items-center gap-2" onClick={() => navigate('/')}>
        <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">DF</span>
        </div>
        DEU FOME <span className="text-yellow-500">.</span>
      </div>
      <div className="flex items-center space-x-4">
        <div className="hidden sm:flex items-center space-x-3 bg-gray-100 rounded-full px-4 py-2">
          <div className="w-8 h-8 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">{userEmailPrefix.charAt(0).toUpperCase()}</span>
          </div>
          <span className="text-gray-700 text-sm font-medium">Olá, {userEmailPrefix}!</span>
        </div>
        <Link to="/master-dashboard" className="px-4 py-2 rounded-full bg-yellow-500 text-white font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-yellow-600 hover:shadow-lg transform hover:-translate-y-0.5 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
          </svg>
          Dashboard
        </Link>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-full text-gray-700 border border-gray-300 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-gray-50 hover:border-gray-400 transform hover:-translate-y-0.5 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
          Sair
        </button>
      </div>
    </header>
  );
}

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

    // Filtro por status (se diferente de 'todos')
    if (filterStatus === 'ativos') {
      queryConstraints.push(where('ativo', '==', true));
    } else if (filterStatus === 'inativos') {
      queryConstraints.push(where('ativo', '==', false));
    }

    const orderByField = 'nome'; 

    let q;
    if (resetPagination) { 
      q = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'asc'), limit(ITEMS_PER_PAGE));
    } else if (direction === 'next' && startDoc) { 
      q = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'asc'), startAfter(startDoc), limit(ITEMS_PER_PAGE));
    } else if (direction === 'prev' && startDoc) { 
      q = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'desc'), endBefore(startDoc), limitToLast(ITEMS_PER_PAGE));
    } else { 
      q = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'asc'), limit(ITEMS_PER_PAGE));
    }

    try {
      const documentSnapshots = await getDocs(q);
      let fetchedEstabs = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (direction === 'prev') { 
        fetchedEstabs.reverse(); 
      }

      setEstabelecimentos(fetchedEstabs);
      
      if (documentSnapshots.docs.length > 0) {
        setFirstVisible(documentSnapshots.docs[0]);
        setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
        
        // Verifica se há mais à frente
        const nextQueryCheck = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'asc'), startAfter(documentSnapshots.docs[documentSnapshots.docs.length - 1]), limit(1));
        const nextSnapshotCheck = await getDocs(nextQueryCheck);
        setHasMore(!nextSnapshotCheck.empty);

        // Verifica se há mais para trás
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
      setError("Erro ao carregar a lista de estabelecimentos. Verifique suas permissões (Regras do Firebase!).");
    } finally {
      setLoadingEstabs(false);
    }
  }, [isMasterAdmin, currentUser, filterStatus]);

  // Efeito para carregar estabelecimentos na montagem e quando filtros/paginação mudam
  useEffect(() => {
    if (!authLoading && isMasterAdmin && currentUser) {
      setCurrentPage(0); 
      setLastVisible(null);
      setFirstVisible(null);
      setHasMore(true);
      setHasPrevious(false);
      fetchEstabelecimentos('next', null, true); 
    } else if (!authLoading && (!currentUser || !isMasterAdmin)) {
      setLoadingEstabs(false); 
    }
  }, [authLoading, isMasterAdmin, currentUser, filterStatus, fetchEstabelecimentos]); 

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

  // Filtragem por termo de busca no frontend
  const filteredEstabelecimentosBySearchTerm = estabelecimentos.filter(estab => {
    const term = searchTerm.toLowerCase();
    const matchesName = (estab.nome && estab.nome.toLowerCase().includes(term));
    const matchesSlug = (estab.slug && estab.slug.toLowerCase().includes(term));
    const matchesAdminUID = (estab.adminUID && estab.adminUID.toLowerCase().includes(term));
    return matchesName || matchesSlug || matchesAdminUID;
  });

  // Funções de Ação do Estabelecimento
  const toggleEstabelecimentoAtivo = async (estabelecimentoId, currentStatus, estabelecimentoNome) => {
    if (!window.confirm(`Tem certeza que deseja ${currentStatus ? 'DESATIVAR' : 'ATIVAR'} o estabelecimento "${estabelecimentoNome}"?`)) return;
    try {
      const estabRef = doc(db, 'estabelecimentos', estabelecimentoId);
      await updateDoc(estabRef, { ativo: !currentStatus });
      auditLogger(
        currentStatus ? 'ESTABELECIMENTO_DESATIVADO' : 'ESTABELECIMENTO_ATIVADO',
        { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
        { type: 'estabelecimento', id: estabelecimentoId, name: estabelecimentoNome }
      );
      toast.success(`Estabelecimento ${estabelecimentoNome} ${currentStatus ? 'desativado' : 'ativado'} com sucesso!`);
      
      // Recarregar a lista para refletir as mudanças
      fetchEstabelecimentos('next', null, true);
    } catch (error) {
      console.error("Erro ao alternar status:", error);
      toast.error('Erro ao alternar status do estabelecimento.');
    }
  };

  const handleDeleteEstabelecimento = async (estabelecimentoId, estabelecimentoNome) => {
    if (window.confirm(`Tem certeza que deseja DELETAR o estabelecimento "${estabelecimentoNome}"? Esta ação é irreversível.`)) {
      try {
        await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId));
        auditLogger(
            'ESTABELECIMENTO_DELETADO',
            { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
            { type: 'estabelecimento', id: estabelecimentoId, name: estabelecimentoNome }
        );
        toast.success(`Estabelecimento "${estabelecimentoNome}" deletado com sucesso!`);
        
        // Recarregar a lista para refletir as mudanças
        fetchEstabelecimentos('next', null, true);
      } catch (error) {
        console.error("Erro ao deletar estabelecimento:", error);
        toast.error(`Erro ao deletar o estabelecimento "${estabelecimentoNome}".`);
      }
    }
  };

  // Loading State Melhorado
  if (authLoading || loadingEstabs) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-500 mb-4"></div>
        <p className="text-xl text-gray-600 font-medium">Carregando estabelecimentos...</p>
        <p className="text-sm text-gray-500 mt-2">Isso pode levar alguns instantes</p>
      </div>
    );
  }

  if (!currentUser || !isMasterAdmin) { 
    return null; 
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen pt-24 pb-8 px-4">
      <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} /> 
      
      <div className="max-w-7xl mx-auto">
        {/* Cabeçalho e Ações */}
        <div className="flex w-full justify-between items-start sm:items-center mb-8 gap-6">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-gray-900 text-center sm:text-left">
              Gerenciar Estabelecimentos
            </h1>
            <p className="text-gray-600 mt-2 text-center sm:text-left">
              Gerencie todos os estabelecimentos cadastrados no sistema
            </p>
            <div className="w-32 h-1 bg-gradient-to-r from-yellow-500 to-orange-500 mx-auto sm:mx-0 mt-4 rounded-full"></div>
          </div>

          <div className="flex w-full gap-3">
            <Link
              to="/admin/cadastrar-estabelecimento"
              className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold px-6 py-3 rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all duration-300 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
              </svg>
              Cadastrar Novo
            </Link>
            
            <Link
              to="/master-dashboard"
              className="bg-white text-gray-700 font-semibold px-6 py-3 rounded-xl border border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all duration-300 flex items-center justify-center gap-3 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"></path>
              </svg>
              Voltar ao Dashboard
            </Link>
          </div>
        </div>

        {/* Alertas */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-6 mb-8 rounded-xl shadow-sm" role="alert">
            <div className="flex items-center">
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div>
                <p className="font-bold">Erro ao carregar dados</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Seção de Filtro e Busca */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-gray-200">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 flex items-center gap-3">
            <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
            </svg>
            Filtrar Estabelecimentos
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label htmlFor="searchTerm" className="block text-sm font-semibold text-gray-700 mb-3">Buscar por Nome, Slug ou Admin UID</label>
              <div className="relative">
                <input
                  type="text"
                  id="searchTerm"
                  className="w-full rounded-xl border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 p-4 text-gray-800 bg-gray-50 border-0 focus:bg-white transition-all duration-300 pl-12"
                  placeholder="Digite para pesquisar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </div>
            </div>
            <div>
              <label htmlFor="filterStatus" className="block text-sm font-semibold text-gray-700 mb-3">Filtrar por Status</label>
              <div className="relative">
                <select
                  id="filterStatus"
                  className="w-full rounded-xl border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 p-4 bg-gray-50 text-gray-800 border-0 focus:bg-white transition-all duration-300 appearance-none pl-4 pr-12"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="todos">Todos os Estabelecimentos</option>
                  <option value="ativos">Apenas Ativos</option>
                  <option value="inativos">Apenas Inativos</option>
                </select>
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Estatísticas Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Estabelecimentos</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{estabelecimentos.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Estabelecimentos Ativos</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {estabelecimentos.filter(e => e.ativo).length}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Estabelecimentos Inativos</p>
                <p className="text-3xl font-bold text-red-600 mt-2">
                  {estabelecimentos.filter(e => !e.ativo).length}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Cards de Estabelecimentos */}
        {filteredEstabelecimentosBySearchTerm.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-gray-200">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhum estabelecimento encontrado</h3>
            <p className="text-gray-600 mb-6">Tente ajustar os filtros de busca ou cadastre um novo estabelecimento.</p>
            <Link
              to="/admin/cadastrar-estabelecimento"
              className="inline-flex items-center gap-2 bg-yellow-500 text-white font-semibold px-6 py-3 rounded-xl hover:bg-yellow-600 transition-colors duration-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
              </svg>
              Cadastrar Primeiro Estabelecimento
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 mb-8">
              {filteredEstabelecimentosBySearchTerm.map(estab => (
                <div key={estab.id} className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">{estab.nome}</h3>
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          estab.ativo 
                            ? 'bg-green-100 text-green-800 border border-green-200' 
                            : 'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                          {estab.ativo ? '● Ativo' : '● Inativo'}
                        </span>
                      </div>
                    </div>
                    <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0 ml-3">
                      <span className="text-white font-bold text-sm">{estab.nome?.charAt(0) || 'E'}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                      </svg>
                      <span className="font-medium">Slug:</span>
                      <span className="text-gray-800">{estab.slug}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                      </svg>
                      <span className="font-medium">Admin UID:</span>
                      <span className="text-gray-800 font-mono text-xs">{estab.adminUID ? estab.adminUID.substring(0, 8) + '...' : 'N/A'}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link 
                      to={`/master/estabelecimentos/${estab.id}/editar`} 
                      className="flex-1 min-w-[80px] px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors duration-300 flex items-center justify-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                      </svg>
                      Editar
                    </Link>
                    <button
                      onClick={() => toggleEstabelecimentoAtivo(estab.id, estab.ativo, estab.nome)}
                      className={`flex-1 min-w-[80px] px-3 py-2 rounded-lg text-white text-sm font-semibold transition-colors duration-300 flex items-center justify-center gap-1 ${
                        estab.ativo 
                          ? 'bg-red-500 hover:bg-red-600' 
                          : 'bg-green-500 hover:bg-green-600'
                      }`}
                    >
                      {estab.ativo ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          Desativar
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          Ativar
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteEstabelecimento(estab.id, estab.nome)}
                      className="flex-1 min-w-[80px] px-3 py-2 rounded-lg bg-gray-500 hover:bg-gray-600 text-white text-sm font-semibold transition-colors duration-300 flex items-center justify-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                      Deletar
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* CONTROLES DE PAGINAÇÃO */}
            <div className="flex justify-center items-center mt-12 space-x-4">
              <button
                onClick={handlePreviousPage}
                disabled={!hasPrevious || loadingEstabs}
                className="px-6 py-3 bg-white text-gray-700 rounded-xl border border-gray-300 font-semibold hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:transform-none"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                </svg>
                Anterior
              </button>
              
              <div className="bg-white px-6 py-3 rounded-xl border border-gray-300 shadow-sm">
                <span className="text-gray-700 font-semibold">Página {currentPage + 1}</span>
              </div>
              
              <button
                onClick={handleNextPage}
                disabled={!hasMore || loadingEstabs}
                className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-semibold hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:transform-none"
              >
                Próxima
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ListarEstabelecimentos;