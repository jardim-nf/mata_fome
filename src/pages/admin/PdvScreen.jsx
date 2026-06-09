import React, { useState, useEffect, useRef, useCallback } from 'react';
import BackButton from '../../components/BackButton';

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { vendaService } from '../../services/vendaService';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc, setDoc, collection } from 'firebase/firestore';

import { usePdvProducts } from '../../hooks/usePdvProducts';
import { usePdvCart } from '../../hooks/usePdvCart';
import { usePdvCaixa } from '../../hooks/usePdvCaixa';
import { usePdvNfce } from '../../hooks/usePdvNfce';

import { 
    formatarMoeda,
    ModalEdicaoItemCarrinho, ModalSelecaoVariacao, ModalAberturaCaixa, 
    ModalFechamentoCaixa, ModalMovimentacao, ModalFinalizacao, 
    ModalRecibo, ModalHistorico, ModalListaTurnos, ModalResumoTurno, ModalVendasSuspensas,
    ModalPesoBalanca, ModalOpcoesProduto, ModalClientePdv, ModalBuscaProduto
} from '../../components/pdv-modals';
import { IoArrowBack, IoSearch, IoCart, IoStorefrontOutline, IoCheckmarkCircleOutline } from 'react-icons/io5';
import { toast, ToastContainer } from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import PromptDialog from '../../components/ui/PromptDialog';
import './PdvScreen.css';

