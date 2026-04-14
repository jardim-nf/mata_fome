import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaChartLine, FaChartPie, FaStore, FaMoneyBillWave, FaShoppingCart, FaBolt, FaSignOutAlt, FaCrown } from 'react-icons/fa';
import { IoLogOutOutline } from 'react-icons/io5';
import DateRangeFilter, { getPresetRange } from '../../components/DateRangeFilter';
import { useMasterAnalyticsData } from '../../hooks/useMasterAnalyticsData';
import { useAuth } from '../../context/AuthContext';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement, Filler } from 'chart.js';
import { Line, Pie, Bar } from 'react-chartjs-2';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement, Filler);

const lineOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1D1D1F', titleFont: { family: 'Inter' }, bodyFont: { family: 'Inter' }, callbacks: { label: (ctx) => `R$ ${ctx.parsed.y.toFixed(2)}` } } },
    scales: { 
        x: { grid: { display: false }, ticks: { font: { family: 'Inter' }, color: '#86868B' } }, 
        y: { border: { display: false }, grid: { color: '#E5E5EA' }, ticks: { font: { family: 'Inter' }, color: '#86868B', callback: (v) => `R$ ${v}` } } 
    }
};

const barOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1D1D1F', titleFont: { family: 'Inter' }, bodyFont: { family: 'Inter' }, callbacks: { label: (ctx) => `R$ ${ctx.parsed.y.toFixed(2)}` } } },
    scales: { 
        x: { grid: { display: false }, ticks: { font: { family: 'Inter' }, color: '#86868B' } }, 
        y: { border: { display: false }, grid: { color: '#E5E5EA' }, ticks: { font: { family: 'Inter' }, color: '#86868B' } } 
    }
};

const pieOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
        legend: { position: 'right', labels: { usePointStyle: true, font: { family: 'Inter', size: 12 }, color: '#1D1D1F' } },
        tooltip: { backgroundColor: '#1D1D1F', callbacks: { label: (ctx) => `${ctx.label}: R$ ${ctx.parsed.toFixed(2)}` } }
    }
};

const colors = ['#000000', '#34C759', '#007AFF', '#FF9500', '#FF3B30', '#AF52DE', '#5856D6', '#FF2D55', '#5AC8FA', '#8E8E93'];

