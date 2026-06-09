import React, { useState, useEffect } from 'react';
import { IoChevronForward } from 'react-icons/io5';
import { formatarMoeda } from '../../utils/formatCurrency';


export default function CartBar({ carrinho, finalOrderTotal, isWidgetOpen, coresEstabelecimento, onScrollToResumo }) {
  const [bounce, setBounce] = useState(false);
  const [prevCount, setPrevCount] = useState(carrinho.length);

  // 🚀 Bounce sutil quando um item novo é adicionado
  useEffect(() => {
    if (carrinho.length > prevCount) {
      setBounce(true);
      const timer = setTimeout(() => setBounce(false), 600);
      return () => clearTimeout(timer);
    }
    setPrevCount(carrinho.length);
  }, [carrinho.length, prevCount]);

  if (carrinho.length === 0 || isWidgetOpen) return null;

  return (
    <div className="fixed bottom-6 left-0 right-0 z-[49] px-4 flex justify-center pointer-events-none animate-slide-up">
      <button
        onClick={onScrollToResumo}
        className={`pointer-events-auto w-full max-w-md py-4 px-6 rounded-2xl font-black text-white flex items-center justify-between shadow-[0_8px_30px_rgba(0,0,0,0.25)] active:scale-[0.98] transition-all ${bounce ? 'cart-bounce' : ''}`}
        style={{ backgroundColor: coresEstabelecimento.primaria }}
      >
        <div className="flex items-center gap-2.5">
          {/* 🚀 Badge com contagem animada */}
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black bg-white shadow-sm transition-transform ${bounce ? 'scale-125' : 'scale-100'}`} style={{ color: coresEstabelecimento.primaria }}>
            {carrinho.length}
          </span>
          <span className="text-sm font-black uppercase tracking-wider">Ver Sacola</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-black">{formatarMoeda(finalOrderTotal)}</span>
          <IoChevronForward size={20} />
        </div>
      </button>
    </div>
  );
}