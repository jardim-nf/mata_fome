// src/pages/admin/AdminMenuManagement.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, where, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { uploadFile } from '../utils/firebaseStorageService'; 
import AdminProductCard from '../components/AdminProductCard';
import { IoArrowBack, IoAddCircleOutline, IoPencil } from 'react-icons/io5';

function AdminMenuManagement() {
    // CORREÇÃO: Pegando 'estabelecimentoId' diretamente do AuthContext
    const { currentUser, isAdmin, loading: authLoading, estabelecimentoId } = useAuth();
    const navigate = useNavigate();

    const [establishmentName, setEstablishmentName] = useState('');
    const [menuItems, setMenuItems] = useState([]);
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
            toast.error('Acesso negado.');
            navigate('/login-admin');
        }
    }, [currentUser, isAdmin, authLoading, navigate]);
    
    // Busca o nome do estabelecimento (Opcional, mas bom para UI)
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

    // Busca itens do cardápio em tempo real
    useEffect(() => {
        if (!estabelecimentoId) {
            setLoading(false);
            return; // Não faz nada se não houver um ID de estabelecimento
        }
        
        setLoading(true);
        const q = query(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio'), orderBy('categoria'), orderBy('nome'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMenuItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        }, (err) => {
            toast.error("Erro ao carregar itens do cardápio.");
            setLoading(false);
        });
        return () => unsubscribe();
    }, [estabelecimentoId]);

    const openItemForm = (item = null) => {
        setEditingItem(item);
        setFormData(item ? { ...item } : { nome: '', descricao: '', preco: '', categoria: '', imageUrl: '', ativo: true });
        setItemImage(null);
        setImagePreview(item?.imageUrl || '');
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
            if (file) setImagePreview(URL.createObjectURL(file));
        } else {
            setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        }
    };

    const handleSaveItem = async (e) => {
        e.preventDefault();
        const { nome, preco, categoria } = formData;
        if (!nome.trim() || !preco || !categoria.trim()) {
            toast.warn("Nome, Preço e Categoria são obrigatórios.");
            return;
        }
        setFormLoading(true);
        let finalImageUrl = formData.imageUrl;
        try {
            if (itemImage) {
                const imageName = `${estabelecimentoId}_${Date.now()}_${itemImage.name}`;
                const imagePath = `images/menuItems/${imageName}`;
                finalImageUrl = await uploadFile(itemImage, imagePath);
            }
            const dataToSave = { ...formData, preco: Number(formData.preco), imageUrl: finalImageUrl };
            
            if (editingItem) {
                await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', editingItem.id), dataToSave);
                toast.success("Item atualizado!");
            } else {
                await addDoc(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio'), dataToSave);
                toast.success("Item cadastrado!");
            }
            closeItemForm();
        } catch (error) {
            toast.error("Erro ao salvar o item: " + error.message);
        } finally {
            setFormLoading(false);
        }
    };
    
    const handleDeleteItem = async (itemId, itemName) => {
        // Usando o toast para confirmação
        toast.warning(
            ({ closeToast }) => (
                <div>
                    <p className="font-semibold">Confirmar exclusão?</p>
                    <p className="text-sm">Excluir o item "{itemName}"?</p>
                    <div className="flex justify-end mt-2 space-x-2">
                        <button onClick={closeToast} className="px-3 py-1 text-sm bg-gray-500 text-white rounded">Cancelar</button>
                        <button onClick={async () => {
                            try {
                                await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', itemId));
                                toast.success("Item excluído!");
                            } catch (error) {
                                toast.error("Erro ao excluir o item.");
                            }
                            closeToast();
                        }} className="px-3 py-1 text-sm bg-red-600 text-white rounded">Excluir</button>
                    </div>
                </div>
            ), { autoClose: false, closeOnClick: false }
        );
    };

    const toggleItemStatus = async (item) => {
        try {
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', item.id), { ativo: !item.ativo });
            toast.success(`Status de "${item.nome}" alterado!`);
        } catch(error) {
            toast.error("Erro ao alterar o status.");
        }
    };
    
    const categories = useMemo(() => ['Todos', ...new Set(menuItems.map(item => item.categoria))], [menuItems]);
    const filteredItems = useMemo(() => {
        return menuItems.filter(item =>
            (selectedCategory === 'Todos' || item.categoria === selectedCategory) &&
            item.nome.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [menuItems, searchTerm, selectedCategory]);

    if (authLoading || loading) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">Carregando Cardápio...</div>;
    }

    return (
        <div className="bg-gray-900 min-h-screen p-4 sm:p-6 text-white">
            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-amber-400">Gerenciar Cardápio</h1>
                        <p className="text-md text-gray-400 mt-1">{establishmentName}</p>
                    </div>
                    <div className="flex items-center space-x-2 w-full sm:w-auto">
                        <Link to="/dashboard" className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                            <IoArrowBack />
                            <span>Voltar</span>
                        </Link>
                        <button onClick={() => openItemForm()} className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-amber-500 hover:bg-amber-600 text-black font-bold py-2 px-4 rounded-lg transition-colors">
                            <IoAddCircleOutline />
                            <span>Novo Item</span>
                        </button>
                    </div>
                </header>

                <div className="bg-gray-800 p-6 rounded-xl shadow-lg mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                        type="text"
                        placeholder="Buscar por nome do item..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-700 text-white p-3 rounded-md border-gray-600 placeholder-gray-400"
                    />
                    <select 
                        value={selectedCategory} 
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full bg-gray-700 text-white p-3 rounded-md border-gray-600"
                    >
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>

                <div className="space-y-3">
                    {filteredItems.length > 0 ? (
                        filteredItems.map(item => (
                            <AdminProductCard 
                                key={item.id} 
                                produto={item} 
                                onEdit={() => openItemForm(item)}
                                onDelete={() => handleDeleteItem(item.id, item.nome)}
                                onToggleStatus={() => toggleItemStatus(item)}
                            />
                        ))
                    ) : (
                        <div className="text-center p-16 bg-gray-800 rounded-xl shadow-lg">
                            <h3 className="text-lg font-semibold text-amber-400">Nenhum item encontrado</h3>
                            <p className="mt-1 text-sm text-gray-400">Tente ajustar sua busca ou cadastre um novo item.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Adicionar/Editar Item */}
            {showItemForm && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 rounded-xl shadow-2xl p-6 max-w-lg w-full text-white">
                        <h2 className="text-2xl font-bold text-amber-400 mb-6 flex items-center">
                            {editingItem ? <IoPencil className="mr-2" /> : <IoAddCircleOutline className="mr-2" />}
                            {editingItem ? 'Editar Item' : 'Cadastrar Novo Item'}
                        </h2>
                        <form onSubmit={handleSaveItem} className="space-y-4">
                            <input name="nome" value={formData.nome} onChange={handleFormChange} placeholder="Nome do Item *" className="w-full bg-gray-700 p-2 rounded-md border-gray-600"/>
                            <textarea name="descricao" value={formData.descricao} onChange={handleFormChange} placeholder="Descrição" className="w-full bg-gray-700 p-2 rounded-md border-gray-600" rows="3"></textarea>
                            <div className="grid grid-cols-2 gap-4">
                                <input name="preco" type="number" step="0.01" value={formData.preco} onChange={handleFormChange} placeholder="Preço *" className="w-full bg-gray-700 p-2 rounded-md border-gray-600"/>
                                <input name="categoria" value={formData.categoria} onChange={handleFormChange} placeholder="Categoria *" className="w-full bg-gray-700 p-2 rounded-md border-gray-600"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Imagem</label>
                                <input type="file" onChange={handleFormChange} className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-500 file:text-black hover:file:bg-amber-600"/>
                                {imagePreview && (
                                    <div className="mt-4"><img src={imagePreview} alt="Preview" className="w-24 h-24 object-cover rounded-lg shadow"/></div>
                                )}
                            </div>
                            <div className="flex items-center">
                                <input type="checkbox" name="ativo" checked={formData.ativo} onChange={handleFormChange} id="itemAtivo" className="h-4 w-4 text-amber-500 bg-gray-600 border-gray-500 rounded focus:ring-amber-500"/>
                                <label htmlFor="itemAtivo" className="ml-2 text-sm text-gray-300">Item Ativo</label>
                            </div>
                            <div className="flex justify-end gap-4 pt-4">
                                <button type="button" onClick={closeItemForm} className="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg font-semibold transition-colors">Cancelar</button>
                                <button type="submit" disabled={formLoading} className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-black rounded-lg font-bold transition-colors disabled:opacity-50">
                                    {formLoading ? 'Salvando...' : 'Salvar'}
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