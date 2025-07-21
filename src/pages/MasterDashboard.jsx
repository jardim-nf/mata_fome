// src/pages/MasterDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, onSnapshot, orderBy, where, Timestamp, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { format, subDays } from 'date-fns';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import ImageDisplay from '../components/ImageDisplay';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function MasterDashboard() {
    const navigate = useNavigate();
    const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();
    
    const [totalEstabelecimentos, setTotalEstabelecimentos] = useState(0);
    const [totalPedidosGerais, setTotalPedidosGerais] = useState(0);
    const [totalUsuariosCadastrados, setTotalUsuariosCadastrados] = useState(0);
    const [pedidosRecentes, setPedidosRecentes] = useState([]);
    const [ultimosPedidos, setUltimosPedidos] = useState([]);
    const [nomesEstabelecimentos, setNomesEstabelecimentos] = useState({});
    const [faturamentoLiquido, setFaturamentoLiquido] = useState(0);
    const [ticketMedio, setTicketMedio] = useState(0);
    const [loadingDashboard, setLoadingDashboard] = useState(true);
    const [dashboardError, setDashboardError] = useState('');

    useEffect(() => {
        if (authLoading) return;
        if (!isMasterAdmin) {
            toast.error('Acesso negado.');
            navigate('/');
            return;
        }

        const listeners = [];
        const fetchStaticData = async () => {
            try {
                const estabelecimentosSnapshot = await getDocs(collection(db, 'estabelecimentos'));
                const nomesMap = {};
                estabelecimentosSnapshot.forEach(doc => {
                    nomesMap[doc.id] = doc.data().nome;
                });
                setNomesEstabelecimentos(nomesMap);
            } catch (err) {
                setDashboardError("Falha ao carregar dados do dashboard.");
            }
        };

        fetchStaticData();

        listeners.push(onSnapshot(collection(db, 'estabelecimentos'), s => setTotalEstabelecimentos(s.size)));
        listeners.push(onSnapshot(collection(db, 'usuarios'), s => setTotalUsuariosCadastrados(s.size)));
        listeners.push(onSnapshot(collection(db, 'pedidos'), snapshot => {
            const allPedidos = snapshot.docs.map(doc => doc.data());
            setTotalPedidosGerais(allPedidos.length);
            let faturamento = 0, pedidosFinalizados = 0;
            allPedidos.forEach(p => {
                if (p.status === 'finalizado') {
                    faturamento += p.totalFinal || 0;
                    pedidosFinalizados++;
                }
            });
            setFaturamentoLiquido(faturamento);
            setTicketMedio(pedidosFinalizados > 0 ? faturamento / pedidosFinalizados : 0);
        }));

        const thirtyDaysAgo = Timestamp.fromDate(subDays(new Date(), 30));
        const qChart = query(collection(db, 'pedidos'), where('criadoEm', '>=', thirtyDaysAgo), orderBy('criadoEm', 'asc'));
        listeners.push(onSnapshot(qChart, s => setPedidosRecentes(s.docs.map(d => d.data()))));

        const qTable = query(collection(db, 'pedidos'), orderBy('criadoEm', 'desc'), limit(5));
        listeners.push(onSnapshot(qTable, s => setUltimosPedidos(s.docs.map(d => ({ id: d.id, ...d.data() })))));
        
        setLoadingDashboard(false);
        return () => listeners.forEach(unsub => unsub());
    }, [authLoading, isMasterAdmin, navigate]);

    const getDailyOrdersChartData = () => {
        if (!pedidosRecentes || pedidosRecentes.length === 0) return { labels: [], datasets: [] };
        const dailyCounts = {};
        pedidosRecentes.forEach(pedido => {
            const date = format(pedido.criadoEm.toDate(), 'dd/MM');
            dailyCounts[date] = (dailyCounts[date] || 0) + 1;
        });
        const labels = Object.keys(dailyCounts);
        const data = labels.map(label => dailyCounts[label]);
        return {
            labels,
            datasets: [{
                label: 'Pedidos por Dia', data,
                borderColor: 'hsl(244, 82%, 63%)', backgroundColor: 'hsla(244, 82%, 63%, 0.2)',
                fill: true, tension: 0.4,
            }],
        };
    };

    if (authLoading || loadingDashboard) {
        return <div className="flex justify-center items-center h-screen"><p>Carregando...</p></div>;
    }
    if (dashboardError) {
        return <div className="text-center p-4 text-red-600"><p>Erro: {dashboardError}</p></div>;
    }

    return (
        <div className="bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8 font-sans">
            <div className="max-w-7xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Dashboard Master</h1>
                    <p className="text-md text-slate-600 mt-1">Bem-vindo, {currentUser?.displayName || currentUser?.email}!</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                    {/* ... Seus cards de métricas clicáveis ... */}
                </div>

                {/* ▼▼▼ SEÇÃO DE FERRAMENTAS RESTAURADA E COMPLETA ▼▼▼ */}
                <div className="bg-white rounded-xl shadow-md p-6">
                    <h2 className="text-xl font-bold text-slate-800 mb-4">Ferramentas e Ações</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <Link to="/admin/cadastrar-estabelecimento" className="text-center p-4 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                            <span className="text-4xl">🏪</span>
                            <p className="mt-2 font-semibold text-slate-700">Cadastrar Estabelecimento</p>
                        </Link>
                        <Link to="/master/importar-cardapio" className="text-center p-4 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                            <span className="text-4xl">📥</span>
                            <p className="mt-2 font-semibold text-slate-700">Importar Cardápio</p>
                        </Link>
                        <Link to="/admin/cupons" className="text-center p-4 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                            <span className="text-4xl">💰</span>
                            <p className="mt-2 font-semibold text-slate-700">Gerenciar Cupons</p>
                        </Link>
                        <Link to="/admin/reports" className="text-center p-4 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
                            <span className="text-4xl">📈</span>
                            <p className="mt-2 font-semibold text-slate-700">Ver Relatórios</p>
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-md p-6">
                        <h2 className="text-xl font-bold text-slate-800 mb-4">Pedidos nos Últimos 30 Dias</h2>
                        {pedidosRecentes.length > 0 ? (
                            <div style={{height: '350px'}}>
                                <Line data={getDailyOrdersChartData()} options={{ responsive: true, maintainAspectRatio: false }} />
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-[350px] text-slate-500">
                                <p>Nenhum pedido recente para exibir no gráfico.</p>
                            </div>
                        )}
                    </div>
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h2 className="text-xl font-bold text-slate-800 mb-4">Últimos 5 Pedidos</h2>
                        <div className="space-y-4">
                            {ultimosPedidos.length > 0 ? ultimosPedidos.map(pedido => (
                                <div key={pedido.id} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-b-0">
                                    <div>
                                        <p className="font-semibold text-slate-700">{pedido.cliente?.nome || 'N/A'}</p>
                                        <p className="text-sm text-slate-500">{nomesEstabelecimentos[pedido.estabelecimentoId] || 'N/A'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-slate-800">R$ {pedido.totalFinal?.toFixed(2).replace('.', ',')}</p>
                                        <span className="text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">{pedido.status}</span>
                                    </div>
                                </div>
                            )) : <p className="text-sm text-center text-slate-500 py-8">Nenhum pedido recente.</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
    
}

export default MasterDashboard;