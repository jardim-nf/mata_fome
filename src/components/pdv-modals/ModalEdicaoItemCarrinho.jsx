// src/components/pdv-modals/ModalEdicaoItemCarrinho.jsx
import React, { useState, useEffect } from 'react';
import { formatarMoeda } from './pdvHelpers';

const ModalEdicaoItemCarrinho = ({ visivel, item, onClose, onConfirm }) => {
    const [quantidade, setQuantidade] = useState(1);
    const [observacao, setObservacao] = useState('');
    const [nome, setNome] = useState('');
    const [preco, setPreco] = useState(0);

    useEffect(() => {
        if (item) {
            setQuantidade(item.quantity || 1);
            setObservacao(item.observacao || '');
            setNome(item.name || '');
            setPreco(item.isWeighed ? (item.totalPeso || item.price || 0) : (item.priceWithAddons || item.price || 0));
        }
    }, [item]);

    if (!visivel || !item) return null;

    const total = preco * quantidade;

    return (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-[9600] p-4 backdrop-blur-sm animate-fadeIn no-print">
            <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl transform animate-slideUp">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-2xl text-gray-800">Editar Item</h3>
                    <button onClick={onClose} className="bg-gray-100 p-2 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
                </div>

                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Nome do Item</label>
                        <input 
                            type="text"
                            value={nome}
                            onChange={e => setNome(e.target.value)}
                            className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold text-gray-800 outline-none focus:bg-white focus:border-emerald-500 transition-all"
                            placeholder="Nome do produto"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Preço Unitário</label>
                            <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-emerald-600">R$</span>
                                <input 
                                    type="number"
                                    step="0.01"
                                    value={preco}
                                    onChange={e => setPreco(parseFloat(e.target.value) || 0)}
                                    className="w-full p-3.5 pl-9 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-black text-emerald-600 outline-none focus:bg-white focus:border-emerald-500 transition-all tabular-nums"
                                    placeholder="0,00"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Adicionais</label>
                            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold text-gray-450 h-[48px] flex items-center truncate select-none" title={item.addonsResumo || 'Sem adicionais'}>
                                {item.addonsResumo || 'Nenhum'}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mb-6">
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Quantidade</label>
                    <div className="flex items-center gap-4 justify-center bg-gray-50 p-3 rounded-2xl border border-gray-100">
                        <button onClick={() => setQuantidade(q => Math.max(1, q - 1))} className="w-14 h-14 bg-white border-2 border-gray-200 rounded-xl text-2xl font-black hover:bg-gray-100 hover:border-gray-300 transition-all active:scale-90">−</button>
                        <span className="text-5xl font-black text-gray-800 w-24 text-center tabular-nums">{quantidade}</span>
                        <button onClick={() => setQuantidade(q => q + 1)} className="w-14 h-14 bg-white border-2 border-gray-200 rounded-xl text-2xl font-black hover:bg-gray-100 hover:border-gray-300 transition-all active:scale-90">+</button>
                    </div>
                </div>

                <div className="mb-6">
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Observação</label>
                    <textarea className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:border-emerald-400 outline-none resize-none h-24 transition-all" placeholder="Ex: Sem cebola, bem passado..." value={observacao} onChange={e => setObservacao(e.target.value)} />
                </div>

                <div className="text-right mb-6 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                    <span className="text-xs font-bold text-emerald-600/70 uppercase">Subtotal</span>
                    <p className="text-3xl font-black text-emerald-600">{formatarMoeda(total)}</p>
                </div>

                <button onClick={() => onConfirm(item.uid, quantidade, observacao, nome, preco)} className="w-full bg-emerald-600 text-white p-5 rounded-2xl font-black text-xl shadow-lg hover:bg-emerald-700 transition-all active:scale-[0.98]">
                    CONFIRMAR
                </button>
            </div>
        </div>
    );
};

export default ModalEdicaoItemCarrinho;
