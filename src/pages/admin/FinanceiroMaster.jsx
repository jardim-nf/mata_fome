import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { differenceInDays } from 'date-fns';
import { useFinanceiroMasterData } from '../../hooks/useFinanceiroMasterData';
import { 
  FaCheck, FaTimes, FaPlus, FaUndo, FaArrowLeft, FaMoneyBillWave, 
  FaExclamationCircle, FaCheckCircle, FaCalendarAlt, FaWallet,
  FaHandHoldingUsd, FaFileInvoiceDollar, FaSearch, FaSignOutAlt,
  FaBolt, FaExclamationTriangle, FaPercentage, FaStore,
  FaWhatsapp, FaLayerGroup
} from 'react-icons/fa';
import { IoSearchOutline, IoLogOutOutline } from 'react-icons/io5';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Skeleton Loader (Bento Mosaico) ───
const SkeletonRow = () => (
  <div className="p-5 flex flex-col md:flex-row md:items-center gap-4 animate-pulse border-b border-[#E5E5EA]">
    <div className="w-12 h-12 bg-slate-100 rounded-2xl"></div>
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-slate-100 rounded-lg w-40"></div>
      <div className="h-3 bg-slate-50 rounded-lg w-24"></div>
    </div>
    <div className="h-4 bg-slate-100 rounded-lg w-20"></div>
    <div className="h-6 bg-slate-100 rounded-lg w-24 md:w-32"></div>
    <div className="h-8 bg-slate-100 rounded-full w-20"></div>
  </div>
);

