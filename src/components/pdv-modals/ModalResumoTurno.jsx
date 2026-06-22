import React from 'react';
import { formatarMoeda, formatarData, formatarHora } from './pdvHelpers';
import { 
    IoCloseOutline,
    IoCalendarOutline,
    IoTimeOutline,
    IoWalletOutline,
    IoCashOutline,
    IoCardOutline,
    IoPrintOutline,
    IoListOutline,
    IoTrendingUpOutline,
    IoShieldCheckmarkOutline,
    IoAlertCircleOutline,
    IoLockClosedOutline,
    IoArrowDownCircleOutline,
    IoArrowUpCircleOutline
} from 'react-icons/io5';

// Ícone vetorial do Pix
const PixIcon = ({ className, size = 16 }) => (
    <svg 
        className={className} 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
    >
        <path d="M12 2L2 12l10 10 10-10L12 2z" />
        <path d="M12 8l-4 4 4 4 4-4-4-4z" />
    </svg>
);

const traduzirForma = (metodo) => {
    if (!metodo || metodo === 'N/A') return 'Não Informado';
    const m = metodo.toLowerCase().trim();
    const mapa = {
        'credit_card': 'Cartão de Crédito',
        'debit_card': 'Cartão de Débito',
        'money': 'Dinheiro',
        'cash': 'Dinheiro',
        'dinheiro': 'Dinheiro',
        'pix': 'PIX',
        'pix_manual': 'PIX Manual',
        'pix manual': 'PIX Manual',
        'wallet': 'Carteira Digital',
        'card': 'Cartão',
        'cartao': 'Cartão',
        'cartão': 'Cartão',
        'online': 'Online',
        'crediario': 'Crediário',
        'crediário': 'Crediário',
        'credito': 'Cartão de Crédito',
        'crédito': 'Cartão de Crédito',
        'debito': 'Cartão de Débito',
        'débito': 'Cartão de Débito'
    };
    return mapa[m] || metodo.charAt(0).toUpperCase() + metodo.slice(1);
};

const getPaymentIcon = (forma) => {
    const f = forma.toLowerCase();
    if (f.includes('dinheiro') || f.includes('cash') || f.includes('money')) {
        return <IoCashOutline className="text-emerald-500 shrink-0 print:hidden" size={14} />;
    }
    if (f.includes('pix')) {
        return <PixIcon className="text-cyan-500 shrink-0 print:hidden" size={13} />;
    }
    if (f.includes('debito') || f.includes('débito') || f.includes('debit')) {
        return <IoCardOutline className="text-indigo-500 shrink-0 print:hidden" size={14} />;
    }
    if (f.includes('credito') || f.includes('crédito') || f.includes('credit')) {
        return <IoCardOutline className="text-purple-500 shrink-0 print:hidden" size={14} />;
    }
    return <IoCardOutline className="text-slate-500 shrink-0 print:hidden" size={14} />;
};

const getProgressBarColor = (forma) => {
    const f = forma.toLowerCase();
    if (f.includes('dinheiro') || f.includes('cash') || f.includes('money')) {
        return 'bg-emerald-500';
    }
    if (f.includes('pix')) {
        return 'bg-sky-500';
    }
    if (f.includes('debito') || f.includes('débito') || f.includes('debit')) {
        return 'bg-indigo-500';
    }
    if (f.includes('credito') || f.includes('crédito') || f.includes('credit')) {
        return 'bg-purple-500';
    }
    return 'bg-slate-500';
};

