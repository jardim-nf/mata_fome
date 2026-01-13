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

// --- Componente de Header Master Dashboard Atualizado ---
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

// --- Helper para Cores de Status Melhorado ---
const getStatusBadgeClasses = (status) => {
  switch (status) {
    case 'recebido':
      return 'bg-red-100 text-red-800 border border-red-200';
    case 'preparo':
      return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
    case 'em_entrega':
      return 'bg-blue-100 text-blue-800 border border-blue-200';
    case 'finalizado':
      return 'bg-green-100 text-green-800 border border-green-200';
    case 'cancelado':
      return 'bg-gray-100 text-gray-800 border border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border border-gray-200';
  }
};

// Componente de Card de Pedido
function PedidoCard({ pedido, onViewDetails }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Pedido #{pedido.id.substring(0, 8)}...
          </h3>
          <div className="flex items-center gap-2 mb-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClasses(pedido.status)}`}>
              {pedido.status.replace('_', ' ').charAt(0).toUpperCase() + pedido.status.replace('_', ' ').slice(1)}
            </span>
            <span className="text-sm text-gray-500">
              {pedido.criadoEm?.toDate ? format(pedido.criadoEm.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">
            R$ {pedido.totalFinal?.toFixed(2).replace('.', ',') || '0,00'}
          </p>
          <p className="text-sm text-gray-500">Total</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Estabelecimento</p>
          <p className="text-sm text-gray-900 font-medium">{pedido.estabelecimentoNome}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Cliente</p>
          <p className="text-sm text-gray-900 font-medium">{pedido.clienteNome}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => onViewDetails(pedido.id)}
          className="px-6 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-semibold hover:from-yellow-600 hover:to-orange-600 transition-all duration-300 flex items-center gap-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
          </svg>
          Ver Detalhes
        </button>
      </div>
    </div>
  );
}

