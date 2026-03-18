import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, doc, serverTimestamp, writeBatch, increment } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { 
    IoCloudUploadOutline, IoDocumentTextOutline, IoBusinessOutline, 
    IoCartOutline, IoCheckmarkCircleOutline, IoAlertCircleOutline,
    IoTrashOutline, IoSaveOutline, IoCloseOutline, IoSearchOutline
} from 'react-icons/io5';
// IMPORTANTE: Importar o seu serviço de produtos
import { produtoService } from '../../services/produtoService';

const EntradaEstoqueXML = () => {
    const { estabelecimentoIdPrincipal } = useAuth();
    const [notaLida, setNotaLida] = useState(null);
    const [loading, setLoading] = useState(false);
    
    const [produtosSistema, setProdutosSistema] = useState([]);
    const [modalVinculo, setModalVinculo] = useState({ isOpen: false, itemIndex: null });
    const [buscaProduto, setBuscaProduto] = useState("");

    // 1. CORREÇÃO DA BUSCA: Usando o seu produtoService
    useEffect(() => {
        const fetchProdutos = async () => {
            if (!estabelecimentoIdPrincipal) return;
            try {
                console.log("A procurar produtos pelo serviço...");
                // Usamos a função universal que vai ler todas as categorias do cardápio
                const prods = await produtoService.buscarProdutosUniversal(estabelecimentoIdPrincipal);
                setProdutosSistema(prods);
            } catch (error) {
                console.error("Erro ao buscar produtos:", error);
                toast.error("Erro ao carregar os seus produtos do sistema.");
            }
        };
        fetchProdutos();
    }, [estabelecimentoIdPrincipal]);

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (file.type !== "text/xml" && !file.name.endsWith('.xml')) {
            toast.error("Por favor, selecione um ficheiro XML válido.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(text, "text/xml");

                const ide = xmlDoc.getElementsByTagName("ide")[0];
                const nNF = ide?.getElementsByTagName("nNF")[0]?.textContent;
                const serie = ide?.getElementsByTagName("serie")[0]?.textContent;
                const dhEmi = ide?.getElementsByTagName("dhEmi")[0]?.textContent || ide?.getElementsByTagName("dEmi")[0]?.textContent;

                const emit = xmlDoc.getElementsByTagName("emit")[0];
                const xNome = emit?.getElementsByTagName("xNome")[0]?.textContent;
                const cnpj = emit?.getElementsByTagName("CNPJ")[0]?.textContent;

                const detList = xmlDoc.getElementsByTagName("det");
                const produtos = [];

                for (let i = 0; i < detList.length; i++) {
                    const prod = detList[i].getElementsByTagName("prod")[0];
                    produtos.push({
                        item: i + 1,
                        codigo: prod.getElementsByTagName("cProd")[0]?.textContent,
                        ean: prod.getElementsByTagName("cEAN")[0]?.textContent,
                        nome: prod.getElementsByTagName("xProd")[0]?.textContent,
                        ncm: prod.getElementsByTagName("NCM")[0]?.textContent,
                        qtd: parseFloat(prod.getElementsByTagName("qCom")[0]?.textContent || 0),
                        unidade: prod.getElementsByTagName("uCom")[0]?.textContent,
                        valorUnit: parseFloat(prod.getElementsByTagName("vUnCom")[0]?.textContent || 0),
                        valorTotal: parseFloat(prod.getElementsByTagName("vProd")[0]?.textContent || 0),
                        vinculoId: null,
                        vinculoNome: null,
                        vinculoCategoria: null // Adicionado para sabermos o caminho exato na base de dados
                    });
                }

                setNotaLida({
                    numero: nNF,
                    serie: serie,
                    dataEmissao: dhEmi,
                    fornecedor: { nome: xNome, cnpj: cnpj },
                    produtos: produtos,
                    totalNota: produtos.reduce((acc, p) => acc + p.valorTotal, 0)
                });

                toast.success("Nota XML lida com sucesso!");
            } catch (err) {
                console.error("Erro ao ler XML:", err);
                toast.error("Falha ao processar o XML. Verifique se é uma NF-e válida.");
            }
        };
        reader.readAsText(file);
    };

    const limparNota = () => {
        setNotaLida(null);
        document.getElementById('fileInput').value = "";
    };

    const selecionarVinculo = (produtoSistema) => {
        const novosProdutos = [...notaLida.produtos];
        // 2. CORREÇÃO: Capturar ID, Nome e a CATEGORIA (necessária para atualizar o caminho correto depois)
        novosProdutos[modalVinculo.itemIndex].vinculoId = produtoSistema.id;
        novosProdutos[modalVinculo.itemIndex].vinculoNome = produtoSistema.name; // produtoService retorna 'name'
        novosProdutos[modalVinculo.itemIndex].vinculoCategoria = produtoSistema.category; // categoria real (ex: 'bebidas')
        
        setNotaLida({ ...notaLida, produtos: novosProdutos });
        setModalVinculo({ isOpen: false, itemIndex: null });
        setBuscaProduto("");
    };

    const confirmarEntradaEstoque = async () => {
        if (!estabelecimentoIdPrincipal) return;
        setLoading(true);

        try {
            const batch = writeBatch(db);

            // 3. CORREÇÃO DO CAMINHO DE GRAVAÇÃO DO ESTOQUE
            notaLida.produtos.forEach((prod) => {
                if (prod.vinculoId && prod.vinculoCategoria) {
                    // O caminho correto segundo a sua estrutura no produtoService
                    const prodRef = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'cardapio', prod.vinculoCategoria, 'itens', prod.vinculoId);
                    
                    batch.update(prodRef, {
                        // Utiliza o increment para SOMAR a quantidade lida na nota ao stock atual
                        estoque: increment(prod.qtd) 
                    });
                }
            });

            // Guardar histórico da nota
            const historicoRef = doc(collection(db, 'historico_compras'));
            batch.set(historicoRef, {
                estabelecimentoId: estabelecimentoIdPrincipal,
                numeroNota: notaLida.numero,
                fornecedorNome: notaLida.fornecedor.nome,
                fornecedorCnpj: notaLida.fornecedor.cnpj,
                valorTotal: notaLida.totalNota,
                dataEmissao: notaLida.dataEmissao,
                dataEntrada: serverTimestamp(),
                itens: notaLida.produtos.map(p => ({
                    nomeXML: p.nome,
                    vinculoId: p.vinculoId,
                    vinculoNome: p.vinculoNome,
                    quantidade: p.qtd,
                    valorTotal: p.valorTotal
                }))
            });

            await batch.commit();
            toast.success("Estoque atualizado com sucesso!");
            limparNota();

        } catch (error) {
            console.error("Erro ao dar entrada no stock:", error);
            toast.error("Erro ao guardar entrada de stock.");
        } finally {
            setLoading(false);
        }
    };

    const produtosFiltrados = produtosSistema.filter(p => 
        p.name?.toLowerCase().includes(buscaProduto.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
            <div className="max-w-6xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                        <IoCloudUploadOutline className="text-blue-600" />
                        Entrada de Estoque via XML
                    </h1>
                    <p className="text-gray-500">Importe notas de compra para atualizar o seu stock automaticamente.</p>
                </header>

                {!notaLida ? (
                    <div className="bg-white border-4 border-dashed border-gray-200 rounded-[2.5rem] p-12 text-center hover:border-blue-400 transition-all group">
                        <input 
                            type="file" 
                            id="fileInput" 
                            accept=".xml" 
                            onChange={handleFileUpload} 
                            className="hidden" 
                        />
                        <label htmlFor="fileInput" className="cursor-pointer flex flex-col items-center">
                            <div className="w-24 h-24 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <IoDocumentTextOutline size={48} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">Arraste o seu ficheiro XML aqui</h2>
                            <p className="text-gray-400 mb-8">Ou clique para procurar no seu computador</p>
                            <span className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all">
                                Selecionar Ficheiro
                            </span>
                        </label>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                <div className="flex items-center gap-3 text-blue-600 mb-2">
                                    <IoDocumentTextOutline size={20} />
                                    <span className="text-xs font-black uppercase tracking-widest">Dados da Nota</span>
                                </div>
                                <p className="text-xl font-bold text-gray-800">Nº {notaLida.numero}</p>
                                <p className="text-sm text-gray-500">Série: {notaLida.serie} • Emissão: {new Date(notaLida.dataEmissao).toLocaleDateString()}</p>
                            </div>

                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                <div className="flex items-center gap-3 text-emerald-600 mb-2">
                                    <IoBusinessOutline size={20} />
                                    <span className="text-xs font-black uppercase tracking-widest">Fornecedor</span>
                                </div>
                                <p className="text-xl font-bold text-gray-800 truncate" title={notaLida.fornecedor.nome}>{notaLida.fornecedor.nome}</p>
                                <p className="text-sm text-gray-500">CNPJ: {notaLida.fornecedor.cnpj}</p>
                            </div>

                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                                <div className="flex items-center gap-3 text-purple-600 mb-2">
                                    <IoCartOutline size={20} />
                                    <span className="text-xs font-black uppercase tracking-widest">Valor Total</span>
                                </div>
                                <p className="text-2xl font-black text-gray-900">
                                    {notaLida.totalNota.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                                <p className="text-sm text-gray-500">{notaLida.produtos.length} itens encontrados</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    📦 Itens da Nota
                                </h3>
                                <button onClick={limparNota} className="text-red-500 hover:text-red-700 font-bold text-sm flex items-center gap-1 transition-colors">
                                    <IoTrashOutline /> Limpar e trocar ficheiro
                                </button>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 text-[10px] uppercase tracking-widest text-gray-400 font-black">
                                            <th className="px-6 py-4">Produto na Nota</th>
                                            <th className="px-6 py-4">Qtd</th>
                                            <th className="px-6 py-4">Unitário</th>
                                            <th className="px-6 py-4">Total</th>
                                            <th className="px-6 py-4">Vínculo no Sistema</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {notaLida.produtos.map((p, idx) => (
                                            <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <p className="text-sm font-bold text-gray-800">{p.nome}</p>
                                                    <p className="text-[10px] text-gray-400 font-mono">EAN: {p.ean || 'SEM EAN'} | COD: {p.codigo}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="bg-gray-100 px-2 py-1 rounded-lg text-sm font-bold text-gray-600">
                                                        {p.qtd} {p.unidade}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">
                                                    {p.valorUnit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </td>
                                                <td className="px-6 py-4 text-sm font-black text-gray-900">
                                                    {p.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {p.vinculoId ? (
                                                        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-2 rounded-xl border border-emerald-100 text-sm font-bold">
                                                            <IoCheckmarkCircleOutline size={18} />
                                                            <span className="truncate max-w-[150px]">{p.vinculoNome}</span>
                                                            <button 
                                                                onClick={() => setModalVinculo({ isOpen: true, itemIndex: idx })}
                                                                className="ml-auto text-xs underline hover:text-emerald-900"
                                                            >
                                                                Trocar
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button 
                                                            onClick={() => setModalVinculo({ isOpen: true, itemIndex: idx })}
                                                            className="flex items-center gap-2 text-[11px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-2 rounded-xl hover:bg-blue-100 transition-all border border-blue-100"
                                                        >
                                                            <IoAlertCircleOutline size={16} /> Vincular Produto
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-end">
                                <button 
                                    onClick={confirmarEntradaEstoque}
                                    className="bg-green-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-green-100 hover:bg-green-700 transition-all active:scale-95 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={notaLida.produtos.some(p => !p.vinculoId) || loading}
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <IoSaveOutline size={20} />
                                    )}
                                    Confirmar Entrada no Estoque
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {modalVinculo.isOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800">Vincular ao Produto</h3>
                            <button onClick={() => setModalVinculo({ isOpen: false, itemIndex: null })} className="text-gray-400 hover:text-gray-700">
                                <IoCloseOutline size={24} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                                <p className="text-xs text-blue-600 font-bold uppercase mb-1">Produto na Nota:</p>
                                <p className="text-sm font-semibold text-gray-800">
                                    {notaLida.produtos[modalVinculo.itemIndex]?.nome}
                                </p>
                            </div>

                            <div className="relative">
                                <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                <input 
                                    type="text" 
                                    placeholder="Buscar produto no sistema..."
                                    value={buscaProduto}
                                    onChange={(e) => setBuscaProduto(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>

                            <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-100">
                                {produtosFiltrados.length === 0 ? (
                                    <div className="p-4 text-center text-gray-500 text-sm">
                                        Nenhum produto encontrado.
                                    </div>
                                ) : (
                                    produtosFiltrados.map(prod => (
                                        <button
                                            key={prod.id}
                                            onClick={() => selecionarVinculo(prod)}
                                            className="w-full text-left p-4 hover:bg-blue-50 transition-colors flex justify-between items-center group"
                                        >
                                            <div>
                                                {/* Atualizado para usar prod.name conforme o seu formatarProdutoReal */}
                                                <p className="font-bold text-sm text-gray-800">{prod.name}</p> 
                                                <p className="text-xs text-gray-500">{prod.categoriaNome || 'Sem categoria'}</p>
                                            </div>
                                            <span className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <IoCheckmarkCircleOutline size={20} />
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EntradaEstoqueXML;