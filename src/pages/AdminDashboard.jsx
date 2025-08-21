// src/pages/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { format, parseISO, eachDayOfInterval } from 'date-fns';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

// --- Componentes (Header, StatCard, ActionButton) - Sem alterações ---
function DashboardHeader({ currentUser, logout }) {
    const navigate = useNavigate();
    const userEmailPrefix = currentUser?.email ? currentUser.email.split('@')[0].toUpperCase() : 'ADMIN';
    const handleLogout = async () => {
        try { await logout(); toast.success('Você foi desconectado!'); navigate('/'); } catch (error) { toast.error('Erro ao tentar sair.'); }
    };
    return (
        <header className="fixed top-0 left-0 right-0 z-20 p-4 flex justify-between items-center bg-black border-b border-gray-800 shadow-lg">
            <Link to="/" className="font-extrabold text-2xl text-white cursor-pointer hover:text-yellow-400 transition-colors">DEUFOME<span className="text-yellow-400">.</span></Link>
            <div className="flex items-center space-x-6">
                <span className="text-white font-semibold text-sm hidden sm:block">Olá, {userEmailPrefix}</span>
                <button onClick={handleLogout} className="px-5 py-2 rounded-md text-black bg-yellow-400 font-bold text-sm hover:bg-yellow-500 transition-all transform hover:scale-105">Sair</button>
            </div>
        </header>
    );
}
const StatCard = ({ title, value }) => (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center transition-all hover:border-yellow-500"><h3 className="text-gray-400 uppercase font-semibold tracking-wider text-sm mb-2">{title}</h3><p className="text-4xl font-extrabold text-white">{value}</p></div>
);
const ActionButton = ({ to, title, subtitle, icon, colorClass }) => (
    <Link to={to} className={`group relative w-full p-6 rounded-lg text-left text-white transition-all transform hover:-translate-y-1 hover:shadow-xl ${colorClass}`}><div className="flex justify-between items-center"><h3 className="text-xl font-bold">{title}</h3><span className="text-3xl opacity-80 group-hover:opacity-100 transition-opacity">{icon}</span></div><p className="opacity-90 mt-1">{subtitle}</p></Link>
);
const dateToFirestoreTimestamp = (dateString, endOfDay = false) => {
    if (!dateString) return null;
    const date = new Date(`${dateString}T00:00:00`);
    if (endOfDay) { date.setHours(23, 59, 59, 999); }
    return Timestamp.fromDate(date);
};

