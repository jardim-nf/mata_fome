// src/pages/AdminMenuManagement.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useHeader } from '../context/HeaderContext';
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { usePagination } from '../hooks/usePagination';
import Pagination from '../components/Pagination';
import ProductModal from '../components/admin/menu/ProductModal.jsx';
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
import { ProductGridCard } from '../components/admin/menu/ProductGridCard';
import { StatsCard } from '../components/admin/menu/StatsCard';

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

        {menuParams.showItemForm && (
          <ProductModal
            menuParams={menuParams}
            t={t}
            isDark={isDark}
            tipoNegocio={tipoNegocio}
            activeModalTab={activeModalTab}
            handleFormScroll={handleFormScroll}
            scrollToSection={scrollToSection}
            sectionGeraisRef={sectionGeraisRef}
            sectionPrecosRef={sectionPrecosRef}
            sectionFichaRef={sectionFichaRef}
            sectionFiscalRef={sectionFiscalRef}
            sectionFotoRef={sectionFotoRef}
            handleFormChange={handleFormChange}
            isModoMultiplasVariacoes={isModoMultiplasVariacoes}
            getTerminology={getTerminology}
          />
        )}

      </div>
    </div>
  );
}

export default withEstablishmentAuth(AdminMenuManagement);