import React, { useState, useEffect } from 'react';
import { IoClose, IoCheckmarkCircle, IoSquareOutline, IoCheckbox, IoLockClosed } from 'react-icons/io5';
// 🔥 1. IMPORTS DO FIREBASE (Necessários para o Salão)
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

const VariacoesModal = ({ item, onConfirm, onClose, coresEstabelecimento, estabelecimentoId, isCatalog = false }) => {
    const cores = coresEstabelecimento || {
        primaria: '#0b0b0b', destaque: '#059669', background: '#111827',
        texto: { principal: '#ffffff', secundario: '#9ca3af' }
    };

    const [selectedOption, setSelectedOption] = useState(null);
    const [adicionaisDisponiveis, setAdicionaisDisponiveis] = useState([]);
    const [adicionaisSelecionados, setAdicionaisSelecionados] = useState([]);
    const [observacao, setObservacao] = useState('');
    const [total, setTotal] = useState(0);
    const [loadingAdicionais, setLoadingAdicionais] = useState(false);
    const [condicaoPagamento, setCondicaoPagamento] = useState('dinheiro');

    const variacoesDisponiveis = React.useMemo(() => {
        if (!item.variacoes) return [];
        return item.variacoes.filter(v => {
            if (v.ativo === false) return false;
            if (isCatalog && v.estoque !== undefined && v.estoque !== null && Number(v.estoque) <= 0) return false;
            return true;
        });
    }, [item.variacoes, isCatalog]);

    const temPrecosAlternativos = (item.habilitarCartao !== false && Number(item.precoCartao) > 0) || (item.habilitarCrediario !== false && Number(item.precoCrediario) > 0) ||
        (variacoesDisponiveis && variacoesDisponiveis.length > 0 && variacoesDisponiveis.some(v => (v.habilitarCartao !== false && Number(v.precoCartao) > 0) || (v.habilitarCrediario !== false && Number(v.precoCrediario) > 0)));

    const targetPreco = selectedOption || item;
    const opcoesPrecoValidas = {
        dinheiro: true,
        cartao: targetPreco.habilitarCartao !== false && Number(targetPreco.precoCartao) > 0,
        crediario: targetPreco.habilitarCrediario !== false && Number(targetPreco.precoCrediario) > 0
    };

    useEffect(() => {
        const currentTarget = selectedOption || item;
        const cartaoValido = currentTarget.habilitarCartao !== false && Number(currentTarget.precoCartao) > 0;
        const crediarioValido = currentTarget.habilitarCrediario !== false && Number(currentTarget.precoCrediario) > 0;
        
        if (condicaoPagamento === 'cartao' && !cartaoValido) {
            setCondicaoPagamento('dinheiro');
        } else if (condicaoPagamento === 'crediario' && !crediarioValido) {
            setCondicaoPagamento('dinheiro');
        }
    }, [selectedOption, item, condicaoPagamento]);

    // --- FUNÇÃO AUXILIAR: PROCESSA OS GRUPOS (Lógica que você gosta) ---
    const processarAdicionais = (listaCrua) => {
        let listaFinal = [];
        if (listaCrua && Array.isArray(listaCrua)) {
            listaCrua.forEach(adic => {
                // Se for um GRUPO com variações/opções dentro
                const subLista = adic.variacoes || adic.opcoes || adic.itens;
                
                if (subLista && Array.isArray(subLista) && subLista.length > 0) {
                    const nomeSub = subLista[0].nome?.trim().toLowerCase() || '';
                    const isVariacaoPadraoUnica = subLista.length === 1 && 
                        (nomeSub === 'padrao' || nomeSub === 'padrão' || nomeSub === '');

                    if (isVariacaoPadraoUnica) {
                        listaFinal.push({
                            ...adic,
                            preco: adic.preco !== undefined ? adic.preco : subLista[0].preco
                        });
                    } else {
                        const itensDeDentro = subLista.map(subItem => ({
                            ...subItem,
                            id: subItem.id || `${adic.id}-${subItem.nome}`, 
                            nome: subItem.nome,
                            preco: subItem.preco,
                            grupo: adic.nome 
                        }));
                        listaFinal = [...listaFinal, ...itensDeDentro];
                    }
                } 
                // Se for item solto
                else {
                    listaFinal.push(adic);
                }
            });
        }
        return listaFinal;
    };

    // --- EFFECT PRINCIPAL: CARREGA E PROCESSA DADOS ---
    useEffect(() => {
        if (!item) return;

        const carregarDados = async () => {
            let dadosParaProcessar = [];

            // CENÁRIO 1: O item já tem os adicionais (Delivery ou Cache)
            if (item.adicionais && Array.isArray(item.adicionais) && item.adicionais.length > 0) {
                dadosParaProcessar = item.adicionais;
                setAdicionaisDisponiveis(processarAdicionais(dadosParaProcessar));
            } 
            // CENÁRIO 2: Controle de Salão (Busca no Firebase)
            else if (estabelecimentoId && item.categoriaId && item.id) {
                setLoadingAdicionais(true);
                try {
                    const adicsRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', item.categoriaId, 'itens', item.id, 'adicionais');
                    const snapshot = await getDocs(adicsRef);
                    
                    if (!snapshot.empty) {
                        // Pega os dados do banco
                        const listaDoBanco = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                        // 🔥 Aplica a sua lógica de processamento nos dados do banco
                        setAdicionaisDisponiveis(processarAdicionais(listaDoBanco));
                    } else {
                        setAdicionaisDisponiveis([]);
                    }
                } catch (error) {
                    console.error("Erro ao buscar adicionais:", error);
                } finally {
                    setLoadingAdicionais(false);
                }
            }

            // Seleção automática da variação (Padrão/Única)
            if (item.variacaoSelecionada) {
                setSelectedOption(item.variacaoSelecionada);
            } else if (variacoesDisponiveis && variacoesDisponiveis.length === 1) {
                setSelectedOption(variacoesDisponiveis[0]);
            } else if (!variacoesDisponiveis || variacoesDisponiveis.length === 0) {
                setSelectedOption({ nome: 'Padrão', preco: item.preco });
            }
        };

        carregarDados();
    }, [item, estabelecimentoId]);

    // --- CÁLCULO DO TOTAL ---
    useEffect(() => {
        const parsePreco = (val) => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') return parseFloat(val.replace(',', '.')) || 0;
            return 0;
        };

        let valorBase = 0;
        
        const target = selectedOption || item;
        let priceField = target.preco;
        if (condicaoPagamento === 'cartao' && target.precoCartao) {
            priceField = target.precoCartao;
        } else if (condicaoPagamento === 'crediario' && target.precoCrediario) {
            priceField = target.precoCrediario;
        } else if (condicaoPagamento === 'dinheiro' && Number(target.precoPromocional) > 0) {
            priceField = target.precoPromocional;
        }
        
        valorBase = parsePreco(priceField);

        const valorAdicionais = adicionaisSelecionados.reduce((acc, adic) => {
            let val = adic.preco !== undefined ? adic.preco : adic.valor;
            return acc + parsePreco(val);
        }, 0);

        setTotal(valorBase + valorAdicionais);
    }, [selectedOption, item, adicionaisSelecionados, condicaoPagamento]);

    const handleConfirm = () => {
        if (variacoesDisponiveis && variacoesDisponiveis.length > 0 && !selectedOption) {
            return; 
        }

        const condSuffix = condicaoPagamento === 'cartao' ? 'Cartão' : condicaoPagamento === 'crediario' ? 'Crediário' : '';

        const formattedItem = {
            ...item,
            variacaoSelecionada: selectedOption ? {
                ...selectedOption,
                nome: condSuffix ? `${selectedOption.nome} (${condSuffix})` : selectedOption.nome
            } : null,
            adicionaisSelecionados: adicionaisSelecionados,
            observacao,
            condicaoPagamentoSelecionada: condicaoPagamento,
            precoFinal: total
        };

        if (!selectedOption && condSuffix) {
            formattedItem.nome = `${item.nome} (${condSuffix})`;
        }

        onConfirm(formattedItem);
    };

    const toggleAdicional = (adic) => {
        setAdicionaisSelecionados(prev => {
            // Compara primeiro por ID, depois por Grupo+Nome, e por fim por Nome
            const match = (a, b) => {
                if (a.id && b.id) return a.id === b.id;
                if (a.grupo && b.grupo) return a.nome === b.nome && a.grupo === b.grupo;
                return a.nome === b.nome;
            };

            const exists = prev.find(a => match(a, adic));
            
            if (exists) {
                return prev.filter(a => !match(a, adic));
            } else {
                return [...prev, { ...adic, quantidade: 1 }];
            }
        });
    };

    const formatarMoeda = (val) => {
        if (isCatalog && (!val || Number(val) === 0)) return 'Sob Consulta';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    };
    
    const mostrarSecaoAdicionais = adicionaisDisponiveis.length > 0;
    
    // Verifica bloqueio se tem variação mas não selecionou
    const temVariacoesReais = variacoesDisponiveis && variacoesDisponiveis.length > 0;
    const bloquearAdicionais = temVariacoesReais && !selectedOption;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in" onClick={e => e.stopPropagation()}>
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
                    {temVariacoesReais && (
                        <>
                            <h3 className="font-bold mb-3 text-sm uppercase text-gray-500 tracking-wide">
                                1. Escolha uma opção <span className="text-red-500 text-[10px] bg-red-100 px-2 py-0.5 rounded-full ml-1">Obrigatório</span>
                            </h3>
                            <div className="space-y-3 mb-6">
                                {variacoesDisponiveis.map((v, i) => {
                                    const isSel = (selectedOption?.id && v.id) ? selectedOption.id === v.id : selectedOption?.nome === v.nome;
                                    return (
                                        <div key={i} onClick={() => setSelectedOption(v)}
                                             className={`flex justify-between items-center p-4 rounded-xl cursor-pointer border-2 transition-all ${isSel ? 'bg-white shadow-md' : 'bg-white border-transparent hover:border-gray-200'}`}
                                             style={{ borderColor: isSel ? cores.destaque : 'transparent' }}>
                                            
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors`}
                                                     style={{ borderColor: isSel ? cores.destaque : '#d1d5db', backgroundColor: isSel ? cores.destaque : 'transparent' }}>
                                                    {isSel && <div className="w-2 h-2 bg-white rounded-full" />}
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <span className={`font-medium ${isSel ? 'text-gray-900' : 'text-gray-500'}`}>{v.nome}</span>
                                                    {isCatalog && ((v.habilitarCartao !== false && Number(v.precoCartao) > 0) || (v.habilitarCrediario !== false && Number(v.precoCrediario) > 0)) && (
                                                        <div className="flex flex-wrap gap-2 text-[10px] text-gray-550 font-semibold mt-1">
                                                            {v.habilitarCartao !== false && Number(v.precoCartao) > 0 && <span className="flex items-center gap-0.5 text-sky-600">💳 Cartão: <strong>{formatarMoeda(v.precoCartao)}</strong></span>}
                                                            {v.habilitarCrediario !== false && Number(v.precoCrediario) > 0 && <span className="flex items-center gap-0.5 text-purple-650">📋 Crediário: <strong>{formatarMoeda(v.precoCrediario)}</strong></span>}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                {isCatalog && ((v.habilitarCartao !== false && Number(v.precoCartao) > 0) || (v.habilitarCrediario !== false && Number(v.precoCrediario) > 0)) && (
                                                    <span className="block text-[9px] uppercase text-emerald-600 font-bold">À Vista / Dinheiro</span>
                                                )}
                                                {condicaoPagamento === 'dinheiro' && Number(v.precoPromocional) > 0 ? (
                                                    <div className="flex flex-col items-end">
                                                        <span className="line-through text-xs text-gray-450 font-semibold">{formatarMoeda(v.preco)}</span>
                                                        <span className="font-black text-sm text-red-650">{formatarMoeda(v.precoPromocional)}</span>
                                                    </div>
                                                ) : (
                                                    <span className="font-bold text-sm text-gray-900">
                                                        {formatarMoeda(
                                                            condicaoPagamento === 'cartao' && v.precoCartao ? v.precoCartao :
                                                            condicaoPagamento === 'crediario' && v.precoCrediario ? v.precoCrediario :
                                                            v.preco
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                    {/* Seletor de Condição de Pagamento */}
                    {isCatalog && temPrecosAlternativos && (
                        <div className="mb-6 border-t border-gray-200 pt-5">
                            <h3 className="font-bold mb-3 text-sm uppercase text-gray-500 tracking-wide">
                                {temVariacoesReais ? "2." : "1."} Forma de Pagamento
                            </h3>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'dinheiro', label: '💵 Dinheiro', desc: 'À Vista' },
                                    { id: 'cartao', label: '💳 Cartão', desc: 'Débito/Crédito', disabled: !opcoesPrecoValidas.cartao },
                                    { id: 'crediario', label: '📋 Crediário', desc: 'Prazo', disabled: !opcoesPrecoValidas.crediario }
                                ].map(opt => {
                                    const isSel = condicaoPagamento === opt.id;
                                    return (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            disabled={opt.disabled}
                                            onClick={() => setCondicaoPagamento(opt.id)}
                                            className={`py-2 px-1 rounded-lg border text-xs font-bold text-center transition-all duration-200 flex flex-col items-center justify-center gap-0.5 active:scale-95 ${
                                                opt.disabled 
                                                    ? 'opacity-40 cursor-not-allowed bg-gray-100 border-gray-100 text-gray-400' 
                                                    : isSel 
                                                        ? 'bg-gray-800 text-white border-gray-800 shadow-md scale-[1.02]' 
                                                        : 'bg-white text-gray-650 border-gray-200 hover:bg-gray-100'
                                            }`}
                                        >
                                            <span className="truncate">{opt.label}</span>
                                            <span className={`text-[9px] font-medium ${isSel ? 'text-gray-300' : 'text-gray-400'}`}>{opt.desc}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 2. Adicionais (Opcional) */}
                    {loadingAdicionais ? (
                        <div className="py-8 flex flex-col justify-center items-center text-gray-400 gap-2">
                             <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
                             <span className="text-xs">Buscando opções...</span>
                        </div>
                    ) : mostrarSecaoAdicionais && (
                        <div className={`relative transition-all duration-300 ${temVariacoesReais ? 'border-t border-gray-200 pt-6' : ''} ${bloquearAdicionais ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}`}>
                            
                            {/* Aviso de bloqueio visual */}
                            {bloquearAdicionais && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center">
                                    <div className="bg-white/90 px-4 py-2 rounded-full shadow-sm border border-gray-200 text-xs font-bold text-gray-500 flex items-center gap-2">
                                        <IoLockClosed /> Selecione a opção acima primeiro
                                    </div>
                                </div>
                            )}

                            <h3 className="font-bold mb-3 text-sm uppercase text-gray-500 tracking-wide">
                                {(temVariacoesReais || (isCatalog && temPrecosAlternativos)) ? ((temVariacoesReais && isCatalog && temPrecosAlternativos) ? "3." : "2.") : "1."} Adicionais <span className="text-gray-400 font-normal text-xs normal-case ml-1">(Opcional)</span>
                            </h3>
                            <div className="space-y-2">
                                {adicionaisDisponiveis.map((adic, idx) => {
                                    // Verificação segura de seleção
                                    const match = (a, b) => {
                                        if (a.id && b.id) return a.id === b.id;
                                        if (a.grupo && b.grupo) return a.nome === b.nome && a.grupo === b.grupo;
                                        return a.nome === b.nome;
                                    };
                                    const isSel = adicionaisSelecionados.some(a => match(a, adic));
                                    
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
                        <textarea className="w-full p-3 rounded-xl bg-white border border-gray-300 text-[16px] text-gray-900 resize-none focus:outline-none focus:ring-2"
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
                                disabled={temVariacoesReais && !selectedOption}
                                className={`flex-1 py-3.5 rounded-xl font-bold text-white flex justify-center items-center gap-2 shadow-lg transition-all active:scale-95 ${temVariacoesReais && !selectedOption ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
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