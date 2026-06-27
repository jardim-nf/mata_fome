/* eslint-disable react-refresh/only-export-components */
// src/pages/admin/RelatorioVendasProdutos.jsx — Relatório de Vendas de Produtos
import React, { useState, useEffect, useMemo, useRef } from 'react';
import BackButton from '../../components/BackButton';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import { subDays, format, startOfDay, endOfDay, parseISO, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { toast } from 'react-toastify';
import {
  IoCalendarOutline, IoStatsChartOutline, IoSearchOutline, IoChevronDown,
  IoBagCheckOutline, IoCashOutline, IoPieChartOutline, IoReceiptOutline
} from 'react-icons/io5';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const pct = (v) => `${Number(v || 0).toFixed(1)}%`;

function RelatorioVendasProdutos() {
  const { estabelecimentoIdPrincipal } = useAuth();
  const estabId = estabelecimentoIdPrincipal;

  const [pedidos, setPedidos] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProductName, setSelectedProductName] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Filtros de período
  const [periodoAtivo, setPeriodoAtivo] = useState(30);
  const [dataInicio, setDataInicio] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchProductQuery, setSearchProductQuery] = useState('');

  // Trocar período rápido
  const selecionarPeriodo = (dias) => {
    setPeriodoAtivo(dias);
    setDataInicio(format(subDays(new Date(), dias), 'yyyy-MM-dd'));
    setDataFim(format(new Date(), 'yyyy-MM-dd'));
  };

  const handleDataChange = (tipo, valor) => {
    setPeriodoAtivo(null);
    if (tipo === 'inicio') setDataInicio(valor);
    else setDataFim(valor);
  };

  // Carregar dados iniciais
  useEffect(() => {
    if (!estabId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [pedSnap, prodSnap] = await Promise.all([
          getDocs(collection(db, 'estabelecimentos', estabId, 'pedidos')),
          getDocs(collection(db, 'estabelecimentos', estabId, 'cardapio'))
        ]);
        
        const loadedOrders = pedSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => {
            const dt = p.createdAt?.toDate?.() || (p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : null);
            return dt && p.status !== 'cancelado';
          })
          .map(p => ({
            ...p,
            _date: p.createdAt?.toDate?.() || new Date(p.createdAt.seconds * 1000)
          }));
        
        const categories = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Carrega itens/produtos de cada categoria em paralelo
        const allProductsLists = await Promise.all(
          categories.map(async (cat) => {
            const [itensSnap, produtosSnap] = await Promise.all([
              getDocs(collection(db, 'estabelecimentos', estabId, 'cardapio', cat.id, 'itens')),
              getDocs(collection(db, 'estabelecimentos', estabId, 'cardapio', cat.id, 'produtos'))
            ]);
            
            const docs = [...itensSnap.docs, ...produtosSnap.docs];
            const uniqueDocs = new Map();
            docs.forEach(d => {
              if (!uniqueDocs.has(d.id)) {
                uniqueDocs.set(d.id, d);
              }
            });
            
            return Array.from(uniqueDocs.values()).map(docItem => {
              const dados = docItem.data();
              return {
                id: docItem.id,
                nome: dados.nome,
                categoria: cat.nome || 'Geral',
                preco: dados.preco || dados.valor || 0,
                ativo: dados.ativo
              };
            });
          })
        );
        
        const loadedProducts = allProductsLists.flat().filter(p => p.ativo !== false);
        
        setPedidos(loadedOrders);
        setProdutos(loadedProducts);
      } catch (err) {
        console.error('Erro ao carregar dados do relatório:', err);
        toast.error('Erro ao carregar dados de vendas.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [estabId]);

  // Gerar lista apenas com os produtos ativos no cardápio
  const listaProdutosCompleta = useMemo(() => {
    return produtos
      .map(p => ({
        id: p.id,
        nome: p.nome,
        categoria: p.categoria || 'Sem categoria',
        precoBase: p.preco || p.valor || 0
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [produtos]);

  // Definir primeiro produto como padrão ao carregar
  useEffect(() => {
    if (listaProdutosCompleta.length > 0 && !selectedProductName) {
      setSelectedProductName(listaProdutosCompleta[0].nome);
    }
  }, [listaProdutosCompleta, selectedProductName]);

  // Lista filtrada para busca no dropdown
  const produtosFiltradosDropdown = useMemo(() => {
    if (!searchProductQuery) return listaProdutosCompleta;
    const q = searchProductQuery.toLowerCase();
    return listaProdutosCompleta.filter(p => p.nome.toLowerCase().includes(q));
  }, [listaProdutosCompleta, searchProductQuery]);

  // Realizar cálculos estatísticos para o produto selecionado
  const analise = useMemo(() => {
    if (!selectedProductName || pedidos.length === 0) return null;

    const inicio = startOfDay(parseISO(dataInicio));
    const fim = endOfDay(parseISO(dataFim));
    
    // Filtrar pedidos no período
    const pedidosNoPeriodo = pedidos.filter(p => p._date >= inicio && p._date <= fim);

    let totalVendido = 0;
    let faturamentoGerado = 0;
    let faturamentoTotalGeral = 0;
    const dailyDataMap = {};
    const pedidosDoItem = [];

    pedidosNoPeriodo.forEach(order => {
      // Faturamento geral da loja para calcular participação
      const totalPedido = Number(order.totalFinal || order.valorTotal || 0);
      faturamentoTotalGeral += totalPedido;

      // Filtrar itens do pedido que correspondem ao produto selecionado
      const matchingItens = (order.itens || []).filter(item => item.nome === selectedProductName);
      
      if (matchingItens.length > 0) {
        let orderQty = 0;
        let orderVal = 0;
        
        matchingItens.forEach(item => {
          const qty = Number(item.quantidade || item.qtd || 1);
          const prc = Number(item.preco || 0);
          orderQty += qty;
          orderVal += qty * prc;
        });

        totalVendido += orderQty;
        faturamentoGerado += orderVal;

        pedidosDoItem.push({
          id: order.id,
          codigo: order.codigo || order.id.substring(0, 6).toUpperCase(),
          data: order._date,
          clienteNome: order.clienteNome || order.cliente?.nome || 'Cliente Balcão',
          quantidade: orderQty,
          precoUnitario: orderQty > 0 ? orderVal / orderQty : 0,
          totalItem: orderVal,
          totalPedido: totalPedido
        });

        // Registrar no agrupamento diário
        const dayKey = format(order._date, 'yyyy-MM-dd');
        if (!dailyDataMap[dayKey]) {
          dailyDataMap[dayKey] = { qtd: 0, receita: 0 };
        }
        dailyDataMap[dayKey].qtd += orderQty;
        dailyDataMap[dayKey].receita += orderVal;
      }
    });

    // Ordenar pedidos recentes por data descendente
    pedidosDoItem.sort((a, b) => b.data - a.data);

    // Preencher a série diária (incluindo dias com 0 vendas) para a linha do tempo do gráfico
    let dailyTimeline = [];
    try {
      const diasDoIntervalo = eachDayOfInterval({ start: inicio, end: fim });
      dailyTimeline = diasDoIntervalo.map(day => {
        const dayKey = format(day, 'yyyy-MM-dd');
        const registro = dailyDataMap[dayKey] || { qtd: 0, receita: 0 };
        return {
          diaKey,
          label: format(day, 'dd/MM'),
          qtd: registro.qtd,
          receita: registro.receita
        };
      });
    } catch (e) {
      console.error('Erro ao calcular intervalo de dias:', e);
    }

    const precoMedio = totalVendido > 0 ? faturamentoGerado / totalVendido : 0;
    const participacaoFaturamento = faturamentoTotalGeral > 0 ? (faturamentoGerado / faturamentoTotalGeral) * 100 : 0;

    return {
      totalVendido,
      faturamentoGerado,
      precoMedio,
      participacaoFaturamento,
      pedidosDoItem,
      dailyTimeline,
      faturamentoTotalGeral
    };
  }, [selectedProductName, pedidos, dataInicio, dataFim]);

  // Configurações do gráfico de linha do tempo
  const chartData = useMemo(() => {
    if (!analise || analise.dailyTimeline.length === 0) return null;
    return {
      labels: analise.dailyTimeline.map(d => d.label),
      datasets: [
        {
          label: 'Qtd Vendida',
          data: analise.dailyTimeline.map(d => d.qtd),
          borderColor: '#8B5CF6', // Purple
          backgroundColor: 'rgba(139, 92, 246, 0.05)',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          borderWidth: 2,
          yAxisID: 'y'
        },
        {
          label: 'Faturamento (R$)',
          data: analise.dailyTimeline.map(d => d.receita),
          borderColor: '#10B981', // Emerald green
          backgroundColor: 'rgba(16, 185, 129, 0.05)',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          borderWidth: 2,
          yAxisID: 'y1'
        }
      ]
    };
  }, [analise]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { usePointStyle: true, font: { size: 11, weight: 'bold' } }
      },
      tooltip: {
        backgroundColor: '#1E293B',
        titleFont: { size: 12, weight: 'bold' },
        bodyFont: { size: 11 },
        padding: 10,
        borderRadius: 8
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: { display: true, text: 'Unidades Vendidas', font: { size: 10, weight: 'bold' } },
        grid: { color: 'rgba(0,0,0,0.02)' },
        ticks: { font: { size: 10 } }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: { display: true, text: 'Receita (R$)', font: { size: 10, weight: 'bold' } },
        grid: { drawOnChartArea: false },
        ticks: { font: { size: 10 }, callback: (v) => `R$ ${v}` }
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#8B5CF6] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] to-[#F1F5F9] p-4 sm:p-6 font-sans pb-24 relative overflow-hidden">
      {/* Decorative nebula glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-400/5 rounded-full blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-[10%] right-[-5%] w-[450px] h-[450px] bg-emerald-400/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <BackButton to="/dashboard" />
            <div>
              <h1 className="text-2xl font-black tracking-tight text-gray-900 flex items-center gap-2">
                <IoStatsChartOutline className="text-purple-600" /> Vendas por Produto
              </h1>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Analise o desempenho e histórico de vendas de cada item do menu.</p>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 mb-6 flex flex-col md:flex-row gap-5 items-stretch md:items-center justify-between">
          
          {/* Product selection search dropdown */}
          <div className="flex-1 relative" ref={dropdownRef}>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Produto Selecionado</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full pl-5 pr-10 py-3 bg-slate-50/70 border border-slate-200 focus:border-purple-500 focus:bg-white rounded-2xl outline-none text-sm font-bold text-gray-800 transition-all text-left flex justify-between items-center shadow-sm"
              >
                <span className="truncate">{selectedProductName || 'Selecione um produto'}</span>
                <IoChevronDown size={14} className="text-gray-400 shrink-0 ml-2" />
              </button>

              {isOpen && (
                <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-80 flex flex-col overflow-hidden">
                  <div className="p-3 border-b border-slate-100 bg-slate-50/50 relative">
                    <IoSearchOutline className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                    <input
                      type="text"
                      placeholder="Pesquisar produto..."
                      value={searchProductQuery}
                      onChange={e => setSearchProductQuery(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 bg-white"
                      autoFocus
                    />
                    {searchProductQuery && (
                      <button
                        onClick={() => setSearchProductQuery('')}
                        className="absolute right-6 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-red-500"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto max-h-56 divide-y divide-slate-50">
                    {produtosFiltradosDropdown.length > 0 ? (
                      produtosFiltradosDropdown.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedProductName(p.nome);
                            setIsOpen(false);
                            setSearchProductQuery('');
                          }}
                          className={`w-full text-left px-5 py-3 text-xs font-bold hover:bg-purple-50 hover:text-purple-700 transition-colors flex items-center justify-between ${
                            selectedProductName === p.nome ? 'bg-purple-50 text-purple-700 font-extrabold' : 'text-gray-700'
                          }`}
                        >
                          <span className="truncate mr-2">{p.nome}</span>
                          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider shrink-0">{p.categoria}</span>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-gray-400 italic">
                        Nenhum produto correspondente
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="h-px md:w-px md:h-12 bg-slate-100" />

          {/* Date Picker and Shortcuts */}
          <div className="flex flex-col gap-2 shrink-0">
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Período de Vendas</label>
            <div className="flex flex-wrap items-center gap-3">
              {/* Quick selectors */}
              <div className="flex gap-1">
                {[7, 15, 30, 90].map(d => (
                  <button
                    key={d}
                    onClick={() => selecionarPeriodo(d)}
                    className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${
                      periodoAtivo === d
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-purple-50 hover:text-purple-600'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>

              {/* Date Inputs */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 shadow-inner">
                <IoCalendarOutline size={14} className="text-slate-400 shrink-0" />
                <input
                  type="date"
                  value={dataInicio}
                  onChange={e => handleDataChange('inicio', e.target.value)}
                  className="bg-transparent border-none outline-none text-xs text-slate-700 font-bold cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 uppercase font-black px-1">Até</span>
                <input
                  type="date"
                  value={dataFim}
                  onChange={e => handleDataChange('fim', e.target.value)}
                  className="bg-transparent border-none outline-none text-xs text-slate-700 font-bold cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Analytics Content */}
        {!selectedProductName ? (
          <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-sm">
            <p className="text-slate-550 font-bold">Nenhum produto cadastrado ou vendido encontrado.</p>
          </div>
        ) : !analise || analise.totalVendido === 0 ? (
          <div className="bg-white rounded-[2rem] border border-slate-100 p-16 text-center shadow-sm flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-4 shadow-sm">
              <IoBagCheckOutline size={28} />
            </div>
            <h3 className="text-lg font-black text-gray-900 tracking-tight">Sem vendas no período</h3>
            <p className="text-xs text-slate-500 font-semibold max-w-sm mt-2 leading-relaxed">
              O produto <strong className="text-purple-600">"{selectedProductName}"</strong> não registrou nenhuma venda entre os dias {format(parseISO(dataInicio), 'dd/MM/yyyy')} e {format(parseISO(dataFim), 'dd/MM/yyyy')}.
            </p>
          </div>
        ) : (
          <>
            {/* KPI STATS CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Qtd Vendida */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Unidades Vendidas</p>
                  <p className="text-2xl font-black tracking-tight text-slate-900">{fmtNum(analise.totalVendido)}</p>
                  <p className="text-[10px] text-slate-500 mt-1.5 font-semibold">Em {analise.pedidosDoItem.length} pedidos</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <IoBagCheckOutline size={18} />
                </div>
              </div>

              {/* Faturamento Gerado */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Faturamento Gerado</p>
                  <p className="text-2xl font-black tracking-tight text-emerald-600">{fmt(analise.faturamentoGerado)}</p>
                  <p className="text-[10px] text-slate-500 mt-1.5 font-semibold">Volume bruto em caixa</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <IoCashOutline size={18} />
                </div>
              </div>

              {/* Preço Médio */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Preço Médio Praticado</p>
                  <p className="text-2xl font-black tracking-tight text-slate-900">{fmt(analise.precoMedio)}</p>
                  <p className="text-[10px] text-slate-500 mt-1.5 font-semibold">Média ponderada do item</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <IoReceiptOutline size={18} />
                </div>
              </div>

              {/* Participação no Faturamento */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Participação nas Vendas</p>
                  <p className="text-2xl font-black tracking-tight text-purple-600">{pct(analise.participacaoFaturamento)}</p>
                  <p className="text-[10px] text-slate-500 mt-1.5 font-semibold">Do faturamento geral do período</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <IoPieChartOutline size={18} />
                </div>
              </div>
            </div>

            {/* CHART PANEL */}
            {chartData && (
              <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 mb-6">
                <h3 className="text-sm font-black text-gray-800 mb-5 flex items-center gap-2">
                  <IoStatsChartOutline className="text-purple-600" /> Gráfico de Evolução Diária de Vendas
                </h3>
                <div className="h-72">
                  <Line data={chartData} options={chartOptions} />
                </div>
              </div>
            )}

            {/* DETAILED ORDERS LIST */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6">
              <h3 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
                📋 Pedidos que incluíram o produto ({analise.pedidosDoItem.length})
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-3 text-[10px] font-black text-slate-400 uppercase">Código</th>
                      <th className="py-3 text-[10px] font-black text-slate-400 uppercase">Data/Hora</th>
                      <th className="py-3 text-[10px] font-black text-slate-400 uppercase">Cliente</th>
                      <th className="py-3 text-[10px] font-black text-slate-400 uppercase text-center">Qtd Item</th>
                      <th className="py-3 text-[10px] font-black text-slate-400 uppercase text-right">Prc Unitário</th>
                      <th className="py-3 text-[10px] font-black text-slate-400 uppercase text-right">Total Item</th>
                      <th className="py-3 text-[10px] font-black text-slate-400 uppercase text-right">Total Pedido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analise.pedidosDoItem.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 text-xs font-bold text-purple-600">#{item.codigo}</td>
                        <td className="py-3.5 text-xs text-slate-500 font-semibold">{format(item.data, 'dd/MM/yyyy HH:mm')}</td>
                        <td className="py-3.5 text-xs font-bold text-slate-800">{item.clienteNome}</td>
                        <td className="py-3.5 text-xs font-black text-slate-800 text-center">{item.quantidade}</td>
                        <td className="py-3.5 text-xs text-slate-600 text-right">{fmt(item.precoUnitario)}</td>
                        <td className="py-3.5 text-xs font-black text-slate-800 text-right">{fmt(item.totalItem)}</td>
                        <td className="py-3.5 text-xs text-slate-500 text-right">{fmt(item.totalPedido)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default withEstablishmentAuth(RelatorioVendasProdutos);
