// src/components/CardapioItem.jsx

import React, { useState, useEffect } from 'react';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

function CardapioItem({ item, onAddItem }) {
  const placeholderImage = "https://via.placeholder.com/300x200.png?text=Sem+Foto";
  
  const [displayImageUrl, setDisplayImageUrl] = useState(placeholderImage);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const fetchImageUrl = async () => {
      if (item.imageUrl) {
        if (item.imageUrl.startsWith('http')) {
          setDisplayImageUrl(item.imageUrl);
        } else {
          try {
            const imageRef = ref(storage, item.imageUrl);
            const downloadUrl = await getDownloadURL(imageRef);
            setDisplayImageUrl(downloadUrl);
          } catch (error) {
            console.error(`Erro ao buscar imagem para o item "${item.nome}":`, error);
            setDisplayImageUrl(placeholderImage);
            setImageError(true);
          }
        }
      } else {
        setDisplayImageUrl(placeholderImage);
        setImageError(true);
      }
      setImageLoading(false);
    };

    fetchImageUrl();
  }, [item.imageUrl, item.nome]);

  const isAvailable = item.ativo !== false && item.disponivel !== false;
  const hasExtras = item.adicionais && item.adicionais.length > 0;

  const handleAddItemClick = () => {
    if (isAvailable) {
      onAddItem(item);
    }
  };

  const buttonText = hasExtras ? 'Personalizar' : 'Adicionar';

  return (
    <div
      className={`group relative bg-white rounded-xl shadow-md flex flex-col transition-all duration-300 hover:shadow-lg hover:-translate-y-1 overflow-hidden border border-gray-200 ${
        !isAvailable ? 'opacity-60 grayscale' : ''
      }`}
    >
      {/* Badges */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        {!isAvailable && (
          <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow">
            INDISPONÍVEL
          </span>
        )}
        {hasExtras && isAvailable && (
          <span className="bg-yellow-500 text-black px-2 py-1 rounded-full text-xs font-bold shadow">
            PERSONALIZÁVEL
          </span>
        )}
        {item.destaque && isAvailable && (
          <span className="bg-yellow-400 text-black px-2 py-1 rounded-full text-xs font-bold shadow">
            DESTAQUE
          </span>
        )}
      </div>

      {/* Image Container */}
      <div className="relative w-full h-32 bg-gray-100 overflow-hidden">
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse">
            <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent z-5" />
        
        <img
          src={displayImageUrl}
          alt={item.nome}
          className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
            imageLoading ? 'opacity-0' : 'opacity-100'
          } ${imageError ? 'filter grayscale' : ''}`}
          onError={(e) => { 
            e.target.onerror = null; 
            e.target.src = placeholderImage;
            setImageError(true);
          }}
          onLoad={() => setImageLoading(false)}
        />
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col flex-grow">
        {/* Header */}
        <div className="mb-2">
          <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-tight group-hover:text-yellow-600 transition-colors duration-300">
            {item.nome}
          </h3>
          
          {item.categoria && (
            <p className="text-yellow-600 text-xs mt-1">
              {item.categoria}
            </p>
          )}
        </div>

        {/* Description */}
        <p className="text-gray-600 text-xs mb-3 flex-grow leading-relaxed line-clamp-2">
          {item.descricao || 'Descrição em breve...'}
        </p>

        {/* Price and Button */}
        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
          <div className="flex flex-col">
            {hasExtras && (
              <span className="text-xs text-gray-500 -mb-1">A partir de</span>
            )}
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black text-yellow-600">
                R$ {(item.preco || 0).toFixed(2).replace('.', ',')}
              </span>
              {item.precoOriginal && item.precoOriginal > item.preco && (
                <span className="text-xs text-gray-400 line-through">
                  R$ {item.precoOriginal.toFixed(2).replace('.', ',')}
                </span>
              )}
            </div>
          </div>
          
          <button
            onClick={handleAddItemClick}
            disabled={!isAvailable}
            className={`
              relative flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-semibold transition-all duration-200 
              focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:ring-offset-1
              min-w-[90px] text-xs
              ${
                !isAvailable
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : hasExtras
                  ? 'bg-yellow-500 text-black hover:bg-yellow-600 active:scale-95'
                  : 'bg-yellow-500 text-black hover:bg-yellow-600 active:scale-95'
              }
            `}
          >
            {!isAvailable ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>Indisponível</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3z" />
                  <path d="M16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                </svg>
                <span>{buttonText}</span>
              </>
            )}
          </button>
        </div>

        {/* Extras indicator */}
        {hasExtras && isAvailable && (
          <div className="mt-2 flex items-center justify-center">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              {item.adicionais.length} opção(ões)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default CardapioItem;