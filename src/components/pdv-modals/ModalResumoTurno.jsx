import React from 'react';
import { formatarMoeda, formatarData, formatarHora } from './pdvHelpers';

export const ModalResumoTurno = ({ visivel, turno, onClose }) => {
    if (!visivel || !turno) return null;

    const res = turno.resumoVendas || {};
    const saldoInicial = parseFloat(turno.saldoInicial || 0);
    const vendasTotal = parseFloat(res.total || 0);
    const vendasDinheiro = parseFloat(res.dinheiro || 0);
    const vendasOutros = parseFloat(res.outros || 0);
    const suprimento = parseFloat(res.suprimento || 0);
    const sangria = parseFloat(res.sangria || 0);
    const detalhesMov = res.detalhesMov || [];
    const qtdVendas = res.qtd || 0;

    const esperado = saldoInicial + vendasDinheiro + suprimento - sangria;
    const informado = parseFloat(turno.saldoFinalInformado || 0);
    const diferenca = parseFloat(turno.diferenca || 0);
    
    const isAberto = turno.status !== 'fechado';

    return (
        <div id="resumo-turno-overlay" className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-[9600] p-4 backdrop-blur-sm no-print">
            {/* Removido o fundo cinza/amarelado e colocado bg-white */}
            <div id="resumo-turno-content" className="bg-white w-full max-w-sm p-0 rounded-lg shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden border border-slate-300 print:border-none print:shadow-none print:w-[80mm]">
                
                {/* Botão Fechar (Oculto na impressão) */}
                <button onClick={onClose} className="absolute top-3 right-3 bg-slate-100 hover:bg-red-100 hover:text-red-500 p-2 rounded-full transition-colors no-print z-10">✕</button>

                <div className="p-6">
                    {/* CABEÇALHO DO RECIBO */}
                    <div className="text-center pb-4 mb-4 border-b-2 border-dashed border-slate-300">
                        <h2 className="font-black text-2xl text-slate-800 uppercase tracking-widest">RELATÓRIO</h2>
                        <h3 className="font-bold text-sm text-slate-600 uppercase tracking-widest">Turno de Caixa</h3>
                        <p className="text-slate-500 text-[11px] font-mono mt-2">ID: {turno.id?.toUpperCase()}</p>
                        
                        <div className={`mt-3 inline-block px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${isAberto ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                            {isAberto ? '🟢 CAIXA EM ANDAMENTO' : '🔒 CAIXA ENCERRADO'}
                        </div>
                    </div>

                    {/* CORPO DO RECIBO */}
                    <div className="space-y-3 mb-6 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2 print:max-h-none print:overflow-visible text-[13px] text-slate-700">
                        
                        {/* DATAS */}
                        <div className="flex flex-col gap-1 mb-2">
                            <div className="flex justify-between"><span>Abertura:</span> <b className="font-mono">{formatarData(turno.dataAbertura)} {formatarHora(turno.dataAbertura)}</b></div>
                            <div className="flex justify-between"><span>Fechamento:</span> <b className="font-mono">{turno.dataFechamento ? `${formatarData(turno.dataFechamento)} ${formatarHora(turno.dataFechamento)}` : '--/--/---- --:--'}</b></div>
                        </div>

                        <div className="border-t border-dashed border-slate-300 pt-3 flex justify-between items-center text-slate-900">
                            <span className="font-bold uppercase text-[11px]">Saldo Inicial (Fundo)</span> 
                            <b className="font-mono text-sm">{formatarMoeda(saldoInicial)}</b>
                        </div>

                        {/* VENDAS */}
                        <div className="border-t border-dashed border-slate-300 pt-3 flex flex-col gap-1">
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-bold uppercase text-[11px]">Resumo de Vendas</span>
                                <span className="text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-bold">{qtdVendas} pedido(s)</span>
                            </div>
                            <div className="flex justify-between text-slate-600"><span>Dinheiro:</span> <b className="font-mono">{formatarMoeda(vendasDinheiro)}</b></div>
                            <div className="flex justify-between text-slate-600"><span>Cartão/Pix/Outros:</span> <b className="font-mono">{formatarMoeda(vendasOutros)}</b></div>
                            <div className="flex justify-between font-black text-slate-900 mt-2 text-[15px]"><span>TOTAL FATURADO:</span> <span className="font-mono">{formatarMoeda(vendasTotal)}</span></div>
                        </div>

                        {/* MOVIMENTAÇÕES */}
                        <div className="border-t border-dashed border-slate-300 pt-3 flex flex-col gap-1">
                            <span className="font-bold uppercase text-[11px] mb-1">Movimentações</span>
                            <div className="flex justify-between text-emerald-600"><span>Suprimentos (+):</span> <b className="font-mono">{formatarMoeda(suprimento)}</b></div>
                            <div className="flex justify-between text-red-500"><span>Sangrias (-):</span> <b className="font-mono">{formatarMoeda(sangria)}</b></div>

                            {detalhesMov.length > 0 && (
                                <div className="mt-2 pl-2 border-l-2 border-slate-300 text-[11px]">
                                    {detalhesMov.map((mov, idx) => (
                                        <div key={idx} className="flex justify-between text-slate-500 italic mb-1">
                                            <span className="truncate pr-2">- {mov.descricao}</span>
                                            <span className="font-mono">{formatarMoeda(mov.valor)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* RESULTADO FINAL */}
                        {!isAberto && (
                            <div className="border-t-2 border-slate-800 pt-3 p-3 rounded-lg mt-4 border border-slate-300 print:border-t-2 print:border-black print:rounded-none">
                                <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 mb-1"><span>Dinheiro Esperado:</span> <span className="font-mono">{formatarMoeda(esperado)}</span></div>
                                <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 mb-2"><span>Dinheiro Informado:</span> <span className="font-mono">{formatarMoeda(informado)}</span></div>
                                
                                <div className={`flex justify-between text-[15px] font-black mt-2 pt-2 border-t border-slate-300 ${diferenca < 0 ? 'text-red-600' : diferenca > 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                                    <span>{diferenca < 0 ? 'QUEBRA (-)' : diferenca > 0 ? 'SOBRA (+)' : 'CAIXA EXATO'}</span>
                                    <span className="font-mono">{formatarMoeda(diferenca)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="text-center text-[10px] text-slate-400 font-mono border-t border-dashed border-slate-300 pt-4 print:block">
                        *** FIM DO RELATÓRIO ***
                    </div>
                </div>

                {/* BOTÕES (Ocultos na impressão) */}
                <div className="grid gap-2 p-4 bg-white border-t border-slate-200 no-print rounded-b-lg">
                    <button 
                        onClick={() => {
                            const estabId = turno.estabelecimentoId || turno.lojaId || '';
                            window.open(`/impressao-isolada?turnoId=${turno.id}&estabId=${estabId}&origem=turno`, '_blank', 'width=380,height=600');
                        }} 
                        className="w-full border border-slate-300 text-slate-700 bg-slate-50 p-3 rounded-xl font-bold hover:bg-slate-100 transition-all flex justify-center items-center gap-2"
                    >
                        🖨️ IMPRIMIR RECIBO
                    </button>
                    <button onClick={onClose} className="w-full bg-slate-800 text-white p-3 rounded-xl font-bold hover:bg-black shadow-lg transition-all">
                        FECHAR
                    </button>
                </div>
            </div>
        </div>
    );
};
