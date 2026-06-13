import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useContasReceberChatbot } from '../../hooks/useContasReceberChatbot';
import { 
  FiArrowLeft, FiSun, FiMoon, FiLogOut, FiPlus, FiLayers, FiCheck, FiX,
  FiDollarSign, FiCalendar, FiAlertCircle, FiCheckCircle,
  FiClock, FiSearch, FiBriefcase, FiPhone, FiMessageCircle, FiRotateCcw,
  FiTrash2, FiEdit2, FiUsers, FiFileText, FiActivity
} from 'react-icons/fi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

// --- Skeleton loaders ---
const SkeletonRow = ({ isDark }) => (
  <div className={`p-6 flex flex-col lg:flex-row lg:items-center gap-6 animate-pulse border-b ${isDark ? 'border-slate-800/60' : 'border-slate-100'}`}>
    <div className={`w-12 h-12 rounded-2xl shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    <div className="flex-1 space-y-2">
      <div className={`h-4 rounded-lg w-40 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
      <div className={`h-3 rounded-lg w-24 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    </div>
    <div className="w-24 space-y-1">
      <div className={`h-3 rounded-md w-12 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
      <div className={`h-6 rounded-md w-16 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    </div>
    <div className="flex-1">
      <div className={`h-6 rounded-full w-24 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    </div>
    <div className="flex-1 flex gap-2 lg:justify-end">
      <div className={`h-10 rounded-full w-10 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
      <div className={`h-10 rounded-full w-32 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    </div>
  </div>
);

function ContasReceberChatbot() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  const {
    clientes, faturas, loading, activeTab, setActiveTab,
    filtroStatus, setFiltroStatus, searchQuery, setSearchQuery, sortBy, setSortBy,
    resumo, faturasFiltradas, clientesFiltrados,
    modalClienteOpen, setModalClienteOpen, novoCliente, setNovoCliente, editingClienteId,
    abrirNovoCliente, abrirEditarCliente, handleSalvarCliente, handleExcluirCliente, handleToggleAtivoCliente,
    modalFaturaOpen, setModalFaturaOpen, novaFatura, setNovaFatura, handleCriarFatura, handleBaixa, handleExcluirFatura,
    modalMassaOpen, setModalMassaOpen, loadingMassa, massaConfig, setMassaConfig, handleCobrancasEmMassa,
    formatData, getVencimentoStatus, parseDate, enviarWhatsAppCobranca
  } = useContasReceberChatbot();

  // Fixed light theme for clean white Apple aesthetic
  const theme = 'light';
  const isDark = false;
  const t = {
    bg: 'bg-white',
    surface: 'bg-white',
    surfaceHover: 'hover:bg-white hover:shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:scale-[1.005] hover:border-slate-300/50',
    border: 'border-[#E5E5EA]',
    text: 'text-[#1D1D1F]',
    textSecondary: 'text-[#86868B]',
    textMuted: 'text-slate-400',
    accent: 'bg-black',
    accentHover: 'hover:bg-slate-800',
    gradient: 'from-slate-800 to-black',
    cardBg: 'bg-white',
    inputBg: 'bg-slate-100/60',
  };

  const getStatusBadge = (fatura) => {
    const status = getVencimentoStatus(fatura);
    const styles = {
      pago: isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
      atrasado: isDark ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-700 border-red-200',
      vencendo: isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200',
      pendente: isDark ? 'bg-slate-700/10 text-slate-300 border-slate-700/20' : 'bg-slate-50 text-slate-600 border-slate-200',
    };
    
    const icons = {
      pago: <FiCheckCircle className="shrink-0" size={12} />, 
      atrasado: <FiAlertCircle className="shrink-0" size={12} />,
      vencendo: <FiClock className="shrink-0" size={12} />, 
      pendente: <FiCalendar className="shrink-0" size={12} />,
    };
    const labels = { pago: 'PAGO', atrasado: 'ATRASADO', vencendo: 'VENCE HOJE', pendente: 'PENDENTE' };

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold rounded-full uppercase tracking-wider border ${styles[status]}`}>
        {icons[status]} {labels[status]}
      </span>
    );
  };

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (authLoading) {
    return (
      <div className={`min-h-screen ${t.bg} flex items-center justify-center`}>
        <div className="w-12 h-12 border-4 border-slate-800 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isMasterAdmin) {
    return (
      <div className={`min-h-screen ${t.bg} flex items-center justify-center p-10 text-center`}>
        <div className={`p-8 rounded-3xl border ${t.surface} ${t.border} max-w-sm`}>
          <FiAlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className={`text-xl font-bold ${t.text} mb-2`}>Acesso Negado</h2>
          <p className={`text-sm ${t.textSecondary} mb-4`}>Esta área é restrita para administradores master do sistema.</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-black text-white rounded-xl text-sm font-semibold hover:bg-slate-800">Ir para Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${t.bg} transition-colors duration-500 relative overflow-hidden pb-24 pt-4 px-4 sm:px-8`}>
      
      {/* --- FLOATING PILL NAVBAR --- */}
      <nav className={`max-w-[1400px] mx-auto backdrop-blur-xl border shadow-lg rounded-3xl h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all ${t.surface} ${t.border}`}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/master-dashboard')} className={`w-9 h-9 ${t.inputBg} hover:opacity-80 rounded-xl flex items-center justify-center transition-all`}>
            <FiArrowLeft className={`${t.text} text-sm`} />
          </button>
          <div className="hidden sm:block border-l border-slate-700/50 pl-4">
            <h1 className={`font-bold text-sm tracking-tight ${t.text}`}>Contas a Receber</h1>
            <p className={`text-[10px] ${t.textSecondary} font-semibold`}>{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={async () => { await logout(); navigate('/'); }} className="w-9 h-9 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl flex items-center justify-center transition-all" title="Sair">
            <FiLogOut className="text-red-400" size={15} />
          </button>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto mt-8 relative z-10">
        
        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 px-2">
          <div>
            <h1 className={`text-4xl font-extrabold tracking-tight ${t.text}`}>Contas a Receber</h1>
            <p className={`${t.textSecondary} text-sm mt-1 font-semibold`}>Gerencie seus clientes, mensalidades recorrentes e recebíveis.</p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {activeTab === 'receber' ? (
              <>
                <button onClick={() => setModalFaturaOpen(true)} 
                  className="flex items-center gap-2 bg-black hover:bg-slate-800 text-white px-5 py-3 rounded-2xl shadow-md font-bold text-xs transition-all active:scale-95">
                  <FiPlus size={14} /> Novo Lançamento
                </button>
                <button onClick={() => setModalMassaOpen(true)}
                  className="flex items-center gap-2 bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 px-5 py-3 rounded-2xl shadow-sm font-bold text-xs transition-all active:scale-95">
                  <FiLayers size={14} /> Faturar Mês
                </button>
              </>
            ) : (
              <button onClick={abrirNovoCliente}
                className="flex items-center gap-2 bg-black hover:bg-slate-800 text-white px-5 py-3 rounded-2xl shadow-md font-bold text-xs transition-all active:scale-95">
                <FiPlus size={14} /> Novo Cliente
              </button>
            )}
          </div>
        </div>

        {/* --- TABS --- */}
        <div className="flex gap-2 mb-6 px-2 border-b border-slate-200 pb-4">
          <button 
            onClick={() => { setActiveTab('receber'); setFiltroStatus('todos'); }}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 border ${
              activeTab === 'receber'
                ? 'bg-black border-black text-white shadow-md'
                : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
            }`}
          >
            <FiFileText size={14} /> Contas a Receber
          </button>
          <button 
            onClick={() => { setActiveTab('clientes'); }}
            className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 border ${
              activeTab === 'clientes'
                ? 'bg-black border-black text-white shadow-md'
                : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
            }`}
          >
            <FiUsers size={14} /> Clientes Cadastrados
          </button>
        </div>

        {/* --- METRICS GRID --- */}
        {activeTab === 'receber' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
            
            {/* Received */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className={`${t.cardBg} rounded-[2rem] border ${t.border} p-8 shadow-sm flex flex-col justify-between hover:border-emerald-500 transition-all duration-300 relative overflow-hidden`}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-r-full" />
              <div className="flex justify-between items-start mb-6">
                 <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-600"><FiCheckCircle size={22} /></div>
                 <p className="px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700">{resumo.pagosCount} pagos</p>
              </div>
              <div>
                 <p className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider mb-1`}>Caixa Recebido</p>
                 <p className={`text-3xl font-black tracking-tight ${t.text}`}>R$ {fmt(resumo.pago)}</p>
              </div>
            </motion.div>

            {/* Pending */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className={`${t.cardBg} rounded-[2rem] border ${t.border} p-8 shadow-sm flex flex-col justify-between hover:border-slate-400 transition-all duration-300 relative overflow-hidden`}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-600 rounded-r-full" />
              <div className="flex justify-between items-start mb-6">
                 <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-700"><FiClock size={22} /></div>
                 <p className="px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-750">{resumo.pendentesCount} abertos</p>
              </div>
              <div>
                 <p className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider mb-1`}>A Receber</p>
                 <p className={`text-3xl font-black tracking-tight ${t.text}`}>R$ {fmt(resumo.pendente)}</p>
              </div>
            </motion.div>

            {/* Overdue */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`rounded-[2rem] p-8 shadow-md flex flex-col justify-between relative overflow-hidden group border transition-all duration-300 ${
                resumo.atrasados > 0 
                  ? 'bg-red-50 border-red-200' 
                  : `${t.cardBg} ${t.border} hover:border-red-500/20`
              }`}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-r-full" />
              <div className="relative z-10 flex justify-between items-start mb-6">
                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                   resumo.atrasados > 0 
                     ? 'bg-red-100 text-red-600' 
                     : 'bg-slate-100 text-slate-500'
                 }`}><FiAlertCircle size={22} /></div>
                 <p className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                   resumo.atrasados > 0 
                     ? 'bg-red-100 text-red-700' 
                     : 'bg-slate-100 text-slate-655'
                 }`}>
                   {resumo.atrasados > 0 ? `${resumo.atrasados} atrasados` : 'Sem atrasos'}
                 </p>
              </div>
              <div className="relative z-10">
                 <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${resumo.atrasados > 0 ? 'text-red-500' : t.textMuted}`}>Em Atraso</p>
                 <p className={`text-3xl font-black tracking-tight ${resumo.atrasados > 0 ? 'text-red-600' : t.text}`}>R$ {fmt(resumo.valorAtrasado)}</p>
              </div>
            </motion.div>

            {/* Total Managed */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-[2rem] border border-slate-900 bg-slate-900 text-white p-8 shadow-md flex flex-col justify-between relative overflow-hidden group transition-all duration-300"
            >
              <div className="relative z-10 flex justify-between items-start mb-6">
                 <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/10 text-white"><FiDollarSign size={22} /></div>
              </div>
              <div className="relative z-10">
                 <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-slate-300">Total Lançado</p>
                 <p className="text-3xl font-black tracking-tight mb-2 text-white">R$ {fmt(resumo.total)}</p>
                 <div className="w-full rounded-full h-1 overflow-hidden bg-white/20">
                   <div className="bg-white h-1" style={{width: `${resumo.total > 0 ? (resumo.pago / resumo.total * 100) : 0}%`}}></div>
                 </div>
              </div>
            </motion.div>

          </div>
        )}

        {/* --- CONTROL BAR --- */}
        <div className={`p-4 rounded-3xl border mb-6 flex flex-col md:flex-row items-center justify-between gap-4 ${t.surface} ${t.border}`}>
          {/* Status Filters (Only for invoices) */}
          {activeTab === 'receber' ? (
            <div className="flex overflow-x-auto hide-scrollbar gap-2 w-full md:w-auto">
              {[
                { id: 'todos', label: 'Todos Débitos', count: faturas.length },
                { id: 'pendente', label: 'Pendentes', count: resumo.pendentesCount },
                { id: 'atrasado', label: 'Atrasados', count: resumo.atrasados },
                { id: 'pago', label: 'Histórico Pago', count: resumo.pagosCount },
              ].map(s => (
                <button key={s.id} onClick={() => setFiltroStatus(s.id)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap border
                    ${filtroStatus === s.id 
                      ? 'bg-black border-black text-white shadow-md' 
                      : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  {s.label}
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    filtroStatus === s.id 
                      ? 'bg-white text-black' 
                      : 'bg-slate-100 text-slate-500'
                  }`}>{s.count}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-bold text-[#86868B] px-2 py-1">
              <FiUsers /> Total de {clientes.length} clientes cadastrados
            </div>
          )}

          {/* Controls: Search & Sorting */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {activeTab === 'receber' && (
              <div className={`relative border rounded-2xl px-4 py-2.5 flex items-center shadow-sm bg-white ${t.border}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${t.textMuted} mr-2`}>Ordenar:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className={`bg-transparent border-none outline-none text-xs font-bold cursor-pointer appearance-none pr-6 ${t.text}`}
                  style={{ WebkitAppearance: 'none' }}
                >
                  <option value="data_desc" className="bg-white text-slate-900">Data (Recente)</option>
                  <option value="data_asc" className="bg-white text-slate-900">Data (Antigo)</option>
                  <option value="valor_desc" className="bg-white text-slate-900">Valor (Maior)</option>
                  <option value="valor_asc" className="bg-white text-slate-900">Valor (Menor)</option>
                  <option value="nome_asc" className="bg-white text-slate-900">Cliente (A-Z)</option>
                </select>
                <div className="pointer-events-none absolute right-3.5 flex items-center">
                  <svg className={`fill-current h-4 w-4 ${t.textSecondary}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                  </svg>
                </div>
              </div>
            )}

            {/* Search */}
            <div className={`relative w-full sm:w-60 md:w-72 border rounded-2xl px-4 py-2.5 flex items-center shadow-sm ${t.inputBg} ${t.border}`}>
              <FiSearch className={`${t.textSecondary}`} size={16} />
              <input 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)}
                className={`bg-transparent border-none outline-none text-xs ml-2 w-full font-semibold placeholder-gray-400 ${t.text}`}
                placeholder={activeTab === 'receber' ? "Buscar cobrança..." : "Buscar cliente..."} 
              />
            </div>
          </div>
        </div>

        {/* --- LIST CONTENT VIEW --- */}
        <div className={`rounded-3xl shadow-xl border overflow-hidden ${t.surface} ${t.border}`}>
          {loading ? (
            <div className="divide-y divide-slate-800/40">
               {[1,2,3,4].map(i => <SkeletonRow key={i} isDark={isDark} />)}
            </div>
          ) : activeTab === 'receber' ? (
            // CONTAS A RECEBER TAB
            faturasFiltradas.length === 0 ? (
              <div className="p-20 text-center">
                <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 ${t.inputBg}`}>
                  <FiSearch className={`text-xl ${t.textSecondary}`} />
                </div>
                <h3 className={`text-lg font-bold ${t.text} mb-1`}>Sem Lançamentos</h3>
                <p className={`text-xs font-semibold ${t.textSecondary}`}>Nenhuma fatura de cliente cadastrada para este filtro.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700/30">
                {faturasFiltradas.map((fatura, idx) => (
                  <motion.div 
                    key={fatura.id || idx} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                    className={`p-6 flex flex-col lg:flex-row lg:items-center gap-6 transition-all ${t.surfaceHover}`}
                  >
                    {/* Identity */}
                    <div className="flex items-center gap-4 flex-[2] min-w-[220px]">
                      <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${t.inputBg} ${t.border}`}>
                        <FiBriefcase className={`${t.textSecondary}`} size={16} />
                      </div>
                      <div>
                        <p className={`font-bold text-base ${t.text} line-clamp-1`}>{fatura.clienteNome}</p>
                        <p className={`text-xs font-semibold ${t.textSecondary} mt-0.5`}>{fatura.descricao}</p>
                      </div>
                    </div>

                    {/* Vencimento e Valor */}
                    <div className="flex flex-row justify-between lg:flex-col lg:justify-center flex-1 gap-1.5">
                       <p className={`text-xs font-bold ${t.textSecondary} flex items-center gap-1.5`}>
                         <FiCalendar size={11} /> {formatData(fatura.vencimento)}
                       </p>
                       <p className={`font-black text-xl tabular-nums ${t.text}`}>R$ {fmt(fatura.valor)}</p>
                    </div>

                    {/* Status */}
                    <div className="flex-[1.5] flex items-center gap-2">
                       {getStatusBadge(fatura)}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-row items-center gap-2 justify-end flex-1 mt-4 lg:mt-0 pt-4 lg:pt-0 border-t border-slate-700/20 lg:border-0">
                      {fatura.status === 'pendente' && (
                         <button 
                           onClick={() => enviarWhatsAppCobranca(fatura)}
                           className="w-10 h-10 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-center text-green-400 hover:bg-green-500/20 transition-all active:scale-95 shrink-0"
                           title="Lembrete WhatsApp"
                         >
                           <FiMessageCircle size={16} />
                         </button>
                      )}
                      
                      {fatura.status === 'pago' ? (
                          <button 
                            onClick={() => handleBaixa(fatura)}
                            className="bg-red-500/10 border border-red-500/20 px-5 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/20 transition-all active:scale-95 flex items-center gap-1.5"
                          >
                            <FiRotateCcw size={12} /> Estornar
                          </button>
                      ) : (
                          <button 
                            onClick={() => handleBaixa(fatura)}
                            className="bg-black border border-black px-5 py-2.5 rounded-xl text-xs font-bold text-white hover:bg-slate-800 transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                          >
                            <FiCheck size={12} /> Receber
                          </button>
                      )}

                      <button 
                        onClick={() => handleExcluirFatura(fatura.id)}
                        className="w-10 h-10 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-550/20 transition-all active:scale-95 shrink-0"
                        title="Deletar Fatura"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>

                  </motion.div>
                ))}
              </div>
            )
          ) : (
            // CLIENTS TAB
            clientesFiltrados.length === 0 ? (
              <div className="p-20 text-center">
                <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 ${t.inputBg}`}>
                  <FiUsers className={`text-xl ${t.textSecondary}`} />
                </div>
                <h3 className={`text-lg font-bold ${t.text} mb-1`}>Sem Clientes</h3>
                <p className={`text-xs font-semibold ${t.textSecondary}`}>Nenhum cliente cadastrado.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700/30">
                {clientesFiltrados.map((cliente, idx) => (
                  <motion.div
                    key={cliente.id || idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                    className={`p-6 flex flex-col lg:flex-row lg:items-center gap-6 transition-all ${t.surfaceHover}`}
                  >
                    {/* Identity */}
                    <div className="flex items-center gap-4 flex-[2] min-w-[220px]">
                      <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${t.inputBg} ${t.border}`}>
                        <FiUsers className={`${t.textSecondary}`} size={16} />
                      </div>
                      <div>
                        <p className={`font-bold text-base ${t.text}`}>{cliente.nome}</p>
                        <p className={`text-xs font-semibold ${t.textSecondary} mt-0.5`}>{cliente.descricao || 'Sem descrição'}</p>
                      </div>
                    </div>

                    {/* Mensalidade e Dia de vencimento */}
                    <div className="flex flex-row justify-between lg:flex-col lg:justify-center flex-1 gap-1.5">
                       <p className={`text-xs font-bold ${t.textSecondary} flex items-center gap-1.5`}>
                         Vencimento dia: <span className="text-black font-extrabold">{cliente.diaVencimento}</span>
                       </p>
                       <p className={`font-black text-xl tabular-nums ${t.text}`}>R$ {fmt(cliente.mensalidade)} /mês</p>
                    </div>

                    {/* WhatsApp */}
                    <div className="flex-1 flex items-center gap-2">
                       {cliente.telefone ? (
                         <a 
                           href={`https://wa.me/55${cliente.telefone.replace(/\D/g, '')}`} 
                           target="_blank" 
                           rel="noreferrer"
                           className={`flex items-center gap-1.5 text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full`}
                         >
                           <FiPhone size={12} /> {cliente.telefone}
                         </a>
                       ) : (
                         <span className={`text-xs font-semibold ${t.textMuted}`}>Sem número</span>
                       )}
                    </div>

                    {/* Status toggle & Actions */}
                    <div className="flex flex-row items-center gap-2 justify-end flex-1 mt-4 lg:mt-0 pt-4 lg:pt-0 border-t border-slate-700/20 lg:border-0">
                      <button 
                        onClick={() => handleToggleAtivoCliente(cliente)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                          cliente.ativo 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' 
                            : 'bg-slate-700/10 border-slate-700/20 text-slate-400 hover:bg-slate-700/20'
                        }`}
                      >
                        {cliente.ativo ? 'Ativo' : 'Inativo'}
                      </button>

                      <button 
                        onClick={() => abrirEditarCliente(cliente)}
                        className="w-10 h-10 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-all active:scale-95 shrink-0"
                        title="Editar Cliente"
                      >
                        <FiEdit2 size={14} />
                      </button>

                      <button 
                        onClick={() => handleExcluirCliente(cliente.id)}
                        className="w-10 h-10 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-550/20 transition-all active:scale-95 shrink-0"
                        title="Excluir Cliente"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>

                  </motion.div>
                ))}
              </div>
            )
          )}
        </div>

        {/* --- MODAL: NOVO/EDITAR CLIENTE --- */}
        <AnimatePresence>
          {modalClienteOpen && (
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`rounded-[2rem] p-8 w-full max-w-lg shadow-2xl border relative overflow-hidden ${t.surface} ${t.border}`}
              >
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className={`text-2xl font-bold tracking-tight ${t.text}`}>
                      {editingClienteId ? 'Editar Cliente' : 'Cadastrar Cliente'}
                    </h2>
                    <p className={`text-xs font-semibold ${t.textSecondary} mt-1`}>Insira as especificações do cliente.</p>
                  </div>
                  <button 
                    onClick={() => setModalClienteOpen(false)} 
                    className={`w-9 h-9 flex items-center justify-center rounded-xl border hover:opacity-85 ${t.inputBg} ${t.border} ${t.text}`}
                  >
                    <FiX size={16} />
                  </button>
                </div>
                
                <form onSubmit={handleSalvarCliente} className="space-y-6">
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.textSecondary} mb-2`}>Nome do Cliente *</label>
                    <input 
                      type="text" placeholder="Ex: Pizzaria Italiana" required
                      className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-semibold ${t.inputBg} ${t.border} ${t.text}`}
                      value={novoCliente.nome}
                      onChange={e => setNovoCliente({...novoCliente, nome: e.target.value})} 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.textSecondary} mb-2`}>Mensalidade *</label>
                      <div className="relative">
                        <span className={`absolute left-4 top-[14px] text-sm font-bold ${t.textMuted}`}>R$</span>
                        <input 
                          type="number" step="0.01" placeholder="0.00" required
                          className={`w-full border pl-10 pr-4 py-3 rounded-2xl outline-none transition-all font-bold text-base tabular-nums ${t.inputBg} ${t.border} ${t.text}`}
                          value={novoCliente.mensalidade}
                          onChange={e => setNovoCliente({...novoCliente, mensalidade: e.target.value})} 
                        />
                      </div>
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.textSecondary} mb-2`}>Dia Vencimento *</label>
                      <input 
                        type="number" min="1" max="31" placeholder="10" required
                        className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-semibold ${t.inputBg} ${t.border} ${t.text}`}
                        value={novoCliente.diaVencimento}
                        onChange={e => setNovoCliente({...novoCliente, diaVencimento: e.target.value})} 
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.textSecondary} mb-2`}>Telefone WhatsApp (Apenas Números com DDD)</label>
                    <input 
                      type="text" placeholder="Ex: 11999999999"
                      className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-semibold ${t.inputBg} ${t.border} ${t.text}`}
                      value={novoCliente.telefone}
                      onChange={e => setNovoCliente({...novoCliente, telefone: e.target.value})} 
                    />
                  </div>

                   <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.textSecondary} mb-2`}>Descrição do Projeto</label>
                    <input 
                      type="text" placeholder="Ex: Prestação de serviços ou sistemas"
                      className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-semibold ${t.inputBg} ${t.border} ${t.text}`}
                      value={novoCliente.descricao}
                      onChange={e => setNovoCliente({...novoCliente, descricao: e.target.value})} 
                    />
                  </div>

                  <div className="flex gap-3 mt-8 pt-4 border-t border-slate-200">
                    <button 
                      type="button" 
                      onClick={() => setModalClienteOpen(false)} 
                      className={`flex-[0.5] py-3.5 rounded-xl font-bold text-xs ${t.inputBg} ${t.border} ${t.textSecondary} hover:${t.text} transition-colors`}
                    >
                      Voltar
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 py-3.5 bg-black hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <FiCheckCircle size={14} /> {editingClienteId ? 'Confirmar Edição' : 'Cadastrar Cliente'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* --- MODAL: LANÇAR FATURA ÚNICA --- */}
        <AnimatePresence>
          {modalFaturaOpen && (
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`rounded-[2rem] p-8 w-full max-w-lg shadow-2xl border relative overflow-hidden ${t.surface} ${t.border}`}
              >
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className={`text-2xl font-bold tracking-tight ${t.text}`}>Lançar Cobrança Avulsa</h2>
                    <p className={`text-xs font-semibold ${t.textSecondary} mt-1`}>Selecione o cliente e defina os parâmetros do débito.</p>
                  </div>
                  <button 
                    onClick={() => setModalFaturaOpen(false)} 
                    className={`w-9 h-9 flex items-center justify-center rounded-xl border hover:opacity-85 ${t.inputBg} ${t.border} ${t.text}`}
                  >
                    <FiX size={16} />
                  </button>
                </div>
                
                <form onSubmit={handleCriarFatura} className="space-y-6">
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.textSecondary} mb-2`}>Cliente *</label>
                    <select 
                      className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-semibold cursor-pointer appearance-none ${t.inputBg} ${t.border} ${t.text}`}
                      value={novaFatura.clienteId}
                      onChange={e => {
                        const cid = e.target.value;
                        const client = clientes.find(c => c.id === cid);
                        setNovaFatura({
                          ...novaFatura,
                          clienteId: cid,
                          valor: client ? client.mensalidade : '',
                          descricao: client ? `Mensalidade - ${client.nome}` : 'Mensalidade'
                        });
                      }}
                      required
                    >
                      <option value="" className="bg-white text-slate-900">Selecione o cliente...</option>
                      {clientes.map(c => (
                        <option key={c.id} value={c.id} className="bg-white text-slate-900">
                          {c.nome} (R$ {fmt(c.mensalidade)})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.textSecondary} mb-2`}>Valor Cobrança *</label>
                      <div className="relative">
                        <span className={`absolute left-4 top-[14px] text-sm font-bold ${t.textMuted}`}>R$</span>
                        <input 
                          type="number" step="0.01" placeholder="0.00" required
                          className={`w-full border pl-10 pr-4 py-3 rounded-2xl outline-none transition-all font-bold text-base tabular-nums ${t.inputBg} ${t.border} ${t.text}`}
                          value={novaFatura.valor}
                          onChange={e => setNovaFatura({...novaFatura, valor: e.target.value})} 
                        />
                      </div>
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.textSecondary} mb-2`}>Data Vencimento *</label>
                      <input 
                        type="date" required
                        className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-semibold ${t.inputBg} ${t.border} ${t.text}`}
                        value={novaFatura.vencimento}
                        onChange={e => setNovaFatura({...novaFatura, vencimento: e.target.value})} 
                      />
                    </div>
                  </div>
  
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.textSecondary} mb-2`}>Descrição da Fatura</label>
                    <input 
                      type="text" placeholder="Ex: Mensalidade - Setup e Instalação"
                      className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-semibold ${t.inputBg} ${t.border} ${t.text}`}
                      value={novaFatura.descricao}
                      onChange={e => setNovaFatura({...novaFatura, descricao: e.target.value})} 
                    />
                  </div>
  
                  <div className="flex gap-3 mt-8 pt-4 border-t border-slate-200">
                    <button 
                      type="button" 
                      onClick={() => setModalFaturaOpen(false)} 
                      className={`flex-[0.5] py-3.5 rounded-xl font-bold text-xs ${t.inputBg} ${t.border} ${t.textSecondary} hover:${t.text} transition-colors`}
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 py-3.5 bg-black hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <FiCheckCircle size={14} /> Gerar Débito
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* --- MODAL: GENERATE MONTHLY BATCH --- */}
        <AnimatePresence>
          {modalMassaOpen && (
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[100] px-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`rounded-[2rem] p-8 w-full max-w-lg shadow-2xl border relative overflow-hidden ${t.surface} ${t.border}`}
              >
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className={`text-2xl font-bold tracking-tight ${t.text}`}>Geração Automática (Mês)</h2>
                    <p className={`text-xs font-semibold ${t.textSecondary} mt-1`}>Crie as faturas do mês corrente para todos os clientes ativos de uma vez só.</p>
                  </div>
                  <button 
                    onClick={() => setModalMassaOpen(false)} 
                    className={`w-9 h-9 flex items-center justify-center rounded-xl border hover:opacity-85 ${t.inputBg} ${t.border} ${t.text}`}
                  >
                    <FiX size={16} />
                  </button>
                </div>

                <div className="border border-amber-200 bg-amber-50 rounded-2xl p-4 mb-6 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-white text-amber-700 shadow-sm">
                    <FiAlertCircle size={16} />
                  </div>
                  <div>
                    <p className="font-bold text-sm mb-0.5 text-amber-800">Segurança Antiduplicidade</p>
                    <p className="text-[11px] font-semibold text-slate-600">
                      O sistema analisa de forma inteligente se o cliente já possui uma cobrança gerada para o mês escolhido, impedindo faturamentos repetidos!
                    </p>
                  </div>
                </div>
                
                <form onSubmit={handleCobrancasEmMassa} className="space-y-6">
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.textSecondary} mb-2`}>Mês de Referência *</label>
                    <input 
                      type="month" required
                      className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-semibold ${t.inputBg} ${t.border} ${t.text}`}
                      value={massaConfig.mesReferencia}
                      onChange={e => setMassaConfig({...massaConfig, mesReferencia: e.target.value})} 
                    />
                  </div>

                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider ${t.textSecondary} mb-2`}>Descrição Opcional do Lote</label>
                    <input 
                      type="text" placeholder="Ex: Mensalidade - Setor Operações"
                      className={`w-full border px-4 py-3 rounded-2xl outline-none transition-all text-xs font-semibold ${t.inputBg} ${t.border} ${t.text}`}
                      value={massaConfig.descricao}
                      onChange={e => setMassaConfig({...massaConfig, descricao: e.target.value})} 
                    />
                  </div>

                  <div className="flex gap-3 mt-8 pt-4 border-t border-slate-200">
                    <button 
                      type="button" 
                      onClick={() => setModalMassaOpen(false)} 
                      className={`flex-[0.5] py-3.5 rounded-xl font-bold text-xs ${t.inputBg} ${t.border} ${t.textSecondary} hover:${t.text} transition-colors`}
                    >
                      Abortar
                    </button>
                    <button 
                      type="submit" disabled={loadingMassa}
                      className="flex-1 py-3.5 bg-black hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {loadingMassa ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div> : <FiLayers size={14} />}
                      {loadingMassa ? 'Processando Lote...' : 'Gerar Faturamento'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
        .tabular-nums { font-variant-numeric: tabular-nums; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

export default ContasReceberChatbot;
