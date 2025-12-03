import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { 
  IoStatsChart, 
  IoCart, 
  IoRestaurant, 
  IoCash
} from 'react-icons/io5';

// Componente visual do Card
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
  // ✅ CORREÇÃO: Pega o ID do contexto em vez de usar string fixa
  const { primeiroEstabelecimento } = useAuth(); 
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pedidosHoje: 0,
    faturamentoHoje: 0,
    pedidosSalao: 0,
    tempoMedio: '0 min',
    ticketMedio: 0,
    nomeEstabelecimento: ''
  });

  useEffect(() => {
    const fetchStats = async () => {
      // Trava de segurança
      if (!primeiroEstabelecimento) {
        setLoading(false);
        return;
      }

      try {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        // 1. Buscar Nome do Estabelecimento (Visual)
        const estabRef = doc(db, 'estabelecimentos', primeiroEstabelecimento);
        const estabSnap = await getDoc(estabRef);
        let nomeEstab = '';
        if (estabSnap.exists()) {
            nomeEstab = estabSnap.data().nome;
        }

        // 2. Buscar Pedidos do Dia
        const pedidosRef = collection(db, 'estabelecimentos', primeiroEstabelecimento, 'pedidos');
        const qHoje = query(
          pedidosRef,
          where('createdAt', '>=', hoje),
          orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(qHoje);
        
        let totalFaturamento = 0;
        let countSalao = 0;
        let countDelivery = 0;
        let somaTempos = 0;
        let countTempos = 0;

        snapshot.docs.forEach(doc => {
          const data = doc.data();
          
          // Ignora cancelados
          if (data.status !== 'cancelado') {
            totalFaturamento += Number(data.total || 0);
          }

          // Separação Salão/Delivery
          if (data.tipo === 'salao' || data.mesaIndex !== undefined) {
            countSalao++;
          } else {
            countDelivery++;
          }

          // Tempo médio
          if (data.tempoPreparo) {
             somaTempos += Number(data.tempoPreparo);
             countTempos++;
          }
        });

        const totalPedidos = snapshot.size;
        const ticketMedio = totalPedidos > 0 ? totalFaturamento / totalPedidos : 0;
        const tempoMedio = countTempos > 0 ? Math.round(somaTempos / countTempos) : 35;

        setStats({
          pedidosHoje: totalPedidos,
          faturamentoHoje: totalFaturamento,
          pedidosSalao: countSalao,
          tempoMedio: `${tempoMedio} min`,
          ticketMedio: ticketMedio,
          nomeEstabelecimento: nomeEstab
        });

      } catch (error) {
        console.error("Erro ao carregar stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [primeiroEstabelecimento]); // Recarrega se mudar a loja

  return (
    <div className="space-y-4 mb-8">
      {/* Badge de Identificação da Loja */}
      {stats.nomeEstabelecimento && (
        <div className="inline-flex items-center space-x-2 text-sm text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 shadow-sm">
          <IoRestaurant className="text-blue-600" />
          <span>Loja Ativa: <strong>{stats.nomeEstabelecimento}</strong></span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Faturamento Hoje"
          value={`R$ ${stats.faturamentoHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          subtext={`${stats.pedidosHoje} pedidos realizados`}
          icon={IoCash}
          colorClass="bg-green-500"
          loading={loading}
        />
        
        <StatCard
          title="Delivery"
          value={stats.pedidosHoje - stats.pedidosSalao}
          subtext="Pedidos via App/Site"
          icon={IoCart}
          colorClass="bg-blue-500"
          loading={loading}
        />

        <StatCard
          title="Salão"
          value={stats.pedidosSalao}
          subtext="Mesas atendidas hoje"
          icon={IoRestaurant}
          colorClass="bg-orange-500"
          loading={loading}
        />

        <StatCard
          title="Ticket Médio"
          value={`R$ ${stats.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          subtext={`Tempo médio: ${stats.tempoMedio}`}
          icon={IoStatsChart}
          colorClass="bg-purple-500"
          loading={loading}
        />
      </div>
    </div>
  );
};

export default DashBoardSummary;