import React, { useState } from 'react';
import { IoCloseOutline, IoSearchOutline, IoCheckmarkCircleOutline, IoAddCircleOutline } from 'react-icons/io5';

const ModalVinculo = ({ produtoNota, produtosSistema, onVincular, onCriarNovo, onFechar }) => {
    const [busca, setBusca] = useState('');
    const filtrados = produtosSistema.filter(p =>
        p.name?.toLowerCase().includes(busca.toLowerCase()) ||
        p.categoriaNome?.toLowerCase().includes(busca.toLowerCase())
    );

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800">Vincular ao Produto</h3>
                    <button onClick={onFechar}><IoCloseOutline size={24} className="text-gray-400" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <p className="text-xs text-blue-600 font-bold uppercase mb-1">Produto na Nota:</p>
                        <p className="text-sm font-semibold text-gray-800">{produtoNota?.nome}</p>
                        <p className="text-xs text-gray-500 mt-1">NCM: {produtoNota?.ncm} • {produtoNota?.qtd} {produtoNota?.unidade}</p>
                    </div>
                    <div className="relative">
                        <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text" placeholder="Buscar produto no sistema..."
                            value={busca} onChange={e => setBusca(e.target.value)} autoFocus
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        />
                    </div>
                    <div className="max-h-52 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-100">
                        {filtrados.length === 0 ? (
                            <div className="p-6 text-center text-gray-400 text-sm">
                                {produtosSistema.length === 0 ? 'Carregando...' : 'Nenhum produto encontrado.'}
                            </div>
                        ) : filtrados.map(prod => (
                            <button key={prod.id} onClick={() => onVincular(prod)}
                                className="w-full text-left p-4 hover:bg-blue-50 transition-colors flex justify-between items-center group">
                                <div>
                                    <p className="font-bold text-sm text-gray-800">{prod.name}</p>
                                    <p className="text-xs text-gray-500">{prod.categoriaNome}</p>
                                </div>
                                <IoCheckmarkCircleOutline size={20} className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        ))}
                    </div>
                    <button onClick={onCriarNovo}
                        className="w-full py-3 border-2 border-dashed border-blue-200 text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-sm">
                        <IoAddCircleOutline size={20} /> Produto não existe — Cadastrar agora
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalVinculo;
