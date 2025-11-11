// src/pages/AdminMenuManagement.jsx - VERSÃO COMPLETA E CORRIGIDA
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { uploadFile, deleteFileByUrl } from '../utils/firebaseStorageService';
import AdminProductCard from '../components/AdminProductCard';
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
    IoChevronUp,
    IoChevronDown,
    IoSwapVertical,
    IoCube,
    IoCash,
    IoStatsChart,
    IoSaveOutline
} from 'react-icons/io5';

function AdminMenuManagement() {
    const { userData } = useAuth();

    console.log("🔍 Debug Auth no AdminMenuManagement - ESTRUTURA COMPLETA:", {
        userData,
        userDataKeys: userData ? Object.keys(userData) : 'no userData',
        estabelecimentos: userData?.estabelecimentos,
        estabelecimentosGerenciados: userData?.estabelecimentosGerenciados
    });

    const [establishmentName, setEstablishmentName] = useState('');
    const [menuItems, setMenuItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    
    // 🆕 Estado para menu mobile
    const [showMobileFilters, setShowMobileFilters] = useState(false);

    // 🔄 Estado para ordenação
    const [sortConfig, setSortConfig] = useState({
        key: 'nome',
        direction: 'asc'
    });

    // 📦 Estado para filtro de estoque
    const [stockFilter, setStockFilter] = useState('todos');

    const [showItemForm, setShowItemForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        nome: '',
        descricao: '',
        preco: '',
        categoria: '',
        imageUrl: '',
        ativo: true,
        estoque: '',
        estoqueMinimo: '',
        custo: ''
    });
    const [itemImage, setItemImage] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [formLoading, setFormLoading] = useState(false);

    // ✅ Busca robusta pelo ID do Estabelecimento
    const primeiroEstabelecimento = useMemo(() => {
        let estabelecimento = null;
        
        if (Array.isArray(userData?.estabelecimentosGerenciados) && userData.estabelecimentosGerenciados.length > 0) {
            estabelecimento = userData.estabelecimentosGerenciados[0];
        }

        if (!estabelecimento) {
            const estabelecimentosData = userData?.estabelecimentos;
            if (Array.isArray(estabelecimentosData) && estabelecimentosData.length > 0) {
                estabelecimento = estabelecimentosData[0];
            } else if (estabelecimentosData && typeof estabelecimentosData === 'object' && !Array.isArray(estabelecimentosData)) {
                const keys = Object.keys(estabelecimentosData);
                if (keys.length > 0) {
                    estabelecimento = keys[0];
                }
            }
        }

        const finalId = (typeof estabelecimento === 'string' && estabelecimento.length > 0 && estabelecimento !== '0')
            ? estabelecimento
            : null;

        console.log("🏪 Estabelecimento encontrado:", finalId);
        return finalId;
    }, [userData]);

    // Busca o nome do estabelecimento
    useEffect(() => {
        if (primeiroEstabelecimento) {
            const fetchEstablishmentName = async () => {
                try {
                    const estabDoc = await getDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento));
                    if (estabDoc.exists()) {
                        setEstablishmentName(estabDoc.data().nome);
                    } else {
                        console.error("❌ Estabelecimento não encontrado:", primeiroEstabelecimento);
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

    // Listener para categorias e itens
    useEffect(() => {
        if (!primeiroEstabelecimento) {
            setLoading(false);
            return;
        }

        setLoading(true);
        console.log("📦 Buscando cardápio para:", primeiroEstabelecimento);

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
                const itensRef = collection(
                    db,
                    'estabelecimentos',
                    primeiroEstabelecimento,
                    'cardapio',
                    catDoc.id,
                    'itens'
                );
                const qItens = query(itensRef, orderBy('nome', 'asc'));

                const unsubscribeItens = onSnapshot(qItens, (itensSnapshot) => {
                    const itemsDaCategoria = itensSnapshot.docs.map(itemDoc => ({
                        ...itemDoc.data(),
                        id: itemDoc.id,
                        categoria: categoriaData.nome,
                        categoriaId: catDoc.id,
                        criadoEm: itemDoc.data().criadoEm?.toDate() || new Date(),
                        atualizadoEm: itemDoc.data().atualizadoEm?.toDate() || new Date(),
                        estoque: itemDoc.data().estoque || 0,
                        estoqueMinimo: itemDoc.data().estoqueMinimo || 0,
                        custo: itemDoc.data().custo || 0
                    }));

                    allItems = [
                        ...allItems.filter(item => item.categoriaId !== catDoc.id),
                        ...itemsDaCategoria
                    ];

                    setMenuItems(allItems);
                });

                unsubscribers.push(unsubscribeItens);
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

    // 🔄 Função para ordenação
    const handleSort = (key) => {
        setSortConfig(prevConfig => ({
            key,
            direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

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
    const ITEMS_PER_PAGE = 8; // 📱 Reduzido para mobile
    const {
        currentPage,
        totalPages,
        paginatedItems,
        goToPage,
    } = usePagination(filteredAndSortedItems, ITEMS_PER_PAGE);

    // Funções de ícone de sort
    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <IoSwapVertical className="text-gray-400 text-sm" />;
        return sortConfig.direction === 'asc' ? <IoChevronUp className="text-blue-600 text-sm" /> : <IoChevronDown className="text-blue-600 text-sm" />;
    };

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
        return { totalItems, criticalStock, lowStock, outOfStock, normalStock, totalInventoryValue };
    }, [menuItems]);

    // 🛠️ FUNÇÕES PRINCIPAIS COMPLETAS

    const handleSaveItem = async (e) => {
        e.preventDefault();
        setFormLoading(true);

        try {
            if (!primeiroEstabelecimento) {
                toast.error("Estabelecimento não configurado");
                return;
            }

            // Validar dados obrigatórios
            if (!formData.nome.trim() || !formData.preco || !formData.categoria.trim()) {
                toast.error("Preencha nome, preço e categoria");
                setFormLoading(false);
                return;
            }

            let imageUrl = formData.imageUrl;

            // Upload de imagem se houver
            if (itemImage) {
                try {
                    const uploadResult = await uploadFile(itemImage, `estabelecimentos/${primeiroEstabelecimento}/cardapio`);
                    imageUrl = uploadResult.url;
                    
                    // Deletar imagem antiga se estiver editando
                    if (editingItem && editingItem.imageUrl && editingItem.imageUrl !== imageUrl) {
                        await deleteFileByUrl(editingItem.imageUrl);
                    }
                } catch (error) {
                    console.error("Erro no upload da imagem:", error);
                    toast.error("Erro ao fazer upload da imagem");
                    setFormLoading(false);
                    return;
                }
            }

            // Encontrar a categoria
            const categoriaDoc = categories.find(cat => cat.nome === formData.categoria);
            if (!categoriaDoc && !editingItem) {
                toast.error("Categoria não encontrada");
                setFormLoading(false);
                return;
            }

            const itemData = {
                nome: formData.nome.trim(),
                descricao: formData.descricao.trim(),
                preco: Number(formData.preco),
                categoria: formData.categoria.trim(),
                imageUrl: imageUrl,
                ativo: formData.ativo,
                estoque: Number(formData.estoque) || 0,
                estoqueMinimo: Number(formData.estoqueMinimo) || 0,
                custo: Number(formData.custo) || 0,
                atualizadoEm: new Date()
            };

            if (editingItem) {
                // Atualizar item existente
                const itemRef = doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', editingItem.categoriaId, 'itens', editingItem.id);
                await updateDoc(itemRef, itemData);
                toast.success("✅ Item atualizado com sucesso!");
            } else {
                // Criar novo item
                itemData.criadoEm = new Date();
                const itensRef = collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', categoriaDoc.id, 'itens');
                await addDoc(itensRef, itemData);
                toast.success("✅ Item adicionado com sucesso!");
            }

            closeItemForm();
        } catch (error) {
            console.error("❌ Erro ao salvar item:", error);
            toast.error("❌ Erro ao salvar item");
        } finally {
            setFormLoading(false);
        }
    };

    const handleDeleteItem = async (item) => {
        if (!window.confirm(`Tem certeza que deseja excluir "${item.nome}"?`)) {
            return;
        }

        try {
            // Deletar imagem se existir
            if (item.imageUrl) {
                await deleteFileByUrl(item.imageUrl);
            }

            // Deletar item do Firestore
            const itemRef = doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', item.categoriaId, 'itens', item.id);
            await deleteDoc(itemRef);
            
            toast.success("🗑️ Item excluído com sucesso!");
        } catch (error) {
            console.error("❌ Erro ao excluir item:", error);
            toast.error("❌ Erro ao excluir item");
        }
    };

    const toggleItemStatus = async (item) => {
        try {
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

    const openItemForm = (item = null) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                nome: item.nome || '',
                descricao: item.descricao || '',
                preco: item.preco || '',
                categoria: item.categoria || '',
                imageUrl: item.imageUrl || '',
                ativo: item.ativo !== undefined ? item.ativo : true,
                estoque: item.estoque || '',
                estoqueMinimo: item.estoqueMinimo || '',
                custo: item.custo || ''
            });
            setImagePreview(item.imageUrl || '');
        } else {
            setEditingItem(null);
            setFormData({
                nome: '',
                descricao: '',
                preco: '',
                categoria: '',
                imageUrl: '',
                ativo: true,
                estoque: '',
                estoqueMinimo: '',
                custo: ''
            });
            setImagePreview('');
        }
        setItemImage(null);
        setShowItemForm(true);
    };

    const closeItemForm = () => {
        setShowItemForm(false);
        setEditingItem(null);
        setFormData({
            nome: '',
            descricao: '',
            preco: '',
            categoria: '',
            imageUrl: '',
            ativo: true,
            estoque: '',
            estoqueMinimo: '',
            custo: ''
        });
        setImagePreview('');
        setItemImage(null);
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked, files } = e.target;
        
        if (type === 'file') {
            const file = files[0];
            if (file) {
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

    const quickUpdateStock = async (itemId, newStock) => {
        try {
            const item = menuItems.find(item => item.id === itemId);
            if (!item) {
                toast.error("Item não encontrado");
                return;
            }

            const itemRef = doc(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio', item.categoriaId, 'itens', itemId);
            await updateDoc(itemRef, {
                estoque: Number(newStock),
                atualizadoEm: new Date()
            });
            
            toast.success("📦 Estoque atualizado!");
        } catch (error) {
            console.error("❌ Erro ao atualizar estoque:", error);
            toast.error("❌ Erro ao atualizar estoque");
        }
    };

    // Estatísticas
    const estatisticas = {
        total: menuItems.length,
        ativos: menuItems.filter(item => item.ativo).length,
        inativos: menuItems.filter(item => !item.ativo).length,
        categorias: availableCategories.length - 1,
        estoqueCritico: stockStatistics.criticalStock,
        estoqueBaixo: stockStatistics.lowStock,
        esgotados: stockStatistics.outOfStock,
        valorTotalEstoque: stockStatistics.totalInventoryValue
    };

    // Telas de Erro e Loading
    if (!primeiroEstabelecimento) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-md w-full text-center">
                    <IoAlertCircle className="text-red-600 text-2xl mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-gray-900 mb-2">
                        Estabelecimento Não Configurado
                    </h2>
                    <p className="text-gray-600 text-sm mb-4">
                        Configure seu estabelecimento para gerenciar o cardápio.
                    </p>
                    <Link 
                        to="/dashboard" 
                        className="inline-flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors w-full"
                    >
                        <IoArrowBack className="text-sm" />
                        <span>Voltar ao Dashboard</span>
                    </Link>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="mt-3 text-gray-600 text-sm">Carregando cardápio...</p>
                </div>
            </div>
        );
    }

    // =========================================================================
    // RENDERIZAÇÃO OTIMIZADA PARA MOBILE
    // =========================================================================
    return (
        <div className="min-h-screen bg-gray-50 p-3 sm:p-4">
            <div className="max-w-7xl mx-auto">
                {/* Header Mobile Optimized */}
                <header className="flex flex-col space-y-3 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <Link 
                                to="/dashboard" 
                                className="flex items-center justify-center w-10 h-10 bg-white hover:bg-gray-50 text-gray-700 rounded-lg border border-gray-300 transition-colors"
                            >
                                <IoArrowBack className="text-lg" />
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">
                                    Gerenciar Cardápio
                                </h1>
                                <p className="text-xs text-gray-500">
                                    {establishmentName || 'Carregando...'}
                                </p>
                            </div>
                        </div>
                        
                        <button
                            onClick={() => setShowMobileFilters(!showMobileFilters)}
                            className="lg:hidden flex items-center justify-center w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                            <IoFilter className="text-lg" />
                        </button>
                    </div>

                    {/* Botão Adicionar em posição fixa para mobile */}
                    <button
                        onClick={() => openItemForm()}
                        className="lg:hidden flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg shadow-lg transition-colors w-full"
                    >
                        <IoAddCircleOutline className="text-lg" />
                        <span>Adicionar Item</span>
                    </button>
                </header>

                {/* Estatísticas - Grid Responsiva */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 text-center">
                        <p className="text-xs font-medium text-gray-600 mb-1">Total</p>
                        <p className="text-lg font-bold text-gray-900">{estatisticas.total}</p>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 text-center">
                        <p className="text-xs font-medium text-gray-600 mb-1">Ativos</p>
                        <p className="text-lg font-bold text-green-600">{estatisticas.ativos}</p>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 text-center">
                        <p className="text-xs font-medium text-gray-600 mb-1">Crítico</p>
                        <p className="text-lg font-bold text-red-600">{estatisticas.estoqueCritico}</p>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 text-center">
                        <p className="text-xs font-medium text-gray-600 mb-1">Baixo</p>
                        <p className="text-lg font-bold text-orange-600">{estatisticas.estoqueBaixo}</p>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 text-center">
                        <p className="text-xs font-medium text-gray-600 mb-1">Esgotados</p>
                        <p className="text-lg font-bold text-gray-600">{estatisticas.esgotados}</p>
                    </div>
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 text-center">
                        <p className="text-xs font-medium text-gray-600 mb-1">Valor Estoque</p>
                        <p className="text-sm font-bold text-blue-600">
                            R$ {(estatisticas.valorTotalEstoque || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>

                {/* Barra de Pesquisa Mobile */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
                    <div className="relative">
                        <IoSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg" />
                        <input
                            type="text"
                            placeholder="Buscar itens..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base"
                        />
                    </div>
                </div>

                {/* Filtros Mobile - Collapsible */}
                <div className={`lg:hidden bg-white rounded-xl shadow-sm border border-gray-200 mb-4 transition-all duration-300 ${
                    showMobileFilters ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
                }`}>
                    <div className="p-4 space-y-4">
                        {/* Filtro de Categoria */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Categoria
                            </label>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base"
                            >
                                {availableCategories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        {/* Filtro de Estoque */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Status do Estoque
                            </label>
                            <select
                                value={stockFilter}
                                onChange={(e) => setStockFilter(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base"
                            >
                                <option value="todos">Todos</option>
                                <option value="normal">Estoque Normal</option>
                                <option value="baixo">Estoque Baixo</option>
                                <option value="critico">Estoque Crítico</option>
                                <option value="esgotado">Esgotados</option>
                            </select>
                        </div>

                        {/* Ordenação Mobile */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Ordenar por
                            </label>
                            <select
                                value={sortConfig.key}
                                onChange={(e) => handleSort(e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base"
                            >
                                <option value="nome">Nome (A-Z)</option>
                                <option value="preco">Preço</option>
                                <option value="estoque">Estoque</option>
                                <option value="ativo">Status</option>
                                <option value="criadoEm">Data de Criação</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Filtros Desktop */}
                <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                        <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="w-full sm:w-48 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            >
                                {availableCategories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>

                            <select
                                value={stockFilter}
                                onChange={(e) => setStockFilter(e.target.value)}
                                className="w-full sm:w-48 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            >
                                <option value="todos">Todos os Estoques</option>
                                <option value="normal">Estoque Normal</option>
                                <option value="baixo">Estoque Baixo</option>
                                <option value="critico">Estoque Crítico</option>
                                <option value="esgotado">Esgotados</option>
                            </select>
                        </div>

                        <button
                            onClick={() => openItemForm()}
                            className="hidden lg:flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                        >
                            <IoAddCircleOutline className="text-lg" />
                            <span>Adicionar Item</span>
                        </button>
                    </div>
                </div>

                {/* Lista de Itens */}
                <div className="space-y-3 mb-6">
                    {paginatedItems.length > 0 ? (
                        paginatedItems.map(item => (
                            <AdminProductCard
                                key={item.id}
                                produto={item}
                                onEdit={() => openItemForm(item)}
                                onDelete={() => handleDeleteItem(item)}
                                onToggleStatus={() => toggleItemStatus(item)}
                                onUpdateStock={(newStock) => quickUpdateStock(item.id, newStock)}
                                stockStatus={getStockStatus(item)}
                                profitMargin={calculateProfitMargin(item.preco, item.custo)}
                                isMobile={true}
                            />
                        ))
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                            <IoCube className="text-4xl text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                Nenhum item encontrado
                            </h3>
                            <p className="text-gray-600 mb-4">
                                {searchTerm || selectedCategory !== 'Todos' || stockFilter !== 'todos' 
                                    ? 'Tente ajustar os filtros de busca.'
                                    : 'Comece adicionando itens ao seu cardápio.'
                                }
                            </p>
                            <button
                                onClick={() => openItemForm()}
                                className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                            >
                                <IoAddCircleOutline />
                                <span>Adicionar Primeiro Item</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Paginação */}
                {filteredAndSortedItems.length > ITEMS_PER_PAGE && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={goToPage}
                            isMobile={true}
                        />
                    </div>
                )}
            </div>

            {/* Modal do Formulário - Mobile Optimized */}
            {showItemForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end lg:items-center justify-center p-0 lg:p-4 z-50">
                    <div className="bg-white rounded-t-2xl lg:rounded-2xl shadow-2xl w-full lg:max-w-md max-h-[85vh] lg:max-h-[90vh] overflow-y-auto lg:m-auto">
                        {/* Header do Modal */}
                        <div className="flex items-center justify-between p-4 lg:p-6 border-b border-gray-200 sticky top-0 bg-white">
                            <h2 className="text-lg lg:text-xl font-semibold text-gray-900">
                                {editingItem ? 'Editar Item' : 'Novo Item'}
                            </h2>
                            <button
                                onClick={closeItemForm}
                                className="flex items-center justify-center w-8 h-8 lg:w-10 lg:h-10 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <IoClose className="text-xl" />
                            </button>
                        </div>

                        {/* Formulário */}
                        <form onSubmit={handleSaveItem} className="p-4 lg:p-6 space-y-4">
                            {/* Nome */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Nome do Item *
                                </label>
                                <input
                                    name="nome"
                                    value={formData.nome}
                                    onChange={handleFormChange}
                                    placeholder="Ex: X-Burger Especial"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base"
                                    required
                                />
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
                                    placeholder="Descreva o item..."
                                    rows="2"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base resize-none"
                                />
                            </div>

                            {/* Preço e Categoria em linha no mobile */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Preço *
                                    </label>
                                    <input
                                        name="preco"
                                        type="number"
                                        step="0.01"
                                        value={formData.preco}
                                        onChange={handleFormChange}
                                        placeholder="0.00"
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Categoria *
                                    </label>
                                    <input
                                        name="categoria"
                                        value={formData.categoria}
                                        onChange={handleFormChange}
                                        placeholder="Ex: Burguers"
                                        list="categories-list"
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base"
                                        disabled={!!editingItem}
                                        required
                                    />
                                    <datalist id="categories-list">
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.nome} />
                                        ))}
                                    </datalist>
                                </div>
                            </div>

                            {/* Seção de Estoque */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
                                    <IoStatsChart className="mr-2" />
                                    Controle de Estoque
                                </h3>
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="block text-xs font-medium text-blue-700 mb-1">
                                            Estoque
                                        </label>
                                        <input
                                            name="estoque"
                                            type="number"
                                            value={formData.estoque}
                                            onChange={handleFormChange}
                                            placeholder="0"
                                            className="w-full p-2 border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-blue-700 mb-1">
                                            Mínimo
                                        </label>
                                        <input
                                            name="estoqueMinimo"
                                            type="number"
                                            value={formData.estoqueMinimo}
                                            onChange={handleFormChange}
                                            placeholder="5"
                                            className="w-full p-2 border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-blue-700 mb-1">
                                            Custo R$
                                        </label>
                                        <input
                                            name="custo"
                                            type="number"
                                            step="0.01"
                                            value={formData.custo}
                                            onChange={handleFormChange}
                                            placeholder="0.00"
                                            className="w-full p-2 border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Imagem */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Imagem do Item
                                </label>
                                <div className="flex items-center space-x-3">
                                    <div className="flex-shrink-0">
                                        {imagePreview ? (
                                            <img
                                                src={imagePreview}
                                                alt="Preview"
                                                className="w-16 h-16 rounded-lg object-cover border border-gray-300"
                                            />
                                        ) : (
                                            <div className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                                                <IoImageOutline className="text-xl" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFormChange}
                                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            PNG, JPG, WEBP até 5MB
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Status Ativo */}
                            <div className="flex items-center space-x-3">
                                <input
                                    name="ativo"
                                    type="checkbox"
                                    checked={formData.ativo}
                                    onChange={handleFormChange}
                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <label className="text-sm font-medium text-gray-700">
                                    Item ativo no cardápio
                                </label>
                            </div>

                            {editingItem && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                    <p className="text-xs text-yellow-800">
                                        <strong>Atenção:</strong> A categoria não pode ser alterada após a criação do item.
                                    </p>
                                </div>
                            )}

                            {/* Botões */}
                            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
                                <button
                                    type="submit"
                                    disabled={formLoading}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                                >
                                    {formLoading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Salvando...</span>
                                        </>
                                    ) : (
                                        <>
                                            <IoSaveOutline className="text-lg" />
                                            <span>{editingItem ? 'Salvar' : 'Adicionar'}</span>
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={closeItemForm}
                                    className="px-6 py-3 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                                >
                                    <IoClose className="text-lg" />
                                    <span>Cancelar</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default withEstablishmentAuth(AdminMenuManagement);