import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { format, formatDistanceToNow, isValid } from 'date-fns';
import { ptBR }  from 'date-fns/locale';

function Painel() {
  const navigate = useNavigate();
  const { currentUser, isAdmin, loading: authLoading } = useAuth();

  const [pedidosRecebidos, setPedidosRecebidos] = useState([]);
  const [pedidosEmPreparo, setPedidosEmPreparo] = useState(new Map());
  const [pedidosEmEntrega, setPedidosEmEntrega] = useState(new Map());
  const [pedidosFinalizados, setPedidosFinalizados] = useState(new Map());

  const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
  const [loadingPainel, setLoadingPainel] = useState(true);
  const [painelError, setPainelError] = useState('');
  
  // Inicializa notificationsEnabled a partir do localStorage
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const stored = localStorage.getItem('notificationsEnabled');
    return stored === 'true' ? true : false;
  });

  const prevPedidosRecebidosRef = useRef([]);
  const audioRef = useRef(null); 
  const [audioBlockedMessage, setAudioBlockedMessage] = useState(''); 

  // Inicializa o objeto Audio UMA VEZ quando o componente monta
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

  // Efeito para solicitar permissão de notificação ao carregar a página (se a preferência estiver ativada)
  useEffect(() => {
    if (notificationsEnabled) {
      if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            console.log("Painel Audio Debug: Permissão de notificação concedida ao carregar a página.");
          } else {
            console.warn("Painel Audio Debug: Permissão de notificação negada ao carregar a página.");
          }
        });
      } else if (!('Notification' in window)) {
        console.warn("Painel Audio Debug: API de Notificação de Desktop não suportada neste navegador ao carregar.");
      }
    }
  }, [notificationsEnabled]);


  // Efeito para redirecionar se não for admin
  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isAdmin) {
        alert('Acesso negado. Você precisa ser um administrador para acessar esta página.');
        navigate('/');
      }
    }
  }, [currentUser, isAdmin, authLoading, navigate]);

  // Efeito para carregar informações do estabelecimento e pedidos
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
          const estabelecimentosRef = collection(db, 'estabelecimentos');
          const qEstabelecimento = query(estabelecimentosRef, where('adminUID', '==', currentUser.uid));
          const querySnapshotEstabelecimento = await getDocs(qEstabelecimento);

          if (!querySnapshotEstabelecimento.empty) {
            const estDoc = querySnapshotEstabelecimento.docs[0];
            setEstabelecimentoInfo({ id: estDoc.id, ...estDoc.data() });
            const realEstabelecimentoId = estDoc.id;

            const pedidosCollectionRef = collection(db, 'pedidos');

            const createPedidoQuery = (status) => query(
              pedidosCollectionRef,
              where('status', '==', status),
              where('estabelecimentoId', '==', realEstabelecimentoId),
              orderBy('criadoEm', 'desc')
            );

            // Listener para Pedidos Recebidos (com lógica de notificação)
            unsubscribeRecebidos = onSnapshot(createPedidoQuery('recebido'), (snapshot) => {
              const newPedidos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
              
              const oldPedidosIds = new Set(prevPedidosRecebidosRef.current.map(p => p.id));
              const newlyReceivedOrders = newPedidos.filter(p => !oldPedidosIds.has(p.id));

              console.log("Notif Debug: ----- START SNAPSHOT UPDATE -----");
              console.log("Notif Debug: newPedidos (IDs do snapshot atual):", newPedidos.map(p => p.id));
              console.log("Notif Debug: prevPedidosRecebidosRef.current (IDs do estado anterior):", prevPedidosRecebidosRef.current.map(p => p.id));
              console.log("Notif Debug: newlyReceivedOrders (IDs de pedidos REALMENTE NOVOS):", newlyReceivedOrders.map(p => p.id));
              console.log("Notif Debug: newlyReceivedOrders.length:", newlyReceivedOrders.length);
              console.log("Notif Debug: notificationsEnabled state:", notificationsEnabled);
              console.log("Notif Debug: Notification.permission:", Notification.permission);

              if (newlyReceivedOrders.length > 0) {
                console.log("Notif Debug: --- ACIONANDO NOTIFICAÇÃO ---");
                if (notificationsEnabled && Notification.permission === 'granted') {
                  newlyReceivedOrders.forEach(pedido => {
                    new Notification(`Novo Pedido - ${pedido.cliente.nome}`, {
                      body: `Total: R$ ${pedido.totalFinal.toFixed(2).replace('.', ',')}\nItens: ${pedido.itens.map(i => i.nome).join(', ')}`,
                      icon: '/logo-deufome.png'
                    });
                  });
                  
                  if (audioRef.current) {
                    console.log("Notif Debug: audioRef.current existe. readyState:", audioRef.current.readyState, "paused:", audioRef.current.paused);
                    audioRef.current.currentTime = 0; 
                    audioRef.current.play().then(() => {
                        console.log("Notif Debug: Áudio tocado com SUCESSO para novo pedido!");
                        setAudioBlockedMessage(''); 
                    }).catch(e => {
                      console.error("Notif Debug: ERRO: Áudio bloqueado para novo pedido (promessa rejeitada):", e);
                      if (e.name === "NotAllowedError" || e.name === "AbortError") {
                        setAudioBlockedMessage("Som de notificação bloqueado. Clique no banner acima para ativá-lo!"); // Define a mensagem
                      }
                    });
                  } else {
                      console.warn("Notif Debug: audioRef.current é null ao tentar tocar para novo pedido.");
                  }
                } else {
                    console.log("Notif Debug: Notificações não disparadas. Condições (notificationsEnabled, permissão) não atendidas.");
                }
              } else {
                  console.log("Notif Debug: Nenhum pedido VERDADEIRAMENTE novo detectado para notificação.");
              }
              setPedidosRecebidos(newPedidos); // Atualiza o estado PRINCIPAL do componente
              prevPedidosRecebidosRef.current = newPedidos; // Atualiza a referência para a PRÓXIMA comparação

              console.log("Notif Debug: ----- FIM ATUALIZAÇÃO SNAPSHOT -----");

            }, (error) => console.error("Erro no listener de Recebidos:", error));

            unsubscribeEmPreparo = onSnapshot(createPedidoQuery('em_preparo'), (snapshot) => {
              setPedidosEmPreparo(new Map(snapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }])));
            }, (error) => console.error("Erro no listener de Em Preparo:", error));

            unsubscribeEmEntrega = onSnapshot(createPedidoQuery('em_entrega'), (snapshot) => {
              setPedidosEmEntrega(new Map(snapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }])));
            }, (error) => console.error("Erro no listener de Em Entrega:", error));

            unsubscribeFinalizados = onSnapshot(createPedidoQuery('finalizado'), (snapshot) => {
              setPedidosFinalizados(new Map(snapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }])));
            }, (error) => console.error("Erro no listener de Finalizados:", error));

          } else {
            setPainelError("Nenhum estabelecimento vinculado a este administrador.");
            setEstabelecimentoInfo(null);
            setPedidosRecebidos([]);
            setPedidosEmPreparo(new Map());
            setPedidosEmEntrega(new Map());
            setPedidosFinalizados(new Map());
          }
        } catch (error) {
          console.error("Painel Audio Debug: Erro ao carregar painel de pedidos (fetchEstabelecimentoAndPedidos):", error);
          setPainelError("Erro ao carregar o painel. Verifique os índices do Firestore e a conexão.");
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
    } else if (authLoading === false && (!currentUser || !isAdmin)) {
      setLoadingPainel(false);
    }
  }, [currentUser, isAdmin, authLoading, notificationsEnabled]);


  const toggleNotifications = async () => {
    // Se as notificações já estão ativadas, este clique as desativa
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      localStorage.setItem('notificationsEnabled', 'false'); // Salva a preferência
      console.log('Painel Audio Debug: Notificações desativadas.');
      if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
      }
      setAudioBlockedMessage(''); // Garante que a mensagem de bloqueio seja limpa ao desativar
      return;
    }

    // Se as notificações estão desativadas, este clique tenta ativá-las
    let permissionRequested = false;
    let permissionGranted = false;

    if ('Notification' in window) {
        permissionRequested = true;
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            permissionGranted = true;
        }
    } else {
        console.warn('Painel Audio Debug: API de Notificação de Desktop não suportada neste navegador.');
    }
    
    setNotificationsEnabled(true); // Ativa o estado de notificações
    localStorage.setItem('notificationsEnabled', 'true'); // Salva a preferência
    
    console.log("Painel Audio Debug: Tentando tocar áudio no toggle (interação do usuário).");

    // Tenta tocar o som. Se conseguir, limpa a mensagem de bloqueio.
    // Se falhar (autoplay policy), define a mensagem de bloqueio.
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => {
        console.log("Painel Audio Debug: Áudio tocado com SUCESSO no toggle (interação do usuário).");
        setAudioBlockedMessage(''); // Limpa a mensagem se o áudio tocou com sucesso
      }).catch(e => {
        console.warn("Painel Audio Debug: Áudio pode ter sido bloqueado na primeira reprodução após permissão:", e);
        if (e.name === "NotAllowedError" || e.name === "AbortError") {
          setAudioBlockedMessage("Som de notificação bloqueado. Clique para reativar!"); // Define a mensagem para o botão
        }
      });
    } else {
        console.warn("Painel Audio Debug: audioRef.current é null quando tentou tocar no toggle.");
        setAudioBlockedMessage("Som de notificação bloqueado (erro de inicialização)."); // Mensagem de erro genérica
    }

    // Alertas de feedback para o usuário (agora usando console.log para serem menos intrusivos)
    if (permissionRequested) {
        if (permissionGranted) {
            console.log('Painel Audio Debug: Notificações ativadas (incluindo pop-ups)!');
        } else {
            console.log('Painel Audio Debug: Notificações ativadas (apenas som e alertas internos, pop-ups bloqueados)!');
        }
    } else {
        console.log('Painel Audio Debug: Notificações ativadas (apenas som e alertas internos, pop-ups não suportados)!');
    }
  };

  const updateOrderStatus = async (pedidoId, newStatus) => {
    try {
      const pedidoRef = doc(db, 'pedidos', pedidoId);
      await updateDoc(pedidoRef, { status: newStatus });
      alert(`Status do pedido ${pedidoId.substring(0, 5)}... atualizado para ${newStatus.replace('_', ' ')}.`);
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      alert('Erro ao atualizar status do pedido.');
    }
  };

  const deletePedido = async (pedidoId) => {
    if (window.confirm('Tem certeza que deseja excluir este pedido? Esta ação é irreversível.')) {
      try {
        const pedidoRef = doc(db, 'pedidos', pedidoId);
        await deleteDoc(pedidoRef);
        alert('Pedido excluído com sucesso!');
      } catch (error) {
        console.error("Erro ao excluir pedido:", error);
        alert('Erro ao excluir pedido.');
      }
    }
  };

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

  // Componente auxiliar para renderizar um cartão de pedido
  const PedidoCard = ({ pedido, onUpdateStatus, onDelete }) => {
    const criadoEmDate = pedido.criadoEm && typeof pedido.criadoEm.toDate === 'function' 
                         ? pedido.criadoEm.toDate() 
                         : null;
    
    let timeAgo = '';
    if (criadoEmDate && isValid(criadoEmDate)) {
      timeAgo = formatDistanceToNow(criadoEmDate, { addSuffix: true, locale: ptBR });
    }

    const isOldReceived = pedido.status === 'recebido' && 
                          criadoEmDate && 
                          isValid(criadoEmDate) && 
                          (new Date().getTime() - criadoEmDate.getTime()) > (15 * 60 * 1000); // 15 minutos em ms

    // Define o ícone com base no status
    const getStatusIcon = (status) => {
      switch (status) {
        case 'recebido': return '🆕';
        case 'em_preparo': return '🧑‍🍳';
        case 'em_entrega': return '🛵';
        case 'finalizado': return '✅';
        default: return '❓';
      }
    };

    const telefoneLimpo = pedido.cliente.telefone ? pedido.cliente.telefone.replace(/\D/g, '') : '';
    const telefoneWhatsApp = telefoneLimpo.startsWith('55') ? telefoneLimpo : `55${telefoneLimpo}`;

    return (
      <div className={`bg-white p-4 rounded-lg shadow mb-4 border ${isOldReceived ? 'border-orange-500 ring-2 ring-orange-400' : 'border-gray-200'}`}>
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-gray-800">{pedido.cliente.nome}</h3>
          {criadoEmDate && isValid(criadoEmDate) ? (
            <span className="text-sm text-gray-500">
              {format(criadoEmDate, 'dd/MM/yyyy HH:mm')}
            </span>
          ) : (
            <span className="text-sm text-gray-500">Data Indisponível</span>
          )}
        </div>
        
        {timeAgo && (
          <p className="text-xs text-gray-500 mb-2">
            Chegou: <span className={`${isOldReceived ? 'text-orange-600 font-bold' : ''}`}>{timeAgo}</span>
          </p>
        )}

        <p className="text-lg font-bold text-gray-900 mb-3">
          Total: R$ {pedido.totalFinal !== undefined && pedido.totalFinal !== null ? 
                    pedido.totalFinal.toFixed(2).replace('.', ',') : 
                    'N/A'}
        </p>
        <ul className="list-disc list-inside text-gray-700 text-sm mb-2">
          {pedido.itens && pedido.itens.length > 0 ? (
            pedido.itens.map((item, index) => (
              <li key={index}>
                {item.nome} - {item.quantidade}
                {item.preco !== undefined && item.preco !== null ? 
                 ` - R$ ${item.preco.toFixed(2).replace('.', ',')}` : ''}
              </li>
            ))
          ) : (
            <li>Nenhum item listado.</li>
          )}
        </ul>
        <p className="text-sm text-gray-600 mb-1">
            Status: <span className="font-medium capitalize">{getStatusIcon(pedido.status)} {pedido.status ? pedido.status.replace('_', ' ') : 'Desconhecido'}</span>
        </p>
        
        <div className="flex flex-wrap gap-2 mt-3">
          {/* Botão Comanda - Sempre visível */}
          <button
            onClick={() => navigate(`/comanda/${pedido.id}`)}
            className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm flex items-center"
          >
            📋 Comanda
          </button>

          {/* Botões para status 'recebido' */}
          {pedido.status === 'recebido' && (
            <>
              <button
                onClick={() => onUpdateStatus(pedido.id, 'em_preparo')}
                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm flex items-center"
              >
                🧑‍🍳 Em Preparo
              </button>
              {pedido.formaPagamento === 'pix' && ( // 'pix' em minúsculas
                <a
                  href={`https://wa.me/${telefoneWhatsApp}?text=${encodeURIComponent(
                    `Olá ${pedido.cliente.nome}, seu pedido do ${estabelecimentoInfo?.nome || 'nosso estabelecimento'} foi recebido e a forma de pagamento é PIX! Por favor, use a chave PIX: ${estabelecimentoInfo?.chavePix || 'Chave PIX não informada'}. Acompanhe seu pedido pelo app. Agradecemos a preferência!`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm flex items-center"
                >
                  🔑 Enviar PIX WhatsApp
                </a>
              )}
              <button
                onClick={() => onDelete(pedido.id)}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm flex items-center"
              >
                🗑️ Excluir
              </button>
            </>
          )}

          {/* Botões para status 'em_preparo' */}
          {pedido.status === 'em_preparo' && (
            <>
              <button
                onClick={() => onUpdateStatus(pedido.id, 'em_entrega')}
                className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-sm flex items-center"
              >
                🛵 Entregar
              </button>
              <button
                onClick={() => onUpdateStatus(pedido.id, 'finalizado')}
                className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm flex items-center"
              >
                ✅ Finalizar
              </button>
            </>
          )}

          {/* Botões para status 'em_entrega' */}
          {pedido.status === 'em_entrega' && (
            <button
              onClick={() => onUpdateStatus(pedido.id, 'finalizado')}
              className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm flex items-center"
            >
              ✅ Finalizar
            </button>
          )}
        </div>
      </div>
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
          <h1 className="text-3xl font-bold text-gray-800">Painel de Pedidos {estabelecimentoInfo ? `(${estabelecimentoInfo.nome})` : ''}</h1>
          <div className="flex gap-2">
            {/* BOTÃO CONSOLIDADO DE NOTIFICAÇÕES */}
            <button 
                onClick={toggleNotifications}
                // Classes condicionais para o botão
                className={`px-4 py-2 rounded-lg font-semibold transition duration-300
                    ${notificationsEnabled && !audioBlockedMessage 
                       ? 'bg-green-500 hover:bg-green-600 text-white' // Ativo e funcionando
                       : notificationsEnabled && audioBlockedMessage 
                         ? 'bg-yellow-500 hover:bg-yellow-600 text-black animate-pulse' // Ativo, mas com áudio bloqueado
                         : 'bg-gray-300 hover:bg-gray-400 text-gray-800' // Desativado
                    }`}
            >
                {notificationsEnabled && !audioBlockedMessage ? '🔔 Notificações Ativadas' :
                 notificationsEnabled && audioBlockedMessage ? '⚠️ Som Bloqueado! Ativar?' :
                 '🔕 Notificações Desativadas'}
            </button>
            <button className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg">Filtrar por Período Específico</button>
          </div>
        </div>

        {/* REMOVIDO: O banner de mensagem de áudio bloqueado - a mensagem e a ação agora vão para o botão */}
        {/* {audioBlockedMessage && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
            <p className="font-bold">Atenção!</p>
            <p>{audioBlockedMessage} <button onClick={() => { if(audioRef.current) audioRef.current.play().catch(() => {}); setAudioBlockedMessage(''); }} className="underline font-semibold">Tocar agora</button></p>
          </div>
        )} */}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Coluna de Pedidos Recebidos */}
          <div>
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b-2 text-red-600 border-red-300">🆕 Recebido ({pedidosRecebidos.length})</h2>
            {pedidosRecebidos.length === 0 ? (
              <p className="text-gray-500 italic">Nenhum pedido nesta coluna.</p>
            ) : (
              pedidosRecebidos.map(pedido => (
                <PedidoCard
                  key={pedido.id}
                  pedido={pedido}
                  onUpdateStatus={updateOrderStatus}
                  onDelete={deletePedido}
                />
              ))
            )}
          </div>

          {/* Coluna de Pedidos Em Preparo */}
          <div>
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b-2 text-blue-600 border-blue-300">🧑‍🍳 Em Preparo ({pedidosEmPreparo.size})</h2>
            {[...pedidosEmPreparo.values()].length === 0 ? (
              <p className="text-gray-500 italic">Nenhum pedido nesta coluna.</p>
            ) : (
              [...pedidosEmPreparo.values()].map(pedido => (
                <PedidoCard
                  key={pedido.id}
                  pedido={pedido}
                  onUpdateStatus={updateOrderStatus}
                  onDelete={deletePedido}
                />
              ))
            )}
          </div>

          {/* Coluna de Pedidos Em Entrega */}
          <div>
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b-2 text-orange-600 border-orange-300">🛵 Em Entrega ({pedidosEmEntrega.size})</h2>
            {[...pedidosEmEntrega.values()].length === 0 ? (
              <p className="text-gray-500 italic">Nenhum pedido nesta coluna.</p>
            ) : (
              [...pedidosEmEntrega.values()].map(pedido => (
                <PedidoCard
                  key={pedido.id}
                  pedido={pedido}
                  onUpdateStatus={updateOrderStatus}
                  onDelete={deletePedido}
                />
              ))
            )}
          </div>

          {/* Coluna de Pedidos Finalizados */}
          <div>
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b-2 text-green-600 border-green-300">✅ Finalizados ({pedidosFinalizados.size})</h2>
            {[...pedidosFinalizados.values()].length === 0 ? (
              <p className="text-gray-500 italic">Nenhum pedido nesta coluna.</p>
            ) : (
              [...pedidosFinalizados.values()].map(pedido => (
                <PedidoCard
                  key={pedido.id}
                  pedido={pedido}
                  onUpdateStatus={updateOrderStatus}
                  onDelete={deletePedido}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Painel;