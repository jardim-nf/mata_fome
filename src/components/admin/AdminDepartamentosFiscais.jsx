import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { departamentoFiscalService } from '../../services/departamentoFiscalService';
import { useAuth } from '../../context/AuthContext';
import { 
  FiArrowLeft, FiPlus, FiTrash2, FiEdit2, FiSave, FiList, FiAlertCircle, FiActivity
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

export const AdminDepartamentosFiscais = ({ forceEstabId = null, theme = null }) => {
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

    // Determina o tema ativo e classe correspondente
    const activeTheme = theme || localStorage.getItem('dashboard_theme') || 'light';
    const isDark = activeTheme === 'dark';

    const themeClasses = {
        dark: {
            surface: 'bg-slate-950/45 backdrop-blur-xl border border-white/5 shadow-2xl',
            surfaceHover: 'hover:bg-slate-900/50 hover:border-cyan-500/30 hover:shadow-[0_12px_40px_rgba(6,182,212,0.15)] hover:scale-[1.01] hover:-translate-y-0.5 transition-all duration-300',
            border: 'border-white/5',
            text: 'text-slate-100 font-space',
            textSecondary: 'text-slate-400 font-space font-medium',
            textMuted: 'text-slate-500 font-space font-semibold',
            accent: 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]',
            accentHover: 'hover:bg-cyan-600',
            gradient: 'from-cyan-400 via-violet-500 to-fuchsia-500',
            cardBg: 'bg-slate-950/30 backdrop-blur-xl border border-white/5 shadow-2xl',
            inputBg: 'bg-slate-950/75 border-white/5 focus-within:border-cyan-500/50',
            buttonBg: 'bg-slate-900/80 border-white/5 text-slate-355 hover:border-cyan-500/30 hover:text-white',
            tableHeader: 'text-slate-500 border-white/5',
            tableRow: 'bg-slate-950/40 border border-white/5 hover:border-cyan-500/30 hover:bg-slate-900/40 text-slate-150',
            subBox: 'bg-slate-950/30 border border-white/5 text-slate-300',
            inputField: 'bg-slate-950/60 border border-white/5 text-slate-100 focus:border-cyan-500 focus:ring-cyan-500/10'
        },
        light: {
            surface: 'bg-white/70 border border-slate-200/40 shadow-sm backdrop-blur-md',
            surfaceHover: 'hover:bg-white hover:border-stone-300 hover:shadow-[0_12px_45px_rgba(28,25,23,0.06)] hover:scale-[1.01] hover:-translate-y-0.5 transition-all duration-300',
            border: 'border-slate-200/40',
            text: 'text-slate-800 font-space font-bold',
            textSecondary: 'text-slate-550 font-space font-medium',
            textMuted: 'text-slate-400 font-space font-semibold',
            accent: 'bg-emerald-500 shadow-sm',
            accentHover: 'hover:bg-emerald-600',
            gradient: 'from-emerald-500 to-teal-600',
            cardBg: 'bg-white/70 backdrop-blur-md border border-slate-200/40 shadow-sm',
            inputBg: 'bg-stone-100/70 border-stone-200 focus-within:border-[#ff6b35]',
            buttonBg: 'bg-slate-100 hover:bg-slate-200 text-slate-655 border-slate-200/40 text-slate-700',
            tableHeader: 'text-slate-400 border-slate-100',
            tableRow: 'bg-white/80 border border-slate-200/50 hover:border-emerald-250/80 hover:bg-white text-slate-800',
            subBox: 'bg-slate-50/50 border-slate-100/50 text-slate-700',
            inputField: 'bg-white/60 border-slate-200 text-slate-850 focus:border-emerald-500 focus:ring-emerald-500/10'
        }
    };

    const t = themeClasses[activeTheme];

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
            <div className={`rounded-[2rem] border p-6 sm:p-8 relative overflow-hidden shadow-sm animate-fadeIn ${t.surface} ${t.border} font-space`}>
                <div className={`absolute top-0 left-0 w-2.5 h-full ${isDark ? 'bg-cyan-500' : 'bg-emerald-500'}`} />
                
                <div className="flex items-center gap-3 mb-8 ml-2">
                    <button 
                        onClick={() => setSelectedDept(null)} 
                        className={`px-4 py-2 border transition-colors rounded-xl text-xs font-black shrink-0 shadow-sm flex items-center gap-1.5 ${t.buttonBg} ${t.border}`}
                    >
                        <FiArrowLeft size={14} /> Voltar
                    </button>
                    <h2 className={`text-xl font-black font-bricolage tracking-tight flex-1 ${t.text}`}>{selectedDept === 'NEW' ? 'Novo Departamento Fiscal' : 'Alteração Tributária'}</h2>
                </div>

                <div className="space-y-6 ml-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={`block text-[9px] font-black uppercase tracking-wider mb-2 ${t.textMuted}`}>Descrição (Nome)</label>
                            <input 
                                name="nome" 
                                value={form.nome} 
                                onChange={handleChange} 
                                className={`w-full border text-xs font-bold rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 p-4 transition-all shadow-sm ${t.inputBg} ${t.border} ${t.text}`}
                                placeholder="Ex: BASICO - SIMPLES NACIONAL" 
                                maxLength={50} 
                            />
                        </div>
                        <div>
                            <label className={`block text-[9px] font-black uppercase tracking-wider mb-2 ${t.textMuted}`}>NCM Padrão Opcional</label>
                            <input 
                                name="ncm" 
                                value={form.ncm} 
                                onChange={handleChange} 
                                className={`w-full border text-xs font-bold rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 p-4 transition-all shadow-sm ${t.inputBg} ${t.border} ${t.text}`}
                                placeholder="Ex: 22021000" 
                                maxLength={8} 
                            />
                        </div>
                    </div>

                    <div className={`p-6 rounded-[2rem] border ${t.subBox} ${t.border}`}>
                        <h3 className={`text-[10px] font-black uppercase tracking-wider mb-6 flex items-center gap-2 ${t.textMuted}`}><FiList size={12} /> CFOPs Base</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className={`p-5 rounded-3xl border shadow-sm flex flex-col justify-between ${t.cardBg} ${t.border}`}>
                                <label className={`block text-[9px] font-black uppercase tracking-wider mb-4 ${t.textMuted}`}>Vendas NF-e</label>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <span className={`text-xs font-bold ${t.textSecondary}`}>Mesmo Estado</span>
                                        <input 
                                            name="cfop_nfe_estado" 
                                            value={form.cfop_nfe_estado} 
                                            onChange={handleChange} 
                                            className={`w-24 p-2 border focus:ring-4 focus:ring-emerald-500/10 rounded-xl outline-none text-xs text-center font-bold transition-all ${t.inputBg} ${t.border} ${t.text}`}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <span className={`text-xs font-bold ${t.textSecondary}`}>Fora da UF</span>
                                        <input 
                                            name="cfop_nfe_fora" 
                                            value={form.cfop_nfe_fora} 
                                            onChange={handleChange} 
                                            className={`w-24 p-2 border focus:ring-4 focus:ring-emerald-500/10 rounded-xl outline-none text-xs text-center font-bold transition-all ${t.inputBg} ${t.border} ${t.text}`}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className={`p-5 rounded-3xl border shadow-sm flex flex-col justify-between ${t.cardBg} ${t.border}`}>
                                <label className={`block text-[9px] font-black uppercase tracking-wider mb-4 ${t.textMuted}`}>Cupons NFC-e</label>
                                <div className="space-y-4 font-space">
                                    <div className="flex items-center justify-between gap-4">
                                        <span className={`text-xs font-bold ${t.textSecondary}`}>CFOP Operação</span>
                                        <input 
                                            name="cfop_nfce" 
                                            value={form.cfop_nfce} 
                                            onChange={handleChange} 
                                            className={`w-24 p-2 border focus:ring-4 focus:ring-emerald-500/10 rounded-xl outline-none text-xs text-center font-black transition-all ${t.inputBg} ${isDark ? 'border-cyan-500/30' : 'border-emerald-300'} ${t.text}`}
                                        />
                                    </div>
                                    <p className={`text-[10px] font-medium leading-relaxed ${t.textSecondary}`}>Este é o CFOP primário utilizado pelas frentes de caixa/POS no cardápio.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={`p-6 rounded-[2rem] border ${t.subBox} ${t.border}`}>
                        <h3 className={`text-[10px] font-black uppercase tracking-wider mb-6 flex items-center gap-2 ${t.textMuted}`}><FiActivity size={12} /> Matriz Tributária (Taxas base)</h3>
                        
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div>
                                <label className={`block text-[9px] font-black uppercase tracking-wider mb-2 text-center ${t.textMuted}`}>CSOSN</label>
                                <input 
                                    name="csosn" 
                                    value={form.csosn} 
                                    onChange={handleChange} 
                                    className={`w-full p-3 border rounded-xl font-bold text-center focus:ring-4 focus:ring-emerald-500/10 outline-none text-xs font-mono-jb ${t.inputBg} ${t.border} ${t.text}`}
                                />
                            </div>
                            <div>
                                <label className={`block text-[9px] font-black uppercase tracking-wider mb-2 text-center ${t.textMuted}`}>CST PIS</label>
                                <input 
                                    name="cst_pis" 
                                    value={form.cst_pis} 
                                    onChange={handleChange} 
                                    className={`w-full p-3 border rounded-xl font-bold text-center focus:ring-4 focus:ring-emerald-500/10 outline-none text-xs font-mono-jb ${t.inputBg} ${t.border} ${t.text}`}
                                />
                            </div>
                            <div>
                                <label className={`block text-[9px] font-black uppercase tracking-wider mb-2 text-center ${t.textMuted}`}>CST COFINS</label>
                                <input 
                                    name="cst_cofins" 
                                    value={form.cst_cofins} 
                                    onChange={handleChange} 
                                    className={`w-full p-3 border rounded-xl font-bold text-center focus:ring-4 focus:ring-emerald-500/10 outline-none text-xs font-mono-jb ${t.inputBg} ${t.border} ${t.text}`}
                                />
                            </div>
                            <div>
                                <label className={`block text-[9px] font-black uppercase tracking-wider mb-2 text-center ${t.textMuted}`}>CST IPI</label>
                                <input 
                                    name="cst_ipi" 
                                    value={form.cst_ipi} 
                                    onChange={handleChange} 
                                    className={`w-full p-3 border rounded-xl font-bold text-center focus:ring-4 focus:ring-emerald-500/10 outline-none text-xs font-mono-jb ${t.inputBg} ${t.border} ${t.text}`}
                                />
                            </div>
                            <div>
                                <label className={`block text-[9px] font-black uppercase tracking-wider mb-2 text-center ${t.textMuted}`}>% ICMS</label>
                                <input 
                                    name="aliq_icms" 
                                    value={form.aliq_icms} 
                                    onChange={handleChange} 
                                    className={`w-full p-3 border rounded-xl font-bold text-center focus:ring-4 focus:ring-emerald-500/10 outline-none text-xs font-mono-jb ${t.inputBg} ${t.border} ${t.text}`}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 flex items-center justify-end gap-4 border-t border-white/5">
                        <button 
                            onClick={handleSalvar} 
                            disabled={isLoading} 
                            className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl font-black text-xs transition-all active:scale-[0.99] disabled:opacity-50 border shadow-md ${
                              isDark ? 'bg-cyan-500 hover:bg-cyan-600 text-slate-950 border-cyan-400/20 shadow-cyan-500/15' : 'bg-stone-900 hover:bg-stone-850 text-white'
                            }`}
                        >
                            {isLoading ? 'Processando...' : <><FiSave size={14} /> Salvar Diretrizes Fiscais</>}
                        </button>
                    </div>
                </div>

            </div>
        );
    }

    return (
        <div className={`rounded-[2rem] border p-6 sm:p-8 shadow-sm font-space ${t.surface} ${t.border}`}>
            <div className="flex xl:items-center justify-between flex-col xl:flex-row mb-8 gap-4">
                <div>
                    <h2 className={`text-xl font-black font-bricolage tracking-tight flex items-center gap-2 ${t.text}`}>
                        <FiList className={isDark ? 'text-cyan-400' : 'text-emerald-500'} />
                        Painel de CFOP e Tributos
                    </h2>
                    <p className={`text-xs font-medium ${t.textSecondary} mt-1`}>Acervo centralizado. Válido para a emissão de CF-e e NFC-e na rede.</p>
                </div>
                
                <button 
                    onClick={handleNovo} 
                    className={`flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-black text-xs transition-all active:scale-95 border shadow-md ${
                      isDark ? 'bg-cyan-500 hover:bg-cyan-600 text-slate-950 border-cyan-400/20 shadow-cyan-500/15' : 'bg-stone-900 hover:bg-stone-850 text-white'
                    }`}
                >
                    <FiPlus size={14} /> Novo Departamento Fiscal
                </button>
            </div>

            {isLoading ? (
                <div className={`flex justify-center py-16 font-bold text-xs ${t.textSecondary}`}>
                    <div className={`w-8 h-8 border-4 border-t-cyan-500 rounded-full animate-spin mr-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`} />
                    Sincronizando tabelas...
                </div>
            ) : departamentos.length === 0 ? (
                <div className={`text-center py-20 rounded-[2rem] border border-dashed relative overflow-hidden ${t.cardBg} ${t.border}`}>
                    <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none"></div>
                    <div className="relative z-10 flex flex-col items-center">
                        <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 border ${t.inputBg} ${t.border}`}>
                            <FiList className={`text-2xl ${t.textSecondary}`} />
                        </div>
                        <h3 className={`text-lg font-black font-bricolage ${t.text}`}>Sem Políticas Fiscais</h3>
                        <p className={`text-xs ${t.textSecondary} mb-6 font-semibold max-w-xs mx-auto leading-relaxed`}>Esta rede ainda não possui nenhum modelo de departamento configurado para emissão.</p>
                        <button onClick={handleNovo} className={`px-6 py-2.5 rounded-xl font-bold border transition-all text-xs ${t.buttonBg} ${t.border} ${t.text}`}>Definir o Primeiro</button>
                    </div>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <div className="min-w-max space-y-3 pb-4">
                        <div className="flex text-[10px] font-black uppercase tracking-wider text-slate-500 px-4 pb-2 border-b border-white/5">
                            <div className="flex-[0.5] text-center">ID</div>
                            <div className="flex-[2] ml-2">Descrição</div>
                            <div className="flex-1 text-center">Dpto CFOP</div>
                            <div className="flex-[0.5] text-center">CSOSN</div>
                            <div className="flex-[0.5] text-center">NCM</div>
                            <div className="flex-[0.8] text-right">Ação</div>
                        </div>

                        {departamentos.map((d, i) => (
                            <div key={d.id} className={`flex items-center px-4 py-4 rounded-2xl border transition-all duration-300 cursor-default ${t.tableRow}`}>
                                <div className="flex-[0.5] text-center">
                                    <span className={`text-xs font-black ${t.textSecondary}`}>#{i+1}</span>
                                </div>
                                <div className="flex-[2] ml-2 flex flex-col justify-center font-space">
                                    <span className={`font-black text-sm ${t.text}`}>{d.nome}</span>
                                    {d.estabelecimentoId === 'GLOBAL' && (
                                        <span className={`text-[8px] font-black uppercase border px-2 py-0.5 rounded-md mt-1 w-max ${
                                          isDark ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-blue-50 text-blue-700 border-blue-200'
                                        }`}>
                                            Master Global Rule
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 flex justify-center">
                                    <span className={`border text-xs font-black px-3.5 py-1.5 rounded-xl font-mono-jb ${
                                      isDark ? 'bg-slate-900 border-white/5 text-slate-350' : 'bg-slate-50 border-slate-200 text-slate-700'
                                    }`}>{d.cfop_nfce || '-'}</span>
                                </div>
                                <div className={`flex-[0.5] text-center font-bold text-xs font-mono-jb ${t.textSecondary}`}>
                                    {d.csosn || '-'}
                                </div>
                                <div className={`flex-[0.5] text-center text-xs font-mono-jb font-semibold ${t.textSecondary}`}>
                                    {d.ncm || '-'}
                                </div>
                                <div className="flex-[0.8] flex justify-end gap-2">
                                    {(forceEstabId === 'GLOBAL' || d.estabelecimentoId !== 'GLOBAL') && (
                                        <>
                                            <button 
                                                onClick={() => handleEdit(d)} 
                                                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors border shadow-sm ${t.buttonBg} ${t.border}`}
                                                title="Editar"
                                            >
                                                <FiEdit2 size={13} />
                                            </button>
                                            <button 
                                                onClick={() => triggerExcluir(d.id, d.nome)} 
                                                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors border shadow-sm ${
                                                  isDark ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' : 'bg-red-50 border-red-200 text-red-650 hover:bg-red-100'
                                                }`} 
                                                title="Excluir"
                                            >
                                                <FiTrash2 size={13} />
                                            </button>
                                        </>
                                    )}
                                    {(!forceEstabId && d.estabelecimentoId === 'GLOBAL') && (
                                        <span className={`text-[9px] font-black uppercase tracking-wider py-2 pr-2 ${t.textSecondary}`}>Master Rule</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Custom Confirm Delete Modal */}
            <AnimatePresence>
              {deleteConfirmOpen && (
                  <div className="fixed inset-0 bg-slate-950/60 z-[5000] backdrop-blur-sm flex items-center justify-center p-4">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`rounded-[2.2rem] p-6 max-w-sm w-full shadow-2xl border relative overflow-hidden ${t.cardBg} ${t.border}`}
                      >
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border ${
                            isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-100 text-red-500'
                          }`}>
                              <FiAlertCircle size={22} />
                          </div>
                          <h3 className={`text-lg font-black font-bricolage tracking-tight mb-2 ${t.text}`}>Excluir Departamento?</h3>
                          <p className={`text-xs font-semibold leading-relaxed mb-6 ${t.textSecondary}`}>
                              Deseja realmente excluir o departamento fiscal <strong className={t.text}>"{deptToDelete?.nome}"</strong>? Os produtos vinculados perderão a referência de impostos base.
                          </p>
                          
                          <div className="flex gap-3">
                              <button 
                                  onClick={() => { setDeleteConfirmOpen(false); setDeptToDelete(null); }}
                                  className={`flex-1 py-3.5 rounded-xl font-black text-xs border ${t.buttonBg} ${t.border}`}
                              >
                                  Cancelar
                              </button>
                              <button 
                                  onClick={confirmarExclusao}
                                  className={`flex-1 py-3.5 rounded-xl font-black text-xs text-white transition-all shadow-lg border ${
                                    isDark ? 'bg-red-600 hover:bg-red-700 border-red-500/20 shadow-red-650/20' : 'bg-red-500 hover:bg-red-600 border-red-400'
                                  }`}
                              >
                                  Excluir
                              </button>
                          </div>
                      </motion.div>
                  </div>
              )}
            </AnimatePresence>
        </div>
    );
};
