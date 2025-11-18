// components/CarrinhoFlutuante.jsx - VERSÃO COMPACTA CHAMATIVA (CORRIGIDA)
import React, { useState, useEffect } from 'react';
import { IoCart, IoArrowDown } from 'react-icons/io5';

const CarrinhoFlutuante = ({ 
  carrinho, 
  coresEstabelecimento 
}) => {
    
    // 1. 🟢 CHAME TODOS OS HOOKS AQUI (Antes de qualquer retorno condicional)
    const [isPulsing, setIsPulsing] = useState(false);
    
    useEffect(() => {
      setIsPulsing(true);
      const timer = setTimeout(() => setIsPulsing(false), 2000);
      return () => clearTimeout(timer);
    }, [carrinho.length]);

    // 2. 🔴 Mova o retorno condicional para DEPOIS dos Hooks
    if (carrinho.length === 0) return null;

    const totalItens = carrinho.reduce((acc, item) => acc + item.qtd, 0);

    const scrollToCheckout = () => {
      const checkoutSection = document.getElementById('secao-pagamento');
      if (checkoutSection) {
        checkoutSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    return (
      <div className="fixed bottom-6 right-6 z-[1000]">
        <button
          onClick={scrollToCheckout}
          className={`
            bg-gradient-to-r from-green-600 to-green-700 text-white 
            rounded-xl shadow-2xl hover:shadow-3xl 
            transition-all duration-300 transform hover:scale-105
            flex items-center gap-2 px-4 py-3
            ${isPulsing ? 'animate-bounce ring-2 ring-green-400' : ''}
          `}
          title="Clique aqui para pagar"
        >
          <div className="relative">
            <IoCart className="text-xl" />
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {totalItens}
            </span>
          </div>
          
          <div className="flex flex-col items-start">
            <span className="text-sm font-bold whitespace-nowrap">
              Pagar Agora
            </span>
            <div className="flex items-center gap-1 text-xs opacity-90">
              <IoArrowDown className="text-xs" />
            </div>
          </div>
        </button>
      </div>
    );
};

export default CarrinhoFlutuante;