import React, { useState, useRef, useEffect } from 'react';
import {
  IoClose,
  IoSend,
  IoTime,
  IoRestaurant,
  IoCartOutline,
  IoMic,
  IoPerson
} from 'react-icons/io5';
import ReactMarkdown from 'react-markdown';
import { useAI } from '../context/AIContext';

// ============================================================================
// 1. DETECÇÃO DE iOS (CRÍTICO)
// ============================================================================
const isIOS =
  typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent);

// ============================================================================
// 2. CONFIGURAÇÕES & REGRAS
// ============================================================================
const SYSTEM_INSTRUCTION = (nomeLoja) => `
🚨 VOCÊ É O JUCLEILDO, GARÇOM DO ${nomeLoja}.

⚠️ REGRA VISUAL:
- Nunca alinhar preços com pontinhos
- Produto em uma linha, opções abaixo

⚡ COMANDO OCULTO:
||ADD: Nome -- Opcao: Variação -- Obs: N/A -- Qtd: 1||
`;

const cleanText = (text) =>
  text
    ?.replace(/\|\|ADD:.*?\|\|/gi, '')
    .replace(/\|\|PAY\|\|/gi, '')
    .trim() || '';

// ============================================================================
// 3. MINI CART
// ============================================================================
const MiniCart = ({ itens, onClose, onCheckout }) => (
  <div className="absolute inset-0 z-50 bg-gray-50 flex flex-col rounded-[2rem] overflow-hidden">
    <div className="p-5 bg-white border-b flex justify-between items-center">
      <strong className="text-xl">🛍️ Sacola</strong>
      <button onClick={onClose}>
        <IoClose size={26} />
      </button>
    </div>

    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {itens.length === 0 ? (
        <div className="text-center text-gray-400 mt-10">
          <IoCartOutline size={48} />
          <p>Vazia</p>
        </div>
      ) : (
        itens.map((item) => (
          <div
            key={item.cartItemId}
            className="bg-white p-4 rounded-xl border flex justify-between"
          >
            <div>
              <strong>{item.nome}</strong>
              {item.variacaoSelecionada && (
                <div className="text-xs text-gray-500">
                  {item.variacaoSelecionada.nome}
                </div>
              )}
              <div className="text-xs">Qtd: {item.qtd}</div>
            </div>
            <strong className="text-green-600">
              R$ {(item.precoFinal * item.qtd).toFixed(2)}
            </strong>
          </div>
        ))
      )}
    </div>

    <div className="p-4 bg-white border-t">
      <button
        onClick={onCheckout}
        className="w-full bg-green-600 text-white py-4 rounded-xl font-bold"
      >
        Concluir Pedido
      </button>
    </div>
  </div>
);

// ============================================================================
// 4. HEADER
// ============================================================================
const ChatHeader = ({ onClose, statusText }) => (
  <div className="px-5 py-4 flex justify-between items-center bg-white border-b pt-safe">
    <div>
      <strong className="block text-lg">Jucleildo</strong>
      <span className="text-xs text-gray-500">{statusText}</span>
    </div>
    <button onClick={onClose}>
      <IoClose size={24} />
    </button>
  </div>
);

