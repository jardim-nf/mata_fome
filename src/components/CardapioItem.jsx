import React from "react";

function CardapioItem({ item, cartItem, addToCart, removeFromCart }) {
  const quantity = cartItem ? cartItem.qtd : 0;

  return (
    <div className="border border-gray-200 rounded-lg p-3 sm:p-4 shadow-lg bg-white flex flex-col justify-between transform transition duration-300 hover:scale-105 hover:shadow-xl"> {/* Ajuste: p-3 (default) e sm:p-4 */}
      <div>
        {item.imageUrl && (
          <img 
            src={item.imageUrl} 
            alt={item.nome} 
            className="w-full h-32 sm:h-36 object-cover mb-3 rounded-md shadow-sm" // Ajuste: h-32 (default) e sm:h-36
          />
        )}
        
        <h3 className="font-bold text-base sm:text-lg text-[var(--marrom-escuro)] mb-1 leading-tight">{item.nome}</h3> {/* Ajuste: text-base (default) e sm:text-lg */}
        <p className="text-[var(--cinza-texto)] text-xs mb-2 leading-tight">{item.descricao}</p> {/* Mantido text-xs, removido sm:text-sm para ser mais compacto */}
        <p className="text-[var(--vermelho-principal)] font-extrabold text-lg sm:text-xl text-right mt-auto">R$ {item.preco.toFixed(2)}</p> {/* Ajuste: text-lg (default) e sm:text-xl */}
      </div>
      <div className="mt-4 flex justify-center items-center gap-3">
        {quantity > 0 ? (
          <>
            <button
              onClick={() => removeFromCart(item.id)}
              className="bg-red-500 hover:bg-red-600 text-white w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-base font-bold transition duration-200" // Ajuste: w-7 h-7 (default) e sm:w-8 sm:h-8
              aria-label={`Remover um ${item.nome}`}
            >
              -
            </button>
            <span className="font-bold text-base sm:text-lg text-[var(--marrom-escuro)]">{quantity}</span> {/* Ajuste: text-base (default) e sm:text-lg */}
            <button
              onClick={() => addToCart(item)}
              className="bg-green-500 hover:bg-green-800 text-white w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-base font-bold transition duration-200" // Ajuste: w-7 h-7 (default) e sm:w-8 sm:h-8
              aria-label={`Adicionar mais um ${item.nome}`}
            >
              +
            </button>
          </>
        ) : (
          <button
            onClick={() => addToCart(item)}
            className="bg-[var(--verde-destaque)] hover:bg-green-600  px-3 sm:px-4 py-1.5 rounded-lg font-semibold transition duration-300 ease-in-out w-full shadow-md text-base" // Ajuste: px-3 (default) e sm:px-4, py-1.5 (default) e py-2
          >
            + Adicionar
          </button>
        )}
      </div>
    </div>
  );
}

export default CardapioItem;