export const ModalResumoTurno = ({ visivel, turno, onClose, onVerVendas, vendasDoDia }) => {
    if (!visivel || !turno) return null;

    const isAberto = turno.status !== 'fechado';
    let res = turno.resumoVendas || {};

    if (isAberto && vendasDoDia) {
        const resumoVendas = { dinheiro: 0, pix: 0, debito: 0, credito: 0, total: 0, formasPagamento: {} };
        vendasDoDia.forEach(v => {
            if (v.status === 'cancelado') return;

            const valVendaFinal = parseFloat(v.total || v.totalFinal || 0);
            resumoVendas.total += valVendaFinal;
            
            const pagamentosLista = Array.isArray(v.pagamentos)
                ? v.pagamentos
                : (v.pagamentos && typeof v.pagamentos === 'object' ? Object.values(v.pagamentos) : []);

            if (pagamentosLista.length > 0) {
                const totalPagos = pagamentosLista.reduce((acc, curr) => acc + parseFloat(curr.valor || 0), 0);
                let trocoDisponivel = totalPagos > valVendaFinal ? parseFloat(v.troco || 0) : 0;

                pagamentosLista.forEach(p => {
                    const fOriginal = p.forma || p.formaPagamento || '';
                    const fTraduzida = traduzirForma(fOriginal);
                    let val = parseFloat(p.valor || 0);
                    
                    if (fTraduzida === 'Dinheiro') {
                        const valorEfetivo = Math.max(0, val - trocoDisponivel);
                        resumoVendas.dinheiro += valorEfetivo;
                        resumoVendas.formasPagamento[fTraduzida] = (resumoVendas.formasPagamento[fTraduzida] || 0) + valorEfetivo;
                        trocoDisponivel = Math.max(0, trocoDisponivel - val);
                    } else {
                        if (fTraduzida === 'PIX' || fTraduzida === 'PIX Manual') {
                            resumoVendas.pix += val;
                        } else if (fTraduzida === 'Cartão de Crédito') {
                            resumoVendas.credito += val;
                        } else if (fTraduzida === 'Cartão de Débito' || fTraduzida === 'Cartão') {
                            resumoVendas.debito += val;
                        }
                        resumoVendas.formasPagamento[fTraduzida] = (resumoVendas.formasPagamento[fTraduzida] || 0) + val;
                    }
                });
            } else {
                const fOriginal = v.formaPagamento || '';
                const fTraduzida = traduzirForma(fOriginal);
                
                resumoVendas.formasPagamento[fTraduzida] = (resumoVendas.formasPagamento[fTraduzida] || 0) + valVendaFinal;
                if (fTraduzida === 'Dinheiro') {
                    resumoVendas.dinheiro += valVendaFinal;
                } else if (fTraduzida === 'PIX' || fTraduzida === 'PIX Manual') {
                    resumoVendas.pix += valVendaFinal;
                } else if (fTraduzida === 'Cartão de Crédito') {
                    resumoVendas.credito += valVendaFinal;
                } else if (fTraduzida === 'Cartão de Débito' || fTraduzida === 'Cartão') {
                    resumoVendas.debito += valVendaFinal;
                }
            }
        });
        resumoVendas.qtd = vendasDoDia.filter(v => v.status !== 'cancelado').length;
        res = resumoVendas;
    }

    const saldoInicial = parseFloat(turno.saldoInicial || 0);
    const vendasTotal = parseFloat(res.total || 0);
    const vendasDinheiro = parseFloat(res.dinheiro || 0);
    const suprimento = parseFloat(res.suprimento || 0);
    const sangria = parseFloat(res.sangria || 0);
    const detalhesMov = res.detalhesMov || [];
    const qtdVendas = res.qtd || 0;

    const esperado = saldoInicial + vendasDinheiro + suprimento - sangria;
    const informado = parseFloat(turno.saldoFinalInformado || 0);
    const diferenca = parseFloat(turno.diferenca || 0);

    const totalVendas = vendasTotal || 1;

    const formasPagMap = res.formasPagamento || {
        'Dinheiro': vendasDinheiro,
        ...(parseFloat(res.pix || 0) > 0 ? { 'PIX': parseFloat(res.pix || 0) } : {}),
        ...(parseFloat(res.debito || 0) > 0 ? { 'Cartão de Débito': parseFloat(res.debito || 0) } : {}),
        ...(parseFloat(res.credito || 0) > 0 ? { 'Cartão de Crédito': parseFloat(res.credito || 0) } : {}),
        ...(parseFloat(res.outros || 0) > 0 && parseFloat(res.pix || 0) === 0 && parseFloat(res.debito || 0) === 0 && parseFloat(res.credito || 0) === 0 ? { 'Cartão/Pix/Outros': parseFloat(res.outros || 0) } : {})
    };

    return (
        <div id="resumo-turno-overlay" className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9600] p-4 backdrop-blur-sm no-print animate-fadeIn">
            <div id="resumo-turno-content" className="bg-white w-full max-w-md p-6 rounded-[2rem] shadow-2xl relative border border-slate-100 transform animate-slideUp duration-200 overflow-hidden print:border-none print:shadow-none print:w-[80mm] print:p-4">
                
                {/* Botão Fechar (Oculto na impressão) */}
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 p-2 rounded-full border border-slate-100 transition-all hover:rotate-90 no-print z-10"
                >
                    <IoCloseOutline size={18} />
                </button>

                <div>
                    {/* CABEÇALHO DO RECIBO */}
                    <div className="text-center pb-4 mb-5 border-b border-slate-100 print:border-b-2 print:border-dashed print:border-slate-300">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <IoTrendingUpOutline className="text-indigo-600 print:hidden" size={24} />
                            <h2 className="font-black text-xl text-slate-800 uppercase tracking-tight">Turno de Caixa</h2>
                        </div>
                        <p className="text-slate-400 text-[10px] font-semibold tracking-wider uppercase mb-3">
                            ID: <span className="font-mono text-slate-600 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-[11px]">{turno.id?.toUpperCase()}</span>
                        </p>
                        
                        <div className="flex justify-center print:mt-1">
                            {isAberto ? (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                                    <span>🟢 Caixa em Andamento</span>
                                </div>
                            ) : (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                                    <IoLockClosedOutline size={12} className="text-slate-500" />
                                    <span>🔒 Caixa Encerrado</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CORPO DO RECIBO */}
                    <div className="space-y-4 mb-6 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1 print:max-h-none print:overflow-visible print:pr-0 text-[13px] text-slate-700">
                        
                        {/* DATAS */}
                        <div className="bg-slate-50/50 border border-slate-200/50 p-3.5 rounded-2xl flex flex-col gap-2 mb-4 text-xs text-slate-600 print:bg-transparent print:border-none print:p-0 print:mb-2">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-1.5">
                                    <IoCalendarOutline className="text-slate-400 print:hidden" size={14} />
                                    <span>Abertura:</span>
                                </div>
                                <b className="font-mono text-slate-800 print:text-black">{formatarData(turno.dataAbertura)} {formatarHora(turno.dataAbertura)}</b>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-1.5">
                                    <IoTimeOutline className="text-slate-400 print:hidden" size={14} />
                                    <span>Fechamento:</span>
                                </div>
                                <b className="font-mono text-slate-800 print:text-black">
                                    {turno.dataFechamento ? `${formatarData(turno.dataFechamento)} ${formatarHora(turno.dataFechamento)}` : '--/--/---- --:--'}
                                </b>
                            </div>
                        </div>

                        {/* SALDO INICIAL */}
                        <div className="bg-slate-50/50 border border-slate-200/50 p-3 rounded-2xl flex justify-between items-center mb-4 print:bg-transparent print:border-none print:p-0 print:mb-2 print:border-t print:border-dashed print:border-slate-300 print:pt-2">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-slate-100 text-slate-500 rounded-lg shrink-0 print:hidden">
                                    <IoWalletOutline size={16} />
                                </div>
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider print:text-[11px] print:text-black print:font-normal">Saldo Inicial (Fundo)</span>
                            </div>
                            <b className="font-mono text-slate-800 text-sm print:text-black">{formatarMoeda(saldoInicial)}</b>
                        </div>

                        {/* TOTAL FATURADO BANNER */}
                        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-2xl p-4 shadow-md flex justify-between items-center mb-4 print:bg-none print:text-black print:p-0 print:shadow-none print:mb-3 print:border-b print:border-dashed print:border-slate-300 print:pb-2">
                            <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-85 print:text-black print:text-[11px] print:opacity-100">Total Faturado</span>
                                <h3 className="text-2xl font-black font-mono leading-none mt-1 print:text-black print:text-lg">{formatarMoeda(vendasTotal)}</h3>
                            </div>
                            <div className="bg-white/15 backdrop-blur-md px-2.5 py-1.5 rounded-xl text-[11px] font-black tracking-wide flex items-center gap-1 print:bg-slate-100 print:text-slate-700 print:border print:border-slate-300">
                                <span>{qtdVendas} pedido(s)</span>
                            </div>
                        </div>

                        {/* VENDAS DETALHADAS COM PROGRESS BARS */}
                        <div className="bg-slate-50/50 border border-slate-200/50 p-4 rounded-2xl mb-4 print:bg-transparent print:border-none print:p-0 print:mb-3">
                            <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-3 print:text-black print:text-[11px] print:mb-1">Vendas por Forma de Pagamento</h4>
                            <div className="space-y-3 print:space-y-1">
                                {Object.entries(formasPagMap).length === 0 ? (
                                    <p className="text-xs text-slate-400 font-bold italic text-center py-2">Nenhuma venda registrada.</p>
                                ) : (
                                    Object.entries(formasPagMap)
                                        .sort((a, b) => b[1] - a[1]) // Ordena decrescente por valor
                                        .map(([forma, valor]) => {
                                            const pct = totalVendas > 0 ? Math.min(100, Math.round((valor / totalVendas) * 100)) : 0;
                                            return (
                                                <div key={forma}>
                                                    <div className="flex justify-between items-center text-xs font-bold text-slate-700 print:text-[11px] print:text-black">
                                                        <div className="flex items-center gap-1.5">
                                                            {getPaymentIcon(forma)}
                                                            <span>{forma}</span>
                                                        </div>
                                                        <span className="font-mono">{formatarMoeda(valor)} <span className="text-slate-400 font-semibold text-[9px] print:hidden">({pct}%)</span></span>
                                                    </div>
                                                    <div className="w-full bg-slate-200/60 rounded-full h-1 mt-1 print:hidden">
                                                        <div className={`${getProgressBarColor(forma)} h-1 rounded-full transition-all`} style={{ width: `${pct}%` }}></div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                )}
                            </div>
                        </div>

                        {/* MOVIMENTAÇÕES (SUPRIMENTO / SANGRIA) */}
                        <div className="bg-slate-50/50 border border-slate-200/50 p-4 rounded-2xl mb-4 print:bg-transparent print:border-none print:p-0 print:mb-3">
                            <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-3 print:text-black print:text-[11px] print:mb-1">Movimentações</h4>
                            <div className="space-y-2.5">
                                <div className="flex justify-between items-center text-xs font-bold text-emerald-600 print:text-black">
                                    <div className="flex items-center gap-1.5">
                                        <IoArrowDownCircleOutline size={14} className="print:hidden" />
                                        <span>Suprimentos (+)</span>
                                    </div>
                                    <b className="font-mono">{formatarMoeda(suprimento)}</b>
                                </div>
                                <div className="flex justify-between items-center text-xs font-bold text-red-500 print:text-black">
                                    <div className="flex items-center gap-1.5">
                                        <IoArrowUpCircleOutline size={14} className="print:hidden" />
                                        <span>Sangrias (-)</span>
                                    </div>
                                    <b className="font-mono">{formatarMoeda(sangria)}</b>
                                </div>

                                {detalhesMov.length > 0 && (
                                    <div className="mt-3 pl-2.5 border-l-2 border-slate-200 text-[11px] space-y-1.5 print:border-slate-400 print:mt-1 print:space-y-0.5">
                                        {detalhesMov.map((mov, idx) => (
                                            <div key={idx} className="flex justify-between text-slate-500 italic print:text-black print:text-[11px]">
                                                <span className="truncate pr-2">- {mov.descricao}</span>
                                                <span className="font-mono shrink-0">{formatarMoeda(mov.valor)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RESULTADO FINAL / CONCILIAÇÃO */}
                        {!isAberto && (
                            <div className={`p-4 rounded-2xl mb-4 border transition-colors print:bg-transparent print:border-t-2 print:border-black print:rounded-none print:p-0 print:mb-3 ${
                                diferenca < 0 
                                    ? 'bg-red-50/50 border-red-100' 
                                    : diferenca > 0 
                                        ? 'bg-emerald-50/50 border-emerald-100' 
                                        : 'bg-emerald-50/50 border-emerald-100'
                            }`}>
                                <div className="flex justify-between text-[10px] uppercase font-black text-slate-400 mb-1.5 print:text-black print:text-[11px] print:font-normal">
                                    <span>Dinheiro Esperado:</span> 
                                    <span className="font-mono text-slate-600 print:text-black">{formatarMoeda(esperado)}</span>
                                </div>
                                <div className="flex justify-between text-[10px] uppercase font-black text-slate-400 mb-2.5 print:text-black print:text-[11px] print:font-normal">
                                    <span>Dinheiro Informado:</span> 
                                    <span className="font-mono text-slate-600 print:text-black">{formatarMoeda(informado)}</span>
                                </div>
                                
                                <div className={`flex justify-between items-center text-sm font-black pt-2.5 border-t border-dashed print:border-t-2 print:border-solid print:border-black ${
                                    diferenca < 0 
                                        ? 'text-red-600 border-red-100' 
                                        : diferenca > 0 
                                            ? 'text-emerald-600 border-emerald-100' 
                                            : 'text-emerald-600 border-emerald-100'
                                }`}>
                                    <div className="flex items-center gap-1.5">
                                        {diferenca < 0 ? (
                                            <IoAlertCircleOutline className="print:hidden" size={16} />
                                        ) : (
                                            <IoShieldCheckmarkOutline className="print:hidden" size={16} />
                                        )}
                                        <span className="text-[10px] uppercase tracking-wider print:text-xs">
                                            {diferenca < 0 ? 'QUEBRA (-)' : diferenca > 0 ? 'SOBRA (+)' : 'CAIXA EXATO'}
                                        </span>
                                    </div>
                                    <span className="font-mono text-base">{formatarMoeda(diferenca)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="text-center text-[10px] text-slate-350 font-mono border-t border-dashed border-slate-200 pt-4 print:border-slate-300 print:block mb-1">
                        *** FIM DO RELATÓRIO ***
                    </div>
                </div>

                {/* BOTÕES (Ocultos na impressão) */}
                <div className="grid gap-2 p-4 bg-white border-t border-slate-100 no-print rounded-b-[2rem]">
                    <button 
                        onClick={() => {
                            const estabId = turno.estabelecimentoId || turno.lojaId || '';
                            window.open(`/impressao-isolada?turnoId=${turno.id}&estabId=${estabId}&origem=turno`, '_blank', 'width=380,height=600');
                        }} 
                        className="w-full border border-slate-200 text-slate-700 bg-white p-3 rounded-2xl font-bold hover:bg-slate-50 transition-all flex justify-center items-center gap-2 hover:scale-[1.02] active:scale-[0.98] shadow-sm"
                    >
                        <IoPrintOutline size={18} />
                        <span>IMPRIMIR RECIBO</span>
                    </button>
                    {onVerVendas && (
                        <button 
                            onClick={onVerVendas} 
                            className="w-full border border-indigo-100/50 text-indigo-650 bg-indigo-50/50 p-3 rounded-2xl font-bold hover:bg-indigo-100/70 transition-all flex justify-center items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <IoListOutline size={18} />
                            <span>VER DETALHE DE VENDAS</span>
                        </button>
                    )}
                    <button 
                        onClick={onClose} 
                        className="w-full bg-slate-900 text-white p-3 rounded-2xl font-black hover:bg-black transition-all shadow-md hover:scale-[1.02] active:scale-[0.98]"
                    >
                        FECHAR
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalResumoTurno;
