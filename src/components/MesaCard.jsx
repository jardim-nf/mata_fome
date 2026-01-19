import React, { useMemo } from 'react';
import { IoTime, IoPerson, IoRestaurant, IoCashOutline } from 'react-icons/io5';

// --- FUNÇÃO AUXILIAR PARA FORMATAR R$ ---
const formatarReal = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(valor);
};
// ---------------------------------------

const MesaCard = ({ mesa, onClick, onPagar }) => {
    
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

    return (
        // MUDANÇA AQUI: Aumentei p-2 para p-3 e mudei h-[90px] para min-h-[110px] para ficar mais quadrado/maior
        <div className={`relative rounded-xl border shadow-sm flex flex-col justify-between overflow-hidden transition-all hover:shadow-md min-h-[110px] p-3 ${cardStyle}`}>
            
            {/* --- ÁREA SUPERIOR --- */}
            <div 
                onClick={onClick}
                className="flex-1 cursor-pointer flex flex-col justify-between mb-2"
            >
                <div className="flex justify-between items-start">
                    {/* Aumentei um pouco a fonte do número */}
                    <span className="text-2xl font-black leading-none tracking-tighter">{mesa.numero}</span>
                    
                    {mesa.status !== 'livre' && (
                        <span className="text-[10px] font-bold bg-white/60 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <IoTime size={10}/> {tempoDecorrido}
                        </span>
                    )}
                </div>

                {mesa.status === 'livre' ? (
                    <span className="text-xs font-bold uppercase opacity-50 text-center mt-2">LIVRE</span>
                ) : (
                    <div className="flex items-center gap-1 text-xs font-bold opacity-80 mt-1">
                        <IoPerson size={12}/> {mesa.pessoas || '?'}
                    </div>
                )}
            </div>

            {/* --- ÁREA INFERIOR: BOTÃO DE AÇÃO / PAGAMENTO --- */}
            {mesa.status !== 'livre' ? (
                <div 
                    onClick={(e) => {
                        e.stopPropagation();
                        onPagar();
                    }}
                    // Ajustei o tamanho do botão inferior
                    className={`h-[32px] -mx-3 -mb-3 flex items-center justify-between px-3 cursor-pointer transition-colors ${
                        mesa.status === 'pagamento' 
                            ? 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                    }`}
                    title="Fechar Conta / Pagar"
                >
                    {/* MUDANÇA AQUI: Usando a função de formatação */}
                    <span className="text-sm font-black">
                        {formatarReal(mesa.total || 0)}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase">
                        <span>Pagar</span>
                        <IoCashOutline size={14} />
                    </div>
                </div>
            ) : (
                // Barra decorativa se livre
                <div onClick={onClick} className="h-[8px] -mx-3 -mb-3 bg-gray-50/50 cursor-pointer"></div>
            )}
        </div>
    );
};

export default MesaCard;