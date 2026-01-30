import React, { useState, useEffect } from 'react';
import { IoClose, IoCheckmarkCircle, IoSquareOutline, IoCheckbox } from 'react-icons/io5';
import { collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase'; 

// AGORA RECEBEMOS O ID DO ESTABELECIMENTO
const VariacoesModal = ({ item, onConfirm, onClose, coresEstabelecimento, estabelecimentoId }) => {
    const cores = coresEstabelecimento || {
        primaria: '#0b0b0b', destaque: '#059669', background: '#111827',
        texto: { principal: '#ffffff', secundario: '#9ca3af' }
    };

    const [selectedOption, setSelectedOption] = useState(null);
    const [adicionaisDisponiveis, setAdicionaisDisponiveis] = useState([]);
    const [adicionaisSelecionados, setAdicionaisSelecionados] = useState([]);
    const [observacao, setObservacao] = useState('');
    const [total, setTotal] = useState(0);

    // LISTA DE BLOQUEIO (Categorias que não devem ter adicionais)
    const CATEGORIAS_SEM_ADICIONAIS = ['bebidas', 'sucos', 'refrigerantes', 'sobremesas'];

    const deveMostrarAdicionais = () => {
        // Se não tiver ID do estabelecimento, não busca para evitar erros de segurança
        if (!estabelecimentoId) return false; 
        
        if (!item.categoria) return true;
        const catAtual = item.categoria.toLowerCase();
        return !CATEGORIAS_SEM_ADICIONAIS.includes(catAtual);
    };
// ... Imports e início do componente ...

    // --- BUSCA OS ADICIONAIS (CORRIGIDO PARA SUA ESTRUTURA) ---
    useEffect(() => {
        if (!estabelecimentoId) return;

        const fetchAdicionais = async () => {
            try {
                // MUDANÇA CRUCIAL:
                // Antes buscava pelo nome do item. Agora busca pela CATEGORIA "ADICIONAIS".
                // Isso vai trazer o documento "PAES", "MOLHOS", etc.
                const q = query(
                    collectionGroup(db, 'itens'), 
                    where('categoria', '==', 'ADICIONAIS')
                );
                
                const querySnapshot = await getDocs(q);
                let lista = [];
                
                querySnapshot.forEach((doc) => {
                    // FILTRO DE SEGURANÇA: Verifica se o item pertence à loja atual
                    if (doc.ref.path.includes(estabelecimentoId)) {
                        const data = doc.data();
                        
                        // Se tiver variações (como o PAES tem Gergelim, Australiano...)
                        if (data.variacoes && Array.isArray(data.variacoes)) {
                            // Dica: Adicionei o nome do grupo (ex: PAES) caso queira mostrar na tela depois
                            const variaçõesDoItem = data.variacoes.map(v => ({
                                ...v,
                                grupo: data.nome // Vai salvar "PAES" ou "MOLHOS"
                            }));
                            lista = [...lista, ...variaçõesDoItem];
                        }
                    }
                });

                // Filtra itens bugados (sem nome) - Vai esconder o "MOLHOS" até você arrumar o banco
                const listaValida = lista.filter(i => i.nome && i.nome !== "");
                
                console.log("Adicionais encontrados no Banco:", listaValida);
                setAdicionaisDisponiveis(listaValida);

            } catch (error) {
                console.error("Erro ao buscar adicionais:", error);
            }
        };

        // Chama a função
        fetchAdicionais();
        
    }, [item, estabelecimentoId]); // Recarrega se mudar o item ou a loja
    // --- CÁLCULO DO TOTAL ---
    useEffect(() => {
        const valorBase = selectedOption ? (Number(selectedOption.preco) || 0) : (Number(item.preco) || 0);
        const valorAdicionais = adicionaisSelecionados.reduce((acc, adic) => acc + (Number(adic.preco) || 0), 0);
        setTotal(valorBase + valorAdicionais);
    }, [selectedOption, item, adicionaisSelecionados]);

    const handleConfirm = () => {
        if (item.variacoes && item.variacoes.length > 0 && !selectedOption) return;
        onConfirm({
            ...item,
            variacaoSelecionada: selectedOption || null,
            adicionais: adicionaisSelecionados,
            observacao,
            precoFinal: total
        });
    };

    const toggleAdicional = (adic) => {
        setAdicionaisSelecionados(prev => {
            const exists = prev.find(a => a.nome === adic.nome);
            return exists ? prev.filter(a => a.nome !== adic.nome) : [...prev, adic];
        });
    };

    const formatarMoeda = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const mostrarSecaoAdicionais = adicionaisDisponiveis.length > 0 && deveMostrarAdicionais();

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                 style={{ backgroundColor: '#111827', color: 'white' }}>
                
                {/* Header */}
                <div className="p-4 flex justify-between items-start shrink-0" style={{ backgroundColor: cores.primaria }}>
                    <div>
                        <span className="text-xs font-bold opacity-80 uppercase text-white">Monte seu pedido</span>
                        <h2 className="text-xl font-extrabold text-white mt-1">{item.nome}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 text-white"><IoClose size={24} /></button>
                </div>

                {/* Conteúdo com Scroll */}
                <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
                    
                    {/* Variações (Só se existirem) */}
                    {item.variacoes && item.variacoes.length > 0 && (
                        <>
                            <h3 className="font-bold mb-3 text-sm uppercase text-gray-300">1. Selecione a opção (Obrigatório):</h3>
                            <div className="space-y-3 mb-6">
                                {item.variacoes.map((v, i) => {
                                    const isSel = selectedOption?.nome === v.nome;
                                    return (
                                        <div key={i} onClick={() => setSelectedOption(v)}
                                             className={`flex justify-between p-4 rounded-xl cursor-pointer border ${isSel ? 'bg-gray-800' : 'border-gray-700'}`}
                                             style={{ borderColor: isSel ? cores.destaque : '' }}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSel ? '' : 'border-gray-500'}`}
                                                     style={{ borderColor: isSel ? cores.destaque : '', backgroundColor: isSel ? cores.destaque : '' }}>
                                                    {isSel && <div className="w-2 h-2 bg-white rounded-full" />}
                                                </div>
                                                <span className={isSel ? 'text-white font-medium' : 'text-gray-300'}>{v.nome}</span>
                                            </div>
                                            <span className="font-bold text-sm" style={{ color: isSel ? cores.destaque : '#9ca3af' }}>{formatarMoeda(v.preco)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* Adicionais (Filtrados por Loja) */}
                    {mostrarSecaoAdicionais && (
                        <div className="mb-6 border-t border-gray-700 pt-4">
                            <h3 className="font-bold mb-3 text-sm uppercase text-gray-300">
                                {item.variacoes && item.variacoes.length > 0 ? "2." : "1."} Adicionais (Opcional):
                            </h3>
                            <div className="space-y-2">
                                {adicionaisDisponiveis.map((adic, idx) => {
                                    const isSel = adicionaisSelecionados.some(a => a.nome === adic.nome);
                                    return (
                                        <div key={idx} onClick={() => toggleAdicional(adic)}
                                             className={`flex justify-between p-3 rounded-lg cursor-pointer border ${isSel ? 'bg-gray-800' : 'border-gray-700'}`}
                                             style={{ borderColor: isSel ? cores.destaque : '' }}>
                                            <div className="flex items-center gap-3">
                                                <div style={{ color: isSel ? cores.destaque : '#6b7280' }}>
                                                    {isSel ? <IoCheckbox size={22} /> : <IoSquareOutline size={22} />}
                                                </div>
                                                <span className={isSel ? 'text-white' : 'text-gray-400'}>{adic.nome}</span>
                                            </div>
                                            <span className="text-sm font-semibold text-gray-400">+ {formatarMoeda(adic.preco)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="mt-6">
                        <label className="block text-sm font-bold mb-2 text-gray-300">Observações:</label>
                        <textarea className="w-full p-3 rounded-xl bg-gray-800 border border-gray-700 text-white resize-none"
                                  rows="3" placeholder="Tirar cebola, ponto da carne..." value={observacao} onChange={e => setObservacao(e.target.value)}
                                  style={{ '--tw-ring-color': cores.destaque }} />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800 bg-gray-900">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-gray-400 font-medium">Total:</span>
                        <div className="text-right">
                            <span className="text-2xl font-black" style={{ color: cores.destaque }}>{formatarMoeda(total)}</span>
                            {adicionaisSelecionados.length > 0 && <span className="block text-xs text-gray-500">Com adicionais</span>}
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-gray-300 bg-gray-800">Cancelar</button>
                        <button onClick={handleConfirm} 
                                disabled={item.variacoes && item.variacoes.length > 0 && !selectedOption}
                                className={`flex-1 py-3 rounded-xl font-bold text-white flex justify-center items-center gap-2 ${item.variacoes && item.variacoes.length > 0 && !selectedOption ? 'opacity-50' : ''}`}
                                style={{ backgroundColor: cores.destaque }}>
                            <IoCheckmarkCircle size={20}/> Adicionar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VariacoesModal;