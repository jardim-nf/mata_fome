// src/components/AIChatAssistant.jsx
import React, { useState, useRef, useEffect } from 'react';
import { IoClose, IoSend, IoTime, IoRestaurant, IoCartOutline, IoMic, IoPerson } from 'react-icons/io5';
import ReactMarkdown from 'react-markdown'; 
import { useAI } from '../context/AIContext';

// ============================================================================
// 1. FORMATAÇÃO E REGRAS VISUAIS
// ============================================================================

const SYSTEM_INSTRUCTION = (nomeLoja) => `
  🚨 INSTRUÇÃO DE DESIGN:
  Você é o garçom do ${nomeLoja}.
  
  ⚠️ REGRA DE OURO PARA LISTAS:
  - NUNCA use pontinhos (......) para alinhar preços. Isso quebra no celular.
  - Se um produto tiver variações, coloque cada uma em uma NOVA LINHA.
  - Use marcadores simples (como hifens ou bolinhas).

  EXEMPLO PERFEITO:
  "Temos Coca-Cola:
  - Lata: R$ 5,00
  - 2 Litros: R$ 10,00"

  ⚡ COMANDO OCULTO: ||ADD: Nome -- Opcao: Variação -- Obs: N/A -- Qtd: 1||
`;

// 🔥 FORMATAÇÃO VERTICAL (MOBILE-FRIENDLY)
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
      return `**${p.nome.toUpperCase()}**\n- Preço: R$ ${Number(precoBase).toFixed(2)}`;
    }).join('\n\n'); 
    
    return `### ${emojis[cat] || '🍽️'} ${cat.toUpperCase()}\n${itensTexto}`;
  }).join('\n\n---\n\n'); 
};

const cleanText = (text) => text?.replace(/\|\|ADD:.*?\|\|/gi, '').replace(/\|\|PAY\|\|/gi, '').trim() || "";

// ============================================================================
// 2. SUB-COMPONENTES
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

