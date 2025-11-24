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

// 🎯 Componente de Debug
const DebugInfo = ({ pedidos, estabelecimentoId }) => {
  const [showDebug, setShowDebug] = useState(false);
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button 
        onClick={() => setShowDebug(!showDebug)}
        className="bg-red-500 text-white p-3 rounded-full shadow-lg hover:bg-red-600 transition-colors"
      >
        🐛
      </button>
      
      {showDebug && (
        <div className="absolute bottom-16 right-0 bg-white p-4 rounded-lg shadow-xl border border-red-200 text-xs max-w-sm">
           <p><strong>Total Pedidos:</strong> {Object.values(pedidos).flat().length}</p>
           <p><strong>Estabelecimento:</strong> {estabelecimentoId}</p>
           <div className="mt-2 max-h-40 overflow-y-auto">
             {Object.values(pedidos).flat().slice(0, 5).map(p => (
                 <div key={p.id} className="border-b py-1">
                     {p.id.slice(0,5)}... ({p.source}) - {p.status}
                 </div>
             ))}
           </div>
        </div>
      )}
    </div>
  );
};

// 🎯 Componente de Agrupamento por Mesa
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

  if (pedidosAgrupados.length === 0) {
    return <div className="text-center py-12 text-amber-600 opacity-60">Nenhum pedido</div>;
  }

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
        aguardando_pagamento: [], recebido: [], preparo: [], em_entrega: [], pronto_para_servir: [], finalizado: [] 
    });
    const [loading, setLoading] = useState(true);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [userInteracted, setUserInteracted] = useState(false);
    const [newOrderIds, setNewOrderIds] = useState(new Set());
    const [abaAtiva, setAbaAtiva] = useState('delivery');
    
    // Controle de Concorrência
    const [bloqueioAtualizacao, setBloqueioAtualizacao] = useState(new Set());
    const isUpdatingRef = useRef(false);
    const prevRecebidosRef = useRef([]);

    // --- SELEÇÃO DE ESTABELECIMENTO ---
    const estabelecimentoAtivo = useMemo(() => {
        if (!estabelecimentosGerenciados || estabelecimentosGerenciados.length === 0) return null;
        return estabelecimentosGerenciados.find(id => id === 'SgQtnakq4LT13TqwpdzH') || estabelecimentosGerenciados[0];
    }, [estabelecimentosGerenciados]);

    // --- FUNÇÕES DE AÇÃO ---

    // 1. EXCLUIR PEDIDO
    const handleExcluirPedido = useCallback(async (pedidoId, source) => {
        if (!window.confirm("Tem certeza que deseja cancelar/excluir este pedido?")) return;

        try {
            console.log(`🗑️ Excluindo pedido ${pedidoId} (Origem: ${source})`);
            
            const pedidoRef = source === 'salao'
                ? doc(db, 'estabelecimentos', estabelecimentoAtivo, 'pedidos', pedidoId)
                : doc(db, 'pedidos', pedidoId);

            await deleteDoc(pedidoRef);
            toast.success("Pedido excluído com sucesso!");
        } catch (error) {
            console.error("❌ Erro ao excluir:", error);
            toast.error("Erro ao excluir: " + error.message);
        }
    }, [estabelecimentoAtivo]);

    // 2. ATUALIZAR STATUS
    const handleUpdateStatusAndNotify = useCallback(async (pedidoId, newStatus) => {
        if (isUpdatingRef.current) return;
        if (bloqueioAtualizacao.has(pedidoId)) return;

        try {
            isUpdatingRef.current = true;
            setBloqueioAtualizacao(prev => new Set(prev).add(pedidoId));
            
            console.log(`🔄 Movendo ${pedidoId} para ${newStatus}`);

            const allPedidos = Object.values(pedidos).flat();
            const pedidoData = allPedidos.find(p => p.id === pedidoId);
            
            if (!pedidoData) throw new Error("Pedido não encontrado na memória.");

            const pedidoRef = pedidoData.source === 'salao'
                ? doc(db, 'estabelecimentos', estabelecimentoAtivo, 'pedidos', pedidoId)
                : doc(db, 'pedidos', pedidoId);

            await updateDoc(pedidoRef, { 
                status: newStatus,
                atualizadoEm: serverTimestamp()
            });
            
            toast.success(`Pedido movido para ${newStatus.replace(/_/g, ' ')}!`);

        } catch (error) { 
            console.error('❌ Erro ao mover:', error); 
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

    // --- LISTENERS (Escuta em Tempo Real) ---
    useEffect(() => {
        if (authLoading) return;
        if (!estabelecimentoAtivo) {
            setLoading(false);
            return;
        }

        let unsubscribers = [];
        console.log('🚀 Iniciando Listeners do Painel...');

        const setupPainel = async () => {
            try {
                // Info do Estabelecimento
                const estDocRef = doc(db, 'estabelecimentos', estabelecimentoAtivo);
                getDoc(estDocRef).then(snap => {
                    if (snap.exists()) setEstabelecimentoInfo(snap.data());
                });

                // 1. Listener SALÃO (Sub-coleção)
                const qSalao = query(
                    collection(db, 'estabelecimentos', estabelecimentoAtivo, 'pedidos'),
                    // ✅ ADICIONADO: 'aguardando_pagamento'
                    where('status', 'in', ['aguardando_pagamento', 'recebido', 'preparo', 'pronto_para_servir', 'finalizado']),
                    orderBy('dataPedido', 'asc')
                );
                
                unsubscribers.push(onSnapshot(qSalao, (snapshot) => {
                    const pedidosSalao = snapshot.docs.map(d => ({
                        id: d.id, ...d.data(), source: 'salao', tipo: 'salao'
                    }));
                    
                    setPedidos(prev => ({
                        ...prev,
                        aguardando_pagamento: [...prev.aguardando_pagamento.filter(p => p.source !== 'salao'), ...pedidosSalao.filter(p => p.status === 'aguardando_pagamento')],
                        recebido: [...prev.recebido.filter(p => p.source !== 'salao'), ...pedidosSalao.filter(p => p.status === 'recebido')],
                        preparo: [...prev.preparo.filter(p => p.source !== 'salao'), ...pedidosSalao.filter(p => p.status === 'preparo')],
                        pronto_para_servir: pedidosSalao.filter(p => p.status === 'pronto_para_servir'),
                        finalizado: [...prev.finalizado.filter(p => p.source !== 'salao'), ...pedidosSalao.filter(p => p.status === 'finalizado')]
                    }));
                }));

                // 2. Listener DELIVERY (Coleção Raiz)
                const qGlobal = query(
                    collection(db, 'pedidos'), 
                    where('estabelecimentoId', '==', estabelecimentoAtivo),
                    // ✅ ADICIONADO: 'aguardando_pagamento'
                    where('status', 'in', ['aguardando_pagamento', 'recebido', 'preparo', 'em_entrega', 'finalizado']),
                    orderBy('createdAt', 'asc')
                );
                
                unsubscribers.push(onSnapshot(qGlobal, (snapshot) => {
                    const pedidosDelivery = snapshot.docs.map(d => ({ 
                        id: d.id, ...d.data(), source: 'global', tipo: d.data().tipo || 'delivery'
                    }));
                    
                    setPedidos(prev => ({
                        ...prev,
                        aguardando_pagamento: [...prev.aguardando_pagamento.filter(p => p.source !== 'global'), ...pedidosDelivery.filter(p => p.status === 'aguardando_pagamento')],
                        recebido: [...prev.recebido.filter(p => p.source !== 'global'), ...pedidosDelivery.filter(p => p.status === 'recebido')],
                        preparo: [...prev.preparo.filter(p => p.source !== 'global'), ...pedidosDelivery.filter(p => p.status === 'preparo')],
                        em_entrega: pedidosDelivery.filter(p => p.status === 'em_entrega'),
                        finalizado: [...prev.finalizado.filter(p => p.source !== 'global'), ...pedidosDelivery.filter(p => p.status === 'finalizado')]
                    }));
                }));
                
                setLoading(false);

            } catch (error) {
                console.error("❌ Erro no setupPainel:", error);
                toast.error("Erro ao carregar pedidos.");
                setLoading(false);
            }
        };

        setupPainel();

        return () => unsubscribers.forEach(u => u());
    }, [estabelecimentoAtivo, authLoading]);

    // --- ÁUDIO E NOTIFICAÇÕES ---
    useEffect(() => {
        const currentRecebidos = pedidos.recebido;
        // Se a quantidade de pedidos recebidos aumentou
        if (currentRecebidos.length > prevRecebidosRef.current.length) {
            const newOrders = currentRecebidos.filter(c => !prevRecebidosRef.current.some(p => p.id === c.id));
            
            if (newOrders.length > 0) {
                const newIds = newOrders.map(order => order.id);
                setNewOrderIds(prev => new Set([...prev, ...newIds]));

                if (notificationsEnabled && userInteracted) {
                    audioRef.current?.play().catch(e => console.log("Erro áudio:", e));
                }
                
                // Limpa destaque após 15s
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
        const unlockAudio = () => {
            setUserInteracted(true);
            window.removeEventListener('click', unlockAudio);
        };
        window.addEventListener('click', unlockAudio);
        return () => window.removeEventListener('click', unlockAudio);
    }, []);

    // --- RENDERIZAÇÃO ---
    
    // Configuração das colunas
    const colunas = useMemo(() => 
        abaAtiva === 'cozinha' 
            ? ['recebido', 'preparo', 'pronto_para_servir', 'finalizado']
            // ✅ ADICIONADO: 'aguardando_pagamento' como primeira coluna do Delivery
            : ['aguardando_pagamento', 'recebido', 'preparo', 'em_entrega', 'finalizado'],
        [abaAtiva]
    );

    // ✅ ADICIONADO CONFIGURAÇÃO DE COR PARA O PAGAMENTO
    const STATUS_CONFIG = {
        aguardando_pagamento: { title: '💲 Pagamento', color: 'border-l-yellow-500', countColor: 'bg-yellow-500' },
        recebido: { title: '📥 Recebido', color: 'border-l-red-500', countColor: 'bg-red-500' },
        preparo: { title: '👨‍🍳 Em Preparo', color: 'border-l-orange-500', countColor: 'bg-orange-500' },
        em_entrega: { title: '🛵 Em Entrega', color: 'border-l-blue-500', countColor: 'bg-blue-500' },
        pronto_para_servir: { title: '✅ Pronto', color: 'border-l-green-500', countColor: 'bg-green-500' },
        finalizado: { title: '📦 Finalizado', color: 'border-l-gray-500', countColor: 'bg-gray-500' }
    };

    if (loading || authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
                    <p className="text-gray-500">Carregando painel...</p>
                </div>
            </div>
        );
    }

    if (!estabelecimentoAtivo) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="text-center p-8 bg-white rounded-2xl shadow-lg">
                    <h2 className="text-xl font-bold mb-2">Nenhum Estabelecimento Selecionado</h2>
                    <p className="text-gray-500 mb-4">Por favor, selecione um estabelecimento no dashboard.</p>
                    <Link to="/dashboard" className="bg-amber-500 text-white px-6 py-2 rounded-lg font-bold">Voltar</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex flex-col">
            <audio ref={audioRef} src="/campainha.mp3" preload="auto" />
            
            <DebugInfo pedidos={pedidos} estabelecimentoId={estabelecimentoAtivo} />

            {/* HEADER */}
            <header className="bg-white shadow-lg border-b border-amber-200 p-4 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex gap-4 items-center">
                        <button 
                            onClick={toggleNotifications}
                            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
                                notificationsEnabled ? 'bg-green-500 text-white shadow' : 'bg-amber-100 text-amber-800'
                            }`}
                        >
                            {notificationsEnabled ? '🔔 Som ON' : '🔕 Som OFF'}
                        </button>
                        <div className="hidden md:block text-sm text-gray-500">
                            ID: {estabelecimentoAtivo.slice(0, 8)}...
                        </div>
                    </div>

                    {/* Tabs Centrais */}
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button 
                            onClick={() => setAbaAtiva('delivery')} 
                            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                                abaAtiva === 'delivery' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            🛵 Delivery
                        </button>
                        <button 
                            onClick={() => setAbaAtiva('cozinha')} 
                            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                                abaAtiva === 'cozinha' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            👨‍🍳 Cozinha
                        </button>
                    </div>

                    <button onClick={logout} className="text-gray-500 hover:text-red-500 font-bold px-4">
                        Sair
                    </button>
                </div>
            </header>

            {/* MAIN CONTENT (GRID) */}
            <main className="flex-grow p-4 md:p-6 overflow-x-auto">
                <div className="flex gap-4 min-w-[1200px] h-full">
                    {colunas.map(status => {
                        const config = STATUS_CONFIG[status];
                        const allPedidosStatus = pedidos[status] || [];
                        
                        // Filtro Principal: Salão vs Delivery
                        const pedidosFiltrados = allPedidosStatus.filter(p => {
                            if (abaAtiva === 'cozinha') return p.source === 'salao';
                            return p.source === 'global';
                        });

                        return (
                            <div key={status} className={`flex-1 min-w-[300px] rounded-2xl shadow-lg border border-amber-100 border-l-4 ${config.color} bg-white flex flex-col max-h-[calc(100vh-140px)]`}>
                                {/* Header da Coluna */}
                                <div className="p-4 border-b border-amber-100 flex justify-between items-center bg-gray-50 rounded-tr-xl">
                                    <h2 className="font-bold text-gray-800 text-lg">{config.title}</h2>
                                    <span className={`${config.countColor} text-white text-xs font-bold px-3 py-1 rounded-full`}>
                                        {pedidosFiltrados.length}
                                    </span>
                                </div>

                                {/* Lista de Pedidos (Scrollável) */}
                                <div className="p-4 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                                    {pedidosFiltrados.length > 0 ? (
                                        abaAtiva === 'cozinha' ? (
                                            // Modo Agrupado (Cozinha)
                                            <GrupoPedidosMesa
                                                pedidos={pedidosFiltrados}
                                                onUpdateStatus={handleUpdateStatusAndNotify}
                                                onExcluir={handleExcluirPedido}
                                                newOrderIds={newOrderIds}
                                                estabelecimentoInfo={estabelecimentoInfo}
                                            />
                                        ) : (
                                            // Modo Lista Simples (Delivery)
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
                                        )
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-50">
                                            <div className="text-4xl mb-2">🍃</div>
                                            <p>Vazio</p>
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