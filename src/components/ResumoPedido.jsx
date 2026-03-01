import React from 'react';
import { FaTrash } from 'react-icons/fa';

const ResumoPedido = ({ carrinho, subtotal, taxaEntrega, cupom, total, onUpdateQuantidade, onRemoveItem }) => {
  // ... (código do componente que enviei na resposta anterior)
  return (
    <div className="resumo-pedido-container p-4 border rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Seu Pedido</h2>
      
      {carrinho.length === 0 ? (
        <p>Seu carrinho está vazio.</p>
      ) : (
        <div>
          {carrinho.map((item, index) => (
            <div key={index} className="flex justify-between items-center mb-3">
              <div className="flex-grow">
                <p className="font-semibold">{item.nome} (x{item.quantidade})</p>
                {item.adicionais && item.adicionais.length > 0 && (
                  <p className="text-sm text-gray-500">
                    Adicionais: {item.adicionais.map(ad => ad.nome).join(', ')}
                  </p>
                )}
                 {item.observacao && (
                    <p className="text-sm text-gray-500">Obs: {item.observacao}</p>
                )}
              </div>
              <div className="flex items-center">
                <p className="mr-4">R$ {(item.precoFinal * item.quantidade).toFixed(2)}</p>
                <button 
                  onClick={() => onRemoveItem(item.id, item.adicionais)} 
                  className="text-red-500 hover:text-red-700"
                >
                  <FaTrash />
                </button>
              </div>
            </div>
          ))}

          <hr className="my-4" />

          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>R$ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Taxa de Entrega</span>
              <span>R$ {taxaEntrega.toFixed(2)}</span>
            </div>
            {cupom.desconto > 0 && (
               <div className="flex justify-between text-green-600">
                 <span>Desconto ({cupom.codigo})</span>
                 <span>- R$ {cupom.desconto.toFixed(2)}</span>
               </div>
            )}
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>R$ {total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumoPedido;