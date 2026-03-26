import React from 'react';
import { formatarMoeda, formatarData, formatarHora } from './pdvHelpers';

export const ModalListaTurnos = ({ visivel, onClose, turnos, onSelecionarTurno }) => {
    if (!visivel) return null;
    return (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-[9500] p-4 backdrop-blur-sm no-print">
            <div className="bg-white border border-gray-200 rounded-[2rem] shadow-2xl max-w-3xl w-full h-[70vh] flex flex-col overflow-hidden animate-slideUp">
                <div className="bg-white p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">📋 Turnos de Caixa</h2>
                    <button onClick={onClose} className="bg-gray-100 p-2 rounded-full hover:bg-gray-200 text-gray-500">✕</button>
                </div>
                <div className="flex-1 overflow-auto p-6 bg-gray-50 custom-scrollbar">
                    {(!turnos || turnos.length === 0) ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-70">
                            <span className="text-5xl mb-4">📂</span>
                            <p className="font-bold text-lg">Nenhum turno registrado ainda.</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {turnos.map(turno => {
                                const res = turno.resumoVendas || {};
                                const isAberto = turno.status !== 'fechado';
                                return (
                                    <button key={turno.id} onClick={() => onSelecionarTurno(turno)}
                                        className="w-full bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center hover:border-blue-200 transition-colors text-left group"
                                    >
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <p className="font-bold text-gray-800 text-lg">
                                                    {formatarData(turno.dataAbertura)}
                                                </p>
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${isAberto ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    {isAberto ? '🟢 Aberto' : '🔒 Fechado'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-400">
                                                Aberto: {formatarHora(turno.dataAbertura)}
                                                {turno.dataFechamento ? ` • Fechado: ${formatarHora(turno.dataFechamento)}` : ''}
                                                {' • '}{res.qtd || 0} venda(s)
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4 shrink-0">
                                            <span className="font-black text-xl text-gray-800 group-hover:text-emerald-600 transition-colors">
                                                {formatarMoeda(parseFloat(res.total || 0))}
                                            </span>
                                            <span className="text-gray-300 group-hover:text-gray-500 transition-colors text-xl">→</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
