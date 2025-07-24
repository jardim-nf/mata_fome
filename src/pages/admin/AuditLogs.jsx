// src/pages/admin/AuditLogs.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, orderBy, where, getDocs, limit, startAfter } from 'firebase/firestore'; 
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale'; 
import { getAuth } from 'firebase/auth'; 

const ITEMS_PER_PAGE = 15;

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
        <Link to="/cardapios" className="px-4 py-2 rounded-full text-black bg-yellow-500 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-gray-100 hover:border-gray-400">
            Cardápios
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

function AuditLogs() {
  const navigate = useNavigate();
  const { currentUser, loading: authLoading, logout } = useAuth(); // Removido isMasterAdmin daqui

  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [error, setError] = useState('');

  // Estados dos filtros (agora como useRef para estabilidade)
  const filterActionTypeRef = useRef('todos');
  const filterActorEmailRef = useRef('');
  const filterTargetTypeRef = useRef('todos');
  const filterTargetIdRef = useRef('');
  const filterStartDateRef = useRef('');
  const filterEndDateRef = useRef('');

  // Estados para popular os dropdowns de filtro (ainda como useState)
  const [allActionTypes, setAllActionTypes] = useState([]);
  const [allActorEmails, setAllActorEmails] = useState([]);

  // ESTADOS DE PAGINAÇÃO (agora como useRef para estabilidade)
  const lastVisibleDocRef = useRef(null); 
  const pageHistoryRef = useRef([null]); 
  const currentPageIndexRef = useRef(0); 
  const hasMorePagesRef = useRef(true); 
  const hasPreviousPageRef = useRef(false); 


  // Ref para controlar se a carga inicial de logs já foi disparada
  const auditLogsComponentInitialLoadRef = useRef(false);
  // Ref para guardar o status do MasterAdmin após a checagem inicial de permissão
  const masterAdminStatusRef = useRef(false); // <--- DECLARAÇÃO CORRETA E NOME PADRONIZADO


  // fetchLogs: Função principal de busca de logs
  const fetchLogs = useCallback(async (direction = 'next', resetPagination = false) => {
    // Pega os valores mais recentes dos estados via .current dos refs
    const currentFilterActionType = filterActionTypeRef.current;
    const currentFilterActorEmail = filterActorEmailRef.current;
    const currentFilterTargetType = filterTargetTypeRef.current;
    const currentFilterTargetId = filterTargetIdRef.current;
    const currentFilterStartDate = filterStartDateRef.current;
    const currentFilterEndDate = filterEndDateRef.current;
    
    const currentLastVisibleDoc = lastVisibleDocRef.current;
    const currentPageHistory = pageHistoryRef.current;
    const currentPageIdx = currentPageIndexRef.current;


    // Acesso direto ao estado atualizado para currentUser, authLoading, etc.
    const authInstance = getAuth();
    const user = authInstance.currentUser; 
    const currentAuthLoading = authLoading;
    const currentIsMasterAdminStatus = masterAdminStatusRef.current; // <--- USO DO NOME PADRONIZADO


    // Verifica permissão e autenticação no INÍCIO
    if (!user || currentAuthLoading || !currentIsMasterAdminStatus) { 
        setLoadingLogs(false);
        if (!currentIsMasterAdminStatus && !currentAuthLoading) { 
            setError('Acesso negado. Você não tem permissões de Master Administrador.');
            setTimeout(() => navigate('/master-dashboard'), 0); 
            toast.error('Acesso negado. Você não tem permissões de Master Administrador.');
        }
        return;
    }

    setLoadingLogs(true);
    setError('');

    try {
        let currentQueryRef = collection(db, 'auditLogs');
        let queryConstraints = [];

        if (currentFilterActionType !== 'todos') {
          queryConstraints.push(where('actionType', '==', currentFilterActionType));
        }
        if (currentFilterActorEmail) {
          queryConstraints.push(where('actor.email', '==', currentFilterActorEmail));
        }
        if (currentFilterTargetType !== 'todos') {
          queryConstraints.push(where('target.type', '==', currentFilterTargetType));
        }
        if (currentFilterTargetId) {
          queryConstraints.push(where('target.id', '==', currentFilterTargetId));
        }

        let startDateObj = null;
        if (currentFilterStartDate) {
            startDateObj = startOfDay(parseISO(currentFilterStartDate));
            queryConstraints.push(where('timestamp', '>=', startDateObj));
        }
        let endDateObj = null;
        if (currentFilterEndDate) {
            endDateObj = endOfDay(parseISO(currentFilterEndDate));
            queryConstraints.push(where('timestamp', '<=', endDateObj));
        }

        queryConstraints.push(orderBy('timestamp', 'desc'));

        let q;
        let newPageIndex = currentPageIdx;

        if (resetPagination) { 
            q = query(currentQueryRef, ...queryConstraints, limit(ITEMS_PER_PAGE));
            newPageIndex = 0;
        } else if (direction === 'next') {
            q = query(currentQueryRef, ...queryConstraints, startAfter(currentLastVisibleDoc), limit(ITEMS_PER_PAGE));
            newPageIndex = currentPageIdx + 1;
        } else if (direction === 'prev' && currentPageIdx > 0) {
            const prevPageStartDoc = currentPageHistory[currentPageIdx - 1];
            q = query(currentQueryRef, ...queryConstraints, startAfter(prevPageStartDoc), limit(ITEMS_PER_PAGE));
            newPageIndex = currentPageIdx - 1;
        } else { 
            q = query(currentQueryRef, ...queryConstraints, limit(ITEMS_PER_PAGE));
            newPageIndex = 0;
        }
        
        const documentSnapshots = await getDocs(q);
        const fetchedLogs = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        setLogs(fetchedLogs);

        if (fetchedLogs.length > 0) {
          const newFirstVisible = documentSnapshots.docs[0];
          const newLastVisible = documentSnapshots.docs[documentSnapshots.docs.length - 1];
          lastVisibleDocRef.current = newLastVisible; // Atualiza o ref
          
          if (resetPagination) {
            pageHistoryRef.current = [null, newFirstVisible];
          } else if (direction === 'next' && newPageIndex >= currentPageHistory.length) { 
              pageHistoryRef.current = [...currentPageHistory, newFirstVisible]; 
          } else if (direction === 'prev' && newPageIndex < currentPageHistory.length - 1) { 
              pageHistoryRef.current = currentPageHistory.slice(0, currentPageIdx + 1); 
          }
          currentPageIndexRef.current = newPageIndex; // Atualiza o ref

          const nextQueryCheck = query(currentQueryRef, ...queryConstraints, startAfter(newLastVisible), limit(1));
          const nextSnapshotCheck = await getDocs(nextQueryCheck);
          hasMorePagesRef.current = !nextSnapshotCheck.empty; // Atualiza o ref
          
          hasPreviousPageRef.current = newPageIndex > 0; // Atualiza o ref

          // ATUALIZAÇÃO DOS ESTADOS LOCAIS PARA GATILHAR A RE-RENDERIZAÇÃO
          setLastVisibleDoc(lastVisibleDocRef.current);
          setPageHistory(pageHistoryRef.current);
          setCurrentPageIndex(currentPageIndexRef.current);
          setHasMorePages(hasMorePagesRef.current);
          setHasPreviousPage(hasPreviousPageRef.current);

        } else {
          setLogs([]);
          lastVisibleDocRef.current = null;
          hasMorePagesRef.current = false;
          hasPreviousPageRef.current = newPageIndex > 0;
          currentPageIndexRef.current = newPageIndex;
          pageHistoryRef.current = [null]; // Reseta o ref
          
          setLastVisibleDoc(lastVisibleDocRef.current);
          setHasMorePages(hasMorePagesRef.current);
          setHasPreviousPage(hasPreviousPageRef.current);
          setCurrentPageIndex(currentPageIndexRef.current);
          setPageHistory(pageHistoryRef.current); 
        }
    } catch (err) {
      console.error("Erro ao carregar logs de auditoria:", err);
      if (err.code === 'auth/quota-exceeded') {
        setError('Cota de autenticação excedida. Por favor, aguarde e tente novamente.');
        toast.error('Cota de autenticação excedida. Tente novamente mais tarde.');
        setTimeout(() => { logout(); navigate('/'); }, 1000); 
      } else if (err.code === 'permission-denied') {
        setError('Permissão negada ao carregar logs. Verifique seu papel de Master Administrador.');
        toast.error('Permissão negada.');
        setTimeout(() => navigate('/master-dashboard'), 0);
      } else {
        setError(`Erro ao carregar logs: ${err.message}.`);
      }
    } finally {
      setLoadingLogs(false);
    }
  }, [filterActionType, filterActorEmail, filterTargetType, filterTargetId, filterStartDate, filterEndDate, navigate, logout, authLoading, currentUser]);


  // useEffect PRINCIPAL: Lida com autenticação e permissões.
  useEffect(() => {
    if (authLoading) {
      setLoadingLogs(true); 
      return;
    }

    if (!currentUser) {
        toast.error('Você precisa estar logado para acessar esta página.');
        navigate('/');
        setLoadingLogs(false);
        return;
    }
    
    if (!auditLogsComponentInitialLoadRef.current) { 
      async function handleAuthAndLoad() {
          const authInstance = getAuth();
          try {
              const idTokenResult = await authInstance.currentUser.getIdTokenResult(true);
              const currentIsMasterAdmin = idTokenResult.claims.isMasterAdmin === true;
              
              console.log("AuditLogs.jsx: Custom Claims ATUALIZADAS após refresh (Auth useEffect):", idTokenResult.claims);

              masterAdminStatusRef.current = currentIsMasterAdmin; // <--- USO DO NOME PADRONIZADO

              if (!currentIsMasterAdmin) { 
                  toast.error('Acesso negado. Você não tem permissões de Master Administrador.');
                  navigate('/master-dashboard');
                  setLoadingLogs(false);
                  return;
              }
              
              fetchLogs('next', true); 
              auditLogsComponentInitialLoadRef.current = true; 

          } catch (err) {
              console.error("AuditLogs.jsx: Erro na verificação de permissões (Auth useEffect):", err);
              if (err.code === 'auth/quota-exceeded' || err.code === 'auth/user-token-expired' || err.code === 'auth/invalid-user-token') {
                  setError('Sessão expirou ou cota de autenticação excedida. Por favor, faça login novamente.');
                  toast.error('Sessão expirou. Faça login novamente.');
                  setTimeout(() => { logout(); navigate('/'); }, 1000); 
              } else if (err.code === 'permission-denied') {
                  setError('Permissão negada ao iniciar. Verifique seu papel.');
                  navigate('/master-dashboard');
              } else {
                  setError(`Erro inesperado ao verificar autenticação: ${err.message}.`);
              }
              setLoadingLogs(false);
              auditLogsComponentInitialLoadRef.current = true; 
          }
      }
      handleAuthAndLoad();
    } else { 
      setLoadingLogs(false); 
    }
  }, [currentUser, authLoading, navigate, logout, fetchLogs]);


  // Efeito para popular os dropdowns de filtro
  useEffect(() => {
    if (currentUser && masterAdminStatusRef.current) { // <--- USO DO NOME PADRONIZADO
      const fetchFilterOptions = async () => {
        try {
          const limitedLogsQuery = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(1000));
          const snapshot = await getDocs(limitedLogsQuery);

          const actionTypes = new Set();
          const actorEmails = new Set();
          snapshot.docs.forEach(doc => {
            const logData = doc.data();
            if (logData.actionType) actionTypes.add(logData.actionType);
            if (logData.actor && logData.actor.email) actorEmails.add(logData.actor.email);
          });
          setAllActionTypes(Array.from(actionTypes).sort());
          setAllActorEmails(Array.from(actorEmails).sort());
        } catch (err) {
          console.error("Erro ao carregar opções de filtro de logs:", err);
          if (err.code === 'permission-denied') {
            setError('Permissão negada para carregar opções de filtro de logs.');
            toast.error('Permissão negada para opções de filtro.');
          }
        }
      };
      fetchFilterOptions();
    }
  }, [currentUser, masterAdminStatusRef]); 

  // Efeito para acionar nova busca quando filtros mudam
  useEffect(() => {
    if (!authLoading && currentUser && masterAdminStatusRef.current && auditLogsComponentInitialLoadRef.current) { // <--- USO DOS NOMES PADRONIZADOS
      fetchLogs('next', true); 
    }
  }, [filterActionType, filterActorEmail, filterTargetType, filterTargetId, filterStartDate, filterEndDate, fetchLogs, currentUser, authLoading]);

  // Handlers para os botões de paginação
  const handleNextPage = () => {
    if (hasMorePages && !loadingLogs) {
      fetchLogs('next', false); 
    }
  };

  const handlePreviousPage = () => {
    if (hasPreviousPage && !loadingLogs) {
      fetchLogs('prev', false); 
    }
  };


  if (authLoading || loadingLogs) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
          <p className="text-xl text-black">Carregando logs de auditoria...</p>
        </div>
    );
  }

  if (!currentUser || !masterAdminStatusRef.current) { // <--- USO DO NOME PADRONIZADO
    return null; 
  }

  return (
    <div className="bg-gray-50 min-h-screen pt-24 pb-8 px-4">
      {/* Header (reutilizado do MasterDashboard) */}
      <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} />

      <div className="max-w-7xl mx-auto">
        {/* Título da Página e Botão Voltar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <h1 className="text-3xl font-extrabold text-black text-center sm:text-left">
            Registros de Auditoria 🕵️‍♀️
            <div className="w-24 h-1 bg-yellow-500 mx-auto sm:mx-0 mt-2 rounded-full"></div>
          </h1>
          <Link
            to="/master-dashboard"
            className="bg-gray-200 text-gray-700 font-semibold px-5 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-300 flex items-center gap-2 shadow-md"
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"></path></svg>
            Voltar
          </Link>
        </div>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md" role="alert">
            <p className="font-bold">Erro:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Seção de Filtros */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-100">
          <h2 className="text-xl font-bold mb-4 text-black">Filtrar Logs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div>
              <label htmlFor="filterActionType" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Ação:</label>
              <select
                id="filterActionType"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 p-2 bg-white text-gray-800"
                value={filterActionType}
                onChange={(e) => setFilterActionType(e.target.value)}
              >
                <option value="todos">Todos os Tipos</option>
                {allActionTypes.map(type => (
                  <option key={type} value={type}>{type?.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filterActorEmail" className="block text-sm font-medium text-gray-700 mb-1">Email do Ator:</label>
              <select
                id="filterActorEmail"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 p-2 bg-white text-gray-800"
                value={filterActorEmail}
                onChange={(e) => setFilterActorEmail(e.target.value)}
              >
                <option value="">Todos os Ator</option>
                {allActorEmails.map(email => (
                  <option key={email} value={email}>{email}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filterTargetType" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Alvo:</label>
              <select
                id="filterTargetType"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 p-2 bg-white text-gray-800"
                value={filterTargetType}
                onChange={(e) => setFilterTargetType(e.target.value)}
              >
                <option value="todos">Todos os Alvos</option>
                <option value="estabelecimento">Estabelecimento</option>
                <option value="usuario">Usuário</option>
                <option value="pedido">Pedido</option>
                <option value="cardapio">Cardápio</option>
                <option value="plano">Plano</option>
              </select>
            </div>
            <div>
              <label htmlFor="filterTargetId" className="block text-sm font-medium text-gray-700 mb-1">ID do Alvo:</label>
              <input
                type="text"
                id="filterTargetId"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 p-2 text-gray-800"
                placeholder="ID do item afetado"
                value={filterTargetId}
                onChange={(e) => setFilterTargetId(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="filterStartDate" className="block text-sm font-medium text-gray-700 mb-1">Data Início:</label>
              <input
                type="date"
                id="filterStartDate"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 p-2 bg-white text-gray-800"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="filterEndDate" className="block text-sm font-medium text-gray-700 mb-1">Data Fim:</label>
              <input
                type="date"
                id="filterEndDate"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 p-2 bg-white text-gray-800"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Tabela de Logs */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
          <h2 className="text-xl font-bold mb-6 text-black">
            Registros de Auditoria ({logs.length})
            <div className="w-16 h-0.5 bg-yellow-500 mt-2 rounded-full"></div>
          </h2>
          {logs.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhum log de auditoria encontrado com os filtros selecionados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">Data/Hora</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">Ação</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">Ator</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">Alvo</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.timestamp && log.timestamp.toDate ? format(log.timestamp.toDate(), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR }) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="font-semibold text-blue-700">{log.actionType?.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {log.actor?.email} (<span className="font-medium text-gray-800">{log.actor?.role}</span>)
                      </td>
                      <td className="px-6 py-4 whitespace-normal text-sm text-gray-700 max-w-xs">
                        {log.target?.type && <span className="font-medium">{log.target.type.charAt(0).toUpperCase() + log.target.type.slice(1)}</span>}
                        {log.target?.name ? ` (${log.target.name})` : ''} - ID: <span className="font-mono text-gray-800 text-xs">{log.target?.id?.substring(0, 8)}...</span>
                      </td>
                      <td className="px-6 py-4 whitespace-normal text-sm text-gray-600 max-w-md">
                        {log.details && Object.keys(log.details).length > 0 ? (
                          <div className="bg-gray-50 p-2 rounded-md max-h-20 overflow-y-auto text-xs">
                            {Object.entries(log.details).map(([key, value]) => (
                              <p key={key} className="mb-0.5">
                                <span className="font-semibold text-gray-700">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}:</span> <span className="font-mono text-gray-800">{JSON.stringify(value)}</span>
                              </p>
                            ))}
                          </div>
                        ) : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* CONTROLES DE PAGINAÇÃO */}
        <div className="flex justify-center items-center mt-8 space-x-4">
          <button
            onClick={handlePreviousPage}
            disabled={!hasPreviousPage || loadingLogs}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md font-semibold hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300"
          >
            Anterior
          </button>
          <span className="text-gray-700 font-medium">Página {currentPageIndex + 1}</span>
          <button
            onClick={handleNextPage}
            disabled={!hasMorePages || loadingLogs}
            className="px-4 py-2 bg-yellow-500 text-black rounded-md font-semibold hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}

export default AuditLogs;