import React from 'react';

export default function CategoryFilter({ searchTerm, onSearchChange, categorias, selectedCategory, onCategoryClick, coresEstabelecimento }) {
  return (
    <div className="bg-white p-4 mb-8 sticky top-0 z-40 shadow-sm md:rounded-lg">
      <input
        type="text"
        placeholder="🔍 Buscar..."
        value={searchTerm}
        onChange={e => onSearchChange(e.target.value)}
        className="w-full p-3 mb-4 border rounded-lg text-gray-900 text-base"
      />
      <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
        {['Todos', ...categorias].map(cat => (
          <button
            key={cat}
            onClick={() => onCategoryClick(cat)}
            className={`px-4 py-2 rounded-full font-bold whitespace-nowrap transition-all ${selectedCategory === cat ? 'text-white' : 'bg-gray-100 text-gray-600'}`}
            style={{ backgroundColor: selectedCategory === cat ? coresEstabelecimento.destaque : undefined }}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}