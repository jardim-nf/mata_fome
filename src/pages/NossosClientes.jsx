import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { toast } from 'react-toastify';
import { 
  IoClose, IoSearch, IoPersonAddOutline, IoPeopleOutline, 
  IoMailOutline, IoCallOutline, IoCardOutline, IoLocationOutline, 
  IoChevronBackOutline, IoChevronForwardOutline, IoCreateOutline, 
  IoTrashOutline, IoLogoWhatsapp, IoArrowBackOutline, IoWalletOutline 
} from 'react-icons/io5';

function NossosClientes({ estabelecimentoPrincipal }) {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const estabelecimentoId = estabelecimentoPrincipal;

    // Listagem e busca
    const [clientes, setClientes] = useState([]);
    const [busca, setBusca] = useState('');
    const [carregando, setCarregando] = useState(true);
    const [estabelecimentoNome, setEstabelecimentoNome] = useState('Seu Estabelecimento');

    // Modais
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [clienteSelecionado, setClienteSelecionado] = useState(null);

    // Form fields
    const [nome, setNome] = useState('');
    const [telefone, setTelefone] = useState('');
    const [cpf, setCpf] = useState('');
    const [email, setEmail] = useState('');
    const [limiteCrediario, setLimiteCrediario] = useState('0');
    const [nascimento, setNascimento] = useState('');
    
    // Address fields (object)
    const [cep, setCep] = useState('');
    const [rua, setRua] = useState('');
    const [numero, setNumero] = useState('');
    const [bairro, setBairro] = useState('');
    const [cidade, setCidade] = useState('');
    const [uf, setUf] = useState('');
    const [referencia, setReferencia] = useState('');

    // B2B fields
    const [inscricaoEstadual, setInscricaoEstadual] = useState('');
    const [indicadorIe, setIndicadorIe] = useState('9'); // 9=Não contribuinte, 1=Contribuinte, 2=Isento

    const [isFetchingCnpj, setIsFetchingCnpj] = useState(false);

    // Consulta CNPJ na Brasil API
    const handleCpfCnpjChange = async (val) => {
        const raw = val.replace(/\D/g, '');
        setCpf(raw);

        if (raw.length === 14) {
            setIsFetchingCnpj(true);
            try {
                const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${raw}`);
                if (res.ok) {
                    const data = await res.json();
                    setNome(data.razao_social || data.nome_fantasia || '');
                    setCep(data.cep ? data.cep.replace(/\D/g, '') : '');
                    setRua(data.logradouro || '');
                    setNumero(data.numero || '');
                    setBairro(data.bairro || '');
                    setCidade(data.municipio || '');
                    setUf(data.uf || '');
                    if (data.email) setEmail(data.email);
                    if (data.ddd_telefone_1) setTelefone(data.ddd_telefone_1.replace(/\D/g, ''));
                    toast.success("Dados preenchidos via Receita Federal!");
                } else {
                    toast.warn("CNPJ não encontrado na base de dados.");
                }
            } catch (error) {
                toast.error("Erro ao consultar CNPJ.");
            } finally {
                setIsFetchingCnpj(false);
            }
        }
    };

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    // Busca o nome do estabelecimento
    useEffect(() => {
        const fetchEstabelecimentoInfo = async () => {
            if (!estabelecimentoId) return;
            try {
                const docRef = doc(db, "estabelecimentos", estabelecimentoId);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setEstabelecimentoNome(snap.data().nome || 'Seu Estabelecimento');
                }
            } catch (error) {
                console.error("Erro ao buscar dados do estabelecimento:", error);
            }
        };
        fetchEstabelecimentoInfo();
    }, [estabelecimentoId]);

    // Carregar todos os clientes do estabelecimento
    const carregarClientes = useCallback(async () => {
        if (!estabelecimentoId) return;
        setCarregando(true);
        try {
            const colRef = collection(db, 'estabelecimentos', estabelecimentoId, 'clientes');
            const snap = await getDocs(colRef);
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            // Ordena alfabeticamente por nome
            list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
            setClientes(list);
        } catch (error) {
            console.error("Erro ao buscar clientes:", error);
            toast.error("Erro ao carregar lista de clientes.");
        } finally {
            setCarregando(false);
        }
    }, [estabelecimentoId]);

    useEffect(() => {
        carregarClientes();
    }, [carregarClientes]);

    // Formatar exibição do endereço (string ou object)
    const formatAddress = (endereco) => {
        if (!endereco) return 'Não informado';
        if (typeof endereco === 'string') return endereco;
        const parts = [
            endereco.rua,
            endereco.numero && `nº ${endereco.numero}`,
            endereco.bairro,
            endereco.cidade
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : 'Não informado';
    };

    // Filtragem local com normalização de acentos e telefone/CPF
    const clientesFiltrados = useMemo(() => {
        const t = busca.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        if (!t) return clientes;
        
        const tPhone = t.replace(/\D/g, '');

        return clientes.filter(c => {
            const nomeClean = (c.nome || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            const telClean = (c.telefone || '').replace(/\D/g, '');
            const cpfClean = (c.cpf || '').replace(/\D/g, '');
            const emailClean = (c.email || '').toLowerCase();

            let matchesAddress = false;
            if (typeof c.endereco === 'string') {
                matchesAddress = c.endereco.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(t);
            } else if (c.endereco && typeof c.endereco === 'object') {
                const ruaClean = (c.endereco.rua || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                const bairroClean = (c.endereco.bairro || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                const cidadeClean = (c.endereco.cidade || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                matchesAddress = ruaClean.includes(t) || bairroClean.includes(t) || cidadeClean.includes(t);
            }

            return nomeClean.includes(t) ||
                   (tPhone && telClean.includes(tPhone)) ||
                   (tPhone && cpfClean.includes(tPhone)) ||
                   emailClean.includes(t) ||
                   matchesAddress;
        });
    }, [clientes, busca]);

    // Reset pagination ao pesquisar
    useEffect(() => {
        setCurrentPage(1);
    }, [busca]);

    // Paginação
    const paginatedClientes = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return clientesFiltrados.slice(startIndex, startIndex + itemsPerPage);
    }, [clientesFiltrados, currentPage]);

    const totalPages = Math.ceil(clientesFiltrados.length / itemsPerPage) || 1;

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    // Preenche os campos do formulário para edição
    const abrirModalEdicao = (cliente) => {
        setClienteSelecionado(cliente);
        setNome(cliente.nome || '');
        setTelefone(cliente.telefone || '');
        setCpf(cliente.cpf || '');
        setEmail(cliente.email || '');
        setLimiteCrediario(cliente.limiteCrediario !== undefined ? String(cliente.limiteCrediario) : '0');
        setNascimento(cliente.nascimento || '');

        setInscricaoEstadual(cliente.inscricaoEstadual || '');
        setIndicadorIe(cliente.indicadorIe || '9');

        if (cliente.endereco && typeof cliente.endereco === 'object') {
            setCep(cliente.endereco.cep || '');
            setRua(cliente.endereco.rua || '');
            setNumero(cliente.endereco.numero || '');
            setBairro(cliente.endereco.bairro || '');
            setCidade(cliente.endereco.cidade || '');
            setUf(cliente.endereco.uf || '');
            setReferencia(cliente.endereco.referencia || '');
        } else {
            // Se for string, coloca na rua pra não perder
            setRua(typeof cliente.endereco === 'string' ? cliente.endereco : '');
            setCep('');
            setNumero('');
            setBairro('');
            setCidade('');
            setUf('');
            setReferencia('');
        }
        setShowEditModal(true);
    };

    const limparFormulario = () => {
        setNome('');
        setTelefone('');
        setCpf('');
        setEmail('');
        setLimiteCrediario('0');
        setNascimento('');
        setInscricaoEstadual('');
        setIndicadorIe('9');
        setCep('');
        setRua('');
        setNumero('');
        setBairro('');
        setCidade('');
        setUf('');
        setReferencia('');
        setClienteSelecionado(null);
    };

    // CRUD: Criar Cliente
    const handleCriarCliente = async (e) => {
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

        try {
            const clientData = {
                id: cleanPhone,
                nome: nome.toUpperCase().trim(),
                telefone: cleanPhone,
                cpf: cleanCpf || null,
                email: email.trim() || null,
                inscricaoEstadual: inscricaoEstadual.replace(/\D/g, '') || null,
                indicadorIe: indicadorIe || '9',
                limiteCrediario: Number(limiteCrediario) || 0,
                saldoDevedor: 0,
                nascimento: nascimento || null,
                endereco: {
                    cep: cep.replace(/\D/g, '') || '',
                    rua: rua.toUpperCase().trim() || '',
                    numero: numero.trim() || '',
                    bairro: bairro.toUpperCase().trim() || '',
                    cidade: cidade.toUpperCase().trim() || '',
                    uf: uf.toUpperCase().trim() || '',
                    referencia: referencia.toUpperCase().trim() || ''
                },
                saldoCashback: 0,
                fidelidade: { carimbos: 0, premioDisponivel: false, cartelasCompletadas: 0 },
                criadoEm: new Date()
            };

            // 1. Salva na subcoleção do estabelecimento
            await setDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'clientes', cleanPhone), clientData);

            // 2. Salva na coleção global
            await setDoc(doc(db, 'clientes', cleanPhone), {
                nome: clientData.nome,
                telefone: clientData.telefone,
                cpf: clientData.cpf,
                email: clientData.email,
                limiteCrediario: clientData.limiteCrediario,
                endereco: clientData.endereco,
                nascimento: clientData.nascimento,
                criadoEm: clientData.criadoEm
            });

            toast.success("Cliente cadastrado com sucesso!");
            setShowAddModal(false);
            limparFormulario();
            carregarClientes();
        } catch (error) {
            console.error("Erro ao cadastrar cliente:", error);
            toast.error("Ocorreu um erro ao salvar o cadastro.");
        }
    };

    // CRUD: Editar Cliente
    const handleEditarCliente = async (e) => {
        e.preventDefault();
        if (!nome.trim() || !telefone.trim() || !clienteSelecionado) {
            toast.warn("Nome e Telefone são obrigatórios!");
            return;
        }

        const cleanPhone = telefone.replace(/\D/g, '');
        const cleanCpf = cpf.replace(/\D/g, '');

        try {
            const clientData = {
                nome: nome.toUpperCase().trim(),
                telefone: cleanPhone,
                cpf: cleanCpf || null,
                email: email.trim() || null,
                inscricaoEstadual: inscricaoEstadual.replace(/\D/g, '') || null,
                indicadorIe: indicadorIe || '9',
                limiteCrediario: Number(limiteCrediario) || 0,
                nascimento: nascimento || null,
                endereco: {
                    cep: cep.replace(/\D/g, '') || '',
                    rua: rua.toUpperCase().trim() || '',
                    numero: numero.trim() || '',
                    bairro: bairro.toUpperCase().trim() || '',
                    cidade: cidade.toUpperCase().trim() || '',
                    uf: uf.toUpperCase().trim() || '',
                    referencia: referencia.toUpperCase().trim() || ''
                }
            };

            // Se mudou de ID/telefone, precisamos deletar o antigo e criar o novo
            if (cleanPhone !== clienteSelecionado.id) {
                // Remove antigos
                await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'clientes', clienteSelecionado.id));
                await deleteDoc(doc(db, 'clientes', clienteSelecionado.id));

                // Cria novos
                const fullData = {
                    ...clienteSelecionado,
                    ...clientData,
                    id: cleanPhone
                };
                await setDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'clientes', cleanPhone), fullData);
                await setDoc(doc(db, 'clientes', cleanPhone), {
                    nome: fullData.nome,
                    telefone: fullData.telefone,
                    cpf: fullData.cpf,
                    email: fullData.email,
                    limiteCrediario: fullData.limiteCrediario,
                    endereco: fullData.endereco,
                    nascimento: fullData.nascimento,
                    criadoEm: fullData.criadoEm || new Date()
                });
            } else {
                // Só atualiza os documentos existentes
                await setDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'clientes', cleanPhone), clientData, { merge: true });
                await setDoc(doc(db, 'clientes', cleanPhone), {
                    nome: clientData.nome,
                    telefone: clientData.telefone,
                    cpf: clientData.cpf,
                    email: clientData.email,
                    limiteCrediario: clientData.limiteCrediario,
                    endereco: clientData.endereco,
                    nascimento: clientData.nascimento
                }, { merge: true });
            }

            toast.success("Cliente atualizado com sucesso!");
            setShowEditModal(false);
            limparFormulario();
            carregarClientes();
        } catch (error) {
            console.error("Erro ao atualizar cliente:", error);
            toast.error("Ocorreu um erro ao salvar as alterações.");
        }
    };

    // CRUD: Excluir Cliente
    const handleExcluirCliente = async (cliente) => {
        if (!window.confirm(`Tem certeza absoluta que deseja remover o cliente "${cliente.nome}" do sistema?\n\nEssa ação não pode ser desfeita.`)) {
            return;
        }

        try {
            // Deleta das duas coleções
            await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'clientes', cliente.id));
            await deleteDoc(doc(db, 'clientes', cliente.id));

            toast.success("Cliente removido com sucesso!");
            carregarClientes();
        } catch (error) {
            console.error("Erro ao remover cliente:", error);
            toast.error("Ocorreu um erro ao excluir o cliente.");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/admin-dashboard')}
                            className="bg-slate-100 p-3 rounded-2xl text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition duration-200"
                            title="Voltar ao Painel"
                        >
                            <IoArrowBackOutline size={20} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                                <IoPeopleOutline className="text-emerald-500" />
                                Base de Clientes
                            </h1>
                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                                {estabelecimentoNome}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        <button
                            onClick={() => navigate('/admin/clientes-estabelecimento')}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100 font-extrabold text-sm transition-all duration-200"
                        >
                            <IoLogoWhatsapp size={18} />
                            Disparo WhatsApp
                        </button>
                        <button
                            onClick={() => { limparFormulario(); setShowAddModal(true); }}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 font-extrabold text-sm shadow-md transition-all duration-200 active:scale-95"
                        >
                            <IoPersonAddOutline size={18} />
                            Novo Cliente
                        </button>
                    </div>
                </div>

                {/* Estatísticas Rápidas */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-center">
                        <span className="text-2xl">👥</span>
                        <div className="text-2xl font-black text-slate-800 mt-2">
                            {carregando ? '...' : clientes.length}
                        </div>
                        <div className="text-xs text-slate-400 font-bold uppercase mt-1">Total de Clientes</div>
                    </div>
                    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-center">
                        <span className="text-2xl">💳</span>
                        <div className="text-2xl font-black text-emerald-600 mt-2">
                            {carregando ? '...' : clientes.filter(c => c.limiteCrediario > 0).length}
                        </div>
                        <div className="text-xs text-slate-400 font-bold uppercase mt-1">Com Limite Crediário</div>
                    </div>
                    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-center">
                        <span className="text-2xl">🔍</span>
                        <div className="text-2xl font-black text-slate-800 mt-2">
                            {clientesFiltrados.length}
                        </div>
                        <div className="text-xs text-slate-400 font-bold uppercase mt-1">Encontrados na Busca</div>
                    </div>
                </div>

                {/* Listagem */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full sm:max-w-md">
                            <IoSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg" />
                            <input
                                type="text"
                                placeholder="Buscar por nome, fone, CPF ou endereço..."
                                className="w-full pl-12 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 outline-none focus:bg-white focus:border-slate-400 transition-all placeholder-slate-400"
                                value={busca}
                                onChange={e => setBusca(e.target.value)}
                            />
                            {busca && (
                                <button
                                    onClick={() => setBusca('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm"
                                >
                                    <IoClose size={18} />
                                </button>
                            )}
                        </div>
                        <div className="text-xs font-bold text-slate-400 uppercase">
                            Exibindo {paginatedClientes.length} de {clientesFiltrados.length}
                        </div>
                    </div>

                    {carregando ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                            <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-emerald-600"></div>
                            <span className="text-sm font-bold">Buscando banco de clientes...</span>
                        </div>
                    ) : clientesFiltrados.length === 0 ? (
                        <div className="text-center py-20 px-4">
                            <span className="text-4xl">📭</span>
                            <h3 className="font-extrabold text-slate-700 mt-4 text-base">Nenhum cliente cadastrado ou encontrado</h3>
                            <p className="text-slate-400 text-xs mt-1 max-w-md mx-auto">
                                Importe dados usando o Migrador Universal ou crie novos clientes manualmente clicando no botão "+ Novo Cliente".
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                                        <th className="py-4 px-6">Cliente</th>
                                        <th className="py-4 px-6">Contato</th>
                                        <th className="py-4 px-6">Endereço</th>
                                        <th className="py-4 px-6">Crediário</th>
                                        <th className="py-4 px-6 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-slate-700 text-sm">
                                    {paginatedClientes.map(cliente => (
                                        <tr key={cliente.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-4 px-6">
                                                <div className="font-bold text-slate-800 uppercase tracking-tight">
                                                    {cliente.nome}
                                                </div>
                                                {cliente.cpf && (
                                                    <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-md mt-1 inline-block">
                                                        CPF: {cliente.cpf}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                                                    <IoCallOutline size={14} className="text-slate-400" />
                                                    {cliente.telefone}
                                                </div>
                                                {cliente.email && (
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mt-0.5">
                                                        <IoMailOutline size={12} className="text-slate-400" />
                                                        {cliente.email}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-4 px-6 max-w-xs truncate text-xs text-slate-500 font-medium">
                                                <div className="flex items-center gap-1.5">
                                                    <IoLocationOutline size={14} className="text-slate-400 shrink-0" />
                                                    <span className="truncate" title={formatAddress(cliente.endereco)}>
                                                        {formatAddress(cliente.endereco)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                                    <IoWalletOutline size={14} className="text-slate-400" />
                                                    R$ {parseFloat(cliente.limiteCrediario || 0).toFixed(2).replace('.', ',')}
                                                </div>
                                                {cliente.saldoDevedor > 0 && (
                                                    <span className="text-[10px] text-red-650 font-black uppercase mt-0.5 inline-block">
                                                        Débito: R$ {parseFloat(cliente.saldoDevedor).toFixed(2).replace('.', ',')}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => navigate(`/admin/clientes/${cliente.id}`)}
                                                        className="px-3.5 py-2 text-xs font-extrabold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition duration-150"
                                                        title="Ver Histórico e Detalhes"
                                                    >
                                                        Histórico
                                                    </button>
                                                    <button
                                                        onClick={() => abrirModalEdicao(cliente)}
                                                        className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition duration-150"
                                                        title="Editar Cadastro"
                                                    >
                                                        <IoCreateOutline size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleExcluirCliente(cliente)}
                                                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition duration-150"
                                                        title="Excluir Cliente"
                                                    >
                                                        <IoTrashOutline size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/20">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 transition duration-150 ${currentPage === 1 ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                            >
                                <IoChevronBackOutline size={14} /> Anterior
                            </button>
                            <span className="text-xs text-slate-400 font-bold uppercase">
                                Página {currentPage} de {totalPages}
                            </span>
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 transition duration-150 ${currentPage === totalPages ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                            >
                                Próxima <IoChevronForwardOutline size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal: Adicionar Cliente */}
            {showAddModal && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[900] p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh] transform animate-slideUp overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="font-extrabold text-lg text-slate-800 flex items-center gap-2">
                                    <IoPersonAddOutline className="text-emerald-500" />
                                    Cadastrar Novo Cliente
                                </h3>
                                <p className="text-slate-400 text-[10px] font-bold uppercase">Adicionar cliente ao estabelecimento</p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                                <IoClose size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCriarCliente} className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Dados Principais */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nome Completo <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all uppercase"
                                        placeholder="Ex: JOÃO DA SILVA"
                                        value={nome}
                                        onChange={e => setNome(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Telefone (WhatsApp) <span className="text-red-500">*</span></label>
                                    <input
                                        type="tel"
                                        required
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all"
                                        placeholder="Ex: (11) 98765-4321"
                                        value={telefone}
                                        onChange={e => setTelefone(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                                        CPF / CNPJ 
                                        {isFetchingCnpj && <span className="text-blue-500 text-[10px] animate-pulse">Buscando...</span>}
                                    </label>
                                    <input
                                        type="text"
                                        className={`w-full p-3 bg-slate-50 border ${isFetchingCnpj ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200'} rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all`}
                                        placeholder="Digite para autocompletar"
                                        value={cpf}
                                        onChange={e => handleCpfCnpjChange(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Inscrição Estadual (IE)</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all"
                                        placeholder="Apenas números (se houver)"
                                        value={inscricaoEstadual}
                                        onChange={e => setInscricaoEstadual(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Indicador IE</label>
                                    <select
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all"
                                        value={indicadorIe}
                                        onChange={e => setIndicadorIe(e.target.value)}
                                    >
                                        <option value="9">Não Contribuinte</option>
                                        <option value="1">Contribuinte ICM</option>
                                        <option value="2">Contribuinte Isento</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">E-mail (Opcional)</label>
                                    <input
                                        type="email"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all"
                                        placeholder="Ex: joao@email.com"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Limite Crediário (R$)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all"
                                        placeholder="0.00"
                                        value={limiteCrediario}
                                        onChange={e => setLimiteCrediario(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Data de Nascimento (Opcional)</label>
                                    <input
                                        type="date"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all"
                                        value={nascimento}
                                        onChange={e => setNascimento(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Endereço */}
                            <div className="border-t border-slate-100 pt-4">
                                <h4 className="text-sm font-extrabold text-slate-700 flex items-center gap-1.5 mb-4">
                                    <IoLocationOutline className="text-emerald-500" />
                                    Endereço
                                </h4>
                                <div className="grid grid-cols-12 gap-4">
                                    <div className="col-span-4 md:col-span-3">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">CEP</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all"
                                            placeholder="00000-000"
                                            value={cep}
                                            onChange={e => setCep(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-8 md:col-span-6">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Rua / Logradouro</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all uppercase"
                                            placeholder="Ex: RUA DAS FLORES"
                                            value={rua}
                                            onChange={e => setRua(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-4 md:col-span-3">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Número</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all"
                                            placeholder="Ex: 123"
                                            value={numero}
                                            onChange={e => setNumero(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-6">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Bairro</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all uppercase"
                                            placeholder="Ex: CENTRO"
                                            value={bairro}
                                            onChange={e => setBairro(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-4 md:col-span-4">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cidade</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all uppercase"
                                            placeholder="Ex: SÃO PAULO"
                                            value={cidade}
                                            onChange={e => setCidade(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-2 md:col-span-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">UF</label>
                                        <input
                                            type="text"
                                            maxLength="2"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all uppercase text-center"
                                            placeholder="SP"
                                            value={uf}
                                            onChange={e => setUf(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-12">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Complemento / Referência</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all uppercase"
                                            placeholder="Ex: APTO 12 / PRÓXIMO AO MERCADO"
                                            value={referencia}
                                            onChange={e => setReferencia(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-slate-900 text-white p-4 rounded-2xl font-black text-sm shadow-md hover:bg-slate-800 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
                            >
                                SALVAR CLIENTE
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Editar Cliente */}
            {showEditModal && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[900] p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh] transform animate-slideUp overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="font-extrabold text-lg text-slate-800 flex items-center gap-2">
                                    <IoCreateOutline className="text-blue-550" />
                                    Editar Cadastro de Cliente
                                </h3>
                                <p className="text-slate-400 text-[10px] font-bold uppercase">Modificar dados existentes</p>
                            </div>
                            <button onClick={() => setShowEditModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                                <IoClose size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleEditarCliente} className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Dados Principais */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nome Completo <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all uppercase"
                                        placeholder="Ex: JOÃO DA SILVA"
                                        value={nome}
                                        onChange={e => setNome(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Telefone (WhatsApp) <span className="text-red-500">*</span></label>
                                    <input
                                        type="tel"
                                        required
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all"
                                        placeholder="Ex: (11) 98765-4321"
                                        value={telefone}
                                        onChange={e => setTelefone(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                                        CPF / CNPJ 
                                        {isFetchingCnpj && <span className="text-blue-500 text-[10px] animate-pulse">Buscando...</span>}
                                    </label>
                                    <input
                                        type="text"
                                        className={`w-full p-3 bg-slate-50 border ${isFetchingCnpj ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200'} rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all`}
                                        placeholder="Digite para autocompletar"
                                        value={cpf}
                                        onChange={e => handleCpfCnpjChange(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Inscrição Estadual (IE)</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all"
                                        placeholder="Apenas números (se houver)"
                                        value={inscricaoEstadual}
                                        onChange={e => setInscricaoEstadual(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Indicador IE</label>
                                    <select
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all"
                                        value={indicadorIe}
                                        onChange={e => setIndicadorIe(e.target.value)}
                                    >
                                        <option value="9">Não Contribuinte</option>
                                        <option value="1">Contribuinte ICM</option>
                                        <option value="2">Contribuinte Isento</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">E-mail (Opcional)</label>
                                    <input
                                        type="email"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all"
                                        placeholder="Ex: joao@email.com"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Limite Crediário (R$)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all"
                                        placeholder="0.00"
                                        value={limiteCrediario}
                                        onChange={e => setLimiteCrediario(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Data de Nascimento (Opcional)</label>
                                    <input
                                        type="date"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all"
                                        value={nascimento}
                                        onChange={e => setNascimento(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Endereço */}
                            <div className="border-t border-slate-100 pt-4">
                                <h4 className="text-sm font-extrabold text-slate-700 flex items-center gap-1.5 mb-4">
                                    <IoLocationOutline className="text-blue-550" />
                                    Endereço
                                </h4>
                                <div className="grid grid-cols-12 gap-4">
                                    <div className="col-span-4 md:col-span-3">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">CEP</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all"
                                            placeholder="00000-000"
                                            value={cep}
                                            onChange={e => setCep(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-8 md:col-span-6">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Rua / Logradouro</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all uppercase"
                                            placeholder="Ex: RUA DAS FLORES"
                                            value={rua}
                                            onChange={e => setRua(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-4 md:col-span-3">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Número</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all"
                                            placeholder="Ex: 123"
                                            value={numero}
                                            onChange={e => setNumero(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-6">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Bairro</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all uppercase"
                                            placeholder="Ex: CENTRO"
                                            value={bairro}
                                            onChange={e => setBairro(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-4 md:col-span-4">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cidade</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all uppercase"
                                            placeholder="Ex: SÃO PAULO"
                                            value={cidade}
                                            onChange={e => setCidade(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-2 md:col-span-2">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">UF</label>
                                        <input
                                            type="text"
                                            maxLength="2"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all uppercase text-center"
                                            placeholder="SP"
                                            value={uf}
                                            onChange={e => setUf(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-12">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Complemento / Referência</label>
                                        <input
                                            type="text"
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition-all uppercase"
                                            placeholder="Ex: APTO 12 / PRÓXIMO AO MERCADO"
                                            value={referencia}
                                            onChange={e => setReferencia(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-slate-900 text-white p-4 rounded-2xl font-black text-sm shadow-md hover:bg-slate-800 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
                            >
                                SALVAR ALTERAÇÕES
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default withEstablishmentAuth(NossosClientes);