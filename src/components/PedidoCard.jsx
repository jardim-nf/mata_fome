// src/components/PedidoCard.jsx

import React, { useState, useMemo } from 'react';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'react-toastify';
import { FaPrint, FaTrash, FaChevronDown, FaChevronUp, FaMotorcycle, FaCheck } from 'react-icons/fa';
import { GiCookingPot } from "react-icons/gi";
import ComandaParaImpressao from './ComandaParaImpressao';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function PedidoCard({ pedido, onUpdateStatus, onDeletePedido, estabelecimentoInfo, newOrderIds }) {
    const [expanded, setExpanded] = useState(false);
    const componentRef = React.useRef();

    const handlePrint = useReactToPrint({
        content: () => componentRef.current,
        onAfterPrint: () => {
            if (pedido.status === 'recebido') {
                onUpdateStatus(pedido.id, 'preparo');
                toast.info('Pedido impresso e movido para "Em Preparo".');
            }
        }
    });

    const isNew = newOrderIds && newOrderIds.includes(pedido.id);

    const tempoDeEspera = useMemo(() => {
        if (!pedido.criadoEm?.toDate) return '';
        try {
            return formatDistanceToNow(pedido.criadoEm.toDate(), { addSuffix: true, locale: ptBR });
        } catch (e) {
            return 'calculando...';
        }
    }, [pedido.criadoEm]);

    const minutosDeEspera = useMemo(() => {
        if (!pedido.criadoEm?.toDate) return 0;
        const diff = new Date().getTime() - pedido.criadoEm.toDate().getTime();
        return Math.floor(diff / 60000);
    }, [pedido.criadoEm]);

    const statusActions = {
        recebido: [
            { label: 'Aceitar e Preparar', action: () => onUpdateStatus(pedido.id, 'preparo'), icon: <GiCookingPot />, color: 'green' },
        ],
        preparo: [
            { label: 'Saiu para Entrega', action: () => onUpdateStatus(pedido.id, 'em_entrega'), icon: <FaMotorcycle />, color: 'blue' },
        ],
        em_entrega: [
            { label: 'Marcar como Finalizado', action: () => onUpdateStatus(pedido.id, 'finalizado'), icon: <FaCheck />, color: 'purple' },
        ],
    };

    return (
        <div className={`bg-gray-700 p-3 rounded-lg shadow-lg border-l-4 ${isNew ? 'border-yellow-400 animate-pulse' : 'border-gray-600'} transition-all duration-500`}>
            <div className="flex justify-between items-center">
                <div>
                    <p className="font-bold text-white text-lg">{pedido.cliente.nome}</p>
                    <p className="text-xs text-gray-400">ID: {pedido.id.substring(0, 5).toUpperCase()}</p>
                </div>
                <div className="text-right">
                    <p className="font-semibold text-xl text-green-400">R$ {pedido.totalFinal.toFixed(2).replace('.', ',')}</p>
                    {pedido.status !== 'finalizado' && (
                        <p className={`text-xs font-medium ${minutosDeEspera > 10 ? 'text-red-400 animate-pulse' : 'text-gray-300'}`}>
                            {tempoDeEspera}
                        </p>
                    )}
                </div>
            </div>

            {expanded && (
                <div className="mt-4 border-t border-gray-600 pt-3">
                    <p className="text-sm text-gray-300"><span className="font-semibold text-gray-200">Telefone:</span> {pedido.cliente?.telefone || 'N/A'}</p>
                    {pedido.cliente?.endereco ? (
                        <>
                            <p className="text-sm text-gray-300">
                                <span className="font-semibold text-gray-200">Endereço:</span>
                                {` ${pedido.cliente.endereco.rua || ''}, ${pedido.cliente.endereco.numero || ''} - ${pedido.cliente.endereco.bairro || ''}`}
                            </p>
                            {pedido.cliente.endereco.complemento && (
                                <p className="text-sm text-gray-300">
                                    <span className="font-semibold text-gray-200">Complemento:</span>
                                    {` ${pedido.cliente.endereco.complemento}`}
                                </p>
                            )}
                        </>
                    ) : (
                         <p className="text-sm text-gray-300"><span className="font-semibold text-gray-200">Endereço:</span> Pedido para retirada.</p>
                    )}
                    <p className="text-sm text-gray-300"><span className="font-semibold text-gray-200">Pagamento:</span> {pedido.formaPagamento}</p>
                    {pedido.formaPagamento === 'dinheiro' && pedido.trocoPara > 0 && (
                        <p className="text-sm text-yellow-400"><span className="font-semibold text-yellow-300">Troco para:</span> R$ {parseFloat(pedido.trocoPara).toFixed(2).replace('.', ',')}</p>
                    )}
                    <div className="my-3">
                        <p className="font-semibold text-gray-200 mb-1">Itens:</p>
                        <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                            {pedido.itens.map((item, index) => (
                                <li key={`${item.nome}-${index}`}>
                                    {item.quantidade}x {item.nome}
                                    {item.adicionais && item.adicionais.length > 0 && (
                                        <span className="text-xs text-gray-400 ml-2">
                                            (+ {item.adicionais.map(ad => ad.nome).join(', ')})
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-600">
                <div className="flex items-center gap-3">
                    <button onClick={handlePrint} title="Imprimir" className="text-blue-400 hover:text-blue-300 transition-colors"><FaPrint size={20} /></button>
                    
                    {/* **BOTÃO DE EXCLUIR REINSERIDO AQUI** */}
                    {pedido.status === 'recebido' && (
                        <button onClick={() => onDeletePedido(pedido.id)} title="Excluir Pedido" className="text-red-500 hover:text-red-400 transition-colors">
                            <FaTrash size={18} />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {statusActions[pedido.status] && statusActions[pedido.status].map(action => (
                         <button key={action.label} onClick={action.action} className={`px-3 py-1 text-xs font-bold text-white rounded-md bg-${action.color}-500 hover:bg-${action.color}-600 transition-colors flex items-center gap-2`}>
                            {action.icon}
                            {action.label}
                        </button>
                    ))}
                    <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-white">
                        {expanded ? <FaChevronUp /> : <FaChevronDown />}
                    </button>
                </div>
            </div>

            <div style={{ display: 'none' }}>
                <ComandaParaImpressao ref={componentRef} pedido={pedido} estabelecimento={estabelecimentoInfo} />
            </div>
        </div>
    );
}