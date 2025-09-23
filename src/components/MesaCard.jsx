// src/components/MesaCard.jsx

import React from 'react';
import { toast } from 'react-toastify';

// O ícone da lixeira será um SVG simples que vamos colocar aqui
const LixeiraIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
    </svg>
);

export default function MesaCard({ mesa, onClick, onExcluir }) { // Adicionamos a prop onExcluir
    
    const getStatusStyles = (status) => {
        switch (status) {
            case 'ocupada': return 'bg-red-500 hover:bg-red-600 text-white';
            case 'pagamento': return 'bg-blue-500 hover:bg-blue-600 text-white';
            default: return 'bg-green-500 hover:bg-green-600 text-white';
        }
    };

    const handleExcluirClick = (e) => {
        e.stopPropagation(); // Impede que o clique no botão ative o clique no card
        if (mesa.status !== 'livre') {
            toast.warn("Não é possível excluir uma mesa que está em uso.");
            return;
        }
        onExcluir(mesa.id, mesa.numero); // Chama a função que veio do componente pai
    };

    const estilos = getStatusStyles(mesa.status);
    const totalFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mesa.total || 0);

    return (
        <div 
            onClick={onClick}
            className={`p-4 rounded-lg shadow-lg cursor-pointer transform hover:scale-105 transition-transform duration-200 flex flex-col justify-between h-32 relative ${estilos}`}
        >
            {/* ▼▼▼ BOTÃO DE EXCLUIR ADICIONADO AQUI ▼▼▼ */}
            {mesa.status === 'livre' && (
                <button
                    onClick={handleExcluirClick}
                    className="absolute top-1 right-1 p-1 rounded-full text-white hover:bg-black/20"
                    title={`Excluir Mesa ${mesa.numero}`}
                >
                    <LixeiraIcon />
                </button>
            )}

            <h3 className="font-bold text-xl text-center">Mesa {mesa.numero}</h3>
            <div className="text-center">
                <p className="font-semibold uppercase text-sm">{mesa.status}</p>
                {mesa.status !== 'livre' && (
                    <p className="font-bold text-lg">{totalFormatado}</p>
                )}
            </div>
        </div>
    );
}