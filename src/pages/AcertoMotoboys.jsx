// src/pages/AcertoMotoboys.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { format, subDays } from 'date-fns';
import { FaMotorcycle } from 'react-icons/fa';
import {
  IoCalendarOutline, IoDocumentTextOutline, IoCheckmarkCircle,
  IoTimeOutline, IoCloseCircle, IoRefreshOutline, IoArrowBack,
  IoCashOutline, IoSearchOutline
} from 'react-icons/io5';
import { Link } from 'react-router-dom';

const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (iso) => {
  if (!iso) return '-';
  try { return format(new Date(iso), 'dd/MM HH:mm'); } catch { return '-'; }
};

function AcertoMotoboys() {
  const { estabelecimentoIdPrincipal } = useAuth();
  const functions = getFunctions();

  const [motoboys, setMotoboys] = useState([]);
  const [motoboyId, setMotoboyId] = useState('');
  const [dataInicio, setDataInicio] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [acertoAtual, setAcertoAtual] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [loadingGerar, setLoadingGerar] = useState(false);
  const [loadingPagar, setLoadingPagar] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('novo'); // 'novo' | 'historico'

  // Carregar motoboys do Firestore
  useEffect(() => {
    if (!estabelecimentoIdPrincipal) return;
    const q = query(
      collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'entregadores'),
      orderBy('nome', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMotoboys(lista);
      if (lista.length > 0 && !motoboyId) setMotoboyId(lista[0].id);
    });
    return () => unsub();
  }, [estabelecimentoIdPrincipal]);

  // Carregar histórico de acertos
  useEffect(() => {
    if (!estabelecimentoIdPrincipal) return;
    const q = query(
      collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'acertos'),
      orderBy('criadoEm', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setHistorico(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [estabelecimentoIdPrincipal]);

  const handleGerarAcerto = useCallback(async () => {
    if (!motoboyId) return toast.error('Selecione um motoboy.');
    if (!dataInicio || !dataFim) return toast.error('Selecione o período.');

    setLoadingGerar(true);
    setAcertoAtual(null);

    try {
      const fn = httpsCallable(functions, 'gerarAcertoMotoboy');
      const res = await fn({ estabelecimentoId: estabelecimentoIdPrincipal, motoboyId, dataInicio, dataFim });
      const data = res.data;

      if (data.sucesso) {
        setAcertoAtual(data);
        toast.success(`✅ Acerto gerado! ${data.totalEntregas} entrega(s) — ${fmtBRL(data.totalValor)}`);
      } else {
        toast.error('Erro ao gerar acerto.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Falha ao gerar acerto: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setLoadingGerar(false);
    }
  }, [motoboyId, dataInicio, dataFim, estabelecimentoIdPrincipal, functions]);

  const handleMarcarPago = useCallback(async (acertoId) => {
    if (!window.confirm('Confirmar pagamento deste acerto?')) return;
    setLoadingPagar(true);
    try {
      const fn = httpsCallable(functions, 'marcarAcertoPago');
      await fn({ estabelecimentoId: estabelecimentoIdPrincipal, acertoId });
      toast.success('✅ Acerto marcado como pago!');
      if (acertoAtual?.acertoId === acertoId) {
        setAcertoAtual(prev => prev ? { ...prev, pago: true } : prev);
      }
    } catch (err) {
      toast.error('Falha ao marcar como pago.');
    } finally {
      setLoadingPagar(false);
    }
  }, [functions, estabelecimentoIdPrincipal, acertoAtual]);

  const motoboyAtual = motoboys.find(m => m.id === motoboyId);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 font-sans">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/admin/relatorios" className="p-2 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
            <IoArrowBack className="text-slate-600" size={20} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <FaMotorcycle className="text-white" size={18} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800">Acerto com Motoboys</h1>
              <p className="text-xs text-slate-500">Gere relatórios de entregas por período</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white border border-slate-200 rounded-2xl p-1 mb-6 shadow-sm">
          {[
            { id: 'novo', label: 'Gerar Novo Acerto', icon: <IoDocumentTextOutline size={16} /> },
            { id: 'historico', label: `Histórico (${historico.length})`, icon: <IoTimeOutline size={16} /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setAbaAtiva(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                abaAtiva === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ABA: GERAR NOVO ACERTO */}
        {abaAtiva === 'novo' && (
          <div className="space-y-4">
            {/* Filtros */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-4">Parâmetros do Acerto</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Motoboy</label>
                  <select
                    value={motoboyId}
                    onChange={e => setMotoboyId(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Selecione...</option>
                    {motoboys.map(m => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Data Início</label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={e => setDataInicio(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Data Fim</label>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={e => setDataFim(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
                {[
                  { label: 'Hoje', fn: () => { const h = format(new Date(), 'yyyy-MM-dd'); setDataInicio(h); setDataFim(h); } },
                  { label: '7 dias', fn: () => { setDataInicio(format(subDays(new Date(), 7), 'yyyy-MM-dd')); setDataFim(format(new Date(), 'yyyy-MM-dd')); } },
                  { label: '15 dias', fn: () => { setDataInicio(format(subDays(new Date(), 15), 'yyyy-MM-dd')); setDataFim(format(new Date(), 'yyyy-MM-dd')); } },
                  { label: '30 dias', fn: () => { setDataInicio(format(subDays(new Date(), 30), 'yyyy-MM-dd')); setDataFim(format(new Date(), 'yyyy-MM-dd')); } },
                ].map(btn => (
                  <button key={btn.label} onClick={btn.fn}
                    className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors">
                    {btn.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleGerarAcerto}
                disabled={loadingGerar || !motoboyId}
                className="w-full mt-4 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loadingGerar
                  ? <><span className="animate-spin">⏳</span> Gerando...</>
                  : <><IoRefreshOutline size={18} /> Gerar Acerto</>
                }
              </button>
            </div>

            {/* Resultado */}
            {acertoAtual && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Cabeçalho do acerto */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-5 text-white">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                        <FaMotorcycle size={18} />
                      </div>
                      <div>
                        <p className="font-black text-lg">{acertoAtual.motoboyNome}</p>
                        <p className="text-blue-100 text-xs">
                          {format(new Date(dataInicio), 'dd/MM/yyyy')} até {format(new Date(dataFim), 'dd/MM/yyyy')}
                        </p>
                      </div>
                    </div>
                    {acertoAtual.pago ? (
                      <span className="flex items-center gap-1.5 bg-emerald-500 text-white px-3 py-1.5 rounded-full text-xs font-black">
                        <IoCheckmarkCircle size={16} /> PAGO
                      </span>
                    ) : (
                      <button
                        onClick={() => handleMarcarPago(acertoAtual.acertoId)}
                        disabled={loadingPagar}
                        className="flex items-center gap-1.5 bg-white text-blue-700 px-4 py-2 rounded-xl text-sm font-black hover:bg-blue-50 transition-colors disabled:opacity-50"
                      >
                        <IoCashOutline size={16} /> Marcar como Pago
                      </button>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-white/15 rounded-xl p-3 text-center">
                      <p className="text-blue-100 text-xs font-medium">Total de Entregas</p>
                      <p className="text-2xl font-black">{acertoAtual.totalEntregas}</p>
                    </div>
                    <div className="bg-white/15 rounded-xl p-3 text-center">
                      <p className="text-blue-100 text-xs font-medium">Valor a Pagar</p>
                      <p className="text-2xl font-black">{fmtBRL(acertoAtual.totalValor)}</p>
                    </div>
                  </div>
                </div>

                {/* Tabela de entregas */}
                {acertoAtual.pedidos && acertoAtual.pedidos.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase">Data</th>
                          <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase">Cliente</th>
                          <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase">Endereço</th>
                          <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase">Pagamento</th>
                          <th className="px-4 py-3 text-right text-xs font-black text-slate-500 uppercase">Valor Pedido</th>
                          <th className="px-4 py-3 text-right text-xs font-black text-slate-500 uppercase">Taxa Entrega</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {acertoAtual.pedidos.map((p, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{fmtData(p.dataEntrega)}</td>
                            <td className="px-4 py-3 text-sm font-medium text-slate-800">{p.clienteNome}</td>
                            <td className="px-4 py-3 text-sm text-slate-500 max-w-[160px] truncate">{p.enderecoEntrega || '-'}</td>
                            <td className="px-4 py-3 text-sm text-slate-500">{p.formaPagamento || '-'}</td>
                            <td className="px-4 py-3 text-sm font-bold text-slate-800 text-right">{fmtBRL(p.totalPedido)}</td>
                            <td className="px-4 py-3 text-sm font-black text-blue-700 text-right">{fmtBRL(p.taxaEntrega)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-blue-50 border-t-2 border-blue-200">
                          <td colSpan={4} className="px-4 py-3 text-sm font-black text-blue-800">
                            TOTAL ({acertoAtual.totalEntregas} entregas)
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-black text-slate-800">
                            {fmtBRL(acertoAtual.pedidos.reduce((a, p) => a + (p.totalPedido || 0), 0))}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-black text-blue-700">
                            {fmtBRL(acertoAtual.totalValor)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400">
                    <FaMotorcycle size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="font-medium">Nenhuma entrega encontrada neste período.</p>
                  </div>
                )}

                {/* Info PIX */}
                {motoboyAtual?.pixKey && (
                  <div className="bg-emerald-50 border-t border-emerald-100 p-4 flex items-center gap-2">
                    <IoCashOutline className="text-emerald-600" size={18} />
                    <span className="text-sm text-emerald-800">
                      <strong>Chave PIX:</strong> {motoboyAtual.pixKey}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ABA: HISTÓRICO */}
        {abaAtiva === 'historico' && (
          <div className="space-y-3">
            {historico.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
                <IoDocumentTextOutline size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhum acerto gerado ainda.</p>
              </div>
            ) : (
              historico.map(acerto => (
                <div key={acerto.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                        <FaMotorcycle className="text-blue-600" size={14} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{acerto.motoboyNome}</p>
                        <p className="text-xs text-slate-500">{acerto.periodo_str}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">{acerto.totalEntregas} entregas</p>
                        <p className="font-black text-slate-800">{fmtBRL(acerto.totalValor)}</p>
                      </div>
                      {acerto.pago ? (
                        <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-black">
                          <IoCheckmarkCircle size={14} /> Pago
                        </span>
                      ) : (
                        <button
                          onClick={() => handleMarcarPago(acerto.id)}
                          disabled={loadingPagar}
                          className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-full text-xs font-black hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          <IoCashOutline size={14} /> Marcar Pago
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mini-tabela do histórico */}
                  {Array.isArray(acerto.pedidos) && acerto.pedidos.length > 0 && (
                    <div className="border-t border-slate-100 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="px-3 py-2 text-left text-slate-400 font-bold">Data</th>
                            <th className="px-3 py-2 text-left text-slate-400 font-bold">Cliente</th>
                            <th className="px-3 py-2 text-right text-slate-400 font-bold">Taxa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {acerto.pedidos.slice(0, 5).map((p, i) => (
                            <tr key={i}>
                              <td className="px-3 py-1.5 text-slate-500">{fmtData(p.dataEntrega)}</td>
                              <td className="px-3 py-1.5 text-slate-700">{p.clienteNome}</td>
                              <td className="px-3 py-1.5 text-right font-bold text-blue-700">{fmtBRL(p.taxaEntrega)}</td>
                            </tr>
                          ))}
                          {acerto.pedidos.length > 5 && (
                            <tr>
                              <td colSpan={3} className="px-3 py-1.5 text-center text-slate-400 italic">
                                + {acerto.pedidos.length - 5} entregas...
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default withEstablishmentAuth(AcertoMotoboys);
