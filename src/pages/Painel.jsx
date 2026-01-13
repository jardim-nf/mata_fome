import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { 
    collection, query, where, orderBy, onSnapshot, 
    doc, updateDoc, deleteDoc, getDoc,
    serverTimestamp
} from 'firebase/firestore';
import { toast } from 'react-toastify';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import PedidoCard from "../components/PedidoCard";
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { IoTime, IoArrowBack, IoCalendarOutline } from "react-icons/io5"; // Adicionei ícone de calendário

// ==========================================
// 📦 COMPONENTE DE GRUPO (MESA/COZINHA)
// ==========================================
const GrupoPedidosMesa = ({ pedidos, onUpdateStatus, onExcluir, newOrderIds, estabelecimentoInfo }) => {
    const pedidosAgrupados = useMemo(() => {
        const grupos = {};
        pedidos.forEach(pedido => {
            if (!pedido || !pedido.id) return;
            
            const chave = `${pedido.mesaNumero || '0'}-${pedido.loteHorario || 'principal'}`;
            if (!grupos[chave]) {
                grupos[chave] = {
                    mesaNumero: pedido.mesaNumero || 0,
                    loteHorario: pedido.loteHorario || '',
                    pedidos: [],
                    totalItens: 0,
                    status: pedido.status || 'recebido',
                    pessoas: pedido.pessoas || 1
                };
            }
            grupos[chave].pedidos.push(pedido);
            grupos[chave].totalItens += pedido.itens?.length || 0;
        });
        return Object.values(grupos);
    }, [pedidos]);

    if (pedidosAgrupados.length === 0) return <div className="text-center py-4 text-gray-400">Sem pedidos na cozinha</div>;

    return (
        <div className="space-y-4">
            {pedidosAgrupados.map((grupo, index) => (
                <div key={`grupo-${grupo.mesaNumero}-${index}`} className="border border-amber-200 rounded-xl bg-amber-50/50 overflow-hidden">
                    <div className="bg-white px-4 py-3 border-b border-amber-200 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <span className="font-bold text-gray-900 text-lg">Mesa {grupo.mesaNumero}</span>
                            {grupo.loteHorario && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex items-center gap-1">
                                    <IoTime className="w-3 h-3"/> {grupo.loteHorario}
                                </span>
                            )}
                        </div>
                        <span className="text-xs font-semibold text-gray-500">{grupo.totalItens} itens</span>
                    </div>
                    <div className="p-4 space-y-3">
                        {grupo.pedidos.map(pedido => (
                            <PedidoCard
                                key={pedido.id || `pedido-${Date.now()}-${Math.random()}`}
                                item={pedido}
                                onUpdateStatus={onUpdateStatus}
                                onExcluir={onExcluir}
                                newOrderIds={newOrderIds}
                                estabelecimentoInfo={estabelecimentoInfo}
                                showMesaInfo={false}
                                isAgrupado={true}
                                motoboysDisponiveis={[]}
                                onAtribuirMotoboy={null}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

// ==========================================
// 🚀 COMPONENTE PRINCIPAL (PAINEL)
// ==========================================
function Painel() {
    const navigate = useNavigate(); 
    const audioRef = useRef(null);
    const { logout, loading: authLoading, estabelecimentosGerenciados } = useAuth();
    
    // --- ESTADOS ---
    const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
    const [pedidos, setPedidos] = useState({ 
        recebido: [], preparo: [], em_entrega: [], pronto_para_servir: [], finalizado: [] 
    });
    const [loading, setLoading] = useState(true);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [userInteracted, setUserInteracted] = useState(false);
    const [newOrderIds, setNewOrderIds] = useState(new Set());
    const [abaAtiva, setAbaAtiva] = useState('delivery');
    const [motoboys, setMotoboys] = useState([]);
    const [bloqueioAtualizacao, setBloqueioAtualizacao] = useState(new Set());
    
    // DATA DE HOJE PARA EXIBIÇÃO
    const dataHojeFormatada = new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

    const isUpdatingRef = useRef(false);
    const prevRecebidosRef = useRef([]);

    // SELEÇÃO AUTOMÁTICA DE ESTABELECIMENTO
    const estabelecimentoAtivo = useMemo(() => {
        if (!estabelecimentosGerenciados || estabelecimentosGerenciados.length === 0) return null;
        return estabelecimentosGerenciados[0]; 
    }, [estabelecimentosGerenciados]);

    // RESETAR DADOS QUANDO ESTABELECIMENTO MUDAR
    useEffect(() => {
        setPedidos({ recebido: [], preparo: [], em_entrega: [], pronto_para_servir: [], finalizado: [] });
        setMotoboys([]);
        setNewOrderIds(new Set());
        setEstabelecimentoInfo(null);
        setLoading(true);
    }, [estabelecimentoAtivo]);

    // FUNÇÃO PARA LIMPAR DADOS DO CLIENTE
    const limparDadosCliente = useCallback((clienteData) => {
        if (!clienteData) return { nome: 'Cliente', telefone: '', endereco: {} };
        
        if (typeof clienteData === 'object' && ('_methodName' in clienteData || 'toDate' in clienteData)) {
             return { nome: 'Cliente', telefone: '', endereco: {} };
        }
        
        if (typeof clienteData === 'object') {
            return {
                nome: clienteData.nome || 'Cliente',
                telefone: clienteData.telefone || '',
                endereco: clienteData.endereco && typeof clienteData.endereco === 'object' ? clienteData.endereco : {}
            };
        }
        
        return { nome: 'Cliente', telefone: '', endereco: {} };
    }, []);

    // FUNÇÃO PARA CRIAR PEDIDO FALLBACK
    const criarPedidoFallback = useCallback((id, source) => ({
        id: id || `fallback-${Date.now()}`,
        cliente: { nome: 'Cliente', telefone: '' },
        endereco: {},
        status: 'recebido',
        itens: [],
        source: source,
        tipo: source === 'salao' ? 'salao' : 'delivery',
        createdAt: new Date(),
        dataPedido: new Date()
    }), []);

    // BUSCAR MOTOBOYS
    useEffect(() => {
        if (!estabelecimentoAtivo) {
            setMotoboys([]);
            return;
        }
        
        try {
            const qMotoboys = query(
                collection(db, 'estabelecimentos', estabelecimentoAtivo, 'entregadores'),
                where('ativo', '==', true)
            );
            
            const unsubscribe = onSnapshot(qMotoboys, (snapshot) => {
                const lista = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        nome: data.nome || 'Sem nome',
                        telefone: data.telefone || '',
                        taxaEntrega: Number(data.taxaEntrega) || 0,
                        ativo: data.ativo || false,
                        ...data
                    };
                });
                setMotoboys(lista);
            }, (error) => {
                console.error("❌ Erro ao buscar motoboys:", error);
                setMotoboys([]);
            });

            return () => unsubscribe();
        } catch (error) {
            console.error("❌ Erro na query de motoboys:", error);
            setMotoboys([]);
        }
    }, [estabelecimentoAtivo]);

    // ATRIBUIR MOTOBOY
    const handleAtribuirMotoboy = useCallback(async (pedidoId, motoboyId, motoboyNome, source) => {
        if (!pedidoId || !motoboyId || !motoboyNome) {
            toast.error("Dados incompletos para atribuição");
            return;
        }
        
        try {
            const pedidoRef = source === 'salao'
                ? doc(db, 'estabelecimentos', estabelecimentoAtivo, 'pedidos', pedidoId)
                : doc(db, 'pedidos', pedidoId);

            await updateDoc(pedidoRef, {
                motoboyId: motoboyId,
                motoboyNome: motoboyNome,
                status: 'em_entrega',
                atualizadoEm: serverTimestamp()
            });
            
            toast.success(`🚀 ${motoboyNome} atribuído ao pedido!`);
        } catch (error) {
            console.error("Erro ao atribuir motoboy:", error);
            toast.error("Erro ao atribuir motoboy. Verifique as permissões.");
        }
    }, [estabelecimentoAtivo]);

    const handleExcluirPedido = useCallback(async (pedidoId, source) => {
        if (!pedidoId || !source) {
            toast.error("Dados incompletos para exclusão");
            return;
        }
        
        if (!window.confirm("Cancelar este pedido?")) return;
        try {
            const pedidoRef = source === 'salao'
                ? doc(db, 'estabelecimentos', estabelecimentoAtivo, 'pedidos', pedidoId)
                : doc(db, 'pedidos', pedidoId);
            await deleteDoc(pedidoRef);
            toast.success("Pedido excluído!");
        } catch (error) {
            console.error("Erro ao excluir pedido:", error);
            toast.error("Erro ao excluir: " + error.message);
        }
    }, [estabelecimentoAtivo]);

    const handleUpdateStatusAndNotify = useCallback(async (pedidoId, newStatus) => {
        if (isUpdatingRef.current || bloqueioAtualizacao.has(pedidoId)) return;
        if (!pedidoId || !newStatus) {
            toast.error("Dados incompletos para atualização");
            return;
        }
        
        try {
            isUpdatingRef.current = true;
            setBloqueioAtualizacao(prev => new Set(prev).add(pedidoId));
            
            const allPedidos = Object.values(pedidos).flat();
            const pedidoData = allPedidos.find(p => p.id === pedidoId);
            if (!pedidoData) {
                throw new Error("Pedido não encontrado na memória.");
            }

            const pedidoRef = pedidoData.source === 'salao'
                ? doc(db, 'estabelecimentos', estabelecimentoAtivo, 'pedidos', pedidoId)
                : doc(db, 'pedidos', pedidoId);

            await updateDoc(pedidoRef, { 
                status: newStatus, 
                atualizadoEm: serverTimestamp() 
            });
            
            toast.success(`📦 Movido para ${newStatus.replace(/_/g, ' ')}!`);
        } catch (error) { 
            console.error("Erro ao atualizar status:", error);
            toast.error(`❌ Falha ao mover: ${error.message}`); 
        } finally {
            setTimeout(() => {
                isUpdatingRef.current = false;
                setBloqueioAtualizacao(prev => {
                    const novo = new Set(prev);
                    novo.delete(pedidoId);
                    return novo;
                });
            }, 1000);
        }
    }, [pedidos, estabelecimentoAtivo, bloqueioAtualizacao]);

    const processarDadosPedido = useCallback((pedidoData, source, tipo) => {
        if (!pedidoData || !pedidoData.id) {
            console.warn('⚠️ Pedido sem dados ou ID encontrado');
            return criarPedidoFallback(pedidoData?.id || 'no-id', source);
        }
        
        const clienteLimpo = limparDadosCliente(pedidoData.cliente);
        let endereco = pedidoData.endereco || {};
        
        if (clienteLimpo.endereco && typeof clienteLimpo.endereco === 'object') {
            endereco = { ...endereco, ...clienteLimpo.endereco };
        }
        
        return {
            ...pedidoData,
            id: pedidoData.id,
            cliente: clienteLimpo,
            endereco: endereco,
            source: source,
            tipo: tipo || pedidoData.tipo || (source === 'salao' ? 'salao' : 'delivery'),
            status: pedidoData.status || 'recebido',
            itens: pedidoData.itens || [],
            mesaNumero: pedidoData.mesaNumero || 0,
            loteHorario: pedidoData.loteHorario || ''
        };
    }, [limparDadosCliente, criarPedidoFallback]);

    // LISTENERS DE PEDIDOS
    useEffect(() => {
        if (authLoading) return;
        if (!estabelecimentoAtivo) { 
            setPedidos({ recebido: [], preparo: [], em_entrega: [], pronto_para_servir: [], finalizado: [] });
            setLoading(false); 
            return; 
        }

        // --- DEFINIÇÃO DO INÍCIO DO DIA (00:00) ---
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        // Helper para checar se é de hoje
        const isPedidoDeHoje = (timestamp) => {
            if (!timestamp) return true; // Se acabou de criar pode estar sem timestamp, assume hoje
            let date;
            if (timestamp.toDate) date = timestamp.toDate();
            else if (timestamp.seconds) date = new Date(timestamp.seconds * 1000);
            else date = new Date(timestamp);
            
            return date >= startOfToday;
        };

        let unsubscribers = [];
        const setupPainel = async () => {
            try {
                setPedidos({ recebido: [], preparo: [], em_entrega: [], pronto_para_servir: [], finalizado: [] });
                
                const estDocRef = doc(db, 'estabelecimentos', estabelecimentoAtivo);
                getDoc(estDocRef).then(snap => { 
                    if (snap.exists()) {
                        setEstabelecimentoInfo(snap.data()); 
                    }
                }).catch(error => {
                    console.error("Erro ao buscar dados do estabelecimento:", error);
                });

                // LISTENER SALÃO
                const qSalao = query(
                    collection(db, 'estabelecimentos', estabelecimentoAtivo, 'pedidos'),
                    orderBy('dataPedido', 'asc')
                );
                
                unsubscribers.push(onSnapshot(qSalao, (snapshot) => {
                    const pedidosSalao = snapshot.docs.map(d => {
                        const data = d.data();
                        if (!data) return null;
                        
                        // FILTRO DE DATA NO LADO DO CLIENTE
                        const dataRef = data.dataPedido || data.createdAt;
                        if (!isPedidoDeHoje(dataRef)) return null;

                        return processarDadosPedido({ id: d.id, ...data }, 'salao', 'salao');
                    }).filter(p => p !== null);
                    
                    setPedidos(prev => {
                        const novoEstado = {
                            recebido: [...prev.recebido.filter(p => p.source === 'global'), ...pedidosSalao.filter(p => p.status === 'recebido')],
                            preparo: [...prev.preparo.filter(p => p.source === 'global'), ...pedidosSalao.filter(p => p.status === 'preparo')],
                            pronto_para_servir: [...prev.pronto_para_servir.filter(p => p.source === 'global'), ...pedidosSalao.filter(p => p.status === 'pronto_para_servir')],
                            finalizado: [...prev.finalizado.filter(p => p.source === 'global'), ...pedidosSalao.filter(p => p.status === 'finalizado')],
                            em_entrega: prev.em_entrega.filter(p => p.source === 'global')
                        };
                        return novoEstado;
                    });
                }, (error) => {
                    console.error("❌ Erro no listener do salão:", error);
                }));

                // LISTENER DELIVERY
                const qGlobal = query(
                    collection(db, 'pedidos'), 
                    where('estabelecimentoId', '==', estabelecimentoAtivo),
                    where('status', 'in', ['recebido', 'preparo', 'em_entrega', 'finalizado']),
                    orderBy('createdAt', 'asc')
                );
                
                unsubscribers.push(onSnapshot(qGlobal, (snapshot) => {
                    const pedidosDelivery = snapshot.docs.map(d => {
                        const data = d.data();
                        if (!data) return null;

                        // FILTRO DE DATA NO LADO DO CLIENTE
                        const dataRef = data.createdAt;
                        if (!isPedidoDeHoje(dataRef)) return null;

                        return processarDadosPedido({ id: d.id, ...data }, 'global', data.tipo || 'delivery');
                    }).filter(p => p !== null);
                    
                    setPedidos(prev => {
                        const novoEstado = {
                            recebido: [...prev.recebido.filter(p => p.source === 'salao'), ...pedidosDelivery.filter(p => p.status === 'recebido')],
                            preparo: [...prev.preparo.filter(p => p.source === 'salao'), ...pedidosDelivery.filter(p => p.status === 'preparo')],
                            em_entrega: [...prev.em_entrega.filter(p => p.source === 'salao'), ...pedidosDelivery.filter(p => p.status === 'em_entrega')],
                            finalizado: [...prev.finalizado.filter(p => p.source === 'salao'), ...pedidosDelivery.filter(p => p.status === 'finalizado')],
                            pronto_para_servir: prev.pronto_para_servir.filter(p => p.source === 'salao') 
                        };
                        return novoEstado;
                    });
                }, (error) => {
                    console.error("❌ Erro no listener do delivery:", error);
                }));
                
                setLoading(false);
            } catch (error) {
                console.error("❌ Erro ao configurar painel:", error);
                toast.error("Erro ao conectar ao banco de dados");
                setLoading(false);
            }
        };
        
        setupPainel();
        
        return () => {
            unsubscribers.forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') unsubscribe();
            });
            setPedidos({ recebido: [], preparo: [], em_entrega: [], pronto_para_servir: [], finalizado: [] });
        };
    }, [estabelecimentoAtivo, authLoading, processarDadosPedido]);

    // SONS E NOTIFICAÇÕES
    useEffect(() => {
        const currentRecebidos = pedidos.recebido;
        if (currentRecebidos.length > prevRecebidosRef.current.length) {
            const newOrders = currentRecebidos.filter(c => 
                !prevRecebidosRef.current.some(p => p.id === c.id)
            );
            
            if (newOrders.length > 0) {
                const newIds = newOrders.map(order => order.id);
                setNewOrderIds(prev => new Set([...prev, ...newIds]));
                
                if (notificationsEnabled && userInteracted) {
                    audioRef.current?.play().catch(error => {
                        console.warn("Erro ao tocar áudio:", error);
                    });
                }
                
                setTimeout(() => {
                    setNewOrderIds(prev => {
                        const updated = new Set(prev);
                        newIds.forEach(id => updated.delete(id));
                        return updated;
                    });
                }, 15000);
            }
        }
        prevRecebidosRef.current = currentRecebidos;
    }, [pedidos.recebido, notificationsEnabled, userInteracted]);

    const toggleNotifications = () => {
        const novoStatus = !notificationsEnabled;
        setNotificationsEnabled(novoStatus);
        if (novoStatus) {
            toast.success('🔔 Som ON');
        } else {
            toast.warn('🔕 Som OFF');
        }
    };

    useEffect(() => {
        const unlockAudio = () => { 
            setUserInteracted(true); 
            window.removeEventListener('click', unlockAudio); 
        };
        window.addEventListener('click', unlockAudio);
        return () => window.removeEventListener('click', unlockAudio);
    }, []);

    const colunas = useMemo(() => {
        if (abaAtiva === 'cozinha') {
            return ['recebido', 'preparo', 'pronto_para_servir', 'finalizado'];
        } else {
            return ['recebido', 'preparo', 'em_entrega', 'finalizado'];
        }
    }, [abaAtiva]);

    const STATUS_CONFIG = {
        recebido: { title: '📥 Recebido', color: 'border-l-red-500', countColor: 'bg-red-500' },
        preparo: { title: '👨‍🍳 Em Preparo', color: 'border-l-orange-500', countColor: 'bg-orange-500' },
        em_entrega: { title: '🛵 Em Entrega', color: 'border-l-blue-500', countColor: 'bg-blue-500' },
        pronto_para_servir: { title: '✅ Pronto', color: 'border-l-green-500', countColor: 'bg-green-500' },
        finalizado: { title: '📦 Finalizado', color: 'border-l-gray-500', countColor: 'bg-gray-500' }
    };

    if (loading || authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Carregando painel...</p>
                </div>
            </div>
        );
    }

    if (!estabelecimentoAtivo) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center p-8 bg-white rounded-xl shadow-lg">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">❌ Nenhum estabelecimento encontrado</h2>
                    <p className="text-gray-600">Você não tem permissão para acessar nenhum estabelecimento.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex flex-col">
            <audio ref={audioRef} src="/campainha.mp3" preload="auto" />
            
            {/* HEADER */}
            <header className="bg-white shadow-lg border-b border-amber-200 p-4 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
                    <div className="flex gap-4 items-center">
                        <button 
                            onClick={() => navigate('/admin-dashboard')}
                            className="px-4 py-2 rounded-xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all flex items-center gap-2"
                        >
                            <IoArrowBack /> Voltar
                        </button>

                        <button 
                            onClick={toggleNotifications} 
                            className={`px-4 py-2 rounded-xl font-bold transition-all ${notificationsEnabled ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
                        >
                            {notificationsEnabled ? '🔔 Som ON' : '🔕 Som OFF'}
                        </button>

                        {/* DATA DE HOJE ADICIONADA AQUI */}
                        <div className="hidden md:flex items-center gap-2 bg-amber-50 text-amber-800 px-4 py-2 rounded-xl border border-amber-200">
                            <IoCalendarOutline className="text-lg" />
                            <span className="font-bold capitalize">{dataHojeFormatada}</span>
                        </div>
                    </div>

                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button 
                            onClick={() => setAbaAtiva('delivery')} 
                            className={`px-4 py-2 rounded-lg font-semibold transition-all ${abaAtiva === 'delivery' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            🛵 Delivery
                        </button>
                        <button 
                            onClick={() => setAbaAtiva('cozinha')} 
                            className={`px-4 py-2 rounded-lg font-semibold transition-all ${abaAtiva === 'cozinha' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            👨‍🍳 Cozinha
                        </button>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT */}
            <main className="flex-grow p-4 overflow-x-hidden">
                <div className="flex flex-col md:flex-row gap-4 h-auto md:h-full flex-col sm:flex-row max-w-7xl mx-auto">
                    {colunas.map(status => {
                        const config = STATUS_CONFIG[status];
                        const allPedidosStatus = pedidos[status] || [];
                        const pedidosFiltrados = allPedidosStatus.filter(p => 
                            abaAtiva === 'cozinha' ? p.source === 'salao' : p.source === 'global'
                        );

                        return (
                            <div 
                                key={status} 
                                className={`flex-1 rounded-2xl shadow-lg border border-amber-100 border-l-4 ${config.color} bg-white flex flex-col h-auto md:h-[calc(100vh-160px)] min-h-[300px]`}
                            >
                                <div className="p-4 border-b border-amber-100 flex justify-between items-center bg-gray-50 rounded-tr-xl">
                                    <h2 className="font-bold text-gray-800 text-lg">{config.title}</h2>
                                    <span className={`${config.countColor} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                                        {pedidosFiltrados.length}
                                    </span>
                                </div>
                                <div className="p-4 space-y-4 md:overflow-y-auto flex-1 custom-scrollbar">
                                    {pedidosFiltrados.length > 0 ? (
                                        abaAtiva === 'cozinha' ? 
                                            <GrupoPedidosMesa 
                                                pedidos={pedidosFiltrados} 
                                                onUpdateStatus={handleUpdateStatusAndNotify} 
                                                onExcluir={handleExcluirPedido} 
                                                newOrderIds={newOrderIds} 
                                                estabelecimentoInfo={estabelecimentoInfo} 
                                            /> 
                                            : 
                                            pedidosFiltrados.map(ped => (
                                                <PedidoCard 
                                                    key={ped.id || `ped-${Math.random()}`} 
                                                    item={ped} 
                                                    onUpdateStatus={handleUpdateStatusAndNotify} 
                                                    onExcluir={handleExcluirPedido} 
                                                    newOrderIds={newOrderIds} 
                                                    estabelecimentoInfo={estabelecimentoInfo}
                                                    motoboysDisponiveis={motoboys} 
                                                    onAtribuirMotoboy={(pedidoId, motoboyId, motoboyNome) => 
                                                        handleAtribuirMotoboy(pedidoId, motoboyId, motoboyNome, ped.source)
                                                    }
                                                />
                                            ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-10 md:h-full text-gray-400 opacity-50">
                                            <div className="text-4xl mb-2">🍃</div>
                                            <p className="font-medium">Vazio</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>
        </div>
    );
}

export default withEstablishmentAuth(Painel);