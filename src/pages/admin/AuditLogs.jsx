// src/pages/admin/AuditLogs.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, orderBy, where, getDocs, limit, startAfter, endBefore, limitToLast } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  FaStore, 
  FaSearch, 
  FaFilter, 
  FaHistory, 
  FaChevronDown, 
  FaChevronUp, 
  FaUserShield, 
  FaCube, 
  FaEdit, 
  FaTrash, 
  FaPlus,
  FaArrowRight,
  FaArrowLeft,
  FaExclamationTriangle,
  FaCode,
  FaFileCsv,
  FaCalendarAlt,
  FaExternalLinkAlt,
  FaShieldAlt,
  FaBolt
} from 'react-icons/fa';
import { IoLogOutOutline } from 'react-icons/io5';

const ITEMS_PER_PAGE = 20;

// --- Visualizador de Detalhes JSON ---
const DetailViewer = ({ data }) => {
    if (!data) return <span className="text-[#86868B] text-xs italic font-medium">Nenhum detalhe técnico registrado.</span>;
    let parsedData = data;
    if (typeof data === 'string') {
        try { parsedData = JSON.parse(data); } catch (e) { console.error(e); }
    }
    if (typeof parsedData === 'object' && Object.keys(parsedData).length === 0) {
        return <span className="text-[#86868B] text-xs italic font-medium">Detalhes vazios.</span>;
    }
    return (
        <div className="bg-[#1D1D1F] rounded-2xl p-5 text-sm font-mono text-emerald-400 overflow-x-auto shadow-inner border border-black/20">
            {Object.entries(parsedData).map(([key, value]) => (
                <div key={key} className="mb-1.5 last:mb-0">
                    <span className="text-blue-300 font-bold">{key}:</span>{' '}
                    <span className="text-gray-300 break-all whitespace-pre-wrap">
                        {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </span>
                </div>
            ))}
        </div>
    );
};

// --- Linha de Log Inteligente ---
const LogItem = ({ log }) => {
    const [expanded, setExpanded] = useState(false);

    const getTargetLink = () => {
        if (!log.target?.id) return null;
        switch(log.target.type) {
            case 'estabelecimento': return `/master/estabelecimentos/${log.target.id}/editar`;
            case 'usuario': return `/master/usuarios/${log.target.id}/editar`;
            case 'pedido': return `/master/pedidos/${log.target.id}`;
            default: return null;
        }
    };

    const targetLink = getTargetLink();

    const getIconAndColor = (type) => {
        const t = (type || '').toUpperCase();
        if (t.includes('CRIADO') || t.includes('ADICIONADO') || t.includes('ATIVADO') || t.includes('IMPORTADO')) 
            return { icon: <FaPlus />, color: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-100' };
        if (t.includes('ATUALIZADO') || t.includes('EDITADO')) 
            return { icon: <FaEdit />, color: 'bg-blue-50 text-blue-600', border: 'border-blue-100' };
        if (t.includes('DELETADO') || t.includes('REMOVIDO') || t.includes('DESATIVADO')) 
            return { icon: <FaTrash />, color: 'bg-red-50 text-red-600', border: 'border-red-100' };
        return { icon: <FaHistory />, color: 'bg-[#F5F5F7] text-[#86868B]', border: 'border-[#E5E5EA]' };
    };

    const style = getIconAndColor(log.actionType);

    return (
        <div className={`border-[1px] border-b-0 border-[#E5E5EA] last:border-b transition-colors ${expanded ? 'bg-[#F5F5F7]' : 'bg-white hover:bg-[#F5F5F7]/50'}`}>
            <div className="flex items-center justify-between p-5 transition-all group">
                
                {/* Clique Principal para Expandir */}
                <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                    <div className={`w-12 h-12 rounded-[1rem] flex items-center justify-center ${style.color} border ${style.border} shrink-0 shadow-sm transition-transform group-hover:scale-105`}>
                        {style.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-base font-black text-[#1D1D1F] tracking-tight truncate" title={log.actionType}>
                            {log.actionType?.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs font-semibold text-[#86868B] flex items-center gap-2 mt-1">
                            <FaUserShield className="text-[#86868B]" size={10} /> 
                            <span className="truncate">{log.actor?.email || 'Sistema / Desconhecido'}</span>
                        </p>
                    </div>
                </div>

                {/* Metadata e Link Rápido */}
                <div className="flex items-center gap-5 ml-4">
                    <div className="flex flex-col items-end gap-1.5">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#86868B] bg-[#F5F5F7] border border-[#E5E5EA] px-2.5 py-1 rounded-md shadow-sm">
                                {log.target?.type || 'Geral'}
                            </span>
                            {targetLink && (
                                <Link 
                                    to={targetLink}
                                    className="text-[#86868B] hover:text-[#1D1D1F] transition-colors p-1"
                                    title={`Ir para ${log.target.type}`}
                                >
                                    <FaExternalLinkAlt size={12} />
                                </Link>
                            )}
                        </div>
                        <span className="text-xs text-[#86868B] font-bold">
                            {log.timestamp ? format(log.timestamp.toDate(), "dd/MM HH:mm", { locale: ptBR }) : '--/--'}
                        </span>
                    </div>
                    
                    <button onClick={() => setExpanded(!expanded)} className="w-8 h-8 rounded-full bg-white border border-[#E5E5EA] flex items-center justify-center text-[#86868B] hover:text-[#1D1D1F] hover:border-[#1D1D1F] transition-colors shadow-sm">
                        {expanded ? <FaChevronUp size={10} /> : <FaChevronDown size={10} />}
                    </button>
                </div>
            </div>

            {/* Detalhes Expandidos */}
            {expanded && (
                <div className="p-6 pl-[5.5rem] border-t border-[#E5E5EA] animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="space-y-2">
                            <p className="text-[10px] uppercase font-black tracking-widest text-[#86868B]">ID do Alvo</p>
                            <p className="text-sm font-mono bg-white p-3 border border-[#E5E5EA] rounded-xl select-all text-[#1D1D1F] shadow-sm">
                                {log.target?.id || 'N/A'}
                            </p>
                        </div>
                        {log.target?.name && (
                            <div className="space-y-2">
                                <p className="text-[10px] uppercase font-black tracking-widest text-[#86868B]">Nome do Alvo</p>
                                <p className="text-base font-bold text-[#1D1D1F] bg-white p-3 border border-[#E5E5EA] rounded-xl shadow-sm">{log.target.name}</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <FaCode className="text-[#86868B] text-xs" />
                            <p className="text-[10px] uppercase font-black tracking-widest text-[#86868B]">Payload Técnico</p>
                        </div>
                        <DetailViewer data={log.details} />
                    </div>
                </div>
            )}
        </div>
    );
};

function AuditLogs() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();

  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [error, setError] = useState('');
  const [indexLink, setIndexLink] = useState(null);

  // Filtros
  const [filterType, setFilterType] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Paginação
  const [lastVisible, setLastVisible] = useState(null);
  const [firstVisible, setFirstVisible] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isMasterAdmin) {
        navigate('/master-dashboard');
      }
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  const fetchLogs = useCallback(async (direction = 'initial') => {
    if (!isMasterAdmin) return;
    setLoadingLogs(true);
    setError('');
    setIndexLink(null);

    try {
        let q = collection(db, 'auditLogs');
        let constraints = [orderBy('timestamp', 'desc')];

        if (dateStart) constraints.push(where('timestamp', '>=', startOfDay(parseISO(dateStart))));
        if (dateEnd) constraints.push(where('timestamp', '<=', endOfDay(parseISO(dateEnd))));

        if (filterType !== 'todos') {
            constraints.push(where('actionType', '==', filterType));
        }

        if (direction === 'next' && lastVisible) {
            constraints.push(startAfter(lastVisible));
        } else if (direction === 'prev' && firstVisible) {
            if (page <= 2) direction = 'initial'; 
        }

        if (direction === 'initial') {
             constraints.push(limit(ITEMS_PER_PAGE));
        } else {
             constraints.push(limit(ITEMS_PER_PAGE));
        }

        const finalQuery = query(q, ...constraints);
        const snapshot = await getDocs(finalQuery);

        if (!snapshot.empty) {
            setFirstVisible(snapshot.docs[0]);
            setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
            setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        } else {
            if (direction === 'initial') setLogs([]);
        }

    } catch (err) {
        console.error("Erro Query:", err);
        if (err.code === 'failed-precondition' && err.message.includes('index')) {
            const match = err.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
            if (match) {
                setIndexLink(match[0]);
                setError("Índice necessário. O Firebase exige criar um índice para combinar Data + Tipo.");
            }
        } else {
            setError("Erro ao carregar logs. Verifique sua conexão.");
        }
    } finally {
        setLoadingLogs(false);
    }
  }, [isMasterAdmin, filterType, dateStart, dateEnd, lastVisible, page]);

  useEffect(() => {
    setPage(1);
    setLastVisible(null);
    setFirstVisible(null);
    fetchLogs('initial');
  }, [filterType, dateStart, dateEnd, isMasterAdmin]); 

  const handleNext = () => { setPage(p => p + 1); fetchLogs('next'); };
  const handlePrev = () => { if (page > 1) { setPage(p => p - 1); if (page === 2) fetchLogs('initial'); } };

  const handleExportCSV = () => {
    if (logs.length === 0) return toast.warn("Sem dados para exportar.");
    
    const headers = ["ID", "Data", "Hora", "Ação", "Ator", "Alvo Tipo", "Alvo ID", "Alvo Nome"];
    const rows = logs.map(log => {
        const date = log.timestamp ? log.timestamp.toDate() : new Date();
        return [
            log.id,
            format(date, "dd/MM/yyyy"),
            format(date, "HH:mm:ss"),
            log.actionType,
            log.actor?.email || "Sistema",
            log.target?.type || "N/A",
            log.target?.id || "N/A",
            `"${log.target?.name || ''}"` 
        ];
    });

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `auditoria_export_${format(new Date(), "yyyyMMdd_HHmm")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Relatório CSV gerado com sucesso!");
  };

  const displayedLogs = logs.filter(log => {
      const term = searchTerm.toLowerCase();
      return !term || 
             (log.actor?.email && log.actor.email.toLowerCase().includes(term)) ||
             (log.target?.id && log.target.id.toLowerCase().includes(term)) ||
             (log.target?.name && log.target.name.toLowerCase().includes(term));
  });

  if (authLoading) return <div className="flex h-screen items-center justify-center bg-[#F5F5F7]"><FaBolt className="text-[#86868B] text-4xl animate-pulse" /></div>;

  return (
    <div className="bg-[#F5F5F7] min-h-screen pt-4 pb-24 px-4 sm:px-8 font-sans text-[#1D1D1F]">
      
      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className="max-w-[1400px] mx-auto bg-white/70 backdrop-blur-xl border border-white/50 shadow-sm rounded-full h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/master-dashboard')} className="w-9 h-9 bg-[#F5F5F7] hover:bg-[#E5E5EA] rounded-full flex items-center justify-center transition-colors">
            <FaArrowLeft className="text-[#86868B] text-sm" />
          </button>
          <div className="hidden sm:block border-l border-[#E5E5EA] pl-4">
            <h1 className="font-semibold text-sm tracking-tight text-black">Terminal de Auditoria</h1>
            <p className="text-[11px] text-[#86868B] font-medium">{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-px h-6 bg-[#E5E5EA] hidden sm:block" />
          <button onClick={async () => { await logout(); navigate('/'); }} className="w-9 h-9 bg-red-50 hover:bg-red-100 rounded-full flex items-center justify-center transition-colors">
            <IoLogOutOutline className="text-red-500" size={16} />
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto mt-12 pb-12">
        {/* Header da Página */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4 px-2">
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <span className="bg-[#1D1D1F] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full inline-flex items-center gap-2"><FaShieldAlt className="text-yellow-400" /> Watchdog Server</span>
                </div>
                <h1 className="text-4xl font-bold tracking-tight text-[#1D1D1F]">Logs de Auditoria</h1>
                <p className="text-[#86868B] text-sm mt-2 font-medium">Rastreamento profundo e histórico de modificações críticas no ecossistema.</p>
            </div>
            
            <button 
                onClick={handleExportCSV}
                className="flex items-center gap-2 bg-[#1D1D1F] text-white px-6 py-4 rounded-full hover:bg-black transition-all shadow-sm font-bold text-sm hover:scale-[1.02] active:scale-95"
            >
                <FaFileCsv size={16} /> Gravar Extrato CSV
            </button>
        </div>

        {/* --- AVISO CRÍTICO DE ÍNDICE --- */}
        {indexLink && (
            <div className="mb-8 p-6 bg-red-50 border border-red-100 rounded-[2rem] flex items-start gap-5 shadow-sm">
                <div className="bg-red-100 w-12 h-12 rounded-[1rem] flex items-center justify-center text-red-500 shrink-0">
                    <FaExclamationTriangle size={18} />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-red-800 text-lg mb-1 tracking-tight">Requirement de Build (Índice Firestore)</h3>
                    <p className="text-sm text-red-700 font-medium mb-4 leading-relaxed">
                        Para combinar a navegação dimensional de <strong>Data</strong> cruzada com o <strong>Tipo de Ação</strong>, a arquitetura do Firebase exige a criação de um Composite Index.
                    </p>
                    <a 
                        href={indexLink} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-2 bg-red-600 text-white px-5 py-3 rounded-xl text-xs font-bold hover:bg-red-700 transition-colors shadow-sm"
                    >
                        🛠️ Construir Índice no Console
                    </a>
                </div>
            </div>
        )}

        {/* Barra de Filtros (Bento Style) */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-[#E5E5EA] p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Data Inicio */}
                <div>
                    <label className="block text-[10px] font-black tracking-widest text-[#86868B] uppercase mb-2">Retroceder Até</label>
                    <div className="relative">
                        <FaCalendarAlt className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868B]" />
                        <input 
                            type="date" 
                            className="w-full pl-12 pr-4 py-3.5 bg-[#F5F5F7] border border-[#E5E5EA] rounded-xl focus:border-[#1D1D1F] outline-none text-sm font-bold text-[#1D1D1F] transition-all"
                            value={dateStart}
                            onChange={(e) => setDateStart(e.target.value)}
                        />
                    </div>
                </div>

                {/* Data Fim */}
                <div>
                    <label className="block text-[10px] font-black tracking-widest text-[#86868B] uppercase mb-2">Limitar No Dia</label>
                    <div className="relative">
                        <FaCalendarAlt className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868B]" />
                        <input 
                            type="date" 
                            className="w-full pl-12 pr-4 py-3.5 bg-[#F5F5F7] border border-[#E5E5EA] rounded-xl focus:border-[#1D1D1F] outline-none text-sm font-bold text-[#1D1D1F] transition-all"
                            value={dateEnd}
                            onChange={(e) => setDateEnd(e.target.value)}
                        />
                    </div>
                </div>

                {/* Tipo de Ação */}
                <div className="relative">
                    <label className="block text-[10px] font-black tracking-widest text-[#86868B] uppercase mb-2">Assinatura de Risco</label>
                    <div className="relative">
                        <FaFilter className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868B]" />
                        <select 
                            className="w-full pl-12 pr-10 py-3.5 bg-[#F5F5F7] border border-[#E5E5EA] rounded-xl focus:border-[#1D1D1F] outline-none text-sm font-bold text-[#1D1D1F] transition-all appearance-none cursor-pointer"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                        >
                            <option value="todos">Qualquer Assinatura</option>
                            <option value="ESTABELECIMENTO_ATUALIZADO">Alteração de Loja</option>
                            <option value="ESTABELECIMENTO_CRIADO">Criação de Loja</option>
                            <option value="USUARIO_CRIADO">Novo Usuário / Acesso</option>
                            <option value="CARDAPIO_IMPORTADO">Cardápio Sobrescrito</option>
                        </select>
                        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#86868B] font-bold text-[10px]">▼</div>
                    </div>
                </div>

                {/* Busca Texto (Client-Side) */}
                <div className="relative">
                    <label className="block text-[10px] font-black tracking-widest text-[#86868B] uppercase mb-2">Busca Superficial (DOM)</label>
                    <div className="relative">
                        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#86868B]" />
                        <input 
                            type="text" 
                            placeholder="Pesquisar ID ou User..." 
                            className="w-full pl-12 pr-4 py-3.5 bg-[#F5F5F7] border border-[#E5E5EA] rounded-xl focus:border-[#1D1D1F] outline-none text-sm font-bold text-[#1D1D1F] transition-all placeholder:text-[#86868B]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>
        </div>

        {/* Lista de Logs */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-[#E5E5EA] overflow-hidden">
            {loadingLogs ? (
                <div className="p-20 text-center flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full border-[3px] border-[#F5F5F7] border-t-[#1D1D1F] animate-spin mb-4"></div>
                    <p className="font-bold text-[#1D1D1F] text-lg">Inspecionando Registros...</p>
                    <p className="text-[#86868B] font-medium text-sm mt-1">Navegando no banco auditório.</p>
                </div>
            ) : displayedLogs.length === 0 ? (
                <div className="p-20 text-center flex flex-col items-center">
                    <div className="w-20 h-20 bg-[#F5F5F7] rounded-[1.5rem] border border-[#E5E5EA] flex items-center justify-center mb-6 shadow-sm">
                        <FaCube className="text-[#86868B] text-3xl" />
                    </div>
                    <h3 className="text-xl font-bold text-[#1D1D1F] mb-2 tracking-tight">Nenhum rastro detectado</h3>
                    <p className="text-[#86868B] text-sm font-medium">As restrições do filtro selecionado não condizem com registros atuais.</p>
                </div>
            ) : (
                <div className="flex flex-col">
                    {displayedLogs.map(log => (
                        <LogItem key={log.id} log={log} />
                    ))}
                </div>
            )}

            {/* Paginação */}
            {displayedLogs.length > 0 && (
                <div className="p-5 border-t border-[#E5E5EA] bg-[#F5F5F7] flex justify-between items-center">
                    <button 
                        onClick={handlePrev} 
                        disabled={page === 1 || loadingLogs}
                        className="flex items-center gap-2 px-5 py-3 bg-white border border-[#E5E5EA] rounded-full text-sm font-bold text-[#1D1D1F] hover:bg-[#E5E5EA] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                    >
                        <FaArrowLeft size={12} /> Lote Anterior
                    </button>
                    
                    <span className="text-[10px] font-black text-[#86868B] uppercase tracking-widest bg-white px-4 py-2 rounded-full border border-[#E5E5EA] shadow-sm">
                        Página {page}
                    </span>
                    
                    <button 
                        onClick={handleNext} 
                        disabled={displayedLogs.length < ITEMS_PER_PAGE || loadingLogs}
                        className="flex items-center gap-2 px-5 py-3 bg-[#1D1D1F] text-white rounded-full text-sm font-bold hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                    >
                        Avançar Lote <FaArrowRight size={12} />
                    </button>
                </div>
            )}
        </div>

      </main>
      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
      `}</style>
    </div>
  );
}

export default AuditLogs;