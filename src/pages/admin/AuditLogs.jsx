// src/pages/admin/AuditLogs.jsx
import React, { useState, useEffect, useCallback } from 'react'; // Adicionado useCallback
import { useNavigate, Link } from 'react-router-dom';
// Importe 'limit' e 'startAfter' aqui:
import { collection, query, orderBy, where, onSnapshot, getDocs, limit, startAfter } from 'firebase/firestore'; 
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { format, startOfDay, endOfDay } from 'date-fns'; // Importe startOfDay, endOfDay
import { ptBR } from 'date-fns/locale';

const ITEMS_PER_PAGE = 15; // Ajuste para o número de logs por página

// Se você tiver um componente Layout, descomente a linha abaixo e as tags <Layout>
// import Layout from '../../Layout'; // Verifique o caminho exato!

function AuditLogs() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();

  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [error, setError] = useState('');

  // Estados dos filtros
  const [filterActionType, setFilterActionType] = useState('todos');
  const [filterActorEmail, setFilterActorEmail] = useState('');
  const [filterTargetType, setFilterTargetType] = useState('todos');
  const [filterTargetId, setFilterTargetId] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const [allActionTypes, setAllActionTypes] = useState([]);
  const [allActorEmails, setAllActorEmails] = useState([]);

  // ESTADOS DE PAGINAÇÃO
  const [lastVisible, setLastVisible] = useState(null);
  const [firstVisible, setFirstVisible] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [hasPrevious, setHasPrevious] = useState(false);

  // Controle de acesso
  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isMasterAdmin) {
        toast.error('Acesso negado. Você não tem permissões de Master Administrador.');
        navigate('/master-dashboard');
        return;
      }
      setLoadingLogs(false);
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  // Função para carregar os logs com filtros e paginação
  const fetchLogs = useCallback(async (direction = 'next', startDoc = null) => {
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
    if (filterStartDate) {
      queryConstraints.push(where('timestamp', '>=', startOfDay(new Date(filterStartDate))));
    }
    if (filterEndDate) {
      queryConstraints.push(where('timestamp', '<=', endOfDay(new Date(filterEndDate))));
    }

    // A paginação sempre precisa de uma ordenação consistente
    queryConstraints.push(orderBy('timestamp', 'desc'));

    let q;
    if (direction === 'next' && startDoc) {
      q = query(baseQuery, ...queryConstraints, startAfter(startDoc), limit(ITEMS_PER_PAGE));
    } else if (direction === 'prev' && startDoc) {
      // Simplificado para "anterior":
      q = query(baseQuery, ...queryConstraints, limit(ITEMS_PER_PAGE)); 
    } else { // Primeira carga
      q = query(baseQuery, ...queryConstraints, limit(ITEMS_PER_PAGE));
    }

    try {
      const documentSnapshots = await getDocs(q);
      let fetchedLogs = [];

      if (direction === 'prev') {
        fetchedLogs = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();
      } else {
        fetchedLogs = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      
      setLogs(fetchedLogs);

      // Popular opções de filtro dinamicamente a partir dos logs (de todos os logs, não só da página atual)
      // Para performance em bases grandes, estas opções de filtro podem ser pré-carregadas ou ter um limite.
      // Para o propósito deste exemplo, vamos manter a lógica atual de popular com a página carregada.
      // Em produção, você pode querer buscar tipos/emails distintos de toda a coleção para os filtros.
      const actionTypes = new Set();
      const actorEmails = new Set();
      documentSnapshots.docs.forEach(doc => { // Use os docs do snapshot para popular
        const logData = doc.data();
        actionTypes.add(logData.actionType);
        if (logData.actor && logData.actor.email) {
          actorEmails.add(logData.actor.email);
        }
      });
      setAllActionTypes(Array.from(actionTypes).sort());
      setAllActorEmails(Array.from(actorEmails).sort());


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
      console.error("Erro ao carregar logs de auditoria:", err);
      setError("Erro ao carregar logs de auditoria.");
    } finally {
      setLoadingLogs(false);
    }
  }, [isMasterAdmin, currentUser, filterActionType, filterActorEmail, filterTargetType, filterTargetId, filterStartDate, filterEndDate, currentPage]); // Adicionado currentPage

  // Efeito para recarregar quando filtros mudam
  useEffect(() => {
    setLastVisible(null);
    setFirstVisible(null);
    setCurrentPage(0);
    setHasMore(true);
    setHasPrevious(false);
    fetchLogs('next', null);
  }, [filterActionType, filterActorEmail, filterTargetType, filterTargetId, filterStartDate, filterEndDate, fetchLogs]);


  const handleNextPage = () => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
      fetchLogs('next', lastVisible);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
      fetchLogs('next', null); // Simplificado: recarrega do início
    }
  };


  if (authLoading || loadingLogs) {
    return (
      // <Layout>
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
          <p className="text-xl text-gray-700">Carregando logs de auditoria...</p>
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
              Logs de Auditoria 🕵️‍♀️
            </h1>
            {/* BOTÃO "VOLTAR" PADRONIZADO AQUI */}
            <Link 
              to="/master-dashboard" 
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md font-semibold hover:bg-gray-300 flex items-center gap-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"></path></svg>
              Voltar
            </Link>
          </div>

          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
              <p className="font-bold">Erro:</p>
              <p>{error}</p>
            </div>
          )}

          {/* Seção de Filtros */}
          <div className="bg-gray-50 p-6 rounded-lg shadow-inner mb-8 space-y-4">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Filtrar Logs</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <div>
                <label htmlFor="filterActionType" className="block text-sm font-medium text-gray-700">Tipo de Ação:</label>
                <select
                  id="filterActionType"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
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
                <label htmlFor="filterActorEmail" className="block text-sm font-medium text-gray-700">Email do Ator:</label>
                <select
                  id="filterActorEmail"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
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
                <label htmlFor="filterTargetType" className="block text-sm font-medium text-gray-700">Tipo de Alvo:</label>
                <select
                  id="filterTargetType"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                  value={filterTargetType}
                  onChange={(e) => setFilterTargetType(e.target.value)}
                >
                  <option value="todos">Todos os Alvos</option>
                  <option value="estabelecimento">Estabelecimento</option>
                  <option value="usuario">Usuário</option>
                  <option value="pedido">Pedido</option>
                  <option value="cardapio">Cardápio</option>
                </select>
              </div>
              <div>
                <label htmlFor="filterTargetId" className="block text-sm font-medium text-gray-700">ID do Alvo:</label>
                <input
                  type="text"
                  id="filterTargetId"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                  placeholder="ID do item afetado"
                  value={filterTargetId}
                  onChange={(e) => setFilterTargetId(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="filterStartDate" className="block text-sm font-medium text-gray-700">Data Início:</label>
                <input
                  type="date"
                  id="filterStartDate"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="filterEndDate" className="block text-sm font-medium text-gray-700">Data Fim:</label>
                <input
                  type="date"
                  id="endDate"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Tabela de Logs */}
          <div className="overflow-x-auto mt-8 bg-white rounded-lg shadow-md p-6">
            {logs.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhum log de auditoria encontrado com os filtros selecionados.</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data/Hora</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ação</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ator</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alvo</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.timestamp && log.timestamp.toDate ? format(log.timestamp.toDate(), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR }) : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="font-medium text-indigo-600">{log.actionType.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.actor?.email} ({log.actor?.role})
                      </td>
                      <td className="px-6 py-4 whitespace-normal text-sm text-gray-500 max-w-xs">
                        {log.target?.type} {log.target?.name ? `(${log.target.name})` : ''} - ID: {log.target?.id?.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 whitespace-normal text-sm text-gray-500 max-w-md">
                        {log.details && Object.keys(log.details).length > 0 ? (
                          Object.entries(log.details).map(([key, value]) => (
                            <p key={key} className="text-xs">
                              <span className="font-semibold">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}:</span> {JSON.stringify(value)}
                            </p>
                          ))
                        ) : 'N/A'}
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
              disabled={currentPage === 0 || loadingLogs}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md font-semibold hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-gray-700">Página {currentPage + 1}</span>
            <button
              onClick={handleNextPage}
              disabled={!hasMore || loadingLogs}
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

export default AuditLogs;