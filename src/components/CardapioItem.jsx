// src/components/CardapioItem.jsx - VERSÃO MELHORADA E CORRIGIDA
import React, { useState, useEffect } from 'react';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

function CardapioItem({ item, onAddItem, onQuickAdd, coresEstabelecimento }) {
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
  const hasVariations = safeItem.variacoes && safeItem.variacoes.length > 0;

  // 🎯 FUNÇÃO INTELIGENTE: Verifica se pode adicionar direto (CORRIGIDA)
  const podeAdicionarDireto = () => {
    // 1. Se NÃO tiver variações, adiciona direto.
    if (!hasVariations) {
        return true;
    }

    // 2. Tem variações. Conta quantas variações ativas e válidas (com preço >= 0) existem.
    const variacoesAtivas = safeItem.variacoes.filter(v => 
        v.ativo && v.preco !== undefined && !isNaN(Number(v.preco)) && Number(v.preco) >= 0
    );

    // 3. Se houver APENAS UMA variação ativa, ADICIONA DIRETO.
    if (variacoesAtivas.length === 1) {
        return true; 
    }

    // 4. Se houver 0 ou 2+ variações ativas, precisa do modal.
    return false;
  };

  // 🎯 FUNÇÃO PARA LIDAR COM CLIQUE NO BOTÃO (CORRIGIDA)
  const handleButtonClick = () => {
    if (!isAvailable) return;
    
    if (podeAdicionarDireto()) {
        if (onQuickAdd) {
            let itemParaAdicionar = safeItem;

            // Se tem exatamente 1 variação ativa, a incluímos no item para onQuickAdd
            const variacoesAtivas = safeItem.variacoes.filter(v => 
                v.ativo && v.preco !== undefined && !isNaN(Number(v.preco)) && Number(v.preco) >= 0
            );

            if (variacoesAtivas.length === 1) {
                const variacaoUnica = variacoesAtivas[0];
                itemParaAdicionar = {
                    ...safeItem,
                    variacaoSelecionada: {
                        nome: variacaoUnica.nome,
                        preco: Number(variacaoUnica.preco)
                    },
                    // Define o preço final como o preço da variação única
                    precoFinal: Number(variacaoUnica.preco) 
                };
            }

            onQuickAdd(itemParaAdicionar);
        }
    } else {
      // Produto COM 0 ou 2+ variações - abre modal para escolher
      if (onAddItem) {
        onAddItem(safeItem);
      }
    }
  };

  // 🎯 FUNÇÃO MELHORADA PARA PREÇOS
  const mostrarPreco = () => {
    if (!safeItem.variacoes || safeItem.variacoes.length === 0) {
      return (
        <p className="text-lg font-bold whitespace-nowrap" style={{ color: cores.primaria }}>
          R$ {(Number(safeItem.preco) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      );
    }

    const variacoesAtivas = safeItem.variacoes.filter(v => 
      v.ativo && v.preco !== undefined && !isNaN(Number(v.preco)) && Number(v.preco) >= 0
    );

    if (variacoesAtivas.length === 0) {
      return (
        <p className="text-lg font-bold whitespace-nowrap" style={{ color: cores.primaria }}>
          R$ {(Number(safeItem.preco) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      );
    }

    // 1 VARIAÇÃO (Adição Direta): Mostrar apenas o preço
    if (variacoesAtivas.length === 1) {
      const preco = Number(variacoesAtivas[0].preco);
      return (
        <p className="text-lg font-bold whitespace-nowrap" style={{ color: cores.primaria }}>
          R$ {preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      );
    }

    // 2+ VARIAÇÕES: Mostrar "A partir de"
    const menorPreco = Math.min(...variacoesAtivas.map(v => Number(v.preco)));
    return (
      <div className="text-right">
        <p className="text-xs text-gray-600 whitespace-nowrap">A partir de</p>
        <p className="text-lg font-bold whitespace-nowrap" style={{ color: cores.primaria }}>
          R$ {menorPreco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      </div>
    );
  };

  // 🎯 FUNÇÃO PARA DETERMINAR O BOTÃO
  const getBotaoConfig = () => {
    if (!isAvailable) {
      return {
        texto: 'Indisponível',
        cor: '#D1D5DB',
        textoCor: '#6B7280',
        disabled: true
      };
    }

    if (podeAdicionarDireto()) {
      // Produto sem variações ou com 1 variação - Adicionar direto
      return {
        texto: 'Adicionar',
        cor: cores.destaque || '#059669', // VERDE
        textoCor: '#FFFFFF',
        disabled: false,
        icone: '➕'
      };
    } else {
      // Produto COM 2+ variações - Escolher opções
      return {
        texto: 'Escolher',
        cor: cores.primaria || '#DC2626', // VERMELHO/AZUL
        textoCor: '#FFFFFF', 
        disabled: false,
        icone: '⚙️'
      };
    }
  };

  const botaoConfig = getBotaoConfig();

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all duration-300 group ${
      !isAvailable ? 'opacity-60' : ''
    }`}>
      <div className="flex gap-4">
        {/* IMAGEM - TAMANHO FIXO */}
        <div className="flex-shrink-0">
          <div className="w-20 h-20 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
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

        {/* CONTEÚDO - FLEXÍVEL SEM CORTE */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {/* CABEÇALHO COM NOME E PREÇO */}
          <div className="flex justify-between items-start mb-2 gap-2">
            {/* NOME E CATEGORIA */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 text-lg break-words leading-tight">
                {safeItem.nome}
              </h3>
              
              {/* CATEGORIA */}
              <p className="text-gray-500 text-sm mt-1 truncate">
                {safeItem.categoria}
              </p>
            </div>
            
            {/* PREÇO - FIXO À DIREITA */}
            <div className="flex-shrink-0 ml-2">
              {mostrarPreco()}
            </div>
          </div>

          {/* DESCRIÇÃO */}
          {safeItem.descricao && (
            <p className="text-gray-700 text-sm mt-2 mb-3 line-clamp-2 break-words">
              {safeItem.descricao}
            </p>
          )}

          {/* BADGES DE PERSONALIZAÇÃO */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {/* BADGE PRODUTO SEM VARIAÇÕES ou COM 1 VARIAÇÃO */}
            {podeAdicionarDireto() && isAvailable && (
              <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium" 
                   style={{ 
                     backgroundColor: `${cores.destaque}15`,
                     color: cores.destaque,
                     border: `1px solid ${cores.destaque}30`
                   }}>
                ✅ {hasVariations ? 'Adição direta (1 Opção)' : 'Adicionar direto'}
              </div>
            )}

            {/* BADGE DE MÚLTIPLAS VARIAÇÕES */}
            {hasVariations && !podeAdicionarDireto() && (
              <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium" 
                   style={{ 
                     backgroundColor: `${cores.primaria}15`,
                     color: cores.primaria,
                     border: `1px solid ${cores.primaria}30`
                   }}>
                {safeItem.variacoes.filter(v => v.ativo).length} opções
              </div>
            )}
          </div>

          {/* BOTÃO INTELIGENTE */}
          <button
            onClick={handleButtonClick}
            disabled={botaoConfig.disabled}
            className={`
              w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 transform
              ${botaoConfig.disabled 
                ? 'cursor-not-allowed' 
                : 'hover:scale-105 shadow-md hover:shadow-lg'
              }
              flex items-center justify-center gap-2
            `}
            style={{
              backgroundColor: botaoConfig.cor,
              color: botaoConfig.textoCor
            }}
          >
            {botaoConfig.icone && <span>{botaoConfig.icone}</span>}
            {botaoConfig.texto}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CardapioItem;