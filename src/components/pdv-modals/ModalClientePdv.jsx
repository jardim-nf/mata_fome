import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, doc, getDocs, setDoc, query, limit, where } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { IoClose, IoSearch, IoPersonAddOutline, IoPeopleOutline, IoMailOutline, IoCallOutline, IoCardOutline, IoLocationOutline, IoTimeOutline, IoArrowBackOutline, IoBagCheckOutline } from 'react-icons/io5';

const ModalClientePdv = ({ visivel, estabelecimentoId, onClose, onSelectCliente }) => {
    const [ativaTab, setAtivaTab] = useState('buscar'); // 'buscar' | 'cadastrar'
    
    // States para Busca
    const [clientes, setClientes] = useState([]);
    const [busca, setBusca] = useState('');
    const [carregando, setCarregando] = useState(false);

    // States para Cadastro
    const [nome, setNome] = useState('');
    const [telefone, setTelefone] = useState('');
    const [cpf, setCpf] = useState('');
    const [email, setEmail] = useState('');
    const [rua, setRua] = useState('');
    const [numero, setNumero] = useState('');
    const [bairro, setBairro] = useState('');
    const [cidade, setCidade] = useState('');
    const [referencia, setReferencia] = useState('');
    const [salvando, setSalvando] = useState(false);

    // States para Histórico de Compras do Cliente
    const [clienteParaHistorico, setClienteParaHistorico] = useState(null);
    const [vendasHistorico, setVendasHistorico] = useState([]);
    const [carregandoHistorico, setCarregandoHistorico] = useState(false);

    const carregarHistoricoCliente = async (cliente) => {
        setCarregandoHistorico(true);
        setClienteParaHistorico(cliente);
        setVendasHistorico([]);
        try {
            const q = query(
                collection(db, 'vendas'),
                where('estabelecimentoId', '==', estabelecimentoId),
                where('clienteId', '==', cliente.id)
            );
            const snap = await getDocs(q);
            const list = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date())
                };
            });
            // Ordenar localmente decrescente pela data de criação
            list.sort((a, b) => b.createdAt - a.createdAt);
            setVendasHistorico(list.slice(0, 10));
        } catch (e) {
            console.error("Erro ao carregar histórico do cliente:", e);
            toast.error("Erro ao carregar histórico de compras.");
        } finally {
            setCarregandoHistorico(false);
        }
    };

    // Carregar clientes do estabelecimento ao abrir modal
    useEffect(() => {
        if (visivel && estabelecimentoId) {
            const carregarClientes = async () => {
                setCarregando(true);
                try {
                    const q = query(collection(db, 'estabelecimentos', estabelecimentoId, 'clientes'));
                    const snap = await getDocs(q);
                    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    // Ordenar por nome
                    list.sort((a,b) => (a.nome || '').localeCompare(b.nome || ''));
                    setClientes(list);
                } catch (e) {
                    console.error("Erro ao carregar clientes no PDV:", e);
                    toast.error("Erro ao carregar lista de clientes.");
                } finally {
                    setCarregando(false);
                }
            };
            carregarClientes();
            // Reset state
            setAtivaTab('buscar');
            setBusca('');
            setNome('');
            setTelefone('');
            setCpf('');
            setEmail('');
            setRua('');
            setNumero('');
            setBairro('');
            setCidade('');
            setReferencia('');
            setClienteParaHistorico(null);
            setVendasHistorico([]);
            setCarregandoHistorico(false);
        }
    }, [visivel, estabelecimentoId]);

    // Filtrar clientes localmente com normalização de acentos e telefone/CPF
    const clientesFiltrados = useMemo(() => {
        const t = busca.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        if (!t) return clientes.slice(0, 150); // limit local view for performance
        
        const tPhone = t.replace(/\D/g, '');

        return clientes.filter(c => {
            const nomeClean = (c.nome || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const telClean = (c.telefone || '').replace(/\D/g, '');
            const cpfClean = (c.cpf || '').replace(/\D/g, '');
            const emailClean = (c.email || '').toLowerCase();

            return nomeClean.includes(t) ||
                   (tPhone && telClean.includes(tPhone)) ||
                   (tPhone && cpfClean.includes(tPhone)) ||
                   emailClean.includes(t);
        });
    }, [clientes, busca]);

    const handleSalvarCliente = async (e) => {
        e.preventDefault();
        if (!nome.trim() || !telefone.trim()) {
            toast.warn("Nome e Telefone são obrigatórios!");
            return;
        }

        const cleanPhone = telefone.replace(/\D/g, '');
        const cleanCpf = cpf.replace(/\D/g, '');

        if (cleanPhone.length < 8) {
            toast.warn("Por favor, digite um telefone válido.");
            return;
        }

        setSalvando(true);
        try {
            const clientData = {
                id: cleanPhone,
                nome: nome.toUpperCase().trim(),
                telefone: cleanPhone,
                cpf: cleanCpf || null,
                email: email.trim() || null,
                endereco: {
                    rua: rua.toUpperCase().trim() || '',
                    numero: numero.trim() || '',
                    bairro: bairro.toUpperCase().trim() || '',
                    cidade: cidade.toUpperCase().trim() || '',
                    referencia: referencia.toUpperCase().trim() || ''
                },
                saldoCashback: 0,
                fidelidade: { carimbos: 0, premioDisponivel: false, cartelasCompletadas: 0 },
                criadoEm: new Date()
            };

            // 1. Salvar no sub-relacionamento do Estabelecimento
            await setDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'clientes', cleanPhone), clientData);

            // 2. Salvar no diretório global de clientes
            await setDoc(doc(db, 'clientes', cleanPhone), {
                nome: clientData.nome,
                telefone: clientData.telefone,
                cpf: clientData.cpf,
                email: clientData.email,
                endereco: clientData.endereco,
                criadoEm: clientData.criadoEm
            });

            toast.success("Cliente cadastrado com sucesso!");
            onSelectCliente(clientData);
            onClose();
        } catch (err) {
            console.error("Erro ao cadastrar cliente no PDV:", err);
            toast.error("Erro ao salvar cadastro do cliente.");
        } finally {
            setSalvando(false);
        }
    };

    if (!visivel) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9500] p-4 backdrop-blur-sm animate-fadeIn no-print">
            <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] transform animate-slideUp overflow-hidden relative">
                {/* Visual Header Line */}
                <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-500 shrink-0"></div>

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-55 shrink-0">
                    <div>
                        <h3 className="font-extrabold text-xl text-slate-800 flex items-center gap-2">
                            <IoPeopleOutline className="text-emerald-500" />
                            Painel de Clientes
                        </h3>
                        <p className="text-slate-500 text-xs font-medium">Cadastre ou selecione um cliente para a venda atual</p>
                    </div>
                    <button onClick={onClose} className="bg-slate-100 p-2 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                        <IoClose size={20} />
                    </button>
                </div>

                {/* Tabs */}
                {!clienteParaHistorico && (
                    <div className="flex border-b border-slate-100 bg-slate-50/50 shrink-0">
                        <button
                            onClick={() => setAtivaTab('buscar')}
                            className={`flex-1 py-3.5 text-xs font-bold transition-all flex items-center justify-center gap-2 border-b-2 ${ativaTab === 'buscar' ? 'border-emerald-500 text-emerald-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                        >
                            <IoSearch size={16} /> BUSCAR CLIENTE
                        </button>
                        <button
                            onClick={() => setAtivaTab('cadastrar')}
                            className={`flex-1 py-3.5 text-xs font-bold transition-all flex items-center justify-center gap-2 border-b-2 ${ativaTab === 'cadastrar' ? 'border-emerald-500 text-emerald-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                        >
                            <IoPersonAddOutline size={16} /> CADASTRAR NOVO
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-white">
                    {clienteParaHistorico ? (
                        <div className="flex flex-col h-full space-y-5 animate-fadeIn">
                            {/* Sub-Header / Back action */}
                            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between border-b border-slate-100 pb-3.5 shrink-0">
                                <button
                                    onClick={() => setClienteParaHistorico(null)}
                                    className="flex items-center justify-center gap-1.5 text-slate-600 hover:text-slate-900 text-xs font-extrabold transition-all bg-slate-50 hover:bg-slate-100 px-3.5 py-2.5 rounded-xl border border-slate-200"
                                >
                                    <IoArrowBackOutline size={16} /> VOLTAR PARA BUSCA
                                </button>
                                <button
                                    onClick={() => { onSelectCliente(clienteParaHistorico); onClose(); }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4.5 py-2.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                >
                                    SELECIONAR ESTE CLIENTE
                                </button>
                            </div>

                            {/* Client details card */}
                            <div className="bg-slate-55 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                                <p className="font-extrabold text-slate-800 text-sm uppercase">{clienteParaHistorico.nome}</p>
                                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-slate-500 text-xs font-semibold">
                                    <span className="flex items-center gap-1.5"><IoCallOutline size={14} className="text-slate-400" /> {clienteParaHistorico.telefone}</span>
                                    {clienteParaHistorico.cpf && <span className="flex items-center gap-1.5"><IoCardOutline size={14} className="text-slate-400" /> CPF: {clienteParaHistorico.cpf}</span>}
                                    {clienteParaHistorico.email && <span className="flex items-center gap-1.5"><IoMailOutline size={14} className="text-slate-400" /> {clienteParaHistorico.email}</span>}
                                </div>
                                {clienteParaHistorico.endereco?.rua && (
                                    <p className="text-slate-400 text-xs font-medium flex items-center gap-1.5 pt-1.5 border-t border-slate-200/50">
                                        <IoLocationOutline size={13} className="text-slate-350 shrink-0" />
                                        <span>{clienteParaHistorico.endereco.rua}, {clienteParaHistorico.endereco.numero} - {clienteParaHistorico.endereco.bairro}</span>
                                    </p>
                                )}
                            </div>

                            {/* Sales List header */}
                            <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                                <IoBagCheckOutline className="text-emerald-500" size={16} /> Últimas 10 Compras no PDV
                            </h4>

                            {/* Sales List container */}
                            <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-[220px] max-h-[380px] pdv-scroll">
                                {carregandoHistorico ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-emerald-600"></div>
                                        <span className="text-xs font-bold">Buscando histórico...</span>
                                    </div>
                                ) : vendasHistorico.length === 0 ? (
                                    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                                        <p className="text-slate-400 text-sm font-semibold">Nenhuma compra registrada para este cliente.</p>
                                    </div>
                                ) : (
                                    vendasHistorico.map((venda) => (
                                        <div key={venda.id} className="border border-slate-200 rounded-2xl bg-white hover:border-slate-350 transition-all p-4 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase">PEDIDO #{venda.id.slice(-6).toUpperCase()}</span>
                                                    <p className="text-xs font-bold text-slate-500 mt-0.5">
                                                        {venda.createdAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg px-2.5 py-1 text-xs font-black">
                                                        R$ {parseFloat(venda.total || 0).toFixed(2)}
                                                    </span>
                                                    <p className="text-[10px] text-slate-400 font-semibold mt-1">
                                                        Pág: <span className="uppercase">{venda.formaPagamento || 'Outro'}</span>
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Itens list */}
                                            <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-2.5 space-y-1.5">
                                                {venda.itens?.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center text-xs text-slate-600 font-semibold">
                                                        <span className="truncate max-w-[70%]">
                                                            <span className="text-[10px] text-slate-400 font-bold mr-1">{item.quantity}x</span> {item.name}
                                                        </span>
                                                        <span className="text-slate-500 font-mono text-[11px]">
                                                            R$ {parseFloat((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ) : ativaTab === 'buscar' ? (
                        <div className="flex flex-col h-full space-y-4">
                            {/* Search bar */}
                            <div className="relative w-full shrink-0">
                                <IoSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg" />
                                <input
                                    type="text"
                                    placeholder="Digite nome, telefone, e-mail ou CPF..."
                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all placeholder-slate-400"
                                    value={busca}
                                    onChange={e => setBusca(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            {/* Clients List */}
                            <div className="flex-1 min-h-[250px] overflow-y-auto pr-1 space-y-2.5">
                                {carregando ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-emerald-600"></div>
                                        <span className="text-xs font-bold">Carregando clientes...</span>
                                    </div>
                                ) : clientesFiltrados.length === 0 ? (
                                    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                                        <p className="text-slate-400 text-sm font-semibold">Nenhum cliente cadastrado ou encontrado.</p>
                                        <button
                                            onClick={() => setAtivaTab('cadastrar')}
                                            className="mt-3 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-xs font-bold px-4 py-2.5 rounded-lg border border-emerald-250 transition-all"
                                        >
                                            + Cadastrar Primeiro Cliente
                                        </button>
                                    </div>
                                ) : (
                                    clientesFiltrados.map(c => (
                                        <div
                                            key={c.id}
                                            className="bg-slate-50/50 hover:bg-slate-50 border border-slate-200 hover:border-emerald-400 p-4 rounded-2xl flex items-center justify-between gap-4 transition-all"
                                        >
                                            <div className="min-w-0 flex-1 space-y-1">
                                                <p className="font-extrabold text-slate-800 text-sm truncate uppercase">{c.nome}</p>
                                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-500 text-xs font-semibold">
                                                    <span className="flex items-center gap-1.5"><IoCallOutline size={13} className="text-slate-400" /> {c.telefone}</span>
                                                    {c.cpf && <span className="flex items-center gap-1.5"><IoCardOutline size={13} className="text-slate-400" /> CPF: {c.cpf}</span>}
                                                    {c.email && <span className="flex items-center gap-1.5"><IoMailOutline size={13} className="text-slate-400" /> {c.email}</span>}
                                                </div>
                                                {c.endereco?.rua && (
                                                    <p className="text-slate-400 text-[11px] font-medium flex items-center gap-1.5 truncate">
                                                        <IoLocationOutline size={12} className="text-slate-350 shrink-0" />
                                                        <span className="truncate">{c.endereco.rua}, {c.endereco.numero} - {c.endereco.bairro}</span>
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-2 shrink-0 items-stretch sm:items-center">
                                                <button
                                                    onClick={() => carregarHistoricoCliente(c)}
                                                    className="bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-extrabold text-[10px] sm:text-xs px-3 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1 active:scale-95 border border-slate-200/50"
                                                >
                                                    <IoTimeOutline size={14} className="text-slate-500" />
                                                    HISTÓRICO
                                                </button>
                                                <button
                                                    onClick={() => { onSelectCliente(c); onClose(); }}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] sm:text-xs px-3.5 py-2.5 rounded-xl shadow-md transition-all shrink-0 active:scale-95"
                                                >
                                                    SELECIONAR
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSalvarCliente} className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nome Completo <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-emerald-450 transition-all uppercase"
                                        placeholder="Ex: JOÃO DA SILVA"
                                        value={nome}
                                        onChange={e => setNome(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Telefone (WhatsApp) <span className="text-red-500">*</span></label>
                                    <input
                                        type="tel"
                                        required
                                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-emerald-450 transition-all"
                                        placeholder="Ex: (11) 98765-4321"
                                        value={telefone}
                                        onChange={e => setTelefone(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">CPF (Opcional)</label>
                                    <input
                                        type="text"
                                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-emerald-450 transition-all font-mono"
                                        placeholder="000.000.000-00"
                                        value={cpf}
                                        onChange={e => setCpf(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">E-mail (Opcional)</label>
                                    <input
                                        type="email"
                                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-emerald-450 transition-all"
                                        placeholder="Ex: joao@email.com"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Endereço Title */}
                            <div className="border-t border-slate-100 pt-4">
                                <h4 className="text-sm font-extrabold text-slate-700 flex items-center gap-1.5 mb-4">
                                    <IoLocationOutline className="text-emerald-500" />
                                    Endereço do Cliente
                                </h4>
                                <div className="grid grid-cols-12 gap-4">
                                    <div className="col-span-8 md:col-span-9">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Rua / Logradouro</label>
                                        <input
                                            type="text"
                                            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-emerald-450 transition-all uppercase"
                                            placeholder="Ex: RUA DAS FLORES"
                                            value={rua}
                                            onChange={e => setRua(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-4 md:col-span-3">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Número</label>
                                        <input
                                            type="text"
                                            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-emerald-450 transition-all"
                                            placeholder="123"
                                            value={numero}
                                            onChange={e => setNumero(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-6">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Bairro</label>
                                        <input
                                            type="text"
                                            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-emerald-450 transition-all uppercase"
                                            placeholder="Ex: CENTRO"
                                            value={bairro}
                                            onChange={e => setBairro(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-6">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Cidade</label>
                                        <input
                                            type="text"
                                            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-emerald-450 transition-all uppercase"
                                            placeholder="Ex: SÃO PAULO"
                                            value={cidade}
                                            onChange={e => setCidade(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-12">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Complemento / Ponto de Referência</label>
                                        <input
                                            type="text"
                                            className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-emerald-450 transition-all uppercase"
                                            placeholder="Ex: PRÓXIMO AO MERCADO X"
                                            value={referencia}
                                            onChange={e => setReferencia(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={salvando}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-4.5 rounded-2xl font-black text-base shadow-lg transition-all flex justify-center items-center gap-2 active:scale-95 disabled:opacity-50"
                            >
                                {salvando ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                        CADASTRANDO...
                                    </>
                                ) : (
                                    "SALVAR E SELECIONAR"
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ModalClientePdv;
