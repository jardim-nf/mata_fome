import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { FaShoppingCart, FaArrowLeft, FaCheck } from 'react-icons/fa';
import { IoMdPerson, IoMdRestaurant } from 'react-icons/io';
import { IoFastFoodOutline } from 'react-icons/io5';

import { useEstablishment } from '../hooks/useEstablishment';
import { vendaService } from '../services/vendaService';
import VariacoesModal from '../components/VariacoesModal';

function normalizarTexto(texto) {
    if (!texto) return '';
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export default function TotemScreen() {
    const { estabelecimentoSlug } = useParams();
    const navigate = useNavigate();

    const { loading, allProdutos, estabelecimentoInfo, actualEstabelecimentoId, coresEstabelecimento } = useEstablishment(estabelecimentoSlug);

    const [started, setStarted] = useState(false);
    const [carrinho, setCarrinho] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [itemParaVariacoes, setItemParaVariacoes] = useState(null);
    const [telaPagamento, setTelaPagamento] = useState(false);
    const [nomeCliente, setNomeCliente] = useState('');
    const [senhaPedido, setSenhaPedido] = useState('');

    const subtotalCalculado = carrinho.reduce((total, item) => total + (item.precoFinal * (item.quantidade || 1)), 0);

    const menuAgrupado = useMemo(() => {
        return allProdutos.reduce((acc, p) => {
            const cat = p.categoria || 'Outros';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(p);
            return acc;
        }, {});
    }, [allProdutos]);

    const categoriasOrdenadas = ['Todos', ...Object.keys(menuAgrupado).sort()];

    const enrichWithAdicionais = (item) => {
        const catNorm = normalizarTexto(item.categoria || '');
        const catsHamburguer = ['hamburguer', 'lanche', 'artesanal', 'burger'];
        if (!catsHamburguer.some(cat => catNorm.includes(cat))) return item;
        const globais = allProdutos.filter(p => ['adicional', 'extra'].some(t => normalizarTexto(p.categoria || '').includes(t)));
        return { ...item, adicionais: [...(item.adicionais || []), ...globais] };
    };

    const handleClicarProduto = (item) => {
        const itemEnriquecido = enrichWithAdicionais(item);
        if (itemEnriquecido.variacoes?.length > 0 || itemEnriquecido.adicionais?.length > 0) {
            setItemParaVariacoes(itemEnriquecido);
        } else {
            handleAdicionarItem({ ...itemEnriquecido, precoFinal: item.preco, quantidade: 1 });
        }
    };

    const handleAdicionarItem = (itemConfigurado) => {
        const novoItem = { ...itemConfigurado, cartId: Math.random().toString(36).substr(2, 9) };
        setCarrinho([...carrinho, novoItem]);
        setItemParaVariacoes(null);
        toast.success(`${itemConfigurado.nome} adicionado!`);
    };

    const handleRemoverItem = (cartId) => {
        setCarrinho(carrinho.filter(i => i.cartId !== cartId));
    };

    const finalizarPedido = async (metodoPagamento) => {
        if (!nomeCliente.trim()) {
            toast.warn('Digite seu nome para ser chamado!');
            return;
        }

        const novaSenha = Math.floor(100 + Math.random() * 900).toString();
        
        const payload = {
            estabelecimentoId: actualEstabelecimentoId,
            itens: carrinho,
            total: subtotalCalculado,
            status: 'pendente',
            origem: 'totem',
            nomeCliente: nomeCliente,
            tipoPagamentoPdv: metodoPagamento,
            statusPago: false,
            senhaTotem: novaSenha
        };

        const result = await vendaService.salvarVenda(payload);
        
        if (result.success) {
            setSenhaPedido(novaSenha);
        } else {
            toast.error('Erro ao salvar pedido.');
        }
    };

    const resetTotem = () => {
        setStarted(false);
        setCarrinho([]);
        setTelaPagamento(false);
        setSenhaPedido('');
        setNomeCliente('');
    };

    // Splash Screen
    if (!started && !senhaPedido) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-black cursor-pointer overflow-hidden relative" onClick={() => setStarted(true)}>
                <img src={estabelecimentoInfo?.logoUrl || '/logo.png'} alt="Logo" className="w-64 h-64 object-contain mb-8 z-10 animate-pulse" />
                <h1 className="text-6xl font-black text-white z-10 mb-4 animate-bounce">TOCAR PARA INICIAR</h1>
                <p className="text-2xl text-gray-300 z-10">Faça seu pedido aqui rapidinho!</p>
                <div className="absolute inset-0 bg-yellow-500 opacity-20"></div>
            </div>
        );
    }

    // Tela de Senha Final (Sucesso)
    if (senhaPedido) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-green-500 text-white relative">
                <FaCheck className="text-9xl mb-8" />
                <h1 className="text-5xl font-black mb-4">{nomeCliente}, seu pedido foi enviado!</h1>
                <p className="text-3xl mb-8">Dirija-se ao caixa para pagar ou aguarde ser chamado.</p>
                <div className="bg-white text-green-600 rounded-3xl p-12 shadow-2xl">
                    <p className="text-2xl font-bold uppercase mb-2">Sua Senha</p>
                    <p className="text-9xl font-black">{senhaPedido}</p>
                </div>
                <button onClick={resetTotem} className="mt-16 px-12 py-4 bg-white text-green-600 font-bold text-2xl rounded-full shadow-lg">Completar e Sair</button>
            </div>
        );
    }

    // Tela de Pagamento/Identificação
    if (telaPagamento) {
        return (
            <div className="h-screen w-screen flex flex-col bg-gray-50 items-center justify-center p-8">
                <button onClick={() => setTelaPagamento(false)} className="absolute top-8 left-8 flex items-center gap-2 text-2xl font-bold text-gray-600 bg-white px-6 py-4 rounded-full shadow-md"><FaArrowLeft /> Voltar</button>
                
                <h1 className="text-5xl font-black text-gray-800 mb-12">Como devemos te chamar?</h1>
                <input 
                    type="text" 
                    placeholder="Ex: João da Silva" 
                    value={nomeCliente}
                    onChange={(e) => setNomeCliente(e.target.value)}
                    className="w-[600px] text-center text-4xl p-6 rounded-2xl border-4 border-gray-200 focus:border-yellow-500 focus:outline-none mb-12 shadow-inner"
                />

                <div className="bg-white rounded-3xl p-8 shadow-xl w-[600px] text-center">
                    <h2 className="text-3xl font-bold mb-4">Total: R$ {subtotalCalculado.toLocaleString('pt-BR', {minimumFractionDigits:2})}</h2>
                    
                    <div className="grid grid-cols-2 gap-4 mt-8">
                        <button onClick={() => finalizarPedido('dinheiro')} className="flex flex-col items-center justify-center gap-4 bg-gray-100 hover:bg-gray-200 p-8 rounded-2xl transition">
                            <IoMdRestaurant className="text-5xl text-gray-700" />
                            <span className="text-2xl font-bold">Pagar no Caixa</span>
                        </button>
                        <button onClick={() => finalizarPedido('pix')} className="flex flex-col items-center justify-center gap-4 bg-teal-50 hover:bg-teal-100 border-2 border-teal-500 p-8 rounded-2xl transition">
                            <img src="https://logopng.com.br/logos/pix-106.png" className="h-12 object-contain" />
                            <span className="text-2xl font-bold text-teal-800">PIX (Balcão)</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen flex bg-gray-100 overflow-hidden font-sans">
            
            {/* Sidebar Categorias */}
            <div className="w-[300px] bg-white shadow-xl h-full flex flex-col z-20">
                <div className="p-8 bg-yellow-400 text-center rounded-br-[50px] mb-4">
                    <img src={estabelecimentoInfo?.logoUrl || '/logo.png'} alt="Logo" className="w-32 h-32 mx-auto object-contain bg-white rounded-full p-2 shadow-lg mb-4" />
                    <h2 className="text-2xl font-black text-white drop-shadow-md">Cardápio</h2>
                </div>
                <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-8 custom-scrollbar">
                    {categoriasOrdenadas.map(cat => (
                        <button 
                            key={cat} 
                            onClick={() => setSelectedCategory(cat)}
                            className={`w-full text-left px-6 py-5 rounded-2xl text-xl font-bold transition-all ${selectedCategory === cat ? 'bg-yellow-400 text-white shadow-md transform scale-105' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
                <button onClick={resetTotem} className="p-6 text-xl font-bold text-red-500 bg-red-50 m-4 rounded-2xl text-center">Cancelar Pedido</button>
            </div>

            {/* Grid de Produtos */}
            <div className="flex-1 h-full overflow-y-auto p-8 relative">
                {loading ? (
                    <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-16 w-16 border-b-4 border-yellow-500" /></div>
                ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 pb-40">
                        {allProdutos.filter(p => p.ativo !== false && (selectedCategory === 'Todos' || p.categoria === selectedCategory)).map(prod => (
                            <div key={prod.id} onClick={() => handleClicarProduto(prod)} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer transform transition-transform active:scale-95 flex flex-col h-[380px]">
                                <div className="h-[220px] bg-gray-100 w-full relative">
                                    {prod.imageUrl ? (
                                        <img src={prod.imageUrl} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300"><IoFastFoodOutline className="text-6xl" /></div>
                                    )}
                                </div>
                                <div className="p-6 flex-1 flex flex-col justify-between">
                                    <h3 className="text-xl font-black text-gray-800 line-clamp-2 leading-tight">{prod.nome}</h3>
                                    <p className="text-2xl font-black text-green-600">R$ {(Number(prod.preco) || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Carrinho Lateral */}
            <div className="w-[450px] bg-white h-full shadow-[-10px_0_30px_rgba(0,0,0,0.05)] flex flex-col z-20">
                <div className="p-8 bg-gray-900 text-white flex items-center gap-4">
                    <FaShoppingCart className="text-3xl" />
                    <h2 className="text-3xl font-black">Meu Pedido</h2>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
                    <AnimatePresence>
                        {carrinho.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <FaShoppingCart className="text-6xl mb-4 opacity-50" />
                                <p className="text-xl font-bold text-center">Toque nos itens para adicionar ao carrinho</p>
                            </div>
                        ) : (
                            carrinho.map(item => (
                                <motion.div 
                                    key={item.cartId} 
                                    initial={{ opacity: 0, x: 50 }} 
                                    animate={{ opacity: 1, x: 0 }} 
                                    exit={{ opacity: 0, x: -50 }}
                                    className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4"
                                >
                                    <div className="flex-1">
                                        <p className="font-bold text-lg text-gray-800">{item.quantidade || 1}x {item.nome}</p>
                                        {(item.variacaoSelecionada || item.adicionaisSelecionados?.length > 0) && (
                                            <p className="text-sm text-gray-500 line-clamp-2">
                                                {item.variacaoSelecionada?.nome} 
                                                {item.adicionaisSelecionados?.map(a => ` + ${a.nome}`).join('')}
                                            </p>
                                        )}
                                        <p className="font-bold text-green-600 text-lg">R$ {(item.precoFinal * (item.quantidade || 1)).toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
                                    </div>
                                    <button onClick={() => handleRemoverItem(item.cartId)} className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center font-bold text-xl active:scale-90">X</button>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>

                <div className="p-8 bg-white border-t border-gray-100">
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-2xl font-bold text-gray-500">Total</span>
                        <span className="text-4xl font-black text-gray-900">R$ {subtotalCalculado.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>
                    </div>
                    <button 
                        disabled={carrinho.length === 0}
                        onClick={() => setTelaPagamento(true)}
                        className={`w-full py-6 rounded-2xl text-2xl font-black transition-all ${carrinho.length > 0 ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-500 shadow-xl' : 'bg-gray-200 text-gray-400'}`}
                    >
                        PAGAR AGORA
                    </button>
                </div>
            </div>

            {itemParaVariacoes && (
                <VariacoesModal 
                    item={itemParaVariacoes} 
                    onConfirm={handleAdicionarItem} 
                    onClose={() => setItemParaVariacoes(null)} 
                    coresEstabelecimento={coresEstabelecimento} 
                    hideStockBlock={true} // Totem geralmente n bloqueia ui de forma complexa
                />
            )}
        </div>
    );
}
