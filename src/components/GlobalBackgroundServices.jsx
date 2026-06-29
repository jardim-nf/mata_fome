import React, { useState, useEffect, useRef } from 'react';
import { db, functions } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { getTerminology } from "../utils/terminologyUtils";
import { tocarCampainha, falarNovaComanda } from '../utils/audioUtils';

export default function GlobalBackgroundServices() {
    const { userData, user, estabelecimentoIdPrincipal } = useAuth();
    
    // Obter estabelecimentoId do usuário logado (Master Admin, Admin ou funcionário)
    const estabelecimentoId = estabelecimentoIdPrincipal || userData?.estabelecimentoId || (userData?.role === 'admin' ? user?.uid : null);
    const tipoNegocio = userData?.tipoNegocio || 'restaurante';

    // ==========================================
    // 1. LÓGICA DE FILA DE IMPRESSÃO INVISÍVEL
    // ==========================================
    const [filaEsperaImpressao, setFilaEsperaImpressao] = useState([]);
    const [imprimindoAtualmente, setImprimindoAtualmente] = useState(null);

    useEffect(() => {
        if (imprimindoAtualmente || filaEsperaImpressao.length === 0) return;

        const proximo = filaEsperaImpressao[0];
        setImprimindoAtualmente(proximo);
        setFilaEsperaImpressao(prev => prev.slice(1));
    }, [filaEsperaImpressao, imprimindoAtualmente]);

    useEffect(() => {
        if (!imprimindoAtualmente) return;
        const timer = setTimeout(() => { setImprimindoAtualmente(null); }, 8000);
        return () => clearTimeout(timer);
    }, [imprimindoAtualmente]);

    useEffect(() => {
        if (!estabelecimentoId) return;
        
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        if (isMobileDevice) return; 

        // Mesas
        const qMesas = query(collection(db, "estabelecimentos", estabelecimentoId, "mesas"), where("solicitarImpressaoConferencia", "==", true));
        const unsubMesas = onSnapshot(qMesas, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === "added" || change.type === "modified") {
                    const docMesa = change.doc;
                    const dadosMesa = docMesa.data();
                    
                    if (dadosMesa.solicitarImpressaoConferencia) {
                        const setorMesa = dadosMesa.setorImpressao || ''; 
                        
                        let printRequestId = '';
                        const tEm = dadosMesa.impressaoSolicitadaEm;
                        const tEmStr = tEm ? (tEm.toDate ? String(tEm.toDate().getTime()) : (tEm.seconds ? String(tEm.seconds * 1000) : String(tEm))) : '';
                        const tImpStr = dadosMesa.timestampImpressao ? String(dadosMesa.timestampImpressao) : '';
                        if (tEmStr || tImpStr) { printRequestId = `${tEmStr}_${tImpStr}`; } 
                        else { printRequestId = String(Date.now()); }

                        const idMesaVirtual = `mesa_${docMesa.id}_${printRequestId}`; 
                        
                        const processarMesaLocal = async () => {
                            const impressosLocal = JSON.parse(localStorage.getItem('historico_impresso') || '[]');
                            if (!impressosLocal.includes(idMesaVirtual)) {
                                impressosLocal.push(idMesaVirtual);
                                if (impressosLocal.length > 50) impressosLocal.shift();
                                localStorage.setItem('historico_impresso', JSON.stringify(impressosLocal));

                                const nomeMesa = getTerminology ? getTerminology('mesa', tipoNegocio) : 'Mesa';
                                toast.info(`🖨️ Imprimindo ${nomeMesa} ${dadosMesa.numero}...`);
                                
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

        // Pedidos
        const qPedidos = query(collection(db, "estabelecimentos", estabelecimentoId, "pedidos"), where("solicitarImpressao", "==", true));
        const unsubPedidos = onSnapshot(qPedidos, (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === "added" || change.type === "modified") {
                    const docPedido = change.doc;
                    const dadosPedido = docPedido.data();
                    
                    if (dadosPedido.solicitarImpressao) {
                        const setor = dadosPedido.setorImpressao || '';
                        
                        let printRequestId = '';
                        const tEm = dadosPedido.impressaoSolicitadaEm;
                        const tEmStr = tEm ? (tEm.toDate ? String(tEm.toDate().getTime()) : (tEm.seconds ? String(tEm.seconds * 1000) : String(tEm))) : '';
                        const tImpStr = dadosPedido.timestampImpressao ? String(dadosPedido.timestampImpressao) : '';
                        if (tEmStr || tImpStr) { printRequestId = `${tEmStr}_${tImpStr}`; } 
                        else { printRequestId = String(Date.now()); }

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

        const handleCustomPrintEvent = (event) => {
            const url = event.detail?.url;
            if (url) {
                setFilaEsperaImpressao(prev => [...prev, url]);
            }
        };
        window.addEventListener('trigger-global-print', handleCustomPrintEvent);

        return () => { 
            unsubMesas(); 
            unsubPedidos(); 
            window.removeEventListener('trigger-global-print', handleCustomPrintEvent);
        };
    }, [estabelecimentoId, tipoNegocio]);


    // ==========================================
    // 2. LÓGICA GLOBAL DE NOTIFICAÇÃO (CAMPAINHA)
    // ==========================================
    const [userInteracted, setUserInteracted] = useState(false);
    const notifiedOrders = useRef(new Set());
    const isFirstLoad = useRef(true);

    // Monitora a primeira interação do usuário para permitir áudio (política do navegador)
    useEffect(() => {
        const handleInteraction = () => setUserInteracted(true);
        window.addEventListener('click', handleInteraction, { once: true });
        window.addEventListener('keydown', handleInteraction, { once: true });
        
        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };
    }, []);

    useEffect(() => {
        if (!estabelecimentoId) return;

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const qNovosPedidos = query(
            collection(db, "estabelecimentos", estabelecimentoId, "pedidos"),
            where("status", "==", "recebido"),
            where("dataPedido", ">=", startOfDay)
        );

        const unsubPedidosNotificacao = onSnapshot(qNovosPedidos, (snapshot) => {
            // Ignora o primeiro load para não apitar todos os pedidos 'recebido' que já estavam no banco
            if (isFirstLoad.current) {
                snapshot.docs.forEach(doc => notifiedOrders.current.add(doc.id));
                isFirstLoad.current = false;
                return;
            }

            const pedidosNovos = [];
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    if (!notifiedOrders.current.has(change.doc.id)) {
                        pedidosNovos.push({ id: change.doc.id, ...change.doc.data() });
                        notifiedOrders.current.add(change.doc.id);
                    }
                }
            });

            if (pedidosNovos.length > 0 && userInteracted) {
                let mensagemParaFalar = '';
                const deveTocar = pedidosNovos.some(p => {
                    const isMesa = p.source === 'salao' || p.tipo === 'mesa';
                    if (isMesa) {
                        mensagemParaFalar = `Novo Pedido. Mesa ${p.mesaNumero || 'Indefinida'}.`;
                        // Se for pedido do Salão (Mesa) e só tem bebidas, na regra atual ignora voz se a tela ativa for cozinha
                        // Como estamos num listener global, avisamos se houver qualquer item
                        if (!p.itensCozinha || p.itensCozinha.length === 0) return false;
                    } else {
                        const nome = p.cliente?.nome?.split(' ')[0] || 'Desconhecido';
                        mensagemParaFalar = `Novo Delivery de ${nome}.`;
                    }
                    return true;
                });

                if (deveTocar) {
                    tocarCampainha();
                    if (mensagemParaFalar) {
                        falarNovaComanda(mensagemParaFalar);
                    }
                }
            }
        });

        return () => {
            unsubPedidosNotificacao();
        };
    }, [estabelecimentoId, userInteracted]);

    return (
        <div className="hidden">
            {imprimindoAtualmente && (
                <iframe 
                    key={imprimindoAtualmente} 
                    src={imprimindoAtualmente} 
                    title="print-ativo-global" 
                />
            )}
        </div>
    );
}
