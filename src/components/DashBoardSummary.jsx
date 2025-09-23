// src/components/DashboardSummary.jsx
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

const DashboardSummary = () => {
    const { estabelecimentoId } = useAuth();
    const [summary, setSummary] = useState({ totalPedidos: 0, valorTotal: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedPeriod, setSelectedPeriod] = useState('today');

    useEffect(() => {
        if (!estabelecimentoId) return;

        const fetchSummaryData = async () => {
            setLoading(true);
            try {
                const now = new Date();
                let startTimestamp;

                switch (selectedPeriod) {
                    case 'yesterday':
                        const yesterday = new Date(now);
                        yesterday.setDate(now.getDate() - 1);
                        startTimestamp = Timestamp.fromDate(new Date(yesterday.setHours(0, 0, 0, 0)));
                        break;
                    case 'this_week':
                        const weekStart = new Date(now);
                        weekStart.setDate(now.getDate() - now.getDay());
                        startTimestamp = Timestamp.fromDate(new Date(weekStart.setHours(0, 0, 0, 0)));
                        break;
                    case 'this_month':
                         const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                         startTimestamp = Timestamp.fromDate(new Date(monthStart.setHours(0, 0, 0, 0)));
                         break;
                    case 'today':
                    default:
                        startTimestamp = Timestamp.fromDate(new Date(now.setHours(0, 0, 0, 0)));
                        break;
                }
                
                const endTimestamp = Timestamp.now();

                const pedidosRef = collection(db, 'pedidos');
                const q = query(
                    pedidosRef,
                    where('estabelecimentoId', '==', estabelecimentoId),
                    where('criadoEm', '>=', startTimestamp),
                    where('criadoEm', '<=', endTimestamp)
                );

                const querySnapshot = await getDocs(q);
                let totalPedidos = 0;
                let valorTotal = 0;

                querySnapshot.forEach(doc => {
                    const pedido = doc.data();
                    if (pedido.status !== 'cancelado') {
                       totalPedidos += 1;
                       valorTotal += pedido.totalFinal || 0;
                    }
                });

                setSummary({ totalPedidos, valorTotal });
            } catch (err) {
                console.error("Erro ao buscar resumo de pedidos:", err);
                setError("Não foi possível carregar o resumo.");
            } finally {
                setLoading(false);
            }
        };

        fetchSummaryData();
    }, [estabelecimentoId, selectedPeriod]);

    const handlePeriodChange = (e) => {
        setSelectedPeriod(e.target.value);
    };

    if (loading) {
        return (
            <div className="mb-8 p-4 bg-gray-700 rounded-lg text-center text-white animate-pulse">
                Carregando resumo do dia...
            </div>
        );
    }
    
    if (error) {
        return <div className="mb-8 p-4 bg-red-800 rounded-lg text-center text-white">{error}</div>
    }

    return (
        <div className="mb-8 p-6 bg-gray-800 rounded-2xl shadow-lg border border-gray-700">
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">Resumo</h2>
                <select 
                    value={selectedPeriod} 
                    onChange={handlePeriodChange}
                    className="bg-gray-700 text-white border-gray-600 rounded-md p-2"
                >
                    <option value="today">Hoje</option>
                    <option value="yesterday">Ontem</option>
                    <option value="this_week">Esta Semana</option>
                    <option value="this_month">Este Mês</option>
                </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-white">
                <div className="bg-gray-700 p-4 rounded-lg text-center">
                    <p className="text-sm text-gray-400 uppercase">Pedidos</p>
                    <p className="text-3xl font-bold text-amber-400">{summary.totalPedidos}</p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg text-center">
                    <p className="text-sm text-gray-400 uppercase">Valor Total</p>
                    <p className="text-3xl font-bold text-green-400">
                        {summary.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DashboardSummary;