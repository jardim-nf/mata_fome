import React, { useEffect, useRef } from 'react';
import { FaPaperPlane, FaMicrophone } from 'react-icons/fa';

export default function SquadChat2D({ chatThread, agents, onSendMessage }) {
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatThread]);

  return (
    <div className="flex flex-col h-full bg-slate-900 w-full relative z-50">
      
      {/* Header */}
      <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-center items-center shadow-md">
        <h2 className="text-white font-bold text-lg tracking-wide uppercase">
          Squad Meeting <span className="text-green-500 text-xs ml-2 animate-pulse">● LOW POWER</span>
        </h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatThread.map((msg, index) => {
          const isUser = msg.id === 'user';
          const isSystem = msg.id === 'system';
          const agent = agents[msg.id];
          
          let bgColor = 'bg-slate-800';
          let textColor = 'text-slate-200';
          let borderColor = 'border-slate-700';
          let align = 'justify-start';

          if (isUser) {
            bgColor = 'bg-blue-600';
            textColor = 'text-white';
            borderColor = 'border-blue-500';
            align = 'justify-end';
          } else if (isSystem) {
            bgColor = 'bg-yellow-900/30';
            textColor = 'text-yellow-400';
            borderColor = 'border-yellow-700';
            align = 'justify-center w-full';
          } else if (agent) {
            const hexColor = agent.color.toString(16).padStart(6, '0');
            bgColor = 'bg-slate-800';
            borderColor = `border-[#${hexColor}]`;
          }

          return (
            <div key={index} className={`flex ${align} w-full animate-fade-in`}>
              <div 
                className={`max-w-[85%] rounded-xl p-3 border shadow-sm ${bgColor} ${borderColor}`}
                style={!isUser && !isSystem && agent ? { borderLeftWidth: '4px' } : {}}
              >
                {!isSystem && (
                  <div className="flex items-center space-x-2 mb-1 opacity-90">
                    <span className="text-sm">{msg.emoji}</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      {msg.nome}
                    </span>
                    <span className="text-[10px] text-slate-500">{msg.time}</span>
                  </div>
                )}
                
                <div className={`text-sm ${textColor} leading-relaxed`}>
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

    </div>
  );
}
