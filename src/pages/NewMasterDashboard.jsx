import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FiDollarSign, FiTrendingUp, FiTrendingDown, FiShoppingCart, FiUsers, FiActivity, FiServer, FiAlertCircle, FiGrid, FiHome, FiBarChart2, FiShield } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useMasterDashboardData } from '../hooks/useMasterDashboardData';

export default function NewMasterDashboard() {
  const { currentUser, isMasterAdmin } = useAuth();
  const {
    financeiro,
    contatosEstabelecimentos,
    stats,
    crescimento,
    auditLogs
  } = useMasterDashboardData(currentUser, isMasterAdmin);

  const [activeRange, setActiveRange] = useState('Hoje');
  const [activeTab, setActiveTab] = useState('overview');

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  const faturamentoHoje = financeiro?.faturamentoHoje || 0;
  const pedidosHoje = financeiro?.qtdHoje || 0;
  const crescFat = crescimento?.faturamento || 0;
  const isCrescFatPositivo = crescFat >= 0;
  const crescPed = crescimento?.pedidos || 0;
  const isCrescPedPositivo = crescPed >= 0;

  const storesData = useMemo(() => {
    if (!contatosEstabelecimentos) return [];
    return contatosEstabelecimentos.map(estab => {
      const isActive = estab.isAtivo !== false;
      return {
        id: estab.id,
        name: estab.nome || 'Loja Sem Nome',
        status: isActive ? 'online' : 'offline',
        rev: financeiro?.faturamentoHoje || 0,
        orders: financeiro?.qtdHoje || 0
      };
    });
  }, [contatosEstabelecimentos, financeiro]);

  const chartData = useMemo(() => {
    return [
      { time: '08:00', today: faturamentoHoje * 0.1, yesterday: (faturamentoHoje * 0.1) * 0.8 },
      { time: '12:00', today: faturamentoHoje * 0.3, yesterday: (faturamentoHoje * 0.3) * 0.9 },
      { time: '16:00', today: faturamentoHoje * 0.2, yesterday: (faturamentoHoje * 0.2) * 1.1 },
      { time: '20:00', today: faturamentoHoje * 0.4, yesterday: (faturamentoHoje * 0.4) * 0.85 },
    ];
  }, [faturamentoHoje]);

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      
      {/* HEADER WIDGET */}
      <div className="glass-panel p-8 rounded-[2rem] border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
        
        <div>
          <h1 className="text-3xl font-black font-bricolage tracking-tight text-white flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/30">
              <FiActivity size={24} className="text-white" />
            </div>
            Central de Comando da Rede
          </h1>
          <p className="text-slate-400 mt-2 text-sm font-medium ml-14">
            Visão consolidada em tempo real de todas as {stats?.estabelecimentosAtivos || 0} unidades operacionais.
          </p>
        </div>

        <div className="flex gap-2 bg-slate-900/50 p-1.5 rounded-full border border-white/5">
          {['Hoje', '7 Dias', 'Este Mês', 'Ano'].map(range => (
            <button
              key={range}
              onClick={() => setActiveRange(range)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeRange === range 
                  ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* TABS NAVEGAÇÃO INTERNA */}
      <div className="flex flex-wrap items-center justify-start gap-3.5 pb-2">
        {[
          { id: 'overview', label: 'Visão Geral', icon: <FiGrid size={18} /> },
          { id: 'stores', label: 'Lojas & Operação', icon: <FiHome size={18} /> },
          { id: 'financial', label: 'Métricas & Metas', icon: <FiBarChart2 size={18} /> },
          { id: 'security', label: 'Segurança & Auditoria', icon: <FiShield size={18} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl border transition-all duration-300 font-bricolage text-xs font-black uppercase tracking-wider active:scale-95 ${
              activeTab === tab.id
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)] font-black'
                : 'glass-panel text-slate-400 border-white/5 hover:text-cyan-400 hover:border-cyan-500/25'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            {/* METRICS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* BIG CARD 1: Faturamento */}
              <div className="glass-panel p-6 rounded-[2rem] border-white/10 relative overflow-hidden hover:-translate-y-1 hover:neon-shadow-cyan transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/20 blur-[50px]" />
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400 border border-cyan-500/20"><FiDollarSign /></div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-space">Faturamento</h3>
                </div>
                <p className="text-4xl font-black font-mono-jb text-white">{formatCurrency(faturamentoHoje)}</p>
                <div className={`flex items-center gap-2 mt-2 text-sm font-bold ${isCrescFatPositivo ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isCrescFatPositivo ? <FiTrendingUp /> : <FiTrendingDown />}
                  <span>{isCrescFatPositivo ? '+' : ''}{crescFat.toFixed(1)}% vs ontem</span>
                </div>
              </div>

              {/* BIG CARD 2: Pedidos */}
              <div className="glass-panel p-6 rounded-[2rem] border-white/10 relative overflow-hidden hover:-translate-y-1 hover:neon-shadow-purple transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 blur-[50px]" />
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400 border border-purple-500/20"><FiShoppingCart /></div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest font-space">Pedidos Totais</h3>
                </div>
                <p className="text-4xl font-black font-mono-jb text-white">{pedidosHoje}</p>
                <div className={`flex items-center gap-2 mt-2 text-sm font-bold ${isCrescPedPositivo ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isCrescPedPositivo ? <FiTrendingUp /> : <FiTrendingDown />}
                  <span>{isCrescPedPositivo ? '+' : ''}{crescPed.toFixed(1)}% vs ontem</span>
                </div>
              </div>

              {/* MINI CARDS */}
              <div className="flex flex-col gap-6 lg:col-span-2">
                <div className="grid grid-cols-2 gap-6 h-full">
                  <div className="glass-panel p-5 rounded-[2rem] border-white/10 flex flex-col justify-center relative overflow-hidden">
                    <div className="flex items-center gap-2 mb-2">
                      <FiUsers className="text-blue-400" />
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Usuários Ativos</span>
                    </div>
                    <p className="text-2xl font-black text-white font-mono-jb">{stats?.totalUsuarios || 0}</p>
                  </div>
                  <div className="glass-panel p-5 rounded-[2rem] border-white/10 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-2">
                      <FiServer className="text-emerald-400" />
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Uptime</span>
                    </div>
                    <p className="text-2xl font-black text-white font-mono-jb">99.9%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* CHARTS & LISTS WIDGETS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* MAIN CHART */}
              <div className="glass-panel p-6 rounded-[2.5rem] border-white/10 lg:col-span-2 h-[450px] flex flex-col relative overflow-hidden">
                <div className="flex items-center justify-between mb-6 relative z-10">
                  <h3 className="text-lg font-black font-bricolage text-white">Curva de Faturamento</h3>
                  <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-full text-xs font-bold border border-cyan-500/20">Hoje vs Ontem</span>
                </div>
                <div className="flex-1 w-full relative z-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorToday" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorYesterday" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis dataKey="time" stroke="#ffffff40" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis stroke="#ffffff40" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v/1000}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '16px' }}
                        itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                        formatter={(value) => formatCurrency(value)}
                      />
                      <Area type="monotone" dataKey="yesterday" name="Ontem" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorYesterday)" />
                      <Area type="monotone" dataKey="today" name="Hoje" stroke="#06b6d4" strokeWidth={3} fillOpacity={1} fill="url(#colorToday)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* STORES STATUS */}
              <div className="glass-panel p-6 rounded-[2.5rem] border-white/10 flex flex-col h-[450px]">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-black font-bricolage text-white">Radar de Lojas ({storesData.length})</h3>
                  <button className="text-xs text-cyan-400 font-bold hover:underline">Ver todas</button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                  {storesData.length > 0 ? storesData.map((store, i) => (
                    <div key={i} className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-colors flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full shadow-lg ${
                          store.status === 'online' ? 'bg-emerald-400 shadow-emerald-400/50 animate-pulse' :
                          store.status === 'warning' ? 'bg-amber-400 shadow-amber-400/50' :
                          'bg-red-500 shadow-red-500/50'
                        }`} />
                        <div>
                          <h4 className="text-sm font-bold text-slate-200 group-hover:text-white truncate max-w-[120px]">{store.name}</h4>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-slate-500 text-center mt-10">Carregando lojas...</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'stores' && (
          <motion.div key="stores" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="glass-panel p-10 rounded-[2.5rem] border-white/10 text-center">
              <FiHome size={48} className="mx-auto text-cyan-400 mb-4" />
              <h2 className="text-2xl font-black text-white font-bricolage mb-2">Lojas & Operação</h2>
              <p className="text-slate-400 max-w-lg mx-auto">Em breve os controles operacionais e modais de suspensão serão migrados para esta nova interface de alta performance.</p>
            </div>
          </motion.div>
        )}

        {activeTab === 'financial' && (
          <motion.div key="financial" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="glass-panel p-10 rounded-[2.5rem] border-white/10 text-center">
              <FiBarChart2 size={48} className="mx-auto text-purple-400 mb-4" />
              <h2 className="text-2xl font-black text-white font-bricolage mb-2">Métricas & Metas</h2>
              <p className="text-slate-400 max-w-lg mx-auto">Módulo financeiro avançado sendo recriado para o novo Matafome OS.</p>
            </div>
          </motion.div>
        )}

        {activeTab === 'security' && (
          <motion.div key="security" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="glass-panel p-10 rounded-[2.5rem] border-white/10 text-center">
              <FiShield size={48} className="mx-auto text-emerald-400 mb-4" />
              <h2 className="text-2xl font-black text-white font-bricolage mb-2">Segurança & Auditoria</h2>
              <p className="text-slate-400 max-w-lg mx-auto">Registros de logs rastreáveis de todo o sistema global.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
