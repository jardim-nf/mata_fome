// src/components/CardapioItem.jsx

import React, { useState, useEffect } from 'react';
import { ref, getDownloadURL } from 'firebase/storage';
// ❗ IMPORTANTE: Verifique se o caminho para seu arquivo de configuração do Firebase está correto.
import { storage } from '../firebase'; 

function CardapioItem({ item, onAddItem }) {
  const placeholderImage = "https://via.placeholder.com/400x300.png?text=Sem+Foto";
  
  // Estado local para a URL da imagem e para o controle de carregamento
  const [displayImageUrl, setDisplayImageUrl] = useState(placeholderImage);
  const [imageLoading, setImageLoading] = useState(true);

  // Efeito que busca a URL da imagem
  useEffect(() => {
    // Função assíncrona para buscar os dados
    const fetchImageUrl = async () => {
      // Verifica se o item tem a propriedade imageUrl e se ela não está vazia
      if (item.imageUrl) {
        // Se já for uma URL completa (começa com http), usa ela diretamente
        if (item.imageUrl.startsWith('http')) {
          setDisplayImageUrl(item.imageUrl);
        } else {
          // Se for um caminho, busca a URL de download no Firebase Storage
          try {
            const imageRef = ref(storage, item.imageUrl);
            const downloadUrl = await getDownloadURL(imageRef);
            setDisplayImageUrl(downloadUrl);
          } catch (error) {
            console.error(`Erro ao buscar imagem para o item "${item.nome}":`, error);
            setDisplayImageUrl(placeholderImage); // Usa imagem placeholder em caso de erro
          }
        }
      } else {
        // Se o item não tem a propriedade imageUrl, usa a imagem placeholder
        setDisplayImageUrl(placeholderImage);
      }
      setImageLoading(false);
    };

    fetchImageUrl();
  }, [item.imageUrl, item.nome]); // Roda o efeito se a referência da imagem ou o nome do item mudar

  const isAvailable = item.ativo !== false && item.disponivel !== false;

  const handleAddItemClick = () => {
    if (isAvailable) {
      onAddItem(item);
    }
  };

  const buttonText = (item.adicionais && item.adicionais.length > 0)
    ? 'Selecionar Opções'
    : 'Adicionar';

  return (
    <div
      className={`bg-gray-800 rounded-2xl shadow-lg flex flex-col transition-all duration-300 hover:shadow-yellow-400/20 hover:-translate-y-1 overflow-hidden border border-gray-700 ${!isAvailable ? 'opacity-50' : ''}`}
    >
      <div className="relative w-full h-48 bg-gray-700"> {/* Fundo cinza enquanto a imagem carrega */}
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-700 animate-pulse" />
        )}
        <img
          src={displayImageUrl}
          alt={item.nome}
          className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
          onError={(e) => { e.target.onerror = null; e.target.src = placeholderImage; }}
          onLoad={() => setImageLoading(false)}
        />
      </div>

      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-lg font-extrabold text-yellow-400 line-clamp-2" title={item.nome}>
          {item.nome}
        </h3>
        
        <p className="text-gray-400 text-sm my-3 flex-grow line-clamp-3">
          {item.descricao || 'Sem descrição.'}
        </p>

        <div className="mt-auto pt-3 flex justify-between items-center">
          <div className="flex flex-col">
            {item.adicionais && item.adicionais.length > 0 && (
              <span className="text-xs text-gray-500 -mb-1">A partir de</span>
            )}
            <p className="text-xl font-bold text-white">
              R$ {(item.preco || 0).toFixed(2).replace('.', ',')}
            </p>
          </div>
          
          <button
            onClick={handleAddItemClick}
            disabled={!isAvailable}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-300 ${
              !isAvailable
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
            </svg>
            <span>{isAvailable ? buttonText : 'Indisponível'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default CardapioItem;