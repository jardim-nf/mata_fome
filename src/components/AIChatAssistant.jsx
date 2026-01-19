// src/components/AIChatAssistant.jsx
import React, { useState, useRef, useEffect } from 'react';
import { IoClose, IoSend, IoTime, IoSparkles, IoRestaurant, IoLogIn, IoCartOutline, IoMic } from 'react-icons/io5';
import ReactMarkdown from 'react-markdown'; 
import { useAI } from '../context/AIContext';

const AIChatAssistant = ({ estabelecimento, produtos, carrinho, onClose, onAddDirect, onCheckout, clienteNome, onRequestLogin, mode = 'widget' }) => {
  const [message, setMessage] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [showMiniCart, setShowMiniCart] = useState(false); 
  const [isListening, setIsListening] = useState(false); 
  const [showMicHint, setShowMicHint] = useState(true); 

  const processedIdsRef = useRef(new Set());
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const processarEnvioRef = useRef(null);

  const { conversation, aiThinking, sendMessage, closeWidget } = useAI();

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [conversation, aiThinking]);

  // --- FUNÇÕES AUXILIARES ---

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      if (mode === 'widget') closeWidget();
      else onClose?.(); 
    }, 300);
  };

  const renderMessageText = (text) => {
      if (!text) return "";
      return text.replace(/\|\|ADD:.*?\|\|/gi, '').replace(/\|\|PAY\|\|/gi, '').trim();
  };

  // --- LÓGICA DE COMANDOS ---
  useEffect(() => {
    if (conversation.length === 0) return;
    const lastMsg = conversation[conversation.length - 1];

    if (lastMsg.type === 'ai' && !processedIdsRef.current.has(lastMsg.id)) {
        processedIdsRef.current.add(lastMsg.id);
        const regexAdd = /\|\|ADD:(.*?)\|\|/gi; 
        let match;
        while ((match = regexAdd.exec(lastMsg.text)) !== null) {
            if (onAddDirect) onAddDirect(match[1].trim());
        }
        
        if (lastMsg.text.includes('||PAY||')) {
            if (onCheckout) onCheckout(); 
            handleClose(); 
        }
    }
  }, [conversation, onAddDirect, onCheckout]);

  // --- FUNÇÃO DE ENVIO ---
  const processarEnvio = async (textoParaEnviar) => {
    if (!textoParaEnviar.trim() || aiThinking) return;
    
    // Se não tiver cliente logado, pede login e para
    if (!clienteNome && onRequestLogin) { 
        onRequestLogin(); 
        return; 
    }

    const context = {
      estabelecimentoNome: estabelecimento?.nome || 'Restaurante',
      horarios: JSON.stringify(estabelecimento?.horarioFuncionamento),
      produtosPopulares: formatarCardapioParaIA(produtos),
      clienteNome: clienteNome || 'Visitante',
      history: conversation.slice(-6).map(m => ({ role: m.type === 'user' ? 'user' : 'assistant', content: m.text }))
    };
    await sendMessage(textoParaEnviar, context);
  };

  useEffect(() => { processarEnvioRef.current = processarEnvio; });

  // --- CONFIGURAÇÃO DE VOZ ---
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'pt-BR';
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setMessage(transcript);
        
        setTimeout(() => {
            if (processarEnvioRef.current) {
                processarEnvioRef.current(transcript);
                setMessage('');
            }
        }, 500);
      };
      recognitionRef.current = recognition;
    }
  }, []);

  const handleMicClick = () => {
    if (!clienteNome) { onRequestLogin(); return; } // Pede login se tentar usar mic sem conta
    setShowMicHint(false); 
    if (!recognitionRef.current) return alert("Seu navegador não suporta voz.");
    if (isListening) recognitionRef.current.stop();
    else recognitionRef.current.start();
  };

  // --- FORMATAÇÃO ---
  const formatarCardapioParaIA = (lista) => {
    if (!lista || lista.length === 0) return "Cardápio vazio.";
    const agrupado = lista.reduce((acc, p) => {
      const cat = p.categoria || 'Geral'; if (!acc[cat]) acc[cat] = []; acc[cat].push(p); return acc;
    }, {});
    const emojis = { 'Pizzas': '🍕', 'Bebidas': '🥤', 'Sobremesas': '🍦', 'Lanches': '🍔', 'Porções': '🍟' };
    return Object.entries(agrupado).map(([cat, itens]) => {
      const emoji = emojis[cat] || '🍽️';
      const itensTexto = itens.map(p => {
        const ops = p.variacoes?.length > 0 
          ? p.variacoes.map(v => `${v.nome} (R$ ${Number(v.preco).toFixed(2)})`).join(', ')
          : `R$ ${Number(p.precoFinal || p.preco).toFixed(2)}`;
        return `- ${p.nome} | Opções: [${ops}]`;
      }).join('\n');
      return `### ${emoji} ${cat.toUpperCase()}\n${itensTexto}`;
    }).join('\n\n');
  };

  const handleManualSubmit = (e) => { e.preventDefault(); const t = message; setMessage(''); processarEnvio(t); };

  if (!isOpen) return null;
  const isCenter = mode === 'center';

  return (
    <div className={isCenter 
        ? 'fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 p-0 sm:p-4 animate-fade-in' 
        : 'fixed inset-0 z-[5000] bg-white sm:bg-transparent sm:inset-auto sm:bottom-24 sm:right-6 sm:w-96 sm:h-[600px] flex flex-col animate-slide-up'}>
      
      <div className={`w-full h-full bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden relative border border-gray-200 ${!isCenter && 'h-[100dvh] sm:h-full'}`}>
        
        {/* MINI CART */}
        {showMiniCart && (
          <div className="absolute inset-0 z-50 bg-white flex flex-col animate-fade-in">
            <div className="p-4 bg-gray-900 text-white flex justify-between items-center shadow-md">
              <span className="font-bold flex items-center gap-2"><IoCartOutline size={20}/> Seu Pedido</span>
              <button onClick={() => setShowMiniCart(false)}><IoClose size={24}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {carrinho.map(item => (
                <div key={item.cartItemId} className="flex justify-between border-b pb-2 text-sm">
                  <span>{item.qtd}x {item.nome}</span>
                  <span className="font-bold text-green-600">R$ {(item.precoFinal * item.qtd).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="p-4 border-t">
               <button onClick={() => { if(onCheckout) onCheckout(); handleClose(); }} className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg">Confirmar e Pagar</button>
            </div>
          </div>
        )}

        {/* HEADER */}
        <div className={`p-4 flex items-center justify-between text-white shadow-md ${isCenter ? 'bg-gray-900' : 'bg-gradient-to-r from-red-600 to-red-500'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm"><IoRestaurant className="text-xl"/></div>
            <div className="text-left"><p className="font-bold leading-tight">Garçom Digital</p><p className="text-[10px] opacity-80">{isListening ? 'Ouvindo...' : (aiThinking ? 'Digitando...' : 'Online')}</p></div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-white/20 rounded-full transition"><IoClose size={24}/></button>
        </div>

        {/* CHAT */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 scrollbar-thin text-left">
           
           {/* 🔥 MENSAGEM DE BOAS-VINDAS CONDICIONAL */}
           <div className="flex justify-start animate-fade-in">
             <div className="bg-white p-4 rounded-2xl shadow-sm text-sm border border-gray-100 max-w-[85%] leading-relaxed text-gray-800">
               {clienteNome ? (
                 <>
                   Olá, <strong>{clienteNome.split(' ')[0]}</strong>! 👋 <br/>
                   Clique no microfone 🎙️ para falar também!
                 </>
               ) : (
                 <>
                   Olá! 👋 Bem-vindo ao <strong>{estabelecimento?.nome || 'Restaurante'}</strong>.<br/>
                   Para realizar seu pedido, identifique-se abaixo:
                   <button 
                     onClick={onRequestLogin} 
                     className="mt-3 w-full bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-green-700 transition flex items-center justify-center gap-2"
                   >
                     <IoLogIn size={18} /> Entrar ou Cadastrar
                   </button>
                 </>
               )}
             </div>
           </div>

           {conversation.map(msg => (
             <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className={`p-3 rounded-2xl text-sm shadow-sm max-w-[85%] text-left whitespace-pre-wrap ${msg.type === 'user' ? (isCenter ? 'bg-gray-900 text-white' : 'bg-red-600 text-white') : 'bg-white text-gray-800 border border-gray-100'}`}>
                  <ReactMarkdown components={{ strong: ({node, ...props}) => <span className="font-bold text-red-700" {...props} /> }}>
                     {renderMessageText(msg.text)}
                  </ReactMarkdown>
                </div>
             </div>
           ))}
           {aiThinking && <div className="flex ml-4 space-x-1"><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div></div>}
           <div ref={messagesEndRef} />
        </div>

        {/* SUGESTÕES (SÓ SE LOGADO) */}
        {!aiThinking && !isListening && clienteNome && (
          <div className="px-4 py-3 flex gap-2 overflow-x-auto bg-white border-t border-gray-100 scrollbar-hide shrink-0">
            <button onClick={() => setShowMiniCart(true)} className="whitespace-nowrap px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-full shadow-md flex items-center gap-1 active:scale-95 transition-all"><IoCartOutline size={16}/> Ver Carrinho</button>
            {['📜 Cardápio', '🌶️ Sugestão', '🍔 Promoções'].map(s => (
              <button key={s} onClick={() => processarEnvio(s)} className="whitespace-nowrap px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-full border border-gray-200 active:scale-95 transition-all hover:bg-gray-200">{s}</button>
            ))}
          </div>
        )}

        {/* INPUT + MICROFONE */}
        <form onSubmit={handleManualSubmit} className="p-4 bg-white border-t border-gray-100 flex gap-2 items-center shrink-0 safe-area-bottom relative">
          
          {/* 🔥 DICA MICROFONE (APENAS SE LOGADO) */}
          {showMicHint && !isListening && clienteNome && (
            <div className="absolute left-16 top-1/2 -translate-y-1/2 z-50 pointer-events-none animate-pulse">
                <div className="bg-gray-800 text-white text-xs px-3 py-2 rounded-xl shadow-lg relative font-bold whitespace-nowrap flex items-center">
                    <div className="absolute top-1/2 -translate-y-1/2 -left-1 w-3 h-3 bg-gray-800 rotate-45"></div>
                    👈 Toque para falar!
                </div>
            </div>
          )}

          <button 
            type="button" 
            onClick={handleMicClick} 
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md border-2 
              ${isListening 
                ? 'bg-red-500 text-white border-red-300 animate-pulse scale-110' 
                : 'bg-red-50 text-red-500 border-red-100 hover:bg-red-100'}`}
          >
            <IoMic size={22} />
          </button>
          
          <input 
            ref={inputRef} 
            type="text" 
            value={isListening ? 'Ouvindo...' : message} 
            onChange={e => setMessage(e.target.value)} 
            placeholder={clienteNome ? (isListening ? "" : "Digite ou fale...") : "Faça login para pedir"} 
            disabled={isListening || !clienteNome} // 🔥 Bloqueia se não logado
            className={`flex-1 bg-gray-100 text-gray-800 border-0 rounded-full px-5 py-3.5 text-base focus:ring-2 focus:ring-gray-300 focus:bg-white transition-all outline-none ${isListening ? 'italic text-gray-500' : ''}`} 
          />
          
          <button type="submit" disabled={!message.trim() || aiThinking || isListening || !clienteNome} className={`w-12 h-12 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all ${isCenter ? 'bg-gray-900' : 'bg-red-600'}`}>
            {aiThinking ? <IoTime className="animate-spin" /> : <IoSend size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIChatAssistant;