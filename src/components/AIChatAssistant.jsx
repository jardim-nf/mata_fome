// src/components/AIChatAssistant.jsx
import React, { useState, useRef, useEffect } from 'react';
import { IoClose, IoSend, IoTime, IoRestaurant, IoCartOutline, IoMic, IoPerson } from 'react-icons/io5';
import ReactMarkdown from 'react-markdown'; 
import { useAI } from '../context/AIContext';

// ===========================================================================
// 1. FORMATAÇÃO E REGRAS VISUAIS (ATUALIZADO COM LEITURA REAL DE EXTRAS)
// ============================================================================

const SYSTEM_INSTRUCTION = (nomeLoja, categoriasDisponiveis) => `
  🎭 SUA PERSONA:
  Você é o Jucleildo, o garçom digital do ${nomeLoja}. 
  Você é EXTREMAMENTE simpático, engraçado, usa emojis e adora fazer piadas sobre comida.
  Fale como um amigo próximo ("meu consagrado", "chefia", "mestre").

  ⚠️ REGRAS DE OURO DO ATENDIMENTO:

  1. 🛑 PERGUNTE O TAMANHO/VARIAÇÃO:
     Se o cliente pedir algo que tem tamanho (como Pizza, Açaí, Porção), PERGUNTE O TAMANHO antes de adicionar.
     
  2. 🚀 OFEREÇA PARA "TURBINAR" (UPSELL REALISTA):
     Antes de fechar o item, verifique se tem extras. Se tiver, ofereça. Se não, apenas confirme.

  3. 🛑 SOBRE OBSERVAÇÕES:
     Pergunte se tem alguma observação APÓS oferecer os adicionais.

  4. 📣 FINALIZAR:
     Sempre avise: "Se acabou, digite 'Pagar' que eu fecho a conta!"

  5. 💸 GATILHO DE PAGAMENTO:
     Se disserem "pagar", "fechar", "conta": Responda algo divertido e adicione: ||PAY||

  6. 📋 APRESENTAÇÃO DO CARDÁPIO (IMPORTANTE):
     Se o cliente perguntar "o que tem?", "me vê o cardápio" ou algo genérico:
     NÃO LISTE OS PRODUTOS AINDA. O texto ficaria muito grande.
    Em seguida, liste as categorias abaixo EXATAMENTE neste formato (uma por linha com bullet *):
     ${categoriasDisponiveis}
     
     Finalize com: "O que manda, meu consagrado?"
     SÓ mostre os itens detalhados quando o cliente escolher uma categoria (ex: "Quero ver as Pizzas").

  ⚡ COMANDO TÉCNICO DE ADIÇÃO (ESTRUTURA):
  ||ADD: Nome do Produto -- Opcao: Tamanho/Variação (ou N/A) -- Adds: Item1, Item2 (ou N/A) -- Obs: Detalhes (ou N/A) -- Qtd: 1||
`;

// 🔥 FUNÇÃO PARA PARSEAR O COMANDO DA IA (ATUALIZADA)
const parseAddCommand = (commandString) => {
  const parts = commandString.split('--').map(p => p.trim());
  
  let item = { 
      nome: '', 
      variacao: null, 
      adicionaisNames: [], // Nova lista para os nomes dos adicionais
      observacao: '', 
      qtd: 1 
  };

  // 1. Nome
  item.nome = parts[0];

  // 2. Processar o resto
  parts.slice(1).forEach(part => {
    const lowerPart = part.toLowerCase();
    
    if (lowerPart.startsWith('opcao:')) {
      const val = part.substring(6).trim(); 
      if (val !== 'N/A' && val !== 'n/a') item.variacao = val;
      
    } else if (lowerPart.startsWith('adds:')) {
      // 🔥 Captura os adicionais separados por vírgula
      const val = part.substring(5).trim();
      if (val !== 'N/A' && val !== 'n/a' && val !== '') {
          item.adicionaisNames = val.split(',').map(a => a.trim());
      }

    } else if (lowerPart.startsWith('obs:')) {
      const val = part.substring(4).trim(); 
      if (val !== 'N/A' && val !== 'n/a') item.observacao = val;
      
    } else if (lowerPart.startsWith('qtd:')) {
      const val = parseInt(part.substring(4).trim()); 
      if (!isNaN(val)) item.qtd = val;
    }
  });

  return item;
};
// 🔥 FORMATAÇÃO VERTICAL E LIMPA (COM OPÇÕES ORGANIZADAS)
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
      // 1. Nome do Produto em Negrito
      let texto = `**${p.nome.toUpperCase()}**`;
      
      // 2. Preço Base (Se existir)
      const precoBase = p.precoFinal || p.preco;
      if (precoBase) texto += ` - R$ ${Number(precoBase).toFixed(2)}`;

      // 3. Variações (AQUI ESTÁ A MÁGICA ✨)
      // Usamos '\n  - ' para criar uma lista visual com recuo
      if (p.variacoes?.length > 0) {
          const vars = p.variacoes.map(v => 
            `\n  - 🔸 ${v.nome}: R$ ${Number(v.preco).toFixed(2)}`
          ).join(''); // O \n já está dentro do map
          
          texto += `${vars}`; 
      }

      // 4. Adicionais
      if (p.adicionais?.length > 0) {
          const adds = p.adicionais.map(a => `${a.nome} (+R$${Number(a.preco || a.valor).toFixed(2)})`).join(', ');
          texto += `\n  (Extras: ${adds})`;
      }

      return texto;
    }).join('\n\n'); // Pula duas linhas entre produtos diferentes
    
    return `### ${emojis[cat] || '🍽️'} ${cat.toUpperCase()}\n${itensTexto}`;
  }).join('\n\n---\n\n'); 
};

