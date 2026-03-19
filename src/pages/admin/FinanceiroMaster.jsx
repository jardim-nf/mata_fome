// src/pages/admin/FinanceiroMaster.jsx — Premium Light v2
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { financeiroService } from '../../services/financeiroService';
import { toast } from 'react-toastify';
import { format, isToday, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  FaCheck, FaTimes, FaPlus, FaUndo, FaArrowLeft, FaMoneyBillWave, 
  FaExclamationCircle, FaCheckCircle, FaCalendarAlt, FaWallet,
  FaHandHoldingUsd, FaFileInvoiceDollar, FaSearch, FaSignOutAlt,
  FaBolt, FaCrown, FaExclamationTriangle, FaPercentage, FaStore
} from 'react-icons/fa';
import { IoSearchOutline } from 'react-icons/io5';

// ─── Skeleton Loader ───
const SkeletonRow = () => (
  <div className="p-5 flex items-center gap-4 animate-pulse">
    <div className="w-10 h-10 bg-slate-100 rounded-xl"></div>
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-slate-100 rounded-lg w-40"></div>
      <div className="h-3 bg-slate-50 rounded-lg w-24"></div>
    </div>
    <div className="h-4 bg-slate-100 rounded-lg w-20"></div>
    <div className="h-6 bg-slate-100 rounded-lg w-24"></div>
    <div className="h-8 bg-slate-100 rounded-lg w-20"></div>
  </div>
);

