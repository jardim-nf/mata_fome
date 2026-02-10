import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import PedidoCard from "../components/PedidoCard";
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { IoTime, IoArrowBack, IoRestaurant, IoBicycle } from "react-icons/io5";

const GrupoPedidosMesa = ({ pedidos, onUpdateStatus, onExcluir, newOrderIds, estabelecimentoInfo }) => {
    const pedidosAgrupados = useMemo(() => {
        const grupos = {};
        pedidos.forEach(pedido => {
            if (!pedido || !pedido.id) return;
            const chave = `${pedido.mesaNumero || '0'}-${pedido.loteHorario || 'principal'}`;
            if (!grupos[chave]) {
                grupos[chave] = {
                    mesaNumero: pedido.mesaNumero || 0,
                    loteHorario: pedido.loteHorario || '',
                    pedidos: [],
                    totalItens: 0,
                    status: pedido.status || 'recebido',
                    pessoas: pedido.pessoas || 1
                };
            }
            grupos[chave].pedidos.push(pedido);
            grupos[chave].totalItens += pedido.itens?.length || 0;
        });
        return Object.values(grupos);
    }, [pedidos]);

    if (pedidosAgrupados.length === 0) return <div className="flex flex-col items-center justify-center py-10 text-gray-400 opacity-60"><IoRestaurant className="text-4xl mb-2" /><p>Sem pedidos de mesa</p></div>;

    return (
        <div className="space-y-4">
            {pedidosAgrupados.map((grupo, index) => (
                <div key={`grupo-${grupo.mesaNumero}-${index}`} className="border border-amber-200 rounded-xl bg-amber-50/30 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="bg-white px-4 py-3 border-b border-amber-100 flex justify-between items-center">
                        <div className="flex items-center gap-3"><span className="font-bold text-gray-900 text-lg flex items-center gap-2"><IoRestaurant className="text-amber-500" /> Mesa {grupo.mesaNumero}</span>{grupo.loteHorario && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex items-center gap-1 font-mono"><IoTime className="w-3 h-3"/> {grupo.loteHorario}</span>}</div>
                        <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">{grupo.totalItens} itens</span>
                    </div>
                    <div className="p-3 space-y-3 bg-gray-50/50">
                        {grupo.pedidos.map(pedido => (
                            <PedidoCard key={pedido.id} item={pedido} onUpdateStatus={onUpdateStatus} onExcluir={onExcluir} newOrderIds={newOrderIds} estabelecimentoInfo={estabelecimentoInfo} showMesaInfo={false} isAgrupado={true} motoboysDisponiveis={[]} onAtribuirMotoboy={null} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

function Painel() {
    const navigate = useNavigate(); 
    const audioRef = useRef(null);
    const { loading: authLoading, estabelecimentosGerenciados } = useAuth();
    
    const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
    const [pedidos, setPedidos] = useState({ recebido: [], preparo: [], em_entrega: [], pronto_para_servir: [], finalizado: [] });
    const [loading, setLoading] = useState(true);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [userInteracted, setUserInteracted] = useState(false);
    const [newOrderIds, setNewOrderIds] = useState(new Set());
    const [abaAtiva, setAbaAtiva] = useState('delivery'); 
    const [motoboys, setMotoboys] = useState([]);
    const [bloqueioAtualizacao, setBloqueioAtualizacao] = useState(new Set());
    
    const [urlImpressao, setUrlImpressao] = useState(null);
    const [printQueue, setPrintQueue] = useState([]); 
    const [isPrinting, setIsPrinting] = useState(false);

    const isUpdatingRef = useRef(false);
    const prevRecebidosRef = useRef([]);

    const dataHojeFormatada = new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
    const estabelecimentoAtivo = useMemo(() => estabelecimentosGerenciados?.[0] || null, [estabelecimentosGerenciados]);

    useEffect(() => {
        setPedidos({ recebido: [], preparo: [], em_entrega: [], pronto_para_servir: [], finalizado: [] });
        setMotoboys([]);
        setNewOrderIds(new Set());
        setPrintQueue([]); 
        setEstabelecimentoInfo(null);
        setLoading(true);
    }, [estabelecimentoAtivo]);

    const limparDadosCliente = useCallback((clienteData) => {
        if (!clienteData || typeof clienteData !== 'object') return { nome: 'Cliente', telefone: '', endereco: {} };
        if ('_methodName' in clienteData || 'toDate' in clienteData) return { nome: 'Cliente', telefone: '', endereco: {} };
        return { nome: clienteData.nome || 'Cliente', telefone: clienteData.telefone || '', endereco: (clienteData.endereco && typeof clienteData.endereco === 'object') ? clienteData.endereco : {} };
    }, []);

// 🔥 FUNÇÃO INTELIGENTE: Decide se é "salao" ou "global" (delivery)
    const processarDadosPedido = useCallback((pedidoData) => {
        if (!pedidoData || !pedidoData.id) return null;
        
        const clienteLimpo = limparDadosCliente(pedidoData.cliente);
        let endereco = pedidoData.endereco || {};
        if (clienteLimpo.endereco && Object.keys(clienteLimpo.endereco).length > 0) { 
            endereco = { ...endereco, ...clienteLimpo.endereco }; 
        }
        
        // --- CORREÇÃO AQUI ---
        // 1. Verifica se já veio com 'source' definido (ex: 'salao' vindo da TelaPedidos)
        // 2. Se não tiver, tenta adivinhar pelo número da mesa
        let source = pedidoData.source;
        if (!source) {
             source = (pedidoData.mesaNumero && Number(pedidoData.mesaNumero) > 0) ? 'salao' : 'global';
        }

        // Define o tipo visual
        const tipo = pedidoData.tipo || (source === 'salao' ? 'salao' : 'delivery');

        return {
            ...pedidoData, 
            id: pedidoData.id, 
            cliente: clienteLimpo, 
            endereco: endereco, 
            source: source, // Usa a fonte definida corretamente
            tipo: tipo,
            status: pedidoData.status || 'recebido', 
            itens: pedidoData.itens || [],
            mesaNumero: pedidoData.mesaNumero || 0, 
            loteHorario: pedidoData.loteHorario || ''
        };
    }, [limparDadosCliente]);

    useEffect(() => {
        if (!estabelecimentoAtivo) return;
        const qMotoboys = query(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'entregadores'));
        const unsubscribe = onSnapshot(qMotoboys, (snapshot) => { setMotoboys(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); });
        return () => unsubscribe();
    }, [estabelecimentoAtivo]);

    const handleAtribuirMotoboy = useCallback(async (pedidoId, motoboyId, motoboyNome, source) => {
        if (!pedidoId || !motoboyId) return toast.error("Dados inválidos");
        try {
            // Agora tudo fica dentro de 'estabelecimentos'
            const path = `estabelecimentos/${estabelecimentoAtivo}/pedidos/${pedidoId}`;
            await updateDoc(doc(db, path), { motoboyId, motoboyNome, status: 'em_entrega', atualizadoEm: serverTimestamp(), dataEntrega: serverTimestamp() });
            toast.success(`🚀 ${motoboyNome} atribuído!`);
        } catch (error) { toast.error("Falha na atribuição"); }
    }, [estabelecimentoAtivo]);

    const handleExcluirPedido = useCallback(async (pedidoId, source) => {
        if (!window.confirm("Tem certeza que deseja cancelar este pedido?")) return;
        try {
            const path = `estabelecimentos/${estabelecimentoAtivo}/pedidos/${pedidoId}`;
            await deleteDoc(doc(db, path));
            toast.success("Pedido cancelado.");
        } catch (error) { toast.error("Erro ao cancelar."); }
    }, [estabelecimentoAtivo]);

    const handleUpdateStatusAndNotify = useCallback(async (pedidoId, newStatus) => {
        if (isUpdatingRef.current || bloqueioAtualizacao.has(pedidoId)) return;
        try {
            isUpdatingRef.current = true;
            setBloqueioAtualizacao(prev => new Set(prev).add(pedidoId));
            
            const allPedidos = Object.values(pedidos).flat();
            const pedidoAlvo = allPedidos.find(p => p.id === pedidoId);
            if (!pedidoAlvo) throw new Error("Pedido não localizado");
            
            const path = `estabelecimentos/${estabelecimentoAtivo}/pedidos/${pedidoId}`;
            const updatePayload = { status: newStatus, atualizadoEm: serverTimestamp() };
            
            if (newStatus === 'preparo') updatePayload.dataPreparo = serverTimestamp();
            else if (newStatus === 'em_entrega') updatePayload.dataEntrega = serverTimestamp();
            else if (newStatus === 'pronto_para_servir') updatePayload.dataPronto = serverTimestamp();
            else if (newStatus === 'finalizado') updatePayload.dataFinalizado = serverTimestamp();
            
            await updateDoc(doc(db, path), updatePayload);
            toast.success(`Status atualizado!`);
        } catch (error) { toast.error("Erro ao mover pedido."); } 
        finally { setTimeout(() => { isUpdatingRef.current = false; setBloqueioAtualizacao(prev => { const novo = new Set(prev); novo.delete(pedidoId); return novo; }); }, 500); }
    }, [pedidos, estabelecimentoAtivo, bloqueioAtualizacao]);

    // ==========================================
    // 🔥 LISTENER UNIFICADO (CORRIGIDO)
    // ==========================================
    useEffect(() => {
        if (authLoading || !estabelecimentoAtivo) return;
        
        const startOfToday = new Date(); 
        startOfToday.setHours(0,0,0,0);
        
        const isToday = (timestamp) => { 
            if (!timestamp) return true; 
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000 || timestamp); 
            return date >= startOfToday; 
        };

        const checkAutoPrint = (change) => {
            const data = change.doc.data();
            const status = data.status || 'recebido';
            if ((change.type === 'added' || change.type === 'modified') && status === 'recebido') {
                setPrintQueue(prev => prev.includes(change.doc.id) ? prev : [...prev, change.doc.id]);
            }
        };

        const unsubscribers = [];
        getDoc(doc(db, 'estabelecimentos', estabelecimentoAtivo)).then(snap => { if (snap.exists()) setEstabelecimentoInfo(snap.data()); });

        let isFirstRun = true;
        
// 🔥 Agora escutamos APENAS a coleção de pedidos do estabelecimento
const qPedidos = query(
    collection(db, 'estabelecimentos', estabelecimentoAtivo, 'pedidos'), 
    orderBy('createdAt', 'asc') // Garante ordem de chegada
);
        unsubscribers.push(onSnapshot(qPedidos, (snapshot) => {
            if (!isFirstRun) {
                snapshot.docChanges().forEach(checkAutoPrint);
            }
            
            const listaTodos = snapshot.docs
                .map(d => processarDadosPedido({ id: d.id, ...d.data() }))
                .filter(p => p && isToday(p.dataPedido || p.createdAt));
            
            // Corrige status pendente visualmente
            listaTodos.forEach(p => { if (['pendente', 'aguardando_pagamento'].includes(p.status)) p.status = 'recebido'; });
            
            setPedidos(prev => ({ ...prev, 
                recebido: listaTodos.filter(p => p.status === 'recebido'),
                preparo: listaTodos.filter(p => p.status === 'preparo'),
                em_entrega: listaTodos.filter(p => p.status === 'em_entrega'), // Delivery
                pronto_para_servir: listaTodos.filter(p => p.status === 'pronto_para_servir'), // Salão
                finalizado: listaTodos.filter(p => p.status === 'finalizado')
            }));
            
            setLoading(false);
            isFirstRun = false;
        }));
        
        return () => unsubscribers.forEach(u => u());
    }, [estabelecimentoAtivo, authLoading, processarDadosPedido]);

    useEffect(() => {
        const novosRecebidos = pedidos.recebido;
        if (novosRecebidos.length > prevRecebidosRef.current.length) {
            const idsAtuais = new Set(prevRecebidosRef.current.map(p => p.id));
            const realmenteNovos = novosRecebidos.filter(p => !idsAtuais.has(p.id));
            if (realmenteNovos.length > 0) {
                const novosIds = realmenteNovos.map(p => p.id);
                setNewOrderIds(prev => new Set([...prev, ...novosIds]));
                if (notificationsEnabled && userInteracted) audioRef.current?.play().catch(e => console.warn("Audio error", e));
                setTimeout(() => setNewOrderIds(prev => { const next = new Set(prev); novosIds.forEach(id => next.delete(id)); return next; }), 15000);
            }
        }
        prevRecebidosRef.current = novosRecebidos;
    }, [pedidos.recebido, notificationsEnabled, userInteracted]);

    useEffect(() => {
        if (!isPrinting && printQueue.length > 0 && estabelecimentoAtivo) {
            setIsPrinting(true);
            setUrlImpressao(`/imprimir-comanda/${printQueue[0]}?estabId=${estabelecimentoAtivo}`);
        }
    }, [printQueue, isPrinting, estabelecimentoAtivo]);

    const handleIframeLoad = () => {
        setTimeout(() => {
            setUrlImpressao(null);
            setPrintQueue(prev => prev.slice(1)); 
            setIsPrinting(false); 
        }, 15000); 
    };

    const colunasAtivas = useMemo(() => abaAtiva === 'cozinha' ? ['recebido', 'preparo', 'pronto_para_servir', 'finalizado'] : ['recebido', 'preparo', 'em_entrega', 'finalizado'], [abaAtiva]);
    const STATUS_UI = { recebido: { title: '📥 Novos', color: 'border-l-red-500', bg: 'bg-red-500' }, preparo: { title: '🔥 Preparo', color: 'border-l-orange-500', bg: 'bg-orange-500' }, em_entrega: { title: '🛵 Entrega', color: 'border-l-blue-500', bg: 'bg-blue-500' }, pronto_para_servir: { title: '✅ Pronto (Mesa)', color: 'border-l-green-500', bg: 'bg-green-500' }, finalizado: { title: '🏁 Concluído', color: 'border-l-gray-500', bg: 'bg-gray-500' } };

    if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div></div>;
    if (!estabelecimentoAtivo) return <div className="p-10 text-center">Sem estabelecimento selecionado.</div>;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <audio ref={audioRef} src="/campainha.mp3" preload="auto" />
            <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-30 px-4 py-3">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <button onClick={() => navigate('/admin-dashboard')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"><IoArrowBack size={20} /></button>
                        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">Painel de Pedidos <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">{dataHojeFormatada}</span></h1>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button onClick={() => setAbaAtiva('delivery')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${abaAtiva === 'delivery' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><IoBicycle /> Delivery</button>
                            <button onClick={() => setAbaAtiva('cozinha')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${abaAtiva === 'cozinha' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><IoRestaurant /> Cozinha</button>
                        </div>
                        <button onClick={() => { setNotificationsEnabled(!notificationsEnabled); setUserInteracted(true); toast.info(notificationsEnabled ? "Som desativado" : "Som ativado"); }} className={`px-4 py-2 rounded-lg font-bold text-sm border ${notificationsEnabled ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>{notificationsEnabled ? '🔔 Som ON' : '🔕 Som OFF'}</button>
                    </div>
                </div>
            </header>
            <main className="flex-1 p-4 overflow-x-auto">
                <div className="flex flex-col md:flex-row gap-4 min-w-full md:min-w-0 h-full">
                    {colunasAtivas.map(statusKey => {
                        const config = STATUS_UI[statusKey];
                        // 🔥 FILTRO INTELIGENTE DE ABA:
                        // Se estiver na aba 'cozinha', mostra source='salao'
                        // Se estiver na aba 'delivery', mostra source='global'
                        let listaPedidos = (pedidos[statusKey] || []).filter(p => abaAtiva === 'cozinha' ? p.source === 'salao' : p.source === 'global');
                        
                        if (statusKey === 'finalizado') listaPedidos = [...listaPedidos].sort((a, b) => (b.dataFinalizado?.seconds || 0) - (a.dataFinalizado?.seconds || 0));
                        return (
                            <div key={statusKey} className={`flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 min-h-[500px] md:h-[calc(100vh-140px)] border-t-4 ${config.color.replace('border-l-', 'border-t-')}`}>
                                <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl"><h3 className="font-bold text-gray-700 uppercase text-sm">{config.title}</h3><span className={`${config.bg} text-white text-xs font-bold px-2 py-1 rounded-full`}>{listaPedidos.length}</span></div>
                                <div className="flex-1 p-2 overflow-y-auto custom-scrollbar bg-gray-50/30">
                                    {listaPedidos.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-gray-300"><div className="text-2xl mb-1">🍃</div><span className="text-sm">Vazio</span></div> : 
                                    (abaAtiva === 'cozinha' ? <GrupoPedidosMesa pedidos={listaPedidos} onUpdateStatus={handleUpdateStatusAndNotify} onExcluir={handleExcluirPedido} newOrderIds={newOrderIds} estabelecimentoInfo={estabelecimentoInfo} /> : 
                                    <div className="space-y-3">{listaPedidos.map(pedido => <PedidoCard key={pedido.id} item={pedido} onUpdateStatus={handleUpdateStatusAndNotify} onExcluir={handleExcluirPedido} newOrderIds={newOrderIds} estabelecimentoInfo={estabelecimentoInfo} motoboysDisponiveis={motoboys} onAtribuirMotoboy={(pid, mid, mnome) => handleAtribuirMotoboy(pid, mid, mnome, pedido.source)} />)}</div>)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>
            {urlImpressao && (
                <iframe 
                    src={urlImpressao}
                    onLoad={handleIframeLoad}
                    style={{ 
                        position: 'fixed', 
                        left: '-9999px', 
                        top: 0, 
                        width: '500px', 
                        height: '500px', 
                        border: 'none', 
                    }}
                    title="iframe-impressao-auto"
                />
            )}
        </div>
    );
}
export default withEstablishmentAuth(Painel);