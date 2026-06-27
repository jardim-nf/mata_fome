// src/pages/AdminMenuManagement.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useHeader } from '../context/HeaderContext';
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { usePagination } from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import { useAdminMenuData } from '../hooks/useAdminMenuData';
import { useEstablishment } from '../hooks/useEstablishment';
import {
    IoAddCircleOutline, IoSearch, IoClose, IoImageOutline, IoCheckmarkCircle,
    IoAlertCircle, IoCube, IoCash, IoPricetag, IoList, IoEyeOff, IoGrid, IoMenu, IoBarcodeOutline,
    IoFlask, IoTrashOutline, IoChevronUp, IoChevronDown, IoDownloadOutline, IoEllipsisVertical
} from 'react-icons/io5';
import { FiSun, FiMoon } from 'react-icons/fi';
import { toast } from 'react-toastify';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import BackButton from '../components/BackButton';
import { createPortal } from 'react-dom';
import { getTerminology } from '../utils/terminologyUtils';
import StockAlertWidget from '../components/StockAlertWidget';

// Skeleton Loader (Full-width)
const SkeletonLoader = ({ isDark }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6 w-full">
    {[...Array(12)].map((_, i) => (
      <div key={i} className={`rounded-3xl border p-5 animate-pulse ${isDark ? 'bg-slate-900/40 border-slate-800/80' : 'bg-white border-slate-100 shadow-sm'}`}>
        <div className={`w-full h-40 rounded-2xl mb-4 ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'}`}></div>
        <div className={`h-6 rounded-lg w-3/4 mb-3 ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'}`}></div>
        <div className={`h-4 rounded-lg w-1/2 ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'}`}></div>
      </div>
    ))}
  </div>
);

