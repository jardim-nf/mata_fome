// src/context/AIContext.jsx
import React, { createContext, useState, useContext } from 'react';
// Importações do Firebase Functions
import { getFunctions, httpsCallable } from 'firebase/functions';
import { v4 as uuidv4 } from 'uuid';

// Valor padrão garante que useAI() nunca retorna undefined (ex: Menu fora do AIProvider)
const AIContext = createContext({
  isWidgetOpen: false,
  toggleWidget: () => {},
  closeWidget: () => {},
  openWidget: () => {},
  conversation: [],
  sendMessage: async () => {},
  aiThinking: false
});

export const useAI = () => useContext(AIContext);

export const AIProvider = ({ children }) => {
    const [isWidgetOpen, setIsWidgetOpen] = useState(false);
    const [conversation, setConversation] = useState([]);
    const [aiThinking, setAiThinking] = useState(false);

    // ID da sessão para manter o contexto da conversa
    const [sessionId] = useState(() => uuidv4());

    const toggleWidget = () => setIsWidgetOpen(prev => !prev);
    const closeWidget = () => setIsWidgetOpen(false);
    const openWidget = () => setIsWidgetOpen(true);

    const sendMessage = async (text, context = {}) => {
        if (!text.trim()) return;

        // 1. Adiciona mensagem do usuário na tela imediatamente
        const userMsg = {
            id: uuidv4(),
            text: text,
            type: 'user',
            time: new Date().toISOString()
        };

        setConversation(prev => [...prev, userMsg]);
        setAiThinking(true);

        console.log("🚀 AIContext: Enviando para Backend...", { message: text, context });

        try {
            // ==========================================================
            // CONFIGURAÇÃO DA CONEXÃO COM O SERVIDOR (CLOUD FUNCTION)
            // ==========================================================
            
            const functions = getFunctions();
            
            // ⚠️ IMPORTANTE: 'chatAgent' deve ser o nome EXATO da exportação no seu functions/index.js
            // Exemplo no backend: exports.chatAgent = onCall(...)
            const chatFunction = httpsCallable(functions, 'chatAgent'); 
            
            const response = await chatFunction({
                message: text,
                context: context,
                sessionId: sessionId
            });
            
            console.log("✅ Resposta do Backend:", response.data);

            // Tenta pegar a resposta em vários formatos possíveis
            const aiReplyText = response.data?.reply || response.data?.message || response.data?.text || "Resposta vazia da IA.";

            const aiMsg = {
                id: uuidv4(),
                text: aiReplyText,
                type: 'ai',
                time: new Date().toISOString()
            };

            setConversation(prev => [...prev, aiMsg]);

        } catch (error) {
            // 🔥 LOG DE ERRO REAL (Verifique isso no F12 se der erro)
            console.error("❌ ERRO NO AI CONTEXT:", error);
            console.error("Código do erro:", error.code);
            console.error("Mensagem:", error.message);

            // Mensagem amigável para o usuário, mas diferente dependendo do erro
            let msgErro = "Erro interno no assistente.";
            
            if (error.code === 'functions/not-found') {
                msgErro = "Erro de configuração: Função de IA não encontrada no servidor.";
            } else if (error.code === 'functions/unavailable') {
                msgErro = "Servidor indisponível ou sem conexão.";
            }

            const errorMsg = {
                id: uuidv4(),
                text: `⚠️ ${msgErro}`,
                type: 'ai',
                time: new Date().toISOString(),
                isError: true
            };
            setConversation(prev => [...prev, errorMsg]);
        } finally {
            setAiThinking(false);
        }
    };

    return (
        <AIContext.Provider value={{
            isWidgetOpen,
            toggleWidget,
            closeWidget,
            openWidget,
            conversation,
            sendMessage,
            aiThinking
        }}>
            {children}
        </AIContext.Provider>
    );
};