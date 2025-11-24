import React from 'react';
import { 
    IoPeople, 
    IoAdd, 
    IoTrash, 
    IoCard, 
    IoPaperPlane, 
    IoTimeOutline,
    IoCheckmarkCircle,
    IoRestaurant
} from 'react-icons/io5';

const MesaCard = ({ 
    mesa, 
    onClick, 
    onExcluir, 
    onPagar, 
    onAdicionarComanda,
    onEnviarCozinha, 
    showComandasInfo = false 
}) => {
    const isLivre = mesa.status === 'livre';
    const itensPendentes = mesa.itens?.reduce((acc, item) => 
        acc + ((item.status === 'pendente' || !item.status) ? 1 : 0), 0
    ) || 0;

    const totalFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(mesa.total || 0);

    // ==========================================
    // MESA LIVRE
    // ==========================================
    if (isLivre) {
        return (
            <div 
                onClick={onClick}
                className="group relative h-[200px] bg-white rounded-2xl border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-3 transform hover:scale-[1.02]"
            >
                <button
                    onClick={(e) => { e.stopPropagation(); onExcluir(); }}
                    className="absolute top-3 right-3 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    title="Excluir Mesa"
                >
                    <IoTrash className="text-lg" />
                </button>

                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition-all">
                    <span className="text-xl font-bold">{mesa.numero}</span>
                </div>
                
                <div className="text-center">
                    <span className="block text-sm font-semibold text-gray-500">Mesa {mesa.numero}</span>
                    <span className="text-xs text-gray-400 mt-1">Clique para abrir mesa</span>
                </div>
            </div>
        );
    }

    // ==========================================
    // MESA OCUPADA
    // ==========================================
    const isPending = itensPendentes > 0;
    
    const theme = 
        mesa.status === 'ocupada' && !isPending ? {
            // 🔴 Mesa OCUPADA
            border: 'border-red-200',
            bg: 'bg-white',
            statusColor: 'text-red-600',
            statusBg: 'bg-red-500',
            statusText: 'Ocupada'
        } : 
        isPending ? {
            // 🟠 Mesa COM PEDIDO
            border: 'border-orange-200',
            bg: 'bg-white',
            statusColor: 'text-orange-600',
            statusBg: 'bg-orange-500',
            statusText: 'Com Pedido'
        } : {
            // 🔴 Fallback
            border: 'border-red-200',
            bg: 'bg-white',
            statusColor: 'text-red-600',
            statusBg: 'bg-red-500',
            statusText: 'Ocupada'
        };

    return (
        <div 
            onClick={onClick}
            className={`relative h-[200px] ${theme.bg} rounded-2xl border ${theme.border} shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer flex flex-col transform hover:scale-[1.02] group`}
        >
            {/* CABEÇALHO SIMPLES */}
            <div className="px-4 py-3 flex justify-between items-center border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 ${theme.statusBg} rounded-lg flex items-center justify-center text-white font-bold`}>
                        {mesa.numero}
                    </div>
                    <div>
                        <span className={`text-sm font-semibold ${theme.statusColor}`}>
                            {theme.statusText}
                        </span>
                    </div>
                </div>
                
                {isPending && (
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-orange-600 font-medium">{itensPendentes}</span>
                    </div>
                )}
            </div>

            {/* CONTEÚDO PRINCIPAL */}
            <div className="flex-1 p-4 flex flex-col justify-center">
                {/* Valor Principal */}
                <div className="text-center mb-3">
                    <h3 className="text-2xl font-bold text-gray-900">
                        {totalFormatado}
                    </h3>
                </div>

                {/* Informações Secundárias */}
                <div className="space-y-2 text-center">
                    <div className="flex items-center justify-center gap-1 text-gray-600 text-sm">
                        <IoPeople className="text-gray-400" />
                        <span>{mesa.pessoas || 1} {mesa.pessoas === 1 ? 'pessoa' : 'pessoas'}</span>
                    </div>
                    
{mesa.nomesOcupantes && mesa.nomesOcupantes.length > 0 && mesa.nomesOcupantes.find(n => n !== 'Mesa') && (
    <div className="bg-gray-100 rounded-lg px-3 py-1">
        <span className="text-sm font-medium text-gray-700 truncate block">
            {mesa.nomesOcupantes.find(n => n !== 'Mesa')}
        </span>
    </div>
)}
                </div>
            </div>

            {/* AÇÕES COM LABELS CLARAS */}
            <div className="grid grid-cols-3 border-t border-gray-100 divide-x divide-gray-100 h-12 bg-gray-50">
                {/* BOTÃO ADICIONAR */}
                <button
                    onClick={(e) => { e.stopPropagation(); onAdicionarComanda(); }}
                    className="flex flex-col items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors relative group/btn"
                    title="Adicionar itens ao pedido"
                >
                    <IoAdd className="text-lg mb-1" />
                    <span className="text-[10px] font-medium text-blue-600">+ Pedidos</span>
                    
                    {/* Tooltip */}
                    <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                        Adicionar itens
                        <div className="absolute bottom-[-4px] left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                    </div>
                </button>
                {/* BOTÃO PAGAR */}
                <button
                    onClick={(e) => { e.stopPropagation(); onPagar(); }}
                    className="flex flex-col items-center justify-center text-green-600 hover:bg-green-50 transition-colors relative group/btn"
                    title="Fechar conta e pagar"
                >
                    <IoCard className="text-lg mb-1" />
                    <span className="text-[10px] font-medium text-green-600">Pagar</span>
                    
                    {/* Tooltip */}
                    <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                        Fechar conta
                        <div className="absolute bottom-[-4px] left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                    </div>
                </button>
            </div>
        </div>
    );
};

export default MesaCard;