const PdvScreen = () => {
    const { userData, currentUser, estabelecimentoIdPrincipal } = useAuth();
    const navigate = useNavigate();

    // Estabelecimento Ativo (Locked to logged-in store)
    const estabelecimentoAtivo = estabelecimentoIdPrincipal || null;
    const [nomeLoja, setNomeLoja] = useState('...');

    useEffect(() => {
        if (!estabelecimentoAtivo) return;
        const carregarNomeLoja = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'estabelecimentos', estabelecimentoAtivo));
                if (docSnap.exists()) {
                    setNomeLoja(docSnap.data().nome || 'Loja Sem Nome');
                }
            } catch (e) {
                console.error('Erro ao carregar nome do estabelecimento:', e);
            }
        };
        carregarNomeLoja();
    }, [estabelecimentoAtivo]);

    // Refs Globais e UI states básicos
    const inputBuscaRef = useRef(null);
    const [mostrarCarrinhoMobile, setMostrarCarrinhoMobile] = useState(false);
    
    // UI - Históricos e Modais Extra
    const [vendasBase, setVendasBase] = useState([]);
    const [vendasHistoricoExibicao, setVendasHistoricoExibicao] = useState([]);
    const [tituloHistorico, setTituloHistorico] = useState("Histórico");
    const [mostrarHistorico, setMostrarHistorico] = useState(false);
    const [mostrarAberturaCaixa, setMostrarAberturaCaixa] = useState(false);
    const [mostrarFinalizacao, setMostrarFinalizacao] = useState(false);
    const [mostrarRecibo, setMostrarRecibo] = useState(false);
    const [mostrarListaTurnos, setMostrarListaTurnos] = useState(false);
    const [dadosRecibo, setDadosRecibo] = useState(null);
    const [salvando, setSalvando] = useState(false);
    const [cpfNota, setCpfNota] = useState('');
    const [mostrarModalCliente, setMostrarModalCliente] = useState(false);
    const [mostrarModalBusca, setMostrarModalBusca] = useState(false);

    // Dialogs
    const [confirmDialog, setConfirmDialog] = useState(null);
    const [promptDialog, setPromptDialog] = useState(null);

    const showConfirm = useCallback((message, onConfirm, opts = {}) => {
        setConfirmDialog({ message, onConfirmCb: onConfirm, title: opts.title || '', variant: opts.variant || 'default', confirmText: opts.confirmText || 'Confirmar', cancelText: opts.cancelText || 'Cancelar' });
    }, []);
    const showPrompt = useCallback((message, onSubmit, opts = {}) => {
        setPromptDialog({ message, onSubmitCb: onSubmit, title: opts.title || '', placeholder: opts.placeholder || '', defaultValue: opts.defaultValue || '', confirmText: opts.submitText || opts.confirmText || 'OK', cancelText: opts.cancelText || 'Cancelar' });
    }, []);

    // ----- INJETANDO NOSSOS HOOKS DE NEGÓCIO -----
    const { 
        produtos, categorias, carregandoProdutos, categoriaAtiva, setCategoriaAtiva, busca, setBusca, produtosFiltrados 
    } = usePdvProducts(estabelecimentoAtivo);

    // Ref to break circular dependency: pdvCaixa needs pdvCart.setVendaAtual, but pdvCart needs pdvCaixa.caixaAberto
    const pdvCartRef = useRef(null);

    const pdvCaixa = usePdvCaixa(
        currentUser, estabelecimentoAtivo, 
        (vd) => pdvCartRef.current?.setVendaAtual(vd), 
        setVendasBase, inputBuscaRef, setMostrarAberturaCaixa, setVendasHistoricoExibicao, setTituloHistorico, setMostrarListaTurnos, setMostrarHistorico
    );

    const pdvCart = usePdvCart(pdvCaixa.caixaAberto, inputBuscaRef, showPrompt, showConfirm);

    // Keep ref in sync so pdvCaixa's callback can reach pdvCart
    useEffect(() => { pdvCartRef.current = pdvCart; });
    
    // Sync for barcode
    useEffect(() => { 
        pdvCart.pdvSyncRef.current = { 
            produtos, 
            handleProdutoClick: pdvCart.handleProdutoClick, 
            adicionarItemPeso: pdvCart.adicionarItemPeso,
            bloqueado: mostrarFinalizacao || mostrarRecibo || mostrarHistorico || pdvCart.mostrarSuspensas || pdvCaixa.mostrarMovimentacao || mostrarListaTurnos || mostrarAberturaCaixa || !pdvCaixa.caixaAberto || pdvCart.produtoParaSelecao !== null || pdvCart.itemParaEditar !== null || pdvCart.produtoParaPeso !== null 
        }; 
    });

    const tocarBeepErro = () => { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, ctx.currentTime); gain.gain.setValueAtTime(0.15, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5); osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.5); } catch (e) { console.error(e); } };

    const pdvNfce = usePdvNfce(dadosRecibo, setDadosRecibo, setVendasBase, setVendasHistoricoExibicao, showPrompt, showConfirm, tocarBeepErro);

    // Ações de Venda Conclusivas
    const finalizarVenda = async () => {
        setSalvando(true);
        const descNum = parseFloat(pdvCart.descontoValor || 0); const acrNum = parseFloat(pdvCart.acrescimoValor || 0);
        const totalFinal = Math.max(0, pdvCart.vendaAtual.total + acrNum - descNum);
        const totalPago = pdvCart.pagamentosAdicionados.reduce((acc, p) => acc + p.valor, 0);
        const d = { 
            estabelecimentoId: estabelecimentoAtivo, status: 'finalizada', 
            formaPagamento: pdvCart.pagamentosAdicionados.length === 1 ? pdvCart.pagamentosAdicionados[0].forma : 'misto', 
            pagamentos: pdvCart.pagamentosAdicionados, subtotal: pdvCart.vendaAtual.total, desconto: descNum, acrescimo: acrNum, total: totalFinal, 
            troco: Math.max(0, totalPago - totalFinal), valorRecebido: totalPago, itens: pdvCart.vendaAtual.itens, usuarioId: currentUser.uid, 
            cliente: pdvCart.clienteSelecionado?.nome || 'Balcão',
            clienteId: pdvCart.clienteSelecionado?.id || null,
            clienteTelefone: pdvCart.clienteSelecionado?.telefone || null,
            clienteCpf: pdvCart.clienteSelecionado?.cpf || cpfNota || null,
            createdAt: new Date() 
        };
        const res = await vendaService.salvarVenda(d);
        if (res.success) { 
            // Registrar saldo devedor se houver pagamento em Crediário
            const valorCrediario = pdvCart.pagamentosAdicionados
                .filter(p => p.forma === 'crediario')
                .reduce((acc, p) => acc + p.valor, 0);

            if (valorCrediario > 0 && pdvCart.clienteSelecionado?.id) {
                try {
                    const cRef = doc(db, 'estabelecimentos', estabelecimentoAtivo, 'clientes', pdvCart.clienteSelecionado.id);
                    const cSnap = await getDoc(cRef);
                    const currentSaldo = cSnap.exists() ? (cSnap.data().saldoDevedor || 0) : 0;
                    const novoSaldo = currentSaldo + valorCrediario;
                    
                    await updateDoc(cRef, {
                        saldoDevedor: novoSaldo
                    });

                    // Sincroniza com a coleção global do cliente
                    const gRef = doc(db, 'clientes', pdvCart.clienteSelecionado.id);
                    const gSnap = await getDoc(gRef);
                    if (gSnap.exists()) {
                        await updateDoc(gRef, {
                            saldoDevedor: (gSnap.data().saldoDevedor || 0) + valorCrediario
                        });
                    }

                    const histRef = doc(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'clientes', pdvCart.clienteSelecionado.id, 'historico_crediario'));
                    await setDoc(histRef, {
                        tipo: 'compra',
                        valor: valorCrediario,
                        descricao: `Venda #${res.vendaId.slice(-6).toUpperCase()}`,
                        vendaId: res.vendaId,
                        data: new Date(),
                        itens: pdvCart.vendaAtual.itens.map(item => ({
                            nome: item.nome || item.name || 'Item',
                            quantidade: item.quantidade || item.quantity || item.qtd || 1,
                            preco: Number(item.precoFinal || item.precoUnitario || item.preco || item.valor || item.price || 0)
                        }))
                    });
                } catch (err) {
                    console.error("Erro ao registrar débito de crediário:", err);
                }
            }

            setVendasBase(p => [{ ...d, id: res.vendaId }, ...p]); 
            setDadosRecibo({ ...d, id: res.vendaId }); 
            pdvCart.setVendaAtual(null); setMostrarFinalizacao(false); setMostrarRecibo(true); 
            pdvCart.setDescontoValor(''); pdvCart.setAcrescimoValor(''); setCpfNota(''); pdvCart.setPagamentosAdicionados([]); 
            pdvCaixa.setVendasBaseLocal(p => [{ ...d, id: res.vendaId }, ...p]);
        }
        setSalvando(false);
    };

    const abrirHistoricoAtual = useCallback(() => { 
        setTituloHistorico("Vendas Turno Atual"); 
        setVendasHistoricoExibicao(pdvCaixa.vendasTurnoAtual); 
        setMostrarHistorico(prev => !prev); 
    }, [pdvCaixa.vendasTurnoAtual]);

    const selecionarVendaHistorico = (v) => { 
        setDadosRecibo(v); 
        pdvNfce.setNfceStatus(v.fiscal?.status === 'AUTORIZADA' ? 'success' : 'idle'); 
        pdvNfce.setNfceUrl(v.fiscal?.pdf || null); 
        setMostrarHistorico(false); setMostrarRecibo(true); 
    };

    const handleEnviarWhatsApp = (venda) => {
        if (!venda.fiscal?.pdf) return toast.warning('Link PDF indisponível.');
        showPrompt('Número WhatsApp:', (tel) => {
            tel = tel.replace(/\D/g, '');
            const msg = encodeURIComponent(`Olá! Agradecemos a preferência. 😃\nSua Nota Fiscal de ${formatarMoeda(venda.total)}:\n${venda.fiscal.pdf}`);
            window.open(tel.length >= 10 ? `https://wa.me/${tel.startsWith('55') ? tel : `55${tel}`}?text=${msg}` : `https://api.whatsapp.com/send?text=${msg}`, '_blank');
        }, { title: '📱 Enviar WhatsApp', defaultValue: venda.clienteTelefone || venda.cliente?.telefone || '', placeholder: '(XX) XXXXX-XXXX', submitText: 'Enviar' });
    };

    useEffect(() => { const handler = (e) => { pdvCaixa.setTurnoSelecionadoResumo(e.detail); setMostrarListaTurnos(false); pdvCaixa.setMostrarResumoTurno(true); }; document.addEventListener('abrirRelatorioTurno', handler); return () => document.removeEventListener('abrirRelatorioTurno', handler); }, [pdvCaixa]);

    // Listener Global de Atalhos
    useEffect(() => {
        const preventHelp = (e) => e.preventDefault();
        window.addEventListener('help', preventHelp);

        const h = (e) => {
            if (!pdvCaixa.caixaAberto && !mostrarAberturaCaixa) return;
            if (e.key === 'F1') { 
                e.preventDefault(); 
                setMostrarModalBusca(true); 
            }
            if (e.key === 'F3') { e.preventDefault(); abrirHistoricoAtual(); }
            if (e.key === 'F4') { e.preventDefault(); pdvCart.suspenderVenda(); }
            if (e.key === 'F5') { e.preventDefault(); pdvCart.setMostrarSuspensas(true); }
            if (e.key === 'F6') { e.preventDefault(); setMostrarModalCliente(true); }
            if (e.key === 'F8') { e.preventDefault(); pdvCaixa.abrirMovimentacao(); }
            if (e.key === 'F9') { e.preventDefault(); pdvCaixa.prepararFechamento(); }
            if (e.key === 'F10' && pdvCart.vendaAtual?.itens.length > 0) { e.preventDefault(); setMostrarFinalizacao(true); setMostrarCarrinhoMobile(false); }
            if (e.key === 'F11') { e.preventDefault(); pdvCaixa.carregarListaTurnos(); }
            if (e.key === 'Escape') { pdvCart.setItemParaEditar(null); pdvCart.setProdutoParaSelecao(null); pdvCart.setProdutoParaPeso(null); setMostrarFinalizacao(false); setMostrarRecibo(false); setMostrarHistorico(false); pdvCaixa.setMostrarFechamentoCaixa(false); setMostrarListaTurnos(false); pdvCaixa.setMostrarMovimentacao(false); pdvCaixa.setMostrarResumoTurno(false); pdvCart.setMostrarSuspensas(false); setMostrarCarrinhoMobile(false); setMostrarModalCliente(false); setMostrarModalBusca(false); }
        };
        window.addEventListener('keydown', h);
        return () => {
            window.removeEventListener('help', preventHelp);
            window.removeEventListener('keydown', h);
        };
    }, [pdvCaixa, pdvCart, abrirHistoricoAtual, mostrarAberturaCaixa]);

    return (
        <div id="pdv-root" className="flex flex-col bg-slate-100 font-sans text-slate-800">
            {pdvCart.barcodeAviso && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-[9999] font-bold text-xs flex items-center gap-2">
                    <IoStorefrontOutline size={16} /> {pdvCart.barcodeAviso}
                </div>
            )}

            {pdvCaixa.verificandoCaixa && !pdvCaixa.caixaAberto && !mostrarAberturaCaixa ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-white">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-emerald-600"></div>
                    <span className="font-bold text-slate-500 text-sm">Carregando PDV...</span>
                </div>
            ) : (
                <>
                    <div className="flex-1 flex min-h-0 overflow-hidden bg-white relative">
                        <div className="flex-1 flex flex-col min-w-0 min-h-0">
                            <div className="h-14 px-4 border-b border-slate-200 flex justify-between items-center bg-white shrink-0 gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <BackButton />
                                    <div className="flex items-center gap-1.5 min-w-0 shrink-0">
                                        <div className={`w-2 h-2 rounded-full ${pdvCaixa.caixaAberto ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'} shrink-0`}></div>
                                        <h1 className="text-sm font-black text-slate-800 uppercase truncate max-w-[100px] sm:max-w-[150px]">{nomeLoja}</h1>
                                    </div>
                                    {pdvCaixa.caixaAberto && (
                                        <div className="hidden lg:flex items-center gap-2 shrink-0">
                                            <div className="flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                                <span className="text-[9px] text-emerald-600 font-medium">Vendas:</span>
                                                <span className="text-[10px] font-black text-emerald-700">{pdvCaixa.vendasTurnoAtual.length}</span>
                                            </div>
                                            <div className="flex items-center gap-1 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                                <span className="text-[9px] text-blue-600 font-medium">Total:</span>
                                                <span className="text-[10px] font-black text-blue-700">{formatarMoeda(pdvCaixa.vendasTurnoAtual.reduce((a, v) => a + (v.total || 0), 0))}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center w-[140px] sm:w-[200px] shrink-0 ml-auto">
                                    <button 
                                        ref={inputBuscaRef}
                                        onClick={() => setMostrarModalBusca(true)}
                                        className="w-full pl-9 pr-3 py-1.5 bg-slate-100 border border-transparent rounded text-xs font-semibold text-slate-400 text-left relative hover:bg-slate-200 transition-all flex items-center cursor-pointer shrink-0"
                                    >
                                        <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        Buscar (F1)...
                                    </button>
                                </div>
                            </div>

                            <div className="h-10 px-4 flex gap-1.5 items-center overflow-x-auto scrollbar-hide shrink-0 border-b border-slate-200 bg-slate-50">
                                {categorias.map(c => (
                                    <button 
                                        key={c.id} onClick={() => setCategoriaAtiva(c.name === 'Todos' ? 'todos' : c.name)} 
                                        className={`px-3 py-1 rounded text-[11px] font-bold whitespace-nowrap border transition-colors ${((categoriaAtiva === 'todos' && c.name === 'Todos') || categoriaAtiva === c.name) ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-emerald-400'}`}
                                    >
                                        {c.name}
                                    </button>
                                ))}
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-slate-100/50 pdv-scroll">
                                {(carregandoProdutos) ? (
                                    <div className="text-center p-10 text-gray-400"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-emerald-600 mx-auto"></div></div>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                        {produtosFiltrados.map(p => (
                                            <button 
                                                key={p.id} 
                                                onClick={() => pdvCart.handleProdutoClick(p)} 
                                                className="bg-white rounded-xl p-2 shadow-sm border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all flex flex-row items-center gap-3 w-full text-left cursor-pointer group"
                                            >
                                                <div className="w-16 h-16 shrink-0 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100 relative overflow-hidden">
                                                    {p.imagem || p.foto || p.urlImagem || p.imageUrl ? (
                                                        <img src={p.imagem || p.foto || p.urlImagem || p.imageUrl} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                    ) : (
                                                        <IoStorefrontOutline className="text-2xl text-slate-300" />
                                                    )}
                                                </div>
                                                <div className="flex flex-col justify-center flex-1 min-w-0">
                                                    <div className="font-bold text-slate-800 text-[11px] sm:text-xs leading-normal break-words whitespace-normal">
                                                        {p.name}
                                                    </div>
                                                    <div className="font-black text-emerald-600 text-[13px] sm:text-sm whitespace-nowrap mt-1">
                                                        {formatarMoeda(p.price)}
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={`absolute md:relative top-0 right-0 bottom-0 flex flex-col shrink-0 min-h-0 w-[85vw] sm:w-[320px] md:w-[350px] bg-white border-l border-slate-200 z-[110] transition-transform duration-300 ${mostrarCarrinhoMobile ? 'translate-x-0 shadow-2xl' : 'translate-x-full md:translate-x-0'}`}>
                            <div className="h-14 px-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
                                <h2 className="font-black text-[13px] text-slate-800 flex items-center gap-2"><IoCart /> Pedido #{pdvCart.vendaAtual?.id?.slice(-6).toUpperCase() || 'NOVO'}</h2>
                                <div className="flex gap-1">
                                    <button onClick={() => setMostrarCarrinhoMobile(false)} className="md:hidden p-1 text-slate-500 font-bold bg-white border rounded">✕</button>
                                    <button onClick={pdvCart.suspenderVenda} disabled={!pdvCart.vendaAtual?.itens?.length} className="bg-white text-blue-600 border px-1.5 py-1 rounded text-[10px] font-bold">PAUSAR</button>
                                    <button onClick={() => pdvCart.iniciarVendaBalcao()} className="bg-white text-red-500 border px-1.5 py-1 rounded text-[10px] font-bold">LIMPAR</button>
                                </div>
                            </div>

                            {/* Cliente Selector Widget */}
                            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0 gap-2 select-none no-print">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0">Cliente:</span>
                                    {pdvCart.clienteSelecionado ? (
                                        <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg border border-blue-100 text-xs font-bold truncate">
                                            <span className="truncate max-w-[120px]">{pdvCart.clienteSelecionado.nome}</span>
                                            <button onClick={() => pdvCart.setClienteSelecionado(null)} className="hover:text-red-500 font-bold ml-1 text-[10px]">✕</button>
                                        </div>
                                    ) : (
                                        <span className="text-xs font-bold text-slate-500">Balcão</span>
                                    )}
                                </div>
                                <button 
                                    onClick={() => setMostrarModalCliente(true)} 
                                    className="bg-white hover:bg-slate-100 border text-slate-700 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                                >
                                    {pdvCart.clienteSelecionado ? 'ALTERAR' : '+ CLIENTE'}
                                </button>
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 bg-white pdv-scroll">
                                {pdvCart.vendaAtual?.itens?.length > 0 ? (
                                    pdvCart.vendaAtual.itens.map(i => (
                                        <div 
                                            key={i.uid} 
                                            onClick={() => pdvCart.setItemParaEditar(i)} 
                                            className="bg-white p-2.5 rounded-lg border border-slate-200 hover:border-emerald-400 cursor-pointer flex flex-row items-center gap-2 w-full transition-colors"
                                        >
                                            <div className="shrink-0"><span className="inline-block text-center bg-slate-100 border border-slate-200 text-slate-800 font-black text-[11px] leading-normal min-w-[28px] px-1.5 py-1 rounded-md">{i.quantity}x</span></div>
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <span className="font-bold text-slate-800 text-[11px] sm:text-xs leading-normal break-words whitespace-normal m-0">{i.name}</span>
                                                {i.observacao && <span className="text-[10px] text-slate-500 font-medium break-words whitespace-normal mt-0.5 m-0">* {i.observacao}</span>}
                                            </div>
                                            <div className="shrink-0 pl-1 text-right"><span className="inline-block font-black text-slate-900 text-[13px] whitespace-nowrap">{formatarMoeda(i.price * i.quantity)}</span></div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60"><IoCart size={40} /><p className="text-[10px] font-bold uppercase mt-2">Caixa Livre</p></div>
                                )}
                            </div>

                            {pdvCart.vendaAtual?.itens?.length > 0 && (
                                <div className="p-3 bg-white border-t border-slate-200 shrink-0">
                                    <div className="flex justify-between items-end mb-3 px-1 gap-2">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase shrink-0">Total:</span>
                                        <span className="font-black text-emerald-600 text-xl sm:text-2xl whitespace-nowrap shrink-0">{formatarMoeda(pdvCart.vendaAtual.total)}</span>
                                    </div>
                                    <button onClick={() => { setMostrarFinalizacao(true); setMostrarCarrinhoMobile(false); }} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-black text-[14px] hover:bg-emerald-700 shadow-md flex items-center justify-center gap-2">
                                        <IoCheckmarkCircleOutline size={20} /> COBRAR (F10)
                                    </button>
                                </div>
                            )}
                        </div>

                        {mostrarCarrinhoMobile && <div className="absolute inset-0 bg-black/50 z-[105] md:hidden" onClick={() => setMostrarCarrinhoMobile(false)}></div>}
                    </div>

                    <div className="w-full shrink-0 bg-slate-800 border-t border-slate-700 p-2 sm:p-3 flex justify-center shadow-[0_-10px_20px_rgba(0,0,0,0.15)] z-[120] relative no-print">
                        <div className="flex flex-wrap justify-center items-center gap-2 w-full max-w-7xl">
                            <button onClick={() => inputBuscaRef.current?.focus()} className="text-white hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm"><kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-emerald-400 font-mono leading-normal">F1</kbd> BUSCAR PROD.</button>
                            <button onClick={abrirHistoricoAtual} className="text-white hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm"><kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-emerald-400 font-mono leading-normal">F3</kbd> HISTÓRICO</button>
                            <button onClick={pdvCart.suspenderVenda} className={`text-white hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm ${!pdvCart.vendaAtual?.itens?.length ? 'opacity-50 cursor-not-allowed' : ''}`}><kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-orange-400 font-mono leading-normal">F4</kbd> PAUSAR</button>
                            <button onClick={() => pdvCart.setMostrarSuspensas(true)} className="text-white hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm relative">
                                <kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-blue-400 font-mono leading-normal">F5</kbd> VER PAUSADAS
                                {pdvCart.vendasSuspensas.length > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] min-w-[18px] px-1 py-0.5 flex items-center justify-center rounded-full leading-none shadow-md">{pdvCart.vendasSuspensas.length}</span>}
                            </button>
                            <button onClick={() => setMostrarModalCliente(true)} className="text-white hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm">
                                <kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-purple-400 font-mono leading-normal">F6</kbd> CLIENTE
                            </button>
                            <div className="w-px h-6 bg-slate-600 mx-1 hidden sm:block"></div>
                            <button onClick={pdvCaixa.abrirMovimentacao} className="text-white hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm"><kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-amber-400 font-mono leading-normal">F8</kbd> SANGRIA / SUPRIMENTO</button>
                            <button onClick={pdvCaixa.prepararFechamento} className="bg-rose-900/60 hover:bg-rose-800 text-white border border-rose-700/50 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm"><kbd className="bg-rose-700 px-1.5 py-0.5 rounded border border-rose-900 text-white font-mono leading-normal">F9</kbd> FECHAR TURNO</button>
                            <button onClick={pdvCaixa.carregarListaTurnos} className="text-white hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm"><kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-emerald-400 font-mono leading-normal">F11</kbd> OUTROS TURNOS</button>
                        </div>
                    </div>

                    <button 
                        onClick={() => setMostrarCarrinhoMobile(true)} 
                        style={{ bottom: 'calc(1rem + var(--altura-da-barra, 60px))' }} 
                        className={`md:hidden fixed right-4 bg-emerald-600 text-white p-4 rounded-full shadow-2xl z-[90] flex items-center gap-2 transition-transform ${pdvCart.vendaAtual?.itens?.length > 0 ? 'scale-100' : 'scale-0'}`}
                    >
                        <IoCart size={24} />
                        <span className="absolute -top-1 -right-1 bg-white text-emerald-600 font-black text-[10px] min-w-[20px] h-5 flex items-center justify-center rounded-full shadow-sm">{pdvCart.vendaAtual?.itens?.length || 0}</span>
                    </button>

                    {/* Modais Componentes */}
                    <ModalSelecaoVariacao produto={pdvCart.produtoParaSelecao} onClose={() => pdvCart.setProdutoParaSelecao(null)} onConfirm={pdvCart.adicionarItem} />
                    <ModalEdicaoItemCarrinho visivel={pdvCart.itemParaEditar !== null} item={pdvCart.itemParaEditar} onClose={() => pdvCart.setItemParaEditar(null)} onConfirm={(u, q, o, n, p) => { pdvCart.salvarEdicaoItem(u, q, o, n, p); if (q === 0) pdvCart.removerItem(u); }} />
                    <ModalAberturaCaixa visivel={mostrarAberturaCaixa} onAbrir={pdvCaixa.handleAbrirCaixa} usuarioNome={userData?.name} />
                    <ModalFechamentoCaixa visivel={pdvCaixa.mostrarFechamentoCaixa} caixa={pdvCaixa.caixaAberto} vendasDoDia={pdvCaixa.vendasTurnoAtual} movimentacoes={pdvCaixa.movimentacoesDoTurno} onClose={() => pdvCaixa.setMostrarFechamentoCaixa(false)} onConfirmarFechamento={(d) => pdvCaixa.handleConfirmarFechamento(d, pdvCart.setVendasSuspensas)} />
                    <ModalMovimentacao visivel={pdvCaixa.mostrarMovimentacao} onClose={() => pdvCaixa.setMostrarMovimentacao(false)} onConfirmar={pdvCaixa.handleSalvarMovimentacao} />
                    <ModalFinalizacao 
                        visivel={mostrarFinalizacao} 
                        venda={pdvCart.vendaAtual} 
                        onClose={() => setMostrarFinalizacao(false)} 
                        onFinalizar={finalizarVenda} 
                        salvando={salvando} 
                        pagamentos={pdvCart.pagamentosAdicionados} 
                        setPagamentos={pdvCart.setPagamentosAdicionados} 
                        cpfNota={cpfNota} 
                        setCpfNota={setCpfNota} 
                        desconto={pdvCart.descontoValor} 
                        setDesconto={pdvCart.setDescontoValor} 
                        acrescimo={pdvCart.acrescimoValor} 
                        setAcrescimo={pdvCart.setAcrescimoValor} 
                        clienteSelecionado={pdvCart.clienteSelecionado}
                        setClienteSelecionado={pdvCart.setClienteSelecionado}
                        onAbrirModalCliente={() => setMostrarModalCliente(true)}
                        estabelecimentoId={estabelecimentoAtivo}
                    />
                    
                    <ModalRecibo visivel={mostrarRecibo} dados={dadosRecibo} onClose={() => { setMostrarRecibo(false); pdvCart.iniciarVendaBalcao(); }} onNovaVenda={() => pdvCart.iniciarVendaBalcao()} onEmitirNfce={pdvNfce.handleEmitirNfce} nfceStatus={pdvNfce.nfceStatus} nfceUrl={pdvNfce.nfceUrl} onBaixarXml={pdvNfce.handleBaixarXml} onConsultarStatus={pdvNfce.handleConsultarStatus} onBaixarPdf={pdvNfce.handleBaixarPdf} onBaixarXmlCancelamento={async (venda) => { try { const res = await vendaService.baixarXmlCancelamentoNfce(venda.fiscal?.idPlugNotas, venda.id.slice(-6)); if (!res.success) toast.error('Erro: ' + res.error); } catch (e) { console.error(e); } }} onEnviarWhatsApp={handleEnviarWhatsApp} />
                    <ModalHistorico visivel={mostrarHistorico} onClose={() => setMostrarHistorico(false)} vendas={vendasHistoricoExibicao} titulo={tituloHistorico} onSelecionarVenda={selecionarVendaHistorico} carregando={pdvCaixa.carregandoHistorico} onProcessarLote={pdvNfce.handleProcessarLoteNfce} onCancelarNfce={pdvNfce.handleCancelarNfce} onBaixarXml={pdvNfce.handleBaixarXml} onConsultarStatus={pdvNfce.handleConsultarStatus} onBaixarPdf={pdvNfce.handleBaixarPdf} onBaixarXmlCancelamento={async (venda) => { try { const res = await vendaService.baixarXmlCancelamentoNfce(venda.fiscal?.idPlugNotas, venda.id.slice(-6)); if (!res.success) toast.error('Erro: ' + res.error); } catch (e) { console.error(e); } }} onEnviarWhatsApp={handleEnviarWhatsApp} />

                    <ModalListaTurnos visivel={mostrarListaTurnos} onClose={() => setMostrarListaTurnos(false)} turnos={pdvCaixa.listaTurnos} carregando={pdvCaixa.carregandoHistorico} onSelecionarTurno={pdvCaixa.visualizarVendasTurno} vendasDoDia={pdvCaixa.vendasTurnoAtual} />   
                    <ModalResumoTurno visivel={pdvCaixa.mostrarResumoTurno} turno={pdvCaixa.turnoSelecionadoResumo} onClose={() => { pdvCaixa.setMostrarResumoTurno(false); if (!pdvCaixa.caixaAberto) setMostrarAberturaCaixa(true); }} />
                    <ModalVendasSuspensas visivel={pdvCart.mostrarSuspensas} onClose={() => pdvCart.setMostrarSuspensas(false)} vendas={pdvCart.vendasSuspensas} onRestaurar={pdvCart.restaurarVendaSuspensa} onExcluir={pdvCart.excluirVendaSuspensa} />              
                    <ModalPesoBalanca visivel={pdvCart.produtoParaPeso !== null} produto={pdvCart.produtoParaPeso} onClose={() => pdvCart.setProdutoParaPeso(null)} onConfirm={pdvCart.adicionarItemPeso} />
                    <ModalOpcoesProduto produto={pdvCart.produtoParaOpcoes} onClose={() => pdvCart.setProdutoParaOpcoes(null)} onSelectOption={pdvCart.handleSelectFracaoOption} />
                    <ModalClientePdv visivel={mostrarModalCliente} estabelecimentoId={estabelecimentoAtivo} onClose={() => setMostrarModalCliente(false)} onSelectCliente={pdvCart.setClienteSelecionado} />
                    <ModalBuscaProduto visivel={mostrarModalBusca} busca={busca} setBusca={setBusca} produtosFiltrados={produtosFiltrados} onClose={() => setMostrarModalBusca(false)} onSelectProduto={pdvCart.handleProdutoClick} />

                    <ToastContainer />
                    {confirmDialog && <ConfirmDialog open={true} title={confirmDialog.title} message={confirmDialog.message} variant={confirmDialog.variant} confirmText={confirmDialog.confirmText} cancelText={confirmDialog.cancelText} onConfirm={() => { setConfirmDialog(null); confirmDialog.onConfirmCb?.(); }} onCancel={() => setConfirmDialog(null)} />}
                    {promptDialog && <PromptDialog open={true} title={promptDialog.title} message={promptDialog.message} defaultValue={promptDialog.defaultValue} placeholder={promptDialog.placeholder} confirmText={promptDialog.confirmText} cancelText={promptDialog.cancelText} onConfirm={(val) => { setPromptDialog(null); promptDialog.onSubmitCb?.(val); }} onCancel={() => setPromptDialog(null)} />}
                </>
            )}
        </div>
    );
};

export default PdvScreen;