// src/pages/admin/RankingFuncionarios.jsx
import React, { useState, useEffect, useMemo } from 'react';
import BackButton from '../../components/BackButton';

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import { Link } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import {
  IoTrophyOutline, IoArrowBack, IoFlameOutline, IoTimeOutline,
  IoStarOutline, IoCashOutline, IoRibbonOutline
} from 'react-icons/io5';
import { FaMotorcycle, FaUsers, FaMedal } from 'react-icons/fa';

const MedalBadge = ({ position }) => {
  const colors = {
    1: 'bg-amber-400 text-amber-900 shadow-amber-200',
    2: 'bg-gray-300 text-gray-700 shadow-gray-200',
    3: 'bg-orange-400 text-orange-900 shadow-orange-200',
  };
  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shadow-md ${colors[position] || 'bg-slate-100 text-slate-600'}`}>
      {position <= 3 ? <FaMedal className="text-lg" /> : `${position}º`}
    </div>
  );
};

function RankingFuncionarios() {
  const { userData , estabelecimentoIdPrincipal } = useAuth();
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
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-6 font-sans pb-20">
      <div className="max-w-5xl mx-auto">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BackButton to="/dashboard" />
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <IoTrophyOutline className="text-amber-500" /> Ranking de Funcionários
              </h1>
              <p className="text-xs text-gray-400 font-medium">Performance e métricas da equipe</p>
            </div>
          </div>
          <select
            value={periodo}
            onChange={e => setPeriodo(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 shadow-sm"
          >
            <option value="7">Últimos 7 dias</option>
            <option value="15">Últimos 15 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-2xl p-4 border-l-4 border-l-blue-500 border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Garçons Pedidos</p>
            <p className="text-2xl font-black text-blue-600">{stats.garconPedidos}</p>
            <p className="text-[10px] text-gray-400 font-medium mt-1">{stats.totalGarcons} garçon(s)</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border-l-4 border-l-emerald-500 border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Garçons Faturamento</p>
            <p className="text-2xl font-black text-emerald-600">R$ {stats.garconFat.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border-l-4 border-l-purple-500 border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Motoboys Entregas</p>
            <p className="text-2xl font-black text-purple-600">{stats.motoboyEntregas}</p>
            <p className="text-[10px] text-gray-400 font-medium mt-1">{stats.totalMotoboys} motoboy(s)</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border-l-4 border-l-amber-500 border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Motoboys Taxas</p>
            <p className="text-2xl font-black text-amber-600">R$ {stats.motoboyTaxas.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
          </div>
        </div>

        {/* TABS */}
        <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm mb-6">
          <button onClick={() => setTab('garcons')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${tab === 'garcons' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <FaUsers /> Garçons / Atendentes
          </button>
          <button onClick={() => setTab('motoboys')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${tab === 'motoboys' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <FaMotorcycle /> Motoboys / Entregadores
          </button>
        </div>

        {/* RANKING LIST */}
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-500 border-t-transparent mx-auto mb-3" />
            <p className="text-gray-400 text-sm font-bold">Calculando ranking...</p>
          </div>
        ) : activeRanking.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
            <IoTrophyOutline className="text-5xl text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-bold">Nenhum dado no período</p>
            <p className="text-gray-400 text-sm">Tente ampliar o período de análise</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeRanking.map((item, index) => (
              <div key={item.nome}
                className={`bg-white rounded-2xl p-4 border shadow-sm flex items-center gap-4 transition-all hover:shadow-md ${
                  index === 0 ? 'border-amber-200 shadow-amber-50 ring-2 ring-amber-100' :
                  index === 1 ? 'border-gray-200 shadow-gray-50' :
                  index === 2 ? 'border-orange-100' : 'border-gray-100'
                }`}
              >
                <MedalBadge position={index + 1} />
                
                <div className="flex-1 min-w-0">
                  <h3 className={`font-black text-gray-800 truncate ${index === 0 ? 'text-lg' : 'text-sm'}`}>
                    {item.nome}
                  </h3>
                  {index === 0 && (
                    <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider flex items-center gap-1">
                      <IoFlameOutline /> Melhor do período
                    </span>
                  )}
                </div>

                {tab === 'garcons' ? (
                  <div className="flex items-center gap-4 sm:gap-6 text-right">
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase">Pedidos</p>
                      <p className="text-lg font-black text-gray-800">{item.pedidos}</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-[9px] font-black text-gray-400 uppercase">Ticket Médio</p>
                      <p className="text-sm font-bold text-blue-600">R$ {item.ticketMedio.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase">Faturou</p>
                      <p className={`font-black ${index === 0 ? 'text-lg text-emerald-600' : 'text-sm text-emerald-600'}`}>
                        R$ {item.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 sm:gap-6 text-right">
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase">Entregas</p>
                      <p className="text-lg font-black text-gray-800">{item.entregas}</p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-[9px] font-black text-gray-400 uppercase">Taxa Média</p>
                      <p className="text-sm font-bold text-purple-600">R$ {item.mediaTaxa.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase">Total Taxas</p>
                      <p className={`font-black ${index === 0 ? 'text-lg text-emerald-600' : 'text-sm text-emerald-600'}`}>
                        R$ {item.taxasTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default withEstablishmentAuth(RankingFuncionarios);
