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
    <section className="relative w-full overflow-hidden bg-slate-950 pt-24 md:pt-32 text-slate-100">
      <style>{`
        @keyframes hologram-scan {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        .animate-scan {
          animation: hologram-scan 4s linear infinite;
        }
      `}</style>

      {/* Top Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/75 backdrop-blur-xl border-b border-white/10 shadow-lg">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/logo-idea-solucoes-transp.png" alt="Idea System Logo" className="h-8 w-auto" />
            <img 
              src="/mascot_wave.gif" 
              alt="Mascot Waving" 
              className="h-9 w-auto object-contain hover:scale-110 active:scale-95 transition-transform duration-300 cursor-pointer"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-support-chat'));
              }}
              title="Abrir Chat de Suporte"
            />
            <span className="text-xl font-extrabold bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
              Idea System
            </span>
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-400 to-orange-600 flex items-center justify-center text-white shadow-inner">
                    <User size={14} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400 font-medium leading-none">Olá,</span>
                    <span className="text-sm font-bold text-slate-200 leading-none">
                      {currentUser.displayName || currentUser.email?.split('@')[0] || 'Visitante'}
                    </span>
                  </div>
                </div>

                {(isAdmin || isMasterAdmin) && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate(isMasterAdmin ? '/master-dashboard' : '/dashboard')}
                    className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-650 text-white font-bold py-2 px-4 rounded-xl text-sm shadow-md hover:shadow-lg transition-all"
                  >
                    <LayoutDashboard size={16} className="hidden sm:block" />
                    Painel
                  </motion.button>
                )}

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLogout}
                  className="flex items-center gap-2 bg-red-950/40 text-red-400 border border-red-500/20 font-bold py-2 px-4 rounded-xl text-sm shadow-sm hover:bg-red-900/30 transition-colors"
                >
                  Sair
                  <LogOut size={16} />
                </motion.button>
              </div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onLoginClick}
                className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-2 px-6 rounded-xl text-sm shadow-md hover:shadow-lg transition-shadow shadow-orange-500/20"
              >
                <LogIn size={16} />
                Entrar
              </motion.button>
            )}
          </div>
        </div>
      </nav>

      {/* Decorative glows */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-orange-500/10 rounded-full filter blur-[80px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-red-500/10 rounded-full filter blur-[100px] animate-pulse pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="container mx-auto flex flex-col lg:flex-row items-center justify-between py-12 md:py-20 px-4 relative z-10 overflow-hidden">
        {/* Left content */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="w-full lg:w-[48%] text-center lg:text-left mb-16 lg:mb-0 relative z-20 shrink-0"
        >
          <div className="inline-flex items-center bg-orange-500/10 text-orange-400 border border-orange-500/20 px-4 py-2 rounded-full text-sm font-semibold mb-6">
            <span className="w-2 h-2 bg-orange-500 rounded-full mr-2 animate-pulse" />
            🔥 Solução Completa para Varejo e Atacado
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-tight">
            Está com problemas <br className="hidden md:inline" /> no seu sistema? <br />
            <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
              O Idea System Resolve!
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 mb-8 max-w-lg mx-auto lg:mx-0 leading-relaxed">
            Uma plataforma de gestão, vendas e estoque sob medida para todos os segmentos. Esqueça travamentos e falta de suporte.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onExploreClick}
              className="bg-gradient-to-r from-orange-500 to-red-650 text-white font-bold py-4 px-8 rounded-2xl text-lg shadow-lg shadow-orange-500/20 transition-all hover:shadow-xl hover:shadow-orange-500/30"
            >
              🛍️ Ver Segmentos e Lojas
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const phoneNumber = "5522998102575";
                const message = "Olá! Gostaria de conhecer as soluções de gestão do Idea System para o meu negócio.";
                window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
              }}
              className="border-2 border-slate-700 text-slate-300 font-bold py-4 px-8 rounded-2xl text-lg hover:bg-slate-800 hover:text-white hover:border-slate-500 transition-all duration-300"
            >
              📞 Falar com Especialista
            </motion.button>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-8 mt-10 justify-center lg:justify-start">
            {[
              { value: '100%', label: 'Todos os Segmentos' },
              { value: '⚡', label: 'Estabilidade Total' },
              { value: '24/7', label: 'Suporte Premium' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + i * 0.15 }}
                className="text-center"
              >
                <div className="text-3xl font-extrabold bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-sm text-slate-400 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Right 3D Column */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
          className="relative w-full lg:w-[48%] rounded-3xl"
          style={{ height: '480px' }}
        >
          {/* 3D Canvas + Waving Mascot Frame */}
          <div className="relative w-full h-full flex items-center justify-center">
            {/* 3D Background constellation */}
            <ThreeHeroCanvas />

            {/* Glowing orb background behind the mascot */}
            <div className="absolute w-[280px] h-[280px] rounded-full bg-orange-500/10 filter blur-[60px] pointer-events-none z-0" />

            {/* 3D Glassmorphic Mascot Card */}
            <TiltCard 
              className="relative z-10 w-[270px] h-[330px] md:w-[310px] md:h-[370px] rounded-[2.5rem] bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),_0_0_50px_rgba(249,115,22,0.15)] flex flex-col items-center justify-center p-6 group cursor-grab active:cursor-grabbing overflow-hidden"
              maxRotate={12}
              scale={1.04}
            >
              {/* Holographic scanner effect overlay */}
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-60 shadow-[0_0_12px_rgba(249,115,22,0.6)] animate-scan pointer-events-none" />

              {/* Glowing ring under mascot */}
              <div className="absolute w-[180px] h-[180px] rounded-full bg-radial-gradient from-orange-500/15 to-transparent filter blur-lg opacity-70 group-hover:scale-110 transition-transform duration-550" />

              {/* 3D Mascot GIF */}
              <img
                src="/mascot_wave.gif"
                alt="Idea — Mascote Oficial"
                className="w-[170px] h-[170px] md:w-[210px] md:h-[210px] object-contain relative z-20 drop-shadow-[0_15px_25px_rgba(0,0,0,0.55)] transform group-hover:translate-y-[-6px] transition-transform duration-500"
              />

              {/* Mascot Nameplate */}
              <div className="mt-4 px-5 py-2.5 rounded-2xl bg-orange-500/10 border border-orange-500/25 flex items-center gap-2.5 backdrop-blur-md relative z-20 group-hover:border-orange-500/50 group-hover:bg-orange-500/15 transition-all">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
                <span className="text-xs font-black uppercase tracking-widest text-orange-400">Mascote Idea</span>
              </div>
            </TiltCard>
          </div>

          {/* Floating Feature Cards */}
          {/* Card 1: PDV */}
          <TiltCard
            maxRotate={18}
            scale={1.06}
            className="absolute top-4 left-4 z-30 select-none cursor-pointer"
          >
            <div className="bg-slate-900/85 border border-white/10 backdrop-blur-md rounded-2xl p-3.5 flex items-center gap-3 shadow-[0_15px_35px_rgba(0,0,0,0.4)] group hover:border-orange-500/30 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center text-orange-450 border border-orange-500/20">
                <Zap size={18} className="fill-orange-400/15 text-orange-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-white leading-none">PDV Ultra Veloz</p>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">Vendas Instantâneas</p>
              </div>
            </div>
          </TiltCard>

          {/* Card 2: Estoque */}
          <TiltCard
            maxRotate={18}
            scale={1.06}
            className="absolute top-1/2 -translate-y-1/2 -right-2 z-30 select-none cursor-pointer"
          >
            <div className="bg-slate-900/85 border border-white/10 backdrop-blur-md rounded-2xl p-3.5 flex items-center gap-3 shadow-[0_15px_35px_rgba(0,0,0,0.4)] group hover:border-red-500/30 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center text-red-450 border border-red-500/20">
                <Package size={18} className="fill-red-450/15 text-red-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-white leading-none">Estoque Inteligente</p>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">Atualização em tempo real</p>
              </div>
            </div>
          </TiltCard>

          {/* Card 3: Financeiro */}
          <TiltCard
            maxRotate={18}
            scale={1.06}
            className="absolute bottom-4 left-6 z-30 select-none cursor-pointer"
          >
            <div className="bg-slate-900/85 border border-white/10 backdrop-blur-md rounded-2xl p-3.5 flex items-center gap-3 shadow-[0_15px_35px_rgba(0,0,0,0.4)] group hover:border-orange-550/30 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center text-orange-450 border border-orange-500/20">
                <TrendingUp size={18} className="text-orange-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-white leading-none">Financeiro Completo</p>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">Fluxo de Caixa 360°</p>
              </div>
            </div>
          </TiltCard>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="flex justify-center pb-8"
      >
        <motion.button
          onClick={onExploreClick}
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-slate-500 hover:text-orange-400 transition-colors"
        >
          <ChevronDown size={32} />
        </motion.button>
      </motion.div>
    </section>
  );
};

export default HeroSection;
