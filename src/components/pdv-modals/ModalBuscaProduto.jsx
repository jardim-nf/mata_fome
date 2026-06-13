// src/components/pdv-modals/ModalBuscaProduto.jsx
import React, { useEffect, useRef } from 'react';
import { IoClose, IoSearch } from 'react-icons/io5';
import { formatarMoeda } from './pdvHelpers';

export const ModalBuscaProduto = ({ visivel, busca, setBusca, produtosFiltrados, onClose, onSelectProduto }) => {
    const inputRef = useRef(null);

    useEffect(() => {
        if (visivel) {
            // Pequeno delay para garantir a renderização e dar foco
            const timer = setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [visivel]);

    if (!visivel) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 flex items-start justify-center z-[9500] p-4 pt-16 sm:pt-24 backdrop-blur-sm no-print">
            <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-100 flex flex-col max-h-[70vh] transform animate-slideUp overflow-hidden">
                {/* Header/Search bar */}
                <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50 relative shrink-0">
                    <IoSearch className="text-slate-400 text-xl" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="O que você está procurando? (Nome ou Categoria)"
                        className="flex-1 bg-transparent text-slate-800 text-base font-bold outline-none placeholder-slate-400"
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (produtosFiltrados && produtosFiltrados.length > 0) {
                                    onSelectProduto(produtosFiltrados[0]);
                                    onClose();
                                }
                            }
                        }}
                    />
                    <button 
                        onClick={onClose} 
                        className="p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                    >
                        <IoClose size={20} />
                    </button>
                </div>

                {/* List area */}
                <div className="flex-1 overflow-y-auto p-4 bg-white space-y-1.5 pdv-scroll">
                    {produtosFiltrados.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            <p className="font-semibold text-sm">Nenhum produto encontrado para "{busca}"</p>
                        </div>
                    ) : (
                        produtosFiltrados.map(p => (
                            <button
                                key={p.id}
                                onClick={() => {
                                    onSelectProduto(p);
                                    onClose();
                                }}
                                className="w-full bg-slate-50 hover:bg-emerald-50 hover:border-emerald-350 border border-slate-200 p-2.5 rounded-xl flex items-center gap-3 text-left transition-all active:scale-[0.99] group"
                            >
                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 overflow-hidden shrink-0">
                                    {p.imagem || p.foto || p.urlImagem || p.imageUrl ? (
                                        <img src={p.imagem || p.foto || p.urlImagem || p.imageUrl} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-lg text-slate-350">🍔</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-800 text-xs sm:text-sm truncate uppercase group-hover:text-emerald-700">{p.name}</p>
                                    {p.category && <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{p.category}</p>}
                                </div>
                                <div className="shrink-0 text-right">
                                    <span className="font-black text-emerald-600 text-sm sm:text-base">{formatarMoeda(p.price)}</span>
                                </div>
                            </button>
                        ))
                    )}
                </div>
                
                {/* Footer hint */}
                <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase shrink-0 tracking-wider">
                    <span>{produtosFiltrados.length} produtos encontrados</span>
                    <span>Pressione ESC para fechar</span>
                </div>
            </div>
        </div>
    );
};
