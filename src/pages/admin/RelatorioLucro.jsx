// src/pages/admin/RelatorioLucro.jsx — Relatório de Lucro Real (Receita − Custo)
import React, { useState, useEffect, useMemo, useRef } from 'react';
import BackButton from '../../components/BackButton';

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import { subDays, format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  IoWalletOutline, IoTrendingUpOutline, IoTrendingDownOutline,
  IoAlertCircleOutline, IoSearchOutline, IoChevronDown, IoChevronUp,
  IoDownloadOutline, IoPrintOutline, IoBarChartOutline, IoReceiptOutline,
  IoStatsChartOutline, IoLayersOutline, IoEyeOutline, IoEyeOffOutline,
  IoCalendarOutline
} from 'react-icons/io5';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement,
  PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';

import jsPDF from 'jspdf';
import { toast } from 'react-toastify';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

/* ── helpers ────────────────────────────────────────────────── */
const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v) => `${Number(v || 0).toFixed(1)}%`;

/* ── KPI Card ───────────────────────────────────────────────── */
const StatCard = ({ title, value, subtitle, icon, color = 'emerald' }) => {
  const palettes = {
    emerald: { border: 'border-emerald-100', bg: 'bg-emerald-50', text: 'text-emerald-600', circle: 'bg-emerald-100' },
    red:     { border: 'border-red-100',     bg: 'bg-red-50',     text: 'text-red-600',     circle: 'bg-red-100'     },
    amber:   { border: 'border-amber-100',   bg: 'bg-amber-50',   text: 'text-amber-600',   circle: 'bg-amber-100'   },
    blue:    { border: 'border-blue-100',     bg: 'bg-blue-50',    text: 'text-blue-600',    circle: 'bg-blue-100'    },
    purple:  { border: 'border-purple-100',   bg: 'bg-purple-50',  text: 'text-purple-600',  circle: 'bg-purple-100'  },
  };
  const p = palettes[color] || palettes.emerald;
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-3 sm:p-4 hover:shadow-md transition-all relative overflow-hidden group ${p.border}`}>
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 ${p.circle} group-hover:scale-110 transition-transform`} />
      <div className="relative z-10">
        <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-base sm:text-lg xl:text-xl font-black text-gray-900 tracking-tight leading-snug">{value}</p>
        {subtitle && <p className="text-[9px] sm:text-[10px] text-gray-500 font-medium mt-1">{subtitle}</p>}
      </div>
    </div>
  );
};

