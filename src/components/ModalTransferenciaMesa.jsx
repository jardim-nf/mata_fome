import React, { useState, useEffect, useMemo } from 'react';
import { IoClose, IoSwapHorizontal, IoPerson, IoArrowForward } from 'react-icons/io5';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

const ModalTransferenciaMesa = ({ isOpen, onClose, estabelecimentoId, mesaAtual, onConfirmar }) => {
    const [busca, setBusca] = useState('');
    const [mesasDisponiveis, setMesasDisponiveis] = useState([]);
    const [carregando, setCarregando] = useState(false);
    const [destinoSelecionado, setDestinoSelecionado] = useState(null);

    useEffect(() => {
        if (!isOpen || !estabelecimentoId || !mesaAtual) return;
        const fetchMesas = async () => {
            setCarregando(true);
            try {
                const q = query(collection(db, 'estabelecimentos', estabelecimentoId, 'mesas'), orderBy('numero'));
                const snap = await getDocs(q);
                const lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Filtra a própria mesa e mesas em fechamento de conta
                const filtradas = lista.filter(m => m.id !== mesaAtual.id && m.status !== 'pagamento');
                
                // Sort manual customizado que suporta alphanum
                filtradas.sort((a, b) => {
                    const numA = parseFloat(a.numero);
                    const numB = parseFloat(b.numero);
                    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                    return String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true });
                });

                setMesasDisponiveis(filtradas);
            } catch (error) {
                console.error("Erro ao buscar mesas", error);
            } finally {
                setCarregando(false);
            }
        };
        fetchMesas();
    }, [isOpen, estabelecimentoId, mesaAtual]);

    const mesasFiltradasBusca = useMemo(() => {
        if (!busca) return mesasDisponiveis;
        const b = busca.toLowerCase();
        return mesasDisponiveis.filter(m => 
            String(m.numero).includes(b) || (m.nome && m.nome.toLowerCase().includes(b))
        );
    }, [mesasDisponiveis, busca]);

    if (!isOpen || !mesaAtual) return null;

    const podeConfirmar = destinoSelecionado !== null;
    const isJuncao = destinoSelecionado && destinoSelecionado.status !== 'livre';

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-50 w-full sm:w-[500px] h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300">
                
                {/* Header */}
                <div className="bg-white px-5 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                            <IoSwapHorizontal className="text-blue-600" />
                            Transferir / Juntar
                        </h2>
                        <p className="text-xs text-gray-500 font-medium">Mova o consumo da <strong className="text-gray-800">Mesa {mesaAtual.numero}</strong></p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-10 h-10 bg-gray-100 hover:bg-red-100 hover:text-red-600 rounded-full flex items-center justify-center transition-colors text-gray-500"
                    >
                        <IoClose size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
                    
                    {/* Visualizer da Origem */}
                    <div className="bg-blue-50 border-2 border-dashed border-blue-200 p-4 rounded-2xl flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-600 text-white font-black text-xl flex items-center justify-center rounded-xl shadow-inner">
                            {mesaAtual.numero}
                        </div>
                        <div>
                            <h3 className="font-bold text-blue-900">Mesa Origem</h3>
                            <p className="text-xs text-blue-700 opacity-80">{mesaAtual.itens?.length || 0} itens • R$ {parseFloat(mesaAtual.total || 0).toFixed(2)}</p>
                        </div>
                    </div>

                    {/* Busca */}
                    <div className="relative mt-2">
                        <input 
                            type="text" 
                            placeholder="Buscar mesa de destino (número ou nome)..." 
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            className="w-full bg-white border border-gray-300 pl-4 pr-4 py-3 rounded-xl text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                        />
                    </div>

                    {/* Grid de Mesas */}
                    <div className="mt-2">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Selecione o Destino</h4>
                        
                        {carregando ? (
                            <div className="py-10 flex flex-col items-center justify-center text-gray-400">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                                <span className="text-sm">Buscando mesas...</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                {mesasFiltradasBusca.map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => setDestinoSelecionado(m)}
                                        className={`relative p-3 rounded-2xl border-2 text-left flex flex-col gap-1 transition-all
                                            ${destinoSelecionado?.id === m.id 
                                                ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 shadow-md' 
                                                : 'bg-white border-gray-200 hover:border-gray-300 active:scale-95'
                                            }`}
                                    >
                                        <div className="flex justify-between items-center w-full">
                                            <span className={`text-xl font-black ${destinoSelecionado?.id === m.id ? 'text-blue-700' : 'text-gray-800'}`}>
                                                {m.numero}
                                            </span>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider
                                                ${m.status === 'livre' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                                            `}>
                                                {m.status === 'livre' ? 'Livre' : 'Ocupada'}
                                            </span>
                                        </div>
                                        
                                        {m.status !== 'livre' && (
                                            <div className="text-[10px] text-gray-500 flex items-center gap-1 font-medium mt-1">
                                                <IoPerson /> {m.nome || 'Cliente'} • R$ {parseFloat(m.total || 0).toFixed(2)}
                                            </div>
                                        )}
                                        
                                    </button>
                                ))}
                                {mesasFiltradasBusca.length === 0 && (
                                    <div className="col-span-2 text-center py-6 text-sm text-gray-400 font-medium">
                                        Nenhuma mesa encontrada.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Action */}
                <div className="bg-white border-t border-gray-200 p-5 shrink-0 flex flex-col gap-3">
                    {/* Alerta de consequência */}
                    {destinoSelecionado && (
                        <div className={`p-3 rounded-xl border flex items-start gap-3 text-sm font-bold
                            ${isJuncao 
                                ? 'bg-orange-50 border-orange-200 text-orange-800' 
                                : 'bg-green-50 border-green-200 text-green-800'
                            }`}
                        >
                            <IoArrowForward className="text-xl shrink-0 mt-0.5" />
                            <p>
                                {isJuncao 
                                    ? `Você está JUNTANDO a Mesa ${mesaAtual.numero} com a Mesa ${destinoSelecionado.numero}. Os itens serão somados.`
                                    : `Você está TRANSFERINDO todos os itens para a Mesa ${destinoSelecionado.numero}. A Mesa ${mesaAtual.numero} ficará Livre.`
                                }
                            </p>
                        </div>
                    )}

                    <button 
                        onClick={() => podeConfirmar && onConfirmar(destinoSelecionado)}
                        disabled={!podeConfirmar}
                        className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg
                            ${podeConfirmar 
                                ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95' 
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                            }`}
                    >
                        {isJuncao ? 'Confirmar Junção' : 'Confirmar Transferência'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalTransferenciaMesa;
