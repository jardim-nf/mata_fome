import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
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
    IoBicycleOutline
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
    const navigate = useNavigate();
    const { currentUser, isAdmin, isMaster, loading: authLoading, estabelecimentoIdPrincipal } = useAuth();
    const reportContentRef = useRef();

    // Estados
    const [loadingData, setLoadingData] = useState(false);
    const [pedidos, setPedidos] = useState([]);
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [statusFilter, setStatusFilter] = useState('finalizado');
    const [paymentMethodFilter, setPaymentMethodFilter] = useState('todos');
    const [deliveryTypeFilter, setDeliveryTypeFilter] = useState('todos');

    // 🚨 CORREÇÃO: Controle de acesso atualizado
    useEffect(() => {
        if (!authLoading) {
            console.log("🔐 Debug Auth AdminReports:", { 
                currentUser: !!currentUser, 
                isAdmin, 
                isMaster,
                estabelecimentoIdPrincipal 
            });
            
            if (!currentUser) {
                toast.error('🔒 Faça login para acessar.');
                navigate('/login-admin');
                return;
            }
            
            if (!isAdmin && !isMaster) {
                toast.error('🔒 Acesso negado. Você precisa ser administrador.');
                navigate('/dashboard');
                return;
            }

            if (!estabelecimentoIdPrincipal) {
                toast.error('❌ Configuração de acesso incompleta.');
                navigate('/dashboard');
                return;
            }
        }
    }, [currentUser, isAdmin, isMaster, authLoading, navigate, estabelecimentoIdPrincipal]);

    // Busca de dados
    const fetchPedidos = async () => {
        if (!currentUser || !estabelecimentoIdPrincipal) return;
        
        try {
            setLoadingData(true);
            const start = startOfDay(new Date(startDate + 'T00:00:00'));
            const end = endOfDay(new Date(endDate + 'T23:59:59'));

            let constraints = [
                where('estabelecimentoId', '==', estabelecimentoIdPrincipal),
                where('createdAt', '>=', start),
                where('createdAt', '<=', end)
            ];

            if (statusFilter !== 'todos') constraints.push(where('status', '==', statusFilter));
            if (paymentMethodFilter !== 'todos') constraints.push(where('formaPagamento', '==', paymentMethodFilter));
            if (deliveryTypeFilter !== 'todos') constraints.push(where('tipo', '==', deliveryTypeFilter));
            
            constraints.push(orderBy('createdAt', 'desc'));

            const q = query(collection(db, 'pedidos'), ...constraints);

            const querySnapshot = await getDocs(q);
            const pedidosList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                data: doc.data().createdAt.toDate(),
            }));

            console.log("📊 Pedidos carregados:", pedidosList.length);
            setPedidos(pedidosList);
            
            if (pedidosList.length === 0) {
                toast.info("ℹ️ Nenhum pedido encontrado para os filtros selecionados.");
            } else {
                toast.success(`✅ ${pedidosList.length} pedidos carregados.`);
            }
        } catch (err) {
            console.error("❌ Erro ao carregar pedidos:", err);
            toast.error("❌ Erro ao carregar pedidos.");
        } finally {
            setLoadingData(false);
        }
    };

    // Efetua a primeira busca ao carregar a página
    useEffect(() => {
        if (estabelecimentoIdPrincipal) {
            fetchPedidos();
        }
    }, [estabelecimentoIdPrincipal]);

    // Cálculos e memorização de dados
    const { summaryData, salesByDay, salesByPayment, salesByDelivery, topItems } = useMemo(() => {
        const totalPedidos = pedidos.length;
        const totalVendas = pedidos.reduce((acc, p) => acc + (p.totalFinal || 0), 0);
        const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0;
        let totalTaxasEntrega = 0;

        const salesByDay = {}, salesByPayment = {}, salesByDelivery = {}, itemsCount = {};
        
        pedidos.forEach(p => {
            const dateKey = format(p.data, 'dd/MM', { locale: ptBR });
            salesByDay[dateKey] = (salesByDay[dateKey] || 0) + (p.totalFinal || 0);

            const paymentKey = p.formaPagamento || 'Não informado';
            salesByPayment[paymentKey] = (salesByPayment[paymentKey] || 0) + (p.totalFinal || 0);
            
            const deliveryKey = p.tipo || 'Não informado';
            salesByDelivery[deliveryKey] = (salesByDelivery[deliveryKey] || 0) + 1;

            p.itens?.forEach(item => {
                itemsCount[item.nome] = (itemsCount[item.nome] || 0) + item.quantidade;
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
            topItems,
        };
    }, [pedidos]);
    
    const handleExportPDF = async () => {
        if (pedidos.length === 0) {
            toast.warn("⚠️ Não há dados para exportar.");
            return;
        }

        const input = reportContentRef.current;
        if (!input) return;
        
        toast.info("📄 Gerando PDF, por favor aguarde...");

        // Esconde botões durante a geração do PDF
        input.querySelectorAll('.no-print').forEach(btn => btn.style.visibility = 'hidden');
        
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
            input.querySelectorAll('.no-print').forEach(btn => btn.style.visibility = 'visible');
        }
    };

    const setDateRange = (start, end) => {
        setStartDate(format(start, 'yyyy-MM-dd'));
        setEndDate(format(end, 'yyyy-MM-dd'));
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 text-gray-600">Verificando permissões...</p>
                </div>
            </div>
        );
    }

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

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
            {/* Cabeçalho */}
            <header className="max-w-7xl mx-auto mb-8">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                    <div className="mb-4 lg:mb-0">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            Relatórios Avançados
                        </h1>
                        <p className="text-gray-600">
                            Análise detalhada do desempenho do seu estabelecimento
                        </p>
                        <p className="text-sm text-gray-500">
                            Estabelecimento ID: {estabelecimentoIdPrincipal}
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 no-print">
                        <Link 
                            to="/dashboard" 
                            className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-lg border border-gray-300 transition-colors"
                        >
                            <IoArrowBack />
                            <span>Voltar ao Dashboard</span>
                        </Link>
                        <button 
                            onClick={handleExportPDF} 
                            disabled={loadingData || pedidos.length === 0}
                            className="inline-flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <IoDocumentTextOutline />
                            <span>Exportar PDF</span>
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto" ref={reportContentRef}>
                {/* Painel de Filtros */}
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
                                <option value="cancelado">Cancelado</option>
                                <option value="pendente">Pendente</option>
                                <option value="preparando">Preparando</option>
                                <option value="entregue">Entregue</option>
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
                            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Entrega</label>
                            <select 
                                onChange={e => setDeliveryTypeFilter(e.target.value)} 
                                value={deliveryTypeFilter} 
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            >
                                <option value="todos">Todos</option>
                                <option value="delivery">Delivery</option>
                                <option value="retirada">Retirada</option>
                                <option value="mesa">Mesa</option>
                            </select>
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
                        
                        <button 
                            onClick={fetchPedidos} 
                            disabled={loadingData}
                            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed no-print"
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
                        {/* Cards de Estatísticas */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard 
                                title="Vendas Totais" 
                                value={summaryData.totalVendas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                subtitle={`${summaryData.totalPedidos} pedidos`}
                                icon={<IoCashOutline className="text-xl" />}
                                color="green"
                            />
                            <StatCard 
                                title="Pedidos" 
                                value={summaryData.totalPedidos}
                                subtitle="Total no período"
                                icon={<IoReceiptOutline className="text-xl" />}
                                color="blue"
                            />
                            <StatCard 
                                title="Ticket Médio" 
                                value={summaryData.ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                subtitle="Por pedido"
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
                                                Nenhum dado disponível para o período selecionado
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
                                                <span className="font-medium text-gray-900 text-sm">{name}</span>
                                            </div>
                                            <span className="font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                                {count} un.
                                            </span>
                                        </div>
                                    ))}
                                    {topItems.length === 0 && (
                                        <p className="text-center text-gray-500 py-8">
                                            Nenhum item vendido no período
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
                                            Nenhum dado disponível
                                        </div>
                                    )}
                                </div>
                            </Card>
                            
                            <Card title={
                                <>
                                    <IoPieChartOutline className="text-amber-600" />
                                    <span>Pedidos por Tipo</span>
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
                                            Nenhum dado disponível
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </div>

                        {/* Informações de Debug */}
                        {process.env.NODE_ENV === 'development' && (
                            <Card title="Informações de Debug">
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
                                        <p className="font-semibold">Pedidos Carregados</p>
                                        <p className="text-gray-600">{pedidos.length}</p>
                                    </div>
                                    <div>
                                        <p className="font-semibold">Usuário Admin</p>
                                        <p className="text-gray-600">{isAdmin ? 'Sim' : 'Não'}</p>
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

export default AdminReports;