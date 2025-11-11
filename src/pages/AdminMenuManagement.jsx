// src/pages/AdminMenuManagement.jsx - (VERSÃO CORRIGIDA - ESTRUTURA ANINHADA)
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
        estabelecimentos: userData?.estabelecimentos,
        estabelecimentosGerenciados: userData?.estabelecimentosGerenciados
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

    // ✅ CORREÇÃO CRÍTICA: Busca robusta pelo ID do Estabelecimento, evitando o retorno '0'.
    const primeiroEstabelecimento = useMemo(() => {
        let estabelecimento = null;
        
        // 1. Tenta 'estabelecimentosGerenciados' (Array de IDs - Preferencial)
        if (Array.isArray(userData?.estabelecimentosGerenciados) && userData.estabelecimentosGerenciados.length > 0) {
            estabelecimento = userData.estabelecimentosGerenciados[0];
        }

        // 2. Se não encontrou, tenta 'estabelecimentos' (Array ou Objeto de permissões)
        if (!estabelecimento) {
            const estabelecimentosData = userData?.estabelecimentos;

            if (Array.isArray(estabelecimentosData) && estabelecimentosData.length > 0) {
                // Caso seja um array de IDs (Ex: ['ID1', 'ID2'])
                estabelecimento = estabelecimentosData[0]; 
            } else if (estabelecimentosData && typeof estabelecimentosData === 'object' && !Array.isArray(estabelecimentosData)) {
                // Caso seja um objeto de permissões (Ex: { 'ID1': true, 'ID2': false })
                const keys = Object.keys(estabelecimentosData);
                if (keys.length > 0) {
                    estabelecimento = keys[0]; // A chave é o ID
                }
            }
        }

        // 3. Validação final: Garante que o ID é uma string não-vazia e não '0'
        const finalId = (typeof estabelecimento === 'string' && estabelecimento.length > 0 && estabelecimento !== '0')
            ? estabelecimento
            : null;

        console.log("🏪 Estabelecimento encontrado (robusto e validado):", finalId);
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
        }
    }, [primeiroEstabelecimento]);

    // ✅ REVERTIDO: Listener para categorias e itens (ESTRUTURA ANINHADA)
    useEffect(() => {
        if (!primeiroEstabelecimento) {
            console.log("❌ Nenhum estabelecimento disponível para carregar cardápio");
            setLoading(false);
            return;
        }

        setLoading(true);
        console.log("📦 Buscando cardápio (estrutura ANINHADA) para:", primeiroEstabelecimento);

        // ✅ Lendo de /cardapio
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

                // ✅ Lendo de /cardapio/{catId}/itens
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
            // ✅ ESTE É O ERRO QUE VOCÊ ESTAVA VENDO
            console.error("❌ Erro ao carregar categorias:", error);
            toast.error("❌ Erro ao carregar categorias do cardápio.");
            setLoading(false);
        });

        return () => {
            console.log("🧹 Limpando listener de categorias");
            unsubscribeCategorias();
        };
    }, [primeiroEstabelecimento]);

    // ... (O restante do arquivo: handleSort, getStockStatus, calculateProfitMargin, etc... ) ...
    // ... (Eles são compatíveis com ambas as estruturas, então podem ser mantidos) ...
    
    // 🔄 Função para ordenação
    const handleSort = (key) => {
        setSortConfig(prevConfig => ({
            key,
            direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    // 🔄 Opções de ordenação
    const sortOptions = [
        { key: 'nome', label: 'Nome', icon: 'AZ' },
        { key: 'preco', label: 'Preço', icon: '💰' },
        { key: 'estoque', label: 'Estoque', icon: '📦' },
        { key: 'ativo', label: 'Status', icon: '🔄' },
        { key: 'criadoEm', label: 'Data Criação', icon: '📅' }
    ];

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
    const ITEMS_PER_PAGE = 10;
    const {
        currentPage,
        totalPages,
        paginatedItems,
        goToPage,
    } = usePagination(filteredAndSortedItems, ITEMS_PER_PAGE);

    // Funções de ícone de sort
    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <IoSwapVertical className="text-gray-400" />;
        return sortConfig.direction === 'asc' ? <IoChevronUp className="text-blue-600" /> : <IoChevronDown className="text-blue-600" />;
    };
    const getSortLabel = (key) => {
        if (sortConfig.key !== key) return '';
        return sortConfig.direction === 'asc' ? ' (A-Z)' : ' (Z-A)';
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


    // ✅ REVERTIDO: Função de salvar item (ESTRUTURA ANINHADA)
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
            try {
                const newCatRef = await addDoc(collection(db, 'estabelecimentos', primeiroEstabelecimento, 'cardapio'), {
                    nome: categoria,
                    ordem: categories.length + 1, // Coloca no final
                    ativo: true,
                    criadoEm: new Date(),
                    atualizadoEm: new Date(),
                });
                categoriaDoc = { id: newCatRef.id, nome: categoria };
                toast.info(`➕ Categoria "${categoria}" criada.`);
            } catch (catError) {
                console.error("❌ Erro ao criar nova categoria:", catError);
                toast.error("❌ Erro ao criar nova categoria.");
                setFormLoading(false);
                return;
            }
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

            const stockData = {
                estoque: Number(dataToSave.estoque) || 0,
                estoqueMinimo: Number(dataToSave.estoqueMinimo) || 0,
                custo: Number(dataToSave.custo) || 0
            };

            const finalData = {
                ...dataToSave,
                preco: Number(dataToSave.preco),
                imageUrl: finalImagePath,
                categoria: categoriaDoc.nome, 
                atualizadoEm: new Date(),
                ...stockData
            };

            if (editingItem) {
                // ✅ LÓGICA DE SALVAR REVERTIDA
                if (editingItem.categoriaId !== categoriaId) {
                   toast.warn("⚠️ A categoria do item editado será mantida na original. Crie um novo item para mudar de categoria.");
                   const oldCategoriaDoc = categories.find(cat => cat.id === editingItem.categoriaId);
                   if (oldCategoriaDoc) {
                        finalData.categoria = oldCategoriaDoc.nome;
                        await updateDoc(
                            doc(
                                db,
                                'estabelecimentos',
                                primeiroEstabelecimento,
                                'cardapio',
                                editingItem.categoriaId, // Caminho antigo
                                'itens',
                                editingItem.id
                            ),
                            finalData
                        );
                        toast.success("✅ Item atualizado com sucesso (Categoria mantida).");
                   } else {
                        console.warn("Categoria original não encontrada. Salvando no novo path.");
                        await updateDoc(
                             doc(
                                 db,
                                 'estabelecimentos',
                                 primeiroEstabelecimento,
                                 'cardapio',
                                 categoriaId, // Caminho novo
                                 'itens',
                                 editingItem.id
                             ),
                             finalData
                         );
                         toast.success("✅ Item atualizado (nova categoria).");
                   }
                } else {
                    // Categoria não mudou
                    await updateDoc(
                        doc(
                            db,
                            'estabelecimentos',
                            primeiroEstabelecimento,
                            'cardapio',
                            categoriaId, // Caminho original
                            'itens',
                            editingItem.id
                        ),
                        finalData
                    );
                    toast.success("✅ Item atualizado com sucesso!");
                }

            } else {
                // Criando novo item
                finalData.criadoEm = new Date();
                await addDoc(
                    collection(
                        db,
                        'estabelecimentos',
                        primeiroEstabelecimento,
                        'cardapio',
                        categoriaId, // Caminho original
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

    // ✅ REVERTIDO: Função de deletar item (ESTRUTURA ANINHADA)
    const handleDeleteItem = async (item) => {
        toast.warning(
            ({ closeToast }) => (
                <div className="p-4">
                    {/* ... (Layout do toast) ... */}
                    <p className="text-sm text-gray-600 mt-1">
                        Tem certeza que deseja excluir o item <strong>"{item.nome}"</strong>?
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
                                    // ✅ CAMINHO REVERTIDO
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
            ),
            { /* ... (opções do toast) ... */ }
        );
    };

    // ✅ REVERTIDO: Função de alterar status (ESTRUTURA ANINHADA)
    const toggleItemStatus = async (item) => {
        try {
            // ✅ CAMINHO REVERTIDO
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

    // ✅ REVERTIDO: Funções do formulário (ESTRUTURA ANINHADA)
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
                categoriaId: item.categoriaId, // ✅ Campo 'categoriaId' é necessário
                estoque: item.estoque || '',
                estoqueMinimo: item.estoqueMinimo || '5',
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

    // ✅ REVERTIDO: Função de atualizar estoque (ESTRUTURA ANINHADA)
    const quickUpdateStock = async (item, newStock) => {
        try {
            // ✅ CAMINHO REVERTIDO
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

    // Estatísticas (Mantidas)
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

    // Telas de Erro e Loading (Mantidas)
    if (!primeiroEstabelecimento) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
                    <IoAlertCircle className="text-red-600 text-2xl mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                        Estabelecimento Não Configurado
                    </h2>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="mt-4 text-gray-600">Carregando cardápio...</p>
            </div>
        );
    }

    // =========================================================================
    // RENDERIZAÇÃO (Layout mantido, apenas o formulário modal foi ajustado)
    // =========================================================================
    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
                     {/* ... (Layout do Header mantido) ... */}
                </header>

                {/* Estatísticas */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
                     {/* ... (Layout das Estatísticas mantido) ... */}
                </div>

                {/* Filtros e Ordenação */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                     {/* ... (Layout dos Filtros mantido) ... */}
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
                                onUpdateStock={(newStock) => quickUpdateStock(item, newStock)}
                                stockStatus={getStockStatus(item)}
                                profitMargin={calculateProfitMargin(item.preco, item.custo)}
                            />
                        ))
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                             {/* ... (Layout de "Nenhum item" mantido) ... */}
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

            {/* Modal do Formulário - ✅ REVERTIDO */}
            {showItemForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full m-auto max-h-[90vh] overflow-y-auto">
                        {/* Header do Modal */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
                             {/* ... (Layout do Header do Modal mantido) ... */}
                        </div>

                        {/* Formulário */}
                        <form onSubmit={handleSaveItem} className="p-6 space-y-4">
                             {/* ... (Campos Nome, Descrição, Preço mantidos) ... */}

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
                                        disabled={!!editingItem} // ✅ REVERTIDO
                                        required
                                    />
                                    <datalist id="categories-list">
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.nome} />
                                        ))}
                                    </datalist>
                                </div>
                            </div>
                            
                            {/* ... (Restante do formulário: Estoque, Imagem, Ativo, Botões) ... */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                 {/* ... (Campos de estoque mantidos) ... */}
                            </div>

                            {editingItem && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                    <p className="text-sm text-yellow-800">
                                        <strong>Atenção:</strong> A categoria não pode ser alterada após a criação do item.
                                    </p>
                                </div>
                            )}

                             {/* ... (Input de imagem, checkbox 'ativo', botões) ... */}
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default withEstablishmentAuth(AdminMenuManagement);