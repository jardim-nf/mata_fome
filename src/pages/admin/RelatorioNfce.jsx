// src/pages/admin/RelatorioNfce.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FaReceipt, FaSearch, FaFilter, FaDownload, FaFilePdf,
  FaFileCode, FaSyncAlt, FaTimes, FaCheckCircle, FaTimesCircle,
  FaClock, FaExclamationTriangle, FaBan, FaChevronLeft, FaChevronRight,
  FaInfoCircle, FaCalendarAlt, FaFileExport
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import { vendaService } from '../../services/vendaService';
import { formatarMoeda } from '../../utils/formatCurrency';

// ─── Constantes ─────────────────────────────────────────────────────
const STATUS_MAP = {
  CONCLUIDO: { label: 'Autorizada', color: 'bg-green-100 text-green-800', icon: FaCheckCircle, iconColor: 'text-green-500' },
  PROCESSANDO: { label: 'Processando', color: 'bg-yellow-100 text-yellow-800', icon: FaClock, iconColor: 'text-yellow-500' },
  REJEITADO: { label: 'Rejeitada', color: 'bg-red-100 text-red-800', icon: FaTimesCircle, iconColor: 'text-red-500' },
  ERRO: { label: 'Erro', color: 'bg-red-100 text-red-800', icon: FaExclamationTriangle, iconColor: 'text-red-500' },
  CANCELADA: { label: 'Cancelada', color: 'bg-gray-100 text-gray-600', icon: FaBan, iconColor: 'text-gray-500' },
};

const ITEMS_PER_PAGE = 20;

function getStatusInfo(status) {
  return STATUS_MAP[status] || { label: status || 'Sem nota', color: 'bg-gray-100 text-gray-500', icon: FaInfoCircle, iconColor: 'text-gray-400' };
}

