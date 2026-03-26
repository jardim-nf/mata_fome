// src/components/pdv-modals/ModalMovimentacao.jsx
import React, { useState } from 'react';

export const ModalMovimentacao = ({ visivel, onClose, onConfirmar }) => {
    const [t, sT] = useState('sangria'); const [v, sV] = useState(''); const [d, sD] = useState('');
    if (!visivel) return null;
    return (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-[9400] p-4 backdrop-blur-sm no-print">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
                <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                    <button onClick={() => sT('sangria')} className={`flex-1 py-2 rounded-lg font-bold transition ${t === 'sangria' ? 'bg-white text-red-500 shadow' : 'text-gray-400 hover:text-gray-600'}`}>Sangria</button>
                    <button onClick={() => sT('suprimento')} className={`flex-1 py-2 rounded-lg font-bold transition ${t === 'suprimento' ? 'bg-white text-emerald-500 shadow' : 'text-gray-400 hover:text-gray-600'}`}>Suprimento</button>
                </div>
                <input type="number" className="w-full p-4 border-2 border-gray-100 bg-gray-50 rounded-xl text-3xl text-center font-bold mb-3 focus:border-blue-500 outline-none text-gray-800 placeholder-gray-300" placeholder="0,00" autoFocus onChange={e => sV(e.target.value)} value={v} />
                <input type="text" className="w-full p-3 border border-gray-200 bg-white rounded-xl mb-4 outline-none text-gray-800 placeholder-gray-400" placeholder="Motivo" onChange={e => sD(e.target.value)} value={d} />
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 bg-gray-100 p-3 rounded-xl font-bold text-gray-500 hover:bg-gray-200">Cancelar</button>
                    <button onClick={() => { if (!v || !d) return; onConfirmar({ tipo: t, valor: parseFloat(v), descricao: d }); sV(''); sD(''); }} className={`flex-1 text-white p-3 rounded-xl font-bold ${t === 'sangria' ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>SALVAR</button>
                </div>
            </div>
        </div>
    );
};
