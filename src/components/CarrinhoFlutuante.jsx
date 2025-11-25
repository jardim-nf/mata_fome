import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { IoCart, IoArrowForward } from 'react-icons/io5';
import useCarrinho from '../hooks/useCarrinho';

const CarrinhoFlutuante = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // 1. Usamos o hook diretamente para garantir dados sincronizados
    const { carrinho, totalItens } = useCarrinho(); 
    
    const [isPulsing, setIsPulsing] = useState(false);
    
    // Efeito de pulso quando a quantidade de itens muda
    useEffect(() => {
        if (carrinho.length > 0) {
            setIsPulsing(true);
            const timer = setTimeout(() => setIsPulsing(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [totalItens]);

    // 2. Não exibir se carrinho vazio OU se já estiver na página de checkout
    if (carrinho.length === 0 || location.pathname === '/checkout') return null;

    const handleCheckout = () => {
        navigate('/checkout');
    };

    return (
        <div className="fixed bottom-6 right-6 z-[1000] animate-in slide-in-from-bottom-4 fade-in duration-500">
            <button
                onClick={handleCheckout}
                className={`
                    group
                    bg-gradient-to-r from-green-600 to-green-700 text-white 
                    rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-green-900/20
                    transition-all duration-300 transform hover:-translate-y-1 active:scale-95
                    flex items-center gap-3 px-5 py-3.5 pr-6
                    ${isPulsing ? 'animate-bounce ring-4 ring-green-400/30' : ''}
                `}
                title="Ir para pagamento"
            >
                <div className="relative">
                    <IoCart className="text-2xl group-hover:rotate-12 transition-transform" />
                    <span className="absolute -top-2.5 -right-2.5 bg-red-600 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold border-2 border-white shadow-sm">
                        {totalItens}
                    </span>
                </div>
                
                <div className="flex flex-col items-start text-left">
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 leading-none mb-0.5">
                        Finalizar
                    </span>
                    <div className="flex items-center gap-1 font-bold text-base leading-none">
                        Meu Pedido
                        <IoArrowForward className="text-sm group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>
            </button>
        </div>
    );
};

export default CarrinhoFlutuante;