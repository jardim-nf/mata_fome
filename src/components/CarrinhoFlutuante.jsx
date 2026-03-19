// src/components/CarrinhoFlutuante.jsx
import React from 'react';
import { IoCart, IoArrowForward } from 'react-icons/io5';
import { useAI } from '../context/AIContext'; 

const CarrinhoFlutuante = ({ carrinho, coresEstabelecimento, onClick }) => {
    const { isWidgetOpen } = useAI();

    if (!carrinho || carrinho.length === 0 || isWidgetOpen) return null;

    // 💡 CORREÇÃO 1: Trocado 'item.qtd' por 'item.quantidade' para bater com o useCarrinho.js
    const qtdTotal = carrinho.reduce((acc, item) => acc + (item.quantidade || 1), 0);
    const subtotal = carrinho.reduce((acc, item) => acc + (item.precoFinal * (item.quantidade || 1)), 0);

    const corFundo = coresEstabelecimento?.destaque || '#059669';
    const corTexto = '#ffffff';

    return (
        // 💡 CORREÇÃO 2: Removido o 'pointer-events-none' para o botão funcionar ao ser clicado!
        <div className="fixed bottom-0 left-0 w-full z-[9999] p-4">
            <button 
                onClick={onClick}
                style={{ backgroundColor: corFundo, color: corTexto }}
                className="w-full flex justify-between items-center p-4 rounded-xl shadow-2xl font-bold cursor-pointer hover:brightness-110 transition-all active:scale-95"
            >
                <div className="flex items-center gap-2">
                    <IoCart size={24} />
                    <span>{qtdTotal} {qtdTotal === 1 ? 'item' : 'itens'}</span>
                </div>

                <div className="flex items-center gap-2">
                    <span>Ver Carrinho • R$ {subtotal.toFixed(2)}</span>
                    <IoArrowForward size={24} />
                </div>
            </button>
        </div>
    );
};

export default CarrinhoFlutuante;