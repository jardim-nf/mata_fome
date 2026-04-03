import { useState, useEffect } from 'react';
import { vendaService } from '../services/vendaService';
import { toast } from 'react-toastify';
import { db } from '../firebase';
import { onSnapshot, doc } from 'firebase/firestore';

export function usePdvNfce(dadosRecibo, setDadosRecibo, setVendasBase, setVendasHistoricoExibicao, showPrompt, showConfirm, tocarBeepErro) {
    const [nfceStatus, setNfceStatus] = useState('idle');
    const [nfceUrl, setNfceUrl] = useState(null);

    const handleConsultarStatus = async (venda) => {
        const st = venda.fiscal?.status;
        if (st === 'REJEITADO' || st === 'REJEITADA' || st === 'ERRO') {
            showConfirm("Tentar reenviar para a SEFAZ?", async () => {
                setNfceStatus('loading');
                try {
                    const res = await vendaService.emitirNfce(venda.id, venda.clienteCpf);
                    if (res.sucesso || res.success) {
                        toast.success('Enviada com sucesso!');
                        const atualiza = (l) => l.map(v => v.id === venda.id ? { ...v, fiscal: { ...v.fiscal, status: 'PROCESSANDO', idPlugNotas: res.idPlugNotas } } : v );
                        setVendasBase(atualiza); setVendasHistoricoExibicao(atualiza);
                        if (dadosRecibo?.id === venda.id) setDadosRecibo(p => ({ ...p, fiscal: { ...p.fiscal, status: 'PROCESSANDO', idPlugNotas: res.idPlugNotas } }));
                    } else { setNfceStatus('error'); toast.error('Erro: ' + res.error); }
                } catch (e) { setNfceStatus('error'); toast.error('Falha ao reenviar.'); }
            }, { title: 'Reenviar NFC-e', confirmText: 'Reenviar' });
        } else {
            if (!venda.fiscal?.idPlugNotas) return toast.warning('Sem ID PlugNotas.');
            setNfceStatus('loading');
            try {
                const res = await vendaService.consultarStatusNfce(venda.id, venda.fiscal.idPlugNotas);
                if (res.sucesso) {
                    const atualiza = (l) => l.map(v => v.id === venda.id ? { ...v, fiscal: { ...v.fiscal, status: res.statusAtual, pdf: res.pdf || v.fiscal?.pdf, xml: res.xml || v.fiscal?.xml, motivoRejeicao: res.mensagem || v.fiscal?.motivoRejeicao } } : v );
                    setVendasBase(atualiza); setVendasHistoricoExibicao(atualiza);
                    if (dadosRecibo?.id === venda.id) { 
                        setDadosRecibo(p => ({ ...p, fiscal: { ...p.fiscal, status: res.statusAtual, pdf: res.pdf, xml: res.xml, motivoRejeicao: res.mensagem } })); 
                        setNfceStatus(res.statusAtual === 'AUTORIZADA' || res.statusAtual === 'CONCLUIDO' ? 'success' : 'idle'); 
                        setNfceUrl(res.pdf); 
                    }
                    toast.info(`Status: ${res.statusAtual}`);
                } else { setNfceStatus('error'); toast.error('Erro: ' + res.error); }
            } catch (e) { setNfceStatus('error'); toast.error('Falha ao consultar.'); }
        }
    };

    const handleEmitirNfce = async () => {
        if (!dadosRecibo?.id) return; 
        setNfceStatus('loading');
        try {
            const res = await vendaService.emitirNfce(dadosRecibo.id, dadosRecibo.clienteCpf);
            if (res.sucesso || res.success) {
                const atualiza = (l) => l.map(v => v.id === dadosRecibo.id ? { ...v, fiscal: { ...v.fiscal, status: 'PROCESSANDO', idPlugNotas: res.idPlugNotas } } : v );
                setVendasBase(atualiza); setVendasHistoricoExibicao(atualiza); 
                setDadosRecibo(p => ({ ...p, fiscal: { ...p.fiscal, status: 'PROCESSANDO', idPlugNotas: res.idPlugNotas } }));
            } else { setNfceStatus('error'); tocarBeepErro(); toast.error(res.error || 'Erro ao solicitar'); }
        } catch (e) { setNfceStatus('error'); tocarBeepErro(); toast.error('Erro de conexão.'); }
    };

    const handleProcessarLoteNfce = async (vendasParaProcessar) => {
        if (!vendasParaProcessar || vendasParaProcessar.length === 0) return;
        showConfirm(`Reprocessar ${vendasParaProcessar.length} notas?`, async () => {
            let sucesso = 0; let canceladas = 0; let falhas = 0; let listaAtualizada = [...(setVendasHistoricoExibicao() || [])]; // we'll need to pass the actual array to properly map, or rely on state callback
            // Fixing the scope of listaAtualizada logic so it uses setVendasHistoricoExibicao correctly
            setVendasHistoricoExibicao(prev => {
                listaAtualizada = [...prev];
                return prev;
            });

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
            if (falhas > 0) { tocarBeepErro(); toast.error(`Concluído com ${falhas} falha(s). ✅ ${sucesso} | 🚫 ${canceladas}`); } else { toast.success(`Concluído! ✅ ${sucesso} sucesso(s), 🚫 ${canceladas} cancelada(s)`); }
        }, { title: 'Reprocessar Lote NFC-e', confirmText: 'Reprocessar' });
    };

    const handleCancelarNfce = async () => {
        if (!dadosRecibo?.id) return;
        showPrompt('Motivo do cancelamento (mínimo 15 caracteres):', async (motivo) => {
            if (motivo.trim().length < 15) return toast.warning('Mínimo 15 caracteres.');
            setNfceStatus('loading');
            try {
                const res = await vendaService.cancelarNfce(dadosRecibo.id, motivo.trim());
                if (res.success) { 
                    toast.success('Cancelamento enviado!'); 
                    setDadosRecibo(p => ({ ...p, status: 'cancelada', fiscal: { ...p.fiscal, status: 'PROCESSANDO' } })); 
                    const atualiza = (l) => l.map(v => v.id === dadosRecibo.id ? { ...v, status: 'cancelada', fiscal: { ...v.fiscal, status: 'PROCESSANDO' } } : v ); 
                    setVendasBase(atualiza); setVendasHistoricoExibicao(atualiza); 
                } else { toast.error('Erro: ' + res.error); }
            } catch (e) { toast.error('Falha de comunicação.'); } finally { setNfceStatus('idle'); }
        }, { title: 'Cancelar NFC-e', placeholder: 'Descreva o motivo...', submitText: 'Cancelar NFC-e' });
    };

    const handleBaixarXml = async (venda) => { if (!venda.fiscal?.idPlugNotas) return toast.warning('Sem ID'); try { const res = await vendaService.baixarXmlNfce(venda.fiscal.idPlugNotas, venda.id.slice(-6)); if (!res.success) toast.error('Erro: ' + res.error); } catch (e) { console.error(e); } };
    const handleBaixarPdf = async (venda) => { const id = venda.fiscal?.idPlugNotas; if (!id) return toast.warning('Sem ID'); setNfceStatus('loading'); try { const res = await vendaService.baixarPdfNfce(id, venda.fiscal?.pdf); if (!res.success) toast.error('Erro: ' + res.error); } catch (e) { console.error(e); } finally { setNfceStatus('idle'); } };

    // Efeito para real-time do Recibo se aberto
    useEffect(() => {
        let unsub = () => {};
        if (dadosRecibo?.id) {
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
    }, [dadosRecibo?.id, setDadosRecibo, setVendasBase, setVendasHistoricoExibicao]);

    // Polling effect
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
                } catch (e) { console.error(e); }
            }, 3000);
        }
        return () => clearInterval(intervalo);
    }, [nfceStatus, dadosRecibo, setVendasBase, setVendasHistoricoExibicao, setDadosRecibo, tocarBeepErro]);

    return {
        nfceStatus, setNfceStatus,
        nfceUrl, setNfceUrl,
        handleConsultarStatus,
        handleEmitirNfce,
        handleProcessarLoteNfce,
        handleCancelarNfce,
        handleBaixarXml,
        handleBaixarPdf
    };
}
