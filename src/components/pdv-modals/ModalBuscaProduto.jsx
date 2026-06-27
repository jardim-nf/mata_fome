// src/components/pdv-modals/ModalBuscaProduto.jsx
import React, { useEffect, useRef, useState } from 'react';
import { IoClose, IoSearch, IoTrashOutline, IoCreateOutline } from 'react-icons/io5';
import { formatarMoeda } from './pdvHelpers';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { produtoService } from '../../services/produtoService';
import { toast } from '../../components/ui/Toast';

export const ModalBuscaProduto = ({ 
    visivel, busca, setBusca, produtosFiltrados, onClose, onSelectProduto,
    isVarejo, categorias, estabelecimentoId, onProdutoAdicionado, isMasterAdmin,
    onAbrirCadastro, showConfirm, modoEdicao, onEditarProduto,
    temMaisProdutos, onCarregarMais
}) => {
    const inputRef = useRef(null);
    const nameInputRef = useRef(null);

    const [abaAtiva, setAbaAtiva] = useState('buscar'); // 'buscar' | 'cadastrar'

    // Form Cadastro
    const [nome, setNome] = useState('');
    const [preco, setPreco] = useState('');
    const [categoriaSel, setCategoriaSel] = useState('');
    const [novaCategoriaNome, setNovaCategoriaNome] = useState('');
    const [codigoBarras, setCodigoBarras] = useState('');
    const [salvandoProd, setSalvandoProd] = useState(false);

    useEffect(() => {
        if (visivel) {
            setAbaAtiva('buscar');
            // Pequeno delay para garantir a renderização e dar foco
            const timer = setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [visivel]);

    useEffect(() => {
        if (abaAtiva === 'buscar') {
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);
        } else if (abaAtiva === 'cadastrar') {
            setTimeout(() => {
                nameInputRef.current?.focus();
            }, 50);
        }
    }, [abaAtiva]);

    useEffect(() => {
        const handleAtalhoBusca = (e) => {
            if (!visivel) return;
            if (e.key === 'F1') {
                e.preventDefault();
                setAbaAtiva('buscar');
            }
            if (e.key === 'F4') {
                e.preventDefault();
                if (onAbrirCadastro) {
                    onAbrirCadastro();
                } else {
                    setAbaAtiva('cadastrar');
                }
            }
        };
        window.addEventListener('keydown', handleAtalhoBusca);
        return () => window.removeEventListener('keydown', handleAtalhoBusca);
    }, [visivel, onAbrirCadastro]);

    if (!visivel) return null;

    const categoriasValidas = (categorias || []).filter(c => c.id !== 'todos');

    const handleCadastrar = async (e) => {
        e.preventDefault();
        if (!nome.trim()) return toast.error('Nome do produto é obrigatório.');
        if (!preco || Number(preco) <= 0) return toast.error('Preço deve ser maior que zero.');
        
        let catNome = '';
        if (categoriaSel === 'nova_categoria') {
            if (!novaCategoriaNome.trim()) return toast.error('Digite o nome da nova categoria.');
            catNome = novaCategoriaNome.trim();
        } else {
            if (!categoriaSel) return toast.error('Selecione uma categoria.');
            catNome = categoriaSel;
        }

        setSalvandoProd(true);
        try {
            const result = await produtoService.salvarProdutoCatalogo(estabelecimentoId, {
                nome: nome.trim(),
                preco: Number(preco),
                categoriaNome: catNome
            });
            
            if (codigoBarras.trim() && result && result.id) {
                const itemRef = doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', result.categoriaId, 'itens', result.id);
                await updateDoc(itemRef, { codigoBarras: codigoBarras.trim() });
                result.codigoBarras = codigoBarras.trim();
            }

            toast.success('Produto cadastrado com sucesso!');
            
            // Reseta form
            setNome('');
            setPreco('');
            setCategoriaSel('');
            setNovaCategoriaNome('');
            setCodigoBarras('');

            if (typeof onProdutoAdicionado === 'function') {
                onProdutoAdicionado();
            }

            // Seleciona/adiciona o item criado no PDV e fecha
            const formattedProd = {
                ...result,
                name: result.nome,
                price: result.preco,
                categoria: result.categoria,
                categoriaId: result.categoriaId
            };
            onSelectProduto(formattedProd);
            onClose();
        } catch (error) {
            console.error('Erro ao cadastrar produto:', error);
            toast.error('Erro ao cadastrar produto.');
        } finally {
            setSalvandoProd(false);
        }
    };

    const handleExcluirProduto = (e, p) => {
        e.stopPropagation(); // Evita adicionar ao carrinho ao clicar
        
        if (showConfirm) {
            showConfirm(
                `Deseja realmente excluir o produto "${p.name}" permanentemente do catálogo? Esta ação não pode ser desfeita.`,
                async () => {
                    try {
                        const sucesso = await produtoService.excluirProduto(estabelecimentoId, p.categoriaId || p.category, p.id);
                        if (sucesso) {
                            toast.success('Produto excluído com sucesso!');
                            if (typeof onProdutoAdicionado === 'function') {
                                onProdutoAdicionado();
                            }
                        } else {
                            toast.error('Erro ao excluir produto.');
                        }
                    } catch (error) {
                        console.error('Erro ao excluir produto:', error);
                        toast.error('Erro ao excluir produto.');
                    }
                },
                {
                    title: '⚠️ Excluir Produto',
                    variant: 'danger',
                    confirmText: 'Excluir',
                    cancelText: 'Cancelar'
                }
            );
        } else {
            const confirmou = window.confirm(`Deseja realmente excluir o produto "${p.name}" permanentemente?`);
            if (!confirmou) return;

            produtoService.excluirProduto(estabelecimentoId, p.categoriaId || p.category, p.id)
                .then(sucesso => {
                    if (sucesso) {
                        toast.success('Produto excluído com sucesso!');
                        if (typeof onProdutoAdicionado === 'function') {
                            onProdutoAdicionado();
                        }
                    } else {
                        toast.error('Erro ao excluir produto.');
                    }
                })
                .catch(error => {
                    console.error('Erro ao excluir produto:', error);
                    toast.error('Erro ao excluir produto.');
                });
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 flex items-start justify-center z-[9500] p-4 pt-16 sm:pt-24 backdrop-blur-sm no-print">
            <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-100 flex flex-col max-h-[70vh] transform animate-slideUp overflow-hidden">
                {/* Header Tabs */}
                <div className="flex border-b border-slate-200 select-none bg-slate-50 shrink-0 relative">
                    <button
                        onClick={() => setAbaAtiva('buscar')}
                        className={`flex-1 py-3.5 text-center text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                            abaAtiva === 'buscar' 
                                ? `${modoEdicao ? 'border-amber-500 text-amber-650' : 'border-emerald-500 text-emerald-600'} font-extrabold` 
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <IoSearch size={15} /> {modoEdicao ? 'Alterar Produto' : 'Buscar'} <kbd className="bg-slate-200/60 px-1 py-0.5 rounded text-[8px] font-mono">{modoEdicao ? 'F8' : 'F1'}</kbd>
                    </button>
                    {!modoEdicao && (
                        <button
                            onClick={() => {
                                if (onAbrirCadastro) {
                                    onAbrirCadastro();
                                } else {
                                    setAbaAtiva('cadastrar');
                                }
                            }}
                            className={`flex-1 py-3.5 text-center text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                                abaAtiva === 'cadastrar' 
                                    ? 'border-emerald-500 text-emerald-600 font-extrabold' 
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <span>➕</span> Cadastrar <kbd className="bg-slate-200/60 px-1 py-0.5 rounded text-[8px] font-mono">F4</kbd>
                        </button>
                    )}
                    <button 
                        onClick={onClose} 
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-650 transition-all"
                    >
                        <IoClose size={18} />
                    </button>
                </div>

                {abaAtiva === 'buscar' ? (
                    <>
                        {/* Search bar inside tab */}
                        <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-white relative shrink-0">
                            <IoSearch className="text-slate-400 text-xl" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder={modoEdicao ? "Selecione o produto para ALTERAR (Nome, Categoria ou Código de Barras)..." : "Buscar por Nome, Categoria ou Código de Barras..."}
                                className="flex-1 bg-transparent text-slate-800 text-base font-bold outline-none placeholder-slate-400"
                                value={busca}
                                onChange={e => setBusca(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (produtosFiltrados && produtosFiltrados.length > 0) {
                                            if (modoEdicao) {
                                                onEditarProduto(produtosFiltrados[0]);
                                            } else {
                                                onSelectProduto(produtosFiltrados[0]);
                                            }
                                            onClose();
                                        }
                                    }
                                }}
                            />
                        </div>

                        {/* List area */}
                        <div 
                            onScroll={(e) => {
                                const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                                if (scrollHeight - scrollTop <= clientHeight + 100) {
                                    if (temMaisProdutos && typeof onCarregarMais === 'function') {
                                        onCarregarMais();
                                    }
                                }
                            }}
                            className="flex-1 overflow-y-auto p-4 bg-slate-50/30 space-y-1.5 pdv-scroll"
                        >
                            {produtosFiltrados.length === 0 ? (
                                <div className="text-center py-10 text-slate-400">
                                    <p className="font-semibold text-sm">Nenhum produto encontrado para "{busca}"</p>
                                </div>
                            ) : (
                                produtosFiltrados.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            if (modoEdicao) {
                                                onEditarProduto(p);
                                            } else {
                                                onSelectProduto(p);
                                            }
                                            onClose();
                                        }}
                                        className={`w-full bg-white hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 p-2.5 rounded-xl flex items-center gap-3 text-left transition-all active:scale-[0.99] group ${
                                            modoEdicao ? 'hover:bg-amber-50 hover:border-amber-300' : ''
                                        }`}
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200 overflow-hidden shrink-0">
                                            {p.imagem || p.foto || p.urlImagem || p.imageUrl ? (
                                                <img src={p.imagem || p.foto || p.urlImagem || p.imageUrl} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-lg text-slate-350">{isVarejo ? '📦' : '🍔'}</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-bold text-slate-800 text-xs sm:text-sm truncate uppercase ${modoEdicao ? 'group-hover:text-amber-700' : 'group-hover:text-emerald-700'}`}>{p.name}</p>
                                            {p.categoria && <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{p.categoria}</p>}
                                        </div>
                                        <div className="shrink-0 text-right flex items-center gap-2">
                                            <span className={`font-black text-sm sm:text-base ${modoEdicao ? 'text-amber-600' : 'text-emerald-600'}`}>{formatarMoeda(p.price)}</span>
                                            {isMasterAdmin && (
                                                <div className="flex items-center gap-1.5 ml-1">
                                                    {onEditarProduto && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onEditarProduto(p);
                                                                onClose();
                                                            }}
                                                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg border border-blue-200/60 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
                                                            title="Editar produto"
                                                        >
                                                            <IoCreateOutline size={14} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => handleExcluirProduto(e, p)}
                                                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200/60 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
                                                        title="Excluir produto do catálogo"
                                                    >
                                                        <IoTrashOutline size={14} />
                                                    </button>
                                                </div>
                                            )}
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
                    </>
                ) : (
                    /* Cadastro Form */
                    <form onSubmit={handleCadastrar} className="flex-1 overflow-y-auto p-5 bg-white space-y-4 pdv-scroll">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Nome do Produto *</label>
                            <input
                                ref={nameInputRef}
                                type="text"
                                placeholder="Ex: Produto A"
                                value={nome}
                                onChange={e => setNome(e.target.value)}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Preço de Venda (R$) *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    placeholder="0,00"
                                    value={preco}
                                    onChange={e => setPreco(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Código de Barras (Opcional)</label>
                                <input
                                    type="text"
                                    placeholder="Ex: 789..."
                                    value={codigoBarras}
                                    onChange={e => setCodigoBarras(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Categoria *</label>
                            <select
                                value={categoriaSel}
                                onChange={e => setCategoriaSel(e.target.value)}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all cursor-pointer"
                                required
                            >
                                <option value="">Selecione...</option>
                                {categoriasValidas.map(c => (
                                    <option key={c.id} value={c.name}>{c.name}</option>
                                ))}
                                <option value="nova_categoria">➕ Criar Nova Categoria</option>
                            </select>
                        </div>

                        {categoriaSel === 'nova_categoria' && (
                            <div className="animate-fadeIn">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Nome da Nova Categoria *</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Acessórios"
                                    value={novaCategoriaNome}
                                    onChange={e => setNovaCategoriaNome(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                    required
                                />
                            </div>
                        )}

                        <div className="pt-4 border-t border-slate-100 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setAbaAtiva('buscar')}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-500 py-3.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                            >
                                Voltar
                            </button>
                            <button
                                type="submit"
                                disabled={salvandoProd}
                                className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all shadow-md active:scale-95 disabled:opacity-50"
                            >
                                {salvandoProd ? 'Salvando...' : 'Cadastrar e Lançar (Enter)'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
