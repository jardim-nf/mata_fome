// src/components/pdv-modals/ModalAberturaCaixa.jsx
import React, { useState } from 'react';

export const ModalAberturaCaixa = ({ visivel, onAbrir, usuarioNome, onClose, onVerTurnos }) => {
    const [saldo, setSaldo] = useState('');
    const [loading, setLoading] = useState(false);
    if (!visivel) return null;

    const handleAbrirClick = async () => {
        if (loading) return;
        setLoading(true);
        try {
            await onAbrir(saldo);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm animate-fadeIn no-print">
            <div className="bg-white p-8 rounded-[2rem] w-full max-w-sm text-center shadow-2xl transform animate-slideUp relative">
                {onClose && (
                    <button onClick={onClose} className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors" disabled={loading}>✕</button>
                )}
                <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center text-5xl mx-auto mb-6 text-emerald-500 shadow-inner">🔓</div>
                <h2 className="text-3xl font-bold mb-2 text-gray-800">Abrir Caixa</h2>
                <p className="text-gray-500 mb-8">Olá <b>{usuarioNome}</b>, informe o fundo:</p>
                <div className="relative mb-6 group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl font-bold group-focus-within:text-emerald-600 transition-colors">R$</span>
                    <input type="number" disabled={loading} className="w-full p-4 pl-12 bg-gray-50 border-2 border-gray-200 rounded-2xl text-4xl font-bold text-gray-800 focus:border-emerald-500 focus:bg-white outline-none transition-all placeholder-gray-300" placeholder="0,00" autoFocus onChange={e => setSaldo(e.target.value)} value={saldo} step="0.01" />
                </div>
                <button onClick={handleAbrirClick} disabled={!saldo || loading} className="w-full bg-emerald-600 text-white p-5 rounded-2xl font-bold text-xl hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-200 hover:scale-[1.02] mb-3">
                    {loading ? 'ABRINDO...' : 'INICIAR VENDAS'}
                </button>
                {onVerTurnos && (
                    <button type="button" onClick={onVerTurnos} disabled={loading} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 p-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-1.5 border border-slate-200/60 active:scale-98">
                        📋 Ver Outros Turnos
                    </button>
                )}
            </div>
        </div>
    );
};
