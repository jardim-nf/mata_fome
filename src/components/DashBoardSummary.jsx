// src/components/DashboardSummary.jsx

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { startOfDay, endOfDay } from 'date-fns';

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
  const { estabelecimentoId } = useAuth();
  const [summaryData, setSummaryData] = useState({ totalVendas: 0, totalPedidos: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!estabelecimentoId) {
      setLoading(false);
      return;
    }

    const fetchSummaryData = async () => {
      try {
        setLoading(true);
        const hojeInicio = startOfDay(new Date());
        const hojeFim = endOfDay(new Date());

        const pedidosRef = collection(db, 'pedidos');
        
        const q = query(
          pedidosRef,
          where('estabelecimentoId', '==', estabelecimentoId),
          where('tipo', 'in', ['delivery', 'salao']),
          where('status', '==', 'finalizado'), 
          where('createdAt', '>=', hojeInicio),
          where('createdAt', '<=', hojeFim)
        );

        const querySnapshot = await getDocs(q);
        
        let vendas = 0;
        let pedidosContagem = querySnapshot.docs.length;

        querySnapshot.forEach((doc) => {
          const pedido = doc.data();
          // =========== CORREÇÃO FINAL AQUI ===========
          // Trocamos 'pedido.total' por 'pedido.totalFinal'
          vendas += Number(pedido.totalFinal) || Number(pedido.total) || 0; 
          // ===========================================
        });

        setSummaryData({
          totalVendas: vendas,
          totalPedidos: pedidosContagem,
        });

      } catch (err) {
        console.error("ERRO AO BUSCAR RESUMO DO DASHBOARD:", err); 
        setError("Falha ao carregar dados. Verifique o console (F12).");
      } finally {
        setLoading(false);
      }
    };

    fetchSummaryData();
  }, [estabelecimentoId]);

  if (loading) {
    return <div className="text-center p-4 text-gray-400">Carregando resumo...</div>;
  }

  if (error) {
    return <div className="text-center p-4 text-red-500">{error}</div>;
  }

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