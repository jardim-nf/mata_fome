import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHeader } from '../../context/HeaderContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import BackButton from '../../components/BackButton';
import { db } from '../../firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, orderBy, where } from 'firebase/firestore';
import { 
    IoStorefrontOutline, IoAddCircleOutline, IoSearch, IoClose, 
    IoDocumentTextOutline, IoGridOutline, IoSaveOutline, 
    IoCalendarOutline, IoTrashOutline, IoPencil, IoCheckmarkCircleOutline,
    IoDocumentAttachOutline, IoReceiptOutline, IoCallOutline, IoMailOutline, IoShareSocialOutline
} from 'react-icons/io5';
import { toast } from 'react-toastify';

const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
};

function GestaoCompras() {
    const { estabelecimentoIdPrincipal } = useAuth();
    const { setActions, clearActions } = useHeader();
    const estabelecimentoId = estabelecimentoIdPrincipal;

    // Tabs
    const [abaAtiva, setAbaAtiva] = useState('pedidos'); // 'fornecedores', 'cotacoes', 'pedidos'

    // Lists
    const [fornecedores, setFornecedores] = useState([]);
    const [cotacoes, setCotacoes] = useState([]);
    const [pedidos, setPedidos] = useState([]);
    const [insumos, setInsumos] = useState([]);

    // UI States
    const [loading, setLoading] = useState(true);
    const [modalFornecedor, setModalFornecedor] = useState(false);
    const [modalCotacao, setModalCotacao] = useState(false);
    const [modalPedido, setModalPedido] = useState(false);

    // Form States - Fornecedor
    const [fornEdit, setFornEdit] = useState(null);
    const [fornForm, setFornForm] = useState({ nome: '', contato: '', telefone: '', email: '', anotacoes: '' });

    // Form States - Cotação
    const [cotForm, setCotForm] = useState({ titulo: '', itens: [] }); // { insumoId, nome, quantidade, forn1Preco, forn2Preco, forn3Preco }
    const [cotForn1, setCotForn1] = useState('');
    const [cotForn2, setCotForn2] = useState('');
    const [cotForn3, setCotForn3] = useState('');

    // Form States - Pedido
    const [pedFornId, setPedFornId] = useState('');
    const [pedItens, setPedItens] = useState([]); // { insumoId, nome, quantidade, custoUnitario }

    // Load All Data
    const carregarDados = async () => {
        if (!estabelecimentoId) return;
        setLoading(true);
        try {
            // 1. Insumos
            const insSnap = await getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'insumos'));
            setInsumos(insSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.ativo !== false));

            // 2. Fornecedores
            const fornSnap = await getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'fornecedores'));
            setFornecedores(fornSnap.docs.map(d => ({ id: d.id, ...d.data() })));

            // 3. Cotações
            const cotSnap = await getDocs(query(collection(db, 'estabelecimentos', estabelecimentoId, 'cotacoes'), orderBy('data', 'desc')));
            setCotacoes(cotSnap.docs.map(d => ({ 
                id: d.id, 
                ...d.data(), 
                data: d.data().data?.toDate() || new Date(d.data().data) 
            })));

            // 4. Pedidos
            const pedSnap = await getDocs(query(collection(db, 'estabelecimentos', estabelecimentoId, 'pedidos_compra'), orderBy('data', 'desc')));
            setPedidos(pedSnap.docs.map(d => ({ 
                id: d.id, 
                ...d.data(), 
                data: d.data().data?.toDate() || new Date(d.data().data) 
            })));

        } catch (e) {
            console.error(e);
            toast.error('Erro ao carregar dados do compras.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarDados();
    }, [estabelecimentoId]);

    // Header Actions
    useEffect(() => {
        const action = (
            <div className="flex gap-2">
                {abaAtiva === 'fornecedores' && (
                    <button onClick={() => { setFornEdit(null); setFornForm({ nome: '', contato: '', telefone: '', email: '', anotacoes: '' }); setModalFornecedor(true); }} className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold py-2 px-4 rounded-xl text-sm shadow-md transition-all">
                        <IoAddCircleOutline size={18} /> Novo Fornecedor
                    </button>
                )}
                {abaAtiva === 'cotacoes' && (
                    <button onClick={() => { setCotForn1(''); setCotForn2(''); setCotForn3(''); setCotForm({ titulo: '', itens: [] }); setModalCotacao(true); }} className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold py-2 px-4 rounded-xl text-sm shadow-md transition-all">
                        <IoAddCircleOutline size={18} /> Nova Cotação
                    </button>
                )}
                {abaAtiva === 'pedidos' && (
                    <button onClick={() => { setPedFornId(''); setPedItens([]); setModalPedido(true); }} className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold py-2 px-4 rounded-xl text-sm shadow-md transition-all">
                        <IoAddCircleOutline size={18} /> Novo Pedido
                    </button>
                )}
            </div>
        );
        setActions(action);
        return () => clearActions();
    }, [abaAtiva, setActions, clearActions]);

    // Supplier operations
    const salvarFornecedor = async (e) => {
        e.preventDefault();
        if (!fornForm.nome.trim()) return toast.warning('Nome é obrigatório.');

        try {
            if (fornEdit) {
                await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'fornecedores', fornEdit.id), fornForm);
                toast.success('Fornecedor atualizado!');
            } else {
                await addDoc(collection(db, 'estabelecimentos', estabelecimentoId, 'fornecedores'), {
                    ...fornForm,
                    dataCriacao: new Date()
                });
                toast.success('Fornecedor adicionado!');
            }
            setModalFornecedor(false);
            carregarDados();
        } catch (err) {
            toast.error('Erro ao salvar fornecedor.');
        }
    };

    const excluirFornecedor = async (id) => {
        if (!window.confirm('Excluir este fornecedor?')) return;
        try {
            await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'fornecedores', id));
            toast.success('Fornecedor removido.');
            carregarDados();
        } catch (e) {
            toast.error('Erro ao excluir.');
        }
    };

    // Quotation operations
    const adicionarItemCotacao = (insumoId) => {
        if (!insumoId) return;
        const ins = insumos.find(i => i.id === insumoId);
        if (!ins) return;

        // Verifica se já está adicionado
        if (cotForm.itens.some(i => i.insumoId === insumoId)) {
            return toast.warning('Item já adicionado à cotação.');
        }

        setCotForm(prev => ({
            ...prev,
            itens: [...prev.itens, { insumoId, nome: ins.nome, unidade: ins.unidade, quantidade: 1, forn1Preco: 0, forn2Preco: 0, forn3Preco: 0 }]
        }));
    };

    const salvarCotacao = async (e) => {
        e.preventDefault();
        if (!cotForm.titulo.trim()) return toast.warning('Título é obrigatório.');
        if (cotForm.itens.length === 0) return toast.warning('Adicione itens à cotação.');

        try {
            const dataCot = {
                titulo: cotForm.titulo.trim(),
                fornecedores: [cotForn1 || 'Fornecedor A', cotForn2 || 'Fornecedor B', cotForn3 || 'Fornecedor C'],
                itens: cotForm.itens,
                data: new Date()
            };
            await addDoc(collection(db, 'estabelecimentos', estabelecimentoId, 'cotacoes'), dataCot);
            toast.success('Cotação salva com sucesso!');
            setModalCotacao(false);
            carregarDados();
        } catch (err) {
            toast.error('Erro ao salvar cotação.');
        }
    };

    const excluirCotacao = async (id) => {
        if (!window.confirm('Excluir esta planilha de cotação?')) return;
        try {
            await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'cotacoes', id));
            toast.success('Cotação removida.');
            carregarDados();
        } catch (e) {
            toast.error('Erro ao excluir.');
        }
    };

    const enviarCotacaoWhatsApp = (cot) => {
        let msg = `*Solicitação de Cotação - ${cot.titulo}*\n\nPor favor, informe seus melhores preços para os seguintes itens:\n`;
        cot.itens.forEach((it, idx) => {
            msg += `${idx + 1}. ${it.nome} - Quantidade: ${it.quantidade} ${it.unidade}\n`;
        });
        msg += `\nAgradecemos o retorno.`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
    };

    // Purchase Order operations
    const adicionarItemPedido = (insumoId) => {
        if (!insumoId) return;
        const ins = insumos.find(i => i.id === insumoId);
        if (!ins) return;

        if (pedItens.some(i => i.insumoId === insumoId)) {
            return toast.warning('Item já adicionado ao pedido.');
        }

        setPedItens(prev => [...prev, {
            insumoId,
            nome: ins.nome,
            unidade: ins.unidade,
            quantidade: 1,
            custoUnitario: Number(ins.custoUnitario || 0)
        }]);
    };

    const salvarPedido = async (e) => {
        e.preventDefault();
        if (!pedFornId) return toast.warning('Selecione um fornecedor.');
        if (pedItens.length === 0) return toast.warning('Adicione itens ao pedido.');

        try {
            const fornObj = fornecedores.find(f => f.id === pedFornId);
            const total = pedItens.reduce((acc, it) => acc + (it.quantidade * it.custoUnitario), 0);

            const docPed = {
                fornecedorId: pedFornId,
                fornecedorNome: fornObj?.nome || 'Desconhecido',
                itens: pedItens,
                total,
                status: 'Pendente',
                data: new Date()
            };

            await addDoc(collection(db, 'estabelecimentos', estabelecimentoId, 'pedidos_compra'), docPed);
            toast.success('Pedido de compra criado!');
            setModalPedido(false);
            carregarDados();
        } catch (err) {
            toast.error('Erro ao criar pedido.');
        }
    };

    // Update Status with Auto-Stock Increment on "Recebido"
    const atualizarStatusPedido = async (pedido, novoStatus) => {
        try {
            // Atualiza status do pedido
            const pedRef = doc(db, 'estabelecimentos', estabelecimentoId, 'pedidos_compra', pedido.id);
            await updateDoc(pedRef, { status: novoStatus, atualizadoEm: new Date() });

            // Se mudou para "Recebido", dá entrada automática no estoque dos insumos
            if (novoStatus === 'Recebido') {
                const promises = pedido.itens.map(async (item) => {
                    const insRef = doc(db, 'estabelecimentos', estabelecimentoId, 'insumos', item.insumoId);
                    const dbInsumo = insumos.find(i => i.id === item.insumoId);
                    
                    if (dbInsumo) {
                        const estoqueAtual = Number(dbInsumo.estoqueAtual) || 0;
                        const novoEstoque = estoqueAtual + Number(item.quantidade);
                        await updateDoc(insRef, {
                            estoqueAtual: novoEstoque,
                            custoUnitario: Number(item.custoUnitario) || dbInsumo.custoUnitario || 0,
                            atualizadoEm: new Date()
                        });
                    }
                });
                await Promise.all(promises);
                toast.success('Pedido recebido! Estoque de insumos incrementado automaticamente.');
            } else {
                toast.success(`Pedido marcado como ${novoStatus}!`);
            }

            carregarDados();
        } catch (err) {
            console.error(err);
            toast.error('Erro ao atualizar status do pedido.');
        }
    };

    const excluirPedido = async (id) => {
        if (!window.confirm('Excluir este pedido de compra?')) return;
        try {
            await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'pedidos_compra', id));
            toast.success('Pedido excluído.');
            carregarDados();
        } catch (e) {
            toast.error('Erro ao excluir.');
        }
    };

    const enviarPedidoWhatsApp = (pedido) => {
        let msg = `*Pedido de Compra - Fornecedor: ${pedido.fornecedorNome}*\n\nFavor faturar os seguintes itens:\n`;
        pedido.itens.forEach((it, idx) => {
            msg += `${idx + 1}. ${it.nome} - Qtd: ${it.quantidade} ${it.unidade} (Custo: ${formatarMoeda(it.custoUnitario)}/un)\n`;
        });
        msg += `\n*Valor Total do Pedido:* ${formatarMoeda(pedido.total)}`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
    };

    if (loading) return <div className="flex items-center justify-center min-h-screen bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div></div>;

    return (
        <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans pb-32">
            <div className="max-w-7xl mx-auto">
                <BackButton className="mb-4" />

                {/* Header */}
                <div className="mb-8 flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black text-slate-800 flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/30">
                                <IoStorefrontOutline size={24} />
                            </div>
                            Módulo de Compras & Suprimentos
                        </h1>
                        <p className="text-slate-500 mt-2 ml-[60px]">Cotações de preços de insumos, gestão de fornecedores e pedidos de compra integrados.</p>
                    </div>
                </div>

                {/* Tabs selection */}
                <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-slate-100 max-w-md mb-8">
                    <button onClick={() => setAbaAtiva('pedidos')} className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${abaAtiva === 'pedidos' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                        Pedidos de Compra
                    </button>
                    <button onClick={() => setAbaAtiva('cotacoes')} className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${abaAtiva === 'cotacoes' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                        Planilhas de Cotação
                    </button>
                    <button onClick={() => setAbaAtiva('fornecedores')} className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all ${abaAtiva === 'fornecedores' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                        Fornecedores
                    </button>
                </div>

                {/* TAB CONTENT - FORNECEDORES */}
                {abaAtiva === 'fornecedores' && (
                    <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
                        {fornecedores.length > 0 ? (
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {fornecedores.map(f => (
                                    <div key={f.id} className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col relative group">
                                        <div className="absolute right-4 top-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setFornEdit(f); setFornForm({ ...f }); setModalFornecedor(true); }} className="p-1.5 bg-white border rounded text-slate-500 hover:text-violet-600 hover:bg-violet-50 transition-colors"><IoPencil size={14} /></button>
                                            <button onClick={() => excluirFornecedor(f.id)} className="p-1.5 bg-white border rounded text-red-500 hover:bg-red-50 transition-colors"><IoTrashOutline size={14} /></button>
                                        </div>
                                        <h3 className="font-extrabold text-slate-800 text-lg mb-2 truncate pr-14">{f.nome}</h3>
                                        {f.contato && <p className="text-xs text-slate-500 font-bold mb-1">Contato: <span className="font-medium text-slate-600">{f.contato}</span></p>}
                                        {f.telefone && <p className="text-xs text-slate-500 font-bold mb-1 flex items-center gap-1"><IoCallOutline /> <span className="font-medium text-slate-600">{f.telefone}</span></p>}
                                        {f.email && <p className="text-xs text-slate-500 font-bold mb-3 flex items-center gap-1"><IoMailOutline /> <span className="font-medium text-slate-600 break-all">{f.email}</span></p>}
                                        {f.anotacoes && <div className="mt-auto bg-white p-3 rounded-xl border border-slate-100 text-[11px] text-slate-500 font-medium italic break-words">{f.anotacoes}</div>}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-20 text-center text-slate-400 font-bold flex flex-col items-center justify-center gap-3">
                                <IoStorefrontOutline size={40} />
                                <p>Nenhum fornecedor cadastrado.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB CONTENT - COTAÇÕES */}
                {abaAtiva === 'cotacoes' && (
                    <div className="space-y-6">
                        {cotacoes.length > 0 ? (
                            cotacoes.map(cot => (
                                <div key={cot.id} className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm flex flex-col">
                                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                                        <div>
                                            <h3 className="font-extrabold text-slate-800 text-lg">{cot.titulo}</h3>
                                            <p className="text-xs text-slate-400 font-bold flex items-center gap-1 mt-0.5"><IoCalendarOutline /> {cot.data.toLocaleDateString('pt-BR')}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => enviarCotacaoWhatsApp(cot)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs rounded-xl border border-emerald-100 transition-colors">
                                                <IoShareSocialOutline /> WhatsApp
                                            </button>
                                            <button onClick={() => excluirCotacao(cot.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"><IoTrashOutline size={16} /></button>
                                        </div>
                                    </div>

                                    {/* Excel Comparative Table grid */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                                            <thead>
                                                <tr className="bg-slate-50 text-slate-500 font-extrabold border border-slate-100">
                                                    <th className="p-3">Insumo</th>
                                                    <th className="p-3">Qtd / Unidade</th>
                                                    <th className="p-3 bg-violet-50/50 text-violet-800 border-x border-slate-100 text-center">{cot.fornecedores[0]}</th>
                                                    <th className="p-3 bg-blue-50/50 text-blue-800 border-x border-slate-100 text-center">{cot.fornecedores[1]}</th>
                                                    <th className="p-3 bg-indigo-50/50 text-indigo-800 border-x border-slate-100 text-center">{cot.fornecedores[2]}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                                {cot.itens.map((it, idx) => {
                                                    const p1 = Number(it.forn1Preco) || 0;
                                                    const p2 = Number(it.forn2Preco) || 0;
                                                    const p3 = Number(it.forn3Preco) || 0;

                                                    // Identifica menor preço (excluindo zeros)
                                                    const precosValidos = [p1, p2, p3].filter(p => p > 0);
                                                    const minPreco = precosValidos.length > 0 ? Math.min(...precosValidos) : 0;

                                                    return (
                                                        <tr key={idx} className="hover:bg-slate-50/40">
                                                            <td className="p-3 font-bold text-slate-800">{it.nome}</td>
                                                            <td className="p-3">{it.quantidade} {it.unidade}</td>
                                                            
                                                            {/* Fornecedor 1 */}
                                                            <td className={`p-3 text-center border-x border-slate-100 ${p1 === minPreco && p1 > 0 ? 'bg-emerald-50 text-emerald-700 font-black' : ''}`}>
                                                                {p1 > 0 ? formatarMoeda(p1) : '—'}
                                                            </td>
                                                            
                                                            {/* Fornecedor 2 */}
                                                            <td className={`p-3 text-center border-x border-slate-100 ${p2 === minPreco && p2 > 0 ? 'bg-emerald-50 text-emerald-700 font-black' : ''}`}>
                                                                {p2 > 0 ? formatarMoeda(p2) : '—'}
                                                            </td>
                                                            
                                                            {/* Fornecedor 3 */}
                                                            <td className={`p-3 text-center border-x border-slate-100 ${p3 === minPreco && p3 > 0 ? 'bg-emerald-50 text-emerald-700 font-black' : ''}`}>
                                                                {p3 > 0 ? formatarMoeda(p3) : '—'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="bg-white rounded-[2rem] border border-slate-100 p-10 text-center text-slate-400 font-bold flex flex-col items-center justify-center gap-3">
                                <IoReceiptOutline size={40} />
                                <p>Nenhuma planilha de cotação criada.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB CONTENT - PEDIDOS DE COMPRA */}
                {abaAtiva === 'pedidos' && (
                    <div className="space-y-6">
                        {pedidos.length > 0 ? (
                            pedidos.map(ped => {
                                let statusBg = 'bg-slate-100 text-slate-600 border-slate-200';
                                if (ped.status === 'Enviado') statusBg = 'bg-blue-50 text-blue-700 border-blue-100';
                                else if (ped.status === 'Recebido') statusBg = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                                else if (ped.status === 'Cancelado') statusBg = 'bg-red-50 text-red-700 border-red-100';

                                return (
                                    <div key={ped.id} className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
                                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4 pb-3 border-b border-slate-100">
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="font-extrabold text-slate-800 text-base">{ped.fornecedorNome}</h3>
                                                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${statusBg}`}>{ped.status}</span>
                                                </div>
                                                <p className="text-xs text-slate-400 font-bold flex items-center gap-1 mt-0.5"><IoCalendarOutline /> {ped.data.toLocaleDateString('pt-BR')}</p>
                                            </div>
                                            <div className="flex gap-2 items-center flex-wrap">
                                                {ped.status === 'Pendente' && (
                                                    <button onClick={() => atualizarStatusPedido(ped, 'Enviado')} className="px-3 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition-colors">Marcar Enviado</button>
                                                )}
                                                {ped.status === 'Enviado' && (
                                                    <button onClick={() => atualizarStatusPedido(ped, 'Recebido')} className="px-3 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition-colors">Marcar Recebido (Estoque+)</button>
                                                )}
                                                {ped.status !== 'Recebido' && ped.status !== 'Cancelado' && (
                                                    <button onClick={() => atualizarStatusPedido(ped, 'Cancelado')} className="px-3 py-1.5 bg-red-100 text-red-600 font-bold text-xs rounded-xl hover:bg-red-200 transition-colors">Cancelar</button>
                                                )}
                                                <button onClick={() => enviarPedidoWhatsApp(ped)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors" title="Enviar Pedido via WhatsApp"><IoShareSocialOutline size={18} /></button>
                                                <button onClick={() => excluirPedido(ped.id)} className="p-2 text-red-500 hover:bg-red-55 rounded-xl transition-colors"><IoTrashOutline size={16} /></button>
                                            </div>
                                        </div>

                                        <ul className="divide-y divide-slate-50 text-xs font-medium text-slate-600 mb-3 max-w-xl">
                                            {ped.itens.map((it, idx) => (
                                                <li key={idx} className="py-2 flex justify-between">
                                                    <span>{it.nome} ({it.quantidade} {it.unidade})</span>
                                                    <span className="font-bold text-slate-700">{formatarMoeda(it.custoUnitario)}/un - <strong className="text-slate-800">{formatarMoeda(it.quantidade * it.custoUnitario)}</strong></span>
                                                </li>
                                            ))}
                                        </ul>
                                        
                                        <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-sm">
                                            <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Custo Total:</span>
                                            <span className="font-black text-slate-800 text-lg">{formatarMoeda(ped.total)}</span>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="bg-white rounded-[2rem] border border-slate-100 p-10 text-center text-slate-400 font-bold flex flex-col items-center justify-center gap-3">
                                <IoDocumentTextOutline size={40} />
                                <p>Nenhum pedido de compra registrado.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* MODAL SUPPLIER FORM */}
                {modalFornecedor && (
                    <div className="fixed inset-0 z-[99999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
                            <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white shadow-sm">
                                <h2 className="text-lg font-black text-violet-600 flex items-center gap-2">
                                    <IoStorefrontOutline size={22} /> {fornEdit ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                                </h2>
                                <button type="button" onClick={() => setModalFornecedor(false)} className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-all"><IoClose size={22} /></button>
                            </div>
                            <form onSubmit={salvarFornecedor} className="p-8 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Razão Social / Nome <span className="text-red-500">*</span></label>
                                    <input type="text" value={fornForm.nome} onChange={e => setFornForm({ ...fornForm, nome: e.target.value })} required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white focus:border-violet-500 outline-none" placeholder="Ex: Atacadão Distribuidora" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Pessoa de Contato</label>
                                    <input type="text" value={fornForm.contato} onChange={e => setFornForm({ ...fornForm, contato: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 focus:bg-white focus:border-violet-500 outline-none" placeholder="Ex: Roberto Vendedor" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Telefone / WhatsApp</label>
                                        <input type="text" value={fornForm.telefone} onChange={e => setFornForm({ ...fornForm, telefone: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 focus:bg-white focus:border-violet-500 outline-none" placeholder="(00) 00000-0000" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email</label>
                                        <input type="email" value={fornForm.email} onChange={e => setFornForm({ ...fornForm, email: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 focus:bg-white focus:border-violet-500 outline-none" placeholder="email@provedor.com" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Anotações Internas</label>
                                    <textarea rows="2" value={fornForm.anotacoes} onChange={e => setFornForm({ ...fornForm, anotacoes: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 focus:bg-white focus:border-violet-500 outline-none" placeholder="Ex: Entrega às terças e quintas. Mínimo R$ 500." />
                                </div>
                                <button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white p-4 rounded-2xl font-black text-lg shadow-lg flex items-center justify-center gap-2"><IoSaveOutline /> SALVAR</button>
                            </form>
                        </div>
                    </div>
                )}

                {/* MODAL QUOTATION FORM */}
                {modalCotacao && (
                    <div className="fixed inset-0 z-[99999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-0 md:p-6 animate-fade-in">
                        <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-3xl md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
                            <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white shadow-sm">
                                <h2 className="text-xl font-black text-violet-600 flex items-center gap-2"><IoDocumentAttachOutline /> Criar Cotação Comparativa</h2>
                                <button type="button" onClick={() => setModalCotacao(false)} className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-all"><IoClose size={22} /></button>
                            </div>
                            <form onSubmit={salvarCotacao} className="flex-1 overflow-y-auto p-8 space-y-6">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Título / Identificação <span className="text-red-500">*</span></label>
                                        <input type="text" value={cotForm.titulo} onChange={e => setCotForm({ ...cotForm, titulo: e.target.value })} required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white focus:border-violet-500 outline-none" placeholder="Ex: Cotação de Frios Junho" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Selecionar Insumo para Adicionar</label>
                                        <select onChange={e => { adicionarItemCotacao(e.target.value); e.target.value = ''; }} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 font-bold focus:bg-white focus:border-violet-500 outline-none cursor-pointer">
                                            <option value="">Clique para adicionar um insumo à lista...</option>
                                            {insumos.map(i => <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Nomes dos Fornecedores na cotação */}
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/50 space-y-3">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Nomes dos Fornecedores Participantes (Opcional)</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <input type="text" value={cotForn1} onChange={e => setCotForn1(e.target.value)} className="p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-violet-500" placeholder="Forn. A" />
                                        <input type="text" value={cotForn2} onChange={e => setCotForn2(e.target.value)} className="p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-violet-500" placeholder="Forn. B" />
                                        <input type="text" value={cotForn3} onChange={e => setCotForn3(e.target.value)} className="p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-violet-500" placeholder="Forn. C" />
                                    </div>
                                </div>

                                {/* Grid de digitação de preços cotação */}
                                {cotForm.itens.length > 0 && (
                                    <div className="space-y-4">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Planilha de Preços</label>
                                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                                            {cotForm.itens.map((it, idx) => (
                                                <div key={idx} className="p-4 grid md:grid-cols-12 gap-3 items-center hover:bg-white transition-colors">
                                                    <div className="md:col-span-4">
                                                        <span className="font-bold text-slate-800 text-sm">{it.nome}</span>
                                                        <span className="text-[10px] text-slate-400 block font-bold">Unidade: {it.unidade}</span>
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <input type="number" step="0.01" value={it.quantidade} onChange={e => {
                                                            const n = [...cotForm.itens]; n[idx].quantidade = parseFloat(e.target.value) || 0;
                                                            setCotForm({ ...cotForm, itens: n });
                                                        }} className="w-full p-2 bg-white border rounded-xl text-center text-xs font-bold" placeholder="Qtd" />
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <input type="number" step="0.01" value={it.forn1Preco || ''} onChange={e => {
                                                            const n = [...cotForm.itens]; n[idx].forn1Preco = parseFloat(e.target.value) || 0;
                                                            setCotForm({ ...cotForm, itens: n });
                                                        }} className="w-full p-2 bg-white border rounded-xl text-center text-xs font-bold text-violet-700" placeholder="Preço A" />
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <input type="number" step="0.01" value={it.forn2Preco || ''} onChange={e => {
                                                            const n = [...cotForm.itens]; n[idx].forn2Preco = parseFloat(e.target.value) || 0;
                                                            setCotForm({ ...cotForm, itens: n });
                                                        }} className="w-full p-2 bg-white border rounded-xl text-center text-xs font-bold text-blue-700" placeholder="Preço B" />
                                                    </div>
                                                    <div className="md:col-span-2 flex items-center gap-1">
                                                        <input type="number" step="0.01" value={it.forn3Preco || ''} onChange={e => {
                                                            const n = [...cotForm.itens]; n[idx].forn3Preco = parseFloat(e.target.value) || 0;
                                                            setCotForm({ ...cotForm, itens: n });
                                                        }} className="w-full p-2 bg-white border rounded-xl text-center text-xs font-bold text-indigo-700" placeholder="Preço C" />
                                                        <button type="button" onClick={() => setCotForm(prev => ({ ...prev, itens: prev.itens.filter((_, i) => i !== idx) }))} className="text-red-500 hover:text-red-700 p-1 font-bold">✕</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white p-4 rounded-2xl font-black text-lg shadow-lg flex items-center justify-center gap-2"><IoSaveOutline /> SALVAR COTAÇÃO</button>
                            </form>
                        </div>
                    </div>
                )}

                {/* MODAL PURCHASE ORDER FORM */}
                {modalPedido && (
                    <div className="fixed inset-0 z-[99999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-0 md:p-6 animate-fade-in">
                        <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
                            <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white shadow-sm">
                                <h2 className="text-xl font-black text-violet-600 flex items-center gap-2"><IoDocumentTextOutline /> Criar Pedido de Compra</h2>
                                <button type="button" onClick={() => setModalPedido(false)} className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-all"><IoClose size={22} /></button>
                            </div>
                            <form onSubmit={salvarPedido} className="flex-1 overflow-y-auto p-8 space-y-6">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Selecionar Fornecedor <span className="text-red-500">*</span></label>
                                        <select value={pedFornId} onChange={e => setPedFornId(e.target.value)} required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 font-bold focus:bg-white focus:border-violet-500 outline-none cursor-pointer">
                                            <option value="">Selecione o Fornecedor...</option>
                                            {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Adicionar Insumo ao Pedido</label>
                                        <select onChange={e => { adicionarItemPedido(e.target.value); e.target.value = ''; }} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 font-bold focus:bg-white focus:border-violet-500 outline-none cursor-pointer">
                                            <option value="">Clique para adicionar um insumo...</option>
                                            {insumos.map(i => <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Listagem de Itens e quantidade/preço pedido */}
                                {pedItens.length > 0 && (
                                    <div className="space-y-3">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Itens do Pedido</label>
                                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                                            {pedItens.map((it, idx) => (
                                                <div key={idx} className="p-4 grid md:grid-cols-12 gap-3 items-center hover:bg-white transition-colors">
                                                    <div className="md:col-span-5">
                                                        <span className="font-bold text-slate-800 text-sm">{it.nome}</span>
                                                        <span className="text-[10px] text-slate-400 block font-bold">Unidade: {it.unidade}</span>
                                                    </div>
                                                    <div className="md:col-span-3">
                                                        <label className="block text-[8px] text-slate-400 uppercase font-black">Quantidade</label>
                                                        <input type="number" step="0.01" value={it.quantity || ''} onChange={e => {
                                                            const n = [...pedItens]; n[idx].quantidade = parseFloat(e.target.value) || 0;
                                                            setPedItens(n);
                                                        }} className="w-full p-2 bg-slate-50 border rounded-xl text-center text-xs font-bold text-slate-800" placeholder="Qtd" />
                                                    </div>
                                                    <div className="md:col-span-3">
                                                        <label className="block text-[8px] text-slate-400 uppercase font-black">Preço Unitário (R$)</label>
                                                        <input type="number" step="0.01" value={it.custoUnitario || ''} onChange={e => {
                                                            const n = [...pedItens]; n[idx].custoUnitario = parseFloat(e.target.value) || 0;
                                                            setPedItens(n);
                                                        }} className="w-full p-2 bg-slate-50 border rounded-xl text-center text-xs font-bold text-slate-800" placeholder="R$ 0,00" />
                                                    </div>
                                                    <div className="md:col-span-1 text-center">
                                                        <button type="button" onClick={() => setPedItens(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 font-bold">✕</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="bg-violet-50 p-4 rounded-2xl flex justify-between items-center border border-violet-100 text-sm">
                                            <span className="font-bold text-violet-700 uppercase text-[10px] tracking-wider">Custo Previsto do Pedido:</span>
                                            <span className="font-black text-violet-700 text-lg">
                                                {formatarMoeda(pedItens.reduce((acc, it) => acc + (it.quantidade * it.custoUnitario), 0))}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <button type="submit" className="w-full bg-violet-600 hover:bg-violet-700 text-white p-4 rounded-2xl font-black text-lg shadow-lg flex items-center justify-center gap-2"><IoSaveOutline /> CRIAR PEDIDO</button>
                            </form>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

export default withEstablishmentAuth(GestaoCompras);
