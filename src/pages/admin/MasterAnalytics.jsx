import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaChartLine, FaChartPie, FaStore, FaMoneyBillWave, FaShoppingCart } from 'react-icons/fa';
import DateRangeFilter, { getPresetRange } from '../../components/DateRangeFilter';
import { useMasterAnalyticsData } from '../../hooks/useMasterAnalyticsData';
import { useAuth } from '../../context/AuthContext';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement, Filler } from 'chart.js';
import { Line, Pie, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement, Filler);

const lineOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `R$ ${ctx.parsed.y.toFixed(2)}` } } },
    scales: { y: { ticks: { callback: (v) => `R$ ${v}` } } }
};

const barOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `R$ ${ctx.parsed.y.toFixed(2)}` } } }
};

const pieOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
        legend: { position: 'right', labels: { usePointStyle: true, font: { size: 12 } } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: R$ ${ctx.parsed.toFixed(2)}` } }
    }
};

const colors = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#14b8a6', '#6366f1', '#f43f5e', '#84cc16'];

function MasterAnalytics() {
  const navigate = useNavigate();
  const { isMasterAdmin, loading: authLoading } = useAuth();
  
  const [datePreset, setDatePreset] = useState('30d');
  const [dateRange, setDateRange] = useState(getPresetRange('30d') || { start: null, end: null });

  const { metrics, loading } = useMasterAnalyticsData(dateRange, datePreset);

  const handleDateClear = () => {
    setDatePreset(null);
    setDateRange({ start: null, end: null });
  };

  if (authLoading) return <div className="p-10 text-center">Carregando...</div>;
  if (!isMasterAdmin) return <div className="p-10 text-center text-red-500">Acesso Negado</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button onClick={() => navigate('/master-dashboard')} className="flex items-center text-slate-500 hover:text-orange-500 transition-colors mb-2 text-sm font-medium">
            <FaArrowLeft className="mr-2" /> Voltar ao Dashboard
          </button>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
              <FaChartLine size={20} />
            </div>
            Business Intelligence
          </h1>
          <p className="text-slate-500 text-sm mt-1">Análise gráfica e consolidação de toda rede de franquias.</p>
        </div>
        
        <DateRangeFilter 
            datePreset={datePreset} 
            dateRange={dateRange} 
            onPresetChange={setDatePreset} 
            onRangeChange={setDateRange} 
            onClear={handleDateClear}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      ) : (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full">
                        <FaMoneyBillWave size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Faturamento Total Rede</p>
                        <p className="text-3xl font-black text-slate-800">R$ {metrics.faturamentoTotal.toFixed(2).replace('.', ',')}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-full">
                        <FaShoppingCart size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Volume de Transações</p>
                        <p className="text-3xl font-black text-slate-800">{metrics.qtdTransacoes}</p>
                    </div>
                </div>
            </div>

            {/* Graficos Principais */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Evolução de Faturamento */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 xl:col-span-2">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <FaChartLine className="text-orange-500" /> Evolução de Faturamento
                    </h3>
                    <div className="h-[300px]">
                        {metrics.evolucao.labels.length > 0 ? (
                            <Line 
                                data={{ 
                                    labels: metrics.evolucao.labels, 
                                    datasets: [{ 
                                        label: 'Faturamento R$', 
                                        data: metrics.evolucao.data, 
                                        borderColor: '#f97316', 
                                        backgroundColor: 'rgba(249, 115, 22, 0.1)', 
                                        fill: true,
                                        tension: 0.3
                                    }] 
                                }} 
                                options={lineOptions} 
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">Sem dados neste período</div>
                        )}
                    </div>
                </div>

                {/* Participacao por Loja */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <FaChartPie className="text-purple-500" /> Share de Receita
                    </h3>
                    <div className="h-[300px]">
                        {metrics.participacao.labels.length > 0 ? (
                            <Pie 
                                data={{ 
                                    labels: metrics.participacao.labels, 
                                    datasets: [{ 
                                        data: metrics.participacao.data, 
                                        backgroundColor: colors
                                    }] 
                                }} 
                                options={pieOptions} 
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">Sem dados</div>
                        )}
                    </div>
                </div>

                {/* Ranking de Franquias */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 xl:col-span-3">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <FaStore className="text-blue-500" /> Top Franquias
                    </h3>
                    <div className="h-[300px]">
                        {metrics.rankLojas.labels.length > 0 ? (
                            <Bar 
                                data={{ 
                                    labels: metrics.rankLojas.labels, 
                                    datasets: [{ 
                                        label: 'Faturamento R$', 
                                        data: metrics.rankLojas.data, 
                                        backgroundColor: '#3b82f6',
                                        borderRadius: 4
                                    }] 
                                }} 
                                options={barOptions} 
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">Sem dados</div>
                        )}
                    </div>
                </div>

            </div>
        </>
      )}
    </div>
  );
}

export default MasterAnalytics;
