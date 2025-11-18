// src/components/PedidoCard.jsx

import React, { useState, useEffect, useRef } from 'react';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import ComandaParaImpressao from './ComandaParaImpressao';

function PedidoCard({ 
    item, 
    pedido, 
    onUpdateStatus, 
    onDeletePedido, 
    newOrderIds, 
    estabelecimentoInfo,
    onAddItem 
}) {
    // 🛡️ VERIFICAÇÃO CRÍTICA - suporta tanto 'item' quanto 'pedido'
    const safeItem = item || pedido;
    
    if (!safeItem || typeof safeItem !== 'object') {
        console.warn('PedidoCard recebeu dados inválidos:', { item, pedido });
        return (
            <div className="bg-white rounded-lg p-4 border border-red-200 animate-pulse">
                <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0"></div>
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                </div>
            </div>
        );
    }

    // 🛡️ VALORES PADRÃO SEGUROS
    const safeData = {
        id: safeItem.id || Math.random().toString(),
        nome: safeItem.nome || 'Pedido sem nome',
        descricao: safeItem.descricao || '',
        preco: typeof safeItem.preco === 'number' ? safeItem.preco : 
               typeof safeItem.totalFinal === 'number' ? safeItem.totalFinal : 0,
        imageUrl: safeItem.imageUrl || null,
        quantidade: typeof safeItem.quantidade === 'number' ? safeItem.quantidade : 1,
        observacao: safeItem.observacao || '',
        adicionais: Array.isArray(safeItem.adicionais) ? safeItem.adicionais : [],
        variacaoSelecionada: safeItem.variacaoSelecionada || null,
        itens: Array.isArray(safeItem.itens) ? safeItem.itens : [],
        status: safeItem.status || 'recebido',
        tipo: safeItem.tipo || 'delivery',
        tipoEntrega: safeItem.tipoEntrega || safeItem.tipo || 'delivery',
        cliente: safeItem.cliente || {},
        createdAt: safeItem.createdAt || null,
        criadoEm: safeItem.criadoEm || safeItem.createdAt || null,
        formaPagamento: safeItem.formaPagamento || '',
        trocoPara: safeItem.trocoPara || null,
        taxaEntrega: safeItem.taxaEntrega || 0,
        cupomAplicado: safeItem.cupomAplicado || null
    };

    const placeholderImage = "https://via.placeholder.com/300x200.png?text=Sem+Imagem";
    
    const [displayImageUrl, setDisplayImageUrl] = useState(placeholderImage);
    const [imageLoading, setImageLoading] = useState(true);
    const [imageError, setImageError] = useState(false);
    const [showPrintDialog, setShowPrintDialog] = useState(false);
    const printRef = useRef();

    useEffect(() => {
        const fetchImageUrl = async () => {
            if (safeData.imageUrl) {
                if (safeData.imageUrl.startsWith('http')) {
                    setDisplayImageUrl(safeData.imageUrl);
                } else {
                    try {
                        const imageRef = ref(storage, safeData.imageUrl);
                        const downloadUrl = await getDownloadURL(imageRef);
                        setDisplayImageUrl(downloadUrl);
                    } catch (error) {
                        console.error(`Erro ao buscar imagem:`, error);
                        setDisplayImageUrl(placeholderImage);
                        setImageError(true);
                    }
                }
            } else {
                setDisplayImageUrl(placeholderImage);
                setImageError(true);
            }
            setImageLoading(false);
        };

        fetchImageUrl();
    }, [safeData.imageUrl]);

    // 🛡️ CALCULAR PREÇO TOTAL
    const calcularPrecoTotal = () => {
        // Se já tem preço calculado
        if (safeData.preco > 0) {
            return safeData.preco;
        }
        
        // Calcular a partir dos itens
        if (safeData.itens && safeData.itens.length > 0) {
            return safeData.itens.reduce((total, item) => {
                const precoItem = Number(item.preco) || 0;
                const quantidade = Number(item.quantidade) || 1;
                return total + (precoItem * quantidade);
            }, 0);
        }
        
        return 0;
    };

    // 🆕 FUNÇÃO DE IMPRESSÃO COM COMPONENTE PERSONALIZADO
    const handleImprimir = () => {
        setShowPrintDialog(true);
    };

    // 🆕 FUNÇÃO PARA IMPRIMIR EFETIVAMENTE
    const executarImpressao = () => {
        const conteudoImpressao = printRef.current;
        if (!conteudoImpressao) return;

        const janelaImpressao = window.open('', '_blank', 'width=400,height=600');
        janelaImpressao.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Comanda - Pedido #${safeData.id.slice(0, 8)}</title>
                <style>
                    body { margin: 0; padding: 0; }
                </style>
            </head>
            <body>
                ${conteudoImpressao.innerHTML}
            </body>
            </html>
        `);
        janelaImpressao.document.close();
        
        janelaImpressao.onload = () => {
            janelaImpressao.focus();
            janelaImpressao.print();
            // janelaImpressao.close(); // Descomente se quiser fechar automaticamente
        };
        
        setShowPrintDialog(false);
    };

    // 🆕 FORMATAR NOME DO PEDIDO (SEM DUPLICAÇÃO)
    const getPedidoTitle = () => {
        if (safeData.itens && safeData.itens.length > 0) {
            if (safeData.itens.length === 1) {
                return safeData.itens[0].nome || '1 item';
            }
            return `${safeData.itens.length} itens`;
        }
        return 'Pedido';
    };

    // 🆕 BOTÕES POR STATUS
    const getStatusButtons = () => {
        const status = safeData.status;
        
        switch (status) {
            case 'recebido':
                return (
                    <div className="flex gap-2">
                        <button
                            onClick={() => onUpdateStatus(safeData.id, 'preparo')}
                            className="flex-1 bg-amber-500 text-white py-2 rounded text-xs font-semibold hover:bg-amber-600 transition-colors"
                        >
                            Preparar
                        </button>
                        
                        <button
                            onClick={handleImprimir}
                            className="px-3 py-2 bg-blue-500 text-white rounded text-xs font-semibold hover:bg-blue-600 transition-colors"
                            title="Imprimir comanda"
                        >
                            🖨️
                        </button>
                        
                        {onDeletePedido && (
                            <button
                                onClick={() => onDeletePedido(safeData.id)}
                                className="px-3 py-2 bg-red-500 text-white rounded text-xs font-semibold hover:bg-red-600 transition-colors"
                                title="Excluir pedido"
                            >
                                🗑️
                            </button>
                        )}
                    </div>
                );
                
            case 'preparo':
                return (
                    <div className="flex gap-2">
                        <button
                            onClick={() => onUpdateStatus(safeData.id, 'em_entrega')}
                            className="flex-1 bg-blue-500 text-white py-2 rounded text-xs font-semibold hover:bg-blue-600 transition-colors"
                        >
                            Pronto / Em Entrega
                        </button>
                        
                        <button
                            onClick={handleImprimir}
                            className="px-3 py-2 bg-gray-500 text-white rounded text-xs font-semibold hover:bg-gray-600 transition-colors"
                            title="Imprimir comanda"
                        >
                            🖨️
                        </button>
                    </div>
                );
                
            case 'em_entrega':
                return (
                    <div className="flex gap-2">
                        <button
                            onClick={() => onUpdateStatus(safeData.id, 'finalizado')}
                            className="flex-1 bg-green-500 text-white py-2 rounded text-xs font-semibold hover:bg-green-600 transition-colors"
                        >
                            Finalizar Pedido
                        </button>
                        
                        <button
                            onClick={handleImprimir}
                            className="px-3 py-2 bg-gray-500 text-white rounded text-xs font-semibold hover:bg-gray-600 transition-colors"
                            title="Imprimir comanda"
                        >
                            🖨️
                        </button>
                    </div>
                );
                
            default:
                return (
                    <button
                        onClick={handleImprimir}
                        className="w-full bg-gray-500 text-white py-2 rounded text-xs font-semibold hover:bg-gray-600 transition-colors"
                    >
                        🖨️ Imprimir Comanda
                    </button>
                );
        }
    };

    const precoTotal = calcularPrecoTotal();
    const pedidoTitle = getPedidoTitle();
   const isNewOrder = Array.isArray(newOrderIds) 
    ? newOrderIds.includes(safeData.id)
    : newOrderIds.has(safeData.id);
    const statusButtons = getStatusButtons();

    return (
        <>
            <div className={`bg-white rounded-lg p-4 border-2 transition-all duration-300 ${
                isNewOrder 
                    ? 'border-green-500 bg-green-50 animate-pulse shadow-lg' 
                    : 'border-gray-200 hover:border-amber-300'
            }`}>
                {/* Header do Pedido */}
                <div className="mb-3">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="font-bold text-gray-900 text-sm">
                                {pedidoTitle}
                            </h3>
                            {safeData.cliente?.nome && (
                                <p className="text-xs text-gray-600 mt-1">
                                    👤 {safeData.cliente.nome}
                                </p>
                            )}
                        </div>
                        
                        <div className="text-right">
                            <span className="text-lg font-bold text-amber-600">
                                R$ {precoTotal.toFixed(2).replace('.', ',')}
                            </span>
                            {isNewOrder && (
                                <div className="text-xs text-green-600 font-bold mt-1">
                                    NOVO! 🎉
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tipo de Pedido */}
                    {safeData.tipo && (
                        <span className={`text-xs px-2 py-1 rounded-full ${
                            safeData.tipo === 'delivery' ? 'bg-blue-100 text-blue-700' :
                            safeData.tipo === 'retirada' ? 'bg-orange-100 text-orange-700' :
                            'bg-green-100 text-green-700'
                        }`}>
                            {safeData.tipo}
                        </span>
                    )}
                </div>

                {/* Itens do Pedido - VERSÃO CORRIGIDA (SEM DUPLICAÇÃO) */}
                {safeData.itens && safeData.itens.length > 0 && (
                    <div className="mb-3 space-y-2">
                        {safeData.itens.map((item, index) => (
                            <div key={index} className="text-xs border-b border-gray-100 pb-2 last:border-b-0">
                                {/* Nome do item e quantidade */}
                                <div className="flex justify-between mb-1">
                                    <span className="font-medium text-gray-800">
                                        {item.quantidade}x {item.nomeBase || item.nome}
                                    </span>
                                    <span className="text-gray-600">
                                        R$ {((Number(item.preco) || 0) * (Number(item.quantidade) || 1)).toFixed(2).replace('.', ',')}
                                    </span>
                                </div>
                                
                                {/* Variação selecionada */}
                                {item.variacaoSelecionada && (
                                    <div className="text-gray-600 pl-2">
                                        • {item.variacaoSelecionada.nome}
                                    </div>
                                )}
                                
                                {/* Adicionais */}
                                {item.adicionais && item.adicionais.length > 0 && (
                                    <div className="text-gray-500 pl-2">
                                        {item.adicionais.map((adicional, idx) => (
                                            <div key={idx} className="flex justify-between">
                                                <span>+ {adicional.nome}</span>
                                                {adicional.preco > 0 && (
                                                    <span className="text-green-600">
                                                        +R$ {Number(adicional.preco).toFixed(2).replace('.', ',')}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {/* Observações específicas do item */}
                                {item.observacao && (
                                    <div className="text-amber-600 text-xs mt-1 pl-2 bg-amber-50 p-1 rounded">
                                        <span className="font-semibold">Obs:</span> {item.observacao}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Informações de Pagamento */}
                <div className="mb-3 text-xs">
                    <div className="flex justify-between">
                        <span className="text-gray-600">Pagamento:</span>
                        <span className="font-medium">{safeData.formaPagamento || 'Não informado'}</span>
                    </div>
                    {safeData.trocoPara && (
                        <div className="flex justify-between text-green-600">
                            <span>Troco para:</span>
                            <span className="font-medium">R$ {Number(safeData.trocoPara).toFixed(2).replace('.', ',')}</span>
                        </div>
                    )}
                </div>

                {/* Observações gerais do pedido */}
                {safeData.observacao && (
                    <div className="mb-3 p-2 bg-amber-50 rounded border border-amber-200">
                        <p className="text-xs text-amber-800">
                            <span className="font-semibold">Observações do pedido:</span> {safeData.observacao}
                        </p>
                    </div>
                )}

                {/* Botões de Ação - VERSÃO CORRIGIDA (COM IMPRESSÃO) */}
                {statusButtons}

                {/* Timestamp */}
                {safeData.createdAt && (
                    <div className="mt-2 text-xs text-gray-400 text-center">
                        {safeData.createdAt.toDate?.().toLocaleTimeString('pt-BR') || 'Horário não disponível'}
                    </div>
                )}
            </div>

            {/* 🆕 MODAL DE IMPRESSÃO */}
            {showPrintDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                        <h3 className="text-lg font-bold mb-4">Imprimir Comanda</h3>
                        
                        {/* Pré-visualização da comanda */}
                        <div className="border border-gray-300 p-4 mb-4 max-h-64 overflow-y-auto">
                            <ComandaParaImpressao 
                                ref={printRef}
                                pedido={safeData}
                                estabelecimento={estabelecimentoInfo}
                            />
                        </div>
                        
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowPrintDialog(false)}
                                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={executarImpressao}
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                            >
                                🖨️ Imprimir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default PedidoCard;