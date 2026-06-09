// src/components/pdv-modals/ModalFinalizacao.jsx
import React, { useState, useEffect } from 'react';
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
    const [formaAtual, setFormaAtual] = useState('dinheiro');
    const [valorInput, setValorInput] = useState('');

    const [dadosCrediario, setDadosCrediario] = useState({ limite: 0, saldo: 0 });
    const [loadingCrediario, setLoadingCrediario] = useState(false);

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

    useEffect(() => {
        if (visivel && venda) {
            setFormaAtual('dinheiro');
            const vTotal = venda.total || 0;
            const dNum = parseFloat(desconto || 0);
            const aNum = parseFloat(acrescimo || 0);
            const tFinal = Math.max(0, vTotal + aNum - dNum);
            if (tFinal > 0) {
                setPagamentos([{ forma: 'dinheiro', valor: tFinal }]);
                setValorInput(tFinal.toFixed(2));
            } else {
                setPagamentos([]);
                setValorInput('');
            }
        } else if (!visivel) {
            setPagamentos([]);
            setValorInput('');
        }
    }, [visivel]);

    const vendaTotal = venda ? venda.total : 0;
    const descNum = parseFloat(desconto || 0);
    const acrNum = parseFloat(acrescimo || 0);
    const totalFinal = Math.max(0, vendaTotal + acrNum - descNum);

    const listaPagamentos = pagamentos || [];
    const totalPago = listaPagamentos.reduce((acc, p) => acc + p.valor, 0);
    const restante = Math.max(0, totalFinal - totalPago);
    const troco = Math.max(0, totalPago - totalFinal);

    useEffect(() => {
        if (visivel && pagamentos && pagamentos.length === 1 && pagamentos[0].forma === 'dinheiro') {
            setPagamentos([{ forma: 'dinheiro', valor: totalFinal }]);
            setValorInput(totalFinal.toFixed(2));
        }
    }, [totalFinal, visivel]);

    const handleInputChange = (val) => {
        setValorInput(val);
        const parsed = parseFloat(val || 0);
        if (pagamentos.length === 1 && pagamentos[0].forma === 'dinheiro') {
            setPagamentos([{ forma: 'dinheiro', valor: parsed }]);
        }
    };

    const handleAdicionar = () => {
        const v = parseFloat(valorInput || 0);
        if (v <= 0) return;
        
        let novosPagamentos;
        const existeIdx = pagamentos.findIndex(p => p.forma === formaAtual);
        if (existeIdx > -1) {
            const novos = [...pagamentos];
            novos[existeIdx].valor = v;
            novosPagamentos = novos;
        } else {
            novosPagamentos = [...pagamentos, { forma: formaAtual, valor: v }];
        }
        setPagamentos(novosPagamentos);
        
        const novoTotalPago = novosPagamentos.reduce((acc, p) => acc + p.valor, 0);
        const novoRestante = Math.max(0, totalFinal - novoTotalPago);
        if (novoRestante > 0) {
            setValorInput(novoRestante.toFixed(2));
        } else if (novosPagamentos.length === 1 && novosPagamentos[0].forma === 'dinheiro') {
            setValorInput(novosPagamentos[0].valor.toFixed(2));
        } else {
            setValorInput('');
        }
    };

    const handleRemover = (idx) => {
        const novosPagamentos = pagamentos.filter((_, i) => i !== idx);
        setPagamentos(novosPagamentos);
        
        const novoTotalPago = novosPagamentos.reduce((acc, p) => acc + p.valor, 0);
        const novoRestante = Math.max(0, totalFinal - novoTotalPago);
        if (novoRestante > 0) {
            setValorInput(novoRestante.toFixed(2));
        } else if (novosPagamentos.length === 1 && novosPagamentos[0].forma === 'dinheiro') {
            setValorInput(novosPagamentos[0].valor.toFixed(2));
        } else {
            setValorInput('');
        }
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
                    handleAdicionar();
                } else if (restante === 0 && podeFinalizar) {
                    if (!salvando) {
                        onFinalizar();
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [visivel, restante, valorInput, formaAtual, pagamentos, salvando, onFinalizar, podeFinalizar]);

    if (!visivel || !venda) return null;

    return (
        <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-[9000] p-4 backdrop-blur-sm no-print">
            <div className="bg-white p-6 sm:p-8 rounded-[2rem] w-full max-w-md shadow-2xl animate-slideUp flex flex-col max-h-[90vh]">
                <div className="overflow-y-auto custom-scrollbar flex-1 pr-2">
                    <h2 className="text-5xl font-black text-center mb-2 text-gray-800 tracking-tighter">{formatarMoeda(totalFinal)}</h2>
                    <div className="flex justify-center gap-3 mb-6 text-xs font-bold text-gray-400">
                        <span>Sub: {formatarMoeda(venda.total)}</span>
                        {descNum > 0 && <span className="text-red-500">- Desc: {formatarMoeda(descNum)}</span>}
                        {acrNum > 0 && <span className="text-blue-500">+ Taxa: {formatarMoeda(acrNum)}</span>}
                    </div>

                    <div className="flex gap-3 mb-6">
                        <div className="flex-1 bg-gray-50 p-2 rounded-xl border border-gray-100 focus-within:border-emerald-500 transition-colors">
                            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Desconto (R$)</label>
                            <input type="number" step="0.01" min="0" className="w-full bg-transparent text-lg font-bold text-gray-800 outline-none placeholder-gray-300" placeholder="0,00" value={desconto} onChange={e => setDesconto(e.target.value)} />
                        </div>
                        <div className="flex-1 bg-gray-50 p-2 rounded-xl border border-gray-100 focus-within:border-blue-500 transition-colors">
                            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Taxa/Extra (R$)</label>
                            <input type="number" step="0.01" min="0" className="w-full bg-transparent text-lg font-bold text-gray-800 outline-none placeholder-gray-300" placeholder="0,00" value={acrescimo} onChange={e => setAcrescimo(e.target.value)} />
                        </div>
                    </div>

                    {/* Forma de Pagamento - Sempre Visível */}
                    <div className="grid grid-cols-4 gap-1.5 mb-6">
                        {['dinheiro', 'cartao', 'pix', 'crediario'].map(f => {
                            const isSelected = formaAtual === f || (pagamentos && pagamentos.length === 1 && pagamentos[0].forma === f);
                            return (
                                <button key={f} 
                                    type="button"
                                    onClick={() => {
                                        setFormaAtual(f);
                                        let novosPagamentos;
                                        if (pagamentos && pagamentos.length === 1) {
                                            novosPagamentos = [{ ...pagamentos[0], forma: f }];
                                            setPagamentos(novosPagamentos);
                                            setValorInput(novosPagamentos[0].valor.toFixed(2));
                                        } else if (restante > 0) {
                                            novosPagamentos = [...pagamentos, { forma: f, valor: restante }];
                                            setPagamentos(novosPagamentos);
                                            setValorInput('');
                                        }
                                    }}
                                    className={`p-2.5 rounded-xl font-bold uppercase text-[9px] flex flex-col items-center gap-1 transition-all border ${isSelected ? 'bg-gray-800 border-gray-800 text-white shadow-md scale-[1.02]' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50 hover:border-gray-300'}`}>
                                    <span className="text-xl">{f === 'dinheiro' ? '💵' : f === 'cartao' ? '💳' : f === 'pix' ? '💠' : '🤝'}</span>
                                    {f === 'crediario' ? 'Crediário' : f}
                                </button>
                            );
                        })}
                    </div>

                    {pagamentos.length > 0 && (
                        <div className="mb-4 bg-gray-50 rounded-xl p-4 border border-gray-200">
                            <p className="text-[10px] font-bold uppercase text-gray-400 mb-3 tracking-wider">Pagamentos Lançados</p>
                            <div className="space-y-2">
                                {pagamentos.map((p, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                                        <span className="font-bold text-sm uppercase text-gray-700">{p.forma}</span>
                                        <div className="flex items-center gap-4">
                                            <span className="font-black text-gray-800">{formatarMoeda(p.valor)}</span>
                                            <button onClick={() => handleRemover(idx)} className="bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 w-6 h-6 rounded-md flex items-center justify-center font-bold transition-colors">✕</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {troco > 0 && (
                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200 border-dashed">
                                    <span className="font-bold text-sm text-gray-500 uppercase tracking-wider">Troco a Devolver</span>
                                    <span className="font-black text-lg text-emerald-600 bg-emerald-100 px-3 py-1 rounded-lg">{formatarMoeda(troco)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {restante > 0 ? (
                        <div className="mb-6 animate-fadeIn">
                            <div className="flex justify-between items-end mb-3">
                                <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Falta Pagar</span>
                                <span className="font-black text-red-500 text-2xl leading-none">{formatarMoeda(restante)}</span>
                            </div>

                            <div className="flex gap-2 h-14">
                                <input type="number" step="0.01" className="w-full h-full bg-gray-50 border border-gray-200 rounded-xl px-4 text-2xl font-bold text-gray-800 outline-none focus:border-emerald-500 focus:bg-white transition-colors" value={valorInput} onChange={e => handleInputChange(e.target.value)} placeholder="0,00" />
                                <button onClick={handleAdicionar} className="h-full bg-emerald-100 text-emerald-700 px-5 rounded-xl font-black text-sm hover:bg-emerald-200 transition-colors shadow-sm">INCLUIR</button>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-6 animate-fadeIn space-y-4">
                            <div className="bg-emerald-50 p-4 rounded-xl text-center border border-emerald-100">
                                <p className="font-black text-emerald-700 text-lg">✅ Valor Completo!</p>
                            </div>
                            
                            {/* Permite editar o valor recebido em Dinheiro para calcular o troco */}
                            {pagamentos.length === 1 && pagamentos[0].forma === 'dinheiro' && (
                                <div className="animate-slideUp space-y-2">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Valor Recebido (Dinheiro):</label>
                                    <div className="flex gap-2 h-14">
                                        <input type="number" step="0.01" className="w-full h-full bg-gray-50 border border-gray-200 rounded-xl px-4 text-2xl font-bold text-gray-800 outline-none focus:border-emerald-500 focus:bg-white transition-colors" value={valorInput} onChange={e => handleInputChange(e.target.value)} placeholder="0,00" />
                                        <button onClick={handleAdicionar} className="h-full bg-emerald-600 text-white px-5 rounded-xl font-black text-sm hover:bg-emerald-700 transition-colors shadow-sm uppercase">Calcular</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {temCrediario && !clienteSelecionado && (
                        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold p-3.5 rounded-xl flex items-center gap-2 animate-fadeIn">
                            <span>⚠️</span><span>Selecione um cliente para finalizar no Crediário.</span>
                        </div>
                    )}

                    {temCrediario && clienteSelecionado && loadingCrediario && (
                        <div className="mb-4 bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold p-3.5 rounded-xl flex items-center justify-center gap-2 animate-fadeIn">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-200 border-t-emerald-600"></div>
                            <span>Consultando limites do cliente...</span>
                        </div>
                    )}

                    {temCrediario && clienteSelecionado && !loadingCrediario && (
                        <div className="mb-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                            <p className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Status do Crediário ({clienteSelecionado.nome})</p>
                            <div className="grid grid-cols-3 gap-2 text-center">
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
                                <p className="text-red-500 font-bold text-xs text-center bg-red-50 p-2 rounded-xl border border-red-100 mt-2">
                                    ⚠️ O cliente não possui limite de crediário liberado.
                                </p>
                            )}

                            {excedeLimite && !semLimiteLiberado && (
                                <p className="text-red-500 font-bold text-xs text-center bg-red-50 p-2 rounded-xl border border-red-100 mt-2">
                                    🚨 O valor de {formatarMoeda(valorCrediario)} excede o limite disponível!
                                </p>
                            )}
                        </div>
                    )}

                    {/* Cliente Selector Widget inside modal */}
                    <div className="mb-4 bg-gray-50 p-3.5 rounded-xl border border-gray-200 flex justify-between items-center gap-2 select-none">
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

                    <input type="text" className="w-full p-4 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl mb-2 outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder-gray-400 font-medium" placeholder="CPF na Nota (Opcional)" value={cpfNota} onChange={e => setCpfNota(e.target.value)} />
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-100 mt-2 shrink-0">
                    <button onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 p-4 rounded-xl font-bold text-gray-500 transition-all">Voltar</button>
                    <button onClick={onFinalizar} disabled={salvando || !podeFinalizar} className="flex-[2] bg-emerald-600 text-white p-4 rounded-xl font-black text-lg hover:bg-emerald-700 transition-all shadow-lg disabled:opacity-50 disabled:bg-gray-300 disabled:shadow-none">FINALIZAR VENDA</button>
                </div>
            </div>
        </div>
    );
};
