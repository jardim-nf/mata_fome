import React from 'react';
import { formatarMoeda } from './pdvHelpers';
import { IoClose, IoBagCheckOutline, IoScaleOutline } from 'react-icons/io5';

const ModalOpcoesProduto = ({ produto, onClose, onSelectOption }) => {
    if (!produto) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9600] p-4 backdrop-blur-sm animate-fadeIn no-print">
            <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl border border-slate-100 transform animate-slideUp relative overflow-hidden">
                {/* Visual Accent */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>

                <div className="flex justify-between items-start mb-6 pt-2">
                    <div>
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                            Opções de Venda
                        </span>
                        <h3 className="font-extrabold text-xl text-slate-800 mt-2.5 leading-tight">{produto.name}</h3>
                    </div>
                    <button onClick={onClose} className="bg-slate-50 p-2 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                        <IoClose size={20} />
                    </button>
                </div>

                <p className="text-slate-500 text-xs font-semibold mb-6 leading-relaxed">
                    Selecione como deseja adicionar este produto ao carrinho de compras:
                </p>

                <div className="space-y-4 mb-2">
                    {/* Option 1: Whole Sack/Unit */}
                    <button
                        onClick={() => onSelectOption(produto, 'saco')}
                        className="w-full bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 p-4 rounded-2xl flex items-center gap-4 transition-all text-left shadow-sm hover:shadow group"
                    >
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-600 border border-slate-100 group-hover:scale-105 transition-transform shrink-0">
                            <IoBagCheckOutline size={24} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="font-extrabold text-slate-800 text-sm leading-snug">Saco Inteiro / Unidade</p>
                            <p className="font-black text-emerald-600 text-base mt-0.5">{formatarMoeda(produto.price)}</p>
                        </div>
                    </button>

                    {/* Option 2: Fraction (Kg) */}
                    <button
                        onClick={() => onSelectOption(produto, 'fracao')}
                        className="w-full bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 p-4 rounded-2xl flex items-center gap-4 transition-all text-left shadow-sm hover:shadow group"
                    >
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-650 border border-slate-100 group-hover:scale-105 transition-transform shrink-0">
                            <IoScaleOutline size={24} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="font-extrabold text-slate-800 text-sm leading-snug">Venda Fracionada (Kg)</p>
                            <p className="font-black text-indigo-650 text-base mt-0.5">{formatarMoeda(produto.precoKgVarejo)} <span className="text-[10px] text-slate-400 font-bold">/ Kg</span></p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalOpcoesProduto;
