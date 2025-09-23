// src/components/PedidoCard.jsx

import React from 'react';

// Função para calcular o tempo relativo (ex: "há 2 minutos")
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

    const action = getNextAction();
    const displayName = pedido.tipo === 'delivery' 
        ? pedido.cliente?.nome || 'Cliente Delivery'
        : `Mesa ${pedido.mesaNumero || pedido.mesaId?.slice(-4) || 'N/A'}`;

    return (
        <div className={`bg-gray-800 p-3 rounded-lg shadow-lg border-2 ${isNew ? 'border-yellow-400 animate-pulse' : 'border-gray-700'}`}>
            <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-md truncate" title={displayName}>{displayName}</span>
                <span className="text-xs text-gray-400">{formatTimeAgo(pedido.createdAt)}</span>
            </div>
            
            <div className="text-sm text-gray-300 mb-2">ID: {pedido.id.slice(0, 5).toUpperCase()}</div>

            <details className="mb-3">
                <summary className="cursor-pointer text-xs text-gray-400 hover:text-white">Ver itens ({pedido.itens.length})</summary>
                <div className="pt-2 text-xs space-y-1 max-h-24 overflow-y-auto">
                    {pedido.itens.map((item, index) => (
                        <div key={index} className="flex justify-between">
                            <span className="truncate pr-2">{item.quantidade}x {item.nome}</span>
                            <span>R$ {(item.preco * item.quantidade).toFixed(2)}</span>
                        </div>
                    ))}
                </div>
            </details>

            <div className="flex justify-between items-center border-t border-gray-700 pt-2">
                <span className="font-bold text-lg">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.totalFinal || pedido.total)}
                </span>
                
                {/* ▼▼▼ CONDIÇÃO ADICIONADA AQUI ▼▼▼ */}
                {/* O botão de excluir só aparece se o status NÃO for 'finalizado' */}
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

            {action && (
                <button onClick={() => onUpdateStatus(pedido.id, action.next)} className={`w-full mt-2 font-semibold py-2 rounded ${action.color}`}>
                    {action.text}
                </button>
            )}
        </div>
    );
}