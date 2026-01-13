// src/pages/AdminMenuManagement.jsx - VERSÃO COMPLETA E FINAL COM CUSTO POR VARIAÇÃO
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
import {
    IoArrowBack,
    IoAddCircleOutline,
    IoSearch,
    IoFilter,
    IoClose,
    IoImageOutline,
    IoCheckmarkCircle,
    IoAlertCircle,
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
    IoRefresh
} from 'react-icons/io5';

// 🎨 Componente Skeleton Loader em Grid
const SkeletonLoader = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 animate-pulse">
        <div className="flex flex-col space-y-3">
          <div className="flex-col sm:flex-row h-40 md:h-48 bg-gray-300 rounded-xl"></div>
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
  stockStatus, 
  profitMargin 
}) => {
  const stockConfig = {
    normal: { color: 'bg-green-100 text-green-800 border-green-200', icon: IoCheckmarkCircle },
    baixo: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: IoAlertCircle },
    critico: { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: IoAlertCircle },
    esgotado: { color: 'bg-red-100 text-red-800 border-red-200', icon: IoClose }
  };

  const { color, icon: Icon } = stockConfig[stockStatus] || stockConfig.normal;

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

    if (variacoesAtivas.length === 1) {
      const preco = Number(variacoesAtivas[0].preco);
      return (
        <p className="text-xl md:text-2xl font-bold text-green-600">
          R$ {preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      );
    }

    const menorPreco = Math.min(...variacoesAtivas.map(v => Number(v.preco)));

    return (
      <div className="space-y-1">
        <div className="text-xs text-gray-600 font-medium">
          {variacoesAtivas.length} opções
        </div>
        <div className="text-sm text-green-600 font-semibold leading-tight">
          A partir de R$ {menorPreco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
            className="flex-col sm:flex-row h-40 md:h-48 object-cover rounded-t-2xl"
          />
        ) : (
          <div className="flex-col sm:flex-row h-40 md:h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-2xl flex items-center justify-center">
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

        {/* Badge de Múltiplas Variações */}
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

        {/* Preço */}
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
            {/* Exibe o estoque total calculado das variações */}
            <p className="text-lg font-semibold text-gray-900">{produto.estoque}</p>
            <p className="text-xs text-gray-500">estoque total</p>
          </div>
        </div>

        {/* ✅ REMOVIDO: Controle Rápido de Estoque - A gestão deve ser feita no modal */}
        <div className="mb-4 md:mb-5"></div>


        {/* Ações */}
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

// Componente Auxiliar para Estatísticas
const StatsCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white rounded-xl md:rounded-2xl shadow-sm border border-gray-200 p-3 md:p-5 hover:shadow-md transition-all duration-300 hover:translate-y-[-2px]">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs md:text-sm font-medium text-gray-600 uppercase tracking-wide truncate">{title}</p>
          <p className="text-lg md:text-2xl font-bold mt-1 md:mt-2 truncate" style={{ color: color }}>
            {value}
          </p>
        </div>
        <div className="p-2 md:p-3 rounded-lg md:rounded-xl ml-2" style={{ backgroundColor: `${color}20` }}>
          <Icon style={{ color: color, fontSize: '1.5rem' }} />
          </div>
        </div>
    </div>
);

function AdminMenuManagement() {
  const { userData } = useAuth();
  const { setActions, clearActions } = useHeader();
  const navigate = useNavigate();

  const [establishmentName, setEstablishmentName] = useState('');
  const [brandColor, setBrandColor] = useState('#DC2626'); // Cor apenas para leitura/UI
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
  
  // ✅ ATUALIZADO: Removido estoque e estoqueMinimo do formData
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    categoria: '',
    imageUrl: '',
    ativo: true,
    // Custo removido daqui para ser definido por variação
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
    // ✅ ATUALIZADO: Nova variação inclui estoque, estoqueMinimo e CUSTO
    const novaVariacao = {
      id: Date.now().toString(),
      nome: '',
      preco: '',
      descricao: '',
      ativo: true,
      estoque: 0, 
      estoqueMinimo: 0,
      custo: 0 // NOVO: Custo por variação
    };
    setVariacoes([...variacoes, novaVariacao]);
  };

  const atualizarVariacao = (id, field, value) => {
    // Trata estoque/minimo/custo como número
    const finalValue = (field === 'estoque' || field === 'estoqueMinimo' || field === 'custo') ? (Number(value) || 0) : value;
    
    setVariacoes(variacoes.map(v => 
      v.id === id ? { ...v, [field]: finalValue } : v
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

  const estabelecimentosGerenciados = useMemo(() => {
    return userData?.estabelecimentosGerenciados || [];
  }, [userData]);

  const primeiroEstabelecimento = estabelecimentosGerenciados[0];

  // Busca dados do estabelecimento (apenas para pegar a cor e nome)
  useEffect(() => {
    if (primeiroEstabelecimento) {
      const fetchEstablishmentData = async () => {
        try {
          const estabDoc = await getDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento));
          if (estabDoc.exists()) {
            const data = estabDoc.data();
            setEstablishmentName(data.nome);
            if (data.cores?.primaria) {
                setBrandColor(data.cores.primaria);
            }
          }
        } catch (error) {
          console.error("Erro ao buscar dados:", error);
        }
      };
      fetchEstablishmentData();
    }
  }, [primeiroEstabelecimento]);

  // Listener para itens e categorias
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

      let categoriasProcessadas = 0;

      categoriasSnapshot.forEach(catDoc => {
        const categoriaData = catDoc.data();
        const itemsRef = collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', catDoc.id, 'itens');
        const qItems = query(itemsRef); // Ordenação local depois

        const unsubscribeItems = onSnapshot(qItems, (itemsSnapshot) => {
          const itemsDaCategoria = itemsSnapshot.docs.map(itemDoc => ({
            ...itemDoc.data(),
            id: itemDoc.id,
            categoria: categoriaData.nome,
            categoriaId: catDoc.id,
            variacoes: Array.isArray(itemDoc.data().variacoes) ? itemDoc.data().variacoes : []
          }));

          // Remove itens antigos desta categoria e adiciona os novos
          allItems = [
            ...allItems.filter(item => item.categoriaId !== catDoc.id),
            ...itemsDaCategoria
          ];

          setMenuItems([...allItems]);
          categoriasProcessadas++;
          
          // Se já processou pelo menos uma vez todas as categorias, tira o loading
          if (categoriasProcessadas >= categoriasSnapshot.size) {
             setLoading(false);
          }
        });

        unsubscribers.push(unsubscribeItems);
      });
      
      // Fallback caso alguma categoria não retorne
      setTimeout(() => setLoading(false), 2000);

      return () => {
        unsubscribers.forEach(unsub => unsub());
      };
    });

    return () => unsubscribeCategorias();
  }, [primeiroEstabelecimento]);

  // Funções de Estoque e Estatísticas
  const getStockStatus = (item) => {
    // O estoque agora é o total calculado no nível principal do item
    const estoque = Number(item.estoque) || 0;
    // O estoque mínimo será o total calculado no nível principal do item
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

  // Filtragem e Paginação
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
      const nomeA = (a.nome || '').toLowerCase();
      const nomeB = (b.nome || '').toLowerCase();
      return nomeA.localeCompare(nomeB);
    });
    return filtered;
  }, [menuItems, searchTerm, selectedCategory, stockFilter]);

  const ITEMS_PER_PAGE = viewMode === 'grid' ? 12 : 8;
  const { currentPage, totalPages, paginatedItems, goToPage } = usePagination(filteredAndSortedItems, ITEMS_PER_PAGE);

  // Estatísticas
