import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAI } from '../../context/AIContext';
import { SYSTEM_INSTRUCTION, formatarCardapio, parseAddCommand } from './utils/aiUtils';
import { useDeliveryFlow } from './hooks/useDeliveryFlow';
import MiniCart from './MiniCart';
import ChatHeader from './ChatHeader';
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';

const AIChatAssistant = ({
  estabelecimento, produtos, carrinho, onClose, onAddDirect, onCheckout,
  clienteNome, onRequestLogin, mode = 'center',
  taxaEntrega, enderecoAtual, isRetirada, onSetDeliveryMode, onUpdateAddress
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [showMiniCart, setShowMiniCart] = useState(false);
  const processedIdsRef = useRef(new Set());

  const { conversation, aiThinking, sendMessage, closeWidget } = useAI();

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => mode === 'widget' ? closeWidget() : onClose?.(), 300);
  }, [mode, closeWidget, onClose]);

  const { conversationStep, localMessages, iniciarFluxoEntrega, processarFluxoEntrega } = useDeliveryFlow({
    clienteNome, enderecoAtual, taxaEntrega,
    onSetDeliveryMode, onUpdateAddress, onCheckout,
    onRequestLogin, onClose: handleClose
  });

  // Intercepta comandos da IA (ADD e PAY)
  useEffect(() => {
    if (!conversation.length) return;
    const lastMsg = conversation[conversation.length - 1];
    if (lastMsg.type === 'ai' && !processedIdsRef.current.has(lastMsg.id)) {
      processedIdsRef.current.add(lastMsg.id);

      const regexAdd = /\|\|ADD:([\s\S]*?)\|\|/gi;
      let match;
      while ((match = regexAdd.exec(lastMsg.text)) !== null) {
        if (onAddDirect) onAddDirect(parseAddCommand(match[1].trim()));
      }

      if (lastMsg.text.includes('||PAY||')) iniciarFluxoEntrega();
    }
  }, [conversation, onAddDirect, iniciarFluxoEntrega]);

  const handleSend = useCallback(async (text, setMessage) => {
    if (!text?.trim() || aiThinking) return;

    // Fluxo de entrega (bypass backend)
    if (conversationStep !== 'IDLE') {
      processarFluxoEntrega(text, setMessage);
      return;
    }

    if (!clienteNome && onRequestLogin) { handleClose(); onRequestLogin(); return; }

    setMessage('');

    const listaCategorias = [...new Set(produtos.map(p => p.categoria || 'Geral'))]
      .map(c => `* 🍽️ ${c}`)
      .join('\n');

    await sendMessage(text, {
      estabelecimentoNome: estabelecimento?.nome || 'Restaurante',
      produtosPopulares: SYSTEM_INSTRUCTION(estabelecimento?.nome, listaCategorias) +
        '\n\n📋 DETALHES TÉCNICOS (CONSULTA):\n' + formatarCardapio(produtos),
      clienteNome: clienteNome || 'Visitante',
      history: conversation.slice(-6).map(m => ({
        role: m.type === 'user' ? 'user' : 'assistant',
        content: m.text
      }))
    });
  }, [aiThinking, conversationStep, clienteNome, produtos, estabelecimento, conversation, sendMessage, processarFluxoEntrega, onRequestLogin, handleClose]);

  const todasMensagens = [...conversation, ...localMessages].sort((a, b) => a.id - b.id);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg h-[85vh] bg-white rounded-[2rem] shadow-2xl flex flex-col relative overflow-hidden ring-1 ring-white/20">

        {showMiniCart && (
          <MiniCart
            itens={carrinho}
            onClose={() => setShowMiniCart(false)}
            onCheckout={() => { onCheckout?.(); handleClose(); }}
          />
        )}

        <ChatHeader
          onClose={handleClose}
          statusText={aiThinking ? 'Digitando...' : 'Online'}
        />

        <ChatMessages
          mensagens={todasMensagens}
          aiThinking={aiThinking}
          clienteNome={clienteNome}
          onRequestLogin={onRequestLogin}
          onClose={handleClose}
        />

        <ChatInput
          onSend={handleSend}
          aiThinking={aiThinking}
          clienteNome={clienteNome}
          conversationStep={conversationStep}
          carrinho={carrinho}
          onShowCart={() => setShowMiniCart(true)}
          onRequestLogin={onRequestLogin}
          onClose={handleClose}
        />
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
        .animate-slide-up { animation: slideUp 0.3s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default AIChatAssistant;