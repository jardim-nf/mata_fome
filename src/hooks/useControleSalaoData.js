import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy, where, doc, getDoc, serverTimestamp, updateDoc, addDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { tocarCampainha } from '../utils/audioUtils';
import { toast as rtToast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { getTerminology } from '../utils/terminologyUtils';

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
        className: `mf-toast mf-toast-${type} ${opts?.className || ''}`,
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
            whiteSpace: 'nowrap',
            wordBreak: 'keep-all',
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
    // Fila de impressão agora é gerenciada pelo GlobalPrintListener
    const imprimindoAtualmente = null; // Mantido nulo para compatibilidade


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
                                if (data.chamandoGarcom) toast.warning(`🛎️ ${getTerminology('mesa', tipoNegocio)} ${data.numero} está chamando!`);
                                if (data.pedindoConta) toast.success(`💲 ${getTerminology('mesa', tipoNegocio)} ${data.numero} pediu a conta!`);
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
            const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesaId);
            await updateDoc(mesaRef, {
                chamandoGarcom: false,
                pedindoConta: false,
                updatedAt: serverTimestamp()
            });
            toast.info(`Alerta da ${getTerminology('mesa', tipoNegocio).toLowerCase()} removido.`);
        } catch(e) {
            console.error(e);
        }
    }, [estabelecimentoId, tipoNegocio]);

    // Listener de Impressão Invisível (Fila) removido e movido para GlobalPrintListener


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
            const num = !isNaN(numeroMesa) ? Number(numeroMesa) : numeroMesa;
            const newMesa = {
                numero: num,
                status: "livre",
                total: 0,
                pessoas: 0,
                itens: [],
                tipo: "mesa",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };
            const mesasRef = collection(db, 'estabelecimentos', estabelecimentoId, 'mesas');
            await addDoc(mesasRef, newMesa);
            toast.success(`${getTerminology('mesa', tipoNegocio)} criada!`); 
            return { success: true };
        } catch (error) { 
            console.error("Erro ao criar mesa:", error);
            toast.error("Erro ao criar."); 
            return { success: false }; 
        }
    }, [estabelecimentoId, tipoNegocio]);

    const handleExcluirMesa = useCallback(async (id) => {
        try { 
            const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', id);
            await deleteDoc(mesaRef);
            toast.success(`${getTerminology('mesa', tipoNegocio)} excluída com sucesso!`); 
        }
        catch (error) { 
            console.error("Erro ao excluir mesa:", error);
            toast.error("Erro."); 
        }
    }, [estabelecimentoId, tipoNegocio]);

    const handleExcluirMesasLivres = useCallback(async () => {
        const livres = mesas.filter(m => m.status === 'livre');
        if (livres.length === 0) {
            toast.info(`Não há ${getTerminology('mesas', tipoNegocio).toLowerCase()} livres para excluir.`);
            return;
        }
        if (!window.confirm(`Tem certeza que deseja excluir as ${livres.length} ${getTerminology('mesas', tipoNegocio).toLowerCase()} livres permanentemente?`)) return;

        try {
            const batch = writeBatch(db);
            livres.forEach(mesa => {
                const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesa.id);
                batch.delete(mesaRef);
            });
            await batch.commit();
            toast.success(`${livres.length} ${getTerminology('mesas', tipoNegocio).toLowerCase()} livres excluídas com sucesso.`);
        } catch (error) {
            console.error("Erro ao excluir mesas livres:", error);
            toast.error(`Erro ao excluir algumas ${getTerminology('mesas', tipoNegocio).toLowerCase()}.`);
        }
    }, [mesas, estabelecimentoId, tipoNegocio]);

    const handleMesaClick = useCallback((mesa) => {
        if (mesa.status !== 'livre') { 
            navigate(`/estabelecimento/${estabelecimentoId}/mesa/${mesa.id}`); 
            return; 
        }
        if (!usuarioLogado || !usuarioLogado.uid) { 
            toast.error("Erro de autenticação. Recarregue a página."); 
            return; 
        }

        // 1. Atualização Otimista no Firestore (Instantânea!)
        const mesaRef = doc(db, 'estabelecimentos', estabelecimentoId, 'mesas', mesa.id);
        updateDoc(mesaRef, {
            status: "ocupada",
            pessoas: 1,
            nome: "",
            tipo: "mesa",
            updatedAt: serverTimestamp(),
            bloqueadoPor: null,
            bloqueadoPorNome: null,
            bloqueadoEm: null
        }).catch((error) => {
            console.error("Erro ao atualizar mesa localmente:", error);
        });

        // 2. Chamar a Cloud Function no background como garantia de consistência
        const gerenciarMesa = httpsCallable(functions, 'gerenciarMesa');
        gerenciarMesa({
            estabelecimentoId,
            action: 'CONFIRMAR_ABERTURA',
            mesaId: mesa.id,
            payload: { qtd: 1, nomeCliente: '' }
        }).catch((error) => {
            console.error("Erro ao confirmar abertura da mesa no servidor:", error);
        });

        // 3. Emitir evento socket de abertura
        if (socket && isConnected) {
            socket.emit('MESA_ABERTA', { id: mesa.id, status: 'ocupada', pessoas: 1, nome: '' });
        }

        // 4. Navega instantaneamente
        navigate(`/estabelecimento/${estabelecimentoId}/mesa/${mesa.id}`);
    }, [estabelecimentoId, navigate, usuarioLogado, socket, isConnected, tipoNegocio]);

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
            toast.error(`Erro ao abrir ${getTerminology('mesa', tipoNegocio)} ${mesaNumero}. Retornando...`);
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

    const adicionarFilaImpressao = useCallback((url) => {
        window.dispatchEvent(new CustomEvent('trigger-global-print', { detail: { url } }));
    }, []);

    const handlePagamentoConcluido = useCallback((vendaFinalizada, setMesaParaPagamento, setIsModalPagamentoOpen) => { 
        setIsModalPagamentoOpen(false); 
        setMesaParaPagamento(null); 
        
        if (vendaFinalizada && vendaFinalizada.id) {
            nfceData.selecionarVendaHistorico(vendaFinalizada);
            
            // Auto-print receipt on mobile/PWA
            const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            if (isMobileDevice) {
                const url = `/impressao-isolada?pedidoId=${vendaFinalizada.id}&estabId=${estabelecimentoId}&origem=pdv&setor=tudo&t=${Date.now()}`;
                adicionarFilaImpressao(url);
            }
        } else { 
            toast.success("Mesa paga e encerrada com sucesso!"); 
        }
    }, [nfceData, estabelecimentoId]);

    return {
        // Dados e Stats base
        mesas, loading, currentTime, nomeEstabelecimento, estabelecimentoId, tipoNegocio,
        // Listagem
        filtro, setFiltro, buscaMesa, setBuscaMesa, mesasFiltradas, stats, verificarMesaOciosa,
        // Impressão
        imprimindoAtualmente, adicionarFilaImpressao,
        // Ações Mesas
        handleAdicionarMesa, handleExcluirMesa, handleExcluirMesasLivres, handleMesaClick, limparAlertaMesa,
        isModalAbrirMesaOpen, setIsModalAbrirMesaOpen, mesaParaAbrir, isOpeningTable,
        handleCancelarAbertura, handleConfirmarAbertura, handlePagamentoConcluido,
        
        // Fiscais & Histórico (Spreaded do nfceData)
        ...nfceData
    };
}
