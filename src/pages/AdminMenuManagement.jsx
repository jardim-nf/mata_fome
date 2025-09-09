import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, getDoc, orderBy } from 'firebase/firestore';
// CAMINHOS CORRIGIDOS
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { uploadFile, deleteFileByUrl } from '../utils/firebaseStorageService';
import AdminProductCard from '../components/AdminProductCard';
import { IoArrowBack, IoAddCircleOutline, IoPencil } from 'react-icons/io5';

function AdminMenuManagement() {
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
            toast.error('Acesso negado. Faça login como administrador.');
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

    // Busca itens do cardápio em tempo real
    useEffect(() => {
        if (!estabelecimentoId) {
            setLoading(false);
            toast.warn("Nenhum estabelecimento associado a este administrador.");
            return;
        }
        
        setLoading(true);
        const q = query(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio'), orderBy('categoria'), orderBy('nome'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMenuItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        }, (err) => {
            toast.error("Erro ao carregar itens do cardápio.");
            console.error(err);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [estabelecimentoId]);

    const openItemForm = (item = null) => {
        setEditingItem(item);
        if (item) {
            setFormData({ ...item, preco: item.preco || '' });
            setImagePreview(item.imageUrl); // Aqui o imageUrl é o caminho, mas para o preview inicial ainda funciona se for uma URL completa de um item antigo
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

    const handleSaveItem = async (e) => {
        e.preventDefault();
        const { nome, preco, categoria } = formData;
        if (!nome.trim() || !preco || !categoria.trim()) {
            toast.warn("Nome, Preço e Categoria são obrigatórios.");
            return;
        }
        setFormLoading(true);

        // A variável agora armazena o caminho da imagem, não a URL.
        let finalImagePath = editingItem?.imageUrl || '';

        try {
            // Se uma nova imagem foi selecionada, faz o upload.
            if (itemImage) {
                // Se o item já tinha uma imagem, deleta a antiga para não acumular lixo no Storage.
                if (editingItem && editingItem.imageUrl) {
                    await deleteFileByUrl(editingItem.imageUrl);
                }
                const imageName = `${estabelecimentoId}_${Date.now()}_${itemImage.name.replace(/\s/g, '_')}`;
                const imagePath = `images/menuItems/${imageName}`;
                
                // A função uploadFile agora retorna o caminho do arquivo.
                finalImagePath = await uploadFile(itemImage, imagePath);
            }

            const dataToSave = { 
                ...formData, 
                preco: Number(formData.preco), 
                imageUrl: finalImagePath // Salva o caminho da imagem no Firestore.
            };
            
            if (editingItem) {
                await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', editingItem.id), dataToSave);
                toast.success("Item atualizado com sucesso!");
            } else {
                await addDoc(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio'), dataToSave);
                toast.success("Item cadastrado com sucesso!");
            }
            closeItemForm();
        } catch (error) {
            toast.error("Erro ao salvar o item: " + error.message);
            console.error("Erro ao salvar item:", error);
        } finally {
            setFormLoading(false);
        }
    };
    
    const handleDeleteItem = async (item) => {
        toast.warning(
            ({ closeToast }) => (
                <div>
                    <p className="font-semibold">Confirmar exclusão?</p>
                    <p className="text-sm">Excluir o item "{item.nome}"?</p>
                    <div className="flex justify-end mt-2 space-x-2">
                        <button onClick={closeToast} className="px-3 py-1 text-sm bg-gray-500 text-white rounded">Cancelar</button>
                        <button onClick={async () => {
                            try {
                                // Deleta a imagem do Storage se ela existir
                                if (item.imageUrl) {
                                    await deleteFileByUrl(item.imageUrl);
                                }
                                // Deleta o documento do Firestore
                                await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', item.id));
                                toast.success("Item excluído!");
                            } catch (error) {
                                toast.error("Erro ao excluir o item.");
                                console.error("Erro ao excluir:", error);
                            }
                            closeToast();
                        }} className="px-3 py-1 text-sm bg-red-600 text-white rounded">Excluir</button>
                    </div>
                </div>
            ), { autoClose: false, closeOnClick: false, position: "top-center" }
        );
    };

    const toggleItemStatus = async (item) => {
        try {
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', item.id), { ativo: !item.ativo });
            toast.info(`Status de "${item.nome}" alterado para ${!item.ativo ? 'Inativo' : 'Ativo'}.`);
        } catch(error) {
            toast.error("Erro ao alterar o status do item.");
        }
    };
    
    const categories = useMemo(() => ['Todos', ...new Set(menuItems.map(item => item.categoria).filter(Boolean))], [menuItems]);
    
    const filteredItems = useMemo(() => {
        return menuItems.filter(item =>
            (selectedCategory === 'Todos' || item.categoria === selectedCategory) &&
            (item.nome || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [menuItems, searchTerm, selectedCategory]);

    if (authLoading || loading) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">Carregando...</div>;
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
                            <IoAddCircleOutline size={20} />
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
                        className="w-full bg-gray-700 text-white p-3 rounded-md border-gray-600 placeholder-gray-400 focus:ring-amber-500 focus:border-amber-500"
                    />
                    <select 
                        value={selectedCategory} 
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full bg-gray-700 text-white p-3 rounded-md border-gray-600 focus:ring-amber-500 focus:border-amber-500"
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
                                onDelete={() => handleDeleteItem(item)}
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
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-gray-800 rounded-xl shadow-2xl p-6 max-w-lg w-full text-white m-auto">
                        <h2 className="text-2xl font-bold text-amber-400 mb-6 flex items-center">
                            {editingItem ? <IoPencil className="mr-2" /> : <IoAddCircleOutline className="mr-2" />}
                            {editingItem ? 'Editar Item' : 'Cadastrar Novo Item'}
                        </h2>
                        <form onSubmit={handleSaveItem} className="space-y-4">
                            <input name="nome" value={formData.nome} onChange={handleFormChange} placeholder="Nome do Item *" className="w-full bg-gray-700 p-2 rounded-md border-gray-600 focus:ring-amber-500 focus:border-amber-500"/>
                            <textarea name="descricao" value={formData.descricao} onChange={handleFormChange} placeholder="Descrição" className="w-full bg-gray-700 p-2 rounded-md border-gray-600 focus:ring-amber-500 focus:border-amber-500" rows="3"></textarea>
                            <div className="grid grid-cols-2 gap-4">
                                <input name="preco" type="number" step="0.01" value={formData.preco} onChange={handleFormChange} placeholder="Preço *" className="w-full bg-gray-700 p-2 rounded-md border-gray-600 focus:ring-amber-500 focus:border-amber-500"/>
                                <input name="categoria" value={formData.categoria} onChange={handleFormChange} placeholder="Categoria *" className="w-full bg-gray-700 p-2 rounded-md border-gray-600 focus:ring-amber-500 focus:border-amber-500"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Imagem</label>
                                <input type="file" accept="image/*" onChange={handleFormChange} className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-500 file:text-black hover:file:bg-amber-600 cursor-pointer"/>
                                {imagePreview && (
                                    <div className="mt-4"><img src={imagePreview} alt="Preview" className="w-24 h-24 object-cover rounded-lg shadow"/></div>
                                )}
                            </div>
                            <div className="flex items-center">
                                <input type="checkbox" name="ativo" checked={formData.ativo} onChange={handleFormChange} id="itemAtivo" className="h-4 w-4 text-amber-500 bg-gray-600 border-gray-500 rounded focus:ring-amber-500"/>
                                <label htmlFor="itemAtivo" className="ml-2 text-sm text-gray-300">Item Ativo no cardápio</label>
                            </div>
                            <div className="flex justify-end gap-4 pt-4">
                                <button type="button" onClick={closeItemForm} className="px-6 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg font-semibold transition-colors">Cancelar</button>
                                <button type="submit" disabled={formLoading} className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-black rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
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