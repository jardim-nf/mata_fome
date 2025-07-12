// src/pages/AdminMenuManagement.jsx
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore'; 
import { db } from '../firebase';
import { Link } from 'react-router-dom';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // Mantenha se planeja usar o storage futuramente
import { auth } from '../firebase'; // Mantenha se planeja usar o auth para regras de storage

function AdminMenuManagement() {
    const [estabelecimentos, setEstabelecimentos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedEstablishmentId, setSelectedEstablishmentId] = useState(null);
    const [selectedEstablishmentName, setSelectedEstablishmentName] = useState('');
    const [menuItems, setMenuItems] = useState([]);
    const [loadingMenuItems, setLoadingMenuItems] = useState(false);

    // Estados para o formulário de cadastro/edição de item
    const [showItemForm, setShowItemForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    const [itemName, setItemName] = useState('');
    const [itemDescription, setItemDescription] = useState('');
    const [itemPrice, setItemPrice] = useState('');
    const [itemCategory, setItemCategory] = useState('');
    const [itemImageUrl, setItemImageUrl] = useState(''); 
    const [selectedImageFile, setSelectedImageFile] = useState(null); // Mantenha se planeja usar o upload futuramente
    const [uploadingImage, setUploadingImage] = useState(false); // Mantenha se planeja usar o upload futuramente
    const [imagePreviewUrl, setImagePreviewUrl] = useState(''); // Mantenha se planeja usar a pré-visualização futuramente
    const [uploadComplete, setUploadComplete] = useState(false); // Mantenha se planeja usar o upload futuramente

    const [formError, setFormError] = useState('');
    const [formLoading, setFormLoading] = useState(false);

    // Efeito para carregar a lista de estabelecimentos
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'estabelecimentos'), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setEstabelecimentos(data);
            setLoading(false);
        }, (error) => {
            console.error("Erro ao carregar estabelecimentos:", error);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    // Efeito para carregar os itens do cardápio do estabelecimento selecionado
    useEffect(() => {
        if (!selectedEstablishmentId) {
            setMenuItems([]);
            return;
        }
        setLoadingMenuItems(true);
        const unsub = onSnapshot(collection(db, 'estabelecimentos', selectedEstablishmentId, 'cardapio'), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMenuItems(data);
            setLoadingMenuItems(false);
        }, (error) => {
            console.error("Erro ao carregar itens do cardápio:", error);
            setLoadingMenuItems(false);
        });
        return () => unsub();
    }, [selectedEstablishmentId]);

    const handleSelectEstablishment = (id, name) => {
        setSelectedEstablishmentId(id);
        setSelectedEstablishmentName(name);
        setShowItemForm(false); 
        setEditingItem(null);
    };

    const handleFileChange = (e) => { // Mantenha se planeja usar o upload futuramente
        if (e.target.files[0]) {
            setSelectedImageFile(e.target.files[0]);
            setImagePreviewUrl(URL.createObjectURL(e.target.files[0])); // Cria URL temporária para pré-visualização
            setUploadComplete(false); // Reseta status de upload
        } else {
            setSelectedImageFile(null);
            setImagePreviewUrl('');
        }
    };

    const openItemForm = (itemToEdit = null) => {
        setEditingItem(itemToEdit);
        if (itemToEdit) {
            setItemName(itemToEdit.nome || '');
            setItemDescription(itemToEdit.descricao || '');
            setItemPrice(itemToEdit.preco || '');
            setItemCategory(itemToEdit.categoria || '');
            setItemImageUrl(itemToEdit.imageUrl || ''); 
            setImagePreviewUrl(itemToEdit.imageUrl || ''); // Pré-visualiza imagem existente
            setSelectedImageFile(null); 
        } else {
            setItemName('');
            setItemDescription('');
            setItemPrice('');
            setItemCategory('');
            setItemImageUrl('');
            setImagePreviewUrl('');
            setSelectedImageFile(null);
        }
        setFormError('');
        setShowItemForm(true);
        setUploadingImage(false);
        setUploadComplete(false);
    };

    const closeItemForm = () => {
        setShowItemForm(false);
        setEditingItem(null);
        setFormError('');
        setItemName(''); setItemDescription(''); setItemPrice(''); setItemCategory(''); setItemImageUrl('');
        setImagePreviewUrl('');
        setSelectedImageFile(null);
        setUploadingImage(false);
        setUploadComplete(false);
    };

    const handleSaveItem = async (e) => {
        e.preventDefault();
        if (!selectedEstablishmentId) {
            setFormError("Selecione um estabelecimento primeiro.");
            return;
        }
        if (!itemName.trim() || !itemPrice || !itemCategory.trim()) {
            setFormError("Nome, Preço e Categoria são obrigatórios.");
            return;
        }
        if (isNaN(Number(itemPrice)) || Number(itemPrice) < 0) {
            setFormError("Preço deve ser um número positivo.");
            return;
        }

        setFormLoading(true);
        setFormError('');
        
        let finalImageUrl = itemImageUrl.trim(); 

        // Lógica de UPLOAD DE IMAGEM (se o plano Blaze for ativado futuramente)
        if (selectedImageFile) {
            setUploadingImage(true);
            const storage = getStorage();
            const storageRef = ref(storage, `cardapio_images/${selectedEstablishmentId}/${selectedImageFile.name}_${Date.now()}`);
            try {
                const uploadTask = await uploadBytes(storageRef, selectedImageFile);
                finalImageUrl = await getDownloadURL(uploadTask.ref);
                console.log("Imagem carregada:", finalImageUrl);
                setUploadComplete(true);
            } catch (error) {
                console.error("Erro ao fazer upload da imagem:", error);
                setFormError("Erro ao fazer upload da imagem. Verifique as regras de Storage e o plano Firebase.");
                setUploadingImage(false);
                setFormLoading(false);
                return;
            } finally {
                setUploadingImage(false);
            }
        }
        
        const itemData = {
            nome: itemName.trim(),
            descricao: itemDescription.trim(),
            preco: Number(itemPrice),
            categoria: itemCategory.trim(),
            imageUrl: finalImageUrl 
        };

        try {
            if (editingItem) {
                const itemRef = doc(db, 'estabelecimentos', selectedEstablishmentId, 'cardapio', editingItem.id);
                await updateDoc(itemRef, itemData);
                alert("Item atualizado com sucesso!");
            } else {
                await addDoc(collection(db, 'estabelecimentos', selectedEstablishmentId, 'cardapio'), itemData);
                alert("Item cadastrado com sucesso!");
            }
            closeItemForm(); 
        } catch (error) {
            console.error("Erro ao salvar item:", error);
            setFormError("Erro ao salvar item. Verifique o console.");
        } finally {
            setFormLoading(false);
        }
    };

    const handleDeleteItem = async (itemId) => {
        if (window.confirm("Tem certeza que deseja excluir este item? Isso removerá a imagem também (se do Firebase Storage).")) {
            try {
                // Se a imagem foi carregada para o Storage, você pode tentar excluí-la aqui
                // const storage = getStorage();
                // const imageRef = ref(storage, 'caminho/para/sua/imagem_no_storage'); // Você precisaria salvar o caminho do storage no item
                // await deleteObject(imageRef); 

                const itemRef = doc(db, 'estabelecimentos', selectedEstablishmentId, 'cardapio', itemId);
                await deleteDoc(itemRef);
                alert("Item excluído com sucesso!");
            } catch (error) {
                console.error("Erro ao excluir item:", error);
                alert("Erro ao excluir item. Verifique o console.");
            }
        }
    };


    return (
        <div className="min-h-screen bg-[var(--bege-claro)] p-6">
            <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-xl p-8">
                <Link to="/dashboard" className="inline-flex items-center px-4 py-2 bg-gray-200 text-[var(--marrom-escuro)] rounded-lg font-semibold hover:bg-gray-300 transition duration-300 mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    Voltar para o Dashboard
                </Link>

                <h1 className="text-3xl font-bold text-center text-[var(--vermelho-principal)] mb-8">
                    Gerenciar Cardápios
                </h1>

                {/* Seleção de Estabelecimento */}
                <div className="mb-8">
                    <h2 className="text-2xl font-semibold text-[var(--marrom-escuro)] mb-4">
                        {selectedEstablishmentId ? `Cardápio de: ${selectedEstablishmentName}` : 'Selecione um Estabelecimento para Gerenciar:'}
                    </h2>
                    {loading ? (
                        <p className="text-center text-[var(--cinza-texto)]">Carregando estabelecimentos...</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {estabelecimentos.map(estab => (
                                <button
                                    key={estab.id}
                                    onClick={() => handleSelectEstablishment(estab.id, estab.nome)}
                                    className={`p-4 rounded-lg shadow-md hover:shadow-lg transition duration-300 ${selectedEstablishmentId === estab.id ? 'bg-[var(--vermelho-principal)] text-white' : 'bg-gray-100 text-[var(--marrom-escuro)]'}`}
                                >
                                    {estab.nome}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Gerenciamento de Itens do Cardápio */}
                {selectedEstablishmentId && (
                    <div className="mt-8 bg-gray-50 p-6 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-[var(--marrom-escuro)]">Itens do Cardápio</h3>
                            <button
                                onClick={() => openItemForm()} 
                                className="bg-[var(--verde-destaque)] text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition duration-300"
                            >
                                + Cadastrar Novo Item
                            </button>
                        </div>

                        {/* Formulário de Cadastro/Edição de Item (Condicional) */}
                        {showItemForm && (
                            <form onSubmit={handleSaveItem} className="mb-8 p-4 bg-white rounded-lg shadow-inner border border-gray-100">
                                <h4 className="text-lg font-bold text-[var(--marrom-escuro)] mb-4">{editingItem ? 'Editar Item' : 'Novo Item do Cardápio'}</h4>
                                {formError && <p className="text-red-500 text-sm mb-4">{formError}</p>}
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label htmlFor="itemName" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Nome do Item *</label>
                                        <input type="text" id="itemName" value={itemName} onChange={(e) => setItemName(e.target.value)}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" required />
                                    </div>
                                    <div>
                                        <label htmlFor="itemPrice" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Preço *</label>
                                        <input type="number" id="itemPrice" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" required min="0" step="0.01" />
                                    </div>
                                    <div>
                                        <label htmlFor="itemCategory" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Categoria *</label>
                                        <input type="text" id="itemCategory" value={itemCategory} onChange={(e) => setItemCategory(e.target.value)}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" placeholder="Ex: Hambúrgueres, Bebidas" required />
                                    </div>
                                    {/* Campo para URL da Imagem OU Upload de Arquivo */}
                                    <div>
                                        <label htmlFor="itemImageUrl" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">URL da Imagem (Opcional)</label>
                                        <input type="text" id="itemImageUrl" value={itemImageUrl} onChange={(e) => setItemImageUrl(e.target.value)}
                                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" placeholder="Ex: https://minhaimagem.com/foto.jpg ou /images/x-burger.jpg" />
                                    </div>
                                    <div>
                                        <label htmlFor="imageUpload" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Ou Fazer Upload da Imagem</label>
                                        <input type="file" id="imageUpload" accept="image/*" onChange={handleFileChange}
                                            className="w-full border border-gray-300 rounded-md p-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" />
                                        {selectedImageFile && <p className="text-sm text-gray-500 mt-1">Arquivo selecionado: {selectedImageFile.name}</p>}
                                        {imagePreviewUrl && !uploadingImage && ( // Mostra pré-visualização se houver URL e não estiver carregando
                                            <img src={imagePreviewUrl} alt="Pré-visualização" className="w-20 h-20 object-cover rounded-md mt-2" />
                                        )}
                                        {uploadingImage && <p className="text-sm text-blue-600 mt-1">Carregando imagem...</p>}
                                        {uploadComplete && <p className="text-sm text-green-600 mt-1">Upload concluído!</p>}
                                    </div>
                                </div>
                                <div className="mb-4">
                                    <label htmlFor="itemDescription" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Descrição (Opcional)</label>
                                    <textarea id="itemDescription" value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} rows="3"
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" placeholder="Uma breve descrição do item..."></textarea>
                                </div>
                                
                                <div className="flex gap-4 justify-end">
                                    <button type="button" onClick={closeItemForm} className="bg-gray-300 text-[var(--marrom-escuro)] px-4 py-2 rounded-lg font-semibold hover:bg-gray-400 transition duration-300">Cancelar</button>
                                    <button type="submit" disabled={formLoading || uploadingImage} className="bg-[var(--vermelho-principal)] text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition duration-300">
                                        {formLoading || uploadingImage ? 'Salvando...' : (editingItem ? 'Salvar Edição' : 'Cadastrar Item')}
                                    </button>
                                </div>
                            </form>
                        )}


                        {loadingMenuItems ? (
                            <p className="text-center text-[var(--cinza-texto)]">Carregando itens do cardápio...</p>
                        ) : menuItems.length === 0 ? (
                            <p className="text-center text-[var(--cinza-texto)] italic">Nenhum item cadastrado para este estabelecimento.</p>
                        ) : (
                            <ul className="space-y-3">
                                {menuItems.map(item => (
                                    <li key={item.id} className="flex items-center justify-between p-3 bg-white rounded-md border border-gray-100 shadow-sm">
                                        <div className="flex items-center">
                                            {item.imageUrl && (
                                                <img
                                                    src={item.imageUrl}
                                                    alt={item.nome}
                                                    className="w-10 h-10 mr-3 rounded-md object-cover"
                                                    onError={(e) => {
                                                        e.target.onerror = null; // Evita loop infinito em caso de erro
                                                        e.target.src = '/images/placeholder.png'; // Use uma imagem placeholder se a URL for inválida
                                                    }}
                                                />
                                            )}
                                            <span className="font-medium text-[var(--marrom-escuro)]">{item.nome}</span>
                                        </div>
                                        <div className="flex items-center">
                                            <span className="text-[var(--vermelho-principal)] font-bold mr-4">R$ {item.preco.toFixed(2)}</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => openItemForm(item)} className="text-blue-500 hover:text-blue-700 transition duration-300">Editar</button>
                                                <button onClick={() => handleDeleteItem(item.id)} className="text-red-500 hover:text-red-700 transition duration-300">Excluir</button>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default AdminMenuManagement;