// src/components/CarrinhoFlutuante.jsx
import React from 'react';
import { IoCart, IoArrowForward } from 'react-icons/io5';
// 1. Importe o hook da IA
import { useAI } from '../context/AIContext'; 

const CarrinhoFlutuante = ({ carrinho, coresEstabelecimento, onClick }) => {
    // 2. Acesse o estado de abertura do widget
    const { isWidgetOpen } = useAI();

    // 3. Adicione 'isWidgetOpen' na trava de renderização
    // Se o carrinho estiver vazio OU se a IA estiver aberta, não mostra a barra
    if (!carrinho || carrinho.length === 0 || isWidgetOpen) return null;

    // ... restante do código (cálculos e return)
    const qtdTotal = carrinho.reduce((acc, item) => acc + item.qtd, 0);
    const subtotal = carrinho.reduce((acc, item) => acc + (item.precoFinal * item.qtd), 0);

    const corFundo = coresEstabelecimento?.destaque || '#059669';
    const corTexto = '#ffffff';

    return (
        <div className="fixed bottom-0 left-0 w-full z-[9999] p-4 pointer-events-none">
            {/* ... conteúdo do componente ... */}
        </div>
    );
};

export default CarrinhoFlutuante;