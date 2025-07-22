// src/pages/MasterDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
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
import { Bar, Pie, Line } from 'react-chartjs-2';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { auditLogger } from '../utils/auditLogger'; 
import MasterNotifications from '../components/MasterNotifications'; // IMPORT DO NOVO COMPONENTE DE NOTIFICAÇÕES

// Registra os componentes do Chart.js que você vai usar
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

// Se você tiver um componente Layout, descomente a linha abaixo e as tags <Layout>
// import Layout from './components/Layout'; // Se Layout está em src/components/Layout.jsx

function MasterDashboard() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();

  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState('');

  const [totalEstabelecimentos, setTotalEstabelecimentos] = useState(0);
  const [estabelecimentosAtivos, setEstabelecimentosAtivos] = useState(0);
  const [estabelecimentosInativos, setEstabelecimentosInativos] = useState(0);

  const [totalPedidosHoje, setTotalPedidosHoje] = useState(0);
  const [totalVendasHoje, setTotalVendasHoje] = useState(0);
  const [vendasPorDia, setVendasPorDia] = useState([]);

  const [allEstabelecimentos, setAllEstabelecimentos] = useState([]); // Para a tabela
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isMasterAdmin) {
        toast.error('Acesso negado. Você não tem permissões de Master Administrador.');
        navigate('/');
        return;
      }
      setLoadingDashboard(false);
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  useEffect(() => {
    if (isMasterAdmin && currentUser) {
      setLoadingDashboard(true);
      setDashboardError('');

      const unsubscribeEstabelecimentos = onSnapshot(
        collection(db, 'estabelecimentos'),
        (snapshot) => {
          const fetchedEstabelecimentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setAllEstabelecimentos(fetchedEstabelecimentos);
          setTotalEstabelecimentos(fetchedEstabelecimentos.length);
          setEstabelecimentosAtivos(fetchedEstabelecimentos.filter(est => est.ativo).length);
          setEstabelecimentosInativos(fetchedEstabelecimentos.filter(est => !est.ativo).length);
        },
        (error) => {
          console.error("Erro ao carregar estabelecimentos para o Master Dashboard:", error);
          setDashboardError("Erro ao carregar dados dos estabelecimentos.");
        }
      );

      const fetchPedidosData = async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const sevenDaysAgo = subDays(today, 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        try {
          const qTodayPedidos = query(
            collection(db, 'pedidos'),
            where('criadoEm', '>=', today)
          );
          const todaySnapshot = await getDocs(qTodayPedidos);
          let pedidosHojeCount = 0;
          let vendasHojeTotal = 0;
          todaySnapshot.forEach(doc => {
            pedidosHojeCount++;
            vendasHojeTotal += typeof doc.data().totalFinal === 'number' ? doc.data().totalFinal : 0;
          });
          setTotalPedidosHoje(pedidosHojeCount);
          setTotalVendasHoje(vendasHojeTotal);

          const qLast7Days = query(
            collection(db, 'pedidos'),
            where('criadoEm', '>=', sevenDaysAgo),
            orderBy('criadoEm', 'asc')
          );
          const last7DaysSnapshot = await getDocs(qLast7Days);

          const salesDataMap = new Map();
          let currentDay = new Date(sevenDaysAgo); // Começa do dia mais antigo
          while (currentDay <= today) { // Vai até hoje
            salesDataMap.set(format(currentDay, 'dd/MM', { locale: ptBR }), 0);
            currentDay = new Date(currentDay.setDate(currentDay.getDate() + 1));
          }

          last7DaysSnapshot.forEach(doc => {
            const pedidoData = doc.data();
            if (pedidoData.criadoEm && pedidoData.criadoEm.toDate && typeof pedidoData.totalFinal === 'number') {
              const dateKey = format(pedidoData.criadoEm.toDate(), 'dd/MM', { locale: ptBR });
              salesDataMap.set(dateKey, (salesDataMap.get(dateKey) || 0) + pedidoData.totalFinal);
            }
          });

          setVendasPorDia(Array.from(salesDataMap.entries()));

        } catch (error) {
          console.error("Erro ao carregar dados de pedidos e vendas:", error);
          setDashboardError("Erro ao carregar dados de vendas e pedidos.");
        }
      };

      fetchPedidosData();

      setLoadingDashboard(false);

      return () => {
        unsubscribeEstabelecimentos();
      };
    }
  }, [isMasterAdmin, currentUser]);

  const statusData = {
    labels: ['Ativos', 'Inativos'],
    datasets: [
      {
        data: [estabelecimentosAtivos, estabelecimentosInativos],
        backgroundColor: ['#4CAF50', '#F44336'],
        borderColor: ['#ffffff', '#ffffff'],
        borderWidth: 1,
      },
    ],
  };

  const statusOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Status dos Estabelecimentos',
      },
    },
  };

  const salesLabels = vendasPorDia.map(data => data[0]);
  const salesValues = vendasPorDia.map(data => data[1]);

  const salesData = {
    labels: salesLabels,
    datasets: [
      {
        label: 'Vendas Diárias (R$)',
        data: salesValues,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.1,
        fill: false,
      },
    ],
  };

  const salesOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Vendas Consolidadas (Últimos 7 Dias)',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
          }
        }
      }
    }
  };

  const toggleEstabelecimentoAtivo = async (estabelecimentoId, currentStatus, estabelecimentoNome) => {
    try {
      const estabRef = doc(db, 'estabelecimentos', estabelecimentoId);
      await updateDoc(estabRef, {
        ativo: !currentStatus,
        desativadoEm: !currentStatus ? new Date() : null // Registra a data de desativação se for desativado
      });
      auditLogger(
          currentStatus ? 'ESTABELECIMENTO_DESATIVADO' : 'ESTABELECIMENTO_ATIVADO',
          { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
          { type: 'estabelecimento', id: estabelecimentoId, name: estabelecimentoNome },
          { oldValue: currentStatus, newValue: !currentStatus }
      );
      toast.success(`Estabelecimento ${estabelecimentoNome} ${currentStatus ? 'desativado' : 'ativado'} com sucesso!`);
    } catch (error) {
      console.error("Erro ao alternar status do estabelecimento:", error);
      toast.error("Erro ao alternar status do estabelecimento.");
    }
  };

  const handleDeleteEstabelecimento = async (estabelecimentoId, estabelecimentoNome) => {
    if (window.confirm(`Tem certeza que deseja DELETAR o estabelecimento "${estabelecimentoNome}"? Esta ação é irreversível.`)) {
      try {
        await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId));
        auditLogger(
            'ESTABELECIMENTO_DELETADO',
            { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
            { type: 'estabelecimento', id: estabelecimentoId, name: estabelecimentoNome }
        );
        toast.success(`Estabelecimento "${estabelecimentoNome}" deletado com sucesso!`);
      } catch (error) {
        console.error("Erro ao deletar estabelecimento:", error);
        toast.error(`Erro ao deletar o estabelecimento "${estabelecimentoNome}".`);
      }
    }
  };

  const filteredEstabelecimentos = allEstabelecimentos.filter(estab => {
    const matchesSearchTerm = estab.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (estab.adminUID && estab.adminUID.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = filterStatus === 'todos' ||
                          (filterStatus === 'ativos' && estab.ativo) ||
                          (filterStatus === 'inativos' && !estab.ativo);

    return matchesSearchTerm && matchesStatus;
  });

  if (authLoading || loadingDashboard) {
    return (
      // <Layout>
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
          <p className="text-xl text-gray-700">Carregando Master Dashboard...</p>
        </div>
      // </Layout>
    );
  }

  if (!currentUser || !isMasterAdmin) {
    return null;
  }

  return (
    // <Layout>
      <div className="p-4 bg-gray-100 min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto">
          {/* Cabeçalho do Dashboard com Título e Botões de Navegação Rápida */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 text-center sm:text-left">
              🚀 Master Dashboard
            </h1>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
              <Link to="/admin/cadastrar-estabelecimento" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-md flex items-center gap-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                Novo Estabelecimento
              </Link>
              <Link to="/master/usuarios" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-md flex items-center gap-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.435-.14-.852-.413-1.2C6.287 16.48 5.768 16 5 16s-1.287.48-1.587.8c-.273.348-.413.765-.413 1.2v2h3.5"></path></svg>
                Gerenciar Usuários
              </Link>
              <Link to="/master/pedidos" className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg shadow-md flex items-center gap-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                Ver Todos os Pedidos
              </Link>
              <Link to="/master/estabelecimentos" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md flex items-center gap-1">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                 Listar Estabelecimentos
              </Link>
              <Link to="/master/importar-cardapio" className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg shadow-md flex items-center gap-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Importar Cardápio
              </Link>
              <Link to="/master/plans" className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow-md flex items-center gap-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.28-.172.505-.388.675-.626z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                Gerenciar Planos
              </Link>
              <Link to="/admin/audit-logs" className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg shadow-md flex items-center gap-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V17a2 2 0 01-2 2z"></path></svg>
                Logs de Auditoria
              </Link>
            </div>
          </div>

          {dashboardError && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
              <p className="font-bold">Erro ao Carregar Dados:</p>
              <p>{dashboardError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6 text-center hover:shadow-lg transition-shadow duration-300 flex flex-col items-center justify-center">
              <div className="text-blue-600 mb-2">
                <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m7 0V5a2 2 0 012-2h2a2 2 0 012 2v6m-6 0h-2"></path></svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-700">Total de Estabelecimentos</h2>
              <p className="text-4xl font-bold text-blue-800">{totalEstabelecimentos}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 text-center hover:shadow-lg transition-shadow duration-300 flex flex-col items-center justify-center">
              <div className="text-green-600 mb-2">
                <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-700">Estabelecimentos Ativos</h2>
              <p className="text-4xl font-bold text-green-800">{estabelecimentosAtivos}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 text-center hover:shadow-lg transition-shadow duration-300 flex flex-col items-center justify-center">
              <div className="text-red-600 mb-2">
                <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-700">Estabelecimentos Inativos</h2>
              <p className="text-4xl font-bold text-red-800">{estabelecimentosInativos}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 text-center hover:shadow-lg transition-shadow duration-300 flex flex-col items-center justify-center">
              <div className="text-orange-600 mb-2">
                <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c1.657 0 3 .895 3 2s-1.343 2-3 2m0 0V5m0 0c1.115 1.488 2 2.798 2 4c0 1.202-.885 2.512-2 4m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-700">Vendas Hoje</h2>
              <p className="text-4xl font-bold text-orange-800">R$ {totalVendasHoje.toFixed(2).replace('.', ',')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6 h-96 flex flex-col">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Vendas Consolidadas (Últimos 7 Dias)</h2>
              <div className="flex-grow">
                <Line data={salesData} options={salesOptions} />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 h-96 flex flex-col">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Status dos Estabelecimentos</h2>
              <div className="flex-grow flex items-center justify-center">
                <Pie data={statusData} options={statusOptions} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Filtrar Estabelecimentos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">Buscar por Nome/Admin UID:</label>
                <input
                  type="text"
                  id="search"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                  placeholder="Pesquisar estabelecimentos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Status:</label>
                <select
                  id="statusFilter"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="todos">Todos</option>
                  <option value="ativos">Ativos</option>
                  <option value="inativos">Inativos</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEstabelecimentos.length === 0 ? (
              <p className="text-gray-500 text-center py-8 col-span-full">Nenhum estabelecimento encontrado com os critérios de busca/filtro.</p>
            ) : (
              filteredEstabelecimentos.map(estab => (
                <div key={estab.id} className="bg-white rounded-lg shadow-md p-6 flex flex-col justify-between hover:shadow-lg transition-shadow duration-300">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800 mb-2 flex items-center justify-between">
                      {estab.nome}
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        estab.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {estab.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </h2>
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">Slug:</span> {estab.slug}
                    </p>
                    <p className="text-sm text-gray-600 mb-4">
                      <span className="font-medium">Admin UID:</span> {estab.adminUID ? estab.adminUID.substring(0, 10) + '...' : 'N/A'}
                    </p>
                  </div>
                  <div className="flex justify-end space-x-2 mt-4">
                    <Link
                      to={`/master/estabelecimentos/${estab.id}/editar`}
                      className="px-3 py-1 rounded-md bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => toggleEstabelecimentoAtivo(estab.id, estab.ativo, estab.nome)}
                      className={`px-3 py-1 rounded-md text-white ${
                        estab.ativo ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                      }`}
                    >
                      {estab.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      onClick={() => handleDeleteEstabelecimento(estab.id, estab.nome)}
                      className="px-3 py-1 rounded-md bg-gray-500 hover:bg-gray-600 text-white"
                    >
                      Deletar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    // </Layout>
  );
}

export default MasterDashboard;