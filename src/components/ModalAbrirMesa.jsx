import React, { useState, useEffect } from 'react';

const ModalAbrirMesa = ({ isOpen, onClose, onConfirm, mesaNumero, isOpening }) => {
    const [quantidade, setQuantidade] = useState(1);
    const [nome, setNome] = useState('');

    useEffect(() => { 
        if (isOpen) { 
            setQuantidade(1); 
            setNome(''); 
        } 
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-start sm:items-center justify-center p-4 pt-[10vh] sm:pt-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-[2rem] shadow-2xl p-6 w-full max-w-sm border border-gray-100 transform transition-none mb-auto sm:mb-0">
                <h3 className="text-2xl font-black text-gray-900 text-center mb-1">Mesa {mesaNumero}</h3>
                <p className="text-center text-gray-500 mb-6 text-sm font-medium">Abrir nova comanda</p>
                <div className="mb-5">
                    <label className="block text-[10px] font-black text-gray-400 mb-2 ml-1 tracking-widest uppercase">NOME DO CLIENTE (OPCIONAL)</label>
                    <input 
                        type="text" 
                        placeholder="Ex: João Silva" 
                        value={nome} 
                        onChange={(e) => setNome(e.target.value)} 
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3.5 text-gray-900 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-bold" 
                        autoFocus 
                    />
                </div>
                <div className="mb-8">
                    <label className="block text-[10px] font-black text-gray-400 mb-2 ml-1 tracking-widest uppercase">QUANTAS PESSOAS?</label>
                    <div className="flex items-center justify-between bg-gray-50 rounded-2xl p-2 border-2 border-gray-100">
                        <button 
                            type="button" 
                            onClick={() => setQuantidade(q => Math.max(1, q - 1))} 
                            className="w-12 h-12 rounded-xl bg-white shadow-sm border border-gray-200 text-2xl font-black active:scale-95 text-gray-600 hover:bg-gray-100 transition-all"
                        >
                            -
                        </button>
                        <span className="text-3xl font-black text-gray-900">{quantidade}</span>
                        <button 
                            type="button" 
                            onClick={() => setQuantidade(q => q + 1)} 
                            className="w-12 h-12 rounded-xl bg-blue-600 shadow-md text-white text-2xl font-black active:scale-95 hover:bg-blue-700 transition-all"
                        >
                            +
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        type="button" 
                        onPointerDown={(e) => { e.preventDefault(); if(!isOpening) onClose(); }} 
                        onClick={() => { if(!isOpening) onClose(); }} 
                        disabled={isOpening} 
                        className="py-4 bg-gray-100 rounded-2xl font-bold text-gray-600 active:scale-95 disabled:opacity-50 transition-all hover:bg-gray-200"
                    >
                        Cancelar
                    </button>
                    <button 
                        type="button" 
                        onPointerDown={(e) => { e.preventDefault(); if(!isOpening) onConfirm(quantidade, nome); }} 
                        onClick={() => { if(!isOpening) onConfirm(quantidade, nome); }} 
                        disabled={isOpening} 
                        className="py-4 bg-green-500 text-white rounded-2xl font-black shadow-lg active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 hover:bg-green-600"
                    >
                        {isOpening ? 'Abrindo...' : 'Abrir'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalAbrirMesa;