function FinanceiroMaster() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  // Hook logic is strictly maintained to touch NO DATA RULES
  const {
    faturasFiltradas, estabs, loading, 
    filtroStatus, setFiltroStatus,
    searchQuery, setSearchQuery,
    modalOpen, setModalOpen,
    novaFatura, setNovaFatura,
    modalMassa, setModalMassa,
    massaConfig, setMassaConfig,
    loadingMassa,
    resumo,
    handleCriarFatura, handleBaixa, handleCobrancaEmMassa, handleLembreteWhatsApp,
    formatData, getVencimentoStatus, parseDate
  } = useFinanceiroMasterData();

  const getStatusBadge = (fatura) => {
    const status = getVencimentoStatus(fatura);
    const styles = {
      pago: 'bg-[#F2FCDA] text-[#1D7446] border-[#D0F2A8]',
      atrasado: 'bg-[#FFE6E6] text-[#D0021B] border-[#FFB3B3]',
      vencendo: 'bg-[#FFF2E6] text-[#FF8C00] border-[#FFD9B3]',
      pendente: 'bg-[#F5F5F7] text-[#86868B] border-[#E5E5EA]',
    };
    const icons = {
      pago: <FaCheckCircle />, atrasado: <FaExclamationCircle />,
      vencendo: <FaExclamationTriangle />, pendente: <FaCalendarAlt />,
    };
    const labels = { pago: 'PAGO', atrasado: 'ATRASADO', vencendo: 'VENCE LOGO', pendente: 'PENDENTE' };

    return (
      <span className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-full uppercase tracking-widest border ${styles[status]} ${status === 'atrasado' ? 'animate-pulse' : ''}`}>
        {icons[status]} {labels[status]}
      </span>
    );
  };

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Admin';

  if (authLoading) return (
    <div className="flex h-screen items-center justify-center bg-[#F5F5F7]">
      <FaBolt className="text-[#86868B] text-4xl animate-pulse" />
    </div>
  );

  return (
    <div className="bg-[#F5F5F7] min-h-screen font-sans text-[#1D1D1F] pb-24 pt-4 px-4 sm:px-8">
      
      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className="max-w-[1400px] mx-auto bg-white/70 backdrop-blur-xl border border-white/50 shadow-sm rounded-full h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/master-dashboard')} className="w-9 h-9 bg-[#F5F5F7] hover:bg-[#E5E5EA] rounded-full flex items-center justify-center transition-colors">
            <FaArrowLeft className="text-[#86868B] text-sm" />
          </button>
          <div className="hidden sm:block border-l border-[#E5E5EA] pl-4">
            <h1 className="font-semibold text-sm tracking-tight text-black">Módulo Financeiro</h1>
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
        
        {/* ─── HEADER ─── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 px-2">
          <div>
            <h1 className="text-4xl font-bold text-[#1D1D1F] tracking-tight">Recebíveis</h1>
            <p className="text-[#86868B] text-sm mt-1 font-medium">Gestão de mensalidades e faturamento da rede.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setModalOpen(true)} 
              className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-full hover:scale-105 shadow-md font-bold text-sm transition-all active:scale-95">
              <FaPlus /> Nova Cobrança
            </button>
            <button onClick={() => setModalMassa(true)}
              className="flex items-center gap-2 bg-white border border-[#E5E5EA] text-[#1D1D1F] px-6 py-3 rounded-full hover:bg-[#F5F5F7] shadow-sm font-bold text-sm transition-all active:scale-95">
              <FaLayerGroup /> Em Massa
            </button>
          </div>
        </div>

        {/* ─── QUICK STATS BAR ─── */}
        <div className="flex flex-wrap items-center gap-3 mb-6 px-2">
          <span className="bg-white rounded-full px-4 py-2 border border-[#E5E5EA] shadow-sm text-xs font-bold text-[#1D1D1F] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span> {resumo.totalFaturas} lançamentos processados
          </span>
          {resumo.vencendoHoje > 0 && (
            <span className="bg-[#FFF2E6] text-[#FF8C00] rounded-full px-4 py-2 border border-[#FFD9B3] text-xs font-bold flex items-center gap-2 animate-pulse">
              ⏰ {resumo.vencendoHoje} faturas vencendo hoje
            </span>
          )}
        </div>

        {/* ─── STAT CARDS (BENTO) ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          
          {/* Caixa Recebido (Success Tile) */}
          <div className="bg-white rounded-[2rem] border border-[#E5E5EA] p-8 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-6">
               <div className="w-14 h-14 bg-[#F2FCDA] rounded-full flex items-center justify-center text-[#1D7446]"><FaHandHoldingUsd size={24} /></div>
               <p className="text-[#1D7446] bg-[#F2FCDA]/50 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">{resumo.pagosCount} pagam.</p>
            </div>
            <div>
               <p className="text-sm font-semibold text-[#86868B] uppercase tracking-widest mb-1">Caixa Recebido</p>
               <p className="text-4xl font-bold tracking-tight text-[#1D1D1F]">R$ {fmt(resumo.pago)}</p>
            </div>
          </div>

          {/* A Receber (Pending Tile) */}
          <div className="bg-white rounded-[2rem] border border-[#E5E5EA] p-8 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-6">
               <div className="w-14 h-14 bg-[#F5F5F7] rounded-full flex items-center justify-center text-[#86868B]"><FaFileInvoiceDollar size={24} /></div>
               <p className="text-[#86868B] bg-[#F5F5F7] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">{resumo.pendentesCount} em aberto</p>
            </div>
            <div>
               <p className="text-sm font-semibold text-[#86868B] uppercase tracking-widest mb-1">A Receber</p>
               <p className="text-4xl font-bold tracking-tight text-[#1D1D1F]">R$ {fmt(resumo.pendente)}</p>
            </div>
          </div>

          {/* Atrasados (Danger Tile) */}
          <div className={`rounded-[2rem] p-8 shadow-md flex flex-col justify-between relative overflow-hidden group border ${resumo.atrasados > 0 ? 'bg-[#FFE6E6] border-[#FFB3B3]' : 'bg-white border-[#E5E5EA]'}`}>
            {resumo.atrasados > 0 && <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl group-hover:bg-red-500/20 transition-all duration-1000"></div>}
            <div className="relative z-10 flex justify-between items-start mb-6">
               <div className={`w-14 h-14 rounded-full flex items-center justify-center ${resumo.atrasados > 0 ? 'bg-red-500 text-white' : 'bg-[#F5F5F7] text-[#E5E5EA]'}`}><FaExclamationCircle size={24} /></div>
               <p className={`${resumo.atrasados > 0 ? 'text-[#D0021B]' : 'text-[#86868B]'} ${resumo.atrasados > 0 ? 'bg-red-100' : 'bg-[#F5F5F7]'} px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest`}>
                 {resumo.atrasados > 0 ? `${resumo.atrasados} ocorrências` : 'Limpo 🎉'}
               </p>
            </div>
            <div className="relative z-10">
               <p className={`text-sm font-semibold ${resumo.atrasados > 0 ? 'text-[#D0021B]' : 'text-[#86868B]'} uppercase tracking-widest mb-1`}>Em Atraso</p>
               <p className={`text-4xl font-bold tracking-tight ${resumo.atrasados > 0 ? 'text-[#D0021B]' : 'text-[#86868B]'}`}>R$ {fmt(resumo.valorAtrasado)}</p>
            </div>
          </div>

          {/* Total Overview (Dark Tile) */}
          <div className="bg-[#1D1D1F] rounded-[2rem] border border-[#1D1D1F] p-8 shadow-md flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute -left-10 -bottom-10 w-24 h-24 bg-yellow-500/20 rounded-full blur-2xl group-hover:bg-yellow-500/40 transition-colors duration-1000"></div>
            <div className="relative z-10 flex justify-between items-start mb-6">
               <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center text-white"><FaWallet size={24} /></div>
            </div>
            <div className="relative z-10">
               <p className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-1">Total Movimentado</p>
               <p className="text-4xl font-bold tracking-tight text-white mb-2">R$ {fmt(resumo.total)}</p>
               <div className="w-full bg-white/10 rounded-full h-1 overflow-hidden">
                 <div className="bg-emerald-500 h-1" style={{width: `${resumo.total > 0 ? (resumo.pago / resumo.total * 100) : 0}%`}}></div>
               </div>
            </div>
          </div>

        </div>

        {/* ─── FILTROS PILL-STYLE ─── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 px-2">
          {/* Status Filters */}
          <div className="flex overflow-x-auto hide-scrollbar gap-2 w-full sm:w-auto">
            {[
              { id: 'todos', label: 'Histórico Completo', count: resumo.totalFaturas },
              { id: 'pendente', label: 'Pendentes', count: resumo.pendentesCount },
              { id: 'atrasado', label: 'Atrasados', count: resumo.atrasados },
              { id: 'pago', label: 'Caixa Efetuado', count: resumo.pagosCount },
            ].map(s => (
              <button key={s.id} onClick={() => setFiltroStatus(s.id)}
                className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap 
                  ${filtroStatus === s.id ? 'bg-black text-white shadow-md' : 'bg-white border border-[#E5E5EA] text-[#86868B] hover:text-black hover:border-gray-300'}`}>
                {s.label}
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${filtroStatus === s.id ? 'bg-white text-black' : 'bg-[#F5F5F7] text-[#86868B]'}`}>{s.count}</span>
              </button>
            ))}
          </div>

          {/* Search Pill */}
          <div className="relative w-full sm:w-64 bg-white border border-[#E5E5EA] rounded-full px-4 py-3 flex items-center shadow-sm">
            <IoSearchOutline className="text-[#86868B]" size={16} />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-xs ml-2 w-full font-medium placeholder-[#86868B]"
              placeholder="Buscar por loja..." />
          </div>
        </div>

        {/* ─── LIST VIEW (Minimalist Table Bento Format) ─── */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-[#E5E5EA] overflow-hidden">
          {loading ? (
            <div className="divide-y divide-[#E5E5EA]">
               {[1,2,3,4,5].map(i => <SkeletonRow key={i} />)}
            </div>
          ) : faturasFiltradas.length === 0 ? (
            <div className="p-20 text-center">
              <div className="w-16 h-16 bg-[#F5F5F7] rounded-3xl mx-auto flex items-center justify-center mb-6">
                <FaSearch className="text-2xl text-[#86868B]" />
              </div>
              <h3 className="text-xl font-bold text-[#1D1D1F] mb-2">Sem fatos contábeis</h3>
              <p className="text-sm font-medium text-[#86868B]">Sua busca não encontrou nenhuma fatura registrada.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#E5E5EA]">
               {faturasFiltradas.map(fatura => (
                 <div key={fatura.id} className="p-6 md:p-8 flex flex-col lg:flex-row lg:items-center gap-6 hover:bg-[#F5F5F7]/50 transition-colors group">
                    
                    {/* Block: Identity */}
                    <div className="flex items-center gap-4 flex-[2] min-w-[200px]">
                      <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] flex items-center justify-center text-[#86868B] shrink-0">
                        <FaStore className="text-lg" />
                      </div>
                      <div>
                        <p className="font-bold text-base text-[#1D1D1F] line-clamp-1">{fatura.estabelecimentoNome}</p>
                        <p className="text-xs font-semibold text-[#86868B] mt-0.5">{fatura.descricao}</p>
                      </div>
                    </div>

                    {/* Block: Date and Amount */}
                    <div className="flex flex-row justify-between lg:flex-col lg:justify-center flex-1 gap-1">
                       <p className="text-sm font-semibold text-[#86868B]">{formatData(fatura.vencimento)}</p>
                       <p className="font-bold text-xl tabular-nums text-[#1D1D1F]">R$ {fmt(fatura.valor)}</p>
                    </div>

                    {/* Block: Status Badge */}
                    <div className="flex-[1.5] w-full lg:w-auto">
                       {getStatusBadge(fatura)}
                       {getVencimentoStatus(fatura) === 'atrasado' && (
                          <div className="text-[11px] font-bold text-[#D0021B] mt-2 ml-2">
                             (+{differenceInDays(new Date(), parseDate(fatura.vencimento))} dias)
                          </div>
                       )}
                    </div>

                    {/* Block: Actions */}
                    <div className="flex flex-row items-center gap-2 justify-end flex-1 mt-4 lg:mt-0 pt-4 lg:pt-0 border-t border-[#E5E5EA] lg:border-0">
                      {getVencimentoStatus(fatura) === 'atrasado' && (
                         <button onClick={() => handleLembreteWhatsApp(fatura)}
                          className="w-12 h-12 bg-white border border-[#E5E5EA] rounded-full flex items-center justify-center text-[#1D7446] hover:bg-[#F2FCDA] hover:border-[#F2FCDA] transition-all shadow-sm active:scale-95"
                          title="Lembrete (WhatsApp)">
                          <FaWhatsapp size={18} />
                         </button>
                      )}
                      
                      {fatura.status === 'pago' ? (
                          <button onClick={() => handleBaixa(fatura)}
                            className="bg-white border border-[#E5E5EA] px-6 py-3 rounded-full text-xs font-bold text-[#D0021B] hover:bg-[#FFE6E6] hover:border-[#FFE6E6] transition-all shadow-sm active:scale-95 flex items-center gap-2">
                            <FaUndo /> Estornar Dinheiro
                          </button>
                      ) : (
                          <button onClick={() => handleBaixa(fatura)}
                            className="bg-black border border-black px-6 py-3 rounded-full text-xs font-bold text-white hover:bg-gray-800 transition-all shadow-sm active:scale-95 flex items-center gap-2">
                            <FaCheck /> Confirmar Baixa
                          </button>
                      )}
                    </div>

                 </div>
               ))}
            </div>
          )}
        </div>

        {/* ─── MODAL: NOVA COBRANÇA (BENTO) ─── */}
        {modalOpen && (
          <div className="fixed inset-0 bg-[#1D1D1F]/40 backdrop-blur-sm flex items-center justify-center z-[100] px-4" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
            <div className="bg-white rounded-[2rem] p-8 w-full max-w-lg shadow-2xl border border-white">
              
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">Cobrador Automático</h2>
                  <p className="text-xs font-semibold text-[#86868B] mt-1">Insira a quantia e defina a data-base para recebimento.</p>
                </div>
                <button onClick={() => setModalOpen(false)} className="w-10 h-10 bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E5E5EA] rounded-full transition-colors flex items-center justify-center"><FaTimes /></button>
              </div>
              
              <form onSubmit={handleCriarFatura} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#86868B] mb-2">Selecione o Recebedor</label>
                  <select className="w-full bg-[#F5F5F7] border border-[#E5E5EA] px-5 py-4 rounded-3xl outline-none focus:border-black focus:bg-white transition-all text-sm font-semibold text-[#1D1D1F] appearance-none"
                    value={novaFatura.estabelecimentoId}
                    onChange={e => setNovaFatura({...novaFatura, estabelecimentoId: e.target.value})}>
                    <option value="">Buscar loja no diretório...</option>
                    {estabs.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#86868B] mb-2">Valor Base</label>
                    <div className="relative">
                      <span className="absolute left-5 top-[18px] text-[#86868B] text-sm font-bold">R$</span>
                      <input type="number" step="0.01" placeholder="0.00"
                        className="w-full bg-[#F5F5F7] border border-[#E5E5EA] pl-12 pr-5 py-4 rounded-3xl outline-none focus:border-black focus:bg-white transition-all font-bold text-[#1D1D1F] text-lg tabular-nums" 
                        value={novaFatura.valor}
                        onChange={e => setNovaFatura({...novaFatura, valor: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#86868B] mb-2">Compensação</label>
                    <input type="date" 
                      className="w-full bg-[#F5F5F7] border border-[#E5E5EA] px-5 py-4 rounded-3xl outline-none focus:border-black focus:bg-white transition-all text-sm font-semibold text-[#1D1D1F]" 
                      value={novaFatura.vencimento}
                      onChange={e => setNovaFatura({...novaFatura, vencimento: e.target.value})} />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#86868B] mb-2">Identificador de Transação</label>
                  <input type="text" placeholder="Ex: Mensalidade - Cloud Setembro"
                    className="w-full bg-[#F5F5F7] border border-[#E5E5EA] px-5 py-4 rounded-3xl outline-none focus:border-black focus:bg-white transition-all text-sm font-semibold text-[#1D1D1F]" 
                    value={novaFatura.descricao}
                    onChange={e => setNovaFatura({...novaFatura, descricao: e.target.value})} />
                </div>

                <div className="flex gap-4 mt-8 pt-6 border-t border-[#E5E5EA]">
                  <button type="button" onClick={() => setModalOpen(false)} className="flex-[0.5] py-4 bg-white border border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-full font-bold text-sm transition-colors">
                    Descartar
                  </button>
                  <button type="submit" className="flex-1 py-4 bg-black text-white rounded-full font-bold text-sm shadow-md hover:bg-gray-800 transition-all active:scale-95 flex items-center justify-center gap-2">
                    <FaCheckCircle /> Imprimir Recebível
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL: COBRANÇAS EM MASSA (BENTO) ─── */}
        {modalMassa && (
          <div className="fixed inset-0 bg-[#1D1D1F]/40 backdrop-blur-sm flex items-center justify-center z-[100] px-4" onClick={(e) => e.target === e.currentTarget && setModalMassa(false)}>
            <div className="bg-white rounded-[2rem] p-8 w-full max-w-lg shadow-2xl border border-white">
              
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-[#1D1D1F] flex items-center gap-2">
                    Faturamento em Lote
                  </h2>
                  <p className="text-xs font-semibold text-[#86868B] mt-1">Dispare a mensalidade base para todas as operações.</p>
                </div>
                <button onClick={() => setModalMassa(false)} className="w-10 h-10 bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E5E5EA] rounded-full transition-colors flex items-center justify-center"><FaTimes /></button>
              </div>

              <div className="bg-[#FFF2E6] border border-[#FFD9B3] rounded-3xl p-5 mb-8 flex items-start gap-4">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0 text-[#FF8C00]">
                  <FaExclamationTriangle />
                </div>
                <div>
                  <p className="font-bold text-[#1D1D1F] text-sm mb-1">Ação Definitiva e Global</p>
                  <p className="text-xs font-medium text-[#FF8C00]">
                    Iremos emitir boletos/faturas simultâneas para os <span className="font-black text-black">{estabs.length} clientes</span>. Confira o valor cuidadosamente antes do envio.
                  </p>
                </div>
              </div>
              
              <form onSubmit={handleCobrancaEmMassa} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#86868B] mb-2">Ticket Médio Fixo</label>
                    <div className="relative">
                      <span className="absolute left-5 top-[18px] text-[#86868B] text-sm font-bold">R$</span>
                      <input type="number" step="0.01" placeholder="0.00"
                        className="w-full bg-[#F5F5F7] border border-[#E5E5EA] pl-12 pr-5 py-4 rounded-3xl outline-none focus:border-black focus:bg-white transition-all font-bold text-[#1D1D1F] text-lg tabular-nums" 
                        value={massaConfig.valor}
                        onChange={e => setMassaConfig({...massaConfig, valor: e.target.value})} />
                    </div>
                  </div>
                  <div>
                     <label className="block text-[10px] font-bold uppercase tracking-widest text-[#86868B] mb-2">Compen. Global</label>
                    <input type="date" 
                      className="w-full bg-[#F5F5F7] border border-[#E5E5EA] px-5 py-4 rounded-3xl outline-none focus:border-black focus:bg-white transition-all text-sm font-semibold text-[#1D1D1F]" 
                      value={massaConfig.vencimento}
                      onChange={e => setMassaConfig({...massaConfig, vencimento: e.target.value})} />
                  </div>
                </div>

                 <div>
                   <label className="block text-[10px] font-bold uppercase tracking-widest text-[#86868B] mb-2">Identificador (Exibe pra todos)</label>
                  <input type="text" placeholder="Tarifa Única: Setembro"
                    className="w-full bg-[#F5F5F7] border border-[#E5E5EA] px-5 py-4 rounded-3xl outline-none focus:border-black focus:bg-white transition-all text-sm font-semibold text-[#1D1D1F]" 
                    value={massaConfig.descricao}
                    onChange={e => setMassaConfig({...massaConfig, descricao: e.target.value})} />
                </div>

                <div className="flex gap-4 mt-8 pt-6 border-t border-[#E5E5EA]">
                  <button type="button" onClick={() => setModalMassa(false)} className="flex-[0.5] py-4 bg-white border border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-full font-bold text-sm transition-colors">
                    Abortar
                  </button>
                  <button type="submit" disabled={loadingMassa}
                    className="flex-1 py-4 bg-[#1D1D1F] text-white rounded-full font-bold text-sm shadow-md hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50">
                    {loadingMassa ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div> : <FaLayerGroup />}
                    {loadingMassa ? 'Disparando Lotes...' : 'Processar para Rede Inteira'}
                  </button>
                </div>
              </form>
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

export default FinanceiroMaster;