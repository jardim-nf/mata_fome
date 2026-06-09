// src/pages/AdminAnalytics.jsx — BI AVANÇADO COM DADOS REAIS REDESENHADO
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAdminAnalyticsData, hojeStr, semanaAtrasStr } from '../hooks/useAdminAnalyticsData';
import {
    IoTrendingUp, IoTrendingDown, IoAlertCircle,
    IoCash, IoStatsChart, IoCart, IoRestaurant,
    IoCalendarOutline, IoTimeOutline, IoCardOutline,
    IoPodiumOutline, IoBicycle, IoStorefront
} from 'react-icons/io5';
import BackButton from '../components/BackButton';

// ── HELPERS ──
const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const pct = (v) => `${(v || 0).toFixed(1)}%`;

// ── KPI CARD (Bento & Glassmorphic) ──
const KpiCard = ({ titulo, valor, sub, icon: Icon, cor, variacao, loading }) => {
    const cores = {
        green: {
            bg: 'bg-emerald-50 text-emerald-600',
            glow: 'bg-emerald-200',
            grad: 'from-emerald-400 to-teal-500 text-white'
        },
        blue: {
            bg: 'bg-blue-50 text-blue-600',
            glow: 'bg-blue-200',
            grad: 'from-blue-400 to-indigo-500 text-white'
        },
        purple: {
            bg: 'bg-purple-50 text-purple-600',
            glow: 'bg-purple-200',
            grad: 'from-purple-400 to-indigo-600 text-white'
        },
        orange: {
            bg: 'bg-orange-50 text-orange-600',
            glow: 'bg-orange-200',
            grad: 'from-orange-400 to-red-500 text-white'
        }
    };

    return (
        <div className="group bg-white/70 border border-slate-150/40 rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02] relative overflow-hidden flex flex-col justify-between">
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl transform translate-x-8 -translate-y-8 group-hover:scale-150 transition-transform duration-700 ${cores[cor]?.glow || 'bg-slate-200'} opacity-35`}></div>
            <div className="flex justify-between items-start mb-2 relative z-10">
                <div>
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">{titulo}</p>
                    {loading ? (
                        <div className="h-8 w-24 bg-slate-100 rounded-lg animate-pulse" />
                    ) : (
                        <h3 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{valor}</h3>
                    )}
                </div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-md bg-gradient-to-br ${cores[cor]?.grad || 'from-slate-400 to-slate-500 text-white'}`}>
                    <Icon className="text-xl" />
                </div>
            </div>
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100/50 relative z-10">
                {variacao !== undefined && !loading && (
                    <span className={`flex items-center gap-0.5 text-xs font-black ${variacao >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {variacao >= 0 ? <IoTrendingUp size={14} /> : <IoTrendingDown size={14} />}
                        {variacao >= 0 ? '+' : ''}{variacao.toFixed(1)}%
                    </span>
                )}
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{sub}</span>
            </div>
        </div>
    );
};

// ── MINI BAR CHART (Vertical, Bento Custom Tooltip) ──
const MiniBarChart = ({ dados, labelKey, valueKey, maxAlt = 120 }) => {
    const maxVal = Math.max(...dados.map(d => d[valueKey]), 1);
    return (
        <div className="flex items-end gap-1.5 sm:gap-2.5 w-full pt-6" style={{ height: maxAlt + 24 }}>
            {dados.map((d, i) => {
                const h = Math.max((d[valueKey] / maxVal) * maxAlt, 6);
                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
                        {/* Tooltip Glassmorphic */}
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[10px] font-black px-2.5 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-250 scale-90 group-hover:scale-100 shadow-lg border border-white/10 z-20 pointer-events-none">
                            {fmt(d[valueKey])}
                        </div>
                        {/* Bar Gradient */}
                        <div className="w-full rounded-t-lg bg-gradient-to-t from-blue-500 to-cyan-400 hover:from-amber-400 hover:to-amber-500 transition-all duration-300 shadow-sm group-hover:shadow-md cursor-pointer" style={{ height: h }} />
                        <span className="text-[9px] font-black text-slate-400 leading-none tracking-tight">{d[labelKey]}</span>
                    </div>
                );
            })}
        </div>
    );
};

// ── HORIZONTAL BAR (Bento Item) ──
const HBar = ({ label, valor, maxValor, formatado, cor = 'bg-blue-500', sub }) => {
    const w = maxValor > 0 ? (valor / maxValor) * 100 : 0;
    return (
        <div className="flex items-center gap-3 py-3 group">
            <span className="text-xs font-black text-slate-500 w-20 sm:w-28 shrink-0 text-right truncate" title={label}>{label}</span>
            <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-150/30">
                <div className={`h-full rounded-full ${cor} transition-all duration-500 shadow-sm`} style={{ width: `${w}%` }} />
            </div>
            <div className="text-right shrink-0 min-w-[80px]">
                <span className="text-xs font-black text-slate-800">{formatado}</span>
                {sub && <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-tight">{sub}</p>}
            </div>
        </div>
    );
};

// ══════════════ COMPONENTE PRINCIPAL ══════════════
function AdminAnalytics() {
    const { userData, estabelecimentoIdPrincipal } = useAuth();
    const estabId = useMemo(() =>
        estabelecimentoIdPrincipal || userData?.estabelecimentoId || null
    , [userData, estabelecimentoIdPrincipal]);

    const {
        loading,
        dataInicio, setDataInicio,
        dataFim, setDataFim,
        nomeEstab,
        stats,
        formasOrdenadas,
        maxFormaValor,
        horasComDados
    } = useAdminAnalyticsData(estabId);

    // Filter/Search states (for neighborhoods/products if requested)
    const [searchTerm, setSearchTerm] = useState('');

    // ── LOADING / SEM ESTAB ──
    if (!estabId) return (
        <div className="min-h-screen bg-gradient-to-br from-[#f6f8fa] via-[#eef2f6] to-[#f6f8fa] flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-blue-400/5 rounded-full blur-[140px] pointer-events-none"></div>
            <div className="bg-white/70 border border-slate-150/40 rounded-[2.5rem] p-8 max-w-md text-center shadow-xl backdrop-blur-md relative z-10">
                <IoAlertCircle className="text-red-500 text-4xl mx-auto mb-3" />
                <h2 className="text-xl font-black text-slate-800 mb-2">Sem Estabelecimento</h2>
                <p className="text-slate-500 mb-6 font-semibold">Nenhum estabelecimento vinculado a sua conta de usuário.</p>
                <div className="flex justify-center"><BackButton to="/admin-dashboard" className="!mb-0" /></div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#f6f8fa] via-[#eef2f6] to-[#f6f8fa] p-4 sm:p-6 lg:p-8 font-sans pb-32 relative overflow-hidden transition-colors duration-300">
            {/* ─── NEBULA GLOWS ─── */}
            <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-blue-400/5 rounded-full blur-[140px] pointer-events-none"></div>
            <div className="absolute bottom-[20%] right-[-10%] w-[550px] h-[550px] bg-amber-400/5 rounded-full blur-[130px] pointer-events-none"></div>

            <div className="max-w-[1400px] mx-auto space-y-6 relative z-10">
                <BackButton className="mb-6" />

                {/* ═══ HEADER ═══ */}
                <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-amber-955 shadow-lg shadow-amber-500/20">
                            <IoStatsChart size={24} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Relatórios & BI</h1>
                            <p className="text-xs text-slate-400 font-extrabold uppercase tracking-widest mt-1">{nomeEstab || 'Carregando...'} • Dados em tempo real</p>
                        </div>
                    </div>

                    {/* Date Filters (Glassmorphic) */}
                    <div className="bg-white/50 border border-white/60 backdrop-blur-xl rounded-[2.2rem] shadow-xl p-3 flex flex-wrap items-center gap-3">
                        <div className="flex items-center bg-slate-100/60 hover:bg-slate-100 border border-slate-200/50 rounded-2xl px-4 py-2.5 shadow-sm transition-all focus-within:bg-white focus-within:ring-4 focus-within:ring-amber-500/10">
                            <span className="text-[9px] font-black text-slate-400 mr-2.5 uppercase tracking-wider">De</span>
                            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="bg-transparent text-xs font-extrabold text-slate-700 outline-none cursor-pointer" />
                        </div>
                        <div className="flex items-center bg-slate-100/60 hover:bg-slate-100 border border-slate-200/50 rounded-2xl px-4 py-2.5 shadow-sm transition-all focus-within:bg-white focus-within:ring-4 focus-within:ring-amber-500/10">
                            <span className="text-[9px] font-black text-slate-400 mr-2.5 uppercase tracking-wider">Até</span>
                            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="bg-transparent text-xs font-extrabold text-slate-700 outline-none cursor-pointer" />
                        </div>
                        
                        <div className="flex gap-2">
                            <button onClick={() => { setDataInicio(hojeStr()); setDataFim(hojeStr()); }}
                                className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 rounded-xl shadow-sm transition-all active:scale-95">
                                Hoje
                            </button>
                            <button onClick={() => { setDataInicio(semanaAtrasStr()); setDataFim(hojeStr()); }}
                                className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 rounded-xl shadow-sm transition-all active:scale-95">
                                7 dias
                            </button>
                            <button onClick={() => { const d = new Date(); d.setDate(d.getDate() - 30); setDataInicio(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')); setDataFim(hojeStr()); }}
                                className="px-4 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 text-amber-955 font-bold hover:from-amber-500 hover:to-amber-600 text-xs rounded-xl shadow-md shadow-amber-500/10 transition-all active:scale-95">
                                30 dias
                            </button>
                        </div>
                    </div>
                </header>

                {/* ═══ KPIs ═══ */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
                    <KpiCard titulo="Faturamento" valor={fmt(stats?.fatTotal)} sub={`${stats?.totalPedidos || 0} pedidos`} icon={IoCash} cor="green" loading={loading} />
                    <KpiCard titulo="Ticket Médio" valor={fmt(stats?.ticketMedio)} sub="por pedido" icon={IoStatsChart} cor="purple" loading={loading} />
                    <KpiCard titulo="Delivery" valor={fmt(stats?.fatDel)} sub={`${stats?.qtdDel || 0} pedidos`} icon={IoCart} cor="blue" loading={loading} />
                    <KpiCard titulo="Salão" valor={fmt(stats?.fatSal)} sub={`${stats?.qtdSal || 0} vendas`} icon={IoRestaurant} cor="orange" loading={loading} />
                </div>

                {/* ═══ GRÁFICO FATURAMENTO POR DIA ═══ */}
                {!loading && stats?.diasChart && stats.diasChart.length > 0 && (
                    <div className="bg-white/70 border border-slate-150/40 rounded-[2.2rem] shadow-sm p-6 sm:p-8 mb-8 backdrop-blur-md">
                        <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                            <h2 className="text-lg font-black text-slate-800 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner"><IoStatsChart size={18} /></div>
                                Faturamento por Dia
                            </h2>
                            <span className="text-[10px] font-extrabold text-slate-400 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full uppercase tracking-wider">{stats.diasChart.length} dias</span>
                        </div>
                        <MiniBarChart dados={stats.diasChart} labelKey="dia" valueKey="valor" maxAlt={150} />
                    </div>
                )}

                {/* ═══ GRID: HORÁRIO DE PICO + FORMAS DE PAGAMENTO ═══ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

                    {/* HORÁRIO DE PICO */}
                    {!loading && stats && (
                        <div className="bg-white/70 border border-slate-150/40 rounded-[2.2rem] shadow-sm p-6 sm:p-8 backdrop-blur-md">
                            <h2 className="text-lg font-black text-slate-800 flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shadow-inner"><IoTimeOutline size={20} /></div>
                                Horários de Pico
                            </h2>
                            <div className="space-y-1">
                                {stats.horas.filter(h => h.qtd > 0).sort((a, b) => b.qtd - a.qtd).slice(0, 8).map(h => (
                                    <HBar
                                        key={h.hora}
                                        label={`${String(h.hora).padStart(2, '0')}:00`}
                                        valor={h.qtd}
                                        maxValor={horasComDados.maxQtd}
                                        formatado={`${h.qtd} pedidos`}
                                        cor={horasComDados.top3.has(h.hora) ? 'bg-gradient-to-r from-orange-400 to-orange-500' : 'bg-gradient-to-r from-orange-200 to-orange-300'}
                                    />
                                ))}
                                {stats.horas.every(h => h.qtd === 0) && (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                        <IoTimeOutline size={36} className="text-slate-300 mb-2" />
                                        <p className="text-sm font-semibold">Sem dados de horários neste período</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* FORMAS DE PAGAMENTO */}
                    {!loading && stats && (
                        <div className="bg-white/70 border border-slate-150/40 rounded-[2.2rem] shadow-sm p-6 sm:p-8 backdrop-blur-md">
                            <h2 className="text-lg font-black text-slate-800 flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-inner"><IoCardOutline size={20} /></div>
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
                                        cor={
                                            f.nome === 'PIX' ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 
                                            f.nome === 'Crédito' ? 'bg-gradient-to-r from-blue-400 to-blue-500' : 
                                            f.nome === 'Débito' ? 'bg-gradient-to-r from-purple-400 to-purple-500' : 
                                            f.nome === 'Dinheiro' ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 
                                            'bg-gradient-to-r from-slate-400 to-slate-500'
                                        }
                                    />
                                ))}
                                {formasOrdenadas.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                        <IoCardOutline size={36} className="text-slate-300 mb-2" />
                                        <p className="text-sm font-semibold">Sem dados de pagamento neste período</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ═══ GRID: TOP PRODUTOS + DELIVERY vs SALÃO ═══ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

                    {/* TOP 10 PRODUTOS */}
                    {!loading && stats && (
                        <div className="bg-white/70 border border-slate-150/40 rounded-[2.2rem] shadow-sm p-6 sm:p-8 backdrop-blur-md">
                            <h2 className="text-lg font-black text-slate-800 flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner"><IoPodiumOutline size={20} /></div>
                                Top 10 Mais Vendidos
                            </h2>
                            <div className="space-y-3">
                                {stats.topProdutos.length > 0 ? stats.topProdutos.map((prod, i) => {
                                    const maxQtd = stats.topProdutos[0].qtd;
                                    const w = (prod.qtd / maxQtd) * 100;
                                    return (
                                        <div key={prod.nome} className="flex items-center gap-3 group">
                                            <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 shadow-sm border ${
                                                i === 0 ? 'bg-gradient-to-br from-amber-350 to-amber-400 text-amber-955 border-amber-250 shadow-amber-500/10' : 
                                                i === 1 ? 'bg-gradient-to-br from-slate-200 to-slate-300 text-slate-700 border-slate-300' : 
                                                i === 2 ? 'bg-gradient-to-br from-orange-200 to-orange-300 text-orange-850 border-orange-250' : 
                                                'bg-slate-50 text-slate-500 border-slate-200'
                                            }`}>
                                                {i + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-xs font-black text-slate-750 truncate group-hover:text-amber-600 transition-colors">{prod.nome}</span>
                                                    <span className="text-[10px] font-black text-slate-400 bg-slate-50 border border-slate-150/40 px-2 py-0.5 rounded-md shrink-0 ml-2">{prod.qtd} unidades</span>
                                                </div>
                                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-150/30">
                                                    <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500 shadow-sm" style={{ width: `${w}%` }} />
                                                </div>
                                            </div>
                                            <span className="text-xs font-black text-slate-700 shrink-0 w-20 text-right">{fmt(prod.valor)}</span>
                                        </div>
                                    );
                                }) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                        <IoPodiumOutline size={36} className="text-slate-300 mb-2" />
                                        <p className="text-sm font-semibold">Sem dados de produtos neste período</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* DELIVERY vs SALÃO */}
                    {!loading && stats && (
                        <div className="bg-white/70 border border-slate-150/40 rounded-[2.2rem] shadow-sm p-6 sm:p-8 backdrop-blur-md">
                            <h2 className="text-lg font-black text-slate-800 flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner"><IoStorefront size={20} /></div>
                                Delivery vs Salão
                            </h2>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                {/* DELIVERY */}
                                <div className="group bg-blue-50/40 hover:bg-blue-50/70 rounded-[1.8rem] p-5 border border-blue-100/50 shadow-sm transition-all duration-300 relative overflow-hidden flex flex-col justify-between min-h-[160px]">
                                    <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-xl bg-blue-200 opacity-20 transform translate-x-4 -translate-y-4 group-hover:scale-150 transition-all duration-500"></div>
                                    <div className="flex items-center gap-2.5 mb-4 relative z-10">
                                        <div className="p-2 bg-blue-100 text-blue-600 rounded-xl shadow-sm"><IoBicycle size={16} /></div>
                                        <span className="text-xs font-black text-blue-800 uppercase tracking-wider">Delivery</span>
                                    </div>
                                    <div className="space-y-2 relative z-10">
                                        <div>
                                            <p className="text-[9px] font-bold text-blue-400 uppercase tracking-wider">Faturamento</p>
                                            <p className="text-lg font-black text-blue-900 leading-tight">{fmt(stats.fatDel)}</p>
                                        </div>
                                        <div className="flex justify-between items-end border-t border-blue-100/50 pt-2">
                                            <div>
                                                <p className="text-[8px] font-bold text-blue-400 uppercase">Pedidos</p>
                                                <p className="text-xs font-black text-blue-900">{stats.qtdDel}</p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] font-bold text-blue-400 uppercase">Ticket M.</p>
                                                <p className="text-xs font-black text-blue-900">{fmt(stats.ticketDel)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* SALÃO */}
                                <div className="group bg-orange-50/40 hover:bg-orange-50/70 rounded-[1.8rem] p-5 border border-orange-100/50 shadow-sm transition-all duration-300 relative overflow-hidden flex flex-col justify-between min-h-[160px]">
                                    <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-xl bg-orange-200 opacity-20 transform translate-x-4 -translate-y-4 group-hover:scale-150 transition-all duration-500"></div>
                                    <div className="flex items-center gap-2.5 mb-4 relative z-10">
                                        <div className="p-2 bg-orange-100 text-orange-600 rounded-xl shadow-sm"><IoRestaurant size={16} /></div>
                                        <span className="text-xs font-black text-orange-800 uppercase tracking-wider">Salão</span>
                                    </div>
                                    <div className="space-y-2 relative z-10">
                                        <div>
                                            <p className="text-[9px] font-bold text-orange-400 uppercase tracking-wider">Faturamento</p>
                                            <p className="text-lg font-black text-orange-900 leading-tight">{fmt(stats.fatSal)}</p>
                                        </div>
                                        <div className="flex justify-between items-end border-t border-orange-100/50 pt-2">
                                            <div>
                                                <p className="text-[8px] font-bold text-orange-400 uppercase">Vendas</p>
                                                <p className="text-xs font-black text-orange-900">{stats.qtdSal}</p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] font-bold text-orange-400 uppercase">Ticket M.</p>
                                                <p className="text-xs font-black text-orange-900">{fmt(stats.ticketSal)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* BARRA COMPARATIVA */}
                            {stats.totalPedidos > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-100">
                                    <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Proporção do faturamento</p>
                                    <div className="flex h-3.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 shadow-inner">
                                        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 shadow-sm" style={{ width: `${stats.fatTotal > 0 ? (stats.fatDel / stats.fatTotal * 100) : 50}%` }} />
                                        <div className="bg-gradient-to-r from-orange-400 to-red-500 transition-all duration-500 shadow-sm" style={{ width: `${stats.fatTotal > 0 ? (stats.fatSal / stats.fatTotal * 100) : 50}%` }} />
                                    </div>
                                    <div className="flex justify-between mt-2.5">
                                        <span className="text-xs font-black text-blue-600 flex items-center gap-1">🔵 {stats.fatTotal > 0 ? pct(stats.fatDel / stats.fatTotal * 100) : '0%'} Delivery</span>
                                        <span className="text-xs font-black text-orange-600 flex items-center gap-1">🟠 {stats.fatTotal > 0 ? pct(stats.fatSal / stats.fatTotal * 100) : '0%'} Salão</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ═══ INSIGHTS INTELIGENTES + DIA DA SEMANA + CANCELAMENTOS ═══ */}
                {!loading && stats && stats.totalPedidos > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* INSIGHTS */}
                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-[2.2rem] border border-indigo-150/40 shadow-sm p-6 sm:p-8">
                            <h2 className="text-lg font-black text-slate-800 flex items-center gap-3 mb-6 border-b border-indigo-100/50 pb-4">
                                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-inner">💡</div>
                                Insights Inteligentes
                            </h2>
                            <div className="space-y-4">
                                {/* Melhor dia */}
                                {stats.diasChart.length > 0 && (() => {
                                    const melhor = [...stats.diasChart].sort((a, b) => b.valor - a.valor)[0];
                                    return (
                                        <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-white shadow-sm hover:scale-[1.01] transition-transform">
                                            <p className="text-[9px] font-black text-indigo-500 uppercase tracking-wider mb-1">📈 Melhor dia</p>
                                            <p className="text-sm font-black text-slate-800 leading-tight">{melhor.dia} — {fmt(melhor.valor)}</p>
                                        </div>
                                    );
                                })()}

                                {/* Melhor hora */}
                                {(() => {
                                    const melhorHora = [...stats.horas].sort((a, b) => b.qtd - a.qtd)[0];
                                    return melhorHora?.qtd > 0 ? (
                                        <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-white shadow-sm hover:scale-[1.01] transition-transform">
                                            <p className="text-[9px] font-black text-orange-500 uppercase tracking-wider mb-1">⏰ Horário de pico</p>
                                            <p className="text-sm font-black text-slate-800 leading-tight">{String(melhorHora.hora).padStart(2, '0')}:00h — {melhorHora.qtd} pedidos</p>
                                        </div>
                                    ) : null;
                                })()}

                                {/* Forma de pagamento dominante */}
                                {formasOrdenadas.length > 0 && (
                                    <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-white shadow-sm hover:scale-[1.01] transition-transform">
                                        <p className="text-[9px] font-black text-emerald-500 uppercase tracking-wider mb-1">💳 Pagamento preferido</p>
                                        <p className="text-sm font-black text-slate-800 leading-tight">{formasOrdenadas[0].nome} — {pct((formasOrdenadas[0].qtd / stats.totalPedidos) * 100)} dos pedidos</p>
                                    </div>
                                )}

                                {/* Média diária */}
                                {stats.diasChart.length > 0 && (
                                    <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-white shadow-sm hover:scale-[1.01] transition-transform">
                                        <p className="text-[9px] font-black text-blue-500 uppercase tracking-wider mb-1">📊 Média diária</p>
                                        <p className="text-sm font-black text-slate-800 leading-tight">{fmt(stats.fatTotal / stats.diasChart.length)}/dia</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* MÉDIA POR DIA DA SEMANA */}
                        <div className="bg-white/70 border border-slate-150/40 rounded-[2.2rem] shadow-sm p-6 sm:p-8 backdrop-blur-md">
                            <h2 className="text-lg font-black text-slate-800 flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                                <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shadow-inner"><IoCalendarOutline size={20} /></div>
                                Faturamento por Dia da Semana
                            </h2>
                            <div className="space-y-1">
                                {(() => {
                                    const maxTotal = Math.max(...stats.porDiaSemana.map(d => d.total), 1);
                                    const melhorDia = [...stats.porDiaSemana].sort((a, b) => b.total - a.total)[0]?.dia;
                                    return stats.porDiaSemana.map(d => (
                                        <HBar
                                            key={d.dia}
                                            label={d.dia}
                                            valor={d.total}
                                            maxValor={maxTotal}
                                            formatado={fmt(d.total)}
                                            sub={`${d.qtd} ped.`}
                                            cor={d.dia === melhorDia && d.total > 0 ? 'bg-gradient-to-r from-cyan-400 to-cyan-500' : 'bg-gradient-to-r from-cyan-200 to-cyan-300'}
                                        />
                                    ));
                                })()}
                            </div>
                        </div>

                        {/* SAÚDE DA OPERAÇÃO / CANCELAMENTOS */}
                        <div className="bg-white/70 border border-slate-150/40 rounded-[2.2rem] shadow-sm p-6 sm:p-8 backdrop-blur-md">
                            <h2 className="text-lg font-black text-slate-800 flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shadow-inner"><IoAlertCircle size={20} /></div>
                                Saúde da Operação
                            </h2>
                            <div className="space-y-5">
                                <div className="bg-red-50/50 rounded-2xl p-5 border border-red-100/50">
                                    <p className="text-[10px] font-black text-red-400 uppercase tracking-wider mb-2">Taxa de Cancelamento</p>
                                    <div className="flex items-end justify-between">
                                        <p className="text-3.5xl font-black text-red-655 tracking-tight leading-none">{pct(stats.taxaCancelamento)}</p>
                                        <p className="text-xs font-bold text-red-400 uppercase tracking-tight">{stats.cancelados} pedidos</p>
                                    </div>
                                    <div className="mt-4 h-2.5 bg-red-100 rounded-full overflow-hidden shadow-inner border border-red-200/20">
                                        <div className={`h-full rounded-full transition-all duration-500 ${stats.taxaCancelamento > 10 ? 'bg-gradient-to-r from-red-500 to-rose-600' : stats.taxaCancelamento > 5 ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-emerald-400 to-emerald-500'}`}
                                            style={{ width: `${Math.min(stats.taxaCancelamento, 100)}%` }} />
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-3 tracking-wide flex items-center gap-1 animate-pulse-subtle">
                                        {stats.taxaCancelamento <= 3 ? '✅ Excelente faturamento e poucas perdas!' :
                                         stats.taxaCancelamento <= 7 ? '⚠️ Alerta: taxa de cancelamento moderada.' :
                                         '🚨 Crítico: investigue os gargalos de cancelamentos.'}
                                    </p>
                                </div>
                                <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100/50 flex justify-between items-center">
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Pedidos Válidos</p>
                                        <p className="text-2xl font-black text-slate-800 mt-0.5">{stats.totalPedidos}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Total Registrados</p>
                                        <p className="text-xs font-bold text-slate-500 mt-1">de {stats.totalPedidos + stats.cancelados} pedidos</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                )}

            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }

                @keyframes pulse-subtle {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.01); opacity: 0.9; }
                }
                .animate-pulse-subtle {
                    animation: pulse-subtle 2s infinite ease-in-out;
                }
            `}</style>
        </div>
    );
}

export default AdminAnalytics;