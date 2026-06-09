import React, { useState } from 'react';
import { IoCloseOutline, IoSearchOutline, IoCheckmarkCircleOutline, IoAddCircleOutline } from 'react-icons/io5';

const ModalVinculo = ({ produtoNota, produtosSistema, onVincular, onCriarNovo, onFechar, isDark: propIsDark }) => {
    const isDark = propIsDark !== undefined ? propIsDark : localStorage.getItem('dashboard_theme') === 'dark';
    const [busca, setBusca] = useState('');
    const filtrados = produtosSistema.filter(p =>
        p.name?.toLowerCase().includes(busca.toLowerCase()) ||
        p.categoriaNome?.toLowerCase().includes(busca.toLowerCase())
    );

    const classes = {
        overlay: 'fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm',
        container: isDark ? 'bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden' : 'bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden',
        header: isDark ? 'p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/40' : 'p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50',
        title: isDark ? 'font-bold text-slate-100' : 'font-bold text-gray-800',
        closeBtn: isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600',
        body: 'p-6 space-y-4',
        infoBox: isDark ? 'bg-blue-950/40 p-4 rounded-xl border border-blue-900/30' : 'bg-blue-50 p-4 rounded-xl border border-blue-100',
        infoLabel: isDark ? 'text-xs text-blue-400 font-bold uppercase mb-1' : 'text-xs text-blue-600 font-bold uppercase mb-1',
        infoTitle: isDark ? 'text-sm font-semibold text-slate-200' : 'text-sm font-semibold text-gray-800',
        infoMeta: isDark ? 'text-xs text-slate-400 mt-1' : 'text-xs text-gray-500 mt-1',
        input: isDark ? 'w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-slate-100 rounded-xl outline-none text-sm' : 'w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm focus:bg-white',
        listContainer: isDark ? 'max-h-52 overflow-y-auto border border-slate-800 rounded-xl divide-y divide-slate-800/80 bg-slate-950/20' : 'max-h-52 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-100',
        listItem: isDark ? 'w-full text-left p-4 hover:bg-blue-950/30 transition-colors flex justify-between items-center group' : 'w-full text-left p-4 hover:bg-blue-50 transition-colors flex justify-between items-center group',
        itemTitle: isDark ? 'font-bold text-sm text-slate-200' : 'font-bold text-sm text-gray-800',
        itemSub: isDark ? 'text-xs text-slate-400' : 'text-xs text-gray-500',
        createBtn: isDark ? 'w-full py-3 border-2 border-dashed border-blue-900/50 text-blue-400 font-bold rounded-xl hover:bg-blue-950/20 transition-all flex items-center justify-center gap-2 text-sm' : 'w-full py-3 border-2 border-dashed border-blue-200 text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-sm',
    };

    return (
        <div className={classes.overlay}>
            <div className={classes.container}>
                <div className={classes.header}>
                    <h3 className={classes.title}>Vincular ao Produto</h3>
                    <button onClick={onFechar}><IoCloseOutline size={24} className={classes.closeBtn} /></button>
                </div>
                <div className={classes.body}>
                    <div className={classes.infoBox}>
                        <p className={classes.infoLabel}>Produto na Nota:</p>
                        <p className={classes.infoTitle}>{produtoNota?.nome}</p>
                        <p className={classes.infoMeta}>NCM: {produtoNota?.ncm} • {produtoNota?.qtd} {produtoNota?.unidade}</p>
                    </div>
                    <div className="relative">
                        <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text" placeholder="Buscar produto no sistema..."
                            value={busca} onChange={e => setBusca(e.target.value)} autoFocus
                            className={classes.input}
                        />
                    </div>
                    <div className={classes.listContainer}>
                        {filtrados.length === 0 ? (
                            <div className="p-6 text-center text-gray-400 text-sm">
                                {produtosSistema.length === 0 ? 'Carregando...' : 'Nenhum produto encontrado.'}
                            </div>
                        ) : filtrados.map(prod => (
                            <button key={prod.id} onClick={() => onVincular(prod)}
                                className={classes.listItem}>
                                <div>
                                    <p className={classes.itemTitle}>{prod.name}</p>
                                    <p className={classes.itemSub}>{prod.categoriaNome}</p>
                                </div>
                                <IoCheckmarkCircleOutline size={20} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        ))}
                    </div>
                    <button onClick={onCriarNovo}
                        className={classes.createBtn}>
                        <IoAddCircleOutline size={20} /> Produto não existe — Cadastrar agora
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalVinculo;