function FinanceiroMaster() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  const [faturas, setFaturas] = useState([]);
  const [estabs, setEstabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [novaFatura, setNovaFatura] = useState({
    estabelecimentoId: '', valor: '', vencimento: '', descricao: 'Mensalidade Sistema'
  });

  const carregarDados = async () => {
    setLoading(true);
    try {
      const qEstab = query(collection(db, 'estabelecimentos'), orderBy('nome'));
      const snapEstab = await getDocs(qEstab);
      setEstabs(snapEstab.docs.map(d => ({ id: d.id, nome: d.data().nome })));

      const lista = await financeiroService.listarTodasFaturas();
      lista.sort((a, b) => {
        const dateA = a.vencimento?.toDate ? a.vencimento.toDate() : new Date(a.vencimento);
        const dateB = b.vencimento?.toDate ? b.vencimento.toDate() : new Date(b.vencimento);
        return dateB - dateA;
      });
      setFaturas(lista);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dados financeiros.");
    } finally { setLoading(false); }
  };

  useEffect(() => { carregarDados(); }, []);

  // ─── Helpers ───
  const parseDate = (timestamp) => {
    if (!timestamp) return null;
    return timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  };

  const formatData = (timestamp) => {
    const date = parseDate(timestamp);
    if (!date) return '--/--';
    return format(date, 'dd/MM/yyyy');
  };

  const getVencimentoStatus = (fatura) => {
    if (fatura.status === 'pago') return 'pago';
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const venc = parseDate(fatura.vencimento);
    if (!venc) return 'pendente';
    venc.setHours(0,0,0,0);
    if (venc < hoje) return 'atrasado';
    if (differenceInDays(venc, hoje) <= 3) return 'vencendo';
    return 'pendente';
  };

  // ─── Computed Data ───
  const resumo = useMemo(() => {
    const pendente = faturas.filter(f => f.status === 'pendente').reduce((acc, c) => acc + parseFloat(c.valor || 0), 0);
    const pago = faturas.filter(f => f.status === 'pago').reduce((acc, c) => acc + parseFloat(c.valor || 0), 0);
    const total = pendente + pago;

    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const atrasados = faturas.filter(f => {
      if (f.status === 'pago') return false;
      const venc = parseDate(f.vencimento);
      if (!venc) return false;
      venc.setHours(0,0,0,0);
      return venc < hoje;
    });
    const valorAtrasado = atrasados.reduce((acc, c) => acc + parseFloat(c.valor || 0), 0);

    const vencendoHoje = faturas.filter(f => {
      if (f.status === 'pago') return false;
      const venc = parseDate(f.vencimento);
      return venc && isToday(venc);
    }).length;

    const inadimplencia = total > 0 ? ((valorAtrasado / total) * 100) : 0;

    return { 
      pendente, pago, total, 
      atrasados: atrasados.length, valorAtrasado,
      vencendoHoje, inadimplencia,
      totalFaturas: faturas.length,
      pendentesCount: faturas.filter(f => f.status === 'pendente').length,
      pagosCount: faturas.filter(f => f.status === 'pago').length,
    };
  }, [faturas]);

  const faturasFiltradas = useMemo(() => {
    let filtered = faturas;
    if (filtroStatus === 'pendente') filtered = filtered.filter(f => f.status === 'pendente');
    else if (filtroStatus === 'pago') filtered = filtered.filter(f => f.status === 'pago');
    else if (filtroStatus === 'atrasado') {
      const hoje = new Date(); hoje.setHours(0,0,0,0);
      filtered = filtered.filter(f => {
        if (f.status === 'pago') return false;
        const venc = parseDate(f.vencimento);
        if (!venc) return false;
        venc.setHours(0,0,0,0);
        return venc < hoje;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(f => 
        (f.estabelecimentoNome || '').toLowerCase().includes(q) ||
        (f.descricao || '').toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [faturas, filtroStatus, searchQuery]);

  const handleCriarFatura = async (e) => {
    e.preventDefault();
    if (!novaFatura.estabelecimentoId || !novaFatura.valor || !novaFatura.vencimento) {
      return toast.warn("Preencha todos os campos obrigatórios.");
    }
    try {
      const estabSelecionado = estabs.find(e => e.id === novaFatura.estabelecimentoId);
      await financeiroService.criarFatura({
        ...novaFatura,
        estabelecimentoNome: estabSelecionado.nome,
        valor: parseFloat(novaFatura.valor)
      });
      toast.success("Cobrança gerada com sucesso!");
      setModalOpen(false);
      setNovaFatura({ estabelecimentoId: '', valor: '', vencimento: '', descricao: 'Mensalidade Sistema' });
      carregarDados();
    } catch (error) { toast.error("Erro ao gerar cobrança."); }
  };

  const handleBaixa = async (id, statusAtual) => {
    try {
      if (statusAtual === 'pago') {
        if (window.confirm("Deseja estornar este pagamento?")) { await financeiroService.reabrirFatura(id); toast.info("Pagamento estornado."); }
      } else {
        if (window.confirm("Confirmar o recebimento?")) { await financeiroService.marcarComoPago(id); toast.success("Pagamento confirmado!"); }
      }
      carregarDados();
    } catch (error) { toast.error("Erro ao atualizar status."); }
  };

  const getStatusBadge = (fatura) => {
    const status = getVencimentoStatus(fatura);
    const styles = {
      pago: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      atrasado: 'bg-red-50 text-red-700 border-red-200',
      vencendo: 'bg-orange-50 text-orange-700 border-orange-200',
      pendente: 'bg-amber-50 text-amber-700 border-amber-200',
    };
    const icons = {
      pago: <FaCheckCircle />, atrasado: <FaExclamationCircle />,
      vencendo: <FaExclamationTriangle />, pendente: <FaCalendarAlt />,
    };
    const labels = { pago: 'PAGO', atrasado: 'ATRASADO', vencendo: 'VENCE LOGO', pendente: 'PENDENTE' };

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${styles[status]} ${status === 'atrasado' ? 'animate-pulse' : ''}`}>
        {icons[status]} {labels[status]}
      </span>
    );
  };

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Admin';

  if (authLoading) return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="w-12 h-12 border-4 border-slate-200 border-t-yellow-400 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-amber-50/20 min-h-screen font-sans">
      
      {/* ─── NAVBAR ─── */}
      <nav className="sticky top-0 z-50 h-16 border-b border-slate-100 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-md shadow-yellow-400/25 group-hover:scale-105 transition-transform">
              <FaBolt className="text-white text-xs" />
            </div>
            <span className="text-slate-900 font-black text-lg tracking-tight">Idea<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-amber-500">Food</span></span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center justify-center"><FaCrown className="text-yellow-600 text-[10px]" /></div>
              <span className="text-sm font-bold text-slate-700">{userName}</span>
            </div>
            <button onClick={async () => { await logout(); navigate('/'); }} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"><FaSignOutAlt size={14} /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-16">
        
        {/* ─── HEADER ─── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <button onClick={() => navigate('/master-dashboard')} className="text-slate-400 hover:text-yellow-600 flex items-center gap-2 mb-4 text-sm font-bold transition-colors group">
              <span className="bg-white p-1.5 rounded-lg shadow-sm border border-slate-100 group-hover:border-yellow-200 transition-colors"><FaArrowLeft /></span>
              Voltar ao Dashboard
            </button>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-yellow-50 text-yellow-700 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-yellow-200">Módulo Financeiro</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Recebíveis</h1>
            <p className="text-slate-500 text-sm mt-1 font-medium">Gestão de mensalidades e faturamento da rede.</p>
          </div>
          <button onClick={() => setModalOpen(true)} 
            className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-white px-6 py-3 rounded-xl hover:shadow-xl hover:shadow-yellow-400/30 transition-all shadow-lg shadow-yellow-400/20 font-black text-sm active:scale-95">
            <FaPlus /> Nova Cobrança
          </button>
        </div>

        {/* ─── QUICK STATS BAR ─── */}
        <div className="flex flex-wrap items-center gap-3 mb-6 text-[11px] font-bold text-slate-400">
          <span className="bg-white rounded-lg px-3 py-1.5 border border-slate-100 shadow-sm">
            📊 {resumo.totalFaturas} lançamentos
          </span>
          {resumo.vencendoHoje > 0 && (
            <span className="bg-orange-50 text-orange-600 rounded-lg px-3 py-1.5 border border-orange-200 animate-pulse">
              ⏰ {resumo.vencendoHoje} vencendo hoje
            </span>
          )}
          {resumo.atrasados > 0 && (
            <span className="bg-red-50 text-red-600 rounded-lg px-3 py-1.5 border border-red-200">
              🚨 {resumo.atrasados} em atraso
            </span>
          )}
          <span className="bg-emerald-50 text-emerald-600 rounded-lg px-3 py-1.5 border border-emerald-200">
            ✅ {resumo.pagosCount} pagos
          </span>
        </div>

        {/* ─── STAT CARDS ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          
          {/* A Receber */}
          <div className="group relative overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50/50 p-6 hover:shadow-lg hover:shadow-amber-100/50 transition-all duration-300">
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-amber-100/40 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
                <FaFileInvoiceDollar className="text-amber-500" />
              </div>
              <p className="text-[10px] text-amber-600 font-black uppercase tracking-widest mb-1">A Receber</p>
              <p className="text-2xl font-black text-slate-900 tracking-tight">R$ {fmt(resumo.pendente)}</p>
              <p className="text-[10px] text-amber-500 mt-1 font-medium">{resumo.pendentesCount} cobranças em aberto</p>
            </div>
          </div>

          {/* Recebido */}
          <div className="group relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50/50 p-6 hover:shadow-lg hover:shadow-emerald-100/50 transition-all duration-300">
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-emerald-100/40 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
                <FaHandHoldingUsd className="text-emerald-500" />
              </div>
              <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mb-1">Caixa Recebido</p>
              <p className="text-2xl font-black text-slate-900 tracking-tight">R$ {fmt(resumo.pago)}</p>
              <p className="text-[10px] text-emerald-500 mt-1 font-medium">{resumo.pagosCount} pagamentos confirmados</p>
            </div>
          </div>

          {/* Atrasados */}
          <div className={`group relative overflow-hidden rounded-2xl border p-6 transition-all duration-300 ${
            resumo.atrasados > 0 
              ? 'border-red-200 bg-gradient-to-br from-red-50 to-rose-50/50 hover:shadow-lg hover:shadow-red-100/50' 
              : 'border-slate-100 bg-white hover:shadow-lg'
          }`}>
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-red-100/30 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform ${resumo.atrasados > 0 ? 'bg-red-500 text-white' : 'bg-slate-50 text-slate-300'}`}>
                <FaExclamationCircle />
              </div>
              <p className="text-[10px] text-red-600 font-black uppercase tracking-widest mb-1">Atrasados</p>
              <p className="text-2xl font-black text-slate-900 tracking-tight">R$ {fmt(resumo.valorAtrasado)}</p>
              <p className="text-[10px] text-red-400 mt-1 font-medium">
                {resumo.atrasados > 0 ? `${resumo.atrasados} cobranças vencidas` : 'Nenhuma cobrança atrasada 🎉'}
              </p>
            </div>
          </div>

          {/* Total + Inadimplência */}
          <div className="group relative overflow-hidden rounded-2xl border border-yellow-200 bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50/30 p-6 hover:shadow-lg hover:shadow-yellow-100/50 transition-all duration-300">
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-yellow-100/40 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-md shadow-yellow-400/25 mb-4 group-hover:scale-110 transition-transform">
                <FaWallet className="text-white text-sm" />
              </div>
              <p className="text-[10px] text-yellow-700 font-black uppercase tracking-widest mb-1">Total Faturado</p>
              <p className="text-2xl font-black text-slate-900 tracking-tight">R$ {fmt(resumo.total)}</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-700" style={{ width: `${resumo.total > 0 ? (resumo.pago / resumo.total * 100) : 0}%` }} />
                </div>
                <span className="text-[10px] font-black text-slate-500">
                  {resumo.total > 0 ? (resumo.pago / resumo.total * 100).toFixed(0) : 0}% 
                </span>
              </div>
              {resumo.inadimplencia > 0 && (
                <p className="text-[10px] text-red-500 mt-1 font-bold flex items-center gap-1">
                  <FaPercentage className="text-[8px]" /> {resumo.inadimplencia.toFixed(1)}% inadimplência
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ─── FILTROS + TABELA ─── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          
          {/* Filter Bar */}
          <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/30">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                <FaMoneyBillWave className="text-yellow-500" /> Histórico de Lançamentos
              </h3>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                {/* Search */}
                <div className="relative flex-1 sm:flex-none">
                  <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="w-full sm:w-56 bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm font-semibold text-slate-700 placeholder-slate-400 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 transition-all"
                    placeholder="Buscar loja..." />
                </div>

                {/* Status Filters */}
                <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5">
                  {[
                    { id: 'todos', label: 'Todos', count: resumo.totalFaturas },
                    { id: 'pendente', label: 'Pendentes', count: resumo.pendentesCount },
                    { id: 'atrasado', label: 'Atrasados', count: resumo.atrasados },
                    { id: 'pago', label: 'Pagos', count: resumo.pagosCount },
                  ].map(s => (
                    <button key={s.id} onClick={() => setFiltroStatus(s.id)}
                      className={`px-3 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                        filtroStatus === s.id 
                          ? 'bg-white text-slate-900 shadow-sm' 
                          : 'text-slate-500 hover:text-slate-700'
                      }`}>
                      {s.label}
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                        filtroStatus === s.id ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-200/50 text-slate-400'
                      }`}>{s.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ─── TABLE (desktop) / CARDS (mobile) ─── */}
          {loading ? (
            <div className="divide-y divide-slate-50">
              {[1,2,3,4,5].map(i => <SkeletonRow key={i} />)}
            </div>
          ) : faturasFiltradas.length === 0 ? (
            <div className="p-16 text-center">
              <div className="flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
                  <FaSearch className="text-2xl text-slate-200" />
                </div>
                <p className="font-black text-slate-500 text-sm">Nenhum lançamento encontrado</p>
                <p className="text-[11px] text-slate-400 mt-1">Altere o filtro ou crie uma nova cobrança.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white border-b border-slate-100">
                    <tr>
                      <th className="p-5 text-[10px] uppercase tracking-widest text-slate-400 font-black">Cliente / Loja</th>
                      <th className="p-5 text-[10px] uppercase tracking-widest text-slate-400 font-black">Vencimento</th>
                      <th className="p-5 text-[10px] uppercase tracking-widest text-slate-400 font-black">Valor</th>
                      <th className="p-5 text-[10px] uppercase tracking-widest text-slate-400 font-black">Status</th>
                      <th className="p-5 text-[10px] uppercase tracking-widest text-slate-400 font-black text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {faturasFiltradas.map(fatura => (
                      <tr key={fatura.id} className="hover:bg-yellow-50/20 transition-colors group">
                        <td className="p-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                              <FaStore className="text-xs" />
                            </div>
                            <div>
                              <div className="font-black text-slate-800 text-sm tracking-tight">{fatura.estabelecimentoNome}</div>
                              <div className="text-[11px] font-medium text-slate-400 mt-0.5">{fatura.descricao}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-5">
                          <span className="text-sm font-bold text-slate-600">{formatData(fatura.vencimento)}</span>
                          {getVencimentoStatus(fatura) === 'atrasado' && (
                            <p className="text-[10px] text-red-500 font-bold mt-0.5">
                              {differenceInDays(new Date(), parseDate(fatura.vencimento))} dias de atraso
                            </p>
                          )}
                        </td>
                        <td className="p-5">
                          <span className="font-black text-slate-900 text-base tabular-nums">R$ {fmt(fatura.valor)}</span>
                        </td>
                        <td className="p-5">{getStatusBadge(fatura)}</td>
                        <td className="p-5 text-right">
                          {fatura.status === 'pago' ? (
                            <button onClick={() => handleBaixa(fatura.id, 'pago')}
                              className="text-slate-400 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl text-[11px] font-bold flex items-center justify-end gap-1.5 ml-auto transition-all">
                              <FaUndo /> Estornar
                            </button>
                          ) : (
                            <button onClick={() => handleBaixa(fatura.id, 'pendente')}
                              className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 px-4 py-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-end gap-2 ml-auto active:scale-95">
                              <FaCheck /> Confirmar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-slate-50">
                {faturasFiltradas.map(fatura => (
                  <div key={fatura.id} className="p-4 hover:bg-yellow-50/20 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                          <FaStore className="text-sm" />
                        </div>
                        <div>
                          <p className="font-black text-slate-800 text-sm">{fatura.estabelecimentoNome}</p>
                          <p className="text-[11px] text-slate-400 font-medium">{fatura.descricao}</p>
                        </div>
                      </div>
                      {getStatusBadge(fatura)}
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-[10px] text-slate-400 font-black uppercase">Valor</p>
                          <p className="font-black text-slate-900 tabular-nums">R$ {fmt(fatura.valor)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-black uppercase">Vence</p>
                          <p className="text-sm font-bold text-slate-600">{formatData(fatura.vencimento)}</p>
                        </div>
                      </div>
                      {fatura.status === 'pago' ? (
                        <button onClick={() => handleBaixa(fatura.id, 'pago')}
                          className="text-slate-400 hover:text-red-600 p-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all">
                          <FaUndo /> Estornar
                        </button>
                      ) : (
                        <button onClick={() => handleBaixa(fatura.id, 'pendente')}
                          className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-xl text-[11px] font-black transition-all flex items-center gap-2 active:scale-95">
                          <FaCheck /> Pagar
                        </button>
                      )}
                    </div>

                    {getVencimentoStatus(fatura) === 'atrasado' && (
                      <p className="text-[10px] text-red-500 font-bold mt-2 bg-red-50 px-2 py-1 rounded-lg inline-block">
                        ⚠️ {differenceInDays(new Date(), parseDate(fatura.vencimento))} dias de atraso
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ─── MODAL NOVA COBRANÇA ─── */}
        {modalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
            <div className="bg-white rounded-2xl p-6 sm:p-8 w-full max-w-md shadow-2xl border border-slate-100">
              
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Nova Cobrança</h2>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">Gerar lançamento para faturamento.</p>
                </div>
                <button onClick={() => setModalOpen(false)} className="bg-slate-50 text-slate-400 hover:text-slate-800 hover:bg-slate-100 p-2.5 rounded-xl transition-colors"><FaTimes /></button>
              </div>
              
              <form onSubmit={handleCriarFatura} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Cliente / Loja</label>
                  <select className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-xl outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 focus:bg-white transition-all text-sm font-semibold text-slate-700"
                    value={novaFatura.estabelecimentoId}
                    onChange={e => setNovaFatura({...novaFatura, estabelecimentoId: e.target.value})}>
                    <option value="">Selecione o estabelecimento...</option>
                    {estabs.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Valor</label>
                    <div className="relative">
                      <span className="absolute left-4 top-3.5 text-slate-400 text-sm font-bold">R$</span>
                      <input type="number" step="0.01" placeholder="0.00"
                        className="w-full border border-slate-200 bg-slate-50 p-3.5 pl-10 rounded-xl outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 focus:bg-white transition-all font-black text-slate-900 text-lg tabular-nums" 
                        value={novaFatura.valor}
                        onChange={e => setNovaFatura({...novaFatura, valor: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Vencimento</label>
                    <input type="date" 
                      className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-xl outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 focus:bg-white transition-all text-sm font-bold text-slate-700" 
                      value={novaFatura.vencimento}
                      onChange={e => setNovaFatura({...novaFatura, vencimento: e.target.value})} />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Referência / Descrição</label>
                  <input type="text" placeholder="Ex: Mensalidade Janeiro 2026"
                    className="w-full border border-slate-200 bg-slate-50 p-3.5 rounded-xl outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 focus:bg-white transition-all text-sm font-semibold text-slate-700" 
                    value={novaFatura.descricao}
                    onChange={e => setNovaFatura({...novaFatura, descricao: e.target.value})} />
                </div>

                <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-3.5 text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl font-bold text-sm transition-colors border border-slate-200">
                    Cancelar
                  </button>
                  <button type="submit" className="flex-1 py-3.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-white rounded-xl font-black text-sm hover:shadow-lg hover:shadow-yellow-400/30 transition-all active:scale-95 flex items-center justify-center gap-2">
                    <FaCheckCircle /> Gerar Boleto
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>

      <style>{`
        .tabular-nums { font-variant-numeric: tabular-nums; }
      `}</style>
    </div>
  );
}

export default FinanceiroMaster;