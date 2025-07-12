// src/pages/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

// Função auxiliar para formatar a data de hoje no formato 'YYYY-MM-DD'
const getTodayFormattedDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0'); // Mês de 0-11, então +1
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function AdminDashboard() {
  const [totalVendas, setTotalVendas] = useState(0);
  const [faturamentoTotal, setFaturamentoTotal] = useState(0);
  const [topSellingProducts, setTopSellingProducts] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  const [startDate, setStartDate] = useState(getTodayFormattedDate()); 
  const [endDate, setEndDate] = useState(getTodayFormattedDate());

  const [showPeriodFilter, setShowPeriodFilter] = useState(false); 

  useEffect(() => {
    console.log("AdminDashboard: useEffect mounted. Starting data fetch.");
    setLoading(true); 

    let q = query(
      collection(db, 'pedidos'),
      where('status', '==', 'finalizado'),
      orderBy('criadoEm', 'desc') 
    );

    if (startDate) {
      // <<-- MUDANÇA CRUCIAL AQUI: Interpreta a data no fuso horário local explicitamente -->>
      const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
      const startOfDay = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0); // Mês é 0-indexado
      const startTimestamp = Timestamp.fromDate(startOfDay);
      q = query(q, where('criadoEm', '>=', startTimestamp));
    }
    if (endDate) {
      // <<-- MUDANÇA CRUCIAL AQUI: Interpreta a data no fuso horário local explicitamente -->>
      const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
      const endOfDay = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999); // Mês é 0-indexado
      const endTimestamp = Timestamp.fromDate(endOfDay);
      q = query(q, where('criadoEm', '<=', endTimestamp));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log("AdminDashboard: onSnapshot received data.");
      let vendasCount = 0;
      let faturamentoSum = 0;
      const produtosVendidosMap = {}; 

      snapshot.forEach((doc) => {
        const pedido = doc.data();
        if (pedido.itens && Array.isArray(pedido.itens)) {
          vendasCount++; 
          
          const totalDoPedido = pedido.itens.reduce((acc, itemIndividual) => {
            const itemPrecoNumerico = Number(itemIndividual.preco);
            const itemQuantidadeNumerica = Number(itemIndividual.quantidade);

            if (!isNaN(itemPrecoNumerico) && !isNaN(itemQuantidadeNumerica)) {
              produtosVendidosMap[itemIndividual.nome] = 
                (produtosVendidosMap[itemIndividual.nome] || 0) + itemQuantidadeNumerica;

              return acc + (itemPrecoNumerico * itemQuantidadeNumerica);
            }
            return acc;
          }, 0);
          faturamentoSum += totalDoPedido;
        }
      });

      const sortedTopSellingProducts = Object.keys(produtosVendidosMap)
        .map(nome => ({ nome, quantidade: produtosVendidosMap[nome] }))
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 5); 

      setTotalVendas(vendasCount);
      setFaturamentoTotal(faturamentoSum);
      setTopSellingProducts(sortedTopSellingProducts); 
      setLoading(false); 
      console.log("AdminDashboard: Data loaded, loading set to false.");
    }, (error) => {
      console.error("AdminDashboard: Erro ao carregar dados do dashboard:", error);
      setLoading(false); 
    });

    return () => {
      unsubscribe();
      console.log("AdminDashboard: useEffect unmounted. Firestore listener unsubscribed.");
    };
  }, [startDate, endDate]);

  const handleApplyFilter = () => {
    // Ao clicar em 'Aplicar Filtro', o useEffect já será acionado pela mudança de startDate/endDate.
  };

  return (
    <div className="min-h-screen bg-[var(--bege-claro)] p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center text-[var(--vermelho-principal)] mb-8">
          Dashboard Administrativo
        </h1>

        {/* Botão para mostrar/esconder o filtro de período */}
        <div className="text-center mb-6">
            <button
                onClick={() => setShowPeriodFilter(!showPeriodFilter)}
                className="bg-gray-200 text-[var(--marrom-escuro)] px-6 py-2 rounded-lg font-semibold hover:bg-gray-300 transition duration-300"
            >
                {showPeriodFilter ? 'Esconder Filtro de Período' : 'Filtrar por Período Específico'}
            </button>
        </div>

        {/* Seção de Filtro por Período (condicionalmente visível) */}
        {showPeriodFilter && (
            <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200 flex flex-col sm:flex-row items-center justify-center gap-4">
                <label htmlFor="startDate" className="text-[var(--marrom-escuro)] font-medium">De:</label>
                <input
                    type="date"
                    id="startDate"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
                />

                <label htmlFor="endDate" className="text-[var(--marrom-escuro)] font-medium">Até:</label>
                <input
                    type="date"
                    id="endDate"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
                />

                <button
                    onClick={handleApplyFilter} 
                    className="bg-[var(--vermelho-principal)] text-white px-5 py-2 rounded-lg font-semibold hover:bg-red-700 transition duration-300"
                >
                    Aplicar Filtro
                </button>
            </div>
        )}


        {loading ? (
          <p className="text-center text-[var(--cinza-texto)] text-lg">Carregando dados...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            {/* Card de Vendas Finalizadas */}
            <div className="bg-blue-50 p-6 rounded-lg shadow-md border border-blue-200">
              <h2 className="text-xl font-semibold text-blue-800 mb-2">Vendas Finalizadas</h2>
              <p className="text-5xl font-extrabold text-blue-600">{totalVendas}</p>
              <p className="text-gray-600 mt-2">Pedidos concluídos com sucesso.</p>
            </div>

            {/* Card de Faturamento Total */}
            <div className="bg-green-50 p-6 rounded-lg shadow-md border border-green-200">
              <h2 className="text-xl font-semibold text-green-800 mb-2">Faturamento Total</h2>
              <p className="text-5xl font-extrabold text-green-600">R$ {faturamentoTotal.toFixed(2)}</p>
              <p className="text-gray-600 mt-2">Receita total dos pedidos finalizados.</p>
            </div>
            
            {/* Botão/Card: PAINEL DE PEDIDOS */}
            <Link 
              to={`/painel?startDate=${getTodayFormattedDate()}&endDate=${getTodayFormattedDate()}`} 
              className="bg-[var(--vermelho-principal)] p-6 rounded-lg shadow-md border border-red-200 flex flex-col justify-between items-center text-center transform transition duration-300 hover:scale-105 hover:shadow-lg"
              style={{ minHeight: '180px' }} 
            >
              <h2 className="text-xl font-semibold text-white mb-2">Painel de Pedidos</h2>
              <p className="text-5xl font-extrabold text-white">📋</p> 
              <p className="text-white text-opacity-90 mt-2">Gerenciar todos os pedidos.</p>
            </Link>

            {/* Nova Seção: Produtos Mais Vendidos */}
            <Link 
              to="/admin/gerenciar-cardapio" 
              className="bg-yellow-500 p-6 rounded-lg shadow-md border border-yellow-200 flex flex-col justify-between items-center text-center transform transition duration-300 hover:scale-105 hover:shadow-lg"
              style={{ minHeight: '180px' }} 
            >
              <h2 className="text-xl font-semibold text-white mb-2">Gerenciar Cardápio</h2>
              <p className="text-5xl font-extrabold text-white">🍔</p> 
              <p className="text-white text-opacity-90 mt-2">Adicionar e editar itens do menu.</p>
            </Link>
          </div>
        )}

        {loading ? (
            <p className="text-center text-[var(--cinza-texto)] text-lg mt-8">...</p>
        ) : topSellingProducts.length > 0 ? (
            <div className="mt-8 bg-white p-6 rounded-lg shadow-xl border border-gray-200">
                <h2 className="text-2xl font-bold text-[var(--marrom-escuro)] mb-6 text-center">Produtos Mais Vendidos</h2>
                <ul className="space-y-3">
                    {topSellingProducts.map((product, index) => (
                        <li key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-md border border-gray-100">
                            <span className="text-lg font-medium text-[var(--marrom-escuro)]">{index + 1}. {product.nome}</span>
                            <span className="text-lg font-bold text-[var(--verde-destaque)]">{product.quantidade} un.</span>
                        </li>
                    ))}
                </ul>
            </div>
        ) : (
            <p className="text-center text-[var(--cinza-texto)] italic mt-8">Nenhum produto vendido no período selecionado.</p>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;