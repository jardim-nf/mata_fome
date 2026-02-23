// src/pages/admin/PdvScreen.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { vendaService } from '../../services/vendaService';
import { caixaService } from '../../services/caixaService';
import { db } from '../../firebase';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';

// --- FUNÇÕES AUXILIARES ---
const formatarHora = (data) => {
    if (!data) return '--:--';
    if (data.toDate) return data.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (data instanceof Date) return data.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return '--:--';
};

const formatarData = (data) => {
    if (!data) return '-';
    if (data.toDate) return data.toDate().toLocaleDateString('pt-BR');
    if (data instanceof Date) return data.toLocaleDateString('pt-BR');
    return '-';
};

const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
};

// --- MODAIS ---

// 🆕 NOVO: Modal para Observações e Quantidade Rápida
const ModalEdicaoItemCarrinho = ({ visivel, item, onClose, onConfirm }) => {
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

const ModalSelecaoVariacao = ({ produto, onClose, onConfirm }) => {
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

const ModalAberturaCaixa = ({ visivel, onAbrir, usuarioNome }) => {
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

const ModalFechamentoCaixa = ({ visivel, caixa, vendasDoDia, movimentacoes, onClose, onConfirmarFechamento }) => {
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

    const tSup = movimentacoes?.totalSuprimento || 0; const tSan = movimentacoes?.totalSangria || 0;
    const esp = parseFloat(caixa.saldoInicial || 0) + tDin + tSup - tSan; const dif = parseFloat(valorInformado || 0) - esp;

    return (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm animate-fadeIn no-print">
            <div className="bg-white p-8 rounded-[2rem] w-full max-w-md shadow-2xl transform animate-slideUp">
                <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Fechar Turno</h2>
                        <p className="text-xs text-gray-500 mt-1">Aberto em: <b>{formatarData(da)} às {formatarHora(da)}</b></p>
                    </div>
                    <button onClick={onClose} className="bg-gray-100 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200">✕</button>
                </div>
                <div className="bg-gray-50 p-6 rounded-2xl mb-6 text-center border border-gray-100">
                    <p className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-1">ESPERADO (DINHEIRO NA GAVETA)</p>
                    <p className="text-4xl font-black text-gray-800">{formatarMoeda(esp)}</p>
                </div>
                <div className="mb-6">
                    <label className="block text-sm font-bold text-gray-500 mb-2">Valor Físico na Gaveta</label>
                    <input type="number" step="0.01" className={`w-full p-4 border-2 rounded-2xl text-2xl font-bold text-center outline-none transition-colors ${Math.abs(dif) > 0.05 ? 'border-red-200 bg-red-50 text-red-600' : 'border-emerald-200 bg-emerald-50 text-emerald-600'}`} placeholder="0,00" autoFocus onChange={e => setValorInformado(e.target.value)} value={valorInformado} />
                </div>
                <button onClick={() => onConfirmarFechamento({ saldoFinalInformado: parseFloat(valorInformado || 0), diferenca: dif, resumoVendas: { dinheiro: tDin, outros: tOut, suprimento: tSup, sangria: tSan, total: tDin + tOut, qtd: vt.length } })} className="w-full bg-gray-900 text-white p-4 rounded-2xl font-bold text-lg hover:bg-black transition-all shadow-xl">FINALIZAR TURNO</button>
            </div>
        </div>
    );
};

const ModalMovimentacao = ({ visivel, onClose, onConfirmar }) => {
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

const ModalFinalizacao = ({
    visivel, venda, onClose, onFinalizar, salvando,
    pagamentos, setPagamentos,
    cpfNota, setCpfNota,
    desconto, setDesconto, acrescimo, setAcrescimo
}) => {
    const [formaAtual, setFormaAtual] = useState('dinheiro');
    const [valorInput, setValorInput] = useState('');

    useEffect(() => { 
        if (visivel) { 
            setFormaAtual('dinheiro'); 
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
                                    <button key={f} onClick={() => setFormaAtual(f)}
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

const ModalRecibo = ({ visivel, dados, onClose, onNovaVenda, onEmitirNfce, nfceStatus, nfceUrl }) => {
    if (!visivel) return null;
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
                                <span><b className="text-gray-800">{i.quantity}x</b> {i.name}</span>
                                <span className="font-mono">{formatarMoeda(i.price * i.quantity)}</span>
                            </div>
                            {i.observacao && <span className="text-xs text-gray-400 italic mt-0.5">Obs: {i.observacao}</span>}
                        </div>
                    ))}
                </div>
                <div className="flex justify-between text-xl font-black text-gray-800 mb-8 pt-4 border-t border-dashed border-gray-200"><span>TOTAL</span><span>{formatarMoeda(dados.total)}</span></div>
                <div className="grid gap-3 no-print">
                    <button onClick={onEmitirNfce} disabled={nfceStatus === 'loading'} className="w-full bg-orange-500 text-white p-3 rounded-xl font-bold shadow-lg hover:bg-orange-600 transition-all">{nfceStatus === 'loading' ? 'Processando...' : nfceUrl ? '📄 Visualizar Nota' : '🧾 Emitir NFC-e'}</button>
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

const ModalHistorico = ({ visivel, onClose, vendas, onSelecionarVenda, carregando, titulo, onProcessarLote, onCancelarNfce }) => {
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
            const isCancelada = v.status === 'cancelada' || statusNfce === 'CANCELADA';
            
            if (filtro === 'rejeitadas' && !(statusNfce === 'REJEITADA' || statusNfce === 'ERRO' || statusNfce === 'ERROR')) return false;
            if (filtro === 'recibo' && (v.fiscal && (statusNfce === 'AUTORIZADA' || statusNfce === 'REJEITADA' || statusNfce === 'ERRO' || statusNfce === 'CANCELADA'))) return false;
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
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-[9300] p-4 backdrop-blur-sm no-print">
            <div className="bg-white border border-gray-200 rounded-[2rem] shadow-2xl max-w-4xl w-full h-[85vh] flex flex-col overflow-hidden animate-slideUp">
                <div className="bg-white p-6 border-b border-gray-100 flex flex-col gap-4">
                    <div className="flex justify-between items-center flex-col sm:flex-row gap-4">
                        <h2 className="text-2xl font-bold text-gray-800">{titulo || "Histórico"}</h2>
                        <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto scrollbar-hide">
                            <button onClick={() => setFiltro('todas')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition ${filtro === 'todas' ? 'bg-white text-gray-800 shadow' : 'text-gray-500 hover:text-gray-700'}`}>Todas</button>
                            <button onClick={() => setFiltro('rejeitadas')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition ${filtro === 'rejeitadas' ? 'bg-white text-red-500 shadow' : 'text-gray-500 hover:text-red-400'}`}>NFC-e Rejeitadas</button>
                            <button onClick={() => setFiltro('recibo')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition ${filtro === 'recibo' ? 'bg-white text-blue-500 shadow' : 'text-gray-500 hover:text-blue-400'}`}>Apenas Recibo</button>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                            {filtro === 'rejeitadas' && vendasFiltradas.length > 0 && (
                                <button onClick={handleProcessar} disabled={processandoLote} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap">
                                    {processandoLote ? '⏳ Emitindo...' : '🔄 Processar Lote'}
                                </button>
                            )}
                            <button onClick={onClose} className="bg-gray-100 p-2 rounded-full hover:bg-gray-200 text-gray-500 hidden sm:block transition-colors">✕</button>
                        </div>
                    </div>
                    <div className="relative w-full group">
                        <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-400 group-focus-within:text-emerald-500 transition-colors">🔍</span>
                        <input type="text" placeholder="Buscar por Nº do Pedido ou CPF do Cliente..." className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 outline-none focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-50 transition-all placeholder-gray-400" value={buscaHistorico} onChange={(e) => setBuscaHistorico(e.target.value)} autoFocus />
                        {buscaHistorico && (
                            <button onClick={() => setBuscaHistorico('')} className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-red-500 transition-colors">✕</button>
                        )}
                    </div>
                </div>
                <div className="flex-1 overflow-auto p-6 bg-gray-50 custom-scrollbar">
                    {vendasFiltradas.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-70">
                            <span className="text-5xl mb-4">📭</span>
                            <p className="font-bold">{buscaHistorico ? "Nenhum resultado encontrado para a busca." : "Nenhuma venda encontrada para este filtro."}</p>
                        </div>
                    ) : (
                        vendasFiltradas.map(v => {
                            const statusNfce = v.fiscal?.status?.toUpperCase();
                            const isCancelada = v.status === 'cancelada' || statusNfce === 'CANCELADA';
                            let tagNfce = null;
                            
                            const dataVenda = v.createdAt?.toDate ? v.createdAt.toDate() : new Date(v.createdAt);
                            const minutosPassados = (agora - dataVenda) / (1000 * 60);
                            
                            const podeCancelar = !isCancelada && (statusNfce !== 'AUTORIZADA' || minutosPassados <= 30);

                            if (isCancelada) tagNfce = <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold border border-gray-300">CANCELADA</span>;
                            else if (statusNfce === 'AUTORIZADA') tagNfce = <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-200">AUTORIZADA</span>;
                            else if (statusNfce === 'REJEITADA' || statusNfce === 'ERRO') tagNfce = <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold border border-red-200">REJEITADA</span>;
                            else tagNfce = <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-200">RECIBO (MEI)</span>;

                            return (
                                <div key={v.id} className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm mb-3 border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all group">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <span className={`font-bold text-lg transition-colors ${isCancelada ? 'text-gray-400 line-through' : 'text-gray-800 group-hover:text-emerald-600'}`}>#{v.id.slice(-4)}</span>
                                            {tagNfce}
                                            {v.clienteCpf && <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[10px] font-bold">CPF: {v.clienteCpf}</span>}
                                        </div>
                                        <div className="flex gap-2 text-sm text-gray-400 mt-1">
                                            <span>{formatarHora(v.createdAt)}</span><span>•</span><span className="uppercase text-emerald-600">{v.formaPagamento}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 sm:gap-6">
                                        <span className={`font-bold text-xl hidden sm:block ${isCancelada ? 'text-gray-400' : 'text-gray-800'}`}>{formatarMoeda(v.total)}</span>
                                        {podeCancelar && (
                                            <button onClick={() => onCancelarNfce(v)} className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-xl font-bold hover:bg-red-100 transition-colors text-sm">
                                                {statusNfce === 'AUTORIZADA' ? 'Cancelar NFC-e' : 'Cancelar Venda'}
                                            </button>
                                        )}
                                        <button onClick={() => onSelecionarVenda(v)} className="bg-gray-100 text-gray-600 px-5 py-2 rounded-xl font-bold hover:bg-gray-200 transition-colors text-sm">Detalhes</button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

const ModalListaTurnos = ({ visivel, onClose, turnos, carregando, onVerVendas, vendasDoDia }) => {
    if (!visivel) return null;
    return (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-[9200] p-4 backdrop-blur-sm no-print">
            <div className="bg-white border border-gray-200 rounded-[2rem] shadow-2xl max-w-5xl w-full h-[80vh] flex flex-col overflow-hidden">
                <div className="bg-white p-6 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800">Meus Turnos</h2>
                    <button onClick={onClose} className="bg-gray-100 p-2 rounded-full hover:bg-gray-200 text-gray-500">✕</button>
                </div>
                <div className="flex-1 overflow-auto p-8 bg-gray-50 custom-scrollbar">
                    <div className="space-y-3">
                        {turnos.map(t => {
                            let totalVendido = 0;
                            if (t.status === 'aberto' && vendasDoDia) {
                                totalVendido = vendasDoDia.reduce((acc, v) => {
                                    if (v.status === 'cancelada' || v.fiscal?.status === 'CANCELADA') return acc;
                                    return acc + (v.total || 0);
                                }, 0);
                            } else {
                                totalVendido = t.resumoVendas?.total || 0;
                            }

                            return (
                                <div key={t.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center hover:border-emerald-200 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-3 h-3 rounded-full ${t.status === 'aberto' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                                        <div>
                                            <p className="font-bold text-gray-800">Data: {formatarData(t.dataAbertura)}</p>
                                            <div className="text-xs text-gray-500 mt-1 flex flex-col gap-0.5">
                                                <span>🟢 Início: {formatarData(t.dataAbertura)} às {formatarHora(t.dataAbertura)}</span>
                                                <span>🔴 Fim: {t.dataFechamento ? `${formatarData(t.dataFechamento)} às ${formatarHora(t.dataFechamento)}` : <b className="text-emerald-500 uppercase">Em andamento</b>}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-xs text-gray-400 font-bold uppercase">Total Vendido</p>
                                            <p className="text-xl font-black text-gray-800">{formatarMoeda(totalVendido)}</p>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <button onClick={() => onVerVendas(t)} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg font-bold transition-all border border-gray-200 text-xs">Ver Vendas</button>
                                            {t.status === 'fechado' && (
                                                <button onClick={() => {
                                                    document.dispatchEvent(new CustomEvent('abrirRelatorioTurno', { detail: t }));
                                                }} className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-2 rounded-lg font-bold transition-all border border-emerald-200 text-xs">📄 Relatório</button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ModalResumoTurno = ({ visivel, turno, onClose }) => {
    if (!visivel || !turno) return null;

    const res = turno.resumoVendas || {};
    const saldoInicial = parseFloat(turno.saldoInicial || 0);
    const vendasTotal = parseFloat(res.total || 0);
    const vendasDinheiro = parseFloat(res.dinheiro || 0);
    const vendasOutros = parseFloat(res.outros || 0);
    const suprimento = parseFloat(res.suprimento || 0);
    const sangria = parseFloat(res.sangria || 0);
    const esperado = saldoInicial + vendasDinheiro + suprimento - sangria;
    const informado = parseFloat(turno.saldoFinalInformado || 0);
    const diferenca = parseFloat(turno.diferenca || 0);

    return (
        <div id="resumo-turno-overlay" className="fixed inset-0 bg-gray-900/60 flex items-center justify-center z-[9600] p-4 backdrop-blur-sm">
            <div id="resumo-turno-content" className="bg-white w-full max-w-sm p-8 rounded-3xl shadow-2xl relative animate-slideUp">
                <button onClick={onClose} className="absolute top-4 right-4 bg-gray-100 hover:bg-red-100 hover:text-red-500 p-2 rounded-full transition-colors no-print">✕</button>
                
                <div className="text-center border-b border-dashed border-gray-200 pb-4 mb-4">
                    <h2 className="font-black text-2xl text-gray-800 uppercase tracking-wide">FECHO DE CAIXA</h2>
                    <p className="text-gray-500 text-xs font-mono mt-1">Turno: {turno.id?.slice(-6).toUpperCase()}</p>
                </div>

                <div className="space-y-4 mb-6 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2 print:max-h-none print:overflow-visible text-sm text-gray-600">
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between"><span>Abertura:</span> <b>{formatarData(turno.dataAbertura)} {formatarHora(turno.dataAbertura)}</b></div>
                        <div className="flex justify-between"><span>Fecho:</span> <b>{turno.dataFechamento ? `${formatarData(turno.dataFechamento)} ${formatarHora(turno.dataFechamento)}` : 'AGORA'}</b></div>
                    </div>

                    <div className="border-t border-dashed border-gray-200 pt-3 flex flex-col gap-1">
                        <div className="flex justify-between text-gray-800"><span>Saldo Inicial (Fundo):</span> <b>{formatarMoeda(saldoInicial)}</b></div>
                    </div>

                    <div className="border-t border-dashed border-gray-200 pt-3 flex flex-col gap-1">
                        <div className="flex justify-between"><span>Vendas em Dinheiro:</span> <b>{formatarMoeda(vendasDinheiro)}</b></div>
                        <div className="flex justify-between"><span>Vendas Outros (Cartão/Pix):</span> <b>{formatarMoeda(vendasOutros)}</b></div>
                        <div className="flex justify-between font-bold text-gray-800 mt-1"><span>Total Faturado:</span> <span>{formatarMoeda(vendasTotal)}</span></div>
                    </div>

                    <div className="border-t border-dashed border-gray-200 pt-3 flex flex-col gap-1">
                        <div className="flex justify-between text-emerald-600"><span>Suprimentos (+):</span> <b>{formatarMoeda(suprimento)}</b></div>
                        <div className="flex justify-between text-red-500"><span>Sangrias (-):</span> <b>{formatarMoeda(sangria)}</b></div>
                    </div>

                    <div className="border-t border-dashed border-gray-200 pt-3 bg-gray-50 p-3 rounded-xl mt-2">
                        <div className="flex justify-between text-xs uppercase font-bold text-gray-500 mb-1"><span>Dinheiro Esperado:</span> <span>{formatarMoeda(esperado)}</span></div>
                        <div className="flex justify-between text-xs uppercase font-bold text-gray-500 mb-2"><span>Dinheiro Informado:</span> <span>{formatarMoeda(informado)}</span></div>
                        <div className={`flex justify-between text-lg font-black ${diferenca < 0 ? 'text-red-500' : diferenca > 0 ? 'text-emerald-500' : 'text-gray-800'}`}>
                            <span>{diferenca < 0 ? 'QUEBRA DE CAIXA:' : diferenca > 0 ? 'SOBRA DE CAIXA:' : 'DIFERENÇA:'}</span>
                            <span>{formatarMoeda(diferenca)}</span>
                        </div>
                    </div>
                </div>

                <div className="grid gap-3 no-print">
                    <button onClick={() => window.print()} className="w-full border-2 border-gray-200 p-3 rounded-xl font-bold text-gray-700 hover:bg-gray-50 transition-all flex justify-center items-center gap-2">
                        🖨️ Imprimir Fechamento
                    </button>
                    <button onClick={onClose} className="w-full bg-emerald-600 text-white p-3 rounded-xl font-bold hover:bg-emerald-700 shadow-lg transition-all">
                        Concluir
                    </button>
                </div>
            </div>
        </div>
    );
};

const ModalVendasSuspensas = ({ visivel, onClose, vendas, onRestaurar, onExcluir }) => {
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

// --- COMPONENTE PRINCIPAL ---

const PdvScreen = () => {
    const { userData, currentUser } = useAuth();
    const navigate = useNavigate();

    // Estados
    const [estabelecimentos, setEstabelecimentos] = useState([]);
    const [estabelecimentoAtivo, setEstabelecimentoAtivo] = useState(null);
    const [nomeLoja, setNomeLoja] = useState('...');
    const [vendaAtual, setVendaAtual] = useState(null);
    const [produtos, setProdutos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [vendasBase, setVendasBase] = useState([]);
    const [vendasHistoricoExibicao, setVendasHistoricoExibicao] = useState([]);
    const [tituloHistorico, setTituloHistorico] = useState("Histórico");
    const [listaTurnos, setListaTurnos] = useState([]);
    const [carregandoProdutos, setCarregandoProdutos] = useState(true);
    const [carregandoHistorico, setCarregandoHistorico] = useState(false);
    const [categoriaAtiva, setCategoriaAtiva] = useState('todos');
    const [busca, setBusca] = useState('');

    // Modais
    const [caixaAberto, setCaixaAberto] = useState(null);
    const [verificandoCaixa, setVerificandoCaixa] = useState(true);
    const [mostrarAberturaCaixa, setMostrarAberturaCaixa] = useState(false);
    const [mostrarFechamentoCaixa, setMostrarFechamentoCaixa] = useState(false);
    const [mostrarMovimentacao, setMostrarMovimentacao] = useState(false);
    const [movimentacoesDoTurno, setMovimentacoesDoTurno] = useState({ totalSuprimento: 0, totalSangria: 0 });
    const [mostrarHistorico, setMostrarHistorico] = useState(false);
    const [mostrarListaTurnos, setMostrarListaTurnos] = useState(false);
    const [mostrarFinalizacao, setMostrarFinalizacao] = useState(false);
    const [mostrarRecibo, setMostrarRecibo] = useState(false);
    const [mostrarResumoTurno, setMostrarResumoTurno] = useState(false);
    const [turnoSelecionadoResumo, setTurnoSelecionadoResumo] = useState(null);
    const [itemParaEditar, setItemParaEditar] = useState(null); // 🆕 Novo estado para edição

    // Vendas em Espera
    const [vendasSuspensas, setVendasSuspensas] = useState([]);
    const [mostrarSuspensas, setMostrarSuspensas] = useState(false);

    // Pagamento
    const [dadosRecibo, setDadosRecibo] = useState(null);
    const [cpfNota, setCpfNota] = useState('');
    const [nfceStatus, setNfceStatus] = useState('idle');
    const [nfceUrl, setNfceUrl] = useState(null);
    const [produtoParaSelecao, setProdutoParaSelecao] = useState(null);
    const [pagamentosAdicionados, setPagamentosAdicionados] = useState([]);
    const [salvando, setSalvando] = useState(false);
    const [descontoValor, setDescontoValor] = useState('');
    const [acrescimoValor, setAcrescimoValor] = useState('');
    
    // Leitor de Código de Barras
    const [barcodeAviso, setBarcodeAviso] = useState(null);
    const bufferCodigoBarras = useRef('');
    const timeoutCodigoBarras = useRef(null);

    const inputBuscaRef = useRef(null);

// --- LÓGICA DE CARREGAMENTO ---
    useEffect(() => {
        if (!userData || !currentUser) return;
        
        const carregarLojas = async () => {
            let listaIds = [];
            
            if (userData.estabelecimentoId) {
                listaIds = [userData.estabelecimentoId];
            } else if (userData.estabelecimentosGerenciados && Array.isArray(userData.estabelecimentosGerenciados)) {
                listaIds = userData.estabelecimentosGerenciados;
            } else if (currentUser.uid) {
                listaIds = [currentUser.uid];
            }

            if (listaIds.length === 0) return;

            const promessas = listaIds.map(async (id) => {
                try { 
                    const docRef = doc(db, 'estabelecimentos', id); 
                    const docSnap = await getDoc(docRef); 
                    
                    // 👇 AQUI ESTÁ A MAGIA: Só retorna a loja se ela REALMENTE existir no Firebase
                    if (docSnap.exists()) {
                        return { 
                            id, 
                            nome: docSnap.data().nome || 'Loja Sem Nome' 
                        };
                    }
                    // Se não existir, retorna nulo para ignorar a loja "fantasma"
                    return null; 
                } catch (e) { 
                    return null; 
                }
            });

            // Remove todos os "null" (lojas apagadas) da lista
            let lojasCarregadas = (await Promise.all(promessas)).filter(loja => loja !== null);
            
            // 👇 TRAVA DE SEGURANÇA: Se a pessoa tem estabelecimentoId fixo, força apenas a 1ª loja
            if (userData.estabelecimentoId && lojasCarregadas.length > 0) {
                lojasCarregadas = [lojasCarregadas[0]];
            }

            setEstabelecimentos(lojasCarregadas);
            
            if (!estabelecimentoAtivo && lojasCarregadas.length > 0) { 
                setEstabelecimentoAtivo(lojasCarregadas[0].id); 
                setNomeLoja(lojasCarregadas[0].nome); 
            }
        };
        
        carregarLojas();
    }, [userData, currentUser]);
    const trocarLoja = (id) => { const loja = estabelecimentos.find(e => e.id === id); if (loja) { setEstabelecimentoAtivo(id); setNomeLoja(loja.nome); setCaixaAberto(null); setVendasBase([]); setProdutos([]); setVendasSuspensas([]); } };

    const vendasTurnoAtual = useMemo(() => {
        if (!caixaAberto) return [];
        let timeAbertura; try { timeAbertura = caixaAberto.dataAbertura?.toDate ? caixaAberto.dataAbertura.toDate().getTime() : new Date(caixaAberto.dataAbertura).getTime(); } catch { timeAbertura = Date.now(); }
        return vendasBase.filter(v => { let timeVenda; try { timeVenda = v.createdAt?.toDate ? v.createdAt.toDate().getTime() : new Date(v.createdAt).getTime(); } catch { return false; } return v.usuarioId === currentUser.uid && timeVenda >= (timeAbertura - 60000); });
    }, [vendasBase, caixaAberto, currentUser]);

    // --- FILTRO INTELIGENTE ---
    const produtosFiltrados = useMemo(() => {
        const termo = busca?.toLowerCase().trim() || "";
        return produtos.filter(p => {
            const matchCategoria = categoriaAtiva === 'todos' || p.categoria === categoriaAtiva || p.categoriaId === categoriaAtiva;
            if (!matchCategoria) return false;
            if (!termo) return true;
            const nome = p.name?.toLowerCase() || "";
            const codigo = p.codigoBarras ? String(p.codigoBarras).toLowerCase() : "";
            const id = p.id ? String(p.id).toLowerCase() : "";
            const referencia = p.referencia ? String(p.referencia).toLowerCase() : "";
            return nome.includes(termo) || codigo.includes(termo) || id.includes(termo) || referencia.includes(termo);
        });
    }, [produtos, categoriaAtiva, busca]);

    const iniciarVendaBalcao = useCallback(() => {
        if (!caixaAberto) return;
        setMostrarRecibo(false); setMostrarHistorico(false); setMostrarFinalizacao(false);
        setVendaAtual({ id: Date.now().toString(), itens: [], total: 0 });
        setCpfNota(''); setNfceStatus('idle'); setBusca('');

        setDescontoValor(''); setAcrescimoValor('');
        setPagamentosAdicionados([]);

        setTimeout(() => inputBuscaRef.current?.focus(), 100);
    }, [caixaAberto]);

    const suspenderVenda = useCallback(() => {
        if (!vendaAtual || vendaAtual.itens.length === 0) {
            alert("O carrinho está vazio!");
            return;
        }
        
        const nomeCliente = prompt("Nome para identificar este pedido em espera (Opcional):") || `Cliente ${vendasSuspensas.length + 1}`;
        if (nomeCliente === null) return; 
        
        const vendaSuspensa = {
            ...vendaAtual,
            nomeReferencia: nomeCliente,
            dataSuspensao: new Date(),
            descontoGuardado: descontoValor,
            acrescimoGuardado: acrescimoValor,
            pagamentosGuardados: pagamentosAdicionados
        };
        
        setVendasSuspensas(prev => [...prev, vendaSuspensa]);
        iniciarVendaBalcao(); 
    }, [vendaAtual, vendasSuspensas, iniciarVendaBalcao, descontoValor, acrescimoValor, pagamentosAdicionados]);

    const restaurarVendaSuspensa = (vendaSuspensa) => {
        if (vendaAtual && vendaAtual.itens.length > 0) {
            const conf = window.confirm("Atenção: O seu carrinho atual tem produtos. Deseja substituí-los pela venda em espera?\n\n(Dica: Cancele para suspender a atual primeiro)");
            if (!conf) return;
        }
        
        setVendaAtual({
            id: vendaSuspensa.id,
            itens: vendaSuspensa.itens,
            total: vendaSuspensa.total
        });

        setDescontoValor(vendaSuspensa.descontoGuardado || '');
        setAcrescimoValor(vendaSuspensa.acrescimoGuardado || '');
        setPagamentosAdicionados(vendaSuspensa.pagamentosGuardados || []);
        
        setVendasSuspensas(prev => prev.filter(v => v.id !== vendaSuspensa.id));
        setMostrarSuspensas(false);
        setTimeout(() => inputBuscaRef.current?.focus(), 100);
    };

    const excluirVendaSuspensa = (id) => {
        if(window.confirm("Tem a certeza que deseja excluir este pedido em espera? Os itens serão perdidos.")) {
            setVendasSuspensas(prev => prev.filter(v => v.id !== id));
        }
    };

    const abrirHistoricoAtual = useCallback(() => { setTituloHistorico("Vendas Turno Atual"); setVendasHistoricoExibicao(vendasTurnoAtual); setMostrarHistorico(prev => !prev); }, [vendasTurnoAtual]);
    const carregarListaTurnos = useCallback(async () => { if (!estabelecimentoAtivo) return; setCarregandoHistorico(true); setMostrarListaTurnos(true); const t = await caixaService.listarTurnos(currentUser.uid, estabelecimentoAtivo); setListaTurnos(t); setCarregandoHistorico(false); }, [currentUser, estabelecimentoAtivo]);
    const visualizarVendasTurno = useCallback(async (turno) => { setCarregandoHistorico(true); setTituloHistorico(`Vendas ${formatarData(turno.dataAbertura)}`); const v = await vendaService.buscarVendasPorIntervalo(currentUser.uid, estabelecimentoAtivo, turno.dataAbertura, turno.dataFechamento); setVendasHistoricoExibicao(v); setCarregandoHistorico(false); setMostrarListaTurnos(false); setMostrarHistorico(true); }, [currentUser, estabelecimentoAtivo]);
    const prepararFechamento = useCallback(async () => { if (!caixaAberto) return; const movs = await caixaService.buscarMovimentacoes(caixaAberto.id); setMovimentacoesDoTurno(movs); setMostrarFechamentoCaixa(true); }, [caixaAberto]);
    const abrirMovimentacao = useCallback(() => { if (!caixaAberto) return alert("Caixa Fechado!"); setMostrarMovimentacao(true); }, [caixaAberto]);
    const handleSalvarMovimentacao = async (dados) => { const res = await caixaService.adicionarMovimentacao(caixaAberto.id, { ...dados, usuarioId: currentUser.uid }); if (res.success) { alert(`Sucesso!`); setMostrarMovimentacao(false); } else { alert('Erro: ' + res.error); } };

    const handleConfirmarFechamento = async (dados) => { 
        const res = await caixaService.fecharCaixa(caixaAberto.id, dados); 
        if (res.success) { 
            const turnoFechadoParaRelatorio = {
                ...caixaAberto,
                resumoVendas: dados.resumoVendas,
                saldoFinalInformado: dados.saldoFinalInformado,
                diferenca: dados.diferenca,
                dataFechamento: new Date(),
                status: 'fechado'
            };

            alert('🔒 Turno encerrado!'); 
            
            setCaixaAberto(null); 
            setVendasBase([]); 
            setVendasSuspensas([]);
            setMostrarFechamentoCaixa(false); 
            setVendaAtual(null); 

            setTurnoSelecionadoResumo(turnoFechadoParaRelatorio);
            setMostrarResumoTurno(true);
        } else {
            alert('Erro ao fechar caixa: ' + res.error);
        }
    };

    const handleAbrirCaixa = async (saldoInicial) => {
        const checkAtivo = await caixaService.verificarCaixaAberto(currentUser.uid, estabelecimentoAtivo);
        if (checkAtivo) {
            alert('Atenção: Você já possui um turno em andamento!');
            setCaixaAberto(checkAtivo);
            setMostrarAberturaCaixa(false);
            return;
        }
        const res = await caixaService.abrirCaixa({ usuarioId: currentUser.uid, estabelecimentoId: estabelecimentoAtivo, saldoInicial });
        if (res.success) {
            const novoCaixa = await caixaService.verificarCaixaAberto(currentUser.uid, estabelecimentoAtivo);
            setCaixaAberto(novoCaixa || res);
            setVendasBase([]);
            setVendasSuspensas([]);
            setMostrarAberturaCaixa(false);
            setVendaAtual({ id: Date.now().toString(), itens: [], total: 0 });
            setTimeout(() => inputBuscaRef.current?.focus(), 500);
        } else alert('Erro: ' + res.error);
    };

    const selecionarVendaHistorico = (v) => { setDadosRecibo(v); setNfceStatus(v.fiscal?.status === 'AUTORIZADA' ? 'success' : 'idle'); setNfceUrl(v.fiscal?.pdf || null); setMostrarHistorico(false); setMostrarRecibo(true); };

    const handleProdutoClick = useCallback((p) => {
        if (!vendaAtual) {
            const novaVenda = { id: Date.now().toString(), itens: [], total: 0 };
            setVendaAtual(novaVenda);
            setTimeout(() => { if (p.temVariacoes) setProdutoParaSelecao(p); else adicionarItem(p, null, novaVenda); }, 0);
            return;
        }
        if (p.temVariacoes) setProdutoParaSelecao(p); else adicionarItem(p, null);
    }, [vendaAtual]);

    const adicionarItem = (p, v, vendaRef = null) => {
        setVendaAtual(prev => {
            const target = prev || vendaRef;
            if (!target) return null;
            const vid = v ? v.id : 'p';
            const uid = `${p.id}-${vid}`;
            const ex = target.itens.find(i => i.uid === uid);
            const nv = ex ? target.itens.map(i => i.uid === uid ? { ...i, quantity: i.quantity + 1 } : i) : [...target.itens, { uid, id: p.id, name: v ? `${p.name} ${v.nome}` : p.name, price: v ? Number(v.preco) : p.price, quantity: 1, observacao: '' }];
            return { ...target, itens: nv, total: nv.reduce((s, i) => s + (i.price * i.quantity), 0) };
        });
        setProdutoParaSelecao(null);
        setBusca('');
        inputBuscaRef.current?.focus();
    };

    // 🌟 1. NOVA FUNÇÃO DE GRAVAR EDIÇÃO (OBSERVAÇÃO/QTD)
    const salvarEdicaoItem = (uid, novaQuantidade, novaObservacao) => {
        setVendaAtual(prev => {
            if (!prev) return null;
            const novosItens = prev.itens.map(i => 
                i.uid === uid ? { ...i, quantity: novaQuantidade, observacao: novaObservacao } : i
            );
            return {
                ...prev,
                itens: novosItens,
                total: novosItens.reduce((s, i) => s + (i.price * i.quantity), 0)
            };
        });
        setItemParaEditar(null);
    };

    const removerItem = (uid) => setVendaAtual(prev => ({ ...prev, itens: prev.itens.filter(i => i.uid !== uid), total: prev.itens.filter(i => i.uid !== uid).reduce((s, i) => s + (i.price * i.quantity), 0) }));

    const pdvSyncRef = useRef({});
    useEffect(() => {
        pdvSyncRef.current = {
            produtos,
            handleProdutoClick,
            bloqueado: mostrarFinalizacao || mostrarRecibo || mostrarHistorico || mostrarSuspensas || mostrarMovimentacao || mostrarListaTurnos || mostrarAberturaCaixa || !caixaAberto || produtoParaSelecao !== null || itemParaEditar !== null
        };
    });

    useEffect(() => {
        const onBarcodeRead = (e) => {
            if (e.key.length > 1 && e.key !== 'Enter') return;

            if (e.key === 'Enter' && bufferCodigoBarras.current.length >= 3) {
                const codigo = bufferCodigoBarras.current;
                bufferCodigoBarras.current = '';
                if (timeoutCodigoBarras.current) clearTimeout(timeoutCodigoBarras.current);

                const state = pdvSyncRef.current;
                if (state.bloqueado) return;

                const pEncontrado = state.produtos.find(p => 
                    String(p.codigoBarras) === codigo || 
                    String(p.codigo) === codigo || 
                    String(p.referencia) === codigo
                );

                if (pEncontrado) {
                    state.handleProdutoClick(pEncontrado);
                } else {
                    tocarBeepErro();
                    setBarcodeAviso(`O produto ${codigo} não está registado.`);
                    setTimeout(() => setBarcodeAviso(null), 3000);
                }
                return;
            }

            bufferCodigoBarras.current += e.key;

            if (timeoutCodigoBarras.current) clearTimeout(timeoutCodigoBarras.current);
            timeoutCodigoBarras.current = setTimeout(() => {
                bufferCodigoBarras.current = ''; 
            }, 50);
        };

        window.addEventListener('keydown', onBarcodeRead);
        return () => window.removeEventListener('keydown', onBarcodeRead);
    }, []);

    const finalizarVenda = async () => {
        setSalvando(true);

        const descNum = parseFloat(descontoValor || 0);
        const acrNum = parseFloat(acrescimoValor || 0);
        const totalFinal = Math.max(0, vendaAtual.total + acrNum - descNum);

        const totalPago = pagamentosAdicionados.reduce((acc, p) => acc + p.valor, 0);
        const trocoCalculado = Math.max(0, totalPago - totalFinal);

        let formaPrincipal = pagamentosAdicionados.length === 1 ? pagamentosAdicionados[0].forma : 'misto';

        const d = {
            estabelecimentoId: estabelecimentoAtivo,
            status: 'finalizada',
            formaPagamento: formaPrincipal,
            pagamentos: pagamentosAdicionados,
            subtotal: vendaAtual.total,
            desconto: descNum,
            acrescimo: acrNum,
            total: totalFinal,
            troco: trocoCalculado,
            valorRecebido: totalPago,
            itens: vendaAtual.itens, // As observações já vão aqui dentro embutidas!
            usuarioId: currentUser.uid,
            cliente: 'Balcão',
            clienteCpf: cpfNota || null,
            createdAt: new Date()
        };

        const res = await vendaService.salvarVenda(d);
        if (res.success) {
            setVendasBase(p => [{ ...d, id: res.vendaId }, ...p]);
            setDadosRecibo({ ...d, id: res.vendaId });
            setVendaAtual(null);
            setMostrarFinalizacao(false);
            setMostrarRecibo(true);

            setDescontoValor(''); setAcrescimoValor(''); setCpfNota('');
            setPagamentosAdicionados([]);
        }
        setSalvando(false);
    };

    const tocarBeepErro = () => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, ctx.currentTime);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) {
            console.log("Áudio bloqueado pelo navegador", e);
        }
    };

    const handleEmitirNfce = async () => {
        if (!dadosRecibo?.id) return;
        setNfceStatus('loading');
        try {
            const res = await vendaService.emitirNfce(dadosRecibo.id, dadosRecibo.clienteCpf);
            let novoStatus = '';
            let novoPdf = null;
            if (res.pdfUrl) {
                setNfceUrl(res.pdfUrl);
                setNfceStatus('success');
                novoStatus = 'AUTORIZADA';
                novoPdf = res.pdfUrl;
            } else {
                setNfceStatus('error');
                novoStatus = 'REJEITADA';
                tocarBeepErro();
                alert(res.error || "Erro ao emitir NFC-e.");
            }
            const atualizaVenda = (lista) => lista.map(v =>
                v.id === dadosRecibo.id ? { ...v, fiscal: { ...v.fiscal, status: novoStatus, pdf: novoPdf } } : v
            );
            setVendasBase(atualizaVenda);
            setVendasHistoricoExibicao(atualizaVenda);
        } catch (e) {
            setNfceStatus('error');
            tocarBeepErro();
            alert('Erro ao processar a nota.');
        }
    };

    const handleProcessarLoteNfce = async (vendasParaProcessar) => {
        if (!vendasParaProcessar || vendasParaProcessar.length === 0) return;
        const confirmacao = window.confirm(`Deseja tentar reemitir ${vendasParaProcessar.length} nota(s) fiscal(is)? Isso pode levar alguns instantes.`);
        if (!confirmacao) return;

        let sucesso = 0;
        let erro = 0;
        let listaAtualizada = [...vendasHistoricoExibicao];

        for (const venda of vendasParaProcessar) {
            try {
                const res = await vendaService.emitirNfce(venda.id, venda.clienteCpf);
                let novoStatus = 'REJEITADA';
                let novoPdf = null;
                if (res.pdfUrl || res.success) {
                    sucesso++;
                    novoStatus = 'AUTORIZADA';
                    novoPdf = res.pdfUrl || res.pdf;
                } else {
                    erro++;
                }
                listaAtualizada = listaAtualizada.map(v =>
                    v.id === venda.id ? { ...v, fiscal: { ...v.fiscal, status: novoStatus, pdf: novoPdf } } : v
                );
            } catch (e) {
                erro++;
            }
        }

        setVendasHistoricoExibicao(listaAtualizada);
        setVendasBase(prev => prev.map(v => listaAtualizada.find(lu => lu.id === v.id) || v));

        if (erro > 0) {
            tocarBeepErro();
        }

        alert(`Processamento do Lote concluído!\n✅ Emitidas com Sucesso: ${sucesso}\n❌ Falharam novamente: ${erro}`);
    };

    const handleCancelarNfce = async (venda) => {
        const isNfce = venda.fiscal?.status === 'AUTORIZADA';
        const msg = isNfce 
            ? "⚠️ CANCELAMENTO DE NFC-e\n\nDigite o motivo para a Sefaz (mínimo 15 caracteres):"
            : "⚠️ CANCELAMENTO DE VENDA\n\nDigite o motivo do cancelamento (mínimo 15 caracteres):";

        const justificativa = window.prompt(msg);
        if (justificativa === null) return;
        if (justificativa.trim().length < 15) {
            alert("❌ A justificativa tem de ter pelo menos 15 caracteres.");
            return;
        }

        const confirmacao = window.confirm(`Tem a certeza que deseja cancelar a venda #${venda.id.slice(-4)}?\nO valor será REMOVIDO do caixa atual.`);
        if (!confirmacao) return;

        try {
            if (isNfce) {
                const res = await vendaService.cancelarNfce(venda.id, justificativa);
                if (!res.success) {
                    alert("❌ Erro ao cancelar na Sefaz: " + (res.error || "Retorno inválido da Sefaz. A venda não foi cancelada no sistema."));
                    return; 
                }
            }

            alert("✅ Venda cancelada com sucesso! O valor foi removido do caixa.");

            const atualizaVenda = (lista) => lista.map(v =>
                v.id === venda.id
                    ? { ...v, status: 'cancelada', fiscal: { ...v.fiscal, status: 'CANCELADA' } }
                    : v
            );

            setVendasHistoricoExibicao(atualizaVenda);
            setVendasBase(prev => prev.map(v => v.id === venda.id ? { ...v, status: 'cancelada', fiscal: { ...v.fiscal, status: 'CANCELADA' } } : v));
        } catch (e) {
            alert("❌ Erro de comunicação ao tentar cancelar a venda.");
        }
    };

    useEffect(() => { if (!estabelecimentoAtivo || !currentUser) return; const i = async () => { setVerificandoCaixa(true); const c = await caixaService.verificarCaixaAberto(currentUser.uid, estabelecimentoAtivo); if (c) { setCaixaAberto(c); const v = await vendaService.buscarVendasPorEstabelecimento(estabelecimentoAtivo, 50); setVendasBase(v); setVendaAtual({ id: Date.now().toString(), itens: [], total: 0 }); setTimeout(() => inputBuscaRef.current?.focus(), 500); } else { setMostrarAberturaCaixa(true); } setVerificandoCaixa(false); }; i(); }, [currentUser, estabelecimentoAtivo]);
    useEffect(() => { if (!estabelecimentoAtivo) return; setCarregandoProdutos(true); setProdutos([]); setCategorias([]); const u = onSnapshot(query(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'cardapio'), orderBy('ordem', 'asc')), (s) => { const c = s.docs.map(d => ({ id: d.id, ...d.data() })); setCategorias([{ id: 'todos', name: 'Todos', icon: '🍽️' }, ...c.map(x => ({ id: x.nome || x.id, name: x.nome || x.id, icon: '🍕' }))]); let all = new Map(); let cp = 0; if (c.length === 0) { setProdutos([]); setCarregandoProdutos(false); return; } c.forEach(k => { onSnapshot(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'cardapio', k.id, 'itens'), (is) => { const it = is.docs.map(i => { const d = i.data(); const vs = d.variacoes?.filter(v => v.ativo) || []; return { ...d, id: i.id, name: d.nome || "S/ Nome", categoria: k.nome || "Geral", categoriaId: k.id, price: vs.length > 0 ? Math.min(...vs.map(x => Number(x.preco))) : Number(d.preco || 0), temVariacoes: vs.length > 0, variacoes: vs }; }); all.set(k.id, it); setProdutos(Array.from(all.values()).flat()); cp++; if (cp >= c.length) setCarregandoProdutos(false); }); }); }); return () => u(); }, [estabelecimentoAtivo]);

    useEffect(() => {
        const handler = (e) => {
            setTurnoSelecionadoResumo(e.detail);
            setMostrarListaTurnos(false);
            setMostrarResumoTurno(true);
        };
        document.addEventListener('abrirRelatorioTurno', handler);
        return () => document.removeEventListener('abrirRelatorioTurno', handler);
    }, []);

    useEffect(() => {
        const h = (e) => {
            if (!caixaAberto && !mostrarAberturaCaixa) return;
            if (e.key === 'F1') { e.preventDefault(); inputBuscaRef.current?.focus(); }
            if (e.key === 'F2') { e.preventDefault(); iniciarVendaBalcao(); }
            if (e.key === 'F3') { e.preventDefault(); abrirHistoricoAtual(); }
            if (e.key === 'F4') { e.preventDefault(); suspenderVenda(); }
            if (e.key === 'F5') { e.preventDefault(); setMostrarSuspensas(true); }
            if (e.key === 'F8') { e.preventDefault(); abrirMovimentacao(); }
            if (e.key === 'F9') { e.preventDefault(); prepararFechamento(); }
            if (e.key === 'F10' && vendaAtual?.itens.length > 0) { e.preventDefault(); setMostrarFinalizacao(true); }
            if (e.key === 'F11') { e.preventDefault(); carregarListaTurnos(); }
            
            // 🌟 3. O Escape agora também fecha o modal de edição de item
            if (e.key === 'Escape') { 
                setItemParaEditar(null);
                setProdutoParaSelecao(null); 
                setMostrarFinalizacao(false); 
                setMostrarRecibo(false); 
                setMostrarHistorico(false); 
                setMostrarFechamentoCaixa(false); 
                setMostrarListaTurnos(false); 
                setMostrarMovimentacao(false); 
                setMostrarResumoTurno(false); 
                setMostrarSuspensas(false); 
            }
        }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
    }, [caixaAberto, iniciarVendaBalcao, prepararFechamento, abrirHistoricoAtual, carregarListaTurnos, abrirMovimentacao, vendaAtual, suspenderVenda]);

    const BarraAtalhos = () => (
        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-2 z-[9990] flex justify-center gap-4 shadow-[0_-5px_20px_rgba(0,0,0,0.05)] no-print overflow-x-auto">
            <div className="flex gap-2 min-w-max">
                <button onClick={() => inputBuscaRef.current?.focus()} className="bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all"><kbd className="bg-white border border-gray-200 px-1.5 rounded text-gray-800 font-mono">F1</kbd> BUSCAR</button>
                <button onClick={iniciarVendaBalcao} className="bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all"><kbd className="bg-white border border-gray-200 px-1.5 rounded text-gray-800 font-mono">F2</kbd> NOVA</button>
                
                <button onClick={suspenderVenda} disabled={!vendaAtual?.itens?.length} className="bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"><kbd className="bg-white border border-blue-200 px-1.5 rounded text-blue-800 font-mono">F4</kbd> PAUSAR</button>
                <button onClick={() => setMostrarSuspensas(true)} className="bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all relative">
                    <kbd className="bg-white border border-gray-200 px-1.5 rounded text-gray-800 font-mono">F5</kbd> ESPERA
                    {vendasSuspensas.length > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full shadow-md animate-bounce">{vendasSuspensas.length}</span>}
                </button>

                <button onClick={abrirMovimentacao} className="bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all"><kbd className="bg-white border border-gray-200 px-1.5 rounded text-gray-800 font-mono">F8</kbd> MOVIM.</button>
                <button onClick={prepararFechamento} className="bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all"><kbd className="bg-white border border-gray-200 px-1.5 rounded text-gray-800 font-mono">F9</kbd> FECHAR</button>
                <button onClick={() => setMostrarFinalizacao(true)} disabled={!vendaAtual?.itens.length} className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all ${vendaAtual?.itens.length > 0 ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500 animate-pulse' : 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed'}`}><kbd className="bg-white/20 border border-white/20 px-1.5 rounded text-white font-mono">F10</kbd> PAGAR</button>
                <button onClick={carregarListaTurnos} className="bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all"><kbd className="bg-white border border-gray-200 px-1.5 rounded text-gray-800 font-mono">F11</kbd> TURNOS</button>
            </div>
        </div>
    );

    return (
        <div id="main-app-wrapper" className="fixed inset-0 h-[100dvh] w-screen bg-gray-100 font-sans overflow-hidden text-gray-800 selection:bg-emerald-200 selection:text-emerald-900 flex flex-row z-[100]">
            
            {barcodeAviso && (
                <div className="fixed top-10 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-full shadow-2xl z-[9999] animate-slideUp border border-red-400 flex items-center gap-3">
                    <span className="text-2xl">⚠️</span>
                    <p className="font-bold">{barcodeAviso}</p>
                </div>
            )}

            {verificandoCaixa && !caixaAberto && !mostrarAberturaCaixa ? <div className="flex w-full h-full items-center justify-center font-bold text-gray-400 animate-pulse">Carregando Sistema...</div> : (
                <>
                    {/* LADO ESQUERDO: CATÁLOGO */}
                    <div className="flex-1 flex flex-col h-full min-h-0 bg-gray-50/50 pb-16">
                        <div className="bg-white px-6 py-4 flex flex-col md:flex-row justify-between items-center border-b border-gray-200 z-10 shrink-0 shadow-sm gap-4">
                            <div className="flex flex-col w-full md:w-auto">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${caixaAberto ? 'bg-emerald-500 shadow-[0_0_10px_#10b981] animate-pulse' : 'bg-red-500'}`}></div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{caixaAberto ? 'CAIXA OPERANTE' : 'FECHADO'}</span>
                                </div>
                                {estabelecimentos.length > 1 ? (
                                    <select value={estabelecimentoAtivo || ''} onChange={(e) => trocarLoja(e.target.value)} className="text-xl font-bold text-gray-800 bg-transparent border-none outline-none cursor-pointer -ml-1 mt-1 hover:text-emerald-600 transition w-full">
                                        {estabelecimentos.map(est => <option key={est.id} value={est.id}>{est.nome}</option>)}
                                    </select>
                                ) : (<h1 className="text-xl font-bold text-gray-800 mt-1 tracking-tight truncate">{nomeLoja}</h1>)}
                            </div>
<div className="flex items-center gap-3 w-full md:w-auto">
    {/* 👇 BOTÃO VOLTAR ADICIONADO AQUI 👇 */}
    <button 
        onClick={() => navigate('/dashboard')} 
        className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all border border-gray-200 shrink-0 flex items-center gap-2 font-bold text-sm shadow-sm" 
        title="Voltar ao Dashboard"
    >
        <span className="text-lg">🔙</span> <span className="hidden sm:inline">Voltar</span>
    </button>

    <button onClick={() => navigate('/admin/config-fiscal')} className="p-3 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-emerald-600 rounded-xl transition-all border border-gray-100 shrink-0" title="Configurações Fiscais">⚙️</button>
    
    <div className="relative group w-full md:w-96">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 group-focus-within:text-emerald-600 transition-colors">🔍</span>
        <input ref={inputBuscaRef} type="text" placeholder="Buscar Produto (F1) ou Bipe o código..." className="w-full pl-10 pr-4 py-3 bg-gray-100 border border-transparent rounded-xl text-sm font-medium text-gray-800 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition-all placeholder-gray-400 shadow-inner focus:shadow-none" value={busca} onChange={e => setBusca(e.target.value)} />
    </div>
</div>
                        </div>

                        <div className="px-6 py-4 flex gap-3 overflow-x-auto scrollbar-hide shrink-0 border-b border-gray-200 bg-white">
                            {categorias.map(c => (
                                <button key={c.id} onClick={() => setCategoriaAtiva(c.name === 'Todos' ? 'todos' : c.name)} className={`px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${((categoriaAtiva === 'todos' && c.name === 'Todos') || categoriaAtiva === c.name) ? 'bg-gray-900 border-gray-900 text-white shadow-lg' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700'}`}>{c.name}</button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 custom-scrollbar">
                            {carregandoProdutos ? (
                                <div className="h-full flex items-center justify-center text-gray-400"><div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-300 border-t-emerald-500"></div></div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 pb-20">
                                    {produtosFiltrados.map(p => (
                                        <button key={p.id} onClick={() => handleProdutoClick(p)} className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 hover:border-emerald-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 group flex flex-col h-52 relative overflow-hidden">
                                            <div className="h-24 w-full bg-gray-50 rounded-xl mb-3 overflow-hidden relative flex items-center justify-center shrink-0 border border-gray-50">
                                                {p.imagem || p.foto || p.urlImagem ? (
                                                    <img src={p.imagem || p.foto || p.urlImagem} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                ) : (
                                                    <span className="text-4xl opacity-20 grayscale">🍔</span>
                                                )}
                                            </div>
                                            <div className="flex flex-col justify-between flex-1 px-1">
                                                <h3 className="font-semibold text-gray-700 text-sm leading-tight line-clamp-2 group-hover:text-emerald-700 transition-colors text-left">{p.name}</h3>
                                                <div className="flex justify-between items-center mt-2">
                                                    <span className="font-bold text-emerald-600 text-lg">{formatarMoeda(p.price)}</span>
                                                    <div className="w-8 h-8 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-sm">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* LADO DIREITO: CARRINHO */}
                    <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full min-h-0 shadow-2xl relative z-30 shrink-0 pb-16 hidden md:flex">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
                            <div>
                                <h2 className="font-black text-xl text-gray-800 flex items-center gap-2">🛒 Pedido</h2>
                                <p className="text-xs text-gray-400 font-mono mt-1">ID: {vendaAtual?.id?.slice(-6).toUpperCase() || '---'}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={suspenderVenda} disabled={!vendaAtual?.itens?.length} className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-2 rounded-xl text-[10px] font-bold transition flex items-center gap-1 border border-blue-100 disabled:opacity-50" title="Suspender Pedido (F4)">⏸️ PAUSAR</button>
                                <button onClick={iniciarVendaBalcao} className="bg-red-50 text-red-500 hover:bg-red-100 px-3 py-2 rounded-xl text-[10px] font-bold transition flex items-center gap-1 border border-red-100" title="Limpar venda atual">🗑️ LIMPAR</button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-white">
                            {vendaAtual?.itens?.length > 0 ? (
                                vendaAtual.itens.map(i => (
                                    // 🌟 2. MUDANÇA NO CARRINHO: Tornar a linha clicável para abrir a edição
                                    <div key={i.uid} onClick={() => setItemParaEditar(i)} className="flex justify-between items-start bg-gray-50 p-3 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-white hover:shadow-md transition group animate-fadeIn cursor-pointer" title="Clique para editar a quantidade ou adicionar observação">
                                        <div className="flex-1 pr-2">
                                            <div className="flex items-baseline gap-2 mb-1">
                                                <span className="font-bold text-emerald-600 text-base">{i.quantity}x</span>
                                                <span className="font-medium text-gray-700 text-sm leading-tight line-clamp-2">{i.name}</span>
                                            </div>
                                            <p className="text-[10px] text-gray-400 pl-6">{formatarMoeda(i.price)} un.</p>
                                            
                                            {/* Renderiza a observação se ela existir */}
                                            {i.observacao && (
                                                <p className="text-[10px] text-orange-500 font-medium italic pl-6 mt-0.5 max-w-[200px] truncate">
                                                    Obs: {i.observacao}
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-1">
                                            <span className="font-bold text-gray-900 tracking-wide">{formatarMoeda(i.price * i.quantity)}</span>
                                            {/* Stop Propagation para não abrir o modal quando a pessoa quer apenas excluir */}
                                            <button onClick={(e) => { e.stopPropagation(); removerItem(i.uid); }} className="text-red-400 hover:text-red-600 text-[10px] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all bg-red-50 px-2 py-1 rounded border border-red-100">Excluir</button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-4 opacity-70">
                                    <div className="w-24 h-24 rounded-full bg-gray-50 flex items-center justify-center text-4xl">🛍️</div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Caixa Livre</p>
                                </div>
                            )}
                        </div>

                        {vendaAtual?.itens?.length > 0 && (
                            <div className="p-6 bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-40 shrink-0">
                                <div className="space-y-2 mb-6">
                                    <div className="flex justify-between text-gray-400 text-xs font-bold uppercase tracking-wider"><span>Subtotal</span><span>{formatarMoeda(vendaAtual.total)}</span></div>
                                    <div className="flex justify-between text-gray-800 text-3xl font-black mt-1 items-baseline tracking-tight"><span className="text-lg font-bold text-gray-300">TOTAL</span><span className="text-gray-900">{formatarMoeda(vendaAtual.total)}</span></div>
                                </div>
                                <button onClick={() => setMostrarFinalizacao(true)} className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black text-xl hover:bg-black transition-all shadow-xl active:scale-[0.98] flex items-center justify-center gap-3 group relative overflow-hidden">
                                    <span className="relative z-10">PAGAR</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <BarraAtalhos />

                    {/* Modais Componentes */}
                    <ModalSelecaoVariacao produto={produtoParaSelecao} onClose={() => setProdutoParaSelecao(null)} onConfirm={adicionarItem} />
                    
                    {/* 🆕 MODAL DE EDIÇÃO DE ITEM */}
                    <ModalEdicaoItemCarrinho 
                        visivel={itemParaEditar !== null} 
                        item={itemParaEditar} 
                        onClose={() => setItemParaEditar(null)} 
                        onConfirm={salvarEdicaoItem} 
                    />

                    <ModalAberturaCaixa visivel={mostrarAberturaCaixa} onAbrir={handleAbrirCaixa} usuarioNome={userData?.name} />
                    <ModalFechamentoCaixa visivel={mostrarFechamentoCaixa} caixa={caixaAberto} vendasDoDia={vendasTurnoAtual} movimentacoes={movimentacoesDoTurno} onClose={() => setMostrarFechamentoCaixa(false)} onConfirmarFechamento={handleConfirmarFechamento} />
                    <ModalMovimentacao visivel={mostrarMovimentacao} onClose={() => setMostrarMovimentacao(false)} onConfirmar={handleSalvarMovimentacao} />
                    <ModalFinalizacao
                        visivel={mostrarFinalizacao}
                        venda={vendaAtual}
                        onClose={() => setMostrarFinalizacao(false)}
                        onFinalizar={finalizarVenda}
                        salvando={salvando}
                        pagamentos={pagamentosAdicionados}
                        setPagamentos={setPagamentosAdicionados}
                        cpfNota={cpfNota}
                        setCpfNota={setCpfNota}
                        desconto={descontoValor}
                        setDesconto={setDescontoValor}
                        acrescimo={acrescimoValor}
                        setAcrescimo={setAcrescimoValor}
                    />
                    <ModalRecibo visivel={mostrarRecibo} dados={dadosRecibo} onClose={() => { setMostrarRecibo(false); iniciarVendaBalcao(); }} onNovaVenda={iniciarVendaBalcao} onEmitirNfce={handleEmitirNfce} nfceStatus={nfceStatus} nfceUrl={nfceUrl} />
                    <ModalHistorico
                        visivel={mostrarHistorico}
                        onClose={() => setMostrarHistorico(false)}
                        vendas={vendasHistoricoExibicao}
                        titulo={tituloHistorico}
                        onSelecionarVenda={selecionarVendaHistorico}
                        carregando={carregandoHistorico}
                        onProcessarLote={handleProcessarLoteNfce}
                        onCancelarNfce={handleCancelarNfce}
                    />
                    <ModalListaTurnos
                        visivel={mostrarListaTurnos}
                        onClose={() => setMostrarListaTurnos(false)}
                        turnos={listaTurnos}
                        carregando={carregandoHistorico}
                        onVerVendas={visualizarVendasTurno}
                        vendasDoDia={vendasTurnoAtual}
                    />   
                    <ModalResumoTurno 
                        visivel={mostrarResumoTurno} 
                        turno={turnoSelecionadoResumo} 
                        onClose={() => {
                            setMostrarResumoTurno(false);
                            if (!caixaAberto) setMostrarAberturaCaixa(true);
                        }} 
                    />
                    <ModalVendasSuspensas 
                        visivel={mostrarSuspensas} 
                        onClose={() => setMostrarSuspensas(false)}
                        vendas={vendasSuspensas}
                        onRestaurar={restaurarVendaSuspensa}
                        onExcluir={excluirVendaSuspensa}
                    />             
                </>
            )}
            <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

        /* --- CSS CORREÇÃO DE IMPRESSÃO --- */
        @media print {
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }

          body * {
            visibility: hidden;
          }
          
          #main-app-wrapper {
            position: static !important;
            overflow: visible !important;
            height: auto !important;
            display: block !important;
          }

          #recibo-overlay {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: none !important;
            visibility: visible !important;
            z-index: 9999 !important;
            display: block !important;
          }

          #recibo-content, #recibo-content * {
            visibility: visible !important;
          }

          #recibo-content {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }

          #resumo-turno-overlay {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: none !important;
            visibility: visible !important;
            z-index: 9999 !important;
            display: block !important;
          }

          #resumo-turno-content, #resumo-turno-content * {
            visibility: visible !important;
          }

          #resumo-turno-content {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }

          .no-print {
            display: none !important;
          }
          
          .bg-gray-50, .bg-gray-100 {
            background-color: white !important;
          }
        }
      `}</style>
        </div>
    );
};

export default PdvScreen;