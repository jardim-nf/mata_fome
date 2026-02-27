// src/pages/admin/PdvScreen.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { vendaService } from '../../services/vendaService';
import { caixaService } from '../../services/caixaService';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';

// IMPORTAÇÃO DOS MODAIS E FUNÇÕES AUXILIARES
import { 
    formatarMoeda, formatarData, formatarHora,
    ModalEdicaoItemCarrinho, ModalSelecaoVariacao, ModalAberturaCaixa, 
    ModalFechamentoCaixa, ModalMovimentacao, ModalFinalizacao, 
    ModalRecibo, ModalHistorico, ModalListaTurnos, ModalResumoTurno, ModalVendasSuspensas,
    ModalPesoBalanca
} from '../../components/PdvModals';
import { IoArrowBack, IoSearch, IoCart, IoSettingsOutline, IoStorefrontOutline, IoPauseCircleOutline, IoTrashOutline, IoTimeOutline, IoCheckmarkCircleOutline } from 'react-icons/io5';

const PdvScreen = () => {
    const { userData, currentUser } = useAuth();
    const navigate = useNavigate();

    // Estados
    const [estabelecimentos, setEstabelecimentos] = useState([]);
    const [estabelecimentoAtivo, setEstabelecimentoAtivo] = useState(null);
    const [nomeLoja, setNomeLoja] = useState('...');
    const [vendaAtual, setVendaAtual] = useState(null);
    const [produtos, setProdutos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [vendasBase, setVendasBase] = useState([]);
    const [vendasHistoricoExibicao, setVendasHistoricoExibicao] = useState([]);
    const [tituloHistorico, setTituloHistorico] = useState("Histórico");
    const [listaTurnos, setListaTurnos] = useState([]);
    const [carregandoProdutos, setCarregandoProdutos] = useState(true);
    const [carregandoHistorico, setCarregandoHistorico] = useState(false);
    const [categoriaAtiva, setCategoriaAtiva] = useState('todos');
    const [busca, setBusca] = useState('');
    const [mostrarCarrinhoMobile, setMostrarCarrinhoMobile] = useState(false);

    // Modais
    const [caixaAberto, setCaixaAberto] = useState(null);
    const [verificandoCaixa, setVerificandoCaixa] = useState(true);
    const [mostrarAberturaCaixa, setMostrarAberturaCaixa] = useState(false);
    const [mostrarFechamentoCaixa, setMostrarFechamentoCaixa] = useState(false);
    const [mostrarMovimentacao, setMostrarMovimentacao] = useState(false);
    const [movimentacoesDoTurno, setMovimentacoesDoTurno] = useState({ totalSuprimento: 0, totalSangria: 0 });
    const [mostrarHistorico, setMostrarHistorico] = useState(false);
    const [mostrarListaTurnos, setMostrarListaTurnos] = useState(false);
    const [mostrarFinalizacao, setMostrarFinalizacao] = useState(false);
    const [mostrarRecibo, setMostrarRecibo] = useState(false);
    const [mostrarResumoTurno, setMostrarResumoTurno] = useState(false);
    const [turnoSelecionadoResumo, setTurnoSelecionadoResumo] = useState(null);
    const [itemParaEditar, setItemParaEditar] = useState(null);
    const [produtoParaPeso, setProdutoParaPeso] = useState(null);

    const [vendasSuspensas, setVendasSuspensas] = useState([]);
    const [mostrarSuspensas, setMostrarSuspensas] = useState(false);

    // Pagamento
    const [dadosRecibo, setDadosRecibo] = useState(null);
    const [cpfNota, setCpfNota] = useState('');
    const [nfceStatus, setNfceStatus] = useState('idle');
    const [nfceUrl, setNfceUrl] = useState(null);
    const [produtoParaSelecao, setProdutoParaSelecao] = useState(null);
    const [pagamentosAdicionados, setPagamentosAdicionados] = useState([]);
    const [salvando, setSalvando] = useState(false);
    const [descontoValor, setDescontoValor] = useState('');
    const [acrescimoValor, setAcrescimoValor] = useState('');
    
    // Leitor de Código de Barras
    const [barcodeAviso, setBarcodeAviso] = useState(null);
    const bufferCodigoBarras = useRef('');
    const timeoutCodigoBarras = useRef(null);
    const inputBuscaRef = useRef(null);

    useEffect(() => {
        if (!userData || !currentUser) return;
        const carregarLojas = async () => {
            let listaIds = userData.estabelecimentoId ? [userData.estabelecimentoId] : (userData.estabelecimentosGerenciados && Array.isArray(userData.estabelecimentosGerenciados) ? userData.estabelecimentosGerenciados : [currentUser.uid]);
            if (listaIds.length === 0) return;
            const promessas = listaIds.map(async (id) => {
                try { const docSnap = await getDoc(doc(db, 'estabelecimentos', id)); return docSnap.exists() ? { id, nome: docSnap.data().nome || 'Loja Sem Nome' } : null; } catch (e) { return null; }
            });
            let lojasCarregadas = (await Promise.all(promessas)).filter(l => l !== null);
            if (userData.estabelecimentoId && lojasCarregadas.length > 0) lojasCarregadas = [lojasCarregadas[0]];
            setEstabelecimentos(lojasCarregadas);
            if (!estabelecimentoAtivo && lojasCarregadas.length > 0) { setEstabelecimentoAtivo(lojasCarregadas[0].id); setNomeLoja(lojasCarregadas[0].nome); }
        };
        carregarLojas();
    }, [userData, currentUser]);

    const trocarLoja = (id) => { const loja = estabelecimentos.find(e => e.id === id); if (loja) { setEstabelecimentoAtivo(id); setNomeLoja(loja.nome); setCaixaAberto(null); setVendasBase([]); setProdutos([]); setVendasSuspensas([]); } };

    const vendasTurnoAtual = useMemo(() => {
        if (!caixaAberto) return [];
        let timeAbertura; try { timeAbertura = caixaAberto.dataAbertura?.toDate ? caixaAberto.dataAbertura.toDate().getTime() : new Date(caixaAberto.dataAbertura).getTime(); } catch { timeAbertura = Date.now(); }
        return vendasBase.filter(v => { let timeVenda; try { timeVenda = v.createdAt?.toDate ? v.createdAt.toDate().getTime() : new Date(v.createdAt).getTime(); } catch { return false; } return v.usuarioId === currentUser.uid && timeVenda >= (timeAbertura - 60000); });
    }, [vendasBase, caixaAberto, currentUser]);

    const produtosFiltrados = useMemo(() => {
        const termo = busca?.toLowerCase().trim() || "";
        return produtos.filter(p => {
            if (categoriaAtiva !== 'todos' && p.categoria !== categoriaAtiva && p.categoriaId !== categoriaAtiva) return false;
            if (!termo) return true;
            return (p.name?.toLowerCase() || "").includes(termo) || (p.codigoBarras ? String(p.codigoBarras).toLowerCase() : "").includes(termo) || (p.id ? String(p.id).toLowerCase() : "").includes(termo) || (p.referencia ? String(p.referencia).toLowerCase() : "").includes(termo);
        });
    }, [produtos, categoriaAtiva, busca]);

    const iniciarVendaBalcao = useCallback(() => {
        if (!caixaAberto) return;
        setMostrarRecibo(false); setMostrarHistorico(false); setMostrarFinalizacao(false);
        setVendaAtual({ id: Date.now().toString(), itens: [], total: 0 });
        setCpfNota(''); setNfceStatus('idle'); setBusca(''); setDescontoValor(''); setAcrescimoValor(''); setPagamentosAdicionados([]);
        setTimeout(() => inputBuscaRef.current?.focus(), 100);
    }, [caixaAberto]);

    const suspenderVenda = useCallback(() => {
        if (!vendaAtual || vendaAtual.itens.length === 0) return alert("O carrinho está vazio!");
        const nomeCliente = prompt("Nome identificador (Opcional):") || `Cliente ${vendasSuspensas.length + 1}`;
        if (nomeCliente === null) return; 
        setVendasSuspensas(prev => [...prev, { ...vendaAtual, nomeReferencia: nomeCliente, dataSuspensao: new Date(), descontoGuardado: descontoValor, acrescimoGuardado: acrescimoValor, pagamentosGuardados: pagamentosAdicionados }]);
        iniciarVendaBalcao(); 
    }, [vendaAtual, vendasSuspensas, iniciarVendaBalcao, descontoValor, acrescimoValor, pagamentosAdicionados]);

    const restaurarVendaSuspensa = (vs) => {
        if (vendaAtual && vendaAtual.itens.length > 0 && !window.confirm("Atenção: O seu carrinho atual tem produtos. Substituir pela venda em espera?")) return;
        setVendaAtual({ id: vs.id, itens: vs.itens, total: vs.total }); setDescontoValor(vs.descontoGuardado || ''); setAcrescimoValor(vs.acrescimoGuardado || ''); setPagamentosAdicionados(vs.pagamentosGuardados || []);
        setVendasSuspensas(prev => prev.filter(v => v.id !== vs.id)); setMostrarSuspensas(false); setTimeout(() => inputBuscaRef.current?.focus(), 100);
    };

    const excluirVendaSuspensa = (id) => { if(window.confirm("Excluir este pedido em espera?")) setVendasSuspensas(prev => prev.filter(v => v.id !== id)); };
    const abrirHistoricoAtual = useCallback(() => { setTituloHistorico("Vendas Turno Atual"); setVendasHistoricoExibicao(vendasTurnoAtual); setMostrarHistorico(prev => !prev); }, [vendasTurnoAtual]);
    const carregarListaTurnos = useCallback(async () => { if (!estabelecimentoAtivo) return; setCarregandoHistorico(true); setMostrarListaTurnos(true); setListaTurnos(await caixaService.listarTurnos(currentUser.uid, estabelecimentoAtivo)); setCarregandoHistorico(false); }, [currentUser, estabelecimentoAtivo]);
    const visualizarVendasTurno = useCallback(async (turno) => { setCarregandoHistorico(true); setTituloHistorico(`Vendas ${turno.dataAbertura ? formatarData(turno.dataAbertura) : ''}`); setVendasHistoricoExibicao(await vendaService.buscarVendasPorIntervalo(currentUser.uid, estabelecimentoAtivo, turno.dataAbertura, turno.dataFechamento)); setCarregandoHistorico(false); setMostrarListaTurnos(false); setMostrarHistorico(true); }, [currentUser, estabelecimentoAtivo]);
    const prepararFechamento = useCallback(async () => { if (!caixaAberto) return; setMovimentacoesDoTurno(await caixaService.buscarMovimentacoes(caixaAberto.id)); setMostrarFechamentoCaixa(true); }, [caixaAberto]);
    const abrirMovimentacao = useCallback(() => { if (!caixaAberto) return alert("Caixa Fechado!"); setMostrarMovimentacao(true); }, [caixaAberto]);
    const handleSalvarMovimentacao = async (dados) => { const res = await caixaService.adicionarMovimentacao(caixaAberto.id, { ...dados, usuarioId: currentUser.uid }); if (res.success) { alert(`Sucesso!`); setMostrarMovimentacao(false); } else alert('Erro: ' + res.error); };

    const handleConfirmarFechamento = async (dados) => { 
        const res = await caixaService.fecharCaixa(caixaAberto.id, dados); 
        if (res.success) { 
            alert('🔒 Turno encerrado!'); setCaixaAberto(null); setVendasBase([]); setVendasSuspensas([]); setMostrarFechamentoCaixa(false); setVendaAtual(null); 
            setTurnoSelecionadoResumo({ ...caixaAberto, resumoVendas: dados.resumoVendas, saldoFinalInformado: dados.saldoFinalInformado, diferenca: dados.diferenca, dataFechamento: new Date(), status: 'fechado' }); setMostrarResumoTurno(true);
        } else alert('Erro ao fechar caixa: ' + res.error);
    };

    const handleAbrirCaixa = async (saldoInicial) => {
        const checkAtivo = await caixaService.verificarCaixaAberto(currentUser.uid, estabelecimentoAtivo);
        if (checkAtivo) { alert('Atenção: Você já possui um turno em andamento!'); setCaixaAberto(checkAtivo); setMostrarAberturaCaixa(false); return; }
        const res = await caixaService.abrirCaixa({ usuarioId: currentUser.uid, estabelecimentoId: estabelecimentoAtivo, saldoInicial });
        if (res.success) { setCaixaAberto(await caixaService.verificarCaixaAberto(currentUser.uid, estabelecimentoAtivo) || res); setVendasBase([]); setVendasSuspensas([]); setMostrarAberturaCaixa(false); setVendaAtual({ id: Date.now().toString(), itens: [], total: 0 }); setTimeout(() => inputBuscaRef.current?.focus(), 500); } else alert('Erro: ' + res.error);
    };

    const selecionarVendaHistorico = (v) => { setDadosRecibo(v); setNfceStatus(v.fiscal?.status === 'AUTORIZADA' ? 'success' : 'idle'); setNfceUrl(v.fiscal?.pdf || null); setMostrarHistorico(false); setMostrarRecibo(true); };

    const handleProdutoClick = useCallback((p) => {
        const ePeso = p.vendidoPorPeso === true || String(p.fiscal?.unidade || '').trim().toUpperCase() === 'KG' || String(p.unidade || '').trim().toUpperCase() === 'KG';
        const cb = (nova) => { if (ePeso) setProdutoParaPeso(p); else if (p.temVariacoes) setProdutoParaSelecao(p); else adicionarItem(p, null, nova); };
        if (!vendaAtual) { const novaVenda = { id: Date.now().toString(), itens: [], total: 0 }; setVendaAtual(novaVenda); setTimeout(() => cb(novaVenda), 0); } else cb(null);
    }, [vendaAtual]);

    const adicionarItemPeso = (produto, pesoKg, totalCalculado) => {
        setVendaAtual(prev => { if (!prev) return null; const nv = [...prev.itens, { uid: `${produto.id}-peso-${Date.now()}`, id: produto.id, name: `${produto.name} (${pesoKg} Kg)`, price: totalCalculado, quantity: 1, observacao: `Peso: ${pesoKg} Kg`, pesoKg }]; return { ...prev, itens: nv, total: nv.reduce((s, i) => s + (i.price * i.quantity), 0) }; });
        setProdutoParaPeso(null); setBusca(''); inputBuscaRef.current?.focus();
    };

    const adicionarItem = (p, v, vendaRef = null) => {
        setVendaAtual(prev => {
            const target = prev || vendaRef; if (!target) return null;
            const uid = `${p.id}-${v ? v.id : 'p'}`; const ex = target.itens.find(i => i.uid === uid);
            const nv = ex ? target.itens.map(i => i.uid === uid ? { ...i, quantity: i.quantity + 1 } : i) : [...target.itens, { uid, id: p.id, name: v ? `${p.name} ${v.nome}` : p.name, price: v ? Number(v.preco) : p.price, quantity: 1, observacao: '' }];
            return { ...target, itens: nv, total: nv.reduce((s, i) => s + (i.price * i.quantity), 0) };
        }); setProdutoParaSelecao(null); setBusca(''); inputBuscaRef.current?.focus();
    };

    const salvarEdicaoItem = (uid, novaQuantidade, novaObservacao) => {
        setVendaAtual(prev => { 
            if (!prev) return null; 
            const nv = prev.itens.map(i => i.uid === uid ? { ...i, quantity: novaQuantidade, observacao: novaObservacao } : i ); 
            return { ...prev, itens: nv, total: nv.reduce((s, i) => s + (i.price * i.quantity), 0) }; 
        }); 
        setItemParaEditar(null);
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
                    const atualiza = (l) => l.map(v => v.id === venda.id ? { ...v, fiscal: { ...v.fiscal, status: 'PROCESSANDO', idPlugNotas: res.idPlugNotas } } : v );
                    setVendasBase(atualiza); setVendasHistoricoExibicao(atualiza);
                    if (dadosRecibo?.id === venda.id) setDadosRecibo(p => ({ ...p, fiscal: { ...p.fiscal, status: 'PROCESSANDO', idPlugNotas: res.idPlugNotas } }));
                } else { setNfceStatus('error'); alert("❌ Erro: " + res.error); }
            } catch (e) { setNfceStatus('error'); alert('Falha ao reenviar.'); }
        } else {
            if (!venda.fiscal?.idPlugNotas) return alert("Sem ID PlugNotas.");
            setNfceStatus('loading');
            try {
                const res = await vendaService.consultarStatusNfce(venda.id, venda.fiscal.idPlugNotas);
                if (res.sucesso) {
                    const atualiza = (l) => l.map(v => v.id === venda.id ? { ...v, fiscal: { ...v.fiscal, status: res.statusAtual, pdf: res.pdf || v.fiscal?.pdf, xml: res.xml || v.fiscal?.xml, motivoRejeicao: res.mensagem || v.fiscal?.motivoRejeicao } } : v );
                    setVendasBase(atualiza); setVendasHistoricoExibicao(atualiza);
                    if (dadosRecibo?.id === venda.id) { setDadosRecibo(p => ({ ...p, fiscal: { ...p.fiscal, status: res.statusAtual, pdf: res.pdf, xml: res.xml, motivoRejeicao: res.mensagem } })); setNfceStatus(res.statusAtual === 'AUTORIZADA' || res.statusAtual === 'CONCLUIDO' ? 'success' : 'idle'); setNfceUrl(res.pdf); }
                    alert(`Status: ${res.statusAtual}`);
                } else { setNfceStatus('error'); alert("Erro: " + res.error); }
            } catch (e) { setNfceStatus('error'); alert("Falha ao consultar."); }
        }
    };

    const handleEnviarWhatsApp = (venda) => {
        if (!venda.fiscal?.pdf) return alert("⚠️ Link PDF indisponível.");
        let tel = prompt("📱 Número WhatsApp:", venda.clienteTelefone || venda.cliente?.telefone || "");
        if (tel === null) return; tel = tel.replace(/\D/g, '');
        const msg = encodeURIComponent(`Olá! Agradecemos a preferência. 😃\nSua Nota Fiscal de ${formatarMoeda(venda.total)}:\n${venda.fiscal.pdf}`);
        window.open(tel.length >= 10 ? `https://wa.me/${tel.startsWith('55') ? tel : `55${tel}`}?text=${msg}` : `https://api.whatsapp.com/send?text=${msg}`, '_blank');
    };

    const removerItem = (uid) => setVendaAtual(prev => ({ ...prev, itens: prev.itens.filter(i => i.uid !== uid), total: prev.itens.filter(i => i.uid !== uid).reduce((s, i) => s + (i.price * i.quantity), 0) }));

    const pdvSyncRef = useRef({});
    useEffect(() => { pdvSyncRef.current = { produtos, handleProdutoClick, bloqueado: mostrarFinalizacao || mostrarRecibo || mostrarHistorico || mostrarSuspensas || mostrarMovimentacao || mostrarListaTurnos || mostrarAberturaCaixa || !caixaAberto || produtoParaSelecao !== null || itemParaEditar !== null || produtoParaPeso !== null }; });

    useEffect(() => {
        const onBarcodeRead = (e) => {
            if (e.key.length > 1 && e.key !== 'Enter') return;
            if (e.key === 'Enter' && bufferCodigoBarras.current.length >= 3) {
                const codigo = bufferCodigoBarras.current; bufferCodigoBarras.current = '';
                if (timeoutCodigoBarras.current) clearTimeout(timeoutCodigoBarras.current);
                const state = pdvSyncRef.current; if (state.bloqueado) return;
                const pEncontrado = state.produtos.find(p => String(p.codigoBarras) === codigo || String(p.codigo) === codigo || String(p.referencia) === codigo );
                if (pEncontrado) state.handleProdutoClick(pEncontrado); else { tocarBeepErro(); setBarcodeAviso(`Produto não registado.`); setTimeout(() => setBarcodeAviso(null), 3000); }
                return;
            }
            bufferCodigoBarras.current += e.key;
            if (timeoutCodigoBarras.current) clearTimeout(timeoutCodigoBarras.current);
            timeoutCodigoBarras.current = setTimeout(() => { bufferCodigoBarras.current = ''; }, 50);
        };
        window.addEventListener('keydown', onBarcodeRead); return () => window.removeEventListener('keydown', onBarcodeRead);
    }, []);

    const finalizarVenda = async () => {
        setSalvando(true);
        const descNum = parseFloat(descontoValor || 0); const acrNum = parseFloat(acrescimoValor || 0);
        const totalFinal = Math.max(0, vendaAtual.total + acrNum - descNum);
        const totalPago = pagamentosAdicionados.reduce((acc, p) => acc + p.valor, 0);
        const d = { estabelecimentoId: estabelecimentoAtivo, status: 'finalizada', formaPagamento: pagamentosAdicionados.length === 1 ? pagamentosAdicionados[0].forma : 'misto', pagamentos: pagamentosAdicionados, subtotal: vendaAtual.total, desconto: descNum, acrescimo: acrNum, total: totalFinal, troco: Math.max(0, totalPago - totalFinal), valorRecebido: totalPago, itens: vendaAtual.itens, usuarioId: currentUser.uid, cliente: 'Balcão', clienteCpf: cpfNota || null, createdAt: new Date() };
        const res = await vendaService.salvarVenda(d);
        if (res.success) { setVendasBase(p => [{ ...d, id: res.vendaId }, ...p]); setDadosRecibo({ ...d, id: res.vendaId }); setVendaAtual(null); setMostrarFinalizacao(false); setMostrarRecibo(true); setDescontoValor(''); setAcrescimoValor(''); setCpfNota(''); setPagamentosAdicionados([]); }
        setSalvando(false);
    };

    const tocarBeepErro = () => { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, ctx.currentTime); gain.gain.setValueAtTime(0.15, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5); osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.5); } catch (e) {} };
    
    const handleEmitirNfce = async () => {
        if (!dadosRecibo?.id) return; setNfceStatus('loading');
        try {
            const res = await vendaService.emitirNfce(dadosRecibo.id, dadosRecibo.clienteCpf);
            if (res.sucesso || res.success) {
                const atualiza = (l) => l.map(v => v.id === dadosRecibo.id ? { ...v, fiscal: { ...v.fiscal, status: 'PROCESSANDO', idPlugNotas: res.idPlugNotas } } : v );
                setVendasBase(atualiza); setVendasHistoricoExibicao(atualiza); setDadosRecibo(p => ({ ...p, fiscal: { ...p.fiscal, status: 'PROCESSANDO', idPlugNotas: res.idPlugNotas } }));
            } else { setNfceStatus('error'); tocarBeepErro(); alert(res.error || "Erro ao solicitar"); }
        } catch (e) { setNfceStatus('error'); tocarBeepErro(); alert('Erro de conexão.'); }
    };

    useEffect(() => {
        let unsub = () => {};
        if (mostrarRecibo && dadosRecibo?.id) {
            unsub = onSnapshot(doc(db, 'vendas', dadosRecibo.id), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data(); setDadosRecibo(p => ({ ...p, fiscal: data.fiscal }));
                    if (data.fiscal) {
                        const st = data.fiscal.status?.toUpperCase();
                        if (st === 'AUTORIZADA' || st === 'CONCLUIDO') { setNfceStatus('success'); setNfceUrl(data.fiscal.pdf); const atualiza = p => p.map(v => v.id === dadosRecibo.id ? { ...v, fiscal: data.fiscal } : v); setVendasBase(atualiza); setVendasHistoricoExibicao(atualiza); } 
                        else if (st === 'REJEITADO' || st === 'REJEITADA' || st === 'DENEGADO') { setNfceStatus('error'); setNfceUrl(null); const atualiza = p => p.map(v => v.id === dadosRecibo.id ? { ...v, fiscal: data.fiscal } : v); setVendasBase(atualiza); setVendasHistoricoExibicao(atualiza); } 
                        else if (st === 'PROCESSANDO') { setNfceStatus('loading'); }
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
                        const atualiza = (l) => l.map(v => v.id === dadosRecibo.id ? { ...v, fiscal: { ...v.fiscal, status: res.statusAtual, pdf: res.pdf, xml: res.xml, motivoRejeicao: res.mensagem } } : v );
                        setVendasBase(atualiza); setVendasHistoricoExibicao(atualiza); setDadosRecibo(p => ({...p, fiscal: { ...p.fiscal, status: res.statusAtual, pdf: res.pdf, xml: res.xml, motivoRejeicao: res.mensagem }}));
                        if (ns === 'error') tocarBeepErro();
                    }
                } catch (e) {}
            }, 3000);
        }
        return () => clearInterval(intervalo);
    }, [nfceStatus, dadosRecibo]);

    const handleProcessarLoteNfce = async (vendasParaProcessar) => {
        if (!vendasParaProcessar || vendasParaProcessar.length === 0 || !window.confirm(`Reprocessar ${vendasParaProcessar.length} notas?`)) return;
        let sucesso = 0; let canceladas = 0; let falhas = 0; let listaAtualizada = [...vendasHistoricoExibicao];
        for (let i = 0; i < vendasParaProcessar.length; i++) {
            const venda = vendasParaProcessar[i]; const idPlugNotas = venda.fiscal?.idPlugNotas;
            try {
                let statusAtual = 'REJEITADO'; let pdfAtual = null;
                if (idPlugNotas) {
                    const res = await vendaService.consultarStatusNfce(venda.id, idPlugNotas);
                    if (res.sucesso) {
                        statusAtual = res.statusAtual?.toUpperCase(); pdfAtual = res.pdf || venda.fiscal?.pdf;
                        if (statusAtual === 'CONCLUIDO' || statusAtual === 'AUTORIZADA') { sucesso++; listaAtualizada = listaAtualizada.map(v => v.id === venda.id ? { ...v, fiscal: { ...v.fiscal, status: 'AUTORIZADA', pdf: pdfAtual } } : v ); continue; }
                        if (statusAtual === 'CANCELADO' || statusAtual === 'CANCELADA') { canceladas++; listaAtualizada = listaAtualizada.map(v => v.id === venda.id ? { ...v, status: 'cancelada', fiscal: { ...v.fiscal, status: 'CANCELADO' } } : v ); continue; }
                    }
                }
                if (statusAtual === 'REJEITADO' || statusAtual === 'ERRO' || !idPlugNotas) {
                    const res = await vendaService.emitirNfce(venda.id, venda.clienteCpf);
                    if (res.sucesso || res.success) { sucesso++; listaAtualizada = listaAtualizada.map(v => v.id === venda.id ? { ...v, fiscal: { ...v.fiscal, status: 'PROCESSANDO', idPlugNotas: res.idPlugNotas } } : v ); } else { falhas++; }
                }
            } catch (e) { falhas++; }
        }
        setVendasHistoricoExibicao(listaAtualizada); setVendasBase(prev => prev.map(v => listaAtualizada.find(lu => lu.id === v.id) || v));
        if (falhas > 0) tocarBeepErro(); alert(`Concluído!\n✅ Sucessos: ${sucesso}\n🚫 Canceladas: ${canceladas}\n❌ Falhas: ${falhas}`);
    };

    const handleCancelarNfce = async () => {
        if (!dadosRecibo?.id) return; const j = window.prompt("Motivo (MIN 15 chars):");
        if (!j) return; if (j.trim().length < 15) return alert("Mínimo 15 caracteres.");
        setNfceStatus('loading');
        try {
            const res = await vendaService.cancelarNfce(dadosRecibo.id, j.trim());
            if (res.success) { alert("Enviado!"); setDadosRecibo(p => ({ ...p, status: 'cancelada', fiscal: { ...p.fiscal, status: 'PROCESSANDO' } })); const atualiza = (l) => l.map(v => v.id === dadosRecibo.id ? { ...v, status: 'cancelada', fiscal: { ...v.fiscal, status: 'PROCESSANDO' } } : v ); setVendasBase(atualiza); setVendasHistoricoExibicao(atualiza); } else { alert("Erro: " + res.error); }
        } catch (e) { alert('Falha de comunicação.'); } finally { setNfceStatus('idle'); }
    };

    const handleBaixarXml = async (venda) => { if (!venda.fiscal?.idPlugNotas) return alert("Sem ID"); try { const res = await vendaService.baixarXmlNfce(venda.fiscal.idPlugNotas, venda.id.slice(-6)); if (!res.success) alert("Erro: " + res.error); } catch (e) {} };
    const handleBaixarPdf = async (venda) => { const id = venda.fiscal?.idPlugNotas; if (!id) return alert("Sem ID"); setNfceStatus('loading'); try { const res = await vendaService.baixarPdfNfce(id, venda.fiscal?.pdf); if (!res.success) alert("Erro: " + res.error); } catch (e) {} finally { if (nfceStatus === 'loading') setNfceStatus('idle'); } };

    useEffect(() => { if (!estabelecimentoAtivo || !currentUser) return; const i = async () => { setVerificandoCaixa(true); const c = await caixaService.verificarCaixaAberto(currentUser.uid, estabelecimentoAtivo); if (c) { setCaixaAberto(c); setVendasBase(await vendaService.buscarVendasPorEstabelecimento(estabelecimentoAtivo, 50)); setVendaAtual({ id: Date.now().toString(), itens: [], total: 0 }); setTimeout(() => inputBuscaRef.current?.focus(), 500); } else { setMostrarAberturaCaixa(true); } setVerificandoCaixa(false); }; i(); }, [currentUser, estabelecimentoAtivo]);
    
    useEffect(() => { if (!estabelecimentoAtivo) return; setCarregandoProdutos(true); setProdutos([]); setCategorias([]); const u = onSnapshot(query(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'cardapio'), orderBy('ordem', 'asc')), (s) => { const c = s.docs.map(d => ({ id: d.id, ...d.data() })); setCategorias([{ id: 'todos', name: 'Todos' }, ...c.map(x => ({ id: x.nome || x.id, name: x.nome || x.id }))]); let all = new Map(); let cp = 0; if (c.length === 0) { setProdutos([]); setCarregandoProdutos(false); return; } c.forEach(k => { onSnapshot(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'cardapio', k.id, 'itens'), (is) => { const it = is.docs.map(i => { const d = i.data(); const vs = d.variacoes?.filter(v => v.ativo) || []; return { ...d, id: i.id, name: d.nome || "S/ Nome", categoria: k.nome || "Geral", categoriaId: k.id, price: vs.length > 0 ? Math.min(...vs.map(x => Number(x.preco))) : Number(d.preco || 0), temVariacoes: vs.length > 0, variacoes: vs }; }); all.set(k.id, it); setProdutos(Array.from(all.values()).flat()); cp++; if (cp >= c.length) setCarregandoProdutos(false); }); }); }); return () => u(); }, [estabelecimentoAtivo]);

    useEffect(() => { const handler = (e) => { setTurnoSelecionadoResumo(e.detail); setMostrarListaTurnos(false); setMostrarResumoTurno(true); }; document.addEventListener('abrirRelatorioTurno', handler); return () => document.removeEventListener('abrirRelatorioTurno', handler); }, []);

    useEffect(() => {
        const h = (e) => {
            if (!caixaAberto && !mostrarAberturaCaixa) return;
            if (e.key === 'F1') { e.preventDefault(); inputBuscaRef.current?.focus(); }
            if (e.key === 'F2') { e.preventDefault(); iniciarVendaBalcao(); }
            if (e.key === 'F3') { e.preventDefault(); abrirHistoricoAtual(); }
            if (e.key === 'F4') { e.preventDefault(); suspenderVenda(); }
            if (e.key === 'F5') { e.preventDefault(); setMostrarSuspensas(true); }
            if (e.key === 'F8') { e.preventDefault(); abrirMovimentacao(); }
            if (e.key === 'F9') { e.preventDefault(); prepararFechamento(); }
            if (e.key === 'F10' && vendaAtual?.itens.length > 0) { e.preventDefault(); setMostrarFinalizacao(true); setMostrarCarrinhoMobile(false); }
            if (e.key === 'F11') { e.preventDefault(); carregarListaTurnos(); }
            if (e.key === 'Escape') { setItemParaEditar(null); setProdutoParaSelecao(null); setProdutoParaPeso(null); setMostrarFinalizacao(false); setMostrarRecibo(false); setMostrarHistorico(false); setMostrarFechamentoCaixa(false); setMostrarListaTurnos(false); setMostrarMovimentacao(false); setMostrarResumoTurno(false); setMostrarSuspensas(false); setMostrarCarrinhoMobile(false); }
        }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
    }, [caixaAberto, iniciarVendaBalcao, prepararFechamento, abrirHistoricoAtual, carregarListaTurnos, abrirMovimentacao, vendaAtual, suspenderVenda]);

    return (
        // 🔥 Container ajustado para fixed inset-0 (sem w-full nem h-dvh explícitos)
        <div id="main-app-wrapper" className="fixed inset-0 flex flex-col bg-slate-100 font-sans text-slate-800 overflow-hidden z-[9999]">
            
            {/* Notificações Topo */}
            {barcodeAviso && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-[9999] font-bold text-xs flex items-center gap-2">
                    <IoStorefrontOutline size={16} /> {barcodeAviso}
                </div>
            )}

            {verificandoCaixa && !caixaAberto && !mostrarAberturaCaixa ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-white">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-emerald-600"></div>
                    <span className="font-bold text-slate-500 text-sm">Carregando PDV...</span>
                </div>
            ) : (
                <>
                    {/* CORPO DA TELA - Com relative para ancorar o carrinho absolute no mobile */}
                    <div className="flex-1 flex min-h-0 overflow-hidden bg-white relative">
                        
                        {/* ⬅️ LADO ESQUERDO: CATÁLOGO DE PRODUTOS */}
                        <div className="flex-1 flex flex-col min-w-0 min-h-0">
                            <div className="h-14 px-4 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => navigate('/admin-dashboard')} className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
                                        <IoArrowBack size={18} />
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${caixaAberto ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                        <h1 className="text-sm font-black text-slate-800 uppercase truncate max-w-[150px]">{nomeLoja}</h1>
                                    </div>
                                </div>
                                <div className="flex items-center flex-1 max-w-sm ml-4">
                                    <div className="relative w-full">
                                        <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input 
                                            ref={inputBuscaRef} type="text" placeholder="Buscar (F1)..." 
                                            className="w-full pl-9 pr-3 py-1.5 bg-slate-100 border border-transparent rounded text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all" 
                                            value={busca} onChange={e => setBusca(e.target.value)} 
                                        />
                                    </div>
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

                            {/* ÁREA DOS PRODUTOS */}
                            <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-slate-100/50 pdv-scroll">
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                    {produtosFiltrados.map(p => (
                                        <button 
                                            key={p.id} 
                                            onClick={() => handleProdutoClick(p)} 
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
                            </div>
                        </div>

                        {/* ➡️ LADO DIREITO: CARRINHO (Absolute no mobile, relative no pc) */}
                        <div className={`absolute md:relative top-0 right-0 bottom-0 flex flex-col shrink-0 min-h-0 w-[85vw] sm:w-[320px] md:w-[350px] bg-white border-l border-slate-200 z-[110] transition-transform duration-300 ${mostrarCarrinhoMobile ? 'translate-x-0 shadow-2xl' : 'translate-x-full md:translate-x-0'}`}>
                            <div className="h-14 px-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
                                <h2 className="font-black text-[13px] text-slate-800 flex items-center gap-2"><IoCart /> Pedido #{vendaAtual?.id?.slice(-6).toUpperCase() || 'NOVO'}</h2>
                                <div className="flex gap-1">
                                    <button onClick={() => setMostrarCarrinhoMobile(false)} className="md:hidden p-1 text-slate-500 font-bold bg-white border rounded">✕</button>
                                    <button onClick={suspenderVenda} disabled={!vendaAtual?.itens?.length} className="bg-white text-blue-600 border px-1.5 py-1 rounded text-[10px] font-bold">PAUSAR</button>
                                    <button onClick={iniciarVendaBalcao} className="bg-white text-red-500 border px-1.5 py-1 rounded text-[10px] font-bold">LIMPAR</button>
                                </div>
                            </div>

                            {/* LISTA DOS ITENS NO CARRINHO */}
                            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 bg-white pdv-scroll">
                                {vendaAtual?.itens?.length > 0 ? (
                                    vendaAtual.itens.map(i => (
                                        <div 
                                            key={i.uid} 
                                            onClick={() => setItemParaEditar(i)} 
                                            className="bg-white p-2.5 rounded-lg border border-slate-200 hover:border-emerald-400 cursor-pointer flex flex-row items-center gap-2 w-full transition-colors"
                                        >
                                            <div className="shrink-0">
                                                <span className="inline-block text-center bg-slate-100 border border-slate-200 text-slate-800 font-black text-[11px] leading-normal min-w-[28px] px-1.5 py-1 rounded-md">
                                                    {i.quantity}x
                                                </span>
                                            </div>

                                            <div className="flex flex-col flex-1 min-w-0">
                                                <span className="font-bold text-slate-800 text-[11px] sm:text-xs leading-normal break-words whitespace-normal m-0">
                                                    {i.name}
                                                </span>
                                                {i.observacao && (
                                                    <span className="text-[10px] text-slate-500 font-medium break-words whitespace-normal mt-0.5 m-0">
                                                        * {i.observacao}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="shrink-0 pl-1 text-right">
                                                <span className="inline-block font-black text-slate-900 text-[13px] whitespace-nowrap">
                                                    {formatarMoeda(i.price * i.quantity)}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60">
                                        <IoCart size={40} />
                                        <p className="text-[10px] font-bold uppercase mt-2">Caixa Livre</p>
                                    </div>
                                )}
                            </div>

                            {vendaAtual?.itens?.length > 0 && (
                                <div className="p-3 bg-white border-t border-slate-200 shrink-0">
                                    <div className="flex justify-between items-end mb-3 px-1 gap-2">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase shrink-0">Total:</span>
                                        <span className="font-black text-emerald-600 text-xl sm:text-2xl whitespace-nowrap shrink-0">{formatarMoeda(vendaAtual.total)}</span>
                                    </div>
                                    <button onClick={() => { setMostrarFinalizacao(true); setMostrarCarrinhoMobile(false); }} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-black text-[14px] hover:bg-emerald-700 shadow-md flex items-center justify-center gap-2">
                                        <IoCheckmarkCircleOutline size={20} /> COBRAR (F10)
                                    </button>
                                </div>
                            )}
                        </div>

                        {mostrarCarrinhoMobile && <div className="absolute inset-0 bg-black/50 z-[105] md:hidden" onClick={() => setMostrarCarrinhoMobile(false)}></div>}
                    </div>

{/* 🔥 BARRA DE ATALHOS INFERIOR - 100% RESPONSIVA 🔥 */}
                    <div className="w-full shrink-0 border-t border-slate-900 p-2 sm:p-3 flex justify-center shadow-[0_-10px_20px_rgba(0,0,0,0.15)] z-[120] relative no-print">
                        <div className="flex flex-wrap justify-center items-center gap-2 w-full max-w-7xl">
                            
                            <button onClick={() => inputBuscaRef.current?.focus()} className=" hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm">
                                <kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-emerald-400 font-mono leading-normal">F1</kbd> BUSCAR
                            </button>
                            
                            <button onClick={iniciarVendaBalcao} className=" hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm">
                                <kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-emerald-400 font-mono leading-normal">F2</kbd> NOVA
                            </button>
                            
                            <button onClick={abrirHistoricoAtual} className=" hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm">
                                <kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-emerald-400 font-mono leading-normal">F3</kbd> HISTÓRICO
                            </button>
                            
                            <button onClick={suspenderVenda} className={`hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm ${!vendaAtual?.itens?.length ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-orange-400 font-mono leading-normal">F4</kbd> PAUSAR
                            </button>
                            
                            <button onClick={() => setMostrarSuspensas(true)} className=" hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm relative">
                                <kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-blue-400 font-mono leading-normal">F5</kbd> ESPERA
                                {vendasSuspensas.length > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] min-w-[18px] px-1 py-0.5 flex items-center justify-center rounded-full leading-none shadow-md">{vendasSuspensas.length}</span>}
                            </button>

                            {/* Separador oculto em telas pequenas */}
                            <div className="w-px h-6 bg-slate-600 mx-1 hidden sm:block"></div>

                            <button onClick={abrirMovimentacao} className="hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm">
                                <kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-amber-400 font-mono leading-normal">F8</kbd> CAIXA
                            </button>
                            
                            <button onClick={prepararFechamento} className="bg-rose-900/40 hover:bg-rose-800 border border-rose-700/50 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm">
                                <kbd className="bg-rose-700 px-1.5 py-0.5 rounded border border-rose-900 text-white font-mono leading-normal">F9</kbd> FECHAR TURNO
                            </button>

                            <button onClick={carregarListaTurnos} className=" hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded-lg flex items-center gap-1.5 text-[11px] font-bold transition-all shadow-sm">
                                <kbd className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-emerald-400 font-mono leading-normal">F11</kbd> TURNOS
                            </button>

                        </div>
                    </div>

                    {/* 🔥 Carrinho flutuante mobile (Posicionado de forma inteligente) 🔥 */}
                    <button 
                        onClick={() => setMostrarCarrinhoMobile(true)} 
                        style={{ bottom: 'calc(1rem + var(--altura-da-barra, 60px))' }} 
                        className={`md:hidden fixed right-4 bg-emerald-600 text-white p-4 rounded-full shadow-2xl z-[90] flex items-center gap-2 transition-transform ${vendaAtual?.itens?.length > 0 ? 'scale-100' : 'scale-0'}`}
                    >
                        <IoCart size={24} />
                        <span className="absolute -top-1 -right-1 bg-white text-emerald-600 font-black text-[10px] min-w-[20px] h-5 flex items-center justify-center rounded-full shadow-sm">
                            {vendaAtual?.itens?.length || 0}
                        </span>
                    </button>

                    {/* Carrinho flutuante mobile */}
                    <button onClick={() => setMostrarCarrinhoMobile(true)} className={`md:hidden absolute bottom-20 right-4 bg-emerald-600 text-white p-4 rounded-full shadow-2xl z-[90] flex items-center gap-2 transition-transform ${vendaAtual?.itens?.length > 0 ? 'scale-100' : 'scale-0'}`}>
                        <IoCart size={24} /><span className="absolute -top-1 -right-1 bg-white text-emerald-600 font-black text-[10px] min-w-[20px] h-5 flex items-center justify-center rounded-full shadow-sm">{vendaAtual?.itens?.length || 0}</span>
                    </button>

                    {/* Modais Componentes */}
                    <ModalSelecaoVariacao produto={produtoParaSelecao} onClose={() => setProdutoParaSelecao(null)} onConfirm={adicionarItem} />
                    <ModalEdicaoItemCarrinho visivel={itemParaEditar !== null} item={itemParaEditar} onClose={() => setItemParaEditar(null)} onConfirm={salvarEdicaoItem} />
                    <ModalAberturaCaixa visivel={mostrarAberturaCaixa} onAbrir={handleAbrirCaixa} usuarioNome={userData?.name} />
                    <ModalFechamentoCaixa visivel={mostrarFechamentoCaixa} caixa={caixaAberto} vendasDoDia={vendasTurnoAtual} movimentacoes={movimentacoesDoTurno} onClose={() => setMostrarFechamentoCaixa(false)} onConfirmarFechamento={handleConfirmarFechamento} />
                    <ModalMovimentacao visivel={mostrarMovimentacao} onClose={() => setMostrarMovimentacao(false)} onConfirmar={handleSalvarMovimentacao} />
                    <ModalFinalizacao visivel={mostrarFinalizacao} venda={vendaAtual} onClose={() => setMostrarFinalizacao(false)} onFinalizar={finalizarVenda} salvando={salvando} pagamentos={pagamentosAdicionados} setPagamentos={setPagamentosAdicionados} cpfNota={cpfNota} setCpfNota={setCpfNota} desconto={descontoValor} setDesconto={setDescontoValor} acrescimo={acrescimoValor} setAcrescimo={setAcrescimoValor} />
                    
                    <ModalRecibo visivel={mostrarRecibo} dados={dadosRecibo} onClose={() => { setMostrarRecibo(false); iniciarVendaBalcao(); }} onNovaVenda={iniciarVendaBalcao} onEmitirNfce={handleEmitirNfce} nfceStatus={nfceStatus} nfceUrl={nfceUrl} onBaixarXml={handleBaixarXml} onConsultarStatus={handleConsultarStatus} onBaixarPdf={handleBaixarPdf} onBaixarXmlCancelamento={async (venda) => { try { const res = await vendaService.baixarXmlCancelamentoNfce(venda.fiscal?.idPlugNotas, venda.id.slice(-6)); if (!res.success) alert("Erro: " + res.error); } catch (e) {} }} onEnviarWhatsApp={handleEnviarWhatsApp} />
                    <ModalHistorico visivel={mostrarHistorico} onClose={() => setMostrarHistorico(false)} vendas={vendasHistoricoExibicao} titulo={tituloHistorico} onSelecionarVenda={selecionarVendaHistorico} carregando={carregandoHistorico} onProcessarLote={handleProcessarLoteNfce} onCancelarNfce={handleCancelarNfce} onBaixarXml={handleBaixarXml} onConsultarStatus={handleConsultarStatus} onBaixarPdf={handleBaixarPdf} onBaixarXmlCancelamento={async (venda) => { try { const res = await vendaService.baixarXmlCancelamentoNfce(venda.fiscal?.idPlugNotas, venda.id.slice(-6)); if (!res.success) alert("Erro: " + res.error); } catch (e) {} }} onEnviarWhatsApp={handleEnviarWhatsApp} />

                    <ModalListaTurnos visivel={mostrarListaTurnos} onClose={() => setMostrarListaTurnos(false)} turnos={listaTurnos} carregando={carregandoHistorico} onVerVendas={visualizarVendasTurno} vendasDoDia={vendasTurnoAtual} />   
                    <ModalResumoTurno visivel={mostrarResumoTurno} turno={turnoSelecionadoResumo} onClose={() => { setMostrarResumoTurno(false); if (!caixaAberto) setMostrarAberturaCaixa(true); }} />
                    <ModalVendasSuspensas visivel={mostrarSuspensas} onClose={() => setMostrarSuspensas(false)} vendas={vendasSuspensas} onRestaurar={restaurarVendaSuspensa} onExcluir={excluirVendaSuspensa} />              
                    <ModalPesoBalanca visivel={produtoParaPeso !== null} produto={produtoParaPeso} onClose={() => setProdutoParaPeso(null)} onConfirm={adicionarItemPeso} />
                </>
            )}
            
            <style>{`
                /* BLOQUEIO NUCLEAR DE ROLAGEM GLOBAL */
                html, body {
                    margin: 0;
                    padding: 0;
                    height: 100%;
                    width: 100%;
                    overflow: hidden !important;
                    overscroll-behavior: none !important;
                    touch-action: none !important; /* Trava o pull-to-refresh no celular */
                }

                .pdv-scroll {
                    touch-action: auto !important; /* Deixa rolar só o que for lista de itens */
                }

                .pdv-scroll::-webkit-scrollbar { width: 4px; }
                .pdv-scroll::-webkit-scrollbar-track { background: transparent; }
                .pdv-scroll::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
                .pdv-scroll:hover::-webkit-scrollbar-thumb { background-color: #94a3b8; }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

                @media print {
                  html, body { height: auto !important; overflow: visible !important; background: white !important; touch-action: auto !important; }
                  body * { visibility: hidden; }
                  #main-app-wrapper { position: static !important; overflow: visible !important; height: auto !important; display: block !important; }
                  #recibo-overlay, #resumo-turno-overlay { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: auto !important; background: none !important; visibility: visible !important; z-index: 9999 !important; display: block !important; }
                  #recibo-content, #recibo-content *, #resumo-turno-content, #resumo-turno-content * { visibility: visible !important; }
                  #recibo-content, #resumo-turno-content { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: none !important; background: white !important; }
                  .no-print { display: none !important; }
                  .bg-gray-50, .bg-gray-100 { background-color: white !important; }
                }
            `}</style>
        </div>
    );
};

export default PdvScreen;