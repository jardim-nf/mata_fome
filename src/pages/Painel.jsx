import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import PedidoCard from "../components/PedidoCard";
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { IoTime, IoArrowBack, IoRestaurant, IoBicycle, IoCalendarOutline, IoNotificationsOutline, IoNotificationsOffOutline, IoPrint } from "react-icons/io5";

// --- FUNÇÃO ANTI-TRAVAMENTO PARA CORTAR BEBIDAS E BOMBONIERE ---
const isItemCozinha = (item) => {
    try {
        if (!item || typeof item !== 'object') return false;
        
        const nome = String(item.nome || item.produto?.nome || '').toLowerCase();
        const categoria = String(item.categoria || item.produto?.categoria || '').toLowerCase();
        const textoCompleto = `${nome} ${categoria}`;
        
        const categoriasBloqueadas = ['bebida', 'bomboniere', 'bar', 'sobremesa', 'doces', 'doce'];
        const temCategoriaBloqueada = categoriasBloqueadas.some(cat => categoria.includes(cat));
        if (temCategoriaBloqueada) return false;

        const palavrasBloqueadas = [
            'refrigerante', 'suco', 'cerveja', 'long neck', 'drink', 'vinho', 
            'coca', 'guarana', 'pepsi', 'sprite', 'h2oh', 'agua mineral', 'água mineral',
            'sorvete', 'bala ', 'chiclete', 'chocolate', 'pirulito', ' Halls', 'Mentos'
        ];
        
        const temNomeBloqueado = palavrasBloqueadas.some(palavra => textoCompleto.includes(palavra));
        if (temNomeBloqueado) return false;
        
        return true; 
    } catch (error) {
        return true; 
    }
};

// --- GRUPO DE PEDIDOS DA MESA ---
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
            grupos[chave].totalItens += (pedido.itens || []).length;
        });
        return Object.values(grupos);
    }, [pedidos]);

    if (pedidosAgrupados.length === 0) return (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 opacity-60">
            <IoRestaurant className="text-5xl mb-3 text-slate-300" />
            <p className="font-medium">Sem pedidos de cozinha</p>
        </div>
    );

    return (
        <div className="space-y-4">
            {pedidosAgrupados.map((grupo, index) => (
                <div key={`grupo-${grupo.mesaNumero}-${index}`} className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="bg-slate-50/50 p-3 border-b border-slate-200/60 border-dashed flex flex-wrap justify-between items-center gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black text-slate-800 text-base flex items-center gap-2">
                                <span className="w-7 h-7 shrink-0 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm">
                                    <IoRestaurant />
                                </span>
                                Mesa {grupo.mesaNumero}
                            </span>
                            {grupo.loteHorario && (
                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full flex items-center gap-1 font-mono font-medium shrink-0">
                                    <IoTime className="w-3.5 h-3.5" /> {grupo.loteHorario}
                                </span>
                            )}
                        </div>
                        <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200/60 shrink-0">
                            {grupo.totalItens} itens
                        </span>
                    </div>
                    <div className="p-3 space-y-3 bg-white">
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

    const [dataSelecionada, setDataSelecionada] = useState(() => {
        const hj = new Date();
        return hj.getFullYear() + '-' + String(hj.getMonth() + 1).padStart(2, '0') + '-' + String(hj.getDate()).padStart(2, '0');
    });

    const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
    const [pedidos, setPedidos] = useState({ recebido: [], preparo: [], em_entrega: [], pronto_para_servir: [], finalizado: [] });
    const [loading, setLoading] = useState(true);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [userInteracted, setUserInteracted] = useState(false);
    const [newOrderIds, setNewOrderIds] = useState(new Set());
    const [abaAtiva, setAbaAtiva] = useState('delivery');
    const [motoboys, setMotoboys] = useState([]);
    const [bloqueioAtualizacao, setBloqueioAtualizacao] = useState(new Set());

    const [printQueue, setPrintQueue] = useState([]);
    const [isPrinting, setIsPrinting] = useState(false);

    // 🔥 ESTADO DE CONFIGURAÇÃO DE IMPRESSÃO (TUDO, COZINHA, DESLIGADO)
    const [modoImpressao, setModoImpressaoState] = useState(() => {
        const salvo = localStorage.getItem('config_modo_impressao_painel');
        return salvo || 'tudo'; 
    });
    const modoImpressaoRef = useRef(modoImpressao); 

    const alternarModoImpressao = () => {
        let novoModo = 'tudo';
        if (modoImpressao === 'tudo') novoModo = 'cozinha';
        else if (modoImpressao === 'cozinha') novoModo = 'desligado';
        
        setModoImpressaoState(novoModo);
        modoImpressaoRef.current = novoModo;
        localStorage.setItem('config_modo_impressao_painel', novoModo);
        
        if (novoModo === 'tudo') toast.info("🖨️ Auto-Print: Imprimindo TODOS os pedidos", { autoClose: 2000 });
        else if (novoModo === 'cozinha') toast.info("🍳 Auto-Print: Só pedidos da COZINHA", { autoClose: 2000 });
        else toast.warning("❌ Auto-Print: DESATIVADO", { autoClose: 2000 });
    };

    const isUpdatingRef = useRef(false);
    const prevRecebidosRef = useRef([]);
    const pedidosJaImpressos = useRef(new Set());

    const estabelecimentoAtivo = useMemo(() => estabelecimentosGerenciados?.[0] || null, [estabelecimentosGerenciados]);

    useEffect(() => {
        setPedidos({ recebido: [], preparo: [], em_entrega: [], pronto_para_servir: [], finalizado: [] });
        setMotoboys([]);
        setNewOrderIds(new Set());
        setPrintQueue([]);
        setEstabelecimentoInfo(null);
        setLoading(true);
    }, [estabelecimentoAtivo, dataSelecionada]);

    const limparDadosCliente = useCallback((clienteData) => {
        if (!clienteData || typeof clienteData !== 'object') return { nome: 'Cliente', telefone: '', endereco: {} };
        if ('_methodName' in clienteData || 'toDate' in clienteData) return { nome: 'Cliente', telefone: '', endereco: {} };
        return { nome: clienteData.nome || 'Cliente', telefone: clienteData.telefone || '', endereco: (clienteData.endereco && typeof clienteData.endereco === 'object') ? clienteData.endereco : {} };
    }, []);

    // 🔥 A CORREÇÃO PRINCIPAL ESTÁ AQUI 🔥
    const processarDadosPedido = useCallback((pedidoData) => {
        if (!pedidoData || !pedidoData.id) return null;
        
        const rawItens = Array.isArray(pedidoData.itens) ? pedidoData.itens : [];
        const itensFiltradosParaCozinha = rawItens.filter(isItemCozinha);

        const clienteLimpo = limparDadosCliente(pedidoData.cliente);
        let endereco = pedidoData.endereco || {};
        if (clienteLimpo.endereco && Object.keys(clienteLimpo.endereco).length > 0) {
            endereco = { ...endereco, ...clienteLimpo.endereco };
        }
        
        let source = pedidoData.source;
        let tipo = pedidoData.tipo;
        
        // Verifica se tem alguma mesa informada (Mesmo que seja texto, tipo "S1")
        const temMesa = pedidoData.mesaNumero && String(pedidoData.mesaNumero).trim() !== '' && String(pedidoData.mesaNumero) !== '0';
        
        // Força a origem e o tipo CORRETOS para que o PedidoCard não desenhe "Delivery"
        if (source === 'salao' || temMesa) {
            source = 'salao';
            tipo = 'mesa';
        } else {
            if (!source) source = 'global';
            if (!tipo) tipo = 'delivery';
        }

        return {
            ...pedidoData,
            id: pedidoData.id,
            cliente: clienteLimpo,
            endereco: endereco,
            source: source,
            tipo: tipo, // Garante que o PedidoCard vai receber que é uma "mesa"
            status: pedidoData.status || 'recebido',
            itens: rawItens, 
            itensCozinha: itensFiltradosParaCozinha, 
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

    const handleAtribuirMotoboy = useCallback(async (pedidoId, motoboyId, motoboyNome) => {
        if (!pedidoId || !motoboyId) return toast.error("Dados inválidos");
        try {
            const path = `estabelecimentos/${estabelecimentoAtivo}/pedidos/${pedidoId}`;
            await updateDoc(doc(db, path), { motoboyId, motoboyNome, status: 'em_entrega', atualizadoEm: serverTimestamp(), dataEntrega: serverTimestamp() });
            toast.success(`🚀 ${motoboyNome} atribuído!`);
        } catch (error) { toast.error("Falha na atribuição"); }
    }, [estabelecimentoAtivo]);

    const handleExcluirPedido = useCallback(async (pedidoId) => {
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

    useEffect(() => {
        if (authLoading || !estabelecimentoAtivo) return;

        const [ano, mes, dia] = dataSelecionada.split('-').map(Number);
        const startOfDay = new Date(ano, mes - 1, dia, 0, 0, 0, 0);
        const endOfDay = new Date(ano, mes - 1, dia, 23, 59, 59, 999);

        const dataHojeStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
        const visualizandoHoje = dataSelecionada === dataHojeStr;

        const isSelectedDate = (timestamp) => {
            if (!timestamp) return false;
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000 || timestamp);
            return date >= startOfDay && date <= endOfDay;
        };

        const checkAutoPrint = (change) => {
            if (!visualizandoHoje) return;
            const data = change.doc.data();
            const status = data.status || 'recebido';
            const pedidoId = change.doc.id;

            const configAtual = modoImpressaoRef.current;
            if (configAtual === 'desligado') return;

            if (configAtual === 'cozinha') {
                const rawItens = Array.isArray(data.itens) ? data.itens : [];
                const itensCozinha = rawItens.filter(isItemCozinha);
                if (itensCozinha.length === 0) return; 
            }

            if ((change.type === 'added' || change.type === 'modified') && status === 'recebido') {
                const impressosLocal = JSON.parse(localStorage.getItem('historico_impresso') || '[]');
                if (!pedidosJaImpressos.current.has(pedidoId) && !impressosLocal.includes(pedidoId)) {
                    pedidosJaImpressos.current.add(pedidoId);
                    impressosLocal.push(pedidoId);
                    if (impressosLocal.length > 50) impressosLocal.shift();
                    localStorage.setItem('historico_impresso', JSON.stringify(impressosLocal));
                    setPrintQueue(prev => prev.includes(pedidoId) ? prev : [...prev, pedidoId]);
                }
            }
        };

        const unsubscribers = [];
        getDoc(doc(db, 'estabelecimentos', estabelecimentoAtivo)).then(snap => { if (snap.exists()) setEstabelecimentoInfo(snap.data()); });

        let isFirstRun = true;
        const qPedidos = query(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'pedidos'), orderBy('createdAt', 'asc'));

        unsubscribers.push(onSnapshot(qPedidos, (snapshot) => {
            if (!isFirstRun) snapshot.docChanges().forEach(checkAutoPrint);

            const listaTodos = snapshot.docs
                .map(d => processarDadosPedido({ id: d.id, ...d.data() }))
                .filter(p => p !== null && isSelectedDate(p.dataPedido || p.createdAt));

            listaTodos.forEach(p => { if (['pendente', 'aguardando_pagamento'].includes(p.status)) p.status = 'recebido'; });

            setPedidos(prev => ({
                ...prev,
                recebido: listaTodos.filter(p => p.status === 'recebido'),
                preparo: listaTodos.filter(p => p.status === 'preparo'),
                em_entrega: listaTodos.filter(p => p.status === 'em_entrega'),
                pronto_para_servir: listaTodos.filter(p => p.status === 'pronto_para_servir'),
                finalizado: listaTodos.filter(p => p.status === 'finalizado')
            }));

            setLoading(false);
            isFirstRun = false;
        }));

        return () => unsubscribers.forEach(u => u());
    }, [estabelecimentoAtivo, authLoading, processarDadosPedido, dataSelecionada]);

    useEffect(() => {
        const dataHojeStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
        if (dataSelecionada !== dataHojeStr) return;

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
    }, [pedidos.recebido, notificationsEnabled, userInteracted, dataSelecionada]);

    useEffect(() => {
        if (!isPrinting && printQueue.length > 0 && estabelecimentoAtivo) {
            setIsPrinting(true);
            const pedidoId = printQueue[0];
            
            const setorQuery = modoImpressao === 'cozinha' ? '&setor=cozinha' : '';
            const url = `/comanda/${pedidoId}?estabId=${estabelecimentoAtivo}${setorQuery}`;
            
            const width = 350; const height = 600;
            const left = (window.screen.width - width) / 2; const top = (window.screen.height - height) / 2;
            const printWindow = window.open(url, `AutoPrint_${pedidoId}`, `width=${width},height=${height},top=${top},left=${left},scrollbars=yes`);

            if (printWindow) {
                const timer = setInterval(() => {
                    if (printWindow.closed) {
                        clearInterval(timer);
                        setPrintQueue(prev => prev.filter(id => id !== pedidoId));
                        setIsPrinting(false);
                    }
                }, 500);
            } else {
                toast.warning("⚠️ Pop-up bloqueado! Permita os pop-ups no navegador para imprimir sozinho.");
                setTimeout(() => {
                    setPrintQueue(prev => prev.filter(id => id !== pedidoId));
                    setIsPrinting(false);
                }, 2000);
            }
        }
    }, [printQueue, isPrinting, estabelecimentoAtivo, modoImpressao]);

    const colunasAtivas = useMemo(() => abaAtiva === 'cozinha' ? ['recebido', 'preparo', 'pronto_para_servir', 'finalizado'] : ['recebido', 'preparo', 'em_entrega', 'finalizado'], [abaAtiva]);

    const STATUS_UI = {
        recebido: { title: 'Novos', icon: '📥', dot: 'bg-rose-500', bgBadge: 'bg-rose-100', textBadge: 'text-rose-700' },
        preparo: { title: 'Em Preparo', icon: '🔥', dot: 'bg-amber-500', bgBadge: 'bg-amber-100', textBadge: 'text-amber-700' },
        em_entrega: { title: 'Em Entrega', icon: '🛵', dot: 'bg-blue-500', bgBadge: 'bg-blue-100', textBadge: 'text-blue-700' },
        pronto_para_servir: { title: 'Pronto (Mesa)', icon: '✅', dot: 'bg-emerald-500', bgBadge: 'bg-emerald-100', textBadge: 'text-emerald-700' },
        finalizado: { title: 'Concluídos', icon: '🏁', dot: 'bg-slate-400', bgBadge: 'bg-slate-200', textBadge: 'text-slate-700' }
    };

    if (loading) return <div className="flex items-center justify-center min-h-screen bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
    if (!estabelecimentoAtivo) return <div className="p-10 text-center font-medium text-slate-500">Sem estabelecimento selecionado.</div>;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <audio ref={audioRef} src="/campainha.mp3" preload="auto" />

            <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-200 sticky top-0 z-30 px-4 py-3 md:py-4">
                <div className="w-full px-2 mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <button onClick={() => navigate('/admin-dashboard')} className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors">
                            <IoArrowBack size={20} />
                        </button>
                        <div>
                            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Monitor de Pedidos</h1>
                            <p className="text-xs font-medium text-slate-500">Acompanhamento em tempo real</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3 w-full md:w-auto">
                        
                        <button
                            onClick={alternarModoImpressao}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border font-bold text-xs transition-all shadow-sm
                                ${modoImpressao === 'tudo' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                                  modoImpressao === 'cozinha' ? 'bg-orange-50 text-orange-700 border-orange-200' : 
                                  'bg-gray-100 text-gray-500 border-gray-300 opacity-80'}`}
                            title="Clique para mudar o que imprime automaticamente"
                        >
                            {modoImpressao === 'tudo' && <><IoPrint size={18} className="text-blue-500" /><span className="hidden sm:inline">Auto: TUDO</span></>}
                            {modoImpressao === 'cozinha' && <><IoPrint size={18} className="text-orange-500" /><span className="hidden sm:inline">Auto: COZINHA</span></>}
                            {modoImpressao === 'desligado' && <><IoPrint size={18} className="text-gray-400" /><span className="hidden sm:inline">Auto: DESLIGADO</span></>}
                        </button>

                        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner border border-slate-200/50">
                            <button onClick={() => setAbaAtiva('delivery')} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${abaAtiva === 'delivery' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}>
                                <IoBicycle className="text-lg" /> Delivery
                            </button>
                            <button onClick={() => setAbaAtiva('cozinha')} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${abaAtiva === 'cozinha' ? 'bg-white text-emerald-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}>
                                <IoRestaurant className="text-lg" /> Salão/Mesa
                            </button>
                        </div>

                        <div className="relative group">
                            <IoCalendarOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors pointer-events-none" />
                            <input
                                type="date"
                                value={dataSelecionada}
                                onChange={(e) => setDataSelecionada(e.target.value)}
                                className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 hover:border-slate-300 cursor-pointer shadow-sm transition-all"
                                title="Filtrar por data"
                            />
                        </div>

                        <button
                            onClick={() => { setNotificationsEnabled(!notificationsEnabled); setUserInteracted(true); toast.info(notificationsEnabled ? "Som desativado" : "Som ativado"); }}
                            className={`p-2.5 rounded-xl border transition-all ${notificationsEnabled ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                            title="Ativar/Desativar Som"
                        >
                            {notificationsEnabled ? <IoNotificationsOutline size={20} /> : <IoNotificationsOffOutline size={20} />}
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-4 md:p-6 overflow-x-auto bg-slate-50">
                <div className="flex gap-4 md:gap-5 h-full min-w-full w-max pb-4">
                    {colunasAtivas.map(statusKey => {
                        const config = STATUS_UI[statusKey];
                        let listaPedidos = (pedidos[statusKey] || []).filter(p => 
                            abaAtiva === 'cozinha' ? p.source === 'salao' : p.source === 'global'
                        );
                        if (abaAtiva === 'cozinha') {
                            listaPedidos = listaPedidos.filter(p => p.itensCozinha.length > 0);
                        }
                        if (statusKey === 'finalizado') listaPedidos = [...listaPedidos].sort((a, b) => (b.dataFinalizado?.seconds || 0) - (a.dataFinalizado?.seconds || 0));

                        return (
                            <div key={statusKey} className="flex-1 shrink-0 min-w-[320px] flex flex-col bg-slate-100/50 rounded-2xl md:rounded-3xl border border-slate-200/80 min-h-[500px] md:h-[calc(100vh-140px)] overflow-hidden shadow-sm">
                                
                                <div className="px-5 py-4 border-b border-slate-200/80 flex justify-between items-center bg-white/40 backdrop-blur-sm">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-2.5 h-2.5 rounded-full ${config.dot}`}></div>
                                        <h3 className="font-bold text-slate-800 tracking-tight text-[15px]">{config.title}</h3>
                                    </div>
                                    <span className={`${config.bgBadge} ${config.textBadge} text-xs font-black px-2.5 py-1 rounded-full`}>
                                        {listaPedidos.length}
                                    </span>
                                </div>

                                <div className="flex-1 p-3 overflow-y-auto custom-scrollbar">
                                    {listaPedidos.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                            <div className="text-4xl mb-2 grayscale opacity-50">{config.icon}</div>
                                            <span className="text-sm font-medium">Nenhum pedido</span>
                                        </div>
                                    ) : (
                                        abaAtiva === 'cozinha' ? (
                                            <GrupoPedidosMesa pedidos={listaPedidos} onUpdateStatus={handleUpdateStatusAndNotify} onExcluir={handleExcluirPedido} newOrderIds={newOrderIds} estabelecimentoInfo={estabelecimentoInfo} />
                                        ) : (
                                            <div className="space-y-3">
                                                {listaPedidos.map(pedido => (
                                                    <PedidoCard key={pedido.id} item={pedido} onUpdateStatus={handleUpdateStatusAndNotify} onExcluir={handleExcluirPedido} newOrderIds={newOrderIds} estabelecimentoInfo={estabelecimentoInfo} motoboysDisponiveis={motoboys} onAtribuirMotoboy={(pid, mid, mnome) => handleAtribuirMotoboy(pid, mid, mnome, pedido.source)} />
                                                ))}
                                            </div>
                                        )
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
