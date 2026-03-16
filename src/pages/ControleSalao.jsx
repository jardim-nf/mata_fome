import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
// 🔥 ADICIONADO 'where' AQUI NA IMPORTAÇÃO 🔥
import { collection, onSnapshot, addDoc, doc, getDoc, deleteDoc, updateDoc, serverTimestamp, query, orderBy, runTransaction, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useHeader } from '../context/HeaderContext';
import { toast } from 'react-toastify';
import MesaCard from "../components/MesaCard";
import AdicionarMesaModal from "../components/AdicionarMesaModal";
import ModalPagamento from "../components/ModalPagamento";
import GeradorTickets from "../components/GeradorTickets";
import RelatorioTicketsModal from "../components/RelatorioTicketsModal";
import HistoricoMesasModal from "../components/HistoricoMesasModal";
import RelatorioGarcomModal from "../components/RelatorioGarcomModal";
import {
    IoArrowBack, IoAdd,
    IoGrid, IoPeople, IoWalletOutline,
    IoRestaurant, IoSearch, IoClose, IoAlertCircle,
    IoTicket, IoDocumentText, IoTimeOutline
} from "react-icons/io5";

// --- HELPER DE FORMATAÇÃO ---
const formatarReal = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(valor || 0);
};

// --- STAT CARD PEQUENO ---
const StatCard = ({ icon: Icon, label, value, colorClass, bgClass }) => (
    <div className="bg-white p-2 sm:p-3 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between min-w-[130px]">
        <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
            <h3 className="text-sm sm:text-base font-black text-gray-900 leading-tight">{value}</h3>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${bgClass} ${colorClass}`}>
            <Icon />
        </div>
    </div>
);

// --- MODAL ABRIR MESA ---
const ModalAbrirMesa = ({ isOpen, onClose, onConfirm, mesaNumero, isOpening }) => {
    const [quantidade, setQuantidade] = useState(2);
    const [nome, setNome] = useState('');

    useEffect(() => {
        if (isOpen) {
            setQuantidade(2);
            setNome('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-gray-100">
                <h3 className="text-xl font-black text-gray-900 text-center mb-1">Mesa {mesaNumero}</h3>
                <p className="text-center text-gray-500 mb-4 text-xs">Informe os dados para abrir</p>

                <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">NOME DO CLIENTE (OPCIONAL)</label>
                    <input
                        type="text"
                        placeholder="Ex: João Silva"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                        autoFocus
                    />
                </div>

                <div className="mb-6">
                    <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">QUANTAS PESSOAS?</label>
                    <div className="flex items-center justify-between bg-gray-50 rounded-xl p-2 border border-gray-200">
                        <button onClick={() => setQuantidade(q => Math.max(1, q - 1))} className="w-10 h-10 rounded-lg bg-white shadow-sm border border-gray-200 text-xl font-bold hover:bg-gray-50 text-gray-600">-</button>
                        <span className="text-2xl font-black text-gray-900">{quantidade}</span>
                        <button onClick={() => setQuantidade(q => q + 1)} className="w-10 h-10 rounded-lg bg-blue-600 shadow text-white text-xl font-bold hover:bg-blue-700">+</button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button onClick={onClose} disabled={isOpening} className="py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
                    <button onClick={() => onConfirm(quantidade, nome)} disabled={isOpening} className="py-3 bg-gray-900 text-white rounded-xl font-bold shadow-lg hover:bg-black active:scale-95 transition-transform flex items-center justify-center gap-2">
                        {isOpening ? 'Abrindo...' : 'Abrir Mesa'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function ControleSalao() {
    const { userData, user, currentUser } = useAuth();
    const usuarioLogado = user || currentUser;

    const { setActions, clearActions } = useHeader();
    const navigate = useNavigate();

    const [mesas, setMesas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState('todos');
    const [buscaMesa, setBuscaMesa] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [isModalPagamentoOpen, setIsModalPagamentoOpen] = useState(false);
    const [mesaParaPagamento, setMesaParaPagamento] = useState(null);
    const [isModalAbrirMesaOpen, setIsModalAbrirMesaOpen] = useState(false);
    const [mesaParaAbrir, setMesaParaAbrir] = useState(null);
    const [isOpeningTable, setIsOpeningTable] = useState(false);

    const [isModalTicketsOpen, setIsModalTicketsOpen] = useState(false);
    const [isRelatorioOpen, setIsRelatorioOpen] = useState(false);
    const [isHistoricoMesasOpen, setIsHistoricoMesasOpen] = useState(false);
    const [isModalComissaoOpen, setIsModalComissaoOpen] = useState(false);
    const [nomeEstabelecimento, setNomeEstabelecimento] = useState("Carregando...");

    // Estado que guarda o tempo atual e atualiza a cada 1 minuto
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        // Relógio invisível: Força o React a recalcular os tempos das mesas
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const estabelecimentoId = useMemo(() => {
        return userData?.estabelecimentosGerenciados?.[0] || userData?.estabelecimentoId || userData?.idEstabelecimento || null;
    }, [userData]);

    // Função que verifica se passaram 10 minutos
    const verificarMesaOciosa = (mesa) => {
        if (mesa.status !== 'ocupada' || (mesa.itens && mesa.itens.length > 0)) return false;
        if (!mesa.updatedAt) return false;

        const dataAbertura = mesa.updatedAt.toDate ? mesa.updatedAt.toDate() : new Date(mesa.updatedAt);
        const minutosDecorridos = Math.floor((currentTime - dataAbertura) / 60000);
<<<<<<< HEAD

=======
        
>>>>>>> bc3ec491d3dd4407136913050b6fd5fcfffda302
        return minutosDecorridos >= 10; // 10 minutos sem pedir nada = alerta
    };

    useEffect(() => {
        const fetchNomeEstabelecimento = async () => {
            if (estabelecimentoId) {
                try {
                    const docRef = doc(db, "estabelecimentos", estabelecimentoId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const nomeReal = docSnap.data().nome || userData?.nomeEstabelecimento || "IdeaFood";
                        setNomeEstabelecimento(nomeReal);
                    }
                } catch (error) {
                    console.error("Erro ao buscar nome:", error);
                    setNomeEstabelecimento(userData?.nomeEstabelecimento || "IdeaFood");
                }
            }
        };
        fetchNomeEstabelecimento();
    }, [estabelecimentoId, userData]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F4') {
                e.preventDefault();
                setIsHistoricoMesasOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
// 🔥 NOVO: useEffect PARA ESCUTAR PEDIDOS DE IMPRESSÃO 🔥
    useEffect(() => {
        if (!estabelecimentoId) return;

<<<<<<< HEAD
        // 🛑 TRAVA CORRIGIDA: Não bloqueia mais PCs com tela Touch ou janelas menores!
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        
        if (isMobileDevice) {
            return; // Aparelho mobile não escuta a impressora
        }

=======
    // 🔥 NOVO: useEffect PARA ESCUTAR PEDIDOS DE IMPRESSÃO (Ouvinte Principal) 🔥
    useEffect(() => {
        if (!estabelecimentoId) return;

        // 🛑 TRAVA DE SEGURANÇA PARA CELULARES 🛑
        // Verifica se o aparelho é um celular/tablet. Se for, ele NÃO escuta a impressora!
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Se for celular (ou tela pequena), encerra a função aqui e o aparelho fica "surdo" para a impressora
        if (isMobileDevice || window.innerWidth < 1024) {
            console.log("Aparelho mobile ou tela pequena detectado: Ouvinte de impressão bloqueado na tela do garçom.");
            return; 
        }

        // Daqui para baixo, só o Computador do Caixa vai executar
>>>>>>> bc3ec491d3dd4407136913050b6fd5fcfffda302
        const q = query(
            collection(db, "estabelecimentos", estabelecimentoId, "mesas"),
            where("solicitarImpressaoConferencia", "==", true)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === "added" || change.type === "modified") {
                    const mesaDoc = change.doc;
                    const mesaId = mesaDoc.id;
                    const mesaData = mesaDoc.data();

<<<<<<< HEAD
                    if (mesaData.solicitarImpressaoConferencia) {
                        toast.info(`Imprimindo conferência da Mesa ${mesaData.numero}...`);
                        
                        const urlImpressao = `/impressao-isolada?origem=salao&estabId=${estabelecimentoId}&pedidoId=${mesaId}`;
                        window.open(urlImpressao, "_blank", "width=400,height=600");

=======
                    // Verificação de segurança para não imprimir infinitamente
                    if (mesaData.solicitarImpressaoConferencia) {
                        toast.info(`Imprimindo conferência da Mesa ${mesaData.numero}...`);
                        
                        // 1. Abre a tela de impressão numa nova aba/pop-up
                        const urlImpressao = `/impressao?origem=salao&estabId=${estabelecimentoId}&pedidoId=${mesaId}`;
                        window.open(urlImpressao, "_blank", "width=400,height=600");

                        // 2. Reseta a flag imediatamente para não causar looping
>>>>>>> bc3ec491d3dd4407136913050b6fd5fcfffda302
                        try {
                            await updateDoc(doc(db, "estabelecimentos", estabelecimentoId, "mesas", mesaId), {
                                solicitarImpressaoConferencia: false
                            });
                        } catch (err) {
<<<<<<< HEAD
                            console.error("Erro ao limpar flag de impressão:", err);
=======
                            console.error("Erro ao limpar flag de impressão da mesa:", err);
>>>>>>> bc3ec491d3dd4407136913050b6fd5fcfffda302
                        }
                    }
                }
            });
        });

        return () => unsubscribe();
    }, [estabelecimentoId]);
    // 🔥 FIM DO OUVINTE DE IMPRESSÃO 🔥


    // --- BOTÕES DO HEADER PRINCIPAL ---
    useEffect(() => {
        setActions(
            <div className="flex gap-2">
                <button
                    onClick={() => setIsHistoricoMesasOpen(true)}
                    className="bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 font-bold py-2 px-4 rounded-lg shadow-sm flex items-center gap-2 active:scale-95 transition-all text-xs sm:text-sm"
                    title="Histórico de Mesas (F4)"
                >
                    <IoTimeOutline className="text-lg" /> <span className="hidden sm:inline">Histórico (F4)</span>
                </button>
                <button
                    onClick={() => setIsModalComissaoOpen(true)}
                    className="bg-white text-green-700 border border-green-200 hover:bg-green-50 font-bold py-2 px-4 rounded-lg shadow-sm flex items-center gap-2 active:scale-95 transition-all text-xs sm:text-sm"
                    title="Comissões dos Garçons"
                >
                    <IoPeople className="text-lg" /> <span className="hidden sm:inline">Comissões</span>
                </button>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-gray-900 hover:bg-black text-white font-bold py-2 px-4 rounded-lg shadow-lg flex items-center gap-2 active:scale-95 transition-all text-xs sm:text-sm"
                >
                    <IoAdd className="text-lg" /> <span className="hidden sm:inline">Criar Mesa</span>
                </button>
            </div>
        );
        return () => clearActions();
    }, [setActions, clearActions]);

    useEffect(() => {
        if (!estabelecimentoId) { if (userData) setLoading(false); return; }
        setLoading(true);
        const unsubscribe = onSnapshot(query(collection(db, 'estabelecimentos', estabelecimentoId, 'mesas'), orderBy('numero')),
            (snapshot) => {
                const mesasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                mesasData.sort((a, b) => {
                    const numA = parseFloat(a.numero);
                    const numB = parseFloat(b.numero);
                    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                    return String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true });
                });
                setMesas(mesasData);
                setLoading(false);
            },
            (error) => { console.error("Erro mesas:", error); setLoading(false); }
        );
        return () => unsubscribe();
    }, [estabelecimentoId, userData]);

    const handleAdicionarMesa = async (numeroMesa) => {
        if (!numeroMesa || !estabelecimentoId) return;
        try {
            await addDoc(collection(db, 'estabelecimentos', estabelecimentoId, 'mesas'), {
                numero: !isNaN(numeroMesa) ? Number(numeroMesa) : numeroMesa,
                status: 'livre', total: 0, pessoas: 0, itens: [], tipo: 'mesa',
                createdAt: serverTimestamp(), updatedAt: serverTimestamp()
            });
            toast.success("Mesa criada!"); setIsModalOpen(false);
        } catch (error) { toast.error("Erro ao criar."); }
    };

    const handleExcluirMesa = async (id) => {
        if (!window.confirm(`Excluir mesa?`)) return;
        try { await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', id)); toast.success("Excluída."); }
        catch (error) { toast.error("Erro."); }
    };

    const handleMesaClick = (mesa) => {
        if (mesa.status !== 'livre') {
            navigate(`/estabelecimento/${estabelecimentoId}/mesa/${mesa.id}`);
            return;
        }

        if (!usuarioLogado || !usuarioLogado.uid) {
            toast.error("Erro de autenticação. Recarregue a página.");
            return;
        }

        setMesaParaAbrir(mesa);
        setIsModalAbrirMesaOpen(true);

        const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesa.id);

        runTransaction(db, async (transaction) => {
            const mesaDoc = await transaction.get(mesaRef);
            if (!mesaDoc.exists()) throw "Mesa não existe mais!";
<<<<<<< HEAD

            const data = mesaDoc.data();
            if (data.status !== 'livre') throw "Esta mesa acabou de ser ocupada!";

=======
            
            const data = mesaDoc.data();
            if (data.status !== 'livre') throw "Esta mesa acabou de ser ocupada!";

>>>>>>> bc3ec491d3dd4407136913050b6fd5fcfffda302
            if (data.bloqueadoPor && data.bloqueadoPor !== usuarioLogado.uid) {
                const agora = new Date();
                let tempoBloqueio = 0;
                if (data.bloqueadoEm) {
                    const dataBloqueio = data.bloqueadoEm.toDate ? data.bloqueadoEm.toDate() : new Date(data.bloqueadoEm);
                    tempoBloqueio = (agora.getTime() - dataBloqueio.getTime()) / 1000 / 60;
                }
                if (tempoBloqueio < 2) {
                    throw `Mesa sendo aberta por: ${data.bloqueadoPorNome || 'Outro garçom'}`;
                }
            }

            transaction.update(mesaRef, {
                bloqueadoPor: usuarioLogado.uid,
                bloqueadoPorNome: usuarioLogado.displayName || usuarioLogado.email || "Garçom",
                bloqueadoEm: serverTimestamp()
            });

        }).catch((error) => {
            console.error("Conflito ao abrir mesa:", error);
            const msg = typeof error === 'string' ? error : "Erro: Mesa sendo acessada por outro usuário.";
            toast.warning(msg);
            setIsModalAbrirMesaOpen(false);
            setMesaParaAbrir(null);
        });
    };

    const handleCancelarAbertura = async () => {
        setIsModalAbrirMesaOpen(false);
        if (mesaParaAbrir) {
            try {
                await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaParaAbrir.id), {
                    bloqueadoPor: null,
                    bloqueadoPorNome: null,
                    bloqueadoEm: null
                });
            } catch (error) {
                console.error("Erro ao desbloquear mesa", error);
            }
            setMesaParaAbrir(null);
        }
    };

    const handleConfirmarAbertura = (qtd, nomeCliente) => {
        if (!mesaParaAbrir) return;
<<<<<<< HEAD

        setIsModalAbrirMesaOpen(false);

=======
        
        setIsModalAbrirMesaOpen(false);
        
>>>>>>> bc3ec491d3dd4407136913050b6fd5fcfffda302
        updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaParaAbrir.id), {
            status: 'ocupada',
            pessoas: qtd,
            nome: nomeCliente || '',
            tipo: 'mesa',
            updatedAt: serverTimestamp(),
            bloqueadoPor: null,
            bloqueadoPorNome: null,
            bloqueadoEm: null
        }).catch((error) => {
            console.error("Erro ao sincronizar abertura da mesa:", error);
            toast.error("Erro ao sincronizar com o servidor.");
        });

        navigate(`/estabelecimento/${estabelecimentoId}/mesa/${mesaParaAbrir.id}`);
    };

    const handlePagamentoConcluido = () => { setIsModalPagamentoOpen(false); setMesaParaPagamento(null); };

    const mesasFiltradas = useMemo(() => {
        return mesas.filter(m => {
            const matchStatus = filtro === 'todos' ? true :
                filtro === 'livres' ? m.status === 'livre' :
                    filtro === 'ocupadas' ? m.status !== 'livre' : true;
            const termoBusca = buscaMesa.toLowerCase();
            const matchBusca = buscaMesa === '' ? true :
                (String(m.numero).includes(buscaMesa) || (m.nome && m.nome.toLowerCase().includes(termoBusca)));
            return matchStatus && matchBusca;
        });
    }, [mesas, filtro, buscaMesa]);

    const stats = useMemo(() => {
        const ocupadas = mesas.filter(m => m.status !== 'livre');
        const totalVendas = ocupadas.reduce((acc, m) => acc + (m.total || 0), 0);
        return {
            total: mesas.length,
            ocupadas: ocupadas.length,
            livres: mesas.length - ocupadas.length,
            pessoas: ocupadas.reduce((acc, m) => acc + (m.pessoas || 0), 0),
            vendas: totalVendas,
            ocupacaoPercent: mesas.length > 0 ? Math.round((ocupadas.length / mesas.length) * 100) : 0
        };
    }, [mesas]);

    if (!estabelecimentoId && !loading) return <div className="p-10 text-center"><IoAlertCircle className="mx-auto text-4xl text-red-500 mb-2" />Sem acesso ao estabelecimento.</div>;

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-2 sm:p-4 w-full">
            <div className="w-full">

                <AdicionarMesaModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleAdicionarMesa} mesasExistentes={mesas} />

                <ModalAbrirMesa
                    isOpen={isModalAbrirMesaOpen}
                    onClose={handleCancelarAbertura}
                    onConfirm={handleConfirmarAbertura}
                    mesaNumero={mesaParaAbrir?.numero}
                    isOpening={isOpeningTable}
                />

                {isModalPagamentoOpen && mesaParaPagamento && estabelecimentoId && (
                    <ModalPagamento mesa={mesaParaPagamento} estabelecimentoId={estabelecimentoId} onClose={() => setIsModalPagamentoOpen(false)} onSucesso={handlePagamentoConcluido} />
                )}

                {isModalTicketsOpen && (
                    <GeradorTickets
                        onClose={() => setIsModalTicketsOpen(false)}
                        estabelecimentoNome={nomeEstabelecimento}
                        estabelecimentoId={estabelecimentoId}
                    />
                )}

                {isRelatorioOpen && (
                    <RelatorioTicketsModal
                        onClose={() => setIsRelatorioOpen(false)}
                        estabelecimentoId={estabelecimentoId}
                    />
                )}

                {isHistoricoMesasOpen && (
                    <HistoricoMesasModal
                        isOpen={isHistoricoMesasOpen}
                        onClose={() => setIsHistoricoMesasOpen(false)}
                        estabelecimentoId={estabelecimentoId}
                    />
                )}

                {isModalComissaoOpen && (
                    <RelatorioGarcomModal
                        isOpen={isModalComissaoOpen}
                        onClose={() => setIsModalComissaoOpen(false)}
                        estabelecimentoId={estabelecimentoId}
                    />
                )}

                <div className="sticky top-0 bg-[#F8FAFC]/95 backdrop-blur-sm z-30 pb-4 pt-2 border-b border-gray-200/50 mb-4 px-2 w-full">
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 w-full">

                        <div className="flex flex-col gap-1 shrink-0">
                            <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-gray-600 font-bold text-xs flex items-center gap-1 w-fit">
                                <IoArrowBack /> Voltar
                            </button>
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Salão</h1>
                                <span className="bg-gray-200 text-gray-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                                    {mesasFiltradas.length} Mesas
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar w-full xl:w-auto xl:flex-1 xl:justify-center">
                            <StatCard icon={IoGrid} label="Ocupação" value={`${stats.ocupacaoPercent}%`} bgClass="bg-blue-50" colorClass="text-blue-600" />
                            <StatCard icon={IoPeople} label="Pessoas" value={stats.pessoas} bgClass="bg-emerald-50" colorClass="text-emerald-600" />
                            <StatCard icon={IoWalletOutline} label="Aberto" value={formatarReal(stats.vendas)} bgClass="bg-purple-50" colorClass="text-purple-600" />
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto shrink-0 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
                            <div className="relative w-full sm:w-48 md:w-64">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <IoSearch className="text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    className="block w-full pl-10 pr-8 py-2 bg-gray-50 border-0 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 placeholder-gray-400 outline-none"
                                    placeholder="Buscar mesa ou cliente..."
                                    value={buscaMesa}
                                    onChange={(e) => setBuscaMesa(e.target.value)}
                                />
                                {buscaMesa && (
                                    <button onClick={() => setBuscaMesa('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-red-500">
                                        <IoClose />
                                    </button>
                                )}
                            </div>

                            <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto w-full sm:w-auto">
                                {['todos', 'livres', 'ocupadas'].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setFiltro(t)}
                                        className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-bold capitalize transition-all whitespace-nowrap ${filtro === t ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-3 border border-gray-200 shadow-sm min-h-[70vh] w-full">
                    {mesasFiltradas.length > 0 ? (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3 w-full">
                            {mesasFiltradas.map(mesa => (
                                <MesaCard
                                    key={mesa.id}
                                    mesa={mesa}
                                    isOciosa={verificarMesaOciosa(mesa)}
                                    currentTime={currentTime}
                                    onClick={() => handleMesaClick(mesa)}
                                    onPagar={() => { setMesaParaPagamento(mesa); setIsModalPagamentoOpen(true); }}
                                    onExcluir={() => handleExcluirMesa(mesa.id)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-32 text-center text-gray-400 w-full">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-2"><IoRestaurant className="text-2xl text-gray-300" /></div>
                            <p className="text-sm font-medium">Nenhuma mesa encontrada.</p>
                            {mesas.length === 0 && (
                                <button onClick={() => setIsModalOpen(true)} className="mt-4 text-blue-600 font-bold hover:underline text-sm">+ Adicionar Mesas</button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}