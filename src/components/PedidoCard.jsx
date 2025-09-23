// src/components/PedidoCard.jsx

import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Função para calcular o tempo relativo (ex: "há 21 min")
function formatTimeAgo(timestamp) {
  if (!timestamp || !timestamp.toDate) return '';
  const now = new Date();
  const seconds = Math.floor((now - timestamp.toDate()) / 1000);
  
  let interval = seconds / 60;
  if (interval < 1) return "agora";
  if (interval < 60) return `há ${Math.floor(interval)} min`;
  interval = interval / 60;
  if (interval < 24) return `há ${Math.floor(interval)} h`;
  interval = interval / 24;
  return `há ${Math.floor(interval)} d`;
}

export default function PedidoCard({ pedido, onUpdateStatus, onDeletePedido, newOrderIds }) {
    const isNew = newOrderIds.includes(pedido.id);

    const getNextAction = () => {
        const actions = {
            recebido: { next: 'preparo', text: 'Aceitar e Preparar', color: 'bg-green-500 hover:bg-green-600' },
            preparo: { 
                next: pedido.tipo === 'delivery' ? 'em_entrega' : 'pronto_para_servir', 
                text: pedido.tipo === 'delivery' ? 'Saiu para Entrega' : 'Pronto p/ Servir', 
                color: 'bg-blue-500 hover:bg-blue-600' 
            },
            em_entrega: { next: 'finalizado', text: 'Finalizar Entrega', color: 'bg-purple-500 hover:bg-purple-600' },
            pronto_para_servir: { next: 'finalizado', text: 'Finalizar Pedido', color: 'bg-purple-500 hover:bg-purple-600' }
        };
        return actions[pedido.status] || null;
    };

    const handlePrint = (e) => {
        e.stopPropagation();
        window.open(`/imprimir/pedido/${pedido.id}`, '_blank');
    };

    const action = getNextAction();
    const displayName = pedido.tipo === 'delivery' 
        ? pedido.cliente?.nome || 'Cliente Delivery'
        : `Mesa ${pedido.mesaNumero || 'N/A'}`;

    // ▼▼▼ DATA E HORA FORMATADAS AQUI ▼▼▼
    const dataHoraPedido = pedido.createdAt?.toDate 
        ? format(pedido.createdAt.toDate(), 'dd/MM/yy HH:mm', { locale: ptBR })
        : 'Data indisponível';

    return (
        <div className={`bg-gray-800 p-3 rounded-lg shadow-lg border-2 ${isNew ? 'border-yellow-400 animate-pulse' : 'border-gray-700'}`}>
            <div className="flex justify-between items-start mb-2">
                <span className="font-bold text-md truncate text-white pt-1" title={displayName}>{displayName}</span>
                
                {/* ▼▼▼ EXIBIÇÃO DA DATA E DO TEMPO CORRIDO ▼▼▼ */}
                <div className="text-right flex-shrink-0 ml-2">
                    <span className="text-xs font-semibold text-gray-300 block">{dataHoraPedido}</span>
                    <span className="text-xs text-gray-400 block">{formatTimeAgo(pedido.createdAt)}</span>
                </div>
            </div>
            
            <div className="text-sm text-gray-300 mb-2">ID: {pedido.id.slice(0, 5).toUpperCase()}</div>

            <details className="mb-3">
                <summary className="cursor-pointer text-xs text-gray-400 hover:text-white">Ver itens ({pedido.itens.length})</summary>
                <div className="pt-2 text-xs space-y-1 max-h-24 overflow-y-auto text-gray-200">
                    {pedido.itens.map((item, index) => (
                        <div key={index} className="flex justify-between">
                            <span className="truncate pr-2">{item.quantidade}x {item.nome}</span>
                            <span>R$ {(item.preco * item.quantidade).toFixed(2).replace('.',',')}</span>
                        </div>
                    ))}
                </div>
            </details>

            <div className="flex justify-between items-center border-t border-gray-700 pt-2">
                <span className="font-bold text-lg text-white">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.totalFinal || pedido.total)}
                </span>
                
                <div className="flex items-center gap-2">
                    {pedido.tipo === 'delivery' && (
                        <button 
                            onClick={handlePrint} 
                            className="text-gray-400 hover:text-white p-1"
                            title="Imprimir Pedido"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v6a2 2 0 002 2h1v-4a1 1 0 011-1h8a1 1 0 011 1v4h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm-6 8a1 1 0 100 2h8a1 1 0 100-2H7z" clipRule="evenodd" />
                            </svg>
                        </button>
                    )}

                    {pedido.status !== 'finalizado' && (
                        <button 
                            onClick={() => onDeletePedido(pedido.id)} 
                            className="text-red-500 hover:text-red-400 p-1"
                            title="Excluir Pedido"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
                        </button>
                    )}
                </div>
            </div>

            {action && (
                <button onClick={() => onUpdateStatus(pedido.id, action.next)} className={`w-full mt-2 font-semibold py-2 rounded ${action.color}`}>
                    {action.text}
                </button>
            )}
        </div>
    );
}