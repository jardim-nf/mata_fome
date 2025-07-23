// src/pages/admin/ListarPedidosMaster.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, doc, getDocs, getDoc, limit, startAfter, endBefore, limitToLast } from 'firebase/firestore'; 
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { format, startOfDay, endOfDay, subDays, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos os Status' },
  { value: 'recebido', label: 'Recebido' },
  { value: 'preparo', label: 'Em Preparo' },
  { value: 'em_entrega', label: 'Em Entrega' },
  { value: 'finalizado', label: 'Finalizado' },
  { value: 'cancelado', label: 'Cancelado' },
];

const PERIOD_OPTIONS = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'ultimos_7_dias', label: 'Últimos 7 Dias' },
  { value: 'ultimo_mes', label: 'Último Mês' },
  { value: 'todos', label: 'Todos os Períodos' },
];

// --- Helper para Cores de Status ---
const getStatusBadgeClasses = (status) => {
  switch (status) {
    case 'recebido':
      return 'bg-red-100 text-red-800'; // Vermelho para "recebido" (novo pedido)
    case 'preparo':
      return 'bg-yellow-100 text-yellow-800'; // Amarelo para "em preparo"
    case 'em_entrega':
      return 'bg-blue-100 text-blue-800'; // Azul para "em entrega"
    case 'finalizado':
      return 'bg-green-100 text-green-800'; // Verde para "finalizado"
    case 'cancelado':
      return 'bg-gray-200 text-gray-800'; // Cinza para "cancelado"
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

function ListarPedidosMaster() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth(); // Adicionado logout

  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstabelecimento, setFilterEstabelecimento] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterPeriod, setFilterPeriod] = useState('hoje');

  const [estabelecimentosList, setEstabelecimentosList] = useState([]);

  // ESTADOS DE PAGINAÇÃO
  const [lastVisible, setLastVisible] = useState(null);
  const [firstVisible, setFirstVisible] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [pageMarkers, setPageMarkers] = useState([{ page: 0, startDoc: null, endDoc: null }]); // Para paginação robusta

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isMasterAdmin) {
        toast.error('Acesso negado. Você não tem permissões de Master Administrador.');
        navigate('/master-dashboard');
        return;
      }
      // O carregamento inicial é disparado via useEffect abaixo
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  useEffect(() => {
    const fetchEstabelecimentos = async () => {
      try {
        const q = query(collection(db, 'estabelecimentos'), orderBy('nome', 'asc'));
        const querySnapshot = await getDocs(q);
        const list = querySnapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }));
        setEstabelecimentosList(list);
      } catch (err) {
        console.error("Erro ao carregar lista de estabelecimentos:", err);
        toast.error("Erro ao carregar lista de estabelecimentos para filtro.");
      }
    };
    fetchEstabelecimentos();
  }, []);

  // Função para carregar e filtrar pedidos com paginação
  const fetchPedidos = useCallback(async (direction = 'next') => {
    if (!isMasterAdmin || !currentUser) return;

    setLoading(true);
    setError('');

    let baseQuery = collection(db, 'pedidos');
    let queryConstraints = [];

    if (filterEstabelecimento !== 'todos') {
      queryConstraints.push(where('estabelecimentoId', '==', filterEstabelecimento));
    }

    if (filterStatus !== 'todos') {
      queryConstraints.push(where('status', '==', filterStatus));
    }

    const now = new Date();
    let queryStartDate = null;

    switch (filterPeriod) {
      case 'hoje':
        queryStartDate = startOfDay(now);
        break;
      case 'ultimos_7_dias':
        queryStartDate = startOfDay(subDays(now, 6));
        break;
      case 'ultimo_mes':
        queryStartDate = startOfDay(subMonths(now, 1));
        break;
      case 'todos':
      default:
        queryStartDate = null;
        break;
    }

    if (queryStartDate) {
      queryConstraints.push(where('criadoEm', '>=', queryStartDate));
    }

    // A paginação sempre precisa de uma ordenação consistente
    queryConstraints.push(orderBy('criadoEm', 'desc')); // Pedidos mais recentes primeiro

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
             // Best practice for "prev" with `orderBy('desc')` is `orderBy('asc')` + `startAt` + `limitToLast` + `reverse()`,
             // but that gets complex with multiple filters.
             // Simpler approach: fetch current page from beginning if it's not the first one, or use simple previous marker.
             q = query(baseQuery, ...queryConstraints, endBefore(firstVisible), limitToLast(ITEMS_PER_PAGE));
        } else { // Se não tem marcador ou é a primeira página, reinicia
             q = query(baseQuery, ...queryConstraints, limit(ITEMS_PER_PAGE));
             setCurrentPage(0); // Garante que volta para a página 0
        }
    } else { // Primeira carga ou reset de filtros
      q = query(baseQuery, ...queryConstraints, limit(ITEMS_PER_PAGE));
    }

    try {
      const documentSnapshots = await getDocs(q);
      let fetchedPedidos = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Se for navegação "anterior" usando endBefore/limitToLast, a ordem vem invertida
      if (direction === 'prev' && documentSnapshots.docs.length > 0) {
        fetchedPedidos.reverse(); // Reverte para a ordem correta
      }

      // Adicionar nomes dos clientes e estabelecimentos
      const clientPromises = [];
      const estabPromises = [];
      
      const uniqueClientIds = new Set(fetchedPedidos.map(p => p.clienteId).filter(Boolean));
      const uniqueEstabIds = new Set(fetchedPedidos.map(p => p.estabelecimentoId).filter(Boolean));

      const clientMap = new Map();
      const estabMap = new Map();

      for (const clientId of uniqueClientIds) {
        clientPromises.push(getDoc(doc(db, 'clientes', clientId)).then(docSnap => {
          if (docSnap.exists()) clientMap.set(clientId, docSnap.data().nome || 'Cliente Desconhecido');
          else clientMap.set(clientId, 'Cliente Removido');
        }).catch(() => clientMap.set(clientId, 'Erro Cliente')));
      }

      for (const estabId of uniqueEstabIds) {
        estabPromises.push(getDoc(doc(db, 'estabelecimentos', estabId)).then(docSnap => {
          if (docSnap.exists()) estabMap.set(estabId, docSnap.data().nome || 'Estabelecimento Desconhecido');
          else estabMap.set(estabId, 'Estabelecimento Removido');
        }).catch(() => estabMap.set(estabId, 'Erro Estab.')));
      }

      await Promise.all([...clientPromises, ...estabPromises]);

      const pedidosWithDetails = fetchedPedidos.map(pedido => ({
        ...pedido,
        clienteNome: clientMap.get(pedido.clienteId) || 'N/A',
        estabelecimentoNome: estabMap.get(pedido.estabelecimentoId) || 'N/A'
      }));

      setPedidos(pedidosWithDetails);

      if (documentSnapshots.docs.length > 0) {
        const newFirstVisible = documentSnapshots.docs[0];
        const newLastVisible = documentSnapshots.docs[documentSnapshots.docs.length - 1];
        setFirstVisible(newFirstVisible);
        setLastVisible(newLastVisible);

        // Atualizar marcadores de página
        if (direction === 'next' && currentPage === pageMarkers.length -1) {
            setPageMarkers(prev => [...prev, { page: currentPage + 1, startDoc: newFirstVisible, endDoc: newLastVisible }]);
        } else if (direction === 'prev' && currentPage > 0) {
            // Se voltamos, removemos o marcador da página atual que seria o próximo
            setPageMarkers(prev => prev.slice(0, currentPage));
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
      console.error("Erro ao carregar pedidos:", err);
      setError("Erro ao carregar os pedidos. Verifique os filtros ou a conexão.");
    } finally {
      setLoading(false);
    }
  }, [isMasterAdmin, currentUser, filterEstabelecimento, filterStatus, filterPeriod, currentPage, pageMarkers]);

  // Efeito para recarregar quando filtros mudam
  useEffect(() => {
    // Resetar paginação ao mudar filtros
    setLastVisible(null);
    setFirstVisible(null);
    setCurrentPage(0);
    setHasMore(true);
    setHasPrevious(false);
    setPageMarkers([{ page: 0, startDoc: null, endDoc: null }]); // Resetar marcadores
    fetchPedidos('next');
  }, [filterEstabelecimento, filterStatus, filterPeriod, searchTerm]); // searchTerm aqui para re-filtrar no frontend

  const handleNextPage = () => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
      fetchPedidos('next');
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
        setCurrentPage(prev => prev - 1);
        fetchPedidos('prev'); // Passa 'prev' para buscar a página anterior
    }
  };

  const handleViewDetails = (pedidoId) => {
    navigate(`/master/pedidos/${pedidoId}`);
  };

  // Filtragem por termo de busca no frontend (após a paginação do Firebase)
  const displayedPedidos = pedidos.filter(pedido => {
    const term = searchTerm.toLowerCase();
    const matchesId = pedido.id.toLowerCase().includes(term);
    const matchesCliente = pedido.clienteNome?.toLowerCase().includes(term); // Usar clienteNome
    const matchesEstabelecimentoNome = pedido.estabelecimentoNome?.toLowerCase().includes(term); // Usar estabelecimentoNome

    return matchesId || matchesCliente || matchesEstabelecimentoNome;
  });


  if (authLoading || loading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-white">
          <p className="text-xl text-black">Carregando pedidos...</p>
        </div>
    );
  }

  if (!currentUser || !isMasterAdmin) {
    return null;
  }

  return (
    // <Layout>
      <div className="bg-gray-50 min-h-screen pt-24 pb-8 px-4">
        {/* Header (reutilizado do MasterDashboard) */}
        <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} />

        <div className="max-w-7xl mx-auto">
          {/* Título da Página e Botão Voltar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <h1 className="text-3xl font-extrabold text-black text-center sm:text-left">
              📋 Todos os Pedidos (Master)
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

          {/* Seção de Filtros e Busca */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-100">
            <h2 className="text-xl font-bold mb-4 text-black">Filtrar Pedidos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700 mb-1">Buscar (ID/Cliente/Estab.):</label>
                <input
                  type="text"
                  id="searchTerm"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 p-2 text-gray-800"
                  placeholder="ID do pedido, nome do cliente ou estabelecimento"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="filterEstabelecimento" className="block text-sm font-medium text-gray-700 mb-1">Estabelecimento:</label>
                <select
                  id="filterEstabelecimento"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 p-2 bg-white text-gray-800"
                  value={filterEstabelecimento}
                  onChange={(e) => setFilterEstabelecimento(e.target.value)}
                >
                  <option value="todos">Todos os Estabelecimentos</option>
                  {estabelecimentosList.map(estab => (
                    <option key={estab.id} value={estab.id}>{estab.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="filterStatus" className="block text-sm font-medium text-gray-700 mb-1">Status:</label>
                <select
                  id="filterStatus"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 p-2 bg-white text-gray-800"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  {STATUS_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="filterPeriod" className="block text-sm font-medium text-gray-700 mb-1">Período:</label>
                <select
                  id="filterPeriod"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 p-2 bg-white text-gray-800"
                  value={filterPeriod}
                  onChange={(e) => setFilterPeriod(e.target.value)}
                >
                  {PERIOD_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Tabela de Pedidos */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
            <h2 className="text-xl font-bold mb-4 text-black flex items-center gap-2">
              <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
              Pedidos Encontrados ({displayedPedidos.length})
            </h2>
            {displayedPedidos.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhum pedido encontrado com os filtros selecionados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                        ID do Pedido
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                        Estabelecimento
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                        Cliente
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                        Total
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">
                        Criado Em
                      </th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-black uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {displayedPedidos.map(pedido => (
                      <tr key={pedido.id} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {pedido.id.substring(0, 8)}...
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {pedido.estabelecimentoNome}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {pedido.clienteNome}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClasses(pedido.status)}`}>
                            {pedido.status.replace('_', ' ').charAt(0).toUpperCase() + pedido.status.replace('_', ' ').slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-black">
                          R$ {pedido.totalFinal?.toFixed(2).replace('.', ',') || '0,00'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {pedido.criadoEm?.toDate ? format(pedido.criadoEm.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <button
                            onClick={() => handleViewDetails(pedido.id)}
                            className="px-3 py-1 rounded-md bg-yellow-500 hover:bg-yellow-600 text-black font-semibold transition-colors duration-300 shadow-sm"
                          >
                            Ver Detalhes
                          </button>
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
              disabled={!hasPrevious || loading}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md font-semibold hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300"
            >
              Anterior
            </button>
            <span className="text-gray-700 font-medium">Página {currentPage + 1}</span>
            <button
              onClick={handleNextPage}
              disabled={!hasMore || loading}
              className="px-4 py-2 bg-yellow-500 text-black rounded-md font-semibold hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>
    // </Layout>
  );
}

export default ListarPedidosMaster;