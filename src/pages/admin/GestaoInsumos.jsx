import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useHeader } from '../../context/HeaderContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import { useGestaoInsumosData, UNIDADES } from '../../hooks/useGestaoInsumosData';
import {
    IoAddCircleOutline, IoSearch, IoClose, IoCheckmarkCircle,
    IoAlertCircle, IoCash, IoList, IoFlask,
    IoScaleOutline, IoStorefrontOutline, IoTrashOutline, IoPencil,
    IoEyeOff, IoAddOutline, IoRemoveOutline, IoSaveOutline
} from 'react-icons/io5';
import BackButton from '../../components/BackButton';

// Skeleton loader compatible with Light premium theme
const SkeletonLoader = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white/60 border border-slate-100/80 rounded-[2.2rem] p-6 shadow-sm animate-pulse">
                <div className="flex justify-between items-start mb-4">
                    <div className="space-y-2 flex-1">
                        <div className="h-6 bg-slate-100 rounded-lg w-2/3"></div>
                        <div className="h-4 bg-slate-50 rounded-lg w-1/2"></div>
                    </div>
                    <div className="h-6 bg-slate-100 rounded-full w-14"></div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="h-10 bg-slate-50 rounded-xl"></div>
                    <div className="h-10 bg-slate-50 rounded-xl"></div>
                    <div className="h-10 bg-slate-50 rounded-xl"></div>
                </div>
                <div className="h-10 bg-slate-100 rounded-xl w-full mb-4"></div>
                <div className="grid grid-cols-3 gap-2">
                    <div className="h-8 bg-slate-150 rounded-xl"></div>
                    <div className="h-8 bg-slate-150 rounded-xl"></div>
                    <div className="h-8 bg-slate-150 rounded-xl"></div>
                </div>
            </div>
        ))}
    </div>
);

