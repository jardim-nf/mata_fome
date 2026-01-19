import React, { useMemo } from 'react';
import { IoTime, IoPerson, IoRestaurant, IoCashOutline } from 'react-icons/io5';

// Helper de formatação interna
const formatarDinheiro = (val) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(val || 0);
};

const MesaCard = ({ mesa, onClick, onPagar }) => {
    
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

    return (
        <div className={`relative rounded-xl border shadow-sm flex flex-col justify-between overflow-hidden transition-all hover:shadow-md min-h-[115px] ${cardStyle}`}>
            
            {/* --- ÁREA SUPERIOR (CLIQUE PARA ABRIR A MESA) --- */}
            <div 
                onClick={onClick}
                className="flex-1 p-3 cursor-pointer flex flex-col justify-between"
            >
                <div className="flex justify-between items-start">
                    <span className="text-2xl font-black leading-none tracking-tighter">{mesa.numero}</span>
                    
                    {mesa.status !== 'livre' && (
                        <span className="text-[10px] font-bold bg-white/60 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <IoTime size={10}/> {tempoDecorrido}
                        </span>
                    )}
                </div>

                {mesa.status === 'livre' ? (
                    <div className="flex flex-col items-center justify-center mt-1 opacity-40">
                        <span className="text-xs font-bold uppercase">LIVRE</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1 text-xs font-bold opacity-80 mt-1">
                        <IoPerson size={12}/> {mesa.pessoas || '?'}
                    </div>
                )}
            </div>

            {/* --- ÁREA INFERIOR (BOTÃO DE PAGAR EXCLUSIVO) --- */}
            {mesa.status !== 'livre' ? (
                <div 
                    onClick={(e) => {
                        e.stopPropagation(); // Impede que o clique abra a mesa
                        onPagar();
                    }}
                    className={`h-[36px] flex items-center justify-between px-3 cursor-pointer transition-colors border-t border-black/5 ${
                        mesa.status === 'pagamento' 
                            ? 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900' // Amarelo se pediu conta
                            : 'bg-green-600 hover:bg-green-700 text-white' // Verde padrão
                    }`}
                    title="Clique aqui para fechar a conta"
                >
                    {/* Valor Formatado */}
                    <span className="text-sm font-black tracking-tight">
                        {formatarDinheiro(mesa.total)}
                    </span>
                    
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase opacity-90">
                        <span>Pagar</span>
                        <IoCashOutline size={16} />
                    </div>
                </div>
            ) : (
                // Barra decorativa cinza quando livre
                <div onClick={onClick} className="h-[12px] bg-gray-100 cursor-pointer hover:bg-gray-200 transition-colors"></div>
            )}
        </div>
    );
};

export default MesaCard;