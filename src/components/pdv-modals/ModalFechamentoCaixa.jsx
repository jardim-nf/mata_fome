import React, { useState, useEffect } from 'react';
import { formatarMoeda } from './pdvHelpers';
import { 
    IoWalletOutline, 
    IoCashOutline, 
    IoArrowDownCircleOutline, 
    IoArrowUpCircleOutline, 
    IoShieldCheckmarkOutline, 
    IoAlertCircleOutline,
    IoCloseOutline,
    IoCardOutline,
    IoLockClosedOutline
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
        return <IoCashOutline className="text-emerald-500 shrink-0" size={15} />;
    }
    if (f.includes('pix')) {
        return <PixIcon className="text-cyan-500 shrink-0" size={14} />;
    }
    if (f.includes('debito') || f.includes('débito') || f.includes('debit')) {
        return <IoCardOutline className="text-indigo-500 shrink-0" size={15} />;
    }
    if (f.includes('credito') || f.includes('crédito') || f.includes('credit')) {
        return <IoCardOutline className="text-purple-500 shrink-0" size={15} />;
    }
    return <IoCardOutline className="text-slate-500 shrink-0" size={15} />;
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

export const ModalFechamentoCaixa = ({ visivel, caixa, vendasDoDia, movimentacoes, onClose, onConfirmarFechamento }) => {
    const [saldoInformado, setSaldoInformado] = useState('');

    useEffect(() => {
        if (visivel) setSaldoInformado('');
    }, [visivel]);

    if (!visivel || !caixa) return null;

    const resumoVendas = { dinheiro: 0, pix: 0, debito: 0, credito: 0, total: 0, formasPagamento: {} };
    if (vendasDoDia) {
        vendasDoDia.forEach(v => {
            if (v.status === 'cancelado') return;

            const valVendaFinal = parseFloat(v.total || v.totalFinal || 0);
            resumoVendas.total += valVendaFinal;
            
            const pagamentosLista = Array.isArray(v.pagamentos)
                ? v.pagamentos
                : (v.pagamentos && typeof v.pagamentos === 'object' ? Object.values(v.pagamentos) : []);

            if (pagamentosLista.length > 0) {
                const totalPagos = pagamentosLista.reduce((acc, curr) => acc + parseFloat(curr.valor || 0), 0);
                // Só descontamos o troco se a soma dos pagamentos listados for maior que o total da venda (indicando valor bruto com troco embutido)
                let trocoDisponivel = totalPagos > valVendaFinal ? parseFloat(v.troco || 0) : 0;

                pagamentosLista.forEach(p => {
                    const fOriginal = p.forma || p.formaPagamento || '';
                    const fTraduzida = traduzirForma(fOriginal);
                    let val = parseFloat(p.valor || 0);
                    
                    if (fTraduzida === 'Dinheiro') {
                        const valorEfetivo = Math.max(0, val - trocoDisponivel);
                        resumoVendas.dinheiro += valorEfetivo;
                        resumoVendas.formasPagamento[fTraduzida] = (resumoVendas.formasPagamento[fTraduzida] || 0) + valorEfetivo;
                        trocoDisponivel = Math.max(0, trocoDisponivel - val); // consumed
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
    }

    resumoVendas.qtd = vendasDoDia ? vendasDoDia.filter(v => v.status !== 'cancelado').length : 0;
    resumoVendas.outros = resumoVendas.pix + resumoVendas.debito + resumoVendas.credito;
    resumoVendas.suprimento = parseFloat(movimentacoes?.totalSuprimento || 0);
    resumoVendas.sangria = parseFloat(movimentacoes?.totalSangria || 0);
    resumoVendas.detalhesMov = movimentacoes?.detalhes || [];

    // Cálculos
    const saldoInicial = parseFloat(caixa.saldoInicial || 0);
    const suprimentos = resumoVendas.suprimento;
    const sangrias = resumoVendas.sangria;
    
    const saldoIdealGaveta = saldoInicial + suprimentos + resumoVendas.dinheiro - sangrias;
    const finalInfo = parseFloat(saldoInformado || 0);
    const diferenca = finalInfo - saldoIdealGaveta;
    const hasTyped = saldoInformado !== '';

    // Percentagens para barras de progresso
    const totalVendas = resumoVendas.total || 1;
    const pctDinheiro = Math.min(100, Math.round((resumoVendas.dinheiro / totalVendas) * 100));
    const pctPix = Math.min(100, Math.round((resumoVendas.pix / totalVendas) * 100));
    const pctDebito = Math.min(100, Math.round((resumoVendas.debito / totalVendas) * 100));
    const pctCredito = Math.min(100, Math.round((resumoVendas.credito / totalVendas) * 100));

    const handleConfirmar = () => {
        onConfirmarFechamento({
            resumoVendas,
            saldoFinalInformado: finalInfo,
            diferenca
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9600] p-4 backdrop-blur-sm animate-fadeIn no-print">
            <div className="bg-white rounded-[2rem] p-6 max-w-md w-full max-h-[90vh] shadow-2xl border border-slate-100 transform animate-slideUp flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <div>
                        <h3 className="font-black text-xl text-slate-800 leading-tight">Fechamento de Caixa</h3>
                        <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Conciliação de valores e encerramento de turno</p>
                    </div>
                    <button onClick={onClose} className="bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 p-2 rounded-full border border-slate-100 transition-colors">
                        <IoCloseOutline size={18} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar space-y-4 my-2">
                    {/* Grid de Resumo */}
                    <div className="grid grid-cols-2 gap-3 mb-1">
                        <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-xl flex items-center gap-2.5">
                            <div className="p-2 bg-slate-100 text-slate-500 rounded-lg shrink-0">
                                <IoWalletOutline size={18} />
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Saldo Inicial</p>
                                <p className="text-sm font-black text-slate-700 leading-tight">{formatarMoeda(saldoInicial)}</p>
                            </div>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100/60 p-3 rounded-xl flex items-center gap-2.5">
                            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg shrink-0">
                                <IoCashOutline size={18} />
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-emerald-600/70 uppercase tracking-wider">Dinheiro em Caixa</p>
                                <p className="text-sm font-black text-emerald-700 leading-tight">{formatarMoeda(resumoVendas.dinheiro)}</p>
                            </div>
                        </div>
                        <div className="bg-blue-50 border border-blue-100/60 p-3 rounded-xl flex items-center gap-2.5">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg shrink-0">
                                <IoArrowDownCircleOutline size={18} />
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-blue-600/70 uppercase tracking-wider">Suprimentos</p>
                                <p className="text-sm font-black text-blue-700 leading-tight">{formatarMoeda(suprimentos)}</p>
                            </div>
                        </div>
                        <div className="bg-red-50 border border-red-100/60 p-3 rounded-xl flex items-center gap-2.5">
                            <div className="p-2 bg-red-100 text-red-600 rounded-lg shrink-0">
                                <IoArrowUpCircleOutline size={18} />
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-red-600/70 uppercase tracking-wider">Sangrias</p>
                                <p className="text-sm font-black text-red-700 leading-tight">{formatarMoeda(sangrias)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Métodos de Pagamento */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
                        <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-3">Vendas por Forma de Pagamento</h4>
                        <div className="space-y-3">
                            {Object.entries(resumoVendas.formasPagamento).length === 0 ? (
                                <p className="text-xs text-slate-400 font-bold italic text-center py-2">Nenhuma venda registrada neste turno.</p>
                            ) : (
                                Object.entries(resumoVendas.formasPagamento)
                                    .sort((a, b) => b[1] - a[1]) // Ordena decrescente por valor
                                    .map(([forma, valor]) => {
                                        const pct = totalVendas > 0 ? Math.min(100, Math.round((valor / totalVendas) * 100)) : 0;
                                        return (
                                            <div key={forma}>
                                                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                                                    <div className="flex items-center gap-1.5">
                                                        {getPaymentIcon(forma)}
                                                        <span>{forma}</span>
                                                    </div>
                                                    <span>{formatarMoeda(valor)} <span className="text-slate-400 font-semibold text-[10px]">({pct}%)</span></span>
                                                </div>
                                                <div className="w-full bg-slate-200/60 rounded-full h-1.5 mt-1">
                                                    <div className={`${getProgressBarColor(forma)} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }}></div>
                                                </div>
                                            </div>
                                        );
                                    })
                            )}
                            
                            {/* Linha de Total Geral */}
                            <div className="pt-2.5 border-t border-slate-200 mt-2 flex justify-between items-center text-[10px] font-black text-slate-800 uppercase tracking-wider">
                                <span>Total Faturado</span>
                                <span className="text-xs font-black">{formatarMoeda(resumoVendas.total)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Conciliação Física da Gaveta */}
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                        <div className="grid grid-cols-2 gap-4 items-center">
                            <div className="border-r border-slate-200/80 pr-4">
                                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Saldo Esperado em Gaveta</span>
                                <span className="text-xl font-black text-slate-700 leading-tight">{formatarMoeda(saldoIdealGaveta)}</span>
                                <span className="block text-[8px] text-slate-400 mt-1 leading-normal">*Calculado apenas com dinheiro físico.</span>
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 text-center">Declarado em Dinheiro</label>
                                <input 
                                    type="number" 
                                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-lg font-black text-center focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all" 
                                    placeholder="0.00" 
                                    value={saldoInformado} 
                                    onChange={(e) => setSaldoInformado(e.target.value)} 
                                />
                                <div className="flex gap-1.5 mt-2 justify-center">
                                    <button 
                                        onClick={() => setSaldoInformado(saldoIdealGaveta.toFixed(2))}
                                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-black px-3 py-1 rounded-md border border-emerald-200 transition-all active:scale-95 uppercase tracking-wider"
                                    >
                                        Igualar
                                    </button>
                                    <button 
                                        onClick={() => setSaldoInformado('0')}
                                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black px-3 py-1 rounded-md border border-slate-200 transition-all active:scale-95 uppercase tracking-wider"
                                    >
                                        Zerar
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Div Diferença */}
                        {!hasTyped ? (
                            <div className="mt-3.5 flex items-center justify-center gap-1.5 p-2.5 rounded-xl border bg-slate-100/50 border-slate-200 text-[10px] font-bold text-slate-400">
                                <IoAlertCircleOutline size={14} />
                                <span>Informe o valor para conciliar a gaveta.</span>
                            </div>
                        ) : (
                            <div className={`mt-3.5 flex items-center justify-between p-2.5 rounded-xl border text-[11px] font-bold transition-all ${
                                diferenca === 0 
                                    ? 'bg-emerald-50 border-emerald-250 text-emerald-700' 
                                    : diferenca > 0 
                                        ? 'bg-sky-50 border-sky-250 text-sky-700' 
                                        : 'bg-red-50 border-red-255 text-red-700'
                            }`}>
                                <div className="flex items-center gap-1.5">
                                    {diferenca === 0 ? (
                                        <IoShieldCheckmarkOutline size={15} className="text-emerald-600" />
                                    ) : (
                                        <IoAlertCircleOutline size={15} className={diferenca > 0 ? 'text-sky-600' : 'text-red-600'} />
                                    )}
                                    <span>{diferenca === 0 ? 'CONCILIADO:' : diferenca > 0 ? 'SOBRA EM GAVETA:' : 'DIFERENÇA (FALTA):'}</span>
                                </div>
                                <span className="text-sm font-black">
                                    {diferenca > 0 ? '+' : ''}{formatarMoeda(diferenca)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Encerramento */}
                <div className="shrink-0 pt-3 border-t border-slate-150 mt-1">
                    <button 
                        onClick={handleConfirmar} 
                        className="w-full bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white p-3.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        <IoLockClosedOutline size={15} /> CONFIRMAR E ENCERRAR TURNO
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalFechamentoCaixa;
