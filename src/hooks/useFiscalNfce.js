import { useState, useCallback, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { db } from '../firebase';
import { vendaService } from '../services/vendaService';
import { tocarBeepErro } from '../utils/audioUtils';

export const useFiscalNfce = (estabelecimentoAtivo) => {
    const [mostrarRecibo, setMostrarRecibo] = useState(false);
    const [dadosRecibo, setDadosRecibo] = useState(null);
    const [nfceStatus, setNfceStatus] = useState('idle');
    const [nfceUrl, setNfceUrl] = useState(null);
    const [isHistoricoVendasOpen, setIsHistoricoVendasOpen] = useState(false);
    const [vendasHistoricoExibicao, setVendasHistoricoExibicao] = useState([]);
    const [carregandoHistorico, setCarregandoHistorico] = useState(false);
    const [promptCancelNfce, setPromptCancelNfce] = useState({ open: false, venda: null });
    const [promptWhatsApp, setPromptWhatsApp] = useState({ open: false, venda: null, defaultTel: '' });

    const formatarReal = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor || 0);

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
            } else { setNfceStatus('error'); tocarBeepErro(); toast.error(res.error || 'Erro ao solicitar NFC-e'); }
        } catch (e) { setNfceStatus('error'); tocarBeepErro(); toast.error('Erro de conexão.'); }
    };

    const handleConsultarStatus = async (venda) => {
        const st = venda.fiscal?.status;
        if (st === 'REJEITADO' || st === 'REJEITADA' || st === 'ERRO') {
            if (!window.confirm('Tentar reenviar para a SEFAZ?')) return;
            setNfceStatus('loading');
            try {
                const res = await vendaService.emitirNfce(venda.id, venda.clienteCpf);
                if (res.sucesso || res.success) {
                    toast.success('✅ Enviada para reprocessamento!');
                    if (dadosRecibo?.id === venda.id) setDadosRecibo(p => ({ ...p, fiscal: { ...p.fiscal, status: 'PROCESSANDO', idPlugNotas: res.idPlugNotas } }));
                    setVendasHistoricoExibicao(p => p.map(v => v.id === venda.id ? { ...v, fiscal: { ...v.fiscal, status: 'PROCESSANDO', idPlugNotas: res.idPlugNotas } } : v));
                } else { setNfceStatus('error'); toast.error('❌ Erro: ' + res.error); }
            } catch (e) { setNfceStatus('error'); toast.error('Falha ao reenviar.'); }
        } else {
            if (!venda.fiscal?.idPlugNotas) return toast.warning('Sem ID PlugNotas.');
            setNfceStatus('loading');
            try {
                const res = await vendaService.consultarStatusNfce(venda.id, venda.fiscal.idPlugNotas);
                if (res.sucesso) {
                    if (dadosRecibo?.id === venda.id) { setDadosRecibo(p => ({ ...p, fiscal: { ...p.fiscal, status: res.statusAtual, pdf: res.pdf, xml: res.xml, motivoRejeicao: res.mensagem } })); setNfceStatus(res.statusAtual === 'AUTORIZADA' || res.statusAtual === 'CONCLUIDO' ? 'success' : 'idle'); setNfceUrl(res.pdf); }
                    setVendasHistoricoExibicao(p => p.map(v => v.id === venda.id ? { ...v, fiscal: { ...v.fiscal, status: res.statusAtual, pdf: res.pdf, xml: res.xml, motivoRejeicao: res.mensagem } } : v));
                    toast.info(`Status Sefaz: ${res.statusAtual}`);
                } else { setNfceStatus('error'); toast.error('Erro: ' + res.error); }
            } catch (e) { setNfceStatus('error'); toast.error('Falha ao consultar.'); }
        }
    };

    const handleCancelarNfce = (venda) => {
        if (!venda || !venda.id) return;
        setPromptCancelNfce({ open: true, venda });
    };

    const executarCancelamentoNfce = async (justificativa) => {
        const venda = promptCancelNfce.venda;
        setPromptCancelNfce({ open: false, venda: null });
        if (!justificativa || justificativa.trim().length < 15) {
            if (justificativa !== null) toast.warning('O motivo deve ter pelo menos 15 caracteres.');
            return;
        }
        setNfceStatus('loading');
        try {
            const res = await vendaService.cancelarNfce(venda.id, justificativa.trim());
            if (res.success || res.sucesso) {
                toast.success('Nota Fiscal cancelada com sucesso!');
                setDadosRecibo(p => ({ ...p, fiscal: { ...p.fiscal, status: 'CANCELADO' } }));
                setVendasHistoricoExibicao(p => p.map(v => v.id === venda.id ? { ...v, fiscal: { ...v.fiscal, status: 'CANCELADO' } } : v));
                setNfceStatus('idle');
            } else { setNfceStatus('error'); tocarBeepErro(); toast.error('Erro ao cancelar: ' + res.error); }
        } catch (e) { setNfceStatus('error'); tocarBeepErro(); toast.error('Falha de conexão ao tentar cancelar a nota.'); }
    };

    const handleBaixarXml = async (venda) => { if (!venda.fiscal?.idPlugNotas) return toast.warning('Sem ID'); try { const res = await vendaService.baixarXmlNfce(venda.fiscal.idPlugNotas, venda.id.slice(-6)); if (!res.success) toast.error('Erro: ' + res.error); } catch (e) { console.error(e); } };
    const handleBaixarPdf = async (venda) => { const id = venda.fiscal?.idPlugNotas; if (!id) return toast.warning('Sem ID'); setNfceStatus('loading'); try { const res = await vendaService.baixarPdfNfce(id, venda.fiscal?.pdf); if (!res.success) toast.error('Erro: ' + res.error); } catch (e) { console.error(e); } finally { if (nfceStatus === 'loading') setNfceStatus('idle'); } };

    const handleEnviarWhatsApp = (venda) => {
        if (!venda.fiscal?.pdf) return toast.warning('⚠️ Link PDF indisponível.');
        const telPadrao = (venda.clienteTelefone || venda.cliente?.telefone || '').replace(/\D/g, '');
        setPromptWhatsApp({ open: true, venda, defaultTel: telPadrao });
    };

    const executarEnvioWhatsApp = (tel) => {
        const venda = promptWhatsApp.venda;
        setPromptWhatsApp({ open: false, venda: null, defaultTel: '' });
        if (!tel) return;
        const telLimpo = tel.replace(/\D/g, '');
        const msg = encodeURIComponent(`Olá! Agradecemos a preferência. 😃\nSua Nota Fiscal de ${formatarReal(venda.total)}:\n${venda.fiscal.pdf}`);
        window.open(telLimpo.length >= 10 ? `https://wa.me/${telLimpo.startsWith('55') ? telLimpo : `55${telLimpo}`}?text=${msg}` : `https://api.whatsapp.com/send?text=${msg}`, '_blank');
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

        const rawFormaPag = pedido.formaPagamento || pedido.metodoPagamento || 'outros';
        const normFormaPag = String(rawFormaPag).toLowerCase().includes('pix') ? 'pix' : rawFormaPag;

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
            formaPagamento: normFormaPag,
            clienteNome: pedido.cliente?.nome || 'Cliente',
            clienteTelefone: pedido.cliente?.telefone || '',
            clienteCpf: pedido.clienteCpf || null,
            origem: pedido.source === 'salao' ? 'salao' : 'delivery',
            status: 'finalizada',
            mesaNumero: pedido.mesaNumero || null
        };

        const resultado = await vendaService.salvarVenda(vendaData);
        if (resultado.success) {
            const vendaFinal = { ...vendaData, id: resultado.vendaId, createdAt: new Date() };
            setDadosRecibo(vendaFinal);
            setNfceStatus('idle');
            setNfceUrl(null);
            setMostrarRecibo(true);
            toast.success('🧾 Venda registrada! Agora pode emitir a NFC-e.');
        } else {
            toast.error('Erro ao registrar venda: ' + resultado.error);
        }
    }, [estabelecimentoAtivo]);

    // Listener do Recibo Atual
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

    // Polling Automático
    useEffect(() => {
        let intervalo;
        if (nfceStatus === 'loading' && dadosRecibo?.fiscal?.idPlugNotas) {
            intervalo = setInterval(async () => {
                try {
                    const res = await vendaService.consultarStatusNfce(dadosRecibo.id, dadosRecibo.fiscal.idPlugNotas);
                    if (res.sucesso && res.statusAtual !== 'PROCESSANDO') {
                        clearInterval(intervalo); 
                        const ns = (res.statusAtual === 'AUTORIZADA' || res.statusAtual === 'CONCLUIDO') ? 'success' : 'error';
                        setNfceStatus(ns); 
                        if (ns === 'success') setNfceUrl(res.pdf);
                        setDadosRecibo(p => ({...p, fiscal: { ...p.fiscal, status: res.statusAtual, pdf: res.pdf, xml: res.xml, motivoRejeicao: res.mensagem }}));
                        setVendasHistoricoExibicao(p => p.map(v => v.id === dadosRecibo.id ? { ...v, fiscal: { ...v.fiscal, status: res.statusAtual, pdf: res.pdf, xml: res.xml, motivoRejeicao: res.mensagem } } : v));
                        if (ns === 'error') tocarBeepErro();
                    }
                } catch (e) { console.error(e); }
            }, 3000);
        }
        return () => clearInterval(intervalo);
    }, [nfceStatus, dadosRecibo]);

    return {
        mostrarRecibo, setMostrarRecibo,
        dadosRecibo, setDadosRecibo,
        nfceStatus,
        nfceUrl,
        isHistoricoVendasOpen, setIsHistoricoVendasOpen,
        vendasHistoricoExibicao,
        carregandoHistorico,
        promptCancelNfce, setPromptCancelNfce,
        promptWhatsApp, setPromptWhatsApp,
        abrirHistoricoVendas,
        selecionarVendaHistorico,
        handleEmitirNfce,
        handleConsultarStatus,
        handleCancelarNfce,
        executarCancelamentoNfce,
        handleBaixarXml,
        handleBaixarPdf,
        handleEnviarWhatsApp,
        executarEnvioWhatsApp,
        handleNfceDoPedido
    };
};
