// src/pages/Painel.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // Link já estava importado, agora será usado
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

// Componente Spinner (sem alterações)
function Spinner() {
    return (
        <div className="flex flex-col items-center justify-center p-8 h-screen bg-gray-100">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-secondary">Carregando pedidos...</p>
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
    const [error, setError] = useState('');
    const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem('notificationsEnabled') === 'true');
    const prevRecebidos = useRef([]);
    const [audioBlockedMsg, setAudioBlockedMsg] = useState('');

    useEffect(() => { audioRef.current = new Audio('/campainha.mp3'); audioRef.current.loop = false; }, []);

    useEffect(() => {
        if (authLoading || !currentUser) return;
        
        let unsubscribers = [];
        const init = async () => {
            try {
                const idTokenResult = await currentUser.getIdTokenResult(true);
                const { isAdmin, isMasterAdmin, estabelecimentoId, isEstabelecimentoAtivo } = idTokenResult.claims;

                if (isMasterAdmin) { navigate('/master-dashboard'); return; }
                if (!isAdmin || !estabelecimentoId || !isEstabelecimentoAtivo) { toast.error('Permissões inválidas ou estabelecimento inativo.'); navigate('/'); return; }

                const estDocRef = doc(db, 'estabelecimentos', estabelecimentoId);
                const estSnap = await getDoc(estDocRef);
                if (!estSnap.exists()) throw new Error('Estabelecimento não encontrado.');
                setEstabelecimentoInfo(estSnap.data());

                const statuses = ['recebido', 'preparo', 'em_entrega', 'finalizado'];
                statuses.forEach(status => {
                    const q = query(collection(db, 'pedidos'), where('estabelecimentoId', '==', estabelecimentoId), where('status', '==', status), orderBy('criadoEm', 'desc'));
                    const unsub = onSnapshot(q, (snapshot) => {
                        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                        if (status === 'recebido') {
                            const newOrders = list.filter(p => !prevRecebidos.current.some(o => o.id === p.id));
                            if (newOrders.length > 0 && notificationsEnabled) {
                                toast.info(`🔔 Novo pedido recebido!`);
                                audioRef.current.play().catch(() => setAudioBlockedMsg('Som bloqueado. Clique para ativar.'));
                            }
                            prevRecebidos.current = list;
                        }
                        setPedidos(prev => ({ ...prev, [status]: list }));
                    }, (err) => {
                        console.error(`Erro ao buscar pedidos '${status}':`, err);
                        toast.error(`Falha ao carregar '${status}'. Verifique o console.`);
                    });
                    unsubscribers.push(unsub);
                });
                setLoading(false);

            } catch (e) {
                toast.error(e.message);
                setError(e.message);
                setLoading(false);
                logout();
                navigate('/');
            }
        };

        init();
        return () => unsubscribers.forEach(unsub => unsub());
    }, [authLoading, currentUser, navigate, logout, notificationsEnabled]);
    
    // Função para atualizar status e notificar via WhatsApp
    const handleUpdatePedidoStatusAndWhatsApp = async (pedidoId, newStatus) => {
        try {
            const pedidoRef = doc(db, 'pedidos', pedidoId);
            await updateDoc(pedidoRef, { status: newStatus });
            toast.success(`Pedido movido para ${newStatus.replace('_', ' ')}!`);

            const allPedidos = [...pedidos.recebido, ...pedidos.preparo, ...pedidos.em_entrega, ...pedidos.finalizado];
            const pedidoData = allPedidos.find(p => p.id === pedidoId);
            
            if (pedidoData && ['preparo', 'em_entrega', 'finalizado'].includes(newStatus)) {
                sendWhatsAppNotification(newStatus, pedidoData);
            }
        } catch (error) {
            console.error('ERRO AO ATUALIZAR STATUS:', error);
            toast.error("Falha ao mover o pedido. Verifique o console (F12).");
        }
    };
    
    // Função para enviar a notificação do WhatsApp
    const sendWhatsAppNotification = (newStatus, pedidoData) => {
        const numeroCliente = pedidoData?.cliente?.telefone;
        if (!numeroCliente) {
            toast.warn('Número do cliente não encontrado para notificar via WhatsApp.');
            return;
        }

        let formattedNumero = numeroCliente.replace(/\D/g, '');
        if (formattedNumero.length >= 10 && !formattedNumero.startsWith('55')) {
            formattedNumero = '55' + formattedNumero;
        }

        if (formattedNumero.length < 12) return;
        
        let mensagemCliente = '';
        const nomeCliente = pedidoData.cliente?.nome?.split(' ')[0] || 'Cliente';
        const nomeEstabelecimento = estabelecimentoInfo?.nome || 'nossa loja';
        const pedidoIdCurto = pedidoData.id.slice(0, 5).toUpperCase();

        if (newStatus === 'preparo') {
            const itensResumo = pedidoData.itens.map(item => `   - ${item.quantidade}x ${item.nome}`).join('\n');
            const totalPedido = `R$ ${pedidoData.totalFinal.toFixed(2).replace('.', ',')}`;
            const formaPagamento = pedidoData.formaPagamento || 'Não informada';
            mensagemCliente = `Olá, ${nomeCliente}! 👋\nConfirmamos seu pedido *#${pedidoIdCurto}* e ele já está em preparo!\n\n*Resumo:*\n${itensResumo}\n\n*Total:* ${totalPedido}\n*Pagamento:* ${formaPagamento}\n\n`;
            if (formaPagamento.toLowerCase() === 'pix') {
                mensagemCliente += `*Atenção:* Por favor, envie o comprovante do Pix aqui para agilizar a liberação. 📄`;
            }
        } else if (newStatus === 'em_entrega') {
            mensagemCliente = `Boas notícias, ${nomeCliente}! Seu pedido #${pedidoIdCurto} de ${nomeEstabelecimento} já saiu para entrega! 🛵`;
        } else if (newStatus === 'finalizado') {
            mensagemCliente = `Olá, ${nomeCliente}! Seu pedido #${pedidoIdCurto} foi finalizado. Agradecemos a preferência e bom apetite! 😋`;
        }
        
        const whatsappLink = `https://wa.me/${formattedNumero}?text=${encodeURIComponent(mensagemCliente)}`;
        window.open(whatsappLink, '_blank');
        toast.info('Abrindo WhatsApp para notificar o cliente...');
    };

    const handleDelete = async (id) => { if (!window.confirm('Excluir pedido?')) return; try { await deleteDoc(doc(db, 'pedidos', id)); toast.success('Pedido excluído!'); } catch (error) { toast.error('Erro ao excluir.'); } };
    const toggleNotifications = () => { /* ... */ };
    const handleActivateSound = () => { /* ... */ };

    if (loading) return <Spinner />;

    return (
        <div className="bg-gray-100 min-h-screen">
            <header className="fixed top-0 left-0 right-0 z-20 p-4 flex justify-between items-center bg-secondary shadow-lg">
                <div className="font-extrabold text-2xl text-white cursor-pointer hover:text-primary" onClick={() => navigate('/dashboard')}> DEU FOME <span className="text-primary">.</span> </div>
                <div className="flex items-center space-x-4">
                    {/* ▼▼▼ BOTÃO ADICIONADO AQUI ▼▼▼ */}
                    <Link to="/dashboard" className="px-4 py-2 rounded-full text-white border border-primary font-semibold text-sm hover:bg-primary hover:text-secondary hidden sm:block">
                        Voltar ao Dashboard
                    </Link>
                    {/* ▲▲▲ BOTÃO ADICIONADO AQUI ▲▲▲ */}

                    <button onClick={() => { logout(); navigate('/'); }} className="px-4 py-2 rounded-full text-white border border-primary font-semibold text-sm hover:bg-primary hover:text-secondary"> Sair </button>
                </div>
            </header>
            <div className="max-w-screen-xl mx-auto pt-24 px-4">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-secondary"> Painel de Pedidos ({estabelecimentoInfo?.nome || '...'}) </h1>
                    <button onClick={toggleNotifications} className={`px-4 py-2 rounded-lg font-semibold ${notificationsEnabled ? 'bg-primary text-secondary' : 'bg-gray-300'}`}>
                        {notificationsEnabled ? '🔔 ON' : '🔕 OFF'}
                    </button>
                </div>
                {audioBlockedMsg && ( <div className="mb-4 p-4 bg-yellow-100 flex justify-between"> <span>{audioBlockedMsg}</span> <button onClick={handleActivateSound}> Ativar </button> </div> )}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    {['recebido', 'preparo', 'em_entrega', 'finalizado'].map(status => (
                        <div key={status} className="bg-white rounded-xl shadow-sm">
                            <h2 className="text-xl font-bold capitalize p-4 border-b"> {status.replace('_', ' ')} ({pedidos[status]?.length}) </h2>
                            <div className="p-4 space-y-4 max-h-[70vh] overflow-auto">
                                {pedidos[status]?.map(ped => (
                                    <PedidoCard
                                        key={ped.id}
                                        pedido={ped}
                                        onDeletePedido={handleDelete}
                                        onUpdateStatus={handleUpdatePedidoStatusAndWhatsApp}
                                        estabelecimentoInfo={estabelecimentoInfo}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}