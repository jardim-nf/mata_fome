import React, { useMemo, useState } from 'react';
import { useNavigate, Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FaStore, FaUsers, FaClipboardList, FaFileUpload, FaTags, FaShieldAlt, FaImages,
  FaMoneyBillWave, FaSync, FaChartLine, FaRocket, FaBolt,
  FaAddressBook, FaReceipt, FaTicketAlt, FaCommentDots, FaBuilding
} from 'react-icons/fa';
import {
  IoSearchOutline, IoLogOutOutline
} from 'react-icons/io5';

function MasterLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const userName = currentUser?.displayName || currentUser?.nome || currentUser?.email?.split('@')[0] || 'Admin';

  const categoriasDeModulos = [
    {
      grupo: 'Operação & Vendas',
      badgeColor: 'bg-indigo-500',
      modulos: [
        { to: '/master/estabelecimentos', title: 'Lojas', icon: <FaStore />, iconColor: 'text-amber-500', iconBg: 'bg-amber-50', iconActive: 'bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]' },
        { to: '/master/clientes', title: 'CRM/Clientes', icon: <FaAddressBook />, iconColor: 'text-indigo-500', iconBg: 'bg-indigo-50', iconActive: 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' },
        { to: '/master/painel-rede', title: 'Monitor de Rede', icon: <FaClipboardList />, iconColor: 'text-rose-500', iconBg: 'bg-rose-50', iconActive: 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]' },
      ]
    },
    {
      grupo: 'Financeiro & Fiscal',
      badgeColor: 'bg-emerald-500',
      modulos: [
        { to: '/master/financeiro', title: 'Placar Financeiro', icon: <FaMoneyBillWave />, iconColor: 'text-emerald-500', iconBg: 'bg-emerald-50', iconActive: 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' },
        { to: '/master/contas-receber', title: 'Contas a Receber', icon: <FaUsers />, iconColor: 'text-slate-650', iconBg: 'bg-slate-100', iconActive: 'bg-slate-800 text-white shadow-[0_0_15px_rgba(30,41,59,0.4)]' },
        { to: '/master/analytics', title: 'Painel Analytics', icon: <FaChartLine />, iconColor: 'text-cyan-500', iconBg: 'bg-cyan-50', iconActive: 'bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' },
        { to: '/master/nfce', title: 'Emissão Fiscal', icon: <FaReceipt />, iconColor: 'text-slate-500', iconBg: 'bg-slate-100', iconActive: 'bg-slate-600 text-white shadow-[0_0_15px_rgba(71,85,105,0.4)]' },
        { to: '/master/departamentos-fiscais', title: 'Docs Fiscais', icon: <FaBuilding />, iconColor: 'text-sky-500', iconBg: 'bg-sky-50', iconActive: 'bg-sky-500 text-white shadow-[0_0_15px_rgba(14,165,233,0.4)]' },
      ]
    },
    {
      grupo: 'Growth & Marketing',
      badgeColor: 'bg-pink-500',
      modulos: [
        { to: '/master/plans', title: 'Gerir Planos', icon: <FaTags />, iconColor: 'text-fuchsia-500', iconBg: 'bg-fuchsia-50', iconActive: 'bg-fuchsia-500 text-white shadow-[0_0_15px_rgba(217,70,239,0.4)]' },
        { to: '/master/cupons-rede', title: 'Cupons da Rede', icon: <FaTicketAlt />, iconColor: 'text-pink-500', iconBg: 'bg-pink-50', iconActive: 'bg-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.4)]' },
        { to: '/master/mensagens', title: 'Push / Alertas', icon: <FaCommentDots />, iconColor: 'text-violet-500', iconBg: 'bg-violet-50', iconActive: 'bg-violet-500 text-white shadow-[0_0_15px_rgba(139,92,246,0.4)]' },
        { to: '/divulgacao', title: 'Mídia Kit Base', icon: <FaRocket />, iconColor: 'text-orange-500', iconBg: 'bg-orange-50', iconActive: 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]' },
      ]
    },
    {
      grupo: 'Segurança & Infra',
      badgeColor: 'bg-zinc-800',
      modulos: [
        { to: '/master/usuarios', title: 'Usuários Ativos', icon: <FaUsers />, iconColor: 'text-blue-500', iconBg: 'bg-blue-50', iconActive: 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]' },
        { to: '/admin/auditoria-mesas', title: 'Auditoria Mesas', icon: <FaShieldAlt />, iconColor: 'text-indigo-500', iconBg: 'bg-indigo-50', iconActive: 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' },
        { to: '/master/importar-cardapio', title: 'ImportCardápio', icon: <FaFileUpload />, iconColor: 'text-teal-500', iconBg: 'bg-teal-50', iconActive: 'bg-teal-500 text-white shadow-[0_0_15px_rgba(20,184,166,0.4)]' },
        { to: '/master/migrador-universal', title: 'Migrador Dados', icon: <FaSync />, iconColor: 'text-lime-600', iconBg: 'bg-lime-50', iconActive: 'bg-lime-500 text-white shadow-[0_0_15px_rgba(132,204,22,0.4)]' },
        { to: '/master/associar-imagens', title: 'Banco Imagens', icon: <FaImages />, iconColor: 'text-yellow-500', iconBg: 'bg-yellow-50', iconActive: 'bg-yellow-500 text-white shadow-[0_0_15px_rgba(234,179,8,0.4)]' },
        { to: '/admin/audit-logs', title: 'Segurança Logs', icon: <FaShieldAlt />, iconColor: 'text-red-500', iconBg: 'bg-red-50', iconActive: 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]' },
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
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-800 overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* ── OVERLAY MOBILE ── */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ── SIDEBAR FIXA & MOBILE (LIGHT & COLORFUL) ── */}
      <aside className={`w-[280px] bg-white border-r border-slate-200 flex flex-col h-screen shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-50 fixed lg:static top-0 left-0 transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>

        {/* PROFILE HEADER */}
        <div className="p-6 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors group" onClick={() => navigate('/master-dashboard')}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-md text-white font-black text-xl group-hover:scale-105 transition-transform duration-300">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-semibold text-[10px] tracking-widest text-slate-400 uppercase mb-0.5">{saudacao}</h1>
              <h1 className="font-bold text-[15px] tracking-tight text-slate-800 line-clamp-1">{userName}</h1>
            </div>
          </div>
        </div>

        {/* NAVIGATION LIST */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
           
           {/* SEARCH BAR */}
           <div className="mb-8">
             <div className="flex items-center bg-slate-100 border border-slate-200 rounded-2xl px-4 py-3.5 focus-within:bg-white focus-within:border-indigo-300 focus-within:shadow-[0_4px_15px_rgba(99,102,241,0.1)] transition-all duration-300 group">
                <IoSearchOutline className="text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs ml-3 w-full placeholder-slate-400 font-semibold text-slate-700"
                  placeholder="Buscar módulo..." />
             </div>
           </div>

           {/* MODULE CATEGORIES */}
           {categoriasExibidas.map((categoria, index) => (
             <div key={index} className="mb-8">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 px-2 flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${categoria.badgeColor}`}></span>
                  {categoria.grupo}
                </h3>
                <div className="flex flex-col gap-1.5">
                  {categoria.modulos.map((m, i) => {
                    const isActive = location.pathname.startsWith(m.to);
                    const activeContainerBg = isActive ? 'bg-slate-50 border-slate-200 shadow-sm' : 'border-transparent hover:bg-slate-50';
                    const iconStateBg = isActive ? m.iconActive : `${m.iconBg} ${m.iconColor}`;
                    
                    return (
                      <Link 
                        key={i} 
                        to={m.to} 
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-2xl transition-all duration-300 border group ${activeContainerBg}`}
                      >
                         <div className="flex items-center gap-3.5">
                           <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${iconStateBg}`}>
                             {React.cloneElement(m.icon, { size: 14 })}
                           </div>
                           <span className={`text-[13px] font-bold transition-colors ${isActive ? 'text-slate-800' : 'text-slate-500 group-hover:text-slate-700'}`}>
                             {m.title}
                           </span>
                         </div>
                         {isActive && (
                             <div className="w-1.5 h-1.5 rounded-full bg-slate-800 mr-1"></div>
                         )}
                      </Link>
                    )
                  })}
                </div>
             </div>
           ))}
           
           {categoriasExibidas.length === 0 && (
             <div className="py-10 text-center flex flex-col items-center justify-center gap-3">
               <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                 <IoSearchOutline size={20} className="text-slate-400" />
               </div>
               <p className="text-slate-500 text-xs font-semibold">Nenhum módulo encontrado.</p>
             </div>
           )}
        </div>
        
        {/* LOGOUT BUTTON */}
        <div className="p-6 border-t border-slate-100 bg-white">
           <button onClick={async () => { await logout(); navigate('/'); }} 
              className="w-full flex items-center justify-center gap-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 hover:border-rose-200 text-rose-600 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 group">
              <IoLogOutOutline size={20} className="group-hover:-translate-x-1 transition-transform" /> 
              <span>Encerrar Sessão</span>
           </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <main className="flex-1 h-screen overflow-y-auto relative bg-slate-50/30 custom-scrollbar flex flex-col">
        
        {/* MOBILE HEADER FOR SIDEBAR TOGGLE */}
        <div className="lg:hidden flex items-center justify-between bg-white border-b border-slate-200 p-4 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-800">MasterAdmin</h2>
            </div>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -mr-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-x-hidden relative">
          <Outlet />
        </div>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
      `}</style>
    </div>
  );
}

export default MasterLayout;
