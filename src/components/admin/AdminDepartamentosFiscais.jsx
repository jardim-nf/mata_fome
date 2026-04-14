import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { departamentoFiscalService } from '../../services/departamentoFiscalService';
import { useAuth } from '../../context/AuthContext';
import { FaPlus, FaTrash, FaEdit, FaSave, FaClipboardList } from 'react-icons/fa';

export const AdminDepartamentosFiscais = ({ forceEstabId = null }) => {
    const { userData, currentUser } = useAuth();
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

    useEffect(() => {
        if (forceEstabId) {
            setEstabelecimentoId(forceEstabId);
            carregarDepartamentos(forceEstabId);
            return;
        }

        if (!userData || !currentUser) return;
        const id = userData.estabelecimentosGerenciados?.[0] || currentUser.uid;
        setEstabelecimentoId(id);
        carregarDepartamentos(id);
    }, [userData, currentUser, forceEstabId]);

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

    const handleExcluir = async (id) => {
        if(!window.confirm("Deseja realmente excluir este departamento fiscal? Os produtos vinculados perderão a referência de impostos base.")) return;
        setIsLoading(true);
        try{
            await departamentoFiscalService.deleteDepartamento(id);
            toast.success("Departamento excluído.");
            if(selectedDept === id) setSelectedDept(null);
            carregarDepartamentos(estabelecimentoId);
        } catch(e){
            toast.error("Erro ao excluir.");
        } finally {
            setIsLoading(false);
        }
    };

    // Renderização do formulário
    if (selectedDept) {
        return (
            <div className="bg-white rounded-[2rem] shadow-sm border border-[#E5E5EA] p-8 relative overflow-hidden font-sans">
                <div className="absolute top-0 left-0 w-2 h-full bg-[#1D1D1F]"></div>
                <div className="flex items-center gap-3 mb-8 ml-2">
                    <button onClick={() => setSelectedDept(null)} className="px-4 py-2 bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E5E5EA] transition-colors rounded-full text-xs font-bold shrink-0">Voltar</button>
                    <h2 className="text-xl font-bold text-[#1D1D1F] flex-1">{selectedDept === 'NEW' ? 'Novo Departamento Fiscal' : 'Alteração Tributária'}</h2>
                </div>

                <div className="space-y-8 ml-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-2">Descrição (Nome)</label>
                            <input name="nome" value={form.nome} onChange={handleChange} className="w-full bg-[#F5F5F7] border border-[#E5E5EA] text-[#1D1D1F] text-sm font-semibold rounded-3xl outline-none focus:bg-white focus:border-black p-4 transition-all" placeholder="Ex: BASICO - SIMPLES NACIONAL" maxLength={50} />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-2">NCM Padrão Opcional</label>
                            <input name="ncm" value={form.ncm} onChange={handleChange} className="w-full bg-[#F5F5F7] border border-[#E5E5EA] text-[#1D1D1F] text-sm font-semibold rounded-3xl outline-none focus:bg-white focus:border-black p-4 transition-all" placeholder="Ex: 22021000" maxLength={8} />
                        </div>
                    </div>

                    <div className="bg-[#F5F5F7] p-6 rounded-[2rem] border border-[#E5E5EA]">
                        <h3 className="text-sm font-bold text-[#1D1D1F] mb-6 flex items-center gap-2">CFOPs Base</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-5 rounded-3xl border border-[#E5E5EA] shadow-sm">
                                <label className="block text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-4">Vendas NF-e</label>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="text-xs font-semibold text-[#86868B]">Mesmo Estado</span>
                                        <input name="cfop_nfe_estado" value={form.cfop_nfe_estado} onChange={handleChange} className="w-24 p-2 bg-[#F5F5F7] border border-[#E5E5EA] rounded-xl outline-none focus:border-black text-sm text-center font-semibold" />
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="text-xs font-semibold text-[#86868B]">Fora da UF</span>
                                        <input name="cfop_nfe_fora" value={form.cfop_nfe_fora} onChange={handleChange} className="w-24 p-2 bg-[#F5F5F7] border border-[#E5E5EA] rounded-xl outline-none focus:border-black text-sm text-center font-semibold" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-3xl border border-[#E5E5EA] shadow-sm">
                                <label className="block text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-4">Cupons NFC-e</label>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="text-xs font-semibold text-[#86868B]">CFOP Operação</span>
                                        <input name="cfop_nfce" value={form.cfop_nfce} onChange={handleChange} className="w-24 p-2 bg-[#F5F5F7] border border-[#1D1D1F] rounded-xl outline-none focus:border-black text-sm text-center font-black" />
                                    </div>
                                    <p className="text-[10px] text-[#86868B] font-medium leading-relaxed">Este é o CFOP primário utilizado <br/> pelas frentes de caixa/POS.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#F5F5F7] p-6 rounded-[2rem] border border-[#E5E5EA]">
                        <h3 className="text-sm font-bold text-[#1D1D1F] mb-6 flex items-center gap-2">Matriz Tributária (Taxas em Múltiplas NF)</h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-[#86868B] uppercase mb-2">CSOSN</label>
                                <input name="csosn" value={form.csosn} onChange={handleChange} className="w-full p-3 bg-white border border-[#E5E5EA] rounded-xl font-semibold text-center focus:border-black outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[#86868B] uppercase mb-2">CST PIS</label>
                                <input name="cst_pis" value={form.cst_pis} onChange={handleChange} className="w-full p-3 bg-white border border-[#E5E5EA] rounded-xl font-semibold text-center focus:border-black outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[#86868B] uppercase mb-2">CST COFINS</label>
                                <input name="cst_cofins" value={form.cst_cofins} onChange={handleChange} className="w-full p-3 bg-white border border-[#E5E5EA] rounded-xl font-semibold text-center focus:border-black outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[#86868B] uppercase mb-2">CST IPI</label>
                                <input name="cst_ipi" value={form.cst_ipi} onChange={handleChange} className="w-full p-3 bg-white border border-[#E5E5EA] rounded-xl font-semibold text-center focus:border-black outline-none" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[#86868B] uppercase mb-2">% ICMS</label>
                                <input name="aliq_icms" value={form.aliq_icms} onChange={handleChange} className="w-full p-3 bg-white border border-[#E5E5EA] rounded-xl font-semibold text-center focus:border-black outline-none" />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 flex items-center justify-end gap-4 border-t border-[#F5F5F7]">
                        <button onClick={handleSalvar} disabled={isLoading} className="flex items-center gap-2 bg-[#1D1D1F] text-white px-8 py-3.5 rounded-full font-bold shadow-sm hover:bg-black transition-all active:scale-95 disabled:opacity-50 text-sm">
                            {isLoading ? 'Processando...' : <><FaSave /> Validar Diretrizes Fiscais</>}
                        </button>
                    </div>
                </div>

            </div>
        );
    }

    return (
        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-[#E5E5EA] font-sans">
            <div className="flex xl:items-center justify-between flex-col xl:flex-row mb-8 gap-4">
                <div>
                    <h2 className="text-xl font-bold text-[#1D1D1F] flex items-center gap-2">Painel de CFOP e Tributos</h2>
                    <p className="text-sm font-medium text-[#86868B] mt-1">Acervo centralizado. Válido para a emissão de CF-e e NFC-e na rede.</p>
                </div>
                <button onClick={handleNovo} className="flex items-center justify-center gap-2 bg-[#1D1D1F] text-white hover:bg-black px-6 py-3 font-bold text-sm rounded-full transition-all shadow-sm active:scale-95 max-w-fit">
                    <FaPlus /> Novo Departamento Fiscal
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-8 text-[#86868B] font-bold text-sm">
                    <div className="w-8 h-8 border-4 border-[#E5E5EA] border-t-black rounded-full animate-spin mr-3"></div>
                    Sincronizando tabelas...
                </div>
            ) : departamentos.length === 0 ? (
                <div className="text-center py-20 bg-[#F5F5F7] rounded-[2rem] border border-[#E5E5EA]">
                    <div className="w-16 h-16 bg-white rounded-full mx-auto flex items-center justify-center mb-6 shadow-sm border border-[#E5E5EA]">
                        <FaClipboardList className="text-2xl text-[#86868B]" />
                    </div>
                    <h3 className="font-bold text-[#1D1D1F] text-lg">Sem Políticas Fiscais</h3>
                    <p className="text-sm text-[#86868B] mb-6 font-medium max-w-sm mx-auto">Esta rede ainda não possui nenhum modelo de departamento configurado para emissão.</p>
                    <button onClick={handleNovo} className="bg-white border border-[#E5E5EA] text-[#1D1D1F] px-6 py-2.5 rounded-full font-bold shadow-sm hover:bg-[#F5F5F7] transition-all">Definir o Primeiro</button>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <div className="min-w-max space-y-3">
                        <div className="flex text-[10px] font-black uppercase tracking-widest text-[#86868B] px-4 pb-2 border-b border-[#E5E5EA]">
                            <div className="flex-[0.5] text-center">ID</div>
                            <div className="flex-[2] ml-2">Descrição</div>
                            <div className="flex-1 text-center">Dpto CFOP</div>
                            <div className="flex-[0.5] text-center">CSOSN</div>
                            <div className="flex-[0.5] text-center">NCM (S.G)</div>
                            <div className="flex-[0.8] text-right">Ação</div>
                        </div>

                        {departamentos.map((d, i) => (
                            <div key={d.id} className="flex items-center px-4 py-4 bg-white border border-[#E5E5EA] rounded-[1.5rem] hover:shadow-md hover:border-[#1D1D1F] transition-all cursor-default">
                                <div className="flex-[0.5] text-center">
                                    <span className="text-xs text-[#86868B] font-bold">#{i+1}</span>
                                </div>
                                <div className="flex-[2] ml-2 flex flex-col justify-center">
                                    <span className="font-bold text-[#1D1D1F] text-sm">{d.nome}</span>
                                    {d.estabelecimentoId === 'GLOBAL' && <span className="text-[9px] font-black uppercase text-[#007AFF] mt-0.5">Global Master Level</span>}
                                </div>
                                <div className="flex-1 flex justify-center">
                                    <span className="bg-[#F5F5F7] text-[#1D1D1F] border border-[#E5E5EA] text-xs font-black px-3 py-1 rounded-md">{d.cfop_nfce || '-'}</span>
                                </div>
                                <div className="flex-[0.5] text-center font-semibold text-[#86868B] text-sm">
                                    {d.csosn || '-'}
                                </div>
                                <div className="flex-[0.5] text-center font-mono text-[#86868B] text-xs font-semibold">
                                    {d.ncm || '-'}
                                </div>
                                <div className="flex-[0.8] flex justify-end gap-2">
                                    {(forceEstabId === 'GLOBAL' || d.estabelecimentoId !== 'GLOBAL') && (
                                        <>
                                            <button onClick={() => handleEdit(d)} className="w-8 h-8 rounded-full bg-[#F5F5F7] text-[#1D1D1F] flex items-center justify-center hover:bg-[#1D1D1F] hover:text-white transition-colors" title="Editar">
                                                <FaEdit size={12} />
                                            </button>
                                            <button onClick={() => handleExcluir(d.id)} className="w-8 h-8 rounded-full bg-[#FFE6E6] text-[#D0021B] flex items-center justify-center hover:bg-[#D0021B] hover:text-white transition-colors" title="Excluir">
                                                <FaTrash size={12} />
                                            </button>
                                        </>
                                    )}
                                    {(!forceEstabId && d.estabelecimentoId === 'GLOBAL') && (
                                        <span className="text-[10px] text-[#86868B] font-bold italic py-2">Master Rule</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
