import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHeader } from '../../context/HeaderContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import { useGestaoInsumosData, UNIDADES, CATEGORIAS_PADRAO } from '../../hooks/useGestaoInsumosData';
import {
    IoAddCircleOutline, IoSearch, IoClose, IoCheckmarkCircle,
    IoAlertCircle, IoCube, IoCash, IoList, IoFlask,
    IoScaleOutline, IoStorefrontOutline, IoTrashOutline, IoPencil,
    IoEyeOff, IoAddOutline, IoRemoveOutline, IoSaveOutline
} from 'react-icons/io5';
import BackButton from '../../components/BackButton';

const SkeletonLoader = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-5 animate-pulse">
                <div className="h-6 bg-slate-100 rounded-lg w-3/4 mb-3"></div>
                <div className="h-4 bg-slate-100 rounded-lg w-1/2 mb-2"></div>
                <div className="h-4 bg-slate-100 rounded-lg w-1/3"></div>
            </div>
        ))}
    </div>
);

const StatsCard = ({ title, value, icon: Icon, colorClass, bgClass }) => (
    <div className="group bg-white rounded-[2rem] p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex items-center justify-between hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
        <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl transform translate-x-12 -translate-y-10 group-hover:scale-150 transition-transform duration-700 ${bgClass.replace('50', '200')} opacity-40`}></div>
        <div className="relative z-10">
            <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">{title}</p>
            <p className={`text-3xl font-black tracking-tight ${colorClass} drop-shadow-sm`}>{value}</p>
        </div>
        <div className={`relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${bgClass}`}>
            <Icon className={`text-2xl ${colorClass}`} />
        </div>
    </div>
);

const InsumoCard = ({ insumo, onEdit, onDelete, onToggle, onAjustarEstoque }) => {
    const [showAjuste, setShowAjuste] = useState(false);
    const [qtdAjuste, setQtdAjuste] = useState('');

    const estoque = Number(insumo.estoqueAtual) || 0;
    const minimo = Number(insumo.estoqueMinimo) || 0;
    const custo = Number(insumo.custoUnitario) || 0;

    let statusColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
    let statusLabel = 'OK';
    let StatusIcon = IoCheckmarkCircle;
    if (estoque <= 0) { statusColor = 'bg-red-100 text-red-800 border-red-200'; statusLabel = 'Esgotado'; StatusIcon = IoClose; }
    else if (estoque <= minimo) { statusColor = 'bg-amber-100 text-amber-800 border-amber-200'; statusLabel = 'Baixo'; StatusIcon = IoAlertCircle; }

    const formatarEstoque = (val) => {
        if (insumo.unidade === 'un') return Math.floor(val).toString();
        if (val >= 1000 && (insumo.unidade === 'g' || insumo.unidade === 'ml')) {
            const convertido = val / 1000;
            const unidadeMaior = insumo.unidade === 'g' ? 'kg' : 'L';
            return `${convertido.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} ${unidadeMaior}`;
        }
        return `${val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${insumo.unidade}`;
    };

    return (
        <div className="group bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/60 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:border-violet-100/80 transition-all duration-300 flex flex-col overflow-hidden relative">
            <div className="p-6 flex flex-col flex-1">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-violet-600 bg-violet-50/80 border border-violet-100 px-2.5 py-1 rounded-lg">{insumo.categoria || 'Sem Categoria'}</span>
                            {insumo.ativo === false && <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 flex items-center gap-1"><IoEyeOff size={10} /> Inativo</span>}
                        </div>
                        <h3 className="font-extrabold text-slate-800 text-xl leading-tight line-clamp-1 group-hover:text-violet-600 transition-colors" title={insumo.nome}>{insumo.nome}</h3>
                        {insumo.fornecedor && <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><IoStorefrontOutline size={12} /> {insumo.fornecedor}</p>}
                    </div>
                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-sm backdrop-blur-md ${statusColor}`}>
                        <StatusIcon size={14} /> {statusLabel}
                    </span>
                </div>

                {/* Dados */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Estoque</p>
                        <p className={`text-lg font-black leading-none ${estoque <= 0 ? 'text-red-500' : 'text-slate-700'}`}>{formatarEstoque(estoque)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Mínimo</p>
                        <p className="text-lg font-black leading-none text-slate-500">{formatarEstoque(minimo)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Custo/{insumo.unidade}</p>
                        <p className="text-lg font-black leading-none text-slate-700">R$ {custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>

                {/* Ajuste rápido */}
                {showAjuste ? (
                    <div className="bg-violet-50/50 rounded-xl p-4 border border-violet-100 mb-4 animate-fade-in">
                        <p className="text-xs font-bold text-violet-700 mb-2">Ajuste Rápido de Estoque</p>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={qtdAjuste}
                                onChange={e => setQtdAjuste(e.target.value)}
                                placeholder={`Qtd em ${insumo.unidade}`}
                                className="flex-1 p-3 bg-white border border-violet-200 rounded-xl text-sm font-bold text-violet-800 outline-none focus:ring-2 focus:ring-violet-500/20"
                            />
                            <button onClick={() => { onAjustarEstoque(insumo.id, Number(qtdAjuste), 'adicionar'); setShowAjuste(false); setQtdAjuste(''); }}
                                disabled={!qtdAjuste || Number(qtdAjuste) <= 0}
                                className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all disabled:opacity-30 shadow-sm" title="Adicionar">
                                <IoAddOutline size={18} />
                            </button>
                            <button onClick={() => { onAjustarEstoque(insumo.id, Number(qtdAjuste), 'remover'); setShowAjuste(false); setQtdAjuste(''); }}
                                disabled={!qtdAjuste || Number(qtdAjuste) <= 0}
                                className="p-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all disabled:opacity-30 shadow-sm" title="Remover">
                                <IoRemoveOutline size={18} />
                            </button>
                            <button onClick={() => { setShowAjuste(false); setQtdAjuste(''); }}
                                className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all">
                                <IoClose size={18} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <button onClick={() => setShowAjuste(true)}
                        className="w-full py-3 bg-violet-50/50 hover:bg-violet-50 text-violet-600 font-bold text-xs flex items-center justify-center gap-2 rounded-xl border border-dashed border-violet-200 transition-all mb-4">
                        <IoScaleOutline size={16} /> Ajustar Estoque
                    </button>
                )}

                {/* Ações */}
                <div className="grid grid-cols-3 gap-2 mt-auto">
                    <button onClick={onToggle}
                        className={`py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm border ${insumo.ativo !== false
                            ? 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            : 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600'}`}>
                        {insumo.ativo !== false ? 'Pausar' : 'Reativar'}
                    </button>
                    <button onClick={onEdit}
                        className="py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-violet-500/20 flex items-center justify-center gap-1">
                        <IoPencil size={14} /> Editar
                    </button>
                    <button onClick={onDelete}
                        className="py-2.5 bg-white hover:bg-red-50 text-red-500 rounded-xl text-xs font-bold transition-all border border-slate-200 hover:border-red-200 shadow-sm flex items-center justify-center gap-1">
                        <IoTrashOutline size={14} /> Excluir
                    </button>
                </div>
            </div>
        </div>
    );
};

function GestaoInsumos() {
    const { userData } = useAuth();
    const { setActions, clearActions } = useHeader();
    const estabelecimentoId = userData?.estabelecimentosGerenciados?.[0];
    const data = useGestaoInsumosData(estabelecimentoId);

    useEffect(() => {
        const actions = (
            <button onClick={() => data.openForm()}
                className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-[0_4px_15px_rgba(124,58,237,0.3)] text-sm transition-all transform hover:scale-[1.02] active:scale-[0.98]">
                <IoAddCircleOutline className="text-xl" /> <span className="hidden sm:inline">Novo Insumo</span>
            </button>
        );
        setActions(actions);
        return () => clearActions();
    }, [setActions, clearActions, data.openForm]);

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        data.setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    if (data.loading) return <div className="p-6 md:p-8 max-w-7xl mx-auto"><SkeletonLoader /></div>;

    return (
        <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans pb-32">
            <div className="max-w-7xl mx-auto">
                <BackButton className="mb-4" />

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-black text-slate-800 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/30">
                            <IoFlask size={24} />
                        </div>
                        Gestão de Insumos
                    </h1>
                    <p className="text-slate-500 mt-2 ml-[60px]">Matérias-primas e ingredientes para a ficha técnica dos produtos.</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-10">
                    <StatsCard title="Total" value={data.stats.total} icon={IoList} colorClass="text-violet-600" bgClass="bg-violet-50" />
                    <StatsCard title="Ativos" value={data.stats.ativos} icon={IoCheckmarkCircle} colorClass="text-emerald-500" bgClass="bg-emerald-50" />
                    <StatsCard title="Crítico" value={data.stats.critico} icon={IoAlertCircle} colorClass="text-amber-500" bgClass="bg-amber-50" />
                    <StatsCard title="Esgotados" value={data.stats.esgotado} icon={IoClose} colorClass="text-red-500" bgClass="bg-red-50" />
                    <div className="col-span-2 md:col-span-3 xl:col-span-1">
                        <StatsCard title="Valor Total" value={`R$ ${data.stats.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={IoCash} colorClass="text-indigo-600" bgClass="bg-indigo-50" />
                    </div>
                </div>

                {/* Filters */}
                <div className="sticky top-4 z-30 bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white/50 p-3 mb-10 flex flex-col md:flex-row gap-3 md:items-center">
                    <div className="relative flex-1">
                        <IoSearch className="absolute left-5 top-1/2 transform -translate-y-1/2 text-slate-400 text-xl" />
                        <input type="text" placeholder="Buscar por insumo ou fornecedor..." value={data.searchTerm} onChange={e => data.setSearchTerm(e.target.value)}
                            className="w-full pl-14 pr-6 py-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 rounded-3xl transition-all outline-none font-medium text-slate-700 placeholder-slate-400 shadow-inner" />
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 md:pb-0 px-1 md:px-0 scrollbar-hide">
                        <select value={data.selectedCategory} onChange={e => data.setSelectedCategory(e.target.value)}
                            className="px-6 py-4 bg-white border border-slate-100 hover:bg-slate-50 focus:ring-4 focus:ring-violet-500/10 rounded-2xl text-sm font-bold text-slate-700 outline-none cursor-pointer transition-all shadow-sm min-w-[160px] appearance-none"
                            style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}>
                            <option value="Todos">Todas Categorias</option>
                            {data.categoriasExistentes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={data.stockFilter} onChange={e => data.setStockFilter(e.target.value)}
                            className="px-6 py-4 bg-white border border-slate-100 hover:bg-slate-50 focus:ring-4 focus:ring-violet-500/10 rounded-2xl text-sm font-bold text-slate-700 outline-none cursor-pointer transition-all shadow-sm min-w-[180px] appearance-none"
                            style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}>
                            <option value="todos">Status: Todos</option>
                            <option value="critico">⚠️ Estoque Crítico</option>
                            <option value="esgotado">🚫 Esgotados</option>
                            <option value="normal">✅ Normal</option>
                        </select>
                    </div>
                </div>

                {/* Grid */}
                <div className="min-h-[400px]">
                    {data.filteredInsumos.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {data.filteredInsumos.map(insumo => (
                                <InsumoCard
                                    key={insumo.id}
                                    insumo={insumo}
                                    onEdit={() => data.openForm(insumo)}
                                    onDelete={() => data.handleDelete(insumo)}
                                    onToggle={() => data.toggleStatus(insumo)}
                                    onAjustarEstoque={data.ajustarEstoque}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 shadow-sm relative overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none"></div>
                            <div className="relative z-10 flex flex-col items-center">
                                <div className="w-24 h-24 bg-violet-50 text-violet-300 rounded-full flex items-center justify-center mb-6 shadow-inner">
                                    <IoFlask className="text-5xl" />
                                </div>
                                <h3 className="text-2xl font-black text-slate-700 mb-2">Nenhum insumo cadastrado</h3>
                                <p className="text-slate-400 font-medium text-center max-w-sm mb-6">Cadastre seus ingredientes e matérias-primas para controlar o estoque com mais precisão.</p>
                                <button onClick={() => data.openForm()}
                                    className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold py-3 px-8 rounded-2xl shadow-lg shadow-violet-500/30 hover:from-violet-700 hover:to-indigo-700 transition-all">
                                    <IoAddCircleOutline size={20} /> Cadastrar Primeiro Insumo
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* MODAL FORM */}
                {data.showForm && (
                    <div className="fixed inset-0 z-[99999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-0 md:p-6 animate-fade-in">
                        <div className="bg-[#f8fafc] w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200/60">

                            {/* Modal Header */}
                            <div className="flex-none h-20 px-6 md:px-10 flex items-center justify-between bg-white border-b border-slate-100 shadow-sm">
                                <h2 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                                    {data.editingInsumo ? 'Editar Insumo' : 'Novo Insumo'}
                                </h2>
                                <button type="button" onClick={data.closeForm}
                                    className="w-12 h-12 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-red-500 rounded-full transition-all hover:rotate-90">
                                    <IoClose size={26} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <form onSubmit={data.handleSave} className="flex-1 overflow-y-auto px-6 md:px-10 py-8 custom-scrollbar">
                                <div className="space-y-6 pb-8">

                                    {/* Nome e Categoria */}
                                    <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/50 space-y-5">
                                        <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                                            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600"><IoFlask size={20} /></div>
                                            <h3 className="text-xl font-bold text-slate-800">Identificação</h3>
                                        </div>
                                        <div className="grid md:grid-cols-2 gap-5">
                                            <div>
                                                <label className="block text-sm font-bold mb-2 text-slate-700">Nome <span className="text-red-500">*</span></label>
                                                <input type="text" name="nome" value={data.formData.nome} onChange={handleFormChange}
                                                    className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 focus:bg-white text-slate-800 font-medium outline-none transition-all"
                                                    required autoComplete="off" placeholder="Ex: Presunto Misto" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold mb-2 text-slate-700">Categoria <span className="text-red-500">*</span></label>
                                                <input type="text" name="categoria" value={data.formData.categoria} onChange={handleFormChange}
                                                    list="cat-insumos-list"
                                                    className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 focus:bg-white text-slate-800 font-medium outline-none transition-all"
                                                    required autoComplete="off" placeholder="Ex: Frios" />
                                                <datalist id="cat-insumos-list">
                                                    {data.categoriasExistentes.map(c => <option key={c} value={c} />)}
                                                </datalist>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold mb-2 text-slate-700">Fornecedor (opcional)</label>
                                            <input type="text" name="fornecedor" value={data.formData.fornecedor} onChange={handleFormChange}
                                                className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 focus:bg-white text-slate-600 outline-none transition-all"
                                                placeholder="Ex: Distribuidora São Paulo" />
                                        </div>
                                    </div>

                                    {/* Estoque e Custo */}
                                    <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/50 space-y-5">
                                        <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600"><IoScaleOutline size={20} /></div>
                                            <h3 className="text-xl font-bold text-slate-800">Estoque & Custo</h3>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div>
                                                <label className="text-[11px] font-extrabold text-violet-600 mb-2 block uppercase tracking-wider">Unidade</label>
                                                <select name="unidade" value={data.formData.unidade} onChange={handleFormChange}
                                                    className="w-full p-4 bg-violet-50/50 border border-violet-200 rounded-xl text-sm font-bold text-violet-800 outline-none focus:ring-4 focus:ring-violet-500/10 cursor-pointer">
                                                    {UNIDADES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-extrabold text-emerald-600 mb-2 block uppercase tracking-wider">Estoque Atual</label>
                                                <input type="number" step="0.01" name="estoqueAtual" value={data.formData.estoqueAtual} onChange={handleFormChange}
                                                    className="w-full p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl text-sm font-extrabold text-emerald-800 outline-none focus:ring-4 focus:ring-emerald-500/10 placeholder-emerald-300"
                                                    placeholder="0" />
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-extrabold text-slate-400 mb-2 block uppercase tracking-wider">Estoque Mínimo</label>
                                                <input type="number" step="0.01" name="estoqueMinimo" value={data.formData.estoqueMinimo} onChange={handleFormChange}
                                                    className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:ring-4 focus:ring-violet-500/10"
                                                    placeholder="0" />
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-extrabold text-slate-400 mb-2 block uppercase tracking-wider">Custo/{data.formData.unidade}</label>
                                                <input type="number" step="0.01" name="custoUnitario" value={data.formData.custoUnitario} onChange={handleFormChange}
                                                    className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:ring-4 focus:ring-violet-500/10"
                                                    placeholder="0.00" />
                                            </div>
                                        </div>

                                        {/* Status toggle */}
                                        <div className={`p-5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${data.formData.ativo ? 'bg-gradient-to-r from-violet-600 to-indigo-600 border-transparent' : 'bg-slate-50 border-slate-200'}`}
                                            onClick={() => data.setFormData(prev => ({ ...prev, ativo: !prev.ativo }))}>
                                            <div>
                                                <p className={`font-extrabold ${data.formData.ativo ? 'text-white' : 'text-slate-600'}`}>
                                                    {data.formData.ativo ? '✅ Insumo Ativo' : 'Insumo Inativo'}
                                                </p>
                                                <p className={`text-sm ${data.formData.ativo ? 'text-violet-100' : 'text-slate-400'}`}>
                                                    {data.formData.ativo ? 'Disponível para vincular a produtos.' : 'Não aparecerá na ficha técnica.'}
                                                </p>
                                            </div>
                                            <div className={`w-14 h-7 rounded-full p-1 transition-all ${data.formData.ativo ? 'bg-white/30' : 'bg-slate-300'}`}>
                                                <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${data.formData.ativo ? 'translate-x-7' : 'translate-x-0'}`}></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </form>

                            {/* Modal Footer */}
                            <div className="flex-none bg-white/80 backdrop-blur-xl border-t border-slate-200 px-6 md:px-10 py-5 flex justify-end gap-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                                <button type="button" onClick={data.closeForm}
                                    className="hidden sm:block px-8 py-3.5 rounded-2xl border font-bold text-slate-600 hover:bg-slate-100 transition-all text-base shadow-sm">
                                    Cancelar
                                </button>
                                <button onClick={data.handleSave} disabled={data.formLoading}
                                    className="w-full sm:w-auto px-10 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold hover:from-violet-700 hover:to-indigo-700 shadow-xl shadow-violet-500/30 transition-all transform hover:-translate-y-0.5 text-base flex items-center justify-center gap-2">
                                    {data.formLoading ? (
                                        <><span className="animate-spin border-2 border-white/30 border-t-white rounded-full w-5 h-5"></span> Salvando...</>
                                    ) : (
                                        <><IoSaveOutline size={20} /> Salvar Insumo</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default withEstablishmentAuth(GestaoInsumos);
