// src/pages/Painel.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../firebase'; // Linha corrigida aqui: de '=>' para 'from'
import { useAuth } from '../context/AuthContext';
import { format, formatDistanceToNow, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';
import PedidoCard from '../components/PedidoCard';

function Painel() {
  const navigate = useNavigate();
  const { currentUser, isAdmin, isMasterAdmin, isEstabelecimentoAtivo, loading: authLoading } = useAuth();
  const [actualEstabelecimentoId, setActualEstabelecimentoId] = useState(null);

  const [pedidosRecebidos, setPedidosRecebidos] = useState([]);
  const [pedidosEmPreparo, setPedidosEmPreparo] = useState([]);
  const [pedidosEmEntrega, setPedidosEmEntrega] = useState([]);
  const [pedidosFinalizados, setPedidosFinalizados] = useState([]);

  const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
  const [loadingPainel, setLoadingPainel] = useState(true);
  const [painelError, setPainelError] = useState('');

  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const stored = localStorage.getItem('notificationsEnabled');
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
      if (!currentUser || !isAdmin || isMasterAdmin || !isEstabelecimentoAtivo) {
        let errorMessage = 'Acesso negado.';
        if (!isEstabelecimentoAtivo && isAdmin && !isMasterAdmin) {
          errorMessage = 'Acesso bloqueado: O pagamento do estabelecimento está pendente ou o estabelecimento está inativo.';
        } else if (!isAdmin && currentUser) {
          errorMessage = 'Acesso negado. Você não tem permissões de administrador de estabelecimento.';
        } else if (!currentUser) {
          errorMessage = 'Acesso negado. Você precisa estar logado para acessar esta página.';
        } else if (isMasterAdmin) {
          errorMessage = 'Esta página é exclusiva para administradores de estabelecimento. Acesse seu Dashboard Master.';
        }

        toast.error(errorMessage);

        if (isMasterAdmin) {
          navigate('/master-dashboard');
        } else {
          navigate('/');
        }
        setLoadingPainel(false);
        return;
      }

      setLoadingPainel(true);
      setPainelError('');

      let unsubscribeRecebidos = () => {};
      let unsubscribeEmPreparo = () => {};
      let unsubscribeEmEntrega = () => {};
      let unsubscribeFinalizados = () => {};

      const fetchEstabelecimentoAndPedidos = async () => {
        try {
          const estabelecimentosRef = collection(db, 'estabelecimentos');
          const qEstabelecimento = query(estabelecimentosRef, where('adminUID', '==', currentUser.uid));
          const querySnapshotEstabelecimento = await getDocs(qEstabelecimento);

          if (!querySnapshotEstabelecimento.empty) {
            const estDoc = querySnapshotEstabelecimento.docs[0];
            const estabData = estDoc.data();
            const realEstabelecimentoId = estDoc.id;

            if (!estabData.ativo) {
              setPainelError("Estabelecimento inativo ou pagamento pendente. Contate o suporte.");
              setLoadingPainel(false);
              toast.error("Estabelecimento inativo ou pagamento pendente.");
              return;
            }

            setEstabelecimentoInfo(estabData);
            setActualEstabelecimentoId(realEstabelecimentoId);

            const pedidosCollectionRef = collection(db, 'pedidos');
            const createPedidoQuery = (status) => query(
              pedidosCollectionRef,
              where('estabelecimentoId', '==', realEstabelecimentoId),
              where('status', '==', status),
              orderBy('criadoEm', 'desc')
            );

            unsubscribeRecebidos = onSnapshot(createPedidoQuery('recebido'), (snapshot) => {
              const newPedidos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              const oldPedidosIds = new Set(prevPedidosRecebidosRef.current.map(p => p.id));
              const newlyReceivedOrders = newPedidos.filter(p => !oldPedidosIds.has(p.id));

              if (newlyReceivedOrders.length > 0) {
                if (notificationsEnabled) {
                  if (Notification.permission === 'granted') {
                    newlyReceivedOrders.forEach(pedido => {
                      new Notification(`Novo Pedido - ${pedido.cliente.nome}`, {
                        body: `Total: R$ ${pedido.totalFinal.toFixed(2).replace('.', ',')}\nItens: ${pedido.itens.map(i => i.nome).join(', ')}`,
                        icon: '/logo-deufome.png'
                      });
                    });
                  }

                  if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                    audioRef.current.play().catch(e => {
                      console.error("Erro ao tocar áudio (autoplay pode estar bloqueado):", e);
                      if (e.name === "NotAllowedError" || e.name === "AbortError") {
                        setAudioBlockedMessage("Som de notificação bloqueado. Clique no banner acima para ativá-lo!");
                      }
                    });
                  } else {
                    console.warn("audioRef.current é null ao tentar tocar áudio para novo pedido.");
                  }
                  toast.info(`🔔 Novo pedido recebido de ${newlyReceivedOrders[0].cliente.nome}! Total: R$ ${newlyReceivedOrders[0].totalFinal.toFixed(2).replace('.', ',')}`);
                } else {
                  console.log("Notificações desativadas pelo usuário.");
                  toast.info(`🔔 Novo pedido (notificações desativadas): ${newlyReceivedOrders[0].cliente.nome}`);
                }
              } else {
                console.log("Nenhum pedido VERDADEIRAMENTE novo detectado para notificação.");
              }
              setPedidosRecebidos(newPedidos);
              prevPedidosRecebidosRef.current = newPedidos;

            }, (error) => console.error("Erro no listener de Recebidos:", error));

            unsubscribeEmPreparo = onSnapshot(createPedidoQuery('preparo'), (snapshot) => {
              setPedidosEmPreparo(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }, (error) => console.error("Erro no listener de Em Preparo:", error));

            unsubscribeEmEntrega = onSnapshot(createPedidoQuery('em_entrega'), (snapshot) => {
              setPedidosEmEntrega(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }, (error) => console.error("Erro no listener de Em Entrega:", error));

            unsubscribeFinalizados = onSnapshot(createPedidoQuery('finalizado'), (snapshot) => {
              setPedidosFinalizados(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }, (error) => console.error("Erro no listener de Finalizados:", error));

          } else {
            setPainelError("Nenhum estabelecimento vinculado a este administrador.");
            toast.error("Nenhum estabelecimento encontrado para este administrador.");
            setEstabelecimentoInfo(null);
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

      return () => {
        unsubscribeRecebidos();
        unsubscribeEmPreparo();
        unsubscribeEmEntrega();
        unsubscribeFinalizados();
      };
    }
  }, [currentUser, isAdmin, isMasterAdmin, isEstabelecimentoAtivo, authLoading, navigate, notificationsEnabled]);

  const toggleNotifications = async () => {
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
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          permissionGranted = true;
        }
      } else if (Notification.permission === 'granted') {
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
        setAudioBlockedMessage('');
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


  if (authLoading || loadingPainel) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
        <p className="text-xl text-gray-700">Carregando painel de administração...</p>
      </div>
    );
  }

  if (!currentUser || !isAdmin || isMasterAdmin || !isEstabelecimentoAtivo) {
    return null;
  }

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
                audioBlockedMessage ? '⚠️ Som Bloqueado! Ativar?' :
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
          <div className="bg-white rounded-lg shadow-lg p-4 border border-gray-200">
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b-2 text-red-600 border-red-300 flex items-center gap-2">
              📦 Recebido ({pedidosRecebidos.length})
            </h2>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {pedidosRecebidos.length === 0 ? (
                <p className="text-gray-500 italic text-center py-4">Nenhum pedido nesta coluna.</p>
              ) : (
                pedidosRecebidos.map(pedido => (
                  <PedidoCard
                    key={pedido.id}
                    pedido={pedido}
                    estabelecimento={estabelecimentoInfo}
                    autoPrintEnabled={false}
                  />
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-4 border border-yellow-300">
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b-2 text-blue-600 border-blue-300 flex items-center gap-2">
              🧑‍🍳 Em Preparo ({pedidosEmPreparo.length})
            </h2>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {pedidosEmPreparo.length === 0 ? (
                <p className="text-gray-500 italic text-center py-4">Nenhum pedido nesta coluna.</p>
              ) : (
                pedidosEmPreparo.map(pedido => (
                  <PedidoCard
                    key={pedido.id}
                    pedido={pedido}
                    estabelecimento={estabelecimentoInfo}
                    autoPrintEnabled={false}
                  />
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-4 border border-orange-300">
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b-2 text-orange-600 border-orange-300 flex items-center gap-2">
              🛵 Em Entrega ({pedidosEmEntrega.length})
            </h2>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {pedidosEmEntrega.length === 0 ? (
                <p className="text-gray-500 italic text-center py-4">Nenhum pedido nesta coluna.</p>
              ) : (
                pedidosEmEntrega.map(pedido => (
                  <PedidoCard
                    key={pedido.id}
                    pedido={pedido}
                    estabelecimento={estabelecimentoInfo}
                    autoPrintEnabled={false}
                  />
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-4 border border-green-300">
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b-2 text-green-600 border-green-300 flex items-center gap-2">
              ✅ Finalizados ({pedidosFinalizados.length})
            </h2>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {pedidosFinalizados.length === 0 ? (
                <p className="text-gray-500 italic text-center py-4">Nenhum pedido nesta coluna.</p>
              ) : (
                pedidosFinalizados.map(pedido => (
                  <PedidoCard
                    key={pedido.id}
                    pedido={pedido}
                    estabelecimento={estabelecimentoInfo}
                    autoPrintEnabled={false}
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