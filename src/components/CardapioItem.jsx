// src/components/CardapioItem.jsx
import React, { useState, useEffect } from 'react';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase'; // Importe a instância do Storage

function CardapioItem({ item, onAddItem }) {
  // NOVO ESTADO PARA GUARDAR O LINK PÚBLICO DA IMAGEM
  const [publicImageUrl, setPublicImageUrl] = useState('');
  const [isLoadingImage, setIsLoadingImage] = useState(true);

  const placeholderImage = "https://via.placeholder.com/400x300.png?text=Sem+Foto";

  // NOVA LÓGICA PARA BUSCAR O LINK PÚBLICO DA IMAGEM
  useEffect(() => {
    // Se o item tem um imageUrl (que é o caminho no Storage)
    if (item.imageUrl) {
      setIsLoadingImage(true);
      const imageRef = ref(storage, item.imageUrl); // Cria a referência para o arquivo

      getDownloadURL(imageRef)
        .then((url) => {
          // Se encontrou o link, guarda no nosso estado
          setPublicImageUrl(url);
        })
        .catch((error) => {
          // Se deu erro, mostra a imagem de recurso
          console.error("Erro ao buscar imagem:", item.nome, error);
          setPublicImageUrl(placeholderImage);
        })
        .finally(() => {
          setIsLoadingImage(false);
        });
    } else {
      // Se o produto não tem um caminho de imagem, usa a imagem de recurso
      setPublicImageUrl(placeholderImage);
      setIsLoadingImage(false);
    }
  }, [item.imageUrl]); // Este código executa sempre que a imagem do item mudar

  const handleAddItemClick = () => {
    if (item.ativo) {
      onAddItem(item);
    }
  };

  const buttonText = item.adicionais && item.adicionais.length > 0
    ? 'Selecionar Opções'
    : 'Adicionar';

  return (
    // O restante do seu componente continua igual, apenas mudamos o 'src' da tag <img>
    <div
      className={`bg-cinza-card rounded-2xl shadow-lg flex flex-col transition-all duration-300 hover:shadow-yellow-400/20 hover:-translate-y-1 overflow-hidden border border-gray-800 ${!item.ativo ? 'opacity-50' : ''}`}
    >
      <div className="relative">
        {/* Usamos o novo estado 'publicImageUrl' para a imagem */}
        <img
          src={publicImageUrl || placeholderImage}
          alt={item.nome}
          className="w-full h-48 object-cover"
        />
        {/* Efeito de loading enquanto a imagem carrega */}
        {isLoadingImage && <div className="absolute inset-0 bg-cinza-card animate-pulse"></div>}
      </div>

      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-lg font-extrabold text-amarelo-principal line-clamp-2" title={item.nome}>
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
            {/* ALTERAÇÃO 1: Cor do preço alterada de text-white para text-black */}
            <p className="text-xl font-bold text-black">
              R$ {(item.preco || 0).toFixed(2).replace('.', ',')}
            </p>
          </div>

          {/* ALTERAÇÃO 2: Cor do botão alterada de amarelo para verde */}
          <button
            onClick={handleAddItemClick}
            disabled={!item.ativo}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-300 ${
              !item.ativo
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
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