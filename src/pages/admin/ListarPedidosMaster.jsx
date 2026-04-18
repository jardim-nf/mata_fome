import React, { useEffect, useState, useCallback, useRef } from 'react';
import DateRangeFilter, { getPresetRange } from '../../components/DateRangeFilter';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  FaStore, FaUser, FaBoxOpen, FaMotorcycle, FaCheckCircle, 
  FaTimesCircle, FaClock, FaSignOutAlt, FaExclamationTriangle,
  FaChevronUp, FaArrowLeft, FaReceipt, FaSync,
  FaBolt, FaCrown
} from 'react-icons/fa';
import { IoSearchOutline, IoLogOutOutline } from 'react-icons/io5';
import { formatCurrency } from '../../utils/formatCurrency';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Importa todas as constantes e inteligência do Hook Refatorado
import { 
  useListarPedidosMasterData, 
  STATUS_OPTIONS, 
  LOAD_MORE_ITEMS,
  formatId,
  formatDate,
  getOrderDate
} from '../../hooks/useListarPedidosMasterData';

// --- CONFIGURAÇÃO DE STATUS VISUAL ---
export const STATUS_CONFIG = {
  recebido: { bg: 'bg-[#F5F5F7]', text: 'text-[#86868B]', border: 'border-[#E5E5EA]', icon: FaClock, label: 'Novo / Recebido' },
  preparo: { bg: 'bg-[#F2FCDA]', text: 'text-[#1D7446]', border: 'border-[#D0F2A8]', icon: FaStore, label: 'Em Preparo', pulse: true },
  em_entrega: { bg: 'bg-[#E5F1FF]', text: 'text-[#007AFF]', border: 'border-[#CCE3FF]', icon: FaMotorcycle, label: 'Em Entrega', pulse: true },
  finalizado: { bg: 'bg-[#E5E5EA]', text: 'text-[#1D1D1F]', border: 'border-[#D1D1D6]', icon: FaCheckCircle, label: 'Finalizado' },
  cancelado: { bg: 'bg-[#FFE6E6]', text: 'text-[#D0021B]', border: 'border-[#FFB3B3]', icon: FaTimesCircle, label: 'Cancelado' },
  default: { bg: 'bg-[#F5F5F7]', text: 'text-[#86868B]', border: 'border-[#E5E5EA]', icon: FaBoxOpen, label: 'Desconhecido' }
};

// --- COMPONENTES VISUAIS PREMIUM ---

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
    <span className={`inline-flex items-center gap-1.5 ${config.bg} ${config.text} px-3 py-1.5 rounded-full text-[11px] font-bold border ${config.border} ${config.pulse ? 'animate-pulse' : ''}`}>
      <Icon /> {statusLabel || config.label}
    </span>
  );
};

