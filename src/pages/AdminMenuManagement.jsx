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

    if (variacoesAtivas.length === 0) {
      return <p className="text-2xl font-bold text-gray-400">--</p>;
    }

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
    fiscal: {
      ncm: '',
      cfop: '5102',
      unidade: 'UN'
    }
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

  // Helper para formatar moeda vinda de string com vírgula do banco antigo
  const parsePrecoSeguro = (valor) => {
      if (valor === undefined || valor === null || valor === '') return 0;
      if (typeof valor === 'number') return valor;
      const numero = Number(String(valor).replace(',', '.'));
      return isNaN(numero) ? 0 : numero;
  };

  const adicionarVariacao = () => {
    const novaVariacao = {
      id: `var-${Date.now()}-${Math.floor(Math.random() * 1000)}`, // Chave super única
      nome: '',
      preco: '',
      descricao: '',
      ativo: true,
      estoque: 0, 
      estoqueMinimo: 0,
      custo: 0 
    };
    setVariacoes([...variacoes, novaVariacao]);
  };

  const atualizarVariacao = (id, field, value) => {
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

  useEffect(() => {
    if (primeiroEstabelecimento) {
      const fetchEstablishmentData = async () => {
        try {
          const estabDoc = await getDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento));
          if (estabDoc.exists()) {
            setEstablishmentName(estabDoc.data().nome);
          }
        } catch (error) {
          console.error("Erro ao buscar dados:", error);
        }
      };
      fetchEstablishmentData();
    }
  }, [primeiroEstabelecimento]);

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

      itemListenersRef.current.forEach(unsub => unsub());
      itemListenersRef.current = [];

      if (categoriasSnapshot.empty) {
        setMenuItems([]);
        setLoading(false);
        return;
      }

      fetchedCategories.forEach(catData => {
        const itemsRef = collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', catData.id, 'itens');
        const qItems = query(itemsRef); 

        const unsubscribeItems = onSnapshot(qItems, (itemsSnapshot) => {
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

    return () => {
      unsubscribeCategorias();
      itemListenersRef.current.forEach(unsub => unsub());
    };
  }, [primeiroEstabelecimento]);

  const getStockStatus = (item) => {
    const estoque = Number(item.estoque) || 0;
    const estoqueMinimo = Number(item.estoqueMinimo) || 0; 

    if (estoque <= 0) return 'esgotado';
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

  const availableCategories = useMemo(() =>
    ['Todos', ...new Set(categories.map(cat => cat.nome).filter(Boolean))],
    [categories]
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
    
    filtered.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    return filtered;
  }, [menuItems, searchTerm, selectedCategory, stockFilter]);

  const ITEMS_PER_PAGE = viewMode === 'grid' ? 12 : 8;
  const { currentPage, totalPages, paginatedItems, goToPage } = usePagination(filteredAndSortedItems, ITEMS_PER_PAGE);

  const stockStatistics = useMemo(() => {
    const totalItems = menuItems.length;
    const criticalStock = menuItems.filter(item => getStockStatus(item) === 'critico').length;
    const lowStock = menuItems.filter(item => getStockStatus(item) === 'baixo').length;
    const outOfStock = menuItems.filter(item => getStockStatus(item) === 'esgotado').length;
    const normalStock = menuItems.filter(item => getStockStatus(item) === 'normal').length;
    
    const totalInventoryValue = menuItems.reduce((total, item) => {
        const variationsCost = item.variacoes?.reduce((sum, v) => {
            const estoque = Number(v.estoque) || 0;
            const custo = Number(v.custo) || 0;
            return sum + (estoque * custo);
        }, 0) || 0;
      return total + variationsCost;
    }, 0);
    
    const activeItems = menuItems.filter(item => item.ativo !== false).length;
    const inactiveItems = menuItems.filter(item => item.ativo === false).length;
    
    return { totalItems, criticalStock, lowStock, outOfStock, normalStock, totalInventoryValue, activeItems, inactiveItems };
  }, [menuItems]);

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
          vError.preco = 'Obrigatório';
        } else if (precoNum <= 0) {
          vError.preco = '> 0';
        } else {
          temPrecoValido = true;
          v.preco = precoNum; 
        }

        if (Number(v.custo) < 0 || isNaN(Number(v.custo))) vError.custo = 'Inválido';
        if (isNaN(Number(v.estoque))) vError.estoque = 'Inválido';
        if (Number(v.estoqueMinimo) < 0 || isNaN(Number(v.estoqueMinimo))) vError.estoqueMinimo = 'Inválido';
        
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
        
        if (editingItem && editingItem.imageUrl && editingItem.imageUrl !== imageUrl) {
            try {
                await deleteFileByUrl(editingItem.imageUrl);
            } catch (err) {
                console.warn("Erro a apagar a imagem antiga:", err);
            }
        }
      }

      const categoriaDoc = categories.find(cat => cat.nome === formData.categoria);
      let categoriaIdParaSalvar = null;

      if (editingItem) {
        categoriaIdParaSalvar = editingItem.categoriaId;
        if (categoriaDoc && categoriaDoc.id !== editingItem.categoriaId) {
            categoriaIdParaSalvar = categoriaDoc.id;
        }
      } else {
        categoriaIdParaSalvar = categoriaDoc ? categoriaDoc.id : null;
      }

      if (!categoriaIdParaSalvar) {
          try {
             const novaCategoriaRef = await addDoc(collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio'), {
                 nome: formData.categoria.trim().toUpperCase(),
                 ordem: 999,
                 ativo: true
             });
             categoriaIdParaSalvar = novaCategoriaRef.id;
             toast.info(`Categoria "${formData.categoria}" criada automaticamente!`);
          } catch (err) {
              toast.error("Erro ao criar nova categoria.");
              setFormLoading(false);
              return;
          }
      }

      const precosAtivos = variacoes
        .filter(v => v.ativo !== false && Number(v.preco) > 0)
        .map(v => Number(v.preco));
      const precoPrincipal = precosAtivos.length > 0 ? Math.min(...precosAtivos) : 0;

      const variationsToSave = variacoes.map(v => ({
          ...v, 
          preco: Number(v.preco),
          estoque: Number(v.estoque) || 0, 
          estoqueMinimo: Number(v.estoqueMinimo) || 0, 
          custo: Number(v.custo) || 0 
      }));
      
      const custosAtivos = variationsToSave.map(v => v.custo).filter(c => c > 0);
      const custoPrincipal = custosAtivos.length > 0 ? Math.min(...custosAtivos) : 0;
      
      const totalStock = variationsToSave.reduce((sum, v) => sum + (Number(v.estoque) || 0), 0);
      const totalEstoqueMinimo = variationsToSave.reduce((sum, v) => sum + (Number(v.estoqueMinimo) || 0), 0);

      const itemData = {
        nome: formData.nome.trim(),
        descricao: formData.descricao?.trim() || '',
        codigoBarras: formData.codigoBarras?.trim() || '',
        preco: precoPrincipal, 
        variacoes: variationsToSave, 
        categoria: formData.categoria.trim().toUpperCase(),
        imageUrl: imageUrl,
        ativo: formData.ativo,
        estoque: totalStock, 
        estoqueMinimo: totalEstoqueMinimo, 
        custo: custoPrincipal, 
        fiscal: formData.fiscal,
        atualizadoEm: new Date()
      };

      if (editingItem) {
        if (editingItem.categoriaId !== categoriaIdParaSalvar) {
            await setDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', categoriaIdParaSalvar, 'itens', editingItem.id), {
                ...itemData,
                criadoEm: editingItem.criadoEm || new Date()
            });
            await deleteDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', editingItem.categoriaId, 'itens', editingItem.id));
            toast.success("Item movido e atualizado!");
        } else {
            await updateDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', categoriaIdParaSalvar, 'itens', editingItem.id), itemData);
            toast.success("Item atualizado!");
        }
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
            ativo: item.ativo === false ? true : false,
            atualizadoEm: new Date()
        });
    } catch(e) { toast.error("Erro ao alterar status"); }
  };

  const activateAllItems = async () => {
    setBulkOperationLoading(true);
    try {
        const batch = writeBatch(db);
        const inativos = menuItems.filter(i => i.ativo === false);
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

  // 🔥 Processamento Seguro dos Dados do Produto 🔥
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

      const loadedVariacoes = item.variacoes && item.variacoes.length > 0 
        ? item.variacoes.map((v, index) => ({
            ...v, 
            id: v.id || `var-${Date.now()}-${index}`, 
            nome: v.nome || 'Padrão',
            preco: parsePrecoSeguro(v.preco).toString(), 
            estoque: Number(v.estoque) || 0,
            estoqueMinimo: Number(v.estoqueMinimo) || 0,
            custo: Number(v.custo || item.custo) || 0,
            ativo: v.ativo !== false
        })) 
        : [{ 
            id: `var-${Date.now()}-default`, 
            nome: 'Padrão', 
            preco: parsePrecoSeguro(item.preco).toString(), 
            ativo: true, 
            estoque: Number(item.estoque) || 0, 
            estoqueMinimo: Number(item.estoqueMinimo) || 0,
            custo: Number(item.custo) || 0 
        }];
        
      setVariacoes(loadedVariacoes);
      setImagePreview(item.imageUrl || '');
    } else {
      setEditingItem(null);
      setFormData({ nome: '', descricao: '', categoria: '', codigoBarras: '', imageUrl: '', ativo: true, fiscal: { ncm: '', cfop: '5102', unidade: 'UN' } }); 
      setTermoNcm(''); 
      setVariacoes([{ id: `var-${Date.now()}-new`, nome: 'Padrão', preco: '', descricao: '', ativo: true, estoque: 0, estoqueMinimo: 0, custo: 0 }]);
      setImagePreview('');
    }
    setFormErrors({});
    setShowItemForm(true);
  }, []);

  const closeItemForm = () => {
    setShowItemForm(false);
    setEditingItem(null);
    setFormData({ nome: '', descricao: '', categoria: '', codigoBarras: '', imageUrl: '', ativo: true, fiscal: { ncm: '', cfop: '5102', unidade: 'UN' } });
    setTermoNcm('');
    setNcmResultados([]);
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

  const handleFiscalChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      fiscal: {
        ...(prev.fiscal || { ncm: '', cfop: '5102', unidade: 'UN' }), 
        [name]: value
      }
    }));
  };

  const buscarNcm = async (termo) => {
    try {
      const texto = termo || ''; 
      setTermoNcm(texto);
      
      handleFiscalChange({ target: { name: 'ncm', value: texto } });

      if (texto.length < 3) {
        setNcmResultados([]);
        return;
      }

      setPesquisandoNcm(true);
      
      const response = await fetch(`https://brasilapi.com.br/api/ncm/v1?search=${texto}`);
      
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setNcmResultados(data.slice(0, 15)); 
        } else {
          setNcmResultados([]);
        }
      } else {
        setNcmResultados([]);
      }
    } catch (error) {
      console.error("⚠️ Erro silencioso ao buscar NCM na Brasil API:", error);
      setNcmResultados([]);
    } finally {
      setPesquisandoNcm(false);
    }
  };

  const selecionarNcm = (codigo) => {
    handleFiscalChange({ target: { name: 'ncm', value: codigo } });
    setTermoNcm(codigo);
    setNcmResultados([]); 
  };

  useEffect(() => {
    const actions = (
        <div className="flex items-center space-x-2 md:space-x-3">
            <div className="hidden md:flex bg-white rounded-xl border border-gray-200 p-1">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}><IoGrid/></button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}><IoMenu/></button>
            </div>
            {stockStatistics.inactiveItems > 0 && (
                <button onClick={() => setShowActivateAllModal(true)} className="flex items-center gap-2 bg-white text-gray-600 hover:text-green-600 border border-gray-200 hover:border-green-200 font-bold py-2 px-4 rounded-xl transition-all shadow-sm text-sm">
                    <IoRefresh /> <span className="hidden sm:inline">Ativar Todos ({stockStatistics.inactiveItems})</span>
                </button>
            )}
            <button onClick={() => openItemForm()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl shadow-lg shadow-blue-200 text-sm transition-all transform hover:scale-105">
                <IoAddCircleOutline className="text-xl"/> <span className="hidden sm:inline">Novo Item</span>
            </button>
        </div>
    );
    setActions(actions);
    return () => clearActions();
  }, [viewMode, stockStatistics, setActions, clearActions, openItemForm]);

  if (!primeiroEstabelecimento) return <div className="p-8 text-center text-gray-500">Carregando estabelecimento...</div>;
  if (loading) return <div className="p-6 max-w-7xl mx-auto"><SkeletonLoader /></div>;

  return (
    <div className="min-h-screen bg-[#F3F4F6] p-4 md:p-6 font-sans pb-24">
      <div className="max-w-7xl mx-auto">
        
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
            <StatsCard title="Total Itens" value={stockStatistics.totalItems} icon={IoList} colorClass="text-blue-600" bgClass="bg-blue-50" />
            <StatsCard title="Ativos" value={stockStatistics.activeItems} icon={IoCheckmarkCircle} colorClass="text-emerald-600" bgClass="bg-emerald-50" />
            <StatsCard title="Crítico" value={stockStatistics.criticalStock} icon={IoAlertCircle} colorClass="text-orange-600" bgClass="bg-orange-50" />
            <StatsCard title="Esgotados" value={stockStatistics.outOfStock} icon={IoClose} colorClass="text-red-600" bgClass="bg-red-50" />
            <div className="col-span-2 md:col-span-2 xl:col-span-2">
                <StatsCard 
                    title="Valor em Estoque (Custo)" 
                    value={`R$ ${stockStatistics.totalInventoryValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
                    icon={IoCash} 
                    colorClass="text-indigo-600" 
                    bgClass="bg-indigo-50" 
                />
            </div>
        </div>

        <div className="sticky top-2 z-30 bg-white/90 backdrop-blur-md rounded-2xl shadow-sm border border-gray-200 p-2 mb-8 flex flex-col md:flex-row gap-2 md:items-center">
            <div className="relative flex-1">
                <IoSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Buscar produto..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-100 rounded-xl transition-all outline-none" 
                />
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
                <select 
                    value={selectedCategory} 
                    onChange={(e) => setSelectedCategory(e.target.value)} 
                    className="px-4 py-2.5 bg-gray-50 hover:bg-white border border-transparent hover:border-gray-200 rounded-xl cursor-pointer outline-none transition-all text-sm font-medium text-gray-700 min-w-[150px]"
                >
                    {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                
                <select 
                    value={stockFilter} 
                    onChange={(e) => setStockFilter(e.target.value)} 
                    className="px-4 py-2.5 bg-gray-50 hover:bg-white border border-transparent hover:border-gray-200 rounded-xl cursor-pointer outline-none transition-all text-sm font-medium text-gray-700 min-w-[150px]"
                >
                    <option value="todos">Status Estoque</option>
                    <option value="critico">⚠️ Crítico</option>
                    <option value="esgotado">🚫 Esgotado</option>
                    <option value="normal">✅ Normal</option>
                </select>
            </div>
        </div>

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
                                stockStatus={getStockStatus(item)}
                                profitMargin={calculateProfitMargin(item.preco, item.custo)}
                            />
                        ) : (
                            <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-blue-200 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                                        {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-contain p-1 mix-blend-multiply"/> : <IoImageOutline className="text-gray-400"/>}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800">{item.nome}</h3>
                                        <div className="flex gap-2 text-xs text-gray-500">
                                            <span>{item.categoria}</span>
                                            <span>•</span>
                                            <span className={item.ativo !== false ? 'text-green-600' : 'text-red-500'}>{item.ativo !== false ? 'Ativo' : 'Inativo'}</span>
                                        </div>
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
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <IoCube className="text-4xl text-gray-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-600">Nenhum item encontrado</h3>
                    <p className="text-gray-400 mb-6">Tente ajustar os filtros ou crie um novo item.</p>
                    <button onClick={() => openItemForm()} className="text-blue-600 font-bold hover:underline">
                        + Adicionar Novo Item
                    </button>
                </div>
            )}
        </div>

        {paginatedItems.length > 0 && (
            <div className="mt-8">
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} />
            </div>
        )}

        {/* 👇 MODAL 100% TELA CHEIA NO MOBILE / CARD NO DESKTOP 👇 */}
        {showItemForm && (
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[9999] flex sm:items-center justify-center transition-opacity">
                
                <form 
                    onSubmit={handleSaveItem} 
                    className="bg-white flex flex-col shadow-2xl animate-slide-up 
                               absolute inset-0 w-full h-full rounded-none
                               sm:relative sm:inset-auto sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:rounded-3xl"
                >
                    
                    {/* 1. CABEÇALHO FIXO NO TOPO */}
                    <div className="flex-none bg-white z-10 flex justify-between items-center p-4 pt-8 sm:p-6 sm:pt-6 border-b border-gray-100 shadow-sm">
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{editingItem ? 'Editar Produto' : 'Novo Produto'}</h2>
                            <p className="text-xs sm:text-sm text-gray-500 mt-1">Preencha os dados do cardápio</p>
                        </div>
                        <button type="button" onClick={closeItemForm} className="p-3 bg-gray-50 hover:bg-red-50 text-gray-500 hover:text-red-500 rounded-full transition-colors shadow-sm">
                            <IoClose size={24} />
                        </button>
                    </div>
                    
                    {/* 2. MEIO DO FORMULÁRIO (Somente esta parte tem barra de rolagem!) */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 bg-gray-50/50">
                        <div className="space-y-5 sm:space-y-8 max-w-3xl mx-auto pb-4">
                            
                            {/* Bloco 1: Nome, Categoria, etc */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
                                <div className="lg:col-span-7 space-y-4 sm:space-y-5">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1.5">Nome do Produto *</label>
                                        <input type="text" name="nome" value={formData.nome} onChange={handleFormChange} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all text-sm font-medium" placeholder="Ex: X-Burger Especial" required />
                                        {formErrors.nome && <span className="text-red-500 text-xs mt-1 block">{formErrors.nome}</span>}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1.5">Categoria *</label>
                                            <input type="text" name="categoria" value={formData.categoria} onChange={handleFormChange} list="cat-list" className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all text-sm font-medium" placeholder="Selecione ou digite..." required disabled={!!editingItem} />
                                            <datalist id="cat-list">{categories.map(c => <option key={c.id} value={c.nome} />)}</datalist>
                                            {formErrors.categoria && <span className="text-red-500 text-xs mt-1 block">{formErrors.categoria}</span>}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-1">
                                                <IoBarcodeOutline className="text-lg text-gray-500"/> Código de Barras
                                            </label>
                                            <input type="text" name="codigoBarras" value={formData.codigoBarras} onChange={handleFormChange} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-mono text-sm tracking-wider" placeholder="EAN/GTIN" />
                                        </div>
                                    </div>
                                </div>
                                <div className="lg:col-span-5 flex flex-col">
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Descrição</label>
                                    <textarea name="descricao" value={formData.descricao} onChange={handleFormChange} className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all flex-1 min-h-[100px] resize-none text-sm" placeholder="Liste os ingredientes, detalhes do preparo..." />
                                </div>
                            </div>

                            {/* Bloco 2: Precificação e Estoque */}
                            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2 text-base"><IoCash className="text-blue-600 text-xl"/> Precificação e Estoque</h3>
                                    
                                    <div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-auto">
                                        <button type="button" onClick={() => setVariacoes([{id: `var-${Date.now()}-unico`, nome: 'Padrão', preco: variacoes[0]?.preco || '', ativo: true, estoque: variacoes[0]?.estoque || 0, estoqueMinimo: variacoes[0]?.estoqueMinimo || 0, custo: variacoes[0]?.custo || 0 }])} className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-xs font-bold transition-all ${variacoes.length === 1 && variacoes[0].nome === 'Padrão' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Preço Único</button>
                                        <button type="button" onClick={() => { if(variacoes.length===1 && variacoes[0].nome==='Padrão') setVariacoes([{id: `var-${Date.now()}-multi`, nome: 'Tamanho Único', preco: variacoes[0].preco, ativo: true, estoque: variacoes[0].estoque, estoqueMinimo: variacoes[0].estoqueMinimo, custo: variacoes[0].custo}]); }} className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-xs font-bold transition-all ${variacoes.length > 1 || variacoes[0].nome !== 'Padrão' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Múltiplos Tamanhos</button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {variacoes.map((v, idx) => (
                                        <div key={v.id} className="bg-gray-50 p-4 sm:p-5 rounded-xl border border-gray-200 relative group">
                                            {variacoes.length > 1 && (
                                                <button type="button" onClick={() => removerVariacao(v.id)} className="absolute -top-3 -right-3 bg-red-100 text-red-600 p-2 rounded-full shadow-md hover:bg-red-200 transition-colors z-10">
                                                    <IoClose size={16}/>
                                                </button>
                                            )}
                                            
                                            <div className="grid grid-cols-12 gap-3 sm:gap-4">
                                                {(variacoes.length > 1 || v.nome !== 'Padrão') && (
                                                    <div className="col-span-12 sm:col-span-4">
                                                        <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase tracking-wider">Nome da Variação</label>
                                                        <input type="text" value={v.nome} onChange={e => atualizarVariacao(v.id, 'nome', e.target.value)} className="w-full p-3 sm:p-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold focus:border-blue-500 outline-none" placeholder="Ex: Grande, 500ml, etc" />
                                                        {variacoesErrors[v.id]?.nome && <span className="text-red-500 text-[10px]">{variacoesErrors[v.id].nome}</span>}
                                                    </div>
                                                )}
                                                
                                                <div className={`col-span-6 ${(variacoes.length > 1 || v.nome !== 'Padrão') ? 'sm:col-span-3' : 'sm:col-span-4'}`}>
                                                    <label className="text-xs font-bold text-emerald-600 mb-1.5 block uppercase tracking-wider">Preço Venda</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600/50 font-bold">R$</span>
                                                        <input type="number" value={v.preco} onChange={e => atualizarVariacao(v.id, 'preco', e.target.value)} className="w-full pl-9 p-3 sm:p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm font-bold text-emerald-800 focus:border-emerald-500 outline-none" placeholder="0.00" step="0.01" />
                                                    </div>
                                                    {variacoesErrors[v.id]?.preco && <span className="text-red-500 text-[10px]">{variacoesErrors[v.id].preco}</span>}
                                                </div>

                                                <div className={`col-span-6 ${(variacoes.length > 1 || v.nome !== 'Padrão') ? 'sm:col-span-2' : 'sm:col-span-3'}`}>
                                                    <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase tracking-wider">Custo (R$)</label>
                                                    <input type="number" value={v.custo} onChange={e => atualizarVariacao(v.id, 'custo', e.target.value)} className="w-full p-3 sm:p-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:border-blue-500 outline-none" placeholder="0.00" step="0.01" />
                                                </div>

                                                <div className={`col-span-12 ${(variacoes.length > 1 || v.nome !== 'Padrão') ? 'sm:col-span-3' : 'sm:col-span-2'}`}>
                                                    <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase tracking-wider">Estoque Atual / Mínimo</label>
                                                    <div className="flex gap-2">
                                                        <input type="number" value={v.estoque} onChange={e => atualizarVariacao(v.id, 'estoque', e.target.value)} className="w-full p-3 sm:p-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:border-blue-500 outline-none" placeholder="Atual" title="Estoque Atual" />
                                                        <input type="number" value={v.estoqueMinimo} onChange={e => atualizarVariacao(v.id, 'estoqueMinimo', e.target.value)} className="w-full p-3 sm:p-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:border-orange-500 outline-none" placeholder="Mínimo" title="Estoque Mínimo" />
                                                    </div>
                                                </div>

                                                <div className="col-span-12 flex items-center justify-between sm:justify-end mt-2 sm:mt-0 bg-white sm:bg-transparent p-2 sm:p-0 rounded-lg border sm:border-0 border-gray-200">
                                                     <span className="text-sm font-bold text-gray-700 sm:hidden">Variação Ativa?</span>
                                                     <label className="flex items-center gap-2 cursor-pointer bg-gray-50 sm:bg-white px-3 py-2 rounded-lg border border-gray-200">
                                                        <input type="checkbox" checked={v.ativo !== false} onChange={e => atualizarVariacao(v.id, 'ativo', e.target.checked)} className="w-5 h-5 sm:w-4 sm:h-4 rounded text-blue-600 focus:ring-blue-500" />
                                                        <span className="text-xs font-bold text-gray-600 hidden sm:block">Ativa</span>
                                                     </label>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {(variacoes.length > 1 || (variacoes.length === 1 && variacoes[0].nome !== 'Padrão')) && (
                                    <button type="button" onClick={adicionarVariacao} className="mt-5 w-full py-3.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-sm flex items-center justify-center gap-2 rounded-xl transition-colors border border-blue-100 border-dashed">
                                        <IoAddCircleOutline className="text-xl"/> Adicionar Outro Tamanho / Variação
                                    </button>
                                )}
                                {formErrors.variacoes && <p className="text-red-500 text-sm mt-3 text-center bg-red-50 p-3 rounded-xl border border-red-100">{formErrors.variacoes}</p>}
                            </div>

                            {/* Bloco 3: Fiscal */}
                            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-emerald-100 shadow-sm">
                                <h3 className="font-bold text-emerald-800 mb-4 flex items-center gap-2 text-base">
                                    🏢 Dados para Emissão de Nota (NFC-e)
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
                                    <div className="relative bg-emerald-50/50 p-3 rounded-xl border border-emerald-50">
                                        <label className="block text-xs font-bold text-emerald-700 mb-1.5" title="Nomenclatura Comum do Mercosul">
                                            Busca NCM (Nome ou Código)
                                        </label>
                                        <input 
                                            type="text" 
                                            name="ncm" 
                                            value={termoNcm || formData.fiscal?.ncm || ''} 
                                            onChange={(e) => buscarNcm(e.target.value)} 
                                            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }} 
                                            className="w-full p-3 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all shadow-sm" 
                                            placeholder="Ex: Água, Hambúrguer, 2202..." 
                                            autoComplete="off"
                                        />
                                        
                                        {pesquisandoNcm && <span className="absolute right-6 top-12 text-xs font-bold text-emerald-500 animate-pulse">Buscando...</span>}
                                        
                                        {ncmResultados.length > 0 && (
                                            <div className="absolute z-50 w-full mt-2 bg-white border border-emerald-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                                                {ncmResultados.map((item) => (
                                                    <div 
                                                        key={item.codigo} 
                                                        onClick={() => selecionarNcm(item.codigo)}
                                                        className="p-3 border-b border-gray-100 hover:bg-emerald-50 cursor-pointer transition-colors"
                                                    >
                                                        <p className="font-bold text-emerald-800 text-sm">{item.codigo}</p>
                                                        <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">{item.descricao}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-50">
                                        <label className="block text-xs font-bold text-emerald-700 mb-1.5">CFOP (Tipo de Venda)</label>
                                        <select name="cfop" value={formData.fiscal?.cfop || ''} onChange={handleFiscalChange} className="w-full p-3 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all shadow-sm">
                                            <option value="5102">5102 - Tributado (Lanches, Refeições)</option>
                                            <option value="5405">5405 - Subst. Tributária (Refrigerantes, Cervejas)</option>
                                        </select>
                                    </div>
                                    <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-50">
                                        <label className="block text-xs font-bold text-emerald-700 mb-1.5">Medida Comercial</label>
                                        <select name="unidade" value={formData.fiscal?.unidade || 'UN'} onChange={handleFiscalChange} className="w-full p-3 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all shadow-sm">
                                            <option value="UN">UN - Unidade</option>
                                            <option value="KG">KG - Quilograma</option>
                                            <option value="LT">LT - Litro</option>
                                            <option value="CX">CX - Caixa</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Bloco 4: Imagem e Visibilidade */}
                            <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
                                <div className="flex-1 flex gap-4 items-center bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm">
                                     <div className="w-20 h-20 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                                        {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" /> : <IoImageOutline className="text-3xl text-gray-300"/>}
                                     </div>
                                     <div className="flex-1">
                                         <label className="block text-sm font-bold text-gray-700 mb-2">Foto do Produto</label>
                                         <input type="file" accept="image/*" onChange={handleFormChange} className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer transition-colors" />
                                     </div>
                                </div>

                                <div className="sm:w-1/3 bg-blue-50 p-4 sm:p-5 rounded-2xl border border-blue-100 flex items-center justify-center shadow-sm">
                                    <label htmlFor="ativoMain" className="flex items-center justify-between sm:justify-center gap-3 cursor-pointer w-full">
                                        <div className="flex flex-col sm:text-right">
                                            <span className="text-sm font-bold text-gray-800">Cardápio Digital</span>
                                            <span className="text-xs font-medium text-gray-500">{formData.ativo ? 'Visível aos clientes' : 'Oculto'}</span>
                                        </div>
                                        <div className={`w-14 h-7 rounded-full p-1 transition-colors duration-300 ease-in-out shadow-inner ${formData.ativo ? 'bg-blue-600' : 'bg-gray-300'}`}>
                                            <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 ease-in-out ${formData.ativo ? 'translate-x-7' : 'translate-x-0'}`}></div>
                                        </div>
                                        <input type="checkbox" id="ativoMain" name="ativo" checked={formData.ativo} onChange={handleFormChange} className="hidden" />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. RODAPÉ FIXO NO FUNDO DA TELA (pb-8 para afastar da barra do iPhone) */}
                    <div className="flex-none bg-white border-t border-gray-100 p-4 pb-8 sm:p-6 sm:pb-6 flex gap-3 sm:gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.08)]">
                        <button type="button" onClick={closeItemForm} className="hidden sm:block px-8 py-4 bg-gray-100 border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">
                            Cancelar
                        </button>
                        <button type="button" onClick={closeItemForm} className="sm:hidden w-1/3 py-4 bg-gray-100 border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center">
                            Voltar
                        </button>
                        
                        <button type="submit" disabled={formLoading} className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:scale-100 text-base sm:text-lg flex justify-center items-center gap-2">
                            {formLoading ? (
                                <>Salvando...</>
                            ) : (
                                <><IoCheckmarkCircle size={22}/> Salvar Alterações</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        )}

        {showActivateAllModal && (
             <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-sm transform transition-all scale-100">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <IoRefresh className="text-3xl text-green-600"/>
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-gray-800">Ativar Todos?</h3>
                    <p className="text-gray-500 mb-6 text-sm">Isso ativará todos os itens que estão invisíveis no cardápio atualmente.</p>
                    <div className="flex gap-3">
                        <button onClick={() => setShowActivateAllModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">Cancelar</button>
                        <button onClick={activateAllItems} disabled={bulkOperationLoading} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-200 transition-colors">
                            {bulkOperationLoading ? 'Ativando...' : 'Confirmar'}
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}

export default withEstablishmentAuth(AdminMenuManagement);
