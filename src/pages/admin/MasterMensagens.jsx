import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query, addDoc, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  FiArrowLeft, FiLogOut, FiSun, FiMoon, FiSend, FiInbox,
  FiTrash2, FiClock, FiCheckCircle, FiAlertCircle, FiEye, FiActivity,
  FiVolume2, FiX
} from 'react-icons/fi';

// ─── Skeleton Loaders (Bento Style) ───
const SkeletonMessageCard = ({ isDark }) => (
  <div className={`p-6 rounded-3xl border animate-pulse ${isDark ? 'bg-slate-900/40 border-slate-800/80' : 'bg-white/70 border-slate-200/60'}`}>
    <div className="flex justify-between items-start mb-6">
      <div className={`w-12 h-12 rounded-2xl ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} />
      <div className={`w-28 h-5 rounded-full ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} />
    </div>
    <div className={`h-3 rounded-lg w-1/3 mb-4 ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} />
    <div className={`space-y-2 mb-6 p-4 rounded-2xl ${isDark ? 'bg-slate-950/40' : 'bg-slate-100/50'}`}>
      <div className={`h-3 rounded w-full ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} />
      <div className={`h-3 rounded w-5/6 ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} />
      <div className={`h-3 rounded w-4/5 ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} />
    </div>
    <div className="space-y-3 pt-4 border-t border-dashed border-slate-700/20">
      <div className={`h-2 rounded w-16 ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} />
      <div className={`h-8 rounded-xl w-full ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} />
    </div>
  </div>
);

