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
  getDocs,
  // documentId // Adicione esta importação se você usar documentId para filtrar estabelecimentos
} from 'firebase/firestore';
import { db } from '../firebase'; // Sua instância do Firestore
import { useAuth } from '../context/AuthContext'; // Seu contexto de autenticação
import { toast } from 'react-toastify'; // Notificações toast
import { getAuth } from 'firebase/auth'; // <--- IMPORTANTE: Importa getAuth para forçar o refresh do token
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
    // isMasterAdmin, // <--- isMasterAdmin e isAdmin virão agora das claims atualizadas do token
    // isAdmin,      // Evitamos usar as do AuthContext diretamente para garantir que são as mais recentes do token
    loading: authLoading, // Estado de carregamento da autenticação
    logout // Função de logout do AuthContext
  } = useAuth();

  // Estados para gerenciar a informação do estabelecimento e pedidos
  const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
  const [pedidos, setPedidos] = useState({
    recebido: [],
    preparo: [],
    entrega: [],
    finalizado: []
  });
  // Estados de carregamento e erro
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Estado para controle de notificações
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('notificationsEnabled') === 'true';
  });
  const prevRecebidos = useRef([]); // Ref para controlar pedidos recebidos anteriormente (para notificação)
  const [audioBlockedMsg, setAudioBlockedMsg] = useState(''); // Mensagem se o áudio for bloqueado

  // Inicializa o elemento de áudio ao montar o componente
  useEffect(() => {
    audioRef.current = new Audio('/campainha.mp3');
    return () => audioRef.current && audioRef.current.pause(); // Pausa o áudio ao desmontar
  }, []);

  // useEffect principal: Autenticação, refresh do token e inicialização dos listeners de dados
  useEffect(() => {
    if (authLoading) return; // Se a autenticação ainda está carregando, não faz nada

    let unsub = []; // Array para armazenar funções de unsubscribe dos listeners do Firestore

    async function init() {
      // Obtenha a instância de autenticação para forçar o refresh do token
      const auth = getAuth(); 

      // Se não há usuário logado, redireciona e mostra erro
      if (!currentUser) {
        toast.error('Faça login para acessar esta página.');
        navigate('/');
        setLoading(false);
        return;
      }

      try {
        // --- PASSO CRÍTICO: Força o refresh do token de ID para obter as custom claims atualizadas ---
        const idTokenResult = await currentUser.getIdTokenResult(true);
        console.log("Painel.jsx: Custom Claims ATUALIZADAS após refresh:", idTokenResult.claims);

        // Extrai as claims diretamente do token atualizado
        const currentIsAdmin = idTokenResult.claims.isAdmin === true;
        const currentIsMasterAdmin = idTokenResult.claims.isMasterAdmin === true;
        const currentEstabelecimentoId = idTokenResult.claims.estabelecimentoId; // Importante para admins de estabelecimento
        const currentIsEstabelecimentoAtivo = idTokenResult.claims.isEstabelecimentoAtivo === true; // Se você tiver esta claim

        // --- Verificação de Permissões Detalhada após o refresh do token ---
        if (currentIsMasterAdmin) {
            // Se o usuário é Master Admin, ele deve ser redirecionado para o Master Dashboard
            toast.info('Redirecionando para o Dashboard Master.');
            navigate('/master-dashboard');
            setLoading(false);
            return;
        }

        if (!currentIsAdmin || !currentEstabelecimentoId || !currentIsEstabelecimentoAtivo) {
            // Se não é Admin OU falta o ID do estabelecimento OU o estabelecimento está inativo
            const msg = !currentIsAdmin ?
                'Acesso negado. Suas permissões não são de administrador de estabelecimento.' :
                !currentEstabelecimentoId ?
                    'Seu perfil de administrador está incompleto (ID do estabelecimento ausente).' :
                    !currentIsEstabelecimentoAtivo ?
                        'Seu estabelecimento está inativo ou pendente de ativação.' : '';
            toast.error(msg);
            navigate('/'); // Redireciona para a página inicial
            setLoading(false);
            return;
        }

        // Se chegamos aqui, o usuário é um isAdmin válido para um estabelecimento ativo
        // E temos o ID do estabelecimento dele.
        console.log(`Painel.jsx: Usuário ${currentUser.email} é Admin de Estabelecimento (${currentEstabelecimentoId}). Carregando dados...`);

        // 1. Busca as informações do estabelecimento associado ao admin logado
        // Use currentEstabelecimentoId da claim para garantir que é o estabelecimento certo
        const estDocRef = doc(db, 'estabelecimentos', currentEstabelecimentoId);
        const estSnap = await getDocs(query(collection(db, 'estabelecimentos'), where('adminUID', '==', currentUser.uid)));
        
        if (estSnap.empty) {
            throw new Error('Estabelecimento não encontrado para este administrador. Contate o suporte.');
        }
        const estDoc = estSnap.docs[0];
        setEstabelecimentoInfo(estDoc.data()); // Define as informações do estabelecimento
        
        // --- Funções de Query Base para Pedidos (agora com filtro de estabelecimentoId) ---
        const baseQuery = (status) => (
          query(
            collection(db, 'pedidos'),
            where('estabelecimentoId', '==', estDoc.id), // <--- FILTRO CRÍTICO ADICIONADO AQUI
            where('status', '==', status),
            orderBy('criadoEm', 'desc')
          )
        );

        // Handler para novos pedidos recebidos (com notificação sonora e toast)
        function handleRecebidos(snap) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          const newOnes = list.filter(p => !prevRecebidos.current.find(o => o.id === p.id));
          if (newOnes.length && notificationsEnabled) {
            audioRef.current.play().catch(() => setAudioBlockedMsg('Som bloqueado. Clique para ativar.'));
            toast.info(`🔔 Novo pedido de ${newOnes[0].cliente.nome}: R$ ${newOnes[0].totalFinal.toFixed(2)}`);
          }
          prevRecebidos.current = list; // Atualiza a ref para a próxima comparação
          setPedidos(prev => ({ ...prev, recebido: list })); // Atualiza o estado dos pedidos recebidos
        }

        // Inscrições em tempo real para cada status de pedido
        unsub.push(onSnapshot(baseQuery('recebido'), handleRecebidos, (error) => {
          console.error("Erro no listener de pedidos 'recebido':", error);
          setError('Erro ao carregar pedidos recebidos. Verifique suas permissões.');
        }));
        unsub.push(onSnapshot(baseQuery('preparo'), snap => setPedidos(prev => ({ ...prev, preparo: snap.docs.map(d => ({ id: d.id, ...d.data() })) })), (error) => {
          console.error("Erro no listener de pedidos 'preparo':", error);
          setError('Erro ao carregar pedidos em preparo. Verifique suas permissões.');
        }));
        unsub.push(onSnapshot(baseQuery('entrega'), snap => setPedidos(prev => ({ ...prev, entrega: snap.docs.map(d => ({ id: d.id, ...d.data() })) })), (error) => {
          console.error("Erro no listener de pedidos 'entrega':", error);
          setError('Erro ao carregar pedidos em entrega. Verifique suas permissões.');
        }));
        unsub.push(onSnapshot(baseQuery('finalizado'), snap => setPedidos(prev => ({ ...prev, finalizado: snap.docs.map(d => ({ id: d.id, ...d.data() })) })), (error) => {
          console.error("Erro no listener de pedidos 'finalizado':", error);
          setError('Erro ao carregar pedidos finalizados. Verifique suas permissões.');
        }));

        setLoading(false); // Desativa o estado de carregamento geral
      } catch (e) {
        console.error("Painel.jsx: Erro durante a inicialização/carregamento de dados:", e);
        setError('Falha ao carregar o painel. Por favor, recarregue a página.'); // Mensagem de erro mais genérica para o usuário
        toast.error(`Erro: ${e.message || 'Falha ao carregar painel.'}`);
        setLoading(false); // Garante que o loading seja desativado
        // Opcional: Se for um erro de autenticação, força logout
        if (e.code && e.code.startsWith('auth/')) {
            logout(); // Dispara logout
            navigate('/'); // Redireciona
        }
      }
    }

    // Retorna a função de cleanup do useEffect: desinscreve de todos os listeners do Firestore
    return () => unsub.forEach(fn => fn());
  // Dependências do useEffect: re-executa se qualquer uma dessas mudar
  }, [authLoading, currentUser, navigate, notificationsEnabled, logout]); // Adicionado logout como dependência

  // Toggle de notificações
  const toggleNotifications = () => {
    const enable = !notificationsEnabled;
    setNotificationsEnabled(enable);
    localStorage.setItem('notificationsEnabled', enable.toString()); // Salva no localStorage
    toast.info(enable ? 'Notificações ativas' : 'Notificações desativadas');
    if (!enable) audioRef.current && audioRef.current.pause(); // Pausa o áudio se desativar
  };

  // Função para deletar pedido
  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja EXCLUIR este pedido permanentemente?')) return;
    try {
      await deleteDoc(doc(db, 'pedidos', id)); // Deleta o documento do Firestore
      toast.success('Pedido excluído com sucesso!'); // Notificação de sucesso
    } catch (error) {
      console.error("Erro ao excluir pedido:", error); // Loga o erro
      toast.error('Erro ao excluir pedido.'); // Notificação de erro
    }
  };

  // Renderiza Spinner enquanto carrega
  if (loading) return <Spinner />;
  // Renderiza mensagem de erro se houver
  if (error) return (
    <div className="p-6 bg-red-100 text-red-700 rounded-lg">
      <p className="font-bold">Erro:</p>
      <p>{error}</p>
    </div>
  );

  // Renderiza o layout do painel
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
          {['recebido', 'preparo', 'entrega', 'finalizado'].map(status => (
            <div key={status} className="bg-white rounded-lg shadow p-4 border">
              <h2 className="text-xl font-heading mb-2 capitalize">{status}</h2>
              <div className="space-y-4 max-h-[70vh] overflow-auto pr-2">
                {pedidos[status].length === 0 ? (
                  <p className="text-secondary italic text-center py-4">Nenhum pedido.</p>
                ) : pedidos[status].map(ped => (
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
          ))}
        </div>
      </div>
    </div>
  );
}