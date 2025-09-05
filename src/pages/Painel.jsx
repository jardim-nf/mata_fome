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

// As mensagens do WhatsApp ficam aqui para fácil edição
const MENSAGENS_WHATSAPP = {
    preparo: (nomeCliente, pedidoIdCurto, itensResumo, totalPedido, formaPagamento) => {
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
        <div className="flex flex-col items-center justify-center p-8 h-screen bg-gray-100">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-600">Carregando painel...</p>
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
    const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem('notificationsEnabled') === 'true');
    const prevRecebidos = useRef([]);

    // --- Início das Funções ---

    const sendWhatsAppNotification = (newStatus, pedidoData) => {
        const numeroCliente = pedidoData?.cliente?.telefone;
        if (!numeroCliente) {
            toast.warn('Número do cliente não encontrado para notificar.');
            return null; // Retorna nulo se não puder gerar o link
        }

        let formattedNumero = numeroCliente.replace(/\D/g, '');
        if (!formattedNumero.startsWith('55')) {
            formattedNumero = '55' + formattedNumero;
        }
        
        const nomeCliente = pedidoData.cliente?.nome?.split(' ')[0] || 'Cliente';
        const nomeEstabelecimento = estabelecimentoInfo?.nome || 'nossa loja';
        const pedidoIdCurto = pedidoData.id.slice(0, 5).toUpperCase();
        let mensagemCliente = '';

        if (newStatus === 'preparo') {
            const itensResumo = pedidoData.itens.map(item => `   - ${item.quantidade}x ${item.nome}`).join('\n');
            const totalPedido = `R$ ${pedidoData.totalFinal.toFixed(2).replace('.', ',')}`;
            const formaPagamento = pedidoData.formaPagamento || 'Não informada';
            mensagemCliente = MENSAGENS_WHATSAPP.preparo(nomeCliente, pedidoIdCurto, itensResumo, totalPedido, formaPagamento);
        } else if (newStatus === 'em_entrega') {
            mensagemCliente = MENSAGENS_WHATSAPP.em_entrega(nomeCliente, pedidoIdCurto, nomeEstabelecimento);
        } else if (newStatus === 'finalizado') {
            mensagemCliente = MENSAGENS_WHATSAPP.finalizado(nomeCliente, pedidoIdCurto);
        }
        
        if (mensagemCliente) {
            return `https://wa.me/${formattedNumero}?text=${encodeURIComponent(mensagemCliente)}`;
        }
        return null;
    };

    const handleUpdatePedidoStatusAndWhatsApp = (pedidoId, newStatus) => {
        const allPedidos = [...pedidos.recebido, ...pedidos.preparo, ...pedidos.em_entrega, ...pedidos.finalizado];
        const pedidoData = allPedidos.find(p => p.id === pedidoId);

        if (pedidoData && ['preparo', 'em_entrega', 'finalizado'].includes(newStatus)) {
            const whatsappLink = sendWhatsAppNotification(newStatus, pedidoData);
            if (whatsappLink) {
                window.open(whatsappLink, '_blank');
                toast.info('Abrindo WhatsApp para notificar o cliente...');
            }
        }

        // Atualiza o status no banco de dados independentemente da notificação
        const pedidoRef = doc(db, 'pedidos', pedidoId);
        updateDoc(pedidoRef, { status: newStatus })
            .then(() => {
                toast.success(`Pedido movido para ${newStatus.replace('_', ' ')}!`);
            })
            .catch(error => {
                console.error('ERRO AO ATUALIZAR STATUS:', error);
                toast.error("Falha ao mover o pedido.");
            });
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Excluir este pedido permanentemente?')) return;
        try {
            await deleteDoc(doc(db, 'pedidos', id));
            toast.success('Pedido excluído!');
        } catch (error) {
            toast.error('Erro ao excluir o pedido.');
        }
    };

    const toggleNotifications = () => {
        const newState = !notificationsEnabled;
        setNotificationsEnabled(newState);
        localStorage.setItem('notificationsEnabled', newState);
        toast.info(`Notificações ${newState ? 'ativadas' : 'desativadas'}.`);
    };

    useEffect(() => {
        if (authLoading) return;
        if (!currentUser) {
            toast.error("Sessão expirada. Faça login novamente.");
            navigate('/login-admin');
            setLoading(false);
            return;
        }

        const fetchPanelData = async () => {
            try {
                const idTokenResult = await currentUser.getIdTokenResult(true);
                const { isAdmin, isMasterAdmin, estabelecimentoId } = idTokenResult.claims;

                if (isMasterAdmin) return navigate('/master-dashboard');
                if (!isAdmin || !estabelecimentoId) {
                    toast.error('Acesso negado.');
                    logout();
                    return navigate('/');
                }

                const estDocRef = doc(db, 'estabelecimentos', estabelecimentoId);
                const estSnap = await getDoc(estDocRef);

                if (!estSnap.exists() || !estSnap.data().ativo) {
                    toast.error('Seu estabelecimento não foi encontrado ou está inativo.');
                    logout();
                    return navigate('/');
                }

                setEstabelecimentoInfo(estSnap.data());
                return estabelecimentoId;
            } catch (e) {
                console.error("Erro na verificação de permissões:", e);
                toast.error("Ocorreu um erro ao verificar suas permissões.");
                logout();
                navigate('/');
                return null;
            }
        };

        let unsubscribers = [];
        fetchPanelData().then(estabelecimentoId => {
            if (!estabelecimentoId) {
                setLoading(false);
                return;
            }
            const statuses = ['recebido', 'preparo', 'em_entrega', 'finalizado'];
            statuses.forEach(status => {
                const q = query(collection(db, 'pedidos'), where('estabelecimentoId', '==', estabelecimentoId), where('status', '==', status), orderBy('criadoEm', 'desc'));
                const unsub = onSnapshot(q, (snapshot) => {
                    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    setPedidos(prev => ({ ...prev, [status]: list }));
                }, (err) => {
                    console.error(`Erro ao buscar pedidos '${status}':`, err);
                });
                unsubscribers.push(unsub);
            });
            setLoading(false);
        });
        return () => {
            unsubscribers.forEach(unsub => unsub());
        };
    }, [authLoading, currentUser, navigate, logout]);

    if (loading) {
        return <Spinner />;
    }

    return (
        <div className="bg-gray-100 min-h-screen">
            <header className="bg-white shadow-md p-4 flex justify-between items-center sticky top-0 z-30">
                <h1 className="text-xl font-bold text-gray-800">
                    Painel - {estabelecimentoInfo?.nome || 'Carregando...'}
                </h1>
                <div className="flex items-center space-x-4">
                    <button onClick={toggleNotifications} className={`px-4 py-2 text-sm font-semibold rounded-lg ${notificationsEnabled ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}>
                        Notificações {notificationsEnabled ? 'ON' : 'OFF'}
                    </button>
                    <Link to="/dashboard" className="text-sm text-gray-600 hover:text-blue-500">Dashboard</Link>
                    <button onClick={logout} className="text-sm text-red-500 hover:underline">Sair</button>
                </div>
            </header>
            <main className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {['recebido', 'preparo', 'em_entrega', 'finalizado'].map(status => (
                    <div key={status} className="bg-white rounded-lg shadow">
                        <h2 className="text-lg font-bold capitalize p-4 border-b text-gray-700">
                            {status.replace(/_/g, ' ')} ({pedidos[status]?.length})
                        </h2>
                        <div className="p-2 space-y-3 max-h-[calc(100vh-150px)] overflow-y-auto">
                            {pedidos[status]?.length > 0 ? (
                                pedidos[status].map(ped => (
                                    <PedidoCard
                                        key={ped.id}
                                        pedido={ped}
                                        onDeletePedido={handleDelete}
                                        onUpdateStatus={handleUpdatePedidoStatusAndWhatsApp}
                                        estabelecimentoInfo={estabelecimentoInfo}
                                    />
                                ))
                            ) : (
                                <p className="p-4 text-center text-sm text-gray-400">Nenhum pedido aqui.</p>
                            )}
                        </div>
                    </div>
                ))}
            </main>
        </div>
    );
}