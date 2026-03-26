import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, addDoc, doc, getDoc, deleteDoc, updateDoc, serverTimestamp, query, orderBy, runTransaction, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useHeader } from '../context/HeaderContext';
import { toast } from 'react-toastify';
import MesaCard from "../components/MesaCard";
import AdicionarMesaModal from "../components/AdicionarMesaModal";
import ModalPagamento from "../components/ModalPagamento";
import GeradorTickets from "../components/GeradorTickets";
import RelatorioTicketsModal from "../components/RelatorioTicketsModal";
import HistoricoMesasModal from "../components/HistoricoMesasModal";
import RelatorioGarcomModal from "../components/RelatorioGarcomModal";
import {
    IoArrowBack, IoAdd,
    IoGrid, IoPeople, IoWalletOutline,
    IoRestaurant, IoSearch, IoClose, IoAlertCircle,
    IoTimeOutline, IoReceiptOutline, IoChevronDown, IoChevronUp, IoTrendingUp
} from "react-icons/io5";

// 🔥 IMPORTS PARA O FISCAL E HISTÓRICO 🔥
import { vendaService } from "../services/vendaService";
import { ModalRecibo, ModalHistorico } from "../components/pdv-modals"; // 🔥 ADICIONADO ModalHistorico

// --- HELPER DE FORMATAÇÃO ---
const formatarReal = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(valor || 0);
};

