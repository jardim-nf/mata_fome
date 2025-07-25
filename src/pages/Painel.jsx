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
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import PedidoCard from '../components/PedidoCard';

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
    }, [authLoading, currentUser]);

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
