// src/pages/MasterDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { getAuth } from "firebase/auth"; 
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

// --- Componente de Header Master Dashboard ---
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
    <header className="fixed top-0 left-0 right-0 z-20 p-6 flex justify-between items-center bg-black shadow-lg border-b border-gray-800"> {/* Sombra mais forte */}
      <div className="font-extrabold text-2xl text-white cursor-pointer hover:text-yellow-500 transition-colors duration-300" onClick={() => navigate('/')}> {/* Efeito hover no logo */}
        DEU FOME <span className="text-yellow-500">.</span>
      </div>
      <div className="flex items-center space-x-4">
        <span className="text-white text-md font-medium">Olá, {userEmailPrefix}!</span>
        <Link to="/master-dashboard" className="px-4 py-2 rounded-full text-black bg-yellow-500 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-yellow-600 hover:shadow-md">
            Dashboard
        </Link>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-full text-white border border-yellow-500 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-yellow-500 hover:text-black" // Botão Sair com borda amarela
        >
          Sair
        </button>
      </div>
    </header>
  );
}
// --- Fim DashboardHeader ---


function MasterDashboard() {
  const navigate = useNavigate();
  const { currentUser, loading: authLoading, logout } = useAuth(); 

  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState('');

  // ESTADOS PARA DADOS DO DASHBOARD
  const [totalEstabelecimentos, setTotalEstabelecimentos] = useState(0);
  const [estabelecimentosAtivos, setEstabelecimentosAtivos] = useState(0);
  const [estabelecimentosInativos, setEstabelecimentosInativos] = useState(0);

  const [totalPedidosHoje, setTotalPedidosHoje] = useState(0);
  const [totalVendasHoje, setTotalVendasHoje] = useState(0);
  const [vendasPorDia, setVendasPorDia] = useState([]);

  // ESTADOS PARA A TABELA DE ESTABELECIMENTOS
  const [allEstabelecimentos, setAllEstabelecimentos] = useState([]); 
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');

  // isMasterAdmin real, obtido do token após o refresh
  const [isMasterAdminLocal, setIsMasterAdminLocal] = useState(false); 


  // useEffect 1: Lida com a autenticação, permissões e o disparo da carga inicial do dashboard
  useEffect(() => {
    if (authLoading) { 
      setLoadingDashboard(true);
      return;
    }

    if (!currentUser) { 
      toast.error('Você precisa estar logado para acessar esta página.');
      navigate('/');
      setLoadingDashboard(false);
      return;
    }

    async function checkMasterAdminStatus() {
      try {
        const authInstance = getAuth();
        const idTokenResult = await authInstance.currentUser.getIdTokenResult(true); 
        const masterAdminStatus = idTokenResult.claims.isMasterAdmin === true;
        setIsMasterAdminLocal(masterAdminStatus); 

        if (!masterAdminStatus) { 
          toast.error('Acesso negado. Você não tem permissões de Master Administrador.');
          navigate('/');
          setLoadingDashboard(false);
          return;
        }

        setLoadingDashboard(false); 
      } catch (error) {
        console.error("MasterDashboard: Erro ao verificar permissões:", error);
        toast.error(`Erro ao verificar permissões: ${error.message}. Por favor, faça login novamente.`);
        logout(); 
        navigate('/');
        setLoadingDashboard(false);
      }
    }
    checkMasterAdminStatus();
  }, [currentUser, authLoading, navigate, logout]);


  // useEffect 2: Carrega os dados do dashboard APENAS se o usuário for Master Admin (confirmado localmente)
  useEffect(() => {
    if (isMasterAdminLocal && currentUser) {
      // Listener para estabelecimentos (contagem total, ativos, inativos)
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
          if (error.code === 'permission-denied') {
            toast.error('Permissão negada ao carregar estabelecimentos. Verifique as regras do Firestore.');
          }
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
          let currentDay = new Date(sevenDaysAgo); 
          while (currentDay <= today) { 
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
          if (error.code === 'permission-denied') {
            toast.error('Permissão negada ao carregar pedidos. Verifique as regras do Firestore.');
          }
        }
      };

      fetchPedidosData(); 

      return () => {
        unsubscribeEstabelecimentos(); 
      };
    } else if (!authLoading && !isMasterAdminLocal) {
      setLoadingDashboard(false);
    }
  }, [isMasterAdminLocal, currentUser, authLoading]);


  // --- Gráficos: Cores e Estilos Ajustados para Preto/Amarelo/Branco ---
  const statusData = {
    labels: ['Ativos', 'Inativos'],
    datasets: [
      {
        data: [estabelecimentosAtivos, estabelecimentosInativos],
        backgroundColor: ['#FFC107', '#212529'], 
        borderColor: ['#ffffff', '#ffffff'], 
        borderWidth: 2,
      },
    ],
  };

  const statusOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right', 
        labels: {
            color: '#212529', 
            font: {
                size: 14,
                weight: 'bold'
            }
        }
      },
      title: {
        display: false, 
      },
    },
    layout: {
        padding: { 
            left: 10,
            right: 10,
            top: 20,
            bottom: 10
        }
    }
  };

  const salesLabels = vendasPorDia.map(data => data[0]);
  const salesValues = vendasPorDia.map(data => data[1]);

  const salesData = {
    labels: salesLabels,
    datasets: [
      {
        label: 'Vendas Diárias (R$)',
        data: salesValues,
        borderColor: '#FFC107', 
        backgroundColor: 'rgba(255, 193, 7, 0.1)', 
        tension: 0.4, 
        fill: true, 
        pointBackgroundColor: '#FFC107',
        pointBorderColor: '#fff',
        pointRadius: 5,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: '#212529', 
        pointHoverBorderColor: '#FFC107',
      },
    ],
  };

  const salesOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
            color: '#212529', 
            font: {
                size: 14,
                weight: 'bold'
            }
        }
      },
      title: {
        display: false,
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
        },
        backgroundColor: '#212529',
        titleColor: '#FFC107',
        bodyColor: '#FFFFFF',
        borderColor: '#FFC107',
        borderWidth: 1,
        cornerRadius: 4,
        displayColors: false, 
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#212529'
        },
        grid: {
          color: 'rgba(0,0,0,0.05)'
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
          },
          color: '#212529'
        },
        grid: {
          color: 'rgba(0,0,0,0.05)'
        }
      }
    }
  };

  const toggleEstabelecimentoAtivo = async (estabelecimentoId, currentStatus, estabelecimentoNome) => {
    try {
      const authInstance = getAuth();
      const idTokenResult = await authInstance.currentUser.getIdTokenResult();
      if (idTokenResult.claims.isMasterAdmin !== true) {
        toast.error('Apenas o Master Administrador pode alterar o status de estabelecimentos.');
        return;
      }

      const estabRef = doc(db, 'estabelecimentos', estabelecimentoId);
      await updateDoc(estabRef, {
        ativo: !currentStatus,
        desativadoEm: !currentStatus ? new Date() : null 
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
      if (error.code === 'permission-denied') {
        toast.error('Permissão negada ao alterar status do estabelecimento.');
      }
    }
  };

  const handleDeleteEstabelecimento = async (estabelecimentoId, estabelecimentoNome) => {
    if (window.confirm(`Tem certeza que deseja DELETAR o estabelecimento "${estabelecimentoNome}"? Esta ação é irreversível.`)) {
      try {
        const authInstance = getAuth();
        const idTokenResult = await authInstance.currentUser.getIdTokenResult();
        if (idTokenResult.claims.isMasterAdmin !== true) {
          toast.error('Apenas o Master Administrador pode deletar estabelecimentos.');
          return;
        }

        await deleteDoc(doc(db, 'estabelecimentos', establishmentId));
        auditLogger(
            'ESTABELECIMENTO_DELETADO',
            { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
            { type: 'estabelecimento', id: establishmentId, name: estabelecimentoNome }
        );
        toast.success(`Estabelecimento "${estabelecimentoNome}" deletado com sucesso!`);
      } catch (error) {
        console.error("Erro ao deletar estabelecimento:", error);
        toast.error(`Erro ao deletar o estabelecimento "${estabelecimentoNome}".`);
        if (error.code === 'permission-denied') {
          toast.error('Permissão negada ao deletar estabelecimento.');
        }
      }
    }
  };

  // Filtragem da tabela de estabelecimentos
  const filteredEstabelecimentos = allEstabelecimentos.filter(estab => {
    const matchesSearchTerm = estab.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (estab.adminUID && estab.adminUID.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = filterStatus === 'todos' ||
                          (filterStatus === 'ativos' && estab.ativo) ||
                          (filterStatus === 'inativos' && !estab.ativo);

    return matchesSearchTerm && matchesStatus;
  });

  // Renderização condicional para loading e erros
  if (authLoading || loadingDashboard) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
          <p className="text-xl text-black">Carregando Dashboard Master...</p>
        </div>
    );
  }

  // Se não é Master Admin, ou não está logado, já foi redirecionado pelo useEffect 1
  if (!currentUser || !isMasterAdminLocal) { 
    return null; 
  }

  return (
    <div className="bg-gray-50 min-h-screen pt-24 pb-8 px-4">
      <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} /> 
      <div className="max-w-7xl mx-auto">
        {dashboardError && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-8 rounded-md" role="alert">
            <p className="font-bold">Erro ao Carregar Dados:</p>
            <p>{dashboardError}</p>
          </div>
        )}

        <h1 className="text-3xl font-extrabold text-black mb-8 text-center md:text-left">
          🚀 Dashboard Master
          <div className="w-24 h-1 bg-yellow-500 mx-auto md:mx-0 mt-2 rounded-full"></div>
        </h1>

        {/* Botões de Navegação Rápida */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-10">
            <Link to="/admin/cadastrar-estabelecimento" className="bg-yellow-500 text-black font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-yellow-600 transition-colors duration-300 flex items-center justify-center gap-2 text-center">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"></path></svg>
                <span>Novo Estab.</span>
            </Link>
            <Link to="/master/usuarios" className="bg-yellow-500 text-black font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-yellow-600 transition-colors duration-300 flex items-center justify-center gap-2 text-center">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12 10a4 4 0 01-4 4H8a4 4 0 01-4-4v-2a4 4 0 014-4h4a4 4 0 014 4v2z" /></svg>
                <span>Gerenciar Usuários</span>
            </Link>
            <Link to="/master/pedidos" className="bg-yellow-500 text-black font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-yellow-600 transition-colors duration-300 flex items-center justify-center gap-2 text-center">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2V1a1 1 0 010 2h2V1a1 1 0 011-1h2a1 1 0 011 1v2h2a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 0h6v3H7V5zm6 4H7v7h6V9z" clipRule="evenodd"></path></svg>
                <span>Ver Pedidos (Geral)</span>
            </Link>
            <Link to="/master/estabelecimentos" className="bg-yellow-500 text-black font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-yellow-600 transition-colors duration-300 flex items-center justify-center gap-2 text-center">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"></path></svg>
                <span>Listar Estab. (Geral)</span>
            </Link>
            <Link to="/master/importar-cardapio" className="bg-yellow-500 text-black font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-yellow-600 transition-colors duration-300 flex items-center justify-center gap-2 text-center">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-3.232l-1.664-1.664A1.998 1.998 0 0010 2H7a2 2 0 00-2 2v1z" /></svg>
                <span>Importar Cardápio</span>
            </Link>
            <Link to="/master/plans" className="bg-yellow-500 text-black font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-yellow-600 transition-colors duration-300 flex items-center justify-center gap-2 text-center">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /></svg>
                <span>Gerenciar Planos</span>
            </Link>
            <Link to="/admin/audit-logs" className="bg-yellow-500 text-black font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-yellow-600 transition-colors duration-300 flex items-center justify-center gap-2 text-center">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V17a2 2 0 01-2 2z" /></svg>
                <span>Logs Auditoria</span>
            </Link>
        </div>

        {/* Cards de Visão Geral */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Card: Total de Estabelecimentos */}
            <div className="bg-white rounded-lg shadow-md p-6 text-center hover:shadow-lg transition-shadow duration-300 flex flex-col items-center justify-center">
                <div className="text-black mb-2">
                    <svg className="w-10 h-10 mx-auto" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10 2a6 6 0 00-6 6v3.586l1.707 1.707A1 1 0 006.707 14H13.293a1 1 0 00.707-.293l1.707-1.707V8a6 6 0 00-6-6zM14 17a1 1 0 100-2H6a1 1 0 100 2h8z" /></svg>
                </div>
                <h2 className="text-lg font-medium text-gray-700">Total de Estabelecimentos</h2>
                <p className="text-4xl font-extrabold text-yellow-500 mt-2">{totalEstabelecimentos}</p>
            </div>
            {/* Card: Estabelecimentos Ativos */}
            <div className="bg-white rounded-lg shadow-md p-6 text-center hover:shadow-lg transition-shadow duration-300 flex flex-col items-center justify-center">
                <div className="text-black mb-2">
                    <svg className="w-10 h-10 mx-auto" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                </div>
                <h2 className="text-lg font-medium text-gray-700">Estabelecimentos Ativos</h2>
                <p className="text-4xl font-extrabold text-black mt-2">{estabelecimentosAtivos}</p>
            </div>
            {/* Card: Estabelecimentos Inativos */}
            <div className="bg-white rounded-lg shadow-md p-6 text-center hover:shadow-lg transition-shadow duration-300 flex flex-col items-center justify-center">
                <div className="text-black mb-2">
                    <svg className="w-10 h-10 mx-auto" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path></svg>
                </div>
                <h2 className="text-lg font-medium text-gray-700">Estabelecimentos Inativos</h2>
                <p className="text-4xl font-extrabold text-black mt-2">{estabelecimentosInativos}</p>
            </div>
            {/* Card: Vendas Hoje */}
            <div className="bg-white rounded-lg shadow-md p-6 text-center hover:shadow-lg transition-shadow duration-300 flex flex-col items-center justify-center">
                <div className="text-black mb-2">
                    <svg className="w-10 h-10 mx-auto" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l3 3a1 1 0 001.414-1.414L11 9.586V6z" clipRule="evenodd"></path></svg>
                </div>
                <h2 className="text-lg font-medium text-gray-700">Vendas Hoje</h2>
                <p className="text-4xl font-extrabold text-yellow-500 mt-2">R$ {totalVendasHoje.toFixed(2).replace('.', ',')}</p>
            </div>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Gráfico de Vendas Consolidadas */}
            <div className="bg-white rounded-lg shadow-md p-6 h-96 flex flex-col">
                <h2 className="text-xl font-semibold mb-4 text-black">Vendas Consolidadas (Últimos 7 Dias)</h2>
                <div className="flex-grow">
                    <Line data={salesData} options={salesOptions} />
                </div>
            </div>
            {/* Gráfico de Status dos Estabelecimentos */}
            <div className="bg-white rounded-lg shadow-md p-6 h-96 flex flex-col">
                <h2 className="text-xl font-semibold mb-4 text-black">Status dos Estabelecimentos</h2>
                <div className="flex-grow flex items-center justify-center">
                    <Pie data={statusData} options={statusOptions} />
                </div>
            </div>
        </div>

        {/* Seção de Gerenciamento de Estabelecimentos */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-6 text-black">Gerenciar Estabelecimentos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                    <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">Buscar por Nome/Admin UID:</label>
                    <input
                        type="text"
                        id="search"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 p-2"
                        placeholder="Pesquisar estabelecimentos..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div>
                    <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Status:</label>
                    <select
                        id="statusFilter"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 p-2 bg-white"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="todos">Todos</option>
                        <option value="ativos">Ativos</option>
                        <option value="inativos">Inativos</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">Nome</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">Slug</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">Admin UID</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-black uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredEstabelecimentos.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">Nenhum estabelecimento encontrado com os critérios de busca/filtro.</td>
                            </tr>
                        ) : (
                            filteredEstabelecimentos.map(estab => (
                                <tr key={estab.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{estab.nome}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{estab.slug}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{estab.adminUID ? estab.adminUID.substring(0, 10) + '...' : 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            estab.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                            {estab.ativo ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <Link to={`/master/estabelecimentos/${estab.id}/editar`} className="text-blue-600 hover:text-blue-900 mr-4">
                                            Editar
                                        </Link>
                                        <button
                                            onClick={() => toggleEstabelecimentoAtivo(estab.id, estab.ativo, estab.nome)}
                                            className={`font-medium ${estab.ativo ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'} mr-4`}
                                        >
                                            {estab.ativo ? 'Desativar' : 'Ativar'}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteEstabelecimento(estab.id, estab.nome)}
                                            className="text-gray-600 hover:text-gray-900"
                                        >
                                            Deletar
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
}

export default MasterDashboard;