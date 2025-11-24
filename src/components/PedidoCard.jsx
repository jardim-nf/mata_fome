import React, { useState, useMemo } from 'react';
import { 
    IoPerson, 
    IoTime, 
    IoRestaurant, 
    IoCheckmarkCircle,
    IoArrowForward,
    IoCash,
    IoCard,
    IoPhonePortrait,
    IoWallet,
    IoTrash
} from "react-icons/io5";

const PedidoCard = ({ 
    item, 
    onUpdateStatus, 
    onExcluir, 
    newOrderIds, 
    showMesaInfo = true,
    isAgrupado = false 
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    
    // Verificação de segurança para newOrderIds
    const isNew = newOrderIds && newOrderIds.has ? newOrderIds.has(item.id) : false;

    // 🎯 FORMATAR MOEDA
    const formatarMoeda = (valor) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor || 0);
    };

    // 🎯 CALCULAR TOTAL DO PEDIDO
    const totalPedido = useMemo(() => {
        if (item.total) return item.total;
        return item.itens?.reduce((total, i) => total + (i.preco * i.quantidade), 0) || 0;
    }, [item.itens, item.total]);

    // 🎯 CORES E ÍCONES
    const getStatusConfig = (status) => {
        switch (status) {
            case 'recebido': return { color: 'bg-red-50 text-red-700 border-red-200', icon: '📥', label: 'Recebido', btn: 'bg-red-500 hover:bg-red-600' };
            case 'preparo': return { color: 'bg-orange-50 text-orange-700 border-orange-200', icon: '👨‍🍳', label: 'Preparo', btn: 'bg-orange-500 hover:bg-orange-600' };
            case 'pronto_para_servir': return { color: 'bg-green-50 text-green-700 border-green-200', icon: '✅', label: 'Pronto', btn: 'bg-green-500 hover:bg-green-600' };
            case 'em_entrega': return { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: '🛵', label: 'Entrega', btn: 'bg-blue-500 hover:bg-blue-600' };
            case 'finalizado': return { color: 'bg-gray-50 text-gray-700 border-gray-200', icon: '📦', label: 'Finalizado', btn: 'bg-gray-500' };
            default: return { color: 'bg-gray-50 text-gray-700', icon: '?', label: status, btn: 'bg-gray-500' };
        }
    };

    const statusConfig = getStatusConfig(item.status);

    // 🎯 FORMA DE PAGAMENTO
    const getFormaPagamento = () => {
        const style = "w-4 h-4 text-gray-500";
        if (item.formaPagamento) {
            const map = {
                'dinheiro': { text: 'Dinheiro', icon: <IoCash className={style}/> },
                'cartao': { text: 'Cartão', icon: <IoCard className={style}/> },
                'pix': { text: 'PIX', icon: <IoPhonePortrait className={style}/> },
                'debito': { text: 'Débito', icon: <IoCard className={style}/> },
                'credito': { text: 'Crédito', icon: <IoCard className={style}/> }
            };
            return map[item.formaPagamento] || { text: item.formaPagamento, icon: <IoWallet className={style}/> };
        }
        return { text: 'Não informado', icon: <IoWallet className={style}/> };
    };

    const formaPagamento = getFormaPagamento();

    // 🎯 AÇÃO DO BOTÃO PRINCIPAL
    const handleAction = async () => {
        if (isUpdating) return;
        
        let nextStatus = null;
        if (item.status === 'recebido') nextStatus = 'preparo';
        else if (item.status === 'preparo') nextStatus = item.source === 'salao' ? 'pronto_para_servir' : 'em_entrega';
        else if (item.status === 'pronto_para_servir' || item.status === 'em_entrega') nextStatus = 'finalizado';

        if (nextStatus) {
            setIsUpdating(true);
            await onUpdateStatus(item.id, nextStatus);
            setTimeout(() => setIsUpdating(false), 2000); // Debounce visual
        }
    };

    const getBtnText = () => {
        if (item.status === 'recebido') return 'Iniciar Preparo';
        if (item.status === 'preparo') return item.source === 'salao' ? 'Pronto p/ Servir' : 'Saiu p/ Entrega';
        return 'Finalizar';
    };

    return (
        <div className={`
            relative bg-white rounded-xl transition-all duration-200 w-full
            ${isNew ? 'ring-2 ring-green-400 shadow-md' : 'border border-gray-200 shadow-sm'}
            ${isAgrupado ? 'mt-2 mb-2' : ''}
        `}>
            {/* CABEÇALHO DO CARD (Só aparece se NÃO estiver agrupado por mesa, ex: Delivery) */}
            {showMesaInfo && !isAgrupado && (
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 rounded-t-xl flex justify-between items-center gap-2">
                    <div className="flex flex-col">
                        <span className="font-bold text-gray-800 text-sm sm:text-base">
                            {item.tipo === 'salao' ? `Mesa ${item.mesaNumero}` : '🛵 Delivery'}
                        </span>
                        {item.loteHorario && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                <IoTime className="w-3 h-3"/> {item.loteHorario}
                            </span>
                        )}
                    </div>
                    {isNew && (
                        <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full uppercase tracking-wide animate-pulse">
                            Novo
                        </span>
                    )}
                </div>
            )}

            <div className="p-3 sm:p-4">
                {/* HEADER INTERNO (Status + Preço) */}
                <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${statusConfig.color}`}>
                            <span>{statusConfig.icon}</span>
                            {statusConfig.label}
                        </span>
                        {/* Se estiver agrupado, mostra o badge NOVO aqui dentro */}
                        {isAgrupado && isNew && (
                            <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full uppercase animate-pulse">
                                Novo
                            </span>
                        )}
                    </div>
                    <span className="font-bold text-gray-900 text-sm sm:text-base">
                        {formatarMoeda(totalPedido)}
                    </span>
                </div>

                {/* LISTA DE ITENS */}
                <div className="space-y-3 mb-4">
                    {item.itens?.slice(0, isExpanded ? undefined : 3).map((it, idx) => (
                        <div key={idx} className="flex gap-3 text-sm border-b border-dashed border-gray-100 pb-2 last:border-0 last:pb-0">
                            <span className="font-bold text-gray-700 min-w-[24px] text-right">
                                {it.quantidade}x
                            </span>
                            <div className="flex-1 min-w-0">
                                <p className="text-gray-800 font-medium leading-tight break-words">
                                    {it.nome}
                                </p>
                                {it.observacoes && (
                                    <p className="text-xs text-red-500 mt-0.5 font-medium bg-red-50 p-1 rounded inline-block">
                                        Obs: {it.observacoes}
                                    </p>
                                )}
                                {it.adicionais && it.adicionais.length > 0 && (
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        + {it.adicionais.map(a => a.nome).join(', ')}
                                    </p>
                                )}
                            </div>
                            <span className="font-semibold text-gray-500 text-xs sm:text-sm whitespace-nowrap">
                                {formatarMoeda(it.preco * it.quantidade)}
                            </span>
                        </div>
                    ))}
                </div>

                {/* VER MAIS */}
                {item.itens?.length > 3 && (
                    <button 
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full text-center text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 py-1.5 rounded transition-colors mb-3"
                    >
                        {isExpanded ? 'Ver menos' : `Ver mais ${item.itens.length - 3} itens...`}
                    </button>
                )}

                {/* INFORMAÇÕES EXTRAS (Cliente / Pagamento) */}
                <div className="bg-gray-50 rounded-lg p-2.5 text-xs text-gray-600 space-y-2 mb-3">
                    {/* Pagamento */}
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                        <span className="flex items-center gap-1.5 font-medium text-gray-500">
                            {formaPagamento.icon} Pagamento:
                        </span>
                        <span className="font-bold text-gray-800 break-words">
                            {formaPagamento.text}
                        </span>
                    </div>

                    {/* Cliente (Só Delivery) */}
                    {item.tipo === 'delivery' && item.cliente && (
                        <div className="pt-2 border-t border-gray-200 mt-2">
                            <div className="flex items-start gap-1.5">
                                <IoPerson className="w-3.5 h-3.5 mt-0.5 text-gray-400"/>
                                <div>
                                    <span className="font-bold text-gray-800 block">{item.cliente.nome}</span>
                                    {item.cliente.endereco && <span className="block text-gray-500 mt-0.5 leading-tight">{item.cliente.endereco}</span>}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Tempo */}
                    <div className="flex items-center gap-1 text-gray-400 pt-1">
                        <IoTime className="w-3 h-3"/>
                        Recebido às {new Date(item.dataPedido?.toDate?.() || item.dataPedido || Date.now()).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                    </div>
                </div>

                {/* BOTÕES DE AÇÃO */}
                <div className="flex gap-2 h-10">
                    {/* Botão Excluir (Só aparece se status for 'recebido') */}
                    {onExcluir && item.status === 'recebido' && (
                        <button
                            onClick={() => onExcluir(item.id, item.source)}
                            className="h-full aspect-square flex items-center justify-center bg-gray-100 text-gray-500 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors border border-gray-200"
                            title="Cancelar Pedido"
                        >
                            <IoTrash className="text-lg" />
                        </button>
                    )}

                    {/* Botão de Status */}
                    {item.status !== 'finalizado' && (
                        <button
                            onClick={handleAction}
                            disabled={isUpdating}
                            className={`flex-1 h-full rounded-lg font-bold text-white text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm
                                ${statusConfig.btn} ${isUpdating ? 'opacity-70 cursor-wait' : ''}
                            `}
                        >
                            {isUpdating ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                            ) : (
                                <>
                                    <span>{getBtnText()}</span>
                                    <IoArrowForward className="text-base" />
                                </>
                            )}
                        </button>
                    )}
                    
                    {/* Status Finalizado (Apenas visual) */}
                    {item.status === 'finalizado' && (
                        <div className="flex-1 h-full flex items-center justify-center gap-2 bg-gray-100 text-gray-500 font-bold text-sm rounded-lg border border-gray-200">
                            <IoCheckmarkCircle className="text-green-500 text-lg"/> Concluído
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PedidoCard;