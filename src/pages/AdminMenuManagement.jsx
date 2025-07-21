// src/pages/admin/AdminMenuManagement.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

function AdminMenuManagement() {
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
    const [formLoading, setFormLoading] = useState(false);

    useEffect(() => {
        if (authLoading) return;
        if (!currentUser || !isAdmin) {
            toast.error('Acesso negado.');
            navigate('/');
            return;
        }

        const fetchEstablishmentData = async () => {
            if (isAdmin && !isMasterAdmin) {
                try {
                    const q = query(collection(db, 'estabelecimentos'), where('adminUID', '==', currentUser.uid));
                    const querySnapshot = await getDocs(q);
                    if (!querySnapshot.empty) {
                        const estabDoc = querySnapshot.docs[0];
                        setEstablishmentId(estabDoc.id);
                        setEstablishmentName(estabDoc.data().nome);
                    } else {
                        setError("Nenhum estabelecimento encontrado para este administrador.");
                        setLoading(false);
                    }
                } catch(err) {
                    setError("Erro ao buscar seu estabelecimento.");
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        };
        fetchEstablishmentData();
    }, [currentUser, isAdmin, isMasterAdmin, authLoading, navigate]);

    useEffect(() => {
        if (!establishmentId) return;
        setLoading(true);
        const q = query(collection(db, 'estabelecimentos', establishmentId, 'cardapio'), orderBy('categoria'), orderBy('nome'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMenuItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        }, (err) => {
            setError("Erro ao carregar itens do cardápio. Verifique o índice do Firestore.");
            setLoading(false);
        });
        return () => unsubscribe();
    }, [establishmentId]);

    const openItemForm = (item = null) => {
        setEditingItem(item);
        setFormData(item ? { ...item } : { nome: '', descricao: '', preco: '', categoria: '', imageUrl: '', ativo: true });
        setShowItemForm(true);
    };

    const closeItemForm = () => {
        setShowItemForm(false);
        setEditingItem(null);
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSaveItem = async (e) => {
        e.preventDefault();
        const { nome, preco, categoria } = formData;
        if (!nome.trim() || !preco || !categoria.trim()) {
            toast.warn("Nome, Preço e Categoria são obrigatórios.");
            return;
        }
        setFormLoading(true);
        const dataToSave = { ...formData, preco: Number(formData.preco) };
        
        try {
            if (editingItem) {
                await updateDoc(doc(db, 'estabelecimentos', establishmentId, 'cardapio', editingItem.id), dataToSave);
                toast.success("Item atualizado com sucesso!");
            } else {
                await addDoc(collection(db, 'estabelecimentos', establishmentId, 'cardapio'), dataToSave);
                toast.success("Item cadastrado com sucesso!");
            }
            closeItemForm();
        } catch (error) {
            toast.error("Erro ao salvar o item.");
        } finally {
            setFormLoading(false);
        }
    };
    
    const handleDeleteItem = async (itemId, itemName) => {
        if (window.confirm(`Tem certeza que deseja excluir o item "${itemName}"?`)) {
            try {
                await deleteDoc(doc(db, 'estabelecimentos', establishmentId, 'cardapio', itemId));
                toast.success("Item excluído com sucesso!");
            } catch (error) {
                toast.error("Erro ao excluir o item.");
            }
        }
    };
    
    const toggleItemStatus = async (item) => {
        try {
            await updateDoc(doc(db, 'estabelecimentos', establishmentId, 'cardapio', item.id), { ativo: !item.ativo });
            toast.success(`Status de "${item.nome}" alterado!`);
        } catch(error) {
            toast.error("Erro ao alterar o status.");
        }
    };

    const categories = useMemo(() => ['Todos', ...new Set(menuItems.map(item => item.categoria))], [menuItems]);
    
    const filteredItems = useMemo(() => {
        return menuItems.filter(item => {
            const matchesCategory = selectedCategory === 'Todos' || item.categoria === selectedCategory;
            const matchesSearch = item.nome.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [menuItems, searchTerm, selectedCategory]);

    if (authLoading || loading) return <div className="text-center p-8">Carregando...</div>;
    if (error) return <div className="text-center p-8 text-red-600">{error}</div>;

    return (
        <div className="bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                    <div>
                        <Link to="/painel" className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center mb-1">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            Voltar ao Painel
                        </Link>
                        <h1 className="text-3xl font-bold text-slate-800">Gerenciar Cardápio</h1>
                        <p className="text-md text-slate-600 mt-1">{establishmentName}</p>
                    </div>
                    <button onClick={() => openItemForm()} className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 flex items-center gap-2 justify-center transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
                        Cadastrar Novo Item
                    </button>
                </div>
                
                <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex flex-col sm:flex-row gap-4">
                    <input type="text" placeholder="Buscar por nome..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full sm:w-1/3 rounded-lg border-slate-300"/>
                    <div className="flex-1 flex items-center gap-2 overflow-x-auto pb-2">
                        {categories.map(cat => (
                            <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-1 text-sm font-semibold rounded-full whitespace-nowrap ${selectedCategory === cat ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
                    {menuItems.length === 0 && !loading ? (
                        <div className="text-center p-16">
                            <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum item cadastrado</h3>
                            <p className="mt-1 text-sm text-gray-500">Comece a cadastrar itens no seu cardápio.</p>
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Item</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Categoria</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Preço</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Ações</th>
                                </tr>
                            </thead>
<tbody className="bg-white divide-y divide-slate-200">
  {filteredItems.map(item => (
    <tr key={item.id}>
      {/* Célula do Item (Nome e Imagem) */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            <img className="h-10 w-10 rounded-full object-cover" src={item.imageUrl || 'https://via.placeholder.com/40'} alt={item.nome} />
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-slate-900">{item.nome}</div>
          </div>
        </div>
      </td>
      
      {/* Célula da Categoria */}
      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{item.categoria}</td>
      
      {/* Célula do Preço */}
      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 font-semibold">R$ {item.preco?.toFixed(2).replace('.', ',')}</td>
      
      {/* Célula do Status */}
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {item.ativo ? 'Ativo' : 'Inativo'}
        </span>
      </td>

      {/* ▼▼▼ ESTA É A CÉLULA COM AS OPÇÕES QUE ESTÁ FALTANDO ▼▼▼ */}
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
          <button onClick={() => toggleItemStatus(item)} className={item.ativo ? 'text-yellow-600 hover:text-yellow-900' : 'text-green-600 hover:text-green-900'}>{item.ativo ? 'Desativar' : 'Ativar'}</button>
          <button onClick={() => openItemForm(item)} className="text-indigo-600 hover:text-indigo-900">Editar</button>
          <button onClick={() => handleDeleteItem(item.id, item.nome)} className="text-red-600 hover:text-red-900">Excluir</button>
      </td>
    </tr>
  ))}
</tbody>
                        </table>
                    )}
                </div>

                {/* Modal de Adicionar/Editar Item */}
                {showItemForm && (
                    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full">
                            <h2 className="text-xl font-bold text-slate-800 mb-6">{editingItem ? 'Editar Item' : 'Cadastrar Novo Item'}</h2>
                            <form onSubmit={handleSaveItem} className="space-y-4">
                                <input name="nome" value={formData.nome} onChange={handleFormChange} placeholder="Nome do Item *" className="w-full border-slate-300 rounded-lg"/>
                                <textarea name="descricao" value={formData.descricao} onChange={handleFormChange} placeholder="Descrição do Item" className="w-full border-slate-300 rounded-lg" rows="3"></textarea>
                                <div className="grid grid-cols-2 gap-4">
                                    <input name="preco" type="number" step="0.01" value={formData.preco} onChange={handleFormChange} placeholder="Preço *" className="w-full border-slate-300 rounded-lg"/>
                                    <input name="categoria" value={formData.categoria} onChange={handleFormChange} placeholder="Categoria *" className="w-full border-slate-300 rounded-lg"/>
                                </div>
                                <input name="imageUrl" value={formData.imageUrl} onChange={handleFormChange} placeholder="URL da Imagem (Opcional)" className="w-full border-slate-300 rounded-lg"/>
                                <div className="flex items-center">
                                    <input type="checkbox" name="ativo" checked={formData.ativo} onChange={handleFormChange} id="itemAtivo" className="h-4 w-4 text-indigo-600 border-slate-300 rounded"/>
                                    <label htmlFor="itemAtivo" className="ml-2 text-sm text-slate-600">Item Ativo</label>
                                </div>
                                <div className="flex justify-end gap-4 pt-4">
                                    <button type="button" onClick={closeItemForm} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg font-semibold hover:bg-slate-300">Cancelar</button>
                                    <button type="submit" disabled={formLoading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700">
                                        {formLoading ? 'Salvando...' : (editingItem ? 'Salvar Alterações' : 'Adicionar Item')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AdminMenuManagement;