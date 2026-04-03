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
    IoAlertCircle, IoCube, IoCash, IoPricetag, IoList, IoEyeOff, IoGrid, IoMenu, IoBarcodeOutline
} from 'react-icons/io5';

// Skeleton Loader
const SkeletonLoader = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 animate-pulse">
        <div className="w-full h-48 bg-gray-200 rounded-xl mb-4"></div>
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
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
  const getProfitColor = (margin) => margin >= 50 ? 'bg-emerald-500' : (margin >= 30 ? 'bg-blue-500' : 'bg-amber-500');

  const mostrarPrecosVariacoes = () => {
    if (!produto.variacoes || produto.variacoes.length === 0) return <p className="text-2xl font-bold text-gray-800">R$ {(Number(produto.preco) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>;
    const variacoesAtivas = produto.variacoes.filter(v => v.ativo !== false && v.preco && !isNaN(Number(v.preco)) && Number(v.preco) > 0);
    if (variacoesAtivas.length === 0) return <p className="text-2xl font-bold text-gray-400">--</p>;
    if (variacoesAtivas.length === 1) return <p className="text-2xl font-bold text-gray-800">R$ {Number(variacoesAtivas[0].preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>;
    const menorPreco = Math.min(...variacoesAtivas.map(v => Number(v.preco)));
    return (
      <div className="flex flex-col">
        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">A partir de</span>
        <span className="text-xl font-bold text-gray-800">R$ {menorPreco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
      </div>
    );
  };

  return (
    <div className="group bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-100 transition-all duration-300 flex flex-col h-full overflow-hidden relative">
      <div className="relative h-48 overflow-hidden bg-gray-50">
        {produto.imageUrl ? (
          <img src={produto.imageUrl} alt={produto.nome} className="w-full h-full object-contain p-4 mix-blend-multiply transition-transform duration-500 group-hover:scale-110"/>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300"><IoImageOutline className="text-5xl" /></div>
        )}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
            {produto.ativo === false && <span className="bg-gray-900/80 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><IoEyeOff /> Inativo</span>}
            <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 shadow-sm ${color}`}><Icon /> {label}</span>
        </div>
        {profitMargin > 0 && <div className={`absolute top-3 right-3 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md ${getProfitColor(profitMargin)}`}>{profitMargin.toFixed(0)}% Lucro</div>}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{produto.categoria}</span>
            {produto.codigoBarras && <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1" title="Código de Barras"><IoBarcodeOutline /> {produto.codigoBarras}</span>}
        </div>
        <h3 className="font-bold text-gray-800 text-lg leading-tight mb-2 line-clamp-1" title={produto.nome}>{produto.nome}</h3>
        {produto.descricao && <p className="text-gray-500 text-sm line-clamp-2 mb-4 h-10 leading-snug">{produto.descricao}</p>}

        <div className="mt-auto border-t border-gray-100 pt-4">
            <div className="flex justify-between items-end mb-4">
                <div>{mostrarPrecosVariacoes()}</div>
                <div className="text-right">
                    <p className="text-xs text-gray-400 font-medium uppercase">Estoque</p>
                    <p className={`text-lg font-bold ${Number(produto.estoque) <= 0 ? 'text-red-500' : 'text-gray-700'}`}>{produto.estoque}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <input ref={fileInput3DRef} type="file" accept=".glb,.gltf" className="hidden" 
                  onChange={(e) => { const f = e.target.files?.[0]; if(f) onUpload3D(produto, f); e.target.value = ''; }} />
                <button onClick={produto.modelo3dUrl ? undefined : () => fileInput3DRef.current?.click()} disabled={!!produto.modelo3dUrl || uploading3D}
                  className={`col-span-2 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${produto.modelo3dUrl ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-default' : uploading3D ? 'bg-violet-50 text-violet-400 border border-violet-200 cursor-wait' : 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200'}`}>
                  <IoCube size={14} />{produto.modelo3dUrl ? '✓ 3D Pronto' : uploading3D ? 'Enviando...' : 'Enviar 3D (.glb)'}
                </button>
                <button onClick={onToggleStatus} className={`py-2 rounded-xl text-xs font-bold transition-colors ${produto.ativo !== false ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                    {produto.ativo !== false ? 'Pausar' : 'Ativar'}
                </button>
                <div className="flex gap-2">
                    <button onClick={onEdit} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-blue-200 shadow-lg">Editar</button>
                    <button onClick={onDelete} className="w-10 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-colors border border-red-100"><IoClose size={16} /></button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

const StatsCard = ({ title, value, icon: Icon, colorClass, bgClass }) => (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between hover:translate-y-[-2px] transition-transform duration-300">
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{title}</p>
        <p className={`text-2xl font-extrabold ${colorClass}`}>{value}</p>
      </div>
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${bgClass}`}>
        <Icon className={`text-xl ${colorClass}`} />
      </div>
    </div>
);

function AdminMenuManagement() {
  const { userData } = useAuth();
  const { setActions, clearActions } = useHeader();
  const primeiroEstabelecimento = userData?.estabelecimentosGerenciados?.[0];
  const menuParams = useAdminMenuData(primeiroEstabelecimento);
  
  const [viewMode, setViewMode] = useState('grid');
  
  const ITEMS_PER_PAGE = viewMode === 'grid' ? 12 : 8;
  const { currentPage, totalPages, paginatedItems, goToPage } = usePagination(menuParams.filteredAndSortedItems, ITEMS_PER_PAGE);

  useEffect(() => { goToPage(1); }, [menuParams.searchTerm, menuParams.selectedCategory, menuParams.stockFilter, goToPage]);

  useEffect(() => {
    const actions = (
        <div className="flex items-center space-x-2">
            <div className="hidden md:flex bg-white rounded-xl border border-gray-200 p-1">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}><IoGrid/></button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-gray-400'}`}><IoMenu/></button>
            </div>
            <button onClick={() => menuParams.openItemForm()} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl shadow-lg text-sm transition-all transform hover:scale-105">
                <IoAddCircleOutline className="text-xl"/> <span className="hidden sm:inline">Novo Item</span>
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

  if (menuParams.loading) return <div className="p-6 max-w-7xl mx-auto"><SkeletonLoader /></div>;

  const isModoMultiplasVariacoes = menuParams.variacoes.length > 1 || (menuParams.variacoes.length === 1 && menuParams.variacoes[0]?.nome !== 'Padrão');

  return (
    <div className="min-h-screen bg-[#F3F4F6] p-4 md:p-6 font-sans pb-24">
      <div className="max-w-7xl mx-auto">
        
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
            <StatsCard title="Total Itens" value={menuParams.stockStatistics.totalItems} icon={IoList} colorClass="text-blue-600" bgClass="bg-blue-50" />
            <StatsCard title="Ativos" value={menuParams.stockStatistics.activeItems} icon={IoCheckmarkCircle} colorClass="text-emerald-600" bgClass="bg-emerald-50" />
            <StatsCard title="Crítico" value={menuParams.stockStatistics.criticalStock} icon={IoAlertCircle} colorClass="text-orange-600" bgClass="bg-orange-50" />
            <StatsCard title="Esgotados" value={menuParams.stockStatistics.outOfStock} icon={IoClose} colorClass="text-red-600" bgClass="bg-red-50" />
            <div className="col-span-2">
                <StatsCard title="Valor Estoque" value={`R$ ${menuParams.stockStatistics.totalInventoryValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={IoCash} colorClass="text-indigo-600" bgClass="bg-indigo-50" />
            </div>
        </div>

        <div className="sticky top-2 z-30 bg-white/90 backdrop-blur-md rounded-2xl shadow-sm border border-gray-200 p-2 mb-8 flex flex-col md:flex-row gap-2 md:items-center">
            <div className="relative flex-1">
                <IoSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Buscar por nome, ingrediente ou código..." value={menuParams.searchTerm} onChange={e => menuParams.setSearchTerm(e.target.value)} 
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-100 rounded-xl transition-all outline-none" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                <select value={menuParams.selectedCategory} onChange={e => menuParams.setSelectedCategory(e.target.value)} className="px-4 py-2.5 bg-gray-50 rounded-xl text-sm font-medium outline-none cursor-pointer">
                    {['Todos', ...new Set(menuParams.categories.map(c => c.nome))].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={menuParams.stockFilter} onChange={e => menuParams.setStockFilter(e.target.value)} className="px-4 py-2.5 bg-gray-50 rounded-xl text-sm font-medium outline-none cursor-pointer">
                    <option value="todos">Estoque (Todos)</option>
                    <option value="critico">⚠️ Crítico</option>
                    <option value="esgotado">🚫 Esgotado</option>
                    <option value="normal">✅ Normal</option>
                </select>
            </div>
        </div>

        <div className="min-h-[400px]">
            {paginatedItems.length > 0 ? (
                <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-3"}>
                    {paginatedItems.map(item => (
                        viewMode === 'grid' ? (
                            <ProductGridCard key={item.id} produto={item} onEdit={() => menuParams.openItemForm(item)} onDelete={() => menuParams.handleDeleteItem(item)}
                                onToggleStatus={() => menuParams.toggleItemStatus(item)} onUpload3D={menuParams.handleUpload3D} uploading3D={menuParams.uploading3DItemId === item.id}
                                stockStatus={item.estoque <= 0 ? 'esgotado' : (item.estoque <= item.estoqueMinimo ? 'critico' : 'normal')}
                                profitMargin={((item.preco - item.custo) / item.preco) * 100} />
                        ) : (
                            <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between hover:border-blue-200 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                                        {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-contain p-1 mix-blend-multiply"/> : <IoImageOutline className="text-gray-300"/>}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800">{item.nome}</h3>
                                        <p className="text-xs text-gray-500">{item.categoria} • {item.ativo !== false ? <span className="text-green-600">Ativo</span> : <span className="text-red-500">Inativo</span>}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right hidden sm:block">
                                        <p className="font-bold">R$ {Number(item.preco).toFixed(2)}</p>
                                        <p className="text-xs text-gray-400">Estoque: {item.estoque}</p>
                                    </div>
                                    <button onClick={() => menuParams.openItemForm(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><IoPricetag/></button>
                                </div>
                            </div>
                        )
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
                    <IoCube className="text-4xl text-gray-300 mb-4" />
                    <h3 className="text-xl font-bold text-gray-600">Nenhum item encontrado</h3>
                    <p className="text-gray-400">Tente mudar o termo de busca ou filtros.</p>
                </div>
            )}
        </div>

        {paginatedItems.length > 0 && <div className="mt-8"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} /></div>}

        {menuParams.showItemForm && (
          <div className="fixed inset-0 z-[9999] bg-white flex flex-col animate-fade-in">
            <div className="flex-none h-20 sm:h-24 border-b border-gray-200 px-4 sm:px-8 flex items-center justify-between bg-white shadow-sm z-20">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{menuParams.editingItem ? 'Editar Produto' : 'Novo Produto'}</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Gestão de Cardápio & Estoque</p>
              </div>
              <button type="button" onClick={menuParams.closeItemForm} className="px-4 py-2 sm:px-6 sm:py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold transition-all flex items-center gap-2">
                <span className="hidden sm:block">Voltar</span>
                <IoClose size={20} className="sm:hidden" />
              </button>
            </div>

            <form onSubmit={(e) => menuParams.handleSaveItem(e)} className="flex-1 overflow-hidden flex flex-col bg-gray-50">
              <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-10 pb-32 w-full custom-scrollbar">
                <div className="max-w-5xl mx-auto space-y-6 sm:space-y-10">
                    <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-gray-200 space-y-6">
                        <h3 className="text-lg font-bold text-gray-800">Dados Gerais</h3>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold mb-2 text-gray-700">Nome do Produto *</label>
                                <input type="text" name="nome" value={menuParams.formData.nome} onChange={handleFormChange} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-2 text-gray-700">Categoria *</label>
                                    <input type="text" name="categoria" value={menuParams.formData.categoria} onChange={handleFormChange} list="cat-list" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all" required />
                                    <datalist id="cat-list">{menuParams.categories.map(c => (<option key={c.id} value={c.nome} />))}</datalist>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-2 text-gray-700">Cód. Barras</label>
                                    <input type="text" name="codigoBarras" value={menuParams.formData.codigoBarras} onChange={handleFormChange} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-mono" />
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-2 text-gray-700">Descrição</label>
                            <textarea name="descricao" value={menuParams.formData.descricao} onChange={handleFormChange} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none transition-all min-h-[100px] resize-none" />
                        </div>
                    </div>

                    <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-gray-200 space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><IoCash className="text-blue-600"/> Preços & Estoque</h3>
                            <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
                                <button type="button" onClick={() => menuParams.setVariacoes([{id: `v-unique`, nome: 'Padrão', preco: '', ativo: true, estoque: 0, custo: 0 }])} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${menuParams.variacoes.length === 1 && menuParams.variacoes[0].nome === 'Padrão' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>Preço Único</button>
                                <button type="button" onClick={() => { if(menuParams.variacoes.length===1 && menuParams.variacoes[0].nome==='Padrão') menuParams.setVariacoes([{id: `v-multi`, nome: 'Médio', preco: '', ativo: true, estoque: 0, custo: 0}]); }} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${menuParams.variacoes.length > 1 || menuParams.variacoes[0].nome !== 'Padrão' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>Vários Tamanhos</button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {menuParams.variacoes.map((v) => (
                                <div key={v.id} className="bg-gray-50 p-5 rounded-2xl border border-gray-200 relative group">
                                    {menuParams.variacoes.length > 1 && (
                                        <button type="button" onClick={() => menuParams.removerVariacao(v.id)} className="absolute -top-3 -right-3 bg-red-100 text-red-600 p-2 rounded-full shadow-md"><IoClose size={18}/></button>
                                    )}
                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-5">
                                        {(menuParams.variacoes.length > 1 || v.nome !== 'Padrão') && (
                                            <div className="sm:col-span-4">
                                                <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Nome da Variação</label>
                                                <input type="text" value={v.nome} onChange={e => menuParams.atualizarVariacao(v.id, 'nome', e.target.value)} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm font-bold" />
                                            </div>
                                        )}
                                        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 ${menuParams.variacoes.length > 1 || v.nome !== 'Padrão' ? 'sm:col-span-8' : 'sm:col-span-12'}`}>
                                            <div>
                                                <label className="text-xs font-bold text-emerald-600 mb-2 block uppercase">Venda (R$)</label>
                                                <input type="number" step="0.01" value={v.preco} onChange={e => menuParams.atualizarVariacao(v.id, 'preco', e.target.value)} className="w-full p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-bold text-emerald-800" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Custo (R$)</label>
                                                <input type="number" step="0.01" value={v.custo} onChange={e => menuParams.atualizarVariacao(v.id, 'custo', e.target.value)} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Estoque</label>
                                                <input type="number" value={v.estoque} onChange={e => menuParams.atualizarVariacao(v.id, 'estoque', e.target.value)} className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 mb-2 block uppercase">Status</label>
                                                <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded-xl border border-gray-200">
                                                    <input type="checkbox" checked={v.ativo !== false} onChange={e => menuParams.atualizarVariacao(v.id, 'ativo', e.target.checked)} className="w-4 h-4 text-blue-600" />
                                                    <span className="text-[10px] font-bold">ATIVO</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {isModoMultiplasVariacoes && (
                            <button type="button" onClick={menuParams.adicionarVariacao} className="w-full py-4 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold flex items-center justify-center gap-2 rounded-2xl mt-4 border border-dashed border-blue-200">
                                <IoAddCircleOutline className="text-2xl"/> Adicionar Variação
                            </button>
                        )}
                    </div>

                    <div className="bg-emerald-50/40 p-5 sm:p-8 rounded-3xl border border-emerald-100 shadow-sm space-y-6">
                        <h3 className="text-lg font-bold text-emerald-800 flex items-center gap-2">🏢 Emissão de Nota (NFC-e)</h3>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-emerald-800 mb-2">Departamento Fiscal (Preenchimento Automático)</label>
                            <select 
                                value={menuParams.formData.fiscal?.departamentoId || ''} 
                                onChange={handleDepartamentoChange} 
                                className="w-full p-4 bg-white border border-emerald-300 rounded-2xl outline-none font-bold text-emerald-900 shadow-sm"
                            >
                                <option value="">-- Personalizado (Preencher Manualmente) --</option>
                                {menuParams.departamentosFiscais?.map(d => (
                                    <option key={d.id} value={d.id}>{d.nome} (CFOP: {d.cfop} / NCM: {d.ncm})</option>
                                ))}
                            </select>
                            <p className="text-xs text-emerald-600 mt-2">Ao escolher um departamento, as regras fiscais abaixo serão preenchidas automaticamente.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="relative">
                                <label className="block text-sm font-semibold text-emerald-800 mb-2">NCM (Busca BrasilAPI)</label>
                                <input type="text" name="ncm" value={menuParams.termoNcm} onChange={(e) => menuParams.buscarNcm(e.target.value, handleFiscalChange)} className={`w-full p-4 bg-white border border-emerald-200 rounded-2xl outline-none ${menuParams.formData.fiscal?.departamentoId ? 'opacity-70 bg-gray-50' : ''}`} autoComplete="off" />
                                {menuParams.pesquisandoNcm && <span className="absolute right-4 top-12 text-[10px] animate-pulse">Buscando...</span>}
                                {menuParams.ncmResultados.length > 0 && (
                                    <div className="absolute z-50 w-full mt-2 bg-white border border-emerald-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                        {menuParams.ncmResultados.map((item) => (
                                            <div key={item.codigo} onClick={() => { menuParams.setTermoNcm(item.codigo); handleFiscalChange({ target: { name: 'ncm', value: item.codigo } }); menuParams.setNcmResultados([]); }} className="p-3 border-b hover:bg-emerald-50 cursor-pointer">
                                                <p className="font-bold text-emerald-800 text-xs">{item.codigo}</p>
                                                <p className="text-[10px] text-gray-500 line-clamp-1">{item.descricao}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-emerald-800 mb-2">CFOP</label>
                                <select disabled={!!menuParams.formData.fiscal?.departamentoId} name="cfop" value={menuParams.formData.fiscal?.cfop} onChange={handleFiscalChange} className={`w-full p-4 bg-white border border-emerald-200 rounded-2xl ${menuParams.formData.fiscal?.departamentoId ? 'opacity-70 bg-gray-50 cursor-not-allowed' : ''}`}>
                                    <option value="5102">5102 - Venda Normal</option>
                                    <option value="5405">5405 - Subs. Tributária</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-emerald-800 mb-2">Unidade</label>
                                <select name="unidade" value={menuParams.formData.fiscal?.unidade} onChange={handleFiscalChange} className="w-full p-4 bg-white border border-emerald-200 rounded-2xl">
                                    <option value="UN">UN - Unidade</option>
                                    <option value="KG">KG - Quilograma</option>
                                    <option value="LT">LT - Litro</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm flex items-center gap-4">
                            <div className="w-24 h-24 bg-gray-50 rounded-2xl border flex items-center justify-center overflow-hidden shrink-0">
                                {menuParams.imagePreview ? <img src={menuParams.imagePreview} className="w-full h-full object-cover" /> : <IoImageOutline className="text-4xl text-gray-300"/>}
                            </div>
                            <div className="flex-1">
                                <label className="block text-base font-bold text-gray-800 mb-2">Foto</label>
                                <input type="file" accept="image/*" onChange={handleFormChange} className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-100 file:text-blue-700 font-bold" />
                            </div>
                        </div>

                        <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex items-center justify-center">
                            <label htmlFor="ativoMain" className="flex items-center gap-4 cursor-pointer">
                                <div className={`w-14 h-7 rounded-full p-1 transition-colors ${menuParams.formData.ativo ? 'bg-blue-600' : 'bg-gray-300'}`}>
                                    <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${menuParams.formData.ativo ? 'translate-x-7' : 'translate-x-0'}`}></div>
                                </div>
                                <input type="checkbox" id="ativoMain" name="ativo" checked={menuParams.formData.ativo} onChange={handleFormChange} className="hidden" />
                                <div>
                                    <p className="font-bold text-gray-800">Visível no Cardápio?</p>
                                    <p className="text-xs text-gray-500">{menuParams.formData.ativo ? 'Os clientes podem pedir' : 'Produto pausado'}</p>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
              </div>

              <div className="flex-none bg-white border-t px-4 sm:px-8 py-5 flex justify-end gap-4 shadow-inner z-20 pb-10 sm:pb-5">
                  <button type="button" onClick={menuParams.closeItemForm} className="hidden sm:block px-8 py-4 rounded-xl border font-bold text-gray-600 hover:bg-gray-50 transition-all text-lg">Cancelar</button>
                  <button type="submit" disabled={menuParams.formLoading} className="w-full sm:w-auto px-10 py-4 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-xl transition-all transform hover:scale-[1.02] text-lg flex items-center justify-center gap-2">
                      {menuParams.formLoading ? 'Processando...' : <><IoCheckmarkCircle size={24}/> Salvar Produto</>}
                  </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}

export default withEstablishmentAuth(AdminMenuManagement);