// --- STAT CARD PEQUENO ---
const StatCard = ({ icon: Icon, label, value, colorClass, bgClass, children }) => (
    <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between min-w-[120px] sm:min-w-[140px] flex-1 lg:flex-none gap-2">
        <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
            {children || <h3 className="text-sm sm:text-base font-black text-gray-900 leading-tight truncate">{value}</h3>}
        </div>
        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-lg sm:text-xl shrink-0 ${bgClass} ${colorClass}`}>
            <Icon />
        </div>
    </div>
);

// --- MODAL ABRIR MESA ---
const ModalAbrirMesa = ({ isOpen, onClose, onConfirm, mesaNumero, isOpening }) => {
    const [quantidade, setQuantidade] = useState(1);
    const [nome, setNome] = useState('');

    useEffect(() => {
        if (isOpen) { setQuantidade(1); setNome(''); }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-start sm:items-center justify-center p-4 pt-[10vh] sm:pt-4 z-50 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-[2rem] shadow-2xl p-6 w-full max-w-sm border border-gray-100 transform transition-all mb-auto sm:mb-0">
                <h3 className="text-2xl font-black text-gray-900 text-center mb-1">Mesa {mesaNumero}</h3>
                <p className="text-center text-gray-500 mb-6 text-sm font-medium">Abrir nova comanda</p>

                <div className="mb-5">
                    <label className="block text-[10px] font-black text-gray-400 mb-2 ml-1 tracking-widest uppercase">NOME DO CLIENTE (OPCIONAL)</label>
                    <input 
                        type="text" 
                        placeholder="Ex: João Silva" 
                        value={nome} 
                        onChange={(e) => setNome(e.target.value)} 
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3.5 text-gray-900 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-bold" 
                        autoFocus 
                    />
                </div>

                <div className="mb-8">
                    <label className="block text-[10px] font-black text-gray-400 mb-2 ml-1 tracking-widest uppercase">QUANTAS PESSOAS?</label>
                    <div className="flex items-center justify-between bg-gray-50 rounded-2xl p-2 border-2 border-gray-100">
                        <button type="button" onClick={() => setQuantidade(q => Math.max(1, q - 1))} className="w-12 h-12 rounded-xl bg-white shadow-sm border border-gray-200 text-2xl font-black active:scale-95 text-gray-600 hover:bg-gray-100 transition-all">-</button>
                        <span className="text-3xl font-black text-gray-900">{quantidade}</span>
                        <button type="button" onClick={() => setQuantidade(q => q + 1)} className="w-12 h-12 rounded-xl bg-blue-600 shadow-md text-white text-2xl font-black active:scale-95 hover:bg-blue-700 transition-all">+</button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button 
                        type="button"
                        onPointerDown={(e) => { e.preventDefault(); if(!isOpening) onClose(); }}
                        onClick={() => { if(!isOpening) onClose(); }}
                        disabled={isOpening} 
                        className="py-4 bg-gray-100 rounded-2xl font-bold text-gray-600 active:scale-95 disabled:opacity-50 transition-all hover:bg-gray-200"
                    >
                        Cancelar
                    </button>
                    
                    <button 
                        type="button"
                        onPointerDown={(e) => { e.preventDefault(); if(!isOpening) onConfirm(quantidade, nome); }}
                        onClick={() => { if(!isOpening) onConfirm(quantidade, nome); }}
                        disabled={isOpening} 
                        className="py-4 bg-green-500 text-white rounded-2xl font-black shadow-lg active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2 hover:bg-green-600"
                    >
                        {isOpening ? 'Abrindo...' : 'Abrir'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- LEGENDA DE CORES COLAPSÁVEL ---
const LegendaCores = () => {
    const [aberta, setAberta] = React.useState(false);
    return (
        <div className="mb-3">
            <button 
                onClick={() => setAberta(!aberta)}
                className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors px-1 py-1"
            >
                {aberta ? <IoChevronUp size={14} /> : <IoChevronDown size={14} />}
                Legenda de cores
            </button>
            {aberta && (
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 bg-white p-2.5 sm:p-3 rounded-2xl shadow-sm border border-gray-200 mt-1.5 text-xs font-bold text-gray-700 animate-[fadeIn_0.2s_ease-out]">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-white border-2 border-gray-300"></div> Livre</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-600 shadow-sm"></div> Ocupada</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-600 shadow-sm"></div> Com Pedido</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-yellow-400 shadow-sm"></div> Pagamento</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-orange-500 shadow-sm animate-pulse"></div> Ociosa</div>
                </div>
            )}
        </div>
    );
};

export default function ControleSalao() {
    const { userData, user, currentUser } = useAuth();
    const usuarioLogado = user || currentUser;

    const rawRole = String(userData?.role || userData?.cargo || 'admin').toLowerCase().trim();
    const isGarcom = rawRole.includes('garcom') || rawRole.includes('garçom') || rawRole.includes('atendente');

    const { setActions, clearActions } = useHeader();
    const navigate = useNavigate();

    const [mesas, setMesas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState('todos');
    const [buscaMesa, setBuscaMesa] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [isModalPagamentoOpen, setIsModalPagamentoOpen] = useState(false);
    const [mesaParaPagamento, setMesaParaPagamento] = useState(null);
    const [isModalAbrirMesaOpen, setIsModalAbrirMesaOpen] = useState(false);
    const [mesaParaAbrir, setMesaParaAbrir] = useState(null);
    const [isOpeningTable, setIsOpeningTable] = useState(false);

    const [isModalTicketsOpen, setIsModalTicketsOpen] = useState(false);
    const [isRelatorioOpen, setIsRelatorioOpen] = useState(false);
    const [isHistoricoMesasOpen, setIsHistoricoMesasOpen] = useState(false);
    const [isModalComissaoOpen, setIsModalComissaoOpen] = useState(false);
    const [nomeEstabelecimento, setNomeEstabelecimento] = useState("Carregando...");

    // 🔥 FILA DE IMPRESSÃO VIA IFRAME 🔥
    const [filaImpressao, setFilaImpressao] = useState([]);
    const [currentTime, setCurrentTime] = useState(new Date());

    // 🔥 NOVOS ESTADOS PARA NFC-E E HISTÓRICO 🔥
    const [mostrarRecibo, setMostrarRecibo] = useState(false);
    const [dadosRecibo, setDadosRecibo] = useState(null);
    const [nfceStatus, setNfceStatus] = useState('idle');
    const [nfceUrl, setNfceUrl] = useState(null);

    const [isHistoricoVendasOpen, setIsHistoricoVendasOpen] = useState(false);
    const [vendasHistoricoExibicao, setVendasHistoricoExibicao] = useState([]);
    const [carregandoHistorico, setCarregandoHistorico] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const estabelecimentoId = useMemo(() => {
        return userData?.estabelecimentosGerenciados?.[0] || userData?.estabelecimentoId || userData?.idEstabelecimento || null;
    }, [userData]);
// 🔥 NOVA FUNÇÃO: Lógica para Cancelar a Nota pedindo o Motivo
    const handleCancelarNfce = async (venda) => {
        if (!venda || !venda.id) return;

        const justificativa = prompt("Motivo do cancelamento (mínimo 15 caracteres):");
        
        if (!justificativa || justificativa.trim().length < 15) {
            alert("⚠️ O motivo deve ter pelo menos 15 caracteres para ser aceito pela SEFAZ.");
            return;
        }

        setNfceStatus('loading');
        try {
            const res = await vendaService.cancelarNfce(venda.id, justificativa.trim());
            
            if (res.success || res.sucesso) {
                alert("✅ Nota Fiscal cancelada com sucesso!");
                setDadosRecibo(p => ({ ...p, fiscal: { ...p.fiscal, status: 'CANCELADO' } }));
                setVendasHistoricoExibicao(p => p.map(v => v.id === venda.id ? { ...v, fiscal: { ...v.fiscal, status: 'CANCELADO' } } : v));
                setNfceStatus('idle'); 
            } else {
                setNfceStatus('error');
                tocarBeepErro();
                // Aqui o erro real aparecerá na tela do usuário!
                alert("❌ Erro ao cancelar: " + res.error); 
            }
        } catch (e) {
            setNfceStatus('error');
            tocarBeepErro();
            alert("Falha de conexão ao tentar cancelar a nota.");
        }
    };
    const verificarMesaOciosa = (mesa) => {
        if (mesa.status !== 'ocupada' || (mesa.itens && mesa.itens.length > 0)) return false;
        if (!mesa.updatedAt) return false;
        const dataAbertura = mesa.updatedAt.toDate ? mesa.updatedAt.toDate() : new Date(mesa.updatedAt);
        const minutosDecorridos = Math.floor((currentTime - dataAbertura) / 60000);
        return minutosDecorridos >= 10; 
    };

    useEffect(() => {
        const fetchNomeEstabelecimento = async () => {
            if (estabelecimentoId) {
                try {
                    const docRef = doc(db, "estabelecimentos", estabelecimentoId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) setNomeEstabelecimento(docSnap.data().nome || userData?.nomeEstabelecimento || "IdeaFood");
                } catch (error) { setNomeEstabelecimento(userData?.nomeEstabelecimento || "IdeaFood"); }
            }
        };
        fetchNomeEstabelecimento();
    }, [estabelecimentoId, userData]);

    // 🔥 FUNÇÃO PARA ABRIR O HISTÓRICO DE NOTAS/VENDAS 🔥
    const abrirHistoricoVendas = useCallback(async () => {
        setIsHistoricoVendasOpen(true);
        setCarregandoHistorico(true);
        try {
            // Busca as últimas 50 vendas da coleção global
            const vendas = await vendaService.buscarVendasPorEstabelecimento(estabelecimentoId, 50);
            setVendasHistoricoExibicao(vendas);
        } catch (error) {
            toast.error("Erro ao buscar histórico.");
        } finally {
            setCarregandoHistorico(false);
        }
    }, [estabelecimentoId]);

const selecionarVendaHistorico = (venda) => {
        // 🔥 CORREÇÃO: Padronizando os itens para as notas antigas também abrirem certinho
        const vendaNormalizada = {
            ...venda,
            itens: venda.itens?.map(item => {
                const precoReal = item.precoUnitario || item.preco || item.valor || item.price || 0;
                const qtdReal = item.quantidade || item.quantity || item.qtd || 1;
                
                return { 
                    ...item, 
                    preco: precoReal, 
                    precoUnitario: precoReal, 
                    valor: precoReal, 
                    price: precoReal, 
                    quantidade: qtdReal, 
                    quantity: qtdReal, 
                    nome: item.nome || item.name || 'Item' 
                };
            })
        };

        setDadosRecibo(vendaNormalizada);
        setNfceStatus(vendaNormalizada.fiscal?.status === 'AUTORIZADA' ? 'success' : 'idle');
        setNfceUrl(vendaNormalizada.fiscal?.pdf || null);
        setIsHistoricoVendasOpen(false);
        setMostrarRecibo(true);
    };

    // 🔥 LÓGICA DE EMISSÃO NFC-E IMPORTADA DO PDV 🔥
    const tocarBeepErro = () => { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, ctx.currentTime); gain.gain.setValueAtTime(0.15, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5); osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.5); } catch (e) { console.error(e); } };

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

    const handleBaixarXml = async (venda) => { if (!venda.fiscal?.idPlugNotas) return alert("Sem ID"); try { const res = await vendaService.baixarXmlNfce(venda.fiscal.idPlugNotas, venda.id.slice(-6)); if (!res.success) alert("Erro: " + res.error); } catch (e) { console.error(e); } };
    const handleBaixarPdf = async (venda) => { const id = venda.fiscal?.idPlugNotas; if (!id) return alert("Sem ID"); setNfceStatus('loading'); try { const res = await vendaService.baixarPdfNfce(id, venda.fiscal?.pdf); if (!res.success) alert("Erro: " + res.error); } catch (e) { console.error(e); } finally { if (nfceStatus === 'loading') setNfceStatus('idle'); } };

    const handleEnviarWhatsApp = (venda) => {
        if (!venda.fiscal?.pdf) return alert("⚠️ Link PDF indisponível.");
        let tel = prompt("📱 Número WhatsApp:", venda.clienteTelefone || venda.cliente?.telefone || "");
        if (tel === null) return; tel = tel.replace(/\D/g, '');
        const msg = encodeURIComponent(`Olá! Agradecemos a preferência. 😃\nSua Nota Fiscal de ${formatarReal(venda.total)}:\n${venda.fiscal.pdf}`);
        window.open(tel.length >= 10 ? `https://wa.me/${tel.startsWith('55') ? tel : `55${tel}`}?text=${msg}` : `https://api.whatsapp.com/send?text=${msg}`, '_blank');
    };

    // Observador do status da nota em tempo real
    useEffect(() => {
        let unsub = () => {};
        if (mostrarRecibo && dadosRecibo?.id) {
            unsub = onSnapshot(doc(db, 'vendas', dadosRecibo.id), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data(); setDadosRecibo(p => ({ ...p, fiscal: data.fiscal }));
                    if (data.fiscal) {
                        const st = data.fiscal.status?.toUpperCase();
                        if (st === 'AUTORIZADA' || st === 'CONCLUIDO') { setNfceStatus('success'); setNfceUrl(data.fiscal.pdf); } 
                        else if (st === 'REJEITADO' || st === 'REJEITADA' || st === 'DENEGADO') { setNfceStatus('error'); setNfceUrl(null);  } 
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
                } catch (e) { console.error(e); }
            }, 3000);
        }
        return () => clearInterval(intervalo);
    }, [nfceStatus, dadosRecibo]);
    // 🔥 FIM DA LÓGICA DE EMISSÃO E HISTÓRICO NFC-E 🔥

    // 🔥 OUVIDOS DE IMPRESSÃO INVISÍVEL VIA IFRAME 🔥
    useEffect(() => {
        if (!estabelecimentoId) return;
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        
        if (isMobileDevice) return; // Celular não imprime!

        const qMesas = query(collection(db, "estabelecimentos", estabelecimentoId, "mesas"), where("solicitarImpressaoConferencia", "==", true));
        const unsubMesas = onSnapshot(qMesas, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === "added" || change.type === "modified") {
                    const docMesa = change.doc;
                    const dadosMesa = docMesa.data();
                    
                    if (dadosMesa.solicitarImpressaoConferencia) {
                        const setorMesa = dadosMesa.setorImpressao || ''; 
                        toast.info(`🖨️ Imprimindo Mesa ${dadosMesa.numero}...`);
                        
                        const urlImpressao = `/impressao-isolada?origem=salao&estabId=${estabelecimentoId}&pedidoId=${docMesa.id}&setor=${setorMesa}&t=${Date.now()}`;
                        
                        setFilaImpressao(prev => [...prev, urlImpressao]);
                        setTimeout(() => { setFilaImpressao(prev => prev.filter(url => url !== urlImpressao)); }, 15000); // Remove o iframe do DOM após 15s
                        
                        try { await updateDoc(doc(db, "estabelecimentos", estabelecimentoId, "mesas", docMesa.id), { solicitarImpressaoConferencia: false, setorImpressao: null }); } catch (err) { console.error(err); }
                    }
                }
            });
        });

        const qPedidos = query(collection(db, "estabelecimentos", estabelecimentoId, "pedidos"), where("solicitarImpressao", "==", true));
        const unsubPedidos = onSnapshot(qPedidos, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === "added" || change.type === "modified") {
                    const docPedido = change.doc;
                    const dadosPedido = docPedido.data();
                    
                    if (dadosPedido.solicitarImpressao) {
                        const setor = dadosPedido.setorImpressao || '';
                        toast.info(`🖨️ Imprimindo pedido da Mesa ${dadosPedido.mesaNumero} (${setor || 'Tudo'})...`);
                        
                        const urlImpressao = `/impressao-isolada?estabId=${estabelecimentoId}&pedidoId=${docPedido.id}&setor=${setor}&t=${Date.now()}`;
                        
                        setFilaImpressao(prev => [...prev, urlImpressao]);
                        setTimeout(() => { setFilaImpressao(prev => prev.filter(url => url !== urlImpressao)); }, 15000);
                        
                        try { await updateDoc(doc(db, "estabelecimentos", estabelecimentoId, "pedidos", docPedido.id), { solicitarImpressao: false, setorImpressao: null }); } catch (err) { console.error(err); }
                    }
                }
            });
        });

        return () => { unsubMesas(); unsubPedidos(); };
    }, [estabelecimentoId]);

    useEffect(() => {
        if (!isGarcom) {
            setActions(
                <div className="flex gap-2">
                    {/* 🔥 NOVO BOTÃO DE NOTAS FISCAIS 🔥 */}
                    <button onClick={abrirHistoricoVendas} className="bg-white text-purple-700 border border-purple-200 hover:bg-purple-50 font-black py-2.5 px-4 rounded-xl shadow-sm flex items-center gap-2 active:scale-95 transition-all text-xs sm:text-sm">
                        <IoReceiptOutline className="text-lg" /> <span className="hidden sm:inline">Notas Fiscais</span>
                    </button>
                    <button onClick={() => setIsHistoricoMesasOpen(true)} className="bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 font-black py-2.5 px-4 rounded-xl shadow-sm flex items-center gap-2 active:scale-95 transition-all text-xs sm:text-sm">
                        <IoTimeOutline className="text-lg" /> <span className="hidden sm:inline">Mesas Antigas</span>
                    </button>
                    <button onClick={() => setIsModalComissaoOpen(true)} className="bg-white text-green-700 border border-green-200 hover:bg-green-50 font-black py-2.5 px-4 rounded-xl shadow-sm flex items-center gap-2 active:scale-95 transition-all text-xs sm:text-sm">
                        <IoPeople className="text-lg" /> <span className="hidden sm:inline">Comissões</span>
                    </button>
                    <button onClick={() => setIsModalOpen(true)} className="bg-gray-900 hover:bg-black text-white font-black py-2.5 px-4 rounded-xl shadow-lg flex items-center gap-2 active:scale-95 transition-all text-xs sm:text-sm">
                        <IoAdd className="text-lg" /> <span className="hidden sm:inline">Nova Mesa</span>
                    </button>
                </div>
            );
        } else {
            setActions(<div/>);
        }
        return () => clearActions();
    }, [setActions, clearActions, isGarcom, abrirHistoricoVendas]);

    useEffect(() => {
        if (!estabelecimentoId) { if (userData) setLoading(false); return; }
        setLoading(true);
        const unsubscribe = onSnapshot(query(collection(db, 'estabelecimentos', estabelecimentoId, 'mesas'), orderBy('numero')),
            (snapshot) => {
                const mesasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                mesasData.sort((a, b) => {
                    const numA = parseFloat(a.numero);
                    const numB = parseFloat(b.numero);
                    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                    return String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true });
                });
                setMesas(mesasData);
                setLoading(false);
            },
            (error) => { console.error("Erro mesas:", error); setLoading(false); }
        );
        return () => unsubscribe();
    }, [estabelecimentoId, userData]);

    const handleAdicionarMesa = async (numeroMesa) => {
        if (!numeroMesa || !estabelecimentoId) return;
        try {
            await addDoc(collection(db, 'estabelecimentos', estabelecimentoId, 'mesas'), {
                numero: !isNaN(numeroMesa) ? Number(numeroMesa) : numeroMesa,
                status: 'livre', total: 0, pessoas: 0, itens: [], tipo: 'mesa',
                createdAt: serverTimestamp(), updatedAt: serverTimestamp()
            });
            toast.success("Mesa criada!"); setIsModalOpen(false);
        } catch (error) { toast.error("Erro ao criar."); }
    };

    const handleExcluirMesa = async (id) => {
        if (!window.confirm(`Excluir mesa?`)) return;
        try { await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', id)); toast.success("Excluída."); }
        catch (error) { toast.error("Erro."); }
    };

    const handleMesaClick = (mesa) => {
        if (mesa.status !== 'livre') { navigate(`/estabelecimento/${estabelecimentoId}/mesa/${mesa.id}`); return; }
        if (!usuarioLogado || !usuarioLogado.uid) { toast.error("Erro de autenticação. Recarregue a página."); return; }

        setMesaParaAbrir(mesa); setIsModalAbrirMesaOpen(true);
        const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesa.id);

        runTransaction(db, async (transaction) => {
            const mesaDoc = await transaction.get(mesaRef);
            if (!mesaDoc.exists()) throw "Mesa não existe mais!";
            const data = mesaDoc.data();
            if (data.status !== 'livre') throw "Esta mesa acabou de ser ocupada!";

            if (data.bloqueadoPor && data.bloqueadoPor !== usuarioLogado.uid) {
                const agora = new Date();
                let tempoBloqueio = 0;
                if (data.bloqueadoEm) {
                    const dataBloqueio = data.bloqueadoEm.toDate ? data.bloqueadoEm.toDate() : new Date(data.bloqueadoEm);
                    tempoBloqueio = (agora.getTime() - dataBloqueio.getTime()) / 1000 / 60;
                }
                if (tempoBloqueio < 2) throw `Mesa sendo aberta por: ${data.bloqueadoPorNome || 'Outro garçom'}`;
            }
            transaction.update(mesaRef, { bloqueadoPor: usuarioLogado.uid, bloqueadoPorNome: usuarioLogado.displayName || usuarioLogado.email || "Garçom", bloqueadoEm: serverTimestamp() });
        }).catch((error) => {
            const msg = typeof error === 'string' ? error : "Erro: Mesa acessada por outro usuário.";
            toast.warning(msg); setIsModalAbrirMesaOpen(false); setMesaParaAbrir(null);
        });
    };

    const handleCancelarAbertura = async () => {
        setIsModalAbrirMesaOpen(false);
        if (mesaParaAbrir) {
            try { await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaParaAbrir.id), { bloqueadoPor: null, bloqueadoPorNome: null, bloqueadoEm: null }); } 
            catch (error) { console.error("Erro ao desbloquear mesa", error); }
            setMesaParaAbrir(null);
        }
    };

    const handleConfirmarAbertura = async (qtd, nomeCliente) => {
        if (!mesaParaAbrir || isOpeningTable) return;
        setIsOpeningTable(true);

        try {
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaParaAbrir.id), {
                status: 'ocupada', pessoas: qtd, nome: nomeCliente || '', tipo: 'mesa',
                updatedAt: serverTimestamp(), bloqueadoPor: null, bloqueadoPorNome: null, bloqueadoEm: null
            });
            setIsModalAbrirMesaOpen(false);
            navigate(`/estabelecimento/${estabelecimentoId}/mesa/${mesaParaAbrir.id}`);
        } catch (error) {
            toast.error("Erro ao sincronizar com o servidor.");
        } finally {
            setIsOpeningTable(false);
        }
    };

