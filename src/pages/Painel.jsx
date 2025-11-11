import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import PedidoCard from "../components/PedidoCard";
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { startOfDay } from 'date-fns';

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

function Spinner() {
    return (
        <div className="flex flex-col items-center justify-center p-8 h-screen bg-white text-gray-900">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">Carregando painel...</p>
        </div>
    );
}

function Painel() {
    const audioRef = useRef(null);
    const { logout, primeiroEstabelecimento, loading: authLoading, userData } = useAuth();
    
    const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
    const [pedidos, setPedidos] = useState({ recebido: [], preparo: [], em_entrega: [], pronto_para_servir: [], finalizado: [] });
    const [loading, setLoading] = useState(true);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [userInteracted, setUserInteracted] = useState(false);
    const [newOrderIds, setNewOrderIds] = useState([]);
    const prevRecebidosRef = useRef([]);
    const [abaAtiva, setAbaAtiva] = useState('delivery');

    // Debug inicial
    useEffect(() => {
        console.log("🔍 DEBUG PAINEL - Estado inicial:", {
            authLoading,
            primeiroEstabelecimento,
            userData: userData ? {
                email: userData.email,
                isAdmin: userData.isAdmin,
                isMasterAdmin: userData.isMasterAdmin
            } : null,
            estabelecimentoInfo
        });
    }, [authLoading, primeiroEstabelecimento, userData]);

    // useEffect para Notificação de Som e Debug
    useEffect(() => {
        const currentRecebidos = pedidos.recebido;
        const prevRecebidos = prevRecebidosRef.current;

        if (currentRecebidos.length > prevRecebidos.length) {
            console.log("%cNOVO PEDIDO DETECTADO!", "color: lightgreen; font-size: 16px;");

            const newOrders = currentRecebidos.filter(c => !prevRecebidos.some(p => p.id === c.id));

            if (newOrders.length > 0) {
                const newIds = newOrders.map(order => order.id);
                setNewOrderIds(prevIds => [...new Set([...prevIds, ...newIds])]);

                if (notificationsEnabled && userInteracted) {
                    audioRef.current?.play().catch(error => {
                        console.error("ERRO ao tentar tocar o áudio:", error);
                    });
                }
                
                setTimeout(() => {
                    setNewOrderIds(prevIds => prevIds.filter(id => !newIds.includes(id)));
                }, 15000);
            }
        }
        prevRecebidosRef.current = currentRecebidos;
    }, [pedidos.recebido, notificationsEnabled, userInteracted]);

    // useEffect para detectar a primeira interação do usuário
    useEffect(() => {
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

    const sendWhatsAppNotification = (status, pedidoData) => {
        // Só envia notificação se for 'delivery'
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
    };

    const handleUpdateStatusAndNotify = (pedidoId, newStatus) => {
        const pedidoRef = doc(db, 'pedidos', pedidoId);
        updateDoc(pedidoRef, { status: newStatus })
            .then(() => {
                toast.success(`Pedido movido para ${newStatus.replace(/_/g, ' ')}!`);
                const allPedidos = Object.values(pedidos).flat();
                const pedidoData = allPedidos.find(p => p.id === pedidoId);
                
                // Só tenta enviar WhatsApp se o pedido for 'delivery'
                if (pedidoData && pedidoData.tipo === 'delivery') {
                    const whatsappLink = sendWhatsAppNotification(newStatus, pedidoData);
                    if (whatsappLink) {
                        window.open(whatsappLink, '_blank');
                        toast.info('Abrindo WhatsApp para notificar o cliente...');
                    }
                }
            })
            .catch(error => { 
                console.error('ERRO AO ATUALIZAR STATUS:', error); 
                toast.error("Falha ao mover o pedido."); 
            });
    };

    const handleExcluirPedido = async (pedidoId) => {
        if (!pedidoId) return toast.error("Erro: ID do pedido inválido.");
        if (!window.confirm('Tem certeza que deseja excluir este pedido?')) return;
        try { 
            await deleteDoc(doc(db, 'pedidos', pedidoId)); 
            toast.success('Pedido excluído com sucesso!'); 
        } catch (error) { 
            console.error('Erro ao excluir pedido:', error); 
            toast.error('Erro ao excluir o pedido.'); 
        }
    };

    const toggleNotifications = () => {
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
    };
    
    // ✅ useEffect principal CORRIGIDO
    useEffect(() => {
        console.log("🔄 [Painel Init] Iniciando setup...", {
            authLoading,
            primeiroEstabelecimento, 
            user: userData?.email
        });

        // Se ainda está carregando o auth ou não tem estabelecimento, espera
        if (authLoading || !primeiroEstabelecimento) {
            console.log("⏳ Aguardando auth ou estabelecimento...");
            if (!authLoading && !primeiroEstabelecimento) {
                setLoading(false);
            }
            return;
        }

        let unsubscribers = [];

        const setupPainel = async () => {
            try {
                console.log("🚀 Iniciando setupPainel para:", primeiroEstabelecimento);

                // 1. Carrega informações do estabelecimento
                const estDocRef = doc(db, 'estabelecimentos', primeiroEstabelecimento);
                const estSnap = await getDoc(estDocRef);
                
                console.log("📄 Estabelecimento document:", estSnap.exists() ? "EXISTE" : "NÃO EXISTE");
                
                if (!estSnap.exists()) {
                    console.error("❌ Estabelecimento não encontrado:", primeiroEstabelecimento);
                    toast.error("Estabelecimento não encontrado.");
                    setLoading(false);
                    return;
                }
                
                const estabelecimentoData = estSnap.data();
                console.log("🏪 Dados do estabelecimento:", estabelecimentoData);
                
                if (!estabelecimentoData.ativo) {
                    console.error("❌ Estabelecimento inativo:", primeiroEstabelecimento);
                    toast.error("Estabelecimento inativo.");
                    setLoading(false);
                    return;
                }
                
                setEstabelecimentoInfo(estabelecimentoData);
                console.log("✅ Estabelecimento carregado:", estabelecimentoData.nome);

                // 2. Configura listeners de pedidos
                const statuses = ['recebido', 'preparo', 'em_entrega', 'pronto_para_servir'];
                
                statuses.forEach(status => {
                    const q = query(
                        collection(db, 'pedidos'), 
                        where('estabelecimentoId', '==', primeiroEstabelecimento),
                        where('status', '==', status), 
                        orderBy('createdAt', 'asc')
                    );
                    
                    console.log(`🔍 Configurando listener para: ${status}`);
                    
                    const unsub = onSnapshot(q, 
                        (snapshot) => {
                            const list = snapshot.docs.map(d => ({ 
                                id: d.id, 
                                ...d.data()
                            }));
                            
                            console.log(`📦 [${status}] ${list.length} pedidos encontrados`);
                            
                            if (list.length > 0) {
                                console.log(`📋 Detalhes dos pedidos ${status}:`, list.map(p => ({
                                    id: p.id,
                                    estabelecimentoId: p.estabelecimentoId,
                                    status: p.status,
                                    tipo: p.tipo,
                                    cliente: p.cliente?.nome
                                })));
                            }
                            
                            setPedidos(prev => ({ 
                                ...prev, 
                                [status]: list 
                            }));
                        }, 
                        (error) => {
                            console.error(`❌ Erro no listener ${status}:`, error);
                            console.error(`🔍 Detalhes do erro:`, {
                                code: error.code,
                                message: error.message,
                                estabelecimentoId: primeiroEstabelecimento,
                                status: status
                            });
                            
                            if (error.code === 'permission-denied') {
                                console.error("%c🛑 FALHA NA PERMISSÃO DO FIRESTORE!", "color: red; font-size: 16px;");
                                toast.error("Erro de permissão! Verifique as regras de segurança.");
                            } else {
                                toast.error(`Erro ao carregar pedidos ${status}`);
                            }
                        }
                    );
                    
                    unsubscribers.push(unsub);
                });
                
                // Listener para pedidos finalizados
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
                    console.log(`📦 [finalizado] ${list.length} pedidos:`, list);
                    setPedidos(prev => ({ ...prev, finalizado: list }));
                }, (error) => {
                    console.error("❌ Erro no listener finalizado:", error);
                });
                
                unsubscribers.push(unsubFinalizado);

                setLoading(false);
                console.log("✅ Painel configurado com sucesso!");

            } catch (error) {
                console.error("❌ Erro no setupPainel:", error);
                toast.error("Erro ao configurar o painel");
                setLoading(false);
            }
        };

        setupPainel();

        return () => {
            console.log("🧹 Limpando listeners...");
            unsubscribers.forEach(unsub => unsub());
        };
    }, [primeiroEstabelecimento, authLoading, userData]);

    // 🛑 CORREÇÃO DE TIMING: Combina loading local com authLoading para renderizar o Spinner
    if (loading || authLoading) {
        console.log("⏳ Renderizando spinner...", { loading, authLoading });
        return <Spinner />;
    }

    console.log("🎯 Renderizando painel com dados:", {
        estabelecimentoInfo: estabelecimentoInfo?.nome,
        pedidos: Object.keys(pedidos).reduce((acc, key) => {
            acc[key] = pedidos[key].length;
            return acc;
        }, {})
    });

    // 'em_entrega' é para 'delivery' e 'retirada'
    // 'pronto_para_servir' é para 'mesa'
    const colunas = abaAtiva === 'cozinha' 
        ? ['recebido', 'preparo', 'pronto_para_servir', 'finalizado']
        : ['recebido', 'preparo', 'em_entrega', 'finalizado'];

    // Renomeia o título da coluna 'Em Entrega' se a aba for 'delivery'
    const getStatusConfig = (status) => {
        const configs = {
            recebido: { title: '📥 Recebido', color: 'border-l-red-500 bg-red-50', countColor: 'bg-red-500' },
            preparo: { title: '👨‍🍳 Em Preparo', color: 'border-l-orange-500 bg-orange-50', countColor: 'bg-orange-500' },
            em_entrega: { 
                title: abaAtiva === 'cozinha' ? '🛵 Em Entrega' : '🛵 Pronto / Em Entrega', // Título dinâmico
                color: 'border-l-blue-500 bg-blue-50', 
                countColor: 'bg-blue-500' 
            },
            pronto_para_servir: { title: '✅ Pronto para Servir', color: 'border-l-green-500 bg-green-50', countColor: 'bg-green-500' },
            finalizado: { title: '📦 Finalizado', color: 'border-l-gray-500 bg-gray-50', countColor: 'bg-gray-500' }
        };
        return configs[status] || { title: status.replace(/_/g, ' '), color: 'border-l-gray-500 bg-gray-50', countColor: 'bg-gray-500' };
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <audio ref={audioRef} src="/campainha.mp3" preload="auto" />
            
            {/* Header Modernizado */}
            <header className="bg-white shadow-sm border-b border-gray-200 p-4 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">🏪</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Painel de Pedidos</h1>
                            <p className="text-sm text-gray-600">{estabelecimentoInfo?.nome || 'Carregando...'}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                        {/* Botão de Notificação */}
                        <button 
                            onClick={toggleNotifications} 
                            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                                notificationsEnabled 
                                    ? 'bg-green-500 hover:bg-green-600 text-white shadow-sm' 
                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700 animate-pulse'
                            }`}
                            title={notificationsEnabled ? "Notificações ativadas" : "Notificações desativadas"}
                        >
                            {notificationsEnabled ? (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM4.93 4.93l14.14 14.14M9 11a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                    <span className="hidden sm:inline">Som Ativo</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707a1 1 0 011.414 0v15.414a1 1 0 01-1.414 0L5.586 15zM17 14l-5-5m0 5l5-5" />
                                    </svg>
                                    <span className="hidden sm:inline">Ativar Som</span>
                                </>
                            )}
                        </button>

                        <button 
                            onClick={logout} 
                            className="px-4 py-2 text-sm text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            Sair
                        </button>
                    </div>
                </div>
            </header>

            {/* Abas de Navegação */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4">
                    <nav className="flex space-x-8" aria-label="Tabs">
                        <button 
                            onClick={() => setAbaAtiva('delivery')} 
                            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                abaAtiva === 'delivery' 
                                    ? 'border-blue-500 text-blue-600' 
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            🛵 Delivery / Retirada
                        </button>
                        <button 
                            onClick={() => setAbaAtiva('cozinha')} 
                            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                abaAtiva === 'cozinha' 
                                    ? 'border-blue-500 text-blue-600' 
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            👨‍🍳 Cozinha (Mesas)
                        </button>
                    </nav>
                </div>
            </div>

            {/* Grid de Pedidos */}
            <main className="flex-grow p-4 max-w-7xl mx-auto w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    {colunas.map(status => {
                        const config = getStatusConfig(status);
                        
                        const allPedidosStatus = pedidos[status] || [];
                        let pedidosFiltrados = [];

                        if (abaAtiva === 'cozinha') {
                            // Aba Cozinha só mostra 'mesa'
                            pedidosFiltrados = allPedidosStatus.filter(p => p.tipo === 'mesa');
                        } else {
                            // Aba Delivery agora mostra 'delivery' E 'retirada'
                            pedidosFiltrados = allPedidosStatus.filter(p => p.tipo === 'delivery' || p.tipo === 'retirada');
                        }
                        
                        const pedidosCount = pedidosFiltrados.length;
                        
                        console.log(`📊 Coluna ${status}: ${pedidosCount} pedidos filtrados de ${allPedidosStatus.length} totais`);

                        return (
                            <div key={status} className={`rounded-lg shadow-sm border border-gray-200 border-l-4 ${config.color} flex flex-col h-full`}>
                                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                                    <h2 className="font-semibold text-gray-900">{config.title}</h2>
                                    <span className={`${config.countColor} text-white text-sm font-medium px-2 py-1 rounded-full min-w-8 text-center`}>
                                        {pedidosCount}
                                    </span>
                                </div>
                                <div className="p-3 space-y-3 flex-grow overflow-y-auto max-h-[calc(100vh-220px)]">
                                    
                                    {pedidosFiltrados && pedidosFiltrados.length > 0 ? (
                                        pedidosFiltrados.map(ped => (
                                            <PedidoCard
                                                key={ped.id}
                                                pedido={ped}
                                                onUpdateStatus={handleUpdateStatusAndNotify}
                                                onDeletePedido={handleExcluirPedido}
                                                newOrderIds={newOrderIds}
                                                estabelecimentoInfo={estabelecimentoInfo}
                                            />
                                        ))
                                    ) : (
                                        <div className="text-center py-8">
                                            <div className="text-gray-400 text-4xl mb-2">📝</div>
                                            <p className="text-gray-500 text-sm">Nenhum pedido</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* Botão Voltar para Dashboard */}
            <footer className="bg-white border-t border-gray-200 py-4">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex justify-center">
                        <Link 
                            to="/dashboard" 
                            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            <span>Voltar para Dashboard</span>
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}

// Aplica o HOC específico para estabelecimento
export default withEstablishmentAuth(Painel);