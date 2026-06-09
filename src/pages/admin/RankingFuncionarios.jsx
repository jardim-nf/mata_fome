/* eslint-disable react-refresh/only-export-components */
// src/pages/admin/RankingFuncionarios.jsx — REDESENHADO COM VISUAL PREMIUM CLARO
import React, { useState, useEffect, useMemo } from 'react';
import BackButton from '../../components/BackButton';

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import { subDays } from 'date-fns';
import {
  IoTrophyOutline, IoFlameOutline, IoTimeOutline,
  IoCashOutline, IoListOutline, IoStatsChart
} from 'react-icons/io5';
import { FaMotorcycle, FaUsers, FaMedal } from 'react-icons/fa';

// MedalBadge Component with beautiful gold, silver and bronze gradients
const MedalBadge = ({ position }) => {
  const colors = {
    1: 'bg-gradient-to-br from-amber-300 to-amber-500 text-amber-955 shadow-amber-500/20 border-amber-250',
    2: 'bg-gradient-to-br from-slate-200 to-slate-350 text-slate-700 shadow-slate-350/20 border-slate-300',
    3: 'bg-gradient-to-br from-orange-350 to-orange-500 text-orange-955 shadow-orange-500/20 border-orange-400',
  };
  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-md border ${colors[position] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
      {position <= 3 ? <FaMedal className="text-lg animate-pulse-subtle" /> : `${position}º`}
    </div>
  );
};

// BentoStatsCard Component for employee metrics summary
const BentoStatsCard = ({ title, value, sub, icon: Icon, colorClass, bgClass, borderLeftClass }) => (
    <div className={`group bg-white/70 border border-slate-150/40 border-l-4 ${borderLeftClass} rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02] relative overflow-hidden flex flex-col justify-between`}>
        <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl transform translate-x-8 -translate-y-8 group-hover:scale-150 transition-transform duration-700 bg-amber-200 opacity-20"></div>
        <div className="flex justify-between items-start mb-2 relative z-10">
            <div>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-tight">{value}</h3>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${bgClass}`}>
                <Icon className={`text-lg ${colorClass}`} />
            </div>
        </div>
        {sub && (
            <div className="mt-2 text-[10px] text-slate-400 font-extrabold uppercase tracking-wide relative z-10">
                {sub}
            </div>
        )}
    </div>
);

