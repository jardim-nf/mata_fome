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
    const isOcupada = mesa.status === 'ocupada';
    const isComPedido = mesa.status === 'com_pedido';
    
    const itensPendentes = mesa.itens?.reduce((acc, item) => 
        acc + ((item.status === 'pendente' || !item.status) ? 1 : 0), 0
    ) || 0;

    const totalFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(mesa.total || 0);

    // ==========================================
    // 🟢 MESA LIVRE - VERDE
    // ==========================================
    if (isLivre) {
        return (
            <div 
                onClick={onClick}
                className="group relative h-[200px] bg-gradient-to-br from-green-50 to-green-100 rounded-2xl border-2 border-green-200 hover:border-green-400 hover:bg-green-200 cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-3 transform hover:scale-[1.02]"
            >
                <button
                    onClick={(e) => { e.stopPropagation(); onExcluir(); }}
                    className="absolute top-3 right-3 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    title="Excluir Mesa"
                >
                    <IoTrash className="text-lg" />
                </button>

                <div className="w-16 h-16 bg-green-200 rounded-full flex items-center justify-center text-green-700 group-hover:bg-green-300 group-hover:text-green-800 transition-all">
                    <span className="text-xl font-bold">{mesa.numero}</span>
                </div>
                
                <div className="text-center">
                    <span className="block text-sm font-semibold text-green-700">Mesa {mesa.numero}</span>
                    <span className="text-xs text-green-600 mt-1">Clique para abrir mesa</span>
                </div>
            </div>
        );
    }

    // ==========================================
    // 🎨 DEFINIR TEMA BASEADO NO STATUS
    // ==========================================
    const getTheme = () => {
        if (isComPedido) {
            // 🔵 MESA COM PEDIDO - AZUL
            return {
                border: 'border-blue-200',
                bg: 'bg-gradient-to-br from-blue-50 to-blue-100',
                statusColor: 'text-blue-700',
                statusBg: 'bg-blue-500',
                statusText: 'Com Pedido',
                headerBg: 'bg-blue-500',
                textColor: 'text-blue-900',
                lightText: 'text-blue-700',
                hoverBg: 'hover:bg-blue-200'
            };
        } else if (isOcupada) {
            // 🔴 MESA OCUPADA - VERMELHO
            return {
                border: 'border-red-200',
                bg: 'bg-gradient-to-br from-red-50 to-red-100',
                statusColor: 'text-red-700',
                statusBg: 'bg-red-500',
                statusText: 'Ocupada',
                headerBg: 'bg-red-500',
                textColor: 'text-red-900',
                lightText: 'text-red-700',
                hoverBg: 'hover:bg-red-200'
            };
        }
        
        // 🟢 Fallback para mesa livre (já tratado acima)
        return {
            border: 'border-green-200',
            bg: 'bg-gradient-to-br from-green-50 to-green-100',
            statusColor: 'text-green-700',
            statusBg: 'bg-green-500',
            statusText: 'Livre',
            headerBg: 'bg-green-500',
            textColor: 'text-green-900',
            lightText: 'text-green-700',
            hoverBg: 'hover:bg-green-200'
        };
    };

    const theme = getTheme();
    const hasPendingItems = itensPendentes > 0;

    return (
        <div 
            onClick={onClick}
            className={`relative h-[200px] ${theme.bg} rounded-2xl border-2 ${theme.border} shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer flex flex-col transform hover:scale-[1.02] group`}
        >
            {/* CABEÇALHO COM STATUS */}
            <div className={`px-4 py-3 ${theme.headerBg} flex justify-between items-center`}>
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 bg-white rounded-lg flex items-center justify-center ${theme.textColor} font-bold shadow-sm`}>
                        {mesa.numero}
                    </div>
                    <div>
                        <span className={`text-sm font-semibold text-white`}>
                            {theme.statusText}
                        </span>
                    </div>
                </div>
                
                {hasPendingItems && (
                    <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        <span className="text-xs text-white font-medium">{itensPendentes}</span>
                    </div>
                )}
            </div>

            {/* CONTEÚDO PRINCIPAL */}
            <div className="flex-1 p-4 flex flex-col justify-center">
                {/* Valor Principal */}
                <div className="text-center mb-3">
                    <h3 className={`text-2xl font-bold ${theme.textColor}`}>
                        {totalFormatado}
                    </h3>
                </div>

                {/* Informações Secundárias */}
                <div className="space-y-2 text-center">
                    <div className={`flex items-center justify-center gap-1 ${theme.lightText} text-sm`}>
                        <IoPeople className={theme.lightText} />
                        <span>{mesa.pessoas || 1} {mesa.pessoas === 1 ? 'pessoa' : 'pessoas'}</span>
                    </div>
                    
                    {mesa.nomesOcupantes && mesa.nomesOcupantes.length > 0 && mesa.nomesOcupantes.find(n => n !== 'Mesa') && (
                        <div className={`bg-white/50 rounded-lg px-3 py-1 border ${theme.border}`}>
                            <span className={`text-sm font-medium ${theme.textColor} truncate block`}>
                                {mesa.nomesOcupantes.find(n => n !== 'Mesa')}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* AÇÕES NA PARTE INFERIOR */}
            <div className="grid grid-cols-3 border-t border-white/30 divide-x divide-white/30 h-12 bg-white/20">
                {/* BOTÃO ADICIONAR PEDIDO */}
                <button
                    onClick={(e) => { e.stopPropagation(); onAdicionarComanda(); }}
                    className="flex flex-col items-center justify-center text-white hover:bg-white/30 transition-colors relative group/btn"
                    title="Adicionar itens ao pedido"
                >
                    <IoAdd className="text-lg mb-1" />
                    <span className="text-[10px] font-medium text-white">+ Pedidos</span>
                    
                    {/* Tooltip */}
                    <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                        Adicionar itens
                        <div className="absolute bottom-[-4px] left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                    </div>
                </button>

                {/* BOTÃO ENVIAR PARA COZINHA */}
                <button
                    onClick={(e) => { e.stopPropagation(); onEnviarCozinha(); }}
                    className="flex flex-col items-center justify-center text-white hover:bg-white/30 transition-colors relative group/btn"
                    title="Enviar pedidos para cozinha"
                >
                    <IoPaperPlane className="text-lg mb-1" />
                    <span className="text-[10px] font-medium text-white">Cozinha</span>
                    
                    {/* Tooltip */}
                    <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                        Enviar para cozinha
                        <div className="absolute bottom-[-4px] left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-800 rotate-45"></div>
                    </div>
                </button>

                {/* BOTÃO PAGAR */}
                <button
                    onClick={(e) => { e.stopPropagation(); onPagar(); }}
                    className="flex flex-col items-center justify-center text-white hover:bg-white/30 transition-colors relative group/btn"
                    title="Fechar conta e pagar"
                >
                    <IoCard className="text-lg mb-1" />
                    <span className="text-[10px] font-medium text-white">Pagar</span>
                    
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