import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, getDocs, collectionGroup } from 'firebase/firestore'; 
import { db } from '../firebase'; 
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

// Placeholder para Logo (se tiver a URL, coloque aqui)
const LOGO_URL = null; 

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
  FaSignOutAlt,
  FaShoppingCart,
  FaMoneyBillWave,
  FaSync,
  FaChevronRight,
  FaBox // Novo ícone para quantidade de pedidos
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

// --- Componentes Visuais Minimalistas ---

function DashboardHeader({ currentUser, logout, navigate }) {
  const userEmailPrefix = currentUser.email ? currentUser.email.split('@')[0] : 'Admin';

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error("Erro logout:", error);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 h-16 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex justify-between items-center h-full">
          {/* LOGO AREA */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
            {LOGO_URL ? (
                <img src={LOGO_URL} alt="NaMão Logo" className="h-8 w-auto" />
            ) : (
                <div className="flex items-center gap-1">
                    <div className="bg-yellow-400 text-black font-bold p-1 rounded-sm transform -skew-x-12">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                    </div>
                    <span className="text-gray-900 font-extrabold text-xl tracking-tight">
                        Na<span className="text-yellow-500">Mão</span>
                    </span>
                </div>
            )}
          </div>

          {/* USER AREA */}
          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-semibold text-gray-800">{userEmailPrefix}</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Master Access</span>
            </div>
            <button 
                onClick={handleLogout} 
                className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
                title="Sair"
            >
              <FaSignOutAlt />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

const StatCard = ({ title, value, subtitle, icon }) => (
  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 group">
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 bg-gray-50 rounded-xl text-gray-400 group-hover:bg-yellow-400 group-hover:text-black transition-colors duration-300">
        {icon}
      </div>
      {subtitle && <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-full">{subtitle}</span>}
    </div>
    <h3 className="text-gray-500 text-sm font-medium mb-1">{title}</h3>
    <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
  </div>
);

const ActionCard = ({ to, title, description, icon }) => (
  <Link to={to} className="group flex items-center justify-between p-5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-yellow-400 transition-all duration-300">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 group-hover:bg-black group-hover:text-yellow-400 transition-colors">
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-gray-800 group-hover:text-black">{title}</h4>
        <p className="text-xs text-gray-400 group-hover:text-gray-500">{description}</p>
      </div>
    </div>
    <FaChevronRight className="text-gray-300 text-xs group-hover:text-yellow-500 group-hover:translate-x-1 transition-all" />
  </Link>
);

// --- Componente Principal ---

function MasterDashboard() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

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

  // --- LÓGICA DE DADOS ---
  const fetchHistoricalData = async () => {
    setLoadingDashboard(true);
    try {
      const hoje = startOfDay(new Date());
      const umaSemanaAtras = startOfDay(subDays(hoje, 7));

      // Removida query de usuários novos para otimizar, já que não vamos exibir
      const [estabSnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, 'estabelecimentos'))),
        getDocs(query(collection(db, 'usuarios'))),
      ]);

      const estabs = estabSnap.docs.map(d => d.data());
      
      setStats({
        totalEstabelecimentos: estabSnap.size,
        estabelecimentosAtivos: estabs.filter(e => e.ativo).length,
        totalUsuarios: usersSnap.size,
        usuariosNovos: 0 // Campo mantido na estrutura mas não usado
      });

      setGraficos(prev => ({
        ...prev,
        statusData: {
          labels: ['Ativos', 'Inativos'],
          datasets: [{
            data: [estabs.filter(e => e.ativo).length, estabSnap.size - estabs.filter(e => e.ativo).length],
            backgroundColor: ['#10b981', '#f3f4f6'],
            borderWidth: 0,
          }],
        }
      }));

      const pedidosSemanaSnap = await getDocs(query(collection(db, 'pedidos'), where('createdAt', '>=', umaSemanaAtras)));
      const pedidosSemana = pedidosSemanaSnap.docs.map(d => d.data());
      const labels7Dias = [];
      const data7Dias = [];
      
      for(let i=6; i>=0; i--) {
        const d = subDays(hoje, i);
        labels7Dias.push(format(d, 'dd/MM'));
        const count = pedidosSemana.filter(p => {
           const data = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
           return data >= startOfDay(d) && data <= endOfDay(d);
        }).length;
        data7Dias.push(count);
      }

      setGraficos(prev => ({
        ...prev,
        barData: {
          labels: labels7Dias,
          datasets: [{
            label: 'Pedidos',
            data: data7Dias,
            backgroundColor: '#fbbf24',
            borderRadius: 4,
            barThickness: 20,
          }],
        }
      }));
      setLastUpdated(new Date());

    } catch (err) {
      console.error("Erro histórico:", err);
      toast.error('Erro ao atualizar dados.');
    } finally {
      setLoadingDashboard(false);
    }
  };

  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return;
    const qPedidos = query(collection(db, 'pedidos'));
    const unsubPedidos = onSnapshot(qPedidos, (snap) => calcularTotais(snap.docs.map(d => d.data()), 'pedidos'));
    const qVendas = query(collectionGroup(db, 'vendas'));
    const unsubVendas = onSnapshot(qVendas, (snap) => calcularTotais(snap.docs.map(d => d.data()), 'vendas'));
    return () => { unsubPedidos(); unsubVendas(); };
  }, [currentUser, isMasterAdmin]);

  const [dadosBrutos, setDadosBrutos] = useState({ pedidos: [], vendas: [] });

  const calcularTotais = (novosDados, tipo) => {
    setDadosBrutos(prev => {
      const atualizado = { ...prev, [tipo]: novosDados };
      const tudo = [...atualizado.pedidos, ...atualizado.vendas];
      const hoje = startOfDay(new Date());

      const doDia = tudo.filter(item => {
        const data = item.createdAt?.toDate ? item.createdAt.toDate() : 
                     (item.dataPedido?.toDate ? item.dataPedido.toDate() : 
                     (item.adicionadoEm?.toDate ? item.adicionadoEm.toDate() : null));
        return data && data >= hoje;
      });

      setFinanceiro({
        totalHistorico: tudo.reduce((acc, item) => acc + (item.totalFinal || item.total || 0), 0),
        qtdPedidosTotal: tudo.length,
        faturamentoHoje: doDia.reduce((acc, item) => acc + (item.totalFinal || item.total || 0), 0),
        qtdHoje: doDia.length
      });
      return atualizado;
    });
  };

  useEffect(() => {
    if (!authLoading && currentUser && isMasterAdmin) {
      fetchHistoricalData();
    }
  }, [authLoading, currentUser, isMasterAdmin]);

  const pieOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 6 } } }, cutout: '70%' };
  const barOptions = { 
    responsive: true, 
    maintainAspectRatio: false, 
    plugins: { legend: { display: false } },
    scales: {
        x: { grid: { display: false } },
        y: { grid: { color: '#f3f4f6' }, border: { display: false } }
    }
  };

  if (authLoading) return <div className="flex justify-center items-center h-screen bg-gray-50"><div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="min-h-screen bg-[#fafafa] pt-20 pb-10 px-4 sm:px-6">
      <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} />
      
      <main className="max-w-7xl mx-auto">
        
        {/* HEADER DA PÁGINA */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Visão Geral</h1>
                <p className="text-gray-500 mt-1">Bem-vindo ao painel administrativo.</p>
            </div>
            <button 
                onClick={fetchHistoricalData} 
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:border-yellow-400 hover:text-yellow-600 transition-all text-sm font-medium shadow-sm"
            >
                <FaSync className={loadingDashboard ? 'animate-spin' : ''} />
                <span>Atualizar</span>
            </button>
        </div>

        {/* 1. METRICAS PRINCIPAIS (AGORA COM PEDIDOS E SEM USUÁRIOS) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Vendas Hoje"
            value={`R$ ${financeiro.faturamentoHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<FaShoppingCart />}
          />
          
          {/* NOVO CARD: QUANTIDADE DE PEDIDOS */}
          <StatCard
            title="Pedidos Hoje"
            value={financeiro.qtdHoje}
            subtitle="Volume diário"
            icon={<FaBox />}
          />

          <StatCard
            title="Receita Total"
            value={`R$ ${financeiro.totalHistorico.toLocaleString('pt-BR', { minimumFractionDigits: 2, notation: "compact" })}`}
            subtitle={`${financeiro.qtdPedidosTotal} total`}
            icon={<FaDollarSign />}
          />
          
          <StatCard
            title="Lojas Ativas"
            value={`${stats.estabelecimentosAtivos} / ${stats.totalEstabelecimentos}`}
            icon={<FaStore />}
          />
        </div>

        {/* 2. MENU DE AÇÕES RÁPIDAS (MEIO) */}
        <h3 className="font-bold text-gray-900 mb-4 text-lg">Gerenciamento</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-10">
          <ActionCard 
            to="/master/financeiro" 
            title="Financeiro" 
            description="Boletos e Recebíveis" 
            icon={<FaMoneyBillWave />} 
          />
          <ActionCard 
            to="/master/estabelecimentos" 
            title="Estabelecimentos" 
            description="Lojas e Configurações" 
            icon={<FaStore />} 
          />
          <ActionCard 
            to="/master/usuarios" 
            title="Usuários" 
            description="Acessos e Permissões" 
            icon={<FaUsers />} 
          />
          <ActionCard 
            to="/master/pedidos" 
            title="Monitor de Pedidos" 
            description="Delivery em Tempo Real" 
            icon={<FaClipboardList />} 
          />
          <ActionCard 
            to="/master/plans" 
            title="Planos & Assinaturas" 
            description="Controle de Cobrança" 
            icon={<FaTags />} 
          />
          <ActionCard 
            to="/master/importar-cardapio" 
            title="Importador" 
            description="Cardápios em Massa" 
            icon={<FaFileUpload />} 
          />
          <ActionCard 
            to="/master/associar-imagens" 
            title="Galeria" 
            description="Banco de Imagens" 
            icon={<FaImages />} 
          />
          <ActionCard 
            to="/admin/audit-logs" 
            title="Auditoria" 
            description="Logs de Segurança" 
            icon={<FaShieldAlt />} 
          />
        </div>

        {/* 3. GRÁFICOS (EMBAIXO) */}
        <h3 className="font-bold text-gray-900 mb-4 text-lg">Análise de Dados</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm lg:col-span-2">
                <h3 className="font-bold text-gray-800 mb-6 text-sm">Tendência de Pedidos (7 Dias)</h3>
                <div className="h-64">
                    <Bar data={graficos.barData} options={barOptions} />
                </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-6 text-sm">Status da Rede</h3>
                <div className="h-64 flex justify-center">
                    <Pie data={graficos.statusData} options={pieOptions} />
                </div>
            </div>
        </div>

        <div className="text-center mt-12 text-gray-300 text-xs">
          NaMão System © {new Date().getFullYear()} • v3.1 Minimal
        </div>
      </main>
    </div>
  );
}

export default MasterDashboard;