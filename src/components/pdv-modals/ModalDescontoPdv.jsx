// src/components/pdv-modals/ModalDescontoPdv.jsx
import React, { useState, useEffect } from 'react';
import { formatarMoeda } from './pdvHelpers';

const ModalDescontoPdv = ({ visivel, totalOriginal, onClose, onConfirm }) => {
    const [tipo, setTipo] = useState('percentual');
    const [valor, setValor] = useState('');

    useEffect(() => {
        if (visivel) { setTipo('percentual'); setValor(''); }
    }, [visivel]);

    if (!visivel) return null;

    const numVal = parseFloat(String(valor).replace(',', '.')) || 0;
    const desconto = tipo === 'percentual' ? (totalOriginal * numVal / 100) : numVal;

    return (
        <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-[9600] p-4 backdrop-blur-sm animate-fadeIn no-print">
            <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl transform animate-slideUp">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-2xl text-gray-800">Aplicar Desconto</h3>
                    <button onClick={onClose} className="bg-gray-100 p-2 rounded-full text-gray-400">✕</button>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                    <button onClick={() => setTipo('percentual')} className={`flex-1 p-3 rounded-lg font-bold text-sm transition-all ${tipo === 'percentual' ? 'bg-white shadow text-emerald-600' : 'text-gray-500'}`}>% Percentual</button>
                    <button onClick={() => setTipo('fixo')} className={`flex-1 p-3 rounded-lg font-bold text-sm transition-all ${tipo === 'fixo' ? 'bg-white shadow text-emerald-600' : 'text-gray-500'}`}>R$ Valor Fixo</button>
                </div>

                <input type="number" autoFocus className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-3xl font-black text-center focus:border-emerald-500 outline-none" placeholder={tipo === 'percentual' ? '10' : '5.00'} value={valor} onChange={(e) => setValor(e.target.value)} />

                <div className="mt-4 bg-amber-50 border border-amber-200 p-3 rounded-xl text-center">
                    <span className="text-xs text-amber-600 font-medium">Desconto: </span>
                    <span className="font-bold text-amber-700">{formatarMoeda(desconto)}</span>
                    <span className="text-xs text-amber-600 font-medium"> → Novo total: </span>
                    <span className="font-black text-amber-700">{formatarMoeda(Math.max(0, totalOriginal - desconto))}</span>
                </div>

                <button onClick={() => onConfirm({ tipo, valor: numVal, desconto })} disabled={numVal <= 0} className="w-full bg-emerald-600 text-white p-5 rounded-2xl font-black text-xl mt-6 shadow-lg hover:bg-emerald-700 disabled:opacity-50 transition-all">
                    APLICAR DESCONTO
                </button>
            </div>
        </div>
    );
};

export default ModalDescontoPdv;
