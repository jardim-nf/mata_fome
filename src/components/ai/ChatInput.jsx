import React, { useState, useEffect, useRef } from 'react';
import { IoSend, IoTime, IoMic, IoCartOutline } from 'react-icons/io5';

export default function ChatInput({ onSend, aiThinking, clienteNome, conversationStep, carrinho, onShowCart, onRequestLogin, onClose }) {
  const [message, setMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

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
        setTimeout(() => { onSend(transcript, setMessage); }, 800);
      };
      recognitionRef.current = rec;
    }
  }, []);

  const toggleMic = () => {
    if (!recognitionRef.current) return alert('Navegador sem suporte a voz.');
    isListening ? recognitionRef.current.stop() : recognitionRef.current.start();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    onSend(message, setMessage);
  };

  return (
    <div className="bg-white border-t border-gray-100 p-4 pb-safe">
      {!aiThinking && !isListening && clienteNome && conversationStep === 'IDLE' && (
        <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-hide pb-1">
          <button onClick={onShowCart} className="shrink-0 px-4 py-2 bg-green-50 text-green-700 border border-green-200 text-sm font-bold rounded-full flex items-center gap-1 shadow-sm hover:bg-green-100 transition">
            <IoCartOutline /> Carrinho ({carrinho.length})
          </button>
          {['📜 Ver Cardápio', '🔥 Promo'].map(s => (
            <button key={s} onClick={() => onSend(s, setMessage)} className="shrink-0 px-4 py-2 bg-white text-gray-600 border border-gray-200 text-sm font-medium rounded-full shadow-sm hover:bg-gray-50 transition">
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <button
          type="button"
          onClick={() => {
            if (!clienteNome && onRequestLogin) { onClose(); onRequestLogin(); }
            else toggleMic();
          }}
          className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center transition-all shadow-sm ${isListening ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
          <IoMic size={22} />
        </button>

        <input
          type="text"
          value={isListening ? 'Ouvindo...' : message}
          onChange={e => setMessage(e.target.value)}
          placeholder={!clienteNome ? 'Faça login' : conversationStep !== 'IDLE' ? 'Responda aqui...' : 'Digite aqui...'}
          disabled={isListening}
          onFocus={() => { if (!clienteNome && onRequestLogin) { onClose(); onRequestLogin(); } }}
          className="flex-1 text-gray-900 rounded-full px-5 py-3 text-base focus:bg-white focus:ring-2 focus:ring-green-200 outline-none border border-gray-200 transition-all placeholder-gray-400"
        />

        <button
          type="submit"
          disabled={!message.trim() || aiThinking}
          className="w-12 h-12 shrink-0 bg-green-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-green-700 active:scale-95 disabled:opacity-50 transition-all"
        >
          {aiThinking ? <IoTime className="animate-spin" size={22} /> : <IoSend size={20} className="ml-1" />}
        </button>
      </form>
    </div>
  );
}