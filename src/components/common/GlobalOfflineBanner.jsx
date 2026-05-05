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
      const timer = setTimeout(() => setShowOnlinePulse(false), 1500); // 1.5s rápido e discreto
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: 50, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 50, opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed bottom-6 right-6 z-[9999] bg-amber-500 text-white px-5 py-3 rounded-2xl flex items-center gap-3 shadow-2xl backdrop-blur-md bg-opacity-95 border border-amber-400"
        >
          <WifiOff size={20} className="animate-pulse" />
          <span className="text-sm font-bold tracking-tight">
            Modo Offline Ativado
          </span>
        </motion.div>
      )}

      {isOnline && showOnlinePulse && (
        <motion.div
          initial={{ y: 50, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 50, opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed bottom-6 right-6 z-[9999] bg-emerald-500 text-white px-5 py-3 rounded-2xl flex items-center gap-3 shadow-2xl backdrop-blur-md bg-opacity-95 border border-emerald-400"
        >
          <Wifi size={20} />
          <span className="text-sm font-bold tracking-tight">
            Conexão Restaurada
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
