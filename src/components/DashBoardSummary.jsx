// src/components/DashBoardSummary.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, doc, onSnapshot, getDoc, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { 
  IoStatsChart, IoCart, IoRestaurant, IoCash, IoBicycle, 
  IoEye, IoEyeOff, IoCalendarOutline 
} from 'react-icons/io5';

// --- COMPONENTE DO CARD (VISUAL) ---
const StatCard = ({ title, value, subtext, icon: Icon, colorClass, loading }) => (
  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between relative overflow-hidden group">
    <div className={`absolute right-0 top-0 w-24 h-24 ${colorClass} opacity-5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`}></div>
    
    <div className="flex items-start justify-between mb-4 z-10">
      <div>
        <p className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">{title}</p>
        {loading ? (
          <div className="h-8 w-24 bg-gray-200 rounded animate-pulse"></div>
        ) : (
          <h3 className="text-3xl font-extrabold text-gray-900 tracking-tight">{value}</h3>
        )}
      </div>
      <div className={`p-3 rounded-xl ${colorClass} bg-opacity-10 text-xl`}>
        <Icon className={colorClass.replace('bg-', 'text-')} />
      </div>
    </div>
    {subtext && <p className="text-xs text-gray-400 font-medium mt-auto z-10 border-t border-gray-50 pt-2">{subtext}</p>}
  </div>
);

