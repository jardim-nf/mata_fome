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
import { Line, Pie } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

// Ícones
import { IoArrowBack, IoDocumentTextOutline, IoSearch } from 'react-icons/io5';

// Registro dos componentes do Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement, ChartDataLabels);

// --- COMPONENTES DE UI REUTILIZÁVEIS ---

const Card = ({ title, children }) => (
    <div className="bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg">{title && <h3 className="text-xl font-semibold text-amber-400 mb-4">{title}</h3>}{children}</div>
);

const StatCard = ({ title, value, icon }) => (
    <div className="text-center">
        <p className="text-sm text-gray-400 uppercase tracking-wider">{icon} {title}</p>
        <p className="text-2xl sm:text-3xl font-bold">{value}</p>
    </div>
);

const SkeletonLoader = () => (
    <div className="animate-pulse bg-gray-700 p-6 rounded-xl shadow-lg h-32"></div>
);

// --- COMPONENTE PRINCIPAL ---

const AdminReports = () => {
    const navigate = useNavigate();
    const { currentUser, isAdmin, estabelecimentoId, loading: authLoading } = useAuth();
    const reportContentRef = useRef();

    // Estados
    const [loadingData, setLoadingData] = useState(false);
    const [pedidos, setPedidos] = useState([]);
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [statusFilter, setStatusFilter] = useState('finalizado'); // Começar com 'finalizado' é mais útil
    const [paymentMethodFilter, setPaymentMethodFilter] = useState('todos');
    const [deliveryTypeFilter, setDeliveryTypeFilter] = useState('todos');

    // OTIMIZAÇÃO: Busca de dados refatorada para usar filtros no servidor
    const fetchPedidos = async () => {
        if (!currentUser || !estabelecimentoId) return;
        
        try {
            setLoadingData(true);
            const start = startOfDay(new Date(startDate + 'T00:00:00')); // Garante fuso horário local
            const end = endOfDay(new Date(endDate + 'T23:59:59'));

            let constraints = [
                where('estabelecimentoId', '==', estabelecimentoId),
                where('createdAt', '>=', start),
                where('createdAt', '<=', end)
            ];

            // Adiciona filtros dinamicamente à consulta
            if (statusFilter !== 'todos') constraints.push(where('status', '==', statusFilter));
            if (paymentMethodFilter !== 'todos') constraints.push(where('formaPagamento', '==', paymentMethodFilter));
            if (deliveryTypeFilter !== 'todos') constraints.push(where('tipo', '==', deliveryTypeFilter));
            
            // Adiciona ordenação no final
            constraints.push(orderBy('createdAt', 'desc'));

            const q = query(collection(db, 'pedidos'), ...constraints);

            const querySnapshot = await getDocs(q);
            const pedidosList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                data: doc.data().createdAt.toDate(),
            }));

            setPedidos(pedidosList);
            if (pedidosList.length === 0) {
                toast.info("Nenhum pedido encontrado para os filtros selecionados.");
            }
        } catch (err) {
            console.error("Erro ao carregar pedidos:", err);
            toast.error("Erro ao carregar pedidos. Verifique os índices do Firestore ou o console para mais detalhes.");
        } finally {
            setLoadingData(false);
        }
    };

    // Efetua a primeira busca ao carregar a página
    useEffect(() => {
        fetchPedidos();
    }, [currentUser, estabelecimentoId]);
    
    // Controle de acesso
    useEffect(() => {
        if (!authLoading && !isAdmin) {
            toast.error('Acesso negado.');
            navigate('/login-admin');
        }
    }, [isAdmin, authLoading, navigate]);

    // --- CÁLCULOS E MEMORIZAÇÃO DE DADOS PARA OS GRÁFICOS ---

    const { summaryData, salesByDay, salesByPayment, salesByDelivery, topItems } = useMemo(() => {
        const totalPedidos = pedidos.length;
        const totalVendas = pedidos.reduce((acc, p) => acc + (p.totalFinal || 0), 0);
        const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0;

        const salesByDay = {}, salesByPayment = {}, salesByDelivery = {}, itemsCount = {};
        
        pedidos.forEach(p => {
            const dateKey = format(p.data, 'dd/MM', { locale: ptBR });
            salesByDay[dateKey] = (salesByDay[dateKey] || 0) + (p.totalFinal || 0);

            const paymentKey = p.formaPagamento || 'Não informado';
            salesByPayment[paymentKey] = (salesByPayment[paymentKey] || 0) + (p.totalFinal || 0);
            
            const deliveryKey = p.tipo || 'Não informado';
            salesByDelivery[deliveryKey] = (salesByDelivery[deliveryKey] || 0) + 1;

            p.itens.forEach(item => {
                itemsCount[item.nome] = (itemsCount[item.nome] || 0) + item.quantidade;
            });
        });
        
        const sortedLabels = Object.keys(salesByDay).sort((a, b) => new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-')));
        
        const topItems = Object.entries(itemsCount)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        return {
            summaryData: { totalPedidos, totalVendas, ticketMedio },
            salesByDay: { labels: sortedLabels, data: sortedLabels.map(l => salesByDay[l]) },
            salesByPayment: { labels: Object.keys(salesByPayment), data: Object.values(salesByPayment) },
            salesByDelivery: { labels: Object.keys(salesByDelivery), data: Object.values(salesByDelivery) },
            topItems,
        };
    }, [pedidos]);
    
    const handleExportPDF = async () => {
        const input = reportContentRef.current;
        if (!input) return;
        toast.info("Gerando PDF, por favor aguarde...");

        // Esconder botões
        input.querySelectorAll('.no-print').forEach(btn => btn.style.visibility = 'hidden');
        
        const canvas = await html2canvas(input, { scale: 2, useCORS: true, backgroundColor: '#111827' });
        const imgData = canvas.toDataURL('image/png');
        
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.setFontSize(16);
        pdf.setTextColor('#FBBF24');
        pdf.text('Relatório de Vendas', pdfWidth / 2, 15, { align: 'center' });
        pdf.setFontSize(10);
        pdf.setTextColor('#FFFFFF');
        pdf.text(`Período: ${format(new Date(startDate + 'T00:00:00'), 'dd/MM/yyyy')} a ${format(new Date(endDate + 'T00:00:00'), 'dd/MM/yyyy')}`, pdfWidth / 2, 22, { align: 'center' });

        pdf.addImage(imgData, 'PNG', 0, 30, pdfWidth, pdfHeight);
        pdf.save(`relatorio_${startDate}_a_${endDate}.pdf`);
        
        toast.success("PDF gerado com sucesso!");
        input.querySelectorAll('.no-print').forEach(btn => btn.style.visibility = 'visible');
    };

    const setDateRange = (start, end) => {
        setStartDate(format(start, 'yyyy-MM-dd'));
        setEndDate(format(end, 'yyyy-MM-dd'));
    };

    if (authLoading) {
        return <div className="text-center p-8 bg-gray-900 min-h-screen text-white">Verificando permissões...</div>;
    }

    const pieOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', labels: { color: 'white', boxWidth: 12, padding: 15 } },
            datalabels: {
                formatter: (value, ctx) => {
                    const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                    const percentage = total > 0 ? (value / total * 100).toFixed(1) + '%' : '0%';
                    return percentage;
                },
                color: '#fff',
                font: { weight: 'bold', size: 12 }
            }
        }
    };

    return (
        <div className="bg-gray-900 min-h-screen p-2 sm:p-6 text-white">
            {/* Cabeçalho Fixo */}
            <header className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 px-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-amber-400">Relatórios Avançados</h1>
                <div className="flex items-center space-x-2 no-print">
                    <Link to="/dashboard" className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 py-2 px-4 rounded-lg transition-colors"><IoArrowBack /><span>Dashboard</span></Link>
                    <button onClick={handleExportPDF} disabled={loadingData} className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-600 text-black font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"><IoDocumentTextOutline /><span>Exportar PDF</span></button>
                </div>
            </header>

            {/* Painel de Filtros */}
            <Card title="Filtros">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div><label className="block text-sm text-gray-300">Data Início</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 bg-gray-700 w-full p-2 rounded-md"/></div>
                    <div><label className="block text-sm text-gray-300">Data Fim</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 bg-gray-700 w-full p-2 rounded-md"/></div>
                    <div><label className="block text-sm text-gray-300">Status</label><select onChange={e => setStatusFilter(e.target.value)} value={statusFilter} className="mt-1 w-full bg-gray-700 p-2 rounded-md"><option value="todos">Todos</option><option value="finalizado">Finalizado</option><option value="cancelado">Cancelado</option></select></div>
                    <div><label className="block text-sm text-gray-300">Pagamento</label><select onChange={e => setPaymentMethodFilter(e.target.value)} value={paymentMethodFilter} className="mt-1 w-full bg-gray-700 p-2 rounded-md"><option value="todos">Todos</option><option value="PIX">PIX</option><option value="Cartão de Crédito">Crédito</option><option value="Cartão de Débito">Débito</option><option value="Dinheiro">Dinheiro</option></select></div>
                    <div><label className="block text-sm text-gray-300">Tipo</label><select onChange={e => setDeliveryTypeFilter(e.target.value)} value={deliveryTypeFilter} className="mt-1 w-full bg-gray-700 p-2 rounded-md"><option value="todos">Todos</option><option value="delivery">Delivery</option><option value="retirada">Retirada</option><option value="mesa">Mesa</option></select></div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                    <button onClick={() => setDateRange(new Date(), new Date())} className="bg-gray-600 px-3 py-1 text-xs rounded-full hover:bg-amber-500">Hoje</button>
                    <button onClick={() => setDateRange(subDays(new Date(), 6), new Date())} className="bg-gray-600 px-3 py-1 text-xs rounded-full hover:bg-amber-500">Últimos 7 dias</button>
                    <button onClick={() => setDateRange(subDays(new Date(), 29), new Date())} className="bg-gray-600 px-3 py-1 text-xs rounded-full hover:bg-amber-500">Últimos 30 dias</button>
                    <button onClick={fetchPedidos} disabled={loadingData} className="ml-auto flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait"><IoSearch /><span>{loadingData ? 'Buscando...' : 'Aplicar Filtros'}</span></button>
                </div>
            </Card>

            <div className="max-w-7xl mx-auto mt-8" ref={reportContentRef}>
                 {loadingData ? (
                    <div className="space-y-8">
                        <SkeletonLoader />
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"><SkeletonLoader /><SkeletonLoader /><SkeletonLoader /></div>
                        <SkeletonLoader />
                    </div>
                ) : (
                    <div className="space-y-8">
                        <Card><div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-amber-400">
                            <StatCard title="Vendas Totais" value={summaryData.totalVendas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon="💰" />
                            <StatCard title="Pedidos" value={summaryData.totalPedidos} icon="🧾" />
                            <StatCard title="Ticket Médio" value={summaryData.ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon="📊" />
                        </div></Card>
                        
                        <div className="grid lg:grid-cols-5 gap-6">
                            <div className="lg:col-span-3"><Card title="Vendas por Dia"><div className="h-80"><Line data={{ labels: salesByDay.labels, datasets: [{ label: 'Vendas (R$)', data: salesByDay.data, borderColor: '#FBBF24', backgroundColor: 'rgba(251, 191, 36, 0.2)', tension: 0.2, fill: true }] }} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { ticks: { color: 'white' } }, y: { ticks: { color: 'white' } } }, plugins: { legend: { display: false } } }} /></div></Card></div>
                            <div className="lg:col-span-2"><Card title="Itens Mais Vendidos"><ul className="space-y-2">{topItems.map(([name, count]) => <li key={name} className="flex justify-between items-center text-sm p-2 bg-gray-700 rounded-md"><span>{name}</span><span className="font-bold text-amber-400">{count} un.</span></li>)}</ul></Card></div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <Card title="Vendas por Pagamento"><div className="h-80"><Pie data={{ labels: salesByPayment.labels, datasets: [{ data: salesByPayment.data, backgroundColor: ['#34D399', '#60A5FA', '#FBBF24', '#F87171', '#A78BFA'] }] }} options={pieOptions} /></div></Card>
                            <Card title="Pedidos por Tipo"><div className="h-80"><Pie data={{ labels: salesByDelivery.labels, datasets: [{ data: salesByDelivery.data, backgroundColor: ['#60A5FA', '#A78BFA', '#34D399', '#FBBF24', '#F87171'] }] }} options={pieOptions} /></div></Card>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AdminReports;