function RankingFuncionarios() {
  const { estabelecimentoIdPrincipal } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('7');
  const [tab, setTab] = useState('garcons');

  const estabId = estabelecimentoIdPrincipal;

  useEffect(() => {
    if (!estabId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const daysAgo = subDays(new Date(), parseInt(periodo));
        
        // Busca pedidos (delivery, balcão, etc)
        const pedidosSnap = await getDocs(collection(db, 'estabelecimentos', estabId, 'pedidos'));
        const listaPedidos = pedidosSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => {
          const dt = p.createdAt?.toDate?.() || (p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : null);
          return dt && dt >= daysAgo && p.status !== 'cancelado';
        });
        setPedidos(listaPedidos);

        // Busca vendas (fechamento de mesa no salão)
        const vendasSnap = await getDocs(collection(db, 'vendas'));
        const listaVendas = vendasSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(v => {
          if (v.estabelecimentoId !== estabId) return false;
          const dt = v.criadoEm?.toDate?.() || v.createdAt?.toDate?.() || 
                     (v.criadoEm?.seconds ? new Date(v.criadoEm.seconds * 1000) : null) ||
                     (v.createdAt?.seconds ? new Date(v.createdAt.seconds * 1000) : null);
          return dt && dt >= daysAgo && v.status !== 'cancelado';
        });
        setVendas(listaVendas);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    fetchData();
  }, [estabId, periodo]);

  // GARÇONS RANKING — busca em todos os campos possíveis
  const garconRanking = useMemo(() => {
    const map = {};
    pedidos.forEach(p => {
      // 1) Campo direto no pedido
      const garcomPedido = p.garcomNome || p.atendente || p.funcionario || p.responsavel || null;
      
      if (garcomPedido && garcomPedido !== 'Garçom') {
        if (!map[garcomPedido]) map[garcomPedido] = { nome: garcomPedido, pedidos: 0, faturamento: 0, ticketMedio: 0 };
        map[garcomPedido].pedidos++;
        map[garcomPedido].faturamento += Number(p.totalFinal || p.total) || 0;
      } else {
        // 2) Busca dentro dos itens (adicionadoPor) — campo usado no Salão
        const itens = p.itens || p.pedidos || [];
        const garcomDoItem = itens.find(i => i.adicionadoPorNome || i.adicionadoPor);
        const nomeGarcom = garcomDoItem?.adicionadoPorNome || garcomDoItem?.adicionadoPor;
        if (nomeGarcom && nomeGarcom !== 'Garçom') {
          if (!map[nomeGarcom]) map[nomeGarcom] = { nome: nomeGarcom, pedidos: 0, faturamento: 0, ticketMedio: 0 };
          map[nomeGarcom].pedidos++;
          map[nomeGarcom].faturamento += Number(p.totalFinal || p.total) || 0;
        }
      }
    });

    // Também processa vendas (fechamentos de mesa do salão)
    vendas.forEach(v => {
      const garcom = v.funcionario || v.responsavel || v.criadoPorNome || null;
      if (!garcom || garcom === 'Garçom') return;
      if (!map[garcom]) map[garcom] = { nome: garcom, pedidos: 0, faturamento: 0, ticketMedio: 0 };
      map[garcom].pedidos++;
      map[garcom].faturamento += Number(v.total || v.totalFinal) || 0;
    });

    return Object.values(map)
      .map(g => ({ ...g, ticketMedio: g.pedidos > 0 ? g.faturamento / g.pedidos : 0 }))
      .sort((a, b) => b.faturamento - a.faturamento);
  }, [pedidos, vendas]);

  // MOTOBOYS RANKING
  const motoboyRanking = useMemo(() => {
    const map = {};
    pedidos.forEach(p => {
      const motoboy = p.motoboyNome || p.entregador;
      if (!motoboy) return;
      if (!map[motoboy]) map[motoboy] = { nome: motoboy, entregas: 0, taxasTotal: 0, mediaTaxa: 0 };
      map[motoboy].entregas++;
      map[motoboy].taxasTotal += Number(p.taxaEntrega) || 0;
    });
    return Object.values(map)
      .map(m => ({ ...m, mediaTaxa: m.entregas > 0 ? m.taxasTotal / m.entregas : 0 }))
      .sort((a, b) => b.entregas - a.entregas);
  }, [pedidos]);

  // STATS — derivados dos rankings para garantir consistência
  const stats = useMemo(() => {
    const garconPedidos = garconRanking.reduce((s, g) => s + g.pedidos, 0);
    const garconFat = garconRanking.reduce((s, g) => s + g.faturamento, 0);
    const motoboyEntregas = motoboyRanking.reduce((s, m) => s + m.entregas, 0);
    const motoboyTaxas = motoboyRanking.reduce((s, m) => s + m.taxasTotal, 0);
    return {
      garconPedidos,
      garconFat,
      motoboyEntregas,
      motoboyTaxas,
      totalGarcons: garconRanking.length,
      totalMotoboys: motoboyRanking.length,
    };
  }, [garconRanking, motoboyRanking]);

  const activeRanking = tab === 'garcons' ? garconRanking : motoboyRanking;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f6f8fa] via-[#eef2f6] to-[#f6f8fa] p-4 sm:p-6 lg:p-8 font-sans pb-32 relative overflow-hidden transition-colors duration-300">
      {/* ─── NEBULA GLOWS ─── */}
      <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-amber-400/5 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[550px] h-[550px] bg-blue-400/5 rounded-full blur-[130px] pointer-events-none"></div>

      <div className="max-w-5xl mx-auto relative z-10 space-y-6">

        {/* HEADER & SELECTOR CONTAINER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <BackButton className="!mb-0" />
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-amber-955 shadow-lg shadow-amber-500/20">
                  <IoTrophyOutline size={24} />
                </div>
                Ranking da Equipe
              </h1>
              <p className="text-xs text-slate-400 font-extrabold uppercase tracking-widest mt-1 ml-[60px]">Performance e faturamento de garçons e motoboys</p>
            </div>
          </div>
          
          {/* Glassmorphic Select Container */}
          <div className="bg-white/50 border border-white/60 backdrop-blur-xl rounded-[2.2rem] shadow-xl p-2 flex items-center shadow-sm max-w-fit self-start md:self-auto">
            <select
              value={periodo}
              onChange={e => setPeriodo(e.target.value)}
              className="px-6 py-3 bg-white border border-slate-200/50 hover:bg-slate-50 focus:ring-4 focus:ring-amber-500/10 rounded-2xl text-xs font-black text-slate-700 outline-none cursor-pointer transition-all shadow-inner appearance-none min-w-[180px]"
              style={{ 
                backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, 
                backgroundRepeat: 'no-repeat', 
                backgroundPosition: 'right 1.25rem center', 
                backgroundSize: '1em' 
              }}
            >
              <option value="7">📅 Últimos 7 dias</option>
              <option value="15">📅 Últimos 15 dias</option>
              <option value="30">📅 Últimos 30 dias</option>
              <option value="90">📅 Últimos 90 dias</option>
            </select>
          </div>
        </div>

        {/* STATS BENTO GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <BentoStatsCard title="Garçons Pedidos" value={stats.garconPedidos} sub={`${stats.totalGarcons} ativo(s)`} icon={FaUsers} colorClass="text-blue-600" bgClass="bg-blue-50" borderLeftClass="border-l-blue-500" />
          <BentoStatsCard title="Faturamento Garçons" value={stats.garconFat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })} icon={IoCashOutline} colorClass="text-emerald-700" bgClass="bg-emerald-50" borderLeftClass="border-l-emerald-500" />
          <BentoStatsCard title="Motoboys Entregas" value={stats.motoboyEntregas} sub={`${stats.totalMotoboys} ativo(s)`} icon={FaMotorcycle} colorClass="text-purple-650" bgClass="bg-purple-50" borderLeftClass="border-l-purple-500" />
          <BentoStatsCard title="Taxas Motoboys" value={stats.motoboyTaxas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })} icon={IoCashOutline} colorClass="text-amber-800" bgClass="bg-amber-50" borderLeftClass="border-l-amber-500" />
        </div>

        {/* TABS (Frosted Glass Container) */}
        <div className="flex bg-white/50 border border-white/60 backdrop-blur-md p-1.5 rounded-[2.2rem] shadow-md mb-8">
          <button onClick={() => setTab('garcons')}
            className={`flex-1 py-3.5 rounded-[1.8rem] text-sm font-extrabold transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 ${
              tab === 'garcons' 
                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-500/10' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
            }`}
          >
            <FaUsers /> Garçons / Atendentes
          </button>
          <button onClick={() => setTab('motoboys')}
            className={`flex-1 py-3.5 rounded-[1.8rem] text-sm font-extrabold transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 ${
              tab === 'motoboys' 
                ? 'bg-gradient-to-r from-purple-500 to-indigo-650 text-white shadow-md shadow-purple-500/10' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
            }`}
          >
            <FaMotorcycle /> Motoboys / Entregadores
          </button>
        </div>

        {/* RANKING LIST / LEADERBOARD */}
        <div className="min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white/70 backdrop-blur-md rounded-[2.5rem] border border-slate-150/40 shadow-sm">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent mb-4" />
              <p className="text-slate-500 font-extrabold text-sm uppercase tracking-wider">Calculando ranking da equipe...</p>
            </div>
          ) : activeRanking.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white/70 backdrop-blur-md rounded-[2.5rem] border-2 border-dashed border-slate-200/60 shadow-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none"></div>
              <div className="relative z-10 flex flex-col items-center text-center p-6">
                <div className="w-20 h-20 bg-amber-50 text-amber-300 rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <IoTrophyOutline size={40} className="animate-pulse" />
                </div>
                <h3 className="text-2xl font-black text-slate-700 mb-2">Nenhum dado no período</h3>
                <p className="text-slate-400 font-semibold text-sm max-w-sm">Tente ampliar o período de análise selecionando outra data no cabeçalho.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-fadeIn">
              {activeRanking.map((item, index) => {
                const position = index + 1;
                const isFirst = position === 1;
                const isSecond = position === 2;
                const isThird = position === 3;
                
                const borderClass = 
                  isFirst ? 'border-amber-350 ring-2 ring-amber-100 bg-amber-50/20 shadow-amber-500/5' :
                  isSecond ? 'border-slate-300 bg-slate-50/20' :
                  isThird ? 'border-orange-200 bg-orange-50/20' :
                  'border-slate-150/40 bg-white/70';

                const hoverClass = 
                  isFirst ? 'hover:border-amber-400 hover:shadow-amber-100/30' :
                  isSecond ? 'hover:border-slate-400 hover:shadow-slate-100/30' :
                  isThird ? 'hover:border-orange-300 hover:shadow-orange-100/30' :
                  'hover:border-amber-200/80 hover:shadow-xl';

                return (
                  <div key={item.nome}
                    className={`rounded-[2.2rem] p-5 border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 hover:scale-[1.005] ${borderClass} ${hoverClass} relative overflow-hidden group`}
                  >
                    {isFirst && (
                      <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl bg-amber-200 opacity-20 transform translate-x-8 -translate-y-8"></div>
                    )}
                    
                    <div className="flex items-center gap-4">
                      <MedalBadge position={position} />
                      
                      <div className="min-w-0">
                        <h3 className={`font-black text-slate-800 truncate leading-tight ${isFirst ? 'text-lg sm:text-xl' : 'text-sm sm:text-base'}`}>
                          {item.nome}
                        </h3>
                        {isFirst && (
                          <span className="text-[9px] font-black text-amber-700 bg-amber-100/85 border border-amber-200/60 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center w-fit gap-1 mt-1.5 shadow-sm">
                            <IoFlameOutline className="animate-pulse" /> Destaque do Período
                          </span>
                        )}
                      </div>
                    </div>

                    {tab === 'garcons' ? (
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-6 justify-between sm:justify-end text-right mt-2 sm:mt-0 border-t border-slate-100 sm:border-0 pt-3 sm:pt-0">
                        <div className="bg-slate-50/50 rounded-2xl px-4 py-2 border border-slate-100/80 shadow-sm">
                          <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide">Pedidos</p>
                          <p className="text-base font-black text-slate-800">{item.pedidos}</p>
                        </div>
                        <div className="hidden md:block bg-blue-50/30 rounded-2xl px-4 py-2 border border-blue-100/40">
                          <p className="text-[9px] font-extrabold text-blue-400 uppercase tracking-wide">Ticket Médio</p>
                          <p className="text-sm font-black text-blue-600">R$ {item.ticketMedio.toFixed(0)}</p>
                        </div>
                        <div className="bg-emerald-50/50 rounded-2xl px-5 py-2.5 border border-emerald-100 shadow-sm">
                          <p className="text-[9px] font-extrabold text-emerald-500 uppercase tracking-wide">Faturamento</p>
                          <p className={`font-black text-emerald-700 ${isFirst ? 'text-lg' : 'text-base'}`}>
                            R$ {item.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-6 justify-between sm:justify-end text-right mt-2 sm:mt-0 border-t border-slate-100 sm:border-0 pt-3 sm:pt-0">
                        <div className="bg-slate-50/50 rounded-2xl px-4 py-2 border border-slate-100/80 shadow-sm">
                          <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide">Entregas</p>
                          <p className="text-base font-black text-slate-800">{item.entregas}</p>
                        </div>
                        <div className="hidden md:block bg-purple-50/30 rounded-2xl px-4 py-2 border border-purple-100/40">
                          <p className="text-[9px] font-extrabold text-purple-400 uppercase tracking-wide">Taxa Média</p>
                          <p className="text-sm font-black text-purple-650">R$ {item.mediaTaxa.toFixed(2)}</p>
                        </div>
                        <div className="bg-emerald-50/50 rounded-2xl px-5 py-2.5 border border-emerald-100 shadow-sm">
                          <p className="text-[9px] font-extrabold text-emerald-500 uppercase tracking-wide">Total Taxas</p>
                          <p className={`font-black text-emerald-700 ${isFirst ? 'text-lg' : 'text-base'}`}>
                            R$ {item.taxasTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
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
            50% { transform: scale(1.04); opacity: 0.9; }
        }
        .animate-pulse-subtle {
            animation: pulse-subtle 2s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}

export default withEstablishmentAuth(RankingFuncionarios);
