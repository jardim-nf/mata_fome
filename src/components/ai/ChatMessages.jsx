import React, { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { IoRestaurant, IoPerson } from 'react-icons/io5';
import { cleanText } from './utils/aiUtils';

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
          <div className="w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-lg shrink-0">🤖</div>
          <div className="bg-white p-4 rounded-2xl rounded-bl-none shadow-sm border border-gray-200 text-gray-800 text-base leading-relaxed">
            {clienteNome ? (
              <>Olá, <strong>{clienteNome.split(' ')[0]}</strong>! 😃<br />Sou o Jucleildo. O que você gostaria de pedir? Se não quiser minha ajuda, é só fechar e pedir manual ok?</>
            ) : (
              <>
                Olá! Sou o Jucleildo.{' '}
                <button onClick={() => { onClose?.(); onRequestLogin?.(); }} className="text-red-600 font-bold underline cursor-pointer">
                  Entre aqui
                </button>{' '}para pedir.
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mensagens da conversa */}
      {mensagens.map(msg => (
        <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
          <div className={`flex items-end gap-2 max-w-[90%] ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 border shadow-sm ${msg.type === 'user' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-red-500 border-gray-200'}`}>
              {msg.type === 'user' ? <IoPerson /> : <IoRestaurant />}
            </div>
            <div className={`px-4 py-3 rounded-2xl shadow-sm text-base leading-relaxed border ${msg.type === 'user' ? 'bg-green-600 text-white rounded-br-none border-green-600' : 'bg-white text-gray-800 rounded-bl-none border-gray-200'}`}>
              <ReactMarkdown
                components={{
                  strong: ({ node, ...props }) => <span className="block font-bold mt-2 mb-1 text-lg border-b border-white/20 pb-1" {...props} />,
                  ul: ({ node, ...props }) => <ul className="w-full mt-1 space-y-1" {...props} />,
                  li: ({ node, ...props }) => <li className="flex justify-between items-center py-1 border-b border-dashed border-gray-300 last:border-0" {...props} />,
                  p: ({ node, ...props }) => <p className="mb-0" {...props} />,
                }}
              >
                {cleanText(msg.text)}
              </ReactMarkdown>
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