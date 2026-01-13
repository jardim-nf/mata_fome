// src/pages/AdminAnalytics.jsx - PÁGINA DE PRODUTIVIDADE COMPLETA CORRIGIDA
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { 
    IoArrowBack, 
    IoTrendingUp, 
    IoAlertCircle,
    IoRefresh,
    IoCash,
    IoTime,
    IoStatsChart,
    IoFlash,
    IoNotifications,
    IoBulb,
    IoDownload,
    IoPricetag,
    IoRestaurant,
    IoCart,
    IoEye
} from 'react-icons/io5';

function AdminAnalytics() {
    const { userData } = useAuth();
    
    console.log("🔍 Debug Auth no AdminAnalytics:", {
        userData,
        userDataKeys: userData ? Object.keys(userData) : 'no userData',
        estabelecimentos: userData?.estabelecimentos,
        estabelecimentosGerenciados: userData?.estabelecimentosGerenciados
    });

    const [loading, setLoading] = useState(true);
    const [menuItems, setMenuItems] = useState([]);
    const [orders, setOrders] = useState([]);
    const [establishmentName, setEstablishmentName] = useState('');

    // 🔧 CORREÇÃO: Busca o estabelecimento com o nome CORRETO baseado na sua estrutura
    const primeiroEstabelecimento = useMemo(() => {
        // Tenta na ordem: estabelecimentosCerenciados, depois estabelecimentos, depois estabelecimentosGerenciados
        const estabelecimento =  // ✅ NOME CORRETO baseado no seu Firebase
                               userData?.estabelecimentos?.[0] ||
                               userData?.estabelecimentosGerenciados?.[0] ||
                               null;
        
        console.log("🏪 Estabelecimento encontrado no Analytics:", estabelecimento);
        return estabelecimento;
    }, [userData]);

    // Dados de exemplo para demonstração (substituir por dados reais)
    const [analyticsData, setAnalyticsData] = useState({
        ticketMedio: 0,
        itensAtivos: 0,
        taxaConversao: 0,
        lucratividade: 0,
        visualizacoesTotais: 0,
        pedidosHoje: 0
    });

    // Buscar dados do estabelecimento e itens
    useEffect(() => {
        if (!primeiroEstabelecimento) {
            console.log("❌ Nenhum estabelecimento disponível para carregar analytics");
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                // Buscar nome do estabelecimento
                const estabDoc = await getDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento));
                if (estabDoc.exists()) {
                    setEstablishmentName(estabDoc.data().nome);
                    console.log("🏪 Nome do estabelecimento:", estabDoc.data().nome);
                }

                // Buscar itens do cardápio
                const categoriasRef = collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio');
                const categoriasSnapshot = await getDocs(categoriasRef);
                
                let allItems = [];
                for (const catDoc of categoriasSnapshot.docs) {
                    const itensRef = collection(
                        db, 
                        'estabelecimentos', 
                        primeiroEstabelecimento, 
                        'cardapio', 
                        catDoc.id, 
                        'itens'
                    );
                    const itensSnapshot = await getDocs(itensRef);
                    const itemsDaCategoria = itensSnapshot.docs.map(itemDoc => ({
                        ...itemDoc.data(),
                        id: itemDoc.id,
                        categoriaId: catDoc.id,
                        categoria: catDoc.data().nome,
                        // 📦 Garantir campos de estoque
                        estoque: itemDoc.data().estoque || 0,
                        estoqueMinimo: itemDoc.data().estoqueMinimo || 0,
                        custo: itemDoc.data().custo || 0
                    }));
                    allItems = [...allItems, ...itemsDaCategoria];
                }

                setMenuItems(allItems);
                
                // Calcular métricas (usando dados mockados por enquanto)
                calcularMetricas(allItems);

            } catch (error) {
                console.error("❌ Erro ao carregar dados:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [primeiroEstabelecimento]);

    // Função para calcular métricas (mock data para demonstração)
    const calcularMetricas = (items) => {
        const totalItems = items.length;
        const itensAtivos = items.filter(item => item.ativo).length;
        const itensComEstoqueCritico = items.filter(item => item.estoque <= (item.estoqueMinimo || 0)).length;
        
        // Dados mockados para demonstração
        setAnalyticsData({
            ticketMedio: 45.90,
            itensAtivos: Math.round((itensAtivos / totalItems) * 100),
            taxaConversao: 12.5,
            lucratividade: 68.2,
            visualizacoesTotais: 1247,
            pedidosHoje: 23,
            itensEstoqueCritico: itensComEstoqueCritico
        });
    };

    // Itens mais rentáveis
    const itensMaisRentaveis = useMemo(() => {
        return [...menuItems]
            .filter(item => item.ativo && item.preco)
            .sort((a, b) => {
                const margemA = a.preco - (a.custo || 0);
                const margemB = b.preco - (b.custo || 0);
                return margemB - margemA;
            })
            .slice(0, 5);
    }, [menuItems]);

    // Itens com estoque crítico
    const itensEstoqueCritico = useMemo(() => {
        return menuItems.filter(item => item.estoque <= (item.estoqueMinimo || 0)).slice(0, 3);
    }, [menuItems]);

    // Alertas inteligentes
    const alertas = useMemo(() => {
        const alerts = [];
        
        // Estoque crítico
        if (itensEstoqueCritico.length > 0) {
            alerts.push({
                tipo: 'estoque',
                titulo: 'Estoque crítico',
                descricao: `${itensEstoqueCritico.length} itens com estoque abaixo do mínimo`,
                prioridade: 'alta',
                acao: 'Reabastecer',
                quantidade: itensEstoqueCritico.length
            });
        }

        // Itens inativos
        const itensInativos = menuItems.filter(item => !item.ativo);
        if (itensInativos.length > 3) {
            alerts.push({
                tipo: 'performance',
                titulo: 'Itens inativos',
                descricao: `${itensInativos.length} itens desativados no cardápio`,
                prioridade: 'media',
                acao: 'Revisar',
                quantidade: itensInativos.length
            });
        }

        // Itens sem custo definido
        const itensSemCusto = menuItems.filter(item => !item.custo || item.custo === 0);
        if (itensSemCusto.length > 2) {
            alerts.push({
                tipo: 'preco',
                titulo: 'Custos indefinidos',
                descricao: `${itensSemCusto.length} itens sem custo definido`,
                prioridade: 'media',
                acao: 'Definir custos',
                quantidade: itensSemCusto.length
            });
        }

        // Itens com baixa margem
        const itensBaixaMargem = menuItems.filter(item => {
            if (!item.preco || !item.custo || item.custo === 0) return false;
            const margem = ((item.preco - item.custo) / item.preco) * 100;
            return margem < 30;
        });
        
        if (itensBaixaMargem.length > 2) {
            alerts.push({
                tipo: 'lucratividade',
                titulo: 'Margens baixas',
                descricao: `${itensBaixaMargem.length} itens com margem abaixo de 30%`,
                prioridade: 'baixa',
                acao: 'Revisar preços',
                quantidade: itensBaixaMargem.length
            });
        }

        return alerts;
    }, [menuItems, itensEstoqueCritico]);

    // Insights automáticos
    const insights = useMemo(() => {
        const insightsList = [];
        
        // Insight baseado em itens mais rentáveis
        if (itensMaisRentaveis.length > 0) {
            const itemTop = itensMaisRentaveis[0];
            insightsList.push({
                tipo: 'rentabilidade',
                titulo: 'Item mais rentável',
                descricao: `${itemTop.nome} tem a maior margem de lucro do cardápio`,
                icone: '💰'
            });
        }

        // Insight baseado em estoque
        if (itensEstoqueCritico.length > 0) {
            insightsList.push({
                tipo: 'estoque',
                titulo: 'Atenção ao estoque',
                descricao: `${itensEstoqueCritico.length} itens precisam de reabastecimento urgente`,
                icone: '⚠️'
            });
        }

        // Insight baseado em categorias
        const categoriasCount = {};
        menuItems.forEach(item => {
            if (item.categoria) {
                categoriasCount[item.categoria] = (categoriasCount[item.categoria] || 0) + 1;
            }
        });
        
        const categoriaMaisItens = Object.keys(categoriasCount).reduce((a, b) => 
            categoriasCount[a] > categoriasCount[b] ? a : b, ''
        );
        
        if (categoriaMaisItens) {
            insightsList.push({
                tipo: 'categoria',
                titulo: 'Categoria principal',
                descricao: `${categoriaMaisItens} é sua categoria com mais itens (${categoriasCount[categoriaMaisItens]})`,
                icone: '📊'
            });
        }

        return insightsList;
    }, [menuItems, itensMaisRentaveis, itensEstoqueCritico]);

    // Quick actions
    const quickActions = [
        {
            icone: <IoRefresh className="text-blue-600" />,
            titulo: 'Reabastecer Estoques',
            descricao: 'Repor itens com estoque baixo',
            acao: () => console.log('Reabastecer estoques'),
            cor: 'blue',
            rota: '/admin/gerenciar-cardapio'
        },
        {
            icone: <IoPricetag className="text-green-600" />,
            titulo: 'Otimizar Preços',
            descricao: 'Ajustar preços baseado na performance',
            acao: () => console.log('Otimizar preços'),
            cor: 'green',
            rota: '/admin/gerenciar-cardapio'
        },
        {
            icone: <IoFlash className="text-yellow-600" />,
            titulo: 'Promover Itens',
            descricao: 'Destacar produtos com baixa performance',
            acao: () => console.log('Promover itens'),
            cor: 'yellow',
            rota: '/admin/gerenciar-cardapio'
        },
        {
            icone: <IoDownload className="text-purple-600" />,
            titulo: 'Gerar Relatório',
            descricao: 'Exportar relatório completo',
            acao: () => console.log('Gerar relatório'),
            cor: 'purple',
            rota: '#'
        }
    ];

    // 🔧 CORREÇÃO: Se não há estabelecimento, mostra mensagem
    if (!primeiroEstabelecimento) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md flex-col sm:flex-row text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <IoAlertCircle className="text-red-600 text-2xl" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                        Estabelecimento Não Configurado
                    </h2>
                    <p className="text-gray-600 mb-6">
                        Este usuário não tem um estabelecimento vinculado. 
                        Entre em contato com o administrador do sistema.
                    </p>
                    <div className="space-y-3">
                        <Link 
                            to="/dashboard" 
                            className="inline-flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex-col sm:flex-row"
                        >
                            <IoArrowBack />
                            <span>Voltar ao Dashboard</span>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 text-gray-600">Carregando analytics...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
                    <div className="mb-4 lg:mb-0">
                        <div className="flex items-center space-x-3 mb-2">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                                <IoStatsChart className="text-white text-lg" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">
                                    Painel de Produtividade
                                </h1>
                                <p className="text-gray-600">
                                    {establishmentName} • Insights e otimizações
                                </p>
                                <p className="text-sm text-gray-500">
                                    Estabelecimento ID: {primeiroEstabelecimento}
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Link 
                            to="/admin/gerenciar-cardapio" 
                            className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-lg border border-gray-300 transition-colors"
                        >
                            <IoArrowBack />
                            <span>Voltar ao Cardápio</span>
                        </Link>
                        <button className="inline-flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors">
                            <IoDownload size={18} />
                            <span>Exportar Relatório</span>
                        </button>
                    </div>
                </header>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Ticket Médio</p>
                                <p className="text-2xl font-bold text-gray-900">R$ {analyticsData.ticketMedio.toFixed(2)}</p>
                                <div className="flex items-center mt-1">
                                    <IoTrendingUp className="text-green-500 mr-1" />
                                    <span className="text-sm text-green-600">+5.2%</span>
                                </div>
                            </div>
                            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                                <IoCash className="text-green-600 text-xl" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Itens Ativos</p>
                                <p className="text-2xl font-bold text-gray-900">{analyticsData.itensAtivos}%</p>
                                <div className="flex items-center mt-1">
                                    <IoTrendingUp className="text-blue-500 mr-1" />
                                    <span className="text-sm text-blue-600">+2.1%</span>
                                </div>
                            </div>
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                <IoRestaurant className="text-blue-600 text-xl" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Taxa de Conversão</p>
                                <p className="text-2xl font-bold text-gray-900">{analyticsData.taxaConversao}%</p>
                                <div className="flex items-center mt-1">
                                    <IoTrendingUp className="text-purple-500 mr-1" />
                                    <span className="text-sm text-purple-600">+1.8%</span>
                                </div>
                            </div>
                            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                                <IoCart className="text-purple-600 text-xl" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Lucratividade</p>
                                <p className="text-2xl font-bold text-gray-900">{analyticsData.lucratividade}%</p>
                                <div className="flex items-center mt-1">
                                    <IoTrendingUp className="text-orange-500 mr-1" />
                                    <span className="text-sm text-orange-600">+3.4%</span>
                                </div>
                            </div>
                            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                                <IoStatsChart className="text-orange-600 text-xl" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                    {/* Quick Actions */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                                <IoFlash className="mr-2 text-yellow-500" />
                                Ações Rápidas
                            </h2>
                            <div className="space-y-3">
                                {quickActions.map((action, index) => (
                                    <Link
                                        key={index}
                                        to={action.rota}
                                        className={`flex-col sm:flex-row flex items-center space-x-3 p-4 rounded-xl border transition-all hover:shadow-md ${
                                            action.cor === 'blue' ? 'border-blue-200 hover:border-blue-300' :
                                            action.cor === 'green' ? 'border-green-200 hover:border-green-300' :
                                            action.cor === 'yellow' ? 'border-yellow-200 hover:border-yellow-300' :
                                            'border-purple-200 hover:border-purple-300'
                                        }`}
                                    >
                                        <div className="flex-shrink-0">
                                            {action.icone}
                                        </div>
                                        <div className="text-left">
                                            <p className="font-semibold text-gray-900">{action.titulo}</p>
                                            <p className="text-sm text-gray-600">{action.descricao}</p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Alertas Inteligentes */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                                <IoNotifications className="mr-2 text-red-500" />
                                Alertas Inteligentes
                            </h2>
                            <div className="space-y-4">
                                {alertas.length > 0 ? (
                                    alertas.map((alerta, index) => (
                                        <div key={index} className={`flex items-start space-x-3 p-4 rounded-xl border ${
                                            alerta.prioridade === 'alta' ? 'border-red-200 bg-red-50' :
                                            alerta.prioridade === 'media' ? 'border-yellow-200 bg-yellow-50' :
                                            'border-blue-200 bg-blue-50'
                                        }`}>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                alerta.prioridade === 'alta' ? 'bg-red-100' :
                                                alerta.prioridade === 'media' ? 'bg-yellow-100' :
                                                'bg-blue-100'
                                            }`}>
                                                <IoAlertCircle className={
                                                    alerta.prioridade === 'alta' ? 'text-red-600' :
                                                    alerta.prioridade === 'media' ? 'text-yellow-600' :
                                                    'text-blue-600'
                                                } />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="font-semibold text-gray-900">{alerta.titulo}</h3>
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                        alerta.prioridade === 'alta' ? 'bg-red-100 text-red-800' :
                                                        alerta.prioridade === 'media' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-blue-100 text-blue-800'
                                                    }`}>
                                                        {alerta.prioridade === 'alta' ? 'Alta' : 
                                                         alerta.prioridade === 'media' ? 'Média' : 'Baixa'}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-600 mt-1">{alerta.descricao}</p>
                                                <Link 
                                                    to="/admin/gerenciar-cardapio" 
                                                    className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700 inline-block"
                                                >
                                                    {alerta.acao} →
                                                </Link>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8">
                                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <IoCheckmarkCircle className="text-green-600 text-2xl" />
                                        </div>
                                        <p className="text-gray-600">Todos os sistemas operando normalmente</p>
                                        <p className="text-sm text-gray-500 mt-1">Sem alertas críticos no momento</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Itens Mais Rentáveis */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                            <IoTrendingUp className="mr-2 text-green-500" />
                            Itens Mais Rentáveis
                        </h2>
                        <div className="space-y-3">
                            {itensMaisRentaveis.length > 0 ? (
                                itensMaisRentaveis.map((item, index) => {
                                    const margem = item.custo ? ((item.preco - item.custo) / item.preco) * 100 : 0;
                                    const lucroPorUnidade = item.preco - (item.custo || 0);
                                    
                                    return (
                                        <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                                    <span className="text-green-600 font-bold text-sm">{index + 1}</span>
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">{item.nome}</p>
                                                    <p className="text-sm text-gray-600">{item.categoria}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-gray-900">R$ {item.preco?.toFixed(2)}</p>
                                                <p className="text-sm text-green-600">
                                                    {margem > 0 ? `+${margem.toFixed(1)}%` : 'Margem indefinida'}
                                                </p>
                                                {lucroPorUnidade > 0 && (
                                                    <p className="text-xs text-gray-500">
                                                        Lucro: R$ {lucroPorUnidade.toFixed(2)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-gray-600">Nenhum item rentável encontrado</p>
                                    <p className="text-sm text-gray-500 mt-1">Adicione custos aos itens para calcular margens</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Insights Automáticos */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                            <IoBulb className="mr-2 text-yellow-500" />
                            Insights Automáticos
                        </h2>
                        <div className="space-y-4">
                            {insights.length > 0 ? (
                                insights.map((insight, index) => (
                                    <div key={index} className="flex items-start space-x-3 p-4 rounded-xl border border-gray-200 hover:border-blue-200 transition-colors">
                                        <div className="text-2xl">{insight.icone}</div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{insight.titulo}</h3>
                                            <p className="text-sm text-gray-600 mt-1">{insight.descricao}</p>
                                            <Link 
                                                to="/admin/gerenciar-cardapio" 
                                                className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700 inline-block"
                                            >
                                                Ver detalhes →
                                            </Link>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-gray-600">Gerando insights...</p>
                                    <p className="text-sm text-gray-500 mt-1">Analisando dados do cardápio</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Métricas Adicionais */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Performance Geral</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Total de itens</span>
                                <span className="font-bold text-gray-900">{menuItems.length}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Itens ativos</span>
                                <span className="font-bold text-green-600">
                                    {menuItems.filter(item => item.ativo).length}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Estoque crítico</span>
                                <span className="font-bold text-red-600">
                                    {itensEstoqueCritico.length}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Pedidos hoje</span>
                                <span className="font-bold text-gray-900">{analyticsData.pedidosHoje}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Próximos Passos</h3>
                        <div className="space-y-3">
                            {itensEstoqueCritico.length > 0 && (
                                <div className="flex items-center space-x-3">
                                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                    <span className="text-gray-700">Reabastecer {itensEstoqueCritico.length} itens com estoque crítico</span>
                                </div>
                            )}
                            <div className="flex items-center space-x-3">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span className="text-gray-700">Revisar preços dos {Math.min(5, itensMaisRentaveis.length)} itens mais rentáveis</span>
                            </div>
                            <div className="flex items-center space-x-3">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-gray-700">Ativar itens inativos para aumentar variedade</span>
                            </div>
                            {menuItems.filter(item => !item.custo || item.custo === 0).length > 0 && (
                                <div className="flex items-center space-x-3">
                                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                    <span className="text-gray-700">Definir custos para {menuItems.filter(item => !item.custo || item.custo === 0).length} itens</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AdminAnalytics;