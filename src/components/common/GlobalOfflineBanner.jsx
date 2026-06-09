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
          initial={{ y: -50, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -50, opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed top-4 left-4 z-[9999] bg-amber-500 text-white px-3.5 py-2 rounded-full flex items-center gap-2 shadow-lg backdrop-blur-md bg-opacity-95 border border-amber-400 text-xs font-black"
        >
          <WifiOff size={16} className="animate-pulse" />
          <span className="tracking-tight">
            Modo Offline
          </span>
        </motion.div>
      )}

      {isOnline && showOnlinePulse && (
        <motion.div
          initial={{ y: -50, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -50, opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed top-4 left-4 z-[9999] bg-emerald-500 text-white px-3.5 py-2 rounded-full flex items-center gap-2 shadow-lg backdrop-blur-md bg-opacity-95 border border-emerald-400 text-xs font-black"
        >
          <Wifi size={16} />
          <span className="tracking-tight">
            Conectado
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
