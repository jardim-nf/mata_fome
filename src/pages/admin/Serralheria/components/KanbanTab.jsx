import React from 'react';
import { IoChevronBackOutline, IoChevronForwardOutline, IoEyeOutline } from 'react-icons/io5';

const KanbanTab = ({ pedidos, setSelectedOS, handleUpdateStatus, STATUS_FLOW, STATUS_OS }) => {
  const getColPedidos = (status) => pedidos.filter(p => p.status === status);

  const moveOS = async (id, currentStatus, direction) => {
    const currentIndex = STATUS_FLOW.indexOf(currentStatus);
    let nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < STATUS_FLOW.length) {
      await handleUpdateStatus(id, STATUS_FLOW[nextIndex]);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4 items-start">
      {STATUS_FLOW.map((status) => {
        const colList = getColPedidos(status);
        const config = STATUS_OS[status] || { label: status, color: 'bg-slate-100' };

        return (
          <div key={status} className="kanban-column p-3 flex flex-col gap-3 min-w-[200px]">
            {/* Header Coluna */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-[10px] font-black uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${config.color.split(' ')[0]}`} />
                {config.label}
              </span>
              <span className="text-[9px] bg-slate-200 text-slate-700 font-extrabold px-1.5 py-0.5 rounded-md">
                {colList.length}
              </span>
            </div>

            {/* Lista de Cards */}
            <div className="flex flex-col gap-2.5 max-h-[70vh] overflow-y-auto pr-1">
              {colList.length === 0 ? (
                <div className="py-8 text-center text-[10px] text-slate-400 font-semibold italic">
                  Vazia
                </div>
              ) : (
                colList.map((os) => {
                  const currentIndex = STATUS_FLOW.indexOf(os.status);
                  const hasPrev = currentIndex > 0;
                  const hasNext = currentIndex < STATUS_FLOW.length - 1;

                  return (
                    <div 
                      key={os.id} 
                      className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-sm hover:shadow-md hover:border-slate-300 transition-all text-left flex flex-col gap-1.5 relative group"
                    >
                      {/* ID / Ações Rápidas */}
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black text-slate-400">#{os.id.substring(0, 5).toUpperCase()}</span>
                        <button
                          onClick={() => setSelectedOS(os)}
                          className="text-slate-400 hover:text-slate-900 transition-all opacity-0 group-hover:opacity-100 flex items-center gap-0.5 text-[9px] font-bold"
                        >
                          <IoEyeOutline size={12} /> Ver
                        </button>
                      </div>

                      {/* Info Principal */}
                      <div>
                        <h4 className="text-[11px] font-extrabold text-slate-900 truncate" title={os.cliente.nome}>
                          {os.cliente.nome}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-semibold truncate capitalize">
                          🔨 {os.projeto.modelo}
                        </p>
                      </div>

                      {/* Dimensões & Preço */}
                      <div className="flex justify-between items-center text-[9px] font-bold border-t border-slate-100 pt-1.5 mt-0.5">
                        <span className="text-slate-400 font-mono">
                          📏 {os.projeto.largura}x{os.projeto.altura} mm
                        </span>
                        <span className="text-slate-900 font-mono">
                          R$ {os.projeto.precoVenda.toFixed(0)}
                        </span>
                      </div>

                      {/* Controles de Movimentação */}
                      <div className="flex justify-between items-center pt-1.5 border-t border-slate-100/60 mt-0.5">
                        <button
                          disabled={!hasPrev}
                          onClick={() => moveOS(os.id, os.status, -1)}
                          className="p-1 text-slate-400 hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-400 transition-all"
                        >
                          <IoChevronBackOutline size={12} />
                        </button>
                        <span className="text-[8px] text-slate-400 font-black uppercase">Mover</span>
                        <button
                          disabled={!hasNext}
                          onClick={() => moveOS(os.id, os.status, 1)}
                          className="p-1 text-slate-400 hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-400 transition-all"
                        >
                          <IoChevronForwardOutline size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanTab;
