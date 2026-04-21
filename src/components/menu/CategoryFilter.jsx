import React, { useState, useEffect, useCallback, memo } from 'react';

// 🚀 React.memo — Só re-renderiza se as props realmente mudarem
const CategoryFilter = memo(function CategoryFilter({ searchTerm, onSearchChange, categorias, selectedCategory, onCategoryClick, coresEstabelecimento }) {
  // 🚀 Debounce de 300ms na busca — evita jank em celulares lentos com cardápios grandes
  const [localSearch, setLocalSearch] = useState(searchTerm);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  // Sincroniza quando o pai limpa a busca
  useEffect(() => {
    if (searchTerm === '' && localSearch !== '') setLocalSearch('');
  }, [searchTerm]);

  return (
    <div className="bg-white p-4 mb-8 sticky top-0 z-40 shadow-sm md:rounded-lg">
      <input
        type="text"
        placeholder="🔍 Buscar..."
        value={localSearch}
        onChange={e => setLocalSearch(e.target.value)}
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
});

export default CategoryFilter;