const OrderCard = ({ item, onViewDetails }) => {
  const orderDate = getOrderDate(item);
  const formattedDate = formatDate(orderDate);
  const formattedId = formatId(item.id);
  const formattedValue = formatCurrency(item.valorFinal);

  return (
    <div className="bg-white rounded-[2rem] border border-[#E5E5EA] shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden">
      <div className={`h-1.5 w-full ${item.tipoExibicao === 'SALÃO' ? 'bg-[#007AFF]' : 'bg-[#1D1D1F]'}`} />

      <div className="p-8 flex flex-col h-full">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-black text-2xl text-[#1D1D1F] tracking-tight">{formattedId}</span>
                <span className={`text-[10px] px-2.5 py-1 rounded-md font-black uppercase tracking-widest ${
                    item.tipoExibicao === 'SALÃO' 
                      ? 'bg-[#E5F1FF] text-[#007AFF] border border-[#CCE3FF]' 
                      : 'bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5EA]'
                  }`}
                >
                  {item.tipoExibicao}
                </span>
              </div>
              <span className="text-[11px] text-[#86868B] font-medium mt-1 flex items-center gap-1.5">
                <FaClock /> {formattedDate}
              </span>
            </div>
            <StatusBadge statusRaw={item.statusRaw} statusLabel={item.status} />
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-[#F5F5F7] p-4 rounded-3xl border border-[#E5E5EA] flex flex-col justify-center">
              <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                <FaStore /> Operação
              </span>
              <span className="block font-bold text-[#1D1D1F] text-sm truncate" title={item.estabelecimentoNomeFinal}>
                {item.estabelecimentoNomeFinal}
              </span>
            </div>
            <div className="bg-[#F5F5F7] p-4 rounded-3xl border border-[#E5E5EA] flex flex-col justify-center">
              <span className="text-[10px] font-bold text-[#86868B] uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
                <FaUser /> Consumidor
              </span>
              <span className="block font-bold text-[#1D1D1F] text-sm truncate" title={item.clienteNomeFinal}>
                {item.clienteNomeFinal}
              </span>
            </div>
          </div>

          <div className="mt-auto flex justify-between items-center pt-6 border-t border-[#F5F5F7]">
            <div>
              <span className="text-[10px] text-[#86868B] font-bold uppercase tracking-widest block mb-1">Fechamento</span>
              <span className="font-black text-2xl text-[#1D1D1F] tracking-tighter">
                {formattedValue}
              </span>
            </div>
            <button 
              onClick={() => onViewDetails(item.id, item._path)} 
              className="flex items-center gap-2 px-6 py-3 bg-[#1D1D1F] text-white rounded-full text-sm font-bold hover:bg-black transition-colors active:scale-95"
            >
              <FaReceipt /> Resumo
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
    <div className="bg-white rounded-full shadow-sm border border-[#E5E5EA] p-3 mb-8 flex flex-col xl:flex-row gap-3 relative z-10 w-full">
      <div className="flex-1 relative">
        <IoSearchOutline className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868B] text-lg" />
        <input 
          type="text" 
          placeholder="Buscar Ticket (Código, Cliente ou Franquia)..." 
          className="w-full pl-12 pr-4 py-3 bg-transparent border-none rounded-full outline-none text-[#1D1D1F] placeholder-[#86868B] font-medium text-sm"
          value={searchTerm} 
          onChange={e => onSearchChange(e.target.value)}
        />
      </div>
      <div className="w-px bg-[#E5E5EA] hidden xl:block mx-2"></div>
      <div className="flex flex-col sm:flex-row gap-3 xl:w-auto w-full px-2">
        <select 
          className="bg-[#F5F5F7] border border-[#E5E5EA] rounded-full px-4 py-2.5 text-xs font-bold text-[#1D1D1F] outline-none hover:border-[#86868B] appearance-none cursor-pointer flex-1 xl:min-w-[200px]" 
          value={filterEstabelecimento} 
          onChange={e => onEstabelecimentoChange(e.target.value)}
        >
          <option value="todos">Varrer Todas as Lojas</option>
          {estabelecimentosList.map(e => (
            <option key={e.id} value={e.id}>{e.nome}</option>
          ))}
        </select>
        <select 
          className="bg-[#F5F5F7] border border-[#E5E5EA] rounded-full px-4 py-2.5 text-xs font-bold text-[#1D1D1F] outline-none hover:border-[#86868B] appearance-none cursor-pointer flex-1 xl:min-w-[180px]" 
          value={filterStatus} 
          onChange={e => onStatusChange(e.target.value)}
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="flex items-center justify-center px-4 py-2.5 bg-[#F5F5F7] rounded-full text-xs font-bold text-[#86868B] border border-[#E5E5EA] whitespace-nowrap">
          {displayedItems} de {totalItems}
        </div>
      </div>
    </div>
  );
};

const LoadingSpinner = () => (
  <div className="text-center py-24 flex flex-col items-center justify-center">
    <div className="w-12 h-12 border-4 border-[#E5E5EA] border-t-[#1D1D1F] rounded-full animate-spin mb-4 shadow-sm"></div>
    <p className="text-[#86868B] font-bold text-sm">Monitorizando rede...</p>
  </div>
);

const EmptyState = ({ onClearFilters }) => (
  <div className="col-span-1 xl:col-span-2 text-center py-24 bg-white rounded-[2rem] border border-[#E5E5EA] flex flex-col items-center justify-center shadow-sm">
    <div className="w-20 h-20 bg-[#F5F5F7] rounded-full flex items-center justify-center mb-5">
        <FaBoxOpen className="text-4xl text-[#86868B]" />
    </div>
    <h3 className="text-xl font-black text-[#1D1D1F] tracking-tight">Oceano Azul</h3>
    <p className="text-[#86868B] text-sm mt-2 font-medium">Não há faturamento processado para este filtro.</p>
    <button 
      onClick={onClearFilters} 
      className="mt-6 px-6 py-2.5 bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5EA] font-bold rounded-full hover:bg-[#E5E5EA] transition-colors"
    >
      Limpar todos os filtros
    </button>
  </div>
);

// --- COMPONENTE PRINCIPAL ---
function ListarPedidosMaster() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const containerRef = useRef(null);

  // Instanciando The One Hook!
  const {
    searchTerm, setSearchTerm,
    filterEstabelecimento, setFilterEstabelecimento,
    filterStatus, setFilterStatus,
    dateRange, setDateRange,
    datePreset, setDatePreset,
    setDateInicio, setDateFim,
    estabelecimentos,
    ordersLoading,
    estabError, ordersError,
    listaFinal,
    displayed,
    displayedPaginated,
    handleClearFilters,
    handleLoadMore
  } = useListarPedidosMasterData({ currentUser, isMasterAdmin });

  // Handlers
  const handleViewDetails = useCallback((orderId, docPath) => {
    navigate(`/master/pedidos/${orderId}?p=${encodeURIComponent(docPath || '')}`);
  }, [navigate]);

  // DateRangeFilter handlers formatados para a lib Component DateRange
  const handleDatePresetChange = useCallback((preset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      const range = getPresetRange(preset);
      if (range) {
        setDateRange(range);
        setDateInicio(range.start);
        setDateFim(range.end);
      }
    }
  }, [setDatePreset, setDateRange, setDateInicio, setDateFim]);

  const handleDateRangeChange = useCallback((range) => {
    setDateRange(range);
    setDateInicio(range.start);
    setDateFim(range.end);
  }, [setDateRange, setDateInicio, setDateFim]);

  const handleDateClear = useCallback(() => {
    setDatePreset(null);
    setDateRange({ start: null, end: null });
    setDateInicio(null);
    setDateFim(null);
  }, [setDatePreset, setDateRange, setDateInicio, setDateFim]);

  // Scroll to top button Event
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

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center bg-[#F5F5F7]"><FaBolt className="text-[#86868B] text-4xl animate-pulse" /></div>;
  }

  if (!currentUser || !isMasterAdmin) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4">
        <div className="bg-white rounded-[2rem] shadow-sm p-10 max-w-md text-center border border-[#E5E5EA]">
          <FaExclamationTriangle className="mx-auto text-4xl text-[#D0021B] mb-5" />
          <h2 className="text-xl font-bold text-[#1D1D1F] mb-2">Acesso Negado</h2>
          <p className="text-[#86868B] mb-8 font-medium text-sm">Privilégios administrativos insuficientes.</p>
          <button onClick={() => navigate('/')} className="w-full py-3.5 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-colors active:scale-95">
            Módulo Inicial
          </button>
        </div>
      </div>
    );
  }

  const error = estabError || ordersError;

  return (
    <div 
      ref={containerRef}
      className="bg-[#F5F5F7] min-h-screen font-sans text-[#1D1D1F] overflow-auto pb-24 pt-4 px-4 sm:px-8"
    >
      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className="max-w-[1400px] mx-auto bg-white/70 backdrop-blur-xl border border-white/50 shadow-sm rounded-full h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/master-dashboard')} className="w-9 h-9 bg-[#F5F5F7] hover:bg-[#E5E5EA] rounded-full flex items-center justify-center transition-colors">
            <FaArrowLeft className="text-[#86868B] text-sm" />
          </button>
          <div className="hidden sm:block border-l border-[#E5E5EA] pl-4">
            <h1 className="font-semibold text-sm tracking-tight text-black">Monitoramento Logístico</h1>
            <p className="text-[11px] text-[#86868B] font-medium">{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2">
            {ordersLoading && <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-widest animate-pulse border border-emerald-100"><FaSync className="animate-spin" /> Escaneando</span>}
          </div>
          <div className="w-px h-6 bg-[#E5E5EA] hidden sm:block" />
          <button onClick={async () => { await logout(); navigate('/'); }} className="w-9 h-9 bg-red-50 hover:bg-red-100 rounded-full flex items-center justify-center transition-colors">
            <IoLogOutOutline className="text-red-500" size={16} />
          </button>
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto mt-8">
        
        {/* HEADER DA PÁGINA */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-8 gap-6 px-2">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-[#1D1D1F]">Tickets Abertos (Geral)</h1>
            <p className="text-[#86868B] text-sm mt-1 font-medium">Comutação global de recebimento — Delivery e Salão.</p>
          </div>
          <div className="bg-white border border-[#E5E5EA] rounded-full px-4 py-2 shadow-sm flex items-center">
            <DateRangeFilter
              datePreset={datePreset}
              dateRange={dateRange}
              onPresetChange={handleDatePresetChange}
              onRangeChange={handleDateRangeChange}
              onClear={handleDateClear}
            />
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
          <div className="mb-6 bg-[#FFE6E6] border border-[#FFB3B3] text-[#D0021B] p-4 rounded-3xl text-sm font-bold flex items-center gap-2">
            <FaExclamationTriangle /> {error}
            <button onClick={() => window.location.reload()} className="ml-auto underline decoration-[#FFB3B3] hover:text-black">Forçar Recarregamento</button>
          </div>
        )}

        {/* LISTA DE PEDIDOS */}
        {ordersLoading && displayed.length === 0 ? (
          <LoadingSpinner />
        ) : (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8 pb-12">
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
                  className="px-8 py-4 bg-white border border-[#E5E5EA] rounded-full font-bold text-[#1D1D1F] hover:bg-[#F5F5F7] transition-all shadow-sm active:scale-95"
                >
                  Continuar listagem ({Math.min(LOAD_MORE_ITEMS, displayed.length - displayedPaginated.length)} tickets)
                </button>
              </div>
            )}
          </>
        )}

        {/* SCROLL TO TOP BUTTON */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 bg-black text-white p-4 rounded-full shadow-lg hover:bg-gray-800 transition-all focus:outline-none z-50 flex items-center justify-center w-14 h-14"
            aria-label="Voltar ao topo"
          >
            <FaChevronUp />
          </button>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
      `}</style>
    </div>
  );
}

export default ListarPedidosMaster;