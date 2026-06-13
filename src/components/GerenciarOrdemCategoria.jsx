// src/components/GerenciarOrdemCategoria.jsx
import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";

const GerenciarOrdemCategoria = ({ 
  estabelecimentoId, 
  categorias, 
  ordemAtual, 
  onClose, 
  onSave,
  onDelete,
  t,
  isDark,
  nomeEstabelecimento
}) => {
  const [items, setItems] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setItems([]);
    let novosItens = [];

    if (!estabelecimentoId) return;

    if (ordemAtual && ordemAtual.length > 0) {
      novosItens = ordemAtual.map((categoria, index) => ({
        id: `cat-${index}-${estabelecimentoId}-${categoria}`, 
        name: categoria
      }));
    } else if (categorias && categorias.length > 0) {
      const categoriasOrdenadas = [...categorias].sort((a, b) => a.localeCompare(b));
      
      novosItens = categoriasOrdenadas.map((categoria, index) => ({
        id: `cat-${index}-${estabelecimentoId}-${categoria}`,
        name: categoria
      }));
    }

    setItems(novosItens);

  }, [categorias, ordemAtual, estabelecimentoId]); 

  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', index);
    setIsDragging(true);
    e.target.classList.add('dragging');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.target.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.target.classList.remove('drag-over');
  };

  const handleDrop = (e, newIndex) => {
    e.preventDefault();
    e.target.classList.remove('drag-over');
    
    const oldIndex = parseInt(e.dataTransfer.getData('text/plain'));
    
    if (oldIndex !== newIndex && oldIndex >= 0 && oldIndex < items.length) {
      const newItems = [...items];
      const [movedItem] = newItems.splice(oldIndex, 1);
      newItems.splice(newIndex, 0, movedItem);
      setItems(newItems);
    }
    
    setIsDragging(false);
  };

  const handleDragEnd = (e) => {
    setIsDragging(false);
    document.querySelectorAll('.dragging').forEach(el => {
      el.classList.remove('dragging');
    });
    document.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
  };

  const handleSave = async () => {
    try {
      const novaOrdem = items.map(item => item.name);
      
      if (onSave) {
        await onSave(novaOrdem, estabelecimentoId);
      } else {
        toast.success('Ordem das categorias salva com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao salvar ordem:', error);
      toast.error('Erro ao salvar ordem das categorias');
    }
  };

  const handleReset = () => {
    if (!categorias || !estabelecimentoId) return;
    
    const ordemOriginal = categorias.map((categoria, index) => ({
       id: `cat-${index}-${estabelecimentoId}-${categoria}`,
       name: categoria
    }));
    setItems(ordemOriginal.sort((a, b) => a.name.localeCompare(b.name)));
  };

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className={`text-base font-medium mb-4 ${t.textSecondary}`}>
          {categorias && categorias.length > 0 
            ? "Carregando categorias..." 
            : "Nenhuma categoria encontrada no cardápio."}
        </p>
        <button
          onClick={onClose}
          className={`px-5 py-2.5 rounded-xl border font-bold text-sm transition-all ${t.buttonSecondary}`}
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Coluna Esquerda: Ordenação */}
      <div className="lg:col-span-7 space-y-6">
        {/* Instruções */}
        <div className={`backdrop-blur-sm border rounded-2xl p-4 flex items-center gap-3 ${isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-100 text-amber-850'}`}>
          <span className="text-xl shrink-0">💡</span>
          <p className="text-sm font-medium">
            <strong>Como ordenar:</strong> Arraste e solte as categorias para definir a ordem de exibição no cardápio do seu Delivery.
          </p>
        </div>

        {/* Lista de categorias */}
        <div className={`border rounded-[1.8rem] p-5 max-h-[55vh] overflow-y-auto custom-scrollbar shadow-inner ${isDark ? 'bg-slate-950/20 border-slate-800/80' : 'bg-slate-50/30 border-slate-200/50'}`}>
          {items.map((item, index) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`
                flex items-center justify-between p-4 rounded-2xl border transition-all duration-305 select-none cursor-grab active:cursor-grabbing mb-3
                ${isDragging ? 'opacity-40 scale-[0.98]' : 'hover:scale-[1.01] hover:shadow-md'} 
                ${isDark 
                  ? 'bg-slate-900/40 border-slate-800 hover:border-[var(--color-primary)]/30 text-slate-100 hover:bg-slate-900/60' 
                  : 'bg-white border-slate-200/60 hover:border-[var(--color-primary)]/20 text-slate-800 hover:bg-slate-50/50'
                }
              `}
            >
              <div className="flex items-center space-x-4">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl text-base font-extrabold shadow-sm border bg-[var(--color-primary)]/[0.08] text-[var(--color-primary)] border-[var(--color-primary)]/15">
                  {index + 1}
                </div>
                <span className={`font-bold text-base md:text-lg ${t.text}`}>{item.name}</span>
              </div>
              <div className="flex items-center space-x-1">
                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item.name);
                    }}
                    className={`p-2.5 rounded-xl transition-all duration-200 ${
                      isDark 
                        ? 'text-rose-455 hover:bg-rose-500/10 hover:text-rose-350' 
                        : 'text-rose-500 hover:bg-rose-50 hover:text-rose-600'
                    }`}
                    title="Excluir Categoria"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
                <div className={`cursor-grab active:cursor-grabbing p-2.5 transition-colors ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-650'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 9h.01M12 9h.01M16 9h.01M8 15h.01M12 15h.01M16 15h.01" /></svg>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Botões de Ação */}
        <div className={`flex w-full gap-3 justify-end pt-5 border-t ${isDark ? 'border-slate-800/80' : 'border-slate-200/60'}`}>
          <button
            type="button"
            onClick={handleReset}
            className={`px-5 py-2.5 rounded-xl border font-bold text-sm transition-all ${t.buttonSecondary}`}
          >
            Resetar Ordem
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`px-5 py-2.5 rounded-xl border font-bold text-sm transition-all ${t.buttonSecondary}`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-1.5 ${t.buttonPrimary}`}
          >
            Salvar Ordem
          </button>
        </div>

        {/* Preview Simplificado */}
        <div className={`mt-4 pt-4 border-t ${isDark ? 'border-slate-800/80' : 'border-slate-200/60'}`}>
          <p className={`text-xs font-bold mb-3 uppercase tracking-wider ${t.textMuted}`}>Visualização rápida da sequência:</p>
          <div className="flex flex-wrap gap-2">
            {items.map((item, index) => (
              <span 
                key={`preview-${item.id}`} 
                className={`inline-flex items-center px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm ${
                  isDark 
                    ? 'bg-slate-900/60 border-slate-800 text-slate-300' 
                    : 'bg-white border-slate-100 text-slate-650'
                }`}
              >
                <span className="font-black text-[var(--color-primary)] mr-1.5">{index + 1}.</span> {item.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Coluna Direita: Live Mockup do Celular */}
      <div className="lg:col-span-5 hidden lg:flex flex-col items-center justify-start sticky top-8">
        <p className={`text-xs font-bold mb-3.5 uppercase tracking-wider ${t.textMuted}`}>Preview no Celular do Cliente:</p>
        
        {/* Phone Case */}
        <div className={`w-[290px] h-[550px] rounded-[3rem] border-[10px] shadow-2xl relative overflow-hidden flex flex-col transition-all duration-500 ${
          isDark 
            ? 'border-slate-800 bg-slate-950 shadow-slate-950/60' 
            : 'border-slate-800 bg-slate-50 shadow-slate-200/40'
        }`}>
          {/* Notch / Speaker */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-28 h-5 bg-slate-800 rounded-b-xl z-50 flex items-center justify-center">
            <span className="w-10 h-0.5 bg-slate-700 rounded-full"></span>
          </div>

          {/* Screen Content */}
          <div className="flex-1 flex flex-col overflow-hidden pt-5">
            
            {/* Mock Store Header */}
            <div className={`p-3.5 border-b flex items-center gap-2 shrink-0 ${isDark ? 'bg-slate-900/40 border-slate-800/60' : 'bg-white border-slate-100'}`}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center font-black text-[10px] text-white bg-[var(--color-primary)] shadow-sm shrink-0">
                {nomeEstabelecimento ? nomeEstabelecimento.substring(0, 2).toUpperCase() : 'MF'}
              </div>
              <div className="min-w-0">
                <p className={`text-[11px] font-black truncate leading-tight ${t.text}`}>{nomeEstabelecimento || 'IdeaFood Burger'}</p>
                <p className="text-[9px] text-emerald-500 font-bold flex items-center gap-0.5 leading-none mt-0.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span> Aberto
                </p>
              </div>
            </div>

            {/* Live Navigation Menu Bar */}
            <div className={`py-2 px-3 border-b flex gap-1.5 overflow-x-auto hide-scrollbar shrink-0 ${isDark ? 'bg-slate-900/20 border-slate-800/30' : 'bg-white border-slate-100'}`}>
              {items.map((item, index) => {
                const isActive = index === 0;
                return (
                  <span 
                    key={`phone-cat-${item.id}`}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold whitespace-nowrap transition-all duration-300 ${
                      isActive 
                        ? 'bg-[var(--color-primary)] text-white shadow-sm' 
                        : (isDark ? 'bg-slate-900 text-slate-400 border border-slate-800/50' : 'bg-slate-100 text-slate-500 border border-slate-200/30')
                    }`}
                  >
                    {item.name}
                  </span>
                );
              })}
            </div>

            {/* Scrollable products list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
              {items.map((item, catIdx) => (
                <div key={`phone-sec-${item.id}`} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className={`text-[10px] font-black uppercase tracking-wider ${t.text}`}>{item.name}</h4>
                    <span className="text-[8px] font-bold text-slate-450 uppercase">Ver tudo</span>
                  </div>
                  
                  {/* First Mock Product */}
                  <div className={`p-2 rounded-xl border flex gap-2 ${isDark ? 'bg-slate-900/30 border-slate-850' : 'bg-white border-slate-100 shadow-sm'}`}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-slate-850' : 'bg-slate-100'}`}>
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[9px] font-black truncate ${t.text}`}>Item Exemplo {item.name}</p>
                      <p className="text-[8px] text-slate-400 line-clamp-1 mt-0.5">Descrição demonstrativa rápida do produto...</p>
                      <p className="text-[10px] font-black text-[var(--color-primary)] mt-0.5">R$ 24,90</p>
                    </div>
                  </div>

                  {/* Second Mock Product */}
                  <div className={`p-2 rounded-xl border flex gap-2 ${isDark ? 'bg-slate-900/30 border-slate-850' : 'bg-white border-slate-100 shadow-sm'}`}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-slate-850' : 'bg-slate-100'}`}>
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[9px] font-black truncate ${t.text}`}>Opção {catIdx + 1} - Hamburguer</p>
                      <p className="text-[8px] text-slate-400 line-clamp-1 mt-0.5">Ingredientes frescos de alta qualidade...</p>
                      <p className="text-[10px] font-black text-[var(--color-primary)] mt-0.5">R$ 19,90</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* Home Button Indicator */}
          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-20 h-0.5 bg-slate-500 rounded-full z-50"></div>
        </div>
      </div>
    </div>
  );
};

export default GerenciarOrdemCategoria;