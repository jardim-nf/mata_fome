// src/components/menu/CartelaFidelidade.jsx — Cartela de Carimbos Visual (Compact Customer-facing)
import React from 'react';
import { IoGiftOutline, IoTrophyOutline, IoStarOutline, IoStar, IoCheckmarkCircle } from 'react-icons/io5';

export default function CartelaFidelidade({ carimbos = 0, metaCompras = 10, premio = '', descricaoExtra = '', premioDisponivel = false, onResgatar }) {
  const faltam = Math.max(0, metaCompras - carimbos);

  return (
    <div className={`rounded-2xl p-3.5 shadow-md mb-6 mx-0 overflow-hidden relative transition-all animate-fade-in ${
      premioDisponivel 
        ? 'bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-500 shadow-lg shadow-orange-100 text-white' 
        : 'bg-gradient-to-br from-pink-50 via-white to-orange-50 border border-pink-100 text-gray-800'
    }`}>
      {/* Decorative Blur Effect */}
      {premioDisponivel && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-2xl -mr-8 -mt-8 animate-pulse pointer-events-none"></div>
      )}

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 text-left">
        {/* Info Area */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${premioDisponivel ? 'bg-white/30 text-white' : 'bg-pink-100 text-pink-500'}`}>
            <IoGiftOutline className={premioDisponivel ? 'text-xl animate-bounce' : 'text-xl'} />
          </div>
          <div className="min-w-0">
            <h4 className={`text-xs font-black leading-tight truncate ${premioDisponivel ? 'text-white' : 'text-gray-800'}`}>
              {premioDisponivel ? '🎉 PRÊMIO DISPONÍVEL!' : 'Fidelidade'}
            </h4>
            <p className={`text-[10px] font-bold mt-0.5 leading-tight ${premioDisponivel ? 'text-white/85' : 'text-gray-500'} truncate`}>
              {premioDisponivel ? `Resgate: ${premio}!` : `Ganhe ${premio} (${carimbos}/${metaCompras} carimbos)`}
            </p>
            {descricaoExtra && !premioDisponivel && (
              <p className="text-[9px] text-gray-400 font-medium leading-none mt-0.5 truncate">{descricaoExtra}</p>
            )}
          </div>
        </div>

        {/* Action / Stamp Grid Area */}
        <div className="flex items-center gap-3 justify-between sm:justify-end shrink-0">
          <div className="flex flex-wrap gap-1 items-center justify-end">
            {Array.from({ length: metaCompras }).map((_, i) => {
              const isLast = i === metaCompras - 1;
              const isFilled = i < carimbos;
              
              return (
                <div 
                  key={i} 
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300
                    ${isLast 
                      ? premioDisponivel
                        ? 'bg-white text-orange-500 shadow-md ring-2 ring-white/50 animate-bounce'
                        : 'bg-gradient-to-br from-yellow-400 to-orange-400 text-white shadow-sm ring-1 ring-yellow-300' 
                      : isFilled 
                        ? premioDisponivel
                          ? 'bg-white/40 text-white'
                          : 'bg-gradient-to-br from-pink-400 to-pink-500 text-white shadow-sm' 
                        : premioDisponivel
                          ? 'bg-white/10 text-white/30 border border-white/20'
                          : 'bg-gray-100 text-gray-300 border border-dashed border-gray-300'
                    }`}
                >
                  {isLast 
                    ? <IoTrophyOutline className="text-xs" /> 
                    : isFilled 
                      ? <IoStar className="text-[8px]" /> 
                      : <IoStarOutline className="text-[8px]" />
                  }
                </div>
              );
            })}
          </div>

          {premioDisponivel && onResgatar && (
            <button 
              onClick={onResgatar}
              className="bg-white text-orange-600 px-3.5 py-1.5 rounded-xl font-black text-xs shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <IoCheckmarkCircle size={14} /> Resgatar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
