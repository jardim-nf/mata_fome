import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { IoClose, IoPeople, IoCalendarOutline, IoReceiptOutline, IoAlertCircle, IoPrint } from 'react-icons/io5';

const formatarReal = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
};

export default function RelatorioGarcomModal({ isOpen, onClose, estabelecimentoId }) {
    const [loading, setLoading] = useState(true);
    const [relatorio, setRelatorio] = useState([]);
    const [totaisGerais, setTotaisGerais] = useState({ vendas: 0, taxa: 0 });
    const [erro, setErro] = useState(null); 
    
    // Filtro de Período (Início e Fim)
    const hoje = new Date().toISOString().split('T')[0];
    const [dataInicio, setDataInicio] = useState(hoje);
    const [dataFim, setDataFim] = useState(hoje);

    useEffect(() => {
        if (!isOpen || !estabelecimentoId) return;

        const buscarRelatorio = async () => {
            setLoading(true);
            setErro(null);
            
            try {
                // Configura as horas para cobrir o período completo
                const [anoI, mesI, diaI] = dataInicio.split('-');
                const [anoF, mesF, diaF] = dataFim.split('-');
                
                const inicioData = new Date(anoI, mesI - 1, diaI, 0, 0, 0);
                const fimData = new Date(anoF, mesF - 1, diaF, 23, 59, 59);

                // Busca na coleção de vendas baseada no período selecionado
                const q = query(
                    collection(db, `estabelecimentos/${estabelecimentoId}/vendas`),
                    where('criadoEm', '>=', Timestamp.fromDate(inicioData)),
                    where('criadoEm', '<=', Timestamp.fromDate(fimData))
                );

                const snapshot = await getDocs(q);
                
                let garcoesMap = {};
                let totalVendasGeral = 0;
                let totalTaxaGeral = 0;

                snapshot.docs.forEach(doc => {
                    const venda = doc.data();
                    
                    // Considera apenas se veio de uma mesa
                    if (!venda.mesaNumero) return;

                    const valorTaxaMesa = Number(venda.taxaServicoCobrada || 0);
                    const cobrou10 = valorTaxaMesa > 0;

                    const itens = Array.isArray(venda.itens) ? venda.itens : [];

                    itens.forEach(item => {
                        const garcom = item.adicionadoPorNome || item.adicionadoPor || venda.funcionario || 'Sem Identificação';
                        
                        if (!garcoesMap[garcom]) {
                            garcoesMap[garcom] = { nome: garcom, totalVendido: 0, taxaArrecadada: 0, qtdItens: 0 };
                        }

                        const valorItem = Number(item.precoFinal || item.preco || 0) * Number(item.quantidade || 1);
                        
                        garcoesMap[garcom].totalVendido += valorItem;
                        garcoesMap[garcom].qtdItens += Number(item.quantidade || 1);

                        // Se a mesa cobrou os 10%, adiciona a comissão para este item
                        if (cobrou10) {
                            garcoesMap[garcom].taxaArrecadada += (valorItem * 0.10);
                        }
                    });

                    totalVendasGeral += Number(venda.valorOriginal || venda.total || 0);
                    totalTaxaGeral += valorTaxaMesa;
                });

                const relatorioArray = Object.values(garcoesMap).sort((a, b) => b.taxaArrecadada - a.taxaArrecadada);
                
                setRelatorio(relatorioArray);
                setTotaisGerais({ vendas: totalVendasGeral, taxa: totalTaxaGeral });

            } catch (error) {
                console.error("Erro ao gerar relatório:", error);
                if (error.message.includes('index')) {
                    setErro("O Firebase pede que você crie um Índice para buscar por período. Abra o Inspecionar (F12) > Console e clique no link vermelho do Firebase.");
                } else {
                    setErro("Erro ao buscar dados. Detalhe: " + error.message);
                }
            } finally {
                setLoading(false);
            }
        };

        buscarRelatorio();
    }, [isOpen, estabelecimentoId, dataInicio, dataFim]);

    // Função de Impressão do Recibo Térmico
    const handleImprimir = () => {
        const dataIFormatada = dataInicio.split('-').reverse().join('/');
        const dataFFormatada = dataFim.split('-').reverse().join('/');
        const periodoTxt = dataIFormatada === dataFFormatada ? dataIFormatada : `${dataIFormatada} até ${dataFFormatada}`;

        // Monta os bloquinhos de cada garçom
        const linhasGarcoes = relatorio.map(g => `
            <div style="border-bottom: 1px dashed #ccc; padding: 6px 0;">
                <div style="font-weight: bold; font-size: 14px; text-transform: uppercase;">👤 ${g.nome}</div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 2px;">
                    <span>Vendas (${g.qtdItens} itens):</span>
                    <span>${formatarReal(g.totalVendido)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin-top: 3px;">
                    <span>COMISSÃO (10%):</span>
                    <span>${formatarReal(g.taxaArrecadada)}</span>
                </div>
            </div>
        `).join('');

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
                </style>
            </head>
            <body>
                <div class="text-center bold" style="font-size: 16px;">ACERTO DE COMISSÕES</div>
                <div class="divider"></div>
                
                <div class="text-center" style="font-size: 11px; margin-bottom: 5px;">
                    <span class="bold">PERÍODO:</span><br/>
                    ${periodoTxt}
                </div>
                
                <div class="divider"></div>
                
                ${linhasGarcoes || '<div class="text-center">Nenhum registro no período.</div>'}
                
                <div class="divider"></div>
                
                <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; margin-top: 5px;">
                    <span>VENDAS SALÃO:</span>
                    <span>${formatarReal(totaisGerais.vendas)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; margin-top: 5px; border-top: 1px solid #000; padding-top: 5px;">
                    <span>TOTAL CAIXINHA:</span>
                    <span>${formatarReal(totaisGerais.taxa)}</span>
                </div>
                
                <div class="divider"></div>
                <div class="text-center" style="font-size: 10px; margin-top: 15px;">Impresso em: ${new Date().toLocaleString('pt-BR')}</div>
            </body>
            </html>
        `;

        const janelaImpressao = window.open('', '_blank', 'width=400,height=600');
        janelaImpressao.document.write(conteudoCupom);
        janelaImpressao.document.close();
        janelaImpressao.focus();
        setTimeout(() => { janelaImpressao.print(); janelaImpressao.close(); }, 800);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl border border-gray-100 flex flex-col max-h-[90vh]">
                
                {/* CABEÇALHO */}
                <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-green-600">
                            <IoPeople className="text-xl" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900">Comissões e Desempenho</h2>
                            <p className="text-xs text-gray-500 font-medium">Relatório de vendas e 10% por garçom</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {relatorio.length > 0 && !loading && (
                            <button onClick={handleImprimir} className="mr-2 flex items-center gap-2 bg-blue-100 hover:bg-blue-600 hover:text-white text-blue-700 font-bold py-2 px-4 rounded-lg transition-colors text-sm">
                                <IoPrint size={18} /> Imprimir Recibo
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <IoClose className="text-2xl" />
                        </button>
                    </div>
                </div>

                {/* FILTROS DE DATAS E RESUMO */}
                <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-white">
                    <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200">
                        <IoCalendarOutline className="text-gray-500 ml-2" />
                        <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                            <span>De</span>
                            <input 
                                type="date" 
                                value={dataInicio}
                                onChange={(e) => setDataInicio(e.target.value)}
                                className="bg-transparent border-none outline-none cursor-pointer text-gray-900"
                            />
                            <span>Até</span>
                            <input 
                                type="date" 
                                value={dataFim}
                                onChange={(e) => setDataFim(e.target.value)}
                                className="bg-transparent border-none outline-none cursor-pointer text-gray-900"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <div className="bg-blue-50 border border-blue-100 px-4 py-2 rounded-xl text-right">
                            <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Vendas Salão</p>
                            <p className="font-black text-blue-900 text-lg">{formatarReal(totaisGerais.vendas)}</p>
                        </div>
                        <div className="bg-green-50 border border-green-100 px-4 py-2 rounded-xl text-right shadow-sm">
                            <p className="text-[10px] text-green-700 font-bold uppercase tracking-wider">Total 10% Arrecadado</p>
                            <p className="font-black text-green-700 text-xl">{formatarReal(totaisGerais.taxa)}</p>
                        </div>
                    </div>
                </div>

                {erro && (
                    <div className="mx-5 mt-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
                        <IoAlertCircle className="text-2xl flex-shrink-0" />
                        <p className="text-sm font-bold">{erro}</p>
                    </div>
                )}

                {/* LISTAGEM DOS GARÇONS */}
                <div className="p-5 overflow-y-auto flex-1 bg-gray-50/50">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-2"></div>
                            <p className="text-sm font-bold">Calculando fechamento...</p>
                        </div>
                    ) : !erro && relatorio.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                            <IoReceiptOutline className="text-4xl text-gray-300 mb-2" />
                            <p className="text-sm font-bold">Nenhuma venda encontrada nesse período.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {relatorio.map((garcom, idx) => (
                                <div key={idx} className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm hover:border-green-400 transition-colors flex flex-col justify-between">
                                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                                        <div className="w-12 h-12 rounded-full bg-green-50 text-green-700 border border-green-100 flex items-center justify-center font-black text-lg">
                                            {garcom.nome.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-black text-gray-900 text-lg leading-tight">{garcom.nome}</h3>
                                            <p className="text-xs text-gray-500 font-medium">{garcom.qtdItens} itens vendidos</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Vendas Brutas</p>
                                            <p className="font-bold text-gray-700">{formatarReal(garcom.totalVendido)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-green-600 font-bold uppercase tracking-wider mb-0.5">Comissão (10%)</p>
                                            <p className="font-black text-green-600 text-2xl leading-none">{formatarReal(garcom.taxaArrecadada)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}