import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useContasPagarData } from '../../hooks/useContasPagarData';
import { differenceInDays, parseISO } from 'date-fns';
import { 
  FaCheck, FaTimes, FaPlus, FaUndo, FaArrowLeft, FaMoneyBillWave, 
  FaExclamationCircle, FaCheckCircle, FaCalendarAlt, FaWallet,
  FaSearch, FaLayerGroup, FaTrash
} from 'react-icons/fa';
import { IoSearchOutline, IoBagRemoveOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';

const categorias = ['Garçons / Equipe', 'Aluguel', 'Internet', 'Insumos', 'Água/Luz', 'Impostos', 'Outros'];

// Skeleton loader
const SkeletonRow = () => (
  <div className="p-5 flex flex-col md:flex-row md:items-center gap-4 animate-pulse border-b border-[#E5E5EA]">
    <div className="w-12 h-12 bg-slate-100 rounded-2xl"></div>
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-slate-100 rounded-lg w-40"></div>
      <div className="h-3 bg-slate-50 rounded-lg w-24"></div>
    </div>
    <div className="h-4 bg-slate-100 rounded-lg w-20"></div>
    <div className="h-6 bg-slate-100 rounded-lg w-24 md:w-32"></div>
    <div className="h-8 bg-slate-100 rounded-full w-20"></div>
  </div>
);

function ContasPagar() {
  const navigate = useNavigate();
  const { userData, currentUser , estabelecimentoIdPrincipal } = useAuth();
  const estabId = estabelecimentoIdPrincipal || currentUser?.estabelecimentoId;
  
  const { contas, loading, resumo, addConta, updateConta, deleteConta, togglePago } = useContasPagarData(estabId);

  const [filtroStatus, setFiltroStatus] = useState('todos'); // todos, pendente, pago, atrasado
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [contaObj, setContaObj] = useState({ id: null, descricao: '', categoria: 'Outros', valor: '', dataVencimento: '', status: 'pendente' });

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
      pago: 'bg-[#F2FCDA] text-[#1D7446] border-[#D0F2A8]',
      atrasado: 'bg-[#FFE6E6] text-[#D0021B] border-[#FFB3B3]',
      vencendo: 'bg-[#FFF2E6] text-[#FF8C00] border-[#FFD9B3]',
      pendente: 'bg-[#F5F5F7] text-[#86868B] border-[#E5E5EA]',
    };
    const icons = {
      pago: <FaCheckCircle />, atrasado: <FaExclamationCircle />,
      vencendo: <FaExclamationCircle />, pendente: <FaCalendarAlt />,
    };
    const labels = { pago: 'PAGO', atrasado: 'ATRASADO', vencendo: 'VENCE LOGO', pendente: 'PENDENTE' };

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[10px] sm:text-xs font-bold rounded-full uppercase tracking-widest border ${styles[status]} ${status === 'atrasado' ? 'animate-pulse' : ''}`}>
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
    if (filtroStatus === 'pendente') return c.status === 'pendente'; // todos que não estão pagos
    if (filtroStatus === 'atrasado') return s === 'atrasado';
    
    return true; // todos
  });

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!contaObj.descricao || !contaObj.valor || !contaObj.dataVencimento) return alert('Preencha os dados básicos');
    
    // Tratando float
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

  const handleExcluir = async (id) => {
    if (window.confirm("Confirma a exclusão dessa conta?")) {
      await deleteConta(id);
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
    <div className="bg-[#F5F5F7] min-h-screen font-sans text-[#1D1D1F] pb-24 pt-4 px-4 sm:px-8">
      
      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className="max-w-[1400px] mx-auto bg-white/70 backdrop-blur-xl border border-white/50 shadow-sm rounded-full h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin')} className="w-9 h-9 bg-[#F5F5F7] hover:bg-[#E5E5EA] rounded-full flex items-center justify-center transition-colors">
            <FaArrowLeft className="text-[#86868B] text-sm" />
          </button>
          <div className="hidden sm:block border-l border-[#E5E5EA] pl-4">
            <h1 className="font-semibold text-sm tracking-tight text-black">Contas a Pagar</h1>
            <p className="text-[11px] text-[#86868B] font-medium">Gestão de Saídas</p>
          </div>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto mt-8">
        
        {/* ─── HEADER ─── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 px-2">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-[#1D1D1F] tracking-tight">Despesas</h1>
            <p className="text-[#86868B] text-sm mt-1 font-medium">Lance controle de equipe, insumos, internet e aluguel.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setContaObj({ id: null, descricao: '', categoria: 'Outros', valor: '', dataVencimento: '', status: 'pendente' }); setModalOpen(true); }} 
              className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-full hover:scale-105 shadow-md font-bold text-sm transition-all active:scale-95">
              <FaPlus /> Lançar Despesa
            </button>
          </div>
        </div>

        {/* ─── STAT CARDS (BENTO) ─── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
          
          {/* Caixa Recebido (Success Tile) */}
          <div className="bg-white rounded-[2rem] border border-[#E5E5EA] p-6 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-6">
               <div className="w-12 h-12 bg-[#F2FCDA] rounded-full flex items-center justify-center text-[#1D7446]"><FaCheckCircle size={20} /></div>
               <p className="text-[#1D7446] bg-[#F2FCDA]/50 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Quitado</p>
            </div>
            <div>
               <p className="text-sm font-semibold text-[#86868B] uppercase tracking-widest mb-1">Total Pago</p>
               <p className="text-3xl font-bold tracking-tight text-[#1D1D1F]">R$ {fmt(resumo.totalPago)}</p>
            </div>
          </div>

          {/* A Receber (Pending Tile) */}
          <div className="bg-[#FFF2E6] rounded-[2rem] border border-[#FFD9B3] p-6 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-6">
               <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#FF8C00]"><FaExclamationCircle size={20} /></div>
               <p className="text-[#FF8C00] bg-white/60 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">{resumo.aVencerBreve} urgentes</p>
            </div>
            <div>
               <p className="text-sm font-semibold text-[#FF8C00] uppercase tracking-widest mb-1">A Pagar (Aberto)</p>
               <p className="text-3xl font-bold tracking-tight text-[#FF8C00]">R$ {fmt(resumo.totalPendente)}</p>
            </div>
          </div>

          {/* Atrasados (Danger Tile) */}
          <div className={`rounded-[2rem] p-6 shadow-md flex flex-col justify-between relative overflow-hidden group border ${resumo.atrasadas > 0 ? 'bg-[#FFE6E6] border-[#FFB3B3]' : 'bg-white border-[#E5E5EA]'}`}>
            {resumo.atrasadas > 0 && <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl group-hover:bg-red-500/20 transition-all duration-1000"></div>}
            <div className="relative z-10 flex justify-between items-start mb-6">
               <div className={`w-12 h-12 rounded-full flex items-center justify-center ${resumo.atrasadas > 0 ? 'bg-red-500 text-white' : 'bg-[#F5F5F7] text-[#E5E5EA]'}`}><FaExclamationCircle size={20} /></div>
               <p className={`${resumo.atrasadas > 0 ? 'text-[#D0021B]' : 'text-[#86868B]'} ${resumo.atrasadas > 0 ? 'bg-red-100' : 'bg-[#F5F5F7]'} px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest`}>
                 {resumo.atrasadas > 0 ? `${resumo.atrasadas} em atraso` : 'Em Dia 🎉'}
               </p>
            </div>
            <div className="relative z-10">
               <p className={`text-sm font-semibold ${resumo.atrasadas > 0 ? 'text-[#D0021B]' : 'text-[#86868B]'} uppercase tracking-widest mb-1`}>Contas Atrasadas</p>
               <p className={`text-3xl font-bold tracking-tight ${resumo.atrasadas > 0 ? 'text-[#D0021B]' : 'text-[#86868B]'}`}>
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
                className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap 
                  ${filtroStatus === s.id ? 'bg-black text-white shadow-md' : 'bg-white border border-[#E5E5EA] text-[#86868B] hover:text-black hover:border-gray-300'}`}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Search Pill */}
          <div className="relative w-full sm:w-64 bg-white border border-[#E5E5EA] rounded-full px-4 py-3 flex items-center shadow-sm">
            <IoSearchOutline className="text-[#86868B]" size={16} />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-xs ml-2 w-full font-medium placeholder-[#86868B]"
              placeholder="Buscar conta ou doc..." />
          </div>
        </div>

        {/* ─── LIST VIEW ─── */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-[#E5E5EA] overflow-hidden">
          {loading ? (
            <div className="divide-y divide-[#E5E5EA]">
               {[1,2,3,4].map(i => <SkeletonRow key={i} />)}
            </div>
          ) : filtradas.length === 0 ? (
            <div className="p-20 text-center">
              <div className="w-16 h-16 bg-[#F5F5F7] rounded-3xl mx-auto flex items-center justify-center mb-6">
                <FaSearch className="text-2xl text-[#86868B]" />
              </div>
              <h3 className="text-xl font-bold text-[#1D1D1F] mb-2">Paz financeira</h3>
              <p className="text-sm font-medium text-[#86868B]">Sua busca não encontrou nenhuma conta registrada.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#E5E5EA]">
               {filtradas.map(conta => (
                 <div key={conta.id} className="p-6 md:p-8 flex flex-col lg:flex-row lg:items-center gap-4 hover:bg-[#F5F5F7]/50 transition-colors group">
                    <div className="flex items-center gap-4 flex-[2]">
                      <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA] flex items-center justify-center text-[#86868B] shrink-0">
                        <IoBagRemoveOutline className="text-lg" />
                      </div>
                      <div className="cursor-pointer" onClick={() => abrirParaEdicao(conta)}>
                        <p className="font-bold text-base text-[#1D1D1F] line-clamp-1 hover:text-blue-600 transition-colors">{conta.descricao}</p>
                        <p className="text-xs font-semibold text-[#86868B] mt-0.5">{conta.categoria}</p>
                      </div>
                    </div>

                    <div className="flex flex-row justify-between lg:flex-col lg:justify-center flex-1 gap-1">
                       <p className="text-sm font-semibold text-[#86868B]">Venc: {formatData(conta.dataVencimento)}</p>
                       <p className="font-bold text-xl tabular-nums text-[#1D1D1F]">R$ {fmt(conta.valor)}</p>
                    </div>

                    <div className="flex-[1.5] w-full lg:w-auto">
                       {getStatusBadge(conta)}
                    </div>

                    <div className="flex flex-row items-center gap-2 justify-end flex-1 mt-2 pt-4 border-t border-[#E5E5EA] lg:border-0 lg:pt-0 lg:mt-0">
                      
                      <button onClick={() => handleExcluir(conta.id)}
                        className="w-10 h-10 bg-white border border-[#E5E5EA] rounded-full flex items-center justify-center text-[#86868B] hover:text-red-500 hover:bg-red-50 hover:border-red-100 transition-all shadow-sm active:scale-95"
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
          <div className="fixed inset-0 bg-[#1D1D1F]/40 backdrop-blur-sm flex items-center justify-center z-[100] px-4" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
            <div className="bg-white rounded-[2rem] p-8 w-full max-w-lg shadow-2xl border border-white">
              
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
                    {contaObj.id ? 'Editar Conta' : 'Lançar Despesa'}
                  </h2>
                  <p className="text-xs font-semibold text-[#86868B] mt-1">
                    Cadastre uma nova obrigação financeira.
                  </p>
                </div>
                <button onClick={() => setModalOpen(false)} className="w-10 h-10 bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E5E5EA] rounded-full transition-colors flex items-center justify-center"><FaTimes /></button>
              </div>
              
              <form onSubmit={handleSalvar} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#86868B] mb-2">Descrição / Fornecedor</label>
                  <input type="text" placeholder="Ex: Pagamento Garçom fds, Aluguel Loja..." required
                    className="w-full bg-[#F5F5F7] border border-[#E5E5EA] px-5 py-4 rounded-3xl outline-none focus:border-black focus:bg-white transition-all text-sm font-semibold text-[#1D1D1F]" 
                    value={contaObj.descricao}
                    onChange={e => setContaObj({...contaObj, descricao: e.target.value})} />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#86868B] mb-2">Categoria</label>
                  <select className="w-full bg-[#F5F5F7] border border-[#E5E5EA] px-5 py-4 rounded-3xl outline-none focus:border-black focus:bg-white transition-all text-sm font-semibold text-[#1D1D1F] appearance-none"
                    value={contaObj.categoria}
                    onChange={e => setContaObj({...contaObj, categoria: e.target.value})}>
                    {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#86868B] mb-2">Valor Total</label>
                    <div className="relative">
                      <span className="absolute left-5 top-[18px] text-[#86868B] text-sm font-bold">R$</span>
                      <input type="number" step="0.01" placeholder="0.00" required
                        className="w-full bg-[#F5F5F7] border border-[#E5E5EA] pl-12 pr-5 py-4 rounded-3xl outline-none focus:border-black focus:bg-white transition-all font-bold text-[#1D1D1F] text-lg tabular-nums" 
                        value={contaObj.valor}
                        onChange={e => setContaObj({...contaObj, valor: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#86868B] mb-2">Vencimento</label>
                    <input type="date" required
                      className="w-full bg-[#F5F5F7] border border-[#E5E5EA] px-5 py-4 rounded-3xl outline-none focus:border-black focus:bg-white transition-all text-sm font-semibold text-[#1D1D1F]" 
                      value={contaObj.dataVencimento}
                      onChange={e => setContaObj({...contaObj, dataVencimento: e.target.value})} />
                  </div>
                </div>

                <div className="flex gap-4 mt-8 pt-6 border-t border-[#E5E5EA]">
                  <button type="button" onClick={() => setModalOpen(false)} className="flex-[0.5] py-4 bg-white border border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#F5F5F7] rounded-full font-bold text-sm transition-colors">
                    Descartar
                  </button>
                  <button type="submit" className="flex-1 py-4 bg-black text-white rounded-full font-bold text-sm shadow-md hover:bg-gray-800 transition-all active:scale-95 flex items-center justify-center gap-2">
                    <FaCheckCircle /> Salvar Despesa
                  </button>
                </div>
              </form>
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
      `}</style>
    </div>
  );
}

export default ContasPagar;
