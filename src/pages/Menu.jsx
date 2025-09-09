// src/pages/Menu.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, orderBy, onSnapshot } from 'firebase/firestore';
import CardapioItem from '../components/CardapioItem';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import AdicionaisModal from '../components/AdicionaisModal';
import { v4 as uuidv4 } from 'uuid';

function Menu() {
    const { estabelecimentoSlug } = useParams();
    const navigate = useNavigate();
    const { currentUser, currentClientData, loading: authLoading } = useAuth();

    // Seus estados existentes
    const [carrinho, setCarrinho] = useState([]);
    const [nomeCliente, setNomeCliente] = useState('');
    const [telefoneCliente, setTelefoneCliente] = useState('');
    const [rua, setRua] = useState('');
    const [numero, setNumero] = useState('');
    const [bairro, setBairro] = useState('');
    const [cidade, setCidade] = useState('');
    const [complemento, setComplemento] = useState('');
    const [formaPagamento, setFormaPagamento] = useState('');
    const [trocoPara, setTrocoPara] = useState('');
    const [taxasBairro, setTaxasBairro] = useState([]);
    const [taxaEntregaCalculada, setTaxaEntregaCalculada] = useState(0);
    const [bairroNaoEncontrado, setBairroNaoEncontrado] = useState(false);
    const [isRetirada, setIsRetirada] = useState(false);
    const [produtos, setProdutos] = useState([]);
    const [nomeEstabelecimento, setNomeEstabelecimento] = useState("Carregando Cardápio...");
    const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
    const [actualEstabelecimentoId, setActualEstabelecimentoId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [availableCategories, setAvailableCategories] = useState([]);
    const [itemParaAdicionais, setItemParaAdicionais] = useState(null);
    const [visibleItemsCount, setVisibleItemsCount] = useState({});
    
    // ===== VARIÁVEL DE LOADING CORRIGIDA =====
    const [menuLoading, setMenuLoading] = useState(true);

    // Efeito para debounce da busca
    useEffect(() => {
        const handler = setTimeout(() => { setDebouncedSearchTerm(searchTerm); }, 300);
        return () => { clearTimeout(handler); };
    }, [searchTerm]);

    // Preenche dados do cliente logado
     useEffect(() => {
        if (!authLoading && currentUser && currentClientData) {
            setNomeCliente(currentClientData.nome || '');
            setTelefoneCliente(currentClientData.telefone || '');
            if (currentClientData.endereco) {
                setRua(currentClientData.endereco.rua || '');
                setNumero(currentClientData.endereco.numero || '');
                setBairro(currentClientData.endereco.bairro || '');
                setCidade(currentClientData.endereco.cidade || '');
                setComplemento(currentClientData.endereco.complemento || '');
                setIsRetirada(false);
            } else {
                setIsRetirada(true);
            }
        }
    }, [currentUser, currentClientData, authLoading]);

    // Efeito para carregar taxas de entrega
    useEffect(() => {
        const taxasRef = collection(db, 'taxasDeEntrega');
        const q = query(taxasRef, orderBy('nomeBairro'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setTaxasBairro(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
        });
        return () => unsubscribe();
    }, []);

    // Efeito para calcular taxa de entrega
    useEffect(() => {
        if (isRetirada || !bairro.trim() || !cidade.trim()) {
            setTaxaEntregaCalculada(0);
            setBairroNaoEncontrado(false);
            return;
        }
        const bairroEncontrado = taxasBairro.find((taxa) => taxa.nomeBairro.toLowerCase() === bairro.trim().toLowerCase());
        if (bairroEncontrado) {
            setTaxaEntregaCalculada(bairroEncontrado.valorTaxa);
            setBairroNaoEncontrado(false);
        } else {
            setTaxaEntregaCalculada(0);
            setBairroNaoEncontrado(true);
        }
    }, [bairro, cidade, taxasBairro, isRetirada]);

    // Lógica de busca do cardápio
    useEffect(() => {
        if (!estabelecimentoSlug) return;

        const fetchEstabelecimentoAndCardapio = async () => {
            setMenuLoading(true); // Inicia o carregamento
            try {
                const qEstab = query(collection(db, 'estabelecimentos'), where('slug', '==', estabelecimentoSlug));
                const estabSnapshot = await getDocs(qEstab);

                if (estabSnapshot.empty) {
                    toast.error("Estabelecimento não encontrado.");
                    setNomeEstabelecimento("Estabelecimento não encontrado.");
                    return;
                }

                const estabDoc = estabSnapshot.docs[0];
                const estabData = estabDoc.data();
                const estabId = estabDoc.id;

                if (!estabData.ativo) {
                    toast.error("Este estabelecimento está temporariamente inativo.");
                    setNomeEstabelecimento(`${estabData.nome} (Inativo)`);
                    setProdutos([]);
                    return;
                }

                setEstabelecimentoInfo(estabData);
                setNomeEstabelecimento(estabData.nome || "Cardápio");
                setActualEstabelecimentoId(estabId);

                const categoriasRef = collection(db, 'estabelecimentos', estabId, 'cardapio');
                const qCategorias = query(categoriasRef, orderBy('ordem', 'asc'));
                const categoriasSnapshot = await getDocs(qCategorias);

                if (categoriasSnapshot.empty) {
                    setProdutos([]);
                    setAvailableCategories(['Todos']);
                    return;
                }
                
                const allItemsPromises = [];
                const categoriesList = ['Todos'];
                const initialVisibleCounts = {};

                for (const catDoc of categoriasSnapshot.docs) {
                    const categoriaData = catDoc.data();
                    categoriesList.push(categoriaData.nome);
                    initialVisibleCounts[categoriaData.nome] = 3;

                    const itensRef = collection(db, 'estabelecimentos', estabId, 'cardapio', catDoc.id, 'itens');
                    const qItens = query(itensRef, where('disponivel', '==', true));
                    
                    const itemsPromise = getDocs(qItens).then(itensSnapshot => 
                        itensSnapshot.docs.map(itemDoc => ({
                            ...itemDoc.data(),
                            id: itemDoc.id,
                            categoria: categoriaData.nome
                        }))
                    );
                    allItemsPromises.push(itemsPromise);
                }
                
                const allItemsArrays = await Promise.all(allItemsPromises);
                const allItems = allItemsArrays.flat();

                setAvailableCategories(categoriesList);
                setVisibleItemsCount(initialVisibleCounts);
                setProdutos(allItems);

            } catch (error) {
                console.error("Erro ao carregar cardápio:", error);
                toast.error("Não foi possível carregar o cardápio.");
            } finally {
                setMenuLoading(false); // Finaliza o carregamento
            }
        };

        fetchEstabelecimentoAndCardapio();
    }, [estabelecimentoSlug]);

    const filteredAndSearchedProdutos = useMemo(() => {
        let items = produtos;
        if (selectedCategory !== 'Todos') {
            items = items.filter(item => item.categoria === selectedCategory);
        }
        if (debouncedSearchTerm) {
            items = items.filter(item => 
                item.nome.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                (item.descricao && item.descricao.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
            );
        }
        return items;
    }, [produtos, selectedCategory, debouncedSearchTerm]);
    
    // Funções do modal e carrinho
    const handleAbrirModalAdicionais = (item) => {
        setItemParaAdicionais(item);
    };
    const handleFecharModal = () => setItemParaAdicionais(null);

    const handleConfirmarAdicionais = (itemConfigurado) => {
        setCarrinho(prev => [...prev, { ...itemConfigurado, qtd: 1, cartItemId: uuidv4() }]);
        toast.success(`${itemConfigurado.nome} foi adicionado ao carrinho!`);
        handleFecharModal();
    };

    // Demais funções... (continua igual)
    const handleShowMore = (categoryName) => setVisibleItemsCount(prev => ({ ...prev, [categoryName]: (prev[categoryName] || 3) + 3 }));
    const handleShowLess = (categoryName) => setVisibleItemsCount(prev => ({ ...prev, [categoryName]: 3 }));

    if (authLoading) return <div className="flex justify-center items-center h-screen">Carregando...</div>;

    // Lógica de renderização
    return (
        <div className="p-4 max-w-3xl mx-auto pb-48 md:pb-0">
            <h1 className="text-3xl font-bold text-center text-black mb-4">
                Cardápio de {nomeEstabelecimento}
            </h1>
            
            <div className="mb-8 p-4 bg-white rounded-lg shadow-md border border-gray-200">
                <div className="mb-4">
                    <input type="text" placeholder="Buscar no Cardápio..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg"/>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                    {availableCategories.map((category) => (
                        <button key={category} onClick={() => setSelectedCategory(category)} className={`px-4 py-2 rounded-full text-sm font-semibold ${selectedCategory === category ? 'bg-black text-white' : 'bg-gray-200'}`}>
                            {category}
                        </button>
                    ))}
                </div>
            </div>

            {(() => {
                const menuAgrupado = filteredAndSearchedProdutos.reduce((acc, produto) => {
                    const categoria = produto.categoria || 'Outros';
                    if (!acc[categoria]) acc[categoria] = [];
                    acc[categoria].push(produto);
                    return acc;
                }, {});

                const categoriasOrdenadas = availableCategories.filter(cat => cat !== 'Todos' && menuAgrupado[cat]);

                // ===== RENDERIZANDO MENSAGEM DE CARREGAMENTO USANDO a variável CORRETA =====
                if (menuLoading) return <p className="text-center text-gray-500 italic mt-8">Carregando itens do cardápio...</p>;

                if (filteredAndSearchedProdutos.length === 0) {
                    return <p className="text-center text-gray-500 italic mt-8">Nenhum item encontrado.</p>;
                }

                return categoriasOrdenadas.map(categoria => {
                    const itemsNestaCategoria = menuAgrupado[categoria];
                    const totalItemsVisiveis = visibleItemsCount[categoria] || 3;
                    const todosItensVisiveis = totalItemsVisiveis >= itemsNestaCategoria.length;

                    return (
                        <div key={categoria} className="mt-8">
                            <h2 className="text-2xl font-bold mb-4 text-black border-b-2 border-yellow-500 pb-2">{categoria}</h2>
                            <div className="grid md:grid-cols-2 gap-6">
                                {itemsNestaCategoria.slice(0, totalItemsVisiveis).map((item) => (
                                    <CardapioItem key={item.id} item={item} onAddItem={handleAbrirModalAdicionais} />
                                ))}
                            </div>
                            {itemsNestaCategoria.length > 3 && (
                                <div className="text-center mt-6">
                                    {todosItensVisiveis ? (
                                        <button onClick={() => handleShowLess(categoria)} className="bg-gray-200 text-sm font-semibold py-2 px-4 rounded">Ver menos</button>
                                    ) : (
                                        <button onClick={() => handleShowMore(categoria)} className="bg-yellow-500 text-sm font-semibold py-2 px-4 rounded">Ver mais</button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                });
            })()}

            {itemParaAdicionais && (
                <AdicionaisModal item={itemParaAdicionais} onConfirm={handleConfirmarAdicionais} onClose={handleFecharModal} />
            )}

            {/* O restante do seu JSX para carrinho, formulário, etc. continua igual */}
        </div>
    );
}

export default Menu;