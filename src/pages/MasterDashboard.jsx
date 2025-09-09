// src/pages/MasterDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, onSnapshot, getDocs, query, orderBy } from 'firebase/firestore';
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
  PointElement,
  LineElement,
} from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { format, subDays } from 'date-fns';
import { FaStore, FaUsers, FaClipboardList, FaFileUpload, FaTags, FaShieldAlt, FaImages } from 'react-icons/fa'; // <<<--- LINHA DE IMPORTAÇÃO CORRIGIDA

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);


function DashboardHeader({ currentUser, logout, navigate }) {
  const userEmailPrefix = currentUser.email ? currentUser.email.split('@')[0] : 'Usuário';

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Você foi desconectado com sucesso!');
      navigate('/');
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      toast.error('Ocorreu um erro ao tentar desconectar.');
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-20 p-6 flex justify-between items-center bg-black shadow-lg border-b border-gray-800">
      <div className="font-extrabold text-2xl text-white cursor-pointer hover:text-yellow-500 transition-colors duration-300" onClick={() => navigate('/')}>
        DEU FOME <span className="text-yellow-500">.</span>
      </div>
      <div className="flex items-center space-x-4">
        <span className="text-white text-md font-medium">Olá, {userEmailPrefix}!</span>
        <Link to="/master-dashboard" className="px-4 py-2 rounded-full text-black bg-yellow-500 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-yellow-600 hover:shadow-md">
            Dashboard
        </Link>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-full text-white border border-yellow-500 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-yellow-500 hover:text-black"
        >
          Sair
        </button>
      </div>
    </header>
  );
}


