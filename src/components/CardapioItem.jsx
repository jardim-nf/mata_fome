// src/components/CardapioItem.jsx
import React from "react";

function CardapioItem({ item, cartItem, addToCart, removeFromCart }) {
  const quantity = cartItem ? cartItem.qtd : 0;

  return (
    <div className="border border-gray-200 rounded-lg p-4 sm:p-5 shadow-lg bg-white flex flex-col justify-between transform transition duration-300 hover:scale-105 hover:shadow-xl"> {/* Ajuste de padding, sombra e hover */}
      <div>
        {item.imageUrl && (
          <img 
            src={item.imageUrl} 
            alt={item.nome} 
            className="w-full h-36 sm:h-40 object-cover mb-3 sm:mb-4 rounded-md shadow-sm" // Ajuste de altura e margem
          />
        )}
        
        <h3 className="font-bold text-lg sm:text-xl text-[var(--marrom-escuro)] mb-1">{item.nome}</h3> {/* Ajuste de tamanho de fonte */}
        <p className="text-[var(--cinza-texto)] text-xs sm:text-sm mb-2 sm:mb-3 leading-tight">{item.descricao}</p> {/* Ajuste de tamanho, margem e espaçamento da linha */}
        <p className="text-[var(--vermelho-principal)] font-extrabold text-xl sm:text-2xl text-right mt-auto">R$ {item.preco.toFixed(2)}</p> {/* Ajuste de tamanho, peso da fonte e margem superior */}
      </div>
      <div className="mt-4 flex justify-center items-center gap-3">
        {quantity > 0 ? (
          <>
            <button
              onClick={() => removeFromCart(item.id)}
              className="bg-red-500 hover:bg-red-600 text-white w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-lg font-bold transition duration-200" // Ajuste de tamanho
              aria-label={`Remover um ${item.nome}`}
            >
              -
            </button>
            <span className="font-bold text-lg sm:text-xl text-[var(--marrom-escuro)]">{quantity}</span> {/* Ajuste de tamanho */}
            <button
              onClick={() => addToCart(item)}
              className="bg-[var(--verde-destaque)] hover:bg-green-600 text-white w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-lg font-bold transition duration-200" // Ajuste de tamanho
              aria-label={`Adicionar mais um ${item.nome}`}
            >
              +
            </button>
          </>
        ) : (
          <button
            onClick={() => addToCart(item)}
            className="bg-[var(--verde-destaque)] hover:bg-green-600 text-white px-4 sm:px-5 py-2 rounded-lg font-semibold transition duration-300 ease-in-out w-full shadow-md text-base" // Ajuste de padding e tamanho de fonte
          >
            + Adicionar
          </button>
        )}
      </div>
    </div>
  );
}

export default CardapioItem;