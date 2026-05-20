import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, getDocs, doc, updateDoc, deleteDoc, getDoc, getDocFromCache, serverTimestamp, where, Timestamp } from 'firebase/firestore';
import { db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'react-toastify';
import { isItemCozinha } from '../utils/painelUtils';
import { rotearEImprimir } from '../services/printService';
import { tocarCampainha, falarNovaComanda } from '../utils/audioUtils';

export const useOrdersPanel = (estabelecimentoAtivo, authLoading) => {
    const [dataSelecionada, setDataSelecionada] = useState(() => {
        const hj = new Date();
        return hj.getFullYear() + '-' + String(hj.getMonth() + 1).padStart(2, '0') + '-' + String(hj.getDate()).padStart(2, '0');
    });

    const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
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

    const limparDadosCliente = useCallback((clienteData, fallbackNome = 'Cliente') => {
        if (!clienteData || typeof clienteData !== 'object') return { nome: fallbackNome, telefone: '', endereco: {} };
        if ('_methodName' in clienteData || 'toDate' in clienteData) return { nome: fallbackNome, telefone: '', endereco: {} };
        
        let nomeFinal = clienteData.nome;
        // FIX: Não rejeitar o nome 'Cliente' — pode ser nome real. Só usa fallback se vazio/nulo.
        if (!nomeFinal || String(nomeFinal).trim() === '') {
            nomeFinal = fallbackNome && String(fallbackNome).trim() !== '' ? fallbackNome : 'Cliente';
        }
        
        return { nome: nomeFinal, telefone: clienteData.telefone || '', endereco: (clienteData.endereco && typeof clienteData.endereco === 'object') ? clienteData.endereco : {} };
    }, []);

    const processarDadosPedido = useCallback((pedidoData) => {
        if (!pedidoData || !pedidoData.id) return null;
        
        // CORREÇÃO: Sanitiza os itens para remover a poluição de categorias globais de adicionais
        const rawItens = Array.isArray(pedidoData.itens) ? pedidoData.itens.map(item => {
            let adics = item.adicionaisSelecionados;
            
            // Se adicionaisSelecionados não existe ou não é array, fazemos o fallback para adicionais
            if (!adics || !Array.isArray(adics)) {
                adics = Array.isArray(item.adicionais) ? item.adicionais : [];
            } else if (adics.length === 0 && Array.isArray(item.adicionais) && item.adicionais.length > 0) {
                 adics = item.adicionais;
            }

            // Sempre filtrar lixo de forma incondicional (pois o cache do cliente pode ter salvo lixo no adicionaisSelecionados)
            const lixo = ['COMPLEMENTOS', 'MOLHOS', 'CARNES', 'PAES', 'SALADAS', 'QUEIJOS', 'BANHEIRO', 'FICHAS', 'ADICIONAIS', 'EXTRAS'];
            adics = adics.filter(a => {
                const nomeStr = typeof a === 'string' ? a : (a.nome || '');
                const nomeUpper = String(nomeStr).toUpperCase();
                const isLixo = lixo.some(lx => nomeUpper === lx || nomeUpper.includes(lx));
                const temPreco = a.preco !== undefined && a.preco !== null && Number(a.preco) > 0;
                return !isLixo || temPreco;
            });

            return {
                ...item,
                adicionaisSelecionados: adics,
                adicionais: adics // Sobrescreve para que PedidoCard e printService usem a lista limpa
            };
        }) : [];

        const itensFiltradosParaCozinha = rawItens.filter(isItemCozinha);
        const fallbackNome = pedidoData.clienteNome || pedidoData.nomeCliente || 'Cliente';
        const clienteLimpo = limparDadosCliente(pedidoData.cliente, fallbackNome);
        
        let endereco = pedidoData.endereco || {};
        if (clienteLimpo.endereco && Object.keys(clienteLimpo.endereco).length > 0) endereco = { ...endereco, ...clienteLimpo.endereco };
        
        let source = pedidoData.source;
        let tipo = pedidoData.tipo;
        const temMesa = pedidoData.mesaNumero && String(pedidoData.mesaNumero).trim() !== '' && String(pedidoData.mesaNumero) !== '0';
        
        if (source === 'salao' || temMesa || tipo === 'mesa') { source = 'salao'; tipo = 'mesa'; } 
        else { if (!source) source = 'delivery'; if (!tipo) tipo = 'delivery'; }

        return { ...pedidoData, id: pedidoData.id, cliente: clienteLimpo, endereco: endereco, source: source, tipo: tipo, status: pedidoData.status || 'recebido', itens: rawItens, itensCozinha: itensFiltradosParaCozinha, mesaNumero: pedidoData.mesaNumero || 0, loteHorario: pedidoData.loteHorario || '' };
    }, [limparDadosCliente]);

    useEffect(() => {
        setPedidos({ recebido: [], preparo: [], em_entrega: [], pronto_para_servir: [], finalizado: [] });
        setMotoboys([]); setNewOrderIds(new Set()); setPrintQueue([]); setEstabelecimentoInfo(null); setLoading(true);
    }, [estabelecimentoAtivo, dataSelecionada]);

    useEffect(() => {
        if (!estabelecimentoAtivo) return;
        const qMotoboys = query(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'entregadores'));
        const unsubscribe = onSnapshot(qMotoboys, (snapshot) => { setMotoboys(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); });
        return () => unsubscribe();
    }, [estabelecimentoAtivo]);

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
            let status = data.status || 'recebido';
            if (['pendente', 'aguardando_pagamento', 'pago', 'paid', 'approved', 'success'].includes(status)) status = 'recebido';
            const pedidoId = change.doc.id;

            const timestamp = data.createdAt || data.dataPedido || data.criadoEm || data.updatedAt;
            if (timestamp) {
                const dataDoPedido = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000 || timestamp);
                const hoje = new Date();
                if (dataDoPedido.getDate() !== hoje.getDate() || dataDoPedido.getMonth() !== hoje.getMonth() || dataDoPedido.getFullYear() !== hoje.getFullYear()) return;
                if ((hoje - dataDoPedido) / (1000 * 60 * 60) > 3) return;
            }

            const configAtual = modoImpressaoRef.current;
            if (configAtual === 'desligado') return;

            const isDelivery = data.source !== 'salao' && data.tipo !== 'mesa' && !data.mesaNumero;
            const rawItens = Array.isArray(data.itens) ? data.itens : [];
            const temItensCozinha = rawItens.some(isItemCozinha);

            // 🔥 FIX: Se for pedido do Salão (Mesa), NUNCA dispara popup automático se for APENAS bebida.
            // As bebidas do salão normalmente vão direto pro bar (o garçom avisa ou usa a via manual).
            if (!isDelivery && !temItensCozinha) {
                return;
            }

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

                    const pedidoParaImprimir = processarDadosPedido({ id: pedidoId, ...data });
                    if (pedidoParaImprimir) {
                        if (configAtual === 'cozinha' && !isDelivery) {
                            pedidoParaImprimir.itens = (pedidoParaImprimir.itens || []).filter(isItemCozinha);
                            if (pedidoParaImprimir.itens.length === 0) return;
                        }
                        setPrintQueue(prev => prev.some(p => p.id === pedidoId) ? prev : [...prev, pedidoParaImprimir]);
                    }
                };

                // 🔥 PREVINE RACE CONDITION DE MÚLTIPLAS ABAS USANDO WEB LOCKS
                if (window.navigator && window.navigator.locks) {
                    window.navigator.locks.request(`print_auto_${pedidoId}`, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
                        if (!lock) return; // Outra aba já pegou o lock e está imprimindo
                        await tentarImprimir();
                    });
                } else {
                    tentarImprimir();
                }
            }
        };

        const unsubscribers = [];
        // Tenta cache primeiro (offline-first), depois servidor
        const estabRef = doc(db, 'estabelecimentos', estabelecimentoAtivo);
        getDocFromCache(estabRef)
            .then(snap => { if (snap.exists()) setEstabelecimentoInfo(snap.data()); })
            .catch(() => getDoc(estabRef).then(snap => { if (snap.exists()) setEstabelecimentoInfo(snap.data()); }).catch(() => {}));

        let isFirstRun = true;
        let dadosSubcollection = [];
        let dadosVendasRaiz = [];

        const mergeAndSetPedidos = () => {
            const mergedMap = new Map();
            dadosSubcollection.forEach(d => mergedMap.set(d.id, d));
            dadosVendasRaiz.forEach(d => { 
                if (d.mesaId || d.mesaNumero) return; 
                if (!mergedMap.has(d.id)) mergedMap.set(d.id, d); 
            });

            const listaTodos = Array.from(mergedMap.values()).map(d => processarDadosPedido(d)).filter(p => {
                if (p === null) return false;
                const dateOk = isSelectedDate(p.dataPedido || p.createdAt || p.criadoEm || p.updatedAt);
                return visualizandoHoje && !(p.dataPedido || p.createdAt || p.criadoEm || p.updatedAt) ? true : dateOk;
            });
            listaTodos.forEach(p => { if (['pendente', 'aguardando_pagamento', 'pago', 'paid', 'approved', 'success'].includes(p.status)) p.status = 'recebido'; });

            setPedidos(prev => ({
                ...prev,
                recebido: listaTodos.filter(p => p.status === 'recebido'),
                preparo: listaTodos.filter(p => p.status === 'preparo'),
                em_entrega: listaTodos.filter(p => p.status === 'em_entrega'),
                pronto_para_servir: listaTodos.filter(p => p.status === 'pronto_para_servir'),
                finalizado: listaTodos.filter(p => p.status === 'finalizado')
            }));
            setLoading(false);
        };

        const tsStart = Timestamp.fromDate(startOfDay);
        const tsEnd = Timestamp.fromDate(endOfDay);

        // Query principal (pedidos com createdAt - delivery, salão, etc)
        const qPedidos = query(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'pedidos'), where('createdAt', '>=', tsStart), where('createdAt', '<=', tsEnd), orderBy('createdAt', 'asc'));
        const qVendasRaiz = query(collection(db, 'vendas'), where('estabelecimentoId', '==', estabelecimentoAtivo), where('criadoEm', '>=', tsStart), where('criadoEm', '<=', tsEnd));

        if (visualizandoHoje) {
            unsubscribers.push(onSnapshot(qPedidos, (snapshot) => {
                if (!isFirstRun) snapshot.docChanges().forEach(checkAutoPrint);
                dadosSubcollection = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                mergeAndSetPedidos(); isFirstRun = false;
            }, (err) => console.error('❌ Erro query pedidos:', err)));

            unsubscribers.push(onSnapshot(qVendasRaiz, (snapshot) => { 
                dadosVendasRaiz = snapshot.docs.map(d => ({ id: d.id, ...d.data() })); 
                mergeAndSetPedidos(); 
            }, (err) => console.error('❌ Erro query vendas:', err)));
        } else {
            Promise.all([getDocs(qPedidos), getDocs(qVendasRaiz)]).then(([snapPedidos, snapVendasRaiz]) => {
                dadosSubcollection = snapPedidos.docs.map(d => ({ id: d.id, ...d.data() }));
                dadosVendasRaiz = snapVendasRaiz.docs.map(d => ({ id: d.id, ...d.data() }));
                mergeAndSetPedidos();
                isFirstRun = false;
            }).catch(e => {
                console.error("Erro ao carregar histórico de pedidos:", e);
                setLoading(false);
            });
        }

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
                    let mensagemParaFalar = '';
                    
                    const deveTocarCampainha = realmenteNovos.some(p => {
                        const isMesa = p.source === 'salao' || p.tipo === 'mesa';
                        
                        // Constrói a mensagem dependendo do tipo do pedido
                        if (isMesa) {
                            mensagemParaFalar = `Novo Pedido. Mesa ${p.mesaNumero || 'Indefinida'}.`;
                            // Se for pedido do Salão (Mesa) e só tem bebidas, a cozinha não deve tocar campainha
                            if (!p.itensCozinha || p.itensCozinha.length === 0) return false;
                        } else {
                            const nome = p.cliente?.nome?.split(' ')[0] || 'Desconhecido';
                            mensagemParaFalar = `Novo Delivery de ${nome}.`;
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

                    if (impBalcao || impCozinha) await rotearEImprimir(pedidoParaImprimir, roteamento, impBalcao, impCozinha);
                    else {
                        const isDelivery = pedidoParaImprimir.source !== 'salao' && pedidoParaImprimir.tipo !== 'mesa';
                        const setorQuery = (modoImpressao === 'cozinha' && !isDelivery) ? '&setor=cozinha' : '';
                        const url = `/comanda/${pedidoParaImprimir.id}?estabId=${estabelecimentoAtivo}${setorQuery}`;
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
    }, [printQueue, isPrinting, estabelecimentoInfo, modoImpressao, estabelecimentoAtivo]);

    const handleAtribuirMotoboy = useCallback(async (pedidoId, motoboyId, motoboyNome) => {
        if (!pedidoId || !motoboyId) return toast.error("Dados inválidos");
        try {
            const atribuirMotoboyBackend = httpsCallable(functions, 'atribuirMotoboyBackend');
            await atribuirMotoboyBackend({ estabelecimentoId: estabelecimentoAtivo, pedidoId, motoboyId, motoboyNome });
            toast.success(`🚀 ${motoboyNome} atribuído!`);
        } catch (error) { toast.error("Falha na atribuição"); }
    }, [estabelecimentoAtivo]);

    const handleCancelarPedido = async (pedidoId) => {
        if (!window.confirm("Deseja realmente cancelar este pedido? O estoque e o cashback (se houver) serão estornados automaticamente.")) return;

        try {
            const cancelarBackend = httpsCallable(functions, 'cancelarPedidoBackend');
            await cancelarBackend({
                estabelecimentoId: estabelecimentoAtivo,
                pedidoId: pedidoId
            });
            toast.success("Pedido cancelado com sucesso!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao cancelar: " + (error.message || "Erro desconhecido"));
        }
    };

    const handleUpdateStatusAndNotify = useCallback(async (pedidoId, newStatus) => {
        if (isUpdatingRef.current || bloqueioAtualizacao.has(pedidoId)) return;
        try {
            isUpdatingRef.current = true;
            setBloqueioAtualizacao(prev => new Set(prev).add(pedidoId));

            const atualizarStatusBackend = httpsCallable(functions, 'atualizarStatusPedidoBackend');
            await atualizarStatusBackend({ estabelecimentoId: estabelecimentoAtivo, pedidoId, newStatus });
            toast.success(`Status atualizado!`);
        } catch (error) { toast.error("Erro ao mover pedido."); }
        finally { setTimeout(() => { isUpdatingRef.current = false; setBloqueioAtualizacao(prev => { const novo = new Set(prev); novo.delete(pedidoId); return novo; }); }, 500); }
    }, [estabelecimentoAtivo, bloqueioAtualizacao]);

    const handleUpdateFormaPagamento = useCallback(async (pedidoId, novaForma) => {
        try {
            const atualizarFormaPagamentoBackend = httpsCallable(functions, 'atualizarFormaPagamentoPedidoBackend');
            await atualizarFormaPagamentoBackend({ estabelecimentoId: estabelecimentoAtivo, pedidoId, novaForma });
            toast.success('Forma de pagamento atualizada!');
        } catch (error) { toast.error('Erro ao atualizar.'); }
    }, [estabelecimentoAtivo]);

    // [IFOOD DESATIVADO] - Polling desativado pois causava gargalo nas Cloud Functions em fins de semana.
    // Era disparado a cada 30s por cada aba/garçom aberto, somando centenas de chamadas/hora.
    // Para reativar: implementar via Cloud Scheduler no backend (1 chamada/min centralizada).
    // useEffect(() => {
    //     if (!estabelecimentoAtivo || authLoading) return;
    //     const ifoodPolling = httpsCallable(functions, 'ifoodPolling');
    //     let isMounted = true;
    //     const executarPolling = async () => { ... };
    //     executarPolling();
    //     const intervalId = setInterval(executarPolling, 30000);
    //     return () => { isMounted = false; clearInterval(intervalId); };
    // }, [estabelecimentoAtivo, authLoading]);


    return {
        dataSelecionada, setDataSelecionada,
        estabelecimentoInfo,
        pedidos, loading, motoboys,
        abaAtiva, setAbaAtiva,
        colunaMobile, setColunaMobile,
        notificationsEnabled, setNotificationsEnabled, userInteracted, setUserInteracted,
        modoImpressao, alternarModoImpressao,
        handleAtribuirMotoboy, handleCancelarPedido, handleUpdateStatusAndNotify, handleUpdateFormaPagamento,
        newOrderIds
    };
};
