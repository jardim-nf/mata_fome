import React from 'react';
import { 
    IoPeople, 
    IoTrash, 
    IoCard, 
    IoPaperPlane, 
    IoEllipsisVertical,
    IoTimeOutline,
    IoRestaurant
} from 'react-icons/io5';

const MesaCard = ({ 
    mesa, 
    onClick, 
    onExcluir, 
    onPagar, 
    onEnviarCozinha 
}) => {
    const isLivre = mesa.status === 'livre';
    const isOcupada = mesa.status === 'ocupada';
    const isComPedido = mesa.status === 'com_pedido';
    
    // Contagem de itens que precisam ser enviados para cozinha
    const itensPendentes = mesa.itens?.reduce((acc, item) => 
        acc + ((item.status === 'pendente' || !item.status) ? 1 : 0), 0
    ) || 0;

    const hasItensPendentes = itensPendentes > 0;

    const totalFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(mesa.total || 0);

    // ==========================================
    // 🟢 MESA LIVRE (Visual Clean)
    // ==========================================
    if (isLivre) {
        return (
            <div 
                onClick={onClick}
                className="group relative h-[220px] bg-white rounded-3xl border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-3 active:scale-95"
            >
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => { e.stopPropagation(); onExcluir(); }}
                        className="p-2 text-gray-300 hover:text-red-500 bg-white rounded-full shadow-sm hover:shadow-md transition-all"
                        title="Excluir Mesa"
                    >
                        <IoTrash />
                    </button>
                </div>

                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors shadow-inner">
                    <span className="text-2xl font-black">{mesa.numero}</span>
                </div>
                
                <div className="text-center">
                    <span className="block text-sm font-bold text-gray-400 group-hover:text-blue-600 transition-colors">DISPONÍVEL</span>
                    <span className="text-[10px] text-gray-300 font-medium uppercase tracking-wider">Toque para abrir</span>
                </div>
            </div>
        );
    }

    // ==========================================
    // 🎨 TEMA DA MESA OCUPADA
    // ==========================================
    const getTheme = () => {
        if (isComPedido) {
            return {
                border: 'border-orange-100',
                bg: 'bg-white',
                header: 'bg-orange-500',
                textAccent: 'text-orange-600',
                bgAccent: 'bg-orange-50',
                status: 'Com Pedido',
                button: 'hover:bg-orange-50 text-orange-700'
            };
        }
        return {
            border: 'border-blue-100',
            bg: 'bg-white',
            header: 'bg-blue-600',
            textAccent: 'text-blue-600',
            bgAccent: 'bg-blue-50',
            status: 'Ocupada',
            button: 'hover:bg-blue-50 text-blue-700'
        };
    };

    const theme = getTheme();

    return (
        <div 
            onClick={onClick}
            className={`relative h-[220px] ${theme.bg} rounded-3xl border ${theme.border} shadow-lg shadow-gray-100 hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer flex flex-col transform hover:-translate-y-1 group`}
        >
            {/* HEADER */}
            <div className={`px-5 py-3 ${theme.header} flex justify-between items-center text-white`}>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center font-black text-sm shadow-sm">
                        {mesa.numero}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider opacity-90">{theme.status}</span>
                </div>
                
                {/* Indicador de Pendência (Piscando) */}
                {hasItensPendentes && (
                    <div className="flex items-center gap-1 bg-white text-orange-600 px-2 py-1 rounded-full text-[10px] font-black shadow-sm animate-pulse">
                        <IoRestaurant /> {itensPendentes}
                    </div>
                )}

                {/* MENU MOBILE (3 Pontinhos) */}
                <div className="md:hidden relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            document.getElementById(`menu-${mesa.id}`)?.classList.toggle('hidden');
                        }}
                        className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <IoEllipsisVertical />
                    </button>
                    {/* Dropdown */}
                    <div id={`menu-${mesa.id}`} className="hidden absolute right-0 top-8 bg-white text-gray-800 rounded-xl shadow-xl border border-gray-100 w-40 z-20 overflow-hidden">
                        <button onClick={(e) => { e.stopPropagation(); onEnviarCozinha(); document.getElementById(`menu-${mesa.id}`).classList.add('hidden'); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm font-bold flex items-center gap-2 border-b border-gray-100">
                            <IoPaperPlane className="text-orange-500" /> Cozinha
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onPagar(); document.getElementById(`menu-${mesa.id}`).classList.add('hidden'); }} className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm font-bold flex items-center gap-2">
                            <IoCard className="text-green-500" /> Pagar
                        </button>
                    </div>
                </div>
            </div>

            {/* CORPO DO CARD */}
            <div className="flex-1 flex flex-col justify-center items-center p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Atual</p>
                <h3 className="text-3xl font-black text-gray-800 tracking-tight mb-2">
                    {totalFormatado}
                </h3>
                
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 rounded-full border border-gray-100">
                        <IoPeople className="text-gray-400 text-xs" />
                        <span className="text-xs font-bold text-gray-600">{mesa.pessoas || 1}</span>
                    </div>
                    {/* Tempo (Simulado ou Real se tiver no banco) */}
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 rounded-full border border-gray-100">
                        <IoTimeOutline className="text-gray-400 text-xs" />
                        <span className="text-xs font-bold text-gray-600">--:--</span>
                    </div>
                </div>
            </div>

            {/* FOOTER ACTIONS (DESKTOP) - SEM O BOTÃO 'ADICIONAR' */}
            <div className="hidden md:grid grid-cols-2 border-t border-gray-100 divide-x divide-gray-100 h-12 bg-gray-50/50">
                {/* Botão Cozinha (Habilitado apenas se tiver pendências ou se quiser forçar envio) */}

                {/* Botão Pagar */}
                <button
                    onClick={(e) => { e.stopPropagation(); onPagar(); }}
                    className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase text-gray-600 hover:bg-green-50 hover:text-green-600 transition-colors"
                >
                    <IoCard className="text-lg text-green-500" />
                    <span>Fechar</span>
                </button>
            </div>

            {/* FOOTER MOBILE (Botão Único Grande) */}
            <div className="md:hidden">
                <button
                    onClick={(e) => { e.stopPropagation(); onPagar(); }}
                    className={`w-full py-3 flex items-center justify-center gap-2 text-white font-bold text-sm ${theme.header} hover:opacity-90 transition-opacity`}
                >
                    <IoCard /> Pagar {totalFormatado}
                </button>
            </div>
        </div>
    );
};

export default MesaCard;