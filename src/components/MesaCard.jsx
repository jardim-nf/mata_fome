import React from 'react';
import { 
    IoPeople, 
    IoAdd, 
    IoTrash, 
    IoCard, 
    IoPaperPlane, 
    IoTimeOutline,
    IoCheckmarkCircle,
    IoRestaurant,
    IoEllipsisVertical
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
                buttonColor: 'text-blue-600',
                buttonHover: 'hover:bg-blue-500 hover:text-white',
                pagamentoBg: 'bg-gradient-to-r from-blue-500 to-blue-600',
                pagamentoHover: 'hover:from-blue-600 hover:to-blue-700'
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
                buttonColor: 'text-red-600',
                buttonHover: 'hover:bg-red-500 hover:text-white',
                pagamentoBg: 'bg-gradient-to-r from-red-500 to-red-600',
                pagamentoHover: 'hover:from-red-600 hover:to-red-700'
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
            buttonColor: 'text-green-600',
            buttonHover: 'hover:bg-green-500 hover:text-white',
            pagamentoBg: 'bg-gradient-to-r from-green-500 to-green-600',
            pagamentoHover: 'hover:from-green-600 hover:to-green-700'
        };
    };

    const theme = getTheme();
    const hasPendingItems = itensPendentes > 0;

    return (
        <div 
            onClick={onClick}
            className={`relative min-h-[180px] ${theme.bg} rounded-2xl border-2 ${theme.border} shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer flex flex-col transform hover:scale-[1.02] group`}
        >
            {/* CABEÇALHO COM STATUS E BOTÃO DE AÇÕES */}
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
                
                <div className="flex items-center gap-2">
                    {hasPendingItems && (
                        <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                            <span className="text-xs text-white font-medium">{itensPendentes}</span>
                        </div>
                    )}
                    
                    {/* MENU DE AÇÕES PARA MOBILE */}
                    <div className="relative md:hidden">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                // Mostrar menu de ações no mobile
                                const actionsMenu = document.getElementById(`actions-menu-${mesa.id}`);
                                if (actionsMenu) {
                                    actionsMenu.classList.toggle('hidden');
                                }
                            }}
                            className="p-1 text-white hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <IoEllipsisVertical className="text-lg" />
                        </button>
                        
                        {/* MENU FLUTUANTE PARA AÇÕES NO MOBILE */}
                        <div 
                            id={`actions-menu-${mesa.id}`}
                            className="hidden absolute right-0 top-8 bg-white rounded-xl shadow-2xl border border-gray-200 z-10 min-w-[140px]"
                        >
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAdicionarComanda();
                                    document.getElementById(`actions-menu-${mesa.id}`)?.classList.add('hidden');
                                }}
                                className="w-full text-left px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-600 border-b border-gray-100 flex items-center gap-2"
                            >
                                <IoAdd className="text-lg" />
                                <span className="text-sm font-medium">Adicionar</span>
                            </button>
                            
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEnviarCozinha();
                                    document.getElementById(`actions-menu-${mesa.id}`)?.classList.add('hidden');
                                }}
                                className="w-full text-left px-4 py-3 text-gray-700 hover:bg-orange-50 hover:text-orange-600 border-b border-gray-100 flex items-center gap-2"
                            >
                                <IoPaperPlane className="text-lg" />
                                <span className="text-sm font-medium">Cozinha</span>
                            </button>
                            
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPagar();
                                    document.getElementById(`actions-menu-${mesa.id}`)?.classList.add('hidden');
                                }}
                                className="w-full text-left px-4 py-3 text-gray-700 hover:bg-green-50 hover:text-green-600 flex items-center gap-2 font-semibold"
                            >
                                <IoCard className="text-lg" />
                                <span className="text-sm">Fechar Conta</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* CONTEÚDO PRINCIPAL */}
            <div className="flex-1 p-4 flex flex-col justify-center">
                {/* Valor Principal - DESTAQUE PARA O VALOR */}
                <div className="text-center mb-4">
                    <h3 className={`text-2xl font-black ${theme.textColor} mb-1`}>
                        {totalFormatado}
                    </h3>
                    <p className={`text-xs ${theme.lightText} font-medium`}>Total da conta</p>
                </div>

                {/* Informações Secundárias */}
                <div className="space-y-2 text-center">
                    <div className={`flex items-center justify-center gap-1 ${theme.lightText} text-sm font-medium`}>
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

            {/* AÇÕES NA PARTE INFERIOR - VISÍVEL APENAS NO DESKTOP */}
            <div className="hidden md:grid grid-cols-3 border-t border-white/30 divide-x divide-white/30 h-12 bg-white/20">
                {/* BOTÃO ADICIONAR PEDIDO */}
                <button
                    onClick={(e) => { e.stopPropagation(); onAdicionarComanda(); }}
                    className="flex flex-col items-center justify-center text-black hover:bg-white/30 transition-colors relative group/btn"
                    title="Adicionar itens ao pedido"
                >
                    <IoAdd className="text-lg mb-1" />
                    <span className="text-[10px] font-medium text-black"> Pedidos</span>
                </button>
                {/* BOTÃO PAGAR - DESTAQUE */}
                <button
                    onClick={(e) => { e.stopPropagation(); onPagar(); }}
                    className="flex flex-col items-center justify-center text-black hover:bg-white/30 transition-colors relative group/btn font-semibold bg-white/10"
                    title="Fechar conta e pagar"
                >
                    <IoCard className="text-lg mb-1" />
                    <span className="text-[10px] font-medium text-black ">Pagar</span>
                </button>
            </div>

            {/* BOTÃO DE PAGAMENTO FIXO PARA MOBILE - COM CORES POR STATUS */}
            <div className="md:hidden border-t border-white/30">
                <button
                    onClick={(e) => { e.stopPropagation(); onPagar(); }}
                    className={`w-full py-3 flex items-center justify-center gap-2 text-white font-semibold ${theme.pagamentoBg} ${theme.pagamentoHover} transition-all active:scale-95`}
                >
                    <IoCard className="text-lg" />
                    <span>FECHAR CONTA - {totalFormatado}</span>
                </button>
            </div>
        </div>
    );
};

export default MesaCard;