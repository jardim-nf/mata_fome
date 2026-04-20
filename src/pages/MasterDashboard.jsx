import React, { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DateRangeFilter from '../components/DateRangeFilter';
import { useMasterDashboardData } from '../hooks/useMasterDashboardData';

import {
  FaStore, FaUsers, FaClipboardList, FaFileUpload, FaTags, FaShieldAlt, FaImages,
  FaDollarSign, FaSignOutAlt, FaShoppingCart, FaMoneyBillWave, FaSync,
  FaChartLine, FaRocket, FaBolt, FaCrown, FaReact,
  FaAddressBook, FaReceipt, FaTicketAlt, FaCommentDots, FaBuilding, FaWhatsapp
} from 'react-icons/fa';
import {
  IoNotificationsOutline, IoSearchOutline, IoSparklesOutline,
  IoArrowUpOutline, IoArrowDownOutline, IoLogOutOutline
} from 'react-icons/io5';

// ═══════════════════════════════════════════
// IdeaFood Master Dashboard — Bento Grid Apple Style
// ═══════════════════════════════════════════

function MasterDashboard() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  const {
    loadingDashboard,
    searchQuery,
    setSearchQuery,
    financeiro,
    stats,
    estabelecimentosMap,
    alertas,
    datePreset,
    dateRange,
    handleDatePresetChange,
    handleDateRangeChange,
    handleDateClear,
    fetchHistoricalData,
    financeiroFiltrado,
    crescimento,
    ticketMedio,
    contatosEstabelecimentos
  } = useMasterDashboardData(currentUser, isMasterAdmin);

  const [lojaAberta, setLojaAberta] = useState(null);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const userName = currentUser?.displayName || currentUser?.nome || currentUser?.email?.split('@')[0] || 'Admin';
  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // ── Módulos por Categoria ─────────
  const categoriasDeModulos = [
    {
      grupo: 'Operação & Vendas',
      badgeColor: 'bg-indigo-500',
      modulos: [
        { to: '/master/estabelecimentos', title: 'Lojas', icon: <FaStore />, colorStyle: 'text-amber-600 bg-amber-50 border-amber-100 group-hover:bg-amber-500 group-hover:text-white' },
        { to: '/master/clientes', title: 'CRM/Clientes', icon: <FaAddressBook />, colorStyle: 'text-indigo-600 bg-indigo-50 border-indigo-100 group-hover:bg-indigo-500 group-hover:text-white' },
        { to: '/master/pedidos', title: 'Pedidos', icon: <FaClipboardList />, colorStyle: 'text-rose-600 bg-rose-50 border-rose-100 group-hover:bg-rose-500 group-hover:text-white' },
      ]
    },
    {
      grupo: 'Financeiro & Fiscal',
      badgeColor: 'bg-emerald-500',
      modulos: [
        { to: '/master/financeiro', title: 'Placar Financeiro', icon: <FaMoneyBillWave />, colorStyle: 'text-emerald-600 bg-emerald-50 border-emerald-100 group-hover:bg-emerald-500 group-hover:text-white' },
        { to: '/master/analytics', title: 'Painel Analytics', icon: <FaChartLine />, colorStyle: 'text-cyan-600 bg-cyan-50 border-cyan-100 group-hover:bg-cyan-500 group-hover:text-white' },
        { to: '/master/nfce', title: 'Emissão Fiscal', icon: <FaReceipt />, colorStyle: 'text-slate-600 bg-slate-100 border-slate-200 group-hover:bg-slate-700 group-hover:text-white' },
        { to: '/master/departamentos-fiscais', title: 'Docs Fiscais', icon: <FaBuilding />, colorStyle: 'text-sky-600 bg-sky-50 border-sky-100 group-hover:bg-sky-500 group-hover:text-white' },
      ]
    },
    {
      grupo: 'Growth & Marketing',
      badgeColor: 'bg-pink-500',
      modulos: [
        { to: '/master/plans', title: 'Gerir Planos', icon: <FaTags />, colorStyle: 'text-fuchsia-600 bg-fuchsia-50 border-fuchsia-100 group-hover:bg-fuchsia-500 group-hover:text-white' },
        { to: '/master/cupons-rede', title: 'Cupons da Rede', icon: <FaTicketAlt />, colorStyle: 'text-pink-600 bg-pink-50 border-pink-100 group-hover:bg-pink-500 group-hover:text-white' },
        { to: '/master/mensagens', title: 'Push / Alertas', icon: <FaCommentDots />, colorStyle: 'text-violet-600 bg-violet-50 border-violet-100 group-hover:bg-violet-500 group-hover:text-white' },
        { to: '/divulgacao', title: 'Mídia Kit Base', icon: <FaRocket />, colorStyle: 'text-orange-600 bg-orange-50 border-orange-100 group-hover:bg-orange-500 group-hover:text-white' },
      ]
    },
    {
      grupo: 'Segurança & Infra',
      badgeColor: 'bg-zinc-800',
      modulos: [
        { to: '/master/usuarios', title: 'Usuários Ativos', icon: <FaUsers />, colorStyle: 'text-blue-600 bg-blue-50 border-blue-100 group-hover:bg-blue-500 group-hover:text-white' },
        { to: '/admin/auditoria-mesas', title: 'Auditoria Mesas', icon: <FaShieldAlt />, colorStyle: 'text-indigo-600 bg-indigo-50 border-indigo-100 group-hover:bg-indigo-500 group-hover:text-white' },
        { to: '/master/importar-cardapio', title: 'ImportCardápio', icon: <FaFileUpload />, colorStyle: 'text-teal-600 bg-teal-50 border-teal-100 group-hover:bg-teal-500 group-hover:text-white' },
        { to: '/master/migrador-universal', title: 'Migrador Dados', icon: <FaSync />, colorStyle: 'text-lime-600 bg-lime-50 border-lime-100 group-hover:bg-lime-500 group-hover:text-white' },
        { to: '/master/associar-imagens', title: 'Banco Imagens', icon: <FaImages />, colorStyle: 'text-yellow-600 bg-yellow-50 border-yellow-100 group-hover:bg-yellow-500 group-hover:text-white' },
        { to: '/admin/audit-logs', title: 'Segurança Logs', icon: <FaShieldAlt />, colorStyle: 'text-red-600 bg-red-50 border-red-100 group-hover:bg-red-500 group-hover:text-white' },
      ]
    }
  ];

  const categoriasExibidas = useMemo(() => {
    if (!searchQuery) return categoriasDeModulos;
    const lowerQuery = searchQuery.toLowerCase();
    
    return categoriasDeModulos.map(cat => ({
      ...cat,
      modulos: cat.modulos.filter(m => m.title.toLowerCase().includes(lowerQuery))
    })).filter(cat => cat.modulos.length > 0);
  }, [searchQuery]);

  // ── Loading ──────────────────────
  if (authLoading) return (
    <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
         <div className="w-[400px] h-[400px] bg-slate-300 rounded-full blur-[100px] animate-pulse"></div>
      </div>
      <div className="text-center relative z-10">
        <FaBolt className="text-slate-400 text-5xl mx-auto mb-6 animate-pulse" />
        <p className="text-sm font-semibold tracking-widest text-slate-400 uppercase">Inicializando Ambiente</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans text-slate-800 pb-24 pt-6 px-4 sm:px-8 relative overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* ── MESH GRADIENT BLURS (Premium SaaS Feel) ── */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-200/20 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-200/20 rounded-full blur-[140px] pointer-events-none"></div>

      <div className="relative z-10 max-w-[1300px] mx-auto mt-2">
        {/* ── PILL NAVBAR (GLASSMORPHISM) ── */}
        <nav className="w-full bg-white/60 backdrop-blur-2xl border border-white shadow-[0_4px_30px_rgba(0,0,0,0.03)] rounded-2xl md:rounded-full min-h-[72px] flex flex-col md:flex-row md:items-center justify-between px-4 sm:px-6 md:px-8 py-4 md:py-0 mb-8 sticky top-4 md:top-6 z-50 transition-all gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-slate-800 to-slate-900 rounded-full flex items-center justify-center shadow-md cursor-pointer font-bold text-white text-sm hover:scale-105 transition-transform" onClick={() => navigate('/')}>
              {userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-slate-800 line-clamp-1">{saudacao}, <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-blue-500">{userName}</span></h1>
              <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto">
            <div className="flex flex-1 items-center bg-slate-100/50 hover:bg-slate-100 transition-colors border border-slate-200/50 rounded-full px-4 sm:px-5 py-2.5 md:w-64 focus-within:bg-white focus-within:shadow-sm focus-within:border-indigo-200">
              <IoSearchOutline className="text-slate-400 shrink-0" size={18} />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-xs ml-2 sm:ml-3 w-full placeholder-slate-400 font-medium text-slate-700 min-w-[50px]"
                placeholder="Buscar..." />
            </div>

            <div className="w-px h-6 bg-slate-200 mx-1 sm:mx-2 hidden md:block" />

            <button onClick={fetchHistoricalData} className="w-10 h-10 shrink-0 bg-white hover:bg-slate-50 border border-slate-100 shadow-sm rounded-full flex items-center justify-center transition-all hover:-translate-y-0.5" title="Atualizar">
              <FaSync className={`text-indigo-500 ${loadingDashboard ? 'animate-spin' : ''}`} size={14} />
            </button>
            
            <button onClick={async () => { await logout(); navigate('/'); }} className="w-10 h-10 shrink-0 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-full flex items-center justify-center transition-all" title="Sair">
              <IoLogOutOutline className="text-rose-600" size={18} />
            </button>
          </div>
        </nav>

        {/* ALERTS SECTION */}
        {(alertas.certVencidos.length > 0 || alertas.mensalidadeAtrasada.length > 0) && (
          <div className="mb-8 bg-gradient-to-r from-rose-500 to-red-600 rounded-3xl p-5 sm:p-6 text-white shadow-lg shadow-rose-500/20 flex flex-col lg:flex-row lg:items-center gap-4 sm:gap-5 justify-between relative overflow-hidden group">
            <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-8 group-hover:scale-110 transition-transform duration-700">
               <IoNotificationsOutline size={150} />
            </div>
            <div className="flex items-start sm:items-center gap-3 sm:gap-5 relative z-10 w-full lg:w-auto">
              <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 bg-white/20 rounded-xl sm:rounded-2xl flex items-center justify-center backdrop-blur-md shadow-inner border border-white/20">
                <IoNotificationsOutline size={26} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg sm:text-xl tracking-tight leading-tight mb-1">Obrigatório: Há Lojas Pendentes</h3>
                <p className="text-[11px] sm:text-sm text-rose-100 font-medium uppercase tracking-wider leading-snug">Atenção requirida em {alertas.certVencidos.length + alertas.mensalidadeAtrasada.length} estabelecimentos operacionais.</p>
              </div>
            </div>
            <Link to="/master/estabelecimentos" className="relative z-10 bg-white text-rose-600 px-6 sm:px-8 py-3.5 sm:py-3 rounded-xl text-sm font-bold shadow hover:scale-105 hover:shadow-lg transition-all text-center w-full lg:w-auto shrink-0 whitespace-nowrap active:scale-95">
              Resolver Agora
            </Link>
          </div>
        )}

        {/* ─── PRINCIPAL METRICS GRID ─── */}
        <main className="grid grid-cols-12 gap-6">
          
          {/* MAIN FATURAMENTO CARD (CLEAN GLASS) */}
          <div className="col-span-12 lg:col-span-5 bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between hover:shadow-[0_15px_40px_rgb(0,0,0,0.06)] transition-all">
            <div className="flex flex-col sm:flex-row justify-between items-start mb-6 gap-4">
              <p className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">{financeiroFiltrado ? 'Faturamento Isolado' : 'Visão Geral Hoje'}</p>
              <DateRangeFilter
                activePreset={datePreset}
                dateRange={dateRange}
                onPresetChange={handleDatePresetChange}
                onRangeChange={handleDateRangeChange}
                onClear={handleDateClear}
              />
            </div>
            
            <div className="flex flex-col flex-1 justify-center mt-2">
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-[-0.04em] text-slate-800 break-words drop-shadow-sm mb-4">
                {fmt(financeiroFiltrado ? financeiroFiltrado.faturamento : financeiro.faturamentoHoje)}
              </h2>
              <div className="flex flex-wrap gap-2 sm:gap-3 mt-2 sm:mt-4">
                {!financeiroFiltrado && (
                  <div className={`flex items-center gap-1.5 px-3 py-2 sm:px-4 rounded-xl font-bold text-[11px] sm:text-xs shadow-sm ${crescimento >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                    {crescimento >= 0 ? <IoArrowUpOutline size={14} /> : <IoArrowDownOutline size={14} />}
                    {Math.abs(crescimento).toFixed(1)}% vs. Ontem
                  </div>
                )}
                <div className="flex items-center px-3 py-2 sm:px-4 rounded-xl border border-slate-100 bg-slate-50 font-bold text-[11px] sm:text-xs text-slate-600 shadow-sm">
                  Volume Total: {fmt(financeiro.totalHistorico)}
                </div>
              </div>
            </div>
          </div>

          {/* TOP 1 RANKING (PREMIUM DARK CARD) */}
          <div className="col-span-12 lg:col-span-4 bg-slate-900 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xl flex flex-col relative overflow-hidden group hover:shadow-2xl transition-all">
             {/* Subtle Glow inside pure dark card */}
             <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-indigo-500/20 rounded-full blur-[80px] pointer-events-none group-hover:bg-amber-500/10 transition-colors duration-1000"></div>
             
             <div className="flex items-center gap-2 mb-6 sm:mb-8 relative z-10">
               <FaCrown className="text-amber-400" size={16} />
               <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Loja Top #1</p>
             </div>
             
             {(() => {
                const ranking = financeiroFiltrado ? financeiroFiltrado.topLojas : financeiro.topLojas;
                const top1 = ranking && ranking.length > 0 ? ranking[0] : null;
                if (top1) {
                  return (
                    <div className="relative z-10 flex flex-col flex-1">
                      <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-white mb-4 line-clamp-2">{estabelecimentosMap[top1.id] || top1.nomeSalvoNoPedido || 'Desconhecido'}</h2>
                      
                      <div className="mt-auto">
                        <p className="text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 tracking-tight drop-shadow-sm mb-4">{fmt(top1.total)}</p>
                        
                        {/* Mini-Relatório com Badges */}
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                          <button 
                            onClick={() => setLojaAberta(top1)}
                            className="flex items-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 active:scale-95 transition-all border border-indigo-500/20 text-indigo-300 px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-widest backdrop-blur-md cursor-pointer shadow-sm hover:shadow-indigo-500/30"
                          >
                            <FaShoppingCart size={12} />
                            {top1.pedidos} Vendas <span className="ml-1 opacity-70">⤢</span>
                          </button>
                          
                          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-widest backdrop-blur-md">
                            <IoSparklesOutline size={14} />
                            Ticket: {fmt(top1.total / top1.pedidos)}
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                }
                return (
                  <div className="relative z-10 flex-1 flex items-center mt-6 text-slate-500 font-medium">Nenhum pedido hoje ainda.</div>
                );
             })()}
          </div>

          {/* SIDE KPIs */}
          <div className="col-span-12 lg:col-span-3 grid grid-cols-2 lg:grid-cols-1 lg:grid-rows-2 gap-4 sm:gap-6">
            <div className="bg-white/80 backdrop-blur-md border border-white rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col justify-center hover:-translate-y-1 transition-transform group">
               <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><FaShoppingCart /> <span className="truncate">Total Entregas</span></p>
               <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-800 group-hover:text-indigo-600 transition-colors">{financeiroFiltrado ? financeiroFiltrado.qtd : financeiro.qtdHoje}</h2>
               {!financeiroFiltrado && <p className="text-[9px] sm:text-xs font-semibold text-slate-500 mt-2 truncate">Tk Médio: <span className="text-slate-800">{fmt(financeiroFiltrado ? financeiroFiltrado.ticketMedio : ticketMedio)}</span></p>}
            </div>
            
            <div className="bg-slate-800 rounded-3xl p-5 sm:p-6 shadow-md flex flex-col justify-center border border-slate-700 relative overflow-hidden group hover:-translate-y-1 transition-all">
               <div className="absolute w-[1px] h-[100px] bg-gradient-to-b from-transparent via-cyan-400 to-transparent left-0 top-0 opacity-0 group-hover:opacity-100 group-hover:left-full transition-all duration-1000 ease-in-out shadow-[0_0_10px_#22d3ee]"></div>
               <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><IoSparklesOutline /> <span className="truncate">Base Lojas</span></p>
               <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-1"><span className="text-emerald-400">{stats.estabelecimentosAtivos}</span> <span className="text-slate-500 font-semibold text-sm sm:text-lg">/ {stats.totalEstabelecimentos}</span></h2>
               <p className="text-[9px] sm:text-xs font-semibold text-slate-400 mt-1 truncate">{stats.totalUsuarios} conexões unidas.</p>
            </div>
          </div>

          {/* ─── SECUNDARY RANKING & SUCCESS SECTION ─── */}
          
          <div className="col-span-12 lg:col-span-7 mt-4">
            <div className="mb-4 pl-1">
               <h2 className="text-xl font-bold tracking-tight text-slate-800">Ranking Destaque</h2>
               <p className="text-sm font-medium text-slate-500 mt-0.5">Lojistas operando atualmente com mais de 1 pedido.</p>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
              {(() => {
                const ranking = financeiroFiltrado ? financeiroFiltrado.topLojas : financeiro.topLojas;
                const outros = ranking ? ranking.slice(1).filter(l => l.pedidos > 1) : [];
                
                if (outros.length === 0) return <div className="bg-white/60 border border-slate-200 rounded-2xl p-6 w-full text-center text-slate-400 text-sm font-medium shadow-sm">Rankings secundários sendo processados.</div>;

                return outros.map((loja, idx) => (
                  <div key={loja.id} className="min-w-[260px] bg-white border border-slate-100 rounded-3xl p-6 shadow-sm snap-start hover:shadow-md hover:-translate-y-1 transition-all cursor-default">
                    <div className="flex justify-between items-center mb-5">
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl uppercase tracking-widest">RANK #{idx + 2}</span>
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl uppercase">{loja.pedidos} Vendas</span>
                    </div>
                    <h3 className="font-bold text-slate-800 truncate text-base mb-2">{estabelecimentosMap[loja.id] || loja.nomeSalvoNoPedido || 'Desconhecido'}</h3>
                    <p className="text-2xl font-black tracking-tight text-slate-800">{fmt(loja.total)}</p>
                  </div>
                ));
              })()}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-5 mt-4">
               <div className="mb-4 pl-1">
                 <h2 className="text-xl font-bold tracking-tight text-slate-800">Customer Success</h2>
                 <p className="text-sm font-medium text-slate-500 mt-0.5">Engajamento e contato rápido.</p>
               </div>
               
               <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-2 flex flex-col h-[200px]">
                 <div className="overflow-y-auto pr-2 custom-scrollbar p-2 flex flex-col gap-2 h-full">
                   <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }`}</style>
                   {contatosEstabelecimentos.length === 0 ? (
                     <p className="text-sm text-slate-400 text-center mt-10">Nenhum estabelecimento cadastrado.</p>
                   ) : contatosEstabelecimentos.map((estab) => {
                     const hasPhone = estab.telefone && String(estab.telefone).replace(/\D/g, '').length >= 8;
                     const rawPhone = hasPhone ? String(estab.telefone).replace(/\D/g, '') : '';
                     const cleanPhone = rawPhone.length === 11 || rawPhone.length === 10 ? `55${rawPhone}` : rawPhone;
                     const saudaLojasTexto = encodeURIComponent(`Olá equipe do *${estab.nome}*! Aqui é o Matheus Jardim da Matafome.\n\nPassando para agradecer pela parceria e colher feedbacks! Vamos alavancar as vendas essa semana! 🚀`);
                     
                     return (
                       <div key={estab.id} className="flex items-center justify-between p-3.5 border border-slate-50 bg-slate-50/50 rounded-2xl hover:bg-white hover:border-indigo-100 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all group">
                          <div className="truncate pr-4">
                            <p className="font-bold text-sm text-slate-800 truncate">{estab.nome}</p>
                            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{hasPhone ? estab.telefone : 'Contato ausente'}</p>
                          </div>
                          {hasPhone ? (
                            <a 
                              href={`https://wa.me/${cleanPhone}?text=${saudaLojasTexto}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="flex-shrink-0 bg-emerald-500 hover:bg-emerald-600 text-white w-9 h-9 rounded-full flex items-center justify-center shadow-sm transition-all hover:scale-110"
                              title="Engajar via WhatsApp"
                            >
                              <FaWhatsapp size={16} />
                            </a>
                          ) : (
                            <div className="flex-shrink-0 bg-slate-200 text-slate-400 w-9 h-9 rounded-full flex items-center justify-center cursor-not-allowed">
                              <FaWhatsapp size={16} />
                            </div>
                          )}
                       </div>
                     )
                   })}
                 </div>
               </div>
          </div>

          {/* ─── MODULOS (LISTA MODERNA SaaS ao invés de grid de botões) ─── */}
          <div className="col-span-12 mt-12 mb-4 pl-1">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-800">Workspace</h2>
            <p className="text-sm font-medium text-slate-500 mt-1">Sua suíte de ferramentas administrativas.</p>
          </div>

          <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            {categoriasExibidas.map((categoria, index) => (
              <div key={index} className="bg-white/80 backdrop-blur-lg border border-white rounded-3xl p-6 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                <div className="flex items-center gap-3 mb-6">
                  <span className={`w-2.5 h-2.5 rounded-full ${categoria.badgeColor} shadow-sm`}></span>
                  <h3 className="font-bold text-lg text-slate-800 tracking-tight">
                    {categoria.grupo}
                  </h3>
                </div>
                
                <div className="flex flex-col gap-3">
                  {categoria.modulos.map((m, i) => {
                    // Extrair cor do Tailwind safelist do grid antigo ou aplicar estilo clean
                    const isRed = m.colorStyle.includes('red') || m.colorStyle.includes('rose');
                    const hoverBgAccent = isRed ? 'hover:bg-rose-50' : 'hover:bg-indigo-50/50';
                    const iconAccent = isRed ? 'text-rose-500 bg-rose-100/50' : 'text-indigo-500 bg-indigo-50';

                    return (
                      <Link key={i} to={m.to} className={`flex items-center justify-between p-4 rounded-2xl border border-transparent hover:border-slate-100 bg-slate-50/50 ${hoverBgAccent} transition-all group cursor-pointer`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm ${iconAccent}`}>
                            {React.cloneElement(m.icon, { size: 16 })}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-slate-800 tracking-tight group-hover:text-indigo-900 transition-colors">{m.title}</h4>
                            <p className="text-[11px] text-slate-400 font-medium">Acessar painel interno</p>
                          </div>
                        </div>
                        <div className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-indigo-400">
                           →
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            {categoriasExibidas.length === 0 && (
              <div className="col-span-full py-16 bg-white rounded-3xl text-center text-slate-400 font-medium shadow-sm">
                 Nenhum módulo encontrado com '{searchQuery}'.
              </div>
            )}
          </div>

        </main>
      </div>

      {/* ─── MODAL DE DETALHES DAS VENDAS ─── */}
      {lojaAberta && (() => {
        let totaisFormaPagamento = {};
        let picosHora = {};
        
        if (lojaAberta.itens) {
          lojaAberta.itens.forEach(venda => {
            const totalVenda = Number(venda.totalFinal) || Number(venda.total) || Number(venda.valorFinal) || 0;
            
            // Metodos
            let fpList = [];
            if (Array.isArray(venda.pagamentos)) {
              venda.pagamentos.forEach(p => {
                fpList.push({ metodo: p.formaPagamento || p.metodo || 'Diversos', valor: Number(p.valor) || totalVenda });
              });
            } else {
              let forma = venda.formaPagamento || venda.metodoPagamento || venda.metodo_pagamento || venda.forma_pagamento;
              if (!forma && venda.pagamento) forma = venda.pagamento.metodo || venda.pagamento.formaPagamento;
              if (!forma) forma = 'Não informada';
              fpList.push({ metodo: forma, valor: totalVenda });
            }

            fpList.forEach(fp => {
              const nm = String(fp.metodo).toUpperCase().trim();
              if (!totaisFormaPagamento[nm]) totaisFormaPagamento[nm] = 0;
              totaisFormaPagamento[nm] += fp.valor;
            });

            // Hora
            try {
              let extracted = null;
              if (venda.dataPedido && typeof venda.dataPedido.toDate === 'function') extracted = venda.dataPedido.toDate();
              else if (venda.createdAt && typeof venda.createdAt.toDate === 'function') extracted = venda.createdAt.toDate();
              else if (venda.createdAt && venda.createdAt.seconds) extracted = new Date(venda.createdAt.seconds * 1000);
              else if (venda.dataPedido && venda.dataPedido.seconds) extracted = new Date(venda.dataPedido.seconds * 1000);
              
              if (extracted) {
                let hour = extracted.getHours();
                let label = `${hour.toString().padStart(2, '0')}:00 às ${(hour+1).toString().padStart(2, '0')}:00`;
                if (!picosHora[label]) picosHora[label] = { qtd: 0, total: 0 };
                picosHora[label].qtd += 1;
                picosHora[label].total += totalVenda;
              }
            } catch(e){}
          });
        }

        const arrFormas = Object.entries(totaisFormaPagamento).map(([nome, valor]) => ({nome, valor})).sort((a,b)=>b.valor-a.valor);
        const arrHoras = Object.entries(picosHora).map(([hora, stats]) => ({hora, ...stats})).sort((a,b)=>b.qtd-a.qtd);
        const picoPrincipal = arrHoras[0] || null;

        return (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all" onClick={() => setLojaAberta(null)}>
            <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
              
              <div className="bg-slate-50 border-b border-slate-100 p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 tracking-tight">Composição de Vendas</h3>
                    <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">{estabelecimentosMap[lojaAberta.id] || lojaAberta.nomeSalvoNoPedido} • {lojaAberta.pedidos} vendas</p>
                  </div>
                  <button onClick={() => setLojaAberta(null)} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-transform hover:scale-105">
                    ✕
                  </button>
                </div>

                {/* MINI ANALYTICS PANEL */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><FaChartLine /> Horário de Pico</p>
                    {picoPrincipal ? (
                      <div>
                        <p className="text-lg font-black text-indigo-600">{picoPrincipal.hora}</p>
                        <p className="text-xs text-slate-500 font-medium">{picoPrincipal.qtd} vendas ({fmt(picoPrincipal.total)})</p>
                      </div>
                    ) : <p className="text-sm text-slate-400">Nenhum dado de hora.</p>}
                  </div>
                  
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm h-24 overflow-y-auto custom-scrollbar">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><FaMoneyBillWave /> Métodos de Pagamento</p>
                    <div className="space-y-1">
                      {arrFormas.map(f => (
                        <div key={f.nome} className="flex justify-between items-center bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                          <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{f.nome}</span>
                          <span className="text-xs font-black text-emerald-600">{fmt(f.valor)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="overflow-y-auto p-4 sm:p-6 flex-1 bg-slate-50/50 custom-scrollbar">
                <style>{`.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }`}</style>
                {lojaAberta.itens?.length > 0 ? (
                  <div className="space-y-3">
                    {[...lojaAberta.itens].reverse().map((venda, idx) => {
                      const totalVenda = Number(venda.totalFinal) || Number(venda.total) || Number(venda.valorFinal) || 0;
                      let dataVendaStr = 'Data indisp.';
                      try {
                        let extracted = null;
                        if (venda.dataPedido && typeof venda.dataPedido.toDate === 'function') extracted = venda.dataPedido.toDate();
                        else if (venda.createdAt && typeof venda.createdAt.toDate === 'function') extracted = venda.createdAt.toDate();
                        else if (venda.createdAt && venda.createdAt.seconds) extracted = new Date(venda.createdAt.seconds * 1000);
                        else if (venda.dataPedido && venda.dataPedido.seconds) extracted = new Date(venda.dataPedido.seconds * 1000);
                        
                        if(extracted) dataVendaStr = format(extracted, "dd/MM 'às' HH:mm");
                      } catch(e){}
                      
                      return (
                        <div key={venda.id || idx} className="flex items-center justify-between p-4 border border-slate-100 bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">Pedido / Venda #{idx+1}</span>
                            <span className="text-xs text-slate-400 font-medium">{dataVendaStr} • {venda.origem || 'Delivery / Salão'}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-base font-black text-indigo-600 tracking-tight">{fmt(totalVenda)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400 font-medium">Nenhum detalhe encontrado para esta loja.</div>
                )}
              </div>
              <div className="bg-white border-t border-slate-100 p-6 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Arrecadado</span>
                <span className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">{fmt(lojaAberta.total)}</span>
              </div>
            </div>
          </div>
        );
      })()}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
      `}</style>
    </div>
  );
}

export default MasterDashboard;