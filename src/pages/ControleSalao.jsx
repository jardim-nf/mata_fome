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
    IoRefresh, 
    IoAdd, 
    IoArrowBack, 
    IoRestaurantOutline, 
    IoReceiptOutline,
    IoStatsChart,
    IoGrid,
    IoPieChart,
    IoTime,
    IoAlertCircle
} from "react-icons/io5";

// --- MODAL ABRIR MESA (Design Premium) ---
const ModalAbrirMesa = ({ isOpen, onClose, onConfirm, mesaNumero }) => {
    const [quantidade, setQuantidade] = useState(2);
    
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-lg transition-all duration-300">
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl p-8 w-full max-w-md animate-in fade-in zoom-in duration-300 border border-gray-200/60 transform hover:scale-[1.01] transition-transform">
                <div className="text-center mb-8">
                    <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/25">
                        <IoPersonAdd className="text-4xl text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Abrir Mesa {mesaNumero}</h3>
                    <p className="text-gray-500">Quantos clientes vão sentar nesta mesa?</p>
                </div>
                
                <div className="flex items-center justify-between bg-white rounded-2xl p-6 mb-8 border border-gray-200 shadow-sm">
                    <button 
                        onClick={() => setQuantidade(q => Math.max(1, q - 1))} 
                        className="w-14 h-14 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-2xl transition-all hover:text-blue-600 active:scale-95 shadow-sm"
                    >
                        -
                    </button>
                    <div className="text-center">
                        <span className="text-5xl font-black text-gray-900 block">{quantidade}</span>
                        <span className="text-sm text-gray-500 font-medium">{quantidade === 1 ? 'pessoa' : 'pessoas'}</span>
                    </div>
                    <button 
                        onClick={() => setQuantidade(q => q + 1)} 
                        className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg shadow-blue-500/30 text-white font-bold text-2xl transition-all hover:shadow-xl hover:from-blue-700 hover:to-blue-800 active:scale-95"
                    >
                        +
                    </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={onClose} 
                        className="py-4 px-4 bg-white border-2 border-gray-300 text-gray-700 rounded-2xl font-bold hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 active:scale-95"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={() => onConfirm(quantidade)} 
                        className="py-4 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-bold shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-blue-800 transition-all transform active:scale-95 relative overflow-hidden group"
                    >
                        <span className="relative z-10">Confirmar</span>
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-700 to-blue-800 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- STAT CARD PREMIUM ---
const StatCard = ({ label, value, icon, theme, subtitle }) => {
    const themes = {
        blue: { 
            bg: 'bg-gradient-to-br from-blue-50 to-blue-100/50', 
            text: 'text-blue-600', 
            value: 'text-blue-900',
            iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600',
            border: 'border-blue-200'
        },
        purple: { 
            bg: 'bg-gradient-to-br from-purple-50 to-purple-100/50', 
            text: 'text-purple-600', 
            value: 'text-purple-900',
            iconBg: 'bg-gradient-to-br from-purple-500 to-purple-600',
            border: 'border-purple-200'
        },
        green: { 
            bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50', 
            text: 'text-emerald-600', 
            value: 'text-emerald-900',
            iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
            border: 'border-emerald-200'
        },
        orange: { 
            bg: 'bg-gradient-to-br from-orange-50 to-orange-100/50', 
            text: 'text-orange-600', 
            value: 'text-orange-900',
            iconBg: 'bg-gradient-to-br from-orange-500 to-orange-600',
            border: 'border-orange-200'
        },
        gray: { 
            bg: 'bg-gradient-to-br from-gray-50 to-gray-100/50', 
            text: 'text-gray-600', 
            value: 'text-gray-900',
            iconBg: 'bg-gradient-to-br from-gray-500 to-gray-600',
            border: 'border-gray-200'
        },
    };
    
    const t = themes[theme] || themes.gray;

    return (
        <div className={`p-6 rounded-3xl border-2 ${t.border} ${t.bg} backdrop-blur-sm hover:shadow-lg transition-all duration-300 group hover:scale-[1.02]`}>
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
                    <p className={`text-3xl font-black ${t.value} tracking-tight mb-1`}>{value}</p>
                    {subtitle && <p className="text-xs font-medium text-gray-500">{subtitle}</p>}
                </div>
                <div className={`w-14 h-14 rounded-2xl ${t.iconBg} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    {icon}
                </div>
            </div>
        </div>
    );
};

// --- LOADING SPINNER PREMIUM ---
const LoadingSpinner = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50/30">
        <div className="text-center">
            <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin"></div>
                <div className="w-16 h-16 border-4 border-transparent border-t-blue-600 rounded-full animate-spin absolute top-0 left-0"></div>
            </div>
            <p className="text-gray-600 font-medium mt-4">Carregando salão...</p>
        </div>
    </div>
);

export default function ControleSalao() {
    const { userData } = useAuth(); 
    const { setActions, clearActions } = useHeader();
    const navigate = useNavigate();
    
const [mesas, setMesas] = useState([]);
const [loading, setLoading] = useState(true);
const [erroCarregamento, setErroCarregamento] = useState(false);
const [isModalOpen, setIsModalOpen] = useState(false);
const [isModalPagamentoOpen, setIsModalPagamentoOpen] = useState(false); // ✅ Já existe
const [mesaParaPagamento, setMesaParaPagamento] = useState(null); // ✅ Já existe
const [isModalAbrirMesaOpen, setIsModalAbrirMesaOpen] = useState(false);
const [mesaParaAbrir, setMesaParaAbrir] = useState(null);

    const estabelecimentoId = useMemo(() => userData?.estabelecimentosGerenciados?.[0] || null, [userData]);

    // 🎯 HEADER ACTIONS PREMIUM
    useEffect(() => {
        setActions(
            <div className="flex gap-3">
                <button 
                    onClick={() => navigate('/dashboard')} 
                    className="px-5 py-3 text-gray-600 hover:bg-gray-100 rounded-2xl font-semibold transition-all duration-200 flex items-center gap-2 border-2 border-gray-200 hover:border-gray-300 active:scale-95"
                >
                    <IoArrowBack className="text-lg"/>
                    <span className="hidden sm:inline">Voltar</span>
                </button>
                <button 
                    onClick={() => setIsModalOpen(true)} 
                    className="bg-gradient-to-r from-gray-900 to-black hover:from-black hover:to-gray-900 text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-2xl hover:shadow-3xl flex items-center gap-2 active:scale-95 group relative overflow-hidden"
                >
                    <span className="relative z-10 flex items-center gap-2">
                        <IoAdd className="text-lg"/>
                        <span className="hidden sm:inline">Nova Mesa</span>
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                </button>
            </div>
        );
        return () => clearActions();
    }, [setActions, clearActions, navigate]);

    // 🎯 CARREGAMENTO DE MESAS
    useEffect(() => {
        if (!estabelecimentoId) { 
            if (userData) setLoading(false); 
            return; 
        }
        
        setLoading(true); 
        setErroCarregamento(false);
        
        const unsubscribe = onSnapshot(
            query(collection(db, 'estabelecimentos', estabelecimentoId, 'mesas'), orderBy('numero')), 
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
            (error) => { 
                console.error('❌ Erro:', error); 
                setErroCarregamento(true); 
                setLoading(false); 
                toast.error('Erro ao carregar mesas');
            }
        );
        
        return () => unsubscribe();
    }, [estabelecimentoId, userData]);

    // 🎯 FUNÇÕES (mantidas iguais)
    const handleAdicionarMesa = async (numeroMesa) => {
        if (!numeroMesa) { toast.warning("Digite o número"); return; }
        try {
            await addDoc(collection(db, 'estabelecimentos', estabelecimentoId, 'mesas'), {
                numero: !isNaN(numeroMesa) ? Number(numeroMesa) : numeroMesa,
                status: 'livre', total: 0, pessoas: 0, itens: [], tipo: 'mesa',
                createdAt: serverTimestamp(), updatedAt: serverTimestamp()
            });
            toast.success("🎉 Mesa criada com sucesso!");
            setIsModalOpen(false);
        } catch (error) { toast.error("❌ Erro ao criar mesa."); }
    };

    const handleExcluirMesa = async (id, numero) => {
        if (!window.confirm(`Tem certeza que deseja excluir a Mesa ${numero}?`)) return;
        try { 
            await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', id)); 
            toast.success("🗑️ Mesa excluída."); 
        } catch (error) { toast.error("❌ Erro ao excluir."); }
    };

    const handleMesaClick = (mesa) => {
        if (mesa.status === 'livre') { 
            setMesaParaAbrir(mesa); 
            setIsModalAbrirMesaOpen(true); 
        } else { 
            navigate(`/estabelecimento/${estabelecimentoId}/mesa/${mesa.id}`); 
        }
    };

    const handleConfirmarAbertura = async (qtdPessoas) => {
        try {
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaParaAbrir.id), {
                status: 'ocupada', pessoas: qtdPessoas, tipo: 'mesa', updatedAt: serverTimestamp()
            });
            setIsModalAbrirMesaOpen(false);
            setMesaParaAbrir(null);
            navigate(`/estabelecimento/${estabelecimentoId}/mesa/${mesaParaAbrir.id}`);
        } catch (error) { toast.error(`❌ Erro: ${error.message}`); }
    };

    const handleEnviarParaCozinha = async (mesa) => {
        try {
            const itensNovos = mesa.itens?.filter(item => {
                const jaFoiEnviado = item.status === 'enviado' || item.status === 'entregue' || item.status === 'finalizado' || item.pedidoCozinhaId;
                return !jaFoiEnviado;
            }) || [];

            if (itensNovos.length === 0) {
                toast.warning("👨‍🍳 Tudo já foi enviado!");
                return;
            }

            const batch = writeBatch(db);
            const timestampAtual = Date.now();
            const novoPedidoId = `pedido_${mesa.id}_${timestampAtual}`;
            const agora = new Date();
            const loteHorario = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;

            const pedidoCozinhaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'pedidos', novoPedidoId);
            
            batch.set(pedidoCozinhaRef, {
                id: novoPedidoId, tipo: 'salao', status: 'recebido',
                mesaNumero: mesa.numero, mesaId: mesa.id,
                itens: itensNovos.map(item => ({ ...item, status: 'recebido', loteOrigem: timestampAtual })),
                total: itensNovos.reduce((sum, item) => sum + (item.preco * item.quantidade), 0),
                dataPedido: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
                source: 'salao', pessoas: mesa.pessoas || 1, estabelecimentoId, loteHorario,
                identificador: `M${mesa.numero}-${loteHorario}`
            });

            const itensMesaAtualizados = mesa.itens.map(item => {
                const ehItemNovo = itensNovos.some(novo => novo.id === item.id);
                if (ehItemNovo) return { ...item, status: 'enviado', pedidoCozinhaId: novoPedidoId, enviadoEm: timestampAtual, loteHorario };
                return item;
            });

            const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesa.id);
            batch.update(mesaRef, { itens: itensMesaAtualizados, status: 'com_pedido', ultimoEnvioCozinha: serverTimestamp(), updatedAt: serverTimestamp() });

            await batch.commit();
            toast.success(`🚀 Pedido enviado para a cozinha!`);
        } catch (error) { toast.error(`❌ Erro: ${error.message}`); }
    };

const handleConfirmarPagamento = async (resultadoPagamento) => {
  try {
    if (!mesaParaPagamento) return;
    
    console.log('💰 Processando pagamento para mesa:', mesaParaPagamento.numero);
    console.log('📊 Dados do pagamento:', resultadoPagamento);

    // Aqui você processa o pagamento baseado nos dados do modal
    const batch = writeBatch(db);
    const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaParaPagamento.id);
    
    // Criar registro de venda
    if (mesaParaPagamento.itens && mesaParaPagamento.itens.length > 0) {
      await addDoc(collection(db, 'estabelecimentos', estabelecimentoId, 'vendas'), {
        mesaNumero: mesaParaPagamento.numero,
        mesaId: mesaParaPagamento.id,
        total: mesaParaPagamento.total || 0,
        itens: mesaParaPagamento.itens || [],
        pagamentos: resultadoPagamento.pagamentos || {},
        dataFechamento: serverTimestamp(),
        tipo: 'salao',
        status: 'pago',
        createdAt: serverTimestamp(),
        pessoas: mesaParaPagamento.pessoas || 1,
        estabelecimentoId
      });
    }
    
    // Liberar mesa
    batch.update(mesaRef, {
      status: 'livre',
      total: 0,
      pessoas: 0,
      itens: [],
      encerradaEm: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await batch.commit();
    
    toast.success(`💰 Mesa ${mesaParaPagamento.numero} paga com sucesso!`);
    setIsModalPagamentoOpen(false);
    setMesaParaPagamento(null);
    
  } catch (error) {
    console.error('❌ Erro ao processar pagamento:', error);
    toast.error(`Erro ao processar pagamento: ${error.message}`);
  }
};

    // 🎯 CORREÇÃO AUTOMÁTICA
    const corrigirMesasExistentes = useCallback(async () => {
        try {
            for (const mesa of mesas) {
                if ((mesa.status === 'com_pedido' || mesa.status === 'ocupada') && !mesa.tipo) {
                    await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesa.id), { tipo: 'mesa', updatedAt: serverTimestamp() });
                }
            }
        } catch (error) { console.error('Erro correção', error); }
    }, [mesas, estabelecimentoId]);

    useEffect(() => { if (mesas.length > 0) corrigirMesasExistentes(); }, [mesas, corrigirMesasExistentes]);

    // 🎯 ESTATÍSTICAS MELHORADAS
    const stats = useMemo(() => {
        const mesasOcupadas = mesas.filter(m => m.status === 'ocupada' || m.status === 'com_pedido');
        const totalVendas = mesasOcupadas.reduce((acc, m) => acc + (m.total || 0), 0);
        const totalPessoas = mesasOcupadas.reduce((acc, m) => acc + (m.pessoas || 0), 0);
        const totalItensPendentes = mesasOcupadas.reduce((acc, m) => {
            const itensPendentes = m.itens?.filter(item => !item.status || item.status === 'pendente' || item.status === 'nao_enviado') || [];
            return acc + itensPendentes.length;
        }, 0);
        
        return {
            total: mesas.length,
            ocupadas: mesasOcupadas.length,
            livres: mesas.filter(m => m.status === 'livre').length,
            pessoas: totalPessoas,
            vendas: totalVendas,
            itensPendentes: totalItensPendentes,
            ocupacaoPercent: mesas.length > 0 ? Math.round((mesasOcupadas.length / mesas.length) * 100) : 0
        };
    }, [mesas]);

    // 🎯 RENDERS CONDICIONAIS
    if (loading) return <LoadingSpinner />;
    
    if (erroCarregamento) return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50/30">
            <div className="text-center p-8">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <IoAlertCircle className="text-3xl text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Erro ao carregar dados</h3>
                <p className="text-gray-600 mb-6">Verifique sua conexão e tente novamente.</p>
                <button 
                    onClick={() => window.location.reload()} 
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-lg hover:shadow-xl"
                >
                    Tentar Novamente
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/20 to-purple-50/10 p-6">
            <div className="max-w-[1600px] mx-auto">
                {/* MODAIS */}
<AdicionarMesaModal 
  isOpen={isModalOpen} 
  onClose={() => setIsModalOpen(false)} 
  onSave={handleAdicionarMesa}
  mesasExistentes={mesas} // ← ADICIONE ESTA LINHA
/>                <ModalAbrirMesa isOpen={isModalAbrirMesaOpen} onClose={() => { setIsModalAbrirMesaOpen(false); setMesaParaAbrir(null); }} onConfirm={handleConfirmarAbertura} mesaNumero={mesaParaAbrir?.numero} />
{isModalPagamentoOpen && mesaParaPagamento && (
  <ModalPagamento 
    mesa={mesaParaPagamento}
    estabelecimentoId={estabelecimentoId}
    onClose={() => {
      setIsModalPagamentoOpen(false);
      setMesaParaPagamento(null);
    }}
    onSucesso={handleConfirmarPagamento}
  />
)}
                {/* HEADER DASHBOARD PREMIUM */}
                <div className="mb-10">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-3 h-12 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full"></div>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Controle de Salão</h1>
                            <p className="text-gray-500 mt-1 text-lg">Gerencie a ocupação e os pedidos em tempo real</p>
                        </div>
                    </div>
                    
                    {/* BARRA DE STATUS */}
                    <div className="flex flex-wrap items-center gap-4 bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-gray-200/60 shadow-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium text-gray-700">{stats.livres} Livres</span>
                        </div>
                        <div className="w-px h-4 bg-gray-300"></div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium text-gray-700">{stats.ocupadas} Ocupadas</span>
                        </div>
                        <div className="w-px h-4 bg-gray-300"></div>
                        <div className="flex items-center gap-2">
                            <IoTime className="text-orange-500 text-lg" />
                            <span className="text-sm font-medium text-gray-700">{stats.itensPendentes} Itens Pendentes</span>
                        </div>
                    </div>
                </div>

                {/* ESTATÍSTICAS PREMIUM */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 mb-12">
                    <StatCard 
                        label="Ocupação Atual" 
                        value={`${stats.ocupadas}/${stats.total}`} 
                        subtitle={`${stats.ocupacaoPercent}% ocupado`}
                        theme="blue" 
                        icon={<IoGrid className="text-2xl"/>} 
                    />
                    <StatCard 
                        label="Taxa de Ocupação" 
                        value={`${stats.ocupacaoPercent}%`} 
                        subtitle="Capacidade do salão"
                        theme="purple" 
                        icon={<IoPieChart className="text-2xl"/>} 
                    />
                    <StatCard 
                        label="Clientes no Salão" 
                        value={stats.pessoas} 
                        subtitle="Pessoas atendidas"
                        theme="green" 
                        icon={<IoPeople className="text-2xl"/>} 
                    />
                    <StatCard 
                        label="Mesas Disponíveis" 
                        value={stats.livres} 
                        subtitle="Prontas para uso"
                        theme="gray" 
                        icon={<IoRestaurantOutline className="text-2xl"/>} 
                    />
                    <StatCard 
                        label="Pedidos Pendentes" 
                        value={stats.itensPendentes} 
                        subtitle="Aguardando envio"
                        theme="orange" 
                        icon={<IoReceiptOutline className="text-2xl"/>} 
                    />
                </div>

{/* ÁREA DO SALÃO PREMIUM */}
<div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-gray-200/60 min-h-[600px]">
    <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-10 gap-6">
        <div>
            <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3 mb-2">
                <div className="w-3 h-8 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full"></div>
                Salão Principal
            </h2>
            <p className="text-gray-500 ml-6">Visualize e gerencie todas as mesas do estabelecimento</p>
        </div>
        
        {/* LEGENDA DE STATUS MELHORADA */}
        <div className="flex flex-wrap items-center gap-3 text-sm font-semibold bg-white px-6 py-3 rounded-2xl border-2 border-gray-200 shadow-sm">
            <span className="flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full shadow-sm"></span>
                <span className="text-gray-700">Livre</span>
            </span>
            <span className="w-px h-4 bg-gray-300"></span>
            <span className="flex items-center gap-2">
                <span className="w-3 h-3 bg-red-500 rounded-full shadow-sm animate-pulse"></span>
                <span className="text-gray-700">Ocupada</span>
            </span>
            <span className="w-px h-4 bg-gray-300"></span>
            <span className="flex items-center gap-2">
                <span className="w-3 h-3 bg-orange-500 rounded-full shadow-sm animate-pulse"></span>
                <span className="text-gray-700">Com Pedido</span>
            </span>
        </div>
    </div>

    {mesas.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-6">
            {mesas.map(mesa => (
                <MesaCard 
                    key={mesa.id} 
                    mesa={mesa} 
                    onClick={() => handleMesaClick(mesa)} 
                    onExcluir={() => handleExcluirMesa(mesa.id, mesa.numero)}
                    onPagar={() => { setMesaParaPagamento(mesa); setIsModalPagamentoOpen(true); }}
                    onEnviarCozinha={() => handleEnviarParaCozinha(mesa)}
                />
            ))}
        </div>
    ) : (
        <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-32 h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-8 shadow-lg">
                <IoRestaurantOutline className="text-5xl text-gray-400" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-4">Nenhuma mesa configurada</h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto text-lg">
                Comece adicionando mesas para organizar e visualizar o mapa completo do seu salão.
            </p>
            <button 
                onClick={() => setIsModalOpen(true)} 
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-black py-4 px-12 rounded-2xl shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 active:scale-95 text-lg"
            >
                + Criar Primeira Mesa
            </button>
        </div>
    )}
</div>
            </div>
        </div>
    );
}