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
  FaSearch, 
  FaArrowLeft, 
  FaSignOutAlt,
  FaImage,
  FaCamera
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// --- Header Minimalista (Reutilizado) ---
const DashboardHeader = ({ navigate, logout, currentUser }) => {
  const userEmailPrefix = currentUser?.email ? currentUser.email.split('@')[0] : 'Admin';
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 h-16 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex justify-between items-center">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
           <div className="flex items-center gap-1">
              <div className="bg-yellow-400 text-black font-bold p-1 rounded-sm transform -skew-x-12">
                  <FaStore />
              </div>
              <span className="text-gray-900 font-extrabold text-xl tracking-tight">
                  Na<span className="text-yellow-500">Mão</span>
              </span>
          </div>
        </div>
        <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-semibold text-gray-800">{userEmailPrefix}</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Master Admin</span>
            </div>
            <button 
                onClick={logout} 
                className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
                title="Sair"
            >
              <FaSignOutAlt />
            </button>
          </div>
      </div>
    </header>
  );
};

// --- Componente de Card de Produto ---
const ProductCard = ({ item, onImageUpload, uploadingItemId }) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Limite de 5MB excedido.");
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
    <div className="group bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-lg transition-all duration-300 flex flex-col h-full">
      {/* Área da Imagem */}
      <div className="relative aspect-square mb-4 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 group-hover:border-yellow-200 transition-colors">
        {item.imageUrl ? (
            <img 
              src={item.imageUrl} 
              alt={item.nome} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={(e) => { e.target.src = 'https://placehold.co/400x400?text=Sem+Imagem'; }}
            />
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-300">
                <FaImage className="text-3xl mb-2" />
                <span className="text-xs">Sem foto</span>
            </div>
        )}
        
        {/* Overlay de Upload */}
        <label 
            htmlFor={`file-${item.id}`}
            className={`absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isUploadingThisItem ? 'opacity-100 bg-black/80' : ''}`}
        >
            {isUploadingThisItem ? (
                <>
                    <FaSpinner className="animate-spin text-2xl mb-2" />
                    <span className="text-xs font-bold">Enviando...</span>
                </>
            ) : (
                <>
                    <FaCamera className="text-2xl mb-2" />
                    <span className="text-xs font-bold">Alterar Foto</span>
                </>
            )}
        </label>
        <input 
            type="file" 
            id={`file-${item.id}`}
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
            disabled={isUploadingThisItem}
        />
      </div>

      {/* Infos */}
      <div className="mt-auto">
        <h3 className="font-bold text-gray-900 text-sm mb-1 leading-tight line-clamp-2" title={item.nome}>
          {item.nome}
        </h3>
        <p className="text-xs text-gray-500 font-medium">
           R$ {item.preco?.toFixed(2).replace('.', ',') || '0,00'}
        </p>
      </div>
    </div>
  );
};

// Função helper
const formatarEndereco = (endereco) => {
  if (!endereco) return 'Endereço não disponível';
  if (typeof endereco === 'string') return endereco;
  const partes = [];
  if (endereco.rua) partes.push(endereco.rua);
  if (endereco.numero) partes.push(endereco.numero);
  if (endereco.bairro) partes.push(endereco.bairro);
  return partes.join(', ') || 'Endereço não disponível';
};

