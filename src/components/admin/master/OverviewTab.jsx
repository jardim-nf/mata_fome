import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, LineChart, Line } from 'recharts';
import { FiDollarSign, FiTrendingUp, FiChevronDown, FiShoppingCart, FiHome, FiUsers, FiAward, FiTag, FiSearch, FiClock, FiActivity, FiPhone, FiAlertCircle, FiMessageSquare, FiShield, FiLock, FiCheckCircle, FiXCircle, FiInfo, FiDownload } from 'react-icons/fi';
import { formatCurrency } from '../../../utils/formatters';
import { Link } from 'react-router-dom';
import DateRangeFilter from '../../DateRangeFilter';
import { startOfDay, subDays } from 'date-fns';

export const OverviewTab = (props) => {
  const {
    t, isDark, theme, loadingDashboard, searchQuery, setSearchQuery, financeiro, stats, estabelecimentosMap,
    alertas, datePreset, dateRange, handleDatePresetChange, handleDateRangeChange, handleDateClear,
    fetchHistoricalData, financeiroFiltrado, crescimento, ticketMedio, contatosEstabelecimentos,
    selectedStore, setSelectedStore, auditLogs, ultimosEstabelecimentos, sparklines,
    modoManutencao, toggleModoManutencao, topItensCardapio, atividadesLojas, metaMensal,
    dadosRegiao, topClientes, distribuicaoPlanos, selectedLoja, setSelectedLoja,
    activeTab, setActiveTab, showNotifications, setShowNotifications,
    showSuspendModal, setShowSuspendModal, suspendLojaId, setSuspendLojaId, suspendMotivo, setSuspendMotivo, isSuspending, setIsSuspending,
    showComunicadoModal, setShowComunicadoModal, comunicadoTexto, setComunicadoTexto, isSendingComunicado, setIsSendingComunicado,
    showStoreSelector, setShowStoreSelector, storeSearch, setStoreSearch, storeSelectorRef,
    filterLevel, setFilterLevel, isExporting, setIsExporting, canaisVenda, totalCanais, pctDelivery, pctSalao, pctBalcao, pieChartData,
    statsLoja, filteredStoresForSelect, selectedStoreName, generateSparklinePath, generateSparklineFill, filteredLogs, handleExportLogs, handleQuickSuspendSetup, handleSendComunicado, handleSuspendLoja, hourlyData, filteredModules, dadosBrutos, dadosFiltradosBrutos
  } = props;

  const [modalCanalAberto, setModalCanalAberto] = useState(null);
  const [pedidosDoCanal, setPedidosDoCanal] = useState([]);

  // Helper functions for order filtering
  const extrairData = (c) => {
    if (!c) return null;
    if (typeof c.toDate === 'function') return c.toDate();
    if (c.seconds !== undefined) return new Date(c.seconds * 1000);
    if (c._seconds !== undefined) return new Date(c._seconds * 1000);
    if (c.seconds) return new Date(c.seconds * 1000);
    const d = new Date(c); return isNaN(d.getTime()) ? null : d;
  };
  const getDate = (item) => {
    const rawDate = extrairData(item.createdAt) || extrairData(item.dataPedido) || 
      extrairData(item.adicionadoEm) || extrairData(item.updatedAt) || extrairData(item.criadoEm);
    if (!rawDate) return null;
    return new Date(rawDate.getTime() - (6 * 60 * 60 * 1000));
  };
  const isMesaDoc = (data) => {
    return data.tipo === 'mesa' || data.source === 'salao' || !!data.mesaNumero || !!data.numeroMesa;
  };
  const isPedidoCancelado = (p) => {
    if (!p) return false;
    const s1 = String(p.status || '').toLowerCase().trim();
    const s2 = String(p.fiscal?.status || '').toLowerCase().trim();
    const s3 = String(p.statusVenda || '').toLowerCase().trim();
    const termos = ['cancelad', 'recusad', 'excluid', 'estornad', 'devolvid', 'rejeitad', 'erro'];
    return termos.some(t => s1.includes(t) || s2.includes(t) || s3.includes(t));
  };

  const abrirModalCanal = (canalNome) => {
    let sourcePedidos = [];
    let sourceVendas = [];

    if (financeiroFiltrado) {
      sourcePedidos = dadosFiltradosBrutos?.pedidos || [];
      sourceVendas = dadosFiltradosBrutos?.vendas || [];
    } else {
      sourcePedidos = dadosBrutos?.pedidos || [];
      sourceVendas = dadosBrutos?.vendas || [];
      
      const dataAtualOperacional = new Date(Date.now() - (6 * 60 * 60 * 1000));
      const hoje = startOfDay(dataAtualOperacional);
      
      sourcePedidos = sourcePedidos.filter(item => { const d = getDate(item); return d && d >= hoje; });
      sourceVendas = sourceVendas.filter(item => { const d = getDate(item); return d && d >= hoje; });
    }

    const tudo = [...sourcePedidos, ...sourceVendas].filter(d => !isPedidoCancelado(d));
    let filtrados = [];

    tudo.forEach(item => {
      const isMesa = isMesaDoc(item);
      const isRetirada = item.tipo === 'retirada' || item.source === 'balcao' || item.tipoVenda === 'retirada';
      
      if (canalNome === 'Delivery') {
        if (!isMesa && !isRetirada) filtrados.push(item);
      } else if (canalNome === 'Salão') {
        if (isMesa) filtrados.push(item);
      } else if (canalNome === 'Balcão/Retirada') {
        if (isRetirada && !isMesa) filtrados.push(item);
      }
    });

    filtrados.sort((a, b) => {
      const d1 = extrairData(a.createdAt) || extrairData(a.dataPedido) || new Date(0);
      const d2 = extrairData(b.createdAt) || extrairData(b.dataPedido) || new Date(0);
      return d2 - d1;
    });

    setPedidosDoCanal(filtrados);
    setModalCanalAberto(canalNome);
  };

  // Renderização CustomTooltip caso seja usado neste tab
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className={`backdrop-blur-xl border p-3 rounded-xl shadow-2xl ${t.cardBg} ${t.border}`}>
          <p className={`${t.textSecondary} text-xs font-bold font-space uppercase mb-1`}>{label}</p>
          <p className="text-cyan-400 font-mono-jb font-bold text-sm">Hoje: R$ {(payload[0].value || 0).toFixed(2)}</p>
          {payload[1] && <p className={`${t.textMuted} font-mono-jb font-semibold text-xs mt-0.5`}>Ontem: R$ {(payload[1].value || 0).toFixed(2)}</p>}
        </div>
      );
    }
    return null;
  };

  return (
    <>

          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Hoje / Faturamento */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-[2rem] p-6 border transition-all duration-300 relative overflow-hidden group ${t.cardBg} ${t.surfaceHover}`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-r-full" />
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl relative z-10">
                <FiDollarSign size={18} />
              </div>
              <span className={`text-sm font-black uppercase tracking-widest ${t.textMuted} font-bricolage relative z-10`}>FATURAMENTO</span>
            </div>
            <h3 className="text-2xl font-black font-mono-jb tracking-tight relative z-10">
              {formatCurrency(financeiroFiltrado ? financeiroFiltrado.faturamento : financeiro.faturamentoHoje)}
            </h3>
            <p className={`text-sm mt-1 uppercase tracking-wider font-bold ${t.textSecondary} relative z-10`}>
              {financeiroFiltrado ? 'Período Filtrado' : 'Faturamento de Hoje'}
            </p>
            {!financeiroFiltrado && (
              <div className={`flex items-center gap-1 mt-3 font-mono-jb relative z-10 ${crescimento >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {crescimento >= 0 ? <FiTrendingUp size={18} /> : <FiChevronDown size={18} />}
                <span className="text-sm font-black uppercase">{Math.abs(crescimento).toFixed(1)}% vs ontem</span>
              </div>
            )}
            {/* Sparkline SVG no fundo */}
            <div className="absolute bottom-0 left-0 right-0 h-11 pointer-events-none opacity-30 group-hover:opacity-45 transition-opacity overflow-hidden">
              <svg viewBox="0 0 120 30" width="100%" height="100%" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="sparklineGrad-Faturamento" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={generateSparklineFill(sparklines.faturamento, 120, 30)}
                  fill="url(#sparklineGrad-Faturamento)"
                />
                <path
                  d={generateSparklinePath(sparklines.faturamento, 120, 30)}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          </motion.div>

          {/* Card 2: Pedidos / Ticket */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`rounded-[2rem] p-6 border transition-all duration-300 relative overflow-hidden group ${t.cardBg} ${t.surfaceHover}`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-emerald-450 to-teal-500 rounded-r-full" />
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl relative z-10">
                <FiShoppingCart size={18} />
              </div>
              <span className={`text-sm font-black uppercase tracking-widest ${t.textMuted} font-bricolage relative z-10`}>PEDIDOS</span>
            </div>
            <h3 className="text-2xl font-black font-mono-jb tracking-tight relative z-10">
              {financeiroFiltrado ? financeiroFiltrado.qtd : financeiro.qtdHoje}
            </h3>
            <p className={`text-sm mt-1 uppercase tracking-wider font-bold ${t.textSecondary} relative z-10`}>Volume Recente</p>
            <div className="mt-3 relative z-10">
              <span className={`text-sm font-black uppercase tracking-wide border px-2 py-0.5 rounded-lg font-mono-jb ${t.border} ${t.textAccent}`}>
                Ticket: {formatCurrency(financeiroFiltrado ? financeiroFiltrado.ticketMedio : ticketMedio)}
              </span>
            </div>
            {/* Sparkline SVG no fundo */}
            <div className="absolute bottom-0 left-0 right-0 h-11 pointer-events-none opacity-30 group-hover:opacity-45 transition-opacity overflow-hidden">
              <svg viewBox="0 0 120 30" width="100%" height="100%" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="sparklineGrad-Pedidos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={generateSparklineFill(sparklines.pedidos, 120, 30)}
                  fill="url(#sparklineGrad-Pedidos)"
                />
                <path
                  d={generateSparklinePath(sparklines.pedidos, 120, 30)}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          </motion.div>

          {/* Card 3: Lojas Ativas */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`rounded-[2rem] p-6 border transition-all duration-300 relative overflow-hidden group ${t.cardBg} ${t.surfaceHover}`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-purple-500 to-pink-500 rounded-r-full" />
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl relative z-10">
                <FiHome size={18} />
              </div>
              <span className={`text-sm font-black uppercase tracking-widest ${t.textMuted} font-bricolage relative z-10`}>PARCEIROS</span>
            </div>
            <h3 className="text-2xl font-black font-mono-jb tracking-tight relative z-10">
              {stats.estabelecimentosAtivos}
            </h3>
            <p className={`text-sm mt-1 uppercase tracking-wider font-bold ${t.textSecondary} relative z-10`}>Lojas Ativas</p>
            <div className="mt-3 relative z-10">
              <span className={`text-sm font-black uppercase tracking-wide border px-2 py-0.5 rounded-lg font-mono-jb ${t.border} ${t.textAccent}`}>
                Total: {stats.totalEstabelecimentos} cadastradas
              </span>
            </div>
            {/* Sparkline SVG no fundo */}
            <div className="absolute bottom-0 left-0 right-0 h-11 pointer-events-none opacity-30 group-hover:opacity-45 transition-opacity overflow-hidden">
              <svg viewBox="0 0 120 30" width="100%" height="100%" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="sparklineGrad-Parceiros" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={generateSparklineFill(sparklines.parceiros, 120, 30)}
                  fill="url(#sparklineGrad-Parceiros)"
                />
                <path
                  d={generateSparklinePath(sparklines.parceiros, 120, 30)}
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          </motion.div>

          {/* Card 4: Usuários */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`rounded-[2rem] p-6 border transition-all duration-300 relative overflow-hidden group ${t.cardBg} ${t.surfaceHover}`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-orange-400 to-red-500 rounded-r-full" />
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-xl relative z-10">
                <FiUsers size={18} />
              </div>
              <span className={`text-sm font-black uppercase tracking-widest ${t.textMuted} font-bricolage relative z-10`}>USUÁRIOS</span>
            </div>
            <h3 className="text-2xl font-black font-mono-jb tracking-tight relative z-10">
              {stats.totalUsuarios}
            </h3>
            <p className={`text-sm mt-1 uppercase tracking-wider font-bold ${t.textSecondary} relative z-10`}>Contas Criadas</p>
            <div className="mt-3 relative z-10">
              <span className={`text-sm font-black uppercase tracking-wide border px-2 py-0.5 rounded-lg font-mono-jb ${t.border} ${theme === 'dark' ? 'bg-indigo-950/30 text-orange-400' : 'bg-stone-200/50 text-stone-900'}`}>
                Acesso unificado
              </span>
            </div>
            {/* Sparkline SVG no fundo */}
            <div className="absolute bottom-0 left-0 right-0 h-11 pointer-events-none opacity-30 group-hover:opacity-45 transition-opacity overflow-hidden">
              <svg viewBox="0 0 120 30" width="100%" height="100%" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="sparklineGrad-Usuarios" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={generateSparklineFill(sparklines.usuarios, 120, 30)}
                  fill="url(#sparklineGrad-Usuarios)"
                />
                <path
                  d={generateSparklinePath(sparklines.usuarios, 120, 30)}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          </motion.div>
        </div>

        {/* INTERACTIVE DATA VISUALS (Chart & Top Store) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Chart Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`lg:col-span-2 rounded-[2.5rem] p-6 border ${t.cardBg} ${t.border}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-black uppercase tracking-widest font-bricolage">Faturamento por Hora</h3>
                <p className={`text-[11px] font-bold ${t.textSecondary}`}>Distribuição consolidada do faturamento operacional</p>
              </div>
              <DateRangeFilter
                activePreset={datePreset}
                dateRange={dateRange}
                onPresetChange={handleDatePresetChange}
                onRangeChange={handleDateRangeChange}
                onClear={handleDateClear}
              />
            </div>

            <div className="h-64 font-mono-jb">
              {hourlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="chartStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#22d3ee" />
                        <stop offset="50%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#a855f7" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'} />
                    <XAxis
                      dataKey="hour"
                      stroke={isDark ? '#475569' : '#94a3b8'}
                      fontSize={10}
                      fontWeight="bold"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke={isDark ? '#475569' : '#94a3b8'}
                      fontSize={10}
                      fontWeight="bold"
                      tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="hoje"
                      name="Hoje / Filtrado"
                      stroke="url(#chartStroke)"
                      strokeWidth={3}
                      fill="url(#chartFill)"
                    />
                    <Area
                      type="monotone"
                      dataKey="ontem"
                      name="Período Anterior"
                      stroke="#818cf8"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      fill="none"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center font-space">
                  <span className="text-2xl">📊</span>
                  <p className={`text-sm font-bold mt-2 ${t.textMuted}`}>Nenhum faturamento registrado no período selecionado.</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Top Store Award Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="p-[1.5px] bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 rounded-[2.5rem] flex relative overflow-hidden lg:col-span-1 animate-gradient-border"
          >
            <div className={`rounded-[2.4rem] p-6 flex flex-col justify-between flex-1 relative overflow-hidden transition-all duration-300 ${t.surface} ${t.border}`}>
              {/* Decorative radial background */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-400/20 to-transparent rounded-full blur-2xl pointer-events-none" />

              <div className="relative space-y-4 flex flex-col h-full justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bricolage">
                    <FiAward className="text-yellow-500 animate-bounce" size={20} />
                    <span className="text-sm font-black uppercase tracking-widest text-yellow-500">LÍDER DE VENDAS</span>
                  </div>
                  <span className="text-sm bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2.5 py-0.5 rounded-lg font-black font-space">Top 1</span>
                </div>

                {(() => {
                  const ranking = financeiroFiltrado ? financeiroFiltrado.topLojas : financeiro.topLojas;
                  const topStore = ranking?.[0];

                  if (!topStore) {
                    return (
                      <div className="text-center py-8">
                        <p className={`text-sm font-bold ${t.textMuted}`}>Sem faturamento operacional.</p>
                      </div>
                    );
                  }

                  return (
                    <>
                      <div>
                        <h4 className="text-xl font-bold font-space tracking-tight truncate mb-1">
                          {estabelecimentosMap[topStore.id] || topStore.nomeSalvoNoPedido || 'Loja Parceira'}
                        </h4>
                        <p className="text-3xl font-black font-mono-jb text-yellow-500">
                          {formatCurrency(topStore.total)}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className={`flex items-center justify-between p-3 rounded-2xl border transition-colors duration-300 ${t.inputBg} ${t.border}`}>
                          <span className={`text-sm font-black uppercase tracking-wider ${t.textSecondary}`}>Pedidos</span>
                          <span className="text-sm font-black font-mono-jb">{topStore.pedidos}</span>
                        </div>
                        <div className={`flex items-center justify-between p-3 rounded-2xl border transition-colors duration-300 ${t.inputBg} ${t.border}`}>
                          <span className={`text-sm font-black uppercase tracking-wider ${t.textSecondary}`}>Ticket Médio</span>
                          <span className="text-sm font-black font-mono-jb">
                            {formatCurrency(topStore.total / topStore.pedidos)}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedLoja(topStore)}
                        className={`w-full py-3 text-white rounded-2xl font-black text-sm uppercase tracking-wider hover:opacity-90 shadow-lg shadow-orange-550/20 transition-all active:scale-95 font-bricolage bg-gradient-to-r from-yellow-500 to-orange-500`}
                      >
                        Ver Ficha Completa
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>
          </motion.div>
        </div>

        {/* NÚCLEO ADICIONAL DE NEGÓCIOS (Splits de Canais) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Splits de Canal de Venda (Donut Chart) */}
          <div className={`rounded-[2.5rem] p-6 border flex flex-col justify-between ${t.cardBg} ${t.border}`}>
            <div>
              <h3 className="text-base font-black uppercase tracking-widest font-bricolage">Canais de Venda</h3>
              <p className={`text-sm font-bold ${t.textSecondary} mb-4`}>Proporção consolidada de faturamento por canal de vendas</p>
              
              <div className="flex flex-col items-center gap-6 mt-4">
                {/* Donut Chart Container (Centrado e Maior) */}
                <div className="w-44 h-44 flex-shrink-0 relative flex items-center justify-center">
                  {pieChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className={`p-3 rounded-xl border text-sm backdrop-blur-xl ${
                                  isDark ? `bg-indigo-950/90 border-white/10 text-white shadow-xl` : `bg-white/95 border-stone-200 text-stone-900 shadow-md`
                                }`}>
                                  <p className="font-black font-space">{data.name}</p>
                                  <p className="font-mono-jb text-cyan-400 mt-1 font-bold">{formatCurrency(data.value)}</p>
                                  <p className="text-sm text-slate-500 font-semibold">{data.qty} transações ({data.pct}%)</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-sm text-slate-500 font-bold">Sem vendas</div>
                  )}
                  {/* Central Text inside donut */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-sm font-black text-slate-500 uppercase tracking-widest leading-none">Total</span>
                    <span className="text-sm font-black font-mono-jb mt-1 block max-w-[90px] truncate">{formatCurrency(totalCanais)}</span>
                  </div>
                </div>

                <div className="w-full grid grid-cols-3 gap-2.5 pt-4 border-t border-white/5">
                  {pieChartData.map((item, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => abrirModalCanal(item.name)}
                      className={`flex flex-col space-y-1 items-center text-center cursor-pointer p-2 rounded-xl transition-all hover:bg-slate-500/10 active:scale-95`}
                    >
                      <span className="flex items-center gap-1 text-sm font-black uppercase font-space">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}80` }} />
                        {item.name === 'Delivery' ? '🏍️' : item.name === 'Salão' ? '🍽️' : '🛍️'} {item.name}
                      </span>
                      <span className="text-sm font-black font-mono-jb">{formatCurrency(item.value)}</span>
                      <span className="text-xs font-bold text-slate-500">{item.qty} ped ({item.pct}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className={`text-sm mt-4 font-black uppercase tracking-widest text-slate-500 font-mono-jb`}>
              Detecção inteligente de canais
            </p>
          </div>

          {/* Distribuição de Lojas por Plano */}
          <div className={`rounded-[2.5rem] p-6 border flex flex-col justify-between ${t.cardBg} ${t.border}`}>
            <div>
              <h3 className="text-base font-black uppercase tracking-widest font-bricolage">Lojas por Plano</h3>
              <p className={`text-[11px] font-bold ${t.textSecondary} mb-6`}>Distribuição de planos ativos contratados na rede</p>

              <div className="space-y-4">
                {distribuicaoPlanos.length === 0 ? (
                  <div className="text-center py-8">
                    <FiTag className={`mx-auto mb-2 ${t.textMuted}`} size={28} />
                    <p className={`text-sm font-bold ${t.textMuted}`}>Nenhum plano contratado cadastrado.</p>
                  </div>
                ) : (
                  distribuicaoPlanos.map((plano, idx) => {
                    const maxPlano = Math.max(...distribuicaoPlanos.map(p => p.total), 1);
                    const pct = Math.round((plano.total / maxPlano) * 100);
                    const colors = [
                      'from-cyan-400 to-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.3)]',
                      'from-purple-400 to-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.3)]',
                      'from-emerald-400 to-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]',
                      'from-amber-400 to-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                    ];

                    return (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm font-bold font-space">
                          <span className={`${t.text} uppercase tracking-wider`}>{plano.nome}</span>
                          <span className="font-mono-jb text-sm text-slate-400">{plano.total} {plano.total === 1 ? 'loja' : 'lojas'}</span>
                        </div>
                        <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-indigo-950/30' : 'bg-slate-200'}`}>
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${colors[idx % colors.length]}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 mt-4 text-sm font-black uppercase tracking-wider text-slate-500 font-mono-jb">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
              <span>Contratos de franquias integradas</span>
            </div>
          </div>
        </div>

        {/* SYSTEM MODULES LIST GRID */}
        <div>
          <h2 className="text-base font-black uppercase tracking-widest mb-4 font-bricolage">Módulos Administrativos</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredModules.map((category, idx) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + idx * 0.1 }}
                className={`rounded-[2.5rem] p-6 border transition-all duration-300 ${t.cardBg} ${t.border}`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2.5 rounded-xl border ${category.colorClass}`}>
                    {category.icon}
                  </div>
                  <h3 className="text-base font-black uppercase tracking-wider font-bricolage">{category.title}</h3>
                </div>

                <div className="space-y-2">
                  {category.items.map((item, itemIdx) => (
                    <Link
                      key={itemIdx}
                      to={item.to}
                      className={`flex items-center gap-3.5 p-3 rounded-2xl border border-transparent transition-all group ${t.surfaceHover}`}
                    >
                      <div className={`p-2 rounded-xl border border-transparent transition-all duration-300 ${t.inputBg} ${t.border}`}>
                        {React.cloneElement(item.icon, { className: `${category.tagColor} group-hover:scale-110 transition-transform` })}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-black transition-colors ${t.text} group-hover:text-cyan-500`}>
                          {item.label}
                        </p>
                        <p className={`text-sm font-bold ${t.textMuted}`}>{item.desc}</p>
                      </div>
                      <FiChevronDown className={`transition-all -rotate-90 group-hover:translate-x-1 ${t.textMuted} group-hover:text-cyan-500`} size={16} />
                    </Link>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          {filteredModules.length === 0 && (
            <div className={`text-center py-12 border border-dashed rounded-3xl transition-all duration-300 ${t.cardBg} ${t.border}`}>
              <FiSearch className={`mx-auto mb-3 ${t.textMuted}`} size={42} />
              <p className="text-base font-black uppercase tracking-wider font-bricolage">Nenhum módulo localizado</p>
              <p className={`text-sm ${t.textSecondary}`}>Revise os termos digitados na busca.</p>
            </div>
          )}
        </div>
        </>
        
      {/* Modal de Detalhes do Canal */}
      <AnimatePresence>
        {modalCanalAberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setModalCanalAberto(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className={`w-full max-w-2xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border ${
                isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'
              }`}
            >
              <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0 bg-slate-800 text-white">
                <div>
                  <h3 className="text-lg font-black tracking-wider uppercase font-bricolage">
                    Auditoria de Vendas: {modalCanalAberto}
                  </h3>
                  <p className="text-sm text-slate-300 font-medium">
                    {pedidosDoCanal.length} transações processadas neste período
                  </p>
                </div>
                <button 
                  onClick={() => setModalCanalAberto(null)}
                  className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <FiXCircle size={24} />
                </button>
              </div>
              
              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                {pedidosDoCanal.length === 0 ? (
                  <div className="text-center p-8 text-slate-500 font-bold">
                    Nenhum pedido encontrado.
                  </div>
                ) : (
                  pedidosDoCanal.map((p, idx) => {
                    const lojaOrigem = estabelecimentosMap[p.estabelecimentoId] || p.nomeEstabelecimento || 'Loja Desconhecida';
                    const valorTotal = Number(p.totalFinal) || Number(p.total) || Number(p.valorFinal) || 0;
                    const dataObj = extrairData(p.createdAt) || extrairData(p.dataPedido);
                    const dataStr = dataObj ? dataObj.toLocaleString('pt-BR') : 'Data não disponível';
                    const itensArray = p.itens || p.produtos || [];
                    const clienteNome = p.nomeCliente || p.cliente || p.clienteNome || 'Cliente Não Informado';

                    return (
                      <div key={p.id || idx} className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/50 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="text-xs font-bold text-slate-400 mb-1">{dataStr} • {lojaOrigem}</div>
                            <div className="font-bold text-sm text-cyan-500">{clienteNome}</div>
                          </div>
                          <div className="font-black font-mono-jb text-base">
                            {formatCurrency(valorTotal)}
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-slate-500 border-t border-slate-200/20 pt-2">
                          {itensArray.length > 0 ? (
                            <ul className="list-disc list-inside space-y-1">
                              {itensArray.map((item, i) => (
                                <li key={i}>
                                  <span className="font-semibold">{item.quantidade}x</span> {item.nome || item.name || 'Item'}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="italic text-xs">Itens não detalhados</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
