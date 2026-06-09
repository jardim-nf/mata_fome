import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy, where, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { tocarCampainha } from '../utils/audioUtils';
import { toast as rtToast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const getToastConfig = (type, opts) => {
    const bgColors = {
        success: '#10B981',
        error: '#EF4444',
        info: '#3B82F6',
        warning: '#F59E0B'
    };
    return {
        position: "top-center",
        autoClose: 1200,
        hideProgressBar: true,
        closeButton: false,
        theme: "dark",
        ...opts,
        style: {
            borderRadius: '50px',
            minHeight: '40px',
            padding: '8px 20px',
            fontWeight: '900',
            fontSize: '13px',
            color: '#FFFFFF',
            backgroundColor: bgColors[type] || '#1F2937',
            textAlign: 'center',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
            width: 'fit-content',
            maxWidth: '90%',
            margin: '10px auto',
            pointerEvents: 'auto',
            ...opts?.style
        }
    };
};

const toast = {
    success: (msg, opts) => rtToast.success(msg, getToastConfig('success', opts)),
    error: (msg, opts) => rtToast.error(msg, getToastConfig('error', opts)),
    info: (msg, opts) => rtToast.info(msg, getToastConfig('info', opts)),
    warning: (msg, opts) => rtToast.warning(msg, getToastConfig('warning', opts)),
    loading: (msg, opts) => rtToast.loading(msg, { position: "top-center", ...opts }),
    update: (id, opts) => rtToast.update(id, { position: "top-center", ...opts }),
    dismiss: (id) => rtToast.dismiss(id),
};

// Import sub-hooks
import { useSalaoSync } from './useSalaoSync';
import { useSalaoNfce } from './useSalaoNfce';

export function useControleSalaoData(userData, user, currentUser, estabelecimentoIdPrincipal) {
    const navigate = useNavigate();
    const usuarioLogado = user || currentUser;

    const estabelecimentoId = useMemo(() => {
        return estabelecimentoIdPrincipal || userData?.estabelecimentoIdPrincipal || userData?.estabelecimentoId || userData?.idEstabelecimento || null;
    }, [estabelecimentoIdPrincipal, userData]);

    const [nomeEstabelecimento, setNomeEstabelecimento] = useState("Carregando...");
    const [tipoNegocio, setTipoNegocio] = useState("restaurante");
    const [mesas, setMesas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    // UI States (Listagem)
    const [filtro, setFiltro] = useState('todos');
    const [buscaMesa, setBuscaMesa] = useState('');


    // Fila Impressão Sequencial
    const [filaEsperaImpressao, setFilaEsperaImpressao] = useState([]);
    const [imprimindoAtualmente, setImprimindoAtualmente] = useState(null);

    // 1. Processa a fila: pega o próximo item da fila quando estiver ocioso
    useEffect(() => {
        if (imprimindoAtualmente || filaEsperaImpressao.length === 0) return;

        const proximo = filaEsperaImpressao[0];
        setImprimindoAtualmente(proximo);
        setFilaEsperaImpressao(prev => prev.slice(1));
    }, [filaEsperaImpressao, imprimindoAtualmente]);

    // 2. Timer de reset: agenda o reset para null após 8 segundos de impressão ativa
    useEffect(() => {
        if (!imprimindoAtualmente) return;

        const timer = setTimeout(() => {
            setImprimindoAtualmente(null);
        }, 8000); // 8 segundos por impressão

        return () => clearTimeout(timer);
    }, [imprimindoAtualmente]);

    // Modais e Ações de Mesas
    const [isModalAbrirMesaOpen, setIsModalAbrirMesaOpen] = useState(false);
    const [mesaParaAbrir, setMesaParaAbrir] = useState(null);
    const [isOpeningTable, setIsOpeningTable] = useState(false);

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
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setNomeEstabelecimento(data.nome || userData?.nomeEstabelecimento || "IdeaFood");
                        setTipoNegocio(data.tipoNegocio || "restaurante");
                    }
                } catch (error) { setNomeEstabelecimento(userData?.nomeEstabelecimento || "IdeaFood"); }
            }
        };
        fetchNome();
    }, [estabelecimentoId, userData]);

    // 3. Listener Mesas principal (Firebase)
    useEffect(() => {
        if (!estabelecimentoId) { 
            if (userData) setLoading(false); 
            return; 
        }
        
        setLoading(true);
        const q = query(collection(db, 'estabelecimentos', estabelecimentoId, 'mesas'), orderBy('numero'));
        
        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const mesasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                mesasData.sort((a, b) => {
                    const numA = parseFloat(a.numero);
                    const numB = parseFloat(b.numero);
                    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                    return String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true });
                });
                
                // Checagem de sons apenas em MODIFIED 
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'modified') {
                        const data = change.doc.data();
                        if (data.chamandoGarcom || data.pedindoConta) {
                            let timeDiff = 0;
                            if(data.updatedAt) {
                                const updatedAt = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
                                timeDiff = Math.abs(new Date() - updatedAt) / 1000;
                            }
                            // Toca apenas se foi atualizado há menos de 60 segundos
                            if(timeDiff < 60) {
                                tocarCampainha();
                                if (data.chamandoGarcom) toast.warning(`🛎️ Mesa ${data.numero} está chamando!`);
                                if (data.pedindoConta) toast.success(`💲 Mesa ${data.numero} pediu a conta!`);
                            }
                        }
                    }
                });

                setMesas(mesasData);
                setLoading(false);
            },
            (error) => { console.error("Erro mesas:", error); setLoading(false); }
        );
        return () => unsubscribe();
    }, [estabelecimentoId, userData]);

    // Sub-hooks Injection
    const { socket, isConnected } = useSalaoSync(setMesas);
    const nfceData = useSalaoNfce(estabelecimentoId);

    const limparAlertaMesa = useCallback(async (mesaId) => {
        try {
            const gerenciarMesa = httpsCallable(functions, 'gerenciarMesa');
            await gerenciarMesa({
                estabelecimentoId,
                action: 'LIMPAR_ALERTA',
                mesaId
            });
            toast.info("Alerta da mesa removido.");
        } catch(e) {
            console.error(e);
        }
    }, [estabelecimentoId]);

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
                        
                        // Obtém um identificador único de timestamp para esta solicitação
                        // 🔥 CORREÇÃO: Combina impressaoSolicitadaEm e timestampImpressao para garantir
                        // um ID único em caso de reimpressões/novas conferências sucessivas.
                        let printRequestId = '';
                        const tEm = dadosMesa.impressaoSolicitadaEm;
                        const tEmStr = tEm ? (tEm.toDate ? String(tEm.toDate().getTime()) : (tEm.seconds ? String(tEm.seconds * 1000) : String(tEm))) : '';
                        const tImpStr = dadosMesa.timestampImpressao ? String(dadosMesa.timestampImpressao) : '';
                        if (tEmStr || tImpStr) {
                            printRequestId = `${tEmStr}_${tImpStr}`;
                        } else {
                            printRequestId = String(Date.now());
                        }

                        const idMesaVirtual = `mesa_${docMesa.id}_${printRequestId}`; // Evita conflito com IDs de pedidos e impressões anteriores
                        
                        const processarMesaLocal = async () => {
                            const impressosLocal = JSON.parse(localStorage.getItem('historico_impresso') || '[]');
                            if (!impressosLocal.includes(idMesaVirtual)) {
                                impressosLocal.push(idMesaVirtual);
                                if (impressosLocal.length > 50) impressosLocal.shift();
                                localStorage.setItem('historico_impresso', JSON.stringify(impressosLocal));

                                toast.info(`🖨️ Imprimindo Mesa ${dadosMesa.numero}...`);
                                const urlImpressao = `/impressao-isolada?origem=salao&estabId=${estabelecimentoId}&pedidoId=${docMesa.id}&setor=${setorMesa}&t=${Date.now()}`;
                                setFilaEsperaImpressao(prev => [...prev, urlImpressao]);
                            }
                        };

                        if (window.navigator && window.navigator.locks) {
                            window.navigator.locks.request(`print_auto_${idMesaVirtual}`, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
                                if (lock) await processarMesaLocal();
                            });
                        } else {
                            processarMesaLocal();
                        }
                        
                        try { 
                            const gerenciarMesa = httpsCallable(functions, 'gerenciarMesa');
                            await gerenciarMesa({ estabelecimentoId, action: 'LIMPAR_IMPRESSAO', mesaId: docMesa.id, payload: { isPedido: false } }); 
                        } catch (err) { console.error(err); }
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
                        
                        // Obtém um identificador único de timestamp para esta solicitação
                        // 🔥 CORREÇÃO: Combina impressaoSolicitadaEm e timestampImpressao para garantir
                        // um ID único em caso de novos pedidos ou reimpressões sucessivas.
                        let printRequestId = '';
                        const tEm = dadosPedido.impressaoSolicitadaEm;
                        const tEmStr = tEm ? (tEm.toDate ? String(tEm.toDate().getTime()) : (tEm.seconds ? String(tEm.seconds * 1000) : String(tEm))) : '';
                        const tImpStr = dadosPedido.timestampImpressao ? String(dadosPedido.timestampImpressao) : '';
                        if (tEmStr || tImpStr) {
                            printRequestId = `${tEmStr}_${tImpStr}`;
                        } else {
                            printRequestId = String(Date.now());
                        }

                        const idPedidoVirtual = `${docPedido.id}_${printRequestId}`;

                        const processarPedidoLocal = async () => {
                            const impressosLocal = JSON.parse(localStorage.getItem('historico_impresso') || '[]');
                            if (!impressosLocal.includes(idPedidoVirtual)) {
                                impressosLocal.push(idPedidoVirtual);
                                if (impressosLocal.length > 50) impressosLocal.shift();
                                localStorage.setItem('historico_impresso', JSON.stringify(impressosLocal));

                                toast.info(`🖨️ Imprimindo Pedido...`);
                                const urlImpressao = `/impressao-isolada?origem=salao&estabId=${estabelecimentoId}&pedidoId=${docPedido.id}&setor=${setor}&t=${Date.now()}`;
                                setFilaEsperaImpressao(prev => [...prev, urlImpressao]);
                            }
                        };

                        if (window.navigator && window.navigator.locks) {
                            window.navigator.locks.request(`print_auto_${idPedidoVirtual}`, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
                                if (lock) await processarPedidoLocal();
                            });
                        } else {
                            processarPedidoLocal();
                        }
                        
                        try { 
                            const gerenciarMesa = httpsCallable(functions, 'gerenciarMesa');
                            await gerenciarMesa({ estabelecimentoId, action: 'LIMPAR_IMPRESSAO', mesaId: docPedido.id, payload: { isPedido: true } }); 
                        } catch (err) { console.error(err); }
                    }
                }
            });
        });

        return () => { unsubMesas(); unsubPedidos(); };
    }, [estabelecimentoId]);

    // ===== LÓGICA DE NEGÓCIO =====
    const verificarMesaOciosa = useCallback((mesa) => {
        if (mesa.status !== 'ocupada' || (mesa.itens && mesa.itens.length > 0)) return false;
        if (!mesa.updatedAt) return false;
        const dataAbertura = mesa.updatedAt.toDate ? mesa.updatedAt.toDate() : new Date(mesa.updatedAt);
        return Math.floor((currentTime - dataAbertura) / 60000) >= 10; 
    }, [currentTime]);

    const handleAdicionarMesa = useCallback(async (numeroMesa) => {
        if (!numeroMesa || !estabelecimentoId) return { success: false };
        try {
            const gerenciarMesa = httpsCallable(functions, 'gerenciarMesa');
            await gerenciarMesa({
                estabelecimentoId,
                action: 'ADICIONAR',
                payload: { numeroMesa }
            });
            toast.success("Mesa criada!"); 
            return { success: true };
        } catch (error) { 
            toast.error("Erro ao criar."); 
            return { success: false }; 
        }
    }, [estabelecimentoId]);

    const handleExcluirMesa = useCallback(async (id) => {
        try { 
            const gerenciarMesa = httpsCallable(functions, 'gerenciarMesa');
            await gerenciarMesa({ estabelecimentoId, action: 'EXCLUIR', mesaId: id });
            toast.success("Excluída."); 
        }
        catch (error) { toast.error("Erro."); }
    }, [estabelecimentoId]);

    const handleExcluirMesasLivres = useCallback(async () => {
        const livres = mesas.filter(m => m.status === 'livre');
        if (livres.length === 0) {
            toast.info("Não há mesas livres para excluir.");
            return;
        }
        if (!window.confirm(`Tem certeza que deseja excluir as ${livres.length} mesas livres permanentemente?`)) return;

        try {
            const gerenciarMesa = httpsCallable(functions, 'gerenciarMesa');
            const result = await gerenciarMesa({ estabelecimentoId, action: 'EXCLUIR_LIVRES' });
            toast.success(`${result.data.count || livres.length} mesas livres excluídas com sucesso.`);
        } catch (error) {
            toast.error("Erro ao excluir algumas mesas.");
        }
    }, [mesas, estabelecimentoId]);

    const handleMesaClick = useCallback((mesa) => {
        if (mesa.status !== 'livre') { 
            navigate(`/estabelecimento/${estabelecimentoId}/mesa/${mesa.id}`); 
            return; 
        }
        if (!usuarioLogado || !usuarioLogado.uid) { 
            toast.error("Erro de autenticação. Recarregue a página."); 
            return; 
        }

        setMesaParaAbrir(mesa); 
        setIsModalAbrirMesaOpen(true);
        const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesa.id);

        const gerenciarMesa = httpsCallable(functions, 'gerenciarMesa');
        gerenciarMesa({
            estabelecimentoId,
            action: 'BLOQUEAR_ABERTURA',
            mesaId: mesa.id
        }).catch((error) => {
            const msg = error.message || "Erro: Mesa acessada por outro usuário.";
            toast.warning(msg); setIsModalAbrirMesaOpen(false); setMesaParaAbrir(null);
        });
    }, [estabelecimentoId, navigate, usuarioLogado]);

    const handleCancelarAbertura = useCallback(async () => {
        setIsModalAbrirMesaOpen(false);
        if (mesaParaAbrir) {
            try { 
                const gerenciarMesa = httpsCallable(functions, 'gerenciarMesa');
                await gerenciarMesa({ estabelecimentoId, action: 'CANCELAR_ABERTURA', mesaId: mesaParaAbrir.id });
            } catch (error) { console.error(error); }
            setMesaParaAbrir(null);
        }
    }, [mesaParaAbrir, estabelecimentoId]);

    const handleConfirmarAbertura = useCallback(async (qtd, nomeCliente) => {
        if (!mesaParaAbrir || isOpeningTable) return;
        setIsOpeningTable(true);
        
        const mesaId = mesaParaAbrir.id;
        const mesaNumero = mesaParaAbrir.numero;
        
        // Disparar o Cloud Function em background, sem await
        const gerenciarMesa = httpsCallable(functions, 'gerenciarMesa');
        gerenciarMesa({
            estabelecimentoId,
            action: 'CONFIRMAR_ABERTURA',
            mesaId,
            payload: { qtd, nomeCliente: nomeCliente || '' }
        }).then((res) => {
            // Sucesso silencioso no background
        }).catch((error) => {
            console.error("Erro ao confirmar abertura da mesa no servidor:", error);
            toast.error(`Erro ao abrir Mesa ${mesaNumero}. Retornando...`);
            navigate('/controle-salao');
        });

        // Atira evento na rede local! (se houver sem internet, todos saberão imediatamente)
        if (socket && isConnected) {
            socket.emit('MESA_ABERTA', { id: mesaId, status: 'ocupada', pessoas: qtd, nome: nomeCliente || '' });
        }

        setIsModalAbrirMesaOpen(false);
        setIsOpeningTable(false);
        setMesaParaAbrir(null);
        
        // Navega instantaneamente
        navigate(`/estabelecimento/${estabelecimentoId}/mesa/${mesaId}`);
    }, [mesaParaAbrir, isOpeningTable, estabelecimentoId, socket, isConnected, navigate]);

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

    const handlePagamentoConcluido = useCallback((vendaFinalizada, setMesaParaPagamento, setIsModalPagamentoOpen) => { 
        setIsModalPagamentoOpen(false); 
        setMesaParaPagamento(null); 
        
        if (vendaFinalizada && vendaFinalizada.id) {
            nfceData.selecionarVendaHistorico(vendaFinalizada);
        } else { 
            toast.success("Mesa paga e encerrada com sucesso!"); 
        }
    }, [nfceData]);

    return {
        // Dados e Stats base
        mesas, loading, currentTime, nomeEstabelecimento, estabelecimentoId, tipoNegocio,
        // Listagem
        filtro, setFiltro, buscaMesa, setBuscaMesa, mesasFiltradas, stats, verificarMesaOciosa,
        // Impressão
        imprimindoAtualmente,
        // Ações Mesas
        handleAdicionarMesa, handleExcluirMesa, handleExcluirMesasLivres, handleMesaClick, limparAlertaMesa,
        isModalAbrirMesaOpen, setIsModalAbrirMesaOpen, mesaParaAbrir, isOpeningTable,
        handleCancelarAbertura, handleConfirmarAbertura, handlePagamentoConcluido,
        
        // Fiscais & Histórico (Spreaded do nfceData)
        ...nfceData
    };
}
