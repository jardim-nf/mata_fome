import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { format, formatDistanceToNow, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';
import PedidoCard from '../components/PedidoCard';
const getTodayFormattedDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

function Painel({ usuarioAtual, estabelecimento }) { // Você está passando 'estabelecimento' como prop para o Painel, certo?
    const navigate = useNavigate();
    const { currentUser, isAdmin, loading: authLoading } = useAuth();

    // Estados para cada coluna - agora todos como Arrays para consistência
    const [pedidosRecebidos, setPedidosRecebidos] = useState([]);
    const [pedidosEmPreparo, setPedidosEmPreparo] = useState([]);
    const [pedidosEmEntrega, setPedidosEmEntrega] = useState([]);
    const [pedidosFinalizados, setPedidosFinalizados] = useState([]);

    const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null); // Estado para as informações do estabelecimento
    const [loadingPainel, setLoadingPainel] = useState(true);
    const [painelError, setPainelError] = useState('');

    const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
        const stored = localStorage.getItem('notificationsEnabled');
        return stored === 'true';
    });

    const [autoPrintEnabled, setAutoPrintEnabled] = useState(() => {
        const stored = localStorage.getItem('autoPrintEnabled');
        return stored === 'true';
    });

    const prevPedidosRecebidosRef = useRef([]);
    const audioRef = useRef(null);
    const [audioBlockedMessage, setAudioBlockedMessage] = useState('');

    useEffect(() => {
        audioRef.current = new Audio('/campainha.mp3');
        audioRef.current.load();

        const handleCanPlay = () => {
            console.log("Painel Audio Debug: Evento 'canplaythrough' disparado. Áudio está pronto.");
        };
        if (audioRef.current) {
            audioRef.current.addEventListener('canplaythrough', handleCanPlay);
        }

        return () => {
            if (audioRef.current) {
                audioRef.current.removeEventListener('canplaythrough', handleCanPlay);
                audioRef.current.pause();
                audioRef.current.src = '';
                audioRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!authLoading) {
            if (!currentUser || !isAdmin) {
                toast.error('Acesso negado. Você precisa ser um administrador para acessar esta página.');
                navigate('/');
            }
        }
    }, [currentUser, isAdmin, authLoading, navigate]);

    useEffect(() => {
        if (authLoading === false && currentUser && isAdmin) {
            setLoadingPainel(true);
            setPainelError('');

            let unsubscribeRecebidos = () => {};
            let unsubscribeEmPreparo = () => {};
            let unsubscribeEmEntrega = () => {};
            let unsubscribeFinalizados = () => {};

            const fetchEstabelecimentoAndPedidos = async () => {
                try {
                    // Achar o estabelecimento vinculado ao admin UID
                    const estabelecimentosRef = collection(db, 'estabelecimentos');
                    const qEstabelecimento = query(estabelecimentosRef, where('adminUID', '==', currentUser.uid));
                    const querySnapshotEstabelecimento = await getDocs(qEstabelecimento);

                    if (!querySnapshotEstabelecimento.empty) {
                        const estDoc = querySnapshotEstabelecimento.docs[0];
                        setEstabelecimentoInfo({ id: estDoc.id, ...estDoc.data() }); // Salva as informações do estabelecimento
                        const realEstabelecimentoId = estDoc.id; // ID real para as queries de pedido

                        const pedidosCollectionRef = collection(db, 'pedidos');

                        // Função para criar a query com status E ID do estabelecimento
                        const createPedidoQuery = (status) => query(
                            pedidosCollectionRef,
                            where('estabelecimentoId', '==', realEstabelecimentoId), // Filtra por estabelecimento
                            where('status', '==', status), // Filtra por status
                            orderBy('criadoEm', 'desc') // Ordena por data de criação
                        );

                        // --- Listeners para cada coluna ---
                        // Listener para Pedidos Recebidos
                        unsubscribeRecebidos = onSnapshot(createPedidoQuery('recebido'), (snapshot) => {
                            const newPedidos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                            const oldPedidosIds = new Set(prevPedidosRecebidosRef.current.map(p => p.id));
                            const newlyReceivedOrders = newPedidos.filter(p => !oldPedidosIds.has(p.id));

                            if (newlyReceivedOrders.length > 0) {
                                if (notificationsEnabled && Notification.permission === 'granted') {
                                    newlyReceivedOrders.forEach(pedido => {
                                        new Notification(`Novo Pedido - ${pedido.cliente.nome}`, {
                                            body: `Total: R$ ${pedido.totalFinal.toFixed(2).replace('.', ',')}\nItens: ${pedido.itens.map(i => i.nome).join(', ')}`,
                                            icon: '/logo-deufome.png'
                                        });
                                    });

                                    if (audioRef.current) {
                                        audioRef.current.currentTime = 0;
                                        audioRef.current.play().catch(e => {
                                            console.error("Erro ao tocar áudio (autoplay pode estar bloqueado):", e);
                                            if (e.name === "NotAllowedError" || e.name === "AbortError") {
                                                setAudioBlockedMessage("Som de notificação bloqueado. Clique no banner acima para ativá-lo!");
                                            }
                                        });
                                    } else {
                                        console.warn("audioRef.current é null ao tentar tocar para novo pedido.");
                                    }
                                } else {
                                    console.log("Notificações não disparadas. Condições (notificationsEnabled, permissão) não atendidas.");
                                }
                                toast.info(`🔔 Novo pedido recebido de ${newlyReceivedOrders[0].cliente.nome}! Total: R$ ${newlyReceivedOrders[0].totalFinal.toFixed(2).replace('.', ',')}`);
                            } else {
                                console.log("Nenhum pedido VERDADEIRAMENTE novo detectado para notificação.");
                            }
                            setPedidosRecebidos(newPedidos);
                            prevPedidosRecebidosRef.current = newPedidos; // ATUALIZA A REF
                        }, (error) => console.error("Erro no listener de Recebidos:", error));

                        // Listener para Pedidos Em Preparo - AGORA USANDO 'preparo'
                        unsubscribeEmPreparo = onSnapshot(createPedidoQuery('preparo'), (snapshot) => {
                            setPedidosEmPreparo(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                        }, (error) => console.error("Erro no listener de Em Preparo:", error));

                        // Listener para Pedidos Em Entrega - AGORA USANDO 'em_entrega'
                        unsubscribeEmEntrega = onSnapshot(createPedidoQuery('em_entrega'), (snapshot) => {
                            setPedidosEmEntrega(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                        }, (error) => console.error("Erro no listener de Em Entrega:", error));

                        // Listener para Pedidos Finalizados - AGORA USANDO 'finalizado'
                        unsubscribeFinalizados = onSnapshot(createPedidoQuery('finalizado'), (snapshot) => {
                            setPedidosFinalizados(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                        }, (error) => console.error("Erro no listener de Finalizados:", error));

                    } else {
                        setPainelError("Nenhum estabelecimento vinculado a este administrador.");
                        toast.error("Nenhum estabelecimento encontrado para este administrador.");
                        setEstabelecimentoInfo(null); // Garante que esteja null
                        setPedidosRecebidos([]);
                        setPedidosEmPreparo([]);
                        setPedidosEmEntrega([]);
                        setPedidosFinalizados([]);
                    }
                } catch (error) {
                    console.error("Erro ao carregar painel de pedidos:", error);
                    setPainelError("Erro ao carregar o painel. Verifique os índices do Firestore e a conexão.");
                    toast.error("Erro ao carregar o painel. Verifique os índices do Firestore e a conexão.");
                } finally {
                    setLoadingPainel(false);
                }
            };

            fetchEstabelecimentoAndPedidos();

            // Retorna uma função de limpeza que será executada quando o componente for desmontado
            return () => {
                unsubscribeRecebidos();
                unsubscribeEmPreparo();
                unsubscribeEmEntrega();
                unsubscribeFinalizados();
            };
        } else if (authLoading === false && (!currentUser || !isAdmin)) {
            setLoadingPainel(false);
        }
    }, [currentUser, isAdmin, authLoading, notificationsEnabled]); // Adicionei estabelecimentoInfo aqui se ele vier de fora, mas se é carregado dentro do useEffect, não precisa

    const toggleNotifications = async () => {
        // ... (sua lógica existente para notificações)
        if (notificationsEnabled) {
            setNotificationsEnabled(false);
            localStorage.setItem('notificationsEnabled', 'false');
            toast.info('Notificações desativadas.');
            if (audioRef.current && !audioRef.current.paused) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            setAudioBlockedMessage('');
            return;
        }

        let permissionRequested = false;
        let permissionGranted = false;

        if ('Notification' in window) {
            permissionRequested = true;
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                permissionGranted = true;
            }
        } else {
            console.warn('API de Notificação de Desktop não suportada neste navegador.');
            toast.warn('Seu navegador não suporta notificações pop-up nativas.');
        }

        setNotificationsEnabled(true);
        localStorage.setItem('notificationsEnabled', 'true');

        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().then(() => {
                console.log("Áudio tocado com SUCESSO no toggle (interação do usuário).");
                setAudioBlockedMessage(''); // Corrigido aqui
            }).catch(e => {
                console.warn("Áudio pode ter sido bloqueado na primeira reprodução após permissão:", e);
                if (e.name === "NotAllowedError" || e.name === "AbortError") {
                    setAudioBlockedMessage("Som de notificação bloqueado. Clique para reativar!");
                }
            });
        } else {
            console.warn("audioRef.current é null quando tentou tocar no toggle.");
        }

        if (permissionRequested) {
            if (permissionGranted) {
                toast.success('Notificações ativadas (incluindo pop-ups)!');
            } else {
                toast.warn('Notificações ativadas (apenas som e alertas internos, pop-ups bloqueados)!');
            }
        } else {
            toast.info('Notificações ativadas (apenas som e alertas internos, pop-ups não suportados)!');
        }
    };

    const toggleAutoPrint = () => {
        setAutoPrintEnabled(prev => {
            const newStatus = !prev;
            localStorage.setItem('autoPrintEnabled', newStatus.toString());
            toast.info(`Impressão automática: ${newStatus ? 'Ativada' : 'Desativada'}.`);
            return newStatus;
        });
    };

    // Não precisamos de getPedidoById, updateOrderStatus, generateComandaHTML, deletePedido aqui
    // já que PedidoCard faz as atualizações e o Painel apenas reage via onSnapshot.

    if (authLoading || loadingPainel) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
                <p className="text-xl text-gray-700">Carregando painel de administração...</p>
            </div>
        );
    }

    if (painelError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-red-100 text-red-700 p-4 text-center">
                <p className="text-xl font-semibold">Erro no Painel:</p>
                <p className="mt-2">{painelError}</p>
                <p className="mt-4 text-sm text-gray-600">
                    Por favor, certifique-se de que seu usuário administrador está vinculado a um estabelecimento no Firestore
                    (campo 'adminUID' no documento do estabelecimento com o UID do seu admin).
                    E verifique o console do navegador para links de criação de índices.
                </p>
                <button onClick={() => navigate('/')} className="mt-6 bg-red-500 text-white px-4 py-2 rounded">
                    Voltar para Home
                </button>
            </div>
        );
    }

    if (!currentUser || !isAdmin) {
        return null;
    }

    // PedidoCardComponent ajustado para passar as props corretamente
    const PedidoCardComponent = ({ pedido }) => {
        return (
            <PedidoCard
                pedido={pedido}
                // mudarStatus e excluirPedido não precisam ser passados, pois PedidoCard os manipula internamente
                // e o Painel reage via onSnapshot.
                estabelecimento={estabelecimentoInfo} // Certifique-se que estabelecimentoInfo está disponível
                autoPrintEnabled={autoPrintEnabled}
            />
        );
    };

    return (
        <div className="p-4 bg-gray-100 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <Link to="/dashboard" className="flex items-center text-gray-600 hover:text-gray-900">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                        Voltar para o Dashboard
                    </Link>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 text-center flex-grow">Painel de Pedidos {estabelecimentoInfo ? `(${estabelecimentoInfo.nome})` : ''}</h1>
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-end mt-4 sm:mt-0 w-full sm:w-auto">
                        <button
                                onClick={toggleNotifications}
                                className={`${notificationsEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-300 text-gray-800 hover:bg-gray-400'} text-white px-4 py-2 rounded-lg`}>
                            {notificationsEnabled ? '🔔 Notificações Ativadas' :
                            notificationsEnabled && audioBlockedMessage ? '⚠️ Som Bloqueado! Ativar?' :
                            '🔕 Notificações Desativadas'}
                        </button>

                    </div>
                </div>

                {audioBlockedMessage && (
                    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
                        <p className="font-bold">Atenção!</p>
                        <p>{audioBlockedMessage} <button onClick={() => { if(audioRef.current) audioRef.current.play().catch(() => {}); setAudioBlockedMessage(''); }} className="underline font-semibold">Tocar agora</button></p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    {/* Coluna de Pedidos Recebidos */}
                    <div className="bg-white rounded-lg shadow-lg p-4 border border-gray-200">
                        <h2 className="text-xl font-semibold mb-4 pb-2 border-b-2 text-red-600 border-red-300 flex items-center gap-2">
                            📦 Recebido ({pedidosRecebidos.length})
                        </h2>
                        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2"> {/* Aumentei max-height */}
                            {pedidosRecebidos.length === 0 ? (
                                <p className="text-gray-500 italic text-center py-4">Nenhum pedido nesta coluna.</p>
                            ) : (
                                pedidosRecebidos.map(pedido => (
                                    <PedidoCardComponent
                                        key={pedido.id}
                                        pedido={pedido}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Coluna de Pedidos Em Preparo */}
                    <div className="bg-white rounded-lg shadow-lg p-4 border border-yellow-300">
                        <h2 className="text-xl font-semibold mb-4 pb-2 border-b-2 text-blue-600 border-blue-300 flex items-center gap-2">
                            🧑‍🍳 Em Preparo ({pedidosEmPreparo.length})
                        </h2>
                        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                            {pedidosEmPreparo.length === 0 ? (
                                <p className="text-gray-500 italic text-center py-4">Nenhum pedido nesta coluna.</p>
                            ) : (
                                pedidosEmPreparo.map(pedido => (
                                    <PedidoCardComponent
                                        key={pedido.id}
                                        pedido={pedido}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Coluna de Pedidos Em Entrega */}
                    <div className="bg-white rounded-lg shadow-lg p-4 border border-orange-300"> {/* Corrigi para orange-300 */}
                        <h2 className="text-xl font-semibold mb-4 pb-2 border-b-2 text-orange-600 border-orange-300 flex items-center gap-2">
                            🛵 Em Entrega ({pedidosEmEntrega.length})
                        </h2>
                        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                            {pedidosEmEntrega.length === 0 ? (
                                <p className="text-gray-500 italic text-center py-4">Nenhum pedido nesta coluna.</p>
                            ) : (
                                pedidosEmEntrega.map(pedido => (
                                    <PedidoCardComponent
                                        key={pedido.id}
                                        pedido={pedido}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Coluna de Pedidos Finalizados */}
                    <div className="bg-white rounded-lg shadow-lg p-4 border border-green-300"> {/* Corrigi para green-300 */}
                        <h2 className="text-xl font-semibold mb-4 pb-2 border-b-2 text-green-600 border-green-300 flex items-center gap-2">
                            ✅ Finalizados ({pedidosFinalizados.length})
                        </h2>
                        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                            {pedidosFinalizados.length === 0 ? (
                                <p className="text-gray-500 italic text-center py-4">Nenhum pedido nesta coluna.</p>
                            ) : (
                                pedidosFinalizados.map(pedido => (
                                    <PedidoCardComponent
                                        key={pedido.id}
                                        pedido={pedido}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Painel;