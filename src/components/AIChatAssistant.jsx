import React, { useState, useRef, useEffect } from 'react';
import { IoClose, IoSend, IoTime, IoRestaurant, IoLogIn, IoCartOutline, IoMic } from 'react-icons/io5';
import ReactMarkdown from 'react-markdown'; 
import { useAI } from '../context/AIContext';

// ============================================================================
// 1. ESTILOS EXTRAS (Barra de rolagem invisível + Correção de Zoom)
// ============================================================================
const GlobalStyles = () => (
  <style>{`
    .scrollbar-hide::-webkit-scrollbar { display: none; }
    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
    /* Previne zoom em inputs no iOS */
    input, textarea, select { font-size: 16px !important; }
  `}</style>
);

// ============================================================================
// 2. CONFIGURAÇÕES & PROMPT
// ============================================================================

// Aumentei um pouco a largura máxima no mobile para aproveitar a tela
const TAMANHO_WIDGET = "w-[95vw] max-w-[400px] h-[85vh] max-h-[650px] sm:w-96 sm:h-[600px]"; 

const SYSTEM_INSTRUCTION = (nomeLoja) => `
  🚨 INSTRUÇÃO SUPREMA: VOCÊ É O JUCLEILDO.
  1. IDENTIDADE: Garçom virtual do ${nomeLoja}.
  2. IMPORTANTE: Se o produto tiver variações (ex: sabores, tamanhos), LISTE O PREÇO DE CADA UMA.
  3. FORMATO: 
     - Use negrito para destaques.
     - Seja direto e simpático.
`;

const formatarCardapio = (lista) => {
  if (!lista?.length) return "Cardápio vazio.";
  
  const agrupado = lista.reduce((acc, p) => {
    const cat = p.categoria || 'Geral'; if (!acc[cat]) acc[cat] = []; acc[cat].push(p); return acc;
  }, {});
  
  const emojis = { 'Pizzas': '🍕', 'Bebidas': '🥤', 'Sobremesas': '🍦', 'Lanches': '🍔', 'Porções': '🍟' };
  
  return Object.entries(agrupado).map(([cat, itens]) => {
    const itensTexto = itens.map(p => {
      if (p.variacoes?.length > 0) {
          const vars = p.variacoes.map(v => {
             const precoVar = v.preco ? Number(v.preco).toFixed(2) : '0.00';
             return `${v.nome} (R$${precoVar})`;
          }).join(', ');
          return `- **${p.nome}**: ${vars}`;
      }
      const preco = Number(p.precoFinal || p.preco).toFixed(2);
      return `- **${p.nome}** (R$ ${preco})`;
    }).join('\n');
    
    return `### ${emojis[cat] || '🍽️'} ${cat.toUpperCase()}\n${itensTexto}`;
  }).join('\n\n'); 
};

const cleanText = (text) => text?.replace(/\|\|ADD:.*?\|\|/gi, '').replace(/\|\|PAY\|\|/gi, '').trim() || "";

// ============================================================================
// 3. HOOK DE VOZ
// ============================================================================
const useVoiceInput = (onResult) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      const rec = new SpeechRec();
      rec.lang = 'pt-BR';
      rec.continuous = false;
      rec.interimResults = false;
      rec.onstart = () => setIsListening(true);
      rec.onend = () => setIsListening(false);
      rec.onresult = (e) => onResult(e.results[0][0].transcript);
      recognitionRef.current = rec;
    }
  }, [onResult]);

  const toggleMic = () => {
    if (!recognitionRef.current) return alert("Navegador sem suporte a voz.");
    isListening ? recognitionRef.current.stop() : recognitionRef.current.start();
  };

  return { isListening, toggleMic };
};

// ============================================================================
// 4. SUB-COMPONENTES
// ============================================================================

const MicTooltip = () => (
  <div className="absolute bottom-20 left-4 z-50 animate-bounce pointer-events-none">
    <div className="bg-gray-800 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg relative whitespace-nowrap">
      👇 Toque para falar!
      <div className="absolute -bottom-1 left-4 w-3 h-3 bg-gray-800 rotate-45"></div>
    </div>
  </div>
);

