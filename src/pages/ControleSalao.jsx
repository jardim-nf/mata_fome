import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext"; 
import { useHeader } from '../context/HeaderContext';
import { toast } from 'react-toastify';
import MesaCard from "../components/MesaCard";
import AdicionarMesaModal from "../components/AdicionarMesaModal";
import ModalPagamento from "../components/ModalPagamento";
import { 
    IoArrowBack, IoAdd, 
    IoGrid, IoPeople, IoWalletOutline,
    IoRestaurant, IoSearch, IoClose, IoAlertCircle 
} from "react-icons/io5";

// --- FUNÇÃO AUXILIAR PARA FORMATAR R$ (Mesma do MesaCard) ---
const formatarReal = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(valor);
};

// --- STAT CARD PEQUENO ---
const StatCard = ({ icon: Icon, label, value, colorClass, bgClass }) => (
    <div className="bg-white p-2 sm:p-3 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between min-w-[120px]">
        <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
            {/* Ajustei o tamanho da fonte para caber o R$ */}
            <h3 className="text-sm sm:text-base font-black text-gray-900 leading-tight">{value}</h3>
        </div>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${bgClass} ${colorClass}`}>
            <Icon />
        </div>
    </div>
);

// --- MODAL ABRIR MESA ---
const ModalAbrirMesa = ({ isOpen, onClose, onConfirm, mesaNumero }) => {
    const [quantidade, setQuantidade] = useState(2);
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-gray-100">
                <h3 className="text-xl font-black text-gray-900 text-center mb-4">Mesa {mesaNumero}</h3>
                <p className="text-center text-gray-500 mb-4 text-sm">Quantas pessoas?</p>
                <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 mb-6">
                    <button onClick={() => setQuantidade(q => Math.max(1, q - 1))} className="w-12 h-12 rounded-lg bg-white shadow border text-2xl font-bold hover:bg-gray-50">-</button>
                    <span className="text-4xl font-black text-gray-900">{quantidade}</span>
                    <button onClick={() => setQuantidade(q => q + 1)} className="w-12 h-12 rounded-lg bg-blue-600 text-white shadow text-2xl font-bold hover:bg-blue-700">+</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={onClose} className="py-3 bg-gray-100 rounded-lg font-bold text-gray-600 hover:bg-gray-200">Cancelar</button>
                    <button onClick={() => onConfirm(quantidade)} className="py-3 bg-gray-900 text-white rounded-lg font-bold shadow-lg hover:bg-black">Abrir Mesa</button>
                </div>
            </div>
        </div>
    );
};

export default function ControleSalao() {
    const { userData } = useAuth(); 
    const { setActions, clearActions } = useHeader();
    const navigate = useNavigate();
    
    // Estados
    const [mesas, setMesas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState('todos'); 
    const [buscaMesa, setBuscaMesa] = useState(''); 
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Modais
    const [isModalPagamentoOpen, setIsModalPagamentoOpen] = useState(false);
    const [mesaParaPagamento, setMesaParaPagamento] = useState(null);
    const [isModalAbrirMesaOpen, setIsModalAbrirMesaOpen] = useState(false);
    const [mesaParaAbrir, setMesaParaAbrir] = useState(null);

    const estabelecimentoId = useMemo(() => {
        return userData?.estabelecimentosGerenciados?.[0] || userData?.estabelecimentoId || null;
    }, [userData]);

    // HEADER ACTIONS
    useEffect(() => {
        setActions(
            <button onClick={() => setIsModalOpen(true)} className="bg-gray-900 hover:bg-black text-white font-bold py-2 px-4 rounded-lg shadow-lg flex items-center gap-2 active:scale-95 transition-all text-xs sm:text-sm">
                <IoAdd className="text-lg"/> <span className="hidden sm:inline">Criar Mesa</span>
            </button>
        );
        return () => clearActions();
    }, [setActions, clearActions]);

    // FETCH MESAS
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

    // FUNÇÕES
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
        if (mesa.status === 'livre') { setMesaParaAbrir(mesa); setIsModalAbrirMesaOpen(true); } 
        else { navigate(`/estabelecimento/${estabelecimentoId}/mesa/${mesa.id}`); }
    };

    const handleConfirmarAbertura = async (qtd) => {
        try {
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaParaAbrir.id), {
                status: 'ocupada', pessoas: qtd, tipo: 'mesa', updatedAt: serverTimestamp()
            });
            setIsModalAbrirMesaOpen(false);
            navigate(`/estabelecimento/${estabelecimentoId}/mesa/${mesaParaAbrir.id}`);
        } catch (error) { toast.error("Erro ao abrir"); }
    };

    const handlePagamentoConcluido = () => { setIsModalPagamentoOpen(false); setMesaParaPagamento(null); };

    // 🔍 FILTRO OTIMIZADO
    const mesasFiltradas = useMemo(() => {
        return mesas.filter(m => {
            const matchStatus = filtro === 'todos' ? true :
                                filtro === 'livres' ? m.status === 'livre' :
                                filtro === 'ocupadas' ? m.status !== 'livre' : true;
            
            const matchBusca = buscaMesa === '' ? true : String(m.numero).includes(buscaMesa);
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

    if (!estabelecimentoId && !loading) return <div className="p-10 text-center"><IoAlertCircle className="mx-auto text-4xl text-red-500 mb-2"/>Sem acesso ao estabelecimento.</div>;

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-2 sm:p-4 pb-20">
            <div className="w-full max-w-[2400px] mx-auto"> 
                
                <AdicionarMesaModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleAdicionarMesa} mesasExistentes={mesas} />
                <ModalAbrirMesa isOpen={isModalAbrirMesaOpen} onClose={() => setIsModalAbrirMesaOpen(false)} onConfirm={handleConfirmarAbertura} mesaNumero={mesaParaAbrir?.numero} />
                {isModalPagamentoOpen && mesaParaPagamento && estabelecimentoId && (
                    <ModalPagamento mesa={mesaParaPagamento} estabelecimentoId={estabelecimentoId} onClose={() => setIsModalPagamentoOpen(false)} onSucesso={handlePagamentoConcluido} />
                )}

                {/* --- HEADER FIXO --- */}
                <div className="sticky top-0 bg-[#F8FAFC]/95 backdrop-blur-sm z-30 pb-4 pt-2 border-b border-gray-200/50 mb-4 px-2">
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                        
                        {/* Título e Voltar */}
                        <div className="flex flex-col gap-1">
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

                        {/* Stats Rápidos (Horizontal) */}
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar w-full xl:w-auto">
                            <StatCard icon={IoGrid} label="Ocupação" value={`${stats.ocupacaoPercent}%`} bgClass="bg-blue-50" colorClass="text-blue-600" />
                            <StatCard icon={IoPeople} label="Pessoas" value={stats.pessoas} bgClass="bg-emerald-50" colorClass="text-emerald-600" />
                            {/* MUDANÇA AQUI: Usando a formatação correta no card de totais */}
                            <StatCard icon={IoWalletOutline} label="Aberto" value={formatarReal(stats.vendas)} bgClass="bg-purple-50" colorClass="text-purple-600" />
                        </div>
                        
                        {/* Controles: Busca e Filtro */}
                        <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
                            {/* 🔍 INPUT DE BUSCA */}
                            <div className="relative w-full sm:w-32 md:w-48">
                                <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                    <IoSearch className="text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    className="block w-full pl-8 pr-8 py-2 bg-gray-50 border-0 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 placeholder-gray-400"
                                    placeholder="Mesa nº..."
                                    value={buscaMesa}
                                    onChange={(e) => setBuscaMesa(e.target.value)}
                                />
                                {buscaMesa && (
                                    <button onClick={() => setBuscaMesa('')} className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-red-500">
                                        <IoClose />
                                    </button>
                                )}
                            </div>

                            {/* FILTROS ABAS */}
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                {['todos', 'livres', 'ocupadas'].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setFiltro(t)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold capitalize transition-all ${
                                            filtro === t ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- GRID DE 100 MESAS (ALTA DENSIDADE) --- */}
                <div className="bg-white rounded-2xl p-3 border border-gray-200 shadow-sm min-h-[70vh]">
                    {mesasFiltradas.length > 0 ? (
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-3">
                            {mesasFiltradas.map(mesa => (
                                <MesaCard 
                                    key={mesa.id} 
                                    mesa={mesa} 
                                    onClick={() => handleMesaClick(mesa)} 
                                    onPagar={() => { setMesaParaPagamento(mesa); setIsModalPagamentoOpen(true); }}
                                    onExcluir={() => handleExcluirMesa(mesa.id)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-32 text-center text-gray-400">
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