function formatDate(date) {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(date) {
  if (!date) return '—';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Componente principal ───────────────────────────────────────────
function RelatorioNfce({ estabelecimentoPrincipal }) {
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [busca, setBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);

  // Modal detalhes
  const [vendaSelecionada, setVendaSelecionada] = useState(null);
  const [loadingAcao, setLoadingAcao] = useState(null);

  // ─── Carregar vendas ────────────────────────────────────────────
  const carregarVendas = useCallback(async () => {
    if (!estabelecimentoPrincipal) return;
    setLoading(true);
    try {
      const todas = await vendaService.buscarVendasPorEstabelecimento(estabelecimentoPrincipal, 500);
      // Filtrar apenas vendas que possuem dados fiscais (NFC-e emitida ou tentativa)
      const comFiscal = todas.filter(v => v.fiscal && v.fiscal.status);
      setVendas(comFiscal);
    } catch (err) {
      console.error('Erro ao carregar vendas:', err);
      toast.error('Erro ao carregar dados fiscais.');
    } finally {
      setLoading(false);
    }
  }, [estabelecimentoPrincipal]);

  useEffect(() => {
    carregarVendas();
  }, [carregarVendas]);

  // ─── Filtros aplicados ──────────────────────────────────────────
  const vendasFiltradas = useMemo(() => {
    let resultado = [...vendas];

    // Filtro por status
    if (filtroStatus !== 'TODOS') {
      resultado = resultado.filter(v => v.fiscal?.status === filtroStatus);
    }

    // Filtro por data
    if (dataInicio) {
      const inicio = new Date(dataInicio + 'T00:00:00');
      resultado = resultado.filter(v => v.createdAt >= inicio);
    }
    if (dataFim) {
      const fim = new Date(dataFim + 'T23:59:59');
      resultado = resultado.filter(v => v.createdAt <= fim);
    }

    // Busca textual (ID da venda, idPlugNotas, operador, etc.)
    if (busca.trim()) {
      const termo = busca.toLowerCase().trim();
      resultado = resultado.filter(v =>
        v.id?.toLowerCase().includes(termo) ||
        v.fiscal?.idPlugNotas?.toLowerCase().includes(termo) ||
        v.fiscal?.numero?.toString().includes(termo) ||
        v.operador?.toLowerCase().includes(termo) ||
        v.clienteCpf?.includes(termo)
      );
    }

    return resultado;
  }, [vendas, filtroStatus, dataInicio, dataFim, busca]);

  // ─── Paginação ──────────────────────────────────────────────────
  const totalPaginas = Math.ceil(vendasFiltradas.length / ITEMS_PER_PAGE);
  const vendasPaginadas = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITEMS_PER_PAGE;
    return vendasFiltradas.slice(inicio, inicio + ITEMS_PER_PAGE);
  }, [vendasFiltradas, paginaAtual]);

  useEffect(() => {
    setPaginaAtual(1);
  }, [filtroStatus, dataInicio, dataFim, busca]);

  // ─── Estatísticas ───────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = vendasFiltradas.length;
    const autorizadas = vendasFiltradas.filter(v => v.fiscal?.status === 'CONCLUIDO').length;
    const processando = vendasFiltradas.filter(v => v.fiscal?.status === 'PROCESSANDO').length;
    const rejeitadas = vendasFiltradas.filter(v => ['REJEITADO', 'ERRO'].includes(v.fiscal?.status)).length;
    const canceladas = vendasFiltradas.filter(v => v.fiscal?.status === 'CANCELADA').length;
    const valorTotal = vendasFiltradas.reduce((sum, v) => sum + (v.total || 0), 0);
    return { total, autorizadas, processando, rejeitadas, canceladas, valorTotal };
  }, [vendasFiltradas]);

  // ─── Ações fiscais ──────────────────────────────────────────────
  const handleBaixarPdf = async (venda) => {
    const idPlugNotas = venda.fiscal?.idPlugNotas;
    if (!idPlugNotas) return toast.warning('Sem ID PlugNotas para esta venda.');
    setLoadingAcao('pdf');
    try {
      const res = await vendaService.baixarPdfNfce(idPlugNotas, venda.fiscal?.pdf);
      if (!res.success) toast.error('Erro ao baixar PDF: ' + (res.error || ''));
      else toast.success('PDF aberto com sucesso!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao baixar PDF.');
    } finally {
      setLoadingAcao(null);
    }
  };

  const handleBaixarXml = async (venda) => {
    const idPlugNotas = venda.fiscal?.idPlugNotas;
    if (!idPlugNotas) return toast.warning('Sem ID PlugNotas para esta venda.');
    setLoadingAcao('xml');
    try {
      const res = await vendaService.baixarXmlNfce(idPlugNotas, venda.id.slice(-6));
      if (!res.success) toast.error('Erro ao baixar XML: ' + (res.error || ''));
      else toast.success('XML baixado!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao baixar XML.');
    } finally {
      setLoadingAcao(null);
    }
  };

  const handleBaixarXmlCancelamento = async (venda) => {
    const idPlugNotas = venda.fiscal?.idPlugNotas;
    if (!idPlugNotas) return toast.warning('Sem ID PlugNotas.');
    setLoadingAcao('xmlcancel');
    try {
      const res = await vendaService.baixarXmlCancelamentoNfce(idPlugNotas, venda.id.slice(-6));
      if (!res.success) toast.error('Erro: ' + (res.error || ''));
      else toast.success('XML de cancelamento baixado!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao baixar XML de cancelamento.');
    } finally {
      setLoadingAcao(null);
    }
  };

  const handleConsultarStatus = async (venda) => {
    const idPlugNotas = venda.fiscal?.idPlugNotas;
    if (!idPlugNotas) return toast.warning('Sem ID PlugNotas.');
    setLoadingAcao('status');
    try {
      const res = await vendaService.consultarStatusNfce(venda.id, idPlugNotas);
      if (res.sucesso || res.success) {
        toast.success('Status atualizado!');
        // Atualizar localmente
        setVendas(prev => prev.map(v =>
          v.id === venda.id ? { ...v, fiscal: { ...v.fiscal, ...res } } : v
        ));
        if (vendaSelecionada?.id === venda.id) {
          setVendaSelecionada(prev => ({ ...prev, fiscal: { ...prev.fiscal, ...res } }));
        }
      } else {
        toast.error('Erro ao consultar: ' + (res.error || res.mensagem || ''));
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao consultar status.');
    } finally {
      setLoadingAcao(null);
    }
  };

  // ─── Exportar CSV ───────────────────────────────────────────────
  const handleExportarCSV = () => {
    if (vendasFiltradas.length === 0) return toast.info('Nenhum dado para exportar.');
    const header = 'Data,Venda ID,Status NFC-e,ID PlugNotas,Valor,Forma Pgto,Operador,CPF Cliente';
    const linhas = vendasFiltradas.map(v => {
      return [
        formatDateTime(v.createdAt),
        v.id,
        getStatusInfo(v.fiscal?.status).label,
        v.fiscal?.idPlugNotas || '',
        (v.total || 0).toFixed(2).replace('.', ','),
        v.formaPagamento || '',
        v.operador || '',
        v.clienteCpf || ''
      ].join(';');
    });
    const csv = '\uFEFF' + header + '\n' + linhas.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio_nfce_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('CSV exportado com sucesso!');
  };

  // ─── Exportar PDF (relatório completo) ─────────────────────────
  const handleExportarPDF = () => {
    if (vendasFiltradas.length === 0) return toast.info('Nenhum dado para exportar.');
    const rows = vendasFiltradas.map(v => {
      const si = getStatusInfo(v.fiscal?.status);
      return `<tr>
        <td>${formatDateTime(v.createdAt)}</td>
        <td style="font-family:monospace">${v.id.slice(-8)}</td>
        <td>${si.label}</td>
        <td style="font-family:monospace">${v.fiscal?.idPlugNotas || '—'}</td>
        <td style="text-align:right">${formatarMoeda(v.total || 0)}</td>
        <td>${v.formaPagamento || '—'}</td>
        <td>${v.operador || '—'}</td>
        <td>${v.clienteCpf || '—'}</td>
      </tr>`;
    }).join('');

    const periodoTxt = dataInicio || dataFim
      ? `Período: ${dataInicio || '...'} a ${dataFim || '...'}`
      : 'Período: Todos';
    const statusTxt = filtroStatus === 'TODOS' ? 'Todos' : getStatusInfo(filtroStatus).label;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Relatório NFC-e</title>
<style>
  body { font-family: Arial, sans-serif; padding: 20px; color: #333; font-size: 11px; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .meta { color: #666; font-size: 11px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; font-weight: 600; }
  tr:nth-child(even) { background: #f9fafb; }
  .resumo { margin-top: 16px; font-size: 12px; }
  .resumo span { font-weight: bold; }
  @media print { body { padding: 0; } }
</style></head><body>
<h1>Relatório NFC-e</h1>
<p class="meta">${periodoTxt} &nbsp;|&nbsp; Status: ${statusTxt} &nbsp;|&nbsp; Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
<table>
  <thead><tr>
    <th>Data/Hora</th><th>Venda</th><th>Status</th><th>ID PlugNotas</th><th style="text-align:right">Valor</th><th>Pagamento</th><th>Operador</th><th>CPF</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="resumo">
  Total de notas: <span>${stats.total}</span> &nbsp;|&nbsp;
  Autorizadas: <span>${stats.autorizadas}</span> &nbsp;|&nbsp;
  Processando: <span>${stats.processando}</span> &nbsp;|&nbsp;
  Rejeitadas: <span>${stats.rejeitadas}</span> &nbsp;|&nbsp;
  Canceladas: <span>${stats.canceladas}</span> &nbsp;|&nbsp;
  Valor Total: <span>${formatarMoeda(stats.valorTotal)}</span>
</div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast.success('PDF pronto para impressão!');
  };

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-xl">
            <FaReceipt className="text-2xl text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Relatório NFC-e</h1>
            <p className="text-sm text-gray-500">Notas fiscais eletrônicas do consumidor</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={carregarVendas} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
            <FaSyncAlt className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
          <button onClick={handleExportarPDF} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium">
            <FaFilePdf /> Exportar PDF
          </button>
          <button onClick={handleExportarCSV} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
            <FaFileExport /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total', valor: stats.total, cor: 'blue', icon: FaReceipt },
          { label: 'Autorizadas', valor: stats.autorizadas, cor: 'green', icon: FaCheckCircle },
          { label: 'Processando', valor: stats.processando, cor: 'yellow', icon: FaClock },
          { label: 'Rejeitadas', valor: stats.rejeitadas, cor: 'red', icon: FaTimesCircle },
          { label: 'Canceladas', valor: stats.canceladas, cor: 'gray', icon: FaBan },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-${card.cor}-100`}>
              <card.icon className={`text-${card.cor}-500 text-lg`} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className="text-xl font-bold text-gray-800">{card.valor}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Valor total */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex items-center gap-3">
        <FaInfoCircle className="text-blue-500" />
        <span className="text-sm text-gray-600">
          Valor total das notas filtradas: <strong className="text-gray-800">{formatarMoeda(stats.valorTotal)}</strong>
        </span>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <FaFilter className="text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Filtros</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Status */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Status</label>
            <select
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none"
            >
              <option value="TODOS">Todos</option>
              <option value="CONCLUIDO">Autorizada</option>
              <option value="PROCESSANDO">Processando</option>
              <option value="REJEITADO">Rejeitada</option>
              <option value="ERRO">Erro</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>
          {/* Data Início */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Data Início</label>
            <div className="relative">
              <FaCalendarAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none" />
            </div>
          </div>
          {/* Data Fim */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Data Fim</label>
            <div className="relative">
              <FaCalendarAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none" />
            </div>
          </div>
          {/* Busca */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Buscar</label>
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
              <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="ID, PlugNotas, CPF..."
                className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <FaSyncAlt className="animate-spin text-3xl text-blue-500" />
        </div>
      ) : vendasFiltradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FaReceipt className="text-5xl text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhuma nota fiscal encontrada</p>
          <p className="text-sm text-gray-400 mt-1">Ajuste os filtros ou verifique as vendas do estabelecimento.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Data</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Venda</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Valor</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Pagamento</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Operador</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vendasPaginadas.map(venda => {
                    const si = getStatusInfo(venda.fiscal?.status);
                    const IconStatus = si.icon;
                    return (
                      <tr key={venda.id} className="hover:bg-gray-50 transition cursor-pointer" onClick={() => setVendaSelecionada(venda)}>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatDateTime(venda.createdAt)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{venda.id.slice(-8)}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${si.color}`}>
                            <IconStatus className="text-xs" /> {si.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right font-semibold text-gray-800">{formatarMoeda(venda.total || 0)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600">{venda.formaPagamento || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600">{venda.operador || '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <div className="flex justify-center gap-1">
                            {venda.fiscal?.status === 'CONCLUIDO' && (
                              <>
                                <button onClick={e => { e.stopPropagation(); handleBaixarPdf(venda); }}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Baixar PDF">
                                  <FaFilePdf />
                                </button>
                                <button onClick={e => { e.stopPropagation(); handleBaixarXml(venda); }}
                                  className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition" title="Baixar XML">
                                  <FaFileCode />
                                </button>
                              </>
                            )}
                            {venda.fiscal?.status === 'CANCELADA' && (
                              <button onClick={e => { e.stopPropagation(); handleBaixarXmlCancelamento(venda); }}
                                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition" title="XML Cancelamento">
                                <FaFileCode />
                              </button>
                            )}
                            {['PROCESSANDO', 'REJEITADO', 'ERRO'].includes(venda.fiscal?.status) && (
                              <button onClick={e => { e.stopPropagation(); handleConsultarStatus(venda); }}
                                className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition" title="Consultar Status">
                                <FaSyncAlt />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginação */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
              <span>
                Mostrando {((paginaAtual - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(paginaAtual * ITEMS_PER_PAGE, vendasFiltradas.length)} de {vendasFiltradas.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
                  disabled={paginaAtual <= 1}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <FaChevronLeft />
                </button>
                <span className="px-3 py-1 bg-blue-600 text-white rounded-lg font-medium">{paginaAtual}</span>
                <span className="text-gray-400">/ {totalPaginas}</span>
                <button
                  onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
                  disabled={paginaAtual >= totalPaginas}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <FaChevronRight />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de Detalhes */}
      {vendaSelecionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setVendaSelecionada(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header modal */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <FaReceipt className="text-blue-600" />
                <h2 className="text-lg font-bold text-gray-800">Detalhes da NFC-e</h2>
              </div>
              <button onClick={() => setVendaSelecionada(null)} className="p-2 hover:bg-gray-100 rounded-lg transition">
                <FaTimes className="text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Status grande */}
              {(() => {
                const si = getStatusInfo(vendaSelecionada.fiscal?.status);
                const Icon = si.icon;
                return (
                  <div className={`flex items-center gap-3 p-4 rounded-xl ${si.color}`}>
                    <Icon className={`text-2xl ${si.iconColor}`} />
                    <div>
                      <p className="font-bold">{si.label}</p>
                      <p className="text-xs opacity-75">Status da nota fiscal</p>
                    </div>
                  </div>
                );
              })()}

              {/* Dados da venda */}
              <div className="grid grid-cols-2 gap-3">
                <InfoItem label="ID Venda" value={vendaSelecionada.id.slice(-12)} mono />
                <InfoItem label="Data/Hora" value={formatDateTime(vendaSelecionada.createdAt)} />
                <InfoItem label="Valor Total" value={formatarMoeda(vendaSelecionada.total || 0)} bold />
                <InfoItem label="Forma Pagamento" value={vendaSelecionada.formaPagamento || '—'} />
                <InfoItem label="Operador" value={vendaSelecionada.operador || '—'} />
                <InfoItem label="CPF Cliente" value={vendaSelecionada.clienteCpf || '—'} mono />
              </div>

              {/* Dados fiscais */}
              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Dados Fiscais</p>
                <div className="grid grid-cols-2 gap-3">
                  <InfoItem label="ID PlugNotas" value={vendaSelecionada.fiscal?.idPlugNotas || '—'} mono />
                  <InfoItem label="Número Nota" value={vendaSelecionada.fiscal?.numero || '—'} />
                  <InfoItem label="Série" value={vendaSelecionada.fiscal?.serie || '—'} />
                  <InfoItem label="Protocolo" value={vendaSelecionada.fiscal?.protocolo || '—'} mono />
                </div>
                {vendaSelecionada.fiscal?.chaveAcesso && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 mb-1">Chave de Acesso</p>
                    <p className="font-mono text-xs bg-gray-50 p-2 rounded-lg break-all text-gray-700">{vendaSelecionada.fiscal.chaveAcesso}</p>
                  </div>
                )}
                {vendaSelecionada.fiscal?.motivo && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 mb-1">Mensagem SEFAZ</p>
                    <p className="text-sm bg-yellow-50 border border-yellow-200 p-2 rounded-lg text-yellow-800">{vendaSelecionada.fiscal.motivo}</p>
                  </div>
                )}
              </div>

              {/* Itens da venda */}
              {vendaSelecionada.itens?.length > 0 && (
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Itens ({vendaSelecionada.itens.length})</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {vendaSelecionada.itens.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-sm bg-gray-50 px-3 py-2 rounded-lg">
                        <span className="text-gray-700">{item.qtd || item.quantidade || 1}x {item.nome || item.name}</span>
                        <span className="font-semibold text-gray-800">{formatarMoeda((item.preco || item.price || 0) * (item.qtd || item.quantidade || 1))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer com ações */}
            <div className="p-5 border-t border-gray-200 flex flex-wrap gap-2">
              {vendaSelecionada.fiscal?.status === 'CONCLUIDO' && (
                <>
                  <button onClick={() => handleBaixarPdf(vendaSelecionada)} disabled={loadingAcao === 'pdf'}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition text-sm font-medium">
                    <FaFilePdf /> {loadingAcao === 'pdf' ? 'Abrindo...' : 'PDF DANFE'}
                  </button>
                  <button onClick={() => handleBaixarXml(vendaSelecionada)} disabled={loadingAcao === 'xml'}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition text-sm font-medium">
                    <FaFileCode /> {loadingAcao === 'xml' ? 'Baixando...' : 'XML'}
                  </button>
                </>
              )}
              {vendaSelecionada.fiscal?.status === 'CANCELADA' && (
                <button onClick={() => handleBaixarXmlCancelamento(vendaSelecionada)} disabled={loadingAcao === 'xmlcancel'}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition text-sm font-medium">
                  <FaFileCode /> {loadingAcao === 'xmlcancel' ? 'Baixando...' : 'XML Cancelamento'}
                </button>
              )}
              {['PROCESSANDO', 'REJEITADO', 'ERRO'].includes(vendaSelecionada.fiscal?.status) && (
                <button onClick={() => handleConsultarStatus(vendaSelecionada)} disabled={loadingAcao === 'status'}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 transition text-sm font-medium">
                  <FaSyncAlt className={loadingAcao === 'status' ? 'animate-spin' : ''} />
                  {loadingAcao === 'status' ? 'Consultando...' : 'Consultar Status'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-componente: Linha de informação ──────────────────────────
function InfoItem({ label, value, mono, bold }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-sm text-gray-800 ${mono ? 'font-mono' : ''} ${bold ? 'font-bold text-lg' : ''}`}>{value}</p>
    </div>
  );
}

export default withEstablishmentAuth(RelatorioNfce);
