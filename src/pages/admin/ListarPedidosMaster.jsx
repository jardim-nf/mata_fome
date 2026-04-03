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
import { IoSearchOutline } from 'react-icons/io5';
import { formatCurrency } from '../../utils/formatCurrency';

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
  recebido: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', icon: FaClock, label: 'Novo / Recebido' },
  preparo: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', icon: FaStore, label: 'Em Preparo', pulse: true },
  em_entrega: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', icon: FaMotorcycle, label: 'Em Entrega', pulse: true },
  finalizado: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', icon: FaCheckCircle, label: 'Finalizado' },
  cancelado: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', icon: FaTimesCircle, label: 'Cancelado' },
  default: { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200', icon: FaBoxOpen, label: 'Desconhecido' }
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
  const orderDate = getOrderDate(item);
  const formattedDate = formatDate(orderDate);
  const formattedId = formatId(item.id);
  const formattedValue = formatCurrency(item.valorFinal);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-100 hover:-translate-y-0.5 transition-all duration-300 group flex flex-col relative overflow-hidden">
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
  const handleViewDetails = useCallback((orderId) => {
    navigate(`/master/pedidos/${orderId}`);
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

  // View States
  const masterUserName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Admin';

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center bg-slate-50"><div className="w-12 h-12 border-4 border-slate-200 border-t-yellow-400 rounded-full animate-spin"></div></div>;
  }

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
          <DateRangeFilter
            activePreset={datePreset}
            dateRange={dateRange}
            onPresetChange={handleDatePresetChange}
            onRangeChange={handleDateRangeChange}
            onClear={handleDateClear}
          />
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