const StatsCard = ({ title, value, icon: Icon, colorClass, bgClass }) => (
    <div className="group bg-white/70 border border-slate-150/40 rounded-[2rem] p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-all duration-300 hover:scale-[1.02] relative overflow-hidden">
        <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl transform translate-x-12 -translate-y-10 group-hover:scale-150 transition-transform duration-700 ${bgClass.replace('50', '200')} opacity-40`}></div>
        <div className="relative z-10">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">{title}</p>
            <p className={`text-2xl font-black tracking-tight ${colorClass} drop-shadow-sm`}>{value}</p>
        </div>
        <div className={`relative z-10 w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${bgClass}`}>
            <Icon className={`text-xl ${colorClass}`} />
        </div>
    </div>
);

const InsumoCard = ({ insumo, onEdit, onDelete, onToggle, onAjustarEstoque }) => {
    const [showAjuste, setShowAjuste] = useState(false);
    const [qtdAjuste, setQtdAjuste] = useState('');

    const estoque = Number(insumo.estoqueAtual) || 0;
    const minimo = Number(insumo.estoqueMinimo) || 0;
    const custo = Number(insumo.custoUnitario) || 0;

    let statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
    let statusLabel = 'OK';
    let StatusIcon = IoCheckmarkCircle;
    if (estoque <= 0) { statusColor = 'bg-red-50 text-red-700 border-red-100'; statusLabel = 'Esgotado'; StatusIcon = IoClose; }
    else if (estoque <= minimo) { statusColor = 'bg-amber-50 text-amber-700 border-amber-100'; statusLabel = 'Baixo'; StatusIcon = IoAlertCircle; }

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
        <div className="group bg-white/80 rounded-[2.2rem] shadow-sm border border-slate-150/40 hover:shadow-xl hover:border-violet-200/80 transition-all duration-300 flex flex-col overflow-hidden relative">
            <div className="p-6 flex flex-col flex-1">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-violet-600 bg-violet-50 border border-violet-100 px-2.5 py-1 rounded-lg">{insumo.categoria || 'Sem Categoria'}</span>
                            {insumo.ativo === false && <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 flex items-center gap-1"><IoEyeOff size={10} /> Inativo</span>}
                        </div>
                        <h3 className="font-extrabold text-slate-800 text-lg leading-tight line-clamp-1 group-hover:text-violet-600 transition-colors" title={insumo.nome}>{insumo.nome}</h3>
                        {insumo.fornecedor && <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><IoStorefrontOutline size={12} /> {insumo.fornecedor}</p>}
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border flex items-center gap-1 shadow-sm backdrop-blur-md ${statusColor}`}>
                        <StatusIcon size={12} /> {statusLabel}
                    </span>
                </div>

                {/* Dados */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100/50">
                        <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Estoque</p>
                        <p className={`text-base font-black leading-none ${estoque <= 0 ? 'text-red-500' : 'text-slate-700'}`}>{formatarEstoque(estoque)}</p>
                    </div>
                    <div className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100/50">
                        <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Mínimo</p>
                        <p className="text-base font-black leading-none text-slate-500">{formatarEstoque(minimo)}</p>
                    </div>
                    <div className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100/50">
                        <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Custo</p>
                        <p className="text-base font-black leading-none text-slate-700">R$ {custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>

                {/* Ajuste rápido */}
                {showAjuste ? (
                    <div className="bg-violet-50/40 rounded-[1.5rem] p-4 border border-violet-100 mb-4 animate-fadeIn">
                        <p className="text-[10px] font-bold text-violet-750 uppercase tracking-widest mb-2">Ajuste Rápido de Estoque</p>
                        <div className="flex items-center gap-1.5">
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={qtdAjuste}
                                onChange={e => setQtdAjuste(e.target.value)}
                                placeholder={`Qtd em ${insumo.unidade}`}
                                className="flex-1 p-2.5 bg-white border border-violet-200 rounded-xl text-xs font-bold text-violet-850 outline-none focus:ring-2 focus:ring-violet-500/20"
                            />
                            <button onClick={() => { onAjustarEstoque(insumo.id, Number(qtdAjuste), 'adicionar'); setShowAjuste(false); setQtdAjuste(''); }}
                                disabled={!qtdAjuste || Number(qtdAjuste) <= 0}
                                className="p-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all disabled:opacity-30 shadow-sm" title="Adicionar">
                                <IoAddOutline size={16} />
                            </button>
                            <button onClick={() => { onAjustarEstoque(insumo.id, Number(qtdAjuste), 'remover'); setShowAjuste(false); setQtdAjuste(''); }}
                                disabled={!qtdAjuste || Number(qtdAjuste) <= 0}
                                className="p-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all disabled:opacity-30 shadow-sm" title="Remover">
                                <IoRemoveOutline size={16} />
                            </button>
                            <button onClick={() => { setShowAjuste(false); setQtdAjuste(''); }}
                                className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all">
                                <IoClose size={16} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <button onClick={() => setShowAjuste(true)}
                        className="w-full py-2.5 bg-violet-50/40 hover:bg-violet-50 text-violet-650 font-bold text-[11px] flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-violet-205 transition-all mb-4">
                        <IoScaleOutline size={14} /> Ajustar Estoque
                    </button>
                )}

                {/* Ações */}
                <div className="grid grid-cols-3 gap-2 mt-auto">
                    <button onClick={onToggle}
                        className={`py-2.5 rounded-xl text-xs font-bold transition-all border active:scale-95 shadow-sm ${insumo.ativo !== false
                            ? 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            : 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600'}`}>
                        {insumo.ativo !== false ? 'Pausar' : 'Reativar'}
                    </button>
                    <button onClick={onEdit}
                        className="py-2.5 bg-amber-400 hover:bg-amber-500 text-amber-950 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm shadow-amber-400/20 border border-amber-400/30 flex items-center justify-center gap-1">
                        <IoPencil size={12} /> Editar
                    </button>
                    <button onClick={onDelete}
                        className="py-2.5 bg-white hover:bg-red-50 text-red-500 rounded-xl text-xs font-bold transition-all border border-slate-200 hover:border-red-200 shadow-sm active:scale-95 flex items-center justify-center gap-1">
                        <IoTrashOutline size={12} /> Excluir
                    </button>
                </div>
            </div>
        </div>
    );
};

