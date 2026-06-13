import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs, doc, updateDoc, deleteDoc, getDoc, getDocFromCache, serverTimestamp, where, Timestamp } from 'firebase/firestore';
import { db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'react-toastify';
import { isItemCozinha } from '../utils/painelUtils';
import { rotearEImprimir } from '../services/printService';
import { tocarCampainha, falarNovaComanda } from '../utils/audioUtils';
import { enviarMensagemUazapi } from '../services/whatsappService';

export const useNetworkOrdersPanel = (estabelecimentosAtivos = [], authLoading) => {
    const estabs = Array.isArray(estabelecimentosAtivos) ? estabelecimentosAtivos : [estabelecimentosAtivos].filter(Boolean);

    const [dataSelecionada, setDataSelecionada] = useState(() => {
        const hj = new Date();
        return hj.getFullYear() + '-' + String(hj.getMonth() + 1).padStart(2, '0') + '-' + String(hj.getDate()).padStart(2, '0');
    });

    const [estabelecimentosInfo, setEstabelecimentosInfo] = useState({});
    const [pedidos, setPedidos] = useState({ recebido: [], preparo: [], em_entrega: [], pronto_para_servir: [], finalizado: [] });
    const [loading, setLoading] = useState(true);
    const [motoboys, setMotoboys] = useState([]);
    
    // UI e Auto-print
    const [abaAtiva, setAbaAtiva] = useState('delivery');
    const [colunaMobile, setColunaMobile] = useState('recebido');
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [userInteracted, setUserInteracted] = useState(false);
    const [newOrderIds, setNewOrderIds] = useState(new Set());
    const [printQueue, setPrintQueue] = useState([]);
    const [isPrinting, setIsPrinting] = useState(false);
    const [bloqueioAtualizacao, setBloqueioAtualizacao] = useState(new Set());

    const isUpdatingRef = useRef(false);
    const prevRecebidosRef = useRef([]);
    const pedidosJaImpressos = useRef(new Set());

    const [modoImpressao, setModoImpressaoState] = useState(() => localStorage.getItem('config_modo_impressao_painel') || 'tudo');
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

    const limparDadosCliente = useCallback((clienteData) => {
        if (!clienteData || typeof clienteData !== 'object') return { nome: 'Cliente', telefone: '', endereco: {} };
        if ('_methodName' in clienteData || 'toDate' in clienteData) return { nome: 'Cliente', telefone: '', endereco: {} };
        return { nome: clienteData.nome || 'Cliente', telefone: clienteData.telefone || '', endereco: (clienteData.endereco && typeof clienteData.endereco === 'object') ? clienteData.endereco : {} };
    }, []);

    const processarDadosPedido = useCallback((pedidoData, estabelecimentoId) => {
        if (!pedidoData || !pedidoData.id) return null;
        
        const rawItens = Array.isArray(pedidoData.itens) ? pedidoData.itens : [];
        const itensFiltradosParaCozinha = rawItens.filter(isItemCozinha);
        const clienteLimpo = limparDadosCliente(pedidoData.cliente);
        
        let endereco = pedidoData.endereco || {};
        if (clienteLimpo.endereco && Object.keys(clienteLimpo.endereco).length > 0) endereco = { ...endereco, ...clienteLimpo.endereco };
        
        let source = pedidoData.source;
        let tipo = pedidoData.tipo;
        const temMesa = pedidoData.mesaNumero && String(pedidoData.mesaNumero).trim() !== '' && String(pedidoData.mesaNumero) !== '0';
        
        if (source === 'salao' || temMesa || tipo === 'mesa') { source = 'salao'; tipo = 'mesa'; } 
        else { if (!source) source = 'delivery'; if (!tipo) tipo = 'delivery'; }

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
            loteHorario: pedidoData.loteHorario || '',
            estabelecimentoId: estabelecimentoId // IMPORTANTE PARA A REDE
        };
    }, [limparDadosCliente]);

    useEffect(() => {
        setPedidos({ recebido: [], preparo: [], em_entrega: [], pronto_para_servir: [], finalizado: [] });
        setNewOrderIds(new Set());
        setPrintQueue([]);
        setLoading(true);
    }, [estabs.join(','), dataSelecionada]);

    useEffect(() => {
        setMotoboys([]);
        setEstabelecimentosInfo({});
    }, [estabs.join(',')]);


    useEffect(() => {
        if (estabs.length === 0) return;
        const unsubscribers = [];
        let allMotoboys = [];
        
        estabs.forEach(estabId => {
            const qMotoboys = query(collection(db, 'estabelecimentos', estabId, 'entregadores'));
            const unsubscribe = onSnapshot(qMotoboys, (snapshot) => { 
                const boys = snapshot.docs.map(doc => ({ id: doc.id, estabelecimentoId: estabId, ...doc.data() })); 
                allMotoboys = [...allMotoboys.filter(m => m.estabelecimentoId !== estabId), ...boys];
                setMotoboys(allMotoboys);
            });
            unsubscribers.push(unsubscribe);
        });

        return () => unsubscribers.forEach(u => u());
    }, [estabs.join(',')]);

    useEffect(() => {
        if (authLoading || estabs.length === 0) return;
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

        const checkAutoPrint = (change, estabId) => {
            if (!visualizandoHoje) return;
            const data = change.doc.data();
            let status = data.status || 'recebido';
            if (['pendente', 'aguardando_pagamento', 'pago', 'paid', 'approved', 'success'].includes(status)) status = 'recebido';
            const pedidoId = change.doc.id;

            const timestamp = data.createdAt || data.dataPedido || data.criadoEm || data.updatedAt;
            if (timestamp) {
                const dataDoPedido = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000 || timestamp);
                const hoje = new Date();
                // 🔥 MELHORIA DE ROBUSTEZ: Evita que discrepâncias de fusos horários ou pequenas variações de data
                // impeçam a impressão. Em vez de comparar dia/mês/ano de forma rígida, comparamos apenas se a
                // diferença absoluta de tempo é menor que 3 horas. Isso resolve falhas de impressão de pedidos de celular.
                if (Math.abs(hoje - dataDoPedido) / (1000 * 60 * 60) > 3) return;
            }

            const configAtual = modoImpressaoRef.current;
            if (configAtual === 'desligado') return;

            const isDelivery = data.source !== 'salao' && data.tipo !== 'mesa' && !data.mesaNumero;
            const rawItens = Array.isArray(data.itens) ? data.itens : [];
            const temItensCozinha = rawItens.some(isItemCozinha);

            if (!isDelivery && !temItensCozinha) return;

            if (configAtual === 'cozinha' && !isDelivery) {
                if (!temItensCozinha) return; 
            }

            if ((change.type === 'added' || change.type === 'modified') && status === 'recebido') {
                const tentarImprimir = async () => {
                    const impressosLocal = JSON.parse(localStorage.getItem('historico_impresso') || '[]');
                    if (pedidosJaImpressos.current.has(pedidoId) || impressosLocal.includes(pedidoId)) return;

                    pedidosJaImpressos.current.add(pedidoId);
                    impressosLocal.push(pedidoId);
                    if (impressosLocal.length > 50) impressosLocal.shift();
                    localStorage.setItem('historico_impresso', JSON.stringify(impressosLocal));

                    const pedidoParaImprimir = processarDadosPedido({ id: pedidoId, ...data }, estabId);
                    if (pedidoParaImprimir) {
                        if (configAtual === 'cozinha' && !isDelivery) {
                            pedidoParaImprimir.itens = (pedidoParaImprimir.itens || []).filter(isItemCozinha);
                            if (pedidoParaImprimir.itens.length === 0) return;
                        }
                        setPrintQueue(prev => prev.some(p => p.id === pedidoId) ? prev : [...prev, pedidoParaImprimir]);
                    }
                };

                if (window.navigator && window.navigator.locks) {
                    window.navigator.locks.request(`print_auto_${pedidoId}`, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
                        if (!lock) return;
                        await tentarImprimir();
                    });
                } else {
                    tentarImprimir();
                }
            }
        };

        const unsubscribers = [];
        
        // Fetch Estabelecimentos Info
        estabs.forEach(estabId => {
            const estabRef = doc(db, 'estabelecimentos', estabId);
            getDocFromCache(estabRef)
                .then(snap => { if (snap.exists()) setEstabelecimentosInfo(prev => ({...prev, [estabId]: snap.data()})); })
                .catch(() => getDoc(estabRef).then(snap => { if (snap.exists()) setEstabelecimentosInfo(prev => ({...prev, [estabId]: snap.data()})); }).catch(() => {}));
        });

        let dadosSubcollection = {};
        let dadosVendasRaiz = {};
        
        const tsStart = Timestamp.fromDate(startOfDay);
        const tsEnd = Timestamp.fromDate(endOfDay);

        const mergeAndSetPedidos = () => {
            const mergedMap = new Map();
            Object.values(dadosSubcollection).flat().forEach(d => mergedMap.set(d.id, d));
            Object.values(dadosVendasRaiz).flat().forEach(d => { 
                if (d.mesaId || d.mesaNumero) return; 
                if (!mergedMap.has(d.id)) mergedMap.set(d.id, d); 
            });

            const listaTodos = Array.from(mergedMap.values()).map(d => processarDadosPedido(d, d.estabelecimentoId)).filter(p => {
                if (p === null) return false;
                const dateOk = isSelectedDate(p.dataPedido || p.createdAt || p.criadoEm || p.updatedAt);
                return visualizandoHoje && !(p.dataPedido || p.createdAt || p.criadoEm || p.updatedAt) ? true : dateOk;
            });
            listaTodos.forEach(p => { if (['pendente', 'aguardando_pagamento', 'pago', 'paid', 'approved', 'success'].includes(p.status)) p.status = 'recebido'; });

            setPedidos({
                recebido: listaTodos.filter(p => p.status === 'recebido'),
                preparo: listaTodos.filter(p => p.status === 'preparo'),
                em_entrega: listaTodos.filter(p => p.status === 'em_entrega'),
                pronto_para_servir: listaTodos.filter(p => p.status === 'pronto_para_servir'),
                finalizado: listaTodos.filter(p => p.status === 'finalizado')
            });
            setLoading(false);
        };

        estabs.forEach(estabId => {
            const qPedidos = query(collection(db, 'estabelecimentos', estabId, 'pedidos'), where('createdAt', '>=', tsStart), where('createdAt', '<=', tsEnd), orderBy('createdAt', 'asc'));
            const qVendasRaiz = query(collection(db, 'vendas'), where('estabelecimentoId', '==', estabId), where('criadoEm', '>=', tsStart), where('criadoEm', '<=', tsEnd));

            if (visualizandoHoje) {
                let isFirstRun = true;
                unsubscribers.push(onSnapshot(qPedidos, (snapshot) => {
                    if (!isFirstRun) snapshot.docChanges().forEach(change => checkAutoPrint(change, estabId));
                    dadosSubcollection[estabId] = snapshot.docs.map(d => ({ id: d.id, estabelecimentoId: estabId, ...d.data() }));
                    mergeAndSetPedidos(); isFirstRun = false;
                }));

                unsubscribers.push(onSnapshot(qVendasRaiz, (snapshot) => { 
                    dadosVendasRaiz[estabId] = snapshot.docs.map(d => ({ id: d.id, estabelecimentoId: estabId, ...d.data() })); 
                    mergeAndSetPedidos(); 
                }));
            } else {
                Promise.all([getDocs(qPedidos), getDocs(qVendasRaiz)]).then(([snapPedidos, snapVendasRaiz]) => {
                    dadosSubcollection[estabId] = snapPedidos.docs.map(d => ({ id: d.id, estabelecimentoId: estabId, ...d.data() }));
                    dadosVendasRaiz[estabId] = snapVendasRaiz.docs.map(d => ({ id: d.id, estabelecimentoId: estabId, ...d.data() }));
                    mergeAndSetPedidos();
                }).catch(e => {
                    console.error("Erro ao carregar histórico da rede:", e);
                    setLoading(false);
                });
            }
        });

        return () => unsubscribers.forEach(u => u());
    }, [estabs.join(','), authLoading, processarDadosPedido, dataSelecionada]);

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
                    let mensagemParaFalar = '';
                    
                    const deveTocarCampainha = realmenteNovos.some(p => {
                        const isMesa = p.source === 'salao' || p.tipo === 'mesa';
                        const estabNome = estabelecimentosInfo[p.estabelecimentoId]?.nome || 'a loja';
                        
                        if (isMesa) {
                            mensagemParaFalar = `Novo Pedido na ${estabNome}. Mesa ${p.mesaNumero || 'Indefinida'}.`;
                            if (!p.itensCozinha || p.itensCozinha.length === 0) return false;
                        } else {
                            const nome = p.cliente?.nome?.split(' ')[0] || 'Desconhecido';
                            mensagemParaFalar = `Novo Delivery de ${nome} na ${estabNome}.`;
                        }

                        if (isMesa && modoImpressaoRef.current === 'cozinha') return p.itensCozinha && p.itensCozinha.length > 0;
                        return true; 
                    });
                    
                    if (deveTocarCampainha) {
                        tocarCampainha();
                        if (mensagemParaFalar) {
                            falarNovaComanda(mensagemParaFalar);
                        }
                    }
                }
                setTimeout(() => setNewOrderIds(prev => { const next = new Set(prev); novosIds.forEach(id => next.delete(id)); return next; }), 15000);
            }
        }
        prevRecebidosRef.current = novosRecebidos;
    }, [pedidos.recebido, notificationsEnabled, userInteracted, dataSelecionada, estabelecimentosInfo]);

    useEffect(() => {
        const processarFilaDeImpressao = async () => {
            if (!isPrinting && printQueue.length > 0) {
                setIsPrinting(true);
                const pedidoParaImprimir = printQueue[0];
                const estabInfo = estabelecimentosInfo[pedidoParaImprimir.estabelecimentoId];
                try {
                    const roteamento = estabInfo?.roteamentoImpressao || {};
                    const impBalcao = estabInfo?.impressoraBalcao;
                    const impCozinha = estabInfo?.impressoraCozinha;
                    const impBar = estabInfo?.impressoraBar;

                    if (impBalcao || impCozinha || impBar) await rotearEImprimir(pedidoParaImprimir, roteamento, impBalcao, impCozinha, impBar);
                    else {
                        const isDelivery = pedidoParaImprimir.source !== 'salao' && pedidoParaImprimir.tipo !== 'mesa';
                        const setorQuery = (modoImpressao === 'cozinha' && !isDelivery) ? '&setor=cozinha' : '';
                        const url = `/comanda/${pedidoParaImprimir.id}?estabId=${pedidoParaImprimir.estabelecimentoId}${setorQuery}`;
                        const width = 350; const height = 600;
                        const left = (window.screen.width - width) / 2; const top = (window.screen.height - height) / 2;
                        const printWindow = window.open(url, `AutoPrint_${pedidoParaImprimir.id}`, `width=${width},height=${height},top=${top},left=${left},scrollbars=yes`);

                        if (!printWindow) { toast.warning("⚠️ Pop-up bloqueado!"); await new Promise(r => setTimeout(r, 2000)); } 
                        else { await new Promise(resolve => { const timer = setInterval(() => { if (printWindow.closed) { clearInterval(timer); resolve(); } }, 500); }); }
                    }
                } catch (error) { toast.error("Falha ao imprimir."); } 
                finally { setPrintQueue(prev => prev.filter(p => p.id !== pedidoParaImprimir.id)); setIsPrinting(false); }
            }
        };
        processarFilaDeImpressao();
    }, [printQueue, isPrinting, estabelecimentosInfo, modoImpressao]);

    const handleAtribuirMotoboy = useCallback(async (pedidoId, motoboyId, motoboyNome, estabelecimentoId) => {
        if (!pedidoId || !motoboyId || !estabelecimentoId) return toast.error("Dados inválidos");
        try {
            const atribuirMotoboyBackend = httpsCallable(functions, 'atribuirMotoboyBackend');
            await atribuirMotoboyBackend({ estabelecimentoId: estabelecimentoId, pedidoId, motoboyId, motoboyNome });
            toast.success(`🚀 ${motoboyNome} atribuído!`);
        } catch (error) { toast.error("Falha na atribuição"); }
    }, []);

    const handleCancelarPedido = async (pedidoId, estabelecimentoId) => {
        if (!window.confirm("Deseja cancelar este pedido?")) return;
        try {
            const cancelarBackend = httpsCallable(functions, 'cancelarPedidoBackend');
            await cancelarBackend({ estabelecimentoId: estabelecimentoId, pedidoId: pedidoId });
            toast.success("Pedido cancelado com sucesso!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao cancelar: " + (error.message || "Erro desconhecido"));
        }
    };

    const handleUpdateStatusAndNotify = useCallback(async (pedidoId, newStatus, estabelecimentoId) => {
        if (isUpdatingRef.current || bloqueioAtualizacao.has(pedidoId)) return;
        try {
            isUpdatingRef.current = true;
            setBloqueioAtualizacao(prev => new Set(prev).add(pedidoId));

            const atualizarStatusBackend = httpsCallable(functions, 'atualizarStatusPedidoBackend');
            await atualizarStatusBackend({ estabelecimentoId: estabelecimentoId, pedidoId, newStatus });
            toast.success(`Status atualizado!`);

            // 🎫 CARTÃO FIDELIDADE — Incrementar carimbo ao finalizar pedido
            if (newStatus === 'finalizado' && estabelecimentoId) {
                (async () => {
                    try {
                        const estabSnap = await getDoc(doc(db, 'estabelecimentos', estabelecimentoId));
                        const cartelaConfig = estabSnap.data()?.cartelaFidelidade;
                        if (!cartelaConfig?.ativo) return;

                        const pedidoSnap = await getDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'pedidos', pedidoId));
                        if (!pedidoSnap.exists()) return;
                        const pedidoData = pedidoSnap.data();
                        
                        const clienteUid = pedidoData.cliente?.userId || pedidoData.clienteUid || pedidoData.uid;
                        const clienteTelefone = pedidoData.cliente?.telefone || pedidoData.telefoneCliente || '';
                        const clienteId = clienteUid || clienteTelefone.replace(/\D/g, '');
                        if (!clienteId) return;

                        const clienteRef = doc(db, 'estabelecimentos', estabelecimentoId, 'clientes', clienteId);
                        const clienteSnap = await getDoc(clienteRef);
                        const fidelidadeAtual = clienteSnap.exists() ? (clienteSnap.data().fidelidade || {}) : {};
                        
                        if (fidelidadeAtual.premioDisponivel) return;

                        const novosCarimbos = (fidelidadeAtual.carimbos || 0) + 1;
                        const atingiuMeta = novosCarimbos >= cartelaConfig.metaCompras;

                        const updateData = {
                            'fidelidade.carimbos': novosCarimbos,
                            'fidelidade.ultimoCarimbo': serverTimestamp(),
                        };
                        if (atingiuMeta) updateData['fidelidade.premioDisponivel'] = true;

                        if (clienteSnap.exists()) await updateDoc(clienteRef, updateData);

                        // 📲 Notificar cliente via WhatsApp
                        const configWpp = estabSnap.data()?.whatsapp;
                        if (configWpp?.ativo && clienteTelefone) {
                            const nomeCliente = pedidoData.cliente?.nome?.split(' ')[0] || 'Cliente';
                            let msgFidelidade = '';
                            if (atingiuMeta) {
                                msgFidelidade = `🎉 Parabéns, *${nomeCliente}*!\n\nVocê completou sua cartela de fidelidade! 🏆\n\n🎁 *Seu prêmio:* ${cartelaConfig.premio}\n\nNo seu próximo pedido, resgate seu prêmio pelo cardápio digital! 🥳`;
                            } else {
                                const faltam = cartelaConfig.metaCompras - novosCarimbos;
                                msgFidelidade = `🎫 *${nomeCliente}*, você ganhou mais um carimbo!\n\n⭐ Progresso: *${novosCarimbos}/${cartelaConfig.metaCompras}*\n${faltam === 1 ? '🔥 Falta apenas *1 compra* para o prêmio!' : `📍 Faltam *${faltam} compras* para ganhar:`}\n\n🎁 *${cartelaConfig.premio}*\n\nContinue comprando e ganhe! 💪`;
                            }
                            enviarMensagemUazapi(configWpp, clienteTelefone, msgFidelidade).catch(() => {});
                        }
                    } catch (fidErr) {
                        console.warn('[Fidelidade] Erro ao incrementar carimbo:', fidErr);
                    }
                })();
            }
        } catch (error) { toast.error("Erro ao mover pedido."); }
        finally { setTimeout(() => { isUpdatingRef.current = false; setBloqueioAtualizacao(prev => { const novo = new Set(prev); novo.delete(pedidoId); return novo; }); }, 500); }
    }, [bloqueioAtualizacao]);

    const handleUpdateFormaPagamento = useCallback(async (pedidoId, novaForma, estabelecimentoId) => {
        try {
            const atualizarFormaPagamentoBackend = httpsCallable(functions, 'atualizarStatusPedidoBackend');
            await atualizarFormaPagamentoBackend({ estabelecimentoId: estabelecimentoId, pedidoId, formaPagamento: novaForma });
            toast.success('Forma atualizada!');
        } catch (error) { toast.error('Erro ao atualizar.'); }
    }, []);

    // [IFOOD DESATIVADO] - Polling desativado. Ver useOrdersPanel.js para detalhes.
    // useEffect(() => {
    //     if (estabs.length === 0 || authLoading) return;
    //     ... ifoodPolling a cada 30s por estabelecimento ...
    // }, [estabs.join(','), authLoading]);



    return {
        dataSelecionada, setDataSelecionada,
        estabelecimentosInfo,
        pedidos, loading, motoboys,
        abaAtiva, setAbaAtiva,
        colunaMobile, setColunaMobile,
        notificationsEnabled, setNotificationsEnabled, userInteracted, setUserInteracted,
        modoImpressao, alternarModoImpressao,
        handleAtribuirMotoboy, handleCancelarPedido, handleUpdateStatusAndNotify, handleUpdateFormaPagamento,
        newOrderIds
    };
};
