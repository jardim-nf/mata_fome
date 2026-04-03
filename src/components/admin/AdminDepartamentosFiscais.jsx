import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { departamentoFiscalService } from '../../services/departamentoFiscalService';
import { useAuth } from '../../context/AuthContext';
import { FaPlus, FaTrash, FaEdit, FaSave } from 'react-icons/fa';

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

    // Renderização do formulário se houver algo selecionado
    if (selectedDept) {
        return (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 bg-emerald-500 h-full"></div>
                <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => setSelectedDept(null)} className="text-gray-400 hover:text-gray-800 transition-colors">Voltar</button>
                    <h2 className="text-xl font-bold flex-1">{selectedDept === 'NEW' ? 'Novo Departamento Fiscal' : 'Alteração do Cadastro do Departamento'}</h2>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Descrição do Departamento (Nome)</label>
                        <input name="nome" value={form.nome} onChange={handleChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500" placeholder="Ex: BASICO - SIMPLES NACIONAL" maxLength={50} />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">NCM Padrão (Opcional)</label>
                        <input name="ncm" value={form.ncm} onChange={handleChange} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-emerald-500" placeholder="Ex: 22021000" maxLength={8} />
                        <p className="text-xs text-gray-400 mt-1">Se preenchido, será a NCM sugerida para produtos deste departamento.</p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                        <h3 className="text-sm font-bold text-gray-700 mb-4 items-center flex gap-2">🛒 CFOP USUAIS</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-3 rounded border border-gray-100 shadow-sm">
                                <label className="block text-xs font-bold text-gray-500 mb-2">VENDAS / NF-e</label>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 w-16">do estado</span>
                                        <input name="cfop_nfe_estado" value={form.cfop_nfe_estado} onChange={handleChange} className="w-24 p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm text-center" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 w-16">fora UF</span>
                                        <input name="cfop_nfe_fora" value={form.cfop_nfe_fora} onChange={handleChange} className="w-24 p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm text-center" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-3 rounded border border-gray-100 shadow-sm">
                                <label className="block text-xs font-bold text-gray-500 mb-2">CUPONS / NFC-e</label>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400">CFOP Base</span>
                                        <input name="cfop_nfce" value={form.cfop_nfce} onChange={handleChange} className="w-24 p-2 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm text-center border-emerald-300 font-bold" />
                                    </div>
                                    <p className="text-[10px] text-gray-400">Principal usado no caixa.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-gray-700 mb-3 ml-1 flex items-center gap-2">⚖️ MATRIZ IMPOSTOS (DADOS BASE)</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left align-middle border border-gray-200 rounded-lg overflow-hidden relative border-collapse">
                                <thead className="bg-gray-100 text-gray-600 font-bold text-xs">
                                    <tr>
                                        <th className="p-3 border-b">CSOSN</th>
                                        <th className="p-3 border-b border-l">CST PIS</th>
                                        <th className="p-3 border-b border-l">CST COFINS</th>
                                        <th className="p-3 border-b border-l">CST IPI</th>
                                        <th className="p-3 border-b border-l">% ICMS (SN)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="bg-white border-b hover:bg-emerald-50 transition-colors">
                                        <td className="p-3">
                                            <input name="csosn" value={form.csosn} onChange={handleChange} className="w-16 p-2 bg-gray-50 border border-gray-200 rounded outline-none text-center" />
                                        </td>
                                        <td className="p-3 border-l">
                                            <input name="cst_pis" value={form.cst_pis} onChange={handleChange} className="w-16 p-2 bg-gray-50 border border-gray-200 rounded outline-none text-center" />
                                        </td>
                                        <td className="p-3 border-l">
                                            <input name="cst_cofins" value={form.cst_cofins} onChange={handleChange} className="w-16 p-2 bg-gray-50 border border-gray-200 rounded outline-none text-center" />
                                        </td>
                                        <td className="p-3 border-l">
                                            <input name="cst_ipi" value={form.cst_ipi} onChange={handleChange} className="w-16 p-2 bg-gray-50 border border-gray-200 rounded outline-none text-center" />
                                        </td>
                                        <td className="p-3 border-l">
                                            <input name="aliq_icms" value={form.aliq_icms} onChange={handleChange} className="w-16 p-2 bg-gray-50 border border-gray-200 rounded outline-none text-center" />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 ml-1">Estes são os valores injetados nos produtos para transmissão fiscal da venda no cupom e NFe.</p>
                    </div>

                    <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
                        <button onClick={() => setSelectedDept(null)} className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50">Cancelar</button>
                        <button onClick={handleSalvar} disabled={isLoading} className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-md hover:bg-emerald-700 disabled:opacity-50">
                            {isLoading ? 'Salvando...' : <><FaSave /> Confirmar</>}
                        </button>
                    </div>
                </div>

            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex lg:items-center justify-between flex-col lg:flex-row mb-6 gap-4">
                <div>
                    <h2 className="text-xl font-bold text-emerald-600 flex items-center gap-2">📑 Departamentos Fiscais / Matriz Tributária</h2>
                    <p className="text-xs text-gray-500 mt-1">Crie grupos com regras de NFCe prontas para vincular nos produtos.</p>
                </div>
                <button onClick={handleNovo} className="flex items-center gap-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-4 py-2 font-bold rounded-xl transition-all shadow-sm max-w-fit">
                    <FaPlus /> Adicionar Departamento
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-8 animate-pulse text-emerald-500">⏳ Carregando grade fiscal...</div>
            ) : departamentos.length === 0 ? (
                <div className="text-center p-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <span className="text-3xl block mb-2">📋</span>
                    <h3 className="font-bold text-gray-700">Nenhum departamento fiscal cadastrado</h3>
                    <p className="text-sm text-gray-500 mb-4">Seus produtos não herdam regras estáticas de nenhum grupo ainda.</p>
                    <button onClick={handleNovo} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-emerald-700">Começar Agora</button>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left align-middle font-sans">
                        <thead className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="p-3 font-bold rounded-l-lg border-b border-gray-200">ID / Código</th>
                                <th className="p-3 font-bold border-b border-gray-200">Descrição do Departamento</th>
                                <th className="p-3 font-bold border-b border-gray-200 text-center">NFC-e Base (CFOP)</th>
                                <th className="p-3 font-bold border-b border-gray-200 text-center">CSOSN</th>
                                <th className="p-3 font-bold border-b border-gray-200 text-center">NCM Sugerido</th>
                                <th className="p-3 font-bold rounded-r-lg border-b border-gray-200 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {departamentos.map((d, i) => (
                                <tr key={d.id} className="hover:bg-gray-50 group">
                                    <td className="p-3 text-xs text-gray-400 font-mono flex items-center gap-2">
                                        #{i+1}
                                        {d.estabelecimentoId === 'GLOBAL' && <span className="bg-purple-100 text-purple-700 font-bold px-1 rounded text-[9px]">GLOBAL</span>}
                                    </td>
                                    <td className="p-3 font-bold text-gray-800">{d.nome}</td>
                                    <td className="p-3 text-center">
                                        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded">{d.cfop_nfce || '-'}</span>
                                    </td>
                                    <td className="p-3 text-center text-gray-500">{d.csosn || '-'}</td>
                                    <td className="p-3 text-center text-gray-500 font-mono">{d.ncm || '-'}</td>
                                    <td className="p-3 text-right">
                                        {(forceEstabId === 'GLOBAL' || d.estabelecimentoId !== 'GLOBAL') && (
                                            <>
                                                <button onClick={() => handleEdit(d)} className="text-gray-400 hover:text-emerald-600 p-2 transition-colors mx-1" title="Alterar Cadastro">
                                                    <FaEdit />
                                                </button>
                                                <button onClick={() => handleExcluir(d.id)} className="text-gray-400 hover:text-red-600 p-2 transition-colors mx-1" title="Inativar/Excluir">
                                                    <FaTrash />
                                                </button>
                                            </>
                                        )}
                                        {(!forceEstabId && d.estabelecimentoId === 'GLOBAL') && (
                                            <span className="text-xs text-gray-400 italic">Vem da Master</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
