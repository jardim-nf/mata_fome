import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { format, startOfDay, endOfDay, subDays, subMonths, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Bibliotecas para PDF e Gráficos
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement } from 'chart.js';
import { Line, Pie, Bar } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

// Ícones
import { 
    IoArrowBack, 
    IoDocumentTextOutline, 
    IoSearch,
    IoCalendarOutline,
    IoFilterOutline,
    IoDownloadOutline,
    IoRefreshOutline,
    IoStatsChartOutline,
    IoPieChartOutline,
    IoTrendingUpOutline,
    IoRestaurantOutline,
    IoCashOutline,
    IoReceiptOutline,
    IoBicycleOutline,
    IoPrintOutline,
    IoPeopleOutline,
    IoTimeOutline,
    IoAnalyticsOutline,
    IoEyeOutline,
    IoGridOutline,
    IoListOutline
} from 'react-icons/io5';

// Registro dos componentes do Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement, ChartDataLabels);

// --- COMPONENTES DE UI REUTILIZÁVEIS ---

const Card = ({ title, children, className = "" }) => (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${className}`}>
        {title && <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">{title}</h3>}
        {children}
    </div>
);

const StatCard = ({ title, value, subtitle, icon, color = "blue" }) => {
    const colorClasses = {
        blue: 'bg-blue-100 text-blue-600',
        green: 'bg-green-100 text-green-600',
        amber: 'bg-amber-100 text-amber-600',
        purple: 'bg-purple-100 text-purple-600',
        red: 'bg-red-100 text-red-600'
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-600">{title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
                    {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
                </div>
                <div className={`w-12 h-12 ${colorClasses[color]} rounded-lg flex items-center justify-center`}>
                    {icon}
                </div>
            </div>
        </div>
    );
};

const SkeletonLoader = () => (
    <div className="animate-pulse bg-gray-200 rounded-xl p-6 h-32"></div>
);

const FilterBadge = ({ children, active, onClick }) => (
    <button
        onClick={onClick}
        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            active 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
    >
        {children}
    </button>
);

// --- COMPONENTE PRINCIPAL ---

const AdminReports = () => {
    const { estabelecimentoIdPrincipal } = useAuth();
    const reportContentRef = useRef();

    // Estados
    const [loadingData, setLoadingData] = useState(false);
    const [pedidos, setPedidos] = useState([]);
    const [vendasMesa, setVendasMesa] = useState([]);
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [statusFilter, setStatusFilter] = useState('todos');
    const [paymentMethodFilter, setPaymentMethodFilter] = useState('todos');
    const [deliveryTypeFilter, setDeliveryTypeFilter] = useState('todos');
    
    // NOVOS ESTADOS ADICIONADOS
    const [searchTerm, setSearchTerm] = useState('');
    const [minValue, setMinValue] = useState('');
    const [maxValue, setMaxValue] = useState('');
    const [viewMode, setViewMode] = useState('charts'); // 'charts' | 'table' | 'summary'
    const [comparisonData, setComparisonData] = useState(null);

    // 🔥 BUSCAR DADOS COM CORREÇÃO PARA VENDAS DE MESA
    const fetchData = async () => {
        if (!estabelecimentoIdPrincipal) return;
        
        try {
            setLoadingData(true);
            const start = startOfDay(new Date(startDate + 'T00:00:00'));
            const end = endOfDay(new Date(endDate + 'T23:59:59'));

            let allData = [];

            // 🔥 BUSCAR PEDIDOS (delivery/retirada)
            try {
                let pedidosConstraints = [
                    where('estabelecimentoId', '==', estabelecimentoIdPrincipal),
                    where('createdAt', '>=', start),
                    where('createdAt', '<=', end)
                ];

                if (statusFilter !== 'todos') {
                    pedidosConstraints.push(where('status', '==', statusFilter));
                }

                if (paymentMethodFilter !== 'todos') {
                    pedidosConstraints.push(where('formaPagamento', '==', paymentMethodFilter));
                }

                if (deliveryTypeFilter !== 'todos') {
                    pedidosConstraints.push(where('tipo', '==', deliveryTypeFilter));
                }
                
                pedidosConstraints.push(orderBy('createdAt', 'desc'));

                const qPedidos = query(collection(db, 'pedidos'), ...pedidosConstraints);
                const querySnapshotPedidos = await getDocs(qPedidos);
                
                const pedidosList = querySnapshotPedidos.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    data: doc.data().createdAt.toDate(),
                    tipo: doc.data().tipo || 'pedido',
                    origem: 'pedidos'
                }));

                allData = [...allData, ...pedidosList];
                console.log("📦 Pedidos carregados:", pedidosList.length);
            } catch (error) {
                console.error("❌ Erro ao carregar pedidos:", error);
            }

            // 🔥 BUSCAR VENDAS DE MESA (mesas) - CORRIGIDO
            try {
                let vendasConstraints = [
                    where('dataFechamento', '>=', start),
                    where('dataFechamento', '<=', end)
                ];

                // Aplicar filtros para vendas de mesa
                if (paymentMethodFilter !== 'todos') {
                    vendasConstraints.push(where('formaPagamento', '==', paymentMethodFilter));
                }

                if (statusFilter !== 'todos') {
                    vendasConstraints.push(where('status', '==', statusFilter));
                } else {
                    // Por padrão, buscar apenas vendas finalizadas
                    vendasConstraints.push(where('status', '==', 'finalizada'));
                }

                // Só buscar vendas de mesa se o filtro for "todos" ou "mesa"
                if (deliveryTypeFilter === 'todos' || deliveryTypeFilter === 'mesa') {
                    vendasConstraints.push(orderBy('dataFechamento', 'desc'));
                    
                    // ✅ CORREÇÃO: Caminho correto para as vendas
                    const qVendas = query(
                        collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'vendas'), 
                        ...vendasConstraints
                    );
                    
                    const querySnapshotVendas = await getDocs(qVendas);
                    
                    const vendasList = querySnapshotVendas.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        data: doc.data().dataFechamento?.toDate() || new Date(),
                        tipo: 'mesa',
                        totalFinal: doc.data().total || doc.data().valorTotal || 0,
                        formaPagamento: doc.data().formaPagamento || 'Não informado',
                        status: doc.data().status,
                        origem: 'vendas',
                        mesaNumero: doc.data().mesaNumero || doc.data().numeroMesa || 'N/A',
                        itens: doc.data().itens || doc.data().produtos || [],
                        clienteNome: doc.data().clienteNome || 'Cliente Mesa'
                    }));

                    allData = [...allData, ...vendasList];
                    console.log("🏪 Vendas de mesa carregadas:", vendasList.length);
                }
            } catch (error) {
                console.error("❌ Erro ao carregar vendas de mesa:", error);
            }

            console.log("📊 Total de dados carregados:", allData.length);
            setPedidos(allData);
            
            if (allData.length === 0) {
                toast.info("ℹ️ Nenhum dado encontrado para os filtros selecionados.");
            } else {
                toast.success(`✅ ${allData.length} registros carregados.`);
            }
        } catch (err) {
            console.error("❌ Erro ao carregar dados:", err);
            toast.error("❌ Erro ao carregar dados.");
        } finally {
            setLoadingData(false);
        }
    };

    // Efetua a primeira busca ao carregar a página
    useEffect(() => {
        if (estabelecimentoIdPrincipal) {
            fetchData();
        }
    }, [estabelecimentoIdPrincipal]);

    // 🔥 NOVO: FILTROS AVANÇADOS
    const filteredPedidos = useMemo(() => {
        return pedidos.filter(pedido => {
            const matchesSearch = searchTerm === '' || 
                pedido.id?.includes(searchTerm) ||
                pedido.mesaNumero?.toString().includes(searchTerm) ||
                (pedido.clienteNome?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (pedido.formaPagamento?.toLowerCase() || '').includes(searchTerm.toLowerCase());
            
            const matchesMinValue = minValue === '' || (pedido.totalFinal || 0) >= parseFloat(minValue);
            const matchesMaxValue = maxValue === '' || (pedido.totalFinal || 0) <= parseFloat(maxValue);
            
            return matchesSearch && matchesMinValue && matchesMaxValue;
        });
    }, [pedidos, searchTerm, minValue, maxValue]);

    // Cálculos e memorização de dados
    const { summaryData, salesByDay, salesByPayment, salesByDelivery, topItems, pedidosMesa, salesByHour, performanceMetrics, clientMetrics, businessInsights } = useMemo(() => {
        const totalPedidos = filteredPedidos.length;
        const totalVendas = filteredPedidos.reduce((acc, p) => acc + (p.totalFinal || 0), 0);
        const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0;
        let totalTaxasEntrega = 0;

        const salesByDay = {}, salesByPayment = {}, salesByDelivery = {}, itemsCount = {};
        const salesByHour = {};
        const pedidosMesa = filteredPedidos.filter(p => p.tipo === 'mesa');
        
        // 🔥 FUNÇÃO PARA REMOVER OBSERVAÇÕES DOS NOMES DOS PRODUTOS
        const cleanProductName = (name) => {
            if (!name) return 'Item sem nome';
            
            // Remove texto entre parênteses (observações)
            let cleaned = name.replace(/\s*\([^)]*\)/g, '');
            
            // Remove texto após "obs:", "observação:", etc
            cleaned = cleaned.replace(/\s*(obs|observação|observation):.*$/gi, '');
            
            // Remove texto entre colchetes
            cleaned = cleaned.replace(/\s*\[[^\]]*\]/g, '');
            
            // Remove espaços extras no início e fim
            cleaned = cleaned.trim();
            
            return cleaned || 'Item sem nome';
        };
        
        filteredPedidos.forEach(p => {
            const dateKey = format(p.data, 'dd/MM', { locale: ptBR });
            salesByDay[dateKey] = (salesByDay[dateKey] || 0) + (p.totalFinal || 0);

            const hourKey = format(p.data, 'HH:00');
            salesByHour[hourKey] = (salesByHour[hourKey] || 0) + 1;

            const paymentKey = p.formaPagamento || 'Não informado';
            salesByPayment[paymentKey] = (salesByPayment[paymentKey] || 0) + (p.totalFinal || 0);
            
            const deliveryKey = p.tipo || 'Não informado';
            salesByDelivery[deliveryKey] = (salesByDelivery[deliveryKey] || 0) + 1;

            // Processar itens tanto de pedidos quanto de vendas de mesa
            p.itens?.forEach(item => {
                // 🔥 USA O NOME LIMPO SEM OBSERVAÇÕES
                const itemName = cleanProductName(item.nome);
                itemsCount[itemName] = (itemsCount[itemName] || 0) + (item.quantidade || 0);
            });

            if (p.tipo === 'delivery') {
                totalTaxasEntrega += (parseFloat(p.taxaEntrega) || 0);
            }
        });
        
        const sortedLabels = Object.keys(salesByDay).sort((a, b) => 
            new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-'))
        );
        
        const topItems = Object.entries(itemsCount)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        // 🔥 NOVO: MÉTRICAS DE PERFORMANCE
        const totalItens = filteredPedidos.reduce((acc, p) => acc + (p.itens?.length || 0), 0);
        const avgItemsPerOrder = totalItens / filteredPedidos.length || 0;
        
        // Tempo médio entre pedidos
        const timeDifferences = [];
        const sortedByTime = [...filteredPedidos].sort((a, b) => a.data - b.data);
        
        for (let i = 1; i < sortedByTime.length; i++) {
            const diff = sortedByTime[i].data - sortedByTime[i-1].data;
            timeDifferences.push(diff);
        }
        
        const avgTimeBetweenOrders = timeDifferences.length > 0 
            ? timeDifferences.reduce((a, b) => a + b, 0) / timeDifferences.length 
            : 0;

        // 🔥 NOVO: MÉTRICAS DE CLIENTES
        const clientOrders = {};
        filteredPedidos.forEach(pedido => {
            const clientId = pedido.clienteId || pedido.userId || 'anonimo';
            if (!clientOrders[clientId]) {
                clientOrders[clientId] = {
                    count: 0,
                    total: 0,
                    clientName: pedido.clienteNome || 'Cliente'
                };
            }
            clientOrders[clientId].count++;
            clientOrders[clientId].total += pedido.totalFinal || 0;
        });
        
        const topClients = Object.entries(clientOrders)
            .sort(([,a], [,b]) => b.total - a.total)
            .slice(0, 5);

        // 🔥 NOVO: BUSINESS INSIGHTS
        const insights = [];
        
        // Insight: Horário de pico
        const peakHour = Object.entries(salesByHour).sort(([,a], [,b]) => b - a)[0];
        if (peakHour) {
            insights.push(`⏰ Horário de pico: ${peakHour[0]} (${peakHour[1]} pedidos)`);
        }
        
        // Insight: Produto mais vendido
        if (topItems.length > 0) {
            insights.push(`🏆 Produto campeão: ${topItems[0][0]} (${topItems[0][1]} unidades)`);
        }
        
        // Insight: Método de pagamento preferido
        const topPayment = Object.entries(salesByPayment).sort(([,a], [,b]) => b - a)[0];
        if (topPayment && totalVendas > 0) {
            insights.push(`💳 Pagamento preferido: ${topPayment[0]} (${(topPayment[1]/totalVendas*100).toFixed(1)}%)`);
        }

        // Insight: Tipo mais popular
        const topType = Object.entries(salesByDelivery).sort(([,a], [,b]) => b - a)[0];
        if (topType) {
            insights.push(`📦 Tipo mais popular: ${topType[0]} (${topType[1]} pedidos)`);
        }

        return {
            summaryData: { 
                totalPedidos, 
                totalVendas, 
                ticketMedio, 
                totalTaxasEntrega 
            },
            salesByDay: { 
                labels: sortedLabels, 
                data: sortedLabels.map(l => salesByDay[l]) 
            },
            salesByPayment: { 
                labels: Object.keys(salesByPayment), 
                data: Object.values(salesByPayment) 
            },
            salesByDelivery: { 
                labels: Object.keys(salesByDelivery), 
                data: Object.values(salesByDelivery) 
            },
            salesByHour: {
                labels: Object.keys(salesByHour).sort(),
                data: Object.keys(salesByHour).sort().map(h => salesByHour[h])
            },
            topItems,
            pedidosMesa,
            performanceMetrics: {
                totalItens,
                avgItemsPerOrder: avgItemsPerOrder.toFixed(1),
                avgTimeBetweenOrders: (avgTimeBetweenOrders / (1000 * 60)).toFixed(1) // em minutos
            },
            clientMetrics: {
                topClients, 
                uniqueClients: Object.keys(clientOrders).length 
            },
            businessInsights: insights
        };
    }, [filteredPedidos]);
    
    // 🔥 NOVO: EXPORTAÇÃO CSV
    const handleExportCSV = () => {
        if (filteredPedidos.length === 0) {
            toast.warn("⚠️ Não há dados para exportar.");
            return;
        }

        const headers = ['Data', 'ID', 'Tipo', 'Valor', 'Pagamento', 'Status', 'Mesa', 'Cliente'];
        const csvData = filteredPedidos.map(pedido => [
            format(pedido.data, 'dd/MM/yyyy HH:mm'),
            pedido.id,
            pedido.tipo,
            (pedido.totalFinal || 0).toFixed(2),
            pedido.formaPagamento || 'N/A',
            pedido.status || 'N/A',
            pedido.mesaNumero || 'N/A',
            pedido.clienteNome || 'N/A'
        ]);
        
        const csvContent = [headers, ...csvData]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `relatorio_${startDate}_a_${endDate}.csv`;
        link.click();
        
        toast.success("✅ CSV exportado com sucesso!");
    };

    const handleExportPDF = async () => {
        if (filteredPedidos.length === 0) {
            toast.warn("⚠️ Não há dados para exportar.");
            return;
        }

        const input = reportContentRef.current;
        if (!input) return;
        
        toast.info("📄 Gerando PDF, por favor aguarde...");

        // Esconde botões durante a geração do PDF
        const buttons = input.querySelectorAll('.no-print');
        buttons.forEach(btn => btn.style.display = 'none');
        
        try {
            const canvas = await html2canvas(input, { 
                scale: 2, 
                useCORS: true, 
                backgroundColor: '#ffffff',
                logging: false
            });
            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            // Cabeçalho do PDF
            pdf.setFontSize(16);
            pdf.setTextColor('#1f2937');
            pdf.text('Relatório de Vendas', pdfWidth / 2, 15, { align: 'center' });
            pdf.setFontSize(10);
            pdf.setTextColor('#6b7280');
            pdf.text(`Período: ${format(new Date(startDate + 'T00:00:00'), 'dd/MM/yyyy')} a ${format(new Date(endDate + 'T00:00:00'), 'dd/MM/yyyy')}`, pdfWidth / 2, 22, { align: 'center' });
            pdf.text(`Estabelecimento ID: ${estabelecimentoIdPrincipal}`, pdfWidth / 2, 28, { align: 'center' });

            pdf.addImage(imgData, 'PNG', 0, 35, pdfWidth, pdfHeight);
            pdf.save(`relatorio_${startDate}_a_${endDate}.pdf`);
            
            toast.success("✅ PDF gerado com sucesso!");
        } catch (error) {
            console.error("❌ Erro ao gerar PDF:", error);
            toast.error("❌ Erro ao gerar PDF.");
        } finally {
            // Restaura visibilidade dos botões
            buttons.forEach(btn => btn.style.display = 'flex');
        }
    };

    const setDateRange = (start, end) => {
        setStartDate(format(start, 'yyyy-MM-dd'));
        setEndDate(format(end, 'yyyy-MM-dd'));
    };

    // 🔥 NOVO: COMPONENTE DE TABELA DETALHADA
    const DetailedTable = () => (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pagamento</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mesa</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPedidos.map(pedido => (
                        <tr key={pedido.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                                {format(pedido.data, 'dd/MM/yyyy HH:mm')}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                                {pedido.id.substring(0, 8)}...
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 capitalize">
                                {pedido.tipo}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {(pedido.totalFinal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                                {pedido.formaPagamento || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    pedido.status === 'finalizado' || pedido.status === 'finalizada' ? 'bg-green-100 text-green-800' :
                                    pedido.status === 'pendente' ? 'bg-yellow-100 text-yellow-800' :
                                    pedido.status === 'preparando' ? 'bg-blue-100 text-blue-800' :
                                    'bg-red-100 text-red-800'
                                }`}>
                                    {pedido.status}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                                {pedido.mesaNumero || 'N/A'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {filteredPedidos.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                    📊 Nenhum registro encontrado
                </div>
            )}
        </div>
    );

    const chartOptions = {
        responsive: true, 
        maintainAspectRatio: false,
        plugins: {
            legend: { 
                position: 'top', 
                labels: { 
                    color: '#374151',
                    boxWidth: 12, 
                    padding: 15,
                    font: { size: 11 }
                } 
            },
            datalabels: {
                formatter: (value, ctx) => {
                    const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                    const percentage = total > 0 ? (value / total * 100).toFixed(1) + '%' : '0%';
                    return percentage;
                },
                color: '#374151',
                font: { weight: 'bold', size: 10 }
            }
        }
    };

    const lineChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: { 
                ticks: { color: '#6b7280' },
                grid: { color: '#f3f4f6' }
            },
            y: { 
                ticks: { 
                    color: '#6b7280',
                    callback: function(value) {
                        return 'R$ ' + value.toLocaleString('pt-BR');
                    }
                },
                grid: { color: '#f3f4f6' }
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return 'R$ ' + context.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                    }
                }
            }
        }
    };

    const barChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: { 
                ticks: { color: '#6b7280' },
                grid: { color: '#f3f4f6' }
            },
            y: { 
                ticks: { color: '#6b7280' },
                grid: { color: '#f3f4f6' }
            }
        },
        plugins: {
            legend: { display: false }
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
            {/* HEADER COM BOTÕES */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div className="mb-4 sm:mb-0">
                        <h1 className="text-2xl font-bold text-gray-900">📊 Relatórios Avançados</h1>
                        <p className="text-gray-600 mt-1">Relatórios detalhados de vendas (Pedidos + Mesas)</p>
                    </div>
                    <div className="flex space-x-3">
                        <button 
                            onClick={handleExportCSV}
                            disabled={filteredPedidos.length === 0 || loadingData}
                            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed no-print"
                        >
                            <IoDownloadOutline className="text-lg" />
                            <span>Exportar CSV</span>
                        </button>
                        <button 
                            onClick={handleExportPDF}
                            disabled={filteredPedidos.length === 0 || loadingData}
                            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed no-print"
                        >
                            <IoPrintOutline className="text-lg" />
                            <span>Exportar PDF</span>
                        </button>
                        <Link 
                            to="/dashboard"
                            className="flex items-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors no-print"
                        >
                            <IoArrowBack className="text-lg" />
                            <span>Voltar</span>
                        </Link>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto" ref={reportContentRef}>
                {/* Painel de Filtros AVANÇADO */}
                <Card title={
                    <>
                        <IoFilterOutline className="text-blue-600" />
                        <span>Filtros e Período</span>
                    </>
                }>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <IoCalendarOutline className="inline mr-1" />
                                Data Início
                            </label>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={e => setStartDate(e.target.value)} 
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <IoCalendarOutline className="inline mr-1" />
                                Data Fim
                            </label>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={e => setEndDate(e.target.value)} 
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                            <select 
                                onChange={e => setStatusFilter(e.target.value)} 
                                value={statusFilter} 
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            >
                                <option value="todos">Todos os Status</option>
                                <option value="finalizado">Finalizado</option>
                                <option value="finalizada">Finalizada (Mesas)</option>
                                <option value="entregue">Entregue</option>
                                <option value="preparando">Preparando</option>
                                <option value="pendente">Pendente</option>
                                <option value="cancelado">Cancelado</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Pagamento</label>
                            <select 
                                onChange={e => setPaymentMethodFilter(e.target.value)} 
                                value={paymentMethodFilter} 
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            >
                                <option value="todos">Todos</option>
                                <option value="PIX">PIX</option>
                                <option value="Cartão de Crédito">Crédito</option>
                                <option value="Cartão de Débito">Débito</option>
                                <option value="Dinheiro">Dinheiro</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
                            <select 
                                onChange={e => setDeliveryTypeFilter(e.target.value)} 
                                value={deliveryTypeFilter} 
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            >
                                <option value="todos">Todos os Tipos</option>
                                <option value="delivery">Delivery</option>
                                <option value="retirada">Retirada</option>
                                <option value="mesa">Mesa</option>
                            </select>
                        </div>
                    </div>

                    {/* 🔥 NOVO: FILTROS AVANÇADOS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <IoSearch className="inline mr-1" />
                                Buscar (ID, Mesa, Cliente)
                            </label>
                            <input 
                                type="text" 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)} 
                                placeholder="Digite para buscar..."
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Valor Mínimo</label>
                            <input 
                                type="number" 
                                value={minValue} 
                                onChange={e => setMinValue(e.target.value)} 
                                placeholder="R$ 0,00"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Valor Máximo</label>
                            <input 
                                type="number" 
                                value={maxValue} 
                                onChange={e => setMaxValue(e.target.value)} 
                                placeholder="R$ 1000,00"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            />
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap gap-2">
                            <FilterBadge 
                                active={startDate === format(new Date(), 'yyyy-MM-dd')}
                                onClick={() => setDateRange(new Date(), new Date())}
                            >
                                Hoje
                            </FilterBadge>
                            <FilterBadge 
                                active={startDate === format(subDays(new Date(), 6), 'yyyy-MM-dd')}
                                onClick={() => setDateRange(subDays(new Date(), 6), new Date())}
                            >
                                7 Dias
                            </FilterBadge>
                            <FilterBadge 
                                active={startDate === format(subDays(new Date(), 29), 'yyyy-MM-dd')}
                                onClick={() => setDateRange(subDays(new Date(), 29), new Date())}
                            >
                                30 Dias
                            </FilterBadge>
                        </div>
                        
                        <div className="flex space-x-3">
                            {/* 🔥 NOVO: BOTÕES DE VISUALIZAÇÃO */}
                            <div className="flex bg-gray-100 rounded-lg p-1">
                                <button
                                    onClick={() => setViewMode('charts')}
                                    className={`p-2 rounded-md transition-colors ${
                                        viewMode === 'charts' ? 'bg-white shadow-sm' : 'text-gray-500'
                                    }`}
                                    title="Visualização em Gráficos"
                                >
                                    <IoAnalyticsOutline className="text-lg" />
                                </button>
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`p-2 rounded-md transition-colors ${
                                        viewMode === 'table' ? 'bg-white shadow-sm' : 'text-gray-500'
                                    }`}
                                    title="Visualização em Tabela"
                                >
                                    <IoListOutline className="text-lg" />
                                </button>
                            </div>
                            
                            <button 
                                onClick={fetchData} 
                                disabled={loadingData}
                                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed no-print"
                            >
                                {loadingData ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Buscando...</span>
                                    </>
                                ) : (
                                    <>
                                        <IoRefreshOutline />
                                        <span>Atualizar Relatório</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </Card>

                {loadingData ? (
                    <div className="space-y-8 mt-8">
                        <SkeletonLoader />
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <SkeletonLoader />
                            <SkeletonLoader />
                            <SkeletonLoader />
                            <SkeletonLoader />
                        </div>
                        <SkeletonLoader />
                    </div>
                ) : (
                    <div className="space-y-8 mt-8">
                        {/* 🔥 NOVO: BUSINESS INSIGHTS */}
                        {businessInsights.length > 0 && (
                            <Card title="💡 Insights do Negócio">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {businessInsights.map((insight, index) => (
                                        <div key={index} className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                            <span className="text-sm text-blue-800 font-medium">{insight}</span>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )}

                        {/* Cards de Estatísticas */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard 
                                title="Vendas Totais" 
                                value={summaryData.totalVendas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                subtitle={`${summaryData.totalPedidos} registros`}
                                icon={<IoCashOutline className="text-xl" />}
                                color="green"
                            />
                            <StatCard 
                                title="Registros" 
                                value={summaryData.totalPedidos}
                                subtitle="Total no período"
                                icon={<IoReceiptOutline className="text-xl" />}
                                color="blue"
                            />
                            <StatCard 
                                title="Ticket Médio" 
                                value={summaryData.ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                subtitle="Por registro"
                                icon={<IoStatsChartOutline className="text-xl" />}
                                color="purple"
                            />
                            <StatCard 
                                title="Taxas de Entrega" 
                                value={summaryData.totalTaxasEntrega.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                subtitle="Total acumulado"
                                icon={<IoBicycleOutline className="text-xl" />}
                                color="amber"
                            />
                        </div>

                        {/* 🔥 NOVO: MÉTRICAS DE PERFORMANCE */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <StatCard 
                                title="Itens Vendidos" 
                                value={performanceMetrics.totalItens}
                                subtitle={`Média: ${performanceMetrics.avgItemsPerOrder} por pedido`}
                                icon={<IoRestaurantOutline className="text-xl" />}
                                color="green"
                            />
                            <StatCard 
                                title="Clientes Únicos" 
                                value={clientMetrics.uniqueClients}
                                subtitle="Total de clientes"
                                icon={<IoPeopleOutline className="text-xl" />}
                                color="blue"
                            />
                            <StatCard 
                                title="Tempo Entre Pedidos" 
                                value={`${performanceMetrics.avgTimeBetweenOrders} min`}
                                subtitle="Tempo médio"
                                icon={<IoTimeOutline className="text-xl" />}
                                color="purple"
                            />
                        </div>

                        {/* 🔥 NOVO: VISUALIZAÇÃO EM TABELA */}
                        {viewMode === 'table' ? (
                            <Card title={
                                <>
                                    <IoListOutline className="text-blue-600" />
                                    <span>Tabela Detalhada ({filteredPedidos.length} registros)</span>
                                </>
                            }>
                                <DetailedTable />
                            </Card>
                        ) : (
                            /* VISUALIZAÇÃO EM GRÁFICOS (ORIGINAL) */
                            <>
                                {/* ✅ CARD COM ESTATÍSTICAS DE PEDIDOS DE MESA */}
                                {pedidosMesa.length > 0 && (
                                    <Card title={
                                        <>
                                            <IoRestaurantOutline className="text-blue-600" />
                                            <span>Pedidos de Mesa ({pedidosMesa.length})</span>
                                        </>
                                    }>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="text-center p-4 bg-blue-50 rounded-lg">
                                                <p className="text-2xl font-bold text-blue-600">{pedidosMesa.length}</p>
                                                <p className="text-sm text-gray-600">Total Mesas</p>
                                            </div>
                                            <div className="text-center p-4 bg-green-50 rounded-lg">
                                                <p className="text-2xl font-bold text-green-600">
                                                    {pedidosMesa.reduce((acc, p) => acc + (p.totalFinal || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </p>
                                                <p className="text-sm text-gray-600">Vendas Mesas</p>
                                            </div>
                                            <div className="text-center p-4 bg-purple-50 rounded-lg">
                                                <p className="text-2xl font-bold text-purple-600">
                                                    {[...new Set(pedidosMesa.map(p => p.mesaNumero))].length}
                                                </p>
                                                <p className="text-sm text-gray-600">Mesas Únicas</p>
                                            </div>
                                            <div className="text-center p-4 bg-amber-50 rounded-lg">
                                                <p className="text-2xl font-bold text-amber-600">
                                                    {(pedidosMesa.reduce((acc, p) => acc + (p.totalFinal || 0), 0) / pedidosMesa.length || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </p>
                                                <p className="text-sm text-gray-600">Ticket Médio Mesa</p>
                                            </div>
                                        </div>
                                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                            <p className="text-sm font-semibold text-gray-700 mb-2">📋 Mesas com vendas:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {[...new Set(pedidosMesa.map(p => p.mesaNumero))].sort((a, b) => a - b).map(mesa => (
                                                    <span key={mesa} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                                        Mesa {mesa}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </Card>
                                )}

                                {/* 🔥 NOVO: GRÁFICO DE HORÁRIOS DE PICO */}
                                <Card title={
                                    <>
                                        <IoTimeOutline className="text-blue-600" />
                                        <span>Horários de Pico</span>
                                    </>
                                }>
                                    <div className="h-80">
                                        {salesByHour.labels.length > 0 ? (
                                            <Bar 
                                                data={{ 
                                                    labels: salesByHour.labels, 
                                                    datasets: [{ 
                                                        label: 'Pedidos por Hora', 
                                                        data: salesByHour.data, 
                                                        backgroundColor: 'rgba(59, 130, 246, 0.6)',
                                                        borderColor: '#3b82f6',
                                                        borderWidth: 1
                                                    }] 
                                                }} 
                                                options={barChartOptions} 
                                            />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-gray-500">
                                                ⏰ Nenhum dado disponível para horários
                                            </div>
                                        )}
                                    </div>
                                </Card>

                                {/* Gráficos e Análises */}
                                <div className="grid lg:grid-cols-3 gap-6">
                                    <div className="lg:col-span-2">
                                        <Card title={
                                            <>
                                                <IoTrendingUpOutline className="text-blue-600" />
                                                <span>Vendas por Dia</span>
                                            </>
                                        }>
                                            <div className="h-80">
                                                {salesByDay.labels.length > 0 ? (
                                                    <Line 
                                                        data={{ 
                                                            labels: salesByDay.labels, 
                                                            datasets: [{ 
                                                                label: 'Vendas (R$)', 
                                                                data: salesByDay.data, 
                                                                borderColor: '#3b82f6', 
                                                                backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                                                                tension: 0.2, 
                                                                fill: true 
                                                            }] 
                                                        }} 
                                                        options={lineChartOptions} 
                                                    />
                                                ) : (
                                                    <div className="flex items-center justify-center h-full text-gray-500">
                                                        📊 Nenhum dado disponível para o período selecionado
                                                    </div>
                                                )}
                                            </div>
                                        </Card>
                                    </div>
                                    
                                    <Card title={
                                        <>
                                            <IoRestaurantOutline className="text-green-600" />
                                            <span>Itens Mais Vendidos</span>
                                        </>
                                    }>
                                        <div className="space-y-3">
                                            {topItems.map(([name, count], index) => (
                                                <div key={name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                                            <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                                                        </div>
                                                        <span className="font-medium text-gray-900 text-sm truncate flex-1" title={name}>
                                                            {name}
                                                        </span>
                                                    </div>
                                                    <span className="font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded text-sm whitespace-nowrap">
                                                        {count} un.
                                                    </span>
                                                </div>
                                            ))}
                                            {topItems.length === 0 && (
                                                <p className="text-center text-gray-500 py-8">
                                                    📦 Nenhum item vendido no período
                                                </p>
                                            )}
                                        </div>
                                    </Card>
                                </div>

                                {/* Gráficos de Pizza */}
                                <div className="grid md:grid-cols-2 gap-6">
                                    <Card title={
                                        <>
                                            <IoPieChartOutline className="text-purple-600" />
                                            <span>Vendas por Método de Pagamento</span>
                                        </>
                                    }>
                                        <div className="h-80">
                                            {salesByPayment.labels.length > 0 ? (
                                                <Pie 
                                                    data={{ 
                                                        labels: salesByPayment.labels, 
                                                        datasets: [{ 
                                                            data: salesByPayment.data, 
                                                            backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'] 
                                                        }] 
                                                    }} 
                                                    options={chartOptions} 
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-gray-500">
                                                    💳 Nenhum dado disponível
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                    
                                    <Card title={
                                        <>
                                            <IoPieChartOutline className="text-amber-600" />
                                            <span>Registros por Tipo</span>
                                        </>
                                    }>
                                        <div className="h-80">
                                            {salesByDelivery.labels.length > 0 ? (
                                                <Pie 
                                                    data={{ 
                                                        labels: salesByDelivery.labels, 
                                                        datasets: [{ 
                                                            data: salesByDelivery.data, 
                                                            backgroundColor: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'] 
                                                        }] 
                                                    }} 
                                                    options={chartOptions} 
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-gray-500">
                                                    🚚 Nenhum dado disponível
                                                </div>
                                            )}
                                        </div>
                                    </Card>
                                </div>

                                {/* 🔥 NOVO: TOP CLIENTES */}
                                {clientMetrics.topClients.length > 0 && (
                                    <Card title={
                                        <>
                                            <IoPeopleOutline className="text-blue-600" />
                                            <span>Top Clientes</span>
                                        </>
                                    }>
                                        <div className="space-y-3">
                                            {clientMetrics.topClients.map(([clientId, data], index) => (
                                                <div key={clientId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                                            <span className="text-sm font-bold text-green-600">{index + 1}</span>
                                                        </div>
                                                        <div>
                                                            <span className="font-medium text-gray-900 text-sm block">
                                                                {data.clientName}
                                                            </span>
                                                            <span className="text-xs text-gray-500">
                                                                {data.count} pedidos
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className="font-bold text-green-600 bg-green-50 px-2 py-1 rounded text-sm whitespace-nowrap">
                                                        {data.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                )}
                            </>
                        )}

                        {/* Informações de Debug - APENAS EM DESENVOLVIMENTO */}
                        {process.env.NODE_ENV === 'development' && (
                            <Card title="🔧 Informações de Debug">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <p className="font-semibold">Estabelecimento ID</p>
                                        <p className="text-gray-600 truncate">{estabelecimentoIdPrincipal}</p>
                                    </div>
                                    <div>
                                        <p className="font-semibold">Período</p>
                                        <p className="text-gray-600">{startDate} a {endDate}</p>
                                    </div>
                                    <div>
                                        <p className="font-semibold">Registros Carregados</p>
                                        <p className="text-gray-600">{pedidos.length}</p>
                                    </div>
                                    <div>
                                        <p className="font-semibold">Pedidos Filtrados</p>
                                        <p className="text-gray-600">{filteredPedidos.length}</p>
                                    </div>
                                </div>
                            </Card>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default withEstablishmentAuth(AdminReports);