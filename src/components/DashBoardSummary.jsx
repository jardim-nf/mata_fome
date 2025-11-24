// src/components/DashboardSummary.jsx - VERSÃO CORRIGIDA
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
    vendasSalao: 0,
    totalDelivery: 0,
    totalSalao: 0
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

      // Define as datas para filtro
      const todayStart = startOfDay(new Date());
      const todayEnd = endOfDay(new Date());

      console.log(`DEBUG DATA: Filtro do dia: ${todayStart.toISOString()} até ${todayEnd.toISOString()}`);

      let totalVendas = 0;
      let totalTaxas = 0;
      let totalPedidos = 0;
      let vendasDeliveryCount = 0;
      let vendasSalaoCount = 0;
      let totalDelivery = 0;
      let totalSalao = 0;

      // 1. 🛵 BUSCAR PEDIDOS DE DELIVERY (FINALIZADOS)
      try {
        const pedidosQuery = query(
          collection(db, 'pedidos'),
          where('estabelecimentoId', '==', estabelecimentoIdPrincipal),
          where('status', '==', 'finalizado'),
          where('createdAt', '>=', todayStart),
          where('createdAt', '<=', todayEnd)
        );

        const pedidosSnapshot = await getDocs(pedidosQuery);
        console.log(`DEBUG DELIVERY: Encontrados ${pedidosSnapshot.size} pedidos de delivery.`);

        pedidosSnapshot.forEach(doc => {
          const pedido = doc.data();
          const valorPedido = parseFloat(pedido.totalFinal || pedido.total || 0);
          const taxaEntrega = parseFloat(pedido.taxaEntrega || 0);
          
          totalVendas += valorPedido;
          totalTaxas += taxaEntrega;
          totalPedidos++;
          vendasDeliveryCount++;
          totalDelivery += valorPedido;
          
          console.log(`📦 Pedido Delivery: ${doc.id} - R$ ${valorPedido} (Taxa: R$ ${taxaEntrega})`);
        });

      } catch (error) {
        console.error("❌ ERRO NO FETCH DELIVERY:", error);
        if (error.code === 'failed-precondition') {
          console.log('⚠️ Índice composto necessário para pedidos de delivery');
        }
      }

      // 2. 🍽️ BUSCAR VENDAS DO SALÃO (MESAS FECHADAS)
      try {
        const vendasQuery = query(
          collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'vendas'),
          where('dataFechamento', '>=', todayStart),
          where('dataFechamento', '<=', todayEnd)
        );

        const vendasSnapshot = await getDocs(vendasQuery);
        
        console.log(`DEBUG SALÃO: Encontradas ${vendasSnapshot.size} vendas de salão.`);
        
        vendasSnapshot.forEach(doc => {
          const venda = doc.data();
          const valorVenda = parseFloat(venda.total || 0);
          
          totalVendas += valorVenda;
          totalPedidos++;
          vendasSalaoCount++;
          totalSalao += valorVenda;
          
          console.log(`🍽️ Venda Salão: Mesa ${venda.mesaNumero} - R$ ${valorVenda}`, {
            mesaId: venda.mesaId,
            pessoas: venda.pessoas,
            itens: venda.itens?.length || 0
          });
        });

      } catch (error) {
        console.error("❌ ERRO NO FETCH SALÃO:", error);
        if (error.code === 'failed-precondition') {
          console.log('⚠️ Índice composto necessário para vendas do salão');
        }
      }

      // 3. 🔄 BUSCAR VENDAS ALTERNATIVA (se a anterior falhar)
      if (vendasSalaoCount === 0) {
        try {
          console.log('🔄 Tentando busca alternativa de vendas do salão...');
          
          const vendasAltQuery = query(
            collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'vendas')
          );

          const vendasAltSnapshot = await getDocs(vendasAltQuery);
          let vendasHojeCount = 0;
          let totalSalaoAlt = 0;

          vendasAltSnapshot.forEach(doc => {
            const venda = doc.data();
            const dataFechamento = venda.dataFechamento?.toDate();
            
            if (dataFechamento && dataFechamento >= todayStart && dataFechamento <= todayEnd) {
              const valorVenda = parseFloat(venda.total || 0);
              totalVendas += valorVenda;
              totalPedidos++;
              vendasHojeCount++;
              totalSalaoAlt += valorVenda;
              
              console.log(`🍽️ Venda Salão (alt): Mesa ${venda.mesaNumero} - R$ ${valorVenda}`);
            }
          });

          if (vendasHojeCount > 0) {
            vendasSalaoCount = vendasHojeCount;
            totalSalao = totalSalaoAlt;
            console.log(`✅ Encontradas ${vendasHojeCount} vendas do salão (busca alternativa)`);
          }

        } catch (error) {
          console.error("❌ ERRO NA BUSCA ALTERNATIVA:", error);
        }
      }

      console.log("📈 Resumo final carregado:", {
        totalPedidos,
        totalVendas: formatBRL(totalVendas),
        totalTaxas: formatBRL(totalTaxas),
        vendasDelivery: vendasDeliveryCount,
        vendasSalao: vendasSalaoCount,
        totalDelivery: formatBRL(totalDelivery),
        totalSalao: formatBRL(totalSalao)
      });

      // Atualizar o estado com os novos dados
      setSummaryData({
        totalVendasHoje: totalVendas,
        totalTaxasHoje: totalTaxas,
        totalPedidosHoje: totalPedidos,
        vendasDelivery: vendasDeliveryCount,
        vendasSalao: vendasSalaoCount,
        totalDelivery: totalDelivery,
        totalSalao: totalSalao
      });

    } catch (error) {
      console.error("❌ ERRO GERAL AO BUSCAR RESUMO:", error);
      setError("Erro ao carregar dados do dia.");
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
    
    // Listener para pedidos de delivery
    try {
      const todayStart = startOfDay(new Date());
      const todayEnd = endOfDay(new Date());
      
      const pedidosQuery = query(
        collection(db, 'pedidos'),
        where('estabelecimentoId', '==', estabelecimentoIdPrincipal),
        where('status', '==', 'finalizado'),
        where('createdAt', '>=', todayStart),
        where('createdAt', '<=', todayEnd)
      );

      const unsubscribePedidos = onSnapshot(pedidosQuery, 
        (snapshot) => {
          console.log("🔄 Atualização em tempo real - Pedidos delivery alterados");
          fetchSummaryData();
        },
        (error) => {
          console.error("❌ Erro no listener de pedidos:", error);
        }
      );

      // Listener para vendas do salão
      const vendasQuery = query(
        collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'vendas'),
        where('dataFechamento', '>=', todayStart),
        where('dataFechamento', '<=', todayEnd)
      );

      const unsubscribeVendas = onSnapshot(vendasQuery,
        (snapshot) => {
          console.log("🔄 Atualização em tempo real - Vendas salão alteradas");
          fetchSummaryData();
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
    } catch (error) {
      console.error("❌ Erro ao configurar listeners:", error);
    }

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

      {/* Linha 3: Valores por Tipo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard
          title="Faturamento Delivery"
          value={formatBRL(summaryData.totalDelivery)}
          icon="💰"
          color="bg-gradient-to-br from-yellow-500 to-yellow-700"
        />
        <StatCard
          title="Faturamento Salão"
          value={formatBRL(summaryData.totalSalao)}
          icon="💳"
          color="bg-gradient-to-br from-pink-500 to-pink-700"
        />
      </div>

      {/* Indicador de última atualização */}
      <div className="text-center">
        <p className="text-xs text-gray-500">
          Última atualização: {new Date().toLocaleTimeString('pt-BR')}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Atualização automática a cada 30 segundos
        </p>
      </div>
    </div>
  );
}