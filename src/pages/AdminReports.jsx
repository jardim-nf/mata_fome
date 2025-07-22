// src/pages/admin/AdminReports.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs, limit, startAfter } from 'firebase/firestore'; // Importe limit e startAfter
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { format, startOfDay, endOfDay, subDays, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement
);

const ITEMS_PER_PAGE_REPORT_TABLE = 10; // Itens por página para a tabela de detalhes

// Se você tiver um componente Layout, descomente a linha abaixo e as tags <Layout>
// import Layout from '../../Layout'; // Verifique o caminho exato!

function AdminReports() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [estabelecimentosList, setEstabelecimentosList] = useState([]);
  
  // Estados dos filtros
  const [selectedEstabelecimento, setSelectedEstabelecimento] = useState('todos');
  const [startDate, setStartDate] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportType, setReportType] = useState('vendas_por_dia');

  // Estados dos resultados do relatório
  const [reportData, setReportData] = useState([]); // Dados para a tabela ou gráfico principal
  const [summaryData, setSummaryData] = useState({ totalVendas: 0, totalPedidos: 0, ticketMedio: 0 });
  const [loadingReport, setLoadingReport] = useState(false);

  // ESTADOS DE PAGINAÇÃO PARA A TABELA DE DETALHES (reportType === 'total_vendas_pedidos')
  const [reportTableCurrentPage, setReportTableCurrentPage] = useState(0);
  const [reportTableHasMore, setReportTableHasMore] = useState(true);
  const [reportTableHasPrevious, setReportTableHasPrevious] = useState(false);
  const [reportTableLastVisible, setReportTableLastVisible] = useState(null); // Último documento do snapshot da query

  // Controle de acesso
  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isMasterAdmin) {
        toast.error('Acesso negado. Você não tem permissões de Master Administrador.');
        navigate('/master-dashboard');
        return;
      }
      setLoading(false);
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  // Carregar lista de estabelecimentos para o filtro
  useEffect(() => {
    const fetchEstabelecimentos = async () => {
      try {
        const q = query(collection(db, 'estabelecimentos'), orderBy('nome', 'asc'));
        const querySnapshot = await getDocs(q);
        const list = querySnapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }));
        setEstabelecimentosList(list);
      } catch (err) {
        console.error("Erro ao carregar lista de estabelecimentos:", err);
        toast.error("Erro ao carregar lista de estabelecimentos para filtro.");
      }
    };
    fetchEstabelecimentos();
  }, []);

  // Função principal para gerar o relatório
  const generateReport = async (e, direction = 'next', startDoc = null) => { // Adicionado direction e startDoc
    e?.preventDefault(); // Evita erro se chamado sem evento
    setLoadingReport(true);
    setError('');
    
    // Resetar paginação da tabela de detalhes ao gerar novo relatório ou mudar filtros principais
    if (e) { // Se a chamada veio de um evento de formulário (primeira geração/filtro)
      setReportData([]); // Limpar dados do relatório principal
      setSummaryData({ totalVendas: 0, totalPedidos: 0, ticketMedio: 0 }); // Resetar resumo
      setReportTableCurrentPage(0);
      setReportTableHasMore(true);
      setReportTableHasPrevious(false);
      setReportTableLastVisible(null);
    }


    try {
      const startTimestamp = startOfDay(new Date(startDate));
      const endTimestamp = endOfDay(new Date(endDate));

      let qPedidosBase = collection(db, 'pedidos');
      let queryConstraintsBase = [
        where('criadoEm', '>=', startTimestamp),
        where('criadoEm', '<=', endTimestamp),
        orderBy('criadoEm', 'asc')
      ];

      if (selectedEstabelecimento !== 'todos') {
        queryConstraintsBase.push(where('estabelecimentoId', '==', selectedEstabelecimento));
      }

      // --- PRIMEIRA BUSCA: TODOS OS PEDIDOS PARA CÁLCULO DE RESUMO E TIPOS DE RELATÓRIO QUE NÃO SÃO PAGINADOS ---
      // Apenas para os relatórios que precisam de todos os dados (vendas_por_dia, itens_mais_vendidos, resumo geral)
      // OU para a primeira carga do relatório total_vendas_pedidos
      let allPedidos = [];
      if (reportType !== 'total_vendas_pedidos' || (e && !startDoc)) { // Se não for o tipo detalhado paginado, ou se for a primeira carga
        const allPedidosQuery = query(qPedidosBase, ...queryConstraintsBase);
        const allPedidosSnapshot = await getDocs(allPedidosQuery);
        allPedidos = allPedidosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        let totalVendasCalculado = 0;
        let totalPedidosCalculado = allPedidos.length;

        allPedidos.forEach(pedido => {
          totalVendasCalculado += typeof pedido.totalFinal === 'number' ? pedido.totalFinal : 0;
        });
        
        const ticketMedioCalculado = totalPedidosCalculado > 0 ? (totalVendasCalculado / totalPedidosCalculado) : 0;
        
        setSummaryData({
          totalVendas: totalVendasCalculado,
          totalPedidos: totalPedidosCalculado,
          ticketMedio: ticketMedioCalculado,
        });
      }


      // --- LÓGICA ESPECÍFICA PARA CADA TIPO DE RELATÓRIO ---
      if (reportType === 'vendas_por_dia') {
        const salesByDayMap = new Map();
        let currentDay = new Date(startTimestamp);
        while (currentDay <= endTimestamp) {
          salesByDayMap.set(format(currentDay, 'dd/MM/yyyy', { locale: ptBR }), 0);
          currentDay = new Date(currentDay.setDate(currentDay.getDate() + 1));
        }

        allPedidos.forEach(pedido => {
          if (pedido.criadoEm && pedido.criadoEm.toDate && typeof pedido.totalFinal === 'number') {
            const dateKey = format(pedido.criadoEm.toDate(), 'dd/MM/yyyy', { locale: ptBR });
            salesByDayMap.set(dateKey, (salesByDayMap.get(dateKey) || 0) + pedido.totalFinal);
          }
        });
        setReportData(Array.from(salesByDayMap.entries()));

      } else if (reportType === 'itens_mais_vendidos') {
        const itemSalesMap = new Map();
        allPedidos.forEach(pedido => {
          if (pedido.itens && Array.isArray(pedido.itens)) {
            pedido.itens.forEach(item => {
              const itemId = item.id || item.nome;
              const currentItem = itemSalesMap.get(itemId) || { nome: item.nome, totalQuantidade: 0, totalVendas: 0 };
              
              currentItem.totalQuantidade += typeof item.quantidade === 'number' ? item.quantidade : 0;
              currentItem.totalVendas += (typeof item.quantidade === 'number' && typeof item.preco === 'number') ? (item.quantidade * item.preco) : 0;
              
              if (item.adicionais && Array.isArray(item.adicionais)) {
                item.adicionais.forEach(add => {
                  currentItem.totalVendas += (typeof add.quantidade === 'number' && typeof add.preco === 'number') ? (add.quantidade * add.preco) : 0;
                });
              }
              itemSalesMap.set(itemId, currentItem);
            });
          }
        });
        const sortedItems = Array.from(itemSalesMap.values()).sort((a, b) => b.totalQuantidade - a.totalQuantidade);
        setReportData(sortedItems);

      } else if (reportType === 'total_vendas_pedidos') {
        // --- PAGINAÇÃO PARA RELATÓRIO DE DETALHES DE PEDIDOS ---
        let qPaginatedPedidos = query(qPedidosBase, ...queryConstraintsBase);

        if (direction === 'next' && startDoc) {
          qPaginatedPedidos = query(qPaginatedPedidos, startAfter(startDoc), limit(ITEMS_PER_PAGE_REPORT_TABLE));
        } else if (direction === 'prev' && startDoc) {
          // Para "anterior", precisamos inverter a ordem da consulta e depois os resultados
          // Este é um desafio comum em paginação reversa no Firestore.
          // Para este exemplo, simplificaremos a navegação "anterior" para a primeira página
          // se não houver um array de marcadores de página anteriores.
          qPaginatedPedidos = query(qPaginatedPedidos, limit(ITEMS_PER_PAGE_REPORT_TABLE));
        } else {
          qPaginatedPedidos = query(qPaginatedPedidos, limit(ITEMS_PER_PAGE_REPORT_TABLE));
        }
        
        const paginatedSnapshot = await getDocs(qPaginatedPedidos);
        let fetchedPaginatedPedidos = [];
        if (direction === 'prev') {
          fetchedPaginatedPedidos = paginatedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();
        } else {
          fetchedPaginatedPedidos = paginatedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        const pedidosWithFormattedData = fetchedPaginatedPedidos.map(p => ({
            id: p.id,
            estabelecimentoId: p.estabelecimentoId,
            clienteNome: p.cliente?.nome,
            totalFinal: typeof p.totalFinal === 'number' ? p.totalFinal : 0,
            status: p.status,
            criadoEm: p.criadoEm?.toDate ? format(p.criadoEm.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'
        }));
        setReportData(pedidosWithFormattedData);

        // Atualiza estados de paginação da tabela
        if (paginatedSnapshot.docs.length > 0) {
          setReportTableLastVisible(paginatedSnapshot.docs[paginatedSnapshot.docs.length - 1]);
          const nextCheckQuery = query(qPedidosBase, ...queryConstraintsBase, startAfter(paginatedSnapshot.docs[paginatedSnapshot.docs.length - 1]), limit(1));
          const nextCheckSnapshot = await getDocs(nextCheckQuery);
          setReportTableHasMore(!nextCheckSnapshot.empty);
        } else {
          setReportTableLastVisible(null);
          setReportTableHasMore(false);
        }
        setReportTableHasPrevious(reportTableCurrentPage > 0);
      }

    } catch (err) {
      console.error("Erro ao gerar relatório:", err);
      setError("Erro ao gerar o relatório. Verifique as datas ou a conexão.");
    } finally {
      setLoadingReport(false);
    }
  };

  // Exportar dados (CSV)
  const exportReport = () => {
    if (reportData.length === 0) {
      toast.info("Não há dados para exportar.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    let headers = [];
    let rows = [];

    if (reportType === 'vendas_por_dia') {
        headers = ["Data", "Vendas (R$)"];
        rows = reportData.map(item => [`"${item[0]}"`, (typeof item[1] === 'number' ? item[1].toFixed(2) : '0.00').replace('.', ',')]);
    } else if (reportType === 'itens_mais_vendidos') {
        headers = ["Item", "Quantidade Vendida", "Total Vendas (R$)"];
        rows = reportData.map(item => [`"${item.nome}"`, item.totalQuantidade, (typeof item.totalVendas === 'number' ? item.totalVendas.toFixed(2) : '0.00').replace('.', ',')]);
    } else if (reportType === 'total_vendas_pedidos') {
        headers = ["ID Pedido", "Estabelecimento ID", "Cliente", "Total (R$)", "Status", "Data Criacao"];
        // Para exportação, podemos buscar todos os pedidos do período novamente para garantir que todos os dados sejam exportados
        // e não apenas a página atual. Isso pode ser otimizado com uma nova função `fetchAllPedidosForExport`.
        // Por simplicidade, este exportará APENAS os `reportData` que estão na página atual da tabela.
        rows = reportData.map(p => [
            `"${p.id}"`,
            `"${p.estabelecimentoId || 'N/A'}"`,
            `"${p.clienteNome || 'N/A'}"`,
            (typeof p.totalFinal === 'number' ? p.totalFinal.toFixed(2) : '0.00').replace('.', ','),
            `"${p.status || 'N/A'}"`,
            `"${p.criadoEm || 'N/A'}"`
        ]);
    }
    
    csvContent += headers.join(";") + "\n";
    rows.forEach(rowArray => {
        let row = rowArray.join(";");
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_${reportType}_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Relatório exportado com sucesso!");
  };

  const salesChartLabels = reportData.length > 0 && reportType === 'vendas_por_dia' ? reportData.map(item => item[0]) : [];
  const salesChartValues = reportData.length > 0 && reportType === 'vendas_por_dia' ? reportData.map(item => item[1]) : [];

  const salesChartData = {
    labels: salesChartLabels,
    datasets: [
      {
        label: 'Vendas Diárias (R$)',
        data: salesChartValues,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        tension: 0.1,
        fill: false,
      },
    ],
  };

  const salesChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Vendas por Dia no Período' },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed.y !== null) label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y);
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }
        }
      }
    }
  };


  if (authLoading || loading) {
    return (
      // <Layout>
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
          <p className="text-xl text-gray-700">Carregando relatórios...</p>
        </div>
      // </Layout>
    );
  }

  if (!currentUser || !isMasterAdmin) {
    return null;
  }

  return (
    // <Layout>
      <div className="p-4 bg-gray-100 min-h-screen">
        <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-lg p-6">
          {/* Cabeçalho */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              📊 Relatórios Master
            </h1>
            {/* BOTÃO "VOLTAR" PADRONIZADO AQUI */}
            <Link 
              to="/master-dashboard" 
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md font-semibold hover:bg-gray-300 flex items-center gap-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"></path></svg>
              Voltar
            </Link>
          </div>

          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
              <p className="font-bold">Erro:</p>
              <p>{error}</p>
            </div>
          )}

          {/* Formulário de Filtros do Relatório */}
          <form onSubmit={(e) => generateReport(e, 'next', null)} className="bg-gray-50 p-6 rounded-lg shadow-inner mb-8 space-y-4">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Gerar Relatório</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="estabelecimentoSelect" className="block text-sm font-medium text-gray-700">Estabelecimento:</label>
                <select
                  id="estabelecimentoSelect"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                  value={selectedEstabelecimento}
                  onChange={(e) => setSelectedEstabelecimento(e.target.value)}
                >
                  <option value="todos">Todos os Estabelecimentos</option>
                  {estabelecimentosList.map(estab => (
                    <option key={estab.id} value={estab.id}>{estab.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Data Início:</label>
                <input
                  type="date"
                  id="startDate"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">Data Fim:</label>
                <input
                  type="date"
                  id="endDate"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reportType" className="block text-sm font-medium text-gray-700">Tipo de Relatório:</label>
                <select
                  id="reportType"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                >
                  <option value="vendas_por_dia">Vendas por Dia (Gráfico)</option>
                  <option value="itens_mais_vendidos">Itens Mais Vendidos</option>
                  <option value="total_vendas_pedidos">Totais de Vendas e Pedidos (Detalhado)</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={loadingReport}
                  className="w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {loadingReport ? 'Gerando...' : 'Gerar Relatório'}
                </button>
              </div>
            </div>
          </form>

          {/* Seção de Resumo do Relatório */}
          { (reportData.length > 0 || summaryData.totalPedidos > 0) && !loadingReport && (
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Resumo do Período</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                    <div>
                        <p className="text-sm text-gray-600">Total de Vendas</p>
                        <p className="text-2xl font-bold text-green-600">R$ {summaryData.totalVendas.toFixed(2).replace('.', ',')}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Total de Pedidos</p>
                        <p className="text-2xl font-bold text-blue-600">{summaryData.totalPedidos}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600">Ticket Médio</p>
                        <p className="text-2xl font-bold text-orange-600">R$ {typeof summaryData.ticketMedio === 'number' ? summaryData.ticketMedio.toFixed(2).replace('.', ',') : '0,00'}</p>
                    </div>
                </div>
                <div className="flex justify-end mt-6">
                    <button
                        onClick={exportReport}
                        className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 shadow-md flex items-center gap-1"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        Exportar CSV
                    </button>
                </div>
            </div>
          )}


          {loadingReport ? (
            <div className="text-center py-10">
              <p className="text-gray-600">Gerando relatório...</p>
            </div>
          ) : (reportData.length === 0 && summaryData.totalPedidos === 0 && !error) ? (
            <div className="text-center py-10">
              <p className="text-gray-500">Nenhum dado encontrado para o período e filtros selecionados.</p>
            </div>
          ) : (reportData.length > 0 || summaryData.totalPedidos > 0) && (
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800">Detalhes do Relatório</h2>

                    {reportType === 'vendas_por_dia' && reportData.length > 0 && (
                        <div className="h-96">
                        <Line data={salesChartData} options={salesChartOptions} />
                        </div>
                    )}

                    {reportType === 'itens_mais_vendidos' && reportData.length > 0 && (
                        <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantidade Vendida</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total em Vendas</th>
                            </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                            {reportData.map((item, index) => (
                                <tr key={index}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.nome}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.totalQuantidade}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">R$ {typeof item.totalVendas === 'number' ? item.totalVendas.toFixed(2).replace('.', ',') : '0,00'}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                        </div>
                    )}

                    {reportType === 'total_vendas_pedidos' && reportData.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Pedido</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estabelecimento</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Criado Em</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {reportData.map((pedido) => (
                                        <tr key={pedido.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{pedido.id?.substring(0,8)}...</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{estabelecimentosList.find(e => e.id === pedido.estabelecimentoId)?.nome || pedido.estabelecimentoId?.substring(0,8) || 'N/A'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pedido.clienteNome || 'N/A'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">R$ {typeof pedido.totalFinal === 'number' ? pedido.totalFinal.toFixed(2).replace('.', ',') : '0,00'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pedido.status || 'N/A'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{pedido.criadoEm || 'N/A'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )
          }

          {/* CONTROLES DE PAGINAÇÃO DA TABELA DE DETALHES (SE FOR total_vendas_pedidos) */}
          {reportType === 'total_vendas_pedidos' && (reportData.length > 0 || summaryData.totalPedidos > 0) && !loadingReport && (
              <div className="flex justify-center items-center mt-8 space-x-4">
                  <button
                      onClick={handlePreviousReportPage}
                      disabled={reportTableCurrentPage === 0 || loadingReport}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md font-semibold hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      Anterior
                  </button>
                  <span className="text-gray-700">Página {reportTableCurrentPage + 1}</span>
                  <button
                      onClick={handleNextReportPage}
                      disabled={!reportTableHasMore || loadingReport}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      Próxima
                  </button>
              </div>
          )}
        </div>
      </div>
    // </Layout>
  );
}

export default AdminReports;