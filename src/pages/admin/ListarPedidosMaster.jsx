import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  collection, query, onSnapshot, doc, getDoc, limit, orderBy, collectionGroup, where
} from 'firebase/firestore'; 
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  FaStore, FaUser, FaSearch, FaFilter, FaBoxOpen, FaMotorcycle, FaCheckCircle, 
  FaTimesCircle, FaClock, FaSignOutAlt, FaExclamationTriangle, FaRedoAlt,
  FaChevronDown, FaChevronUp, FaArrowLeft, FaReceipt, FaSync, FaMapMarkerAlt,
  FaBolt, FaCrown
} from 'react-icons/fa';
import { IoSearchOutline } from 'react-icons/io5';

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
  recebido: { icon: FaClock, bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200', label: 'Recebido' },
  preparo: { icon: FaBoxOpen, bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', label: 'Em Preparo', pulse: true },
  em_entrega: { icon: FaMotorcycle, bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200', label: 'Em Entrega', pulse: true },
  finalizado: { icon: FaCheckCircle, bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200', label: 'Finalizado' },
  cancelado: { icon: FaTimesCircle, bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200', label: 'Cancelado' },
  default: { icon: FaClock, bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', label: 'Desconhecido' }
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
          if (age < 5 * 60 * 1000) setEstabelecimentos(JSON.parse(cached));
        }
      } catch (e) { console.warn('Erro cache:', e); }
    };

    loadFromCache();

    const q = query(collection(db, 'estabelecimentos'), orderBy('nome', 'asc'));
    const unsub = onSnapshot(q, 
      (snap) => {
        if (!mounted) return;
        const lista = snap.docs.map(d => ({ id: d.id, nome: d.data().nome }));
        setEstabelecimentos(lista);
        setLoading(false);
        try {
          localStorage.setItem('estabelecimentos', JSON.stringify(lista));
          localStorage.setItem('estabelecimentos_timestamp', Date.now().toString());
        } catch (e) {}
      },
      (err) => {
        if (!mounted) return;
        setError('Falha ao carregar estabelecimentos');
        setLoading(false);
      }
    );
    return () => { mounted = false; unsub(); };
  }, []);

  const estabMap = useMemo(() => {
    return estabelecimentos.reduce((acc, curr) => { acc[curr.id] = curr.nome; return acc; }, {});
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
          { name: 'GLOBAL_PEDIDOS_RAIZ', q: query(collection(db, 'pedidos'), orderBy('createdAt', 'desc'), limit(LIMIT)) },
          { name: 'GLOBAL_PEDIDOS_SALAO', q: query(collectionGroup(db, 'pedidos'), orderBy('createdAt', 'desc'), limit(LIMIT)) },
          { name: 'GLOBAL_VENDAS', q: query(collectionGroup(db, 'vendas'), orderBy('createdAt', 'desc'), limit(LIMIT)) }
        ];
      } else {
        strategies = [
          { name: 'LOCAL_PEDIDOS_RAIZ', q: query(collection(db, 'pedidos'), where('estabelecimentoId', '==', filterEstabelecimento), orderBy('createdAt', 'desc'), limit(LIMIT)) },
          { name: 'LOCAL_PEDIDOS_SALAO', q: query(collection(db, 'estabelecimentos', filterEstabelecimento, 'pedidos'), orderBy('createdAt', 'desc'), limit(LIMIT)) },
          { name: 'LOCAL_VENDAS', q: query(collection(db, 'estabelecimentos', filterEstabelecimento, 'vendas'), orderBy('createdAt', 'desc'), limit(LIMIT)) }
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
                if (strat.name.includes('VENDAS') || strat.name.includes('SALAO') || item.source === 'salao' || item.mesaId) {
                    tipoExibicao = 'SALÃO';
                }

                let statusRaw = safeString(item.status).toLowerCase().trim();
                
                return {
                  ...item,
                  id: item.id,
                  clienteNomeFinal: cNome || 'Consumidor',
                  estabelecimentoNomeFinal: eNome || 'Não Identificado',
                  estabelecimentoIdFinal: finalEstabId,
                  tipoExibicao,
                  statusRaw,
                  valorFinal: item.totalFinal ?? item.total ?? item.valorFinal ?? 0
                };
              }));

              setItemsMap(prev => {
                const next = { ...prev };
                processed.forEach(p => next[p.id] = p);
                return next;
              });
              setLoading(false);
            } catch (err) {
              if (mounted) setError('Erro ao processar dados dos pedidos');
            }
          },
          (err) => {
            if (mounted && filterEstabelecimento !== 'todos') setLoading(false);
          }
        );
        unsubscribes.push(unsub);
      });
    };

    setupListeners();
    return () => { mounted = false; unsubscribes.forEach(u => u()); };
  }, [currentUser, isMasterAdmin, filterEstabelecimento, estabMap]);

  return { itemsMap, loading, error };
};