/* ── Main Component ─────────────────────────────────────────── */
function RelatorioLucro() {
  const { userData } = useAuth();
  const estabId = userData?.estabelecimentosGerenciados?.[0];
  const [pedidos, setPedidos] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodoAtivo, setPeriodoAtivo] = useState(30);
  const [dataInicio, setDataInicio] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const [alertOpen, setAlertOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [sortBy, setSortBy] = useState('lucro');
  const [sortDir, setSortDir] = useState('desc');

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

  /* ── data fetch ────────────────────────────────────────────── */
  useEffect(() => {
    if (!estabId) return;
    const load = async () => {
      const [pedSnap, prodSnap] = await Promise.all([
        getDocs(collection(db, 'estabelecimentos', estabId, 'pedidos')),
        getDocs(collection(db, 'estabelecimentos', estabId, 'cardapio'))
      ]);
      setPedidos(pedSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => {
        const dt = p.createdAt?.toDate?.() || (p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : null);
        return dt && p.status !== 'cancelado';
      }).map(p => ({ ...p, _date: p.createdAt?.toDate?.() || new Date(p.createdAt.seconds * 1000) })));
      setProdutos(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    load();
  }, [estabId]);

  /* ── analysis ──────────────────────────────────────────────── */
  const analise = useMemo(() => {
    if (pedidos.length === 0) return null;
    const inicio = startOfDay(parseISO(dataInicio));
    const fim = endOfDay(parseISO(dataFim));
    const filtrados = pedidos.filter(p => p._date >= inicio && p._date <= fim);

    // Cost map
    const custoPorNome = {};
    produtos.forEach(p => {
      let custoPadrao = Number(p.custo_estimado || p.custo || p.custoUnitario || 0);
      if (custoPadrao === 0 && p.variacoes && p.variacoes.length > 0) {
        custoPadrao = Number(p.variacoes[0].custo || 0);
      }
      custoPorNome[p.nome] = custoPadrao;
    });

    let receitaTotal = 0;
    let custoTotal = 0;
    const porProduto = {};
    const receitaPorDia = {};

    filtrados.forEach(p => {
      const totalPedido = Number(p.totalFinal) || 0;
      receitaTotal += totalPedido;

      // Daily tracking
      const diaKey = format(p._date, 'yyyy-MM-dd');
      if (!receitaPorDia[diaKey]) receitaPorDia[diaKey] = { receita: 0, custo: 0, pedidos: 0 };
      receitaPorDia[diaKey].receita += totalPedido;
      receitaPorDia[diaKey].pedidos += 1;

      (p.itens || []).forEach(item => {
        const nome = item.nome || 'Desconhecido';
        const qtd = Number(item.quantidade || item.qtd) || 1;
        const preco = Number(item.preco) || 0;
        const custo = custoPorNome[nome] || 0;
        const receita = preco * qtd;
        const custoItem = custo * qtd;

        if (!porProduto[nome]) porProduto[nome] = { nome, receita: 0, custo: 0, qtd: 0 };
        porProduto[nome].receita += receita;
        porProduto[nome].custo += custoItem;
        porProduto[nome].qtd += qtd;
        custoTotal += custoItem;

        if (receitaPorDia[diaKey]) receitaPorDia[diaKey].custo += custoItem;
      });
    });

    const lucroTotal = receitaTotal - custoTotal;
    const margemTotal = receitaTotal > 0 ? (lucroTotal / receitaTotal) * 100 : 0;

    const produtosRanked = Object.values(porProduto).map(p => ({
      ...p,
      lucro: p.receita - p.custo,
      margem: p.receita > 0 ? ((p.receita - p.custo) / p.receita) * 100 : 0
    })).sort((a, b) => b.lucro - a.lucro);

    const semCusto = produtosRanked.filter(p => p.custo === 0 && p.qtd > 0);
    const totalQtd = produtosRanked.reduce((s, p) => s + p.qtd, 0);

    // Daily sorted
    const diasOrdenados = Object.keys(receitaPorDia).sort();
    const dailyData = diasOrdenados.map(d => ({
      dia: d,
      label: format(new Date(d + 'T12:00:00'), 'dd/MM', { locale: ptBR }),
      ...receitaPorDia[d],
      lucro: receitaPorDia[d].receita - receitaPorDia[d].custo
    }));

    return {
      receitaTotal, custoTotal, lucroTotal, margemTotal,
      produtosRanked, semCusto, totalPedidos: filtrados.length,
      totalQtd, dailyData,
      ticketMedio: filtrados.length > 0 ? receitaTotal / filtrados.length : 0
    };
  }, [pedidos, produtos, dataInicio, dataFim]);

  /* ── sort handler ──────────────────────────────────────────── */
  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir(col === 'nome' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <IoChevronDown className="text-gray-300 text-[8px]" />;
    return sortDir === 'asc'
      ? <IoChevronUp className="text-emerald-500 text-[10px]" />
      : <IoChevronDown className="text-emerald-500 text-[10px]" />;
  };

  /* ── filtered + sorted products list ──────────────────────── */
  const produtosFiltrados = useMemo(() => {
    if (!analise) return [];
    let list = [...analise.produtosRanked];

    // Sort
    list.sort((a, b) => {
      let valA, valB;
      switch (sortBy) {
        case 'nome': valA = a.nome.toLowerCase(); valB = b.nome.toLowerCase();
          return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'qtd': valA = a.qtd; valB = b.qtd; break;
        case 'receita': valA = a.receita; valB = b.receita; break;
        case 'custo': valA = a.custo; valB = b.custo; break;
        case 'lucro': valA = a.lucro; valB = b.lucro; break;
        case 'margem': valA = a.margem; valB = b.margem; break;
        default: valA = a.lucro; valB = b.lucro;
      }
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(p => p.nome.toLowerCase().includes(term));
    }

    return showAll ? list : list.slice(0, 20);
  }, [analise, searchTerm, showAll, sortBy, sortDir]);

  /* ── CSV export ────────────────────────────────────────────── */
  const handleExportCSV = () => {
    if (!analise) return;
    const header = 'Posição;Produto;Qtd Vendida;Receita;Custo;Lucro;Margem %\n';
    const rows = analise.produtosRanked.map((p, i) =>
      `${i + 1};${p.nome};${p.qtd};${p.receita.toFixed(2)};${p.custo.toFixed(2)};${p.lucro.toFixed(2)};${p.margem.toFixed(1)}`
    ).join('\n');
    const periodoLabel = `${format(parseISO(dataInicio), 'dd-MM-yyyy')}_a_${format(parseISO(dataFim), 'dd-MM-yyyy')}`;
    const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `relatorio-lucro-${periodoLabel}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  /* ── PDF export (nativo jsPDF, sem cortar) ──────────────────── */
  const handleExportPDF = () => {
    if (!analise) return;
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const W = pdf.internal.pageSize.getWidth();
      const H = pdf.internal.pageSize.getHeight();
      const m = 10; // margin
      const usable = W - m * 2;
      let y = 0;
      let pageNum = 1;
      const totalProducts = analise.produtosRanked.length;

      const checkPage = (need) => {
        if (y + need > H - 14) {
          drawFooter(pageNum);
          pdf.addPage();
          pageNum++;
          y = m + 2;
        }
      };

      // ── Header bar ──
      const drawHeader = () => {
        pdf.setFillColor(16, 185, 129); // emerald
        pdf.rect(0, 0, W, 18, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(15);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Relatório de Lucro', m, 12);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        const periodoTxt = `${format(parseISO(dataInicio), 'dd/MM/yyyy')} a ${format(parseISO(dataFim), 'dd/MM/yyyy')} • ${analise.totalPedidos} pedidos`;
        pdf.text(periodoTxt, W - m - pdf.getTextWidth(periodoTxt), 12);
        pdf.setTextColor(0, 0, 0);
      };

      // ── Footer ──
      const drawFooter = (pg) => {
        pdf.setFontSize(7);
        pdf.setTextColor(150, 150, 150);
        const now = new Date();
        pdf.text(`Gerado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, m, H - 4);
        const pgText = `Página ${pg}`;
        pdf.text(pgText, W - m - pdf.getTextWidth(pgText), H - 4);
        pdf.setTextColor(0, 0, 0);
      };

      // ── Draw header ──
      drawHeader();
      y = 24;

      // ── KPI Summary boxes ──
      const kpis = [
        { label: 'Receita', value: fmt(analise.receitaTotal), color: [16, 185, 129] },
        { label: 'Custo', value: fmt(analise.custoTotal), color: [239, 68, 68] },
        { label: 'Lucro', value: fmt(analise.lucroTotal), color: analise.lucroTotal >= 0 ? [16, 185, 129] : [239, 68, 68] },
        { label: 'Margem', value: pct(analise.margemTotal), color: analise.margemTotal >= 30 ? [59, 130, 246] : [245, 158, 11] },
        { label: 'Ticket Médio', value: fmt(analise.ticketMedio), color: [139, 92, 246] },
      ];
      const kpiW = (usable - 4 * 3) / 5; // 5 boxes with 3mm gap
      kpis.forEach((k, i) => {
        const x = m + i * (kpiW + 3);
        // Box bg
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(x, y, kpiW, 18, 2, 2, 'F');
        // Left color accent
        pdf.setFillColor(...k.color);
        pdf.rect(x, y, 1.2, 18, 'F');
        // Label
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(120, 120, 120);
        pdf.text(k.label.toUpperCase(), x + 4, y + 6);
        // Value
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...k.color);
        pdf.text(k.value, x + 4, y + 14);
      });
      pdf.setTextColor(0, 0, 0);
      y += 24;

      // ── Table header ──
      const cols = [
        { label: '#', x: m, w: 10, align: 'center' },
        { label: 'Produto', x: m + 10, w: 72, align: 'left' },
        { label: 'Qtd', x: m + 82, w: 16, align: 'center' },
        { label: 'Receita', x: m + 98, w: 28, align: 'right' },
        { label: 'Custo', x: m + 126, w: 28, align: 'right' },
        { label: 'Lucro', x: m + 154, w: 28, align: 'right' },
        { label: 'Margem', x: m + 182, w: 18 - m + 8, align: 'right' },
      ];
      const rowH = 7;
      const headerH = 8;

      const drawTableHeader = () => {
        pdf.setFillColor(30, 41, 59); // slate-800
        pdf.roundedRect(m, y, usable, headerH, 1.5, 1.5, 'F');
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(255, 255, 255);
        cols.forEach(c => {
          const textY = y + 5.5;
          if (c.align === 'right') {
            pdf.text(c.label, c.x + c.w - 1, textY, { align: 'right' });
          } else if (c.align === 'center') {
            pdf.text(c.label, c.x + c.w / 2, textY, { align: 'center' });
          } else {
            pdf.text(c.label, c.x + 1, textY);
          }
        });
        pdf.setTextColor(0, 0, 0);
        y += headerH + 1;
      };

      drawTableHeader();

      // ── Table rows ──
      analise.produtosRanked.forEach((p, i) => {
        checkPage(rowH + 2);
        
        // Alternating row bg
        if (i % 2 === 0) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(m, y - 0.5, usable, rowH, 'F');
        }

        // Top 3 highlight
        if (i < 3) {
          const medalColors = [[255, 215, 0], [192, 192, 192], [205, 127, 50]];
          pdf.setFillColor(...medalColors[i]);
          pdf.circle(m + 5, y + 3, 2.5, 'F');
          pdf.setFontSize(6);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(60, 60, 60);
          pdf.text(`${i + 1}`, m + 5, y + 4.2, { align: 'center' });
        } else {
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(120, 120, 120);
          pdf.text(`${i + 1}`, m + 5, y + 4.5, { align: 'center' });
        }

        // Product name (truncate if too long)
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 41, 59);
        let nome = p.nome;
        while (pdf.getTextWidth(nome) > 70 && nome.length > 3) {
          nome = nome.substring(0, nome.length - 2) + '…';
        }
        pdf.text(nome, cols[1].x + 1, y + 4.5);

        // Qty
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(59, 130, 246);
        pdf.text(`${p.qtd}`, cols[2].x + cols[2].w / 2, y + 4.5, { align: 'center' });

        // Receita
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(75, 85, 99);
        pdf.text(fmt(p.receita), cols[3].x + cols[3].w - 1, y + 4.5, { align: 'right' });

        // Custo
        pdf.setTextColor(p.custo > 0 ? 239 : 180, p.custo > 0 ? 68 : 180, p.custo > 0 ? 68 : 180);
        pdf.text(fmt(p.custo), cols[4].x + cols[4].w - 1, y + 4.5, { align: 'right' });

        // Lucro
        pdf.setFont('helvetica', 'bold');
        if (p.lucro >= 0) pdf.setTextColor(16, 185, 129); else pdf.setTextColor(239, 68, 68);
        pdf.text(fmt(p.lucro), cols[5].x + cols[5].w - 1, y + 4.5, { align: 'right' });

        // Margem
        pdf.setFontSize(7);
        if (p.margem >= 30) pdf.setTextColor(16, 185, 129);
        else if (p.margem >= 15) pdf.setTextColor(245, 158, 11);
        else pdf.setTextColor(239, 68, 68);
        pdf.text(`${p.margem.toFixed(1)}%`, cols[6].x + cols[6].w - 1, y + 4.5, { align: 'right' });

        pdf.setTextColor(0, 0, 0);
        y += rowH;
      });

      // ── Summary footer row ──
      checkPage(12);
      y += 3;
      pdf.setFillColor(16, 185, 129);
      pdf.roundedRect(m, y, usable, 10, 2, 2, 'F');
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.text('TOTAL', m + 4, y + 7);
      pdf.text(`${analise.totalQtd} itens`, m + 87, y + 7, { align: 'center' });
      pdf.text(fmt(analise.receitaTotal), m + 125, y + 7, { align: 'right' });
      pdf.text(fmt(analise.custoTotal), m + 153, y + 7, { align: 'right' });
      pdf.text(fmt(analise.lucroTotal), m + 181, y + 7, { align: 'right' });
      pdf.text(`${analise.margemTotal.toFixed(1)}%`, W - m - 1, y + 7, { align: 'right' });

      // ── Draw footers on all pages ──
      const totalPages = pdf.internal.getNumberOfPages();
      for (let pg = 1; pg <= totalPages; pg++) {
        pdf.setPage(pg);
        drawFooter(pg);
      }

      const periodoLabel = `${format(parseISO(dataInicio), 'dd-MM-yyyy')}_a_${format(parseISO(dataFim), 'dd-MM-yyyy')}`;
      pdf.save(`relatorio-lucro-${periodoLabel}.pdf`);
      toast.success('PDF exportado com sucesso!');
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      toast.error('Erro ao gerar o PDF');
    }
  };

  /* ── chart configs ─────────────────────────────────────────── */
  const barChartData = useMemo(() => {
    if (!analise) return null;
    const top = analise.produtosRanked.slice(0, 10);
    return {
      labels: top.map(p => p.nome.length > 22 ? p.nome.substring(0, 22) + '…' : p.nome),
      datasets: [
        {
          label: 'Receita',
          data: top.map(p => p.receita),
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderColor: 'rgb(16, 185, 129)',
          borderWidth: 1, borderRadius: 6
        },
        {
          label: 'Custo',
          data: top.map(p => p.custo),
          backgroundColor: 'rgba(239, 68, 68, 0.5)',
          borderColor: 'rgb(239, 68, 68)',
          borderWidth: 1, borderRadius: 6
        }
      ]
    };
  }, [analise]);

  const doughnutData = useMemo(() => {
    if (!analise) return null;
    const top = analise.produtosRanked.slice(0, 8);
    const otherReceita = analise.produtosRanked.slice(8).reduce((s, p) => s + p.receita, 0);
    const labels = [...top.map(p => p.nome.length > 20 ? p.nome.substring(0, 20) + '…' : p.nome)];
    const data = [...top.map(p => p.receita)];
    if (otherReceita > 0) { labels.push('Outros'); data.push(otherReceita); }
    const colors = [
      '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6',
      '#EC4899', '#06B6D4', '#F97316', '#6B7280'
    ];
    return {
      labels,
      datasets: [{
        data, backgroundColor: colors.slice(0, data.length),
        borderWidth: 2, borderColor: '#fff', hoverOffset: 8
      }]
    };
  }, [analise]);

  const lineChartData = useMemo(() => {
    if (!analise || analise.dailyData.length === 0) return null;
    return {
      labels: analise.dailyData.map(d => d.label),
      datasets: [
        {
          label: 'Receita',
          data: analise.dailyData.map(d => d.receita),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          fill: true, tension: 0.4, pointRadius: 3,
          pointBackgroundColor: 'rgb(16, 185, 129)',
          borderWidth: 2.5
        },
        {
          label: 'Lucro',
          data: analise.dailyData.map(d => d.lucro),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          fill: true, tension: 0.4, pointRadius: 3,
          pointBackgroundColor: 'rgb(59, 130, 246)',
          borderWidth: 2, borderDash: [5, 3]
        }
      ]
    };
  }, [analise]);

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top', labels: { usePointStyle: true, padding: 16, font: { size: 11, weight: 'bold' } } },
      tooltip: {
        backgroundColor: '#1E293B', titleFont: { size: 12, weight: 'bold' }, bodyFont: { size: 11 },
        padding: 10, cornerRadius: 8,
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.raw)}` }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' }, maxRotation: 45 } },
      y: {
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: { font: { size: 10 }, callback: (v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v }
      }
    }
  };

  /* ── loading ───────────────────────────────────────────────── */
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-500 border-t-transparent" />
    </div>
  );

  const maxLucro = analise ? Math.max(...analise.produtosRanked.map(p => p.lucro), 1) : 1;

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-3 sm:p-6 font-sans pb-20">
      <div className="max-w-6xl mx-auto">

        {/* ── Header ───────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <BackButton to="/dashboard" />
            <div>
              <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <IoWalletOutline className="text-emerald-500" /> Relatório de Lucro
              </h1>
              <p className="text-xs text-gray-400 font-medium">Receita − Custo = Lucro real por produto</p>
            </div>
          </div>
          <div className="flex gap-2 self-start sm:self-auto no-print">
            <button onClick={handleExportPDF} disabled={!analise}
              className="bg-blue-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm">
              <IoPrintOutline size={16} /> Exportar PDF
            </button>
            <button onClick={handleExportCSV} disabled={!analise}
              className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm">
              <IoDownloadOutline size={16} /> CSV
            </button>
          </div>
        </div>

        {/* ── Period filter ─────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Quick period buttons */}
            <div className="flex flex-wrap gap-1.5">
              {[7, 15, 30, 60, 90].map(d => (
                <button key={d} onClick={() => selecionarPeriodo(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${periodoAtivo === d
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-600'}`}>
                  {d}d
                </button>
              ))}
            </div>

            <div className="hidden sm:block w-px h-8 bg-gray-200" />

            {/* Date range */}
            <div className="flex items-center gap-2 flex-wrap">
              <IoCalendarOutline className="text-gray-400 shrink-0" />
              <input type="date" value={dataInicio}
                onChange={e => handleDataChange('inicio', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 bg-gray-50 outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition-all" />
              <span className="text-xs text-gray-400 font-bold">até</span>
              <input type="date" value={dataFim}
                onChange={e => handleDataChange('fim', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-gray-700 bg-gray-50 outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition-all" />
            </div>
          </div>
        </div>

        {!analise ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
            <p className="text-gray-500 font-bold">Sem dados suficientes</p>
          </div>
        ) : (
          <>
            {/* ── KPI Cards ──────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-3 mb-6">
              <StatCard title="Receita" value={fmt(analise.receitaTotal)} icon={<IoBarChartOutline />} color="emerald"
                subtitle={`${analise.totalPedidos} pedidos`} />
              <StatCard title="Custo" value={fmt(analise.custoTotal)} icon={<IoLayersOutline />} color="red"
                subtitle={analise.custoTotal === 0 ? '⚠ Sem custos' : undefined} />
              <StatCard title="Lucro" value={fmt(analise.lucroTotal)} icon={<IoWalletOutline />}
                color={analise.lucroTotal >= 0 ? 'emerald' : 'red'} />
              <StatCard title="Margem" value={pct(analise.margemTotal)}
                icon={analise.margemTotal >= 30 ? <IoTrendingUpOutline /> : <IoTrendingDownOutline />}
                color={analise.margemTotal >= 30 ? 'blue' : analise.margemTotal >= 15 ? 'amber' : 'red'} />
              <StatCard title="Ticket Médio" value={fmt(analise.ticketMedio)} icon={<IoReceiptOutline />} color="purple"
                subtitle={`${analise.totalQtd} itens vendidos`} />
            </div>

            {/* ── Alert: missing cost (collapsible) ───── */}
            {analise.semCusto.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
                <button onClick={() => setAlertOpen(!alertOpen)}
                  className="w-full flex items-center justify-between text-left">
                  <p className="text-sm text-amber-800 font-bold flex items-center gap-2">
                    <IoAlertCircleOutline className="text-amber-500 text-lg shrink-0" />
                    {analise.semCusto.length} produtos sem custo cadastrado
                  </p>
                  {alertOpen ? <IoChevronUp className="text-amber-500" /> : <IoChevronDown className="text-amber-500" />}
                </button>
                {alertOpen && (
                  <div className="mt-3 max-h-48 overflow-y-auto">
                    <p className="text-xs text-amber-600 mb-2">Cadastre o custo no cardápio para um relatório mais preciso:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {analise.semCusto.map(p => (
                        <span key={p.nome} className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2.5 py-1 rounded-full">
                          {p.nome}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Charts Row ─────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              {/* Bar Chart - Top 10 */}
              {barChartData && (
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
                    <IoBarChartOutline className="text-emerald-500" /> Top 10 — Receita vs Custo
                  </h3>
                  <div className="h-72">
                    <Bar data={barChartData} options={{
                      ...chartOptions,
                      indexAxis: 'y',
                      scales: {
                        ...chartOptions.scales,
                        x: {
                          ...chartOptions.scales.x,
                          ticks: { ...chartOptions.scales.x.ticks, callback: (v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v }
                        },
                        y: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } }
                      }
                    }} />
                  </div>
                </div>
              )}

              {/* Doughnut */}
              {doughnutData && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
                    <IoStatsChartOutline className="text-blue-500" /> Distribuição de Receita
                  </h3>
                  <div className="h-72 flex items-center justify-center">
                    <Doughnut data={doughnutData} options={{
                      responsive: true, maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 10, font: { size: 9, weight: '600' } } },
                        tooltip: {
                          backgroundColor: '#1E293B', cornerRadius: 8,
                          callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.raw)} (${analise.receitaTotal > 0 ? ((ctx.raw / analise.receitaTotal) * 100).toFixed(1) : 0}%)` }
                        }
                      }, cutout: '60%'
                    }} />
                  </div>
                </div>
              )}
            </div>

            {/* ── Daily Trend Line ────────────────────── */}
            {lineChartData && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
                <h3 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
                  <IoTrendingUpOutline className="text-emerald-500" /> Evolução Diária — {format(parseISO(dataInicio), 'dd/MM')} a {format(parseISO(dataFim), 'dd/MM')}
                </h3>
                <div className="h-64">
                  <Line data={lineChartData} options={chartOptions} />
                </div>
              </div>
            )}

            {/* ── Product Table ───────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                  💰 Lucro por produto
                  <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full">
                    {analise.totalPedidos} pedidos
                  </span>
                  <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2.5 py-1 rounded-full">
                    {analise.produtosRanked.length} produtos
                  </span>
                </h3>
                <div className="relative w-full sm:w-64">
                  <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Buscar produto..."
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs font-medium bg-white shadow-sm outline-none focus:ring-2 focus:ring-emerald-500/50" />
                </div>
              </div>

              {/* Table header — clickable sort */}
              <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 rounded-xl mb-2 select-none">
                <span className="col-span-1 text-[10px] font-black text-gray-400 uppercase">#</span>
                <button onClick={() => handleSort('nome')} className="col-span-4 text-[10px] font-black text-gray-400 uppercase text-left flex items-center gap-1 hover:text-emerald-600 transition-colors cursor-pointer">
                  Produto <SortIcon col="nome" />
                </button>
                <button onClick={() => handleSort('qtd')} className="col-span-1 text-[10px] font-black text-gray-400 uppercase text-center flex items-center justify-center gap-1 hover:text-emerald-600 transition-colors cursor-pointer">
                  Qtd <SortIcon col="qtd" />
                </button>
                <button onClick={() => handleSort('receita')} className="col-span-2 text-[10px] font-black text-gray-400 uppercase text-right flex items-center justify-end gap-1 hover:text-emerald-600 transition-colors cursor-pointer">
                  Receita <SortIcon col="receita" />
                </button>
                <button onClick={() => handleSort('custo')} className="col-span-1 text-[10px] font-black text-gray-400 uppercase text-right flex items-center justify-end gap-1 hover:text-emerald-600 transition-colors cursor-pointer">
                  Custo <SortIcon col="custo" />
                </button>
                <button onClick={() => handleSort('lucro')} className="col-span-2 text-[10px] font-black text-gray-400 uppercase text-right flex items-center justify-end gap-1 hover:text-emerald-600 transition-colors cursor-pointer">
                  Lucro <SortIcon col="lucro" />
                </button>
                <button onClick={() => handleSort('margem')} className="col-span-1 text-[10px] font-black text-gray-400 uppercase text-right flex items-center justify-end gap-1 hover:text-emerald-600 transition-colors cursor-pointer">
                  Margem <SortIcon col="margem" />
                </button>
              </div>

              <div className="space-y-0.5">
                {produtosFiltrados.map((p, i) => {
                  const globalIdx = analise.produtosRanked.indexOf(p);
                  const rankColors = [
                    'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-300',
                    'bg-gray-200 text-gray-700 ring-2 ring-gray-300',
                    'bg-orange-100 text-orange-700 ring-2 ring-orange-300'
                  ];
                  const barWidth = maxLucro > 0 ? Math.max(0, (p.lucro / maxLucro) * 100) : 0;

                  return (
                    <div key={p.nome}
                      className="grid grid-cols-12 gap-2 items-center px-3 py-3 rounded-xl hover:bg-emerald-50/50 transition-colors border-b border-gray-50 last:border-0">
                      {/* Rank */}
                      <div className="col-span-1">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold ${rankColors[globalIdx] || 'bg-gray-100 text-gray-500'}`}>
                          {globalIdx + 1}
                        </span>
                      </div>
                      {/* Product name */}
                      <div className="col-span-4 sm:col-span-4 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate" title={p.nome}>{p.nome}</p>
                        <div className="sm:hidden text-[10px] text-gray-400">{p.qtd}x • Custo: {fmt(p.custo)}</div>
                      </div>
                      {/* Qty */}
                      <div className="hidden sm:flex col-span-1 justify-center">
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[10px] font-bold">{p.qtd}</span>
                      </div>
                      {/* Receita */}
                      <div className="col-span-2 hidden sm:block text-right">
                        <p className="text-xs font-bold text-gray-600">{fmt(p.receita)}</p>
                      </div>
                      {/* Custo */}
                      <div className="col-span-1 hidden sm:block text-right">
                        <p className={`text-xs font-bold ${p.custo > 0 ? 'text-red-500' : 'text-gray-300'}`}>{fmt(p.custo)}</p>
                      </div>
                      {/* Lucro + bar */}
                      <div className="col-span-5 sm:col-span-2">
                        <p className={`text-sm font-black text-right ${p.lucro >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {fmt(p.lucro)}
                        </p>
                        <div className="w-full bg-gray-100 rounded-full h-1 mt-1">
                          <div className={`h-1 rounded-full transition-all ${p.lucro >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                            style={{ width: `${Math.min(barWidth, 100)}%` }} />
                        </div>
                      </div>
                      {/* Margin */}
                      <div className="col-span-2 sm:col-span-1 text-right">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          p.margem >= 50 ? 'bg-emerald-100 text-emerald-700' :
                          p.margem >= 30 ? 'bg-green-100 text-green-700' :
                          p.margem >= 15 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-600'
                        }`}>
                          {p.margem.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}

                {produtosFiltrados.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-8">
                    Nenhum produto encontrado para "{searchTerm}"
                  </p>
                )}
              </div>

              {/* Show all toggle */}
              {analise.produtosRanked.length > 20 && !searchTerm && (
                <button onClick={() => setShowAll(!showAll)}
                  className="w-full mt-4 py-3 text-center text-xs font-bold text-emerald-600 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-all flex items-center justify-center gap-2">
                  {showAll ? <><IoEyeOffOutline /> Mostrar apenas Top 20</> : <><IoEyeOutline /> Ver todos os {analise.produtosRanked.length} produtos</>}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default withEstablishmentAuth(RelatorioLucro);
