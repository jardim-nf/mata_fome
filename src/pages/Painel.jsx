// src/pages/Painel.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    getDoc
} from 'firebase/firestore';
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
    em_entrega: (nomeCliente, pedidoIdCurto, itensResumo, totalPedido, formaPagamento, nomeEstabelecimento) =>
        `Boas notícias, ${nomeCliente}! Seu pedido #${pedidoIdCurto} de ${nomeEstabelecimento} já saiu para entrega! 🛵`,
    finalizado: (nomeCliente, pedidoIdCurto, itensResumo, totalPedido, formaPagamento, nomeEstabelecimento) =>
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
    const [pedidos, setPedidos] = useState({ recebido: [], preparo: [], em_entrega: [], finalizado: [] });
    const [loading, setLoading] = useState(true);
    const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem('notificationsEnabled') !== 'false');
    const [userInteracted, setUserInteracted] = useState(false);
    const [newOrderIds, setNewOrderIds] = useState([]);
    const prevRecebidosRef = useRef([]);

    useEffect(() => {
        const currentRecebidos = pedidos.recebido;
        const prevRecebidos = prevRecebidosRef.current;
        if (currentRecebidos.length > prevRecebidos.length) {
            const newOrders = currentRecebidos.filter(c => !prevRecebidos.some(p => p.id === c.id));
            if (newOrders.length > 0) {
                const newIds = newOrders.map(order => order.id);
                setNewOrderIds(prevIds => [...prevIds, ...newIds]);
                if (notificationsEnabled && userInteracted) {
                    audioRef.current?.play().catch(error => console.log("A reprodução do áudio foi bloqueada.", error));
                }
                setTimeout(() => {
                    setNewOrderIds(prevIds => prevIds.filter(id => !newIds.includes(id)));
                }, 15000);
            }
        }
        prevRecebidosRef.current = currentRecebidos;
    }, [pedidos.recebido, notificationsEnabled, userInteracted]);

    useEffect(() => {
        const handleFirstInteraction = () => {
            setUserInteracted(true);
            window.removeEventListener('click', handleFirstInteraction);
        };
        window.addEventListener('click', handleFirstInteraction);
        return () => window.removeEventListener('click', handleFirstInteraction);
    }, []);

    const sendWhatsAppNotification = (status, pedidoData) => {
        const numeroCliente = pedidoData?.cliente?.telefone;
        if (!numeroCliente) {
            toast.warn('Número do cliente não encontrado para notificar.');
            return null;
        }
        let formattedNumero = numeroCliente.replace(/\D/g, '');
        if (!formattedNumero.startsWith('55')) {
            formattedNumero = '55' + formattedNumero;
        }
        const nomeCliente = pedidoData.cliente?.nome?.split(' ')[0] || 'Cliente';
        const nomeEstabelecimento = estabelecimentoInfo?.nome || 'nossa loja';
        const pedidoIdCurto = pedidoData.id.slice(0, 5).toUpperCase();
        const itensResumo = pedidoData.itens.map(item => `   - ${item.quantidade}x ${item.nome}`).join('\n');
        const totalPedido = `R$ ${pedidoData.totalFinal.toFixed(2).replace('.', ',')}`;
        const formaPagamento = pedidoData.formaPagamento || 'Não informada';
        let mensagemCliente = '';
        const messageBuilder = MENSAGENS_WHATSAPP[status];
        if (messageBuilder) {
            mensagemCliente = messageBuilder(nomeCliente, pedidoIdCurto, itensResumo, totalPedido, formaPagamento, nomeEstabelecimento);
        }
        if (mensagemCliente) {
            return `https://wa.me/${formattedNumero}?text=${encodeURIComponent(mensagemCliente)}`;
        }
        return null;
    };

    const handleUpdateStatusAndNotify = (pedidoId, newStatus) => {
        const pedidoRef = doc(db, 'pedidos', pedidoId);
        updateDoc(pedidoRef, { status: newStatus })
            .then(() => {
                toast.success(`Pedido movido para ${newStatus.replace('_', ' ')}!`);
                const allPedidos = [...pedidos.recebido, ...pedidos.preparo, ...pedidos.em_entrega, ...pedidos.finalizado];
                const pedidoData = allPedidos.find(p => p.id === pedidoId);
                if (pedidoData) {
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
        if (!pedidoId) {
            console.error("Tentativa de excluir pedido com ID inválido.");
            toast.error("Erro: ID do pedido inválido ou não encontrado.");
            return;
        }
        if (!window.confirm('Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.')) return;
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
        localStorage.setItem('notificationsEnabled', newState);
        toast.info(`Notificações de som ${newState ? 'ativadas' : 'desativadas'}.`);
    };
    
    useEffect(() => {
        const setupPainel = async () => {
            if (!currentUser) {
                toast.error("Sessão expirada. Faça login novamente.");
                navigate('/login-admin');
                setLoading(false);
                return () => {};
            }

            try {
                const idTokenResult = await currentUser.getIdTokenResult(true);
                const { isAdmin, isMasterAdmin, estabelecimentoId } = idTokenResult.claims;

                if (isMasterAdmin) {
                    navigate('/master-dashboard');
                    setLoading(false);
                    return () => {};
                }

                if (!isAdmin || !estabelecimentoId) {
                    toast.error('Acesso negado.');
                    logout();
                    navigate('/');
                    setLoading(false);
                    return () => {};
                }
                
                const estDocRef = doc(db, 'estabelecimentos', estabelecimentoId);
                const estSnap = await getDoc(estDocRef);

                if (!estSnap.exists() || !estSnap.data().ativo) {
                    toast.error('Seu estabelecimento não foi encontrado ou está inativo.');
                    logout();
                    navigate('/');
                    setLoading(false);
                    return () => {};
                }
                
                setEstabelecimentoInfo(estSnap.data());

                const todayStart = startOfDay(new Date());
                const statuses = ['recebido', 'preparo', 'em_entrega'];
                const unsubscribers = [];

                statuses.forEach(status => {
                    const q = query(collection(db, 'pedidos'), where('estabelecimentoId', '==', estabelecimentoId), where('status', '==', status), orderBy('criadoEm', 'desc'));
                    const unsub = onSnapshot(q, (snapshot) => {
                        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                        setPedidos(prev => ({ ...prev, [status]: list }));
                    });
                    unsubscribers.push(unsub);
                });

                const qFinalizado = query(collection(db, 'pedidos'), where('estabelecimentoId', '==', estabelecimentoId), where('status', '==', 'finalizado'), where('criadoEm', '>=', todayStart), orderBy('criadoEm', 'desc'));
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
                logout();
                navigate('/');
                setLoading(false);
                return () => {};
            }
        };

        if (!authLoading) {
            const cleanupPromise = setupPainel();
            return () => {
                cleanupPromise.then(cleanup => {
                    if (cleanup) {
                        cleanup();
                    }
                });
            };
        }
    }, [authLoading, currentUser, navigate, logout]);

    if (loading || authLoading) {
        return <Spinner />;
    }

    return (
        <div className="bg-gray-900 min-h-screen">
            <audio ref={audioRef} src="/campainha.mp3" preload="auto" />
            <header className="bg-black text-white shadow-lg p-4 flex justify-between items-center sticky top-0 z-30 border-b border-gray-800">
                <h1 className="text-xl font-bold text-white">Painel - <span className="text-yellow-500">{estabelecimentoInfo?.nome || '...'}</span></h1>
                <div className="flex items-center space-x-6">
                    <p className="text-sm text-gray-300 hidden sm:block">Sons: <span className={notificationsEnabled ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>{notificationsEnabled ? 'ATIVADOS' : 'DESATIVADOS'}</span><button onClick={toggleNotifications} className="ml-2 text-yellow-500 hover:underline text-xs">(alterar)</button></p>
                    <Link to="/dashboard" className="text-sm text-gray-300 hover:text-yellow-500 transition-colors">Dashboard</Link>
                    <button onClick={logout} className="text-sm text-gray-300 hover:text-yellow-500 transition-colors">Sair</button>
                </div>
            </header>
            <main className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {['recebido', 'preparo', 'em_entrega', 'finalizado'].map(status => (
                    <div key={status} className="bg-gray-800 rounded-lg shadow-md border border-gray-700">
                        <h2 className="text-lg font-bold capitalize p-4 border-b border-gray-700 text-yellow-500">{status.replace(/_/g, ' ')} ({pedidos[status]?.length || 0})</h2>
                        <div className="p-2 space-y-3 max-h-[calc(100vh-160px)] overflow-y-auto">
                            {pedidos[status]?.length > 0 ? (
                                pedidos[status].map(ped => (
                                    <PedidoCard
                                        key={ped.id}
                                        pedido={ped}
                                        onUpdateStatus={handleUpdateStatusAndNotify}
                                        onDeletePedido={handleExcluirPedido}
                                        estabelecimentoInfo={estabelecimentoInfo}
                                        newOrderIds={newOrderIds}
                                    />
                                ))
                            ) : (
                                <p className="p-4 text-center text-sm text-gray-500">Nenhum pedido aqui.</p>
                            )}
                        </div>
                    </div>
                ))}
            </main>
        </div>
    );
}