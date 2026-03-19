// src/pages/admin/PrevisaoDemanda.jsx — Previsão de Demanda com dados históricos
import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import { Link } from 'react-router-dom';
import { subDays, format, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { IoArrowBack, IoTrendingUpOutline, IoFlameOutline, IoCalendarOutline, IoAlertCircleOutline } from 'react-icons/io5';

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function PrevisaoDemanda() {
  const { userData } = useAuth();
  const estabId = userData?.estabelecimentosGerenciados?.[0];
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!estabId) return;
    const fetch = async () => {
      const snap = await getDocs(collection(db, 'estabelecimentos', estabId, 'pedidos'));
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => {
        const dt = p.createdAt?.toDate?.() || (p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : null);
        return dt && p.status !== 'cancelado';
      }).map(p => ({
        ...p,
        _date: p.createdAt?.toDate?.() || new Date(p.createdAt.seconds * 1000)
      }));
      setPedidos(lista);
      setLoading(false);
    };
    fetch();
  }, [estabId]);

  // Análise por dia da semana
  const analise = useMemo(() => {
    if (pedidos.length === 0) return null;

    // Últimos 30 dias
    const agora = new Date();
    const ultimos30 = pedidos.filter(p => p._date >= subDays(agora, 30));
    const ultimos90 = pedidos.filter(p => p._date >= subDays(agora, 90));

    // Pedidos por dia da semana
    const porDia = {};
    DIAS_SEMANA.forEach((d, i) => { porDia[i] = { nome: d, pedidos: 0, faturamento: 0, count: 0 }; });

    ultimos90.forEach(p => {
      const dia = getDay(p._date);
      porDia[dia].pedidos++;
      porDia[dia].faturamento += Number(p.totalFinal) || 0;
    });

    // Quantas semanas no período
    const semanas = Math.max(1, Math.ceil(90 / 7));
    Object.values(porDia).forEach(d => {
      d.media = Math.round(d.pedidos / semanas);
      d.faturamentoMedio = d.faturamento / semanas;
    });

    // Dia mais movimentado
    const diaMaisMovimentado = Object.values(porDia).sort((a, b) => b.pedidos - a.pedidos)[0];

    // Produtos mais vendidos
    const prodCount = {};
    ultimos30.forEach(p => {
      (p.itens || []).forEach(item => {
        const nome = item.nome || 'Desconhecido';
        if (!prodCount[nome]) prodCount[nome] = { nome, qtd: 0, faturamento: 0 };
        prodCount[nome].qtd += Number(item.quantidade || item.qtd) || 1;
        prodCount[nome].faturamento += (Number(item.preco) || 0) * (Number(item.quantidade || item.qtd) || 1);
      });
    });
    const topProdutos = Object.values(prodCount).sort((a, b) => b.qtd - a.qtd).slice(0, 10);

    // Previsão para amanhã e próximos 7 dias
    const previsao = [];
    for (let i = 1; i <= 7; i++) {
      const futuro = new Date();
      futuro.setDate(futuro.getDate() + i);
      const dia = getDay(futuro);
      const mediaDia = porDia[dia];
      previsao.push({
        data: futuro,
        dia: DIAS_SEMANA[dia],
        dataFormatada: format(futuro, "dd/MM (EEE)", { locale: ptBR }),
        pedidosPrevistos: mediaDia.media,
        faturamentoPrevisto: mediaDia.faturamentoMedio
      });
    }

    // Alertas
    const alertas = [];
    const amanha = previsao[0];
    if (amanha.pedidosPrevistos > (ultimos30.length / 30) * 1.5) {
      alertas.push(`⚠️ ${amanha.dia} costuma ter ${amanha.pedidosPrevistos} pedidos — prepare mais ingredientes!`);
    }

    // Tendência
    const primeiro15 = ultimos30.filter(p => p._date.getDate() <= 15).length;
    const ultimo15 = ultimos30.filter(p => p._date.getDate() > 15).length;
    const tendencia = ultimo15 > primeiro15 ? 'alta' : ultimo15 < primeiro15 ? 'queda' : 'estável';

    return { porDia, diaMaisMovimentado, topProdutos, previsao, alertas, tendencia, total30: ultimos30.length };
  }, [pedidos]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-6 font-sans pb-20">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/dashboard" className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 shadow-sm">
            <IoArrowBack size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <IoTrendingUpOutline className="text-blue-500" /> Previsão de Demanda
            </h1>
            <p className="text-xs text-gray-400 font-medium">Baseado nos últimos 90 dias de pedidos</p>
          </div>
        </div>

        {!analise ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
            <IoCalendarOutline className="text-5xl text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-bold">Sem dados suficientes</p>
            <p className="text-gray-400 text-sm">Aguarde alguns dias de operação para ver previsões</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Pedidos (30d)</p>
                <p className="text-2xl font-black text-gray-900">{analise.total30}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Média/Dia</p>
                <p className="text-2xl font-black text-blue-600">{Math.round(analise.total30 / 30)}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Dia Forte</p>
                <p className="text-lg font-black text-amber-600">{analise.diaMaisMovimentado.nome}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Tendência</p>
                <p className={`text-lg font-black ${analise.tendencia === 'alta' ? 'text-emerald-600' : analise.tendencia === 'queda' ? 'text-red-500' : 'text-gray-600'}`}>
                  {analise.tendencia === 'alta' ? '📈 Alta' : analise.tendencia === 'queda' ? '📉 Queda' : '➡️ Estável'}
                </p>
              </div>
            </div>

            {/* Alertas */}
            {analise.alertas.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
                {analise.alertas.map((a, i) => (
                  <p key={i} className="text-sm text-amber-800 font-bold flex items-center gap-2">
                    <IoAlertCircleOutline className="text-amber-500 shrink-0" /> {a}
                  </p>
                ))}
              </div>
            )}

            {/* Previsão 7 dias */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
              <h3 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
                <IoCalendarOutline className="text-blue-500" /> Previsão dos próximos 7 dias
              </h3>
              <div className="space-y-2">
                {analise.previsao.map((dia, i) => {
                  const maxPedidos = Math.max(...analise.previsao.map(d => d.pedidosPrevistos), 1);
                  const pct = (dia.pedidosPrevistos / maxPedidos) * 100;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-600 w-28 shrink-0">{dia.dataFormatada}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all" style={{ width: `${Math.max(pct, 8)}%` }} />
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white z-10">
                          ~{dia.pedidosPrevistos} pedidos
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 w-20 text-right">
                        ~R$ {dia.faturamentoPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Demanda por dia da semana */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
              <h3 className="text-sm font-black text-gray-800 mb-4">📊 Demanda por dia da semana</h3>
              <div className="space-y-2">
                {Object.values(analise.porDia).map(dia => {
                  const max = Math.max(...Object.values(analise.porDia).map(d => d.pedidos), 1);
                  const pct = (dia.pedidos / max) * 100;
                  const isBest = dia.nome === analise.diaMaisMovimentado.nome;
                  return (
                    <div key={dia.nome} className="flex items-center gap-3">
                      <span className={`text-xs font-bold w-20 shrink-0 ${isBest ? 'text-amber-600' : 'text-gray-600'}`}>
                        {isBest && '🔥 '}{dia.nome}
                      </span>
                      <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                        <div className={`absolute inset-y-0 left-0 rounded-full ${isBest ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-gray-300 to-gray-400'}`} style={{ width: `${Math.max(pct, 5)}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-gray-500 w-16 text-right">{dia.pedidos} ped.</span>
                      <span className="text-[10px] font-bold text-gray-400 w-10 text-right">~{dia.media}/sem</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Produtos */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
                <IoFlameOutline className="text-orange-500" /> Top 10 mais vendidos (30 dias)
              </h3>
              <div className="space-y-2">
                {analise.topProdutos.map((prod, i) => (
                  <div key={prod.nome} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${i < 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm font-bold text-gray-800 truncate">{prod.nome}</span>
                    <span className="text-xs font-bold text-blue-600">{prod.qtd}x</span>
                    <span className="text-xs font-bold text-emerald-600 w-20 text-right">R$ {prod.faturamento.toLocaleString('pt-BR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default withEstablishmentAuth(PrevisaoDemanda);
