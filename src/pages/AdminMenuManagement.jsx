// src/pages/AdminMenuManagement.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useHeader } from '../context/HeaderContext';
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { usePagination } from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { useAdminMenuData } from '../hooks/useAdminMenuData';
import {
    IoAddCircleOutline, IoSearch, IoClose, IoImageOutline, IoCheckmarkCircle,
    IoAlertCircle, IoCube, IoCash, IoPricetag, IoList, IoEyeOff, IoGrid, IoMenu, IoBarcodeOutline,
    IoFlask, IoTrashOutline, IoChevronUp, IoChevronDown
} from 'react-icons/io5';
import BackButton from '../components/BackButton';

// Skeleton Loader
const SkeletonLoader = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-5 animate-pulse">
        <div className="w-full h-48 bg-slate-100 rounded-2xl mb-4"></div>
        <div className="h-6 bg-slate-100 rounded-lg w-3/4 mb-3"></div>
        <div className="h-4 bg-slate-100 rounded-lg w-1/2"></div>
      </div>
    ))}
  </div>
);

// Product Grid Card
const ProductGridCard = ({ produto, onEdit, onDelete, onToggleStatus, onUpload3D, uploading3D, stockStatus, profitMargin }) => {
  const fileInput3DRef = useRef(null);
  const stockConfig = {
    normal: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: IoCheckmarkCircle, label: 'OK' },
    baixo: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: IoAlertCircle, label: 'Baixo' },
    critico: { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: IoAlertCircle, label: 'Crítico' },
    esgotado: { color: 'bg-red-100 text-red-800 border-red-200', icon: IoClose, label: 'Esgotado' }
  };
  const { color, icon: Icon, label } = stockConfig[stockStatus] || stockConfig.normal;
  const getProfitColor = (margin) => margin >= 50 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : (margin >= 30 ? 'bg-gradient-to-r from-blue-400 to-blue-500' : 'bg-gradient-to-r from-amber-400 to-amber-500');

  const mostrarPrecosVariacoes = () => {
    if (!produto.variacoes || produto.variacoes.length === 0) return <p className="text-2xl font-black text-slate-800">R$ {(Number(produto.preco) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>;
    const variacoesAtivas = produto.variacoes.filter(v => v.ativo !== false && v.preco && !isNaN(Number(v.preco)) && Number(v.preco) > 0);
    if (variacoesAtivas.length === 0) return <p className="text-2xl font-black text-slate-300">--</p>;
    if (variacoesAtivas.length === 1) return <p className="text-2xl font-black text-slate-800">R$ {Number(variacoesAtivas[0].preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>;
    const menorPreco = Math.min(...variacoesAtivas.map(v => Number(v.preco)));
    return (
      <div className="flex flex-col">
        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-0.5">A partir de</span>
        <span className="text-2xl font-black text-slate-800 tracking-tight">R$ {menorPreco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
      </div>
    );
  };

  return (
    <div className="group bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/60 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:border-blue-100/80 transition-all duration-300 flex flex-col h-full overflow-hidden relative">
      <div className="relative h-56 overflow-hidden bg-slate-50">
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-transparent z-10 pointer-events-none"></div>
        {produto.imageUrl ? (
          <img src={produto.imageUrl} alt={produto.nome} className="w-full h-full object-contain p-6 mix-blend-multiply transition-transform duration-700 group-hover:scale-110"/>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300"><IoImageOutline className="text-6xl drop-shadow-sm" /></div>
        )}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
            {produto.ativo === false && <span className="bg-slate-900/80 backdrop-blur-md text-white px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg border border-slate-700"><IoEyeOff /> Oculto</span>}
            <span className={`px-3.5 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 shadow-lg backdrop-blur-md ${color.replace('bg-', 'bg-').replace('100', '100/90')} `}><Icon /> {label}</span>
        </div>
        {profitMargin > 0 && <div className={`absolute top-4 right-4 text-white px-3.5 py-1.5 rounded-full text-xs font-extrabold shadow-lg z-20 ${getProfitColor(profitMargin)}`}>{profitMargin.toFixed(0)}% Lucro</div>}
      </div>

      <div className="p-6 flex flex-col flex-1 relative z-10 bg-white">
        <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 bg-blue-50/80 border border-blue-100 px-2.5 py-1 rounded-lg">{produto.categoria}</span>
            {produto.codigoBarras && <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100" title="Código de Barras"><IoBarcodeOutline /> {produto.codigoBarras}</span>}
        </div>
        <h3 className="font-extrabold text-slate-800 text-xl leading-tight mb-2 line-clamp-1 group-hover:text-blue-600 transition-colors" title={produto.nome}>{produto.nome}</h3>
        {produto.descricao && <p className="text-slate-500 text-sm line-clamp-2 mb-5 h-10 leading-relaxed font-medium">{produto.descricao}</p>}

        <div className="mt-auto border-t border-slate-50 pt-5">
            <div className="flex justify-between items-end mb-5">
                <div>{mostrarPrecosVariacoes()}</div>
                <div className="text-right bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-0.5">Estoque</p>
                    <p className={`text-lg font-black leading-none ${Number(produto.estoque) <= 0 ? 'text-red-500' : 'text-slate-700'}`}>{produto.estoque}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <input ref={fileInput3DRef} type="file" accept=".glb,.gltf" className="hidden" 
                  onChange={(e) => { const f = e.target.files?.[0]; if(f) onUpload3D(produto, f); e.target.value = ''; }} />
                <button onClick={produto.modelo3dUrl ? undefined : () => fileInput3DRef.current?.click()} disabled={!!produto.modelo3dUrl || uploading3D}
                  className={`col-span-2 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border shadow-sm ${produto.modelo3dUrl ? 'bg-emerald-50 text-emerald-600 border-emerald-200 cursor-default' : uploading3D ? 'bg-violet-50 text-violet-400 border-violet-200 cursor-wait' : 'bg-white text-violet-600 hover:bg-violet-50 border-violet-200 hover:border-violet-300'}`}>
                  <IoCube size={16} />{produto.modelo3dUrl ? '✓ Modelo 3D Pronto' : uploading3D ? 'Enviando...' : 'Fazer Upload de Modelo 3D'}
                </button>
                <button onClick={onToggleStatus} className={`py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm border ${produto.ativo !== false ? 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300' : 'bg-emerald-500 text-white border-emerald-500 shadow-emerald-500/20 hover:bg-emerald-600'}`}>
                    {produto.ativo !== false ? 'Pausar' : 'Reativar'}
                </button>
                <div className="flex gap-2">
                    <button onClick={onEdit} className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/30 transform hover:-translate-y-0.5">Editar</button>
                    <button onClick={onDelete} className="w-12 flex items-center justify-center bg-white hover:bg-red-50 text-red-500 rounded-xl transition-all border border-slate-200 hover:border-red-200 shadow-sm"><IoClose size={18} /></button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

const StatsCard = ({ title, value, icon: Icon, colorClass, bgClass }) => (
    <div className="group bg-white rounded-[2rem] p-6 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] flex items-center justify-between hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl transform translate-x-12 -translate-y-10 group-hover:scale-150 transition-transform duration-700 ${bgClass.replace('bg-', 'bg-').replace('50', '200')} opacity-40`}></div>
      <div className="relative z-10">
        <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">{title}</p>
        <p className={`text-3xl font-black tracking-tight ${colorClass} drop-shadow-sm`}>{value}</p>
      </div>
      <div className={`relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${bgClass}`}>
        <Icon className={`text-2xl ${colorClass}`} />
      </div>
    </div>
);

function AdminMenuManagement() {
  const { userData , estabelecimentoIdPrincipal } = useAuth();
  const { setActions, clearActions } = useHeader();
  const primeiroEstabelecimento = estabelecimentoIdPrincipal;
  const menuParams = useAdminMenuData(primeiroEstabelecimento);
  
  const [viewMode, setViewMode] = useState('grid');
  
  const ITEMS_PER_PAGE = viewMode === 'grid' ? 12 : 8;
  const { currentPage, totalPages, paginatedItems, goToPage } = usePagination(menuParams.filteredAndSortedItems, ITEMS_PER_PAGE);

  useEffect(() => { goToPage(1); }, [menuParams.searchTerm, menuParams.selectedCategory, menuParams.stockFilter, goToPage]);

  useEffect(() => {
    const actions = (
        <div className="flex items-center space-x-3">
            <div className="hidden md:flex bg-white rounded-xl border border-slate-200/60 p-1 shadow-sm">
                <button onClick={() => setViewMode('grid')} className={`p-2.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-slate-100/80 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}><IoGrid size={18}/></button>
                <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-100/80 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}><IoMenu size={18}/></button>
            </div>
            <button onClick={() => menuParams.openItemForm()} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-[0_4px_15px_rgba(37,99,235,0.3)] text-sm transition-all transform hover:scale-[1.02] active:scale-[0.98]">
                <IoAddCircleOutline className="text-xl"/> <span className="hidden sm:inline">Adicionar Produto</span>
            </button>
        </div>
    );
    setActions(actions);
    return () => clearActions();
  }, [viewMode, setActions, clearActions, menuParams.openItemForm]);

  const handleFormChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'file') {
        if (files[0]) { menuParams.setItemImage(files[0]); menuParams.setImagePreview(URL.createObjectURL(files[0])); }
    } else {
        menuParams.setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }
  };

  const handleFiscalChange = (e) => {
    const { name, value } = e.target;
    menuParams.setFormData(prev => ({ ...prev, fiscal: { ...prev.fiscal, [name]: value } }));
  };

  const handleDepartamentoChange = (e) => {
      const depId = e.target.value;
      const dep = menuParams.departamentosFiscais.find(d => d.id === depId);
      if (dep) {
          menuParams.setFormData(prev => ({
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
          menuParams.setTermoNcm(dep.ncm || '');
      } else {
          menuParams.setFormData(prev => ({
              ...prev,
              fiscal: { ...prev.fiscal, departamentoId: '' }
          }));
      }
  };

  if (menuParams.loading) return <div className="p-6 md:p-8 max-w-7xl mx-auto"><div className="mb-6 h-8 w-48 bg-slate-200 rounded-lg animate-pulse"></div><SkeletonLoader /></div>;

  const isModoMultiplasVariacoes = menuParams.variacoes.length > 1 || (menuParams.variacoes.length === 1 && menuParams.variacoes[0]?.nome !== 'Padrão');

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans pb-32">
      <div className="max-w-7xl mx-auto">
        
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-10">
            <StatsCard title="Total Itens" value={menuParams.stockStatistics.totalItems} icon={IoList} colorClass="text-blue-600" bgClass="bg-blue-50" />
            <StatsCard title="Ativos" value={menuParams.stockStatistics.activeItems} icon={IoCheckmarkCircle} colorClass="text-emerald-500" bgClass="bg-emerald-50" />
            <StatsCard title="Crítico" value={menuParams.stockStatistics.criticalStock} icon={IoAlertCircle} colorClass="text-amber-500" bgClass="bg-amber-50" />
            <StatsCard title="Esgotados" value={menuParams.stockStatistics.outOfStock} icon={IoClose} colorClass="text-red-500" bgClass="bg-red-50" />
            <div className="col-span-2 md:col-span-3 xl:col-span-2">
                <StatsCard title="Valor em Estoque" value={`R$ ${menuParams.stockStatistics.totalInventoryValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={IoCash} colorClass="text-indigo-600" bgClass="bg-indigo-50" />
            </div>
        </div>

        <div className="sticky top-4 z-30 bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white/50 p-3 mb-10 flex flex-col md:flex-row gap-3 md:items-center">
            <div className="relative flex-1">
                <IoSearch className="absolute left-5 top-1/2 transform -translate-y-1/2 text-slate-400 text-xl" />
                <input type="text" placeholder="Buscar por produto, código ou material..." value={menuParams.searchTerm} onChange={e => menuParams.setSearchTerm(e.target.value)} 
                    className="w-full pl-14 pr-6 py-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 rounded-3xl transition-all outline-none font-medium text-slate-700 placeholder-slate-400 shadow-inner" />
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 md:pb-0 px-1 md:px-0 scrollbar-hide">
                <select value={menuParams.selectedCategory} onChange={e => menuParams.setSelectedCategory(e.target.value)} className="px-6 py-4 bg-white border border-slate-100 hover:bg-slate-50 focus:ring-4 focus:ring-blue-500/10 rounded-2xl text-sm font-bold text-slate-700 outline-none cursor-pointer transition-all shadow-sm min-w-[160px] appearance-none" style={{backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em'}}>
                    {['Todos', ...new Set(menuParams.categories.map(c => c.nome))].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={menuParams.stockFilter} onChange={e => menuParams.setStockFilter(e.target.value)} className="px-6 py-4 bg-white border border-slate-100 hover:bg-slate-50 focus:ring-4 focus:ring-blue-500/10 rounded-2xl text-sm font-bold text-slate-700 outline-none cursor-pointer transition-all shadow-sm min-w-[180px] appearance-none" style={{backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em'}}>
                    <option value="todos">Status: Tudo</option>
                    <option value="critico">⚠️ Estoque Crítico</option>
                    <option value="esgotado">🚫 Esgotados</option>
                    <option value="normal">✅ Estoque Normal</option>
                </select>
            </div>
        </div>

        <div className="min-h-[400px]">
            {paginatedItems.length > 0 ? (
                <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8" : "space-y-4"}>
                    {paginatedItems.map(item => (
                        viewMode === 'grid' ? (
                            <ProductGridCard key={item.id} produto={item} onEdit={() => menuParams.openItemForm(item)} onDelete={() => menuParams.handleDeleteItem(item)}
                                onToggleStatus={() => menuParams.toggleItemStatus(item)} onUpload3D={menuParams.handleUpload3D} uploading3D={menuParams.uploading3DItemId === item.id}
                                stockStatus={item.estoque <= 0 ? 'esgotado' : (item.estoque <= item.estoqueMinimo ? 'critico' : 'normal')}
                                profitMargin={((item.preco - item.custo) / item.preco) * 100} />
                        ) : (
                            <div key={item.id} className="group bg-white p-5 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-100 flex items-center justify-between hover:border-blue-200 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center p-2 relative">
                                        {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-500"/> : <IoImageOutline className="text-slate-300 text-2xl"/>}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] uppercase font-extrabold tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{item.categoria}</span>
                                            {item.ativo !== false ? <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> : <span className="text-[10px] text-red-500 font-bold">Oculto</span>}
                                        </div>
                                        <h3 className="font-extrabold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">{item.nome}</h3>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right hidden sm:block">
                                        <p className="font-black text-slate-800 text-xl">R$ {Number(item.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mt-0.5">Estoque: <span className={item.estoque <= 0 ? 'text-red-500' : 'text-slate-600'}>{item.estoque}</span></p>
                                    </div>
                                    <button onClick={() => menuParams.openItemForm(item)} className="p-3 text-blue-600 bg-blue-50 hover:bg-blue-600 hover:text-white rounded-2xl transition-all shadow-sm"><IoPricetag size={20}/></button>
                                </div>
                            </div>
                        )
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none"></div>
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-24 h-24 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-6 shadow-inner">
                            <IoCube className="text-5xl" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-700 mb-2">Puxa, nenhum item encontrado</h3>
                        <p className="text-slate-400 font-medium text-center max-w-sm">Tente buscar por outro termo ou ajuste os filtros acima para encontrar o que precisa.</p>
                    </div>
                </div>
            )}
        </div>

        {paginatedItems.length > 0 && <div className="mt-8"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} /></div>}

        {menuParams.showItemForm && (
          <div className="fixed inset-0 z-[99999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-0 md:p-6 animate-fade-in">
            <div className="bg-[#f8fafc] w-full h-full md:h-[95vh] md:max-w-6xl md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200/60 relative">
              
              {/* Header Premium */}
              <div className="flex-none h-20 px-6 md:px-10 flex items-center justify-between bg-white border-b border-slate-100 shadow-sm z-20">
                <div>
                  <h2 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                      {menuParams.editingItem ? 'Editar Produto' : 'Novo Produto'}
                  </h2>
                </div>
                <button type="button" onClick={menuParams.closeItemForm} className="w-12 h-12 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-red-500 rounded-full transition-all hover:rotate-90">
                  <IoClose size={26} />
                </button>
              </div>

              <form onSubmit={(e) => menuParams.handleSaveItem(e)} className="flex-1 overflow-hidden flex flex-col relative">
                <div className="flex-1 overflow-y-auto px-4 md:px-10 py-8 custom-scrollbar">
                  <div className="max-w-5xl mx-auto space-y-8 pb-32">
                      
                      {/* Dados Gerais */}
                      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/50 space-y-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all">
                          <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><IoCube size={20}/></div>
                              <h3 className="text-xl font-bold text-slate-800">Dados Gerais</h3>
                          </div>
                          
                          <div className="grid md:grid-cols-2 gap-6">
                              <div>
                                  <label className="block text-sm font-bold mb-2 text-slate-700">Nome do Produto <span className="text-red-500">*</span></label>
                                  <input type="text" name="nome" value={menuParams.formData.nome} onChange={handleFormChange} className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white text-slate-800 font-medium outline-none transition-all" required autoComplete="off" placeholder="Ex: Hambúrguer Clássico" />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="block text-sm font-bold mb-2 text-slate-700">Categoria <span className="text-red-500">*</span></label>
                                      <input type="text" name="categoria" value={menuParams.formData.categoria} onChange={handleFormChange} list="cat-list" className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white text-slate-800 font-medium outline-none transition-all" required autoComplete="off" placeholder="Selecione ou digite..." />
                                      <datalist id="cat-list">{menuParams.categories.map(c => (<option key={c.id} value={c.nome} />))}</datalist>
                                  </div>
                                  <div>
                                      <label className="block text-sm font-bold mb-2 text-slate-700">Cód. Barras</label>
                                      <input type="text" name="codigoBarras" value={menuParams.formData.codigoBarras} onChange={handleFormChange} className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white text-slate-600 outline-none transition-all font-mono" autoComplete="off" placeholder="000000000000" />
                                  </div>
                              </div>
                          </div>
                          <div>
                              <label className="block text-sm font-bold mb-2 text-slate-700">Descrição</label>
                              <textarea name="descricao" value={menuParams.formData.descricao} onChange={handleFormChange} placeholder="Do que é feito? Quais os diferenciais?" className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white text-slate-600 outline-none transition-all min-h-[120px] resize-none" />
                          </div>
                      </div>

                      {/* Preços e Estoque */}
                      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/50 space-y-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-50 pb-4 gap-4">
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600"><IoCash size={20}/></div>
                                  <h3 className="text-xl font-bold text-slate-800">Preços & Estoque</h3>
                              </div>
                              <div className="flex bg-slate-100/80 p-1.5 rounded-2xl w-full sm:w-auto overflow-hidden">
                                  <button type="button" onClick={() => menuParams.setVariacoes([{id: `v-unique`, nome: 'Padrão', preco: '', ativo: true, estoque: 0, custo: 0 }])} className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${menuParams.variacoes.length === 1 && menuParams.variacoes[0].nome === 'Padrão' ? 'bg-white text-slate-800 shadow-[0_2px_10px_rgba(0,0,0,0.06)]' : 'text-slate-500 hover:text-slate-700'}`}>Preço Único</button>
                                  <button type="button" onClick={() => { if(menuParams.variacoes.length===1 && menuParams.variacoes[0].nome==='Padrão') menuParams.setVariacoes([{id: `v-multi`, nome: 'Médio', preco: '', ativo: true, estoque: 0, custo: 0}]); }} className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${menuParams.variacoes.length > 1 || menuParams.variacoes[0].nome !== 'Padrão' ? 'bg-white text-slate-800 shadow-[0_2px_10px_rgba(0,0,0,0.06)]' : 'text-slate-500 hover:text-slate-700'}`}>Vários Tamanhos</button>
                              </div>
                          </div>

                          <div className="space-y-4">
                              {menuParams.variacoes.map((v, index) => (
                                  <div key={v.id} className="bg-slate-50/50 p-6 rounded-2xl border border-slate-200 relative group transition-all hover:bg-slate-50">
                                      {menuParams.variacoes.length > 1 && (
                                          <div className="absolute -top-3 -right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                              {index > 0 && (
                                                  <button type="button" onClick={() => menuParams.reordenarVariacao(index, -1)} className="bg-white border border-blue-100 text-blue-500 p-2 rounded-full shadow-lg transition-transform hover:bg-blue-50 hover:-translate-y-1" title="Mover para Cima">
                                                      <IoChevronUp size={16}/>
                                                  </button>
                                              )}
                                              {index < menuParams.variacoes.length - 1 && (
                                                  <button type="button" onClick={() => menuParams.reordenarVariacao(index, 1)} className="bg-white border border-blue-100 text-blue-500 p-2 rounded-full shadow-lg transition-transform hover:bg-blue-50 hover:-translate-y-1" title="Mover para Baixo">
                                                      <IoChevronDown size={16}/>
                                                  </button>
                                              )}
                                              <button type="button" onClick={() => menuParams.removerVariacao(v.id)} className="bg-white border border-red-100 text-red-500 p-2 rounded-full shadow-lg transition-transform hover:bg-red-50 hover:-translate-y-1" title="Excluir">
                                                  <IoClose size={18}/>
                                              </button>
                                          </div>
                                      )}
                                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
                                          {(menuParams.variacoes.length > 1 || v.nome !== 'Padrão') && (
                                              <div className="sm:col-span-4">
                                                  <label className="text-[11px] font-extrabold text-slate-400 mb-2 block uppercase tracking-wider">Nome da Variação</label>
                                                  <input type="text" value={v.nome} onChange={e => menuParams.atualizarVariacao(v.id, 'nome', e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none" placeholder="Ex: Grande, Combo..." />
                                              </div>
                                          )}
                                          <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 ${menuParams.variacoes.length > 1 || v.nome !== 'Padrão' ? 'sm:col-span-8' : 'sm:col-span-12'}`}>
                                              <div>
                                                  <label className="text-[11px] font-extrabold text-emerald-600 mb-2 block uppercase tracking-wider">Venda (R$)</label>
                                                  <input type="number" step="0.01" value={v.preco} onChange={e => menuParams.atualizarVariacao(v.id, 'preco', e.target.value)} className="w-full p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl text-sm font-extrabold text-emerald-800 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none placeholder-emerald-300" placeholder="0.00" />
                                              </div>
                                              <div>
                                                  <label className="text-[11px] font-extrabold text-slate-400 mb-2 block uppercase tracking-wider">Custo (R$)</label>
                                                  <input type="number" step="0.01" value={v.custo} onChange={e => menuParams.atualizarVariacao(v.id, 'custo', e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none" placeholder="0.00" />
                                              </div>
                                              <div>
                                                  <label className="text-[11px] font-extrabold text-slate-400 mb-2 block uppercase tracking-wider">Qtd Estoque</label>
                                                  <input type="number" value={v.estoque} onChange={e => menuParams.atualizarVariacao(v.id, 'estoque', e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none" placeholder="0" />
                                              </div>
                                              <div>
                                                  <label className="text-[11px] font-extrabold text-slate-400 mb-2 block uppercase tracking-wider">Status</label>
                                                  <label className={`flex flex-col justify-center items-center h-[54px] cursor-pointer rounded-xl border transition-all ${v.ativo !== false ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
                                                      <input type="checkbox" checked={v.ativo !== false} onChange={e => menuParams.atualizarVariacao(v.id, 'ativo', e.target.checked)} className="hidden" />
                                                      <span className={`text-xs font-bold ${v.ativo !== false ? 'text-blue-700' : 'text-slate-400'}`}>{v.ativo !== false ? '✅ ATIVO' : 'PAUSADO'}</span>
                                                  </label>
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                          {isModoMultiplasVariacoes && (
                              <button type="button" onClick={menuParams.adicionarVariacao} className="w-full py-5 bg-gradient-to-b from-blue-50/50 to-blue-50/20 hover:from-blue-50 hover:to-blue-100 text-blue-600 font-bold flex items-center justify-center gap-2 rounded-2xl mt-4 border-2 border-dashed border-blue-200 transition-all hover:scale-[1.01]">
                                  <IoAddCircleOutline className="text-2xl"/> <span>Adicionar Nova Variação</span>
                              </button>
                          )}
                      </div>

                      {/* Ficha Técnica (Insumos) */}
                      {menuParams.insumosDisponiveis.length > 0 && (
                      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/50 space-y-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-50 pb-4 gap-4">
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600"><IoFlask size={20}/></div>
                                  <div>
                                      <h3 className="text-xl font-bold text-slate-800">Ficha Técnica</h3>
                                      <p className="text-xs text-slate-400">Insumos consumidos a cada venda deste produto</p>
                                  </div>
                              </div>
                              {menuParams.formData.fichaTecnica.length > 0 && (
                                  <div className="bg-violet-50 px-4 py-2 rounded-xl border border-violet-100">
                                      <p className="text-[10px] font-extrabold text-violet-500 uppercase tracking-wider">Custo pela ficha</p>
                                      <p className="text-lg font-black text-violet-700">R$ {menuParams.custoFichaTecnica.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                  </div>
                              )}
                          </div>

                          {/* Seletor de insumo */}
                          <div className="flex items-end gap-3">
                              <div className="flex-1">
                                  <label className="text-[11px] font-extrabold text-violet-600 mb-2 block uppercase tracking-wider">Adicionar Insumo</label>
                                  <select
                                      id="seletor-insumo-ficha"
                                      defaultValue=""
                                      className="w-full p-4 bg-violet-50/50 border border-violet-200 rounded-xl text-sm font-bold text-violet-800 outline-none focus:ring-4 focus:ring-violet-500/10 cursor-pointer"
                                  >
                                      <option value="" disabled>Selecione um insumo...</option>
                                      {menuParams.insumosDisponiveis
                                          .filter(i => !menuParams.formData.fichaTecnica.some(f => f.insumoId === i.id))
                                          .map(i => <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>)
                                      }
                                  </select>
                              </div>
                              <button
                                  type="button"
                                  onClick={() => {
                                      const select = document.getElementById('seletor-insumo-ficha');
                                      if (select.value) {
                                          menuParams.adicionarInsumoFicha(select.value);
                                          select.value = '';
                                      }
                                  }}
                                  className="p-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-all shadow-lg shadow-violet-500/20"
                              >
                                  <IoAddCircleOutline size={20} />
                              </button>
                          </div>

                          {/* Lista de insumos na ficha */}
                          {menuParams.formData.fichaTecnica.length > 0 ? (
                              <div className="space-y-3">
                                  {menuParams.formData.fichaTecnica.map((ficha) => (
                                      <div key={ficha.insumoId} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200 relative group transition-all hover:bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                          <button type="button" onClick={() => menuParams.removerInsumoFicha(ficha.insumoId)}
                                              className="absolute -top-2 -right-2 bg-white border border-red-100 text-red-500 p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 z-10">
                                              <IoTrashOutline size={14}/>
                                          </button>
                                          <div className="flex-1 min-w-0">
                                              <p className="font-bold text-slate-800 text-sm truncate">{ficha.nomeInsumo}</p>
                                              <p className="text-[10px] text-slate-400">Custo: R$ {ficha.custoUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}/{ficha.unidade}</p>
                                          </div>
                                          <div className="flex items-center gap-3">
                                              <div>
                                                  <label className="text-[10px] font-extrabold text-slate-400 mb-1 block uppercase tracking-wider">Qtd por venda</label>
                                                  <div className="flex items-center gap-1">
                                                      <input type="number" step="0.01" min="0" value={ficha.quantidade}
                                                          onChange={e => menuParams.atualizarQuantidadeFicha(ficha.insumoId, e.target.value)}
                                                          className="w-24 p-3 bg-white border border-violet-200 rounded-xl text-sm font-bold text-violet-800 outline-none focus:ring-2 focus:ring-violet-500/20 text-center" />
                                                      <span className="text-xs font-bold text-slate-500">{ficha.unidade}</span>
                                                  </div>
                                              </div>
                                              <div className="text-right">
                                                  <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Subtotal</p>
                                                  <p className="text-sm font-black text-slate-700">R$ {(ficha.quantidade * ficha.custoUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                              </div>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <div className="text-center py-8 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                                  <IoFlask className="text-4xl text-slate-300 mx-auto mb-2" />
                                  <p className="text-sm text-slate-400 font-medium">Nenhum insumo vinculado.</p>
                                  <p className="text-xs text-slate-300">A baixa de estoque será 1:1 no produto.</p>
                              </div>
                          )}
                      </div>
                      )}

                      {/* Fiscal e Outros (Grid) */}
                      <div className="grid lg:grid-cols-2 gap-8">
                          
                          {/* Emissão NFC-e */}
                          <div className="bg-gradient-to-br from-emerald-50/50 to-teal-50/30 p-6 md:p-8 rounded-3xl border border-emerald-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] space-y-6">
                              <div className="flex items-center gap-3 border-b border-emerald-100/50 pb-4">
                                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700"><IoBarcodeOutline size={20}/></div>
                                  <h3 className="text-xl font-bold text-emerald-900">Fiscal (NFC-e)</h3>
                              </div>
                              
                              <div className="mb-4">
                                  <label className="block text-sm font-bold text-emerald-800 mb-2">Preenchimento Automático</label>
                                  <select 
                                      value={menuParams.formData.fiscal?.departamentoId || ''} 
                                      onChange={handleDepartamentoChange} 
                                      className="w-full p-4 bg-white border border-emerald-200/80 rounded-2xl outline-none font-bold text-emerald-900 shadow-sm focus:ring-4 focus:ring-emerald-500/10 cursor-pointer"
                                  >
                                      <option value="">-- Usar Regras Manuais --</option>
                                      {menuParams.departamentosFiscais?.map(d => (
                                          <option key={d.id} value={d.id}>{d.nome} (CFOP: {d.cfop} / NCM: {d.ncm})</option>
                                      ))}
                                  </select>
                                  <p className="text-[11px] font-medium text-emerald-600/70 mt-2 ml-1">Ao selecionar, os campos abaixo serão bloqueados e preenchidos sozinhos.</p>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                  <div className="relative col-span-2 sm:col-span-1">
                                      <label className="block text-[11px] font-extrabold text-emerald-700 mb-2 uppercase tracking-wider">NCM <span className="font-medium lowercase text-emerald-500">(Busca automát.)</span></label>
                                      <input type="text" name="ncm" value={menuParams.termoNcm} onChange={(e) => menuParams.buscarNcm(e.target.value, handleFiscalChange)} className={`w-full p-4 bg-white border border-emerald-200/80 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 ${menuParams.formData.fiscal?.departamentoId ? 'opacity-60 bg-emerald-50/50' : ''}`} autoComplete="off" placeholder="Ex: 22021000" />
                                      {menuParams.pesquisandoNcm && <span className="absolute right-4 top-[50px] text-[10px] text-emerald-500 animate-pulse font-bold">Buscando...</span>}
                                      {menuParams.ncmResultados.length > 0 && (
                                          <div className="absolute z-50 w-full mt-2 bg-white border border-emerald-200 rounded-2xl shadow-2xl max-h-48 overflow-y-auto">
                                              {menuParams.ncmResultados.map((item) => (
                                                  <div key={item.codigo} onClick={() => { menuParams.setTermoNcm(item.codigo); handleFiscalChange({ target: { name: 'ncm', value: item.codigo } }); menuParams.setNcmResultados([]); }} className="p-3 border-b border-emerald-50 hover:bg-emerald-50 cursor-pointer transition-colors">
                                                      <p className="font-bold text-emerald-800 text-sm">{item.codigo}</p>
                                                      <p className="text-[11px] text-slate-500 line-clamp-1">{item.descricao}</p>
                                                  </div>
                                              ))}
                                          </div>
                                      )}
                                  </div>
                                  <div className="col-span-2 sm:col-span-1 grid grid-cols-2 gap-4">
                                      <div>
                                          <label className="block text-[11px] font-extrabold text-emerald-700 mb-2 uppercase tracking-wider">CFOP</label>
                                          <select disabled={!!menuParams.formData.fiscal?.departamentoId} name="cfop" value={menuParams.formData.fiscal?.cfop} onChange={handleFiscalChange} className={`w-full p-4 bg-white border border-emerald-200/80 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none ${menuParams.formData.fiscal?.departamentoId ? 'opacity-60 bg-emerald-50/50 cursor-not-allowed' : ''}`}>
                                              <option value="5102">5102</option>
                                              <option value="5405">5405</option>
                                          </select>
                                      </div>
                                      <div>
                                          <label className="block text-[11px] font-extrabold text-emerald-700 mb-2 uppercase tracking-wider">Un.</label>
                                          <select name="unidade" value={menuParams.formData.fiscal?.unidade} onChange={handleFiscalChange} className="w-full p-4 bg-white border border-emerald-200/80 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 outline-none">
                                              <option value="UN">UN</option>
                                              <option value="KG">KG</option>
                                              <option value="LT">LT</option>
                                          </select>
                                      </div>
                                  </div>
                              </div>
                          </div>

                          {/* Foto e Visibilidade */}
                          <div className="space-y-6 flex flex-col justify-between">
                              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all flex items-center gap-6">
                                  <div className="w-28 h-28 bg-slate-50 rounded-[1.25rem] border-2 border-slate-100 flex items-center justify-center overflow-hidden shrink-0 group relative">
                                      {menuParams.imagePreview ? <img src={menuParams.imagePreview} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /> : <IoImageOutline className="text-4xl text-slate-300"/>}
                                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                          <IoAddCircleOutline className="text-white text-3xl"/>
                                      </div>
                                  </div>
                                  <div className="flex-1">
                                      <label className="block text-lg font-bold text-slate-800 mb-1">Foto do Produto</label>
                                      <p className="text-[11px] text-slate-500 mb-3">Recomendado: 800x800px. Fundo branco ou transparente.</p>
                                      <label className="cursor-pointer inline-flex items-center justify-center px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-sm rounded-xl transition-colors">
                                          <span>Escolher Imagem</span>
                                          <input type="file" accept="image/*" onChange={handleFormChange} className="hidden" />
                                      </label>
                                  </div>
                              </div>

                              <div className={`p-8 rounded-3xl border transition-all h-full flex flex-col justify-center items-center text-center cursor-pointer ${menuParams.formData.ativo ? 'bg-gradient-to-br from-blue-600 to-indigo-600 border-transparent shadow-xl shadow-blue-500/20' : 'bg-slate-50 border-slate-200'}`}>
                                  <label htmlFor="ativoMain" className="cursor-pointer w-full flex flex-col items-center gap-3">
                                      <div className={`w-16 h-8 rounded-full p-1 transition-all duration-300 shadow-inner ${menuParams.formData.ativo ? 'bg-white/30 backdrop-blur-sm' : 'bg-slate-300'}`}>
                                          <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ${menuParams.formData.ativo ? 'translate-x-8' : 'translate-x-0'}`}></div>
                                      </div>
                                      <input type="checkbox" id="ativoMain" name="ativo" checked={menuParams.formData.ativo} onChange={handleFormChange} className="hidden" />
                                      <div>
                                          <p className={`text-xl font-extrabold ${menuParams.formData.ativo ? 'text-white' : 'text-slate-600'}`}>
                                              {menuParams.formData.ativo ? 'Produto Visível' : 'Produto Oculto (Pausado)'}
                                          </p>
                                          <p className={`text-sm mt-1 font-medium ${menuParams.formData.ativo ? 'text-blue-100' : 'text-slate-400'}`}>
                                              {menuParams.formData.ativo ? 'Disponível no catálogo para os clientes.' : 'Não será exibido para pedidos.'}
                                          </p>
                                      </div>
                                  </label>
                              </div>
                          </div>
                      </div>

                  </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 px-6 sm:px-10 py-5 flex justify-end gap-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-20">
                    <button type="button" onClick={menuParams.closeItemForm} className="hidden sm:block px-8 py-3.5 rounded-2xl border font-bold text-slate-600 hover:bg-slate-100 transition-all text-base shadow-sm">
                        Cancelar
                    </button>
                    <button type="submit" disabled={menuParams.formLoading} className="w-full sm:w-auto px-10 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold hover:from-blue-700 hover:to-indigo-700 shadow-xl shadow-blue-500/30 transition-all transform hover:-translate-y-0.5 text-base flex items-center justify-center gap-2">
                        {menuParams.formLoading ? (
                            <><span className="animate-spin text-xl border-2 border-white/30 border-t-white rounded-full w-5 h-5"></span> Salvando...</>
                        ) : (
                            <><IoCheckmarkCircle size={22}/> Salvar Produto</>
                        )}
                    </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default withEstablishmentAuth(AdminMenuManagement);