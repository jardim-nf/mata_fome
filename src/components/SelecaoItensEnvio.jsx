import React, { useState, useMemo } from 'react';
import { IoClose, IoPaperPlane, IoRestaurant } from 'react-icons/io5';

const SelecaoItensEnvio = ({ mesa, onEnviarLote, onCancelar }) => {
    const [itensSelecionados, setItensSelecionados] = useState([]);
    
    // Filtrar apenas itens pendentes (não enviados)
    const itensPendentes = useMemo(() => {
        return mesa.itens?.filter(item => 
            item.status === 'pendente' || !item.status
        ) || [];
    }, [mesa.itens]);

    const toggleItem = (item) => {
        setItensSelecionados(prev => 
            prev.some(i => i.id === item.id)
                ? prev.filter(i => i.id !== item.id)
                : [...prev, item]
        );
    };

    const toggleTodos = () => {
        if (itensSelecionados.length === itensPendentes.length) {
            setItensSelecionados([]);
        } else {
            setItensSelecionados([...itensPendentes]);
        }
    };

    const calcularTotal = () => {
        return itensSelecionados.reduce((total, item) => 
            total + (item.preco * item.quantidade), 0
        );
    };

    const handleEnviar = () => {
        if (itensSelecionados.length === 0) return;
        onEnviarLote(itensSelecionados);
    };

    if (itensPendentes.length === 0) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
                    <div className="text-center">
                        <IoRestaurant className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-bold mb-2">Nenhum item pendente</h3>
                        <p className="text-gray-600 mb-4">
                            Todos os itens desta mesa já foram enviados para a cozinha.
                        </p>
                        <button
                            onClick={onCancelar}
                            className="bg-blue-500 text-white px-6 py-2 rounded-lg"
                        >
                            Voltar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
                {/* CABEÇALHO */}
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-bold">
                            Enviar para Cozinha
                        </h3>
                        <p className="text-sm text-gray-600">
                            Mesa {mesa.numero} - {mesa.pessoas} {mesa.pessoas === 1 ? 'pessoa' : 'pessoas'}
                        </p>
                    </div>
                    <button
                        onClick={onCancelar}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        <IoClose className="w-6 h-6" />
                    </button>
                </div>

                {/* LISTA DE ITENS PENDENTES */}
                <div className="flex-1 overflow-y-auto mb-4 border rounded-lg">
                    {/* HEADER DA LISTA */}
                    <div className="flex items-center gap-3 p-3 border-b bg-gray-50">
                        <input
                            type="checkbox"
                            checked={itensSelecionados.length === itensPendentes.length && itensPendentes.length > 0}
                            onChange={toggleTodos}
                            className="w-4 h-4"
                        />
                        <span className="text-sm font-medium text-gray-700">
                            Selecionar todos ({itensPendentes.length} itens)
                        </span>
                    </div>

                    {/* ITENS */}
                    {itensPendentes.map(item => (
                        <div key={item.id} className="flex items-center gap-3 p-3 border-b hover:bg-gray-50">
                            <input
                                type="checkbox"
                                checked={itensSelecionados.some(i => i.id === item.id)}
                                onChange={() => toggleItem(item)}
                                className="w-4 h-4"
                            />
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-medium text-gray-900">
                                            {item.quantidade}x {item.nome}
                                        </p>
                                        {item.observacoes && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Obs: {item.observacoes}
                                            </p>
                                        )}
                                        {item.adicionais && item.adicionais.length > 0 && (
                                            <div className="text-xs text-gray-500 mt-1">
                                                Adicionais: {item.adicionais.map(adicional => adicional.nome).join(', ')}
                                            </div>
                                        )}
                                    </div>
                                    <span className="font-semibold text-gray-700 whitespace-nowrap ml-2">
                                        R$ {(item.preco * item.quantidade).toFixed(2)}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                    Adicionado: {new Date(item.adicionadoEm?.toDate?.() || item.adicionadoEm).toLocaleTimeString('pt-BR')}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* RESUMO E AÇÕES */}
                <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <span className="text-sm text-gray-600">
                                {itensSelecionados.length} itens selecionados
                            </span>
                            <div className="font-bold text-lg">
                                Total: R$ {calcularTotal().toFixed(2)}
                            </div>
                        </div>
                        
                        <div className="flex gap-2">
                            <button
                                onClick={onCancelar}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleEnviar}
                                disabled={itensSelecionados.length === 0}
                                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <IoPaperPlane className="w-4 h-4" />
                                Enviar {itensSelecionados.length} Itens
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SelecaoItensEnvio;