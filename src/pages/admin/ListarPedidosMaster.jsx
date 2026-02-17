import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  collection, query, onSnapshot, doc, getDoc, limit, orderBy, collectionGroup
} from 'firebase/firestore'; 
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  FaStore, 
  FaUser, 
  FaSearch, 
  FaFilter, 
  FaBoxOpen, 
  FaMotorcycle, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaClock, 
  FaSignOutAlt,
  FaExclamationTriangle,
  FaRedoAlt,
  FaChevronDown,
  FaChevronUp
} from 'react-icons/fa';

const LIMIT = 50;
const DEBOUNCE_DELAY = 300;
const INITIAL_VISIBLE_ITEMS = 20;
const LOAD_MORE_ITEMS = 20;

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos os Status' },
  { value: 'recebido', label: 'Recebido / Pendente' },
  { value: 'preparo', label: 'Em Preparo / Aceito' },
  { value: 'em_entrega', label: 'Em Entrega / Saiu' },
  { value: 'finalizado', label: 'Finalizado / Entregue' },
  { value: 'cancelado', label: 'Cancelado / Recusado' },
];

const STATUS_MATCH = {
  recebido: ['recebido', 'aberto', 'pendente', 'aguardando', 'novo'],
  preparo: ['preparo', 'aceito', 'cozinha', 'andamento'],
  em_entrega: ['entrega', 'saiu', 'rota'],
  finalizado: ['finalizado', 'finalizada', 'entregue', 'concluido', 'fechado', 'pago'],
  cancelado: ['cancelado', 'cancelada', 'recusado', 'estornado']
};

