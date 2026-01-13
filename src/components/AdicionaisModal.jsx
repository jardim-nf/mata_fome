import React, { useState, useEffect } from 'react';
import { IoClose, IoAdd, IoRemove, IoCheckmarkCircle } from 'react-icons/io5';

const AdicionaisModal = ({ item, onConfirm, onClose, coresEstabelecimento }) => {
    const cores = coresEstabelecimento || {
        primaria: '#0b0b0b',
        destaque: '#059669',
        background: '#111827',
        texto: { principal: '#ffffff', secundario: '#9ca3af' }
    };

    const [adicionaisSelecionados, setAdicionaisSelecionados] = useState(
        item.adicionais.reduce((acc, ad) => ({ ...acc, [ad.nome]: 0 }), {})
    );
    const [total, setTotal] = useState(0);
    const [observacao, setObservacao] = useState('');

useEffect(() => {
    let somaAdicionais = 0;
    item.adicionais.forEach(ad => {
        const qtd = adicionaisSelecionados[ad.nome] || 0;
        somaAdicionais += qtd * Number(ad.preco);
    });

    // CORREÇÃO: Não use item.precoFinal aqui!
    const precoBaseReal = item.variacaoSelecionada 
        ? Number(item.variacaoSelecionada.preco) 
        : (Number(item.preco) || 0);

    setTotal(precoBaseReal + somaAdicionais);
}, [adicionaisSelecionados, item]);
    const updateQtd = (nome, delta) => {
        setAdicionaisSelecionados(prev => {
            const novaQtd = Math.max(0, (prev[nome] || 0) + delta);
            return { ...prev, [nome]: novaQtd };
        });
    };

    const handleConfirm = () => {
        const adicionaisFinais = item.adicionais
            .filter(ad => adicionaisSelecionados[ad.nome] > 0)
            .map(ad => ({ ...ad, quantidade: adicionaisSelecionados[ad.nome] }));

        onConfirm({ ...item, adicionais: adicionaisFinais, precoFinal: total, observacao: observacao });
    };

    const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <div className="flex-col sm:flex-row max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" style={{ backgroundColor: '#111827', color: 'white' }}>
                
                <div className="p-4 flex justify-between items-center shrink-0" style={{ backgroundColor: cores.primaria }}>
                    <div>
                        <span className="text-xs font-bold opacity-80 uppercase tracking-wider text-white">Turbine seu pedido</span>
                        <h2 className="text-xl font-extrabold text-white mt-1">{item.nome}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 text-white"><IoClose size={24} /></button>
                </div>

                <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
                    <h3 className="font-bold mb-3 text-sm uppercase tracking-wide text-gray-300">Adicionais:</h3>
                    <div className="space-y-3">
                        {item.adicionais.map((ad, index) => {
                            const qtd = adicionaisSelecionados[ad.nome] || 0;
                            const isSelected = qtd > 0;
                            return (
                                <div key={index} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${isSelected ? 'bg-gray-800 border-gray-600' : 'border-gray-800'}`}>
                                    <div className="flex-1">
                                        <p className="font-medium text-white">{ad.nome}</p>
                                        <p className="text-sm font-bold" style={{ color: cores.destaque }}>+ {formatarMoeda(ad.preco)}</p>
                                    </div>
                                    <div className="flex items-center gap-3 bg-gray-900 rounded-lg p-1 border border-gray-700">
                                        <button onClick={() => updateQtd(ad.nome, -1)} className={`w-8 h-8 flex items-center justify-center rounded-md ${qtd === 0 ? 'text-gray-600 cursor-not-allowed' : 'text-red-400 hover:bg-gray-800'}`} disabled={qtd === 0}><IoRemove /></button>
                                        <span className="font-bold w-6 text-center text-white">{qtd}</span>
                                        <button onClick={() => updateQtd(ad.nome, 1)} className="w-8 h-8 flex items-center justify-center rounded-md text-green-400 hover:bg-gray-800"><IoAdd /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-6">
                        <label className="block text-sm font-bold mb-2 text-gray-300">Observações:</label>
                        <textarea className="flex-col sm:flex-row p-3 rounded-xl bg-gray-800 border border-gray-700 focus:outline-none text-white placeholder-gray-500 resize-none" rows="3" placeholder="Alguma preferência?" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
                    </div>
                </div>

                <div className="p-4 border-t border-gray-800 bg-gray-900 shrink-0">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-gray-400">Total Final:</span>
                        <span className="text-2xl font-black" style={{ color: cores.destaque }}>{formatarMoeda(total)}</span>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700">Cancelar</button>
                        <button onClick={handleConfirm} className="flex-1 py-3 rounded-xl font-bold text-white shadow-lg flex justify-center items-center gap-2 hover:brightness-110" style={{ backgroundColor: cores.destaque }}><IoCheckmarkCircle size={20}/> Confirmar</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdicionaisModal;