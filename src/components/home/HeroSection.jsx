// src/components/home/HeroSection.jsx
import { motion } from 'framer-motion';
import { ChevronDown, LogIn, LayoutDashboard, LogOut, User, Zap, Package, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ThreeHeroCanvas from './ThreeHeroCanvas';
import TiltCard from './TiltCard';

const HeroSection = ({ onExploreClick, onLoginClick, currentUser, isAdmin, isMasterAdmin }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  };

  return (
    <section className="relative w-full min-h-[100dvh] flex flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
        <div className="container mx-auto flex items-center justify-between px-6 py-4 max-w-7xl">
          <div className="flex items-center gap-3">
            <img src="/logo-idea-solucoes-transp.png" alt="Idea System" className="h-7 w-auto" />
            <img 
              src="/mascot_wave.gif" 
              alt="Mascot Waving" 
              className="h-8 w-auto object-contain hover:scale-105 transition-transform duration-300 cursor-pointer hidden sm:block"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-support-chat'));
              }}
              title="Abrir Chat de Suporte"
            />
            <span className="text-lg font-semibold text-white tracking-tight">Idea System</span>
          </div>

          <div className="flex items-center gap-6">
            {currentUser ? (
              <div className="flex items-center gap-6">
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
                    <User size={14} />
                  </div>
                  <span className="text-sm font-medium text-slate-300">
                    {currentUser.displayName || currentUser.email?.split('@')[0] || 'Visitante'}
                  </span>
                </div>
                {(isAdmin || isMasterAdmin) && (
                  <button onClick={() => navigate(isMasterAdmin ? '/master-dashboard' : '/dashboard')} className="text-sm font-medium hover:text-white transition-colors">
                    Painel
                  </button>
                )}
                <button onClick={handleLogout} className="text-sm font-medium text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1.5">
                  Sair <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button onClick={onLoginClick} className="text-sm font-medium bg-white text-slate-950 px-5 py-2 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2">
                <LogIn size={16} /> Entrar
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Content */}
      <div className="flex-1 max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center justify-center lg:justify-between pt-32 pb-20 relative z-10 gap-16 w-full">
        
        {/* Left content */}
        <div className="w-full lg:w-[50%] flex flex-col items-start z-20">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold text-white tracking-tighter leading-[1.05] mb-6">
            O fim dos travamentos no seu PDV.
          </h1>

          <p className="text-lg text-slate-400 mb-10 max-w-[28rem] leading-relaxed">
            Plataforma premium de gestão, vendas e estoque para varejo e atacado. Rápida, estável e com suporte que resolve.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <button
              onClick={onExploreClick}
              className="bg-white text-slate-950 font-medium py-3.5 px-6 rounded-xl text-base hover:bg-slate-200 transition-colors whitespace-nowrap"
            >
              Ver Segmentos
            </button>
            <button
              onClick={() => {
                const phoneNumber = "5522998102575";
                const message = "Olá! Gostaria de conhecer as soluções de gestão do Idea System para o meu negócio.";
                window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
              }}
              className="bg-slate-900 border border-slate-800 text-white font-medium py-3.5 px-6 rounded-xl text-base hover:bg-slate-800 hover:border-slate-700 transition-colors whitespace-nowrap flex items-center justify-center gap-2"
            >
              Falar com Especialista
            </button>
          </div>
        </div>

        {/* Right content: 3D Mascot / System representation */}
        <div className="relative w-full lg:w-[45%] aspect-square max-w-[500px] lg:max-w-none rounded-3xl bg-slate-900/30 border border-white/5 flex items-center justify-center overflow-hidden">
           <div className="absolute inset-0 z-0">
             <ThreeHeroCanvas />
           </div>
           
           <TiltCard maxRotate={8} scale={1.02} className="relative z-10">
             <img
               src="/mascot_wave.gif"
               alt="Idea — Mascote Oficial"
               className="w-[200px] md:w-[280px] object-contain drop-shadow-2xl"
             />
           </TiltCard>
           
           {/* Floating minimal cards */}
           <div className="absolute top-8 left-8 bg-slate-950/80 backdrop-blur-md border border-white/10 rounded-lg p-3 flex items-center gap-3 z-20">
              <Zap size={16} className="text-amber-400" />
              <span className="text-xs font-medium text-white">PDV Ultra Veloz</span>
           </div>
           
           <div className="absolute bottom-8 right-8 bg-slate-950/80 backdrop-blur-md border border-white/10 rounded-lg p-3 flex items-center gap-3 z-20">
              <Package size={16} className="text-emerald-400" />
              <span className="text-xs font-medium text-white">Estoque em Tempo Real</span>
           </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
