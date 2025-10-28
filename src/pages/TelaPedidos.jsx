// src/pages/TelaPedidos.jsx - VERSÃO FINAL

import React, { useState, useEffect } from 'react';
// ================== ALTERAÇÃO 1: Importar useNavigate ==================
import { useParams, Link, useNavigate } from 'react-router-dom'; 
import { db } from '../firebase';
import { getDocs, doc, getDoc, updateDoc, query, where, collectionGroup } from 'firebase/firestore'; 
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
// ================== Adicionamos o ícone de Alerta ==================
import { IoArrowBack, IoCartOutline, IoTrashOutline, IoWarning } from 'react-icons/io5';

// --- COMPONENTE DO PRODUTO (Sem alterações) ---
const ProdutoCard = ({ produto, onAdicionar }) => (
    <div className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
        {produto.imageUrl ? (
            <img src={produto.imageUrl} alt={produto.nome} className="w-full h-32 object-cover" />
        ) : (
            <div className="w-full h-32 bg-gray-200 flex items-center justify-center">
                <span className="text-xs text-gray-500">Sem imagem</span>
            </div>
        )}
        <div className="p-4 flex flex-col flex-grow">
            <h3 className="text-gray-800 font-semibold text-md flex-grow">{produto.nome}</h3>
            <p className="text-gray-600 mt-1">R$ {parseFloat(produto.preco).toFixed(2).replace('.', ',')}</p>
            <button onClick={() => onAdicionar(produto)} className="mt-4 w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                Adicionar
            </button>
        </div>
    </div>
);

