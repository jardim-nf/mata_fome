// src/pages/admin/AdminMenuManagement.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { uploadFile } from '../utils/firebaseStorageService'; 
import AdminProductCard from '../components/AdminProductCard'; // Verifique o caminho

function AdminMenuManagement() {
    // SUA LÓGICA DE ESTADOS ORIGINAL
    const { currentUser, isAdmin, isMasterAdmin, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [establishmentId, setEstablishmentId] = useState(null);
    const [establishmentName, setEstablishmentName] = useState('');
    const [menuItems, setMenuItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [showItemForm, setShowItemForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({ nome: '', descricao: '', preco: '', categoria: '', imageUrl: '', ativo: true });
    const [itemImage, setItemImage] = useState(null);
    const [imagePreview, setImagePreview] = useState('');
    const [formLoading, setFormLoading] = useState(false);

    // SEUS USEEFFECTS ORIGINAIS
    useEffect(() => {
        if (authLoading) return;
        if (!currentUser || !isAdmin) { toast.error('Acesso negado.'); navigate('/'); return; }
        const fetchEstablishmentData = async () => { if (isAdmin && !isMasterAdmin) { try { const q = query(collection(db, 'estabelecimentos'), where('adminUID', '==', currentUser.uid)); const querySnapshot = await getDocs(q); if (!querySnapshot.empty) { const estabDoc = querySnapshot.docs[0]; setEstablishmentId(estabDoc.id); setEstablishmentName(estabDoc.data().nome); } else { setError("Nenhum estabelecimento encontrado."); setLoading(false); } } catch(err) { setError("Erro ao buscar seu estabelecimento."); setLoading(false); } } else { setLoading(false); } };
        fetchEstablishmentData();
    }, [currentUser, isAdmin, isMasterAdmin, authLoading, navigate]);

    useEffect(() => {
        if (!establishmentId) return; setLoading(true);
        const q = query(collection(db, 'estabelecimentos', establishmentId, 'cardapio'), orderBy('categoria'), orderBy('nome'));
        const unsubscribe = onSnapshot(q, (snapshot) => { setMenuItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setLoading(false); }, (err) => { setError("Erro ao carregar itens do cardápio."); setLoading(false); });
        return () => unsubscribe();
    }, [establishmentId]);

    // SUAS FUNÇÕES HANDLER ORIGINAIS
    const openItemForm = (item = null) => { setEditingItem(item); setFormData(item ? { ...item } : { nome: '', descricao: '', preco: '', categoria: '', imageUrl: '', ativo: true }); setItemImage(null); setImagePreview(item && item.imageUrl ? item.imageUrl : ''); setShowItemForm(true); };
    const closeItemForm = () => { setShowItemForm(false); setEditingItem(null); setItemImage(null); setImagePreview(''); };
    const handleFormChange = (e) => { const { name, value, type, checked, files } = e.target; if (type === 'file') { const file = files[0]; setItemImage(file); if (file) { setImagePreview(URL.createObjectURL(file)); } else { setImagePreview(editingItem && editingItem.imageUrl ? editingItem.imageUrl : ''); } } else { setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value })); } };
    const handleSaveItem = async (e) => { e.preventDefault(); const { nome, preco, categoria } = formData; if (!nome.trim() || !preco || !categoria.trim()) { toast.warn("Nome, Preço e Categoria são obrigatórios."); return; } setFormLoading(true); let finalImageUrl = formData.imageUrl; try { if (itemImage) { const imageName = `${establishmentId}_${Date.now()}_${itemImage.name}`; const imagePath = `images/menuItems/${imageName}`; finalImageUrl = await uploadFile(itemImage, imagePath); } const dataToSave = { ...formData, preco: Number(formData.preco), imageUrl: finalImageUrl }; if (editingItem) { await updateDoc(doc(db, 'estabelecimentos', establishmentId, 'cardapio', editingItem.id), dataToSave); toast.success("Item atualizado!"); } else { await addDoc(collection(db, 'estabelecimentos', establishmentId, 'cardapio'), dataToSave); toast.success("Item cadastrado!"); } closeItemForm(); } catch (error) { toast.error("Erro ao salvar o item: " + error.message); } finally { setFormLoading(false); } };
    const handleDeleteItem = async (itemId, itemName, itemImageUrl) => { if (window.confirm(`Tem certeza que deseja excluir o item "${itemName}"?`)) { try { if (itemImageUrl) { /* Deletar imagem */ } await deleteDoc(doc(db, 'estabelecimentos', establishmentId, 'cardapio', itemId)); toast.success("Item excluído!"); } catch (error) { toast.error("Erro ao excluir o item."); } } };
    const toggleItemStatus = async (item) => { try { await updateDoc(doc(db, 'estabelecimentos', establishmentId, 'cardapio', item.id), { ativo: !item.ativo }); toast.success(`Status de "${item.nome}" alterado!`); } catch(error) { toast.error("Erro ao alterar o status."); } };
    
    // SUA LÓGICA ORIGINAL PARA GERAR CATEGORIAS
    const categories = useMemo(() => ['Todos', ...new Set(menuItems.map(item => item.categoria))], [menuItems]);
    const filteredItems = useMemo(() => { return menuItems.filter(item => (selectedCategory === 'Todos' || item.categoria === selectedCategory) && item.nome.toLowerCase().includes(searchTerm.toLowerCase())); }, [menuItems, searchTerm, selectedCategory]);

    if (authLoading || loading) return <div className="text-center p-8">Carregando...</div>;
    if (error) return <div className="text-center p-8 text-red-600">{error}</div>;

    return (
        <div className="bg-gray-100 min-h-screen font-sans">
            <div className="max-w-4xl mx-auto p-4">
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <div>
                        <Link to="/dashboard" className="text-sm font-semibold text-gray-600 hover:text-secondary flex items-center mb-2">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                           Voltar ao Dashboard
                       </Link>
                       <h1 className="text-3xl font-bold text-secondary">Gerenciar Cardápio</h1>
                       <p className="text-md text-gray-500 mt-1">{establishmentName}</p>
                    </div>
                    <button onClick={() => openItemForm()} className="w-full sm:w-auto px-5 py-3 bg-secondary text-primary rounded-lg shadow-md hover:bg-gray-800 flex items-center gap-2 justify-center transition-colors font-bold">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
                        Cadastrar Item
                    </button>
                </header>

                {/* ▼▼▼ NOVO LAYOUT DE FILTROS SEM ROLAGEM LATERAL ▼▼▼ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <input type="text" placeholder="Buscar por nome..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-3 rounded-lg border-gray-300 focus:ring-primary focus:border-primary shadow-sm"/>
                    <select 
                        value={selectedCategory} 
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full p-3 rounded-lg border-gray-300 focus:ring-primary focus:border-primary shadow-sm"
                    >
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>

                {/* ▼▼▼ LISTA DE CARDS SUBSTITUINDO A TABELA ▼▼▼ */}
                <div className="space-y-3">
                    {filteredItems.length === 0 && !loading ? (
                        <div className="text-center p-16 bg-accent rounded-xl shadow-sm">
                            <h3 className="text-lg font-semibold text-secondary">Nenhum item encontrado</h3>
                            <p className="mt-1 text-sm text-gray-500">Tente ajustar sua busca ou mude a categoria.</p>
                        </div>
                    ) : (
                        filteredItems.map(item => (
                            <AdminProductCard 
                                key={item.id} 
                                produto={item} 
                                onEdit={() => openItemForm(item)}
                                onDelete={() => handleDeleteItem(item.id, item.nome, item.imageUrl)}
                                onToggleStatus={() => toggleItemStatus(item)}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* SEU MODAL ORIGINAL, SEM ALTERAÇÕES NA LÓGICA */}
            {showItemForm && ( <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50"> <div className="bg-accent rounded-lg shadow-xl p-6 max-w-lg w-full"> <h2 className="text-xl font-bold text-secondary mb-6">{editingItem ? 'Editar Item' : 'Cadastrar Novo Item'}</h2> <form onSubmit={handleSaveItem} className="space-y-4"> <input name="nome" value={formData.nome} onChange={handleFormChange} placeholder="Nome do Item *" className="w-full border-gray-300 rounded-lg focus:ring-primary focus:border-primary"/> <textarea name="descricao" value={formData.descricao} onChange={handleFormChange} placeholder="Descrição do Item" className="w-full border-gray-300 rounded-lg focus:ring-primary focus:border-primary" rows="3"></textarea> <div className="grid grid-cols-2 gap-4"> <input name="preco" type="number" step="0.01" value={formData.preco} onChange={handleFormChange} placeholder="Preço *" className="w-full border-gray-300 rounded-lg focus:ring-primary focus:border-primary"/> <input name="categoria" value={formData.categoria} onChange={handleFormChange} placeholder="Categoria *" className="w-full border-gray-300 rounded-lg focus:ring-primary focus:border-primary"/> </div> <div> <label className="block text-sm font-medium text-gray-700 mb-1">Imagem</label> <input type="file" id="itemImageUpload" name="itemImageUpload" accept="image/*" onChange={handleFormChange} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"/> {(imagePreview || formData.imageUrl) && ( <div className="mt-4"> <img src={imagePreview || formData.imageUrl} alt="Pré-visualização" className="w-24 h-24 object-cover rounded-lg shadow"/> </div> )} </div> <div className="flex items-center"> <input type="checkbox" name="ativo" checked={formData.ativo} onChange={handleFormChange} id="itemAtivo" className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"/> <label htmlFor="itemAtivo" className="ml-2 text-sm text-gray-700">Item Ativo</label> </div> <div className="flex justify-end gap-4 pt-4"> <button type="button" onClick={closeItemForm} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300">Cancelar</button> <button type="submit" disabled={formLoading} className="px-6 py-2 bg-secondary text-primary rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50"> {formLoading ? 'Salvando...' : (editingItem ? 'Salvar Alterações' : 'Adicionar Item')} </button> </div> </form> </div> </div> )}
        </div>
    );
}

export default AdminMenuManagement;