import React, { useState, useEffect, useRef } from "react";
import { X, Send, Mic } from "lucide-react";

const isIOS =
  typeof navigator !== "undefined" &&
  /iPad|iPhone|iPod/.test(navigator.userAgent);

export default function AIChatAssistant({ onClose }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Olá 👋 Posso te ajudar com seu pedido?",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);

  /* =========================
     AUTO SCROLL
  ========================= */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* =========================
     SPEECH (DESABILITADO NO iOS)
  ========================= */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isIOS) return;

    const SpeechRec =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRec) return;

    try {
      const rec = new SpeechRec();
      rec.lang = "pt-BR";
      rec.continuous = false;
      rec.interimResults = false;

      rec.onstart = () => setIsListening(true);
      rec.onend = () => setIsListening(false);

      rec.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        setMessage(transcript);
        setTimeout(() => handleSend(transcript), 600);
      };

      recognitionRef.current = rec;
    } catch (err) {
      console.warn("SpeechRecognition error:", err);
    }
  }, []);

  /* =========================
     SEND MESSAGE
  ========================= */
  async function handleSend(text) {
    const content = text || message;
    if (!content.trim() || loading) return;

    setMessages((prev) => [...prev, { role: "user", content }]);
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch(
        "https://SUA_CLOUD_FUNCTION_AQUI",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: content }),
        }
      );

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply || "Não consegui responder agora 😕",
        },
      ]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Erro de conexão. Tente novamente.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     MICROPHONE
  ========================= */
  function startListening() {
    if (isIOS) return;
    recognitionRef.current?.start();
  }

  /* =========================
     RENDER
  ========================= */
  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 ${
        isIOS ? "bg-black/70" : "bg-black/60 backdrop-blur-sm"
      }`}
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          height: "85dvh",
          maxHeight: "85vh",
        }}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold text-lg">Assistente Virtual</h2>
          <button onClick={onClose}>
            <X />
          </button>
        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                msg.role === "user"
                  ? "ml-auto bg-green-500 text-white"
                  : "mr-auto bg-gray-200 text-gray-900"
              }`}
            >
              {msg.content}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT */}
        <div className="p-3 border-t flex items-center gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 border rounded-full px-4 py-2 outline-none"
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />

          {!isIOS && (
            <button
              onClick={startListening}
              disabled={isListening}
              className="p-2 rounded-full bg-gray-100"
            >
              <Mic size={18} />
            </button>
          )}

          <button
            onClick={() => handleSend()}
            className="p-2 rounded-full bg-green-500 text-white"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
