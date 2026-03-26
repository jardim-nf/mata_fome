// src/components/pdv-modals/ModalFechamento.jsx
import React, { useState, useEffect } from 'react';
import { formatarMoeda } from './pdvHelpers';

const ModalFechamento = ({ visivel, totalVenda, onClose, onConfirm }) => {
    const [formaPagamento, setFormaPagamento] = useState('dinheiro');
    const [valorRecebido, setValorRecebido] = useState('');
    const [cpf, setCpf] = useState('');

    useEffect(() => {
        if (visivel) {
            setFormaPagamento('dinheiro');
            setValorRecebido('');
            setCpf('');
        }
    }, [visivel]);

    if (!visivel) return null;

    const troco = formaPagamento === 'dinheiro' ? Math.max(0, parseFloat(valorRecebido || 0) - totalVenda) : 0;

    const formas = [
        { id: 'dinheiro', label: 'Dinheiro', icon: '💵', color: 'emerald' },
        { id: 'pix', label: 'Pix', icon: '📲', color: 'purple' },
        { id: 'debito', label: 'Débito', icon: '💳', color: 'blue' },
        { id: 'credito', label: 'Crédito', icon: '💳', color: 'orange' },
    ];

    return (
        <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-[9600] p-4 backdrop-blur-sm animate-fadeIn no-print">
            <div className="bg-white rounded-[2rem] p-8 max-w-lg w-full shadow-2xl transform animate-slideUp">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-2xl text-gray-800">Finalizar Venda</h3>
                    <button onClick={onClose} className="bg-gray-100 p-2 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl mb-6 text-center">
                    <p className="text-xs font-bold text-emerald-600/70 uppercase">Total a Pagar</p>
                    <p className="text-5xl font-black text-emerald-600">{formatarMoeda(totalVenda)}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
                    {formas.map(f => (
                        <button key={f.id} onClick={() => setFormaPagamento(f.id)} className={`p-4 rounded-2xl border-2 font-bold text-sm flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${formaPagamento === f.id ? `border-${f.color}-500 bg-${f.color}-50 text-${f.color}-700 shadow-md scale-105` : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'}`}>
                            <span className="text-3xl">{f.icon}</span>
                            <span className="uppercase tracking-wider text-[11px]">{f.label}</span>
                        </button>
                    ))}
                </div>

                {formaPagamento === 'dinheiro' && (
                    <div className="mb-6 bg-amber-50 p-5 rounded-2xl border border-amber-100">
                        <label className="block text-xs font-bold text-amber-600/80 uppercase mb-2">Valor Recebido</label>
                        <input type="number" autoFocus className="w-full p-4 bg-white border-2 border-amber-200 rounded-xl text-3xl font-black text-center focus:border-emerald-500 outline-none" placeholder="0,00" value={valorRecebido} onChange={(e) => setValorRecebido(e.target.value)} />
                        {troco > 0 && (
                            <div className="mt-3 text-center bg-white p-3 rounded-xl border border-amber-200">
                                <span className="text-xs font-bold text-amber-600 mr-2">TROCO:</span>
                                <span className="text-2xl font-black text-emerald-600">{formatarMoeda(troco)}</span>
                            </div>
                        )}
                    </div>
                )}

                <div className="mb-6">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">CPF na nota (opcional)</label>
                    <input type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-emerald-400 outline-none" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} maxLength={14} />
                </div>

                <button onClick={() => onConfirm({ formaPagamento, valorRecebido: parseFloat(valorRecebido || 0), troco, cpf })} className="w-full bg-emerald-600 text-white p-5 rounded-2xl font-black text-xl shadow-lg hover:bg-emerald-700 transition-all active:scale-[0.98]">
                    💰 RECEBER {formatarMoeda(totalVenda)}
                </button>
            </div>
        </div>
    );
};

export default ModalFechamento;
