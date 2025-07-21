import React from 'react';

function CardapioItem({ item, onAddItem }) {

  const handleAddItemClick = () => {
    if (item.ativo) {
      onAddItem(item);
    }
  };

  const buttonText = item.adicionais && item.adicionais.length > 0
    ? 'Selecionar Opções'
    : 'Adicionar'; // Texto do botão simplificado

  const placeholderImage = "https://via.placeholder.com/400x300.png?text=Sem+Foto";

  return (
    // Card principal com sombra mais sutil e transição suave
    <div
      className={`bg-white rounded-2xl shadow-lg flex flex-col transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 overflow-hidden ${!item.ativo ? 'opacity-60' : ''}`}
    >
      {/* Container da imagem para efeitos visuais */}
      <div className="relative">
        <img
          src={item.imageUrl || placeholderImage}
          alt={item.nome}
          className="w-full h-48 object-cover"
        />
        {/* Anel visual na imagem para dar um toque de cor */}
        <div className="absolute inset-0 ring-4 ring-[var(--vermelho-principal)] ring-opacity-20 rounded-t-2xl"></div>
      </div>

      {/* Conteúdo de texto do card */}
      <div className="p-4 flex flex-col flex-grow">
        {/* Título com clamp para evitar quebra de layout com nomes longos */}
        <h3 className="text-lg font-extrabold text-[var(--marrom-escuro)] line-clamp-2" title={item.nome}>
          {item.nome}
        </h3>
        
        {/* Descrição mais sutil e com espaço para crescer */}
        <p className="text-gray-500 text-sm my-3 flex-grow line-clamp-3">
          {item.descricao || 'Sem descrição.'}
        </p>

        {/* Nova seção para Preço e Botão lado a lado */}
        <div className="mt-auto pt-3 flex justify-between items-center">
          
          {/* Preço com mais destaque */}
          <div className="flex flex-col">
            {item.adicionais && item.adicionais.length > 0 && (
              <span className="text-xs text-gray-400 -mb-1">A partir de</span>
            )}
            <p className="text-xl font-bold text-[var(--marrom-escuro)]">
              R$ {(item.preco || 0).toFixed(2).replace('.', ',')}
            </p>
          </div>

          {/* Botão de Ação com Ícone */}
          <button
            onClick={handleAddItemClick}
            disabled={!item.ativo}
            className={`bg-green-400 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-black transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow ${
              !item.ativo
                ? 'bg-black cursor-not-allowed'
                : 'bg-green-400 hover:bg-green-700'
            }`}
          >
            {/* Ícone de carrinho de compras (SVG) */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
            </svg>
            <span>{item.ativo ? buttonText : 'Indisponível'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default CardapioItem;