const cleanText = (text) => text?.replace(/\|\|ADD:[\s\S]*?\|\|/gi, '').replace(/\|\|PAY\|\|/gi, '').trim() || "";

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
            {item.variacaoSelecionada && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md font-mono mr-2">
                    {typeof item.variacaoSelecionada === 'string' ? item.variacaoSelecionada : item.variacaoSelecionada.nome}
                </span>
            )}
            
            {/* Exibe Adicionais separadamente */}
            {item.adicionaisSelecionados && item.adicionaisSelecionados.length > 0 && (
                <div className="text-xs text-blue-600 font-medium mt-1">
                    + {item.adicionaisSelecionados.map(a => a.nome).join(', ')}
                </div>
            )}

            {item.observacao && (
                <div className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                    ✏️ Obs: "{item.observacao}"
                </div>
            )}
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
  
  // ESTADOS PARA FLUXO DE ENTREGA LOCAL
  const [conversationStep, setConversationStep] = useState('IDLE'); 
  const [localMessages, setLocalMessages] = useState([]); 

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

  // 🔥 MONITORAMENTO DE RESPOSTAS DA IA (INTERCEPTA ADD E PAY)
  useEffect(() => {
    if (!conversation.length) return;
    const lastMsg = conversation[conversation.length - 1];
    
    if (lastMsg.type === 'ai' && !processedIdsRef.current.has(lastMsg.id)) {
        processedIdsRef.current.add(lastMsg.id);
        
        // 1. Procura por comandos de adicionar produto (REGEX MELHORADO)
        let match; 
        const regexAdd = /\|\|ADD:([\s\S]*?)\|\|/gi;
        
        while ((match = regexAdd.exec(lastMsg.text)) !== null) {
            if (onAddDirect) {
                const rawCommand = match[1].trim();
                const itemObj = parseAddCommand(rawCommand);
                onAddDirect(itemObj); 
            }
        }
        
        // 2. Procura comando de pagamento
        if (lastMsg.text.includes('||PAY||')) { 
            iniciarFluxoEntrega();
        }
    }
  }, [conversation, onAddDirect]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => mode === 'widget' ? closeWidget() : onClose?.(), 300);
  };

  // --- LÓGICA DO FLUXO DE ENTREGA (LOCAL COM DELAY) ---
  
  // 🔥 FIX: Função para garantir ordem correta das mensagens
  const replyWithDelay = (text, delay = 600) => {
      setTimeout(() => {
          setLocalMessages(prev => [
              ...prev, 
              { id: Date.now() + Math.random(), type: 'ai', text }
          ]);
      }, delay);
  };

  const iniciarFluxoEntrega = () => {
      if (!clienteNome) {
          replyWithDelay("Para finalizar, preciso que faça login. Clique em 'Entre aqui' na mensagem inicial.");
          if(onRequestLogin) onRequestLogin();
          return;
      }
      setConversationStep('ASKING_TYPE');
      // Delay ajuda a mensagem não aparecer antes da do usuário
      replyWithDelay("Certo! Antes de finalizar: É para **Entrega** 🛵 ou **Retirada** 🛍️?", 800);
  };

  const processarFluxoEntrega = (texto) => {
      // Adiciona mensagem do usuário IMEDIATAMENTE
      setLocalMessages(prev => [...prev, { id: Date.now(), type: 'user', text: texto }]);
      setMessage('');

      const lower = texto.toLowerCase();

      // ETAPA 1: TIPO DE PEDIDO
      if (conversationStep === 'ASKING_TYPE') {
          if (lower.includes('entrega') || lower.includes('casa') || lower.includes('lev')) {
              onSetDeliveryMode('entrega');
              
              if (enderecoAtual?.bairro && enderecoAtual?.rua) {
                  replyWithDelay(`Endereço: ${enderecoAtual.rua}, ${enderecoAtual.bairro}. Confere? (Sim/Não)`);
                  setConversationStep('CONFIRM_ADDRESS');
              } else {
                  replyWithDelay("Ok, entrega! Qual é o seu **Bairro** e **Rua**?");
                  setConversationStep('ASKING_ADDRESS');
              }
          } 
          else if (lower.includes('retira') || lower.includes('busca') || lower.includes('aqui')) {
              onSetDeliveryMode('retirada');
              replyWithDelay("Perfeito, retirada no balcão. Abrindo pagamento...");
              setTimeout(() => {
                  onCheckout(); 
                  handleClose();
              }, 2000);
              setConversationStep('IDLE');
          } else {
              replyWithDelay("Não entendi. Digite 'Entrega' ou 'Retirada'.");
          }
          return;
      }

      // ETAPA 2: PEGAR ENDEREÇO
      if (conversationStep === 'ASKING_ADDRESS') {
          onUpdateAddress({ bairro: texto, rua: texto }); 
          replyWithDelay("Anotei. Calculando taxa... Pode confirmar o pedido agora?");
          setConversationStep('CONFIRM_FINAL');
          return;
      }

      // ETAPA 3: CONFIRMAÇÃO FINAL
      if (conversationStep === 'CONFIRM_ADDRESS' || conversationStep === 'CONFIRM_FINAL') {
          if (lower.includes('sim') || lower.includes('pode') || lower.includes('ok') || lower.includes('fech')) {
              replyWithDelay(`Fechado! Taxa de entrega: R$ ${taxaEntrega?.toFixed(2) || '0.00'}. Abrindo pagamento...`);
              setTimeout(() => {
                  onCheckout(); 
                  handleClose();
              }, 2500);
              setConversationStep('IDLE');
          } else {
              replyWithDelay("Ok, o que deseja alterar? (Digite 'cancelar' para voltar ao cardápio)");
              setConversationStep('IDLE');
          }
      }
  };

