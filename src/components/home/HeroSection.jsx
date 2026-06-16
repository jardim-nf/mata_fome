// src/components/home/HeroSection.jsx
import { motion } from 'framer-motion';
import { ChevronDown, LogIn, LayoutDashboard, LogOut, User, Zap, Package, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

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
    <section className="relative w-full overflow-hidden bg-gradient-to-br from-white via-orange-50/30 to-orange-50 pt-24 md:pt-32">
      {/* Top Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100 shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/logo-idea-solucoes-transp.png" alt="Idea System Logo" className="h-8 w-auto" />
            <span className="text-xl font-extrabold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
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
                    <span className="text-xs text-gray-500 font-medium leading-none">Olá,</span>
                    <span className="text-sm font-bold text-gray-800 leading-none">
                      {currentUser.displayName || currentUser.email?.split('@')[0] || 'Visitante'}
                    </span>
                  </div>
                </div>

                {(isAdmin || isMasterAdmin) && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate(isMasterAdmin ? '/master-dashboard' : '/dashboard')}
                    className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-2 px-4 rounded-xl text-sm shadow-md hover:shadow-lg transition-all"
                  >
                    <LayoutDashboard size={16} className="hidden sm:block" />
                    Painel
                  </motion.button>
                )}

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLogout}
                  className="flex items-center gap-2 bg-red-50 text-red-600 font-bold py-2 px-4 rounded-xl text-sm shadow-sm hover:bg-red-100 transition-colors"
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
                className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-2 px-6 rounded-xl text-sm shadow-md hover:shadow-lg transition-shadow"
              >
                <LogIn size={16} />
                Entrar
              </motion.button>
            )}
          </div>
        </div>
      </nav>
      {/* Decorative blobs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="container mx-auto flex flex-col lg:flex-row items-center justify-between py-12 md:py-20 px-4 relative z-10 overflow-hidden">
        {/* Left content */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="w-full lg:w-[48%] text-center lg:text-left mb-10 lg:mb-0 relative z-20 shrink-0"
        >
          <div className="inline-flex items-center bg-orange-100 text-orange-700 px-4 py-2 rounded-full text-sm font-semibold mb-6">
            <span className="w-2 h-2 bg-orange-500 rounded-full mr-2 animate-pulse" />
            🔥 Solução Completa para Varejo e Atacado
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
            Está com problemas <br className="hidden md:inline" /> no seu sistema? <br />
            <span className="bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
              O Idea System Resolve!
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-lg mx-auto lg:mx-0 leading-relaxed">
            Uma plataforma de gestão, vendas e estoque sob medida para todos os segmentos. Esqueça travamentos e falta de suporte.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onExploreClick}
              className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-4 px-8 rounded-2xl text-lg shadow-lg shadow-orange-500/25 transition-shadow hover:shadow-xl hover:shadow-orange-500/30"
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
              className="border-2 border-gray-900 text-gray-900 font-bold py-4 px-8 rounded-2xl text-lg hover:bg-gray-900 hover:text-white transition-all duration-300"
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
                <div className="text-3xl font-extrabold bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Right image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
          className="relative w-full lg:w-[48%] rounded-3xl"
          style={{ height: '480px' }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-red-500 opacity-20 z-0" />

          <img
            src="/hero-banner-new.png"
            alt="Plataforma Completa Idea System"
            className="absolute inset-0 w-full h-full object-cover z-10 hover:scale-105 transition-transform duration-500 rounded-3xl"
          />

          {/* Floating Feature Cards */}
          {/* Card 1: PDV */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ 
              opacity: 1, 
              x: 0,
              y: [0, -8, 0]
            }}
            transition={{
              opacity: { delay: 0.6, duration: 0.6 },
              x: { delay: 0.6, duration: 0.6 },
              y: { repeat: Infinity, duration: 4, ease: "easeInOut" }
            }}
            whileHover={{ scale: 1.05 }}
            className="absolute top-8 left-6 bg-white/90 border border-white/80 backdrop-blur-xl rounded-2xl p-3 flex items-center gap-3 shadow-[0_8px_30px_rgb(0,0,0,0.08)] z-30 select-none cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
              <Zap size={18} className="fill-orange-600/15" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900 leading-none">PDV Ultra Veloz</p>
              <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Vendas Instantâneas</p>
            </div>
          </motion.div>

          {/* Card 2: Estoque */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ 
              opacity: 1, 
              x: 0,
              y: [0, -12, 0]
            }}
            transition={{
              opacity: { delay: 0.8, duration: 0.6 },
              x: { delay: 0.8, duration: 0.6 },
              y: { repeat: Infinity, duration: 4.5, ease: "easeInOut", delay: 0.5 }
            }}
            whileHover={{ scale: 1.05 }}
            className="absolute top-1/2 -translate-y-1/2 right-6 bg-white/90 border border-white/80 backdrop-blur-xl rounded-2xl p-3 flex items-center gap-3 shadow-[0_8px_30px_rgb(0,0,0,0.08)] z-30 select-none cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
              <Package size={18} className="fill-red-600/15" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900 leading-none">Estoque Inteligente</p>
              <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Atualização em tempo real</p>
            </div>
          </motion.div>

          {/* Card 3: Financeiro */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ 
              opacity: 1, 
              y: [0, -10, 0]
            }}
            transition={{
              opacity: { delay: 1.0, duration: 0.6 },
              y: { repeat: Infinity, duration: 5, ease: "easeInOut", delay: 1.0 }
            }}
            whileHover={{ scale: 1.05 }}
            className="absolute bottom-8 left-8 bg-white/90 border border-white/80 backdrop-blur-xl rounded-2xl p-3 flex items-center gap-3 shadow-[0_8px_30px_rgb(0,0,0,0.08)] z-30 select-none cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
              <TrendingUp size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900 leading-none">Financeiro Completo</p>
              <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Fluxo de Caixa 360°</p>
            </div>
          </motion.div>

          {/* Decorative elements */}
          <div className="absolute bottom-4 left-4 w-24 h-24 bg-gradient-to-br from-orange-300 to-red-300 rounded-full opacity-40 animate-pulse z-20" />
          <div className="absolute top-4 right-4 w-16 h-16 bg-gradient-to-br from-orange-300 to-amber-300 rounded-full opacity-30 animate-bounce z-20" style={{ animationDuration: '3s' }} />
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
          className="text-gray-400 hover:text-orange-500 transition-colors"
        >
          <ChevronDown size={32} />
        </motion.button>
      </motion.div>
    </section>
  );
};

export default HeroSection;
