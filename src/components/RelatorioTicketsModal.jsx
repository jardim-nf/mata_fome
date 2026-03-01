import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { IoClose, IoTicket, IoCalendar } from 'react-icons/io5';

const RelatorioTicketsModal = ({ onClose, estabelecimentoId }) => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [resumo, setResumo] = useState({ qtdTotal: 0, valorTotal: 0 });

    useEffect(() => {
        const fetchTickets = async () => {
            if (!estabelecimentoId) return;
            try {
                // Busca tickets deste estabelecimento, ordenados por data
                const q = query(
                    collection(db, "historico_tickets"),
                    where("estabelecimentoId", "==", estabelecimentoId),
                    orderBy("data", "desc")
                );
                
                const snapshot = await getDocs(q);
                const dados = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                setTickets(dados);

                // Calcular totais
                const totalQtd = dados.reduce((acc, item) => acc + (item.quantidade || 0), 0);
                const totalValor = dados.reduce((acc, item) => acc + (item.valorTotal || 0), 0);
                setResumo({ qtdTotal: totalQtd, valorTotal: totalValor });

            } catch (error) {
                console.error("Erro ao buscar relatório:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTickets();
    }, [estabelecimentoId]);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="bg-gray-900 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold flex items-center gap-2"><IoTicket className="text-purple-400"/> Relatório de Impressões</h3>
                    <button onClick={onClose}><IoClose size={24} /></button>
                </div>

                {/* Resumo Cards */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 border-b">
                    <div className="bg-white p-3 rounded-xl border shadow-sm text-center">
                        <span className="text-xs text-gray-500 font-bold uppercase">Total Tickets</span>
                        <div className="text-2xl font-black text-purple-600">{resumo.qtdTotal}</div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border shadow-sm text-center">
                        <span className="text-xs text-gray-500 font-bold uppercase">Valor Gerado</span>
                        <div className="text-2xl font-black text-green-600">
                            {resumo.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                    </div>
                </div>

                {/* Lista */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="text-center py-10">Carregando dados...</div>
                    ) : tickets.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">Nenhum ticket impresso ainda.</div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-100 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 rounded-l-lg">Data</th>
                                    <th className="px-3 py-2">Item</th>
                                    <th className="px-3 py-2 text-center">Qtd</th>
                                    <th className="px-3 py-2 text-right rounded-r-lg">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {tickets.map(t => (
                                    <tr key={t.id} className="hover:bg-gray-50">
                                        <td className="px-3 py-3 text-gray-600">
                                            {t.data ? new Date(t.data.seconds * 1000).toLocaleString('pt-BR') : '-'}
                                            <br/><span className="text-[10px] text-gray-400">{t.impressoPor}</span>
                                        </td>
                                        <td className="px-3 py-3 font-bold text-gray-800">{t.item}</td>
                                        <td className="px-3 py-3 text-center font-bold bg-purple-50 text-purple-700 rounded-lg">{t.quantidade}</td>
                                        <td className="px-3 py-3 text-right font-medium text-gray-900">
                                            {(t.valorTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RelatorioTicketsModal;