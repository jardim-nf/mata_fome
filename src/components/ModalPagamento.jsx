// src/components/ModalPagamento.jsx
import React, { useState } from 'react';
import { toast } from 'react-toastify';

const formasPagamento = [
  { id: 'dinheiro', nome: '💵 Dinheiro' },
  { id: 'pix', nome: '📱 PIX' },
  { id: 'cartao_credito', nome: '💳 Cartão Crédito' },
  { id: 'cartao_debito', nome: '💳 Cartão Débito' },
  { id: 'vale_refeicao', nome: '🍽️ Vale Refeição' }
];

export default function ModalPagamento({ isOpen, onClose, mesa, onConfirmarPagamento }) {
  const [formaSelecionada, setFormaSelecionada] = useState('');

  if (!isOpen || !mesa) return null;

  const handleConfirmar = () => {
    if (!formaSelecionada) {
      toast.error('Selecione uma forma de pagamento');
      return;
    }

    onConfirmarPagamento(mesa.id, formaSelecionada);
    setFormaSelecionada('');
    onClose();
  };

  const formatCurrency = (amount) => {
    const numericAmount = parseFloat(amount || 0);
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(numericAmount);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Finalizar Mesa {mesa.numero}
        </h2>

        {/* Resumo da Mesa */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-gray-700 mb-2">Resumo do Pedido:</h3>
          
          {/* Lista de Itens */}
          {mesa.itens && mesa.itens.length > 0 ? (
            <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
              {mesa.itens.map((item, index) => (
                <div key={index} className="flex justify-between text-sm border-b pb-1">
                  <span className="text-gray-600">
                    {item.quantidade}x {item.nome}
                  </span>
                  <span className="font-medium">
                    {formatCurrency(item.preco * item.quantidade)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Nenhum item no pedido</p>
          )}

          {/* Total */}
          <div className="border-t pt-2">
            <div className="flex justify-between font-bold text-lg">
              <span>Total:</span>
              <span className="text-green-600">{formatCurrency(mesa.total)}</span>
            </div>
          </div>
        </div>

        {/* Formas de Pagamento */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-700 mb-3">Forma de Pagamento:</h3>
          <div className="grid grid-cols-2 gap-2">
            {formasPagamento.map((forma) => (
              <button
                key={forma.id}
                onClick={() => setFormaSelecionada(forma.id)}
                className={`p-3 border rounded-lg text-center transition-colors ${
                  formaSelecionada === forma.id
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {forma.nome}
              </button>
            ))}
          </div>
        </div>

        {/* Botões */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-3 px-4 rounded-lg font-semibold transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-lg font-semibold transition-colors"
          >
            ✅ Confirmar Pagamento
          </button>
        </div>
      </div>
    </div>
  );
}