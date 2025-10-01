// src/components/DashboardSummary.jsx

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { startOfDay, endOfDay } from 'date-fns';

// Um pequeno componente para os cartões de estatísticas
const StatCard = ({ title, value, icon, color }) => (
  <div className={`p-4 rounded-lg shadow-md flex items-center ${color}`}>
    <div className="text-3xl mr-4">{icon}</div>
    <div>
      <p className="text-sm text-white opacity-80">{title}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  </div>
);

const DashboardSummary = () => {
  // Pega o ID do estabelecimento do contexto de autenticação
  const { estabelecimentoId } = useAuth();
  
  // Estados para guardar os dados do resumo, o carregamento e possíveis erros
  const [summaryData, setSummaryData] = useState({ totalVendas: 0, totalPedidos: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // useEffect é o lugar correto para buscar dados.
  // A chave da correção está na array de dependências no final: [estabelecimentoId]
  // Isso garante que o código aqui dentro só vai rodar quando o componente for montado
  // e tiver o estabelecimentoId, evitando o loop infinito.
  useEffect(() => {
    // Se não tivermos o ID do estabelecimento, não fazemos nada.
    if (!estabelecimentoId) {
      setLoading(false);
      return;
    }

    const fetchSummaryData = async () => {
      try {
        // Pega as datas de hoje (do início ao fim do dia)
        const hojeInicio = startOfDay(new Date());
        const hojeFim = endOfDay(new Date());

        // Cria a consulta ao Firestore para pegar os pedidos FINALIZADOS de HOJE
        const pedidosRef = collection(db, 'pedidos');
        const q = query(
          pedidosRef,
          where('estabelecimentoId', '==', estabelecimentoId),
          where('status', '==', 'finalizado'),
          where('createdAt', '>=', hojeInicio),
          where('createdAt', '<=', hojeFim)
        );

        const querySnapshot = await getDocs(q);
        
        let vendas = 0;
        let pedidosContagem = 0;

        querySnapshot.forEach((doc) => {
          const pedido = doc.data();
          vendas += pedido.total || 0; // Soma o total de cada pedido
          pedidosContagem += 1; // Conta cada pedido
        });

        // Atualiza o estado com os dados calculados
        setSummaryData({
          totalVendas: vendas,
          totalPedidos: pedidosContagem,
        });

      } catch (err) {
        console.error("Erro ao buscar dados do resumo:", err);
        setError("Não foi possível carregar os dados.");
      } finally {
        // Garante que o estado de loading seja desativado, mesmo se der erro
        setLoading(false);
      }
    };

    fetchSummaryData();

  }, [estabelecimentoId]); // <-- A MÁGICA ACONTECE AQUI!

  // Enquanto os dados estão sendo carregados, exibe uma mensagem
  if (loading) {
    return <div className="text-center p-4 text-gray-400">Carregando resumo...</div>;
  }

  // Se ocorreu um erro, exibe a mensagem de erro
  if (error) {
    return <div className="text-center p-4 text-red-500">{error}</div>;
  }

  // Renderiza os cartões com os dados do resumo
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <StatCard 
        title="Vendas de Hoje"
        value={`R$ ${summaryData.totalVendas.toFixed(2).replace('.', ',')}`}
        icon="💰"
        color="bg-green-700 bg-opacity-50"
      />
      <StatCard 
        title="Pedidos Finalizados Hoje"
        value={summaryData.totalPedidos}
        icon="✅"
        color="bg-blue-700 bg-opacity-50"
      />
    </div>
  );
};

export default DashboardSummary;