function AdminImageAssociation() {
  const navigate = useNavigate();
  const { currentUser, logout, isMasterAdmin, loading: authLoading } = useAuth();
  
  const [estabelecimentos, setEstabelecimentos] = useState([]);
  const [selectedEstabelecimentoId, setSelectedEstabelecimentoId] = useState('');
  const [cardapio, setCardapio] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // --- CARREGAMENTO INICIAL ---
  useEffect(() => {
    if (!authLoading) {
        if (!currentUser || !isMasterAdmin) {
            navigate('/master-dashboard');
            return;
        }
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  useEffect(() => {
    const fetchEstabelecimentos = async () => {
      try {
        const q = query(collection(db, 'estabelecimentos'), orderBy('nome'));
        const querySnapshot = await getDocs(q);
        setEstabelecimentos(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        toast.error('Erro ao carregar estabelecimentos.');
      }
    };
    if (isMasterAdmin) fetchEstabelecimentos();
  }, [isMasterAdmin]);

  // --- CARREGAR CARDÁPIO ---
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
        console.error(error);
        toast.error("Erro ao carregar cardápio.");
      }
      setLoading(false);
    };

    fetchCardapio();
  }, [selectedEstabelecimentoId]);

  // --- HANDLER UPLOAD ---
  const handleImageUpload = async (itemId, categoriaId, file) => {
    if (!file) return;
    setUploadingItemId(itemId);
    try {
      const newImageUrl = await uploadImageAndUpdateProduct(selectedEstabelecimentoId, categoriaId, itemId, file);
      setCardapio(prev => prev.map(cat => ({
          ...cat,
          itens: cat.itens.map(item => item.id === itemId ? { ...item, imageUrl: newImageUrl } : item)
      })));
      toast.success("Imagem atualizada!");
    } catch (error) {
      toast.error("Erro no envio.");
    } finally {
      setUploadingItemId(null);
    }
  };

  // --- FILTRO ---
  const filteredCardapio = cardapio.map(categoria => ({
    ...categoria,
    itens: categoria.itens.filter(item => 
      item.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.descricao && item.descricao.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  })).filter(categoria => categoria.itens.length > 0);

  const selectedEstabelecimento = estabelecimentos.find(e => e.id === selectedEstabelecimentoId);

  if (authLoading) return <div className="flex h-screen items-center justify-center bg-gray-50"><div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="bg-gray-50 min-h-screen pt-20 pb-12 px-4 sm:px-6 font-sans text-gray-900">
      <DashboardHeader navigate={navigate} logout={logout} currentUser={currentUser} />

      <div className="max-w-7xl mx-auto">
        
        {/* Header da Página */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
                <button onClick={() => navigate('/master-dashboard')} className="text-gray-400 hover:text-gray-600 flex items-center gap-2 mb-2 text-sm font-medium transition-colors">
                    <FaArrowLeft /> Voltar ao Dashboard
                </button>
                <h1 className="text-3xl font-bold tracking-tight">Galeria de Produtos</h1>
                <p className="text-gray-500 text-sm mt-1">Gerencie as fotos dos itens do cardápio.</p>
            </div>
        </div>

        {/* Barra de Ferramentas (Filtros) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-8 flex flex-col md:flex-row gap-4">
            
            {/* Select Estabelecimento */}
            <div className="relative min-w-[280px]">
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Loja</label>
                <div className="relative">
                    <FaStore className="absolute left-4 top-3.5 text-gray-300" />
                    <select
                        value={selectedEstabelecimentoId}
                        onChange={(e) => setSelectedEstabelecimentoId(e.target.value)}
                        className="w-full pl-10 pr-8 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white text-sm appearance-none cursor-pointer font-medium"
                    >
                        <option value="">Selecione uma loja...</option>
                        {estabelecimentos.map(est => (
                            <option key={est.id} value={est.id}>{est.nome}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Input Busca */}
            <div className="flex-1 relative">
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Buscar Produto</label>
                <div className="relative">
                    <FaSearch className="absolute left-4 top-3.5 text-gray-300" />
                    <input 
                        type="text" 
                        placeholder="Nome do produto..." 
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={!selectedEstabelecimentoId}
                    />
                </div>
            </div>
        </div>

        {/* Loading */}
        {loading && (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-12 h-12 border-4 border-gray-200 border-t-yellow-400 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-500 font-medium">Carregando cardápio...</p>
            </div>
        )}

        {/* Estado Vazio (Sem Seleção) */}
        {!selectedEstabelecimentoId && !loading && (
            <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-gray-200">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300 text-2xl">
                    <FaCamera />
                </div>
                <h3 className="text-lg font-bold text-gray-700">Nenhuma loja selecionada</h3>
                <p className="text-gray-400 text-sm mt-1">Escolha um estabelecimento acima para começar.</p>
            </div>
        )}

        {/* Conteúdo Principal */}
        {!loading && selectedEstabelecimentoId && (
            <div>
                {/* Resumo da Loja */}
                <div className="mb-8 px-2">
                    <h2 className="text-2xl font-bold text-gray-900">{selectedEstabelecimento.nome}</h2>
                    <p className="text-gray-500 text-sm">{formatarEndereco(selectedEstabelecimento.endereco)}</p>
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-yellow-50 text-yellow-700 rounded-lg text-xs font-bold">
                        <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                        {cardapio.reduce((acc, cat) => acc + cat.itens.length, 0)} produtos cadastrados
                    </div>
                </div>

                {/* Grid de Categorias e Produtos */}
                <div className="space-y-10">
                    {filteredCardapio.length === 0 ? (
                        <div className="text-center py-16">
                            <p className="text-gray-400 font-medium">Nenhum produto encontrado com este filtro.</p>
                        </div>
                    ) : (
                        filteredCardapio.map(categoria => (
                            <div key={categoria.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 px-2 border-l-4 border-yellow-400 pl-3">
                                    {categoria.nome}
                                    <span className="ml-2 text-xs font-normal text-gray-400">({categoria.itens.length})</span>
                                </h3>
                                
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
            </div>
        )}

      </div>
    </div>
  );
}

export default AdminImageAssociation;