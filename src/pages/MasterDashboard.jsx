import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, onSnapshot, getDocs, collectionGroup } from 'firebase/firestore'; 
import { db } from '../firebase'; 
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

// Placeholder para Logo (se tiver a URL, coloque aqui)
const LOGO_URL = null; 

import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { startOfDay } from 'date-fns';
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
  FaBox,
  FaChartLine,
  FaTrophy
} from 'react-icons/fa';

// Registra apenas o necessário para o gráfico Pizza/Donut
ChartJS.register(
  Title,
  Tooltip,
  Legend,
  ArcElement
);

// --- Componentes Visuais Premium ---

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
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/50 shadow-sm h-16 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex justify-between items-center h-full">
          {/* LOGO AREA */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
            {LOGO_URL ? (
                <img src={LOGO_URL} alt="IdeaFood Logo" className="h-8 w-auto drop-shadow-sm transition-transform group-hover:scale-105" />
            ) : (
                <div className="flex items-center gap-2">
                    <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 text-white font-bold p-1.5 rounded-lg shadow-md transform -skew-x-6 group-hover:rotate-3 transition-transform">
                        <svg className="w-5 h-5 drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                    </div>
                    <span className="text-gray-900 font-black text-xl tracking-tighter">
                        Idea<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-yellow-600">Food</span>
                    </span>
                </div>
            )}
          </div>

          {/* USER AREA */}
          <div className="flex items-center gap-5">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-bold text-gray-800 tracking-tight">{userEmailPrefix}</span>
              <span className="text-[9px] uppercase tracking-widest text-yellow-600 font-bold bg-yellow-50 px-2 py-0.5 rounded-full border border-yellow-100 mt-0.5">Master Access</span>
            </div>
            <div className="h-8 w-px bg-gray-200 mx-2 hidden md:block"></div>
            <button 
                onClick={handleLogout} 
                className="text-gray-400 hover:text-red-500 transition-all duration-300 p-2 rounded-xl hover:bg-red-50/80 active:scale-95"
                title="Encerrar Sessão"
            >
              <FaSignOutAlt size={18} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

const StatCard = ({ title, value, subtitle, icon, highlight = false }) => (
  <div className={`relative overflow-hidden p-6 rounded-3xl border transition-all duration-500 group
    ${highlight 
      ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 shadow-xl shadow-gray-900/20 text-white hover:shadow-2xl hover:shadow-gray-900/30' 
      : 'bg-white border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-200/50 hover:border-gray-200'}`}
  >
    {/* Decorator circle */}
    <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 transition-all duration-700 group-hover:scale-150
      ${highlight ? 'bg-yellow-400' : 'bg-gray-300'}`}></div>

    <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
        <div className={`p-3.5 rounded-2xl transition-all duration-500 
            ${highlight 
            ? 'bg-gray-800 text-yellow-400 shadow-inner border border-gray-700' 
            : 'bg-gray-50 text-gray-400 group-hover:bg-yellow-400 group-hover:text-white group-hover:shadow-lg group-hover:shadow-yellow-400/30'}`}
        >
            {icon}
        </div>
        {subtitle && (
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border 
            ${highlight ? 'bg-gray-800/50 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
            {subtitle}
            </span>
        )}
        </div>
        <h3 className={`text-sm font-semibold mb-1 ${highlight ? 'text-gray-400' : 'text-gray-500'}`}>{title}</h3>
        <p className={`text-3xl font-black tracking-tight ${highlight ? 'text-white' : 'text-gray-900'}`}>{value}</p>
    </div>
  </div>
);

const ActionCard = ({ to, title, description, icon }) => (
  <Link to={to} className="group relative flex items-center justify-between p-5 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-xl hover:shadow-gray-200/40 hover:border-yellow-300 transition-all duration-500 overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-r from-yellow-50/0 to-yellow-50/50 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500 ease-out"></div>
    <div className="relative z-10 flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-500 group-hover:bg-black group-hover:text-yellow-400 transition-all duration-500 group-hover:shadow-md group-hover:scale-110">
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-gray-800 tracking-tight group-hover:text-black transition-colors">{title}</h4>
        <p className="text-[11px] font-medium text-gray-400 group-hover:text-gray-600 transition-colors mt-0.5">{description}</p>
      </div>
    </div>
    <div className="relative z-10 w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-yellow-400 transition-all duration-500">
        <FaChevronRight className="text-gray-300 text-xs group-hover:text-white transition-all" />
    </div>
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
    qtdHoje: 0,
    topLojas: [] // Armazena o ranking das lojas do dia
  });

  const [stats, setStats] = useState({
    totalEstabelecimentos: 0,
    estabelecimentosAtivos: 0,
    totalUsuarios: 0,
  });

  const [estabelecimentosMap, setEstabelecimentosMap] = useState({});

  const [graficos, setGraficos] = useState({
    statusData: { labels: [], datasets: [] }
  });

  // --- LÓGICA DE DADOS ESTÁTICOS (LOJAS E USUÁRIOS) ---
  const fetchHistoricalData = async () => {
    setLoadingDashboard(true);
    try {
      const [estabSnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, 'estabelecimentos'))),
        getDocs(query(collection(db, 'usuarios'))),
      ]);

      const estabs = estabSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Cria mapa de nomes para usar no ranking depois
      const mapEstabs = {};
      estabs.forEach(e => { mapEstabs[e.id] = e.nome || e.name || e.razaoSocial; });
      setEstabelecimentosMap(mapEstabs);
      
      setStats({
        totalEstabelecimentos: estabSnap.size,
        estabelecimentosAtivos: estabs.filter(e => e.ativo).length,
        totalUsuarios: usersSnap.size,
      });

      setGraficos({
        statusData: {
          labels: ['Lojas Ativas', 'Inativas'],
          datasets: [{
            data: [estabs.filter(e => e.ativo).length, estabSnap.size - estabs.filter(e => e.ativo).length],
            backgroundColor: ['#10b981', '#f3f4f6'],
            hoverBackgroundColor: ['#059669', '#e5e7eb'],
            borderWidth: 0,
            hoverOffset: 4
          }],
        }
      });

      setLastUpdated(new Date());
    } catch (err) {
      console.error("Erro histórico:", err);
      toast.error('Erro ao atualizar dados gerais.');
    } finally {
      setLoadingDashboard(false);
    }
  };

  // --- ESCUTAS EM TEMPO REAL (PEDIDOS E VENDAS) ---
  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return;
    
    const qPedidos = query(collectionGroup(db, 'pedidos'));
    // Passa o _path da referência para descobrirmos a loja caso o id não venha
    const unsubPedidos = onSnapshot(qPedidos, (snap) => calcularTotais(snap.docs.map(d => ({...d.data(), _path: d.ref.path})), 'pedidos'));
    
    const qVendas = query(collectionGroup(db, 'vendas'));
    const unsubVendas = onSnapshot(qVendas, (snap) => calcularTotais(snap.docs.map(d => ({...d.data(), _path: d.ref.path})), 'vendas'));
    
    return () => { unsubPedidos(); unsubVendas(); };
  }, [currentUser, isMasterAdmin]);

  const [dadosBrutos, setDadosBrutos] = useState({ pedidos: [], vendas: [] });

  const calcularTotais = (novosDados, tipo) => {
    setDadosBrutos(prev => {
      const atualizado = { ...prev, [tipo]: novosDados };
      const tudo = [...atualizado.pedidos, ...atualizado.vendas];
      const hoje = startOfDay(new Date());

      const extrairDataSegura = (campoData) => {
          if (!campoData) return null;
          if (typeof campoData.toDate === 'function') return campoData.toDate(); 
          if (campoData.seconds) return new Date(campoData.seconds * 1000); 
          const dataConvertida = new Date(campoData); 
          return isNaN(dataConvertida.getTime()) ? null : dataConvertida;
      };

      const doDia = tudo.filter(item => {
        const dataItem = extrairDataSegura(item.createdAt) || 
                         extrairDataSegura(item.dataPedido) || 
                         extrairDataSegura(item.adicionadoEm) ||
                         extrairDataSegura(item.updatedAt) ||
                         extrairDataSegura(item.criadoEm); 
        return dataItem && dataItem >= hoje;
      });

      // 🔥 LÓGICA DE RANKING DAS LOJAS 🔥
      const rankingMap = {};
      doDia.forEach(item => {
          let estabId = item.estabelecimentoId;
          
          // Tenta pegar o ID pela URL do documento no firebase se não existir o campo
          if (!estabId && item._path) {
              const parts = item._path.split('/');
              const idx = parts.indexOf('estabelecimentos');
              if (idx >= 0 && parts.length > idx + 1) estabId = parts[idx + 1];
          }
          if (!estabId) estabId = 'desconhecido';

          const valor = Number(item.totalFinal) || Number(item.total) || Number(item.valorFinal) || 0;
          
          if (!rankingMap[estabId]) {
              rankingMap[estabId] = { 
                  id: estabId, 
                  nomeSalvoNoPedido: item.estabelecimentoNome || item.lojaNome || '', 
                  total: 0, 
                  pedidos: 0 
              };
          }
          rankingMap[estabId].total += valor;
          rankingMap[estabId].pedidos += 1;
      });
      
      // Ordena por maior faturamento e pega os top 5
      const topLojas = Object.values(rankingMap)
         .sort((a, b) => b.total - a.total)
         .slice(0, 5);

      setFinanceiro({
        totalHistorico: tudo.reduce((acc, item) => acc + (Number(item.totalFinal) || Number(item.total) || Number(item.valorFinal) || 0), 0),
        qtdPedidosTotal: tudo.length,
        faturamentoHoje: doDia.reduce((acc, item) => acc + (Number(item.totalFinal) || Number(item.total) || Number(item.valorFinal) || 0), 0),
        qtdHoje: doDia.length,
        topLojas: topLojas // Salva o ranking!
      });
      
      return atualizado;
    });
  };

  useEffect(() => {
    if (!authLoading && currentUser && isMasterAdmin) {
      fetchHistoricalData();
    }
  }, [authLoading, currentUser, isMasterAdmin]);

  const pieOptions = { 
    responsive: true, 
    maintainAspectRatio: false, 
    plugins: { 
        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 20, font: { family: "'Inter', sans-serif", weight: '600' } } },
        tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 12, cornerRadius: 8, bodyFont: { font: { family: "'Inter', sans-serif" } } }
    }, 
    cutout: '75%',
    animation: { animateScale: true, animateRotate: true }
  };

  if (authLoading) return <div className="flex justify-center items-center h-screen bg-gray-50"><div className="w-12 h-12 border-4 border-gray-200 border-t-yellow-400 rounded-full animate-spin shadow-lg"></div></div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] pt-24 pb-12 px-4 sm:px-6 font-sans selection:bg-yellow-200 selection:text-black">
      <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} />
      
      <main className="max-w-7xl mx-auto">
        
        {/* HEADER DA PÁGINA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <span className="bg-yellow-100 text-yellow-800 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md">Sistema Ativo</span>
                    <span className="text-xs text-gray-400 font-medium flex items-center gap-1"><FaSync size={10} className={loadingDashboard ? 'animate-spin' : ''} /> Atualizado às {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute:'2-digit' })}</span>
                </div>
                <h1 className="text-4xl font-black text-gray-900 tracking-tight">Painel Master</h1>
                <p className="text-gray-500 mt-2 text-sm font-medium max-w-xl">Visão executiva e controle centralizado de toda a operação da rede IdeaFood.</p>
            </div>
            <button 
                onClick={fetchHistoricalData} 
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:border-yellow-400 hover:text-yellow-600 hover:bg-yellow-50/30 transition-all duration-300 text-sm font-bold shadow-sm active:scale-95 group"
            >
                <FaSync className={`text-gray-400 group-hover:text-yellow-500 transition-colors ${loadingDashboard ? 'animate-spin text-yellow-500' : ''}`} />
                <span>Sincronizar Dados</span>
            </button>
        </div>

        {/* 1. METRICAS PRINCIPAIS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
          <StatCard
            highlight={true}
            title="Faturamento Hoje"
            value={`R$ ${financeiro.faturamentoHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<FaShoppingCart size={22} />}
          />
          
          <StatCard
            title="Pedidos Hoje"
            value={financeiro.qtdHoje}
            subtitle="Volume diário"
            icon={<FaBox size={20} />}
          />

          <StatCard
            title="Receita Total"
            value={`R$ ${financeiro.totalHistorico.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtitle={`${financeiro.qtdPedidosTotal} fechados`}
            icon={<FaDollarSign size={20} />}
          />
          
          <StatCard
            title="Lojas Ativas"
            value={`${stats.estabelecimentosAtivos} / ${stats.totalEstabelecimentos}`}
            subtitle="Rede"
            icon={<FaStore size={20} />}
          />
        </div>

        {/* 2. MENU DE AÇÕES RÁPIDAS (MEIO) */}
        <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-gray-900 text-xl tracking-tight flex items-center gap-2">
                <FaChartLine className="text-yellow-400" /> Módulos de Gestão
            </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-12">
          <ActionCard to="/master/financeiro" title="Financeiro" description="Boletos e Recebíveis" icon={<FaMoneyBillWave size={20} />} />
          <ActionCard to="/master/estabelecimentos" title="Estabelecimentos" description="Lojas e Configurações" icon={<FaStore size={20} />} />
          <ActionCard to="/master/usuarios" title="Usuários" description="Acessos e Permissões" icon={<FaUsers size={20} />} />
          <ActionCard to="/master/pedidos" title="Monitor de Pedidos" description="Central de Delivery" icon={<FaClipboardList size={20} />} />
          <ActionCard to="/master/plans" title="Assinaturas" description="Controle de Planos" icon={<FaTags size={20} />} />
          <ActionCard to="/master/importar-cardapio" title="Importador" description="Cardápios em Massa" icon={<FaFileUpload size={20} />} />
          <ActionCard to="/master/associar-imagens" title="Galeria Central" description="Banco de Imagens" icon={<FaImages size={20} />} />
          <ActionCard to="/admin/audit-logs" title="Auditoria" description="Logs de Segurança" icon={<FaShieldAlt size={20} />} />
        </div>

        {/* 3. RANKING E GRÁFICOS (EMBAIXO) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            
            {/* RANKING DE LOJAS (Substituiu o Gráfico de Barras) */}
            <div className="bg-white p-7 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow lg:col-span-2 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                        <FaTrophy className="text-yellow-500" /> Top Lojas Hoje
                    </h3>
                    <span className="text-[10px] font-black uppercase text-yellow-600 bg-yellow-50 px-3 py-1.5 rounded-lg border border-yellow-100">Ranking de Faturamento</span>
                </div>
                
                <div className="flex-1 flex flex-col justify-center gap-3">
                    {financeiro.topLojas.length === 0 ? (
                        <div className="text-center text-gray-400 text-sm py-10 flex flex-col items-center gap-2">
                            <FaStore className="text-gray-200 text-4xl mb-2" />
                            Nenhuma venda registrada hoje na rede.
                        </div>
                    ) : (
                        financeiro.topLojas.map((loja, index) => {
                            // Resolve o nome inteligentemente (Tenta do Mapa, depois do Pedido, depois cria um genérico)
                            const nomeExibicao = estabelecimentosMap[loja.id] || loja.nomeSalvoNoPedido || (loja.id !== 'desconhecido' ? `Filial #${loja.id.slice(0,4).toUpperCase()}` : 'Venda Avulsa');
                            
                            return (
                                <div key={loja.id} className="flex items-center justify-between p-3.5 rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all duration-300 group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm shadow-sm
                                            ${index === 0 ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-white shadow-yellow-400/40' : 
                                              index === 1 ? 'bg-gradient-to-br from-gray-200 to-gray-400 text-white shadow-gray-400/40' : 
                                              index === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-500 text-white shadow-orange-400/40' : 
                                              'bg-gray-50 text-gray-400 border border-gray-100'}`}>
                                            {index + 1}º
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-800 group-hover:text-black transition-colors text-[15px] tracking-tight">{nomeExibicao}</h4>
                                            <p className="text-[11px] text-gray-500 font-medium mt-0.5 flex items-center gap-1">
                                                <FaShoppingCart className="text-gray-300" /> {loja.pedidos} pedidos hoje
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="block font-black text-gray-900 text-lg tracking-tight group-hover:text-yellow-600 transition-colors">
                                            R$ {loja.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Saúde da Rede (Pie Chart) - Mantido */}
            <div className="bg-white p-7 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                <h3 className="font-bold text-gray-800 mb-6 text-lg">Saúde da Rede</h3>
                <div className="flex-1 flex justify-center relative min-h-[250px]">
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                        <span className="text-3xl font-black text-gray-800">{stats.estabelecimentosAtivos}</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ativos</span>
                    </div>
                    <Pie data={graficos.statusData} options={pieOptions} />
                </div>
            </div>

        </div>

        <div className="flex flex-col items-center justify-center mt-16 border-t border-gray-200/60 pt-8 pb-4">
          <div className="flex items-center gap-2 mb-2 opacity-50 grayscale">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
          </div>
          <p className="text-gray-400 text-xs font-medium tracking-wide">
            IdeaFood Master © {new Date().getFullYear()} • Edição Premium v3.2
          </p>
        </div>
      </main>
    </div>
  );
}

export default MasterDashboard;