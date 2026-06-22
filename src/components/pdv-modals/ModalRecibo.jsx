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

                <div className="flex justify-between text-xl font-black text-gray-800 mb-4 pt-4 border-t border-dashed border-gray-200">
                    <span>TOTAL</span>
                    <span className={isCanceladaRecibo ? 'line-through text-gray-400' : ''}>{formatarMoeda(dados.total)}</span>
                </div>

                {/* Detalhes do Pagamento e Troco */}
                {dados.pagamentos && dados.pagamentos.length > 0 && (
                    <div className="mb-6 pt-3 border-t border-gray-100 text-xs text-gray-500 space-y-1">
                        <p className="font-bold text-[10px] uppercase text-gray-400 tracking-wider">Formas de Pagamento</p>
                        {dados.pagamentos.map((p, idx) => (
                            <div key={idx} className="flex justify-between font-medium">
                                <span className="capitalize">
                                    {p.forma === 'dinheiro' ? '💵 Dinheiro' : p.forma === 'cartao' ? '💳 Cartão' : p.forma === 'pix' ? '💠 PIX' : '🤝 Crediário'}
                                </span>
                                <span className="font-mono">{formatarMoeda(p.valor)}</span>
                            </div>
                        ))}
                        {dados.troco > 0 && (
                            <div className="flex justify-between items-center text-emerald-700 bg-emerald-50 px-2 py-1.5 rounded-lg border border-emerald-100 font-bold mt-2 animate-fadeIn">
                                <span>Troco a devolver:</span>
                                <span className="font-mono text-sm font-black">{formatarMoeda(dados.troco)}</span>
                            </div>
                        )}
                    </div>
                )}

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

                    <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200 mb-3 text-center">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2.5">
                            Mande para a Impressora:
                        </span>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => {
                                    const estabId = dados.estabelecimentoId || '';
                                    window.open(`/impressao-isolada?pedidoId=${dados.id}&estabId=${estabId}&origem=pdv&setor=cozinha`, '_blank', 'width=380,height=600');
                                }} 
                                className="flex-1 bg-orange-50 hover:bg-orange-100 text-orange-700 py-2.5 rounded-xl font-bold text-[11px] transition-colors border border-orange-200 flex flex-col items-center justify-center gap-1 shadow-sm active:scale-95"
                            >
                                <span className="text-lg">🍳</span> Cozinha
                            </button>
                            <button 
                                onClick={() => {
                                    const estabId = dados.estabelecimentoId || '';
                                    window.open(`/impressao-isolada?pedidoId=${dados.id}&estabId=${estabId}&origem=pdv&setor=bar`, '_blank', 'width=380,height=600');
                                }} 
                                className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2.5 rounded-xl font-bold text-[11px] transition-colors border border-blue-200 flex flex-col items-center justify-center gap-1 shadow-sm active:scale-95"
                            >
                                <span className="text-lg">🍺</span> Bar
                            </button>
                            <button 
                                onClick={() => {
                                    const estabId = dados.estabelecimentoId || '';
                                    window.open(`/impressao-isolada?pedidoId=${dados.id}&estabId=${estabId}&origem=pdv&setor=tudo`, '_blank', 'width=380,height=600');
                                }} 
                                className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold text-[11px] transition-colors border border-gray-300 flex flex-col items-center justify-center gap-1 shadow-sm active:scale-95"
                            >
                                <span className="text-lg">🧾</span> Tudo (Balcão)
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex gap-3">
                        <button onClick={onClose} className="w-full bg-emerald-600 text-white p-3.5 rounded-xl font-bold hover:bg-emerald-700 shadow-lg transition-all text-sm">
                            Próximo Pedido
                        </button>
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-2">Pressione <b className="font-bold border border-gray-300 rounded px-1">ESC</b> para sair</p>
                </div>
            </div>
        </div>
    );
};
