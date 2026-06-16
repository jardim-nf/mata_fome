import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query, addDoc, Timestamp, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  FiArrowLeft, FiLogOut, FiSun, FiMoon, FiSend, FiInbox,
  FiTrash2, FiClock, FiCheckCircle, FiAlertCircle, FiEye, FiActivity,
  FiVolume2, FiX, FiSearch, FiCheck
} from 'react-icons/fi';

// --- Loading Screen de Boot Simplificada ---
const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#080c16] text-slate-100 font-space">
    <div className="absolute inset-0 bg-cyber-grid-dark opacity-50 pointer-events-none" />
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute top-[20%] left-1/3 w-[300px] h-[300px] rounded-full bg-gradient-to-tr from-cyan-500/10 to-transparent blur-[80px]" />
      <div className="absolute bottom-[20%] right-1/3 w-[300px] h-[300px] rounded-full bg-gradient-to-tr from-violet-500/10 to-transparent blur-[80px]" />
    </div>
    <div className="relative z-10 flex flex-col items-center gap-6 text-center px-4">
      <div className="relative flex items-center justify-center w-24 h-24 rounded-3xl border border-white/5 bg-slate-950/40 backdrop-blur-xl shadow-2xl p-4">
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
        <p className="text-xs font-bold text-slate-400 animate-pulse">Carregando...</p>
      </div>
    </div>
  </div>
);

// ─── Skeleton Loaders (Bento Style) ───
const SkeletonMessageCard = ({ t, theme }) => (
  <div className={`p-6 rounded-[2rem] border animate-pulse flex flex-col justify-between h-80 ${t.cardBg} ${t.border} shadow-sm`}>
    <div>
      <div className="flex justify-between items-start mb-6">
        <div className={`w-12 h-12 rounded-2xl ${t.inputBg}`} />
        <div className={`w-28 h-5 rounded-full ${t.inputBg}`} />
      </div>
      <div className={`h-3 rounded-lg w-1/3 mb-4 ${t.inputBg}`} />
      <div className={`space-y-2 mb-6 p-4 rounded-2xl border border-dashed ${t.border} ${t.inputBg}`}>
        <div className={`h-3 rounded w-full ${theme === 'dark' ? 'bg-slate-800' : 'bg-stone-250'}`} />
        <div className={`h-3 rounded w-5/6 ${theme === 'dark' ? 'bg-slate-800' : 'bg-stone-250'}`} />
      </div>
    </div>
    <div className={`space-y-3 pt-4 border-t ${t.border}`}>
      <div className={`h-8 rounded-xl w-full ${t.inputBg}`} />
    </div>
  </div>
);

