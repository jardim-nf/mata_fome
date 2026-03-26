// src/components/pdv-modals/ModalRecibo.jsx
import React from 'react';
import { formatarMoeda, formatarData } from './pdvHelpers';

export const ModalRecibo = ({ visivel, dados, onClose, onNovaVenda, onEmitirNfce, nfceStatus, nfceUrl, onBaixarXml, onConsultarStatus, onBaixarPdf, onBaixarXmlCancelamento, onEnviarWhatsApp }) => {
    if (!visivel) return null;

    // Pega o status formatado para evitar erros de case-sensitive
    const statusNfceRecibo = dados?.fiscal?.status?.toUpperCase() || '';
    const temIdRecibo = !!dados?.fiscal?.idPlugNotas;
    const isCanceladaRecibo = dados?.status === 'cancelada' || statusNfceRecibo.includes('CANCEL');

    return (
        <div id="recibo-overlay" className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
            <div id="recibo-content" className="bg-white w-full max-w-sm p-8 rounded-3xl shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 bg-gray-100 hover:bg-red-100 hover:text-red-500 p-2 rounded-full transition-colors no-print">✕</button>
                <div className="text-center border-b border-dashed border-gray-200 pb-6 mb-6">
                    <h2 className="font-black text-2xl text-gray-800 uppercase tracking-wide">RECIBO</h2>
                    <p className="text-gray-400 text-xs font-mono mt-1">#{dados.id.slice(-6)} • {formatarData(dados.createdAt)}</p>
                </div>
                
                <div className="space-y-3 mb-6 max-h-60 overflow-y-auto custom-scrollbar print:max-h-none print:overflow-visible">
                    {dados.itens.map((i, index) => {
                        const qtdReal = i.quantidade || i.quantity || i.qtd || 1;
                        const precoReal = Number(i.precoFinal || i.precoUnitario || i.preco || i.valor || i.price || 0);
                        const nomeReal = i.nome || i.name || 'Item';

                        return (
                            <div key={i.uid || i.id || index} className="flex flex-col text-sm text-gray-600 border-b border-dashed border-gray-100 pb-2 last:border-0">
                                <div className="flex justify-between">
                                    <span className={isCanceladaRecibo ? 'line-through text-gray-400' : ''}>
                                        <b className="text-gray-800">{qtdReal}x</b> {nomeReal}
                                    </span>
                                    <span className={`font-mono ${isCanceladaRecibo ? 'line-through text-gray-400' : ''}`}>
                                        {formatarMoeda(precoReal * qtdReal)}
                                    </span>
                                </div>
                                {i.observacao && <span className="text-xs text-gray-400 italic mt-0.5">Obs: {i.observacao}</span>}
                            </div>
                        );
                    })}
                </div>

                <div className="flex justify-between text-xl font-black text-gray-800 mb-8 pt-4 border-t border-dashed border-gray-200">
                    <span>TOTAL</span>
                    <span className={isCanceladaRecibo ? 'line-through text-gray-400' : ''}>{formatarMoeda(dados.total)}</span>
                </div>

                <div className="grid gap-3 no-print">

                    {isCanceladaRecibo && (
                        <div className="bg-red-50 p-2 rounded-lg border border-red-200 text-center text-xs font-bold text-red-600 uppercase mb-2">
                            PEDIDO CANCELADO
                        </div>
                    )}

                    {/* LOG DE REJEIÇÃO */}
                    {(statusNfceRecibo === 'REJEITADA' || statusNfceRecibo === 'REJEITADO' || statusNfceRecibo === 'DENEGADO') && (
                        <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-xs text-red-600 mb-2">
                            <strong className="block mb-1">⚠️ Motivo da Rejeição:</strong>
                            {dados.fiscal.motivoRejeicao || dados.fiscal.mensagem || "Erro na Sefaz. Verifique os dados."}
                        </div>
                    )}

                    <div className="flex gap-2 mb-3">
                        {/* BOTÕES DE EMISSÃO OU PDF */}
                        {(statusNfceRecibo === 'AUTORIZADA' || statusNfceRecibo === 'CONCLUIDO') ? (
                            <button onClick={() => onBaixarPdf(dados)} className="flex-1 bg-blue-500 text-white p-3 rounded-xl font-bold shadow-lg hover:bg-blue-600 transition-all flex items-center justify-center gap-2">
                                📄 PDF
                            </button>
                        ) : (!isCanceladaRecibo && (
                            <button onClick={onEmitirNfce} disabled={nfceStatus === 'loading'} className={`w-full text-white p-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${nfceStatus === 'loading' ? 'bg-orange-400 cursor-wait' : 'bg-orange-500 hover:bg-orange-600'}`}>
                                {nfceStatus === 'loading' ? '⏳ Aguardando...' : '🧾 Emitir NFC-e'}
                            </button>
                        ))}

                        {/* XML NORMAL */}
                        {(statusNfceRecibo === 'AUTORIZADA' || statusNfceRecibo === 'CONCLUIDO') && (
                            <button onClick={() => onBaixarXml(dados)} className="flex-1 bg-purple-500 text-white p-3 rounded-xl font-bold shadow-lg hover:bg-purple-600 transition-all flex items-center justify-center gap-2">
                                {'</>'} XML
                            </button>
                        )}

                        {/* BOTÃO WHATSAPP */}
                        {(statusNfceRecibo === 'AUTORIZADA' || statusNfceRecibo === 'CONCLUIDO') && (
                            <button onClick={() => onEnviarWhatsApp(dados)} className="flex-1 bg-green-500 text-white p-3 rounded-xl font-bold shadow-lg hover:bg-green-600 transition-all flex items-center justify-center gap-2" title="Enviar Nota via WhatsApp">
                                📱 Whats
                            </button>
                        )}
                    </div>

                    {/* XML DE CANCELAMENTO SE ESTIVER CANCELADA */}
                    {isCanceladaRecibo && temIdRecibo && (
                        <button
                            onClick={() => typeof onBaixarXmlCancelamento === 'function' ? onBaixarXmlCancelamento(dados) : onBaixarXml(dados)}
                            className="w-full bg-gray-100 text-gray-700 border border-gray-200 p-3 rounded-xl font-bold hover:bg-gray-200 transition-all flex justify-center items-center gap-2 mb-3"
                        >
                            {'</>'} Baixar XML de Cancelamento
                        </button>
                    )}

                    <div className="flex gap-3">
                        <button 
                            onClick={() => {
                                const estabId = dados.estabelecimentoId || '';
                                window.open(`/impressao-isolada?pedidoId=${dados.id}&estabId=${estabId}&origem=salao`, '_blank', 'width=380,height=600');
                            }} 
                            className="flex-1 border-2 border-gray-100 p-3 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all"
                        >
                            Imprimir
                        </button>
                        
                        <button onClick={onClose} className="flex-1 bg-emerald-600 text-white p-3 rounded-xl font-bold hover:bg-emerald-700 shadow-lg transition-all">
                            Próximo
                        </button>
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-2">Pressione <b className="font-bold border border-gray-300 rounded px-1">ESC</b> para sair</p>
                </div>
            </div>
        </div>
    );
};
