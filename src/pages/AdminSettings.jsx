// src/components/AIChatAssistant.jsx
import React, { useState, useEffect, useRef } from 'react';
import { IoSend, IoClose, IoChatbubbleEllipses } from 'react-icons/io5';
import { useAI } from '../context/AIContext'; // 🔥 Importando teu Contexto de IA

export default function AIChatAssistant({ 
    estabelecimento, 
    produtos, 
    carrinho, 
    clienteNome, 
    
    // Props vindas do Menu.jsx
    taxaEntrega,
    enderecoAtual,
    isRetirada,
    onSetDeliveryMode,
    onUpdateAddress,
    
    onAddDirect, 
    onCheckout, 
    onClose, 
    onRequestLogin, 
    mode = 'widget',
    onClick // fallback para checkout
}) {
    const { sendMessage } = useAI(); // 🔥 Usando a função do teu backend
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    
    // Estados do Fluxo de Entrega (Interceptação)
    const [conversationStep, setConversationStep] = useState('IDLE'); // IDLE, ASKING_TYPE, ASKING_ADDRESS
    const scrollRef = useRef(null);

    // Mensagem inicial
    useEffect(() => {
        if (messages.length === 0) {
            setMessages([{ 
                sender: 'bot', 
                text: clienteNome 
                    ? `Olá ${clienteNome}! Sou o assistente do ${estabelecimento.nome}. O que vai querer? 🍕` 
                    : `Olá! Sou o assistente do ${estabelecimento.nome}. Posso anotar seu pedido?`
            }]);
        }
    }, [clienteNome, estabelecimento.nome]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, isTyping]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = input;
        setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
        setInput('');
        
        // --- 1. VERIFICA SE ESTAMOS NO FLUXO DE ENTREGA (FRONTEND) ---
        if (conversationStep !== 'IDLE') {
            processarFluxoEntrega(userMsg);
            return;
        }

        // --- 2. SE NÃO, MANDA PRO BACKEND (IA) ---
        setIsTyping(true);
        try {
            // Contexto para a IA saber o que tem no carrinho e menu
            const context = {
                cardapio: produtos.map(p => `${p.nome} (R$ ${p.preco})`).join(', '),
                carrinho: carrinho.map(i => `${i.qtd}x ${i.nome}`).join(', '),
                cliente: clienteNome
            };

            const response = await sendMessage(userMsg, context);
            const replyText = response.reply || "Desculpe, não entendi.";

            // --- 3. INTERCEPTA COMANDOS DO BACKEND ---
            
            // CASO A: IA mandou finalizar (||PAY||)
            if (replyText.includes('||PAY||')) {
                // Remove a tag para não mostrar ao usuário
                const cleanText = replyText.replace('||PAY||', '').trim();
                
                if (cleanText) {
                    setMessages(prev => [...prev, { sender: 'bot', text: cleanText }]);
                }

                // 🔥 AQUI ESTÁ O TRUQUE: Não fecha direto. Pergunta Entrega/Retirada.
                iniciarFluxoEntrega(); 
            } 
            // CASO B: IA mandou adicionar item (Ex: Coca-Cola -- Opcao: ... -- Qtd: 1)
            // Adapte essa verificação conforme seu backend retorna (ex: ||ADD|| ou texto formatado)
            else if (replyText.includes('-- Qtd:') || replyText.includes('||ADD||')) {
                const cleanText = replyText.replace('||ADD||', '').trim();
                setMessages(prev => [...prev, { sender: 'bot', text: cleanText }]);
                
                // Tenta adicionar ao carrinho
                const resultado = onAddDirect(cleanText); 
                if (resultado === 'NOT_FOUND') {
                    setMessages(prev => [...prev, { sender: 'bot', text: "Tentei adicionar, mas não achei o item exato. Pode verificar o nome?" }]);
                }
            }
            // CASO C: Conversa normal
            else {
                setMessages(prev => [...prev, { sender: 'bot', text: replyText }]);
            }

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { sender: 'bot', text: "Tive um erro de conexão. Tente novamente." }]);
        } finally {
            setIsTyping(false);
        }
    };

    // --- LÓGICA DO FLUXO DE ENTREGA (LOCAL) ---
    
    const iniciarFluxoEntrega = () => {
        if (!clienteNome) {
            setMessages(prev => [...prev, { sender: 'bot', text: "Para fechar o pedido, preciso que faça login. Clique em 'Entrar' lá em cima!" }]);
            onRequestLogin();
            return;
        }

        // Se já sabemos que é retirada ou entrega E temos endereço, finaliza direto
        /* Comentado para forçar a confirmação, mas você pode descomentar se quiser agilidade
           if (isRetirada || (enderecoAtual?.bairro && enderecoAtual?.rua)) {
               confirmarEFechar();
               return;
           }
        */

        setConversationStep('ASKING_TYPE');
        // Adiciona mensagem da IA perguntando
        setTimeout(() => {
            setMessages(prev => [...prev, { sender: 'bot', text: "Certo! Antes de finalizar: É para **Entrega** 🛵 ou **Retirada** 🛍️?" }]);
        }, 500);
    };

    const processarFluxoEntrega = (texto) => {
        const lower = texto.toLowerCase();
        
        // ETAPA 1: TIPO DE ENTREGA
        if (conversationStep === 'ASKING_TYPE') {
            if (lower.includes('entrega') || lower.includes('casa') || lower.includes('lev')) {
                onSetDeliveryMode('entrega'); // Atualiza Menu.jsx
                
                if (enderecoAtual?.bairro && enderecoAtual?.rua) {
                    // Já tem endereço
                    setMessages(prev => [...prev, { sender: 'bot', text: `Endereço: ${enderecoAtual.rua}, ${enderecoAtual.numero} - ${enderecoAtual.bairro}. Confere? (Sim/Não)` }]);
                    setConversationStep('CONFIRM_ADDRESS');
                } else {
                    setMessages(prev => [...prev, { sender: 'bot', text: "Ok, entrega! Qual é o seu **Bairro** e **Rua**?" }]);
                    setConversationStep('ASKING_ADDRESS');
                }
            } 
            else if (lower.includes('retira') || lower.includes('busca') || lower.includes('aqui')) {
                onSetDeliveryMode('retirada'); // Atualiza Menu.jsx
                setMessages(prev => [...prev, { sender: 'bot', text: "Perfeito, retirada no balcão. Abrindo pagamento..." }]);
                setTimeout(abrirPagamento, 1500);
                setConversationStep('IDLE');
            } else {
                setMessages(prev => [...prev, { sender: 'bot', text: "Não entendi. Digite 'Entrega' ou 'Retirada'." }]);
            }
            return;
        }

        // ETAPA 2: PEGAR ENDEREÇO (Se não tiver)
        if (conversationStep === 'ASKING_ADDRESS') {
            // Aqui fazemos uma atualização "bruta" para o cálculo da taxa funcionar
            // O ideal seria pedir campo a campo, mas vamos simplificar para o chat
            onUpdateAddress({ 
                bairro: texto, // Assume que o usuário digitou algo como "Centro, Rua X"
                rua: texto 
            });
            
            setMessages(prev => [...prev, { sender: 'bot', text: "Anotei. Calculando taxa... Pode confirmar o pedido agora?" }]);
            setConversationStep('CONFIRM_FINAL');
            return;
        }

        // ETAPA 3: CONFIRMAÇÃO FINAL
        if (conversationStep === 'CONFIRM_ADDRESS' || conversationStep === 'CONFIRM_FINAL') {
            if (lower.includes('sim') || lower.includes('pode') || lower.includes('ok') || lower.includes('confirm')) {
                setMessages(prev => [...prev, { sender: 'bot', text: `Fechado! Taxa de entrega: R$ ${taxaEntrega.toFixed(2)}. Abrindo pagamento...` }]);
                setTimeout(abrirPagamento, 1500);
                setConversationStep('IDLE');
            } else {
                setMessages(prev => [...prev, { sender: 'bot', text: "Ok, o que deseja alterar? (Digite 'cancelar' para voltar ao cardápio)" }]);
                setConversationStep('IDLE'); // Volta ao modo IA normal para correções
            }
        }
    };

    const abrirPagamento = () => {
        onCheckout(); // Abre o modal do Menu.jsx
        // Opcional: fechar o chat no mobile
        // onClose(); 
    };

    return (
        <div className={`fixed z-[99999] transition-all duration-300 flex flex-col bg-white shadow-2xl border border-gray-200
            ${mode === 'center' 
                ? 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md h-[500px] rounded-2xl' 
                : 'bottom-24 right-6 w-80 h-96 rounded-2xl'
            }`}>
            
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-green-500 p-4 rounded-t-2xl flex justify-between items-center text-white">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">🤖</div>
                    <div>
                        <h3 className="font-bold text-sm">Assistente {estabelecimento.nome}</h3>
                        <p className="text-xs opacity-90">{isTyping ? 'Digitando...' : 'Online'}</p>
                    </div>
                </div>
                <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full"><IoClose size={20} /></button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
                            msg.sender === 'user' ? 'bg-green-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none border border-gray-100'
                        }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {isTyping && <div className="flex justify-start"><div className="bg-white p-3 rounded-2xl rounded-bl-none border"><IoChatbubbleEllipses className="text-gray-400 animate-pulse" /></div></div>}
            </div>

            {/* Input */}
            <div className="p-3 bg-white border-t rounded-b-2xl">
                <div className="flex items-center gap-2 bg-gray-100 p-1 pr-2 rounded-full border focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-100 transition-all">
                    <input
                        className="flex-1 bg-transparent px-4 py-2 outline-none text-sm text-gray-700"
                        placeholder={conversationStep !== 'IDLE' ? "Responda aqui..." : "Digite seu pedido..."}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        autoFocus={mode === 'center'}
                    />
                    <button onClick={handleSend} disabled={!input.trim()} className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 disabled:opacity-50 transition-all shadow-sm active:scale-95">
                        <IoSend size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}