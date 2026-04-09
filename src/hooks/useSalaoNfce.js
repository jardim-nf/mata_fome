import { useState, useEffect, useCallback } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { vendaService } from '../services/vendaService';
import { toast } from 'react-toastify';

export function useSalaoNfce(estabelecimentoId) {
    const [mostrarRecibo, setMostrarRecibo] = useState(false);
    const [dadosRecibo, setDadosRecibo] = useState(null);
    const [nfceStatus, setNfceStatus] = useState('idle');
    const [nfceUrl, setNfceUrl] = useState(null);
    const [isHistoricoVendasOpen, setIsHistoricoVendasOpen] = useState(false);
    const [vendasHistoricoExibicao, setVendasHistoricoExibicao] = useState([]);
    const [carregandoHistorico, setCarregandoHistorico] = useState(false);

    const [promptCancelNfce, setPromptCancelNfce] = useState({ open: false, venda: null });
    const [promptWhatsApp, setPromptWhatsApp] = useState({ open: false, venda: null, defaultTel: '' });

    const tocarBeepErro = useCallback(() => { 
        try { 
            const ctx = new (window.AudioContext || window.webkitAudioContext)(); 
            const osc = ctx.createOscillator(); 
            const gain = ctx.createGain(); 
            osc.type = 'sawtooth'; 
            osc.frequency.setValueAtTime(200, ctx.currentTime); 
            gain.gain.setValueAtTime(0.15, ctx.currentTime); 
            gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5); 
            osc.connect(gain); 
            gain.connect(ctx.destination); 
            osc.start(); 
            osc.stop(ctx.currentTime + 0.5); 
        } catch (e) {
            console.error(e);
        } 
    }, []);

    // Listener do documento em tempo real quando o recibo está aberto
    useEffect(() => {
        let unsub = () => {};
        if (mostrarRecibo && dadosRecibo?.id) {
            unsub = onSnapshot(doc(db, 'vendas', dadosRecibo.id), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data(); 
                    setDadosRecibo(p => ({ ...p, fiscal: data.fiscal }));
                    if (data.fiscal) {
                        const st = data.fiscal.status?.toUpperCase();
                        if (st === 'AUTORIZADA' || st === 'CONCLUIDO') { 
                            setNfceStatus('success'); 
                            setNfceUrl(data.fiscal.pdf); 
                        } else if (st === 'REJEITADO' || st === 'REJEITADA' || st === 'DENEGADO') { 
                            setNfceStatus('error'); 
                            setNfceUrl(null);  
                        } else if (st === 'PROCESSANDO') { 
                            setNfceStatus('loading'); 
                        }
                        setVendasHistoricoExibicao(p => p.map(v => v.id === dadosRecibo.id ? { ...v, fiscal: data.fiscal } : v));
                    }
                }
            });
        }
        return () => unsub();
    }, [mostrarRecibo, dadosRecibo?.id]);

    // Polling caso o status precise da Sefaz
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
                } catch (e) {
                    console.error(e);
                }
            }, 3000);
        }
        return () => clearInterval(intervalo);
    }, [nfceStatus, dadosRecibo, tocarBeepErro]);

    const handleCancelarNfce = useCallback((venda) => { 
        if (!venda || !venda.id) return; 
        setPromptCancelNfce({ open: true, venda }); 
    }, []);

    const executarCancelamentoNfce = useCallback(async (justificativa) => {
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
                setDadosRecibo(p => p ? { ...p, fiscal: { ...p.fiscal, status: 'CANCELADO' } } : null);
                setVendasHistoricoExibicao(p => p.map(v => v.id === venda.id ? { ...v, fiscal: { ...v.fiscal, status: 'CANCELADO' } } : v));
                setNfceStatus('idle');
            } else { 
                setNfceStatus('error'); 
                tocarBeepErro(); 
                toast.error('Erro ao cancelar: ' + res.error); 
            }
        } catch (e) { 
            setNfceStatus('error'); 
            tocarBeepErro(); 
            toast.error('Falha de conexão.'); 
        }
    }, [promptCancelNfce.venda, tocarBeepErro]);

    const abrirHistoricoVendas = useCallback(async () => {
        setIsHistoricoVendasOpen(true); 
        setCarregandoHistorico(true);
        try { 
            const vendas = await vendaService.buscarVendasPorEstabelecimento(estabelecimentoId, 50); 
            setVendasHistoricoExibicao(vendas || []); 
        } catch (error) { 
            toast.error("Erro ao buscar histórico."); 
        } finally { 
            setCarregandoHistorico(false); 
        }
    }, [estabelecimentoId]);

    const selecionarVendaHistorico = useCallback((venda) => {
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
    }, []);

    const handleEmitirNfce = useCallback(async () => {
        if (!dadosRecibo?.id) return; 
        setNfceStatus('loading');
        try {
            const res = await vendaService.emitirNfce(dadosRecibo.id, dadosRecibo.clienteCpf);
            if (res.sucesso || res.success) {
                setDadosRecibo(p => p ? { ...p, fiscal: { ...p.fiscal, status: 'PROCESSANDO', idPlugNotas: res.idPlugNotas } } : null);
                setVendasHistoricoExibicao(p => p.map(v => v.id === dadosRecibo.id ? { ...v, fiscal: { ...v.fiscal, status: 'PROCESSANDO', idPlugNotas: res.idPlugNotas } } : v));
            } else { 
                setNfceStatus('error'); 
                tocarBeepErro(); 
                toast.error(res.error || 'Erro ao solicitar NFC-e'); 
            }
        } catch (e) { 
            setNfceStatus('error'); 
            tocarBeepErro(); 
            toast.error('Erro de conexão.'); 
        }
    }, [dadosRecibo, tocarBeepErro]);

    const handleConsultarStatus = useCallback(async (venda) => {
        const st = venda.fiscal?.status;
        if (st === 'REJEITADO' || st === 'REJEITADA' || st === 'ERRO') {
            if (!window.confirm('Tentar reenviar para a SEFAZ?')) return;
            setNfceStatus('loading');
            try {
                const res = await vendaService.emitirNfce(venda.id, venda.clienteCpf);
                if (res.sucesso || res.success) {
                    toast.success('✅ Enviada para reprocessamento!');
                    setDadosRecibo(p => p?.id === venda.id ? { ...p, fiscal: { ...p.fiscal, status: 'PROCESSANDO', idPlugNotas: res.idPlugNotas } } : p);
                    setVendasHistoricoExibicao(p => p.map(v => v.id === venda.id ? { ...v, fiscal: { ...v.fiscal, status: 'PROCESSANDO', idPlugNotas: res.idPlugNotas } } : v));
                } else { 
                    setNfceStatus('error'); 
                    toast.error('❌ Erro: ' + res.error); 
                }
            } catch (e) { 
                setNfceStatus('error'); 
                toast.error('Falha ao reenviar.'); 
            }
        } else {
            if (!venda.fiscal?.idPlugNotas) {
                toast.warning('Sem ID PlugNotas.');
                return;
            }
            setNfceStatus('loading');
            try {
                const res = await vendaService.consultarStatusNfce(venda.id, venda.fiscal.idPlugNotas);
                if (res.sucesso) {
                    setDadosRecibo(p => p?.id === venda.id ? { ...p, fiscal: { ...p.fiscal, status: res.statusAtual, pdf: res.pdf, xml: res.xml, motivoRejeicao: res.mensagem } } : p);
                    if (dadosRecibo?.id === venda.id) {
                        setNfceStatus(res.statusAtual === 'AUTORIZADA' || res.statusAtual === 'CONCLUIDO' ? 'success' : 'idle'); 
                        setNfceUrl(res.pdf); 
                    }
                    setVendasHistoricoExibicao(p => p.map(v => v.id === venda.id ? { ...v, fiscal: { ...v.fiscal, status: res.statusAtual, pdf: res.pdf, xml: res.xml, motivoRejeicao: res.mensagem } } : v));
                    toast.info(`Status Sefaz: ${res.statusAtual}`);
                } else { 
                    setNfceStatus('error'); 
                    toast.error('Erro: ' + res.error); 
                }
            } catch (e) { 
                setNfceStatus('error'); 
                toast.error('Falha ao consultar.'); 
            }
        }
    }, [dadosRecibo]);

    const handleBaixarXml = useCallback(async (venda) => { 
        if (!venda.fiscal?.idPlugNotas) {
            toast.warning('Sem ID');
            return;
        } 
        try { 
            const res = await vendaService.baixarXmlNfce(venda.fiscal.idPlugNotas, venda.id.slice(-6)); 
            if (!res.success) toast.error('Erro: ' + res.error); 
        } catch (e) { 
            console.error(e); 
        } 
    }, []);

    const handleBaixarPdf = useCallback(async (venda) => { 
        const id = venda.fiscal?.idPlugNotas; 
        if (!id) {
            toast.warning('Sem ID');
            return;
        } 
        setNfceStatus('loading'); 
        try { 
            const res = await vendaService.baixarPdfNfce(id, venda.fiscal?.pdf); 
            if (!res.success) toast.error('Erro: ' + res.error); 
        } catch (e) { 
            console.error(e); 
        } finally { 
            setNfceStatus(prev => prev === 'loading' ? 'idle' : prev); 
        } 
    }, []);
    
    const handleEnviarWhatsApp = useCallback((venda) => {
        if (!venda.fiscal?.pdf) {
            toast.warning('⚠️ Link PDF indisponível.');
            return;
        }
        const telPadrao = String(venda.clienteTelefone || venda.cliente?.telefone || '').replace(/\D/g, '');
        setPromptWhatsApp({ open: true, venda, defaultTel: telPadrao });
    }, []);

    const executarEnvioWhatsApp = useCallback((tel) => {
        const venda = promptWhatsApp.venda; 
        setPromptWhatsApp({ open: false, venda: null, defaultTel: '' });
        if (!tel) return; 
        
        const telLimpo = String(tel).replace(/\D/g, '');
        const msg = encodeURIComponent(`Olá! Agradecemos a preferência. 😃\nSua Nota Fiscal:\n${venda.fiscal.pdf}`);
        
        window.open(
            telLimpo.length >= 10 
                ? `https://wa.me/${telLimpo.startsWith('55') ? telLimpo : `55${telLimpo}`}?text=${msg}` 
                : `https://api.whatsapp.com/send?text=${msg}`, 
            '_blank'
        );
    }, [promptWhatsApp.venda]);

    return {
        mostrarRecibo, setMostrarRecibo, 
        dadosRecibo, setDadosRecibo, 
        nfceStatus, nfceUrl,
        isHistoricoVendasOpen, setIsHistoricoVendasOpen, 
        vendasHistoricoExibicao, carregandoHistorico,
        abrirHistoricoVendas, selecionarVendaHistorico, 
        handleEmitirNfce, handleConsultarStatus,
        handleBaixarXml, handleBaixarPdf, 
        handleCancelarNfce, executarCancelamentoNfce,
        handleEnviarWhatsApp, executarEnvioWhatsApp,
        promptCancelNfce, setPromptCancelNfce, 
        promptWhatsApp, setPromptWhatsApp
    };
}
