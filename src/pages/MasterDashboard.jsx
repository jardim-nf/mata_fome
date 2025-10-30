// src/pages/MasterDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { 
  FaStore, 
  FaUsers, 
  FaClipboardList, 
  FaFileUpload, 
  FaTags, 
  FaShieldAlt, 
  FaImages,
  FaDollarSign,
  FaChartLine,
  FaSync,
  FaSignOutAlt,
  FaShoppingCart,
  FaUserCheck,
  FaBuilding
} from 'react-icons/fa';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

// Componente de Header no padrão das outras telas
function DashboardHeader({ currentUser, logout, navigate }) {
  const userEmailPrefix = currentUser.email ? currentUser.email.split('@')[0] : 'Master';

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logout realizado com sucesso!');
      navigate('/');
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      toast.error('Erro ao fazer logout.');
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div 
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => navigate('/')}
          >
            <div className="bg-yellow-500 w-10 h-10 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-black font-bold text-xl">D</span>
            </div>
            <div>
              <span className="text-gray-900 font-bold text-2xl group-hover:text-yellow-600 transition-colors duration-300">
                DEU FOME
              </span>
              <span className="block text-xs text-gray-500 font-medium">MASTER DASHBOARD</span>
            </div>
          </div>

          {/* User Info and Actions */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-3 bg-gray-50 rounded-lg px-4 py-2">
              <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center shadow-sm">
                <span className="text-black font-bold text-sm">M</span>
              </div>
              <div className="text-right">
                <p className="text-gray-900 text-sm font-semibold">Master Admin</p>
                <p className="text-gray-500 text-xs">{userEmailPrefix}</p>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-sm"
            >
              <FaSignOutAlt className="text-sm" />
              <span className="text-sm font-medium">Sair</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

// Componente de Card de Estatística no novo padrão
const StatCard = ({ title, value, icon, color, subtitle, trend }) => (
  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-gray-600 text-sm font-medium mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {subtitle && (
          <p className="text-gray-500 text-sm mt-2">{subtitle}</p>
        )}
        {trend && (
          <div className={`flex items-center mt-2 text-sm ${trend.value > 0 ? 'text-green-600' : 'text-red-600'}`}>
            <span className="font-semibold">{trend.value > 0 ? '↗' : '↘'}</span>
            <span className="ml-1 font-medium">{Math.abs(trend.value)}%</span>
            <span className="text-gray-500 ml-2 text-xs">{trend.period}</span>
          </div>
        )}
      </div>
      <div className={`text-3xl p-3 rounded-xl ${color}`}>
        {icon}
      </div>
    </div>
  </div>
);

// Componente de Card de Ação no novo padrão
const ActionCard = ({ to, title, description, icon, color }) => (
  <Link
    to={to}
    className="group bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:border-yellow-400"
  >
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${color} group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
        <div className="text-gray-400 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300 text-lg">
          →
        </div>
      </div>
      
      <div className="flex-grow">
        <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-yellow-600 transition-colors duration-300">
          {title}
        </h3>
        <p className="text-gray-600 text-sm leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  </Link>
);

function MasterDashboard() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const [stats, setStats] = useState({
    totalEstabelecimentos: 0,
    estabelecimentosAtivos: 0,
    totalUsuarios: 0,
    totalPedidos: 0,
    faturamentoTotal: 0,
    pedidosHoje: 0,
    faturamentoHoje: 0,
    usuariosNovos: 0,
  });

  const [pedidosPorEstabelecimento, setPedidosPorEstabelecimento] = useState({
    labels: [],
    datasets: [],
  });

  const [pedidosUltimos7Dias, setPedidosUltimos7Dias] = useState({
    labels: [],
    datasets: [],
  });

  const fetchDashboardData = async () => {
    setLoadingDashboard(true);
    try {
      const hoje = new Date();
      const inicioHoje = startOfDay(hoje);
      const fimHoje = endOfDay(hoje);
      const umaSemanaAtras = startOfDay(subDays(hoje, 7));

      const estabQuery = query(collection(db, 'estabelecimentos'));
      const usersQuery = query(collection(db, 'usuarios'));
      const usersNovosQuery = query(
        collection(db, 'usuarios'),
        where('createdAt', '>=', umaSemanaAtras)
      );
      const pedidosQuery = query(collection(db, 'pedidos'));
      const pedidosHojeQuery = query(
        collection(db, 'pedidos'),
        where('createdAt', '>=', inicioHoje),
        where('createdAt', '<=', fimHoje)
      );
      
      const [estabSnapshot, usersSnapshot, usersNovosSnapshot, pedidosSnapshot, pedidosHojeSnapshot] = await Promise.all([
        getDocs(estabQuery),
        getDocs(usersQuery),
        getDocs(usersNovosQuery),
        getDocs(pedidosQuery),
        getDocs(pedidosHojeQuery),
      ]);

      const estabs = estabSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const pedidos = pedidosSnapshot.docs.map(doc => doc.data());
      const pedidosDeHoje = pedidosHojeSnapshot.docs.map(doc => doc.data());

      const faturamentoTotal = pedidos.reduce((sum, pedido) => sum + (pedido.totalFinal || 0), 0);
      const faturamentoHoje = pedidosDeHoje.reduce((sum, pedido) => sum + (pedido.totalFinal || 0), 0);
      
      setStats({
        totalEstabelecimentos: estabs.length,
        estabelecimentosAtivos: estabs.filter(e => e.ativo).length,
        totalUsuarios: usersSnapshot.size,
        totalPedidos: pedidos.length,
        faturamentoTotal,
        pedidosHoje: pedidosDeHoje.length,
        faturamentoHoje,
        usuariosNovos: usersNovosSnapshot.size,
      });
      
      // Gráfico de pedidos por estabelecimento (top 5)
      const pedidosCount = estabs.reduce((acc, estab) => {
        acc[estab.nome] = 0;
        return acc;
      }, {});
      
      pedidos.forEach(pedido => {
        const estab = estabs.find(e => e.id === pedido.estabelecimentoId);
        if (estab && pedidosCount.hasOwnProperty(estab.nome)) {
          pedidosCount[estab.nome]++;
        }
      });

      const topEstabelecimentos = Object.entries(pedidosCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

      setPedidosPorEstabelecimento({
        labels: topEstabelecimentos.map(([nome]) => nome),
        datasets: [{
          label: 'Pedidos',
          data: topEstabelecimentos.map(([,count]) => count),
          backgroundColor: 'rgba(234, 179, 8, 0.8)',
          borderColor: 'rgba(234, 179, 8, 1)',
          borderWidth: 2,
          borderRadius: 8,
        }],
      });

      // Gráfico dos últimos 7 dias
      const ultimos7Dias = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(hoje, 6 - i);
        return format(date, 'dd/MM');
      });

      const pedidosPorDia = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(hoje, 6 - i);
        const inicioDia = startOfDay(date);
        const fimDia = endOfDay(date);
        
        return pedidos.filter(pedido => {
          const pedidoDate = pedido.createdAt?.toDate?.() || new Date(pedido.createdAt);
          return pedidoDate >= inicioDia && pedidoDate <= fimDia;
        }).length;
      });

      setPedidosUltimos7Dias({
        labels: ultimos7Dias,
        datasets: [{
          label: 'Pedidos',
          data: pedidosPorDia,
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
          borderRadius: 4,
        }],
      });

      setLastUpdated(new Date());
      setDashboardError('');

    } catch (err) {
      console.error("Erro ao carregar dados do dashboard:", err);
      setDashboardError('Falha ao carregar dados do dashboard.');
      toast.error('Erro ao carregar dados.');
    } finally {
      setLoadingDashboard(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser || !isMasterAdmin) {
      toast.error('Acesso não autorizado.');
      navigate('/');
      return;
    }

    fetchDashboardData();

    // Atualizar dados a cada 60 segundos
    const interval = setInterval(fetchDashboardData, 60000);
    return () => clearInterval(interval);
  }, [isMasterAdmin, currentUser, authLoading, navigate]);

  const statusData = {
    labels: ['Ativos', 'Inativos'],
    datasets: [{
      data: [stats.estabelecimentosAtivos, stats.totalEstabelecimentos - stats.estabelecimentosAtivos],
      backgroundColor: ['#22c55e', '#ef4444'],
      borderColor: '#ffffff',
      borderWidth: 2,
    }],
  };
  
  const statusOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: 'bottom', 
        labels: { 
          color: '#374151',
          font: { size: 12, weight: '500' },
          padding: 20,
        } 
      },
    },
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(0,0,0,0.1)' },
        ticks: { color: '#374151', font: { weight: '500' } }
      },
      y: {
        grid: { color: 'rgba(0,0,0,0.1)' },
        ticks: { color: '#374151', font: { weight: '500' } },
        beginAtZero: true
      },
    },
  };

  if (authLoading || loadingDashboard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-900">
        <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xl font-semibold">Carregando Dashboard Master...</p>
        <p className="text-gray-500 text-sm mt-2">Preparando todas as funcionalidades</p>
      </div>
    );
  }
  
  if (dashboardError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-900">
        <div className="text-red-500 text-4xl mb-4">❌</div>
        <p className="text-lg font-semibold mb-4">{dashboardError}</p>
        <button
          onClick={fetchDashboardData}
          className="flex items-center space-x-2 px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors shadow-sm"
        >
          <FaSync />
          <span className="font-semibold">Tentar Novamente</span>
        </button>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-8 px-4">
      <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} />
      
      <main className="max-w-7xl mx-auto">
        {/* Header do Dashboard */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Dashboard Master
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Visão completa da plataforma • Atualizado {format(lastUpdated, "dd/MM/yyyy 'às' HH:mm")}
          </p>
        </div>

        {/* Botão de Atualizar */}
        <div className="flex justify-center mb-8">
          <button
            onClick={fetchDashboardData}
            className="flex items-center space-x-3 px-6 py-3 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-300 shadow-sm hover:shadow-md"
          >
            <FaSync className={`text-yellow-600 ${loadingDashboard ? 'animate-spin' : ''}`} />
            <span className="font-semibold text-gray-700">Atualizar Dados</span>
          </button>
        </div>

        {/* Grid de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard
            title="Estabelecimentos"
            value={stats.totalEstabelecimentos}
            icon={<FaBuilding className="text-white text-xl" />}
            color="bg-blue-500"
            subtitle={`${stats.estabelecimentosAtivos} ativos`}
          />
          <StatCard
            title="Total de Usuários"
            value={stats.totalUsuarios}
            icon={<FaUsers className="text-white text-xl" />}
            color="bg-green-500"
            subtitle={`${stats.usuariosNovos} novos esta semana`}
          />
          <StatCard
            title="Pedidos Hoje"
            value={stats.pedidosHoje}
            icon={<FaShoppingCart className="text-white text-xl" />}
            color="bg-yellow-500"
            subtitle={`R$ ${stats.faturamentoHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          />
          <StatCard
            title="Faturamento Total"
            value={`R$ ${stats.faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<FaDollarSign className="text-white text-xl" />}
            color="bg-purple-500"
            subtitle={`${stats.totalPedidos} pedidos totais`}
          />
        </div>

        {/* Seção de Gráficos */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Análise e Métricas</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center justify-center">
                <FaChartLine className="mr-2 text-yellow-600" />
                Status dos Estabelecimentos
              </h3>
              <div className="h-80">
                <Pie data={statusData} options={statusOptions} />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center justify-center">
                <FaChartLine className="mr-2 text-blue-600" />
                Pedidos - Últimos 7 Dias
              </h3>
              <div className="h-80">
                <Bar data={pedidosUltimos7Dias} options={barOptions} />
              </div>
            </div>
          </div>
        </div>

        {/* Seção de Gerenciamento */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Gerenciamento Master</h2>
          <p className="text-gray-600 text-lg">Controle completo da plataforma</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <ActionCard
            to="/master/estabelecimentos"
            title="Estabelecimentos"
            description="Gerencie todos os estabelecimentos da plataforma"
            icon={<FaStore className="text-2xl text-white" />}
            color="bg-blue-500"
          />
          <ActionCard
            to="/master/usuarios"
            title="Usuários"
            description="Administre usuários e permissões do sistema"
            icon={<FaUsers className="text-2xl text-white" />}
            color="bg-green-500"
          />
          <ActionCard
            to="/master/pedidos"
            title="Todos os Pedidos"
            description="Histórico completo de pedidos da plataforma"
            icon={<FaClipboardList className="text-2xl text-white" />}
            color="bg-yellow-500"
          />
          <ActionCard
            to="/master/importar-cardapio"
            title="Importar Cardápio"
            description="Upload em massa de cardápios para estabelecimentos"
            icon={<FaFileUpload className="text-2xl text-white" />}
            color="bg-red-500"
          />
          <ActionCard
            to="/master/associar-imagens"
            title="Associar Imagens"
            description="Vincule fotos aos produtos do cardápio"
            icon={<FaImages className="text-2xl text-white" />}
            color="bg-purple-500"
          />
          <ActionCard
            to="/master/plans"
            title="Planos"
            description="Gerencie planos de assinatura"
            icon={<FaTags className="text-2xl text-white" />}
            color="bg-pink-500"
          />
          <ActionCard
            to="/admin/audit-logs"
            title="Logs de Auditoria"
            description="Monitore ações importantes do sistema"
            icon={<FaShieldAlt className="text-2xl text-white" />}
            color="bg-teal-500"
          />
        </div>

        {/* Footer */}
        <div className="text-center mt-12 pt-8 border-t border-gray-200">
          <p className="text-gray-500 text-sm">
            DeuFome Master Dashboard • Sistema de Gestão Completo
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Última atualização: {format(lastUpdated, "dd/MM/yyyy 'às' HH:mm:ss")}
          </p>
        </div>
      </main>
    </div>
  );
}

export default MasterDashboard;