// src/components/AIChatAssistant.jsx
import React, { useState, useRef, useEffect } from 'react';
import { IoClose, IoSend, IoTime, IoRestaurant, IoCartOutline, IoMic, IoPerson } from 'react-icons/io5';
import ReactMarkdown from 'react-markdown'; 
import { useAI } from '../context/AIContext';

// ============================================================================
// 1. FORMATAÇÃO E REGRAS
// ============================================================================

const SYSTEM_INSTRUCTION = (nomeLoja) => `
  🚨 VOCÊ É O JUCLEILDO, GARÇOM DO ${nomeLoja}.
  
  ⚠️ REGRA VISUAL (CRUCIAL):
  - NUNCA use pontinhos (......) para alinhar preços.
  - Para produtos com variações, coloque o NOME DO PRODUTO em uma linha e as opções abaixo.
  - Use o formato exato abaixo:

  **NOME DO PRODUTO**
  - Opção A: R$ 20,00
  - Opção B: R$ 30,00

  ⚡ COMANDO OCULTO: ||ADD: Nome -- Opcao: Variação -- Obs: N/A -- Qtd: 1||
`;

// 🔥 FORMATAÇÃO LIMPA (Sem pontinhos que quebram no celular)
const formatarCardapio = (lista) => {
  if (!lista?.length) return "Cardápio vazio.";
  
  const agrupado = lista.reduce((acc, p) => {
    const cat = p.categoria || 'Geral'; 
    if (!acc[cat]) acc[cat] = []; 
    acc[cat].push(p); 
    return acc;
  }, {});
  
  const emojis = { 'Pizzas': '🍕', 'Pizzas Doces': '🍫', 'Bebidas': '🥤', 'Sobremesas': '🍦', 'Lanches': '🍔', 'Porções': '🍟' };
  
  return Object.entries(agrupado).map(([cat, itens]) => {
    const itensTexto = itens.map(p => {
      const precoBase = p.precoFinal || p.preco;
      
      if (p.variacoes?.length > 0) {
          const vars = p.variacoes.map(v => `- ${v.nome}: R$ ${Number(v.preco).toFixed(2)}`).join('\n');
          return `**${p.nome.toUpperCase()}**\n${vars}`; 
      }
      return `**${p.nome.toUpperCase()}**\n- Preço Único: R$ ${Number(precoBase).toFixed(2)}`;
    }).join('\n\n'); 
    
    return `### ${emojis[cat] || '🍽️'} ${cat.toUpperCase()}\n${itensTexto}`;
  }).join('\n\n'); 
};

const cleanText = (text) => text?.replace(/\|\|ADD:.*?\|\|/gi, '').replace(/\|\|PAY\|\|/gi, '').trim() || "";

// ============================================================================
// 2. COMPONENTES VISUAIS
// ============================================================================

