import React from 'react';
import { formatarMoeda, formatarHora } from './pdvHelpers';

export const ModalVendasSuspensas = ({ visivel, onClose, vendas, onRestaurar, onExcluir }) => {
    if (!visivel) return null;
    return (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-[9500] p-4 backdrop-blur-sm no-print">
            <div className="bg-white border border-gray-200 rounded-[2rem] shadow-2xl max-w-3xl w-full h-[70vh] flex flex-col overflow-hidden animate-slideUp">
                <div className="bg-white p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">⏸️ Vendas em Espera</h2>
                    <button onClick={onClose} className="bg-gray-100 p-2 rounded-full hover:bg-gray-200 text-gray-500">✕</button>
                </div>
                <div className="flex-1 overflow-auto p-6 bg-gray-50 custom-scrollbar">
                    {vendas.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-70">
                            <span className="text-5xl mb-4">💤</span>
                            <p className="font-bold text-lg">Nenhuma venda em espera no momento.</p>
                            <p className="text-sm">Use o botão PAUSAR (F4) no carrinho.</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {vendas.map(v => (
                                <div key={v.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center hover:border-blue-200 transition-colors">
                                    <div>
                                        <p className="font-bold text-gray-800 text-lg">{v.nomeReferencia}</p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Guardada às {formatarHora(v.dataSuspensao)} • {v.itens.length} iten(s)
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-black text-xl text-gray-800">{formatarMoeda(v.total)}</span>
                                        <div className="flex gap-2">
                                            <button onClick={() => onRestaurar(v)} className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-5 py-2 rounded-xl font-bold transition-all text-sm shadow-sm">Restaurar</button>
                                            <button onClick={() => onExcluir(v.id)} className="bg-red-50 text-red-500 hover:bg-red-100 w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-colors shadow-sm" title="Descartar Venda">✕</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
