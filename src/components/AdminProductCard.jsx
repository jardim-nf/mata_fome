// src/components/AdminProductCard.jsx
import React, { useState } from 'react';
import { 
  IoCube, 
  IoPricetag, 
  IoAlertCircle, 
  IoCheckmarkCircle, 
  IoCloseCircle,
  IoPencil,
  IoTrash,
  IoPower
} from 'react-icons/io5';

export default function AdminProductCard({ 
  produto, 
  onEdit, 
  onDelete, 
  onToggleStatus,
  onUpdateStock,
  stockStatus,
  profitMargin 
}) {
  const [editingStock, setEditingStock] = useState(false);
  const [newStockValue, setNewStockValue] = useState(produto.estoque || 0);

  const precoFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(produto.preco || 0);

  const custoFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(produto.custo || 0);

  // 📦 Configurações de status do estoque (CORRIGIDO - usando classes CSS diretas)
  const getStockConfig = () => {
    switch(stockStatus) {
      case 'esgotado':
        return {
          icon: <IoCloseCircle className="text-red-600" />,
          label: 'Esgotado',
          styles: 'bg-red-50 border-red-200 text-red-800'
        };
      case 'critico':
        return {
          icon: <IoAlertCircle className="text-red-600" />,
          label: 'Estoque Crítico',
          styles: 'bg-red-50 border-red-200 text-red-800'
        };
      case 'baixo':
        return {
          icon: <IoAlertCircle className="text-orange-600" />,
          label: 'Estoque Baixo',
          styles: 'bg-orange-50 border-orange-200 text-orange-800'
        };
      case 'normal':
      default:
        return {
          icon: <IoCheckmarkCircle className="text-green-600" />,
          label: 'Estoque OK',
          styles: 'bg-green-50 border-green-200 text-green-800'
        };
    }
  };

  const stockConfig = getStockConfig();

  // 📦 Funções de estoque
  const handleSaveStock = (e) => {
    e.stopPropagation();
    if (onUpdateStock && newStockValue !== produto.estoque) {
      onUpdateStock(produto.id, newStockValue);
    }
    setEditingStock(false);
  };

  const handleCancelEdit = (e) => {
    e.stopPropagation();
    setNewStockValue(produto.estoque || 0);
    setEditingStock(false);
  };

  const handleStartEdit = (e) => {
    e.stopPropagation();
    setNewStockValue(produto.estoque || 0);
    setEditingStock(true);
  };

  // Determinar estilo da borda baseado no status
  const getBorderStyle = () => {
    switch(stockStatus) {
      case 'critico':
      case 'esgotado':
        return 'border-red-200 hover:border-red-300';
      case 'baixo':
        return 'border-orange-200 hover:border-orange-300';
      default:
        return 'border-gray-200 hover:border-gray-300';
    }
  };

  return (
    <div 
      onClick={onEdit}
      className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all duration-300 hover:shadow-md cursor-pointer p-4 ${getBorderStyle()}`}
    >
      <div className="flex items-start gap-4">
        {/* Imagem do Produto */}
        <img
          className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
          src={produto.imageUrl || '/api/placeholder/80/80'}
          alt={produto.nome}
        />

        {/* Conteúdo Principal */}
        <div className="flex-1 min-w-0">
          {/* Cabeçalho com Nome e Status */}
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-gray-900 truncate">{produto.nome}</h3>
              <p className="text-gray-500 text-sm mt-1">{produto.categoria}</p>
            </div>
            
            {/* Status do Estoque */}
            <div 
              className={`flex items-center space-x-2 px-3 py-1 rounded-full border text-sm font-medium ml-3 flex-shrink-0 ${stockConfig.styles}`}
              onClick={(e) => e.stopPropagation()}
            >
              {stockConfig.icon}
              <span>{stockConfig.label}</span>
            </div>
          </div>

          {/* Grid de Informações */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            {/* Preço de Venda */}
            <div className="flex items-center space-x-2">
              <IoPricetag className="text-green-600 flex-shrink-0" />
              <span className="font-semibold text-gray-900">{precoFormatado}</span>
            </div>

            {/* Estoque Atual */}
            <div className="flex items-center space-x-2">
              <IoCube className="text-blue-600 flex-shrink-0" />
              {editingStock ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={newStockValue}
                    onChange={(e) => setNewStockValue(parseInt(e.target.value) || 0)}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                    min="0"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveStock(e);
                      if (e.key === 'Escape') handleCancelEdit(e);
                    }}
                  />
                  <button
                    onClick={handleSaveStock}
                    className="text-green-600 hover:text-green-800 text-sm p-1"
                  >
                    ✓
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="text-red-600 hover:text-red-800 text-sm p-1"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div 
                  className="flex items-center space-x-2 group"
                  onDoubleClick={handleStartEdit}
                >
                  <span className="font-semibold text-gray-900">
                    {produto.estoque || 0} un
                  </span>
                  <button
                    onClick={handleStartEdit}
                    className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-800 transition-opacity p-1"
                    title="Clique para editar estoque"
                  >
                    <IoPencil size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Custo */}
            {produto.custo && produto.custo > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-gray-600">Custo:</span>
                <span className="font-medium text-gray-900">{custoFormatado}</span>
              </div>
            )}

            {/* Margem */}
            {profitMargin !== undefined && (
              <div className="flex items-center space-x-2">
                <span className="text-gray-600">Margem:</span>
                <span className={`font-bold ${
                  profitMargin > 50 
                    ? 'text-green-600' 
                    : profitMargin > 30 
                    ? 'text-yellow-600' 
                    : 'text-red-600'
                }`}>
                  {profitMargin.toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {/* Alerta de Estoque Mínimo */}
          {(stockStatus === 'critico' || stockStatus === 'baixo') && produto.estoqueMinimo && (
            <div className={`mt-3 px-3 py-2 rounded-lg text-sm ${stockConfig.styles}`}>
              <p className="font-medium">
                ⚠️ Estoque mínimo: {produto.estoqueMinimo} unidades
                {stockStatus === 'critico' && ' - REPOR URGENTE!'}
              </p>
            </div>
          )}
        </div>

        {/* Ações Laterais */}
        <div className="flex flex-col items-center gap-3 flex-shrink-0 ml-2">
          {/* Status Ativo/Inativo */}
          <span 
            className={`px-3 py-1 text-xs font-semibold rounded-full ${
              produto.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {produto.ativo ? 'Ativo' : 'Inativo'}
          </span>

          {/* Botões de Ação */}
          <div className="flex flex-col gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); onToggleStatus(); }} 
              className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-full transition-colors"
              title={produto.ativo ? 'Desativar' : 'Ativar'}
            >
              <IoPower size={18} />
            </button>

            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(); }} 
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title="Excluir item"
            >
              <IoTrash size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}