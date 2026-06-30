import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, LineChart, Line } from 'recharts';
import { FiDollarSign, FiTrendingUp, FiChevronDown, FiShoppingCart, FiHome, FiUsers, FiAward, FiTag, FiSearch, FiClock, FiActivity, FiPhone, FiAlertCircle, FiMessageSquare, FiShield, FiLock, FiCheckCircle, FiXCircle, FiInfo, FiDownload, FiZap } from 'react-icons/fi';
import { formatCurrency } from '../../../utils/formatters';
import { Link } from 'react-router-dom';
import DateRangeFilter from '../../DateRangeFilter';

export const StoresTab = (props) => {
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
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 rounded-[2.5rem] border backdrop-blur-xl transition-all duration-300 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative z-30 ${t.surface} ${t.border}`}
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/10 border border-red-500/15 text-red-500 rounded-2xl animate-pulse">
                <FiZap size={20} />
              </div>
              <div>
                <h3 className="text-base font-black uppercase tracking-widest font-bricolage">Terminal de Comando da Rede</h3>
                <p className={`text-sm font-bold ${t.textSecondary}`}>Ações de segurança e comunicação global em tempo real</p>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-3.5 w-full md:w-auto justify-end">
              {/* Switch Modo Manutenção */}
              <div className={`flex items-center justify-between gap-4 px-4 py-2.5 rounded-2xl border ${t.inputBg} ${t.border}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${modoManutencao ? 'bg-red-500 animate-ping' : 'bg-emerald-550'}`} />
                  <span className="text-sm font-black uppercase tracking-wider font-space">Manutenção Geral</span>
                </div>
                <button
                  onClick={() => toggleModoManutencao(!modoManutencao)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    modoManutencao ? 'bg-red-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      modoManutencao ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Bloqueio Expresso */}
              <button
                onClick={() => setShowSuspendModal(true)}
                className="px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/15 rounded-2xl text-sm font-black uppercase tracking-wider transition-all duration-300 active:scale-95 flex items-center gap-2"
              >
                <span>🚫</span> Bloquear Loja
              </button>

              {/* Comunicado Interno */}
              <button
                onClick={() => setShowComunicadoModal(true)}
                className="px-4 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-455 border border-indigo-500/15 rounded-2xl text-sm font-black uppercase tracking-wider transition-all duration-300 active:scale-95 flex items-center gap-2"
              >
                <span>📢</span> Comunicado Interno
              </button>

              {/* Megafone Global */}
              <Link
                to="/master/mensagens"
                className="px-4 py-3 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-455 border border-cyan-500/15 rounded-2xl text-sm font-black uppercase tracking-wider transition-all duration-300 active:scale-95 flex items-center gap-2"
              >
                <span>📣</span> Megafone WhatsApp
              </Link>
            </div>
          </motion.div>
        


          <div className="grid grid-cols-1 gap-6">
            {/* Ranking de Faturamento das Lojas */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className={`rounded-[2.5rem] p-6 border transition-all duration-300 ${t.cardBg} ${t.border}`}
            >
              <h3 className="text-base font-black uppercase tracking-widest mb-4 font-bricolage">Faturamento das Lojas</h3>

              <div className="space-y-2">
                {(() => {
                  const ranking = financeiroFiltrado ? financeiroFiltrado.topLojas : financeiro.topLojas;
                  const stores = ranking?.slice(1, 6) || [];

                  if (stores.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <FiActivity className={`mx-auto mb-2 ${t.textMuted}`} size={28} />
                        <p className={`text-sm font-bold ${t.textMuted}`}>Sem faturamento de outras lojas.</p>
                      </div>
                    );
                  }

                  const maxValue = Math.max(...stores.map(s => s.total), 1);

                  return stores.map((store, idx) => (
                    <div
                      key={store.id}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all duration-300 ${t.inputBg} ${t.border} ${t.surfaceHover}`}
                      onClick={() => setSelectedLoja(store)}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-3">
                          <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-sm font-black ${
                            idx === 0 ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/15' :
                            idx === 1 ? 'bg-slate-500/10 text-slate-450 border border-slate-700' :
                            'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                          }`}>
                            #{idx + 2}
                          </span>
                          <div>
                            <p className={`text-sm font-black truncate max-w-[130px] sm:max-w-xs ${t.text} font-space`}>
                              {estabelecimentosMap[store.id] || store.nomeSalvoNoPedido || 'Loja'}
                            </p>
                            <p className={`text-sm font-bold ${t.textMuted}`}>{store.pedidos} pedidos</p>
                          </div>
                        </div>
                        <p className="text-sm font-black text-cyan-500 font-mono-jb">
                          {formatCurrency(store.total)}
                        </p>
                      </div>
                      {/* Glowing progress bar */}
                      <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-indigo-950/30' : 'bg-slate-200'}`}>
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(6,182,212,0.3)]"
                          style={{ width: `${(store.total / maxValue) * 100}%` }}
                        />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </motion.div>
          </div>
        


          <div className="grid grid-cols-1 gap-6">
            {/* Timeline de Atividades de Lojas ao Vivo */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0 }}
              className={`lg:col-span-2 rounded-[2.5rem] p-6 border flex flex-col justify-between transition-all duration-300 ${t.cardBg} ${t.border}`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-black uppercase tracking-widest font-bricolage">Atividades ao Vivo das Lojas</h3>
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-black uppercase border bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                    REALTIME
                  </span>
                </div>
                <p className={`text-[11px] font-bold ${t.textSecondary} mb-6`}>Log de eventos operacionais e transações de lojas em tempo real</p>

                {/* Timeline Container */}
                <div className="space-y-3 max-h-72 overflow-y-auto no-scrollbar pr-1">
                  {atividadesLojas.map((log) => {
                    let eventIcon = '⚡';
                    if (log.icone === 'caixa') eventIcon = '💰';
                    if (log.icone === 'nfce') eventIcon = '🧾';
                    if (log.icone === 'pedido') eventIcon = '🍔';
                    if (log.icone === 'entrega') eventIcon = '🏍️';
                    if (log.icone === 'campanha') eventIcon = '🎟️';

                    const diffSegundos = Math.floor((new Date() - new Date(log.timestamp)) / 1000);
                    let tempoRelStr = 'agora mesmo';
                    if (diffSegundos >= 60) {
                      const diffMinutos = Math.floor(diffSegundos / 60);
                      tempoRelStr = `há ${diffMinutos} min`;
                    }

                    return (
                      <div key={log.id} className={`p-3.5 rounded-2xl border flex items-center justify-between gap-4 transition-all duration-300 ${t.inputBg} ${t.border} ${t.surfaceHover}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-md font-bold shrink-0 ${log.cor}`}>
                            {eventIcon}
                          </div>
                          <div>
                            <p className={`text-sm font-black font-space ${t.text}`}>{log.loja}</p>
                            <p className={`text-sm font-medium ${t.textSecondary}`}>{log.mensagem}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 flex items-center gap-1.5">
                          <FiClock className={t.textMuted} size={18} />
                          <span className={`text-sm font-black uppercase tracking-wider font-mono-jb ${t.textMuted}`}>{tempoRelStr}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className={`text-sm mt-4 font-black uppercase tracking-widest ${t.textMuted} font-mono-jb`}>
                Fluxo unificado de franquias
              </p>
            </motion.div>
          </div>
        


          <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05 }}
          className={`rounded-[2.5rem] p-6 border transition-all duration-300 ${t.cardBg} ${t.border}`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/5">
            <div>
              <h3 className="text-2xl font-black uppercase tracking-widest font-bricolage flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                Painel de Saúde e Desempenho das Lojas
              </h3>
              <p className={`text-base font-semibold ${t.textSecondary}`}>Diagnóstico inteligente de inatividade e anomalias operacionais</p>
            </div>
            <span className="text-sm bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-lg font-black font-space">
              ALERTA CLÍNICO
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Lojas sem vendas nas últimas 48h */}
            <div className="space-y-4">
              <h4 className="text-lg font-black uppercase tracking-widest font-bricolage text-amber-500 flex items-center gap-1.5">
                <span>⚠️</span> Lojas Inativas (Últimas 48h)
              </h4>
              <div className="space-y-3">
                {alertas.inativas && alertas.inativas.length > 0 ? (
                  alertas.inativas.map((item) => {
                    const cleanPhone = item.telefone?.replace(/\D/g, '') || '';
                    const hasPhone = cleanPhone.length >= 10;
                    const waLink = hasPhone ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(`Olá, notamos que a sua loja ${item.nome} está sem vendas nas últimas 48h. Está tudo bem com o sistema ou com a operação?`)}` : null;

                    return (
                      <div key={item.id} className={`p-4.5 rounded-2xl border flex items-center justify-between gap-3 ${t.inputBg} ${t.border}`}>
                        <div>
                          <p className={`text-lg font-black ${t.text}`}>{item.nome}</p>
                          <p className="text-base font-bold text-amber-500/80 uppercase font-space mt-1">Nenhuma venda registrada desde ontem</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {waLink && (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Contatar no WhatsApp"
                              className="p-3 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-455 border border-emerald-500/20 rounded-xl transition-all active:scale-95"
                            >
                              <FiMessageSquare size={16} />
                            </a>
                          )}
                          <button
                            onClick={() => handleQuickSuspendSetup(item.id, `Inatividade de vendas prolongada nas últimas 48 horas.`)}
                            title="Bloquear Loja"
                            className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-all active:scale-95"
                          >
                            <FiAlertCircle size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={`p-6 rounded-2xl border border-dashed flex flex-col items-center justify-center text-center ${t.border} ${t.surfaceHover}`}>
                    <span className="text-2xl mb-2">🎉</span>
                    <p className={`text-base font-black ${t.text}`}>100% de Atividade</p>
                    <p className={`text-base ${t.textMuted} mt-0.5`}>Todas as lojas ativas registraram vendas recentemente.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Lojas com alta taxa de cancelamento */}
            <div className="space-y-4">
              <h4 className="text-lg font-black uppercase tracking-widest font-bricolage text-rose-500 flex items-center gap-1.5">
                <span>🚨</span> Alta Rejeição / Cancelamento
              </h4>
              <div className="space-y-3">
                {alertas.altaRejeicao && alertas.altaRejeicao.length > 0 ? (
                  alertas.altaRejeicao.map((item) => {
                    const cleanPhone = item.telefone?.replace(/\D/g, '') || '';
                    const hasPhone = cleanPhone.length >= 10;
                    const waLink = hasPhone ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(`Olá, notamos que a sua loja ${item.nome} está com uma alta taxa de pedidos cancelados (${item.taxa}%). Precisa de ajuda com o sistema?`)}` : null;

                    return (
                      <div key={item.id} className={`p-4.5 rounded-2xl border flex items-center justify-between gap-3 ${t.inputBg} ${t.border}`}>
                        <div>
                          <p className={`text-lg font-black ${t.text}`}>{item.nome}</p>
                          <p className="text-base font-bold text-rose-500/90 uppercase font-space mt-1">
                            {item.taxa}% Cancelados ({item.cancelados} de {item.total} pedidos)
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {waLink && (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Contatar no WhatsApp"
                              className="p-3 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-455 border border-emerald-500/20 rounded-xl transition-all active:scale-95"
                            >
                              <FiMessageSquare size={16} />
                            </a>
                          )}
                          <button
                            onClick={() => handleQuickSuspendSetup(item.id, `Taxa de cancelamento de pedidos excessiva (${item.taxa}% das vendas).`)}
                            title="Bloquear Loja"
                            className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-all active:scale-95"
                          >
                            <FiAlertCircle size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={`p-6 rounded-2xl border border-dashed flex flex-col items-center justify-center text-center ${t.border} ${t.surfaceHover}`}>
                    <span className="text-2xl mb-2">🛡️</span>
                    <p className={`text-base font-black ${t.text}`}>Operação Estável</p>
                    <p className={`text-sm ${t.textMuted} mt-0.5`}>Nenhum parceiro apresenta taxas de cancelamento críticas.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
        


          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Contacts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
            className={`lg:col-span-1 rounded-[2.5rem] p-6 border transition-all duration-300 ${t.cardBg} ${t.border}`}
          >
            <h3 className="text-lg font-black uppercase tracking-widest mb-4 font-bricolage">Contatos de Parceiros</h3>

            <div className="space-y-2">
              {contatosEstabelecimentos.length === 0 ? (
                <div className="text-center py-8">
                  <FiPhone className={`mx-auto mb-2 ${t.textMuted}`} size={28} />
                  <p className={`text-sm font-bold ${t.textMuted}`}>Nenhum contato localizado.</p>
                </div>
              ) : (
                contatosEstabelecimentos.slice(0, 5).map((estab) => {
                  const phone = estab.telefone?.replace(/\D/g, '') || '';
                  const hasPhone = phone.length >= 10;
                  const whatsappNumber = hasPhone ? `55${phone}` : '';
                  const message = encodeURIComponent(`Olá ${estab.nome}! Tudo bem?`);
                  
                  const char = estab.nome ? estab.nome.substring(0, 2).toUpperCase() : 'LJ';
                  const charCode = char.charCodeAt(0);
                  const gradColor = charCode % 3 === 0 
                    ? 'from-cyan-500/15 via-indigo-500/15 to-purple-650/15 border-indigo-500/15 text-cyan-450'
                    : charCode % 3 === 1 
                      ? 'from-emerald-500/15 via-teal-500/15 to-cyan-500/15 border-emerald-500/15 text-emerald-450' 
                      : 'from-amber-500/15 via-orange-500/15 to-red-500/15 border-orange-500/15 text-orange-400';

                  return (
                    <div
                      key={estab.id}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border transition-colors duration-300 ${t.inputBg} ${t.border}`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr border flex items-center justify-center font-bricolage font-black shrink-0 ${gradColor}`}>
                          {char}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-black truncate ${t.text} font-space`}>{estab.nome}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {hasPhone ? (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                <span className={`text-sm font-bold font-mono-jb ${t.textSecondary} truncate`}>{estab.telefone}</span>
                              </>
                            ) : (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-505 shrink-0" />
                                <span className={`text-sm font-bold ${t.textMuted} truncate`}>Sem telefone</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {hasPhone ? (
                        <a
                          href={`https://wa.me/${whatsappNumber}?text=${message}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all active:scale-95 shadow-md shadow-emerald-700/10 shrink-0"
                        >
                          <FiMessageSquare size={18} />
                        </a>
                      ) : (
                        <div className={`p-3 rounded-xl border shrink-0 ${t.inputBg} ${t.border}`}>
                          <FiPhone className={t.textMuted} size={18} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>

          {/* Onboarding Recente */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            className={`lg:col-span-2 rounded-[2.5rem] p-6 border transition-all duration-300 ${t.cardBg} ${t.border}`}
          >
            <h3 className="text-lg font-black uppercase tracking-widest mb-4 font-bricolage">Novos Parceiros</h3>

            <div className="space-y-2">
              {ultimosEstabelecimentos.length === 0 ? (
                <div className="text-center py-8">
                  <FiHome className={`mx-auto mb-2 ${t.textMuted}`} size={28} />
                  <p className={`text-sm font-bold ${t.textMuted}`}>Nenhum onboarding recente.</p>
                </div>
              ) : (
                ultimosEstabelecimentos.map((estab) => {
                  let dateStr = 'Data inválida';
                  try {
                    const d = estab.createdAt instanceof Date ? estab.createdAt : new Date(estab.createdAt);
                    if (!isNaN(d.getTime())) {
                      dateStr = format(d, "dd/MM/yyyy");
                    }
                  } catch (e) {
                    console.error("Erro ao formatar data do novos parceiros:", e);
                  }
                  
                  const char = estab.nome ? estab.nome.substring(0, 2).toUpperCase() : 'LJ';
                  const charCode = char.charCodeAt(0);
                  const gradColor = charCode % 3 === 0 
                    ? 'from-cyan-500/15 via-indigo-500/15 to-purple-650/15 border-indigo-500/15 text-cyan-400'
                    : charCode % 3 === 1 
                      ? 'from-emerald-500/15 via-teal-500/15 to-cyan-500/15 border-emerald-500/15 text-emerald-400' 
                      : 'from-amber-500/15 via-orange-500/15 to-red-500/15 border-orange-500/15 text-orange-400';

                  return (
                    <div
                      key={estab.id}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border transition-colors duration-300 ${t.inputBg} ${t.border}`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr border flex items-center justify-center font-bricolage font-black shrink-0 ${gradColor}`}>
                          {char}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-black truncate ${t.text} font-space`}>{estab.nome}</p>
                          <p className={`text-sm font-semibold ${t.textMuted} truncate`}>{estab.tipoNegocio.toUpperCase()} • {dateStr}</p>
                        </div>
                      </div>

                      <span className={`text-sm font-black px-2.5 py-1 rounded-lg border uppercase shrink-0 ${
                        estab.ativo 
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                          : 'bg-red-500/10 text-red-500 border-red-500/20'
                      }`}>
                        {estab.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
        
    </>
  );
};
