import React, { useState, useEffect } from 'react';
import { formatarMoeda } from './pdvHelpers';

export const ModalFechamentoCaixa = ({ visivel, caixa, vendasDoDia, movimentacoes, onClose, onConfirmarFechamento }) => {
    const [saldoInformado, setSaldoInformado] = useState('');

    useEffect(() => {
        if (visivel) setSaldoInformado('');
    }, [visivel]);

    if (!visivel || !caixa) return null;

    const resumoVendas = { dinheiro: 0, pix: 0, debito: 0, credito: 0, total: 0 };
    if (vendasDoDia) {
        vendasDoDia.forEach(v => {
            const valVendaFinal = parseFloat(v.total || v.totalFinal || 0);
            resumoVendas.total += valVendaFinal;
            
            if (v.pagamentos && v.pagamentos.length > 0) {
                let trocoDisponivel = parseFloat(v.troco || 0);
                v.pagamentos.forEach(p => {
                    const f = (p.forma || p.formaPagamento || '').toLowerCase();
                    let val = parseFloat(p.valor || 0);
                    
                    if (f.includes('dinheiro')) {
                        const valorEfetivo = val - trocoDisponivel;
                        resumoVendas.dinheiro += valorEfetivo;
                        trocoDisponivel = 0; // consumed
                    } else if (f.includes('pix')) {
                        resumoVendas.pix += val;
                    } else if (f.includes('debito') || f.includes('débito') || f.includes('cartao')) {
                        resumoVendas.debito += val;
                    } else if (f.includes('credito') || f.includes('crédito')) {
                        resumoVendas.credito += val;
                    } else {
                        resumoVendas.dinheiro += val; // Default if not matched
                    }
                });
            } else {
                const f = (v.formaPagamento || '').toLowerCase();
                if (f.includes('dinheiro')) resumoVendas.dinheiro += valVendaFinal;
                else if (f.includes('pix')) resumoVendas.pix += valVendaFinal;
                else if (f.includes('debito') || f.includes('débito') || f.includes('cartao')) resumoVendas.debito += valVendaFinal;
                else if (f.includes('credito') || f.includes('crédito')) resumoVendas.credito += valVendaFinal;
                else resumoVendas.dinheiro += valVendaFinal; // Fallback
            }
        });
    }

    resumoVendas.qtd = vendasDoDia ? vendasDoDia.length : 0;
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

    const handleConfirmar = () => {
        onConfirmarFechamento({
            resumoVendas,
            saldoFinalInformado: finalInfo,
            diferenca
        });
    };

    return (
        <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-[9600] p-4 backdrop-blur-sm animate-fadeIn no-print">
            <div className="bg-white rounded-[2rem] p-8 max-w-lg w-full shadow-2xl transform animate-slideUp">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-2xl text-gray-800">Fechamento de Caixa</h3>
                    <button onClick={onClose} className="bg-gray-100 p-2 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50 border border-gray-100 p-4 rounded-2xl">
                        <p className="text-xs font-bold text-gray-400 uppercase">Saldo Inicial</p>
                        <p className="text-lg font-black text-gray-700">{formatarMoeda(saldoInicial)}</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                        <p className="text-xs font-bold text-emerald-600/70 uppercase">Vendas Totais</p>
                        <p className="text-lg font-black text-emerald-600">{formatarMoeda(resumoVendas.total)}</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl">
                        <p className="text-xs font-bold text-blue-600/70 uppercase">Suprimentos</p>
                        <p className="text-lg font-black text-blue-600">{formatarMoeda(suprimentos)}</p>
                    </div>
                    <div className="bg-red-50 border border-red-100 p-4 rounded-2xl">
                        <p className="text-xs font-bold text-red-600/70 uppercase">Sangrias</p>
                        <p className="text-lg font-black text-red-600">{formatarMoeda(sangrias)}</p>
                    </div>
                </div>

                <div className="mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <h4 className="font-bold text-sm text-slate-700 mb-3">Resumo (Por Forma de Pagto)</h4>
                    <div className="space-y-1 text-sm font-medium text-slate-600">
                        <div className="flex justify-between"><span>💵 Dinheiro</span><span>{formatarMoeda(resumoVendas.dinheiro)}</span></div>
                        <div className="flex justify-between"><span>💠 Pix</span><span>{formatarMoeda(resumoVendas.pix)}</span></div>
                        <div className="flex justify-between"><span>💳 Débito</span><span>{formatarMoeda(resumoVendas.debito)}</span></div>
                        <div className="flex justify-between"><span>💳 Crédito</span><span>{formatarMoeda(resumoVendas.credito)}</span></div>
                    </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-sm font-bold text-amber-700">Saldo Esperado em Gaveta:</span>
                        <span className="text-xl font-black text-amber-600">{formatarMoeda(saldoIdealGaveta)}</span>
                    </div>
                    
                    <label className="block text-xs font-bold text-amber-600/80 uppercase mb-2">Saldo Final Informado</label>
                    <input 
                        type="number" 
                        className="w-full p-4 bg-white border-2 border-amber-300 rounded-xl text-3xl font-black text-center focus:border-amber-500 outline-none" 
                        placeholder="0,00" 
                        value={saldoInformado} 
                        onChange={(e) => setSaldoInformado(e.target.value)} 
                    />

                    {saldoInformado !== '' && (
                        <div className={`mt-3 text-center p-3 rounded-xl border ${diferenca === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : diferenca > 0 ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-red-50 border-red-200 text-red-600'}`}>
                            <span className="text-xs font-bold mr-2 uppercase">Diferença:</span>
                            <span className="text-xl font-black">{diferenca > 0 ? '+' : ''}{formatarMoeda(diferenca)}</span>
                        </div>
                    )}
                </div>

                <button 
                    onClick={handleConfirmar} 
                    className="w-full bg-rose-600 text-white p-5 rounded-2xl font-black text-xl shadow-lg hover:bg-rose-700 transition-all active:scale-[0.98]"
                >
                    🔒 ENCERRAR TURNO
                </button>
            </div>
        </div>
    );
};

export default ModalFechamentoCaixa;
