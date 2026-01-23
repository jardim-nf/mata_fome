// src/components/AIWidgetButton.jsx
import React from 'react';
import { IoChatbubbleEllipses, IoClose } from 'react-icons/io5';
import { useAI } from '../context/AIContext';

const AIWidgetButton = () => {
  // 🔥 CORREÇÃO: Usando os nomes corretos do AIContext atualizado
  const { isOpen, setIsOpen, messages } = useAI();

  // Verifica se 'messages' existe antes de ler o length
  const hasUnreadMessages = messages && messages.length > 0;

  return (
    <button
      onClick={() => setIsOpen(!isOpen)} // Usa setIsOpen para alternar
      className={`
        fixed bottom-6 right-6 z-[999] 
        w-16 h-16 rounded-full 
        flex items-center justify-center
        shadow-2xl transition-all duration-300
        hover:scale-110 active:scale-95
        ${isOpen 
          ? 'bg-red-600 text-white' 
          : 'bg-white text-red-600 border-2 border-red-600'
        }
      `}
      aria-label="Assistente Virtual"
    >
      {isOpen ? (
        <IoClose className="text-2xl" />
      ) : (
        <div className="relative">
          <IoChatbubbleEllipses className="text-2xl" />
          {hasUnreadMessages && (
            <span className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full animate-pulse"></span>
          )}
        </div>
      )}
    </button>
  );
};

export default AIWidgetButton;