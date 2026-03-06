// src/pages/AdminMenuManagement.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, getDoc, orderBy, writeBatch, setDoc } from 'firebase/firestore'; 
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useHeader } from '../context/HeaderContext';
import { toast } from 'react-toastify';
import { uploadFile, deleteFileByUrl } from '../utils/firebaseStorageService';
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { usePagination } from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import {
    IoAddCircleOutline,
    IoSearch,
    IoClose,
    IoImageOutline,
    IoCheckmarkCircle,
    IoAlertCircle,
    IoCube,
    IoCash,
    IoPricetag,
    IoList,
    IoEyeOff,
    IoGrid,
    IoMenu,
    IoRefresh,
    IoBarcodeOutline
} from 'react-icons/io5';

// 🛠️ FUNÇÃO DE NORMALIZAÇÃO (O SEGREDO DA BUSCA EFICAZ)
const normalizeText = (text) => 
    text?.toString()
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") || "";

// 🎨 Componente Skeleton Loader
const SkeletonLoader = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 animate-pulse">
        <div className="w-full h-48 bg-gray-200 rounded-xl mb-4"></div>
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    ))}
  </div>
);

// 🎨 Componente Product Card Melhorado
const ProductGridCard = ({ 
  produto, 
  onEdit, 
  onDelete, 
  onToggleStatus, 
  stockStatus, 
  profitMargin 
}) => {
  const stockConfig = {
    normal: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: IoCheckmarkCircle, label: 'OK' },
    baixo: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: IoAlertCircle, label: 'Baixo' },
    critico: { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: IoAlertCircle, label: 'Crítico' },
    esgotado: { color: 'bg-red-100 text-red-800 border-red-200', icon: IoClose, label: 'Esgotado' }
  };

  const { color, icon: Icon, label } = stockConfig[stockStatus] || stockConfig.normal;

  const getProfitColor = (margin) => {
    if (margin >= 50) return 'bg-emerald-500'; 
    if (margin >= 30) return 'bg-blue-500';    
    return 'bg-amber-500';                     
  };

  const mostrarPrecosVariacoes = () => {
    if (!produto.variacoes || produto.variacoes.length === 0) {
      return (
        <p className="text-2xl font-bold text-gray-800">
          R$ {(Number(produto.preco) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      );
    }

    const variacoesAtivas = produto.variacoes.filter(v => 
      v.ativo !== false && v.preco && !isNaN(Number(v.preco)) && Number(v.preco) > 0
    );

    if (variacoesAtivas.length === 0) return <p className="text-2xl font-bold text-gray-400">--</p>;

    if (variacoesAtivas.length === 1) {
      const preco = Number(variacoesAtivas[0].preco);
      return (
        <p className="text-2xl font-bold text-gray-800">
          R$ {preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      );
    }

    const menorPreco = Math.min(...variacoesAtivas.map(v => Number(v.preco)));

    return (
      <div className="flex flex-col">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">A partir de</span>
        <span className="text-xl font-bold text-gray-800">
          R$ {menorPreco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      </div>
    );
  };

  return (
    <div className="group bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-100 transition-all duration-300 flex flex-col h-full overflow-hidden relative">
      <div className="relative h-48 overflow-hidden bg-gray-50">
        {produto.imageUrl ? (
          <img 
            src={produto.imageUrl} 
            alt={produto.nome}
            className="w-full h-full object-contain p-4 mix-blend-multiply transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <IoImageOutline className="text-5xl" />
          </div>
        )}
        
        <div className="absolute top-3 left-3 flex flex-col gap-2">
            {produto.ativo === false && (
                <span className="bg-gray-900/80 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <IoEyeOff /> Inativo
                </span>
            )}
            <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 shadow-sm ${color}`}>
                <Icon /> {label}
            </span>
        </div>

        {profitMargin > 0 && (
            <div className={`absolute top-3 right-3 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md ${getProfitColor(profitMargin)}`}>
                {profitMargin.toFixed(0)}% Lucro
            </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                {produto.categoria}
            </span>
            {produto.codigoBarras && (
                <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1" title="Código de Barras">
                    <IoBarcodeOutline /> {produto.codigoBarras}
                </span>
            )}
        </div>
        <h3 className="font-bold text-gray-800 text-lg leading-tight mb-2 line-clamp-1" title={produto.nome}>
            {produto.nome}
        </h3>
        
        {produto.descricao && (
          <p className="text-gray-500 text-sm line-clamp-2 mb-4 h-10 leading-snug">
            {produto.descricao}
          </p>
        )}

        <div className="mt-auto border-t border-gray-100 pt-4">
            <div className="flex justify-between items-end mb-4">
                <div>
                    {mostrarPrecosVariacoes()}
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-400 font-medium uppercase">Estoque</p>
                    <p className={`text-lg font-bold ${Number(produto.estoque) <= 0 ? 'text-red-500' : 'text-gray-700'}`}>
                        {produto.estoque}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={onToggleStatus}
                    className={`py-2 rounded-xl text-xs font-bold transition-colors ${
                        produto.ativo !== false
                        ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' 
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                >
                    {produto.ativo !== false ? 'Pausar' : 'Ativar'}
                </button>
                <div className="flex gap-2">
                    <button
                        onClick={onEdit}
                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-blue-200 shadow-lg"
                    >
                        Editar
                    </button>
                    <button
                        onClick={onDelete}
                        className="w-10 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-colors border border-red-100"
                    >
                        <IoClose size={16} />
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

// Componente Stats Card
const StatsCard = ({ title, value, icon: Icon, colorClass, bgClass }) => (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between hover:translate-y-[-2px] transition-transform duration-300">
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{title}</p>
        <p className={`text-2xl font-extrabold ${colorClass}`}>
          {value}
        </p>
      </div>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${bgClass}`}>
        <Icon className={`text-xl ${colorClass}`} />
      </div>
    </div>
);

function AdminMenuManagement() {
  const { userData } = useAuth();
  const { setActions, clearActions } = useHeader();
  const navigate = useNavigate();

  const itemListenersRef = useRef([]);

  const [establishmentName, setEstablishmentName] = useState('');
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [stockFilter, setStockFilter] = useState('todos');
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    categoria: '',
    codigoBarras: '', 
    imageUrl: '',
    ativo: true,
    fiscal: { ncm: '', cfop: '5102', unidade: 'UN' }
  });
  
  const [formErrors, setFormErrors] = useState({});
  const [itemImage, setItemImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [showActivateAllModal, setShowActivateAllModal] = useState(false);
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);
  const [ncmResultados, setNcmResultados] = useState([]);
  const [pesquisandoNcm, setPesquisandoNcm] = useState(false);
  const [termoNcm, setTermoNcm] = useState('');
  const [variacoes, setVariacoes] = useState([]);
  const [variacoesErrors, setVariacoesErrors] = useState({});

  const isModoMultiplasVariacoes = variacoes.length > 1 || (variacoes.length === 1 && variacoes[0]?.nome !== 'Padrão');

  const parsePrecoSeguro = (valor) => {
      if (valor === undefined || valor === null || valor === '') return 0;
      if (typeof valor === 'number') return valor;
      const numero = Number(String(valor).replace(',', '.'));
      return isNaN(numero) ? 0 : numero;
  };

  const adicionarVariacao = () => {
    setVariacoes([...variacoes, { id: `var-${Date.now()}`, nome: '', preco: '', descricao: '', ativo: true, estoque: 0, estoqueMinimo: 0, custo: 0 }]);
  };

  const atualizarVariacao = (id, field, value) => {
    setVariacoes(variacoes.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  const removerVariacao = (id) => {
    if (variacoes.length <= 1) return toast.error('Mínimo 1 variação.');
    setVariacoes(variacoes.filter(v => v.id !== id));
  };

  const estabelecimentosGerenciados = useMemo(() => userData?.estabelecimentosGerenciados || [], [userData]);
  const primeiroEstabelecimento = estabelecimentosGerenciados[0];

  // 📡 FETCH DATA
  useEffect(() => {
    if (!primeiroEstabelecimento) { setLoading(false); return; }
    setLoading(true);
    const categoriasRef = collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio');
    const qCategorias = query(categoriasRef, orderBy('ordem', 'asc'));

    const unsubscribeCategorias = onSnapshot(qCategorias, (categoriasSnapshot) => {
      const fetchedCategories = categoriasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCategories(fetchedCategories);
      itemListenersRef.current.forEach(unsub => unsub());
      itemListenersRef.current = [];

      if (categoriasSnapshot.empty) { setMenuItems([]); setLoading(false); return; }

      fetchedCategories.forEach(catData => {
        const itemsRef = collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', catData.id, 'itens');
        const unsubscribeItems = onSnapshot(query(itemsRef), (itemsSnapshot) => {
          const novosItensDaCategoria = itemsSnapshot.docs.map(itemDoc => ({
            ...itemDoc.data(),
            id: itemDoc.id,
            categoria: catData.nome,
            categoriaId: catData.id,
            variacoes: Array.isArray(itemDoc.data().variacoes) ? itemDoc.data().variacoes : []
          }));
          setMenuItems(prevItems => {
            const outrosItens = prevItems.filter(item => item.categoriaId !== catData.id);
            return [...outrosItens, ...novosItensDaCategoria];
          });
        });
        itemListenersRef.current.push(unsubscribeItems);
      });
      setTimeout(() => setLoading(false), 800);
    });
    return () => { unsubscribeCategorias(); itemListenersRef.current.forEach(unsub => unsub()); };
  }, [primeiroEstabelecimento]);

  // 🔍 LÓGICA DE BUSCA E FILTRO (MELHORADA)
  const filteredAndSortedItems = useMemo(() => {
    const searchNormalized = normalizeText(searchTerm);

    let filtered = menuItems.filter(item => {
      const matchCategory = selectedCategory === 'Todos' || item.categoria === selectedCategory;
      
      const matchSearch = 
        normalizeText(item.nome).includes(searchNormalized) ||
        normalizeText(item.descricao).includes(searchNormalized) ||
        normalizeText(item.codigoBarras).includes(searchNormalized);

      const getS = (i) => {
          const e = Number(i.estoque) || 0;
          const m = Number(i.estoqueMinimo) || 0;
          if (e <= 0) return 'esgotado';
          if (e <= m) return 'critico';
          return 'normal';
      };
      const status = getS(item);
      const matchStock = stockFilter === 'todos' || stockFilter === status;

      return matchCategory && matchSearch && matchStock;
    });

    filtered.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    return filtered;
  }, [menuItems, searchTerm, selectedCategory, stockFilter]);

  // 📄 PAGINAÇÃO
  const ITEMS_PER_PAGE = viewMode === 'grid' ? 12 : 8;
  const { currentPage, totalPages, paginatedItems, goToPage } = usePagination(filteredAndSortedItems, ITEMS_PER_PAGE);

  // RESET DA PÁGINA AO BUSCAR
  useEffect(() => {
    goToPage(1);
  }, [searchTerm, selectedCategory, stockFilter, goToPage]);

  // ESTATÍSTICAS
  const stockStatistics = useMemo(() => {
    const getS = (i) => {
        const e = Number(i.estoque) || 0;
        const m = Number(i.estoqueMinimo) || 0;
        if (e <= 0) return 'esgotado';
        if (e <= m) return 'critico';
        return 'normal';
    };
    return {
        totalItems: menuItems.length,
        criticalStock: menuItems.filter(i => getS(i) === 'critico').length,
        outOfStock: menuItems.filter(i => getS(i) === 'esgotado').length,
        activeItems: menuItems.filter(i => i.ativo !== false).length,
        inactiveItems: menuItems.filter(i => i.ativo === false).length,
        totalInventoryValue: menuItems.reduce((acc, item) => acc + (item.variacoes?.reduce((s, v) => s + ((Number(v.estoque) || 0) * (Number(v.custo) || 0)), 0) || 0), 0)
    };
  }, [menuItems]);

  // CRUD ACTIONS
  const handleSaveItem = async (e) => {
    e.preventDefault();
    setFormLoading(true);

    // Validação Básica
    if (!formData.nome.trim() || !formData.categoria.trim()) {
        toast.error("Nome e Categoria são obrigatórios.");
        setFormLoading(false);
        return;
    }

    try {
      let imageUrl = formData.imageUrl;
      if (itemImage) {
        imageUrl = await uploadFile(itemImage, `estabelecimentos/${primeiroEstabelecimento}/cardapio/${Date.now()}_${itemImage.name}`);
        if (editingItem?.imageUrl) await deleteFileByUrl(editingItem.imageUrl).catch(() => null);
      }

      const catDoc = categories.find(c => c.nome === formData.categoria.toUpperCase());
      let catId = catDoc?.id;

      if (!catId) {
        const newCat = await addDoc(collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio'), { nome: formData.categoria.toUpperCase(), ordem: 99, ativo: true });
        catId = newCat.id;
      }

      const itemData = {
        ...formData,
        nome: formData.nome.trim(),
        categoria: formData.categoria.toUpperCase(),
        imageUrl,
        variacoes: variacoes.map(v => ({ ...v, preco: Number(v.preco), estoque: Number(v.estoque), custo: Number(v.custo) })),
        estoque: variacoes.reduce((acc, v) => acc + Number(v.estoque), 0),
        preco: Math.min(...variacoes.map(v => Number(v.preco))),
        atualizadoEm: new Date()
      };

      if (editingItem) {
        if (editingItem.categoriaId !== catId) {
            await setDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', catId, 'itens', editingItem.id), itemData);
            await deleteDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', editingItem.categoriaId, 'itens', editingItem.id));
        } else {
            await updateDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', catId, 'itens', editingItem.id), itemData);
        }
        toast.success("Atualizado!");
      } else {
        await addDoc(collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', catId, 'itens'), { ...itemData, criadoEm: new Date() });
        toast.success("Criado!");
      }
      closeItemForm();
    } catch (err) { toast.error("Erro ao salvar."); }
    finally { setFormLoading(false); }
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Excluir ${item.nome}?`)) return;
    try {
        if (item.imageUrl) await deleteFileByUrl(item.imageUrl);
        await deleteDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', item.categoriaId, 'itens', item.id));
        toast.success("Excluído!");
    } catch(e) { toast.error("Erro ao excluir"); }
  };

  const toggleItemStatus = async (item) => {
    await updateDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', item.categoriaId, 'itens', item.id), { ativo: item.ativo === false });
  };

  // NCM SEARCH (BrasilAPI)
  const buscarNcm = async (termo) => {
    setTermoNcm(termo);
    handleFiscalChange({ target: { name: 'ncm', value: termo } });
    if (termo.length < 3) return setNcmResultados([]);
    setPesquisandoNcm(true);
    try {
        const res = await fetch(`https://brasilapi.com.br/api/ncm/v1?search=${termo}`);
        if (res.ok) {
            const data = await res.json();
            setNcmResultados(Array.isArray(data) ? data.slice(0, 10) : []);
        }
    } catch(e) { console.error(e); }
    finally { setPesquisandoNcm(false); }
  };

  const openItemForm = useCallback((item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        nome: item.nome || '',
        descricao: item.descricao || '',
        categoria: item.categoria || '',
        codigoBarras: item.codigoBarras || '', 
        imageUrl: item.imageUrl || '',
        ativo: item.ativo !== false, 
        fiscal: item.fiscal || { ncm: '', cfop: '5102', unidade: 'UN' } 
      });
      setTermoNcm(item.fiscal?.ncm || '');
      setVariacoes(item.variacoes?.length ? item.variacoes.map(v => ({...v, preco: v.preco.toString()})) : [{ id: `v-${Date.now()}`, nome: 'Padrão', preco: item.preco.toString(), ativo: true, estoque: item.estoque || 0, custo: item.custo || 0 }]);
      setImagePreview(item.imageUrl || '');
    } else {
      setEditingItem(null);
      setFormData({ nome: '', descricao: '', categoria: '', codigoBarras: '', imageUrl: '', ativo: true, fiscal: { ncm: '', cfop: '5102', unidade: 'UN' } });
      setVariacoes([{ id: `v-${Date.now()}`, nome: 'Padrão', preco: '', ativo: true, estoque: 0, custo: 0 }]);
      setImagePreview('');
      setTermoNcm('');
    }
    setShowItemForm(true);
  }, []);

  const closeItemForm = () => { setShowItemForm(false); setItemImage(null); };

  const handleFormChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'file') {
        if (files[0]) { setItemImage(files[0]); setImagePreview(URL.createObjectURL(files[0])); }
    } else {
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }
  };

  const handleFiscalChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, fiscal: { ...prev.fiscal, [name]: value } }));
  };

  // HEADER ACTIONS
  useEffect(() => {
    const actions = (
        <div className="flex items-center space-x-2">
            <div className="hidden md:flex bg-white rounded-xl border border-gray-200 p-1">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}><IoGrid/></button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}><IoMenu/></button>
            </div>
            <button onClick={() => openItemForm()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl shadow-lg text-sm transition-all transform hover:scale-105">
                <IoAddCircleOutline className="text-xl"/> <span className="hidden sm:inline">Novo Item</span>
            </button>
        </div>
    );
    setActions(actions);
    return () => clearActions();
  }, [viewMode, setActions, clearActions, openItemForm]);

  if (loading) return <div className="p-6 max-w-7xl mx-auto"><SkeletonLoader /></div>;

  return (
    <div className="min-h-screen bg-[#F3F4F6] p-4 md:p-6 font-sans pb-24">
      <div className="max-w-7xl mx-auto">
        
        {/* DASHBOARD STATS */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
            <StatsCard title="Total Itens" value={stockStatistics.totalItems} icon={IoList} colorClass="text-blue-600" bgClass="bg-blue-50" />
            <StatsCard title="Ativos" value={stockStatistics.activeItems} icon={IoCheckmarkCircle} colorClass="text-emerald-600" bgClass="bg-emerald-50" />
            <StatsCard title="Crítico" value={stockStatistics.criticalStock} icon={IoAlertCircle} colorClass="text-orange-600" bgClass="bg-orange-50" />
            <StatsCard title="Esgotados" value={stockStatistics.outOfStock} icon={IoClose} colorClass="text-red-600" bgClass="bg-red-50" />
            <div className="col-span-2">
                <StatsCard title="Valor Estoque" value={`R$ ${stockStatistics.totalInventoryValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={IoCash} colorClass="text-indigo-600" bgClass="bg-indigo-50" />
            </div>
        </div>

        {/* BARRA DE PESQUISA EFICAZ */}
        <div className="sticky top-2 z-30 bg-white/90 backdrop-blur-md rounded-2xl shadow-sm border border-gray-200 p-2 mb-8 flex flex-col md:flex-row gap-2 md:items-center">
            <div className="relative flex-1">
                <IoSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Buscar por nome, ingrediente ou código..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-100 rounded-xl transition-all outline-none" 
                />
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="px-4 py-2.5 bg-gray-50 rounded-xl text-sm font-medium outline-none cursor-pointer">
                    {['Todos', ...new Set(categories.map(c => c.nome))].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} className="px-4 py-2.5 bg-gray-50 rounded-xl text-sm font-medium outline-none cursor-pointer">
                    <option value="todos">Estoque (Todos)</option>
                    <option value="critico">⚠️ Crítico</option>
                    <option value="esgotado">🚫 Esgotado</option>
                    <option value="normal">✅ Normal</option>
                </select>
            </div>
        </div>

        {/* LISTAGEM */}
        <div className="min-h-[400px]">
            {paginatedItems.length > 0 ? (
                <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-3"}>
                    {paginatedItems.map(item => (
                        viewMode === 'grid' ? (
                            <ProductGridCard 
                                key={item.id} 
                                produto={item} 
                                onEdit={() => openItemForm(item)}
                                onDelete={() => handleDeleteItem(item)}
                                onToggleStatus={() => toggleItemStatus(item)}
                                stockStatus={item.estoque <= 0 ? 'esgotado' : (item.estoque <= item.estoqueMinimo ? 'critico' : 'normal')}
                                profitMargin={((item.preco - item.custo) / item.preco) * 100}
                            />
                        ) : (
                            <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-blue-200 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                                        {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-contain p-1 mix-blend-multiply"/> : <IoImageOutline className="text-gray-300"/>}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800">{item.nome}</h3>
                                        <p className="text-xs text-gray-500">{item.categoria} • {item.ativo !== false ? <span className="text-green-600">Ativo</span> : <span className="text-red-500">Inativo</span>}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right hidden sm:block">
                                        <p className="font-bold">R$ {Number(item.preco).toFixed(2)}</p>
                                        <p className="text-xs text-gray-400">Estoque: {item.estoque}</p>
                                    </div>
                                    <button onClick={() => openItemForm(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><IoPricetag/></button>
                                </div>
                            </div>
                        )
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
                    <IoCube className="text-4xl text-gray-300 mb-4" />
                    <h3 className="text-xl font-bold text-gray-600">Nenhum item encontrado</h3>
                    <p className="text-gray-400">Tente mudar o termo de busca ou filtros.</p>
                </div>
            )}
        </div>

        {paginatedItems.length > 0 && <div className="mt-8"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} /></div>}

        {/* 👇 MODAL 100% TELA CHEIA (ESTILO NATIVO) 👇 */}
        {showItemForm && (
          <div className="fixed inset-0 z-[9999] bg-white flex flex-col animate-fade-in">
            {/* HEADER FIXO DO MODAL */}
            <div className="flex-none h-20 sm:h-24 border-b border-gray-200 px-4 sm:px-8 flex items-center justify-between bg-white shadow-sm z-20">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{editingItem ? 'Editar Produto' : 'Novo Produto'}</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Gestão de Cardápio & Estoque</p>
              </div>
              <button type="button" onClick={closeItemForm} className="px-4 py-2 sm:px-6 sm:py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold transition-all flex items-center gap-2">
                <span className="hidden sm:block">Voltar</span>
                <IoClose size={20} className="sm:hidden" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="flex-1 overflow-hidden flex flex-col bg-gray-50">
              {/* CORPO DO FORM COM SCROLL */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-10 pb-32 w-full custom-scrollbar">
                <div className="max-w-5xl mx-auto space-y-6 sm:space-y-10">

                    {/* DADOS BÁSICOS */}
                    <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-gray-200 space-y-6">
                        <h3 className="text-lg font-bold text-gray-800">Dados Gerais</h3>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold mb-2 text-gray-700">Nome do Produto *</label>
                                <input type="text" name="nome" value={formData.nome} onChange={handleFormChange} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all" placeholder="Ex: X-Burger Especial" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-2 text-gray-700">Categoria *</label>
                                    <input type="text" name="categoria" value={formData.categoria} onChange={handleFormChange} list="cat-list" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all" placeholder="Selecione..." required />
                                    <datalist id="cat-list">{categories.map(c => (<option key={c.id} value={c.nome} />))}</datalist>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-2 text-gray-700">Cód. Barras</label>
                                    <input type="text" name="codigoBarras" value={formData.codigoBarras} onChange={handleFormChange} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-mono" placeholder="EAN" />
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-2 text-gray-700">Descrição</label>
                            <textarea name="description" value={formData.descricao} onChange={handleFormChange} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all min-h-[100px] resize-none" placeholder="Ingredientes e detalhes..."/>
                        </div>
                    </div>

                    {/* PREÇO & VARIAÇÕES */}
                    <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-gray-200 space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><IoCash className="text-blue-600"/> Preços & Estoque</h3>
                            <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
                                <button type="button" onClick={() => setVariacoes([{id: `v-unique`, nome: 'Padrão', preco: '', ativo: true, estoque: 0, custo: 0 }])} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${variacoes.length === 1 && variacoes[0].nome === 'Padrão' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>Preço Único</button>
                                <button type="button" onClick={() => { if(variacoes.length===1 && variacoes[0].nome==='Padrão') setVariacoes([{id: `v-multi`, nome: 'Médio', preco: '', ativo: true, estoque: 0, custo: 0}]); }} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${variacoes.length > 1 || variacoes[0].nome !== 'Padrão' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>Vários Tamanhos</button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {variacoes.map((v) => (
                                <div key={v.id} className="bg-gray-50 p-5 rounded-2xl border border-gray-200 relative group">
                                    {variacoes.length > 1 && (
                                        <button type="button" onClick={() => removerVariacao(v.id)} className="absolute -top-3 -right-3 bg-red-100 text-red-600 p-2 rounded-full shadow-md"><IoClose size={18}/></button>
                                    )}
                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-5">
                                        {(variacoes.length > 1 || v.nome !== 'Padrão') && (
                                            <div className="sm:col-span-4">
                                                <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Nome da Variação</label>
                                                <input type="text" value={v.nome} onChange={e => atualizarVariacao(v.id, 'nome', e.target.value)} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold" placeholder="Ex: Grande" />
                                            </div>
                                        )}
                                        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 ${variacoes.length > 1 || v.nome !== 'Padrão' ? 'sm:col-span-8' : 'sm:col-span-12'}`}>
                                            <div>
                                                <label className="text-xs font-bold text-emerald-600 mb-2 block uppercase">Venda (R$)</label>
                                                <input type="number" step="0.01" value={v.preco} onChange={e => atualizarVariacao(v.id, 'preco', e.target.value)} className="w-full p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-bold text-emerald-800" placeholder="0.00" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Custo (R$)</label>
                                                <input type="number" step="0.01" value={v.custo} onChange={e => atualizarVariacao(v.id, 'custo', e.target.value)} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm" placeholder="0.00" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Estoque</label>
                                                <input type="number" value={v.estoque} onChange={e => atualizarVariacao(v.id, 'estoque', e.target.value)} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm" placeholder="Qtd" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Status</label>
                                                <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded-xl border border-gray-200">
                                                    <input type="checkbox" checked={v.ativo !== false} onChange={e => atualizarVariacao(v.id, 'ativo', e.target.checked)} className="w-4 h-4 text-blue-600" />
                                                    <span className="text-[10px] font-bold">ATIVO</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {isModoMultiplasVariacoes && (
                            <button type="button" onClick={adicionarVariacao} className="w-full py-4 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold flex items-center justify-center gap-2 rounded-2xl transition-colors border-2 border-dashed border-blue-200">
                                <IoAddCircleOutline className="text-2xl"/> Adicionar Variação
                            </button>
                        )}
                    </div>

                    {/* FISCAL (NFC-e) */}
                    <div className="bg-emerald-50/40 p-5 sm:p-8 rounded-3xl border border-emerald-100 shadow-sm space-y-6">
                        <h3 className="text-lg font-bold text-emerald-800 flex items-center gap-2">🏢 Emissão de Nota (NFC-e)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="relative">
                                <label className="block text-sm font-semibold text-emerald-800 mb-2">NCM (Busca BrasilAPI)</label>
                                <input type="text" name="ncm" value={termoNcm} onChange={(e) => buscarNcm(e.target.value)} className="w-full p-4 bg-white border border-emerald-200 rounded-2xl outline-none" placeholder="Pesquisar..." autoComplete="off" />
                                {pesquisandoNcm && <span className="absolute right-4 top-12 text-[10px] animate-pulse">Buscando...</span>}
                                {ncmResultados.length > 0 && (
                                    <div className="absolute z-50 w-full mt-2 bg-white border border-emerald-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {ncmResultados.map((item) => (
                                            <div key={item.codigo} onClick={() => { setTermoNcm(item.codigo); handleFiscalChange({ target: { name: 'ncm', value: item.codigo } }); setNcmResultados([]); }} className="p-3 border-b hover:bg-emerald-50 cursor-pointer transition-colors">
                                                <p className="font-bold text-emerald-800 text-xs">{item.codigo}</p>
                                                <p className="text-[10px] text-gray-500 line-clamp-1">{item.descricao}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-emerald-800 mb-2">CFOP</label>
                                <select name="cfop" value={formData.fiscal?.cfop} onChange={handleFiscalChange} className="w-full p-4 bg-white border border-emerald-200 rounded-2xl">
                                    <option value="5102">5102 - Venda Normal</option>
                                    <option value="5405">5405 - Subs. Tributária</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-emerald-800 mb-2">Unidade</label>
                                <select name="unidade" value={formData.fiscal?.unidade} onChange={handleFiscalChange} className="w-full p-4 bg-white border border-emerald-200 rounded-2xl">
                                    <option value="UN">UN - Unidade</option>
                                    <option value="KG">KG - Quilograma</option>
                                    <option value="LT">LT - Litro</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* IMAGEM E VISIBILIDADE */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm flex items-center gap-4">
                            <div className="w-24 h-24 bg-gray-50 rounded-2xl border flex items-center justify-center overflow-hidden shrink-0">
                                {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" /> : <IoImageOutline className="text-4xl text-gray-300"/>}
                            </div>
                            <div className="flex-1">
                                <label className="block text-base font-bold text-gray-800 mb-2">Foto</label>
                                <input type="file" accept="image/*" onChange={handleFormChange} className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-100 file:text-blue-700 font-bold" />
                            </div>
                        </div>

                        <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex items-center justify-center">
                            <label htmlFor="ativoMain" className="flex items-center gap-4 cursor-pointer">
                                <div className={`w-14 h-7 rounded-full p-1 transition-colors ${formData.ativo ? 'bg-blue-600' : 'bg-gray-300'}`}>
                                    <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${formData.ativo ? 'translate-x-7' : 'translate-x-0'}`}></div>
                                </div>
                                <input type="checkbox" id="ativoMain" name="ativo" checked={formData.ativo} onChange={handleFormChange} className="hidden" />
                                <div>
                                    <p className="font-bold text-gray-800">Visível no Cardápio?</p>
                                    <p className="text-xs text-gray-500">{formData.ativo ? 'Os clientes podem pedir' : 'Produto pausado'}</p>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
              </div>

              {/* FOOTER FIXO DO MODAL */}
              <div className="flex-none bg-white border-t px-4 sm:px-8 py-5 flex justify-end gap-4 shadow-inner z-20 pb-10 sm:pb-5">
                  <button type="button" onClick={closeItemForm} className="hidden sm:block px-8 py-4 rounded-xl border font-bold text-gray-600 hover:bg-gray-50 transition-all text-lg">Cancelar</button>
                  <button type="submit" disabled={formLoading} className="w-full sm:w-auto px-10 py-4 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-xl transition-all transform hover:scale-[1.02] text-lg flex items-center justify-center gap-2">
                      {formLoading ? 'Processando...' : <><IoCheckmarkCircle size={24}/> Salvar Produto</>}
                  </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}

export default withEstablishmentAuth(AdminMenuManagement);
