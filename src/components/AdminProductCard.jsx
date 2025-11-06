// src/components/AdminProductCard.jsx
import React, { useState } from 'react';
import { IoCube, IoPricetag, IoAlertCircle, IoCheckmarkCircle, IoCloseCircle } from 'react-icons/io5';

// O componente recebe todas as funções como props da página principal
export default function AdminProductCard({ 
  produto, 
  onEdit, 
  onDelete, 
  onToggleStatus,
  // 📦 NOVAS PROPS: Controle de estoque
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

  // 📦 FUNÇÃO: Determinar cor e ícone do status do estoque
  const getStockConfig = () => {
    switch(stockStatus) {
      case 'esgotado':
        return {
          color: 'red',
          bgColor: 'red-50',
          textColor: 'red-800',
          borderColor: 'red-200',
          icon: <IoCloseCircle className="text-red-600" />,
          label: 'Esgotado'
        };
      case 'critico':
        return {
          color: 'red',
          bgColor: 'red-50',
          textColor: 'red-800',
          borderColor: 'red-200',
          icon: <IoAlertCircle className="text-red-600" />,
          label: 'Estoque Crítico'
        };
      case 'baixo':
        return {
          color: 'orange',
          bgColor: 'orange-50',
          textColor: 'orange-800',
          borderColor: 'orange-200',
          icon: <IoAlertCircle className="text-orange-600" />,
          label: 'Estoque Baixo'
        };
      case 'normal':
      default:
        return {
          color: 'green',
          bgColor: 'green-50',
          textColor: 'green-800',
          borderColor: 'green-200',
          icon: <IoCheckmarkCircle className="text-green-600" />,
          label: 'Estoque OK'
        };
    }
  };

  const stockConfig = getStockConfig();

  // 📦 FUNÇÃO: Salvar estoque editado
  const handleSaveStock = (e) => {
    e.stopPropagation();
    if (onUpdateStock && newStockValue !== produto.estoque) {
      onUpdateStock(newStockValue);
    }
    setEditingStock(false);
  };

  // 📦 FUNÇÃO: Cancelar edição de estoque
  const handleCancelEdit = (e) => {
    e.stopPropagation();
    setNewStockValue(produto.estoque || 0);
    setEditingStock(false);
  };

  // 📦 FUNÇÃO: Iniciar edição de estoque
  const handleStartEdit = (e) => {
    e.stopPropagation();
    setNewStockValue(produto.estoque || 0);
    setEditingStock(true);
  };

  return (
    <div 
        onClick={onEdit} // Clicar no card inteiro abre o modal de edição
        className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all duration-300 hover:shadow-md hover:ring-2 hover:ring-primary flex items-center p-4 cursor-pointer ${
          stockStatus === 'critico' || stockStatus === 'esgotado' 
            ? 'border-red-200 hover:border-red-300' 
            : stockStatus === 'baixo'
            ? 'border-orange-200 hover:border-orange-300'
            : 'border-gray-200 hover:border-gray-300'
        }`}
    >
      {/* Imagem do Produto */}
      <img
        className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
        src={produto.imageUrl || 'https://via.placeholder.com/150'}
        alt={produto.nome}
      />

      <div className="flex-grow px-5">
        {/* Nome e Categoria */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-lg font-bold text-gray-900 truncate">{produto.nome}</h3>
            <p className="text-gray-500 text-sm">{produto.categoria}</p>
          </div>
          
          {/* 📦 Status do Estoque */}
          <div 
            className={`flex items-center space-x-1 px-3 py-1 rounded-full border bg-${stockConfig.bgColor} border-${stockConfig.borderColor}`}
            onClick={(e) => e.stopPropagation()}
          >
            {stockConfig.icon}
            <span className={`text-sm font-medium text-${stockConfig.textColor}`}>
              {stockConfig.label}
            </span>
          </div>
        </div>

        {/* 📦 Informações de Preço e Estoque */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {/* Preço de Venda */}
          <div className="flex items-center space-x-1">
            <IoPricetag className="text-green-600" />
            <span className="font-semibold text-gray-900">{precoFormatado}</span>
          </div>

          {/* 📦 Estoque Atual */}
          <div 
            className="flex items-center space-x-1"
            onClick={(e) => e.stopPropagation()}
          >
            <IoCube className="text-blue-600" />
            {editingStock ? (
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={newStockValue}
                  onChange={(e) => setNewStockValue(parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                  min="0"
                  autoFocus
                />
                <button
                  onClick={handleSaveStock}
                  className="text-green-600 hover:text-green-800 text-sm"
                >
                  ✓
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="text-red-600 hover:text-red-800 text-sm"
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
                  className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-800 text-xs transition-opacity"
                  title="Clique para editar estoque"
                >
                  ✎
                </button>
              </div>
            )}
          </div>

          {/* 📦 Custo e Margem */}
          {produto.custo && produto.custo > 0 && (
            <>
              <div className="flex items-center space-x-1">
                <span className="text-gray-600">Custo:</span>
                <span className="font-medium text-gray-900">{custoFormatado}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-gray-600">Margem:</span>
                <span className={`font-bold ${
                  profitMargin > 50 
                    ? 'text-green-600' 
                    : profitMargin > 30 
                    ? 'text-yellow-600' 
                    : 'text-red-600'
                }`}>
                  {profitMargin?.toFixed(1)}%
                </span>
              </div>
            </>
          )}
        </div>

        {/* 📦 Alerta de Estoque Mínimo */}
        {(stockStatus === 'critico' || stockStatus === 'baixo') && produto.estoqueMinimo && (
          <div className={`mt-2 px-3 py-1 rounded-lg bg-${stockConfig.bgColor} border border-${stockConfig.borderColor}`}>
            <p className={`text-xs text-${stockConfig.textColor} font-medium`}>
              ⚠️ Estoque mínimo: {produto.estoqueMinimo} unidades
              {stockStatus === 'critico' && ' - REPOR URGENTE!'}
            </p>
          </div>
        )}
      </div>
      
      {/* Ações do Produto */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Status Ativo/Inativo */}
        <span 
          className={`px-3 py-1 text-xs font-semibold rounded-full ${
            produto.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {produto.ativo ? 'Ativo' : 'Inativo'}
        </span>

        {/* Botão Toggle Status */}
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleStatus(); }} 
          className="p-2 text-gray-400 hover:text-secondary hover:bg-gray-200 rounded-full transition-colors"
          title={produto.ativo ? 'Desativar' : 'Ativar'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-10.293a1 1 0 00-1.414-1.414L9 9.586 7.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Botão Excluir */}
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(); }} 
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors"
          title="Excluir item"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}