import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useContasPagarData } from '../../hooks/useContasPagarData';
import { toast } from 'react-toastify';
import { 
  FaCheck, FaTimes, FaPlus, FaUndo, FaArrowLeft, 
  FaExclamationCircle, FaCheckCircle, FaCalendarAlt, FaTrash
} from 'react-icons/fa';
import { 
  IoSearchOutline, 
  IoBagRemoveOutline,
  IoPeopleOutline,
  IoHomeOutline,
  IoWifiOutline,
  IoFlaskOutline,
  IoFlashOutline,
  IoReceiptOutline,
  IoEllipsisHorizontalOutline
} from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';

const categorias = ['Garçons / Equipe', 'Aluguel', 'Internet', 'Insumos', 'Água/Luz', 'Impostos', 'Outros'];

const getCategoryStyle = (cat) => {
  switch (cat) {
    case 'Garçons / Equipe':
      return {
        icon: <IoPeopleOutline className="text-xl" />,
        bg: 'bg-purple-50 text-purple-600 border-purple-100/50'
      };
    case 'Aluguel':
      return {
        icon: <IoHomeOutline className="text-xl" />,
        bg: 'bg-blue-50 text-blue-600 border-blue-100/50'
      };
    case 'Internet':
      return {
        icon: <IoWifiOutline className="text-xl" />,
        bg: 'bg-cyan-50 text-cyan-600 border-cyan-100/50'
      };
    case 'Insumos':
      return {
        icon: <IoFlaskOutline className="text-xl" />,
        bg: 'bg-emerald-50 text-emerald-600 border-emerald-100/50'
      };
    case 'Água/Luz':
      return {
        icon: <IoFlashOutline className="text-xl" />,
        bg: 'bg-amber-50 text-amber-600 border-amber-100/50'
      };
    case 'Impostos':
      return {
        icon: <IoReceiptOutline className="text-xl" />,
        bg: 'bg-rose-50 text-rose-600 border-rose-100/50'
      };
    default:
      return {
        icon: <IoEllipsisHorizontalOutline className="text-xl" />,
        bg: 'bg-slate-50 text-slate-500 border-slate-200/50'
      };
  }
};

const getCategoryProgressColor = (cat) => {
  switch (cat) {
    case 'Garçons / Equipe': return 'bg-purple-500';
    case 'Aluguel': return 'bg-blue-500';
    case 'Internet': return 'bg-cyan-500';
    case 'Insumos': return 'bg-emerald-500';
    case 'Água/Luz': return 'bg-amber-500';
    case 'Impostos': return 'bg-rose-500';
    default: return 'bg-slate-400';
  }
};

// Skeleton loader
const SkeletonRow = () => (
  <div className="p-6 flex flex-col lg:flex-row lg:items-center gap-4 animate-pulse border-b border-slate-200/60">
    <div className="w-12 h-12 bg-slate-100 rounded-2xl"></div>
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-slate-100 rounded-lg w-40"></div>
      <div className="h-3 bg-slate-50 rounded-lg w-24"></div>
    </div>
    <div className="flex-1 space-y-2">
      <div className="h-3 bg-slate-50 rounded-lg w-16"></div>
      <div className="h-4 bg-slate-100 rounded-lg w-24"></div>
    </div>
    <div className="h-6 bg-slate-100 rounded-full w-24"></div>
    <div className="flex gap-2 justify-end w-full lg:w-auto mt-2 lg:mt-0">
      <div className="w-10 h-10 bg-slate-100 rounded-full"></div>
      <div className="h-10 w-28 bg-slate-100 rounded-full"></div>
    </div>
  </div>
);

