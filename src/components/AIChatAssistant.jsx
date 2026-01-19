import React, { useState, useRef, useEffect } from 'react';
import { IoClose, IoSend, IoTime, IoRestaurant, IoLogIn, IoCartOutline, IoMic } from 'react-icons/io5';
import ReactMarkdown from 'react-markdown'; 
import { useAI } from '../context/AIContext';

// ============================================================================
// 1. CONFIGURAÇÕES E UTILITÁRIOS
// ============================================================================

// 📏 Ajuste de tamanho do widget (Reduzido para ficar discreto)
const TAMANHO_WIDGET = "w-80 h-[500px]"; 

// 🧠 Personalidade do Jucleildo
const SYSTEM_INSTRUCTION = (nomeLoja) => `
  🚨 INSTRUÇÃO SUPREMA: VOCÊ É O JUCLEILDO.
  1. IDENTIDADE: Você é o garçom virtual do ${nomeLoja}. Seu nome é Jucleildo.
  2. PERSONALIDADE: Simpático, ágil e focado em vendas. Se perguntarem coisas complexas (matemática, política), diga brincando: "Sou de humanas, Jucleildo só sabe servir mesa! 🤣".
  3. OBJETIVO: Ajudar o cliente a escolher itens do cardápio e fechar o pedido.
  4. REGRA: Nunca saia do personagem.
`;

// 🧹 Formata o cardápio para a IA entender
const formatarCardapio = (lista) => {
  if (!lista?.length) return "Cardápio vazio.";
  const agrupado = lista.reduce((acc, p) => {
    const cat = p.categoria || 'Geral'; 
    if (!acc[cat]) acc[cat] = []; 
    acc[cat].push(p); 
    return acc;
  }, {});
  
  const emojis = { 'Pizzas': '🍕', 'Bebidas': '🥤', 'Sobremesas': '🍦', 'Lanches': '🍔', 'Porções': '🍟' };
  
  return Object.entries(agrupado).map(([cat, itens]) => {
    const itensTexto = itens.map(p => {
      const ops = p.variacoes?.length 
        ? p.variacoes.map(v => `${v.nome} (R$${Number(v.preco).toFixed(2)})`).join(', ') 
        : `R$${Number(p.precoFinal || p.preco).toFixed(2)}`;
      return `- ${p.nome} | Opções: [${ops}]`;
    }).join('\n');
    return `### ${emojis[cat] || '🍽️'} ${cat.toUpperCase()}\n${itensTexto}`;
  }).join('\n\n');
};

// 🧼 Limpa comandos internos da mensagem antes de exibir
const cleanText = (text) => text?.replace(/\|\|ADD:.*?\|\|/gi, '').replace(/\|\|PAY\|\|/gi, '').trim() || "";

// ============================================================================
// 2. HOOK PERSONALIZADO DE VOZ
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
      rec.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        onResult(transcript);
      };
      
      recognitionRef.current = rec;
    }
  }, [onResult]);

  const toggleMic = () => {
    if (!recognitionRef.current) return alert("Seu navegador não suporta voz. Tente usar o Chrome.");
    if (isListening) recognitionRef.current.stop();
    else recognitionRef.current.start();
  };

  return { isListening, toggleMic };
};

// ============================================================================
// 3. SUB-COMPONENTES VISUAIS
// ============================================================================

// 🛒 Mini Carrinho Flutuante (Overlay)
const MiniCart = ({ itens, onClose, onCheckout }) => (
  <div className="absolute inset-0 z-50 bg-white flex flex-col animate-fade-in">
    <div className="p-3 bg-gray-900 text-white flex justify-between items-center shadow-md text-sm">
      <span className="font-bold flex items-center gap-2"><IoCartOutline size={18}/> Seu Pedido</span>
      <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded"><IoClose size={20}/></button>
    </div>
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {itens.length === 0 ? <p className="text-gray-500 text-center mt-10">Carrinho vazio.</p> : itens.map(item => (
        <div key={item.cartItemId} className="flex justify-between border-b border-gray-100 pb-2 text-xs">
          <span className="text-gray-700">{item.qtd}x {item.nome}</span>
          <span className="font-bold text-green-600">R$ {(item.precoFinal * item.qtd).toFixed(2)}</span>
        </div>
      ))}
    </div>
    <div className="p-3 border-t bg-gray-50">
       <button onClick={onCheckout} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold text-sm shadow-md hover:bg-green-700 transition">Confirmar e Pagar</button>
    </div>
  </div>
);