function GestaoInsumos() {
    const { currentUser, estabelecimentoIdPrincipal } = useAuth();
    const { setActions, clearActions } = useHeader();
    const estabelecimentoId = estabelecimentoIdPrincipal || currentUser?.estabelecimentoId;
    const data = useGestaoInsumosData(estabelecimentoId);

    // Custom confirmation modal states
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [insumoToDelete, setInsumoToDelete] = useState(null);

    useEffect(() => {
        const actions = (
            <button onClick={() => data.openForm()}
                className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-amber-950 font-bold py-2.5 px-5 rounded-xl shadow-[0_4px_15px_rgba(245,158,11,0.25)] text-sm transition-all transform hover:scale-[1.02] active:scale-[0.98]">
                <IoAddCircleOutline className="text-xl" /> <span>Novo Insumo</span>
            </button>
        );
        setActions(actions);
        return () => clearActions();
    }, [setActions, clearActions, data.openForm]);

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        data.setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleExcluirClick = (insumo) => {
        setInsumoToDelete(insumo);
        setDeleteConfirmOpen(true);
    };

    const confirmarExcluir = async () => {
        if (!insumoToDelete) return;
        try {
            await data.handleDelete(insumoToDelete);
            setDeleteConfirmOpen(false);
            setInsumoToDelete(null);
        } catch (err) {
            console.error("Erro ao deletar insumo:", err);
        }
    };

    if (data.loading) return (
        <div className="min-h-screen bg-gradient-to-br from-[#f6f8fa] via-[#eef2f6] to-[#f6f8fa] p-4 md:p-8 font-sans pb-32">
            <div className="max-w-7xl mx-auto space-y-6">
                <BackButton className="mb-4" />
                <div className="h-10 bg-slate-100 rounded-lg w-1/4 animate-pulse"></div>
                <SkeletonLoader />
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#f6f8fa] via-[#eef2f6] to-[#f6f8fa] p-4 md:p-8 font-sans pb-32 relative overflow-hidden transition-colors duration-300">
            {/* ─── NEBULA GLOWS ─── */}
            <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-violet-400/5 rounded-full blur-[140px] pointer-events-none"></div>
            <div className="absolute bottom-[20%] right-[-10%] w-[550px] h-[550px] bg-indigo-400/5 rounded-full blur-[130px] pointer-events-none"></div>

            <div className="max-w-7xl mx-auto relative z-10 space-y-6">
                <BackButton className="mb-4" />

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-amber-950 shadow-lg shadow-amber-500/20">
                            <IoFlask size={24} />
                        </div>
                        Gestão de Insumos
                    </h1>
                    <p className="text-slate-500 mt-2 ml-[60px] font-medium">Matérias-primas e ingredientes para a ficha técnica dos produtos.</p>
                </div>

                {/* Stats Bento Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-10">
                    <StatsCard title="Total" value={data.stats.total} icon={IoList} colorClass="text-violet-650" bgClass="bg-violet-50" />
                    <StatsCard title="Ativos" value={data.stats.ativos} icon={IoCheckmarkCircle} colorClass="text-emerald-555" bgClass="bg-emerald-50" />
                    <StatsCard title="Crítico" value={data.stats.critico} icon={IoAlertCircle} colorClass="text-amber-555" bgClass="bg-amber-50" />
                    <StatsCard title="Esgotados" value={data.stats.esgotado} icon={IoClose} colorClass="text-red-500" bgClass="bg-red-50" />
                    <div className="col-span-2 md:col-span-3 xl:col-span-1">
                        <StatsCard title="Valor Total" value={`R$ ${data.stats.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={IoCash} colorClass="text-indigo-650" bgClass="bg-indigo-50" />
                    </div>
                </div>

                {/* Filter and Search Bar (Frosted Glass Container) */}
                <div className="bg-white/50 border border-white/60 backdrop-blur-xl rounded-[2.5rem] shadow-xl p-3 mb-10 flex flex-col md:flex-row gap-3 md:items-center">
                    <div className="relative flex-1">
                        <IoSearch className="absolute left-5 top-1/2 transform -translate-y-1/2 text-slate-400 text-xl" />
                        <input type="text" placeholder="Buscar por insumo ou fornecedor..." value={data.searchTerm} onChange={e => data.setSearchTerm(e.target.value)}
                            className="w-full pl-14 pr-6 py-4 bg-[#f8fafc]/50 hover:bg-[#f8fafc]/90 border border-slate-150/40 focus:bg-white focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 rounded-3xl transition-all outline-none font-medium text-slate-700 placeholder-slate-400 shadow-sm" />
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 md:pb-0 px-1 md:px-0 scrollbar-hide">
                        <select value={data.selectedCategory} onChange={e => data.setSelectedCategory(e.target.value)}
                            className="px-6 py-4 bg-white border border-slate-150/40 hover:bg-slate-50 focus:ring-4 focus:ring-violet-500/10 rounded-2xl text-sm font-bold text-slate-700 outline-none cursor-pointer transition-all shadow-sm min-w-[160px] appearance-none"
                            style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.25rem center', backgroundSize: '1em' }}>
                            <option value="Todos">Todas Categorias</option>
                            {data.categoriasExistentes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={data.stockFilter} onChange={e => data.setStockFilter(e.target.value)}
                            className="px-6 py-4 bg-white border border-slate-150/40 hover:bg-slate-50 focus:ring-4 focus:ring-violet-500/10 rounded-2xl text-sm font-bold text-slate-700 outline-none cursor-pointer transition-all shadow-sm min-w-[180px] appearance-none"
                            style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.25rem center', backgroundSize: '1em' }}>
                            <option value="todos">Status: Todos</option>
                            <option value="critico">⚠️ Estoque Crítico</option>
                            <option value="esgotado">🚫 Esgotados</option>
                            <option value="normal">✅ Normal</option>
                        </select>
                    </div>
                </div>

                {/* Grid Container */}
                <div className="min-h-[400px]">
                    {data.filteredInsumos.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {data.filteredInsumos.map(insumo => (
                                <InsumoCard
                                    key={insumo.id}
                                    insumo={insumo}
                                    onEdit={() => data.openForm(insumo)}
                                    onDelete={() => handleExcluirClick(insumo)}
                                    onToggle={() => data.toggleStatus(insumo)}
                                    onAjustarEstoque={data.ajustarEstoque}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-24 bg-white/70 backdrop-blur-md rounded-[2.5rem] border-2 border-dashed border-slate-200/60 shadow-sm relative overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none"></div>
                            <div className="relative z-10 flex flex-col items-center">
                                <div className="w-20 h-20 bg-violet-50 text-violet-300 rounded-full flex items-center justify-center mb-6 shadow-inner">
                                    <IoFlask className="text-4xl" />
                                </div>
                                <h3 className="text-2xl font-black text-slate-700 mb-2">Nenhum insumo encontrado</h3>
                                <p className="text-slate-400 font-medium text-center max-w-sm mb-6">Tente ajustar seus filtros de busca ou cadastre um novo insumo.</p>
                                <button onClick={() => data.openForm()}
                                    className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-650 text-white font-bold py-3 px-8 rounded-2xl shadow-lg shadow-violet-500/25 hover:from-violet-700 hover:to-indigo-700 transition-all">
                                    <IoAddCircleOutline size={20} /> Cadastrar Insumo
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* MODAL FORM (CRIAR / EDITAR) */}
                {data.showForm && (
                    <div className="fixed inset-0 z-[99999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-0 md:p-6 animate-fadeIn">
                        <div className="bg-[#f8fafc] w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200/60">

                            {/* Modal Header */}
                            <div className="flex-none h-20 px-6 md:px-10 flex items-center justify-between bg-white border-b border-slate-100 shadow-sm">
                                <h2 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-violet-600 to-indigo-650 bg-clip-text text-transparent">
                                    {data.editingInsumo ? 'Editar Insumo' : 'Novo Insumo'}
                                </h2>
                                <button type="button" onClick={data.closeForm}
                                    className="w-10 h-10 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-red-500 rounded-full transition-all hover:rotate-90">
                                    <IoClose size={24} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <form onSubmit={data.handleSave} className="flex-1 overflow-y-auto px-6 md:px-10 py-8 custom-scrollbar">
                                <div className="space-y-6 pb-8">

                                    {/* Identificação Card */}
                                    <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-slate-100 space-y-5">
                                        <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                                            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600"><IoFlask size={20} /></div>
                                            <h3 className="text-lg font-bold text-slate-800">Identificação</h3>
                                        </div>
                                        <div className="grid md:grid-cols-2 gap-5">
                                            <div>
                                                <label className="block text-xs font-bold mb-2 text-slate-550 uppercase tracking-widest">Nome <span className="text-red-500">*</span></label>
                                                <input type="text" name="nome" value={data.formData.nome} onChange={handleFormChange}
                                                    className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 focus:bg-white text-slate-800 font-semibold outline-none transition-all text-sm"
                                                    required autoComplete="off" placeholder="Ex: Presunto Misto" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold mb-2 text-slate-550 uppercase tracking-widest">Categoria <span className="text-red-500">*</span></label>
                                                <input type="text" name="categoria" value={data.formData.categoria} onChange={handleFormChange}
                                                    list="cat-insumos-list"
                                                    className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 focus:bg-white text-slate-800 font-semibold outline-none transition-all text-sm"
                                                    required autoComplete="off" placeholder="Ex: Frios" />
                                                <datalist id="cat-insumos-list">
                                                    {data.categoriasExistentes.map(c => <option key={c} value={c} />)}
                                                </datalist>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold mb-2 text-slate-550 uppercase tracking-widest">Fornecedor (opcional)</label>
                                            <input type="text" name="fornecedor" value={data.formData.fornecedor} onChange={handleFormChange}
                                                className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 focus:bg-white text-slate-700 font-semibold outline-none transition-all text-sm"
                                                placeholder="Ex: Distribuidora São Paulo" />
                                        </div>
                                    </div>

                                    {/* Estoque e Custo Card */}
                                    <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-slate-100 space-y-5">
                                        <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600"><IoScaleOutline size={20} /></div>
                                            <h3 className="text-lg font-bold text-slate-800">Estoque & Custo</h3>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div>
                                                <label className="text-[10px] font-bold text-violet-600 mb-2 block uppercase tracking-widest">Unidade</label>
                                                <select name="unidade" value={data.formData.unidade} onChange={handleFormChange}
                                                    className="w-full p-4 bg-violet-50/50 border border-violet-200 rounded-xl text-xs font-extrabold text-violet-850 outline-none focus:ring-4 focus:ring-violet-500/10 cursor-pointer">
                                                    {UNIDADES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-emerald-650 mb-2 block uppercase tracking-widest">Estoque Atual</label>
                                                <input type="number" step="0.01" name="estoqueAtual" value={data.formData.estoqueAtual} onChange={handleFormChange}
                                                    className="w-full p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs font-extrabold text-emerald-800 outline-none focus:ring-4 focus:ring-emerald-500/10 placeholder-emerald-300"
                                                    placeholder="0" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 mb-2 block uppercase tracking-widest">Estoque Mínimo</label>
                                                <input type="number" step="0.01" name="estoqueMinimo" value={data.formData.estoqueMinimo} onChange={handleFormChange}
                                                    className="w-full p-4 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold outline-none focus:ring-4 focus:ring-violet-500/10"
                                                    placeholder="0" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 mb-2 block uppercase tracking-widest">Custo/{data.formData.unidade}</label>
                                                <input type="number" step="0.01" name="custoUnitario" value={data.formData.custoUnitario} onChange={handleFormChange}
                                                    className="w-full p-4 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold outline-none focus:ring-4 focus:ring-violet-500/10"
                                                    placeholder="0.00" />
                                            </div>
                                        </div>

                                        {/* Status Switcher Toggle */}
                                        <div className={`p-5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${data.formData.ativo ? 'bg-gradient-to-r from-violet-600 to-indigo-650 border-transparent shadow-lg shadow-violet-500/15' : 'bg-slate-50 border-slate-200'}`}
                                            onClick={() => data.setFormData(prev => ({ ...prev, ativo: !prev.ativo }))}>
                                            <div>
                                                <p className={`font-extrabold ${data.formData.ativo ? 'text-white' : 'text-slate-600'}`}>
                                                    {data.formData.ativo ? '✅ Insumo Ativo' : 'Insumo Inativo'}
                                                </p>
                                                <p className={`text-xs ${data.formData.ativo ? 'text-violet-100/90' : 'text-slate-400'} mt-0.5`}>
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
                                    className="hidden sm:block px-8 py-3.5 rounded-2xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-100 transition-all text-sm shadow-sm active:scale-95">
                                    Cancelar
                                </button>
                                <button onClick={data.handleSave} disabled={data.formLoading}
                                    className="w-full sm:w-auto px-10 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-amber-950 font-bold shadow-xl shadow-amber-500/15 transition-all transform active:scale-95 text-sm flex items-center justify-center gap-2">
                                    {data.formLoading ? (
                                        <><span className="animate-spin border-2 border-white/30 border-t-white rounded-full w-4 h-4"></span> Salvando...</>
                                    ) : (
                                        <><IoSaveOutline size={16} /> Salvar Insumo</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL CONFIRMAÇÃO EXCLUSÃO CUSTOMIZADO */}
                {deleteConfirmOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999999] px-4 animate-fadeIn" onClick={() => { setDeleteConfirmOpen(false); setInsumoToDelete(null); }}>
                        <div className="bg-white border border-slate-150/40 rounded-[2.2rem] p-8 w-full max-w-md shadow-2xl relative transition-all duration-300" onClick={e => e.stopPropagation()}>
                            <div className="flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6 animate-pulse">
                                    <IoAlertCircle size={32} />
                                </div>
                                <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
                                    Excluir Insumo?
                                </h2>
                                <p className="text-sm text-slate-500 mb-8 px-4 leading-relaxed">
                                    Tem certeza que deseja excluir <strong>"{insumoToDelete?.nome}"</strong>? Produtos ou fichas técnicas vinculadas a este insumo perderão a referência.
                                </p>
                                <div className="flex gap-4 w-full">
                                    <button type="button" onClick={() => { setDeleteConfirmOpen(false); setInsumoToDelete(null); }} 
                                        className="flex-1 py-4 bg-white border border-gray-250 text-slate-700 hover:bg-gray-50 rounded-full font-bold text-sm transition-all active:scale-95">
                                        Cancelar
                                    </button>
                                    <button type="button" onClick={confirmarExcluir} 
                                        className="flex-1 py-4 bg-red-650 hover:bg-red-500 text-white rounded-full font-bold text-sm shadow-lg shadow-red-500/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                                        Sim, Excluir
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
        </div>
    );
}

export default withEstablishmentAuth(GestaoInsumos);