function MasterDashboard() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState('');

  const [stats, setStats] = useState({
    totalEstabelecimentos: 0,
    estabelecimentosAtivos: 0,
    totalUsuarios: 0,
    totalPedidos: 0,
    faturamentoTotal: 0,
  });

  const [pedidosPorEstabelecimento, setPedidosPorEstabelecimento] = useState({
    labels: [],
    datasets: [],
  });

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser || !isMasterAdmin) {
      toast.error('Acesso negado.');
      navigate('/');
      return;
    }

    const fetchAllData = async () => {
      setLoadingDashboard(true);
      try {
        const estabQuery = query(collection(db, 'estabelecimentos'));
        const usersQuery = query(collection(db, 'usuarios'));
        const pedidosQuery = query(collection(db, 'pedidos'));
        
        const [estabSnapshot, usersSnapshot, pedidosSnapshot] = await Promise.all([
          getDocs(estabQuery),
          getDocs(usersQuery),
          getDocs(pedidosQuery),
        ]);

        const estabs = estabSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const pedidos = pedidosSnapshot.docs.map(doc => doc.data());

        const faturamentoTotal = pedidos.reduce((sum, pedido) => sum + (pedido.totalFinal || 0), 0);
        
        setStats({
          totalEstabelecimentos: estabs.length,
          estabelecimentosAtivos: estabs.filter(e => e.ativo).length,
          totalUsuarios: usersSnapshot.size,
          totalPedidos: pedidos.length,
          faturamentoTotal,
        });
        
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

        setPedidosPorEstabelecimento({
          labels: Object.keys(pedidosCount),
          datasets: [{
            label: 'Número de Pedidos',
            data: Object.values(pedidosCount),
            backgroundColor: [
              'rgba(59, 130, 246, 0.6)',
              'rgba(239, 68, 68, 0.6)',
              'rgba(22, 163, 74, 0.6)',
              'rgba(168, 85, 247, 0.6)',
              'rgba(236, 72, 153, 0.6)',
            ],
          }],
        });

      } catch (err) {
        console.error("Erro ao carregar dados do dashboard:", err);
        setDashboardError('Falha ao carregar dados.');
      } finally {
        setLoadingDashboard(false);
      }
    };

    if (isMasterAdmin) {
      fetchAllData();
    }
  }, [isMasterAdmin, currentUser, authLoading, navigate]);

  const statusData = {
    labels: ['Ativos', 'Inativos'],
    datasets: [{
      data: [stats.estabelecimentosAtivos, stats.totalEstabelecimentos - stats.estabelecimentosAtivos],
      backgroundColor: ['#22c55e', '#ef4444'],
      borderColor: '#111827',
      borderWidth: 2,
    }],
  };
  
  const statusOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { color: '#e5e7eb', font: { size: 14 } } },
    },
  };

  if (authLoading || loadingDashboard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xl">Carregando Dashboard Master...</p>
      </div>
    );
  }
  
  if (dashboardError) {
    return <div className="p-8 text-center text-red-400">{dashboardError}</div>;
  }
  
  return (
    <div className="bg-gray-900 min-h-screen pt-24 pb-8 px-4 text-white">
      <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} />
      <main className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-extrabold mb-8 text-center md:text-left">Dashboard Master</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 p-6 rounded-lg text-center border border-gray-700">
            <h2 className="text-lg font-medium text-gray-400">Total de Estabelecimentos</h2>
            <p className="text-4xl font-extrabold text-yellow-400 mt-2">{stats.totalEstabelecimentos}</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg text-center border border-gray-700 col-span-1 md:col-span-2 lg:col-span-3">
            <h2 className="text-lg font-medium text-gray-400 mb-4">Status dos Estabelecimentos</h2>
            <div className="h-40"><Pie data={statusData} options={statusOptions} /></div>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-6 border-b-2 border-yellow-500 pb-2">Gerenciamento</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <Link to="/master/estabelecimentos" className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition-all duration-300 flex flex-col items-center justify-center shadow-lg border border-gray-700">
            <FaStore size={40} className="mb-4 text-blue-400" />
            <h3 className="text-xl font-bold text-center">Estabelecimentos</h3>
            <p className="text-gray-400 text-sm text-center mt-2">Listar, editar e gerenciar todos os estabelecimentos.</p>
          </Link>
          <Link to="/master/usuarios" className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition-all duration-300 flex flex-col items-center justify-center shadow-lg border border-gray-700">
            <FaUsers size={40} className="mb-4 text-green-400" />
            <h3 className="text-xl font-bold text-center">Usuários</h3>
            <p className="text-gray-400 text-sm text-center mt-2">Criar, editar e gerenciar usuários e suas permissões.</p>
          </Link>
          <Link to="/master/pedidos" className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition-all duration-300 flex flex-col items-center justify-center shadow-lg border border-gray-700">
            <FaClipboardList size={40} className="mb-4 text-yellow-400" />
            <h3 className="text-xl font-bold text-center">Todos os Pedidos</h3>
            <p className="text-gray-400 text-sm text-center mt-2">Visualizar o histórico de pedidos de toda a plataforma.</p>
          </Link>
          <Link to="/master/importar-cardapio" className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition-all duration-300 flex flex-col items-center justify-center shadow-lg border border-gray-700">
            <FaFileUpload size={40} className="mb-4 text-red-400" />
            <h3 className="text-xl font-bold text-center">Importar Cardápio</h3>
            <p className="text-gray-400 text-sm text-center mt-2">Fazer upload de cardápios em massa para estabelecimentos.</p>
          </Link>
          <Link to="/master/associar-imagens" className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition-all duration-300 flex flex-col items-center justify-center shadow-lg border border-gray-700">
            <FaImages size={40} className="mb-4 text-purple-400" />
            <h3 className="text-xl font-bold text-center">Associar Imagens</h3>
            <p className="text-gray-400 text-sm text-center mt-2">Faça o upload e vincule fotos aos produtos do cardápio.</p>
          </Link>
          <Link to="/master/plans" className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition-all duration-300 flex flex-col items-center justify-center shadow-lg border border-gray-700">
            <FaTags size={40} className="mb-4 text-pink-400" />
            <h3 className="text-xl font-bold text-center">Planos de Assinatura</h3>
            <p className="text-gray-400 text-sm text-center mt-2">Gerenciar os planos disponíveis para os estabelecimentos.</p>
          </Link>
          <Link to="/admin/audit-logs" className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition-all duration-300 flex flex-col items-center justify-center shadow-lg border border-gray-700">
            <FaShieldAlt size={40} className="mb-4 text-teal-400" />
            <h3 className="text-xl font-bold text-center">Logs de Auditoria</h3>
            <p className="text-gray-400 text-sm text-center mt-2">Monitorar ações importantes realizadas no sistema.</p>
          </Link>
        </div>
      </main>
    </div>
  );
}

export default MasterDashboard;