import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, LineChart, Line } from 'recharts';
import { FiDollarSign, FiTrendingUp, FiChevronDown, FiShoppingCart, FiHome, FiUsers, FiAward, FiTag, FiSearch, FiClock, FiActivity, FiPhone, FiAlertCircle, FiMessageSquare, FiShield, FiLock, FiCheckCircle, FiXCircle, FiInfo, FiDownload } from 'react-icons/fi';
import { formatCurrency } from '../../../utils/formatters';
import { Link } from 'react-router-dom';
import DateRangeFilter from '../../DateRangeFilter';

export const SecurityTab = (props) => {
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

          <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-[2.5rem] p-6 border ${t.cardBg} ${t.border}`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/5">
            <div>
              <h3 className="text-base font-black uppercase tracking-widest font-bricolage">Segurança e Auditoria Mestre</h3>
              <p className={`text-[11px] font-bold ${t.textSecondary}`}>Timeline das últimas ações administrativas no sistema</p>
            </div>

            {/* Controles Avançados de Logs */}
            <div className="flex items-center flex-wrap gap-2.5">
              {/* Abas de Filtragem */}
              <div className={`flex items-center p-1 rounded-xl border ${theme === 'dark' ? 'bg-indigo-950/30 border-white/5' : 'bg-stone-200/40 border-stone-250'}`}>
                {[
                  { id: 'all', label: 'Tudo' },
                  { id: 'danger', label: 'Críticos' },
                  { id: 'warning', label: 'Alertas' },
                  { id: 'info', label: 'Info' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterLevel(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-black uppercase tracking-wider transition-all duration-200 ${
                      filterLevel === tab.id
                        ? (theme === 'dark' ? 'bg-cyan-500 text-indigo-950 font-black shadow-[0_0_12px_rgba(6,182,212,0.3)]' : 'bg-stone-900 text-white font-bold')
                        : `text-slate-450 hover:text-cyan-400`
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Botão de Exportação */}
              <button
                onClick={handleExportLogs}
                disabled={isExporting}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-black uppercase tracking-wider transition-all duration-300 ${
                  isExporting
                    ? 'opacity-50 cursor-not-allowed'
                    : 'active:scale-95'
                } ${t.surface} ${t.border} ${t.textSecondary} hover:text-cyan-400`}
              >
                {isExporting ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-500 border-t-cyan-400 animate-spin" />
                ) : (
                  <span>📥</span>
                )}
                <span>{isExporting ? 'Processando...' : 'Exportar CSV'}</span>
              </button>

              <div className={`p-2 rounded-xl border ${t.inputBg} ${t.border} ${t.textSecondary}`}>
                <FiShield size={18} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => {
                let badgeColor = 'bg-blue-500/10 text-blue-500 border-blue-500/20';
                if (log.level === 'warning') badgeColor = 'bg-amber-500/10 text-amber-500 border-amber-500/20';
                if (log.level === 'danger' || log.level === 'error') badgeColor = 'bg-rose-500/10 text-rose-500 border-rose-500/20';

                let logDateStr = 'Sem data';
                try {
                  const d = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
                  if (!isNaN(d.getTime())) {
                    logDateStr = format(d, "dd/MM/yyyy HH:mm:ss");
                  }
                } catch (e) {
                  console.error("Erro ao formatar data do log:", e);
                }

                return (
                  <div 
                    key={log.id} 
                    className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 ${t.inputBg} ${t.border} ${t.surfaceHover}`}
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <span className={`w-2 h-2 mt-2 sm:mt-0 rounded-full shrink-0 animate-pulse ${
                        log.level === 'danger' || log.level === 'error' ? 'bg-rose-500' :
                        log.level === 'warning' ? 'bg-amber-500' : 'bg-cyan-400'
                      }`} />
                      
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`text-sm font-black uppercase font-mono-jb ${t.text}`}>{log.actionType.replace(/_/g, ' ')}</p>
                          <span className={`text-sm font-black uppercase px-2 py-0.5 rounded-lg border font-mono-jb ${badgeColor}`}>
                            {log.level || 'info'}
                          </span>
                        </div>
                        <p className={`text-sm font-semibold ${t.textSecondary}`}>
                          Efetuado por: <span className="font-bold">{log.actor?.email}</span>
                          {log.target?.name && <> • Alvo: <span className="font-bold">{log.target.name}</span></>}
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1">
                      <div className="flex items-center gap-1">
                        <FiClock className={t.textMuted} size={16} />
                        <span className={`text-sm font-bold font-mono-jb ${t.textMuted}`}>
                          {logDateStr}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center">
                <FiAlertCircle className={`mx-auto mb-2 ${t.textMuted}`} size={24} />
                <p className={`text-sm font-bold ${t.textMuted}`}>Nenhum log de auditoria localizado para este filtro.</p>
              </div>
            )}
          </div>
        </motion.div>
        
    </>
  );
};
