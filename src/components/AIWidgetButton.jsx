import React from 'react';
import { IoChatbubbleEllipses, IoClose } from 'react-icons/io5';
import { useAI } from '../context/AIContext';

const AIWidgetButton = ({ bottomOffset = '24px' }) => {
  const { isWidgetOpen, toggleWidget, conversation } = useAI();
  const hasUnreadMessages = conversation && conversation.length > 0;

  return (
    <button
      onClick={toggleWidget}
      style={{ bottom: bottomOffset }} // 🔥 Posição dinâmica
      className={`fixed right-6 z-[999] w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${isWidgetOpen ? 'bg-red-600 text-white' : 'bg-white text-red-600 border-2 border-red-600'}`}
      aria-label="Assistente Virtual"
    >
      {isWidgetOpen ? <IoClose className="text-2xl" /> : (
        <div className="relative">
          <IoChatbubbleEllipses className="text-2xl" />
          {hasUnreadMessages && <span className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full animate-pulse"></span>}
        </div>
      )}
    </button>
  );
};
export default AIWidgetButton;