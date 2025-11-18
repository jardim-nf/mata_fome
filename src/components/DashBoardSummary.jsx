// src/components/DashboardSummary.jsx - VERSÃO COM ATUALIZAÇÃO AUTOMÁTICA
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { startOfDay, endOfDay } from 'date-fns';
import { toast } from 'react-toastify';

// Componente de Card para exibir as estatísticas
const StatCard = ({ title, value, icon, color }) => (
  <div className={`p-4 rounded-lg shadow-md ${color}`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-white opacity-80">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
      <div className="text-3xl text-white opacity-50">{icon}</div>
    </div>
  </div>
);

// Componente Spinner para o estado de carregamento
const SummarySpinner = () => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div className="p-4 rounded-lg shadow-md bg-gray-800 text-center text-gray-400 col-span-3">
      <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p className="mt-2 text-sm">Carregando resumo do dia...</p>
    </div>
  </div>
);

// Formata um número para o padrão BRL (R$)
const formatBRL = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function DashboardSummary() {
  const { currentUser, estabelecimentoIdPrincipal } = useAuth();
  const [summaryData, setSummaryData] = useState({
    totalVendasHoje: 0,
    totalTaxasHoje: 0,
    totalPedidosHoje: 0,
    vendasDelivery: 0,
    vendasSalao: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Função para buscar dados
  const fetchSummaryData = async () => {
    if (!currentUser || !estabelecimentoIdPrincipal) {
      setLoading(false);
      return;
    }

    try {
      console.log("📊 Buscando resumo para estabelecimento:", estabelecimentoIdPrincipal);

      // Define as datas e strings para filtro
      const todayStart = startOfDay(new Date());
      const todayEnd = endOfDay(new Date());
      const todayString = new Date().toISOString().split('T')[0];

      console.log(`DEBUG DATA: Filtro do dia: ${todayString}`);

      let totalVendas = 0;
      let totalTaxas = 0;
      let totalPedidos = 0;
      let vendasDeliveryCount = 0;
      let vendasSalaoCount = 0;

      // 1. BUSCAR PEDIDOS DE DELIVERY (FINALIZADOS) - COM ATUALIZAÇÃO EM TEMPO REAL
      try {
        const pedidosQuery = query(
          collection(db, 'pedidos'),
          where('estabelecimentoId', '==', estabelecimentoIdPrincipal),
          where('status', 'in', ['finalizado', 'concluido']),
          where('createdAt', '>=', todayStart),
          where('createdAt', '<=', todayEnd)
        );

        const pedidosSnapshot = await getDocs(pedidosQuery);
        pedidosSnapshot.forEach(doc => {
          const pedido = doc.data();
          totalVendas += parseFloat(pedido.totalFinal || pedido.total || 0);
          totalTaxas += parseFloat(pedido.taxaEntrega || 0);
          totalPedidos++;
          vendasDeliveryCount++;
        });
        console.log(`DEBUG DELIVERY: Encontrados ${pedidosSnapshot.size} pedidos.`);

      } catch (error) {
        console.error("❌ ERRO NO FETCH DELIVERY:", error);
        if (error.code === 'permission-denied') {
          toast.error("Permissão negada para ler pedidos de delivery.");
        }
      }

      // 2. BUSCAR VENDAS DO SALÃO - COM ATUALIZAÇÃO EM TEMPO REAL
      try {
        const vendasQuery = query(
          collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'vendas'),
          where('dataFechamentoString', '==', todayString)
        );

        const vendasSnapshot = await getDocs(vendasQuery);
        
        console.log(`DEBUG SALÃO: Encontradas ${vendasSnapshot.size} vendas de salão.`);
        
        vendasSnapshot.forEach(doc => {
          const venda = doc.data();
          totalVendas += parseFloat(venda.total || 0);
          totalPedidos++;
          vendasSalaoCount++;
        });

      } catch (error) {
        console.error("❌ ERRO NO FETCH SALÃO:", error);
        if (error.code === 'permission-denied') {
          toast.error("Permissão negada para ler vendas do salão.");
        }
      }

      console.log("📈 Resumo carregado:", {
        totalPedidos,
        totalVendas,
        totalTaxas,
        vendasDelivery: vendasDeliveryCount,
        vendasSalao: vendasSalaoCount
      });

      // Atualizar o estado com os novos dados
      setSummaryData({
        totalVendasHoje: totalVendas,
        totalTaxasHoje: totalTaxas,
        totalPedidosHoje: totalPedidos,
        vendasDelivery: vendasDeliveryCount,
        vendasSalao: vendasSalaoCount
      });

    } catch (error) {
      console.error("❌ ERRO GERAL AO BUSCAR RESUMO:", error);
      setError("Erro geral ao carregar dados do dia.");
      toast.error("❌ Falha ao carregar o dashboard.");
    } finally {
      setLoading(false);
    }
  };

  // 🔄 EFEITO PARA ATUALIZAÇÃO AUTOMÁTICA
  useEffect(() => {
    fetchSummaryData(); // Carregamento inicial

    if (!estabelecimentoIdPrincipal) return;

    // Configurar atualização automática a cada 30 segundos
    const interval = setInterval(fetchSummaryData, 30000);

    // Configurar listeners em tempo real para atualizações imediatas
    const todayString = new Date().toISOString().split('T')[0];
    
    // Listener para pedidos de delivery
    const pedidosQuery = query(
      collection(db, 'pedidos'),
      where('estabelecimentoId', '==', estabelecimentoIdPrincipal),
      where('status', 'in', ['finalizado', 'concluido']),
      where('createdAt', '>=', startOfDay(new Date())),
      where('createdAt', '<=', endOfDay(new Date()))
    );

    const unsubscribePedidos = onSnapshot(pedidosQuery, 
      (snapshot) => {
        console.log("🔄 Atualização em tempo real - Pedidos alterados");
        fetchSummaryData(); // Recarrega quando houver mudanças
      },
      (error) => {
        console.error("❌ Erro no listener de pedidos:", error);
      }
    );

    // Listener para vendas do salão
    const vendasQuery = query(
      collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'vendas'),
      where('dataFechamentoString', '==', todayString)
    );

    const unsubscribeVendas = onSnapshot(vendasQuery,
      (snapshot) => {
        console.log("🔄 Atualização em tempo real - Vendas alteradas");
        fetchSummaryData(); // Recarrega quando houver mudanças
      },
      (error) => {
        console.error("❌ Erro no listener de vendas:", error);
      }
    );

    // Cleanup function
    return () => {
      clearInterval(interval);
      unsubscribePedidos();
      unsubscribeVendas();
    };
  }, [currentUser, estabelecimentoIdPrincipal]);

  // 🔄 BOTÃO DE ATUALIZAÇÃO MANUAL
  const handleRefresh = () => {
    setLoading(true);
    fetchSummaryData();
  };

  if (loading) {
    return <SummarySpinner />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-lg shadow-md bg-red-100 border border-red-300 text-center text-red-700">
          <p className="text-sm">{error}</p>
          <button 
            onClick={handleRefresh}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com botão de atualização */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Resumo do Dia</h2>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          title="Atualizar dados"
        >
          <span>🔄</span>
          Atualizar
        </button>
      </div>

      {/* Linha 1: Totais Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Faturamento Total Hoje"
          value={formatBRL(summaryData.totalVendasHoje)}
          icon="💵"
          color="bg-gradient-to-br from-green-600 to-green-800"
        />
        <StatCard
          title="Total de Vendas Hoje"
          value={summaryData.totalPedidosHoje}
          icon="📋"
          color="bg-gradient-to-br from-blue-600 to-blue-800"
        />
        <StatCard
          title="Taxas de Entrega (Hoje)"
          value={formatBRL(summaryData.totalTaxasHoje)}
          icon="🛵"
          color="bg-gradient-to-br from-cyan-500 to-teal-600"
        />
      </div>

      {/* Linha 2: Detalhamento por Tipo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard
          title="Vendas Delivery"
          value={summaryData.vendasDelivery}
          icon="🚚"
          color="bg-gradient-to-br from-orange-500 to-orange-700"
        />
        <StatCard
          title="Vendas Salão"
          value={summaryData.vendasSalao}
          icon="🍽️"
          color="bg-gradient-to-br from-purple-500 to-purple-700"
        />
      </div>

      {/* Indicador de última atualização */}
      <div className="text-center">
        <p className="text-xs text-gray-500">
          Última atualização: {new Date().toLocaleTimeString('pt-BR')}
        </p>
      </div>
    </div>
  );
}