// src/pages/admin/AuditLogs.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, orderBy, where, onSnapshot, getDocs, limit, startAfter, endBefore, limitToLast } from 'firebase/firestore'; 
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns'; // Adicionado parseISO
import { ptBR } from 'date-fns/locale';

const ITEMS_PER_PAGE = 15; // Ajuste para o número de logs por página

// --- Componente de Header Master Dashboard (reutilizado) ---
// Normalmente, isso estaria em um Layout.jsx ou componente separado.
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
        <Link to="/cardapios" className="px-4 py-2 rounded-full text-black bg-yellow-500 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-yellow-600 hover:shadow-md">
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
// --- Fim DashboardHeader ---

function AuditLogs() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth(); // Importa logout

  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [error, setError] = useState('');

  // Estados dos filtros
  const [filterActionType, setFilterActionType] = useState('todos');
  const [filterActorEmail, setFilterActorEmail] = useState('');
  const [filterTargetType, setFilterTargetType] = useState('todos');
  const [filterTargetId, setFilterTargetId] = useState('');
  const [filterStartDate, setFilterStartDate] = useState(''); // Formato 'YYYY-MM-DD' para input type="date"
  const [filterEndDate, setFilterEndDate] = useState('');     // Formato 'YYYY-MM-DD' para input type="date"

  const [allActionTypes, setAllActionTypes] = useState([]);
  const [allActorEmails, setAllActorEmails] = useState([]);

  // ESTADOS DE PAGINAÇÃO
  const [lastVisible, setLastVisible] = useState(null);
  const [firstVisible, setFirstVisible] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [pageMarkers, setPageMarkers] = useState([{ page: 0, startDoc: null, endDoc: null }]); // Para paginação robusta

  // Controle de acesso
  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isMasterAdmin) {
        toast.error('Acesso negado. Você não tem permissões de Master Administrador.');
        navigate('/master-dashboard');
        return;
      }
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  // Função para carregar os logs com filtros e paginação
  const fetchLogs = useCallback(async (direction = 'next') => {
    if (!isMasterAdmin || !currentUser) return;

    setLoadingLogs(true);
    setError('');
    let baseQuery = collection(db, 'auditLogs');
    let queryConstraints = [];

    if (filterActionType !== 'todos') {
      queryConstraints.push(where('actionType', '==', filterActionType));
    }
    if (filterActorEmail) {
      queryConstraints.push(where('actor.email', '==', filterActorEmail));
    }
    if (filterTargetType !== 'todos') {
      queryConstraints.push(where('target.type', '==', filterTargetType));
    }
    if (filterTargetId) {
      queryConstraints.push(where('target.id', '==', filterTargetId));
    }

    let startDateObj = null;
    if (filterStartDate) {
        try {
            startDateObj = startOfDay(parseISO(filterStartDate));
            queryConstraints.push(where('timestamp', '>=', startDateObj));
        } catch (e) {
            console.error("Invalid start date format:", e);
            toast.error("Formato de Data Início inválido.");
            setLoadingLogs(false);
            return;
        }
    }
    let endDateObj = null;
    if (filterEndDate) {
        try {
            endDateObj = endOfDay(parseISO(filterEndDate));
            queryConstraints.push(where('timestamp', '<=', endDateObj));
        } catch (e) {
            console.error("Invalid end date format:", e);
            toast.error("Formato de Data Fim inválido.");
            setLoadingLogs(false);
            return;
        }
    }

    queryConstraints.push(orderBy('timestamp', 'desc')); // Ordenação por data/hora mais recente

    let q;
    let currentStartDoc = null;

    if (direction === 'next' && lastVisible) {
        currentStartDoc = lastVisible;
        q = query(baseQuery, ...queryConstraints, startAfter(currentStartDoc), limit(ITEMS_PER_PAGE));
    } else if (direction === 'prev' && firstVisible && currentPage > 0) {
        // Para ir para a página anterior, pegamos o marcador da página anterior à atual
        const prevPageMarker = pageMarkers[currentPage - 1];
        if (prevPageMarker && prevPageMarker.startDoc) {
             currentStartDoc = prevPageMarker.startDoc;
             // Firestore does not support `startBefore` directly with `orderBy('desc')` easily.
             // We need to reverse the order for endBefore with orderBy('desc')
             q = query(baseQuery, ...queryConstraints.filter(c => c.fieldPath !== 'timestamp' || c.direction !== 'desc'), 
                       orderBy('timestamp', 'asc'), // Temporarily order ascending
                       startAfter(prevPageMarker.endDoc), // Start after the end of the previous page
                       limit(ITEMS_PER_PAGE));
        } else { // Se não tem marcador ou é a primeira página, reinicia
             q = query(baseQuery, ...queryConstraints, limit(ITEMS_PER_PAGE));
             setCurrentPage(0); // Garante que volta para a página 0
        }
    } else { // Primeira carga ou reset de filtros
      q = query(baseQuery, ...queryConstraints, limit(ITEMS_PER_PAGE));
    }

    try {
      const documentSnapshots = await getDocs(q);
      let fetchedLogs = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Se for navegação "anterior" usando endBefore/limitToLast, a ordem vem invertida
      if (direction === 'prev' && documentSnapshots.docs.length > 0) {
        fetchedLogs.reverse(); // Reverte para a ordem correta
      }

      setLogs(fetchedLogs);

      // Popular opções de filtro dinamicamente a partir dos logs
      // ATENÇÃO: Para ambientes de produção com muitos logs, esta abordagem pode ser ineficiente.
      // Seria melhor ter coleções separadas para `actionTypes` e `actorEmails`
      // ou limitar a busca para popular estes dropdowns.
      const allLogsSnapshot = await getDocs(query(collection(db, 'auditLogs'))); // Busca todos os logs para filtros
      const actionTypes = new Set();
      const actorEmails = new Set();
      allLogsSnapshot.docs.forEach(doc => {
        const logData = doc.data();
        actionTypes.add(logData.actionType);
        if (logData.actor && logData.actor.email) {
          actorEmails.add(logData.actor.email);
        }
      });
      setAllActionTypes(Array.from(actionTypes).sort());
      setAllActorEmails(Array.from(actorEmails).sort());


      if (documentSnapshots.docs.length > 0) {
        const newFirstVisible = documentSnapshots.docs[0];
        const newLastVisible = documentSnapshots.docs[documentSnapshots.docs.length - 1];
        setFirstVisible(newFirstVisible);
        setLastVisible(newLastVisible);

        // Atualizar marcadores de página
        if (direction === 'next' && currentPage === pageMarkers.length -1) {
            setPageMarkers(prev => [...prev, { page: currentPage + 1, startDoc: newFirstVisible, endDoc: newLastVisible }]);
        } else if (direction === 'prev' && currentPage > 0) {
            setPageMarkers(prev => prev.slice(0, currentPage)); // Remove o marcador da página atual ao voltar
        }
        
        // Verificar se há mais páginas à frente
        const nextQueryCheck = query(baseQuery, ...queryConstraints, startAfter(newLastVisible), limit(1));
        const nextSnapshotCheck = await getDocs(nextQueryCheck);
        setHasMore(!nextSnapshotCheck.empty);

        // Verificar se há páginas anteriores (se não for a primeira página)
        setHasPrevious(currentPage > 0);

      } else {
        setFirstVisible(null);
        setLastVisible(null);
        setHasMore(false);
        setHasPrevious(false);
      }
      
    } catch (err) {
      console.error("Erro ao carregar logs de auditoria:", err);
      setError("Erro ao carregar logs de auditoria. Verifique suas permissões ou filtros.");
    } finally {
      setLoadingLogs(false);
    }
  }, [isMasterAdmin, currentUser, filterActionType, filterActorEmail, filterTargetType, filterTargetId, filterStartDate, filterEndDate, currentPage, pageMarkers]);

  // Efeito para recarregar quando filtros mudam
  useEffect(() => {
    // Resetar paginação ao mudar filtros
    setLastVisible(null);
    setFirstVisible(null);
    setCurrentPage(0);
    setHasMore(true);
    setHasPrevious(false);
    setPageMarkers([{ page: 0, startDoc: null, endDoc: null }]); // Resetar marcadores
    fetchLogs('next');
  }, [filterActionType, filterActorEmail, filterTargetType, filterTargetId, filterStartDate, filterEndDate, fetchLogs]);


  const handleNextPage = () => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
      fetchLogs('next');
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
      fetchLogs('prev');
    }
  };


  if (authLoading || loadingLogs) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
          <p className="text-xl text-black">Carregando logs de auditoria...</p>
        </div>
    );
  }

  if (!currentUser || !isMasterAdmin) {
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
            Logs de Auditoria 🕵️‍♀️
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
                  <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
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
                <option value="plano">Plano</option> {/* Adicionado tipo "plano" */}
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
            <div className="w-16 h-0.5 bg-yellow-500 mt-2 rounded-full"></div> {/* Pequena linha decorativa */}
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
                        <span className="font-semibold text-blue-700">{log.actionType.replace(/_/g, ' ')}</span> {/* Ação em azul para destaque */}
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
            disabled={!hasPrevious || loadingLogs}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md font-semibold hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300"
          >
            Anterior
          </button>
          <span className="text-gray-700 font-medium">Página {currentPage + 1}</span>
          <button
            onClick={handleNextPage}
            disabled={!hasMore || loadingLogs}
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