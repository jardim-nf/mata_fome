import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import PedidoCard from "../components/PedidoCard";
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { startOfDay, isToday } from 'date-fns';

// 🎯 CONSTANTES MELHORADAS
const MENSAGENS_WHATSAPP = {
    preparo: (nomeCliente, pedidoIdCurto, itensResumo, totalPedido, formaPagamento, nomeEstabelecimento) => {
        let mensagem = `Olá, ${nomeCliente}! 👋\nConfirmamos seu pedido *#${pedidoIdCurto}* e ele já está em preparo!\n\n*Resumo:*\n${itensResumo}\n\n*Total:* ${totalPedido}\n*Pagamento:* ${formaPagamento}\n\n`;
        if (formaPagamento && formaPagamento.toLowerCase() === 'pix') {
            mensagem += `*Atenção:* Por favor, envie o comprovante do Pix aqui para agilizar a liberação. 📄`;
        }
        return mensagem;
    },
    em_entrega: (nomeCliente, pedidoIdCurto, nomeEstabelecimento) =>
        `Boas notícias, ${nomeCliente}! Seu pedido #${pedidoIdCurto} de ${nomeEstabelecimento} já saiu para entrega! 🛵`,
    finalizado: (nomeCliente, pedidoIdCurto) =>
        `Olá, ${nomeCliente}! Seu pedido #${pedidoIdCurto} foi finalizado. Agradecemos a preferência e bom apetite! 😋`
};

const STATUS_CONFIG = {
    recebido: { 
        title: '📥 Recebido', 
        color: 'border-l-red-500 bg-gradient-to-r from-red-50 to-red-25', 
        countColor: 'bg-red-500 text-white',
        nextStatus: 'preparo'
    },
    preparo: { 
        title: '👨‍🍳 Em Preparo', 
        color: 'border-l-orange-500 bg-gradient-to-r from-orange-50 to-orange-25', 
        countColor: 'bg-orange-500 text-white',
        nextStatus: 'em_entrega'
    },
    em_entrega: { 
        title: '🛵 Em Entrega', 
        color: 'border-l-blue-500 bg-gradient-to-r from-blue-50 to-blue-25', 
        countColor: 'bg-blue-500 text-white',
        nextStatus: 'finalizado'
    },
    pronto_para_servir: { 
        title: '✅ Pronto para Servir', 
        color: 'border-l-green-500 bg-gradient-to-r from-green-50 to-green-25', 
        countColor: 'bg-green-500 text-white',
        nextStatus: 'finalizado'
    },
    finalizado: { 
        title: '📦 Finalizado', 
        color: 'border-l-gray-500 bg-gradient-to-r from-gray-50 to-gray-25', 
        countColor: 'bg-gray-500 text-white',
        nextStatus: null
    }
};

// 🎯 COMPONENTES AUXILIARES OTIMIZADOS
const Spinner = () => (
    <div className="flex flex-col items-center justify-center p-8 h-screen bg-gradient-to-br from-amber-50 to-orange-50 text-gray-900">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-700 font-medium">Carregando painel...</p>
        <p className="text-gray-500 text-sm mt-2">Preparando tudo para você</p>
    </div>
);

const NotificationToggle = ({ enabled, onToggle, userInteracted }) => (
    <button 
        onClick={onToggle} 
        className={`flex items-center space-x-3 px-5 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
            enabled 
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg' 
                : 'bg-gradient-to-r from-amber-100 to-orange-100 hover:from-amber-200 hover:to-orange-200 text-amber-700 shadow-md animate-pulse'
        }`}
        title={enabled ? "Notificações ativadas" : "Notificações desativadas"}
    >
        {enabled ? (
            <>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4.93 4.93l14.14 14.14M9 11a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span className="hidden sm:inline">Som Ativo</span>
            </>
        ) : (
            <>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707a1 1 0 011.414 0v15.414a1 1 0 01-1.414 0L5.586 15zM17 14l-5-5m0 5l5-5" />
                </svg>
                <span className="hidden sm:inline">Ativar Som</span>
            </>
        )}
    </button>
);

