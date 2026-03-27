import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, onSnapshot, getDocs, collectionGroup, where, Timestamp } from 'firebase/firestore'; 
import { db } from '../firebase'; 
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { startOfDay, subDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DateRangeFilter from '../components/DateRangeFilter';

import {
  FaStore, FaUsers, FaClipboardList, FaFileUpload, FaTags, FaShieldAlt, FaImages,
  FaDollarSign, FaSignOutAlt, FaShoppingCart, FaMoneyBillWave, FaSync, FaChevronRight,
  FaBox, FaChartLine, FaTrophy, FaRocket, FaBolt, FaCrown
} from 'react-icons/fa';
import {
  IoNotificationsOutline, IoSearchOutline, IoSparklesOutline,
  IoLayersOutline, IoArrowUpOutline, IoArrowDownOutline,
  IoChevronForwardOutline, IoGlobeOutline
} from 'react-icons/io5';

// ═══════════════════════════════════════════
// IdeaFood Master Dashboard — Premium Light
// ═══════════════════════════════════════════

function MasterDashboard() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');

  const [financeiro, setFinanceiro] = useState({
    totalHistorico: 0, qtdPedidosTotal: 0, faturamentoHoje: 0, qtdHoje: 0, topLojas: [],
    faturamentoOntem: 0, qtdOntem: 0
  });

  const [stats, setStats] = useState({ totalEstabelecimentos: 0, estabelecimentosAtivos: 0, totalUsuarios: 0 });
  const [estabelecimentosMap, setEstabelecimentosMap] = useState({});
  const [dadosBrutos, setDadosBrutos] = useState({ pedidos: [], vendas: [] });
  const [alertas, setAlertas] = useState({ certVencidos: [], certVencendo: [], mensalidadeAtrasada: [], mensalidadeVencendo: [] });
  const historicosCarregados = useRef(false);

  // Date range filter state
  const [datePreset, setDatePreset] = useState(null);
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const handleDatePresetChange = useCallback((key) => setDatePreset(key), []);
  const handleDateRangeChange = useCallback((range) => setDateRange(range), []);
  const handleDateClear = useCallback(() => {
    setDatePreset(null);
    setDateRange({ start: null, end: null });
  }, []);

  // ── Helpers ──────────────────────
  const extrairData = (c) => {
    if (!c) return null;
    if (typeof c.toDate === 'function') return c.toDate();
    if (c.seconds) return new Date(c.seconds * 1000);
    const d = new Date(c); return isNaN(d.getTime()) ? null : d;
  };
  const getDate = (item) => extrairData(item.createdAt) || extrairData(item.dataPedido) || 
    extrairData(item.adicionadoEm) || extrairData(item.updatedAt) || extrairData(item.criadoEm);
  const getTotal = (item) => Number(item.totalFinal) || Number(item.total) || Number(item.valorFinal) || 0;

  // 🔥 Detecta pedidos/vendas cancelados (mesma lógica do AdminReports)
  const isPedidoCancelado = (p) => {
    if (!p) return false;
    const s1 = String(p.status || '').toLowerCase().trim();
    const s2 = String(p.fiscal?.status || '').toLowerCase().trim();
    const s3 = String(p.statusVenda || '').toLowerCase().trim();
    const termos = ['cancelad', 'recusad', 'excluid', 'estornad', 'devolvid', 'rejeitad', 'erro'];
    return termos.some(t => s1.includes(t) || s2.includes(t) || s3.includes(t));
  };

  // Detecta se um doc da subcollection "pedidos" é de mesa/salão
  // Rounds individuais NÃO devem ser contados — a venda final está em "vendas"
  const isMesaDoc = (data) => {
    return data.tipo === 'mesa' || data.source === 'salao' || !!data.mesaNumero || !!data.numeroMesa;
  };

  // ── Fetch estabelecimentos + users (light) ──────────────────────
  const fetchHistoricalData = async () => {
    setLoadingDashboard(true);
    try {
      const [estabSnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, 'estabelecimentos'))),
        getDocs(query(collection(db, 'usuarios'))),
      ]);
      const estabs = estabSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const mapEstabs = {};
      estabs.forEach(e => { mapEstabs[e.id] = e.nome || e.name || e.razaoSocial; });
      setEstabelecimentosMap(mapEstabs);
      setStats({
        totalEstabelecimentos: estabSnap.size,
        estabelecimentosAtivos: estabs.filter(e => e.ativo).length,
        totalUsuarios: usersSnap.size,
      });

      // ── Calcular alertas de certificados e mensalidades ──
      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      const newAlertas = { certVencidos: [], certVencendo: [], mensalidadeAtrasada: [], mensalidadeVencendo: [] };

      estabs.forEach(estab => {
        const nome = estab.nome || estab.name || 'Sem nome';

        // Verificar certificado digital
        const certVal = estab.fiscal?.certificadoValidade;
        if (certVal) {
          const certDate = certVal?.toDate ? certVal.toDate() : new Date(certVal);
          certDate.setHours(0,0,0,0);
          const diffCert = Math.ceil((certDate - hoje) / (1000*60*60*24));
          if (diffCert < 0) {
            newAlertas.certVencidos.push({ nome, dias: diffCert, id: estab.id });
          } else if (diffCert <= 30) {
            newAlertas.certVencendo.push({ nome, dias: diffCert, id: estab.id });
          }
        }

        // Verificar mensalidade
        const nextBilling = estab.nextBillingDate;
        if (nextBilling) {
          const billingDate = nextBilling?.toDate ? nextBilling.toDate() : new Date(nextBilling);
          billingDate.setHours(0,0,0,0);
          const diffBilling = Math.ceil((billingDate - hoje) / (1000*60*60*24));
          if (diffBilling < 0) {
            newAlertas.mensalidadeAtrasada.push({ nome, dias: diffBilling, id: estab.id });
          } else if (diffBilling <= 7) {
            newAlertas.mensalidadeVencendo.push({ nome, dias: diffBilling, id: estab.id });
          }
        }
      });

      // Ordenar por urgência (mais atrasado primeiro)
      newAlertas.certVencidos.sort((a, b) => a.dias - b.dias);
      newAlertas.mensalidadeAtrasada.sort((a, b) => a.dias - b.dias);
      newAlertas.certVencendo.sort((a, b) => a.dias - b.dias);
      newAlertas.mensalidadeVencendo.sort((a, b) => a.dias - b.dias);
      setAlertas(newAlertas);

      setLastUpdated(new Date());
    } catch (err) {
      toast.error('Erro ao atualizar dados.');
    } finally {
      setLoadingDashboard(false);
    }
  };

  // ── Real-time: ONLY last 2 days (optimized) ──────────────────────
  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return;

    // Only listen to orders/sales from yesterday onwards (covers "hoje" + "ontem" comparisons)
    const twoDaysAgo = Timestamp.fromDate(startOfDay(subDays(new Date(), 1)));

    // Try date-filtered queries first; fallback to unfiltered if index doesn't exist
    const dateFields = ['createdAt', 'dataPedido'];
    
    const setupListener = (colName, tipo) => {
      // We listen with a date filter on 'createdAt' — requires a Firestore index
      // If it fails, we fall back to loading all and filtering client-side  
      const qFiltered = query(collectionGroup(db, colName), where('createdAt', '>=', twoDaysAgo));
      
      return onSnapshot(qFiltered, 
        (snap) => {
          const docs = snap.docs.map(d => ({...d.data(), _path: d.ref.path}));
          calcularTotaisRecentes(docs, tipo);
        },
        (error) => {
          // Fallback: if index doesn't exist, use unfiltered query but still only process recent data
          console.warn(`[IdeaFood] Index not available for ${colName}, using fallback query`);
          const qAll = query(collectionGroup(db, colName));
          return onSnapshot(qAll, (snap) => {
            const docs = snap.docs.map(d => ({...d.data(), _path: d.ref.path}));
            calcularTotaisRecentes(docs, tipo);
          });
        }
      );
    };

    const unsubPedidos = setupListener('pedidos', 'pedidos');
    const unsubVendas = setupListener('vendas', 'vendas');

    return () => { 
      if (typeof unsubPedidos === 'function') unsubPedidos(); 
      if (typeof unsubVendas === 'function') unsubVendas(); 
    };
  }, [currentUser, isMasterAdmin]);

  // ── Historical totals (background, one-time) ──────────────────────
  // ⚠️ FIX: Pula rounds de mesa em "pedidos" e filtra cancelados
  useEffect(() => {
    if (!currentUser || !isMasterAdmin || historicosCarregados.current) return;
    historicosCarregados.current = true;

    const carregarHistorico = async () => {
      try {
        const [pedSnap, venSnap] = await Promise.all([
          getDocs(query(collectionGroup(db, 'pedidos'))),
          getDocs(query(collectionGroup(db, 'vendas')))
        ]);
        // Pedidos: apenas delivery (pula rounds de mesa para não duplicar)
        const pedidosDelivery = pedSnap.docs
          .map(d => d.data())
          .filter(d => !isMesaDoc(d) && !isPedidoCancelado(d));
        
        // Vendas: finais fechadas (inclui mesa/salão)
        const vendasFinais = venSnap.docs
          .map(d => d.data())
          .filter(d => !isPedidoCancelado(d));
        
        const allDocs = [...pedidosDelivery, ...vendasFinais];
        const totalHist = allDocs.reduce((acc, item) => acc + getTotal(item), 0);
        const qtdTotal = allDocs.length;
        setFinanceiro(prev => ({ ...prev, totalHistorico: totalHist, qtdPedidosTotal: qtdTotal }));
      } catch (err) {
        console.error('[IdeaFood] Erro ao carregar histórico:', err);
      }
    };
    // Load historical data in background after a small delay to not block UI
    setTimeout(carregarHistorico, 1500);
  }, [currentUser, isMasterAdmin]);

  // ── Calculate only today+yesterday from recent data ──────────────────────
  // ⚠️ FIX: Para "pedidos" pula docs de mesa; filtra cancelados em ambos
  const calcularTotaisRecentes = (novosDados, tipo) => {
    setDadosBrutos(prev => {
      const atualizado = { ...prev, [tipo]: novosDados };
      
      // Pedidos: pula rounds de mesa (já estão em vendas como venda final)
      const pedidosFiltrados = atualizado.pedidos
        .filter(d => !isMesaDoc(d) && !isPedidoCancelado(d));
      // Vendas: filtra apenas cancelados
      const vendasFiltradas = atualizado.vendas
        .filter(d => !isPedidoCancelado(d));
      
      const tudo = [...pedidosFiltrados, ...vendasFiltradas];
      const hoje = startOfDay(new Date());
      const ontem = startOfDay(subDays(new Date(), 1));

      const doDia = tudo.filter(item => { const d = getDate(item); return d && d >= hoje; });
      const doOntem = tudo.filter(item => { const d = getDate(item); return d && d >= ontem && d < hoje; });

      const rankingMap = {};
      doDia.forEach(item => {
        let estabId = item.estabelecimentoId;
        if (!estabId && item._path) { const parts = item._path.split('/'); const idx = parts.indexOf('estabelecimentos'); if (idx >= 0 && parts.length > idx + 1) estabId = parts[idx + 1]; }
        if (!estabId) estabId = 'desconhecido';
        if (!rankingMap[estabId]) rankingMap[estabId] = { id: estabId, nomeSalvoNoPedido: item.estabelecimentoNome || '', total: 0, pedidos: 0 };
        rankingMap[estabId].total += getTotal(item);
        rankingMap[estabId].pedidos += 1;
      });
      const topLojas = Object.values(rankingMap).sort((a, b) => b.total - a.total).slice(0, 5);

      setFinanceiro(prev => ({
        ...prev,
        faturamentoHoje: doDia.reduce((acc, item) => acc + getTotal(item), 0),
        qtdHoje: doDia.length,
        faturamentoOntem: doOntem.reduce((acc, item) => acc + getTotal(item), 0),
        qtdOntem: doOntem.length,
        topLojas
      }));
      return atualizado;
    });
  };

  // ── Date-filtered financials (when date filter is active) ──────────────────
  const financeiroFiltrado = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return null; // null = use default financeiro
    const pedidosFiltrados = dadosBrutos.pedidos.filter(d => !isMesaDoc(d) && !isPedidoCancelado(d));
    const vendasFiltradas = dadosBrutos.vendas.filter(d => !isPedidoCancelado(d));
    const tudo = [...pedidosFiltrados, ...vendasFiltradas];
    const doPeriodo = tudo.filter(item => {
      const d = getDate(item);
      return d && d >= dateRange.start && d <= dateRange.end;
    });
    const totalPeriodo = doPeriodo.reduce((acc, item) => acc + getTotal(item), 0);
    const qtdPeriodo = doPeriodo.length;
    // Ranking for the period
    const rankingMap = {};
    doPeriodo.forEach(item => {
      let estabId = item.estabelecimentoId;
      if (!estabId && item._path) { const parts = item._path.split('/'); const idx = parts.indexOf('estabelecimentos'); if (idx >= 0 && parts.length > idx + 1) estabId = parts[idx + 1]; }
      if (!estabId) estabId = 'desconhecido';
      if (!rankingMap[estabId]) rankingMap[estabId] = { id: estabId, nomeSalvoNoPedido: item.estabelecimentoNome || '', total: 0, pedidos: 0 };
      rankingMap[estabId].total += getTotal(item);
      rankingMap[estabId].pedidos += 1;
    });
    const topLojas = Object.values(rankingMap).sort((a, b) => b.total - a.total).slice(0, 5);
    return { faturamento: totalPeriodo, qtd: qtdPeriodo, topLojas, ticketMedio: qtdPeriodo > 0 ? totalPeriodo / qtdPeriodo : 0 };
  }, [dadosBrutos, dateRange]);

  // Resolved financial data: filtered period or default
  const fin = financeiroFiltrado || financeiro;

  useEffect(() => {
    if (!authLoading && currentUser && isMasterAdmin) fetchHistoricalData();
  }, [authLoading, currentUser, isMasterAdmin]);

  // ── Computed ──────────────────────
  const crescimento = useMemo(() => {
    if (financeiro.faturamentoOntem === 0) return financeiro.faturamentoHoje > 0 ? 100 : 0;
    return ((financeiro.faturamentoHoje - financeiro.faturamentoOntem) / financeiro.faturamentoOntem * 100);
  }, [financeiro]);

  const ticketMedio = useMemo(() => {
    return financeiro.qtdHoje > 0 ? financeiro.faturamentoHoje / financeiro.qtdHoje : 0;
  }, [financeiro]);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const userName = currentUser?.displayName || currentUser?.nome || currentUser?.email?.split('@')[0] || 'Admin';
  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // ── Módulos ──────────────────────
  const modulos = [
    { to: '/master/financeiro', title: 'Financeiro', desc: 'Receitas e cobranças', icon: <FaMoneyBillWave />, cor: 'emerald' },
    { to: '/master/estabelecimentos', title: 'Estabelecimentos', desc: 'Lojas, certs e billing', icon: <FaStore />, cor: 'blue' },
    { to: '/master/usuarios', title: 'Usuários', desc: 'Acessos e permissões', icon: <FaUsers />, cor: 'violet' },
    { to: '/master/pedidos', title: 'Central de Pedidos', desc: 'Monitor da rede', icon: <FaClipboardList />, cor: 'orange' },
    { to: '/master/plans', title: 'Assinaturas', desc: 'Planos e billing', icon: <FaTags />, cor: 'pink' },
    { to: '/master/importar-cardapio', title: 'Importador', desc: 'Cardápios em massa', icon: <FaFileUpload />, cor: 'cyan' },
    { to: '/master/associar-imagens', title: 'Galeria Central', desc: 'Banco de imagens', icon: <FaImages />, cor: 'amber' },
    { to: '/admin/audit-logs', title: 'Auditoria', desc: 'Logs de segurança', icon: <FaShieldAlt />, cor: 'slate' },
    { to: '/divulgacao', title: 'Material de Vendas', desc: 'PDF de divulgação', icon: <FaRocket />, cor: 'rose' },
  ];

  const corMap = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 group-hover:bg-emerald-500',
    blue: 'bg-blue-50 text-blue-600 border-blue-100 group-hover:bg-blue-500',
    violet: 'bg-violet-50 text-violet-600 border-violet-100 group-hover:bg-violet-500',
    orange: 'bg-orange-50 text-orange-600 border-orange-100 group-hover:bg-orange-500',
    pink: 'bg-pink-50 text-pink-600 border-pink-100 group-hover:bg-pink-500',
    cyan: 'bg-cyan-50 text-cyan-600 border-cyan-100 group-hover:bg-cyan-500',
    amber: 'bg-amber-50 text-amber-600 border-amber-100 group-hover:bg-amber-500',
    slate: 'bg-slate-50 text-slate-600 border-slate-100 group-hover:bg-slate-500',
    rose: 'bg-rose-50 text-rose-600 border-rose-100 group-hover:bg-rose-500',
  };

  const filteredModulos = searchQuery
    ? modulos.filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()) || m.desc.toLowerCase().includes(searchQuery.toLowerCase()))
    : modulos;

  // ── Loading ──────────────────────
  if (authLoading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg shadow-yellow-400/30 animate-pulse">
          <FaBolt className="text-white text-lg" />
        </div>
        <p className="text-slate-400 text-sm font-bold">Carregando IdeaFood...</p>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════
  // RENDER — LIGHT PREMIUM
  // ═══════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/20 font-sans">
      
      {/* ─── TOP NAVBAR ─── */}
      <nav className="sticky top-0 z-50 h-16 border-b border-slate-100 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-md shadow-yellow-400/30 group-hover:shadow-lg group-hover:shadow-yellow-400/40 transition-all group-hover:scale-105">
                <FaBolt className="text-white text-sm" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white shadow-sm animate-pulse" />
            </div>
            <div className="hidden sm:block">
              <p className="text-slate-900 font-black text-lg tracking-tight leading-none">Idea<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-amber-500">Food</span></p>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em]">Master Control</p>
            </div>
          </div>

          {/* Search */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <IoSearchOutline className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 focus:bg-white transition-all"
                placeholder="Buscar módulos..." />
            </div>
          </div>

          {/* User */}
          <div className="flex items-center gap-3">
            <button className="relative p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-yellow-300 hover:bg-yellow-50 transition-all">
              <IoNotificationsOutline className="text-slate-500" size={18} />
              <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-yellow-400 rounded-full shadow-sm" />
            </button>
            <div className="h-8 w-px bg-slate-200 mx-1" />
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-100 to-amber-100 border border-yellow-200 flex items-center justify-center">
                <FaCrown className="text-yellow-600 text-xs" />
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-bold text-slate-800 leading-none">{userName}</p>
                <p className="text-[10px] text-yellow-600 font-black">MASTER ADMIN</p>
              </div>
            </div>
            <button onClick={async () => { await logout(); navigate('/'); }}
              className="p-2.5 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all" title="Sair">
              <FaSignOutAlt size={14} />
            </button>
          </div>
        </div>
      </nav>

      {/* ─── MAIN CONTENT ─── */}
      <main className="pt-8 pb-16 px-4 sm:px-6 max-w-[1500px] mx-auto">

        {/* ─── HERO SECTION ─── */}
        <div className="relative mb-8 rounded-3xl bg-gradient-to-r from-yellow-50 via-amber-50/50 to-orange-50/30 border border-yellow-100/50">
          <div className="absolute right-0 top-0 w-64 h-64 bg-gradient-to-bl from-yellow-200/20 to-transparent rounded-full blur-3xl" />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-emerald-200">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Sistema Online
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium capitalize">
                    {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-1">
                  {saudacao}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-amber-600">{userName}</span> 🔥
                </h1>
                <p className="text-slate-500 text-sm font-medium">
                  {financeiroFiltrado ? 'Dados filtrados por período personalizado' : 'Visão executiva da rede IdeaFood — dados em tempo real'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <DateRangeFilter
                  activePreset={datePreset}
                  dateRange={dateRange}
                  onPresetChange={handleDatePresetChange}
                  onRangeChange={handleDateRangeChange}
                  onClear={handleDateClear}
                />
                <button onClick={fetchHistoricalData}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:border-yellow-400 hover:text-yellow-700 hover:bg-yellow-50 transition-all text-sm font-bold shadow-sm active:scale-95">
                  <FaSync className={loadingDashboard ? 'animate-spin text-yellow-500' : ''} size={12} /> Sincronizar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── STAT CARDS ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Faturamento Hoje / Período */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-xl hover:shadow-yellow-100/50 hover:border-yellow-200 transition-all duration-300">
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-yellow-50 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-md shadow-yellow-400/25">
                  <FaBolt className="text-white text-sm" />
                </div>
                {!financeiroFiltrado && (
                  <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black ${crescimento >= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                    {crescimento >= 0 ? <IoArrowUpOutline size={10} /> : <IoArrowDownOutline size={10} />}
                    {Math.abs(crescimento).toFixed(0)}%
                  </div>
                )}
                {financeiroFiltrado && (
                  <span className="text-[10px] text-amber-600 font-black bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">FILTRADO</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">{financeiroFiltrado ? 'Faturamento do Período' : 'Faturamento Hoje'}</p>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{fmt(financeiroFiltrado ? financeiroFiltrado.faturamento : financeiro.faturamentoHoje)}</p>
              <p className="text-[10px] text-slate-400 mt-1">{financeiroFiltrado ? `${financeiroFiltrado.qtd} pedidos no período` : `vs ontem: ${fmt(financeiro.faturamentoOntem)}`}</p>
            </div>
          </div>

          {/* Pedidos Hoje */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-xl hover:shadow-blue-100/50 hover:border-blue-200 transition-all duration-300">
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-blue-50 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-400/25">
                  <FaShoppingCart className="text-white text-sm" />
                </div>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">VOLUME</span>
              </div>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">{financeiroFiltrado ? 'Pedidos do Período' : 'Pedidos Hoje'}</p>
              <p className="text-2xl sm:text-3xl font-black text-slate-900">{financeiroFiltrado ? financeiroFiltrado.qtd : financeiro.qtdHoje}</p>
              <p className="text-[10px] text-slate-400 mt-1">{financeiroFiltrado ? `ticket médio: ${fmt(financeiroFiltrado.ticketMedio)}` : `ontem: ${financeiro.qtdOntem} pedidos`}</p>
            </div>
          </div>

          {/* Ticket Médio */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-xl hover:shadow-purple-100/50 hover:border-purple-200 transition-all duration-300">
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-purple-50 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-400/25">
                  <IoSparklesOutline className="text-white" size={16} />
                </div>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">MÉDIA</span>
              </div>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Ticket Médio</p>
              <p className="text-2xl sm:text-3xl font-black text-slate-900">{fmt(financeiroFiltrado ? financeiroFiltrado.ticketMedio : ticketMedio)}</p>
              <p className="text-[10px] text-slate-400 mt-1">{financeiro.qtdPedidosTotal.toLocaleString()} pedidos total</p>
            </div>
          </div>

          {/* Rede */}
          <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm hover:shadow-xl hover:shadow-emerald-100/50 hover:border-emerald-200 transition-all duration-300">
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-emerald-50 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-400/25">
                  <IoGlobeOutline className="text-white" size={16} />
                </div>
                <span className="text-[10px] text-emerald-600 font-black bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">REDE</span>
              </div>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Lojas Ativas</p>
              <p className="text-2xl sm:text-3xl font-black text-slate-900">{stats.estabelecimentosAtivos}<span className="text-base text-slate-400 font-medium">/{stats.totalEstabelecimentos}</span></p>
              <p className="text-[10px] text-slate-400 mt-1">{stats.totalUsuarios} usuários cadastrados</p>
            </div>
          </div>
        </div>

        {/* ─── RANKING + RECEITA TOTAL ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          
          {/* Top Lojas */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-yellow-100 to-amber-100 border border-yellow-200 flex items-center justify-center">
                  <FaTrophy className="text-yellow-600 text-sm" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-sm">Top Lojas — {financeiroFiltrado ? 'Período' : 'Hoje'}</h3>
                  <p className="text-[10px] text-slate-400 font-medium">{financeiroFiltrado ? 'Ranking por faturamento filtrado' : 'Ranking por faturamento do dia'}</p>
                </div>
              </div>
              <Link to="/master/estabelecimentos" className="text-[11px] text-slate-400 hover:text-yellow-600 font-bold flex items-center gap-1 transition-colors">
                Ver todas <IoChevronForwardOutline size={12} />
              </Link>
            </div>
            
            {((financeiroFiltrado?.topLojas || financeiro.topLojas).length === 0) ? (
              <div className="text-center py-12">
                <FaStore className="text-slate-200 text-4xl mx-auto mb-3" />
                <p className="text-slate-400 text-sm font-medium">{financeiroFiltrado ? 'Nenhuma venda no período' : 'Nenhuma venda hoje na rede'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(financeiroFiltrado?.topLojas || financeiro.topLojas).map((loja, i) => {
                  const nome = estabelecimentosMap[loja.id] || loja.nomeSalvoNoPedido || `Filial #${loja.id.slice(0,4).toUpperCase()}`;
                  const medals = ['🥇', '🥈', '🥉'];
                  const maxTotal = (financeiroFiltrado?.topLojas || financeiro.topLojas)[0]?.total || 1;
                  const barWidth = (loja.total / maxTotal * 100);
                  const barColors = ['bg-yellow-100', 'bg-slate-100', 'bg-orange-50', 'bg-slate-50', 'bg-slate-50'];
                  
                  return (
                    <div key={loja.id} className="group relative flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                      {/* Progress bar */}
                      <div className="absolute inset-0 rounded-xl overflow-hidden">
                        <div className={`h-full ${barColors[i] || 'bg-slate-50'} transition-all duration-1000`}
                          style={{ width: `${barWidth}%` }} />
                      </div>
                      
                      <div className="relative flex items-center gap-4 flex-1">
                        <span className="text-lg w-8 text-center">{medals[i] || <span className="text-slate-400 text-sm font-black">{i + 1}º</span>}</span>
                        <div className="flex-1">
                          <p className="font-bold text-slate-800 text-sm group-hover:text-yellow-700 transition-colors">{nome}</p>
                          <p className="text-[10px] text-slate-400">{loja.pedidos} pedidos</p>
                        </div>
                        <p className="font-black text-slate-900 text-sm tabular-nums">{fmt(loja.total)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Receita Total */}
          <div className="rounded-2xl border border-slate-100 bg-gradient-to-b from-white to-emerald-50/30 p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-400/25">
                <FaDollarSign className="text-white text-sm" />
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-sm">Receita Total</h3>
                <p className="text-[10px] text-slate-400 font-medium">Todo o histórico da rede</p>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col justify-center items-center py-6">
              <p className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600 mb-2">
                {fmt(financeiro.totalHistorico)}
              </p>
              <p className="text-slate-400 text-xs font-medium">{financeiro.qtdPedidosTotal.toLocaleString()} pedidos processados</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-auto">
              <div className="bg-white rounded-xl p-3 text-center border border-slate-100 shadow-sm">
                <p className="text-lg font-black text-slate-800">{stats.totalEstabelecimentos}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Lojas</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center border border-slate-100 shadow-sm">
                <p className="text-lg font-black text-slate-800">{stats.totalUsuarios}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Usuários</p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── ALERTAS DE CERTIFICADOS E MENSALIDADES ─── */}
        {(alertas.certVencidos.length > 0 || alertas.certVencendo.length > 0 || alertas.mensalidadeAtrasada.length > 0 || alertas.mensalidadeVencendo.length > 0) && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-100 to-orange-100 border border-red-200 flex items-center justify-center">
                <IoNotificationsOutline className="text-red-600" size={16} />
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-base">Alertas da Rede</h3>
                <p className="text-[10px] text-slate-400 font-medium">Certificados e mensalidades que requerem atenção</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Certificados Vencidos */}
              {alertas.certVencidos.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-red-600 text-lg">🔐</span>
                    <h4 className="font-black text-red-800 text-sm">Certificados Vencidos ({alertas.certVencidos.length})</h4>
                  </div>
                  <div className="space-y-2">
                    {alertas.certVencidos.slice(0, 5).map((a, i) => (
                      <div key={i} className="flex items-center justify-between bg-white/60 rounded-xl px-3 py-2 text-[11px]">
                        <span className="font-bold text-red-700">{a.nome}</span>
                        <span className="text-red-500 font-bold">Vencido há {Math.abs(a.dias)}d</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Certificados Vencendo */}
              {alertas.certVencendo.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-orange-600 text-lg">🔐</span>
                    <h4 className="font-black text-orange-800 text-sm">Certificados Vencem em Breve ({alertas.certVencendo.length})</h4>
                  </div>
                  <div className="space-y-2">
                    {alertas.certVencendo.slice(0, 5).map((a, i) => (
                      <div key={i} className="flex items-center justify-between bg-white/60 rounded-xl px-3 py-2 text-[11px]">
                        <span className="font-bold text-orange-700">{a.nome}</span>
                        <span className="text-orange-500 font-bold">Vence em {a.dias}d</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mensalidades Atrasadas */}
              {alertas.mensalidadeAtrasada.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-red-600 text-lg">🚨</span>
                    <h4 className="font-black text-red-800 text-sm">Mensalidades Atrasadas ({alertas.mensalidadeAtrasada.length})</h4>
                  </div>
                  <div className="space-y-2">
                    {alertas.mensalidadeAtrasada.slice(0, 5).map((a, i) => (
                      <div key={i} className="flex items-center justify-between bg-white/60 rounded-xl px-3 py-2 text-[11px]">
                        <span className="font-bold text-red-700">{a.nome}</span>
                        <span className="text-red-500 font-bold">Atrasada há {Math.abs(a.dias)}d</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mensalidades Vencendo */}
              {alertas.mensalidadeVencendo.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-amber-600 text-lg">⏰</span>
                    <h4 className="font-black text-amber-800 text-sm">Mensalidades Vencem em Breve ({alertas.mensalidadeVencendo.length})</h4>
                  </div>
                  <div className="space-y-2">
                    {alertas.mensalidadeVencendo.slice(0, 5).map((a, i) => (
                      <div key={i} className="flex items-center justify-between bg-white/60 rounded-xl px-3 py-2 text-[11px]">
                        <span className="font-bold text-amber-700">{a.nome}</span>
                        <span className="text-amber-500 font-bold">Vence em {a.dias}d</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── MÓDULOS DE GESTÃO ─── */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-yellow-100 to-amber-100 border border-yellow-200 flex items-center justify-center">
              <IoLayersOutline className="text-yellow-600" size={16} />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-base">Módulos de Gestão</h3>
              <p className="text-[10px] text-slate-400 font-medium">Acesso rápido a todos os recursos</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredModulos.map((m, i) => (
              <Link key={i} to={m.to}
                className="group relative flex items-center gap-4 p-5 rounded-2xl border border-slate-100 bg-white hover:shadow-xl hover:shadow-slate-100/80 hover:border-slate-200 transition-all duration-300 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-slate-50/0 via-slate-50/50 to-slate-50/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <div className={`relative w-12 h-12 rounded-xl border flex items-center justify-center text-lg transition-all duration-300 group-hover:text-white group-hover:shadow-lg group-hover:scale-110 ${corMap[m.cor]}`}>
                  {m.icon}
                </div>
                <div className="relative flex-1 min-w-0">
                  <h4 className="font-bold text-slate-800 text-sm group-hover:text-slate-900 transition-colors">{m.title}</h4>
                  <p className="text-[11px] text-slate-400 font-medium truncate">{m.desc}</p>
                </div>
                <FaChevronRight className="relative text-slate-300 text-xs group-hover:text-yellow-500 group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        </div>

        {/* ─── FOOTER ─── */}
        <div className="flex flex-col items-center justify-center pt-8 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <FaBolt className="text-yellow-400 text-xs" />
            <span className="text-slate-400 text-xs font-bold tracking-wide">IdeaFood Master • Edição Premium</span>
          </div>
          <p className="text-slate-300 text-[10px]">© {new Date().getFullYear()} Todos os direitos reservados</p>
        </div>
      </main>

      {/* ─── GLOBAL STYLES ─── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
        .tabular-nums { font-variant-numeric: tabular-nums; }
      `}</style>
    </div>
  );
}

export default MasterDashboard;