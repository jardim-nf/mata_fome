import React, { useState, useRef, useEffect } from 'react';
import { IoClose, IoSend, IoTime, IoRestaurant, IoLogIn, IoCartOutline, IoMic } from 'react-icons/io5';
import ReactMarkdown from 'react-markdown'; 
import { useAI } from '../context/AIContext';

// ============================================================================
// 1. CONFIGURAÇÕES & CÉREBRO 🧠
// ============================================================================

// 🔥 NOVO DESIGN:
// Mobile: Fixado no fundo (inset-x-0 bottom-0), ocupa 80% da altura, cantos arredondados só em cima.
// Desktop: Flutuante no canto direito (bottom-4 right-4), arredondado total.
const ESTILO_MOBILE = "fixed inset-x-0 bottom-0 w-full h-[85dvh] rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)]";
const ESTILO_DESKTOP = "sm:fixed sm:bottom-6 sm:right-6 sm:w-96 sm:h-[600px] sm:rounded-2xl sm:shadow-2xl";

// Prompt da IA
const SYSTEM_INSTRUCTION = (nomeLoja) => `
  🚨 INSTRUÇÃO SUPREMA: VOCÊ É O JUCLEILDO, GARÇOM VIRTUAL DO ${nomeLoja}.
  
  1. SEU OBJETIVO: Vender! Seja simpático, breve e use emojis.
  2. REGRAS DE PREÇO: Se o produto tiver variações (P, M, G ou sabores), LISTE O PREÇO DE CADA UMA.

  ⚡ COMANDO DE VENDA (IMPORTANTE):
  Quando o cliente escolher um item, você DEVE enviar este comando oculto no final da mensagem:
  ||ADD: NomeProduto -- Opcao: VariaçãoEscolhida -- Obs: Observação -- Qtd: 1||
  
  Exemplos:
  - "Ótima escolha! 🍕 ||ADD: Pizza Calabresa -- Opcao: Grande||"
  - "Saindo! 🥓 ||ADD: X-Bacon -- Obs: sem cebola -- Qtd: 2||"
  - "Geladinha! 🥤 ||ADD: Coca Cola||"
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
// 2. COMPONENTES VISUAIS
// ============================================================================

const MiniCart = ({ itens, onClose, onCheckout }) => (
  <div className="absolute inset-0 z-50 bg-gray-50 flex flex-col animate-fade-in rounded-t-3xl sm:rounded-2xl overflow-hidden">
    <div className="p-4 bg-white border-b border-gray-200 flex justify-between items-center shadow-sm">
      <span className="font-bold text-gray-800 flex items-center gap-2 text-lg"><IoCartOutline/> Seu Pedido</span>
      <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full text-gray-600"><IoClose size={24}/></button>
    </div>
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {itens.length === 0 ? <p className="text-gray-400 text-center mt-10">Carrinho vazio.</p> : itens.map(item => (
        <div key={item.cartItemId} className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900 text-sm">{item.nome}</span>
            {item.variacaoSelecionada && <span className="text-xs text-gray-500">{item.variacaoSelecionada.nome}</span>}
            <span className="text-xs text-gray-500">Qtd: {item.qtd}</span>
          </div>
          <span className="font-bold text-green-600 text-base">R$ {(item.precoFinal * item.qtd).toFixed(2)}</span>
        </div>
      ))}
    </div>
    <div className="p-4 bg-white border-t border-gray-200">
       <button onClick={onCheckout} className="w-full bg-green-600 text-white py-3.5 rounded-xl font-bold text-base shadow-lg flex justify-center items-center gap-2">
         <span>✅ Fechar Pedido</span>
       </button>
    </div>
  </div>
);

const ChatHeader = ({ onClose, statusText }) => (
  <div className="px-5 py-4 flex items-center justify-between bg-white border-b border-gray-100 shadow-sm shrink-0 rounded-t-3xl sm:rounded-t-2xl">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
        <IoRestaurant className="text-xl"/>
      </div>
      <div className="text-left">
        <p className="font-bold text-gray-900 text-base leading-none">Jucleildo</p> 
        <p className="text-xs text-green-600 font-medium mt-0.5">{statusText}</p>
      </div>
    </div>
    <button onClick={onClose} className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition"><IoClose size={24}/></button>
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

  const isCenter = mode === 'center'; // Modo antigo centralizado (mantido por compatibilidade)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [conversation, aiThinking]);

  // Hook de Voz Manual (Mais seguro para iOS)
  useEffect(() => {
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
        setTimeout(() => handleSend(transcript), 500);
      };
      recognitionRef.current = rec;
    }
  }, []);

  const toggleMic = () => {
    if (!recognitionRef.current) return alert("Seu navegador não suporta voz.");
    isListening ? recognitionRef.current.stop() : recognitionRef.current.start();
  };

  // Processamento de Comandos IA
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

  // 🔥 CLASSES DE LAYOUT HÍBRIDO (Gaveta no Mobile / Widget no Desktop)
  // O segredo aqui é o z-[9999] e as classes de posicionamento.
  const layoutClasses = isCenter 
    ? 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4' // Centralizado (legacy)
    : `z-[9999] flex flex-col bg-white border border-gray-200 transition-all duration-300 ${ESTILO_MOBILE} ${ESTILO_DESKTOP}`;

  const containerInner = `w-full h-full flex flex-col bg-white relative overflow-hidden ${isCenter ? 'max-w-md max-h-[80vh] rounded-2xl' : 'h-full'}`;

  return (
    <div className={layoutClasses}>
      <div className={containerInner}>
        
        {showMiniCart && <MiniCart itens={carrinho} onClose={() => setShowMiniCart(false)} onCheckout={() => { onCheckout?.(); handleClose(); }} />}
        
        <ChatHeader onClose={handleClose} statusText={isListening ? 'Ouvindo...' : (aiThinking ? 'Digitando...' : 'Online')} />

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 scrollbar-thin">
           <div className="flex justify-start">
             <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 max-w-[90%] text-gray-900 text-base leading-relaxed">
               {clienteNome ? 
                 <>Olá, <strong>{clienteNome.split(' ')[0]}</strong>! 👋 Sou o Jucleildo.</> : 
                 <>Olá! Sou o Jucleildo. <button onClick={onRequestLogin} className="text-red-600 font-bold underline">Entre aqui</button> para pedir.</>}
             </div>
           </div>

           {conversation.map(msg => (
             <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`px-4 py-3 rounded-2xl shadow-sm max-w-[90%] text-base leading-relaxed ${
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
           {aiThinking && <div className="flex ml-4 space-x-2 py-2"><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"/> <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"/> <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"/></div>}
           <div ref={messagesEndRef} />
        </div>

        <div className="bg-white border-t border-gray-100 shrink-0 pb-safe">
          {!aiThinking && !isListening && clienteNome && (
            <div className="pt-3 pb-2 px-4 flex gap-2 overflow-x-auto scrollbar-hide w-full">
               <button onClick={() => setShowMiniCart(true)} className="shrink-0 px-4 py-2 bg-green-50 text-green-700 border border-green-200 text-sm font-bold rounded-full flex items-center gap-2 whitespace-nowrap">
                 <IoCartOutline size={18}/> Pedido
               </button>
               {['📜 Ver Cardápio', '🍔 Sugestão', '🔥 Promoções'].map(s => (
                  <button key={s} onClick={() => handleSend(s)} className="shrink-0 px-4 py-2 bg-white text-gray-700 border border-gray-200 text-sm font-medium rounded-full shadow-sm whitespace-nowrap">
                    {s}
                  </button>
               ))}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="p-3 flex gap-2 items-center">
             <button type="button" onClick={() => !clienteNome ? onRequestLogin() : toggleMic()} className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center transition-all border ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
               <IoMic size={22} />
             </button>
             
             {/* 🔥 INPUT SEGURO: text-base evita zoom no iPhone */}
             <input 
               type="text" 
               value={isListening ? 'Ouvindo...' : message} 
               onChange={e => setMessage(e.target.value)} 
               placeholder={clienteNome ? "Digite aqui..." : "Faça login"} 
               disabled={isListening || !clienteNome}
               className="flex-1 bg-gray-100 text-gray-900 rounded-full px-5 py-3 text-base focus:bg-white focus:ring-2 focus:ring-red-100 outline-none transition-all placeholder-gray-400 border border-transparent" 
             />
             
             <button type="submit" disabled={!message.trim() || aiThinking} className="w-12 h-12 shrink-0 bg-red-600 text-white rounded-full flex items-center justify-center shadow-md disabled:opacity-50">
               {aiThinking ? <IoTime className="animate-spin" size={20} /> : <IoSend size={20}/>}
             </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AIChatAssistant;