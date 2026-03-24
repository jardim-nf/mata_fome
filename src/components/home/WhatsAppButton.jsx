// src/components/home/WhatsAppButton.jsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X } from 'lucide-react';

const WhatsAppButton = () => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(true);

  const phoneNumber = '55229998102575';
  const message = 'Olá! Vi o IdeaFood e gostaria de saber mais sobre a plataforma.';
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3">
      {/* Tooltip */}
      <AnimatePresence>
        {isTooltipVisible && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="bg-white shadow-xl rounded-2xl p-4 max-w-[220px] border border-gray-100 relative"
          >
            <button
              onClick={() => setIsTooltipVisible(false)}
              className="absolute -top-2 -right-2 bg-gray-100 hover:bg-gray-200 rounded-full p-1 transition-colors"
            >
              <X className="w-3 h-3 text-gray-500" />
            </button>
            <p className="text-sm text-gray-700 font-medium">
              🍕 Dúvidas? Fale conosco pelo WhatsApp!
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Button */}
      <motion.a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 transition-colors"
      >
        <MessageCircle className="w-7 h-7 text-white" fill="white" />
      </motion.a>

      {/* Pulsing ring */}
      <div className="absolute bottom-0 right-0 w-16 h-16 rounded-full bg-green-500 opacity-20 animate-ping pointer-events-none" />
    </div>
  );
};

export default WhatsAppButton;