function MasterMensagens() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('dashboard_theme');
    return saved || 'dark';
  });

  const [avisosGerais, setAvisosGerais] = useState([]);
  const [campanhas, setCampanhas] = useState([]);
  const [estabMap, setEstabMap] = useState({});
  const [usuarios, setUsuarios] = useState([]);

  // Sub-estados de carregamento
  const [loadingEstab, setLoadingEstab] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingAvisos, setLoadingAvisos] = useState(true);
  const [loadingCampanhas, setLoadingCampanhas] = useState(true);

  // ID do aviso selecionado para exibição lateral em tempo real
  const [selectedAvisoId, setSelectedAvisoId] = useState(null);

  // Termo de busca para filtrar lojas no painel lateral
  const [searchTerm, setSearchTerm] = useState('');

  // Aba ativa de exibição no painel lateral: 'todas', 'lidas', 'pendentes'
  const [readingTab, setReadingTab] = useState('todas');

  // Megafone State
  const [modalMegafone, setModalMegafone] = useState(false);
  const [loadingMegafone, setLoadingMegafone] = useState(false);
  const [novoAviso, setNovoAviso] = useState({ titulo: '', mensagem: '', tipo: 'info', alvo: 'todos' });

  // Detail Drawer State (fallback opcional/legado)
  const [selectedAvisoLeitura, setSelectedAvisoLeitura] = useState(null);

  // Custom Confirmation Modal
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    isDanger: false,
    onConfirm: null
  });

  // Injetar Fontes
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@300;400;500;650;700&display=swap';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Sync theme
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

  // Seta o título para SEO
  useEffect(() => {
    document.title = "IdeaFood - Hub de Mensagens Master";
  }, []);

  // Ouvinte em tempo real para estabelecimentos
  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return;
    const unsubEstab = onSnapshot(collection(db, 'estabelecimentos'), (snapshot) => {
      const emap = {};
      snapshot.forEach(d => {
        emap[d.id] = d.data().nome || d.id;
      });
      setEstabMap(emap);
      setLoadingEstab(false);
    }, (err) => {
      console.error("Erro ao escutar estabelecimentos:", err);
      setLoadingEstab(false);
    });
    return () => unsubEstab();
  }, [currentUser, isMasterAdmin]);

  // Ouvinte em tempo real para usuários
  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return;
    const unsubUser = onSnapshot(collection(db, 'usuarios'), (snapshot) => {
      const uList = [];
      snapshot.forEach(d => {
        uList.push({ id: d.id, ...d.data() });
      });
      setUsuarios(uList);
      setLoadingUsers(false);
    }, (err) => {
      console.error("Erro ao escutar usuários:", err);
      setLoadingUsers(false);
    });
    return () => unsubUser();
  }, [currentUser, isMasterAdmin]);

  // Ouvinte em tempo real para avisos gerais (Megafone)
  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return;
    const unsubAvisos = onSnapshot(collection(db, 'avisos_gerais'), (snapshot) => {
      const avisosData = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        _path: 'global',
        isAvisoGeral: true
      }));
      setAvisosGerais(avisosData);
      setLoadingAvisos(false);
    }, (err) => {
      console.error("Erro ao escutar avisos gerais:", err);
      setLoadingAvisos(false);
    });
    return () => unsubAvisos();
  }, [currentUser, isMasterAdmin]);

  // Carregar campanhas enviadas pelas lojas em segundo plano
  useEffect(() => {
    const fetchCampanhas = async () => {
      const estabIds = Object.keys(estabMap);
      if (estabIds.length === 0) {
        setLoadingCampanhas(false);
        return;
      }
      try {
        const campPromises = estabIds.map(async (estabId) => {
          try {
            const campRef = collection(db, 'estabelecimentos', estabId, 'campanhas');
            const campSnap = await getDocs(campRef);
            return campSnap.docs.map(d => ({
              id: d.id,
              ...d.data(),
              _path: d.ref.path
            }));
          } catch (err) {
            console.error(`Erro ao carregar campanhas para o estabelecimento ${estabId}:`, err);
            return [];
          }
        });
        const campResults = await Promise.all(campPromises);
        setCampanhas(campResults.flat());
      } catch (err) {
        console.error("Erro geral buscando campanhas:", err);
      } finally {
        setLoadingCampanhas(false);
      }
    };

    if (!loadingEstab) {
      fetchCampanhas();
    }
  }, [estabMap, loadingEstab]);

  // Lista combinada e ordenada de mensagens
  const mensagens = useMemo(() => {
    const combined = [...campanhas, ...avisosGerais];
    combined.sort((a, b) => {
      const dA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
      const dB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
      return dB - dA;
    });
    return combined;
  }, [campanhas, avisosGerais]);

  const loading = loadingEstab || loadingUsers || loadingAvisos || loadingCampanhas;

  // Seleção automática do aviso geral mais recente para o painel lateral
  const latestAvisoGeral = useMemo(() => {
    const list = mensagens.filter(m => m.isAvisoGeral);
    return list.length > 0 ? list[0] : null;
  }, [mensagens]);

  useEffect(() => {
    if (!selectedAvisoId && latestAvisoGeral) {
      setSelectedAvisoId(latestAvisoGeral.id);
    }
  }, [selectedAvisoId, latestAvisoGeral]);

  useEffect(() => {
    if (selectedAvisoId && avisosGerais.length > 0) {
      const exists = avisosGerais.some(a => a.id === selectedAvisoId);
      if (!exists && latestAvisoGeral) {
        setSelectedAvisoId(latestAvisoGeral.id);
      }
    }
  }, [selectedAvisoId, avisosGerais, latestAvisoGeral]);

  const selectedAvisoObj = useMemo(() => {
    return avisosGerais.find(a => a.id === selectedAvisoId) || latestAvisoGeral;
  }, [selectedAvisoId, avisosGerais, latestAvisoGeral]);

  const dispararMegafone = async (e) => {
    e.preventDefault();
    if (!novoAviso.titulo || !novoAviso.mensagem) return toast.warn("Preencha título e mensagem.");
    
    setLoadingMegafone(true);
    try {
      await addDoc(collection(db, 'avisos_gerais'), {
        titulo: novoAviso.titulo,
        mensagem: novoAviso.mensagem,
        tipo: novoAviso.tipo,
        alvo: novoAviso.alvo,
        ativo: true,
        createdAt: Timestamp.now()
      });
      toast.success("Broadcast disparado com sucesso!");
      setModalMegafone(false);
      setNovoAviso({ titulo: '', mensagem: '', tipo: 'info', alvo: 'todos' });
    } catch (err) {
      console.error("Erro disparar megafone:", err);
      toast.error("Erro: " + (err.message || "ao disparar aviso"));
    } finally {
      setLoadingMegafone(false);
    }
  };

  const handleExcluirMensagem = (id, isAvisoGeral) => {
    if (!isAvisoGeral) return toast.info("Só é possível excluir avisos globais por aqui.");
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Aviso Geral',
      message: 'Tem certeza que deseja excluir este aviso para todos? Esta ação é irreversível e o aviso desaparecerá dos painéis dos estabelecimentos.',
      confirmText: 'Excluir Aviso',
      isDanger: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'avisos_gerais', id));
          toast.success("Aviso excluído com sucesso!");
        } catch (err) {
          console.error(err);
          toast.error("Erro ao excluir o aviso.");
        }
      }
    });
  };

  const getLeiturasAviso = (avisoId, alvo) => {
    const estabsAlvo = alvo === 'todos' 
      ? Object.keys(estabMap) 
      : [alvo];
      
    const lidos = [];
    const pendentes = [];
    
    estabsAlvo.forEach(estabId => {
      const usersDeEstab = usuarios.filter(u => u.estabelecimentoIdPrincipal === estabId || u.estabelecimentoId === estabId || (Array.isArray(u.estabelecimentosGerenciados) && u.estabelecimentosGerenciados.includes(estabId)));
      const userQueLeu = usersDeEstab.find(u => Array.isArray(u.avisosLidos) && u.avisosLidos.includes(avisoId));
      
      if (userQueLeu) {
        lidos.push({
          estabId,
          nomeLoja: estabMap[estabId] || estabId,
          leitor: userQueLeu.nome || userQueLeu.displayName || userQueLeu.email?.split('@')[0] || 'Admin'
        });
      } else {
        pendentes.push({
          estabId,
          nomeLoja: estabMap[estabId] || estabId
        });
      }
    });
    
    return { lidos, pendentes };
  };

  // Leituras do aviso selecionado para exibição lateral em tempo real
  const selectedAvisoLeituras = useMemo(() => {
    if (!selectedAvisoObj) return { lidos: [], pendentes: [] };
    return getLeiturasAviso(selectedAvisoObj.id, selectedAvisoObj.alvo);
  }, [selectedAvisoObj, usuarios, estabMap]);

  const stats = useMemo(() => {
    const totalBroadcasts = avisosGerais.length;
    const totalCampanhas = campanhas.length;
    const totalLojas = Object.keys(estabMap).length;
    
    let totalPossivelConfirmacoes = 0;
    let totalConfirmacoesLeitura = 0;
    
    avisosGerais.forEach(msg => {
      const leituras = getLeiturasAviso(msg.id, msg.alvo);
      totalPossivelConfirmacoes += (leituras.lidos.length + leituras.pendentes.length);
      totalConfirmacoesLeitura += leituras.lidos.length;
    });
    
    const taxaVisualizacao = totalPossivelConfirmacoes > 0 
      ? Math.round((totalConfirmacoesLeitura / totalPossivelConfirmacoes) * 100) 
      : 0;
      
    return {
      totalBroadcasts,
      totalCampanhas,
      totalLojas,
      taxaVisualizacao
    };
  }, [campanhas, avisosGerais, estabMap, usuarios]);

  const themeClasses = {
    dark: {
      bg: 'bg-[#080c16] bg-cyber-grid-dark text-slate-100',
      surface: 'bg-slate-950/45 backdrop-blur-xl border border-white/5 shadow-2xl',
      border: 'border-white/5',
      text: 'text-slate-100 font-space',
      textSecondary: 'text-slate-400 font-space font-medium',
      textMuted: 'text-slate-500 font-space font-semibold',
      accent: 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]',
      cardBg: 'bg-slate-950/30 backdrop-blur-xl border border-white/5 shadow-2xl',
      inputBg: 'bg-slate-950/30 border-white/10 text-slate-100 focus:border-cyan-500/50 focus:bg-slate-950/50 focus:ring-1 focus:ring-cyan-500/30',
      modalBg: 'bg-[#0b101d] border-white/5 text-slate-100 shadow-2xl',
      modalHeaderBg: 'bg-slate-950/30 border-white/5'
    },
    light: {
      bg: 'bg-[#fbfbfa] bg-cyber-grid-light text-stone-900',
      surface: 'bg-white/95 backdrop-blur-md border border-stone-200 shadow-md',
      border: 'border-stone-200',
      text: 'text-stone-900 font-space font-bold',
      textSecondary: 'text-stone-700 font-space font-medium',
      textMuted: 'text-stone-400 font-space font-semibold',
      accent: 'bg-[#ff6b35] text-white',
      cardBg: 'bg-[#f5f5f4]/80 backdrop-blur-md border border-stone-200 shadow-sm',
      inputBg: 'bg-[#f5f5f4] border-stone-200 text-stone-900 focus:border-stone-400 focus:bg-white focus:ring-1 focus:ring-stone-400/30',
      modalBg: 'bg-white border-stone-200 text-stone-900 shadow-xl',
      modalHeaderBg: 'bg-stone-50 border-stone-200'
    }
  };

  const t = themeClasses[theme];

  if (authLoading) return <LoadingScreen />;

  if (!isMasterAdmin) {
    return (
      <div className="p-10 text-center text-red-500 min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <FiAlertCircle size={48} className="mb-4" />
        <h2 className="text-xl font-bold">Acesso Negado</h2>
        <p className="text-sm text-gray-400 mt-2">Você não possui credenciais administrativas corporativas.</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-space transition-colors duration-500 pb-24 pt-4 px-4 sm:px-8 lg:px-12 relative overflow-hidden ${t.bg}`}>
      {/* Glow effects */}
      <div className="absolute top-[-10%] left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-cyan-500/10 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-violet-500/10 to-transparent blur-[120px] pointer-events-none" />

      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className={`max-w-[1800px] mx-auto ${t.surface} rounded-3xl h-16 flex items-center justify-between px-6 sticky top-4 z-40 transition-all`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/master-dashboard')} 
            className={`w-9 h-9 ${theme === 'dark' ? 'bg-slate-900 hover:bg-slate-800' : 'bg-stone-100 hover:bg-stone-250'} border ${t.border} rounded-xl flex items-center justify-center transition-colors`}
          >
            <FiArrowLeft className={`${t.textSecondary} text-sm`} />
          </button>
          <div className="border-l border-slate-700/30 pl-4">
            <h1 className={`font-semibold text-sm tracking-tight ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>Rede Neural de Mensagens</h1>
            <p className={`text-xs ${t.textSecondary} font-semibold uppercase`}>
              {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-xl ${theme === 'dark' ? 'bg-slate-900 border-white/10 hover:text-white' : 'bg-stone-100 border-stone-200 hover:text-stone-900'} border ${t.textSecondary} transition-all`}
          >
            {theme === 'dark' ? <FiSun size={16} /> : <FiMoon size={16} />}
          </button>
          <div className="w-px h-6 bg-slate-700/30" />
          <button 
            onClick={async () => { await logout(); navigate('/'); }} 
            className="w-9 h-9 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 rounded-xl flex items-center justify-center transition-colors"
          >
            <FiLogOut className="text-red-500" size={16} />
          </button>
        </div>
      </nav>

      {/* HEADER DA PÁGINA */}
      <main className="max-w-[1800px] mx-auto mt-8 relative z-10 px-2 sm:px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 px-2">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`inline-block border ${t.border} ${theme === 'dark' ? 'bg-slate-900' : 'bg-stone-100'} ${t.textSecondary} text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full`}>
                CRM & Disparos da Rede
              </span>
            </div>
            <h2 className={`text-4xl font-extrabold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>Campanhas da Rede</h2>
            <p className={`${t.textSecondary} text-sm mt-1 font-medium`}>
              Acompanhe os disparos de marketing dos franqueados e gerencie os avisos administrativos globais.
            </p>
          </div>
          <button 
            onClick={() => setModalMegafone(true)}
            className={`bg-gradient-to-r ${theme === 'dark' ? 'from-cyan-500 to-blue-600 shadow-[0_0_15px_rgba(6,182,212,0.3)]' : 'from-[#ff6b35] to-amber-600'} text-white px-6 py-3.5 rounded-2xl font-bold text-sm shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2`}
          >
            <FiVolume2 size={16} className="animate-pulse" />
            Disparar Megafone
          </button>
        </div>

        {/* KPI BENTO GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 px-2">
          {/* Card 1: Megafone Broadcasts */}
          <motion.div
            whileHover={{ scale: 1.01, y: -4 }}
            className={`relative overflow-hidden p-6 rounded-[2rem] border transition-all duration-300 ${t.cardBg} ${t.border} shadow-sm`}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-bl-full pointer-events-none" />
            <div className="flex justify-between items-center mb-4">
              <span className={`text-xs font-black uppercase tracking-widest ${t.textMuted}`}>Canais Master</span>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shadow-inner">
                <FiVolume2 size={18} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold tracking-tight font-mono ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>
                {loading ? <div className={`h-8 w-16 rounded-lg animate-pulse ${theme === 'dark' ? 'bg-slate-800' : 'bg-stone-250'}`} /> : stats.totalBroadcasts}
              </span>
            </div>
            <h3 className={`text-sm font-bold mt-2 ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>Megafone Global</h3>
            <p className={`text-xs ${t.textSecondary} mt-0.5`}>Avisos corporativos ativos</p>
          </motion.div>

          {/* Card 2: Campanhas de Lojas */}
          <motion.div
            whileHover={{ scale: 1.01, y: -4 }}
            className={`relative overflow-hidden p-6 rounded-[2rem] border transition-all duration-300 ${t.cardBg} ${t.border} shadow-sm`}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-bl-full pointer-events-none" />
            <div className="flex justify-between items-center mb-4">
              <span className={`text-xs font-black uppercase tracking-widest ${t.textMuted}`}>Marketing</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-inner">
                <FiSend size={18} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold tracking-tight font-mono ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>
                {loading ? <div className={`h-8 w-16 rounded-lg animate-pulse ${theme === 'dark' ? 'bg-slate-800' : 'bg-stone-250'}`} /> : stats.totalCampanhas}
              </span>
            </div>
            <h3 className={`text-sm font-bold mt-2 ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>Campanhas Criadas</h3>
            <p className={`text-xs ${t.textSecondary} mt-0.5`}>Disparadas pelas franquias</p>
          </motion.div>

          {/* Card 3: Lojas Parceiras */}
          <motion.div
            whileHover={{ scale: 1.01, y: -4 }}
            className={`relative overflow-hidden p-6 rounded-[2rem] border transition-all duration-300 ${t.cardBg} ${t.border} shadow-sm`}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-500/10 to-transparent rounded-bl-full pointer-events-none" />
            <div className="flex justify-between items-center mb-4">
              <span className={`text-xs font-black uppercase tracking-widest ${t.textMuted}`}>Estabelecimentos</span>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500 shadow-inner">
                <FiActivity size={18} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold tracking-tight font-mono ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>
                {loading ? <div className={`h-8 w-16 rounded-lg animate-pulse ${theme === 'dark' ? 'bg-slate-800' : 'bg-stone-250'}`} /> : stats.totalLojas}
              </span>
            </div>
            <h3 className={`text-sm font-bold mt-2 ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>Lojas Integradas</h3>
            <p className={`text-xs ${t.textSecondary} mt-0.5`}>Parceiras no ecossistema</p>
          </motion.div>

          {/* Card 4: Engajamento / Taxa de Leitura */}
          <motion.div
            whileHover={{ scale: 1.01, y: -4 }}
            className={`relative overflow-hidden p-6 rounded-[2rem] border transition-all duration-300 ${t.cardBg} ${t.border} shadow-sm`}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-bl-full pointer-events-none" />
            <div className="flex justify-between items-center mb-4">
              <span className={`text-xs font-black uppercase tracking-widest ${t.textMuted}`}>Visualização</span>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
                <FiCheckCircle size={18} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold tracking-tight font-mono ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>
                {loading ? <div className={`h-8 w-16 rounded-lg animate-pulse ${theme === 'dark' ? 'bg-slate-800' : 'bg-stone-250'}`} /> : `${stats.taxaVisualizacao}%`}
              </span>
            </div>
            <h3 className={`text-sm font-bold mt-2 ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>Confirmado / Lido</h3>
            <p className={`text-xs ${t.textSecondary} mt-0.5`}>Média global de leitura</p>
          </motion.div>
        </div>

        {/* ─── SPLIT SECTION LAYOUT ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 px-2">
          {/* COLUNA ESQUERDA: LISTAGEM DE MENSAGENS (3/5) */}
          <div className="lg:col-span-3 space-y-6">
            <h3 className={`text-lg font-bold tracking-tight px-1 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>
              <FiInbox /> Linha do Tempo de Avisos & Envios
            </h3>
            
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...Array(4)].map((_, i) => (
                  <SkeletonMessageCard key={i} t={t} theme={theme} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {mensagens.length > 0 ? (
                  mensagens.map(msg => {
                    const dDate = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date();
                    let estabId = 'desconhecido';
                    let realNome = 'Aviso / Megafone Global';
                    
                    if (!msg.isAvisoGeral) {
                      if (msg._path) {
                        const parts = msg._path.split('/');
                        const idx = parts.indexOf('estabelecimentos');
                        if (idx >= 0) estabId = parts[idx+1];
                      }
                      realNome = estabMap[estabId] || estabId;
                    } else if (msg.alvo && msg.alvo !== 'todos') {
                      realNome = `Aviso para: ${estabMap[msg.alvo] || msg.alvo}`;
                    }

                    const formattedType = msg.isAvisoGeral ? 'Aviso Master (Megafone)' : (msg.tipo ? msg.tipo.replace(/_/g, ' ') : 'Campanha de Marketing');
                    
                    // Para aviso geral, calcular leituras
                    let leituras = null;
                    if (msg.isAvisoGeral) {
                      leituras = getLeiturasAviso(msg.id, msg.alvo);
                    }

                    const isAviso = msg.isAvisoGeral;
                    const isSelected = selectedAvisoId === msg.id;

                    let cardAccentClass = isSelected 
                      ? (theme === 'dark' ? 'border-cyan-500 ring-2 ring-cyan-500/25 bg-cyan-950/10' : 'border-[#ff6b35] ring-2 ring-[#ff6b35]/25 bg-[#ff6b35]/5')
                      : "hover:border-cyan-500/20";
                    let textAccentClass = "text-cyan-500";
                    let bgAccentClass = "bg-cyan-500/10 text-cyan-500";
                    
                    if (isAviso) {
                      if (msg.tipo === 'urgente') {
                        if (!isSelected) cardAccentClass = "hover:border-rose-500/20";
                        textAccentClass = "text-rose-500";
                        bgAccentClass = "bg-rose-500/10 text-rose-500";
                      } else if (msg.tipo === 'dica') {
                        if (!isSelected) cardAccentClass = "hover:border-amber-500/20";
                        textAccentClass = "text-amber-500";
                        bgAccentClass = "bg-amber-500/10 text-amber-500";
                      } else {
                        if (!isSelected) cardAccentClass = "hover:border-blue-500/20";
                        textAccentClass = "text-blue-500";
                        bgAccentClass = "bg-blue-500/10 text-blue-500";
                      }
                    }

                    return (
                      <motion.div 
                        key={msg.id} 
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        onClick={() => {
                          if (isAviso) {
                            setSelectedAvisoId(msg.id);
                          }
                        }}
                        className={`${t.cardBg} border ${t.border} ${cardAccentClass} p-6 rounded-[2rem] transition-all duration-350 relative group flex flex-col justify-between ${isAviso ? 'cursor-pointer' : ''}`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <div className={`w-12 h-12 rounded-2xl ${t.inputBg} border ${t.border} flex items-center justify-center ${textAccentClass} ${bgAccentClass} shadow-inner`}>
                              {isAviso ? <FiVolume2 size={20} /> : <FiSend size={18} />}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold px-3 py-1 rounded-full border font-mono ${
                                theme === 'dark' ? 'border-slate-800 bg-slate-950/40 text-slate-400' : 'border-stone-250 bg-stone-100 text-stone-600'
                              }`}>
                                {format(dDate, "dd/MM/yyyy HH:mm")}
                              </span>
                              {msg.isAvisoGeral && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleExcluirMensagem(msg.id, msg.isAvisoGeral);
                                  }} 
                                  className="text-red-400 hover:text-red-500 p-2 rounded-xl hover:bg-red-500/10 transition-colors"
                                  title="Excluir aviso geral"
                                >
                                  <FiTrash2 size={15} />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mb-3">
                            <h3 className={`text-xs font-black uppercase tracking-widest ${textAccentClass}`} title={formattedType}>
                              {formattedType}
                            </h3>
                            {isAviso && (
                              <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full border ${
                                msg.alvo === 'todos' 
                                  ? 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border-indigo-500/20' 
                                  : 'bg-purple-500/10 text-purple-500 dark:text-purple-400 border-purple-500/20'
                              }`}>
                                {msg.alvo === 'todos' ? 'Global' : 'Direcionado'}
                              </span>
                            )}
                          </div>
                          
                          <div className={`p-4 rounded-2xl mb-4 border ${t.border} ${t.inputBg} border-dashed`}>
                            {isAviso && (
                              <h4 className={`text-sm font-bold mb-1.5 ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>{msg.titulo || 'Aviso sem Título'}</h4>
                            )}
                            <p className={`text-sm font-medium leading-relaxed ${t.textSecondary} whitespace-pre-wrap line-clamp-5`}>
                              {msg.texto || msg.mensagem || 'Conteúdo inativo ou em branco...'}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-slate-700/20">
                          <div>
                            <p className={`text-xs uppercase font-bold tracking-widest ${t.textMuted} mb-1`}>Remetente / Alvo</p>
                            <p className={`text-xs font-bold truncate ${theme === 'dark' ? 'bg-slate-950/40 text-slate-355 border-white/5' : 'bg-stone-150 text-stone-700 border-stone-250'} px-3 py-2 rounded-xl border`}>
                              {realNome}
                            </p>
                          </div>

                          {/* Indicador de Seleção / Visualização */}
                          {msg.isAvisoGeral && leituras && (
                            <div className="flex items-center justify-between mt-3 pt-2">
                              <span className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border ${
                                isSelected 
                                  ? (theme === 'dark' ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400' : 'border-[#ff6b35]/30 bg-[#ff6b35]/10 text-[#ff6b35]')
                                  : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                              } font-bold text-xs transition-colors`}>
                                <FiEye size={12} />
                                Confirmados: {leituras.lidos.length} de {leituras.lidos.length + leituras.pendentes.length}
                              </span>
                              
                              {isSelected ? (
                                <span className={`text-xs font-bold flex items-center gap-1 ${theme === 'dark' ? 'text-cyan-400' : 'text-[#ff6b35]'}`}>
                                  <FiActivity className="animate-pulse" /> Ativo
                                </span>
                              ) : (
                                <span className={`text-xs font-bold font-mono ${t.textSecondary}`}>
                                  {Math.round((leituras.lidos.length / (leituras.lidos.length + leituras.pendentes.length || 1)) * 100)}%
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                ) : (
                  <div className={`col-span-full py-20 text-center ${t.cardBg} border ${t.border} rounded-[2rem] shadow-sm`}>
                    <div className={`w-16 h-16 ${t.inputBg} border ${t.border} rounded-full mx-auto flex items-center justify-center mb-4`}>
                      <FiInbox className={`text-2xl ${t.textSecondary}`} />
                    </div>
                    <h3 className={`text-lg font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>Sem Envios Recentes</h3>
                    <p className={`${t.textSecondary} font-medium text-sm mt-1`}>Nenhuma loja registrou disparos até o momento.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* COLUNA DIREITA: PAINEL DE LEITURA EM TEMPO REAL (2/5) */}
          <div className="lg:col-span-2">
            <div className={`p-6 rounded-[2rem] border ${t.cardBg} ${t.border} shadow-lg sticky top-24 transition-all duration-300`}>
              <div className="flex items-center justify-between mb-4 border-b border-slate-700/20 pb-4">
                <div>
                  <h3 className={`text-base font-extrabold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>
                    Confirmação dos Clientes
                  </h3>
                  <p className={`text-xs ${t.textSecondary} mt-0.5`}>Sincronizado em tempo real</p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-bold font-mono">
                  <FiActivity className="animate-pulse" /> Ao Vivo
                </div>
              </div>

              {selectedAvisoObj ? (
                <div>
                  {/* Selected aviso summary */}
                  <div className={`p-4 rounded-2xl border ${t.border} ${t.inputBg} mb-5 relative group`}>
                    <span className={`text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-full border mb-2 inline-block ${
                      selectedAvisoObj.tipo === 'urgente' 
                        ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' 
                        : (selectedAvisoObj.tipo === 'dica' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20')
                    }`}>
                      {selectedAvisoObj.tipo === 'urgente' ? '🚨 Urgente' : (selectedAvisoObj.tipo === 'dica' ? '💡 Dica' : '💬 Informativo')}
                    </span>
                    <h4 className={`text-sm font-extrabold mb-1.5 ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>
                      {selectedAvisoObj.titulo}
                    </h4>
                    <p className={`text-xs leading-relaxed ${t.textSecondary} line-clamp-3 whitespace-pre-wrap`}>
                      {selectedAvisoObj.texto || selectedAvisoObj.mensagem}
                    </p>
                  </div>

                  {/* Progress Stats */}
                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between items-end text-xs font-bold">
                      <span className={t.textSecondary}>Taxa de Leitura Coletiva</span>
                      <span className="font-mono text-emerald-500">
                        {selectedAvisoLeituras.lidos.length} / {selectedAvisoLeituras.lidos.length + selectedAvisoLeituras.pendentes.length} Lojas
                      </span>
                    </div>
                    <div className={`h-2.5 w-full rounded-full ${theme === 'dark' ? 'bg-slate-900' : 'bg-stone-200'} overflow-hidden border ${t.border}`}>
                      <motion.div 
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
                        initial={{ width: 0 }}
                        animate={{ 
                          width: `${Math.round((selectedAvisoLeituras.lidos.length / (selectedAvisoLeituras.lidos.length + selectedAvisoLeituras.pendentes.length || 1)) * 100)}%` 
                        }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <div className="flex justify-between text-xs font-bold text-slate-500">
                      <span>0%</span>
                      <span>{Math.round((selectedAvisoLeituras.lidos.length / (selectedAvisoLeituras.lidos.length + selectedAvisoLeituras.pendentes.length || 1)) * 100)}% Lido</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Search and Filters */}
                  <div className="space-y-3 mb-5">
                    {/* Search Input */}
                    <div className="relative">
                      <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                      <input 
                        type="text"
                        placeholder="Buscar loja..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-xs font-semibold outline-none transition-all ${t.inputBg}`}
                      />
                    </div>

                    {/* Tabs */}
                    <div className={`flex p-1 rounded-xl ${theme === 'dark' ? 'bg-slate-950/60' : 'bg-stone-100'} border ${t.border}`}>
                      <button
                        onClick={() => setReadingTab('todas')}
                        className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                          readingTab === 'todas'
                            ? (theme === 'dark' ? 'bg-slate-800 text-white shadow-md font-extrabold' : 'bg-white text-stone-900 shadow-sm font-extrabold')
                            : `${t.textSecondary} hover:text-slate-400`
                        }`}
                      >
                        Todas ({selectedAvisoLeituras.lidos.length + selectedAvisoLeituras.pendentes.length})
                      </button>
                      <button
                        onClick={() => setReadingTab('lidas')}
                        className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                          readingTab === 'lidas'
                            ? 'bg-emerald-500/10 text-emerald-500 shadow-inner font-extrabold'
                            : `${t.textSecondary} hover:text-slate-400`
                        }`}
                      >
                        Lidas ({selectedAvisoLeituras.lidos.length})
                      </button>
                      <button
                        onClick={() => setReadingTab('pendentes')}
                        className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                          readingTab === 'pendentes'
                            ? (theme === 'dark' ? 'bg-slate-800 text-slate-300 font-extrabold' : 'bg-white text-stone-700 shadow-sm font-extrabold')
                            : `${t.textSecondary} hover:text-slate-400`
                        }`}
                      >
                        Pendentes ({selectedAvisoLeituras.pendentes.length})
                      </button>
                    </div>
                  </div>

                  {/* List of client cards */}
                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                    <AnimatePresence mode="popLayout">
                      {(() => {
                        let list = [];
                        if (readingTab === 'todas' || readingTab === 'lidas') {
                          list = list.concat(selectedAvisoLeituras.lidos.map(l => ({ ...l, read: true })));
                        }
                        if (readingTab === 'todas' || readingTab === 'pendentes') {
                          list = list.concat(selectedAvisoLeituras.pendentes.map(p => ({ ...p, read: false })));
                        }

                        // Apply Search Filter
                        if (searchTerm.trim() !== '') {
                          const query = searchTerm.toLowerCase();
                          list = list.filter(item => item.nomeLoja.toLowerCase().includes(query));
                        }

                        // Sort list: Pendentes first, then alphabetical
                        list.sort((a, b) => {
                          if (a.read !== b.read) {
                            return a.read ? 1 : -1;
                          }
                          return a.nomeLoja.localeCompare(b.nomeLoja);
                        });

                        if (list.length === 0) {
                          return (
                            <div className="text-center py-8 text-xs text-slate-500 font-bold">
                              Nenhum estabelecimento encontrado.
                            </div>
                          );
                        }

                        return list.map(item => (
                          <motion.div
                            layout
                            key={item.estabId}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                              item.read
                                ? (theme === 'dark' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-450' : 'bg-emerald-50/70 border-emerald-200 text-emerald-800')
                                : (theme === 'dark' ? 'bg-slate-900/30 border-white/5 text-slate-300' : 'bg-stone-50 border-stone-200 text-stone-700')
                            }`}
                          >
                            <div className="truncate pr-2">
                              <p className="text-xs font-bold truncate">{item.nomeLoja}</p>
                              {item.read ? (
                                <p className="text-xs text-emerald-500/80 font-bold mt-0.5 flex items-center gap-1">
                                  <span>Lido por: {item.leitor}</span>
                                </p>
                              ) : (
                                <p className="text-xs text-slate-550 font-semibold mt-0.5">
                                  Aguardando confirmação...
                                </p>
                              )}
                            </div>

                            {item.read ? (
                              <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-500 px-2.5 py-1 rounded-full border border-emerald-500/20 shrink-0 font-mono text-xs font-black uppercase tracking-wider animate-pulse">
                                <FiCheck size={12} /> Confirmado
                              </div>
                            ) : (
                              <div className={`flex items-center gap-1 bg-slate-500/10 ${t.textMuted} px-2.5 py-1 rounded-full border border-slate-750/20 shrink-0 font-mono text-xs font-black uppercase tracking-wider`}>
                                <FiClock size={12} /> Pendente
                              </div>
                            )}
                          </motion.div>
                        ));
                      })()}
                    </AnimatePresence>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-slate-500 font-medium text-xs">
                  <FiAlertCircle size={28} className="mx-auto mb-2 text-slate-600" />
                  Nenhum aviso geral ativo selecionado.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* DRAWER LATERAL DE DETALHES DE LEITURA (Legado/Fallback) */}
      <AnimatePresence>
        {selectedAvisoLeitura && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
              onClick={() => setSelectedAvisoLeitura(null)}
            />

            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className={`w-screen max-w-md border-l ${t.border} ${t.modalBg} flex flex-col justify-between shadow-2xl relative overflow-hidden`}
              >
                <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />

                {/* Header */}
                <div className={`p-6 border-b ${t.border} relative z-10 ${theme === 'dark' ? 'bg-slate-950/20' : 'bg-stone-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>Relatório de Leitura</h3>
                    <button
                      onClick={() => setSelectedAvisoLeitura(null)}
                      className={`p-2.5 rounded-xl border transition-colors ${theme === 'dark' ? 'bg-slate-900 border-white/10 hover:text-white' : 'bg-stone-100 border-stone-250 hover:text-stone-900'} ${t.textSecondary}`}
                    >
                      <FiX size={16} />
                    </button>
                  </div>
                  <p className={`text-xs font-bold uppercase tracking-wider ${t.textMuted}`}>Controle de Megafone Global</p>

                  <div className={`mt-4 p-4 rounded-2xl border border-dashed ${t.border} ${t.inputBg}`}>
                    <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${t.textMuted}`}>Mensagem Enviada</p>
                    <h4 className={`text-sm font-bold mb-1 line-clamp-1 ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>{selectedAvisoLeitura.titulo}</h4>
                    <p className={`text-xs ${t.textSecondary} line-clamp-2`}>{selectedAvisoLeitura.mensagem}</p>
                  </div>

                  {/* Estatísticas Rápidas */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                      <span className="block text-xs font-bold text-emerald-500 uppercase">Confirmado</span>
                      <span className="text-xl font-bold text-emerald-500 font-mono">{selectedAvisoLeitura.lidos.length}</span>
                    </div>
                    <div className={`p-3 rounded-xl border ${theme === 'dark' ? 'bg-slate-900/40' : 'bg-stone-100/50'} ${t.border}`}>
                      <span className={`block text-xs font-bold uppercase ${t.textMuted}`}>Pendente</span>
                      <span className={`text-xl font-bold font-mono ${t.textSecondary}`}>{selectedAvisoLeitura.pendentes.length}</span>
                    </div>
                  </div>
                </div>

                {/* List Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10 custom-scrollbar">
                  {/* Lidas */}
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-emerald-500 mb-3 flex items-center gap-1.5">
                      <FiCheckCircle size={12} />
                      Lojas Confirmadas ({selectedAvisoLeitura.lidos.length})
                    </h4>
                    {selectedAvisoLeitura.lidos.length > 0 ? (
                      <div className="space-y-2">
                        {selectedAvisoLeitura.lidos.map(item => (
                          <div key={item.estabId} className={`p-3 rounded-xl border flex items-center justify-between ${theme === 'dark' ? 'bg-slate-900/30 border-white/5' : 'bg-stone-50 border-stone-200'}`}>
                            <div className="truncate pr-2">
                              <p className={`text-xs font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>{item.nomeLoja}</p>
                              <p className="text-xs text-emerald-500 font-semibold mt-0.5">Lido por: {item.leitor}</p>
                            </div>
                            <span className="text-xs font-bold bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0 font-mono">
                              Lido
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className={`text-xs italic pl-1 ${t.textMuted}`}>Nenhuma loja realizou a confirmação.</p>
                    )}
                  </div>

                  {/* Pendentes */}
                  <div>
                    <h4 className={`text-xs font-black uppercase tracking-widest mb-3 flex items-center gap-1.5 ${t.textSecondary}`}>
                      <FiClock size={12} />
                      Aguardando Leitura ({selectedAvisoLeitura.pendentes.length})
                    </h4>
                    {selectedAvisoLeitura.pendentes.length > 0 ? (
                      <div className="space-y-2">
                        {selectedAvisoLeitura.pendentes.map(item => (
                          <div key={item.estabId} className={`p-3 rounded-xl border flex items-center justify-between ${theme === 'dark' ? 'bg-slate-900/30 border-white/5' : 'bg-stone-50 border-stone-200'}`}>
                            <p className={`text-xs font-bold truncate pr-2 ${t.textSecondary}`}>{item.nomeLoja}</p>
                            <span className={`text-xs font-bold bg-slate-500/10 ${t.textMuted} px-2 py-0.5 rounded-full border border-slate-750/20 shrink-0 font-mono`}>
                              Pendente
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-emerald-500 font-bold italic pl-1">Leitura de 100% concluída!</p>
                    )}
                  </div>
                </div>

                {/* Footer Drawer */}
                <div className={`p-6 border-t ${t.border} bg-transparent relative z-10`}>
                  <button
                    onClick={() => setSelectedAvisoLeitura(null)}
                    className={`w-full py-3.5 bg-gradient-to-r ${theme === 'dark' ? 'from-cyan-500 to-blue-600' : 'from-[#ff6b35] to-amber-600'} text-white rounded-xl font-bold text-sm hover:opacity-95 transition-all shadow-md active:scale-99`}
                  >
                    Fechar Relatório
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL MEGAFONE GLOBAL (Broadcast) */}
      <AnimatePresence>
        {modalMegafone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setModalMegafone(false)}
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className={`${t.modalBg} w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden flex flex-col relative z-10 border`}
            >
              <div className={`px-6 py-5 border-b ${t.border} flex justify-between items-center ${t.modalHeaderBg}`}>
                <div className="flex items-center gap-3">
                   <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg bg-gradient-to-r ${theme === 'dark' ? 'from-cyan-500 to-blue-600' : 'from-[#ff6b35] to-amber-600'}`}>
                      <FiVolume2 size={18} />
                   </div>
                   <div>
                       <h2 className={`text-base font-extrabold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>Disparar Megafone</h2>
                       <p className={`text-xs font-black uppercase tracking-widest ${t.textMuted}`}>Broadcast corporativo</p>
                   </div>
                </div>
                <button 
                  onClick={() => setModalMegafone(false)} 
                  className={`w-8 h-8 flex items-center justify-center border rounded-xl transition-colors ${theme === 'dark' ? 'bg-slate-900 border-white/10 hover:text-white' : 'bg-stone-100 border-stone-250 hover:text-stone-900'} ${t.textSecondary}`}
                >
                  <FiX size={16} />
                </button>
              </div>

              <form onSubmit={dispararMegafone} className="p-6 space-y-4">
                
                <div className={`p-4 rounded-2xl text-xs font-semibold leading-relaxed border ${
                  theme === 'dark' 
                    ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' 
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                    Esta mensagem aparecerá como um pop-up de aviso obrigatório para o público alvo assim que eles entrarem no painel administrativo. Não é possível ignorar sem marcar como lido.
                </div>

                <div>
                  <label className={`block text-xs font-bold uppercase tracking-widest mb-1.5 ${t.textMuted}`}>Público Alvo da Mensagem</label>
                  <select 
                    value={novoAviso.alvo}
                    onChange={(e) => setNovoAviso({...novoAviso, alvo: e.target.value})}
                    className={`w-full border rounded-xl px-4 py-3 text-sm font-semibold outline-none transition-colors ${t.inputBg}`}
                  >
                    <option value="todos" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-stone-900'}>🌐 Toda a Rede (Global)</option>
                    {Object.entries(estabMap).sort((a,b) => a[1].localeCompare(b[1])).map(([id, nome]) => (
                      <option key={id} value={id} className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-stone-900'}>🏪 Apenas: {nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-bold uppercase tracking-widest mb-1.5 ${t.textMuted}`}>Título do Aviso</label>
                  <input 
                    type="text" 
                    value={novoAviso.titulo}
                    onChange={(e) => setNovoAviso({ ...novoAviso, titulo: e.target.value })}
                    className={`w-full border rounded-xl px-4 py-3 text-sm font-semibold outline-none transition-all ${t.inputBg}`}
                    placeholder="Ex: Nova Atualização de Pagamento"
                    required
                  />
                </div>

                <div>
                  <label className={`block text-xs font-bold uppercase tracking-widest mb-1.5 ${t.textMuted}`}>Nível de Importância</label>
                  <select 
                    value={novoAviso.tipo}
                    onChange={(e) => setNovoAviso({...novoAviso, tipo: e.target.value})}
                    className={`w-full border rounded-xl px-4 py-3 text-sm font-semibold outline-none transition-colors ${t.inputBg}`}
                  >
                    <option value="info" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-stone-900'}>💬 Informativo / Atualização</option>
                    <option value="urgente" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-stone-900'}>🚨 Urgente / Alerta Crítico</option>
                    <option value="dica" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-stone-900'}>💡 Dica de Sucesso / Vendas</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-bold uppercase tracking-widest mb-1.5 ${t.textMuted}`}>Mensagem Coletiva</label>
                  <textarea 
                    value={novoAviso.mensagem}
                    onChange={(e) => setNovoAviso({ ...novoAviso, mensagem: e.target.value })}
                    className={`w-full border rounded-xl px-4 py-3 text-sm resize-none h-32 outline-none transition-all ${t.inputBg}`}
                    placeholder="Escreva a mensagem para os lojistas..."
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={loadingMegafone}
                  className={`w-full py-3.5 bg-gradient-to-r ${theme === 'dark' ? 'from-cyan-500 to-blue-600' : 'from-[#ff6b35] to-amber-600'} text-white rounded-xl font-bold hover:scale-[1.01] transition-all flex items-center justify-center gap-2 active:scale-99 shadow-md disabled:opacity-50`}
                >
                  {loadingMegafone ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <><FiSend /> Enviar Disparo</>}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── CUSTOM CONFIRMATION MODAL ─── */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className={`relative z-10 max-w-md w-full rounded-[2.5rem] border p-8 shadow-2xl ${
                theme === 'dark' ? 'bg-[#0b132b] border-white/10 text-white' : 'bg-white border-stone-200 text-stone-900'
              }`}
            >
              <div className="flex flex-col items-center text-center">
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
                      theme === 'dark' ? 'bg-slate-900 border-white/5 text-slate-300 hover:text-white' : 'bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200 hover:text-stone-900'
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

      <style>{`
        /* Custom Scrollbar for Modal and Drawer */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: ${theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#e5e5e5'};
          border-radius: 10px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: ${theme === 'dark' ? 'rgba(255,255,255,0.15)' : '#cccccc'};
        }
      `}</style>
    </div>
  );
}

export default MasterMensagens;
