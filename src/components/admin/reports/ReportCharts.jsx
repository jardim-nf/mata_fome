import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement, Filler } from 'chart.js';
import { Line, Pie, Bar } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { fmtBRL } from '../../../utils/reportUtils';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement, Filler, ChartDataLabels);

export const ReportCharts = ({ metrics }) => {
    const pieChartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, font: { size: 12 } } },
            tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${fmtBRL(ctx.parsed)}` } },
            datalabels: { display: false }
        }
    };
    
    const lineChartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => fmtBRL(ctx.parsed.y) } }
        },
        scales: { y: { ticks: { callback: (v) => fmtBRL(v) } } }
    };

    const barChartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } }
    };

    return (
        <>
            <div className="grid lg:grid-cols-3 gap-6 mb-6" data-pdf-section="charts1">
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Evolução Diária</h3>
                        <div className="h-64">
                            <Line 
                                data={{ 
                                    labels: metrics.byDay.labels, 
                                    datasets: [{ 
                                        label: 'R$', 
                                        data: metrics.byDay.data, 
                                        borderColor: '#3b82f6', 
                                        backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                                        fill: true 
                                    }] 
                                }} 
                                options={lineChartOptions} 
                            />
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Produtos Válidos</h3>
                    {metrics.topItems.map(([n, q], i) => (
                        <div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded mb-2">
                            <span className="text-sm truncate max-w-[180px] font-medium">{n}</span>
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 rounded">{q}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6" data-pdf-section="charts2">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Meios de Pagamento</h3>
                    <div className="h-64">
                        <Pie 
                            data={{ 
                                labels: metrics.byPayment.labels, 
                                datasets: [{ 
                                    data: metrics.byPayment.data, 
                                    backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'] 
                                }] 
                            }} 
                            options={pieChartOptions} 
                        />
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Vendas por Hora</h3>
                    <div className="h-64">
                        <Bar 
                            data={{ 
                                labels: metrics.byHour.labels, 
                                datasets: [{ 
                                    label: 'Vendas', 
                                    data: metrics.byHour.data, 
                                    backgroundColor: '#3b82f6' 
                                }] 
                            }} 
                            options={barChartOptions} 
                        />
                    </div>
                </div>
            </div>
            
            {metrics.byPayment.labels.length > 0 && (() => {
                const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
                const totalGeral = metrics.byPayment.data.reduce((a, b) => a + b, 0);
                const sorted = metrics.byPayment.labels
                    .map((label, i) => ({ label, valor: metrics.byPayment.data[i], cor: colors[i % colors.length] }))
                    .sort((a, b) => b.valor - a.valor);
                return (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6" data-pdf-section="pagamento">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumo por Forma de Pagamento</h3>
                        <div className="space-y-3">
                            {sorted.map((item, i) => {
                                const pct = totalGeral > 0 ? ((item.valor / totalGeral) * 100).toFixed(1) : '0.0';
                                return (
                                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-bold text-gray-400 w-5">{i + 1}</span>
                                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.cor }}></span>
                                            <span className="font-semibold text-gray-700 capitalize">{item.label}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm font-bold text-gray-900">{fmtBRL(item.valor)}</span>
                                            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium">{pct}%</span>
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="flex items-center justify-between border-t-2 border-gray-200 pt-3 mt-2 px-4">
                                <span className="font-bold text-gray-800">Total</span>
                                <span className="font-bold text-green-600 text-lg">{fmtBRL(totalGeral)}</span>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </>
    );
};

export default ReportCharts;
