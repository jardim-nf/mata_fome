import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Bibliotecas para PDF e Gráficos
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement } from 'chart.js';
import { Line } from 'react-chartjs-2';

// Ícones para os botões
import { IoArrowBack, IoDocumentTextOutline } from 'react-icons/io5';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement);

const AdminReports = () => {
    const navigate = useNavigate();
    const { currentUser, isAdmin, estabelecimentoId, loading: authLoading } = useAuth();

    const [loadingData, setLoadingData] = useState(true);
    const [pedidos, setPedidos] = useState([]);

    // Estados dos filtros
    const [startDate, setStartDate] = useState(format(new Date(new Date().setMonth(new Date().getMonth() - 1)), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [statusFilter, setStatusFilter] = useState('todos');
    const [paymentMethodFilter, setPaymentMethodFilter] = useState('todos');
    const [deliveryTypeFilter, setDeliveryTypeFilter] = useState('todos');

    const reportContentRef = useRef();

    // Controle de acesso
    useEffect(() => {
        if (!authLoading && (!currentUser || !isAdmin)) {
            toast.error('Acesso negado. Faça o login como administrador.');
            navigate('/login-admin');
        }
    }, [currentUser, isAdmin, authLoading, navigate]);

    // Busca os pedidos do estabelecimento
    useEffect(() => {
        if (currentUser && estabelecimentoId) {
            const fetchPedidos = async () => {
                try {
                    setLoadingData(true);
                    
                    // Tratamento de datas corrigido para evitar problemas de fuso horário
                    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
                    const start = new Date(startYear, startMonth - 1, startDay);

                    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
                    const end = new Date(endYear, endMonth - 1, endDay);
                    
                    const startTimestamp = startOfDay(start);
                    const endTimestamp = endOfDay(end);

                    const q = query(
                        collection(db, 'pedidos'),
                        where('estabelecimentoId', '==', estabelecimentoId),
                        where('criadoEm', '>=', startTimestamp),
                        where('criadoEm', '<=', endTimestamp),
                        orderBy('criadoEm', 'desc')
                    );
                    const querySnapshot = await getDocs(q);
                    const pedidosList = querySnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                        data: doc.data().criadoEm.toDate(),
                    }));
                    setPedidos(pedidosList);
                } catch (err) {
                    console.error("Erro ao carregar pedidos:", err);
                    toast.error("Erro ao carregar os pedidos. Verifique os índices do Firestore.");
                } finally {
                    setLoadingData(false);
                }
            };
            fetchPedidos();
        }
    }, [currentUser, estabelecimentoId, startDate, endDate]);

    // Lógica de filtro combinada e à prova de falhas
    const filteredPedidos = useMemo(() => {
        return pedidos
            .filter(pedido => statusFilter === 'todos' || pedido.status === statusFilter)
            .filter(pedido => {
                // PONTO DE ATENÇÃO 1: Verifique se o nome do campo 'metodoPagamento' está correto
                return paymentMethodFilter === 'todos' || pedido.metodoPagamento === paymentMethodFilter;
            })
            .filter(pedido => {
                // PONTO DE ATENÇÃO 2: Verifique se o nome do campo 'tipoEntrega' está correto
                return deliveryTypeFilter === 'todos' || pedido.tipoEntrega === deliveryTypeFilter;
            });
    }, [pedidos, statusFilter, paymentMethodFilter, deliveryTypeFilter]);

    // Cálculos para os resumos e gráficos
    const summaryData = useMemo(() => {
        const totalPedidos = filteredPedidos.length;
        const totalVendas = filteredPedidos.reduce((acc, pedido) => acc + (pedido.totalFinal || 0), 0);
        const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0;
        return { totalPedidos, totalVendas, ticketMedio };
    }, [filteredPedidos]);

    const chartData = useMemo(() => {
        const salesByDay = {};
        filteredPedidos.forEach(pedido => {
            const dateKey = format(pedido.data, 'dd/MM/yyyy', { locale: ptBR });
            salesByDay[dateKey] = (salesByDay[dateKey] || 0) + (pedido.totalFinal || 0);
        });
        const labels = Object.keys(salesByDay).sort((a, b) => new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-')));
        const data = labels.map(label => salesByDay[label]);
        return { labels, data };
    }, [filteredPedidos]);

    // Função para exportar PDF
    const handleExportPDF = () => {
        const input = reportContentRef.current;
        if (!input) return;

        toast.info("Gerando PDF, aguarde...");

        const buttonsToHide = input.querySelectorAll('.no-print');
        buttonsToHide.forEach(btn => (btn.style.visibility = 'hidden'));

        html2canvas(input, { scale: 2, useCORS: true, backgroundColor: '#111827' })
            .then((canvas) => {
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                pdf.save(`relatorio_${startDate}_a_${endDate}.pdf`);
                toast.success("PDF gerado com sucesso!");
            })
            .catch(err => {
                console.error("Erro ao gerar PDF:", err);
                toast.error("Ocorreu um erro ao gerar o PDF.");
            })
            .finally(() => {
                buttonsToHide.forEach(btn => (btn.style.visibility = 'visible'));
            });
    };


    if (authLoading || loadingData) {
        return <div className="text-center p-8 bg-gray-900 min-h-screen text-white">Carregando relatórios...</div>;
    }

    return (
        <div className="bg-gray-900 min-h-screen p-4 sm:p-6 text-white">
            <div className="max-w-7xl mx-auto" ref={reportContentRef}>
                
                {/* Cabeçalho com Botões */}
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <h1 className="text-3xl font-bold text-amber-400">Relatórios do Estabelecimento</h1>
                    <div className="flex items-center space-x-2 no-print">
                        <Link to="/dashboard" className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                            <IoArrowBack />
                            <span>Voltar ao Dashboard</span>
                        </Link>
                        <button onClick={handleExportPDF} className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-600 text-black font-bold py-2 px-4 rounded-lg transition-colors">
                            <IoDocumentTextOutline />
                            <span>Exportar PDF</span>
                        </button>
                    </div>
                </div>

                {/* Painel de Filtros */}
                <div className="bg-gray-800 p-6 rounded-xl shadow-lg mb-8 no-print">
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-amber-400 mb-2">Filtrar por Período</h3>
                        <div className="flex flex-wrap gap-4 items-end">
                            <div>
                                <label htmlFor="startDate" className="block text-sm font-medium text-gray-300">Data de Início</label>
                                <input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 bg-gray-700 text-white block w-full rounded-md border-gray-600 shadow-sm p-2"/>
                            </div>
                            <div>
                                <label htmlFor="endDate" className="block text-sm font-medium text-gray-300">Data de Fim</label>
                                <input type="date" id="endDate" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 bg-gray-700 text-white block w-full rounded-md border-gray-600 shadow-sm p-2"/>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Filtro por Status */}
                        <div>
                            <h3 className="text-lg font-semibold text-amber-400 mb-2">Status do Pedido</h3>
                            <select onChange={(e) => setStatusFilter(e.target.value)} value={statusFilter} className="w-full bg-gray-700 text-white p-2 rounded-md border-gray-600">
                                <option value="todos">Todos</option>
                                <option value="pendente">Pendente</option>
                                <option value="preparando">Em Preparo</option>
                                <option value="pronto">Pronto/Entrega</option>
                                <option value="finalizado">Finalizado</option>
                                <option value="cancelado">Cancelado</option>
                            </select>
                        </div>
                        
                        {/* Filtro por Método de Pagamento */}
                        <div>
                            <h3 className="text-lg font-semibold text-amber-400 mb-2">Método de Pagamento</h3>
                            <select onChange={(e) => setPaymentMethodFilter(e.target.value)} value={paymentMethodFilter} className="w-full bg-gray-700 text-white p-2 rounded-md border-gray-600">
                                <option value="todos">Todos</option>
                                {/* PONTO DE ATENÇÃO 3: O valor (value="...") de cada opção deve ser idêntico ao do seu banco de dados */}
                                <option value="Cartão de Crédito">Cartão de Crédito</option>
                                <option value="Cartão de Débito">Cartão de Débito</option>
                                <option value="PIX">PIX</option>
                                <option value="Dinheiro">Dinheiro</option>
                            </select>
                        </div>

                        {/* Filtro por Tipo de Entrega */}
                        <div>
                            <h3 className="text-lg font-semibold text-amber-400 mb-2">Tipo de Entrega</h3>
                            <select onChange={(e) => setDeliveryTypeFilter(e.target.value)} value={deliveryTypeFilter} className="w-full bg-gray-700 text-white p-2 rounded-md border-gray-600">
                                <option value="todos">Todos</option>
                                {/* PONTO DE ATENÇÃO 4: O valor (value="...") de cada opção deve ser idêntico ao do seu banco de dados */}
                                <option value="Delivery">Delivery</option>
                                <option value="Retirada">Retirada</option>
                                <option value="Mesa">Mesa</option>
                                <option value="Local">Local</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Resumo */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center bg-gray-800 p-6 rounded-xl shadow-lg mb-8">
                    <div>
                        <p className="text-sm text-gray-400 uppercase tracking-wider">Total de Vendas</p>
                        <p className="text-3xl font-bold text-green-400">{summaryData.totalVendas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-400 uppercase tracking-wider">Total de Pedidos</p>
                        <p className="text-3xl font-bold text-blue-400">{summaryData.totalPedidos}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-400 uppercase tracking-wider">Ticket Médio</p>
                        <p className="text-3xl font-bold text-orange-400">{summaryData.ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                </div>
                
                {/* Gráfico */}
                {filteredPedidos.length > 0 ? (
                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg h-96">
                        <Line 
                            data={{
                                labels: chartData.labels,
                                datasets: [{
                                    label: 'Vendas por Dia (R$)',
                                    data: chartData.data,
                                    borderColor: '#FBBF24', // Amarelo
                                    backgroundColor: 'rgba(251, 191, 36, 0.2)',
                                    tension: 0.2,
                                    fill: true,
                                }]
                            }} 
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { labels: { color: 'white' } },
                                    tooltip: { titleFont: { size: 14 }, bodyFont: { size: 12 } }
                                },
                                scales: {
                                    x: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                                    y: { ticks: { color: 'white' }, grid: { color: 'rgba(255,255,255,0.1)' } }
                                }
                            }}
                        />
                    </div>
                ) : (
                    <div className="text-center text-gray-500 py-10 bg-gray-800 rounded-xl">
                        <p>Nenhum dado encontrado para os filtros selecionados.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AdminReports;