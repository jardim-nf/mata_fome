import React, { useEffect, useState, useCallback } from 'react';
import { collection, query, orderBy, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { IoClose, IoPrint, IoRestaurant, IoSearch, IoCalendarOutline } from 'react-icons/io5';

const formatarReal = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(valor || 0);
};

export default function HistoricoMesasModal({ isOpen, onClose, estabelecimentoId }) {
    const [historicoPedidos, setHistoricoPedidos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busca, setBusca] = useState('');

    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    const [dataFiltro, setDataFiltro] = useState(`${ano}-${mes}-${dia}`);

    const fetchHistorico = useCallback(async () => {
        if (!isOpen || !estabelecimentoId) return;
        setLoading(true);

        try {
            const [y, m, d] = dataFiltro.split('-').map(Number);
            const startOfDay = Timestamp.fromDate(new Date(y, m - 1, d, 0, 0, 0));
            const endOfDay = Timestamp.fromDate(new Date(y, m - 1, d, 23, 59, 59));

            const q = query(
                collection(db, 'vendas'),
                where('estabelecimentoId', '==', estabelecimentoId),
                where('criadoEm', '>=', startOfDay),
                where('criadoEm', '<=', endOfDay),
                orderBy('criadoEm', 'desc')
            );
            const snapshot = await getDocs(q);
            const vendasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setHistoricoPedidos(vendasData.filter(v => v.mesaNumero));
        } catch (e) {
            console.error(e);
            setHistoricoPedidos([]);
        } finally {
            setLoading(false);
        }
    }, [isOpen, estabelecimentoId, dataFiltro]);

    useEffect(() => {
        fetchHistorico();
    }, [fetchHistorico]);

    const handleImprimir = (pedido) => {
        // Usa criadoEm (da venda) ou createdAt (fallback)
        const dataOriginal = pedido.criadoEm || pedido.createdAt;
        const dataFormatada = dataOriginal?.toDate 
            ? dataOriginal.toDate().toLocaleString('pt-BR') 
            : new Date().toLocaleString('pt-BR');

        const itensHTML = pedido.itens?.map(item => `
            <tr>
                <td class="col-qtd">${item.quantidade || 1}x</td>
                <td class="col-nome">${item.nome}</td>
                <td class="col-preco">${formatarReal((item.preco || 0) * (item.quantidade || 1))}</td>
            </tr>
        `).join('') || '';

        const valorTaxa = Number(pedido.taxaServicoCobrada || 0);

        const conteudoCupom = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    @page { margin: 0; }
                    body { font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #000; width: 300px; margin: 0 auto; padding: 10px; }
                    .text-center { text-align: center; }
                    .bold { font-weight: bold; }
                    .divider { border-top: 1px dashed #000; margin: 8px 0; }
                    .header-title { font-size: 16px; font-weight: bold; text-align: center; margin-bottom: 5px; }
                    .info-line { margin-bottom: 3px; }
                    table { width: 100%; border-collapse: collapse; }
                    td { vertical-align: top; padding: 3px 0; }
                    .col-qtd { width: 15%; text-align: left; }
                    .col-nome { width: 55%; text-align: left; padding-right: 5px; }
                    .col-preco { width: 30%; text-align: right; }
                    .total-container, .taxa-container { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin-top: 5px; }
                    .taxa-container { font-size: 12px; margin-bottom: 4px; }
                    .footer { text-align: center; font-size: 10px; margin-top: 15px; }
                </style>
            </head>
            <body>
                <div class="header-title">*** REIMPRESSÃO MESA ***</div>
                <div class="divider"></div>
                <div class="info-line"><span class="bold">MESA:</span> ${pedido.mesaNumero || 'N/A'}</div>
                <div class="info-line"><span class="bold">ATENDENTE:</span> ${pedido.funcionario || 'N/A'}</div>
                <div class="info-line"><span class="bold">DATA:</span> ${dataFormatada}</div>
                <div class="divider"></div>
                <table>${itensHTML}</table>
                <div class="divider"></div>
                
                ${valorTaxa > 0 ? `
                <div class="taxa-container">
                    <span>TAXA DE SERVIÇO:</span>
                    <span>${formatarReal(valorTaxa)}</span>
                </div>
                ` : ''}
                
                <div class="total-container">
                    <span>TOTAL PAGO:</span>
                    <span>${formatarReal(pedido.total)}</span>
                </div>
                <div class="divider"></div>
                <div class="footer">Reimpressão do sistema.</div>
            </body>
            </html>
        `;

        const janelaImpressao = window.open('', '_blank', 'width=400,height=600');
        janelaImpressao.document.write(conteudoCupom);
        janelaImpressao.document.close();
        janelaImpressao.focus();
        setTimeout(() => { janelaImpressao.print(); janelaImpressao.close(); }, 800);
    };

    const pedidosFiltrados = historicoPedidos.filter(p => {
        const termoBusca = busca.toLowerCase();
        return String(p.mesaNumero || '').includes(termoBusca) || (p.funcionario || '').toLowerCase().includes(termoBusca);
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><IoRestaurant size={24} /></div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900 leading-none">Histórico de Mesas</h2>
                            <p className="text-sm text-gray-500 font-medium">Contas pagas e finalizadas</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-700 rounded-full transition-colors"><IoClose size={24} /></button>
                </div>

                <div className="p-4 border-b border-gray-100 bg-white flex flex-col sm:flex-row gap-4">
                    <div className="relative w-full sm:w-48">
                        <IoCalendarOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="date" value={dataFiltro} onChange={(e) => setDataFiltro(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-none rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer" />
                    </div>
                    <div className="relative flex-1">
                        <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="Buscar por número da mesa..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                        {busca && <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"><IoClose /></button>}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                    {loading ? (
                        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
                    ) : pedidosFiltrados.length === 0 ? (
                        <div className="text-center py-20 flex flex-col items-center gap-3 text-gray-400">
                            <IoSearch size={48} className="text-gray-300" />
                            <p className="font-medium text-lg">Nenhum pagamento encontrado.</p>
                        </div>
                    ) : (
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-100/80 text-gray-500 text-xs uppercase tracking-wider">
                                        <th className="p-4 font-bold border-b border-gray-200">Mesa</th>
                                        <th className="p-4 font-bold border-b border-gray-200">Data/Hora</th>
                                        <th className="p-4 font-bold border-b border-gray-200">Status</th>
                                        <th className="p-4 font-bold border-b border-gray-200">Valor Pago</th>
                                        <th className="p-4 font-bold border-b border-gray-200 text-center">Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pedidosFiltrados.map((pedido) => (
                                        <tr key={pedido.id} className="hover:bg-blue-50/50 border-b border-gray-100 last:border-none transition-colors">
                                            <td className="p-4">
                                                <span className="bg-gray-900 text-white font-black px-3 py-1.5 text-sm rounded-lg shadow-sm">
                                                    Mesa {pedido.mesaNumero}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm font-medium text-gray-500">
                                                {(pedido.criadoEm || pedido.createdAt)?.toDate ? (pedido.criadoEm || pedido.createdAt).toDate().toLocaleString('pt-BR') : '--'}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 text-xs font-bold rounded-md ${pedido.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                    {pedido.status === 'pago' ? 'Quitada' : 'Pgto Parcial'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-black text-green-600 text-base">
                                                    {formatarReal(pedido.total)}
                                                </div>
                                                {/* MOSTRA OS 10% AQUI (USANDO O NOME CORRETO DO BANCO) */}
                                                {Number(pedido.taxaServicoCobrada || 0) > 0 && (
                                                    <div className="text-[11px] font-bold text-gray-500 mt-0.5 uppercase tracking-wider">
                                                        Taxa Inclusa: {formatarReal(Number(pedido.taxaServicoCobrada))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                <button onClick={() => handleImprimir(pedido)} className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm active:scale-95">
                                                    <IoPrint size={16} /> Imprimir
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