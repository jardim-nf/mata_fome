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

  // Inicializar itens - Corrigido para observar estabelecimentoId
  useEffect(() => {
    // Definimos uma função para montar a lista para evitar duplicidade de código
    const montarLista = () => {
      if (ordemAtual && ordemAtual.length > 0) {
        // Se já existe uma ordem salva para este estabelecimento
        return ordemAtual.map((categoria, index) => ({
          id: `categoria-${index}-${estabelecimentoId}`, // Adicionei ID único para garantir renderização correta
          name: categoria
        }));
      } else if (categorias && categorias.length > 0) {
        // Se não tem ordem, pega as categorias padrão
        // Opcional: Aqui você pode ordenar alfabeticamente se for a primeira vez
        return categorias.map((categoria, index) => ({
          id: `categoria-${index}-${estabelecimentoId}`,
          name: categoria
        }));
      }
      return [];
    };

    setItems(montarLista());
    
  }, [categorias, ordemAtual, estabelecimentoId]); // <--- AQUI ESTÁ A CORREÇÃO PRINCIPAL

  // Funções de Drag and Drop
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
    
    if (oldIndex !== newIndex) {
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

  // Salvar ordem
  const handleSave = async () => {
    try {
      const novaOrdem = items.map(item => item.name);
      
      if (onSave) {
        // Passamos o estabelecimentoId junto caso sua função precise confirmar
        await onSave(novaOrdem, estabelecimentoId);
      } else {
        toast.success('Ordem das categorias salva com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao salvar ordem:', error);
      toast.error('Erro ao salvar ordem das categorias');
    }
  };

  // Resetar ordem
  const handleReset = () => {
    if (!categorias) return;
    
    const ordemOriginal = categorias.map((categoria, index) => ({
      id: `categoria-${index}-${estabelecimentoId}`,
      name: categoria
    }));
    // Ordena alfabeticamente ao resetar (opcional, remova o .sort se não quiser)
    setItems(ordemOriginal.sort((a, b) => a.name.localeCompare(b.name)));
  };

  if (!items.length) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Nenhuma categoria encontrada no cardápio.</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Instruções */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800 text-sm">
          💡 <strong>Como ordenar:</strong> Arraste e solte as categorias para definir a ordem de exibição no cardápio.
        </p>
      </div>

      {/* Lista de categorias */}
      <div className="border border-gray-200 rounded-lg max-h-[60vh] overflow-y-auto">
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
            className={`
              flex items-center justify-between p-4 border-b border-gray-100 bg-white
              cursor-move transition-all duration-200
              ${isDragging ? 'opacity-50' : 'hover:bg-gray-50'}
            `}
          >
            <div className="flex items-center space-x-4">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-sm font-medium">
                {index + 1}
              </div>
              <span className="font-medium text-gray-900">{item.name}</span>
            </div>
            <div className="text-gray-400 cursor-grab active:cursor-grabbing">
              ⋮⋮
            </div>
          </div>
        ))}
      </div>

      {/* Ações */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4 border-t border-gray-200">
        <button
          onClick={handleReset}
          className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Resetar Ordem (Alfabético)
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          Salvar Ordem
        </button>
      </div>

      {/* Preview da ordem (Opcional - pode remover se ocupar muito espaço) */}
      <div className="bg-gray-50 rounded-lg p-4 mt-4">
        <h3 className="font-medium text-gray-900 mb-2 text-xs uppercase tracking-wider">Preview:</h3>
        <div className="text-sm text-gray-600 flex flex-wrap gap-2">
          {items.map((item, index) => (
            <span key={item.id} className="inline-flex items-center">
              <span className="font-semibold">{index + 1}.</span>&nbsp;{item.name}
              {index < items.length - 1 && <span className="text-gray-400 ml-2">→</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GerenciarOrdemCategoria;