// src/pages/AdminReports.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Bibliotecas para PDF e Gráficos
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement } from 'chart.js';
import { Line, Pie, Bar } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

// Ícones
import { 
    IoArrowBack, IoDocumentTextOutline, IoSearch, IoCalendarOutline, IoFilterOutline,
    IoDownloadOutline, IoRefreshOutline, IoStatsChartOutline, IoPieChartOutline,
    IoTrendingUpOutline, IoRestaurantOutline, IoCashOutline, IoReceiptOutline,
    IoPrintOutline, IoPeopleOutline, IoTimeOutline,
    IoAnalyticsOutline, IoListOutline, IoMapOutline, IoAlertCircleOutline
} from 'react-icons/io5';
import { FaMotorcycle } from "react-icons/fa";

// Registro dos componentes do Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement, ChartDataLabels);

// --- COMPONENTES UI ---
const Card = ({ title, children, className = "" }) => (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${className}`}>
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

    // Estados
    const [loadingData, setLoadingData] = useState(false);
    const [pedidos, setPedidos] = useState([]);
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    
    // Filtros
    const [statusFilter, setStatusFilter] = useState('todos');
    const [paymentMethodFilter, setPaymentMethodFilter] = useState('todos');
    const [deliveryTypeFilter, setDeliveryTypeFilter] = useState('todos');
    const [motoboyFilter, setMotoboyFilter] = useState('todos');
    
    const [availableMotoboys, setAvailableMotoboys] = useState([]);

    // Filtros Avançados
    const [searchTerm, setSearchTerm] = useState('');
    const [minValue, setMinValue] = useState('');
    const [maxValue, setMaxValue] = useState('');
    const [viewMode, setViewMode] = useState('charts'); 

    // --- TRADUTOR DE PAGAMENTO ---
    const traduzirPagamento = (metodo) => {
        if (!metodo || metodo === 'N/A') return 'Não Informado';
        
        const mapa = {
            'credit_card': 'Cartão de Crédito',
            'debit_card': 'Cartão de Débito',
            'money': 'Dinheiro',
            'cash': 'Dinheiro',
            'pix': 'PIX',
            'wallet': 'Carteira Digital',
            'card': 'Cartão',
            'online': 'Online'
        };
        
        return mapa[metodo.toLowerCase()] || mapa[metodo] || metodo;
    };

    // Normalização de Dados
    const processarDado = (doc, origem) => {
        const data = doc.data();
        
        let dataRegistro = null;
        if (origem === 'mesa') {
            dataRegistro = data.criadoEm?.toDate?.() || data.dataFechamento?.toDate?.() || data.createdAt?.toDate?.() || data.updatedAt?.toDate?.() || new Date();
        } else {
            dataRegistro = data.createdAt?.toDate?.() || new Date();
        }

        // Parse seguro do total
        const parseVal = (v) => {
            if (typeof v === 'number') return v;
            if (typeof v === 'string') return parseFloat(v.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
            return 0;
        };
        
        let total = parseVal(data.totalFinal) || parseVal(data.total) || parseVal(data.valorTotal) || 0;
        
        const itens = data.itens || data.produtos || [];
        const bairro = data.endereco?.bairro || data.bairro || data.address?.district || null;

        return {
            id: doc.id,
            ...data,
            data: dataRegistro,
            totalFinal: total || 0,
            tipo: origem === 'mesa' ? 'mesa' : (data.tipo || 'delivery'),
            origem: origem,
            status: data.status || (origem === 'mesa' ? 'finalizada' : 'recebido'),
            formaPagamento: data.formaPagamento || 'N/A',
            mesaNumero: data.mesaNumero || data.numeroMesa || null,
            loteHorario: data.loteHorario || '',
            itens: itens,
            clienteNome: data.clienteNome || data.cliente?.nome || (origem === 'mesa' ? 'Mesa' : 'Cliente'),
            motoboyId: data.motoboyId || null,
            motoboyNome: data.motoboyNome || null,
            taxaEntrega: Number(data.taxaEntrega) || Number(data.deliveryFee) || 0,
            bairro: bairro
        };
    };

    const fetchData = async () => {
        if (!estabelecimentoIdPrincipal) return;
        
        try {
            setLoadingData(true);
            const start = startOfDay(new Date(startDate + 'T00:00:00'));
            const end = endOfDay(new Date(endDate + 'T23:59:59'));
            let allData = [];

            // 1. DELIVERY (busca nas DUAS coleções possíveis)
            if (deliveryTypeFilter !== 'mesa') {
                try {
                    const qPedidosSub = query(
                        collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'pedidos'),
                        where('createdAt', '>=', start),
                        where('createdAt', '<=', end),
                        orderBy('createdAt', 'desc')
                    );
                    const snapSub = await getDocs(qPedidosSub);
                    allData = [...allData, ...snapSub.docs.map(d => processarDado(d, 'delivery'))];
                } catch (e1) { console.warn("Delivery sub:", e1.message); }

                try {
                    const qPedidosGlobal = query(
                        collection(db, 'pedidos'),
                        where('estabelecimentoId', '==', estabelecimentoIdPrincipal),
                        where('createdAt', '>=', start),
                        where('createdAt', '<=', end),
                        orderBy('createdAt', 'desc')
                    );
                    const snapGlobal = await getDocs(qPedidosGlobal);
                    const idsExistentes = new Set(allData.map(d => d.id));
                    const novos = snapGlobal.docs
                        .filter(d => !idsExistentes.has(d.id))
                        .map(d => processarDado(d, 'delivery'));
                    allData = [...allData, ...novos];
                } catch (e2) { console.warn("Delivery global:", e2.message); }
            }

            // 2. MESAS / PDV (coleção 'estabelecimentos/{id}/vendas' e global 'vendas')
            if (deliveryTypeFilter === 'todos' || deliveryTypeFilter === 'mesa') {
                try {
                    const qVendasSub = query(
                        collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'vendas'),
                        where('criadoEm', '>=', start),
                        where('criadoEm', '<=', end),
                        orderBy('criadoEm', 'desc')
                    );
                    const snapVendasSub = await getDocs(qVendasSub);
                    allData = [...allData, ...snapVendasSub.docs.map(d => processarDado(d, 'mesa'))];
                } catch (e1) {
                    console.warn("Fallback: tentando coleção global vendas", e1);
                }
                try {
                    const qVendasGlobal = query(
                        collection(db, 'vendas'),
                        where('estabelecimentoId', '==', estabelecimentoIdPrincipal),
                        where('createdAt', '>=', start),
                        where('createdAt', '<=', end),
                        orderBy('createdAt', 'desc')
                    );
                    const snapVendasGlobal = await getDocs(qVendasGlobal);
                    const idsExistentes = new Set(allData.map(d => d.id));
                    const novasVendas = snapVendasGlobal.docs
                        .filter(d => !idsExistentes.has(d.id))
                        .map(d => processarDado(d, 'mesa'));
                    allData = [...allData, ...novasVendas];
                } catch (e2) { console.error("Erro vendas global:", e2); }
            }

            // Extrair Motoboys
            const uniqueMotoboys = [];
            const mapMotoboys = new Map();
            allData.forEach(item => {
                if (item.motoboyId && item.motoboyNome && !mapMotoboys.has(item.motoboyId)) {
                    mapMotoboys.set(item.motoboyId, true);
                    uniqueMotoboys.push({ id: item.motoboyId, nome: item.motoboyNome });
                }
            });
            setAvailableMotoboys(uniqueMotoboys);

            // Filtragem Inicial
            let filtered = allData;
            if (statusFilter !== 'todos') {
                filtered = filtered.filter(item => {
                    if (statusFilter === 'finalizado') return ['finalizado', 'finalizada', 'entregue'].includes(item.status);
                    return item.status === statusFilter;
                });
            }
            if (paymentMethodFilter !== 'todos') filtered = filtered.filter(item => item.formaPagamento === paymentMethodFilter);
            if (deliveryTypeFilter !== 'todos') filtered = filtered.filter(item => item.origem === (deliveryTypeFilter === 'delivery' ? 'delivery' : 'mesa'));
            if (motoboyFilter !== 'todos') filtered = filtered.filter(item => item.motoboyId === motoboyFilter);

            setPedidos(filtered);
            if (filtered.length === 0) toast.info("Nenhum dado encontrado.");
            else toast.success(`${filtered.length} registros carregados.`);

        } catch (err) {
            console.error(err);
            toast.error("Erro ao carregar dados.");
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        if (estabelecimentoIdPrincipal) fetchData();
    }, [estabelecimentoIdPrincipal]);

    // Filtragem Dinâmica
    const filteredPedidos = useMemo(() => {
        return pedidos.filter(p => {
            const term = searchTerm.toLowerCase();
            const matchesSearch = searchTerm === '' || 
                p.id?.toLowerCase().includes(term) ||
                p.mesaNumero?.toString().includes(term) ||
                p.clienteNome?.toLowerCase().includes(term) ||
                p.motoboyNome?.toLowerCase().includes(term);
            
            const matchesMin = minValue === '' || p.totalFinal >= parseFloat(minValue);
            const matchesMax = maxValue === '' || p.totalFinal <= parseFloat(maxValue);
            
            return matchesSearch && matchesMin && matchesMax;
        });
    }, [pedidos, searchTerm, minValue, maxValue]);

    // --- CÁLCULO DE MÉTRICAS ---
    const metrics = useMemo(() => {
        // 🔥 CORREÇÃO NA VALIDAÇÃO DE STATUS: Cobre cancelados de todas as origens 🔥
        const isCancelado = (p) => {
            const status = String(p.status || '').toLowerCase();
            const fiscalStatus = String(p.fiscal?.status || '').toLowerCase();
            return ['cancelado', 'cancelada', 'recusado', 'excluido'].includes(status) || fiscalStatus === 'cancelado';
        };

        const pedidosValidos = filteredPedidos.filter(p => !isCancelado(p));
        const totalVendas = pedidosValidos.reduce((acc, p) => acc + p.totalFinal, 0);
        const totalTaxas = pedidosValidos.reduce((acc, p) => acc + (p.taxaEntrega || 0), 0);
        
        const byDay = {}, byPayment = {}, byType = {}, byHour = {}, itemsCount = {}, motoboyStats = {}, bairrosStats = {};
        const clientsStats = {}; // Novo objeto para clientes

        const mesaVendas = filteredPedidos.filter(p => p.tipo === 'mesa');
        const cancelados = filteredPedidos.filter(p => isCancelado(p));

        filteredPedidos.forEach(p => {
            if (isCancelado(p)) return; // Ignora cancelados na soma

            const dayKey = format(p.data, 'dd/MM');
            byDay[dayKey] = (byDay[dayKey] || 0) + p.totalFinal;

            const hourKey = format(p.data, 'HH:00');
            byHour[hourKey] = (byHour[hourKey] || 0) + 1;

            const payKey = traduzirPagamento(p.formaPagamento);
            byPayment[payKey] = (byPayment[payKey] || 0) + p.totalFinal;

            const typeKey = p.tipo === 'mesa' ? 'Mesa' : 'Delivery';
            byType[typeKey] = (byType[typeKey] || 0) + 1;

            p.itens?.forEach(it => {
                const cleanName = it.nome?.replace(/\s*\(.*\)/g, '').trim() || 'Item';
                itemsCount[cleanName] = (itemsCount[cleanName] || 0) + (Number(it.quantidade) || 1);
            });

            if (p.motoboyId && p.motoboyNome) {
                if (!motoboyStats[p.motoboyId]) motoboyStats[p.motoboyId] = { id: p.motoboyId, nome: p.motoboyNome, count: 0, totalTaxas: 0 };
                motoboyStats[p.motoboyId].count++;
                motoboyStats[p.motoboyId].totalTaxas += (p.taxaEntrega || 0);
            }

            if (p.tipo !== 'mesa' && p.bairro) {
                bairrosStats[p.bairro] = (bairrosStats[p.bairro] || 0) + 1;
            }

            // Lógica Top Clientes (Delivery)
            if (p.tipo !== 'mesa') {
                const cNome = p.clienteNome && p.clienteNome !== 'Cliente' ? p.clienteNome : 'Não Identificado';
                if (!clientsStats[cNome]) {
                    clientsStats[cNome] = { nome: cNome, count: 0, total: 0, bairro: p.bairro };
                }
                clientsStats[cNome].count += 1;
                clientsStats[cNome].total += p.totalFinal;
            }
        });

        const sortedDays = Object.keys(byDay).sort((a,b) => new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-')));
        const topItems = Object.entries(itemsCount).sort(([,a], [,b]) => b - a).slice(0, 5);
        const topMotoboys = Object.values(motoboyStats).sort((a, b) => b.count - a.count);
        const topBairros = Object.entries(bairrosStats).sort(([,a], [,b]) => b - a).slice(0, 5);
        const topClients = Object.values(clientsStats).sort((a, b) => b.total - a.total).slice(0, 5);

        return {
            totalVendas,
            totalTaxas,
            count: filteredPedidos.length - cancelados.length,
            ticketMedio: (filteredPedidos.length - cancelados.length) ? totalVendas / (filteredPedidos.length - cancelados.length) : 0,
            byDay: { labels: sortedDays, data: sortedDays.map(d => byDay[d]) },
            byHour: { labels: Object.keys(byHour).sort(), data: Object.keys(byHour).sort().map(h => byHour[h]) },
            byPayment: { labels: Object.keys(byPayment), data: Object.values(byPayment) },
            topItems,
            topMotoboys,
            topBairros,
            topClients,
            mesaMetrics: {
                total: mesaVendas.reduce((acc, m) => acc + m.totalFinal, 0),
                count: mesaVendas.length
            },
            cancelamentos: {
                qtd: cancelados.length,
                valor: cancelados.reduce((acc, p) => acc + p.totalFinal, 0),
                taxa: filteredPedidos.length > 0 ? ((cancelados.length / filteredPedidos.length) * 100).toFixed(1) : 0
            }
        };
    }, [filteredPedidos]);

    // Exportações
    const handleExportCSV = () => {
        if (!filteredPedidos.length) return toast.warn("Sem dados.");
        const headers = ['Data', 'Hora', 'ID', 'Tipo', 'Mesa', 'Cliente', 'Motoboy', 'Bairro', 'Status', 'Pagamento', 'Total'];
        const rows = filteredPedidos.map(p => [
            format(p.data, 'dd/MM/yyyy'), format(p.data, 'HH:mm'),
            p.id, p.tipo, p.mesaNumero || '-', p.clienteNome, p.motoboyNome || '-', p.bairro || '-',
            p.status, traduzirPagamento(p.formaPagamento), p.totalFinal.toFixed(2).replace('.', ',')
        ]);
        const csvContent = [headers, ...rows].map(e => e.join(";")).join("\n");
        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio_${startDate}.csv`;
        link.click();
    };

    const handleExportPDF = async () => {
        const input = reportContentRef.current;
        if (!input) return;
        const btns = document.querySelectorAll('.no-print');
        btns.forEach(b => b.style.display = 'none');
        try {
            const canvas = await html2canvas(input, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const pdf = new jsPDF('p', 'mm', 'a4');
            const w = pdf.internal.pageSize.getWidth();
            const h = (canvas.height * w) / canvas.width;
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
            pdf.save(`relatorio.pdf`);
            toast.success("PDF Gerado!");
        } catch (e) { toast.error("Erro PDF"); } 
        finally { btns.forEach(b => b.style.display = 'flex'); }
    };

    const DetailedTable = () => (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente/Mesa</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entregador</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pagamento</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPedidos.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{format(p.data, 'dd/MM HH:mm')}</td>
                            <td className="px-4 py-3 text-sm">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${p.tipo === 'mesa' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {p.tipo.toUpperCase()}
                                </span>
                                <span className="ml-2 text-gray-500 font-mono text-xs">#{p.id.slice(0,6)}</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                                {p.tipo === 'mesa' ? 
                                    <div className="font-bold">Mesa {p.mesaNumero} <span className="text-gray-400 font-normal text-xs">{p.loteHorario}</span></div> : 
                                    <div>{p.clienteNome} <div className="text-xs text-gray-400">{p.bairro}</div></div>
                                }
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                                {p.motoboyNome ? <div className="flex items-center gap-1"><FaMotorcycle className="text-gray-500"/> {p.motoboyNome}</div> : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                                {traduzirPagamento(p.formaPagamento)}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-gray-900">
                                {p.totalFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="px-4 py-3 text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.status === 'cancelado' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                    {p.status}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } };

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-3 sm:p-6 font-sans">
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link to="/dashboard" className="p-2.5 rounded-xl hover:bg-white text-gray-600 border border-gray-200 transition-colors bg-white shadow-sm">
                            <IoArrowBack size={18} />
                        </Link>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Relatórios de Gestão</h1>
                            <p className="text-xs text-gray-500 font-medium">Financeiro, Operacional e Logística</p>
                        </div>
                    </div>
                    <div className="flex gap-2 no-print">
                        <button onClick={handleExportCSV} disabled={!filteredPedidos.length} className="bg-emerald-600 text-white px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm">
                            <IoDownloadOutline size={16}/> CSV
                        </button>
                        <button onClick={handleExportPDF} disabled={!filteredPedidos.length} className="bg-blue-600 text-white px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm">
                            <IoPrintOutline size={16}/> PDF
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto" ref={reportContentRef}>
                {/* FILTROS */}
                <Card title={<><IoFilterOutline className="text-blue-600"/> Filtros</>} className="mb-6">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                            <span className="text-[10px] font-black text-gray-400 mr-2 uppercase">De</span>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-xs font-bold text-gray-700 outline-none w-full" />
                        </div>
                        <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                            <span className="text-[10px] font-black text-gray-400 mr-2 uppercase">Até</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-xs font-bold text-gray-700 outline-none w-full" />
                        </div>
                        <select value={deliveryTypeFilter} onChange={e => setDeliveryTypeFilter(e.target.value)} className="p-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 bg-white shadow-sm">
                            <option value="todos">Todos Tipos</option>
                            <option value="delivery">Delivery</option>
                            <option value="mesa">Mesas</option>
                        </select>
                        <select value={motoboyFilter} onChange={e => setMotoboyFilter(e.target.value)} className="p-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 bg-white shadow-sm">
                            <option value="todos">Todos Motoboys</option>
                            {availableMotoboys.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                        </select>
                        <button onClick={fetchData} disabled={loadingData} className="bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex justify-center items-center gap-2 text-xs font-bold transition-all shadow-sm no-print">
                            {loadingData ? '...' : <><IoRefreshOutline/> Filtrar</>}
                        </button>
                    </div>
                    {/* Quick date buttons + search + view toggle */}
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
                </Card>

                {/* GRÁFICOS E CARDS */}
                {viewMode === 'charts' && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                            <StatCard title="Faturamento Líquido" value={metrics.totalVendas.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} icon={<IoCashOutline/>} color="green" />
                            <StatCard title="Taxas de Entrega" value={metrics.totalTaxas.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} icon={<FaMotorcycle/>} color="indigo" />
                            <StatCard title="Ticket Médio" value={metrics.ticketMedio.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} icon={<IoStatsChartOutline/>} color="purple" />
                            <StatCard title="Pedidos Válidos" value={metrics.count} subtitle={`${metrics.mesaMetrics.count} mesas`} icon={<IoReceiptOutline/>} color="blue" />
                        </div>

                        {/* ANALISE DE PERDA, BAIRROS E CLIENTES */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                            <Card title={<><IoAlertCircleOutline className="text-red-600"/> Saúde da Operação</>}>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-gray-500 text-sm">Cancelamentos</p>
                                        <p className="text-2xl font-bold text-red-600">{metrics.cancelamentos.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                        <p className="text-xs text-gray-400 mt-1">{metrics.cancelamentos.qtd} pedidos</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-bold text-red-600">{metrics.cancelamentos.taxa}%</div>
                                        <p className="text-xs text-gray-400">Taxa de Rejeição</p>
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

                        {/* DESEMPENHO DA FROTA */}
                        {metrics.topMotoboys.length > 0 && (
                            <div className="mb-6">
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

                        {/* GRÁFICOS */}
                        <div className="grid lg:grid-cols-3 gap-6 mb-6">
                            <div className="lg:col-span-2">
                                <Card title="Evolução Diária">
                                    <div className="h-64"><Line data={{ labels: metrics.byDay.labels, datasets: [{ label: 'R$', data: metrics.byDay.data, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true }] }} options={chartOptions} /></div>
                                </Card>
                            </div>
                            <Card title="Top 5 Produtos">
                                {metrics.topItems.map(([n, q], i) => (
                                    <div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded mb-2"><span className="text-sm truncate max-w-[180px] font-medium">{n}</span><span className="text-xs bg-blue-100 text-blue-800 px-2 rounded">{q}</span></div>
                                ))}
                            </Card>
                        </div>
                        <div className="grid md:grid-cols-2 gap-6">
                            <Card title="Meios de Pagamento (Traduzido)"><div className="h-64"><Pie data={{ labels: metrics.byPayment.labels, datasets: [{ data: metrics.byPayment.data, backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'] }] }} options={chartOptions} /></div></Card>
                            <Card title="Vendas por Hora"><div className="h-64"><Bar data={{ labels: metrics.byHour.labels, datasets: [{ label: 'Vendas', data: metrics.byHour.data, backgroundColor: '#3b82f6' }] }} options={chartOptions} /></div></Card>
                        </div>
                    </>
                )}

                {viewMode === 'table' && <Card title={`Detalhamento (${filteredPedidos.length})`}><DetailedTable /></Card>}
            </div>
        </div>
    );
};

export default withEstablishmentAuth(AdminReports);
