import React from 'react';
import {
    IoClose, IoChevronBack, IoChevronForward, IoCash, IoCard,
    IoPhonePortrait, IoAdd, IoRemove, IoCheckmark, IoPerson,
    IoPeople, IoWallet, IoPrint, IoCheckbox, IoSquareOutline,
    IoTime, IoReceiptOutline
} from 'react-icons/io5';
import { useModalPagamentoData } from '../hooks/useModalPagamentoData';

const ModalPagamento = ({ mesa, estabelecimentoId, onClose, onSucesso }) => {
    const {
        etapa, setEtapa,
        tipoPagamento, setTipoPagamento,
        pagamentos, selecionados, carregando,
        emitirNota, setEmitirNota,
        cpfNota, setCpfNota,
        incluirTaxa, setIncluirTaxa,
        tipoDesconto, setTipoDesconto,
        valorDescontoInput, setValorDescontoInput,
        
        totalConsumo, valorTaxa, valorDesconto, jaPago,
        restanteMesa, totalPagoAgora, restanteFinal, vaiQuitar, troco,
        
        agruparItensPorPessoa,
        
        toggleSelecao, editarFormaPagamento, editarValorPagamento,
        adicionarPessoa, removerPessoa,
        handleImprimirConferencia, handleFinalizar
    } = useModalPagamentoData(mesa, estabelecimentoId, onClose, onSucesso);

    // --- UI RENDERIZADORES ---
    const renderHistoricoPagamentos = () => {
        if (jaPago <= 0) return null;

        return (
            <div className="bg-gray-100 p-4 rounded-2xl mb-4 border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <IoTime /> <span className="text-xs font-bold uppercase">Histórico de Pagamentos</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Já abatido da conta:</span>
                    <span className="text-lg font-bold text-green-600">- R$ {jaPago.toFixed(2)}</span>
                </div>
                <div className="mt-1 text-xs text-gray-400 text-right">
                    (Este valor já está descontado do total a pagar)
                </div>
            </div>
        );
    };

    const renderizarEtapa1 = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-[#3b82f6] rounded-3xl p-6 shadow-xl shadow-blue-200 text-center relative overflow-hidden">
                 <div className="relative z-10">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <IoWallet className="text-3xl text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-blue-100 mb-1">Restante a Pagar</h2>
                    
                    <span className="text-5xl font-black text-white">
                        {restanteMesa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    
                    <p className="text-blue-200 text-sm font-bold mt-2 uppercase tracking-widest">
                        Total Consumo: {totalConsumo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>

                    {incluirTaxa && (
                        <p className="text-white text-sm font-medium mt-1 bg-white/20 inline-block px-3 py-1 rounded-full">
                            + 10% Garçom: {valorTaxa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    )}

                    {valorDesconto > 0 && (
                        <p className="text-white text-sm font-medium mt-1 bg-white/20 inline-block px-3 py-1 rounded-full ml-1">
                            - Desconto: {valorDesconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    )}
                    
                    <button onClick={handleImprimirConferencia} className="mt-4 w-full py-2 bg-white/20 text-white hover:bg-white/30 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all">
                        <IoPrint className="text-lg" /> Imprimir Conferência
                    </button>
                </div>
            </div>

            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                    <h4 className="font-bold text-gray-900">Taxa de Serviço (10%)</h4>
                    <p className="text-xs text-gray-500">Adicionar 10% na conta</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                        type="checkbox" 
                        value="" 
                        className="sr-only peer" 
                        checked={incluirTaxa}
                        onChange={(e) => setIncluirTaxa(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="font-bold text-gray-900">Desconto</h4>
                        <p className="text-xs text-gray-500">Aplicar desconto no total</p>
                    </div>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button onClick={() => setTipoDesconto('reais')} className={`px-3 py-1 text-xs font-bold rounded-md ${tipoDesconto === 'reais' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>R$</button>
                        <button onClick={() => setTipoDesconto('porcentagem')} className={`px-3 py-1 text-xs font-bold rounded-md ${tipoDesconto === 'porcentagem' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>%</button>
                    </div>
                </div>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{tipoDesconto === 'reais' ? 'R$' : '%'}</span>
                    <input 
                        type="number" 
                        value={valorDescontoInput} 
                        onChange={(e) => setValorDescontoInput(e.target.value)} 
                        placeholder="0.00" 
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                </div>
            </div>

            {renderHistoricoPagamentos()}

            <div className="space-y-3 mt-2">
                <button onClick={() => { setTipoPagamento('unico'); setEtapa(2); }} className="w-full bg-white p-4 rounded-2xl border-2 border-gray-100 hover:border-blue-500 hover:bg-blue-50/30 flex items-center gap-4 text-left transition-all">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600"><IoPerson size={24} /></div>
                    <div className="flex-1"><h4 className="font-bold text-gray-900">Quitar Restante</h4><p className="text-xs text-gray-500">Pagar todo o valor pendente</p></div>
                    <IoChevronForward className="text-gray-300" />
                </button>
                <button onClick={() => { setTipoPagamento('individual'); setEtapa(2); }} className="w-full bg-white p-4 rounded-2xl border-2 border-gray-100 hover:border-green-500 hover:bg-green-50/30 flex items-center gap-4 text-left transition-all">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600"><IoPeople size={24} /></div>
                    <div className="flex-1"><h4 className="font-bold text-gray-900">Pagamento Parcial / Dividir</h4><p className="text-xs text-gray-500">Abater valor ou dividir entre pessoas</p></div>
                    <IoChevronForward className="text-gray-300" />
                </button>
            </div>
        </div>
    );

    const renderizarEtapa2 = () => {
        const formasPagamento = [
            { id: 'dinheiro', icon: <IoCash />, label: 'Dinheiro' },
            { id: 'credito', icon: <IoCard />, label: 'Crédito' },
            { id: 'debito', icon: <IoCard />, label: 'Débito' },
            { id: 'pix', icon: <IoPhonePortrait />, label: 'PIX' }
        ];

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
                <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => setEtapa(1)} className="p-2 hover:bg-gray-100 rounded-lg"><IoChevronBack className="text-xl" /></button>
                    <h3 className="text-lg font-black text-gray-900">Quem vai pagar agora?</h3>
                </div>

                {tipoPagamento === 'individual' && (
                    <div className="bg-blue-50 text-blue-800 p-3 rounded-xl text-xs font-bold mb-4 flex gap-2 items-center border border-blue-100">
                        <IoCheckmark className="text-lg" />
                        Selecione quem vai pagar neste momento.
                    </div>
                )}

                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {Object.entries(pagamentos).map(([pessoa, dados]) => (
                        <div key={pessoa} className={`bg-white rounded-2xl p-4 border transition-all ${selecionados[pessoa] ? 'border-blue-500 ring-1 ring-blue-200 shadow-md' : 'border-gray-200 opacity-70 grayscale-[0.5]'}`}>
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => toggleSelecao(pessoa)}>
                                    <div className={`text-2xl transition-transform active:scale-90 ${selecionados[pessoa] ? 'text-blue-600' : 'text-gray-300'}`}>
                                        {selecionados[pessoa] ? <IoCheckbox /> : <IoSquareOutline />}
                                    </div>
                                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center font-bold text-gray-600">{pessoa.charAt(0)}</div>
                                    <div><h4 className="font-bold text-gray-900 text-sm">{pessoa}</h4></div>
                                </div>
                                {tipoPagamento === 'individual' && Object.keys(pagamentos).length > 1 && (
                                    <button onClick={() => removerPessoa(pessoa)} className="text-red-400 hover:text-red-600 p-2"><IoRemove /></button>
                                )}
                            </div>

                            {selecionados[pessoa] && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="relative flex-1">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">R$</span>
                                            <input
                                                type="number"
                                                className="w-full bg-blue-50/50 border border-blue-200 rounded-lg pl-8 pr-3 py-3 text-lg font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="0.00"
                                                value={dados.valor}
                                                onChange={(e) => editarValorPagamento(pessoa, e.target.value)}
                                                onClick={(e) => e.target.select()}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2 mb-2">
                                        {formasPagamento.map(forma => (
                                            <button key={forma.id} onClick={() => editarFormaPagamento(pessoa, forma.id)} className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${dados.formaPagamento === forma.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                                                <div className="text-xl mb-1">{forma.icon}</div><span className="text-[8px] font-bold uppercase">{forma.label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {dados.itens && dados.itens.filter(i => i.preco > 0).length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-gray-100">
                                            <p className="text-[10px] text-gray-400 font-bold mb-1">CONSUMO:</p>
                                            <div className="text-xs text-gray-500 space-y-1 max-h-20 overflow-y-auto">
                                                {dados.itens.filter(i => i.preco > 0).map((item, idx) => (
                                                    <div key={idx} className="flex justify-between">
                                                        <span>{item.quantidade || 1}x {item.nome}</span>
                                                        <span>{((item.preco || 0) * (item.quantidade || 1)).toFixed(2)}</span>
                                                    </div>
                                                ))}
                                                {incluirTaxa && (
                                                    <div className="flex justify-between text-blue-600 font-medium">
                                                        <span>Taxa Serviço (10%) rateada</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {tipoPagamento === 'individual' && (
                    <button onClick={adicionarPessoa} className="mt-4 w-full py-3 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center gap-2 text-gray-500 font-bold hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all">
                        <IoAdd /> Adicionar Pagante Manual
                    </button>
                )}

                <button onClick={() => setEtapa(3)} className="mt-4 w-full py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-xl hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-2">
                    Conferir e Finalizar <IoChevronForward />
                </button>
            </div>
        );
    };

    const renderizarEtapa3 = () => {
        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
                <div className="text-center relative">
                    <button onClick={() => setEtapa(2)} className="absolute top-0 left-0 p-2 bg-gray-100 rounded-xl hover:bg-gray-200"><IoChevronBack /></button>
                    <h3 className="text-xl font-black text-gray-900">Confirmação</h3>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl">
                    <div className="flex justify-between items-center mb-1 text-gray-400 font-medium text-xs">
                        <span>Total Consumo</span>
                        <span>R$ {totalConsumo.toFixed(2)}</span>
                    </div>
                    {incluirTaxa && (
                        <div className="flex justify-between items-center mb-1 text-blue-600 font-bold text-xs">
                            <span>Taxa de Serviço (10%)</span>
                            <span>+ R$ {valorTaxa.toFixed(2)}</span>
                        </div>
                    )}
                    {valorDesconto > 0 && (
                        <div className="flex justify-between items-center mb-1 text-red-500 font-bold text-xs">
                            <span>Desconto Aplicado</span>
                            <span>- R$ {valorDesconto.toFixed(2)}</span>
                        </div>
                    )}
                    {jaPago > 0 && (
                        <div className="flex justify-between items-center mb-3 text-green-600 font-bold text-xs border-b border-gray-100 pb-2">
                            <span>Já Pago (Anterior)</span>
                            <span>- R$ {jaPago.toFixed(2)}</span>
                        </div>
                    )}

                    <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-100 mt-2">
                        <span className="text-lg font-bold text-gray-900">Pagando Agora</span>
                        <span className="text-3xl font-black text-blue-600">R$ {totalPagoAgora.toFixed(2)}</span>
                    </div>

                    <div className={`p-4 rounded-2xl text-center mb-6 ${!vaiQuitar ? 'bg-orange-50 text-orange-700' : (troco > 0 ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600')}`}>
                        <p className="text-xs font-bold uppercase tracking-wider mb-1">Situação da Mesa Após Pagamento</p>
                        <p className="text-xl font-black">
                            {!vaiQuitar && `Faltarão R$ ${restanteFinal.toFixed(2)}`}
                            {vaiQuitar && troco === 0 && `Conta Quitada (Mesa Fecha)`}
                            {vaiQuitar && troco > 0 && `Conta Quitada (Troco: R$ ${troco.toFixed(2)})`}
                        </p>
                    </div>

                    <div className="mt-4 p-4 border-2 border-dashed border-gray-200 rounded-2xl">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={emitirNota}
                                onChange={(e) => setEmitirNota(e.target.checked)}
                                className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                            />
                            <div className="flex items-center gap-2 text-gray-700 font-bold">
                                <IoReceiptOutline className="text-emerald-600 text-lg" />
                                Emitir Nota Fiscal (NFC-e)
                            </div>
                        </label>

                        {emitirNota && (
                            <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                                <input
                                    type="text"
                                    placeholder="CPF na Nota (Opcional)"
                                    value={cpfNota}
                                    onChange={(e) => {
                                        const nums = e.target.value.replace(/\D/g, '');
                                        setCpfNota(nums);
                                    }}
                                    className={`w-full p-3 bg-gray-50 border rounded-xl text-sm focus:ring-2 outline-none ${
                                        cpfNota.length > 0 && cpfNota.length !== 11
                                            ? 'border-red-400 focus:ring-red-300'
                                            : cpfNota.length === 11
                                                ? (() => {
                                                    if (/^(\d)\1{10}$/.test(cpfNota)) return 'border-red-400 focus:ring-red-300';
                                                    let s = 0; for (let i = 0; i < 9; i++) s += parseInt(cpfNota[i]) * (10 - i);
                                                    let r = (s * 10) % 11; if (r >= 10) r = 0;
                                                    if (r !== parseInt(cpfNota[9])) return 'border-red-400 focus:ring-red-300';
                                                    s = 0; for (let i = 0; i < 10; i++) s += parseInt(cpfNota[i]) * (11 - i);
                                                    r = (s * 10) % 11; if (r >= 10) r = 0;
                                                    if (r !== parseInt(cpfNota[10])) return 'border-red-400 focus:ring-red-300';
                                                    return 'border-emerald-400 focus:ring-emerald-300';
                                                  })()
                                                : 'border-gray-300 focus:ring-emerald-500'
                                    }`}
                                    maxLength={11}
                                />
                                {cpfNota.length > 0 && cpfNota.length < 11 && (
                                    <p className="text-xs text-orange-500 mt-1">CPF deve ter 11 dígitos</p>
                                )}
                                {cpfNota.length === 11 && /^(\d)\1{10}$/.test(cpfNota) && (
                                    <p className="text-xs text-red-500 mt-1">CPF inválido</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    {!vaiQuitar && (
                        <button
                            onClick={() => handleFinalizar('parcial')}
                            disabled={carregando}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            {carregando ? 'Processando...' : `Receber R$ ${totalPagoAgora.toFixed(2)} e Manter Aberta`}
                        </button>
                    )}

                    {vaiQuitar && (
                        <button
                            onClick={() => handleFinalizar('total')}
                            disabled={carregando}
                            className="w-full py-4 bg-green-600 hover:bg-green-700 rounded-2xl font-bold shadow-lg shadow-green-200 text-white active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            {carregando ? 'Processando...' : (troco > 0 ? 'Encerrar com Troco' : 'Encerrar Mesa (Tudo Pago)')}
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-start sm:pt-16 justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative w-full max-w-md bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 duration-300">
                <div className="p-4 flex justify-between items-center border-b border-gray-100">
                    <span className="text-xs font-black text-gray-300 uppercase tracking-widest">Pagamento</span>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"><IoClose size={24} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-[#f8faff] custom-scrollbar">
                    {etapa === 1 && renderizarEtapa1()}
                    {etapa === 2 && renderizarEtapa2()}
                    {etapa === 3 && renderizarEtapa3()}
                </div>
            </div>
        </div>
    );
};

export default ModalPagamento;
