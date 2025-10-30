import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, getDoc, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { uploadFile, deleteFileByUrl } from '../utils/firebaseStorageService';
import AdminProductCard from '../components/AdminProductCard';
import { 
    IoArrowBack, 
    IoAddCircleOutline, 
    IoPencil,
    IoSearch,
    IoFilter,
    IoClose,
    IoImageOutline,
    IoCheckmarkCircle,
    IoAlertCircle
} from 'react-icons/io5';

function AdminMenuManagement() {
    const { currentUser, isAdmin, loading: authLoading, estabelecimentoId } = useAuth();
    const navigate = useNavigate();

    const [establishmentName, setEstablishmentName] = useState('');
    const [menuItems, setMenuItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [showItemForm, setShowItemForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({ nome: '', descricao: '', preco: '', categoria: '', imageUrl: '', ativo: true });
    const [itemImage, setItemImage] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [formLoading, setFormLoading] = useState(false);

    // Controle de acesso
    useEffect(() => {
        if (!authLoading && (!currentUser || !isAdmin)) {
            toast.error('🔒 Acesso negado. Faça login como administrador.');
            navigate('/login-admin');
        }
    }, [currentUser, isAdmin, authLoading, navigate]);
    
    // Busca o nome do estabelecimento
    useEffect(() => {
        if (estabelecimentoId) {
            const fetchEstablishmentName = async () => {
                const estabDoc = await getDoc(doc(db, 'estabelecimentos', estabelecimentoId));
                if (estabDoc.exists()) {
                    setEstablishmentName(estabDoc.data().nome);
                }
            };
            fetchEstablishmentName();
        }
    }, [estabelecimentoId]);

    // Listener para categorias e itens
    useEffect(() => {
        if (!estabelecimentoId) {
            setLoading(false);
            return;
        }

        setLoading(true);

        const categoriasRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio');
        const qCategorias = query(categoriasRef, orderBy('ordem', 'asc'));

        const unsubscribeCategorias = onSnapshot(qCategorias, (categoriasSnapshot) => {
            const fetchedCategories = categoriasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
                const itensRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', catDoc.id, 'itens');
                const qItens = query(itensRef, orderBy('nome', 'asc'));

                const unsubscribeItens = onSnapshot(qItens, (itensSnapshot) => {
                    const itemsDaCategoria = itensSnapshot.docs.map(itemDoc => ({
                        ...itemDoc.data(),
                        id: itemDoc.id,
                        categoria: categoriaData.nome,
                        categoriaId: catDoc.id
                    }));

                    allItems = [
                        ...allItems.filter(item => item.categoriaId !== catDoc.id),
                        ...itemsDaCategoria
                    ];
                    
                    setMenuItems(allItems.sort((a, b) => a.nome.localeCompare(b.nome)));
                }, (error) => {
                    console.error(`Erro ao ouvir itens da categoria ${catDoc.id}:`, error);
                    toast.error("❌ Erro ao carregar itens de uma categoria.");
                });

                unsubscribers.push(unsubscribeItens);
            });

            setLoading(false);
            
            return () => {
                unsubscribers.forEach(unsub => unsub());
            };
        }, (error) => {
            console.error("Erro ao carregar categorias:", error);
            toast.error("❌ Erro ao carregar categorias do cardápio.");
            setLoading(false);
        });

        return () => {
            unsubscribeCategorias();
        };
    }, [estabelecimentoId]);

    const handleSaveItem = async (e) => {
        e.preventDefault();
        const { nome, preco, categoria } = formData;
        if (!nome.trim() || !preco || !categoria.trim()) {
            toast.warn("⚠️ Nome, Preço e Categoria são obrigatórios.");
            return;
        }
        setFormLoading(true);

        let categoriaDoc = categories.find(cat => cat.nome.toLowerCase() === categoria.toLowerCase());
        
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
                const imageName = `${estabelecimentoId}_${Date.now()}_${itemImage.name.replace(/\s/g, '_')}`;
                const imagePath = `images/menuItems/${imageName}`;
                finalImagePath = await uploadFile(itemImage, imagePath);
            }

            const { categoriaId: formCategoriaId, ...dataToSave } = formData;
            const finalData = { 
                ...dataToSave, 
                preco: Number(dataToSave.preco), 
                imageUrl: finalImagePath,
                categoria: categoria
            };

            if (editingItem) {
                if (editingItem.categoriaId !== categoriaId) {
                     toast.warn("⚠️ A mudança de categoria não é suportada. Crie um novo item.");
                     setFormLoading(false);
                     return;
                }
                await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', categoriaId, 'itens', editingItem.id), finalData);
                toast.success("✅ Item atualizado com sucesso!");
            } else {
                await addDoc(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', categoriaId, 'itens'), finalData);
                toast.success("✅ Item cadastrado com sucesso!");
            }
            closeItemForm();
        } catch (error) {
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
                            <p className="text-sm text-gray-600 mt-1">Tem certeza que deseja excluir o item <strong>"{item.nome}"</strong>? Esta ação não pode ser desfeita.</p>
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
                                            await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', item.categoriaId, 'itens', item.id));
                                            toast.success("✅ Item excluído com sucesso!");
                                        } catch (error) {
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
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', item.categoriaId, 'itens', item.id), { 
                ativo: !item.ativo,
                atualizadoEm: new Date()
            });
            toast.info(`🔄 Status de "${item.nome}" alterado.`);
        } catch(error) {
            toast.error("❌ Erro ao alterar o status do item.");
        }
    };
    
    const availableCategories = useMemo(() => ['Todos', ...new Set(menuItems.map(item => item.categoria).filter(Boolean))], [menuItems]);
    
    const filteredItems = useMemo(() => {
        return menuItems.filter(item =>
            (selectedCategory === 'Todos' || item.categoria === selectedCategory) &&
            (item.nome || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [menuItems, searchTerm, selectedCategory]);

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
                categoriaId: item.categoriaId
            });
            setImagePreview(item.imageUrl);
        } else {
            setFormData({ nome: '', descricao: '', preco: '', categoria: '', imageUrl: '', ativo: true });
            setImagePreview('');
        }
        setItemImage(null);
        setShowItemForm(true);
    };

    const closeItemForm = () => {
        setShowItemForm(false);
        setEditingItem(null);
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
            setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        }
    };

    // Estatísticas
    const estatisticas = {
        total: menuItems.length,
        ativos: menuItems.filter(item => item.ativo).length,
        inativos: menuItems.filter(item => !item.ativo).length,
        categorias: availableCategories.length - 1 // -1 para remover "Todos"
    };

    if (authLoading || loading) {
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
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Link 
                            to="/dashboard" 
                            className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-lg border border-gray-300 transition-colors"
                        >
                            <IoArrowBack />
                            <span>Voltar ao Dashboard</span>
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

                {/* Estatísticas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Itens Inativos</p>
                                <p className="text-2xl font-bold text-orange-600">{estatisticas.inativos}</p>
                            </div>
                            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                                <IoAlertCircle className="text-orange-600 text-lg" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Categorias</p>
                                <p className="text-2xl font-bold text-purple-600">{estatisticas.categorias}</p>
                            </div>
                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <span className="text-purple-600 text-lg">📁</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filtros */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
                    </div>
                </div>

                {/* Lista de Itens */}
                <div className="space-y-4">
                    {filteredItems.length > 0 ? (
                        filteredItems.map(item => (
                            <AdminProductCard 
                                key={item.id} 
                                produto={item} 
                                onEdit={() => openItemForm(item)}
                                onDelete={() => handleDeleteItem(item)}
                                onToggleStatus={() => toggleItemStatus(item)}
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
                                {searchTerm || selectedCategory !== 'Todos' 
                                    ? 'Tente ajustar os filtros de busca ou categoria.'
                                    : 'Comece adicionando itens ao seu cardápio.'
                                }
                            </p>
                            {!searchTerm && selectedCategory === 'Todos' && (
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
            </div>

            {/* Modal do Formulário */}
            {showItemForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full m-auto">
                        {/* Header do Modal */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
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
                                <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Item *</label>
                                <input 
                                    name="nome" 
                                    value={formData.nome} 
                                    onChange={handleFormChange} 
                                    placeholder="Ex: Pizza Calabresa"
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
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
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Preço *</label>
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
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Categoria *</label>
                                    <input 
                                        name="categoria" 
                                        value={formData.categoria} 
                                        onChange={handleFormChange} 
                                        placeholder="Ex: Pizzas"
                                        list="categories-list"
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                        disabled={!!editingItem}
                                        required
                                    />
                                    <datalist id="categories-list">
                                        {categories.map(cat => <option key={cat.id} value={cat.nome} />)}
                                    </datalist>
                                </div>
                            </div>
                            {editingItem && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                    <p className="text-sm text-yellow-800">
                                        <strong>Atenção:</strong> A categoria não pode ser alterada após a criação do item.
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Imagem do Item</label>
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
                                            <img src={imagePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg shadow"/>
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

                            <div className="flex justify-end space-x-3 pt-4">
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

export default AdminMenuManagement;