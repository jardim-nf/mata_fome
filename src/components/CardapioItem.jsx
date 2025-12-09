import React, { useState, useEffect } from 'react';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
// eslint-disable-next-line no-unused-vars
import { toast } from 'react-toastify';
import { IoAdd, IoOptions } from 'react-icons/io5';

function CardapioItem({ item, onAddItem, onQuickAdd, coresEstabelecimento }) {
  // Cores padrão (Tema Claro)
  const cores = coresEstabelecimento || {
    primaria: '#DC2626',
    destaque: '#059669', 
    background: '#FFFFFF'
  };

  const [displayImageUrl, setDisplayImageUrl] = useState(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  if (!item) return null;

  const safeItem = {
    nome: item.nome || 'Item sem nome',
    descricao: item.descricao || '',
    preco: typeof item.preco === 'number' ? item.preco : 0,
    imageUrl: item.imageUrl || null,
    categoria: item.categoria || '',
    ativo: item.ativo !== false,
    disponivel: item.disponivel !== false,
    adicionais: Array.isArray(item.adicionais) ? item.adicionais : [],
    variacoes: Array.isArray(item.variacoes) ? item.variacoes : []
  };

  useEffect(() => {
    let isMounted = true;
    
    const loadImageSafely = async () => {
      if (!safeItem.imageUrl) {
        setImageLoading(false);
        setImageError(true);
        return;
      }

      try {
        setImageLoading(true);
        setImageError(false);
        
        let finalUrl = safeItem.imageUrl;
        
        if (!safeItem.imageUrl.startsWith('http')) {
          try {
            const imageRef = ref(storage, safeItem.imageUrl);
            finalUrl = await getDownloadURL(imageRef);
          } catch (storageError) {
            console.log('📦 Erro Firebase Storage, mantendo original');
          }
        }
        
        if (isMounted) setDisplayImageUrl(finalUrl);
        
      } catch (error) {
        if (isMounted) setImageError(true);
      } finally {
        if (isMounted) setImageLoading(false);
      }
    };

    loadImageSafely();

    return () => { isMounted = false; };
  }, [safeItem.imageUrl]);

  const handleImageError = () => { setImageError(true); setImageLoading(false); };
  const handleImageLoad = () => { setImageLoading(false); setImageError(false); };

  const isAvailable = safeItem.ativo && safeItem.disponivel;
  const hasVariations = safeItem.variacoes && safeItem.variacoes.length > 0;

  const podeAdicionarDireto = () => {
    if (!hasVariations) return true;
    const variacoesAtivas = safeItem.variacoes.filter(v => v.ativo);
    return variacoesAtivas.length === 1;
  };

  // Quando clica no botão, ele chama a função do Menu.js que faz a checagem de login
  const handleButtonClick = (e) => {
    e.stopPropagation(); 
    if (!isAvailable) return;
    
    if (podeAdicionarDireto()) {
        if (onQuickAdd) {
            let itemParaAdicionar = safeItem;
            const variacoesAtivas = safeItem.variacoes.filter(v => v.ativo);

            if (variacoesAtivas.length === 1) {
                const variacaoUnica = variacoesAtivas[0];
                itemParaAdicionar = {
                    ...safeItem,
                    variacaoSelecionada: { nome: variacaoUnica.nome, preco: Number(variacaoUnica.preco) },
                    precoFinal: Number(variacaoUnica.preco) 
                };
            }
            // AQUI CHAMA O MENU.JS (ONDE ESTÁ A CHECAGEM DE LOGIN)
            onQuickAdd(itemParaAdicionar);
        }
    } else {
      // AQUI CHAMA O MENU.JS (ONDE ESTÁ A CHECAGEM DE LOGIN)
      if (onAddItem) onAddItem(safeItem);
    }
  };

  const mostrarPreco = () => {
    const stylePreco = { color: cores.destaque, fontSize: '1.1rem', fontWeight: 'bold' };
    
    if (!hasVariations) {
      return <p style={stylePreco}>R$ {(Number(safeItem.preco) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>;
    }

    const variacoesAtivas = safeItem.variacoes.filter(v => v.ativo);
    if (variacoesAtivas.length === 0) return <p style={stylePreco}>R$ {(Number(safeItem.preco) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>;
    if (variacoesAtivas.length === 1) return <p style={stylePreco}>R$ {Number(variacoesAtivas[0].preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>;

    const menorPreco = Math.min(...variacoesAtivas.map(v => Number(v.preco)));
    return (
      <div className="flex flex-col items-end">
        <span className="text-[10px] text-gray-500 uppercase tracking-wide">A partir de</span>
        <p style={stylePreco}>R$ {menorPreco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
      </div>
    );
  };

  const getBotaoConfig = () => {
    if (!isAvailable) return { texto: 'Indisponível', cor: '#E5E7EB', textoCor: '#9CA3AF', disabled: true };
    if (podeAdicionarDireto()) return { texto: 'Adicionar', cor: cores.destaque, textoCor: '#FFF', disabled: false, icone: <IoAdd size={18} /> };
    return { texto: 'Detalhes', cor: cores.primaria, textoCor: '#FFF', disabled: false, icone: <IoOptions size={18} /> };
  };

  const botaoConfig = getBotaoConfig();

  const getPlaceholderEmoji = () => {
    const cat = safeItem.categoria?.toLowerCase() || '';
    if (cat.includes('burger')) return '🍔';
    if (cat.includes('pizza')) return '🍕';
    if (cat.includes('bebida')) return '🥤';
    if (cat.includes('sobremesa') || cat.includes('doce')) return '🍰';
    return '🍽️';
  };

  return (
    <div 
        className={`bg-white rounded-xl border border-gray-200 p-3 hover:border-gray-300 hover:shadow-md transition-all duration-300 group cursor-pointer relative overflow-hidden ${!isAvailable ? 'opacity-60 grayscale bg-gray-50' : ''}`}
    >
      <div className="flex gap-4">
        {/* 📸 IMAGEM */}
        <div className="flex-shrink-0">
          <div className="w-28 h-28 md:w-32 md:h-32 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center relative shadow-sm">
             {safeItem.promo && <div className="absolute top-0 left-0 bg-red-600 text-white text-[10px] font-bold px-2 py-1 z-10">OFERTA</div>}

            {imageLoading && !imageError && displayImageUrl ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
            ) : imageError || !displayImageUrl ? (
              <span className="text-4xl filter grayscale opacity-50">{getPlaceholderEmoji()}</span>
            ) : (
              <img
                src={displayImageUrl}
                alt={safeItem.nome}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                onError={handleImageError}
                onLoad={handleImageLoad}
                loading="lazy"
              />
            )}
          </div>
        </div>

        {/* 📝 CONTEÚDO */}
        <div className="flex-1 flex flex-col justify-between min-w-0 py-1">
          <div>
            <div className="flex justify-between items-start">
                <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1 line-clamp-2 transition-colors" style={{ ':hover': { color: cores.destaque } }}>
                {safeItem.nome}
                </h3>
            </div>
            
            {safeItem.descricao && (
              <p className="text-gray-500 text-sm leading-relaxed line-clamp-2 mb-2">
                {safeItem.descricao}
              </p>
            )}

            {!podeAdicionarDireto() && (
                <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600 border border-gray-200 mb-2">
                    {safeItem.variacoes.filter(v => v.ativo).length} opções
                </span>
            )}
          </div>

          <div className="flex items-end justify-between mt-auto pt-2 border-t border-gray-100">
            <div>
                {mostrarPreco()}
            </div>

            <button
              onClick={handleButtonClick}
              disabled={botaoConfig.disabled}
              style={{ backgroundColor: botaoConfig.disabled ? '#E5E7EB' : botaoConfig.cor, color: botaoConfig.textoCor }}
              className={`
                px-4 py-2 rounded-lg font-bold text-sm shadow-md transition-transform active:scale-95 flex items-center gap-1
                ${botaoConfig.disabled ? 'cursor-not-allowed opacity-50' : 'hover:brightness-105'}
              `}
            >
              {botaoConfig.icone}
              <span className="hidden sm:inline">{botaoConfig.texto}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CardapioItem;