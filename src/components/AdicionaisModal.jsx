import React, { useState, useEffect } from 'react';
import { IoClose, IoAdd, IoRemove, IoCheckmarkCircle } from 'react-icons/io5';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

const AdicionaisModal = ({ item, onConfirm, onClose, cores, estabelecimentoId }) => {
    const [listaAdicionais, setListaAdicionais] = useState([]);
    const [selecionados, setSelecionados] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const carregarAdicionais = async () => {
            try {
                // Aqui você busca os itens da categoria "Adicionais"
                const querySnapshot = await getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', 'Adicionais', 'itens'));
                const itens = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setListaAdicionais(itens);
            } catch (error) {
                console.error("Erro ao carregar adicionais:", error);
            } finally {
                setLoading(false);
            }
        };
        carregarAdicionais();
    }, [estabelecimentoId]);

    const toggleAdicional = (adc) => {
        const existe = selecionados.find(s => s.id === adc.id);
        if (existe) {
            setSelecionados(selecionados.filter(s => s.id !== adc.id));
        } else {
            setSelecionados([...selecionados, adc]);
        }
    };

    const handleConfirmar = () => {
        const precoAdicionais = selecionados.reduce((acc, curr) => acc + parseFloat(curr.preco || 0), 0);
        const nomesAdicionais = selecionados.map(s => s.nome).join(', ');
        
        onConfirm({
            ...item,
            precoFinal: parseFloat(item.preco) + precoAdicionais,
            observacao: item.observacao ? `${item.observacao} | Adicionais: ${nomesAdicionais}` : `Adicionais: ${nomesAdicionais}`,
            adicionais: selecionados // Para guardar a referência
        });
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-lg rounded-t-3xl p-5 animate-slide-up max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-xl font-black">Turbinar seu {item.nome}?</h3>
                        <p className="text-xs text-gray-500">Escolha os complementos</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full"><IoClose/></button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2">
                    {loading ? <p className="text-center py-4">Carregando...</p> : 
                        listaAdicionais.map(adc => {
                            const isSel = selecionados.find(s => s.id === adc.id);
                            return (
                                <div 
                                    key={adc.id} 
                                    onClick={() => toggleAdicional(adc)}
                                    className={`p-3 rounded-2xl border-2 transition-all flex justify-between items-center cursor-pointer ${isSel ? 'border-green-500 bg-green-50' : 'border-gray-100'}`}
                                >
                                    <span className="font-bold text-gray-700">{adc.nome}</span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-black text-gray-900">+ R$ {parseFloat(adc.preco).toFixed(2)}</span>
                                        {isSel ? <IoCheckmarkCircle className="text-2xl text-green-500"/> : <div className="w-6 h-6 rounded-full border-2 border-gray-200"/>}
                                    </div>
                                </div>
                            )
                        })
                    }
                </div>

                <button 
                    onClick={handleConfirmar}
                    className="w-full mt-4 py-4 rounded-2xl text-white font-bold shadow-lg"
                    style={{ backgroundColor: cores.destaque }}
                >
                    Confirmar e Adicionar
                </button>
            </div>
        </div>
    );
};

export default AdicionaisModal;