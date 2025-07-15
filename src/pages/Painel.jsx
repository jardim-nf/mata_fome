import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { format, formatDistanceToNow, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const prevPedidosRecebidosRef = useRef([]);
  // Inicializa a ref para um objeto Audio. Corrigido para garantir que sempre crie um novo.
  const audioRef = useRef(null); 

  // Inicializa o objeto Audio UMA VEZ quando o componente monta
  useEffect(() => {
    audioRef.current = new Audio('/campainha.mp3'); 
    audioRef.current.load(); // Tenta carregar o áudio antecipadamente
  }, []);

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

              if (newlyReceivedOrders.length > 0) {
                // Tocar som e mostrar notificação APENAS se houver novos pedidos e notificações ativadas
                if (notificationsEnabled && Notification.permission === 'granted') {
                  newlyReceivedOrders.forEach(pedido => {
                    new Notification(`Novo Pedido - ${pedido.cliente.nome}`, {
                      body: `Total: R$ ${pedido.totalFinal.toFixed(2).replace('.', ',')}\nItens: ${pedido.itens.map(i => i.nome).join(', ')}`,
                      icon: '/logo-deufome.png' // Use o caminho para o logo do seu app
                    });
                  });
                  
                  if (audioRef.current) {
                    audioRef.current.currentTime = 0; // Reinicia o áudio para tocar se já estiver tocando
                    audioRef.current.play().catch(e => {
                      console.error("Erro ao tocar áudio (autoplay bloqueado?):", e);
                      // Uma notificação interna ou visual para o admin caso o áudio seja bloqueado
                      // alert("Som de notificação bloqueado pelo navegador. Por favor, clique na página para ativá-lo.");
                    });
                  }
                }
              }
              setPedidosRecebidos(newPedidos); // Atualiza o estado APÓS a lógica de notificação
              prevPedidosRecebidosRef.current = newPedidos; // Atualiza a ref para a próxima comparação

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
          console.error("Erro ao carregar painel de pedidos:", error);
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
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      alert('Notificações desativadas.');
      // Opcional: Se o áudio estiver tocando, pausar
      if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
      }
      return;
    }

    if (!('Notification' in window)) {
      alert('Este navegador não suporta notificações de desktop.');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotificationsEnabled(true);
      // Tentar tocar o som UMA VEZ após a ativação, para que o navegador "permita"
      // e "desbloqueie" o contexto de áudio para futuras notificações automáticas.
      if (audioRef.current) {
        audioRef.current.currentTime = 0; // Garante que comece do início
        audioRef.current.play().catch(e => {
            console.warn("Áudio pode ter sido bloqueado na primeira reprodução após permissão (autoplay policy):", e);
            alert("O navegador pode ter bloqueado o som. Por favor, interaja com a página (clicando em algo) para ativá-lo.");
        });
      }
      alert('Notificações ativadas com sucesso!');
    } else {
      alert('Permissão de notificação negada. Não será possível receber alertas.');
      setNotificationsEnabled(false);
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
            <button 
                onClick={toggleNotifications}
                className={`${notificationsEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-300 text-gray-800 hover:bg-gray-400'} text-white px-4 py-2 rounded-lg`}>
                {notificationsEnabled ? '🔔 Notificações Ativadas' : '🔕 Notificações Desativadas'}
            </button>
            <button className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg">Filtrar por Período Específico</button>
          </div>
        </div>

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