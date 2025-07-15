import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';

// <<< LINHA DE IMPORTAÇÃO CORRIGIDA >>>
import AdminProductCard from '../components/AdminProductCard'; 

function AdminMenuManagement() {
    const { currentUser, isAdmin, loading: authLoading } = useAuth();

    const [estabelecimentos, setEstabelecimentos] = useState([]); // Este estado não é mais diretamente usado para seleção de estabelecimento por adminUID, mas a lista pode ser usada se um admin puder ver vários
    const [loadingEstabelecimentos, setLoadingEstabelecimentos] = useState(true);
    const [selectedEstablishmentId, setSelectedEstablishmentId] = useState(null);
    const [selectedEstablishmentName, setSelectedEstablishmentName] = useState('');
    const [menuItems, setMenuItems] = useState([]);
    const [loadingMenuItems, setLoadingMenuItems] = useState(false);
    const [adminError, setAdminError] = useState('');

    // Estados para o formulário de cadastro/edição de item do cardápio
    const [showItemForm, setShowItemForm] = useState(false);
    const [editingItem, setEditingItem] = useState(null); // Item do cardápio que está sendo editado

    const [itemName, setItemName] = useState('');
    const [itemDescription, setItemDescription] = useState('');
    const [itemPrice, setItemPrice] = useState('');
    const [itemCategory, setItemCategory] = useState('');
    const [itemImageUrl, setItemImageUrl] = useState(''); 
    const [selectedImageFile, setSelectedImageFile] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [imagePreviewUrl, setImagePreviewUrl] = useState('');
    const [uploadComplete, setUploadComplete] = useState(false);

    const [formError, setFormError] = useState('');
    const [formLoading, setFormLoading] = useState(false);

    const [itemAtivo, setItemAtivo] = useState(true); // Estado para o status 'ativo' do item no formulário

    // Efeito para carregar o ID do estabelecimento vinculado ao admin logado
    useEffect(() => {
        if (!authLoading && currentUser && isAdmin) {
            const fetchEstablishmentData = async () => {
                try {
                    const q = query(collection(db, 'estabelecimentos'), where('adminUID', '==', currentUser.uid));
                    const querySnapshot = await getDocs(q);

                    if (!querySnapshot.empty) {
                        const estabDoc = querySnapshot.docs[0];
                        setSelectedEstablishmentId(estabDoc.id);
                        setSelectedEstablishmentName(estabDoc.data().nome);
                    } else {
                        setAdminError("Nenhum estabelecimento encontrado para este administrador. Certifique-se de que o campo 'adminUID' está configurado no Firestore.");
                    }
                } catch (err) {
                    console.error("Erro ao buscar informações do estabelecimento:", err);
                    setAdminError("Erro ao carregar informações do estabelecimento. Verifique sua conexão.");
                } finally {
                    setLoadingEstabelecimentos(false); // Indica que a parte inicial de carregamento está feita
                }
            };
            fetchEstablishmentData();
        } else if (!authLoading && (!currentUser || !isAdmin)) {
            setAdminError("Acesso negado. Você não tem permissões de administrador para gerenciar o cardápio.");
            setLoadingEstabelecimentos(false);
        }
    }, [currentUser, isAdmin, authLoading]);

    // Efeito para carregar os itens do cardápio do estabelecimento selecionado (em tempo real)
    useEffect(() => {
        if (!selectedEstablishmentId) {
            setMenuItems([]);
            return;
        }
        setLoadingMenuItems(true); // Redefine o loading ao selecionar um estabelecimento
        const unsub = onSnapshot(collection(db, 'estabelecimentos', selectedEstablishmentId, 'cardapio'), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMenuItems(data);
            setLoadingMenuItems(false);
        }, (error) => {
            console.error("Erro ao carregar itens do cardápio:", error);
            setLoadingMenuItems(false);
            setAdminError("Erro ao carregar itens do cardápio.");
        });
        return () => unsub();
    }, [selectedEstablishmentId]);

    // Função para abrir o formulário (para adicionar ou editar um item do cardápio)
    const openItemForm = (itemToEdit = null) => {
        setEditingItem(itemToEdit);
        if (itemToEdit) {
            setItemName(itemToEdit.nome || '');
            setItemDescription(itemToEdit.descricao || '');
            setItemPrice(itemToEdit.preco || '');
            setItemCategory(itemToEdit.categoria || '');
            setItemImageUrl(itemToEdit.imageUrl || '');
            setImagePreviewUrl(itemToEdit.imageUrl || '');
            setSelectedImageFile(null); // Limpa arquivo de upload se estiver editando uma URL
            setItemAtivo(itemToEdit.ativo !== undefined ? itemToEdit.ativo : true); // Carrega o status ativo existente
        } else {
            setItemName(''); setItemDescription(''); setItemPrice(''); setItemCategory(''); setItemImageUrl('');
            setImagePreviewUrl(''); setSelectedImageFile(null);
            setItemAtivo(true); // Novo item é ativo por padrão
        }
        setFormError(''); setShowItemForm(true); setUploadingImage(false); setUploadComplete(false);
    };

    // Função para fechar o formulário
    const closeItemForm = () => {
        setShowItemForm(false); setEditingItem(null); setFormError('');
        setItemName(''); setItemDescription(''); setItemPrice(''); setItemCategory(''); setItemImageUrl('');
        setImagePreviewUrl(''); setSelectedImageFile(null); setUploadingImage(false); setUploadComplete(false);
        setItemAtivo(true); // Reseta o estado ativo para o padrão de um novo item
    };

    // Lógica para upload de imagem (se for usado)
    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setSelectedImageFile(e.target.files[0]);
            setImagePreviewUrl(URL.createObjectURL(e.target.files[0]));
            setUploadComplete(false);
        } else {
            setSelectedImageFile(null);
            setImagePreviewUrl('');
        }
    };

    // Função para salvar (adicionar ou atualizar) o item do cardápio
    const handleSaveItem = async (e) => {
        e.preventDefault();
        if (!selectedEstablishmentId) {
            setFormError("ID do estabelecimento não selecionado. Não foi possível salvar o item."); // Este erro não deve ocorrer com adminUID
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
            imageUrl: finalImageUrl,
            ativo: itemAtivo // Incluir o status 'ativo'
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

    // Função para excluir item do cardápio
    const handleDeleteItem = async (itemId) => {
        if (window.confirm("Tem certeza que deseja excluir este item? Esta ação é irreversível.")) {
            try {
                const itemRef = doc(db, 'estabelecimentos', selectedEstablishmentId, 'cardapio', itemId);
                await deleteDoc(itemRef);
                alert("Item excluído com sucesso!");
            } catch (error) {
                console.error("Erro ao excluir item:", error);
                alert("Erro ao excluir item. Verifique o console.");
            }
        }
    };


    // Renderização do componente
    if (authLoading || loadingMenuItems || loadingEstabelecimentos) { // Carrega enquanto autentica ou busca dados
        return <div className="flex justify-center items-center h-screen"><p className="text-xl text-gray-700">Carregando gerenciamento de cardápio...</p></div>;
    }

    if (adminError) {
        return <div className="flex justify-center items-center h-screen"><p className="text-xl text-red-600">{adminError}</p></div>;
    }

    if (!selectedEstablishmentId) {
        return (
            <div className="flex justify-center items-center h-screen">
                <p className="text-xl text-gray-700">Nenhum estabelecimento encontrado ou vinculado a este administrador.</p>
                <Link to="/dashboard" className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">Voltar para o Dashboard</Link>
            </div>
        );
    }

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
                    Gerenciar Cardápio de {selectedEstablishmentName}
                </h1>

                {/* Seção de Gerenciamento de Itens do Cardápio */}
                <div className="mt-8 bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-[var(--marrom-escuro)]">Itens do Cardápio</h3>
                        <button
                            onClick={() => openItemForm()}
                            className="bg-green-700 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition duration-300"
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
                                    {imagePreviewUrl && !uploadingImage && (
                                        <img src={imagePreviewUrl} alt="Pré-visualização" className="w-20 h-20 object-cover rounded-md mt-2" />
                                    )}
                                    {uploadingImage && <p className="text-sm text-blue-600 mt-1">Carregando imagem...</p>}
                                    {uploadComplete && <p className="text-sm text-green-600 mt-1">Upload concluído!</p>}
                                </div>
                                {/* Campo para Status Ativo/Inativo */}
                                <div>
                                    <label htmlFor="itemAtivo" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Status do Item</label>
                                    <select id="itemAtivo" value={itemAtivo} onChange={(e) => setItemAtivo(e.target.value === 'true')}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]">
                                        <option value="true">Ativo</option>
                                        <option value="false">Desativado</option>
                                    </select>
                                </div>
                            </div>
                            <div className="mb-4">
                                <label htmlFor="itemDescription" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Descrição (Opcional)</label>
                                <textarea id="itemDescription" value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} rows="3"
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]" placeholder="Uma breve descrição do item..."></textarea>
                            </div>
                            
                            <div className="flex gap-4 justify-end">
                                <button type="button" onClick={closeItemForm} className="bg-gray-300 text-[var(--marrom-escuro)] px-4 py-2 rounded-lg font-semibold hover:bg-gray-400 transition duration-300">Cancelar</button>
                                <button type="submit" disabled={formLoading || uploadingImage} className="bg-green-700 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition duration-300">
                                    {formLoading || uploadingImage ? 'Salvando...' : (editingItem ? 'Salvar Edição' : 'Cadastrar Item')}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Lista de Itens do Cardápio (visão do administrador) */}
                    {loadingMenuItems ? (
                        <p className="text-center text-[var(--cinza-texto)]">Carregando itens do cardápio...</p>
                    ) : menuItems.length === 0 ? (
                        <p className="text-center text-[var(--cinza-texto)] italic">Nenhum item cadastrado para este estabelecimento.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {menuItems.map(item => (
                                <AdminProductCard // AGORA USANDO AdminProductCard
                                    key={item.id} 
                                    produto={item} 
                                    estabelecimentoId={selectedEstablishmentId}
                                    onEdit={openItemForm}
                                    onDelete={handleDeleteItem}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AdminMenuManagement;