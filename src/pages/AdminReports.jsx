import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { format, subDays } from 'date-fns';

// Componentes
import ReportFilters from '../components/admin/reports/ReportFilters';
import ReportCharts from '../components/admin/reports/ReportCharts';
import DetailedTable from '../components/admin/reports/DetailedTable';
import { useReportsData } from '../hooks/useReportsData';
import { useReportExport } from '../hooks/useReportExport';
import { fmtBRL } from '../utils/reportUtils';

// Ícones
import { 
    IoDownloadOutline, IoPrintOutline, IoStatsChartOutline, IoCashOutline, 
    IoReceiptOutline, IoPeopleOutline, IoMapOutline, IoAlertCircleOutline,
    IoFastFoodOutline, IoSearchOutline
} from 'react-icons/io5';
import { FaMotorcycle } from "react-icons/fa";

const Card = ({ title, children, className = "", ...rest }) => (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${className}`} {...rest}>
        {title && <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">{title}</h3>}
        {children}
    </div>
);

const StatCard = ({ title, value, subtitle, icon, color = "blue" }) => {
    const colorClasses = {
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100',
        red: 'bg-red-50 text-red-600 border-red-100',
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100'
    };
    const bgCircle = {
        blue: 'bg-blue-100', green: 'bg-emerald-100', amber: 'bg-amber-100',
        purple: 'bg-purple-100', red: 'bg-red-100', indigo: 'bg-indigo-100'
    };

    return (
        <div className={`bg-white rounded-2xl border shadow-sm p-5 hover:shadow-md transition-all relative overflow-hidden group ${colorClasses[color]?.split(' ')[2] ? `border-${color}-100` : 'border-gray-100'}`}>
            <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 ${bgCircle[color]} group-hover:scale-110 transition-transform`}></div>
            <div className="flex items-center justify-between relative z-10">
                <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{title}</p>
                    <p className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">{value}</p>
                    {subtitle && <p className="text-[10px] text-gray-500 font-medium mt-1">{subtitle}</p>}
                </div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${colorClasses[color]}`}>
                    {icon}
                </div>
            </div>
        </div>
    );
};

const AdminReports = () => {
    const { estabelecimentoIdPrincipal } = useAuth();
    const reportContentRef = useRef();

    // Filtros de UI
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [statusFilter, setStatusFilter] = useState('valido'); 
    const [paymentMethodFilter, setPaymentMethodFilter] = useState('todos');
    const [deliveryTypeFilter, setDeliveryTypeFilter] = useState('todos');
    const [motoboyFilter, setMotoboyFilter] = useState('todos');
    const [searchTerm, setSearchTerm] = useState('');
    const [minValue, setMinValue] = useState('');
    const [maxValue, setMaxValue] = useState('');
    const [viewMode, setViewMode] = useState('charts'); 
    const [itemSearchTerm, setItemSearchTerm] = useState('');

    const {
        loadingData,
        filteredPedidos,
        metrics,
        availableMotoboys,
        fetchData
    } = useReportsData(
        estabelecimentoIdPrincipal,
        startDate, endDate,
        statusFilter, paymentMethodFilter, deliveryTypeFilter, motoboyFilter, searchTerm, minValue, maxValue
    );

    // Lógica de exportação extraída
    const { handleExportCSV, handleExportPDF } = useReportExport(startDate, endDate);

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-3 sm:p-6 font-sans">
            <div className="max-w-7xl mx-auto mb-4">
                <div className="flex justify-end gap-2 no-print">
                    <button onClick={() => handleExportCSV(filteredPedidos)} disabled={!filteredPedidos.length} className="bg-emerald-600 text-white px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm">
                        <IoDownloadOutline size={16}/> CSV
                    </button>
                    <button onClick={() => handleExportPDF(reportContentRef)} disabled={!filteredPedidos.length} className="bg-blue-600 text-white px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm">
                        <IoPrintOutline size={16}/> PDF
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto" ref={reportContentRef}>
                <ReportFilters 
                    startDate={startDate} setStartDate={setStartDate}
                    endDate={endDate} setEndDate={setEndDate}
                    deliveryTypeFilter={deliveryTypeFilter} setDeliveryTypeFilter={setDeliveryTypeFilter}
                    motoboyFilter={motoboyFilter} setMotoboyFilter={setMotoboyFilter}
                    statusFilter={statusFilter} setStatusFilter={setStatusFilter}
                    availableMotoboys={availableMotoboys}
                    loadingData={loadingData} fetchData={fetchData}
                    searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                    viewMode={viewMode} setViewMode={setViewMode}
                />

                {viewMode === 'charts' && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6" data-pdf-section="stats">
                            <StatCard title="Faturamento Líquido" value={metrics.totalVendas.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} icon={<IoCashOutline/>} color="green" />
                            <StatCard title="Taxas de Entrega" value={metrics.totalTaxas.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} icon={<FaMotorcycle/>} color="indigo" />
                            <StatCard title="Ticket Médio" value={metrics.ticketMedio.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} icon={<IoStatsChartOutline/>} color="purple" />
                            <StatCard title="Pedidos Válidos" value={metrics.count} subtitle={`${metrics.mesaMetrics.count} mesas`} icon={<IoReceiptOutline/>} color="blue" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6" data-pdf-section="health">
                            <Card title={<><IoAlertCircleOutline className="text-red-600"/> Saúde da Operação</>}>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-gray-500 text-sm">Cancelamentos Totais</p>
                                        <p className="text-2xl font-bold text-red-600">{metrics.cancelamentos.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                        <p className="text-xs text-gray-400 mt-1">{metrics.cancelamentos.textoQtd}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-bold text-red-600">{metrics.cancelamentos.taxa}%</div>
                                        <p className="text-xs text-gray-400">Taxa de Rejeição Geral</p>
                                    </div>
                                </div>
                                <div className="mt-4 bg-gray-200 rounded-full h-2"><div className="bg-red-600 h-2 rounded-full" style={{width: `${Math.min(metrics.cancelamentos.taxa, 100)}%`}}></div></div>
                            </Card>

                            <Card title={<><IoMapOutline className="text-orange-600"/> Top Bairros</>}>
                                <div className="space-y-2">
                                    {metrics.topBairros.length > 0 ? metrics.topBairros.map(([b, q], i) => (
                                        <div key={b} className="flex justify-between border-b pb-1 last:border-0">
                                            <div className="flex gap-2 text-sm"><span className="font-bold text-gray-600">#{i+1}</span> <span className="capitalize">{b}</span></div>
                                            <span className="font-bold text-blue-600 text-sm">{q}</span>
                                        </div>
                                    )) : <p className="text-gray-400 text-center text-sm">Sem dados de endereço</p>}
                                </div>
                            </Card>

                            <Card title={<><IoPeopleOutline className="text-purple-600"/> Top Clientes</>}>
                                <div className="space-y-3">
                                    {metrics.topClients.length > 0 ? (
                                        metrics.topClients.map((client, index) => (
                                            <div key={index} className="flex justify-between items-center border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                                                <div className="flex items-center gap-3">
                                                    <div className={`
                                                        w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold
                                                        ${index === 0 ? 'bg-yellow-100 text-yellow-700' : 
                                                          index === 1 ? 'bg-gray-200 text-gray-700' :
                                                          index === 2 ? 'bg-orange-100 text-orange-800' : 'bg-purple-50 text-purple-600'}
                                                    `}>
                                                        {index + 1}º
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-800 truncate w-[100px] sm:w-[120px]" title={client.nome}>
                                                            {client.nome}
                                                        </p>
                                                        <p className="text-[10px] text-gray-500">
                                                            {client.count} ped. {client.bairro ? `• ${client.bairro.substring(0,10)}...` : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-green-600">
                                                        {client.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-400 text-center text-sm py-4">Sem dados de clientes.</p>
                                    )}
                                </div>
                            </Card>
                        </div>

                        {metrics.topMotoboys.length > 0 && (
                            <div className="mb-6" data-pdf-section="frota">
                                <Card title={<><FaMotorcycle className="text-indigo-600"/> Performance da Frota</>}>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {metrics.topMotoboys.map((moto, index) => (
                                            <div key={moto.id} className="bg-gray-50 border rounded-lg p-3 flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">{index+1}</div>
                                                    <div><p className="font-bold text-gray-800 text-sm">{moto.nome}</p><p className="text-xs text-gray-500">{moto.count} entregas</p></div>
                                                </div>
                                                <p className="font-bold text-green-600 text-sm">{moto.totalTaxas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </div>
                        )}

                        <ReportCharts metrics={metrics} />
                    </>
                )}

                {viewMode === 'table' && <Card title={`Detalhamento (${filteredPedidos.length})`}><DetailedTable filteredPedidos={filteredPedidos} /></Card>}

                {metrics.allItems.length > 0 && (() => {
                    const filteredItems = metrics.allItems.filter(it => 
                        itemSearchTerm === '' || it.nome.toLowerCase().includes(itemSearchTerm.toLowerCase())
                    );
                    const totalReceita = metrics.allItems.reduce((sum, it) => sum + it.receita, 0);
                    return (
                        <div className="mt-6" data-pdf-section="itens-vendidos">
                            <Card title={<><IoFastFoodOutline className="text-orange-600"/> Itens Vendidos ({metrics.totalItensVendidos} un.)</>}>
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5">
                                            <span className="text-orange-600 font-bold">{metrics.allItems.length}</span>
                                            <span className="text-gray-500 ml-1">produtos diferentes</span>
                                        </div>
                                        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                                            <span className="text-green-600 font-bold">{fmtBRL(totalReceita)}</span>
                                            <span className="text-gray-500 ml-1">em itens</span>
                                        </div>
                                    </div>
                                    <div className="relative w-full sm:w-64">
                                        <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input 
                                            type="text" 
                                            placeholder="Buscar produto..." 
                                            value={itemSearchTerm} 
                                            onChange={e => setItemSearchTerm(e.target.value)} 
                                            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs font-medium bg-white shadow-sm outline-none focus:ring-2 focus:ring-orange-500/50"
                                        />
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-wider">#</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-wider">Produto</th>
                                                <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-wider">Qtd</th>
                                                <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-wider">Preço Unit.</th>
                                                <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-wider">Receita</th>
                                                <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-wider">% Vendas</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-100">
                                            {filteredItems.map((item, idx) => {
                                                const rankColors = ['bg-yellow-100 text-yellow-700', 'bg-gray-200 text-gray-700', 'bg-orange-100 text-orange-700'];
                                                const globalIdx = metrics.allItems.indexOf(item);
                                                return (
                                                    <tr key={item.nome} className="hover:bg-orange-50/50 transition-colors">
                                                        <td className="px-4 py-2.5 whitespace-nowrap">
                                                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${rankColors[globalIdx] || 'bg-gray-50 text-gray-500'}`}>
                                                                {globalIdx + 1}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-sm font-semibold text-gray-800 max-w-[200px] truncate" title={item.nome}>{item.nome}</td>
                                                        <td className="px-4 py-2.5 text-center">
                                                            <span className="bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full text-xs font-bold">{item.qtd}</span>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right text-sm text-gray-600">{fmtBRL(item.precoUnit)}</td>
                                                        <td className="px-4 py-2.5 text-right text-sm font-bold text-green-600">{fmtBRL(item.receita)}</td>
                                                        <td className="px-4 py-2.5 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                                                    <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${Math.min(parseFloat(item.pctQtd), 100)}%` }}></div>
                                                                </div>
                                                                <span className="text-[10px] font-mono font-bold text-gray-500">{item.pctQtd}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {filteredItems.length === 0 && <p className="text-center text-gray-400 text-sm py-6">Nenhum produto encontrado para "{itemSearchTerm}"</p>}
                            </Card>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};

export default withEstablishmentAuth(AdminReports);
