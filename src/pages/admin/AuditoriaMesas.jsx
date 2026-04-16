import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import BackButton from '../../components/BackButton';
import { subDays, format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  IoSearchOutline, IoChevronDownOutline, IoChevronUpOutline,
  IoPersonOutline, IoRestaurantOutline, IoTimeOutline,
  IoCardOutline, IoAlertCircleOutline, IoDownloadOutline,
  IoFunnelOutline, IoShieldCheckmarkOutline, IoStorefrontOutline
} from 'react-icons/io5';
import jsPDF from 'jspdf';

function AuditoriaMesas() {
  const { userData, currentUser } = useAuth();
  const isMaster = currentUser?.isMasterAdmin === true;
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  // Filtros
  const [dataInicio, setDataInicio] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filtroGarcom, setFiltroGarcom] = useState('');
  const [filtroMesa, setFiltroMesa] = useState('');
  const [busca, setBusca] = useState('');

  // Master: filtro por estabelecimento
  const [estabelecimentos, setEstabelecimentos] = useState([]);
  const [filtroEstab, setFiltroEstab] = useState('');

  const estabIdDefault = userData?.estabelecimentosGerenciados?.[0];

  // Busca lista de estabelecimentos se for master
  useEffect(() => {
    if (!isMaster) return;
    const fetchEstabs = async () => {
      try {
        const snap = await getDocs(collection(db, 'estabelecimentos'));
        const lista = snap.docs.map(d => ({ id: d.id, nome: d.data().nomeEstabelecimento || d.data().nome || d.id }));
        lista.sort((a, b) => a.nome.localeCompare(b.nome));
        setEstabelecimentos(lista);
      } catch (e) {
        console.error('Erro ao buscar estabelecimentos:', e);
      }
    };
    fetchEstabs();
  }, [isMaster]);

  // O estabId ativo: para master usa o filtro, para admin usa o padrão
  const estabId = isMaster ? filtroEstab : estabIdDefault;

  useEffect(() => {
    // Se for master e não selecionou, não busca (evita trazer tudo)
    if (isMaster && !filtroEstab) {
      setVendas([]);
      setLoading(false);
      return;
    }
    if (!estabId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const inicio = startOfDay(new Date(dataInicio + 'T00:00:00'));
        const fim = endOfDay(new Date(dataFim + 'T23:59:59'));

        // Busca vendas (fechamentos de mesa)
        const vendasSnap = await getDocs(collection(db, 'vendas'));
        const lista = vendasSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(v => {
          if (v.estabelecimentoId !== estabId) return false;
          const dt = v.criadoEm?.toDate?.() || v.createdAt?.toDate?.() ||
            (v.criadoEm?.seconds ? new Date(v.criadoEm.seconds * 1000) : null) ||
            (v.createdAt?.seconds ? new Date(v.createdAt.seconds * 1000) : null);
          return dt && dt >= inicio && dt <= fim;
        });

        // Ordena mais recente primeiro
        lista.sort((a, b) => {
          const dtA = a.criadoEm?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
          const dtB = b.criadoEm?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
          return dtB - dtA;
        });

        setVendas(lista);
      } catch (e) {
        console.error('Erro ao buscar auditoria:', e);
      }
      setLoading(false);
    };
    fetchData();
  }, [estabId, dataInicio, dataFim, isMaster, filtroEstab]);

  // Helpers
  const getDate = (v) => {
    return v.criadoEm?.toDate?.() || v.createdAt?.toDate?.() ||
      (v.criadoEm?.seconds ? new Date(v.criadoEm.seconds * 1000) : null) ||
      (v.createdAt?.seconds ? new Date(v.createdAt.seconds * 1000) : null);
  };

  const getGarcom = (v) => {
    // Busca no pedido
    if (v.funcionario && v.funcionario !== 'Garçom') return v.funcionario;
    if (v.responsavel) return v.responsavel;
    // Busca dentro dos itens
    const itens = v.itens || [];
    const itemComGarcom = itens.find(i => i.adicionadoPorNome || i.adicionadoPor);
    if (itemComGarcom) return itemComGarcom.adicionadoPorNome || itemComGarcom.adicionadoPor;
    return v.funcionario || 'Não identificado';
  };

  const getFormaPagamento = (v) => {
    if (v.tipoPagamento || v.metodoPagamento) return v.tipoPagamento || v.metodoPagamento;
    // Busca nas formas individuais
    const pagamentos = v.pagamentos || {};
    const formas = Object.values(pagamentos).map(p => p.formaPagamento).filter(Boolean);
    if (formas.length > 0) return [...new Set(formas)].join(', ');
    return 'N/I';
  };

  const getItensCancelados = (v) => {
    const itens = v.itens || [];
    return itens.filter(i => i.status === 'cancelado');
  };

  // Lista de garçons únicos para filtro
  const garconsUnicos = useMemo(() => {
    const set = new Set(vendas.map(v => getGarcom(v)));
    return [...set].sort();
  }, [vendas]);

  // Lista de mesas únicas para filtro
  const mesasUnicas = useMemo(() => {
    const set = new Set(vendas.map(v => v.mesaNumero).filter(Boolean));
    return [...set].sort((a, b) => {
      // Tenta ordenar pelo número se houver
      const numA = String(a).match(/\d+/);
      const numB = String(b).match(/\d+/);
      if (numA && numB) return Number(numA[0]) - Number(numB[0]);
      return String(a).localeCompare(String(b));
    });
  }, [vendas]);

  // Formata a exibição do identificador
  const formatMesaId = (id) => {
    if (!id && id !== 0) return '?';
    const s = String(id).trim();
    if (!isNaN(s)) return s;
    
    const m = s.match(/^(?:mesa|pulseira|comanda)\s*-?\s*(\d+)$/i);
    if (m) return m[1];
    
    // Se for nome, pega o primeiro
    const parts = s.split(' ');
    if (parts.length > 1 && parts[0].length > 1) {
      return parts[0].substring(0, 10);
    }
    return s.substring(0, 10);
  };

  // Vendas filtradas
  const vendasFiltradas = useMemo(() => {
    return vendas.filter(v => {
      if (filtroGarcom && getGarcom(v) !== filtroGarcom) return false;
      if (filtroMesa && String(v.mesaNumero) !== filtroMesa) return false;
      if (busca) {
        const termo = busca.toLowerCase();
        const garcom = getGarcom(v).toLowerCase();
        const mesa = String(v.mesaNumero || '').toLowerCase();
        if (!garcom.includes(termo) && !mesa.includes(termo)) return false;
      }
      return true;
    });
  }, [vendas, filtroGarcom, filtroMesa, busca]);

  // Stats
  const stats = useMemo(() => {
    const total = vendasFiltradas.reduce((s, v) => s + (Number(v.total || v.totalFinal) || 0), 0);
    const cancelamentos = vendasFiltradas.reduce((s, v) => s + getItensCancelados(v).length, 0);
    const garconsSet = new Set(vendasFiltradas.map(v => getGarcom(v)));

    // Resumo por forma de pagamento
    const porFormaPgto = {};
    vendasFiltradas.forEach(v => {
      const valor = Number(v.total || v.totalFinal) || 0;
      const forma = getFormaPagamento(v).toUpperCase().trim();
      // Se foi pagamento dividido (múltiplas formas), tenta separar
      if (forma.includes(',')) {
        const formas = forma.split(',').map(f => f.trim());
        // Distribui igualmente quando não sabemos a proporção exata
        const parteValor = valor / formas.length;
        formas.forEach(f => {
          if (!porFormaPgto[f]) porFormaPgto[f] = { total: 0, qtd: 0 };
          porFormaPgto[f].total += parteValor;
          porFormaPgto[f].qtd += 1;
        });
      } else {
        if (!porFormaPgto[forma]) porFormaPgto[forma] = { total: 0, qtd: 0 };
        porFormaPgto[forma].total += valor;
        porFormaPgto[forma].qtd += 1;
      }
    });

    return {
      totalVendas: vendasFiltradas.length,
      totalFaturamento: total,
      totalCancelamentos: cancelamentos,
      totalGarcons: garconsSet.size,
      porFormaPgto,
    };
  }, [vendasFiltradas]);

  // Exportar PDF
  const handleExportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); // paisagem
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = 14;
    let y = 14;

    // Header
    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('AUDITORIA DE MESAS', marginX, 12);
    doc.setFontSize(9);
    doc.text(`Período: ${format(new Date(dataInicio), 'dd/MM/yyyy')} a ${format(new Date(dataFim), 'dd/MM/yyyy')}`, marginX, 19);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, marginX, 24);

    // Stats
    y = 36;
    doc.setTextColor(30, 58, 138);
    doc.setFontSize(10);
    doc.text(`Total Fechamentos: ${stats.totalVendas}`, marginX, y);
    doc.text(`Faturamento: R$ ${stats.totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, marginX + 70, y);
    doc.text(`Cancelamentos: ${stats.totalCancelamentos} itens`, marginX + 160, y);
    doc.text(`Garçons Ativos: ${stats.totalGarcons}`, marginX + 230, y);

    // Tabela
    y = 46;
    const cols = [
      { label: 'DATA/HORA', w: 38 },
      { label: 'MESA', w: 16 },
      { label: 'GARÇOM / OPERADOR', w: 50 },
      { label: 'VALOR', w: 28 },
      { label: 'PAGAMENTO', w: 28 },
      { label: 'STATUS', w: 24 },
      { label: 'ITENS', w: 14 },
      { label: 'CANCEL.', w: 16 },
      { label: 'DESCONTO', w: 28 },
      { label: 'TAXA SERV.', w: 28 },
    ];

    // Header tabela
    doc.setFillColor(241, 245, 249);
    doc.rect(marginX, y, pageW - marginX * 2, 8, 'F');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    let xPos = marginX + 2;
    cols.forEach(col => {
      doc.text(col.label, xPos, y + 5.5);
      xPos += col.w;
    });

    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);

    vendasFiltradas.forEach((v, idx) => {
      if (y > pageH - 16) {
        doc.addPage();
        y = 14;
        // Re-header
        doc.setFillColor(241, 245, 249);
        doc.rect(marginX, y, pageW - marginX * 2, 8, 'F');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'bold');
        let xP = marginX + 2;
        cols.forEach(col => { doc.text(col.label, xP, y + 5.5); xP += col.w; });
        y += 10;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
      }

      const dt = getDate(v);
      const cancelados = getItensCancelados(v);
      const itensAtivos = (v.itens || []).filter(i => i.status !== 'cancelado');

      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, y - 3, pageW - marginX * 2, 7, 'F');
      }

      doc.setFontSize(7.5);
      xPos = marginX + 2;

      // Data
      doc.text(dt ? format(dt, "dd/MM/yy HH:mm") : '—', xPos, y + 1);
      xPos += cols[0].w;
      // Mesa
      doc.setFont('helvetica', 'bold');
      doc.text(String(v.mesaNumero || '—'), xPos, y + 1);
      doc.setFont('helvetica', 'normal');
      xPos += cols[1].w;
      // Garçom
      doc.text(getGarcom(v).substring(0, 26), xPos, y + 1);
      xPos += cols[2].w;
      // Valor
      doc.setFont('helvetica', 'bold');
      doc.text(`R$ ${(Number(v.total || v.totalFinal) || 0).toFixed(2)}`, xPos, y + 1);
      doc.setFont('helvetica', 'normal');
      xPos += cols[3].w;
      // Pagamento
      doc.text(getFormaPagamento(v).substring(0, 14), xPos, y + 1);
      xPos += cols[4].w;
      // Status
      const statusText = v.status === 'pago' ? 'Quitado' : v.status === 'pago_parcial' ? 'Parcial' : v.status || '—';
      doc.text(statusText, xPos, y + 1);
      xPos += cols[5].w;
      // Itens
      doc.text(String(itensAtivos.length), xPos, y + 1);
      xPos += cols[6].w;
      // Cancelamentos
      if (cancelados.length > 0) {
        doc.setTextColor(220, 38, 38);
        doc.text(String(cancelados.length), xPos, y + 1);
        doc.setTextColor(30, 41, 59);
      } else {
        doc.text('0', xPos, y + 1);
      }
      xPos += cols[7].w;
      // Desconto
      doc.text(v.valorDesconto > 0 ? `R$ ${Number(v.valorDesconto).toFixed(2)}` : '—', xPos, y + 1);
      xPos += cols[8].w;
      // Taxa
      doc.text(v.taxaServicoCobrada > 0 ? `R$ ${Number(v.taxaServicoCobrada).toFixed(2)}` : '—', xPos, y + 1);

      y += 7;
    });

    // Rodapé
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('IdeaFood — Auditoria de Mesas — Documento confidencial', marginX, pageH - 6);

    const nomeArquivo = `auditoria_mesas_${dataInicio}_a_${dataFim}.pdf`;
    doc.save(nomeArquivo);
  };

  // Exportar CSV
  const handleExportCSV = () => {
    const header = 'Data/Hora,Mesa,Garçom,Valor,Pagamento,Status,Itens,Cancelamentos,Desconto,Taxa Serviço';
    const rows = vendasFiltradas.map(v => {
      const dt = getDate(v);
      return [
        dt ? format(dt, "dd/MM/yyyy HH:mm") : '',
        v.mesaNumero || '',
        `"${getGarcom(v)}"`,
        (Number(v.total || v.totalFinal) || 0).toFixed(2),
        `"${getFormaPagamento(v)}"`,
        v.status || '',
        (v.itens || []).filter(i => i.status !== 'cancelado').length,
        getItensCancelados(v).length,
        (Number(v.valorDesconto) || 0).toFixed(2),
        (Number(v.taxaServicoCobrada) || 0).toFixed(2),
      ].join(',');
    });
    const csv = '\uFEFF' + header + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria_mesas_${dataInicio}_a_${dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-6 font-sans pb-20">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <BackButton to="/dashboard" />
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <IoShieldCheckmarkOutline className="text-blue-600" /> Auditoria de Mesas
              </h1>
              <p className="text-xs text-gray-400 font-medium">Controle de quem fechou, valores e cancelamentos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportCSV}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-1.5 shadow-sm">
              <IoDownloadOutline /> CSV
            </button>
            <button onClick={handleExportPDF}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5 shadow-sm shadow-blue-200">
              <IoDownloadOutline /> PDF
            </button>
          </div>
        </div>

        {/* FILTROS */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-6">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            <IoFunnelOutline /> Filtros
          </div>

          {/* Filtro de estabelecimento (somente master) */}
          {isMaster && (
            <div className="mb-4 pb-4 border-b border-gray-100">
              <label className="text-[10px] font-bold text-indigo-600 uppercase block mb-1 flex items-center gap-1">
                <IoStorefrontOutline /> Estabelecimento
              </label>
              <select value={filtroEstab} onChange={e => setFiltroEstab(e.target.value)}
                className="w-full sm:w-80 px-3 py-2.5 bg-indigo-50 border-2 border-indigo-200 rounded-xl text-sm font-bold text-indigo-700 outline-none">
                <option value="">⚡ Selecione um estabelecimento...</option>
                {estabelecimentos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Data Início</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Data Fim</label>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Garçom</label>
              <select value={filtroGarcom} onChange={e => setFiltroGarcom(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none">
                <option value="">Todos</option>
                {garconsUnicos.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Mesa</label>
              <select value={filtroMesa} onChange={e => setFiltroMesa(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none">
                <option value="">Todas</option>
                {mesasUnicas.map(m => <option key={m} value={String(m)}>Mesa {m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Busca</label>
              <div className="relative">
                <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input type="text" placeholder="Nome, mesa..." value={busca} onChange={e => setBusca(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none" />
              </div>
            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-2xl p-4 border-l-4 border-l-blue-500 border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Fechamentos</p>
            <p className="text-2xl font-black text-blue-600">{stats.totalVendas}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border-l-4 border-l-emerald-500 border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Faturamento</p>
            <p className="text-2xl font-black text-emerald-600">R$ {stats.totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border-l-4 border-l-red-500 border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Itens Cancelados</p>
            <p className="text-2xl font-black text-red-600">{stats.totalCancelamentos}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border-l-4 border-l-amber-500 border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Operadores</p>
            <p className="text-2xl font-black text-amber-600">{stats.totalGarcons}</p>
          </div>
        </div>

        {/* RESUMO POR FORMA DE PAGAMENTO */}
        {Object.keys(stats.porFormaPgto).length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-6">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <IoCardOutline className="text-indigo-500" /> Fechamento por Forma de Pagamento
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {Object.entries(stats.porFormaPgto)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([forma, dados]) => {
                  const corMap = {
                    'DINHEIRO': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: '💵' },
                    'PIX': { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', icon: '⚡' },
                    'DEBITO': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: '💳' },
                    'DÉBITO': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: '💳' },
                    'CREDITO': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: '💳' },
                    'CRÉDITO': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: '💳' },
                    'CARTAO': { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', icon: '💳' },
                    'CARTÃO': { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', icon: '💳' },
                  };
                  const cor = corMap[forma] || { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', icon: '🧾' };
                  
                  return (
                    <div key={forma} className={`${cor.bg} ${cor.border} border rounded-xl p-3 hover:shadow-md transition-all`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-500 flex items-center gap-1">
                          {cor.icon} {forma || 'N/I'}
                        </span>
                        <span className="text-[9px] font-bold text-gray-400 bg-white px-1.5 py-0.5 rounded-full">
                          {dados.qtd}x
                        </span>
                      </div>
                      <p className={`text-lg font-black ${cor.text}`}>
                        R$ {dados.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
        {/* TABELA / LISTA */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-50 bg-gray-50/50">
            <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
              <IoRestaurantOutline className="text-blue-600" />
              Registro de Fechamentos ({vendasFiltradas.length})
            </h3>
          </div>

          {isMaster && !filtroEstab ? (
            <div className="p-16 text-center">
              <IoStorefrontOutline className="text-5xl text-indigo-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-indigo-500">Selecione um estabelecimento</p>
              <p className="text-xs text-gray-400">Escolha a loja acima para ver a auditoria de mesas</p>
            </div>
          ) : loading ? (
            <div className="p-16 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
              <p className="text-sm text-gray-400 font-medium">Carregando auditoria...</p>
            </div>
          ) : vendasFiltradas.length === 0 ? (
            <div className="p-16 text-center">
              <IoShieldCheckmarkOutline className="text-5xl text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-500">Nenhum fechamento no período</p>
              <p className="text-xs text-gray-400">Ajuste os filtros para encontrar registros</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {vendasFiltradas.map(v => {
                const dt = getDate(v);
                const garcom = getGarcom(v);
                const cancelados = getItensCancelados(v);
                const itensAtivos = (v.itens || []).filter(i => i.status !== 'cancelado');
                const isExpanded = expandedId === v.id;
                const formaPgto = getFormaPagamento(v);
                const valor = Number(v.total || v.totalFinal) || 0;

                return (
                  <div key={v.id} className={`transition-colors ${cancelados.length > 0 ? 'bg-red-50/30' : ''}`}>
                    {/* Linha principal */}
                    <div
                      className="flex flex-wrap items-center gap-3 sm:gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50/50"
                      onClick={() => setExpandedId(isExpanded ? null : v.id)}
                    >
                      {/* Data */}
                      <div className="w-[110px] shrink-0">
                        <p className="text-xs font-bold text-gray-800">
                          {dt ? format(dt, "dd/MM/yy", { locale: ptBR }) : '—'}
                        </p>
                        <p className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                          <IoTimeOutline /> {dt ? format(dt, "HH:mm") : '—'}
                        </p>
                      </div>

                      {/* Mesa/Identificador */}
                      <div className="w-[70px] shrink-0">
                        <span className="inline-flex flex-col items-center justify-center min-w-[2.5rem] px-2 h-10 w-fit bg-blue-50 text-blue-700 rounded-xl text-sm font-black border border-blue-100 uppercase overflow-hidden text-ellipsis whitespace-nowrap">
                          {formatMesaId(v.mesaNumero)}
                        </span>
                      </div>

                      {/* Garçom */}
                      <div className="flex-1 min-w-[120px]">
                        <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                          <IoPersonOutline className="text-gray-400 shrink-0" />
                          {garcom}
                        </p>
                        <p className="text-[10px] text-gray-400 font-medium">
                          {itensAtivos.length} {itensAtivos.length === 1 ? 'item' : 'itens'}
                          {cancelados.length > 0 && (
                            <span className="text-red-500 font-bold ml-2">
                              ⚠ {cancelados.length} cancelado(s)
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Pagamento */}
                      <div className="w-[90px] shrink-0 hidden sm:block">
                        <span className="text-[10px] font-bold text-gray-500 uppercase bg-gray-100 px-2 py-1 rounded-lg">
                          {formaPgto.substring(0, 12)}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="w-[80px] shrink-0 hidden md:block">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${v.status === 'pago' ? 'bg-emerald-50 text-emerald-700' :
                            v.status === 'pago_parcial' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                          {v.status === 'pago' ? '✅ Quitado' : v.status === 'pago_parcial' ? '⏳ Parcial' : v.status || '—'}
                        </span>
                      </div>

                      {/* Valor */}
                      <div className="w-[100px] shrink-0 text-right">
                        <p className="text-sm font-black text-gray-900">
                          R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        {(v.valorDesconto > 0 || v.taxaServicoCobrada > 0) && (
                          <p className="text-[10px] text-gray-400">
                            {v.valorDesconto > 0 && <span className="text-red-500">-R${Number(v.valorDesconto).toFixed(0)} </span>}
                            {v.taxaServicoCobrada > 0 && <span className="text-emerald-500">+10%</span>}
                          </p>
                        )}
                      </div>

                      {/* Expandir */}
                      <div className="w-[24px] shrink-0">
                        {isExpanded ? <IoChevronUpOutline className="text-blue-500" /> : <IoChevronDownOutline className="text-gray-400" />}
                      </div>
                    </div>

                    {/* Detalhes expandidos */}
                    {isExpanded && (
                      <div className="px-4 pb-4 bg-blue-50/30 border-t border-blue-100/50 animate-fadeIn">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                          {/* Itens consumidos */}
                          <div className="bg-white rounded-xl p-3 border border-gray-100">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                              <IoRestaurantOutline /> Itens do Pedido ({itensAtivos.length})
                            </p>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {itensAtivos.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">Nenhum item</p>
                              ) : itensAtivos.map((item, i) => (
                                <div key={i} className="flex justify-between items-center text-xs py-1 border-b border-gray-50 last:border-0">
                                  <div>
                                    <span className="font-bold text-gray-700">{item.quantidade || item.qtd || 1}x</span>
                                    <span className="ml-1.5 text-gray-600">{item.nome}</span>
                                    {(item.adicionadoPor || item.adicionadoPorNome) && (
                                      <span className="ml-2 text-[10px] text-blue-500 font-medium">
                                        por {item.adicionadoPorNome || item.adicionadoPor}
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-bold text-gray-800">
                                    R$ {((item.preco || 0) * (item.quantidade || item.qtd || 1)).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Cancelamentos + Info */}
                          <div className="space-y-3">
                            {cancelados.length > 0 && (
                              <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                                <p className="text-[10px] font-black text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                                  <IoAlertCircleOutline /> Itens Cancelados ({cancelados.length})
                                </p>
                                <div className="space-y-1">
                                  {cancelados.map((item, i) => (
                                    <div key={i} className="flex justify-between items-center text-xs py-1">
                                      <span className="text-red-700 line-through">
                                        {item.quantidade || 1}x {item.nome}
                                      </span>
                                      <span className="text-red-600 font-bold">
                                        R$ {((item.preco || 0) * (item.quantidade || 1)).toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="bg-white rounded-xl p-3 border border-gray-100">
                              <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2">
                                Detalhes do Fechamento
                              </p>
                              <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Valor Original:</span>
                                  <span className="font-bold">R$ {(Number(v.valorOriginal || v.total) || 0).toFixed(2)}</span>
                                </div>
                                {v.taxaServicoCobrada > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Taxa de Serviço (10%):</span>
                                    <span className="font-bold text-emerald-600">+ R$ {Number(v.taxaServicoCobrada).toFixed(2)}</span>
                                  </div>
                                )}
                                {v.valorDesconto > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Desconto:</span>
                                    <span className="font-bold text-red-600">- R$ {Number(v.valorDesconto).toFixed(2)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between border-t border-gray-100 pt-1.5">
                                  <span className="text-gray-500">Forma de Pagamento:</span>
                                  <span className="font-bold uppercase">{formaPgto}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Operador/Garçom:</span>
                                  <span className="font-bold text-blue-600">{garcom}</span>
                                </div>
                                {v.criadoPor && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">UID Operador:</span>
                                    <span className="font-mono text-[10px] text-gray-400">{v.criadoPor}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default AuditoriaMesas;
