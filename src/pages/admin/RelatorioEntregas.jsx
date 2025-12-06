import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import { 
    IoBicycle, IoCalendar, IoCash, IoStatsChart, IoTime, 
    IoPrint, IoSearch, IoFilter 
} from 'react-icons/io5';
import { toast } from 'react-toastify';

const RelatorioEntregas = () => {
    const { estabelecimentosGerenciados } = useAuth();
    const estabelecimentoId = estabelecimentosGerenciados?.[0];

    const [loading, setLoading] = useState(true);
    const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]); // Hoje YYYY-MM-DD
    const [entregadores, setEntregadores] = useState([]);
    const [pedidos, setPedidos] = useState([]);

    // --- CARREGAR DADOS ---
    useEffect(() => {
        if (!estabelecimentoId) return;

        const carregarDados = async () => {
            setLoading(true);
            try {
                // 1. Buscar Motoboys Cadastrados
                const entregadoresRef = collection(db, 'estabelecimentos', estabelecimentoId, 'entregadores');
                const entregadoresSnap = await getDocs(entregadoresRef);
                const listaEntregadores = entregadoresSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setEntregadores(listaEntregadores);

                // 2. Buscar Pedidos da Data Selecionada
                // Define o início e fim do dia selecionado
                const dataInicio = new Date(dataFiltro);
                dataInicio.setHours(0, 0, 0, 0);
                
                const dataFim = new Date(dataFiltro);
                dataFim.setHours(23, 59, 59, 999);

                // Busca na coleção raiz de pedidos (Delivery)
                const pedidosRef = collection(db, 'pedidos');
                const q = query(
                    pedidosRef,
                    where('estabelecimentoId', '==', estabelecimentoId),
                    where('createdAt', '>=', dataInicio),
                    where('createdAt', '<=', dataFim),
                    where('status', 'in', ['finalizado', 'em_entrega']) // Apenas entregues ou em rota
                );

                const pedidosSnap = await getDocs(q);
                const listaPedidos = pedidosSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setPedidos(listaPedidos);

            } catch (error) {
                console.error("Erro ao carregar relatório:", error);
                toast.error("Erro ao carregar dados.");
            } finally {
                setLoading(false);
            }
        };

        carregarDados();
    }, [estabelecimentoId, dataFiltro]);

    // --- PROCESSAMENTO DO RELATÓRIO ---
    const relatorio = useMemo(() => {
        if (!entregadores.length) return [];

        return entregadores.map(motoboy => {
            // Filtra pedidos deste motoboy
            const entregasDoMotoboy = pedidos.filter(p => p.motoboyId === motoboy.id);
            
            const qtdEntregas = entregasDoMotoboy.length;
            
            // CÁLCULO DO VALOR A PAGAR
            // Opção A: Paga a Taxa Fixa do Motoboy por entrega (Ex: R$ 5,00 por entrega)
            const valorPorTaxaFixa = qtdEntregas * (Number(motoboy.taxaFixa) || 0);

            // Opção B: Repassa a Taxa de Entrega cobrada do cliente no pedido
            const valorPorTaxaPedido = entregasDoMotoboy.reduce((acc, p) => acc + (Number(p.taxaEntrega) || 0), 0);

            // * Aqui você define qual regra usar. Vou somar as duas para flexibilidade, 
            // mas geralmente usa-se uma ou outra.
            // Se taxaFixa for 0, ele assume que ganha a taxa do pedido.
            const totalPagar = Number(motoboy.taxaFixa) > 0 ? valorPorTaxaFixa : valorPorTaxaPedido;

            return {
                ...motoboy,
                entregas: entregasDoMotoboy,
                qtdEntregas,
                totalPagar,
                metodoCalculo: Number(motoboy.taxaFixa) > 0 ? `Taxa Fixa (R$ ${motoboy.taxaFixa})` : 'Taxa do Pedido'
            };
        }).filter(m => m.qtdEntregas > 0); // Mostra apenas quem trabalhou no dia
    }, [entregadores, pedidos]);

    // Totais Gerais
    const totalGeralEntregas = relatorio.reduce((acc, m) => acc + m.qtdEntregas, 0);
    const totalGeralPagar = relatorio.reduce((acc, m) => acc + m.totalPagar, 0);

    const handlePrint = () => {
        window.print();
    };

    if (loading) return <div className="flex justify-center items-center h-screen">Carregando relatório...</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
            <div className="max-w-6xl mx-auto">
                
                {/* HEADER COM FILTROS */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <IoBicycle className="text-orange-600" />
                            Fechamento de Motoboys
                        </h1>
                        <p className="text-gray-500 text-sm">Resumo de entregas e valores a pagar</p>
                    </div>

                    <div className="flex items-center gap-3 bg-gray-100 p-2 rounded-xl">
                        <IoCalendar className="text-gray-500 ml-2" />
                        <input 
                            type="date" 
                            value={dataFiltro}
                            onChange={(e) => setDataFiltro(e.target.value)}
                            className="bg-transparent border-none focus:ring-0 text-gray-700 font-medium outline-none"
                        />
                    </div>

                    <button 
                        onClick={handlePrint}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <IoPrint /> Imprimir
                    </button>
                </div>

                {/* RESUMO GERAL */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
                            <IoBicycle size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Motoboys Ativos Hoje</p>
                            <h3 className="text-2xl font-bold text-gray-800">{relatorio.length}</h3>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-orange-100 text-orange-600 rounded-full">
                            <IoStatsChart size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total de Entregas</p>
                            <h3 className="text-2xl font-bold text-gray-800">{totalGeralEntregas}</h3>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-green-100 text-green-600 rounded-full">
                            <IoCash size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total a Pagar</p>
                            <h3 className="text-2xl font-bold text-green-600">
                                {totalGeralPagar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </h3>
                        </div>
                    </div>
                </div>

                {/* LISTAGEM DETALHADA */}
                <div className="space-y-6">
                    {relatorio.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">
                            Nenhuma entrega encontrada para esta data.
                        </div>
                    ) : (
                        relatorio.map((moto) => (
                            <div key={moto.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                {/* Cabeçalho do Motoboy */}
                                <div className="bg-gray-50 p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold">
                                            {moto.nome.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-lg">{moto.nome}</h3>
                                            <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">
                                                Placa: {moto.placa || 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-6 text-right">
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase">Entregas</p>
                                            <p className="font-bold text-xl">{moto.qtdEntregas}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase">A Receber</p>
                                            <p className="font-bold text-xl text-green-600">
                                                {moto.totalPagar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Lista de Pedidos Expandida */}
                                <div className="p-4 overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead>
                                            <tr className="text-gray-500 border-b border-gray-100">
                                                <th className="pb-2 font-medium">Pedido</th>
                                                <th className="pb-2 font-medium">Horário</th>
                                                <th className="pb-2 font-medium">Cliente</th>
                                                <th className="pb-2 font-medium">Endereço</th>
                                                <th className="pb-2 font-medium text-right">Taxa Entrega</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {moto.entregas.map(pedido => (
                                                <tr key={pedido.id} className="hover:bg-gray-50">
                                                    <td className="py-2 font-mono font-bold text-gray-600">
                                                        #{pedido.id.slice(0,4).toUpperCase()}
                                                    </td>
                                                    <td className="py-2 text-gray-600">
                                                        {pedido.createdAt?.toDate ? pedido.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                                                    </td>
                                                    <td className="py-2 text-gray-800 font-medium">
                                                        {pedido.cliente?.nome || 'Cliente'}
                                                    </td>
                                                    <td className="py-2 text-gray-600 max-w-xs truncate">
                                                        {pedido.cliente?.endereco ? `${pedido.cliente.endereco.rua}, ${pedido.cliente.endereco.numero} - ${pedido.cliente.endereco.bairro}` : 'Balcão'}
                                                    </td>
                                                    <td className="py-2 text-right font-medium text-gray-700">
                                                        {Number(pedido.taxaEntrega || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 text-right">
                                        Base de cálculo: {moto.metodoCalculo}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

            </div>
            
            {/* Estilo para Impressão */}
            <style>
                {`
                    @media print {
                        body * { visibility: hidden; }
                        .max-w-6xl, .max-w-6xl * { visibility: visible; }
                        .max-w-6xl { position: absolute; left: 0; top: 0; width: 100%; }
                        button, input { display: none !important; }
                        .bg-gray-50 { background: white !important; }
                    }
                `}
            </style>
        </div>
    );
};

export default withEstablishmentAuth(RelatorioEntregas);