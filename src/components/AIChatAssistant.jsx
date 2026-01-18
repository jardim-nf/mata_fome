// src/components/AIChatAssistant.jsx
import React, { useState, useRef, useEffect } from 'react';
import { IoClose, IoSend, IoTime, IoLogoWhatsapp, IoSparkles, IoRestaurant, IoLogIn, IoCartOutline } from 'react-icons/io5';
import ReactMarkdown from 'react-markdown'; 
import { useAI } from '../context/AIContext';

const AIChatAssistant = ({ estabelecimento, produtos, carrinho, onClose, onAddDirect, onCheckout, clienteNome, onRequestLogin, mode = 'widget' }) => {
  const [message, setMessage] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [showMiniCart, setShowMiniCart] = useState(false); 
  
  // 🛡️ TRAVA CONTRA DUPLICIDADE: Impede adicionar 3x o mesmo item
  const processedIdsRef = useRef(new Set());
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  const checkoutRef = useRef(onCheckout);
  useEffect(() => { checkoutRef.current = onCheckout; }, [onCheckout]);
  
  const { conversation, aiThinking, sendMessage, closeWidget } = useAI();

  const primeiroNome = clienteNome ? clienteNome.split(' ')[0] : null;

  const greetingMessage = primeiroNome 
    ? { id: 'greeting-user', type: 'ai', text: `Oi, **${primeiroNome}**! 👋\nO que vamos pedir hoje? 🍔`, time: new Date().toISOString() }
    : { id: 'greeting-guest', type: 'ai', text: `Olá! 👋 Bem-vindo ao **${estabelecimento?.nome || 'Restaurante'}**.\nPara fazer seu pedido, preciso saber quem é você.`, isLoginRequest: true, time: new Date().toISOString() };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, isOpen, aiThinking]);
  
  useEffect(() => { 
      if (isOpen) {
          setTimeout(() => inputRef.current?.focus(), 300); 
      }
  }, [isOpen]);

  // 🔥 LÓGICA DE COMANDOS COM TRAVA DE SEGURANÇA
  useEffect(() => {
    if (conversation.length === 0) return;
    const lastMsg = conversation[conversation.length - 1];

    if (lastMsg.type === 'ai' && !processedIdsRef.current.has(lastMsg.id)) {
        processedIdsRef.current.add(lastMsg.id);

        const regexAdd = /\|\|ADD:(.*?)\|\|/g;
        let matchAdd;
        while ((matchAdd = regexAdd.exec(lastMsg.text)) !== null) {
            if (onAddDirect) onAddDirect(matchAdd[1].trim());
        }

        if (lastMsg.text.includes('||PAY||')) {
            setShowMiniCart(true); 
        }
    }
  }, [conversation, onAddDirect]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!message.trim() || aiThinking) return;
    
    const textoUsuario = message;
    setMessage('');

    setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
    }, 10);

    if (!clienteNome && onRequestLogin) onRequestLogin(); 

    const context = {
      estabelecimentoNome: estabelecimento?.nome || 'Restaurante',
      horarios: estabelecimento?.horarioFuncionamento ? JSON.stringify(estabelecimento.horarioFuncionamento) : 'Consulte',
      produtosPopulares: produtos?.slice(0, 80).map(p => `- ${p.nome} (R$ ${p.precoFinal || p.preco})`).join('\n'),
      clienteNome: clienteNome || 'Visitante',
      history: conversation.slice(-6).map(msg => ({ role: msg.type === 'user' ? 'user' : 'assistant', content: msg.text }))
    };

    await sendMessage(textoUsuario, context);
  };

  // 🔥 FUNÇÃO PARA FECHAR IA E TRAZER O MODAL DE PAGAMENTO
  const handleConfirmarEPagar = () => {
    setShowMiniCart(false); 
    setIsOpen(false);
    
    // Pequeno atraso para fechar a interface da IA antes de abrir o modal do site
    setTimeout(() => {
        if (mode === 'widget') closeWidget();
        else onClose?.(); 
        
        // Dispara a função que abre o seu ModalPagamento.jsx real
        if (checkoutRef.current) checkoutRef.current(); 
    }, 300);
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      if (mode === 'widget') closeWidget();
      else onClose?.(); 
    }, 300);
  };

  const renderMessageText = (text) => {
      return text
        .replace(/\|\|ADD:.*?\|\|/g, '')
        .replace(/\|\|PAY\|\|/g, '')
        .replace(/-- Qtd:\s*\d+/g, '') 
        .replace(/-- Opcao:.*?(?=--|$)/g, '')
        .replace(/\n\s*\n/g, '\n')
        .trim();
  };

  if (!isOpen) return null;

  const isCenter = mode === 'center';
  const containerClass = isCenter ? 'fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in' : 'fixed bottom-24 right-6 z-[2000] w-96 h-[600px] max-h-[75vh] animate-slide-up'; 
  const contentClass = isCenter ? 'w-full max-w-2xl h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200' : 'w-full h-full bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200';

  // 🔥 Sincroniza o total com o carrinho real
  const subtotal = carrinho?.reduce((acc, item) => acc + (Number(item.precoFinal) * item.qtd), 0) || 0;
  const messagesDisplay = [greetingMessage, ...conversation];

  return (
    <div className={containerClass}>
      <div className={`${contentClass} relative`}>
        
        {/* 🔥 TELA SOBREPOSTA DO CARRINHO (DESIGN MANTIDO) */}
        {showMiniCart && (
            <div className="absolute inset-0 z-[50] bg-white flex flex-col animate-fade-in text-left">
                <div className="p-4 bg-gray-900 text-white flex justify-between items-center shadow-md">
                    <div className="flex items-center gap-2">
                        <IoCartOutline size={22}/> 
                        <span className="font-bold text-lg">Seu Pedido</span>
                    </div>
                    <button onClick={() => setShowMiniCart(false)} className="p-2 hover:bg-white/20 rounded-full transition">
                        <IoClose size={24}/>
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 scrollbar-thin text-left">
                    {(!carrinho || carrinho.length === 0) ? (
                        <div className="text-center py-20 text-gray-400">Seu carrinho está vazio.</div>
                    ) : (
                        carrinho.map((item) => (
                            <div key={item.cartItemId} className="flex justify-between items-start bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                <div className="flex-1 pr-2 text-left">
                                    <p className="font-bold text-sm text-gray-800 leading-tight">{item.nome}</p>
                                    <p className="text-xs text-gray-400 mt-1">{item.qtd}x R$ {Number(item.precoFinal).toFixed(2)}</p>
                                </div>
                                <p className="font-bold text-sm text-green-600">R$ {(Number(item.precoFinal) * item.qtd).toFixed(2)}</p>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-5 border-t border-gray-100 bg-white shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <span className="font-medium text-gray-500 text-sm">Valor total:</span>
                        <span className="text-2xl font-black text-gray-900">R$ {subtotal.toFixed(2)}</span>
                    </div>
                    {/* 🔥 ACIONA O MODAL DE PAGAMENTO REAL */}
                    <button 
                        onClick={handleConfirmarEPagar}
                        className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-green-700 transition-all shadow-md active:scale-95"
                    >
                        Confirmar e Pagar
                    </button>
                </div>
            </div>
        )}

        {/* HEADER (DESIGN MANTIDO) */}
        <div className={`text-white p-4 flex items-center justify-between shadow-md ${isCenter ? 'bg-gray-900' : 'bg-gradient-to-r from-red-600 to-red-500'}`}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                {isCenter ? <IoRestaurant className="text-xl" /> : <IoSparkles className="text-xl text-yellow-300" />}
            </div>
            <div className="text-left text-white">
              <h3 className="font-bold text-lg leading-tight">{isCenter ? 'Garçom Digital' : 'Assistente IA'}</h3>
              <p className="text-xs opacity-90">{aiThinking ? 'Digitando...' : 'Online agora'}</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-white/20 rounded-full transition"><IoClose size={24} /></button>
        </div>

        {/* CHAT AREA (DESIGN MANTIDO) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 scrollbar-thin text-left">
          {messagesDisplay.map((msg) => (
            <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              <div className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm shadow-sm ${msg.type === 'user' ? (isCenter ? 'bg-gray-900 text-white text-left' : 'bg-red-600 text-white text-left') : 'bg-white text-gray-800 border border-gray-100 text-left'}`}>
                <div className="text-sm leading-relaxed text-left">
                  {msg.type === 'user' ? (
                     <div className="whitespace-pre-wrap">{renderMessageText(msg.text)}</div>
                  ) : (
                     <ReactMarkdown components={{ strong: ({node, ...props}) => <span className="font-bold text-red-700" {...props} /> }}>
                        {renderMessageText(msg.text)}
                     </ReactMarkdown>
                  )}
                </div>
                {msg.isLoginRequest && (
                    <button onClick={onRequestLogin} className="mt-3 bg-green-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-green-700 transition w-full shadow-md animate-pulse flex items-center justify-center gap-2"><IoLogIn size={20} /> Entrar Agora</button>
                )}
                <div className={`text-[10px] mt-1 text-right opacity-70 ${msg.type === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                    {msg.time ? new Date(msg.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                </div>
              </div>
            </div>
          ))}
          {aiThinking && <div className="flex items-center space-x-1 ml-4 mt-2"><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'0.2s'}}></div></div>}
          <div ref={messagesEndRef} />
        </div>

        {/* CHIPS (DESIGN MANTIDO) */}
        {!aiThinking && (
            <div className="px-4 pb-2 pt-2 flex gap-2 overflow-x-auto scrollbar-hide bg-white border-t border-gray-100">
                <button onClick={() => setShowMiniCart(true)} className="whitespace-nowrap px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-full shadow-sm flex items-center gap-1 active:scale-95 transition-all"><IoCartOutline size={14}/> Ver Carrinho</button>
                {['📜 Cardápio', '🌶️ Sugestão', '🍔 Promoções'].map((s) => (<button key={s} onClick={() => setMessage(s)} className="whitespace-nowrap px-3 py-1.5 bg-gray-50 text-gray-600 text-xs font-medium rounded-full border border-gray-200">{s}</button>))}
            </div>
        )}

        {/* INPUT (DESIGN MANTIDO) */}
        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-100 flex gap-3 items-center">
          <input ref={inputRef} type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={isCenter ? "Ex: Quero uma pizza de calabresa..." : "Digite sua dúvida..."} className="flex-1 bg-gray-100 text-gray-800 border-0 rounded-full px-6 py-4 focus:ring-2 focus:ring-gray-400 focus:bg-white transition-all outline-none" />
          <button type="submit" disabled={!message.trim() || aiThinking} className={`w-14 h-14 text-white rounded-full flex items-center justify-center hover:scale-105 transition-all shadow-md ${isCenter ? 'bg-gray-900' : 'bg-red-600 hover:bg-red-700'}`}>
            {aiThinking ? <IoTime className="animate-spin" /> : <IoSend size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIChatAssistant;