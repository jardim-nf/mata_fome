import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, limit, orderBy, collectionGroup, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- CONSTANTS ---
export const LIMIT = 50;
export const DEBOUNCE_DELAY = 300;
export const INITIAL_VISIBLE_ITEMS = 20;
export const LOAD_MORE_ITEMS = 20;

export const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos os Status' },
  { value: 'recebido', label: 'Recebido / Pendente' },
  { value: 'preparo', label: 'Em Preparo / Aceito' },
  { value: 'em_entrega', label: 'Em Entrega / Saiu' },
  { value: 'finalizado', label: 'Finalizado / Entregue' },
  { value: 'cancelado', label: 'Cancelado / Recusado' },
];

export const STATUS_MATCH = {
  recebido: ['recebido', 'aberto', 'pendente', 'aguardando', 'novo'],
  preparo: ['preparo', 'aceito', 'cozinha', 'andamento'],
  em_entrega: ['entrega', 'saiu', 'rota'],
  finalizado: ['finalizado', 'finalizada', 'entregue', 'concluido', 'fechado', 'pago'],
  cancelado: ['cancelado', 'cancelada', 'recusado', 'estornado']
};

// --- UTILS ---
export const safeString = (val) => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') return val.nome || val.name || val.cliente || '';
  return String(val);
};

export const normalizeText = (text) => {
  return safeString(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export const getOrderDate = (item) => {
  if (!item) return null;
  const timestamp = item.dataPedido || item.adicionadoEm || item.updatedAt || item.createdAt || item.criadoEm;
  if (!timestamp) return null;
  if (timestamp.toDate) return timestamp.toDate();
  return new Date(timestamp);
};

export const formatDate = (dateObj) => {
  if (!dateObj) return '--/-- --:--';
  try { return format(dateObj, 'dd/MM HH:mm', { locale: ptBR }); } catch (e) { return 'Data Inv.'; }
};

export const formatId = (id) => {
  if (!id) return '#---';
  if (id.length > 8) {
    const parts = id.split('_');
    if (parts.length > 1) return `#${parts[1].substring(0, 6)}...`;
    return `#${id.substring(0, 6)}...`;
  }
  return `#${id}`;
};

// --- HOOKS INTERNOS ---
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

function useEstabelecimentos() {
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

    const fetchEstabelecimentos = async () => {
      try {
        const q = query(collection(db, 'estabelecimentos'), orderBy('nome', 'asc'));
        const snap = await getDocs(q);
        if (!mounted) return;
        const lista = snap.docs.map(d => ({ id: d.id, nome: d.data().nome }));
        setEstabelecimentos(lista);
        setLoading(false);
        try {
          localStorage.setItem('estabelecimentos', JSON.stringify(lista));
          localStorage.setItem('estabelecimentos_timestamp', Date.now().toString());
        } catch (e) { console.error(e); }
      } catch (err) {
        if (!mounted) return;
        setError('Falha ao carregar estabelecimentos');
        setLoading(false);
      }
    };
    fetchEstabelecimentos();
    return () => { mounted = false; };
  }, []);

  const estabMap = useMemo(() => {
    return estabelecimentos.reduce((acc, curr) => { acc[curr.id] = curr.nome; return acc; }, {});
  }, [estabelecimentos]);

  return { estabelecimentos, estabMap, loading, error };
}

function usePedidosMaster(filterEstabelecimento, estabMap, currentUser, isMasterAdmin) {
  const [itemsMap, setItemsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return;
    setLoading(true);
    setError(null);
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
        const fetchOrders = async () => {
          try {
            const snapshot = await getDocs(strat.q);
            if (!mounted) return;
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
            setLoading(false);
          }
        };
        fetchOrders();
      });
    };

    setupListeners();
    return () => { mounted = false; };
  }, [currentUser, isMasterAdmin, filterEstabelecimento, estabMap]);

  return { itemsMap, loading, error };
}

// --- MASTER HOOK ---
export function useListarPedidosMasterData({ currentUser, isMasterAdmin }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstabelecimento, setFilterEstabelecimento] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [dateInicio, setDateInicio] = useState(null);
  const [dateFim, setDateFim] = useState(null);
  const [datePreset, setDatePreset] = useState(null);
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_ITEMS);

  const debouncedSearch = useDebounce(searchTerm, DEBOUNCE_DELAY);
  
  const { 
    estabelecimentos, estabMap, error: estabError 
  } = useEstabelecimentos();
  
  const { 
    itemsMap, loading: ordersLoading, error: ordersError 
  } = usePedidosMaster(filterEstabelecimento, estabMap, currentUser, isMasterAdmin);

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

      let matchDate = true;
      if (dateInicio || dateFim) {
        const orderDate = getOrderDate(item);
        if (!orderDate) {
          matchDate = false;
        } else {
          if (dateInicio && orderDate < dateInicio) matchDate = false;
          if (dateFim && orderDate > dateFim) matchDate = false;
        }
      }

      return matchText && matchEstab && matchStatus && matchDate;
    });
  }, [listaFinal, debouncedSearch, filterEstabelecimento, filterStatus, dateInicio, dateFim]);

  const displayedPaginated = useMemo(() => {
    return displayed.slice(0, visibleCount);
  }, [displayed, visibleCount]);

  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setFilterStatus('todos');
    setFilterEstabelecimento('todos');
    setDateInicio(null);
    setDateFim(null);
    setDatePreset(null);
    setDateRange({ start: null, end: null });
    setVisibleCount(INITIAL_VISIBLE_ITEMS);
  }, []);

  const handleLoadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + LOAD_MORE_ITEMS, displayed.length));
  }, [displayed.length]);

  return {
    searchTerm, setSearchTerm,
    filterEstabelecimento, setFilterEstabelecimento,
    filterStatus, setFilterStatus,
    dateInicio, setDateInicio,
    dateFim, setDateFim,
    datePreset, setDatePreset,
    dateRange, setDateRange,
    visibleCount, setVisibleCount,

    estabelecimentos,
    ordersLoading,
    estabError, ordersError,
    
    listaFinal,
    displayed,
    displayedPaginated,

    handleClearFilters,
    handleLoadMore
  };
}
