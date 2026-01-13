// src/components/GerenciarOrdemCategorias.jsx
import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";

/**
 * IMPORTANTE: No componente PAI onde você chama este componente,
 * lembre-se de adicionar a prop 'key' para forçar a recriação ao trocar de loja:
 * <GerenciarOrdemCategoria key={estabelecimentoId} ... />
 */
const GerenciarOrdemCategoria = ({ 
  estabelecimentoId, 
  categorias, 
  ordemAtual, 
  onClose, 
  onSave 
}) => {
  const [items, setItems] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  // Inicializar itens - Lógica reforçada para troca de estabelecimento
  useEffect(() => {
    // 1. Limpa o estado imediatamente para evitar dados "fantasmas" da loja anterior
    setItems([]);

    // 2. Monta a nova lista
    let novosItens = [];

    // Verificação de segurança: Se não tem estabelecimentoId, não monta nada
    if (!estabelecimentoId) return;

    if (ordemAtual && ordemAtual.length > 0) {
      // Cenário 1: Já existe uma ordem salva
      novosItens = ordemAtual.map((categoria, index) => ({
        // O ID inclui o estabelecimentoId para garantir unicidade absoluta
        id: `cat-${index}-${estabelecimentoId}-${categoria}`, 
        name: categoria
      }));
    } else if (categorias && categorias.length > 0) {
      // Cenário 2: Primeira vez, usa a lista de categorias padrão
      // Sugestão: Ordenar alfabeticamente na primeira vez para facilitar
      const categoriasOrdenadas = [...categorias].sort((a, b) => a.localeCompare(b));
      
      novosItens = categoriasOrdenadas.map((categoria, index) => ({
        id: `cat-${index}-${estabelecimentoId}-${categoria}`,
        name: categoria
      }));
    }

    // Atualiza o estado
    setItems(novosItens);

  }, [categorias, ordemAtual, estabelecimentoId]); 

  // --- Funções de Drag and Drop ---
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

  // --- Ações ---
  const handleSave = async () => {
    try {
      const novaOrdem = items.map(item => item.name);
      
      if (onSave) {
        // Passamos o ID também para garantir que está salvando no lugar certo
        await onSave(novaOrdem, estabelecimentoId);
      } else {
        toast.success('Ordem das categorias salva com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao salvar ordem:', error);
      toast.error('Erro ao salvar ordem das categorias');
    }
  };

  const handleReset = () => {
    if (!categorias || !estabelecimentoId) return;
    
    const ordemOriginal = categorias.map((categoria, index) => ({
       id: `cat-${index}-${estabelecimentoId}-${categoria}`,
       name: categoria
    }));
    // Reseta ordenando alfabeticamente
    setItems(ordemOriginal.sort((a, b) => a.name.localeCompare(b.name)));
  };

  // --- Renderização ---

  // Se não houver itens, exibe mensagem
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">
          {categorias && categorias.length > 0 
            ? "Carregando categorias..." 
            : "Nenhuma categoria encontrada no cardápio."}
        </p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
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
          💡 <strong>Como ordenar:</strong> Arraste e solte as categorias para definir a ordem de exibição no cardápio do seu Delivery.
        </p>
      </div>

      {/* Lista de categorias */}
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
            className={`
              flex items-center justify-between p-4 border-b border-gray-100 bg-white
              cursor-move transition-all duration-200 select-none
              ${isDragging ? 'opacity-50' : 'hover:bg-gray-50'}
            `}
          >
            <div className="flex items-center space-x-4">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-sm font-medium">
                {index + 1}
              </div>
              <span className="font-medium text-gray-900">{item.name}</span>
            </div>
            <div className="text-gray-400 cursor-grab active:cursor-grabbing p-2 hover:text-gray-600">
              ⋮⋮
            </div>
          </div>
        ))}
      </div>

      {/* Botões de Ação */}
      <div className="flex w-full gap-3 justify-end pt-4 border-t border-gray-200">
        <button
          onClick={handleReset}
          className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Resetar Ordem
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          <span>Salvar Ordem</span>
        </button>
      </div>

      {/* Preview Simplificado */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider font-semibold">Preview da sequência:</p>
        <div className="text-xs text-gray-500 flex flex-wrap gap-x-2 gap-y-1">
          {items.map((item, index) => (
            <span key={`preview-${item.id}`} className="inline-flex items-center bg-gray-50 px-2 py-1 rounded border border-gray-100">
              <span className="font-bold text-gray-400 mr-1">{index + 1}.</span> {item.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GerenciarOrdemCategoria;