// src/pages/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const getTodayFormattedDate = () => new Date().toISOString().split('T')[0];

// Função auxiliar para converter string de data (YYYY-MM-DD) para Timestamp do Firestore
const dateToFirestoreTimestamp = (dateString, endOfDay = false) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (endOfDay) {
        date.setHours(23, 59, 59, 999);
    } else {
        date.setHours(0, 0, 0, 0);
    }
    return Timestamp.fromDate(date);
};

function AdminDashboard() {
    const { currentUser, authLoading } = useAuth();

    const [totalVendas, setTotalVendas] = useState(0);
    const [faturamentoTotal, setFaturamentoTotal] = useState(0);
    const [topSellingProducts, setTopSellingProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dashboardError, setDashboardError] = useState(null);
    const [startDate, setStartDate] = useState(getTodayFormattedDate());
    const [endDate, setEndDate] = useState(getTodayFormattedDate());
    const [showPeriodFilter, setShowPeriodFilter] = useState(false); // Mantido para controle de visibilidade da UI

    useEffect(() => {
        if (authLoading) return;
        if (!currentUser) {
            setDashboardError("Você precisa estar logado.");
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const userDocRef = doc(db, 'usuarios', currentUser.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (!userDocSnap.exists() || !userDocSnap.data()?.isAdmin) {
                    throw new Error("Seu usuário não tem permissões de administrador.");
                }

                const { estabelecimentoId } = userDocSnap.data();
                if (!estabelecimentoId) {
                    throw new Error("Administrador não vinculado a um estabelecimento.");
                }
                
                // Converter as datas para Timestamps do Firestore
                const startTimestamp = dateToFirestoreTimestamp(startDate, false);
                const endTimestamp = dateToFirestoreTimestamp(endDate, true);

                let pedidosQuery = query(
                    collection(db, 'pedidos'),
                    where('estabelecimentoId', '==', estabelecimentoId),
                    where('status', '==', 'finalizado'),
                    orderBy('criadoEm', 'desc')
                );

                // Adicionar filtros de período se as datas forem válidas
                if (startTimestamp && endTimestamp) {
                    pedidosQuery = query(
                        collection(db, 'pedidos'),
                        where('estabelecimentoId', '==', estabelecimentoId),
                        where('status', '==', 'finalizado'),
                        where('criadoEm', '>=', startTimestamp),
                        where('criadoEm', '<=', endTimestamp),
                        orderBy('criadoEm', 'desc')
                    );
                }
                
                const unsubscribe = onSnapshot(pedidosQuery, (snapshot) => {
                    let vendasCount = 0;
                    let faturamentoSum = 0;
                    const produtosMap = {};

                    snapshot.forEach((doc) => {
                        const pedido = doc.data();
                        vendasCount++;
                        faturamentoSum += pedido.totalFinal || 0;
                        if (Array.isArray(pedido.itens)) {
                           pedido.itens.forEach(item => {
                               produtosMap[item.nome] = (produtosMap[item.nome] || 0) + item.quantidade;
                           });
                        }
                    });

                    const sortedTopProducts = Object.entries(produtosMap)
                        .sort(([, a], [, b]) => b - a).slice(0, 5)
                        .map(([nome, quantidade]) => ({ nome, quantidade }));

                    setTotalVendas(vendasCount);
                    setFaturamentoTotal(faturamentoSum);
                    setTopSellingProducts(sortedTopProducts);
                    setLoading(false);
                }, (error) => {
                    console.error("Erro no listener:", error);
                    setDashboardError("Erro ao carregar dados. Verifique suas permissões.");
                    setLoading(false);
                });
                
                return unsubscribe;
            } catch (err) {
                setDashboardError(err.message);
                setLoading(false);
            }
        };

        const unsubPromise = fetchData();
        return () => {
            unsubPromise.then(unsub => unsub && unsub());
        };
    }, [currentUser, authLoading, startDate, endDate]); // Dependências para re-executar ao mudar datas

    if (loading || authLoading) {
        return <div className="text-center p-8">Carregando Dashboard...</div>;
    }

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <div className="max-w-5xl mx-auto">
                <h1 className="text-3xl font-bold text-center text-slate-800 mb-8">
                    Dashboard Administrativo
                </h1>
                
                {dashboardError ? (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 text-center">
                        <p className="font-bold">Erro ao carregar dados</p>
                        <p>{dashboardError}</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Seção de Filtro de Período (NOVO) */}
                        <div className="bg-white p-6 rounded-xl shadow-sm">
                            <h2 className="text-xl font-bold text-slate-700 mb-4">Filtrar por Período</h2>
                            <div className="flex flex-col sm:flex-row gap-4 items-center">
                                <label className="flex flex-col flex-grow w-full sm:w-auto">
                                    <span className="text-sm font-medium text-slate-600 mb-1">Data Início:</span>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </label>
                                <label className="flex flex-col flex-grow w-full sm:w-auto">
                                    <span className="text-sm font-medium text-slate-600 mb-1">Data Fim:</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </label>
                                {/* O botão showPeriodFilter é mais para UX se você quiser esconder/mostrar os inputs */}
                                {/* <button
                                    onClick={() => setShowPeriodFilter(!showPeriodFilter)}
                                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition"
                                >
                                    {showPeriodFilter ? 'Esconder Filtros' : 'Mostrar Filtros'}
                                </button> */}
                            </div>
                        </div>

                        {/* Seção de Métricas Principais */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500">
                                <h2 className="text-lg font-semibold text-slate-600">Vendas Finalizadas (Período)</h2>
                                <p className="text-4xl font-extrabold text-slate-800">{totalVendas}</p>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500">
                                <h2 className="text-lg font-semibold text-slate-600">Faturamento Total (Período)</h2>
                                <p className="text-4xl font-extrabold text-slate-800">R$ {faturamentoTotal.toFixed(2).replace('.', ',')}</p>
                            </div>
                        </div>

                        {/* Seção de Atalhos e Ações */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            <Link to="/painel" className="bg-indigo-500 text-white p-6 rounded-xl flex flex-col justify-center items-center text-center transform hover:-translate-y-1 transition">
                                <h2 className="text-xl font-bold">Painel de Pedidos 📋</h2>
                                <p className="mt-1 text-sm opacity-90">Gerenciar pedidos em tempo real.</p>
                            </Link>
                            <Link to="/admin/gerenciar-cardapio" className="bg-amber-500 text-white p-6 rounded-xl flex flex-col justify-center items-center text-center transform hover:-translate-y-1 transition">
                                <h2 className="text-xl font-bold">Gerenciar Cardápio 🍔</h2>
                                <p className="mt-1 text-sm opacity-90">Adicionar e editar produtos.</p>
                            </Link>
                            <Link to="/admin/taxas-de-entrega" className="bg-sky-500 text-white p-6 rounded-xl flex flex-col justify-center items-center text-center transform hover:-translate-y-1 transition">
                                <h2 className="text-xl font-bold">Taxas de Entrega 💲</h2>
                                <p className="mt-1 text-sm opacity-90">Definir valores por bairro.</p>
                            </Link>
                            <Link to="/admin/cupons" className="bg-rose-500 text-white p-6 rounded-xl flex flex-col justify-center items-center text-center transform hover:-translate-y-1 transition">
                                <h2 className="text-xl font-bold">Gerenciar Cupons 💰</h2>
                                <p className="mt-1 text-sm opacity-90">Criar códigos de desconto.</p>
                            </Link>
                            {/* NOVO: Link para a página de Relatórios */}
                            <Link to="/admin/reports" className="bg-purple-500 text-white p-6 rounded-xl flex flex-col justify-center items-center text-center transform hover:-translate-y-1 transition">
                                <h2 className="text-xl font-bold">Relatórios 📊</h2>
                                <p className="mt-1 text-sm opacity-90">Acessar dados e estatísticas.</p>
                            </Link>
                        </div>
                        
                        {/* Seção de Produtos Mais Vendidos */}
                        {topSellingProducts.length > 0 && (
                             <div className="bg-white p-6 rounded-xl shadow-sm">
                                <h2 className="text-2xl font-bold text-slate-700 mb-4 text-center">Produtos Mais Vendidos</h2>
                                <ul className="space-y-3">
                                    {topSellingProducts.map((p, i) => (
                                        <li key={i} className="flex justify-between p-3 bg-slate-50 rounded-md">
                                            <span className="font-medium text-slate-800">{i + 1}. {p.nome}</span>
                                            <span className="font-bold text-indigo-600">{p.quantidade} un.</span>
                                        </li>
                                    ))}
                                </ul>
                             </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default AdminDashboard;