function MasterMensagens() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  const [mensagens, setMensagens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estabMap, setEstabMap] = useState({});
  const [usuarios, setUsuarios] = useState([]);

  // Megafone State
  const [modalMegafone, setModalMegafone] = useState(false);
  const [loadingMegafone, setLoadingMegafone] = useState(false);
  const [novoAviso, setNovoAviso] = useState({ titulo: '', mensagem: '', tipo: 'info', alvo: 'todos' });

  // Detail Drawer State
  const [selectedAvisoLeitura, setSelectedAvisoLeitura] = useState(null);

  // Seta o título para SEO
  useEffect(() => {
    document.title = "IdeaFood - Rede Neural de Mensagens";
  }, []);

  // Sync theme with localStorage (same key used in MasterDashboard)
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('dashboard_theme');
    return saved || 'dark';
  });

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('dashboard_theme', newTheme);
  };

  const fetchMensagens = async () => {
    setLoading(true);
    try {
      // 1. Carrega lojas parceiras
      const estabSnap = await getDocs(collection(db, 'estabelecimentos'));
      const emap = {};
      estabSnap.forEach(d => {
        emap[d.id] = d.data().nome || d.id;
      });
      setEstabMap(emap);

      // 2. Carrega todos os usuários
      const userSnap = await getDocs(collection(db, 'usuarios'));
      const uList = [];
      userSnap.forEach(d => {
        uList.push({ id: d.id, ...d.data() });
      });
      setUsuarios(uList);

      // 3. Carrega campanhas enviadas pelas lojas em paralelo
      const estabIds = Object.keys(emap);
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
      let data = campResults.flat();
      
      // 4. Carrega avisos gerais
      const snapAvisos = await getDocs(query(collection(db, 'avisos_gerais')));
      let avisosData = snapAvisos.docs.map(d => ({ id: d.id, ...d.data(), _path: 'global', isAvisoGeral: true }));

      let combined = [...data, ...avisosData];

      // Ordenar por data decrescente
      combined.sort((a, b) => {
        const dA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dB - dA;
      });

      setMensagens(combined.slice(0, 50));
    } catch (err) {
      console.error('Erro ao buscar campanhas globais', err);
      toast.error("Erro ao carregar infraestrutura de mensagens.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return;
    fetchMensagens();
  }, [currentUser, isMasterAdmin]);

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
      fetchMensagens();
    } catch (err) {
      console.error("Erro disparar megafone:", err);
      toast.error("Erro: " + (err.message || "ao disparar aviso"));
    } finally {
      setLoadingMegafone(false);
    }
  };

  const handleExcluirMensagem = async (id, isAvisoGeral) => {
    if (!isAvisoGeral) return toast.info("Só é possível excluir avisos globais por aqui.");
    if (!window.confirm("Tem certeza que deseja excluir este aviso para todos?")) return;
    
    try {
      await deleteDoc(doc(db, 'avisos_gerais', id));
      toast.success("Aviso excluído com sucesso!");
      fetchMensagens();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir o aviso.");
    }
  };

  // Função utilitária para descobrir quais lojas leram um aviso geral específico
  const getLeiturasAviso = (avisoId, alvo) => {
    const estabsAlvo = alvo === 'todos' 
      ? Object.keys(estabMap) 
      : [alvo];
      
    const lidos = [];
    const pendentes = [];
    
    estabsAlvo.forEach(estabId => {
      // Filtrar usuários que gerenciam essa loja
      const usersDeEstab = usuarios.filter(u => u.estabelecimentoIdPrincipal === estabId || u.estabelecimentoId === estabId || (Array.isArray(u.estabelecimentosGerenciados) && u.estabelecimentosGerenciados.includes(estabId)));
      
      // Verificar se algum deles leu o aviso
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

  // Computação de estatísticas analíticas do Hub de Mensagens
  const stats = useMemo(() => {
    const totalBroadcasts = mensagens.filter(m => m.isAvisoGeral).length;
    const totalCampanhas = mensagens.filter(m => !m.isAvisoGeral).length;
    const totalLojas = Object.keys(estabMap).length;
    
    let totalPossivelConfirmacoes = 0;
    let totalConfirmacoesLeitura = 0;
    
    mensagens.forEach(msg => {
      if (msg.isAvisoGeral) {
        const leituras = getLeiturasAviso(msg.id, msg.alvo);
        totalPossivelConfirmacoes += (leituras.lidos.length + leituras.pendentes.length);
        totalConfirmacoesLeitura += leituras.lidos.length;
      }
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
  }, [mensagens, estabMap, usuarios]);

  const themeClasses = {
    dark: {
      bg: 'bg-gradient-to-br from-slate-950 via-[#0d1220] to-slate-950',
      surface: 'bg-slate-900/60 backdrop-blur-xl',
      surfaceHover: 'hover:bg-slate-800/80 hover:shadow-[0_8px_32px_rgba(99,102,241,0.06)] hover:scale-[1.01] hover:border-slate-700/50',
      border: 'border-slate-800/80',
      text: 'text-slate-100',
      textSecondary: 'text-slate-400',
      textMuted: 'text-slate-500',
      accent: 'bg-blue-600',
      accentHover: 'hover:bg-blue-700',
      gradient: 'from-blue-500 to-indigo-600',
      cardBg: 'bg-slate-900/40 backdrop-blur-xl',
      inputBg: 'bg-slate-950/60',
    },
    light: {
      bg: 'bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#f8fafc]',
      surface: 'bg-white/80 backdrop-blur-md',
      surfaceHover: 'hover:bg-white hover:shadow-[0_8px_30px_rgba(99,102,241,0.02)] hover:scale-[1.01] hover:border-slate-300/50',
      border: 'border-slate-200/60',
      text: 'text-slate-900',
      textSecondary: 'text-slate-650',
      textMuted: 'text-slate-400',
      accent: 'bg-blue-500',
      accentHover: 'hover:bg-blue-600',
      gradient: 'from-blue-550 to-purple-650',
      cardBg: 'bg-white/70 backdrop-blur-md',
      inputBg: 'bg-slate-100/50',
    }
  };

  const t = themeClasses[theme];

  if (authLoading) {
    return (
      <div className={`min-h-screen ${t.bg} flex items-center justify-center`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className={`text-sm font-medium ${t.textSecondary}`}>Sincronizando infraestrutura...</p>
        </div>
      </div>
    );
  }

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
    <div className={`min-h-screen ${t.bg} transition-colors duration-500 relative overflow-hidden pb-24 pt-4 px-4 sm:px-8`}>
      {/* Glow effects */}
      <div className="absolute top-[-10%] left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-violet-500/10 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-blue-500/8 to-transparent blur-[120px] pointer-events-none" />

      {/* Style block for animations */}
      <style>{`
        @keyframes rotate-gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient-border {
          background-size: 200% 200%;
          animation: rotate-gradient 5s ease infinite;
        }
      `}</style>

      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className={`max-w-[1400px] mx-auto ${t.surface} border ${t.border} shadow-lg rounded-3xl h-16 flex items-center justify-between px-6 sticky top-4 z-40 transition-all`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/master-dashboard')} 
            className={`w-9 h-9 ${t.inputBg} hover:opacity-80 rounded-xl flex items-center justify-center border ${t.border} transition-colors`}
          >
            <FiArrowLeft className={`${t.textSecondary} text-sm`} />
          </button>
          <div className="border-l border-slate-700/50 pl-4">
            <h1 className={`font-bold text-sm tracking-tight ${t.text}`}>Rede Neural de Mensagens</h1>
            <p className={`text-[10px] ${t.textSecondary} font-semibold uppercase`}>
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-xl ${t.inputBg} ${t.border} border ${t.textSecondary} hover:${t.text} transition-all`}
          >
            {theme === 'dark' ? <FiSun size={16} /> : <FiMoon size={16} />}
          </button>
          <div className="w-px h-6 bg-slate-700/50" />
          <button 
            onClick={async () => { await logout(); navigate('/'); }} 
            className="w-9 h-9 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 rounded-xl flex items-center justify-center transition-colors"
          >
            <FiLogOut className="text-red-500" size={16} />
          </button>
        </div>
      </nav>

      {/* HEADER DA PÁGINA */}
      <main className="max-w-[1400px] mx-auto mt-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 px-2">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`border ${t.border} ${t.inputBg} ${t.textSecondary} text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full`}>
                CRM & Disparos da Rede
              </span>
            </div>
            <h2 className={`text-4xl font-extrabold tracking-tight ${t.text}`}>Campanhas da Rede</h2>
            <p className={`text-sm ${t.textSecondary} mt-1 font-medium`}>
              Acompanhe os disparos de marketing dos franqueados e os avisos administrativos gerais.
            </p>
          </div>
          <button 
            onClick={() => setModalMegafone(true)}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3.5 rounded-2xl font-bold text-sm shadow-lg hover:shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
          >
            <FiVolume2 size={16} className="animate-pulse" />
            Disparar Megafone
          </button>
        </div>

        {/* KPI BENTO GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 px-2">
          {/* Card 1: Megafone Broadcasts */}
          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            className={`relative overflow-hidden p-6 rounded-3xl border transition-all duration-350 ${t.cardBg} ${t.border} shadow-lg`}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-bl-full pointer-events-none" />
            <div className="flex justify-between items-center mb-4">
              <span className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>Canais Master</span>
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                <FiVolume2 size={18} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold tracking-tight ${t.text}`}>
                {loading ? <div className={`h-8 w-16 rounded-lg animate-pulse ${theme === 'dark' ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} /> : stats.totalBroadcasts}
              </span>
            </div>
            <h3 className={`text-sm font-bold ${t.text} mt-2`}>Megafone Global</h3>
            <p className={`text-xs ${t.textSecondary} mt-0.5`}>Avisos corporativos ativos</p>
          </motion.div>

          {/* Card 2: Campanhas de Lojas */}
          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            className={`relative overflow-hidden p-6 rounded-3xl border transition-all duration-350 ${t.cardBg} ${t.border} shadow-lg`}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-bl-full pointer-events-none" />
            <div className="flex justify-between items-center mb-4">
              <span className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>Marketing</span>
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                <FiSend size={18} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold tracking-tight ${t.text}`}>
                {loading ? <div className={`h-8 w-16 rounded-lg animate-pulse ${theme === 'dark' ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} /> : stats.totalCampanhas}
              </span>
            </div>
            <h3 className={`text-sm font-bold ${t.text} mt-2`}>Campanhas Criadas</h3>
            <p className={`text-xs ${t.textSecondary} mt-0.5`}>Disparadas pelas franquias</p>
          </motion.div>

          {/* Card 3: Lojas Parceiras */}
          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            className={`relative overflow-hidden p-6 rounded-3xl border transition-all duration-350 ${t.cardBg} ${t.border} shadow-lg`}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-500/10 to-transparent rounded-bl-full pointer-events-none" />
            <div className="flex justify-between items-center mb-4">
              <span className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>Estabelecimentos</span>
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
                <FiActivity size={18} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold tracking-tight ${t.text}`}>
                {loading ? <div className={`h-8 w-16 rounded-lg animate-pulse ${theme === 'dark' ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} /> : stats.totalLojas}
              </span>
            </div>
            <h3 className={`text-sm font-bold ${t.text} mt-2`}>Lojas Integradas</h3>
            <p className={`text-xs ${t.textSecondary} mt-0.5`}>Parceiros no ecossistema</p>
          </motion.div>

          {/* Card 4: Engajamento / Taxa de Leitura */}
          <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            className={`relative overflow-hidden p-6 rounded-3xl border transition-all duration-350 ${t.cardBg} ${t.border} shadow-lg`}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-bl-full pointer-events-none" />
            <div className="flex justify-between items-center mb-4">
              <span className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>Visualização</span>
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                <FiCheckCircle size={18} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold tracking-tight ${t.text}`}>
                {loading ? <div className={`h-8 w-16 rounded-lg animate-pulse ${theme === 'dark' ? 'bg-slate-800/60' : 'bg-slate-200/60'}`} /> : `${stats.taxaVisualizacao}%`}
              </span>
            </div>
            <h3 className={`text-sm font-bold ${t.text} mt-2`}>Confirmado / Lido</h3>
            <p className={`text-xs ${t.textSecondary} mt-0.5`}>Média global de leitura</p>
          </motion.div>
        </div>

        {/* LISTAGEM DE MENSAGENS */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <SkeletonMessageCard key={i} isDark={theme === 'dark'} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                
                // Para aviso geral, calcular dados de leitura
                let leituras = null;
                if (msg.isAvisoGeral) {
                  leituras = getLeiturasAviso(msg.id, msg.alvo);
                }

                // Configurações de destaque visual baseado no tipo e importância
                const isAviso = msg.isAvisoGeral;
                let cardAccentClass = "border-emerald-500/20 hover:border-emerald-500/40";
                let textAccentClass = "text-emerald-500 dark:text-emerald-400";
                let bgAccentClass = "bg-emerald-500/10 text-emerald-500";
                
                if (isAviso) {
                  if (msg.tipo === 'urgente') {
                    cardAccentClass = "border-rose-500/20 hover:border-rose-500/40";
                    textAccentClass = "text-rose-500 dark:text-rose-400";
                    bgAccentClass = "bg-rose-500/10 text-rose-500";
                  } else if (msg.tipo === 'dica') {
                    cardAccentClass = "border-amber-500/20 hover:border-amber-500/40";
                    textAccentClass = "text-amber-500 dark:text-amber-400";
                    bgAccentClass = "bg-amber-500/10 text-amber-500";
                  } else {
                    cardAccentClass = "border-blue-500/20 hover:border-blue-500/40";
                    textAccentClass = "text-blue-500 dark:text-blue-400";
                    bgAccentClass = "bg-blue-500/10 text-blue-500";
                  }
                }

                return (
                  <motion.div 
                    key={msg.id} 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`${t.cardBg} border ${t.border} ${cardAccentClass} ${t.surfaceHover} p-6 rounded-3xl transition-all duration-300 relative group flex flex-col justify-between`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className={`w-12 h-12 rounded-2xl ${t.inputBg} border ${t.border} flex items-center justify-center ${textAccentClass} ${bgAccentClass} shadow-inner`}>
                          {isAviso ? <FiVolume2 size={20} /> : <FiSend size={18} />}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold px-3 py-1 rounded-full border ${
                            theme === 'dark' ? 'border-slate-800 bg-slate-950/40 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-500'
                          }`}>
                            {format(dDate, "dd/MM/yyyy HH:mm")}
                          </span>
                          {msg.isAvisoGeral && (
                            <button 
                              onClick={() => handleExcluirMensagem(msg.id, msg.isAvisoGeral)} 
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
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${
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
                          <h4 className={`text-sm font-extrabold mb-1.5 ${t.text}`}>{msg.titulo || 'Aviso sem Título'}</h4>
                        )}
                        <p className={`text-sm font-medium leading-relaxed ${t.textSecondary} whitespace-pre-wrap line-clamp-5`}>
                          {msg.texto || msg.mensagem || 'Conteúdo inativo ou em branco...'}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-slate-700/20">
                      <div>
                        <p className={`text-[10px] uppercase font-black tracking-widest ${t.textMuted} mb-1`}>Remetente / Alvo</p>
                        <p className={`text-xs font-bold ${t.text} truncate bg-slate-950/20 dark:bg-slate-950/40 px-3 py-2 rounded-xl border border-slate-800/10`}>
                          {realNome}
                        </p>
                      </div>

                      {/* Controle de Leitura em tempo real para avisos gerais */}
                      {msg.isAvisoGeral && leituras && (
                        <div className="flex items-center justify-between mt-3 pt-2">
                          <button
                            onClick={() => setSelectedAvisoLeitura({
                              id: msg.id,
                              titulo: msg.titulo || 'Aviso Sem Título',
                              mensagem: msg.texto || msg.mensagem || '',
                              ...leituras
                            })}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 ${textAccentClass} font-semibold text-[10px] transition-colors`}
                          >
                            <FiEye size={12} />
                            Leituras: {leituras.lidos.length} de {leituras.lidos.length + leituras.pendentes.length}
                          </button>
                          <span className={`text-[10px] font-bold ${t.textSecondary}`}>
                            {Math.round((leituras.lidos.length / (leituras.lidos.length + leituras.pendentes.length || 1)) * 100)}% lido
                          </span>
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
                <h3 className={`text-lg font-bold ${t.text} tracking-tight`}>Sem Envios Recentes</h3>
                <p className={`${t.textSecondary} font-medium text-sm mt-1`}>Nenhuma loja registrou disparos até o momento.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* DRAWER LATERAL DE DETALHES DE LEITURA */}
      <AnimatePresence>
        {selectedAvisoLeitura && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
              onClick={() => setSelectedAvisoLeitura(null)}
            />

            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className={`w-screen max-w-md border-l ${t.border} ${t.surface} backdrop-blur-2xl flex flex-col justify-between shadow-2xl relative overflow-hidden`}
              >
                <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />

                {/* Header */}
                <div className={`p-6 border-b ${t.border} relative z-10 bg-slate-950/10`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-xl font-bold ${t.text}`}>Relatório de Recebimento</h3>
                    <button
                      onClick={() => setSelectedAvisoLeitura(null)}
                      className={`p-2.5 rounded-xl hover:${t.inputBg} ${t.border} border ${t.textSecondary} hover:${t.text} transition-colors`}
                    >
                      <FiX size={16} />
                    </button>
                  </div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${t.textMuted}`}>Controle do Megafone Global</p>

                  <div className="mt-4 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                    <p className={`text-xs ${t.textSecondary} font-semibold uppercase tracking-wider mb-1`}>Mensagem Enviada</p>
                    <h4 className={`text-sm font-bold ${t.text} mb-1 line-clamp-1`}>{selectedAvisoLeitura.titulo}</h4>
                    <p className={`text-xs ${t.textSecondary} line-clamp-2`}>{selectedAvisoLeitura.mensagem}</p>
                  </div>

                  {/* Estatísticas Rápidas */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className={`p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15`}>
                      <span className="block text-[10px] font-semibold text-emerald-400 uppercase">Confirmado</span>
                      <span className="text-xl font-bold text-emerald-500">{selectedAvisoLeitura.lidos.length} lojas</span>
                    </div>
                    <div className={`p-3 rounded-xl bg-slate-500/5 border ${t.border}`}>
                      <span className={`block text-[10px] font-semibold ${t.textMuted} uppercase`}>Pendente</span>
                      <span className={`text-xl font-bold ${t.textSecondary}`}>{selectedAvisoLeitura.pendentes.length} lojas</span>
                    </div>
                  </div>
                </div>

                {/* List Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 relative z-10">
                  {/* Lidas */}
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-2 flex items-center gap-1.5">
                      <FiCheckCircle size={12} />
                      Lojas que já leram ({selectedAvisoLeitura.lidos.length})
                    </h4>
                    {selectedAvisoLeitura.lidos.length > 0 ? (
                      <div className="space-y-2">
                        {selectedAvisoLeitura.lidos.map(item => (
                          <div key={item.estabId} className={`p-3 rounded-xl ${t.inputBg} border border-emerald-500/10 flex items-center justify-between`}>
                            <div className="truncate pr-2">
                              <p className={`text-xs font-bold ${t.text} truncate`}>{item.nomeLoja}</p>
                              <p className="text-[10px] text-emerald-400 font-medium">Lido por: {item.leitor}</p>
                            </div>
                            <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                              Confirmado
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className={`text-xs ${t.textMuted} italic pl-1`}>Nenhum estabelecimento leu ainda.</p>
                    )}
                  </div>

                  {/* Pendentes */}
                  <div>
                    <h4 className={`text-xs font-black uppercase tracking-widest ${t.textSecondary} mb-2 flex items-center gap-1.5`}>
                      <FiClock size={12} />
                      Aguardando visualização ({selectedAvisoLeitura.pendentes.length})
                    </h4>
                    {selectedAvisoLeitura.pendentes.length > 0 ? (
                      <div className="space-y-2">
                        {selectedAvisoLeitura.pendentes.map(item => (
                          <div key={item.estabId} className={`p-3 rounded-xl ${t.inputBg} border ${t.border} flex items-center justify-between`}>
                            <p className={`text-xs font-bold ${t.textSecondary} truncate pr-2`}>{item.nomeLoja}</p>
                            <span className={`text-[9px] font-bold bg-slate-500/10 ${t.textMuted} px-2 py-0.5 rounded-full border border-slate-700/10 shrink-0`}>
                              Pendente
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-emerald-400 font-semibold italic pl-1">100% de leitura concluída!</p>
                    )}
                  </div>
                </div>

                {/* Footer Drawer */}
                <div className={`p-6 border-t ${t.border} bg-slate-950/20 backdrop-blur-md relative z-10`}>
                  <button
                    onClick={() => setSelectedAvisoLeitura(null)}
                    className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold text-sm hover:opacity-95 transition-opacity shadow-lg"
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop with fade-in */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={() => setModalMegafone(false)}
            />
            
            {/* Modal Box */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className={`w-full max-w-lg border ${t.border} ${t.surface} backdrop-blur-3xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col relative z-10`}
            >
              {/* Decorative top glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-b-full opacity-60 blur-xs" />

              <div className={`px-6 py-5 border-b ${t.border} flex justify-between items-center bg-slate-950/10`}>
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg">
                      <FiVolume2 size={18} />
                   </div>
                   <div>
                       <h2 className={`text-base font-extrabold ${t.text} tracking-tight`}>Disparar Megafone</h2>
                       <p className={`text-[9px] font-black ${t.textMuted} uppercase tracking-widest`}>Broadcast corporativo</p>
                   </div>
                </div>
                <button 
                  onClick={() => setModalMegafone(false)} 
                  className={`w-8 h-8 flex items-center justify-center ${t.inputBg} border ${t.border} rounded-xl ${t.textSecondary} hover:${t.text} transition-colors`}
                >
                  <FiX size={16} />
                </button>
              </div>

              <form onSubmit={dispararMegafone} className="p-6 space-y-4">
                
                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl text-xs font-semibold text-blue-400 leading-relaxed">
                    Esta mensagem aparecerá como um pop-up de aviso obrigatório para o público alvo assim que eles entrarem no painel administrativo. Não é possível ignorar sem marcar como lido.
                </div>

                <div>
                  <label className={`block text-[10px] font-black ${t.textMuted} uppercase tracking-widest mb-1.5`}>Público Alvo da Mensagem</label>
                  <select 
                    value={novoAviso.alvo}
                    onChange={(e) => setNovoAviso({...novoAviso, alvo: e.target.value})}
                    className={`w-full ${t.inputBg} border ${t.border} rounded-xl px-4 py-3 text-sm font-semibold ${t.text} outline-none focus:border-blue-500 transition-colors`}
                  >
                    <option value="todos" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}>🌐 Toda a Rede (Global)</option>
                    {Object.entries(estabMap).sort((a,b) => a[1].localeCompare(b[1])).map(([id, nome]) => (
                      <option key={id} value={id} className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}>🏪 Apenas: {nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-[10px] font-black ${t.textMuted} uppercase tracking-widest mb-1.5`}>Título do Aviso</label>
                  <input 
                    type="text" 
                    value={novoAviso.titulo}
                    onChange={(e) => setNovoAviso({ ...novoAviso, titulo: e.target.value })}
                    className={`w-full ${t.inputBg} border ${t.border} focus:bg-slate-900/10 rounded-xl px-4 py-3 text-sm font-semibold ${t.text} outline-none focus:border-blue-500 transition-all`}
                    placeholder="Ex: Nova Atualização de Pagamento"
                    required
                  />
                </div>

                <div>
                  <label className={`block text-[10px] font-black ${t.textMuted} uppercase tracking-widest mb-1.5`}>Nível de Importância</label>
                  <select 
                    value={novoAviso.tipo}
                    onChange={(e) => setNovoAviso({...novoAviso, tipo: e.target.value})}
                    className={`w-full ${t.inputBg} border ${t.border} rounded-xl px-4 py-3 text-sm font-semibold ${t.text} outline-none focus:border-blue-500 transition-colors`}
                  >
                    <option value="info" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}>💬 Informativo / Atualização</option>
                    <option value="urgente" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}>🚨 Urgente / Queda de Sistema</option>
                    <option value="dica" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}>💡 Dica de Sucesso / Vendas</option>
                  </select>
                </div>

                <div>
                  <label className={`block text-[10px] font-black ${t.textMuted} uppercase tracking-widest mb-1.5`}>Mensagem Coletiva</label>
                  <textarea 
                    value={novoAviso.mensagem}
                    onChange={(e) => setNovoAviso({ ...novoAviso, mensagem: e.target.value })}
                    className={`w-full ${t.inputBg} border ${t.border} focus:bg-slate-900/10 rounded-xl px-4 py-3 text-sm ${t.text} resize-none h-32 outline-none focus:border-blue-500 transition-all`}
                    placeholder="Escreva a mensagem para os lojistas..."
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={loadingMegafone}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold hover:opacity-95 disabled:opacity-50 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  {loadingMegafone ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <><FiSend /> Enviar Disparo</>}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MasterMensagens;
