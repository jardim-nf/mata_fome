import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { IoClose, IoPrint, IoRestaurant, IoSearch, IoCalendarOutline } from 'react-icons/io5';

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

    // Estado para o filtro de data (Inicia com a data de HOJE no formato YYYY-MM-DD)
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    const [dataFiltro, setDataFiltro] = useState(`${ano}-${mes}-${dia}`);

    useEffect(() => {
        if (!isOpen || !estabelecimentoId) return;

        setLoading(true);
        // Busca os pedidos ordenados do mais recente para o mais antigo
        const q = query(
            collection(db, 'estabelecimentos', estabelecimentoId, 'pedidos'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const pedidosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Filtra primeiro só o que é do salão/mesa
            const pedidosMesas = pedidosData.filter(p => p.origem === 'mesa' || p.tipoPedido === 'mesa' || p.mesaNumero);
            
            setHistoricoPedidos(pedidosMesas);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isOpen, estabelecimentoId]);

// Função de impressão aprimorada para Impressoras Térmicas
    const handleImprimir = (pedido) => {
        const dataFormatada = pedido.createdAt?.toDate 
            ? pedido.createdAt.toDate().toLocaleString('pt-BR') 
            : new Date().toLocaleString('pt-BR');

        // Monta as linhas da tabela de itens
        const itensHTML = pedido.itens?.map(item => `
            <tr>
                <td class="col-qtd">${item.quantidade}x</td>
                <td class="col-nome">${item.nome}</td>
                <td class="col-preco">${formatarReal(item.preco * item.quantidade)}</td>
            </tr>
        `).join('') || '';

        // Estrutura HTML com CSS focado em impressora térmica (aprox 80mm/58mm)
        const conteudoCupom = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    /* Tira as margens padrão do navegador na hora de imprimir */
                    @page { margin: 0; }
                    body {
                        font-family: 'Courier New', Courier, monospace; /* Fonte monoespaçada padrão de cupom */
                        font-size: 12px;
                        color: #000;
                        width: 300px; /* Largura padrão para 80mm (ajuste para 200px se for 58mm) */
                        margin: 0 auto;
                        padding: 10px;
                    }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .bold { font-weight: bold; }
                    .divider { 
                        border-top: 1px dashed #000; 
                        margin: 8px 0; 
                    }
                    .header-title {
                        font-size: 16px;
                        font-weight: bold;
                        text-align: center;
                        margin-bottom: 5px;
                    }
                    .info-line { margin-bottom: 3px; }
                    
                    /* Tabela de Itens */
                    table { width: 100%; border-collapse: collapse; }
                    td { vertical-align: top; padding: 3px 0; }
                    .col-qtd { width: 15%; text-align: left; }
                    .col-nome { width: 55%; text-align: left; padding-right: 5px; }
                    .col-preco { width: 30%; text-align: right; }
                    
                    /* Totais */
                    .total-container {
                        display: flex;
                        justify-content: space-between;
                        font-size: 14px;
                        font-weight: bold;
                        margin-top: 5px;
                    }
                    .footer {
                        text-align: center;
                        font-size: 10px;
                        margin-top: 15px;
                    }
                </style>
            </head>
            <body>
                <div class="header-title">*** REIMPRESSÃO ***</div>
                <div class="divider"></div>
                
                <div class="info-line"><span class="bold">MESA:</span> ${pedido.mesaNumero || 'N/A'}</div>
                <div class="info-line"><span class="bold">CLIENTE:</span> ${pedido.nomeCliente || pedido.nome || 'Avulso'}</div>
                <div class="info-line"><span class="bold">DATA:</span> ${dataFormatada}</div>
                
                <div class="divider"></div>
                
                <table>
                    ${itensHTML}
                </table>
                
                <div class="divider"></div>
                
                <div class="total-container">
                    <span>TOTAL:</span>
                    <span>${formatarReal(pedido.total)}</span>
                </div>
                
                <div class="divider"></div>
                
                <div class="footer">
                    Obrigado pela preferência!<br>
                    Volte sempre.
                </div>
            </body>
            </html>
        `;

        // Abre a janela invisível e dispara a impressão
        const janelaImpressao = window.open('', '_blank', 'width=400,height=600');
        janelaImpressao.document.write(conteudoCupom);
        janelaImpressao.document.close();
        janelaImpressao.focus();
        
        // Timeout ligeiramente maior para garantir que o CSS carregue antes de abrir a caixa de impressão
        setTimeout(() => {
            janelaImpressao.print();
            janelaImpressao.close();
        }, 800);
    };

    // APLICA OS FILTROS DE TEXTO E DATA SIMULTANEAMENTE
    const pedidosFiltrados = historicoPedidos.filter(p => {
        // 1. Filtro de Texto (Busca pelo nome do cliente ou número da mesa)
        const termoBusca = busca.toLowerCase();
        const matchTexto = String(p.mesaNumero || '').includes(termoBusca) || 
                           (p.nomeCliente || p.nome || '').toLowerCase().includes(termoBusca);
        
        // 2. Filtro de Data
        let matchData = true; // Se o campo de data estiver vazio, mostra todos
        
        if (dataFiltro && p.createdAt) {
            // Converte a data do Firebase para pegar apenas o Ano, Mês e Dia
            const dataPedido = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
            const pAno = dataPedido.getFullYear();
            const pMes = String(dataPedido.getMonth() + 1).padStart(2, '0');
            const pDia = String(dataPedido.getDate()).padStart(2, '0');
            const pDataFormatada = `${pAno}-${pMes}-${pDia}`;
            
            matchData = (pDataFormatada === dataFiltro);
        } else if (dataFiltro && !p.createdAt) {
            // Se tem filtro de data ativo, mas o pedido veio sem data do banco, esconde
            matchData = false;
        }

        return matchTexto && matchData;
    });

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

                {/* Filtros: Texto e Data */}
                <div className="p-4 border-b border-gray-100 bg-white flex flex-col sm:flex-row gap-4">
                    
                    {/* Filtro de Data */}
                    <div className="relative w-full sm:w-48">
                        <IoCalendarOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="date" 
                            value={dataFiltro}
                            onChange={(e) => setDataFiltro(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-none rounded-xl text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer"
                            title="Filtrar por data"
                        />
                    </div>

                    {/* Filtro de Texto (Mesa/Nome) */}
                    <div className="relative flex-1">
                        <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Buscar por nome ou número da mesa..." 
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                        {busca && (
                            <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500">
                                <IoClose />
                            </button>
                        )}
                    </div>

                </div>

                {/* Tabela de Resultados */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                    {loading ? (
                        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
                    ) : pedidosFiltrados.length === 0 ? (
                        <div className="text-center py-20 flex flex-col items-center gap-3 text-gray-400">
                            <IoSearch size={48} className="text-gray-300" />
                            <p className="font-medium text-lg">Nenhum pedido encontrado.</p>
                            <p className="text-sm">Tente mudar a data ou o termo da busca.</p>
                        </div>
                    ) : (
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-100/80 text-gray-500 text-xs uppercase tracking-wider">
                                        <th className="p-4 font-bold border-b border-gray-200">Mesa</th>
                                        <th className="p-4 font-bold border-b border-gray-200">Cliente</th>
                                        <th className="p-4 font-bold border-b border-gray-200">Data/Hora</th>
                                        <th className="p-4 font-bold border-b border-gray-200">Valor Total</th>
                                        <th className="p-4 font-bold border-b border-gray-200 text-center">Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pedidosFiltrados.map((pedido) => (
                                        <tr key={pedido.id} className="hover:bg-blue-50/50 border-b border-gray-100 last:border-none transition-colors">
                                            <td className="p-4">
                                                <span className="bg-gray-900 text-white font-black px-3 py-1.5 text-sm rounded-lg shadow-sm">
                                                    Mesa {pedido.mesaNumero || '--'}
                                                </span>
                                            </td>
                                            <td className="p-4 font-bold text-gray-800">
                                                {pedido.nomeCliente || pedido.nome || 'Cliente Avulso'}
                                            </td>
                                            <td className="p-4 text-sm font-medium text-gray-500">
                                                {pedido.createdAt?.toDate ? pedido.createdAt.toDate().toLocaleString('pt-BR') : '--'}
                                            </td>
                                            <td className="p-4 font-black text-green-600 text-base">
                                                {formatarReal(pedido.total)}
                                            </td>
                                            <td className="p-4 text-center">
                                                <button 
                                                    onClick={() => handleImprimir(pedido)}
                                                    className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm active:scale-95"
                                                >
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