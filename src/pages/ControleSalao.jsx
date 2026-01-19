import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, addDoc, doc, deleteDoc, updateDoc, serverTimestamp, query, orderBy, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext"; 
import { useHeader } from '../context/HeaderContext';
import { toast } from 'react-toastify';
import MesaCard from "../components/MesaCard";
import AdicionarMesaModal from "../components/AdicionarMesaModal";
import ModalPagamento from "../components/ModalPagamento";
import { 
    IoPeople, 
    IoPersonAdd, 
    IoArrowBack, 
    IoAdd, 
    IoRestaurantOutline, 
    IoReceiptOutline,
    IoGrid,
    IoTime,
    IoAlertCircle,
    IoWalletOutline,
    IoFilter
} from "react-icons/io5";

// --- COMPONENTE: STAT CARD (Novo) ---
const StatCard = ({ icon: Icon, label, value, subtext, colorClass, bgClass, alert }) => (
    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-start justify-between relative overflow-hidden group hover:shadow-md transition-all">
        <div className="relative z-10">
            <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
            <h3 className="text-2xl font-black text-gray-900">{value}</h3>
            {subtext && <p className="text-xs font-medium text-gray-500 mt-1">{subtext}</p>}
        </div>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${bgClass} ${colorClass} group-hover:scale-110 transition-transform`}>
            <Icon />
        </div>
        {alert && (
            <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-white -mr-1 -mt-1"></div>
        )}
    </div>
);

// --- MODAL ABRIR MESA (Mantido o design clean) ---
const ModalAbrirMesa = ({ isOpen, onClose, onConfirm, mesaNumero }) => {
    const [quantidade, setQuantidade] = useState(2);
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] shadow-2xl p-8 w-full max-w-md border border-gray-100 transform transition-all scale-100">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
                        <IoPersonAdd className="text-3xl text-blue-600" />
                    </div>
                    <h3 className="text-2xl font-black text-gray-900 mb-1">Abrir Mesa {mesaNumero}</h3>
                    <p className="text-gray-500 font-medium">Quantos clientes?</p>
                </div>
                
                <div className="flex items-center justify-between bg-gray-50 rounded-3xl p-4 mb-8 border border-gray-100">
                    <button onClick={() => setQuantidade(q => Math.max(1, q - 1))} className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-gray-200 text-gray-700 font-bold text-2xl hover:bg-gray-50 active:scale-95 transition-all">-</button>
                    <div className="text-center">
                        <span className="text-5xl font-black text-gray-900 tracking-tighter">{quantidade}</span>
                        <span className="text-xs font-bold text-gray-400 uppercase block mt-1">Pessoas</span>
                    </div>
                    <button onClick={() => setQuantidade(q => q + 1)} className="w-14 h-14 rounded-2xl bg-blue-600 shadow-lg shadow-blue-200 text-white font-bold text-2xl hover:bg-blue-700 active:scale-95 transition-all">+</button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={onClose} className="py-4 bg-gray-50 text-gray-600 rounded-2xl font-bold hover:bg-gray-100 transition-colors">Cancelar</button>
                    <button onClick={() => onConfirm(quantidade)} className="py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-lg hover:bg-black transition-all transform active:scale-95">Confirmar</button>
                </div>
            </div>
        </div>
    );
};

// --- LOADING SPINNER ---
const LoadingSpinner = () => (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400 font-bold text-sm tracking-widest uppercase">Carregando...</p>
        </div>
    </div>
);

export default function ControleSalao() {
    const { userData } = useAuth(); 
    const { setActions, clearActions } = useHeader();
    const navigate = useNavigate();
    
    // Estados
    const [mesas, setMesas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState('todos'); // 'todos', 'livres', 'ocupadas'
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Modais e Ações
    const [isModalPagamentoOpen, setIsModalPagamentoOpen] = useState(false);
    const [mesaParaPagamento, setMesaParaPagamento] = useState(null);
    const [isModalAbrirMesaOpen, setIsModalAbrirMesaOpen] = useState(false);
    const [mesaParaAbrir, setMesaParaAbrir] = useState(null);

    const estabelecimentoId = useMemo(() => userData?.estabelecimentosGerenciados?.[0] || null, [userData]);

    // HEADER ACTIONS
    useEffect(() => {
        setActions(
            <button 
                onClick={() => setIsModalOpen(true)} 
                className="bg-gray-900 hover:bg-black text-white font-bold py-2.5 px-5 rounded-xl shadow-lg flex items-center gap-2 active:scale-95 transition-all"
            >
                <IoAdd className="text-xl"/>
                <span className="hidden sm:inline">Adicionar Mesa</span>
            </button>
        );
        return () => clearActions();
    }, [setActions, clearActions]);

    // FETCH MESAS
    useEffect(() => {
        if (!estabelecimentoId) { if (userData) setLoading(false); return; }
        setLoading(true); 
        
        const unsubscribe = onSnapshot(
            query(collection(db, 'estabelecimentos', estabelecimentoId, 'mesas'), orderBy('numero')), 
            (snapshot) => {
                const mesasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Ordenação numérica robusta
                mesasData.sort((a, b) => {
                    const numA = parseFloat(a.numero);
                    const numB = parseFloat(b.numero);
                    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                    return String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true });
                });
                setMesas(mesasData); 
                setLoading(false);
            },
            (error) => { console.error(error); setLoading(false); toast.error('Erro ao carregar mesas'); }
        );
        return () => unsubscribe();
    }, [estabelecimentoId, userData]);

    // FUNÇÕES DE AÇÃO
    const handleAdicionarMesa = async (numeroMesa) => {
        if (!numeroMesa) return;
        try {
            await addDoc(collection(db, 'estabelecimentos', estabelecimentoId, 'mesas'), {
                numero: !isNaN(numeroMesa) ? Number(numeroMesa) : numeroMesa,
                status: 'livre', total: 0, pessoas: 0, itens: [], tipo: 'mesa',
                createdAt: serverTimestamp(), updatedAt: serverTimestamp()
            });
            toast.success("Mesa criada!");
            setIsModalOpen(false);
        } catch (error) { toast.error("Erro ao criar mesa."); }
    };

    const handleExcluirMesa = async (id) => {
        if (!window.confirm(`Excluir mesa?`)) return;
        try { await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', id)); toast.success("Mesa excluída."); } 
        catch (error) { toast.error("Erro ao excluir."); }
    };

    const handleMesaClick = (mesa) => {
        if (mesa.status === 'livre') { 
            setMesaParaAbrir(mesa); setIsModalAbrirMesaOpen(true); 
        } else { 
            navigate(`/estabelecimento/${estabelecimentoId}/mesa/${mesa.id}`); 
        }
    };

    const handleConfirmarAbertura = async (qtd) => {
        try {
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaParaAbrir.id), {
                status: 'ocupada', pessoas: qtd, tipo: 'mesa', updatedAt: serverTimestamp()
            });
            setIsModalAbrirMesaOpen(false);
            navigate(`/estabelecimento/${estabelecimentoId}/mesa/${mesaParaAbrir.id}`);
        } catch (error) { toast.error("Erro ao abrir mesa"); }
    };

    const handleConfirmarPagamento = async (resultado) => {
        if (!mesaParaPagamento) return;
        try {
            const batch = writeBatch(db);
            const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaParaPagamento.id);
            
            // Registra Venda
            await addDoc(collection(db, 'estabelecimentos', estabelecimentoId, 'vendas'), {
                mesaNumero: mesaParaPagamento.numero,
                mesaId: mesaParaPagamento.id,
                total: mesaParaPagamento.total || 0,
                itens: mesaParaPagamento.itens || [],
                pagamentos: resultado.pagamentos || {},
                dataFechamento: serverTimestamp(),
                tipo: 'salao', status: 'pago',
                estabelecimentoId
            });
            
            // Reseta Mesa
            batch.update(mesaRef, { status: 'livre', total: 0, pessoas: 0, itens: [], updatedAt: serverTimestamp() });
            await batch.commit();
            
            toast.success(`Mesa ${mesaParaPagamento.numero} finalizada!`);
            setIsModalPagamentoOpen(false);
        } catch (error) { toast.error("Erro no pagamento"); }
    };

    // STATS & FILTROS
    const stats = useMemo(() => {
        const ocupadas = mesas.filter(m => m.status === 'ocupada' || m.status === 'com_pedido');
        const pendentes = ocupadas.reduce((acc, m) => acc + (m.itens?.filter(i => !i.status || i.status === 'pendente').length || 0), 0);
        const totalVendas = ocupadas.reduce((acc, m) => acc + (m.total || 0), 0);
        
        return {
            total: mesas.length,
            ocupadas: ocupadas.length,
            livres: mesas.length - ocupadas.length,
            pessoas: ocupadas.reduce((acc, m) => acc + (m.pessoas || 0), 0),
            pendentes,
            vendas: totalVendas,
            ocupacaoPercent: mesas.length > 0 ? Math.round((ocupadas.length / mesas.length) * 100) : 0
        };
    }, [mesas]);

    const mesasFiltradas = useMemo(() => {
        if (filtro === 'livres') return mesas.filter(m => m.status === 'livre');
        if (filtro === 'ocupadas') return mesas.filter(m => m.status !== 'livre');
        return mesas;
    }, [mesas, filtro]);

    if (loading) return <LoadingSpinner />;

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-8 pb-20">
            <div className="max-w-[1600px] mx-auto">
                <AdicionarMesaModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleAdicionarMesa} mesasExistentes={mesas} />
                <ModalAbrirMesa isOpen={isModalAbrirMesaOpen} onClose={() => setIsModalAbrirMesaOpen(false)} onConfirm={handleConfirmarAbertura} mesaNumero={mesaParaAbrir?.numero} />
                {isModalPagamentoOpen && mesaParaPagamento && (
                    <ModalPagamento 
                        mesa={mesaParaPagamento} establishmentId={estabelecimentoId}
                        onClose={() => setIsModalPagamentoOpen(false)} onSucesso={handleConfirmarPagamento}
                    />
                )}

                {/* HEADER SUPERIOR */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-gray-600 font-bold text-sm flex items-center gap-1 mb-1 transition-colors">
                            <IoArrowBack /> Dashboard
                        </button>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Gestão de Salão</h1>
                        <p className="text-gray-500">Acompanhe a ocupação em tempo real</p>
                    </div>
                    
                    {/* FILTROS (TABS) */}
                    <div className="bg-white p-1 rounded-xl border border-gray-200 shadow-sm flex">
                        {[
                            { id: 'todos', label: 'Todas', count: stats.total },
                            { id: 'livres', label: 'Livres', count: stats.livres },
                            { id: 'ocupadas', label: 'Ocupadas', count: stats.ocupadas }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setFiltro(tab.id)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                    filtro === tab.id 
                                        ? 'bg-gray-900 text-white shadow-md' 
                                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                                }`}
                            >
                                {tab.label} <span className={`ml-1 text-xs ${filtro === tab.id ? 'opacity-80' : 'opacity-50'}`}>({tab.count})</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* GRID DE CARDS (KPIs) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <StatCard 
                        icon={IoGrid} 
                        label="Ocupação" 
                        value={`${stats.ocupacaoPercent}%`} 
                        subtext={`${stats.ocupadas} de ${stats.total} mesas`}
                        bgClass="bg-blue-50" colorClass="text-blue-600"
                    />
                    <StatCard 
                        icon={IoPeople} 
                        label="Clientes" 
                        value={stats.pessoas} 
                        subtext="Pessoas sentadas"
                        bgClass="bg-emerald-50" colorClass="text-emerald-600"
                    />
                    <StatCard 
                        icon={IoWalletOutline} 
                        label="Vendas (Aberto)" 
                        value={stats.vendas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} 
                        subtext="Consumo atual"
                        bgClass="bg-purple-50" colorClass="text-purple-600"
                    />
                    <StatCard 
                        icon={IoReceiptOutline} 
                        label="Pedidos" 
                        value={stats.pendentes} 
                        subtext="Itens pendentes"
                        bgClass="bg-orange-50" colorClass="text-orange-600"
                        alert={stats.pendentes > 0}
                    />
                </div>

                {/* ÁREA PRINCIPAL DAS MESAS */}
                <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-gray-200 shadow-sm min-h-[500px]">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${filtro === 'livres' ? 'bg-green-500' : filtro === 'ocupadas' ? 'bg-orange-500' : 'bg-gray-900'}`}></span>
                            Mesas {filtro === 'todos' ? '' : filtro === 'livres' ? 'Disponíveis' : 'Em Atendimento'}
                        </h2>
                    </div>

                    {mesasFiltradas.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                            {mesasFiltradas.map(mesa => (
                                <MesaCard 
                                    key={mesa.id} 
                                    mesa={mesa} 
                                    onClick={() => handleMesaClick(mesa)} 
                                    onPagar={() => { setMesaParaPagamento(mesa); setIsModalPagamentoOpen(true); }}
                                    onExcluir={() => handleExcluirMesa(mesa.id)}
                                    // A prop onEnviarCozinha deve ser passada se seu MesaCard a utilizar
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
                            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                <IoFilter className="text-4xl text-gray-300" />
                            </div>
                            <p className="text-lg font-medium text-gray-500">Nenhuma mesa encontrada neste filtro.</p>
                            {filtro !== 'todos' && (
                                <button onClick={() => setFiltro('todos')} className="mt-4 text-blue-600 font-bold hover:underline">
                                    Ver todas as mesas
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}