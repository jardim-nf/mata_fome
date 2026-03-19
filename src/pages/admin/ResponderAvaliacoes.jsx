// src/pages/admin/ResponderAvaliacoes.jsx — Admin responde avaliações dos clientes
import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { IoArrowBack, IoStarOutline, IoStar, IoChatbubbleEllipsesOutline, IoSendOutline, IoCheckmarkCircle } from 'react-icons/io5';

function ResponderAvaliacoes() {
  const { userData } = useAuth();
  const estabId = userData?.estabelecimentosGerenciados?.[0];
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [respostas, setRespostas] = useState({});
  const [filtro, setFiltro] = useState('todos'); // todos, sem_resposta, respondidos

  useEffect(() => {
    if (!estabId) return;
    const load = async () => {
      const snap = await getDocs(query(collection(db, 'estabelecimentos', estabId, 'pedidos'), orderBy('createdAt', 'desc')));
      const comAvaliacao = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.avaliacao && p.avaliacao.estrelas);
      setPedidos(comAvaliacao);
      setLoading(false);
    };
    load();
  }, [estabId]);

  const responder = async (pedidoId) => {
    const texto = respostas[pedidoId];
    if (!texto?.trim()) return toast.warn('Escreva uma resposta!');
    try {
      await updateDoc(doc(db, 'estabelecimentos', estabId, 'pedidos', pedidoId), {
        'avaliacao.resposta': texto.trim(),
        'avaliacao.respondidoEm': new Date()
      });
      setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, avaliacao: { ...p.avaliacao, resposta: texto.trim() } } : p));
      setRespostas(prev => ({ ...prev, [pedidoId]: '' }));
      toast.success('✅ Resposta enviada!');
    } catch (e) {
      toast.error('Erro ao responder');
    }
  };

  const filtered = pedidos.filter(p => {
    if (filtro === 'sem_resposta') return !p.avaliacao?.resposta;
    if (filtro === 'respondidos') return !!p.avaliacao?.resposta;
    return true;
  });

  const mediaEstrelas = pedidos.length > 0 ? (pedidos.reduce((acc, p) => acc + p.avaliacao.estrelas, 0) / pedidos.length).toFixed(1) : '0';

  const renderStars = (n) => Array.from({ length: 5 }, (_, i) => (
    <span key={i}>{i < n ? <IoStar className="text-amber-400" /> : <IoStarOutline className="text-gray-300" />}</span>
  ));

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-6 font-sans pb-20">
      <div className="max-w-3xl mx-auto">

        <div className="flex items-center gap-3 mb-6">
          <Link to="/dashboard" className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 shadow-sm"><IoArrowBack size={18} /></Link>
          <div>
            <h1 className="text-xl font-black text-gray-900 flex items-center gap-2"><IoChatbubbleEllipsesOutline className="text-amber-500" /> Avaliações</h1>
            <p className="text-xs text-gray-400 font-medium">Veja e responda as avaliações dos clientes</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
            <p className="text-3xl font-black text-amber-500">{mediaEstrelas}</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase">Média</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
            <p className="text-3xl font-black text-gray-900">{pedidos.length}</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase">Total</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
            <p className="text-3xl font-black text-green-600">{pedidos.filter(p => p.avaliacao?.resposta).length}</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase">Respondidas</p>
          </div>
        </div>

        {/* Filtro */}
        <div className="flex gap-2 mb-5">
          {[['todos', 'Todas'], ['sem_resposta', 'Sem resposta'], ['respondidos', 'Respondidas']].map(([k, label]) => (
            <button key={k} onClick={() => setFiltro(k)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${filtro === k ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
            <IoStarOutline className="text-5xl text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-bold">Nenhuma avaliação encontrada</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(p => (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{p.cliente?.nome || p.nomeCliente || 'Cliente'}</p>
                    <p className="text-[10px] text-gray-400">
                      Pedido #{p.id.slice(-6).toUpperCase()} • {p.createdAt?.toDate?.() ? new Intl.DateTimeFormat('pt-BR').format(p.createdAt.toDate()) : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5">{renderStars(p.avaliacao.estrelas)}</div>
                </div>

                {p.avaliacao.comentario && (
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 mb-3 italic">"{p.avaliacao.comentario}"</p>
                )}

                {p.avaliacao.resposta ? (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-green-600 mb-1 flex items-center gap-1"><IoCheckmarkCircle /> Sua resposta:</p>
                    <p className="text-sm text-green-800">{p.avaliacao.resposta}</p>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input value={respostas[p.id] || ''} onChange={e => setRespostas(prev => ({ ...prev, [p.id]: e.target.value }))}
                      className="flex-1 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200"
                      placeholder="Escreva sua resposta..."
                      onKeyDown={e => e.key === 'Enter' && responder(p.id)}
                    />
                    <button onClick={() => responder(p.id)} className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-all shadow-lg shadow-amber-200">
                      <IoSendOutline />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default withEstablishmentAuth(ResponderAvaliacoes);