const DashBoardSummary = () => {
  const { primeiroEstabelecimento } = useAuth(); 
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line no-unused-vars
  const [nomeEstabelecimento, setNomeEstabelecimento] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  // Estados dos pedidos brutos
  const [pedidosDelivery, setPedidosDelivery] = useState([]);
  const [pedidosSalao, setPedidosSalao] = useState([]);

  // --- 1. BUSCA DE DADOS EM TEMPO REAL ---
  useEffect(() => {
    if (!primeiroEstabelecimento) { setLoading(false); return; }

    getDoc(doc(db, 'estabelecimentos', primeiroEstabelecimento)).then(snap => {
        if (snap.exists()) setNomeEstabelecimento(snap.data().nome);
    });

    // DELIVERY: Busca os últimos 100 pedidos (independente da data para filtrar no front)
    const qDelivery = query(
        collection(db, 'pedidos'),
        where('estabelecimentoId', '==', primeiroEstabelecimento),
        orderBy('createdAt', 'desc'),
        limit(100) 
    );

    const unsubDelivery = onSnapshot(qDelivery, (snapshot) => {
        const pedidos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'delivery' }));
        console.log("🔥 [DEBUG] Pedidos Delivery Carregados:", pedidos.length);
        setPedidosDelivery(pedidos);
    });

    // SALÃO
    const qSalao = query(
        collection(db, 'estabelecimentos', primeiroEstabelecimento, 'pedidos'),
        orderBy('dataPedido', 'desc'),
        limit(100)
    );

    const unsubSalao = onSnapshot(qSalao, (snapshot) => {
        const pedidos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'salao' }));
        setPedidosSalao(pedidos);
        setLoading(false);
    });

    return () => { unsubDelivery(); unsubSalao(); };
  }, [primeiroEstabelecimento]);

  // --- 2. CÁLCULOS OTIMIZADOS (USEMEMO) ---
  const stats = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Zera hora para comparar apenas a data

    let totalFat = 0, fatSalao = 0, fatDelivery = 0;
    let countSalao = 0, countDelivery = 0;
    let somaTempos = 0, countTempos = 0;
    
    const motoboyMap = {};

    // Helper: Converte Timestamp Firestore para Date JS
    const getDate = (timestamp) => {
        if (!timestamp) return null;
        if (timestamp.toDate) return timestamp.toDate();
        if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
        return new Date(timestamp); 
    };

    // Helper: Limpa valor monetário (Resolve problema de R$ e Vírgulas)
    const parseCurrency = (val) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        // Remove 'R$', espaços e troca vírgula por ponto
        const cleanStr = String(val).replace('R$', '').replace(/\s/g, '').replace(',', '.');
        const num = parseFloat(cleanStr);
        return isNaN(num) ? 0 : num;
    };

    const processarLista = (lista, origem) => {
        lista.forEach(pedido => {
            if (pedido.status === 'cancelado') return;

            // 1. VERIFICAÇÃO DE DATA
            const dataPedido = getDate(pedido.createdAt || pedido.dataPedido || pedido.updatedAt);
            
            // Se não tiver data ou a data for anterior a hoje (00:00), ignora
            if (!dataPedido || dataPedido < hoje) return;

            // 2. CÁLCULO DO VALOR (BLINDADO)
            // Tenta pegar de totalFinal, total ou valorTotal
            let valorCru = pedido.totalFinal ?? pedido.total ?? pedido.valorTotal ?? 0;
            let valor = parseCurrency(valorCru);

            console.log(`💰 [DEBUG] Pedido ${pedido.id} (${origem}): R$ ${valor} (Original: ${valorCru})`);

            // Contagem de Tempo
            if (pedido.tempoPreparo) {
                somaTempos += Number(pedido.tempoPreparo);
                countTempos++;
            }

            // Separação por Origem e Soma
            if (origem === 'salao' || pedido.tipo === 'salao') {
                fatSalao += valor;
                countSalao++;
            } else {
                fatDelivery += valor;
                countDelivery++;

                // Entregadores
                if (pedido.motoboyId || pedido.motoboyNome) {
                    const idMoto = pedido.motoboyId || pedido.motoboyNome;
                    const nomeMoto = pedido.motoboyNome || 'Desconhecido';
                    
                    let taxa = parseCurrency(pedido.taxaEntrega || pedido.deliveryFee || pedido.paymentData?.deliveryFee || 0);

                    if (!motoboyMap[idMoto]) {
                        motoboyMap[idMoto] = { id: idMoto, nome: nomeMoto, qtd: 0, totalTaxas: 0 };
                    }
                    motoboyMap[idMoto].qtd += 1;
                    motoboyMap[idMoto].totalTaxas += taxa;
                }
            }
        });
    };

    processarLista(pedidosSalao, 'salao');
    processarLista(pedidosDelivery, 'delivery');

    totalFat = fatSalao + fatDelivery;
    const totalPedidos = countSalao + countDelivery;
    const entregadoresList = Object.values(motoboyMap).sort((a, b) => b.qtd - a.qtd);

    return {
        pedidosHoje: totalPedidos,
        faturamentoHoje: totalFat,
        pedidosSalao: countSalao,
        faturamentoSalao: fatSalao,
        pedidosDelivery: countDelivery,
        faturamentoDelivery: fatDelivery,
        tempoMedio: countTempos > 0 ? `${Math.round(somaTempos / countTempos)} min` : '--',
        ticketMedio: totalPedidos > 0 ? totalFat / totalPedidos : 0,
        entregadoresAtivos: entregadoresList,
        totalTaxasEntregadores: entregadoresList.reduce((acc, m) => acc + m.totalTaxas, 0)
    };

  }, [pedidosDelivery, pedidosSalao]);

  const formatarMoeda = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  // --- RENDERIZAÇÃO ---
  return (
    <div className="space-y-6 mb-8">
      
      {/* CABEÇALHO DO RESUMO */}
      <div className="flex w-full justify-between items-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm gap-4">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <IoCalendarOutline size={20} />
            </div>
            <div>
                <h2 className="text-lg font-bold text-gray-800 leading-tight">Painel Diário</h2>
                <p className="text-xs text-gray-500">Dados de hoje ({new Date().toLocaleDateString('pt-BR')})</p>
            </div>
        </div>
        <button 
            onClick={() => setIsExpanded(!isExpanded)} 
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200"
        >
            {isExpanded ? <><IoEyeOff className="text-lg" /> Ocultar</> : <><IoEye className="text-lg" /> Ver Detalhes</>}
        </button>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fadeIn">
          <StatCard 
            title="Faturamento Total" 
            value={formatarMoeda(stats.faturamentoHoje)} 
            subtext={`${stats.pedidosHoje} pedidos realizados hoje`} 
            icon={IoCash} 
            colorClass="bg-green-500" 
            loading={loading} 
          />
          <StatCard 
            title="Delivery" 
            value={formatarMoeda(stats.faturamentoDelivery)} 
            subtext={`${stats.pedidosDelivery} pedidos pelo App`} 
            icon={IoCart} 
            colorClass="bg-blue-500" 
            loading={loading} 
          />
          <StatCard 
            title="Mesa / Balcão" 
            value={formatarMoeda(stats.faturamentoSalao)} 
            subtext={`${stats.pedidosSalao} atendimentos`} 
            icon={IoRestaurant} 
            colorClass="bg-orange-500" 
            loading={loading} 
          />
          <StatCard 
            title="Ticket Médio" 
            value={formatarMoeda(stats.ticketMedio)} 
            subtext={`Tempo prep. médio: ${stats.tempoMedio}`} 
            icon={IoStatsChart} 
            colorClass="bg-purple-500" 
            loading={loading} 
          />
        </div>
      )}

      {/* SEÇÃO DE ENTREGADORES (SEMPRE VISÍVEL SE HOUVER DADOS) */}
      {isExpanded && stats.entregadoresAtivos.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm animate-fadeIn">
            <div className="flex justify-between items-end mb-6">
                <h3 className="text-gray-800 font-bold flex items-center gap-2 text-lg">
                    <IoBicycle className="text-orange-600 text-2xl" /> 
                    Produtividade da Frota
                    <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">{stats.entregadoresAtivos.length} ativos</span>
                </h3>
                <div className="text-right">
                     <p className="text-xs text-gray-400 font-bold uppercase">Total Repasses</p>
                     <p className="text-xl font-bold text-green-600">{formatarMoeda(stats.totalTaxasEntregadores)}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {stats.entregadoresAtivos.map((moto, index) => (
                    <div key={moto.id || index} className="group bg-gray-50 hover:bg-white border border-gray-200 hover:border-orange-200 rounded-xl p-4 transition-all duration-200 shadow-sm hover:shadow-md">
                        <div className="flex justify-between items-start mb-2">
                            <div className="w-10 h-10 bg-white text-orange-600 border border-orange-100 rounded-full flex justify-center items-center font-bold text-sm shadow-sm">
                                {moto.nome ? moto.nome.charAt(0).toUpperCase() : '?'}
                            </div>
                            <span className="bg-gray-200 text-gray-600 text-[10px] font-bold px-2 py-1 rounded-full group-hover:bg-orange-100 group-hover:text-orange-700 transition-colors">
                                #{index + 1}
                            </span>
                        </div>
                        
                        <div>
                            <p className="font-bold text-gray-800 text-sm truncate" title={moto.nome}>{moto.nome}</p>
                            <p className="text-xs text-gray-500 mb-2">{moto.qtd} entregas hoje</p>
                            <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                                <span className="text-[10px] text-gray-400 font-bold">A RECEBER</span>
                                <span className="font-bold text-green-600 text-sm">{formatarMoeda(moto.totalTaxas)}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default DashBoardSummary;