import React, { useState } from 'react';
import { IoChevronDown, IoChevronUp } from "react-icons/io5";

const LegendaCores = () => {
    const [aberta, setAberta] = useState(false);
    return (
        <div className="mb-3">
            <button 
                onClick={() => setAberta(!aberta)} 
                className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors px-1 py-1 outline-none"
            >
                {aberta ? <IoChevronUp size={14} /> : <IoChevronDown size={14} />} Legenda de cores
            </button>
            {aberta && (
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 bg-white p-2.5 sm:p-3 rounded-2xl shadow-sm border border-gray-200 mt-1.5 text-xs font-bold text-gray-700 animate-[fadeIn_0.2s_ease-out]">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-white border-2 border-gray-300"></div> Livre</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-600 shadow-sm"></div> Ocupada</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-600 shadow-sm"></div> Com Pedido</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-yellow-400 shadow-sm"></div> Pagamento</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-orange-500 shadow-sm animate-pulse"></div> Ociosa</div>
                </div>
            )}
        </div>
    );
};

export default LegendaCores;
