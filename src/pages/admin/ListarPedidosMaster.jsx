// src/pages/admin/ListarPedidosMaster.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
// Importe 'limit' e 'startAfter' aqui:
import { collection, query, where, orderBy, onSnapshot, doc, getDocs, getDoc, limit, startAfter } from 'firebase/firestore'; 
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { format, startOfDay, endOfDay, subDays, subMonths } from 'date-fns'; // Importe startOfDay, endOfDay, subMonths
import { ptBR } from 'date-fns/locale';

const ITEMS_PER_PAGE = 10; // Definir quantos itens por página você quer

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

function ListarPedidosMaster() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();

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

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isMasterAdmin) {
        toast.error('Acesso negado. Você não tem permissões de Master Administrador.');
        navigate('/master-dashboard');
        return;
      }
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
  const fetchPedidos = useCallback(async (direction = 'next', startDoc = null) => {
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
    queryConstraints.push(orderBy('criadoEm', 'desc'));

    let q;
    if (direction === 'next' && startDoc) {
      q = query(baseQuery, ...queryConstraints, startAfter(startDoc), limit(ITEMS_PER_PAGE));
    } else if (direction === 'prev' && startDoc) {
      // Para navegação "anterior", precisamos inverter a ordenação para o `endBefore`
      // e depois reverter os resultados. Isso é mais complexo.
      // Para este exemplo, o "Anterior" simplesmente reinicia para a primeira página
      // se não houver um sistema robusto de `pageMarkers`.
      // Implementação simplificada:
      q = query(baseQuery, ...queryConstraints, limit(ITEMS_PER_PAGE)); // Volta para a primeira página
      // Uma implementação robusta de "anterior" exigiria um array de lastVisible/firstVisible para cada página.
    } else { // Primeira carga
      q = query(baseQuery, ...queryConstraints, limit(ITEMS_PER_PAGE));
    }

    try {
      const documentSnapshots = await getDocs(q);
      let fetchedPedidos = [];

      if (direction === 'prev') {
        fetchedPedidos = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();
      } else {
        fetchedPedidos = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      
      const estabNamesPromises = {};
      fetchedPedidos.forEach(pedido => {
        if (pedido.estabelecimentoId && !estabNamesPromises[pedido.estabelecimentoId]) {
          estabNamesPromises[pedido.estabelecimentoId] = getDoc(doc(db, 'estabelecimentos', pedido.estabelecimentoId))
            .then(estabDoc => estabDoc.exists() ? estabDoc.data().nome : 'Estabelecimento Desconhecido')
            .catch(() => 'Erro ao Carregar Estabelecimento');
        }
      });
      const estabNames = await Promise.all(Object.values(estabNamesPromises));
      const estabMap = new Map(Object.keys(estabNamesPromises).map((id, index) => [id, estabNames[index]]));

      const pedidosWithEstabNames = fetchedPedidos.map(pedido => ({
        ...pedido,
        estabelecimentoNome: estabMap.get(pedido.estabelecimentoId) || 'Não Encontrado'
      }));

      setPedidos(pedidosWithEstabNames);

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
      console.error("Erro ao carregar pedidos:", err);
      setError("Erro ao carregar os pedidos. Verifique os filtros ou a conexão.");
    } finally {
      setLoading(false);
    }
  }, [isMasterAdmin, currentUser, filterEstabelecimento, filterStatus, filterPeriod, currentPage]); // Adicionado currentPage

  // Efeito para recarregar quando filtros mudam
  useEffect(() => {
    setLastVisible(null);
    setFirstVisible(null);
    setCurrentPage(0);
    setHasMore(true);
    setHasPrevious(false);
    fetchPedidos('next', null);
  }, [filterEstabelecimento, filterStatus, filterPeriod, searchTerm, fetchPedidos]); // searchTerm aqui para re-filtrar no frontend

  const handleNextPage = () => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
      fetchPedidos('next', lastVisible);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      // Simplificado: Para a primeira página, reinicia.
      // Para as demais, o botão "Anterior" precisaria de uma lógica mais avançada (ex: array de marcadores)
      setCurrentPage(prev => prev - 1);
      fetchPedidos('next', null); // Recarrega do início para simular "anterior"
    }
  };

  const handleViewDetails = (pedidoId) => {
    navigate(`/master/pedidos/${pedidoId}`);
  };

  // Filtragem por termo de busca no frontend (após a paginação do Firebase)
  const displayedPedidos = pedidos.filter(pedido => {
    const term = searchTerm.toLowerCase();
    const matchesId = pedido.id.toLowerCase().includes(term);
    const matchesCliente = pedido.cliente?.nome?.toLowerCase().includes(term);
    const matchesEstabelecimentoNome = pedido.estabelecimentoNome?.toLowerCase().includes(term);

    return matchesId || matchesCliente || matchesEstabelecimentoNome;
  });


  if (authLoading || loading) {
    return (
      // <Layout>
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
          <p className="text-xl text-gray-700">Carregando pedidos...</p>
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
        <div className="max-w-7xl mx-auto">
          {/* Cabeçalho */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 text-center sm:text-left">
              📋 Todos os Pedidos (Master)
            </h1>
            <Link 
              to="/master-dashboard" 
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md font-semibold hover:bg-gray-300 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
              Voltar
            </Link>
          </div>

          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
              <p className="font-bold">Erro:</p>
              <p>{error}</p>
            </div>
          )}

          {/* Seção de Filtros e Busca */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Filtrar Pedidos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700 mb-1">Buscar (ID/Cliente/Estab.):</label>
                <input
                  type="text"
                  id="searchTerm"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                  placeholder="ID do pedido ou nome do cliente/estabelecimento"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="filterEstabelecimento" className="block text-sm font-medium text-gray-700 mb-1">Estabelecimento:</label>
                <select
                  id="filterEstabelecimento"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
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
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-6 text-gray-800 flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
              Pedidos Encontrados ({displayedPedidos.length})
            </h2>
            {displayedPedidos.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Nenhum pedido encontrado com os filtros selecionados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID do Pedido
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estabelecimento
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Criado Em
                      </th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {displayedPedidos.map(pedido => (
                      <tr key={pedido.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {pedido.id.substring(0, 8)}...
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {pedido.estabelecimentoNome}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {pedido.cliente?.nome || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            pedido.status === 'recebido' ? 'bg-red-100 text-red-800' :
                            pedido.status === 'preparo' ? 'bg-yellow-100 text-yellow-800' :
                            pedido.status === 'em_entrega' ? 'bg-orange-100 text-orange-800' :
                            pedido.status === 'finalizado' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {pedido.status.replace('_', ' ').charAt(0).toUpperCase() + pedido.status.replace('_', ' ').slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          R$ {pedido.totalFinal?.toFixed(2).replace('.', ',') || '0,00'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {pedido.criadoEm?.toDate ? format(pedido.criadoEm.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <button
                            onClick={() => handleViewDetails(pedido.id)}
                            className="text-indigo-600 hover:text-indigo-900"
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
              disabled={currentPage === 0 || loading}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md font-semibold hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-gray-700">Página {currentPage + 1}</span>
            <button
              onClick={handleNextPage}
              disabled={!hasMore || loading}
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

export default ListarPedidosMaster;