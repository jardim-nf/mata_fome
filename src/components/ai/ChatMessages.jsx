import React, { useRef, useEffect } from 'react';
import { IoRestaurant, IoPerson } from 'react-icons/io5';
import { cleanText } from './utils/aiUtils';

const renderMarkdown = (text) => {
  if (!text) return null;

  return text.split('\n').map((line, i) => {
    // Heading: ### texto
    if (line.startsWith('### ')) {
      return <p key={i} className="font-bold text-base mt-3 mb-1">{line.substring(4)}</p>;
    }

    // Separador: ---
    if (line.trim() === '---') {
      return <hr key={i} className="border-gray-200 my-2" />;
    }

    // Linha vazia
    if (line.trim() === '') {
      return <br key={i} />;
    }

    // Processa negrito **texto** dentro da linha
    const renderInline = (str) => {
      const parts = str.split(/\*\*(.*?)\*\*/g);
      return parts.map((part, j) =>
        j % 2 === 1
          ? <strong key={j} className="font-bold">{part}</strong>
          : part
      );
    };

    // Lista: linha que começa com - ou *
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <li key={i} className="flex items-start py-0.5 gap-2 border-b border-dashed border-gray-200 last:border-0">
          <span className="text-orange-400 mt-0.5">•</span>
          <span>{renderInline(line.substring(2))}</span>
        </li>
      );
    }

    // Linha com recuo (adicionais/variações): começa com espaços
    if (line.startsWith('  - ') || line.startsWith('  * ')) {
      return (
        <li key={i} className="flex items-start py-0.5 gap-2 ml-4 text-sm text-gray-600">
          <span className="text-orange-300">◦</span>
          <span>{renderInline(line.substring(4))}</span>
        </li>
      );
    }

    // Linha normal com possível negrito
    return <p key={i} className="mb-0 leading-relaxed">{renderInline(line)}</p>;
  });
};

export default function ChatMessages({ mensagens, aiThinking, clienteNome, onRequestLogin, onClose }) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, aiThinking]);

  return (
    <div className="flex-1 overflow-y-auto p-4 bg-slate-50 custom-scrollbar space-y-6">

      {/* Mensagem inicial */}
      <div className="flex justify-start animate-slide-up">
        <div className="flex items-end gap-2 max-w-[90%]">
          <div className="w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-lg shrink-0">
            🤖
          </div>
          <div className="bg-white p-4 rounded-2xl rounded-bl-none shadow-sm border border-gray-200 text-gray-800 text-base leading-relaxed">
            {clienteNome ? (
              <>
                Olá, <strong>{clienteNome.split(' ')[0]}</strong>! 😃<br />
                Sou o Jucleildo. O que você gostaria de pedir? Se não quiser minha ajuda, é só fechar e pedir manual ok?
              </>
            ) : (
              <>
                Olá! Sou o Jucleildo.{' '}
                <button
                  onClick={() => { onClose?.(); onRequestLogin?.(); }}
                  className="text-red-600 font-bold underline cursor-pointer"
                >
                  Entre aqui
                </button>{' '}
                para pedir.
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mensagens da conversa */}
      {mensagens.map(msg => (
        <div
          key={msg.id}
          className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
        >
          <div className={`flex items-end gap-2 max-w-[90%] ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>

            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 border shadow-sm ${
              msg.type === 'user'
                ? 'bg-green-100 text-green-700 border-green-200'
                : 'bg-white text-red-500 border-gray-200'
            }`}>
              {msg.type === 'user' ? <IoPerson /> : <IoRestaurant />}
            </div>

            <div className={`px-4 py-3 rounded-2xl shadow-sm text-base leading-relaxed border ${
              msg.type === 'user'
                ? 'bg-green-600 text-white rounded-br-none border-green-600'
                : 'bg-white text-gray-800 rounded-bl-none border-gray-200'
            }`}>
              <ul className="list-none p-0 m-0">
                {renderMarkdown(cleanText(msg.text))}
              </ul>
            </div>

          </div>
        </div>
      ))}

      {/* Typing indicator */}
      {aiThinking && (
        <div className="flex justify-start">
          <div className="flex items-end gap-2">
            <div className="w-8 h-8 rounded-full bg-transparent shrink-0" />
            <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-none shadow-sm border border-gray-200 flex space-x-1 items-center h-10">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150" />
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}