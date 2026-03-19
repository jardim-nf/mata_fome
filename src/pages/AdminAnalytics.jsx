// src/pages/AdminAnalytics.jsx — BI AVANÇADO COM DADOS REAIS
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, where, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import {
    IoArrowBack, IoTrendingUp, IoTrendingDown, IoAlertCircle,
    IoCash, IoStatsChart, IoCart, IoRestaurant,
    IoCalendarOutline, IoTimeOutline, IoCardOutline,
    IoPodiumOutline, IoBicycle, IoStorefront
} from 'react-icons/io5';

// ── HELPERS ──
const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const pct = (v) => `${(v || 0).toFixed(1)}%`;
const hojeStr = () => { const h = new Date(); return h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') + '-' + String(h.getDate()).padStart(2, '0'); };
const semanaAtrasStr = () => { const d = new Date(); d.setDate(d.getDate() - 7); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

// ── KPI CARD ──
const KpiCard = ({ titulo, valor, sub, icon: Icon, cor, variacao, loading }) => {
    const cores = {
        green: 'bg-emerald-50 text-emerald-600', blue: 'bg-blue-50 text-blue-600',
        purple: 'bg-purple-50 text-purple-600', orange: 'bg-orange-50 text-orange-600'
    };
    return (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
            <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10 ${cores[cor]?.split(' ')[0]}`} />
            <div className="flex justify-between items-start mb-2 relative z-10">
                <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{titulo}</p>
                    {loading ? <div className="h-8 w-24 bg-gray-100 rounded-lg animate-pulse" /> :
                        <h3 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">{valor}</h3>}
                </div>
                <div className={`p-2.5 rounded-2xl shrink-0 ${cores[cor]}`}><Icon size={22} /></div>
            </div>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-50 relative z-10">
                {variacao !== undefined && !loading && (
                    <span className={`flex items-center gap-0.5 text-xs font-bold ${variacao >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {variacao >= 0 ? <IoTrendingUp size={14} /> : <IoTrendingDown size={14} />}
                        {variacao >= 0 ? '+' : ''}{variacao.toFixed(1)}%
                    </span>
                )}
                <span className="text-[10px] text-gray-500 font-medium">{sub}</span>
            </div>
        </div>
    );
};

// ── MINI BAR CHART (CSS PURO) ──
const MiniBarChart = ({ dados, labelKey, valueKey, cor = 'bg-blue-500', maxAlt = 120 }) => {
    const maxVal = Math.max(...dados.map(d => d[valueKey]), 1);
    return (
        <div className="flex items-end gap-1.5 sm:gap-2 w-full" style={{ height: maxAlt }}>
            {dados.map((d, i) => {
                const h = Math.max((d[valueKey] / maxVal) * maxAlt, 4);
                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                        {/* Tooltip */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] font-bold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                            {fmt(d[valueKey])}
                        </div>
                        <div className={`w-full rounded-t-md ${cor} transition-all duration-300 group-hover:opacity-80`} style={{ height: h }} />
                        <span className="text-[8px] sm:text-[9px] font-bold text-gray-400 leading-none">{d[labelKey]}</span>
                    </div>
                );
            })}
        </div>
    );
};

