import React, { useMemo } from 'react';
import { IoTime, IoPerson, IoCashOutline, IoPersonCircle, IoTrash } from 'react-icons/io5';

// Helper de formatação interna
const formatarDinheiro = (val) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(val || 0);
};

// 🔥 ADICIONADO: prop 'onExcluir'
const MesaCard = ({ mesa, onClick, onPagar, onExcluir }) => {
    
    // Cores do STATUS (Parte Superior)
    const cardStyle = useMemo(() => {
        switch (mesa.status) {
            case 'livre': return 'bg-white border-gray-200 text-gray-400';
            case 'ocupada': return 'bg-red-50 border-red-200 text-red-800';
            case 'com_pedido': return 'bg-blue-50 border-blue-200 text-blue-800'; 
            case 'pagamento': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
            default: return 'bg-white border-gray-200';
        }
    }, [mesa.status]);

    const tempoDecorrido = useMemo(() => {
        if (!mesa.updatedAt || mesa.status === 'livre') return '';
        const data = mesa.updatedAt.toDate ? mesa.updatedAt.toDate() : new Date(mesa.updatedAt);
        const diff = Math.floor((new Date() - data) / 60000);
        if (diff < 1) return 'Agora';
        if (diff > 60) return `${Math.floor(diff/60)}h`;
        return `${diff}m`;
    }, [mesa.updatedAt, mesa.status]);

    // LÓGICA DE NOME (Igual à anterior)
    const nomeCliente = useMemo(() => {
        if (mesa.nomesOcupantes && Array.isArray(mesa.nomesOcupantes)) {
            const nomesReais = mesa.nomesOcupantes.filter(n => n !== 'Mesa');
            if (nomesReais.length > 0) {
                return nomesReais.length > 1 
                    ? `${nomesReais[0]} (+${nomesReais.length - 1})` 
                    : nomesReais[0];
            }
        }
        return mesa.nome;
    }, [mesa.nomesOcupantes, mesa.nome]);

    return (
        <div className={`relative rounded-xl border shadow-sm flex flex-col justify-between overflow-hidden transition-all hover:shadow-md min-h-[140px] ${cardStyle}`}>
            
            {/* --- ÁREA SUPERIOR (CLIQUE PARA ABRIR/DETALHES) --- */}
            <div 
                onClick={onClick}
                className="flex-1 p-3 cursor-pointer flex flex-col relative"
            >
                {/* Cabeçalho: Número e Tempo */}
                <div className="flex justify-between items-start mb-2">
                    <span className="text-3xl font-black leading-none tracking-tighter opacity-90">{mesa.numero}</span>
                    
                    {mesa.status !== 'livre' && (
                        <span className="text-[10px] font-bold bg-white/60 px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                            <IoTime size={10}/> {tempoDecorrido}
                        </span>
                    )}
                </div>

                {mesa.status === 'livre' ? (
                    <div className="flex flex-col items-center justify-center mt-2 opacity-40">
                        <span className="text-xs font-bold uppercase tracking-widest">LIVRE</span>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold opacity-70">
                            <IoPerson size={14}/> 
                            <span>{mesa.pessoas || 1} pessoas</span>
                        </div>
                        
                        {nomeCliente && (
                            <div className="flex items-center gap-1.5 mt-1 bg-white/40 p-1 rounded-lg">
                                <IoPersonCircle size={16} className="opacity-70"/>
                                <span className="text-xs font-bold truncate max-w-[110px] uppercase text-gray-800" title={nomeCliente}>
                                    {nomeCliente}
                                </span>
                            </div>
                        )}
                        {!nomeCliente && <div className="h-6"></div>}
                    </div>
                )}
            </div>

            {/* --- RODAPÉ: PAGAR (Se Ocupada) OU EXCLUIR (Se Livre) --- */}
            {mesa.status !== 'livre' ? (
                <div className="bg-white border-t border-gray-100">
                    
                    {/* Linha do Valor */}
                    <div 
                        onClick={onClick} 
                        className="py-1 px-2 text-center border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                        <span className="text-base font-black text-gray-800 tracking-tight">
                            {formatarDinheiro(mesa.total)}
                        </span>
                    </div>

                    {/* Botão Pagar */}
                    <div 
                        onClick={(e) => {
                            e.stopPropagation();
                            onPagar();
                        }}
                        className={`py-2 px-3 flex items-center justify-center gap-2 cursor-pointer transition-colors text-white font-bold text-xs uppercase tracking-wide
                            ${mesa.status === 'pagamento' 
                                ? 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900' 
                                : 'bg-green-600 hover:bg-green-700'
                            }`}
                    >
                        <IoCashOutline size={16} />
                        <span>Pagar Conta</span>
                    </div>
                </div>
            ) : (
                // 🔥 BOTÃO DE EXCLUIR (Aparece apenas quando LIVRE)
                <div className="bg-gray-50 border-t border-gray-100 flex justify-end">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation(); // Impede de abrir a mesa ao clicar no lixo
                            if (onExcluir) onExcluir();
                        }}
                        className="w-full py-2 flex items-center justify-center gap-1 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                        title="Excluir Mesa"
                    >
                        <IoTrash size={14} />
                        <span className="text-[10px] font-bold uppercase">Excluir</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default MesaCard;