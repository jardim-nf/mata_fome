// src/components/pdv-modals/ModalMovimentacao.jsx
import React, { useState, useEffect } from 'react';
import { IoTrashOutline, IoPencilOutline, IoArrowUpCircleOutline, IoArrowDownCircleOutline, IoCloseOutline } from 'react-icons/io5';

export const ModalMovimentacao = ({ visivel, onClose, onConfirmar, movimentacoes = [], onExcluir, onEditar }) => {
    const [aba, setAba] = useState('nova'); // 'nova' | 'lista'
    const [t, sT] = useState('sangria'); 
    const [v, sV] = useState(''); 
    const [d, sD] = useState('');
    const [forma, setForma] = useState('dinheiro');
    const [editandoId, setEditandoId] = useState(null);

    // Reset fields when opening/closing or switching to new
    useEffect(() => {
        if (!visivel) {
            setAba('nova');
            sV('');
            sD('');
            setForma('dinheiro');
            setEditandoId(null);
        }
    }, [visivel]);

    if (!visivel) return null;

    const handleSalvar = () => {
        if (!v || !d) return;
        
        const valFinal = parseFloat(v);
        if (isNaN(valFinal) || valFinal <= 0) return;

        const finalTipo = forma === 'dinheiro' ? t : `${t}_${forma}`;
        // Clean description if it has duplicate (via PIX) suffixes
        const limpaDesc = d.replace(/\s*\(via\s+(PIX|CARTAO|DINHEIRO)\)/gi, '').trim();
        const finalDesc = `${limpaDesc}${forma !== 'dinheiro' ? ` (via ${forma.toUpperCase()})` : ''}`;

        const payload = {
            tipo: finalTipo,
            valor: valFinal,
            descricao: finalDesc
        };

        if (editandoId) {
            onEditar(editandoId, payload);
        } else {
            onConfirmar(payload);
        }

        sV(''); 
        sD(''); 
        setForma('dinheiro');
        setEditandoId(null);
    };

    const handleEditarClick = (item) => {
        setEditandoId(item.id);
        const isSangria = item.tipo && item.tipo.startsWith('sangria');
        sT(isSangria ? 'sangria' : 'suprimento');
        
        let canal = 'dinheiro';
        if (item.tipo.includes('_pix')) canal = 'pix';
        else if (item.tipo.includes('_cartao')) canal = 'cartao';
        setForma(canal);

        // Remove (via CANAL) from description when editing
        const limpaDesc = (item.descricao || '').replace(/\s*\(via\s+(PIX|CARTAO|DINHEIRO)\)/gi, '').trim();
        sD(limpaDesc);
        sV(item.valor);
        setAba('nova');
    };

    const formatarMoeda = (valor) => {
        return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    // Filter out virtual items (like Receb. OS or Receb. Crediário) from editable manual list
    // because they are automatically created and shouldn't be edited manually here
    const movsManuais = movimentacoes.filter(m => !m.virtual);

    return (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-[9400] p-4 backdrop-blur-sm no-print">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 font-sans flex flex-col max-h-[90vh]">
                
                {/* Header com Abas */}
                <div className="flex justify-between items-center mb-4 shrink-0">
                    <div className="flex gap-4">
                        <button 
                            onClick={() => { setAba('nova'); setEditandoId(null); }} 
                            className={`font-black text-sm uppercase tracking-wider pb-1 transition-all ${
                                aba === 'nova' 
                                    ? 'text-slate-800 border-b-2 border-slate-850' 
                                    : 'text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            {editandoId ? 'Editar Registro' : 'Novo Registro'}
                        </button>
                        {movsManuais.length > 0 && (
                            <button 
                                onClick={() => setAba('lista')} 
                                className={`font-black text-sm uppercase tracking-wider pb-1 transition-all ${
                                    aba === 'lista' 
                                        ? 'text-slate-800 border-b-2 border-slate-850' 
                                        : 'text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                Histórico ({movsManuais.length})
                            </button>
                        )}
                    </div>
                    <button onClick={onClose} className="bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 p-1.5 rounded-full border border-slate-100 transition-colors">
                        <IoCloseOutline size={16} />
                    </button>
                </div>

                {aba === 'nova' ? (
                    <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                        {editandoId && (
                            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-xl text-[10px] font-bold flex justify-between items-center animate-fadeIn">
                                <span>Você está editando um registro existente.</span>
                                <button 
                                    onClick={() => { setEditandoId(null); sV(''); sD(''); setForma('dinheiro'); }} 
                                    className="underline text-amber-900 uppercase font-black tracking-wider text-[9px]"
                                >
                                    Cancelar
                                </button>
                            </div>
                        )}

                        {/* Tipo de Movimentação */}
                        <div className="flex bg-gray-100 p-1 rounded-xl">
                            <button 
                                onClick={() => sT('sangria')} 
                                className={`flex-1 py-2.5 rounded-lg font-black text-xs uppercase tracking-wider transition-all ${
                                    t === 'sangria' 
                                        ? 'bg-white text-red-500 shadow' 
                                        : 'text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                Sangria
                            </button>
                            <button 
                                onClick={() => sT('suprimento')} 
                                className={`flex-1 py-2.5 rounded-lg font-black text-xs uppercase tracking-wider transition-all ${
                                    t === 'suprimento' 
                                        ? 'bg-white text-emerald-500 shadow' 
                                        : 'text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                Suprimento
                            </button>
                        </div>

                        {/* Valor */}
                        <input 
                            type="number" 
                            className="w-full p-4 border-2 border-gray-150 bg-gray-50 rounded-xl text-3xl text-center font-black focus:border-blue-500 outline-none text-gray-800 placeholder-gray-300 transition-all" 
                            placeholder="0.00" 
                            autoFocus 
                            onChange={e => sV(e.target.value)} 
                            value={v} 
                        />

                        {/* Motivo */}
                        <input 
                            type="text" 
                            className="w-full p-3.5 border border-gray-200 bg-white rounded-xl outline-none text-xs font-semibold text-gray-800 placeholder-gray-400 focus:border-blue-400 transition-all" 
                            placeholder="Motivo (ex: Compra de insumos, Troco inicial)" 
                            onChange={e => sD(e.target.value)} 
                            value={d} 
                        />

                        {/* Forma de Pagamento */}
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider mb-2">Canal do Recurso</label>
                            <div className="flex gap-2">
                                {['dinheiro', 'pix', 'cartao'].map(f => (
                                    <button
                                        key={f}
                                        type="button"
                                        onClick={() => setForma(f)}
                                        className={`flex-1 py-2 px-1.5 rounded-lg border font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 ${
                                            forma === f 
                                                ? 'bg-slate-800 text-white border-slate-800 shadow' 
                                                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100 hover:text-gray-700'
                                        }`}
                                    >
                                        {f === 'cartao' ? 'Cartão' : f}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Ações */}
                        <div className="flex gap-2 pt-2">
                            <button 
                                onClick={onClose} 
                                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-500 p-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSalvar} 
                                className={`flex-1 text-white p-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all active:scale-95 ${
                                    t === 'sangria' 
                                        ? 'bg-red-500 hover:bg-red-600 shadow-md shadow-red-100' 
                                        : 'bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-100'
                                }`}
                            >
                                {editandoId ? 'SALVAR ALTERAÇÕES' : 'SALVAR'}
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Lista/Histórico de Movimentações */
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[250px] max-h-[380px]">
                        {movsManuais.map((item, idx) => {
                            const isSangria = item.tipo && item.tipo.startsWith('sangria');
                            return (
                                <div 
                                    key={item.id || idx} 
                                    className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                                        isSangria 
                                            ? 'bg-red-50/20 border-red-100/60' 
                                            : 'bg-blue-50/20 border-blue-100/60'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className={`p-1.5 rounded-lg shrink-0 ${
                                            isSangria ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-650'
                                        }`}>
                                            {isSangria ? <IoArrowUpCircleOutline size={15} /> : <IoArrowDownCircleOutline size={15} />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-bold text-slate-800 truncate leading-tight">{item.descricao}</p>
                                            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                                                {isSangria ? 'Sangria (Retirada)' : 'Suprimento (Entrada)'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2.5 shrink-0 ml-2">
                                        <span className={`text-[11px] font-black font-mono ${isSangria ? 'text-red-700' : 'text-blue-700'}`}>
                                            {isSangria ? '-' : '+'}{formatarMoeda(item.valor)}
                                        </span>
                                        <div className="flex gap-1">
                                            <button 
                                                onClick={() => handleEditarClick(item)}
                                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg transition-colors border border-slate-200/50"
                                                title="Editar"
                                            >
                                                <IoPencilOutline size={12} />
                                            </button>
                                            <button 
                                                onClick={() => onExcluir(item.id)}
                                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors border border-red-100/50"
                                                title="Excluir"
                                            >
                                                <IoTrashOutline size={12} />
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
    );
};