// ============================================================================
// 5. COMPONENTE PRINCIPAL
// ============================================================================
const AIChatAssistant = ({
  estabelecimento,
  produtos,
  carrinho,
  onClose,
  onAddDirect,
  onCheckout,
  clienteNome,
  onRequestLogin,
  mode = 'center'
}) => {
  const [message, setMessage] = useState('');
  const [showMiniCart, setShowMiniCart] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef(null);
  const processedIdsRef = useRef(new Set());
  const messagesEndRef = useRef(null);

  const { conversation, aiThinking, sendMessage, closeWidget } = useAI();

  // ==========================================================================
  // 🎤 SpeechRecognition — DESATIVADO NO iOS
  // ==========================================================================
  useEffect(() => {
    if (typeof window === 'undefined' || isIOS) return;

    const SpeechRec =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;

    const rec = new SpeechRec();
    rec.lang = 'pt-BR';
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => setIsListening(true);
    rec.onend = () => setIsListening(false);
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setMessage(transcript);
      setTimeout(() => handleSend(transcript), 500);
    };

    recognitionRef.current = rec;
  }, []);

  const toggleMic = () => {
    if (isIOS) {
      alert('🎤 Microfone não disponível no iPhone');
      return;
    }
    recognitionRef.current?.start();
  };

  // ==========================================================================
  // PROCESSA ||ADD||
  // ==========================================================================
  useEffect(() => {
    if (!conversation.length) return;
    const last = conversation[conversation.length - 1];

    if (last.type === 'ai' && !processedIdsRef.current.has(last.id)) {
      processedIdsRef.current.add(last.id);

      const regex = /\|\|ADD:(.*?)\|\|/gi;
      let match;
      while ((match = regex.exec(last.text)) !== null) {
        onAddDirect?.(match[1].trim());
      }

      if (last.text.includes('||PAY||')) {
        onCheckout?.();
        handleClose();
      }
    }
  }, [conversation]);

  const handleSend = async (text) => {
    if (!text?.trim() || aiThinking) return;
    if (!clienteNome) return onRequestLogin?.();

    setMessage('');

    const context = {
      estabelecimentoNome: estabelecimento?.nome || 'Restaurante',
      produtosPopulares:
        SYSTEM_INSTRUCTION(estabelecimento?.nome) +
        '\n' +
        (produtos || ''),
      history: conversation.slice(-6).map((m) => ({
        role: m.type === 'user' ? 'user' : 'assistant',
        content: m.text
      }))
    };

    await sendMessage(text, context);
  };

  const handleClose = () => {
    if (mode === 'widget') closeWidget();
    else onClose?.();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, aiThinking]);

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 ${
        isIOS ? 'bg-black/70' : 'bg-black/60 backdrop-blur-sm'
      }`}
    >
      <div
        className="w-full max-w-lg bg-white rounded-[2rem] shadow-2xl flex flex-col overflow-hidden"
        style={{ height: '85dvh', maxHeight: '85vh' }}
      >
        {showMiniCart && (
          <MiniCart
            itens={carrinho}
            onClose={() => setShowMiniCart(false)}
            onCheckout={() => {
              onCheckout?.();
              handleClose();
            }}
          />
        )}

        <ChatHeader
          onClose={handleClose}
          statusText={
            isListening ? 'Ouvindo...' : aiThinking ? 'Digitando...' : 'Online'
          }
        />

        {/* MENSAGENS */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
          {conversation.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.type === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`p-3 rounded-2xl max-w-[85%] ${
                  msg.type === 'user'
                    ? 'bg-green-600 text-white'
                    : 'bg-white border'
                }`}
              >
                <ReactMarkdown>{cleanText(msg.text)}</ReactMarkdown>
              </div>
            </div>
          ))}

          {aiThinking && (
            <div className="text-gray-400 text-sm">Digitando...</div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* INPUT */}
        <div className="p-4 border-t bg-white pb-safe">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(message);
            }}
            className="flex gap-2"
          >
            <button
              type="button"
              onClick={toggleMic}
              disabled={isIOS}
              className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center"
              title={
                isIOS ? 'Microfone indisponível no iOS' : 'Falar'
              }
            >
              <IoMic />
            </button>

            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                clienteNome ? 'Digite seu pedido...' : 'Faça login'
              }
              disabled={!clienteNome}
              className="flex-1 bg-gray-50 rounded-full px-4"
            />

            <button
              type="submit"
              disabled={!message.trim()}
              className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center"
            >
              {aiThinking ? <IoTime /> : <IoSend />}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        .pt-safe { padding-top: env(safe-area-inset-top); }
      `}</style>
    </div>
  );
};

export default AIChatAssistant;
