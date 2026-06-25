import React from 'react';
import { 
  IoCashOutline, 
  IoBuildOutline, 
  IoDocumentTextOutline, 
  IoTimeOutline, 
  IoChevronForwardOutline 
} from 'react-icons/io5';

const DashboardTab = ({ pedidos, setSelectedOS, STATUS_OS }) => {
  // Calcular métricas
  const totalFaturado = pedidos
    .filter(p => p.status === 'concluido' || p.status === 'producao' || p.status === 'instalacao')
    .reduce((sum, p) => sum + (p.projeto?.precoVenda || 0), 0);

  const totalProjetos = pedidos.filter(p => p.status === 'concluido').length;
  const totalOrcamentos = pedidos.filter(p => p.status === 'orcamento').length;
  const totalEmProducao = pedidos.filter(p => p.status === 'producao' || p.status === 'pintura' || p.status === 'instalacao').length;

  // Filtrar os 5 pedidos mais recentes
  const recentes = pedidos.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Grid de Cards de Estatísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 sm:p-5 flex items-center gap-4 text-left">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-lg sm:text-xl bg-amber-500/10 text-amber-600">
            <IoCashOutline />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Faturamento Ativo</span>
            <span className="text-sm sm:text-lg font-black text-slate-900 font-mono">
              R$ {totalFaturado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="glass-card p-4 sm:p-5 flex items-center gap-4 text-left">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-lg sm:text-xl bg-blue-500/10 text-blue-600">
            <IoBuildOutline />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Em Fabricação</span>
            <span className="text-sm sm:text-lg font-black text-slate-900 font-mono">{totalEmProducao} OS</span>
          </div>
        </div>

        <div className="glass-card p-4 sm:p-5 flex items-center gap-4 text-left">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-lg sm:text-xl bg-emerald-500/10 text-emerald-600">
            <IoDocumentTextOutline />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Orçamentos</span>
            <span className="text-sm sm:text-lg font-black text-slate-900 font-mono">{totalOrcamentos} abertos</span>
          </div>
        </div>

        <div className="glass-card p-4 sm:p-5 flex items-center gap-4 text-left">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-lg sm:text-xl bg-slate-900/10 text-slate-800">
            <IoTimeOutline />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Finalizados</span>
            <span className="text-sm sm:text-lg font-black text-slate-900 font-mono">{totalProjetos} concluídos</span>
          </div>
        </div>
      </div>

      {/* Tabela de Pedidos Recentes */}
      <div className="glass-card p-4 sm:p-6 text-left space-y-4">
        <div>
          <h3 className="text-sm font-black text-slate-900">Atividades Recentes</h3>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Últimos orçamentos e ordens de serviço geradas no IdeaSerralheiro</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-2.5 pb-2 text-left">ID / Cliente</th>
                <th className="py-2.5 pb-2 text-left">Estrutura / Projeto</th>
                <th className="py-2.5 pb-2 text-left">Peso Est.</th>
                <th className="py-2.5 pb-2 text-left">Status</th>
                <th className="py-2.5 pb-2 text-right">Valor Venda</th>
                <th className="py-2.5 pb-2 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {recentes.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400 font-semibold">
                    Nenhum orçamento ou OS encontrado. Vá na aba "Calculadora" para criar o primeiro!
                  </td>
                </tr>
              ) : (
                recentes.map((os, idx) => (
                  <tr key={os.id || idx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-all font-semibold text-slate-700">
                    <td className="py-3">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400">#{os.id.substring(0, 5).toUpperCase()}</span>
                        <span className="font-extrabold text-slate-900">{os.cliente.nome}</span>
                      </div>
                    </td>
                    <td className="py-3 capitalize">
                      <div className="flex flex-col">
                        <span>{os.projeto.modelo}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {os.projeto.largura}x{os.projeto.altura} mm
                        </span>
                      </div>
                    </td>
                    <td className="py-3 font-mono">
                      {os.projeto.pesoTotal ? `${os.projeto.pesoTotal.toFixed(1)} kg` : '—'}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${STATUS_OS[os.status]?.color || 'bg-slate-100'}`}>
                        {STATUS_OS[os.status]?.label}
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-slate-900">
                      R$ {os.projeto.precoVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 text-center">
                      <button
                        onClick={() => setSelectedOS(os)}
                        className="p-1 px-2.5 bg-slate-100 hover:bg-slate-900 hover:text-white rounded-lg transition-all text-[10px] font-black uppercase tracking-wider flex items-center gap-0.5 mx-auto"
                      >
                        Ver Ficha <IoChevronForwardOutline size={10} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;
