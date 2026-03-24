// src/components/home/HeroSection.jsx
import { motion } from 'framer-motion';
import { ChevronDown, LogIn, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const HeroSection = ({ onExploreClick, onLoginClick, currentUser, isAdmin, isMasterAdmin }) => {
  const navigate = useNavigate();

  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-br from-white via-yellow-50 to-orange-50 pt-24 md:pt-32">
      {/* Top Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100 shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <span className="text-xl font-extrabold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
            🍔 IdeaFood
          </span>

          {(isAdmin || isMasterAdmin) ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(isMasterAdmin ? '/master-dashboard' : '/dashboard')}
              className="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold py-2 px-5 rounded-xl text-sm shadow-md hover:shadow-lg transition-shadow"
            >
              <LayoutDashboard size={16} />
              Painel
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onLoginClick}
              className="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold py-2 px-5 rounded-xl text-sm shadow-md hover:shadow-lg transition-shadow"
            >
              <LogIn size={16} />
              Entrar
            </motion.button>
          )}
        </div>
      </nav>
      {/* Decorative blobs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="container mx-auto flex flex-col lg:flex-row items-center justify-between py-12 md:py-20 px-4 relative z-10 overflow-hidden">
        {/* Left content */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="w-full lg:w-[48%] text-center lg:text-left mb-10 lg:mb-0 relative z-20 shrink-0"
        >
          <div className="inline-flex items-center bg-yellow-100 text-yellow-700 px-4 py-2 rounded-full text-sm font-semibold mb-6">
            <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2 animate-pulse" />
            🔥 A plataforma que mais cresce no Brasil
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
            Bateu a fome?{' '}
            <br className="hidden md:inline" />
            <span className="bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
              Pede no IdeaFood!
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-lg mx-auto lg:mx-0 leading-relaxed">
            Sua plataforma própria de delivery, com os melhores estabelecimentos da cidade,
            entregue rapidinho na sua porta.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onExploreClick}
              className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold py-4 px-8 rounded-2xl text-lg shadow-lg shadow-yellow-500/25 transition-shadow hover:shadow-xl hover:shadow-yellow-500/30"
            >
              🍕 Ver Estabelecimentos
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const phoneNumber = "55229998102575";
                const message = "Olá! Gostaria de cadastrar meu estabelecimento no IdeaFood.";
                window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
              }}
              className="border-2 border-gray-900 text-gray-900 font-bold py-4 px-8 rounded-2xl text-lg hover:bg-gray-900 hover:text-white transition-all duration-300"
            >
              📞 Cadastrar Meu Negócio
            </motion.button>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-8 mt-10 justify-center lg:justify-start">
            {[
              { value: '+500', label: 'Estabelecimentos' },
              { value: '+10k', label: 'Pedidos Entregues' },
              { value: '24/7', label: 'Disponível' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + i * 0.15 }}
                className="text-center"
              >
                <div className="text-3xl font-extrabold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
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
          className="relative w-full lg:w-[48%] overflow-hidden rounded-3xl"
          style={{ height: '480px' }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-400 opacity-90" />

          <img
            src="https://firebasestorage.googleapis.com/v0/b/matafome-98455.firebasestorage.app/o/pizza.png?alt=media&token=aac1a9a6-5381-41df-b728-c394fba7b762"
            alt="Pizza Deliciosa IdeaFood"
            className="absolute inset-0 w-full h-full object-cover z-10 hover:scale-105 transition-transform duration-500"
          />

          {/* Decorative elements */}
          <div className="absolute bottom-4 left-4 w-24 h-24 bg-gradient-to-br from-yellow-300 to-orange-300 rounded-full opacity-40 animate-pulse z-20" />
          <div className="absolute top-4 right-4 w-16 h-16 bg-gradient-to-br from-orange-300 to-red-300 rounded-full opacity-30 animate-bounce z-20" style={{ animationDuration: '3s' }} />
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
          className="text-gray-400 hover:text-yellow-500 transition-colors"
        >
          <ChevronDown size={32} />
        </motion.button>
      </motion.div>
    </section>
  );
};

export default HeroSection;
