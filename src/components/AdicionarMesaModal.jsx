// src/components/AdicionarMesaModal.jsx

import { useState } from 'react';

export default function AdicionarMesaModal({ isOpen, onClose, onSave }) {
  const [numeroMesa, setNumeroMesa] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    if (numeroMesa.trim()) {
      onSave(numeroMesa.trim());
      setNumeroMesa(''); // Limpa o campo após salvar
    } else {
      alert("Por favor, digite o nome ou número da mesa.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
        <h2 className="text-xl font-bold mb-4">Adicionar Nova Mesa</h2>
        <input
          type="text"
          value={numeroMesa}
          onChange={(e) => setNumeroMesa(e.target.value)}
          placeholder="Número ou Nome da Mesa"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          autoFocus
        />
        <div className="flex justify-end space-x-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">
            Cancelar
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
            Salvar Mesa
          </button>
        </div>
      </div>
    </div>
  );
}