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
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import PedidoCard from '../components/PedidoCard';

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
  const navigate = useNavigate();
  const audioRef = useRef(null);
  const {
    currentUser,
    isAdmin,
    isMasterAdmin,
    isEstabelecimentoAtivo,
    loading: authLoading
  } = useAuth();

  const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
  const [pedidos, setPedidos] = useState({
    recebido: [],
    preparo: [],
    entrega: [],
    finalizado: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('notificationsEnabled') === 'true';
  });
  const prevRecebidos = useRef([]);
  const [audioBlockedMsg, setAudioBlockedMsg] = useState('');

  // Inicializa áudio
  useEffect(() => {
    audioRef.current = new Audio('/campainha.mp3');
    return () => audioRef.current && audioRef.current.pause();
  }, []);

  // Autenticação e listeners
  useEffect(() => {
    if (authLoading) return;

    if (!currentUser || !isAdmin || isMasterAdmin || !isEstabelecimentoAtivo) {
      const msg = !currentUser ?
        'Faça login para acessar.' :
        !isAdmin ?
          'Sem permissão de administrador.' :
          isMasterAdmin ?
            'Use o Dashboard Master.' :
            'Estabelecimento inativo ou pendente.';
      toast.error(msg);
      navigate(isMasterAdmin ? '/master-dashboard' : '/');
      return;
    }

    setLoading(true);
    let unsub = [];

    async function init() {
      try {
        // Busca estabelecimento
        const estSnap = await getDocs(
          query(
            collection(db, 'estabelecimentos'),
            where('adminUID', '==', currentUser.uid)
          )
        );
        if (estSnap.empty) throw new Error('Estabelecimento não encontrado');
        const estDoc = estSnap.docs[0];
        setEstabelecimentoInfo(estDoc.data());

        const baseQuery = (status) => (
          query(
            collection(db, 'pedidos'),
            where('estabelecimentoId', '==', estDoc.id),
            where('status', '==', status),
            orderBy('criadoEm', 'desc')
          )
        );

        // Handler para novos pedidos recebidos
        function handleRecebidos(snap) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          // Notificação sonora e toast
          const newOnes = list.filter(p => !prevRecebidos.current.find(o => o.id === p.id));
          if (newOnes.length && notificationsEnabled) {
            audioRef.current.play().catch(() => setAudioBlockedMsg('Som bloqueado. Clique para ativar.'));
            toast.info(`🔔 Novo pedido de ${newOnes[0].cliente.nome}: R$ ${newOnes[0].totalFinal.toFixed(2)}`);
          }
          prevRecebidos.current = list;
          setPedidos(prev => ({ ...prev, recebido: list }));
        }

        // Inscrições em tempo real
        unsub.push(onSnapshot(baseQuery('recebido'), handleRecebidos));
        unsub.push(onSnapshot(baseQuery('preparo'), snap => setPedidos(prev => ({ ...prev, preparo: snap.docs.map(d => ({ id: d.id, ...d.data() })) })), err => console.error(err)));
        unsub.push(onSnapshot(baseQuery('entrega'), snap => setPedidos(prev => ({ ...prev, entrega: snap.docs.map(d => ({ id: d.id, ...d.data() })) })), err => console.error(err)));
        unsub.push(onSnapshot(baseQuery('finalizado'), snap => setPedidos(prev => ({ ...prev, finalizado: snap.docs.map(d => ({ id: d.id, ...d.data() })) })), err => console.error(err)));

        setLoading(false);
      } catch (e) {
        console.error(e);
        setError('Falha ao carregar painel.');
        toast.error('Erro ao carregar dados.');
        setLoading(false);
      }
    }

    init();
    return () => unsub.forEach(fn => fn());
  }, [authLoading, currentUser, isAdmin, isMasterAdmin, isEstabelecimentoAtivo, navigate, notificationsEnabled]);

  // Toggle notificações
  const toggleNotifications = async () => {
    const enable = !notificationsEnabled;
    setNotificationsEnabled(enable);
    localStorage.setItem('notificationsEnabled', enable);
    toast.info(enable ? 'Notificações ativas' : 'Notificações desativadas');
    if (!enable) audioRef.current.pause();
  };

  // Delete pedido
  const handleDelete = async (id) => {
    if (!window.confirm('Excluir pedido?')) return;
    try { await deleteDoc(doc(db, 'pedidos', id)); toast.success('Pedido excluído'); }
    catch { toast.error('Erro ao excluir'); }
  };

  if (loading) return <Spinner />;
  if (error) return (
    <div className="p-6 bg-red-100 text-red-700 rounded-lg">{error}</div>
  );

  return (
    <div className="p-6 bg-accent min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-8">
          <Link to="/dashboard" className="text-secondary hover:text-primary font-medium">
            &larr; Voltar
          </Link>
          <h1 className="text-3xl font-heading text-secondary text-center">
            Painel ({estabelecimentoInfo?.nome})
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
            {audioBlockedMsg} <button onClick={() => audioRef.current.play().catch(() => {})} className="underline">Tentar</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {['recebido','preparo','entrega','finalizado'].map(status => (
            <div key={status} className="bg-white rounded-lg shadow p-4 border">
              <h2 className="text-xl font-heading mb-2 capitalize">{status}</h2>
              <div className="space-y-4 max-h-[70vh] overflow-auto pr-2">
                {pedidos[status].length === 0 ? (
                  <p className="text-secondary italic text-center py-4">Nenhum pedido.</p>
                ) : pedidos[status].map(ped => (
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
    </div>
  );
}
