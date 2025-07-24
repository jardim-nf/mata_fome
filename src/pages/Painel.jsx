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
    getDoc // Importe getDoc para usar com doc(db, 'estabelecimentos', currentEstabelecimentoId)
} from 'firebase/firestore';
import { db } from '../firebase'; // Sua instância do Firestore
import { useAuth } from '../context/AuthContext'; // Seu contexto de autenticação
import { toast } from 'react-toastify'; // Notificações toast
import { getAuth } from 'firebase/auth'; // Importa getAuth para forçar o refresh do token
import PedidoCard from '../components/PedidoCard'; // Componente de card de pedido

// Spinner component
function Spinner() {
    return (
        <div className="flex flex-col items-center justify-center p-8">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-secondary">Carregando pedidos...</p>
        </div>
    );
}

export default function Painel() {
    const navigate = useNavigate(); // Hook para navegação
    const audioRef = useRef(null); // Ref para o elemento de áudio

    // Extrai informações do contexto de autenticação
    const {
        currentUser,
        loading: authLoading, // Estado de carregamento da autenticação do AuthContext
        logout, // Função de logout do AuthContext
        isAdmin: authContextIsAdmin,
        isMasterAdmin: authContextIsMasterAdmin,
        estabelecimentoId: authContextEstabelecimentoId,
        isEstabelecimentoAtivo: authContextIsEstabelecimentoAtivo,
    } = useAuth();

    // Estados para gerenciar a informação do estabelecimento e pedidos
    const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
    const [pedidos, setPedidos] = useState({
        recebido: [],
        preparo: [],
        // >>>>> CORREÇÃO FINAL AQUI: TROCADO 'entrega' POR 'em_entrega' NO ESTADO INICIAL <<<<<
        em_entrega: [], // <--- MUDANÇA NESTA LINHA PARA CONDIZER COM A QUERY E STATUS
        finalizado: []
    });
    // Estados de carregamento e erro internos do Painel.jsx
    const [loading, setLoading] = useState(true); // Controla o spinner do Painel.jsx
    const [error, setError] = useState('');
    // Estado para controle de notificações
    const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
        return localStorage.getItem('notificationsEnabled') === 'true';
    });
    const prevRecebidos = useRef([]); // Ref para controlar pedidos recebidos anteriormente (para notificação)
    const [audioBlockedMsg, setAudioBlockedMsg] = useState(''); // Mensagem se o áudio for bloqueado

    // Inicializa o elemento de áudio ao montar o componente
    useEffect(() => {
        console.log("Painel.jsx Debug: [useEffect] Audio ref initialized.");
        audioRef.current = new Audio('/campainha.mp3');
        return () => {
            console.log("Painel.jsx Debug: [useEffect CLEANUP] Pausing audio on unmount.");
            audioRef.current && audioRef.current.pause(); // Pausa o áudio ao desmontar
        };
    }, []); // Array de dependências vazio para rodar apenas uma vez na montagem

    // useEffect principal: Autenticação, refresh do token e inicialização dos listeners de dados
    useEffect(() => {
        // Logando o estado inicial do useEffect
        console.log("Painel.jsx Debug: [useEffect START] - authLoading:", authLoading, "currentUser UID:", currentUser?.uid);
        console.log("Painel.jsx Debug: [useEffect START] - Painel's internal loading state:", loading);
        console.log("Painel.jsx Debug: [useEffect START] - AuthContext states (for comparison): Admin:", authContextIsAdmin, "MasterAdmin:", authContextIsMasterAdmin, "EstId:", authContextEstabelecimentoId, "EstAtivo:", authContextIsEstabelecimentoAtivo);

        // Se a autenticação do contexto ainda está carregando, esperamos.
        if (authLoading) {
            console.log("Painel.jsx Debug: authLoading is TRUE. Returning early from useEffect to wait for AuthContext.");
            return;
        }

        let unsub = []; // Array para armazenar funções de unsubscribe dos listeners do Firestore

        async function init() {
            console.log("Painel.jsx Debug: [init function START] - Attempting to initialize panel data.");
            console.log("Painel.jsx Debug: CurrentUser at init start:", currentUser?.uid);

            if (!currentUser) {
                console.log("Painel.jsx Debug: No currentUser after authLoading became FALSE. This is unexpected. Redirecting to login.");
                toast.error('Faça login para acessar esta página.');
                navigate('/');
                setLoading(false); // Garante que o spinner pare caso haja redirecionamento
                return;
            }

            try {
                // --- PASSO CRÍTICO: Força o refresh do token de ID para obter as custom claims ATUALIZADAS ---
                const idTokenResult = await currentUser.getIdTokenResult(true);
                console.log("Painel.jsx Debug: ID Token Result received. Checking claims...");
                console.log("Painel.jsx Debug: Claims from token:", idTokenResult.claims);

                // Extrai as claims diretamente do token atualizado
                const currentIsAdmin = idTokenResult.claims.isAdmin === true;
                const currentIsMasterAdmin = idTokenResult.claims.isMasterAdmin === true;
                const currentEstabelecimentoId = idTokenResult.claims.estabelecimentoId; 
                const currentIsEstabelecimentoAtivo = idTokenResult.claims.isEstabelecimentoAtivo === true; 

                console.log(`Painel.jsx Debug: Claims extracted for Painel logic: Admin: ${currentIsAdmin}, MasterAdmin: ${currentIsMasterAdmin}, EstabelecimentoId: ${currentEstabelecimentoId}, EstAtivo: ${currentIsEstabelecimentoAtivo}`);

                // --- Verificação de Permissões Detalhada após o refresh do token ---
                if (currentIsMasterAdmin) {
                    console.log("Painel.jsx Debug: User is Master Admin. Redirecting to Master Dashboard.");
                    toast.info('Redirecionando para o Dashboard Master.');
                    navigate('/master-dashboard');
                    setLoading(false); 
                    return;
                }

                if (!currentIsAdmin || !currentEstabelecimentoId || !currentIsEstabelecimentoAtivo) {
                    let msg = '';
                    if (!currentIsAdmin) {
                        msg = 'Acesso negado. Suas permissões não são de administrador de estabelecimento.';
                    } else if (!currentEstabelecimentoId) {
                        msg = 'Seu perfil de administrador está incompleto (ID do estabelecimento ausente nas claims).';
                    } else if (!currentIsEstabelecimentoAtivo) {
                        msg = 'Seu estabelecimento está inativo ou pendente de ativação. Contate o suporte.';
                    }
                    console.log(`Painel.jsx Debug: Permission check FAILED. Reason: ${msg}`);
                    toast.error(msg);
                    navigate('/'); 
                    setLoading(false); 
                    return;
                }

                console.log(`Painel.jsx Debug: User ${currentUser.email} is a valid Admin for Estabelecimento ID: ${currentEstabelecimentoId}. Proceeding to load establishment and order data.`);

                // 1. Busca as informações do estabelecimento associado ao admin logado
                const estDocRef = doc(db, 'estabelecimentos', currentEstabelecimentoId);
                const estSnap = await getDoc(estDocRef); 

                if (!estSnap.exists()) {
                    console.error("Painel.jsx Debug: Estabelecimento NOT FOUND in Firestore with ID from claims:", currentEstabelecimentoId);
                    throw new Error('Estabelecimento não encontrado no banco de dados para o ID de permissão. Contate o suporte.');
                }
                const estabelecimentoData = estSnap.data();
                setEstabelecimentoInfo(estabelecimentoData); 
                console.log("Painel.jsx Debug: Estabelecimento Info loaded:", estabelecimentoData.nome);

                // --- Funções de Query Base para Pedidos (com filtro de estabelecimentoId da claim) ---
                const baseQuery = (status) => (
                    query(
                        collection(db, 'pedidos'),
                        where('estabelecimentoId', '==', currentEstabelecimentoId), 
                        where('status', '==', status), 
                        orderBy('criadoEm', 'desc')
                    )
                );

                // Handler para novos pedidos recebidos (com notificação sonora e toast)
                function handleRecebidos(snap) {
                    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    const newOnes = list.filter(p => !prevRecebidos.current.find(o => o.id === p.id));
                    if (newOnes.length && notificationsEnabled) {
                        audioRef.current.play().catch((e) => {
                            console.warn("Painel.jsx Debug: Audio playback blocked:", e);
                            setAudioBlockedMsg('Som de notificação bloqueado pelo navegador. Clique para ativar.');
                        });
                        toast.info(`🔔 Novo pedido de ${newOnes[0].cliente.nome}: R$ ${newOnes[0].totalFinal.toFixed(2)}`);
                    }
                    prevRecebidos.current = list; 
                    setPedidos(prev => ({ ...prev, recebido: list })); 
                    console.log(`Painel.jsx Debug: Pedidos 'recebido' updated. Count: ${list.length}`);
                }

                // Inscrições em tempo real para cada status de pedido
                console.log("Painel.jsx Debug: Setting up Firestore listeners for orders...");
                unsub.push(onSnapshot(baseQuery('recebido'), handleRecebidos, (error) => {
                    console.error("Painel.jsx Debug: Erro no listener de pedidos 'recebido':", error);
                    setError('Erro ao carregar pedidos recebidos. Verifique suas permissões.');
                }));
                unsub.push(onSnapshot(baseQuery('preparo'), snap => {
                    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setPedidos(prev => ({ ...prev, preparo: list }));
                    console.log(`Painel.jsx Debug: Pedidos 'preparo' updated. Count: ${list.length}`);
                }, (error) => {
                    console.error("Painel.jsx Debug: Erro no listener de pedidos 'preparo':", error);
                    setError('Erro ao carregar pedidos em preparo. Verifique suas permissões.');
                }));
                // >>>>> JÁ CORRIGIDO AQUI: BUSCANDO POR 'em_entrega' <<<<<
                unsub.push(onSnapshot(baseQuery('em_entrega'), snap => { 
                    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setPedidos(prev => ({ ...prev, entrega: list })); // Atualiza a chave 'entrega' no estado 'pedidos'
                    console.log(`Painel.jsx Debug: Pedidos 'em_entrega' updated. Count: ${list.length}`); 
                }, (error) => {
                    console.error("Painel.jsx Debug: Erro no listener de pedidos 'em_entrega':", error);
                    setError('Erro ao carregar pedidos em entrega. Verifique suas permissões.');
                }));
                unsub.push(onSnapshot(baseQuery('finalizado'), snap => {
                    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setPedidos(prev => ({ ...prev, finalizado: list }));
                    console.log(`Painel.jsx Debug: Pedidos 'finalizado' updated. Count: ${list.length}`);
                }, (error) => {
                    console.error("Painel.jsx Debug: Erro no listener de pedidos 'finalizado':", error);
                    setError('Erro ao carregar pedidos finalizados. Verifique suas permissões.');
                }));

                setLoading(false); 
                console.log("Painel.jsx Debug: [init function END] - setLoading(false) called. Panel should now display content.");

            } catch (e) {
                console.error("Painel.jsx Debug: [init function ERROR] - Erro durante a inicialização/carregamento de dados:", e);
                setError('Falha ao carregar o painel. Por favor, recarregue a página.'); 
                toast.error(`Erro: ${e.message || 'Falha ao carregar painel.'}`);
                setLoading(false); 
                if (e.code && e.code.startsWith('auth/')) {
                    console.log("Painel.jsx Debug: Authentication error detected, forcing logout.");
                    logout(); 
                    navigate('/'); 
                }
            }
        }

        init();

        return () => {
            console.log("Painel.jsx Debug: [useEffect CLEANUP] - Unsubscribing from Firestore listeners.");
            unsub.forEach(fn => fn());
        };
    }, [
        authLoading, 
        currentUser, 
        navigate, 
        notificationsEnabled, 
        logout,
        authContextIsAdmin,
        authContextIsMasterAdmin,
        authContextEstabelecimentoId,
        authContextIsEstabelecimentoAtivo
    ]); 

    // Toggle de notificações
    const toggleNotifications = () => {
        console.log("Painel.jsx Debug: Toggling notifications. Current state:", notificationsEnabled);
        const enable = !notificationsEnabled;
        setNotificationsEnabled(enable);
        localStorage.setItem('notificationsEnabled', enable.toString()); 
        toast.info(enable ? 'Notificações ativas' : 'Notificações desativadas');
        if (!enable) {
            console.log("Painel.jsx Debug: Notifications disabled, pausing audio.");
            audioRef.current && audioRef.current.pause(); 
        }
    };

    // Função para deletar pedido
    const handleDelete = async (id) => {
        console.log("Painel.jsx Debug: Attempting to delete order ID:", id);
        if (!window.confirm('Tem certeza que deseja EXCLUIR este pedido permanentemente?')) {
            console.log("Painel.jsx Debug: Delete cancelled by user.");
            return;
        }
        try {
            await deleteDoc(doc(db, 'pedidos', id)); 
            toast.success('Pedido excluído com sucesso!'); 
            console.log("Painel.jsx Debug: Order deleted successfully.");
        } catch (error) {
            console.error("Painel.jsx Debug: Error deleting order:", error); 
            toast.error('Erro ao excluir pedido.'); 
        }
    };

    // Logs de renderização para ver o estado dos loadings
    console.log("Painel.jsx Debug: [RENDER] - Painel's internal loading:", loading, "AuthContext loading (authLoading):", authLoading);

    // Renderiza Spinner enquanto o 'loading' interno do Painel está TRUE
    if (loading) {
        console.log("Painel.jsx Debug: [RENDER] - Displaying Spinner. Current internal loading:", loading);
        return <Spinner />;
    }
    // Renderiza mensagem de erro se houver
    if (error) {
        console.log("Painel.jsx Debug: [RENDER] - Displaying Error message. Error:", error);
        return (
            <div className="p-6 bg-red-100 text-red-700 rounded-lg">
                <p className="font-bold">Erro:</p>
                <p>{error}</p>
            </div>
        );
    }

    // Renderiza o layout do painel (apenas se 'loading' for FALSE e não houver 'error')
    console.log("Painel.jsx Debug: [RENDER] - Panel content should now be visible.");
    return (
        <div className="p-6 bg-gray-50 min-h-screen"> {/* Fundo principal levemente cinza */}
            <header className="fixed top-0 left-0 right-0 z-20 p-6 flex justify-between items-center bg-white shadow-sm border-b border-gray-100">
                <div className="font-extrabold text-2xl text-black cursor-pointer hover:text-gray-800 transition-colors duration-300" onClick={() => navigate('/')}>
                    DEU FOME <span className="text-yellow-500">.</span>
                </div>
                <div className="flex items-center space-x-4">
                    <span className="text-black text-md font-medium">Olá, {currentUser?.email?.split('@')[0]}!</span>
                    <Link to="/painel" className="px-4 py-2 rounded-full text-black bg-yellow-500 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-yellow-600 hover:shadow-md">
                        Painel de Pedidos
                    </Link>
                    <Link to={estabelecimentoInfo?.cardapioSlug ? `/cardapio/${estabelecimentoInfo.cardapioSlug}` : '#'} className="px-4 py-2 rounded-full text-black border border-gray-300 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-gray-100 hover:border-gray-400">
                        Cardápios
                    </Link>
                    <button
                        onClick={() => { logout(); navigate('/'); }}
                        className="px-4 py-2 rounded-full text-black border border-gray-300 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-gray-100 hover:border-gray-400"
                    >
                        Sair
                    </button>
                </div>
            </header>

            <div className="max-w-6xl mx-auto pt-24"> {/* Ajuste o padding-top para não ficar por baixo do header fixo */}
                <div className="flex flex-col sm:flex-row items-center justify-between mb-8">
                    <Link to="/dashboard" className="text-secondary hover:text-primary font-medium">
                        &larr; Voltar
                    </Link>
                    <h1 className="text-3xl font-heading text-secondary text-center">
                        Painel ({estabelecimentoInfo?.nome || 'Carregando...'}) {/* Exibe o nome do estabelecimento dinamicamente */}
                    </h1>
                    <button
                        onClick={toggleNotifications}
                        className={`px-4 py-2 rounded-lg font-semibold transition ${notificationsEnabled ? 'bg-primary text-accent' : 'bg-gray-300 text-secondary'}`}
                    >
                        {notificationsEnabled ? '🔔 On' : '🔕 Off'}
                    </button>
                </div>

                {audioBlockedMsg && (
                    <div className="mb-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded">
                        {audioBlockedMsg} <button onClick={() => audioRef.current && audioRef.current.play().catch(() => {})} className="underline">Tentar</button>
                    </div>
                )}

                {/* Layout das colunas de status dos pedidos */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    {['recebido', 'preparo', 'em_entrega', 'finalizado'].map(status => {
                        return ( 
                            <div key={status} className="bg-white rounded-lg shadow p-4 border">
                                <h2 className="text-xl font-heading mb-2 capitalize">{status.replace('_', ' ')}</h2> {/* Para exibir 'em entrega' */}
                                <div className="space-y-4 max-h-[70vh] overflow-auto pr-2">
                                    {pedidos[status]?.length === 0 ? ( /* Adicionado '?' para segurança */
                                        <p className="text-secondary italic text-center py-4">Nenhum pedido.</p>
                                    ) : pedidos[status]?.map(ped => ( /* Adicionado '?' para segurança */
                                        <PedidoCard
                                            key={ped.id}
                                            pedido={ped}
                                            estabelecimento={estabelecimentoInfo} // Passa as informações do estabelecimento
                                            autoPrintEnabled={true} // Se a impressão automática estiver ativa
                                            onDeletePedido={handleDelete} // Função de delete
                                        />
                                    ))}
                                </div>
                            </div>
                        ); 
                    })}
                </div>
            </div>
            <footer className="w-full py-4 text-center text-xs text-gray-500 mt-8">
                &copy; 2025 DeuFome. Todos os direitos reservados.
            </footer>
        </div>
    );
}