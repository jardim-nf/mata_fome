import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { motion } from 'framer-motion';
import { 
  FaArrowLeft, FaUserPlus, FaSignOutAlt, FaStore, FaBolt, FaCrown,
  FaEnvelope, FaLock, FaUser, FaUserShield, FaToggleOn, FaToggleOff
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

function CriarUsuarioMaster() {
    const navigate = useNavigate();
    const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();

    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('dashboard_theme');
        return saved || 'dark';
    });

    const [formData, setFormData] = useState({
        nome: '', email: '', senha: '',
        isAdmin: false, isMasterAdmin: false, ativo: true,
        estabelecimentosGerenciados: [],
    });
    const [loadingForm, setLoadingForm] = useState(false);
    const [formError, setFormError] = useState('');
    const [estabelecimentosList, setEstabelecimentosList] = useState([]);
    const [loadingEstabelecimentos, setLoadingEstabelecimentos] = useState(true);

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
        if (!authLoading && (!currentUser || !isMasterAdmin)) {
            toast.error('Acesso negado.');
            navigate('/master-dashboard');
        }
    }, [currentUser, isMasterAdmin, authLoading, navigate]);

    useEffect(() => {
        if (!isMasterAdmin || !currentUser) return;
        const fetch = async () => {
            try {
                const q = query(collection(db, 'estabelecimentos'), orderBy('nome', 'asc'));
                const snap = await getDocs(q);
                setEstabelecimentosList(snap.docs.map(d => ({ id: d.id, nome: d.data().nome })));
            } catch (err) { toast.error("Erro ao carregar estabelecimentos."); }
            finally {
                setTimeout(() => setLoadingEstabelecimentos(false), 500);
            }
        };
        fetch();
    }, [isMasterAdmin, currentUser]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleEstabelecimentoChange = (e) => {
        const selected = [...e.target.options].filter(o => o.selected).map(o => o.value);
        setFormData(prev => ({ ...prev, estabelecimentosGerenciados: selected }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoadingForm(true);
        setFormError('');

        if (formData.senha.length < 6) { setFormError('A senha deve ter pelo menos 6 caracteres'); setLoadingForm(false); return; }
        if (formData.isAdmin && formData.estabelecimentosGerenciados.length === 0) { setFormError('Selecione pelo menos um estabelecimento'); setLoadingForm(false); return; }

        try {
            const userDataForCF = {
                displayName: formData.nome.trim(),
                email: formData.email.trim().toLowerCase(),
                password: formData.senha, 
                estabelecimentos: formData.estabelecimentosGerenciados,
                isAdmin: formData.isAdmin,
                isMasterAdmin: formData.isMasterAdmin,
                ativo: formData.ativo,
                role: formData.isMasterAdmin ? 'master' : (formData.isAdmin ? 'admin' : 'usuario')
            };

            const functions = getFunctions();
            const criarUsuario = httpsCallable(functions, 'createUserByMasterAdminHttp');
            const response = await criarUsuario(userDataForCF);
            const result = response.data; 

            await auditLogger(currentUser.uid, 'CREATE_USER', `Usuário criado: ${userDataForCF.email}`, {
                userId: result.uid, email: userDataForCF.email,
                roles: { isAdmin: userDataForCF.isAdmin, isMasterAdmin: userDataForCF.isMasterAdmin }
            });

            toast.success(result.mensagem || 'Usuário criado com sucesso!');
            navigate('/master/usuarios');
        } catch (error) {
            const msg = error.message || 'Erro ao criar usuário.';
            toast.error(msg);
            setFormError(msg);
        } finally { setLoadingForm(false); }
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
        }
    };

    const t = themeClasses[theme];

    if (authLoading || loadingEstabelecimentos) return <LoadingScreen />;
    if (!isMasterAdmin) return null;

    return (
        <div className={`min-h-screen font-space transition-colors duration-500 pb-24 pt-4 px-4 sm:px-8 relative overflow-hidden ${t.bg}`}>
            {/* Glow effects */}
            <div className="absolute top-[-10%] left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-cyan-500/10 to-transparent blur-[140px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-violet-500/10 to-transparent blur-[120px] pointer-events-none" />

            {/* ─── FLOATING PILL NAVBAR ─── */}
            <nav className={`max-w-[768px] mx-auto ${t.surface} rounded-3xl h-16 flex items-center justify-between px-6 sticky top-4 z-40 transition-all`}>
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/master/usuarios')} className={`w-9 h-9 ${theme === 'dark' ? 'bg-slate-900 hover:bg-slate-800' : 'bg-stone-100 hover:bg-stone-250'} rounded-xl flex items-center justify-center transition-colors border ${t.border}`}>
                        <FaArrowLeft className={`${t.textSecondary} text-xs`} />
                    </button>
                    <div className="border-l border-slate-700/30 pl-4">
                        <h1 className={`font-semibold text-sm tracking-tight ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>Criar Usuário</h1>
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
                        <FiLogOut className="text-red-500" size={16} />
                    </button>
                </div>
            </nav>

            <main className="max-w-[768px] mx-auto mt-8 relative z-10">
                {/* HEADER */}
                <div className="mb-8 px-2">
                    <span className={`inline-block border ${t.border} ${theme === 'dark' ? 'bg-slate-900' : 'bg-stone-100'} ${t.textSecondary} text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-3`}>
                        Cadastro
                    </span>
                    <h1 className={`text-3xl font-extrabold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>Novo Usuário</h1>
                    <p className={`${t.textSecondary} text-sm mt-1 font-medium`}>Adicione um novo operador de loja ou administrador Master à rede.</p>
                </div>

                {/* FORM CARD */}
                <div className={`${t.cardBg} rounded-[2rem] p-6 sm:p-8 shadow-sm`}>
                    {formError && (
                        <div className="bg-rose-500/10 text-rose-500 p-4 mb-6 rounded-2xl text-sm border border-rose-500/20 font-bold flex items-center gap-3">
                            ⚠️ {formError}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Nome */}
                        <div>
                            <label className={`block text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${t.textMuted}`}>
                                <FaUser className={t.textMuted} /> Nome Completo *
                            </label>
                            <input name="nome" value={formData.nome} onChange={handleInputChange} required placeholder="Ex: João Silva"
                                className={`w-full border text-sm font-semibold rounded-3xl outline-none block px-5 py-4 transition-all placeholder:opacity-50 ${t.inputBg}`} />
                        </div>

                        {/* Email */}
                        <div>
                            <label className={`block text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${t.textMuted}`}>
                                <FaEnvelope className={t.textMuted} /> E-mail *
                            </label>
                            <input name="email" type="email" value={formData.email} onChange={handleInputChange} required placeholder="email@exemplo.com"
                                className={`w-full border text-sm font-semibold rounded-3xl outline-none block px-5 py-4 transition-all placeholder:opacity-50 ${t.inputBg}`} />
                        </div>

                        {/* Senha */}
                        <div>
                            <label className={`block text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${t.textMuted}`}>
                                <FaLock className={t.textMuted} /> Senha Inicial *
                            </label>
                            <input name="senha" type="password" value={formData.senha} onChange={handleInputChange} required minLength="6" placeholder="Mínimo 6 caracteres" autoComplete="new-password"
                                className={`w-full border text-sm font-semibold rounded-3xl outline-none block px-5 py-4 transition-all placeholder:opacity-50 ${t.inputBg}`} />
                            <p className={`text-[11px] mt-1.5 ml-1 font-medium ${t.textMuted}`}>O usuário deve alterá-la após o primeiro login.</p>
                        </div>

                        {/* Permissões */}
                        <div className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bg-slate-900/40 border-white/5' : 'bg-stone-100 border-stone-200'}`}>
                            <p className={`text-[11px] font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5 ${t.textMuted}`}>
                                <FaUserShield className={t.textMuted} /> Atribuições
                            </p>
                            <div className="flex flex-wrap gap-6">
                                <label className="flex items-center gap-2.5 cursor-pointer group">
                                    <input type="checkbox" name="isAdmin" checked={formData.isAdmin} onChange={handleInputChange}
                                        className="h-4.5 w-4.5 rounded-lg border-stone-300 text-cyan-500 focus:ring-cyan-500 cursor-pointer" />
                                    <span className={`text-sm font-bold ${t.textSecondary} group-hover:text-cyan-500 transition-colors`}>Admin de Loja</span>
                                </label>
                                <label className="flex items-center gap-2.5 cursor-pointer group">
                                    <input type="checkbox" name="isMasterAdmin" checked={formData.isMasterAdmin} onChange={handleInputChange}
                                        className="h-4.5 w-4.5 rounded-lg border-stone-300 text-cyan-500 focus:ring-cyan-500 cursor-pointer" />
                                    <span className={`text-sm font-bold ${t.textSecondary} group-hover:text-cyan-500 transition-colors`}>Master Admin</span>
                                </label>
                            </div>
                        </div>

                        {/* Estabelecimentos */}
                        {formData.isAdmin && (
                            <div>
                                <label className={`block text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${t.textMuted}`}>
                                    <FaStore className={t.textMuted} /> Lojas Gerenciadas *
                                </label>
                                <select name="estabelecimentosGerenciados" multiple value={formData.estabelecimentosGerenciados} onChange={handleEstabelecimentoChange} required
                                    className={`w-full border text-sm font-semibold rounded-3xl p-4 outline-none transition-all h-40 ${t.inputBg}`}>
                                    {loadingEstabelecimentos ? <option disabled>Carregando...</option> :
                                     estabelecimentosList.length === 0 ? <option disabled>Nenhum disponível</option> :
                                     estabelecimentosList.map(e => <option key={e.id} value={e.id} className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-stone-900'}>{e.nome}</option>)}
                                </select>
                                <p className={`text-[11px] mt-1.5 ml-1 font-medium ${t.textMuted}`}>Pressione Ctrl (ou Cmd) para selecionar múltiplos.</p>
                            </div>
                        )}

                        {/* Status Ativo */}
                        <div className={`flex items-center justify-between p-5 rounded-2xl border ${theme === 'dark' ? 'bg-slate-900/40 border-white/5' : 'bg-stone-100 border-stone-200'}`}>
                            <div>
                                <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>{formData.ativo ? 'Acesso Liberado' : 'Acesso Bloqueado'}</p>
                                <p className={`text-[11px] font-medium ${t.textMuted}`}>O usuário poderá se autenticar imediatamente.</p>
                            </div>
                            <label className="relative cursor-pointer">
                                <input type="checkbox" name="ativo" className="sr-only" checked={formData.ativo} onChange={handleInputChange} />
                                <div className={`block w-12 h-7 rounded-full transition-colors ${formData.ativo ? 'bg-emerald-500' : theme === 'dark' ? 'bg-slate-700' : 'bg-stone-300'}`}></div>
                                <div className={`absolute left-1 top-1 bg-white w-5 h-5 rounded-full shadow transition-transform ${formData.ativo ? 'translate-x-5' : ''}`}></div>
                            </label>
                        </div>

                        {/* Submit */}
                        <button type="submit" disabled={loadingForm}
                            className={`w-full py-4 bg-gradient-to-r ${t.accent === 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]' ? 'from-cyan-500 to-blue-600' : 'from-[#ff6b35] to-amber-600'} text-white font-bold rounded-2xl shadow-md hover:scale-[1.01] transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm`}>
                            {loadingForm ? (
                                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div> Processando...</>
                            ) : (
                                <><FaUserPlus /> Concluir Cadastro</>
                            )}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}

export default CriarUsuarioMaster;
