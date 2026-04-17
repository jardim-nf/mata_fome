import React, { useState } from 'react';
import { IoClose, IoTimeOutline } from 'react-icons/io5';
import { formatarMoeda, formatarData, formatarHora } from './pdvHelpers';

export const ModalHistoricoVendas = ({
    visivel,
    onClose,
    vendas,
    carregando,
    onSelecionarVenda,
    onBaixarPdf,
    onBaixarXml,
    onBaixarXmlCancelamento,
    onEnviarWhatsApp,
    onCancelarNfce,
    onConsultarStatus,
    onProcessarRejeitadas,
    titulo
}) => {
    const [filtro, setFiltro] = useState('todas');
    const [buscaHistorico, setBuscaHistorico] = useState('');
    const [processandoLote, setProcessandoLote] = useState(false);

    if (!visivel) return null;

    const agora = Date.now();

    const vendasFiltradas = (vendas || []).filter(v => {
        const statusNfce = v.fiscal?.status?.toUpperCase() || '';
        const isCancelada = v.status === 'cancelada' || statusNfce.includes('CANCEL');

        if (filtro === 'rejeitadas' && statusNfce !== 'REJEITADA' && statusNfce !== 'REJEITADO') return false;
        if (filtro === 'recibo' && (statusNfce === 'AUTORIZADA' || statusNfce === 'CONCLUIDO' || statusNfce === 'REJEITADA' || statusNfce === 'REJEITADO' || isCancelada || statusNfce === 'PROCESSANDO')) return false;

        if (buscaHistorico) {
            const termo = buscaHistorico.toLowerCase();
            if (!v.id.toLowerCase().includes(termo) && !(v.clienteCpf || '').toLowerCase().includes(termo)) return false;
        }
        return true;
    });

    const handleProcessar = async () => {
        if (!onProcessarRejeitadas) return;
        setProcessandoLote(true);
        try { await onProcessarRejeitadas(vendasFiltradas); }
        finally { setProcessandoLote(false); }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200 no-print" onClick={onClose}>
            <div className="bg-slate-50 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                
                {/* HEADER & FILTROS */}
                <div className="bg-white p-4 sm:p-6 border-b border-slate-200 flex flex-col gap-4 shrink-0">
                    <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl shadow-inner">
                                <IoTimeOutline size={26} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800 leading-none">{titulo || "Histórico de Vendas"}</h2>
                                <p className="text-xs text-slate-500 font-medium mt-1">Consulte recibos, emita ou cancele notas fiscais</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                            {filtro === 'rejeitadas' && vendasFiltradas.length > 0 && (
                                <button onClick={handleProcessar} disabled={processandoLote} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2 leading-normal">
                                    {processandoLote ? '⏳ Emitindo...' : '🔄 Processar Lote'}
                                </button>
                            )}
                            <button onClick={onClose} className="p-2 text-slate-400 bg-slate-100 hover:bg-red-50 hover:text-red-500 rounded-xl transition-colors">
                                <IoClose size={24} />
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-3 items-center justify-between mt-2">
                        <div className="flex bg-slate-100 p-1.5 rounded-xl w-full lg:w-auto overflow-x-auto scrollbar-hide">
                            <button onClick={() => setFiltro('todas')} className={`px-4 py-2 rounded-lg font-bold text-[11px] uppercase tracking-wide whitespace-nowrap transition-all leading-normal ${filtro === 'todas' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Todas</button>
                            <button onClick={() => setFiltro('rejeitadas')} className={`px-4 py-2 rounded-lg font-bold text-[11px] uppercase tracking-wide whitespace-nowrap transition-all leading-normal ${filtro === 'rejeitadas' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-red-500'}`}>NFC-e Rejeitadas</button>
                            <button onClick={() => setFiltro('recibo')} className={`px-4 py-2 rounded-lg font-bold text-[11px] uppercase tracking-wide whitespace-nowrap transition-all leading-normal ${filtro === 'recibo' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-blue-500'}`}>Apenas Recibo</button>
                        </div>

                        <div className="relative w-full lg:max-w-sm group">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">🔍</span>
                            <input 
                                type="text" 
                                placeholder="Buscar Nº Pedido ou CPF..." 
                                className="w-full pl-9 pr-10 py-2.5 bg-slate-100 border border-transparent rounded-xl text-sm font-medium text-slate-800 outline-none focus:bg-white focus:border-emerald-400 transition-all placeholder-slate-400" 
                                value={buscaHistorico} 
                                onChange={(e) => setBuscaHistorico(e.target.value)} 
                            />
                            {buscaHistorico && <button onClick={() => setBuscaHistorico('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-red-500">✕</button>}
                        </div>
                    </div>
                </div>

                {/* LISTA DE VENDAS */}
                <div className="flex-1 overflow-auto p-4 sm:p-6 pdv-scroll">
                    {carregando ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-4">
                            <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-emerald-600"></div>
                            <span className="text-sm font-bold text-slate-500">Buscando vendas no sistema...</span>
                        </div>
                    ) : vendasFiltradas.length === 0 ? (
                        <div className="h-48 flex flex-col items-center justify-center text-slate-400 bg-white border border-slate-200 border-dashed rounded-2xl">
                            <span className="text-4xl mb-3 opacity-50">📭</span>
                            <p className="font-bold text-sm">{buscaHistorico ? "Nenhum resultado encontrado." : "Nenhuma venda para este filtro."}</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {vendasFiltradas.map(v => {
                                const statusNfce = v.fiscal?.status?.toUpperCase() || '';
                                const isCancelada = v.status === 'cancelada' || statusNfce.includes('CANCEL');
                                const temId = !!v.fiscal?.idPlugNotas;

                                let dataProcessamento = v.createdAt?.toDate ? v.createdAt.toDate() : new Date(v.createdAt || Date.now());
                                if (v.fiscal?.dataAutorizacao) {
                                    dataProcessamento = v.fiscal.dataAutorizacao?.toDate ? v.fiscal.dataAutorizacao.toDate() : new Date(v.fiscal.dataAutorizacao);
                                } else if (v.fiscal?.updatedAt) {
                                    dataProcessamento = v.fiscal.updatedAt?.toDate ? v.fiscal.updatedAt.toDate() : new Date(v.fiscal.updatedAt);
                                } else if (v.updatedAt) {
                                    dataProcessamento = v.updatedAt?.toDate ? v.updatedAt.toDate() : new Date(v.updatedAt);
                                }
                                const minutosPassados = (agora - dataProcessamento) / (1000 * 60);

                                let tagNfce = null;
                                if (isCancelada) tagNfce = <span className="bg-slate-200 text-slate-600 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wide leading-normal">CANCELADA</span>;
                                else if (statusNfce === 'AUTORIZADA' || statusNfce === 'CONCLUIDO') tagNfce = <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wide leading-normal">AUTORIZADA</span>;
                                else if (statusNfce === 'REJEITADA' || statusNfce === 'REJEITADO' || statusNfce === 'DENEGADO' || statusNfce === 'ERRO') tagNfce = <span className="bg-red-100 text-red-700 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wide leading-normal">REJEITADA</span>;
                                else if (statusNfce === 'PROCESSANDO') tagNfce = <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wide leading-normal animate-pulse">⏳ PROCESSANDO</span>;
                                else tagNfce = <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wide leading-normal">RECIBO (MEI)</span>;

                                return (
                                    <div key={v.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center hover:shadow-md hover:border-emerald-300 transition-all group">
                                        
                                        {/* INFORMAÇÕES DA VENDA */}
                                        <div className="flex-1 min-w-0 w-full">
                                            <div className="flex items-center gap-3 flex-wrap mb-1.5">
                                                <span className={`font-black text-lg transition-colors ${isCancelada ? 'text-slate-400 line-through' : 'text-slate-800 group-hover:text-emerald-600'}`}>#{v.id.slice(-4)}</span>
                                                {tagNfce}
                                                {v.clienteCpf && <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded-md text-[10px] font-bold leading-normal">CPF: {v.clienteCpf}</span>}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
                                                <span>{formatarData(v.createdAt)} {formatarHora(v.createdAt)}</span>
                                                <span className="text-slate-300">•</span>
                                                <span className="uppercase text-emerald-600 font-bold">{v.formaPagamento}</span>
                                            </div>

                                            {(statusNfce === 'REJEITADA' || statusNfce === 'REJEITADO') && (
                                                <div className="mt-2 text-[11px] text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100 inline-block leading-normal">
                                                    ⚠️ <strong className="font-bold">Motivo:</strong> {v.fiscal?.motivoRejeicao || v.fiscal?.mensagem || 'Rejeitada pela Sefaz'}
                                                </div>
                                            )}
                                        </div>

                                        {/* VALOR E BOTÕES DE AÇÃO */}
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full xl:w-auto gap-4 shrink-0 border-t xl:border-t-0 border-slate-100 pt-3 xl:pt-0">
                                            
                                            <span className={`font-black text-2xl shrink-0 ${isCancelada ? 'text-slate-400' : 'text-slate-800'}`}>
                                                {formatarMoeda(v.total)}
                                            </span>

                                            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                                
                                                {temId && (statusNfce === 'PROCESSANDO' || statusNfce === 'REJEITADA' || statusNfce === 'REJEITADO') && (
                                                    <button onClick={() => onConsultarStatus(v)} className="bg-slate-100 text-slate-600 border border-slate-200 px-3 py-2 rounded-lg font-bold hover:bg-slate-200 transition-colors text-xs flex items-center gap-1.5 leading-normal" title="Atualizar Status na Sefaz">
                                                        🔄 Sincronizar
                                                    </button>
                                                )}

                                                {(statusNfce === 'AUTORIZADA' || statusNfce === 'CONCLUIDO') && (
                                                     <button onClick={() => onBaixarPdf(v)} className="bg-blue-50 text-blue-600 border border-blue-200 px-3 py-2 rounded-lg font-bold hover:bg-blue-100 transition-colors text-xs flex items-center gap-1.5 leading-normal">
                                                         📄 PDF
                                                     </button>
                                                )}
                                                
                                                {(statusNfce === 'AUTORIZADA' || statusNfce === 'CONCLUIDO') && (
                                                     <button onClick={() => onEnviarWhatsApp(v)} className="bg-green-50 text-green-600 border border-green-200 px-3 py-2 rounded-lg font-bold hover:bg-green-100 transition-colors text-xs flex items-center gap-1.5 leading-normal">
                                                         📱 Whats
                                                     </button>
                                                )}

                                                {(statusNfce === 'AUTORIZADA' || statusNfce === 'CONCLUIDO') && (
                                                    <button onClick={() => onBaixarXml(v)} className="bg-purple-50 text-purple-600 border border-purple-200 px-3 py-2 rounded-lg font-bold hover:bg-purple-100 transition-colors text-xs flex items-center gap-1.5 leading-normal">
                                                        {'</>'} XML
                                                    </button>
                                                )}

                                                {isCancelada && temId && (
                                                    <button
                                                        onClick={() => typeof onBaixarXmlCancelamento === 'function' ? onBaixarXmlCancelamento(v) : onBaixarXml(v)}
                                                        className="bg-slate-100 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg font-bold hover:bg-slate-200 transition-colors text-xs flex items-center gap-1.5 leading-normal"
                                                    >
                                                        {'</>'} XML Canc.
                                                    </button>
                                                )}

                                                {(() => {
                                                    const passouDoTempo = (statusNfce === 'AUTORIZADA' || statusNfce === 'CONCLUIDO') && minutosPassados > 30;
                                                    if (!isCancelada) {
                                                        return (
                                                            <button
                                                                onClick={() => {
                                                                    if (window.confirm("Deseja tentar cancelar esta venda/nota na Sefaz?")) onCancelarNfce(v);
                                                                }}
                                                                className="bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg font-bold hover:bg-red-100 transition-colors text-xs flex items-center gap-1.5 leading-normal"
                                                            >
                                                                {statusNfce === 'AUTORIZADA' || statusNfce === 'CONCLUIDO' ? 'Cancelar NFC-e' : 'Cancelar'}
                                                            </button>
                                                        );
                                                    }
                                                    return null;
                                                })()}

                                                <button onClick={() => onSelecionarVenda(v)} className="bg-slate-800 text-white border border-slate-800 px-4 py-2 rounded-lg font-bold hover:bg-slate-900 transition-colors text-xs leading-normal ml-auto sm:ml-0">
                                                    Detalhes
                                                </button>

                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
