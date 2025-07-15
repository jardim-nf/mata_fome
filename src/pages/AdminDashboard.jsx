// src/pages/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

// Função auxiliar para formatar a data de hoje no formato 'YYYY-MM-DD'
const getTodayFormattedDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

    const [showPeriodFilter, setShowPeriodFilter] = useState(false);

    useEffect(() => {
        // 1. Espera o contexto de autenticação carregar
        if (authLoading) {
            setLoading(true);
            setDashboardError(null);
            return;
        }

        // 2. Se não há usuário logado, exibe erro e para
        if (!currentUser) {
            setDashboardError("Você precisa estar logado para acessar o dashboard administrativo.");
            setLoading(false);
            return;
        }

        // 3. Verifica o papel do usuário no Firestore
        const checkAdminStatusAndFetchData = async () => {
            try {
                setLoading(true);
                setDashboardError(null);

                const userDocRef = doc(db, 'usuarios', currentUser.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (!userDocSnap.exists() || !userDocSnap.data()?.isAdmin) {
                    setDashboardError("Seu usuário não tem permissões de administrador para acessar este painel.");
                    setLoading(false);
                    return;
                }

                // --- SE CHEGOU ATÉ AQUI, O USUÁRIO ESTÁ LOGADO E É UM ADMIN ---
                console.log("AdminDashboard: Usuário logado e verificado como admin. Iniciando busca de dados.");

                let pedidosQueryRef = collection(db, 'pedidos');
                let q = query(
                    pedidosQueryRef,
                    where('status', '==', 'finalizado'),
                    orderBy('criadoEm', 'desc')
                );

                if (startDate) {
                    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
                    const startOfDay = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
                    const startTimestamp = Timestamp.fromDate(startOfDay);
                    q = query(q, where('criadoEm', '>=', startTimestamp));
                }
                if (endDate) {
                    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
                    const endOfDay = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
                    const endTimestamp = Timestamp.fromDate(endOfDay);
                    q = query(q, where('criadoEm', '<=', endTimestamp));
                }

                const unsubscribe = onSnapshot(q, (snapshot) => {
                    console.log("AdminDashboard: onSnapshot recebeu dados.");
                    let vendasCount = 0;
                    let faturamentoSum = 0;
                    const produtosVendidosMap = {};

                    snapshot.forEach((doc) => {
                        const pedido = doc.data();
                        if (pedido.itens && Array.isArray(pedido.itens)) {
                            vendasCount++;

                            const totalDoPedido = pedido.itens.reduce((acc, itemIndividual) => {
                                const itemPrecoNumerico = Number(itemIndividual.preco);
                                const itemQuantidadeNumerica = Number(itemIndividual.quantidade);

                                if (!isNaN(itemPrecoNumerico) && !isNaN(itemQuantidadeNumerica)) {
                                    produtosVendidosMap[itemIndividual.nome] =
                                        (produtosVendidosMap[itemIndividual.nome] || 0) + itemQuantidadeNumerica;

                                    return acc + (itemPrecoNumerico * itemQuantidadeNumerica);
                                }
                                return acc;
                            }, 0);
                            faturamentoSum += totalDoPedido;
                        }
                    });

                    const sortedTopSellingProducts = Object.keys(produtosVendidosMap)
                        .map(nome => ({ nome, quantidade: produtosVendidosMap[nome] }))
                        .sort((a, b) => b.quantidade - a.quantidade)
                        .slice(0, 5);

                    setTotalVendas(vendasCount);
                    setFaturamentoTotal(faturamentoSum);
                    setTopSellingProducts(sortedTopSellingProducts);
                    setLoading(false);
                    console.log("AdminDashboard: Dados carregados, loading set to false.");
                }, (error) => {
                    console.error("AdminDashboard: Erro ao carregar dados do dashboard:", error);
                    setDashboardError("Erro ao carregar dados. Verifique suas permissões ou conexão.");
                    setLoading(false);
                });

                return () => {
                    unsubscribe();
                    console.log("AdminDashboard: useEffect desmontado. Listener do Firestore desinscrito.");
                };

            } catch (err) {
                console.error("AdminDashboard: Erro na verificação de admin ou na busca inicial:", err);
                if (err.code === 'permission-denied') {
                    setDashboardError("Permissão negada. Verifique suas regras do Firebase ou se o usuário tem privilégios de admin.");
                } else {
                    setDashboardError("Não foi possível verificar seu status de administrador ou carregar dados iniciais.");
                }
                setLoading(false);
            }
        };

        checkAdminStatusAndFetchData();

    }, [currentUser, authLoading, startDate, endDate]);

    const handleApplyFilter = () => {
        // Ao clicar em 'Aplicar Filtro', o useEffect já será acionado pela mudança de startDate/endDate.
    };

    return (
        <div className="min-h-screen bg-[var(--bege-claro)] p-6">
            <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-8">
                <h1 className="text-3xl font-bold text-center text-[var(--vermelho-principal)] mb-8">
                    Dashboard Administrativo
                </h1>

                {/* Botão para mostrar/esconder o filtro de período */}
                <div className="text-center mb-6">
                    <button
                        onClick={() => setShowPeriodFilter(!showPeriodFilter)}
                        className="bg-gray-200 text-[var(--marrom-escuro)] px-6 py-2 rounded-lg font-semibold hover:bg-gray-300 transition duration-300"
                    >
                        {showPeriodFilter ? 'Esconder Filtro de Período' : 'Filtrar por Período Específico'}
                    </button>
                </div>

                {/* Seção de Filtro por Período (condicionalmente visível) */}
                {showPeriodFilter && (
                    <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200 flex flex-col sm:flex-row items-center justify-center gap-4">
                        <label htmlFor="startDate" className="text-[var(--marrom-escuro)] font-medium">De:</label>
                        <input
                            type="date"
                            id="startDate"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
                        />

                        <label htmlFor="endDate" className="text-[var(--marrom-escuro)] font-medium">Até:</label>
                        <input
                            type="date"
                            id="endDate"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
                        />

                        <button
                            onClick={handleApplyFilter}
                            className="bg-[var(--vermelho-principal)] px-5 py-2 rounded-lg font-semibold hover:bg-red-700 transition duration-300"
                        >
                            Aplicar Filtro
                        </button>
                    </div>
                )}


                {/* Renderização Condicional do Dashboard */}
                {loading ? (
                    <p className="text-center text-[var(--cinza-texto)] text-lg mt-8">Carregando dados...</p>
                ) : dashboardError ? (
                    <p className="text-center text-red-500 text-lg mt-8">{dashboardError}</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                        {/* Card de Vendas Finalizadas */}
                        <div className="bg-blue-50 p-6 rounded-lg shadow-md border border-blue-200">
                            <h2 className="text-xl font-semibold text-blue-800 mb-2">Vendas Finalizadas</h2>
                            <p className="text-5xl font-extrabold text-blue-600">{totalVendas}</p>
                            <p className="text-gray-600 mt-2">Pedidos concluídos com sucesso.</p>
                        </div>

                        {/* Card de Faturamento Total */}
                        <div className="bg-green-50 p-6 rounded-lg shadow-md border border-green-200">
                            <h2 className="text-xl font-semibold text-green-800 mb-2">Faturamento Total</h2>
                            <p className="text-5xl font-extrabold text-green-600">R$ {faturamentoTotal.toFixed(2)}</p>
                            <p className="text-gray-600 mt-2">Receita total dos pedidos finalizados.</p>
                        </div>

                        {/* Botão/Card: PAINEL DE PEDIDOS */}
                        <Link
                            to={`/painel?startDate=${getTodayFormattedDate()}&endDate=${getTodayFormattedDate()}`}
                            className="bg-red-300 p-6 rounded-lg shadow-md border border-red-200 flex flex-col justify-between items-center text-center transform transition duration-300 hover:scale-105 hover:shadow-lg"
                            style={{ minHeight: '180px' }}
                        >
                            <h2 className="text-xl font-semibold mb-2">Painel de Pedidos</h2>
                            <p className="text-5xl font-extrabold">📋</p>
                            <p className="text-opacity-90 mt-2">Gerenciar todos os pedidos.</p>
                        </Link>

                        {/* Nova Seção: Gerenciar Cardápio */}
                        <Link
                            to="/admin/gerenciar-cardapio"
                            className="bg-yellow-500 p-6 rounded-lg shadow-md border border-yellow-200 flex flex-col justify-between items-center text-center transform transition duration-300 hover:scale-105 hover:shadow-lg"
                            style={{ minHeight: '180px' }}
                        >
                            <h2 className="text-whitetext-xl font-semibold  mb-2">Gerenciar Cardápio</h2>
                            <p className="text-5xl font-extrabold ">🍔</p>
                            <p className="text-opacity-90 mt-2">Adicionar e editar itens do menu.</p>
                        </Link>

                        {/* NOVO BOTÃO: Gerenciar Taxas de Entrega */}
                        <Link
                            to="/admin/taxas-de-entrega"
                            className="bg-blue-600 p-6 rounded-lg shadow-md border border-blue-200 flex flex-col justify-between items-center text-center transform transition duration-300 hover:scale-105 hover:shadow-lg"
                            style={{ minHeight: '180px' }}
                        >
                            <h2 className="text-xl font-semibold text-white mb-2">Gerenciar Taxas de Entrega</h2>
                            <p className="text-5xl font-extrabold text-white ">💲</p>
                            <p className=" text-opacity-90 mt-2 text-white">Definir valores de entrega por bairro.</p>
                        </Link>

                        <Link to="/admin/cupons" className="bg-green-700 p-6 rounded-lg shadow-md border  flex flex-col justify-between items-center text-center transform transition duration-300 text-white hover:scale-105 hover:shadow-lg">

                            <h3 className="text-white text-xl font-semibold text-gray-800">Gerenciar Cupons</h3>
                            <span className="text-4xl mb-2">💰</span>
                            <p className="text-white text-gray-600 text-sm">Crie e edite códigos de desconto.</p>
                        </Link>
                        <Link
                            to="/admin/reports"
                            className="bg-blue-400 p-6 rounded-lg shadow-md border border-blue-200 flex flex-col justify-between items-center text-center transform transition duration-300 hover:scale-105 hover:shadow-lg"
                            style={{ minHeight: '180px' }}
                        >
                            <h2 className="text-xl font-semibold text-white mb-2">Relatórios Avançados</h2>
                            <p className="text-5xl font-extrabold text-white ">📈</p>
                            <p className="text-opacity-90 mt-2 text-white">Análise de dados de vendas e cupons.</p>
                        </Link>
                    </div>
                )}

                {loading || dashboardError ? null : topSellingProducts.length > 0 ? (
                    <div className="mt-8 bg-white p-6 rounded-lg shadow-xl border border-gray-200">
                        <h2 className="text-2xl font-bold text-[var(--marrom-escuro)] mb-6 text-center">Produtos Mais Vendidos</h2>
                        <ul className="space-y-3">
                            {topSellingProducts.map((product, index) => (
                                <li key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-md border border-gray-100">
                                    <span className="text-lg font-medium text-[var(--marrom-escuro)]">{index + 1}. {product.nome}</span>
                                    <span className="text-lg font-bold text-[var(--verde-destaque)]">{product.quantidade} un.</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <p className="text-center text-[var(--cinza-texto)] italic mt-8">Nenhum produto vendido no período selecionado.</p>
                )}
            </div>
        </div>
    );
}

export default AdminDashboard;