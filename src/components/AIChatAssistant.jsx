// src/components/AIChatAssistant.jsx
import React, { useState, useRef, useEffect } from 'react';
import { IoClose, IoSend, IoTime, IoRestaurant, IoCartOutline, IoMic } from 'react-icons/io5';
import ReactMarkdown from 'react-markdown'; 
import { useAI } from '../context/AIContext';

// ============================================================================
// 1. CONFIGURAÇÕES & CÉREBRO
// ============================================================================

// 🔥 ESTILO GAVETA (Usado apenas se NÃO for o card central)
const ESTILO_WIDGET_MOBILE = "fixed inset-x-0 bottom-0 w-full h-[85vh] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.4)] flex flex-col border-t border-gray-200";
const ESTILO_WIDGET_DESKTOP = "sm:fixed sm:bottom-6 sm:right-6 sm:w-96 sm:h-[650px] sm:rounded-2xl sm:shadow-[0_0_50px_rgba(0,0,0,0.25)] sm:flex sm:flex-col sm:border sm:border-gray-200";

const SYSTEM_INSTRUCTION = (nomeLoja) => `
  🚨 INSTRUÇÃO: VOCÊ É O JUCLEILDO, GARÇOM DO ${nomeLoja}.
  1. OBJETIVO: Vender com simpatia e brevidade.
  2. PREÇOS: Se houver variação (P, M, G), LISTE O PREÇO DE CADA UMA.
  
  ⚡ COMANDO OBRIGATÓRIO DE VENDA:
  Ao identificar o pedido, finalize com:
  ||ADD: Nome -- Opcao: Variação -- Obs: Detalhe -- Qtd: 1||
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
          const vars = p.variacoes.map(v => `${v.nome} (R$${Number(v.preco).toFixed(2)})`).join(', ');
          return `- **${p.nome}**: [Opções: ${vars}]`;
      }
      return `- **${p.nome}** (R$ ${Number(p.precoFinal || p.preco).toFixed(2)})`;
    }).join('\n');
    return `### ${emojis[cat] || '🍽️'} ${cat.toUpperCase()}\n${itensTexto}`;
  }).join('\n\n'); 
};

const cleanText = (text) => text?.replace(/\|\|ADD:.*?\|\|/gi, '').replace(/\|\|PAY\|\|/gi, '').trim() || "";

// ============================================================================
// 2. SUB-COMPONENTES
// ============================================================================

const MiniCart = ({ itens, onClose, onCheckout }) => (
  <div className="absolute inset-0 z-[2147483647] bg-gray-50 flex flex-col animate-fade-in rounded-t-3xl sm:rounded-2xl overflow-hidden">
    <div className="p-5 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm">
      <span className="font-bold text-gray-800 flex items-center gap-2 text-xl"><IoCartOutline/> Seu Pedido</span>
      <button onClick={onClose} className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-full text-gray-600 active:scale-95"><IoClose size={28}/></button>
    </div>
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      {itens.length === 0 ? <p className="text-gray-500 text-center mt-10 text-lg">Carrinho vazio.</p> : itens.map(item => (
        <div key={item.cartItemId} className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex flex-col">
            <span className="font-bold text-gray-900 text-lg">{item.nome}</span>
            {item.variacaoSelecionada && <span className="text-sm text-gray-600 font-medium">{item.variacaoSelecionada.nome}</span>}
            <span className="text-sm text-gray-500">Qtd: {item.qtd}</span>
          </div>
          <span className="font-bold text-green-600 text-lg">R$ {(item.precoFinal * item.qtd).toFixed(2)}</span>
        </div>
      ))}
    </div>
    <div className="p-5 bg-white border-t border-gray-200 safe-area-bottom">
       <button onClick={onCheckout} className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 flex justify-center items-center gap-2">
         <span>✅ Fechar Pedido</span>
       </button>
    </div>
  </div>
);

const ChatHeader = ({ onClose, statusText }) => (
  <div className="px-6 py-5 flex items-center justify-between bg-white border-b border-gray-200 shadow-sm shrink-0 rounded-t-3xl sm:rounded-t-2xl">
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 bg-red-600 text-white rounded-full flex items-center justify-center border-4 border-red-100 shadow-md">
        <IoRestaurant className="text-3xl"/>
      </div>
      <div className="text-left">
        <p className="font-bold text-gray-900 text-xl leading-none">Jucleildo</p> 
        <p className="text-sm text-green-600 font-bold mt-1 uppercase tracking-wide flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> {statusText}
        </p>
      </div>
    </div>
    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition active:scale-90 shadow-sm border border-gray-200">
      <IoClose size={24}/>
    </button>
  </div>
);

// ============================================================================
// 3. COMPONENTE PRINCIPAL
// ============================================================================