const stockStatistics = useMemo(() => {
    const totalItems = menuItems.length;
    const criticalStock = menuItems.filter(item => getStockStatus(item) === 'critico').length;
    const lowStock = menuItems.filter(item => getStockStatus(item) === 'baixo').length;
    const outOfStock = menuItems.filter(item => getStockStatus(item) === 'esgotado').length;
    const normalStock = menuItems.filter(item => getStockStatus(item) === 'normal').length;
    
    // ✅ ATUALIZADO: Soma o estoque e CUSTO de cada variação
    const totalInventoryValue = menuItems.reduce((total, item) => {
        const variationsCost = item.variacoes?.reduce((sum, v) => {
            const estoque = Number(v.estoque) || 0;
            const custo = Number(v.custo) || 0; // Utiliza o CUSTO da VARIAÇÃO
            return sum + (estoque * custo);
        }, 0) || 0;
      return total + variationsCost;
    }, 0);
    
    const activeItems = menuItems.filter(item => item.ativo).length;
    const inactiveItems = menuItems.filter(item => !item.ativo).length;
    
    return { totalItems, criticalStock, lowStock, outOfStock, normalStock, totalInventoryValue, activeItems, inactiveItems };
  }, [menuItems]);

  // CRUD Functions
  const validateForm = () => {
    const errors = {};
    const varErrors = {};

    if (!formData.nome?.trim()) errors.nome = 'Nome é obrigatório';
    if (!formData.categoria?.trim()) errors.categoria = 'Categoria é obrigatória';

    if (!variacoes || variacoes.length === 0) {
      errors.variacoes = 'Configure pelo menos uma opção de preço.';
    } else {
      let temPrecoValido = false;
      variacoes.forEach(v => {
        const vError = {};
        const isModoSimples = variacoes.length === 1 && v.nome === 'Padrão';
        if (!isModoSimples && !v.nome?.trim()) vError.nome = 'Nome é obrigatório';
        
        const precoNum = Number(v.preco);
        if (!v.preco || v.preco === '' || isNaN(precoNum)) {
          vError.preco = 'Preço é obrigatório';
        } else if (precoNum <= 0) {
          vError.preco = 'Maior que 0';
        } else {
          temPrecoValido = true;
          v.preco = precoNum; 
        }

        // ✅ NOVO: Validação de custo, estoque e mínimo para a variação
        if (Number(v.custo) < 0 || isNaN(Number(v.custo))) vError.custo = 'Custo inválido';
        if (Number(v.estoque) < 0 || isNaN(Number(v.estoque))) vError.estoque = 'Estoque inválido';
        if (Number(v.estoqueMinimo) < 0 || isNaN(Number(v.estoqueMinimo))) vError.estoqueMinimo = 'Mínimo inválido';
        
        if (Object.keys(vError).length > 0) varErrors[v.id] = vError;
      });

      if (!temPrecoValido) errors.variacoes = 'Pelo menos um preço válido necessário';
    }

    setFormErrors(errors);
    setVariacoesErrors(varErrors);
    return Object.keys(errors).length === 0 && Object.keys(varErrors).length === 0;
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    setFormLoading(true);

    if (!validateForm()) {
      setFormLoading(false);
      toast.error("Verifique os erros no formulário");
      return;
    }

    try {
      if (!primeiroEstabelecimento) throw new Error("Sem estabelecimento");

      let imageUrl = formData.imageUrl;
      if (itemImage) {
        const fileName = `${Date.now()}_${itemImage.name}`;
        imageUrl = await uploadFile(itemImage, `estabelecimentos/${primeiroEstabelecimento}/cardapio/${fileName}`);
      }

      const categoriaDoc = categories.find(cat => cat.nome === formData.categoria);
      const categoriaIdParaSalvar = editingItem ? editingItem.categoriaId : (categoriaDoc ? categoriaDoc.id : null);

      if (!categoriaIdParaSalvar) {
          toast.error("Categoria inválida. Crie a categoria primeiro.");
          setFormLoading(false);
          return;
      }

      // Preço principal (menor preço das variações ativas)
      const precosAtivos = variacoes
        .filter(v => v.ativo && Number(v.preco) > 0)
        .map(v => Number(v.preco));
      const precoPrincipal = precosAtivos.length > 0 ? Math.min(...precosAtivos) : 0;

      // ✅ ATUALIZADO: Mapeia as variações e garante a conversão de estoque, mínimo e CUSTO para número
      const variationsToSave = variacoes.map(v => ({
          ...v, 
          preco: Number(v.preco),
          estoque: Number(v.estoque) || 0, // Salva estoque da variação
          estoqueMinimo: Number(v.estoqueMinimo) || 0, // Salva estoque mínimo da variação
          custo: Number(v.custo) || 0 // NOVO: Custo por variação
      }));
      
      // ✅ NOVO: Calcula o CUSTO MÍNIMO do produto para fins de exibição/filtro principal
      const custosAtivos = variationsToSave.map(v => v.custo).filter(c => c > 0);
      const custoPrincipal = custosAtivos.length > 0 ? Math.min(...custosAtivos) : 0;
      
      // ✅ NOVO: Calcula o estoque TOTAL do produto para filtro e exibição no Card
      const totalStock = variationsToSave.reduce((sum, v) => sum + (v.estoque || 0), 0);
      
      // ✅ NOVO: Calcula o estoque mínimo TOTAL (o maior mínimo ou a soma, vamos simplificar para a soma)
      const totalEstoqueMinimo = variationsToSave.reduce((sum, v) => sum + (v.estoqueMinimo || 0), 0);

      const itemData = {
        nome: formData.nome.trim(),
        descricao: formData.descricao?.trim() || '',
        preco: precoPrincipal, 
        variacoes: variationsToSave, // Salva as variações com estoque e custo individual
        categoria: formData.categoria.trim(),
        imageUrl: imageUrl,
        ativo: formData.ativo,
        
        // ✅ ATUALIZADO: Campos no nível do produto são agora a SOMA/MÍNIMO das variações para exibição/filtragem
        estoque: totalStock, 
        estoqueMinimo: totalEstoqueMinimo, 
        custo: custoPrincipal, // AGORA É O CUSTO MÍNIMO CALCULADO DAS VARIAÇÕES
        
        atualizadoEm: new Date()
      };

      if (editingItem) {
        await updateDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', categoriaIdParaSalvar, 'itens', editingItem.id), itemData);
        toast.success("Item atualizado!");
      } else {
        itemData.criadoEm = new Date();
        await addDoc(collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', categoriaIdParaSalvar, 'itens'), itemData);
        toast.success("Item criado!");
      }
      closeItemForm();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar item.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Excluir "${item.nome}"?`)) return;
    try {
        if (item.imageUrl) await deleteFileByUrl(item.imageUrl);
        await deleteDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', item.categoriaId, 'itens', item.id));
        toast.success("Item excluído.");
    } catch (error) {
        console.error("Erro ao excluir:", error);
        toast.error("Erro ao excluir item.");
    }
  };

  const toggleItemStatus = async (item) => {
    try {
        await updateDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', item.categoriaId, 'itens', item.id), {
            ativo: !item.ativo,
            atualizadoEm: new Date()
        });
    } catch(e) { toast.error("Erro ao alterar status"); }
  };

  // ✅ REMOVIDO: quickUpdateStock não é mais necessária

  const activateAllItems = async () => {
    setBulkOperationLoading(true);
    try {
        const batch = writeBatch(db);
        const inativos = menuItems.filter(i => !i.ativo);
        if(inativos.length === 0) { toast.info("Todos já ativos"); setShowActivateAllModal(false); setBulkOperationLoading(false); return; }
        
        inativos.forEach(item => {
            const ref = doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', item.categoriaId, 'itens', item.id);
            batch.update(ref, { ativo: true, atualizadoEm: new Date() });
        });
        await batch.commit();
        toast.success(`${inativos.length} itens ativados!`);
        setShowActivateAllModal(false);
    } catch(e) { toast.error("Erro em massa"); } finally { setBulkOperationLoading(false); }
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
      });
        // ✅ ATUALIZADO: Inicializa variações com estoque, estoqueMinimo e CUSTO
      setVariacoes(item.variacoes?.length 
        ? item.variacoes.map(v => ({
            ...v, 
            id: v.id || Date.now().toString(), 
            preco: (Number(v.preco) || 0).toString(), 
            estoque: Number(v.estoque) || 0,
            estoqueMinimo: Number(v.estoqueMinimo) || 0,
            custo: Number(v.custo || item.custo) || 0 // Pega o custo da variação, ou o custo antigo do item
        })) 
        : [{ 
            id: Date.now().toString(), 
            nome: 'Padrão', 
            preco: (Number(item.preco) || 0).toString(), 
            ativo: true, 
            estoque: 0, 
            estoqueMinimo: 0,
            custo: item.custo || 0 // Custo na variação padrão
        }]);
      setImagePreview(item.imageUrl || '');
    } else {
      setEditingItem(null);
      // ✅ ATUALIZADO: Removido estoque, estoqueMinimo e custo
      setFormData({ nome: '', descricao: '', categoria: '', imageUrl: '', ativo: true }); 
      // ✅ ATUALIZADO: Nova variação padrão com estoque e custo
      setVariacoes([{ id: Date.now().toString(), nome: 'Padrão', preco: '', descricao: '', ativo: true, estoque: 0, estoqueMinimo: 0, custo: 0 }]);
      setImagePreview('');
    }
    setFormErrors({});
    setShowItemForm(true);
  }, []);

  const closeItemForm = () => {
    // ✅ ATUALIZADO: Removido estoque e estoqueMinimo
    setShowItemForm(false);
    setEditingItem(null);
    setFormData({ nome: '', descricao: '', categoria: '', imageUrl: '', ativo: true });
    setVariacoes([]);
    setImagePreview('');
    setItemImage(null);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'file') {
        if (files[0]) {
            setItemImage(files[0]);
            setImagePreview(URL.createObjectURL(files[0]));
        }
    } else if (type === 'checkbox') {
        setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Header Configuration
  useEffect(() => {
    const actions = (
        <div className="flex items-center space-x-2 md:space-x-4">
            <div className="flex bg-white rounded-2xl border border-gray-300 p-1 shadow-sm">
                <button onClick={() => setViewMode('grid')} className={`p-2 md:p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600'}`}><IoGrid/></button>
                <button onClick={() => setViewMode('list')} className={`p-2 md:p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600'}`}><IoMenu/></button>
            </div>
            {stockStatistics.inactiveItems > 0 && (
                <button onClick={() => setShowActivateAllModal(true)} className="flex items-center space-x-2 bg-green-600 text-white font-bold py-2 px-3 rounded-2xl hover:bg-green-700 shadow-lg text-sm">
                    <IoRefresh className="text-lg"/> <span className="hidden sm:inline">Ativar Todos</span>
                </button>
            )}
            <button onClick={() => openItemForm()} className="flex items-center space-x-2 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-bold py-2 px-3 rounded-2xl shadow-lg text-sm">
                <IoAddCircleOutline className="text-lg"/> <span className="hidden sm:inline">Novo Item</span>
            </button>
        </div>
    );
    setActions(actions);
    return () => clearActions();
  }, [viewMode, stockStatistics, setActions, clearActions, openItemForm]);

  if (!primeiroEstabelecimento) return <div className="p-8 text-center">Carregando estabelecimento...</div>;
  if (loading) return <div className="p-4"><SkeletonLoader /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-3 md:p-4">
      <div className="max-w-7xl mx-auto">
        
        {/* Cards de Estatística */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-4 mb-6 md:mb-8">
            <StatsCard title="Total" value={stockStatistics.totalItems} icon={IoList} color={brandColor} />
            <StatsCard title="Ativos" value={stockStatistics.activeItems} icon={IoCheckmarkCircle} color={brandColor} />
            <StatsCard title="Crítico" value={stockStatistics.criticalStock} icon={IoAlertCircle} color={brandColor} />
            <StatsCard title="Baixo" value={stockStatistics.lowStock} icon={IoAlertCircle} color={brandColor} />
            <StatsCard title="Esgotados" value={stockStatistics.outOfStock} icon={IoClose} color={brandColor} />
            {/* ✅ CORREÇÃO APLICADA: Força 2 casas decimais para exibir valores corretos de centavos */}
            <StatsCard 
                title="Valor Estoque" 
                value={`R$ ${stockStatistics.totalInventoryValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
                icon={IoCash} 
                color={brandColor} 
            />
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4 md:p-6 mb-6 md:mb-8">
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <IoSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg" />
                    <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-col sm:flex-row pl-12 pr-4 py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500" />
                </div>
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="p-3 border rounded-2xl bg-white">
                    {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} className="p-3 border rounded-2xl bg-white">
                    <option value="todos">Todos Estoques</option>
                    <option value="critico">Crítico</option>
                    <option value="esgotado">Esgotado</option>
                </select>
            </div>
            
        </div>

        {/* Grid de Produtos */}
        <div className="mb-6 md:mb-8">
            {paginatedItems.length > 0 ? (
                <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6" : "space-y-3"}>
                    {paginatedItems.map(item => (
                        viewMode === 'grid' ? (
                            <ProductGridCard 
                                key={item.id} 
                                produto={item} 
                                onEdit={() => openItemForm(item)}
                                onDelete={() => handleDeleteItem(item)}
                                onToggleStatus={() => toggleItemStatus(item)}
                                // onUpdateStock REMOVIDO
                                stockStatus={getStockStatus(item)}
                                profitMargin={calculateProfitMargin(item.preco, item.custo)}
                            />
                        ) : (
                            <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold">{item.nome}</h3>
                                    <p className="text-sm text-gray-500">{item.categoria}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => openItemForm(item)} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg">Editar</button>
                                    <button onClick={() => handleDeleteItem(item)} className="px-3 py-1 bg-red-100 text-red-800 rounded-lg">X</button>
                                </div>
                            </div>
                        )
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
                    <IoCube className="text-4xl text-gray-300 mx-auto mb-4"/>
                    <h3 className="text-xl font-bold text-gray-500">Nenhum item encontrado</h3>
                    <button onClick={() => openItemForm()} className="mt-4 text-blue-600 font-bold">Adicionar Novo Item</button>
                </div>
            )}
        </div>

        {/* Paginação */}
        {paginatedItems.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg border p-4">
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} />
            </div>
        )}

        {/* Modal Formulário */}
        {showItemForm && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                <div className="bg-white rounded-3xl shadow-2xl flex-col sm:flex-row max-w-4xl max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center p-6 border-b">
                        <h2 className="text-2xl font-bold">{editingItem ? 'Editar Item' : 'Novo Item'}</h2>
                        <button onClick={closeItemForm}><IoClose size={24} /></button>
                    </div>
                    <form onSubmit={handleSaveItem} className="p-6 space-y-6">
                        <div>
                            <label className="block font-medium mb-2">Nome *</label>
                            <input type="text" name="nome" value={formData.nome} onChange={handleFormChange} className="flex-col sm:flex-row p-4 border rounded-2xl" required />
                        </div>
                        <div>
                            <label className="block font-medium mb-2">Descrição</label>
                            <textarea name="descricao" value={formData.descricao} onChange={handleFormChange} className="flex-col sm:flex-row p-4 border rounded-2xl" rows="3" />
                        </div>
                        <div>
                            <label className="block font-medium mb-2">Categoria *</label>
                            <input type="text" name="categoria" value={formData.categoria} onChange={handleFormChange} list="cat-list" className="flex-col sm:flex-row p-4 border rounded-2xl" required disabled={!!editingItem} />
                            <datalist id="cat-list">{categories.map(c => <option key={c.id} value={c.nome} />)}</datalist>
                        </div>

                        {/* Seção Preços e Variações */}
                        <div className="bg-gray-50 p-6 rounded-2xl border">
                            <h3 className="font-bold mb-4 flex items-center"><IoCash className="mr-2"/> Preços, Custo e Estoque por Opção</h3>
                            
                            <div className="flex gap-4 mb-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" checked={variacoes.length === 1 && variacoes[0].nome === 'Padrão'} onChange={() => setVariacoes([{id: Date.now().toString(), nome: 'Padrão', preco: variacoes[0]?.preco || '', ativo: true, estoque: variacoes[0]?.estoque || 0, estoqueMinimo: variacoes[0]?.estoqueMinimo || 0, custo: variacoes[0]?.custo || 0 }])} />
                                    Produto Simples
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" checked={variacoes.length > 1 || (variacoes.length === 1 && variacoes[0].nome !== 'Padrão')} onChange={() => { if(variacoes.length===1 && variacoes[0].nome==='Padrão') setVariacoes([{id: Date.now().toString(), nome: 'Tamanho Único', preco: variacoes[0].preco, ativo: true, estoque: variacoes[0].estoque, estoqueMinimo: variacoes[0].estoqueMinimo, custo: variacoes[0].custo}]); }} />
                                    Com Variações
                                </label>
                            </div>

                            {/* Botão adicionar variação */}
                            {(variacoes.length > 1 || (variacoes.length === 1 && variacoes[0].nome !== 'Padrão')) && (
                                <button type="button" onClick={adicionarVariacao} className="text-blue-600 font-bold text-sm mb-4 flex items-center gap-1"><IoAddCircleOutline/> Adicionar Opção</button>
                            )}

                            <div className="space-y-4">
                                {variacoes.map((v, idx) => (
                                    <div key={v.id} className="bg-white p-4 rounded-xl border flex flex-col gap-3 relative">
                                        {variacoes.length > 1 && <button type="button" onClick={() => removerVariacao(v.id)} className="absolute top-2 right-2 text-red-500"><IoClose/></button>}
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            {(variacoes.length > 1 || v.nome !== 'Padrão') && (
                                                <div className="col-span-1 md:col-span-2">
                                                    <label className="text-xs font-bold text-gray-500">Nome</label>
                                                    <input type="text" value={v.nome} onChange={e => atualizarVariacao(v.id, 'nome', e.target.value)} className="flex-col sm:flex-row p-2 border rounded-lg" placeholder="Ex: Grande" />
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <label className="text-xs font-bold text-gray-500">Preço (R$)</label>
                                                <input type="number" value={v.preco} onChange={e => atualizarVariacao(v.id, 'preco', e.target.value)} className="flex-col sm:flex-row p-2 border rounded-lg" placeholder="0.00" step="0.01" />
                                            </div>

                                            {/* ✅ ATUALIZADO: Custo por variação */}
                                            <div>
                                                <label className="text-xs font-bold text-gray-500">Custo (R$)</label>
                                                <input type="number" value={v.custo} onChange={e => atualizarVariacao(v.id, 'custo', e.target.value)} className="flex-col sm:flex-row p-2 border rounded-lg" placeholder="0.00" step="0.01" />
                                            </div>

                                            {/* ✅ NOVO: Estoque Atual por variação */}
                                            <div>
                                                <label className="text-xs font-bold text-gray-500">Estoque Atual</label>
                                                <input type="number" value={v.estoque} onChange={e => atualizarVariacao(v.id, 'estoque', e.target.value)} className="flex-col sm:flex-row p-2 border rounded-lg" placeholder="0" min="0" />
                                            </div>

                                            {/* ✅ NOVO: Estoque Mínimo por variação */}
                                            <div>
                                                <label className="text-xs font-bold text-gray-500">Estoque Mínimo</label>
                                                <input type="number" value={v.estoqueMinimo} onChange={e => atualizarVariacao(v.id, 'estoqueMinimo', e.target.value)} className="flex-col sm:flex-row p-2 border rounded-lg" placeholder="0" min="0" />
                                            </div>
                                        </div>
                                        {(variacoes.length > 1 || v.nome !== 'Padrão') && (
                                            <label className="flex items-center gap-2 text-sm">
                                                <input type="checkbox" checked={v.ativo} onChange={e => atualizarVariacao(v.id, 'ativo', e.target.checked)} /> Ativo
                                            </label>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {formErrors.variacoes && <p className="text-red-500 mt-2">{formErrors.variacoes}</p>}
                        </div>

                        {/* IMAGEM (Bloco Custo Base Removido) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200">
                                <h3 className="font-bold text-blue-900 mb-4">Informações</h3>
                                {/* Espaço para Custo Principal removido */}
                                <p className="text-sm text-blue-700">O Custo Base do produto será calculado automaticamente como o menor custo entre as opções ativas.</p>
                            </div>

                            <div>
                                <label className="block font-medium mb-2">Imagem</label>
                                <div className="flex gap-4 items-center">
                                    {imagePreview ? <img src={imagePreview} className="w-24 h-24 rounded-xl object-cover border" /> : <div className="w-24 h-24 bg-gray-100 rounded-xl border flex items-center justify-center text-gray-400"><IoImageOutline size={30}/></div>}
                                    <input type="file" accept="image/*" onChange={handleFormChange} />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                            <input type="checkbox" name="ativo" checked={formData.ativo} onChange={handleFormChange} className="w-5 h-5" />
                            <label>Item Ativo no Cardápio</label>
                        </div>

                        <div className="flex gap-4 pt-4 border-t">
                            <button type="submit" disabled={formLoading} className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 disabled:opacity-50">
                                {formLoading ? 'Salvando...' : (editingItem ? 'Salvar Alterações' : 'Criar Item')}
                            </button>
                            <button type="button" onClick={closeItemForm} className="px-8 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300">Cancelar</button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Modal Ativar Todos */}
        {showActivateAllModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-sm">
                    <IoRefresh className="text-5xl text-green-600 mx-auto mb-4"/>
                    <h3 className="text-xl font-bold mb-2">Ativar Todos?</h3>
                    <p className="text-gray-500 mb-6">Isso ativará todos os itens inativos do cardápio.</p>
                    <div className="flex gap-3">
                        <button onClick={() => setShowActivateAllModal(false)} className="flex-1 py-3 bg-gray-200 rounded-xl font-bold">Cancelar</button>
                        <button onClick={activateAllItems} disabled={bulkOperationLoading} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold">Confirmar</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}

export default withEstablishmentAuth(AdminMenuManagement);