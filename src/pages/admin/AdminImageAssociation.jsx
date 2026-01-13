// src/pages/admin/AdminImageAssociation.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { uploadImageAndUpdateProduct } from '../../utils/firebaseStorageService';
import { 
  FaUpload, 
  FaStore, 
  FaSpinner, 
  FaImage,
  FaSearch,
  FaArrowLeft
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// Componente de Card de Produto
const ProductCard = ({ item, onImageUpload, uploadingItemId }) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem é muito grande. O limite é 5MB.");
      return;
    }

    setIsUploading(true);
    try {
      await onImageUpload(item.id, item.categoriaId, file);
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const isUploadingThisItem = isUploading || uploadingItemId === item.id;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      {/* Imagem do Produto */}
      <div className="mb-3">
        <img 
          src={item.imageUrl || '/images/placeholder-food.jpg'} 
          alt={item.nome} 
          className="flex-col sm:flex-row h-32 object-cover rounded border border-gray-200"
          onError={(e) => {
            e.target.src = '/images/placeholder-food.jpg';
          }}
        />
      </div>

      {/* Informações do Produto */}
      <div className="mb-3">
        <h3 className="font-semibold text-gray-900 text-sm mb-1">
          {item.nome}
        </h3>
        <div className="flex justify-between items-center">
          <span className="text-green-600 font-bold">
            R$ {item.preco?.toFixed(2) || '0,00'}
          </span>
        </div>
      </div>

      {/* Botão de Upload */}
      <label 
        htmlFor={`file-${item.id}`}
        className={`flex items-center justify-center space-x-2 flex-col sm:flex-row px-3 py-2 rounded text-sm font-medium cursor-pointer ${
          isUploadingThisItem
            ? 'bg-gray-400 text-white cursor-not-allowed'
            : 'bg-yellow-500 text-white hover:bg-yellow-600'
        }`}
      >
        {isUploadingThisItem ? (
          <>
            <FaSpinner className="animate-spin" />
            <span>Enviando...</span>
          </>
        ) : (
          <>
            <FaUpload size={14} />
            <span>Trocar Imagem</span>
          </>
        )}
      </label>
      <input 
        type="file" 
        id={`file-${item.id}`}
        className="hidden"
        accept="image/png, image/jpeg, image/jpg, image/webp"
        onChange={handleFileChange}
        disabled={isUploadingThisItem}
      />
    </div>
  );
};

// Função para formatar endereço
const formatarEndereco = (endereco) => {
  if (!endereco) return 'Endereço não disponível';
  
  if (typeof endereco === 'string') return endereco;
  
  // Se for objeto
  const partes = [];
  if (endereco.rua) partes.push(endereco.rua);
  if (endereco.numero) partes.push(endereco.numero);
  if (endereco.bairro) partes.push(endereco.bairro);
  if (endereco.cidade) partes.push(endereco.cidade);
  
  return partes.join(', ') || 'Endereço não disponível';
};

