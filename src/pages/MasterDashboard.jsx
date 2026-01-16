import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, getDocs, collectionGroup } from 'firebase/firestore'; 
// --- CAMINHOS CORRIGIDOS ---
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
  FaDollarSign, // <--- Ícone do Financeiro
  FaChartLine,
  FaSync,
  FaSignOutAlt,
  FaShoppingCart,
  FaBuilding,
  FaMoneyBillWave // <--- Outro ícone útil
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

// --- Componentes Auxiliares ---

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
      <div className="max-w-7xl mx-auto text-sm sm:text-base lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => navigate('/')}>
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
            <button onClick={handleLogout} className="flex items-center space-x-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-sm">
              <FaSignOutAlt className="text-sm" />
              <span className="text-sm font-medium">Sair</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

const StatCard = ({ title, value, icon, color, subtitle }) => (
  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-gray-600 text-sm font-medium mb-1">{title}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="text-gray-500 text-sm mt-2">{subtitle}</p>}
      </div>
      <div className={`text-3xl p-3 rounded-xl ${color}`}>
        {icon}
      </div>
    </div>
  </div>
);

const ActionCard = ({ to, title, description, icon, color }) => (
  <Link to={to} className="group bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 hover:border-yellow-400">
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${color} group-hover:scale-110 transition-transform duration-300`}>{icon}</div>
        <div className="text-gray-400 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300 text-lg">→</div>
      </div>
      <div className="flex-grow">
        <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-yellow-600 transition-colors duration-300">{title}</h3>
        <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  </Link>
);

// --- Componente Principal ---

function MasterDashboard() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Estados Financeiros Unificados
  const [financeiro, setFinanceiro] = useState({
    totalHistorico: 0,
    qtdPedidosTotal: 0,
    faturamentoHoje: 0,
    qtdHoje: 0
  });

  const [stats, setStats] = useState({
    totalEstabelecimentos: 0,
    estabelecimentosAtivos: 0,
    totalUsuarios: 0,
    usuariosNovos: 0
  });

  const [graficos, setGraficos] = useState({
    statusData: { labels: [], datasets: [] },
    barData: { labels: [], datasets: [] }
  });

  // --- 1. CARREGAMENTO HISTÓRICO ---
  const fetchHistoricalData = async () => {
    setLoadingDashboard(true);
    try {
      const hoje = startOfDay(new Date());
      const umaSemanaAtras = startOfDay(subDays(hoje, 7));

      // Consultas Básicas
      const [estabSnap, usersSnap, usersNovosSnap] = await Promise.all([
        getDocs(query(collection(db, 'estabelecimentos'))),
        getDocs(query(collection(db, 'usuarios'))),
        getDocs(query(collection(db, 'usuarios'), where('createdAt', '>=', umaSemanaAtras)))
      ]);

      const estabs = estabSnap.docs.map(d => d.data());
      
      setStats({
        totalEstabelecimentos: estabSnap.size,
        estabelecimentosAtivos: estabs.filter(e => e.ativo).length,
        totalUsuarios: usersSnap.size,
        usuariosNovos: usersNovosSnap.size
      });

      // Configuração Gráfico Pizza
      setGraficos(prev => ({
        ...prev,
        statusData: {
          labels: ['Ativos', 'Inativos'],
          datasets: [{
            data: [estabs.filter(e => e.ativo).length, estabSnap.size - estabs.filter(e => e.ativo).length],
            backgroundColor: ['#22c55e', '#ef4444'],
            borderColor: '#ffffff',
            borderWidth: 2,
          }],
        }
      }));

      // Gráfico de Barras
      const pedidosSemanaSnap = await getDocs(query(collection(db, 'pedidos'), where('createdAt', '>=', umaSemanaAtras)));
      const pedidosSemana = pedidosSemanaSnap.docs.map(d => d.data());

      const labels7Dias = [];
      const data7Dias = [];
      
      for(let i=6; i>=0; i--) {
        const d = subDays(hoje, i);
        const inicio = startOfDay(d);
        const fim = endOfDay(d);
        labels7Dias.push(format(d, 'dd/MM'));
        
        const count = pedidosSemana.filter(p => {
           const data = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
           return data >= inicio && data <= fim;
        }).length;
        data7Dias.push(count);
      }

      setGraficos(prev => ({
        ...prev,
        barData: {
          labels: labels7Dias,
          datasets: [{
            label: 'Pedidos Delivery (Tendência)',
            data: data7Dias,
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            borderRadius: 4,
          }],
        }
      }));

      setLastUpdated(new Date());

    } catch (err) {
      console.error("Erro histórico:", err);
      toast.error('Erro ao carregar histórico.');
    } finally {
      setLoadingDashboard(false);
    }
  };

  // --- 2. LISTENER REALTIME ---
  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return;

    const qPedidos = query(collection(db, 'pedidos'));
    const unsubPedidos = onSnapshot(qPedidos, (snap) => {
       const docs = snap.docs.map(d => d.data());
       calcularTotais(docs, 'pedidos');
    });

    const qVendas = query(collectionGroup(db, 'vendas'));
    const unsubVendas = onSnapshot(qVendas, (snap) => {
       const docs = snap.docs.map(d => d.data());
       calcularTotais(docs, 'vendas');
    });

    return () => { unsubPedidos(); unsubVendas(); };
  }, [currentUser, isMasterAdmin]);

  const [dadosBrutos, setDadosBrutos] = useState({ pedidos: [], vendas: [] });

  const calcularTotais = (novosDados, tipo) => {
    setDadosBrutos(prev => {
      const atualizado = { ...prev, [tipo]: novosDados };
      const tudo = [...atualizado.pedidos, ...atualizado.vendas];
      const hoje = startOfDay(new Date());

      const totalGeral = tudo.reduce((acc, item) => acc + (item.totalFinal || item.total || 0), 0);
      const qtdGeral = tudo.length;

      const doDia = tudo.filter(item => {
        const data = item.createdAt?.toDate ? item.createdAt.toDate() : 
                     (item.dataPedido?.toDate ? item.dataPedido.toDate() : 
                     (item.adicionadoEm?.toDate ? item.adicionadoEm.toDate() : null));
        return data && data >= hoje;
      });

      const fatHoje = doDia.reduce((acc, item) => acc + (item.totalFinal || item.total || 0), 0);
      const qtdHoje = doDia.length;

      setFinanceiro({
        totalHistorico: totalGeral,
        qtdPedidosTotal: qtdGeral,
        faturamentoHoje: fatHoje,
        qtdHoje: qtdHoje
      });

      return atualizado;
    });
  };

  useEffect(() => {
    if (!authLoading && currentUser && isMasterAdmin) {
      fetchHistoricalData();
    }
  }, [authLoading, currentUser, isMasterAdmin]);

  const pieOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } };
  const barOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };

  if (authLoading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-500"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-8 px-4">
      <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} />
      
      <main className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Dashboard Master</h1>
          <p className="text-gray-600 text-lg">
            Monitoramento Global <span className="text-green-600 font-bold ml-2 text-sm bg-green-100 px-2 py-1 rounded-full">● Ao Vivo</span>
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <button onClick={fetchHistoricalData} className="flex items-center space-x-2 px-5 py-2 bg-white border rounded-lg hover:bg-gray-50 text-gray-600 text-sm shadow-sm">
            <FaSync className={loadingDashboard ? 'animate-spin' : ''} />
            <span>Atualizar Dados Estáticos</span>
          </button>
        </div>

        {/* CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard
            title="Vendas Hoje"
            value={`R$ ${financeiro.faturamentoHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            subtitle={`${financeiro.qtdHoje} pedidos hoje`}
            icon={<FaShoppingCart className="text-white text-xl" />}
            color="bg-green-500"
          />
          <StatCard
            title="Faturamento Total"
            value={`R$ ${financeiro.totalHistorico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            subtitle={`${financeiro.qtdPedidosTotal} pedidos acumulados`}
            icon={<FaDollarSign className="text-white text-xl" />}
            color="bg-yellow-500"
          />
          <StatCard
            title="Estabelecimentos"
            value={stats.totalEstabelecimentos}
            subtitle={`${stats.estabelecimentosAtivos} ativos na plataforma`}
            icon={<FaBuilding className="text-white text-xl" />}
            color="bg-blue-500"
          />
          <StatCard
            title="Usuários"
            value={stats.totalUsuarios}
            subtitle={`${stats.usuariosNovos} novos esta semana`}
            icon={<FaUsers className="text-white text-xl" />}
            color="bg-purple-500"
          />
        </div>

        {/* GRÁFICOS */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Métricas de Desempenho</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">Status Estabelecimentos</h3>
              <div className="h-64"><Pie data={graficos.statusData} options={pieOptions} /></div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">Tendência Semanal (Delivery)</h3>
              <div className="h-64"><Bar data={graficos.barData} options={barOptions} /></div>
            </div>
          </div>
        </div>

        {/* --- AQUI ESTÃO OS BOTÕES, INCLUINDO O FINANCEIRO NOVO --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <ActionCard to="/master/estabelecimentos" title="Estabelecimentos" description="Gerencie estabelecimentos" icon={<FaStore className="text-2xl text-white" />} color="bg-blue-500" />
          <ActionCard to="/master/usuarios" title="Usuários" description="Administre usuários" icon={<FaUsers className="text-2xl text-white" />} color="bg-green-500" />
          
          {/* NOVO BOTÃO FINANCEIRO */}
          <ActionCard 
            to="/master/financeiro" 
            title="Financeiro (Boletos)" 
            description="Controle de pagamentos" 
            icon={<FaMoneyBillWave className="text-2xl text-white" />} 
            color="bg-emerald-600" 
          />

          <ActionCard to="/master/pedidos" title="Todos os Pedidos" description="Histórico completo" icon={<FaClipboardList className="text-2xl text-white" />} color="bg-yellow-500" />
          <ActionCard to="/master/importar-cardapio" title="Importar Cardápio" description="Upload em massa" icon={<FaFileUpload className="text-2xl text-white" />} color="bg-red-500" />
          <ActionCard to="/master/associar-imagens" title="Associar Imagens" description="Vincule fotos" icon={<FaImages className="text-2xl text-white" />} color="bg-purple-500" />
          <ActionCard to="/master/plans" title="Planos" description="Gerencie assinaturas" icon={<FaTags className="text-2xl text-white" />} color="bg-pink-500" />
          <ActionCard to="/admin/audit-logs" title="Logs de Auditoria" description="Monitore ações" icon={<FaShieldAlt className="text-2xl text-white" />} color="bg-teal-500" />
        </div>

        <div className="text-center mt-12 pt-8 border-t border-gray-200 text-gray-400 text-xs">
          Última atualização completa: {format(lastUpdated, "dd/MM/yyyy 'às' HH:mm:ss")}
        </div>
      </main>
    </div>
  );
}

export default MasterDashboard;