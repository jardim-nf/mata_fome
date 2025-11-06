// src/pages/AdminAnalytics.jsx - PÁGINA DE PRODUTIVIDADE COMPLETA
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
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
    const { estabelecimentoIdPrincipal } = useAuth();
    const [loading, setLoading] = useState(true);
    const [menuItems, setMenuItems] = useState([]);
    const [orders, setOrders] = useState([]);
    const [establishmentName, setEstablishmentName] = useState('');

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
        if (!estabelecimentoIdPrincipal) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Buscar itens do cardápio
                const categoriasRef = collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'cardapio');
                const categoriasSnapshot = await getDocs(categoriasRef);
                
                let allItems = [];
                for (const catDoc of categoriasSnapshot.docs) {
                    const itensRef = collection(
                        db, 
                        'estabelecimentos', 
                        estabelecimentoIdPrincipal, 
                        'cardapio', 
                        catDoc.id, 
                        'itens'
                    );
                    const itensSnapshot = await getDocs(itensRef);
                    const itemsDaCategoria = itensSnapshot.docs.map(itemDoc => ({
                        ...itemDoc.data(),
                        id: itemDoc.id,
                        categoriaId: catDoc.id,
                        categoria: catDoc.data().nome
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
    }, [estabelecimentoIdPrincipal]);

    // Função para calcular métricas (mock data para demonstração)
    const calcularMetricas = (items) => {
        const totalItems = items.length;
        const itensAtivos = items.filter(item => item.ativo).length;
        
        // Dados mockados para demonstração
        setAnalyticsData({
            ticketMedio: 45.90,
            itensAtivos: Math.round((itensAtivos / totalItems) * 100),
            taxaConversao: 12.5,
            lucratividade: 68.2,
            visualizacoesTotais: 1247,
            pedidosHoje: 23
        });
    };

    // Itens mais rentáveis
    const itensMaisRentaveis = useMemo(() => {
        return [...menuItems]
            .sort((a, b) => (b.preco * 0.7 - b.preco * 0.3) - (a.preco * 0.7 - a.preco * 0.3))
            .slice(0, 5);
    }, [menuItems]);

    // Alertas inteligentes
    const alertas = useMemo(() => {
        const alerts = [];
        
        // Estoque crítico (mock)
        if (menuItems.length > 0) {
            alerts.push({
                tipo: 'estoque',
                titulo: 'Estoque crítico',
                descricao: '3 itens com estoque abaixo do mínimo',
                prioridade: 'alta',
                acao: 'Reabastecer'
            });
        }

        // Oportunidade de preço
        const itensBaratos = menuItems.filter(item => item.preco < 15);
        if (itensBaratos.length > 2) {
            alerts.push({
                tipo: 'preco',
                titulo: 'Oportunidade de preço',
                descricao: `${itensBaratos.length} itens com preço abaixo da média`,
                prioridade: 'media',
                acao: 'Revisar preços'
            });
        }

        // Itens inativos
        const itensInativos = menuItems.filter(item => !item.ativo);
        if (itensInativos.length > 5) {
            alerts.push({
                tipo: 'performance',
                titulo: 'Itens inativos',
                descricao: `${itensInativos.length} itens desativados`,
                prioridade: 'baixa',
                acao: 'Reativar'
            });
        }

        return alerts;
    }, [menuItems]);

    // Insights automáticos
    const insights = useMemo(() => {
        return [
            {
                tipo: 'popularidade',
                titulo: 'Item em alta',
                descricao: 'X-Burger tem 3x mais visualizações que a média',
                icone: '📈'
            },
            {
                tipo: 'combinacao',
                titulo: 'Oportunidade de combo',
                descricao: 'Clientes que compram Pizza também buscam Refrigerante',
                icone: '🎯'
            },
            {
                tipo: 'tendencia',
                titulo: 'Tendência identificada',
                descricao: 'Busca por "vegetariano" aumentou 45% esta semana',
                icone: '🔍'
            }
        ];
    }, []);

    // Quick actions
    const quickActions = [
        {
            icone: <IoRefresh className="text-blue-600" />,
            titulo: 'Reabastecer Estoques',
            descricao: 'Repor itens com estoque baixo',
            acao: () => console.log('Reabastecer estoques'),
            cor: 'blue'
        },
        {
            icone: <IoPricetag className="text-green-600" />,
            titulo: 'Otimizar Preços',
            descricao: 'Ajustar preços baseado na performance',
            acao: () => console.log('Otimizar preços'),
            cor: 'green'
        },
        {
            icone: <IoFlash className="text-yellow-600" />,
            titulo: 'Promover Itens',
            descricao: 'Destacar produtos com baixa performance',
            acao: () => console.log('Promover itens'),
            cor: 'yellow'
        },
        {
            icone: <IoDownload className="text-purple-600" />,
            titulo: 'Gerar Relatório',
            descricao: 'Exportar relatório completo',
            acao: () => console.log('Gerar relatório'),
            cor: 'purple'
        }
    ];

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
                                    <button
                                        key={index}
                                        onClick={action.acao}
                                        className={`w-full flex items-center space-x-3 p-4 rounded-xl border transition-all hover:shadow-md ${
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
                                    </button>
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
                                {alertas.map((alerta, index) => (
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
                                            <button className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700">
                                                {alerta.acao} →
                                            </button>
                                        </div>
                                    </div>
                                ))}
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
                            {itensMaisRentaveis.map((item, index) => (
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
                                        <p className="text-sm text-green-600">+{Math.random() * 20 + 10}% margem</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Insights Automáticos */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                            <IoBulb className="mr-2 text-yellow-500" />
                            Insights Automáticos
                        </h2>
                        <div className="space-y-4">
                            {insights.map((insight, index) => (
                                <div key={index} className="flex items-start space-x-3 p-4 rounded-xl border border-gray-200 hover:border-blue-200 transition-colors">
                                    <div className="text-2xl">{insight.icone}</div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{insight.titulo}</h3>
                                        <p className="text-sm text-gray-600 mt-1">{insight.descricao}</p>
                                        <button className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700">
                                            Ver detalhes →
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Métricas Adicionais */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Performance Geral</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Visualizações totais</span>
                                <span className="font-bold text-gray-900">{analyticsData.visualizacoesTotais}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Pedidos hoje</span>
                                <span className="font-bold text-gray-900">{analyticsData.pedidosHoje}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Taxa de reordenação</span>
                                <span className="font-bold text-green-600">42%</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Próximos Passos</h3>
                        <div className="space-y-3">
                            <div className="flex items-center space-x-3">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span className="text-gray-700">Revisar preços dos 5 itens mais populares</span>
                            </div>
                            <div className="flex items-center space-x-3">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-gray-700">Criar promoção para itens de baixa rotatividade</span>
                            </div>
                            <div className="flex items-center space-x-3">
                                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                <span className="text-gray-700">Otimizar descrições dos itens menos visualizados</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AdminAnalytics;