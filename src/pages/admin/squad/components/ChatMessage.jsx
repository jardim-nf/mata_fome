import React from 'react';
import { renderChatMessage } from '../utils/renderHelpers';
import './ChatMessage.css';

/**
 * TypewriterMessage — Reveals text character by character for immersive chat feel
 */
export const TypewriterMessage = React.memo(({ text, speed = 10, onComplete }) => {
  const [length, setLength] = React.useState(0);
  const completedRef = React.useRef(false);

  React.useEffect(() => {
    if (!text) return;
    setLength(0);
    completedRef.current = false;
    let i = 0;
    const chunkSize = text.length > 200 ? 3 : 2;
    const interval = setInterval(() => {
      i += chunkSize + Math.floor(Math.random() * 2);
      if (i >= text.length) {
        i = text.length;
        clearInterval(interval);
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.();
        }
      }
      setLength(i);
    }, speed);
    return () => {
      clearInterval(interval);
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
    };
  }, [text, speed]);

  return (
    <>
      {text.slice(0, length)}
      {length < text.length && <span className="inline-block w-1.5 h-3.5 bg-[var(--sq-accent)] ml-0.5 animate-pulse rounded-sm" />}
    </>
  );
});

/**
 * ChatMessage — A single message in the chat thread
 */
export default function ChatMessage({ msg, index, isLight }) {
  const isSystem = msg.id === 'system';

  let borderClass = isLight ? 'border-slate-300 bg-white shadow-sm' : 'border-slate-800 bg-slate-950/45';
  let labelColor = isLight ? 'text-slate-650' : 'text-slate-400';

  if (msg.id === 'oscar') {
    borderClass = isLight ? 'border-slate-300 bg-slate-100/70 shadow-sm' : 'border-slate-300/40 bg-slate-900/30';
    labelColor = isLight ? 'text-slate-700' : 'text-slate-300';
  } else if (msg.id === 'leo') {
    borderClass = isLight ? 'border-sky-200 bg-sky-50/70 shadow-sm' : 'border-sky-500/30 bg-sky-950/10';
    labelColor = isLight ? 'text-sky-700' : 'text-sky-450';
  } else if (msg.id === 'afrodite') {
    borderClass = isLight ? 'border-pink-200 bg-pink-50/70 shadow-sm' : 'border-pink-500/30 bg-pink-950/10';
    labelColor = isLight ? 'text-pink-700' : 'text-pink-400';
  } else if (msg.id === 'thor') {
    borderClass = isLight ? 'border-amber-300 bg-amber-50/70 shadow-sm' : 'border-yellow-500/30 bg-yellow-950/10';
    labelColor = isLight ? 'text-amber-700' : 'text-yellow-400';
  } else if (msg.id === 'sabotagem') {
    borderClass = isLight ? 'border-emerald-200 bg-emerald-50/70 shadow-sm' : 'border-emerald-500/30 bg-emerald-950/10';
    labelColor = isLight ? 'text-emerald-700' : 'text-emerald-400';
  } else if (isSystem) {
    borderClass = isLight ? 'border-red-200 bg-red-50/70 shadow-sm' : 'border-red-500/25 bg-red-950/10';
    labelColor = isLight ? 'text-red-700' : 'text-red-400';
  }

  return (
    <div className={`p-3.5 rounded-2xl border ${borderClass} space-y-1 transition-all duration-300 hover:shadow-md`}>
      <div className="flex justify-between items-center text-[10.5px]">
        <span className={`font-black flex items-center gap-1.5 ${labelColor}`}>
          <span>{msg.emoji}</span>
          <span>{msg.nome}</span>
        </span>
        <span className="text-slate-500 font-normal">{msg.time}</span>
      </div>
      <p className={`text-[12.5px] leading-relaxed font-bold whitespace-pre-wrap text-[var(--sq-text)] opacity-95`}>
        {msg.typing ? (
          <TypewriterMessage
            text={msg.text}
            speed={10}
            onComplete={msg.onTypewriterComplete}
          />
        ) : renderChatMessage(msg.text)}
      </p>
    </div>
  );
}
