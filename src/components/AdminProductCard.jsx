// src/components/AdminProductCard.jsx
import React from 'react';

// O componente recebe todas as funções como props da página principal
export default function AdminProductCard({ produto, onEdit, onDelete, onToggleStatus }) {

  const precoFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(produto.preco || 0);

  return (
    <div 
        onClick={onEdit} // Clicar no card inteiro abre o modal de edição
        className="bg-accent rounded-xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md hover:ring-2 hover:ring-primary flex items-center p-4 cursor-pointer"
    >
      <img
        className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
        src={produto.imageUrl || 'https://via.placeholder.com/150'}
        alt={produto.nome}
      />

      <div className="flex-grow px-5">
        <h3 className="text-lg font-bold text-secondary truncate">{produto.nome}</h3>
        <p className="text-gray-500 text-sm mt-1">{precoFormatado}</p>
      </div>
      
      <div className="flex items-center gap-4">
        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
            produto.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
            {produto.ativo ? 'Ativo' : 'Inativo'}
        </span>
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleStatus(); }} 
          className="p-2 text-gray-400 hover:text-secondary hover:bg-gray-200 rounded-full transition-colors"
          title={produto.ativo ? 'Desativar' : 'Ativar'}
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-10.293a1 1 0 00-1.414-1.414L9 9.586 7.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(); }} 
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors"
          title="Excluir item"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>
        </button>
      </div>
    </div>
  );
}