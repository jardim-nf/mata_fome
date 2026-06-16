import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, doc, updateDoc, deleteDoc, getDocs, limit, startAfter, orderBy, endBefore, limitToLast, where, getCountFromServer } from 'firebase/firestore'; 
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger'; 
import { 
  FiArrowLeft, FiSun, FiMoon, FiLogOut, FiPlus, FiEdit3, FiTrash2, 
  FiPower, FiCheck, FiSearch, FiHome, FiShield, FiLink, FiGlobe, FiAlertCircle,
  FiSettings, FiChevronLeft, FiChevronRight
} from 'react-icons/fi';
import { IoLogoWhatsapp } from 'react-icons/io5';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ITEMS_PER_PAGE = 12; 

// --- Loading Screen de Boot com a Logo corporativa ---
const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-500 bg-[#080c16] text-slate-100 font-space">
    {/* Grade cibernética de fundo */}
    <div className="absolute inset-0 bg-cyber-grid-dark opacity-50 pointer-events-none" />

    {/* Círculos luminosos */}
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute top-[20%] left-1/3 w-[300px] h-[300px] rounded-full bg-gradient-to-tr from-cyan-500/10 to-transparent blur-[80px]" />
      <div className="absolute bottom-[20%] right-1/3 w-[300px] h-[300px] rounded-full bg-gradient-to-tr from-violet-500/10 to-transparent blur-[80px]" />
    </div>

    <div className="relative z-10 flex flex-col items-center gap-6 text-center px-4">
      {/* Container com a logo pulsante */}
      <div className="relative flex items-center justify-center w-24 h-24 rounded-3xl border border-white/5 bg-slate-950/40 backdrop-blur-xl shadow-2xl p-4">
        {/* Glow externo rotativo */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute -inset-1 rounded-[2rem] border border-dashed border-cyan-500/30 opacity-60"
        />
        <motion.img 
          src="/logo-idea-solucoes-transp.png" 
          alt="Logo Idea Soluções" 
          animate={{ scale: [0.95, 1.08, 0.95] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="h-12 w-auto object-contain brightness-0 invert" 
        />
      </div>

      <div>
        <h3 className="text-base font-black tracking-wider uppercase font-bricolage mb-1.5 text-white">
          Iniciando Ambiente
        </h3>
        <p className="text-xs font-bold text-slate-400">
          Carregando operadoras e franquias...
          <span className="block mt-1 text-xs text-slate-500 animate-pulse">Sincronizando estabelecimentos da rede</span>
        </p>
      </div>
    </div>
  </div>
);

// Skeleton Card (Bento Style)
const SkeletonCard = ({ themeClass }) => (
  <div className={`rounded-[2rem] border p-6 animate-pulse flex flex-col justify-between h-80 ${themeClass.cardBg} ${themeClass.border} shadow-sm`}>
    <div className="flex items-center gap-4 mb-4">
      <div className={`w-14 h-14 rounded-2xl ${themeClass.inputBg}`}></div>
      <div className="flex-1 space-y-2">
        <div className={`h-4 rounded-lg w-32 ${themeClass.inputBg}`}></div>
        <div className={`h-3 rounded-lg w-16 ${themeClass.inputBg}`}></div>
      </div>
    </div>
    <div className="space-y-2 mt-6">
      <div className={`h-10 rounded-xl ${themeClass.inputBg}`}></div>
      <div className={`h-10 rounded-xl ${themeClass.inputBg}`}></div>
    </div>
    <div className={`flex gap-2 mt-4 pt-4 border-t ${themeClass.border}`}>
      <div className={`h-10 rounded-xl flex-1 ${themeClass.inputBg}`}></div>
      <div className={`h-10 w-10 rounded-xl ${themeClass.inputBg}`}></div>
      <div className={`h-10 w-10 rounded-xl ${themeClass.inputBg}`}></div>
    </div>
  </div>
);

function ListarEstabelecimentos() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth(); 

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Confirmar',
    isDanger: false,
  });

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('dashboard_theme');
    return saved || 'dark';
  });

  // Carrega fontes customizadas de alta estética baseadas no cookbook
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@300;400;500;650;700&display=swap';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Sincroniza o tema entre abas do dashboard
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'dashboard_theme') {
        setTheme(e.newValue || 'dark');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('dashboard_theme', newTheme);
  };

  const themeClasses = {
    dark: {
      bg: 'bg-[#080c16] bg-cyber-grid-dark text-slate-100',
      surface: 'bg-slate-950/45 backdrop-blur-xl border border-white/5 shadow-2xl',
      surfaceHover: 'hover:bg-slate-900/50 hover:border-cyan-500/30 hover:shadow-[0_12px_40px_rgba(6,182,212,0.15)] hover:scale-[1.015] hover:-translate-y-0.5 transition-all duration-300',
      border: 'border-white/5',
      text: 'text-slate-100 font-space',
      textSecondary: 'text-slate-400 font-space font-medium',
      textMuted: 'text-slate-500 font-space font-semibold',
      accent: 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]',
      accentHover: 'hover:bg-cyan-600',
      gradient: 'from-cyan-400 via-violet-500 to-fuchsia-500',
      cardBg: 'bg-slate-950/30 backdrop-blur-xl border border-white/5 shadow-2xl',
      inputBg: 'bg-slate-950/30 border-white/10 text-slate-100 focus-within:border-cyan-500/50 focus-within:bg-slate-950/50',
      buttonBg: 'bg-slate-900 border-white/5 text-slate-300 hover:border-cyan-500/30 hover:text-white',
    },
    light: {
      bg: 'bg-[#fbfbfa] bg-cyber-grid-light text-stone-900',
      surface: 'bg-white/95 backdrop-blur-md border border-stone-200 shadow-md',
      surfaceHover: 'hover:bg-white hover:border-stone-300 hover:shadow-[0_12px_45px_rgba(28,25,23,0.06)] hover:scale-[1.015] hover:-translate-y-0.5 transition-all duration-300',
      border: 'border-stone-200',
      text: 'text-stone-900 font-space font-bold',
      textSecondary: 'text-stone-700 font-space font-medium',
      textMuted: 'text-stone-400 font-space font-semibold',
      accent: 'bg-[#ff6b35] shadow-sm text-white font-bold',
      accentHover: 'hover:bg-[#e85a2a]',
      gradient: 'from-[#ff6b35] via-amber-500 to-[#e85a2a]',
      cardBg: 'bg-[#f5f5f4]/80 backdrop-blur-md border border-stone-200 shadow-sm',
      inputBg: 'bg-[#f5f5f4] border-stone-200 text-stone-900 focus-within:border-stone-400 focus-within:bg-white',
      buttonBg: 'bg-white border-stone-200 text-stone-700 hover:border-stone-400 hover:text-black',
    }
  };

  const t = themeClasses[theme];
  const isDark = theme === 'dark';

  const [estabelecimentos, setEstabelecimentos] = useState([]); 
  const [loadingEstabs, setLoadingEstabs] = useState(true); 
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [lastVisible, setLastVisible] = useState(null);
  const [firstVisible, setFirstVisible] = useState(null); 
  const [currentPage, setCurrentPage] = useState(0); 
  const [hasMore, setHasMore] = useState(true); 
  const [hasPrevious, setHasPrevious] = useState(false); 
  const [totalCount, setTotalCount] = useState({ total: 0, ativos: 0, inativos: 0 });

  // Fetch counts usando Agregação do Firebase (Muito mais rápido e barato)
  useEffect(() => {
    if (!isMasterAdmin) return;
    const fetchCounts = async () => {
      try {
        const estabsRef = collection(db, 'estabelecimentos');
        
        const [totalRes, ativosRes] = await Promise.all([
          getCountFromServer(estabsRef),
          getCountFromServer(query(estabsRef, where('ativo', '==', true)))
        ]);

        const total = totalRes.data().count;
        const ativos = ativosRes.data().count;
        const inativos = total - ativos;

        setTotalCount({ total, ativos, inativos });
      } catch (e) {
        console.error("Erro ao buscar contadores:", e);
      }
    };
    fetchCounts();
  }, [isMasterAdmin]);

  const fetchEstabelecimentos = useCallback(async (direction = 'next', startDoc = null, resetPagination = false) => {
    if (!isMasterAdmin || !currentUser) { setLoadingEstabs(false); return; }
    setLoadingEstabs(true); setError('');

    let baseQueryRef = collection(db, 'estabelecimentos');
    let queryConstraints = [];
    if (filterStatus === 'ativos') queryConstraints.push(where('ativo', '==', true));
    else if (filterStatus === 'inativos') queryConstraints.push(where('ativo', '==', false));

    const orderByField = 'nome'; 
    let q;
    if (resetPagination) q = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'asc'), limit(ITEMS_PER_PAGE));
    else if (direction === 'next' && startDoc) q = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'asc'), startAfter(startDoc), limit(ITEMS_PER_PAGE));
    else if (direction === 'prev' && startDoc) q = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'desc'), endBefore(startDoc), limitToLast(ITEMS_PER_PAGE));
    else q = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'asc'), limit(ITEMS_PER_PAGE));

    try {
      const documentSnapshots = await getDocs(q);
      let fetchedEstabs = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (direction === 'prev') fetchedEstabs.reverse(); 
      setEstabelecimentos(fetchedEstabs);
      
      if (documentSnapshots.docs.length > 0) {
        setFirstVisible(documentSnapshots.docs[0]);
        setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
        const nextCheck = await getDocs(query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'asc'), startAfter(documentSnapshots.docs[documentSnapshots.docs.length - 1]), limit(1)));
        setHasMore(!nextCheck.empty);
        const prevCheck = await getDocs(query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'desc'), startAfter(documentSnapshots.docs[0]), limit(1))); 
        setHasPrevious(!prevCheck.empty);
      } else { setFirstVisible(null); setLastVisible(null); setHasMore(false); setHasPrevious(false); }
    } catch (err) { setError("Erro ao carregar lista de lojas."); }
    finally { setLoadingEstabs(false); }
  }, [isMasterAdmin, currentUser, filterStatus]);

  useEffect(() => {
    if (!authLoading && isMasterAdmin && currentUser) {
      setCurrentPage(0); setLastVisible(null); setFirstVisible(null);
      fetchEstabelecimentos('next', null, true); 
    } else if (!authLoading && (!currentUser || !isMasterAdmin)) { navigate('/master-dashboard'); }
  }, [authLoading, isMasterAdmin, currentUser, filterStatus, fetchEstabelecimentos, navigate]); 

  const handleNextPage = () => { if (hasMore) { setCurrentPage(p => p + 1); fetchEstabelecimentos('next', lastVisible); } };
  const handlePreviousPage = () => { if (hasPrevious) { setCurrentPage(p => p - 1); fetchEstabelecimentos('prev', firstVisible); } };

  const filteredEstabs = useMemo(() => {
    if (!searchTerm.trim()) return estabelecimentos;
    const term = searchTerm.toLowerCase();
    return estabelecimentos.filter(e => (e.nome && e.nome.toLowerCase().includes(term)) || (e.slug && e.slug.toLowerCase().includes(term)));
  }, [estabelecimentos, searchTerm]);

  const toggleEstabelecimentoAtivo = (id, currentStatus, nome) => {
    setConfirmModal({
      isOpen: true,
      title: currentStatus ? 'Bloquear Estabelecimento' : 'Ativar Estabelecimento',
      message: `Deseja realmente ${currentStatus ? 'DESATIVAR (Bloquear)' : 'ATIVAR'} a operação de "${nome}"?`,
      confirmText: currentStatus ? 'Bloquear Loja' : 'Ativar Loja',
      isDanger: currentStatus,
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'estabelecimentos', id), { ativo: !currentStatus });
          auditLogger(currentStatus ? 'ESTABELECIMENTO_DESATIVADO' : 'ESTABELECIMENTO_ATIVADO', { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' }, { type: 'estabelecimento', id, name: nome });
          toast.success(`Status de ${nome} atualizado.`);
          
          setEstabelecimentos(prev => prev.map(e => {
            if (e.id === id) {
              return { ...e, ativo: !currentStatus };
            }
            return e;
          }));
          setTotalCount(prev => ({
            ...prev,
            ativos: currentStatus ? prev.ativos - 1 : prev.ativos + 1,
            inativos: currentStatus ? prev.inativos + 1 : prev.inativos - 1
          }));
        } catch (error) { toast.error('Erro ao atualizar status.'); }
      }
    });
  };

  const handleDeleteEstabelecimento = (id, nome) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Estabelecimento',
      message: `ATENÇÃO: Deletar "${nome}" é um processo definitivo e irreversível. Todos os dados associados a esta loja serão perdidos. Deseja prosseguir?`,
      confirmText: 'Excluir Permanentemente',
      isDanger: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'estabelecimentos', id));
          auditLogger('ESTABELECIMENTO_DELETADO', { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' }, { type: 'estabelecimento', id, name: nome });
          toast.success("Estabelecimento deletado.");
          
          const wasAtivo = estabelecimentos.find(e => e.id === id)?.ativo;
          setEstabelecimentos(prev => prev.filter(e => e.id !== id));
          setTotalCount(prev => ({
            total: prev.total - 1,
            ativos: wasAtivo ? prev.ativos - 1 : prev.ativos,
            inativos: wasAtivo ? prev.inativos : prev.inativos - 1
          }));
        } catch (error) { toast.error("Erro ao deletar."); }
      }
    });
  };

  const toggleChatbotAtivo = async (id, currentStatus, nome) => {
    try {
      await updateDoc(doc(db, 'estabelecimentos', id), {
        'botPedidos.ativo': !currentStatus
      });
      auditLogger(!currentStatus ? 'BOT_PEDIDOS_ATIVADO' : 'BOT_PEDIDOS_DESATIVADO', { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' }, { type: 'estabelecimento', id, name: nome });
      toast.success(`Chatbot de ${nome} ${!currentStatus ? 'ativado' : 'desativado'}.`);
      
      setEstabelecimentos(prev => prev.map(e => {
        if (e.id === id) {
          return {
            ...e,
            botPedidos: {
              ...(e.botPedidos || {}),
              ativo: !currentStatus
            }
          };
        }
        return e;
      }));
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar status do chatbot.');
    }
  };

  if (authLoading) return <LoadingScreen />;

  return (
    <div className={`min-h-screen ${t.bg} transition-colors duration-500 relative overflow-hidden pb-24 pt-4 px-4 sm:px-8 font-space`}>
      
      {/* Estilos e Variáveis Injetadas */}
      <style>{`
        .font-bricolage {
          font-family: 'Bricolage Grotesque', sans-serif !important;
        }
        .font-space {
          font-family: 'Space Grotesk', sans-serif !important;
        }
        .font-mono-jb {
          font-family: 'JetBrains Mono', monospace !important;
        }
        .bg-cyber-grid-dark {
          background-image: 
            linear-gradient(to right, rgba(99, 102, 241, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .bg-cyber-grid-light {
          background-image: 
            linear-gradient(to right, rgba(28, 25, 23, 0.018) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(28, 25, 23, 0.018) 1px, transparent 1px);
          background-size: 40px 40px;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Esferas de luz ambiente flutuantes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            x: [0, 60, -40, 0],
            y: [0, -70, 40, 0],
            scale: [1, 1.25, 0.85, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-[-10%] left-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-cyan-500/5 to-transparent blur-[120px]"
        />
        <motion.div
          animate={{
            x: [0, -40, 50, 0],
            y: [0, 50, -50, 0],
            scale: [1, 0.9, 1.2, 1],
          }}
          transition={{
            duration: 28,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-1/3 right-[5%] w-[450px] h-[450px] rounded-full bg-gradient-to-tr from-violet-500/5 to-transparent blur-[100px]"
        />
      </div>

      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className={`max-w-[1800px] mx-auto backdrop-blur-xl border rounded-full h-16 flex items-center justify-between px-6 sticky top-4 z-40 transition-all duration-300 ${t.surface} ${t.border}`}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/master-dashboard')} className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${theme === 'dark' ? 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white' : 'bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-black'}`}>
            <FiArrowLeft size={16} />
          </button>
          <div className="hidden sm:block border-l pl-4 border-current opacity-60">
            <h1 className="font-semibold text-sm tracking-tight font-bricolage">Módulo de Lojas</h1>
            <p className="text-xs font-mono-jb font-semibold">{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${theme === 'dark' ? 'bg-slate-900 hover:bg-slate-800 text-yellow-400' : 'bg-stone-100 hover:bg-stone-200 text-amber-600'}`}
            title="Alternar Tema"
          >
            {theme === 'dark' ? <FiSun size={15} /> : <FiMoon size={15} />}
          </button>
          
          <div className={`w-px h-6 hidden sm:block ${theme === 'dark' ? 'bg-white/10' : 'bg-stone-200'}`} />
          
          <button onClick={async () => { await logout(); navigate('/'); }} className="w-9 h-9 bg-red-500/10 hover:bg-red-500/20 rounded-full flex items-center justify-center transition-colors" title="Sair">
            <FiLogOut className="text-red-500" size={15} />
          </button>
        </div>
      </nav>

      <main className="max-w-[1800px] mx-auto mt-12 relative z-10">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-10 gap-6 px-2">
          <div>
            <div className="flex items-center gap-3 mb-2 justify-center sm:justify-start">
              <span className={`text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 ${theme === 'dark' ? 'bg-slate-900 text-cyan-400 border-cyan-500/20' : 'bg-stone-200 text-stone-900 border-stone-300'}`}><FiGlobe /> Controle de Franquias da Rede</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight font-bricolage">Estabelecimentos</h1>
            <p className={`${t.textSecondary} text-sm mt-2 font-medium`}>Controle de unidades, administradores vinculados, chatbot e status sistêmico.</p>
          </div>
          <Link to="/admin/cadastrar-estabelecimento"
            className={`flex items-center gap-2 px-6 py-3.5 rounded-full hover:scale-[1.02] transition-all shadow-lg font-black text-xs uppercase tracking-wider active:scale-95 font-bricolage text-white ${
              theme === 'dark' ? 'bg-cyan-500 hover:bg-cyan-600 shadow-cyan-500/20' : 'bg-stone-900 hover:bg-black'
            }`}>
            <FiPlus size={12} /> Nova Operação
          </Link>
        </div>

        {/* STATUS BAR MOSAICO (MINI BENTO) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          <div className={`border rounded-[2rem] p-6 shadow-sm relative overflow-hidden group transition-all duration-300 ${t.cardBg} ${t.border} ${t.surfaceHover}`}>
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-r-full" />
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-xl border ${theme==='dark' ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-cyan-50 border-cyan-200 text-cyan-600'}`}>
                <FiHome size={18} />
              </div>
              <span className={`text-xs font-black uppercase tracking-widest ${t.textMuted} font-bricolage`}>Rede</span>
            </div>
            <h3 className="text-3xl font-black font-mono-jb tracking-tight">{totalCount.total}</h3>
            <p className={`text-xs mt-1 uppercase tracking-wider font-bold ${t.textSecondary}`}>Total Lojas</p>
          </div>
          
          <div className={`border rounded-[2rem] p-6 shadow-sm relative overflow-hidden group transition-all duration-300 ${t.cardBg} ${t.border} ${t.surfaceHover}`}>
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-emerald-400 to-teal-500 rounded-r-full" />
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-xl border ${theme==='dark' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse block" />
              </div>
              <span className={`text-xs font-black uppercase tracking-widest ${t.textMuted} font-bricolage`}>Operacionais</span>
            </div>
            <h3 className="text-3xl font-black font-mono-jb tracking-tight">{totalCount.ativos}</h3>
            <p className={`text-xs mt-1 uppercase tracking-wider font-bold ${t.textSecondary}`}>Operações Ativas</p>
          </div>

          <div className={`border rounded-[2rem] p-6 shadow-sm relative overflow-hidden group transition-all duration-300 ${t.cardBg} ${t.border} ${t.surfaceHover}`}>
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-rose-500 to-red-550 rounded-r-full" />
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-xl border ${theme==='dark' ? 'bg-rose-500/10 border-rose-500/20 text-rose-450' : 'bg-red-50 border-red-200 text-rose-600'}`}>
                <FiPower size={16} />
              </div>
              <span className={`text-xs font-black uppercase tracking-widest ${t.textMuted} font-bricolage`}>Suspensas</span>
            </div>
            <h3 className="text-3xl font-black font-mono-jb tracking-tight">{totalCount.inativos}</h3>
            <p className={`text-xs mt-1 uppercase tracking-wider font-bold ${t.textSecondary}`}>Inativas / Suspensas</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-5 mb-6 rounded-2xl text-sm font-semibold flex items-center gap-2">
            <FiAlertCircle className="shrink-0" size={16} /> {error}
          </div>
        )}

        {/* ─── BARRA DE BUSCA E FILTROS ─── */}
        <div className={`p-4 rounded-3xl border mb-8 flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-300 ${t.surface} ${t.border}`}>
            {/* Search Input */}
            <div className={`relative w-full md:flex-1 border rounded-2xl px-5 py-3 flex items-center shadow-sm transition-all duration-300 ${t.inputBg} ${t.border}`}>
                <FiSearch className={`${t.textMuted} shrink-0`} size={16} />
                <input 
                    type="text" 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar loja por nome, slug..." 
                    className={`bg-transparent border-none outline-none text-xs ml-3 w-full font-bold focus:ring-0 placeholder-gray-500 ${t.text}`}
                />
            </div>

            {/* Filter Status Buttons */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
                {[
                  { id: 'todos', label: 'Toda a Rede', count: totalCount.total },
                  { id: 'ativos', label: 'Operacionais', count: totalCount.ativos },
                  { id: 'inativos', label: 'Suspensas', count: totalCount.inativos },
                ].map(s => {
                  const isActive = filterStatus === s.id;
                  return (
                    <button key={s.id} onClick={() => setFilterStatus(s.id)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap active:scale-95 border
                        ${isActive 
                          ? (theme === 'dark' ? 'bg-cyan-500 border-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-500/15' : 'bg-stone-900 border-stone-900 text-white shadow-md') 
                          : `${t.cardBg} ${t.border} ${t.textSecondary} hover:text-white hover:border-slate-500/35`}`}>
                      {s.label}
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full font-mono-jb ${isActive ? 'bg-white text-black' : (theme === 'dark' ? 'bg-slate-950 text-slate-400' : 'bg-stone-200 text-stone-600')}`}>{s.count}</span>
                    </button>
                  );
                })}
            </div>
        </div>

        {/* BENTO CARDS GRID */}
        {loadingEstabs && estabelecimentos.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {[1,2,3,4,5,6,7,8].map(i => <SkeletonCard key={i} themeClass={t} />)}
          </div>
        ) : filteredEstabs.length === 0 ? (
          <div className={`text-center py-20 rounded-[2rem] border shadow-sm transition-all duration-300 ${t.surface} ${t.border}`}>
            <div className={`w-16 h-16 border rounded-full mx-auto flex items-center justify-center mb-4 ${t.inputBg} ${t.border}`}>
              <FiHome className={`text-2xl ${t.textSecondary}`} />
            </div>
            <h3 className="text-lg font-bold font-bricolage tracking-tight">Não localizamos esta loja</h3>
            <p className={`${t.textSecondary} font-medium text-sm mt-1`}>Busque novamente ou adicione uma nova operação.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {filteredEstabs.map((estab, idx) => (
              <motion.div
                key={estab.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.05, 0.4) }}
                className={`rounded-[2rem] border flex flex-col overflow-hidden relative transition-all duration-300 ${t.cardBg} ${t.border} ${theme === 'dark' ? 'hover:bg-slate-900/50 hover:border-slate-700/50 hover:scale-[1.01] hover:shadow-[0_8px_32px_rgba(99,102,241,0.06)]' : 'hover:bg-white hover:border-stone-300/60 hover:scale-[1.01] hover:shadow-[0_8px_30px_rgba(99,102,241,0.02)]'}`}
              >
                {/* Header (Logo + Status Point) */}
                <div className="p-6 pb-4 flex items-start gap-4 relative">
                  <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center text-xl font-black overflow-hidden shrink-0 transition-colors duration-300 ${
                    theme === 'dark' ? 'bg-slate-900 border-white/5 text-slate-300' : 'bg-stone-105 border-stone-200 text-stone-750'
                  }`}>
                    {estab.imageUrl ? <img src={estab.imageUrl} alt={estab.nome} className="w-full h-full object-cover" /> : estab.nome?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="font-extrabold text-base leading-tight truncate font-space" title={estab.nome}>{estab.nome}</h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-500">
                      {estab.ativo ? <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> : <span className="w-2 h-2 rounded-full bg-rose-500"></span>}
                      <span className={estab.ativo ? 'text-emerald-500' : 'text-rose-500'}>{estab.ativo ? 'Operando' : 'Painel Suspenso'}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${
                        estab.tipoNegocio === 'varejo' ? 'bg-blue-500/10 text-blue-400 border-blue-500/25' :
                        estab.tipoNegocio === 'servicos' ? 'bg-purple-500/10 text-purple-400 border-purple-500/25' :
                        'bg-amber-500/10 text-yellow-500 border-yellow-500/25'
                      }`}>
                        {estab.tipoNegocio === 'varejo' ? 'Varejo' :
                         estab.tipoNegocio === 'servicos' ? 'Serviços' :
                         'Restaurante'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Main Information List Block */}
                <div className="px-6 pb-4 flex-1 flex flex-col justify-between font-space">
                  {/* Top content group */}
                  <div className="space-y-3">
                    {/* Link Routing */}
                    <div className="flex items-center gap-3">
                       <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors duration-300 ${theme==='dark' ? 'bg-slate-900 text-slate-450':'bg-stone-100 text-stone-500'}`}><FiLink className="text-[11px]" /></div>
                       <span className="text-xs font-bold truncate font-mono-jb text-indigo-400">/{estab.slug}</span>
                    </div>
                    
                    {/* Administrador Status */}
                    <div className="flex items-center gap-3">
                       <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors duration-300 ${theme==='dark' ? 'bg-slate-900 text-slate-450':'bg-stone-100 text-stone-500'}`}><FiShield className="text-[11px]" /></div>
                       <span className={`text-xs font-bold truncate ${estab.adminUID ? t.text : 'text-red-500'}`}>
                        {estab.adminUID ? 'Administrador Vinculado' : 'Sem Identificação (Órfão)'}
                       </span>
                    </div>

                    {/* Faturamento (Billing Date) */}
                    {(() => {
                      const nextBilling = estab.nextBillingDate;
                      if (!nextBilling) return (
                        <div className={`px-3 py-2 rounded-xl text-xs font-bold border ${theme==='dark' ? 'bg-slate-900/60 text-slate-400 border-white/5' : 'bg-stone-100 text-stone-600 border-stone-200'}`}>
                          💳 Cobrança automática inativa
                        </div>
                      );
                      const billingDate = nextBilling?.toDate ? nextBilling.toDate() : new Date(nextBilling);
                      const hoje = new Date(); hoje.setHours(0,0,0,0); billingDate.setHours(0,0,0,0);
                      const diff = Math.ceil((billingDate - hoje) / (1000*60*60*24));
                      const fmtDate = billingDate.toLocaleDateString('pt-BR');
                      
                      if (diff < 0) return (
                        <div className="bg-red-500/10 px-3 py-2 rounded-xl text-xs font-bold text-red-400 border border-red-500/20 flex items-center gap-2 font-mono-jb">
                          <span>🚨</span><span>Atrasada há {Math.abs(diff)}d ({fmtDate})</span>
                        </div>
                      );
                      if (diff <= 5) return (
                        <div className="bg-amber-500/10 px-3 py-2 rounded-xl text-xs font-bold text-amber-500 border border-amber-500/20 flex items-center gap-2 font-mono-jb">
                          <span>⏰</span><span>Vence em {diff}d ({fmtDate})</span>
                        </div>
                      );
                      return (
                        <div className="bg-emerald-500/10 px-3 py-2 rounded-xl text-xs font-bold text-emerald-400 border border-emerald-500/20 flex items-center gap-2 font-mono-jb">
                          <span>✅</span><span>Fatura paga. Próx: {fmtDate}</span>
                        </div>
                      );
                    })()}

                    {/* Certification Tracking */}
                    {(() => {
                      const certVal = estab.fiscal?.certificadoValidade;
                      if (!certVal) return null;
                      const certDate = certVal?.toDate ? certVal.toDate() : new Date(certVal);
                      const hoje = new Date();
                      hoje.setHours(0,0,0,0);
                      certDate.setHours(0,0,0,0);
                      const diff = Math.ceil((certDate - hoje) / (1000*60*60*24));
                      if (diff < 0) return (
                        <p className="text-xs font-black text-red-400 bg-red-500/10 rounded-xl px-3 flex justify-center py-2 border border-red-500/20 font-mono-jb">Certificado Vencido</p>
                      );
                      if (diff <= 30) return (
                        <p className="text-xs font-black text-orange-400 bg-orange-500/10 rounded-xl px-3 flex justify-center py-2 border border-orange-500/20 font-mono-jb">Certificado vence em {diff}d</p>
                      );
                      return null;
                    })()}
                  </div>

                  {/* WhatsApp e Chatbot Status */}
                  <div className={`pt-3 border-t mt-4 space-y-2.5 ${theme==='dark'?'border-white/5':'border-stone-200'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IoLogoWhatsapp className={`${estab.whatsapp?.ativo ? 'text-emerald-500' : 'text-slate-450'}`} size={16} />
                        <span className={`text-xs font-bold uppercase tracking-wider ${t.textMuted}`}>WhatsApp Status</span>
                      </div>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full ${estab.whatsapp?.ativo ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-white/5'}`}>
                        {estab.whatsapp?.ativo ? 'Conectado' : 'Offline'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded bg-slate-500/10 border border-white/5 flex items-center justify-center text-xs">🤖</div>
                        <span className={`text-xs font-bold uppercase tracking-wider ${t.textMuted}`}>Chatbot IA</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link 
                          to={`/admin/bot-pedidos?estabId=${estab.id}`}
                          className={`p-1 rounded transition-colors ${t.textSecondary} hover:text-cyan-400`}
                          title="Ir para configurações do chatbot"
                        >
                          <FiSettings size={14} />
                        </Link>
                        <button
                          onClick={() => toggleChatbotAtivo(estab.id, estab.botPedidos?.ativo || false, estab.nome)}
                          className={`w-9 h-5 rounded-full relative transition-colors ${estab.botPedidos?.ativo ? 'bg-emerald-500' : 'bg-slate-700'}`}
                          title={estab.botPedidos?.ativo ? "Desativar Chatbot IA" : "Ativar Chatbot IA"}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full shadow absolute top-0.5 transition-all ${estab.botPedidos?.ativo ? 'left-[18px]' : 'left-0.5'}`}></div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Dock */}
                <div className={`px-4 py-3 flex gap-2 border-t transition-colors duration-300 ${t.inputBg} ${t.border}`}>
                  <Link to={`/master/estabelecimentos/${estab.id}/editar`} 
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-sm ${t.buttonBg} ${t.border}`}>
                    <FiEdit3 size={13} /> Modificar
                  </Link>
                  <button onClick={() => toggleEstabelecimentoAtivo(estab.id, estab.ativo, estab.nome)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-95 border ${
                      estab.ativo 
                        ? (theme === 'dark' 
                            ? 'bg-slate-500/10 border-white/5 text-slate-400 hover:bg-slate-900 hover:border-cyan-500/30 hover:text-white' 
                            : 'bg-stone-100 border-stone-200 text-stone-500 hover:bg-stone-200 hover:border-stone-400 hover:text-stone-900') 
                        : (theme === 'dark'
                            ? 'bg-cyan-500/15 border-cyan-500/20 text-cyan-400 hover:bg-cyan-550 hover:text-white hover:border-transparent'
                            : 'bg-[#ff6b35] border-transparent text-white hover:bg-[#e85a2a]')
                    }`}
                    title={estab.ativo ? "Desativar (Bloquear Loja)" : "Ativar Operação"}>
                    {estab.ativo ? <FiPower size={14} /> : <FiCheck size={14} />}
                  </button>
                  <button onClick={() => handleDeleteEstabelecimento(estab.id, estab.nome)}
                    className={`w-10 h-10 rounded-xl border transition-all flex items-center justify-center shadow-sm active:scale-95 ${
                      theme === 'dark' ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white hover:border-transparent' : 'bg-white border-red-200 text-red-500 hover:bg-red-500 hover:text-white hover:border-transparent'
                    }`}
                    title="Remover Rede Permanentemente">
                    <FiTrash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* PAGINATION */}
        {filteredEstabs.length > 0 && (
          <div className="flex justify-between items-center py-6 relative z-10 font-space">
            <span className={`text-xs font-bold px-4 py-2.5 rounded-full shadow-sm border ${t.cardBg} ${t.border} ${t.text}`}>Lote {currentPage + 1}</span>
            <div className="flex gap-2">
              <button onClick={handlePreviousPage} disabled={!hasPrevious || loadingEstabs}
                className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-sm border disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 ${t.buttonBg} ${t.border}`}>
                <FiChevronLeft className="inline mb-0.5 mr-0.5" /> Antecessor
              </button>
              <button onClick={handleNextPage} disabled={!hasMore || loadingEstabs}
                className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-sm border disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 ${t.buttonBg} ${t.border}`}>
                Avançar Lote <FiChevronRight className="inline mb-0.5 ml-0.5" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ─── CUSTOM CONFIRMATION MODAL ─── */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop blur */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            
            {/* Modal Container */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className={`relative z-10 max-w-md w-full rounded-[2.5rem] border p-8 shadow-2xl ${
                theme === 'dark' ? 'bg-[#0b132b] border-white/10 text-white' : 'bg-white border-stone-200 text-stone-900'
              }`}
            >
              <div className="flex flex-col items-center text-center">
                {/* Icon */}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ${
                  confirmModal.isDanger 
                    ? 'bg-red-500/10 text-red-500' 
                    : (theme === 'dark' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-50 text-cyan-600')
                }`}>
                  <FiAlertCircle size={28} />
                </div>
                
                <h3 className="text-xl font-bold font-bricolage mb-3">
                  {confirmModal.title}
                </h3>
                
                <p className={`text-sm mb-8 leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-stone-600'}`}>
                  {confirmModal.message}
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <button
                    onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    className={`flex-1 py-3.5 rounded-full text-xs font-black uppercase tracking-wider transition-all border ${
                      theme === 'dark' ? 'bg-slate-900 border-white/5 text-slate-300 hover:text-white' : 'bg-stone-100 border-stone-200 text-stone-755 hover:bg-stone-200 hover:text-stone-900'
                    }`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      if (confirmModal.onConfirm) {
                        await confirmModal.onConfirm();
                      }
                      setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    }}
                    style={{ backgroundColor: confirmModal.isDanger ? '#ef4444' : (theme === 'dark' ? '#06b6d4' : '#1c1917') }}
                    className={`flex-1 py-3.5 rounded-full text-xs font-black uppercase tracking-wider transition-all text-white hover:opacity-90 active:scale-95`}
                  >
                    {confirmModal.confirmText}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ListarEstabelecimentos;