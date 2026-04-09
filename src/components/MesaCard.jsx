import React, { useMemo } from 'react';
import { IoTime, IoPerson, IoCashOutline, IoPersonCircle, IoTrash, IoNotifications, IoReceipt } from 'react-icons/io5';

// Helper de formatação interna
const formatarDinheiro = (val) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(val || 0);
};

const MesaCard = ({ mesa, isOciosa, onClick, onPagar, onExcluir, onLimparAlerta, isValorOculto }) => {
    
    // Cores do STATUS: Tons suaves no fundo, texto forte e borda dupla elegante
    const cardStyle = useMemo(() => {
        if (isOciosa) return 'bg-orange-50 border-orange-400 text-orange-900 shadow-md scale-[1.02] ring-2 ring-orange-400/20';

        switch (mesa.status) {
            case 'livre': return 'bg-white border-gray-200 text-gray-400 hover:border-blue-300 hover:shadow-md';
            case 'ocupada': return mesa.chamandoGarcom || mesa.pedindoConta ? 'bg-red-50 border-yellow-400 text-red-800 shadow-lg ring-2 ring-yellow-400/50' : 'bg-red-50 border-red-300 text-red-800 shadow-sm';
            case 'com_pedido': return mesa.chamandoGarcom || mesa.pedindoConta ? 'bg-blue-50 border-yellow-400 text-blue-800 shadow-lg ring-2 ring-yellow-400/50' : 'bg-blue-50 border-blue-300 text-blue-800 shadow-sm'; 
            case 'pagamento': return 'bg-yellow-50 border-yellow-400 text-yellow-900 shadow-sm';
            default: return 'bg-white border-gray-200 text-gray-500';
        }
    }, [mesa.status, isOciosa]);

    const tempoDecorrido = useMemo(() => {
        if (!mesa.updatedAt || mesa.status === 'livre') return '';
        const data = mesa.updatedAt.toDate ? mesa.updatedAt.toDate() : new Date(mesa.updatedAt);
        const diff = Math.floor((new Date() - data) / 60000);
        if (diff < 1) return 'Agora';
        if (diff > 60) return `${Math.floor(diff/60)}h`;
        return `${diff}m`;
    }, [mesa.updatedAt, mesa.status]);

    // Trata o nome do cliente para caber no layout
    const nomeCliente = useMemo(() => {
        if (mesa.nomesOcupantes && Array.isArray(mesa.nomesOcupantes)) {
            const nomesReais = mesa.nomesOcupantes.filter(n => n !== 'Mesa');
            if (nomesReais.length > 0) {
                return nomesReais.length > 1 
                    ? `${nomesReais[0]} (+${nomesReais.length - 1})` 
                    : nomesReais[0];
            }
        }
        return mesa.nome && mesa.nome.toLowerCase() !== 'mesa' ? mesa.nome : null;
    }, [mesa.nomesOcupantes, mesa.nome]);

    return (
        <div className={`relative rounded-2xl border-2 flex flex-col justify-between overflow-hidden transition-all duration-200 active:scale-95 cursor-pointer min-h-[145px] ${cardStyle}`}>
            
            {/* --- ÁREA PRINCIPAL --- */}
            <div onClick={onClick} className="flex-1 p-3 flex flex-col relative z-10">
                
                {/* Cabeçalho: Número e Tempo */}
                <div className="flex justify-between items-start mb-1">
                    <span className="text-4xl font-black leading-none tracking-tighter opacity-90 drop-shadow-sm">
                        {mesa.numero}
                    </span>
                    <div className="flex flex-col items-end gap-1">
                        {(mesa.chamandoGarcom || mesa.pedindoConta) && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); if(onLimparAlerta) onLimparAlerta(mesa.id); }}
                                className="animate-bounce bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-1 rounded shadow-md flex items-center gap-1 active:scale-95 hover:bg-yellow-500 transition-all uppercase"
                                title="Limpar alerta"
                            >
                                {mesa.pedindoConta ? <><IoReceipt size={12}/> Conta</> : <><IoNotifications size={12}/> Garçom</>}
                            </button>
                        )}
                        
                        {isOciosa ? (
                            <span className="text-[9px] font-black bg-orange-500 text-white px-2 py-1 rounded-md flex items-center gap-1 shadow-sm animate-pulse uppercase tracking-wider">
                                <IoTime size={12}/> Ociosa
                            </span>
                        ) : mesa.status !== 'livre' && (() => {
                            // Cor dinâmica baseada no tempo
                            const data = mesa.updatedAt?.toDate ? mesa.updatedAt.toDate() : (mesa.updatedAt ? new Date(mesa.updatedAt) : null);
                            const mins = data ? Math.floor((new Date() - data) / 60000) : 0;
                            const timeColor = mins >= 30 ? 'bg-red-100 text-red-700 border-red-200' 
                                : mins >= 15 ? 'bg-amber-100 text-amber-700 border-amber-200' 
                                : 'bg-white/70 text-gray-600 border-black/5';
                            return (
                                <span className={`text-[10px] font-bold backdrop-blur-sm border px-2 py-1 rounded-md flex items-center gap-1 shadow-sm ${timeColor}`}>
                                    <IoTime size={11}/> {tempoDecorrido}
                                </span>
                            );
                        })()}
                    </div>
                </div>

                {/* Corpo: Livre ou Pessoas/Nome */}
                {mesa.status === 'livre' ? (
                    <div className="flex flex-col items-center justify-center flex-1 opacity-40">
                        <span className="text-xs font-black uppercase tracking-widest mt-2">LIVRE</span>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1.5 mt-auto pt-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold opacity-75">
                            <IoPerson size={13}/> 
                            <span>{mesa.pessoas || 1} pessoas</span>
                        </div>
                        
                        {nomeCliente && (
                            <div className="flex items-center gap-1.5 bg-white/50 w-fit px-1.5 py-1 rounded border border-black/5">
                                <IoPersonCircle size={15} className="opacity-75"/>
                                <span className="text-[11px] font-bold truncate max-w-[90px] uppercase text-gray-800" title={nomeCliente}>
                                    {nomeCliente}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* --- RODAPÉ: VALOR / AÇÕES --- */}
            {mesa.status !== 'livre' ? (
                <div className="bg-white/60 backdrop-blur-md border-t border-black/5 flex flex-col">
                    <div onClick={onClick} className="py-1.5 px-3 text-center border-b border-black/5 hover:bg-white/50 transition-colors">
                        <span className="text-[17px] font-black text-gray-900 tracking-tight">
                            {isValorOculto ? 'R$ •••••' : formatarDinheiro(mesa.total)}
                        </span>
                    </div>

                    <div 
                        onClick={(e) => { e.stopPropagation(); onPagar(); }}
                        className={`py-2 px-2 flex items-center justify-center gap-1.5 transition-colors font-black text-[11px] uppercase tracking-wider
                            ${mesa.status === 'pagamento' 
                                ? 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900' 
                                : 'bg-green-600 hover:bg-green-700 text-white shadow-inner'
                            }`}
                    >
                        <IoCashOutline size={16} /> Pagar Conta
                    </div>
                </div>
            ) : (
                <div className="bg-gray-50 flex justify-end border-t border-gray-200">
                    <button 
                        onClick={(e) => { e.stopPropagation(); if (onExcluir) onExcluir(); }}
                        className="w-full py-2 flex items-center justify-center gap-1.5 text-gray-400 hover:text-white hover:bg-red-500 transition-colors"
                        title="Excluir Mesa"
                    >
                        <IoTrash size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Excluir</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default MesaCard;