import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, query, onSnapshot, getDocs, collectionGroup, where, Timestamp, getCountFromServer } from 'firebase/firestore'; 
import { db } from '../firebase'; 
import { startOfDay, subDays } from 'date-fns';
import { toast } from 'react-toastify';

export function useMasterDashboardData(currentUser, isMasterAdmin) {
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');

  const [financeiro, setFinanceiro] = useState({
    totalHistorico: 0, qtdPedidosTotal: 0, faturamentoHoje: 0, qtdHoje: 0, topLojas: [], topLojasOntem: [],
    faturamentoOntem: 0, qtdOntem: 0, qtdNfceTotal: 0, qtdCampanhasTotal: 0, qtdCuponsTotal: 0
  });

  const [stats, setStats] = useState({ totalEstabelecimentos: 0, estabelecimentosAtivos: 0, totalUsuarios: 0 });
  const [estabelecimentosMap, setEstabelecimentosMap] = useState({});
  const [dadosBrutos, setDadosBrutos] = useState({ pedidos: [], vendas: [] });
  const [alertas, setAlertas] = useState({ certVencidos: [], certVencendo: [], mensalidadeAtrasada: [], mensalidadeVencendo: [] });
  const historicosCarregados = useRef(false);

  const [datePreset, setDatePreset] = useState(null);
  const [dateRange, setDateRange] = useState({ start: null, end: null });

  const handleDatePresetChange = useCallback((key) => setDatePreset(key), []);
  const handleDateRangeChange = useCallback((range) => setDateRange(range), []);
  const handleDateClear = useCallback(() => {
    setDatePreset(null);
    setDateRange({ start: null, end: null });
  }, []);

  const extrairData = (c) => {
    if (!c) return null;
    if (typeof c.toDate === 'function') return c.toDate();
    if (c.seconds) return new Date(c.seconds * 1000);
    const d = new Date(c); return isNaN(d.getTime()) ? null : d;
  };

  const getDate = (item) => extrairData(item.createdAt) || extrairData(item.dataPedido) || 
    extrairData(item.adicionadoEm) || extrairData(item.updatedAt) || extrairData(item.criadoEm);

  const getTotal = (item) => Number(item.totalFinal) || Number(item.total) || Number(item.valorFinal) || 0;

  const isPedidoCancelado = (p) => {
    if (!p) return false;
    const s1 = String(p.status || '').toLowerCase().trim();
    const s2 = String(p.fiscal?.status || '').toLowerCase().trim();
    const s3 = String(p.statusVenda || '').toLowerCase().trim();
    const termos = ['cancelad', 'recusad', 'excluid', 'estornad', 'devolvid', 'rejeitad', 'erro'];
    return termos.some(t => s1.includes(t) || s2.includes(t) || s3.includes(t));
  };

  const isMesaDoc = (data) => {
    return data.tipo === 'mesa' || data.source === 'salao' || !!data.mesaNumero || !!data.numeroMesa;
  };

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

      const hoje = new Date();
      hoje.setHours(0,0,0,0);
      const newAlertas = { certVencidos: [], certVencendo: [], mensalidadeAtrasada: [], mensalidadeVencendo: [] };

      estabs.forEach(estab => {
        const nome = estab.nome || estab.name || 'Sem nome';

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

  const calcularTotaisRecentes = useCallback((novosDados, tipo) => {
    setDadosBrutos(prev => {
      const atualizado = { ...prev, [tipo]: novosDados };
      
      const pedidosFiltrados = atualizado.pedidos
        .filter(d => !isMesaDoc(d) && !isPedidoCancelado(d));
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

      const rankingOntemMap = {};
      doOntem.forEach(item => {
        let estabId = item.estabelecimentoId;
        if (!estabId && item._path) { const parts = item._path.split('/'); const idx = parts.indexOf('estabelecimentos'); if (idx >= 0 && parts.length > idx + 1) estabId = parts[idx + 1]; }
        if (!estabId) estabId = 'desconhecido';
        if (!rankingOntemMap[estabId]) rankingOntemMap[estabId] = { id: estabId, nomeSalvoNoPedido: item.estabelecimentoNome || '', total: 0, pedidos: 0 };
        rankingOntemMap[estabId].total += getTotal(item);
        rankingOntemMap[estabId].pedidos += 1;
      });
      const topLojasOntem = Object.values(rankingOntemMap).sort((a, b) => b.total - a.total).slice(0, 5);

      setFinanceiro(prevFinanceiro => ({
         ...prevFinanceiro,
        faturamentoHoje: doDia.reduce((acc, item) => acc + getTotal(item), 0),
        qtdHoje: doDia.length,
        faturamentoOntem: doOntem.reduce((acc, item) => acc + getTotal(item), 0),
        qtdOntem: doOntem.length,
        topLojas,
        topLojasOntem
      }));
      return atualizado;
    });
  }, []);

  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return;

    const twoDaysAgo = Timestamp.fromDate(startOfDay(subDays(new Date(), 1)));
    
    const setupListener = (colName, tipo) => {
      const qFiltered = query(collectionGroup(db, colName), where('createdAt', '>=', twoDaysAgo));
      
      return onSnapshot(qFiltered, 
        (snap) => {
          const docs = snap.docs.map(d => ({...d.data(), _path: d.ref.path}));
          calcularTotaisRecentes(docs, tipo);
        },
        (error) => {
          console.error(`[IdeaFood] Index required for ${colName}. Create it in Firebase Console:`, error.message);
        }
      );
    };

    const unsubPedidos = setupListener('pedidos', 'pedidos');
    const unsubVendas = setupListener('vendas', 'vendas');

    return () => { 
      if (typeof unsubPedidos === 'function') unsubPedidos(); 
      if (typeof unsubVendas === 'function') unsubVendas(); 
    };
  }, [currentUser, isMasterAdmin, calcularTotaisRecentes]);

  useEffect(() => {
    if (!currentUser || !isMasterAdmin || historicosCarregados.current) return;
    historicosCarregados.current = true;

    const carregarHistorico = async () => {
      try {
        const [pedSnap, venSnap] = await Promise.all([
          getDocs(query(collectionGroup(db, 'pedidos'))),
          getDocs(query(collectionGroup(db, 'vendas')))
        ]);
        const pedidosDelivery = pedSnap.docs
          .map(d => d.data())
          .filter(d => !isMesaDoc(d) && !isPedidoCancelado(d));
        
        const vendasFinais = venSnap.docs
          .map(d => d.data())
          .filter(d => !isPedidoCancelado(d));
        
        const allDocs = [...pedidosDelivery, ...vendasFinais];
        const totalHist = allDocs.reduce((acc, item) => acc + getTotal(item), 0);
        const qtdTotal = allDocs.length;
        
        // Contar NFCes emitidas em memória (fiscal status autorizado ou que possua URL da nota)
        const qtdNfce = allDocs.filter(d => d.fiscal?.status === 'autorizado' || !!d.url_danfe).length;

        // Contar campanhas e cupons no Firestore de forma performática
        const campanhasCount = await getCountFromServer(query(collectionGroup(db, 'campanhas'))).catch(() => ({ data: () => ({ count: 0 }) }));
        const cuponsCount = await getCountFromServer(query(collectionGroup(db, 'cupons'))).catch(() => ({ data: () => ({ count: 0 }) }));

        setFinanceiro(prev => ({ 
          ...prev, 
          totalHistorico: totalHist, 
          qtdPedidosTotal: qtdTotal, 
          qtdNfceTotal: qtdNfce, 
          qtdCampanhasTotal: campanhasCount.data().count, 
          qtdCuponsTotal: cuponsCount.data().count 
        }));
      } catch (err) {
        console.error('[IdeaFood] Erro ao carregar histórico:', err);
      }
    };
    setTimeout(carregarHistorico, 1500);
  }, [currentUser, isMasterAdmin]);

  useEffect(() => {
    if (currentUser && isMasterAdmin) {
       fetchHistoricalData();
    }
  }, [currentUser, isMasterAdmin]);

  const financeiroFiltrado = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return null;
    const pedidosFiltrados = dadosBrutos.pedidos.filter(d => !isMesaDoc(d) && !isPedidoCancelado(d));
    const vendasFiltradas = dadosBrutos.vendas.filter(d => !isPedidoCancelado(d));
    const tudo = [...pedidosFiltrados, ...vendasFiltradas];
    const doPeriodo = tudo.filter(item => {
      const d = getDate(item);
      return d && d >= dateRange.start && d <= dateRange.end;
    });
    const totalPeriodo = doPeriodo.reduce((acc, item) => acc + getTotal(item), 0);
    const qtdPeriodo = doPeriodo.length;

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
    
    // Filtro NFC-e no período
    const qtdNfce = doPeriodo.filter(d => d.fiscal?.status === 'autorizado' || !!d.url_danfe).length;

    return { faturamento: totalPeriodo, qtd: qtdPeriodo, topLojas, ticketMedio: qtdPeriodo > 0 ? totalPeriodo / qtdPeriodo : 0, qtdNfce };
  }, [dadosBrutos, dateRange]);

  const crescimento = useMemo(() => {
    if (financeiro.faturamentoOntem === 0) return financeiro.faturamentoHoje > 0 ? 100 : 0;
    return ((financeiro.faturamentoHoje - financeiro.faturamentoOntem) / financeiro.faturamentoOntem * 100);
  }, [financeiro]);

  const ticketMedio = useMemo(() => {
    return financeiro.qtdHoje > 0 ? financeiro.faturamentoHoje / financeiro.qtdHoje : 0;
  }, [financeiro]);

  return {
    loadingDashboard,
    lastUpdated,
    searchQuery,
    setSearchQuery,
    financeiro,
    stats,
    estabelecimentosMap,
    alertas,
    datePreset,
    dateRange,
    handleDatePresetChange,
    handleDateRangeChange,
    handleDateClear,
    fetchHistoricalData,
    financeiroFiltrado,
    crescimento,
    ticketMedio
  };
}
