// src/components/CardapioItem.jsx - VERSÃO ATUALIZADA COMPATÍVEL

import React, { useState, useEffect } from 'react';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

function CardapioItem({ item, onAddItem, coresEstabelecimento }) {
  // 🎨 Valores padrão para cores
  const cores = coresEstabelecimento || {
    primaria: '#DC2626',
    destaque: '#059669', 
    background: '#FFFBEB'
  };

  if (!item) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-3 opacity-60">
        <div className="flex items-start gap-3">
          <div className="w-16 h-16 bg-gray-200 rounded-xl flex-shrink-0"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

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

  const placeholderImage = "https://via.placeholder.com/80x80.png?text=🍔";
  const [displayImageUrl, setDisplayImageUrl] = useState(placeholderImage);
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    const fetchImageUrl = async () => {
      if (safeItem.imageUrl) {
        if (safeItem.imageUrl.startsWith('http')) {
          setDisplayImageUrl(safeItem.imageUrl);
        } else {
          try {
            const imageRef = ref(storage, safeItem.imageUrl);
            const downloadUrl = await getDownloadURL(imageRef);
            setDisplayImageUrl(downloadUrl);
          } catch (error) {
            setDisplayImageUrl(placeholderImage);
          }
        }
      }
      setImageLoading(false);
    };
    fetchImageUrl();
  }, [safeItem.imageUrl]);

  const isAvailable = safeItem.ativo && safeItem.disponivel;
  const hasExtras = safeItem.adicionais.length > 0;
  const hasVariations = safeItem.variacoes.length > 0;

  const handleAddItemClick = () => {
    if (isAvailable && onAddItem) {
      onAddItem(safeItem);
    }
  };

  // 🎯 FUNÇÃO MELHORADA PARA PREÇOS
  const mostrarPreco = () => {
    if (!safeItem.variacoes || safeItem.variacoes.length === 0) {
      return (
        <p className="text-lg font-bold" style={{ color: cores.primaria }}>
          R$ {(Number(safeItem.preco) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      );
    }

    const variacoesAtivas = safeItem.variacoes.filter(v => 
      v.ativo && v.preco && !isNaN(Number(v.preco)) && Number(v.preco) > 0
    );

    if (variacoesAtivas.length === 0) {
      return (
        <p className="text-lg font-bold" style={{ color: cores.primaria }}>
          R$ {(Number(safeItem.preco) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      );
    }

    // 1 VARIAÇÃO: Mostrar apenas o preço
    if (variacoesAtivas.length === 1) {
      const preco = Number(variacoesAtivas[0].preco);
      return (
        <p className="text-lg font-bold" style={{ color: cores.primaria }}>
          R$ {preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      );
    }

    // 2+ VARIAÇÕES: Mostrar "A partir de"
    const menorPreco = Math.min(...variacoesAtivas.map(v => Number(v.preco)));
    return (
      <div>
        <p className="text-xs text-gray-600">A partir de</p>
        <p className="text-lg font-bold" style={{ color: cores.primaria }}>
          R$ {menorPreco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      </div>
    );
  };

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all duration-300 group ${
      !isAvailable ? 'opacity-60' : ''
    }`}>
      <div className="flex gap-4">
        {/* IMAGEM */}
        <div className="flex-shrink-0">
          <div className="w-20 h-20 md:w-24 md:h-24 bg-gray-100 rounded-xl overflow-hidden">
            <img
              src={displayImageUrl}
              alt={safeItem.nome}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              onError={(e) => { 
                e.target.onerror = null; 
                e.target.src = placeholderImage;
              }}
            />
          </div>
        </div>

        {/* CONTEÚDO */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1 mr-2">
              {/* NOME */}
              <h3 className="font-bold text-gray-900 text-lg truncate">
                {safeItem.nome}
              </h3>

              {/* CATEGORIA */}
              <p className="text-gray-500 text-sm mt-1">
                {safeItem.categoria}
              </p>

              {/* DESCRIÇÃO */}
              {safeItem.descricao && (
                <p className="text-gray-700 text-sm mt-2 line-clamp-2">
                  {safeItem.descricao}
                </p>
              )}
            </div>
            
            {/* PREÇO */}
            <div className="text-right flex-shrink-0">
              {mostrarPreco()}
            </div>
          </div>

          {/* 🆕 BADGE DE MÚLTIPLAS VARIAÇÕES */}
          {safeItem.variacoes && safeItem.variacoes.filter(v => v.ativo).length > 1 && (
            <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mb-3" 
                 style={{ 
                   backgroundColor: `${cores.primaria}15`,
                   color: cores.primaria,
                   border: `1px solid ${cores.primaria}30`
                 }}>
              {safeItem.variacoes.filter(v => v.ativo).length} opções disponíveis
            </div>
          )}

          {/* INFORMAÇÕES DE PERSONALIZAÇÃO */}
          {(hasExtras || hasVariations) && isAvailable && (
            <div className="flex items-center gap-1 text-xs mb-3"
                 style={{ color: cores.primaria }}>
              <span>✨</span>
              <span className="font-medium">
                {hasVariations && `${safeItem.variacoes.filter(v => v.ativo).length} variação(ões)`}
                {hasExtras && hasVariations && ' • '}
                {hasExtras && `${safeItem.adicionais.length} adicional(is)`}
              </span>
            </div>
          )}

          {/* BOTÃO */}
          <button
            onClick={handleAddItemClick}
            disabled={!isAvailable}
            className={`
              w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 transform hover:scale-105
              ${!isAvailable
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'text-white shadow-md hover:shadow-lg'
              }
            `}
            style={{
              backgroundColor: !isAvailable 
                ? '#D1D5DB' 
                : cores.primaria
            }}
          >
            {!isAvailable ? 'Indisponível' : 
             (hasExtras || hasVariations) ? '➕ Adicionar' : '➕ Adicionar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CardapioItem;