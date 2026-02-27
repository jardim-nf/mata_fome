// src/components/PdvModals.jsx
import React, { useState, useEffect } from 'react';
import { IoTimeOutline, IoClose, IoCheckmarkCircleOutline, IoStorefrontOutline } from 'react-icons/io5';

// --- FUNÇÕES AUXILIARES ---
export const formatarHora = (data) => {
    if (!data) return '--:--';
    if (data.toDate) return data.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (data instanceof Date) return data.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return '--:--';
};

export const formatarData = (data) => {
    if (!data) return '-';
    if (data.toDate) return data.toDate().toLocaleDateString('pt-BR');
    if (data instanceof Date) return data.toLocaleDateString('pt-BR');
    return '-';
};

export const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
};

// --- MODAIS ---

export const ModalEdicaoItemCarrinho = ({ visivel, item, onClose, onConfirm }) => {
    const [quantidade, setQuantidade] = useState(1);
    const [observacao, setObservacao] = useState('');

    useEffect(() => {
        if (visivel && item) {
            setQuantidade(item.quantity || 1);
            setObservacao(item.observacao || '');
        }
    }, [visivel, item]);

    if (!visivel || !item) return null;

    return (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-[9600] p-4 backdrop-blur-sm no-print">
            <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl animate-slideUp">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                    <h3 className="font-bold text-xl text-gray-800 line-clamp-1">{item.name}</h3>
                    <button onClick={onClose} className="bg-gray-100 p-2 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
                </div>

                <div className="mb-6">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Quantidade</label>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setQuantidade(Math.max(1, quantidade - 1))} className="w-12 h-12 rounded-xl bg-gray-100 text-gray-600 font-bold text-xl hover:bg-gray-200 transition-colors">-</button>
                        <input type="number" min="1" value={quantidade} onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))} className="flex-1 h-12 bg-gray-50 border border-gray-200 rounded-xl text-center font-bold text-xl outline-none focus:border-emerald-500" />
                        <button onClick={() => setQuantidade(quantidade + 1)} className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 font-bold text-xl hover:bg-emerald-200 transition-colors">+</button>
                    </div>
                </div>

                <div className="mb-6">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Observação (Ex: Sem cebola)</label>
                    <textarea rows="3" value={observacao} onChange={(e) => setObservacao(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-800 outline-none focus:border-emerald-500 resize-none placeholder-gray-400" placeholder="Digite aqui..."></textarea>
                </div>

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 p-4 rounded-xl font-bold text-gray-500 transition-all">Cancelar</button>
                    <button onClick={() => onConfirm(item.uid, quantidade, observacao)} className="flex-1 bg-emerald-600 text-white p-4 rounded-xl font-bold hover:bg-emerald-700 shadow-lg transition-all">Salvar Alterações</button>
                </div>
            </div>
        </div>
    );
};

