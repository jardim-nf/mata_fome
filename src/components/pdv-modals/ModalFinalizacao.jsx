// src/components/pdv-modals/ModalFinalizacao.jsx
import React, { useState, useEffect, useRef } from 'react';
import { formatarMoeda } from './pdvHelpers';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';

export const ModalFinalizacao = ({ 
    visivel, venda, onClose, onFinalizar, salvando, 
    pagamentos, setPagamentos, cpfNota, setCpfNota, 
    desconto, setDesconto, acrescimo, setAcrescimo,
    clienteSelecionado, setClienteSelecionado, onAbrirModalCliente,
    estabelecimentoId
}) => {
    const [valorInput, setValorInput] = useState('');
    const [dadosCrediario, setDadosCrediario] = useState({ limite: 0, saldo: 0 });
    const [loadingCrediario, setLoadingCrediario] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (visivel && clienteSelecionado?.id && estabelecimentoId) {
            setLoadingCrediario(true);
            const cRef = doc(db, 'estabelecimentos', estabelecimentoId, 'clientes', clienteSelecionado.id);
            getDoc(cRef).then(snap => {
                if (snap.exists()) {
                    const data = snap.data();
                    setDadosCrediario({
                        limite: Number(data.limiteCrediario || 0),
                        saldo: Number(data.saldoDevedor || 0)
                    });
                } else {
                    setDadosCrediario({ limite: 0, saldo: 0 });
                }
                setLoadingCrediario(false);
            }).catch(err => {
                console.error("Erro ao carregar limite do crediário:", err);
                setDadosCrediario({ limite: 0, saldo: 0 });
                setLoadingCrediario(false);
            });
        } else {
            setDadosCrediario({ limite: 0, saldo: 0 });
        }
    }, [visivel, clienteSelecionado, estabelecimentoId]);

    const vendaTotal = venda ? venda.total : 0;
    const descNum = parseFloat(desconto || 0);
    const acrNum = parseFloat(acrescimo || 0);
    const totalFinal = Math.max(0, vendaTotal + acrNum - descNum);

    const listaPagamentos = pagamentos || [];
    const totalPago = listaPagamentos.reduce((acc, p) => acc + p.valor, 0);
    const restante = Math.max(0, totalFinal - totalPago);
    const troco = Math.max(0, totalPago - totalFinal);

    // Sync valorInput with remaining balance when modal is visible and remaining balance changes
    useEffect(() => {
        if (visivel) {
            setValorInput(restante > 0 ? restante.toFixed(2) : '');
            // Refocus and select when remainder changes
            const timer = setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                    inputRef.current.select();
                }
            }, 100);
            return () => clearTimeout(timer);
        } else {
            setValorInput('');
        }
    }, [restante, visivel]);

    // Reset pagamentos when modal becomes visible
    useEffect(() => {
        if (visivel) {
            setPagamentos([]);
        }
    }, [visivel]);

    const handleAdicionarMetodo = (forma) => {
        const cleanVal = (valorInput || '').toString().replace(',', '.').trim();
        let v = parseFloat(cleanVal);
        if (isNaN(v) || v <= 0) {
            v = restante; // Default to remaining balance if empty/invalid
        }
        if (v <= 0) return;

        // Cap values for card/pix/crediario to the remaining amount. Cash can exceed (troco).
        const valorAAdicionar = (forma === 'dinheiro') ? v : Math.min(v, restante);
        if (valorAAdicionar <= 0) return;

        let novosPagamentos;
        const existeIdx = pagamentos.findIndex(p => p.forma === forma);
        if (existeIdx > -1) {
            novosPagamentos = [...pagamentos];
            novosPagamentos[existeIdx].valor += valorAAdicionar;
        } else {
            novosPagamentos = [...pagamentos, { forma, valor: valorAAdicionar }];
        }
        setPagamentos(novosPagamentos);

        // Keep input focused and selected
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                inputRef.current.select();
            }
        }, 50);
    };

    const handleRemover = (idx) => {
        const novosPagamentos = pagamentos.filter((_, i) => i !== idx);
        setPagamentos(novosPagamentos);
        
        // Keep input focused and selected
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                inputRef.current.select();
            }
        }, 50);
    };

    const valorCrediario = pagamentos
        ? pagamentos.filter(p => p.forma === 'crediario').reduce((acc, p) => acc + p.valor, 0)
        : 0;
    const temCrediario = pagamentos.some(p => p.forma === 'crediario');
    const crediarioSemCliente = temCrediario && !clienteSelecionado;
    const limiteDisponivel = dadosCrediario.limite - dadosCrediario.saldo;
    const semLimiteLiberado = temCrediario && clienteSelecionado && dadosCrediario.limite <= 0;
    const excedeLimite = temCrediario && clienteSelecionado && dadosCrediario.limite > 0 && (dadosCrediario.saldo + valorCrediario) > dadosCrediario.limite;

    const podeFinalizar = restante === 0 && !crediarioSemCliente && !semLimiteLiberado && !excedeLimite;


    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!visivel) return;
            if (e.key === 'Enter') {
                e.preventDefault();
                if (restante > 0) {
                    // Default to Dinheiro (Cash) when Enter is pressed and there is amount left to pay
                    handleAdicionarMetodo('dinheiro');
                } else if (restante === 0 && podeFinalizar) {
                    if (!salvando) {
                        onFinalizar();
                    }
                }
            } else if (e.key === 'F2') {
                e.preventDefault();
                handleAdicionarMetodo('dinheiro');
            } else if (e.key === 'F3') {
                e.preventDefault();
                handleAdicionarMetodo('cartao');
            } else if (e.key === 'F4') {
                e.preventDefault();
                handleAdicionarMetodo('pix');
            } else if (e.key === 'F5') {
                e.preventDefault();
                handleAdicionarMetodo('crediario');
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [visivel, restante, valorInput, pagamentos, salvando, onFinalizar, podeFinalizar, onClose]);

    if (!visivel || !venda) return null;

    return (
        <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-[9000] p-4 backdrop-blur-sm no-print">
            <div className="bg-white p-6 sm:p-8 rounded-[2rem] w-full max-w-md shadow-2xl animate-slideUp flex flex-col max-h-[90vh]">
                <div className="overflow-y-auto custom-scrollbar flex-1 pr-2">
                    <h2 className="text-5xl font-black text-center mb-2 text-gray-800 tracking-tighter">{formatarMoeda(totalFinal)}</h2>
                    <div className="flex justify-center gap-3 mb-4 text-xs font-bold text-gray-400 select-none">
                        <span>Sub: {formatarMoeda(venda.total)}</span>
                        {descNum > 0 && <span className="text-red-500">- Desc: {formatarMoeda(descNum)}</span>}
                        {acrNum > 0 && <span className="text-blue-500">+ Taxa: {formatarMoeda(acrNum)}</span>}
                    </div>

                    <div className="flex gap-3 mb-4 select-none">
                        <div className="flex-1 bg-gray-50 p-2 rounded-xl border border-gray-100 focus-within:border-emerald-500 transition-colors">
                            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Desconto (R$)</label>
                            <input type="number" step="0.01" min="0" className="w-full bg-transparent text-lg font-bold text-gray-800 outline-none placeholder-gray-300" placeholder="0,00" value={desconto} onChange={e => setDesconto(e.target.value)} />
                        </div>
                        <div className="flex-1 bg-gray-50 p-2 rounded-xl border border-gray-100 focus-within:border-blue-500 transition-colors">
                            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Taxa/Extra (R$)</label>
                            <input type="number" step="0.01" min="0" className="w-full bg-transparent text-lg font-bold text-gray-800 outline-none placeholder-gray-300" placeholder="0,00" value={acrescimo} onChange={e => setAcrescimo(e.target.value)} />
                        </div>
                    </div>

                    {/* Campo de Entrada de Valor (Sempre Pré-preenchido com o Restante) */}
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 focus-within:border-emerald-500 focus-within:bg-white transition-all mb-4">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Valor a lançar</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold text-lg">R$</span>
                            <input 
                                ref={inputRef}
                                type="text"
                                inputMode="decimal"
                                className="w-full bg-transparent border-0 pl-9 pr-3 py-1 text-2xl font-black text-slate-800 outline-none placeholder-slate-300 text-right"
                                value={valorInput}
                                onChange={e => {
                                    const val = e.target.value.replace(/[^0-9.,]/g, '');
                                    setValorInput(val);
                                }}
                                onFocus={(e) => e.target.select()}
                                onClick={(e) => e.target.select()}
                                placeholder="0,00"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Botões das Formas de Pagamento */}
                    <div className="grid grid-cols-4 gap-2 mb-5 select-none">
                        {['dinheiro', 'cartao', 'pix', 'crediario'].map(f => {
                            const label = f === 'dinheiro' ? 'Dinheiro' : f === 'cartao' ? 'Cartão' : f === 'pix' ? 'PIX' : 'Crediário';
                            const emoji = f === 'dinheiro' ? '💵' : f === 'cartao' ? '💳' : f === 'pix' ? '💠' : '🤝';
                            const shortcut = f === 'dinheiro' ? 'F2' : f === 'cartao' ? 'F3' : f === 'pix' ? 'F4' : 'F5';
                            
                            return (
                                <button 
                                    key={f}
                                    type="button"
                                    onClick={() => handleAdicionarMetodo(f)}
                                    className="py-2.5 px-1 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800 transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-sm"
                                >
                                    <span className="text-xl">{emoji}</span>
                                    <span className="text-[9px] font-black uppercase tracking-wider">{label}</span>
                                    <span className="text-[8px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/50 mt-0.5">{shortcut}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Lista de Pagamentos Lançados */}
                    {pagamentos.length > 0 && (
                        <div className="mb-4 bg-slate-50 rounded-2xl p-4 border border-slate-200 animate-fadeIn select-none">
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-wider">Pagamentos Lançados</p>
                            <div className="space-y-2">
                                {pagamentos.map((p, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-white px-3.5 py-3 rounded-xl border border-slate-200/60 shadow-sm animate-slideUp">
                                        <span className="font-extrabold text-xs uppercase text-slate-700">
                                            {p.forma === 'dinheiro' ? '💵 Dinheiro' : p.forma === 'cartao' ? '💳 Cartão' : p.forma === 'pix' ? '💠 PIX' : '🤝 Crediário'}
                                        </span>
                                        <div className="flex items-center gap-3">
                                            <span className="font-black text-sm text-slate-800">{formatarMoeda(p.valor)}</span>
                                            <button 
                                                type="button"
                                                onClick={() => handleRemover(idx)} 
                                                className="text-red-400 hover:text-red-600 hover:bg-red-50 w-6 h-6 rounded-md flex items-center justify-center font-bold transition-all text-xs"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            {troco > 0 && (
                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200 border-dashed animate-fadeIn">
                                    <span className="font-bold text-xs text-slate-500 uppercase tracking-wider">Troco a Devolver</span>
                                    <span className="font-black text-sm text-emerald-700 bg-emerald-100/60 px-3 py-1 rounded-lg border border-emerald-200">{formatarMoeda(troco)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Resumo/Status do Pagamento */}
                    {restante > 0 && (
                        <div className="mb-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold p-3.5 rounded-xl flex justify-between items-center animate-pulse">
                            <span>Falta Pagar:</span>
                            <span className="text-sm font-black">{formatarMoeda(restante)}</span>
                        </div>
                    )}
                    {restante === 0 && (
                        <div className="mb-4 bg-emerald-50 p-4 rounded-xl text-center border border-emerald-100/60 select-none">
                            <p className="font-black text-emerald-700 text-sm">✅ Valor Completo!</p>
                        </div>
                    )}

                    {temCrediario && !clienteSelecionado && (
                        <div className="my-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold p-3.5 rounded-xl flex items-center gap-2 animate-fadeIn">
                            <span>⚠️</span><span>Selecione um cliente para finalizar no Crediário.</span>
                        </div>
                    )}

                    {temCrediario && clienteSelecionado && loadingCrediario && (
                        <div className="my-4 bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold p-3.5 rounded-xl flex items-center justify-center gap-2 animate-fadeIn">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-200 border-t-emerald-600"></div>
                            <span>Consultando limites do cliente...</span>
                        </div>
                    )}

                    {temCrediario && clienteSelecionado && !loadingCrediario && (
                        <div className="my-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 animate-fadeIn">
                            <p className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Status do Crediário ({clienteSelecionado.nome})</p>
                            <div className="grid grid-cols-3 gap-2 text-center select-none">
                                <div className="bg-white p-2 rounded-xl border border-slate-100">
                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Limite Total</span>
                                    <span className="text-xs font-black text-slate-800">{formatarMoeda(dadosCrediario.limite)}</span>
                                </div>
                                <div className="bg-white p-2 rounded-xl border border-slate-100">
                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Saldo Devedor</span>
                                    <span className="text-xs font-black text-red-500">{formatarMoeda(dadosCrediario.saldo)}</span>
                                </div>
                                <div className={`p-2 rounded-xl border ${limiteDisponivel - valorCrediario >= 0 ? 'bg-emerald-50/50 border-emerald-100 text-emerald-700' : 'bg-red-50/50 border-red-100 text-red-700'}`}>
                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Disponível</span>
                                    <span className="text-xs font-black">{formatarMoeda(Math.max(0, limiteDisponivel - valorCrediario))}</span>
                                </div>
                            </div>

                            {semLimiteLiberado && (
                                <p className="text-red-500 font-bold text-xs text-center bg-red-50 p-2 rounded-xl border border-red-100 mt-2 select-none">
                                    ⚠️ O cliente não possui limite de crediário liberado.
                                </p>
                            )}

                            {excedeLimite && !semLimiteLiberado && (
                                <p className="text-red-500 font-bold text-xs text-center bg-red-50 p-2 rounded-xl border border-red-100 mt-2 select-none">
                                    🚨 O valor de {formatarMoeda(valorCrediario)} excede o limite disponível!
                                </p>
                            )}
                        </div>
                    )}

                    {/* Cliente Selector Widget inside modal */}
                    <div className="my-4 bg-gray-50 p-3.5 rounded-xl border border-gray-200 flex justify-between items-center gap-2 select-none no-print">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider shrink-0">Cliente:</span>
                            {clienteSelecionado ? (
                                <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg border border-blue-100 text-xs font-bold truncate">
                                    <span className="truncate max-w-[120px]">{clienteSelecionado.nome}</span>
                                    <button type="button" onClick={() => setClienteSelecionado(null)} className="hover:text-red-500 font-bold ml-1 text-[10px]">✕</button>
                                </div>
                            ) : (
                                <span className="text-xs font-bold text-gray-500">Balcão</span>
                            )}
                        </div>
                        <button 
                            type="button"
                            onClick={onAbrirModalCliente} 
                            className="bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                        >
                            {clienteSelecionado ? 'ALTERAR' : '+ CLIENTE'}
                        </button>
                    </div>

                    <input type="text" className="w-full p-4 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl mb-2 outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder-gray-400 font-medium no-print" placeholder="CPF na Nota (Opcional)" value={cpfNota} onChange={e => setCpfNota(e.target.value)} />
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-100 mt-2 shrink-0">
                    <button onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 p-4 rounded-xl font-bold text-gray-500 transition-all">Voltar</button>
                    <button onClick={onFinalizar} disabled={salvando || !podeFinalizar} className="flex-[2] bg-emerald-600 text-white p-4 rounded-xl font-black text-lg hover:bg-emerald-700 transition-all shadow-lg disabled:opacity-50 disabled:bg-gray-300 disabled:shadow-none">FINALIZAR (Enter)</button>
                </div>
            </div>
        </div>
    );
};
export default ModalFinalizacao;