const ChatHeader = ({ onClose, statusText }) => (
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

const AIChatAssistant = ({ 
    estabelecimento, 
    produtos, 
    carrinho, 
    onClose, 
    onAddDirect, 
    onCheckout, 
    clienteNome, 
    onRequestLogin, 
    mode = 'center',
    // 🔥 NOVAS PROPS PARA LÓGICA DE ENTREGA
    taxaEntrega,
    enderecoAtual,
    isRetirada,
    onSetDeliveryMode,
    onUpdateAddress
}) => {
  const [message, setMessage] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [showMiniCart, setShowMiniCart] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  // 🔥 ESTADOS PARA FLUXO DE ENTREGA LOCAL
  const [conversationStep, setConversationStep] = useState('IDLE'); // IDLE, ASKING_TYPE, ASKING_ADDRESS...
  const [localMessages, setLocalMessages] = useState([]); // Mensagens que não vão pro backend (histórico local)

  const processedIdsRef = useRef(new Set());
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const { conversation, aiThinking, sendMessage, closeWidget } = useAI();

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [conversation, aiThinking, localMessages]);

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

  // 🔥 MONITORAMENTO DE RESPOSTAS DA IA (INTERCEPTA ||PAY||)
  useEffect(() => {
    if (!conversation.length) return;
    const lastMsg = conversation[conversation.length - 1];
    
    if (lastMsg.type === 'ai' && !processedIdsRef.current.has(lastMsg.id)) {
        processedIdsRef.current.add(lastMsg.id);
        
        let match; 
        const regexAdd = /\|\|ADD:(.*?)\|\|/gi;
        while ((match = regexAdd.exec(lastMsg.text)) !== null) if (onAddDirect) onAddDirect(match[1].trim());
        
        // 🛑 AQUI ESTÁ A MÁGICA: Se a IA mandar pagar, a gente PAUSA e inicia o fluxo de entrega
        if (lastMsg.text.includes('||PAY||')) { 
            iniciarFluxoEntrega();
        }
    }
  }, [conversation, onAddDirect]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => mode === 'widget' ? closeWidget() : onClose?.(), 300);
  };

  // --- LÓGICA DO FLUXO DE ENTREGA (LOCAL) ---
  const addLocalBotMessage = (text) => {
      // 🔥 CORREÇÃO: Adicionando Math.random() para garantir ID único e evitar o aviso de duplicate key
      setLocalMessages(prev => [...prev, { id: Date.now() + Math.random(), type: 'ai', text }]);
  };

  const iniciarFluxoEntrega = () => {
      if (!clienteNome) {
          addLocalBotMessage("Para finalizar, preciso que faça login. Clique em 'Entre aqui' na mensagem inicial.");
          if(onRequestLogin) onRequestLogin();
          return;
      }
      setConversationStep('ASKING_TYPE');
      setTimeout(() => {
          addLocalBotMessage("Certo! Antes de finalizar: É para **Entrega** 🛵 ou **Retirada** 🛍️?");
      }, 600);
  };

  const processarFluxoEntrega = (texto) => {
      // Adiciona a resposta do usuário visualmente
      // 🔥 CORREÇÃO: ID Único aqui também
      setLocalMessages(prev => [...prev, { id: Date.now() + Math.random(), type: 'user', text: texto }]);
      setMessage('');

      const lower = texto.toLowerCase();

      // ETAPA 1: TIPO DE PEDIDO
      if (conversationStep === 'ASKING_TYPE') {
          if (lower.includes('entrega') || lower.includes('casa') || lower.includes('lev')) {
              onSetDeliveryMode('entrega');
              
              if (enderecoAtual?.bairro && enderecoAtual?.rua) {
                  addLocalBotMessage(`Endereço: ${enderecoAtual.rua}, ${enderecoAtual.bairro}. Confere? (Sim/Não)`);
                  setConversationStep('CONFIRM_ADDRESS');
              } else {
                  addLocalBotMessage("Ok, entrega! Qual é o seu **Bairro** e **Rua**?");
                  setConversationStep('ASKING_ADDRESS');
              }
          } 
          else if (lower.includes('retira') || lower.includes('busca') || lower.includes('aqui')) {
              onSetDeliveryMode('retirada');
              addLocalBotMessage("Perfeito, retirada no balcão. Abrindo pagamento...");
              setTimeout(() => {
                  onCheckout(); 
                  handleClose();
              }, 1500);
              setConversationStep('IDLE');
          } else {
              addLocalBotMessage("Não entendi. Digite 'Entrega' ou 'Retirada'.");
          }
          return;
      }

      // ETAPA 2: PEGAR ENDEREÇO
      if (conversationStep === 'ASKING_ADDRESS') {
          onUpdateAddress({ bairro: texto, rua: texto }); // Atualiza Menu para calcular taxa
          addLocalBotMessage("Anotei. Calculando taxa... Pode confirmar o pedido agora?");
          setConversationStep('CONFIRM_FINAL');
          return;
      }

      // ETAPA 3: CONFIRMAÇÃO FINAL
      if (conversationStep === 'CONFIRM_ADDRESS' || conversationStep === 'CONFIRM_FINAL') {
          if (lower.includes('sim') || lower.includes('pode') || lower.includes('ok') || lower.includes('fech')) {
              addLocalBotMessage(`Fechado! Taxa de entrega: R$ ${taxaEntrega?.toFixed(2) || '0.00'}. Abrindo pagamento...`);
              setTimeout(() => {
                  onCheckout(); 
                  handleClose();
              }, 1500);
              setConversationStep('IDLE');
          } else {
              addLocalBotMessage("Ok, o que deseja alterar? (Digite 'cancelar' para voltar ao cardápio)");
              setConversationStep('IDLE');
          }
      }
  };

  const handleSend = async (textStr) => {
    const textToSend = textStr || message;
    if (!textToSend.trim() || aiThinking) return;
    
    // 🔥 SE ESTIVERMOS NO MEIO DO FLUXO DE ENTREGA, NÃO MANDA PRO BACKEND
    if (conversationStep !== 'IDLE') {
        processarFluxoEntrega(textToSend);
        return;
    }

    // Se não estiver logado, fecha o chat e abre o login
    if (!clienteNome && onRequestLogin) {
        handleClose(); 
        onRequestLogin();
        return;
    }
    
    setMessage('');
    
    // Envia para o Backend (IA)
    const context = {
      estabelecimentoNome: estabelecimento?.nome || 'Restaurante',
      produtosPopulares: SYSTEM_INSTRUCTION(estabelecimento?.nome) + "\n\n📋 CARDÁPIO OFICIAL:\n" + formatarCardapio(produtos),
      clienteNome: clienteNome || 'Visitante',
      history: conversation.slice(-6).map(m => ({ role: m.type === 'user' ? 'user' : 'assistant', content: m.text }))
    };
    await sendMessage(textToSend, context);
  };

  // Combina mensagens globais (IA) com locais (Fluxo Entrega)
  const todasMensagens = [...conversation, ...localMessages].sort((a, b) => a.id - b.id);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      
      <div className="w-full max-w-lg h-[85vh] bg-white rounded-[2rem] shadow-2xl flex flex-col relative overflow-hidden ring-1 ring-white/20">
        
        {showMiniCart && <MiniCart itens={carrinho} onClose={() => setShowMiniCart(false)} onCheckout={() => { onCheckout?.(); handleClose(); }} />}
        
        <ChatHeader onClose={handleClose} statusText={isListening ? 'Ouvindo...' : (aiThinking ? 'Digitando...' : 'Online')} />

        {/* ÁREA DE MENSAGENS */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 custom-scrollbar space-y-6">
           
           <div className="flex justify-start animate-slide-up">
             <div className="flex items-end gap-2 max-w-[90%]">
               <div className="w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-lg shrink-0">🤖</div>
               <div className="bg-white p-4 rounded-2xl rounded-bl-none shadow-sm border border-gray-200 text-gray-800 text-base leading-relaxed">
                 {clienteNome ? 
                   <>Olá, <strong>{clienteNome.split(' ')[0]}</strong>! 😃<br/>Sou o Jucleildo. O que você gostaria de pedir?</> : 
                   <>
                     Olá! Sou o Jucleildo. 
                     <button 
                        onClick={() => { 
                            handleClose(); 
                            if(onRequestLogin) onRequestLogin(); 
                        }} 
                        className="text-red-600 font-bold underline cursor-pointer ml-1"
                     >
                        Entre aqui
                     </button> 
                     {' '}para pedir.
                   </>
                 }
               </div>
             </div>
           </div>

           {todasMensagens.map(msg => (
             <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                <div className={`flex items-end gap-2 max-w-[90%] ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>
                  
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 border shadow-sm ${msg.type === 'user' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-red-500 border-gray-200'}`}>
                      {msg.type === 'user' ? <IoPerson/> : <IoRestaurant/>}
                  </div>

                  {/* BALÃO DE TEXTO */}
                  <div className={`px-4 py-3 rounded-2xl shadow-sm text-base leading-relaxed border ${
                      msg.type === 'user' 
                      ? 'bg-green-600 text-white rounded-br-none border-green-600' 
                      : 'bg-white text-gray-800 rounded-bl-none border-gray-200'
                  }`}>
                    <ReactMarkdown 
                        components={{ 
                            strong: ({node, ...props}) => <span className="block font-bold mt-2 mb-1 text-lg border-b border-white/20 pb-1" {...props} />,
                            ul: ({node, ...props}) => <ul className="w-full mt-1 space-y-1" {...props} />,
                            li: ({node, ...props}) => <li className="flex justify-between items-center py-1 border-b border-dashed border-gray-300 last:border-0" {...props} />,
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
          {!aiThinking && !isListening && clienteNome && conversationStep === 'IDLE' && (
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
             <button 
                type="button" 
                onClick={() => {
                    if(!clienteNome && onRequestLogin) {
                        handleClose();
                        onRequestLogin();
                    } else {
                        toggleMic();
                    }
                }} 
                className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center transition-all shadow-sm ${isListening ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
             >
               <IoMic size={22} />
             </button>
             
             <input 
               type="text" 
               value={isListening ? 'Ouvindo...' : message} 
               onChange={e => setMessage(e.target.value)} 
               placeholder={
                   !clienteNome ? "Faça login" : 
                   conversationStep !== 'IDLE' ? "Responda aqui..." : "Digite aqui..."
               } 
               disabled={isListening}
               onFocus={() => {
                   if (!clienteNome && onRequestLogin) {
                       handleClose();
                       onRequestLogin();
                   }
               }}
               className="flex-1 bg-gray-5 text-gray-900 rounded-full px-5 py-3 text-base focus:bg-white focus:ring-2 focus:ring-green-200 outline-none border border-gray-200 transition-all placeholder-gray-400" 
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