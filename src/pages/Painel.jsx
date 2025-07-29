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
// Importe 'app' do seu arquivo firebase.js para usar com getFunctions, se necessário
import { db, app } from '../firebase'; // <--- CORRIGIDO: Importando 'app'
import { useAuth } from '../context/AuthContext';
import PedidoCard from "../components/PedidoCard";
// Importar Firebase Functions e httpsCallable
// Mantenha getFunctions se usar para outras Cloud Functions. Remova httpsCallable.
import { getFunctions } from 'firebase/functions'; // <--- CORRIGIDO: Removido httpsCallable daqui, se não precisar mais

// Componente Spinner para carregamento
function Spinner() {
    return (
        <div className="flex flex-col items-center justify-center p-8">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-secondary">Carregando pedidos...</p>
        </div>
    );
}

export default function Painel() {
    const navigate = useNavigate();
    const audioRef = useRef(null);
    const {
        currentUser,
        loading: authLoading,
        logout,
        isAdmin: authContextIsAdmin,
        isMasterAdmin: authContextIsMasterAdmin,
        estabelecimentoId: authContextEstabelecimentoId,
        isEstabelecimentoAtivo: authContextIsEstabelecimentoAtivo,
    } = useAuth();

    // NOVO: Inicializar Firebase Functions e a função callable
    // Se você não usa mais NENHUMA Cloud Function neste componente, pode remover as 2 linhas abaixo
    // const firebaseFunctions = getFunctions(app); // Manter se usar outras functions
    // const sendWhatsAppMessageCallable = httpsCallable(firebaseFunctions, 'sendWhatsAppMessage'); // Removido para WhatsApp direto

    const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
    const [pedidos, setPedidos] = useState({
        recebido: [],
        preparo: [],
        em_entrega: [],
        finalizado: []
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
        return localStorage.getItem('notificationsEnabled') === 'true';
    });
    const prevRecebidos = useRef([]);
    const [audioBlockedMsg, setAudioBlockedMsg] = useState('');

    useEffect(() => {
        audioRef.current = new Audio('/campainha.mp3');
        return () => {
            audioRef.current && audioRef.current.pause();
        };
    }, []);

    useEffect(() => {
        if (authLoading) return;
        let unsub = [];

        async function init() {
            if (!currentUser) {
                toast.error('Faça login para acessar esta página.');
                navigate('/');
                setLoading(false);
                return;
            }

            try {
                const idTokenResult = await currentUser.getIdTokenResult(true);
                const currentIsAdmin = idTokenResult.claims.isAdmin === true;
                const currentIsMasterAdmin = idTokenResult.claims.isMasterAdmin === true;
                const currentEstabelecimentoId = idTokenResult.claims.estabelecimentoId;
                const currentIsEstabelecimentoAtivo = idTokenResult.claims.isEstabelecimentoAtivo === true;

                if (currentIsMasterAdmin) {
                    toast.info('Redirecionando para o Dashboard Master.');
                    navigate('/master-dashboard');
                    setLoading(false);
                    return;
                }

                if (!currentIsAdmin || !currentEstabelecimentoId || !currentIsEstabelecimentoAtivo) {
                    toast.error('Permissões inválidas.');
                    navigate('/');
                    setLoading(false);
                    return;
                }

                const estDocRef = doc(db, 'estabelecimentos', currentEstabelecimentoId);
                const estSnap = await getDoc(estDocRef);
                if (!estSnap.exists()) throw new Error('Estabelecimento não encontrado.');
                setEstabelecimentoInfo(estSnap.data());

                const baseQuery = (status) => (
                    query(
                        collection(db, 'pedidos'),
                        where('estabelecimentoId', '==', currentEstabelecimentoId),
                        where('status', '==', status),
                        orderBy('criadoEm', 'desc')
                    )
                );

                unsub.push(onSnapshot(baseQuery('recebido'), snap => {
                    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    const newOnes = list.filter(p => !prevRecebidos.current.find(o => o.id === p.id));
                    if (newOnes.length && notificationsEnabled) {
                        audioRef.current.play()
                            .then(() => setAudioBlockedMsg(''))
                            .catch(() => {
                                setAudioBlockedMsg('Som de notificação bloqueado. Clique para ativar.');
                            });
                        toast.info(`🔔 Novo pedido: R$ ${newOnes[0].totalFinal.toFixed(2)}`);
                    }
                    prevRecebidos.current = list;
                    setPedidos(prev => ({ ...prev, recebido: list }));
                }));

                unsub.push(onSnapshot(baseQuery('preparo'), snap => {
                    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setPedidos(prev => ({ ...prev, preparo: list }));
                }));

                unsub.push(onSnapshot(baseQuery('em_entrega'), snap => {
                    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setPedidos(prev => ({ ...prev, em_entrega: list }));
                }));

                unsub.push(onSnapshot(baseQuery('finalizado'), snap => {
                    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setPedidos(prev => ({ ...prev, finalizado: list }));
                }));

                setLoading(false);
            } catch (e) {
                toast.error(e.message);
                setLoading(false);
                logout();
                navigate('/');
            }
        }

        init();

        return () => unsub.forEach(fn => fn());
    }, [authLoading, currentUser, navigate, logout, notificationsEnabled]); // Adicionei 'notificationsEnabled' nas deps

    const toggleNotifications = () => {
        const enable = !notificationsEnabled;
        setNotificationsEnabled(enable);
        localStorage.setItem('notificationsEnabled', enable.toString());

        toast.info(enable ? 'Notificações ativas' : 'Notificações desativadas');

        if (enable) {
            audioRef.current.play()
                .then(() => setAudioBlockedMsg(''))
                .catch(() => {
                    setAudioBlockedMsg('Som de notificação bloqueado. Clique para ativar.');
                });
        } else {
            audioRef.current && audioRef.current.pause();
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Excluir pedido permanentemente?')) return;
        try {
            await deleteDoc(doc(db, 'pedidos', id));
            toast.success('Pedido excluído com sucesso!');
        } catch (error) {
            toast.error('Erro ao excluir pedido.');
        }
    };

    // FUNÇÃO MODIFICADA: para atualizar status do pedido E abrir WhatsApp via link
    const handleUpdatePedidoStatusAndWhatsApp = async (pedidoId, newStatus, pedidoData) => {
        try {
            const pedidoRef = doc(db, 'pedidos', pedidoId);
            await updateDoc(pedidoRef, { status: newStatus });
            toast.success(`Status alterado para ${newStatus.replace('_', ' ')}!`);

            // Se o status for 'preparo' ou 'em_entrega' e notificações ativadas
            if ((newStatus === 'preparo' || newStatus === 'em_entrega') && notificationsEnabled) {
                const numeroCliente = pedidoData.cliente?.telefone; // <--- ATENÇÃO AQUI: Verifique o caminho real do telefone
                let mensagemCliente = '';

                if (newStatus === 'preparo') {
                    mensagemCliente = `Olá ${pedidoData.cliente?.nome?.split(' ')[0] || 'cliente'}! Seu pedido #${pedidoData.id.slice(0, 5).toUpperCase()} no ${estabelecimentoInfo?.nome || 'nosso estabelecimento'} agora está EM PREPARO. Em breve estará a caminho!`;
                } else if (newStatus === 'em_entrega') {
                    mensagemCliente = `Ótimas notícias, ${pedidoData.cliente?.nome?.split(' ')[0] || 'cliente'}! Seu pedido #${pedidoData.id.slice(0, 5).toUpperCase()} do ${estabelecimentoInfo?.nome || 'nosso estabelecimento'} já saiu para entrega e logo chegará!`;
                }

                if (numeroCliente) {
                    try {
                        // Remove todos os caracteres não numéricos do telefone (ex: parênteses, traços, espaços)
                        const formattedNumero = numeroCliente.replace(/\D/g, ''); 
                        
                        // --- DEBUG LOGS ADICIONADOS AQUI ---
                        console.log("DEBUG: Número Cliente Original:", numeroCliente);
                        console.log("DEBUG: Número Formatado (DDI+DDD+Num):", formattedNumero);
                        console.log("DEBUG: Mensagem a ser enviada:", mensagemCliente);
                        console.log("DEBUG: Mensagem Codificada (para URL):", encodeURIComponent(mensagemCliente));
                        // --- FIM DOS DEBUG LOGS ---

                        // Constrói o link wa.me para abrir o WhatsApp Web/App
                        const whatsappLink = `https://wa.me/${formattedNumero}?text=${encodeURIComponent(mensagemCliente)}`;
                        
                        console.log("DEBUG: Link do WhatsApp Gerado:", whatsappLink); // Log final do link

                        // Abre o link em uma nova aba do navegador
                        // ATENÇÃO: Navegadores podem bloquear pop-ups. Verifique a barra de endereço.
                        window.open(whatsappLink, '_blank');
                        
                        toast.info('Link do WhatsApp aberto. Por favor, envie a mensagem manualmente.');
                    } catch (error) {
                        toast.error(`Erro ao abrir WhatsApp: ${error.message}`);
                        console.error('Erro ao abrir link do WhatsApp:', error);
                    }
                } else {
                    // Esta mensagem aparecerá se pedidoData.cliente?.telefone for nulo ou undefined
                    toast.warn('Número de telefone do cliente não encontrado para abrir WhatsApp.');
                    console.warn("WARN: Telefone do cliente não encontrado para o pedido:", pedidoData);
                }
            }
        } catch (error) {
            console.error('Erro ao atualizar status ou preparar WhatsApp:', error);
            toast.error(`Erro ao atualizar status do pedido: ${error.message}`);
        }
    };


    if (loading) return <Spinner />;
    if (error) return <div className="p-6 bg-red-100 text-red-700 rounded-lg"><p className="font-bold">Erro:</p><p>{error}</p></div>;

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <header className="fixed top-0 left-0 right-0 z-20 p-6 flex justify-between items-center bg-white shadow-sm border-b border-gray-100">
                <div className="font-extrabold text-2xl text-black cursor-pointer hover:text-gray-800" onClick={() => navigate('/')}>DEU FOME <span className="text-yellow-500">.</span></div>
                <div className="flex items-center space-x-4">
                    <span className="text-black text-md font-medium">Olá, {currentUser?.email?.split('@')[0]}!</span>
                    <Link to="/painel" className="px-4 py-2 rounded-full text-black bg-yellow-500 font-semibold text-sm hover:bg-yellow-600">Painel de Pedidos</Link>
                    <button onClick={() => { logout(); navigate('/'); }} className="px-4 py-2 rounded-full text-black border border-gray-300 font-semibold text-sm hover:bg-gray-100">Sair</button>
                </div>
            </header>

            <div className="max-w-6xl mx-auto pt-24">
                <div className="flex flex-col sm:flex-row items-center justify-between mb-8">
                    <Link to="/dashboard" className="text-secondary hover:text-primary font-medium">&larr; Voltar</Link>
                    <h1 className="text-3xl font-heading text-secondary text-center">Painel ({estabelecimentoInfo?.nome || 'Carregando...'})</h1>
                    <button
                        onClick={toggleNotifications}
                        className={`px-4 py-2 rounded-lg font-semibold transition ${
                            notificationsEnabled ? 'bg-primary text-accent' : 'bg-gray-300 text-secondary'
                        }`}
                    >
                        {notificationsEnabled ? '🔔 On' : '🔕 Off'}
                    </button>
                </div>

                {audioBlockedMsg && (
                    <div className="mb-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded">
                        {audioBlockedMsg} <button onClick={() => audioRef.current && audioRef.current.play().catch(() => {})} className="underline">Tentar</button>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    {['recebido', 'preparo', 'em_entrega', 'finalizado'].map(status => (
                        <div key={status} className="bg-white rounded-lg shadow p-4 border">
                            <h2 className="text-xl font-heading mb-2 capitalize">{status.replace('_', ' ')}</h2>
                            <div className="space-y-4 max-h-[70vh] overflow-auto pr-2">
                                {pedidos[status]?.length === 0 ? (
                                    <p className="text-secondary italic text-center py-4">Nenhum pedido.</p>
                                ) : pedidos[status]?.map(ped => (
                                    <PedidoCard
                                        key={ped.id}
                                        pedido={ped}
                                        estabelecimento={estabelecimentoInfo}
                                        autoPrintEnabled={true}
                                        onDeletePedido={handleDelete}
                                        // NOVO: Passar a nova função de update para o PedidoCard
                                        onUpdateStatus={handleUpdatePedidoStatusAndWhatsApp}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <footer className="w-full py-4 text-center text-xs text-gray-500 mt-8">
                &copy; 2025 DeuFome. Todos os direitos reservados.
            </footer>
        </div>
    );
}