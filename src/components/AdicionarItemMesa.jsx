import React, { useState } from 'react';
import { IoClose, IoAdd, IoRemove, IoCart } from 'react-icons/io5';

const AdicionarItemMesa = ({ mesa, produtos, onAdicionarItem, onCancelar }) => {
    const [produtoSelecionado, setProdutoSelecionado] = useState(null);
    const [quantidade, setQuantidade] = useState(1);
    const [observacoes, setObservacoes] = useState('');
    const [categoriaAtiva, setCategoriaAtiva] = useState('');

    // Agrupar produtos por categoria
    const produtosPorCategoria = produtos.reduce((acc, produto) => {
        const categoria = produto.categoria || 'Geral';
        if (!acc[categoria]) {
            acc[categoria] = [];
        }
        acc[categoria].push(produto);
        return acc;
    }, {});

    const categorias = Object.keys(produtosPorCategoria);

    const handleAdicionar = () => {
        if (!produtoSelecionado) {
            alert('Selecione um produto');
            return;
        }

        onAdicionarItem(produtoSelecionado, observacoes, [], quantidade);
        
        // Reset form
        setProdutoSelecionado(null);
        setQuantidade(1);
        setObservacoes('');
    };

    const aumentarQuantidade = () => {
        setQuantidade(prev => prev + 1);
    };

    const diminuirQuantidade = () => {
        setQuantidade(prev => prev > 1 ? prev - 1 : 1);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
                {/* CABEÇALHO */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold">Adicionar Item à Mesa</h2>
                        <p className="text-gray-600">Mesa {mesa.numero} - {mesa.pessoas} {mesa.pessoas === 1 ? 'pessoa' : 'pessoas'}</p>
                    </div>
                    <button
                        onClick={onCancelar}
                        className="text-gray-500 hover:text-gray-700 p-2"
                    >
                        <IoClose className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex flex-1 gap-6">
                    {/* LISTA DE PRODUTOS */}
                    <div className="flex-1 border rounded-lg overflow-hidden">
                        {/* CATEGORIAS */}
                        {categorias.length > 1 && (
                            <div className="flex border-b bg-gray-50">
                                {categorias.map(categoria => (
                                    <button
                                        key={categoria}
                                        onClick={() => setCategoriaAtiva(categoria)}
                                        className={`flex-1 px-4 py-3 text-sm font-medium ${
                                            categoriaAtiva === categoria 
                                                ? 'bg-white border-b-2 border-blue-500 text-blue-600' 
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        {categoria}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* PRODUTOS */}
                        <div className="max-h-96 overflow-y-auto">
                            {Object.entries(produtosPorCategoria).map(([categoria, produtosCategoria]) => (
                                <div key={categoria}>
                                    {(categorias.length <= 1 || categoriaAtiva === categoria) && (
                                        <>
                                            {categorias.length > 1 && (
                                                <div className="px-4 py-2 bg-gray-100 border-b">
                                                    <h3 className="font-semibold text-gray-700">{categoria}</h3>
                                                </div>
                                            )}
                                            <div className="divide-y">
                                                {produtosCategoria.map(produto => (
                                                    <button
                                                        key={produto.id}
                                                        onClick={() => setProdutoSelecionado(produto)}
                                                        className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                                                            produtoSelecionado?.id === produto.id 
                                                                ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                                                                : ''
                                                        }`}
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <h4 className="font-medium text-gray-900">{produto.nome}</h4>
                                                                {produto.descricao && (
                                                                    <p className="text-sm text-gray-600 mt-1">{produto.descricao}</p>
                                                                )}
                                                            </div>
                                                            <span className="font-semibold text-gray-700 whitespace-nowrap ml-2">
                                                                R$ {produto.preco?.toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* DETALHES DO PRODUTO SELECIONADO */}
                    <div className="w-80 border rounded-lg p-4">
                        {produtoSelecionado ? (
                            <div className="space-y-4">
                                <div>
                                    <h3 className="font-bold text-lg">{produtoSelecionado.nome}</h3>
                                    <p className="text-gray-600">{produtoSelecionado.descricao}</p>
                                    <div className="text-xl font-bold text-green-600 mt-2">
                                        R$ {produtoSelecionado.preco?.toFixed(2)}
                                    </div>
                                </div>

                                {/* QUANTIDADE */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Quantidade
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={diminuirQuantidade}
                                            className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                                        >
                                            <IoRemove className="w-4 h-4" />
                                        </button>
                                        <span className="text-lg font-semibold w-8 text-center">
                                            {quantidade}
                                        </span>
                                        <button
                                            onClick={aumentarQuantidade}
                                            className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                                        >
                                            <IoAdd className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* OBSERVAÇÕES */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Observações
                                    </label>
                                    <textarea
                                        value={observacoes}
                                        onChange={(e) => setObservacoes(e.target.value)}
                                        placeholder="Ex: Sem cebola, bem passado, etc."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md resize-none"
                                        rows="3"
                                    />
                                </div>

                                {/* TOTAL */}
                                <div className="border-t pt-4">
                                    <div className="flex justify-between items-center text-lg font-semibold">
                                        <span>Total:</span>
                                        <span className="text-green-600">
                                            R$ {(produtoSelecionado.preco * quantidade).toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                {/* BOTÃO ADICIONAR */}
                                <button
                                    onClick={handleAdicionar}
                                    className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
                                >
                                    <IoCart className="w-5 h-5" />
                                    Adicionar à Mesa
                                </button>
                            </div>
                        ) : (
                            <div className="text-center text-gray-500 py-12">
                                <IoCart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                <p>Selecione um produto</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdicionarItemMesa;