import React from 'react';
import { createPortal } from 'react-dom';
import { 
    IoClose, IoCube, IoCash, IoFlask, IoBarcodeOutline, IoImageOutline, 
    IoChevronUp, IoChevronDown, IoAddCircleOutline, IoCheckmarkCircle, 
    IoEyeOff, IoTrashOutline 
} from 'react-icons/io5';

const ProductModal = ({
    menuParams,
    t,
    isDark,
    tipoNegocio,
    activeModalTab,
    handleFormScroll,
    scrollToSection,
    sectionGeraisRef,
    sectionPrecosRef,
    sectionFichaRef,
    sectionFiscalRef,
    sectionFotoRef,
    handleFormChange,
    isModoMultiplasVariacoes,
    getTerminology
}) => {
    return createPortal(
<div className="fixed inset-0 z-[99999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-0 md:p-6 animate-fade-in animate-duration-300">
            <div className={`w-full h-full md:h-[90vh] md:max-w-7xl md:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border relative ${t.modalBg}`}>
              <div className={`flex-none h-20 px-6 md:px-10 flex items-center justify-between border-b shadow-sm z-25 ${t.modalHeader}`}>
                <div>
                  <h2 className={`text-xl md:text-2xl font-black ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                      {menuParams.editingItem ? 'Editar Produto' : 'Novo Produto'}
                  </h2>
                  <p className={`text-xs font-medium hidden sm:block ${t.textSecondary}`}>Preencha as informações do item abaixo.</p>
                </div>
                <button type="button" onClick={menuParams.closeItemForm} className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 hover:rotate-90 ${isDark ? 'bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400' : 'bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500'}`}>
                  <IoClose size={22} />
                </button>
              </div>
 
              <form onSubmit={(e) => menuParams.handleSaveItem(e)} className="flex-1 overflow-hidden flex flex-col relative">
                
                {/* Split Layout Container */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative">
                  
                  {/* Left Sidebar navigation (Desktop only) */}
                  <div className={`hidden md:flex w-64 border-r p-6 flex-col justify-between shrink-0 ${isDark ? 'bg-slate-950 border-slate-800/80' : 'bg-slate-50 border-slate-200/50'}`}>
                    <div className="space-y-1.5">
                      <p className={`text-sm font-extrabold uppercase tracking-wider mb-4 px-2 ${t.textMuted}`}>Seções do Produto</p>
                      {[
                        { id: 'gerais', label: 'Dados Gerais', icon: IoCube, ref: sectionGeraisRef },
                        { id: 'precos', label: 'Preços & Estoque', icon: IoCash, ref: sectionPrecosRef },
                        ...(tipoNegocio === 'restaurante' && menuParams.insumosDisponiveis.length > 0 ? [{ id: 'ficha', label: 'Ficha Técnica', icon: IoFlask, ref: sectionFichaRef }] : []),
                        { id: 'fiscal', label: 'Fiscal (NFC-e)', icon: IoBarcodeOutline, ref: sectionFiscalRef },
                        { id: 'exibicao', label: 'Foto & Visibilidade', icon: IoImageOutline, ref: sectionFotoRef }
                      ].map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeModalTab === tab.id;
                        
                        const tabColors = {
                          gerais: {
                            active: isDark ? 'bg-blue-950/40 text-blue-400 border-blue-900/50 shadow-md' : 'bg-blue-50 text-blue-600 shadow-sm border-blue-100/50',
                            hover: isDark ? 'hover:text-blue-300 hover:bg-blue-950/20' : 'hover:text-blue-700 hover:bg-blue-50/50',
                            text: isDark ? 'text-blue-400' : 'text-blue-600'
                          },
                          precos: {
                            active: isDark ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50 shadow-md' : 'bg-emerald-50 text-emerald-600 shadow-sm border-emerald-100/50',
                            hover: isDark ? 'hover:text-emerald-300 hover:bg-emerald-950/20' : 'hover:text-emerald-700 hover:bg-emerald-50/50',
                            text: isDark ? 'text-emerald-400' : 'text-emerald-600'
                          },
                          ficha: {
                            active: isDark ? 'bg-purple-950/40 text-purple-400 border-purple-900/50 shadow-md' : 'bg-purple-50 text-purple-600 shadow-sm border-purple-100/50',
                            hover: isDark ? 'hover:text-purple-300 hover:bg-purple-950/20' : 'hover:text-purple-700 hover:bg-purple-50/50',
                            text: isDark ? 'text-purple-400' : 'text-purple-600'
                          },
                          fiscal: {
                            active: isDark ? 'bg-amber-950/40 text-amber-400 border-amber-900/50 shadow-md' : 'bg-amber-50 text-amber-600 shadow-sm border-amber-100/50',
                            hover: isDark ? 'hover:text-amber-300 hover:bg-amber-950/20' : 'hover:text-amber-700 hover:bg-amber-50/50',
                            text: isDark ? 'text-amber-400' : 'text-amber-600'
                          },
                          exibicao: {
                            active: isDark ? 'bg-rose-950/40 text-rose-400 border-rose-900/50 shadow-md' : 'bg-rose-50 text-rose-600 shadow-sm border-rose-100/50',
                            hover: isDark ? 'hover:text-rose-300 hover:bg-rose-950/20' : 'hover:text-rose-700 hover:bg-rose-50/50',
                            text: isDark ? 'text-rose-400' : 'text-rose-600'
                          }
                        };
                        
                        const colors = tabColors[tab.id] || {
                          active: isDark ? 'bg-slate-900 text-[var(--color-primary)] border border-slate-800/80 shadow-md' : 'bg-white text-[var(--color-primary)] shadow-sm border border-slate-100/50',
                          hover: isDark ? 'hover:text-slate-200 hover:bg-slate-900/30' : 'hover:text-slate-700 hover:bg-slate-100/50',
                          text: 'text-[var(--color-primary)]'
                        };

                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => scrollToSection(tab.ref, tab.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-300 transform ${
                              isActive
                                ? `${colors.active} translate-x-1`
                                : `${isDark ? 'text-slate-400' : 'text-slate-500'} ${colors.hover}`
                            }`}
                          >
                            <Icon size={16} className={isActive ? colors.text : 'text-slate-400'} />
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>
                    
                    <div className={`backdrop-blur-sm p-4 rounded-2xl border shadow-sm text-center ${isDark ? 'bg-slate-900/40 border-slate-800/80' : 'bg-white/80 border-slate-100'}`}>
                      <p className={`text-sm font-extrabold uppercase tracking-wider ${t.textMuted}`}>Preço Principal</p>
                      <p className="text-2xl font-black text-[var(--color-primary)] mt-1">
                        {menuParams.formData.preco ? `R$ ${Number(menuParams.formData.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : (menuParams.variacoes?.[0]?.preco ? `R$ ${Number(menuParams.variacoes[0].preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '--')}
                      </p>
                    </div>
                  </div>
 
                  {/* Form Container (Scrollable) */}
                  <div 
                    onScroll={handleFormScroll}
                    className={`flex-1 overflow-y-auto px-4 md:px-10 py-8 custom-scrollbar ${t.modalBody}`}
                  >
                    <div className="max-w-5xl mx-auto space-y-8 pb-32">
                        {/* Dados Gerais */}
                        <div ref={sectionGeraisRef} className={`p-6 md:p-8 rounded-3xl border space-y-6 shadow-sm transition-all duration-300 ${isDark ? 'bg-slate-900/40 border-slate-800/60' : 'bg-white border-slate-100/60'}`}>
                            <div className={`flex items-center gap-3 border-b pb-4 ${isDark ? 'border-slate-800/60' : 'border-slate-50'}`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}><IoCube size={18}/></div>
                                <div>
                                    <h3 className={`text-base font-bold ${t.text}`}>Dados Gerais</h3>
                                    <p className={`text-sm ${t.textSecondary}`}>Identificação e descrição do produto no sistema</p>
                                </div>
                            </div>
                            
                            <div className="grid md:grid-cols-3 gap-6">
                                <div className="md:col-span-1">
                                    <label className={`block text-sm font-bold mb-2 uppercase tracking-wider ${t.textSecondary}`}>Tipo de Item</label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => menuParams.setFormData(prev => ({ ...prev, tipoItem: 'produto' }))}
                                            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black border transition-all duration-300 ${
                                                menuParams.formData.tipoItem !== 'servico'
                                                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 font-black'
                                                    : 'bg-white hover:bg-slate-50 text-slate-650 border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 dark:border-slate-800 dark:text-slate-200'
                                            }`}
                                        >
                                            📦 Produto
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => menuParams.setFormData(prev => ({ ...prev, tipoItem: 'servico' }))}
                                            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black border transition-all duration-300 ${
                                                menuParams.formData.tipoItem === 'servico'
                                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-black'
                                                    : 'bg-white hover:bg-slate-50 text-slate-650 border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 dark:border-slate-800 dark:text-slate-200'
                                            }`}
                                        >
                                            🛠️ Serviço
                                        </button>
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className={`block text-sm font-bold mb-2 uppercase tracking-wider ${t.textSecondary}`}>Nome do Produto / Serviço <span className="text-red-500">*</span></label>
                                    <input type="text" name="nome" value={menuParams.formData.nome} onChange={handleFormChange} className={`w-full px-4 py-3 border rounded-xl outline-none transition-all duration-300 font-bold text-base ${isDark ? 'bg-slate-955 border-slate-800/80 focus:bg-slate-900 focus:border-[var(--color-primary)] text-white focus:ring-4 focus:ring-[var(--color-primary)]/10' : 'bg-slate-50/50 border-slate-200/80 focus:bg-white focus:border-[var(--color-primary)] text-slate-800 focus:ring-4 focus:ring-[var(--color-primary)]/10'}`} required autoComplete="off" placeholder={tipoNegocio === 'restaurante' ? "Ex: Hambúrguer Clássico" : "Ex: Parafusadeira Dewalt, Camiseta Slim, etc."} />
                                </div>
                            </div>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="grid grid-cols-2 gap-4 col-span-2">
                                    <div>
                                        <label className={`block text-sm font-bold mb-2 uppercase tracking-wider ${t.textSecondary}`}>Categoria <span className="text-red-500">*</span></label>
                                        <input type="text" name="categoria" value={menuParams.formData.categoria} onChange={handleFormChange} list="cat-list" className={`w-full px-4 py-3 border rounded-xl outline-none transition-all duration-300 font-bold text-base ${isDark ? 'bg-slate-955 border-slate-800/80 focus:bg-slate-900 focus:border-[var(--color-primary)] text-white focus:ring-4 focus:ring-[var(--color-primary)]/10' : 'bg-slate-50/50 border-slate-200/80 focus:bg-white focus:border-[var(--color-primary)] text-slate-800 focus:ring-4 focus:ring-[var(--color-primary)]/10'}`} required autoComplete="off" placeholder="Selecione..." />
                                        <datalist id="cat-list">{menuParams.categories.map(c => (<option key={c.id} value={c.nome} />))}</datalist>
                                    </div>
                                    <div>
                                        <label className={`block text-sm font-bold mb-2 uppercase tracking-wider ${t.textSecondary}`}>Cód. Barras</label>
                                        <input type="text" name="codigoBarras" value={menuParams.formData.codigoBarras} onChange={handleFormChange} className={`w-full px-4 py-3 border rounded-xl outline-none transition-all duration-300 font-mono text-base ${isDark ? 'bg-slate-955 border-slate-800/80 focus:bg-slate-900 focus:border-[var(--color-primary)] text-white focus:ring-4 focus:ring-[var(--color-primary)]/10' : 'bg-slate-50/50 border-slate-200/80 focus:bg-white focus:border-[var(--color-primary)] text-slate-800 focus:ring-4 focus:ring-[var(--color-primary)]/10'}`} autoComplete="off" placeholder="789..." />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className={`block text-sm font-bold mb-2 uppercase tracking-wider ${t.textSecondary}`}>Descrição</label>
                                <textarea name="descricao" value={menuParams.formData.descricao} onChange={handleFormChange} placeholder={tipoNegocio === 'restaurante' ? "Do que é feito? Quais os diferenciais e ingredientes?" : "Descrição detalhada, especificações técnicas ou diferenciais do produto"} className={`w-full px-4 py-3 border rounded-xl outline-none transition-all duration-300 min-h-[100px] resize-none leading-relaxed text-base font-medium ${isDark ? 'bg-slate-955 border-slate-800/80 focus:bg-slate-900 focus:border-[var(--color-primary)] text-white focus:ring-4 focus:ring-[var(--color-primary)]/10' : 'bg-slate-50/50 border-slate-200/80 focus:bg-white focus:border-[var(--color-primary)] text-slate-650 focus:ring-4 focus:ring-[var(--color-primary)]/10'}`} />
                            </div>
                        </div>

                        {/* Preços e Estoque */}
                        <div ref={sectionPrecosRef} className={`p-6 md:p-8 rounded-3xl border space-y-6 shadow-sm transition-all duration-300 ${isDark ? 'bg-slate-900/40 border-slate-800/60' : 'bg-white border-slate-100/60'}`}>
                            <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4 ${isDark ? 'border-slate-800/60' : 'border-slate-50'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}><IoCash size={18}/></div>
                                    <div>
                                        <h3 className={`text-base font-bold ${t.text}`}>Preços & Estoque</h3>
                                        <p className={`text-sm ${t.textSecondary}`}>Valores de venda, custo comercial e estoques</p>
                                    </div>
                                </div>
                                <div className={`flex p-1 rounded-xl w-full sm:w-auto overflow-hidden border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100/60 border-slate-200/30'}`}>
                                    <button type="button" onClick={() => menuParams.setVariacoes([{id: `v-unique`, nome: 'Padrão', preco: '', ativo: true, estoque: 0, custo: 0 }])} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${menuParams.variacoes.length === 1 && menuParams.variacoes[0].nome === 'Padrão' ? (isDark ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-800 shadow-sm') : 'text-slate-500 hover:text-slate-350'}`}>Preço Único</button>
                                    <button type="button" onClick={() => { if(menuParams.variacoes.length===1 && menuParams.variacoes[0].nome==='Padrão') menuParams.setVariacoes([{id: `v-multi`, nome: 'Médio', preco: '', ativo: true, estoque: 0, custo: 0}]); }} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${menuParams.variacoes.length > 1 || menuParams.variacoes[0].nome !== 'Padrão' ? (isDark ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-800 shadow-sm') : 'text-slate-500 hover:text-slate-355'}`}>Variações</button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {menuParams.variacoes.map((v, index) => (
                                    <div key={v.id} className={`p-5 rounded-2xl border relative group/var transition-all duration-300 ${isDark ? 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700' : 'bg-slate-50/30 border-slate-100 hover:border-slate-200'}`}>
                                        {menuParams.variacoes.length > 1 && (
                                            <div className={`absolute -top-3 -right-3 flex gap-1 p-1 rounded-full shadow-md border z-10 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-100'}`}>
                                                {index > 0 && (
                                                    <button type="button" onClick={() => menuParams.reordenarVariacao(index, -1)} className="text-slate-500 hover:text-[var(--color-primary)] p-1 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors" title="Mover para Cima">
                                                        <IoChevronUp size={14}/>
                                                    </button>
                                                )}
                                                {index < menuParams.variacoes.length - 1 && (
                                                    <button type="button" onClick={() => menuParams.reordenarVariacao(index, 1)} className="text-slate-500 hover:text-[var(--color-primary)] p-1 rounded-md hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors" title="Mover para Baixo">
                                                        <IoChevronDown size={14}/>
                                                    </button>
                                                )}
                                                <button type="button" onClick={() => menuParams.removerVariacao(v.id)} className="text-red-500 hover:bg-red-500/10 p-1 rounded-md transition-colors" title="Excluir">
                                                    <IoClose size={15}/>
                                                </button>
                                            </div>
                                        )}
                                        <div className="flex flex-col gap-4">
                                            {/* LINHA SUPERIOR: Informações Internas (Custo, Estoque, Status e Nome se houver) */}
                                            {(menuParams.variacoes.length > 1 || v.nome !== 'Padrão') ? (
                                                <div className="grid grid-cols-2 sm:grid-cols-12 gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                                                    <div className="col-span-2 sm:col-span-6">
                                                        <label className={`text-xs font-bold mb-1.5 block uppercase tracking-wider ${t.textSecondary}`}>Nome da Variação</label>
                                                        <input 
                                                            type="text" 
                                                            value={v.nome} 
                                                            onChange={e => menuParams.atualizarVariacao(v.id, 'nome', e.target.value.toUpperCase())} 
                                                            className={`w-full px-3 py-2.5 border rounded-xl text-base font-bold outline-none transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800 focus:bg-slate-900 focus:border-[var(--color-primary)] text-white' : 'bg-white border-slate-200 text-slate-700 focus:border-[var(--color-primary)]'}`} 
                                                            placeholder={tipoNegocio === 'restaurante' ? "Ex: Grande, Combo..." : "Ex: G, M, Cor, Voltagem, etc."} 
                                                        />
                                                    </div>
                                                    <div className="col-span-1 sm:col-span-2">
                                                        <label className={`text-xs font-bold mb-1.5 block uppercase tracking-wider ${t.textSecondary}`}>Custo (R$)</label>
                                                        <input 
                                                            type="number" 
                                                            step="0.01" 
                                                            value={Number(v.custo) === 0 ? '' : v.custo} 
                                                            onChange={e => menuParams.atualizarVariacao(v.id, 'custo', e.target.value)} 
                                                            onFocus={e => e.target.select()}
                                                            className={`w-full px-3 py-2.5 border rounded-xl text-base font-medium outline-none transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800 focus:bg-slate-900 focus:border-[var(--color-primary)] text-white' : 'bg-white border-slate-200 text-slate-700 focus:border-[var(--color-primary)]'}`} 
                                                            placeholder="0.00" 
                                                        />
                                                    </div>
                                                    {menuParams.formData.tipoItem !== 'servico' && (
                                                        <div className="col-span-1 sm:col-span-2">
                                                            <label className={`text-xs font-bold mb-1.5 block uppercase tracking-wider ${t.textSecondary}`}>Estoque Qtd</label>
                                                            <input 
                                                                type="number" 
                                                                value={Number(v.estoque) === 0 ? '' : v.estoque} 
                                                                onChange={e => menuParams.atualizarVariacao(v.id, 'estoque', e.target.value)} 
                                                                onFocus={e => e.target.select()}
                                                                className={`w-full px-3 py-2.5 border rounded-xl text-base font-bold outline-none transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800 focus:bg-slate-900 focus:border-[var(--color-primary)] text-white' : 'bg-white border-slate-200 text-slate-700 focus:border-[var(--color-primary)]'}`} 
                                                                placeholder="0" 
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="col-span-2 sm:col-span-2">
                                                        <label className={`text-xs font-bold mb-1.5 block uppercase tracking-wider ${t.textSecondary}`}>Status</label>
                                                        <label className={`flex justify-center items-center px-4 py-2 h-[46px] cursor-pointer rounded-xl border transition-all duration-300 ${v.ativo !== false ? (isDark ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20 text-[var(--color-primary)]' : 'bg-[var(--color-primary)]/[0.05] border-[var(--color-primary)]/20 text-[var(--color-primary)]') : (isDark ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-white border-slate-200 text-slate-400')}`}>
                                                            <input type="checkbox" checked={v.ativo !== false} onChange={e => menuParams.atualizarVariacao(v.id, 'ativo', e.target.checked)} className="hidden" />
                                                            <span className="text-[11px] font-bold">{v.ativo !== false ? '✅ ATIVO' : 'PAUSADO'}</span>
                                                        </label>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                                                    <div className="col-span-1">
                                                        <label className={`text-xs font-bold mb-1.5 block uppercase tracking-wider ${t.textSecondary}`}>Custo (R$)</label>
                                                        <input 
                                                            type="number" 
                                                            step="0.01" 
                                                            value={Number(v.custo) === 0 ? '' : v.custo} 
                                                            onChange={e => menuParams.atualizarVariacao(v.id, 'custo', e.target.value)} 
                                                            onFocus={e => e.target.select()}
                                                            className={`w-full px-3 py-2.5 border rounded-xl text-base font-medium outline-none transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800 focus:bg-slate-900 focus:border-[var(--color-primary)] text-white' : 'bg-white border-slate-200 text-slate-700 focus:border-[var(--color-primary)]'}`} 
                                                            placeholder="0.00" 
                                                        />
                                                    </div>
                                                    {menuParams.formData.tipoItem !== 'servico' && (
                                                        <div className="col-span-1">
                                                            <label className={`text-xs font-bold mb-1.5 block uppercase tracking-wider ${t.textSecondary}`}>Estoque Qtd</label>
                                                            <input 
                                                                type="number" 
                                                                value={Number(v.estoque) === 0 ? '' : v.estoque} 
                                                                onChange={e => menuParams.atualizarVariacao(v.id, 'estoque', e.target.value)} 
                                                                onFocus={e => e.target.select()}
                                                                className={`w-full px-3 py-2.5 border rounded-xl text-base font-bold outline-none transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800 focus:bg-slate-900 focus:border-[var(--color-primary)] text-white' : 'bg-white border-slate-200 text-slate-700 focus:border-[var(--color-primary)]'}`} 
                                                                placeholder="0" 
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="col-span-2 sm:col-span-1">
                                                        <label className={`text-xs font-bold mb-1.5 block uppercase tracking-wider ${t.textSecondary}`}>Status</label>
                                                        <label className={`flex justify-center items-center px-4 py-2 h-[46px] cursor-pointer rounded-xl border transition-all duration-300 ${v.ativo !== false ? (isDark ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20 text-[var(--color-primary)]' : 'bg-[var(--color-primary)]/[0.05] border-[var(--color-primary)]/20 text-[var(--color-primary)]') : (isDark ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-white border-slate-200 text-slate-400')}`}>
                                                            <input type="checkbox" checked={v.ativo !== false} onChange={e => menuParams.atualizarVariacao(v.id, 'ativo', e.target.checked)} className="hidden" />
                                                            <span className="text-[11px] font-bold">{v.ativo !== false ? '✅ ATIVO' : 'PAUSADO'}</span>
                                                        </label>
                                                    </div>
                                                </div>
                                            )}

                                            {/* LINHA DE RASTREABILIDADE: Estoque Mínimo, Lote, Validade */}
                                            {menuParams.formData.tipoItem !== 'servico' && (
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                                                    <div>
                                                        <label className={`text-[10px] font-bold mb-1 block uppercase tracking-wider ${t.textSecondary}`}>Estoque Mínimo</label>
                                                        <input 
                                                            type="number" 
                                                            value={Number(v.estoqueMinimo) === 0 ? '' : v.estoqueMinimo} 
                                                            onChange={e => menuParams.atualizarVariacao(v.id, 'estoqueMinimo', e.target.value)} 
                                                            onFocus={e => e.target.select()}
                                                            className={`w-full px-3 py-2 border rounded-xl text-sm font-semibold outline-none transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800 focus:bg-slate-900 focus:border-[var(--color-primary)] text-white' : 'bg-white border-slate-200 text-slate-700 focus:border-[var(--color-primary)]'}`} 
                                                            placeholder="0" 
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className={`text-[10px] font-bold mb-1 block uppercase tracking-wider ${t.textSecondary}`}>Lote</label>
                                                        <input 
                                                            type="text" 
                                                            value={v.lote || ''} 
                                                            onChange={e => menuParams.atualizarVariacao(v.id, 'lote', e.target.value.toUpperCase())} 
                                                            className={`w-full px-3 py-2 border rounded-xl text-sm font-semibold outline-none transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800 focus:bg-slate-900 focus:border-[var(--color-primary)] text-white' : 'bg-white border-slate-200 text-slate-700 focus:border-[var(--color-primary)]'}`} 
                                                            placeholder="Ex: LOTE-A" 
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className={`text-[10px] font-bold mb-1 block uppercase tracking-wider ${t.textSecondary}`}>Data de Validade</label>
                                                        <input 
                                                            type="date" 
                                                            value={v.dataValidade || ''} 
                                                            onChange={e => menuParams.atualizarVariacao(v.id, 'dataValidade', e.target.value)} 
                                                            className={`w-full px-3 py-2 border rounded-xl text-sm font-semibold outline-none transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800 focus:bg-slate-900 focus:border-[var(--color-primary)] text-white' : 'bg-white border-slate-200 text-slate-700 focus:border-[var(--color-primary)]'}`} 
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* LINHA INFERIOR: Valores de Venda (Campos maiores) */}
                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                <div>
                                                    <label className="text-[11px] font-extrabold text-emerald-600 mb-1.5 block uppercase tracking-wider">Dinheiro (R$)</label>
                                                    <input 
                                                        type="number" 
                                                        step="0.01" 
                                                        value={Number(v.preco) === 0 ? '' : v.preco} 
                                                        onChange={e => menuParams.atualizarVariacao(v.id, 'preco', e.target.value)} 
                                                        onFocus={e => e.target.select()}
                                                        className={`w-full px-4 py-3 border rounded-2xl text-lg font-black outline-none transition-all duration-300 ${isDark ? 'bg-emerald-500/10 border-emerald-500/20 focus:bg-slate-900 focus:border-emerald-500 text-emerald-400' : 'bg-emerald-50/[0.03] border-emerald-500/20 focus:bg-white focus:border-emerald-500 text-emerald-600'}`} 
                                                        placeholder="0.00" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[11px] font-extrabold text-rose-600 mb-1.5 block uppercase tracking-wider">Promoção (R$)</label>
                                                    <input 
                                                        type="number" 
                                                        step="0.01" 
                                                        value={Number(v.precoPromocional) === 0 ? '' : v.precoPromocional} 
                                                        onChange={e => menuParams.atualizarVariacao(v.id, 'precoPromocional', e.target.value)} 
                                                        onFocus={e => e.target.select()}
                                                        className={`w-full px-4 py-3 border rounded-2xl text-lg font-black outline-none transition-all duration-300 ${isDark ? 'bg-rose-500/10 border-rose-500/20 focus:bg-slate-900 focus:border-rose-500 text-rose-400' : 'bg-rose-50/[0.03] border-rose-500/20 focus:bg-white focus:border-rose-500 text-rose-600'}`} 
                                                        placeholder="0.00" 
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5 mb-1.5 select-none cursor-pointer">
                                                        <input 
                                                            type="checkbox" 
                                                            id={`chk-cartao-${v.id}`}
                                                            checked={v.habilitarCartao !== false} 
                                                            onChange={e => menuParams.atualizarVariacao(v.id, 'habilitarCartao', e.target.checked)} 
                                                            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5 cursor-pointer" 
                                                        />
                                                        <label htmlFor={`chk-cartao-${v.id}`} className="text-[11px] font-extrabold text-sky-600 uppercase tracking-wider cursor-pointer truncate">Cartão (R$)</label>
                                                    </div>
                                                    <input 
                                                        type="number" 
                                                        step="0.01" 
                                                        disabled={v.habilitarCartao === false}
                                                        value={Number(v.precoCartao) === 0 ? '' : v.precoCartao} 
                                                        onChange={e => menuParams.atualizarVariacao(v.id, 'precoCartao', e.target.value)} 
                                                        onFocus={e => e.target.select()}
                                                        className={`w-full px-4 py-3 border rounded-2xl text-lg font-black outline-none transition-all duration-300 ${v.habilitarCartao === false ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-100 text-slate-400' : isDark ? 'bg-sky-500/10 border-sky-500/20 focus:bg-slate-900 focus:border-sky-500 text-sky-400' : 'bg-sky-50/[0.03] border-sky-500/20 focus:bg-white focus:border-sky-500 text-sky-600'}`} 
                                                        placeholder="0.00" 
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5 mb-1.5 select-none cursor-pointer">
                                                        <input 
                                                            type="checkbox" 
                                                            id={`chk-crediario-${v.id}`}
                                                            checked={v.habilitarCrediario !== false} 
                                                            onChange={e => menuParams.atualizarVariacao(v.id, 'habilitarCrediario', e.target.checked)} 
                                                            className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-3.5 h-3.5 cursor-pointer" 
                                                        />
                                                        <label htmlFor={`chk-crediario-${v.id}`} className="text-[11px] font-extrabold text-purple-600 uppercase tracking-wider cursor-pointer truncate">Crediário (R$)</label>
                                                    </div>
                                                    <input 
                                                        type="number" 
                                                        step="0.01" 
                                                        disabled={v.habilitarCrediario === false}
                                                        value={Number(v.precoCrediario) === 0 ? '' : v.precoCrediario} 
                                                        onChange={e => menuParams.atualizarVariacao(v.id, 'precoCrediario', e.target.value)} 
                                                        onFocus={e => e.target.select()}
                                                        className={`w-full px-4 py-3 border rounded-2xl text-lg font-black outline-none transition-all duration-300 ${v.habilitarCrediario === false ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-100 text-slate-400' : isDark ? 'bg-purple-500/10 border-purple-500/20 focus:bg-slate-900 focus:border-purple-500 text-purple-400' : 'bg-purple-50/[0.03] border-purple-500/20 focus:bg-white focus:border-purple-500 text-purple-600'}`} 
                                                        placeholder="0.00" 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {isModoMultiplasVariacoes && (
                                <button type="button" onClick={menuParams.adicionarVariacao} className={`w-full py-3.5 font-bold flex items-center justify-center gap-1.5 rounded-xl border border-dashed transition-all duration-300 ${isDark ? 'bg-[var(--color-primary)]/5 border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'bg-[var(--color-primary)]/[0.02] border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)]/[0.05] text-[var(--color-primary)]'}`}>
                                    <IoAddCircleOutline className="text-lg"/> <span>Adicionar Variação</span>
                                </button>
                            )}

                            {/* Venda Fracionada (Varejo / Petshop) */}
                            <div className={`border-t pt-5 mt-5 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                <div className={`flex items-center justify-between p-4 rounded-2xl border ${isDark ? 'bg-slate-900/20 border-slate-800/80' : 'bg-slate-50/50 border-slate-105'}`}>
                                    <div>
                                        <h4 className={`text-sm font-bold uppercase tracking-wider ${t.text}`}>Venda Fracionada (Peso / Granel)</h4>
                                        <p className={`text-xs mt-0.5 ${t.textSecondary}`}>Ative para permitir vendas decimais por quilo/litro com valores customizados.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer select-none">
                                        <input type="checkbox" name="fracionadoAtivo" checked={menuParams.formData.fracionadoAtivo || false} onChange={handleFormChange} className="sr-only peer" />
                                        <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 shadow-sm shadow-emerald-500/10"></div>
                                    </label>
                                </div>
                                {menuParams.formData.fracionadoAtivo && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-fade-in">
                                        <div>
                                            <label className={`block text-sm font-bold mb-2 uppercase tracking-wider ${t.textSecondary}`}>Preço do Kg/L no Varejo (R$)</label>
                                            <input 
                                                type="number" 
                                                step="0.01" 
                                                name="precoKgVarejo" 
                                                value={Number(menuParams.formData.precoKgVarejo) === 0 ? '' : menuParams.formData.precoKgVarejo} 
                                                onChange={handleFormChange} 
                                                onFocus={e => e.target.select()}
                                                className={`w-full px-4 py-3 border rounded-xl outline-none transition-all duration-300 font-bold text-base ${isDark ? 'bg-slate-955 border-slate-800 focus:bg-slate-900 focus:border-[var(--color-primary)] text-white' : 'bg-slate-50/50 border-slate-200/80 focus:bg-white focus:border-[var(--color-primary)] text-slate-800'}`} 
                                                placeholder="0.00" 
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Ficha Técnica (Insumos) */}
                        {tipoNegocio === 'restaurante' && menuParams.insumosDisponiveis.length > 0 && (
                        <div ref={sectionFichaRef} className={`p-6 md:p-8 rounded-3xl border space-y-6 shadow-sm transition-all duration-300 ${isDark ? 'bg-slate-900/40 border-slate-800/60' : 'bg-white border-slate-100/60'}`}>
                            <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4 ${isDark ? 'border-slate-800/60' : 'border-slate-50'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-50 text-purple-600'}`}><IoFlask size={18}/></div>
                                    <div>
                                        <h3 className={`text-base font-bold ${t.text}`}>Ficha Técnica</h3>
                                        <p className={`text-sm ${t.textSecondary}`}>Componentes consumidos de estoque a cada venda</p>
                                    </div>
                                </div>
                                {menuParams.formData.fichaTecnica.length > 0 && (
                                    <div className={`px-3 py-1.5 rounded-xl border ${isDark ? 'bg-purple-950/40 border-purple-900/50' : 'bg-purple-50/80 border-purple-100'}`}>
                                        <p className="text-xs font-bold text-purple-500 uppercase tracking-wider">Custo pela ficha</p>
                                        <p className="text-lg font-black text-purple-700">R$ {menuParams.custoFichaTecnica.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    </div>
                                )}
                            </div>

                            {/* Seletor de insumo */}
                            <div className={`flex items-end gap-3 p-4 rounded-2xl border ${isDark ? 'bg-purple-950/20 border-purple-900/30' : 'bg-purple-50/30 border-purple-100/45'}`}>
                                <div className="flex-1">
                                    <label className="text-sm font-bold text-purple-500 mb-1.5 block uppercase tracking-wider">Adicionar Insumo</label>
                                    <select
                                        id="seletor-insumo-ficha"
                                        defaultValue=""
                                        className={`w-full px-3 py-2.5 border rounded-xl text-base font-bold outline-none cursor-pointer ${isDark ? 'bg-slate-950 border-purple-900/50 text-purple-300 focus:ring-4 focus:ring-purple-500/10' : 'bg-white border-violet-200 text-violet-800 focus:ring-4 focus:ring-violet-500/10'}`}
                                    >
                                        <option value="" disabled>Selecione...</option>
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
                                    className={`p-3 rounded-xl transition-all shadow-md ${isDark ? 'bg-purple-750 hover:bg-purple-700 text-white shadow-purple-955/40' : 'bg-violet-600 hover:bg-violet-700 text-white shadow-violet-500/20 hover:shadow-lg'}`}
                                >
                                    <IoAddCircleOutline size={20} />
                                </button>
                            </div>

                            {/* Lista de insumos na ficha */}
                            {menuParams.formData.fichaTecnica.length > 0 ? (
                                <div className="space-y-2">
                                    {menuParams.formData.fichaTecnica.map((ficha) => (
                                        <div key={ficha.insumoId} className={`p-4 rounded-xl border relative group/ficha transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center gap-4 ${isDark ? 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-900/40' : 'bg-slate-50/30 border-slate-100 hover:bg-slate-50/80'}`}>
                                            <button type="button" onClick={() => menuParams.removerInsumoFicha(ficha.insumoId)}
                                                className="absolute -top-2 -right-2 bg-white dark:bg-slate-900 border border-red-100 dark:border-red-950 text-red-500 p-1.5 rounded-full shadow-sm opacity-0 group-hover/ficha:opacity-100 transition-opacity hover:bg-red-50 dark:hover:bg-red-900/50 z-10">
                                                <IoTrashOutline size={12}/>
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-bold text-base truncate ${t.text}`}>{ficha.nomeInsumo}</p>
                                                <p className={`text-sm ${t.textSecondary}`}>Custo Base: R$ {ficha.custoUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}/{ficha.unidade}</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div>
                                                    <label className={`text-sm font-bold mb-1 block uppercase tracking-wider ${t.textSecondary}`}>Consumo por venda</label>
                                                    <div className="flex items-center gap-1.5">
                                                        <input type="number" step="0.01" min="0" value={ficha.quantidade}
                                                            onChange={e => menuParams.atualizarQuantidadeFicha(ficha.insumoId, e.target.value)}
                                                            className={`w-20 px-2 py-1.5 border rounded-lg text-base font-bold outline-none text-center ${isDark ? 'bg-slate-955 border-purple-900/50 text-purple-400 focus:ring-2 focus:ring-purple-500/20' : 'bg-white border-violet-200 text-violet-800 focus:ring-2 focus:ring-violet-500/20'}`} />
                                                        <span className={`text-sm font-bold ${t.textSecondary}`}>{ficha.unidade}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className={`text-sm font-bold uppercase tracking-wider ${t.textSecondary}`}>Subtotal</p>
                                                    <p className={`text-base font-black ${t.text}`}>R$ {(ficha.quantidade * ficha.custoUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className={`text-center py-6 rounded-2xl border ${isDark ? 'bg-slate-955/40 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
                                    <IoFlask className="text-3xl text-slate-350 mx-auto mb-1.5" />
                                    <p className={`text-sm font-medium ${t.textSecondary}`}>Nenhum insumo vinculado a este produto.</p>
                                    <p className="text-sm text-slate-400">Estoque do produto será reduzido diretamente (1:1).</p>
                                </div>
                            )}
                        </div>
                        )}

                        {/* Fiscal NFC-e */}
                        <div ref={sectionFiscalRef} className={`p-6 md:p-8 rounded-3xl border space-y-6 shadow-sm transition-all duration-300 ${isDark ? 'bg-slate-900/40 border-slate-800/60' : 'bg-white border-slate-100/60'}`}>
                            <div className={`flex items-center gap-3 border-b pb-4 ${isDark ? 'border-slate-800/60' : 'border-slate-50'}`}>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-50 text-amber-600'}`}><IoBarcodeOutline size={18}/></div>
                                <div>
                                    <h3 className={`text-base font-bold ${t.text}`}>Fiscal (NFC-e / Trib.)</h3>
                                    <p className={`text-sm ${t.textSecondary}`}>Regras de faturamento e regras de impostos estaduais</p>
                                </div>
                            </div>
                            
                            <div className={`p-5 rounded-2xl border space-y-4 ${isDark ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20' : 'bg-[var(--color-primary)]/[0.03] border-[var(--color-primary)]/20'}`}>
                                <div className="mb-2">
                                    <label className={`block text-sm font-bold mb-2 uppercase tracking-wider ${isDark ? 'text-[var(--color-primary)]' : 'text-slate-800'}`}>Regras Fiscais por Departamento</label>
                                    <select 
                                        value={menuParams.formData.fiscal?.departamentoId || ''} 
                                        onChange={handleDepartamentoChange} 
                                        className={`w-full px-3 py-2.5 border rounded-xl outline-none font-bold text-base shadow-sm cursor-pointer ${isDark ? 'bg-slate-950 border-[var(--color-primary)]/30 text-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/10' : 'bg-white border-[var(--color-primary)]/20 text-slate-800 focus:ring-4 focus:ring-[var(--color-primary)]/10'}`}
                                    >
                                        <option value="" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>-- Usar Regras Manuais --</option>
                                        {menuParams.departamentosFiscais?.map(d => (
                                            <option key={d.id} value={d.id} className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>{d.nome} (CFOP: {d.cfop} / NCM: {d.ncm})</option>
                                        ))}
                                    </select>
                                    <p className={`text-sm font-medium mt-1.5 ml-0.5 ${isDark ? 'text-[var(--color-primary)]/70' : 'text-[var(--color-primary)]/70'}`}>Configuração fiscal automatizada baseada na categoria tributária.</p>
                                </div>
 
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="relative">
                                        <label className={`block text-sm font-bold mb-1.5 uppercase tracking-wider ${isDark ? 'text-[var(--color-primary)]' : 'text-slate-800'}`}>Código NCM <span className={`font-medium text-[var(--color-primary)]`}>(Busca inteligente)</span></label>
                                        <input type="text" name="ncm" value={menuParams.termoNcm} onChange={(e) => menuParams.buscarNcm(e.target.value, handleFiscalChange)} className={`w-full px-3 py-2.5 border rounded-xl outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10 text-base font-mono font-bold ${isDark ? 'bg-slate-955 border-[var(--color-primary)]/30 text-white' : 'bg-white border-[var(--color-primary)]/20 text-slate-800'} ${menuParams.formData.fiscal?.departamentoId ? 'opacity-50 bg-[var(--color-primary)]/[0.03]' : ''}`} autoComplete="off" placeholder="Ex: 22021000" disabled={!!menuParams.formData.fiscal?.departamentoId} />
                                        {menuParams.pesquisandoNcm && <span className="absolute right-3 top-[34px] text-xs text-[var(--color-primary)] animate-pulse font-bold">Buscando...</span>}
                                        {menuParams.ncmResultados.length > 0 && (
                                            <div className={`absolute z-50 w-full mt-2 border rounded-2xl shadow-xl max-h-48 overflow-y-auto ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-[var(--color-primary)]/20'}`}>
                                                {menuParams.ncmResultados.map((item) => (
                                                    <div key={item.codigo} onClick={() => { menuParams.setTermoNcm(item.codigo); handleFiscalChange({ target: { name: 'ncm', value: item.codigo } }); menuParams.setNcmResultados([]); }} className={`p-2.5 border-b cursor-pointer transition-colors text-left ${isDark ? 'border-slate-800 hover:bg-slate-900' : 'border-[var(--color-primary)]/[0.05] hover:bg-[var(--color-primary)]/[0.05]'}`}>
                                                        <p className={`font-bold text-sm ${isDark ? 'text-[var(--color-primary)]' : 'text-slate-800'}`}>{item.codigo}</p>
                                                        <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{item.descricao}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wider ${isDark ? 'text-[var(--color-primary)]' : 'text-slate-800'}`}>CFOP</label>
                                            <select disabled={!!menuParams.formData.fiscal?.departamentoId} name="cfop" value={menuParams.formData.fiscal?.cfop} onChange={handleFiscalChange} className={`w-full px-3 py-2.5 border rounded-xl focus:ring-4 focus:ring-[var(--color-primary)]/10 outline-none text-sm font-bold ${isDark ? 'bg-slate-950 border-[var(--color-primary)]/30 text-[var(--color-primary)]' : 'bg-white border-[var(--color-primary)]/20 text-slate-800'} ${menuParams.formData.fiscal?.departamentoId ? 'opacity-50 bg-[var(--color-primary)]/[0.03] cursor-not-allowed' : ''}`}>
                                                <option value="5102" className={isDark ? 'bg-slate-950' : ''}>5102</option>
                                                <option value="5405" className={isDark ? 'bg-slate-950' : ''}>5405</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={`block text-xs font-bold mb-1.5 uppercase tracking-wider ${isDark ? 'text-[var(--color-primary)]' : 'text-slate-800'}`}>Unidade</label>
                                            <select name="unidade" value={menuParams.formData.fiscal?.unidade} onChange={handleFiscalChange} className={`w-full px-3 py-2.5 border rounded-xl focus:ring-4 focus:ring-[var(--color-primary)]/10 outline-none text-sm font-bold ${isDark ? 'bg-slate-950 border-[var(--color-primary)]/30 text-[var(--color-primary)]' : 'bg-white border-[var(--color-primary)]/20 text-slate-800'}`}>
                                                <option value="UN" className={isDark ? 'bg-slate-950' : ''}>UN</option>
                                                <option value="KG" className={isDark ? 'bg-slate-950' : ''}>KG</option>
                                                <option value="LT" className={isDark ? 'bg-slate-950' : ''}>LT</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Foto e Canais */}
                        <div ref={sectionFotoRef} className="grid lg:grid-cols-2 gap-6">
                            
                            {/* Card da Foto */}
                            <div className={`p-6 rounded-3xl border space-y-4 shadow-sm transition-all duration-300 flex flex-col justify-between ${isDark ? 'bg-slate-900/40 border-slate-800/60' : 'bg-white border-slate-100/60'}`}>
                                <div className={`flex items-center gap-3 border-b pb-3 ${isDark ? 'border-slate-800/60' : 'border-slate-50'}`}>
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-50 text-rose-600'}`}><IoImageOutline size={16}/></div>
                                    <h4 className={`text-sm font-bold ${t.text}`}>Foto Ilustrativa</h4>
                                </div>
                                <div className="flex items-center gap-4 py-2">
                                    <div className={`w-20 h-20 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden shrink-0 group/upload relative shadow-inner ${isDark ? 'bg-slate-950 border-slate-800 text-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                        {menuParams.imagePreview ? <img src={menuParams.imagePreview} className="w-full h-full object-cover group-hover/upload:scale-105 transition-transform duration-500" /> : <IoImageOutline className="text-2xl text-slate-355"/>}
                                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover/upload:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                            <IoAddCircleOutline className="text-white text-2xl"/>
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <label className={`block text-xs font-bold mb-0.5 ${t.text}`}>Imagem do Produto</label>
                                        <p className="text-xs text-slate-400 mb-2">JPG/PNG. Fundo transparente recomendado.</p>
                                        <label className={`cursor-pointer inline-flex items-center justify-center px-4 py-2 font-bold text-xs rounded-lg transition-colors ${isDark ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20' : 'bg-[var(--color-primary)]/[0.05] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10'}`}>
                                            <span>Selecionar Arquivo</span>
                                            <input type="file" accept="image/*" onChange={handleFormChange} className="hidden" />
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Card Canais de Venda */}
                            <div className={`p-6 rounded-3xl border space-y-4 shadow-sm transition-all duration-300 ${isDark ? 'bg-slate-900/40 border-slate-800/60' : 'bg-white border-slate-100/60'}`}>
                                <div className={`flex items-center gap-3 border-b pb-3 ${isDark ? 'border-slate-800/60' : 'border-slate-50'}`}>
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-50 text-rose-600'}`}><IoList size={16}/></div>
                                    <h4 className={`text-sm font-bold ${t.text}`}>Canais de Exibição</h4>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <label className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-all duration-300 ${menuParams.formData.exibirDelivery !== false ? (isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-sm shadow-emerald-500/5' : 'bg-emerald-50 border-emerald-500/20 text-emerald-600 shadow-sm shadow-emerald-500/5') : (isDark ? 'bg-slate-950 border-slate-800 text-slate-500 hover:bg-slate-900/30' : 'bg-slate-50/50 border-slate-100 text-slate-400 hover:bg-slate-100/20')}`}>
                                        <input type="checkbox" name="exibirDelivery" checked={menuParams.formData.exibirDelivery !== false} onChange={handleFormChange} className="hidden" />
                                        <span className="text-xs font-black text-center">DELIVERY</span>
                                    </label>
                                    <label className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-all duration-300 ${menuParams.formData.exibirPdv !== false ? (isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-sm shadow-emerald-500/5' : 'bg-emerald-50 border-emerald-500/20 text-emerald-600 shadow-sm shadow-emerald-500/5') : (isDark ? 'bg-slate-950 border-slate-800 text-slate-500 hover:bg-slate-900/30' : 'bg-slate-50/50 border-slate-100 text-slate-400 hover:bg-slate-100/20')}`}>
                                        <input type="checkbox" name="exibirPdv" checked={menuParams.formData.exibirPdv !== false} onChange={handleFormChange} className="hidden" />
                                        <span className="text-xs font-black text-center">PDV / CAIXA</span>
                                    </label>
                                    <label className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-all duration-300 ${menuParams.formData.exibirSalao !== false ? (isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-sm shadow-emerald-500/5' : 'bg-emerald-50 border-emerald-500/20 text-emerald-600 shadow-sm shadow-emerald-500/5') : (isDark ? 'bg-slate-955 border-slate-800 text-slate-500 hover:bg-slate-900/30' : 'bg-slate-50/50 border-slate-100 text-slate-400 hover:bg-slate-100/20')}`}>
                                        <input type="checkbox" name="exibirSalao" checked={menuParams.formData.exibirSalao !== false} onChange={handleFormChange} className="hidden" />
                                        <span className="text-xs font-black text-center">{getTerminology('salao', tipoNegocio).toUpperCase()}</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Visibilidade do Produto Geral Card */}
                        <div className={`p-5 rounded-3xl border shadow-sm transition-all duration-300 ${isDark ? 'bg-slate-900/40 border-slate-800/60' : 'bg-white border-slate-100/60'}`}>
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${menuParams.formData.ativo ? (isDark ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'bg-[var(--color-primary)]/[0.05] text-[var(--color-primary)]') : (isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400')}`}>
                                        {menuParams.formData.ativo ? <IoCheckmarkCircle size={18}/> : <IoEyeOff size={18}/>}
                                    </div>
                                    <div className="text-left">
                                        <p className={`text-sm font-bold ${t.text}`}>
                                            {menuParams.formData.ativo ? `Item Ativo / Visível no ${getTerminology('cardapio', tipoNegocio)}` : 'Item Oculto / Pausado'}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {menuParams.formData.ativo ? 'Disponível para venda nos canais ativos.' : 'Bloqueado temporariamente para pedidos.'}
                                        </p>
                                    </div>
                                </div>
                                <label htmlFor="ativoMain" className="relative inline-flex items-center cursor-pointer select-none">
                                    <input type="checkbox" id="ativoMain" name="ativo" checked={menuParams.formData.ativo} onChange={handleFormChange} className="sr-only peer" />
                                    <div className={`w-11 h-6 rounded-full peer transition-all duration-300 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                                        menuParams.formData.ativo 
                                        ? 'bg-[var(--color-primary)] after:translate-x-full after:border-white' 
                                        : 'bg-slate-200 dark:bg-slate-800'
                                    }`}></div>
                                </label>
                            </div>
                        </div>
                    </div>
                  </div>
                </div>

                {/* Footer Bar */}
                <div className={`flex-none h-20 px-6 sm:px-10 border-t flex items-center justify-end gap-3 shadow-[0_-10px_40px_rgba(0,0,0,0.02)] z-20 ${t.modalFooter}`}>
                    {menuParams.editingItem && (
                        <button
                            type="button"
                            onClick={() => menuParams.handleDeleteItem(menuParams.editingItem)}
                            className={`mr-auto px-5 py-2.5 rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 border ${
                                isDark
                                  ? 'bg-red-950/40 text-red-400 border-red-900/50 hover:bg-red-900/70 hover:text-red-250'
                                  : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100 hover:text-red-700'
                            }`}
                        >
                            <IoTrashOutline size={16} /> Excluir Produto
                        </button>
                    )}
                    <button type="button" onClick={menuParams.closeItemForm} className={`hidden sm:block px-6 py-2.5 rounded-xl border font-bold transition-all text-xs ${t.buttonSecondary}`}>
                        Cancelar
                    </button>
                    <button type="submit" disabled={menuParams.formLoading} className={`w-full sm:w-auto px-8 py-2.5 rounded-xl font-bold transition-all duration-300 text-xs flex items-center justify-center gap-1.5 ${t.buttonPrimary} shadow-lg shadow-[var(--color-primary)]/25`}>
                        {menuParams.formLoading ? (
                            <><span className="animate-spin text-sm border-2 border-white/30 border-t-white rounded-full w-4 h-4"></span> Salvando...</>
                        ) : (
                            <><IoCheckmarkCircle size={18}/> Salvar Alterações</>
                        )}
                    </button>
                </div>
              </form>
            </div>
          </div>,
        document.body
    );
};

export default ProductModal;