// Product Grid Card
const ProductGridCard = ({ produto, onEdit, onDelete, onToggleStatus, onUpload3D, uploading3D, stockStatus, profitMargin, t, isDark, tipoNegocio }) => {
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
    return (      <div className="flex flex-col">
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

const StatsCard = ({ title, value, icon: Icon, colorClass, bgClass, isDark, t, onClick, active, pulseRed }) => {
  const colorKey = colorClass.includes('emerald') ? 'emerald' :
                   colorClass.includes('amber') ? 'amber' :
                   colorClass.includes('red') ? 'red' : 'primary';

  const activeBg = colorKey === 'emerald' ? 'bg-emerald-500/10 dark:bg-emerald-500/20' :
                   colorKey === 'amber' ? 'bg-amber-500/10 dark:bg-amber-500/20' :
                   colorKey === 'red' ? 'bg-red-500/10 dark:bg-red-500/20' :
                   'bg-[var(--color-primary)]/10 dark:bg-[var(--color-primary)]/20';

  const activeBorder = colorKey === 'emerald' ? 'border-emerald-500/60' :
                       colorKey === 'amber' ? 'border-amber-500/60' :
                       colorKey === 'red' ? 'border-red-500/60' :
                       'border-[var(--color-primary)]/60';

  const activeShadow = colorKey === 'emerald' ? 'shadow-[0_4px_20px_rgba(16,185,129,0.15)]' :
                       colorKey === 'amber' ? 'shadow-[0_4px_20px_rgba(245,158,11,0.15)]' :
                       colorKey === 'red' ? 'shadow-[0_4px_20px_rgba(239,68,68,0.15)]' :
                       'shadow-[0_4px_20px_rgba(16,185,129,0.15)]';

  return (
    <div 
      onClick={onClick}
      className={`group rounded-[2rem] p-5 border flex items-center justify-between transition-all duration-300 relative overflow-hidden select-none ${
        onClick ? 'cursor-pointer active:scale-95' : ''
      } ${
        pulseRed
          ? 'animate-pulse-red scale-[1.02] -translate-y-1'
          : active 
            ? `${activeBg} ${activeBorder} ${activeShadow} scale-[1.02] -translate-y-1` 
            : `${t.cardBg} ${t.border} hover:border-[var(--color-primary)]/20 hover:-translate-y-1`
      }`}
    >
      <style>{`
        @keyframes pulseRed {
          0%, 100% {
            border-color: rgba(239, 68, 68, 0.4);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.2);
            background-color: ${isDark ? 'rgba(30, 20, 20, 0.6)' : 'rgba(254, 242, 242, 0.8)'};
          }
          50% {
            border-color: rgba(239, 68, 68, 1);
            box-shadow: 0 0 15px 5px rgba(239, 68, 68, 0.35);
            background-color: ${isDark ? 'rgba(60, 20, 20, 0.8)' : 'rgba(254, 226, 226, 1)'};
          }
        }
        .animate-pulse-red {
          animation: pulseRed 1.8s infinite ease-in-out;
        }
      `}</style>
      <div className={`absolute -right-4 -bottom-4 w-28 h-28 rounded-full blur-2xl opacity-10 group-hover:scale-150 transition-transform duration-700 bg-[var(--color-primary)]/10`}></div>
      
      {/* Dynamic left accent border */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-r-full ${
        colorKey === 'red' ? 'bg-red-500' :
        colorKey === 'amber' ? 'bg-amber-500' :
        colorKey === 'emerald' ? 'bg-emerald-500' :
        'bg-[var(--color-primary)]'
      }`} />

      <div className="relative z-10 pl-2">
        <p className={`text-xs font-extrabold uppercase tracking-widest mb-1.5 ${t.textMuted}`}>{title}</p>
        <p className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>{value}</p>
      </div>
      <div className={`relative z-10 w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-colors duration-300 ${
        active
          ? colorKey === 'emerald' ? 'bg-emerald-500 text-white' :
            colorKey === 'amber' ? 'bg-amber-500 text-white' :
            colorKey === 'red' ? 'bg-red-500 text-white' :
            'bg-[var(--color-primary)] text-white'
          : isDark 
            ? 'bg-slate-900 text-[var(--color-primary)] border border-slate-800' 
            : 'bg-[var(--color-primary)]/[0.08] text-[var(--color-primary)] border border-[var(--color-primary)]/10'
      }`}>
        <Icon className="text-xl" />
      </div>
    </div>
  );
};

function AdminMenuManagement() {
  const { userData , estabelecimentoIdPrincipal } = useAuth();
  const { setActions, clearActions } = useHeader();
  const primeiroEstabelecimento = estabelecimentoIdPrincipal || userData?.estabelecimentoId || (userData?.estabelecimentosGerenciados && userData.estabelecimentosGerenciados[0]);
  const menuParams = useAdminMenuData(primeiroEstabelecimento);
  const { coresEstabelecimento, estabelecimentoInfo } = useEstablishment(primeiroEstabelecimento);
  const tipoNegocio = estabelecimentoInfo?.tipoNegocio || 'restaurante';
  const cores = coresEstabelecimento || { primaria: '#EA1D2C', destaque: '#059669', background: '#FFFFFF' };
  const primaryColor = cores.primaria || '#EA1D2C';
  const primaryColorHover = cores.destaque || '#d31825';

  const [viewMode, setViewMode] = useState('grid');
  
  // Theme logic
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('dashboard_theme');
    return saved || 'light';
  });

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('dashboard_theme', newTheme);
  };

  const themeClasses = {
    dark: {
      bg: 'bg-gradient-to-br from-slate-950 via-[#0d1220] to-slate-950 text-slate-100',
      surface: 'bg-slate-900/60 backdrop-blur-xl',
      border: 'border-slate-800/80',
      borderLight: 'border-slate-800/40',
      cardBg: 'bg-slate-900/40 backdrop-blur-xl',
      text: 'text-slate-100',
      textSecondary: 'text-slate-400',
      textMuted: 'text-slate-500',
      inputBg: 'bg-slate-950/60',
      accent: 'bg-[var(--color-primary)]',
      buttonPrimary: 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white transition-all shadow-md shadow-[var(--color-primary)]/20',
      buttonSecondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700',
      tabActive: 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/25 border border-[var(--color-primary)]/20',
      tabInactive: 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50',
      listHover: 'hover:bg-slate-800/30 hover:shadow-lg hover:border-slate-700',
      modalBg: 'bg-slate-950 border-slate-800/80',
      inputBorder: 'border-slate-800/80 focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20',
      modalHeader: 'bg-slate-900/80 border-slate-800',
      modalBody: 'bg-slate-950/30',
      modalFooter: 'bg-slate-900/90 border-slate-800',
    },
    light: {
      bg: 'bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#f8fafc] text-slate-800',
      surface: 'bg-white/80 backdrop-blur-md',
      border: 'border-slate-200/60',
      borderLight: 'border-slate-100/40',
      cardBg: 'bg-white/70 backdrop-blur-md',
      text: 'text-slate-800',
      textSecondary: 'text-slate-600',
      textMuted: 'text-slate-400',
      inputBg: 'bg-slate-100/50',
      accent: 'bg-[var(--color-primary)]',
      buttonPrimary: 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white transition-all shadow-md shadow-[var(--color-primary)]/20',
      buttonSecondary: 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200',
      tabActive: 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary)]/25 border border-[var(--color-primary)]/20',
      tabInactive: 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50',
      listHover: 'hover:bg-white hover:shadow-lg',
      modalBg: 'bg-[#f8fafc] border-slate-200/60',
      inputBorder: 'border-slate-200/50 focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20',
      modalHeader: 'bg-white border-slate-100',
      modalBody: 'bg-slate-50/30',
      modalFooter: 'bg-white border-slate-200/80',
    }
  };

  const t = themeClasses[theme];
  const isDark = theme === 'dark';

  // Inject CSS properties globally to allow Header components to render dynamically using brand colors
  useEffect(() => {
    const root = document.documentElement;
    
    // Check if the color is too dark for dark mode
    const isColorDark = (hex) => {
      if (!hex || typeof hex !== 'string') return true;
      const cleaned = hex.replace('#', '');
      if (cleaned.length !== 3 && cleaned.length !== 6) return true;
      let r, g, b;
      if (cleaned.length === 3) {
        r = parseInt(cleaned[0] + cleaned[0], 16);
        g = parseInt(cleaned[1] + cleaned[1], 16);
        b = parseInt(cleaned[2] + cleaned[2], 16);
      } else {
        r = parseInt(cleaned.substring(0, 2), 16);
        g = parseInt(cleaned.substring(2, 4), 16);
        b = parseInt(cleaned.substring(4, 6), 16);
      }
      const hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
      return hsp < 120;
    };

    let adjustedPrimary = primaryColor;
    let adjustedHover = primaryColorHover;

    if (isDark && isColorDark(primaryColor)) {
      // Fallback to a readable bright brand color in dark mode (defaulting to the red fallback '#EA1D2C')
      adjustedPrimary = '#EA1D2C';
      adjustedHover = '#d31825';
    }

    const adjustedAlpha = adjustedPrimary.startsWith('#') ? `${adjustedPrimary}20` : 'rgba(234, 29, 44, 0.2)';

    root.style.setProperty('--color-primary', adjustedPrimary);
    root.style.setProperty('--color-primary-hover', adjustedHover);
    root.style.setProperty('--color-primary-alpha', adjustedAlpha);
  }, [primaryColor, primaryColorHover, isDark]);

  const [activeModalTab, setActiveModalTab] = useState('gerais');
  const sectionGeraisRef = useRef(null);
  const sectionPrecosRef = useRef(null);
  const sectionFichaRef = useRef(null);
  const sectionFiscalRef = useRef(null);
  const sectionFotoRef = useRef(null);

  const scrollToSection = (ref, tabId) => {
    setActiveModalTab(tabId);
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleFormScroll = (e) => {
    const container = e.target;
    const scrollPosition = container.scrollTop + 120;

    const targets = [
      { id: 'gerais', ref: sectionGeraisRef },
      { id: 'precos', ref: sectionPrecosRef },
      ...(tipoNegocio === 'restaurante' && menuParams.insumosDisponiveis.length > 0 ? [{ id: 'ficha', ref: sectionFichaRef }] : []),
      { id: 'fiscal', ref: sectionFiscalRef },
      { id: 'exibicao', ref: sectionFotoRef }
    ];

    for (let i = targets.length - 1; i >= 0; i--) {
      const target = targets[i];
      if (target.ref.current) {
        const elementOffset = target.ref.current.offsetTop - container.offsetTop;
        if (scrollPosition >= elementOffset) {
          setActiveModalTab(target.id);
          break;
        }
      }
    }
  };

  const ITEMS_PER_PAGE = viewMode === 'grid' ? 18 : 12;
  const { currentPage, totalPages, paginatedItems, goToPage } = usePagination(menuParams.filteredAndSortedItems, ITEMS_PER_PAGE);

  useEffect(() => { goToPage(1); }, [menuParams.searchTerm, menuParams.selectedCategory, menuParams.stockFilter, goToPage]);

  const handleExportProducts = useCallback(() => {
    if (!menuParams.menuItems || menuParams.menuItems.length === 0) {
        toast.warn("Sem produtos para exportar.");
        return;
    }
    const headers = ['Categoria', 'Nome do Produto', 'Variacao', 'Preco', 'Custo', 'Estoque', 'Status'];
    const rows = [];
    const getStatusText = (itemAtivo, varAtivo, estoque) => {
        if (itemAtivo === false || varAtivo === false) return 'Pausado';
        if (Number(estoque) <= 0) return 'Esgotado';
        return 'Ativo';
    };

    menuParams.menuItems.forEach(item => {
        if (item.variacoes && item.variacoes.length > 0) {
            item.variacoes.forEach(v => {
                rows.push([
                    item.categoria || '',
                    item.nome || '',
                    v.nome === 'Padrão' ? '-' : (v.nome || ''),
                    Number(v.preco || 0).toFixed(2).replace('.', ','),
                    Number(v.custo || 0).toFixed(2).replace('.', ','),
                    v.estoque || 0,
                    getStatusText(item.ativo, v.ativo, v.estoque)
                ]);
            });
        } else {
             rows.push([
                item.categoria || '',
                item.nome || '',
                '-',
                Number(item.preco || 0).toFixed(2).replace('.', ','),
                Number(item.custo || 0).toFixed(2).replace('.', ','),
                item.estoque || 0,
                getStatusText(item.ativo, item.ativo, item.estoque)
            ]);
        }
    });

    const csvContent = [headers, ...rows].map(e => e.join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_produtos_cadastrados.csv`;
    link.click();
  }, [menuParams.menuItems]);

  const handleExportPDF = useCallback(() => {
    if (!menuParams.menuItems || menuParams.menuItems.length === 0) {
        toast.warn("Sem produtos para exportar.");
        return;
    }

    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text("Relatorio de Produtos Cadastrados", 14, 15);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} as ${new Date().toLocaleTimeString('pt-BR')}`, 14, 22);

    const tableColumn = ["Categoria", "Produto", "Variacao", "Preco", "Custo", "Estoque", "Status"];
    const tableRows = [];

    const getStatusText = (itemAtivo, varAtivo, estoque) => {
        if (itemAtivo === false || varAtivo === false) return 'Pausado';
        if (Number(estoque) <= 0) return 'Esgotado';
        return 'Ativo';
    };

    menuParams.menuItems.forEach(item => {
        if (item.variacoes && item.variacoes.length > 0) {
            item.variacoes.forEach(v => {
                tableRows.push([
                    item.categoria || '',
                    item.nome || '',
                    v.nome === 'Padrão' ? '-' : (v.nome || ''),
                    `R$ ${Number(v.preco || 0).toFixed(2).replace('.', ',')}`,
                    `R$ ${Number(v.custo || 0).toFixed(2).replace('.', ',')}`,
                    v.estoque || 0,
                    getStatusText(item.ativo, v.ativo, v.estoque)
                ]);
            });
        } else {
             tableRows.push([
                item.categoria || '',
                item.nome || '',
                '-',
                `R$ ${Number(item.preco || 0).toFixed(2).replace('.', ',')}`,
                `R$ ${Number(item.custo || 0).toFixed(2).replace('.', ',')}`,
                item.estoque || 0,
                getStatusText(item.ativo, item.ativo, item.estoque)
            ]);
        }
    });

    autoTable(doc, {
        startY: 26,
        head: [tableColumn],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] },
        styles: { fontSize: 8 },
    });

    doc.save(`relatorio_produtos_cadastrados.pdf`);
  }, [menuParams.menuItems]);

  useEffect(() => {
    if (menuParams.showItemForm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [menuParams.showItemForm]);

  useEffect(() => {
    const actions = (
      <div className="flex items-center gap-2 md:gap-3">
        <div className="hidden sm:flex bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-1 shadow-sm">
          <button 
            onClick={handleExportProducts} 
            className="flex items-center gap-1.5 hover:bg-[var(--color-primary)]/[0.05] text-[var(--color-primary)] font-bold py-2 px-3 rounded-lg text-sm transition-all" 
            title="Exportar CSV"
          >
            <IoDownloadOutline className="text-lg"/> <span className="hidden lg:inline">CSV</span>
          </button>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 self-center mx-1"></div>
          <button 
            onClick={handleExportPDF} 
            className="flex items-center gap-1.5 hover:bg-[var(--color-primary)]/[0.05] text-[var(--color-primary)] font-bold py-2 px-3 rounded-lg text-sm transition-all" 
            title="Exportar PDF"
          >
            <IoDownloadOutline className="text-lg"/> <span className="hidden lg:inline">PDF</span>
          </button>
        </div>
        <div className="hidden md:flex bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-1 shadow-sm">
          <button 
            onClick={() => setViewMode('grid')} 
            className={`p-2.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[var(--color-primary)]/[0.08] text-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            <IoGrid size={18}/>
          </button>
          <button 
            onClick={() => setViewMode('list')} 
            className={`p-2.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-[var(--color-primary)]/[0.08] text-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            <IoMenu size={18}/>
          </button>
        </div>
        <button 
          onClick={() => menuParams.openItemForm()} 
          className="flex items-center gap-1.5 md:gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold py-2.5 px-4 md:px-5 rounded-xl shadow-md shadow-[var(--color-primary-alpha)] text-sm md:text-base transition-all transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <IoAddCircleOutline className="text-base md:text-lg"/> <span>Adicionar Produto</span>
        </button>
      </div>
    );
    setActions(actions);
    return () => clearActions();
  }, [viewMode, setActions, clearActions, menuParams.openItemForm, handleExportProducts, handleExportPDF, primaryColor]);

  const handleFormChange = (e) => {
    let { name, value, type, checked, files } = e.target;
    if (type === 'file') {
        if (files[0]) { menuParams.setItemImage(files[0]); menuParams.setImagePreview(URL.createObjectURL(files[0])); }
    } else {
        if (typeof value === 'string' && (name === 'nome' || name === 'descricao')) {
            value = value.toUpperCase();
        }
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

  if (menuParams.loading) return <div className="p-6 md:p-8 w-full"><div className="mb-6 h-8 w-48 bg-slate-200 rounded-lg animate-pulse"></div><SkeletonLoader isDark={isDark} /></div>;

  const isModoMultiplasVariacoes = menuParams.variacoes.length > 1 || (menuParams.variacoes.length === 1 && menuParams.variacoes[0]?.nome !== 'Padrão');

  return (
    <div className={`min-h-screen p-4 md:p-8 font-sans pb-32 relative overflow-hidden transition-colors duration-500 w-full ${t.bg}`}>
      {/* Glow blobs premium */}
      <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-gradient-to-tr ${isDark ? 'from-emerald-500/10 to-teal-500/5 blur-[120px]' : 'from-emerald-300/10 to-teal-300/10 blur-[120px]'} pointer-events-none`}></div>
      <div className={`absolute bottom-[20%] right-[-10%] w-[35%] h-[35%] rounded-full bg-gradient-to-br ${isDark ? 'from-teal-500/10 to-emerald-500/5 blur-[100px]' : 'from-teal-300/10 to-emerald-300/10 blur-[100px]'} pointer-events-none`}></div>

      <div className="w-full relative z-10">
        <div className="mb-6 flex justify-between items-center">
          <BackButton to="/dashboard" />
          <button
            onClick={toggleTheme}
            className={`p-2.5 rounded-xl border transition-all ${t.buttonSecondary}`}
            title="Alternar Tema"
          >
            {isDark ? <FiSun size={15} /> : <FiMoon size={15} />}
          </button>
        </div>
        
        {/* Stats Grid (6 standard cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <StatsCard title="Total Itens" value={menuParams.stockStatistics.totalItems} icon={IoList} colorClass="text-[var(--color-primary)]" bgClass="bg-[var(--color-primary)]/10" isDark={isDark} t={t} onClick={() => menuParams.setStockFilter('todos')} active={menuParams.stockFilter === 'todos'} />
            <StatsCard title="Ativos" value={menuParams.stockStatistics.activeItems} icon={IoCheckmarkCircle} colorClass="text-emerald-500" bgClass="bg-emerald-50" isDark={isDark} t={t} onClick={() => menuParams.setStockFilter('ativos')} active={menuParams.stockFilter === 'ativos'} />
            <StatsCard title="Pausados" value={menuParams.stockStatistics.inactiveItems} icon={IoEyeOff} colorClass="text-red-500" bgClass="bg-red-50" isDark={isDark} t={t} onClick={() => menuParams.setStockFilter('inativos')} active={menuParams.stockFilter === 'inativos'} pulseRed={menuParams.stockStatistics.inactiveItems > 0} />
            <StatsCard title="Crítico" value={menuParams.stockStatistics.criticalStock} icon={IoAlertCircle} colorClass="text-amber-500" bgClass="bg-amber-50" isDark={isDark} t={t} onClick={() => menuParams.setStockFilter('critico')} active={menuParams.stockFilter === 'critico'} />
            <StatsCard title="Esgotados" value={menuParams.stockStatistics.outOfStock} icon={IoClose} colorClass="text-red-500" bgClass="bg-red-50" isDark={isDark} t={t} onClick={() => menuParams.setStockFilter('esgotado')} active={menuParams.stockFilter === 'esgotado'} />
            <StatsCard title="Valor Estoque" value={`R$ ${menuParams.stockStatistics.totalInventoryValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon={IoCash} colorClass="text-[var(--color-primary)]" bgClass="bg-[var(--color-primary)]/10" isDark={isDark} t={t} pulseRed={menuParams.stockStatistics.inactiveItems > 0} />
        </div>

        <StockAlertWidget estabelecimentoId={primeiroEstabelecimento} isDark={isDark} />
               {/* Search and Main Filters Row */}
        <div className={`backdrop-blur-md rounded-3xl shadow-sm border p-4 mb-4 flex flex-col md:flex-row gap-3 md:items-center ${t.surface} ${t.border}`}>
            <div className="relative flex-1">
                <IoSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 text-lg" />
                <input type="text" placeholder="Buscar por produto, código ou material..." value={menuParams.searchTerm} onChange={e => menuParams.setSearchTerm(e.target.value)} 
                     className={`w-full pl-11 pr-5 py-3 border focus:ring-4 focus:ring-[var(--color-primary)]/5 focus:border-[var(--color-primary)] rounded-2xl transition-all outline-none font-medium text-base shadow-inner ${isDark ? 'bg-slate-950 border-slate-800/80 focus:bg-slate-900 focus:text-white placeholder-slate-500 text-white' : 'bg-slate-50/50 hover:bg-slate-50 border-slate-100 text-slate-700 placeholder-slate-450'}`} />
            </div>
            <div className="flex gap-2.5 shrink-0 flex-wrap md:flex-nowrap">
                <select 
                    value={menuParams.selectedCategory} 
                    onChange={e => menuParams.setSelectedCategory(e.target.value)} 
                    className={`px-5 py-3 border focus:ring-4 focus:ring-[var(--color-primary)]/5 rounded-2xl text-sm font-bold outline-none cursor-pointer transition-all shadow-sm min-w-[180px] appearance-none ${
                        isDark ? 'bg-slate-950 border-slate-800/80 hover:bg-slate-900 text-slate-300' : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-600'
                    }`} 
                    style={{
                        backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(primaryColor)}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, 
                        backgroundRepeat: 'no-repeat', 
                        backgroundPosition: 'right 1.2rem center', 
                        backgroundSize: '1.2em'
                    }}
                >
                    <option value="Todos" className={isDark ? 'bg-slate-950 text-slate-300' : 'bg-white text-slate-700'}>📁 Grupo: Todos os Grupos</option>
                    {[...new Set(menuParams.categories.map(c => c.nome))].sort((a, b) => a.localeCompare(b)).map(cat => (
                        <option key={cat} value={cat} className={isDark ? 'bg-slate-950 text-slate-300' : 'bg-white text-slate-700'}>📁 {cat}</option>
                    ))}
                </select>

                <select value={menuParams.stockFilter} onChange={e => menuParams.setStockFilter(e.target.value)} className={`px-5 py-3 border focus:ring-4 focus:ring-[var(--color-primary)]/5 rounded-2xl text-sm font-bold outline-none cursor-pointer transition-all shadow-sm min-w-[180px] appearance-none ${isDark ? 'bg-slate-950 border-slate-800/80 hover:bg-slate-900 text-slate-300' : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-600'}`} style={{backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(primaryColor)}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.2rem center', backgroundSize: '1.2em'}} >
                    <option value="todos" className={isDark ? 'bg-slate-950 text-slate-300' : 'bg-white text-slate-700'}>Filtro: Todos os Itens</option>
                    <option value="ativos" className={isDark ? 'bg-slate-950 text-slate-300' : 'bg-white text-slate-700'}>🟢 Itens Ativos</option>
                    <option value="critico" className={isDark ? 'bg-slate-950 text-slate-300' : 'bg-white text-slate-700'}>⚠️ Estoque Crítico</option>
                    <option value="esgotado" className={isDark ? 'bg-slate-950 text-slate-300' : 'bg-white text-slate-700'}>🚫 Esgotados</option>
                    <option value="normal" className={isDark ? 'bg-slate-950 text-slate-300' : 'bg-white text-slate-700'}>✅ Estoque Normal</option>
                    <option value="sem_ncm" className={isDark ? 'bg-slate-950 text-slate-300' : 'bg-white text-slate-700'}>📄 Sem NCM (Fiscal)</option>
                    <option value="zerado" className={isDark ? 'bg-slate-950 text-slate-300' : 'bg-white text-slate-700'}>💲 Preço Zerado</option>
                    <option value="inativos" className={isDark ? 'bg-slate-950 text-slate-300' : 'bg-white text-slate-700'}>⏸️ Pausados/Ocultos</option>
                    <option value="sem_foto" className={isDark ? 'bg-slate-950 text-slate-300' : 'bg-white text-slate-700'}>📸 Sem Foto</option>
                </select>
            </div>
        </div>

        {/* Categories Tab Deck */}
        <div className={`backdrop-blur-sm rounded-2xl border p-2 mb-8 flex gap-2 overflow-x-auto hide-scrollbar ${t.surface} ${t.border}`}>
            {['Todos', ...new Set(menuParams.categories.map(c => c.nome))].map(cat => {
                const isSelected = menuParams.selectedCategory === cat;
                return (
                    <button
                        key={cat}
                        type="button"
                        onClick={() => menuParams.setSelectedCategory(cat)}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-300 ${
                            isSelected
                                ? 'bg-[var(--color-primary)] text-white shadow-md shadow-[var(--color-primary-alpha)]'
                                : `${isDark ? 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border-slate-800/50 hover:border-slate-700' : 'bg-white text-slate-500 hover:text-slate-800 border border-slate-100 hover:border-slate-200 shadow-sm'}`
                        }`}
                    >
                        {cat}
                    </button>
                );
            })}
        </div>

        <div className="min-h-[400px] w-full">
            {paginatedItems.length > 0 ? (
                <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 w-full" : "space-y-3.5 w-full"}>
                    {paginatedItems.map(item => (
                        viewMode === 'grid' ? (
                            <ProductGridCard key={item.id} produto={item} onEdit={() => menuParams.openItemForm(item)} onDelete={() => menuParams.handleDeleteItem(item)}
                                onToggleStatus={() => menuParams.toggleItemStatus(item)} onUpload3D={menuParams.handleUpload3D} uploading3D={menuParams.uploading3DItemId === item.id}
                                stockStatus={item.estoque <= 0 ? 'esgotado' : (item.estoque <= item.estoqueMinimo ? 'critico' : 'normal')}
                                profitMargin={((item.preco - item.custo) / item.preco) * 100} t={t} isDark={isDark} tipoNegocio={tipoNegocio} />
                        ) : (
                            <div key={item.id} className={`group p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-4 w-full ${t.cardBg} ${t.border} ${t.listHover}`}>
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={`w-14 h-14 rounded-xl border overflow-hidden flex items-center justify-center p-1.5 relative shrink-0 ${isDark ? 'bg-slate-900/60 border-slate-800/80' : 'bg-slate-50 border-slate-100'}`}>
                                        {item.imageUrl ? <img src={item.imageUrl} className={`max-h-full max-w-full object-contain transition-transform duration-305 group-hover:scale-105 ${isDark ? '' : 'mix-blend-multiply'}`}/> : <IoImageOutline className="text-slate-350 dark:text-slate-600 text-xl"/>}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className={`text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${isDark ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20' : 'bg-[var(--color-primary)]/[0.05] text-[var(--color-primary)] border-[var(--color-primary)]/10'}`}>{item.categoria}</span>
                                            {item.ativo !== false ? <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse"></span> : <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${isDark ? 'bg-slate-800 text-slate-400 border border-slate-800' : 'bg-slate-100 text-slate-400'}`}>Oculto</span>}
                                        </div>
                                        <h3 className={`font-bold text-lg group-hover:text-[var(--color-primary)] transition-colors truncate mb-1 pr-2 ${t.text}`} title={item.nome}>{item.nome}</h3>
                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${item.exibirDelivery !== false ? (isDark ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20' : 'bg-[var(--color-primary)]/[0.05] text-[var(--color-primary)] border-[var(--color-primary)]/10') : (isDark ? 'bg-slate-900/10 text-slate-500 border-slate-800/40' : 'bg-slate-50 text-slate-400 border-slate-100')}`}>
                                                <span className={`w-0.5 h-0.5 rounded-full ${item.exibirDelivery !== false ? 'bg-[var(--color-primary)]' : 'bg-slate-300 dark:bg-slate-700'}`}></span>
                                                Delivery
                                            </span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${item.exibirPdv !== false ? (isDark ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20' : 'bg-[var(--color-primary)]/[0.05] text-[var(--color-primary)] border-[var(--color-primary)]/10') : (isDark ? 'bg-slate-900/10 text-slate-500 border-slate-800/40' : 'bg-slate-50 text-slate-400 border-slate-100')}`}>
                                                <span className={`w-0.5 h-0.5 rounded-full ${item.exibirPdv !== false ? 'bg-[var(--color-primary)]' : 'bg-slate-300 dark:bg-slate-700'}`}></span>
                                                PDV
                                            </span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${item.exibirSalao !== false ? (isDark ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20' : 'bg-[var(--color-primary)]/[0.05] text-[var(--color-primary)] border-[var(--color-primary)]/10') : (isDark ? 'bg-slate-900/10 text-slate-500 border-slate-800/40' : 'bg-slate-50 text-slate-400 border-slate-100')}`} title={`${getTerminology('salao', tipoNegocio)} / ${getTerminology('mesas', tipoNegocio)}`}>
                                                <span className={`w-0.5 h-0.5 rounded-full ${item.exibirSalao !== false ? 'bg-[var(--color-primary)]' : 'bg-slate-300 dark:bg-slate-700'}`}></span>
                                                {getTerminology('mesas', tipoNegocio)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                                    <div className="text-right hidden sm:block">
                                        <p className={`font-black text-lg ${t.text}`}>R$ {Number(item.preco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        <p className={`text-xs font-bold uppercase tracking-wider mt-0.5 ${t.textMuted}`}>Estoque: <span className={item.estoque <= 0 ? 'text-red-500 font-bold' : t.text}>{item.estoque}</span></p>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <button onClick={() => menuParams.openItemForm(item)} className={`p-2.5 rounded-xl transition-all shadow-sm border ${isDark ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/20 hover:bg-[var(--color-primary-hover)] hover:text-white' : 'bg-[var(--color-primary)]/[0.05] text-[var(--color-primary)] border-[var(--color-primary)]/10 hover:bg-[var(--color-primary-hover)] hover:text-white'}`} title="Editar Produto">
                                            <IoPricetag size={16}/>
                                        </button>
                                        <button onClick={() => menuParams.handleDeleteItem(item)} className={`p-2.5 rounded-xl transition-all shadow-sm border ${isDark ? 'bg-red-900/40 text-red-400 border-red-900/50 hover:bg-red-650 hover:text-white' : 'bg-red-50 text-red-500 border-red-100/30 hover:bg-red-600 hover:text-white'}`} title="Excluir Produto">
                                            <IoTrashOutline size={16}/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    ))}
                </div>
            ) : (
                <div className={`flex flex-col items-center justify-center py-24 rounded-[2.5rem] border-2 border-dashed shadow-sm relative overflow-hidden w-full ${isDark ? 'bg-slate-900/20 border-slate-800/80' : 'bg-white border-slate-200'}`}>
                    <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none"></div>
                    <div className="relative z-10 flex flex-col items-center">
                        <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-inner ${isDark ? 'bg-slate-950 text-slate-700' : 'bg-slate-50 text-slate-300'}`}>
                            <IoCube className="text-5xl" />
                        </div>
                        <h3 className={`text-2xl font-black mb-2 ${t.text}`}>Puxa, nenhum item encontrado</h3>
                        <p className={`text-center max-w-sm text-xs font-medium ${t.textSecondary}`}>Tente buscar por outro termo ou ajuste os filtros acima para encontrar o que precisa.</p>
                    </div>
                </div>
            )}
        </div>

        {paginatedItems.length > 0 && <div className="mt-8 w-full"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} /></div>}

        {menuParams.showItemForm && createPortal(
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
        )}

      </div>
    </div>
  );
}

export default withEstablishmentAuth(AdminMenuManagement);