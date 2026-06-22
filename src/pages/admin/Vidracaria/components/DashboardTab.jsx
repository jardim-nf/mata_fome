import React from 'react';
import { 
  IoCalendarOutline, 
  IoAnalyticsOutline 
} from 'react-icons/io5';

const DashboardTab = ({ pedidos, setSelectedOS, STATUS_OS }) => {
  const hoje = new Date();

  // Métricas do Dashboard
  const orcamentosAtivos = pedidos.filter(p => p.status === 'orcamento').length;
  const concluidos = pedidos.filter(p => p.status === 'concluido');
  const totalFaturadoVal = concluidos.reduce((s, p) => s + (p.projeto?.precoVenda || 0), 0);
  const totalM2Instalado = concluidos.reduce((s, p) => s + (p.projeto?.area || 0), 0);
  const totalOSAtivas = pedidos.filter(p => p.status !== 'orcamento' && p.status !== 'concluido').length;
  
  // Métricas avançadas
  const ticketMedio = concluidos.length > 0 ? totalFaturadoVal / concluidos.length : 0;
  const taxaConversao = pedidos.length > 0 ? ((pedidos.length - orcamentosAtivos) / pedidos.length) * 100 : 0;
  const totalClientes = new Set(pedidos.map(p => p.cliente?.nome || '')).size;
  
  // Instalações próximas (próximos 3 dias)
  const em3Dias = new Date(hoje);
  em3Dias.setDate(em3Dias.getDate() + 3);
  const instalacoesProximas = pedidos.filter(p => {
    if (p.status === 'concluido' || p.status === 'orcamento') return false;
    if (!p.instalacao?.data) return false;
    const dataInst = new Date(p.instalacao.data + 'T00:00:00');
    return dataInst >= hoje && dataInst <= em3Dias;
  });
  
  // OS Atrasadas (data instalação já passou e não está concluída)
  const osAtrasadas = pedidos.filter(p => {
    if (p.status === 'concluido' || p.status === 'orcamento') return false;
    if (!p.instalacao?.data) return false;
    const dataInst = new Date(p.instalacao.data + 'T00:00:00');
    return dataInst < hoje;
  });

  // Receita por semana (últimas 4 semanas)
  const receitaSemanal = [0, 0, 0, 0].map((_, weekIdx) => {
    const semanaInicio = new Date(hoje);
    semanaInicio.setDate(semanaInicio.getDate() - (7 * (3 - weekIdx) + 6));
    const semanaFim = new Date(hoje);
    semanaFim.setDate(semanaFim.getDate() - (7 * (3 - weekIdx)));
    return concluidos
      .filter(p => {
        const d = p.criadoEm ? new Date(p.criadoEm) : new Date(0);
        return d >= semanaInicio && d <= semanaFim;
      })
      .reduce((s, p) => s + (p.projeto?.precoVenda || 0), 0);
  });
  const maxReceita = Math.max(...receitaSemanal, 1);

  // Comparativo mês atual vs anterior
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();
  const receitaMesAtual = concluidos.filter(p => {
    const d = p.criadoEm ? new Date(p.criadoEm) : new Date(0);
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  }).reduce((s, p) => s + (p.projeto?.precoVenda || 0), 0);
  const receitaMesAnterior = concluidos.filter(p => {
    const d = p.criadoEm ? new Date(p.criadoEm) : new Date(0);
    const mesAnterior = mesAtual === 0 ? 11 : mesAtual - 1;
    const anoAnterior = mesAtual === 0 ? anoAtual - 1 : anoAtual;
    return d.getMonth() === mesAnterior && d.getFullYear() === anoAnterior;
  }).reduce((s, p) => s + (p.projeto?.precoVenda || 0), 0);
  const crescimentoPerc = receitaMesAnterior > 0 ? ((receitaMesAtual - receitaMesAnterior) / receitaMesAnterior) * 100 : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Row 1: KPIs Principais (4 cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        <div className="glass-card p-3 sm:p-4 border-l-4 border-l-amber-500 text-left">
          <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500">Orçamentos</p>
          <h3 className="text-xl sm:text-3xl font-black mt-1 text-amber-600">{orcamentosAtivos}</h3>
          <p className="text-[8px] text-slate-400 font-semibold mt-0.5">pendentes de aprovação</p>
        </div>

        <div className="glass-card p-3 sm:p-4 border-l-4 border-l-blue-500 text-left">
          <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500">OS Ativas</p>
          <h3 className="text-xl sm:text-3xl font-black mt-1 text-blue-600">{totalOSAtivas}</h3>
          <p className="text-[8px] text-slate-400 font-semibold mt-0.5">em andamento</p>
        </div>

        <div className="glass-card p-3 sm:p-4 border-l-4 border-l-emerald-500 text-left">
          <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500">Vidro Instalado</p>
          <h3 className="text-xl sm:text-3xl font-black mt-1 text-emerald-600">{totalM2Instalado.toFixed(1)} m²</h3>
          <p className="text-[8px] text-slate-400 font-semibold mt-0.5">total geral</p>
        </div>

        <div className="glass-card p-3 sm:p-4 border-l-4 border-l-purple-500 text-left">
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500">Faturamento</p>
            <h3 className="text-lg sm:text-2xl font-black mt-1 text-purple-600 truncate">R$ {totalFaturadoVal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</h3>
            <p className="text-[8px] text-slate-400 font-semibold mt-0.5">total concluído</p>
          </div>
        </div>
      </div>

      {/* Row 2: KPIs Secundários (4 cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        <div className="glass-card p-3 sm:p-4 flex items-center gap-3 text-left">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-lg">💰</div>
          <div className="min-w-0">
            <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-slate-400">Ticket Médio</p>
            <p className="text-sm sm:text-lg font-black text-slate-900 truncate">R$ {ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</p>
          </div>
        </div>

        <div className="glass-card p-3 sm:p-4 flex items-center gap-3 text-left">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center text-lg">📈</div>
          <div>
            <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-slate-400">Conversão</p>
            <p className="text-sm sm:text-lg font-black text-emerald-700">{taxaConversao.toFixed(0)}%</p>
          </div>
        </div>

        <div className="glass-card p-3 sm:p-4 flex items-center gap-3 text-left">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-lg">👥</div>
          <div>
            <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-slate-400">Clientes</p>
            <p className="text-sm sm:text-lg font-black text-indigo-700">{totalClientes}</p>
          </div>
        </div>

        <div className="glass-card p-3 sm:p-4 flex items-center gap-3 text-left">
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-lg border ${crescimentoPerc >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            {crescimentoPerc >= 0 ? '🔼' : '🔽'}
          </div>
          <div>
            <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-slate-400">vs Mês Ant.</p>
            <p className={`text-sm sm:text-lg font-black ${crescimentoPerc >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {crescimentoPerc >= 0 ? '+' : ''}{crescimentoPerc.toFixed(0)}%
            </p>
          </div>
        </div>
      </div>

      {/* Alertas de Instalações Próximas e Atrasadas */}
      {(instalacoesProximas.length > 0 || osAtrasadas.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
          {osAtrasadas.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3 sm:p-4">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-red-700 flex items-center gap-1.5 mb-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                ⚠️ {osAtrasadas.length} OS Atrasada{osAtrasadas.length > 1 ? 's' : ''}
              </h4>
              <div className="space-y-1.5">
                {osAtrasadas.slice(0, 3).map(os => (
                  <button key={os.id} onClick={() => setSelectedOS(os)} className="w-full text-left bg-white/80 rounded-lg p-2 border border-red-100 hover:bg-white transition-all flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-800">{os.cliente?.nome} — {os.projeto?.modelo}</span>
                    <span className="text-[9px] font-mono font-black text-red-600">
                      {new Date(os.instalacao.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {instalacoesProximas.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 sm:p-4">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-amber-700 flex items-center gap-1.5 mb-2">
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                📅 {instalacoesProximas.length} Instalação{instalacoesProximas.length > 1 ? 'ões' : ''} Próxima{instalacoesProximas.length > 1 ? 's' : ''}
              </h4>
              <div className="space-y-1.5">
                {instalacoesProximas.map(os => (
                  <button key={os.id} onClick={() => setSelectedOS(os)} className="w-full text-left bg-white/80 rounded-lg p-2 border border-amber-100 hover:bg-white transition-all flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-800">{os.cliente?.nome} — {os.projeto?.modelo}</span>
                    <span className="text-[9px] font-mono font-black text-amber-700">
                      {new Date(os.instalacao.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Layout de Três Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 text-left">
        {/* Mini Gráfico de Receita Semanal */}
        <div className="glass-card lg:col-span-4 p-3 sm:p-5">
          <h3 className="text-xs font-black text-slate-900 border-b border-slate-200 pb-2 mb-3 flex items-center gap-1.5">
            📊 Receita Semanal
          </h3>
          <div className="flex items-end justify-between gap-2 h-24 sm:h-28 px-1">
            {receitaSemanal.map((val, idx) => {
              const height = maxReceita > 0 ? (val / maxReceita) * 100 : 5;
              const labels = ['3 sem', '2 sem', 'Sem pass.', 'Esta sem'];
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[7px] sm:text-[8px] font-black text-slate-600">
                    {val > 0 ? `R$${(val / 1000).toFixed(1)}k` : '-'}
                  </span>
                  <div className="w-full relative" style={{ height: '100%' }}>
                    <div 
                      className={`absolute bottom-0 left-1 right-1 rounded-t-md transition-all duration-500 ${idx === 3 ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' : 'bg-gradient-to-t from-slate-300 to-slate-200'}`}
                      style={{ height: `${Math.max(height, 5)}%` }}
                    />
                  </div>
                  <span className="text-[7px] sm:text-[8px] font-bold text-slate-400">{labels[idx]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Instalações Agendadas */}
        <div className="glass-card lg:col-span-5 p-3 sm:p-5 space-y-3">
          <h3 className="text-xs font-black text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-1.5">
            <IoCalendarOutline /> Instalações Agendadas
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 text-[8px] sm:text-[9px] uppercase tracking-wider text-slate-500 font-extrabold">
                  <th className="py-2">Cliente</th>
                  <th className="py-2">Projeto</th>
                  <th className="py-2">Data</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[10px] sm:text-xs text-slate-700">
                {pedidos.filter(p => p.status !== 'orcamento' && p.status !== 'concluido').slice(0, 6).map(os => (
                  <tr key={os.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => setSelectedOS(os)}>
                    <td className="py-2.5 font-bold text-slate-800 truncate max-w-[100px]">{os.cliente?.nome}</td>
                    <td className="py-2.5">
                      <span className="bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-black uppercase text-slate-800">
                        {os.projeto?.modelo}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono text-slate-900 font-bold text-[9px] sm:text-[10px]">
                      {os.instalacao?.data ? new Date(os.instalacao.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="py-2.5">
                      <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase border ${STATUS_OS[os.status]?.color || 'bg-slate-100'}`}>
                        {STATUS_OS[os.status]?.label}
                      </span>
                    </td>
                  </tr>
                ))}
                {pedidos.filter(p => p.status !== 'orcamento' && p.status !== 'concluido').length === 0 && (
                  <tr><td colSpan="4" className="py-6 text-center text-slate-400 text-xs font-medium">Nenhuma instalação ativa.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Estatísticas de Demanda */}
        <div className="glass-card lg:col-span-3 p-3 sm:p-5 space-y-3">
          <h3 className="text-xs font-black text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-1.5">
            <IoAnalyticsOutline /> Demanda
          </h3>

          <div className="space-y-2.5">
            {[
              { key: 'box', label: 'Box Banheiro', color: 'bg-blue-500' },
              { key: 'janela', label: 'Janelas', color: 'bg-emerald-500' },
              { key: 'porta', label: 'Portas', color: 'bg-purple-500' },
              { key: 'espelho', label: 'Espelhos', color: 'bg-amber-500' },
              { key: 'outros', label: 'Outros', color: 'bg-slate-400' }
            ].map(m => {
              const count = pedidos.filter(p => p.projeto?.tipoProjeto === m.key).length;
              const pct = pedidos.length ? (count / pedidos.length) * 100 : 0;
              return (
                <div key={m.key} className="space-y-0.5">
                  <div className="flex justify-between text-[10px] font-bold text-slate-700">
                    <span>{m.label}</span>
                    <span className="font-mono text-slate-800">{count} <span className="text-slate-400">({pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className={`${m.color} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top Vidro */}
          <div className="border-t border-slate-100 pt-2 mt-2">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Vidro Mais Usado</p>
            {(() => {
              const vidroCount = {};
              pedidos.forEach(p => {
                const v = p.projeto?.tipoVidro || 'N/A';
                vidroCount[v] = (vidroCount[v] || 0) + 1;
              });
              const sorted = Object.entries(vidroCount).sort((a, b) => b[1] - a[1]);
              return sorted.slice(0, 3).map(([nome, count]) => (
                <div key={nome} className="flex justify-between text-[9px] font-semibold text-slate-600 py-0.5">
                  <span className="truncate max-w-[120px]">{nome}</span>
                  <span className="font-mono font-black text-slate-800">{count}x</span>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;
