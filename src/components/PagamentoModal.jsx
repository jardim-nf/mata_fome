// src/components/PagamentoModal.jsx

import React, { useState } from 'react';

export default function PagamentoModal({ isOpen, onClose, onConfirm }) {
    const [formaPagamento, setFormaPagamento] = useState('cartao');

    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm(formaPagamento);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
                <h2 className="text-xl font-bold mb-4">Forma de Pagamento</h2>
                <div className="space-y-3">
                    <label className="flex items-center"><input type="radio" name="payment" value="cartao" checked={formaPagamento === 'cartao'} onChange={e => setFormaPagamento(e.target.value)} className="mr-2" /> Cartão (Crédito/Débito)</label>
                    <label className="flex items-center"><input type="radio" name="payment" value="dinheiro" checked={formaPagamento === 'dinheiro'} onChange={e => setFormaPagamento(e.target.value)} className="mr-2" /> Dinheiro</label>
                    <label className="flex items-center"><input type="radio" name="payment" value="pix" checked={formaPagamento === 'pix'} onChange={e => setFormaPagamento(e.target.value)} className="mr-2" /> PIX</label>
                </div>
                <div className="flex justify-end space-x-2 mt-6">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Cancelar</button>
                    <button onClick={handleConfirm} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Confirmar e Imprimir</button>
                </div>
            </div>
        </div>
    );
}