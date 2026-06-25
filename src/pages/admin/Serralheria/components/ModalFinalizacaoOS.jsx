// src/pages/admin/Serralheria/components/ModalFinalizacaoOS.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../../../../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';

const formatarMoeda = (val) => {
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const ModalFinalizacaoOS = ({ 
    visivel, 
    os, 
    onClose, 
    onFinalizar, 
    salvando,
    estabelecimentoId
}) => {
    const [pagamentos, setPagamentos] = useState([]);
    const [desconto, setDesconto] = useState('');
    const [acrescimo, setAcrescimo] = useState('');
    const [valorInput, setValorInput] = useState('');
    const [dadosCrediario, setDadosCrediario] = useState({ limite: 0, saldo: 0 });
    const [loadingCrediario, setLoadingCrediario] = useState(false);
    const inputRef = useRef(null);

    const [clienteId, setClienteId] = useState(null);
    const [clienteNaoExiste, setClienteNaoExiste] = useState(false);

    const [garantia, setGarantia] = useState('');
    const [observacaoGarantia, setObservacaoGarantia] = useState('');
    
    const osTotal = os ? (os.total || os.projeto?.precoVenda || 0) : 0;
    const descNum = parseFloat(desconto || 0);
    const acrNum = parseFloat(acrescimo || 0);
    const totalFinal = Math.max(0, osTotal + acrNum - descNum);

    const listaPagamentos = pagamentos || [];
    const totalPago = listaPagamentos.reduce((acc, p) => acc + p.valor, 0);
    const restante = Math.max(0, totalFinal - totalPago);
    const troco = Math.max(0, totalPago - totalFinal);

    const [showCardDetailsModal, setShowCardDetailsModal] = useState(false);
    const [cardDetails, setCardDetails] = useState({
        tipo: 'credito',
        valorBruto: '',
        parcelas: 1,
        taxaPorcentagem: '',
        taxaValor: '',
        valorLiquido: 0
    });

    const [modalCrediario, setModalCrediario] = useState(false);
    const [dataVencimentoCrediario, setDataVencimentoCrediario] = useState('');

    useEffect(() => {
        if (visivel && os) {
            setPagamentos([]);
            setDesconto('');
            setAcrescimo('');
            setValorInput('');
            setGarantia('');
            setObservacaoGarantia('');
            setClienteId(null);
            setClienteNaoExiste(false);
        }
    }, [visivel, os]);

    const triggerCardDetailsModal = () => {
        const cleanVal = (valorInput || '').toString().replace(',', '.').trim();
        let valCobrar = parseFloat(cleanVal);
        if (isNaN(valCobrar) || valCobrar <= 0) {
            valCobrar = restante;
        }
        valCobrar = Math.min(valCobrar, restante);
        
        setCardDetails({
            tipo: 'credito',
            valorBruto: valCobrar.toFixed(2),
            parcelas: 1,
            taxaPorcentagem: '',
            taxaValor: '',
            valorLiquido: valCobrar
        });
        setShowCardDetailsModal(true);
    };

    const recalculateCardDetails = (bruto, pct, vTaxa, changedField, customLiquido) => {
        let nBruto = parseFloat(bruto) || 0;
        let nPct = parseFloat(pct) || 0;
        let nVTaxa = parseFloat(vTaxa) || 0;
        let nLiquido = 0;

        if (changedField === 'valorBruto') {
            nVTaxa = (nBruto * nPct) / 100;
            nLiquido = nBruto - nVTaxa;
        } else if (changedField === 'taxaPorcentagem') {
            nVTaxa = (nBruto * nPct) / 100;
            nLiquido = nBruto - nVTaxa;
        } else if (changedField === 'taxaValor') {
            nPct = nBruto > 0 ? (nVTaxa / nBruto) * 100 : 0;
            nLiquido = nBruto - nVTaxa;
        } else if (changedField === 'valorLiquido') {
            const valLiq = parseFloat(customLiquido) || 0;
            nVTaxa = Math.max(0, nBruto - valLiq);
            nPct = nBruto > 0 ? (nVTaxa / nBruto) * 100 : 0;
            nLiquido = valLiq;
        }

        setCardDetails(prev => ({
            ...prev,
            valorBruto: bruto,
            taxaPorcentagem: changedField === 'taxaPorcentagem' ? pct : (nPct === 0 ? '' : parseFloat(nPct.toFixed(2))),
            taxaValor: changedField === 'taxaValor' ? vTaxa : (nVTaxa === 0 ? '' : parseFloat(nVTaxa.toFixed(2))),
            valorLiquido: parseFloat(nLiquido.toFixed(2))
        }));
    };

    const handleAdicionarCardConfirmado = () => {
        const brutoVal = parseFloat(cardDetails.valorBruto) || 0;
        if (brutoVal <= 0) return;

        const valorAAdicionar = Math.min(brutoVal, restante);
        if (valorAAdicionar <= 0) return;

        const forma = cardDetails.tipo === 'debito' ? 'cartao_debito' : 'cartao_credito';
        const pObj = {
            forma,
            valor: valorAAdicionar,
            parcelas: cardDetails.tipo === 'credito' ? cardDetails.parcelas : 1,
            taxaValor: parseFloat(cardDetails.taxaValor) || 0,
            taxaPorcentagem: parseFloat(cardDetails.taxaPorcentagem) || 0,
            valorLiquido: parseFloat(cardDetails.valorLiquido) || valorAAdicionar
        };

        let novosPagamentos;
        const existeIdx = pagamentos.findIndex(p => p.forma === forma && (forma === 'cartao_debito' || p.parcelas === pObj.parcelas));
        if (existeIdx > -1) {
            novosPagamentos = [...pagamentos];
            novosPagamentos[existeIdx].valor += pObj.valor;
            novosPagamentos[existeIdx].taxaValor = (novosPagamentos[existeIdx].taxaValor || 0) + pObj.taxaValor;
            novosPagamentos[existeIdx].valorLiquido = (novosPagamentos[existeIdx].valorLiquido || 0) + pObj.valorLiquido;
        } else {
            novosPagamentos = [...pagamentos, pObj];
        }

        setPagamentos(novosPagamentos);
        setShowCardDetailsModal(false);

        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                inputRef.current.select();
            }
        }, 50);
    };

    const triggerCrediarioModal = useCallback(() => {
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 30);
        const yyyy = defaultDate.getFullYear();
        const mm = String(defaultDate.getMonth() + 1).padStart(2, '0');
        const dd = String(defaultDate.getDate()).padStart(2, '0');
        setDataVencimentoCrediario(`${yyyy}-${mm}-${dd}`);
        setModalCrediario(true);
    }, []);

    const handleConfirmarCrediario = (e) => {
        if (e) e.preventDefault();
        const cleanVal = (valorInput || '').toString().replace(',', '.').trim();
        let v = parseFloat(cleanVal);
        if (isNaN(v) || v <= 0) {
            v = restante;
        }
        if (v <= 0) return;

        const valorAAdicionar = Math.min(v, restante);
        if (valorAAdicionar <= 0) return;

        let novosPagamentos;
        const existeIdx = pagamentos.findIndex(p => p.forma === 'crediario');
        if (existeIdx > -1) {
            novosPagamentos = [...pagamentos];
            novosPagamentos[existeIdx].valor += valorAAdicionar;
            novosPagamentos[existeIdx].dataVencimento = dataVencimentoCrediario;
        } else {
            novosPagamentos = [...pagamentos, { 
                forma: 'crediario', 
                valor: valorAAdicionar,
                dataVencimento: dataVencimentoCrediario 
            }];
        }
        setPagamentos(novosPagamentos);
        setModalCrediario(false);

        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                inputRef.current.select();
            }
        }, 50);
    };

    useEffect(() => {
        if (visivel && os && estabelecimentoId) {
            setLoadingCrediario(true);
            const cleanPhone = (os.cliente?.telefone || '').replace(/\D/g, '');
            const clientOSId = os.clienteId || null;

            if (clientOSId) {
                const cRef = doc(db, 'estabelecimentos', estabelecimentoId, 'clientes', clientOSId);
                getDoc(cRef).then(snap => {
                    if (snap.exists()) {
                        const data = snap.data();
                        setClienteId(clientOSId);
                        setDadosCrediario({
                            limite: Number(data.limiteCrediario || 0),
                            saldo: Number(data.saldoDevedor || 0)
                        });
                        setClienteNaoExiste(false);
                    } else {
                        setClienteId(clientOSId);
                        setDadosCrediario({ limite: 0, saldo: 0 });
                        setClienteNaoExiste(true);
                    }
                    setLoadingCrediario(false);
                }).catch(err => {
                    console.error("Erro ao carregar limite do crediário:", err);
                    setDadosCrediario({ limite: 0, saldo: 0 });
                    setLoadingCrediario(false);
                });
            } else {
                const clRef = collection(db, 'estabelecimentos', estabelecimentoId, 'clientes');
                getDocs(clRef).then((snap) => {
                    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    const existing = list.find(c => {
                        const cPhone = (c.telefone || '').replace(/\D/g, '');
                        const matchPhone = cleanPhone && cPhone && cPhone === cleanPhone;
                        const matchNome = c.nome && c.nome.toLowerCase() === os.cliente?.nome?.toLowerCase();
                        return matchPhone || matchNome;
                    });
                    
                    if (existing) {
                        setClienteId(existing.id);
                        setDadosCrediario({
                            limite: Number(existing.limiteCrediario || 0),
                            saldo: Number(existing.saldoDevedor || 0)
                        });
                        setClienteNaoExiste(false);
                    } else {
                        let generatedId = cleanPhone;
                        if (!generatedId || generatedId.length < 8) {
                            generatedId = doc(collection(db, 'estabelecimentos', estabelecimentoId, 'clientes')).id;
                        }
                        setClienteId(generatedId);
                        setDadosCrediario({ limite: 0, saldo: 0 });
                        setClienteNaoExiste(true);
                    }
                    setLoadingCrediario(false);
                }).catch(err => {
                    console.error("Erro ao listar clientes para crediário:", err);
                    setDadosCrediario({ limite: 0, saldo: 0 });
                    setLoadingCrediario(false);
                });
            }
        }
    }, [visivel, os, estabelecimentoId]);
    const handleAdicionarMetodo = (forma) => {
        const cleanVal = (valorInput || '').toString().replace(',', '.').trim();
        let v = parseFloat(cleanVal);
        if (isNaN(v) || v <= 0) {
            v = restante;
        }
        if (v <= 0) return;

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
    const crediarioSemCliente = temCrediario && !clienteId;
    const limiteDisponivel = dadosCrediario.limite - dadosCrediario.saldo;
    const semLimiteLiberado = temCrediario && clienteId && dadosCrediario.limite <= 0;
    const excedeLimite = temCrediario && clienteId && dadosCrediario.limite > 0 && (dadosCrediario.saldo + valorCrediario) > dadosCrediario.limite;

    const podeFinalizar = restante === 0 && !crediarioSemCliente && !semLimiteLiberado && !excedeLimite;

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!visivel || showCardDetailsModal || modalCrediario) return;
            if (e.key === 'Enter') {
                e.preventDefault();
                if (restante > 0) {
                    handleAdicionarMetodo('dinheiro');
                } else if (restante === 0 && podeFinalizar) {
                    if (!salvando) {
                        onFinalizar({
                            pagamentos,
                            desconto: descNum,
                            acrescimo: acrNum,
                            total: totalFinal,
                            valorRecebido: totalPago,
                            troco,
                            garantia,
                            observacaoGarantia,
                            clienteId,
                            clienteNaoExiste
                        });
                    }
                }
            } else if (e.key === 'F2') {
                e.preventDefault();
                handleAdicionarMetodo('dinheiro');
            } else if (e.key === 'F3') {
                e.preventDefault();
                triggerCardDetailsModal();
            } else if (e.key === 'F4') {
                e.preventDefault();
                handleAdicionarMetodo('pix');
            } else if (e.key === 'F5') {
                e.preventDefault();
                triggerCrediarioModal();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [visivel, restante, valorInput, pagamentos, salvando, onFinalizar, podeFinalizar, onClose, garantia, observacaoGarantia, triggerCardDetailsModal, triggerCrediarioModal, showCardDetailsModal, modalCrediario]);

    const handleSetGarantia = (val) => {
        setGarantia(val);
        const textoCDC = "Este produto/serviço possui garantia de 90 (noventa) dias, conforme previsto no Código de Defesa do Consumidor.\nA garantia é válida para defeitos de fabricação ou execução, não cobrindo danos decorrentes de mau uso, acidentes ou desgaste natural.\nPara acionar a garantia, apresente esta Ordem de Serviço.";
        if (val === '90_dias') {
            setObservacaoGarantia(textoCDC);
        } else if (observacaoGarantia === textoCDC) {
            setObservacaoGarantia('');
        }
    };

    // Sync remaining value when pagamentos/total changes
    useEffect(() => {
        if (visivel) {
            setValorInput(restante > 0 ? restante.toFixed(2) : '');
        }
    }, [restante, visivel]);

    if (!visivel || !os) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/60 z-[9000] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="modal-animate bg-white border border-slate-200 rounded-[2.5rem] max-w-md w-full max-h-[90vh] flex flex-col p-6 sm:p-8 shadow-2xl relative text-left select-none">
                
                {/* Header */}
                <div className="flex justify-between items-start pb-4 border-b border-gray-100 shrink-0">
                    <div>
                        <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-600 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            OS #{os.id.substring(0, 5).toUpperCase()}
                        </span>
                        <h3 className="font-black text-xl text-slate-800 mt-1.5">Faturamento de OS</h3>
                        <p className="text-[11px] font-semibold text-slate-400">Lance os pagamentos e conclua a Ordem de Serviço</p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-slate-400 hover:text-slate-650 hover:bg-slate-50 w-8 h-8 rounded-full flex items-center justify-center font-bold border border-slate-200/60 transition-all text-sm"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 scroll-thin">
                    
                    {/* Valores Totais */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Subtotal OS</span>
                            <span className="font-extrabold text-sm text-slate-700">{formatarMoeda(osTotal)}</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-slate-200 border-dashed pt-2">
                            <span className="text-slate-900 font-black text-sm uppercase tracking-wider">Total a Pagar</span>
                            <span className="font-black text-xl text-emerald-600 font-mono">{formatarMoeda(totalFinal)}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-semibold flex flex-wrap gap-x-2 gap-y-0.5 justify-end">
                            <span>Sub: {formatarMoeda(osTotal)}</span>
                            {descNum > 0 && <span className="text-red-500">- Desc: {formatarMoeda(descNum)}</span>}
                            {acrNum > 0 && <span className="text-blue-500">+ Taxa: {formatarMoeda(acrNum)}</span>}
                        </div>
                    </div>

                    {/* Desconto / Taxa */}
                    <div className="flex gap-3 select-none">
                        <div className="flex-1 bg-gray-50 p-2 rounded-xl border border-gray-100 focus-within:border-emerald-500 transition-colors">
                            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Desconto (R$)</label>
                            <input 
                                type="number" 
                                step="0.01" 
                                min="0" 
                                className="w-full bg-transparent text-lg font-bold text-gray-800 outline-none placeholder-gray-300" 
                                placeholder="0,00" 
                                value={desconto} 
                                onChange={e => setDesconto(e.target.value)} 
                            />
                        </div>
                        <div className="flex-1 bg-gray-50 p-2 rounded-xl border border-gray-100 focus-within:border-blue-500 transition-colors">
                            <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Taxa/Extra (R$)</label>
                            <input 
                                type="number" 
                                step="0.01" 
                                min="0" 
                                className="w-full bg-transparent text-lg font-bold text-gray-800 outline-none placeholder-gray-300" 
                                placeholder="0,00" 
                                value={acrescimo} 
                                onChange={e => setAcrescimo(e.target.value)} 
                            />
                        </div>
                    </div>

                    {/* Campo de Entrada de Valor */}
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 focus-within:border-emerald-500 focus-within:bg-white transition-all">
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

                    {/* Formas de Pagamento Buttons */}
                    <div className="grid grid-cols-4 gap-2 select-none">
                        {[
                            { id: 'dinheiro', label: 'Dinheiro', emoji: '💵', shortcut: 'F2' },
                            { id: 'cartao', label: 'Cartão', emoji: '💳', shortcut: 'F3' },
                            { id: 'pix', label: 'PIX', emoji: '💠', shortcut: 'F4' },
                            { id: 'crediario', label: 'Crediário', emoji: '🤝', shortcut: 'F5' }
                        ].map(f => (
                            <button 
                                key={f.id}
                                type="button"
                                onClick={() => {
                                    if (f.id === 'cartao') {
                                        triggerCardDetailsModal();
                                    } else if (f.id === 'crediario') {
                                        triggerCrediarioModal();
                                    } else {
                                        handleAdicionarMetodo(f.id);
                                    }
                                }}
                                className="py-2.5 px-1 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800 transition-all flex flex-col items-center justify-center gap-1 active:scale-95 shadow-sm"
                            >
                                <span className="text-xl">{f.emoji}</span>
                                <span className="text-[9px] font-black uppercase tracking-wider">{f.label}</span>
                                <span className="text-[8px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/50 mt-0.5">{f.shortcut}</span>
                            </button>
                        ))}
                    </div>

                    {/* Pagamentos Lançados List */}
                    {pagamentos.length > 0 && (
                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 animate-fadeIn">
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-wider">Pagamentos Lançados</p>
                            <div className="space-y-2">
                                {pagamentos.map((p, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-white px-3.5 py-3 rounded-xl border border-slate-200/60 shadow-sm animate-slideUp">
                                        <span className="font-extrabold text-xs uppercase text-slate-700">
                                            {p.forma === 'dinheiro' ? '💵 Dinheiro' : 
                                             p.forma === 'cartao' ? '💳 Cartão' : 
                                             p.forma === 'cartao_debito' ? '💳 Débito' : 
                                             p.forma === 'cartao_credito' ? `💳 Crédito${p.parcelas && p.parcelas > 1 ? ` (${p.parcelas}x)` : ''}` :
                                             p.forma === 'pix' ? '💠 PIX' : `🤝 Crediário${p.dataVencimento ? ` (Venc. ${new Date(p.dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR')})` : ''}`}
                                        </span>
                                        <div className="flex items-center gap-3">
                                            <span className="font-black text-sm text-slate-800">{formatarMoeda(p.valor)}</span>
                                            <button 
                                                type="button"
                                                onClick={() => handleRemover(idx)} 
                                                className="text-red-400 hover:text-red-650 hover:bg-red-50 w-6 h-6 rounded-md flex items-center justify-center font-bold transition-all text-xs"
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
                        <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold p-3.5 rounded-xl flex justify-between items-center animate-pulse">
                            <span>Falta Pagar:</span>
                            <span className="text-sm font-black">{formatarMoeda(restante)}</span>
                        </div>
                    )}
                    {restante === 0 && (
                        <div className="bg-emerald-50 p-4 rounded-xl text-center border border-emerald-100/60 select-none">
                            <p className="font-black text-emerald-700 text-sm">✅ Valor Completo!</p>
                        </div>
                    )}

                    {/* Crediario checks */}
                    {temCrediario && !clienteId && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold p-3.5 rounded-xl flex items-center gap-2">
                            <span>⚠️</span><span>Esta OS precisa de um cliente vinculado para usar Crediário.</span>
                        </div>
                    )}

                    {temCrediario && clienteId && loadingCrediario && (
                        <div className="bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold p-3.5 rounded-xl flex items-center justify-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-200 border-t-emerald-600"></div>
                            <span>Consultando limites do cliente...</span>
                        </div>
                    )}

                    {temCrediario && clienteId && !loadingCrediario && (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                            <p className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Status do Crediário ({os.cliente?.nome})</p>
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

                    {/* Garantia */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 text-left">
                        <p className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">🛡️ Termo de Garantia</p>
                        <div className="grid grid-cols-4 gap-2 select-none">
                            {[
                                { value: '', label: 'Sem' },
                                { value: '90_dias', label: '90 dias' },
                                { value: '180_dias', label: '180 dias' },
                                { value: '365_dias', label: '365 dias' }
                            ].map(opt => (
                                <button 
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleSetGarantia(opt.value)}
                                    className={`py-2 px-1 rounded-xl border text-[10px] font-bold uppercase transition-all active:scale-95 ${
                                        garantia === opt.value 
                                            ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                                            : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Observações da Garantia</label>
                            <textarea 
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:border-emerald-500 outline-none resize-none h-20 transition-all"
                                placeholder="Termos específicos de garantia..." 
                                value={observacaoGarantia} 
                                onChange={e => setObservacaoGarantia(e.target.value)} 
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-3 pt-4 border-t border-gray-100 mt-2 shrink-0">
                    <button onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 p-4 rounded-xl font-bold text-gray-500 transition-all">Voltar</button>
                    <button 
                        onClick={() => onFinalizar({
                            pagamentos,
                            desconto: descNum,
                            acrescimo: acrNum,
                            total: totalFinal,
                            valorRecebido: totalPago,
                            troco,
                            garantia,
                            observacaoGarantia,
                            clienteId,
                            clienteNaoExiste
                        })} 
                        disabled={salvando || !podeFinalizar} 
                        className="flex-[2] bg-emerald-600 text-white p-4 rounded-xl font-black text-lg hover:bg-emerald-700 transition-all shadow-lg disabled:opacity-50 disabled:bg-gray-300 disabled:shadow-none"
                    >
                        FINALIZAR (Enter)
                    </button>
                </div>
            </div>

            {/* Submodal Card Details */}
            {showCardDetailsModal && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9500] p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-[2rem] p-6 sm:p-8 w-full max-w-sm shadow-2xl border border-slate-100 flex flex-col gap-4 animate-slideUp">
                        <div>
                            <h3 className="font-black text-lg text-slate-800">Detalhamento de Cartão</h3>
                            <p className="text-[10px] font-semibold text-slate-400">Configure as taxas e parcelas da venda</p>
                        </div>
                        
                        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                            <button 
                                type="button"
                                onClick={() => {
                                    setCardDetails(prev => ({ ...prev, tipo: 'debito', parcelas: 1, taxaPorcentagem: '', taxaValor: '', valorLiquido: parseFloat(prev.valorBruto) || 0 }));
                                }}
                                className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${cardDetails.tipo === 'debito' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                💳 Débito
                            </button>
                            <button 
                                type="button"
                                onClick={() => {
                                    setCardDetails(prev => ({ ...prev, tipo: 'credito' }));
                                }}
                                className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${cardDetails.tipo === 'credito' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                💳 Crédito
                            </button>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Valor Cobrado do Cliente (Bruto)</label>
                            <input 
                                type="number" 
                                step="0.01"
                                className="w-full bg-transparent text-base font-black text-slate-800 outline-none"
                                value={cardDetails.valorBruto}
                                onChange={e => {
                                    const val = e.target.value;
                                    recalculateCardDetails(val, cardDetails.taxaPorcentagem, cardDetails.taxaValor, 'valorBruto');
                                }}
                            />
                        </div>

                        {cardDetails.tipo === 'credito' && (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Número de Parcelas</label>
                                <select 
                                    className="w-full bg-transparent text-sm font-black text-slate-800 outline-none"
                                    value={cardDetails.parcelas}
                                    onChange={e => {
                                        setCardDetails(prev => ({ ...prev, parcelas: parseInt(e.target.value) || 1 }));
                                    }}
                                >
                                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                                        <option key={n} value={n}>{n}x</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Taxa Máquina (%)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    min="0"
                                    className="w-full bg-transparent text-sm font-black text-slate-800 outline-none"
                                    value={cardDetails.taxaPorcentagem}
                                    placeholder="0.00"
                                    onChange={e => {
                                        const val = e.target.value;
                                        recalculateCardDetails(cardDetails.valorBruto, val, cardDetails.taxaValor, 'taxaPorcentagem');
                                    }}
                                />
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Taxa Cobrada (R$)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    min="0"
                                    className="w-full bg-transparent text-sm font-black text-slate-800 outline-none"
                                    value={cardDetails.taxaValor}
                                    placeholder="0.00"
                                    onChange={e => {
                                        const val = e.target.value;
                                        recalculateCardDetails(cardDetails.valorBruto, cardDetails.taxaPorcentagem, val, 'taxaValor');
                                    }}
                                />
                            </div>
                        </div>

                        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex justify-between items-center">
                            <div>
                                <span className="block text-[9px] font-bold text-emerald-600 uppercase">Valor Líquido a Receber</span>
                            </div>
                            <div className="relative w-[120px]">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-700 font-extrabold text-xs">R$</span>
                                <input 
                                    type="number"
                                    step="0.01"
                                    className="w-full bg-white/80 border border-emerald-250 rounded-lg px-2 pl-6 py-1 text-sm font-black text-emerald-800 text-right outline-none"
                                    value={cardDetails.valorLiquido}
                                    onChange={e => {
                                        const val = e.target.value;
                                        recalculateCardDetails(cardDetails.valorBruto, cardDetails.taxaPorcentagem, cardDetails.taxaValor, 'valorLiquido', val);
                                    }}
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 mt-2">
                            <button 
                                type="button"
                                onClick={() => setShowCardDetailsModal(false)}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 py-2.5 rounded-xl font-bold text-slate-500 transition-all text-xs"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="button"
                                onClick={handleAdicionarCardConfirmado}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 py-2.5 rounded-xl font-black text-white transition-all text-xs shadow-md"
                            >
                                Adicionar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Submodal Crediario Vencimento */}
            {modalCrediario && (
                <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9500] p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-[2rem] p-6 sm:p-8 w-full max-w-sm shadow-2xl border border-slate-100 flex flex-col gap-4 animate-slideUp">
                        <div>
                            <h3 className="font-black text-lg text-slate-800">Vencimento do Crediário</h3>
                            <p className="text-[10px] font-semibold text-slate-400">Selecione a data de vencimento da conta</p>
                        </div>

                        <form onSubmit={handleConfirmarCrediario} className="flex flex-col gap-4">
                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Data de Vencimento</label>
                                <input 
                                    type="date"
                                    className="w-full bg-transparent text-sm font-black text-slate-800 outline-none cursor-pointer"
                                    value={dataVencimentoCrediario}
                                    onChange={e => setDataVencimentoCrediario(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="flex gap-2 mt-2">
                                <button 
                                    type="button" 
                                    onClick={() => setModalCrediario(false)} 
                                    className="flex-1 bg-slate-100 hover:bg-slate-200 py-2.5 rounded-xl font-bold text-slate-500 transition-all text-xs"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 py-2.5 rounded-xl font-black text-white transition-all text-xs shadow-md"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
export default ModalFinalizacaoOS;
