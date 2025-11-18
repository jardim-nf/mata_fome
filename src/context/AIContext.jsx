// context/AIContext.jsx - VERSÃO DINÂMICA
import React, { createContext, useContext, useState, useCallback } from 'react';

const AIContext = createContext();

export const useAI = () => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within an AIProvider');
  }
  return context;
};

export const AIProvider = ({ children }) => {
  const [aiThinking, setAiThinking] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [isWidgetOpen, setIsWidgetOpen] = useState(false); // 🔥 NOVO: Estado do widget
  const [widgetPosition, setWidgetPosition] = useState({ bottom: 20, right: 20 }); // 🔥 NOVO: Posição do widget

  // 🔥 NOVO: Alternar visibilidade do widget
  const toggleWidget = useCallback(() => {
    setIsWidgetOpen(prev => !prev);
  }, []);

  // 🔥 NOVO: Fechar widget
  const closeWidget = useCallback(() => {
    setIsWidgetOpen(false);
  }, []);

  // 🔥 NOVO: Abrir widget
  const openWidget = useCallback(() => {
    setIsWidgetOpen(true);
  }, []);

  // 🔥 IA ESPECIALIZADA EM ATENDIMENTO DE PEDIDOS
  const simulateAIResponse = async (userMessage, context) => {
    setAiThinking(true);
    
    // Simula processamento
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const lowerMessage = userMessage.toLowerCase();
    
    // RESPOSTAS ESPECÍFICAS PARA CARDÁPIO
    const responses = {
      // ... (mantenha as mesmas respostas do código anterior)
      'oi': `Olá! Bem-vindo ao ${context.estabelecimentoNome}. Sou seu assistente virtual! 😊
      
Posso ajudar você com:
• 📋 Informações sobre produtos
• ⏰ Tempo de preparo
• 🚚 Informações de entrega
• 💳 Formas de pagamento
• 📞 Contato do estabelecimento

Em que posso ajudar?`,

      'ola': `Olá! Bem-vindo ao ${context.estabelecimentoNome}. Sou seu assistente virtual! 😊

Posso ajudar você com:
• 📋 Informações sobre produtos
• ⏰ Tempo de preparo
• 🚚 Informações de entrega
• 💳 Formas de pagamento
• 📞 Contato do estabelecimento

Em que posso ajudar?`,

      // ... (demais respostas permanecem iguais)
      'default': `🤖 **Assistente Virtual**
Não entendi completamente, mas posso ajudar com:

• 📋 Cardápio e produtos
• ⏰ Horários e prazos  
• 🚚 Entregas e taxas
• 💳 Pagamentos
• 📞 Contato

O que você gostaria de saber? 😊`
    };

    // LÓGICA DE DETECÇÃO DE INTENÇÃO
    let response = responses.default;

    if (lowerMessage.includes('oi') || lowerMessage.includes('olá')) response = responses.oi;
    else if (lowerMessage.includes('horário') || lowerMessage.includes('funcionamento')) response = responses.horario;
    else if (lowerMessage.includes('telefone') || lowerMessage.includes('fone') || lowerMessage.includes('contato')) response = responses.telefone;
    else if (lowerMessage.includes('endereço') || lowerMessage.includes('local')) response = responses.endereco;
    else if (lowerMessage.includes('pagamento') || lowerMessage.includes('pagar') || lowerMessage.includes('cartão')) response = responses.pagamento;
    else if (lowerMessage.includes('pix')) response = responses.pix;
    else if (lowerMessage.includes('entrega') || lowerMessage.includes('delivery')) response = responses.entrega;
    else if (lowerMessage.includes('taxa') || lowerMessage.includes('frete')) response = responses.taxa;
    else if (lowerMessage.includes('tempo') || lowerMessage.includes('demora') || lowerMessage.includes('prazo')) response = responses.tempo;
    else if (lowerMessage.includes('cardápio') || lowerMessage.includes('menu')) response = responses.cardapio;
    else if (lowerMessage.includes('recomenda') || lowerMessage.includes('sugestão') || lowerMessage.includes('popular')) response = responses.recomendacao;
    else if (lowerMessage.includes('problema') || lowerMessage.includes('erro') || lowerMessage.includes('errado')) response = responses.problema;
    else if (lowerMessage.includes('cancelar') || lowerMessage.includes('cancelamento')) response = responses.cancelar;

    setAiThinking(false);
    return response;
  };

  const sendMessage = useCallback(async (userMessage, context) => {
    if (!userMessage.trim()) return;

    // Adiciona mensagem do usuário
    const userMsg = { 
      type: 'user', 
      text: userMessage, 
      time: new Date(),
      id: Date.now() + Math.random()
    };
    
    setConversation(prev => [...prev.slice(-9), userMsg]); // Mantém apenas últimas 10 mensagens

    // Simula resposta da IA
    const aiText = await simulateAIResponse(userMessage, context);
    const aiMsg = { 
      type: 'ai', 
      text: aiText, 
      time: new Date(),
      id: Date.now() + Math.random()
    };
    
    setConversation(prev => [...prev, aiMsg]);
    return aiText;
  }, []);

  const clearConversation = useCallback(() => {
    setConversation([]);
  }, []);

  const value = {
    aiThinking,
    conversation,
    sendMessage,
    clearConversation,
    setAiThinking,
    // 🔥 NOVOS: Controles do widget
    isWidgetOpen,
    toggleWidget,
    closeWidget,
    openWidget,
    widgetPosition,
    setWidgetPosition
  };

  return (
    <AIContext.Provider value={value}>
      {children}
    </AIContext.Provider>
  );
};