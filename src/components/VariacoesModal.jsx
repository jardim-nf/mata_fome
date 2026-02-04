import React, { useState, useEffect } from 'react';
import { IoClose, IoCheckmarkCircle, IoSquareOutline, IoCheckbox } from 'react-icons/io5';

const VariacoesModal = ({ item, onConfirm, onClose, coresEstabelecimento }) => {
    const cores = coresEstabelecimento || {
        primaria: '#0b0b0b', destaque: '#059669', background: '#111827',
        texto: { principal: '#ffffff', secundario: '#9ca3af' }
    };

    const [selectedOption, setSelectedOption] = useState(null);
    const [adicionaisDisponiveis, setAdicionaisDisponiveis] = useState([]);
    const [adicionaisSelecionados, setAdicionaisSelecionados] = useState([]);
    const [observacao, setObservacao] = useState('');
    const [total, setTotal] = useState(0);

    // --- CORREÇÃO AQUI: PROCESSAR O QUE ESTÁ DENTRO DO GRUPO ---
    useEffect(() => {
        if (item) {
            let listaFinal = [];

            // 1. Processar Adicionais
            if (item.adicionais && Array.isArray(item.adicionais)) {
                item.adicionais.forEach(adic => {
                    // VERIFICAÇÃO CRUCIAL:
                    // Se o item for um GRUPO (ex: Molhos) e tiver 'variacoes' dentro,
                    // nós pegamos as variações (o que está dentro).
                    if (adic.variacoes && adic.variacoes.length > 0) {
                        const itensDeDentro = adic.variacoes.map(subItem => ({
                            ...subItem,
                            // Garante que tenha um ID único, usando o nome se precisar
                            id: subItem.id || `${adic.id}-${subItem.nome}`, 
                            nome: subItem.nome,
                            preco: subItem.preco,
                            // Flag pra saber que veio de um grupo (opcional)
                            grupo: adic.nome 
                        }));
                        listaFinal = [...listaFinal, ...itensDeDentro];
                    } 
                    // Se não tiver variações, é um item solto (ex: Bacon Extra), adiciona ele mesmo
                    else {
                        listaFinal.push(adic);
                    }
                });
            }

            setAdicionaisDisponiveis(listaFinal);

            // 2. Se já tiver variação pré-selecionada (vinda do botão "Adicionar"), seta ela
            if (item.variacaoSelecionada) {
                setSelectedOption(item.variacaoSelecionada);
            } else if (item.variacoes && item.variacoes.length === 1) {
                setSelectedOption(item.variacoes[0]);
            }
        }
    }, [item]);

    // --- CÁLCULO DO TOTAL ---
    useEffect(() => {
        let valorBase = 0;
        
        if (selectedOption) {
            valorBase = Number(selectedOption.preco) || 0;
        } else {
            valorBase = Number(item.precoFinal || item.preco) || 0;
        }

        const valorAdicionais = adicionaisSelecionados.reduce((acc, adic) => {
            let val = adic.preco !== undefined ? adic.preco : adic.valor;
            if (typeof val === 'string') val = val.replace(',', '.');
            return acc + (Number(val) || 0);
        }, 0);

        setTotal(valorBase + valorAdicionais);
    }, [selectedOption, item, adicionaisSelecionados]);

    const handleConfirm = () => {
        if (item.variacoes && item.variacoes.length > 0 && !selectedOption) {
            return; 
        }

        onConfirm({
            ...item,
            variacaoSelecionada: selectedOption || null,
            adicionaisSelecionados: adicionaisSelecionados,
            observacao,
            precoFinal: total
        });
    };

    const toggleAdicional = (adic) => {
        setAdicionaisSelecionados(prev => {
            // Compara por ID ou por Nome para garantir que encontre o item certo
            const exists = prev.find(a => (a.id && a.id === adic.id) || a.nome === adic.nome);
            
            if (exists) {
                return prev.filter(a => (a.id && a.id !== adic.id) && a.nome !== adic.nome);
            } else {
                return [...prev, { ...adic, quantidade: 1 }];
            }
        });
    };

    const formatarMoeda = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    
    const mostrarSecaoAdicionais = adicionaisDisponiveis.length > 0;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                 style={{ backgroundColor: '#ffffff', color: '#1f2937' }}>
                
                {/* Header */}
                <div className="p-4 flex justify-between items-start shrink-0 text-white" style={{ backgroundColor: cores.destaque }}>
                    <div>
                        <span className="text-xs font-bold opacity-90 uppercase">Monte seu pedido</span>
                        <h2 className="text-xl font-extrabold mt-1 leading-tight">{item.nome}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors"><IoClose size={24} /></button>
                </div>

                {/* Conteúdo com Scroll */}
                <div className="p-5 overflow-y-auto custom-scrollbar flex-1 bg-gray-50">
                    
                    {/* 1. Variações (Obrigatório) */}
                    {item.variacoes && item.variacoes.length > 0 && (
                        <>
                            <h3 className="font-bold mb-3 text-sm uppercase text-gray-500 tracking-wide">
                                1. Escolha uma opção <span className="text-red-500 text-[10px] bg-red-100 px-2 py-0.5 rounded-full ml-1">Obrigatório</span>
                            </h3>
                            <div className="space-y-3 mb-6">
                                {item.variacoes.map((v, i) => {
                                    const isSel = selectedOption?.nome === v.nome;
                                    return (
                                        <div key={i} onClick={() => setSelectedOption(v)}
                                             className={`flex justify-between items-center p-4 rounded-xl cursor-pointer border-2 transition-all ${isSel ? 'bg-white shadow-md' : 'bg-white border-transparent hover:border-gray-200'}`}
                                             style={{ borderColor: isSel ? cores.destaque : 'transparent' }}>
                                            
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors`}
                                                     style={{ borderColor: isSel ? cores.destaque : '#d1d5db', backgroundColor: isSel ? cores.destaque : 'transparent' }}>
                                                    {isSel && <div className="w-2 h-2 bg-white rounded-full" />}
                                                </div>
                                                <span className={`font-medium ${isSel ? 'text-gray-900' : 'text-gray-500'}`}>{v.nome}</span>
                                            </div>
                                            <span className="font-bold text-sm text-gray-900">{formatarMoeda(v.preco)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* 2. Adicionais (Opcional) */}
                    {mostrarSecaoAdicionais && (
                        <div className={`${item.variacoes && item.variacoes.length > 0 ? 'border-t border-gray-200 pt-6' : ''}`}>
                            <h3 className="font-bold mb-3 text-sm uppercase text-gray-500 tracking-wide">
                                {item.variacoes && item.variacoes.length > 0 ? "2." : "1."} Adicionais <span className="text-gray-400 font-normal text-xs normal-case ml-1">(Opcional)</span>
                            </h3>
                            <div className="space-y-2">
                                {adicionaisDisponiveis.map((adic, idx) => {
                                    // Verificação segura de seleção
                                    const isSel = adicionaisSelecionados.some(a => (a.id && a.id === adic.id) || a.nome === adic.nome);
                                    
                                    let precoAdic = adic.preco !== undefined ? adic.preco : adic.valor;
                                    if(typeof precoAdic === 'string') precoAdic = parseFloat(precoAdic.replace(',', '.'));

                                    return (
                                        <div key={idx} onClick={() => toggleAdicional(adic)}
                                             className={`flex justify-between p-3 rounded-lg cursor-pointer border transition-all ${isSel ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                                            <div className="flex items-center gap-3">
                                                <div style={{ color: isSel ? cores.destaque : '#9ca3af' }}>
                                                    {isSel ? <IoCheckbox size={22} /> : <IoSquareOutline size={22} />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className={`font-medium ${isSel ? 'text-gray-900' : 'text-gray-500'}`}>{adic.nome}</span>
                                                    {/* Mostra de qual grupo veio se existir */}
                                                    {adic.grupo && <span className="text-[10px] text-gray-400 font-light">{adic.grupo}</span>}
                                                </div>
                                            </div>
                                            <span className="text-sm font-bold text-gray-700">+ {formatarMoeda(precoAdic)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="mt-6">
                        <label className="block text-sm font-bold mb-2 text-gray-700">Observações:</label>
                        <textarea className="w-full p-3 rounded-xl bg-white border border-gray-300 text-gray-900 resize-none focus:outline-none focus:ring-2"
                                  rows="3" placeholder="Ex: Tirar cebola, ponto da carne..." value={observacao} onChange={e => setObservacao(e.target.value)}
                                  style={{ '--tw-ring-color': cores.destaque }} />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-gray-500 font-medium text-sm">Total a pagar:</span>
                        <div className="text-right">
                            <span className="text-2xl font-black text-gray-900">{formatarMoeda(total)}</span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-3.5 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                            Voltar
                        </button>
                        <button onClick={handleConfirm} 
                                disabled={item.variacoes && item.variacoes.length > 0 && !selectedOption}
                                className={`flex-1 py-3.5 rounded-xl font-bold text-white flex justify-center items-center gap-2 shadow-lg transition-all active:scale-95 ${item.variacoes && item.variacoes.length > 0 && !selectedOption ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
                                style={{ backgroundColor: cores.destaque }}>
                            <IoCheckmarkCircle size={20}/> 
                            <span>Adicionar</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VariacoesModal;