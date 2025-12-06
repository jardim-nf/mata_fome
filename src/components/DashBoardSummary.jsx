// src/components/DashBoardSummary.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { IoStatsChart, IoCart, IoRestaurant, IoCash, IoBicycle, IoEye, IoEyeOff } from 'react-icons/io5';

const StatCard = ({ title, value, subtext, icon: Icon, colorClass, loading }) => (
  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 h-full flex flex-col justify-between">
    <div className="flex items-start justify-between mb-4">
      <div>
        <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
        {loading ? (
          <div className="h-8 w-24 bg-gray-200 rounded animate-pulse"></div>
        ) : (
          <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        )}
      </div>
      <div className={`p-3 rounded-xl ${colorClass} bg-opacity-10`}>
        <Icon className={`text-2xl ${colorClass.replace('bg-', 'text-')}`} />
      </div>
    </div>
    {subtext && <p className="text-xs text-gray-400 mt-auto">{subtext}</p>}
  </div>
);

const DashBoardSummary = () => {
  const { primeiroEstabelecimento } = useAuth(); 
  const [loading, setLoading] = useState(true);
  const [nomeEstabelecimento, setNomeEstabelecimento] = useState('');
  
  const [isExpanded, setIsExpanded] = useState(true);
  
  const [stats, setStats] = useState({
    pedidosHoje: 0, faturamentoHoje: 0, pedidosSalao: 0, pedidosDelivery: 0,
    faturamentoSalao: 0, faturamentoDelivery: 0, tempoMedio: '0 min',
    ticketMedio: 0, entregadoresAtivos: [], totalTaxasEntregadores: 0
  });

  const [pedidosDelivery, setPedidosDelivery] = useState([]);
  const [pedidosSalao, setPedidosSalao] = useState([]);

  const showEndOfDayStats = useMemo(() => {
    const HOUR_CUTOFF = 18; 
    const now = new Date();
    return now.getHours() >= HOUR_CUTOFF;
  }, []);

  // Função para converter timestamp
  const converterTimestampParaDate = (timestamp) => {
    if (!timestamp) return null;
    try {
      if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
      if (timestamp.toDate) return timestamp.toDate();
      if (timestamp instanceof Date) return timestamp;
    } catch (error) { console.error(error); }
    return null;
  };

  useEffect(() => {
    if (!primeiroEstabelecimento) { setLoading(false); return; }

    getDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento)).then(snap => {
        if (snap.exists()) setNomeEstabelecimento(snap.data().nome);
    });

    // DELIVERY
    const qDelivery = query(
        collection(db, 'pedidos'),
        where('estabelecimentoId', '==', primeiroEstabelecimento),
        orderBy('createdAt', 'desc')
    );

    const unsubDelivery = onSnapshot(qDelivery, (snapshot) => {
        const pedidos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'delivery' }));
        setPedidosDelivery(pedidos);
    });

    // SALÃO
    const qSalao = query(
        collection(db, 'estabelecimentos', primeiroEstabelecimento, 'pedidos'),
        orderBy('dataPedido', 'desc')
    );

    const unsubSalao = onSnapshot(qSalao, (snapshot) => {
        const pedidos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'salao' }));
        setPedidosSalao(pedidos);
        setLoading(false);
    });

    return () => { unsubDelivery(); unsubSalao(); };
  }, [primeiroEstabelecimento]);

  useEffect(() => {
    if (loading) return;

    // Inicialização das variáveis
    let totalFat = 0, fatSalao = 0, fatDelivery = 0;
    let countSalao = 0, countDelivery = 0;
    let somaTempos = 0, countTempos = 0;
    const motoboyMap = {};
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const processarPedido = (pedido, origem) => {
      // --- LÓGICA DE DATA ---
      let dataBase = pedido.createdAt;
      if (origem === 'salao' || pedido.tipo === 'salao') {
            dataBase = pedido.dataPedido || pedido.updatedAt || pedido.createdAt; 
      }
      const dataPedido = converterTimestampParaDate(dataBase);
      const isHoje = dataPedido && dataPedido >= hoje;

      // FILTRO: Se não for de hoje, ignora o pedido
      if (!isHoje) return;

      if (pedido.status === 'cancelado') return;

      // --- CÁLCULO DE VALOR ---
      let valorTotal = 0;

      if (pedido.totalFinal !== undefined && pedido.totalFinal !== null) {
        valorTotal = Number(pedido.totalFinal);
      } else if (pedido.total !== undefined && pedido.total !== null) {
        valorTotal = Number(pedido.total);
      } 
      
      if (valorTotal <= 0 || isNaN(valorTotal)) { 
        if (pedido.itens && Array.isArray(pedido.itens)) {
            valorTotal = pedido.itens.reduce((acc, item) => {
                if (!item) return acc;
                const preco = parseFloat(item.preco) || Number(item.preco) || 0; 
                const qtd = parseFloat(item.quantidade) || Number(item.quantidade) || 1; 
                return acc + (preco * qtd);
            }, 0);
        }
      }
      
      valorTotal = isNaN(valorTotal) ? 0 : valorTotal; 

      // --- SOMA NOS TOTAIS ---
      if (pedido.tempoPreparo) {
        somaTempos += Number(pedido.tempoPreparo);
        countTempos++;
      }

      if (origem === 'salao' || pedido.tipo === 'salao') {
        fatSalao += valorTotal;
        countSalao++;
      } else {
        fatDelivery += valorTotal;
        countDelivery++;
        
        // Lógica de Taxas (apenas delivery)
        let taxa = 0;
        if (pedido.taxaEntrega !== undefined) taxa = Number(pedido.taxaEntrega);
        else if (pedido.deliveryFee !== undefined) taxa = Number(pedido.deliveryFee);
        
        if (isNaN(taxa)) taxa = 0;
        if (taxa === 0 && pedido.paymentData?.deliveryFee) taxa = Number(pedido.paymentData.deliveryFee);

        if (pedido.motoboyId || pedido.motoboyNome) {
          const key = pedido.motoboyId || pedido.motoboyNome; 
          if (!motoboyMap[key]) motoboyMap[key] = { nome: pedido.motoboyNome || '?', qtd: 0, total: 0, id: key, taxaMedia: 0 };
          motoboyMap[key].qtd++;
          motoboyMap[key].total += taxa;
        }
      }
    };

    // Processa as listas
    pedidosSalao.forEach(pedido => processarPedido(pedido, 'salao'));
    pedidosDelivery.forEach(pedido => processarPedido(pedido, 'delivery'));

    // Atualiza totais (sem redeclarar com const)
    totalFat = fatSalao + fatDelivery; 
    
    const totalPedidos = countSalao + countDelivery;
    
    Object.keys(motoboyMap).forEach(key => {
      if (motoboyMap[key].qtd > 0) motoboyMap[key].taxaMedia = motoboyMap[key].total / motoboyMap[key].qtd;
    });
    const totalTaxasEntregadores = Object.values(motoboyMap).reduce((acc, moto) => acc + moto.total, 0);
    
    setStats({
      pedidosHoje: totalPedidos,
      faturamentoHoje: totalFat,
      pedidosSalao: countSalao,
      faturamentoSalao: fatSalao,
      pedidosDelivery: countDelivery,
      faturamentoDelivery: fatDelivery,
      tempoMedio: countTempos > 0 ? `${Math.round(somaTempos / countTempos)} min` : '0 min',
      ticketMedio: totalPedidos > 0 ? totalFat / totalPedidos : 0,
      nomeEstabelecimento: nomeEstabelecimento,
      entregadoresAtivos: Object.values(motoboyMap).sort((a,b) => b.qtd - a.qtd),
      totalTaxasEntregadores: totalTaxasEntregadores
    });

  }, [pedidosDelivery, pedidosSalao, nomeEstabelecimento, loading]);

  const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

  return (
    <div className="space-y-6 mb-8">
      <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800">Resumo de Vendas Hoje</h2>
        <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-blue-600 hover:bg-blue-50 transition-colors">
          {isExpanded ? <><IoEyeOff className="text-xl" /> Ocultar Detalhes</> : <><IoEye className="text-xl" /> Mostrar Detalhes</>}
        </button>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Faturamento Hoje" value={formatarMoeda(stats.faturamentoHoje)} subtext={`${stats.pedidosHoje} pedidos totais`} icon={IoCash} colorClass="bg-green-500" loading={loading} />
          <StatCard title="Delivery" value={formatarMoeda(stats.faturamentoDelivery)} subtext={`${stats.pedidosDelivery} pedidos via App`} icon={IoCart} colorClass="bg-blue-500" loading={loading} />
          <StatCard title="Salão" value={formatarMoeda(stats.faturamentoSalao)} subtext={`${stats.pedidosSalao} mesas atendidas`} icon={IoRestaurant} colorClass="bg-orange-500" loading={loading} />
          <StatCard title="Ticket Médio" value={formatarMoeda(stats.ticketMedio)} subtext={`Tempo médio: ${stats.tempoMedio}`} icon={IoStatsChart} colorClass="bg-purple-500" loading={loading} />
        </div>
      )}

      {isExpanded && showEndOfDayStats ? (
        stats.entregadoresAtivos.length > 0 ? (
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-gray-700 font-bold mb-4 flex items-center gap-2"><IoBicycle className="text-orange-600" /> Entregadores Hoje ({stats.entregadoresAtivos.reduce((acc, m) => acc + m.qtd, 0)})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {stats.entregadoresAtivos.map((moto, index) => (
                      <div key={index} className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex justify-between items-center shadow-sm">
                          <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex justify-center items-center font-bold text-xs">{moto.nome ? moto.nome.charAt(0) : '?'}</div>
                              <div><span className="font-bold text-gray-800 text-sm">{moto.nome}</span><br/><span className="text-xs text-gray-500">{moto.qtd} entregas</span></div>
                          </div>
                          <div className="text-right ml-4"><span className="block font-bold text-green-600">{formatarMoeda(moto.total)}</span></div>
                      </div>
                  ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm"><div className="text-gray-600 font-bold">Total taxas:</div><span className="font-bold text-green-600 text-lg">{formatarMoeda(stats.totalTaxasEntregadores)}</span></div>
          </div>
        ) : <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 text-sm text-gray-600">Sem entregadores ativos.</div>
      ) : <div className="bg-gray-100 border border-gray-200 rounded-2xl p-6 text-sm text-gray-600">Estatísticas de entregadores disponíveis após às 18:00.</div>}
    </div>
  );
};

export default DashBoardSummary;