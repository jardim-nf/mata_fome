import React, { useState } from 'react';
import { IoBuildOutline } from 'react-icons/io5';

const KanbanTab = ({ 
  pedidos, 
  setSelectedOS, 
  handleUpdateStatus, 
  STATUS_FLOW, 
  STATUS_OS 
}) => {
  const [searchClienteQuery, setSearchClienteQuery] = useState('');

  const hoje = new Date();
  const osAtrasadas = pedidos.filter(p => {
    if (p.status === 'concluido' || p.status === 'orcamento') return false;
    if (!p.instalacao?.data) return false;
    const dataInst = new Date(p.instalacao.data + 'T00:00:00');
    return dataInst < hoje;
  });

  return (
    <div className="space-y-4">
      <div className="glass-card p-3 sm:p-4 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <IoBuildOutline /> Pipeline de OS
          </h2>
          <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">{pedidos.length} ordem{pedidos.length !== 1 ? 'ns' : ''} de serviço</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="🔍 Buscar cliente ou projeto..."
            value={searchClienteQuery}
            onChange={e => setSearchClienteQuery(e.target.value)}
            className="glass-input flex-1 sm:w-56 text-xs py-2"
          />
          {osAtrasadas.length > 0 && (
            <span className="px-2 py-1 bg-red-50 border border-red-200 text-red-700 rounded-lg text-[9px] font-black uppercase whitespace-nowrap animate-pulse">
              ⚠️ {osAtrasadas.length} atrasada{osAtrasadas.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Colunas do Kanban */}
      <div className="flex lg:grid lg:grid-cols-5 gap-3 sm:gap-4 overflow-x-auto pb-4 snap-x lg:overflow-x-visible lg:pb-0 scrollbar-thin">
        {STATUS_FLOW.map(colId => {
          const kanbanQuery = searchClienteQuery.toLowerCase().trim();
          const colOS = pedidos.filter(p => {
            if (p.status !== colId) return false;
            if (!kanbanQuery) return true;
            return (p.cliente?.nome || '').toLowerCase().includes(kanbanQuery) || 
                   (p.projeto?.modelo || '').toLowerCase().includes(kanbanQuery) ||
                   (p.instalacao?.vidraceiro || '').toLowerCase().includes(kanbanQuery);
          });
          
          return (
            <div key={colId} className="flex flex-col bg-slate-100/40 border border-slate-200/60 rounded-2xl p-3 min-h-[400px] min-w-[260px] sm:min-w-[300px] lg:min-w-0 snap-align-start">
              {/* Header Coluna */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                <span className="text-xs font-black uppercase text-slate-700">
                  {STATUS_OS[colId]?.label}
                </span>
                <span className="bg-slate-200/80 border border-slate-300 text-slate-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                  {colOS.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[500px]">
                {colOS.map(os => {
                  const isOverdue = os.instalacao?.data && new Date(os.instalacao.data + 'T00:00:00') < hoje && os.status !== 'concluido';
                  const daysUntil = os.instalacao?.data ? Math.ceil((new Date(os.instalacao.data + 'T00:00:00') - hoje) / (1000 * 60 * 60 * 24)) : null;
                  
                  return (
                    <div
                      key={os.id}
                      onClick={() => setSelectedOS(os)}
                      className={`glass-card p-3 border-l-4 ${isOverdue ? 'border-l-red-500 animate-pulse' : STATUS_OS[os.status]?.borderCol || 'border-l-slate-600'} cursor-pointer hover:scale-[1.02] transition-all relative group shadow-sm`}
                    >
                      <h4 className="font-extrabold text-slate-800 text-xs truncate pr-4">{os.cliente?.nome}</h4>
                      <p className="text-[9px] text-slate-500 uppercase font-black mt-1 tracking-wider">{os.projeto?.modelo}</p>
                      <p className="text-[10px] font-mono font-bold text-slate-800 mt-0.5">
                        {os.projeto?.largura > 10 ? (os.projeto.largura / 1000).toFixed(2) : os.projeto?.largura?.toFixed(2)}x
                        {os.projeto?.altura > 10 ? (os.projeto.altura / 1000).toFixed(2) : os.projeto?.altura?.toFixed(2)}m
                      </p>
                      
                      <div className="space-y-1.5 mt-2.5 pt-2 border-t border-slate-100 text-[9px]">
                        <div className="flex justify-between items-center text-slate-500 font-semibold">
                          <span className="truncate max-w-[90px]">👷 {os.instalacao?.vidraceiro || 'Sem instalador'}</span>
                          <span className="text-emerald-600 font-black font-mono text-[10px]">R$ {Number(os.projeto?.precoVenda || 0).toFixed(0)}</span>
                        </div>
                        {os.instalacao?.data && (
                          <div className="flex items-center justify-between gap-1">
                            <div className={`flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded border w-fit ${isOverdue ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-100 text-slate-800 border-slate-200'}`}>
                              📅 {new Date(os.instalacao.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </div>
                            {daysUntil !== null && os.status !== 'concluido' && (
                              <span className={`text-[7px] font-black px-1 py-0.5 rounded ${
                                isOverdue ? 'bg-red-100 text-red-700' : daysUntil <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-500'
                              }`}>
                                {isOverdue ? `${Math.abs(daysUntil)}d atraso` : daysUntil === 0 ? 'HOJE' : `${daysUntil}d`}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Seletor Rápido de Status */}
                      <div className="mt-2.5 flex justify-end gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 print:hidden">
                        {STATUS_FLOW.indexOf(os.status) > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateStatus(os.id, STATUS_FLOW[STATUS_FLOW.indexOf(os.status) - 1]);
                            }}
                            className="w-5 h-5 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-200 hover:border-slate-400 hover:text-black text-slate-500 transition-all text-[9px] font-bold"
                            title="Voltar Status"
                          >
                            ◀
                          </button>
                        )}
                        {STATUS_FLOW.indexOf(os.status) < STATUS_FLOW.length - 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateStatus(os.id, STATUS_FLOW[STATUS_FLOW.indexOf(os.status) + 1]);
                            }}
                            className="w-5 h-5 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-200 hover:border-slate-400 hover:text-black text-slate-500 transition-all text-[9px] font-bold"
                            title="Avançar Status"
                          >
                            ▶
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {colOS.length === 0 && (
                  <div className="py-8 text-center text-[10px] text-slate-400 font-semibold italic border-2 border-dashed border-slate-200 rounded-xl">
                    Vazio
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KanbanTab;
