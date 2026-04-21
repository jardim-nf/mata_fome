import React, { useState } from 'react';
import { useAdminMenuData } from '../hooks/useAdminMenuData';
import { IoAlertCircle, IoClose, IoWarningOutline } from 'react-icons/io5';

const StockAlertWidget = ({ estabelecimentoId }) => {
  const { menuItems, loading } = useAdminMenuData(estabelecimentoId);
  const [dismissed, setDismissed] = useState(false);

  if (loading || dismissed) return null;

  // Filtrar itens ativos e com estoque crítico/esgotado
  const criticalItems = menuItems.filter(item => {
    if (item.ativo === false) return false;
    
    // Considerando o item principal (que já consolida estoques se houver variações no hook)
    const e = Number(item.estoque) || 0;
    const m = Number(item.estoqueMinimo) || 5; // Padrão assumido de 5

    return e <= m; // Estoque zero ou abaixo/igual do mínimo
  });

  if (criticalItems.length === 0) return null;

  const esgotados = criticalItems.filter(i => (Number(i.estoque) || 0) <= 0);
  const baixos = criticalItems.filter(i => (Number(i.estoque) || 0) > 0);

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-3xl p-5 sm:p-6 mb-8 relative shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
      <button 
        onClick={() => setDismissed(true)}
        className="absolute top-4 right-4 text-orange-400 hover:text-orange-600 transition-colors p-2 hover:bg-orange-100 rounded-full"
      >
        <IoClose size={20} />
      </button>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
          <IoAlertCircle className="text-2xl animate-pulse" />
        </div>
        <div>
          <h3 className="text-xl font-black text-orange-900 tracking-tight">
            Atenção ao seu estoque!
          </h3>
          <p className="text-sm font-medium text-orange-800/80 mt-1">
             Você tem <strong className="text-orange-700">{criticalItems.length} produto(s)</strong> precisando de reposição urgente.
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {esgotados.map(item => (
          <div key={`esg-${item.id}`} className="bg-white/60 border border-red-200 rounded-xl p-3 flex justify-between items-center">
             <div className="truncate pr-2">
               <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded mr-2">ESGOTADO</span>
               <span className="text-sm font-bold text-slate-700 truncate">{item.nome}</span>
             </div>
             <span className="text-red-500 font-extrabold flex-shrink-0">0 unid</span>
          </div>
        ))}
        {baixos.map(item => (
          <div key={`baix-${item.id}`} className="bg-white/60 border border-orange-200 rounded-xl p-3 flex justify-between items-center">
             <div className="truncate pr-2">
               <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded mr-2">BAIXO</span>
               <span className="text-sm font-bold text-slate-700 truncate">{item.nome}</span>
             </div>
             <span className="text-orange-600 font-extrabold flex-shrink-0">{item.estoque} unid</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StockAlertWidget;
