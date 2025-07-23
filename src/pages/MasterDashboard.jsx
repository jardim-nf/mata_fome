// src/pages/MasterDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { getAuth } from "firebase/auth"; // Importar getAuth para forçar o refresh do token
import { // Importações do Chart.js
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
import { Bar, Pie, Line } from 'react-chartjs-2'; // Componentes de gráfico
import { format, subDays } from 'date-fns'; // Funções de data
import { ptBR } from 'date-fns/locale'; // Localização para datas
import { auditLogger } from '../utils/auditLogger'; // Utilitário de log de auditoria
import MasterNotifications from '../components/MasterNotifications'; // Componente de notificações

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
  // Extrai o prefixo do email do usuário para exibir na saudação
  const userEmailPrefix = currentUser.email ? currentUser.email.split('@')[0] : 'Usuário';

  // Função para lidar com o logout do usuário
  const handleLogout = async () => {
    try {
      await logout(); // Chama a função de logout do contexto de autenticação
      toast.success('Você foi desconectado com sucesso!'); // Notificação de sucesso
      navigate('/'); // Redireciona para a página inicial
    } catch (error) {
      console.error("Erro ao fazer logout:", error); // Loga o erro no console
      toast.error('Ocorreu um erro ao tentar desconectar.'); // Notificação de erro
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-20 p-6 flex justify-between items-center bg-white shadow-sm border-b border-gray-100">
      <div className="font-extrabold text-2xl text-black cursor-pointer hover:text-gray-800 transition-colors duration-300" onClick={() => navigate('/')}>
        DEU FOME <span className="text-yellow-500">.</span>
      </div>
      <div className="flex items-center space-x-4">
        <span className="text-black text-md font-medium">Olá, {userEmailPrefix}!</span>
        {/* Links de navegação rápida dentro do header */}
        <Link to="/master-dashboard" className="px-4 py-2 rounded-full text-black bg-yellow-500 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-yellow-600 hover:shadow-md">
            Dashboard
        </Link>
        <button
          onClick={handleLogout} // Ação de logout
          className="px-4 py-2 rounded-full text-black border border-gray-300 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-gray-100 hover:border-gray-400"
        >
          Sair
        </button>
      </div>
    </header>
  );
}
// --- Fim DashboardHeader ---


// --- Componente Principal MasterDashboard ---
function MasterDashboard() {
  const navigate = useNavigate(); // Hook para navegação
  // Hook useAuth fornece currentUser (usuário logado), isMasterAdmin (claim), e loading (status da autenticação)
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth(); 

  // Estados para controlar o carregamento e erros do dashboard
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState('');

  // Estados para dados de estabelecimentos
  const [totalEstabelecimentos, setTotalEstabelecimentos] = useState(0);
  const [estabelecimentosAtivos, setEstabelecimentosAtivos] = useState(0);
  const [estabelecimentosInativos, setEstabelecimentosInativos] = useState(0);

  // Estados para dados de pedidos e vendas
  const [totalPedidosHoje, setTotalPedidosHoje] = useState(0);
  const [totalVendasHoje, setTotalVendasHoje] = useState(0);
  const [vendasPorDia, setVendasPorDia] = useState([]);

  // Estados para gerenciamento de estabelecimentos na tabela
  const [allEstabelecimentos, setAllEstabelecimentos] = useState([]); 
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');

  // PRIMEIRO useEffect: Lida com o redirecionamento inicial e verificação básica de permissão
  useEffect(() => {
    // Só age quando o status de autenticação (authLoading) é finalizado
    if (!authLoading) {
      if (!currentUser) {
        // Se não há usuário logado, redireciona para a página inicial e mostra erro
        toast.error('Você precisa estar logado para acessar esta página.');
        navigate('/');
        return; // Sai do useEffect
      }
      // Se não é Master Admin, redireciona. isMasterAdmin é verificado pelo AuthContext.
      // O próximo useEffect fará a verificação mais granular com o refresh do token.
      if (!isMasterAdmin && (!currentUser.claims || !currentUser.claims.isAdmin)) { // Adicionado verificação para isAdmin no currentUser.claims
        toast.error('Acesso negado. Você não tem permissões de Administrador.');
        navigate('/');
        return; // Sai do useEffect
      }
      // Se passou pelas verificações básicas, o dashboard não está mais no "loadingAuth"
      // O loadingDashboard será controlado pelo segundo useEffect.
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  // SEGUNDO useEffect: Lida com o carregamento de dados e verificação de permissões avançada (com refresh do token)
  useEffect(() => {
    // Só tenta carregar dados se o AuthContext já terminou de carregar (authLoading é false)
    // E se há um currentUser
    // E se o usuário é Master Admin OU um Admin de Estabelecimento (com o estabelecimentoId na claim)
    if (!authLoading && currentUser) {
      setLoadingDashboard(true); // Ativa o estado de carregamento do dashboard
      setDashboardError(''); // Limpa mensagens de erro anteriores

      const auth = getAuth(); // Obtém a instância do Firebase Auth para o refresh do token

      // Função assíncrona para inicializar o dashboard, incluindo o refresh do token e carregamento de dados
      const initializeDashboard = async () => {
        try {
          // --- PASSO CHAVE: Força o refresh do token DE ID AQUI ---
          // O 'true' garante que as custom claims mais recentes do backend (definidas pelas Cloud Functions)
          // sejam buscadas e atualizadas no token do cliente.
          const idTokenResult = await auth.currentUser.getIdTokenResult(true);
          console.log("MasterDashboard: Custom Claims ATUALIZADAS após refresh:", idTokenResult.claims);

          // Pega os status de admin e o ID do estabelecimento das custom claims atualizadas
          const isMaster = idTokenResult.claims.isMasterAdmin === true;
          const isEstAdmin = idTokenResult.claims.isAdmin === true;
          const adminEstId = idTokenResult.claims.estabelecimentoId; // Este campo é CRUCIAL para admins de estabelecimento

          // Re-verifica as permissões após o refresh do token
          // Se não é Master Admin E (não é Admin de Estabelecimento OU não tem estabelecimentoId), então nega acesso
          if (!isMaster && (!isEstAdmin || !adminEstId)) {
            console.warn("MasterDashboard: Usuário logado mas sem as custom claims de admin/master admin necessárias ou incompletas. Redirecionando...");
            toast.error('Suas permissões foram alteradas ou estão incompletas. Acesso negado. Por favor, contate o suporte.');
            navigate('/'); // Redireciona para fora do dashboard
            setLoadingDashboard(false); // Desativa o carregamento
            return; // Sai da função
          }

          // --- Início do Carregamento de Dados do Firestore ---
          // As queries abaixo são ajustadas com base no papel do usuário (Master Admin vs. Admin de Estabelecimento)

          // 1. Carregamento de Estabelecimentos
          let estabelecimentosQueryRef;
          if (isMaster) {
            // Master Admin pode ver todos os estabelecimentos
            estabelecimentosQueryRef = collection(db, 'estabelecimentos');
          } else if (isEstAdmin && adminEstId) {
            // Admin de Estabelecimento vê APENAS o seu próprio estabelecimento na listagem
            // Adapte 'adminUID' ou 'id' conforme o campo que liga o estabelecimento ao admin.
            // Se o documento do estabelecimento tem um campo 'adminUID' com o UID do usuário:
            estabelecimentosQueryRef = query(collection(db, 'estabelecimentos'), where('adminUID', '==', currentUser.uid));
            // Ou se o ID do documento do estabelecimento é o adminEstId:
            // estabelecimentosQueryRef = query(collection(db, 'estabelecimentos'), where(documentId(), '==', adminEstId));
            console.log(`MasterDashboard: Admin de Estabelecimento (${currentUser.email}) filtrando estabelecimentos por adminUID: ${currentUser.uid}`);
          } else {
             // Caso de erro que já deveria ter sido pego acima, mas para segurança.
             setDashboardError("Permissões insuficientes ou perfil de admin incompleto para carregar estabelecimentos.");
             setLoadingDashboard(false);
             return;
          }

          const unsubscribeEstabelecimentos = onSnapshot(
            estabelecimentosQueryRef, // Usa a query ajustada para estabelecimentos
            (snapshot) => {
              const fetchedEstabelecimentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              setAllEstabelecimentos(fetchedEstabelecimentos);
              setTotalEstabelecimentos(fetchedEstabelecimentos.length);
              setEstabelecimentosAtivos(fetchedEstabelecimentos.filter(est => est.ativo).length);
              setEstabelecimentosInativos(fetchedEstabelecimentos.filter(est => !est.ativo).length);
            },
            (error) => {
              console.error("Erro ao carregar estabelecimentos para o Master Dashboard:", error);
              setDashboardError(`Erro ao carregar dados dos estabelecimentos: ${error.message}.`);
            }
          );

          // 2. Carregamento de Pedidos e Vendas (Dados para Gráficos e Cards)
          const fetchPedidosData = async () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const sevenDaysAgo = subDays(today, 6);
            sevenDaysAgo.setHours(0, 0, 0, 0);

            try {
              let pedidosBaseRef = collection(db, 'pedidos'); // Referência base para a coleção de pedidos
              let qTodayPedidos; // Query para pedidos de hoje
              let qLast7Days;    // Query para pedidos dos últimos 7 dias

              // --- AQUI ESTÁ A LÓGICA CRÍTICA DE FILTRAGEM DE PEDIDOS ---
              if (isMaster) {
                // Master Admin vê todos os pedidos (sem filtro de estabelecimentoId)
                qTodayPedidos = query(pedidosBaseRef, where('criadoEm', '>=', today));
                qLast7Days = query(pedidosBaseRef, where('criadoEm', '>=', sevenDaysAgo), orderBy('criadoEm', 'asc'));
                console.log("MasterDashboard: Master Admin carregando todos os pedidos.");
              } else if (isEstAdmin && adminEstId) {
                // Admin de Estabelecimento vê APENAS pedidos do seu estabelecimento
                qTodayPedidos = query(pedidosBaseRef,
                                      where('estabelecimentoId', '==', adminEstId), // FILTRO ESSENCIAL para o estabelecimento
                                      where('criadoEm', '>=', today));
                qLast7Days = query(pedidosBaseRef,
                                   where('estabelecimentoId', '==', adminEstId), // FILTRO ESSENCIAL para o estabelecimento
                                   where('criadoEm', '>=', sevenDaysAgo),
                                   orderBy('criadoEm', 'asc'));
                console.log(`MasterDashboard: Admin de Estabelecimento (${currentUser.email}) filtrando pedidos por estabelecimentoId: ${adminEstId}`);
              } else {
                // Cenário de erro: Se chegou aqui, as permissões são insuficientes ou incompletas
                setDashboardError("Não foi possível determinar as permissões de pedidos. Acesso restrito.");
                setLoadingDashboard(false);
                return; // Sai da função de fetch de pedidos
              }

              // Executa a query para pedidos de hoje
              const todaySnapshot = await getDocs(qTodayPedidos);
              let pedidosHojeCount = 0;
              let vendasHojeTotal = 0;
              todaySnapshot.forEach(doc => {
                pedidosHojeCount++;
                vendasHojeTotal += typeof doc.data().totalFinal === 'number' ? doc.data().totalFinal : 0;
              });
              setTotalPedidosHoje(pedidosHojeCount);
              setTotalVendasHoje(vendasHojeTotal);

              // Executa a query para os últimos 7 dias
              const last7DaysSnapshot = await getDocs(qLast7Days);

              // Lógica para calcular vendas por dia (sem alterações)
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

              console.log("Dados de pedidos e vendas carregados com sucesso.");

            } catch (error) {
              console.error("Erro ao carregar dados de pedidos e vendas:", error);
              setDashboardError(`Erro ao carregar dados de vendas e pedidos: ${error.message}.`);
            }
          };

          await fetchPedidosData(); // Garante que o carregamento de pedidos termine
          setLoadingDashboard(false); // Desativa o estado de carregamento do dashboard

          return () => {
            // Função de cleanup para desinscrever do listener do Firestore (estabelecimentos)
            unsubscribeEstabelecimentos();
          };

        } catch (error) {
          // Captura erros durante o refresh do token ou a verificação inicial de claims
          console.error("MasterDashboard: Erro durante a inicialização do dashboard (refresh do token ou verificação de claims):", error);
          setDashboardError(`Erro ao inicializar dashboard: ${error.message}. Por favor, tente recarregar ou faça login novamente.`);
          setLoadingDashboard(false); // Garante que o estado de carregamento seja desativado
          
          // Trata erros específicos de token expirado ou inválido
          if (error.code === 'auth/id-token-expired' || error.code === 'auth/user-token-expired') {
            toast.error('Sua sessão expirou. Por favor, faça login novamente.');
            logout(); // Força o logout através do contexto de autenticação
            navigate('/login'); // Redireciona para a página de login
          }
        }
      };

      initializeDashboard(); // Inicia o processo de inicialização do dashboard

    } else {
      // Se authLoading ainda é true ou currentUser é nulo, o primeiro useEffect já lidará com isso
      // ou o componente estará no estado de carregamento inicial.
    }
  }, [authLoading, currentUser, isMasterAdmin, navigate, logout]); // Dependências do useEffect


  // --- Gráficos: Cores e Estilos Ajustados para Preto/Amarelo/Branco ---
  const statusData = {
    labels: ['Ativos', 'Inativos'],
    datasets: [
      {
        data: [totalEstabelecimentos, estabelecimentosInativos], // Corrigido para usar totalEstabelecimentos
        backgroundColor: ['#FFC107', '#212529'], // Amarelo vibrante para ativos, preto para inativos
        borderColor: ['#ffffff', '#ffffff'], 
        borderWidth: 2, // Borda um pouco mais grossa para separar
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
            color: '#212529', // Preto
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
        padding: { // Aumentar um pouco o padding interno
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
        borderColor: '#FFC107', // Amarelo vibrante
        backgroundColor: 'rgba(255, 193, 7, 0.1)', // Amarelo com transparência para o preenchimento
        tension: 0.4, // Curva mais suave
        fill: true, // Preenche a área abaixo da linha
        pointBackgroundColor: '#FFC107',
        pointBorderColor: '#fff',
        pointRadius: 5, // Aumenta o tamanho dos pontos
        pointHoverRadius: 7, // Aumenta o tamanho dos pontos no hover
        pointHoverBackgroundColor: '#212529', // Ponto preto no hover
        pointHoverBorderColor: '#FFC107', // Borda amarela no hover
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
            color: '#212529', // Preto
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
        backgroundColor: '#212529', // Fundo preto para tooltip
        titleColor: '#FFC107', // Amarelo para título do tooltip
        bodyColor: '#FFFFFF', // Branco para corpo do tooltip
        borderColor: '#FFC107', // Borda amarela
        borderWidth: 1,
        cornerRadius: 4,
        displayColors: false, 
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#212529' // Preto
        },
        grid: {
          color: 'rgba(0,0,0,0.05)' // Linhas de grade mais suaves
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
          },
          color: '#212529' // Preto
        },
        grid: {
          color: 'rgba(0,0,0,0.05)' // Linhas de grade mais suaves
        }
      }
    }
  };

  const toggleEstabelecimentoAtivo = async (estabelecimentoId, currentStatus, estabelecimentoNome) => {
    try {
      const estabRef = doc(db, 'estabelecimentos', estabelecimentoId);
      await updateDoc(estabRef, {
        ativo: !currentStatus,
        desativadoEm: !currentStatus ? new Date() : null 
      });
      auditLogger(
          currentStatus ? 'ESTABELECIMENTO_DESATIVADO' : 'ESTABELECIMENTO_ATIVADO',
          { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' }, // Role aqui é fixo como masterAdmin, revisar se é master ou admin
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
            { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' }, // Role aqui é fixo como masterAdmin, revisar se é master ou admin
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
        <div className="flex flex-col items-center justify-center min-h-screen bg-white">
          <p className="text-xl text-black">Carregando Master Dashboard...</p>
        </div>
    );
  }

  // Acesso negado e redirecionamento são tratados no primeiro useEffect.
  // Se chegou aqui, as permissões básicas estão OK.
  return (
    <div className="bg-gray-50 min-h-screen pt-24 pb-8 px-4"> {/* Fundo principal levemente cinza */}
      <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} /> 
      <div className="max-w-7xl mx-auto">
        {dashboardError && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-8 rounded-md" role="alert">
            <p className="font-bold">Erro ao Carregar Dados:</p>
            <p>{dashboardError}</p>
          </div>
        )}

        <h1 className="text-3xl font-extrabold text-black mb-8 text-center md:text-left">
          🚀 Painel (Blackburger Barra Alegre) {/* Título mais específico do estabelecimento */}
          <div className="w-24 h-1 bg-yellow-500 mx-auto md:mx-0 mt-2 rounded-full"></div>
        </h1>

        {/* Botões de Navegação Rápida (Manter, mas talvez alguns sejam apenas para MasterAdmin) */}
        {/* Você pode adicionar uma condição aqui: {isMasterAdmin && ( ... seus botões MasterAdmin ... )} */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-10">
             {/* Exemplo de botão condicional para MasterAdmin */}
             {isMasterAdmin && ( // Botões que só Master Admin pode ver
                 <>
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
                        <span>Importar Cardápio (Geral)</span>
                    </Link>
                    <Link to="/master/plans" className="bg-yellow-500 text-black font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-yellow-600 transition-colors duration-300 flex items-center justify-center gap-2 text-center">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /></svg>
                        <span>Gerenciar Planos</span>
                    </Link>
                    <Link to="/admin/audit-logs" className="bg-yellow-500 text-black font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-yellow-600 transition-colors duration-300 flex items-center justify-center gap-2 text-center">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V17a2 2 0 01-2 2z" /></svg>
                        <span>Logs Auditoria</span>
                    </Link>
                 </>
             )}

            {/* Botões específicos para Admin de Estabelecimento (se for essa a intenção) */}
            {currentUser && currentUser.claims?.isAdmin && (
                <>
                    {/* Exemplo: Um link para "Meu Cardápio" para o admin do estabelecimento */}
                    <Link to={`/admin/meu-cardapio/${currentUser.claims.estabelecimentoId}`} className="bg-yellow-500 text-black font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-yellow-600 transition-colors duration-300 flex items-center justify-center gap-2 text-center">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2V1a1 1 0 010 2h2V1a1 1 0 011-1h2a1 1 0 011 1v2h2a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 0h6v3H7V5zm6 4H7v7h6V9z" clipRule="evenodd"></path></svg>
                        <span>Meu Cardápio</span>
                    </Link>
                    {/* Outros botões específicos do estabelecimento */}
                </>
            )}
        </div>

        {/* ... (cards, gráficos, tabela de gerenciamento de estabelecimentos) ... */}

        {/* Aqui seria a seção do painel de pedidos do estabelecimento, que atualmente está vazia */}
        {/* Você precisaria criar um novo componente para "Painel de Pedidos por Estabelecimento"
            e passar o estabelecimentoId para ele.
            As consultas dentro desse novo componente usariam onSnapshot com o filtro de estabelecimentoId.
        */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-6 text-black">Painel de Pedidos do Estabelecimento</h2>
            {/* Este é um exemplo de onde você integraria o painel de pedidos específico do estabelecimento */}
            {currentUser && currentUser.claims?.isAdmin && currentUser.claims?.estabelecimentoId ? (
                <PedidosEstabelecimentoPanel estabelecimentoId={currentUser.claims.estabelecimentoId} />
            ) : (
                <p className="text-gray-600">Carregando pedidos ou sem permissão para visualizá-los neste painel.</p>
            )}
        </div>

      </div>
    </div>
  );
}

export default MasterDashboard;