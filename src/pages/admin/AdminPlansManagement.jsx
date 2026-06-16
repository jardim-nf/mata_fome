import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaStore, 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaCheck, 
  FaTimes, 
  FaIcons, 
  FaArrowLeft,
  FaSave,
  FaTags,
  FaLayerGroup,
  FaBolt
} from 'react-icons/fa';
import { IoLogOutOutline } from 'react-icons/io5';
import { FiSun, FiMoon } from 'react-icons/fi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

// --- Componente de Input Bento ---
const FormInput = ({ label, icon: Icon, themeClass, ...props }) => (
  <div>
    <label className={`block text-[11px] font-bold uppercase tracking-wider mb-2 ${themeClass.textMuted}`}>{label}</label>
    <div className="relative">
      {Icon && <div className={`absolute left-4 top-4 ${themeClass.textMuted}`}><Icon size={14} /></div>}
      <input 
        {...props}
        className={`w-full border text-sm font-semibold rounded-3xl outline-none transition-all placeholder:opacity-50 ${Icon ? 'pl-11 pr-4 py-4' : 'p-4'} ${themeClass.inputBg}`}
      />
    </div>
  </div>
);

function AdminPlansManagement() {
  const navigate = useNavigate();
  const { currentUser, logout, isMasterAdmin, loading: authLoading } = useAuth();

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('dashboard_theme');
    return saved || 'dark';
  });

  const [plans, setPlans] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    preco: '',
    duracao: '',
    recursos: [],
    ativo: true,
    corDestaque: '#10B981',
    icone: '⭐'
  });

  const availableIcons = [
    '⭐', '🚀', '💎', '👑', '📊', '🔧', '🛡️', '⚡', '🎯', '🌟',
    '💼', '🔑', '🎨', '📈', '🔔', '🔄', '📱', '💻', '🌐', '🔒'
  ];

  const availableColors = [
    '#007AFF', '#34C759', '#FF9500', '#FF3B30', '#5856D6', '#AF52DE', '#FF2D55', '#1D1D1F', '#86868B', '#000000'
  ];

  // Carrega fontes customizadas
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@300;400;500;650;700&display=swap';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Sincroniza tema
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

  useEffect(() => {
    if (authLoading) return;
    if (!isMasterAdmin) {
        navigate('/master-dashboard');
        return;
    }

    const unsubscribe = onSnapshot(collection(db, 'plans'), (snapshot) => {
      const plansData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      plansData.sort((a, b) => (a.preco || 0) - (b.preco || 0));
      setPlans(plansData);
      setTimeout(() => setLoading(false), 500);
    });

    return () => unsubscribe();
  }, [authLoading, isMasterAdmin, navigate]);

  const handleSavePlan = async (e) => {
    e.preventDefault();
    try {
      const planToSave = {
        nome: formData.nome,
        descricao: formData.descricao,
        preco: Number(formData.preco),
        duracao: Number(formData.duracao),
        recursos: formData.recursos.filter(rec => rec.trim() !== ''),
        ativo: formData.ativo,
        corDestaque: formData.corDestaque,
        icone: formData.icone,
        createdAt: editingPlan ? formData.createdAt : new Date(),
        updatedAt: new Date()
      };

      if (editingPlan) {
        await updateDoc(doc(db, 'plans', editingPlan.id), planToSave);
        toast.success('Plano atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'plans'), planToSave);
        toast.success('Novo plano criado com sucesso!');
      }

      closeModal();
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao salvar plano.');
    }
  };

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    setFormData({
      nome: plan.nome || '',
      descricao: plan.descricao || '',
      preco: plan.preco?.toString() || '',
      duracao: plan.duracao?.toString() || '',
      recursos: plan.recursos || [],
      ativo: plan.ativo !== false,
      corDestaque: plan.corDestaque || '#007AFF',
      icone: plan.icone || '⭐',
      createdAt: plan.createdAt
    });
    setShowModal(true);
  };

  const handleDelete = async (planId) => {
    if (window.confirm('Tem certeza que deseja excluir este plano permanentemente?')) {
      try {
        await deleteDoc(doc(db, 'plans', planId));
        toast.success('Plano excluído.');
      } catch (error) {
        toast.error('Erro ao excluir.');
      }
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPlan(null);
    setFormData({
      nome: '', descricao: '', preco: '', duracao: '', recursos: [], ativo: true, corDestaque: '#007AFF', icone: '⭐'
    });
  };

  // Funções de Recursos
  const addRecurso = () => setFormData({ ...formData, recursos: [...formData.recursos, ''] });
  const updateRecurso = (index, value) => {
    const novos = [...formData.recursos];
    novos[index] = value;
    setFormData({ ...formData, recursos: novos });
  };
  const removeRecurso = (index) => {
    setFormData({ ...formData, recursos: formData.recursos.filter((_, i) => i !== index) });
  };

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

  if (loading || authLoading) return <LoadingScreen />;

  return (
    <div className={`min-h-screen font-space transition-colors duration-500 pb-24 pt-4 px-4 sm:px-8 relative overflow-hidden ${t.bg}`}>
      {/* Glow effects */}
      <div className="absolute top-[-10%] left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-cyan-500/10 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-violet-500/10 to-transparent blur-[120px] pointer-events-none" />

      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className={`max-w-[1400px] mx-auto ${t.surface} rounded-3xl h-16 flex items-center justify-between px-6 sticky top-4 z-40 transition-all`}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/master-dashboard')} className={`w-9 h-9 ${theme === 'dark' ? 'bg-slate-900 hover:bg-slate-800' : 'bg-stone-100 hover:bg-stone-250'} rounded-xl flex items-center justify-center transition-colors border ${t.border}`}>
            <FaArrowLeft className={`${t.textSecondary} text-xs`} />
          </button>
          <div className="border-l border-slate-700/30 pl-4">
            <h1 className={`font-semibold text-sm tracking-tight ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>Planos e Assinaturas</h1>
            <p className={`text-[10px] ${t.textSecondary} font-semibold uppercase`}>
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
          <button onClick={async () => { await logout(); navigate('/'); }} className="w-9 h-9 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 rounded-xl flex items-center justify-center transition-colors">
            <IoLogOutOutline className="text-red-500" size={16} />
          </button>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto mt-8 relative z-10">
        
        {/* HEADER DA PÁGINA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 px-2">
          <div>
            <div className="flex items-center gap-3 mb-2">
                <span className={`inline-block border ${t.border} ${theme === 'dark' ? 'bg-slate-900' : 'bg-stone-100'} ${t.textSecondary} text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full`}>
                  Monetização SaaS
                </span>
            </div>
            <h1 className={`text-4xl font-extrabold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>Gestão de Planos</h1>
            <p className={`${t.textSecondary} text-sm mt-1 font-medium`}>Configure os pacotes comerciais que serão oferecidos nas faturas automáticas dos estabelecimentos.</p>
          </div>
          <button 
            onClick={() => { setEditingPlan(null); setShowModal(true); }} 
            className={`flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r ${theme === 'dark' ? 'from-cyan-500 to-blue-600' : 'from-[#ff6b35] to-amber-600'} text-white rounded-2xl font-bold shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all text-sm`}
          >
            <FaPlus /> Novo Plano
          </button>
        </div>

        {/* GRID DE PLANOS */}
        {plans.length === 0 ? (
             <div className={`${t.cardBg} text-center py-24 rounded-[2rem] flex flex-col items-center justify-center`}>
                <div className={`w-20 h-20 ${theme === 'dark' ? 'bg-slate-900/60' : 'bg-stone-150'} rounded-full flex items-center justify-center mb-5 border ${t.border}`}>
                    <FaLayerGroup className={`text-3xl ${t.textSecondary}`} />
                </div>
                <h3 className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>Vitrines Vazias</h3>
                <p className={`${t.textSecondary} text-sm mt-2 font-medium`}>Nenhum pacote cadastrado. Crie um para começar a faturar.</p>
             </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {plans.map(plan => {
                  const shadowColor = theme === 'dark' ? `${plan.corDestaque}30` : 'rgba(0,0,0,0.05)';
                  return (
                    <motion.div 
                      key={plan.id}
                      whileHover={{ y: -6, scale: 1.01 }}
                      transition={{ duration: 0.3 }}
                      className={`${t.cardBg} rounded-[2rem] hover:border-cyan-500/20 transition-all duration-300 flex flex-col overflow-hidden relative group`}
                      style={{ boxShadow: `0 20px 40px -15px ${shadowColor}` }}
                    >
                        
                        {/* Linha Fina no Topo */}
                        <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: plan.corDestaque }}></div>

                        <div className="p-8 flex-1 flex flex-col relative z-10 pt-10">
                            {/* Badges e Ícone */}
                            <div className="flex justify-between items-start mb-6">
                                <div 
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner border transition-transform group-hover:scale-105 duration-300"
                                    style={{ backgroundColor: `${plan.corDestaque}10`, color: plan.corDestaque, borderColor: `${plan.corDestaque}30` }}
                                >
                                    {plan.icone}
                                </div>
                                {plan.ativo ? (
                                    <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-full text-[10px] font-bold border border-emerald-500/20 uppercase tracking-widest font-mono">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Ativo
                                    </span>
                                ) : (
                                    <span className={`inline-flex items-center gap-1.5 ${theme === 'dark' ? 'bg-slate-900 border-white/5 text-slate-500' : 'bg-stone-150 border-stone-250 text-stone-400'} px-3 py-1.5 rounded-full text-[10px] font-bold border uppercase tracking-widest font-mono`}>
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Oculto
                                    </span>
                                )}
                            </div>

                            {/* Título e Preço */}
                            <h3 className={`text-2xl font-black tracking-tight mb-2 ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>{plan.nome}</h3>
                            <div className="flex items-baseline gap-1 mb-3">
                                <span className={`text-sm font-bold ${t.textSecondary}`}>R$</span>
                                <span className={`text-4xl font-extrabold tracking-tighter font-mono ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>{plan.preco.toFixed(2).replace('.', ',')}</span>
                                <span className={`text-xs font-semibold font-mono uppercase tracking-wider ml-1.5 ${t.textMuted}`}>/ {plan.duracao} dias</span>
                            </div>
                            <p className={`text-sm font-medium mb-8 min-h-[40px] leading-relaxed ${t.textSecondary}`}>{plan.descricao}</p>

                            <hr className={`mb-6 ${theme === 'dark' ? 'border-white/5' : 'border-stone-200'}`} />

                            {/* Recursos */}
                            <div className="flex-1">
                                <p className={`text-[10px] font-bold uppercase tracking-widest mb-4 ${t.textMuted}`}>Benefícios Inclusos</p>
                                <ul className="space-y-4 mb-6">
                                    {plan.recursos?.slice(0, 5).map((rec, i) => (
                                        <li key={i} className={`flex items-start gap-3 text-sm font-medium ${theme === 'dark' ? 'text-slate-100' : 'text-stone-900'}`}>
                                            <FaCheck className="flex-shrink-0 mt-0.5 text-sm" style={{ color: plan.corDestaque }} />
                                            <span className="leading-tight">{rec}</span>
                                        </li>
                                    ))}
                                    {plan.recursos?.length > 5 && (
                                        <li className={`text-xs font-bold pl-7 ${t.textMuted}`}>
                                            +{plan.recursos.length - 5} recurso(s) adicionais
                                        </li>
                                    )}
                                    {(!plan.recursos || plan.recursos.length === 0) && (
                                        <li className={`text-xs italic ${t.textMuted}`}>Sem benefícios declarados.</li>
                                    )}
                                </ul>
                            </div>
                        </div>

                        {/* Rodapé de Ações */}
                        <div className={`p-6 border-t ${theme === 'dark' ? 'border-white/5 bg-slate-900/60' : 'border-stone-200 bg-stone-50'} flex gap-3`}>
                            <button 
                                onClick={() => handleEdit(plan)}
                                className={`flex-1 py-3.5 rounded-full text-xs font-bold border flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 ${
                                  theme === 'dark' 
                                    ? 'bg-slate-950 border-white/5 text-slate-100 hover:bg-slate-800' 
                                    : 'bg-white border-stone-200 text-stone-900 hover:bg-stone-100'
                                }`}
                            >
                                <FaEdit /> Editar Parâmetros
                            </button>
                            <button 
                                onClick={() => handleDelete(plan.id)}
                                className={`w-12 h-12 flex items-center justify-center border rounded-full transition-all shadow-sm active:scale-95 ${
                                  theme === 'dark'
                                    ? 'bg-slate-950 border-white/5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500'
                                    : 'bg-white border-stone-200 text-stone-500 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200'
                                }`}
                                title="Excluir Plano"
                            >
                                <FaTrash />
                            </button>
                        </div>
                    </motion.div>
                  );
                })}
            </div>
        )}

        {/* --- MODAL (FORMULÁRIO) BENTO --- */}
        <AnimatePresence>
        {showModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 20 }}
                  className={`${t.modalBg} rounded-[2rem] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col transform border`}
                >
                    
                    <div className={`p-8 border-b flex justify-between items-center ${t.modalHeaderBg}`}>
                        <div>
                            <h2 className={`text-2xl font-bold tracking-tight flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>
                                {editingPlan ? <FaEdit className={t.textSecondary} /> : <FaPlus className={t.textSecondary} />}
                                {editingPlan ? 'Configurar Plano' : 'Criar Novo Plano'}
                            </h2>
                            <p className={`text-xs font-semibold ${t.textMuted} mt-1`}>Configure as definições comerciais deste ciclo de cobrança.</p>
                        </div>
                        <button onClick={closeModal} className={`p-3 rounded-xl border transition-all active:scale-95 ${theme === 'dark' ? 'bg-slate-900 border-white/10 hover:text-white' : 'bg-stone-100 border-stone-250 hover:text-stone-900'} ${t.textSecondary}`}><FaTimes /></button>
                    </div>

                    <div className="overflow-y-auto p-8 flex-1 custom-scrollbar bg-transparent">
                        <form id="plan-form" onSubmit={handleSavePlan} className="space-y-10">
                            
                            {/* Identificação */}
                            <div className={`p-6 rounded-[2rem] border ${theme === 'dark' ? 'bg-slate-900/20 border-white/5' : 'bg-stone-100/50 border-stone-200'}`}>
                                <h3 className={`text-sm font-bold mb-6 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}><FaTags className={t.textMuted}/> Definição Geral</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <FormInput label="Título do Plano" name="nome" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} required placeholder="Ex: Starter, Pro, Enterprise..." themeClass={t} />
                                    </div>
                                    <FormInput label="Preço (R$)" name="preco" type="number" step="0.01" value={formData.preco} onChange={e => setFormData({...formData, preco: e.target.value})} required placeholder="0.00" themeClass={t} />
                                    <FormInput label="Duração (Dias)" name="duracao" type="number" value={formData.duracao} onChange={e => setFormData({...formData, duracao: e.target.value})} required placeholder="Ex: 30" themeClass={t} />
                                    
                                    <div className="md:col-span-2">
                                        <label className={`block text-[11px] font-bold uppercase tracking-wider mb-2 ${t.textMuted}`}>Breve Descrição</label>
                                        <textarea 
                                            className={`w-full border text-sm font-semibold rounded-3xl outline-none transition-all p-4 resize-none shadow-sm placeholder:opacity-50 ${t.inputBg}`}
                                            rows="2"
                                            placeholder="Por que as lojas escolheriam este plano?"
                                            value={formData.descricao}
                                            onChange={e => setFormData({...formData, descricao: e.target.value})}
                                        ></textarea>
                                    </div>
                                </div>
                            </div>

                            {/* Personalização */}
                            <div>
                                <h3 className={`text-sm font-bold mb-6 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}><FaIcons className={t.textMuted}/> Estética e Destaque</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className={`p-6 rounded-[2rem] border ${theme === 'dark' ? 'bg-slate-900/20 border-white/5' : 'bg-stone-100/50 border-stone-200'}`}>
                                        <p className={`text-[11px] font-bold uppercase tracking-wider mb-4 ${t.textMuted}`}>Ícone Principal</p>
                                        <div className="flex flex-wrap gap-2.5">
                                            {availableIcons.map((ico) => (
                                                <button 
                                                    key={ico} type="button"
                                                    onClick={() => setFormData({...formData, icone: ico})}
                                                    className={`w-11 h-11 rounded-xl text-xl flex items-center justify-center transition-all ${
                                                      formData.icone === ico 
                                                        ? 'bg-cyan-500 text-white shadow-md scale-110' 
                                                        : theme === 'dark'
                                                          ? 'bg-slate-950 border border-white/5 text-slate-400 hover:bg-slate-800'
                                                          : 'bg-white border border-stone-250 text-stone-600 hover:bg-stone-100'
                                                    }`}
                                                >
                                                    {ico}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className={`p-6 rounded-[2rem] border ${theme === 'dark' ? 'bg-slate-900/20 border-white/5' : 'bg-stone-100/50 border-stone-200'}`}>
                                        <p className={`text-[11px] font-bold uppercase tracking-wider mb-4 ${t.textMuted}`}>Cor de Destaque</p>
                                        <div className="flex flex-wrap gap-3">
                                            {availableColors.map((cor) => (
                                                <button 
                                                    key={cor} type="button"
                                                    onClick={() => setFormData({...formData, corDestaque: cor})}
                                                    className={`w-9 h-9 rounded-full transition-all relative flex items-center justify-center ${formData.corDestaque === cor ? 'scale-125 shadow-md border-2 border-white' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                                                    style={{ backgroundColor: cor }}
                                                >
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Recursos */}
                            <div className={`p-6 rounded-[2rem] border ${theme === 'dark' ? 'bg-slate-900/20 border-white/5' : 'bg-stone-100/50 border-stone-200'}`}>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}><FaCheck className={t.textMuted}/> Benefícios</h3>
                                    <button type="button" onClick={addRecurso} className={`text-[11px] font-bold px-4 py-2.5 rounded-full transition-colors flex items-center gap-1.5 active:scale-95 shadow-sm ${theme === 'dark' ? 'bg-slate-950 border border-white/5 hover:bg-slate-800 text-white' : 'bg-white border border-stone-200 hover:bg-stone-100 text-stone-900'}`}>
                                        <FaPlus size={10} /> Inserir Item
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {formData.recursos.map((rec, idx) => (
                                        <div key={idx} className={`flex gap-3 items-center p-2 pl-4 rounded-full border shadow-sm ${theme === 'dark' ? 'bg-slate-950 border-white/5' : 'bg-white border-stone-200'}`}>
                                            <div className={`font-mono font-bold text-xs ${t.textSecondary}`}>#{idx + 1}</div>
                                            <input 
                                                type="text" 
                                                value={rec} 
                                                onChange={e => updateRecurso(idx, e.target.value)}
                                                placeholder="Ex: Chatbot WhatsApp liberado"
                                                className={`flex-1 bg-transparent border-none focus:ring-0 py-1.5 text-sm font-semibold outline-none ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}
                                            />
                                            <button type="button" onClick={() => removeRecurso(idx)} className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${theme === 'dark' ? 'bg-slate-900/60 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500' : 'bg-stone-100 text-stone-500 hover:bg-rose-50 hover:text-rose-500'}`}>
                                                <FaTrash size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    {formData.recursos.length === 0 && (
                                        <div className={`text-center py-8 border border-dashed rounded-[1.5rem] ${theme === 'dark' ? 'border-white/5 bg-slate-950/20' : 'border-stone-250 bg-white'}`}>
                                            <p className={`text-xs ${t.textMuted} font-semibold`}>Nenhum benefício configurado. Adicione alguns itens.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Footer Privado */}
                    <div className={`p-8 border-t flex flex-col sm:flex-row items-center justify-between gap-6 ${t.modalHeaderBg}`}>
                        <label className={`flex items-center cursor-pointer gap-4 p-3 border rounded-2xl transition-colors shadow-sm ${theme === 'dark' ? 'bg-slate-950/40 border-white/5 hover:border-cyan-500/20' : 'bg-white border-stone-200 hover:border-stone-400'}`}>
                            <div className="relative">
                                <input type="checkbox" className="sr-only" checked={formData.ativo} onChange={e => setFormData({...formData, ativo: e.target.checked})} />
                                <div className={`block w-12 h-7 rounded-full transition-colors ${formData.ativo ? 'bg-emerald-500' : theme === 'dark' ? 'bg-slate-700' : 'bg-stone-300'}`}></div>
                                <div className={`absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform duration-300 shadow-sm ${formData.ativo ? 'transform translate-x-5' : ''}`}></div>
                            </div>
                            <div>
                                <span className={`block text-xs font-extrabold uppercase ${formData.ativo ? 'text-emerald-500' : t.textMuted}`}>Disponível Público</span>
                                <span className={`block text-[10px] font-semibold ${t.textSecondary}`}>{formData.ativo ? 'Em exposição.' : 'Oculto na vitrine.'}</span>
                            </div>
                        </label>

                        <div className="flex gap-4 w-full sm:w-auto">
                            <button type="button" onClick={closeModal} className={`flex-1 sm:flex-none px-8 py-4 rounded-2xl text-sm font-bold border transition-colors shadow-sm ${theme === 'dark' ? 'bg-slate-950 border-white/5 text-slate-100 hover:bg-slate-800' : 'bg-white border-stone-200 text-stone-900 hover:bg-stone-100'}`}>
                                Cancelar
                            </button>
                            <button type="submit" form="plan-form" className={`flex-1 sm:flex-none px-10 py-4 rounded-2xl text-sm font-bold text-white bg-gradient-to-r ${theme === 'dark' ? 'from-cyan-500 to-blue-600' : 'from-[#ff6b35] to-amber-600'} hover:scale-[1.01] transition-all flex items-center justify-center gap-2 active:scale-99 shadow-md`}>
                                <FaSave /> Finalizar Deploy
                            </button>
                        </div>
                    </div>

                </motion.div>
            </div>
        )}
        </AnimatePresence>

      </main>

      <style>{`
        /* Custom Scrollbar for Modal */
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

export default AdminPlansManagement;