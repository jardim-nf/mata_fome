import React, { useState, useEffect } from 'react';
import { IoClose, IoCheckmarkCircle } from 'react-icons/io5';

const VariacoesModal = ({ item, onConfirm, onClose, coresEstabelecimento }) => {
    // Configuração de cores com fallback para tema escuro
    const cores = coresEstabelecimento || {
        primaria: '#0b0b0b', // Preto
        destaque: '#059669', // Verde
        background: '#111827', // Cinza muito escuro
        texto: { principal: '#ffffff', secundario: '#9ca3af' }
    };

    const [selectedOption, setSelectedOption] = useState(null);
    const [observacao, setObservacao] = useState('');
    const [total, setTotal] = useState(0);

    // Atualiza o total do rodapé
    useEffect(() => {
        if (selectedOption) {
            // MUDANÇA AQUI: Usa o preço da variação como valor final (Substituição)
            // Se o seu sistema usasse "adicionais" (ex: + R$ 2,00), seria uma soma (+ valorBase).
            // Como são tamanhos/tipos inteiros, usamos o valor cheio da variação.
            setTotal(Number(selectedOption.preco) || 0);
        } else {
            // Se nada selecionado, mostra o preço base do item
            setTotal(Number(item.preco) || 0);
        }
    }, [selectedOption, item]);

    const handleConfirm = () => {
        if (!selectedOption) return;

        const itemConfigurado = {
            ...item,
            id: item.id,
            nome: item.nome,
            variacaoSelecionada: selectedOption,
            observacao: observacao,
            precoFinal: total // Envia o total calculado corretamente
        };

        onConfirm(itemConfigurado);
    };

    const formatarMoeda = (valor) => 
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <div 
                className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                style={{ backgroundColor: '#111827', color: 'white' }}
            >
                {/* CABEÇALHO */}
                <div className="p-4 flex justify-between items-start shrink-0 relative" 
                     style={{ backgroundColor: cores.primaria }}>
                    <div>
                        <span className="text-xs font-bold opacity-80 uppercase tracking-wider text-white">Escolha a opção</span>
                        <h2 className="text-xl font-extrabold text-white leading-tight mt-1">{item.nome}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors text-white">
                        <IoClose size={24} />
                    </button>
                </div>

                {/* LISTA DE OPÇÕES */}
                <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
                    <h3 className="font-bold mb-3 text-sm uppercase tracking-wide text-gray-300">Selecione o tamanho/tipo:</h3>
                    
                    <div className="space-y-3">
                        {item.variacoes?.map((variacao, index) => {
                            const isSelected = selectedOption?.nome === variacao.nome;
                            
                            // MUDANÇA AQUI: Exibição na lista
                            // Removemos a soma (precoBase + precoVariacao)
                            // Agora mostra exatamente o preço cadastrado na variação
                            const precoFinalExibicao = Number(variacao.preco) || 0;

                            return (
                                <div 
                                    key={index}
                                    onClick={() => setSelectedOption(variacao)}
                                    className={`
                                        relative flex items-center justify-between p-4 rounded-xl cursor-pointer border transition-all duration-200
                                        ${isSelected ? 'bg-gray-800' : 'bg-transparent hover:bg-gray-800/50'}
                                    `}
                                    style={{ 
                                        borderColor: isSelected ? cores.destaque : '#374151',
                                        boxShadow: isSelected ? `0 0 0 1px ${cores.destaque}` : 'none'
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        {/* Radio Button Visual */}
                                        <div 
                                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? '' : 'border-gray-500'}`}
                                            style={{ 
                                                borderColor: isSelected ? cores.destaque : '', 
                                                backgroundColor: isSelected ? cores.destaque : 'transparent' 
                                            }}
                                        >
                                            {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                                        </div>
                                        
                                        <span className={`font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                            {variacao.nome}
                                        </span>
                                    </div>
                                    
                                    {/* Preço da Variação */}
                                    <span className="font-bold text-sm" style={{ color: isSelected ? cores.destaque : '#9ca3af' }}>
                                        {formatarMoeda(precoFinalExibicao)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-6">
                        <label className="block text-sm font-bold mb-2 text-gray-300">Observações:</label>
                        <textarea
                            className="w-full p-3 rounded-xl bg-gray-800 border border-gray-700 focus:outline-none focus:ring-1 text-white placeholder-gray-500 resize-none"
                            style={{ '--tw-ring-color': cores.destaque }} // Correção para usar a cor dinâmica no focus ring
                            rows="3"
                            placeholder="Alguma preferência?"
                            value={observacao}
                            onChange={(e) => setObservacao(e.target.value)}
                        />
                    </div>
                </div>

                {/* RODAPÉ */}
                <div className="p-4 border-t border-gray-800 bg-gray-900 shrink-0">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-gray-400 font-medium">Valor Total:</span>
                        <span className="text-2xl font-black" style={{ color: cores.destaque }}>
                            {formatarMoeda(total)}
                        </span>
                    </div>
                    
                    <div className="flex gap-3">
                        <button 
                            onClick={onClose}
                            className="flex-1 py-3.5 rounded-xl font-bold text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleConfirm}
                            disabled={!selectedOption}
                            className={`flex-1 py-3.5 rounded-xl font-bold text-white shadow-lg flex justify-center items-center gap-2 transition-all ${!selectedOption ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-110 active:scale-95'}`}
                            style={{ backgroundColor: cores.destaque }}
                        >
                            <IoCheckmarkCircle size={20}/>
                            Adicionar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VariacoesModal;