function Painel() {
    const audioRef = useRef(null);
    const { logout, primeiroEstabelecimento, loading: authLoading, userData } = useAuth();
    
    const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
    const [pedidos, setPedidos] = useState({ 
        recebido: [], preparo: [], em_entrega: [], pronto_para_servir: [], finalizado: [] 
    });
    const [loading, setLoading] = useState(true);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [userInteracted, setUserInteracted] = useState(false);
    const [newOrderIds, setNewOrderIds] = useState(new Set());
    const [abaAtiva, setAbaAtiva] = useState('delivery');
    const [autoRefresh, setAutoRefresh] = useState(true);
    
    const prevRecebidosRef = useRef([]);

    // 🎯 HOOKS OTIMIZADOS
    const setupUserInteraction = useCallback(() => {
        const handleFirstInteraction = () => {
            setUserInteracted(true);
            window.removeEventListener('click', handleFirstInteraction);
            window.removeEventListener('keydown', handleFirstInteraction);
        };
        
        window.addEventListener('click', handleFirstInteraction);
        window.addEventListener('keydown', handleFirstInteraction);
        
        return () => {
            window.removeEventListener('click', handleFirstInteraction);
            window.removeEventListener('keydown', handleFirstInteraction);
        };
    }, []);

    const sendWhatsAppNotification = useCallback((status, pedidoData) => {
        if (pedidoData.tipo !== 'delivery') return null;

        const numeroCliente = pedidoData?.cliente?.telefone;
        if (!numeroCliente) return null;
        
        let formattedNumero = String(numeroCliente).replace(/\D/g, '');
        if (formattedNumero.length > 11) formattedNumero = formattedNumero.slice(-11);
        if (!formattedNumero.startsWith('55')) formattedNumero = '55' + formattedNumero;
        
        const nomeCliente = pedidoData.cliente?.nome?.split(' ')[0] || 'Cliente';
        const nomeEstabelecimento = estabelecimentoInfo?.nome || 'nossa loja';
        const pedidoIdCurto = pedidoData.id.slice(0, 5).toUpperCase();
        const itensResumo = pedidoData.itens.map(item => `   - ${item.quantidade}x ${item.nome}`).join('\n');
        const totalPedido = `R$ ${(pedidoData.totalFinal || pedidoData.total).toFixed(2).replace('.', ',')}`;
        const formaPagamento = pedidoData.formaPagamento || 'Não informada';
        const messageBuilder = MENSAGENS_WHATSAPP[status];
        
        if (messageBuilder) {
            const mensagemCliente = messageBuilder(nomeCliente, pedidoIdCurto, itensResumo, totalPedido, formaPagamento, nomeEstabelecimento);
            return `https://wa.me/${formattedNumero}?text=${encodeURIComponent(mensagemCliente)}`;
        }
        return null;
    }, [estabelecimentoInfo]);

    const handleUpdateStatusAndNotify = useCallback(async (pedidoId, newStatus) => {
        try {
            const pedidoRef = doc(db, 'pedidos', pedidoId);
            await updateDoc(pedidoRef, { 
                status: newStatus,
                atualizadoEm: new Date() 
            });
            
            toast.success(`Pedido movido para ${newStatus.replace(/_/g, ' ')}!`);
            
            const allPedidos = Object.values(pedidos).flat();
            const pedidoData = allPedidos.find(p => p.id === pedidoId);
            
            if (pedidoData && pedidoData.tipo === 'delivery') {
                const whatsappLink = sendWhatsAppNotification(newStatus, pedidoData);
                if (whatsappLink) {
                    window.open(whatsappLink, '_blank');
                    toast.info('Abrindo WhatsApp para notificar o cliente...');
                }
            }
        } catch (error) { 
            console.error('ERRO AO ATUALIZAR STATUS:', error); 
            toast.error("Falha ao mover o pedido."); 
        }
    }, [pedidos, sendWhatsAppNotification]);

    const handleExcluirPedido = useCallback(async (pedidoId) => {
        if (!pedidoId) return toast.error("Erro: ID do pedido inválido.");
        if (!window.confirm('Tem certeza que deseja excluir este pedido?')) return;
        
        try { 
            await deleteDoc(doc(db, 'pedidos', pedidoId)); 
            toast.success('Pedido excluído com sucesso!'); 
        } catch (error) { 
            console.error('Erro ao excluir pedido:', error); 
            toast.error('Erro ao excluir o pedido.'); 
        }
    }, []);

    const handleAvançarTodosPedidos = useCallback(async (statusAtual) => {
        const pedidosStatus = pedidos[statusAtual] || [];
        if (pedidosStatus.length === 0) {
            toast.info('Nenhum pedido para avançar');
            return;
        }

        if (!window.confirm(`Deseja avançar todos os ${pedidosStatus.length} pedidos de ${statusAtual}?`)) return;

        try {
            const batch = writeBatch(db);
            const nextStatus = STATUS_CONFIG[statusAtual]?.nextStatus;
            
            if (!nextStatus) {
                toast.error('Não há próximo status definido');
                return;
            }

            pedidosStatus.forEach(pedido => {
                const pedidoRef = doc(db, 'pedidos', pedido.id);
                batch.update(pedidoRef, { 
                    status: nextStatus,
                    atualizadoEm: new Date() 
                });
            });

            await batch.commit();
            toast.success(`${pedidosStatus.length} pedidos avançados para ${nextStatus}!`);
        } catch (error) {
            console.error('Erro ao avançar pedidos em lote:', error);
            toast.error('Erro ao avançar pedidos');
        }
    }, [pedidos]);

    const toggleNotifications = useCallback(() => {
        const newState = !notificationsEnabled;
        setNotificationsEnabled(newState);
        
        if (newState) {
            toast.success('🔔 Notificações de som ATIVADAS!');
            if (userInteracted) {
                audioRef.current?.play().catch(e => console.log("Usuário precisa interagir para tocar o som de teste."));
            }
        } else {
            toast.warn('🔕 Notificações de som DESATIVADAS.');
        }
    }, [notificationsEnabled, userInteracted]);

    // 🎯 EFEITOS OTIMIZADOS
    useEffect(() => {
        setupUserInteraction();
    }, [setupUserInteraction]);

    useEffect(() => {
        const currentRecebidos = pedidos.recebido;
        const prevRecebidos = prevRecebidosRef.current;

        if (currentRecebidos.length > prevRecebidos.length) {
            const newOrders = currentRecebidos.filter(c => !prevRecebidos.some(p => p.id === c.id));

            if (newOrders.length > 0) {
                const newIds = newOrders.map(order => order.id);
                setNewOrderIds(prev => new Set([...prev, ...newIds]));

                if (notificationsEnabled && userInteracted) {
                    audioRef.current?.play().catch(error => {
                        console.error("ERRO ao tentar tocar o áudio:", error);
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

    // 🎯 SETUP PRINCIPAL OTIMIZADO
    useEffect(() => {
        if (authLoading || !primeiroEstabelecimento) {
            if (!authLoading && !primeiroEstabelecimento) {
                setLoading(false);
            }
            return;
        }

        let unsubscribers = [];

        const setupPainel = async () => {
            try {
                // 1. Carrega informações do estabelecimento
                const estDocRef = doc(db, 'estabelecimentos', primeiroEstabelecimento);
                const estSnap = await getDoc(estDocRef);
                
                if (!estSnap.exists()) {
                    toast.error("Estabelecimento não encontrado.");
                    setLoading(false);
                    return;
                }
                
                const estabelecimentoData = estSnap.data();
                
                if (!estabelecimentoData.ativo) {
                    toast.error("Estabelecimento inativo.");
                    setLoading(false);
                    return;
                }
                
                setEstabelecimentoInfo(estabelecimentoData);

                // 2. Configura listeners de pedidos
                const statuses = ['recebido', 'preparo', 'em_entrega', 'pronto_para_servir'];
                
                statuses.forEach(status => {
                    const q = query(
                        collection(db, 'pedidos'), 
                        where('estabelecimentoId', '==', primeiroEstabelecimento),
                        where('status', '==', status), 
                        orderBy('createdAt', 'asc')
                    );
                    
                    const unsub = onSnapshot(q, 
                        (snapshot) => {
                            const list = snapshot.docs.map(d => ({ 
                                id: d.id, 
                                ...d.data()
                            }));
                            
                            setPedidos(prev => ({ 
                                ...prev, 
                                [status]: list 
                            }));
                        }, 
                        (error) => {
                            console.error(`❌ Erro no listener ${status}:`, error);
                            if (error.code === 'permission-denied') {
                                toast.error("Erro de permissão! Verifique as regras de segurança.");
                            }
                        }
                    );
                    
                    unsubscribers.push(unsub);
                });
                
                // Listener para pedidos finalizados (apenas hoje)
                const todayStart = startOfDay(new Date());
                const qFinalizado = query(
                    collection(db, 'pedidos'), 
                    where('estabelecimentoId', '==', primeiroEstabelecimento),
                    where('status', '==', 'finalizado'), 
                    where('createdAt', '>=', todayStart), 
                    orderBy('createdAt', 'desc')
                );
                
                const unsubFinalizado = onSnapshot(qFinalizado, (snapshot) => {
                    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    setPedidos(prev => ({ ...prev, finalizado: list }));
                });
                
                unsubscribers.push(unsubFinalizado);

                setLoading(false);

            } catch (error) {
                console.error("❌ Erro no setupPainel:", error);
                toast.error("Erro ao configurar o painel");
                setLoading(false);
            }
        };

        setupPainel();

        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [primeiroEstabelecimento, authLoading]);

    // 🎯 MEMOIZED VALUES
    const colunas = useMemo(() => 
        abaAtiva === 'cozinha' 
            ? ['recebido', 'preparo', 'pronto_para_servir', 'finalizado']
            : ['recebido', 'preparo', 'em_entrega', 'finalizado'],
        [abaAtiva]
    );

    const getStatusConfig = useCallback((status) => {
        const baseConfig = STATUS_CONFIG[status] || { 
            title: status.replace(/_/g, ' '), 
            color: 'border-l-gray-500 bg-gradient-to-r from-gray-50 to-gray-25', 
            countColor: 'bg-gray-500 text-white',
            nextStatus: null
        };

        if (status === 'em_entrega' && abaAtiva === 'cozinha') {
            return { ...baseConfig, title: '🛵 Pronto / Em Entrega' };
        }

        return baseConfig;
    }, [abaAtiva]);

    // 🎯 RENDER CONDICIONAL
    if (loading || authLoading) {
        return <Spinner />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex flex-col">
            <audio ref={audioRef} src="/campainha.mp3" preload="auto" />
            
            {/* Header Modernizado */}
            <header className="bg-white shadow-lg border-b border-amber-200 p-4 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto flex justify-between items-center">          
                    <div className="flex items-center space-x-4">
                        <NotificationToggle 
                            enabled={notificationsEnabled}
                            onToggle={toggleNotifications}
                            userInteracted={userInteracted}
                        />

                        <button 
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                autoRefresh 
                                    ? 'bg-green-100 text-green-700 border border-green-300' 
                                    : 'bg-gray-100 text-gray-700 border border-gray-300'
                            }`}
                        >
                            {autoRefresh ? '🔄 Auto' : '⏸️ Pausado'}
                        </button>

                        <button 
                            onClick={logout} 
                            className="px-5 py-3 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 border border-gray-200 hover:border-red-200"
                        >
                            Sair
                        </button>
                    </div>
                </div>
            </header>

            {/* Abas de Navegação */}
            <div className="bg-white border-b border-amber-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4">
                    <nav className="flex space-x-8" aria-label="Tabs">
                        {[
                            { key: 'delivery', label: 'Delivery / Retirada', icon: '🛵' },
                            { key: 'cozinha', label: 'Cozinha (Mesas)', icon: '👨‍🍳' }
                        ].map(tab => (
                            <button 
                                key={tab.key}
                                onClick={() => setAbaAtiva(tab.key)} 
                                className={`py-5 px-3 border-b-2 font-semibold text-sm transition-all duration-300 flex items-center space-x-2 ${
                                    abaAtiva === tab.key 
                                        ? 'border-amber-500 text-amber-600 bg-amber-50' 
                                        : 'border-transparent text-gray-500 hover:text-amber-600 hover:border-amber-300'
                                }`}
                            >
                                <span className="text-lg">{tab.icon}</span>
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Grid de Pedidos Aprimorado */}
            <main className="flex-grow p-6 max-w-7xl mx-auto w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    {colunas.map(status => {
                        const config = getStatusConfig(status);
                        const allPedidosStatus = pedidos[status] || [];
                        
                        const pedidosFiltrados = allPedidosStatus.filter(p => 
                            abaAtiva === 'cozinha' 
                                ? p.tipo === 'mesa'
                                : p.tipo === 'delivery' || p.tipo === 'retirada'
                        );
                        
                        const pedidosCount = pedidosFiltrados.length;
                        const hasNextStatus = config.nextStatus && pedidosCount > 0;

                        return (
                            <div key={status} className={`rounded-2xl shadow-lg border border-amber-100 border-l-4 ${config.color} flex flex-col h-full transition-all duration-300 hover:shadow-xl`}>
                                <div className="p-5 border-b border-amber-200 flex justify-between items-center bg-white/50 rounded-t-2xl">
                                    <div className="flex items-center space-x-3">
                                        <span className="text-2xl">{config.icon}</span>
                                        <h2 className="font-bold text-gray-900 text-lg">{config.title}</h2>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className={`${config.countColor} text-sm font-bold px-3 py-2 rounded-full min-w-10 text-center shadow-md`}>
                                            {pedidosCount}
                                        </span>
                                        {hasNextStatus && (
                                            <button
                                                onClick={() => handleAvançarTodosPedidos(status)}
                                                className="bg-amber-500 hover:bg-amber-600 text-white p-2 rounded-lg text-xs font-medium transition-colors"
                                                title={`Avançar todos para ${config.nextStatus}`}
                                            >
                                                ⏩
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="p-4 space-y-4 flex-grow overflow-y-auto max-h-[calc(100vh-250px)] bg-white/30 rounded-b-2xl">
                                    {pedidosFiltrados.length > 0 ? (
                                        pedidosFiltrados.map(ped => (
                                            <PedidoCard
                                                key={ped.id}
                                                item={ped}
                                                onUpdateStatus={handleUpdateStatusAndNotify}
                                                onDeletePedido={handleExcluirPedido}
                                                newOrderIds={newOrderIds}
                                                estabelecimentoInfo={estabelecimentoInfo}
                                            />
                                        ))
                                    ) : (
                                        <div className="text-center py-12">
                                            <div className="text-amber-300 text-5xl mb-4">📝</div>
                                            <p className="text-amber-600 font-medium">Nenhum pedido</p>
                                            <p className="text-amber-400 text-sm mt-1">Aguardando novos pedidos</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* Footer com estatísticas */}
            <footer className="bg-white border-t border-amber-200 py-6 mt-8">
                <div className="max-w-7xl mx-auto px-4 flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                        Total de pedidos hoje: {Object.values(pedidos).flat().length}
                    </div>
                    <Link 
                        to="/dashboard" 
                        className="flex items-center space-x-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-4 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        <span className="text-lg">Voltar para Dashboard</span>
                    </Link>
                </div>
            </footer>
        </div>
    );
}

export default withEstablishmentAuth(Painel);