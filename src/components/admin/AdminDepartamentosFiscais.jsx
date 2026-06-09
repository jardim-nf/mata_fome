import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { departamentoFiscalService } from '../../services/departamentoFiscalService';
import { useAuth } from '../../context/AuthContext';
import { 
  IoAddOutline, IoTrashOutline, IoPencilOutline, IoSaveOutline, 
  IoListOutline, IoArrowBackOutline, IoAlertCircleOutline,
  IoCheckmarkCircleOutline
} from 'react-icons/io5';

export const AdminDepartamentosFiscais = ({ forceEstabId = null }) => {
    const { userData, currentUser, estabelecimentoIdPrincipal } = useAuth();
    const [estabelecimentoId, setEstabelecimentoId] = useState(null);
    const [departamentos, setDepartamentos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedDept, setSelectedDept] = useState(null);

    const [form, setForm] = useState({
        nome: '',
        ncm: '',
        cfop_nfe_estado: '',
        cfop_nfe_fora: '',
        cfop_nfce: '5102',
        csosn: '102',
        cst_pis: '49',
        cst_cofins: '49',
        cst_ipi: '99',
        aliq_icms: '0.00'
    });

    // Custom Confirmation Modal States
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deptToDelete, setDeptToDelete] = useState(null);

    useEffect(() => {
        if (forceEstabId) {
            setEstabelecimentoId(forceEstabId);
            carregarDepartamentos(forceEstabId);
            return;
        }

        if (!userData || !currentUser) return;
        const id = estabelecimentoIdPrincipal || userData.estabelecimentoIdPrincipal || currentUser.uid;
        setEstabelecimentoId(id);
        carregarDepartamentos(id);
    }, [userData, currentUser, forceEstabId, estabelecimentoIdPrincipal]);

    const carregarDepartamentos = async (idEst) => {
        setIsLoading(true);
        try {
            const lista = await departamentoFiscalService.getDepartamentos(idEst);
            setDepartamentos(lista);
        } catch (error) {
            toast.error("Erro ao carregar departamentos fiscais.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleNovo = () => {
        setSelectedDept('NEW');
        setForm({
            nome: '',
            ncm: '',
            cfop_nfe_estado: '5102',
            cfop_nfe_fora: '6102',
            cfop_nfce: '5102',
            csosn: '102',
            cst_pis: '49',
            cst_cofins: '49',
            cst_ipi: '99',
            aliq_icms: '0.00'
        });
    };

    const handleEdit = (dept) => {
        setSelectedDept(dept.id);
        setForm({
            nome: dept.nome || '',
            ncm: dept.ncm || '',
            cfop_nfe_estado: dept.cfop_nfe_estado || '',
            cfop_nfe_fora: dept.cfop_nfe_fora || '',
            cfop_nfce: dept.cfop_nfce || '',
            csosn: dept.csosn || '',
            cst_pis: dept.cst_pis || '',
            cst_cofins: dept.cst_cofins || '',
            cst_ipi: dept.cst_ipi || '',
            aliq_icms: dept.aliq_icms || '0.00'
        });
    };

    const handleSalvar = async () => {
        if (!form.nome) return toast.warning("O nome do departamento é obrigatório.");
        if (!form.cfop_nfce) return toast.warning("O CFOP NFC-e é obrigatório.");
        
        setIsLoading(true);
        try {
            if (selectedDept === 'NEW') {
                await departamentoFiscalService.createDepartamento(estabelecimentoId, form);
                toast.success("Departamento criado com sucesso!");
            } else {
                await departamentoFiscalService.updateDepartamento(selectedDept, form);
                toast.success("Departamento atualizado com sucesso!");
            }
            setSelectedDept(null);
            carregarDepartamentos(estabelecimentoId);
        } catch (error) {
            toast.error("Erro ao salvar.");
        } finally {
            setIsLoading(false);
        }
    };

    const triggerExcluir = (id, nome) => {
        setDeptToDelete({ id, nome });
        setDeleteConfirmOpen(true);
    };

    const confirmarExclusao = async () => {
        if (!deptToDelete) return;
        setIsLoading(true);
        try {
            await departamentoFiscalService.deleteDepartamento(deptToDelete.id);
            toast.success("Departamento excluído com sucesso!");
            if (selectedDept === deptToDelete.id) setSelectedDept(null);
            setDeleteConfirmOpen(false);
            setDeptToDelete(null);
            carregarDepartamentos(estabelecimentoId);
        } catch (e) {
            toast.error("Erro ao excluir.");
        } finally {
            setIsLoading(false);
        }
    };

    // Renderização do formulário de criação / edição
    if (selectedDept) {
        return (
            <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] p-6 sm:p-8 relative overflow-hidden backdrop-blur-md shadow-sm animate-fadeIn">
                <div className="absolute top-0 left-0 w-2.5 h-full bg-emerald-500"></div>
                
                <div className="flex items-center gap-3 mb-8 ml-2">
                    <button 
                        onClick={() => setSelectedDept(null)} 
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-655 transition-colors rounded-xl text-xs font-bold shrink-0 shadow-sm border border-slate-200/40 flex items-center gap-1"
                    >
                        <IoArrowBackOutline size={14} /> Voltar
                    </button>
                    <h2 className="text-xl font-black text-slate-800 flex-1">{selectedDept === 'NEW' ? 'Novo Departamento Fiscal' : 'Alteração Tributária'}</h2>
                </div>

                <div className="space-y-6 ml-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Descrição (Nome)</label>
                            <input name="nome" value={form.nome} onChange={handleChange} className="w-full bg-white/60 hover:bg-white/80 border border-slate-200 text-slate-800 text-sm font-bold rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 p-4 transition-all shadow-sm" placeholder="Ex: BASICO - SIMPLES NACIONAL" maxLength={50} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-extrabold text-slate-455 uppercase tracking-widest mb-1.5">NCM Padrão Opcional</label>
                            <input name="ncm" value={form.ncm} onChange={handleChange} className="w-full bg-white/60 hover:bg-white/80 border border-slate-200 text-slate-800 text-sm font-bold rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 p-4 transition-all shadow-sm" placeholder="Ex: 22021000" maxLength={8} />
                        </div>
                    </div>

                    <div className="bg-slate-50/50 p-6 rounded-[2.2rem] border border-slate-100/50">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">CFOPs Base</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white/80 p-5 rounded-3xl border border-slate-200/50 shadow-sm flex flex-col justify-between">
                                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4">Vendas NF-e</label>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="text-xs font-bold text-slate-500">Mesmo Estado</span>
                                        <input name="cfop_nfe_estado" value={form.cfop_nfe_estado} onChange={handleChange} className="w-24 p-2 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 rounded-xl outline-none text-sm text-center font-bold transition-all" />
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="text-xs font-bold text-slate-500">Fora da UF</span>
                                        <input name="cfop_nfe_fora" value={form.cfop_nfe_fora} onChange={handleChange} className="w-24 p-2 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 rounded-xl outline-none text-sm text-center font-bold transition-all" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/80 p-5 rounded-3xl border border-slate-200/50 shadow-sm flex flex-col justify-between">
                                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4">Cupons NFC-e</label>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="text-xs font-bold text-slate-500">CFOP Operação</span>
                                        <input name="cfop_nfce" value={form.cfop_nfce} onChange={handleChange} className="w-24 p-2 bg-white/60 hover:bg-white/80 border border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 rounded-xl outline-none text-sm text-center font-black transition-all" />
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">Este é o CFOP primário utilizado pelas frentes de caixa/POS no cardápio.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50/50 p-6 rounded-[2.2rem] border border-slate-100/50">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">Matriz Tributária (Taxas base)</h3>
                        
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div>
                                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 text-center">CSOSN</label>
                                <input name="csosn" value={form.csosn} onChange={handleChange} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-center focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none text-sm" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 text-center">CST PIS</label>
                                <input name="cst_pis" value={form.cst_pis} onChange={handleChange} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-center focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none text-sm" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 text-center">CST COFINS</label>
                                <input name="cst_cofins" value={form.cst_cofins} onChange={handleChange} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-center focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none text-sm" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 text-center">CST IPI</label>
                                <input name="cst_ipi" value={form.cst_ipi} onChange={handleChange} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-center focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none text-sm" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 text-center">% ICMS</label>
                                <input name="aliq_icms" value={form.aliq_icms} onChange={handleChange} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-center focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none text-sm" />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 flex items-center justify-end gap-4 border-t border-slate-100">
                        <button 
                            onClick={handleSalvar} 
                            disabled={isLoading} 
                            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-8 py-3.5 rounded-2xl font-bold shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.99] disabled:opacity-50 text-xs border border-emerald-400/30"
                        >
                            {isLoading ? 'Processando...' : <><IoSaveOutline size={16} /> Salvar Diretrizes Fiscais</>}
                        </button>
                    </div>
                </div>

            </div>
        );
    }

    return (
        <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] p-6 sm:p-8 shadow-sm backdrop-blur-md font-sans">
            <div className="flex xl:items-center justify-between flex-col xl:flex-row mb-8 gap-4">
                <div>
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <IoListOutline className="text-emerald-500" />
                        Painel de CFOP e Tributos
                    </h2>
                    <p className="text-xs font-semibold text-slate-500 mt-1">Acervo centralizado. Válido para a emissão de CF-e e NFC-e na rede.</p>
                </div>
                
                <button 
                    onClick={handleNovo} 
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-6 py-3 font-bold text-sm rounded-2xl transition-all shadow-lg shadow-emerald-500/25 active:scale-95 border border-emerald-400/30 max-w-fit"
                >
                    <IoAddOutline size={18} /> Novo Departamento Fiscal
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-16 text-slate-400 font-bold text-sm">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mr-3"></div>
                    Sincronizando tabelas...
                </div>
            ) : departamentos.length === 0 ? (
                <div className="text-center py-20 bg-slate-50/50 rounded-[2.2rem] border-2 border-dashed border-slate-200/60 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-35 pointer-events-none"></div>
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-16 h-16 bg-white rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-sm border border-slate-200/50">
                            <IoListOutline className="text-2xl text-slate-400" />
                        </div>
                        <h3 className="font-black text-slate-700 text-lg">Sem Políticas Fiscais</h3>
                        <p className="text-xs text-slate-400 mb-6 font-semibold max-w-xs mx-auto leading-relaxed">Esta rede ainda não possui nenhum modelo de departamento configurado para emissão.</p>
                        <button onClick={handleNovo} className="bg-white border border-slate-200 text-slate-655 px-6 py-2.5 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition-all text-xs">Definir o Primeiro</button>
                    </div>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <div className="min-w-max space-y-3 pb-4">
                        <div className="flex text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-4 pb-2 border-b border-slate-100">
                            <div className="flex-[0.5] text-center">ID</div>
                            <div className="flex-[2] ml-2">Descrição</div>
                            <div className="flex-1 text-center">Dpto CFOP</div>
                            <div className="flex-[0.5] text-center">CSOSN</div>
                            <div className="flex-[0.5] text-center">NCM (S.G)</div>
                            <div className="flex-[0.8] text-right">Ação</div>
                        </div>

                        {departamentos.map((d, i) => (
                            <div key={d.id} className="flex items-center px-4 py-4 bg-white/80 hover:bg-white border border-slate-200/50 hover:border-emerald-250/80 rounded-2xl hover:shadow-md transition-all duration-300 cursor-default">
                                <div className="flex-[0.5] text-center">
                                    <span className="text-xs text-slate-400 font-extrabold">#{i+1}</span>
                                </div>
                                <div className="flex-[2] ml-2 flex flex-col justify-center">
                                    <span className="font-bold text-slate-800 text-sm">{d.nome}</span>
                                    {d.estabelecimentoId === 'GLOBAL' && (
                                        <span className="text-[9px] font-black uppercase text-blue-500 bg-blue-50 border border-blue-200/30 px-2 py-0.5 rounded-md mt-1 w-max">
                                            Master Global Rule
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 flex justify-center">
                                    <span className="bg-slate-50 text-slate-700 border border-slate-200/60 text-xs font-black px-3 py-1 rounded-lg">{d.cfop_nfce || '-'}</span>
                                </div>
                                <div className="flex-[0.5] text-center font-bold text-slate-500 text-xs">
                                    {d.csosn || '-'}
                                </div>
                                <div className="flex-[0.5] text-center font-mono text-slate-500 text-xs font-bold">
                                    {d.ncm || '-'}
                                </div>
                                <div className="flex-[0.8] flex justify-end gap-2">
                                    {(forceEstabId === 'GLOBAL' || d.estabelecimentoId !== 'GLOBAL') && (
                                        <>
                                            <button 
                                                onClick={() => handleEdit(d)} 
                                                className="w-8 h-8 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-emerald-500 hover:text-white hover:border-transparent transition-colors shadow-sm border border-slate-200/50" 
                                                title="Editar"
                                            >
                                                <IoPencilOutline size={14} />
                                            </button>
                                            <button 
                                                onClick={() => triggerExcluir(d.id, d.nome)} 
                                                className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white hover:border-transparent transition-colors shadow-sm border border-red-100" 
                                                title="Excluir"
                                            >
                                                <IoTrashOutline size={14} />
                                            </button>
                                        </>
                                    )}
                                    {(!forceEstabId && d.estabelecimentoId === 'GLOBAL') && (
                                        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide py-2 pr-2">Master Rule</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Custom Confirm Delete Modal */}
            {deleteConfirmOpen && (
                <div className="fixed inset-0 bg-black/60 z-[5000] backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white/95 backdrop-blur-md rounded-[2.2rem] border border-slate-200 p-6 max-w-sm w-full shadow-2xl relative animate-scaleUp text-left">
                        <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500 mb-4 shadow-sm">
                            <IoAlertCircleOutline size={24} />
                        </div>
                        <h3 className="text-lg font-black text-slate-800 mb-2">Excluir Departamento Fiscal?</h3>
                        <p className="text-xs text-slate-500 font-semibold leading-relaxed mb-6">
                            Deseja realmente excluir o departamento fiscal <strong className="text-slate-850">"{deptToDelete?.nome}"</strong>? Os produtos vinculados perderão a referência de impostos base.
                        </p>
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={() => { setDeleteConfirmOpen(false); setDeptToDelete(null); }}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-250 text-slate-655 rounded-xl font-bold text-xs transition-all border border-slate-200/50"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={confirmarExclusao}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-red-650/20 border border-red-500/20"
                            >
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
