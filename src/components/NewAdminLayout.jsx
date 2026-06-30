import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiCommand, FiSearch, FiBell, FiSettings, FiMenu } from 'react-icons/fi';
import { CommandPalette } from './admin/CommandPalette';

export default function NewAdminLayout() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [isCmdOpen, setIsCmdOpen] = useState(false);

  const userName = currentUser?.displayName || currentUser?.nome || currentUser?.email?.split('@')[0] || 'Admin';

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCmdOpen(true);
      }
      if (e.key === 'Escape') {
        setIsCmdOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-cyan-500/30 selection:text-cyan-200 flex flex-col relative overflow-hidden">
      
      {/* Grade Cibernética de Fundo Global */}
      <div className="fixed inset-0 bg-cyber-grid-dark opacity-30 pointer-events-none z-0" />
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-900/20 blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-900/20 blur-[120px] pointer-events-none z-0" />

      {/* TOP NAVIGATION HEADER */}
      <header className="h-16 w-full border-b border-white/5 bg-slate-950/50 backdrop-blur-md flex items-center justify-between px-6 z-40 sticky top-0">
        
        {/* Left: Logo & Branding */}
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/master-dashboard')}>
          <div className="w-8 h-8 bg-gradient-to-tr from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <span className="font-black text-white text-lg">M</span>
          </div>
          <span className="font-black tracking-widest text-lg font-bricolage text-white hidden sm:block">
            MATA<span className="text-cyan-400">FOME</span> OS
          </span>
        </div>

        {/* Center: Command Palette Trigger */}
        <div 
          onClick={() => setIsCmdOpen(true)}
          className="flex-1 max-w-lg mx-8 hidden md:flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all duration-300 rounded-full px-4 py-1.5 cursor-text group"
        >
          <FiSearch className="text-slate-400 group-hover:text-cyan-400 transition-colors" />
          <span className="text-sm text-slate-500 flex-1 font-space">Buscar lojas, usuários, configurações...</span>
          <div className="flex items-center gap-1 text-xs font-mono text-slate-500 bg-black/40 px-2 py-0.5 rounded-md border border-white/5">
            <FiCommand size={10} /> <span>K</span>
          </div>
        </div>

        {/* Right: Actions & User */}
        <div className="flex items-center gap-4">
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors relative">
            <FiBell size={18} />
            <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          </button>
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors">
            <FiSettings size={18} />
          </button>
          
          <div className="h-6 w-px bg-white/10 mx-1" />

          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-bold text-white">{userName}</span>
              <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold font-mono-jb">Master Admin</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center font-black text-white shadow-lg border border-white/20">
              {userName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT CANVAS */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 relative z-10 overflow-y-auto custom-scrollbar">
        <Outlet />
      </main>

      {/* COMMAND PALETTE COMPONENT */}
      <CommandPalette isOpen={isCmdOpen} onClose={() => setIsCmdOpen(false)} />
    </div>
  );
}