function ContasPagar() {
  const navigate = useNavigate();
  const { currentUser, estabelecimentoIdPrincipal } = useAuth();
  const estabId = estabelecimentoIdPrincipal || currentUser?.estabelecimentoId;
  
  const { contas, loading, resumo, addConta, updateConta, deleteConta, togglePago } = useContasPagarData(estabId);

  // Forced Light Theme
  const t = {
    bg: 'bg-gradient-to-br from-[#f6f8fa] via-[#eef2f6] to-[#f6f8fa] text-slate-800',
    surface: 'bg-white/50 backdrop-blur-xl border border-white/60 shadow-xl shadow-slate-200/20',
    cardBg: 'bg-white border border-gray-100 shadow-sm',
    border: 'border-slate-200/60',
    text: 'text-slate-800',
    textSecondary: 'text-slate-500',
    textMuted: 'text-gray-400',
    inputBg: 'bg-gray-50 text-slate-800 border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white',
    accent: 'bg-blue-600',
    pillActive: 'bg-black text-white shadow-md',
    pillInactive: 'bg-white border border-gray-200/60 text-gray-500 hover:text-black hover:border-gray-300',
    textBlack: 'text-gray-900',
    badgeSuccess: 'bg-[#F2FCDA] text-[#1D7446] border-[#D0F2A8]',
    badgePending: 'bg-[#F5F5F7] text-[#86868B] border-[#E5E5EA]',
    badgeUrgent: 'bg-[#FFF2E6] text-[#FF8C00] border-[#FFD9B3]',
    badgeDanger: 'bg-[#FFE6E6] text-[#D0021B] border-[#FFB3B3]',
    btnSecondary: 'bg-white hover:bg-gray-50 text-slate-700 border-slate-200/60',
    btnConfirm: 'bg-black hover:bg-gray-800 text-white border-black',
    modalBg: 'bg-white border border-gray-100 shadow-2xl',
  };

  const [filtroStatus, setFiltroStatus] = useState('todos'); // todos, pendente, pago, atrasado
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [contaObj, setContaObj] = useState({ id: null, descricao: '', categoria: 'Outros', valor: '', dataVencimento: '', status: 'pendente' });

  // Custom confirmation modal states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [contaToDelete, setContaToDelete] = useState(null);
  const [loteConfirmOpen, setLoteConfirmOpen] = useState(false);

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const [selectedIds, setSelectedIds] = useState([]);
  const [ordenacao, setOrdenacao] = useState('vencimento-asc');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  // Reset selection on filter or search query change
  useEffect(() => {
    setSelectedIds([]);
  }, [filtroStatus, searchQuery, dataInicio, dataFim]);

  const distribuicaoCategorias = useMemo(() => {
    const map = {};
    categorias.forEach(cat => { map[cat] = 0; });
    let totalGeral = 0;
    contas.forEach(c => {
      const val = Number(c.valor || 0);
      map[c.categoria] = (map[c.categoria] || 0) + val;
      totalGeral += val;
    });
    return categorias.map(cat => ({
      name: cat,
      value: map[cat],
      percentage: totalGeral > 0 ? (map[cat] / totalGeral) * 100 : 0
    })).sort((a, b) => b.value - a.value);
  }, [contas]);

  const proximosVencimentos = useMemo(() => {
    return contas
      .filter(c => c.status !== 'pago')
      .sort((a, b) => new Date(a.dataVencimento) - new Date(b.dataVencimento))
      .slice(0, 4);
  }, [contas]);

  const handleToggleSelect = (id) => {
    const targetConta = contas.find(c => c.id === id);
    if (targetConta && targetConta.status === 'pago') return;
    
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const selectableFilteredIds = filtradas.filter(c => c.status !== 'pago').map(c => c.id);
    const allSelected = selectableFilteredIds.length > 0 && selectableFilteredIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !selectableFilteredIds.includes(id)));
    } else {
      setSelectedIds(prev => {
        const newSelection = [...prev];
        selectableFilteredIds.forEach(id => {
          if (!newSelection.includes(id)) newSelection.push(id);
        });
        return newSelection;
      });
    }
  };

  const totalSelecionado = useMemo(() => {
    return contas
      .filter(c => selectedIds.includes(c.id))
      .reduce((sum, c) => sum + Number(c.valor || 0), 0);
  }, [contas, selectedIds]);

  const handleDarBaixaLoteClick = () => {
    const contasParaPagar = contas.filter(c => selectedIds.includes(c.id) && c.status !== 'pago');
    if (contasParaPagar.length === 0) {
      toast.warn("Nenhum boleto pendente foi selecionado.");
      return;
    }
    setLoteConfirmOpen(true);
  };

  const confirmarDarBaixaLote = async () => {
    const contasParaPagar = contas.filter(c => selectedIds.includes(c.id) && c.status !== 'pago');
    try {
      await Promise.all(contasParaPagar.map(conta => togglePago(conta)));
      toast.success(`${contasParaPagar.length} despesas quitadas com sucesso!`);
      setSelectedIds([]);
      setLoteConfirmOpen(false);
    } catch (error) {
      toast.error("Erro ao dar baixa nas contas selecionadas: " + error.message);
    }
  };

  const getVencimentoStatus = (fatura) => {
    if (fatura.status === 'pago') return 'pago';
    if (!fatura.dataVencimento) return 'pendente';
    
    const hj = new Date();
    hj.setHours(0,0,0,0);
    const args = fatura.dataVencimento.split('-');
    const vData = new Date(args[0], args[1] - 1, args[2]);
    const pDias = (vData - hj) / (1000 * 60 * 60 * 24);
    
    if (pDias < 0) return 'atrasado';
    if (pDias <= 5) return 'vencendo';
    return 'pendente';
  };

  const getStatusBadge = (fatura) => {
    const status = getVencimentoStatus(fatura);
    const styles = {
      pago: t.badgeSuccess,
      atrasado: t.badgeDanger,
      vencendo: t.badgeUrgent,
      pendente: t.badgePending,
    };
    const icons = {
      pago: <FaCheckCircle />, atrasado: <FaExclamationCircle />,
      vencendo: <FaExclamationCircle />, pendente: <FaCalendarAlt />,
    };
    const labels = { pago: 'PAGO', atrasado: 'ATRASADO', vencendo: 'VENCE LOGO', pendente: 'PENDENTE' };

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-full uppercase tracking-widest border ${styles[status]} ${status === 'atrasado' ? 'animate-pulse' : ''}`}>
        {icons[status]} {labels[status]}
      </span>
    );
  };

  const statsFinanceiras = useMemo(() => {
    let pagoVal = 0;
    let pendenteVal = 0;
    let atrasadoVal = 0;
    
    contas.forEach(c => {
      const val = Number(c.valor || 0);
      const status = getVencimentoStatus(c);
      if (status === 'pago') {
        pagoVal += val;
      } else if (status === 'atrasado') {
        atrasadoVal += val;
      } else {
        pendenteVal += val;
      }
    });
    
    const total = pagoVal + pendenteVal + atrasadoVal;
    const pctPago = total > 0 ? (pagoVal / total) * 100 : 0;
    const pctPendente = total > 0 ? (pendenteVal / total) * 100 : 0;
    const pctAtrasado = total > 0 ? (atrasadoVal / total) * 100 : 0;
    
    return {
      pagoVal,
      pendenteVal,
      atrasadoVal,
      total,
      pctPago,
      pctPendente,
      pctAtrasado
    };
  }, [contas]);

  // Filtragem e Ordenação
  const filtradas = contas.filter(c => {
    const matchesSearch = c.descricao.toLowerCase().includes(searchQuery.toLowerCase()) || c.categoria.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    const s = getVencimentoStatus(c);
    if (filtroStatus === 'pago') return s === 'pago';
    if (filtroStatus === 'pendente') return c.status === 'pendente'; 
    if (filtroStatus === 'atrasado') return s === 'atrasado';
    
    // Filtro por Período de Vencimento
    if (c.dataVencimento) {
      if (dataInicio && c.dataVencimento < dataInicio) return false;
      if (dataFim && c.dataVencimento > dataFim) return false;
    } else if (dataInicio || dataFim) {
      return false; // oculta contas sem data se houver filtro ativo
    }
    
    return true; 
  }).sort((a, b) => {
    if (ordenacao === 'vencimento-asc') {
      return new Date(a.dataVencimento) - new Date(b.dataVencimento);
    }
    if (ordenacao === 'vencimento-desc') {
      return new Date(b.dataVencimento) - new Date(a.dataVencimento);
    }
    if (ordenacao === 'valor-desc') {
      return Number(b.valor || 0) - Number(a.valor || 0);
    }
    if (ordenacao === 'valor-asc') {
      return Number(a.valor || 0) - Number(b.valor || 0);
    }
    if (ordenacao === 'nome-asc') {
      return a.descricao.localeCompare(b.descricao);
    }
    if (ordenacao === 'nome-desc') {
      return b.descricao.localeCompare(a.descricao);
    }
    return 0;
  });

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!contaObj.descricao || !contaObj.valor || !contaObj.dataVencimento) return toast.warn('Preencha os dados básicos');
    
    const numValor = parseFloat(contaObj.valor);
    if (isNaN(numValor) || numValor <= 0) return toast.error('Valor inválido');

    try {
      const p = { 
        descricao: contaObj.descricao, 
        categoria: contaObj.categoria, 
        valor: numValor, 
        dataVencimento: contaObj.dataVencimento, 
        status: contaObj.status 
      };

      if (contaObj.id) {
         await updateConta(contaObj.id, p);
         toast.success('Despesa atualizada com sucesso!');
      } else {
         await addConta(p);
         toast.success('Despesa lançada com sucesso!');
      }
      setModalOpen(false);
      setContaObj({ id: null, descricao: '', categoria: 'Outros', valor: '', dataVencimento: '', status: 'pendente' });
    } catch(e) {
      toast.error("Erro ao salvar conta");
    }
  };

  const handleExcluirClick = (id) => {
    setContaToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmarExcluir = async () => {
    if (!contaToDelete) return;
    try {
      console.log("Deletando despesa do banco com id:", contaToDelete);
      await deleteConta(contaToDelete);
      console.log("Despesa excluída com sucesso!");
      toast.success('Despesa excluída com sucesso!');
      setDeleteConfirmOpen(false);
      setContaToDelete(null);
    } catch (err) {
      console.error("Erro ao excluir conta do Firestore:", err);
      toast.error("Erro ao excluir despesa: " + err.message);
    }
  };

  const abrirParaEdicao = (c) => {
    setContaObj({
      id: c.id,
      descricao: c.descricao,
      categoria: c.categoria || 'Outros',
      valor: c.valor,
      dataVencimento: c.dataVencimento || '',
      status: c.status || 'pendente'
    });
    setModalOpen(true);
  };

  const formatData = (iso) => {
    if (!iso) return '-';
    const partes = iso.split('-');
    if (partes.length < 3) return iso;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  return (
    <div className={`${t.bg} min-h-screen font-sans pb-24 pt-4 px-4 sm:px-8 relative overflow-hidden transition-colors duration-300`}>
      {/* ─── NEBULA GLOWS (Tema Claro) ─── */}
      <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-blue-400/5 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[550px] h-[550px] bg-purple-400/5 rounded-full blur-[130px] pointer-events-none"></div>

      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className="w-full bg-white/70 border border-white/50 backdrop-blur-xl shadow-sm rounded-full h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin')} className="w-9 h-9 bg-[#F5F5F7] hover:bg-[#E5E5EA] rounded-full flex items-center justify-center transition-colors">
            <FaArrowLeft className="text-[#86868B] text-sm" />
          </button>
          <div className="hidden sm:block border-l border-[#E5E5EA] pl-4">
            <h1 className="font-semibold text-sm tracking-tight text-gray-900">Contas a Pagar</h1>
            <p className="text-[11px] text-slate-500 font-medium">Gestão de Saídas</p>
          </div>
        </div>
      </nav>

      <main className="w-full mt-8 relative z-10 px-2 sm:px-4">
        
        {/* ─── HEADER ─── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 px-2">
          <div>
            <h1 className={`text-3xl md:text-4xl font-extrabold tracking-tight ${t.textBlack}`}>Despesas</h1>
            <p className={`${t.textSecondary} text-sm mt-1.5 font-medium`}>Lance controle de equipe, insumos, internet e aluguel.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setContaObj({ id: null, descricao: '', categoria: 'Outros', valor: '', dataVencimento: '', status: 'pendente' }); setModalOpen(true); }} 
              className="flex items-center gap-2 bg-black hover:bg-gray-800 text-white px-6 py-3.5 rounded-full hover:scale-105 shadow-md font-bold text-sm transition-all active:scale-95">
              <FaPlus /> Lançar Despesa
            </button>
          </div>
        </div>

        {/* ─── STAT CARDS (BENTO) ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          {/* Saúde Financeira (Circular Progress Ring) */}
          <div className="bg-white border border-slate-200/60 rounded-[2rem] p-6 shadow-sm flex items-center justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-md">
            <div>
               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Saúde Financeira</p>
               <p className="text-3xl font-extrabold tracking-tight text-slate-900">{statsFinanceiras.pctPago.toFixed(0)}%</p>
               <p className="text-[11px] font-semibold text-slate-400 mt-1">Total quitado no mês</p>
            </div>
            <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Background Track */}
                <circle cx="50" cy="50" r="38" stroke="#F5F5F7" strokeWidth="8" fill="transparent" />
                {/* Pending Base */}
                <circle cx="50" cy="50" r="38" stroke="#FFE6E6" strokeWidth="8" fill="transparent"
                  strokeDasharray="238.76" strokeDashoffset={238.76 - (238.76 * (statsFinanceiras.pctPago + statsFinanceiras.pctPendente + statsFinanceiras.pctAtrasado)) / 100} />
                {/* Paid Ring */}
                <circle cx="50" cy="50" r="38" stroke="#1D7446" strokeWidth="8" fill="transparent"
                  strokeDasharray="238.76" strokeDashoffset={238.76 - (238.76 * statsFinanceiras.pctPago) / 100}
                  strokeLinecap="round" className="transition-all duration-500 ease-out" />
              </svg>
              <div className="absolute font-black text-xs text-slate-800">
                {statsFinanceiras.pctPago.toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Caixa Recebido (Success Tile) */}
          <div onClick={() => setFiltroStatus('pago')} className={`bg-white border border-slate-200/60 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-md cursor-pointer ${filtroStatus === 'pago' ? 'ring-2 ring-emerald-500 border-transparent shadow-md' : ''}`}>
            <div className="flex justify-between items-start mb-4">
               <div className="w-10 h-10 bg-[#F2FCDA] text-[#1D7446] rounded-full flex items-center justify-center"><FaCheckCircle size={16} /></div>
               <p className="text-[#1D7446] bg-[#F2FCDA]/50 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest">Quitado</p>
            </div>
            <div>
               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Total Pago</p>
               <p className="text-2xl font-extrabold tracking-tight text-slate-900">R$ {fmt(resumo.totalPago)}</p>
            </div>
          </div>

          {/* A Receber (Pending Tile) */}
          <div onClick={() => setFiltroStatus('pendente')} className={`bg-[#FFF2E6] border border-[#FFD9B3] rounded-[2rem] p-6 shadow-sm flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-md cursor-pointer ${filtroStatus === 'pendente' ? 'ring-2 ring-orange-500 border-transparent shadow-md' : ''}`}>
            <div className="flex justify-between items-start mb-4">
               <div className="w-10 h-10 bg-white text-[#FF8C00] rounded-full flex items-center justify-center"><FaExclamationCircle size={16} /></div>
               {resumo.aVencerBreve > 0 ? (
                 <p className="text-[#FF8C00] bg-white/60 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest animate-pulse">
                   {resumo.aVencerBreve} Urgentes
                 </p>
               ) : (
                 <p className="text-gray-500 bg-white/60 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest">Em Dia</p>
               )}
            </div>
            <div>
               <p className="text-[10px] font-bold text-[#FF8C00] uppercase tracking-widest mb-0.5">A Pagar (Aberto)</p>
               <p className="text-2xl font-extrabold tracking-tight text-[#FF8C00]">R$ {fmt(resumo.totalPendente)}</p>
            </div>
          </div>

          {/* Atrasados (Danger Tile) */}
          <div onClick={() => setFiltroStatus('atrasado')} className={`${resumo.atrasadas > 0 ? 'bg-[#FFE6E6] border-[#FFB3B3]' : 'bg-white border-slate-200/60'} rounded-[2rem] border p-6 shadow-sm flex flex-col justify-between relative overflow-hidden group transition-all duration-300 hover:scale-[1.02] hover:shadow-md cursor-pointer ${filtroStatus === 'atrasado' ? 'ring-2 ring-red-500 border-transparent shadow-md' : ''}`}>
            {resumo.atrasadas > 0 && <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all duration-1000"></div>}
            <div className="relative z-10 flex justify-between items-start mb-4">
               <div className={`w-10 h-10 rounded-full flex items-center justify-center ${resumo.atrasadas > 0 ? 'bg-red-500 text-white' : 'bg-[#F5F5F7] text-[#E5E5EA]'}`}><FaExclamationCircle size={16} /></div>
               <p className={`${resumo.atrasadas > 0 ? 'text-[#D0021B] bg-red-100' : 'text-[#86868B] bg-[#F5F5F7]'} px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest`}>
                 {resumo.atrasadas > 0 ? `${resumo.atrasadas} em atraso` : 'Em Dia 🎉'}
               </p>
            </div>
            <div className="relative z-10">
               <p className={`text-[10px] font-bold ${resumo.atrasadas > 0 ? 'text-[#D0021B]' : 'text-slate-500'} uppercase tracking-widest mb-0.5`}>Contas Atrasadas</p>
               <p className={`text-2xl font-extrabold tracking-tight ${resumo.atrasadas > 0 ? 'text-[#D0021B]' : 'text-gray-900'}`}>
                 R$ {fmt(statsFinanceiras.atrasadoVal)}
               </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Coluna Esquerda: Filtros e Tabela */}
          <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-6">
            {/* ─── FILTROS PILL-STYLE ─── */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 px-2">
          {/* Status Filters */}
          <div className="flex overflow-x-auto hide-scrollbar gap-2 w-full lg:w-auto pb-2 lg:pb-0">
            {[
              { id: 'todos', label: 'Todas as Contas' },
              { id: 'pendente', label: 'Pendentes' },
              { id: 'atrasado', label: 'Atrasadas' },
              { id: 'pago', label: 'Pagas' },
            ].map(s => (
              <button key={s.id} onClick={() => setFiltroStatus(s.id)}
                className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap active:scale-95
                  ${filtroStatus === s.id ? t.pillActive : t.pillInactive}`}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Search, Sort and Date controls */}
          <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Date Range Picker */}
            <div className="flex items-center gap-2 bg-white border border-gray-200/60 rounded-full px-4 py-2.5 shadow-sm text-xs font-bold text-slate-500 w-full sm:w-auto justify-between sm:justify-start">
              <span className="text-[10px] font-black uppercase text-slate-400">De:</span>
              <input 
                type="date" 
                value={dataInicio} 
                onChange={e => setDataInicio(e.target.value)}
                className="bg-transparent border-none outline-none text-xs text-slate-800 font-bold cursor-pointer" 
              />
              <span className="border-l border-gray-200 h-4 mx-1"></span>
              <span className="text-[10px] font-black uppercase text-slate-400">Até:</span>
              <input 
                type="date" 
                value={dataFim} 
                onChange={e => setDataFim(e.target.value)}
                className="bg-transparent border-none outline-none text-xs text-slate-800 font-bold cursor-pointer" 
              />
              {(dataInicio || dataFim) && (
                <button 
                  onClick={() => { setDataInicio(''); setDataFim(''); }}
                  className="ml-1 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                  title="Limpar período"
                >
                  <FaTimes className="text-[9px]" />
                </button>
              )}
            </div>

            {/* Search Pill */}
            <div className="relative w-full sm:w-64 bg-white border border-gray-200/60 rounded-full px-4 py-3 flex items-center shadow-sm transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
              <IoSearchOutline className="text-gray-400" size={16} />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-xs ml-2 w-full font-medium text-slate-800 placeholder-[#86868B]"
                placeholder="Buscar conta ou doc..." />
            </div>

            {/* Sort Select */}
            <select
              value={ordenacao}
              onChange={e => setOrdenacao(e.target.value)}
              className="px-4 py-3 bg-white border border-gray-200/60 rounded-full text-xs font-bold text-slate-700 outline-none cursor-pointer transition-all shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 appearance-none pr-8 relative min-w-[170px]"
              style={{
                backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 1rem center',
                backgroundSize: '0.8em'
              }}
            >
              <option value="vencimento-asc">📅 Vencimento (Próximo)</option>
              <option value="vencimento-desc">📅 Vencimento (Mais Distante)</option>
              <option value="valor-desc">💵 Valor (Maior Primeiro)</option>
              <option value="valor-asc">💵 Valor (Menor Primeiro)</option>
              <option value="nome-asc">🔤 Nome (A - Z)</option>
              <option value="nome-desc">🔤 Nome (Z - A)</option>
            </select>
          </div>
        </div>

        {/* ─── LIST VIEW (GLASS CARDS) ─── */}
        <div className={`${t.surface} rounded-[2rem] overflow-hidden transition-all duration-300 shadow-xl`}>
          {loading ? (
            <div className="divide-y divide-[#E5E5EA]">
               {[1,2,3,4].map(i => <SkeletonRow key={i} />)}
            </div>
          ) : filtradas.length === 0 ? (
            <div className="p-16 md:p-24 text-center flex flex-col items-center justify-center bg-white/40 backdrop-blur-md border border-gray-100 rounded-[2rem]">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 border border-slate-200 rounded-3xl flex items-center justify-center mb-6 shadow-sm transform hover:rotate-12 transition-transform duration-300">
                <IoBagRemoveOutline className="text-3xl text-slate-450" />
              </div>
              <h3 className="text-2xl font-extrabold text-gray-900 mb-2 font-sans tracking-tight">Nenhuma conta encontrada</h3>
              <p className="text-sm font-semibold text-slate-500 max-w-sm mb-8 leading-relaxed">
                Não localizamos contas para os filtros ativos. Tente redefinir a busca ou cadastre uma nova despesa no botão abaixo.
              </p>
              <button 
                onClick={() => { setContaObj({ id: null, descricao: '', categoria: 'Outros', valor: '', dataVencimento: '', status: 'pendente' }); setModalOpen(true); }}
                className="bg-black hover:bg-gray-800 text-white font-bold py-3.5 px-8 rounded-full text-xs uppercase tracking-wider transition-all active:scale-95 shadow-md flex items-center gap-2 hover:scale-[1.02]"
              >
                <FaPlus /> Lançar Nova Despesa
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-4 sm:p-6">
              {/* Cabeçalho Selecionar Todos */}
              <div className="flex items-center justify-between px-6 py-4 bg-gray-50/50 border border-gray-200/55 rounded-2xl select-none">
                <label className="flex items-center gap-3 cursor-pointer select-none font-bold text-xs text-slate-600 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={
                      filtradas.length > 0 && 
                      filtradas.filter(c => c.status !== 'pago').length > 0 && 
                      filtradas.filter(c => c.status !== 'pago').every(c => selectedIds.includes(c.id))
                    }
                    onChange={handleSelectAll}
                    className="w-5 h-5 rounded-lg border-gray-300 text-black focus:ring-black cursor-pointer accent-black"
                  />
                  <span>Selecionar Todos ({filtradas.filter(c => c.status !== 'pago').length} {filtradas.filter(c => c.status !== 'pago').length === 1 ? 'item' : 'itens'} pendentes)</span>
                </label>
                
                {selectedIds.length > 0 && (
                  <button
                    onClick={() => setSelectedIds([])}
                    className="text-xs font-bold text-red-500 hover:text-red-750 transition-colors uppercase tracking-wider"
                  >
                    Limpar Seleção ({selectedIds.length})
                  </button>
                )}
              </div>

               {filtradas.map(conta => (
                 <div key={conta.id} className={`bg-white/80 border hover:bg-white rounded-[1.5rem] p-4 sm:p-4.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:shadow-lg transition-all duration-300 group ${selectedIds.includes(conta.id) ? 'border-slate-800 bg-slate-50/50 shadow-sm ring-1 ring-slate-200' : 'border-gray-150/60'}`}>
                    
                    <div className="flex items-center gap-4 flex-[2] min-w-0">
                      {/* Checkbox de Seleção */}
                      <input
                        type="checkbox"
                        disabled={conta.status === 'pago'}
                        checked={selectedIds.includes(conta.id)}
                        onChange={() => handleToggleSelect(conta.id)}
                        className={`w-5 h-5 rounded-lg border-gray-300 text-black focus:ring-black shrink-0 transition-transform active:scale-90 ${
                          conta.status === 'pago' 
                            ? 'opacity-40 cursor-not-allowed bg-gray-100 border-gray-200' 
                            : 'cursor-pointer accent-black'
                        }`}
                      />
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-sm transition-all duration-300 group-hover:scale-105 ${getCategoryStyle(conta.categoria).bg}`}>
                        {getCategoryStyle(conta.categoria).icon}
                      </div>
                      <div className="cursor-pointer flex-1 min-w-0" onClick={() => abrirParaEdicao(conta)}>
                        <p className="font-bold text-base text-gray-900 truncate hover:text-blue-500 transition-colors">{conta.descricao}</p>
                        <p className="text-xs font-semibold text-slate-550 mt-0.5">{conta.categoria}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between lg:flex-col lg:items-start flex-1 gap-1 border-t border-b border-gray-100/50 py-3 lg:py-0 lg:border-0">
                       <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Vencimento</span>
                       <p className="text-sm font-bold text-gray-900 lg:mt-0.5">{formatData(conta.dataVencimento)}</p>
                    </div>

                    <div className="flex items-center justify-between lg:flex-col lg:items-start flex-1 gap-1 py-1 lg:py-0">
                       <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Valor Total</span>
                       <p className="font-black text-xl tabular-nums text-gray-900 lg:mt-0.5">R$ {fmt(conta.valor)}</p>
                    </div>

                    <div className="flex items-center lg:justify-start flex-[1.2]">
                       {getStatusBadge(conta)}
                    </div>

                    <div className="flex flex-row items-center gap-2 justify-end mt-2 pt-4 border-t border-[#E5E5EA] lg:border-0 lg:pt-0 lg:mt-0">
                      
                      <button onClick={() => handleExcluirClick(conta.id)}
                        className="w-10 h-10 bg-white border border-[#E5E5EA] hover:text-red-500 hover:bg-red-55 hover:border-red-100 rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95"
                        title="Excluir despesa">
                        <FaTrash size={12} />
                      </button>

                      {conta.status === 'pago' ? (
                          <button onClick={() => togglePago(conta)}
                            className="bg-white border border-[#E5E5EA] px-4 py-2.5 rounded-full text-xs font-bold text-[#D0021B] hover:bg-[#FFE6E6] hover:border-[#FFE6E6] transition-all shadow-sm active:scale-95 flex items-center gap-2">
                            <FaUndo /> Estornar
                          </button>
                      ) : (
                          <button onClick={() => togglePago(conta)}
                            className="bg-black border border-black px-4 py-2.5 rounded-full text-xs font-bold text-white hover:bg-gray-800 transition-all shadow-sm active:scale-95 flex items-center gap-2">
                            <FaCheck /> Dar Baixa
                          </button>
                      )}
                    </div>

                 </div>
               ))}
            </div>
          )}
        </div>

          </div> {/* Fim da Coluna Esquerda */}

          {/* Coluna Direita: Widgets Analíticos */}
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6">
            {/* Widget 1: Despesas por Categoria */}
            <div className="bg-white border border-slate-200/60 rounded-[2rem] p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider mb-5 flex items-center gap-2 border-b border-gray-100 pb-3">
                📊 Despesas por Categoria
              </h3>
              <div className="space-y-4">
                {distribuicaoCategorias.map(item => {
                  const style = getCategoryStyle(item.name);
                  return (
                    <div key={item.name} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-700 flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-md flex items-center justify-center text-sm ${style.bg}`}>
                            {style.icon}
                          </span>
                          {item.name}
                        </span>
                        <span className="text-slate-900 font-black">R$ {fmt(item.value)}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${getCategoryProgressColor(item.name)}`}
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold text-right">
                        {item.percentage.toFixed(1)}% do total
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Widget 2: Próximos Vencimentos */}
            <div className="bg-white border border-slate-200/60 rounded-[2rem] p-6 shadow-sm">
              <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wider mb-5 flex items-center gap-2 border-b border-gray-100 pb-3">
                ⏰ Próximos Vencimentos
              </h3>
              <div className="space-y-3.5">
                {proximosVencimentos.length === 0 ? (
                  <p className="text-xs text-slate-450 italic py-6 text-center">Nenhuma conta pendente.</p>
                ) : (
                  proximosVencimentos.map(c => {
                    const style = getCategoryStyle(c.categoria);
                    const status = getVencimentoStatus(c);
                    const isAtrasado = status === 'atrasado';
                    const isVenceLogo = status === 'vencendo';
                    return (
                      <div key={c.id} onClick={() => abrirParaEdicao(c)} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 cursor-pointer transition-all duration-300">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${style.bg}`}>
                            {style.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-900 truncate">{c.descricao}</p>
                            <p className={`text-[10px] font-bold ${
                              isAtrasado 
                                ? 'text-red-500 animate-pulse' 
                                : isVenceLogo 
                                  ? 'text-orange-500' 
                                  : 'text-slate-400'
                            }`}>
                              Vence {formatData(c.dataVencimento)} {isAtrasado && '(Atrasado)'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-xs font-black text-gray-950">R$ {fmt(c.valor)}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div> {/* Fim da Coluna Direita */}
        </div>

        {/* ─── MODAL ADD/EDIT ─── */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] px-4 animate-fadeIn" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
            <div className="bg-white border border-gray-100 rounded-[2rem] p-8 w-full max-w-lg shadow-2xl relative transition-all duration-300">
              
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                    {contaObj.id ? 'Editar Conta' : 'Lançar Despesa'}
                  </h2>
                  <p className="text-xs font-semibold text-slate-500 mt-1">
                    Cadastre uma nova obrigação financeira.
                  </p>
                </div>
                <button onClick={() => setModalOpen(false)} className="w-10 h-10 bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E5E5EA] rounded-full transition-colors flex items-center justify-center">
                  <FaTimes />
                </button>
              </div>
              
              <form onSubmit={handleSalvar} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Descrição / Fornecedor</label>
                  <input type="text" placeholder="Ex: Pagamento Garçom fds, Aluguel Loja..." required
                    className="w-full bg-[#F5F5F7] border border-[#E5E5EA] focus:border-black focus:bg-white focus:ring-4 focus:ring-black/5 px-5 py-4 rounded-3xl outline-none transition-all text-sm font-semibold text-gray-900 shadow-sm" 
                    value={contaObj.descricao}
                    onChange={e => setContaObj({...contaObj, descricao: e.target.value})} />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Categoria</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {categorias.map(c => {
                      const style = getCategoryStyle(c);
                      const isSelected = contaObj.categoria === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setContaObj({...contaObj, categoria: c})}
                          className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                            isSelected 
                              ? `${style.bg} border-current ring-1 ring-current font-bold scale-[1.03] shadow-sm`
                              : 'bg-[#F5F5F7] hover:bg-[#E5E5EA] border-[#E5E5EA] text-[#1D1D1F]'
                          }`}
                        >
                          <span className="mb-1 text-lg">{style.icon}</span>
                          <span className="text-[10px] truncate max-w-full">{c}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Valor Total</label>
                    <div className="relative">
                      <span className="absolute left-5 top-[18px] text-[#86868B] text-sm font-bold">R$</span>
                      <input type="number" step="0.01" placeholder="0.00" required
                        className="w-full bg-[#F5F5F7] border border-[#E5E5EA] focus:border-black focus:bg-white focus:ring-4 focus:ring-black/5 pl-12 pr-5 py-4 rounded-3xl outline-none transition-all font-bold text-gray-900 text-lg tabular-nums shadow-sm" 
                        value={contaObj.valor}
                        onChange={e => setContaObj({...contaObj, valor: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Vencimento</label>
                    <input type="date" required
                      className="w-full bg-[#F5F5F7] border border-[#E5E5EA] focus:border-black focus:bg-white focus:ring-4 focus:ring-black/5 px-5 py-4 rounded-3xl outline-none transition-all text-sm font-semibold text-gray-900 shadow-sm cursor-pointer" 
                      value={contaObj.dataVencimento}
                      onChange={e => setContaObj({...contaObj, dataVencimento: e.target.value})} />
                  </div>
                </div>

                <div className="flex gap-4 mt-8 pt-6 border-t border-slate-100">
                  <button type="button" onClick={() => setModalOpen(false)} className="flex-[0.5] py-4 bg-white border border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#F5F5F7] border rounded-full font-bold text-sm transition-colors">
                    Descartar
                  </button>
                  <button type="submit" className="flex-1 py-4 bg-black hover:bg-gray-800 text-white border-black rounded-full font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2">
                    <FaCheckCircle /> Salvar Despesa
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL CONFIRMAÇÃO EXCLUSÃO CUSTOMIZADO ─── */}
        {deleteConfirmOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] px-4 animate-fadeIn" onClick={() => { setDeleteConfirmOpen(false); setContaToDelete(null); }}>
            <div className="bg-white border border-gray-100 rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative transition-all duration-300 animate-scaleUp" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6 animate-pulse">
                  <FaExclamationCircle size={32} />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">
                  Excluir Despesa?
                </h2>
                <p className="text-sm text-slate-500 mb-8 px-4">
                  Esta ação não pode ser desfeita. A conta será removida permanentemente do banco de dados e do controle financeiro.
                </p>
                <div className="flex gap-4 w-full">
                  <button type="button" onClick={() => { setDeleteConfirmOpen(false); setContaToDelete(null); }} 
                    className="flex-1 py-4 bg-white border border-gray-200 text-slate-750 hover:bg-gray-50 border rounded-full font-bold text-sm transition-colors active:scale-95">
                    Cancelar
                  </button>
                  <button type="button" onClick={confirmarExcluir} 
                    className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold text-sm shadow-lg shadow-red-600/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                    Sim, Excluir
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL CONFIRMAÇÃO BAIXA EM LOTE CUSTOMIZADO ─── */}
        {loteConfirmOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] px-4 animate-fadeIn" onClick={() => setLoteConfirmOpen(false)}>
            <div className="bg-white border border-gray-100 rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative transition-all duration-300 animate-scaleUp" onClick={e => e.stopPropagation()}>
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-blue-500/10 text-blue-600 rounded-full flex items-center justify-center mb-6">
                  <FaCheckCircle size={32} />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">
                  Dar Baixa em Lote?
                </h2>
                <p className="text-sm text-slate-550 mb-8 px-4 leading-relaxed">
                  Você está prestes a quitar <strong className="text-gray-900 font-bold">{contas.filter(c => selectedIds.includes(c.id) && c.status !== 'pago').length}</strong> contas selecionadas, no valor total de <strong className="text-emerald-600 font-extrabold text-base">R$ {fmt(totalSelecionado)}</strong>.
                </p>
                <div className="flex gap-4 w-full">
                  <button type="button" onClick={() => setLoteConfirmOpen(false)} 
                    className="flex-1 py-4 bg-white border border-gray-200 text-slate-750 hover:bg-gray-50 border rounded-full font-bold text-sm transition-colors active:scale-95">
                    Cancelar
                  </button>
                  <button type="button" onClick={confirmarDarBaixaLote} 
                    className="flex-1 py-4 bg-black hover:bg-gray-800 text-white rounded-full font-bold text-sm shadow-lg shadow-black/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                    Quitar Contas
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── FLOATING SELECTION SUMMARY ─── */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl bg-slate-900/95 border border-slate-800 backdrop-blur-xl rounded-3xl py-4 px-6 md:px-8 text-white flex flex-col md:flex-row items-center justify-between gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-50 animate-slideUp">
            <div className="flex items-center gap-4 text-center md:text-left">
              <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0">
                <span className="font-black text-sm">{selectedIds.length}</span>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Boletos Selecionados</p>
                <p className="text-sm font-semibold text-slate-300">
                  Soma selecionada:{' '}
                  <span className="text-xl font-black text-orange-400">R$ {fmt(totalSelecionado)}</span>
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleDarBaixaLoteClick}
                className="bg-white hover:bg-slate-100 text-slate-900 font-black py-2.5 px-6 rounded-full text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center gap-2"
              >
                <FaCheck /> Dar Baixa em Lote
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 hover:border-transparent font-bold py-2.5 px-6 rounded-full text-xs uppercase tracking-wider transition-all active:scale-95"
              >
                Cancelar Seleção
              </button>
            </div>
          </div>
        )}

      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
        .tabular-nums { font-variant-numeric: tabular-nums; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-slideUp {
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}

export default ContasPagar;
