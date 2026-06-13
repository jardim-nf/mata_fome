import React, { useState, useEffect } from 'react';
import { formatarMoeda } from './pdvHelpers';

export const ModalSelecaoVariacao = ({ produto, onClose, onConfirm }) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Reset selected index when product changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [produto]);

    // Keydown listener for keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!produto || !produto.variacoes || produto.variacoes.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % produto.variacoes.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + produto.variacoes.length) % produto.variacoes.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                onConfirm(produto, produto.variacoes[selectedIndex]);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [produto, selectedIndex, onConfirm, onClose]);

    if (!produto) return null;
    return (
        <div className="fixed inset-0 bg-gray-900/40 flex items-center justify-center z-[9000] p-4 backdrop-blur-sm animate-fadeIn no-print">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl transform animate-slideUp">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                    <h3 className="font-bold text-xl text-gray-800">{produto.name}</h3>
                    <button onClick={onClose} className="bg-gray-100 p-2 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
                </div>
                <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                    {produto.variacoes?.map((v, index) => {
                        const isSelected = index === selectedIndex;
                        return (
                            <button
                                key={v.id}
                                onClick={() => onConfirm(produto, v)}
                                className={`flex justify-between items-center p-4 border transition-all group rounded-2xl ${
                                    isSelected
                                        ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20'
                                        : 'border-gray-100 bg-gray-50 hover:border-emerald-500 hover:bg-emerald-50'
                                }`}
                            >
                                <span className={`font-semibold text-gray-700 ${isSelected ? 'text-emerald-700' : 'group-hover:text-emerald-700'}`}>
                                    {v.nome}
                                </span>
                                <span className="text-emerald-600 font-bold bg-white px-3 py-1 rounded-lg border border-gray-100 shadow-sm">
                                    {formatarMoeda(v.preco)}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
