import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { IoStatsChart, IoCart, IoRestaurant, IoCash, IoBicycle, IoCalendarOutline, IoTicket } from 'react-icons/io5';

// --- CARD VISUAL ULTRA COMPACTO ---
const StatCard = ({ title, value, sub, icon: Icon, theme, loading }) => {
  const t = {
    green: 'bg-emerald-500 text-emerald-600 bg-emerald-50',
    blue: 'bg-blue-500 text-blue-600 bg-blue-50',
    orange: 'bg-orange-500 text-orange-600 bg-orange-50',
    purple: 'bg-purple-500 text-purple-600 bg-purple-50',
  }[theme].split(' ');

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 transition-transform group-hover:scale-110 ${t[0]}`}></div>
      <div className="flex justify-between items-start mb-2 z-10">
        <div>
          <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{title}</p>
          {loading ? <div className="h-8 w-24 bg-gray-100 rounded animate-pulse"></div> : <h3 className="text-2xl md:text-3xl font-black text-gray-800 tracking-tight">{value}</h3>}
        </div>
        <div className={`p-3 rounded-2xl ${t[1]} ${t[2]} shrink-0`}><Icon size={24} /></div>
      </div>
      <p className="text-[10px] md:text-xs font-medium text-gray-500 mt-auto pt-3 border-t border-gray-50 z-10">{sub}</p>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---
const DashBoardSummary = ({ onVerRelatorio }) => {
  const { primeiroEstabelecimento } = useAuth(); 
  const [loading, setLoading] = useState(true);

  // Estados do Filtro de Datas (Inicia com hoje)
  const hojeStr = new Date().toISOString().split('T')[0];
  const [dataInicio, setDataInicio] = useState(hojeStr);
  const [dataFim, setDataFim] = useState(hojeStr);

  const [pedidosDelivery, setPedidosDelivery] = useState([]);
  const [pedidosSalao, setPedidosSalao] = useState([]);

  // 1. BUSCA NO FIREBASE COM FILTRO DE DATAS
  useEffect(() => {
    if (!primeiroEstabelecimento || !dataInicio || !dataFim) return;
    setLoading(true);

    // Ajusta os horários para pegar do início do primeiro dia até o final do último dia
    const start = new Date(`${dataInicio}T00:00:00`);
    const end = new Date(`${dataFim}T23:59:59.999`);

    const qDel = query(collection(db, 'pedidos'),
      where('estabelecimentoId', '==', primeiroEstabelecimento),
      where('createdAt', '>=', start), where('createdAt', '<=', end)
    );
    const unsubDel = onSnapshot(qDel, snap => setPedidosDelivery(snap.docs.map(d => d.data())));

    const qSalao = query(collection(db, 'estabelecimentos', primeiroEstabelecimento, 'vendas'),
      where('criadoEm', '>=', start), where('criadoEm', '<=', end)
    );
    const unsubSalao = onSnapshot(qSalao, snap => {
      setPedidosSalao(snap.docs.map(d => d.data()));
      setLoading(false);
    });

    return () => { unsubDel(); unsubSalao(); };
  }, [primeiroEstabelecimento, dataInicio, dataFim]);

  // 2. MATEMÁTICA ENXUTA
  const stats = useMemo(() => {
    let fatSalao = 0, fatDel = 0, totalTaxas = 0, frota = {};
    const parse = val => parseFloat(String(val || 0).replace(/[R$\s]/g, '').replace(',', '.')) || 0;

    pedidosSalao.forEach(p => p.status !== 'cancelado' && (fatSalao += parse(p.totalFinal || p.total || p.valorTotal)));
    pedidosDelivery.forEach(p => {
      if (p.status === 'cancelado') return;
      fatDel += parse(p.totalFinal || p.total || p.valorTotal);
      
      if (p.motoboyNome || p.motoboyId) {
        const moto = p.motoboyNome || 'Desconhecido';
        if (!frota[moto]) frota[moto] = { nome: moto, qtd: 0, taxas: 0 };
        frota[moto].qtd++;
        frota[moto].taxas += parse(p.taxaEntrega || p.deliveryFee);
        totalTaxas += parse(p.taxaEntrega || p.deliveryFee);
      }
    });

    const totPeds = pedidosSalao.length + pedidosDelivery.length;
    return {
      fatTotal: fatSalao + fatDel, totPeds, fatSalao, fatDel, totalTaxas,
      qtdSalao: pedidosSalao.length, qtdDel: pedidosDelivery.length,
      ticket: totPeds ? (fatSalao + fatDel) / totPeds : 0,
      entregadores: Object.values(frota).sort((a, b) => b.qtd - a.qtd)
    };
  }, [pedidosDelivery, pedidosSalao]);

  const formata = val => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="space-y-4 md:space-y-6 mb-8 animate-fadeIn">
      
      {/* HEADER COM FILTRO DE DATAS */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-white p-4 md:p-5 rounded-2xl border border-gray-100 shadow-sm gap-4">
        <div className="flex items-center gap-3 md:gap-4 shrink-0">
          <div className="p-3 bg-gray-50 text-gray-800 rounded-xl"><IoCalendarOutline size={24} /></div>
          <div>
            <h2 className="text-lg md:text-xl font-black text-gray-800 leading-tight">Painel de Resultados</h2>
            <p className="text-xs font-medium text-gray-500">Selecione o período desejado</p>
          </div>
        </div>

        {/* FILTROS DE DATA E BOTÕES */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 flex-1 xl:flex-none">
            <span className="text-xs font-bold text-gray-400 mr-2 uppercase">De</span>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="bg-transparent text-sm font-semibold text-gray-700 outline-none w-full" />
          </div>
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 flex-1 xl:flex-none">
            <span className="text-xs font-bold text-gray-400 mr-2 uppercase">Até</span>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="bg-transparent text-sm font-semibold text-gray-700 outline-none w-full" />
          </div>
          
          {onVerRelatorio && (
            <button onClick={onVerRelatorio} className="flex items-center justify-center gap-2 bg-purple-50 text-purple-600 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-purple-100 transition-colors shrink-0 w-full sm:w-auto">
              <IoTicket size={18} /> Relatório de Tickets
            </button>
          )}
        </div>
      </div>

      {/* CARDS PRINCIPAIS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
        <StatCard title="Faturamento Total" value={formata(stats.fatTotal)} sub={`${stats.totPeds} pedidos no período`} icon={IoCash} theme="green" loading={loading} />
        <StatCard title="Delivery" value={formata(stats.fatDel)} sub={`${stats.qtdDel} pedidos recebidos`} icon={IoCart} theme="blue" loading={loading} />
        <StatCard title="Salão / Balcão" value={formata(stats.fatSalao)} sub={`${stats.qtdSalao} atendimentos`} icon={IoRestaurant} theme="orange" loading={loading} />
        <StatCard title="Ticket Médio" value={formata(stats.ticket)} sub="Valor médio por pedido" icon={IoStatsChart} theme="purple" loading={loading} />
      </div>

      {/* ENTREGADORES */}
      {!loading && stats.entregadores.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
            <h3 className="text-gray-800 font-bold flex items-center gap-2 text-sm md:text-base">
              <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><IoBicycle size={20} /></div>
              Frota Ativa no Período <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-full">{stats.entregadores.length}</span>
            </h3>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Repasses Totais</p>
              <p className="text-lg md:text-xl font-black text-emerald-600">{formata(stats.totalTaxas)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {stats.entregadores.map((moto, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-orange-200 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center font-bold text-gray-600 shadow-sm text-xs">
                    {moto.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 text-xs md:text-sm truncate max-w-[120px]">{moto.nome}</p>
                    <p className="text-[10px] text-gray-500 font-medium">{moto.qtd} entregas</p>
                  </div>
                </div>
                <span className="font-black text-emerald-600 text-sm">{formata(moto.taxas)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashBoardSummary;