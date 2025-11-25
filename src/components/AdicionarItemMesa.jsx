import React, { useState, useEffect } from 'react';
import { IoClose, IoAdd, IoRemove, IoCart, IoPerson } from 'react-icons/io5';

const AdicionarItemMesa = ({ mesa, produtos, onAdicionarItem, onCancelar }) => {
    const [produtoSelecionado, setProdutoSelecionado] = useState(null);
    const [quantidade, setQuantidade] = useState(1);
    const [observacoes, setObservacoes] = useState('');
    const [categoriaAtiva, setCategoriaAtiva] = useState('');
    
    // 1. LISTA DE PESSOAS DA MESA
    // Pega os nomes da mesa. Se não tiver, usa "Mesa" como padrão.
    const listaPessoas = mesa.nomesOcupantes && mesa.nomesOcupantes.length > 0 
        ? mesa.nomesOcupantes 
        : (mesa.clientes || ['Mesa']);
        
    // 2. ESTADO PARA QUEM É O PEDIDO (Default: primeiro nome da lista)
    const [clienteSelecionado, setClienteSelecionado] = useState(listaPessoas[0]);

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

    // Seleciona a primeira categoria automaticamente ao abrir
    useEffect(() => {
        if (categorias.length > 0 && !categoriaAtiva) {
            setCategoriaAtiva(categorias[0]);
        }
    }, [categorias, categoriaAtiva]);

    const handleAdicionar = () => {
        if (!produtoSelecionado) {
            alert('Selecione um produto');
            return;
        }

        // 4. ENVIA O NOME DO CLIENTE JUNTO (5º argumento)
        // Certifique-se que a função pai (DetalhesMesa) espera receber esse argumento extra!
        onAdicionarItem(
            produtoSelecionado, 
            observacoes, 
            [], // Adicionais (vazio por enquanto)
            quantidade, 
            clienteSelecionado // <--- AQUI VAI O NOME (JOAO, MARIA...)
        );
        
        // Reset form
        setProdutoSelecionado(null);
        setQuantidade(1);
        setObservacoes('');
        // Mantém o cliente selecionado para facilitar pedidos em sequência
    };

    const aumentarQuantidade = () => setQuantidade(prev => prev + 1);
    const diminuirQuantidade = () => setQuantidade(prev => prev > 1 ? prev - 1 : 1);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 max-w-5xl w-full mx-4 max-h-[90vh] flex flex-col shadow-2xl">
                {/* CABEÇALHO */}
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Adicionar Pedido</h2>
                        <p className="text-gray-500 flex items-center gap-2">
                            Mesa {mesa.numero} • {listaPessoas.length} pessoas
                        </p>
                    </div>
                    <button onClick={onCancelar} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-all">
                        <IoClose className="w-8 h-8" />
                    </button>
                </div>

                <div className="flex flex-col lg:flex-row flex-1 gap-6 overflow-hidden">
                    {/* COLUNA ESQUERDA: LISTA DE PRODUTOS */}
                    <div className="flex-1 border border-gray-200 rounded-xl overflow-hidden flex flex-col bg-gray-50">
                        {/* CATEGORIAS (Scroll horizontal) */}
                        {categorias.length > 1 && (
                            <div className="flex overflow-x-auto border-b bg-white p-2 gap-2 scrollbar-hide">
                                {categorias.map(categoria => (
                                    <button
                                        key={categoria}
                                        onClick={() => setCategoriaAtiva(categoria)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                                            categoriaAtiva === categoria 
                                                ? 'bg-blue-600 text-white shadow-md' 
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {categoria}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* PRODUTOS */}
                        <div className="flex-1 overflow-y-auto p-2">
                            {Object.entries(produtosPorCategoria).map(([categoria, produtosCategoria]) => (
                                <div key={categoria} className={categorias.length > 1 && categoriaAtiva !== categoria ? 'hidden' : ''}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {produtosCategoria.map(produto => (
                                            <button
                                                key={produto.id}
                                                onClick={() => setProdutoSelecionado(produto)}
                                                className={`text-left p-4 rounded-xl border transition-all hover:shadow-md relative overflow-hidden group ${
                                                    produtoSelecionado?.id === produto.id 
                                                        ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' 
                                                        : 'bg-white border-gray-200 hover:border-blue-300'
                                                }`}
                                            >
                                                <div className="flex justify-between items-start z-10 relative">
                                                    <div className="flex-1 pr-2">
                                                        <h4 className="font-bold text-gray-800 leading-tight">{produto.nome}</h4>
                                                        {produto.descricao && (
                                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{produto.descricao}</p>
                                                        )}
                                                    </div>
                                                    <span className="font-bold text-blue-600 whitespace-nowrap bg-blue-50 px-2 py-1 rounded-lg text-sm">
                                                        R$ {produto.preco?.toFixed(2)}
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* COLUNA DIREITA: DETALHES DO SELEÇÃO */}
                    <div className="w-full lg:w-96 bg-white border border-gray-200 rounded-xl p-5 shadow-sm overflow-y-auto">
                        {produtoSelecionado ? (
                            <div className="space-y-6">
                                {/* INFO PRODUTO */}
                                <div className="border-b border-gray-100 pb-4">
                                    <h3 className="font-black text-xl text-gray-800">{produtoSelecionado.nome}</h3>
                                    <p className="text-sm text-gray-500 mt-1">{produtoSelecionado.descricao}</p>
                                    <div className="text-2xl font-black text-blue-600 mt-2">
                                        R$ {produtoSelecionado.preco?.toFixed(2)}
                                    </div>
                                </div>

                                {/* 3. SELETOR DE CLIENTE (NOVA PARTE) */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                        <IoPerson className="text-blue-500" /> Quem pediu?
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {listaPessoas.map((nome) => (
                                            <button
                                                key={nome}
                                                onClick={() => setClienteSelecionado(nome)}
                                                className={`px-3 py-2 rounded-lg text-sm font-bold border transition-all ${
                                                    clienteSelecionado === nome
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-lg scale-105'
                                                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                                }`}
                                            >
                                                {nome}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* QUANTIDADE */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Quantidade</label>
                                    <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-xl border border-gray-200 w-fit">
                                        <button onClick={diminuirQuantidade} className="w-10 h-10 rounded-lg bg-white shadow text-gray-600 hover:text-red-500 font-bold text-xl flex items-center justify-center transition-colors">
                                            <IoRemove />
                                        </button>
                                        <span className="text-xl font-bold w-8 text-center text-gray-800">{quantidade}</span>
                                        <button onClick={aumentarQuantidade} className="w-10 h-10 rounded-lg bg-blue-600 shadow text-white font-bold text-xl flex items-center justify-center hover:bg-blue-700 transition-colors">
                                            <IoAdd />
                                        </button>
                                    </div>
                                </div>

                                {/* OBSERVAÇÕES */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Observações</label>
                                    <textarea
                                        value={observacoes}
                                        onChange={(e) => setObservacoes(e.target.value)}
                                        placeholder="Ex: Sem cebola, ponto da carne..."
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none bg-gray-50 text-sm"
                                        rows="3"
                                    />
                                </div>

                                {/* TOTAL E BOTÃO */}
                                <div className="pt-4 mt-auto">
                                    <div className="flex justify-between items-center mb-4 text-lg font-bold text-gray-800">
                                        <span>Total do Item:</span>
                                        <span className="text-green-600 text-xl">
                                            R$ {(produtoSelecionado.preco * quantidade).toFixed(2)}
                                        </span>
                                    </div>

                                    <button
                                        onClick={handleAdicionar}
                                        className="w-full bg-green-500 hover:bg-green-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95"
                                    >
                                        <IoCart className="w-6 h-6" />
                                        Confirmar para {clienteSelecionado}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                    <IoCart className="w-10 h-10 opacity-30" />
                                </div>
                                <p className="font-medium">Selecione um produto ao lado</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdicionarItemMesa;