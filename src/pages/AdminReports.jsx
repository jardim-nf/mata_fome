// src/pages/AdminReports.jsx
import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import jsPDF from 'jspdf'; // Importe jsPDF aqui!

// Função auxiliar para formatar a data para inputs
const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

function AdminReports() {
    const { currentUser, isAdmin, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [loadingReports, setLoadingReports] = useState(true);
    const [reportError, setReportError] = useState('');
    const [pedidos, setPedidos] = useState([]); // Dados brutos dos pedidos para relatórios
    const [cupons, setCupons] = useState([]); // Dados brutos dos cupons
    const [clientes, setClientes] = useState([]); // Dados brutos dos clientes

    // Filtros de data
    const [startDate, setStartDate] = useState(formatDateForInput(new Date())); // Padrão: hoje
    const [endDate, setEndDate] = useState(formatDateForInput(new Date()));     // Padrão: hoje

    useEffect(() => {
        if (!authLoading) {
            if (!currentUser || !isAdmin) {
                toast.error('Acesso negado. Você precisa ser um administrador para acessar esta página de relatórios.');
                navigate('/dashboard');
            } else {
                fetchReportData();
            }
        }
    }, [currentUser, isAdmin, authLoading, navigate, startDate, endDate]); // Recarrega dados ao mudar filtros de data

    const fetchReportData = async () => {
        setLoadingReports(true);
        setReportError('');
        try {
            // Converter datas de string para Timestamp para a query
            const startTimestamp = startDate ? Timestamp.fromDate(new Date(startDate + 'T00:00:00')) : null;
            const endTimestamp = endDate ? Timestamp.fromDate(new Date(endDate + 'T23:59:59')) : null;

            // 1. Buscar Pedidos Finalizados no período
            let qPedidos = query(collection(db, 'pedidos'), where('status', '==', 'finalizado'));
            if (startTimestamp) qPedidos = query(qPedidos, where('criadoEm', '>=', startTimestamp));
            if (endTimestamp) qPedidos = query(qPedidos, where('criadoEm', '<=', endTimestamp));
            qPedidos = query(qPedidos, orderBy('criadoEm', 'asc')); // Ordenar para facilitar agregação por tempo

            const pedidosSnapshot = await getDocs(qPedidos);
            const fetchedPedidos = pedidosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPedidos(fetchedPedidos);

            // 2. Buscar Cupons (todos, para análise de uso) - pode ser filtrado por período no frontend
            const cuponsSnapshot = await getDocs(collection(db, 'cupons'));
            const fetchedCupons = cuponsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCupons(fetchedCupons);

            // 3. Buscar Clientes (todos, para análise de aquisição) - pode ser filtrado por período no frontend
            const clientesSnapshot = await getDocs(collection(db, 'clientes'));
            const fetchedClientes = clientesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setClientes(fetchedClientes);

            toast.success('Dados de relatório carregados com sucesso!');

        } catch (err) {
            console.error("Erro ao carregar dados de relatório:", err);
            setReportError("Erro ao carregar dados de relatório. Verifique sua conexão e permissões.");
            toast.error("Erro ao carregar dados de relatório.");
        } finally {
            setLoadingReports(false);
        }
    };

    // <<-- LÓGICAS DE AGREGAÇÃO PARA OS RELATÓRIOS AQUI -->>
    // Exemplo: Faturamento por dia
    const getDailyRevenue = () => {
        const dailyRevenue = {};
        pedidos.forEach(pedido => {
            const date = format(pedido.criadoEm.toDate(), 'yyyy-MM-dd');
            dailyRevenue[date] = (dailyRevenue[date] || 0) + pedido.totalFinal;
        });
        return Object.entries(dailyRevenue).sort(); // Retorna array de [data, faturamento] ordenado
    };

    const dailyRevenueData = getDailyRevenue(); // Exemplo de uso

    // Exemplo: Top Produtos Vendidos
    const getTopSellingProducts = () => {
        const productSales = {};
        pedidos.forEach(pedido => {
            pedido.itens.forEach(item => {
                productSales[item.nome] = (productSales[item.nome] || 0) + item.quantidade;
            });
        });
        return Object.entries(productSales)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10); // Top 10 produtos
    };

    const topProductsData = getTopSellingProducts();

    // Exemplo: Análise de Cupons
    const getCouponPerformance = () => {
        const couponUsage = {};
        pedidos.forEach(pedido => {
            if (pedido.cupomAplicado) {
                const codigo = pedido.cupomAplicado.codigo;
                couponUsage[codigo] = couponUsage[codigo] || { usos: 0, descontoTotal: 0 };
                couponUsage[codigo].usos += 1;
                couponUsage[codigo].descontoTotal += pedido.cupomAplicado.descontoCalculado;
            }
        });
        return Object.entries(couponUsage).map(([codigo, data]) => ({ codigo, ...data }));
    };
    const couponPerformanceData = getCouponPerformance();


    // <<-- FUNÇÃO PARA EXPORTAR PARA PDF/CSV -->>
    const handleExport = (formatType) => {
        if (formatType === 'pdf') {
            toast.info('Gerando PDF...');
const doc = new jsPDF();
            let yPos = 10;
            const margin = 10;
            const lineHeight = 7;

            doc.setFontSize(16);
            doc.text(`Relatório de Pedidos - Período: ${startDate} a ${endDate}`, margin, yPos);
            yPos += 10;
            doc.setFontSize(12);

            doc.text(`Total de Pedidos Finalizados: ${pedidos.length}`, margin, yPos);
            yPos += lineHeight;
            doc.text(`Faturamento Bruto: R$ ${pedidos.reduce((acc, p) => acc + (p.totalFinal || 0), 0).toFixed(2).replace('.', ',')}`, margin, yPos);
            yPos += lineHeight;
            doc.text(`Desconto Total por Cupons: R$ ${pedidos.reduce((acc, p) => acc + (p.cupomAplicado?.descontoCalculado || 0), 0).toFixed(2).replace('.', ',')}`, margin, yPos);
            yPos += 15;

            // Tabela de Faturamento Diário
            doc.setFontSize(14);
            doc.text('Faturamento Diário:', margin, yPos);
            yPos += 8;
            doc.setFontSize(10);

            if (dailyRevenueData.length === 0) {
                doc.text('Nenhum faturamento diário para o período.', margin + 5, yPos);
                yPos += lineHeight;
            } else {
                const colWidthDate = 30;
                const colWidthRevenue = 40;
                let xPos = margin + 5;
                const headerY = yPos; // Guarda a posição Y do header

                doc.setFont('helvetica', 'bold');
                doc.text('Data', xPos, yPos);
                xPos += colWidthDate;
                doc.text('Faturamento', xPos, yPos);
                doc.setFont('helvetica', 'normal');
                yPos += lineHeight;
                doc.line(margin + 5, headerY + 2, margin + 5 + colWidthDate + colWidthRevenue + 10, headerY + 2); // Linha abaixo do header

                dailyRevenueData.forEach(([date, revenue]) => {
                    xPos = margin + 5;
                    doc.text(format(new Date(date), 'dd/MM/yyyy'), xPos, yPos);
                    xPos += colWidthDate;
                    doc.text(`R$ ${revenue.toFixed(2).replace('.', ',')}`, xPos, yPos);
                    yPos += lineHeight;
                });
                yPos += 5;
            }

            // Tabela de Top Produtos Vendidos
            doc.setFontSize(14);
            doc.text('Top 10 Produtos Vendidos:', margin, yPos);
            yPos += 8;
            doc.setFontSize(10);
            if (topProductsData.length === 0) {
                doc.text('Nenhum produto vendido no período.', margin + 5, yPos);
                yPos += lineHeight;
            } else {
                const colWidthProduct = 70;
                const colWidthQty = 20;
                let xPos = margin + 5;
                const headerY = yPos; // Guarda a posição Y do header

                doc.setFont('helvetica', 'bold');
                doc.text('Produto', xPos, yPos);
                xPos += colWidthProduct;
                doc.text('Quantidade', xPos, yPos);
                doc.setFont('helvetica', 'normal');
                yPos += lineHeight;
                doc.line(margin + 5, headerY + 2, margin + 5 + colWidthProduct + colWidthQty + 10, headerY + 2); // Linha abaixo do header

                topProductsData.forEach(([productName, quantity]) => {
                    xPos = margin + 5;
                    doc.text(productName, xPos, yPos);
                    xPos += colWidthProduct;
                    doc.text(`${quantity} un.`, xPos, yPos);
                    yPos += lineHeight;
                });
                yPos += 5;
            }

            // Tabela de Performance de Cupons (adicione lógica similar)
            doc.setFontSize(14);
            doc.text('Performance de Cupons:', margin, yPos);
            yPos += 8;
            doc.setFontSize(10);
            if (couponPerformanceData.length === 0) {
                doc.text('Nenhum cupom usado no período.', margin + 5, yPos);
                yPos += lineHeight;
            } else {
                const colWidthCode = 40;
                const colWidthUsos = 20;
                const colWidthDesconto = 40;
                let xPos = margin + 5;
                const headerY = yPos; // Guarda a posição Y do header

                doc.setFont('helvetica', 'bold');
                doc.text('Código Cupom', xPos, yPos);
                xPos += colWidthCode;
                doc.text('Usos', xPos, yPos);
                xPos += colWidthUsos;
                doc.text('Desconto Total', xPos, yPos);
                doc.setFont('helvetica', 'normal');
                yPos += lineHeight;
                doc.line(margin + 5, headerY + 2, margin + 5 + colWidthCode + colWidthUsos + colWidthDesconto + 10, headerY + 2); // Linha abaixo do header

                couponPerformanceData.forEach(data => {
                    xPos = margin + 5;
                    doc.text(data.codigo, xPos, yPos);
                    xPos += colWidthCode;
                    doc.text(`${data.usos}`, xPos, yPos);
                    xPos += colWidthUsos;
                    doc.text(`R$ ${data.descontoTotal.toFixed(2).replace('.', ',')}`, xPos, yPos);
                    yPos += lineHeight;
                });
                yPos += 5;
            }

            doc.save(`relatorio_pedidos_${startDate}_${endDate}.pdf`);
            toast.success('Relatório PDF gerado!');
        } else if (formatType === 'csv') {
            toast.info('Gerando CSV...');
            // Lógica de geração de CSV aqui
            const headers = ["ID Pedido", "Data", "Total", "Cupom Aplicado", "Desconto Cupom"];
            const rows = pedidos.map(p => [
                p.id,
                format(p.criadoEm.toDate(), 'dd/MM/yyyy HH:mm'),
                p.totalFinal.toFixed(2).replace('.', ','),
                p.cupomAplicado ? p.cupomAplicado.codigo : 'N/A',
                p.cupomAplicado ? p.cupomAplicado.descontoCalculado.toFixed(2).replace('.', ',') : '0,00'
            ]);
            let csvContent = "data:text/csv;charset=utf-8," 
                             + headers.join(";") + "\n" 
                             + rows.map(e => e.join(";")).join("\n");
            
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `relatorio_pedidos_${startDate}_${endDate}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success('Relatório CSV gerado!');
        }
    };


    if (authLoading || loadingReports) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
                <p className="text-xl text-gray-700">Carregando dados dos relatórios...</p>
            </div>
        );
    }

    if (!currentUser || !isAdmin) {
        return null; // Redirecionamento já feito no useEffect
    }

    if (reportError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-red-100 text-red-700 p-4 text-center">
                <p className="text-xl font-semibold">Erro:</p>
                <p className="mt-2">{reportError}</p>
                <button onClick={fetchReportData} className="mt-4 bg-red-500 text-white px-4 py-2 rounded">
                    Tentar Novamente
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 max-w-6xl mx-auto bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <Link to="/dashboard" className="flex items-center text-gray-600 hover:text-gray-900">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                    Voltar para o Dashboard
                </Link>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 text-center sm:text-left flex-grow">Relatórios Avançados</h1> {/* Ajustado tamanho para mobile */}
                <div></div> {/* Espaçador */}
            </div>

            {/* Seção de Filtros */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Filtros de Relatório</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Data Início</label>
                        <input
                            type="date"
                            id="startDate"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        />
                    </div>
                    <div>
                        <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">Data Fim</label>
                        <input
                            type="date"
                            id="endDate"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                        />
                    </div>
                </div>
                <div className="mt-4 text-right">
                    <button onClick={fetchReportData} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-sm">
                        Aplicar Filtros
                    </button>
                </div>
            </div>

            {/* Seção de Métricas Principais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-lg shadow-md border border-blue-200">
                    <h3 className="text-lg font-semibold text-blue-800">Total de Pedidos Finalizados</h3>
                    <p className="text-4xl font-bold text-blue-600">{pedidos.length}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md border border-green-200">
                    <h3 className="text-lg font-semibold text-green-800">Faturamento Bruto</h3>
                    <p className="text-4xl font-bold text-green-600">
                        R$ {pedidos.reduce((acc, p) => acc + (p.totalFinal || 0), 0).toFixed(2).replace('.', ',')}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md border border-purple-200">
                    <h3 className="text-lg font-semibold text-purple-800">Desconto Total por Cupons</h3>
                    <p className="text-4xl font-bold text-purple-600">
                        R$ {pedidos.reduce((acc, p) => acc + (p.cupomAplicado?.descontoCalculado || 0), 0).toFixed(2).replace('.', ',')}
                    </p>
                </div>
            </div>

            {/* Relatório de Faturamento Diário */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Faturamento Diário</h2>
                {dailyRevenueData.length === 0 ? (
                    <p className="text-gray-500 italic text-center py-4">Nenhum faturamento para o período selecionado.</p>
                ) : (
                    <div className="overflow-x-auto"> {/* Adicionado para rolagem horizontal em telas pequenas */}
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Faturamento</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {dailyRevenueData.map(([date, revenue]) => (
                                    <tr key={date}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{format(new Date(date), 'dd/MM/yyyy')}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">R$ {revenue.toFixed(2).replace('.', ',')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Relatório de Top Produtos Vendidos */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Top 10 Produtos Vendidos</h2>
                {topProductsData.length === 0 ? (
                    <p className="text-gray-500 italic text-center py-4">Nenhum produto vendido no período selecionado.</p>
                ) : (
                    <div className="overflow-x-auto"> {/* Adicionado para rolagem horizontal em telas pequenas */}
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produto</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantidade</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {topProductsData.map(([productName, quantity]) => (
                                    <tr key={productName}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{productName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{quantity} un.</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            
            {/* Relatório de Performance de Cupons */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-700 mb-4">Performance de Cupons</h2>
                {couponPerformanceData.length === 0 ? (
                    <p className="text-gray-500 italic text-center py-4">Nenhum cupom usado no período selecionado.</p>
                ) : (
                    <div className="overflow-x-auto"> {/* Adicionado para rolagem horizontal em telas pequenas */}
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código Cupom</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usos</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Desconto Total</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {couponPerformanceData.map(data => (
                                    <tr key={data.codigo}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{data.codigo}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{data.usos}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">R$ {data.descontoTotal.toFixed(2).replace('.', ',')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Seção de Exportação - Ajustada para flex-wrap */}
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 flex flex-col sm:flex-row justify-end items-center gap-2"> {/* Adicionado flex-col sm:flex-row para adaptar em mobile */}
                <h2 className="text-xl font-semibold text-gray-700 mb-4 sm:mb-0 w-full sm:w-auto text-center sm:text-right">Exportar Relatórios</h2>
                <button
                    onClick={() => handleExport('csv')}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md shadow-sm w-full sm:w-auto" 
                >
                    Exportar para CSV
                </button>
                <button
                    onClick={() => handleExport('pdf')}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md shadow-sm w-full sm:w-auto" 
                >
                    Exportar para PDF
                </button>
            </div>
        </div>
    );
}

export default AdminReports;