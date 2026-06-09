import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { usePdvProducts } from '../hooks/usePdvProducts';
import { vendaService } from '../services/vendaService';
import { rotearEImprimir } from '../services/printService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import {
    IoClose, IoSearch, IoAdd, IoRemove, IoTrash,
    IoCart, IoCardOutline, IoCash, IoLogoUsd,
    IoCheckmarkCircle, IoChevronBack, IoReceipt, IoBagHandle
} from 'react-icons/io5';

const formatarReal = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ModalVendaRapida({ isOpen, onClose, estabelecimentoId, estabelecimentoNome, onVendaConcluida }) {
    const { currentUser } = useAuth();
    const { produtosFiltrados, categorias, categoriaAtiva, setCategoriaAtiva, busca, setBusca, carregandoProdutos } = usePdvProducts(estabelecimentoId);

    // Estado do carrinho
    const [carrinho, setCarrinho] = useState([]);
    const [etapa, setEtapa] = useState(1); // 1=itens, 2=pagamento
    const [formaPagamento, setFormaPagamento] = useState('dinheiro');
    const [valorRecebido, setValorRecebido] = useState('');
    const [desconto, setDesconto] = useState('');
    const [finalizando, setFinalizando] = useState(false);
    const [vendaFinalizada, setVendaFinalizada] = useState(null);

    // Config de impressoras do estabelecimento
    const [printerConfig, setPrinterConfig] = useState(null);
    useEffect(() => {
        if (!estabelecimentoId) return;
        getDoc(doc(db, 'estabelecimentos', estabelecimentoId)).then(snap => {
            if (snap.exists()) {
                const d = snap.data();
                setPrinterConfig({
                    impressoraBalcao: d.impressoraBalcao || null,
                    impressoraCozinha: d.impressoraCozinha || null,
                    roteamento: d.roteamentoImpressao || {}
                });
            }
        }).catch(err => console.warn('Erro ao carregar config impressora:', err));
    }, [estabelecimentoId]);

    // Variação
    const [produtoComVariacao, setProdutoComVariacao] = useState(null);

    const subtotal = useMemo(() => carrinho.reduce((acc, i) => acc + (i.price * i.quantity), 0), [carrinho]);
    const descontoNum = parseFloat(desconto) || 0;
    const total = Math.max(0, subtotal - descontoNum);
    const troco = formaPagamento === 'dinheiro' && parseFloat(valorRecebido) > total
        ? parseFloat(valorRecebido) - total : 0;

    const adicionarItem = useCallback((produto, variacao = null) => {
        const uid = variacao ? `${produto.id}-${variacao.id || variacao.nome}` : produto.id;
        const nome = variacao ? `${produto.name} - ${variacao.nome}` : produto.name;
        const preco = variacao ? Number(variacao.preco) : Number(produto.price);

        setCarrinho(prev => {
            const existe = prev.find(i => i.uid === uid);
            if (existe) return prev.map(i => i.uid === uid ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, {
                uid,
                id: produto.id,
                name: nome,
                price: preco,
                quantity: 1,
                categoriaId: produto.categoriaId,
                categoria: produto.categoria,
                produtoIdOriginal: produto.id,
                variacaoId: variacao?.id || null,
                fichaTecnica: produto.fichaTecnica || null
            }];
        });
        setProdutoComVariacao(null);
    }, []);

    const alterarQtd = (uid, delta) => {
        setCarrinho(prev => prev.map(i => {
            if (i.uid !== uid) return i;
            const newQtd = i.quantity + delta;
            return newQtd > 0 ? { ...i, quantity: newQtd } : i;
        }));
    };

    const removerItem = (uid) => setCarrinho(prev => prev.filter(i => i.uid !== uid));

    const handleClickProduto = (produto) => {
        if (produto.temVariacoes && produto.variacoes?.length > 0) {
            setProdutoComVariacao(produto);
        } else {
            adicionarItem(produto);
        }
    };

    const handleFinalizar = async () => {
        if (carrinho.length === 0) return toast.warn('Adicione ao menos um item.');
        if (formaPagamento === 'dinheiro' && parseFloat(valorRecebido) > 0 && parseFloat(valorRecebido) < total) {
            return toast.error('Valor recebido é menor que o total.');
        }

        setFinalizando(true);
        try {
            const vendaData = {
                estabelecimentoId,
                status: 'finalizada',
                formaPagamento,
                subtotal,
                desconto: descontoNum,
                acrescimo: 0,
                total,
                totalFinal: total,
                troco,
                valorRecebido: formaPagamento === 'dinheiro' ? (parseFloat(valorRecebido) || total) : total,
                itens: carrinho.map(i => ({
                    uid: i.uid,
                    id: i.id,
                    name: i.name,
                    nome: i.name,
                    price: i.price,
                    preco: i.price,
                    precoUnitario: i.price,
                    quantity: i.quantity,
                    quantidade: i.quantity,
                    qtd: i.quantity,
                    observacao: '',
                    categoriaId: i.categoriaId,
                    categoria: i.categoria,
                    produtoIdOriginal: i.produtoIdOriginal || i.id,
                    variacaoId: i.variacaoId || null,
                    fichaTecnica: i.fichaTecnica || null
                })),
                pagamentos: [{ formaPagamento: formaPagamento, valor: total }],
                usuarioId: currentUser?.uid || 'sistema',
                cliente: 'Balcão',
                clienteNome: 'Venda Rápida - Balcão',
                nomeCliente: 'Venda Rápida - Balcão',
                tipo: 'balcao',
                origem: 'salao',
                createdAt: new Date()
            };

            const result = await vendaService.salvarVendaRapida(vendaData, currentUser?.uid, currentUser?.displayName || currentUser?.email);

            if (result.success) {
                toast.success('✅ Venda registrada com sucesso!');
                setVendaFinalizada({ ...vendaData, vendaId: result.vendaId });
                setEtapa(3); // tela de sucesso
                if (onVendaConcluida) onVendaConcluida(result);

                // Impressão automática na cozinha/balcão
                if (printerConfig && (printerConfig.impressoraBalcao || printerConfig.impressoraCozinha)) {
                    try {
                        const pedidoParaImprimir = {
                            ...vendaData,
                            vendaId: result.vendaId,
                            id: result.vendaId,
                            nome: 'Venda Rápida',
                            cliente: { nome: 'Venda Rápida - Balcão' },
                            source: 'salao',
                            tipo: 'balcao'
                        };
                        await rotearEImprimir(
                            pedidoParaImprimir,
                            printerConfig.roteamento,
                            printerConfig.impressoraBalcao,
                            printerConfig.impressoraCozinha
                        );
                        console.log('🖨️ Comanda impressa com sucesso!');
                    } catch (printErr) {
                        console.error('Erro ao imprimir comanda:', printErr);
                        toast.warning('⚠️ Venda salva, mas erro ao imprimir.');
                    }
                }
            } else {
                toast.error(`Erro: ${result.error}`);
            }
        } catch (e) {
            console.error(e);
            toast.error('Erro ao finalizar venda.');
        } finally {
            setFinalizando(false);
        }
    };

    const resetar = () => {
        setCarrinho([]);
        setEtapa(1);
        setFormaPagamento('dinheiro');
        setValorRecebido('');
        setDesconto('');
        setVendaFinalizada(null);
    };

    const handleClose = () => {
        resetar();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9000] flex items-center justify-center p-2 sm:p-4">
            <div className="bg-white w-full max-w-5xl h-[95vh] sm:h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">

                {/* HEADER */}
                <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-5 py-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        {etapa === 2 && (
                            <button onClick={() => setEtapa(1)} className="p-1.5 hover:bg-white/20 rounded-xl transition-all">
                                <IoChevronBack size={22} />
                            </button>
                        )}
                        <IoBagHandle size={24} />
                        <div>
                            <h2 className="text-lg font-black">Venda Rápida</h2>
                            <p className="text-emerald-100 text-xs">{etapa === 1 ? 'Selecione os itens' : etapa === 2 ? 'Finalizar pagamento' : 'Venda concluída'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {carrinho.length > 0 && etapa === 1 && (
                            <div className="bg-white/20 px-3 py-1.5 rounded-xl text-sm font-bold">
                                {carrinho.reduce((a, i) => a + i.quantity, 0)} itens • {formatarReal(subtotal)}
                            </div>
                        )}
                        <button onClick={handleClose} className="p-2 hover:bg-white/20 rounded-xl transition-all">
                            <IoClose size={22} />
                        </button>
                    </div>
                </div>

                {/* ETAPA 1 — SELEÇÃO DE ITENS */}
                {etapa === 1 && (
                    <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
                        {/* Cardápio */}
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Busca + Categorias */}
                            <div className="px-4 pt-4 pb-2 space-y-3 shrink-0 bg-gray-50 border-b">
                                <div className="relative">
                                    <IoSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none"
                                        placeholder="Buscar produto..."
                                        value={busca}
                                        onChange={(e) => setBusca(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                                    {categorias.map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setCategoriaAtiva(cat.id)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                                                categoriaAtiva === cat.id
                                                    ? 'bg-emerald-600 text-white shadow-md'
                                                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                                            }`}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Grid de Produtos */}
                            <div className="flex-1 overflow-y-auto p-4">
                                {carregandoProdutos ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
                                    </div>
                                ) : produtosFiltrados.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                        <IoSearch size={40} className="mb-2" />
                                        <p className="font-bold">Nenhum produto encontrado</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                        {produtosFiltrados.filter(p => p.ativo !== false).map(produto => {
                                            const qtdNoCarrinho = carrinho.filter(c => c.id === produto.id).reduce((a, c) => a + c.quantity, 0);
                                            return (
                                                <button
                                                    key={produto.id}
                                                    onClick={() => handleClickProduto(produto)}
                                                    className="relative bg-white border border-gray-100 rounded-xl p-3 text-left hover:shadow-lg hover:border-emerald-300 transition-all active:scale-[0.97] group"
                                                >
                                                    {qtdNoCarrinho > 0 && (
                                                        <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs font-black shadow-lg z-10">
                                                            {qtdNoCarrinho}
                                                        </div>
                                                    )}
                                                    {produto.imageUrl && (
                                                        <div className="w-full aspect-square rounded-lg bg-gray-100 overflow-hidden mb-2">
                                                            <img src={produto.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                                                        </div>
                                                    )}
                                                    <p className="text-xs font-bold text-gray-800 truncate">{produto.name}</p>
                                                    <p className="text-xs font-black text-emerald-600 mt-0.5">
                                                        {produto.temVariacoes ? `A partir de ${formatarReal(produto.price)}` : formatarReal(produto.price)}
                                                    </p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Mini Carrinho (lateral em desktop, inferior em mobile) */}
                        <div className="w-full lg:w-80 bg-gray-50 border-t lg:border-t-0 lg:border-l border-gray-200 flex flex-col shrink-0 max-h-[40vh] lg:max-h-none">
                            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                                <h3 className="font-black text-sm flex items-center gap-2">
                                    <IoCart className="text-emerald-600" /> Carrinho ({carrinho.reduce((a, i) => a + i.quantity, 0)})
                                </h3>
                                {carrinho.length > 0 && (
                                    <button onClick={() => setCarrinho([])} className="text-red-400 hover:text-red-600 text-xs font-bold">Limpar</button>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
                                {carrinho.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400">
                                        <IoCart size={32} className="mx-auto mb-2 opacity-50" />
                                        <p className="text-xs font-bold">Carrinho vazio</p>
                                    </div>
                                ) : carrinho.map(item => (
                                    <div key={item.uid} className="bg-white rounded-xl px-3 py-2.5 flex items-center gap-2 border border-gray-100 shadow-sm">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-gray-800 truncate">{item.name}</p>
                                            <p className="text-[10px] font-bold text-emerald-600">{formatarReal(item.price * item.quantity)}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => alterarQtd(item.uid, -1)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-red-100 flex items-center justify-center text-gray-500 hover:text-red-600 transition-colors">
                                                <IoRemove size={14} />
                                            </button>
                                            <span className="text-xs font-black w-6 text-center">{item.quantity}</span>
                                            <button onClick={() => alterarQtd(item.uid, 1)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-emerald-100 flex items-center justify-center text-gray-500 hover:text-emerald-600 transition-colors">
                                                <IoAdd size={14} />
                                            </button>
                                            <button onClick={() => removerItem(item.uid)} className="w-7 h-7 rounded-lg hover:bg-red-100 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors ml-1">
                                                <IoTrash size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Rodapé do carrinho */}
                            {carrinho.length > 0 && (
                                <div className="p-3 border-t border-gray-200 shrink-0">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="font-bold text-sm text-gray-600">Total:</span>
                                        <span className="font-black text-xl text-gray-900">{formatarReal(subtotal)}</span>
                                    </div>
                                    <button
                                        onClick={() => setEtapa(2)}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl shadow-lg active:scale-[0.97] transition-all flex items-center justify-center gap-2"
                                    >
                                        <IoCash size={20} /> COBRAR
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ETAPA 2 — PAGAMENTO */}
                {etapa === 2 && (
                    <div className="flex-1 overflow-y-auto p-5 space-y-5">
                        {/* Resumo */}
                        <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                            <h3 className="font-black text-sm text-gray-600 uppercase tracking-wide">Resumo</h3>
                            {carrinho.map(item => (
                                <div key={item.uid} className="flex justify-between text-sm">
                                    <span className="text-gray-700">{item.quantity}x {item.name}</span>
                                    <span className="font-bold">{formatarReal(item.price * item.quantity)}</span>
                                </div>
                            ))}
                            <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between">
                                <span className="font-bold text-gray-600">Subtotal</span>
                                <span className="font-black">{formatarReal(subtotal)}</span>
                            </div>
                        </div>

                        {/* Desconto */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Desconto (R$)</label>
                            <input
                                type="number"
                                value={desconto}
                                onChange={(e) => setDesconto(e.target.value)}
                                placeholder="0,00"
                                className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none"
                            />
                        </div>

                        {/* Forma de Pagamento */}
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">Forma de Pagamento</label>
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { id: 'dinheiro', label: 'Dinheiro', icon: IoCash, color: 'emerald' },
                                    { id: 'credito', label: 'Crédito', icon: IoCardOutline, color: 'blue' },
                                    { id: 'debito', label: 'Débito', icon: IoCardOutline, color: 'orange' },
                                    { id: 'pix', label: 'PIX', icon: IoLogoUsd, color: 'purple' },
                                ].map(({ id, label, icon: Icon, color }) => (
                                    <button
                                        key={id}
                                        onClick={() => setFormaPagamento(id)}
                                        className={`flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl border-2 font-bold text-xs sm:text-sm transition-all ${
                                            formaPagamento === id
                                                ? `border-${color}-500 bg-${color}-50 text-${color}-700 shadow-md`
                                                : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                    >
                                        <Icon size={24} />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Troco (se dinheiro) */}
                        {formaPagamento === 'dinheiro' && (
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Valor Recebido (R$)</label>
                                <input
                                    type="number"
                                    value={valorRecebido}
                                    onChange={(e) => setValorRecebido(e.target.value)}
                                    placeholder={total.toFixed(2)}
                                    className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none"
                                />
                                {troco > 0 && (
                                    <p className="mt-2 text-emerald-600 font-black text-sm">
                                        💵 Troco: {formatarReal(troco)}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Total Final */}
                        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 text-center">
                            <p className="text-xs font-bold text-emerald-600 uppercase">Total a Cobrar</p>
                            <p className="text-4xl font-black text-emerald-700 mt-1">{formatarReal(total)}</p>
                        </div>

                        {/* Botão Finalizar */}
                        <button
                            onClick={handleFinalizar}
                            disabled={finalizando || carrinho.length === 0}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl shadow-xl active:scale-[0.97] transition-all flex items-center justify-center gap-2 text-lg"
                        >
                            {finalizando ? (
                                <><div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div> Finalizando...</>
                            ) : (
                                <><IoCheckmarkCircle size={24} /> FINALIZAR VENDA</>
                            )}
                        </button>
                    </div>
                )}

                {/* ETAPA 3 — SUCESSO */}
                {etapa === 3 && vendaFinalizada && (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6 animate-[bounce_0.5s_ease-in-out]">
                            <IoCheckmarkCircle size={56} className="text-emerald-500" />
                        </div>
                        <h2 className="text-3xl font-black text-gray-900 mb-2">Venda Concluída!</h2>
                        <p className="text-gray-500 font-bold mb-1">{vendaFinalizada.itens.length} {vendaFinalizada.itens.length === 1 ? 'item' : 'itens'} • {formaPagamento.charAt(0).toUpperCase() + formaPagamento.slice(1)}</p>
                        <p className="text-4xl font-black text-emerald-600 mb-8">{formatarReal(vendaFinalizada.total)}</p>

                        {vendaFinalizada.vendaId && (
                            <p className="text-xs text-gray-400 font-bold mb-6">ID: #{vendaFinalizada.vendaId.slice(-6).toUpperCase()}</p>
                        )}

                        <div className="flex flex-col gap-3 w-full max-w-xs">
                            <button
                                onClick={async () => {
                                    if (!printerConfig || (!printerConfig.impressoraBalcao && !printerConfig.impressoraCozinha)) {
                                        toast.warning('⚠️ Nenhuma impressora configurada nas configurações.');
                                        return;
                                    }
                                    try {
                                        toast.info('🖨️ Enviando para impressora...');
                                        const pedidoParaImprimir = {
                                            ...vendaFinalizada,
                                            id: vendaFinalizada.vendaId,
                                            nome: 'Venda Rápida',
                                            cliente: { nome: 'Venda Rápida - Balcão' },
                                            source: 'salao',
                                            tipo: 'balcao'
                                        };
                                        await rotearEImprimir(
                                            pedidoParaImprimir,
                                            printerConfig.roteamento,
                                            printerConfig.impressoraBalcao,
                                            printerConfig.impressoraCozinha
                                        );
                                        toast.success('✅ Comanda impressa!');
                                    } catch (err) {
                                        console.error('Erro ao imprimir:', err);
                                        toast.error('Erro ao imprimir. Verifique o QZ Tray.');
                                    }
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-black py-3 px-8 rounded-xl shadow-lg active:scale-[0.97] transition-all flex items-center justify-center gap-2 w-full"
                            >
                                <IoReceipt size={20} /> Imprimir Comanda
                            </button>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => { resetar(); }}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 px-6 rounded-xl shadow-lg active:scale-[0.97] transition-all flex items-center justify-center gap-2"
                                >
                                    <IoAdd size={20} /> Nova Venda
                                </button>
                                <button
                                    onClick={handleClose}
                                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-black py-3 px-6 rounded-xl active:scale-[0.97] transition-all"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL DE VARIAÇÃO */}
                {produtoComVariacao && (
                    <div className="fixed inset-0 bg-black/60 z-[9500] flex items-center justify-center p-4" onClick={() => setProdutoComVariacao(null)}>
                        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="font-black text-sm">{produtoComVariacao.name}</h3>
                                <button onClick={() => setProdutoComVariacao(null)} className="text-gray-400 hover:text-gray-600">
                                    <IoClose size={20} />
                                </button>
                            </div>
                            <div className="p-4 space-y-2 overflow-y-auto max-h-[60vh]">
                                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Escolha uma opção:</p>
                                {produtoComVariacao.variacoes.map((v, idx) => (
                                    <button
                                        key={v.id || idx}
                                        onClick={() => adicionarItem(produtoComVariacao, v)}
                                        className="w-full flex justify-between items-center bg-gray-50 hover:bg-emerald-50 hover:border-emerald-300 border border-gray-200 rounded-xl px-4 py-3 transition-all active:scale-[0.97]"
                                    >
                                        <span className="font-bold text-sm text-gray-800">{v.nome}</span>
                                        <span className="font-black text-sm text-emerald-600">{formatarReal(v.preco)}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
