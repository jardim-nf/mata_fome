import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FaArrowLeft, FaBolt, FaCrown, FaSignOutAlt } from 'react-icons/fa';
import { AdminDepartamentosFiscais } from '../../components/admin/AdminDepartamentosFiscais';

function DepartamentosFiscaisMaster() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  const userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Admin';

  if (authLoading) return <div className="flex h-screen items-center justify-center bg-slate-50"><div className="w-12 h-12 border-4 border-slate-200 border-t-yellow-400 rounded-full animate-spin"></div></div>;

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-amber-50/20 min-h-screen font-sans">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 h-16 border-b border-slate-100 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-md shadow-yellow-400/25 group-hover:scale-105 transition-transform">
              <FaBolt className="text-white text-xs" />
            </div>
            <span className="text-slate-900 font-black text-lg tracking-tight">Idea<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-amber-500">Food</span></span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center justify-center"><FaCrown className="text-yellow-600 text-[10px]" /></div>
              <span className="text-sm font-bold text-slate-700">{userName}</span>
            </div>
            <button onClick={async () => { await logout(); navigate('/'); }} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"><FaSignOutAlt size={14} /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-16">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <button onClick={() => navigate('/master-dashboard')} className="text-slate-400 hover:text-yellow-600 flex items-center gap-2 mb-4 text-sm font-bold transition-colors group">
              <span className="bg-white p-1.5 rounded-lg shadow-sm border border-slate-100 group-hover:border-yellow-200 transition-colors"><FaArrowLeft /></span> Voltar ao Dashboard
            </button>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-purple-100 text-purple-700 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-purple-200">Global Master</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Departamentos Fiscais Globais</h1>
            <p className="text-slate-500 text-sm mt-1 font-medium">Crie grupos tributários pré-definidos que ficarão disponíveis para TODAS as lojas do sistema.</p>
          </div>
        </div>

        {/* CONTENT */}
        <AdminDepartamentosFiscais forceEstabId="GLOBAL" />

      </main>
    </div>
  );
}

export default DepartamentosFiscaisMaster;