const MiniCart = ({ itens, onClose, onCheckout }) => (
  <div className="absolute inset-0 z-50 bg-gray-50 flex flex-col animate-fade-in rounded-[2rem] overflow-hidden">
    <div className="p-5 bg-white border-b border-gray-100 flex justify-between items-center shadow-sm">
      <span className="font-bold text-gray-800 flex items-center gap-2 text-xl">🛍️ Sacola</span>
      <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 transition"><IoClose size={24}/></button>
    </div>
    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
      {itens.length === 0 ? 
        <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-50"><IoCartOutline size={64} /><p className="mt-2">Vazia</p></div> 
      : itens.map(item => (
        <div key={item.cartItemId} className="flex justify-between items-start bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <span className="font-bold text-gray-900 block">{item.nome}</span>
            {item.variacaoSelecionada && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md font-mono">{item.variacaoSelecionada.nome}</span>}
            <span className="text-xs text-gray-400 block mt-1">Qtd: {item.qtd}</span>
          </div>
          <span className="font-bold text-green-600">R$ {(item.precoFinal * item.qtd).toFixed(2)}</span>
        </div>
      ))}
    </div>
    <div className="p-5 bg-white border-t border-gray-100">
       <button onClick={onCheckout} className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 hover:bg-green-700 transition-colors">Concluir Pedido</button>
    </div>
  </div>
);

const ChatHeader = ({ onClose, statusText, estabelecimentoNome }) => (
  <div className="px-5 py-4 flex items-center justify-between bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
    <div className="flex items-center gap-3">
      <div className="w-11 h-11 bg-gradient-to-tr from-red-600 to-orange-500 text-white rounded-full flex items-center justify-center shadow-md ring-2 ring-white">
        <IoRestaurant className="text-2xl" />
      </div>
      <div>
        <span className="font-bold text-gray-900 text-lg block leading-tight">Jucleildo</span>
        <span className="text-xs text-gray-500 flex items-center gap-1 font-medium">
           <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> {statusText}
        </span>
      </div>
    </div>
    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center bg-gray-50 text-gray-400 rounded-full hover:bg-red-50 hover:text-red-500 transition"><IoClose size={22}/></button>
  </div>
);

// ============================================================================
// 3. COMPONENTE PRINCIPAL
// ============================================================================

const AIChatAssistant = ({ estabelecimento, produtos, carrinho, onClose, onAddDirect, onCheckout, clienteNome, onRequestLogin, mode = 'center' }) => {
  const [message, setMessage] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [showMiniCart, setShowMiniCart] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const processedIdsRef = useRef(new Set());
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const { conversation, aiThinking, sendMessage, closeWidget } = useAI();

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
        setTimeout(() => handleSend(transcript), 800);
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
      produtosPopulares: SYSTEM_INSTRUCTION(estabelecimento?.nome) + "\n\n" + formatarCardapio(produtos),
      clienteNome: clienteNome || 'Visitante',
      history: conversation.slice(-6).map(m => ({ role: m.type === 'user' ? 'user' : 'assistant', content: m.text }))
    };
    await sendMessage(textToSend, context);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      
      {/* CARD PRINCIPAL (Estilo iOS) */}
      <div className="w-full max-w-lg h-[85vh] bg-white rounded-[2rem] shadow-2xl flex flex-col relative overflow-hidden ring-1 ring-white/20">
        
        {showMiniCart && <MiniCart itens={carrinho} onClose={() => setShowMiniCart(false)} onCheckout={() => { onCheckout?.(); handleClose(); }} />}
        
        <ChatHeader onClose={handleClose} statusText={isListening ? 'Ouvindo...' : (aiThinking ? 'Digitando...' : 'Online')} estabelecimentoNome={estabelecimento?.nome} />

        {/* ÁREA DE MENSAGENS */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 custom-scrollbar space-y-6">
           
           <div className="flex justify-start animate-slide-up">
             <div className="flex items-end gap-2 max-w-[90%]">
               <div className="w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-lg shrink-0">🤖</div>
               <div className="bg-white p-4 rounded-2xl rounded-bl-none shadow-sm border border-gray-200 text-gray-800 text-base leading-relaxed">
                 {clienteNome ? 
                   <>Olá, <strong>{clienteNome.split(' ')[0]}</strong>! 😃<br/>Sou o Jucleildo. O que você gostaria de pedir?</> : 
                   <>Olá! Sou o Jucleildo. <button onClick={onRequestLogin} className="text-red-600 font-bold underline">Entre aqui</button> para pedir.</>}
               </div>
             </div>
           </div>

           {conversation.map(msg => (
             <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                <div className={`flex items-end gap-2 max-w-[90%] ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>
                  
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 border shadow-sm ${msg.type === 'user' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-red-500 border-gray-200'}`}>
                      {msg.type === 'user' ? <IoPerson/> : <IoRestaurant/>}
                  </div>

                  {/* BALÃO DE TEXTO ESTILIZADO */}
                  <div className={`px-4 py-3 rounded-2xl shadow-sm text-base leading-relaxed border ${
                      msg.type === 'user' 
                      ? 'bg-green-600 text-white rounded-br-none border-green-600' 
                      : 'bg-white text-gray-800 rounded-bl-none border-gray-200'
                  }`}>
                    <ReactMarkdown 
                        components={{ 
                            // Título do produto (Negrito vira um bloco destacado)
                            strong: ({node, ...props}) => <span className="block font-bold text-gray-900 mt-2 mb-1 text-lg border-b border-gray-100 pb-1" {...props} />,
                            
                            // Lista (Variações vira linhas separadas bonitas)
                            ul: ({node, ...props}) => <ul className="w-full" {...props} />,
                            
                            // Item da lista (Cada variação é uma linha com fundo zebrado suave)
                            li: ({node, ...props}) => <li className="flex justify-between items-center py-1.5 px-2 hover:bg-gray-50 rounded text-sm text-gray-700 border-b border-dashed border-gray-100 last:border-0" {...props} />,
                            
                            // Texto normal
                            p: ({node, ...props}) => <p className="mb-0" {...props} />
                        }}
                    >
                       {cleanText(msg.text)}
                    </ReactMarkdown>
                  </div>

                </div>
             </div>
           ))}
           
           {aiThinking && (
               <div className="flex justify-start">
                   <div className="flex items-end gap-2">
                     <div className="w-8 h-8 rounded-full bg-transparent shrink-0"/>
                     <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-none shadow-sm border border-gray-200 flex space-x-1 items-center h-10">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"/> 
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"/> 
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"/>
                     </div>
                   </div>
               </div>
           )}
           <div ref={messagesEndRef} />
        </div>

        {/* INPUT */}
        <div className="bg-white border-t border-gray-100 p-4 pb-safe">
          {!aiThinking && !isListening && clienteNome && (
            <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-hide pb-1">
               <button onClick={() => setShowMiniCart(true)} className="shrink-0 px-4 py-2 bg-green-50 text-green-700 border border-green-200 text-sm font-bold rounded-full flex items-center gap-1 shadow-sm hover:bg-green-100 transition">
                 <IoCartOutline/> Carrinho ({carrinho.length})
               </button>
               {['📜 Ver Cardápio', '🔥 Promo'].map(s => (
                  <button key={s} onClick={() => handleSend(s)} className="shrink-0 px-4 py-2 bg-white text-gray-600 border border-gray-200 text-sm font-medium rounded-full shadow-sm hover:bg-gray-50 transition">
                    {s}
                  </button>
               ))}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2 items-center">
             <button type="button" onClick={() => !clienteNome ? onRequestLogin() : toggleMic()} className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center transition-all shadow-sm ${isListening ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
               <IoMic size={22} />
             </button>
             
             <input 
               type="text" 
               value={isListening ? 'Ouvindo...' : message} 
               onChange={e => setMessage(e.target.value)} 
               placeholder={clienteNome ? "Digite aqui..." : "Faça login"} 
               disabled={isListening || !clienteNome}
               className="flex-1 bg-gray-50 text-gray-900 rounded-full px-5 py-3 text-base focus:bg-white focus:ring-2 focus:ring-green-200 outline-none border border-gray-200 transition-all placeholder-gray-400" 
             />
             
             <button type="submit" disabled={!message.trim() || aiThinking} className="w-12 h-12 shrink-0 bg-green-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-green-100 hover:bg-green-700 active:scale-95 disabled:opacity-50 disabled:shadow-none transition-all">
               {aiThinking ? <IoTime className="animate-spin" size={22} /> : <IoSend size={20} className="ml-1"/>}
             </button>
          </form>
        </div>
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