const handlePagamentoConcluido = (vendaFinalizada) => { 
        setIsModalPagamentoOpen(false); 
        setMesaParaPagamento(null); 
        
        if (vendaFinalizada && vendaFinalizada.id) {
            // 🔥 CORREÇÃO: Padronizando os itens para o Recibo não se perder nos nomes das variáveis
            const vendaNormalizada = {
                ...vendaFinalizada,
                itens: vendaFinalizada.itens?.map(item => {
                    // Pega o preço e a quantidade não importa com qual nome foram salvos na mesa
                    const precoReal = item.precoUnitario || item.preco || item.valor || item.price || 0;
                    const qtdReal = item.quantidade || item.quantity || item.qtd || 1;
                    
                    return { 
                        ...item, 
                        preco: precoReal, 
                        precoUnitario: precoReal, 
                        valor: precoReal, 
                        price: precoReal, 
                        quantidade: qtdReal, 
                        quantity: qtdReal, 
                        nome: item.nome || item.name || 'Item' 
                    };
                })
            };

            setDadosRecibo(vendaNormalizada);
            setNfceStatus(vendaNormalizada.fiscal?.status === 'AUTORIZADA' ? 'success' : 'idle');
            setNfceUrl(vendaNormalizada.fiscal?.pdf || null);
            setMostrarRecibo(true);
        } else {
            toast.success("Mesa paga e encerrada com sucesso!");
        }
    };
    const mesasFiltradas = useMemo(() => {
        return mesas.filter(m => {
            const matchStatus = filtro === 'todos' ? true : filtro === 'livres' ? m.status === 'livre' : m.status !== 'livre';
            const termoBusca = buscaMesa.toLowerCase();
            const matchBusca = buscaMesa === '' ? true : (String(m.numero).includes(buscaMesa) || (m.nome && m.nome.toLowerCase().includes(termoBusca)));
            return matchStatus && matchBusca;
        });
    }, [mesas, filtro, buscaMesa]);

    const stats = useMemo(() => {
        const ocupadas = mesas.filter(m => m.status !== 'livre');
        const totalVendas = ocupadas.reduce((acc, m) => acc + (m.total || 0), 0);
        return {
            total: mesas.length, ocupadas: ocupadas.length, livres: mesas.length - ocupadas.length,
            pessoas: ocupadas.reduce((acc, m) => acc + (m.pessoas || 0), 0), vendas: totalVendas,
            ocupacaoPercent: mesas.length > 0 ? Math.round((ocupadas.length / mesas.length) * 100) : 0
        };
    }, [mesas]);

    if (!estabelecimentoId && !loading) return <div className="p-10 text-center"><IoAlertCircle className="mx-auto text-4xl text-red-500 mb-2" />Sem acesso.</div>;

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-2 sm:p-4 lg:p-6 w-full max-w-[1600px] mx-auto pb-24 font-sans">
            
            <AdicionarMesaModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleAdicionarMesa} mesasExistentes={mesas} />
            <ModalAbrirMesa isOpen={isModalAbrirMesaOpen} onClose={handleCancelarAbertura} onConfirm={handleConfirmarAbertura} mesaNumero={mesaParaAbrir?.numero} isOpening={isOpeningTable} />
            {isModalPagamentoOpen && mesaParaPagamento && estabelecimentoId && <ModalPagamento mesa={mesaParaPagamento} estabelecimentoId={estabelecimentoId} onClose={() => setIsModalPagamentoOpen(false)} onSucesso={handlePagamentoConcluido} />}
            {isModalTicketsOpen && <GeradorTickets onClose={() => setIsModalTicketsOpen(false)} estabelecimentoNome={nomeEstabelecimento} estabelecimentoId={estabelecimentoId} />}
            {isRelatorioOpen && <RelatorioTicketsModal onClose={() => setIsRelatorioOpen(false)} estabelecimentoId={estabelecimentoId} />}
            {isHistoricoMesasOpen && <HistoricoMesasModal isOpen={isHistoricoMesasOpen} onClose={() => setIsHistoricoMesasOpen(false)} estabelecimentoId={estabelecimentoId} />}
            {isModalComissaoOpen && <RelatorioGarcomModal isOpen={isModalComissaoOpen} onClose={() => setIsModalComissaoOpen(false)} estabelecimentoId={estabelecimentoId} />}
            
            {/* 🔥 TELA DE RECIBO / EMISSÃO FISCAL IMPORTADA DO PDV 🔥 */}
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
                onBaixarXmlCancelamento={async (venda) => { try { const res = await vendaService.baixarXmlCancelamentoNfce(venda.fiscal?.idPlugNotas, venda.id.slice(-6)); if (!res.success) alert("Erro: " + res.error); } catch (e) { console.error(e); } }} 
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
                onBaixarXmlCancelamento={async (venda) => { /* ... */ }} 
                onEnviarWhatsApp={handleEnviarWhatsApp} 
                onProcessarLote={async () => { toast.info("Acesse a tela principal do PDV para processar lotes."); }}
                
                /* 🔥 CORREÇÃO: Agora ele chama a função real que abre o prompt! */
                onCancelarNfce={handleCancelarNfce}
            />

            <div className="sticky top-0 bg-[#F8FAFC]/90 backdrop-blur-xl z-30 pb-4 pt-2 mb-2 w-full">
                <div className="flex flex-col xl:flex-row justify-between gap-4 w-full">
                    <div className="flex flex-col gap-1 shrink-0">
                        {!isGarcom && (
                            <button onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-gray-800 font-bold text-xs flex items-center gap-1 w-fit transition-colors">
                                <IoArrowBack /> Voltar ao Painel
                            </button>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Salão</h1>
                            <span className="bg-gray-900 text-white text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider shadow-sm">
                                {mesasFiltradas.length} Mesas
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-1 no-scrollbar w-full xl:w-auto xl:justify-center">
                        {/* BARRA DE OCUPAÇÃO VISUAL */}
                        <StatCard icon={IoGrid} label="Ocupação" colorClass="text-blue-600" bgClass="bg-blue-50">
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden min-w-[50px] sm:min-w-[60px]">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-500 ${
                                            stats.ocupacaoPercent >= 80 ? 'bg-red-500' : 
                                            stats.ocupacaoPercent >= 50 ? 'bg-amber-400' : 'bg-emerald-500'
                                        }`}
                                        style={{ width: `${stats.ocupacaoPercent}%` }}
                                    />
                                </div>
                                <span className="text-xs sm:text-sm font-black text-gray-900">{stats.ocupacaoPercent}%</span>
                            </div>
                        </StatCard>
                        <StatCard icon={IoPeople} label="Pessoas" value={stats.pessoas} bgClass="bg-emerald-50" colorClass="text-emerald-600" />
                        {!isGarcom && (
                            <StatCard icon={IoWalletOutline} label="Aberto" value={formatarReal(stats.vendas)} bgClass="bg-purple-50" colorClass="text-purple-600" />
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full xl:w-auto shrink-0">
                        <div className="relative w-full sm:w-48 md:w-64">
                            <IoSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" className="w-full pl-10 pr-9 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-gray-800 placeholder-gray-400 outline-none shadow-sm transition-all" placeholder="Buscar mesa..." value={buscaMesa} onChange={(e) => setBuscaMesa(e.target.value)} />
                            {buscaMesa && <button onClick={() => setBuscaMesa('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"><IoClose size={18}/></button>}
                        </div>

                        <div className="flex bg-gray-200/60 p-1 rounded-2xl overflow-x-auto">
                            {['todos', 'livres', 'ocupadas'].map(t => (
                                <button key={t} onClick={() => setFiltro(t)} className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black capitalize transition-all whitespace-nowrap ${filtro === t ? 'bg-white text-gray-900 shadow-md' : 'text-gray-500 hover:text-gray-800'}`}>
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <LegendaCores />

            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-gray-100 shadow-sm min-h-[70vh] w-full">
                {mesasFiltradas.length > 0 ? (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 w-full">
                        {mesasFiltradas.map(mesa => (
                            <MesaCard
                                key={mesa.id}
                                mesa={mesa}
                                isOciosa={verificarMesaOciosa(mesa)}
                                currentTime={currentTime}
                                onClick={() => handleMesaClick(mesa)}
                                onPagar={() => { setMesaParaPagamento(mesa); setIsModalPagamentoOpen(true); }}
                                onExcluir={() => handleExcluirMesa(mesa.id)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-32 text-center text-gray-400 w-full">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4"><IoRestaurant className="text-3xl text-gray-300" /></div>
                        <p className="text-base font-bold text-gray-500">Nenhuma mesa encontrada.</p>
                        {mesas.length === 0 && !isGarcom && (
                            <button onClick={() => setIsModalOpen(true)} className="mt-4 text-blue-600 font-bold hover:underline text-sm">+ Adicionar Mesas</button>
                        )}
                    </div>
                )}
            </div>

            {/* 🔥 IFRAMES INVISÍVEIS PARA IMPRESSÃO SILENCIOSA 🔥 */}
            <div style={{ position: 'absolute', width: '0px', height: '0px', overflow: 'hidden', left: '-9999px' }}>
                {filaImpressao.map((url, index) => (
                    <iframe key={url + index} src={url} title={`print-${index}`} />
                ))}
            </div>

        </div>
    );
}