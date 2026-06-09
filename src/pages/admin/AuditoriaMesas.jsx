import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import BackButton from '../../components/BackButton';
import { subDays, format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  FiArrowLeft, FiSearch, FiChevronDown, FiChevronUp,
  FiUser, FiCoffee, FiClock, FiCreditCard, FiAlertCircle,
  FiDownload, FiFilter, FiShield, FiHome, FiSun, FiMoon
} from 'react-icons/fi';
import jsPDF from 'jspdf';
import { getTerminology } from '../../utils/terminologyUtils';

const SkeletonRow = ({ isDark }) => (
  <div className={`p-4 rounded-2xl border animate-pulse flex flex-col sm:flex-row gap-4 justify-between items-center ${isDark ? 'bg-slate-900/40 border-slate-800/80 shadow-md' : 'bg-white/70 border-slate-200/60 shadow-sm'}`}>
    <div className="flex items-center gap-4 w-full sm:w-auto">
      <div className={`w-16 h-8 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
      <div className={`w-10 h-10 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
      <div className="space-y-2">
        <div className={`h-4 rounded-lg w-32 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
        <div className={`h-3 rounded-lg w-20 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
      </div>
    </div>
    <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
      <div className={`h-6 rounded-lg w-16 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
      <div className={`h-6 rounded-lg w-20 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
      <div className={`w-6 h-6 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    </div>
  </div>
);

function AuditoriaMesas() {
  const navigate = useNavigate();
  const { currentUser, estabelecimentoIdPrincipal } = useAuth();
  const isMaster = currentUser?.isMasterAdmin === true;
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [tipoNegocio, setTipoNegocio] = useState('restaurante');

  // Filtros
  const [dataInicio, setDataInicio] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filtroGarcom, setFiltroGarcom] = useState('');
  const [filtroMesa, setFiltroMesa] = useState('');
  const [busca, setBusca] = useState('');

  // Master: filtro por estabelecimento
  const [estabelecimentos, setEstabelecimentos] = useState([]);
  const [filtroEstab, setFiltroEstab] = useState('');

  const estabIdDefault = estabelecimentoIdPrincipal;

  // Sync theme with localStorage
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('dashboard_theme');
    return saved || 'dark';
  });

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('dashboard_theme', newTheme);
  };

  const backPath = isMaster ? '/master-dashboard' : '/dashboard';

  // Busca lista de estabelecimentos se for master
  useEffect(() => {
    if (!isMaster) return;
    const fetchEstabs = async () => {
      try {
        const snap = await getDocs(collection(db, 'estabelecimentos'));
        const lista = snap.docs.map(d => ({ 
          id: d.id, 
          nome: d.data().nomeEstabelecimento || d.data().nome || d.id,
          tipoNegocio: d.data().tipoNegocio || 'restaurante'
        }));
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

  // Sincroniza o tipo de negócio do estabelecimento ativo
  useEffect(() => {
    if (!estabId) return;
    
    // Se for master e já temos a lista carregada, podemos pegar dela
    if (isMaster && estabelecimentos.length > 0) {
      const active = estabelecimentos.find(e => e.id === estabId);
      if (active) {
        setTipoNegocio(active.tipoNegocio || 'restaurante');
        return;
      }
    }
    
    // Caso contrário (ou se for admin normal), busca o documento do Firestore
    const fetchTipoNegocio = async () => {
      try {
        const docRef = doc(db, 'estabelecimentos', estabId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().tipoNegocio) {
          setTipoNegocio(docSnap.data().tipoNegocio);
        } else {
          setTipoNegocio('restaurante');
        }
      } catch (e) {
        console.error('Erro ao buscar tipo de negócio:', e);
      }
    };
    fetchTipoNegocio();
  }, [estabId, estabelecimentos, isMaster]);

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

  // SEO Page Title
  useEffect(() => {
    document.title = `IdeaFood - Auditoria de ${getTerminology('mesas', tipoNegocio)}`;
  }, [tipoNegocio]);

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
    doc.text(`AUDITORIA DE ${getTerminology('mesas', tipoNegocio).toUpperCase()}`, marginX, 12);
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
      { label: getTerminology('mesa', tipoNegocio).toUpperCase(), w: 16 },
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
    doc.text(`IdeaFood — Auditoria de ${getTerminology('mesas', tipoNegocio)} — Documento confidencial`, marginX, pageH - 6);

    const nomeArquivo = `auditoria_${getTerminology('mesas', tipoNegocio).toLowerCase()}_${dataInicio}_a_${dataFim}.pdf`;
    doc.save(nomeArquivo);
  };

  // Exportar CSV
  const handleExportCSV = () => {
    const header = `Data/Hora,${getTerminology('mesa', tipoNegocio)},${getTerminology('garcom', tipoNegocio)},Valor,Pagamento,Status,Itens,Cancelamentos,Desconto,Taxa Serviço`;
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
    a.download = `auditoria_${getTerminology('mesas', tipoNegocio).toLowerCase()}_${dataInicio}_a_${dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const themeClasses = {
    dark: {
      bg: 'bg-gradient-to-br from-slate-950 via-[#0d1220] to-slate-950',
      surface: 'bg-slate-900/60 backdrop-blur-xl',
      surfaceHover: 'hover:bg-slate-800/80 hover:shadow-[0_8px_32px_rgba(99,102,241,0.06)] hover:scale-[1.01] hover:border-slate-700/50',
      border: 'border-slate-800/80',
      text: 'text-slate-100',
      textSecondary: 'text-slate-400',
      textMuted: 'text-slate-500',
      accent: 'bg-blue-600',
      accentHover: 'hover:bg-blue-700',
      gradient: 'from-blue-500 to-indigo-600',
      cardBg: 'bg-slate-900/40 backdrop-blur-xl',
      inputBg: 'bg-slate-950/60',
    },
    light: {
      bg: 'bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#f8fafc]',
      surface: 'bg-white/80 backdrop-blur-md',
      surfaceHover: 'hover:bg-white hover:shadow-[0_8px_30px_rgba(99,102,241,0.02)] hover:scale-[1.01] hover:border-slate-300/50',
      border: 'border-slate-200/60',
      text: 'text-slate-900',
      textSecondary: 'text-slate-650',
      textMuted: 'text-slate-400',
      accent: 'bg-blue-500',
      accentHover: 'hover:bg-blue-600',
      gradient: 'from-blue-550 to-purple-650',
      cardBg: 'bg-white/70 backdrop-blur-md',
      inputBg: 'bg-slate-100/50',
    }
  };

  const t = themeClasses[theme];
  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen ${t.bg} transition-colors duration-500 relative overflow-hidden pb-24 pt-6 px-4 sm:px-8`}>
      {/* Glow effects */}
      <div className="absolute top-[-10%] left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-[#6366f1]/10 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-[#3b82f6]/8 to-transparent blur-[120px] pointer-events-none" />

      <main className="max-w-[1400px] mx-auto">
        
        {/* HEADER DA PÁGINA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 px-2 pt-2">
          <div className="flex items-start gap-4">
            <BackButton to={backPath} />
            <div>
              <div className="flex items-center gap-3 mb-2">
                  <span className={`border ${t.border} ${t.inputBg} ${t.textSecondary} text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full`}>Governança Operacional</span>
              </div>
              <h2 className={`text-4xl font-extrabold tracking-tight ${t.text}`}>Auditoria de {getTerminology('mesas', tipoNegocio)}</h2>
              <p className={`text-sm ${t.textSecondary} mt-1 font-medium`}>Controle de fechamentos, responsáveis por lançamentos, valores transacionados e cancelamentos.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className={`p-3 rounded-2xl ${t.cardBg} border ${t.border} ${t.textSecondary} hover:${t.text} transition-all shadow-md`}
              title={theme === 'dark' ? "Modo Claro" : "Modo Escuro"}
            >
              {theme === 'dark' ? <FiSun size={16} /> : <FiMoon size={16} />}
            </button>
            <button onClick={handleExportCSV}
              className={`px-5 py-3 ${t.cardBg} border ${t.border} rounded-2xl hover:opacity-85 transition-colors text-xs font-bold ${t.text} shadow-md flex items-center gap-1.5`}>
              <FiDownload /> CSV
            </button>
            <button onClick={handleExportPDF}
              className="px-5 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-bold text-xs shadow-lg hover:opacity-95 hover:scale-[1.01] transition-all flex items-center gap-1.5">
              <FiDownload /> PDF
            </button>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8 px-2">
          {[
            { label: `Fechamentos de ${getTerminology('mesas', tipoNegocio)}`, value: stats.totalVendas, icon: <FiCoffee />, textCol: 'text-blue-500' },
            { label: 'Faturamento Total', value: `R$ ${stats.totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: <FiCreditCard />, textCol: 'text-emerald-500' },
            { label: 'Itens Cancelados', value: stats.totalCancelamentos, icon: <FiAlertCircle />, textCol: 'text-red-500' },
            { label: 'Operadores Ativos', value: stats.totalGarcons, icon: <FiUser />, textCol: 'text-amber-500' },
          ].map((card, i) => (
            <div 
              key={i} 
              className={`rounded-3xl p-6 border ${t.border} ${t.cardBg} shadow-lg relative overflow-hidden group transition-all duration-300`}
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-slate-500/5 to-transparent rounded-bl-full pointer-events-none" />
              <div className="flex justify-between items-start mb-4">
                <p className={`text-[9px] font-black uppercase tracking-widest ${t.textMuted}`}>{card.label}</p>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-slate-500/10 ${card.textCol}`}>
                  {card.icon}
                </div>
              </div>
              <h3 className={`text-2xl font-extrabold tracking-tight ${t.text} truncate`}>{card.value}</h3>
            </div>
          ))}
        </div>

        {/* RESUMO POR FORMA DE PAGAMENTO */}
        {Object.keys(stats.porFormaPgto).length > 0 && (
          <div className={`${t.cardBg} border ${t.border} rounded-3xl p-6 shadow-lg mb-8 px-6`}>
            <h3 className={`text-xs font-black ${t.textSecondary} uppercase tracking-widest mb-4 flex items-center gap-2`}>
              <FiCreditCard className="text-indigo-500" /> Fechamento por Forma de Pagamento
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {Object.entries(stats.porFormaPgto)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([forma, dados]) => {
                  const corMap = {
                    'DINHEIRO': { bg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50', border: isDark ? 'border-emerald-500/20' : 'border-emerald-200', text: 'text-emerald-500', icon: '💵' },
                    'PIX': { bg: isDark ? 'bg-teal-500/10' : 'bg-teal-50', border: isDark ? 'border-teal-500/20' : 'border-teal-200', text: 'text-teal-500', icon: '⚡' },
                    'DEBITO': { bg: isDark ? 'bg-blue-500/10' : 'bg-blue-50', border: isDark ? 'border-blue-500/20' : 'border-blue-200', text: 'text-blue-500', icon: '💳' },
                    'DÉBITO': { bg: isDark ? 'bg-blue-500/10' : 'bg-blue-50', border: isDark ? 'border-blue-500/20' : 'border-blue-200', text: 'text-blue-500', icon: '💳' },
                    'CREDITO': { bg: isDark ? 'bg-purple-500/10' : 'bg-purple-50', border: isDark ? 'border-purple-500/20' : 'border-purple-200', text: 'text-purple-500', icon: '💳' },
                    'CRÉDITO': { bg: isDark ? 'bg-purple-500/10' : 'bg-purple-50', border: isDark ? 'border-purple-500/20' : 'border-purple-200', text: 'text-purple-500', icon: '💳' },
                    'CARTAO': { bg: isDark ? 'bg-indigo-500/10' : 'bg-indigo-50', border: isDark ? 'border-indigo-500/20' : 'border-indigo-200', text: 'text-indigo-500', icon: '💳' },
                    'CARTÃO': { bg: isDark ? 'bg-indigo-500/10' : 'bg-indigo-50', border: isDark ? 'border-indigo-500/20' : 'border-indigo-200', text: 'text-indigo-500', icon: '💳' },
                  };
                  const cor = corMap[forma] || { bg: isDark ? 'bg-slate-500/10' : 'bg-slate-50', border: isDark ? 'border-slate-500/20' : 'border-slate-200', text: isDark ? 'text-slate-400' : 'text-slate-600', icon: '🧾' };
                  
                  return (
                    <div key={forma} className={`${cor.bg} ${cor.border} border rounded-2xl p-4 hover:shadow-md transition-all`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${t.textSecondary} flex items-center gap-1`}>
                          {cor.icon} {forma || 'N/I'}
                        </span>
                        <span className={`text-[9px] font-bold ${t.textSecondary} ${isDark ? 'bg-slate-950' : 'bg-white'} px-2 py-0.5 rounded-full border ${t.border}`}>
                          {dados.qtd}x
                        </span>
                      </div>
                      <p className={`text-base font-extrabold ${cor.text}`}>
                        R$ {dados.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* FILTROS */}
        <div className={`${t.cardBg} border ${t.border} rounded-3xl p-6 shadow-lg mb-8`}>
          <div className={`flex items-center gap-2 text-xs font-black ${t.textSecondary} uppercase tracking-widest mb-4`}>
            <FiFilter /> Filtros
          </div>

          {/* Filtro de estabelecimento (somente master) */}
          {isMaster && (
            <div className={`mb-6 pb-6 border-b ${t.border}`}>
              <label className="text-[10px] font-black text-indigo-500 uppercase block mb-2 flex items-center gap-1.5">
                <FiHome /> Estabelecimento
              </label>
              <div className="relative w-full sm:w-80">
                <select 
                  value={filtroEstab} 
                  onChange={e => setFiltroEstab(e.target.value)}
                  className={`w-full px-4 py-3 ${t.inputBg} border ${t.border} rounded-2xl text-sm font-bold ${t.text} outline-none cursor-pointer appearance-none`}
                >
                  <option value="" className={isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}>⚡ Selecione um estabelecimento...</option>
                  {estabelecimentos.map(e => (
                    <option key={e.id} value={e.id} className={isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}>{e.nome}</option>
                  ))}
                </select>
                <div className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs ${t.textMuted}`}>▼</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className={`text-[10px] font-bold ${t.textMuted} uppercase block mb-1.5`}>Data Início</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                className={`w-full px-4 py-2.5 ${t.inputBg} border ${t.border} rounded-2xl text-xs font-bold ${t.text} outline-none`} />
            </div>
            <div>
              <label className={`text-[10px] font-bold ${t.textMuted} uppercase block mb-1.5`}>Data Fim</label>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                className={`w-full px-4 py-2.5 ${t.inputBg} border ${t.border} rounded-2xl text-xs font-bold ${t.text} outline-none`} />
            </div>
            <div className="relative">
              <label className={`text-[10px] font-bold ${t.textMuted} uppercase block mb-1.5`}>Garçom</label>
              <select value={filtroGarcom} onChange={e => setFiltroGarcom(e.target.value)}
                className={`w-full px-4 py-2.5 ${t.inputBg} border ${t.border} rounded-2xl text-xs font-bold ${t.text} outline-none cursor-pointer appearance-none`}>
                <option value="" className={isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}>Todos</option>
                {garconsUnicos.map(g => <option key={g} value={g} className={isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}>{g}</option>)}
              </select>
              <div className={`pointer-events-none absolute right-4 bottom-3.5 text-[10px] ${t.textMuted}`}>▼</div>
            </div>
            <div className="relative">
              <label className={`text-[10px] font-bold ${t.textMuted} uppercase block mb-1.5`}>{getTerminology('mesa', tipoNegocio)}</label>
              <select value={filtroMesa} onChange={e => setFiltroMesa(e.target.value)}
                className={`w-full px-4 py-2.5 ${t.inputBg} border ${t.border} rounded-2xl text-xs font-bold ${t.text} outline-none cursor-pointer appearance-none`}>
                <option value="" className={isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}>Todas</option>
                {mesasUnicas.map(m => <option key={m} value={String(m)} className={isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}>{getTerminology('mesa', tipoNegocio)} {m}</option>)}
              </select>
              <div className={`pointer-events-none absolute right-4 bottom-3.5 text-[10px] ${t.textMuted}`}>▼</div>
            </div>
            <div>
              <label className={`text-[10px] font-bold ${t.textMuted} uppercase block mb-1.5`}>Busca</label>
              <div className="relative">
                <FiSearch className={`absolute left-4 top-1/2 -translate-y-1/2 ${t.textMuted} text-xs`} />
                <input type="text" placeholder={`Nome, ${getTerminology('mesa', tipoNegocio).toLowerCase()}...`} value={busca} onChange={e => setBusca(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2.5 ${t.inputBg} border ${t.border} rounded-2xl text-xs font-bold ${t.text} outline-none placeholder:${t.textMuted}`} />
              </div>
            </div>
          </div>
        </div>

        {/* TABELA / LISTA */}
        <div className={`${t.cardBg} border ${t.border} rounded-[2rem] shadow-lg overflow-hidden mb-12`}>
          <div className={`p-6 border-b ${t.border} ${isDark ? 'bg-slate-900/20' : 'bg-slate-50/50'} flex items-center justify-between`}>
            <h3 className={`font-bold ${t.text} text-sm flex items-center gap-2`}>
              <FiCoffee className="text-blue-500" />
              Registro de Fechamentos ({vendasFiltradas.length})
            </h3>
          </div>

          {isMaster && !filtroEstab ? (
            <div className="py-20 text-center">
              <div className={`w-16 h-16 ${t.inputBg} border ${t.border} rounded-full mx-auto flex items-center justify-center mb-4`}>
                <FiHome className={`text-2xl ${t.textSecondary}`} />
              </div>
              <h3 className={`text-lg font-bold ${t.text} tracking-tight`}>Selecione um Estabelecimento</h3>
              <p className={`${t.textSecondary} font-medium text-sm mt-1`}>Escolha a loja acima para auditar o fluxo de {getTerminology('mesas', tipoNegocio).toLowerCase()}.</p>
            </div>
          ) : loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map(i => <SkeletonRow key={i} isDark={isDark} />)}
            </div>
          ) : vendasFiltradas.length === 0 ? (
            <div className="py-20 text-center">
              <div className={`w-16 h-16 ${t.inputBg} border ${t.border} rounded-full mx-auto flex items-center justify-center mb-4`}>
                <FiShield className={`text-2xl ${t.textSecondary}`} />
              </div>
              <h3 className={`text-lg font-bold ${t.text} tracking-tight`}>Nenhum Fechamento no Período</h3>
              <p className={`${t.textSecondary} font-medium text-sm mt-1`}>Ajuste os filtros de busca para encontrar registros.</p>
            </div>
          ) : (
            <div className={`divide-y ${t.border}`}>
              {vendasFiltradas.map(v => {
                const dt = getDate(v);
                const garcom = getGarcom(v);
                const cancelados = getItensCancelados(v);
                const itensAtivos = (v.itens || []).filter(i => i.status !== 'cancelado');
                const isExpanded = expandedId === v.id;
                const formaPgto = getFormaPagamento(v);
                const valor = Number(v.total || v.totalFinal) || 0;

                // Avatar do garçom
                const char = garcom ? garcom.charAt(0).toUpperCase() : 'G';
                const charCode = char.charCodeAt(0);
                const gradColor = charCode % 3 === 0 
                  ? 'from-blue-500 to-indigo-500'
                  : charCode % 3 === 1 
                    ? 'from-emerald-500 to-teal-500' 
                    : 'from-amber-500 to-orange-500';

                return (
                  <div key={v.id} className={`transition-colors ${cancelados.length > 0 ? (isDark ? 'bg-red-500/5' : 'bg-red-50/30') : ''}`}>
                    {/* Linha principal */}
                    <div
                      className={`flex flex-wrap items-center gap-4 px-6 py-4 cursor-pointer hover:bg-slate-500/5 transition-colors`}
                      onClick={() => setExpandedId(isExpanded ? null : v.id)}
                    >
                      {/* Data */}
                      <div className="w-[110px] shrink-0">
                        <p className={`text-xs font-bold ${t.text}`}>
                          {dt ? format(dt, "dd/MM/yy", { locale: ptBR }) : '—'}
                        </p>
                        <p className={`text-[10px] ${t.textSecondary} font-semibold flex items-center gap-1.5 mt-0.5`}>
                          <FiClock size={10} /> {dt ? format(dt, "HH:mm") : '—'}
                        </p>
                      </div>

                      {/* Mesa/Identificador */}
                      <div className="w-[70px] shrink-0">
                        <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-3 py-1.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-xl text-xs font-black uppercase tracking-wider`}>
                          {getTerminology('mesa', tipoNegocio)} {formatMesaId(v.mesaNumero)}
                        </span>
                      </div>

                      {/* Garçom */}
                      <div className="flex-1 min-w-[120px] flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${gradColor} flex items-center justify-center text-white font-black text-xs shadow-md shrink-0`}>
                          {char}
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${t.text}`}>
                            {garcom}
                          </p>
                          <p className={`text-[10px] ${t.textSecondary} font-semibold mt-0.5`}>
                            {itensAtivos.length} {itensAtivos.length === 1 ? 'item' : 'itens'}
                            {cancelados.length > 0 && (
                              <span className="text-red-500 font-bold ml-2">
                                ⚠ {cancelados.length} cancelado(s)
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Pagamento */}
                      <div className="w-[100px] shrink-0 hidden sm:block">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${t.textSecondary} ${t.inputBg} border ${t.border} px-2.5 py-1.5 rounded-xl`}>
                          {formaPgto.substring(0, 12)}
                        </span>
                      </div>

                      {/* Status */}
                      <div className="w-[90px] shrink-0 hidden md:block">
                        <span className={`text-[10px] font-bold px-2.5 py-1.5 rounded-xl uppercase tracking-wider ${v.status === 'pago' ? (isDark ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200') :
                            v.status === 'pago_parcial' ? (isDark ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-200') : 'bg-slate-100 text-slate-500'
                          }`}>
                          {v.status === 'pago' ? 'Quitado' : v.status === 'pago_parcial' ? 'Parcial' : v.status || '—'}
                        </span>
                      </div>

                      {/* Valor */}
                      <div className="w-[110px] shrink-0 text-right">
                        <p className={`text-sm font-black ${t.text}`}>
                          R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        {(v.valorDesconto > 0 || v.taxaServicoCobrada > 0) && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {v.valorDesconto > 0 && <span className="text-red-500">-R${Number(v.valorDesconto).toFixed(0)} </span>}
                            {v.taxaServicoCobrada > 0 && <span className="text-emerald-500 font-bold">+10%</span>}
                          </p>
                        )}
                      </div>

                      {/* Expandir */}
                      <div className="w-[24px] shrink-0 flex justify-end">
                        {isExpanded ? <FiChevronUp className="text-blue-500" /> : <FiChevronDown className={`${t.textMuted}`} />}
                      </div>
                    </div>

                    {/* Detalhes expandidos */}
                    {isExpanded && (
                      <div className={`px-6 pb-6 pt-2 ${isDark ? 'bg-slate-900/40' : 'bg-slate-50/30'} border-t ${t.border} animate-fadeIn`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-3">
                          {/* Itens consumidos */}
                          <div className={`${t.cardBg} border ${t.border} rounded-2xl p-4`}>
                            <p className={`text-[10px] font-black ${t.textSecondary} uppercase tracking-wider mb-3 flex items-center gap-1.5`}>
                              <FiCoffee className="text-blue-500" /> Itens do Pedido ({itensAtivos.length})
                            </p>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                              {itensAtivos.length === 0 ? (
                                <p className={`text-xs ${t.textMuted} italic`}>Nenhum item ativo no fechamento</p>
                              ) : itensAtivos.map((item, i) => (
                                <div key={i} className={`flex justify-between items-center text-xs py-2 border-b ${t.border} last:border-0`}>
                                  <div>
                                    <span className={`font-black ${t.text}`}>{item.quantidade || item.qtd || 1}x</span>
                                    <span className={`ml-2 font-medium ${t.textSecondary}`}>{item.nome}</span>
                                    {(item.adicionadoPor || item.adicionadoPorNome) && (
                                      <span className="ml-2 text-[9px] text-blue-500 font-black uppercase tracking-wider bg-blue-500/10 px-1.5 py-0.5 rounded">
                                        {item.adicionadoPorNome || item.adicionadoPor}
                                      </span>
                                    )}
                                  </div>
                                  <span className={`font-bold ${t.text}`}>
                                    R$ {((item.preco || 0) * (item.quantidade || item.qtd || 1)).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Cancelamentos + Info */}
                          <div className="space-y-4">
                            {cancelados.length > 0 && (
                              <div className={`${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-100'} border rounded-2xl p-4`}>
                                <p className="text-[10px] font-black text-red-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                  <FiAlertCircle /> Itens Cancelados ({cancelados.length})
                                </p>
                                <div className="space-y-2">
                                  {cancelados.map((item, i) => (
                                    <div key={i} className="flex justify-between items-center text-xs py-1.5 border-b border-red-500/10 last:border-0">
                                      <span className="text-red-500/80 line-through font-medium">
                                        {item.quantidade || 1}x {item.nome}
                                      </span>
                                      <span className="text-red-500 font-bold">
                                        R$ {((item.preco || 0) * (item.quantidade || 1)).toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className={`${t.cardBg} border ${t.border} rounded-2xl p-4`}>
                              <p className={`text-[10px] font-black ${t.textSecondary} uppercase tracking-wider mb-3`}>
                                Detalhes do Fechamento
                              </p>
                              <div className="space-y-2 text-xs">
                                <div className="flex justify-between">
                                  <span className={`${t.textSecondary} font-medium`}>Valor Original:</span>
                                  <span className={`font-bold ${t.text}`}>R$ {(Number(v.valorOriginal || v.total) || 0).toFixed(2)}</span>
                                </div>
                                {v.taxaServicoCobrada > 0 && (
                                  <div className="flex justify-between">
                                    <span className={`${t.textSecondary} font-medium`}>Taxa de Serviço (10%):</span>
                                    <span className="font-bold text-emerald-500">+ R$ {Number(v.taxaServicoCobrada).toFixed(2)}</span>
                                  </div>
                                )}
                                {v.valorDesconto > 0 && (
                                  <div className="flex justify-between">
                                    <span className={`${t.textSecondary} font-medium`}>Desconto:</span>
                                    <span className="font-bold text-red-500">- R$ {Number(v.valorDesconto).toFixed(2)}</span>
                                  </div>
                                )}
                                <div className={`flex justify-between border-t ${t.border} pt-2`}>
                                  <span className={`${t.textSecondary} font-medium`}>Forma de Pagamento:</span>
                                  <span className={`font-black uppercase ${t.text}`}>{formaPgto}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className={`${t.textSecondary} font-medium`}>Operador/Garçom:</span>
                                  <span className="font-bold text-blue-500">{garcom}</span>
                                </div>
                                {v.criadoPor && (
                                  <div className="flex justify-between">
                                    <span className={`${t.textSecondary} font-medium`}>UID Operador:</span>
                                    <span className={`font-mono text-[10px] ${t.textMuted}`}>{v.criadoPor}</span>
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
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        * { font-family: 'Outfit', -apple-system, system-ui, sans-serif; }
      `}</style>
    </div>
  );
}

export default AuditoriaMesas;
