import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { osService } from '../../services/osService';
import ModalOrdemServico from '../../components/ModalOrdemServico';
import BackButton from '../../components/BackButton';
import { toast } from 'react-toastify';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import {
  IoBuildOutline,
  IoSearch,
  IoAdd,
  IoEyeOutline,
  IoPencilOutline,
  IoTrashOutline,
  IoTimeOutline,
  IoCheckmarkCircleOutline,
  IoChevronForwardOutline,
  IoWalletOutline
} from 'react-icons/io5';

// Helper de Cores para Badge de Status
export const getStatusBadgeStyle = (status) => {
  switch (status) {
    case 'em_analise':
      return { label: 'Em Análise', bg: 'bg-amber-50 text-amber-700 border-amber-200/50', icon: '🔍' };
    case 'aguardando_orcamento':
      return { label: 'Aguardando Aprovação', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/50', icon: '⏳' };
    case 'orcamento_aprovado':
      return { label: 'Orçamento Aprovado', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/50', icon: '🟢' };
    case 'orcamento_rejeitado':
      return { label: 'Orçamento Rejeitado', bg: 'bg-rose-50 text-rose-700 border-rose-200/50', icon: '🔴' };
    case 'em_manutencao':
      return { label: 'Em Manutenção', bg: 'bg-blue-50 text-blue-700 border-blue-200/50', icon: '🔧' };
    case 'pronto':
      return { label: 'Pronto / Concluído', bg: 'bg-teal-50 text-teal-700 border-teal-200/50', icon: '✅' };
    case 'entregue':
      return { label: 'Entregue', bg: 'bg-slate-100 text-slate-700 border-slate-200/50', icon: '📦' };
    case 'sem_conserto':
      return { label: 'Sem Conserto', bg: 'bg-gray-100 text-gray-700 border-gray-200/50', icon: '❌' };
    default:
      return { label: 'Desconhecido', bg: 'bg-gray-50 text-gray-500 border-gray-150', icon: '•' };
  }
};

export default function GestaoOS() {
  const { estabelecimentoIdPrincipal } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [ordens, setOrdens] = useState([]);
  
  // Modais
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOsId, setSelectedOsId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  
  // Filtros
  const [filtroStatus, setFiltroStatus] = useState('ativos'); // 'todos' | 'ativos' | status específico
  const [termoBusca, setTermoBusca] = useState('');

  const carregarDados = async () => {
    if (!estabelecimentoIdPrincipal) return;
    setLoading(true);
    try {
      const list = await osService.listarOrdensServico(estabelecimentoIdPrincipal);
      setOrdens(list);
    } catch (err) {
      toast.error("Erro ao carregar Ordens de Serviço.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [estabelecimentoIdPrincipal]);

  const handleDelete = (osId) => {
    setDeleteConfirmId(osId);
  };

  // KPIs
  const stats = useMemo(() => {
    let ativas = 0;
    let aguardando = 0;
    let manutencao = 0;
    let prontas = 0;
    
    ordens.forEach(os => {
      if (!['entregue', 'sem_conserto', 'orcamento_rejeitado'].includes(os.status)) {
        ativas++;
      }
      if (os.status === 'aguardando_orcamento') aguardando++;
      if (os.status === 'em_manutencao') manutencao++;
      if (os.status === 'pronto') prontas++;
    });
    
    return { ativas, aguardando, manutencao, prontas };
  }, [ordens]);

  // Lista Filtrada
  const ordensFiltradas = useMemo(() => {
    return ordens.filter(os => {
      // 1. Filtro de Status
      if (filtroStatus === 'ativos') {
        if (['entregue', 'sem_conserto', 'orcamento_rejeitado'].includes(os.status)) return false;
      } else if (filtroStatus !== 'todos') {
        if (os.status !== filtroStatus) return false;
      }
      
      // 2. Filtro de Texto
      if (termoBusca) {
        const queryClean = termoBusca
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
          
        const matchesClient = os.cliente?.nome?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(queryClean);
        const matchesPhone = os.cliente?.telefone?.includes(queryClean);
        const matchesModel = os.equipamento?.modelo?.toLowerCase().includes(queryClean);
        const matchesBrand = os.equipamento?.marca?.toLowerCase().includes(queryClean);
        const matchesOSNum = String(os.numeroOS).includes(queryClean);
        const matchesIMEI = os.equipamento?.nSerieOrImei?.includes(queryClean);
        const matchesPlaca = os.equipamento?.placa?.toLowerCase().includes(queryClean);
        
        return matchesClient || matchesPhone || matchesModel || matchesBrand || matchesOSNum || matchesIMEI || matchesPlaca;
      }
      
      return true;
    });
  }, [ordens, filtroStatus, termoBusca]);

  return (
    <div className="space-y-6 font-sans">
      
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 pb-5">
        <div className="flex items-center gap-3">
          <BackButton to="/admin/dashboard" />
          <div>
            <h1 className="text-xl font-black text-slate-800">Ordem de Serviço (OS)</h1>
            <p className="text-xs text-slate-400 font-bold">Gerencie manutenções, peças e status técnicos dos dispositivos</p>
          </div>
        </div>
        <button
          onClick={() => { setSelectedOsId(null); setModalOpen(true); }}
          className="bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs px-5 py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md self-start sm:self-auto"
        >
          <IoAdd size={18} /> ABRIR NOVA OS
        </button>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'OS Ativas', val: stats.ativas, icon: IoBuildOutline, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
          { label: 'Aguardando Aprov.', val: stats.aguardando, icon: IoTimeOutline, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
          { label: 'Em Conserto', val: stats.manutencao, icon: IoBuildOutline, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
          { label: 'Prontas p/ Retirada', val: stats.prontas, icon: IoCheckmarkCircleOutline, color: 'text-teal-600', bg: 'bg-teal-50 border-teal-100' }
        ].map((kpi, idx) => {
          const KpiIcon = kpi.icon;
          return (
            <div key={idx} className={`border p-5 rounded-[2rem] flex items-center justify-between shadow-sm bg-white hover:shadow-md transition-shadow ${kpi.bg}`}>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{kpi.label}</p>
                <p className="text-2xl font-black text-slate-800">{kpi.val}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm ${kpi.color}`}>
                <KpiIcon size={20} />
              </div>
            </div>
          );
        })}
      </div>

      {/* FILTER & SEARCH */}
      <div className="bg-white border border-slate-200/60 rounded-[2.2rem] p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Status Filter Buttons */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'ativos', label: 'Ativas' },
              { id: 'todos', label: 'Ver Todas' },
              { id: 'em_analise', label: 'Em Análise' },
              { id: 'aguardando_orcamento', label: 'Aguardando Aprov.' },
              { id: 'orcamento_aprovado', label: 'Aprovadas' },
              { id: 'em_manutencao', label: 'Manutenção' },
              { id: 'pronto', label: 'Prontas' },
              { id: 'entregue', label: 'Entregues' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltroStatus(f.id)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all border ${
                  filtroStatus === f.id
                    ? 'bg-slate-800 text-white border-slate-900 shadow-sm'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          
          {/* Text Search Box */}
          <div className="relative w-full md:w-80 shrink-0">
            <IoSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              placeholder="Buscar por cliente, IMEI ou OS..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 rounded-2xl text-xs font-bold text-slate-700 outline-none transition-all shadow-sm"
            />
          </div>
          
        </div>

        {/* DATA TABLE */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin w-10 h-10 border-4 border-slate-200 border-t-slate-800 rounded-full mb-3"></div>
            <p className="text-xs font-black text-slate-400">Buscando ordens de serviço no banco...</p>
          </div>
        ) : ordensFiltradas.length === 0 ? (
          <div className="text-center py-16 bg-slate-50/50 rounded-[1.8rem] border border-dashed border-slate-200 flex flex-col items-center justify-center">
            <IoBuildOutline className="text-slate-300 mb-3" size={40} />
            <h3 className="font-extrabold text-sm text-slate-700">Nenhuma Ordem de Serviço Encontrada</h3>
            <p className="text-xs text-slate-450 font-bold mt-1">Experimente mudar o status do filtro ou iniciar uma nova OS</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[1.8rem] border border-slate-100">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-slate-450 uppercase tracking-wider border-b border-slate-150">
                  <th className="p-4 w-20">Nº OS</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Equipamento</th>
                  <th className="p-4">Técnico</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Total</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-700 bg-white">
                {ordensFiltradas.map((os) => {
                  const statusStyle = getStatusBadgeStyle(os.status);
                  return (
                    <tr key={os.id} className="hover:bg-slate-50/70 transition-colors group">
                      
                      {/* OS ID */}
                      <td className="p-4 text-slate-900 font-black">#{os.numeroOS}</td>
                      
                      {/* Customer Info */}
                      <td className="p-4">
                        <p className="text-slate-800 font-extrabold text-xs">{os.cliente?.nome}</p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{os.cliente?.telefone}</p>
                      </td>
                      
                      {/* Equipment Info */}
                      <td className="p-4">
                        <p className="text-slate-800 font-bold text-xs">{os.equipamento?.marca} {os.equipamento?.modelo}</p>
                        {os.equipamento?.nSerieOrImei && (
                          <p className="text-[9px] font-mono text-slate-400 mt-0.5">IMEI: {os.equipamento?.nSerieOrImei}</p>
                        )}
                      </td>
                      
                      {/* Technician */}
                      <td className="p-4 text-slate-500 font-semibold">{os.tecnicoResponsavel?.nome || 'Nenhum'}</td>
                      
                      {/* Status Badge */}
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase whitespace-nowrap inline-flex items-center gap-1 ${statusStyle.bg}`}>
                          <span>{statusStyle.icon}</span>
                          <span>{statusStyle.label}</span>
                        </span>
                      </td>
                      
                      {/* Financial Total */}
                      <td className="p-4 text-right text-slate-900 font-black text-xs">
                        R$ {parseFloat(os.total || 0).toFixed(2)}
                        <p className={`text-[8px] font-black uppercase tracking-wider mt-0.5 ${os.situacaoFinanceira === 'pago' ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {os.situacaoFinanceira === 'pago' ? 'Pago' : 'Pendente'}
                        </p>
                      </td>
                      
                      {/* Actions */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/os/${os.id}`)}
                            title="Visualizar OS"
                            className="p-2 bg-slate-50 hover:bg-slate-200/70 hover:text-slate-900 text-slate-500 rounded-xl transition-all active:scale-95"
                          >
                            <IoEyeOutline size={16} />
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => { setSelectedOsId(os.id); setModalOpen(true); }}
                            title="Editar OS"
                            className="p-2 bg-slate-50 hover:bg-amber-100 hover:text-amber-800 text-slate-500 rounded-xl transition-all active:scale-95"
                          >
                            <IoPencilOutline size={16} />
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => handleDelete(os.id)}
                            title="Excluir OS"
                            className="p-2 bg-slate-50 hover:bg-red-100 hover:text-red-800 text-slate-350 rounded-xl transition-all active:scale-95"
                          >
                            <IoTrashOutline size={16} />
                          </button>
                          
                        </div>
                      </td>
                      
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FORM MODAL */}
      <ModalOrdemServico
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        estabelecimentoId={estabelecimentoIdPrincipal}
        osId={selectedOsId}
        onSaved={carregarDados}
      />

      {deleteConfirmId && (
        <ConfirmDialog
          open={true}
          title="Excluir Ordem de Serviço"
          message="Deseja realmente excluir esta ordem de serviço? Esta ação não pode ser desfeita."
          variant="danger"
          confirmText="Excluir"
          cancelText="Cancelar"
          onConfirm={async () => {
            const osId = deleteConfirmId;
            setDeleteConfirmId(null);
            try {
              await osService.excluirOrdemServico(estabelecimentoIdPrincipal, osId);
              toast.success("Ordem de serviço excluída!");
              carregarDados();
            } catch (err) {
              toast.error("Erro ao excluir OS.");
            }
          }}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}
    </div>
  );
}
