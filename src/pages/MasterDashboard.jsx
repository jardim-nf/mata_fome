import React, { useMemo } from 'react';
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
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center">
      <div className="text-center">
        <FaBolt className="text-[#86868B] text-4xl mx-auto mb-4 animate-pulse" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F] pb-24 pt-6 px-4 sm:px-8">
      
      {/* ─── PILL NAVBAR (NORMAL) ─── */}
      <nav className="w-full max-w-[1400px] mx-auto bg-white border border-[#E5E5EA] shadow-sm rounded-full h-16 flex items-center justify-between px-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-black rounded-full flex items-center justify-center shadow-md cursor-pointer" onClick={() => navigate('/')}>
            <FaBolt className="text-white text-sm" />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-semibold text-sm tracking-tight text-black">{saudacao}, {userName}</h1>
            <p className="text-[11px] text-[#86868B] font-medium">{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center bg-[#F5F5F7] hover:bg-[#E5E5EA] transition-colors rounded-full px-4 py-2 w-56">
            <IoSearchOutline className="text-[#86868B]" size={16} />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-xs ml-2 w-full placeholder-[#86868B] font-medium"
              placeholder="Encontrar módulos..." />
          </div>

          <div className="w-px h-6 bg-[#E5E5EA] hidden sm:block" />

          {/* Sync Button */}
          <button onClick={fetchHistoricalData} className="w-9 h-9 bg-[#F5F5F7] hover:bg-[#E5E5EA] rounded-full flex items-center justify-center transition-colors">
            <FaSync className={`text-[#86868B] ${loadingDashboard ? 'animate-spin' : ''}`} size={12} />
          </button>
          
          <button onClick={async () => { await logout(); navigate('/'); }} className="w-9 h-9 bg-red-50 hover:bg-red-100 rounded-full flex items-center justify-center transition-colors">
            <IoLogOutOutline className="text-red-500" size={16} />
          </button>
        </div>
      </nav>

      {/* COMPENSADOR PARA NAVBAR FIXA */}
      <div className="h-20"></div>

      {/* ─── ALERTS BENTO (IF APPLICABLE) ─── */}
      <div className="max-w-[1400px] mx-auto mt-6">
        {(alertas.certVencidos.length > 0 || alertas.mensalidadeAtrasada.length > 0) && (
          <div className="bg-red-500 rounded-[2rem] p-6 text-white shadow-md flex items-center gap-5 justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
                <IoNotificationsOutline size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Ação Requerida</h3>
                <p className="text-sm text-red-100 font-medium">Você tem {alertas.certVencidos.length + alertas.mensalidadeAtrasada.length} estabelecimentos com pendências críticas operacionais.</p>
              </div>
            </div>
            <Link to="/master/estabelecimentos" className="bg-white text-red-600 px-6 py-2.5 rounded-full text-sm font-bold shadow-sm hover:scale-105 transition-transform">
              Verificiar Agora
            </Link>
          </div>
        )}
      </div>

      {/* ─── BENTO GRID MOSAIC ─── */}
      <main className="max-w-[1400px] mx-auto mt-6 grid grid-cols-12 auto-rows-[minmax(120px,auto)] gap-4 md:gap-6">
        
        {/* BIG HERO MATRIC - FATURAMENTO */}
        <div className="col-span-12 lg:col-span-5 bg-white border border-[#E5E5EA] rounded-[2rem] p-8 shadow-sm flex flex-col justify-between relative group">
          {/* Oculta apenas o brilho para não deixar o card "vazar" sem cortar dropdowns */}
          <div className="absolute inset-0 rounded-[2rem] overflow-hidden pointer-events-none">
             <div className="absolute -right-20 -top-20 w-48 h-48 bg-emerald-50/50 rounded-full blur-3xl group-hover:bg-amber-50/50 transition-colors duration-1000"></div>
          </div>
          
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div>
              <div className="flex justify-between items-start mb-4">
                <p className="text-xs font-semibold text-[#86868B] uppercase tracking-widest">{financeiroFiltrado ? 'Faturamento Isolado' : 'Faturamento Hoje'}</p>
                <DateRangeFilter
                  activePreset={datePreset}
                  dateRange={dateRange}
                  onPresetChange={handleDatePresetChange}
                  onRangeChange={handleDateRangeChange}
                  onClear={handleDateClear}
                />
              </div>
              <h2 className="text-4xl sm:text-5xl lg:text-[2.8rem] xl:text-5xl font-bold tracking-tight text-[#1D1D1F] break-words leading-tight">{fmt(financeiroFiltrado ? financeiroFiltrado.faturamento : financeiro.faturamentoHoje)}</h2>
            </div>
            
            <div className="mt-8 flex flex-wrap gap-3">
              {!financeiroFiltrado && (
                <div className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full font-bold text-xs ${crescimento >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                  {crescimento >= 0 ? <IoArrowUpOutline size={14} /> : <IoArrowDownOutline size={14} />}
                  {Math.abs(crescimento).toFixed(1)}% Hoje
                </div>
              )}
              <div className="flex items-center justify-center px-4 py-2 rounded-full font-bold text-xs bg-[#F5F5F7] text-[#1D1D1F]">
                Vol Total: {fmt(financeiro.totalHistorico)}
              </div>
            </div>
          </div>
        </div>

        {/* TOP 1 RANKING CARD */}
        <div className="col-span-12 lg:col-span-4 bg-gradient-to-br from-amber-500 to-orange-600 rounded-[2rem] p-8 shadow-lg flex flex-col justify-between relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-8 opacity-20 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-700">
              <FaCrown size={120} />
           </div>
           <div>
              <p className="text-[10px] font-semibold text-amber-100 uppercase tracking-widest mb-1 relative z-10">🥇 Loja Destaque (Ranking Top 1)</p>
              {(() => {
                 const ranking = financeiroFiltrado ? financeiroFiltrado.topLojas : financeiro.topLojas;
                 const top1 = ranking && ranking.length > 0 ? ranking[0] : null;
                 if (top1) {
                   return (
                     <div className="relative z-10 mt-2 flex flex-col justify-between h-[85%]">
                       <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2 line-clamp-2">{estabelecimentosMap[top1.id] || top1.nomeSalvoNoPedido || 'Desconhecido'}</h2>
                       <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-5 py-4 mt-auto inline-block border border-white/20 shadow-sm">
                         <p className="text-3xl font-black text-white tracking-tight">{fmt(top1.total)}</p>
                         <p className="text-xs font-semibold text-amber-100 mt-1">Em {top1.pedidos} Pedidos</p>
                       </div>
                     </div>
                   );
                 }
                 return (
                   <div className="relative z-10 mt-6 text-amber-100 font-medium">Nenhum pedido hoje ainda.</div>
                 );
              })()}
           </div>
        </div>

        {/* METRICS STACK */}
        <div className="col-span-12 lg:col-span-3 grid grid-rows-2 gap-4 md:gap-6">
          <div className="bg-white border border-[#E5E5EA] rounded-[2rem] p-6 shadow-sm flex flex-col justify-center relative overflow-hidden">
             <p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-widest mb-1">Pedidos Realizados</p>
             <h2 className="text-3xl font-bold tracking-tight text-[#1D1D1F]">{financeiroFiltrado ? financeiroFiltrado.qtd : financeiro.qtdHoje} <span className="text-[#86868B] text-sm font-medium">entregas</span></h2>
             {!financeiroFiltrado && <p className="text-xs font-medium text-[#86868B] mt-1">Ticket Médio: <strong className="text-black">{fmt(financeiroFiltrado ? financeiroFiltrado.ticketMedio : ticketMedio)}</strong></p>}
          </div>
          <div className="bg-black rounded-[2rem] p-6 shadow-lg flex flex-col justify-center relative overflow-hidden group">
             <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-zinc-800 rounded-full blur-2xl group-hover:bg-blue-900/40 transition-colors duration-1000"></div>
             <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest mb-1 relative z-10">Lojas Ativas</p>
             <h2 className="text-3xl font-bold tracking-tight text-white relative z-10">{stats.estabelecimentosAtivos} <span className="text-zinc-500 text-lg">/ {stats.totalEstabelecimentos}</span></h2>
             <p className="text-[10px] font-medium text-zinc-400 mt-1 relative z-10">{stats.totalUsuarios} conexões.</p>
          </div>
        </div>

        {/* ─── RANKING TOP SECUNDÁRIO ─── */}
        <div className="col-span-12 mt-6 mb-2">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between px-2 mb-4">
             <div>
               <h2 className="text-xl font-bold tracking-tight text-[#1D1D1F]">Outras Lojas em Destaque</h2>
               <p className="text-sm font-medium text-[#86868B] mt-1">Lojistas operando atualmente com mais de 1 pedido finalizado.</p>
             </div>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <style>{`.snap-x::-webkit-scrollbar { display: none; }`}</style>
            {(() => {
              const ranking = financeiroFiltrado ? financeiroFiltrado.topLojas : financeiro.topLojas;
              // Pula o Top 1 e pega os próximos que tem pedidos > 1
              const outros = ranking ? ranking.slice(1).filter(l => l.pedidos > 1) : [];
              
              if (outros.length === 0) return <div className="bg-[#F5F5F7] border border-[#E5E5EA] rounded-[1.5rem] p-6 w-full text-center text-[#86868B] text-sm font-medium">Nenhum outro estabelecimento se qualificou com mais de 1 pedido para exibir no ranking secundário.</div>;

              return outros.map((loja, idx) => (
                <div key={loja.id} className="min-w-[280px] bg-white border border-[#E5E5EA] rounded-[1.5rem] p-6 shadow-sm snap-start hover:shadow-lg hover:-translate-y-1 transition-all cursor-default">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-full uppercase tracking-wider">Top #{idx + 2}</span>
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">{loja.pedidos} unids.</span>
                  </div>
                  <h3 className="font-bold text-[#1D1D1F] truncate text-base mb-1">{estabelecimentosMap[loja.id] || loja.nomeSalvoNoPedido || 'Desconhecido'}</h3>
                  <p className="text-3xl font-black tracking-tight text-black">{fmt(loja.total)}</p>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* ─── CRM & RELACIONAMENTO COM LOJAS ─── */}
        <div className="col-span-12 mt-6">
           <div className="bg-white border border-[#E5E5EA] rounded-[1.5rem] shadow-sm p-6 sm:p-8">
             <div className="flex flex-col mb-5">
               <h2 className="text-xl font-bold tracking-tight text-[#1D1D1F]">Sucesso do Cliente (Customer Success)</h2>
               <p className="text-sm font-medium text-[#86868B] mt-1">Lista rápida para enviar um agradecimento ou engajar donos de estabelecimentos e alavancar vendas.</p>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
               <style>{`.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E5EA; border-radius: 4px; }`}</style>
               {contatosEstabelecimentos.length === 0 ? (
                 <p className="text-sm text-[#86868B] col-span-full">Nenhum estabelecimento cadastrado.</p>
               ) : contatosEstabelecimentos.map((estab) => {
                 const hasPhone = estab.telefone && String(estab.telefone).replace(/\D/g, '').length >= 8;
                 const rawPhone = hasPhone ? String(estab.telefone).replace(/\D/g, '') : '';
                 const cleanPhone = rawPhone.length === 11 || rawPhone.length === 10 ? `55${rawPhone}` : rawPhone;
                 const saudaLojasTexto = encodeURIComponent(`Olá equipe do *${estab.nome}*! Aqui é o Matheus Jardim.\n\nPassando para agradecer pela nossa parceria incrível e ver como estão as coisas por aí. Vamos juntos alavancar ainda mais as suas vendas essa semana! 🚀`);
                 
                 return (
                   <div key={estab.id} className="flex items-center justify-between p-3.5 border border-slate-100 bg-[#F5F5F7]/60 rounded-xl hover:bg-white hover:border-[#E5E5EA] hover:shadow-sm transition-all group">
                      <div className="truncate pr-2">
                        <p className="font-bold text-sm text-[#1D1D1F] truncate group-hover:text-black">{estab.nome}</p>
                        <p className="text-xs font-semibold text-[#86868B] mt-0.5">{hasPhone ? estab.telefone : 'Sem telefone'}</p>
                      </div>
                      {hasPhone ? (
                        <a 
                          href={`https://wa.me/${cleanPhone}?text=${saudaLojasTexto}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="flex-shrink-0 bg-[#25D366] hover:bg-[#1DA851] text-white w-9 h-9 rounded-full flex items-center justify-center shadow-sm transition-all hover:scale-105"
                          title="Enviar mensagem de agradecimento"
                        >
                          <FaWhatsapp size={18} />
                        </a>
                      ) : (
                        <div 
                          className="flex-shrink-0 bg-gray-300 text-white w-9 h-9 rounded-full flex items-center justify-center opacity-50 cursor-not-allowed"
                          title="Loja sem telefone/whatsapp cadastrado"
                        >
                          <FaWhatsapp size={18} />
                        </div>
                      )}
                   </div>
                 )
               })}
             </div>
           </div>
        </div>

        {/* ─── APLICATIVOS DO SISTEMA (POR CATEGORIA) ─── */}
        <div className="col-span-12 mt-8 mb-2 px-2">
          <h2 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">Módulos do Sistema</h2>
          <p className="text-sm font-medium text-[#86868B] mt-1">Ferramentas organizadas por categoria de operação e gerência.</p>
        </div>

        <div className="col-span-12 space-y-6">
          {categoriasExibidas.map((categoria, index) => (
            <div key={index} className="bg-white border border-[#E5E5EA] rounded-[2rem] p-6 sm:p-8 shadow-sm">
              <h3 className="font-bold text-lg text-[#1D1D1F] mb-6 tracking-tight flex items-center gap-3">
                <span className={`w-3 h-3 rounded-full ${categoria.badgeColor}`}></span>
                {categoria.grupo}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-5">
                {categoria.modulos.map((m, i) => (
                  <Link key={i} to={m.to} className="bg-[#F5F5F7] border border-transparent rounded-[1.5rem] p-4 sm:p-5 hover:bg-white hover:border-[#1D1D1F]/10 hover:shadow-lg hover:-translate-y-1 transition-all flex flex-col items-center justify-center gap-3 sm:gap-4 aspect-square text-center group cursor-pointer duration-300">
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white border flex items-center justify-center transition-colors duration-300 shadow-sm ${m.colorStyle}`}>
                      {React.cloneElement(m.icon, { className: "text-xl sm:text-2xl" })}
                    </div>
                    <h4 className="font-semibold text-[11px] sm:text-xs text-[#1D1D1F] tracking-tight group-hover:text-black">{m.title}</h4>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {categoriasExibidas.length === 0 && (
            <div className="py-16 bg-white border border-[#E5E5EA] rounded-[2rem] text-center text-[#86868B] font-medium shadow-sm">
               Nenhum módulo encontrado com '{searchQuery}'.
            </div>
          )}
        </div>

      </main>

      {/* ─── ESTILOS GLOBAIS DE SISTEMA ─── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 12s linear infinite; }
      `}</style>
    </div>
  );
}

export default MasterDashboard;