// src/components/CarrinhoFlutuante.jsx
import React from 'react';
import { IoCart, IoArrowForward } from 'react-icons/io5';

const CarrinhoFlutuante = ({ carrinho, coresEstabelecimento, onClick }) => {
    // 🛑 SE O CARRINHO ESTIVER VAZIO OU FOR NULO, NÃO RENDERIZA NADA
    if (!carrinho || carrinho.length === 0) return null;

    // Cálculos
    const qtdTotal = carrinho.reduce((acc, item) => acc + item.qtd, 0);
    const subtotal = carrinho.reduce((acc, item) => acc + (item.precoFinal * item.qtd), 0);

    // Estilos
    const corFundo = coresEstabelecimento?.destaque || '#059669'; // Verde padrão se não tiver cor
    const corTexto = '#ffffff';

    return (
        <div className="fixed bottom-0 left-0 w-full z-[9999] p-4 pointer-events-none">
            <div 
                onClick={onClick}
                className="pointer-events-auto cursor-pointer max-w-7xl mx-auto rounded-xl shadow-2xl flex items-center justify-between p-4 transform transition-transform hover:scale-[1.02] active:scale-95 animate-bounce-in"
                style={{ backgroundColor: corFundo }}
            >
                {/* Lado Esquerdo: Ícone e Qtd */}
                <div className="flex items-center gap-3">
                    <div className="bg-black/20 p-2 rounded-lg text-white relative">
                        <IoCart size={24} color={corTexto} />
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                            {qtdTotal}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.9)' }}>
                            Total do Pedido
                        </span>
                        <span className="text-lg font-bold" style={{ color: corTexto }}>
                            R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>

                {/* Lado Direito: Ver Sacola */}
                <div className="flex items-center gap-2 font-bold text-sm bg-black/10 px-4 py-2 rounded-lg hover:bg-black/20 transition-colors" style={{ color: corTexto }}>
                    <span>VER CARRINHO</span>
                    <IoArrowForward size={18} />
                </div>
            </div>
        </div>
    );
};

export default CarrinhoFlutuante;