const MiniCart = ({ itens, onClose, onCheckout }) => (
  <div className="absolute inset-0 z-50 bg-gray-50 flex flex-col animate-fade-in">
    <div className="p-4 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm">
      <span className="font-bold text-gray-800 flex items-center gap-2 text-xl"><IoCartOutline/> Seu Pedido</span>
      <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full text-gray-600 active:scale-90 transition"><IoClose size={24}/></button>
    </div>
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {itens.length === 0 ? <p className="text-gray-400 text-center mt-10 text-lg">Carrinho vazio.</p> : itens.map(item => (
        <div key={item.cartItemId} className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900 text-base">{item.nome}</span>
            <span className="text-sm text-gray-500">Qtd: {item.qtd}</span>
          </div>
          <span className="font-bold text-green-600 text-xl">R$ {(item.precoFinal * item.qtd).toFixed(2)}</span>
        </div>
      ))}
    </div>
    <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.1)]">
       <button onClick={onCheckout} className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-xl shadow-lg active:scale-95 transition-transform flex justify-center items-center gap-2">
         <span>✅ Fechar Pedido</span>
       </button>
    </div>
  </div>
);

const ChatHeader = ({ onClose, statusText }) => (
  <div className="px-5 py-4 flex items-center justify-between bg-white border-b border-gray-100 shadow-sm shrink-0">
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
        <IoRestaurant className="text-2xl"/>
      </div>
      <div className="text-left">
        <p className="font-bold text-gray-900 text-lg leading-none">Jucleildo</p> 
        <p className="text-sm text-green-600 font-medium mt-0.5">{statusText}</p>
      </div>
    </div>
    <button onClick={onClose} className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition active:scale-90"><IoClose size={24}/></button>
  </div>
);

// ============================================================================
// 5. COMPONENTE PRINCIPAL
// ============================================================================

