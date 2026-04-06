import { useState, useEffect, useMemo } from 'react';
import { collectionGroup, query, where, getDocs, orderBy, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { startOfDay, endOfDay, format } from 'date-fns';
import { toast } from 'react-toastify';

export function useMasterAnalyticsData(dateRange, datePreset) {
  const [loading, setLoading] = useState(false);
  const [pedidos, setPedidos] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [estabelecimentos, setEstabelecimentos] = useState({});

  useEffect(() => {
    const fetchEstabelecimentos = async () => {
      try {
        const snap = await getDocs(collection(db, 'estabelecimentos'));
        const map = {};
        snap.forEach(doc => {
          map[doc.id] = doc.data().nome || doc.data().name || doc.data().razaoSocial || `Loja ${doc.id.slice(0,4)}`;
        });
        setEstabelecimentos(map);
      } catch (err) {
        console.error("Erro ao carregar lojas:", err);
      }
    };
    fetchEstabelecimentos();
  }, []);

  useEffect(() => {
    if (!dateRange.start || !dateRange.end) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const start = startOfDay(dateRange.start);
        const end = endOfDay(dateRange.end);

        const pedidosQuery = query(
          collectionGroup(db, 'pedidos'),
          where('createdAt', '>=', start),
          where('createdAt', '<=', end)
        );

        const vendasQuery = query(
          collectionGroup(db, 'vendas'),
          where('createdAt', '>=', start),
          where('createdAt', '<=', end)
        );

        const [pedidosSnap, vendasSnap] = await Promise.all([
          getDocs(pedidosQuery),
          getDocs(vendasQuery)
        ]);

        const validStatus = (s) => !['cancelad', 'recusad', 'excluid', 'rejeitad', 'erro'].some(t => String(s || '').toLowerCase().includes(t));

        const pData = [];
        pedidosSnap.forEach(d => {
          const data = d.data();
          if (data.tipo === 'mesa' || data.source === 'salao' || data.mesaNumero) return; // ignorar mesa/salao (aparecem nas vendas do pdv tb)
          if (!validStatus(data.status)) return;
          pData.push({ id: d.id, ...data, _path: d.ref.path });
        });

        const vData = [];
        vendasSnap.forEach(d => {
          const data = d.data();
          if (!validStatus(data.statusVenda) && !validStatus(data.fiscal?.status)) return;
          vData.push({ id: d.id, ...data, _path: d.ref.path });
        });

        setPedidos(pData);
        setVendas(vData);
      } catch (err) {
        console.error("Erro no Master Analytics:", err);
        toast.error("Falha ao carregar os dados gráficos.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange.start, dateRange.end]);

  const extrairData = (c) => {
    if (!c) return null;
    if (typeof c.toDate === 'function') return c.toDate();
    if (c.seconds) return new Date(c.seconds * 1000);
    return new Date(c);
  };

  const getEstabId = (item) => {
    if (item.estabelecimentoId) return item.estabelecimentoId;
    if (item.estabelecimento_id) return item.estabelecimento_id;
    if (item._path) {
      const parts = item._path.split('/');
      const idx = parts.indexOf('estabelecimentos');
      if (idx >= 0 && parts.length > idx + 1) return parts[idx+1];
    }
    return 'desconhecido';
  };

  const getTotal = (item) => Number(item.totalFinal) || Number(item.total) || Number(item.valorFinal) || Number(item.valorTotal) || 0;

  const metrics = useMemo(() => {
    const todos = [...pedidos, ...vendas];
    const rawMetrics = { total: 0, byDay: {}, byStore: {} };

    todos.forEach(item => {
      const data = extrairData(item.createdAt || item.dataPedido || item.criadoEm);
      if (!data) return;

      const valor = getTotal(item);
      rawMetrics.total += valor;

      const diaFormatado = format(data, 'dd/MM');
      if (!rawMetrics.byDay[diaFormatado]) rawMetrics.byDay[diaFormatado] = 0;
      rawMetrics.byDay[diaFormatado] += valor;

      const eId = getEstabId(item);
      if (!rawMetrics.byStore[eId]) rawMetrics.byStore[eId] = { count: 0, total: 0 };
      rawMetrics.byStore[eId].count += 1;
      rawMetrics.byStore[eId].total += valor;
    });

    // Formatting for Chart.js
    const dias = Object.keys(rawMetrics.byDay).sort((a,b) => {
      const [da, ma] = a.split('/');
      const [db, mb] = b.split('/');
      return new Date(2025, ma-1, da) - new Date(2025, mb-1, db); // sorting correctly roughly by dd/mm
    });

    const storeEntries = Object.entries(rawMetrics.byStore).map(([id, stats]) => ({
      name: estabelecimentos[id] || id,
      total: stats.total,
      count: stats.count
    })).sort((a,b) => b.total - a.total);

    const topStoresLabels = storeEntries.slice(0, 10).map(s => s.name.substring(0, 15));
    const topStoresData = storeEntries.slice(0, 10).map(s => s.total);

    return {
      faturamentoTotal: rawMetrics.total,
      qtdTransacoes: todos.length,
      evolucao: {
        labels: dias,
        data: dias.map(d => rawMetrics.byDay[d])
      },
      rankLojas: {
        labels: topStoresLabels,
        data: topStoresData
      },
      participacao: {
        labels: storeEntries.length > 5 ? [...storeEntries.slice(0,5).map(s=>s.name), 'Outros'] : storeEntries.map(s=>s.name),
        data: storeEntries.length > 5 ? [...storeEntries.slice(0,5).map(s=>s.total), storeEntries.slice(5).reduce((acc,s)=>acc+s.total, 0)] : storeEntries.map(s=>s.total)
      }
    };
  }, [pedidos, vendas, estabelecimentos]);

  return { metrics, loading };
}
