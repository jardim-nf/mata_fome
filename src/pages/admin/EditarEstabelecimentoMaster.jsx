import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { uploadFile } from '../../utils/firebaseStorageService';
import { auditLogger } from '../../utils/auditLogger';
import { motion } from 'framer-motion';
import { 
  FaArrowLeft, FaSave, FaCamera, FaBuilding, FaMapMarkerAlt, FaPhone, 
  FaCreditCard, FaSignOutAlt, FaBolt, FaCrown, FaTimes, FaGlobe, FaSlidersH
} from 'react-icons/fa';
import { FiSun, FiMoon, FiLogOut } from 'react-icons/fi';
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
function FormInput({ label, name, value, onChange, type = 'text', helpText = '', icon: Icon, themeClass, ...props }) {
    return (
        <div className="group">
            <label htmlFor={name} className={`block text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${themeClass.textMuted}`}>
                {Icon && <Icon className={themeClass.textMuted} />} {label}
            </label>
            <input
                id={name} name={name} value={value || ''} onChange={onChange} type={type} {...props}
                className={`w-full border text-sm font-semibold rounded-3xl outline-none block px-5 py-4 transition-all placeholder:opacity-50 ${themeClass.inputBg}`}
            />
            {helpText && <p className={`mt-2 text-[11px] ml-1 font-medium ${themeClass.textMuted}`}>{helpText}</p>}
        </div>
    );
}

const ALL_MODULES = [
  {
    group: "⚡ Operação",
    items: [
      { path: '/painel', label: 'Monitor de Pedidos / Vendas', desc: 'Acompanhamento de pedidos em tempo real' },
      { path: '/controle-salao', label: 'Controle de Salão / Mesas', desc: 'Gerenciamento de mesas/comandas' },
      { path: '/pdv', label: 'Frente de Caixa (PDV)', desc: 'Caixa rápido e vendas balcão' },
      { path: '/admin/reports', label: 'Relatórios de Fechamento', desc: 'Extratos de fechamento de caixa' },
    ]
  },
  {
    group: "📺 Totem & Karaokê",
    items: [
      { path: '/totem', label: 'App de Autoatendimento (Totem)', desc: 'Tela de autoatendimento para clientes' },
      { path: '/admin/karaoke', label: 'Fila do Karaokê', desc: 'Painel e fila da TV de Karaokê' },
    ]
  },
  {
    group: "🛠️ Serviços & Assistência",
    items: [
      { path: '/admin/os', label: 'Ordem de Serviço (OS)', desc: 'Controle de ordens de serviço, consertos e status' },
    ]
  },
  {
    group: "🍔 Cardápio & Estoque",
    items: [
      { path: '/admin/gerenciar-cardapio', label: 'Cardápio / Catálogo Digital', desc: 'Produtos, adicionais e variações' },
      { path: '/admin/ordenar-categorias', label: 'Ordenar Categorias', desc: 'Ordem de exibição no catálogo' },
      { path: '/admin/entrada-estoque', label: 'Entrada de Estoque', desc: 'Entrada manual e importação de NF-e XML' },
      { path: '/admin/insumos', label: 'Gestão de Insumos', desc: 'Fichas técnicas e ingredientes' },
    ]
  },
  {
    group: "🛵 Logística",
    items: [
      { path: '/admin/entregadores', label: 'Gestão de Entregadores', desc: 'Cadastro de motoboys e acerto de rotas' },
      { path: '/admin/taxas-de-entrega', label: 'Taxas de Entrega', desc: 'Configuração de fretes por bairro' },
    ]
  },
  {
    group: "📈 Finanças e Análises",
    items: [
      { path: '/admin/analytics', label: 'Análises e Gráficos', desc: 'Painel geral de faturamento e métricas' },
      { path: '/admin/lucro', label: 'Relatório de Lucro Real', desc: 'Análise de lucro deduzindo custos' },
      { path: '/admin/contas-pagar', label: 'Contas a Pagar', desc: 'Controle de custos fixos, variáveis e salários' },
      { path: '/admin/crediario', label: 'Faturas e Crediário', desc: 'Gestão de fiado e limites de clientes' },
      { path: '/admin/auditoria-mesas', label: 'Auditoria de Mesas', desc: 'Histórico de mesas editadas/canceladas' },
      { path: '/admin/previsao', label: 'Previsão de Demanda (IA)', desc: 'Previsão de vendas futuras usando IA' },
    ]
  },
  {
    group: "👤 Equipe e Atendimento",
    items: [
      { path: '/admin/gestao-funcionarios', label: 'Equipe & Acessos', desc: 'Permissões, cargos e usuários' },
      { path: '/admin/ranking', label: 'Ranking de Garçons/Equipe', desc: 'Métricas de desempenho de atendimento' },
      { path: '/admin/avaliacoes', label: 'Responder Avaliações', desc: 'Integração de reviews e respostas' },
    ]
  },
  {
    group: "🚀 Marketing e Vendas",
    items: [
      { path: '/nossos-clientes', label: 'Base de Clientes', desc: 'Lista de contatos e disparo WhatsApp' },
      { path: '/admin/marketing', label: 'Painel de Marketing', desc: 'Push notifications e copy com IA' },
      { path: '/admin/cashback', label: 'Cashback e Carteira', desc: 'Crédito de fidelidade para compras' },
      { path: '/admin/fidelidade', label: 'Cartão Fidelidade', desc: 'Fidelidade por carimbos digitais' },
      { path: '/admin/cupons', label: 'Cupons de Desconto', desc: 'Criação de códigos promocionais' },
    ]
  },
  {
    group: "🤖 Robôs",
    items: [
      { path: '/admin/whatsapp', label: 'Bot WhatsApp', desc: 'Atendimento e envio de cardápio automático' },
      { path: '/admin/bot-pedidos', label: 'Copilot IA', desc: 'Assistente virtual por Inteligência Artificial' },
    ]
  },
  {
    group: "⚙️ Configurações",
    items: [
      { path: '/admin/multi-platform', label: 'Integrações e Impressoras', desc: 'Conexão com iFood, WhatsApp e impressoras' },
      { path: '/admin/cores', label: 'Identidade Visual', desc: 'Personalização do app do cliente' },
      { path: '/admin/config-fiscal', label: 'Fiscal & Certificado', desc: 'Emissão de NFC-e automática' },
      { path: '/admin/relatorio-nfce', label: 'Relatório NFC-e', desc: 'Painel de notas fiscais emitidas' },
      { path: '/admin/configuracoes', label: 'Configurações Gerais', desc: 'Senhas mestres, limites e segurança' },
      { path: '/admin/relatorio-cancelamentos', label: 'Cancelamentos', desc: 'Auditoria de produtos deletados' },
    ]
  }
];