// --- Componente Principal ---
function AdminDashboard() {
    const { currentUser, authLoading, logout } = useAuth();
    const [totalVendas, setTotalVendas] = useState(0);
    const [faturamentoTotal, setFaturamentoTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [dashboardError, setDashboardError] = useState(null);
    const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [lineChartData, setLineChartData] = useState({ labels: [], datasets: [] });
    const [barChartData, setBarChartData] = useState({ labels: [], datasets: [] });

    useEffect(() => {
        if (authLoading || !currentUser) { setLoading(false); return; }

        const fetchData = async () => {
            let unsubscribe;
            try {
                const userDocRef = doc(db, 'usuarios', currentUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (!userDocSnap.exists() || !userDocSnap.data()?.isAdmin) throw new Error("Seu usuário não tem permissões de administrador.");
                const { estabelecimentoId } = userDocSnap.data();
                if (!estabelecimentoId) throw new Error("Administrador não vinculado a um estabelecimento.");

                const startTimestamp = dateToFirestoreTimestamp(startDate, false);
                const endTimestamp = dateToFirestoreTimestamp(endDate, true);
                if (!startTimestamp || !endTimestamp || startDate > endDate) return;

                const pedidosQuery = query(collection(db, 'pedidos'),
                    where('estabelecimentoId', '==', estabelecimentoId),
                    where('status', '==', 'finalizado'),
                    where('criadoEm', '>=', startTimestamp),
                    where('criadoEm', '<=', endTimestamp)
                );

                unsubscribe = onSnapshot(pedidosQuery, (snapshot) => {
                    const pedidos = snapshot.docs.map(doc => doc.data());
                    let faturamentoSum = 0;
                    const produtosMap = {};
                    const dailyRevenue = new Map();
                    const daysInterval = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) });
                    daysInterval.forEach(day => dailyRevenue.set(format(day, 'dd/MM'), 0));

                    pedidos.forEach((pedido) => {
                        faturamentoSum += pedido.totalFinal || 0;
                        const orderDate = format(pedido.criadoEm.toDate(), 'dd/MM');
                        if (dailyRevenue.has(orderDate)) {
                            dailyRevenue.set(orderDate, dailyRevenue.get(orderDate) + pedido.totalFinal);
                        }
                        if (Array.isArray(pedido.itens)) {
                            pedido.itens.forEach(item => {
                                produtosMap[item.nome] = (produtosMap[item.nome] || 0) + item.quantidade;
                            });
                        }
                    });
                    
                    const sortedTopProducts = Object.entries(produtosMap).sort(([, a], [, b]) => b - a).slice(0, 5);
                    setTotalVendas(snapshot.size);
                    setFaturamentoTotal(faturamentoSum);
                    setDashboardError(null);
                    setLineChartData({
                        labels: Array.from(dailyRevenue.keys()),
                        datasets: [{ label: 'Faturamento Diário (R$)', data: Array.from(dailyRevenue.values()), borderColor: '#FBBF24', backgroundColor: 'rgba(251, 191, 36, 0.2)', fill: true, tension: 0.4, }],
                    });
                    setBarChartData({
                        labels: sortedTopProducts.map(([nome]) => nome),
                        datasets: [{ label: 'Quantidade Vendida', data: sortedTopProducts.map(([, qtd]) => qtd), backgroundColor: ['#3B82F6', '#F97316', '#14B8A6', '#EC4899', '#8B5CF6'], borderColor: '#111827', borderWidth: 2, }],
                    });
                    setLoading(false);
                }, (error) => {
                    console.error("Erro no listener:", error);
                    setDashboardError("Erro ao carregar dados. Verifique o console para um link de criação de índice no Firestore.");
                    setLoading(false);
                });

            } catch (err) { setDashboardError(err.message); setLoading(false); }
            return () => { if (unsubscribe) unsubscribe(); };
        };

        const cleanupPromise = fetchData();
        return () => { cleanupPromise.then(cleanup => cleanup && cleanup()); };
    }, [currentUser, authLoading, startDate, endDate]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#D1D5DB' } } },
        scales: {
            y: { ticks: { color: '#9CA3AF' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
            x: { ticks: { color: '#9CA3AF' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
        }
    };
    
    if (authLoading) return <div className="bg-gray-100 h-screen flex items-center justify-center">Carregando...</div>;

    return (
        <div className="bg-gray-100 min-h-screen pt-24 pb-10 px-4 sm:px-6 lg:px-8 text-slate-800">
            <DashboardHeader currentUser={currentUser} logout={logout} />
            <main className="max-w-7xl mx-auto space-y-8">
                <h1 className="text-4xl font-extrabold text-slate-800 tracking-wider">Dashboard Administrativo</h1>
                {dashboardError && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert"><p className="font-bold">Ocorreu um erro</p><p>{dashboardError}</p></div>}
                
                <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
                    <h3 className="font-bold text-lg text-yellow-400 mb-4">Filtrar por Período</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Data Início:</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md focus:ring-yellow-500 focus:border-yellow-500 text-white"/></div>
                        <div><label className="block text-sm font-medium text-gray-300 mb-1">Data Fim:</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md focus:ring-yellow-500 focus:border-yellow-500 text-white"/></div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <StatCard title="Vendas Finalizadas (Período)" value={loading ? '...' : totalVendas} />
                    <StatCard title="Faturamento Total (Período)" value={loading ? '...' : `R$ ${faturamentoTotal.toFixed(2).replace('.', ',')}`} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <ActionButton to="/painel" title="Painel de Pedidos" subtitle="Gerenciar pedidos em tempo real." icon="🏪" colorClass="bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-500"/>
                    <ActionButton to="/admin/gerenciar-cardapio" title="Gerenciar Cardápio" subtitle="Adicionar e editar produtos." icon="🍔" colorClass="bg-gradient-to-br from-yellow-600 to-orange-700 hover:from-yellow-500" />
                    <ActionButton to="/admin/taxas-de-entrega" title="Taxas de Entrega" subtitle="Definir valores por bairro." icon="🛵" colorClass="bg-gradient-to-br from-cyan-500 to-teal-600 hover:from-cyan-400"/>
                    <ActionButton to="/admin/cupons" title="Gerenciar Cupons" subtitle="Criar códigos de desconto." icon="💰" colorClass="bg-gradient-to-br from-red-500 to-pink-600 hover:from-red-400" />
                    <ActionButton to="/admin/reports" title="Relatórios" subtitle="Acessar dados e estatísticas." icon="📊" colorClass="bg-gradient-to-br from-purple-600 to-indigo-700 hover:from-purple-500"/>
                </div>

                {/* --- SEÇÃO DOS GRÁFICOS MOVIDA PARA O FINAL --- */}
                {!loading && !dashboardError &&
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        <div className="lg:col-span-3 bg-gray-900 p-6 rounded-lg border border-gray-800">
                            <h3 className="text-lg font-bold text-yellow-400 mb-4">Faturamento por Dia</h3>
                            <div className="h-80"><Line options={chartOptions} data={lineChartData} /></div>
                        </div>
                        <div className="lg:col-span-2 bg-gray-900 p-6 rounded-lg border border-gray-800">
                            <h3 className="text-lg font-bold text-yellow-400 mb-4">Top 5 Produtos</h3>
                            <div className="h-80"><Bar options={chartOptions} data={barChartData} /></div>
                        </div>
                    </div>
                }
            </main>
        </div>
    );
}

export default AdminDashboard;