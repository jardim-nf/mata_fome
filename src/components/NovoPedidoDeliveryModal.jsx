// src/components/NovoPedidoDeliveryModal.jsx

import { useState } from 'react';

export default function NovoPedidoDeliveryModal({ isOpen, onClose, onSave }) {
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [itens, setItens] = useState('');
  const [total, setTotal] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    if (!nomeCliente || !telefone || !endereco || !itens || !total || parseFloat(total) <= 0) {
      alert('Por favor, preencha todos os campos e o valor total corretamente.');
      return;
    }

    const itensArray = itens.split('\n').map(itemStr => {
        const trimmedStr = itemStr.trim();
        if (!trimmedStr) return null;

        const parts = trimmedStr.split('x ');
        const quantidade = parseInt(parts[0], 10);
        const nome = parts.length > 1 ? parts.slice(1).join('x ').trim() : trimmedStr;
        
        return {
            quantidade: isNaN(quantidade) ? 1 : quantidade,
            nome: nome
        };
    }).filter(Boolean); // Remove linhas vazias

    const pedidoData = {
      nomeCliente,
      telefoneCliente: telefone.replace(/\D/g, ''),
      enderecoEntrega: endereco,
      itens: itensArray,
      total: parseFloat(total),
    };

    onSave(pedidoData);
    // Limpa o formulário e fecha
    setNomeCliente('');
    setTelefone('');
    setEndereco('');
    setItens('');
    setTotal('');
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold mb-4">Novo Pedido Delivery</h2>
        <div className="space-y-4">
          <input type="text" placeholder="Nome do Cliente" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} className="w-full p-2 border rounded" />
          <input type="tel" placeholder="Telefone (WhatsApp)" value={telefone} onChange={e => setTelefone(e.target.value)} className="w-full p-2 border rounded" />
          <input type="text" placeholder="Endereço de Entrega" value={endereco} onChange={e => setEndereco(e.target.value)} className="w-full p-2 border rounded" />
          <textarea placeholder="Itens do Pedido (Ex: 2x Pizza G&#10;1x Coca 2L)" value={itens} onChange={e => setItens(e.target.value)} className="w-full p-2 border rounded" rows="4"></textarea>
          <input type="number" placeholder="Valor Total (R$)" value={total} onChange={e => setTotal(e.target.value)} className="w-full p-2 border rounded" />
        </div>
        <div className="flex justify-end space-x-4 mt-6">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Cancelar</button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Salvar Pedido</button>
        </div>
      </div>
    </div>
  );
}