// src/components/pdv-modals/ModalFinalizacao.jsx
import React, { useState, useEffect } from 'react';
import { formatarMoeda } from './pdvHelpers';

export const ModalFinalizacao = ({ visivel, venda, onClose, onFinalizar, salvando, pagamentos, setPagamentos, cpfNota, setCpfNota, desconto, setDesconto, acrescimo, setAcrescimo }) => {
    const [formaAtual, setFormaAtual] = useState('dinheiro');
    const [valorInput, setValorInput] = useState('');

    useEffect(() => {
        if (visivel) { setFormaAtual('dinheiro'); setValorInput(''); }
    }, [visivel]);

    const vendaTotal = venda ? venda.total : 0;
    const descNum = parseFloat(desconto || 0);
    const acrNum = parseFloat(acrescimo || 0);
    const totalFinal = Math.max(0, vendaTotal + acrNum - descNum);

    const listaPagamentos = pagamentos || [];
    const totalPago = listaPagamentos.reduce((acc, p) => acc + p.valor, 0);
    const restante = Math.max(0, totalFinal - totalPago);
    const troco = Math.max(0, totalPago - totalFinal);

    useEffect(() => {
        if (restante > 0) setValorInput(restante.toFixed(2));
        else setValorInput('');
    }, [restante]);

    if (!visivel || !venda) return null;

    const handleAdicionar = () => {
        const v = parseFloat(valorInput || 0);
        if (v <= 0) return;
        setPagamentos([...pagamentos, { forma: formaAtual, valor: v }]);
    };

    const handleRemover = (idx) => {
        setPagamentos(pagamentos.filter((_, i) => i !== idx));
    };

    return (
        <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-[9000] p-4 backdrop-blur-sm no-print">
            <div className="bg-white p-6 sm:p-8 rounded-[2rem] w-full max-w-md shadow-2xl animate-slideUp flex flex-col max-h-[90vh]">
                <div className="overflow-y-auto custom-scrollbar flex-1 pr-2">
                    <h2 className="text-5xl font-black text-center mb-2 text-gray-800 tracking-tighter">{formatarMoeda(totalFinal)}</h2>
                    <div className="flex justify-center gap-3 mb-6 text-xs font-bold text-gray-400">
                        <span>Sub: {formatarMoeda(venda.total)}</span>
                        {descNum > 0 && <span className="text-red-500">- Desc: {formatarMoeda(descNum)}</span>}
                        {acrNum > 0 && <span className="text-blue-500">+ Taxa: {formatarMoeda(acrNum)}</span>}
                    </div>

                    <div className="flex gap-3 mb-6">
                        <div className="flex-1 bg-gray-50 p-2 rounded-xl border border-gray-100 focus-within:border-emerald-500 transition-colors">
                            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Desconto (R$)</label>
                            <input type="number" step="0.01" min="0" className="w-full bg-transparent text-lg font-bold text-gray-800 outline-none placeholder-gray-300" placeholder="0,00" value={desconto} onChange={e => setDesconto(e.target.value)} />
                        </div>
                        <div className="flex-1 bg-gray-50 p-2 rounded-xl border border-gray-100 focus-within:border-blue-500 transition-colors">
                            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Taxa/Extra (R$)</label>
                            <input type="number" step="0.01" min="0" className="w-full bg-transparent text-lg font-bold text-gray-800 outline-none placeholder-gray-300" placeholder="0,00" value={acrescimo} onChange={e => setAcrescimo(e.target.value)} />
                        </div>
                    </div>

                    {pagamentos.length > 0 && (
                        <div className="mb-4 bg-gray-50 rounded-xl p-4 border border-gray-200">
                            <p className="text-[10px] font-bold uppercase text-gray-400 mb-3 tracking-wider">Pagamentos Lançados</p>
                            <div className="space-y-2">
                                {pagamentos.map((p, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                                        <span className="font-bold text-sm uppercase text-gray-700">{p.forma}</span>
                                        <div className="flex items-center gap-4">
                                            <span className="font-black text-gray-800">{formatarMoeda(p.valor)}</span>
                                            <button onClick={() => handleRemover(idx)} className="bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 w-6 h-6 rounded-md flex items-center justify-center font-bold transition-colors">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {troco > 0 && (
                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200 border-dashed">
                                    <span className="font-bold text-sm text-gray-500 uppercase tracking-wider">Troco a Devolver</span>
                                    <span className="font-black text-lg text-emerald-600 bg-emerald-100 px-3 py-1 rounded-lg">{formatarMoeda(troco)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {restante > 0 ? (
                        <div className="mb-6 animate-fadeIn">
                            <div className="flex justify-between items-end mb-3">
                                <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Falta Pagar</span>
                                <span className="font-black text-red-500 text-2xl leading-none">{formatarMoeda(restante)}</span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 mb-3">
                                {['dinheiro', 'cartao', 'pix'].map(f =>
                                    <button key={f} 
                                        onClick={() => {
                                            setFormaAtual(f);
                                            if (restante > 0) setValorInput(restante.toFixed(2));
                                        }}
                                        className={`p-3 rounded-xl font-bold uppercase text-[10px] flex flex-col items-center gap-1 transition-all border ${formaAtual === f ? 'bg-gray-800 border-gray-800 text-white shadow-md scale-[1.02]' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50 hover:border-gray-300'}`}>
                                        <span className="text-2xl">{f === 'dinheiro' ? '💵' : f === 'cartao' ? '💳' : '💠'}</span>{f}
                                    </button>
                                )}
                            </div>

                            <div className="flex gap-2 h-14">
                                <input type="number" step="0.01" className="w-full h-full bg-gray-50 border border-gray-200 rounded-xl px-4 text-2xl font-bold text-gray-800 outline-none focus:border-emerald-500 focus:bg-white transition-colors" value={valorInput} onChange={e => setValorInput(e.target.value)} placeholder="0,00" />
                                <button onClick={handleAdicionar} className="h-full bg-emerald-100 text-emerald-700 px-5 rounded-xl font-black text-sm hover:bg-emerald-200 transition-colors shadow-sm">INCLUIR</button>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-6 bg-emerald-50 p-4 rounded-xl text-center border border-emerald-100 animate-slideUp">
                            <p className="font-black text-emerald-700 text-lg">✅ Valor Completo!</p>
                        </div>
                    )}

                    <input type="text" className="w-full p-4 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl mb-2 outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder-gray-400 font-medium" placeholder="CPF na Nota (Opcional)" value={cpfNota} onChange={e => setCpfNota(e.target.value)} />
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-100 mt-2 shrink-0">
                    <button onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 p-4 rounded-xl font-bold text-gray-500 transition-all">Voltar</button>
                    <button onClick={onFinalizar} disabled={salvando || restante > 0} className="flex-[2] bg-emerald-600 text-white p-4 rounded-xl font-black text-lg hover:bg-emerald-700 transition-all shadow-lg disabled:opacity-50 disabled:bg-gray-300 disabled:shadow-none">FINALIZAR VENDA</button>
                </div>
            </div>
        </div>
    );
};
