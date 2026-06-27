import { useState, useEffect } from 'react';
import { vendaService } from '../services/vendaService';
import { caixaService } from '../services/caixaService';
import { toast } from 'react-toastify';
import { db } from '../firebase';
import { onSnapshot, doc, updateDoc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { usePdvStore } from '../store/usePdvStore';

const deepSanitizeNaN = (obj) => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'number') {
        return Number.isNaN(obj) ? 0 : obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => deepSanitizeNaN(item));
    }
    if (typeof obj === 'object') {
        const clean = {};
        for (const [key, val] of Object.entries(obj)) {
            clean[key] = deepSanitizeNaN(val);
        }
        return clean;
    }
    return obj;
};

export function usePdvNfce(showPrompt, showConfirm, tocarBeepErro) {
    const {
        dadosRecibo, setDadosRecibo,
        vendasBaseLocal, setVendasBaseLocal,
        vendasHistoricoExibicao, setVendasHistoricoExibicao,
    } = usePdvStore();

    const [nfceStatus, setNfceStatus] = useState('idle');
    const [nfceUrl, setNfceUrl] = useState(null);

    const cancelarCrediarioSeNecessario = async (venda) => {
        let vendaCompleta = deepSanitizeNaN(venda);
        if (!vendaCompleta?.pagamentos || !vendaCompleta?.clienteId) {
            try {
                const docSnap = await getDoc(doc(db, 'vendas', venda.id));
                if (docSnap.exists()) {
                    vendaCompleta = deepSanitizeNaN({ id: docSnap.id, ...docSnap.data() });
                }
            } catch (err) {
                console.error("Erro ao carregar venda completa para estornar crediário:", err);
            }
        }

        if (!vendaCompleta?.clienteId) return;

        const pagamentos = vendaCompleta.pagamentos || [];
        const valorCrediario = pagamentos
            .filter(p => p.forma === 'crediario')
            .reduce((acc, p) => acc + p.valor, 0);

        if (valorCrediario <= 0 || Number.isNaN(valorCrediario)) return;

        const estabId = vendaCompleta.estabelecimentoId;
        if (!estabId) return;

        try {
            // 1. Reduzir o saldo devedor do cliente no estabelecimento
            const cRef = doc(db, 'estabelecimentos', estabId, 'clientes', vendaCompleta.clienteId);
            const cSnap = await getDoc(cRef);
            if (cSnap.exists()) {
                const currentSaldo = Number(cSnap.data().saldoDevedor || 0) || 0;
                let novoSaldo = Math.max(0, currentSaldo - valorCrediario);
                if (Number.isNaN(novoSaldo)) novoSaldo = 0;
                await updateDoc(cRef, { saldoDevedor: novoSaldo });
            }

            // 2. Reduzir o saldo devedor do cliente globalmente
            const gRef = doc(db, 'clientes', vendaCompleta.clienteId);
            const gSnap = await getDoc(gRef);
            if (gSnap.exists()) {
                const currentSaldo = Number(gSnap.data().saldoDevedor || 0) || 0;
                let novoSaldo = Math.max(0, currentSaldo - valorCrediario);
                if (Number.isNaN(novoSaldo)) novoSaldo = 0;
                await updateDoc(gRef, { saldoDevedor: novoSaldo });
            }

            // 3. Buscar a transação de compra no histórico de crediário e marcar como estornado
            const q = query(
                collection(db, 'estabelecimentos', estabId, 'clientes', vendaCompleta.clienteId, 'historico_crediario'),
                where('vendaId', '==', vendaCompleta.id)
            );
            const snap = await getDocs(q);
            for (const docSnap of snap.docs) {
                const histDocRef = doc(db, 'estabelecimentos', estabId, 'clientes', vendaCompleta.clienteId, 'historico_crediario', docSnap.id);
                await updateDoc(histDocRef, {
                    estornado: true,
                    status: 'pago',
                    saldoPendente: 0
                });
            }
            console.log(`[usePdvNfce] Débito de crediário de ${valorCrediario} cancelado com sucesso no PDV.`);
        } catch (err) {
            console.error("Erro ao cancelar crediário correspondente:", err);
            toast.error("Erro ao estornar o débito no crediário.");
        }
    };

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
                        setVendasBaseLocal(atualiza); setVendasHistoricoExibicao(atualiza);
                        if (dadosRecibo?.id === venda.id) setDadosRecibo({ ...dadosRecibo, fiscal: { ...dadosRecibo.fiscal, status: 'PROCESSANDO', idPlugNotas: res.idPlugNotas } });
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
                    setVendasBaseLocal(atualiza); setVendasHistoricoExibicao(atualiza);
                    if (dadosRecibo?.id === venda.id) { 
                        setDadosRecibo({ ...dadosRecibo, fiscal: { ...dadosRecibo.fiscal, status: res.statusAtual, pdf: res.pdf, xml: res.xml, motivoRejeicao: res.mensagem } }); 
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
                setVendasBaseLocal(atualiza); setVendasHistoricoExibicao(atualiza); 
                setDadosRecibo({ ...dadosRecibo, fiscal: { ...dadosRecibo.fiscal, status: 'PROCESSANDO', idPlugNotas: res.idPlugNotas } });
            } else { setNfceStatus('error'); tocarBeepErro(); toast.error(res.error || 'Erro ao solicitar'); }
        } catch (e) { setNfceStatus('error'); tocarBeepErro(); toast.error('Erro de conexão.'); }
    };

    const handleProcessarLoteNfce = async (vendasParaProcessar) => {
        if (!vendasParaProcessar || vendasParaProcessar.length === 0) return;
        showConfirm(`Reprocessar ${vendasParaProcessar.length} notas?`, async () => {
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
            setVendasHistoricoExibicao(listaAtualizada); setVendasBaseLocal(prev => prev.map(v => listaAtualizada.find(lu => lu.id === v.id) || v));
            if (falhas > 0) { tocarBeepErro(); toast.error(`Concluído com ${falhas} falha(s). ✅ ${sucesso} | 🚫 ${canceladas}`); } else { toast.success(`Concluído! ✅ ${sucesso} sucesso(s), 🚫 ${canceladas} cancelada(s)`); }
        }, { title: 'Reprocessar Lote NFC-e', confirmText: 'Reprocessar' });
    };

    const handleCancelarNfce = async (vendaParam) => {
        const targetVenda = vendaParam || dadosRecibo;
        if (!targetVenda?.id) return;

        const statusNfce = targetVenda.fiscal?.status?.toUpperCase() || '';
        const temNfce = statusNfce === 'AUTORIZADA' || statusNfce === 'CONCLUIDO';

        if (temNfce) {
            showPrompt('Motivo do cancelamento (mínimo 15 caracteres):', async (motivo) => {
                if (motivo.trim().length < 15) return toast.warning('Mínimo 15 caracteres.');
                setNfceStatus('loading');
                try {
                    const res = await vendaService.cancelarNfce(targetVenda.id, motivo.trim());
                    if (res.success) { 
                        toast.success('Cancelamento enviado!'); 
                        await cancelarCrediarioSeNecessario(targetVenda);
                        if (dadosRecibo?.id === targetVenda.id) {
                            setDadosRecibo({ ...dadosRecibo, status: 'cancelada', fiscal: { ...dadosRecibo.fiscal, status: 'PROCESSANDO' } }); 
                        }
                        const atualiza = (l) => l.map(v => v.id === targetVenda.id ? { ...v, status: 'cancelada', fiscal: { ...v.fiscal, status: 'PROCESSANDO' } } : v ); 
                        setVendasBaseLocal(atualiza); setVendasHistoricoExibicao(atualiza); 
                    } else { toast.error('Erro: ' + res.error); }
                } catch (e) { toast.error('Falha de comunicação.'); } finally { setNfceStatus('idle'); }
            }, { title: 'Cancelar NFC-e', placeholder: 'Descreva o motivo...', submitText: 'Cancelar NFC-e' });
        } else {
            showConfirm('Deseja realmente cancelar esta venda? Ela não fará mais parte do faturamento do caixa/turno.', async () => {
                setNfceStatus('loading');
                try {
                    if (targetVenda.origem === 'os' || targetVenda.origem === 'crediario') {
                        const { caixaAberto, setMovimentacoesDoTurno } = usePdvStore.getState();
                        if (caixaAberto?.id) {
                            const res = await caixaService.atualizarMovimentacao(caixaAberto.id, targetVenda.id, { status: 'cancelada' });
                            if (res.success) {
                                toast.success('Movimentação cancelada com sucesso!');
                                if (dadosRecibo?.id === targetVenda.id) {
                                    setDadosRecibo({ ...dadosRecibo, status: 'cancelada' });
                                }
                                const atualiza = (l) => l.map(v => v.id === targetVenda.id ? { ...v, status: 'cancelada' } : v );
                                setVendasBaseLocal(atualiza); setVendasHistoricoExibicao(atualiza);
                                
                                const updatedMovs = await caixaService.buscarMovimentacoes(caixaAberto.id);
                                setMovimentacoesDoTurno(updatedMovs);
                            } else {
                                toast.error('Erro ao cancelar movimentação: ' + res.error);
                            }
                        } else {
                            toast.error('Caixa fechado ou inválido.');
                        }
                    } else {
                        const docRef = doc(db, 'vendas', targetVenda.id);
                        await updateDoc(docRef, { status: 'cancelada' });
                        await cancelarCrediarioSeNecessario(targetVenda);
                        toast.success('Venda cancelada com sucesso!');
                        if (dadosRecibo?.id === targetVenda.id) {
                            setDadosRecibo({ ...dadosRecibo, status: 'cancelada' });
                        }
                        const atualiza = (l) => l.map(v => v.id === targetVenda.id ? { ...v, status: 'cancelada' } : v );
                        setVendasBaseLocal(atualiza); setVendasHistoricoExibicao(atualiza);
                    }
                } catch (error) {
                    console.error("Erro ao cancelar venda local:", error);
                    toast.error('Erro ao cancelar venda.');
                } finally {
                    setNfceStatus('idle');
                }
            }, { title: 'Cancelar Venda', confirmText: 'Cancelar Venda', cancelText: 'Voltar' });
        }
    };

    const handleBaixarXml = async (venda) => { if (!venda.fiscal?.idPlugNotas) return toast.warning('Sem ID'); try { const res = await vendaService.baixarXmlNfce(venda.fiscal.idPlugNotas, venda.id.slice(-6)); if (!res.success) toast.error('Erro: ' + res.error); } catch (e) { console.error(e); } };
    const handleBaixarPdf = async (venda) => { const id = venda.fiscal?.idPlugNotas; if (!id) return toast.warning('Sem ID'); setNfceStatus('loading'); try { const res = await vendaService.baixarPdfNfce(id, venda.fiscal?.pdf); if (!res.success) toast.error('Erro: ' + res.error); } catch (e) { console.error(e); } finally { setNfceStatus('idle'); } };

    // Efeito para real-time do Recibo se aberto
    useEffect(() => {
        let unsub = () => {};
        if (dadosRecibo?.id) {
            unsub = onSnapshot(doc(db, 'vendas', dadosRecibo.id), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data(); setDadosRecibo({ ...dadosRecibo, fiscal: data.fiscal });
                    if (data.fiscal) {
                        const st = data.fiscal.status?.toUpperCase();
                        if (st === 'AUTORIZADA' || st === 'CONCLUIDO') { setNfceStatus('success'); setNfceUrl(data.fiscal.pdf); const atualiza = p => p.map(v => v.id === dadosRecibo.id ? { ...v, fiscal: data.fiscal } : v); setVendasBaseLocal(atualiza); setVendasHistoricoExibicao(atualiza); } 
                        else if (st === 'REJEITADO' || st === 'REJEITADA' || st === 'DENEGADO') { setNfceStatus('error'); setNfceUrl(null); const atualiza = p => p.map(v => v.id === dadosRecibo.id ? { ...v, fiscal: data.fiscal } : v); setVendasBaseLocal(atualiza); setVendasHistoricoExibicao(atualiza); } 
                        else if (st === 'PROCESSANDO') { setNfceStatus('loading'); }
                    }
                }
            });
        }
        return () => unsub();
    }, [dadosRecibo?.id, setDadosRecibo, setVendasBaseLocal, setVendasHistoricoExibicao]);

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
                        setVendasBaseLocal(atualiza); setVendasHistoricoExibicao(atualiza); setDadosRecibo({ ...dadosRecibo, fiscal: { ...dadosRecibo.fiscal, status: res.statusAtual, pdf: res.pdf, xml: res.xml, motivoRejeicao: res.mensagem } });
                        if (ns === 'error') tocarBeepErro();
                    }
                } catch (e) { console.error(e); }
            }, 3000);
        }
        return () => clearInterval(intervalo);
    }, [nfceStatus, dadosRecibo, setVendasBaseLocal, setVendasHistoricoExibicao, setDadosRecibo, tocarBeepErro]);

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
