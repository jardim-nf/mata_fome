// src/pages/AdminMenuManagement.jsx - VERSÃO COMPLETA CORRIGIDA
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, getDoc, orderBy, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useHeader } from '../context/HeaderContext';
import { toast } from 'react-toastify';
import { uploadFile, deleteFileByUrl } from '../utils/firebaseStorageService';
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { usePagination } from '../hooks/usePagination';
import Pagination from '../components/Pagination';
// No início do arquivo AdminMenuManagement.jsx, adicione IoText aos imports:
import {
    IoArrowBack,
    IoAddCircleOutline,
    IoSearch,
    IoFilter,
    IoClose,
    IoImageOutline,
    IoCheckmarkCircle,
    IoAlertCircle,
    IoChevronUp,
    IoChevronDown,
    IoSwapVertical,
    IoCube,
    IoCash,
    IoStatsChart,
    IoSaveOutline,
    IoPricetag,
    IoList,
    IoEye,
    IoEyeOff,
    IoGrid,
    IoMenu,
    IoRemove,
    IoAdd,
    IoPlayForward,
    IoRefresh,
    IoColorPalette,
    IoBrush,
    IoText // 🆕 ADICIONAR ESTE IMPORT
} from 'react-icons/io5';

// 🎨 Componente Skeleton Loader em Grid
const SkeletonLoader = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 animate-pulse">
        <div className="flex flex-col space-y-3">
          <div className="w-full h-40 md:h-48 bg-gray-300 rounded-xl"></div>
          <div className="space-y-2">
            <div className="h-5 bg-gray-300 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
          <div className="flex justify-between items-center pt-2">
            <div className="h-6 bg-gray-200 rounded w-20"></div>
            <div className="flex space-x-2">
              <div className="h-8 bg-gray-200 rounded w-8"></div>
              <div className="h-8 bg-gray-200 rounded w-8"></div>
              <div className="h-8 bg-gray-200 rounded w-8"></div>
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