export const ModalSelecaoVariacao = ({ produto, onClose, onConfirm }) => {
    if (!produto) return null;
    return (
        <div className="fixed inset-0 bg-gray-900/40 flex items-center justify-center z-[9000] p-4 backdrop-blur-sm animate-fadeIn no-print">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl transform animate-slideUp">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                    <h3 className="font-bold text-xl text-gray-800">{produto.name}</h3>
                    <button onClick={onClose} className="bg-gray-100 p-2 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
                </div>
                <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                    {produto.variacoes?.map(v => (
                        <button key={v.id} onClick={() => onConfirm(produto, v)} className="flex justify-between items-center p-4 border border-gray-100 bg-gray-50 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group">
                            <span className="font-semibold text-gray-700 group-hover:text-emerald-700">{v.nome}</span>
                            <span className="text-emerald-600 font-bold bg-white px-3 py-1 rounded-lg border border-gray-100 shadow-sm">{formatarMoeda(v.preco)}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export const ModalAberturaCaixa = ({ visivel, onAbrir, usuarioNome }) => {
    const [saldo, setSaldo] = useState('');
    if (!visivel) return null;
    return (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm animate-fadeIn no-print">
            <div className="bg-white p-8 rounded-[2rem] w-full max-w-sm text-center shadow-2xl transform animate-slideUp">
                <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center text-5xl mx-auto mb-6 text-emerald-500 shadow-inner">🔓</div>
                <h2 className="text-3xl font-bold mb-2 text-gray-800">Abrir Caixa</h2>
                <p className="text-gray-500 mb-8">Olá <b>{usuarioNome}</b>, informe o fundo:</p>
                <div className="relative mb-6 group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl font-bold group-focus-within:text-emerald-600 transition-colors">R$</span>
                    <input type="number" className="w-full p-4 pl-12 bg-gray-50 border-2 border-gray-200 rounded-2xl text-4xl font-bold text-gray-800 focus:border-emerald-500 focus:bg-white outline-none transition-all placeholder-gray-300" placeholder="0,00" autoFocus onChange={e => setSaldo(e.target.value)} value={saldo} step="0.01" />
                </div>
                <button onClick={() => onAbrir(saldo)} disabled={!saldo} className="w-full bg-emerald-600 text-white p-5 rounded-2xl font-bold text-xl hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-200 hover:scale-[1.02]">INICIAR VENDAS</button>
            </div>
        </div>
    );
};

export const ModalFechamentoCaixa = ({ visivel, caixa, vendasDoDia, movimentacoes, onClose, onConfirmarFechamento }) => {
    const [valorInformado, setValorInformado] = useState('');
    if (!visivel || !caixa) return null;

    const da = caixa.dataAbertura?.toDate ? caixa.dataAbertura.toDate() : new Date(caixa.dataAbertura);
    const vt = vendasDoDia.filter(v => { const dv = v.createdAt?.toDate ? v.createdAt.toDate() : new Date(v.createdAt); return v.usuarioId === caixa.usuarioId && dv >= da; });

    let tDin = 0; let tOut = 0;
    vt.forEach(v => {
        if (v.status === 'cancelada' || v.fiscal?.status === 'CANCELADA') return;
        if (v.pagamentos && Array.isArray(v.pagamentos)) {
            v.pagamentos.forEach(p => {
                if (p.forma === 'dinheiro') tDin += (p.valor - (v.troco || 0));
                else tOut += p.valor;
            });
        } else {
            if (v.formaPagamento === 'dinheiro') tDin += (v.total || 0);
            else tOut += (v.total || 0);
        }
    });

    const tSup = movimentacoes?.totalSuprimento || 0;
    const tSan = movimentacoes?.totalSangria || 0;
    const itensMov = movimentacoes?.itens || [];

    const esp = parseFloat(caixa.saldoInicial || 0) + tDin + tSup - tSan;
    const dif = parseFloat(valorInformado || 0) - esp;

    return (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm animate-fadeIn no-print">
            <div className="bg-white p-6 sm:p-8 rounded-[2rem] w-full max-w-md shadow-2xl transform animate-slideUp max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-4 shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Fechar Turno</h2>
                        <p className="text-xs text-gray-500 mt-1">Aberto em: <b>{formatarData(da)} às {formatarHora(da)}</b></p>
                    </div>
                    <button onClick={onClose} className="bg-gray-100 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200">✕</button>
                </div>

                <div className="overflow-y-auto custom-scrollbar flex-1 pr-2">
                    <div className="bg-gray-50 p-4 rounded-2xl mb-4 text-center border border-gray-100">
                        <p className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-1">ESPERADO (DINHEIRO NA GAVETA)</p>
                        <p className="text-4xl font-black text-gray-800">{formatarMoeda(esp)}</p>
                    </div>

                    {itensMov.length > 0 && (
                        <div className="mb-4 border border-gray-200 rounded-xl p-3 bg-white shadow-sm">
                            <p className="text-[10px] font-bold uppercase text-gray-400 mb-2 border-b border-gray-100 pb-1">Detalhes de Movimentação</p>
                            <div className="space-y-1">
                                {itensMov.map((mov, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs bg-gray-50 p-1.5 rounded-lg">
                                        <span className="text-gray-600 truncate flex-1 pr-2 font-medium">
                                            {mov.tipo === 'sangria' ? '🔴' : '🟢'} {mov.descricao}
                                        </span>
                                        <span className={`font-bold ${mov.tipo === 'sangria' ? 'text-red-500' : 'text-emerald-500'}`}>
                                            {mov.tipo === 'sangria' ? '-' : '+'}{formatarMoeda(mov.valor)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mb-2">
                        <label className="block text-sm font-bold text-gray-500 mb-2">Valor Físico na Gaveta</label>
                        <input type="number" step="0.01" className={`w-full p-4 border-2 rounded-2xl text-2xl font-bold text-center outline-none transition-colors ${Math.abs(dif) > 0.05 ? 'border-red-200 bg-red-50 text-red-600' : 'border-emerald-200 bg-emerald-50 text-emerald-600'}`} placeholder="0,00" autoFocus onChange={e => setValorInformado(e.target.value)} value={valorInformado} />
                    </div>
                </div>

                <div className="mt-4 shrink-0">
                    <button onClick={() => onConfirmarFechamento({ saldoFinalInformado: parseFloat(valorInformado || 0), diferenca: dif, resumoVendas: { dinheiro: tDin, outros: tOut, suprimento: tSup, sangria: tSan, detalhesMov: itensMov, total: tDin + tOut, qtd: vt.length } })} className="w-full bg-gray-900 text-white p-4 rounded-2xl font-bold text-lg hover:bg-black transition-all shadow-xl">FINALIZAR TURNO</button>
                </div>
            </div>
        </div>
    );
};

export const ModalMovimentacao = ({ visivel, onClose, onConfirmar }) => {
    const [t, sT] = useState('sangria'); const [v, sV] = useState(''); const [d, sD] = useState('');
    if (!visivel) return null;
    return (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-[9400] p-4 backdrop-blur-sm no-print">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
                <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                    <button onClick={() => sT('sangria')} className={`flex-1 py-2 rounded-lg font-bold transition ${t === 'sangria' ? 'bg-white text-red-500 shadow' : 'text-gray-400 hover:text-gray-600'}`}>Sangria</button>
                    <button onClick={() => sT('suprimento')} className={`flex-1 py-2 rounded-lg font-bold transition ${t === 'suprimento' ? 'bg-white text-emerald-500 shadow' : 'text-gray-400 hover:text-gray-600'}`}>Suprimento</button>
                </div>
                <input type="number" className="w-full p-4 border-2 border-gray-100 bg-gray-50 rounded-xl text-3xl text-center font-bold mb-3 focus:border-blue-500 outline-none text-gray-800 placeholder-gray-300" placeholder="0,00" autoFocus onChange={e => sV(e.target.value)} value={v} />
                <input type="text" className="w-full p-3 border border-gray-200 bg-white rounded-xl mb-4 outline-none text-gray-800 placeholder-gray-400" placeholder="Motivo" onChange={e => sD(e.target.value)} value={d} />
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 bg-gray-100 p-3 rounded-xl font-bold text-gray-500 hover:bg-gray-200">Cancelar</button>
                    <button onClick={() => { if (!v || !d) return; onConfirmar({ tipo: t, valor: parseFloat(v), descricao: d }); sV(''); sD(''); }} className={`flex-1 text-white p-3 rounded-xl font-bold ${t === 'sangria' ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>SALVAR</button>
                </div>
            </div>
        </div>
    );
};

export const ModalFinalizacao = ({ visivel, venda, onClose, onFinalizar, salvando, pagamentos, setPagamentos, cpfNota, setCpfNota, desconto, setDesconto, acrescimo, setAcrescimo }) => {
    const [formaAtual, setFormaAtual] = useState('dinheiro');
    const [valorInput, setValorInput] = useState('');

    useEffect(() => {
        if (visivel) { setFormaAtual('dinheiro'); setValorInput(''); }
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
        if (restante > 0) setValorInput(restante.toFixed(2));
        else setValorInput('');
    }, [restante]);

    if (!visivel || !venda) return null;

    const handleAdicionar = () => {
        const v = parseFloat(valorInput || 0);
        if (v <= 0) return;
        setPagamentos([...pagamentos, { forma: formaAtual, valor: v }]);
    };

    const handleRemover = (idx) => {
        setPagamentos(pagamentos.filter((_, i) => i !== idx));
    };

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

                            <div className="grid grid-cols-3 gap-2 mb-3">
                                {['dinheiro', 'cartao', 'pix'].map(f =>
                                    <button key={f} 
                                        // 🔥 MÁGICA AQUI: Ao clicar, ele injeta o valor restante automático na caixinha!
                                        onClick={() => {
                                            setFormaAtual(f);
                                            if (restante > 0) setValorInput(restante.toFixed(2));
                                        }}
                                        className={`p-3 rounded-xl font-bold uppercase text-[10px] flex flex-col items-center gap-1 transition-all border ${formaAtual === f ? 'bg-gray-800 border-gray-800 text-white shadow-md scale-[1.02]' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50 hover:border-gray-300'}`}>
                                        <span className="text-2xl">{f === 'dinheiro' ? '💵' : f === 'cartao' ? '💳' : '💠'}</span>{f}
                                    </button>
                                )}
                            </div>

                            <div className="flex gap-2 h-14">
                                <input type="number" step="0.01" className="w-full h-full bg-gray-50 border border-gray-200 rounded-xl px-4 text-2xl font-bold text-gray-800 outline-none focus:border-emerald-500 focus:bg-white transition-colors" value={valorInput} onChange={e => setValorInput(e.target.value)} placeholder="0,00" />
                                <button onClick={handleAdicionar} className="h-full bg-emerald-100 text-emerald-700 px-5 rounded-xl font-black text-sm hover:bg-emerald-200 transition-colors shadow-sm">INCLUIR</button>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-6 bg-emerald-50 p-4 rounded-xl text-center border border-emerald-100 animate-slideUp">
                            <p className="font-black text-emerald-700 text-lg">✅ Valor Completo!</p>
                        </div>
                    )}

                    <input type="text" className="w-full p-4 bg-gray-50 border border-gray-200 text-gray-800 rounded-xl mb-2 outline-none focus:border-emerald-500 focus:bg-white transition-all placeholder-gray-400 font-medium" placeholder="CPF na Nota (Opcional)" value={cpfNota} onChange={e => setCpfNota(e.target.value)} />
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-100 mt-2 shrink-0">
                    <button onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 p-4 rounded-xl font-bold text-gray-500 transition-all">Voltar</button>
                    <button onClick={onFinalizar} disabled={salvando || restante > 0} className="flex-[2] bg-emerald-600 text-white p-4 rounded-xl font-black text-lg hover:bg-emerald-700 transition-all shadow-lg disabled:opacity-50 disabled:bg-gray-300 disabled:shadow-none">FINALIZAR VENDA</button>
                </div>
            </div>
        </div>
    );
};

export const ModalRecibo = ({ visivel, dados, onClose, onNovaVenda, onEmitirNfce, nfceStatus, nfceUrl, onBaixarXml, onConsultarStatus, onBaixarPdf, onBaixarXmlCancelamento, onEnviarWhatsApp }) => {
    if (!visivel) return null;

    // Pega o status formatado para evitar erros de case-sensitive
    const statusNfceRecibo = dados?.fiscal?.status?.toUpperCase() || '';
    const temIdRecibo = !!dados?.fiscal?.idPlugNotas;
    const isCanceladaRecibo = dados?.status === 'cancelada' || statusNfceRecibo.includes('CANCEL');

    return (
        <div id="recibo-overlay" className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
            <div id="recibo-content" className="bg-white w-full max-w-sm p-8 rounded-3xl shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 bg-gray-100 hover:bg-red-100 hover:text-red-500 p-2 rounded-full transition-colors no-print">✕</button>
                <div className="text-center border-b border-dashed border-gray-200 pb-6 mb-6">
                    <h2 className="font-black text-2xl text-gray-800 uppercase tracking-wide">RECIBO</h2>
                    <p className="text-gray-400 text-xs font-mono mt-1">#{dados.id.slice(-6)} • {formatarData(dados.createdAt)}</p>
                </div>
                <div className="space-y-3 mb-6 max-h-60 overflow-y-auto custom-scrollbar print:max-h-none print:overflow-visible">
                    {dados.itens.map(i => (
                        <div key={i.uid} className="flex flex-col text-sm text-gray-600 border-b border-dashed border-gray-100 pb-2 last:border-0">
                            <div className="flex justify-between">
                                <span className={isCanceladaRecibo ? 'line-through text-gray-400' : ''}><b className="text-gray-800">{i.quantity}x</b> {i.name}</span>
                                <span className={`font-mono ${isCanceladaRecibo ? 'line-through text-gray-400' : ''}`}>{formatarMoeda(i.price * i.quantity)}</span>
                            </div>
                            {i.observacao && <span className="text-xs text-gray-400 italic mt-0.5">Obs: {i.observacao}</span>}
                        </div>
                    ))}
                </div>
                <div className="flex justify-between text-xl font-black text-gray-800 mb-8 pt-4 border-t border-dashed border-gray-200">
                    <span>TOTAL</span>
                    <span className={isCanceladaRecibo ? 'line-through text-gray-400' : ''}>{formatarMoeda(dados.total)}</span>
                </div>

                <div className="grid gap-3 no-print">

                    {isCanceladaRecibo && (
                        <div className="bg-red-50 p-2 rounded-lg border border-red-200 text-center text-xs font-bold text-red-600 uppercase mb-2">
                            PEDIDO CANCELADO
                        </div>
                    )}

                    {/* LOG DE REJEIÇÃO */}
                    {(statusNfceRecibo === 'REJEITADA' || statusNfceRecibo === 'REJEITADO' || statusNfceRecibo === 'DENEGADO') && (
                        <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-xs text-red-600 mb-2">
                            <strong className="block mb-1">⚠️ Motivo da Rejeição:</strong>
                            {dados.fiscal.motivoRejeicao || dados.fiscal.mensagem || "Erro na Sefaz. Verifique os dados."}
                        </div>
                    )}

                    <div className="flex gap-2 mb-3">
                        {/* BOTÕES DE EMISSÃO OU PDF */}
                        {(statusNfceRecibo === 'AUTORIZADA' || statusNfceRecibo === 'CONCLUIDO') ? (
                            <button onClick={() => onBaixarPdf(dados)} className="flex-1 bg-blue-500 text-white p-3 rounded-xl font-bold shadow-lg hover:bg-blue-600 transition-all flex items-center justify-center gap-2">
                                📄 PDF
                            </button>
                        ) : (!isCanceladaRecibo && (
                            <button onClick={onEmitirNfce} disabled={nfceStatus === 'loading'} className={`w-full text-white p-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${nfceStatus === 'loading' ? 'bg-orange-400 cursor-wait' : 'bg-orange-500 hover:bg-orange-600'}`}>
                                {nfceStatus === 'loading' ? '⏳ Aguardando...' : '🧾 Emitir NFC-e'}
                            </button>
                        ))}

                        {/* XML NORMAL */}
                        {(statusNfceRecibo === 'AUTORIZADA' || statusNfceRecibo === 'CONCLUIDO') && (
                            <button onClick={() => onBaixarXml(dados)} className="flex-1 bg-purple-500 text-white p-3 rounded-xl font-bold shadow-lg hover:bg-purple-600 transition-all flex items-center justify-center gap-2">
                                {'</>'} XML
                            </button>
                        )}

                        {/* 🔥 NOVO BOTÃO WHATSAPP 🔥 */}
                        {(statusNfceRecibo === 'AUTORIZADA' || statusNfceRecibo === 'CONCLUIDO') && (
                            <button onClick={() => onEnviarWhatsApp(dados)} className="flex-1 bg-green-500 text-white p-3 rounded-xl font-bold shadow-lg hover:bg-green-600 transition-all flex items-center justify-center gap-2" title="Enviar Nota via WhatsApp">
                                📱 Whats
                            </button>
                        )}
                    </div>

                    {/* 🔥 XML DE CANCELAMENTO SE ESTIVER CANCELADA 🔥 */}
                    {isCanceladaRecibo && temIdRecibo && (
                        <button
                            // Como onBaixarXmlCancelamento pode não ter sido passado em todas as props, faz fallback para o onBaixarXml
                            onClick={() => typeof onBaixarXmlCancelamento === 'function' ? onBaixarXmlCancelamento(dados) : onBaixarXml(dados)}
                            className="w-full bg-gray-100 text-gray-700 border border-gray-200 p-3 rounded-xl font-bold hover:bg-gray-200 transition-all flex justify-center items-center gap-2 mb-3"
                        >
                            {'</>'} Baixar XML de Cancelamento
                        </button>
                    )}

                    <div className="flex gap-3">
                        <button onClick={() => window.print()} className="flex-1 border-2 border-gray-100 p-3 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-all">Imprimir</button>
                        <button onClick={onClose} className="flex-1 bg-emerald-600 text-white p-3 rounded-xl font-bold hover:bg-emerald-700 shadow-lg transition-all">Próximo</button>
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-2">Pressione <b className="font-bold border border-gray-300 rounded px-1">ESC</b> para sair</p>
                </div>
            </div>
        </div>
    );
};

export const ModalHistorico = ({ visivel, onClose, vendas, onSelecionarVenda, carregando, titulo, onProcessarLote, onCancelarNfce, onBaixarXml, onConsultarStatus, onBaixarPdf, onBaixarXmlCancelamento, onEnviarWhatsApp }) => {
    const [filtro, setFiltro] = useState('todas');
    const [buscaHistorico, setBuscaHistorico] = useState('');
    const [processandoLote, setProcessandoLote] = useState(false);
    const [agora, setAgora] = useState(new Date());

    useEffect(() => {
        if (visivel) {
            setAgora(new Date());
            setBuscaHistorico('');
        }
    }, [visivel]);

    if (!visivel) return null;

    const vendasFiltradas = vendas.filter(v => {
        if (filtro !== 'todas') {
            const statusNfce = v.fiscal?.status?.toUpperCase();
            if (filtro === 'rejeitadas' && !(statusNfce === 'REJEITADA' || statusNfce === 'REJEITADO' || statusNfce === 'DENEGADO' || statusNfce === 'ERRO' || statusNfce === 'ERROR')) return false;
            if (filtro === 'recibo' && (v.fiscal && (statusNfce === 'AUTORIZADA' || statusNfce === 'CONCLUIDO' || statusNfce === 'REJEITADA' || statusNfce === 'ERRO' || statusNfce === 'CANCELADA'))) return false;
        }

        if (buscaHistorico.trim() !== '') {
            const termoBusca = buscaHistorico.toLowerCase().trim();
            const idVenda = v.id ? v.id.toLowerCase() : '';
            const cpfVenda = v.clienteCpf ? v.clienteCpf.replace(/\D/g, '') : '';
            const termoNumerico = termoBusca.replace(/\D/g, '');

            const matchId = idVenda.includes(termoBusca);
            const matchCpf = termoNumerico !== '' && cpfVenda.includes(termoNumerico);

            if (!matchId && !matchCpf) return false;
        }
        return true;
    });

    const handleProcessar = async () => {
        setProcessandoLote(true);
        await onProcessarLote(vendasFiltradas);
        setProcessandoLote(false);
    };

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200 no-print">
            <div className="bg-slate-50 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                
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
                        {/* Botões de Filtro com Padding Correto (sem cortar) */}
                        <div className="flex bg-slate-100 p-1.5 rounded-xl w-full lg:w-auto overflow-x-auto scrollbar-hide">
                            <button onClick={() => setFiltro('todas')} className={`px-4 py-2 rounded-lg font-bold text-[11px] uppercase tracking-wide whitespace-nowrap transition-all leading-normal ${filtro === 'todas' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Todas</button>
                            <button onClick={() => setFiltro('rejeitadas')} className={`px-4 py-2 rounded-lg font-bold text-[11px] uppercase tracking-wide whitespace-nowrap transition-all leading-normal ${filtro === 'rejeitadas' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-red-500'}`}>NFC-e Rejeitadas</button>
                            <button onClick={() => setFiltro('recibo')} className={`px-4 py-2 rounded-lg font-bold text-[11px] uppercase tracking-wide whitespace-nowrap transition-all leading-normal ${filtro === 'recibo' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-blue-500'}`}>Apenas Recibo</button>
                        </div>

                        {/* Barra de Busca */}
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

                                // BADGES COM PADDING E LEADING NORMAL PARA NÃO CORTAR
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

export const ModalListaTurnos = ({ visivel, onClose, turnos, carregando, onVerVendas }) => {
    if (!visivel) return null;

    // Ordenar para mostrar os mais recentes primeiro
    const turnosOrdenados = [...(turnos || [])].sort((a, b) => {
        const dataA = a.dataAbertura?.toDate ? a.dataAbertura.toDate() : new Date(a.dataAbertura);
        const dataB = b.dataAbertura?.toDate ? b.dataAbertura.toDate() : new Date(b.dataAbertura);
        return dataB - dataA;
    });

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
            <div className="bg-slate-50 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
                
                {/* HEADER */}
                <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl shadow-inner">
                            <IoTimeOutline size={26} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 leading-none">Histórico de Turnos</h2>
                            <p className="text-xs text-slate-500 font-medium mt-1">Selecione um turno para visualizar as vendas ou imprimir o resumo</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 bg-slate-100 hover:bg-red-50 hover:text-red-500 rounded-xl transition-colors">
                        <IoClose size={24} />
                    </button>
                </div>

                {/* CORPO / LISTA */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 pdv-scroll">
                    {carregando ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-4">
                            <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-emerald-600"></div>
                            <span className="text-sm font-bold text-slate-500">Buscando turnos no sistema...</span>
                        </div>
                    ) : turnosOrdenados.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 bg-white border border-slate-200 border-dashed rounded-2xl text-slate-400">
                            <IoTimeOutline size={56} className="mb-3 text-slate-300" />
                            <p className="font-bold text-sm">Nenhum turno registrado.</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {turnosOrdenados.map((turno, idx) => {
                                const isOpen = turno.status !== 'fechado';
                                const dAbertura = turno.dataAbertura?.toDate ? turno.dataAbertura.toDate() : new Date(turno.dataAbertura);
                                const dFechamento = turno.dataFechamento ? (turno.dataFechamento?.toDate ? turno.dataFechamento.toDate() : new Date(turno.dataFechamento)) : null;

                                return (
                                    <div key={turno.id || idx} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center hover:shadow-md hover:border-emerald-300 transition-all group">
                                        
                                        <div className="flex items-center gap-4 flex-1">
                                            {/* Ícone de Status */}
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border-4 ${isOpen ? 'bg-emerald-100 text-emerald-600 border-emerald-50' : 'bg-slate-100 text-slate-500 border-slate-50'}`}>
                                                {isOpen ? <IoCheckmarkCircleOutline size={24} /> : <IoStorefrontOutline size={24} />}
                                            </div>

                                            {/* Informações de Data */}
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded shadow-sm leading-normal ${isOpen ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                                        {isOpen ? '🟢 Em Andamento' : '🔒 Encerrado'}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400 font-mono leading-normal">ID: {turno.id?.slice(-6).toUpperCase() || 'N/A'}</span>
                                                </div>
                                                
                                                <div className="text-sm font-bold text-slate-700 leading-tight truncate">
                                                    <span className="text-slate-400 font-medium mr-1">Abertura:</span> 
                                                    {formatarData(dAbertura)} {formatarHora(dAbertura)}
                                                </div>
                                                
                                                {dFechamento && (
                                                    <div className="text-xs text-slate-500 font-medium mt-0.5 truncate">
                                                        <span className="mr-1">Fechamento:</span> 
                                                        {formatarData(dFechamento)} {formatarHora(dFechamento)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Valores e Botões de Ação */}
                                        <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-3 pl-16 md:pl-0 border-t md:border-t-0 border-slate-100 pt-3 md:pt-0">
                                            
                                            <div className="text-left md:text-right shrink-0 hidden sm:block mr-2">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">Saldo Inicial</p>
                                                <p className="font-black text-slate-800 text-[14px] leading-tight">{formatarMoeda(turno.saldoInicial || 0)}</p>
                                            </div>
                                            
                                            <div className="flex gap-2 w-full sm:w-auto">
                                                {/* NOVO BOTÃO DE RECIBO DO TURNO */}
                                                <button 
                                                    onClick={() => {
                                                        // Dispara o evento que o PdvScreen já está escutando para abrir o modal de Resumo!
                                                        document.dispatchEvent(new CustomEvent('abrirRelatorioTurno', { detail: turno }));
                                                    }}
                                                    className="flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-2.5 rounded-lg text-xs font-black flex justify-center items-center gap-1.5 transition-all shadow-sm leading-normal"
                                                    title="Imprimir Relatório do Turno"
                                                >
                                                    🖨️ RECIBO
                                                </button>

                                                <button 
                                                    onClick={() => onVerVendas(turno)}
                                                    className="flex-1 sm:flex-none bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 hover:border-emerald-600 px-3 py-2.5 rounded-lg text-xs font-black flex justify-center items-center gap-1.5 transition-all shadow-sm leading-normal"
                                                >
                                                    VER VENDAS
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
                            // Removido o bg-slate-100 para deixar o bloco do total com o mesmo fundo branco
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
                    <button onClick={() => window.print()} className="w-full border border-slate-300 text-slate-700 bg-slate-50 p-3 rounded-xl font-bold hover:bg-slate-100 transition-all flex justify-center items-center gap-2">
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

export const ModalVendasSuspensas = ({ visivel, onClose, vendas, onRestaurar, onExcluir }) => {
    if (!visivel) return null;
    return (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-[9500] p-4 backdrop-blur-sm no-print">
            <div className="bg-white border border-gray-200 rounded-[2rem] shadow-2xl max-w-3xl w-full h-[70vh] flex flex-col overflow-hidden animate-slideUp">
                <div className="bg-white p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">⏸️ Vendas em Espera</h2>
                    <button onClick={onClose} className="bg-gray-100 p-2 rounded-full hover:bg-gray-200 text-gray-500">✕</button>
                </div>
                <div className="flex-1 overflow-auto p-6 bg-gray-50 custom-scrollbar">
                    {vendas.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-70">
                            <span className="text-5xl mb-4">💤</span>
                            <p className="font-bold text-lg">Nenhuma venda em espera no momento.</p>
                            <p className="text-sm">Use o botão PAUSAR (F4) no carrinho.</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {vendas.map(v => (
                                <div key={v.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center hover:border-blue-200 transition-colors">
                                    <div>
                                        <p className="font-bold text-gray-800 text-lg">{v.nomeReferencia}</p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Guardada às {formatarHora(v.dataSuspensao)} • {v.itens.length} iten(s)
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-black text-xl text-gray-800">{formatarMoeda(v.total)}</span>
                                        <div className="flex gap-2">
                                            <button onClick={() => onRestaurar(v)} className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-5 py-2 rounded-xl font-bold transition-all text-sm shadow-sm">Restaurar</button>
                                            <button onClick={() => onExcluir(v.id)} className="bg-red-50 text-red-500 hover:bg-red-100 w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-colors shadow-sm" title="Descartar Venda">✕</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const ModalPesoBalanca = ({ visivel, produto, onClose, onConfirm }) => {
    const [peso, setPeso] = useState('');
    const [lendo, setLendo] = useState(false);
    const [erro, setErro] = useState('');

    const conectarElerPorta = async (port) => {
        try {
            setLendo(true);
            setErro('');
            await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' });
            const reader = port.readable.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            const timeout = setTimeout(() => { reader.cancel(); }, 2000);

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const matches = buffer.match(/\d+\.\d+|\d+\,\d+/g);
                if (matches) {
                    const pesoLido = matches[matches.length - 1].replace(',', '.');
                    if (parseFloat(pesoLido) > 0) {
                        setPeso(pesoLido);
                        clearTimeout(timeout);
                        reader.cancel();
                        break;
                    }
                }
            }
            await port.close();
        } catch (error) {
            console.error("Erro ao ler porta:", error);
            setErro("Falha na leitura. Tente novamente.");
            try { await port.close(); } catch (e) { }
        } finally {
            setLendo(false);
        }
    };

    useEffect(() => {
        if (visivel) {
            setPeso('');
            setErro('');
            const autoRead = async () => {
                if ('serial' in navigator) {
                    try {
                        const ports = await navigator.serial.getPorts();
                        if (ports.length > 0) {
                            await conectarElerPorta(ports[0]);
                        }
                    } catch (e) {
                        console.log("Auto-leitura falhou", e);
                    }
                }
            };
            autoRead();
        }
    }, [visivel]);

    const solicitarPermissaoEler = async () => {
        if (!('serial' in navigator)) {
            setErro("Navegador incompatível. Use o Google Chrome no PC.");
            return;
        }
        try {
            const port = await navigator.serial.requestPort();
            await conectarElerPorta(port);
        } catch (error) {
            console.log("Usuário cancelou a seleção da porta.");
        }
    };

    if (!visivel || !produto) return null;

    const precoKg = parseFloat(produto.price || 0);
    const pesoNum = parseFloat(peso.replace(',', '.') || 0);
    const totalCalculado = precoKg * pesoNum;

    return (
        <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-[9600] p-4 backdrop-blur-sm animate-fadeIn no-print">
            <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl transform animate-slideUp relative">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                    <div>
                        <h3 className="font-black text-2xl text-gray-800">{produto.name}</h3>
                        <p className="text-gray-500 text-sm">{formatarMoeda(precoKg)} / Kg</p>
                    </div>
                    <button onClick={onClose} className="bg-gray-100 p-2 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
                </div>

                {lendo ? (
                    <div className="w-full mb-6 bg-amber-50 text-amber-600 border-2 border-amber-200 p-4 rounded-2xl font-bold flex items-center justify-center gap-3 animate-pulse">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-amber-600 border-t-transparent"></div>
                        Aguardando balança...
                    </div>
                ) : (
                    <button onClick={solicitarPermissaoEler} className="w-full mb-6 bg-blue-50 text-blue-600 border-2 border-blue-200 p-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-blue-100 transition-all shadow-sm active:scale-95">
                        <span className="text-2xl">⚖️</span> Ler Balança Manualmente
                    </button>
                )}

                {erro && <p className="text-red-500 text-xs text-center font-bold mb-4 -mt-4">{erro}</p>}

                <div className="mb-6 relative group">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Peso Lido (Kg)</label>
                    <span className="absolute left-4 top-[38px] text-gray-400 text-xl font-bold group-focus-within:text-emerald-600 transition-colors">Kg</span>
                    <input type="number" step="0.005" className="w-full p-4 pl-12 bg-gray-50 border-2 border-gray-200 rounded-2xl text-3xl font-black text-gray-800 focus:border-emerald-500 focus:bg-white outline-none transition-all placeholder-gray-300" placeholder="0.000" autoFocus value={peso} onChange={(e) => setPeso(e.target.value)} />
                </div>

                <div className="bg-emerald-50 p-4 rounded-xl mb-6 text-center border border-emerald-100">
                    <p className="text-xs font-bold uppercase text-emerald-600/70 tracking-wider mb-1">Total a Pagar</p>
                    <p className="text-4xl font-black text-emerald-600">{formatarMoeda(totalCalculado)}</p>
                </div>

                <button onClick={() => onConfirm(produto, pesoNum, totalCalculado)} disabled={pesoNum <= 0 || lendo} className="w-full bg-emerald-600 text-white p-5 rounded-2xl font-black text-xl hover:bg-emerald-700 transition-all shadow-lg disabled:opacity-50 disabled:shadow-none">
                    ADICIONAR
                </button>
            </div>
        </div>
    );
};