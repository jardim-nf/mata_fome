// src/pages/KitchenDisplay.jsx — KDS (Kitchen Display System)
import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { toast } from 'react-toastify';
import {
  IoFlameOutline, IoCheckmarkCircle, IoTimeOutline, IoAlertCircle,
  IoRefreshOutline, IoExpandOutline, IoContractOutline,
  IoFastFoodOutline, IoStorefront, IoRestaurant
} from 'react-icons/io5';

// Timer hook
const useTimer = () => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
};

const formatTime = (ms) => {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

const getTimeColor = (ms) => {
  const min = ms / 60000;
  if (min < 10) return { bg: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-200', label: 'No tempo' };
  if (min < 20) return { bg: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-200', label: 'Atenção' };
  return { bg: 'bg-red-500', text: 'text-red-600', border: 'border-red-200', label: 'Atrasado!' };
};

// ─── ORDER CARD ───
const KDSCard = ({ pedido, estabId, now }) => {
  const createdAt = pedido.createdAt?.toDate?.() || pedido.createdAt?.seconds ? new Date(pedido.createdAt.seconds * 1000) : new Date();
  const elapsed = now - createdAt.getTime();
  const timeInfo = getTimeColor(elapsed);
  
  const isRecebido = pedido.status === 'recebido';
  const isPreparo = pedido.status === 'preparo';
  const isPronto = pedido.status === 'pronto_para_servir' || pedido.status === 'em_entrega';
  const isMesa = pedido.source === 'salao' || pedido.tipo === 'salao' || pedido.mesa;

  const avancarStatus = async () => {
    try {
      let nextStatus = '';
      if (isRecebido) nextStatus = 'preparo';
      else if (isPreparo) nextStatus = isMesa ? 'pronto_para_servir' : 'em_entrega';
      else return;

      await updateDoc(doc(db, 'estabelecimentos', estabId, 'pedidos', pedido.id), { status: nextStatus });
      toast.success(nextStatus === 'preparo' ? '🔥 Preparando!' : '✅ Pronto!');
    } catch (e) {
      toast.error('Erro ao atualizar');
    }
  };

  const statusConfig = {
    recebido: { color: 'bg-blue-500', label: 'NOVO', pulse: true },
    preparo: { color: 'bg-orange-500', label: 'PREPARANDO', pulse: false },
    pronto_para_servir: { color: 'bg-emerald-500', label: 'PRONTO', pulse: true },
    em_entrega: { color: 'bg-purple-500', label: 'SAIU', pulse: false },
  };
  const st = statusConfig[pedido.status] || statusConfig.recebido;

  return (
    <div className={`bg-white rounded-2xl border-2 ${isRecebido ? 'border-blue-300 shadow-lg shadow-blue-100' : isPreparo ? `${timeInfo.border} shadow-md` : 'border-emerald-300 shadow-lg shadow-emerald-100'} overflow-hidden flex flex-col transition-all duration-300`}>
      
      {/* HEADER */}
      <div className={`${st.color} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          {st.pulse && <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>}
          <span className="text-white font-black text-xs tracking-wider">{st.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {isMesa ? (
            <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <IoRestaurant size={10}/> Mesa {pedido.mesa || '?'}
            </span>
          ) : (
            <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <IoStorefront size={10}/> Delivery
            </span>
          )}
        </div>
      </div>

      {/* TIMER BAR */}
      <div className={`px-4 py-2 flex items-center justify-between ${elapsed > 1200000 ? 'bg-red-50' : elapsed > 600000 ? 'bg-amber-50' : 'bg-gray-50'}`}>
        <div className="flex items-center gap-2">
          <IoTimeOutline className={timeInfo.text} />
          <span className={`font-mono font-black text-lg ${timeInfo.text}`}>{formatTime(elapsed)}</span>
        </div>
        <span className={`text-[9px] font-bold uppercase tracking-wider ${timeInfo.text}`}>{timeInfo.label}</span>
      </div>

      {/* CUSTOMER */}
      <div className="px-4 py-2 border-b border-gray-100">
        <p className="text-sm font-bold text-gray-800 truncate">
          {pedido.cliente?.nome || 'Cliente'}
        </p>
        <p className="text-[10px] text-gray-400 font-mono">#{pedido.id?.slice(-6)?.toUpperCase()}</p>
      </div>

      {/* ITEMS */}
      <div className="px-4 py-3 flex-1 space-y-1.5 max-h-[250px] overflow-y-auto">
        {(pedido.itens || []).map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-600 shrink-0 mt-0.5">
              {item.quantidade || item.qtd || 1}x
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800 leading-tight">{item.nome}</p>
              {item.observacao && (
                <p className="text-[10px] text-orange-500 font-bold mt-0.5">⚠ {item.observacao}</p>
              )}
            </div>
          </div>
        ))}
        {pedido.observacao && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
            <p className="text-[10px] text-amber-700 font-bold">📝 {pedido.observacao}</p>
          </div>
        )}
      </div>

      {/* ACTION BUTTON */}
      {(isRecebido || isPreparo) && (
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={avancarStatus}
            className={`w-full py-3 rounded-xl font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-2 ${
              isRecebido 
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-200'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-200'
            }`}
          >
            {isRecebido ? <><IoFlameOutline size={18}/> INICIAR PREPARO</> : <><IoCheckmarkCircle size={18}/> MARCAR PRONTO</>}
          </button>
        </div>
      )}
    </div>
  );
};

// ─── MAIN COMPONENT ───
function KitchenDisplay() {
  const { userData , estabelecimentoIdPrincipal } = useAuth();
  const now = useTimer();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ativos');

  const estabId = estabelecimentoIdPrincipal;

  useEffect(() => {
    if (!estabId) return;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const tsHoje = Timestamp.fromDate(hoje);
    const q = query(collection(db, 'estabelecimentos', estabId, 'pedidos'), where('createdAt', '>=', tsHoje), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPedidos(lista);
      setLoading(false);
    });
    return () => unsub();
  }, [estabId]);

  const pedidosFiltrados = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return pedidos.filter(p => {
      const dt = p.createdAt?.toDate?.() || (p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : null);
      if (!dt || dt < hoje) return false;
      if (p.status === 'cancelado' || p.status === 'finalizado') return false;
      
      if (filterStatus === 'novos') return p.status === 'recebido';
      if (filterStatus === 'preparando') return p.status === 'preparo';
      if (filterStatus === 'prontos') return p.status === 'pronto_para_servir' || p.status === 'em_entrega';
      return true; // 'ativos'
    });
  }, [pedidos, filterStatus]);

  // Group by status
  const novos = pedidosFiltrados.filter(p => p.status === 'recebido');
  const preparando = pedidosFiltrados.filter(p => p.status === 'preparo');
  const prontos = pedidosFiltrados.filter(p => p.status === 'pronto_para_servir' || p.status === 'em_entrega');

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent mx-auto mb-4" />
        <p className="text-gray-500 font-bold text-sm">Carregando cozinha...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      
      {/* TOP BAR */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center">
              <IoFastFoodOutline className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-base font-black text-gray-800 tracking-tight">Kitchen Display</h1>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                {novos.length} novos • {preparando.length} preparando • {prontos.length} prontos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter tabs */}
            <div className="hidden sm:flex bg-gray-100 p-0.5 rounded-xl">
              {[
                { key: 'ativos', label: 'Todos' },
                { key: 'novos', label: `Novos (${novos.length})` },
                { key: 'preparando', label: `Preparo (${preparando.length})` },
                { key: 'prontos', label: `Prontos (${prontos.length})` },
              ].map(f => (
                <button key={f.key} onClick={() => setFilterStatus(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${filterStatus === f.key ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            
            <button onClick={toggleFullscreen} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" title="Tela cheia">
              {isFullscreen ? <IoContractOutline size={20}/> : <IoExpandOutline size={20}/>}
            </button>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-4">
        {filterStatus === 'ativos' ? (
          /* KANBAN VIEW — 3 columns */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            {/* NOVOS */}
            <div>
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <h2 className="text-xs font-black text-gray-500 uppercase tracking-wider">Novos ({novos.length})</h2>
              </div>
              <div className="space-y-3">
                {novos.map(p => <KDSCard key={p.id} pedido={p} estabId={estabId} now={now} />)}
                {novos.length === 0 && (
                  <div className="bg-white/50 rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
                    <p className="text-gray-400 text-sm font-bold">Nenhum pedido novo</p>
                  </div>
                )}
              </div>
            </div>

            {/* PREPARANDO */}
            <div>
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse"></div>
                <h2 className="text-xs font-black text-gray-500 uppercase tracking-wider">Preparando ({preparando.length})</h2>
              </div>
              <div className="space-y-3">
                {preparando.map(p => <KDSCard key={p.id} pedido={p} estabId={estabId} now={now} />)}
                {preparando.length === 0 && (
                  <div className="bg-white/50 rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
                    <p className="text-gray-400 text-sm font-bold">Nenhum em preparo</p>
                  </div>
                )}
              </div>
            </div>

            {/* PRONTOS */}
            <div>
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <h2 className="text-xs font-black text-gray-500 uppercase tracking-wider">Prontos ({prontos.length})</h2>
              </div>
              <div className="space-y-3">
                {prontos.map(p => <KDSCard key={p.id} pedido={p} estabId={estabId} now={now} />)}
                {prontos.length === 0 && (
                  <div className="bg-white/50 rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
                    <p className="text-gray-400 text-sm font-bold">Nenhum pronto</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* GRID VIEW — filtered */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pedidosFiltrados.map(p => <KDSCard key={p.id} pedido={p} estabId={estabId} now={now} />)}
            {pedidosFiltrados.length === 0 && (
              <div className="col-span-full bg-white/50 rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
                <IoFastFoodOutline className="text-5xl text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 font-bold">Nenhum pedido neste filtro</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AUTO-REFRESH INDICATOR */}
      <div className="fixed bottom-4 right-4 bg-white/80 backdrop-blur rounded-full px-3 py-1.5 shadow-lg border border-gray-200 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
        <span className="text-[10px] font-bold text-gray-500">Tempo real</span>
      </div>
    </div>
  );
}

export default withEstablishmentAuth(KitchenDisplay);
