import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, doc, serverTimestamp, setDoc, getDocs, addDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { IoAddCircleOutline, IoCloseOutline, IoPricetagOutline, IoCheckmarkCircleOutline } from 'react-icons/io5';
import { departamentoFiscalService } from '../../services/departamentoFiscalService';

const ModalNovoProduto = ({ produtoNota, margemPadrao, estabelecimentoId, onSalvo, onFechar }) => {
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
            const catRef = doc(db, 'estabelecimentos', estabelecimentoId, 'cardapio', form.categoria);
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

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                            <IoAddCircleOutline className="text-blue-600" /> Cadastrar Novo Produto
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">Dados pré-preenchidos com a nota fiscal</p>
                    </div>
                    <button onClick={onFechar}><IoCloseOutline size={24} className="text-gray-400" /></button>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm">
                        <p className="text-xs text-blue-600 font-bold uppercase mb-1">Produto na Nota:</p>
                        <p className="font-semibold text-gray-800">{produtoNota?.nome}</p>
                        <p className="text-xs text-gray-500 mt-1">
                            NCM: {produtoNota?.ncm} • EAN: {produtoNota?.ean || 'SEM EAN'} • Qtd: {produtoNota?.qtd} {produtoNota?.unidade}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Nome *</label>
                            <input name="nome" value={form.nome} onChange={handleChange}
                                className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Categoria *</label>
                            <select name="categoria" value={form.categoria} onChange={handleChange}
                                className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm">
                                <option value="">Selecione...</option>
                                {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Cód. Barras</label>
                            <input name="codigoBarras" value={form.codigoBarras} onChange={handleChange}
                                className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm font-mono" />
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                            <IoPricetagOutline /> Preços & Estoque
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="text-xs font-bold text-emerald-600 uppercase mb-1 block">Venda (R$)</label>
                                <input name="preco" value={form.preco} onChange={handleChange} type="number" step="0.01"
                                    className="w-full p-3 border border-emerald-200 bg-emerald-50 rounded-xl text-sm font-bold text-emerald-800 outline-none" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Custo (R$)</label>
                                <input name="custo" value={form.custo} onChange={handleChange} type="number" step="0.01"
                                    className="w-full p-3 border border-gray-200 bg-white rounded-xl text-sm outline-none" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Estoque</label>
                                <input name="estoque" value={form.estoque} onChange={handleChange} type="number"
                                    className="w-full p-3 border border-gray-200 bg-white rounded-xl text-sm outline-none" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Mín.</label>
                                <input name="estoqueMinimo" value={form.estoqueMinimo} onChange={handleChange} type="number"
                                    className="w-full p-3 border border-gray-200 bg-white rounded-xl text-sm outline-none" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                        <h4 className="text-xs font-bold text-emerald-700 uppercase mb-3">🏢 Dados Fiscais</h4>
                        
                        <div className="mb-4">
                            <label className="text-xs font-bold text-emerald-700 uppercase mb-1 block">Departamento Fiscal (Preenchimento Automático)</label>
                            <select 
                                value={form.fiscal.departamentoId || ''} 
                                onChange={handleDepartamentoChange} 
                                className="w-full p-3 bg-white border border-emerald-300 rounded-xl outline-none font-bold text-emerald-900 shadow-sm text-sm"
                            >
                                <option value="">-- Personalizado (Preencher Manualmente) --</option>
                                {departamentosFiscais.map(d => (
                                    <option key={d.id} value={d.id}>{d.nome} (CFOP: {d.cfop} / NCM: {d.ncm})</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs font-bold text-emerald-700 uppercase mb-1 block">NCM</label>
                                <input name="ncm" value={form.fiscal.ncm} onChange={handleFiscalChange}
                                    disabled={!!form.fiscal.departamentoId}
                                    className={`w-full p-3 border border-emerald-200 bg-white rounded-xl text-sm font-mono outline-none ${form.fiscal.departamentoId ? 'opacity-70 bg-gray-50' : ''}`} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-emerald-700 uppercase mb-1 block">CFOP</label>
                                <select name="cfop" value={form.fiscal.cfop} onChange={handleFiscalChange}
                                    disabled={!!form.fiscal.departamentoId}
                                    className={`w-full p-3 border border-emerald-200 bg-white rounded-xl text-sm outline-none ${form.fiscal.departamentoId ? 'opacity-70 bg-gray-50' : ''}`}>
                                    <option value="5102">5102 - Venda Normal</option>
                                    <option value="5405">5405 - Subs. Tributária</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-emerald-700 uppercase mb-1 block">Unidade</label>
                                <select name="unidade" value={form.fiscal.unidade} onChange={handleFiscalChange}
                                    className="w-full p-3 border border-emerald-200 bg-white rounded-xl text-sm outline-none">
                                    {['UN', 'KG', 'LT', 'CX', 'PC'].map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-600 uppercase mb-1 block">Descrição (opcional)</label>
                        <textarea name="descricao" value={form.descricao} onChange={handleChange}
                            className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 outline-none text-sm resize-none"
                            rows={2} placeholder="Detalhes do produto..." />
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                    <button onClick={onFechar}
                        className="px-6 py-3 rounded-xl border font-bold text-gray-600 hover:bg-gray-100 text-sm">
                        Cancelar
                    </button>
                    <button onClick={salvar} disabled={salvando}
                        className="px-8 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 text-sm flex items-center gap-2 disabled:opacity-50">
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
