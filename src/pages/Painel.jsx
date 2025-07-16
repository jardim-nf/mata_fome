// src/pages/Painel.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { format, formatDistanceToNow, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify'; // Importe o toast aqui!

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

  // Efeito para redirecionar se não for admin
  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isAdmin) {
        toast.error('Acesso negado. Você precisa ser um administrador para acessar esta página.'); // Substituição do alert()
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
                // Adicione um toast para novos pedidos, mesmo se a notificação nativa não for disparada
                toast.info(`🔔 Novo pedido recebido de ${newlyReceivedOrders[0].cliente.nome}! Total: R$ ${newlyReceivedOrders[0].totalFinal.toFixed(2).replace('.', ',')}`);
              } else {
                  console.log("Nenhum pedido VERDADEIRAMENTE novo detectado para notificação.");
              }
              setPedidosRecebidos(newPedidos); 
              prevPedidosRecebidosRef.current = newPedidos;

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
            toast.error("Nenhum estabelecimento encontrado para este administrador."); // Adicionado toast de erro
            setEstabelecimentoInfo(null);
            setPedidosRecebidos([]);
            setPedidosEmPreparo(new Map());
            setPedidosEmEntrega(new Map());
            setPedidosFinalizados(new Map());
          }
        } catch (error) {
          console.error("Erro ao carregar painel de pedidos:", error);
          setPainelError("Erro ao carregar o painel. Verifique os índices do Firestore e a conexão.");
          toast.error("Erro ao carregar o painel. Verifique os índices do Firestore e a conexão."); // Adicionado toast de erro
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

  // NOVO: Função auxiliar para obter um pedido pelo ID (agora usa o Map)
  const getPedidoById = (id) => {
    // Procura o pedido em cada Map (Em Preparo, Em Entrega, Finalizados) ou no array de Recebidos
    // A ordem de busca pode ser ajustada conforme a performance desejada ou probabilidade de encontrar o pedido
    let pedido = pedidosRecebidos.find(p => p.id === id);
    if (!pedido) pedido = pedidosEmPreparo.get(id);
    if (!pedido) pedido = pedidosEmEntrega.get(id);
    if (!pedido) pedido = pedidosFinalizados.get(id);
    return pedido;
  };

const updateOrderStatus = async (pedidoId, newStatus) => {
    const pedidoToUpdate = getPedidoById(pedidoId);
    if (!pedidoToUpdate) {
      toast.error("Erro: Pedido não encontrado para atualização de status."); // Substituição do alert()
      return;
    }

    const telefoneCliente = pedidoToUpdate.cliente?.telefone || '';
    const nomeCliente = pedidoToUpdate.cliente?.nome || '';
    const estabelecimentoNome = estabelecimentoInfo?.nome || 'nosso estabelecimento';
    const totalPedido = pedidoToUpdate.totalFinal?.toFixed(2).replace('.', ',') || '0,00';
    const itensPedido = pedidoToUpdate.itens?.map(item => item.nome).join(', ') || ''; // Simplificado para a mensagem

    let mensagemWhatsApp = '';

    switch (newStatus) {
      case 'em_preparo':
        // Mensagem existente para "Em Preparo"
        mensagemWhatsApp = `Olá ${nomeCliente}, seu pedido #${pedidoId.substring(0, 5)} do ${estabelecimentoNome} está AGORA EM PREPARO! 🧑‍🍳\n\nItens: ${itensPedido}\nTotal: R$ ${totalPedido}\n\nFique atento às próximas atualizações. Agradecemos a preferência!`;
        toast.info(`Status do pedido ${pedidoId.substring(0, 5)} atualizado para EM PREPARO. Mensagem WhatsApp enviada.`);
        break;
      case 'em_entrega':
        // Nova mensagem para "Em Entrega"
        mensagemWhatsApp = `Que beleza, ${nomeCliente}! Seu pedido do ${estabelecimentoNome} saiu para entrega! 🛵💨 Jájá chega aí! Bom apetite!`;
        toast.info(`Status do pedido ${pedidoId.substring(0, 5)} atualizado para EM ENTREGA. Mensagem WhatsApp enviada.`);
        break;
      case 'finalizado':
        // Nova mensagem para "Finalizado"
        mensagemWhatsApp = `Muito obrigado, ${nomeCliente}! Seu pedido do ${estabelecimentoNome} foi finalizado com sucesso! ✅ Esperamos você em uma próxima!`;
        toast.success(`Status do pedido ${pedidoId.substring(0, 5)} atualizado para FINALIZADO. Mensagem WhatsApp enviada.`);
        break;
      default:
        // Caso um status desconhecido seja passado
        toast.warn(`Status desconhecido para atualização do pedido ${pedidoId.substring(0, 5)}.`);
        return; // Não prosseguir se o status não for tratado
    }

    const telefoneLimpo = telefoneCliente.replace(/\D/g, '');
    const telefoneWhatsApp = telefoneLimpo.startsWith('55') ? telefoneLimpo : `55${telefoneLimpo}`;

    const whatsappUrl = `https://wa.me/${telefoneWhatsApp}?text=${encodeURIComponent(mensagemWhatsApp)}`;

    try {
      const pedidoRef = doc(db, 'pedidos', pedidoId);
      await updateDoc(pedidoRef, { status: newStatus });

      // O toast já foi dado dentro do switch, mas se quiser um feedback geral, pode colocar aqui.
      // toast.success(`Status do pedido ${pedidoId.substring(0, 5)} atualizado para ${newStatus.replace('_', ' ')}.`); 

      window.open(whatsappUrl, '_blank');

    } catch (error) {
      console.error("Erro ao atualizar status ou enviar WhatsApp:", error);
      toast.error('Erro ao atualizar status do pedido ou enviar mensagem. Por favor, tente novamente.'); // Substituição do alert()
    }
  };

  const deletePedido = async (pedidoId) => {
    // window.confirm é mantido por ser uma ação destrutiva que precisa de confirmação
    if (window.confirm('Tem certeza que deseja excluir este pedido? Esta ação é irreversível.')) {
      try {
        const pedidoRef = doc(db, 'pedidos', pedidoId);
        await deleteDoc(pedidoRef);
        toast.success('Pedido excluído com sucesso!'); // Substituição do alert()
      } catch (error) {
        console.error("Erro ao excluir pedido:", error);
        toast.error('Erro ao excluir pedido.'); // Substituição do alert()
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
          {/* Transformar o nome do cliente em um Link com ícone e cor clara */}
          <Link to={`/admin/clientes/${pedido.cliente.userId}`} className="flex items-center text-blue-600 hover:text-blue-800 hover:underline">
            <span className="mr-1">👤</span>
            {pedido.cliente.nome}
          </Link>
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
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 text-center flex-grow">Painel de Pedidos {estabelecimentoInfo ? `(${estabelecimentoInfo.nome})` : ''}</h1>
          <div className="flex flex-wrap gap-2 justify-center sm:justify-end mt-4 sm:mt-0 w-full sm:w-auto"> {/* Adicionado flex-wrap e ajustes para mobile */}
            <button 
                onClick={toggleNotifications}
                className={`${notificationsEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-300 text-gray-800 hover:bg-gray-400'} text-white px-4 py-2 rounded-lg`}>
                {notificationsEnabled ? '🔔 Notificações Ativadas' :
                 notificationsEnabled && audioBlockedMessage ? '⚠️ Som Bloqueado! Ativar?' :
                 '🔕 Notificações Desativadas'}
            </button>
            <button className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg w-full sm:w-auto">Filtrar por Período Específico</button> {/* Adicionado w-full para mobile */}
          </div>
        </div>

        {/* NOVO: Banner de mensagem de áudio bloqueado (agora com a função no botão principal) */}
        {audioBlockedMessage && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
            <p className="font-bold">Atenção!</p>
            <p>{audioBlockedMessage} <button onClick={() => { if(audioRef.current) audioRef.current.play().catch(() => {}); setAudioBlockedMessage(''); }} className="underline font-semibold">Tocar agora</button></p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6"> {/* Ajustado os breakpoints para melhorar a largura dos cards em telas menores */}
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