// 🤵 Cabeçalho do Chat
const ChatHeader = ({ onClose, statusText }) => (
  <div className="p-3 flex items-center justify-between text-white shadow-md bg-gradient-to-r from-red-600 to-red-500 shrink-0">
    <div className="flex items-center gap-2">
      <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/10">
        <IoRestaurant className="text-lg"/>
      </div>
      <div className="text-left leading-tight">
        <p className="font-bold text-sm">Jucleildo</p> 
        <p className="text-[10px] opacity-90">{statusText}</p>
      </div>
    </div>
    <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-full transition"><IoClose size={20}/></button>
  </div>
);

// ============================================================================
// 4. COMPONENTE PRINCIPAL
// ============================================================================

const AIChatAssistant = ({ estabelecimento, produtos, carrinho, onClose, onAddDirect, onCheckout, clienteNome, onRequestLogin, mode = 'widget' }) => {
  const [message, setMessage] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [showMiniCart, setShowMiniCart] = useState(false);
  
  const processedIdsRef = useRef(new Set());
  const messagesEndRef = useRef(null);
  
  const { conversation, aiThinking, sendMessage, closeWidget } = useAI();
  
  // Configuração do microfone
  const { isListening, toggleMic } = useVoiceInput((text) => {
     setMessage(text);
     // Envia automaticamente após parar de falar (com pequeno delay)
     setTimeout(() => handleSend(text), 600);
  });

  const isCenter = mode === 'center';

  // Scroll automático para última mensagem
  useEffect(() => { 
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); 
  }, [conversation, aiThinking]);

  // Lógica de Comandos vindos da IA (ADD ao carrinho ou PAY para pagar)
  useEffect(() => {
    if (!conversation.length) return;
    const lastMsg = conversation[conversation.length - 1];

    if (lastMsg.type === 'ai' && !processedIdsRef.current.has(lastMsg.id)) {
        processedIdsRef.current.add(lastMsg.id);
        
        // Comando ADD
        let match; 
        const regexAdd = /\|\|ADD:(.*?)\|\|/gi;
        while ((match = regexAdd.exec(lastMsg.text)) !== null) {
          if (onAddDirect) onAddDirect(match[1].trim());
        }
        
        // Comando PAY
        if (lastMsg.text.includes('||PAY||')) { 
          if (onCheckout) onCheckout(); 
          handleClose(); 
        }
    }
  }, [conversation, onAddDirect, onCheckout]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      if (mode === 'widget') closeWidget();
      else onClose?.();
    }, 300);
  };

  const handleSend = async (textStr) => {
    const textToSend = textStr || message;
    if (!textToSend.trim() || aiThinking) return;
    if (!clienteNome && onRequestLogin) return onRequestLogin();

    setMessage(''); // Limpa input
    
    // Monta o contexto para a IA
    const context = {
      estabelecimentoNome: estabelecimento?.nome || 'Restaurante',
      produtosPopulares: SYSTEM_INSTRUCTION(estabelecimento?.nome || 'Loja') + "\n\n📋 CARDÁPIO DISPONÍVEL:\n" + formatarCardapio(produtos),
      clienteNome: clienteNome || 'Visitante',
      history: conversation.slice(-6).map(m => ({ 
        role: m.type === 'user' ? 'user' : 'assistant', 
        content: m.text 
      }))
    };
    
    await sendMessage(textToSend, context);
  };

  if (!isOpen) return null;

  // Classes dinâmicas baseadas no modo (Centralizado vs Widget no canto)
  const containerClasses = isCenter
    ? 'fixed inset-0 z-[5000] flex items-center justify-center bg-black/60 p-4 animate-fade-in' 
    : `fixed bottom-4 right-4 z-[5000] flex flex-col animate-slide-up shadow-2xl rounded-2xl ${TAMANHO_WIDGET}`;

  const cardClasses = `w-full h-full bg-white flex flex-col overflow-hidden relative border border-gray-200 
    ${isCenter ? 'rounded-2xl max-w-md max-h-[80vh] shadow-2xl' : 'rounded-2xl'}`;

  return (
    <div className={containerClasses}>
      <div className={cardClasses}>
        
        {/* CARRINHO (Sobreposto se ativo) */}
        {showMiniCart && (
          <MiniCart itens={carrinho} onClose={() => setShowMiniCart(false)} onCheckout={() => { onCheckout?.(); handleClose(); }} />
        )}
        
        {/* HEADER DO JUCLEILDO */}
        <ChatHeader onClose={handleClose} statusText={isListening ? 'Ouvindo...' : (aiThinking ? 'Digitando...' : 'Online')} />

        {/* ÁREA DE MENSAGENS */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50 scrollbar-thin text-xs sm:text-sm">
           
           {/* Balão de Boas Vindas */}
           <div className="flex justify-start animate-fade-in">
             <div className="bg-white p-3 rounded-xl rounded-tl-none shadow-sm border border-gray-100 max-w-[90%] text-gray-800 leading-relaxed">
               {clienteNome ? (
                 <>Olá, <strong>{clienteNome.split(' ')[0]}</strong>! 👋 Sou o Jucleildo. <br/>Toque no microfone 🎙️ para fazer seu pedido!</>
               ) : (
                 <>
                   Olá! Bem-vindo ao <strong>{estabelecimento?.nome}</strong>.<br/>
                   Sou o Jucleildo, seu garçom virtual.<br/>
                   <button onClick={onRequestLogin} className="mt-2 w-full bg-green-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-1 hover:bg-green-700 transition">
                     <IoLogIn/> Entrar para pedir
                   </button>
                 </>
               )}
             </div>
           </div>

           {/* Loop de Mensagens */}
           {conversation.map(msg => (
             <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className={`p-2.5 rounded-xl shadow-sm max-w-[85%] whitespace-pre-wrap ${
                    msg.type === 'user' 
                    ? 'bg-red-600 text-white rounded-tr-none' 
                    : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                }`}>
                  <ReactMarkdown components={{ strong: ({node, ...props}) => <span className="font-bold underline decoration-red-300" {...props} /> }}>
                     {cleanText(msg.text)}
                  </ReactMarkdown>
                </div>
             </div>
           ))}

           {/* Indicador de "Digitando..." */}
           {aiThinking && (
             <div className="flex ml-4 space-x-1 py-2">
               <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"/>
               <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"/>
               <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"/>
             </div>
           )}
           <div ref={messagesEndRef} />
        </div>

        {/* RODAPÉ (Sugestões + Input) */}
        <div className="bg-white border-t border-gray-100 shrink-0">
          
          {/* Sugestões Rápidas (Só aparece se logado e parado) */}
          {!aiThinking && !isListening && clienteNome && (
            <div className="px-3 py-2 flex gap-2 overflow-x-auto scrollbar-hide border-b border-gray-50">
               <button onClick={() => setShowMiniCart(true)} className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 text-[11px] font-bold rounded-full flex items-center gap-1 whitespace-nowrap active:scale-95 transition">
                 <IoCartOutline/> Ver Pedido
               </button>
               {['📜 Ver Cardápio', '🍔 Sugestão do Chefe', '🔥 Promoções'].map(s => (
                  <button key={s} onClick={() => handleSend(s)} className="px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 text-[11px] font-bold rounded-full hover:bg-gray-100 whitespace-nowrap active:scale-95 transition">
                    {s}
                  </button>
               ))}
            </div>
          )}

          {/* Área de Digitação */}
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="p-3 flex gap-2 items-center">
             
             {/* Botão Microfone */}
             <button 
               type="button" 
               onClick={() => !clienteNome ? onRequestLogin() : toggleMic()} 
               className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm border 
                 ${isListening 
                   ? 'bg-red-500 text-white animate-pulse border-red-500 scale-110' 
                   : 'bg-gray-50 text-red-500 border-gray-200 hover:bg-red-50'}`}
               title="Falar com Jucleildo"
             >
               <IoMic size={18} />
             </button>
             
             {/* Input Texto */}
             <input 
               type="text" 
               value={isListening ? 'Ouvindo...' : message} 
               onChange={e => setMessage(e.target.value)} 
               placeholder={clienteNome ? "Fale ou digite..." : "Faça login"} 
               disabled={isListening || !clienteNome}
               className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:bg-white focus:ring-1 focus:ring-red-200 outline-none transition-all" 
             />
             
             {/* Botão Enviar */}
             <button 
               type="submit" 
               disabled={!message.trim() || aiThinking} 
               className="w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
             >
               {aiThinking ? <IoTime className="animate-spin"/> : <IoSend size={16}/>}
             </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AIChatAssistant;