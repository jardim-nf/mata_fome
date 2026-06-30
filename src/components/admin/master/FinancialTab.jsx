import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, LineChart, Line } from 'recharts';
import { FiDollarSign, FiTrendingUp, FiChevronDown, FiShoppingCart, FiHome, FiUsers, FiAward, FiTag, FiSearch, FiClock, FiActivity, FiPhone, FiAlertCircle, FiMessageSquare, FiShield, FiLock, FiCheckCircle, FiXCircle, FiInfo, FiDownload } from 'react-icons/fi';
import { formatCurrency } from '../../../utils/formatters';
import { Link } from 'react-router-dom';
import DateRangeFilter from '../../DateRangeFilter';

export const FinancialTab = (props) => {
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
    statsLoja, filteredStoresForSelect, selectedStoreName, generateSparklinePath, generateSparklineFill, filteredLogs, handleExportLogs, handleQuickSuspendSetup, handleSendComunicado, handleSuspendLoja, hourlyData, filteredModules
  } = props;

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

          <div className="grid grid-cols-1 gap-6">
            {/* Mix de Produtos da Rede (Top 5) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.95 }}
              className={`rounded-[2.5rem] p-6 border flex flex-col justify-between transition-all duration-300 ${t.cardBg} ${t.border}`}
            >
              <div>
                <h3 className="text-lg font-black uppercase tracking-widest mb-4 font-bricolage">Mix de Produtos da Rede (Top 5)</h3>
                
                <div className="space-y-3.5">
                  {topItensCardapio.map((item, idx) => {
                    const icons = ["🍔", "🍕", "🍟", "🥤", "📦"];
                    const barColors = ["from-amber-400 to-amber-500", "from-red-400 to-red-500", "from-yellow-400 to-yellow-500", "from-cyan-400 to-cyan-500", "from-purple-400 to-purple-500"];
                    const maxTotal = Math.max(...topItensCardapio.map(i => i.total), 1);
                    
                    return (
                      <div key={idx} className={`p-3.5 rounded-2xl border transition-all duration-300 ${t.inputBg} ${t.border} ${t.surfaceHover}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{icons[idx] || "🍽️"}</span>
                            <div>
                              <p className={`text-base font-black font-space ${t.text}`}>{item.nome}</p>
                              <p className={`text-sm font-semibold ${t.textMuted}`}>
                                {item.qtd} unidades vendidas
                                {item.compradores && item.compradores.length > 0 && (
                                  <span className="block mt-0.5 text-sm text-cyan-400 font-bold">
                                    Comprado por: {item.compradores.join(', ')}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <p className="text-base font-black text-cyan-400 font-mono-jb">{formatCurrency(item.total)}</p>
                        </div>
                        
                        <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-indigo-950/30' : 'bg-slate-200'}`}>
                          <div
                            className={`h-full bg-gradient-to-r ${barColors[idx] || 'from-cyan-400 to-indigo-500'} rounded-full transition-all duration-700`}
                            style={{ width: `${(item.total / maxTotal) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        


          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monitor de Metas Circular SVG */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.96 }}
            className={`rounded-[2.5rem] p-6 border flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${t.cardBg} ${t.border}`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-black uppercase tracking-widest font-bricolage">Meta Mensal da Rede</h3>
                <span className="text-sm bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2.5 py-0.5 rounded-lg font-black font-space">
                  CONSOLIDADO
                </span>
              </div>
              <p className={`text-[11px] font-bold ${t.textSecondary} mb-6`}>Progresso consolidado das metas mensais de faturamento</p>

              <div className="flex items-center justify-around gap-4 py-2">
                {/* Radial circular SVG */}
                <div className="relative w-28 h-28 flex-shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {/* Background track circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      className={`${isDark ? 'stroke-indigo-950/30' : 'stroke-slate-200'}`}
                      strokeWidth="8"
                      fill="transparent"
                    />
                    {/* Foreground animated progress circle */}
                    <motion.circle
                      cx="50"
                      cy="50"
                      r="40"
                      className="stroke-cyan-400"
                      strokeWidth="8"
                      strokeDasharray={2 * Math.PI * 40}
                      initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 40 - (metaMensal.percentual / 100) * (2 * Math.PI * 40) }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      strokeLinecap="round"
                      fill="transparent"
                      style={{ filter: 'drop-shadow(0px 0px 4px rgba(6,182,212,0.4))' }}
                    />
                  </svg>
                  {/* Internal percentage text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black font-mono-jb text-cyan-400">{metaMensal.percentual}%</span>
                    <span className={`text-sm font-bold uppercase ${t.textMuted}`}>alcançado</span>
                  </div>
                </div>

                <div className="space-y-3 flex-1">
                  <div>
                    <span className={`text-sm font-bold uppercase ${t.textMuted} block`}>Faturamento Atual</span>
                    <h4 className="text-lg font-black font-mono-jb text-cyan-455">{formatCurrency(metaMensal.atual)}</h4>
                  </div>
                  <div>
                    <span className={`text-sm font-bold uppercase ${t.textMuted} block`}>Meta Estabelecida</span>
                    <h4 className="text-base font-black font-mono-jb text-slate-400">{formatCurrency(metaMensal.meta)}</h4>
                  </div>
                </div>
              </div>

              {/* Status e dias restantes */}
              <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-dashed border-slate-700/50">
                <div className={`p-2.5 rounded-2xl border ${t.inputBg} ${t.border}`}>
                  <span className={`block text-sm font-black uppercase ${t.textSecondary} mb-0.5`}>Tempo Restante</span>
                  <span className="text-sm font-black font-mono-jb text-slate-350">{metaMensal.diasRestantes} dias</span>
                </div>
                <div className={`p-2.5 rounded-2xl border ${t.inputBg} ${t.border}`}>
                  <span className={`block text-sm font-black uppercase ${t.textSecondary} mb-0.5`}>Meta Diária</span>
                  <span className="text-sm font-black font-mono-jb text-cyan-400">{formatCurrency(metaMensal.mediaDiaria)}</span>
                </div>
              </div>
            </div>

            <div className={`mt-4 p-3 rounded-xl border text-sm leading-relaxed flex gap-2 ${
              metaMensal.atingeMeta 
                ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400' 
                : 'bg-amber-500/5 border-amber-500/10 text-amber-400'
            }`}>
              <span>🚀</span>
              <div>
                <p className="font-black">Ritmo Operacional</p>
                <p className="font-medium mt-0.5">
                  {metaMensal.atingeMeta 
                    ? `No ritmo atual, a rede superará a meta atingindo ${formatCurrency(metaMensal.projecaoFinal)}.`
                    : `Ritmo abaixo do necessário. Projeção de ${formatCurrency(metaMensal.projecaoFinal)} para o final do mês.`
                  }
                </p>
              </div>
            </div>
          </motion.div>

          {/* Concentração por Cidades Reais */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.98 }}
            className={`lg:col-span-2 rounded-[2.5rem] p-6 border flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${t.cardBg} ${t.border}`}
          >
            {/* Background glowing violet orb */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📍</span>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-widest font-bricolage">Concentração por Cidades</h3>
                    <p className={`text-sm font-bold ${t.textSecondary}`}>Cidades com maior densidade de consumidores e faturamento hoje</p>
                  </div>
                </div>
                <span className="text-sm bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2.5 py-0.5 rounded-lg font-black font-space">
                  CRM GEOGRÁFICO
                </span>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-2">
                {/* Visual Representation (Horizontal progress bars) */}
                <div className="flex-1 w-full space-y-4">
                  {dadosRegiao.map((city, idx) => {
                    const maxClientes = Math.max(...dadosRegiao.map(c => c.clientes), 1);
                    const pct = Math.round((city.clientes / maxClientes) * 100);
                    const colors = [
                      'from-cyan-400 to-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.3)]',
                      'from-purple-400 to-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.3)]',
                      'from-emerald-400 to-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]',
                      'from-amber-400 to-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]',
                      'from-rose-400 to-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                    ];

                    return (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm font-bold font-space">
                          <span className={t.text}>{city.nome}</span>
                          <span className="font-mono-jb text-sm text-slate-555">{city.clientes} clientes</span>
                        </div>
                        <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-indigo-950/30' : 'bg-slate-200'}`}>
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${colors[idx % colors.length]}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Cities Stats details */}
                <div className="flex-1 w-full space-y-2.5">
                  {dadosRegiao.map((city, idx) => (
                    <div key={idx} className={`p-3 rounded-2xl border transition-colors duration-300 flex items-center justify-between ${t.inputBg} ${t.border} hover:border-cyan-500/10`}>
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">🏙️</span>
                        <div>
                          <span className="text-sm font-black uppercase font-space block">{city.nome}</span>
                          <span className={`text-sm font-bold ${t.textMuted}`}>{city.clientes} consumidores na base</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-black font-mono-jb text-slate-350 block">
                          {formatCurrency(city.faturamento)}
                        </span>
                        <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded-lg border bg-cyan-500/10 text-cyan-400 border-cyan-500/20`}>
                          faturamento hoje
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
        


          <div className="grid grid-cols-1 gap-6">
            {/* Clientes VIPs (Mais Ativos) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.98 }}
              className={`rounded-[2.5rem] p-6 border flex flex-col justify-between transition-all duration-300 ${t.cardBg} ${t.border}`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black uppercase tracking-widest font-bricolage">Clientes VIPs</h3>
                  <span className="text-sm bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2.5 py-0.5 rounded-lg font-black font-space">
                    MAIS ATIVOS
                  </span>
                </div>
                <p className={`text-sm font-bold ${t.textSecondary} mb-6`}>Consumidores com maior volume de compras e pedidos na rede</p>

                <div className="space-y-3">
                  {topClientes.length === 0 ? (
                    <div className="text-center py-8">
                      <FiUsers className={`mx-auto mb-2 ${t.textMuted}`} size={28} />
                      <p className={`text-sm font-bold ${t.textMuted}`}>Nenhum cliente ativo localizado.</p>
                    </div>
                  ) : (
                    topClientes.map((client, idx) => {
                      const phone = client.telefone?.replace(/\D/g, '') || '';
                      const hasPhone = phone.length >= 10;
                      const whatsappNumber = hasPhone ? `55${phone}` : '';
                      const message = encodeURIComponent(`Olá ${client.nome}! Agradecemos pela sua fidelidade na nossa rede!`);

                      const initials = client.nome ? client.nome.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'C';
                      const colors = [
                        'from-yellow-400/20 via-amber-500/10 to-orange-500/20 text-yellow-500 border-yellow-500/20',
                        'from-cyan-400/20 via-blue-500/10 to-indigo-500/20 text-cyan-400 border-cyan-500/20',
                        'from-purple-400/20 via-fuchsia-500/10 to-pink-500/20 text-purple-400 border-purple-500/20',
                        'from-emerald-400/20 via-teal-500/10 to-green-500/20 text-emerald-450 border-emerald-500/20',
                        'from-rose-400/20 via-red-500/10 to-orange-500/20 text-rose-400 border-rose-500/20'
                      ];

                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-3 rounded-2xl border transition-colors duration-300 ${t.inputBg} ${t.border} hover:border-yellow-500/20`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl bg-gradient-to-tr border flex items-center justify-center font-bricolage font-black text-sm ${colors[idx % colors.length]}`}>
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-sm font-black truncate max-w-[110px] sm:max-w-xs ${t.text} font-space`}>{client.nome}</p>
                              <p className={`text-sm font-bold ${t.textMuted} font-mono-jb`}>
                                {client.pedidosCount} {client.pedidosCount === 1 ? 'pedido' : 'pedidos'}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex items-center gap-3">
                            <div>
                              <span className="text-sm font-black font-mono-jb text-yellow-500 block">
                                {formatCurrency(client.totalGasto || 0)}
                              </span>
                            </div>
                            {hasPhone && (
                              <a
                                href={`https://wa.me/${whatsappNumber}?text=${message}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-450 border border-emerald-500/20 rounded-lg transition-all active:scale-95 shrink-0"
                              >
                                <FiMessageSquare size={16} />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <p className={`text-sm mt-4 font-black uppercase tracking-widest text-slate-500 font-mono-jb`}>
                Identificação de engajamento de clientes
              </p>
            </motion.div>
          </div>
        
    </>
  );
};
