// src/pages/Painel.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { format, formatDistanceToNow, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';
import PedidoCard from '../components/PedidoCard'; // <--- ADICIONADO: Importe o PedidoCard aqui!

// Função auxiliar para formatar a data de hoje no formato 'YYYY-MM-DD'
const getTodayFormattedDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

function Painel() {
    const navigate = useNavigate();
    const { currentUser, isAdmin, loading: authLoading } = useAuth();

    const [pedidosRecebidos, setPedidosRecebidos] = useState([]);
    const [pedidosEmPreparo, setPedidosEmPreparo] = useState(new Map());
    const [pedidosEmEntrega, setPedidosEmEntrega] = useState(new Map());
    const [pedidosFinalizados, setPedidosFinalizados] = useState(new Map());

    const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
    const [loadingPainel, setLoadingPainel] = useState(true);
    const [painelError, setPainelError] = useState('');

    // Inicializa notificationsEnabled a partir do localStorage
    const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
        const stored = localStorage.getItem('notificationsEnabled');
        return stored === 'true' ? true : false;
    });

    // NOVO ESTADO: Inicializa autoPrintEnabled a partir do localStorage
    const [autoPrintEnabled, setAutoPrintEnabled] = useState(() => {
        const stored = localStorage.getItem('autoPrintEnabled');
        return stored === 'true' ? true : false;
    });


    const prevPedidosRecebidosRef = useRef([]);
    const audioRef = useRef(null);
    const [audioBlockedMessage, setAudioBlockedMessage] = useState('');

    // Inicializa o objeto Audio UMA VEZ quando o componente monta
    useEffect(() => {
        audioRef.current = new Audio('/campainha.mp3');
        audioRef.current.load();

        const handleCanPlay = () => {
            console.log("Painel Audio Debug: Evento 'canplaythrough' disparado. Áudio está pronto.");
        };
        if (audioRef.current) {
            audioRef.current.addEventListener('canplaythrough', handleCanPlay);
        }

        return () => {
            if (audioRef.current) {
                audioRef.current.removeEventListener('canplaythrough', handleCanPlay);
                audioRef.current.pause();
                audioRef.current.src = '';
                audioRef.current = null;
            }
        };
    }, []);

    // Efeito para redirecionar se não for admin
    useEffect(() => {
        if (!authLoading) {
            if (!currentUser || !isAdmin) {
                toast.error('Acesso negado. Você precisa ser um administrador para acessar esta página.');
                navigate('/');
            }
        }
    }, [currentUser, isAdmin, authLoading, navigate]);

    // Efeito para carregar informações do estabelecimento e pedidos
    useEffect(() => {
        if (authLoading === false && currentUser && isAdmin) {
            setLoadingPainel(true);
            setPainelError('');

            let unsubscribeRecebidos = () => {};
            let unsubscribeEmPreparo = () => {};
            let unsubscribeEmEntrega = () => {};
            let unsubscribeFinalizados = () => {};

            const fetchEstabelecimentoAndPedidos = async () => {
                try {
                    const estabelecimentosRef = collection(db, 'estabelecimentos');
                    const qEstabelecimento = query(estabelecimentosRef, where('adminUID', '==', currentUser.uid));
                    const querySnapshotEstabelecimento = await getDocs(qEstabelecimento);

                    if (!querySnapshotEstabelecimento.empty) {
                        const estDoc = querySnapshotEstabelecimento.docs[0];
                        setEstabelecimentoInfo({ id: estDoc.id, ...estDoc.data() });
                        const realEstabelecimentoId = estDoc.id;

                        const pedidosCollectionRef = collection(db, 'pedidos');

                        const createPedidoQuery = (status) => query(
                            pedidosCollectionRef,
                            where('status', '==', status),
                            where('estabelecimentoId', '==', realEstabelecimentoId),
                            orderBy('criadoEm', 'desc')
                        );

                        // Listener para Pedidos Recebidos (com lógica de notificação)
                        unsubscribeRecebidos = onSnapshot(createPedidoQuery('recebido'), (snapshot) => {
                            const newPedidos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                            const oldPedidosIds = new Set(prevPedidosRecebidosRef.current.map(p => p.id));
                            const newlyReceivedOrders = newPedidos.filter(p => !oldPedidosIds.has(p.id));

                            if (newlyReceivedOrders.length > 0) {
                                if (notificationsEnabled && Notification.permission === 'granted') {
                                    newlyReceivedOrders.forEach(pedido => {
                                        new Notification(`Novo Pedido - ${pedido.cliente.nome}`, {
                                            body: `Total: R$ ${pedido.totalFinal.toFixed(2).replace('.', ',')}\nItens: ${pedido.itens.map(i => i.nome).join(', ')}`,
                                            icon: '/logo-deufome.png' // <--- Caminho corrigido, assumindo que está na pasta public
                                        });
                                    });

                                    if (audioRef.current) {
                                        audioRef.current.currentTime = 0;
                                        audioRef.current.play().catch(e => {
                                            console.error("Erro ao tocar áudio (autoplay pode estar bloqueado):", e);
                                            if (e.name === "NotAllowedError" || e.name === "AbortError") {
                                                setAudioBlockedMessage("Som de notificação bloqueado. Clique no banner acima para ativá-lo!");
                                            }
                                        });
                                    } else {
                                        console.warn("audioRef.current é null ao tentar tocar para novo pedido.");
                                    }
                                } else {
                                    console.log("Notificações não disparadas. Condições (notificationsEnabled, permissão) não atendidas.");
                                }
                                toast.info(`🔔 Novo pedido recebido de ${newlyReceivedOrders[0].cliente.nome}! Total: R$ ${newlyReceivedOrders[0].totalFinal.toFixed(2).replace('.', ',')}`);
                            } else {
                                console.log("Nenhum pedido VERDADEIRAMENTE novo detectado para notificação.");
                            }
                            setPedidosRecebidos(newPedidos);
                            prevPedidosRecebidosRef.current = newPedidos;

                        }, (error) => console.error("Erro no listener de Recebidos:", error));

                        unsubscribeEmPreparo = onSnapshot(createPedidoQuery('em_preparo'), (snapshot) => {
                            setPedidosEmPreparo(new Map(snapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }])));
                        }, (error) => console.error("Erro no listener de Em Preparo:", error));

                        unsubscribeEmEntrega = onSnapshot(createPedidoQuery('em_entrega'), (snapshot) => {
                            setPedidosEmEntrega(new Map(snapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }])));
                        }, (error) => console.error("Erro no listener de Em Entrega:", error));

                        unsubscribeFinalizados = onSnapshot(createPedidoQuery('finalizado'), (snapshot) => {
                            setPedidosFinalizados(new Map(snapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }])));
                        }, (error) => console.error("Erro no listener de Finalizados:", error));

                    } else {
                        setPainelError("Nenhum estabelecimento vinculado a este administrador.");
                        toast.error("Nenhum estabelecimento encontrado para este administrador.");
                        setEstabelecimentoInfo(null);
                        setPedidosRecebidos([]);
                        setPedidosEmPreparo(new Map());
                        setPedidosEmEntrega(new Map());
                        setPedidosFinalizados(new Map());
                    }
                } catch (error) {
                    console.error("Erro ao carregar painel de pedidos:", error);
                    setPainelError("Erro ao carregar o painel. Verifique os índices do Firestore e a conexão.");
                    toast.error("Erro ao carregar o painel. Verifique os índices do Firestore e a conexão.");
                } finally {
                    setLoadingPainel(false);
                }
            };

            fetchEstabelecimentoAndPedidos();

            return () => {
                unsubscribeRecebidos();
                unsubscribeEmPreparo();
                unsubscribeEmEntrega();
                unsubscribeFinalizados();
            };
        } else if (authLoading === false && (!currentUser || !isAdmin)) {
            setLoadingPainel(false);
        }
    }, [currentUser, isAdmin, authLoading, notificationsEnabled]);

    const toggleNotifications = async () => {
        if (notificationsEnabled) {
            setNotificationsEnabled(false);
            localStorage.setItem('notificationsEnabled', 'false');
            toast.info('Notificações desativadas.');
            if (audioRef.current && !audioRef.current.paused) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            setAudioBlockedMessage('');
            return;
        }

        let permissionRequested = false;
        let permissionGranted = false;

        if ('Notification' in window) {
            permissionRequested = true;
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                permissionGranted = true;
            }
        } else {
            console.warn('API de Notificação de Desktop não suportada neste navegador.');
            toast.warn('Seu navegador não suporta notificações pop-up nativas.');
        }

        setNotificationsEnabled(true);
        localStorage.setItem('notificationsEnabled', 'true');

        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().then(() => {
                console.log("Áudio tocado com SUCESSO no toggle (interação do usuário).");
                // setAutoPrintBlockedMessage(''); // This was a typo, should be setAudioBlockedMessage
            }).catch(e => {
                console.warn("Áudio pode ter sido bloqueado na primeira reprodução após permissão:", e);
                if (e.name === "NotAllowedError" || e.name === "AbortError") {
                    setAudioBlockedMessage("Som de notificação bloqueado. Clique no banner acima para ativá-lo!");
                }
            });
        } else {
            console.warn("audioRef.current é null quando tentou tocar no toggle.");
        }

        if (permissionRequested) {
            if (permissionGranted) {
                toast.success('Notificações ativadas (incluindo pop-ups)!');
            } else {
                toast.warn('Notificações ativadas (apenas som e alertas internos, pop-ups bloqueados)!');
            }
        } else {
            toast.info('Notificações ativadas (apenas som e alertas internos, pop-ups não suportados)!');
        }
    };

    // NOVO: Função para alternar a preferência de impressão automática
    const toggleAutoPrint = () => {
        setAutoPrintEnabled(prev => {
            const newStatus = !prev;
            localStorage.setItem('autoPrintEnabled', newStatus.toString());
            toast.info(`Impressão automática: ${newStatus ? 'Ativada' : 'Desativada'}.`);
            return newStatus;
        });
    };


    const getPedidoById = (id) => {
        let pedido = pedidosRecebidos.find(p => p.id === id);
        if (!pedido) pedido = pedidosEmPreparo.get(id);
        if (!pedido) pedido = pedidosEmEntrega.get(id);
        if (!pedido) pedido = pedidosFinalizados.get(id);
        return pedido;
    };


    const generateComandaHTML = (pedido, estabelecimento) => {
        if (!pedido) return '<h1>Erro: Pedido não encontrado</h1>';

        const totalPedido = pedido.itens ? pedido.itens.reduce((acc, item) => acc + (item.preco * item.quantidade), 0) : 0;
        const taxaEntregaExibida = pedido.taxaEntrega || 0;
        const descontoCupomExibido = pedido.cupomAplicado?.descontoCalculado || 0;
        const totalFinalComDesconto = totalPedido + taxaEntregaExibida - descontoCupomExibido;

        const dataPedido = pedido.criadoEm && typeof pedido.criadoEm.toDate === 'function'
                               ? pedido.criadoEm.toDate().toLocaleString('pt-BR')
                               : 'Data não disponível';

        const enderecoCliente = pedido.cliente?.endereco;
        const enderecoFormatado = enderecoCliente
            ? `${enderecoCliente.rua || ''}, ${enderecoCliente.numero || ''}` +
              (enderecoCliente.complemento ? `, ${enderecoCliente.complemento}` : '') +
              (enderecoCliente.bairro ? `\n${enderecoCliente.bairro}` : '') +
              (enderecoCliente.cidade && enderecoCliente.estado ? `\n${enderecoCliente.cidade}, ${enderecoCliente.estado}` : '') +
              (enderecoCliente.cep ? ` - CEP: ${enderecoCliente.cep}` : '')
            : 'Endereço não disponível';

        const numeroPedidoFormatado = pedido.numeroSequencial ? String(pedido.numeroSequencial).padStart(3, '0') : (pedido?.id ? pedido.id.substring(0, 7).toUpperCase() : 'N/A');

        const enderecoEstabelecimento = estabelecimento?.endereco;
        const enderecoEstabelecimentoFormatado = enderecoEstabelecimento
            ? `${enderecoEstabelecimento.rua || '', 2}.replace(/(\d{5})(\d{3})/, '$1-$2')} ${enderecoEstabelecimento.numero || ''}` +
              (enderecoEstabelecimento.bairro ? `, ${enderecoEstabelecimento.bairro}` : '') +
              (enderecoEstabelecimento.cidade && enderecoEstabelecimento.estado ? ` - ${enderecoEstabelecimento.cidade}/${enderecoEstabelecimento.estado}` : '') +
              (enderecoEstabelecimento.cep ? ` - CEP: ${enderecoEstabelecimento.cep}` : '')
            : 'Endereço não disponível';

        let itensHTML = '';
        pedido.itens?.forEach((item, index) => {
            itensHTML += `
                <tr style="font-size: 14px;">
                    <td style="padding-top: 4px; padding-bottom: 4px;">${item.quantidade}x</td>
                    <td style="padding-top: 4px; padding-bottom: 4px;">
                        ${item.nome}
                        ${item.observacao ? `<span style="display: block; font-size: 11px; color: #555;">- Obs: ${item.observacao}</span>` : ''}
                    </td>
                    <td style="padding-top: 4px; padding-bottom: 4px; text-align: right;">R$ ${item.preco.toFixed(2).replace('.', ',')}</td>
                    <td style="padding-top: 4px; padding-bottom: 4px; text-align: right;">R$ ${(item.preco * item.quantidade).toFixed(2).replace('.', ',')}</td>
                </tr>
            `;
        });

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Comanda do Pedido #${numeroPedidoFormatado}</title>
                <style>
                    body {
                        font-family: 'Roboto Mono', 'Courier New', monospace;
                        margin: 0;
                        padding: 10px;
                        background-color: #f7f7f7;
                        color: #333;
                    }
                    .comanda-print-area {
                        max-width: 300px;
                        margin: 0 auto;
                        background: #fff;
                        padding: 15px;
                        border: 1px solid #ddd;
                        box-shadow: 0 0 5px rgba(0,0,0,0.1);
                    }
                    .text-center { text-align: center; }
                    .mb-4 { margin-bottom: 1rem; }
                    .mb-2 { margin-bottom: 0.5rem; }
                    .mt-2 { margin-top: 0.5rem; }
                    .font-bold { font-weight: bold; }
                    .text-sm { font-size: 0.875rem; }
                    .text-lg { font-size: 1.125rem; }
                    .text-xl { font-size: 1.25rem; }
                    .text-2xl { font-size: 1.5rem; }
                    hr { border: none; border-top: 1px dashed #999; margin: 15px 0; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 4px 0; }
                    .text-right { text-align: right; }
                    .whitespace-pre-line { white-space: pre-line; }

                    @media print {
                        .no-print {
                            display: none !important;
                        }
                        body {
                            background-color: #fff;
                            margin: 0;
                            padding: 0;
                        }
                        .comanda-print-area {
                            box-shadow: none;
                            border: none;
                            padding: 0;
                            max-width: 100%;
                        }
                        @page {
                            size: 60mm auto;
                            margin: 0;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="comanda-print-area">
                    <div class="text-center mb-4">
                        <h1 class="text-xl font-bold" style="margin-bottom: 5px;">${estabelecimento?.nome || 'SEU ESTABELECIMENTO'}</h1>
                        <p class="text-sm">${enderecoEstabelecimentoFormatado}</p>
                        <p class="text-sm">Telefone: ${estabelecimento?.whatsapp || 'N/A'}</p>
                    </div>
                    <hr />

                    <h2 class="text-lg font-bold text-center mb-4">COMANDA DE PEDIDO</h2>

                    <hr />
                    <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px;">
                        <p><strong>No. Pedido:</strong> ${numeroPedidoFormatado}</p>
                        <p><strong>Data:</strong> ${dataPedido}</p>
                    </div>
                    <hr />

                    <div class="mb-4">
                        <h3 class="text-lg font-bold mb-2">DADOS DO CLIENTE</h3>
                        <p style="font-size: 14px;"><strong>Cliente:</strong> ${pedido.cliente?.nome || 'N/A'}</p>
                        <p style="font-size: 14px;"><strong>Telefone:</strong> ${pedido.cliente?.telefone ? `(${pedido.cliente.telefone.substring(0, 2)}) ${pedido.cliente.telefone.substring(2, 7)}-${pedido.cliente.telefone.substring(7)}` : 'N/A'}</p>
                        <p style="font-size: 14px;"><strong>Tipo de Entrega:</strong> ${pedido.tipoEntrega === 'retirada' ? 'Retirada no Local' : 'Delivery'}</p>
                        ${pedido.tipoEntrega !== 'retirada' ? `<p class="whitespace-pre-line" style="font-size: 14px;"><strong>Endereço:</strong> ${enderecoFormatado}</p>` : ''}
                    </div>

                    <hr />

                    <div class="mb-4">
                        <h3 class="text-lg font-bold mb-2">ITENS DO PEDIDO</h3>
                        <table style="width: 100%; text-align: left; table-layout: fixed;">
                            <thead>
                                <tr style="border-bottom: 1px solid #ddd; font-size: 13px;">
                                    <th style="width: 15%; padding-bottom: 4px;">Qtd.</th>
                                    <th style="width: 50%; padding-bottom: 4px;">Descrição</th>
                                    <th style="width: 15%; padding-bottom: 4px; text-align: right;">Preço Un.</th>
                                    <th style="width: 20%; padding-bottom: 4px; text-align: right;">Total Item</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itensHTML}
                            </tbody>
                        </table>
                    </div>

                    <hr />

                    <div class="text-right text-lg font-bold mb-2">
                        <p style="font-size: 16px;">Subtotal: R$ ${totalPedido.toFixed(2).replace('.', ',')}</p>
                        ${taxaEntregaExibida > 0 ? `<p style="font-size: 16px;">Taxa de Entrega: R$ ${taxaEntregaExibida.toFixed(2).replace('.', ',')}</p>` : ''}
                        ${descontoCupomExibido > 0 ? `<p style="color: green; font-size: 16px;">Desconto (${pedido.cupomAplicado.codigo}): - R$ ${descontoCupomExibido.toFixed(2).replace('.', ',')}</p>` : ''}
                        <p class="mt-2 text-2xl">TOTAL A PAGAR: R$ ${totalFinalComDesconto.toFixed(2).replace('.', ',')}</p>
                    </div>

                    <hr />

                    <div class="text-center text-lg mb-4">
                        <p><strong>FORMA DE PAGAMENTO:</strong> ${pedido.formaPagamento || 'N/A'}</p>
                        ${pedido.formaPagamento === 'dinheiro' && pedido.trocoPara ? `<p style="font-size: 16px;"><strong>TROCO PARA:</strong> R$ ${pedido.trocoPara.toFixed(2).replace('.', ',')}</p>` : ''}
                    </div>

                    <p class="text-center text-sm mt-6" style="color: #666;">
                        Agradecemos a sua preferência!
                    </p>
                </div>
            </body>
            </html>
        `;
    };

    const updateOrderStatus = async (pedidoId, newStatus) => {
        const pedidoToUpdate = getPedidoById(pedidoId);
        if (!pedidoToUpdate) {
            toast.error("Erro: Pedido não encontrado para atualização de status.");
            return;
        }

        const telefoneCliente = pedidoToUpdate.cliente?.telefone || '';
        const nomeCliente = pedidoToUpdate.cliente?.nome || '';
        const estabelecimentoNome = estabelecimentoInfo?.nome || 'nosso estabelecimento';
        const totalPedido = pedidoToUpdate.totalFinal ? pedidoToUpdate.totalFinal.toFixed(2).replace('.', ',') : (pedidoToUpdate.itens ? pedidoToUpdate.itens.reduce((acc, item) => acc + (item.preco * item.quantidade), 0).toFixed(2).replace('.', ',') : 'N/A');
        const itensPedido = pedidoToUpdate.itens?.map(item => item.nome).join(', ') || '';

        let mensagemWhatsApp = '';

        const telefoneLimpo = telefoneCliente.replace(/\D/g, '');
        const telefoneWhatsApp = telefoneLimpo.startsWith('55') ? telefoneLimpo : `55${telefoneLimpo}`;
        const whatsappUrl = `https://wa.me/${telefoneWhatsApp}?text=${encodeURIComponent(mensagemWhatsApp)}`;


        try {
            const pedidoRef = doc(db, 'pedidos', pedidoId);
            await updateDoc(pedidoRef, { status: newStatus });

            switch (newStatus) {
                case 'em_preparo':
                    mensagemWhatsApp = `Olá ${nomeCliente}, seu pedido #${pedidoId.substring(0, 5)} do ${estabelecimentoNome} está AGORA EM PREPARO! 🧑‍🍳

Itens: ${itensPedido}

Total: R$ ${totalPedido}
Pagamento: ${pedidoToUpdate.formaPagamento || 'N/A'}

Fique atento às próximas atualizações. Agradecemos a preferência!`;

                    window.open(`https://wa.me/${telefoneWhatsApp}?text=${encodeURIComponent(mensagemWhatsApp)}`, '_blank');
                    toast.info(`Status do pedido ${pedidoId.substring(0, 5)} atualizado para EM PREPARO. Mensagem WhatsApp enviada.`);

                    // A chamada da comanda e impressão está sendo orquestrada pelo PedidoCard.jsx
                    break;

                case 'em_entrega':
                    mensagemWhatsApp = `Que beleza, ${nomeCliente}! Seu pedido do ${estabelecimentoNome} saiu para entrega! 🛵💨 Jájá chega aí! Bom apetite!`;
                    window.open(`https://wa.me/${telefoneWhatsApp}?text=${encodeURIComponent(mensagemWhatsApp)}`, '_blank');
                    toast.info(`Status do pedido ${pedidoId.substring(0, 5)} atualizado para EM ENTREGA. Mensagem WhatsApp enviada.`);
                    break;

                case 'finalizado':
                    mensagemWhatsApp = `Muito obrigado, ${nomeCliente}! Seu pedido do ${estabelecimentoNome} foi finalizado com sucesso! ✅ Esperamos você em uma próxima!`;
                    window.open(`https://wa.me/${telefoneWhatsApp}?text=${encodeURIComponent(mensagemWhatsApp)}`, '_blank');
                    toast.success(`Status do pedido ${pedidoId.substring(0, 5)} atualizado para FINALIZADO. Mensagem WhatsApp enviada.`);
                    break;

                default:
                    toast.warn(`Status desconhecido para atualização do pedido ${pedidoId.substring(0, 5)}.`);
                    return;
            }

        } catch (error) {
            console.error("Erro ao atualizar status ou enviar WhatsApp:", error);
            toast.error('Erro ao atualizar status do pedido ou enviar mensagem. Por favor, tente novamente.');
        }
    };

    const deletePedido = async (pedidoId) => {
        if (window.confirm('Tem certeza que deseja excluir este pedido? Esta ação é irreversível.')) {
            try {
                const pedidoRef = doc(db, 'pedidos', pedidoId);
                await deleteDoc(pedidoRef);
                toast.success('Pedido excluído com sucesso!');
            } catch (error) {
                console.error("Erro ao excluir pedido:", error);
                toast.error('Erro ao excluir pedido.');
            }
        }
    };

    if (authLoading || loadingPainel) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
                <p className="text-xl text-gray-700">Carregando painel de administração...</p>
            </div>
        );
    }

    if (painelError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-red-100 text-red-700 p-4 text-center">
                <p className="text-xl font-semibold">Erro no Painel:</p>
                <p className="mt-2">{painelError}</p>
                <p className="mt-4 text-sm text-gray-600">
                    Por favor, certifique-se de que seu usuário administrador está vinculado a um estabelecimento no Firestore
                    (campo 'adminUID' no documento do estabelecimento com o UID do seu admin).
                    E verifique o console do navegador para links de criação de índices.
                </p>
                <button onClick={() => navigate('/')} className="mt-6 bg-red-500 text-white px-4 py-2 rounded">
                    Voltar para Home
                </button>
            </div>
        );
    }

    if (!currentUser || !isAdmin) {
        return null;
    }

    const PedidoCardComponent = ({ pedido }) => {
        // Adaptação: Passar autoPrintEnabled para PedidoCard
        return (
            <PedidoCard
                pedido={pedido}
                mudarStatus={updateOrderStatus}
                excluirPedido={deletePedido}
                estabelecimento={estabelecimentoInfo}
                autoPrintEnabled={autoPrintEnabled} // <--- Passando a preferência
            />
        );
    };


    return (
        <div className="p-4 bg-gray-100 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <Link to="/dashboard" className="flex items-center text-gray-600 hover:text-gray-900">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                        Voltar para o Dashboard
                    </Link>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 text-center flex-grow">Painel de Pedidos {estabelecimentoInfo ? `(${estabelecimentoInfo.nome})` : ''}</h1>
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-end mt-4 sm:mt-0 w-full sm:w-auto">
                        <button
                                onClick={toggleNotifications}
                                className={`${notificationsEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-300 text-gray-800 hover:bg-gray-400'} text-white px-4 py-2 rounded-lg`}>
                                {notificationsEnabled ? '🔔 Notificações Ativadas' :
                                notificationsEnabled && audioBlockedMessage ? '⚠️ Som Bloqueado! Ativar?' :
                                '🔕 Notificações Desativadas'}
                        </button>
                        {/* NOVO BOTÃO: Impressão Automática */}
                        <button
                            onClick={toggleAutoPrint}
                            className={`${autoPrintEnabled ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-300 text-gray-800 hover:bg-gray-400'} text-white px-4 py-2 rounded-lg`}
                        >
                            {autoPrintEnabled ? '🖨️ Impressão Auto Ativada' : '🖨️ Impressão Auto Desativada'}
                        </button>

                        <button className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg w-full sm:w-auto">Filtrar por Período Específico</button>
                    </div>
                </div>

                {audioBlockedMessage && (
                    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
                        <p className="font-bold">Atenção!</p>
                        <p>{audioBlockedMessage} <button onClick={() => { if(audioRef.current) audioRef.current.play().catch(() => {}); setAudioBlockedMessage(''); }} className="underline font-semibold">Tocar agora</button></p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    <div>
                        <h2 className="text-xl font-semibold mb-4 pb-2 border-b-2 text-red-600 border-red-300">🆕 Recebido ({pedidosRecebidos.length})</h2>
                        {pedidosRecebidos.length === 0 ? (
                            <p className="text-gray-500 italic">Nenhum pedido nesta coluna.</p>
                        ) : (
                            pedidosRecebidos.map(pedido => (
                                <PedidoCard
                                    key={pedido.id}
                                    pedido={pedido}
                                    mudarStatus={updateOrderStatus}
                                    excluirPedido={deletePedido}
                                    estabelecimento={estabelecimentoInfo}
                                    autoPrintEnabled={autoPrintEnabled}
                                />
                            ))
                        )}
                    </div>

                    <div>
                        <h2 className="text-xl font-semibold mb-4 pb-2 border-b-2 text-blue-600 border-blue-300">🧑‍🍳 Em Preparo ({pedidosEmPreparo.size})</h2>
                        {[...pedidosEmPreparo.values()].length === 0 ? (
                            <p className="text-gray-500 italic">Nenhum pedido nesta coluna.</p>
                        ) : (
                            [...pedidosEmPreparo.values()].map(pedido => (
                                <PedidoCard
                                    key={pedido.id}
                                    pedido={pedido}
                                    mudarStatus={updateOrderStatus}
                                    excluirPedido={deletePedido}
                                    estabelecimento={estabelecimentoInfo}
                                    autoPrintEnabled={autoPrintEnabled}
                                />
                            ))
                        )}
                    </div>

                    <div>
                        <h2 className="text-xl font-semibold mb-4 pb-2 border-b-2 text-orange-600 border-orange-300">🛵 Em Entrega ({pedidosEmEntrega.size})</h2>
                        {[...pedidosEmEntrega.values()].length === 0 ? (
                            <p className="text-gray-500 italic">Nenhum pedido nesta coluna.</p>
                        ) : (
                            [...pedidosEmEntrega.values()].map(pedido => (
                                <PedidoCard
                                    key={pedido.id}
                                    pedido={pedido}
                                    mudarStatus={updateOrderStatus}
                                    excluirPedido={deletePedido}
                                    estabelecimento={estabelecimentoInfo}
                                    autoPrintEnabled={autoPrintEnabled}
                                />
                            ))
                        )}
                    </div>

                    <div>
                        <h2 className="text-xl font-semibold mb-4 pb-2 border-b-2 text-green-600 border-green-300">✅ Finalizados ({pedidosFinalizados.size})</h2>
                        {[...pedidosFinalizados.values()].length === 0 ? (
                            <p className="text-gray-500 italic">Nenhum pedido nesta coluna.</p>
                        ) : (
                            [...pedidosFinalizados.values()].map(pedido => (
                                <PedidoCard
                                    key={pedido.id}
                                    pedido={pedido}
                                    mudarStatus={updateOrderStatus}
                                    excluirPedido={deletePedido}
                                    estabelecimento={estabelecimentoInfo}
                                    autoPrintEnabled={autoPrintEnabled}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
export default Painel;