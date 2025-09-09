// src/pages/admin/AdminImageAssociation.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { uploadImageAndUpdateProduct } from '../../utils/firebaseStorageService';

function AdminImageAssociation() {
    const [estabelecimentos, setEstabelecimentos] = useState([]);
    const [selectedEstabelecimentoId, setSelectedEstabelecimentoId] = useState('');
    const [cardapio, setCardapio] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploadingItemId, setUploadingItemId] = useState(null);

    useEffect(() => {
        const fetchEstabelecimentos = async () => {
            const q = query(collection(db, 'estabelecimentos'), orderBy('nome'));
            const querySnapshot = await getDocs(q);
            setEstabelecimentos(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        };
        fetchEstabelecimentos();
    }, []);

    useEffect(() => {
        if (!selectedEstabelecimentoId) {
            setCardapio([]);
            return;
        }

        const fetchCardapio = async () => {
            setLoading(true);
            try {
                const categoriasRef = collection(db, 'estabelecimentos', selectedEstabelecimentoId, 'cardapio');
                const qCategorias = query(categoriasRef, orderBy('ordem', 'asc'));
                const categoriasSnapshot = await getDocs(qCategorias);

                let fullMenu = [];
                for (const catDoc of categoriasSnapshot.docs) {
                    const categoriaData = catDoc.data();
                    const itensRef = collection(db, 'estabelecimentos', selectedEstabelecimentoId, 'cardapio', catDoc.id, 'itens');
                    const itensSnapshot = await getDocs(itensRef);
                    const itens = itensSnapshot.docs.map(itemDoc => ({
                        ...itemDoc.data(),
                        id: itemDoc.id,
                        categoriaId: catDoc.id, // Importante para a atualização
                        categoriaNome: categoriaData.nome
                    }));
                    fullMenu.push({ ...categoriaData, id: catDoc.id, itens });
                }
                setCardapio(fullMenu);
            } catch (error) {
                toast.error("Erro ao carregar o cardápio.");
                console.error(error);
            }
            setLoading(false);
        };

        fetchCardapio();
    }, [selectedEstabelecimentoId]);

    const handleImageUpload = async (itemId, categoriaId, file) => {
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { // Limite de 5MB
            toast.error("A imagem é muito grande. O limite é 5MB.");
            return;
        }
        
        setUploadingItemId(itemId);
        try {
            const newImageUrl = await uploadImageAndUpdateProduct(selectedEstabelecimentoId, categoriaId, itemId, file);
            
            // Atualiza a URL da imagem no estado local para refletir a mudança imediatamente
            setCardapio(prevCardapio => 
                prevCardapio.map(cat => ({
                    ...cat,
                    itens: cat.itens.map(item => 
                        item.id === itemId ? { ...item, imageUrl: newImageUrl } : item
                    )
                }))
            );
            toast.success("Imagem enviada com sucesso!");
        } catch (error) {
            toast.error("Falha ao enviar a imagem.");
        } finally {
            setUploadingItemId(null);
        }
    };

    return (
        <div className="container mx-auto p-6 bg-gray-900 text-white min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-yellow-500">Associar Imagens aos Produtos</h1>

            <div className="mb-6">
                <label htmlFor="estabelecimento" className="block text-lg font-medium mb-2">Selecione o Estabelecimento:</label>
                <select
                    id="estabelecimento"
                    value={selectedEstabelecimentoId}
                    onChange={(e) => setSelectedEstabelecimentoId(e.target.value)}
                    className="w-full p-2 rounded bg-gray-800 border border-gray-700 text-white"
                >
                    <option value="">-- Escolha um estabelecimento --</option>
                    {estabelecimentos.map(est => (
                        <option key={est.id} value={est.id}>{est.nome}</option>
                    ))}
                </select>
            </div>

            {loading && <p>Carregando cardápio...</p>}

            {!loading && selectedEstabelecimentoId && (
                <div className="space-y-8">
                    {cardapio.map(categoria => (
                        <div key={categoria.id}>
                            <h2 className="text-2xl font-semibold mb-4 border-b-2 border-yellow-500 pb-2">{categoria.nome}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {categoria.itens.map(item => (
                                    <div key={item.id} className="bg-gray-800 rounded-lg p-4 flex flex-col justify-between border border-gray-700">
                                        <div>
                                            <img 
                                                src={item.imageUrl || 'https://via.placeholder.com/300x200?text=Sem+Imagem'} 
                                                alt={item.nome} 
                                                className="w-full h-40 object-cover rounded-md mb-4"
                                            />
                                            <h3 className="text-xl font-bold text-yellow-400">{item.nome}</h3>
                                            <p className="text-gray-400 text-sm mb-2">{item.descricao}</p>
                                            <p className="text-lg font-semibold text-green-400">R$ {item.preco.toFixed(2)}</p>
                                        </div>
                                        <div className="mt-4">
                                            <label htmlFor={`file-${item.id}`} className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors w-full text-center block">
                                                {uploadingItemId === item.id ? 'Enviando...' : 'Trocar Imagem'}
                                            </label>
                                            <input 
                                                type="file" 
                                                id={`file-${item.id}`}
                                                className="hidden"
                                                accept="image/png, image/jpeg"
                                                onChange={(e) => handleImageUpload(item.id, item.categoriaId, e.target.files[0])}
                                                disabled={uploadingItemId === item.id}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default AdminImageAssociation;