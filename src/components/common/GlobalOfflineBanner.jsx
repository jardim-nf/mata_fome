import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi } from 'lucide-react';
import { useNetwork } from '../../hooks/useNetwork';

export default function GlobalOfflineBanner() {
  const isOnline = useNetwork();
  const [showOnlinePulse, setShowOnlinePulse] = useState(false);

  useEffect(() => {
    if (isOnline) {
      setShowOnlinePulse(true);
      const timer = setTimeout(() => setShowOnlinePulse(false), 3500); // Esconde banner de "Voltou" dps de 3.5s
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed top-0 left-0 w-full z-[9999] bg-yellow-500 text-black px-4 py-2 flex items-center justify-center gap-2 shadow-lg backdrop-blur-sm bg-opacity-90 border-b border-yellow-600"
        >
          <WifiOff size={18} className="animate-pulse" />
          <span className="text-sm font-semibold tracking-wide uppercase">
            Sem conexão. Operando em Modo Offline (Cache Local).
          </span>
        </motion.div>
      )}

      {isOnline && showOnlinePulse && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="fixed top-0 left-0 w-full z-[9999] bg-emerald-500 text-white px-4 py-2 flex items-center justify-center gap-2 shadow-lg backdrop-blur-sm bg-opacity-90 border-b border-emerald-600"
        >
          <Wifi size={18} />
          <span className="text-sm font-semibold tracking-wide uppercase">
            Conexão restaurada! Dados sincronizados.
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
