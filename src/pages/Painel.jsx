import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
    collection, query, where, orderBy, onSnapshot, 
    doc, updateDoc, deleteDoc, getDoc,
    serverTimestamp
} from 'firebase/firestore';
import { toast } from 'react-toastify';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import PedidoCard from "../components/PedidoCard";
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { IoTime } from "react-icons/io5";

// ==========================================
// 🧩 COMPONENTES AUXILIARES
// ==========================================

const GrupoPedidosMesa = ({ pedidos, onUpdateStatus, onExcluir, newOrderIds, estabelecimentoInfo }) => {
  const pedidosAgrupados = useMemo(() => {
    const grupos = {};
    pedidos.forEach(pedido => {
      const chave = `${pedido.mesaNumero}-${pedido.loteHorario || 'principal'}`;
      if (!grupos[chave]) {
        grupos[chave] = {
          mesaNumero: pedido.mesaNumero,
          loteHorario: pedido.loteHorario,
          pedidos: [],
          totalItens: 0,
          status: pedido.status,
          pessoas: pedido.pessoas || 1
        };
      }
      grupos[chave].pedidos.push(pedido);
      grupos[chave].totalItens += pedido.itens?.length || 0;
    });
    return Object.values(grupos);
  }, [pedidos]);

  if (pedidosAgrupados.length === 0) return <div className="text-center py-4 text-gray-400">Sem pedidos na cozinha</div>;

  return (
    <div className="space-y-4">
      {pedidosAgrupados.map((grupo, index) => (
        <div key={index} className="border border-amber-200 rounded-xl bg-amber-50/50 overflow-hidden">
          <div className="bg-white px-4 py-3 border-b border-amber-200 flex justify-between items-center">
             <div className="flex items-center gap-3">
                <span className="font-bold text-gray-900 text-lg">Mesa {grupo.mesaNumero}</span>
                {grupo.loteHorario && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex items-center gap-1">
                        <IoTime className="w-3 h-3"/> {grupo.loteHorario}
                    </span>
                )}
             </div>
             <span className="text-xs font-semibold text-gray-500">{grupo.totalItens} itens</span>
          </div>
          <div className="p-4 space-y-3">
            {grupo.pedidos.map(pedido => (
              <PedidoCard
                key={pedido.id}
                item={pedido}
                onUpdateStatus={onUpdateStatus}
                onExcluir={onExcluir}
                newOrderIds={newOrderIds}
                estabelecimentoInfo={estabelecimentoInfo}
                showMesaInfo={false}
                isAgrupado={true}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ==========================================
// 🚀 COMPONENTE PRINCIPAL (PAINEL)
// ==========================================
function Painel() {
    const audioRef = useRef(null);
    const { logout, loading: authLoading, estabelecimentosGerenciados } = useAuth();
    
    // --- ESTADOS ---
    const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
    const [pedidos, setPedidos] = useState({ 
        recebido: [], preparo: [], em_entrega: [], pronto_para_servir: [], finalizado: [] 
    });
    const [loading, setLoading] = useState(true);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [userInteracted, setUserInteracted] = useState(false);
    const [newOrderIds, setNewOrderIds] = useState(new Set());
    const [abaAtiva, setAbaAtiva] = useState('delivery');
    
    const [bloqueioAtualizacao, setBloqueioAtualizacao] = useState(new Set());
    const isUpdatingRef = useRef(false);
    const prevRecebidosRef = useRef([]);

    // SELEÇÃO AUTOMÁTICA DE ESTABELECIMENTO
    const estabelecimentoAtivo = useMemo(() => {
        if (!estabelecimentosGerenciados || estabelecimentosGerenciados.length === 0) return null;
        return estabelecimentosGerenciados[0]; 
    }, [estabelecimentosGerenciados]);

    // --- FUNÇÕES DE AÇÃO ---
    const handleExcluirPedido = useCallback(async (pedidoId, source) => {
        if (!window.confirm("Cancelar este pedido?")) return;
        try {
            const pedidoRef = source === 'salao'
                ? doc(db, 'estabelecimentos', estabelecimentoAtivo, 'pedidos', pedidoId)
                : doc(db, 'pedidos', pedidoId);
            await deleteDoc(pedidoRef);
            toast.success("Pedido excluído!");
        } catch (error) {
            toast.error("Erro ao excluir: " + error.message);
        }
    }, [estabelecimentoAtivo]);

    const handleUpdateStatusAndNotify = useCallback(async (pedidoId, newStatus) => {
        if (isUpdatingRef.current || bloqueioAtualizacao.has(pedidoId)) return;
        try {
            isUpdatingRef.current = true;
            setBloqueioAtualizacao(prev => new Set(prev).add(pedidoId));
            
            const allPedidos = Object.values(pedidos).flat();
            const pedidoData = allPedidos.find(p => p.id === pedidoId);
            if (!pedidoData) throw new Error("Pedido não encontrado na memória.");

            const pedidoRef = pedidoData.source === 'salao'
                ? doc(db, 'estabelecimentos', estabelecimentoAtivo, 'pedidos', pedidoId)
                : doc(db, 'pedidos', pedidoId);

            await updateDoc(pedidoRef, { status: newStatus, atualizadoEm: serverTimestamp() });
            toast.success(`Movido para ${newStatus.replace(/_/g, ' ')}!`);
        } catch (error) { 
            toast.error(`Falha ao mover: ${error.message}`); 
        } finally {
            setTimeout(() => {
                isUpdatingRef.current = false;
                setBloqueioAtualizacao(prev => {
                    const novo = new Set(prev);
                    novo.delete(pedidoId);
                    return novo;
                });
            }, 1000);
        }
    }, [pedidos, estabelecimentoAtivo, bloqueioAtualizacao]);

    // --- LISTENERS ---
    useEffect(() => {
        if (authLoading) return;
        if (!estabelecimentoAtivo) { setLoading(false); return; }

        let unsubscribers = [];
        const setupPainel = async () => {
            try {
                const estDocRef = doc(db, 'estabelecimentos', estabelecimentoAtivo);
                getDoc(estDocRef).then(snap => { if (snap.exists()) setEstabelecimentoInfo(snap.data()); });

                // LISTENER SALÃO
                const qSalao = query(
                    collection(db, 'estabelecimentos', estabelecimentoAtivo, 'pedidos'),
                    // Removido 'aguardando_pagamento'
                    where('status', 'in', ['recebido', 'preparo', 'pronto_para_servir', 'finalizado']),
                    orderBy('dataPedido', 'asc')
                );
                
                unsubscribers.push(onSnapshot(qSalao, (snapshot) => {
                    const pedidosSalao = snapshot.docs.map(d => ({ id: d.id, ...d.data(), source: 'salao', tipo: 'salao' }));
                    setPedidos(prev => ({
                        ...prev,
                        recebido: [...prev.recebido.filter(p => p.source !== 'salao'), ...pedidosSalao.filter(p => p.status === 'recebido')],
                        preparo: [...prev.preparo.filter(p => p.source !== 'salao'), ...pedidosSalao.filter(p => p.status === 'preparo')],
                        pronto_para_servir: pedidosSalao.filter(p => p.status === 'pronto_para_servir'),
                        finalizado: [...prev.finalizado.filter(p => p.source !== 'salao'), ...pedidosSalao.filter(p => p.status === 'finalizado')]
                    }));
                }));

                // LISTENER DELIVERY
                const qGlobal = query(
                    collection(db, 'pedidos'), 
                    where('estabelecimentoId', '==', estabelecimentoAtivo),
                    // Removido 'aguardando_pagamento'
                    where('status', 'in', ['recebido', 'preparo', 'em_entrega', 'finalizado']),
                    orderBy('createdAt', 'asc')
                );
                
                unsubscribers.push(onSnapshot(qGlobal, (snapshot) => {
                    const pedidosDelivery = snapshot.docs.map(d => ({ id: d.id, ...d.data(), source: 'global', tipo: d.data().tipo || 'delivery' }));
                    setPedidos(prev => ({
                        ...prev,
                        recebido: [...prev.recebido.filter(p => p.source !== 'global'), ...pedidosDelivery.filter(p => p.status === 'recebido')],
                        preparo: [...prev.preparo.filter(p => p.source !== 'global'), ...pedidosDelivery.filter(p => p.status === 'preparo')],
                        em_entrega: pedidosDelivery.filter(p => p.status === 'em_entrega'),
                        finalizado: [...prev.finalizado.filter(p => p.source !== 'global'), ...pedidosDelivery.filter(p => p.status === 'finalizado')]
                    }));
                }));
                setLoading(false);
            } catch (error) {
                console.error("❌ Erro:", error);
                setLoading(false);
            }
        };
        setupPainel();
        return () => unsubscribers.forEach(u => u());
    }, [estabelecimentoAtivo, authLoading]);

    // Áudio
    useEffect(() => {
        const currentRecebidos = pedidos.recebido;
        if (currentRecebidos.length > prevRecebidosRef.current.length) {
            const newOrders = currentRecebidos.filter(c => !prevRecebidosRef.current.some(p => p.id === c.id));
            if (newOrders.length > 0) {
                const newIds = newOrders.map(order => order.id);
                setNewOrderIds(prev => new Set([...prev, ...newIds]));
                if (notificationsEnabled && userInteracted) audioRef.current?.play().catch(() => {});
                setTimeout(() => {
                    setNewOrderIds(prev => {
                        const updated = new Set(prev);
                        newIds.forEach(id => updated.delete(id));
                        return updated;
                    });
                }, 15000);
            }
        }
        prevRecebidosRef.current = currentRecebidos;
    }, [pedidos.recebido, notificationsEnabled, userInteracted]);

    const toggleNotifications = () => {
        const novoStatus = !notificationsEnabled;
        setNotificationsEnabled(novoStatus);
        if (novoStatus) {
            toast.success('🔔 Som Ativado!');
            if (userInteracted) audioRef.current?.play().catch(() => {});
        } else {
            toast.warn('🔕 Som Desativado.');
        }
    };

    useEffect(() => {
        const unlockAudio = () => { setUserInteracted(true); window.removeEventListener('click', unlockAudio); };
        window.addEventListener('click', unlockAudio);
        return () => window.removeEventListener('click', unlockAudio);
    }, []);

    // COLUNAS CONFIGURADAS (SEM PAGAMENTO)
    const colunas = useMemo(() => abaAtiva === 'cozinha' 
        ? ['recebido', 'preparo', 'pronto_para_servir', 'finalizado']
        : ['recebido', 'preparo', 'em_entrega', 'finalizado'],
    [abaAtiva]);

    const STATUS_CONFIG = {
        recebido: { title: '📥 Recebido', color: 'border-l-red-500', countColor: 'bg-red-500' },
        preparo: { title: '👨‍🍳 Em Preparo', color: 'border-l-orange-500', countColor: 'bg-orange-500' },
        em_entrega: { title: '🛵 Em Entrega', color: 'border-l-blue-500', countColor: 'bg-blue-500' },
        pronto_para_servir: { title: '✅ Pronto', color: 'border-l-green-500', countColor: 'bg-green-500' },
        finalizado: { title: '📦 Finalizado', color: 'border-l-gray-500', countColor: 'bg-gray-500' }
    };

    if (loading || authLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50">Carregando painel...</div>;

    if (!estabelecimentoAtivo) return <div className="p-10 text-center">Nenhum estabelecimento selecionado.</div>;

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex flex-col">
            <audio ref={audioRef} src="/campainha.mp3" preload="auto" />
            
            {/* HEADER */}
            <header className="bg-white shadow-lg border-b border-amber-200 p-4 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex gap-4 items-center">
                        <button onClick={toggleNotifications} className={`px-4 py-2 rounded-xl font-bold transition-all ${notificationsEnabled ? 'bg-green-500 text-white' : 'bg-amber-100 text-amber-800'}`}>
                            {notificationsEnabled ? '🔔 Som ON' : '🔕 Som OFF'}
                        </button>
                    </div>

                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button onClick={() => setAbaAtiva('delivery')} className={`px-4 py-2 rounded-lg font-semibold ${abaAtiva === 'delivery' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500'}`}>🛵 Delivery</button>
                        <button onClick={() => setAbaAtiva('cozinha')} className={`px-4 py-2 rounded-lg font-semibold ${abaAtiva === 'cozinha' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500'}`}>👨‍🍳 Cozinha</button>
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT - LAYOUT RESPONSIVO */}
            <main className="flex-grow p-4 overflow-x-hidden">
                <div className="flex flex-col md:flex-row gap-4 h-auto md:h-full w-full">
                    {colunas.map(status => {
                        const config = STATUS_CONFIG[status];
                        const allPedidosStatus = pedidos[status] || [];
                        const pedidosFiltrados = allPedidosStatus.filter(p => abaAtiva === 'cozinha' ? p.source === 'salao' : p.source === 'global');

                        return (
                            <div key={status} className={`flex-1 rounded-2xl shadow-lg border border-amber-100 border-l-4 ${config.color} bg-white flex flex-col h-auto md:h-[calc(100vh-140px)] min-h-[300px]`}>
                                <div className="p-4 border-b border-amber-100 flex justify-between items-center bg-gray-50 rounded-tr-xl">
                                    <h2 className="font-bold text-gray-800 text-lg">{config.title}</h2>
                                    <span className={`${config.countColor} text-white text-xs font-bold px-3 py-1 rounded-full`}>{pedidosFiltrados.length}</span>
                                </div>
                                <div className="p-4 space-y-4 md:overflow-y-auto flex-1 custom-scrollbar">
                                    {pedidosFiltrados.length > 0 ? (
                                        abaAtiva === 'cozinha' ? 
                                            <GrupoPedidosMesa 
                                                pedidos={pedidosFiltrados} 
                                                onUpdateStatus={handleUpdateStatusAndNotify} 
                                                onExcluir={handleExcluirPedido} 
                                                newOrderIds={newOrderIds} 
                                                estabelecimentoInfo={estabelecimentoInfo} 
                                            /> 
                                            : 
                                            pedidosFiltrados.map(ped => (
                                                <PedidoCard 
                                                    key={ped.id} 
                                                    item={ped} 
                                                    onUpdateStatus={handleUpdateStatusAndNotify} 
                                                    onExcluir={handleExcluirPedido} 
                                                    newOrderIds={newOrderIds} 
                                                    estabelecimentoInfo={estabelecimentoInfo} 
                                                />
                                            ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-10 md:h-full text-gray-400 opacity-50">
                                            <div className="text-4xl mb-2">🍃</div><p>Vazio</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>
        </div>
    );
}

export default withEstablishmentAuth(Painel);