// --- COMPONENTE PRINCIPAL DA PÁGINA ---
const TelaPedidos = () => {
    const { id: mesaId } = useParams();
    const { estabelecimentoId } = useAuth();
    // ================== ALTERAÇÃO 2: Instanciar o navigate ==================
    const navigate = useNavigate(); 
    
    const [mesa, setMesa] = useState(null); // Armazena o estado original da mesa
    const [cardapio, setCardapio] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [resumoPedido, setResumoPedido] = useState([]); // Armazena o estado atual do pedido
    const [loading, setLoading] = useState(true);
    const [termoBusca, setTermoBusca] = useState('');

    useEffect(() => {
        if (!estabelecimentoId) return;

        const fetchData = async () => {
            try {
                setLoading(true);

                const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
                const mesaSnap = await getDoc(mesaRef);
                if (mesaSnap.exists()) {
                    const mesaData = mesaSnap.data();
                    setMesa(mesaData); // Salva o estado original
                    setResumoPedido(mesaData.itens || []); // Define o estado inicial do resumo
                }

                const itensRef = collectionGroup(db, 'itens');
                const q = query(itensRef, where('estabelecimentoId', '==', estabelecimentoId));
                
                const cardapioSnap = await getDocs(q);
                const produtosList = cardapioSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setCardapio(produtosList);

                const categoriasUnicas = [...new Set(produtosList.map(p => p.categoria).filter(Boolean))];
                setCategorias(categoriasUnicas);

            } catch (error) {
                console.error("ERRO CRÍTICO AO BUSCAR DADOS:", error);
                toast.error("Ocorreu um erro ao carregar o cardápio. Verifique o console.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [estabelecimentoId, mesaId]);

    const adicionarItem = (produto) => {
        setResumoPedido(prev => {
            const itemExistente = prev.find(item => item.id === produto.id);
            if (itemExistente) {
                return prev.map(item => item.id === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item);
            }
            return [...prev, { ...produto, quantidade: 1 }];
        });
        toast.success(`${produto.nome} adicionado!`);
    };
    
    const removerItem = (produtoId) => {
        setResumoPedido(prev => prev.filter(item => item.id !== produtoId));
        toast.warn("Item removido.");
    };

    const salvarAlteracoes = async () => {
        try {
            const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
            await updateDoc(mesaRef, { itens: resumoPedido });
            
            // ATUALIZA O ESTADO LOCAL DA MESA para refletir o novo salvo
            setMesa(prev => ({...prev, itens: resumoPedido }));

            toast.success("Pedido da mesa atualizado com sucesso!");
        } catch (error) {
            console.error("Erro ao salvar alterações:", error);
            toast.error("Falha ao salvar o pedido.");
        }
    };

    // ================== ALTERAÇÃO 3: Lógica do botão Voltar (Alerta) ==================
    const handleVoltar = () => {
        // Compara o estado salvo (mesa.itens) com o estado atual (resumoPedido)
        // Usamos JSON.stringify para uma comparação simples e eficaz dos arrays de objetos
        const itemsSalvos = JSON.stringify(mesa?.itens || []);
        const itemsAtuais = JSON.stringify(resumoPedido);

        if (itemsSalvos !== itemsAtuais) {
            // Se forem diferentes, mostra um alerta
            if (window.confirm("Você tem alterações não salvas. Deseja realmente sair sem salvar?")) {
                navigate('/controle-salao'); // Sai se o usuário confirmar
            }
            // Se o usuário clicar em "Cancelar", ele permanece na página
        } else {
            // Se não houver alterações, apenas volta
            navigate('/controle-salao');
        }
    };
    // ================== FIM DA ALTERAÇÃO 3 ==================
    
    const produtosFiltrados = cardapio.filter(p => p.nome.toLowerCase().includes(termoBusca.toLowerCase()));
    const totalPedido = resumoPedido.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
    
    if (loading) return <div className="text-center p-8">Carregando cardápio...</div>;

    return (
        <div className="bg-gray-100 min-h-screen">           
            <main className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">

                    {/* ================== ALTERAÇÃO 4: Mudar o <Link> para <button> ================== */}
                    {/* Usamos um botão amarelo (alerta) e chamamos a função handleVoltar */}
                    <button 
                        onClick={handleVoltar}
                        className="inline-flex items-center mb-4 bg-yellow-400 text-black font-bold py-2 px-4 rounded-lg transition-colors hover:bg-yellow-500 shadow"
                    >
                        <IoArrowBack className="mr-2"/> 
                        Voltar para o Salão
                    </button>
                    {/* ================== FIM DA ALTERAÇÃO 4 ================== */}

                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Lançar Pedidos - {mesa?.nome || 'Mesa'}</h2>
                    <input type="text" placeholder="Pesquisar item pelo nome..." value={termoBusca} onChange={e => setTermoBusca(e.target.value)} className="w-full p-3 mb-6 border border-gray-300 rounded-lg shadow-sm" />

                    {categorias.length > 0 ? categorias.map(categoria => (
                        <div key={categoria} className="mb-8">
                            <h3 className="text-xl font-bold text-gray-700 border-b-2 border-blue-500 pb-2 mb-4">{categoria}</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                {produtosFiltrados.filter(p => p.categoria === categoria).map(produto => (
                                    <ProdutoCard key={produto.id} produto={produto} onAdicionar={adicionarItem} />
                                ))}
                            </div>
                        </div>
                    )) : <p className="text-gray-500">Nenhum produto encontrado para este estabelecimento.</p>}
                </div>

                <aside className="bg-white p-6 rounded-lg shadow-lg h-fit sticky top-24">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center mb-4"><IoCartOutline className="mr-2"/> Resumo do Pedido</h3>
                    {resumoPedido.length === 0 ? (
                        <p className="text-gray-500">Nenhum item adicionado.</p>
                    ) : (
                        <ul className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                            {resumoPedido.map(item => (
                                <li key={item.id} className="flex justify-between items-center text-sm">
                                    <span>{item.quantidade}x {item.nome}</span>
                                    <div className="flex items-center">
                                        <span className="font-semibold mr-3">R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}</span>
                                        <button onClick={() => removerItem(item.id)} className="text-red-500 hover:text-red-700"><IoTrashOutline /></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="border-t pt-4 mt-4">
                        <div className="flex justify-between font-bold text-lg">
                            <span>Total:</span>
                            <span>R$ {totalPedido.toFixed(2).replace('.', ',')}</span>
                        </div>
                        <button onClick={salvarAlteracoes} className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition-colors">
                            Salvar Alterações
                        </button>
                    </div>
                </aside>
            </main>
        </div>
    );
};

export default TelaPedidos;