// --- COMPONENTES VISUAIS PREMIUM ---

const IdeaFoodNavbar = ({ navigate, logout, userName }) => (
  <nav className="sticky top-0 z-50 h-16 border-b border-slate-100 bg-white/80 backdrop-blur-xl shadow-sm">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
      <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-md shadow-yellow-400/25 group-hover:scale-105 transition-transform">
          <FaBolt className="text-white text-xs" />
        </div>
        <span className="text-slate-900 font-black text-lg tracking-tight">Idea<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-amber-500">Food</span></span>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center justify-center"><FaCrown className="text-yellow-600 text-[10px]" /></div>
          <span className="text-sm font-bold text-slate-700">{userName || 'Admin'}</span>
        </div>
        <button onClick={logout} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"><FaSignOutAlt size={14} /></button>
      </div>
    </div>
  </nav>
);

const StatusBadge = ({ statusRaw, statusLabel }) => {
  let statusKey = 'default';
  
  if (['recebido', 'aberto', 'pendente', 'novo'].some(s => statusRaw.includes(s))) statusKey = 'recebido';
  else if (['preparo', 'aceito', 'cozinha'].some(s => statusRaw.includes(s))) statusKey = 'preparo';
  else if (['entrega', 'saiu'].some(s => statusRaw.includes(s))) statusKey = 'em_entrega';
  else if (['finalizado', 'entregue', 'concluido', 'fechado', 'pago'].some(s => statusRaw.includes(s))) statusKey = 'finalizado';
  else if (['cancelado', 'recusado'].some(s => statusRaw.includes(s))) statusKey = 'cancelado';

  const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG.default;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 ${config.bg} ${config.text} px-3 py-1 rounded-lg text-xs font-bold border ${config.border} shadow-sm ${config.pulse ? 'animate-pulse' : ''}`}>
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
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-100 hover:-translate-y-0.5 transition-all duration-300 group flex flex-col relative overflow-hidden">
      {/* Top Banner indicating type */}
      <div className={`h-1.5 w-full ${item.tipoExibicao === 'SALÃO' ? 'bg-gradient-to-r from-blue-400 to-indigo-400' : 'bg-gradient-to-r from-orange-400 to-amber-400'}`} />

      <div className="p-6 flex flex-col h-full">
          <div className="flex justify-between items-start mb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-2xl text-gray-900 tracking-tight">{formattedId}</span>
                <span className={`text-[9px] px-2 py-1 rounded-md font-black uppercase tracking-widest ${
                    item.tipoExibicao === 'SALÃO' 
                      ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                      : 'bg-orange-50 text-orange-600 border border-orange-100'
                  }`}
                >
                  {item.tipoExibicao}
                </span>
              </div>
              <span className="text-xs text-gray-400 font-medium mt-1 flex items-center gap-1">
                <FaClock className="text-gray-300" /> {formattedDate}
              </span>
            </div>
            <StatusBadge statusRaw={item.statusRaw} statusLabel={item.status} />
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100/50 flex flex-col justify-center">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                <FaStore className="text-gray-400" /> Loja
              </span>
              <span className="block font-bold text-gray-800 text-sm truncate" title={item.estabelecimentoNomeFinal}>
                {item.estabelecimentoNomeFinal}
              </span>
            </div>
            <div className="bg-gray-50/80 p-3.5 rounded-2xl border border-gray-100/50 flex flex-col justify-center">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                <FaUser className="text-gray-400" /> Cliente/Mesa
              </span>
              <span className="block font-bold text-gray-800 text-sm truncate" title={item.clienteNomeFinal}>
                {item.clienteNomeFinal}
              </span>
            </div>
          </div>

          <div className="mt-auto flex justify-between items-center pt-4 border-t border-gray-50">
            <div>
              <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest mr-2">Valor Total</span>
              <span className="font-black text-2xl text-gray-900 tracking-tighter">
                {formattedValue}
              </span>
            </div>
            <button 
              onClick={() => onViewDetails(item.id)} 
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-yellow-400/30 transition-all active:scale-95"
            >
              <FaReceipt /> Detalhes
            </button>
          </div>
      </div>
    </div>
  );
};

const FilterBar = ({ 
  searchTerm, onSearchChange, filterEstabelecimento, onEstabelecimentoChange, estabelecimentosList, filterStatus, onStatusChange, totalItems, displayedItems
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6 flex flex-col xl:flex-row gap-3 relative z-10">
      <div className="flex-1 relative">
        <IoSearchOutline className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input 
          type="text" 
          placeholder="Buscar Pedido (ID, Cliente ou Loja)..." 
          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 focus:bg-white transition-all font-semibold text-slate-700 text-sm"
          value={searchTerm} 
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <select 
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[11px] font-bold text-slate-600 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 appearance-none cursor-pointer min-w-[180px]" 
          value={filterEstabelecimento} 
          onChange={e => onEstabelecimentoChange(e.target.value)}
        >
          <option value="todos">Todas as Lojas</option>
          {estabelecimentosList.map(e => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </select>
        <select 
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[11px] font-bold text-slate-600 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 appearance-none cursor-pointer min-w-[160px]" 
          value={filterStatus} 
          onChange={e => onStatusChange(e.target.value)}
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center px-3 py-2 bg-slate-50 rounded-xl text-[11px] font-bold text-slate-400 border border-slate-100">
        <span>{displayedItems} de {totalItems}</span>
      </div>
    </div>
  );
};

const LoadingSpinner = () => (
  <div className="text-center py-24 flex flex-col items-center justify-center">
    <div className="w-14 h-14 border-4 border-gray-200 border-t-yellow-400 rounded-full animate-spin mb-4 shadow-lg"></div>
    <p className="text-gray-500 font-bold">Monitorizando rede...</p>
  </div>
);

const EmptyState = ({ onClearFilters }) => (
  <div className="col-span-1 xl:col-span-2 text-center py-24 bg-white rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center">
    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-5 shadow-inner">
        <FaBoxOpen className="text-4xl text-gray-300" />
    </div>
    <h3 className="text-xl font-black text-gray-800 tracking-tight">Nenhum pedido listado</h3>
    <p className="text-gray-400 text-sm mt-2 font-medium">Nenhum pedido encontrado para os filtros atuais.</p>
    <button 
      onClick={onClearFilters} 
      className="mt-6 px-6 py-2.5 bg-yellow-50 text-yellow-700 font-bold rounded-xl hover:bg-yellow-400 hover:text-black transition-colors"
    >
      Limpar todos os filtros
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
  const masterUserName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Admin';

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center bg-slate-50"><div className="w-12 h-12 border-4 border-slate-200 border-t-yellow-400 rounded-full animate-spin"></div></div>;
  }

  // Auth check
  if (!currentUser || !isMasterAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/20 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm p-10 max-w-md text-center border border-slate-100">
          <FaExclamationTriangle className="mx-auto text-4xl text-red-400 mb-5 animate-pulse" />
          <h2 className="text-xl font-black text-slate-900 mb-2">Acesso Negado</h2>
          <p className="text-slate-500 mb-8 font-medium text-sm">Você não tem os privilégios necessários.</p>
          <button onClick={() => navigate('/')} className="w-full py-3.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-white rounded-xl font-black hover:shadow-lg hover:shadow-yellow-400/30 transition-all active:scale-95">
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
      className="bg-gradient-to-br from-slate-50 via-white to-amber-50/20 min-h-screen font-sans overflow-auto"
    >
      <IdeaFoodNavbar navigate={navigate} logout={async () => { await logout(); navigate('/'); }} userName={masterUserName} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        
        {/* HEADER DA PÁGINA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 pt-8">
          <div>
            <button 
              onClick={() => navigate('/master-dashboard')} 
              className="text-slate-400 hover:text-yellow-600 flex items-center gap-2 mb-4 text-sm font-bold transition-colors group"
            >
              <span className="bg-white p-1.5 rounded-lg shadow-sm border border-slate-100 group-hover:border-yellow-200 transition-colors">
                <FaArrowLeft />
              </span> 
              Voltar ao Dashboard
            </button>
            <div className="flex items-center gap-3 mb-2">
                <span className="bg-yellow-50 text-yellow-700 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-yellow-200">Central de Despacho</span>
                {ordersLoading && <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 uppercase tracking-widest"><FaSync className="animate-spin" /> Live</span>}
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Monitor de Pedidos</h1>
            <p className="text-slate-500 text-sm mt-1 font-medium">Acompanhamento centralizado — Delivery e Salão.</p>
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
          <div className="mb-6 bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-sm font-bold flex items-center gap-2">
            <FaExclamationTriangle /> {error}
            <button onClick={() => window.location.reload()} className="ml-auto text-red-500 hover:text-red-700 font-bold text-xs underline">Recarregar</button>
          </div>
        )}

        {/* LISTA DE PEDIDOS */}
        {ordersLoading && displayed.length === 0 ? (
          <LoadingSpinner />
        ) : (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-12">
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
                  className="px-8 py-4 bg-white border-2 border-gray-100 rounded-2xl font-bold text-gray-700 hover:border-yellow-400 hover:text-yellow-600 transition-all shadow-sm active:scale-95"
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
            className="fixed bottom-8 right-8 bg-gradient-to-r from-yellow-400 to-amber-500 text-white p-4 rounded-full shadow-xl shadow-yellow-400/30 hover:scale-110 transition-all focus:outline-none z-50 group"
            aria-label="Voltar ao topo"
          >
            <FaChevronUp className="group-hover:-translate-y-1 transition-transform" />
          </button>
        )}
      </div>
    </div>
  );
}

export default ListarPedidosMaster;