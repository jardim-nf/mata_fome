import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import PedidoCard from "../components/PedidoCard";
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
        <div className="flex flex-col items-center justify-center p-8 h-screen bg-gray-900 text-white">
            <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-400">Carregando painel...</p>
        </div>
    );
}

export default function Painel() {
    const navigate = useNavigate();
    const audioRef = useRef(null);
    const { currentUser, loading: authLoading, logout } = useAuth();
    const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
    const [pedidos, setPedidos] = useState({ recebido: [], preparo: [], em_entrega: [], pronto_para_servir: [], finalizado: [] });
    const [loading, setLoading] = useState(true);

    // Notificações começam desativadas por padrão
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    
    const [userInteracted, setUserInteracted] = useState(false);
    const [newOrderIds, setNewOrderIds] = useState([]);
    const prevRecebidosRef = useRef([]);
    const [abaAtiva, setAbaAtiva] = useState('delivery');

    // useEffect para Notificação de Som
    useEffect(() => {
        console.log("-> useEffect de notificação foi acionado.");
        const currentRecebidos = pedidos.recebido;
        const prevRecebidos = prevRecebidosRef.current;
        console.log(`Verificando pedidos: Atuais=${currentRecebidos.length}, Anteriores=${prevRecebidos.length}`);

        if (currentRecebidos.length > prevRecebidos.length) {
            console.log("%cNOVO PEDIDO DETECTADO!", "color: lightgreen; font-size: 16px;");
            const newOrders = currentRecebidos.filter(c => !prevRecebidos.some(p => p.id === c.id));
            console.log("Pedidos novos encontrados:", newOrders);

            if (newOrders.length > 0) {
                const newIds = newOrders.map(order => order.id);
                setNewOrderIds(prevIds => [...new Set([...prevIds, ...newIds])]);
                
                console.log(`Verificando condições: Notificações Ativadas? ${notificationsEnabled}, Usuário Interagiu? ${userInteracted}`);

                if (notificationsEnabled && userInteracted) {
                    console.log("%cTENTANDO TOCAR O SOM...", "color: yellow; font-weight: bold;");
                    audioRef.current?.play().catch(error => {
                        console.error("ERRO ao tentar tocar o áudio:", error);
                    });
                } else {
                    console.log("%cSom não tocou porque uma das condições era falsa.", "color: orange;");
                }
                
                setTimeout(() => {
                    setNewOrderIds(prevIds => prevIds.filter(id => !newIds.includes(id)));
                }, 15000);
            }
        }
        prevRecebidosRef.current = currentRecebidos;
    }, [pedidos.recebido, notificationsEnabled, userInteracted]);

    // useEffect para detectar a primeira interação do usuário (liberar áudio)
    useEffect(() => {
        const handleFirstInteraction = () => {
            setUserInteracted(true);
            console.log("%cInteração do usuário detectada! O áudio está liberado pelo navegador.", "color: cyan;");
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
        const numeroCliente = pedidoData?.cliente?.telefone;
        if (!numeroCliente) return null;
        let formattedNumero = String(numeroCliente).replace(/\D/g, '');
        if (formattedNumero.length > 11) formattedNumero = formattedNumero.slice(-11);
        if (!formattedNumero.startsWith('55')) formattedNumero = '55' + formattedNumero;
        const nomeCliente = pedidoData.cliente?.nome?.split(' ')[0] || 'Cliente';
        const nomeEstabelecimento = estabelecimentoInfo?.nome || 'nossa loja';
        const pedidoIdCurto = pedidoData.id.slice(0, 5).toUpperCase();
        const itensResumo = pedidoData.itens.map(item => `   - ${item.quantidade}x ${item.nome}`).join('\n');
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
                if (pedidoData && pedidoData.tipo === 'delivery') {
                    const whatsappLink = sendWhatsAppNotification(newStatus, pedidoData);
                    if (whatsappLink) {
                        window.open(whatsappLink, '_blank');
                        toast.info('Abrindo WhatsApp para notificar o cliente...');
                    }
                }
            })
            .catch(error => { console.error('ERRO AO ATUALIZAR STATUS:', error); toast.error("Falha ao mover o pedido."); });
    };

    const handleExcluirPedido = async (pedidoId) => {
        if (!pedidoId) return toast.error("Erro: ID do pedido inválido.");
        if (!window.confirm('Tem certeza que deseja excluir este pedido?')) return;
        try { await deleteDoc(doc(db, 'pedidos', pedidoId)); toast.success('Pedido excluído com sucesso!'); } 
        catch (error) { console.error('Erro ao excluir pedido:', error); toast.error('Erro ao excluir o pedido.'); }
    };

    // Função para ativar/desativar som
    const toggleNotifications = () => {
        const newState = !notificationsEnabled;
        setNotificationsEnabled(newState);
        
        if (newState) {
            toast.success('Notificações de som ATIVADAS!');
            if (userInteracted) {
                audioRef.current?.play().catch(e => console.log("Usuário precisa interagir para tocar o som de teste."));
            }
        } else {
            toast.warn('Notificações de som DESATIVADAS.');
        }
    };
    
    // useEffect principal para carregar os dados
    useEffect(() => {
        if (authLoading) return;
        const setupPainel = async () => {
            if (!currentUser) { setLoading(false); return () => {}; }
            try {
                const idTokenResult = await currentUser.getIdTokenResult(true);
                const { isAdmin, isMasterAdmin, estabelecimentoId } = idTokenResult.claims;
                if (isMasterAdmin || !isAdmin || !estabelecimentoId) { navigate('/'); return () => {}; }
                const estDocRef = doc(db, 'estabelecimentos', estabelecimentoId);
                const estSnap = await getDoc(estDocRef);
                if (!estSnap.exists() || !estSnap.data().ativo) { navigate('/'); return () => {}; }
                setEstabelecimentoInfo(estSnap.data());

                const tipoPedido = abaAtiva === 'cozinha' ? 'mesa' : 'delivery';
                const statuses = ['recebido', 'preparo', 'em_entrega', 'pronto_para_servir'];
                
                const unsubscribers = statuses.map(status => {
                    const q = query(collection(db, 'pedidos'), 
                        where('estabelecimentoId', '==', estabelecimentoId),
                        where('tipo', '==', tipoPedido),
                        where('status', '==', status), 
                        orderBy('createdAt', 'asc')
                    );
                    return onSnapshot(q, (snapshot) => {
                        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                        setPedidos(prev => ({ ...prev, [status]: list }));
                    }, error => console.error(`Erro no listener para status ${status}:`, error));
                });

                const todayStart = startOfDay(new Date());
                const qFinalizado = query(collection(db, 'pedidos'), 
                    where('estabelecimentoId', '==', estabelecimentoId), 
                    where('tipo', '==', tipoPedido),
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
                return () => unsubscribers.forEach(unsub => unsub());
            } catch (e) {
                console.error("Erro ao configurar o painel:", e);
                toast.error("Ocorreu um erro ao verificar suas permissões.");
                setLoading(false);
                logout();
                navigate('/');
                return () => {};
            }
        };
        const cleanupPromise = setupPainel();
        return () => { cleanupPromise.then(cleanup => { if (cleanup) cleanup(); }); };
    }, [authLoading, currentUser, navigate, logout, abaAtiva]);

    if (loading || authLoading) return <Spinner />;

    const estiloAbaAtiva = "border-yellow-500 text-yellow-500";
    const estiloAbaInativa = "border-transparent text-gray-400 hover:text-white";

    const colunas = abaAtiva === 'cozinha' 
        ? ['recebido', 'preparo', 'pronto_para_servir', 'finalizado']
        : ['recebido', 'preparo', 'em_entrega', 'finalizado'];

    return (
        <div className="bg-gray-900 min-h-screen flex flex-col">
            <audio ref={audioRef} src="/campainha.mp3" preload="auto" />
            
            <header className="bg-black text-white shadow-lg p-4 flex justify-between items-center sticky top-0 z-30 border-b border-gray-800">
                <h1 className="text-xl font-bold text-white">Painel - <span className="text-yellow-500">{estabelecimentoInfo?.nome || '...'}</span></h1>
                <div className="flex items-center space-x-4">
                    
                    {/* Botão de Notificação (Alerta) */}
                    {!notificationsEnabled ? (
                        // Estado DESATIVADO (Piscando em vermelho)
                        <button 
                            onClick={toggleNotifications} 
                            className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-lg shadow-lg animate-pulse"
                            title="O som de novos pedidos está desativado. Clique para ativar."
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707a1 1 0 011.414 0v15.414a1 1 0 01-1.414 0L5.586 15zM17 14l-5-5m0 5l5-5" />
                            </svg>
                            <span className="text-sm hidden sm:inline">Ativar Som</span>
                        </button>
                    ) : (
                        // Estado ATIVADO (Verde)
                        <button 
                            onClick={toggleNotifications} 
                            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg shadow-lg"
                            title="O som de novos pedidos está ativado. Clique para desativar."
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.636 5.636a9 9 0 0112.728 0m-2.828 9.9a5 5 0 01-7.072 0M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707a1 1 0 011.414 0v15.414a1 1 0 01-1.414 0L5.586 15z" />
                            </svg>
                            <span className="text-sm hidden sm:inline">Som Ativado</span>
                        </button>
                    )}
                    
                    <Link to="/dashboard" className="text-sm text-gray-300 hover:text-yellow-500 transition-colors">Dashboard</Link>
                    <button onClick={logout} className="text-sm text-gray-300 hover:text-yellow-500 transition-colors">Sair</button>
                </div>
            </header>

            <div className="px-4 border-b border-gray-800">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setAbaAtiva('delivery')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${abaAtiva === 'delivery' ? estiloAbaAtiva : estiloAbaInativa}`}>
                        Delivery
                    </button>
                    <button onClick={() => setAbaAtiva('cozinha')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${abaAtiva === 'cozinha' ? estiloAbaAtiva : estiloAbaInativa}`}>
                        Cozinha (Mesas)
                    </button>
                </nav>
            </div>

            <main className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 flex-grow">
                {colunas.map(status => (
                    <div key={status} className="bg-gray-800 rounded-lg shadow-md border border-gray-700 flex flex-col">
                        <h2 className="text-lg font-bold capitalize p-4 border-b border-gray-700 text-yellow-500">{status.replace(/_/g, ' ')} ({pedidos[status]?.length || 0})</h2>
                        <div className="p-2 space-y-3 flex-grow overflow-y-auto max-h-[calc(100vh-220px)]">
                            
                            {/* ================== CORREÇÃO DE SINTAXE AQUI ================== */}
                            {pedidos[status] && pedidos[status].length > 0 ? (
                                pedidos[status].map(ped => (
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
                                <p className="p-4 text-center text-sm text-gray-500">Nenhum pedido aqui.</p>
                            )}
                            {/* ================== FIM DA CORREÇÃO ================== */}

                        </div>
                    </div>
                ))}
            </main>
        </div>
    );
}