const STATUS_CONFIG = {
  recebido: { icon: FaClock, bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Recebido' },
  preparo: { icon: FaBoxOpen, bg: 'bg-blue-100', text: 'text-blue-800', label: 'Em Preparo' },
  em_entrega: { icon: FaMotorcycle, bg: 'bg-orange-100', text: 'text-orange-800', label: 'Em Entrega' },
  finalizado: { icon: FaCheckCircle, bg: 'bg-green-100', text: 'text-green-800', label: 'Finalizado' },
  cancelado: { icon: FaTimesCircle, bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelado' },
  default: { icon: FaClock, bg: 'bg-gray-100', text: 'text-gray-600', label: 'Desconhecido' }
};

// --- UTILS ---
const safeString = (val) => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') return val.nome || val.name || val.cliente || '';
  return String(val);
};

const normalizeText = (text) => {
  return safeString(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const getOrderDate = (item) => {
  if (!item) return null;
  const timestamp = item.dataPedido || item.adicionadoEm || item.updatedAt || item.createdAt || item.criadoEm;
  if (!timestamp) return null;
  if (timestamp.toDate) return timestamp.toDate();
  return new Date(timestamp);
};

const formatDate = (dateObj) => {
  if (!dateObj) return '--/-- --:--';
  try { return format(dateObj, 'dd/MM HH:mm', { locale: ptBR }); } catch (e) { return 'Data Inv.'; }
};

const formatId = (id) => {
  if (!id) return '#---';
  if (id.length > 8) {
    const parts = id.split('_');
    if (parts.length > 1) return `#${parts[1].substring(0, 6)}...`;
    return `#${id.substring(0, 6)}...`;
  }
  return `#${id}`;
};

const formatCurrency = (value) => {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
};

// --- HOOKS CUSTOMIZADOS ---
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

const useEstabelecimentos = () => {
  const [estabelecimentos, setEstabelecimentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    
    const loadFromCache = () => {
      try {
        const cached = localStorage.getItem('estabelecimentos');
        const cachedTimestamp = localStorage.getItem('estabelecimentos_timestamp');
        
        if (cached && cachedTimestamp) {
          const age = Date.now() - parseInt(cachedTimestamp);
          if (age < 5 * 60 * 1000) { // 5 minutos de cache
            setEstabelecimentos(JSON.parse(cached));
          }
        }
      } catch (e) {
        console.warn('Erro ao carregar cache:', e);
      }
    };

    loadFromCache();

    const q = query(collection(db, 'estabelecimentos'), orderBy('nome', 'asc'));
    const unsub = onSnapshot(q, 
      (snap) => {
        if (!mounted) return;
        const lista = snap.docs.map(d => ({ id: d.id, nome: d.data().nome }));
        setEstabelecimentos(lista);
        setLoading(false);
        
        // Atualizar cache
        try {
          localStorage.setItem('estabelecimentos', JSON.stringify(lista));
          localStorage.setItem('estabelecimentos_timestamp', Date.now().toString());
        } catch (e) {
          console.warn('Erro ao salvar cache:', e);
        }
      },
      (err) => {
        if (!mounted) return;
        console.error('Erro ao carregar estabelecimentos:', err);
        setError('Falha ao carregar estabelecimentos');
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const estabMap = useMemo(() => {
    return estabelecimentos.reduce((acc, curr) => {
      acc[curr.id] = curr.nome;
      return acc;
    }, {});
  }, [estabelecimentos]);

  return { estabelecimentos, estabMap, loading, error };
};

const usePedidosMaster = (filterEstabelecimento, estabMap) => {
  const [itemsMap, setItemsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser, isMasterAdmin } = useAuth();

  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return;

    setLoading(true);
    setError(null);
    
    const unsubscribes = [];
    let mounted = true;

    const setupListeners = () => {
      let strategies = [];

      if (filterEstabelecimento === 'todos') {
        strategies = [
          { name: 'GLOBAL_PEDIDOS', q: query(collectionGroup(db, 'pedidos'), orderBy('dataPedido', 'desc'), limit(LIMIT)) },
          { name: 'GLOBAL_VENDAS', q: query(collectionGroup(db, 'vendas'), orderBy('updatedAt', 'desc'), limit(LIMIT)) }
        ];
      } else {
        strategies = [
          { name: 'LOCAL_PEDIDOS', q: query(collection(db, 'estabelecimentos', filterEstabelecimento, 'pedidos'), orderBy('dataPedido', 'desc'), limit(LIMIT)) },
          { name: 'LOCAL_VENDAS', q: query(collection(db, 'estabelecimentos', filterEstabelecimento, 'vendas'), orderBy('updatedAt', 'desc'), limit(LIMIT)) }
        ];
      }

      strategies.forEach(strat => {
        const unsub = onSnapshot(strat.q, 
          async (snapshot) => {
            if (!mounted) return;

            try {
              const rawDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data(), _path: d.ref.path }));

              const processed = await Promise.all(rawDocs.map(async (item) => {
                let finalEstabId = filterEstabelecimento !== 'todos' ? filterEstabelecimento : item.estabelecimentoId;
                let eNome = filterEstabelecimento !== 'todos' ? estabMap[filterEstabelecimento] : item.estabelecimentoNome;

                if (!finalEstabId && item._path && item._path.includes('estabelecimentos/')) {
                  const parts = item._path.split('/');
                  const index = parts.indexOf('estabelecimentos');
                  if (index >= 0 && parts.length > index + 1) finalEstabId = parts[index + 1];
                }
                
                if (!eNome && finalEstabId && estabMap[finalEstabId]) eNome = estabMap[finalEstabId];
                
                let cNome = safeString(item.clienteNome || item.cliente);
                if ((!cNome || cNome === 'Cliente') && (item.mesaNumero || item.mesaId)) {
                  cNome = item.mesaNumero ? `Mesa ${item.mesaNumero}` : 'Mesa (Balcão)';
                }
                
                let tipoExibicao = 'DELIVERY';
                if (strat.name.includes('VENDAS') || item.source === 'salao' || item.mesaId) tipoExibicao = 'SALÃO';

                let statusRaw = safeString(item.status).toLowerCase().trim();
                
                return {
                  ...item,
                  id: item.id,
                  clienteNomeFinal: cNome || 'Consumidor',
                  estabelecimentoNomeFinal: eNome || 'Não Identificado',
                  estabelecimentoIdFinal: finalEstabId,
                  tipoExibicao,
                  statusRaw,
                  valorFinal: item.totalFinal ?? item.total ?? 0
                };
              }));

              setItemsMap(prev => {
                const next = { ...prev };
                processed.forEach(p => next[p.id] = p);
                return next;
              });
              
              setLoading(false);
            } catch (err) {
              console.error('Erro ao processar pedidos:', err);
              if (mounted) {
                setError('Erro ao processar dados dos pedidos');
              }
            }
          },
          (err) => {
            console.error('Erro no snapshot:', err);
            if (mounted) {
              setError('Falha na conexão com o servidor');
              setLoading(false);
            }
          }
        );

        unsubscribes.push(unsub);
      });
    };

    setupListeners();

    return () => {
      mounted = false;
      unsubscribes.forEach(u => u());
    };
  }, [currentUser, isMasterAdmin, filterEstabelecimento, estabMap]);

  return { itemsMap, loading, error };
};

// --- COMPONENTES ---
const DashboardHeader = ({ navigate, logout }) => (
  <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 h-16 transition-all duration-300">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex justify-between items-center">
      <div 
        className="flex items-center gap-3 cursor-pointer group" 
        onClick={() => navigate('/')}
        role="button"
        tabIndex={0}
        onKeyPress={(e) => e.key === 'Enter' && navigate('/')}
        aria-label="Ir para página inicial"
      >
        <div className="flex items-center gap-1">
          <div className="bg-yellow-400 text-black font-bold p-1 rounded-sm transform -skew-x-12">
            <FaStore />
          </div>
          <span className="text-gray-900 font-extrabold text-xl tracking-tight">
            Na<span className="text-yellow-500">Mão</span>
          </span>
        </div>
      </div>
      <button 
        onClick={logout} 
        className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
        title="Sair"
        aria-label="Sair do sistema"
      >
        <FaSignOutAlt />
      </button>
    </div>
  </header>
);

const StatusBadge = ({ statusRaw, statusLabel }) => {
  let statusKey = 'default';
  
  if (['recebido', 'aberto', 'pendente'].some(s => statusRaw.includes(s))) statusKey = 'recebido';
  else if (['preparo', 'aceito', 'cozinha'].some(s => statusRaw.includes(s))) statusKey = 'preparo';
  else if (['entrega', 'saiu'].some(s => statusRaw.includes(s))) statusKey = 'em_entrega';
  else if (['finalizado', 'entregue', 'concluido', 'fechado'].some(s => statusRaw.includes(s))) statusKey = 'finalizado';
  else if (['cancelado', 'recusado'].some(s => statusRaw.includes(s))) statusKey = 'cancelado';

  const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG.default;
  const Icon = config.icon;

  return (
    <span className={`flex items-center gap-1 ${config.bg} ${config.text} px-2.5 py-1 rounded-full text-xs font-bold`}>
      <Icon /> {statusLabel || config.label}
    </span>
  );
};

const OrderCard = ({ item, onViewDetails }) => {
  const orderDate = useMemo(() => getOrderDate(item), [item]);
  const formattedDate = useMemo(() => formatDate(orderDate), [orderDate]);
  const formattedId = useMemo(() => formatId(item.id), [item.id]);
  const formattedValue = useMemo(() => formatCurrency(item.valorFinal), [item.valorFinal]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all group flex flex-col relative overflow-hidden">
      {/* Faixa lateral indicando tipo */}
      <div 
        className={`absolute left-0 top-0 bottom-0 w-1.5 ${item.tipoExibicao === 'SALÃO' ? 'bg-blue-500' : 'bg-orange-500'}`}
        aria-hidden="true"
      />

      <div className="pl-3 flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-xl text-gray-900 tracking-tight">{formattedId}</span>
            <span 
              className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                item.tipoExibicao === 'SALÃO' 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'bg-orange-50 text-orange-600'
              }`}
              aria-label={`Tipo: ${item.tipoExibicaO}`}
            >
              {item.tipoExibicao}
            </span>
          </div>
          <span className="text-xs text-gray-400 font-medium mt-1 block">
            Criado em: {formattedDate}
          </span>
        </div>
        <StatusBadge statusRaw={item.statusRaw} statusLabel={item.status} />
      </div>
      
      <div className="pl-3 grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
          <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1 mb-1">
            <FaStore className="text-gray-400" /> Loja
          </span>
          <span 
            className="block font-semibold text-gray-800 text-sm truncate" 
            title={item.estabelecimentoNomeFinal}
          >
            {item.estabelecimentoNomeFinal}
          </span>
        </div>
        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
          <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1 mb-1">
            <FaUser className="text-gray-400" /> Cliente
          </span>
          <span 
            className="block font-semibold text-gray-800 text-sm truncate" 
            title={item.clienteNomeFinal}
          >
            {item.clienteNomeFinal}
          </span>
        </div>
      </div>

      <div className="pl-3 mt-auto flex justify-between items-center pt-2 border-t border-gray-50">
        <div>
          <span className="text-[10px] text-gray-400 font-bold uppercase mr-2">Total</span>
          <span className="font-bold text-xl text-gray-900">
            {formattedValue}
          </span>
        </div>
        <button 
          onClick={() => onViewDetails(item.id)} 
          className="px-5 py-2.5 bg-black text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors shadow-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2"
          aria-label={`Ver detalhes do pedido ${formattedId}`}
        >
          Ver Detalhes
        </button>
      </div>
    </div>
  );
};

const FilterBar = ({ 
  searchTerm, 
  onSearchChange, 
  filterEstabelecimento, 
  onEstabelecimentoChange,
  estabelecimentosList,
  filterStatus,
  onStatusChange,
  totalItems,
  displayedItems
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-col lg:flex-row gap-4">
      <div className="flex-1 relative">
        <FaSearch className="absolute left-4 top-3.5 text-gray-300" aria-hidden="true" />
        <input 
          type="text" 
          placeholder="Buscar ID, Cliente ou Loja..." 
          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:border-yellow-400 focus:bg-white focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-20 transition-all text-sm"
          value={searchTerm} 
          onChange={e => onSearchChange(e.target.value)}
          aria-label="Buscar pedidos"
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative min-w-[200px]">
          <FaStore className="absolute left-4 top-3.5 text-gray-300" aria-hidden="true" />
          <select 
            className="w-full pl-10 pr-8 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-20 text-sm appearance-none cursor-pointer" 
            value={filterEstabelecimento} 
            onChange={e => onEstabelecimentoChange(e.target.value)}
            aria-label="Filtrar por estabelecimento"
          >
            <option value="todos">Todas as Lojas</option>
            {estabelecimentosList.map(e => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>
          <FaChevronDown className="absolute right-4 top-3.5 text-gray-300 pointer-events-none" aria-hidden="true" />
        </div>
        <div className="relative min-w-[180px]">
          <FaFilter className="absolute left-4 top-3.5 text-gray-300" aria-hidden="true" />
          <select 
            className="w-full pl-10 pr-8 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-20 text-sm appearance-none cursor-pointer" 
            value={filterStatus} 
            onChange={e => onStatusChange(e.target.value)}
            aria-label="Filtrar por status"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <FaChevronDown className="absolute right-4 top-3.5 text-gray-300 pointer-events-none" aria-hidden="true" />
        </div>
      </div>
      <div className="flex items-center px-4 py-2 bg-gray-50 rounded-xl text-xs font-medium text-gray-500 border border-gray-100">
        <span>Exibindo {displayedItems} de {totalItems}</span>
      </div>
    </div>
  );
};

const ErrorAlert = ({ message, onRetry }) => (
  <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center max-w-lg mx-auto">
    <FaExclamationTriangle className="mx-auto text-4xl text-red-400 mb-3" />
    <h3 className="text-lg font-bold text-red-800 mb-2">Ops! Algo deu errado</h3>
    <p className="text-red-600 mb-4">{message}</p>
    {onRetry && (
      <button 
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
      >
        <FaRedoAlt /> Tentar novamente
      </button>
    )}
  </div>
);

const LoadingSpinner = () => (
  <div className="text-center py-20" role="status" aria-label="Carregando">
    <div className="w-12 h-12 border-4 border-gray-200 border-t-yellow-400 rounded-full animate-spin mx-auto mb-4"></div>
    <p className="text-gray-500">Carregando pedidos...</p>
  </div>
);

const EmptyState = ({ onClearFilters }) => (
  <div className="col-span-1 xl:col-span-2 text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
    <FaBoxOpen className="mx-auto text-4xl text-gray-200 mb-3" aria-hidden="true" />
    <p className="text-gray-500 font-medium">Nenhum pedido encontrado com este filtro.</p>
    <button 
      onClick={onClearFilters} 
      className="mt-2 text-yellow-600 font-bold text-sm hover:underline focus:outline-none focus:text-yellow-700"
      aria-label="Limpar todos os filtros"
    >
      Limpar filtros
    </button>
  </div>
);

// --- COMPONENTE PRINCIPAL ---
function ListarPedidosMaster() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  // Estados
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstabelecimento, setFilterEstabelecimento] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_ITEMS);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // Refs
  const containerRef = useRef(null);
  
  // Hooks customizados
  const debouncedSearch = useDebounce(searchTerm, DEBOUNCE_DELAY);
  const { estabelecimentos, estabMap, error: estabError } = useEstabelecimentos();
  const { itemsMap, loading: ordersLoading, error: ordersError } = usePedidosMaster(filterEstabelecimento, estabMap);

  // Memoized values
  const listaFinal = useMemo(() => {
    return Object.values(itemsMap).sort((a, b) => (getOrderDate(b) || 0) - (getOrderDate(a) || 0));
  }, [itemsMap]);

  const displayed = useMemo(() => {
    return listaFinal.filter(item => {
      const term = normalizeText(debouncedSearch);
      const searchableText = normalizeText(item.id + ' ' + item.clienteNomeFinal + ' ' + item.estabelecimentoNomeFinal);
      const matchText = searchableText.includes(term);
      const matchEstab = filterEstabelecimento === 'todos' || item.estabelecimentoIdFinal === filterEstabelecimento;

      let matchStatus = false;
      const s = item.statusRaw;

      if (filterStatus === 'todos') matchStatus = true;
      else matchStatus = STATUS_MATCH[filterStatus]?.some(st => s.includes(st)) || false;

      return matchText && matchEstab && matchStatus;
    });
  }, [listaFinal, debouncedSearch, filterEstabelecimento, filterStatus]);

  const displayedPaginated = useMemo(() => {
    return displayed.slice(0, visibleCount);
  }, [displayed, visibleCount]);

  // Handlers
  const handleViewDetails = useCallback((orderId) => {
    navigate(`/master/pedidos/${orderId}`);
  }, [navigate]);

  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setFilterStatus('todos');
    setFilterEstabelecimento('todos');
    setVisibleCount(INITIAL_VISIBLE_ITEMS);
  }, []);

  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + LOAD_MORE_ITEMS, displayed.length));
  }, [displayed.length]);

  // Scroll to top button
  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        setShowScrollTop(containerRef.current.scrollTop > 400);
      }
    };

    const currentRef = containerRef.current;
    if (currentRef) {
      currentRef.addEventListener('scroll', handleScroll);
      return () => currentRef.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scrollToTop = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Auth loading
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Auth check
  if (!currentUser || !isMasterAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <FaExclamationTriangle className="mx-auto text-4xl text-yellow-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
          <p className="text-gray-600 mb-6">Você não tem permissão para acessar esta página.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  const error = estabError || ordersError;

  return (
    <div 
      ref={containerRef}
      className="bg-gray-50 min-h-screen pt-20 pb-12 px-4 sm:px-6 font-sans overflow-auto"
    >
      <DashboardHeader navigate={navigate} logout={logout} />

      <div className="max-w-7xl mx-auto">
        
        {/* HEADER DA PÁGINA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <Link 
              to="/master-dashboard" 
              className="text-gray-400 hover:text-gray-600 flex items-center gap-2 mb-2 text-sm font-medium transition-colors focus:outline-none focus:text-gray-900"
              aria-label="Voltar ao Dashboard"
            >
              ← Voltar ao Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Monitor de Pedidos</h1>
            <p className="text-gray-500 text-sm mt-1">Acompanhamento em tempo real de todas as lojas.</p>
          </div>
        </div>
        
        {/* BARRA DE FILTROS */}
        <FilterBar 
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filterEstabelecimento={filterEstabelecimento}
          onEstabelecimentoChange={setFilterEstabelecimento}
          estabelecimentosList={estabelecimentos}
          filterStatus={filterStatus}
          onStatusChange={setFilterStatus}
          totalItems={listaFinal.length}
          displayedItems={displayedPaginated.length}
        />

        {/* ERROR STATE */}
        {error && (
          <div className="mb-6">
            <ErrorAlert message={error} onRetry={() => window.location.reload()} />
          </div>
        )}

        {/* LISTA DE PEDIDOS */}
        {ordersLoading && displayed.length === 0 ? (
          <LoadingSpinner />
        ) : (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pb-12">
              {displayedPaginated.length > 0 ? (
                displayedPaginated.map(item => (
                  <OrderCard 
                    key={item.id} 
                    item={item} 
                    onViewDetails={handleViewDetails}
                  />
                ))
              ) : (
                <EmptyState onClearFilters={handleClearFilters} />
              )}
            </div>

            {/* LOAD MORE BUTTON */}
            {displayedPaginated.length < displayed.length && (
              <div className="flex justify-center pb-8">
                <button
                  onClick={handleLoadMore}
                  className="px-6 py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  Carregar mais {Math.min(LOAD_MORE_ITEMS, displayed.length - displayedPaginated.length)} pedidos
                </button>
              </div>
            )}
          </>
        )}

        {/* SCROLL TO TOP BUTTON */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 bg-black text-white p-3 rounded-full shadow-lg hover:bg-gray-800 transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2"
            aria-label="Voltar ao topo"
          >
            <FaChevronUp />
          </button>
        )}
      </div>
    </div>
  );
}

export default ListarPedidosMaster;