import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { IoArrowBack, IoTrashBin, IoCalendar } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const RelatorioCancelamentos = () => {
    const { estabelecimentoIdPrincipal } = useAuth();
    const navigate = useNavigate();
    const [cancelamentos, setCancelamentos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtroData, setFiltroData] = useState('hoje'); // hoje, todos

    useEffect(() => {
        const fetchCancelamentos = async () => {
            if (!estabelecimentoIdPrincipal) return;
            
            setLoading(true);
            try {
                const logsRef = collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'auditLogs');
                // Busca logs do tipo cancelamento ordenados por data
                const q = query(
                    logsRef, 
                    where('tipo', '==', 'cancelamento_item'),
                    orderBy('data', 'desc')
                );

                const snapshot = await getDocs(q);
                const dados = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    // Converte timestamp para Date JS para facilitar
                    dataJs: doc.data().data?.toDate() || new Date()
                }));

                // Filtragem simples no front (pode ser melhorado no back se tiver muitos dados)
                let dadosFiltrados = dados;
                if (filtroData === 'hoje') {
                    const hoje = new Date().toDateString();
                    dadosFiltrados = dados.filter(d => d.dataJs.toDateString() === hoje);
                }

                setCancelamentos(dadosFiltrados);
            } catch (error) {
                console.error("Erro ao buscar logs:", error);
                toast.error("Erro ao carregar relatório");
            } finally {
                setLoading(false);
            }
        };

        fetchCancelamentos();
    }, [estabelecimentoIdPrincipal, filtroData]);

    // Calcular total perdido
    const totalPerdido = cancelamentos.reduce((acc, curr) => acc + (curr.valorTotalCancelado || 0), 0);

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/admin-dashboard')} className="p-2 bg-white rounded-full shadow hover:bg-gray-100">
                            <IoArrowBack className="text-xl text-gray-700" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <IoTrashBin className="text-red-500" /> Relatório de Cancelamentos
                            </h1>
                            <p className="text-sm text-gray-500">Itens excluídos via Senha Master</p>
                        </div>
                    </div>

                    <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                        <button 
                            onClick={() => setFiltroData('hoje')}
                            className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${filtroData === 'hoje' ? 'bg-red-100 text-red-700' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            Hoje
                        </button>
                        <button 
                            onClick={() => setFiltroData('todos')}
                            className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${filtroData === 'todos' ? 'bg-red-100 text-red-700' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            Todo o Período
                        </button>
                    </div>
                </div>

                {/* Card de Resumo */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6 flex justify-between items-center">
                    <div>
                        <p className="text-sm text-gray-500 font-medium uppercase">Total em Produtos Cancelados</p>
                        <h2 className="text-3xl font-black text-gray-900">R$ {totalPerdido.toFixed(2)}</h2>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-500">Itens cancelados</p>
                        <p className="text-2xl font-bold text-red-600">{cancelamentos.length}</p>
                    </div>
                </div>

                {/* Tabela */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center text-gray-400">Carregando dados...</div>
                    ) : cancelamentos.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center text-gray-400">
                            <IoCalendar className="text-4xl mb-2 opacity-20" />
                            <p>Nenhum cancelamento encontrado neste período.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-600">
                                <thead className="bg-gray-50 text-gray-900 font-bold uppercase text-xs border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4">Data / Hora</th>
                                        <th className="px-6 py-4">Mesa</th>
                                        <th className="px-6 py-4">Produto</th>
                                        <th className="px-6 py-4">Qtd</th>
                                        <th className="px-6 py-4">Valor Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {cancelamentos.map((log) => (
                                        <tr key={log.id} className="hover:bg-red-50/30 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-bold text-gray-900">
                                                    {log.dataJs.toLocaleDateString('pt-BR')}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {log.dataJs.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="bg-gray-100 text-gray-800 py-1 px-2 rounded font-bold">
                                                    Mesa {log.mesaNumero}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                {log.item?.nome}
                                                {log.item?.observacao && (
                                                    <div className="text-xs text-gray-500 italic mt-0.5">
                                                        Obs: {log.item.observacao}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {log.item?.quantidade}x
                                            </td>
                                            <td className="px-6 py-4 font-bold text-red-600">
                                                R$ {log.valorTotalCancelado?.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RelatorioCancelamentos;