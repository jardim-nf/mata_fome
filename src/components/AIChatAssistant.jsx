// components/AIChatAssistant.jsx - VERSÃO DINÂMICA
import React, { useState, useRef, useEffect } from 'react';
import { IoClose, IoSend, IoChatbubbleEllipses, IoTime, IoHelpCircle } from 'react-icons/io5';
import { useAI } from '../context/AIContext';

const AIChatAssistant = ({ estabelecimentoInfo, onClose, mode = 'widget' }) => {
  const [message, setMessage] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const { conversation, aiThinking, sendMessage, clearConversation, closeWidget } = useAI();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || aiThinking) return;

    const context = {
      estabelecimentoNome: estabelecimentoInfo?.nome || 'nosso estabelecimento',
      horarios: estabelecimentoInfo?.horarioFuncionamento ? 
        Object.entries(estabelecimentoInfo.horarioFuncionamento)
          .map(([dia, horario]) => `${dia}: ${horario.abertura} - ${horario.fechamento}`)
          .join(' | ') : 'Segunda a Domingo: 10h às 22h',
      telefone: estabelecimentoInfo?.telefone || '(11) 9999-9999',
      whatsapp: estabelecimentoInfo?.whatsapp || '(11) 98888-8888',
      endereco: estabelecimentoInfo?.endereco ? 
        `${estabelecimentoInfo.endereco.rua}, ${estabelecimentoInfo.endereco.numero} - ${estabelecimentoInfo.endereco.bairro}` : 
        'Rua Principal, 123 - Centro',
      chavePix: estabelecimentoInfo?.chavePix || 'CNPJ: 12.345.678/0001-90',
      produtosPopulares: '• X-Burger Especial 🍔\n• Pizza Calabresa 🍕\n• Refrigerante 2L 🥤\n• Brownie com Sorvete 🍦'
    };

    await sendMessage(message, context);
    setMessage('');
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      if (mode === 'widget') {
        closeWidget(); // Fecha o widget
      } else {
        onClose?.(); // Fecha a página standalone
      }
    }, 300);
  };

  const quickReplies = [
    "Qual o horário de funcionamento?",
    "Quais as formas de pagamento?",
    "Qual o tempo de entrega?",
    "Vocês têm delivery?",
    "Preciso falar com alguém",
    "Cardápio completo"
  ];

  const handleQuickReply = (reply) => {
    setMessage(reply);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
  };

  if (!isOpen) return null;

  // 🔥 DIFERENÇAS ENTRE MODO WIDGET E PÁGINA
  const containerClass = mode === 'widget' 
    ? 'fixed bottom-20 right-6 z-[998] w-96 h-[500px] max-h-[80vh]'
    : 'fixed inset-0 bg-black bg-opacity-50 flex items-end justify-end z-[1000] p-4 md:p-6';

  const contentClass = mode === 'widget'
    ? 'w-full h-full rounded-2xl shadow-2xl flex flex-col'
    : 'bg-white rounded-2xl shadow-2xl w-full max-w-md h-[80vh] max-h-[600px] flex flex-col';

  return (
    <div className={containerClass}>
      <div className={contentClass}>
        {/* Header */}
        <div className="bg-red-600 text-white p-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <IoChatbubbleEllipses className="text-2xl" />
              <div>
                <h3 className="font-bold">Assistente Virtual</h3>
                <p className="text-sm opacity-90">{estabelecimentoInfo?.nome || 'Estabelecimento'}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-white hover:text-gray-200 transition p-1 rounded-full hover:bg-red-700"
            >
              <IoClose className="text-xl" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {conversation.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <IoHelpCircle className="text-4xl mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Como posso ajudar você hoje?</p>
              <p className="text-sm mt-1">Estou aqui para tirar todas suas dúvidas! 😊</p>
            </div>
          )}

          {conversation.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.type === 'user'
                    ? 'bg-red-600 text-white rounded-br-none'
                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none shadow-sm'
                }`}
              >
                <p className="text-sm whitespace-pre-line">{msg.text}</p>
                <p className={`text-xs mt-2 ${
                  msg.type === 'user' ? 'text-red-100' : 'text-gray-400'
                }`}>
                  {msg.time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}

          {aiThinking && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                <div className="flex items-center space-x-2 text-gray-600">
                  <IoTime className="animate-pulse" />
                  <span className="text-sm">Digitando...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Replies */}
        {conversation.length === 0 && (
          <div className="px-4 pb-3 border-t border-gray-200 pt-3">
            <p className="text-xs text-gray-500 mb-2 font-medium">Perguntas rápidas:</p>
            <div className="flex flex-wrap gap-2">
              {quickReplies.map((reply, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickReply(reply)}
                  className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-full text-xs hover:bg-gray-50 transition hover:border-gray-400"
                >
                  {reply}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white rounded-b-2xl">
          <div className="flex space-x-3">
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="flex-1 border border-gray-300 rounded-full px-4 py-3 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-sm"
              disabled={aiThinking}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!message.trim() || aiThinking}
              className="bg-red-600 text-white rounded-full w-12 h-12 flex items-center justify-center hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              <IoSend className="text-lg" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AIChatAssistant;