// src/components/EstabelecimentoCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';

function EstabelecimentoCard({ estabelecimento }) {
  if (!estabelecimento || !estabelecimento.slug) { 
    console.warn("EstabelecimentoCard: Estabelecimento ou slug não encontrado.", estabelecimento);
    return null;
  }

  const defaultImageUrl = '/images/placeholder-restaurant.jpg'; 

  return (
    // CORREÇÃO AQUI: USANDO '/cardapio/' (ou '/cardapios/', dependendo da sua rota em App.jsx)
    <Link 
      to={`/cardapio/${estabelecimento.slug}`} // <-- MUDANÇA AQUI: de /loja/ para /cardapio/
      className="bg-white rounded-lg shadow-md hover:shadow-xl transition duration-300 transform hover:scale-105 flex flex-col overflow-hidden border border-gray-100"
    >
      <div className="flex-col sm:flex-row h-40 overflow-hidden">
        <img 
          src={estabelecimento.imageUrl || defaultImageUrl} 
          alt={`Logo de ${estabelecimento.nome}`} 
          className="flex-col sm:flex-row h-full object-cover"
        />
      </div>
      <div className="p-4 flex-grow flex flex-col justify-between">
        <h3 className="text-xl font-bold text-[var(--marrom-escuro)] mb-2">{estabelecimento.nome}</h3>
        <p className="text-[var(--cinza-texto)] text-sm mb-3 line-clamp-2">
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