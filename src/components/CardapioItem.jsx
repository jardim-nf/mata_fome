// src/components/CardapioItem.jsx

import React, { useState, useEffect } from 'react';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

function CardapioItem({ item, onAddItem }) {
  // 🛡️ VERIFICAÇÃO CRÍTICA - se item for undefined ou null
  if (!item) {
    console.warn('CardapioItem recebeu item undefined/null');
    return (
      <div className="group relative bg-white rounded-2xl shadow-lg flex flex-col transition-all duration-300 overflow-hidden border border-amber-200 opacity-60">
        <div className="relative w-full h-40 bg-gray-200 overflow-hidden flex items-center justify-center">
          <div className="text-gray-500 text-sm">Item não disponível</div>
        </div>
        <div className="p-4 flex flex-col flex-grow">
          <div className="mb-3">
            <h3 className="text-lg font-bold text-gray-400">Item indisponível</h3>
          </div>
          <div className="flex justify-between items-center pt-3 border-t border-gray-100 mt-auto">
            <span className="text-gray-400">-</span>
            <button
              disabled
              className="bg-gray-300 text-gray-500 px-4 py-3 rounded-xl font-bold min-w-[110px] text-sm cursor-not-allowed"
            >
              Indisponível
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 🛡️ VALORES PADRÃO SEGUROS para todas as propriedades
  const safeItem = {
    nome: item.nome || 'Item sem nome',
    descricao: item.descricao || '',
    preco: typeof item.preco === 'number' ? item.preco : 0,
    precoOriginal: typeof item.precoOriginal === 'number' ? item.precoOriginal : null,
    imageUrl: item.imageUrl || null,
    categoria: item.categoria || '',
    ativo: item.ativo !== false,
    disponivel: item.disponivel !== false,
    destaque: item.destaque || false,
    adicionais: Array.isArray(item.adicionais) ? item.adicionais : [],
    variacoes: Array.isArray(item.variacoes) ? item.variacoes : []
  };

  const placeholderImage = "https://via.placeholder.com/300x200.png?text=Sem+Foto";
  
  const [displayImageUrl, setDisplayImageUrl] = useState(placeholderImage);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const fetchImageUrl = async () => {
      // 🛡️ VERIFICAÇÃO SEGURA para imageUrl
      if (safeItem.imageUrl) {
        if (safeItem.imageUrl.startsWith('http')) {
          setDisplayImageUrl(safeItem.imageUrl);
        } else {
          try {
            const imageRef = ref(storage, safeItem.imageUrl);
            const downloadUrl = await getDownloadURL(imageRef);
            setDisplayImageUrl(downloadUrl);
          } catch (error) {
            console.error(`Erro ao buscar imagem para o item "${safeItem.nome}":`, error);
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
  }, [safeItem.imageUrl, safeItem.nome]);

  // 🛡️ PROPRIEDADES COMPUTADAS SEGURAS
  const isAvailable = safeItem.ativo && safeItem.disponivel;
  const hasExtras = safeItem.adicionais.length > 0;
  const hasVariations = safeItem.variacoes.length > 0;
  const isPremium = safeItem.preco > 25;

  const handleAddItemClick = () => {
    if (isAvailable && onAddItem) {
      onAddItem(safeItem);
    }
  };

  const buttonText = hasExtras || hasVariations ? 'Personalizar' : 'Adicionar';

  return (
    <div
      className={`group relative bg-white rounded-2xl shadow-lg flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden border border-amber-200 ${
        !isAvailable ? 'opacity-60 grayscale' : ''
      }`}
    >
      {/* Badges */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        {!isAvailable && (
          <span className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
            INDISPONÍVEL
          </span>
        )}
        {(hasExtras || hasVariations) && isAvailable && (
          <span className="bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
            PERSONALIZÁVEL
          </span>
        )}
        {safeItem.destaque && isAvailable && (
          <span className="bg-yellow-400 text-black px-3 py-1 rounded-full text-xs font-bold shadow-lg">
            ⭐ DESTAQUE
          </span>
        )}
        {isPremium && isAvailable && (
          <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
            💎 PREMIUM
          </span>
        )}
      </div>

      {/* Image Container */}
      <div className="relative w-full h-40 bg-amber-100 overflow-hidden">
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-amber-100 animate-pulse">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent z-5" />
        
        <img
          src={displayImageUrl}
          alt={safeItem.nome}
          className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${
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
      <div className="p-4 flex flex-col flex-grow">
        {/* Header */}
        <div className="mb-3">
          <div className="flex justify-between items-start gap-2">
            <h3 className="text-lg font-bold text-amber-900 line-clamp-2 leading-tight group-hover:text-amber-700 transition-colors duration-300 flex-1">
              {safeItem.nome}
            </h3>
            <div className="flex flex-col items-end flex-shrink-0">
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-amber-600">
                  R$ {safeItem.preco.toFixed(2).replace('.', ',')}
                </span>
                {safeItem.precoOriginal && safeItem.precoOriginal > safeItem.preco && (
                  <span className="text-sm text-gray-400 line-through">
                    R$ {safeItem.precoOriginal.toFixed(2).replace('.', ',')}
                  </span>
                )}
              </div>
              {hasVariations && (
                <span className="text-xs text-amber-500 font-semibold mt-1">
                  {safeItem.variacoes.length} opções
                </span>
              )}
            </div>
          </div>
          
          {safeItem.categoria && (
            <p className="text-amber-500 text-sm mt-1 font-medium">
              {safeItem.categoria}
            </p>
          )}
        </div>

        {/* Description */}
        {safeItem.descricao && (
          <div className="mb-4 flex-grow">
            <p className="text-amber-700 text-sm leading-relaxed line-clamp-3">
              {safeItem.descricao}
            </p>
            {/* Explicação do preço para itens premium */}
            {isPremium && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-green-500 text-xs">💎</span>
                <span className="text-green-600 text-xs font-semibold">
                  Ingredientes especiais | Porção generosa
                </span>
              </div>
            )}
            {/* Dica de personalização */}
            {(hasExtras || hasVariations) && isAvailable && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-amber-500 text-xs">✨</span>
                <span className="text-amber-600 text-xs">
                  Clique em "Personalizar" para ver opções
                </span>
              </div>
            )}
          </div>
        )}

        {/* Price and Button */}
        <div className="flex justify-between items-center pt-3 border-t border-amber-100 mt-auto">
          <div className="flex flex-col">
            {(hasExtras || hasVariations) && (
              <span className="text-xs text-amber-600 -mb-1 font-medium">A partir de</span>
            )}
            {isPremium && (
              <span className="text-xs text-green-600 font-semibold">Produto Premium</span>
            )}
          </div>
          
          <button
            onClick={handleAddItemClick}
            disabled={!isAvailable}
            className={`
              relative flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all duration-200 
              focus:outline-none focus:ring-3 focus:ring-amber-500/50 focus:ring-offset-2
              min-w-[110px] text-sm shadow-lg
              ${
                !isAvailable
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                  : (hasExtras || hasVariations)
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 active:scale-95 shadow-amber-200'
                  : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 active:scale-95 shadow-green-200'
              }
            `}
          >
            {!isAvailable ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>Indisponível</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3z" />
                  <path d="M16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                </svg>
                <span>{buttonText}</span>
                {(hasExtras || hasVariations) && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                )}
              </>
            )}
          </button>
        </div>

        {/* Extras indicator */}
        {(hasExtras || hasVariations) && isAvailable && (
          <div className="mt-3 flex items-center justify-center bg-amber-50 rounded-lg py-2">
            <span className="text-xs text-amber-700 flex items-center gap-2 font-semibold">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              {hasExtras && `${safeItem.adicionais.length} adicional(is)`}
              {hasExtras && hasVariations && ' • '}
              {hasVariations && `${safeItem.variacoes.length} variação(ões)`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default CardapioItem;