function MasterAnalytics() {
  const navigate = useNavigate();
  const { isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  const [datePreset, setDatePreset] = useState('30d');
  const [dateRange, setDateRange] = useState(getPresetRange('30d') || { start: null, end: null });

  const { metrics, loading } = useMasterAnalyticsData(dateRange, datePreset);

  const handleDateClear = () => {
    setDatePreset(null);
    setDateRange({ start: null, end: null });
  };

  if (authLoading) return (
    <div className="flex h-screen items-center justify-center bg-[#F5F5F7]">
      <FaBolt className="text-[#86868B] text-4xl animate-pulse" />
    </div>
  );
  if (!isMasterAdmin) return <div className="p-10 text-center text-red-500 bg-[#F5F5F7] min-h-screen">Acesso Negado</div>;

  return (
    <div className="bg-[#F5F5F7] min-h-screen font-sans text-[#1D1D1F] pb-24 pt-4 px-4 sm:px-8">
      
      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className="max-w-[1400px] mx-auto bg-white/70 backdrop-blur-xl border border-white/50 shadow-sm rounded-full h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/master-dashboard')} className="w-9 h-9 bg-[#F5F5F7] hover:bg-[#E5E5EA] rounded-full flex items-center justify-center transition-colors">
            <FaArrowLeft className="text-[#86868B] text-sm" />
          </button>
          <div className="hidden sm:block border-l border-[#E5E5EA] pl-4">
            <h1 className="font-semibold text-sm tracking-tight text-black">Hub de Analytics</h1>
            <p className="text-[11px] text-[#86868B] font-medium">{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-px h-6 bg-[#E5E5EA] hidden sm:block" />
          <button onClick={async () => { await logout(); navigate('/'); }} className="w-9 h-9 bg-red-50 hover:bg-red-100 rounded-full flex items-center justify-center transition-colors">
            <IoLogOutOutline className="text-red-500" size={16} />
          </button>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto mt-8">
        
        {/* ─── HEADER & FILTER ─── */}
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-8 px-2">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-[#1D1D1F]">Inteligência em Dados</h1>
            <p className="text-[#86868B] text-sm mt-1 font-medium">Extração de volumetria de vendas e projeção de faturamento da rede.</p>
          </div>
          
          <div className="bg-white border border-[#E5E5EA] rounded-full px-4 py-2 shadow-sm flex items-center">
            <DateRangeFilter 
                datePreset={datePreset} 
                dateRange={dateRange} 
                onPresetChange={setDatePreset} 
                onRangeChange={setDateRange} 
                onClear={handleDateClear}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-[#E5E5EA] border-t-black rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="space-y-6 md:space-y-8">
              
              {/* ─── STATS BENTO ─── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {/* Faturamento Macro */}
                  <div className="bg-[#1D1D1F] border border-[#1D1D1F] rounded-[2rem] p-8 shadow-md flex items-center gap-6 relative overflow-hidden group">
                      <div className="absolute -right-10 -top-10 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl group-hover:bg-emerald-500/40 transition-colors duration-1000"></div>
                      <div className="w-16 h-16 bg-white/10 text-white rounded-2xl flex items-center justify-center shrink-0 z-10">
                          <FaMoneyBillWave size={28} />
                      </div>
                      <div className="relative z-10">
                          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Volume Capturado na Rede</p>
                          <p className="text-4xl sm:text-5xl font-bold tracking-tight text-white line-clamp-1">R$ {metrics.faturamentoTotal.toFixed(2).replace('.', ',')}</p>
                      </div>
                  </div>
                  
                  {/* Transações */}
                  <div className="bg-white border border-[#E5E5EA] rounded-[2rem] p-8 shadow-sm flex items-center gap-6">
                      <div className="w-16 h-16 bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5EA] rounded-2xl flex items-center justify-center shrink-0">
                          <FaShoppingCart size={28} />
                      </div>
                      <div>
                          <p className="text-xs font-bold text-[#86868B] uppercase tracking-widest mb-1">Tickets Gerados</p>
                          <p className="text-4xl sm:text-5xl font-bold tracking-tight text-[#1D1D1F]">{metrics.qtdTransacoes}</p>
                      </div>
                  </div>
              </div>

              {/* ─── CHARTS BENTO ─── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                  
                  {/* Evolução de Faturamento (Linha) */}
                  <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-[#E5E5EA] lg:col-span-2">
                      <h3 className="text-lg font-bold text-[#1D1D1F] mb-6 flex items-center gap-2">
                          Evolução de Fluxo (Gross)
                      </h3>
                      <div className="h-[300px] w-full">
                          {metrics.evolucao.labels.length > 0 ? (
                              <Line 
                                  data={{ 
                                      labels: metrics.evolucao.labels, 
                                      datasets: [{ 
                                          label: 'Faturamento R$', 
                                          data: metrics.evolucao.data, 
                                          borderColor: '#1D1D1F', 
                                          backgroundColor: 'rgba(29, 29, 31, 0.05)', 
                                          fill: true,
                                          tension: 0.4,
                                          pointBackgroundColor: '#1D1D1F',
                                          pointBorderColor: '#fff',
                                          pointBorderWidth: 2,
                                          pointRadius: 4,
                                          pointHoverRadius: 6
                                      }] 
                                  }} 
                                  options={lineOptions} 
                              />
                          ) : (
                              <div className="h-full flex items-center justify-center font-semibold text-[#86868B] bg-[#F5F5F7] rounded-[1.5rem]">Vazio no Período Selecionado</div>
                          )}
                      </div>
                  </div>

                  {/* Participacao por Loja (Pizza) */}
                  <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-[#E5E5EA]">
                      <h3 className="text-lg font-bold text-[#1D1D1F] mb-6 flex items-center gap-2">
                          Share de Mercado (GMV)
                      </h3>
                      <div className="h-[300px] w-full flex items-center justify-center">
                          {metrics.participacao.labels.length > 0 ? (
                              <Pie 
                                  data={{ 
                                      labels: metrics.participacao.labels, 
                                      datasets: [{ 
                                          data: metrics.participacao.data, 
                                          backgroundColor: colors,
                                          borderWidth: 2,
                                          borderColor: '#ffffff'
                                      }] 
                                  }} 
                                  options={pieOptions} 
                              />
                          ) : (
                              <div className="h-full w-full flex items-center justify-center font-semibold text-[#86868B] bg-[#F5F5F7] rounded-[1.5rem]">Sem Share</div>
                          )}
                      </div>
                  </div>

                  {/* Ranking de Franquias (Barra) */}
                  <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-[#E5E5EA] lg:col-span-3">
                      <h3 className="text-lg font-bold text-[#1D1D1F] mb-6 flex items-center gap-2">
                          Ranking de Lojas Nacionais
                      </h3>
                      <div className="h-[350px] w-full">
                          {metrics.rankLojas.labels.length > 0 ? (
                              <Bar 
                                  data={{ 
                                      labels: metrics.rankLojas.labels, 
                                      datasets: [{ 
                                          label: 'Faturamento R$', 
                                          data: metrics.rankLojas.data, 
                                          backgroundColor: '#000000',
                                          borderRadius: 8,
                                          barThickness: 'flex',
                                          maxBarThickness: 40
                                      }] 
                                  }} 
                                  options={barOptions} 
                              />
                          ) : (
                              <div className="h-full flex items-center justify-center font-semibold text-[#86868B] bg-[#F5F5F7] rounded-[1.5rem]">Oceano Azul. Nenhum dado disponível.</div>
                          )}
                      </div>
                  </div>

              </div>
          </div>
        )}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
        .tabular-nums { font-variant-numeric: tabular-nums; }
      `}</style>
    </div>
  );
}

export default MasterAnalytics;