function AdminImageAssociation() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [estabelecimentos, setEstabelecimentos] = useState([]);
  const [selectedEstabelecimentoId, setSelectedEstabelecimentoId] = useState('');
  const [cardapio, setCardapio] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchEstabelecimentos = async () => {
      try {
        const q = query(collection(db, 'estabelecimentos'), orderBy('nome'));
        const querySnapshot = await getDocs(q);
        setEstabelecimentos(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Erro ao carregar estabelecimentos:", error);
        toast.error('Erro ao carregar estabelecimentos.');
      }
    };
    fetchEstabelecimentos();
  }, []);

  useEffect(() => {
    if (!selectedEstabelecimentoId) {
      setCardapio([]);
      return;
    }

    const fetchCardapio = async () => {
      setLoading(true);
      try {
        const categoriasRef = collection(db, 'estabelecimentos', selectedEstabelecimentoId, 'cardapio');
        const qCategorias = query(categoriasRef, orderBy('ordem', 'asc'));
        const categoriasSnapshot = await getDocs(qCategorias);

        let fullMenu = [];
        for (const catDoc of categoriasSnapshot.docs) {
          const categoriaData = catDoc.data();
          const itensRef = collection(db, 'estabelecimentos', selectedEstabelecimentoId, 'cardapio', catDoc.id, 'itens');
          const itensSnapshot = await getDocs(itensRef);
          const itens = itensSnapshot.docs.map(itemDoc => ({
            ...itemDoc.data(),
            id: itemDoc.id,
            categoriaId: catDoc.id,
            categoriaNome: categoriaData.nome
          }));
          fullMenu.push({ ...categoriaData, id: catDoc.id, itens });
        }
        setCardapio(fullMenu);
      } catch (error) {
        toast.error("Erro ao carregar o cardápio.");
        console.error(error);
      }
      setLoading(false);
    };

    fetchCardapio();
  }, [selectedEstabelecimentoId]);

  const handleImageUpload = async (itemId, categoriaId, file) => {
    if (!file) return;
    
    setUploadingItemId(itemId);
    try {
      const newImageUrl = await uploadImageAndUpdateProduct(selectedEstabelecimentoId, categoriaId, itemId, file);
      
      setCardapio(prevCardapio => 
        prevCardapio.map(cat => ({
          ...cat,
          itens: cat.itens.map(item => 
            item.id === itemId ? { ...item, imageUrl: newImageUrl } : item
          )
        }))
      );
      toast.success("Imagem enviada com sucesso!");
    } catch (error) {
      toast.error("Falha ao enviar a imagem.");
      console.error("Erro no upload:", error);
    } finally {
      setUploadingItemId(null);
    }
  };

  // Filtrar produtos
  const filteredCardapio = cardapio.map(categoria => ({
    ...categoria,
    itens: categoria.itens.filter(item => 
      item.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(categoria => categoria.itens.length > 0);

  const selectedEstabelecimento = estabelecimentos.find(e => e.id === selectedEstabelecimentoId);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo e Voltar */}
            <div className="flex items-center space-x-6">
              <button
                onClick={() => navigate('/master-dashboard')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
              >
                <FaArrowLeft size={16} />
                <span className="font-medium">VOLTAR</span>
              </button>
              
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold text-gray-900">DEU FOME</h1>
                <span className="text-yellow-500 text-2xl font-bold">.</span>
              </div>
            </div>

            {/* Título da Página */}
            <div className="text-right">
              <h2 className="text-lg font-semibold text-gray-700">DEU FOME - Associar Imagens</h2>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Cabeçalho do Conteúdo */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Gerenciar Imagens dos Produtos
          </h1>
          <p className="text-gray-600">
            Faça upload e associe imagens aos produtos do cardápio
          </p>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Estabelecimento */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <FaStore className="mr-2 text-yellow-600" size={16} />
              Estabelecimento
            </h3>
            <select
              value={selectedEstabelecimentoId}
              onChange={(e) => setSelectedEstabelecimentoId(e.target.value)}
              className="flex-col sm:flex-row px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 bg-white"
            >
              <option value="">Selecione um estabelecimento</option>
              {estabelecimentos.map(est => (
                <option key={est.id} value={est.id}>{est.nome}</option>
              ))}
            </select>
          </div>

          {/* Buscar Produtos */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <FaSearch className="mr-2 text-yellow-600" size={16} />
              Buscar Produtos
            </h3>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-col sm:flex-row pl-3 pr-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                disabled={!selectedEstabelecimentoId}
              />
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <FaSpinner className="text-yellow-500 text-2xl animate-spin mb-3" />
            <p className="text-gray-600">Carregando cardápio...</p>
          </div>
        )}

        {/* Estabelecimento Info */}
        {selectedEstabelecimento && !loading && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900 text-lg">
                  {selectedEstabelecimento.nome}
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  {formatarEndereco(selectedEstabelecimento.endereco)}
                </p>
              </div>
              <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                {cardapio.length} categorias • {cardapio.reduce((total, cat) => total + cat.itens.length, 0)} produtos
              </span>
            </div>
          </div>
        )}

        {/* Lista de Produtos */}
        {!loading && selectedEstabelecimentoId && (
          <div className="space-y-8">
            {filteredCardapio.length === 0 ? (
              <div className="text-center py-8 bg-white border border-gray-200 rounded-lg">
                <FaImage className="text-gray-300 text-2xl mx-auto mb-3" />
                <p className="text-gray-500">
                  {searchTerm ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}
                </p>
              </div>
            ) : (
              filteredCardapio.map(categoria => (
                <div key={categoria.id} className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900">
                      {categoria.nome}
                    </h2>
                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded">
                      {categoria.itens.length} {categoria.itens.length === 1 ? 'item' : 'itens'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {categoria.itens.map(item => (
                      <ProductCard
                        key={item.id}
                        item={item}
                        onImageUpload={handleImageUpload}
                        uploadingItemId={uploadingItemId}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Estado Inicial */}
        {!selectedEstabelecimentoId && !loading && (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
            <FaStore className="text-gray-300 text-2xl mx-auto mb-3" />
            <p className="text-gray-500">Selecione um estabelecimento para começar</p>
            <p className="text-gray-400 text-sm mt-2">
              Escolha um estabelecimento na lista acima para visualizar e gerenciar as imagens dos produtos
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminImageAssociation;