// src/components/home/MascotWidget.jsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import { useAuth } from '../../context/AuthContext';

const WHATSAPP_PHONE = '5522998102575';

const MascotWidget = () => {
  const { currentUser, userData, estabelecimentoIdPrincipal, estabelecimentoInfo } = useAuth() || {};
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [status, setStatus] = useState('online'); // online, thinking, speaking
  const [ticketId, setTicketId] = useState(null);
  
  const chatEndRef = useRef(null);

  const userName = currentUser?.displayName || userData?.nome || 'Cliente';
  const establishmentId = estabelecimentoIdPrincipal || 'master';
  const establishmentName = estabelecimentoInfo?.nome || userData?.estabelecimentoNome || userData?.nomeEstabelecimento || 'Parceiro Idea System';

  // Real-time Firestore sync for chat history (Read-only on client side)
  useEffect(() => {
    if (!currentUser?.uid) return;

    const docRef = doc(db, 'suporte_conversas', currentUser.uid);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setMessages(data.mensagens || []);
        setTicketId(data.shortId || null);
      } else {
        // Default support greeting if no Firestore document exists yet
        setMessages([
          {
            id: 1,
            sender: 'ai',
            text: `Olá, ${userName}! Eu sou o Idea, assistente de suporte da Idea System. 💡 Qualquer dúvida ou problema com o sistema, digite aqui embaixo! Eu repassarei sua mensagem em tempo real para o WhatsApp do Matheus, e a resposta dele aparecerá diretamente aqui no nosso chat em instantes! 🚀`
          }
        ]);
        setTicketId(null);
      }
    }, (error) => {
      console.warn("Firestore snapshot subscription error:", error);
    });

    return () => unsubscribe();
  }, [currentUser, userName]);

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  // Highlight keywords
  const formatHighlightedWords = (text) => {
    if (typeof text !== 'string') return text;
    const parts = text.split(/(Idea System|IdeaFood|Idea|Matheus)/g);
    return parts.map((part, index) => {
      if (part === 'Idea System' || part === 'IdeaFood' || part === 'Idea' || part === 'Matheus') {
        return (
          <span key={index} className="text-orange-400 font-bold drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Pre-fill WhatsApp message link for direct fallback
  const getWhatsAppUrl = () => {
    const baseMessage = `Olá Matheus! Sou o ${userName} do estabelecimento "${establishmentName}".`;
    const extraText = ticketId ? `\n\n[Suporte #${ticketId}] Preciso de ajuda com o sistema.` : '\n\nPreciso de suporte técnico sobre o sistema.';
    return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(baseMessage + extraText)}`;
  };

  const handleSendMessage = async (textToSend) => {
    const cleanMessage = textToSend.trim();
    if (!cleanMessage) return;

    if (!currentUser?.uid) return;

    setInputVal('');
    setStatus('thinking');

    try {
      // Call Callable Function to save message in Firestore and notify Matheus via WhatsApp
      const enviarNotificacaoSuporteFn = httpsCallable(functions, 'enviarNotificacaoSuporte');
      const res = await enviarNotificacaoSuporteFn({
        text: cleanMessage,
        establishmentId,
        userName,
        establishmentName
      });
      
      if (res?.data?.shortId) {
        setTicketId(res.data.shortId);
      }
      
      setStatus('online');
    } catch (err) {
      console.error('Error notifying support via Cloud Function:', err);
      setStatus('online');
      
      // Fallback local message if Cloud Function fails
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: 'user',
          text: cleanMessage
        },
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: `⚠️ Ops! Tivemos uma falha ao enviar sua mensagem pelo sistema. Por favor, clique no botão "Falar com Matheus (WhatsApp)" no rodapé para falar diretamente com ele! 📲`
        }
      ]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSendMessage(inputVal);
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
    setShowTooltip(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-4 font-sans">
      {/* Floating Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 50, x: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 50, x: 20 }}
            transition={{ type: 'spring', damping: 20 }}
            className="w-[380px] h-[520px] max-w-[calc(100vw-2rem)] flex flex-col rounded-[2rem] border border-white/10 bg-slate-950/90 backdrop-blur-xl shadow-2xl overflow-hidden text-white"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-full border border-orange-500/30 bg-slate-900/60 overflow-hidden flex items-center justify-center p-1 shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                  <img src="/mascot_wave.gif" alt="Idea" className="w-full h-full object-contain" />
                  {status !== 'thinking' && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full animate-pulse"></span>
                  )}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-black text-sm uppercase tracking-wider text-orange-400">Idea System</h4>
                    {ticketId && (
                      <span className="text-[10px] bg-white/15 px-1.5 py-0.5 rounded text-slate-300 font-mono">#{ticketId}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-medium">
                    {status === 'thinking' ? 'Enviando...' : 'Idea • Suporte Online'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-900/20">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3.5 rounded-2xl text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-tr-none shadow-md shadow-orange-500/10'
                        : msg.sender === 'admin'
                        ? 'bg-emerald-600/30 border border-emerald-500/20 text-emerald-250 rounded-tl-none shadow-lg shadow-emerald-500/5'
                        : 'bg-white/5 border border-white/5 text-slate-100 rounded-tl-none'
                    }`}
                  >
                    {formatHighlightedWords(msg.text)}
                  </div>
                </div>
              ))}

              {/* Sending / Thinking indicator */}
              {status === 'thinking' && (
                <div className="flex justify-start">
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 rounded-tl-none flex gap-1 items-center">
                    <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                    <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                    <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Footer */}
            <div className="p-3 border-t border-white/5 bg-slate-950">
              <form onSubmit={handleSubmit} className="flex gap-2 items-center bg-white/5 rounded-xl px-3 py-1.5 border border-white/10 focus-within:border-orange-500/50 transition-colors">
                <input
                  type="text"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder="Explique sua dúvida/problema..."
                  className="flex-1 bg-transparent border-none text-sm focus:outline-none focus:ring-0 text-white placeholder-slate-500"
                  disabled={status === 'thinking'}
                />
                <button
                  type="submit"
                  disabled={!inputVal.trim() || status === 'thinking'}
                  className="p-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:hover:bg-orange-500 text-slate-950 font-black transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* WhatsApp Link fallback */}
            <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 py-2 border-t border-white/5 text-center">
              <a
                href={getWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 font-bold uppercase tracking-wider transition-colors"
              >
                <span>Falar com Matheus (WhatsApp)</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button + Welcome Tooltip */}
      <div className="relative flex flex-col items-end">
        {/* Welcome Tooltip */}
        <AnimatePresence>
          {showTooltip && !isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.9 }}
              className="absolute bottom-20 right-0 bg-gradient-to-r from-slate-900 to-slate-950 border border-white/10 text-white shadow-xl rounded-2xl p-4 min-w-[210px] max-w-[250px]"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTooltip(false);
                }}
                className="absolute -top-2 -right-2 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-full p-1 transition-colors"
              >
                <X className="w-3 h-3 text-slate-400 hover:text-white" />
              </button>
              <p className="text-xs text-left leading-relaxed text-slate-200">
                Olá, {userName}! Sou o <span className="text-orange-400 font-bold">Idea</span>. 💡 Dúvidas com o sistema? Clique aqui!
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB Button */}
        <motion.button
          onClick={handleToggle}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className={`w-16 h-16 rounded-full overflow-hidden flex items-center justify-center border-2 shadow-2xl relative transition-all duration-300 ${
            isOpen
              ? 'border-red-500 bg-red-600/10 shadow-red-500/20'
              : 'border-orange-500 bg-slate-950/80 shadow-orange-500/30'
          }`}
          aria-label="Suporte Idea"
        >
          {isOpen ? (
            <X className="w-7 h-7 text-white" />
          ) : (
            <div className="w-full h-full p-1 relative flex items-center justify-center">
              <img src="/mascot_wave.gif" alt="Idea" className="w-full h-full object-contain" />
              {/* Ping online indicator */}
              <span className="absolute top-1.5 right-1.5 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full animate-pulse"></span>
            </div>
          )}
        </motion.button>

        {/* Pulsing glow ring when closed */}
        {!isOpen && (
          <div className="absolute bottom-0 right-0 w-16 h-16 rounded-full bg-orange-500 opacity-20 animate-ping pointer-events-none" />
        )}
      </div>
    </div>
  );
};

// Inline ArrowUpRight icon
const ArrowUpRight = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M7 7h10v10" />
    <path d="M7 17 17 7" />
  </svg>
);

export default MascotWidget;
