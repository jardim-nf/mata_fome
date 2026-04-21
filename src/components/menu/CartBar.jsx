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
    <div className={`fixed bottom-0 left-0 right-0 border-t border-gray-200 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.15)] z-[49] flex items-center justify-between animate-slide-up bg-white ${bounce ? 'cart-bounce' : ''}`}>
      <div className="flex flex-col">
        <span className="text-xs text-gray-500 font-bold uppercase">Total a Pagar</span>
        <span className="text-2xl font-black text-gray-900">{formatarMoeda(finalOrderTotal)}</span>
        <span className="text-xs text-green-600 font-medium flex items-center gap-1">
          {/* 🚀 Badge com contagem animada */}
          <span className={`inline-flex items-center justify-center min-w-[20px] h-5 rounded-full text-[11px] font-black px-1.5 ${bounce ? 'scale-125' : 'scale-100'} transition-transform`} style={{ backgroundColor: coresEstabelecimento.primaria, color: '#FFF' }}>
            {carrinho.length}
          </span>
          {carrinho.length === 1 ? 'item' : 'itens'}
        </span>
      </div>
      <button
        onClick={onScrollToResumo}
        className="px-6 py-3 rounded-xl font-bold text-white flex items-center gap-2 shadow-lg active:scale-95 transition-transform"
        style={{ backgroundColor: coresEstabelecimento.primaria }}
      >
        <span>Ver Sacola</span>
        <IoChevronForward size={20} />
      </button>
    </div>
  );
}