const AIChatAssistant = ({ estabelecimento, produtos, carrinho, onClose, onAddDirect, onCheckout, clienteNome, onRequestLogin, mode = 'widget' }) => {
  const [message, setMessage] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [showMiniCart, setShowMiniCart] = useState(false);
  const [showMicHint, setShowMicHint] = useState(true);
  
  const processedIdsRef = useRef(new Set());
  const messagesEndRef = useRef(null);
  const { conversation, aiThinking, sendMessage, closeWidget } = useAI();
  
  const { isListening, toggleMic } = useVoiceInput((text) => {
     setMessage(text);
     setTimeout(() => handleSend(text), 600);
  });

  const isCenter = mode === 'center';

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [conversation, aiThinking]);

  useEffect(() => {
    if (!conversation.length) return;
    const lastMsg = conversation[conversation.length - 1];
    if (lastMsg.type === 'ai' && !processedIdsRef.current.has(lastMsg.id)) {
        processedIdsRef.current.add(lastMsg.id);
        let match; const regexAdd = /\|\|ADD:(.*?)\|\|/gi;
        while ((match = regexAdd.exec(lastMsg.text)) !== null) if (onAddDirect) onAddDirect(match[1].trim());
        if (lastMsg.text.includes('||PAY||')) { if (onCheckout) onCheckout(); handleClose(); }
    }
  }, [conversation, onAddDirect, onCheckout]);

  const handleMicClick = () => {
    if (!clienteNome) { onRequestLogin(); return; }
    setShowMicHint(false);
    toggleMic();
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => mode === 'widget' ? closeWidget() : onClose?.(), 300);
  };

  const handleSend = async (textStr) => {
    const textToSend = textStr || message;
    if (!textToSend.trim() || aiThinking) return;
    if (!clienteNome && onRequestLogin) return onRequestLogin();
    
    setMessage(''); 
    setShowMicHint(false);

    const context = {
      estabelecimentoNome: estabelecimento?.nome || 'Restaurante',
      produtosPopulares: SYSTEM_INSTRUCTION(estabelecimento?.nome) + "\n\n📋 CARDÁPIO:\n" + formatarCardapio(produtos),
      clienteNome: clienteNome || 'Visitante',
      history: conversation.slice(-6).map(m => ({ role: m.type === 'user' ? 'user' : 'assistant', content: m.text }))
    };
    await sendMessage(textToSend, context);
  };

  if (!isOpen) return null;

  const containerClasses = isCenter
    ? 'fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 p-4 animate-fade-in' 
    : `fixed bottom-2 right-2 z-[5000] flex flex-col animate-slide-up shadow-2xl rounded-2xl ${TAMANHO_WIDGET}`;

  const cardClasses = `w-full h-full bg-white flex flex-col overflow-hidden relative border border-gray-200 ${isCenter ? 'rounded-2xl max-w-md max-h-[85vh] shadow-2xl' : 'rounded-2xl'}`;

  return (
    <div className={containerClasses}>
      <GlobalStyles />
      <div className={cardClasses}>
        
        {showMiniCart && <MiniCart itens={carrinho} onClose={() => setShowMiniCart(false)} onCheckout={() => { onCheckout?.(); handleClose(); }} />}
        
        <ChatHeader onClose={handleClose} statusText={isListening ? 'Ouvindo...' : (aiThinking ? 'Digitando...' : 'Online')} />

        <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-gray-50 scrollbar-thin">
           <div className="flex justify-start animate-fade-in">
             <div className="bg-white p-5 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 max-w-[90%] text-gray-900 text-lg leading-relaxed">
               {clienteNome ? 
                 <>Olá, <strong>{clienteNome.split(' ')[0]}</strong>! 👋 Sou o Jucleildo. O que vai ser hoje?</> : 
                 <>Olá! Sou o Jucleildo. <button onClick={onRequestLogin} className="text-red-600 font-bold underline">Entre aqui</button> para pedir.</>}
             </div>
           </div>

           {conversation.map(msg => (
             <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className={`px-5 py-4 rounded-2xl shadow-sm max-w-[90%] text-lg leading-relaxed ${
                    msg.type === 'user' 
                    ? 'bg-red-600 text-white rounded-tr-none' 
                    : 'bg-white text-gray-900 border border-gray-200 rounded-tl-none'
                }`}>
                  <ReactMarkdown 
                    components={{ 
                      strong: ({node, ...props}) => <span className="font-bold" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-xl font-bold mt-6 mb-3 text-red-600 border-b pb-1" {...props} />, 
                      li: ({node, ...props}) => <li className="mb-2" {...props} /> 
                    }}
                  >
                     {cleanText(msg.text)}
                  </ReactMarkdown>
                </div>
             </div>
           ))}
           {aiThinking && <div className="flex ml-4 space-x-2 py-2"><div className="w-2.5 h-2.5 bg-gray-400 rounded-full animate-bounce"/> <div className="w-2.5 h-2.5 bg-gray-400 rounded-full animate-bounce delay-75"/> <div className="w-2.5 h-2.5 bg-gray-400 rounded-full animate-bounce delay-150"/></div>}
           <div ref={messagesEndRef} />
        </div>

        <div className="bg-white border-t border-gray-100 shrink-0 pb-safe relative">
          
          {showMicHint && !isListening && clienteNome && <MicTooltip />}

          {!aiThinking && !isListening && clienteNome && (
            <div className="pt-4 pb-3 px-4 flex gap-3 overflow-x-auto scrollbar-hide w-full mask-linear-fade">
               <button onClick={() => setShowMiniCart(true)} className="shrink-0 px-5 py-3 bg-green-50 text-green-700 border border-green-200 text-base font-bold rounded-full flex items-center gap-2 shadow-sm active:scale-95 transition-transform">
                 <IoCartOutline size={20}/> <span>Ver Pedido</span>
               </button>
               {['📜 Ver Cardápio', '🍔 Sugestão', '🔥 Promoções'].map(s => (
                  <button key={s} onClick={() => handleSend(s)} className="shrink-0 px-5 py-3 bg-white text-gray-700 border border-gray-200 text-base font-medium rounded-full shadow-sm hover:bg-gray-50 active:scale-95 transition-transform whitespace-nowrap">
                    {s}
                  </button>
               ))}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="p-4 flex gap-3 items-center">
             <button type="button" onClick={handleMicClick} className={`w-14 h-14 shrink-0 rounded-full flex items-center justify-center transition-all shadow-sm border ${isListening ? 'bg-red-500 text-white animate-pulse border-red-500' : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200 active:scale-90'}`}>
               <IoMic size={26} />
             </button>
             
             {/* 🔥 INPUT AJUSTADO: text-base evita zoom e padding maior facilita toque */}
             <input 
               type="text" 
               value={isListening ? 'Ouvindo...' : message} 
               onChange={e => setMessage(e.target.value)} 
               placeholder={clienteNome ? "Digite aqui..." : "Faça login"} 
               disabled={isListening || !clienteNome}
               className="flex-1 bg-gray-100 text-gray-900 rounded-full px-6 py-4 text-base focus:bg-white focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none transition-all placeholder-gray-400 border border-transparent" 
             />
             
             <button type="submit" disabled={!message.trim() || aiThinking} className="w-14 h-14 shrink-0 bg-red-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-90">
               {aiThinking ? <IoTime className="animate-spin" size={24} /> : <IoSend size={24}/>}
             </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AIChatAssistant;