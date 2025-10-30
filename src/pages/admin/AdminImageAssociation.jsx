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
  FaFilter
} from 'react-icons/fa';

// Componente de Header
function DashboardHeader({ currentUser, logout, navigate }) {
  const userEmailPrefix = currentUser.email ? currentUser.email.split('@')[0] : 'Admin';

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logout realizado com sucesso!');
      navigate('/');
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      toast.error('Erro ao fazer logout.');
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div 
            className="flex items-center space-x-3 cursor-pointer group"
            onClick={() => navigate('/')}
          >
            <div className="bg-yellow-500 w-10 h-10 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-black font-bold text-xl">D</span>
            </div>
            <div>
              <span className="text-gray-900 font-bold text-2xl group-hover:text-yellow-600 transition-colors duration-300">
                DEU FOME
              </span>
              <span className="block text-xs text-gray-500 font-medium">ASSOCIAR IMAGENS</span>
            </div>
          </div>

          {/* User Info and Actions */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-3 bg-gray-50 rounded-lg px-4 py-2">
              <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center shadow-sm">
                <span className="text-black font-bold text-sm">A</span>
              </div>
              <div className="text-right">
                <p className="text-gray-900 text-sm font-semibold">Administrador</p>
                <p className="text-gray-500 text-xs">{userEmailPrefix}</p>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all duration-300 transform hover:scale-105 shadow-sm"
            >
              <span className="text-sm font-medium">Sair</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

// Componente de Card de Produto
const ProductCard = ({ item, onImageUpload, uploadingItemId, selectedEstabelecimentoId }) => {
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
      // Reset do input
      event.target.value = '';
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1">
      <div className="flex flex-col h-full">
        {/* Imagem do Produto */}
        <div className="relative mb-4">
          <img 
            src={item.imageUrl || 'https://via.placeholder.com/300x200?text=Sem+Imagem'} 
            alt={item.nome} 
            className="w-full h-48 object-cover rounded-xl bg-gray-100"
            onError={(e) => {
              e.target.src = 'https://via.placeholder.com/300x200?text=Sem+Imagem';
            }}
          />
          {!item.imageUrl && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-xl">
              <FaImage className="text-gray-400 text-3xl" />
            </div>
          )}
        </div>

        {/* Informações do Produto */}
        <div className="flex-grow mb-4">
          <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2">
            {item.nome}
          </h3>
          {item.descricao && (
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">
              {item.descricao}
            </p>
          )}
          <div className="flex justify-between items-center">
            <span className="text-xl font-bold text-green-600">
              R$ {item.preco?.toFixed(2) || '0,00'}
            </span>
            {item.categoriaNome && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {item.categoriaNome}
              </span>
            )}
          </div>
        </div>

        {/* Botão de Upload */}
        <div>
          <label 
            htmlFor={`file-${item.id}`}
            className={`flex items-center justify-center space-x-2 w-full px-4 py-3 rounded-xl font-semibold transition-all duration-300 cursor-pointer ${
              isUploading || uploadingItemId === item.id
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-yellow-500 text-white hover:bg-yellow-600 transform hover:scale-105'
            }`}
          >
            {isUploading || uploadingItemId === item.id ? (
              <>
                <FaSpinner className="animate-spin" />
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <FaUpload />
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
            disabled={isUploading || uploadingItemId === item.id}
          />
        </div>
      </div>
    </div>
  );
};

// Componente de Filtro
const FilterCard = ({ title, children }) => (
  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
      <FaFilter className="mr-2 text-yellow-600" />
      {title}
    </h3>
    {children}
  </div>
);

function AdminImageAssociation() {
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
      
      // Atualiza a URL da imagem no estado local
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

  // Filtrar produtos por termo de busca
  const filteredCardapio = cardapio.map(categoria => ({
    ...categoria,
    itens: categoria.itens.filter(item => 
      item.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(categoria => categoria.itens.length > 0);

  const selectedEstabelecimento = estabelecimentos.find(e => e.id === selectedEstabelecimentoId);

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-8 px-4">
      <DashboardHeader currentUser={{}} logout={() => {}} navigate={() => {}} />

      <main className="max-w-7xl mx-auto">
        {/* Header da Página */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Associar Imagens aos Produtos
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Faça upload e vincule fotos aos produtos do cardápio
          </p>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <FilterCard title="Selecionar Estabelecimento">
            <div className="flex items-center space-x-3">
              <FaStore className="text-gray-400 text-xl" />
              <select
                value={selectedEstabelecimentoId}
                onChange={(e) => setSelectedEstabelecimentoId(e.target.value)}
                className="flex-grow px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all duration-300 bg-white"
              >
                <option value="">Selecione um estabelecimento</option>
                {estabelecimentos.map(est => (
                  <option key={est.id} value={est.id}>{est.nome}</option>
                ))}
              </select>
            </div>
          </FilterCard>

          <FilterCard title="Buscar Produtos">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all duration-300"
                disabled={!selectedEstabelecimentoId}
              />
            </div>
          </FilterCard>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <FaSpinner className="text-yellow-500 text-4xl animate-spin mb-4" />
            <p className="text-gray-600 text-lg">Carregando cardápio...</p>
          </div>
        )}

        {/* Estabelecimento Selecionado */}
        {selectedEstabelecimento && !loading && (
          <div className="bg-white rounded-2xl p-6 mb-6 border border-gray-200 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {selectedEstabelecimento.nome}
            </h2>
            <p className="text-gray-600">
              {selectedEstabelecimento.endereco && `${selectedEstabelecimento.endereco} • `}
              Total de categorias: {cardapio.length}
            </p>
          </div>
        )}

        {/* Lista de Produtos */}
        {!loading && selectedEstabelecimentoId && (
          <div className="space-y-8">
            {filteredCardapio.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
                <FaImage className="text-gray-300 text-4xl mx-auto mb-4" />
                <p className="text-gray-500 text-lg">
                  {searchTerm ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  {searchTerm ? 'Tente ajustar os termos da busca' : 'Adicione produtos ao cardápio primeiro'}
                </p>
              </div>
            ) : (
              filteredCardapio.map(categoria => (
                <div key={categoria.id} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {categoria.nome}
                    </h2>
                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      {categoria.itens.length} produto{categoria.itens.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {categoria.itens.map(item => (
                      <ProductCard
                        key={item.id}
                        item={item}
                        onImageUpload={handleImageUpload}
                        uploadingItemId={uploadingItemId}
                        selectedEstabelecimentoId={selectedEstabelecimentoId}
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
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
            <FaStore className="text-gray-300 text-4xl mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Selecione um estabelecimento para começar</p>
            <p className="text-gray-400 text-sm mt-2">
              Escolha um estabelecimento na lista acima para visualizar e gerenciar as imagens dos produtos
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminImageAssociation;