// src/pages/Painel.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import PedidoCard from "../components/PedidoCard";
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { IoTime, IoArrowBack, IoRestaurant, IoBicycle, IoCalendarOutline, IoNotificationsOutline, IoNotificationsOffOutline, IoPrint, IoReceiptOutline, IoWalletOutline, IoCartOutline } from "react-icons/io5";

// IMPORTANDO NOSSO NOVO SERVIÇO DO QZ TRAY
import { rotearEImprimir } from '../services/printService';

// 🔥 IMPORTS PARA O FISCAL (NFC-e) 🔥
import { vendaService } from '../services/vendaService';
import { ModalRecibo, ModalHistorico } from '../components/PdvModals';

// --- FUNÇÃO ANTI-TRAVAMENTO PARA CORTAR BEBIDAS E BOMBONIERE ---
const isItemCozinha = (item) => {
    try {
        if (!item || typeof item !== 'object') return false;
        
        const nome = String(item.nome || item.produto?.nome || '').toLowerCase();
        const categoria = String(item.categoria || item.produto?.categoria || '').toLowerCase();
        const textoCompleto = `${nome} ${categoria}`;
        
        // 🔥 LÓGICA ATUALIZADA: Regra de exceção para COMBOS 🔥
        // Se a categoria for combo ou o nome tiver combo, VAI PRA COZINHA SEMPRE!
        if (categoria.includes('combo') || nome.includes('combo')) {
            return true;
        }
        
        const categoriasBloqueadas = ['bebida', 'bomboniere', 'bar', 'sobremesa', 'doces', 'doce'];
        const temCategoriaBloqueada = categoriasBloqueadas.some(cat => categoria.includes(cat));
        if (temCategoriaBloqueada) return false;

        const palavrasBloqueadas = [
            'refrigerante', 'suco', 'cerveja', 'long neck', 'drink', 'vinho', 
            'coca', 'guarana', 'pepsi', 'sprite', 'h2oh', 'agua mineral', 'água mineral',
            'sorvete', 'bala ', 'chiclete', 'chocolate', 'pirulito', 'halls', 'mentos'
        ];
        
        const temNomeBloqueado = palavrasBloqueadas.some(palavra => textoCompleto.includes(palavra));
        if (temNomeBloqueado) return false;
        
        return true; 
    } catch (error) {
        return true; 
    }
};

// --- GRUPO DE PEDIDOS DA MESA ---
const GrupoPedidosMesa = ({ pedidos, onUpdateStatus, onExcluir, newOrderIds, estabelecimentoInfo, onEmitirNfce }) => {
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
            grupos[chave].totalItens += (pedido.itensCozinha || pedido.itens || []).length;
        });
        return Object.values(grupos);
    }, [pedidos]);

    if (pedidosAgrupados.length === 0) return (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 opacity-60">
            <IoRestaurant className="text-5xl mb-3 text-slate-300" />
            <p className="font-medium">Sem pedidos da cozinha</p>
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
                            <PedidoCard key={pedido.id} item={pedido} onUpdateStatus={onUpdateStatus} onExcluir={onExcluir} newOrderIds={newOrderIds} estabelecimentoInfo={estabelecimentoInfo} showMesaInfo={false} isAgrupado={true} motoboysDisponiveis={[]} onAtribuirMotoboy={null} onEmitirNfce={onEmitirNfce} />
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
    const [colunaMobile, setColunaMobile] = useState('recebido');
    
    const [motoboys, setMotoboys] = useState([]);
    const [bloqueioAtualizacao, setBloqueioAtualizacao] = useState(new Set());

    // FILA DE IMPRESSÃO
    const [printQueue, setPrintQueue] = useState([]);
    const [isPrinting, setIsPrinting] = useState(false);

    // 🔥 ESTADOS PARA NFC-e / FISCAL 🔥
    const [mostrarRecibo, setMostrarRecibo] = useState(false);
    const [dadosRecibo, setDadosRecibo] = useState(null);
    const [nfceStatus, setNfceStatus] = useState('idle');
    const [nfceUrl, setNfceUrl] = useState(null);
    const [isHistoricoVendasOpen, setIsHistoricoVendasOpen] = useState(false);
    const [vendasHistoricoExibicao, setVendasHistoricoExibicao] = useState([]);
    const [carregandoHistorico, setCarregandoHistorico] = useState(false);

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
        
        const temMesa = pedidoData.mesaNumero && String(pedidoData.mesaNumero).trim() !== '' && String(pedidoData.mesaNumero) !== '0';
        
        if (source === 'salao' || temMesa || tipo === 'mesa') {
            source = 'salao';
            tipo = 'mesa';
        } else {
            if (!source) source = 'delivery';
            if (!tipo) tipo = 'delivery';
        }

        return {
            ...pedidoData,
            id: pedidoData.id,
            cliente: clienteLimpo,
            endereco: endereco,
            source: source,
            tipo: tipo,
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
    }, [estabelecimentoAtivo, bloqueioAtualizacao]);

    // =============================================
    // 🔥 LÓGICA FISCAL NFC-e (MESMO PADRÃO DO CONTROLE DE SALÃO) 🔥
    // =============================================
    const formatarReal = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor || 0);

    const tocarBeepErro = () => { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, ctx.currentTime); gain.gain.setValueAtTime(0.15, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5); osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.5); } catch (e) {} };

    const tocarCampainha = useCallback(() => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const notas = [659.25, 783.99, 1046.50]; // E5, G5, C6
            notas.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
                gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
                gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + i * 0.15 + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime + i * 0.15);
                osc.stop(ctx.currentTime + i * 0.15 + 0.4);
            });
            setTimeout(() => {
                try {
                    const ctx2 = new (window.AudioContext || window.webkitAudioContext)();
                    notas.forEach((freq, i) => {
                        const osc = ctx2.createOscillator();
                        const gain = ctx2.createGain();
                        osc.type = 'sine';
                        osc.frequency.setValueAtTime(freq, ctx2.currentTime + i * 0.12);
                        gain.gain.setValueAtTime(0, ctx2.currentTime + i * 0.12);
                        gain.gain.linearRampToValueAtTime(0.25, ctx2.currentTime + i * 0.12 + 0.02);
                        gain.gain.exponentialRampToValueAtTime(0.001, ctx2.currentTime + i * 0.12 + 0.35);
                        osc.connect(gain);
                        gain.connect(ctx2.destination);
                        osc.start(ctx2.currentTime + i * 0.12);
                        osc.stop(ctx2.currentTime + i * 0.12 + 0.35);
                    });
                } catch (e) {}
            }, 600);
        } catch (e) { console.warn('Web Audio API não suportada'); }
    }, []);

    const abrirHistoricoVendas = useCallback(async () => {
        setIsHistoricoVendasOpen(true);
        setCarregandoHistorico(true);
        try {
            const vendas = await vendaService.buscarVendasPorEstabelecimento(estabelecimentoAtivo, 50);
            setVendasHistoricoExibicao(vendas);
        } catch (error) {
            toast.error("Erro ao buscar histórico.");
        } finally {
            setCarregandoHistorico(false);
        }
    }, [estabelecimentoAtivo]);

    const selecionarVendaHistorico = (venda) => {
        const vendaNormalizada = {
            ...venda,
            itens: venda.itens?.map(item => {
                const precoReal = item.precoUnitario || item.preco || item.valor || item.price || 0;
                const qtdReal = item.quantidade || item.quantity || item.qtd || 1;
                return { ...item, preco: precoReal, precoUnitario: precoReal, valor: precoReal, price: precoReal, quantidade: qtdReal, quantity: qtdReal, nome: item.nome || item.name || 'Item' };
            })
        };
        setDadosRecibo(vendaNormalizada);
        setNfceStatus(vendaNormalizada.fiscal?.status === 'AUTORIZADA' ? 'success' : 'idle');
        setNfceUrl(vendaNormalizada.fiscal?.pdf || null);
        setIsHistoricoVendasOpen(false);
        setMostrarRecibo(true);
    };

    const handleEmitirNfce = async () => {
        if (!dadosRecibo?.id) return; setNfceStatus('loading');
        try {
            const res = await vendaService.emitirNfce(dadosRecibo.id, dadosRecibo.clienteCpf);
            if (res.sucesso || res.success) {
                setDadosRecibo(p => ({ ...p, fiscal: { ...p.fiscal, status: 'PROCESSANDO', idPlugNotas: res.idPlugNotas } }));
                setVendasHistoricoExibicao(p => p.map(v => v.id === dadosRecibo.id ? { ...v, fiscal: { ...v.fiscal, status: 'PROCESSANDO', idPlugNotas: res.idPlugNotas } } : v));
            } else { setNfceStatus('error'); tocarBeepErro(); alert(res.error || "Erro ao solicitar"); }
        } catch (e) { setNfceStatus('error'); tocarBeepErro(); alert('Erro de conexão.'); }
    };

    const handleConsultarStatus = async (venda) => {
        const st = venda.fiscal?.status;
        if (st === 'REJEITADO' || st === 'REJEITADA' || st === 'ERRO') {
            if (!window.confirm("Tentar reenviar para a SEFAZ?")) return;
            setNfceStatus('loading');
            try {
                const res = await vendaService.emitirNfce(venda.id, venda.clienteCpf);
                if (res.sucesso || res.success) {
                    alert("✅ Enviada!");
                    if (dadosRecibo?.id === venda.id) setDadosRecibo(p => ({ ...p, fiscal: { ...p.fiscal, status: 'PROCESSANDO', idPlugNotas: res.idPlugNotas } }));
                    setVendasHistoricoExibicao(p => p.map(v => v.id === venda.id ? { ...v, fiscal: { ...v.fiscal, status: 'PROCESSANDO', idPlugNotas: res.idPlugNotas } } : v));
                } else { setNfceStatus('error'); alert("❌ Erro: " + res.error); }
            } catch (e) { setNfceStatus('error'); alert('Falha ao reenviar.'); }
        } else {
            if (!venda.fiscal?.idPlugNotas) return alert("Sem ID PlugNotas.");
            setNfceStatus('loading');
            try {
                const res = await vendaService.consultarStatusNfce(venda.id, venda.fiscal.idPlugNotas);
                if (res.sucesso) {
                    if (dadosRecibo?.id === venda.id) { setDadosRecibo(p => ({ ...p, fiscal: { ...p.fiscal, status: res.statusAtual, pdf: res.pdf, xml: res.xml, motivoRejeicao: res.mensagem } })); setNfceStatus(res.statusAtual === 'AUTORIZADA' || res.statusAtual === 'CONCLUIDO' ? 'success' : 'idle'); setNfceUrl(res.pdf); }
                    setVendasHistoricoExibicao(p => p.map(v => v.id === venda.id ? { ...v, fiscal: { ...v.fiscal, status: res.statusAtual, pdf: res.pdf, xml: res.xml, motivoRejeicao: res.mensagem } } : v));
                    alert(`Status: ${res.statusAtual}`);
                } else { setNfceStatus('error'); alert("Erro: " + res.error); }
            } catch (e) { setNfceStatus('error'); alert("Falha ao consultar."); }
        }
    };

    const handleCancelarNfce = async (venda) => {
        if (!venda || !venda.id) return;
        const justificativa = prompt("Motivo do cancelamento (mínimo 15 caracteres):");
        if (!justificativa || justificativa.trim().length < 15) { alert("⚠️ O motivo deve ter pelo menos 15 caracteres para ser aceito pela SEFAZ."); return; }
        setNfceStatus('loading');
        try {
            const res = await vendaService.cancelarNfce(venda.id, justificativa.trim());
            if (res.success || res.sucesso) {
                alert("✅ Nota Fiscal cancelada com sucesso!");
                setDadosRecibo(p => ({ ...p, fiscal: { ...p.fiscal, status: 'CANCELADO' } }));
                setVendasHistoricoExibicao(p => p.map(v => v.id === venda.id ? { ...v, fiscal: { ...v.fiscal, status: 'CANCELADO' } } : v));
                setNfceStatus('idle');
            } else { setNfceStatus('error'); tocarBeepErro(); alert("❌ Erro ao cancelar: " + res.error); }
        } catch (e) { setNfceStatus('error'); tocarBeepErro(); alert("Falha de conexão ao tentar cancelar a nota."); }
    };

    const handleBaixarXml = async (venda) => { if (!venda.fiscal?.idPlugNotas) return alert("Sem ID"); try { const res = await vendaService.baixarXmlNfce(venda.fiscal.idPlugNotas, venda.id.slice(-6)); if (!res.success) alert("Erro: " + res.error); } catch (e) {} };
    const handleBaixarPdf = async (venda) => { const id = venda.fiscal?.idPlugNotas; if (!id) return alert("Sem ID"); setNfceStatus('loading'); try { const res = await vendaService.baixarPdfNfce(id, venda.fiscal?.pdf); if (!res.success) alert("Erro: " + res.error); } catch (e) {} finally { if (nfceStatus === 'loading') setNfceStatus('idle'); } };

    const handleEnviarWhatsApp = (venda) => {
        if (!venda.fiscal?.pdf) return alert("⚠️ Link PDF indisponível.");
        let tel = prompt("📱 Número WhatsApp:", venda.clienteTelefone || venda.cliente?.telefone || "");
        if (tel === null) return; tel = tel.replace(/\D/g, '');
        const msg = encodeURIComponent(`Olá! Agradecemos a preferência. 😃\nSua Nota Fiscal de ${formatarReal(venda.total)}:\n${venda.fiscal.pdf}`);
        window.open(tel.length >= 10 ? `https://wa.me/${tel.startsWith('55') ? tel : `55${tel}`}?text=${msg}` : `https://api.whatsapp.com/send?text=${msg}`, '_blank');
    };

    const handleNfceDoPedido = useCallback(async (pedido) => {
        if (!pedido || !pedido.id) return;

        try {
            const vendas = await vendaService.buscarVendasPorEstabelecimento(estabelecimentoAtivo, 100);
            const vendaExistente = vendas.find(v => v.pedidoId === pedido.id || v.id === pedido.vendaId);

            if (vendaExistente) {
                const vendaNormalizada = {
                    ...vendaExistente,
                    itens: vendaExistente.itens?.map(item => {
                        const precoReal = item.precoUnitario || item.preco || item.valor || item.price || 0;
                        const qtdReal = item.quantidade || item.quantity || item.qtd || 1;
                        return { ...item, preco: precoReal, precoUnitario: precoReal, valor: precoReal, price: precoReal, quantidade: qtdReal, quantity: qtdReal, nome: item.nome || item.name || 'Item' };
                    })
                };
                setDadosRecibo(vendaNormalizada);
                setNfceStatus(vendaNormalizada.fiscal?.status === 'AUTORIZADA' ? 'success' : 'idle');
                setNfceUrl(vendaNormalizada.fiscal?.pdf || null);
                setMostrarRecibo(true);
                return;
            }
        } catch (e) {
            console.warn('Não encontrou venda existente, criando a partir do pedido...', e);
        }

        const totalPedido = pedido.totalFinal || pedido.total || pedido.itens?.reduce((acc, it) => {
            const preco = Number(it.preco) || 0;
            const qtd = Number(it.quantidade) || 1;
            const adicionais = it.adicionais ? it.adicionais.reduce((adAcc, ad) => adAcc + (Number(ad.preco) || 0), 0) : 0;
            return acc + ((preco + adicionais) * qtd);
        }, 0) || 0;

        const vendaData = {
            estabelecimentoId: estabelecimentoAtivo,
            pedidoId: pedido.id,
            itens: pedido.itens?.map(item => ({
                nome: item.nome || item.name || 'Item',
                preco: Number(item.preco) || 0,
                precoUnitario: Number(item.preco) || 0,
                quantidade: Number(item.quantidade) || 1,
                adicionais: item.adicionais || [],
                categoria: item.categoria || ''
            })) || [],
            total: totalPedido,
            formaPagamento: pedido.formaPagamento || 'outros',
            clienteNome: pedido.cliente?.nome || 'Cliente',
            clienteTelefone: pedido.cliente?.telefone || '',
            clienteCpf: pedido.clienteCpf || null,
            origem: pedido.source === 'salao' ? 'salao' : 'delivery',
            status: 'finalizada',
            mesaNumero: pedido.mesaNumero || null
        };

        const resultado = await vendaService.salvarVenda(vendaData);

        if (resultado.success) {
            const vendaFinal = {
                ...vendaData,
                id: resultado.vendaId,
                createdAt: new Date()
            };
            setDadosRecibo(vendaFinal);
            setNfceStatus('idle');
            setNfceUrl(null);
            setMostrarRecibo(true);
            toast.success('🧾 Venda registrada! Agora pode emitir a NFC-e.');
        } else {
            toast.error('Erro ao registrar venda: ' + resultado.error);
        }
    }, [estabelecimentoAtivo]);

    useEffect(() => {
        let unsub = () => {};
        if (mostrarRecibo && dadosRecibo?.id) {
            unsub = onSnapshot(doc(db, 'vendas', dadosRecibo.id), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data(); setDadosRecibo(p => ({ ...p, fiscal: data.fiscal }));
                    if (data.fiscal) {
                        const st = data.fiscal.status?.toUpperCase();
                        if (st === 'AUTORIZADA' || st === 'CONCLUIDO') { setNfceStatus('success'); setNfceUrl(data.fiscal.pdf); }
                        else if (st === 'REJEITADO' || st === 'REJEITADA' || st === 'DENEGADO') { setNfceStatus('error'); setNfceUrl(null); }
                        else if (st === 'PROCESSANDO') { setNfceStatus('loading'); }
                        setVendasHistoricoExibicao(p => p.map(v => v.id === dadosRecibo.id ? { ...v, fiscal: data.fiscal } : v));
                    }
                }
            });
        }
        return () => unsub();
    }, [mostrarRecibo, dadosRecibo?.id]);

    useEffect(() => {
        let intervalo;
        if (nfceStatus === 'loading' && dadosRecibo?.fiscal?.idPlugNotas) {
            intervalo = setInterval(async () => {
                try {
                    const res = await vendaService.consultarStatusNfce(dadosRecibo.id, dadosRecibo.fiscal.idPlugNotas);
                    if (res.sucesso && res.statusAtual !== 'PROCESSANDO') {
                        clearInterval(intervalo); const ns = (res.statusAtual === 'AUTORIZADA' || res.statusAtual === 'CONCLUIDO') ? 'success' : 'error';
                        setNfceStatus(ns); if (ns === 'success') setNfceUrl(res.pdf);
                        setDadosRecibo(p => ({...p, fiscal: { ...p.fiscal, status: res.statusAtual, pdf: res.pdf, xml: res.xml, motivoRejeicao: res.mensagem }}));
                        setVendasHistoricoExibicao(p => p.map(v => v.id === dadosRecibo.id ? { ...v, fiscal: { ...v.fiscal, status: res.statusAtual, pdf: res.pdf, xml: res.xml, motivoRejeicao: res.mensagem } } : v));
                        if (ns === 'error') tocarBeepErro();
                    }
                } catch (e) {}
            }, 3000);
        }
        return () => clearInterval(intervalo);
    }, [nfceStatus, dadosRecibo]);

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

            const timestamp = data.createdAt || data.dataPedido || data.criadoEm || data.updatedAt;
            if (timestamp) {
                const dataDoPedido = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000 || timestamp);
                const hoje = new Date();
                
                if (dataDoPedido.getDate() !== hoje.getDate() || dataDoPedido.getMonth() !== hoje.getMonth() || dataDoPedido.getFullYear() !== hoje.getFullYear()) return;
                
                const diffHoras = (hoje - dataDoPedido) / (1000 * 60 * 60);
                if (diffHoras > 3) return;
            }

            const configAtual = modoImpressaoRef.current;
            if (configAtual === 'desligado') return;

            // 🔥 NOVA LÓGICA: Descobre se é delivery
            const isDelivery = data.source !== 'salao' && data.tipo !== 'mesa' && !data.mesaNumero;

            // Se for 'cozinha' E for pedido de MESA, corta as bebidas.
            // Se for DELIVERY, ele pula esse if e manda imprimir TUDO!
            if (configAtual === 'cozinha' && !isDelivery) {
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

                    const pedidoParaImprimir = processarDadosPedido({ id: pedidoId, ...data });
                    if (pedidoParaImprimir) {
                        setPrintQueue(prev => prev.some(p => p.id === pedidoId) ? prev : [...prev, pedidoParaImprimir]);
                    }
                }
            }
        };

        const unsubscribers = [];
        getDoc(doc(db, 'estabelecimentos', estabelecimentoAtivo)).then(snap => { if (snap.exists()) setEstabelecimentoInfo(snap.data()); });

        let isFirstRun = true;
        const qPedidos = query(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'pedidos'), orderBy('createdAt', 'asc'));

        unsubscribers.push(onSnapshot(qPedidos, (snapshot) => {
            if (!isFirstRun) snapshot.docChanges().forEach(checkAutoPrint);

            // 🔥 CORREÇÃO NO FILTRO GERAL: Considerando também datas com "criadoEm" e "updatedAt"
            const listaTodos = snapshot.docs
                .map(d => processarDadosPedido({ id: d.id, ...d.data() }))
                .filter(p => p !== null && isSelectedDate(p.dataPedido || p.createdAt || p.criadoEm || p.updatedAt));

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
                
                if (notificationsEnabled && userInteracted) {
                    
                    const deveTocarCampainha = realmenteNovos.some(p => {
                        const isMesa = p.source === 'salao' || p.tipo === 'mesa';
                        
                        if (isMesa) {
                            if (modoImpressaoRef.current === 'cozinha') {
                                return p.itensCozinha && p.itensCozinha.length > 0;
                            }
                        }
                        
                        return true; 
                    });

                    if (deveTocarCampainha) {
                        audioRef.current?.play().catch(e => console.warn("Erro no som", e));
                    }
                }
                
                setTimeout(() => setNewOrderIds(prev => { const next = new Set(prev); novosIds.forEach(id => next.delete(id)); return next; }), 15000);
            }
        }
        prevRecebidosRef.current = novosRecebidos;
    }, [pedidos.recebido, notificationsEnabled, userInteracted, dataSelecionada]);

    useEffect(() => {
        const processarFilaDeImpressao = async () => {
            if (!isPrinting && printQueue.length > 0 && estabelecimentoInfo) {
                setIsPrinting(true);
                const pedidoParaImprimir = printQueue[0];

                try {
                    const roteamento = estabelecimentoInfo.roteamentoImpressao || {};
                    const impBalcao = estabelecimentoInfo.impressoraBalcao;
                    const impCozinha = estabelecimentoInfo.impressoraCozinha;

                    if (impBalcao || impCozinha) {
                        await rotearEImprimir(pedidoParaImprimir, roteamento, impBalcao, impCozinha);
                    } 
                    else {
                        // 🔥 LÓGICA ATUALIZADA: Se for delivery, deixa o setor vazio para imprimir TUDO 🔥
                        const isDelivery = pedidoParaImprimir.source !== 'salao' && pedidoParaImprimir.tipo !== 'mesa';
                        const setorQuery = (modoImpressao === 'cozinha' && !isDelivery) ? '&setor=cozinha' : '';
                        
                        const url = `/comanda/${pedidoParaImprimir.id}?estabId=${estabelecimentoAtivo}${setorQuery}`;
                        
                        const width = 350; const height = 600;
                        const left = (window.screen.width - width) / 2; const top = (window.screen.height - height) / 2;
                        const printWindow = window.open(url, `AutoPrint_${pedidoParaImprimir.id}`, `width=${width},height=${height},top=${top},left=${left},scrollbars=yes`);

                        if (!printWindow) {
                            toast.warning("⚠️ Pop-up bloqueado! Permita os pop-ups no navegador para imprimir sozinho.");
                            await new Promise(r => setTimeout(r, 2000));
                        } else {
                            await new Promise(resolve => {
                                const timer = setInterval(() => {
                                    if (printWindow.closed) {
                                        clearInterval(timer);
                                        resolve();
                                    }
                                }, 500);
                            });
                        }
                    }
                } catch (error) {
                    console.error("Erro ao imprimir:", error);
                    toast.error("Falha ao imprimir. O QZ Tray está aberto?", { autoClose: 5000 });
                } finally {
                    setPrintQueue(prev => prev.filter(p => p.id !== pedidoParaImprimir.id));
                    setIsPrinting(false);
                }
            }
        };

        processarFilaDeImpressao();
    }, [printQueue, isPrinting, estabelecimentoInfo, modoImpressao, estabelecimentoAtivo]);

    const colunasAtivas = useMemo(() => abaAtiva === 'cozinha' ? ['recebido', 'preparo', 'pronto_para_servir', 'finalizado'] : ['recebido', 'preparo', 'em_entrega', 'finalizado'], [abaAtiva]);

    const STATUS_UI = {
        recebido: { title: 'Novos', icon: '📥', dot: 'bg-rose-500', bgBadge: 'bg-rose-100', textBadge: 'text-rose-700', emptyTitle: 'Tudo certo!', emptyMsg: 'Nenhum pedido novo aguardando' },
        preparo: { title: 'Em Preparo', icon: '🔥', dot: 'bg-amber-500', bgBadge: 'bg-amber-100', textBadge: 'text-amber-700', emptyTitle: 'Cozinha livre', emptyMsg: 'Nenhum pedido em preparo' },
        em_entrega: { title: 'Em Entrega', icon: '🛵', dot: 'bg-blue-500', bgBadge: 'bg-blue-100', textBadge: 'text-blue-700', emptyTitle: 'Sem entregas', emptyMsg: 'Nenhum pedido na rua' },
        pronto_para_servir: { title: 'Pronto (Mesa)', icon: '✅', dot: 'bg-emerald-500', bgBadge: 'bg-emerald-100', textBadge: 'text-emerald-700', emptyTitle: 'Nada pronto', emptyMsg: 'Os pedidos aparecerão aqui quando ficarem prontos' },
        finalizado: { title: 'Concluídos', icon: '🏁', dot: 'bg-slate-400', bgBadge: 'bg-slate-200', textBadge: 'text-slate-700', emptyTitle: 'Sem concluídos', emptyMsg: 'Os pedidos finalizados aparecerão aqui' }
    };

    const statsDoDia = useMemo(() => {
        const todosPedidos = [...(pedidos.recebido || []), ...(pedidos.preparo || []), ...(pedidos.em_entrega || []), ...(pedidos.pronto_para_servir || []), ...(pedidos.finalizado || [])];
        const pedidosFiltrados = todosPedidos.filter(p => {
            if (abaAtiva === 'cozinha') return p.source === 'salao' || p.tipo === 'mesa';
            return p.source !== 'salao' && p.tipo !== 'mesa';
        });
        const total = pedidosFiltrados.reduce((acc, p) => acc + (p.totalFinal || p.total || 0), 0);
        return { quantidade: pedidosFiltrados.length, faturamento: total };
    }, [pedidos, abaAtiva]);

    const formatarMoedaCurta = (valor) => {
        if (valor >= 1000) return `R$ ${(valor / 1000).toFixed(1).replace('.', ',')}k`;
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
    };

    if (loading) return <div className="flex items-center justify-center min-h-screen bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
    if (!estabelecimentoAtivo) return <div className="p-10 text-center font-medium text-slate-500">Sem estabelecimento selecionado.</div>;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <audio ref={audioRef} src="/campainha.mp3" preload="auto" />

            {/* 🔥 MODAIS FISCAIS NFC-e 🔥 */}
            <ModalRecibo 
                visivel={mostrarRecibo} 
                dados={dadosRecibo} 
                onClose={() => setMostrarRecibo(false)} 
                onNovaVenda={() => setMostrarRecibo(false)} 
                onEmitirNfce={handleEmitirNfce} 
                nfceStatus={nfceStatus} 
                nfceUrl={nfceUrl} 
                onBaixarXml={handleBaixarXml} 
                onConsultarStatus={handleConsultarStatus} 
                onBaixarPdf={handleBaixarPdf} 
                onBaixarXmlCancelamento={async (venda) => { try { const res = await vendaService.baixarXmlCancelamentoNfce(venda.fiscal?.idPlugNotas, venda.id.slice(-6)); if (!res.success) alert("Erro: " + res.error); } catch (e) {} }} 
                onEnviarWhatsApp={handleEnviarWhatsApp} 
                onCancelarNfce={handleCancelarNfce} 
            />

            <ModalHistorico 
                visivel={isHistoricoVendasOpen} 
                onClose={() => setIsHistoricoVendasOpen(false)} 
                vendas={vendasHistoricoExibicao} 
                titulo="Histórico de Vendas & NFC-e" 
                onSelecionarVenda={selecionarVendaHistorico} 
                carregando={carregandoHistorico} 
                onConsultarStatus={handleConsultarStatus} 
                onBaixarPdf={handleBaixarPdf} 
                onBaixarXml={handleBaixarXml} 
                onBaixarXmlCancelamento={async (venda) => { try { const res = await vendaService.baixarXmlCancelamentoNfce(venda.fiscal?.idPlugNotas, venda.id.slice(-6)); if (!res.success) alert("Erro: " + res.error); } catch (e) {} }} 
                onEnviarWhatsApp={handleEnviarWhatsApp} 
                onProcessarLote={async () => { toast.info("Acesse a tela principal do PDV para processar lotes."); }}
                onCancelarNfce={handleCancelarNfce}
            />

            <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-200 sticky top-0 z-30 px-3 md:px-4 py-3 md:py-4">
                <div className="w-full mx-auto flex flex-col gap-3">
                    {/* LINHA 1: Voltar + Título + Stats rápidos */}
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <button onClick={() => navigate('/admin-dashboard')} className="p-2 md:p-2.5 rounded-xl hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors shrink-0">
                                <IoArrowBack size={18} />
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-lg md:text-2xl font-black text-slate-800 tracking-tight truncate">Pedidos</h1>
                                <p className="text-[10px] md:text-xs font-medium text-slate-500">Fila de produção em tempo real</p>
                            </div>
                        </div>

                        {/* 🔥 MINI DASHBOARD — visível sempre 🔥 */}
                        <div className="flex items-center gap-2 md:gap-3 shrink-0">
                            <div className="flex items-center gap-1.5 bg-blue-50 px-2.5 md:px-3 py-1.5 md:py-2 rounded-xl border border-blue-100">
                                <IoCartOutline className="text-blue-500 text-sm md:text-base" />
                                <span className="text-xs md:text-sm font-black text-blue-700">{statsDoDia.quantidade}</span>
                                <span className="hidden sm:inline text-[10px] text-blue-500 font-medium">pedidos</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 md:px-3 py-1.5 md:py-2 rounded-xl border border-emerald-100">
                                <IoWalletOutline className="text-emerald-500 text-sm md:text-base" />
                                <span className="text-xs md:text-sm font-black text-emerald-700">{formatarMoedaCurta(statsDoDia.faturamento)}</span>
                            </div>
                        </div>
                    </div>

                    {/* LINHA 2: Controles — scroll horizontal no mobile */}
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                        <button
                            onClick={abrirHistoricoVendas}
                            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border font-bold text-xs transition-all shadow-sm bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 active:scale-95 shrink-0"
                            title="Ver histórico de notas fiscais"
                        >
                            <IoReceiptOutline size={16} className="text-purple-500" />
                            <span className="hidden sm:inline">NFCe</span>
                        </button>

                        <button
                            onClick={alternarModoImpressao}
                            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border font-bold text-xs transition-all shadow-sm shrink-0
                                ${modoImpressao === 'tudo' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                                  modoImpressao === 'cozinha' ? 'bg-orange-50 text-orange-700 border-orange-200' : 
                                  'bg-gray-100 text-gray-500 border-gray-300 opacity-80'}`}
                            title="Clique para mudar o que imprime automaticamente"
                        >
                            <IoPrint size={16} />
                            <span className="hidden sm:inline">{modoImpressao === 'tudo' ? 'Tudo' : modoImpressao === 'cozinha' ? 'Cozinha' : 'Off'}</span>
                        </button>

                        <div className="flex bg-slate-100 p-0.5 rounded-lg shadow-inner border border-slate-200/50 shrink-0">
                            <button onClick={() => setAbaAtiva('delivery')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-300 ${abaAtiva === 'delivery' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
                                <IoBicycle className="text-sm" /> Delivery
                            </button>
                            <button onClick={() => setAbaAtiva('cozinha')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-300 ${abaAtiva === 'cozinha' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>
                                <IoRestaurant className="text-sm" /> Salão
                            </button>
                        </div>

                        <div className="relative group shrink-0">
                            <IoCalendarOutline className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm" />
                            <input
                                type="date"
                                value={dataSelecionada}
                                onChange={(e) => setDataSelecionada(e.target.value)}
                                className="pl-8 pr-3 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 shadow-sm transition-all w-[150px]"
                            />
                        </div>

                        <button
                            onClick={() => { setNotificationsEnabled(!notificationsEnabled); setUserInteracted(true); toast.info(notificationsEnabled ? "Som desativado" : "Som ativado"); }}
                            className={`p-2 rounded-xl border transition-all shrink-0 ${notificationsEnabled ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-slate-400 border-slate-200'}`}
                            title="Ativar/Desativar Som"
                        >
                            {notificationsEnabled ? <IoNotificationsOutline size={16} /> : <IoNotificationsOffOutline size={16} />}
                        </button>
                    </div>
                </div>
            </header>

            {/* 🔥 ABAS DE COLUNAS MOBILE — troca entre colunas no celular 🔥 */}
            <div className="md:hidden flex bg-white border-b border-slate-200 overflow-x-auto no-scrollbar">
                {colunasAtivas.map(statusKey => {
                    const config = STATUS_UI[statusKey];
                    const count = (pedidos[statusKey] || []).filter(p => {
                        if (abaAtiva === 'cozinha') return p.source === 'salao' || p.tipo === 'mesa';
                        return p.source !== 'salao' && p.tipo !== 'mesa';
                    }).length;
                    return (
                        <button
                            key={statusKey}
                            onClick={() => setColunaMobile(statusKey)}
                            className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 py-2.5 px-2 text-center border-b-2 transition-all
                                ${colunaMobile === statusKey 
                                    ? 'border-slate-800 bg-slate-50' 
                                    : 'border-transparent text-slate-400 hover:bg-slate-50'}`}
                        >
                            <div className="flex items-center gap-1">
                                <span className="text-xs">{config.icon}</span>
                                <span className={`text-[10px] font-bold ${colunaMobile === statusKey ? 'text-slate-800' : 'text-slate-400'}`}>{config.title}</span>
                            </div>
                            {count > 0 && (
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${config.bgBadge} ${config.textBadge}`}>{count}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            <main className="flex-1 p-3 md:p-6 overflow-x-auto bg-slate-50">
                <div className="flex gap-4 md:gap-5 h-full md:min-w-full md:w-max pb-4">
                    {colunasAtivas.map(statusKey => {
                        const config = STATUS_UI[statusKey];
                        
                        let listaPedidos = (pedidos[statusKey] || []).filter(p => {
                            if (abaAtiva === 'cozinha') {
                                return p.source === 'salao' || p.tipo === 'mesa';
                            } else {
                                return p.source !== 'salao' && p.tipo !== 'mesa';
                            }
                        });

                        if (abaAtiva === 'cozinha') {
                            listaPedidos = listaPedidos.filter(p => p.itensCozinha && p.itensCozinha.length > 0);
                        }
                        
                        if (statusKey === 'finalizado') listaPedidos = [...listaPedidos].sort((a, b) => (b.dataFinalizado?.seconds || 0) - (a.dataFinalizado?.seconds || 0));

                        // MOBILE: só mostra a coluna selecionada
                        const isMobileVisible = colunaMobile === statusKey;

                        return (
                            <div key={statusKey} className={`flex-1 shrink-0 md:min-w-[300px] flex flex-col bg-slate-100/50 rounded-2xl md:rounded-3xl border border-slate-200/80 min-h-[calc(100vh-240px)] md:h-[calc(100vh-180px)] overflow-hidden shadow-sm ${isMobileVisible ? 'flex' : 'hidden md:flex'}`}>
                                
                                {/* Header da coluna — escondido no mobile (já tem a tab bar) */}
                                <div className="hidden md:flex px-5 py-4 border-b border-slate-200/80 justify-between items-center bg-white/40 backdrop-blur-sm">
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
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                                                <span className="text-3xl">{config.icon}</span>
                                            </div>
                                            <span className="text-sm font-bold text-slate-500">{config.emptyTitle}</span>
                                            <span className="text-xs text-slate-400 mt-1 text-center px-4">{config.emptyMsg}</span>
                                        </div>
                                    ) : (
                                        abaAtiva === 'cozinha' ? (
                                            <GrupoPedidosMesa pedidos={listaPedidos} onUpdateStatus={handleUpdateStatusAndNotify} onExcluir={handleExcluirPedido} newOrderIds={newOrderIds} estabelecimentoInfo={estabelecimentoInfo} onEmitirNfce={handleNfceDoPedido} />
                                        ) : (
                                            <div className="space-y-3">
                                                {listaPedidos.map(pedido => (
                                                    <PedidoCard key={pedido.id} item={pedido} onUpdateStatus={handleUpdateStatusAndNotify} onExcluir={handleExcluirPedido} newOrderIds={newOrderIds} estabelecimentoInfo={estabelecimentoInfo} motoboysDisponiveis={motoboys} onAtribuirMotoboy={(pid, mid, mnome) => handleAtribuirMotoboy(pid, mid, mnome, pedido.source)} onEmitirNfce={handleNfceDoPedido} />
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
