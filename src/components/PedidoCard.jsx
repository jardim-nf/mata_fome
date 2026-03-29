// src/components/PedidoCard.jsx
import React, { useState, useMemo, useCallback } from 'react';
import { 
    IoPerson, IoTrash, IoArrowForward, IoCheckmarkCircle, IoPrint,
    IoLogoWhatsapp, IoBicycle, IoAlertCircle, IoTime, IoRestaurant, IoFlag,
    IoReceiptOutline
} from "react-icons/io5";
import { useAuth } from '../context/AuthContext'; 
import { formatarMoeda } from '../utils/formatCurrency';

const PedidoCard = ({ 
    item, 
    onUpdateStatus, 
    onExcluir, 
    newOrderIds, 
    showMesaInfo = true,
    isAgrupado = false,
    estabelecimentoInfo = null,
    motoboysDisponiveis = [], 
    onAtribuirMotoboy,
    onEmitirNfce,
    onUpdateFormaPagamento
}) => {
    const [isUpdating, setIsUpdating] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [selectedMotoboyId, setSelectedMotoboyId] = useState("");
    const [isExpanded, setIsExpanded] = useState(false); // Estado para expandir itens
    
    const { estabelecimentoIdPrincipal } = useAuth();

    const isNew = newOrderIds && newOrderIds.has ? newOrderIds.has(item.id) : false;

    // 🔥 Helper: detecta se o pedido é RETIRADA (não delivery, não salão/mesa)
    const isRetirada = item.tipoEntrega === 'retirada';
    const isSalaoOuMesa = item.tipo === 'salao' || item.tipo === 'mesa' || item.source === 'salao';

    // Tempo decorrido desde o pedido
    const [tempoDecorrido, setTempoDecorrido] = useState('');
    const [corTempo, setCorTempo] = useState('text-gray-500');
    
    React.useEffect(() => {
        if (item.status === 'finalizado') return;
        const ts = item.createdAt || item.dataPedido;
        if (!ts) return;
        const calcular = () => {
            const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
            const diff = Math.floor((Date.now() - d.getTime()) / 60000);
            if (diff < 1) { setTempoDecorrido('agora'); setCorTempo('text-emerald-600 bg-emerald-50'); }
            else if (diff < 15) { setTempoDecorrido(`${diff}min`); setCorTempo('text-emerald-600 bg-emerald-50'); }
            else if (diff < 30) { setTempoDecorrido(`${diff}min`); setCorTempo('text-amber-600 bg-amber-50'); }
            else if (diff < 60) { setTempoDecorrido(`${diff}min`); setCorTempo('text-red-600 bg-red-50'); }
            else { setTempoDecorrido(`${Math.floor(diff/60)}h${diff%60}m`); setCorTempo('text-red-700 bg-red-100'); }
        };
        calcular();
        const interval = setInterval(calcular, 30000);
        return () => clearInterval(interval);
    }, [item.createdAt, item.dataPedido, item.status]);

    // --- CONFIGURAÇÃO DE STATUS ---
    const getStatusConfig = (status) => {
        switch (status) {
            case 'aguardando_pagamento': return { color: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: '💲', label: 'Pagamento', btn: 'bg-green-600 hover:bg-green-700' };
            case 'recebido': return { color: 'bg-red-50 text-red-700 border-red-200', icon: '📥', label: 'Recebido', btn: 'bg-orange-500 hover:bg-orange-600' };
            case 'preparo': return { color: 'bg-orange-50 text-orange-700 border-orange-200', icon: '👨‍🍳', label: 'Preparo', btn: 'bg-blue-600 hover:bg-blue-700' };
            case 'pronto_para_servir': return { color: 'bg-green-50 text-green-700 border-green-200', icon: '✅', label: 'Pronto', btn: 'bg-green-500 hover:bg-green-600' };
            case 'em_entrega': return { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: '🛵', label: 'Na Rua', btn: 'bg-green-500 hover:bg-green-600' };
            case 'finalizado': return { color: 'bg-gray-50 text-gray-700 border-gray-200', icon: '📦', label: 'Finalizado', btn: 'bg-gray-500' };
            default: return { color: 'bg-gray-50 text-gray-700', icon: '?', label: status, btn: 'bg-gray-500' };
        }
    };

    const statusConfig = getStatusConfig(item.status);

    // --- CÁLCULOS FINANCEIROS ---
    const valorTotalExibicao = useMemo(() => {
        if (item.totalFinal && Number(item.totalFinal) > 0) return Number(item.totalFinal);
        if (item.total && Number(item.total) > 0) return Number(item.total);
        
        let somaItens = 0;
        if (item.itens && Array.isArray(item.itens)) {
            somaItens = item.itens.reduce((acc, curr) => {
                const precoItem = Number(curr.preco) || 0;
                const qtd = Number(curr.quantidade) || 1;
                const totalAdicionais = curr.adicionais ? curr.adicionais.reduce((adAcc, ad) => adAcc + (Number(ad.preco) || 0), 0) : 0;
                return acc + ((precoItem + totalAdicionais) * qtd);
            }, 0);
        }
        const taxaEntrega = Number(item.taxaEntrega) || 0;
        return somaItens + taxaEntrega;
    }, [item]);


    // --- HELPERS DE DATA E TEMPO ---
    const formatarDataHora = (timestamp) => {
        if (!timestamp) return '';
        try {
            const date = timestamp?.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
            return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        } catch { return ''; }
    };

    // Calcula diferença em minutos entre dois timestamps
    const calcDiffMin = (start, end) => {
        if (!start || !end) return 0;
        const d1 = start.seconds ? new Date(start.seconds * 1000) : new Date(start);
        const d2 = end.seconds ? new Date(end.seconds * 1000) : new Date(end);
        return Math.floor((d2 - d1) / 60000);
    };

    // --- CÁLCULO DE TEMPOS DE ETAPA ---
    const temposEtapa = useMemo(() => {
        const criado = item.createdAt || item.dataPedido;
        const preparo = item.dataPreparo;
        const entrega = item.dataEntrega || item.dataPronto;
        const fim = item.dataFinalizado;

        const tempos = [];

        // Tempo de Espera (Criado -> Preparo)
        if (criado && preparo) {
            tempos.push({ label: 'Espera', val: calcDiffMin(criado, preparo), icon: <IoTime/>, color: 'text-red-500' });
        }
        
        // Tempo de Preparo (Preparo -> Entrega/Pronto)
        if (preparo && entrega) {
            tempos.push({ label: 'Preparo', val: calcDiffMin(preparo, entrega), icon: <IoRestaurant/>, color: 'text-orange-500' });
        }

        // Tempo de Entrega (Entrega -> Finalizado)
        if (entrega && fim) {
            tempos.push({ label: 'Entrega', val: calcDiffMin(entrega, fim), icon: <IoBicycle/>, color: 'text-blue-500' });
        }

        // Tempo Total (Criado -> Agora ou Finalizado)
        const fimTotal = fim || new Date();
        if (criado) {
            tempos.push({ label: 'Total', val: calcDiffMin(criado, fimTotal), icon: <IoFlag/>, color: 'text-gray-600 font-bold' });
        }

        return tempos;
    }, [item]);

    const traduzirFormaPagamento = (forma) => {
        const t = { 'credit_card': 'CRÉDITO', 'debit_card': 'DÉBITO', 'cash': 'DINHEIRO', 'pix': 'PIX', 'card': 'CARTÃO' };
        return t[forma?.toLowerCase()] || forma?.toUpperCase() || 'OUTROS';
    };

    // --- WHATSAPP AUTOMÁTICO ---
// --- WHATSAPP AUTOMÁTICO ---
    const enviarWhatsApp = (statusAlvo) => {
        const telefone = item.cliente?.telefone || item.telefone;
        if (!telefone) {
            console.warn('[WhatsApp] Pedido sem telefone, não é possível enviar.');
            return;
        }
        
        const nomeCliente = item.cliente?.nome || 'Cliente';
        const idCurto = item.id?.slice(0,4).toUpperCase();
        const totalFormatado = formatarMoeda(valorTotalExibicao);
        const formaPag = (item.formaPagamento || '').toLowerCase();
        
        let frasePrincipal = "";
        let mostrarTotal = true;

        switch (statusAlvo) {
            case 'recebido':
            case 'preparo':
                if (formaPag === 'pix_manual' || formaPag === 'pix') {
                    frasePrincipal = `Seu pedido *#${idCurto}* foi recebido! ✅\n\n🧾 *Seu pagamento foi no PIX via chave* — por favor, envie o comprovante por aqui para confirmarmos.`;
                } else {
                    frasePrincipal = `Seu pedido *#${idCurto}* foi recebido! ✅\n\nEm instantes você receberá atualizações sobre o preparo. 🍔`;
                }
                break;
            case 'em_entrega': 
                const infoMoto = item.motoboyNome ? ` com o entregador *${item.motoboyNome}*` : '';
                frasePrincipal = `Saiu para entrega! 🛵💨\nSeu pedido *#${idCurto}* está a caminho${infoMoto}.`; 
                break;
            case 'pronto_para_servir': frasePrincipal = `Seu pedido *#${idCurto}* está pronto! ✅\nJá pode vir retirar.`; break;
            case 'finalizado': 
                frasePrincipal = `Pedido *#${idCurto}* entregue com sucesso! ⭐\nObrigado pela preferência! 🍔❤️`; 
                mostrarTotal = false; 
                break;
            default: frasePrincipal = `Atualização do pedido *#${idCurto}*: Status *${getStatusConfig(statusAlvo).label.toUpperCase()}*.`;
        }
        
        const msgFinal = `Olá, *${nomeCliente}*! 👋\n\n${frasePrincipal}${mostrarTotal ? `\n\n💰 *Valor Total: ${totalFormatado}*` : ''}`;
        const numeroFormatado = telefone.replace(/\D/g, '');
        window.open(`https://wa.me/55${numeroFormatado}?text=${encodeURIComponent(msgFinal)}`, '_blank');
    };

    // --- IMPRESSÃO OTIMIZADA ---
    const handlePrint = useCallback(() => {
        if (!item || !item.id) return;
        setIsPrinting(true);

        const width = 350;
        const height = 600;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        const isSalao = item.source === 'salao' || item.tipo === 'salao' || item.tipo === 'mesa';
        const estabId = estabelecimentoInfo?.id || item.estabelecimentoId || estabelecimentoIdPrincipal;

        let url = `/comanda/${item.id}`;
        const params = new URLSearchParams();
        if (isSalao) params.append('origem', 'salao');
        if (estabId) params.append('estabId', estabId);
        if (params.toString()) url += `?${params.toString()}`;

        const printWindow = window.open(url, 'ImprimirComanda', `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`);

        if (printWindow) {
            const timer = setInterval(() => {
                if (printWindow.closed) {
                    clearInterval(timer);
                    setIsPrinting(false);
                }
            }, 500);
        } else {
            alert("⚠️ Pop-up bloqueado! Permita pop-ups para imprimir.");
            setIsPrinting(false);
        }
    }, [item, estabelecimentoInfo, estabelecimentoIdPrincipal]);

    // --- AÇÕES DE STATUS ---
// --- AÇÕES DE STATUS ---
    const handleAction = useCallback(async () => {
        if (isUpdating) return;
        
        let nextStatus = null;
        if (item.status === 'aguardando_pagamento') nextStatus = 'recebido';
        else if (item.status === 'recebido') nextStatus = 'preparo';
        else if (item.status === 'preparo') nextStatus = (isSalaoOuMesa || isRetirada) ? 'pronto_para_servir' : 'em_entrega';
        else if (item.status === 'pronto_para_servir' || item.status === 'em_entrega') nextStatus = 'finalizado';

        if (!nextStatus) return;

        if (nextStatus === 'em_entrega') {
            if (motoboysDisponiveis.length > 0) {
                if (!selectedMotoboyId) {
                    alert("⚠️ Selecione um MOTOBOY!");
                    return;
                }
                const motoboy = motoboysDisponiveis.find(m => m.id === selectedMotoboyId);
                if (motoboy && onAtribuirMotoboy) {
                    setIsUpdating(true);
                    try {
                        await onAtribuirMotoboy(item.id, motoboy.id, motoboy.nome);
                        // Se NÃO tem bot ativo, abre WhatsApp manual
                        if (!estabelecimentoInfo?.whatsapp?.ativo) enviarWhatsApp(nextStatus);
                    } catch (error) { console.error(error); alert("Erro ao atribuir!"); } 
                    finally { setIsUpdating(false); }
                    return;
                }
            } else {
                if (!window.confirm("⚠️ Sem motoboy. Continuar?")) return;
            }
        }

        setIsUpdating(true);
        try {
            await onUpdateStatus(item.id, nextStatus);
            
            // Se NÃO tem bot ativo, abre WhatsApp manual
            if (!estabelecimentoInfo?.whatsapp?.ativo) enviarWhatsApp(nextStatus);
            
            // 🔔 Push notification para o cliente (mantemos isto para o site)
            import('../utils/notifications.js').then(({ notificarStatusPedido }) => {
                notificarStatusPedido(nextStatus, item.id);
            }).catch((err) => { console.error(err); });
        } catch (error) { console.error(error); alert("Erro ao atualizar!"); } 
        finally { setIsUpdating(false); }
    }, [item, selectedMotoboyId, motoboysDisponiveis, onAtribuirMotoboy, onUpdateStatus, isUpdating, estabelecimentoInfo]);
    const getBtnText = () => {
        if (item.status === 'aguardando_pagamento') return 'Aprovar Pagamento';
        if (item.status === 'recebido') return 'Mandar p/ Cozinha';
        if (item.status === 'preparo') {
            if (isSalaoOuMesa) return 'Pronto';
            if (isRetirada) return 'Pronto p/ Retirada';
            return 'Saiu p/ Entrega';
        }
        return 'Finalizar';
    };

    // Motoboy select: só mostra para delivery real (não salão, não mesa, não retirada)
    const showMotoboySelect = item.status === 'preparo' && !isSalaoOuMesa && !isRetirada;

    return (
        <div className={`relative bg-white rounded-xl transition-all duration-200 w-full border shadow-sm ${isNew ? 'ring-2 ring-red-500 border-red-300 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-[pulse_1.5s_ease-in-out_infinite]' : 'border-gray-200'} ${item.status === 'finalizado' ? 'opacity-75' : ''}`}>
            
            {/* BADGE NOVO */}
            {isNew && (
                <div className="absolute -top-2 -right-2 z-10 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg animate-bounce">
                    NOVO
                </div>
            )}
            {/* HEADER */}
            <div className={`px-4 py-3 ${showMesaInfo && !isAgrupado ? 'bg-gray-50' : 'bg-white'} border-b border-gray-100 rounded-t-xl`}>
                <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                        <span className="font-black text-gray-800 text-lg flex items-center gap-2">
                            {isSalaoOuMesa ? `Mesa ${item.mesaNumero}` : isRetirada ? '📦 Retirada' : '🛵 Delivery'}
                            <span className="text-xs font-normal text-gray-400">#{item.id?.slice(0,4).toUpperCase()}</span>
                        </span>
                        
                        {item.motoboyNome && (
                            <span className="text-xs font-bold text-blue-600 flex items-center gap-1 mt-1 bg-blue-50 w-fit px-2 py-0.5 rounded-full border border-blue-100">
                                <IoBicycle /> {item.motoboyNome}
                            </span>
                        )}
                        
                        {!isSalaoOuMesa && (
                            <span className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                                <IoPerson className="w-3 h-3" /> {item.cliente?.nome || 'Cliente'}
                            </span>
                        )}
                        
                        {(item.createdAt || item.dataPedido) && (
                            <span className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                <IoTime className="w-3 h-3" /> {formatarDataHora(item.createdAt || item.dataPedido)}
                                {tempoDecorrido && item.status !== 'finalizado' && (
                                    <span className={`ml-1 text-[10px] font-black px-1.5 py-0.5 rounded-full border ${corTempo}`}>
                                        ⏱ {tempoDecorrido}
                                    </span>
                                )}
                            </span>
                        )}

                        {/* Endereço resumido (só delivery real, não retirada) */}
                        {!isSalaoOuMesa && !isRetirada && item.endereco && (
                            <span className="text-[10px] text-gray-400 mt-1 truncate max-w-[200px] block" title={`${item.endereco.rua || item.endereco.logradouro || ''}, ${item.endereco.numero || ''} - ${item.endereco.bairro || ''}`}>
                                📍 {item.endereco.bairro || item.endereco.rua || item.endereco.logradouro || ''}
                                {item.endereco.numero ? `, ${item.endereco.numero}` : ''}
                            </span>
                        )}
                    </div>
                    
                    <div className="text-right">
                        <span className="font-black text-gray-900 text-base">{formatarMoeda(valorTotalExibicao)}</span>
                        {item.taxaEntrega > 0 && (
                            <span className="text-xs text-gray-500 block mt-1">
                                +{formatarMoeda(item.taxaEntrega)} taxa
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* CONTEÚDO */}
            <div className="p-4">
                <div className="mb-3 flex justify-between items-center">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 w-fit ${statusConfig.color}`}>
                        <span>{statusConfig.icon}</span> {statusConfig.label}
                    </span>
                    {/* 🔥 FORMA DE PAGAMENTO EDITÁVEL */}
                    {onUpdateFormaPagamento && item.status !== 'finalizado' ? (
                        <select
                            value={item.formaPagamento || 'outros'}
                            onChange={(e) => onUpdateFormaPagamento(item.id, e.target.value)}
                            className="text-xs font-semibold border border-gray-200 px-2 py-1 rounded bg-gray-50 text-gray-500 cursor-pointer hover:border-blue-300 focus:ring-1 focus:ring-blue-400 focus:outline-none"
                        >
                            <option value="pix">PIX</option>
                            <option value="credit_card">CRÉDITO</option>
                            <option value="debit_card">DÉBITO</option>
                            <option value="cash">DINHEIRO</option>
                            <option value="card">CARTÃO</option>
                            <option value="pix_manual">PIX MANUAL</option>
                            <option value="outros">OUTROS</option>
                        </select>
                    ) : (
                        <span className="text-xs text-gray-500 font-semibold border border-gray-200 px-2 py-1 rounded bg-gray-50">
                           {traduzirFormaPagamento(item.formaPagamento)}
                        </span>
                    )}
                    {item.itens?.length > 0 && (
                        <span className="text-[10px] font-black text-gray-400 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                            {item.itens.reduce((a, it) => a + (it.quantidade || 1), 0)} itens
                        </span>
                    )}
                </div>

                {/* 🔥 EXIBIÇÃO DE TEMPOS DE ETAPA (só mostra > 0) */}
                {temposEtapa.filter(t => t.val > 0).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4 bg-gray-50 p-2 rounded-lg border border-gray-100">
                        {temposEtapa.filter(t => t.val > 0).map((tempo, i) => (
                            <div key={i} className={`flex items-center gap-1 text-[10px] font-medium ${tempo.color} bg-white px-2 py-1 rounded border border-gray-200 shadow-sm`}>
                                {tempo.icon}
                                <span>{tempo.label}: {tempo.val}min</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* LISTA DE ITENS */}
                <div className="space-y-3 mb-4">
                    {item.itens?.slice(0, isExpanded ? undefined : 3).map((it, idx) => (
                        <div key={idx} className="flex gap-2 text-sm border-b border-dashed border-gray-100 pb-2 last:border-0 last:pb-0">
                            <span className="font-bold text-gray-900 min-w-[20px]">{it.quantidade}x</span>
                            <div className="flex-1">
                                <p className="text-gray-700 font-medium leading-tight">{it.nome}</p>
                                {it.adicionais?.length > 0 && (
                                    <p className="text-xs text-gray-400 mt-1">
                                        + {it.adicionais.map(a => a.nome).join(', ')}
                                    </p>
                                )}
                                {it.observacoes && (
                                    <p className="text-xs text-amber-600 italic mt-1">Obs: {it.observacoes}</p>
                                )}
                            </div>
                            <span className="text-xs text-gray-500 font-semibold min-w-[60px] text-right">
                                {formatarMoeda((Number(it.preco) || 0) * (it.quantidade || 1))}
                            </span>
                        </div>
                    ))}
                </div>
                
                {item.itens?.length > 3 && (
                    <button onClick={() => setIsExpanded(!isExpanded)} className="w-full text-center text-xs font-semibold text-gray-400 py-1 mb-2 hover:text-gray-600 transition-colors">
                        {isExpanded ? '▲ Ver menos' : `▼ Ver mais ${item.itens.length - 3} itens`}
                    </button>
                )}

                {/* SELEÇÃO DE MOTOBOY */}
                {showMotoboySelect && (
                    <div className="mb-3 bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <label className="text-xs font-bold text-blue-800 mb-2 flex items-center gap-1">
                            <IoBicycle className="text-lg"/> Quem vai entregar?
                        </label>
                        
                        {motoboysDisponiveis.length > 0 ? (
                            <>
                                <select 
                                    value={selectedMotoboyId} 
                                    onChange={(e) => setSelectedMotoboyId(e.target.value)} 
                                    className={`w-full text-sm rounded-md shadow-sm py-2 px-3 mb-2 ${!selectedMotoboyId ? 'border-red-300 bg-red-50 text-red-800 focus:ring-red-500' : 'border-gray-300 bg-white text-gray-700 focus:ring-blue-500'}`}
                                >
                                    <option value="">-- Selecione o Motoboy --</option>
                                    {motoboysDisponiveis.map(moto => (
                                        <option key={moto.id} value={moto.id}>
                                            {moto.nome} {moto.taxaEntrega ? `(${formatarMoeda(moto.taxaEntrega)})` : ''}
                                        </option>
                                    ))}
                                </select>
                                {!selectedMotoboyId && (
                                    <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                                        ⚠️ Selecione um motoboy para continuar
                                    </p>
                                )}
                            </>
                        ) : (
                            <div className="space-y-2">
                                <div className="text-xs text-red-500 flex items-center gap-1">
                                    <IoAlertCircle className="text-lg"/> Sem motoboys cadastrados!
                                </div>
                                <button 
                                    onClick={() => { if (window.confirm("Avançar sem motoboy?")) handleAction(); }}
                                    className="w-full text-xs bg-blue-100 text-blue-700 py-2 rounded border border-blue-300 font-bold hover:bg-blue-200 transition-colors"
                                >
                                    Avançar sem Motoboy
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* BOTÕES DE AÇÃO */}
                <div className="flex gap-2 mt-4 min-h-[40px] items-start">
                    <button 
                        onClick={handlePrint} 
                        disabled={isPrinting} 
                        className="w-10 h-10 shrink-0 flex items-center justify-center bg-gray-100 text-gray-500 rounded-lg hover:bg-blue-100 hover:text-blue-600 border border-gray-200 transition-colors" 
                        title="Imprimir Comanda"
                    >
                        {isPrinting ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/> : <IoPrint className="text-lg" />}
                    </button>
                    
                    <button 
                        onClick={() => enviarWhatsApp(item.status)} 
                        className="w-10 h-10 shrink-0 flex items-center justify-center bg-green-100 text-green-600 rounded-lg hover:bg-green-200 border border-green-200 transition-colors" 
                        title="Enviar WhatsApp (Status Atual)"
                    >
                        <IoLogoWhatsapp className="text-lg" />
                    </button>
                    
                    {onExcluir && (item.status === 'recebido' || item.status === 'aguardando_pagamento') && (
                        <button 
                            onClick={() => onExcluir(item.id, item.source)} 
                            className="w-10 h-10 shrink-0 flex items-center justify-center bg-gray-100 text-gray-500 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors border border-gray-200" 
                            title="Cancelar Pedido"
                        >
                            <IoTrash className="text-lg" />
                        </button>
                    )}
                    
                    {item.status !== 'finalizado' ? (
                        <button 
                            onClick={handleAction} 
                            disabled={isUpdating} 
                            className={`flex-1 min-h-[40px] h-auto py-2 rounded-lg font-bold text-white text-xs flex items-center justify-center gap-2 transition-all shadow-sm leading-tight break-words ${statusConfig.btn} ${isUpdating ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-md'}`}
                        >
                            {isUpdating ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                            ) : (
                                <>
                                    <span className="text-center">{getBtnText()}</span>
                                    <IoArrowForward className="text-lg shrink-0" />
                                </>
                            )}
                        </button>
                    ) : (
                        <>
                            <div className="flex-1 min-h-[40px] flex items-center justify-center gap-2 bg-gray-100 text-gray-500 font-bold text-sm rounded-lg border">
                                <IoCheckmarkCircle className="text-green-500"/> Concluído
                            </div>
                            {/* 🧾 BOTÃO NFC-e — INLINE AO LADO DO CONCLUÍDO */}
                            {onEmitirNfce && ['credit_card', 'debit_card', 'pix', 'credito', 'débito', 'debito', 'crédito'].includes(item.formaPagamento?.toLowerCase()) && (
                                <button
                                    onClick={() => onEmitirNfce(item)}
                                    className="flex-1 min-h-[40px] flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-lg shadow-sm transition-all active:scale-95"
                                    title="Emitir NFC-e para este pedido"
                                >
                                    <IoReceiptOutline className="text-lg" /> NFCe
                                </button>
                            )}
                        </>
                    )}
                </div>
                
                {item.observacoes && (
                    <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                        <span className="font-bold">Observações:</span> {item.observacoes}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PedidoCard;
