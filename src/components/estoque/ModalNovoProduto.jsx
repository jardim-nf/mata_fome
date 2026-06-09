import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, doc, serverTimestamp, setDoc, getDocs, addDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { IoAddCircleOutline, IoCloseOutline, IoPricetagOutline, IoCheckmarkCircleOutline } from 'react-icons/io5';
import { departamentoFiscalService } from '../../services/departamentoFiscalService';

const ModalNovoProduto = ({ produtoNota, margemPadrao, estabelecimentoId, onSalvo, onFechar, isDark: propIsDark }) => {
    const isDark = propIsDark !== undefined ? propIsDark : localStorage.getItem('dashboard_theme') === 'dark';
    const [categorias, setCategorias] = useState([]);
    const [departamentosFiscais, setDepartamentosFiscais] = useState([]);
    const [salvando, setSalvando] = useState(false);

    const custoUnit = Number(produtoNota?.valorUnit) || 0;
    const precoSugerido = custoUnit * (1 + margemPadrao / 100);

    const [form, setForm] = useState({
        nome: produtoNota?.nome || '',
        categoria: '',
        preco: precoSugerido.toFixed(2),
        custo: custoUnit.toFixed(2),
        estoque: produtoNota?.qtd || 0,
        estoqueMinimo: 0,
        unidade: produtoNota?.unidade || 'UN',
        codigoBarras: produtoNota?.ean && produtoNota.ean !== 'SEM GTIN' ? produtoNota.ean : '',
        descricao: '',
        fiscal: {
            ncm: produtoNota?.ncm || '',
            cfop: '5102',
            unidade: produtoNota?.unidade || 'UN',
            origem: '0',
            csosn: '102',
            cest: '',
            aliquotaIcms: 0,
            departamentoId: ''
        }
    });

    useEffect(() => {
        const buscar = async () => {
            if (!estabelecimentoId) return;
            const snap = await getDocs(collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio'));
            setCategorias(snap.docs.map(d => ({ id: d.id, nome: d.data().nome || d.id })));
            
            try {
                const dFs = await departamentoFiscalService.getDepartamentos(estabelecimentoId);
                setDepartamentosFiscais(dFs);
            } catch (error) {
                console.error("Erro ao buscar departamentos:", error);
            }
        };
        buscar();
    }, [estabelecimentoId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleFiscalChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, fiscal: { ...prev.fiscal, [name]: value } }));
    };

    const handleDepartamentoChange = (e) => {
        const depId = e.target.value;
        const dep = departamentosFiscais.find(d => d.id === depId);
        if (dep) {
            setForm(prev => ({
                ...prev,
                fiscal: {
                    ...prev.fiscal,
                    departamentoId: depId,
                    ncm: dep.ncm || prev.fiscal.ncm,
                    cfop: dep.cfop || prev.fiscal.cfop,
                    csosn: dep.csosn || prev.fiscal.csosn,
                    aliquotaIcms: dep.aliquotaIcms || prev.fiscal.aliquotaIcms,
                    cest: dep.cest || prev.fiscal.cest,
                }
            }));
        } else {
            setForm(prev => ({
                ...prev,
                fiscal: { ...prev.fiscal, departamentoId: '' }
            }));
        }
    };

    const salvar = async () => {
        if (!form.nome.trim() || !form.categoria) {
            toast.error('Preencha Nome e Categoria.'); return;
        }
        setSalvando(true);
        try {
            const catRef = doc(db, 'estabelecimentos', estabelecimentoId, form.categoria);
            await setDoc(catRef, {
                nome: categorias.find(c => c.id === form.categoria)?.nome || form.categoria,
                ativo: true, ordem: 99
            }, { merge: true });

            const itensRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio', form.categoria, 'itens');
            const novoDoc = await addDoc(itensRef, {
                nome: form.nome.trim(),
                preco: Number(form.preco) || 0,
                custo: Number(form.custo) || 0,
                estoque: Number(form.estoque) || 0,
                estoqueMinimo: Number(form.estoqueMinimo) || 0,
                descricao: form.descricao,
                codigoBarras: form.codigoBarras,
                ativo: true,
                disponivel: true,
                fiscal: form.fiscal,
                criadoEm: serverTimestamp(),
            });

            toast.success(`✅ "${form.nome}" cadastrado!`);
            onSalvo({
                id: novoDoc.id,
                name: form.nome.trim(),
                category: form.categoria,
                categoriaNome: categorias.find(c => c.id === form.categoria)?.nome || form.categoria,
                path: `estabelecimentos/${estabelecimentoId}/cardapio/${form.categoria}/itens/${novoDoc.id}`,
                preco: Number(form.preco),
            });
        } catch (err) {
            console.error(err);
            toast.error('Erro ao cadastrar produto.');
        } finally { setSalvando(false); }
    };

    const classes = {
        overlay: 'fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm',
        container: isDark ? 'bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden' : 'bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden',
        header: isDark ? 'p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/40' : 'p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50',
        title: isDark ? 'font-bold text-slate-100 text-lg flex items-center gap-2' : 'font-bold text-gray-800 text-lg flex items-center gap-2',
        subtitle: isDark ? 'text-xs text-slate-400 mt-0.5' : 'text-xs text-gray-550 mt-0.5',
        closeBtn: isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600',
        body: 'p-6 space-y-5 overflow-y-auto max-h-[70vh]',
        infoBox: isDark ? 'bg-blue-950/40 p-4 rounded-xl border border-blue-900/30' : 'bg-blue-50 p-4 rounded-xl border border-blue-100',
        infoLabel: isDark ? 'text-xs text-blue-400 font-bold uppercase mb-1' : 'text-xs text-blue-600 font-bold uppercase mb-1',
        infoTitle: isDark ? 'font-semibold text-slate-200' : 'font-semibold text-gray-800',
        infoMeta: isDark ? 'text-xs text-slate-400 mt-1' : 'text-xs text-gray-550 mt-1',
        label: isDark ? 'text-xs font-bold text-slate-400 uppercase mb-1 block' : 'text-xs font-bold text-gray-600 uppercase mb-1 block',
        input: isDark ? 'w-full p-3 bg-slate-950/60 border border-slate-800 text-slate-100 rounded-xl outline-none text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20' : 'w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm focus:border-blue-550 focus:bg-white',
        sectionHeader: isDark ? 'text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2' : 'text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2',
        sectionBox: isDark ? 'bg-slate-950/40 p-4 rounded-2xl border border-slate-850' : 'bg-gray-50 p-4 rounded-2xl border border-gray-100',
        fiscalLabel: isDark ? 'text-xs font-bold text-emerald-400 uppercase mb-1 block' : 'text-xs font-bold text-emerald-700 uppercase mb-1 block',
        fiscalSelect: isDark ? 'w-full p-3 bg-slate-950/60 border border-emerald-900/40 rounded-xl outline-none font-bold text-emerald-400 shadow-sm text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20' : 'w-full p-3 bg-white border border-emerald-300 rounded-xl outline-none font-bold text-emerald-900 shadow-sm text-sm focus:border-emerald-500',
        fiscalBox: isDark ? 'bg-emerald-950/20 p-4 rounded-2xl border border-emerald-900/40' : 'bg-emerald-50 p-4 rounded-2xl border border-emerald-100',
        fiscalInput: isDark ? 'w-full p-3 bg-slate-950/60 border border-emerald-900/40 text-emerald-300 rounded-xl text-sm font-mono outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-555' : 'w-full p-3 border border-emerald-200 bg-white rounded-xl text-sm font-mono outline-none focus:border-emerald-500',
        sellingLabel: isDark ? 'text-xs font-bold text-emerald-400 uppercase mb-1 block' : 'text-xs font-bold text-emerald-700 uppercase mb-1 block',
        sellingInput: isDark ? 'w-full p-3 bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 rounded-xl text-sm font-bold outline-none focus:border-emerald-500' : 'w-full p-3 border border-emerald-200 bg-emerald-50 rounded-xl text-sm font-bold text-emerald-800 outline-none focus:border-emerald-500',
        footer: isDark ? 'p-6 border-t border-slate-800 flex justify-end gap-3 bg-slate-950/40' : 'p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50',
        btnCancel: isDark ? 'px-6 py-3 rounded-xl border border-slate-800 font-bold text-slate-400 hover:bg-slate-850 hover:text-slate-200 text-sm transition-all' : 'px-6 py-3 rounded-xl border font-bold text-gray-655 hover:bg-gray-100 text-sm transition-all',
    };

    return (
        <div className={classes.overlay}>
            <div className={classes.container}>
                <div className={classes.header}>
                    <div>
                        <h3 className={classes.title}>
                            <IoAddCircleOutline className="text-blue-600 animate-pulse" /> Cadastrar Novo Produto
                        </h3>
                        <p className={classes.subtitle}>Dados pré-preenchidos com a nota fiscal</p>
                    </div>
                    <button onClick={onFechar}><IoCloseOutline size={24} className={classes.closeBtn} /></button>
                </div>

                <div className={classes.body}>
                    <div className={classes.infoBox}>
                        <p className={classes.infoLabel}>Produto na Nota:</p>
                        <p className={classes.infoTitle}>{produtoNota?.nome}</p>
                        <p className={classes.infoMeta}>
                            NCM: {produtoNota?.ncm} • EAN: {produtoNota?.ean || 'SEM EAN'} • Qtd: {produtoNota?.qtd} {produtoNota?.unidade}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className={classes.label}>Nome *</label>
                            <input name="nome" value={form.nome} onChange={handleChange}
                                className={classes.input} />
                        </div>
                        <div>
                            <label className={classes.label}>Categoria *</label>
                            <select name="categoria" value={form.categoria} onChange={handleChange}
                                className={classes.input}>
                                <option value="" className={isDark ? 'bg-slate-950 text-slate-300' : ''}>Selecione...</option>
                                {categorias.map(c => <option key={c.id} value={c.id} className={isDark ? 'bg-slate-950 text-slate-100' : ''}>{c.nome}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={classes.label}>Cód. Barras</label>
                            <input name="codigoBarras" value={form.codigoBarras} onChange={handleChange}
                                className={`${classes.input} font-mono`} />
                        </div>
                    </div>

                    <div className={classes.sectionBox}>
                        <h4 className={classes.sectionHeader}>
                            <IoPricetagOutline /> Preços & Estoque
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label className={classes.sellingLabel}>Venda (R$)</label>
                                <input name="preco" value={form.preco} onChange={handleChange} type="number" step="0.01"
                                    className={classes.sellingInput} />
                            </div>
                            <div>
                                <label className={classes.label}>Custo (R$)</label>
                                <input name="custo" value={form.custo} onChange={handleChange} type="number" step="0.01"
                                    className={classes.input} />
                            </div>
                            <div>
                                <label className={classes.label}>Estoque</label>
                                <input name="estoque" value={form.estoque} onChange={handleChange} type="number"
                                    className={classes.input} />
                            </div>
                            <div>
                                <label className={classes.label}>Mín.</label>
                                <input name="estoqueMinimo" value={form.estoqueMinimo} onChange={handleChange} type="number"
                                    className={classes.input} />
                            </div>
                        </div>
                    </div>

                    <div className={classes.fiscalBox}>
                        <h4 className={classes.fiscalLabel}>🏢 Dados Fiscais</h4>
                        
                        <div className="mb-4">
                            <label className={`${classes.fiscalLabel} text-xs mb-1 block`}>Departamento Fiscal (Preenchimento Automático)</label>
                            <select 
                                value={form.fiscal.departamentoId || ''} 
                                onChange={handleDepartamentoChange} 
                                className={classes.fiscalSelect}
                            >
                                <option value="" className={isDark ? 'bg-slate-950' : ''}>-- Personalizado (Preencher Manualmente) --</option>
                                {departamentosFiscais.map(d => (
                                    <option key={d.id} value={d.id} className={isDark ? 'bg-slate-950 text-slate-100' : ''}>{d.nome} (CFOP: {d.cfop} / NCM: {d.ncm})</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div>
                                <label className={classes.fiscalLabel}>NCM</label>
                                <input name="ncm" value={form.fiscal.ncm} onChange={handleFiscalChange}
                                    disabled={!!form.fiscal.departamentoId}
                                    className={`${classes.fiscalInput} ${form.fiscal.departamentoId ? 'opacity-50 cursor-not-allowed' : ''}`} />
                            </div>
                            <div>
                                <label className={classes.fiscalLabel}>CFOP</label>
                                <select name="cfop" value={form.fiscal.cfop} onChange={handleFiscalChange}
                                    disabled={!!form.fiscal.departamentoId}
                                    className={`${classes.fiscalSelect} ${form.fiscal.departamentoId ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <option value="5102" className={isDark ? 'bg-slate-950' : ''}>5102 - Venda Normal</option>
                                    <option value="5405" className={isDark ? 'bg-slate-950' : ''}>5405 - Subs. Tributária</option>
                                </select>
                            </div>
                            <div>
                                <label className={classes.fiscalLabel}>Unidade</label>
                                <select name="unidade" value={form.fiscal.unidade} onChange={handleFiscalChange}
                                    className={classes.fiscalSelect}>
                                    {['UN', 'KG', 'LT', 'CX', 'PC'].map(u => <option key={u} value={u} className={isDark ? 'bg-slate-950' : ''}>{u}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className={classes.label}>Descrição (opcional)</label>
                        <textarea name="descricao" value={form.descricao} onChange={handleChange}
                            className={`${classes.input} resize-none`}
                            rows={2} placeholder="Detalhes do produto..." />
                    </div>
                </div>

                <div className={classes.footer}>
                    <button onClick={onFechar}
                        className={classes.btnCancel}>
                        Cancelar
                    </button>
                    <button onClick={salvar} disabled={salvando}
                        className="px-8 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 text-sm flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
                        {salvando
                            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : <IoCheckmarkCircleOutline size={18} />}
                        Salvar Produto
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalNovoProduto;
