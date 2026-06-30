import React, { useState, useEffect, useRef } from 'react';
import { IoImageOutline, IoEyeOff, IoEllipsisVertical, IoCube, IoTrashOutline, IoBarcodeOutline } from 'react-icons/io5';
import { getTerminology } from '../../../utils/terminologyUtils';

export const ProductGridCard = ({ produto, onEdit, onDelete, onToggleStatus, onUpload3D, uploading3D, stockStatus, profitMargin, t, isDark, tipoNegocio }) => {
  const fileInput3DRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const clickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, [menuOpen]);

  const stockConfig = {
    normal: { ledColor: 'bg-emerald-500 shadow-emerald-500/50', bgClass: isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700', label: 'Estoque OK' },
    baixo: { ledColor: 'bg-amber-500 shadow-amber-500/50', bgClass: isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-100 text-amber-700', label: 'Estoque Baixo' },
    critico: { ledColor: 'bg-orange-500 shadow-orange-500/50', bgClass: isDark ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' : 'bg-orange-50 border-orange-100 text-orange-700', label: 'Crítico' },
    esgotado: { ledColor: 'bg-red-500 shadow-red-500/50', bgClass: isDark ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-red-50 border-red-100 text-red-700', label: 'Esgotado' }
  };
  const { ledColor, bgClass, label } = stockConfig[stockStatus] || stockConfig.normal;
  const getProfitColor = (margin) => margin >= 50 ? 'from-emerald-500 to-teal-500' : (margin >= 30 ? 'from-emerald-600 to-teal-600' : 'from-amber-500 to-orange-500');
  
  const mostrarPrecosVariacoes = () => {
    if (!produto.variacoes || produto.variacoes.length === 0) return <p className={`text-2xl font-black ${t.text}`}>R$ {(Number(produto.preco) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>;
    const variacoesAtivas = produto.variacoes.filter(v => v.ativo !== false && v.preco !== '' && !isNaN(Number(v.preco)) && Number(v.preco) > 0);
    if (variacoesAtivas.length === 0) return <p className="text-xl font-extrabold text-slate-400">--</p>;
    if (variacoesAtivas.length === 1) return <p className={`text-2xl font-black ${t.text}`}>R$ {Number(variacoesAtivas[0].preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>;
    const menorPreco = Math.min(...variacoesAtivas.map(v => Number(v.preco)));
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-1 mb-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse"></span>
          <span className="text-xs text-[var(--color-primary)] font-extrabold uppercase tracking-wider">A partir de</span>
        </div>
        <span className={`text-2xl font-black tracking-tight transition-colors ${t.text}`}>R$ {menorPreco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
      </div>
    );
  };

  const safeProfitMargin = (produto.preco && produto.custo) ? ((produto.preco - produto.custo) / produto.preco) * 100 : profitMargin;

  return (
    <div className={`group rounded-3xl border shadow-sm transition-all duration-500 flex flex-col h-full overflow-hidden relative ${t.cardBg} ${t.border} hover:border-[var(--color-primary)]/35 hover:shadow-[0_20px_50px_var(--color-primary-alpha)]`}>
      <div className={`relative h-44 overflow-hidden flex items-center justify-center p-4 border-b ${isDark ? 'bg-slate-900/20 border-slate-800/40' : 'bg-gradient-to-b from-slate-50/80 to-white border-slate-100'}`}>
        {produto.imageUrl ? (
          <img src={produto.imageUrl} alt={produto.nome} className={`max-h-full max-w-full object-contain transition-transform duration-500 ease-out group-hover:scale-105 ${isDark ? '' : 'mix-blend-multiply'}`}/>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-355 dark:text-slate-700"><IoImageOutline className="text-4xl drop-shadow-sm" /></div>
        )}
        
        {/* Status badges overlaid on image */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-20">
          {produto.ativo === false && (
            <span className="bg-slate-900/90 text-white text-sm font-bold px-2.5 py-1 rounded-lg backdrop-blur-md shadow-sm border border-slate-700/50 flex items-center gap-1.5">
              <IoEyeOff size={14} /> Oculto
            </span>
          )}
          <span className={`px-2.5 py-1 rounded-lg text-sm font-bold border flex items-center gap-1.5 shadow-sm backdrop-blur-md ${bgClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${ledColor} animate-pulse`}></span>
            {label}
          </span>
        </div>
        
        {safeProfitMargin > 0 && isFinite(safeProfitMargin) && (
          <div className={`absolute bottom-3 right-3 text-white px-2 py-0.5 rounded-md text-xs font-extrabold uppercase tracking-wider shadow-sm z-20 bg-gradient-to-r ${getProfitColor(safeProfitMargin)}`}>
            {safeProfitMargin.toFixed(0)}% Margem
          </div>
        )}

        {/* Three dots menu button absolute */}
        <button 
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className={`absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center border shadow-sm backdrop-blur-md transition-all duration-300 z-20 ${isDark ? 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'bg-white/80 border-slate-200/50 hover:bg-slate-50 text-slate-500 hover:text-slate-800'}`}
          title="Opções"
        >
          <IoEllipsisVertical size={14} />
        </button>

        {/* Dropdown options menu */}
        {menuOpen && (
          <div ref={menuRef} className={`absolute right-3 top-11 w-44 rounded-2xl shadow-xl border z-[99] py-1.5 transition-all animate-fade-in ${isDark ? 'bg-slate-955 border-slate-800/80 text-slate-100' : 'bg-white border-slate-200 text-slate-800'}`}>
            <button
              type="button"
              onClick={() => { setMenuOpen(false); fileInput3DRef.current?.click(); }}
              disabled={!!produto.modelo3dUrl || uploading3D}
              className={`w-full px-4 py-2 text-left text-base font-bold flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors ${produto.modelo3dUrl ? 'text-[var(--color-primary)] opacity-80 cursor-default' : 'hover:text-[var(--color-primary-hover)]'}`}
            >
              <IoCube size={16} />
              {produto.modelo3dUrl ? 'Modelo 3D Ativo' : uploading3D ? 'Enviando 3D...' : 'Upload Modelo 3D'}
            </button>
            <button
              type="button"
              onClick={() => { setMenuOpen(false); onToggleStatus(); }}
              className="w-full px-4 py-2 text-left text-base font-bold flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
            >
              <IoEyeOff size={16} />
              {produto.ativo !== false ? 'Pausar Vendas' : 'Reativar Vendas'}
            </button>
            <div className={`h-px my-1.5 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
            <button
              type="button"
              onClick={() => { setMenuOpen(false); onDelete(); }}
              className="w-full px-4 py-2 text-left text-base font-bold flex items-center gap-2 text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <IoTrashOutline size={16} />
              Excluir Produto
            </button>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 relative z-10">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${isDark ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20' : 'bg-[var(--color-primary)]/[0.05] text-[var(--color-primary)] border-[var(--color-primary)]/10'}`}>{produto.categoria}</span>
          {produto.codigoBarras && (
            <span className={`text-sm font-mono flex items-center gap-1 px-2 py-0.5 rounded-md border ${isDark ? 'text-slate-400 bg-slate-900/60 border-slate-800/60' : 'text-slate-400 bg-slate-50 border-slate-100'}`} title="Código de Barras">
              <IoBarcodeOutline size={14} /> {produto.codigoBarras}
            </span>
          )}
        </div>
        
        <h3 className={`font-bold text-lg leading-snug mt-2.5 mb-1 group-hover:text-[var(--color-primary)] transition-colors line-clamp-1 ${t.text}`} title={produto.nome}>
          {produto.nome}
        </h3>

        {/* Exhibition channels badges */}
        <div className="flex flex-wrap gap-1 mt-1">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${produto.exibirDelivery !== false ? (isDark ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20' : 'bg-[var(--color-primary)]/[0.05] text-[var(--color-primary)] border-[var(--color-primary)]/10') : (isDark ? 'bg-slate-900/10 text-slate-500 border-slate-800/40' : 'bg-slate-50 text-slate-400 border-slate-100')}`} title="Delivery">
            <span className={`w-1 h-1 rounded-full ${produto.exibirDelivery !== false ? 'bg-[var(--color-primary)]' : 'bg-slate-300 dark:bg-slate-700'}`}></span>
            Delivery
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${produto.exibirPdv !== false ? (isDark ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20' : 'bg-[var(--color-primary)]/[0.05] text-[var(--color-primary)] border-[var(--color-primary)]/10') : (isDark ? 'bg-slate-900/10 text-slate-500 border-slate-800/40' : 'bg-slate-50 text-slate-400 border-slate-100')}`} title="Frente de Caixa">
            <span className={`w-1 h-1 rounded-full ${produto.exibirPdv !== false ? 'bg-[var(--color-primary)]' : 'bg-slate-300 dark:bg-slate-700'}`}></span>
            PDV
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${produto.exibirSalao !== false ? (isDark ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20' : 'bg-[var(--color-primary)]/[0.05] text-[var(--color-primary)] border-[var(--color-primary)]/10') : (isDark ? 'bg-slate-900/10 text-slate-500 border-slate-800/40' : 'bg-slate-50 text-slate-400 border-slate-100')}`} title={`${getTerminology('salao', tipoNegocio)} / ${getTerminology('mesas', tipoNegocio)}`}>
            <span className={`w-1 h-1 rounded-full ${produto.exibirSalao !== false ? 'bg-[var(--color-primary)]' : 'bg-slate-300 dark:bg-slate-700'}`}></span>
            {getTerminology('mesas', tipoNegocio)}
          </span>
        </div>
        
        {produto.descricao ? (
          <p className={`${t.textSecondary} text-sm font-medium line-clamp-2 mt-2.5 mb-3 min-h-[1.75rem] leading-relaxed`}>{produto.descricao}</p>
        ) : (
          <div className="mt-2.5 mb-3 min-h-[1.75rem]"></div>
        )}

        <div className="mt-auto border-t border-slate-100 dark:border-slate-800/50 pt-3">
          <div className={`flex justify-between items-center rounded-xl p-2.5 border mb-3 ${isDark ? 'bg-slate-955/40 border-slate-800' : 'bg-slate-50/60 border-slate-100/80'}`}>
            <div>{mostrarPrecosVariacoes()}</div>
            <div className="text-right">
              <p className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${t.textMuted}`}>Estoque</p>
              <p className={`text-lg font-black ${Number(produto.estoque) <= 0 ? 'text-red-500' : t.text}`}>{produto.estoque}</p>
            </div>
          </div>

          <input ref={fileInput3DRef} type="file" accept=".glb,.gltf" className="hidden" 
            onChange={(e) => { const f = e.target.files?.[0]; if(f) onUpload3D(produto, f); e.target.value = ''; }} />
          <button 
            type="button"
            onClick={onEdit} 
            className={`w-full py-2.5 rounded-xl text-base font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 ${t.buttonPrimary}`}
          >
            Editar Produto
          </button>
        </div>
      </div>
    </div>
  );
};
