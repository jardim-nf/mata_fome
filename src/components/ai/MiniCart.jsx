import React from 'react';
import { IoClose, IoCartOutline } from 'react-icons/io5';

export default function MiniCart({ itens, onClose, onCheckout }) {
  return (
    <div className="absolute inset-0 z-50 bg-gray-50 flex flex-col animate-fade-in rounded-[2rem] overflow-hidden">
      <div className="p-5 bg-white border-b border-gray-100 flex justify-between items-center shadow-sm">
        <span className="font-bold text-gray-800 flex items-center gap-2 text-xl">🛍️ Sacola</span>
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 transition">
          <IoClose size={24} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {itens.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-50">
            <IoCartOutline size={64} /><p className="mt-2">Vazia</p>
          </div>
        ) : itens.map(item => (
          <div key={item.cartItemId} className="flex justify-between items-start bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <div>
              <span className="font-bold text-gray-900 block">{item.nome}</span>
              {item.variacaoSelecionada && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md font-mono mr-2">
                  {typeof item.variacaoSelecionada === 'string' ? item.variacaoSelecionada : item.variacaoSelecionada.nome}
                </span>
              )}
              {item.adicionaisSelecionados?.length > 0 && (
                <div className="text-xs text-blue-600 font-medium mt-1">
                  + {item.adicionaisSelecionados.map(a => a.nome).join(', ')}
                </div>
              )}
              {item.observacao && (
                <div className="text-xs text-red-600 font-medium mt-1">✏️ Obs: "{item.observacao}"</div>
              )}
              <span className="text-xs text-gray-400 block mt-1">Qtd: {item.qtd}</span>
            </div>
            <span className="font-bold text-green-600">R$ {(item.precoFinal * item.qtd).toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div className="p-5 bg-white border-t border-gray-100">
        <button onClick={onCheckout} className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 hover:bg-green-700 transition-colors">
          Concluir Pedido
        </button>
      </div>
    </div>
  );
}