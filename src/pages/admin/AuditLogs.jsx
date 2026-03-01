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
  FaSignOutAlt, 
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
  FaExternalLinkAlt
} from 'react-icons/fa';

const ITEMS_PER_PAGE = 20;

// --- Header Minimalista ---
const DashboardHeader = ({ navigate, logout, currentUser }) => {
  const userEmailPrefix = currentUser?.email ? currentUser.email.split('@')[0] : 'Admin';
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 h-16 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex justify-between items-center">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
           <div className="flex items-center gap-1">
              <div className="bg-yellow-400 text-black font-bold p-1 rounded-sm transform -skew-x-12">
                  <FaStore />
              </div>
              <span className="text-gray-900 font-extrabold text-xl tracking-tight">
                  Na<span className="text-yellow-500">Mão</span>
              </span>
          </div>
        </div>
        <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-semibold text-gray-800">{userEmailPrefix}</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Master Admin</span>
            </div>
            <button 
                onClick={logout} 
                className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
                title="Sair"
            >
              <FaSignOutAlt />
            </button>
          </div>
      </div>
    </header>
  );
};

// --- Visualizador de Detalhes JSON ---
const DetailViewer = ({ data }) => {
    if (!data) return <span className="text-gray-400 text-xs italic">Nenhum detalhe técnico registrado.</span>;
    let parsedData = data;
    if (typeof data === 'string') {
        try { parsedData = JSON.parse(data); } catch (e) { }
    }
    if (typeof parsedData === 'object' && Object.keys(parsedData).length === 0) {
        return <span className="text-gray-400 text-xs italic">Detalhes vazios.</span>;
    }
    return (
        <div className="bg-gray-900 rounded-lg p-4 text-xs font-mono text-green-400 overflow-x-auto border border-gray-800 shadow-inner">
            {Object.entries(parsedData).map(([key, value]) => (
                <div key={key} className="mb-1 last:mb-0">
                    <span className="text-blue-300">{key}:</span>{' '}
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

    // Gera o link correto baseado no tipo do alvo
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
            return { icon: <FaPlus />, color: 'bg-green-100 text-green-700', border: 'border-green-200' };
        if (t.includes('ATUALIZADO') || t.includes('EDITADO')) 
            return { icon: <FaEdit />, color: 'bg-blue-100 text-blue-700', border: 'border-blue-200' };
        if (t.includes('DELETADO') || t.includes('REMOVIDO') || t.includes('DESATIVADO')) 
            return { icon: <FaTrash />, color: 'bg-red-100 text-red-700', border: 'border-red-200' };
        return { icon: <FaHistory />, color: 'bg-gray-100 text-gray-700', border: 'border-gray-200' };
    };

    const style = getIconAndColor(log.actionType);

    return (
        <div className={`border-b border-gray-100 last:border-0 transition-colors ${expanded ? 'bg-gray-50' : 'bg-white'}`}>
            <div className="flex items-center justify-between p-5 hover:bg-gray-50/80 transition-all group">
                
                {/* Clique Principal para Expandir */}
                <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${style.color} border ${style.border} shrink-0 shadow-sm`}>
                        {style.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate" title={log.actionType}>
                            {log.actionType?.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                            <FaUserShield className="text-gray-400" /> 
                            <span className="truncate">{log.actor?.email || 'Sistema / Desconhecido'}</span>
                        </p>
                    </div>
                </div>

                {/* Metadata e Link Rápido */}
                <div className="flex items-center gap-4 ml-4">
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-200/50 px-2 py-0.5 rounded">
                                {log.target?.type || 'Geral'}
                            </span>
                            {/* Link Direto para o Objeto (se existir) */}
                            {targetLink && (
                                <Link 
                                    to={targetLink}
                                    className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                                    title={`Ir para ${log.target.type}`}
                                >
                                    <FaExternalLinkAlt size={10} />
                                </Link>
                            )}
                        </div>
                        <span className="text-xs text-gray-400 font-medium">
                            {log.timestamp ? format(log.timestamp.toDate(), "dd/MM HH:mm", { locale: ptBR }) : '--/--'}
                        </span>
                    </div>
                    
                    <button onClick={() => setExpanded(!expanded)} className="text-gray-300 hover:text-gray-500 p-2">
                        {expanded ? <FaChevronUp /> : <FaChevronDown />}
                    </button>
                </div>
            </div>

            {/* Detalhes Expandidos */}
            {expanded && (
                <div className="p-5 pl-[4.5rem] border-t border-gray-200/50 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                        <div className="space-y-1">
                            <p className="text-[10px] uppercase font-bold text-gray-400">ID do Alvo</p>
                            <div className="flex items-center gap-2">
                                <p className="text-xs font-mono bg-white p-2 border border-gray-200 rounded select-all text-gray-600 flex-1">
                                    {log.target?.id || 'N/A'}
                                </p>
                            </div>
                        </div>
                        {log.target?.name && (
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase font-bold text-gray-400">Nome do Alvo</p>
                                <p className="text-sm font-bold text-gray-800">{log.target.name}</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                            <FaCode className="text-gray-400 text-xs" />
                            <p className="text-[10px] uppercase font-bold text-gray-400">Payload Técnico</p>
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

  // 1. Verificar Permissão
  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isMasterAdmin) {
        navigate('/master-dashboard');
      }
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  // 2. Buscar Logs (Server-Side)
  const fetchLogs = useCallback(async (direction = 'initial') => {
    if (!isMasterAdmin) return;
    setLoadingLogs(true);
    setError('');
    setIndexLink(null);

    try {
        let q = collection(db, 'auditLogs');
        let constraints = [orderBy('timestamp', 'desc')];

        // --- FILTROS SERVER-SIDE ---
        // Se usar Data, o Firebase exige que seja a primeira ordenação ou índice composto
        if (dateStart) constraints.push(where('timestamp', '>=', startOfDay(parseISO(dateStart))));
        if (dateEnd) constraints.push(where('timestamp', '<=', endOfDay(parseISO(dateEnd))));

        if (filterType !== 'todos') {
            constraints.push(where('actionType', '==', filterType));
        }

        // --- PAGINAÇÃO ---
        if (direction === 'next' && lastVisible) {
            constraints.push(startAfter(lastVisible));
        } else if (direction === 'prev' && firstVisible) {
            // Estratégia simples de voltar: reset para evitar complexidade de cursor reverso
            if (page <= 2) direction = 'initial'; 
        }

        if (direction === 'initial') {
             constraints.push(limit(ITEMS_PER_PAGE));
        } else {
             constraints.push(limit(ITEMS_PER_PAGE));
        }

        // Monta Query
        // Nota: O Firestore ordena automaticamente os where() filters
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

  // Trigger de Busca
  useEffect(() => {
    setPage(1);
    setLastVisible(null);
    setFirstVisible(null);
    fetchLogs('initial');
  }, [filterType, dateStart, dateEnd, isMasterAdmin]); // Removemos fetchLogs para evitar loop

  const handleNext = () => { setPage(p => p + 1); fetchLogs('next'); };
  const handlePrev = () => { if (page > 1) { setPage(p => p - 1); if (page === 2) fetchLogs('initial'); } };

  // --- EXPORTAR CSV ---
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
            `"${log.target?.name || ''}"` // Aspas para nomes com vírgula
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
    toast.success("Relatório CSV gerado!");
  };

  // Filtragem Client-Side (Busca Texto)
  const displayedLogs = logs.filter(log => {
      const term = searchTerm.toLowerCase();
      return !term || 
             (log.actor?.email && log.actor.email.toLowerCase().includes(term)) ||
             (log.target?.id && log.target.id.toLowerCase().includes(term)) ||
             (log.target?.name && log.target.name.toLowerCase().includes(term));
  });

  if (authLoading) return <div className="flex h-screen items-center justify-center bg-gray-50"><div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="bg-gray-50 min-h-screen pt-20 pb-12 px-4 sm:px-6 font-sans text-gray-900">
      <DashboardHeader navigate={navigate} logout={logout} currentUser={currentUser} />

      <div className="max-w-6xl mx-auto">
        
        {/* Header da Página */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
                <button onClick={() => navigate('/master-dashboard')} className="text-gray-400 hover:text-gray-600 flex items-center gap-2 mb-2 text-sm font-medium transition-colors">
                    <FaArrowLeft /> Voltar ao Dashboard
                </button>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Auditoria & Segurança</h1>
                <p className="text-gray-500 text-sm mt-1">Rastreamento detalhado de todas as operações do sistema.</p>
            </div>
            
            <button 
                onClick={handleExportCSV}
                className="flex items-center gap-2 bg-green-600 text-white px-5 py-3 rounded-xl hover:bg-green-700 transition-all shadow-lg font-bold text-sm"
            >
                <FaFileCsv size={16} /> Exportar Relatório
            </button>
        </div>

        {/* --- AVISO CRÍTICO DE ÍNDICE --- */}
        {indexLink && (
            <div className="mb-6 p-5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-4 shadow-sm animate-pulse">
                <div className="bg-red-100 p-2 rounded-full text-red-600">
                    <FaExclamationTriangle className="text-xl" />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-red-800 text-lg">Configuração Necessária (Índice Firestore)</h3>
                    <p className="text-sm text-red-700 mt-1 mb-3">
                        Para combinar o filtro de <strong>Data</strong> com <strong>Tipo de Ação</strong>, o Firebase exige um índice composto.
                    </p>
                    <a 
                        href={indexLink} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors shadow-lg"
                    >
                        🛠️ Criar Índice Agora
                    </a>
                </div>
            </div>
        )}

        {/* Barra de Filtros */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Data Inicio */}
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Data Inicial</label>
                    <div className="relative">
                        <FaCalendarAlt className="absolute left-4 top-3.5 text-gray-300" />
                        <input 
                            type="date" 
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm"
                            value={dateStart}
                            onChange={(e) => setDateStart(e.target.value)}
                        />
                    </div>
                </div>

                {/* Data Fim */}
                <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Data Final</label>
                    <div className="relative">
                        <FaCalendarAlt className="absolute left-4 top-3.5 text-gray-300" />
                        <input 
                            type="date" 
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm"
                            value={dateEnd}
                            onChange={(e) => setDateEnd(e.target.value)}
                        />
                    </div>
                </div>

                {/* Tipo de Ação */}
                <div className="relative">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Tipo de Ação</label>
                    <div className="relative">
                        <FaFilter className="absolute left-4 top-3.5 text-gray-300" />
                        <select 
                            className="w-full pl-10 pr-8 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm appearance-none cursor-pointer"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                        >
                            <option value="todos">Todos</option>
                            <option value="ESTABELECIMENTO_ATUALIZADO">Estabelecimento Atualizado</option>
                            <option value="ESTABELECIMENTO_CRIADO">Estabelecimento Criado</option>
                            <option value="USUARIO_CRIADO">Usuário Criado</option>
                            <option value="CARDAPIO_IMPORTADO">Cardápio Importado</option>
                            {/* Adicione outros conforme necessário */}
                        </select>
                        <FaChevronDown className="absolute right-4 top-4 text-gray-300 text-xs pointer-events-none" />
                    </div>
                </div>

                {/* Busca Texto (Client-Side) */}
                <div className="relative">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Busca Rápida (Tela)</label>
                    <div className="relative">
                        <FaSearch className="absolute left-4 top-3.5 text-gray-300" />
                        <input 
                            type="text" 
                            placeholder="Email, ID..." 
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>
        </div>

        {/* Lista de Logs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {loadingLogs ? (
                <div className="p-16 text-center text-gray-400">
                    <div className="w-10 h-10 border-4 border-gray-100 border-t-yellow-400 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="font-medium text-sm">Buscando registros...</p>
                </div>
            ) : displayedLogs.length === 0 ? (
                <div className="p-16 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300 text-2xl">
                        <FaCube />
                    </div>
                    <h3 className="text-gray-900 font-bold mb-1">Nenhum registro encontrado</h3>
                    <p className="text-gray-500 text-sm">Não há logs com esses critérios.</p>
                </div>
            ) : (
                <div>
                    {displayedLogs.map(log => (
                        <LogItem key={log.id} log={log} />
                    ))}
                </div>
            )}

            {/* Paginação */}
            {displayedLogs.length > 0 && (
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                    <button 
                        onClick={handlePrev} 
                        disabled={page === 1 || loadingLogs}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <FaArrowLeft /> Anterior
                    </button>
                    
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Página {page}
                    </span>
                    
                    <button 
                        onClick={handleNext} 
                        disabled={displayedLogs.length < ITEMS_PER_PAGE || loadingLogs}
                        className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-bold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                    >
                        Próxima <FaArrowRight />
                    </button>
                </div>
            )}
        </div>

      </div>
    </div>
  );
}

export default AuditLogs;