// 🎨 Componente Product Card para Grid
const ProductGridCard = ({ 
  produto, 
  onEdit, 
  onDelete, 
  onToggleStatus, 
  onUpdateStock,
  stockStatus,
  profitMargin 
}) => {
  const [localStock, setLocalStock] = useState(produto.estoque || 0);

  const stockConfig = {
    normal: { color: 'bg-green-100 text-green-800 border-green-200', icon: IoCheckmarkCircle },
    baixo: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: IoAlertCircle },
    critico: { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: IoAlertCircle },
    esgotado: { color: 'bg-red-100 text-red-800 border-red-200', icon: IoClose }
  };

  const { color, icon: Icon } = stockConfig[stockStatus] || stockConfig.normal;

  const handleStockUpdate = (newStock) => {
    setLocalStock(newStock);
    onUpdateStock(newStock);
  };

  const handleStockChange = (e) => {
    const value = Math.max(0, parseInt(e.target.value) || 0);
    setLocalStock(value);
    onUpdateStock(value);
  };

  // 🆕 MOSTRAR PREÇOS DAS VARAÇÕES - VERSÃO MELHORADA
  const mostrarPrecosVariacoes = () => {
    if (!produto.variacoes || produto.variacoes.length === 0) {
      return (
        <p className="text-xl md:text-2xl font-bold text-green-600">
          R$ {(Number(produto.preco) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      );
    }

    const variacoesAtivas = produto.variacoes.filter(v => 
      v.ativo && v.preco && !isNaN(Number(v.preco)) && Number(v.preco) > 0
    );

    if (variacoesAtivas.length === 0) {
      return (
        <p className="text-xl md:text-2xl font-bold text-green-600">
          R$ {(Number(produto.preco) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      );
    }

    // 🎯 1 VARIAÇÃO: Mostrar apenas o preço
    if (variacoesAtivas.length === 1) {
      const preco = Number(variacoesAtivas[0].preco);
      return (
        <p className="text-xl md:text-2xl font-bold text-green-600">
          R$ {preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      );
    }

    // 🎯 2+ VARIAÇÕES: Mostrar mensagem + valores
    const precosFormatados = variacoesAtivas
      .map(v => `R$ ${Number(v.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
      .join(' • ');

    return (
      <div className="space-y-1">
        <div className="text-xs text-gray-600 font-medium">
          {variacoesAtivas.length} opções de preço
        </div>
        <div className="text-sm text-green-600 font-semibold leading-tight">
          {precosFormatados}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-300 hover:scale-105 group">
      {/* Imagem do Produto */}
      <div className="relative">
        {produto.imageUrl ? (
          <img 
            src={produto.imageUrl} 
            alt={produto.nome}
            className="w-full h-40 md:h-48 object-cover rounded-t-2xl"
          />
        ) : (
          <div className="w-full h-40 md:h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-2xl flex items-center justify-center">
            <IoImageOutline className="text-gray-400 text-3xl md:text-4xl" />
          </div>
        )}
        
        {/* Status Badges */}
        <div className="absolute top-2 left-2 md:top-3 md:left-3 flex flex-col space-y-1 md:space-y-2">
          {!produto.ativo && (
            <span className="bg-gray-800 text-white px-2 py-1 md:px-3 rounded-full text-xs font-medium shadow-lg">
              <IoEyeOff className="inline w-3 h-3 mr-1" />
              Inativo
            </span>
          )}
          <span className={`inline-flex items-center space-x-1 px-2 py-1 md:px-3 rounded-full text-xs font-medium border ${color} shadow-lg`}>
            <Icon className="w-3 h-3" />
            <span className="hidden xs:inline">
              {stockStatus === 'normal' ? 'OK' : 
               stockStatus === 'baixo' ? 'Baixo' : 
               stockStatus === 'critico' ? 'Crítico' : 'Esgotado'}
            </span>
          </span>
        </div>

        {/* Margem de Lucro */}
        {profitMargin > 0 && (
          <div className="absolute top-2 right-2 md:top-3 md:right-3 bg-blue-600 text-white px-2 py-1 md:px-3 rounded-full text-xs font-medium shadow-lg">
            <IoStatsChart className="inline w-3 h-3 mr-1" />
            {profitMargin.toFixed(1)}%
          </div>
        )}

        {/* 🆕 Badge de Múltiplas Variações */}
        {produto.variacoes && produto.variacoes.filter(v => v.ativo).length > 1 && (
          <div className="absolute bottom-2 right-2 md:bottom-3 md:right-3 bg-purple-600 text-white px-2 py-1 md:px-3 rounded-full text-xs font-medium shadow-lg">
            {produto.variacoes.filter(v => v.ativo).length} opções
          </div>
        )}
      </div>

      {/* Conteúdo do Card */}
      <div className="p-4 md:p-5">
        {/* Nome e Categoria */}
        <div className="mb-3 md:mb-4">
          <h3 className="font-bold text-gray-900 text-base md:text-lg truncate mb-1">{produto.nome}</h3>
          <p className="text-gray-600 text-xs md:text-sm flex items-center">
            <IoPricetag className="w-3 h-3 mr-1" />
            {produto.categoria}
          </p>
        </div>

        {/* Descrição */}
        {produto.descricao && (
          <p className="text-gray-700 text-xs md:text-sm mb-3 md:mb-4 line-clamp-2 leading-relaxed">{produto.descricao}</p>
        )}

        {/* 🆕 Preço - Agora mostra variações */}
        <div className="flex justify-between items-center mb-3 md:mb-4">
          <div className="flex-1">
            {mostrarPrecosVariacoes()}
            {produto.custo > 0 && (
              <p className="text-xs text-gray-500 mt-1 hidden sm:block">
                Custo: R$ {Number(produto.custo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>
          <div className="text-right ml-2">
            <p className="text-lg font-semibold text-gray-900">{localStock}</p>
            <p className="text-xs text-gray-500">estoque</p>
          </div>
        </div>

        {/* Controle Rápido de Estoque */}
        <div className="flex items-center space-x-2 mb-4 md:mb-5">
          <button
            onClick={() => handleStockUpdate(Math.max(0, localStock - 1))}
            className="w-8 h-8 md:w-10 md:h-10 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl flex items-center justify-center transition-colors border border-gray-300"
          >
            <IoRemove className="w-3 h-3 md:w-4 md:h-4" />
          </button>
          <input
            type="number"
            value={localStock}
            onChange={handleStockChange}
            className="flex-1 h-8 md:h-10 text-center border border-gray-300 rounded-xl text-sm font-medium"
            min="0"
          />
          <button
            onClick={() => handleStockUpdate(localStock + 1)}
            className="w-8 h-8 md:w-10 md:h-10 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl flex items-center justify-center transition-colors border border-gray-300"
          >
            <IoAdd className="w-3 h-3 md:w-4 md:h-4" />
          </button>
        </div>

        {/* Ações - Mobile Otimizado */}
        <div className="flex space-x-2">
          <button
            onClick={onToggleStatus}
            className={`flex-1 py-2 md:py-3 px-2 md:px-4 rounded-xl text-xs md:text-sm font-semibold transition-all ${
              produto.ativo 
                ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border border-yellow-200' 
                : 'bg-green-100 hover:bg-green-200 text-green-800 border border-green-200'
            }`}
          >
            {produto.ativo ? 'Desativar' : 'Ativar'}
          </button>
          <button
            onClick={onEdit}
            className="flex-1 py-2 md:py-3 px-2 md:px-4 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-xl text-xs md:text-sm font-semibold transition-all border border-blue-200"
          >
            Editar
          </button>
          <button
            onClick={onDelete}
            className="w-10 h-10 md:w-12 md:h-12 bg-red-100 hover:bg-red-200 text-red-800 rounded-xl flex items-center justify-center transition-all border border-red-200"
          >
            <IoClose className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// 🎨 Componente para Cores Personalizadas - VERSÃO CORRIGIDA
// 🎨 Componente para Cores Personalizadas - VERSÃO COMPLETA COM TEXTO
// 🎨 Componente para Cores Personalizadas - VERSÃO COMPLETA COM CORES DE TEXTO
const CoresPersonalizadasSection = ({ formData, setFormData, estabelecimentosGerenciados }) => {
  
  // 🎨 FUNÇÃO PARA SALVAR CORES
  const handleSaveColors = async () => {
    try {
      if (!estabelecimentosGerenciados || estabelecimentosGerenciados.length === 0) {
        toast.error("❌ Nenhum estabelecimento configurado para gerenciar");
        return;
      }

      const estabelecimentoId = estabelecimentosGerenciados[0];
      
      if (!estabelecimentoId) {
        toast.error("❌ ID do estabelecimento não encontrado");
        return;
      }

      const estabRef = doc(db, 'estabelecimentos', estabelecimentoId);
      await updateDoc(estabRef, {
        cores: formData.cores,
        atualizadoEm: serverTimestamp()
      });

      toast.success("🎨 Cores salvas com sucesso! As cores serão aplicadas.");
      
    } catch (error) {
      console.error("❌ Erro ao salvar cores:", error);
      toast.error("❌ Erro ao salvar cores personalizadas");
    }
  };

  return (
    <div className="bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-200 rounded-2xl p-4 md:p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-pink-900 flex items-center">
          <IoColorPalette className="mr-3 text-xl" />
          Cores do Cardápio
        </h3>
        
        {/* Info do estabelecimento */}
        <div className="text-right">
          <p className="text-sm text-gray-600">
            Estabelecimentos: {estabelecimentosGerenciados?.length || 0}
          </p>
          <p className="text-xs text-gray-500">
            Cores aplicadas ao primeiro estabelecimento
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Cor Primária */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cor Primária *
          </label>
          <div className="flex items-center space-x-3">
            <input
              type="color"
              value={formData.cores?.primaria || '#DC2626'}
              onChange={(e) => setFormData({
                ...formData,
                cores: {
                  ...formData.cores,
                  primaria: e.target.value
                }
              })}
              className="w-12 h-12 rounded-lg border border-gray-300 cursor-pointer"
            />
            <div className="flex-1">
              <input
                type="text"
                value={formData.cores?.primaria || '#DC2626'}
                onChange={(e) => setFormData({
                  ...formData,
                  cores: {
                    ...formData.cores,
                    primaria: e.target.value
                  }
                })}
                placeholder="#DC2626"
                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Botões, preços</p>
            </div>
          </div>
        </div>

        {/* Cor de Destaque */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cor de Destaque *
          </label>
          <div className="flex items-center space-x-3">
            <input
              type="color"
              value={formData.cores?.destaque || '#059669'}
              onChange={(e) => setFormData({
                ...formData,
                cores: {
                  ...formData.cores,
                  destaque: e.target.value
                }
              })}
              className="w-12 h-12 rounded-lg border border-gray-300 cursor-pointer"
            />
            <div className="flex-1">
              <input
                type="text"
                value={formData.cores?.destaque || '#059669'}
                onChange={(e) => setFormData({
                  ...formData,
                  cores: {
                    ...formData.cores,
                    destaque: e.target.value
                  }
                })}
                placeholder="#059669"
                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Confirmações</p>
            </div>
          </div>
        </div>

        {/* Cor de Fundo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cor de Fundo *
          </label>
          <div className="flex items-center space-x-3">
            <input
              type="color"
              value={formData.cores?.background || '#000000'}
              onChange={(e) => setFormData({
                ...formData,
                cores: {
                  ...formData.cores,
                  background: e.target.value
                }
              })}
              className="w-12 h-12 rounded-lg border border-gray-300 cursor-pointer"
            />
            <div className="flex-1">
              <input
                type="text"
                value={formData.cores?.background || '#000000'}
                onChange={(e) => setFormData({
                  ...formData,
                  cores: {
                    ...formData.cores,
                    background: e.target.value
                  }
                })}
                placeholder="#000000"
                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Cor de fundo do site</p>
            </div>
          </div>
        </div>
      </div>

      {/* 🆕 SEÇÃO DE CORES DE TEXTO */}
      <div className="border-t border-gray-200 pt-6 mb-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <IoText className="mr-2" />
          Cores do Texto
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Texto Principal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Texto Principal
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={formData.cores?.texto?.principal || '#FFFFFF'}
                onChange={(e) => setFormData({
                  ...formData,
                  cores: {
                    ...formData.cores,
                    texto: {
                      ...formData.cores?.texto,
                      principal: e.target.value
                    }
                  }
                })}
                className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
              />
              <div className="flex-1">
                <input
                  type="text"
                  value={formData.cores?.texto?.principal || '#FFFFFF'}
                  onChange={(e) => setFormData({
                    ...formData,
                    cores: {
                      ...formData.cores,
                      texto: {
                        ...formData.cores?.texto,
                        principal: e.target.value
                      }
                    }
                  })}
                  placeholder="#FFFFFF"
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Títulos, textos principais</p>
              </div>
            </div>
          </div>

          {/* Texto Secundário */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Texto Secundário
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={formData.cores?.texto?.secundario || '#9CA3AF'}
                onChange={(e) => setFormData({
                  ...formData,
                  cores: {
                    ...formData.cores,
                    texto: {
                      ...formData.cores?.texto,
                      secundario: e.target.value
                    }
                  }
                })}
                className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
              />
              <div className="flex-1">
                <input
                  type="text"
                  value={formData.cores?.texto?.secundario || '#9CA3AF'}
                  onChange={(e) => setFormData({
                    ...formData,
                    cores: {
                      ...formData.cores,
                      texto: {
                        ...formData.cores?.texto,
                        secundario: e.target.value
                      }
                    }
                  })}
                  placeholder="#9CA3AF"
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Descrições, labels</p>
              </div>
            </div>
          </div>

          {/* Placeholder */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Texto Placeholder
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={formData.cores?.texto?.placeholder || '#6B7280'}
                onChange={(e) => setFormData({
                  ...formData,
                  cores: {
                    ...formData.cores,
                    texto: {
                      ...formData.cores?.texto,
                      placeholder: e.target.value
                    }
                  }
                })}
                className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
              />
              <div className="flex-1">
                <input
                  type="text"
                  value={formData.cores?.texto?.placeholder || '#6B7280'}
                  onChange={(e) => setFormData({
                    ...formData,
                    cores: {
                      ...formData.cores,
                      texto: {
                        ...formData.cores?.texto,
                        placeholder: e.target.value
                      }
                    }
                  })}
                  placeholder="#6B7280"
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Textos de input vazios</p>
              </div>
            </div>
          </div>

          {/* Texto Destaque */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Texto Destaque
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={formData.cores?.texto?.destaque || '#FBBF24'}
                onChange={(e) => setFormData({
                  ...formData,
                  cores: {
                    ...formData.cores,
                    texto: {
                      ...formData.cores?.texto,
                      destaque: e.target.value
                    }
                  }
                })}
                className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
              />
              <div className="flex-1">
                <input
                  type="text"
                  value={formData.cores?.texto?.destaque || '#FBBF24'}
                  onChange={(e) => setFormData({
                    ...formData,
                    cores: {
                      ...formData.cores,
                      texto: {
                        ...formData.cores?.texto,
                        destaque: e.target.value
                      }
                    }
                  })}
                  placeholder="#FBBF24"
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Preços, informações importantes</p>
              </div>
            </div>
          </div>

          {/* Texto Erro */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Texto Erro
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={formData.cores?.texto?.erro || '#EF4444'}
                onChange={(e) => setFormData({
                  ...formData,
                  cores: {
                    ...formData.cores,
                    texto: {
                      ...formData.cores?.texto,
                      erro: e.target.value
                    }
                  }
                })}
                className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
              />
              <div className="flex-1">
                <input
                  type="text"
                  value={formData.cores?.texto?.erro || '#EF4444'}
                  onChange={(e) => setFormData({
                    ...formData,
                    cores: {
                      ...formData.cores,
                      texto: {
                        ...formData.cores?.texto,
                        erro: e.target.value
                      }
                    }
                  })}
                  placeholder="#EF4444"
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Mensagens de erro</p>
              </div>
            </div>
          </div>

          {/* Texto Sucesso */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Texto Sucesso
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={formData.cores?.texto?.sucesso || '#10B981'}
                onChange={(e) => setFormData({
                  ...formData,
                  cores: {
                    ...formData.cores,
                    texto: {
                      ...formData.cores?.texto,
                      sucesso: e.target.value
                    }
                  }
                })}
                className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer"
              />
              <div className="flex-1">
                <input
                  type="text"
                  value={formData.cores?.texto?.sucesso || '#10B981'}
                  onChange={(e) => setFormData({
                    ...formData,
                    cores: {
                      ...formData.cores,
                      texto: {
                        ...formData.cores?.texto,
                        sucesso: e.target.value
                      }
                    }
                  })}
                  placeholder="#10B981"
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Mensagens de sucesso</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview das Cores */}
      <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-700 mb-3">Preview das Cores:</p>
        
        {/* Preview Cores Principais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div 
              className="w-16 h-16 rounded-lg mx-auto mb-2 border border-gray-300"
              style={{ backgroundColor: formData.cores?.primaria || '#DC2626' }}
            ></div>
            <p className="text-xs text-gray-600">Primária</p>
          </div>
          <div className="text-center">
            <div 
              className="w-16 h-16 rounded-lg mx-auto mb-2 border border-gray-300"
              style={{ backgroundColor: formData.cores?.destaque || '#059669' }}
            ></div>
            <p className="text-xs text-gray-600">Destaque</p>
          </div>
          <div className="text-center">
            <div 
              className="w-16 h-16 rounded-lg mx-auto mb-2 border border-gray-300"
              style={{ backgroundColor: formData.cores?.background || '#000000' }}
            ></div>
            <p className="text-xs text-gray-600">Fundo</p>
          </div>
        </div>

        {/* Preview Cores de Texto */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
          <div className="text-center">
            <div 
              className="w-8 h-8 rounded mx-auto mb-1 border border-gray-300"
              style={{ backgroundColor: formData.cores?.texto?.principal || '#FFFFFF' }}
            ></div>
            <p className="text-xs text-gray-600">Principal</p>
          </div>
          <div className="text-center">
            <div 
              className="w-8 h-8 rounded mx-auto mb-1 border border-gray-300"
              style={{ backgroundColor: formData.cores?.texto?.secundario || '#9CA3AF' }}
            ></div>
            <p className="text-xs text-gray-600">Secundário</p>
          </div>
          <div className="text-center">
            <div 
              className="w-8 h-8 rounded mx-auto mb-1 border border-gray-300"
              style={{ backgroundColor: formData.cores?.texto?.placeholder || '#6B7280' }}
            ></div>
            <p className="text-xs text-gray-600">Placeholder</p>
          </div>
          <div className="text-center">
            <div 
              className="w-8 h-8 rounded mx-auto mb-1 border border-gray-300"
              style={{ backgroundColor: formData.cores?.texto?.destaque || '#FBBF24' }}
            ></div>
            <p className="text-xs text-gray-600">Destaque</p>
          </div>
          <div className="text-center">
            <div 
              className="w-8 h-8 rounded mx-auto mb-1 border border-gray-300"
              style={{ backgroundColor: formData.cores?.texto?.erro || '#EF4444' }}
            ></div>
            <p className="text-xs text-gray-600">Erro</p>
          </div>
          <div className="text-center">
            <div 
              className="w-8 h-8 rounded mx-auto mb-1 border border-gray-300"
              style={{ backgroundColor: formData.cores?.texto?.sucesso || '#10B981' }}
            ></div>
            <p className="text-xs text-gray-600">Sucesso</p>
          </div>
        </div>

        {/* Preview de Textos */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-2">Preview de Textos:</p>
          <div className="space-y-2 p-3 rounded-lg" style={{ backgroundColor: formData.cores?.background || '#000000' }}>
            <h3 style={{ color: formData.cores?.texto?.principal || '#FFFFFF' }} className="text-lg font-bold">
              Título Principal
            </h3>
            <p style={{ color: formData.cores?.texto?.secundario || '#9CA3AF' }} className="text-sm">
              Este é um texto secundário de exemplo
            </p>
            <input 
              type="text" 
              placeholder="Placeholder exemplo" 
              className="w-full p-2 rounded border"
              style={{ 
                backgroundColor: '#1F2937',
                borderColor: '#374151',
                color: formData.cores?.texto?.principal || '#FFFFFF'
              }}
            />
            <p style={{ color: formData.cores?.texto?.destaque || '#FBBF24' }} className="font-semibold">
              R$ 25,90 - Preço em destaque
            </p>
            <p style={{ color: formData.cores?.texto?.erro || '#EF4444' }} className="text-sm">
              ❌ Erro: Campo obrigatório
            </p>
            <p style={{ color: formData.cores?.texto?.sucesso || '#10B981' }} className="text-sm">
              ✅ Sucesso: Operação concluída
            </p>
          </div>
        </div>
      </div>

      {/* 🎨 BOTÃO SALVAR */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={handleSaveColors}
          className="flex items-center space-x-2 text-white font-bold py-4 px-8 rounded-2xl transition-all transform hover:scale-105 shadow-lg text-lg border-2 border-white"
          style={{
            backgroundColor: formData.cores?.primaria || '#DC2626'
          }}
        >
          <IoBrush className="text-2xl" />
          <span className="text-xl">💾 SALVAR CORES</span>
        </button>
      </div>
    </div>
  );
};
function AdminMenuManagement() {
  const { userData } = useAuth();
  const { setActions, clearActions } = useHeader();
  const navigate = useNavigate();

  const [establishmentName, setEstablishmentName] = useState('');
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'nome', direction: 'asc' });
  const [stockFilter, setStockFilter] = useState('todos');
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    categoria: '',
    imageUrl: '',
    ativo: true,
    estoque: 0,
    estoqueMinimo: 0,
    custo: 0,
    cores: {
      primaria: '#DC2626',
      secundaria: '#991B1B',
      destaque: '#059669',
      background: 'from-amber-50 to-orange-50'
    }
  });
  const [formErrors, setFormErrors] = useState({});
  const [itemImage, setItemImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [showActivateAllModal, setShowActivateAllModal] = useState(false);
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);

  // LÓGICA DE VARIAÇÕES
  const [variacoes, setVariacoes] = useState([]);
  const [variacoesErrors, setVariacoesErrors] = useState({});

  const adicionarVariacao = () => {
    const novaVariacao = {
      id: Date.now().toString(),
      nome: '',
      preco: '',
      descricao: '',
      ativo: true
    };
    setVariacoes([...variacoes, novaVariacao]);
  };

  const atualizarVariacao = (id, field, value) => {
    setVariacoes(variacoes.map(v => 
      v.id === id ? { ...v, [field]: value } : v
    ));
    if (variacoesErrors[id] && variacoesErrors[id][field]) {
      setVariacoesErrors(prev => ({
        ...prev,
        [id]: { ...prev[id], [field]: undefined }
      }));
    }
  };

  const removerVariacao = (id) => {
    if (variacoes.length <= 1) {
      toast.error('O item deve ter pelo menos uma variação.');
      return;
    }
    setVariacoes(variacoes.filter(v => v.id !== id));
  };

  // Busca robusta pelo ID do Estabelecimento - CORRIGIDA
  const estabelecimentosGerenciados = useMemo(() => {
    if (Array.isArray(userData?.estabelecimentosGerenciados) && userData.estabelecimentosGerenciados.length > 0) {
      return userData.estabelecimentosGerenciados;
    }
    
    // Fallback para estabelecimentos antigos
    const estabelecimentosData = userData?.estabelecimentos;
    if (Array.isArray(estabelecimentosData) && estabelecimentosData.length > 0) {
      return estabelecimentosData;
    } else if (estabelecimentosData && typeof estabelecimentosData === 'object' && !Array.isArray(estabelecimentosData)) {
      return Object.keys(estabelecimentosData);
    }
    
    return [];
  }, [userData]);

  // Primeiro estabelecimento da lista
  const primeiroEstabelecimento = estabelecimentosGerenciados.length > 0 ? estabelecimentosGerenciados[0] : null;

  // Busca o nome do estabelecimento
  useEffect(() => {
    if (primeiroEstabelecimento) {
      const fetchEstablishmentName = async () => {
        try {
          const estabDoc = await getDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento));
          if (estabDoc.exists()) {
            const estabData = estabDoc.data();
            setEstablishmentName(estabData.nome);
            
            // 🎨 CARREGAR CORES PERSONALIZADAS DO ESTABELECIMENTO
            if (estabData.cores) {
              setFormData(prev => ({
                ...prev,
                cores: estabData.cores
              }));
            }
          } else {
            toast.error("Estabelecimento não encontrado");
          }
        } catch (error) {
          console.error("Erro ao buscar nome do estabelecimento:", error);
          toast.error("Erro ao carregar dados do estabelecimento");
        }
      };
      fetchEstablishmentName();
    }
  }, [primeiroEstabelecimento]);

  // 🎯 CORREÇÃO COMPLETA: Listener para categorias e produtos (subcoleção 'itens')
  useEffect(() => {
    if (!primeiroEstabelecimento) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const categoriasRef = collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio');
    const qCategorias = query(categoriasRef, orderBy('ordem', 'asc'));

    const unsubscribeCategorias = onSnapshot(qCategorias, (categoriasSnapshot) => {
      const fetchedCategories = categoriasSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCategories(fetchedCategories);

      const unsubscribers = [];
      let allItems = [];

      if (categoriasSnapshot.empty) {
        setMenuItems([]);
        setLoading(false);
        return;
      }

      categoriasSnapshot.forEach(catDoc => {
        const categoriaData = catDoc.data();
        
        // 🎯 CORREÇÃO: Buscar na subcoleção 'itens'
        const itemsRef = collection(
          db,
          'estabelecimentos',
          primeiroEstabelecimento,
          'cardapio',
          catDoc.id,
          'itens'  // ← NOME CORRETO DA SUBCOLEÇÃO
        );
        const qItems = query(itemsRef, orderBy('nome', 'asc'));

        const unsubscribeItems = onSnapshot(qItems, (itemsSnapshot) => {
          const itemsDaCategoria = itemsSnapshot.docs.map(itemDoc => ({
            ...itemDoc.data(),
            id: itemDoc.id,
            categoria: categoriaData.nome,
            categoriaId: catDoc.id,
            criadoEm: itemDoc.data().criadoEm?.toDate() || new Date(),
            atualizadoEm: itemDoc.data().atualizadoEm?.toDate() || new Date(),
            estoque: itemDoc.data().estoque || 0,
            estoqueMinimo: itemDoc.data().estoqueMinimo || 0,
            custo: itemDoc.data().custo || 0,
            variacoes: Array.isArray(itemDoc.data().variacoes) ? itemDoc.data().variacoes : []
          }));

          allItems = [
            ...allItems.filter(item => item.categoriaId !== catDoc.id),
            ...itemsDaCategoria
          ];

          setMenuItems(allItems);
        });

        unsubscribers.push(unsubscribeItems);
      });

      setLoading(false);

      return () => {
        unsubscribers.forEach(unsub => unsub());
      };
    }, (error) => {
      console.error("❌ Erro ao carregar categorias:", error);
      toast.error("❌ Erro ao carregar categorias do cardápio.");
      setLoading(false);
    });

    return () => unsubscribeCategorias();
  }, [primeiroEstabelecimento]);

  // 📦 Funções de Estoque
  const getStockStatus = (item) => {
    const estoque = Number(item.estoque) || 0;
    const estoqueMinimo = Number(item.estoqueMinimo) || 0;
    if (estoque === 0) return 'esgotado';
    if (estoque <= estoqueMinimo) return 'critico';
    if (estoque <= (estoqueMinimo * 2)) return 'baixo';
    return 'normal';
  };

  const calculateProfitMargin = (precoVenda, custo) => {
    precoVenda = Number(precoVenda) || 0;
    custo = Number(custo) || 0;
    if (custo <= 0 || precoVenda <= 0) return 0;
    return ((precoVenda - custo) / precoVenda) * 100;
  };

  // Filtragem e ordenação
  const availableCategories = useMemo(() =>
    ['Todos', ...new Set(menuItems.map(item => item.categoria).filter(Boolean))],
    [menuItems]
  );

  const filteredAndSortedItems = useMemo(() => {
    let filtered = menuItems.filter(item =>
      (selectedCategory === 'Todos' || item.categoria === selectedCategory) &&
      (item.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) &&
      (stockFilter === 'todos' ||
        (stockFilter === 'critico' && getStockStatus(item) === 'critico') ||
        (stockFilter === 'baixo' && getStockStatus(item) === 'baixo') ||
        (stockFilter === 'esgotado' && getStockStatus(item) === 'esgotado') ||
        (stockFilter === 'normal' && getStockStatus(item) === 'normal'))
    );
    
    filtered.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      if (sortConfig.key === 'preco' || sortConfig.key === 'estoque' || sortConfig.key === 'custo') {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      } else if (sortConfig.key === 'ativo') {
        aValue = aValue ? 1 : 0;
        bValue = bValue ? 1 : 0;
      } else if (sortConfig.key === 'nome') {
        aValue = (aValue || '').toLowerCase();
        bValue = (bValue || '').toLowerCase();
      } else if (sortConfig.key === 'criadoEm') {
        aValue = aValue instanceof Date ? aValue.getTime() : new Date(aValue).getTime();
        bValue = bValue instanceof Date ? bValue.getTime() : new Date(bValue).getTime();
      }
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [menuItems, searchTerm, selectedCategory, sortConfig, stockFilter]);

  // Paginação
  const ITEMS_PER_PAGE = viewMode === 'grid' ? 12 : 8;
  const {
    currentPage,
    totalPages,
    paginatedItems,
    goToPage,
  } = usePagination(filteredAndSortedItems, ITEMS_PER_PAGE);

  // Estatísticas de estoque
  const stockStatistics = useMemo(() => {
    const totalItems = menuItems.length;
    const criticalStock = menuItems.filter(item => getStockStatus(item) === 'critico').length;
    const lowStock = menuItems.filter(item => getStockStatus(item) === 'baixo').length;
    const outOfStock = menuItems.filter(item => getStockStatus(item) === 'esgotado').length;
    const normalStock = menuItems.filter(item => getStockStatus(item) === 'normal').length;
    const totalInventoryValue = menuItems.reduce((total, item) => {
      return total + (Number(item.estoque) * (Number(item.custo) || 0));
    }, 0);
    const activeItems = menuItems.filter(item => item.ativo).length;
    const inactiveItems = menuItems.filter(item => !item.ativo).length;
    
    return { 
      totalItems, 
      criticalStock, 
      lowStock, 
      outOfStock, 
      normalStock, 
      totalInventoryValue,
      activeItems,
      inactiveItems
    };
  }, [menuItems]);

  // FUNÇÕES PRINCIPAIS
  const validateForm = () => {
    const errors = {};
    const varErrors = {};

    if (!formData.nome?.trim()) {
      errors.nome = 'Nome do item é obrigatório';
    }
    
    if (!formData.categoria?.trim()) {
      errors.categoria = 'Categoria é obrigatória';
    }

    // 🆕 VALIDAÇÃO SIMPLIFICADA DAS VARAÇÕES
    if (!variacoes || variacoes.length === 0) {
      errors.variacoes = 'Configure pelo menos uma opção de preço.';
    } else {
      let temPrecoValido = false;
      
      variacoes.forEach(v => {
        const vError = {};
        
        // Valida nome apenas para variações (não para produto simples)
        const isModoSimples = variacoes.length === 1 && v.nome === 'Padrão';
        if (!isModoSimples && !v.nome?.trim()) {
          vError.nome = 'Nome é obrigatório';
        }
        
        // Valida preço (sempre obrigatório)
        const precoNum = Number(v.preco);
        if (!v.preco || v.preco === '' || isNaN(precoNum)) {
          vError.preco = 'Preço é obrigatório';
        } else if (precoNum <= 0) {
          vError.preco = 'Preço deve ser maior que R$ 0,00';
        } else {
          temPrecoValido = true;
          // Garantir que o preço seja salvo como número
          v.preco = precoNum;
        }
        
        if (Object.keys(vError).length > 0) {
          varErrors[v.id] = vError;
        }
      });

      if (!temPrecoValido) {
        errors.variacoes = 'Pelo menos uma variação deve ter preço válido (maior que R$ 0,00)';
      }
    }

    setFormErrors(errors);
    setVariacoesErrors(varErrors);
    
    return Object.keys(errors).length === 0 && Object.keys(varErrors).length === 0;
  };

  // 🎯 CORREÇÃO: Função de salvar usando subcoleção 'itens'
  const handleSaveItem = async (e) => {
    e.preventDefault();
    setFormLoading(true);

    if (!validateForm()) {
      setFormLoading(false);
      toast.error("❌ Corrija os erros antes de salvar");
      return;
    }

    try {
      if (!primeiroEstabelecimento) {
        toast.error("❌ Estabelecimento não configurado");
        setFormLoading(false);
        return;
      }

      let imageUrl = formData.imageUrl;

      if (itemImage) {
        try {
          const timestamp = Date.now();
          const fileName = `${timestamp}_${itemImage.name}`;
          const path = `estabelecimentos/${primeiroEstabelecimento}/cardapio/${fileName}`;
          imageUrl = await uploadFile(itemImage, path);
          
          if (editingItem?.imageUrl && editingItem.imageUrl !== imageUrl) {
            await deleteFileByUrl(editingItem.imageUrl);
          }
        } catch (error) {
          toast.error(`❌ Falha no upload da imagem: ${error.message}`);
          setFormLoading(false);
          return;
        }
      }

      const categoriaDoc = categories.find(cat => cat.nome === formData.categoria);
      if (!categoriaDoc && !editingItem) {
        toast.error("❌ Categoria não encontrada");
        setFormLoading(false);
        return;
      }
      
      const categoriaIdParaSalvar = editingItem ? editingItem.categoriaId : categoriaDoc.id;

      // 🎯 NOVA LÓGICA: Definir preço principal baseado no tipo de produto
      let precoPrincipal = 0;

      // Se for produto simples, usa o preço direto
      const isProdutoSimples = variacoes.length === 1 && variacoes[0].nome === 'Padrão';
      if (isProdutoSimples) {
        precoPrincipal = Number(variacoes[0].preco) || 0;
      } else {
        // Se for com variações, usa o menor preço ativo
        const precosAtivos = variacoes
          .filter(v => v.ativo && v.preco && !isNaN(Number(v.preco)) && Number(v.preco) > 0)
          .map(v => Number(v.preco));
        
        precoPrincipal = precosAtivos.length > 0 ? Math.min(...precosAtivos) : 0;
      }

      // 🆕 VALIDAÇÃO FINAL: Garantir que tenha preço válido
      if (precoPrincipal <= 0) {
        toast.error("❌ O produto deve ter um preço válido maior que R$ 0,00");
        setFormLoading(false);
        return;
      }

      const itemData = {
        nome: formData.nome.trim(),
        descricao: formData.descricao?.trim() || '',
        preco: precoPrincipal,
        variacoes: variacoes.map(v => ({...v, preco: Number(v.preco)})),
        categoria: formData.categoria.trim(),
        imageUrl: imageUrl,
        ativo: formData.ativo !== undefined ? formData.ativo : true,
        estoque: Number(formData.estoque) || 0,
        estoqueMinimo: Number(formData.estoqueMinimo) || 0,
        custo: Number(formData.custo) || 0,
        atualizadoEm: new Date()
      };

      if (editingItem) {
        // 🎯 CORREÇÃO: Usar subcoleção 'itens'
        const itemRef = doc(
          db, 
          'estabelecimentos', 
          primeiroEstabelecimento, 
          'cardapio', 
          categoriaIdParaSalvar,
          'itens',  // ← NOME CORRETO
          editingItem.id
        );
        await updateDoc(itemRef, itemData);
        toast.success("✅ Item atualizado com sucesso!");
      } else {
        itemData.criadoEm = new Date();
        // 🎯 CORREÇÃO: Usar subcoleção 'itens'
        const itemsRef = collection(
          db, 
          'estabelecimentos', 
          primeiroEstabelecimento, 
          'cardapio', 
          categoriaIdParaSalvar,
          'itens'  // ← NOME CORRETO
        );
        await addDoc(itemsRef, itemData);
        toast.success("✅ Item adicionado com sucesso!");
      }

      closeItemForm();
      
    } catch (error) {
      console.error("❌ Erro ao salvar item:", error);
      toast.error(`❌ Erro ao salvar item: ${error.message}`);
    } finally {
      setFormLoading(false);
    }
  };

  // 🎯 CORREÇÃO: Função de deletar usando subcoleção 'itens'
  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Tem certeza que deseja excluir "${item.nome}"?`)) {
      return;
    }

    try {
      if (item.imageUrl) {
        await deleteFileByUrl(item.imageUrl);
      }

      // 🎯 CORREÇÃO: Usar subcoleção 'itens'
      const itemRef = doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', item.categoriaId, 'itens', item.id);
      await deleteDoc(itemRef);
      
      toast.success("🗑️ Item excluído com sucesso!");
    } catch (error) {
      console.error("❌ Erro ao excluir item:", error);
      toast.error("❌ Erro ao excluir item");
    }
  };

  // 🎯 CORREÇÃO: Função de toggle status usando subcoleção 'itens'
  const toggleItemStatus = async (item) => {
    try {
      // 🎯 CORREÇÃO: Usar subcoleção 'itens'
      const itemRef = doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', item.categoriaId, 'itens', item.id);
      await updateDoc(itemRef, {
        ativo: !item.ativo,
        atualizadoEm: new Date()
      });
      
      toast.success(`✅ Item ${!item.ativo ? 'ativado' : 'desativado'} com sucesso!`);
    } catch (error) {
      console.error("❌ Erro ao alterar status:", error);
      toast.error("❌ Erro ao alterar status do item");
    }
  };

  // 🎯 CORREÇÃO: Função de atualizar estoque usando subcoleção 'itens'
  const quickUpdateStock = async (itemId, newStock) => {
    try {
      const item = menuItems.find(item => item.id === itemId);
      if (!item) {
        toast.error("Item não encontrado");
        return;
      }

      // 🎯 CORREÇÃO: Usar subcoleção 'itens'
      const itemRef = doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', item.categoriaId, 'itens', itemId);
      await updateDoc(itemRef, {
        estoque: Number(newStock),
        atualizadoEm: new Date()
      });
    } catch (error) {
      console.error("❌ Erro ao atualizar estoque:", error);
      toast.error("❌ Erro ao atualizar estoque");
    }
  };

  const openItemForm = useCallback((item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        nome: item.nome || '',
        descricao: item.descricao || '',
        categoria: item.categoria || '',
        imageUrl: item.imageUrl || '',
        ativo: item.ativo !== undefined ? item.ativo : true,
        estoque: item.estoque || 0,
        estoqueMinimo: item.estoqueMinimo || 0,
        custo: item.custo || 0,
        cores: formData.cores // Mantém as cores atuais
      });
      
      if (item.variacoes && item.variacoes.length > 0) {
        setVariacoes(item.variacoes.map(v => ({...v, id: v.id || Date.now().toString()})));
      } else {
        setVariacoes([{
          id: Date.now().toString(),
          nome: 'Padrão',
          preco: item.preco || '',
          descricao: '',
          ativo: true
        }]);
      }
      setImagePreview(item.imageUrl || '');

    } else {
      setEditingItem(null);
      setFormData({
        nome: '',
        descricao: '',
        categoria: '',
        imageUrl: '',
        ativo: true,
        estoque: 0,
        estoqueMinimo: 0,
        custo: 0,
        cores: formData.cores // Mantém as cores atuais
      });
      
      setVariacoes([{
        id: Date.now().toString(),
        nome: 'Padrão',
        preco: '',
        descricao: '',
        ativo: true
      }]);
      setImagePreview('');
    }
    setFormErrors({});
    setVariacoesErrors({});
    setItemImage(null);
    setShowItemForm(true);
  }, [formData.cores]);

  const closeItemForm = () => {
    setShowItemForm(false);
    setEditingItem(null);
    setFormData({
      nome: '',
      descricao: '',
      categoria: '',
      imageUrl: '',
      ativo: true,
      estoque: 0,
      estoqueMinimo: 0,
      custo: 0,
      cores: formData.cores // Mantém as cores atuais
    });
    setFormErrors({});
    setVariacoes([]);
    setVariacoesErrors({});
    setImagePreview('');
    setItemImage(null);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    if (type === 'file') {
      const file = files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          setFormErrors(prev => ({ ...prev, image: 'A imagem deve ter menos de 5MB' }));
          return;
        }
        
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
          setFormErrors(prev => ({ ...prev, image: 'Formato não suportado. Use JPG, PNG ou WEBP' }));
          return;
        }
        
        setItemImage(file);
        const previewUrl = URL.createObjectURL(file);
        setImagePreview(previewUrl);
      }
    } else if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // FUNÇÃO PARA ATIVAR TODOS OS ITENS
  const activateAllItems = async () => {
    setBulkOperationLoading(true);
    
    try {
      const batch = writeBatch(db);
      let updatedCount = 0;

      const inactiveItems = menuItems.filter(item => !item.ativo);

      if (inactiveItems.length === 0) {
        toast.info('✅ Todos os itens já estão ativos!');
        setShowActivateAllModal(false);
        setBulkOperationLoading(false);
        return;
      }

      inactiveItems.forEach(item => {
        const itemRef = doc(
          db,
          'estabelecimentos',
          primeiroEstabelecimento,
          'cardapio',
          item.categoriaId,
          'itens',
          item.id
        );
        batch.update(itemRef, {
          ativo: true,
          atualizadoEm: new Date()
        });
        updatedCount++;
      });

      await batch.commit();
      
      toast.success(`✅ ${updatedCount} itens ativados com sucesso!`);
      setShowActivateAllModal(false);
      
    } catch (error) {
      console.error('❌ Erro ao ativar todos os itens:', error);
      toast.error('❌ Erro ao ativar os itens');
    } finally {
      setBulkOperationLoading(false);
    }
  };

  // FUNÇÃO PARA AJUSTE EM MASSA DE PREÇOS
  const bulkUpdatePrices = async (percentage, operation) => {
    setBulkOperationLoading(true);
    
    try {
      const batch = writeBatch(db);
      let updatedCount = 0;

      const itemsToUpdate = menuItems.filter(item => item.ativo);

      if (itemsToUpdate.length === 0) {
        toast.info('ℹ️ Nenhum item ativo encontrado para ajuste de preço');
        setShowBulkPriceModal(false);
        setBulkOperationLoading(false);
        return;
      }

      itemsToUpdate.forEach(item => {
        const currentPrice = Number(item.preco);
        let newPrice;
        if (operation === 'increase') {
          newPrice = currentPrice * (1 + percentage / 100);
        } else {
          newPrice = currentPrice * (1 - percentage / 100);
        }
        newPrice = Math.max(0.01, newPrice);
        
        const newVariacoes = (item.variacoes || []).map(v => {
            const currentVarPrice = Number(v.preco);
            let newVarPrice;
            if (operation === 'increase') {
                newVarPrice = currentVarPrice * (1 + percentage / 100);
            } else {
                newVarPrice = currentVarPrice * (1 - percentage / 100);
            }
            return { ...v, preco: Number(Math.max(0.01, newVarPrice).toFixed(2)) };
        });

        const itemRef = doc(
          db,
          'estabelecimentos',
          primeiroEstabelecimento,
          'cardapio',
          item.categoriaId,
          'itens',
          item.id
        );
        batch.update(itemRef, {
          preco: Number(newPrice.toFixed(2)),
          variacoes: newVariacoes,
          atualizadoEm: new Date()
        });
        updatedCount++;
      });

      await batch.commit();
      
      const operationText = operation === 'increase' ? 'aumentados' : 'reduzidos';
      toast.success(`✅ Preços de ${updatedCount} itens ${operationText} em ${percentage}%!`);
      setShowBulkPriceModal(false);
      
    } catch (error) {
      console.error('❌ Erro ao ajustar preços em massa:', error);
      toast.error('❌ Erro ao ajustar os preços');
    } finally {
      setBulkOperationLoading(false);
    }
  };

  // CONFIGURAÇÃO DO HEADER GLOBAL
  useEffect(() => {
    console.log('🎯 Configurando ações no header global...');

    const actions = (
        <div className="flex items-center space-x-2 md:space-x-4">
            {/* Toggle View Mode */}
            <div className="flex bg-white rounded-2xl border border-gray-300 p-1 shadow-sm">
                <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 md:p-3 rounded-xl transition-all ${
                        viewMode === 'grid' 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                >
                    <IoGrid className="text-lg md:text-xl" />
                </button>
                <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 md:p-3 rounded-xl transition-all ${
                        viewMode === 'list' 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                >
                    <IoMenu className="text-lg md:text-xl" />
                </button>
            </div>

            {/* Botões de Ação em Massa */}
            <div className="flex items-center space-x-2">
                {stockStatistics.inactiveItems > 0 && (
                    <button
                        onClick={() => setShowActivateAllModal(true)}
                        className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 md:py-3 px-3 md:px-6 rounded-2xl transition-all transform hover:scale-105 shadow-lg text-xs md:text-sm"
                    >
                        <IoRefresh className="text-lg" />
                        <span className="hidden sm:inline">Ativar Todos</span>
                        <span className="bg-green-700 px-2 py-1 rounded-full text-xs">
                            {stockStatistics.inactiveItems}
                        </span>
                    </button>
                )}

                {stockStatistics.activeItems > 0 && (
                    <button
                        onClick={() => setShowBulkPriceModal(true)}
                        className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 md:py-3 px-3 md:px-6 rounded-2xl transition-all transform hover:scale-105 shadow-lg text-xs md:text-sm"
                    >
                        <IoCash className="text-lg" />
                        <span className="hidden sm:inline">Ajustar Preços</span>
                    </button>
                )}

                {/* Botão Salvar Cores */}
                <button
                  onClick={() => {
                    // Função inline para salvar cores
                    const handleSaveColorsInline = async () => {
                      try {
                        if (!estabelecimentosGerenciados || estabelecimentosGerenciados.length === 0) {
                          toast.error("❌ Nenhum estabelecimento configurado");
                          return;
                        }
                        const estabelecimentoId = estabelecimentosGerenciados[0];
                        const estabRef = doc(db, 'estabelecimentos', estabelecimentoId);
                        await updateDoc(estabRef, {
                          cores: formData.cores,
                          atualizadoEm: serverTimestamp()
                        });
                        toast.success("🎨 Cores salvas com sucesso!");
                      } catch (error) {
                        console.error("❌ Erro ao salvar cores:", error);
                        toast.error("❌ Erro ao salvar cores");
                      }
                    };
                    handleSaveColorsInline();
                  }}
                  className="flex items-center space-x-2 text-white font-bold py-2 md:py-3 px-3 md:px-6 rounded-2xl transition-all transform hover:scale-105 shadow-lg text-xs md:text-sm"
                  style={{
                    backgroundColor: formData.cores?.primaria || '#DC2626'
                  }}
                >
                  <IoBrush className="text-lg" />
                  <span className="hidden sm:inline">Salvar Cores</span>
                </button>

                <button
                    onClick={() => setShowMobileFilters(!showMobileFilters)}
                    className="lg:hidden flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-colors shadow-lg"
                >
                    <IoFilter className="text-lg md:text-xl" />
                </button>

                <button
                    onClick={() => openItemForm()}
                    className="flex items-center space-x-2 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-bold py-2 md:py-3 px-3 md:px-6 rounded-2xl transition-all transform hover:scale-105 shadow-lg text-xs md:text-sm"
                >
                    <IoAddCircleOutline className="text-lg" />
                    <span className="hidden sm:inline">Adicionar Item</span>
                </button>
            </div>
        </div>
    );

    setActions(actions);

    // 🎯 CORREÇÃO: Retornar a função de cleanup apenas quando o componente for desmontado
    return () => {
        console.log('🧹 Componente AdminMenuManagement sendo desmontado - limpando ações do header');
        clearActions();
    };
  }, [
    viewMode, 
    stockStatistics.inactiveItems, 
    stockStatistics.activeItems,
    estabelecimentosGerenciados,
    formData.cores
  ]);

  // Estatísticas
  const estatisticas = {
    total: stockStatistics.totalItems,
    ativos: stockStatistics.activeItems,
    inativos: stockStatistics.inactiveItems,
    categorias: availableCategories.length - 1,
    estoqueCritico: stockStatistics.criticalStock,
    estoqueBaixo: stockStatistics.lowStock,
    esgotados: stockStatistics.outOfStock,
    valorTotalEstoque: stockStatistics.totalInventoryValue
  };

  // Telas de Erro e Loading
  if (!primeiroEstabelecimento) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <IoAlertCircle className="text-red-600 text-xl md:text-2xl" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-3">
            Estabelecimento Não Configurado
          </h2>
          <p className="text-gray-600 text-sm mb-6">
            Configure seu estabelecimento para começar a gerenciar o cardápio.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors w-full text-sm md:text-base"
          >
            <IoArrowBack className="text-sm" />
            <span>Voltar ao Dashboard</span>
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4">
        <div className="max-w-7xl mx-auto">
          <SkeletonLoader />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-3 md:p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 mb-6 md:mb-8">
          <div>
            <button
              onClick={() => navigate('/painel')}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-semibold mb-2 transition-colors"
            >
              <IoArrowBack className="text-lg" />
              <span>Voltar ao Painel</span>
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Gerenciar Cardápio
            </h1>
            <p className="text-gray-600">
              {establishmentName || 'Carregando...'} 
              {estabelecimentosGerenciados.length > 1 && (
                <span className="text-sm text-gray-500 ml-2">
                  (+{estabelecimentosGerenciados.length - 1} outros)
                </span>
              )}
            </p>
          </div>
        </header>

        {/* 🎨 Seção de Cores Personalizadas - CORRIGIDA */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4 md:p-6 mb-6 md:mb-8">
          <CoresPersonalizadasSection 
            formData={formData}
            setFormData={setFormData}
            estabelecimentosGerenciados={estabelecimentosGerenciados}
          />
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-4 mb-6 md:mb-8">
          <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-200 p-3 md:p-5 hover:shadow-md transition-all duration-300 hover:translate-y-[-2px]">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 uppercase tracking-wide truncate">Total Itens</p>
                <p className="text-lg md:text-2xl font-bold mt-1 md:mt-2 truncate" style={{ color: formData.cores?.primaria || '#DC2626' }}>
                  {estatisticas.total}
                </p>
              </div>
              <div className="p-2 md:p-3 rounded-lg md:rounded-xl ml-2" style={{ backgroundColor: `${formData.cores?.primaria || '#DC2626'}20` }}>
                <IoList style={{ color: formData.cores?.primaria || '#DC2626', fontSize: '1.5rem' }} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-200 p-3 md:p-5 hover:shadow-md transition-all duration-300 hover:translate-y-[-2px]">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 uppercase tracking-wide truncate">Ativos</p>
                <p className="text-lg md:text-2xl font-bold mt-1 md:mt-2 truncate" style={{ color: formData.cores?.primaria || '#DC2626' }}>
                  {estatisticas.ativos}
                </p>
              </div>
              <div className="p-2 md:p-3 rounded-lg md:rounded-xl ml-2" style={{ backgroundColor: `${formData.cores?.primaria || '#DC2626'}20` }}>
                <IoCheckmarkCircle style={{ color: formData.cores?.primaria || '#DC2626', fontSize: '1.5rem' }} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-200 p-3 md:p-5 hover:shadow-md transition-all duration-300 hover:translate-y-[-2px]">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 uppercase tracking-wide truncate">Crítico</p>
                <p className="text-lg md:text-2xl font-bold mt-1 md:mt-2 truncate" style={{ color: formData.cores?.primaria || '#DC2626' }}>
                  {estatisticas.estoqueCritico}
                </p>
              </div>
              <div className="p-2 md:p-3 rounded-lg md:rounded-xl ml-2" style={{ backgroundColor: `${formData.cores?.primaria || '#DC2626'}20` }}>
                <IoAlertCircle style={{ color: formData.cores?.primaria || '#DC2626', fontSize: '1.5rem' }} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-200 p-3 md:p-5 hover:shadow-md transition-all duration-300 hover:translate-y-[-2px]">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 uppercase tracking-wide truncate">Baixo</p>
                <p className="text-lg md:text-2xl font-bold mt-1 md:mt-2 truncate" style={{ color: formData.cores?.primaria || '#DC2626' }}>
                  {estatisticas.estoqueBaixo}
                </p>
              </div>
              <div className="p-2 md:p-3 rounded-lg md:rounded-xl ml-2" style={{ backgroundColor: `${formData.cores?.primaria || '#DC2626'}20` }}>
                <IoAlertCircle style={{ color: formData.cores?.primaria || '#DC2626', fontSize: '1.5rem' }} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-200 p-3 md:p-5 hover:shadow-md transition-all duration-300 hover:translate-y-[-2px]">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 uppercase tracking-wide truncate">Esgotados</p>
                <p className="text-lg md:text-2xl font-bold mt-1 md:mt-2 truncate" style={{ color: formData.cores?.primaria || '#DC2626' }}>
                  {estatisticas.esgotados}
                </p>
              </div>
              <div className="p-2 md:p-3 rounded-lg md:rounded-xl ml-2" style={{ backgroundColor: `${formData.cores?.primaria || '#DC2626'}20` }}>
                <IoClose style={{ color: formData.cores?.primaria || '#DC2626', fontSize: '1.5rem' }} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-200 p-3 md:p-5 hover:shadow-md transition-all duration-300 hover:translate-y-[-2px]">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 uppercase tracking-wide truncate">Valor Estoque</p>
                <p className="text-lg md:text-2xl font-bold mt-1 md:mt-2 truncate" style={{ color: formData.cores?.primaria || '#DC2626' }}>
                  R$ {(estatisticas.valorTotalEstoque || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-2 md:p-3 rounded-lg md:rounded-xl ml-2" style={{ backgroundColor: `${formData.cores?.primaria || '#DC2626'}20` }}>
                <IoCash style={{ color: formData.cores?.primaria || '#DC2626', fontSize: '1.5rem' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Pesquisa */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4 md:p-6 mb-6 md:mb-8">
          <div className="relative">
            <IoSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg md:text-xl" />
            <input
              type="text"
              placeholder="Buscar por nome, categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 md:pl-12 pr-4 py-3 md:py-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm md:text-base shadow-sm"
            />
          </div>
        </div>

        {/* Filtros Mobile */}
        <div className={`lg:hidden bg-white rounded-2xl shadow-lg border border-gray-200 mb-6 md:mb-8 transition-all duration-500 ${
          showMobileFilters ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        }`}>
          <div className="p-4 md:p-6 space-y-4 md:space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 md:mb-3">
                Categoria
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-3 md:p-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm md:text-base bg-white shadow-sm"
              >
                {availableCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 md:mb-3">
                Status do Estoque
              </label>
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                className="w-full p-3 md:p-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm md:text-base bg-white shadow-sm"
              >
                <option value="todos">Todos os Estoques</option>
                <option value="normal">Estoque Normal</option>
                <option value="baixo">Estoque Baixo</option>
                <option value="critico">Estoque Crítico</option>
                <option value="esgotado">Esgotados</option>
              </select>
            </div>
          </div>
        </div>

        {/* Filtros Desktop */}
        <div className="hidden lg:flex items-center space-x-4 md:space-x-6 bg-white rounded-2xl shadow-lg border border-gray-200 p-4 md:p-6 mb-6 md:mb-8">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2 md:mb-3">
              Categoria
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full p-3 md:p-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white shadow-sm text-sm md:text-base"
            >
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2 md:mb-3">
              Status do Estoque
            </label>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="w-full p-3 md:p-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white shadow-sm text-sm md:text-base"
            >
              <option value="todos">Todos os Estoques</option>
              <option value="normal">Estoque Normal</option>
              <option value="baixo">Estoque Baixo</option>
              <option value="critico">Estoque Crítico</option>
              <option value="esgotado">Esgotados</option>
            </select>
          </div>
        </div>

        {/* Grid de Produtos */}
        <div className="mb-6 md:mb-8">
          {paginatedItems.length > 0 ? (
            <div className={`${
              viewMode === 'grid' 
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6' 
                : 'space-y-3 md:space-y-4'
            }`}>
              {paginatedItems.map((item) => (
                viewMode === 'grid' ? (
                  <ProductGridCard
                    key={item.id}
                    produto={item}
                    onEdit={() => openItemForm(item)}
                    onDelete={() => handleDeleteItem(item)}
                    onToggleStatus={() => toggleItemStatus(item)}
                    onUpdateStock={(newStock) => quickUpdateStock(item.id, newStock)}
                    stockStatus={getStockStatus(item)}
                    profitMargin={calculateProfitMargin(item.preco, item.custo)}
                  />
                ) : (
                  <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-3 md:p-4 hover:shadow-md transition-all">
                    {/* Componente de lista pode ser adicionado aqui se necessário */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-gray-900">{item.nome}</h3>
                        <p className="text-gray-600 text-sm">{item.categoria}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-green-600 font-bold">
                          R$ {Number(item.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <button
                          onClick={() => openItemForm(item)}
                          className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-sm font-medium"
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  </div>
                )
              ))}
            </div>
          ) : (
            <div className="col-span-full bg-white rounded-2xl shadow-lg border border-gray-200 p-6 md:p-12 text-center">
              <div className="w-20 h-20 md:w-32 md:h-32 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8">
                <IoCube className="text-2xl md:text-4xl text-blue-600" />
              </div>
              <h3 className="text-xl md:text-3xl font-bold text-gray-900 mb-3 md:mb-4">
                {searchTerm || selectedCategory !== 'Todos' || stockFilter !== 'todos' 
                  ? 'Nenhum resultado encontrado'
                  : 'Seu cardápio está vazio'
                }
              </h3>
              <p className="text-gray-600 text-sm md:text-lg mb-6 md:mb-8 max-w-md mx-auto leading-relaxed">
                {searchTerm || selectedCategory !== 'Todos' || stockFilter !== 'todos' 
                  ? 'Tente ajustar os filtros ou termos de busca para encontrar o que procura.'
                  : 'Comece adicionando seus primeiros produtos para aparecerem aqui e atrair mais clientes!'
                }
              </p>
              <button
                onClick={() => openItemForm()}
                className="inline-flex items-center space-x-2 md:space-x-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 px-6 md:py-4 md:px-8 rounded-xl transition-all transform hover:scale-105 shadow-lg hover:shadow-xl text-sm md:text-lg"
              >
                <IoAddCircleOutline className="text-lg md:text-xl" />
                <span>Adicionar Primeiro Item</span>
              </button>
            </div>
          )}
        </div>

        {/* Paginação */}
        {filteredAndSortedItems.length > ITEMS_PER_PAGE && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4 md:p-6">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={goToPage}
            />
          </div>
        )}
      </div>

      {/* Modal do Formulário */}
      {showItemForm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-end lg:items-center justify-center p-0 lg:p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl lg:rounded-3xl shadow-2xl w-full lg:max-w-4xl max-h-[90vh] lg:max-h-[95vh] overflow-y-auto lg:m-auto transform transition-transform duration-300">
            {/* Header do Modal */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 sticky top-0 bg-white rounded-t-3xl">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                  {editingItem ? 'Editar Item' : 'Novo Item'}
                </h2>
                <p className="text-xs md:text-sm text-gray-600 mt-1">
                  {editingItem ? 'Atualize as informações do item' : 'Adicione um novo item ao cardápio'}
                </p>
              </div>
              <button
                onClick={closeItemForm}
                className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 text-gray-400 hover:text-gray-600 transition-colors hover:bg-gray-100 rounded-lg"
              >
                <IoClose className="text-xl md:text-2xl" />
              </button>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSaveItem} className="p-4 md:p-6 space-y-4 md:space-y-6">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Item *
                </label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleFormChange}
                  placeholder="Ex: X-Burger Especial"
                  className={`w-full p-3 md:p-4 border rounded-2xl focus:ring-2 transition-all text-sm md:text-base ${
                    formErrors.nome 
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50' 
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  required
                />
                {formErrors.nome && <p className="text-red-500 text-sm mt-2 flex items-center">
                  <IoAlertCircle className="w-4 h-4 mr-1" />
                  {formErrors.nome}
                </p>}
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição
                </label>
                <textarea
                  name="descricao"
                  value={formData.descricao}
                  onChange={handleFormChange}
                  placeholder="Descreva o item, ingredientes, etc..."
                  rows="3"
                  className="w-full p-3 md:p-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm md:text-base resize-none"
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoria *
                </label>
                <input
                  type="text"
                  name="categoria"
                  value={formData.categoria}
                  onChange={handleFormChange}
                  placeholder="Ex: Burguers"
                  list="categories-list"
                  className={`w-full p-3 md:p-4 border rounded-2xl focus:ring-2 transition-all text-sm md:text-base ${
                    formErrors.categoria 
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50' 
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  disabled={!!editingItem}
                  required
                />
                <datalist id="categories-list">
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.nome} />
                  ))}
                </datalist>
                {formErrors.categoria && <p className="text-red-500 text-sm mt-2 flex items-center">
                  <IoAlertCircle className="w-4 h-4 mr-1" />
                  {formErrors.categoria}
                </p>}
              </div>

              {/* 🆕 SEÇÃO DE PREÇO - SISTEMA HÍBRIDO */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-4 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-purple-900 flex items-center">
                    <IoCash className="mr-3 text-xl" />
                    Configuração de Preço
                  </h3>
                </div>

                {/* Opção: Produto Simples */}
                <div className="mb-4">
                  <div className="flex items-center space-x-3 p-3 bg-white rounded-xl border border-gray-200">
                    <input
                      type="radio"
                      id="preco-simples"
                      checked={variacoes.length === 1 && variacoes[0].nome === 'Padrão'}
                      onChange={() => {
                        setVariacoes([{
                          id: Date.now().toString(),
                          nome: 'Padrão',
                          preco: variacoes[0]?.preco || '',
                          descricao: '',
                          ativo: true
                        }]);
                      }}
                      className="w-4 h-4 text-blue-600"
                    />
                    <label htmlFor="preco-simples" className="flex-1">
                      <span className="font-medium text-gray-900">Produto Simples</span>
                      <p className="text-sm text-gray-600">Apenas um preço único para este produto</p>
                    </label>
                  </div>
                </div>

                {/* Opção: Produto com Variações */}
                <div className="mb-4">
                  <div className="flex items-center space-x-3 p-3 bg-white rounded-xl border border-gray-200">
                    <input
                      type="radio"
                      id="preco-variacoes"
                      checked={variacoes.length > 1 || (variacoes.length === 1 && variacoes[0].nome !== 'Padrão')}
                      onChange={() => {
                        if (variacoes.length === 1 && variacoes[0].nome === 'Padrão') {
                          setVariacoes([{
                            id: Date.now().toString(),
                            nome: 'Tamanho Único',
                            preco: variacoes[0].preco,
                            descricao: '',
                            ativo: true
                          }]);
                        }
                      }}
                      className="w-4 h-4 text-blue-600"
                    />
                    <label htmlFor="preco-variacoes" className="flex-1">
                      <span className="font-medium text-gray-900">Produto com Variações</span>
                      <p className="text-sm text-gray-600">Diferentes preços por tamanho, cor, etc.</p>
                    </label>
                  </div>
                </div>

                {/* Botão Adicionar Variação (apenas para produto com variações) */}
                {(variacoes.length > 1 || (variacoes.length === 1 && variacoes[0].nome !== 'Padrão')) && (
                  <div className="flex justify-end mb-4">
                    <button
                      type="button"
                      onClick={adicionarVariacao}
                      className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-xl transition-all text-sm"
                    >
                      <IoAddCircleOutline className="text-lg" />
                      <span>Adicionar Variação</span>
                    </button>
                  </div>
                )}

                {/* Lista de Variações */}
                <div className="space-y-4">
                  {variacoes.map((variacao, index) => (
                    <div key={variacao.id} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 md:p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-900 text-sm md:text-base">
                          Variação {index + 1}
                        </h4>
                        {variacoes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removerVariacao(variacao.id)}
                            className="text-red-500 hover:text-red-700 transition-colors p-1"
                          >
                            <IoClose className="w-5 h-5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Nome - Oculto no modo simples */}
                        {(variacoes.length > 1 || (variacoes.length === 1 && variacao.nome !== 'Padrão')) && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Nome da Variação *
                            </label>
                            <input
                              type="text"
                              value={variacao.nome}
                              onChange={(e) => atualizarVariacao(variacao.id, 'nome', e.target.value)}
                              placeholder="Ex: Pequeno, Médio, Grande"
                              className="w-full p-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
                            />
                            {variacoesErrors[variacao.id]?.nome && <p className="text-red-500 text-xs mt-1">{variacoesErrors[variacao.id].nome}</p>}
                          </div>
                        )}

                        {/* Preço */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {(variacoes.length === 1 && variacao.nome === 'Padrão') ? 'Preço do Produto *' : 'Preço *'}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={variacao.preco}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                atualizarVariacao(variacao.id, 'preco', value);
                              }
                            }}
                            placeholder="0.00"
                            className="w-full p-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
                          />
                          {variacoesErrors[variacao.id]?.preco && <p className="text-red-500 text-xs mt-1">{variacoesErrors[variacao.id].preco}</p>}
                          
                          {/* MENSAGEM "A PARTIR DE" APENAS PARA VARIAÇÕES */}
                          {variacoes.length > 1 && index === 0 && (
                            <p className="text-xs text-blue-600 mt-1">
                              Os clientes verão "A partir de R$ X,XX"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Descrição - Oculto no modo simples */}
                      {(variacoes.length > 1 || (variacoes.length === 1 && variacao.nome !== 'Padrão')) && (
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Descrição da Variação
                          </label>
                          <textarea
                            value={variacao.descricao}
                            onChange={(e) => atualizarVariacao(variacao.id, 'descricao', e.target.value)}
                            placeholder="Descreva esta variação..."
                            rows="2"
                            className="w-full p-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base resize-none"
                          />
                        </div>
                      )}

                      {/* Checkbox Ativo - Oculto no modo simples */}
                      {(variacoes.length > 1 || (variacoes.length === 1 && variacao.nome !== 'Padrão')) && (
                        <div className="flex items-center space-x-3 mt-4">
                          <input
                            type="checkbox"
                            checked={variacao.ativo}
                            onChange={(e) => atualizarVariacao(variacao.id, 'ativo', e.target.checked)}
                            className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                          />
                          <label className="text-sm text-gray-700">
                            Variação ativa no cardápio
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {formErrors.variacoes && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mt-4">
                    <p className="text-red-700 text-sm flex items-center">
                      <IoAlertCircle className="w-4 h-4 mr-2" />
                      {formErrors.variacoes}
                    </p>
                  </div>
                )}
              </div>

              {/* Seção de Estoque */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 md:p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                  <IoStatsChart className="mr-3 text-xl" />
                  Controle de Estoque
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Estoque Atual
                    </label>
                    <input
                      type="number"
                      name="estoque"
                      value={formData.estoque}
                      onChange={handleFormChange}
                      placeholder="0"
                      className="w-full p-3 md:p-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm md:text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Estoque Mínimo
                    </label>
                    <input
                      type="number"
                      name="estoqueMinimo"
                      value={formData.estoqueMinimo}
                      onChange={handleFormChange}
                      placeholder="5"
                      className="w-full p-3 md:p-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm md:text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custo (R$)
                    </label>
                    <input
                      type="number"
                      name="custo"
                      step="0.01"
                      value={formData.custo}
                      onChange={handleFormChange}
                      placeholder="0.00"
                      className="w-full p-3 md:p-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm md:text-base"
                    />
                  </div>
                </div>
              </div>

              {/* Imagem */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Imagem do Item
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-6">
                  <div className="flex-shrink-0">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover border-2 border-blue-200 shadow-sm"
                      />
                    ) : (
                      <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 bg-gray-50">
                        <IoImageOutline className="text-2xl md:text-3xl" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFormChange}
                      className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-3 md:file:py-3 md:file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors"
                    />
                    {formErrors.image && (
                      <p className="text-red-500 text-sm mt-2 flex items-center">
                        <IoAlertCircle className="w-4 h-4 mr-1" />
                        {formErrors.image}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      PNG, JPG, WEBP até 5MB. Recomendado: 500x500px
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Ativo */}
              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                <input
                  name="ativo"
                  type="checkbox"
                  checked={formData.ativo}
                  onChange={handleFormChange}
                  className="w-4 h-4 md:w-5 md:h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Item ativo no cardápio
                  </label>
                  <p className="text-xs text-gray-500">
                    Clientes poderão ver e pedir este item
                  </p>
                </div>
              </div>

              {editingItem && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
                  <p className="text-sm text-yellow-800 flex items-center">
                    <IoAlertCircle className="w-4 h-4 mr-2" />
                    <strong>Atenção:</strong> A categoria não pode ser alterada após a criação do item.
                    Para mover entre categorias, exclua e recrie o item.
                  </p>
                </div>
              )}

              {/* Botões */}
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 pt-4 md:pt-6 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 md:py-4 px-6 rounded-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2 md:space-x-3 shadow-lg text-sm md:text-base"
                >
                  {formLoading ? (
                    <>
                      <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <IoSaveOutline className="text-lg md:text-xl" />
                      <span>{editingItem ? 'Salvar Alterações' : 'Adicionar Item'}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={closeItemForm}
                  className="px-6 md:px-8 py-3 md:py-4 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-xl font-bold transition-all transform hover:scale-105 flex items-center justify-center space-x-2 shadow-lg text-sm md:text-base"
                >
                  <IoClose className="text-lg md:text-xl" />
                  <span>Cancelar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ativar Todos */}
      {showActivateAllModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4">
            <div className="text-center p-6">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <IoRefresh className="text-green-600 text-xl md:text-2xl" />
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                Ativar Todos os Itens
              </h3>
              <p className="text-gray-600 text-sm md:text-base mb-6">
                Esta ação irá ativar todos os itens do cardápio que estão atualmente desativados. 
                Deseja continuar?
              </p>
              
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                <button
                  onClick={() => setShowActivateAllModal(false)}
                  disabled={bulkOperationLoading}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 text-sm md:text-base"
                >
                  Cancelar
                </button>
                <button
                  onClick={activateAllItems}
                  disabled={bulkOperationLoading}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 text-sm md:text-base"
                >
                  {bulkOperationLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Ativando...</span>
                    </>
                  ) : (
                    <>
                      <IoCheckmarkCircle className="text-lg" />
                      <span>Ativar Todos</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ajuste de Preços em Massa */}
      {showBulkPriceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4">
            <div className="text-center p-6">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <IoCash className="text-blue-600 text-xl md:text-2xl" />
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                Ajuste de Preços em Massa
              </h3>
              <p className="text-gray-600 text-sm md:text-base mb-6">
                Ajuste o preço de todos os itens ativos por uma porcentagem.
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Tipo de Ajuste
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {/* Implementar lógica de aumento */}}
                      className="py-3 px-4 rounded-xl border-2 border-green-500 bg-green-100 text-green-700 font-bold text-sm md:text-base"
                    >
                      Aumentar
                    </button>
                    <button
                      type="button"
                      onClick={() => {/* Implementar lógica de redução */}}
                      className="py-3 px-4 rounded-xl border-2 border-red-500 bg-red-100 text-red-700 font-bold text-sm md:text-base"
                    >
                      Reduzir
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Porcentagem (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="100"
                    placeholder="Ex: 10.5"
                    className="w-full p-3 md:p-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base md:text-lg text-center"
                    required
                  />
                </div>

                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowBulkPriceModal(false)}
                    disabled={bulkOperationLoading}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 text-sm md:text-base"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={bulkOperationLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center space-x-2 text-sm md:text-base"
                  >
                    {bulkOperationLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Aplicando...</span>
                      </>
                    ) : (
                      <>
                        <IoPlayForward className="text-lg" />
                        <span>Aplicar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default withEstablishmentAuth(AdminMenuManagement);