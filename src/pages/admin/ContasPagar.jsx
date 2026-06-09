import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useContasPagarData } from '../../hooks/useContasPagarData';
import { 
  FaCheck, FaTimes, FaPlus, FaUndo, FaArrowLeft, 
  FaExclamationCircle, FaCheckCircle, FaCalendarAlt, FaTrash
} from 'react-icons/fa';
import { IoSearchOutline, IoBagRemoveOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';

const categorias = ['Garçons / Equipe', 'Aluguel', 'Internet', 'Insumos', 'Água/Luz', 'Impostos', 'Outros'];

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

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  // Filtragem
  const filtradas = contas.filter(c => {
    const matchesSearch = c.descricao.toLowerCase().includes(searchQuery.toLowerCase()) || c.categoria.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    const s = getVencimentoStatus(c);
    if (filtroStatus === 'pago') return s === 'pago';
    if (filtroStatus === 'pendente') return c.status === 'pendente'; 
    if (filtroStatus === 'atrasado') return s === 'atrasado';
    
    return true; 
  });

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!contaObj.descricao || !contaObj.valor || !contaObj.dataVencimento) return alert('Preencha os dados básicos');
    
    const numValor = parseFloat(contaObj.valor);
    if (isNaN(numValor) || numValor <= 0) return alert('Valor inválido');

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
      } else {
         await addConta(p);
      }
      setModalOpen(false);
      setContaObj({ id: null, descricao: '', categoria: 'Outros', valor: '', dataVencimento: '', status: 'pendente' });
    } catch(e) {
      alert("Erro ao salvar conta");
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
      setDeleteConfirmOpen(false);
      setContaToDelete(null);
    } catch (err) {
      console.error("Erro ao excluir conta do Firestore:", err);
      alert("Erro ao excluir despesa: " + err.message);
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
      <nav className="max-w-[1400px] mx-auto bg-white/70 border border-white/50 backdrop-blur-xl shadow-sm rounded-full h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all">
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

      <main className="max-w-[1400px] mx-auto mt-8 relative z-10">
        
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
          
          {/* Caixa Recebido (Success Tile) */}
          <div className="bg-white border border-slate-200/60 rounded-[2rem] p-6 shadow-sm flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-md">
            <div className="flex justify-between items-start mb-6">
               <div className="w-12 h-12 bg-[#F2FCDA] text-[#1D7446] rounded-full flex items-center justify-center"><FaCheckCircle size={20} /></div>
               <p className="text-[#1D7446] bg-[#F2FCDA]/50 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Quitado</p>
            </div>
            <div>
               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Pago</p>
               <p className="text-3xl font-extrabold tracking-tight text-slate-900">R$ {fmt(resumo.totalPago)}</p>
            </div>
          </div>

          {/* A Receber (Pending Tile) */}
          <div className="bg-[#FFF2E6] border border-[#FFD9B3] rounded-[2rem] p-6 shadow-sm flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] hover:shadow-md">
            <div className="flex justify-between items-start mb-6">
               <div className="w-12 h-12 bg-white text-[#FF8C00] rounded-full flex items-center justify-center"><FaExclamationCircle size={20} /></div>
               {resumo.aVencerBreve > 0 ? (
                 <p className="text-[#FF8C00] bg-white/60 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest animate-pulse">
                   {resumo.aVencerBreve} Urgentes
                 </p>
               ) : (
                 <p className="text-gray-500 bg-white/60 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Em Dia</p>
               )}
            </div>
            <div>
               <p className="text-xs font-bold text-[#FF8C00] uppercase tracking-widest mb-1">A Pagar (Aberto)</p>
               <p className="text-3xl font-extrabold tracking-tight text-[#FF8C00]">R$ {fmt(resumo.totalPendente)}</p>
            </div>
          </div>

          {/* Atrasados (Danger Tile) */}
          <div className={`${resumo.atrasadas > 0 ? 'bg-[#FFE6E6] border-[#FFB3B3]' : 'bg-white border-slate-200/60'} rounded-[2rem] border p-6 shadow-sm flex flex-col justify-between relative overflow-hidden group transition-all duration-300 hover:scale-[1.02] hover:shadow-md`}>
            {resumo.atrasadas > 0 && <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl group-hover:bg-red-500/20 transition-all duration-1000"></div>}
            <div className="relative z-10 flex justify-between items-start mb-6">
               <div className={`w-12 h-12 rounded-full flex items-center justify-center ${resumo.atrasadas > 0 ? 'bg-red-500 text-white' : 'bg-[#F5F5F7] text-[#E5E5EA]'}`}><FaExclamationCircle size={20} /></div>
               <p className={`${resumo.atrasadas > 0 ? 'text-[#D0021B] bg-red-100' : 'text-[#86868B] bg-[#F5F5F7]'} px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest`}>
                 {resumo.atrasadas > 0 ? `${resumo.atrasadas} em atraso` : 'Em Dia 🎉'}
               </p>
            </div>
            <div className="relative z-10">
               <p className={`text-xs font-bold ${resumo.atrasadas > 0 ? 'text-[#D0021B]' : 'text-slate-500'} uppercase tracking-widest mb-1`}>Contas Atrasadas</p>
               <p className={`text-3xl font-extrabold tracking-tight ${resumo.atrasadas > 0 ? 'text-[#D0021B]' : 'text-gray-900'}`}>
                 {resumo.atrasadas > 0 ? `Tire do atraso` : `Tudo certo`}
               </p>
            </div>
          </div>

        </div>

        {/* ─── FILTROS PILL-STYLE ─── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 px-2">
          {/* Status Filters */}
          <div className="flex overflow-x-auto hide-scrollbar gap-2 w-full sm:w-auto pb-2 sm:pb-0">
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

          {/* Search Pill */}
          <div className="relative w-full sm:w-64 bg-white border border-gray-200/60 border rounded-full px-4 py-3 flex items-center shadow-sm transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
            <IoSearchOutline className="text-gray-400" size={16} />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-xs ml-2 w-full font-medium text-slate-800 placeholder-[#86868B]"
              placeholder="Buscar conta ou doc..." />
          </div>
        </div>

        {/* ─── LIST VIEW (GLASS CARDS) ─── */}
        <div className={`${t.surface} rounded-[2rem] overflow-hidden transition-all duration-300 shadow-xl`}>
          {loading ? (
            <div className="divide-y divide-[#E5E5EA]">
               {[1,2,3,4].map(i => <SkeletonRow key={i} />)}
            </div>
          ) : filtradas.length === 0 ? (
            <div className="p-20 text-center">
              <div className="w-16 h-16 bg-[#F5F5F7] rounded-3xl mx-auto flex items-center justify-center mb-6">
                <FaTrash className="text-2xl text-gray-450" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Paz financeira</h3>
              <p className="text-sm font-medium text-slate-500">Sua busca não encontrou nenhuma conta registrada.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-4 sm:p-6">
               {filtradas.map(conta => (
                 <div key={conta.id} className="bg-white/80 border border-gray-150/60 hover:bg-white hover:border-gray-300 rounded-[1.5rem] p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:shadow-lg transition-all duration-300 group">
                    
                    <div className="flex items-center gap-4 flex-[2] min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] flex items-center justify-center text-slate-500 shrink-0">
                        <IoBagRemoveOutline className="text-xl" />
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
                <button onClick={() => setModalOpen(false)} className="w-10 h-10 bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E5E5EA] rounded-full transition-colors flex items-center justify-center"><FaTimes /></button>
              </div>
              
              <form onSubmit={handleSalvar} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Descrição / Fornecedor</label>
                  <input type="text" placeholder="Ex: Pagamento Garçom fds, Aluguel Loja..." required
                    className="w-full bg-[#F5F5F7] border border-[#E5E5EA] focus:border-black focus:bg-white border px-5 py-4 rounded-3xl outline-none transition-all text-sm font-semibold text-gray-900" 
                    value={contaObj.descricao}
                    onChange={e => setContaObj({...contaObj, descricao: e.target.value})} />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Categoria</label>
                  <div className="relative">
                    <select className="w-full bg-[#F5F5F7] border border-[#E5E5EA] focus:border-black focus:bg-white border px-5 py-4 rounded-3xl outline-none transition-all text-sm font-semibold text-gray-900 appearance-none"
                      value={contaObj.categoria}
                      onChange={e => setContaObj({...contaObj, categoria: e.target.value})}>
                      {categorias.map(c => <option key={c} value={c} className="bg-white text-black">{c}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-gray-505">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Valor Total</label>
                    <div className="relative">
                      <span className="absolute left-5 top-[18px] text-[#86868B] text-sm font-bold">R$</span>
                      <input type="number" step="0.01" placeholder="0.00" required
                        className="w-full bg-[#F5F5F7] border border-[#E5E5EA] focus:border-black focus:bg-white border pl-12 pr-5 py-4 rounded-3xl outline-none transition-all font-bold text-gray-900 text-lg tabular-nums" 
                        value={contaObj.valor}
                        onChange={e => setContaObj({...contaObj, valor: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Vencimento</label>
                    <input type="date" required
                      className="w-full bg-[#F5F5F7] border border-[#E5E5EA] focus:border-black focus:bg-white border px-5 py-4 rounded-3xl outline-none transition-all text-sm font-semibold text-gray-900" 
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
                    className="flex-1 py-4 bg-red-650 hover:bg-red-500 text-white rounded-full font-bold text-sm shadow-lg shadow-red-500/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                    Sim, Excluir
                  </button>
                </div>
              </div>
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
      `}</style>
    </div>
  );
}

export default ContasPagar;
