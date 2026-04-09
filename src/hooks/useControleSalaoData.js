import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy, where, doc, getDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { vendaService } from '../services/vendaService';
import { tocarCampainha } from '../utils/audioUtils';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useLocalSync } from '../context/LocalSyncContext';

export function useControleSalaoData(userData, user, currentUser) {
    const navigate = useNavigate();
    const usuarioLogado = user || currentUser;
    const { socket, isConnected } = useLocalSync();

    const estabelecimentoId = useMemo(() => {
        return userData?.estabelecimentosGerenciados?.[0] || userData?.estabelecimentoId || userData?.idEstabelecimento || null;
    }, [userData]);

    const [nomeEstabelecimento, setNomeEstabelecimento] = useState("Carregando...");
    const [mesas, setMesas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    // UI States (Listagem)
    const [filtro, setFiltro] = useState('todos');
    const [buscaMesa, setBuscaMesa] = useState('');

    // Fila Impressão
    const [filaImpressao, setFilaImpressao] = useState([]);

    // Modais e Ações de Mesas
    const [isModalAbrirMesaOpen, setIsModalAbrirMesaOpen] = useState(false);
    const [mesaParaAbrir, setMesaParaAbrir] = useState(null);
    const [isOpeningTable, setIsOpeningTable] = useState(false);

    // NFC-e / Recibos / Histórico
    const [mostrarRecibo, setMostrarRecibo] = useState(false);
    const [dadosRecibo, setDadosRecibo] = useState(null);
    const [nfceStatus, setNfceStatus] = useState('idle');
    const [nfceUrl, setNfceUrl] = useState(null);
    const [isHistoricoVendasOpen, setIsHistoricoVendasOpen] = useState(false);
    const [vendasHistoricoExibicao, setVendasHistoricoExibicao] = useState([]);
    const [carregandoHistorico, setCarregandoHistorico] = useState(false);

    const [promptCancelNfce, setPromptCancelNfce] = useState({ open: false, venda: null });
    const [promptWhatsApp, setPromptWhatsApp] = useState({ open: false, venda: null, defaultTel: '' });

    // 1. Loop de Tempo
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // 2. Busca Nome Estabelecimento
    useEffect(() => {
        const fetchNome = async () => {
            if (estabelecimentoId) {
                try {
                    const docSnap = await getDoc(doc(db, "estabelecimentos", estabelecimentoId));
                    if (docSnap.exists()) setNomeEstabelecimento(docSnap.data().nome || userData?.nomeEstabelecimento || "IdeaFood");
                } catch (error) { setNomeEstabelecimento(userData?.nomeEstabelecimento || "IdeaFood"); }
            }
        };
        fetchNome();
    }, [estabelecimentoId, userData]);

    // 3. Listener Mesas
    useEffect(() => {
        if (!estabelecimentoId) { if (userData) setLoading(false); return; }
        setLoading(true);
        const q = query(collection(db, 'estabelecimentos', estabelecimentoId, 'mesas'), orderBy('numero'));
        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'modified') {
                        const oldData = change.oldIndex !== -1 ? snapshot.docs[change.oldIndex]?.data() : null; // we actually can't get old data easily from snapshot, better to just check the new doc
                        // A simple way to alert only when boolean turns true is handled by local state or assuming if the field is present, it was just updated (since it will be cleared after).
                        const data = change.doc.data();
                        // Se o campo acabou de vir true, tocar campainha. (Isso pode tocar duplicado se outra coisa alterar, mas garçom limpa o campo na tela)
                        // Para precisão: melhor apenas checar se possui o campo true na listagem abaixo
                    }
                });

                const mesasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Verifica chamados de garçom recem acionados pegando as mesas que estao chamando:
                // Para evitar loop no first load, tocamos independente se já carregou antes:
                // Mas pera, para evitar spam no refresh, ideal não tocar na montagem.
                
                mesasData.sort((a, b) => {
                    const numA = parseFloat(a.numero);
                    const numB = parseFloat(b.numero);
                    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                    return String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true });
                });
                
                // Checagem de sons apenas em MODIFIED:
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'modified') {
                        const data = change.doc.data();
                        if (data.chamandoGarcom || data.pedindoConta) {
                            tocarCampainha();
                            if (data.chamandoGarcom) toast.warning(`🛎️ Mesa ${data.numero} está chamando!`);
                            if (data.pedindoConta) toast.success(`💲 Mesa ${data.numero} pediu a conta!`);
                        }
                    }
                });

                setMesas(mesasData);
                setLoading(false);
            },
            (error) => { console.error("Erro mesas:", error); setLoading(false); }
        );
        );
        return () => unsubscribe();
    }, [estabelecimentoId, userData]);

    // Listener do Servidor Local para Sincronização em Tempo Real (Offline)
    useEffect(() => {
        if (!socket || !isConnected) return;

        const handleSyncExata = (payload) => {
            setMesas(prev => {
                const isExisting = prev.find(m => m.id === payload.id);
                if (isExisting) {
                    return prev.map(m => m.id === payload.id ? { ...m, ...payload } : m);
                } else {
                    return [...prev, payload];
                }
            });
        };

        socket.on('SYNC_MESA_ABERTA', handleSyncExata);
        socket.on('SYNC_MESA', handleSyncExata);
        socket.on('SYNC_ALERTA', (payload) => {
             if (payload.chamandoGarcom) {
                tocarCampainha();
                toast.warning(`🛎️ Mesa ${payload.numero} está chamando! (Via REDE LOCAL)`);
             }
             handleSyncExata(payload);
        });

        return () => {
            socket.off('SYNC_MESA_ABERTA');
            socket.off('SYNC_MESA');
            socket.off('SYNC_ALERTA');
        };
    }, [socket, isConnected]);

    const limparAlertaMesa = async (mesaId) => {
        try {
            await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId), {
                chamandoGarcom: false,
                pedindoConta: false
            });
            toast.info("Alerta da mesa removido.");
        } catch(e) {
            console.error(e);
        }
    };

    // 4. Listener Impressão Invisível (Fila)
    useEffect(() => {
        if (!estabelecimentoId) return;
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        if (isMobileDevice) return; 

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
                        setTimeout(() => { setFilaImpressao(prev => prev.filter(url => url !== urlImpressao)); }, 15000); 
                        try { await updateDoc(doc(db, "estabelecimentos", estabelecimentoId, "mesas", docMesa.id), { solicitarImpressaoConferencia: false, setorImpressao: null }); } catch (err) {}
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
                        toast.info(`🖨️ Imprimindo pedido da Mesa ${dadosPedido.mesaNumero}...`);
                        const urlImpressao = `/impressao-isolada?estabId=${estabelecimentoId}&pedidoId=${docPedido.id}&setor=${setor}&t=${Date.now()}`;
                        setFilaImpressao(prev => [...prev, urlImpressao]);
                        setTimeout(() => { setFilaImpressao(prev => prev.filter(url => url !== urlImpressao)); }, 15000);
                        try { await updateDoc(doc(db, "estabelecimentos", estabelecimentoId, "pedidos", docPedido.id), { solicitarImpressao: false, setorImpressao: null }); } catch (err) {}
                    }
                }
            });
        });

        return () => { unsubMesas(); unsubPedidos(); };
    }, [estabelecimentoId]);

    // 5. Listener NFC-e Atualização em Tempo Real (Documento Específico)
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
                } catch (e) {}
            }, 3000);
        }
        return () => clearInterval(intervalo);
    }, [nfceStatus, dadosRecibo]);

    // ===== LÓGICA DE NEGÓCIO =====
    const verificarMesaOciosa = useCallback((mesa) => {
        if (mesa.status !== 'ocupada' || (mesa.itens && mesa.itens.length > 0)) return false;
        if (!mesa.updatedAt) return false;
        const dataAbertura = mesa.updatedAt.toDate ? mesa.updatedAt.toDate() : new Date(mesa.updatedAt);
        return Math.floor((currentTime - dataAbertura) / 60000) >= 10; 
    }, [currentTime]);

    const handleAdicionarMesa = async (numeroMesa) => {
        if (!numeroMesa || !estabelecimentoId) return { success: false };
        try {
            await addDoc(collection(db, 'estabelecimentos', estabelecimentoId, 'mesas'), {
                numero: !isNaN(numeroMesa) ? Number(numeroMesa) : numeroMesa,
                status: 'livre', total: 0, pessoas: 0, itens: [], tipo: 'mesa',
                createdAt: serverTimestamp(), updatedAt: serverTimestamp()
            });
            toast.success("Mesa criada!"); return { success: true };
        } catch (error) { toast.error("Erro ao criar."); return { success: false }; }
    };

    const handleExcluirMesa = async (id) => {
        try { await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', id)); toast.success("Excluída."); }
        catch (error) { toast.error("Erro."); }
    };

    const handleExcluirMesasLivres = async () => {
        const livres = mesas.filter(m => m.status === 'livre');
        if (livres.length === 0) {
            toast.info("Não há mesas livres para excluir.");
            return;
        }
        if (!window.confirm(`Tem certeza que deseja excluir as ${livres.length} mesas livres permanentemente?`)) return;

        try {
            const promessas = livres.map(m => deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', m.id)));
            await Promise.all(promessas);
            toast.success(`${livres.length} mesas livres excluídas com sucesso.`);
        } catch (error) {
            toast.error("Erro ao excluir algumas mesas.");
        }
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
                const agora = new Date(); let tempoBloqueio = 0;
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
            try { await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaParaAbrir.id), { bloqueadoPor: null, bloqueadoPorNome: null, bloqueadoEm: null }); } catch (error) {}
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
            
            // Atira evento na rede local! (se houver sem internet, todos saberão imediatamente)
            if (socket && isConnected) {
                socket.emit('MESA_ABERTA', { id: mesaParaAbrir.id, status: 'ocupada', pessoas: qtd, nome: nomeCliente || '' });
            }

            setIsModalAbrirMesaOpen(false);
            navigate(`/estabelecimento/${estabelecimentoId}/mesa/${mesaParaAbrir.id}`);
        } catch (error) { toast.error("Erro ao sincronizar com o servidor."); } 
        finally { setIsOpeningTable(false); }
    };

    // Computeds (Filtros & Stats)
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
        return {
            total: mesas.length, ocupadas: ocupadas.length, livres: mesas.length - ocupadas.length,
            pessoas: ocupadas.reduce((acc, m) => acc + (m.pessoas || 0), 0), vendas: ocupadas.reduce((acc, m) => acc + (m.total || 0), 0),
            ocupacaoPercent: mesas.length > 0 ? Math.round((ocupadas.length / mesas.length) * 100) : 0
        };
    }, [mesas]);

    // Funções Fiscais (NFCe)
    const tocarBeepErro = () => { try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, ctx.currentTime); gain.gain.setValueAtTime(0.15, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5); osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.5); } catch (e) {} };

    const handleCancelarNfce = (venda) => { if (!venda || !venda.id) return; setPromptCancelNfce({ open: true, venda }); };

    const executarCancelamentoNfce = async (justificativa) => {
        const venda = promptCancelNfce.venda; setPromptCancelNfce({ open: false, venda: null });
        if (!justificativa || justificativa.trim().length < 15) { if (justificativa !== null) toast.warning('O motivo deve ter pelo menos 15 caracteres.'); return; }
        setNfceStatus('loading');
        try {
            const res = await vendaService.cancelarNfce(venda.id, justificativa.trim());
            if (res.success || res.sucesso) {
                toast.success('Nota Fiscal cancelada com sucesso!');
                setDadosRecibo(p => ({ ...p, fiscal: { ...p.fiscal, status: 'CANCELADO' } }));
                setVendasHistoricoExibicao(p => p.map(v => v.id === venda.id ? { ...v, fiscal: { ...v.fiscal, status: 'CANCELADO' } } : v));
                setNfceStatus('idle');
            } else { setNfceStatus('error'); tocarBeepErro(); toast.error('Erro ao cancelar: ' + res.error); }
        } catch (e) { setNfceStatus('error'); tocarBeepErro(); toast.error('Falha de conexão.'); }
    };

    const abrirHistoricoVendas = useCallback(async () => {
        setIsHistoricoVendasOpen(true); setCarregandoHistorico(true);
        try { const vendas = await vendaService.buscarVendasPorEstabelecimento(estabelecimentoId, 50); setVendasHistoricoExibicao(vendas); } 
        catch (error) { toast.error("Erro ao buscar histórico."); } 
        finally { setCarregandoHistorico(false); }
    }, [estabelecimentoId]);

    const selecionarVendaHistorico = (venda) => {
        const vendaNormalizada = { ...venda, itens: venda.itens?.map(item => { const precoReal = item.precoUnitario || item.preco || item.valor || item.price || 0; const qtdReal = item.quantidade || item.quantity || item.qtd || 1; return { ...item, preco: precoReal, precoUnitario: precoReal, valor: precoReal, price: precoReal, quantidade: qtdReal, quantity: qtdReal, nome: item.nome || item.name || 'Item' }; }) };
        setDadosRecibo(vendaNormalizada); setNfceStatus(vendaNormalizada.fiscal?.status === 'AUTORIZADA' ? 'success' : 'idle'); setNfceUrl(vendaNormalizada.fiscal?.pdf || null); setIsHistoricoVendasOpen(false); setMostrarRecibo(true);
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

    const handleBaixarXml = async (venda) => { if (!venda.fiscal?.idPlugNotas) return toast.warning('Sem ID'); try { const res = await vendaService.baixarXmlNfce(venda.fiscal.idPlugNotas, venda.id.slice(-6)); if (!res.success) toast.error('Erro: ' + res.error); } catch (e) { console.error(e); } };
    const handleBaixarPdf = async (venda) => { const id = venda.fiscal?.idPlugNotas; if (!id) return toast.warning('Sem ID'); setNfceStatus('loading'); try { const res = await vendaService.baixarPdfNfce(id, venda.fiscal?.pdf); if (!res.success) toast.error('Erro: ' + res.error); } catch (e) { console.error(e); } finally { if (nfceStatus === 'loading') setNfceStatus('idle'); } };
    
    const handleEnviarWhatsApp = (venda) => {
        if (!venda.fiscal?.pdf) return toast.warning('⚠️ Link PDF indisponível.');
        const telPadrao = (venda.clienteTelefone || venda.cliente?.telefone || '').replace(/\D/g, '');
        setPromptWhatsApp({ open: true, venda, defaultTel: telPadrao });
    };

    const executarEnvioWhatsApp = (tel) => {
        const venda = promptWhatsApp.venda; setPromptWhatsApp({ open: false, venda: null, defaultTel: '' });
        if (!tel) return; const telLimpo = tel.replace(/\D/g, '');
        const msg = encodeURIComponent(`Olá! Agradecemos a preferência. 😃\nSua Nota Fiscal:\n${venda.fiscal.pdf}`);
        window.open(telLimpo.length >= 10 ? `https://wa.me/${telLimpo.startsWith('55') ? telLimpo : `55${telLimpo}`}?text=${msg}` : `https://api.whatsapp.com/send?text=${msg}`, '_blank');
    };

    const handlePagamentoConcluido = (vendaFinalizada, setMesaParaPagamento, setIsModalPagamentoOpen) => { 
        setIsModalPagamentoOpen(false); setMesaParaPagamento(null); 
        if (vendaFinalizada && vendaFinalizada.id) {
            const vendaNormalizada = { ...vendaFinalizada, itens: vendaFinalizada.itens?.map(item => { const precoReal = item.precoUnitario || item.preco || item.valor || item.price || 0; const qtdReal = item.quantidade || item.quantity || item.qtd || 1; return { ...item, preco: precoReal, precoUnitario: precoReal, valor: precoReal, price: precoReal, quantidade: qtdReal, quantity: qtdReal, nome: item.nome || item.name || 'Item' }; }) };
            setDadosRecibo(vendaNormalizada); setNfceStatus(vendaNormalizada.fiscal?.status === 'AUTORIZADA' ? 'success' : 'idle'); setNfceUrl(vendaNormalizada.fiscal?.pdf || null); setMostrarRecibo(true);
        } else { toast.success("Mesa paga e encerrada com sucesso!"); }
    };

    return {
        // Dados e Stats base
        mesas, loading, currentTime, nomeEstabelecimento, estabelecimentoId,
        // Listagem
        filtro, setFiltro, buscaMesa, setBuscaMesa, mesasFiltradas, stats, verificarMesaOciosa,
        // Impressão
        filaImpressao,
        // Ações Mesas
        handleAdicionarMesa, handleExcluirMesa, handleExcluirMesasLivres, handleMesaClick, limparAlertaMesa,
        isModalAbrirMesaOpen, setIsModalAbrirMesaOpen, mesaParaAbrir, isOpeningTable,
        handleCancelarAbertura, handleConfirmarAbertura, handlePagamentoConcluido,
        // Fiscais & Histórico
        mostrarRecibo, setMostrarRecibo, dadosRecibo, setDadosRecibo, nfceStatus, nfceUrl,
        isHistoricoVendasOpen, setIsHistoricoVendasOpen, vendasHistoricoExibicao, carregandoHistorico,
        abrirHistoricoVendas, selecionarVendaHistorico, handleEmitirNfce, handleConsultarStatus,
        handleBaixarXml, handleBaixarPdf, handleCancelarNfce, executarCancelamentoNfce,
        handleEnviarWhatsApp, executarEnvioWhatsApp,
        promptCancelNfce, setPromptCancelNfce, promptWhatsApp, setPromptWhatsApp
    };
}
