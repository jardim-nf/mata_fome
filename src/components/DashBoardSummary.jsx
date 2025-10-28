// src/components/DashBoardSummary.jsx

import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; // Verifique se o caminho para o firebase está correto
import { useAuth } from '../context/AuthContext'; // Verifique se o caminho do AuthContext está correto
import { collection, query, where, getDocs } from 'firebase/firestore';
import { startOfDay } from 'date-fns'; // Usado para pegar o início do dia

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
  const { currentUser } = useAuth();
  const [summaryData, setSummaryData] = useState({
    totalVendasHoje: 0,
    totalTaxasHoje: 0,
    totalPedidosHoje: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummaryData = async () => {
      // Garante que o usuário está carregado
      if (!currentUser) return; 

      try {
        // 1. Obter o ID do estabelecimento (exatamente como no Painel.js)
        const idTokenResult = await currentUser.getIdTokenResult(true);
        const { estabelecimentoId } = idTokenResult.claims;

        if (!estabelecimentoId) {
          setLoading(false);
          return; // Sai se não houver ID
        }

        // 2. Definir o filtro de data (somente hoje)
        const todayStart = startOfDay(new Date());

        // 3. Criar a query para buscar pedidos de HOJE e FINALIZADOS
        const q = query(
          collection(db, 'pedidos'),
          where('estabelecimentoId', '==', estabelecimentoId),
          where('status', '==', 'finalizado'), // Apenas pedidos finalizados
          where('createdAt', '>=', todayStart) // Criados de hoje em diante
        );

        // 4. Executar a query (usamos getDocs para pegar os dados apenas uma vez)
        const querySnapshot = await getDocs(q);
        
        let totalVendas = 0;
        let totalTaxas = 0;
        let totalPedidos = querySnapshot.docs.length; // Total de pedidos finalizados hoje

        // 5. Calcular os totais iterando sobre os pedidos
        querySnapshot.forEach(doc => {
          const pedido = doc.data();

          // Soma o valor total do pedido
          totalVendas += parseFloat(pedido.totalFinal || pedido.total || 0);

          // Soma a taxa de entrega SOMENTE se for do tipo 'delivery'
          if (pedido.tipo === 'delivery') {
            totalTaxas += parseFloat(pedido.taxaEntrega || 0);
          }
        });

        // 6. Atualizar o estado com os novos dados
        setSummaryData({
          totalVendasHoje: totalVendas,
          totalTaxasHoje: totalTaxas,
          totalPedidosHoje: totalPedidos,
        });

      } catch (error) {
        console.error("Erro ao buscar resumo do dashboard:", error);
        // Você pode adicionar um toast.error aqui se quiser
      } finally {
        setLoading(false); // Para o spinner
      }
    };

    fetchSummaryData();
  }, [currentUser]); // Executa a função sempre que o usuário (currentUser) mudar

  if (loading) {
    return <SummarySpinner />;
  }

  // Renderiza os cards com os valores
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatCard
        title="Vendas Hoje"
        value={formatBRL(summaryData.totalVendasHoje)}
        icon="💵"
        color="bg-gradient-to-br from-green-600 to-green-800"
      />
      <StatCard
        title="Pedidos Hoje (Finalizados)"
        value={summaryData.totalPedidosHoje}
        icon="📋"
        color="bg-gradient-to-br from-blue-600 to-blue-800"
      />
      {/* ======================================================= */}
      {/* ESTE É O CARD QUE VOCÊ QUERIA                               */}
      {/* ======================================================= */}
      <StatCard
        title="Taxas de Entrega (Hoje)"
        value={formatBRL(summaryData.totalTaxasHoje)}
        icon="🛵"
        color="bg-gradient-to-br from-cyan-500 to-teal-600"
      />
    </div>
  );
}