const AIChatAssistant = ({ estabelecimento, produtos, carrinho, onClose, onAddDirect, onCheckout, clienteNome, onRequestLogin, mode = 'widget' }) => {
  const [message, setMessage] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [showMiniCart, setShowMiniCart] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const processedIdsRef = useRef(new Set());
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const { conversation, aiThinking, sendMessage, closeWidget } = useAI();

  const isCenter = mode === 'center';

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [conversation, aiThinking]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      const rec = new SpeechRec();
      rec.lang = 'pt-BR';
      rec.continuous = false;
      rec.interimResults = false;
      rec.onstart = () => setIsListening(true);
      rec.onend = () => setIsListening(false);
      rec.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        setMessage(transcript);
        setTimeout(() => handleSend(transcript), 600);
      };
      recognitionRef.current = rec;
    }
  }, []);

  const toggleMic = () => {
    if (!recognitionRef.current) return alert("Navegador sem suporte a voz.");
    isListening ? recognitionRef.current.stop() : recognitionRef.current.start();
  };

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

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => mode === 'widget' ? closeWidget() : onClose?.(), 300);
  };

  const handleSend = async (textStr) => {
    const textToSend = textStr || message;
    if (!textToSend.trim() || aiThinking) return;
    if (!clienteNome && onRequestLogin) return onRequestLogin();
    setMessage('');
    
    const context = {
      estabelecimentoNome: estabelecimento?.nome || 'Restaurante',
      produtosPopulares: SYSTEM_INSTRUCTION(estabelecimento?.nome) + "\n\n📋 CARDÁPIO:\n" + formatarCardapio(produtos),
      clienteNome: clienteNome || 'Visitante',
      history: conversation.slice(-6).map(m => ({ role: m.type === 'user' ? 'user' : 'assistant', content: m.text }))
    };
    await sendMessage(textToSend, context);
  };

  if (!isOpen) return null;

  // 🔥 LÓGICA DE LAYOUT:
  // Se mode == 'center', ele força um CARD no meio da tela (com overlay preto), mesmo no mobile.
  // Se mode == 'widget', ele usa o estilo de gaveta/botão flutuante.
  const layoutClasses = isCenter 
    ? 'fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm' 
    : `z-[2147483647] bg-white transition-all duration-300 ${ESTILO_WIDGET_MOBILE} ${ESTILO_WIDGET_DESKTOP}`;

  // Se for center, o container interno é um card arredondado e limitado.
  // Se for widget, ele preenche a altura definida (gaveta).
  const containerInner = isCenter 
    ? 'w-full max-w-md h-[80vh] flex flex-col bg-white relative overflow-hidden rounded-2xl shadow-2xl' 
    : 'w-full h-full flex flex-col bg-white relative overflow-hidden';

  return (
    <div className={layoutClasses}>
      <div className={containerInner}>
        
        {showMiniCart && <MiniCart itens={carrinho} onClose={() => setShowMiniCart(false)} onCheckout={() => { onCheckout?.(); handleClose(); }} />}
        
        <ChatHeader onClose={handleClose} statusText={isListening ? 'Ouvindo...' : (aiThinking ? 'Digitando...' : 'Online')} />

        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-gray-50 scrollbar-thin">
           <div className="flex justify-start">
             <div className="bg-white p-5 rounded-3xl rounded-tl-none shadow-sm border border-gray-200 max-w-[90%] text-gray-900 text-lg leading-relaxed">
               {clienteNome ? 
                 <>Olá, <strong>{clienteNome.split(' ')[0]}</strong>! 👋 Sou o Jucleildo. Posso anotar seu pedido?</> : 
                 <>Olá! Sou o Jucleildo. <button onClick={onRequestLogin} className="text-red-600 font-bold underline">Entre aqui</button> para pedir.</>}
             </div>
           </div>

           {conversation.map(msg => (
             <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`px-5 py-4 rounded-3xl shadow-md max-w-[90%] text-lg leading-relaxed ${
                    msg.type === 'user' 
                    ? 'bg-red-600 text-white rounded-tr-none' 
                    : 'bg-white text-gray-900 border border-gray-200 rounded-tl-none'
                }`}>
                  <ReactMarkdown components={{ strong: ({node, ...props}) => <span className="font-bold" {...props} /> }}>
                     {cleanText(msg.text)}
                  </ReactMarkdown>
                </div>
             </div>
           ))}
           {aiThinking && <div className="flex ml-4 space-x-2 py-2"><div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce"/> <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce delay-75"/> <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce delay-150"/></div>}
           <div ref={messagesEndRef} />
        </div>

        <div className="bg-white border-t border-gray-200 shrink-0 pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
          {!aiThinking && !isListening && clienteNome && (
            <div className="pt-4 pb-3 px-5 flex gap-3 overflow-x-auto scrollbar-hide w-full">
               <button onClick={() => setShowMiniCart(true)} className="shrink-0 px-5 py-3 bg-green-50 text-green-700 border border-green-200 text-base font-bold rounded-full flex items-center gap-2 whitespace-nowrap shadow-sm hover:bg-green-100 transition">
                 <IoCartOutline size={20}/> Pedido ({carrinho.length})
               </button>
               {['📜 Ver Cardápio', '🍔 Sugestão', '🔥 Promoções'].map(s => (
                  <button key={s} onClick={() => handleSend(s)} className="shrink-0 px-5 py-3 bg-gray-50 text-gray-700 border border-gray-200 text-base font-medium rounded-full shadow-sm whitespace-nowrap hover:bg-gray-100 transition">
                    {s}
                  </button>
               ))}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="p-4 flex gap-3 items-center">
             <button type="button" onClick={() => !clienteNome ? onRequestLogin() : toggleMic()} className={`w-14 h-14 shrink-0 rounded-full flex items-center justify-center transition-all border ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
               <IoMic size={24} />
             </button>
             
             <input 
               type="text" 
               value={isListening ? 'Ouvindo...' : message} 
               onChange={e => setMessage(e.target.value)} 
               placeholder={clienteNome ? "Digite aqui..." : "Faça login para pedir"} 
               disabled={isListening || !clienteNome}
               className="flex-1 bg-gray-100 text-gray-900 rounded-full px-6 py-4 text-lg focus:bg-white focus:ring-2 focus:ring-red-100 outline-none transition-all placeholder-gray-400 border border-transparent shadow-inner" 
             />
             
             <button type="submit" disabled={!message.trim() || aiThinking} className="w-14 h-14 shrink-0 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-700 active:scale-95 disabled:opacity-50 transition-all">
               {aiThinking ? <IoTime className="animate-spin" size={24} /> : <IoSend size={24}/>}
             </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AIChatAssistant;