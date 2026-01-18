// src/components/AIChatAssistant.jsx
import React, { useState, useRef, useEffect } from 'react';
import { IoClose, IoSend, IoTime, IoLogoWhatsapp, IoSparkles, IoRestaurant, IoLogIn } from 'react-icons/io5';
import { useAI } from '../context/AIContext';

const AIChatAssistant = ({ estabelecimento, produtos, onClose, onAddDirect, onCheckout, clienteNome, onRequestLogin, mode = 'widget' }) => {
  const [message, setMessage] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [lastProcessedMsgId, setLastProcessedMsgId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  const { conversation, aiThinking, sendMessage, closeWidget } = useAI();

  // Define se é Visitante ou Cliente
  const primeiroNome = clienteNome ? clienteNome.split(' ')[0] : null;

  // 🔥 MENSAGEM INICIAL INTELIGENTE
  const greetingMessage = primeiroNome 
    ? {
        id: 'greeting-user',
        type: 'ai',
        text: `Oi, ${primeiroNome}! 👋\nO que vamos pedir hoje? 🍔`,
        time: new Date().toISOString()
      }
    : {
        id: 'greeting-guest',
        type: 'ai',
        text: `Olá! 👋 Bem-vindo ao ${estabelecimento?.nome}.\nPara fazer seu pedido, preciso saber quem é você.`,
        isLoginRequest: true, // Ativa o botão de login
        time: new Date().toISOString()
      };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [conversation, isOpen, aiThinking]);
  
  useEffect(() => { 
      if (isOpen) {
          setTimeout(() => inputRef.current?.focus(), 300); 
      }
  }, [isOpen]);

  // Monitora comandos ||ADD|| e ||PAY||
  useEffect(() => {
    if (conversation.length === 0) return;
    const lastMsg = conversation[conversation.length - 1];

    if (lastMsg.type === 'ai' && lastMsg.id !== lastProcessedMsgId) {
        
        const regexAdd = /\|\|ADD:(.*?)\|\|/g;
        let matchAdd;
        while ((matchAdd = regexAdd.exec(lastMsg.text)) !== null) {
            if (onAddDirect) onAddDirect(matchAdd[1].trim());
        }

        if (lastMsg.text.includes('||PAY||')) {
            if (onCheckout) {
                setTimeout(() => {
                    if (mode === 'widget') closeWidget();
                    else onClose?.(); 
                    onCheckout(); 
                }, 1500);
            }
        }
        setLastProcessedMsgId(lastMsg.id);
    }
  }, [conversation, lastProcessedMsgId, onAddDirect, onCheckout, closeWidget, onClose, mode]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || aiThinking) return;
    const textoUsuario = message;
    setMessage('');

    // 🔥 TRAVA DE SEGURANÇA:
    // Se for visitante e tentar falar, abrimos o login na cara dele
    if (!clienteNome && onRequestLogin) {
        onRequestLogin(); 
        // Não impedimos a mensagem de ir (para a IA responder dúvidas), 
        // mas o login vai pular na frente para ele se cadastrar.
    }

    const produtosTexto = produtos 
        ? produtos.slice(0, 50).map(p => `- ${p.nome} (R$ ${p.precoFinal || p.preco})`).join('\n')
        : "Cardápio indisponível.";

    const historicoRecente = conversation.slice(-6).map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.text
    }));

    const context = {
      estabelecimentoNome: estabelecimento?.nome || 'Restaurante',
      horarios: estabelecimento?.horarioFuncionamento ? JSON.stringify(estabelecimento.horarioFuncionamento) : 'Consulte',
      telefone: estabelecimento?.telefone || '',
      whatsapp: estabelecimento?.whatsapp || '',
      endereco: estabelecimento?.endereco ? `${estabelecimento.endereco.rua}, ${estabelecimento.endereco.numero}` : '',
      chavePix: estabelecimento?.chavePix || '',
      produtosPopulares: produtosTexto,
      clienteNome: clienteNome || 'Visitante',
      history: historicoRecente
    };

    await sendMessage(textoUsuario, context);
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      if (mode === 'widget') closeWidget();
      else onClose?.(); 
    }, 300);
  };

  const renderMessageText = (text) => text.replace(/\|\|ADD:.*?\|\|/g, '').replace(/\|\|PAY\|\|/g, ''); 

  if (!isOpen) return null;

  const isCenter = mode === 'center';
  const containerClass = isCenter ? 'fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in' : 'fixed bottom-24 right-6 z-[2000] w-96 h-[600px] max-h-[75vh] animate-slide-up'; 
  const contentClass = isCenter ? 'w-full max-w-2xl h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200' : 'w-full h-full bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200';

  const messagesDisplay = [greetingMessage, ...conversation];

  return (
    <div className={containerClass}>
      <div className={contentClass}>
        
        {/* HEADER */}
        <div className={`text-white p-4 flex items-center justify-between shadow-md ${isCenter ? 'bg-gray-900' : 'bg-gradient-to-r from-red-600 to-red-500'}`}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                {isCenter ? <IoRestaurant className="text-xl" /> : <IoSparkles className="text-xl text-yellow-300" />}
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">{isCenter ? 'Garçom Digital' : 'Assistente IA'}</h3>
              <p className="text-xs opacity-90">{aiThinking ? 'Digitando...' : 'Online agora'}</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-white/20 rounded-full transition"><IoClose size={24} /></button>
        </div>

        {/* CHAT AREA */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 scrollbar-thin">
          
          {messagesDisplay.map((msg) => (
            <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
              <div className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm shadow-sm ${msg.type === 'user' ? (isCenter ? 'bg-gray-900 text-white' : 'bg-red-600 text-white') : 'bg-white text-gray-800 border border-gray-100'}`}>
                <div className="whitespace-pre-wrap leading-relaxed">{renderMessageText(msg.text)}</div>
                
                {/* 🔥 BOTÃO DE LOGIN DENTRO DA MENSAGEM (Só aparece se for visitante) */}
                {msg.isLoginRequest && (
                    <button 
                        onClick={onRequestLogin}
                        className="mt-3 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-green-700 transition shadow-sm w-full animate-pulse"
                    >
                        <IoLogIn size={20} />
                        Entrar ou Cadastrar Agora
                    </button>
                )}

                <div className={`text-[10px] mt-1 text-right opacity-70 ${msg.type === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                    {msg.time ? new Date(msg.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                </div>
              </div>
            </div>
          ))}
          
          {aiThinking && <div className="text-gray-400 text-xs animate-pulse ml-4">O garçom está escrevendo...</div>}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT */}
        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-100 flex gap-3 items-center">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={isCenter ? "Ex: Quero uma pizza de calabresa..." : "Digite sua dúvida..."}
            className="flex-1 bg-gray-100 text-gray-800 border-0 rounded-full px-6 py-4 focus:ring-2 focus:ring-gray-400 focus:bg-white transition-all outline-none"
            disabled={aiThinking}
          />
          <button type="submit" disabled={!message.trim() || aiThinking} className={`w-14 h-14 text-white rounded-full flex items-center justify-center hover:scale-105 transition-all shadow-md ${isCenter ? 'bg-gray-900 hover:bg-black' : 'bg-red-600 hover:bg-red-700'}`}>
            {aiThinking ? <IoTime className="animate-spin" /> : <IoSend size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIChatAssistant;