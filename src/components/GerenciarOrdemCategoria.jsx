// src/components/GerenciarOrdemCategorias.jsx
import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";

const GerenciarOrdemCategoria = ({ 
  estabelecimentoId, 
  categorias, 
  ordemAtual, 
  onClose, 
  onSave 
}) => {
  const [items, setItems] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  // Inicializar itens
  useEffect(() => {
    // DIAGNÓSTICO: Verifique isso no console do navegador (F12)
    console.log("🛠️ GerenciarOrdemCategoria recebeu ID:", estabelecimentoId);

    // 1. Limpa estado anterior
    setItems([]);

    if (!estabelecimentoId) return;

    let novosItens = [];

    // Cenário 1: Já existe ordem salva
    if (ordemAtual && ordemAtual.length > 0) {
      novosItens = ordemAtual.map((categoria, index) => ({
        id: `cat-${index}-${estabelecimentoId}-${categoria}`, 
        name: categoria
      }));
    } 
    // Cenário 2: Usa ordem padrão do cardápio
    else if (categorias && categorias.length > 0) {
      const categoriasOrdenadas = [...categorias].sort((a, b) => a.localeCompare(b));
      novosItens = categoriasOrdenadas.map((categoria, index) => ({
        id: `cat-${index}-${estabelecimentoId}-${categoria}`,
        name: categoria
      }));
    }

    setItems(novosItens);

  }, [categorias, ordemAtual, estabelecimentoId]); 

  // --- Drag and Drop ---
  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', index);
    setIsDragging(true);
    e.target.classList.add('dragging');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.target.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.target.classList.remove('drag-over');
  };

  const handleDrop = (e, newIndex) => {
    e.preventDefault();
    e.target.classList.remove('drag-over');
    
    const oldIndex = parseInt(e.dataTransfer.getData('text/plain'));
    
    if (oldIndex !== newIndex && oldIndex >= 0 && oldIndex < items.length) {
      const newItems = [...items];
      const [movedItem] = newItems.splice(oldIndex, 1);
      newItems.splice(newIndex, 0, movedItem);
      setItems(newItems);
    }
    
    setIsDragging(false);
  };

  const handleDragEnd = (e) => {
    setIsDragging(false);
    document.querySelectorAll('.dragging').forEach(el => {
      el.classList.remove('dragging');
    });
    document.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
  };

  // --- Salvar ---
  const handleSave = async () => {
    try {
      const novaOrdem = items.map(item => item.name);
      if (onSave) {
        // Envia o ID junto para garantir
        await onSave(novaOrdem, estabelecimentoId);
      } else {
        toast.success('Ordem salva!');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao salvar.');
    }
  };

  const handleReset = () => {
    if (!categorias) return;
    const ordemOriginal = categorias.map((categoria, index) => ({
       id: `cat-${index}-${estabelecimentoId}-${categoria}`,
       name: categoria
    }));
    setItems(ordemOriginal.sort((a, b) => a.name.localeCompare(b.name)));
  };

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Carregando ou sem categorias...</p>
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-500 text-white rounded">Voltar</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800 text-sm">💡 Arraste para ordenar.</p>
      </div>

      <div className="border border-gray-200 rounded-lg max-h-[60vh] overflow-y-auto bg-gray-50">
        {items.map((item, index) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center justify-between p-4 border-b bg-white cursor-move ${isDragging ? 'opacity-50' : 'hover:bg-gray-50'}`}
          >
            <div className="flex items-center space-x-4">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-sm font-medium">{index + 1}</div>
              <span className="font-medium text-gray-900">{item.name}</span>
            </div>
            <div className="text-gray-400">⋮⋮</div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button onClick={handleReset} className="px-4 py-2 text-gray-600 bg-gray-100 rounded">Resetar</button>
        <button onClick={onClose} className="px-4 py-2 text-gray-600 bg-gray-100 rounded">Cancelar</button>
        <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded shadow-sm">Salvar Ordem</button>
      </div>
    </div>
  );
};

export default GerenciarOrdemCategoria;