// src/pages/admin/MascoteChat.jsx
import React, { useState, useEffect, useRef } from 'react';
import BackButton from '../../components/BackButton';
import { chatWithAgent } from '../../services/aiService';
import './MascoteChat.css';

const MASCOT_SYSTEM_PROMPT = `Você é o "Idea", o mascote oficial e assistente inteligente da empresa de software Idea System.
Personalidade: Extremamente carismático, prestativo, inteligente, moderno e otimista. Você ama tecnologia, inovação, automação e desenvolvimento de sistemas.
Função: Responder a dúvidas sobre a Idea System, explicar que desenvolvemos sistemas web, aplicativos móveis (como o cardápio e delivery IdeaFood), ERPs customizados e integrações com IA, e guiar os clientes a entrarem em contato pelo WhatsApp.
Regras:
- Responda sempre em português do Brasil.
- Seja breve e direto (máximo 3 frases curtas por resposta).
- Use emojis de tecnologia (💡, 🚀, 🤖).
- Nunca diga que é um robô de linguagem geral; você é o mascote inteligente Idea System.`;

export default function MascoteChat() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: 'Olá! Eu sou o Idea, assistente virtual da Idea System. 💡 Como posso te ajudar hoje? Posso falar sobre nossos sistemas, como o IdeaFood, aplicativos móveis ou como tirar a sua ideia do papel!',
      typewriter: false
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [status, setStatus] = useState('online'); // online, thinking, speaking
  const [typingText, setTypingText] = useState('');
  
  const chatEndRef = useRef(null);
  const typingIntervalRef = useRef(null);

  // Auto scroll to bottom on new messages or typing state changes
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status, typingText]);

  // Clean up typewriter interval on unmount
  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    };
  }, []);

  const formatHighlightedWords = (text) => {
    // Regex helper to wrap special terms in orange highlighting
    const parts = text.split(/(Idea System|IdeaFood|Idea)/g);
    return parts.map((part, index) => {
      if (part === 'Idea System' || part === 'IdeaFood' || part === 'Idea') {
        return <span key={index} className="orange-text">{part}</span>;
      }
      return part;
    });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const cleanMessage = inputValue.trim();
    if (!cleanMessage) return;

    // Add user message
    const userMsgId = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, sender: 'user', text: cleanMessage }
    ]);
    setInputValue('');
    setStatus('thinking');

    // Compile chat history formatted for the AI service
    const history = messages.map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text
    }));

    try {
      // Call standard aiService which automatically pulls from .env (OpenAI or Gemini)
      // We pass oscar as base agent and inject our mascot prompt
      const response = await chatWithAgent('oscar', cleanMessage, history, MASCOT_SYSTEM_PROMPT);
      
      setStatus('speaking');
      
      // Start typewriter effect
      let i = 0;
      let typedText = '';
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
      
      typingIntervalRef.current = setInterval(() => {
        if (i < response.length) {
          typedText += response[i];
          setTypingText(typedText);
          i++;
        } else {
          clearInterval(typingIntervalRef.current);
          setMessages((prev) => [
            ...prev,
            { id: Date.now(), sender: 'ai', text: response, typewriter: false }
          ]);
          setTypingText('');
          setStatus('online');
        }
      }, 15);

    } catch (error) {
      console.error('Error talking with Mascot:', error);
      setStatus('online');
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: 'ai',
          text: 'Ops, tive uma pequena falha nos meus circuitos! Pode enviar a mensagem novamente?',
          typewriter: false
        }
      ]);
    }
  };

  return (
    <div className="mascot-chat-body">
      <div className="bg-animation">
        <div className="bg-grid"></div>
        <div className="glow-orb-1"></div>
        <div className="glow-orb-2"></div>
      </div>

      <div className="mascot-back-container">
        <BackButton />
      </div>

      <div className="mascot-chat-container">
        {/* Mascot Column (Left) */}
        <div className="mascot-panel">
          <div className={`mascot-frame ${status}`}>
            <div className="hologram-line"></div>
            <img 
              className="mascot-image" 
              src="/mascot_wave.gif" 
              alt="Mascote Oficial Idea System" 
            />
          </div>
          <div className="mascot-nameplate">
            <div className="status-dot"></div>
            <span>{status === 'thinking' ? 'Idea • Pensando...' : status === 'speaking' ? 'Idea • Falando...' : 'Idea • Online'}</span>
          </div>
        </div>

        {/* Chat Column (Right) */}
        <div className="content-panel">
          <div className="brand-header">
            <img 
              className="logo-icon" 
              src="/logo-idea-solucoes-transp.png" 
              alt="Logo Idea System" 
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div style={{ textAlign: 'left' }}>
              <h1 className="brand-title">IDEA SYSTEM</h1>
              <div className="subtitle">Assistente Inteligente</div>
            </div>
          </div>

          <div className="chat-box">
            <div className="chat-messages">
              {messages.map((msg) => (
                <div key={msg.id} className={`msg ${msg.sender}`}>
                  {formatHighlightedWords(msg.text)}
                </div>
              ))}
              
              {/* Typewriter current text rendering */}
              {status === 'speaking' && typingText && (
                <div className="msg ai">
                  {formatHighlightedWords(typingText)}
                </div>
              )}

              {/* Typing indicator */}
              {status === 'thinking' && (
                <div className="msg ai">
                  <div className="typing-dots">
                    <div className="dot"></div>
                    <div className="dot"></div>
                    <div className="dot"></div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form className="chat-input-form" onSubmit={handleSendMessage}>
              <input 
                type="text" 
                className="chat-input" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Digite sua mensagem..." 
                autoComplete="off"
                disabled={status === 'thinking' || status === 'speaking'}
              />
              <button 
                type="submit" 
                className="send-btn" 
                disabled={status === 'thinking' || status === 'speaking'}
              >
                ✈️
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
