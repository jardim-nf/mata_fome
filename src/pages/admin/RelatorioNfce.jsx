import React from 'react';
import {
  FaReceipt, FaSearch, FaFilter, FaDownload, FaFilePdf,
  FaFileCode, FaSyncAlt, FaTimes, FaCheckCircle, FaTimesCircle,
  FaClock, FaExclamationTriangle, FaBan, FaChevronLeft, FaChevronRight,
  FaInfoCircle, FaCalendarAlt, FaFileExport, FaFileArchive
} from 'react-icons/fa';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import { formatarMoeda } from '../../utils/formatCurrency';
import { useRelatorioNfceData } from '../../hooks/useRelatorioNfceData';
import DateRangeFilter from '../../components/DateRangeFilter';
import BackButton from '../../components/BackButton';

// ─── Componente principal ───────────────────────────────────────────
function RelatorioNfce({ estabelecimentoPrincipal }) {
  const {
      // Flags e Listagens
      loading, loadingAcao,
      vendasFiltradas, vendasPaginadas, stats,
      ITEMS_PER_PAGE, totalPaginas,
      
      // Contexto Modal/Selecionada (Compartilhado)
      vendaSelecionada, setVendaSelecionada,
      
      // Filters Binding
      filtroStatus, setFiltroStatus,
      busca, setBusca,
      datePreset, setDatePreset,
      dateRange, setDateRange,
      paginaAtual, setPaginaAtual,

      // Ações Principais
      carregarVendas,
      handleExportarCSV, handleExportarPDF, handleBaixarLoteXml,
      handleBaixarPdf, handleBaixarXml, handleBaixarXmlCancelamento, handleConsultarStatus,
      
      // Utils
      formatDateTime, getStatusInfo
  } = useRelatorioNfceData(estabelecimentoPrincipal);

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <BackButton className="mb-6" />
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
          <button onClick={handleBaixarLoteXml} disabled={loadingAcao === 'lote'} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium disabled:opacity-50">
            {loadingAcao === 'lote' ? <FaSyncAlt className="animate-spin" /> : <FaFileArchive />}
            {loadingAcao === 'lote' ? 'Gerando Lote...' : 'Baixar XMLs (Lote)'}
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
          {/* Período */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Período</label>
            <DateRangeFilter
                activePreset={datePreset}
                dateRange={dateRange}
                onPresetChange={setDatePreset}
                onRangeChange={setDateRange}
                onClear={() => {
                   setDatePreset('');
                   setDateRange({ start: null, end: null });
                }}
            />
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
