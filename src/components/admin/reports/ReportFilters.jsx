import React from 'react';
import { IoFilterOutline, IoRefreshOutline, IoAnalyticsOutline, IoListOutline } from 'react-icons/io5';
import { format, subDays } from 'date-fns';

export const ReportFilters = ({
    startDate, setStartDate,
    endDate, setEndDate,
    deliveryTypeFilter, setDeliveryTypeFilter,
    motoboyFilter, setMotoboyFilter,
    statusFilter, setStatusFilter,
    availableMotoboys,
    loadingData,
    fetchData,
    searchTerm, setSearchTerm,
    viewMode, setViewMode
}) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6" data-pdf-section="filtros">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <IoFilterOutline className="text-blue-600"/> 
                Filtros
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-black text-gray-400 mr-2 uppercase">De</span>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-xs font-bold text-gray-700 outline-none w-full" />
                </div>
                <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-black text-gray-400 mr-2 uppercase">Até</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-xs font-bold text-gray-700 outline-none w-full" />
                </div>
                <select value={deliveryTypeFilter} onChange={e => setDeliveryTypeFilter(e.target.value)} className="p-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 bg-white shadow-sm col-span-2 sm:col-span-1">
                    <option value="todos">Todos Tipos</option>
                    <option value="delivery">Delivery</option>
                    <option value="mesa">Mesas</option>
                </select>
                <select value={motoboyFilter} onChange={e => setMotoboyFilter(e.target.value)} className="p-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 bg-white shadow-sm col-span-2 sm:col-span-1">
                    <option value="todos">Todos Motoboys</option>
                    {availableMotoboys.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="p-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 bg-white shadow-sm col-span-2 sm:col-span-1">
                    <option value="valido">Apenas Válidos</option>
                    <option value="cancelado">Apenas Cancelados</option>
                    <option value="todos">Mostrar Tudo</option>
                </select>
                <button onClick={fetchData} disabled={loadingData} className="bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex justify-center items-center gap-2 text-xs font-bold transition-all shadow-sm no-print col-span-2 sm:col-span-1 p-2">
                    {loadingData ? '...' : <><IoRefreshOutline/> Filtrar</>}
                </button>
            </div>

            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                <button onClick={() => { const h = format(new Date(), 'yyyy-MM-dd'); setStartDate(h); setEndDate(h); }} className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-[11px] font-bold text-gray-600 hover:bg-gray-200 transition-all">Hoje</button>
                <button onClick={() => { setStartDate(format(subDays(new Date(), 7), 'yyyy-MM-dd')); setEndDate(format(new Date(), 'yyyy-MM-dd')); }} className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-[11px] font-bold text-gray-600 hover:bg-gray-200 transition-all">7 dias</button>
                <button onClick={() => { setStartDate(format(subDays(new Date(), 30), 'yyyy-MM-dd')); setEndDate(format(new Date(), 'yyyy-MM-dd')); }} className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-[11px] font-bold text-gray-600 hover:bg-gray-200 transition-all">30 dias</button>
                <div className="flex-1 min-w-[150px]">
                    <input type="text" placeholder="🔍 Buscar cliente, bairro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-2 border border-gray-200 rounded-xl text-xs font-medium bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-500/50"/>
                </div>
                <div className="flex bg-gray-100 p-0.5 rounded-lg shadow-inner border border-gray-200">
                    <button onClick={() => setViewMode('charts')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'charts' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}><IoAnalyticsOutline/> Gráficos</button>
                    <button onClick={() => setViewMode('table')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}><IoListOutline/> Lista</button>
                </div>
            </div>
        </div>
    );
};

export default ReportFilters;
