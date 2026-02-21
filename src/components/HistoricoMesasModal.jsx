import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { IoClose, IoPrint, IoRestaurant, IoSearch } from 'react-icons/io5';

// Helper de formatação
const formatarReal = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency', currency: 'BRL', minimumFractionDigits: 2
    }).format(valor || 0);
};

export default function HistoricoMesasModal({ isOpen, onClose, estabelecimentoId }) {
    const [historicoPedidos, setHistoricoPedidos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busca, setBusca] = useState('');

    useEffect(() => {
        if (!isOpen || !estabelecimentoId) return;

        setLoading(true);
        // Busca pedidos finalizados/pagos daquele dia (ou geral) que vieram de uma mesa
        // Adapte o `where` de status/origem se o seu banco salvar diferente (ex: tipoPedido === 'salao')
        const q = query(
            collection(db, 'estabelecimentos', estabelecimentoId, 'pedidos'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const pedidosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Filtra localmente os que são do salão/mesa
            const pedidosMesas = pedidosData.filter(p => p.origem === 'mesa' || p.tipoPedido === 'mesa' || p.mesaNumero);
            
            setHistoricoPedidos(pedidosMesas);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isOpen, estabelecimentoId]);

    // Função genérica para chamar a tela de impressão do navegador ou térmica
    const handleImprimir = (pedido) => {
        // Formata os itens para um layout de cupom
        const itensText = pedido.itens?.map(item => `${item.quantidade}x ${item.nome} - ${formatarReal(item.preco * item.quantidade)}`).join('\n') || '';
        
        const conteudoCupom = `
            ===== REIMPRESSÃO =====
            Mesa: ${pedido.mesaNumero || 'N/A'}
            Cliente: ${pedido.nomeCliente || pedido.nome || 'Avulso'}
            Data: ${pedido.createdAt?.toDate ? pedido.createdAt.toDate().toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}
            -----------------------
            ${itensText}
            -----------------------
            TOTAL: ${formatarReal(pedido.total)}
            =======================
        `;

        // Isso abre a janela de impressão do Windows com o texto cru (ideal para impressoras térmicas se não usar componente visual)
        const janelaImpressao = window.open('', '_blank');
        janelaImpressao.document.write(`<pre style="font-family: monospace; font-size: 14px;">${conteudoCupom}</pre>`);
        janelaImpressao.document.close();
        janelaImpressao.focus();
        setTimeout(() => {
            janelaImpressao.print();
            janelaImpressao.close();
        }, 500);
    };

    const pedidosFiltrados = historicoPedidos.filter(p => 
        String(p.mesaNumero || '').includes(busca) || 
        (p.nomeCliente || p.nome || '').toLowerCase().includes(busca.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                
                {/* Header Modal */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                            <IoRestaurant size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900 leading-none">Histórico de Mesas</h2>
                            <p className="text-sm text-gray-500 font-medium">Histórico de abertura e pagamentos</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-700 rounded-full transition-colors">
                        <IoClose size={24} />
                    </button>
                </div>

                {/* Filtro */}
                <div className="p-4 border-b border-gray-100">
                    <div className="relative w-full max-w-sm">
                        <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Buscar por nome ou número da mesa..." 
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>

                {/* Tabela */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                    {loading ? (
                        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
                    ) : pedidosFiltrados.length === 0 ? (
                        <div className="text-center py-20 text-gray-500 font-medium">Nenhum histórico encontrado.</div>
                    ) : (
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-100 text-gray-500 text-xs uppercase tracking-wider">
                                        <th className="p-3 font-bold border-b border-gray-200">Mesa</th>
                                        <th className="p-3 font-bold border-b border-gray-200">Cliente</th>
                                        <th className="p-3 font-bold border-b border-gray-200">Data/Hora</th>
                                        <th className="p-3 font-bold border-b border-gray-200">Valor Total</th>
                                        <th className="p-3 font-bold border-b border-gray-200 text-center">Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pedidosFiltrados.map((pedido) => (
                                        <tr key={pedido.id} className="hover:bg-gray-50 border-b border-gray-100 last:border-none transition-colors">
                                            <td className="p-3">
                                                <span className="bg-gray-900 text-white font-black px-3 py-1 text-sm rounded-lg">
                                                    Mesa {pedido.mesaNumero || '--'}
                                                </span>
                                            </td>
                                            <td className="p-3 font-bold text-gray-700">
                                                {pedido.nomeCliente || pedido.nome || 'Cliente Avulso'}
                                            </td>
                                            <td className="p-3 text-sm font-medium text-gray-500">
                                                {pedido.createdAt?.toDate ? pedido.createdAt.toDate().toLocaleString('pt-BR') : '--'}
                                            </td>
                                            <td className="p-3 font-black text-green-600">
                                                {formatarReal(pedido.total)}
                                            </td>
                                            <td className="p-3 text-center">
                                                <button 
                                                    onClick={() => handleImprimir(pedido)}
                                                    className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white px-3 py-2 rounded-lg font-bold text-sm transition-colors"
                                                >
                                                    <IoPrint /> Imprimir
                                                </button>
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
}