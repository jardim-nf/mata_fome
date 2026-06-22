import React, { useMemo } from 'react';
import {
    IoClose, IoCash, IoCard, IoPhonePortrait, IoPrint, 
    IoReceiptOutline, IoWallet, IoTrash
} from 'react-icons/io5';
import { useModalPagamentoData } from '../hooks/useModalPagamentoData';
import { useAuth } from '../context/AuthContext';
import { getTerminology } from '../utils/terminologyUtils';
import useBmadData from '../hooks/useBmadData';

const ModalPagamento = ({ mesa, estabelecimentoId, tipoNegocio, onClose, onSucesso }) => {
    const {
        carregando,
        emitirNota, setEmitirNota,
        cpfNota, setCpfNota,
        incluirTaxa, setIncluirTaxa,
        tipoDesconto, setTipoDesconto,
        valorDescontoInput, setValorDescontoInput,

        totalConsumo,
        valorTaxa,
        valorDesconto,
        jaPago,
        restanteMesa,
        totalPagoAgora,
        restanteFinal,
        vaiQuitar,
        troco,

        pagamentosLancados,
        valorALancar, setValorALancar,
        adicionarPagamento,
        removerPagamento,
        handleImprimirConferencia,
        handleFinalizar,
        
        // Agrupamentos
        agruparItensPorPessoa
    } = useModalPagamentoData(mesa, estabelecimentoId, tipoNegocio, onClose, onSucesso);

    const { userData } = useAuth();
    const rawRole = String(userData?.role || userData?.cargo || 'admin').toLowerCase().trim();
    const isGarcom = rawRole.includes('garcom') || rawRole.includes('garçom') || rawRole.includes('atendente');

    const {
        isBmadAvailable,
        initiatePayment,
        loading: bmadLoading,
        paymentError: bmadError
    } = useBmadData();

    const isCpfValid = useMemo(() => {
        if (cpfNota.length !== 11) return false;
        if (/^(\d)\1{10}$/.test(cpfNota)) return false;
        let s = 0; for (let i = 0; i < 9; i++) s += parseInt(cpfNota[i]) * (10 - i);
        let r = (s * 10) % 11; if (r >= 10) r = 0;
        if (r !== parseInt(cpfNota[9])) return false;
        s = 0; for (let i = 0; i < 10; i++) s += parseInt(cpfNota[i]) * (11 - i);
        r = (s * 10) % 11; if (r >= 10) r = 0;
        if (r !== parseInt(cpfNota[10])) return false;
        return true;
    }, [cpfNota]);

    const formatarReal = (valor) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
    };

    const handleBmadPayment = async () => {
        try {
            await initiatePayment(parseFloat(valorALancar), 'bmad');
            onSucesso();
        } catch (error) {
            console.error('Erro ao processar pagamento via BMAD:', error);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-start sm:pt-16 justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

            {/* Modal Body */}
            <div className="relative w-full max-w-md md:max-w-4xl bg-[#F8FAFC] sm:rounded-3xl rounded-t-3xl shadow-2xl max-h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 duration-300">
                {/* Header */}
                <div className="p-4 bg-white flex justify-between items-center border-b border-gray-100 shrink-0">
                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">
                        Pagamento - {getTerminology('mesa', tipoNegocio)} {mesa?.numero}
                    </span>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                        <IoClose size={24} />
                    </button>
                </div>

                {/* Content Container (Unified Single Screen / Two Columns on Desktop) */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                        
                        {/* LEFT COLUMN: Summary & Settings */}
                        <div className="space-y-3">
                            {/* 1. Summary Card */}
                            <div className="bg-[#3b82f6] rounded-2xl p-4 shadow-md shadow-blue-100 text-center relative overflow-hidden">
                                <div className="relative z-10">
                                    <h2 className="text-xs font-bold text-blue-100 flex items-center justify-center gap-1">
                                        <IoWallet className="text-base" /> Restante a Pagar
                                    </h2>
                                    <span className="text-2xl font-black text-white block mt-0.5">
                                        {formatarReal(restanteFinal)}
                                    </span>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5 pt-2 border-t border-white/20 text-center text-[10px] text-blue-100 font-bold">
                                        <div>
                                            <span className="opacity-75 block text-[7.5px] uppercase tracking-wider">Consumo</span>
                                            <span className="text-white font-extrabold text-xs block">{formatarReal(totalConsumo)}</span>
                                        </div>
                                        <div>
                                            <span className="opacity-75 block text-[7.5px] uppercase tracking-wider">Total Geral</span>
                                            <span className="text-white font-extrabold text-xs block">{formatarReal(totalConsumo + valorTaxa - valorDesconto)}</span>
                                        </div>
                                        <div>
                                            <span className="opacity-75 block text-[7.5px] uppercase tracking-wider">Já Pago</span>
                                            <span className="text-white font-extrabold text-xs block">{formatarReal(jaPago)}</span>
                                        </div>
                                        <div>
                                            <span className="opacity-75 block text-[7.5px] uppercase tracking-wider">Restante</span>
                                            <span className="text-white font-extrabold text-xs block">{formatarReal(restanteMesa)}</span>
                                        </div>
                                    </div>

                                    {incluirTaxa && (
                                        <p className="text-white text-[9px] font-bold mt-2 bg-white/20 inline-block px-2 py-0.5 rounded-full">
                                            + 10% {getTerminology('garcom', tipoNegocio)}: {formatarReal(valorTaxa)}
                                        </p>
                                    )}

                                    {valorDesconto > 0 && (
                                        <p className="text-white text-[9px] font-bold mt-2 bg-white/20 inline-block px-2 py-0.5 rounded-full ml-1">
                                            - Desconto: {formatarReal(valorDesconto)}
                                        </p>
                                    )}

                                    {jaPago > 0 && (
                                        <p className="text-white text-[9px] font-bold mt-2 bg-green-600 inline-block px-2 py-0.5 rounded-full ml-1">
                                            Já Pago: {formatarReal(jaPago)}
                                        </p>
                                    )}
                                    
                                    <button onClick={handleImprimirConferencia} className="mt-2.5 w-full py-1 bg-white/20 text-white hover:bg-white/30 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all">
                                        <IoPrint className="text-sm" /> Imprimir Conferência
                                    </button>
                                </div>
                            </div>

                            {/* Occupant Consumption List */}
                            {Object.keys(agruparItensPorPessoa).length > 0 && (
                                <div className="bg-white border border-gray-200 rounded-2xl p-3 space-y-2">
                                    <h3 className="font-extrabold text-xs text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                                        👥 Consumo por Cliente
                                    </h3>
                                    <div className="space-y-1.5 max-h-[110px] overflow-y-auto pr-1">
                                        {Object.entries(agruparItensPorPessoa).map(([pessoa, dados]) => {
                                            const taxaPessoa = incluirTaxa ? (dados.total * 0.10) : 0;
                                            const descontoPessoa = valorDesconto > 0 ? (valorDesconto * (dados.total / totalConsumo)) : 0;
                                            const totalPessoa = Math.max(0, dados.total + taxaPessoa - descontoPessoa);

                                            return (
                                                <div key={pessoa} className="bg-white border border-slate-200 border-l-4 border-l-blue-500 rounded-xl p-2 flex flex-col gap-0.5 shadow-sm transition-all">
                                                    <div className="flex justify-between items-center">
                                                        <div className="min-w-0 flex-1 pr-2">
                                                            <h4 className="font-bold text-[11px] text-slate-800 uppercase truncate">{pessoa}</h4>
                                                            <div className="text-[9px] text-slate-400 font-bold truncate">
                                                                {dados.itens.map((item, idx) => (
                                                                    <span key={idx} className="after:content-[',_'] last:after:content-none">
                                                                        {item.quantidade || item.qtd || 1}x {item.nome}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span className="font-black text-[11px] text-slate-900">{formatarReal(totalPessoa)}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setValorALancar(totalPessoa.toFixed(2))}
                                                                className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-md text-[9px] font-black uppercase tracking-wider transition-colors active:scale-95"
                                                            >
                                                                Cobrar
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* 2. Service Tax & Discount Configuration */}
                            {!isGarcom && (
                                <div className="grid grid-cols-2 gap-2">
                                    <div className={`border rounded-xl p-2 flex flex-col justify-between transition-all ${
                                        incluirTaxa 
                                            ? 'bg-blue-50/60 border-blue-200 shadow-sm shadow-blue-50/50' 
                                            : 'bg-white border-gray-200'
                                    }`}>
                                        <div>
                                            <h4 className="font-bold text-[11px] text-gray-900 leading-tight">Taxa (10%)</h4>
                                            <p className="text-[9px] text-gray-400 leading-tight">Taxa de serviço</p>
                                        </div>
                                        <div className="mt-1.5 flex items-center justify-between">
                                            <span className="text-xs font-black text-blue-600">{formatarReal(valorTaxa)}</span>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    className="sr-only peer" 
                                                    checked={incluirTaxa}
                                                    onChange={(e) => setIncluirTaxa(e.target.checked)}
                                                />
                                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>
                                    </div>

                                    <div className={`border rounded-xl p-2 flex flex-col justify-between transition-all ${
                                        valorDesconto > 0 
                                            ? 'bg-amber-50/60 border-amber-200 shadow-sm shadow-amber-50/50' 
                                            : 'bg-white border-gray-200'
                                    }`}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-bold text-[11px] text-gray-900 leading-tight">Desconto</h4>
                                                <p className="text-[9px] text-gray-400 leading-tight">Aplicar desconto</p>
                                            </div>
                                            <div className="flex bg-gray-100 p-0.5 rounded-md text-[8px] font-bold">
                                                <button type="button" onClick={() => setTipoDesconto('reais')} className={`px-1.5 py-0.5 rounded ${tipoDesconto === 'reais' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}>R$</button>
                                                <button type="button" onClick={() => setTipoDesconto('porcentagem')} className={`px-1.5 py-0.5 rounded ${tipoDesconto === 'porcentagem' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}>%</button>
                                            </div>
                                        </div>
                                        <div className="relative mt-1.5">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] font-extrabold">{tipoDesconto === 'reais' ? 'R$' : '%'}</span>
                                            <input 
                                                type="number" 
                                                value={valorDescontoInput} 
                                                onChange={(e) => setValorDescontoInput(e.target.value)} 
                                                placeholder="0.00" 
                                                className="w-full bg-gray-50/50 border border-gray-200 rounded-lg pl-6 pr-2 py-0.5 text-[11px] font-bold text-gray-800 outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all" 
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 5. Fiscal Configuration */}
                            {!isGarcom && (
                                <div className={`border rounded-2xl p-2.5 space-y-2 transition-all ${
                                    emitirNota 
                                        ? 'bg-emerald-50/60 border-emerald-200 shadow-sm shadow-emerald-50/50' 
                                        : 'bg-white border-gray-200'
                                }`}>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={emitirNota}
                                            onChange={(e) => setEmitirNota(e.target.checked)}
                                            className="w-3.5 h-3.5 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                                        />
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                                            <IoReceiptOutline className="text-emerald-600 text-sm" />
                                            Emitir Nota Fiscal (NFC-e)
                                        </div>
                                    </label>

                                    {emitirNota && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                            <input
                                                type="text"
                                                placeholder="CPF na Nota (Opcional)"
                                                value={cpfNota}
                                                onChange={(e) => setCpfNota(e.target.value.replace(/\D/g, ''))}
                                                className={`w-full px-2 py-1 bg-gray-50 border rounded-xl text-xs font-bold focus:ring-1 outline-none ${
                                                    cpfNota.length === 0 ? 'border-gray-200 focus:ring-emerald-500' :
                                                    cpfNota.length < 11 ? 'border-red-300 focus:ring-red-200' :
                                                    isCpfValid ? 'border-emerald-400 focus:ring-emerald-200' :
                                                    'border-red-300 focus:ring-red-200'
                                                }`}
                                                maxLength={11}
                                            />
                                            {cpfNota.length > 0 && cpfNota.length < 11 && (
                                                <p className="text-[9px] text-orange-500 mt-0.5 font-bold">CPF deve conter 11 dígitos</p>
                                            )}
                                            {cpfNota.length === 11 && /^(\d)\1{10}$/.test(cpfNota) && (
                                                <p className="text-[9px] text-red-500 mt-0.5 font-bold">CPF inválido</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* RIGHT COLUMN: Payments & List */}
                        <div className="space-y-3">
                            {/* 3. Payment Launcher */}
                            {!isGarcom ? (
                                <div className="bg-white border border-gray-200 rounded-2xl p-3 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-extrabold text-xs text-gray-900 uppercase tracking-wider">Lançar Pagamento</h3>
                                        {restanteFinal > 0 && (
                                            <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-bold">Pendente: {formatarReal(restanteFinal)}</span>
                                        )}
                                    </div>

                                    {/* Valor Input */}
                                    <div className="relative bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 focus-within:border-blue-500 focus-within:bg-white transition-all">
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold text-xs">R$</span>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            className="w-full bg-transparent pl-5 text-base font-black text-slate-800 outline-none text-right placeholder-slate-300"
                                            placeholder="0,00"
                                            value={valorALancar}
                                            onChange={(e) => setValorALancar(e.target.value.replace(/[^0-9.,]/g, ''))}
                                            onClick={(e) => e.target.select()}
                                        />
                                    </div>

                                    {/* Payment Grid */}
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {[
                                            { 
                                                id: 'dinheiro', 
                                                icon: <IoCash />, 
                                                label: 'Dinheiro', 
                                                btnStyle: 'bg-emerald-50/60 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100 hover:border-emerald-300',
                                                iconStyle: 'text-emerald-600'
                                            },
                                            { 
                                                id: 'credito', 
                                                icon: <IoCard />, 
                                                label: 'Crédito', 
                                                btnStyle: 'bg-blue-50/60 text-blue-800 border-blue-200/80 hover:bg-blue-100 hover:border-blue-300',
                                                iconStyle: 'text-blue-600'
                                            },
                                            { 
                                                id: 'debito', 
                                                icon: <IoCard />, 
                                                label: 'Débito', 
                                                btnStyle: 'bg-indigo-50/60 text-indigo-800 border-indigo-200/80 hover:bg-indigo-100 hover:border-indigo-300',
                                                iconStyle: 'text-indigo-600'
                                            },
                                            { 
                                                id: 'pix', 
                                                icon: <IoPhonePortrait />, 
                                                label: 'PIX', 
                                                btnStyle: 'bg-teal-50/60 text-teal-800 border-teal-200/80 hover:bg-teal-100 hover:border-teal-300',
                                                iconStyle: 'text-teal-600'
                                            }
                                        ].map(m => (
                                            <button 
                                                key={m.id}
                                                type="button"
                                                onClick={() => m.id === 'bmad' ? handleBmadPayment() : adicionarPagamento(m.id)}
                                                className={`py-1.5 px-0.5 active:scale-95 rounded-xl border transition-all flex flex-col items-center justify-center gap-0.5 shrink-0 ${m.btnStyle}`}
                                            >
                                                <span className={`text-lg ${m.iconStyle}`}>{m.icon}</span>
                                                <span className="text-[7.5px] font-black uppercase tracking-wider">{m.label}</span>
                                            </button>
                                        ))}
                                        {isBmadAvailable && (
                                            <button
                                                type="button"
                                                onClick={handleBmadPayment}
                                                className="py-1.5 px-0.5 active:scale-95 rounded-xl border bg-purple-50/60 text-purple-800 border-purple-200/80 hover:bg-purple-100 hover:border-purple-300 transition-all flex flex-col items-center justify-center gap-0.5 shrink-0"
                                            >
                                                <span className="text-lg text-purple-600">BMAD</span>
                                                <span className="text-[7.5px] font-black uppercase tracking-wider">BMAD</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-orange-50 text-orange-700 p-3 rounded-xl text-xs font-bold border border-orange-200 text-center">
                                    Apenas o Caixa ou Gerente pode registrar pagamentos e fechar a conta.
                                </div>
                            )}

                            {/* 4. Launched Payments List */}
                            {pagamentosLancados.length > 0 && (
                                <div className="bg-white border border-gray-200 rounded-2xl p-3 space-y-1.5">
                                    <h4 className="font-extrabold text-[9px] text-gray-400 uppercase tracking-wider mb-1">Valores Recebidos</h4>
                                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                                        {pagamentosLancados.map((p, idx) => {
                                            let rowStyle = 'bg-slate-50 border-slate-200/60 text-slate-700';
                                            let label = 'Dinheiro';
                                            if (p.forma === 'dinheiro') {
                                                rowStyle = 'bg-emerald-50/50 border-emerald-100 text-emerald-800';
                                                label = '💵 Dinheiro';
                                            } else if (p.forma === 'credito') {
                                                rowStyle = 'bg-blue-50/50 border-blue-100 text-blue-800';
                                                label = '💳 Crédito';
                                            } else if (p.forma === 'debito') {
                                                rowStyle = 'bg-indigo-50/50 border-indigo-100 text-indigo-800';
                                                label = '💳 Débito';
                                            } else if (p.forma === 'pix') {
                                                rowStyle = 'bg-teal-50/50 border-teal-100 text-teal-800';
                                                label = '💠 PIX';
                                            } else if (p.forma === 'bmad') {
                                                rowStyle = 'bg-purple-50/50 border-purple-100 text-purple-800';
                                                label = '🟣 BMAD';
                                            }
                                            return (
                                                <div key={idx} className={`flex justify-between items-center px-2 py-1 rounded-xl border shadow-sm animate-in fade-in slide-in-from-top-1 duration-200 ${rowStyle}`}>
                                                    <span className="font-bold text-[10px] uppercase flex items-center gap-1">
                                                        {label}
                                                    </span>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-black text-[10px]">{formatarReal(p.valor)}</span>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => removerPagamento(idx)} 
                                                            className="text-red-400 hover:text-red-600 hover:bg-red-50 p-0.5 rounded-md transition-colors"
                                                            title="Excluir lançamento"
                                                        >
                                                            <IoTrash size={11} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    
                                    {troco > 0 && (
                                        <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-slate-100 border-dashed">
                                            <span className="font-bold text-[9px] text-slate-500 uppercase tracking-wider">Troco a devolver:</span>
                                            <span className="font-black text-[11px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">{formatarReal(troco)}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>
                </div>

                {/* 6. Bottom Actions Bar */}
                <div className="p-4 bg-white border-t border-gray-100 flex gap-3 shrink-0">
                    <button 
                        onClick={onClose} 
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold py-3 rounded-xl text-sm transition-all"
                    >
                        Fechar
                    </button>
                    {!isGarcom && (
                        <button 
                            disabled={carregando || bmadLoading || (restanteMesa > 0 && totalPagoAgora <= 0)}
                            onClick={() => handleFinalizar(vaiQuitar ? 'total' : 'parcial')} 
                            className={`flex-[2] text-white py-3 rounded-xl font-black text-sm shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:bg-gray-300 disabled:shadow-none ${
                                vaiQuitar 
                                    ? 'bg-emerald-600 hover:bg-emerald-700' 
                                    : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                            {carregando || bmadLoading ? 'Processando...' : (
                                vaiQuitar 
                                    ? (troco > 0 ? 'Encerrar com Troco' : 'Encerrar e Fechar Conta')
                                    : `Receber ${formatarReal(totalPagoAgora)} e Manter Aberta`
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ModalPagamento;