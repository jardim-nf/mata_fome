// src/components/EstabelecimentoCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';

function EstabelecimentoCard({ estabelecimento }) {
  // Garantir que o estabelecimento e o ID existem
  if (!estabelecimento || !estabelecimento.id) {
    return null; // Ou um placeholder, se preferir
  }

  // Define um caminho de imagem padrão caso não haja imageUrl no Firestore
  const defaultImageUrl = '/images/placeholder-restaurant.jpg'; 

  return (
    <Link 
      to={`/cardapio/${estabelecimento.id}`} // Ao clicar, vai para o cardápio específico
      className="bg-white rounded-lg shadow-md hover:shadow-xl transition duration-300 transform hover:scale-105 flex flex-col overflow-hidden border border-gray-100"
    >
      <div className="w-full h-40 overflow-hidden">
        <img 
          src={estabelecimento.imageUrl || defaultImageUrl} 
          alt={`Logo de ${estabelecimento.nome}`} 
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-4 flex-grow flex flex-col justify-between">
        <h3 className="text-xl font-bold text-[var(--marrom-escuro)] mb-2">{estabelecimento.nome}</h3>
        <p className="text-[var(--cinza-texto)] text-sm mb-3 line-clamp-2"> {/* line-clamp para limitar a 2 linhas */}
          {estabelecimento.descricao || "Sem descrição."}
        </p>
        <p className="text-sm text-gray-500 mt-auto">
          {estabelecimento.tipo && <span className="capitalize">Tipo: {estabelecimento.tipo}</span>}
          {estabelecimento.valor && <span className="ml-2"> | {estabelecimento.valor}</span>}
        </p>
      </div>
    </Link>
  );
}

export default EstabelecimentoCard;