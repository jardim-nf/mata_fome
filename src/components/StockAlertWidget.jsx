import React, { useState, useMemo } from 'react';
import { useAdminMenuData } from '../hooks/useAdminMenuData';
import { 
  IoAlertCircle, IoClose, IoWarningOutline, IoCalendarOutline, 
  IoCubeOutline, IoLayersOutline 
} from 'react-icons/io5';
import { format, parseISO, differenceInDays } from 'date-fns';

const StockAlertWidget = ({ estabelecimentoId, isDark = false }) => {
  const { menuItems, loading } = useAdminMenuData(estabelecimentoId);
  const [dismissed, setDismissed] = useState(false);
  const [activeTab, setActiveTab] = useState('vencidos'); // vencidos, vencendo, estoque

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Processar alertas de estoque e validade
  const alerts = useMemo(() => {
    if (!menuItems || menuItems.length === 0) return { vencidos: [], vencendo: [], estoque: [] };

    const vencidosList = [];
    const vencendoList = [];
    const estoqueList = [];

    menuItems.forEach(item => {
      if (item.ativo === false) return;

      const hasVariations = Array.isArray(item.variacoes) && item.variacoes.length > 0;
      
      if (hasVariations) {
        item.variacoes.forEach(v => {
          if (v.ativo === false) return;

          // 1. Validade e Lote
          if (v.dataValidade) {
            try {
              const valDate = parseISO(v.dataValidade);
              const daysDiff = differenceInDays(valDate, today);
              
              if (daysDiff < 0) {
                vencidosList.push({
                  id: `${item.id}-${v.id}`,
                  nome: `${item.nome} (${v.nome})`,
                  lote: v.lote || 'N/D',
                  validade: v.dataValidade,
                  dias: daysDiff
                });
              } else if (daysDiff <= 30) {
                vencendoList.push({
                  id: `${item.id}-${v.id}`,
                  nome: `${item.nome} (${v.nome})`,
                  lote: v.lote || 'N/D',
                  validade: v.dataValidade,
                  dias: daysDiff
                });
              }
            } catch (err) {
              console.error(err);
            }
          }

          // 2. Estoque por Variação
          const est = Number(v.estoque) || 0;
          const min = Number(v.estoqueMinimo) || 0;
          if (min > 0 && est <= min) {
            estoqueList.push({
              id: `${item.id}-${v.id}`,
              nome: `${item.nome} (${v.nome})`,
              estoque: est,
              minimo: min,
              status: est <= 0 ? 'ESGOTADO' : 'CRÍTICO'
            });
          }
        });
      } else {
        // Item simples (sem variações)
        const est = Number(item.estoque) || 0;
        const min = Number(item.estoqueMinimo) || 0;

        if (item.dataValidade) {
          try {
            const valDate = parseISO(item.dataValidade);
            const daysDiff = differenceInDays(valDate, today);
            
            if (daysDiff < 0) {
              vencidosList.push({
                id: item.id,
                nome: item.nome,
                lote: item.lote || 'N/D',
                validade: item.dataValidade,
                dias: daysDiff
              });
            } else if (daysDiff <= 30) {
              vencendoList.push({
                id: item.id,
                nome: item.nome,
                lote: item.lote || 'N/D',
                validade: item.dataValidade,
                dias: daysDiff
              });
            }
          } catch (err) {
            console.error(err);
          }
        }

        if (min > 0 && est <= min) {
          estoqueList.push({
            id: item.id,
            nome: item.nome,
            estoque: est,
            minimo: min,
            status: est <= 0 ? 'ESGOTADO' : 'CRÍTICO'
          });
        }
      }
    });

    return { vencidos: vencidosList, vencendo: vencendoList, estoque: estoqueList };
  }, [menuItems, today]);

  const totalAlertsCount = alerts.vencidos.length + alerts.vencendo.length + alerts.estoque.length;

  // Determinar aba ativa inicial preferencial
  React.useEffect(() => {
    if (alerts.vencidos.length > 0) setActiveTab('vencidos');
    else if (alerts.vencendo.length > 0) setActiveTab('vencendo');
    else if (alerts.estoque.length > 0) setActiveTab('estoque');
  }, [alerts]);

  if (loading || dismissed || totalAlertsCount === 0) return null;

  const formatDateBR = (isoStr) => {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return isoStr;
  };

  return (
    <div className={`backdrop-blur-md rounded-3xl border p-5 sm:p-6 mb-8 relative shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
      isDark 
        ? 'bg-slate-900/80 border-slate-800 text-slate-100' 
        : 'bg-white border-slate-200/80 text-slate-800'
    }`}>
      {/* Fechar Widget */}
      <button 
        onClick={() => setDismissed(true)}
        className={`absolute top-4 right-4 p-2 rounded-full transition-colors ${
          isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
        }`}
        title="Dispensar alertas por agora"
      >
        <IoClose size={18} />
      </button>

      {/* Título e ícone de Alerta */}
      <div className="flex items-center gap-4 mb-5">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
          alerts.vencidos.length > 0 
            ? 'bg-rose-500/10 text-rose-500' 
            : 'bg-amber-500/10 text-amber-500'
        }`}>
          <IoAlertCircle className="text-3xl animate-pulse" />
        </div>
        <div>
          <h3 className={`text-lg sm:text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Controle de Estoque e Validade
          </h3>
          <p className={`text-xs font-semibold mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Foram identificados <strong className={alerts.vencidos.length > 0 ? 'text-rose-500' : 'text-amber-500'}>{totalAlertsCount} itens</strong> que exigem sua atenção imediata.
          </p>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2 overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveTab('vencidos')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'vencidos'
              ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          🚨 Vencidos ({alerts.vencidos.length})
        </button>
        <button
          onClick={() => setActiveTab('vencendo')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'vencendo'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          ⚠️ Vencendo Breve ({alerts.vencendo.length})
        </button>
        <button
          onClick={() => setActiveTab('estoque')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'estoque'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          📦 Estoque Crítico ({alerts.estoque.length})
        </button>
      </div>

      {/* Conteúdo das Abas */}
      <div className="max-h-[240px] overflow-y-auto pr-1 space-y-2.5">
        {activeTab === 'vencidos' && (
          alerts.vencidos.length === 0 ? (
            <p className="text-xs font-semibold text-slate-400 py-4 text-center">Nenhum produto vencido. 🎉</p>
          ) : (
            alerts.vencidos.map(item => (
              <div key={item.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl border text-xs gap-3 ${
                isDark ? 'bg-rose-500/5 border-rose-500/10' : 'bg-rose-50/50 border-rose-100'
              }`}>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 bg-rose-500 text-white font-extrabold rounded text-[9px] uppercase tracking-wider">VENCIDO</span>
                  <div>
                    <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{item.nome}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Lote: <strong className="text-slate-550">{item.lote}</strong></p>
                  </div>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  <span className="text-rose-500 font-extrabold flex items-center gap-1">
                    <IoCalendarOutline /> Venceu em {formatDateBR(item.validade)}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">({Math.abs(item.dias)} dias atrás)</span>
                </div>
              </div>
            ))
          )
        )}

        {activeTab === 'vencendo' && (
          alerts.vencendo.length === 0 ? (
            <p className="text-xs font-semibold text-slate-400 py-4 text-center">Nenhum produto próximo do vencimento nos próximos 30 dias.</p>
          ) : (
            alerts.vencendo.map(item => (
              <div key={item.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl border text-xs gap-3 ${
                isDark ? 'bg-orange-500/5 border-orange-500/10' : 'bg-orange-50/50 border-orange-100'
              }`}>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 bg-orange-500 text-white font-extrabold rounded text-[9px] uppercase tracking-wider">ATENÇÃO</span>
                  <div>
                    <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{item.nome}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Lote: <strong className="text-slate-550">{item.lote}</strong></p>
                  </div>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  <span className="text-orange-600 font-extrabold flex items-center gap-1">
                    <IoCalendarOutline /> Vence em {formatDateBR(item.validade)}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">(Faltam {item.dias} dias)</span>
                </div>
              </div>
            ))
          )
        )}

        {activeTab === 'estoque' && (
          alerts.estoque.length === 0 ? (
            <p className="text-xs font-semibold text-slate-400 py-4 text-center">Nenhum produto com estoque crítico ou esgotado. 👍</p>
          ) : (
            alerts.estoque.map(item => (
              <div key={item.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl border text-xs gap-3 ${
                item.estoque <= 0
                  ? isDark ? 'bg-rose-500/5 border-rose-500/10' : 'bg-rose-50/50 border-rose-100'
                  : isDark ? 'bg-amber-500/5 border-amber-500/10' : 'bg-amber-50/50 border-amber-100'
              }`}>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 font-extrabold rounded text-[9px] uppercase tracking-wider ${
                    item.estoque <= 0 ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                  }`}>{item.status}</span>
                  <div>
                    <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{item.nome}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Mínimo cadastrado: {item.minimo} unid</p>
                  </div>
                </div>
                <div className="text-left sm:text-right shrink-0 font-extrabold">
                  <span className={item.estoque <= 0 ? 'text-red-500' : 'text-amber-600'}>
                    Estoque: {item.estoque} unid
                  </span>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
};

export default StockAlertWidget;