// ── HORIZONTAL BAR ──
const HBar = ({ label, valor, maxValor, formatado, cor = 'bg-blue-500', sub }) => {
    const w = maxValor > 0 ? (valor / maxValor) * 100 : 0;
    return (
        <div className="flex items-center gap-3 py-2">
            <span className="text-xs font-bold text-gray-600 w-20 sm:w-28 shrink-0 text-right">{label}</span>
            <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${cor} transition-all duration-500`} style={{ width: `${w}%` }} />
            </div>
            <div className="text-right shrink-0 min-w-[70px]">
                <span className="text-xs font-black text-gray-800">{formatado}</span>
                {sub && <p className="text-[9px] text-gray-400">{sub}</p>}
            </div>
        </div>
    );
};

// ══════════════ COMPONENTE PRINCIPAL ══════════════
function AdminAnalytics() {
    const { userData } = useAuth();
    const [loading, setLoading] = useState(true);

    const [dataInicio, setDataInicio] = useState(semanaAtrasStr());
    const [dataFim, setDataFim] = useState(hojeStr());
    const [nomeEstab, setNomeEstab] = useState('');

    const [pedidosDelivery, setPedidosDelivery] = useState([]);
    const [vendasSalao, setVendasSalao] = useState([]);

    const estabId = useMemo(() =>
        userData?.estabelecimentosGerenciados?.[0] || userData?.estabelecimentos?.[0] || userData?.estabelecimentoId || null
    , [userData]);

    // ── BUSCAR NOME ──
    useEffect(() => {
        if (!estabId) return;
        getDoc(doc(db, 'estabelecimentos', estabId)).then(snap => {
            if (snap.exists()) setNomeEstab(snap.data().nome || '');
        }).catch(() => {});
    }, [estabId]);

    // ── QUERIES FIREBASE ──
    useEffect(() => {
        if (!estabId || !dataInicio || !dataFim) return;
        setLoading(true);

        const start = new Date(`${dataInicio}T00:00:00`);
        const end = new Date(`${dataFim}T23:59:59.999`);

        const qDel = query(collection(db, 'pedidos'),
            where('estabelecimentoId', '==', estabId),
            where('createdAt', '>=', start), where('createdAt', '<=', end)
        );
        const unDel = onSnapshot(qDel, snap => setPedidosDelivery(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const qSal = query(collection(db, 'estabelecimentos', estabId, 'vendas'),
            where('criadoEm', '>=', start), where('criadoEm', '<=', end)
        );
        const unSal = onSnapshot(qSal, snap => {
            setVendasSalao(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });

        return () => { unDel(); unSal(); };
    }, [estabId, dataInicio, dataFim]);

    // ── PARSE VALOR SEGURO ──
    const parse = (v) => parseFloat(String(v || 0).replace(/[R$\s]/g, '').replace(',', '.')) || 0;

    // ── PERÍODO ANTERIOR (p/ comparativo) ──
    const diasPeriodo = useMemo(() => {
        const d1 = new Date(dataInicio), d2 = new Date(dataFim);
        return Math.max(Math.round((d2 - d1) / 86400000) + 1, 1);
    }, [dataInicio, dataFim]);

    // ── STATS CALCULADOS ──
    const stats = useMemo(() => {
        const delOk = pedidosDelivery.filter(p => p.status !== 'cancelado');
        const salOk = vendasSalao.filter(v => v.status !== 'cancelado');

        let fatDel = 0, fatSal = 0;
        delOk.forEach(p => fatDel += parse(p.totalFinal || p.total || p.valorTotal));
        salOk.forEach(v => fatSal += parse(v.totalFinal || v.total || v.valorTotal));

        const totalPedidos = delOk.length + salOk.length;
        const fatTotal = fatDel + fatSal;
        const ticketMedio = totalPedidos > 0 ? fatTotal / totalPedidos : 0;

        // Formas de pagamento
        const formas = {};
        [...delOk, ...salOk].forEach(p => {
            let fp = p.formaPagamento || p.forma_pagamento || p.paymentMethod || 'outro';
            fp = fp.toLowerCase().replace(/[áàã]/g, 'a').replace(/[éèê]/g, 'e').replace(/[íì]/g, 'i');
            if (fp.includes('pix')) fp = 'PIX';
            else if (fp.includes('cred') || fp === 'credit_card') fp = 'Crédito';
            else if (fp.includes('deb') || fp === 'debit_card') fp = 'Débito';
            else if (fp.includes('dinh') || fp === 'cash') fp = 'Dinheiro';
            else fp = fp.charAt(0).toUpperCase() + fp.slice(1);

            if (!formas[fp]) formas[fp] = { qtd: 0, valor: 0 };
            formas[fp].qtd++;
            formas[fp].valor += parse(p.totalFinal || p.total || p.valorTotal);
        });

        // Horário de pico
        const horas = Array.from({ length: 24 }, (_, i) => ({ hora: i, qtd: 0 }));
        [...delOk, ...salOk].forEach(p => {
            const ts = p.createdAt || p.criadoEm;
            if (!ts) return;
            const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
            horas[d.getHours()].qtd++;
        });

        // Faturamento por dia
        const porDia = {};
        const processaDia = (lista, campoData) => {
            lista.forEach(p => {
                const ts = p[campoData];
                if (!ts) return;
                const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
                const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (!porDia[key]) porDia[key] = 0;
                porDia[key] += parse(p.totalFinal || p.total || p.valorTotal);
            });
        };
        processaDia(delOk, 'createdAt');
        processaDia(salOk, 'criadoEm');

        // Ordenar por data
        const diasChart = Object.entries(porDia)
            .map(([dia, valor]) => ({ dia, valor }))
            .sort((a, b) => {
                const [dA, mA] = a.dia.split('/').map(Number);
                const [dB, mB] = b.dia.split('/').map(Number);
                return mA !== mB ? mA - mB : dA - dB;
            });

        // Top produtos
        const produtos = {};
        const extrairItens = (lista) => {
            lista.forEach(p => {
                (p.itens || p.items || []).forEach(item => {
                    const nome = item.nome || item.name || 'Sem nome';
                    const qtd = item.quantidade || item.quantity || item.qtd || 1;
                    const val = parse(item.precoUnitario || item.preco || item.valor || item.price) * qtd;
                    if (!produtos[nome]) produtos[nome] = { nome, qtd: 0, valor: 0 };
                    produtos[nome].qtd += qtd;
                    produtos[nome].valor += val;
                });
            });
        };
        extrairItens(delOk);
        extrairItens(salOk);

        const topProdutos = Object.values(produtos).sort((a, b) => b.qtd - a.qtd).slice(0, 10);

        return {
            fatTotal, fatDel, fatSal, totalPedidos,
            qtdDel: delOk.length, qtdSal: salOk.length,
            ticketMedio, formas, horas, diasChart, topProdutos,
            ticketDel: delOk.length > 0 ? fatDel / delOk.length : 0,
            ticketSal: salOk.length > 0 ? fatSal / salOk.length : 0,
        };
    }, [pedidosDelivery, vendasSalao]);

    // ── FORMAS DE PAGAMENTO ORDENADAS ──
    const formasOrdenadas = useMemo(() =>
        Object.entries(stats.formas).map(([nome, d]) => ({ nome, ...d })).sort((a, b) => b.valor - a.valor)
    , [stats.formas]);

    const maxFormaValor = formasOrdenadas.length > 0 ? formasOrdenadas[0].valor : 1;

    // ── HORÁRIO DE PICO (top 3) ──
    const horasComDados = useMemo(() => {
        const comDados = stats.horas.filter(h => h.qtd > 0);
        const sorted = [...comDados].sort((a, b) => b.qtd - a.qtd);
        const top3 = new Set(sorted.slice(0, 3).map(h => h.hora));
        return { horas: comDados.length > 0 ? stats.horas : [], top3, maxQtd: sorted[0]?.qtd || 1 };
    }, [stats.horas]);

    // ── LOADING / SEM ESTAB ──
    if (!estabId) return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-sm border p-8 max-w-md text-center">
                <IoAlertCircle className="text-red-500 text-4xl mx-auto mb-3" />
                <h2 className="text-xl font-bold text-gray-900 mb-2">Sem Estabelecimento</h2>
                <p className="text-gray-600 mb-4">Nenhum estabelecimento vinculado.</p>
                <Link to="/admin-dashboard" className="inline-flex items-center gap-2 bg-blue-600 text-white font-bold py-3 px-6 rounded-xl"><IoArrowBack /> Voltar</Link>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-3 sm:p-6 font-sans pb-20">
            <div className="max-w-[1400px] mx-auto space-y-6">

                {/* ═══ HEADER ═══ */}
                <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link to="/admin-dashboard" className="p-2.5 rounded-xl hover:bg-white text-gray-600 border border-gray-200 transition-colors bg-white shadow-sm">
                            <IoArrowBack size={18} />
                        </Link>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Relatórios & BI</h1>
                            <p className="text-xs text-gray-500 font-medium">{nomeEstab || 'Carregando...'} • Dados em tempo real</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                            <span className="text-[10px] font-black text-gray-400 mr-2 uppercase">De</span>
                            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="bg-transparent text-xs font-bold text-gray-700 outline-none" />
                        </div>
                        <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                            <span className="text-[10px] font-black text-gray-400 mr-2 uppercase">Até</span>
                            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="bg-transparent text-xs font-bold text-gray-700 outline-none" />
                        </div>
                        <button onClick={() => { setDataInicio(hojeStr()); setDataFim(hojeStr()); }}
                            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 shadow-sm transition-all">
                            Hoje
                        </button>
                        <button onClick={() => { setDataInicio(semanaAtrasStr()); setDataFim(hojeStr()); }}
                            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 shadow-sm transition-all">
                            7 dias
                        </button>
                        <button onClick={() => { const d = new Date(); d.setDate(d.getDate() - 30); setDataInicio(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')); setDataFim(hojeStr()); }}
                            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 shadow-sm transition-all">
                            30 dias
                        </button>
                    </div>
                </header>

                {/* ═══ KPIs ═══ */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
                    <KpiCard titulo="Faturamento" valor={fmt(stats.fatTotal)} sub={`${stats.totalPedidos} pedidos`} icon={IoCash} cor="green" loading={loading} />
                    <KpiCard titulo="Ticket Médio" valor={fmt(stats.ticketMedio)} sub="por pedido" icon={IoStatsChart} cor="purple" loading={loading} />
                    <KpiCard titulo="Delivery" valor={fmt(stats.fatDel)} sub={`${stats.qtdDel} pedidos`} icon={IoCart} cor="blue" loading={loading} />
                    <KpiCard titulo="Salão" valor={fmt(stats.fatSal)} sub={`${stats.qtdSal} vendas`} icon={IoRestaurant} cor="orange" loading={loading} />
                </div>

                {/* ═══ GRÁFICO FATURAMENTO POR DIA ═══ */}
                {!loading && stats.diasChart.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-sm font-black text-gray-800 flex items-center gap-2">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><IoStatsChart size={18} /></div>
                                Faturamento por Dia
                            </h2>
                            <span className="text-[10px] font-bold text-gray-400 uppercase">{stats.diasChart.length} dias</span>
                        </div>
                        <MiniBarChart dados={stats.diasChart} labelKey="dia" valueKey="valor" cor="bg-blue-500" maxAlt={130} />
                    </div>
                )}

                {/* ═══ GRID: HORÁRIO DE PICO + FORMAS DE PAGAMENTO ═══ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                    {/* HORÁRIO DE PICO */}
                    {!loading && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <h2 className="text-sm font-black text-gray-800 flex items-center gap-2 mb-5">
                                <div className="p-2 bg-orange-50 text-orange-600 rounded-xl"><IoTimeOutline size={18} /></div>
                                Horário de Pico
                            </h2>
                            <div className="space-y-1">
                                {stats.horas.filter(h => h.qtd > 0).sort((a, b) => b.qtd - a.qtd).slice(0, 8).map(h => (
                                    <HBar
                                        key={h.hora}
                                        label={`${String(h.hora).padStart(2, '0')}:00`}
                                        valor={h.qtd}
                                        maxValor={horasComDados.maxQtd}
                                        formatado={`${h.qtd} pedidos`}
                                        cor={horasComDados.top3.has(h.hora) ? 'bg-orange-500' : 'bg-orange-200'}
                                    />
                                ))}
                                {stats.horas.every(h => h.qtd === 0) && (
                                    <p className="text-center text-gray-400 text-sm py-8">Sem dados de horário</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* FORMAS DE PAGAMENTO */}
                    {!loading && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <h2 className="text-sm font-black text-gray-800 flex items-center gap-2 mb-5">
                                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl"><IoCardOutline size={18} /></div>
                                Formas de Pagamento
                            </h2>
                            <div className="space-y-1">
                                {formasOrdenadas.map(f => (
                                    <HBar
                                        key={f.nome}
                                        label={f.nome}
                                        valor={f.valor}
                                        maxValor={maxFormaValor}
                                        formatado={fmt(f.valor)}
                                        sub={`${f.qtd} pedidos`}
                                        cor={f.nome === 'PIX' ? 'bg-emerald-500' : f.nome === 'Crédito' ? 'bg-blue-500' : f.nome === 'Débito' ? 'bg-purple-500' : f.nome === 'Dinheiro' ? 'bg-amber-500' : 'bg-gray-400'}
                                    />
                                ))}
                                {formasOrdenadas.length === 0 && (
                                    <p className="text-center text-gray-400 text-sm py-8">Sem dados de pagamento</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ═══ GRID: TOP PRODUTOS + DELIVERY vs SALÃO ═══ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                    {/* TOP 10 PRODUTOS */}
                    {!loading && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <h2 className="text-sm font-black text-gray-800 flex items-center gap-2 mb-5">
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><IoPodiumOutline size={18} /></div>
                                Top 10 Mais Vendidos
                            </h2>
                            <div className="space-y-2.5">
                                {stats.topProdutos.length > 0 ? stats.topProdutos.map((prod, i) => {
                                    const maxQtd = stats.topProdutos[0].qtd;
                                    const w = (prod.qtd / maxQtd) * 100;
                                    return (
                                        <div key={prod.nome} className="flex items-center gap-3">
                                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${i < 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {i + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className="text-xs font-bold text-gray-800 truncate">{prod.nome}</span>
                                                    <span className="text-[10px] font-black text-gray-500 shrink-0 ml-2">{prod.qtd}x</span>
                                                </div>
                                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${w}%` }} />
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-black text-gray-600 shrink-0 w-16 text-right">{fmt(prod.valor)}</span>
                                        </div>
                                    );
                                }) : (
                                    <p className="text-center text-gray-400 text-sm py-8">Sem dados de produtos</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* DELIVERY vs SALÃO */}
                    {!loading && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <h2 className="text-sm font-black text-gray-800 flex items-center gap-2 mb-5">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><IoStorefront size={18} /></div>
                                Delivery vs Salão
                            </h2>

                            <div className="grid grid-cols-2 gap-4">
                                {/* DELIVERY */}
                                <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><IoBicycle size={16} /></div>
                                        <span className="text-xs font-black text-blue-800">Delivery</span>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-[9px] font-bold text-blue-400 uppercase">Faturamento</p>
                                            <p className="text-lg font-black text-blue-900">{fmt(stats.fatDel)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold text-blue-400 uppercase">Pedidos</p>
                                            <p className="text-lg font-black text-blue-900">{stats.qtdDel}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold text-blue-400 uppercase">Ticket Médio</p>
                                            <p className="text-lg font-black text-blue-900">{fmt(stats.ticketDel)}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* SALÃO */}
                                <div className="bg-orange-50/50 rounded-2xl p-4 border border-orange-100">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-2 bg-orange-100 text-orange-600 rounded-xl"><IoRestaurant size={16} /></div>
                                        <span className="text-xs font-black text-orange-800">Salão</span>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-[9px] font-bold text-orange-400 uppercase">Faturamento</p>
                                            <p className="text-lg font-black text-orange-900">{fmt(stats.fatSal)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold text-orange-400 uppercase">Vendas</p>
                                            <p className="text-lg font-black text-orange-900">{stats.qtdSal}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold text-orange-400 uppercase">Ticket Médio</p>
                                            <p className="text-lg font-black text-orange-900">{fmt(stats.ticketSal)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* BARRA COMPARATIVA */}
                            {stats.totalPedidos > 0 && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <p className="text-[9px] font-black text-gray-400 uppercase mb-2">Proporção do faturamento</p>
                                    <div className="flex h-3 rounded-full overflow-hidden">
                                        <div className="bg-blue-500 transition-all duration-500" style={{ width: `${stats.fatTotal > 0 ? (stats.fatDel / stats.fatTotal * 100) : 50}%` }} />
                                        <div className="bg-orange-500 transition-all duration-500" style={{ width: `${stats.fatTotal > 0 ? (stats.fatSal / stats.fatTotal * 100) : 50}%` }} />
                                    </div>
                                    <div className="flex justify-between mt-1">
                                        <span className="text-[10px] font-bold text-blue-600">{stats.fatTotal > 0 ? pct(stats.fatDel / stats.fatTotal * 100) : '0%'} Delivery</span>
                                        <span className="text-[10px] font-bold text-orange-600">{stats.fatTotal > 0 ? pct(stats.fatSal / stats.fatTotal * 100) : '0%'} Salão</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

export default AdminAnalytics;