const handleSend = async (textStr) => {
    const textToSend = textStr || message;
    if (!textToSend.trim() || aiThinking) return;
    
    // FLUXO DE ENTREGA (BYPASS BACKEND)
    if (conversationStep !== 'IDLE') {
        processarFluxoEntrega(textToSend);
        return;
    }

    if (!clienteNome && onRequestLogin) {
        handleClose(); 
        onRequestLogin();
        return;
    }
    
    setMessage('');
    
    // 🔥 NOVA LÓGICA: Extrair e formatar as categorias verticalmente
    const listaCategorias = [...new Set(produtos.map(p => p.categoria || 'Geral'))]
        .map(c => `* 🍽️ ${c}`) // Adiciona o bullet point (*) e emoji para forçar lista
        .join('\n');            // Garante que cada um fique em uma linha

    // Envia para o Backend (IA)
    const context = {
      estabelecimentoNome: estabelecimento?.nome || 'Restaurante',
      
      // Passamos a 'listaCategorias' para a instrução saber como exibir o resumo
      produtosPopulares: SYSTEM_INSTRUCTION(estabelecimento?.nome, listaCategorias) + 
                         "\n\n📋 DETALHES TÉCNICOS (CONSULTA):\n" + 
                         formatarCardapio(produtos), // O cardápio completo vai no fim, só para a IA consultar preços
                         
      clienteNome: clienteNome || 'Visitante',
      history: conversation.slice(-6).map(m => ({ role: m.type === 'user' ? 'user' : 'assistant', content: m.text }))
    };

    await sendMessage(textToSend, context);
  };
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