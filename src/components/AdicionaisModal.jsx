import React, { useState, useEffect } from 'react';
import { IoClose, IoCheckmarkCircle, IoSquareOutline, IoCheckbox } from 'react-icons/io5';

const AdicionaisModal = ({ item, onConfirm, onClose, coresEstabelecimento }) => {
    // Fallback de cores para evitar erro se vier undefined
    const cores = coresEstabelecimento || {
        primaria: '#0b0b0b', destaque: '#059669', background: '#ffffff',
        texto: { principal: '#111827' }
    };

    const [listaAdicionais, setListaAdicionais] = useState([]);
    const [selecionados, setSelecionados] = useState([]);

    useEffect(() => {
        // Usa os adicionais que já foram injetados pelo Menu.jsx
        if (item && item.adicionais) {
            setListaAdicionais(item.adicionais);
        }
    }, [item]);

    const toggleAdicional = (adc) => {
        const existe = selecionados.find(s => s.id === adc.id);
        if (existe) {
            setSelecionados(selecionados.filter(s => s.id !== adc.id));
        } else {
            // Garante quantidade 1 ao selecionar
            setSelecionados([...selecionados, { ...adc, quantidade: 1 }]);
        }
    };

    const handleConfirmar = () => {
        // Calcula o preço total dos adicionais
        const precoAdicionais = selecionados.reduce((acc, curr) => {
            const valor = curr.preco !== undefined ? curr.preco : curr.valor;
            // Trata string "10,00" virando número 10.00
            const valorNumerico = typeof valor === 'string' 
                ? parseFloat(valor.replace(',', '.')) 
                : parseFloat(valor || 0);
            return acc + valorNumerico;
        }, 0);

        // Preço base do item
        const precoBase = parseFloat(item.precoFinal || item.preco || 0);

        onConfirm({
            ...item,
            precoFinal: precoBase + precoAdicionais,
            adicionaisSelecionados: selecionados, // Passa a lista estruturada
            // A observação é montada no componente pai ou aqui se preferir textual
            observacao: item.observacao || ''
        });
    };

    const formatarMoeda = (val) => {
        const valor = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-md sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-4 flex justify-between items-center" style={{ backgroundColor: cores.destaque }}>
                    <div className="text-white">
                        <h3 className="text-lg font-extrabold leading-tight">Turbinar {item.nome}?</h3>
                        <p className="text-xs opacity-90">Escolha os complementos</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors">
                        <IoClose size={20}/>
                    </button>
                </div>

                {/* Lista */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
                    {listaAdicionais.length === 0 ? (
                        <p className="text-center text-gray-500 py-4">Nenhum adicional disponível para este item.</p>
                    ) : (
                        listaAdicionais.map((adc, idx) => {
                            const isSel = selecionados.find(s => s.id === adc.id);
                            // Normaliza preço para exibição
                            let precoExibicao = adc.preco !== undefined ? adc.preco : adc.valor;
                            
                            return (
                                <div 
                                    key={adc.id || idx} 
                                    onClick={() => toggleAdicional(adc)}
                                    className={`p-3 rounded-xl border transition-all flex justify-between items-center cursor-pointer ${isSel ? 'bg-white border-green-500 shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div style={{ color: isSel ? cores.destaque : '#d1d5db' }}>
                                            {isSel ? <IoCheckbox size={24} /> : <IoSquareOutline size={24} />}
                                        </div>
                                        <span className={`font-bold ${isSel ? 'text-gray-800' : 'text-gray-500'}`}>{adc.nome}</span>
                                    </div>
                                    <span className="text-sm font-bold text-gray-700">+ {formatarMoeda(precoExibicao)}</span>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-white">
                    <button 
                        onClick={handleConfirmar}
                        className="w-full py-3.5 rounded-xl text-white font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
                        style={{ backgroundColor: cores.destaque }}
                    >
                        <IoCheckmarkCircle size={20} />
                        Confirmar e Adicionar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdicionaisModal;