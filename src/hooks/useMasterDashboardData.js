import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, query, onSnapshot, getDocs, collectionGroup, where, Timestamp, getCountFromServer, limit } from 'firebase/firestore'; 
import { db } from '../firebase'; 
import { startOfDay, subDays, endOfDay } from 'date-fns';
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
  const [contatosEstabelecimentos, setContatosEstabelecimentos] = useState([]);
  const [dadosBrutos, setDadosBrutos] = useState({ pedidos: [], vendas: [] });
  const [dadosFiltradosBrutos, setDadosFiltradosBrutos] = useState({ pedidos: [], vendas: [] });
  const [alertas, setAlertas] = useState({ certVencidos: [], certVencendo: [], mensalidadeAtrasada: [], mensalidadeVencendo: [] });
  const historicosCarregados = useRef(false);

  const [datePreset, setDatePreset] = useState(null);
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [selectedStore, setSelectedStore] = useState('');

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

  const getDate = (item) => {
    const rawDate = extrairData(item.createdAt) || extrairData(item.dataPedido) || 
      extrairData(item.adicionadoEm) || extrairData(item.updatedAt) || extrairData(item.criadoEm);
      
    if (!rawDate) return null;
    
    // Dia Operacional (Virada de Caixa às 06:00)
    // Subtrai 6 horas para que vendas até as 05:59 da manhã sejam contabilizadas no dia anterior
    return new Date(rawDate.getTime() - (6 * 60 * 60 * 1000));
  };

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
      const [estabSnap, usersCount] = await Promise.all([
        getDocs(query(collection(db, 'estabelecimentos'))),
        getCountFromServer(query(collection(db, 'usuarios'))).catch(() => ({ data: () => ({ count: 0 }) })),
      ]);
      const estabs = estabSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const mapEstabs = {};
      const contatos = [];
      estabs.forEach(e => { 
        mapEstabs[e.id] = e.nome || e.name || e.razaoSocial; 
        const _possiblePhones = [e.informacoes_contato?.telefone_whatsapp, e['informacoes_contato.telefone_whatsapp'], e.whatsapp, e.telefone, e.phone];
        const _validPhone = _possiblePhones.find(p => p && String(p).replace(/\D/g, '').length >= 8);

        contatos.push({
          id: e.id,
          nome: e.nome || e.name || e.razaoSocial || 'Sem Nome',
          telefone: _validPhone || ''
        });
      });
      setEstabelecimentosMap(mapEstabs);
      setContatosEstabelecimentos(contatos);
      setStats({
        totalEstabelecimentos: estabSnap.size,
        estabelecimentosAtivos: estabs.filter(e => e.ativo).length,
        totalUsuarios: usersCount.data().count,
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
      const map = new Map();
      prev[tipo].forEach(item => { if(item.id) map.set(item.id, item); });
      novosDados.forEach(item => { if(item.id) map.set(item.id, item); });
      const arrayMerged = Array.from(map.values());
      const atualizado = { ...prev, [tipo]: arrayMerged };
      
      const pedidosFiltrados = atualizado.pedidos
        .filter(d => !isMesaDoc(d) && !isPedidoCancelado(d));
      const vendasFiltradas = atualizado.vendas
        .filter(d => !isPedidoCancelado(d));
      
      const tudo = [...pedidosFiltrados, ...vendasFiltradas];
      
      // Ajuste do "Hoje" Operacional: Se for 02:00 da manhã, "hoje" pro sistema ainda é o dia anterior!
      const dataAtualOperacional = new Date(Date.now() - (6 * 60 * 60 * 1000));
      const hoje = startOfDay(dataAtualOperacional);
      const ontem = startOfDay(subDays(dataAtualOperacional, 1));

      const doDia = tudo.filter(item => { const d = getDate(item); return d && d >= hoje; });
      const doOntem = tudo.filter(item => { const d = getDate(item); return d && d >= ontem && d < hoje; });

      const rankingMap = {};
      doDia.forEach(item => {
        let estabId = item.estabelecimentoId;
        if (!estabId && item._path) { const parts = item._path.split('/'); const idx = parts.indexOf('estabelecimentos'); if (idx >= 0 && parts.length > idx + 1) estabId = parts[idx + 1]; }
        if (!estabId) estabId = 'desconhecido';
        if (!rankingMap[estabId]) rankingMap[estabId] = { id: estabId, nomeSalvoNoPedido: item.estabelecimentoNome || '', total: 0, pedidos: 0, itens: [] };
        rankingMap[estabId].total += getTotal(item);
        rankingMap[estabId].pedidos += 1;
        rankingMap[estabId].itens.push(item);
      });
      const topLojas = Object.values(rankingMap).sort((a, b) => b.total - a.total).slice(0, 20);

      const rankingOntemMap = {};
      doOntem.forEach(item => {
        let estabId = item.estabelecimentoId;
        if (!estabId && item._path) { const parts = item._path.split('/'); const idx = parts.indexOf('estabelecimentos'); if (idx >= 0 && parts.length > idx + 1) estabId = parts[idx + 1]; }
        if (!estabId) estabId = 'desconhecido';
        if (!rankingOntemMap[estabId]) rankingOntemMap[estabId] = { id: estabId, nomeSalvoNoPedido: item.estabelecimentoNome || '', total: 0, pedidos: 0, itens: [] };
        rankingOntemMap[estabId].total += getTotal(item);
        rankingOntemMap[estabId].pedidos += 1;
        rankingOntemMap[estabId].itens.push(item);
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
          const docs = snap.docs.map(d => ({id: d.id, ...d.data(), _path: d.ref.path}));
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
    if (!currentUser || !isMasterAdmin) return;
    if (!dateRange.start || !dateRange.end) {
      setDadosFiltradosBrutos({ pedidos: [], vendas: [] });
      return;
    }

    const fetchPeriodData = async () => {
      setLoadingDashboard(true);
      try {
        const start = startOfDay(dateRange.start);
        const end = new Date(endOfDay(dateRange.end).getTime() + (6 * 60 * 60 * 1000)); // Operational margin (6h)

        // Query only with the start bound to use the existing collectionGroup createdAt index
        const pedidosQuery = query(
          collectionGroup(db, 'pedidos'),
          where('createdAt', '>=', start)
        );

        const vendasQuery = query(
          collectionGroup(db, 'vendas'),
          where('createdAt', '>=', start)
        );

        const [pedidosSnap, vendasSnap] = await Promise.all([
          getDocs(pedidosQuery),
          getDocs(vendasQuery)
        ]);

        const pData = [];
        pedidosSnap.forEach(d => {
          const data = d.data();
          const itemDate = extrairData(data.createdAt) || extrairData(data.dataPedido);
          // Filter by end date locally to avoid requiring a new Firestore index
          if (itemDate && itemDate <= end) {
            pData.push({ id: d.id, ...data, _path: d.ref.path });
          }
        });

        const vData = [];
        vendasSnap.forEach(d => {
          const data = d.data();
          const itemDate = extrairData(data.createdAt) || extrairData(data.dataPedido);
          // Filter by end date locally to avoid requiring a new Firestore index
          if (itemDate && itemDate <= end) {
            vData.push({ id: d.id, ...data, _path: d.ref.path });
          }
        });

        setDadosFiltradosBrutos({ pedidos: pData, vendas: vData });
      } catch (err) {
        console.error('[IdeaFood] Erro ao carregar dados do período:', err);
        if (err.message && err.message.includes('index')) {
          toast.error(`Erro de índice no Firestore. Clique no link para criar: ${err.message}`, { autoClose: false });
        } else {
          toast.error('Erro ao carregar dados do período filtrado: ' + err.message);
        }
      } finally {
        setLoadingDashboard(false);
      }
    };

    fetchPeriodData();
  }, [currentUser, isMasterAdmin, dateRange.start, dateRange.end]);

  useEffect(() => {
    if (!currentUser || !isMasterAdmin || historicosCarregados.current) return;
    historicosCarregados.current = true;

    const carregarHistorico = async () => {
      try {
        const [countPed, countVen, countNfce, campanhasCount, cuponsCount] = await Promise.all([
          getCountFromServer(query(collectionGroup(db, 'pedidos'))).catch(() => ({ data: () => ({ count: 0 }) })),
          getCountFromServer(query(collectionGroup(db, 'vendas'))).catch(() => ({ data: () => ({ count: 0 }) })),
          getCountFromServer(query(collectionGroup(db, 'vendas'), where('fiscal.status', '==', 'autorizado'))).catch((err) => {
            console.warn('[IdeaFood] Para obter a contagem total de NFC-e, crie este índice no Firebase Console:', err.message);
            return { data: () => ({ count: 0 }) };
          }),
          getCountFromServer(query(collectionGroup(db, 'campanhas'))).catch(() => ({ data: () => ({ count: 0 }) })),
          getCountFromServer(query(collectionGroup(db, 'cupons'))).catch(() => ({ data: () => ({ count: 0 }) }))
        ]);

        const qtdTotal = countPed.data().count + countVen.data().count;
        const qtdNfce = countNfce.data().count;

        setFinanceiro(prev => ({ 
          ...prev, 
          totalHistorico: 0, 
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
    if ((!dateRange.start || !dateRange.end) && !selectedStore) return null;
    const sourceData = (dateRange.start && dateRange.end) ? dadosFiltradosBrutos : dadosBrutos;
    const pedidosFiltrados = sourceData.pedidos.filter(d => !isMesaDoc(d) && !isPedidoCancelado(d));
    const vendasFiltradas = sourceData.vendas.filter(d => !isPedidoCancelado(d));
    const tudo = [...pedidosFiltrados, ...vendasFiltradas];
    
    // Ajuste do "Hoje" Operacional
    const dataAtualOperacional = new Date(Date.now() - (6 * 60 * 60 * 1000));
    const hoje = startOfDay(dataAtualOperacional);

    const doPeriodo = tudo.filter(item => {
      let estabId = item.estabelecimentoId;
      if (!estabId && item._path) { const parts = item._path.split('/'); const idx = parts.indexOf('estabelecimentos'); if (idx >= 0 && parts.length > idx + 1) estabId = parts[idx + 1]; }
      if (!estabId) estabId = 'desconhecido';

      if (selectedStore && estabId !== selectedStore) return false;

      const d = getDate(item);
      if (dateRange.start && dateRange.end) {
        return d && d >= dateRange.start && d <= dateRange.end;
      }

      // se selecionou apenas loja, filtra os pedidos de hoje por padrão
      return d && d >= hoje;
    });
    const totalPeriodo = doPeriodo.reduce((acc, item) => acc + getTotal(item), 0);
    const qtdPeriodo = doPeriodo.length;

    const rankingMap = {};
    doPeriodo.forEach(item => {
      let estabId = item.estabelecimentoId;
      if (!estabId && item._path) { const parts = item._path.split('/'); const idx = parts.indexOf('estabelecimentos'); if (idx >= 0 && parts.length > idx + 1) estabId = parts[idx + 1]; }
      if (!estabId) estabId = 'desconhecido';
      if (!rankingMap[estabId]) rankingMap[estabId] = { id: estabId, nomeSalvoNoPedido: item.estabelecimentoNome || '', total: 0, pedidos: 0, itens: [] };
      rankingMap[estabId].total += getTotal(item);
      rankingMap[estabId].pedidos += 1;
      rankingMap[estabId].itens.push(item);
    });
    const topLojas = Object.values(rankingMap).sort((a, b) => b.total - a.total).slice(0, 20);
    
    // Filtro NFC-e no período
    const qtdNfce = doPeriodo.filter(d => d.fiscal?.status === 'autorizado' || !!d.url_danfe).length;

    return { faturamento: totalPeriodo, qtd: qtdPeriodo, topLojas, ticketMedio: qtdPeriodo > 0 ? totalPeriodo / qtdPeriodo : 0, qtdNfce };
  }, [dadosBrutos, dadosFiltradosBrutos, dateRange, selectedStore]);

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
    contatosEstabelecimentos,
    fetchHistoricalData,
    financeiroFiltrado,
    crescimento,
    ticketMedio,
    selectedStore,
    setSelectedStore
  };
}
