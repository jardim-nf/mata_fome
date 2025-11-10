// src/pages/AdminMenuManagement.jsx - VERSÃO COMPLETA CORRIGIDA
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
    IoPencil,
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
    IoStatsChart
} from 'react-icons/io5';

function AdminMenuManagement() {
    const { userData } = useAuth();
    
    console.log("🔍 Debug Auth no AdminMenuManagement - ESTRUTURA COMPLETA:", {
        userData,
        userDataKeys: userData ? Object.keys(userData) : 'no userData',
        // Verifica todos os campos possíveis de estabelecimentos
        estabelecimentos: userData?.estabelecimentos,
        estabelecimentosGerenciados: userData?.estabelecimentosGerenciados,
        estabelecimentosCerenciados: userData?.estabelecimentosCerenciados
    });

    const [establishmentName, setEstablishmentName] = useState('');
    const [menuItems, setMenuItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    
    // 🔄 Estado para ordenação
    const [sortConfig, setSortConfig] = useState({
        key: 'nome',      // nome, preco, ativo, criadoEm, estoque
        direction: 'asc'  // asc, desc
    });

    // 📦 NOVO: Estado para filtro de estoque
    const [stockFilter, setStockFilter] = useState('todos'); // todos, baixo, critico, normal
    
    const [showItemForm, setShowItemForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({ 
        nome: '', 
        descricao: '', 
        preco: '', 
        categoria: '', 
        imageUrl: '', 
        ativo: true,
        // 📦 NOVO: Campos de estoque
        estoque: '',
        estoqueMinimo: '',
        custo: ''
    });
    const [itemImage, setItemImage] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [formLoading, setFormLoading] = useState(false);

    // 🔧 CORREÇÃO: Busca o estabelecimento com o nome CORRETO baseado na sua estrutura
    const primeiroEstabelecimento = useMemo(() => {
        // Tenta na ordem: estabelecimentosCerenciados, depois estabelecimentos, depois estabelecimentosGerenciados
        const estabelecimento = userData?.estabelecimentosCerenciados?.[0] || // ✅ NOME CORRETO baseado no seu Firebase
                               userData?.estabelecimentos?.[0] ||
                               userData?.estabelecimentosGerenciados?.[0] ||
                               null;
        
        console.log("🏪 Estabelecimento encontrado:", estabelecimento);
        return estabelecimento;
    }, [userData]);

    console.log("🏪 Estabelecimento selecionado:", primeiroEstabelecimento);

    // Busca o nome do estabelecimento
    useEffect(() => {
        if (primeiroEstabelecimento) {
            const fetchEstablishmentName = async () => {
                try {
                    const estabDoc = await getDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento));
                    if (estabDoc.exists()) {
                        setEstablishmentName(estabDoc.data().nome);
                        console.log("🏪 Nome do estabelecimento:", estabDoc.data().nome);
                    } else {
                        console.error("❌ Estabelecimento não encontrado no Firestore:", primeiroEstabelecimento);
                        toast.error("Estabelecimento não encontrado");
                    }
                } catch (error) {
                    console.error("Erro ao buscar nome do estabelecimento:", error);
                    toast.error("Erro ao carregar dados do estabelecimento");
                }
            };
            fetchEstablishmentName();
        } else {
            console.log("❌ Nenhum estabelecimento disponível");
            toast.error("Nenhum estabelecimento configurado para este usuário");
        }
    }, [primeiroEstabelecimento]);

    // Listener para categorias e itens
    useEffect(() => {
        if (!primeiroEstabelecimento) {
            console.log("❌ Nenhum estabelecimento disponível para carregar cardápio");
            setLoading(false);
            return;
        }

        setLoading(true);
        console.log("📦 Buscando cardápio para estabelecimento:", primeiroEstabelecimento);

        const categoriasRef = collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio');
        const qCategorias = query(categoriasRef, orderBy('ordem', 'asc'));

        const unsubscribeCategorias = onSnapshot(qCategorias, (categoriasSnapshot) => {
            console.log("📁 Categorias encontradas:", categoriasSnapshot.docs.length);
            
            const fetchedCategories = categoriasSnapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            }));
            setCategories(fetchedCategories);

            const unsubscribers = [];
            let allItems = [];

            if (categoriasSnapshot.empty) {
                console.log("ℹ️ Nenhuma categoria encontrada");
                setMenuItems([]);
                setLoading(false);
                return;
            }

            categoriasSnapshot.forEach(catDoc => {
                const categoriaData = catDoc.data();
                console.log(`🔍 Buscando itens na categoria: ${catDoc.id} (${categoriaData.nome})`);
                
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
                    console.log(`📦 Itens na categoria ${catDoc.id}:`, itensSnapshot.docs.length);
                    
                    const itemsDaCategoria = itensSnapshot.docs.map(itemDoc => ({
                        ...itemDoc.data(),
                        id: itemDoc.id,
                        categoria: categoriaData.nome,
                        categoriaId: catDoc.id,
                        criadoEm: itemDoc.data().criadoEm?.toDate() || new Date(),
                        atualizadoEm: itemDoc.data().atualizadoEm?.toDate() || new Date(),
                        // 📦 NOVO: Garantir que estoque tenha valor padrão
                        estoque: itemDoc.data().estoque || 0,
                        estoqueMinimo: itemDoc.data().estoqueMinimo || 0,
                        custo: itemDoc.data().custo || 0
                    }));

                    allItems = [
                        ...allItems.filter(item => item.categoriaId !== catDoc.id),
                        ...itemsDaCategoria
                    ];
                    
                    setMenuItems(allItems);
                }, (error) => {
                    console.error(`❌ Erro ao ouvir itens da categoria ${catDoc.id}:`, error);
                    toast.error("❌ Erro ao carregar itens de uma categoria.");
                });

                unsubscribers.push(unsubscribeItens);
            });

            setLoading(false);
            
            return () => {
                console.log("🧹 Limpando listeners de itens");
                unsubscribers.forEach(unsub => unsub());
            };
        }, (error) => {
            console.error("❌ Erro ao carregar categorias:", error);
            toast.error("❌ Erro ao carregar categorias do cardápio.");
            setLoading(false);
        });

        return () => {
            console.log("🧹 Limpando listener de categorias");
            unsubscribeCategorias();
        };
    }, [primeiroEstabelecimento]);

    // 🔄 Função para ordenação
    const handleSort = (key) => {
        setSortConfig(prevConfig => ({
            key,
            direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // 🔄 Opções de ordenação - 📦 ADICIONADO ESTOQUE
    const sortOptions = [
        { key: 'nome', label: 'Nome', icon: 'AZ' },
        { key: 'preco', label: 'Preço', icon: '💰' },
        { key: 'estoque', label: 'Estoque', icon: '📦' },
        { key: 'ativo', label: 'Status', icon: '🔄' },
        { key: 'criadoEm', label: 'Data Criação', icon: '📅' }
    ];

    // 📦 NOVO: Função para determinar status do estoque
    const getStockStatus = (item) => {
        if (item.estoque === 0) return 'esgotado';
        if (item.estoque <= (item.estoqueMinimo || 0)) return 'critico';
        if (item.estoque <= ((item.estoqueMinimo || 0) * 2)) return 'baixo';
        return 'normal';
    };

    // 📦 NOVO: Função para calcular margem de lucro
    const calculateProfitMargin = (precoVenda, custo) => {
        if (!custo || custo <= 0) return 0;
        return ((precoVenda - custo) / precoVenda) * 100;
    };

    // Filtragem e ordenação dos itens - 📦 ATUALIZADO COM FILTRO DE ESTOQUE
    const availableCategories = useMemo(() => 
        ['Todos', ...new Set(menuItems.map(item => item.categoria).filter(Boolean))], 
        [menuItems]
    );
    
    const filteredAndSortedItems = useMemo(() => {
        // Primeiro filtra
        let filtered = menuItems.filter(item =>
            (selectedCategory === 'Todos' || item.categoria === selectedCategory) &&
            (item.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) &&
            (stockFilter === 'todos' || 
             (stockFilter === 'critico' && getStockStatus(item) === 'critico') ||
             (stockFilter === 'baixo' && getStockStatus(item) === 'baixo') ||
             (stockFilter === 'esgotado' && getStockStatus(item) === 'esgotado') ||
             (stockFilter === 'normal' && getStockStatus(item) === 'normal'))
        );

        // Depois ordena
        filtered.sort((a, b) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];
            
            // Tratamento especial para diferentes tipos de dados
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
            
            if (aValue < bValue) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });

        return filtered;
    }, [menuItems, searchTerm, selectedCategory, sortConfig, stockFilter]);

    // Paginação
    const ITEMS_PER_PAGE = 10;
    const {
        currentPage,
        totalPages,
        paginatedItems,
        goToPage,
        nextPage,
        prevPage,
        hasNextPage,
        hasPrevPage
    } = usePagination(filteredAndSortedItems, ITEMS_PER_PAGE);

    // 🔄 Função para obter ícone de ordenação
    const getSortIcon = (key) => {
        if (sortConfig.key !== key) {
            return <IoSwapVertical className="text-gray-400" />;
        }
        return sortConfig.direction === 'asc' 
            ? <IoChevronUp className="text-blue-600" />
            : <IoChevronDown className="text-blue-600" />;
    };

    // 🔄 Função para obter texto de ordenação
    const getSortLabel = (key) => {
        if (sortConfig.key !== key) return '';
        return sortConfig.direction === 'asc' ? ' (A-Z)' : ' (Z-A)';
    };

    // 📦 NOVO: Estatísticas de estoque
    const stockStatistics = useMemo(() => {
        const totalItems = menuItems.length;
        const criticalStock = menuItems.filter(item => getStockStatus(item) === 'critico').length;
        const lowStock = menuItems.filter(item => getStockStatus(item) === 'baixo').length;
        const outOfStock = menuItems.filter(item => getStockStatus(item) === 'esgotado').length;
        const normalStock = menuItems.filter(item => getStockStatus(item) === 'normal').length;
        
        const totalInventoryValue = menuItems.reduce((total, item) => {
            return total + (item.estoque * (item.custo || 0));
        }, 0);

        return {
            totalItems,
            criticalStock,
            lowStock,
            outOfStock,
            normalStock,
            totalInventoryValue
        };
    }, [menuItems]);

    const handleSaveItem = async (e) => {
        e.preventDefault();
        if (!primeiroEstabelecimento) {
            toast.error('❌ Estabelecimento não identificado.');
            return;
        }

        const { nome, preco, categoria } = formData;
        if (!nome.trim() || !preco || !categoria.trim()) {
            toast.warn("⚠️ Nome, Preço e Categoria são obrigatórios.");
            return;
        }
        setFormLoading(true);

        let categoriaDoc = categories.find(cat => 
            cat.nome.toLowerCase() === categoria.toLowerCase()
        );
        
        if (!categoriaDoc) {
            toast.error(`❌ A categoria "${categoria}" não existe.`);
            setFormLoading(false);
            return;
        }
        const categoriaId = categoriaDoc.id;

        let finalImagePath = editingItem?.imageUrl || '';

        try {
            if (itemImage) {
                if (editingItem && editingItem.imageUrl) {
                    await deleteFileByUrl(editingItem.imageUrl);
                }
                const imageName = `${primeiroEstabelecimento}_${Date.now()}_${itemImage.name.replace(/\s/g, '_')}`;
                const imagePath = `images/menuItems/${imageName}`;
                finalImagePath = await uploadFile(itemImage, imagePath);
            }

            const { categoriaId: formCategoriaId, ...dataToSave } = formData;
            
            // 📦 NOVO: Preparar dados de estoque
            const stockData = {
                estoque: Number(dataToSave.estoque) || 0,
                estoqueMinimo: Number(dataToSave.estoqueMinimo) || 0,
                custo: Number(dataToSave.custo) || 0
            };

            const finalData = { 
                ...dataToSave, 
                preco: Number(dataToSave.preco), 
                imageUrl: finalImagePath,
                categoria: categoria,
                atualizadoEm: new Date(),
                // 📦 NOVO: Incluir dados de estoque
                ...stockData
            };

            if (editingItem) {
                if (editingItem.categoriaId !== categoriaId) {
                     toast.warn("⚠️ A mudança de categoria não é suportada. Crie um novo item.");
                     setFormLoading(false);
                     return;
                }
                await updateDoc(
                    doc(
                        db, 
                        'estabelecimentos', 
                        primeiroEstabelecimento, 
                        'cardapio', 
                        categoriaId, 
                        'itens', 
                        editingItem.id
                    ), 
                    finalData
                );
                toast.success("✅ Item atualizado com sucesso!");
            } else {
                finalData.criadoEm = new Date();
                await addDoc(
                    collection(
                        db, 
                        'estabelecimentos', 
                        primeiroEstabelecimento, 
                        'cardapio', 
                        categoriaId, 
                        'itens'
                    ), 
                    finalData
                );
                toast.success("✅ Item cadastrado com sucesso!");
            }
            closeItemForm();
        } catch (error) {
            console.error("❌ Erro ao salvar item:", error);
            toast.error("❌ Erro ao salvar o item: " + error.message);
        } finally {
            setFormLoading(false);
        }
    };

    const handleDeleteItem = async (item) => {
        toast.warning(
            ({ closeToast }) => (
                <div className="p-4">
                    <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <IoAlertCircle className="text-red-600 text-lg" />
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-gray-900">Confirmar exclusão?</p>
                            <p className="text-sm text-gray-600 mt-1">
                                Tem certeza que deseja excluir o item <strong>"{item.nome}"</strong>? 
                                Esta ação não pode ser desfeita.
                            </p>
                            <div className="flex justify-end mt-4 space-x-3">
                                <button 
                                    onClick={closeToast} 
                                    className="px-4 py-2 text-sm bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={async () => {
                                        try {
                                            if (item.imageUrl) {
                                                await deleteFileByUrl(item.imageUrl);
                                            }
                                            await deleteDoc(
                                                doc(
                                                    db, 
                                                    'estabelecimentos', 
                                                    primeiroEstabelecimento, 
                                                    'cardapio', 
                                                    item.categoriaId, 
                                                    'itens', 
                                                    item.id
                                                )
                                            );
                                            toast.success("✅ Item excluído com sucesso!");
                                        } catch (error) {
                                            console.error("❌ Erro ao excluir item:", error);
                                            toast.error("❌ Erro ao excluir o item.");
                                        }
                                        closeToast();
                                    }} 
                                    className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                                >
                                    Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ), 
            { 
                position: "top-center", 
                autoClose: false, 
                closeOnClick: false, 
                draggable: false,
                closeButton: false
            }
        );
    };

    const toggleItemStatus = async (item) => {
        try {
            await updateDoc(
                doc(
                    db, 
                    'estabelecimentos', 
                    primeiroEstabelecimento, 
                    'cardapio', 
                    item.categoriaId, 
                    'itens', 
                    item.id
                ), 
                { 
                    ativo: !item.ativo,
                    atualizadoEm: new Date()
                }
            );
            toast.info(`🔄 Status de "${item.nome}" alterado.`);
        } catch(error) {
            console.error("❌ Erro ao alterar status:", error);
            toast.error("❌ Erro ao alterar o status do item.");
        }
    };
    
    const openItemForm = (item = null) => {
        setEditingItem(item);
        if (item) {
            setFormData({ 
                nome: item.nome || '',
                descricao: item.descricao || '',
                preco: item.preco || '',
                categoria: item.categoria || '',
                imageUrl: item.imageUrl || '',
                ativo: item.ativo !== undefined ? item.ativo : true,
                categoriaId: item.categoriaId,
                // 📦 NOVO: Campos de estoque
                estoque: item.estoque || '',
                estoqueMinimo: item.estoqueMinimo || '',
                custo: item.custo || ''
            });
            setImagePreview(item.imageUrl);
        } else {
            setFormData({ 
                nome: '', 
                descricao: '', 
                preco: '', 
                categoria: '', 
                imageUrl: '', 
                ativo: true,
                // 📦 NOVO: Campos de estoque com valores padrão
                estoque: '',
                estoqueMinimo: '5',
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
            // 📦 NOVO: Campos de estoque
            estoque: '',
            estoqueMinimo: '5',
            custo: ''
        });
        setImagePreview('');
        setItemImage(null);
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked, files } = e.target;
        if (type === 'file') {
            const file = files[0];
            setItemImage(file);
            if (file) {
                setImagePreview(URL.createObjectURL(file));
            } else {
                setImagePreview(editingItem?.imageUrl || '');
            }
        } else {
            setFormData(prev => ({ 
                ...prev, 
                [name]: type === 'checkbox' ? checked : value 
            }));
        }
    };

    // 📦 NOVO: Função para atualizar estoque rapidamente
    const quickUpdateStock = async (item, newStock) => {
        try {
            await updateDoc(
                doc(
                    db, 
                    'estabelecimentos', 
                    primeiroEstabelecimento, 
                    'cardapio', 
                    item.categoriaId, 
                    'itens', 
                    item.id
                ), 
                { 
                    estoque: Number(newStock),
                    atualizadoEm: new Date()
                }
            );
            toast.success(`✅ Estoque de "${item.nome}" atualizado para ${newStock}`);
        } catch(error) {
            console.error("❌ Erro ao atualizar estoque:", error);
            toast.error("❌ Erro ao atualizar o estoque.");
        }
    };

    // Estatísticas - 📦 ATUALIZADO COM ESTOQUE
    const estatisticas = {
        total: menuItems.length,
        ativos: menuItems.filter(item => item.ativo).length,
        inativos: menuItems.filter(item => !item.ativo).length,
        categorias: availableCategories.length - 1, // -1 para remover "Todos"
        // 📦 NOVO: Estatísticas de estoque
        estoqueCritico: stockStatistics.criticalStock,
        estoqueBaixo: stockStatistics.lowStock,
        esgotados: stockStatistics.outOfStock,
        valorTotalEstoque: stockStatistics.totalInventoryValue
    };

    // 🔧 CORREÇÃO: Se não há estabelecimento, mostra mensagem
    if (!primeiroEstabelecimento) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <IoAlertCircle className="text-red-600 text-2xl" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                        Estabelecimento Não Configurado
                    </h2>
                    <p className="text-gray-600 mb-6">
                        Este usuário não tem um estabelecimento vinculado. 
                        Entre em contato com o administrador do sistema.
                    </p>
                    <div className="space-y-3">
                        <Link 
                            to="/dashboard" 
                            className="inline-flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors w-full"
                        >
                            <IoArrowBack />
                            <span>Voltar ao Dashboard</span>
                        </Link>
                        <button 
                            onClick={() => window.location.reload()}
                            className="inline-flex items-center justify-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors w-full"
                        >
                            <span>Recarregar Página</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 text-gray-600">Carregando cardápio...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
                    <div className="mb-4 lg:mb-0">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            Gerenciar Cardápio
                        </h1>
                        <p className="text-gray-600">
                            {establishmentName} • {estatisticas.total} itens no cardápio
                        </p>
                        <p className="text-sm text-gray-500">
                            Estabelecimento ID: {primeiroEstabelecimento}
                        </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Link 
                            to="/dashboard" 
                            className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-lg border border-gray-300 transition-colors"
                        >
                            <IoArrowBack />
                            <span>Voltar ao Dashboard</span>
                        </Link>
                        <Link
                            to="/admin/analytics"
                            className="inline-flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                        >
                            <IoStatsChart size={18} />
                            <span>Ver Analytics</span>
                        </Link>
                        <button 
                            onClick={() => openItemForm()} 
                            className="inline-flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                        >
                            <IoAddCircleOutline size={20} />
                            <span>Novo Item</span>
                        </button>
                    </div>
                </header>

                {/* Estatísticas - 📦 ATUALIZADO COM ESTOQUE */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total de Itens</p>
                                <p className="text-2xl font-bold text-gray-900">{estatisticas.total}</p>
                            </div>
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <span className="text-blue-600 text-lg">📦</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Itens Ativos</p>
                                <p className="text-2xl font-bold text-green-600">{estatisticas.ativos}</p>
                            </div>
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                <IoCheckmarkCircle className="text-green-600 text-lg" />
                            </div>
                        </div>
                    </div>

                    {/* 📦 NOVO: Estoque Crítico */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Estoque Crítico</p>
                                <p className="text-2xl font-bold text-red-600">{estatisticas.estoqueCritico}</p>
                            </div>
                            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                                <IoAlertCircle className="text-red-600 text-lg" />
                            </div>
                        </div>
                    </div>

                    {/* 📦 NOVO: Estoque Baixo */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Estoque Baixo</p>
                                <p className="text-2xl font-bold text-orange-600">{estatisticas.estoqueBaixo}</p>
                            </div>
                            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                                <IoAlertCircle className="text-orange-600 text-lg" />
                            </div>
                        </div>
                    </div>

                    {/* 📦 NOVO: Esgotados */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Esgotados</p>
                                <p className="text-2xl font-bold text-gray-600">{estatisticas.esgotados}</p>
                            </div>
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                                <IoCube className="text-gray-600 text-lg" />
                            </div>
                        </div>
                    </div>

                    {/* 📦 NOVO: Valor Total Estoque */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Valor em Estoque</p>
                                <p className="text-lg font-bold text-purple-600">
                                    R$ {estatisticas.valorTotalEstoque.toFixed(2)}
                                </p>
                            </div>
                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <IoCash className="text-purple-600 text-lg" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filtros e Ordenação - 📦 ATUALIZADO COM FILTRO DE ESTOQUE */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        {/* Busca */}
                        <div className="relative flex-1">
                            <IoSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg" />
                            <input
                                type="text"
                                placeholder="Buscar por nome do item..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            />
                        </div>
                        
                        {/* Filtro de Categoria */}
                        <div className="flex items-center space-x-3">
                            <IoFilter className="text-gray-400 text-lg" />
                            <select 
                                value={selectedCategory} 
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="bg-gray-50 border border-gray-300 text-gray-900 py-3 px-4 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            >
                                {availableCategories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        {/* 📦 NOVO: Filtro de Estoque */}
                        <div className="flex items-center space-x-3">
                            <IoCube className="text-gray-400 text-lg" />
                            <select 
                                value={stockFilter} 
                                onChange={(e) => setStockFilter(e.target.value)}
                                className="bg-gray-50 border border-gray-300 text-gray-900 py-3 px-4 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            >
                                <option value="todos">Todos os Estoques</option>
                                <option value="normal">Estoque Normal</option>
                                <option value="baixo">Estoque Baixo</option>
                                <option value="critico">Estoque Crítico</option>
                                <option value="esgotado">Esgotados</option>
                            </select>
                        </div>
                    </div>

                    {/* Ordenação */}
                    <div className="mt-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center space-x-3">
                            <span className="text-sm text-gray-600 font-medium">Ordenar por:</span>
                            <div className="flex flex-wrap gap-2">
                                {sortOptions.map(option => (
                                    <button
                                        key={option.key}
                                        onClick={() => handleSort(option.key)}
                                        className={`flex items-center space-x-1 px-3 py-2 rounded-lg border transition-all ${
                                            sortConfig.key === option.key
                                                ? 'bg-blue-50 border-blue-200 text-blue-700'
                                                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                                        }`}
                                    >
                                        <span className="text-sm">{option.icon}</span>
                                        <span className="text-sm font-medium">
                                            {option.label}
                                            {getSortLabel(option.key)}
                                        </span>
                                        {getSortIcon(option.key)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Indicador de ordenação atual */}
                        <div className="text-sm text-blue-600 font-medium">
                            Ordenado por: {sortOptions.find(opt => opt.key === sortConfig.key)?.label} 
                            {sortConfig.direction === 'asc' ? ' (Crescente)' : ' (Decrescente)'}
                        </div>
                    </div>

                    {/* 📦 NOVO: Resumo dos filtros */}
                    <div className="mt-4 flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                            Mostrando {paginatedItems.length} de {filteredAndSortedItems.length} itens
                            {searchTerm && ` • Busca: "${searchTerm}"`}
                            {selectedCategory !== 'Todos' && ` • Categoria: ${selectedCategory}`}
                            {stockFilter !== 'todos' && ` • Estoque: ${stockFilter}`}
                        </div>
                    </div>
                </div>

                {/* Lista de Itens */}
                <div className="space-y-4 mb-8">
                    {paginatedItems.length > 0 ? (
                        paginatedItems.map(item => (
                            <AdminProductCard 
                                key={item.id} 
                                produto={item} 
                                onEdit={() => openItemForm(item)}
                                onDelete={() => handleDeleteItem(item)}
                                onToggleStatus={() => toggleItemStatus(item)}
                                // 📦 NOVO: Passar funções de estoque
                                onUpdateStock={(newStock) => quickUpdateStock(item, newStock)}
                                stockStatus={getStockStatus(item)}
                                profitMargin={calculateProfitMargin(item.preco, item.custo)}
                            />
                        ))
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <IoSearch className="text-3xl text-gray-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Nenhum item encontrado
                            </h3>
                            <p className="text-gray-600 mb-6 max-w-md mx-auto">
                                {searchTerm || selectedCategory !== 'Todos' || stockFilter !== 'todos'
                                    ? 'Tente ajustar os filtros de busca, categoria ou estoque.'
                                    : 'Comece adicionando itens ao seu cardápio.'
                                }
                            </p>
                            {!searchTerm && selectedCategory === 'Todos' && stockFilter === 'todos' && (
                                <button 
                                    onClick={() => openItemForm()} 
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors inline-flex items-center space-x-2"
                                >
                                    <IoAddCircleOutline size={20} />
                                    <span>Adicionar Primeiro Item</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Paginação */}
                {filteredAndSortedItems.length > ITEMS_PER_PAGE && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={goToPage}
                        />
                    </div>
                )}
            </div>

            {/* Modal do Formulário - 📦 ATUALIZADO COM CAMPOS DE ESTOQUE */}
            {showItemForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full m-auto max-h-[90vh] overflow-y-auto">
                        {/* Header do Modal */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center">
                                {editingItem ? (
                                    <>
                                        <IoPencil className="mr-2 text-blue-600" />
                                        Editar Item
                                    </>
                                ) : (
                                    <>
                                        <IoAddCircleOutline className="mr-2 text-green-600" />
                                        Novo Item
                                    </>
                                )}
                            </h2>
                            <button 
                                onClick={closeItemForm}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <IoClose size={24} />
                            </button>
                        </div>

                        {/* Formulário */}
                        <form onSubmit={handleSaveItem} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Nome do Item *
                                </label>
                                <input 
                                    name="nome" 
                                    value={formData.nome} 
                                    onChange={handleFormChange} 
                                    placeholder="Ex: X-Burguer Especial"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Descrição
                                </label>
                                <textarea 
                                    name="descricao" 
                                    value={formData.descricao} 
                                    onChange={handleFormChange} 
                                    placeholder="Descreva o item..."
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                    rows="3"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
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
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
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

                            {/* 📦 NOVO: Seção de Estoque */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
                                    <IoCube className="mr-2" />
                                    Controle de Estoque
                                </h3>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Estoque Atual
                                        </label>
                                        <input 
                                            name="estoque" 
                                            type="number" 
                                            value={formData.estoque} 
                                            onChange={handleFormChange} 
                                            placeholder="0"
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Estoque Mínimo
                                        </label>
                                        <input 
                                            name="estoqueMinimo" 
                                            type="number" 
                                            value={formData.estoqueMinimo} 
                                            onChange={handleFormChange} 
                                            placeholder="5"
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="mt-3">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Custo Unitário (R$)
                                    </label>
                                    <input 
                                        name="custo" 
                                        type="number" 
                                        step="0.01" 
                                        value={formData.custo} 
                                        onChange={handleFormChange} 
                                        placeholder="0.00"
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                    />
                                </div>

                                {/* 📦 NOVO: Cálculo de margem */}
                                {formData.preco && formData.custo && (
                                    <div className="mt-3 p-3 bg-white rounded-lg border">
                                        <div className="flex justify-between text-sm">
                                            <span>Margem de Lucro:</span>
                                            <span className={`font-bold ${
                                                calculateProfitMargin(formData.preco, formData.custo) > 50 
                                                    ? 'text-green-600' 
                                                    : calculateProfitMargin(formData.preco, formData.custo) > 30 
                                                    ? 'text-yellow-600' 
                                                    : 'text-red-600'
                                            }`}>
                                                {calculateProfitMargin(formData.preco, formData.custo).toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm mt-1">
                                            <span>Lucro por Unidade:</span>
                                            <span className="font-bold text-green-600">
                                                R$ {(formData.preco - (formData.custo || 0)).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {editingItem && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                    <p className="text-sm text-yellow-800">
                                        <strong>Atenção:</strong> A categoria não pode ser alterada após a criação do item.
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Imagem do Item
                                </label>
                                <div className="flex items-center space-x-4">
                                    <label className="flex-1 cursor-pointer">
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={handleFormChange} 
                                            className="hidden"
                                        />
                                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-500 transition-colors">
                                            <IoImageOutline className="text-gray-400 text-2xl mx-auto mb-2" />
                                            <span className="text-sm text-gray-600">
                                                {imagePreview ? 'Alterar imagem' : 'Selecionar imagem'}
                                            </span>
                                        </div>
                                    </label>
                                    {imagePreview && (
                                        <div className="flex-shrink-0">
                                            <img 
                                                src={imagePreview} 
                                                alt="Preview" 
                                                className="w-16 h-16 object-cover rounded-lg shadow"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center">
                                <input 
                                    type="checkbox" 
                                    name="ativo" 
                                    checked={formData.ativo} 
                                    onChange={handleFormChange} 
                                    id="itemAtivo" 
                                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <label htmlFor="itemAtivo" className="ml-2 text-sm text-gray-700">
                                    Item visível no cardápio
                                </label>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 sticky bottom-0 bg-white pb-4">
                                <button 
                                    type="button" 
                                    onClick={closeItemForm}
                                    className="px-6 py-3 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={formLoading}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                                >
                                    {formLoading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Salvando...</span>
                                        </>
                                    ) : (
                                        <span>Salvar Item</span>
                                    )}
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