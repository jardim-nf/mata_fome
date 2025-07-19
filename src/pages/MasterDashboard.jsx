// src/pages/MasterDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, onSnapshot, orderBy, where, Timestamp, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { format, subDays } from 'date-fns'; // Importe subDays para calcular datas

// Importar componentes e elementos do Chart.js
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

// Registrar os componentes necessários do Chart.js
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function MasterDashboard() {
    const navigate = useNavigate();
    const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();
    
    const [totalEstabelecimentos, setTotalEstabelecimentos] = useState(0);
    const [totalPedidosGerais, setTotalPedidosGerais] = useState(0);
    const [totalUsuariosCadastrados, setTotalUsuariosCadastrados] = useState(0);
    const [pedidosRecentes, setPedidosRecentes] = useState([]); // Dados para o gráfico
    const [ultimosPedidos, setUltimosPedidos] = useState([]); // para a lista dos últimos pedidos
    const [nomesEstabelecimentos, setNomesEstabelecimentos] = useState({}); // Mapeamento ID -> Nome Estab.
    const [faturamentoLiquido, setFaturamentoLiquido] = useState(0);
    const [ticketMedio, setTicketMedio] = useState(0);

    // NOVOS ESTADOS PARA ALERTAS
    const [alertas, setAlertas] = useState([]);

    const [loadingDashboard, setLoadingDashboard] = useState(true);
    const [dashboardError, setDashboardError] = useState('');

    useEffect(() => {
        // Log para depuração para ver os valores imediatamente
        console.log("MasterDashboard useEffect: authLoading=", authLoading, "isMasterAdmin=", isMasterAdmin, "currentUser=", currentUser);

        if (authLoading) {
            // Ainda carregando autenticação, não faça nada ainda
            return;
        }

        if (!currentUser || !isMasterAdmin) {
            toast.error('Acesso negado. Você precisa ser o Administrador Master para acessar esta página.');
            navigate('/');
            setLoadingDashboard(false);
            return; // Interrompe a execução do useEffect se não for Master Admin
        }

        // Se chegou aqui, é porque authLoading é false, currentUser existe e isMasterAdmin é true.
        setLoadingDashboard(true); // Começa o carregamento do dashboard
        setDashboardError(''); // Limpa erros anteriores

        const unsubscribes = []; // Array para armazenar todas as funções de unsubscribe

        // --- Carregar Nomes dos Estabelecimentos (necessário para 'ultimosPedidos' e alertas de inativos) ---
        // Esta função não precisa de onSnapshot porque os nomes não mudam com frequência.
        // E ela *precisa* rodar primeiro para ter os nomes disponíveis.
        const fetchNomesEstabelecimentos = async () => {
            try {
                const estabelecimentosSnapshot = await getDocs(collection(db, 'estabelecimentos'));
                const nomesMap = {};
                const estabsData = []; // Para detectar inativos
                estabelecimentosSnapshot.forEach(doc => {
                    nomesMap[doc.id] = doc.data().nome;
                    estabsData.push({ id: doc.id, ...doc.data() });
                });
                setNomesEstabelecimentos(nomesMap);

                // NOVO ALERTA 1: Estabelecimentos Inativos/Bloqueados
                const inativos = estabsData.filter(e => e.ativo === false);
                if (inativos.length > 0) {
                    setAlertas(prev => {
                        const existingAlert = prev.find(a => a.id === 'inactive-establishments');
                        if (!existingAlert) {
                            return [...prev, {
                                id: 'inactive-establishments',
                                type: 'warning',
                                message: `ATENÇÃO: ${inativos.length} estabelecimento(s) está(ão) INATIVO(S)! Verifique em Gerenciar Estabelecimentos.`,
                                link: '/master/estabelecimentos'
                            }];
                        }
                        return prev;
                    });
                } else {
                    setAlertas(prev => prev.filter(a => a.id !== 'inactive-establishments'));
                }
            } catch (err) {
                console.error("Erro ao carregar nomes dos estabelecimentos:", err);
                toast.error("Erro ao carregar nomes dos estabelecimentos.");
            }
        };
        fetchNomesEstabelecimentos(); // Chama a função para buscar os nomes

        // --- Listeners para dados em tempo real (métricas principais) ---
        // Envolvendo cada listener individualmente para depurar melhor
        // E garantir que 'isMasterAdmin' foi validado antes de tentar o listen
        
        // Listener de Estabelecimentos (allow read: if true; então deve funcionar sempre)
        unsubscribes.push(onSnapshot(collection(db, 'estabelecimentos'), (snapshot) => {
            setTotalEstabelecimentos(snapshot.size);
        }, (error) => console.error("Erro no listener de estabelecimentos:", error)));

        // Listener de Pedidos
        unsubscribes.push(onSnapshot(collection(db, 'pedidos'), (snapshot) => { // Linha 138 original
            const allPedidos = snapshot.docs.map(doc => doc.data());
            setTotalPedidosGerais(allPedidos.length);
            
            let faturamentoBrutoCalc = 0;
            let pedidosFinalizadosCount = 0;
            let pedidosRecebidosCount = 0;
            let pedidosEmPreparoCount = 0;

            allPedidos.forEach(pedido => {
                if (pedido.status === 'finalizado') {
                    faturamentoBrutoCalc += pedido.totalFinal || 0;
                    pedidosFinalizadosCount++;
                }
                if (pedido.status === 'recebido') {
                    pedidosRecebidosCount++;
                }
                if (pedido.status === 'preparo') {
                    pedidosEmPreparoCount++;
                }
            });

            setFaturamentoLiquido(faturamentoBrutoCalc);
            if (pedidosFinalizadosCount > 0) {
                setTicketMedio(faturamentoBrutoCalc / pedidosFinalizadosCount);
            } else {
                setTicketMedio(0);
            }

            // NOVO ALERTA 2: Muitos Pedidos Recebidos/Em Preparo
            const highVolumeThreshold = 5;
            if (pedidosRecebidosCount >= highVolumeThreshold || pedidosEmPreparoCount >= highVolumeThreshold) {
                setAlertas(prev => {
                    const existingAlert = prev.find(a => a.id === 'high-volume-orders');
                    if (!existingAlert) {
                        return [...prev, {
                            id: 'high-volume-orders',
                            type: 'info',
                            message: `ALERTA: Há ${pedidosRecebidosCount} pedidos recebidos e ${pedidosEmPreparoCount} em preparo. Alto volume!`,
                            link: '/master/pedidos'
                        }];
                    }
                    return prev;
                });
            } else {
                setAlertas(prev => prev.filter(a => a.id !== 'high-volume-orders'));
            }
        }, (error) => console.error("Erro no listener de pedidos (total):", error)));

        // Listener de Usuários
        unsubscribes.push(onSnapshot(collection(db, 'usuarios'), (snapshot) => { // Linha 139 original
            setTotalUsuariosCadastrados(snapshot.size);

            // NOVO ALERTA 3: Novos Usuários nos Últimos X Dias
            const sevenDaysAgo = subDays(new Date(), 7);
            const newUsersCount = snapshot.docs.filter(doc => {
                const userData = doc.data();
                return userData.criadoEm && userData.criadoEm.toDate() >= sevenDaysAgo;
            }).length;

            if (newUsersCount > 0) {
                setAlertas(prev => {
                    const existingAlert = prev.find(a => a.id === 'new-users-alert');
                    if (!existingAlert) {
                        return [...prev, {
                            id: 'new-users-alert',
                            type: 'success',
                            message: `SUCESSO: ${newUsersCount} novos usuários cadastrados nos últimos 7 dias!`,
                            link: '/master/usuarios'
                        }];
                    }
                    return prev;
                });
            } else {
                setAlertas(prev => prev.filter(a => a.id !== 'new-users-alert'));
            }
        }, (error) => console.error("Erro no listener de usuários:", error)));

        // Listener para Pedidos Recentes (para o gráfico)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const qPedidosRecentes = query(
            collection(db, 'pedidos'),
            where('criadoEm', '>=', Timestamp.fromDate(thirtyDaysAgo)),
            orderBy('criadoEm', 'asc')
        );
        unsubscribes.push(onSnapshot(qPedidosRecentes, (snapshot) => { // Linha 173 original
            setPedidosRecentes(snapshot.docs.map(doc => doc.data()));
        }, (error) => console.error("Erro no listener de pedidos recentes para gráfico:", error)));

        // Listener para os Últimos Pedidos (Visão Rápida)
        const qUltimosPedidos = query(
            collection(db, 'pedidos'),
            orderBy('criadoEm', 'desc'),
            limit(5)
        );
        unsubscribes.push(onSnapshot(qUltimosPedidos, (snapshot) => { // Linha 181 original
            setUltimosPedidos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Erro no listener de últimos pedidos:", error)));

        setLoadingDashboard(false);

        // Retorna função de limpeza para parar todos os listeners
        return () => {
            unsubscribes.forEach(unsubscribe => unsubscribe());
        };
    }, [currentUser, isMasterAdmin, authLoading, navigate]); // Dependências

    // Resto do seu código para preparar os dados do gráfico e renderizar o JSX
    // ... (o código daqui para baixo permanece o mesmo) ...

    const getDailyOrdersChartData = () => {
        const dailyCounts = {};
        pedidosRecentes.forEach(pedido => {
            if (pedido.criadoEm && typeof pedido.criadoEm.toDate === 'function') {
                const date = format(pedido.criadoEm.toDate(), 'yyyy-MM-dd');
                dailyCounts[date] = (dailyCounts[date] || 0) + 1;
            }
        });

        const labels = Object.keys(dailyCounts).sort();
        const data = labels.map(label => dailyCounts[label]);

        return {
            labels: labels,
            datasets: [
                {
                    label: 'Número de Pedidos',
                    data: data,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    tension: 0.1,
                    fill: false
                },
            ],
        };
    };

    const chartData = getDailyOrdersChartData();

    // Função para importação (exemplo de placeholder para o botão)
    const handleImportCardapio = async () => {
        toast.info("A funcionalidade de importação de cardápio via UI será implementada aqui. Por enquanto, use o script Node.js.");
    };

    if (authLoading || loadingDashboard) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <p className="text-lg text-gray-700">Carregando Dashboard Master...</p>
            </div>
        );
    }

    if (dashboardError) {
        return (
            <div className="text-center p-4 text-red-600">
                <p>Erro: {dashboardError}</p>
            </div>
        );
    }

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <h1 className="text-4xl font-bold text-center text-indigo-800 mb-8">Dashboard Master</h1>
            <p className="text-center text-gray-600 mb-8">Bem-vindo, Administrador Master {currentUser?.email}!</p>

            {/* Seção de Alertas - NOVO BLOCO */}
            {alertas.length > 0 && (
                <div className="mb-8 space-y-4">
                    {alertas.map((alerta, index) => (
                        <div key={index} className={`p-4 rounded-lg shadow-sm flex items-center justify-between ${alerta.type === 'warning' ? 'bg-orange-100 border-l-4 border-orange-500 text-orange-700' : alerta.type === 'info' ? 'bg-blue-100 border-l-4 border-blue-500 text-blue-700' : 'bg-green-100 border-l-4 border-green-500 text-green-700'}`}>
                            <p className="font-semibold">{alerta.message}</p>
                            {alerta.link && (
                                <Link to={alerta.link} className="text-sm font-medium underline ml-4 whitespace-nowrap">
                                    Ver Detalhes
                                </Link>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Cards de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-10">
                <Link to="/master/estabelecimentos" className="block">
                    <div className="bg-white rounded-lg shadow-md p-6 text-center border-l-4 border-blue-500 flex flex-col items-center justify-center transform hover:scale-105 transition-transform duration-200 cursor-pointer">
                        <div className="text-blue-600 mb-3">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-16 h-16">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25m0 0V5.25m0 8.25H2.25m0 0h19.5M2.25 12c0 1.105.9 2 2 2h19.5c1.105 0 2-.895 2-2zM4.5 10.5h15c.55 0 1-.45 1-1V5.5c0-.55-.45-1-1-1h-15c-.55 0-1 .45-1 1V9.5c0 .55.45 1 1 1zM4.5 13.5h15c.55 0 1-.45 1-1v-4c0-.55-.45-1-1-1h-15c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-blue-800 mb-1">Total de Estabelecimentos</h2>
                        <p className="text-6xl font-extrabold text-blue-600">{totalEstabelecimentos}</p>
                    </div>
                </Link>

                <Link to="/master/pedidos" className="block">
                    <div className="bg-white rounded-lg shadow-md p-6 text-center border-l-4 border-green-500 flex flex-col items-center justify-center transform hover:scale-105 transition-transform duration-200 cursor-pointer">
                        <div className="text-green-600 mb-3">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-16 h-16">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.516 0 .966.351 1.054.854l.232 1.164A2.75 2.75 0 007.45 7.5h10.978c.816 0 1.57.487 1.831 1.258l.794 2.871C22.046 12.875 22.5 14.162 22.5 15.5a7.5 7.5 0 01-15 0c0-1.338.454-2.625 1.297-3.877l.794-2.871c.26-.771 1.015-1.258 1.831-1.258h10.978a.75.75 0 00.75-.75V8.25m-6.75 6.75h.008v.008H15V15zm0 0l-4.5 4.5m4.5-4.5h.008v.008H15V15zM8.25 15.75a7.5 7.5 0 1115 0 7.5 7.5 0 01-15 0z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-green-800 mb-1">Total de Pedidos (Geral)</h2>
                        <p className="text-6xl font-extrabold text-green-600">{totalPedidosGerais}</p>
                    </div>
                </Link>

                <Link to="/master/usuarios" className="block">
                    <div className="bg-white rounded-lg shadow-md p-6 text-center border-l-4 border-purple-500 flex flex-col items-center justify-center transform hover:scale-105 transition-transform duration-200 cursor-pointer">
                        <div className="text-purple-600 mb-3">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-16 h-16">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.5v-2.25m-4.5 0v2.25m-4.5 0v2.25C6.75 21.493 7.5 22.5 8.25 22.5h7.5c.75 0 1.5-.997 1.5-2.25v-2.25m0-1.5H9a2.25 2.25 0 00-2.25 2.25V19.5M4.5 12.75V12a3 3 0 003-3h9a3 3 0 003 3v.75m-6 3l3-3m-3 3l-3-3" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-purple-800 mb-1">Total de Usuários Cadastrados</h2>
                        <p className="text-6xl font-extrabold text-purple-600">{totalUsuariosCadastrados}</p>
                    </div>
                </Link>

                {/* Card Faturamento Líquido */}
                <div className="bg-white rounded-lg shadow-md p-6 text-center border-l-4 border-orange-500 flex flex-col items-center justify-center transform hover:scale-105 transition-transform duration-200">
                    <div className="text-orange-600 mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-16 h-16">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-3h6m-5.46-9.155A4.5 4.5 0 0110.5 6a4.5 4.5 0 011.082 8.845m-5.46-9.155a4.5 4.5 0 00-1.082 8.845m5.46-9.155a4.5 4.5 0 00-1.082 8.845M12 21a9 9 0 100-18 9 9 0 000 18z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-orange-800 mb-1">Faturamento Líquido</h2>
                    <p className="text-5xl font-extrabold text-orange-600">R$ {faturamentoLiquido.toFixed(2).replace('.', ',')}</p>
                </div>

                {/* Card Ticket Médio */}
                <div className="bg-white rounded-lg shadow-md p-6 text-center border-l-4 border-red-500 flex flex-col items-center justify-center transform hover:scale-105 transition-transform duration-200">
                    <div className="text-red-600 mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-16 h-16">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21 21 17.25 15.17 11.42A8.75 8.75 0 1111.42 15.17z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-red-800 mb-1">Ticket Médio</h2>
                    <p className="text-5xl font-extrabold text-red-600">R$ {ticketMedio.toFixed(2).replace('.', ',')}</p>
                </div>
            </div>

            {/* Seção de Gráficos */}
            <div className="mt-10 p-6 bg-white rounded-lg shadow-lg border border-gray-200">
                <h2 className="text-3xl font-bold text-gray-800 mb-6">Visão Geral de Pedidos Recentes</h2>
                {pedidosRecentes.length === 0 ? (
                    <p className="text-center text-gray-500 italic">Nenhum pedido recente nos últimos 30 dias para exibir no gráfico.</p>
                ) : (
                    <Line data={chartData} options={{ responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Pedidos Diários (Últimos 30 Dias)' }}}} />
                )}
            </div>

            {/* NOVO BLOCO: Últimos Pedidos */}
            <div className="mt-10 p-6 bg-white rounded-lg shadow-lg border border-gray-200">
                <h2 className="text-3xl font-bold text-gray-800 mb-6">Últimos Pedidos Recentes</h2>
                {ultimosPedidos.length === 0 ? (
                    <p className="text-center text-gray-500 italic">Nenhum pedido recente para exibir.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full leading-normal">
                            <thead>
                                <tr>
                                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        ID
                                    </th>
                                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Cliente
                                    </th>
                                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Estabelecimento
                                    </th>
                                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Total
                                    </th>
                                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Data
                                    </th>
                                    <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Ações
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {ultimosPedidos.map(pedido => (
                                    <tr key={pedido.id}>
                                        <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                            <p className="text-gray-900 whitespace-no-wrap">{pedido.id.substring(0, 7)}...</p>
                                        </td>
                                        <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                            <p className="text-gray-900 whitespace-no-wrap">{pedido.cliente?.nome || 'N/A'}</p>
                                        </td>
                                        <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                            <p className="text-gray-900 whitespace-no-wrap">
                                                {nomesEstabelecimentos[pedido.estabelecimentoId] || pedido.estabelecimentoId || 'N/A'}
                                            </p>
                                        </td>
                                        <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                            <p className="text-gray-900 whitespace-no-wrap">R$ {pedido.totalFinal?.toFixed(2).replace('.', ',') || 'N/A'}</p>
                                        </td>
                                        <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm capitalize">
                                            <p className="text-gray-900 whitespace-no-wrap">{pedido.status || 'N/A'}</p>
                                        </td>
                                        <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                            <p className="text-gray-900 whitespace-no-wrap">
                                                {pedido.criadoEm?.toDate().toLocaleDateString('pt-BR') || 'N/A'}
                                            </p>
                                        </td>
                                        <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                            <Link to={`/comanda/${pedido.id}`} className="text-indigo-600 hover:text-indigo-900" target="_blank">
                                                Ver Comanda
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Seção de Ferramentas Master */}
            <div className="mt-10 p-6 bg-white rounded-lg shadow-lg border border-gray-200">
                <h2 className="text-3xl font-bold text-gray-800 mb-6">Ferramentas Master</h2>
                <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                    <Link to="/admin/cadastrar-estabelecimento" className="px-6 py-3 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition duration-300 flex items-center justify-center text-lg font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6 mr-2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Cadastrar Novo Estabelecimento
                    </Link>
                    
                    <Link to="/master/importar-cardapio"
                        className="px-6 py-3 bg-purple-600 text-white rounded-lg shadow-md hover:bg-purple-700 transition duration-300 flex items-center justify-center text-lg font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6 mr-2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Importar Cardápio (Via UI)
                    </Link>
                    
                    <Link to="/admin/gerenciar-cupons" className="px-6 py-3 bg-yellow-600 text-white rounded-lg shadow-md hover:bg-yellow-700 transition duration-300 flex items-center justify-center text-lg font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6 mr-2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.529 9.529a1.5 1.5 0 012.121 0l2.122 2.122a1.5 1.5 0 010 2.121L12 17.5l-4.5-4.5a1.5 1.5 0 010-2.121z" />
                        </svg>
                        Gerenciar Cupons
                    </Link>

                    <Link to="/admin/reports" className="px-6 py-3 bg-teal-600 text-white rounded-lg shadow-md hover:bg-teal-700 transition duration-300 flex items-center justify-center text-lg font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6 mr-2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                        </svg>
                        Ver Relatórios
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default MasterDashboard;