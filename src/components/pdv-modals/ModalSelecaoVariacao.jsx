// src/components/pdv-modals/ModalSelecaoVariacao.jsx
import React from 'react';
import { formatarMoeda } from './pdvHelpers';

export const ModalSelecaoVariacao = ({ produto, onClose, onConfirm }) => {
    if (!produto) return null;
    return (
        <div className="fixed inset-0 bg-gray-900/40 flex items-center justify-center z-[9000] p-4 backdrop-blur-sm animate-fadeIn no-print">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl transform animate-slideUp">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                    <h3 className="font-bold text-xl text-gray-800">{produto.name}</h3>
                    <button onClick={onClose} className="bg-gray-100 p-2 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
                </div>
                <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                    {produto.variacoes?.map(v => (
                        <button key={v.id} onClick={() => onConfirm(produto, v)} className="flex justify-between items-center p-4 border border-gray-100 bg-gray-50 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group">
                            <span className="font-semibold text-gray-700 group-hover:text-emerald-700">{v.nome}</span>
                            <span className="text-emerald-600 font-bold bg-white px-3 py-1 rounded-lg border border-gray-100 shadow-sm">{formatarMoeda(v.preco)}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
