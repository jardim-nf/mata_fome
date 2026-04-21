import React, { useState, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { IoAdd, IoOptions, IoCart } from 'react-icons/io5';
import ModelViewer3D from './ModelViewer3D';

// 🚀 React.memo evita re-render quando o carrinho muda mas este item não
const CardapioItem = memo(function CardapioItem({ item, onAddItem, onPurchase, coresEstabelecimento }) {
  const cores = coresEstabelecimento || { primaria: '#EA1D2C', destaque: '#059669', background: '#FFFFFF' };
  const [displayImageUrl, setDisplayImageUrl] = useState(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);

  const safeItem = item ? {
    nome: item.nome || 'Item sem nome',
    descricao: item.descricao || '',
    preco: typeof item.preco === 'number' ? item.preco : 0,
    imageUrl: item.imageUrl || null,
    modelo3dUrl: item.modelo3dUrl || null,
    categoria: item.categoria || '',
    ativo: item.ativo !== false,
    disponivel: item.disponivel !== false,
    adicionais: Array.isArray(item.adicionais) ? item.adicionais : [],
    variacoes: Array.isArray(item.variacoes) ? item.variacoes : []
  } : {};

  useEffect(() => {
    if (!item) return;
    let isMounted = true;
    const loadImageSafely = async () => {
      if (!safeItem.imageUrl) { setImageLoading(false); setImageError(true); return; }
      try {
        setImageLoading(true); setImageError(false);
        let finalUrl = safeItem.imageUrl;
        if (!safeItem.imageUrl.startsWith('http')) {
          try { 
            finalUrl = await getDownloadURL(ref(storage, safeItem.imageUrl)); 
          } catch (e) {
            console.warn(`[CardapioItem] Não foi possível carregar a imagem do Storage para ${safeItem.nome}:`, e.code);
          }
        }
        if (isMounted) setDisplayImageUrl(finalUrl);
      } catch (e) { 
        if (isMounted) setImageError(true); 
        console.warn(`[CardapioItem] Falha geral ao exibir imagem de ${safeItem.nome}:`, e);
      } 
      finally { if (isMounted) setImageLoading(false); }
    };
    loadImageSafely();
    return () => { isMounted = false; };
  }, [safeItem.imageUrl]);

  const isAvailable = safeItem.ativo && safeItem.disponivel;
  const hasVariations = safeItem.variacoes && safeItem.variacoes.length > 0;

  // 🚀 Feedback háptico em mobile
  const hapticFeedback = () => {
    if (navigator.vibrate) navigator.vibrate(50);
  };

  // Ação do botão de carrinho flutuante (Compra Rápida)
  const handleMainAction = (e) => {
    e.stopPropagation(); // Impede que abra o modal normal ao clicar no carrinho
    if (!isAvailable) return;
    hapticFeedback();
    if (onPurchase) onPurchase(safeItem);
  };

  // 🔥 Ação ao clicar no CARD INTEIRO (Mesma ação do botão Adicionar/Detalhes)
  const handleCardClick = () => {
      if (!isAvailable) return;
      if (onAddItem) onAddItem(safeItem);
  };

  const handleImageClick = (e) => {
    e.stopPropagation();
    if (displayImageUrl && !imageError) {
      setShowImageModal(true);
    }
  };

  const mostrarPreco = () => {
    const stylePreco = { color: cores.destaque, fontSize: '1.1rem', fontWeight: 'bold' };
    if (!hasVariations) return <p style={stylePreco}>R$ {(Number(safeItem.preco) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>;
    
    const variacoesAtivas = safeItem.variacoes.filter(v => v.ativo);
    if (variacoesAtivas.length === 0) return <p style={stylePreco}>R$ {(Number(safeItem.preco) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>;
    
    const menorPreco = Math.min(...variacoesAtivas.map(v => Number(v.preco)));
    return (
      <div className="flex flex-col items-end">
        <span className="text-[10px] text-gray-500 uppercase tracking-wide">A partir de</span>
        <p style={stylePreco}>R$ {menorPreco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
      </div>
    );
  };

  if (!item) return null;

  return (
    <div 
        onClick={handleCardClick} // 🔥 TORNA O CARD INTEIRO CLICÁVEL
        className={`bg-white rounded-xl border border-gray-200 p-3 hover:border-gray-300 hover:shadow-md transition-all duration-300 group cursor-pointer relative overflow-hidden ${!isAvailable ? 'opacity-60 grayscale bg-gray-50 cursor-not-allowed' : ''}`}
    >
      <div className="flex gap-4">
        {/* IMAGEM COM BOTÃO FLUTUANTE DE COMPRA RÁPIDA */}
        <div className="flex-shrink-0 relative">
          <div className="w-28 h-28 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center relative shadow-sm">
             {safeItem.promo && <div className="absolute top-0 left-0 bg-red-600 text-white text-[10px] font-bold px-2 py-1 z-10">OFERTA</div>}
            {safeItem.modelo3dUrl ? (
              <div className="w-full h-full" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                <ModelViewer3D
                  src={safeItem.modelo3dUrl}
                  poster={displayImageUrl}
                  alt={safeItem.nome}
                  compact={true}
                  coresEstabelecimento={cores}
                />
              </div>
            ) : imageLoading ? (
              <div className="w-full h-full skeleton-shimmer" />
            ) : (
              <img
                src={displayImageUrl}
                alt={safeItem.nome}
                loading="lazy"
                decoding="async"
                width={112}
                height={112}
                onClick={handleImageClick}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 cursor-zoom-in relative z-10"
                onError={() => setImageError(true)}
                onLoad={() => setImageLoading(false)}
              />
            )}
          </div>
          
          {isAvailable && (
              <button 
                onClick={handleMainAction}
                className="absolute -bottom-3 -right-3 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center border transition-transform hover:scale-110 active:scale-95 z-10"
                style={{ color: cores.destaque, borderColor: cores.destaque }}
                title="Comprar Agora"
              >
                  <IoCart size={22} />
              </button>
          )}
        </div>

        <div className="flex-1 flex flex-col justify-between min-w-0 py-1">
          <div>
            <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1 transition-colors group-hover:text-red-600">{safeItem.nome}</h3>
            {safeItem.descricao && <p className="text-gray-500 text-sm leading-relaxed mb-2">{safeItem.descricao}</p>}
          </div>
          <div className="flex items-end justify-between mt-auto pt-2 border-t border-gray-100">
            <div>{mostrarPreco()}</div>
            
            {/* O botão também chama a mesma ação, com stopPropagation por segurança visual */}
            <button 
                onClick={(e) => { e.stopPropagation(); hapticFeedback(); onAddItem(safeItem); }} 
                disabled={!isAvailable} 
                style={{ backgroundColor: !isAvailable ? '#E5E7EB' : cores.primaria, color: '#FFF' }} 
                className="px-4 py-2 rounded-lg font-bold text-sm shadow-md transition-transform active:scale-95 flex items-center gap-1 hover:brightness-110"
            >
              {hasVariations ? <IoOptions size={16} /> : <IoAdd size={18} />} 
              <span className="hidden sm:inline">{hasVariations ? 'Detalhes' : 'Adicionar'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox Modal (Portal to body to prevent overflow issues) */}
      {showImageModal && createPortal(
        <div 
            className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center p-4 cursor-zoom-out"
            onClick={(e) => { e.stopPropagation(); setShowImageModal(false); }}
        >
            <div className="w-full max-w-2xl flex justify-end mb-2">
                <button 
                    onClick={(e) => { e.stopPropagation(); setShowImageModal(false); }}
                    className="text-white hover:text-gray-300 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors cursor-pointer"
                >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <img 
                src={displayImageUrl} 
                alt={safeItem.nome} 
                className="w-auto h-auto max-w-full md:max-w-4xl lg:max-w-5xl max-h-[85vh] object-contain rounded-xl shadow-2xl relative z-10"
            />
            <h3 className="text-white text-xl font-bold mt-4 text-center max-w-2xl leading-tight">{safeItem.nome}</h3>
        </div>,
        document.body
      )}

    </div>
  );
});
export default CardapioItem;