function ListarPedidosMaster() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();

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
  const [pageMarkers, setPageMarkers] = useState([{ page: 0, startDoc: null, endDoc: null }]);

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

    queryConstraints.push(orderBy('criadoEm', 'desc'));

    let q;
    let currentStartDoc = null;

    if (direction === 'next' && lastVisible) {
        currentStartDoc = lastVisible;
        q = query(baseQuery, ...queryConstraints, startAfter(currentStartDoc), limit(ITEMS_PER_PAGE));
    } else if (direction === 'prev' && firstVisible && currentPage > 0) {
        const prevPageMarker = pageMarkers[currentPage - 1];
        if (prevPageMarker && prevPageMarker.startDoc) {
             currentStartDoc = prevPageMarker.startDoc;
             q = query(baseQuery, ...queryConstraints, endBefore(firstVisible), limitToLast(ITEMS_PER_PAGE));
        } else {
             q = query(baseQuery, ...queryConstraints, limit(ITEMS_PER_PAGE));
             setCurrentPage(0);
        }
    } else {
      q = query(baseQuery, ...queryConstraints, limit(ITEMS_PER_PAGE));
    }

    try {
      const documentSnapshots = await getDocs(q);
      let fetchedPedidos = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (direction === 'prev' && documentSnapshots.docs.length > 0) {
        fetchedPedidos.reverse();
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

        if (direction === 'next' && currentPage === pageMarkers.length -1) {
            setPageMarkers(prev => [...prev, { page: currentPage + 1, startDoc: newFirstVisible, endDoc: newLastVisible }]);
        } else if (direction === 'prev' && currentPage > 0) {
            setPageMarkers(prev => prev.slice(0, currentPage));
        }
        
        const nextQueryCheck = query(baseQuery, ...queryConstraints, startAfter(newLastVisible), limit(1));
        const nextSnapshotCheck = await getDocs(nextQueryCheck);
        setHasMore(!nextSnapshotCheck.empty);

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
    setLastVisible(null);
    setFirstVisible(null);
    setCurrentPage(0);
    setHasMore(true);
    setHasPrevious(false);
    setPageMarkers([{ page: 0, startDoc: null, endDoc: null }]);
    fetchPedidos('next');
  }, [filterEstabelecimento, filterStatus, filterPeriod, searchTerm]);

  const handleNextPage = () => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
      fetchPedidos('next');
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 0) {
        setCurrentPage(prev => prev - 1);
        fetchPedidos('prev');
    }
  };

  const handleViewDetails = (pedidoId) => {
    navigate(`/master/pedidos/${pedidoId}`);
  };

  // Filtragem por termo de busca no frontend
  const displayedPedidos = pedidos.filter(pedido => {
    const term = searchTerm.toLowerCase();
    const matchesId = pedido.id.toLowerCase().includes(term);
    const matchesCliente = pedido.clienteNome?.toLowerCase().includes(term);
    const matchesEstabelecimentoNome = pedido.estabelecimentoNome?.toLowerCase().includes(term);

    return matchesId || matchesCliente || matchesEstabelecimentoNome;
  });

  if (authLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-500 mb-4"></div>
        <p className="text-xl text-gray-600 font-medium">Carregando pedidos...</p>
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
        {/* Cabeçalho da Página */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-gray-900 text-center lg:text-left">
              📋 Todos os Pedidos
            </h1>
            <p className="text-lg text-gray-600 mt-2 text-center lg:text-left">
              Gerencie e visualize todos os pedidos do sistema
            </p>
            <div className="w-32 h-1 bg-gradient-to-r from-yellow-500 to-orange-500 mx-auto lg:mx-0 mt-4 rounded-full"></div>
          </div>
          <Link
            to="/master-dashboard"
            className="bg-white text-gray-700 font-semibold px-6 py-3 rounded-xl border border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all duration-300 flex items-center gap-3 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            Voltar ao Dashboard
          </Link>
        </div>

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

        {/* Estatísticas Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Pedidos</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{displayedPedidos.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pedidos Hoje</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {displayedPedidos.filter(p => 
                    p.criadoEm?.toDate && 
                    format(p.criadoEm.toDate(), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                  ).length}
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
                <p className="text-sm font-medium text-gray-600">Em Preparo</p>
                <p className="text-3xl font-bold text-yellow-600 mt-2">
                  {displayedPedidos.filter(p => p.status === 'preparo').length}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Valor Total</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  R$ {displayedPedidos.reduce((sum, p) => sum + (p.totalFinal || 0), 0).toFixed(2).replace('.', ',')}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Seção de Filtros e Busca */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-gray-200">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 flex items-center gap-3">
            <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
            </svg>
            Filtrar Pedidos
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div>
              <label htmlFor="searchTerm" className="block text-sm font-semibold text-gray-700 mb-3">Buscar Pedidos</label>
              <div className="relative">
                <input
                  type="text"
                  id="searchTerm"
                  className="w-full rounded-xl border-gray-300 bg-gray-50 px-4 py-3 pl-12 text-gray-800 placeholder-gray-500 transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 focus:shadow-lg border-0"
                  placeholder="ID, cliente ou estabelecimento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </div>
            </div>

            <div>
              <label htmlFor="filterEstabelecimento" className="block text-sm font-semibold text-gray-700 mb-3">Estabelecimento</label>
              <select
                id="filterEstabelecimento"
                className="w-full rounded-xl border-gray-300 bg-gray-50 px-4 py-3 text-gray-800 transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 focus:shadow-lg border-0"
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
              <label htmlFor="filterStatus" className="block text-sm font-semibold text-gray-700 mb-3">Status</label>
              <select
                id="filterStatus"
                className="w-full rounded-xl border-gray-300 bg-gray-50 px-4 py-3 text-gray-800 transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 focus:shadow-lg border-0"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filterPeriod" className="block text-sm font-semibold text-gray-700 mb-3">Período</label>
              <select
                id="filterPeriod"
                className="w-full rounded-xl border-gray-300 bg-gray-50 px-4 py-3 text-gray-800 transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 focus:shadow-lg border-0"
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

        {/* Lista de Pedidos */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 flex items-center gap-3">
            <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
            </svg>
            Pedidos Encontrados ({displayedPedidos.length})
          </h2>
          
          {displayedPedidos.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhum pedido encontrado</h3>
              <p className="text-gray-600 mb-6">Tente ajustar os filtros de busca para ver mais resultados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {displayedPedidos.map(pedido => (
                <PedidoCard 
                  key={pedido.id} 
                  pedido={pedido} 
                  onViewDetails={handleViewDetails}
                />
              ))}
            </div>
          )}
        </div>

        {/* CONTROLES DE PAGINAÇÃO */}
        <div className="flex justify-center items-center mt-12 space-x-4">
          <button
            onClick={handlePreviousPage}
            disabled={!hasPrevious || loading}
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
            disabled={!hasMore || loading}
            className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-semibold hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:transform-none"
          >
            Próxima
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ListarPedidosMaster;