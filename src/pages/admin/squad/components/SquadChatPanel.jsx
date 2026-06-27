import React, { useEffect, useRef, memo } from 'react';

// Agent color map (shared constant)
const AGENT_COLORS = {
  oscar: { bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.25)', accent: '#94a3b8', label: '#cbd5e1' },
  leo: { bg: 'rgba(56,189,248,0.06)', border: 'rgba(56,189,248,0.2)', accent: '#38bdf8', label: '#7dd3fc' },
  afrodite: { bg: 'rgba(244,114,182,0.06)', border: 'rgba(244,114,182,0.2)', accent: '#f472b6', label: '#f9a8d4' },
  thor: { bg: 'rgba(251,191,36,0.06)', border: 'rgba(251,191,36,0.2)', accent: '#fbbf24', label: '#fde68a' },
  sabotagem: { bg: 'rgba(52,211,153,0.06)', border: 'rgba(52,211,153,0.2)', accent: '#34d399', label: '#6ee7b7' },
  user: { bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.25)', accent: '#6366f1', label: '#a5b4fc' },
  system: { bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.2)', accent: '#ef4444', label: '#fca5a5' }
};

/**
 * SquadChatPanel — Discord-style chat thread with typing indicator.
 * Extracted from SquadMeeting3D.jsx for performance (avoids re-rendering the entire 5K-line component).
 */
function SquadChatPanel({
  chatThread,
  activeAgent,
  running,
  isLight,
  feedbackText,
  setFeedbackText,
  handleSendFeedback,
  waitingForUser,
  handleApproveAndProceed
}) {
  const scrollRef = useRef(null);
  const prevLengthRef = useRef(0);

  // Auto-scroll ONLY when a new message arrives (not on every re-render)
  useEffect(() => {
    if (chatThread.length > prevLengthRef.current && scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      });
    }
    prevLengthRef.current = chatThread.length;
  }, [chatThread.length]);

  const bgInput = isLight
    ? 'bg-white border border-slate-300 text-slate-800 placeholder-slate-500'
    : 'bg-slate-900/70 border border-slate-700 text-white placeholder-slate-500';

  return (
    <div className="flex flex-col h-full space-y-4 justify-between">
      {/* Chat Thread */}
      <div className="space-y-3 flex-1 overflow-y-auto pdv-scroll" ref={scrollRef}>
        {chatThread.map((msg, index) => {
          // Typing indicator bubble
          if (msg.id === '__typing__') {
            const dotColor = AGENT_COLORS[msg.typingAgent]?.accent || '#6366f1';
            return (
              <div key="typing" className="squad-typing-indicator">
                <div className="squad-chat-avatar" style={{ background: dotColor + '22', borderColor: dotColor }}>
                  {msg.emoji}
                </div>
                <div>
                  <span className="text-[10px] font-bold" style={{ color: dotColor }}>{msg.nome}</span>
                  <div className="squad-typing-dots">
                    <span style={{ background: dotColor }} />
                    <span style={{ background: dotColor }} />
                    <span style={{ background: dotColor }} />
                  </div>
                </div>
              </div>
            );
          }

          const colors = AGENT_COLORS[msg.id] || AGENT_COLORS.oscar;

          return (
            <div key={index} className="squad-chat-msg flex gap-3 items-start" style={{ animationDelay: `${index * 0.05}s` }}>
              {/* Avatar */}
              <div 
                className={`squad-chat-avatar ${activeAgent === msg.id ? 'active' : ''}`}
                style={{ background: colors.bg, borderColor: colors.accent }}
              >
                {msg.emoji}
              </div>
              {/* Bubble */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-black" style={{ color: colors.label }}>{msg.nome}</span>
                  <span className="text-[9px] text-slate-600 font-normal">{msg.time}</span>
                </div>
                <div 
                  className="p-3 rounded-2xl rounded-tl-md text-[12.5px] leading-relaxed font-semibold whitespace-pre-wrap"
                  style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: 'var(--sq-text)' }}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}

        {chatThread.length === 0 && (
          <div className="py-16 text-center text-slate-500 font-bold text-sm">
            💬 Aguardando início da discussão do Squad...
          </div>
        )}
      </div>

      {/* Persistent Chat Input */}
      {(running || chatThread.length > 0) && (
        <div className={`sticky bottom-0 pt-3 pb-1 ${isLight ? 'bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent' : 'bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent'}`}>
          <form onSubmit={handleSendFeedback} className="flex gap-2">
            <input
              type="text"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className={`flex-grow p-2.5 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 text-xs font-bold transition-all focus:outline-none ${bgInput}`}
              placeholder="Fale com o squad... (ex: 'mude a cor', 'ok', 'parar')" 
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-indigo-650 hover:bg-indigo-50 text-white rounded-xl text-[10px] font-black uppercase tracking-wide transition-all duration-200 shadow-lg shadow-indigo-500/20"
            >
              Enviar
            </button>
          </form>
          {waitingForUser && (
            <button
              type="button"
              onClick={handleApproveAndProceed}
              className="w-full mt-2 py-2 bg-amber-650/90 hover:bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wide transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              ✅ Aprovar e Prosseguir para Próxima Fase
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// memo prevents re-render when parent state changes that don't affect the chat
export default memo(SquadChatPanel);
