import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHeader } from '../../context/HeaderContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import BackButton from '../../components/BackButton';
import { db } from '../../firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, orderBy, where } from 'firebase/firestore';
import { 
    IoTrashOutline, IoAddCircleOutline, IoSearch, IoClose, 
    IoAlertCircle, IoTrendingDown, IoScaleOutline, IoList, 
    IoLayersOutline, IoFlaskOutline, IoSaveOutline, IoCalendarOutline 
} from 'react-icons/io5';
import { toast } from 'react-toastify';

const MOTIVOS = [
    { value: 'vencido', label: 'Item Vencido' },
    { value: 'estragado', label: 'Item Estragado / Danificado' },
    { value: 'erro_preparo', label: 'Erro de Preparo / Produção' },
    { value: 'queda_quebra', label: 'Queda / Quebra Física' },
    { value: 'outros', label: 'Outros Motivos' }
];

const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
};

function RelatorioPerdas() {
    const { estabelecimentoIdPrincipal } = useAuth();
    const { setActions, clearActions } = useHeader();
    const estabelecimentoId = estabelecimentoIdPrincipal;

    // States
    const [perdas, setPerdas] = useState([]);
    const [produtos, setProdutos] = useState([]);
    const [insumos, setInsumos] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [formLoading, setFormLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Form State
    const [tipo, setTipo] = useState('produto'); // 'produto' ou 'insumo'
    const [itemId, setItemId] = useState('');
    const [quantidade, setQuantidade] = useState('');
    const [motivo, setMotivo] = useState('estragado');
    const [observacao, setObservacao] = useState('');

    // Filters
    const [busca, setBusca] = useState('');
    const [filtroMotivo, setFiltroMotivo] = useState('todos');

    // Load data
    const carregarDados = async () => {
        if (!estabelecimentoId) return;
        setLoading(true);
        try {
            // 1. Carrega Perdas
            const perdasRef = collection(db, 'estabelecimentos', estabelecimentoId, 'perdas');
            const perdasSnap = await getDocs(query(perdasRef, orderBy('data', 'desc')));
            const perdasList = perdasSnap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                data: d.data().data?.toDate() || new Date(d.data().data)
            }));
            setPerdas(perdasList);

            // 2. Carrega Insumos
            const insumosRef = collection(db, 'estabelecimentos', estabelecimentoId, 'insumos');
            const insumosSnap = await getDocs(insumosRef);
            setInsumos(insumosSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.ativo !== false));

            // 3. Carrega Produtos (Cardápio)
            const qCat = query(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio'), orderBy('ordem', 'asc'));
            const catsSnapshot = await getDocs(qCat);
            const cArray = catsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            
            if (cArray.length > 0) {
                const promises = cArray.map(async (k) => {
                    const itensSnap = await getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', k.id, 'itens'));
                    return itensSnap.docs.map(i => ({
                        id: i.id,
                        categoriaId: k.id,
                        categoriaNome: k.nome,
                        ...i.data(),
                        name: i.data().nome || 'Sem Nome'
                    }));
                });
                const resultados = await Promise.all(promises);
                setProdutos(resultados.flat());
            } else {
                setProdutos([]);
            }

        } catch (error) {
            console.error('Erro ao carregar dados de perdas:', error);
            toast.error('Erro ao carregar dados.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarDados();
    }, [estabelecimentoId]);

    // Header Action Button
    useEffect(() => {
        const action = (
            <button onClick={() => {
                setItemId('');
                setQuantidade('');
                setObservacao('');
                setShowForm(true);
            }} className="flex items-center gap-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-[0_4px_15px_rgba(225,29,72,0.3)] text-sm transition-all transform hover:scale-[1.02]">
                <IoAddCircleOutline className="text-xl" />
                <span>Registrar Perda</span>
            </button>
        );
        setActions(action);
        return () => clearActions();
    }, [setActions, clearActions, produtos, insumos]);

    // Handle Save Loss
    const handleSalvar = async (e) => {
        e.preventDefault();
        if (!itemId) return toast.warning('Selecione o item perdido.');
        if (!quantidade || parseFloat(quantidade) <= 0) return toast.warning('Insira uma quantidade válida.');

        setFormLoading(true);
        try {
            // Acha o item correspondente
            let itemObj = null;
            let custoUnitario = 0;
            let nomeItem = '';

            if (tipo === 'produto') {
                itemObj = produtos.find(p => p.id === itemId);
                custoUnitario = Number(itemObj?.precoCusto || itemObj?.price * 0.4 || 0); // fallback 40% do preço
                nomeItem = itemObj?.name || '';
            } else {
                itemObj = insumos.find(i => i.id === itemId);
                custoUnitario = Number(itemObj?.custoUnitario || 0);
                nomeItem = itemObj?.nome || '';
            }

            const custoTotal = custoUnitario * parseFloat(quantidade);

            // 1. Salva registro de perda no Firestore
            const perdaDoc = {
                tipo,
                itemId,
                nomeItem,
                quantidade: parseFloat(quantidade),
                unidade: itemObj?.unidade || 'un',
                motivo,
                custoUnitario,
                custoTotal,
                observacao: observacao.trim(),
                data: new Date()
            };

            await addDoc(collection(db, 'estabelecimentos', estabelecimentoId, 'perdas'), perdaDoc);

            // 2. Atualiza Estoque Físico
            if (tipo === 'produto') {
                // Atualiza produto
                const ref = doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', itemObj.categoriaId, 'itens', itemId);
                const estoqueAtual = Number(itemObj.estoque) || Number(itemObj.estoqueAtual) || 0;
                const novoEstoque = Math.max(0, estoqueAtual - parseFloat(quantidade));
                
                await updateDoc(ref, {
                    estoque: novoEstoque,
                    estoqueAtual: novoEstoque,
                    atualizadoEm: new Date()
                });
            } else {
                // Atualiza insumo
                const ref = doc(db, 'estabelecimentos', estabelecimentoId, 'insumos', itemId);
                const estoqueAtual = Number(itemObj.estoqueAtual) || 0;
                const novoEstoque = Math.max(0, estoqueAtual - parseFloat(quantidade));
                
                await updateDoc(ref, {
                    estoqueAtual: novoEstoque,
                    atualizadoEm: new Date()
                });
            }

            toast.success('Perda registrada e estoque atualizado!');
            setShowForm(false);
            carregarDados();

        } catch (error) {
            console.error('Erro ao salvar perda:', error);
            toast.error('Erro ao salvar registro de perda.');
        } finally {
            setFormLoading(false);
        }
    };

    // Handle Delete Loss (Reversing stock change)
    const handleExcluir = async (perda) => {
        if (!window.confirm(`Deseja realmente estornar este registro de perda? Isso devolverá a quantidade de ${perda.quantidade} ${perda.unidade} de volta ao estoque.`)) return;

        try {
            // 1. Devolve ao estoque
            if (perda.tipo === 'produto') {
                const prod = produtos.find(p => p.id === perda.itemId);
                if (prod) {
                    const ref = doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', prod.categoriaId, 'itens', perda.itemId);
                    const estoqueAtual = Number(prod.estoque) || Number(prod.estoqueAtual) || 0;
                    await updateDoc(ref, {
                        estoque: estoqueAtual + perda.quantidade,
                        estoqueAtual: estoqueAtual + perda.quantidade,
                        atualizadoEm: new Date()
                    });
                }
            } else {
                const ins = insumos.find(i => i.id === perda.itemId);
                if (ins) {
                    const ref = doc(db, 'estabelecimentos', estabelecimentoId, 'insumos', perda.itemId);
                    const estoqueAtual = Number(ins.estoqueAtual) || 0;
                    await updateDoc(ref, {
                        estoqueAtual: estoqueAtual + perda.quantidade,
                        atualizadoEm: new Date()
                    });
                }
            }

            // 2. Exclui o documento
            await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'perdas', perda.id));
            toast.success('Registro de perda estornado com sucesso!');
            carregarDados();

        } catch (error) {
            console.error('Erro ao estornar perda:', error);
            toast.error('Erro ao excluir/estornar.');
        }
    };

    // Computes
    const perdasFiltradas = useMemo(() => {
        return perdas.filter(p => {
            const matchSearch = p.nomeItem.toLowerCase().includes(busca.toLowerCase()) || (p.observacao || '').toLowerCase().includes(busca.toLowerCase());
            const matchMotivo = filtroMotivo === 'todos' || p.motivo === filtroMotivo;
            return matchSearch && matchMotivo;
        });
    }, [perdas, busca, filtroMotivo]);

    const stats = useMemo(() => {
        let totalCusto = 0;
        let totalQtd = 0;
        let porMotivo = { vencido: 0, estragado: 0, erro_preparo: 0, queda_quebra: 0, outros: 0 };
        let porTipo = { produto: 0, insumo: 0 };

        perdasFiltradas.forEach(p => {
            totalCusto += Number(p.custoTotal) || 0;
            totalQtd += Number(p.quantidade) || 0;
            if (porMotivo[p.motivo] !== undefined) {
                porMotivo[p.motivo] += Number(p.custoTotal) || 0;
            }
            if (porTipo[p.tipo] !== undefined) {
                porTipo[p.tipo] += Number(p.custoTotal) || 0;
            }
        });

        return { totalCusto, totalQtd, porMotivo, porTipo };
    }, [perdasFiltradas]);

    const itemsOptions = useMemo(() => {
        return tipo === 'produto' ? produtos : insumos;
    }, [tipo, produtos, insumos]);

    if (loading) return <div className="flex items-center justify-center min-h-screen bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600"></div></div>;

    return (
        <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans pb-32">
            <div className="max-w-7xl mx-auto">
                <BackButton className="mb-4" />

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-black text-slate-800 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/30">
                            <IoTrendingDown size={24} />
                        </div>
                        Gestão de Perdas & Desperdícios
                    </h1>
                    <p className="text-slate-500 mt-2 ml-[60px]">Rastreamento de insumos e produtos descartados com impacto financeiro no estoque.</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                    <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Desperdício Total (R$)</p>
                            <p className="text-3xl font-black text-red-600">{formatarMoeda(stats.totalCusto)}</p>
                        </div>
                        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 text-2xl shadow-inner">R$</div>
                    </div>
                    <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Total Itens Descartados</p>
                            <p className="text-3xl font-black text-slate-700">{stats.totalQtd.toLocaleString('pt-BR')} itens</p>
                        </div>
                        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-500 text-2xl shadow-inner"><IoScaleOutline /></div>
                    </div>
                    <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col justify-center sm:col-span-2 lg:col-span-1">
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Divisão por Custo</p>
                        <div className="flex gap-4 text-xs font-bold">
                            <div className="flex-1 bg-rose-50 text-rose-700 p-2.5 rounded-xl border border-rose-100 flex flex-col">
                                <span className="opacity-80">Produtos</span>
                                <span className="text-lg font-black">{formatarMoeda(stats.porTipo.produto)}</span>
                            </div>
                            <div className="flex-1 bg-violet-50 text-violet-700 p-2.5 rounded-xl border border-violet-100 flex flex-col">
                                <span className="opacity-80">Insumos</span>
                                <span className="text-lg font-black">{formatarMoeda(stats.porTipo.insumo)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dashboard Breakdowns */}
                <div className="grid lg:grid-cols-3 gap-6 mb-10">
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 lg:col-span-1">
                        <h3 className="font-extrabold text-slate-800 text-md mb-4 flex items-center gap-1.5"><IoList /> Distribuição por Motivo</h3>
                        <div className="space-y-3">
                            {MOTIVOS.map(m => {
                                const custoMotivo = stats.porMotivo[m.value] || 0;
                                const pct = stats.totalCusto > 0 ? (custoMotivo / stats.totalCusto) * 100 : 0;
                                return (
                                    <div key={m.value} className="space-y-1">
                                        <div className="flex justify-between text-xs font-bold text-slate-600">
                                            <span>{m.label}</span>
                                            <span>{formatarMoeda(custoMotivo)} ({pct.toFixed(0)}%)</span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                            <div className="bg-rose-500 h-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Filters & Search Table list */}
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 lg:col-span-2 flex flex-col min-h-[400px]">
                        <div className="flex flex-col sm:flex-row gap-3 mb-6">
                            <div className="relative flex-1">
                                <IoSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" />
                                <input type="text" placeholder="Buscar perdas..." value={busca} onChange={e => setBusca(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-rose-500 focus:bg-white transition-all text-slate-700 font-medium" />
                            </div>
                            <select value={filtroMotivo} onChange={e => setFiltroMotivo(e.target.value)} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer">
                                <option value="todos">Todos Motivos</option>
                                {MOTIVOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>

                        <div className="flex-1 overflow-x-auto">
                            {perdasFiltradas.length > 0 ? (
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-slate-400 font-extrabold uppercase tracking-wider">
                                            <th className="py-3 px-2">Data</th>
                                            <th className="py-3 px-2">Tipo</th>
                                            <th className="py-3 px-2">Item</th>
                                            <th className="py-3 px-2">Qtd</th>
                                            <th className="py-3 px-2">Motivo</th>
                                            <th className="py-3 px-2 text-right">Custo Total</th>
                                            <th className="py-3 px-2 text-center">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 text-slate-600 font-medium">
                                        {perdasFiltradas.map(p => (
                                            <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="py-3.5 px-2 whitespace-nowrap"><span className="flex items-center gap-1"><IoCalendarOutline /> {p.data.toLocaleDateString('pt-BR')}</span></td>
                                                <td className="py-3.5 px-2 uppercase"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.tipo === 'produto' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-violet-50 text-violet-700 border border-violet-100'}`}>{p.tipo}</span></td>
                                                <td className="py-3.5 px-2 font-bold text-slate-800">{p.nomeItem}</td>
                                                <td className="py-3.5 px-2">{p.quantidade} {p.unidade}</td>
                                                <td className="py-3.5 px-2">{MOTIVOS.find(m => m.value === p.motivo)?.label || p.motivo}</td>
                                                <td className="py-3.5 px-2 text-right font-black text-slate-800">{formatarMoeda(p.custoTotal)}</td>
                                                <td className="py-3.5 px-2 text-center">
                                                    <button onClick={() => handleExcluir(p)} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors" title="Estornar estoque e excluir">
                                                        <IoTrashOutline size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-350 py-10">
                                    <IoAlertCircle size={40} />
                                    <p className="text-sm font-bold uppercase mt-2">Nenhuma perda cadastrada</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* MODAL REGISTRAR PERDA */}
                {showForm && (
                    <div className="fixed inset-0 z-[99999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
                            {/* Header */}
                            <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white shadow-sm">
                                <h2 className="text-xl font-black text-rose-600 flex items-center gap-2">
                                    <IoTrendingDown size={22} /> Registrar Desperdício / Perda
                                </h2>
                                <button type="button" onClick={() => setShowForm(false)} className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-all">
                                    <IoClose size={22} />
                                </button>
                            </div>

                            {/* Body */}
                            <form onSubmit={handleSalvar} className="p-8 space-y-5">
                                {/* Tipo Selection */}
                                <div className="flex bg-slate-100 p-1 rounded-2xl">
                                    <button type="button" onClick={() => { setTipo('produto'); setItemId(''); }} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${tipo === 'produto' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}>
                                        <IoLayersOutline /> Produto Cardápio
                                    </button>
                                    <button type="button" onClick={() => { setTipo('insumo'); setItemId(''); }} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${tipo === 'insumo' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500'}`}>
                                        <IoFlaskOutline /> Insumo / Estoque
                                    </button>
                                </div>

                                {/* Select Item */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Selecionar Item <span className="text-red-500">*</span></label>
                                    <select value={itemId} onChange={e => setItemId(e.target.value)} required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 outline-none font-bold focus:bg-white focus:border-rose-500 cursor-pointer">
                                        <option value="">Selecione o {tipo === 'produto' ? 'Produto' : 'Insumo'}...</option>
                                        {itemsOptions.map(item => (
                                            <option key={item.id} value={item.id}>
                                                {item.name || item.nome} {item.unidade ? `(${item.unidade})` : ''} - Estoque: {item.estoque ?? item.estoqueAtual ?? 0}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Quantidade e Motivo */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Quantidade <span className="text-red-500">*</span></label>
                                        <input type="number" step="0.001" min="0.001" placeholder="0" value={quantidade} onChange={e => setQuantidade(e.target.value)} required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white focus:border-rose-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Motivo do Descarte <span className="text-red-500">*</span></label>
                                        <select value={motivo} onChange={e => setMotivo(e.target.value)} required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 font-bold focus:bg-white focus:border-rose-500 outline-none cursor-pointer">
                                            {MOTIVOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Observação */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Observações / Detalhes</label>
                                    <textarea rows="3" placeholder="Insira detalhes adicionais sobre a perda (ex: forno desligou sozinho, vencimento lote X...)" value={observacao} onChange={e => setObservacao(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 outline-none focus:bg-white focus:border-rose-500" />
                                </div>

                                {/* Footer buttons */}
                                <div className="flex gap-3 pt-4 border-t border-slate-100">
                                    <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 p-4 rounded-2xl font-bold text-slate-500 transition-all">Cancelar</button>
                                    <button type="submit" disabled={formLoading} className="flex-[2] bg-rose-600 text-white p-4 rounded-2xl font-black text-lg hover:bg-rose-700 transition-all shadow-lg flex items-center justify-center gap-2">
                                        {formLoading ? 'Salvando...' : <><IoSaveOutline /> REGISTRAR PERDA</>}
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

export default withEstablishmentAuth(RelatorioPerdas);