function EditarEstabelecimentoMaster() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();

    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('dashboard_theme');
        return saved || 'dark';
    });

    const [formData, setFormData] = useState({
        nome: '', endereco: { rua: '', numero: '', bairro: '', cidade: '' },
        informacoes_contato: { telefone_whatsapp: '', instagram: '', horario_funcionamento: '' },
        chavePix: '', slug: '', imageUrl: '', rating: 0, adminUID: '', ativo: true,
        currentPlanId: '', nextBillingDate: null, tipoNegocio: 'restaurante',
        modulosDesativados: [],
    });
    const [logoImage, setLogoImage] = useState(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [loading, setLoading] = useState(true);
    const [formLoading, setFormLoading] = useState(false);
    const [error, setError] = useState('');
    const [availableAdmins, setAvailableAdmins] = useState([]);
    const [availablePlans, setAvailablePlans] = useState([]);
    const [loadingAdmins, setLoadingAdmins] = useState(true);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

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

    // Sincroniza o tema
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
        if (!isMasterAdmin) { toast.error('Acesso negado.'); navigate('/painel'); return; }

        const fetchEstablishment = async () => {
            try {
                const docRef = doc(db, 'estabelecimentos', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setFormData(prev => ({
                        ...prev, ...data,
                        endereco: data.endereco || { rua: '', numero: '', bairro: '', cidade: '' },
                        informacoes_contato: data.informacoes_contato || { telefone_whatsapp: '', instagram: '', horario_funcionamento: '' },
                        nextBillingDate: data.nextBillingDate?.toDate ? data.nextBillingDate.toDate() : null,
                        adminUID: data.adminUID || '', currentPlanId: data.currentPlanId || '',
                        slug: data.slug || '', chavePix: data.chavePix || '', imageUrl: data.imageUrl || '', nome: data.nome || '',
                        tipoNegocio: data.tipoNegocio || 'restaurante',
                        modulosDesativados: data.modulosDesativados || [],
                    }));
                    setLogoPreview(data.imageUrl || '');
                    setSlugManuallyEdited(!!data.slug);
                } else { setError("Estabelecimento não encontrado."); }
            } catch (err) { setError("Erro ao carregar dados."); }
            finally {
                // Pequeno delay para suavizar a transição do boot
                setTimeout(() => setLoading(false), 500);
            }
        };
        fetchEstablishment();
    }, [id, isMasterAdmin, authLoading, navigate]);

    useEffect(() => {
        if (!isMasterAdmin || !currentUser) return;
        const fetchAdmins = async () => {
            try {
                const q = query(collection(db, 'usuarios'), where('isAdmin', '==', true), orderBy('nome', 'asc'));
                const snap = await getDocs(q);
                setAvailableAdmins(snap.docs.map(d => ({ id: d.id, nome: d.data().nome, email: d.data().email })));
            } catch (err) { console.error(err); } finally { setLoadingAdmins(false); }
        };
        fetchAdmins();
    }, [isMasterAdmin, currentUser]);

    useEffect(() => {
        if (!isMasterAdmin || !currentUser) return;
        const fetchPlans = async () => {
            try {
                let q = query(collection(db, 'planos'), orderBy('preco', 'asc'));
                let snap = await getDocs(q);
                if (snap.empty) { q = query(collection(db, 'plans'), orderBy('preco', 'asc')); snap = await getDocs(q); }
                setAvailablePlans(snap.docs.map(d => { const dd = d.data(); return { id: d.id, name: dd.nome || dd.name || 'Sem Nome', preco: dd.preco || 0 }; }));
            } catch (err) { console.error(err); } finally { setLoadingPlans(false); }
        };
        fetchPlans();
    }, [isMasterAdmin, currentUser]);

    const handleToggleModulo = (path) => {
        setFormData(prev => {
            const current = prev.modulosDesativados || [];
            const updated = current.includes(path)
                ? current.filter(p => p !== path)
                : [...current, path];
            return { ...prev, modulosDesativados: updated };
        });
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked, files } = e.target;
        if (name === 'slug') setSlugManuallyEdited(true);
        if (type === 'file') {
            const file = files[0]; setLogoImage(file);
            setLogoPreview(file ? URL.createObjectURL(file) : (formData.imageUrl || ''));
        } else if (name === 'nextBillingDate') {
            setFormData(prev => ({ ...prev, nextBillingDate: value ? new Date(value + 'T12:00:00') : null }));
        } else if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({ ...prev, [parent]: { ...prev[parent], [child]: type === 'checkbox' ? checked : (value || '') } }));
        } else {
            setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : (value || '') }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true); setError('');
        const { nome, slug } = formData;
        if (!nome.trim() || !slug.trim()) { toast.warn("Nome e Slug são obrigatórios."); setFormLoading(false); return; }

        let finalLogoUrl = formData.imageUrl;
        try {
            if (logoImage) {
                const logoName = `establishment_logos/${formData.slug || id}_${Date.now()}_${logoImage.name}`;
                finalLogoUrl = await uploadFile(logoImage, logoName);
            }
            const currentDoc = await getDoc(doc(db, 'estabelecimentos', id));
            const currentData = currentDoc.data();
            if (formData.slug !== currentData.slug) {
                const slugQuery = query(collection(db, 'estabelecimentos'), where('slug', '==', formData.slug));
                const slugSnap = await getDocs(slugQuery);
                if (!slugSnap.empty && slugSnap.docs[0].id !== id) { setError('Este slug já está em uso.'); setFormLoading(false); return; }
            }
            const dataToUpdate = {
                ...formData,
                imageUrl: finalLogoUrl,
                rating: Number(formData.rating) || 0,
                nextBillingDate: formData.nextBillingDate instanceof Date ? formData.nextBillingDate : (formData.nextBillingDate ? new Date(formData.nextBillingDate) : null),
                updatedAt: new Date()
            };
            await updateDoc(doc(db, 'estabelecimentos', id), dataToUpdate);

            if (currentData.adminUID !== formData.adminUID) {
                if (currentData.adminUID) {
                    const oldSnap = await getDoc(doc(db, 'usuarios', currentData.adminUID));
                    if (oldSnap.exists()) {
                        const updated = (oldSnap.data().estabelecimentosGerenciados || []).filter(eid => eid !== id);
                        await updateDoc(doc(db, 'usuarios', currentData.adminUID), { estabelecimentosGerenciados: updated });
                    }
                }
                if (formData.adminUID) {
                    const newSnap = await getDoc(doc(db, 'usuarios', formData.adminUID));
                    if (newSnap.exists()) {
                        const current = newSnap.data().estabelecimentosGerenciados || [];
                        if (!current.includes(id)) await updateDoc(doc(db, 'usuarios', formData.adminUID), { estabelecimentosGerenciados: [...current, id] });
                    }
                }
            }

            auditLogger('ESTABELECIMENTO_ATUALIZADO', { uid: currentUser.uid, email: currentUser.email }, { id, name: formData.nome });
            toast.success("Atualizado com sucesso!");
            navigate('/master/estabelecimentos');
        } catch (err) { setError("Erro ao salvar."); toast.error("Erro ao salvar."); }
        finally { setFormLoading(false); }
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
          accentHover: 'hover:bg-cyan-600',
          cardBg: 'bg-slate-950/30 backdrop-blur-xl border border-white/5 shadow-2xl',
          inputBg: 'bg-slate-950/30 border-white/10 text-slate-100 focus:border-cyan-500/50 focus:bg-slate-950/50 focus:ring-1 focus:ring-cyan-500/30',
        },
        light: {
          bg: 'bg-[#fbfbfa] bg-cyber-grid-light text-stone-900',
          surface: 'bg-white/95 backdrop-blur-md border border-stone-200 shadow-md',
          border: 'border-stone-200',
          text: 'text-stone-900 font-space font-bold',
          textSecondary: 'text-stone-700 font-space font-medium',
          textMuted: 'text-stone-400 font-space font-semibold',
          accent: 'bg-[#ff6b35] text-white',
          accentHover: 'hover:bg-[#e85a2a]',
          cardBg: 'bg-[#f5f5f4]/80 backdrop-blur-md border border-stone-200 shadow-sm',
          inputBg: 'bg-[#f5f5f4] border-stone-200 text-stone-900 focus:border-stone-400 focus:bg-white focus:ring-1 focus:ring-stone-400/30',
        }
    };

    const t = themeClasses[theme];

    if (loading || authLoading) return <LoadingScreen />;
    if (error && !formData.nome) return <div className={`text-center p-8 font-bold min-h-screen pt-20 ${t.bg}`}>{error}</div>;

    return (
        <div className={`min-h-screen font-space transition-colors duration-500 pb-24 pt-4 px-4 sm:px-8 relative overflow-hidden ${t.bg}`}>
            {/* Glow effects */}
            <div className="absolute top-[-10%] left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-cyan-500/10 to-transparent blur-[140px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-violet-500/10 to-transparent blur-[120px] pointer-events-none" />

            {/* ─── FLOATING PILL NAVBAR ─── */}
            <nav className={`max-w-[1400px] mx-auto ${t.surface} rounded-3xl h-16 flex items-center justify-between px-6 sticky top-4 z-40 transition-all`}>
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/master/estabelecimentos')} className={`w-9 h-9 ${theme === 'dark' ? 'bg-slate-900 hover:bg-slate-800' : 'bg-stone-100 hover:bg-stone-250'} rounded-xl flex items-center justify-center transition-colors border ${t.border}`}>
                        <FaArrowLeft className={`${t.textSecondary} text-xs`} />
                    </button>
                    <div className="border-l border-slate-700/30 pl-4">
                        <h1 className={`font-semibold text-sm tracking-tight ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>Especificações da Loja</h1>
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
                    <button onClick={async () => { await logout(); navigate('/'); }} className="w-9 h-9 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl flex items-center justify-center transition-colors">
                        <FiLogOut className="text-red-500" size={16} />
                    </button>
                </div>
            </nav>

            <main className="max-w-[1400px] mx-auto mt-8 relative z-10">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* ─── HEADER ─── */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 px-2">
                        <div>
                            <span className={`inline-block border ${t.border} ${theme === 'dark' ? 'bg-slate-900' : 'bg-stone-100'} ${t.textSecondary} text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-3`}>
                                Administração Mestre
                            </span>
                            <h1 className={`text-4xl font-extrabold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>Editar Cadastro</h1>
                            <p className={`${t.textSecondary} text-sm mt-1 font-medium`}>Reescreva as especificações, módulos desativados e informações deste estabelecimento.</p>
                        </div>
                        <button type="submit" disabled={formLoading}
                            className={`flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r ${t.accent === 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]' ? 'from-cyan-500 to-blue-600' : 'from-[#ff6b35] to-amber-600'} text-white rounded-2xl font-bold shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 text-sm`}>
                            {formLoading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div> : <FaSave />}
                            {formLoading ? 'Salvando...' : 'Processar Alteração'}
                        </button>
                    </div>

                    {error && (
                        <div className="bg-rose-500/10 text-rose-500 p-4 rounded-2xl text-sm border border-rose-500/20 font-bold flex items-center gap-2 px-6">
                            <FaTimes /> {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                        {/* ─── COLUNA ESQUERDA (Formulários Principais) ─── */}
                        <div className="lg:col-span-2 space-y-6 md:space-y-8">
                            
                            {/* Identificação */}
                            <div className={`${t.cardBg} p-8 rounded-[2rem] shadow-sm`}>
                                <h3 className={`text-lg font-bold mb-6 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>
                                    <FaBuilding className="text-cyan-500" /> Identidade e Slug
                                </h3>
                                <div className="space-y-6">
                                    <FormInput label="Nome Oficial da Loja" name="nome" value={formData.nome} onChange={handleInputChange} required placeholder="Ex: Pizzaria do João" themeClass={t} />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <FormInput label="Slug (Endereço Web)" name="slug" value={formData.slug} onChange={handleInputChange} required helpText="URL exclusiva da loja." placeholder="pizzaria-do-joao" themeClass={t} />
                                        <FormInput label="Chave PIX Recebedora" name="chavePix" value={formData.chavePix} onChange={handleInputChange} placeholder="CNPJ, Celular ou Email" themeClass={t} />
                                    </div>
                                    <FormInput label="Nota de Avaliação (Estrelas Visuais)" name="rating" value={formData.rating} onChange={handleInputChange} type="number" min="0" max="5" step="0.1" helpText="De 0 a 5 com decimal." themeClass={t} />
                                </div>
                            </div>

                            {/* Endereço */}
                            <div className={`${t.cardBg} p-8 rounded-[2rem] shadow-sm`}>
                                <h3 className={`text-lg font-bold mb-6 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>
                                    <FaMapMarkerAlt className="text-cyan-500" /> Geolocalização / Endereço
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                                    <div className="sm:col-span-3"><FormInput label="Via / Logradouro" name="endereco.rua" value={formData.endereco.rua} onChange={handleInputChange} themeClass={t} /></div>
                                    <div className="sm:col-span-1"><FormInput label="Lote / N°" name="endereco.numero" value={formData.endereco.numero} onChange={handleInputChange} themeClass={t} /></div>
                                    <div className="sm:col-span-2"><FormInput label="Bairro" name="endereco.bairro" value={formData.endereco.bairro} onChange={handleInputChange} themeClass={t} /></div>
                                    <div className="sm:col-span-2"><FormInput label="Município / Cidade" name="endereco.cidade" value={formData.endereco.cidade} onChange={handleInputChange} themeClass={t} /></div>
                                </div>
                            </div>

                            {/* Contato & Funcionamento */}
                            <div className={`${t.cardBg} p-8 rounded-[2rem] shadow-sm`}>
                                <h3 className={`text-lg font-bold mb-6 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>
                                    <FaPhone className="text-cyan-500" /> Meios de Contato & Funcionamento
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <FormInput label="Suporte via WhatsApp" name="informacoes_contato.telefone_whatsapp" value={formData.informacoes_contato.telefone_whatsapp} onChange={handleInputChange} placeholder="(11) 90000-0000" themeClass={t} />
                                    <FormInput label="Usuário Instagram" name="informacoes_contato.instagram" value={formData.informacoes_contato.instagram} onChange={handleInputChange} placeholder="@loja" themeClass={t} />
                                </div>
                                <div className="mt-6"><FormInput label="Faixas de Operação (Descritivo)" name="informacoes_contato.horario_funcionamento" value={formData.informacoes_contato.horario_funcionamento} onChange={handleInputChange} placeholder="Ex: Ter-Dom 18h às 23h" themeClass={t} /></div>
                            </div>

                            {/* Módulos & Funcionalidades Ativas */}
                            <div className={`${t.cardBg} p-8 rounded-[2rem] shadow-sm`}>
                                <h3 className={`text-lg font-bold mb-2 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>
                                    <FaSlidersH className="text-cyan-500" /> Módulos & Funcionalidades Ativas
                                </h3>
                                <p className={`${t.textSecondary} text-xs mb-6 font-medium`}>Habilite ou desabilite recursos visuais e operacionais específicos para este estabelecimento.</p>
                                
                                <div className="space-y-8">
                                    {ALL_MODULES.map(group => (
                                        <div key={group.group} className="space-y-4">
                                            <h4 className={`text-xs font-black uppercase tracking-widest border-b pb-2 ${theme === 'dark' ? 'text-slate-400 border-white/5' : 'text-stone-600 border-stone-200'}`}>{group.group}</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {group.items.map(item => {
                                                    const active = !formData.modulosDesativados?.includes(item.path);
                                                    return (
                                                        <div 
                                                            key={item.path} 
                                                            onClick={() => handleToggleModulo(item.path)}
                                                            className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between min-h-[90px] select-none ${
                                                                active 
                                                                    ? theme === 'dark'
                                                                        ? 'bg-emerald-500/10 border-emerald-500/20 shadow-sm'
                                                                        : 'bg-emerald-50 border-emerald-200 shadow-sm'
                                                                    : theme === 'dark'
                                                                        ? 'bg-slate-900/40 border-white/5 opacity-50'
                                                                        : 'bg-stone-150 border-stone-250 opacity-60'
                                                            }`}
                                                        >
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex-1 min-w-0">
                                                                    <span className={`font-extrabold text-sm leading-tight block ${theme === 'dark' ? 'text-slate-100' : 'text-stone-900'}`}>{item.label}</span>
                                                                    <p className={`text-[10px] leading-relaxed mt-1 font-semibold ${t.textSecondary}`}>{item.desc}</p>
                                                                </div>
                                                                <div className="relative shrink-0 mt-0.5">
                                                                    <div className={`w-9 h-5 rounded-full transition-colors ${active ? 'bg-emerald-500' : theme === 'dark' ? 'bg-slate-700' : 'bg-stone-300'}`}></div>
                                                                    <div className={`absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full shadow-sm transition-transform duration-250 ${active ? 'translate-x-4' : ''}`}></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ─── COLUNA DIREITA (Upload de Logo, Status Sistêmico, Propriedade) ─── */}
                        <div className="space-y-6 md:space-y-8">
                            
                            {/* Logo */}
                            <div className={`${t.cardBg} p-8 rounded-[2rem] shadow-sm text-center flex flex-col items-center`}>
                                <h3 className={`text-sm font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>Emblema Operacional</h3>
                                <div className="relative group w-40 h-40">
                                    <div className={`w-full h-full rounded-[2rem] ${theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-stone-100 border-stone-200'} border flex items-center justify-center overflow-hidden transition-all group-hover:border-cyan-500/50`}>
                                        {logoPreview || formData.imageUrl ? (
                                            <img src={logoPreview || formData.imageUrl} alt="Logo" className="w-full h-full object-cover" />
                                        ) : <FaCamera className={`text-4xl ${t.textSecondary}`} />}
                                    </div>
                                    <label htmlFor="logoUpload" className="absolute -bottom-3 -right-3 w-12 h-12 bg-cyan-500 text-white rounded-full cursor-pointer hover:bg-cyan-600 transition-colors shadow-lg flex items-center justify-center border-4 border-slate-950">
                                        <FaCamera className="text-sm" />
                                    </label>
                                    <input type="file" id="logoUpload" name="logoUpload" accept="image/*" onChange={handleInputChange} className="hidden" />
                                </div>
                                <p className={`text-[11px] mt-6 font-semibold px-4 py-2 rounded-full ${theme === 'dark' ? 'bg-slate-950/40 text-slate-400' : 'bg-stone-150 text-stone-700'}`}>Recomendado: 500x500px</p>
                            </div>

                            {/* Status Ativo */}
                            <div className={`${t.cardBg} p-8 rounded-[2rem] shadow-sm`}>
                                <h3 className={`text-sm font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>Bloqueio Proibitivo</h3>
                                <label className={`flex items-center justify-between cursor-pointer p-4 rounded-[1.5rem] transition-colors border ${formData.ativo ? theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200' : theme === 'dark' ? 'bg-slate-900/40 border-white/5' : 'bg-stone-100 border-stone-200'}`}>
                                    <span className={`font-bold text-sm ${formData.ativo ? 'text-emerald-500' : t.textMuted}`}>
                                        {formData.ativo ? 'Funcionamento Livre' : 'Operação Congelada'}
                                    </span>
                                    <div className="relative">
                                        <input type="checkbox" name="ativo" className="sr-only" checked={formData.ativo} onChange={handleInputChange} />
                                        <div className={`block w-14 h-8 rounded-full transition-colors ${formData.ativo ? 'bg-emerald-500' : theme === 'dark' ? 'bg-slate-700' : 'bg-stone-300'}`}></div>
                                        <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full shadow-sm transition-transform duration-300 ${formData.ativo ? 'translate-x-6' : ''}`}></div>
                                    </div>
                                </label>
                            </div>

                            {/* Faturamento e Propriedade */}
                            <div className={`${t.cardBg} p-8 rounded-[2rem] shadow-sm`}>
                                <h3 className={`text-sm font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>Patrimônio & Custódia</h3>
                                <div className="space-y-6">
                                    <div>
                                        <label className={`block text-[10px] font-bold uppercase tracking-wider mb-2 ${t.textMuted}`}>Tipo de Negócio</label>
                                        <select name="tipoNegocio" value={formData.tipoNegocio || 'restaurante'} onChange={handleInputChange}
                                            className={`w-full border text-sm font-semibold rounded-3xl p-4 outline-none transition-all cursor-pointer ${t.inputBg}`}>
                                            <option value="restaurante" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-stone-900'}>Restaurante / Delivery de Comida</option>
                                            <option value="varejo" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-stone-900'}>Varejo / Loja de Material (Multiprojetos)</option>
                                            <option value="servicos" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-stone-900'}>Prestação de Serviços / Eventos</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={`block text-[10px] font-bold uppercase tracking-wider mb-2 ${t.textMuted}`}>Conta Administrativa Mestre</label>
                                        <select name="adminUID" value={formData.adminUID} onChange={handleInputChange}
                                            className={`w-full border text-sm font-semibold rounded-3xl p-4 outline-none transition-all cursor-pointer ${t.inputBg}`}>
                                            <option value="" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-stone-900'}>Livre / Órfã...</option>
                                            {availableAdmins.map(a => <option key={a.id} value={a.id} className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-stone-900'}>{a.nome}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={`block text-[10px] font-bold uppercase tracking-wider mb-2 ${t.textMuted}`}>Plano Contratado (BaaS)</label>
                                        <select name="currentPlanId" value={formData.currentPlanId} onChange={handleInputChange}
                                            className={`w-full border text-sm font-semibold rounded-3xl p-4 outline-none transition-all cursor-pointer ${t.inputBg}`}>
                                            <option value="" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-stone-900'}>Off-Grid (Sem Contrato)</option>
                                            {availablePlans.map(p => <option key={p.id} value={p.id} className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-stone-900'}>{p.name} - R$ {p.preco}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={`block text-[10px] font-bold uppercase tracking-wider mb-2 ${t.textMuted}`}>Vencimento de Fatura Gerada Automática</label>
                                        <input type="date" name="nextBillingDate" value={(() => {
                                            const d = formData.nextBillingDate;
                                            if (!d) return '';
                                            const dateObj = d instanceof Date ? d : (d.toDate ? d.toDate() : new Date(d));
                                            return isNaN(dateObj.getTime()) ? '' : dateObj.toISOString().split('T')[0];
                                        })()} onChange={handleInputChange}
                                            className={`w-full border text-sm font-semibold rounded-3xl p-4 outline-none transition-all ${t.inputBg}`} />
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </form>
            </main>
        </div>
    );
}

export default EditarEstabelecimentoMaster;