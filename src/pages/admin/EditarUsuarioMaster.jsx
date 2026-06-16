import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger';
import { motion } from 'framer-motion';
import { 
  FaArrowLeft, FaSave, FaSignOutAlt, FaBolt, FaCrown, FaKey, 
  FaStore, FaUserShield, FaEnvelope, FaUser, FaTimes
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

function EditarUsuarioMaster() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();

    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('dashboard_theme');
        return saved || 'dark';
    });

    const [formData, setFormData] = useState(null);
    const [loadingForm, setLoadingForm] = useState(true);
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
        if (authLoading) return;
        if (!currentUser || !isMasterAdmin) { toast.error('Acesso negado.'); navigate('/master-dashboard'); return; }

        const fetchData = async () => {
            try {
                const userSnap = await getDoc(doc(db, 'usuarios', id));
                if (!userSnap.exists()) throw new Error('Usuário não encontrado.');
                setFormData(userSnap.data());
                const q = query(collection(db, 'estabelecimentos'), orderBy('nome', 'asc'));
                const snap = await getDocs(q);
                setEstabelecimentosList(snap.docs.map(d => ({ id: d.id, nome: d.data().nome })));
            } catch (err) { setFormError(err.message); toast.error(err.message); }
            finally {
                setTimeout(() => {
                    setLoadingForm(false);
                    setLoadingEstabelecimentos(false);
                }, 500);
            }
        };
        fetchData();
    }, [id, currentUser, isMasterAdmin, authLoading, navigate]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleEstabelecimentoChange = (e) => {
        const selected = [...e.target.options].filter(o => o.selected).map(o => o.value);
        setFormData(prev => ({ ...prev, estabelecimentosGerenciados: selected }));
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setLoadingForm(true);
        setFormError('');

        if (currentUser.uid === id && !formData.isMasterAdmin) {
            toast.error("Você não pode remover suas próprias permissões de Master.");
            setLoadingForm(false); return;
        }

        try {
            const userRef = doc(db, 'usuarios', id);
            const { senha, ...dataToUpdate } = formData;
            const oldData = (await getDoc(userRef)).data();
            const changedFields = {};
            for (const key in dataToUpdate) {
                if (JSON.stringify(oldData[key]) !== JSON.stringify(dataToUpdate[key])) {
                    changedFields[key] = { oldValue: oldData[key], newValue: dataToUpdate[key] };
                }
            }
            await updateDoc(userRef, dataToUpdate);
            auditLogger('USUARIO_EDITADO', { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
                { type: 'usuario', id, name: formData.nome }, { changes: changedFields });
            toast.success('Usuário atualizado com sucesso!');
            navigate('/master/usuarios');
        } catch (err) { setFormError(`Erro: ${err.message}`); toast.error(`Erro: ${err.message}`); }
        finally { setLoadingForm(false); }
    };

    const handleSendPasswordReset = async () => {
        if (!formData?.email) return toast.error("E-mail não disponível.");
        setLoadingForm(true);
        try {
            await sendPasswordResetEmail(auth, formData.email);
            auditLogger('USUARIO_SENHA_RESET_SOLICITADO', { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
                { type: 'usuario', id, name: formData.nome }, { emailSentTo: formData.email });
            toast.info(`E-mail de redefinição enviado para ${formData.email}.`);
        } catch (err) { setFormError(`Erro: ${err.message}`); toast.error(`Erro: ${err.message}`); }
        finally { setLoadingForm(false); }
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

    if (authLoading || loadingForm || loadingEstabelecimentos || !formData) return <LoadingScreen />;
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
                        <h1 className={`font-semibold text-sm tracking-tight ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>Editar Usuário</h1>
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
                        Edição
                    </span>
                    <h1 className={`text-3xl font-extrabold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>Perfil: {formData.nome || 'Usuário'}</h1>
                    <p className={`${t.textSecondary} text-sm mt-1 font-medium`}>Modifique permissões, status e redefina credenciais de acesso.</p>
                </div>

                {/* FORM */}
                <div className={`${t.cardBg} rounded-[2rem] p-6 sm:p-8 shadow-sm`}>
                    {formError && <div className="bg-rose-500/10 text-rose-500 p-4 mb-6 rounded-2xl text-sm border border-rose-500/20 font-bold flex items-center gap-2 px-6"><FaTimes /> {formError}</div>}

                    <form onSubmit={handleUpdate} className="space-y-6">
                        {/* Nome */}
                        <div>
                            <label className={`block text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${t.textMuted}`}>
                                <FaUser className={t.textMuted} /> Nome Completo
                            </label>
                            <input name="nome" value={formData.nome || ''} onChange={handleInputChange} required disabled={loadingForm}
                                className={`w-full border text-sm font-semibold rounded-3xl outline-none block px-5 py-4 transition-all placeholder:opacity-50 ${t.inputBg}`} />
                        </div>

                        {/* Email */}
                        <div>
                            <label className={`block text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${t.textMuted}`}>
                                <FaEnvelope className={t.textMuted} /> E-mail
                            </label>
                            <input name="email" type="email" value={formData.email || ''} onChange={handleInputChange} required
                                disabled={loadingForm || currentUser.uid === id}
                                className={`w-full border text-sm font-semibold rounded-3xl outline-none block px-5 py-4 transition-all placeholder:opacity-50 ${t.inputBg} disabled:opacity-50`} />
                            {currentUser.uid === id && <p className={`text-[11px] mt-1 ml-1 font-medium ${t.textMuted}`}>Não é possível alterar seu próprio e-mail.</p>}
                        </div>

                        {/* Reset Senha */}
                        <div className="pt-2">
                            <button type="button" onClick={handleSendPasswordReset} disabled={loadingForm}
                                className={`flex items-center gap-2 px-6 py-3 border rounded-2xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 ${
                                    theme === 'dark'
                                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                                        : 'bg-amber-50 border-amber-250 text-amber-700 hover:bg-amber-100'
                                }`}>
                                <FaKey /> Enviar Email de Redefinição
                            </button>
                        </div>

                        {/* Permissões */}
                        <div className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bg-slate-900/40 border-white/5' : 'bg-stone-100 border-stone-200'}`}>
                            <p className={`text-[11px] font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5 ${t.textMuted}`}>
                                <FaUserShield className={t.textMuted} /> Atribuições
                            </p>
                            <div className="flex flex-wrap gap-6">
                                <label className="flex items-center gap-2.5 cursor-pointer group">
                                    <input type="checkbox" name="isAdmin" checked={formData.isAdmin} onChange={handleInputChange} disabled={loadingForm}
                                        className="h-4.5 w-4.5 rounded-lg border-stone-300 text-cyan-500 focus:ring-cyan-500 cursor-pointer" />
                                    <span className={`text-sm font-bold ${t.textSecondary}`}>Admin de Loja</span>
                                </label>
                                <label className="flex items-center gap-2.5 cursor-pointer group">
                                    <input type="checkbox" name="isMasterAdmin" checked={formData.isMasterAdmin} onChange={handleInputChange}
                                        disabled={loadingForm || currentUser.uid === id}
                                        className="h-4.5 w-4.5 rounded-lg border-stone-300 text-cyan-500 focus:ring-cyan-500 cursor-pointer" />
                                    <span className={`text-sm font-bold ${t.textSecondary}`}>Master Admin</span>
                                </label>
                            </div>
                            {currentUser.uid === id && <p className="text-[11px] text-rose-500 font-semibold mt-2">Você está editando a sua própria conta Master Admin.</p>}
                        </div>

                        {/* Estabelecimentos */}
                        {formData.isAdmin && (
                            <div>
                                <label className={`block text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${t.textMuted}`}>
                                    <FaStore className={t.textMuted} /> Lojas Gerenciadas
                                </label>
                                <select name="estabelecimentosGerenciados" multiple value={formData.estabelecimentosGerenciados || []} onChange={handleEstabelecimentoChange} disabled={loadingForm}
                                    className={`w-full border text-sm font-semibold rounded-3xl p-4 outline-none transition-all h-40 ${t.inputBg}`}>
                                    {estabelecimentosList.map(e => <option key={e.id} value={e.id} className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-stone-900'}>{e.nome}</option>)}
                                </select>
                                <p className={`text-[11px] mt-1.5 ml-1 font-medium ${t.textMuted}`}>Pressione Ctrl (ou Cmd) para selecionar múltiplos.</p>
                            </div>
                        )}

                        {/* Status */}
                        <div className={`flex items-center justify-between p-5 rounded-2xl border ${theme === 'dark' ? 'bg-slate-900/40 border-white/5' : 'bg-stone-100 border-stone-200'}`}>
                            <div>
                                <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>{formData.ativo ? 'Acesso Liberado' : 'Acesso Bloqueado'}</p>
                                <p className={`text-[11px] font-medium ${t.textMuted}`}>Controla a capacidade de fazer login.</p>
                            </div>
                            <label className="relative cursor-pointer">
                                <input type="checkbox" name="ativo" className="sr-only" checked={formData.ativo} onChange={handleInputChange}
                                    disabled={loadingForm || currentUser.uid === id} />
                                <div className={`block w-12 h-7 rounded-full transition-colors ${formData.ativo ? 'bg-emerald-500' : theme === 'dark' ? 'bg-slate-700' : 'bg-stone-300'}`}></div>
                                <div className={`absolute left-1 top-1 bg-white w-5 h-5 rounded-full shadow transition-transform ${formData.ativo ? 'translate-x-5' : ''}`}></div>
                            </label>
                        </div>

                        {/* Submit */}
                        <button type="submit" disabled={loadingForm}
                            className={`w-full py-4 bg-gradient-to-r ${t.accent === 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]' ? 'from-cyan-500 to-blue-600' : 'from-[#ff6b35] to-amber-600'} text-white font-bold rounded-2xl shadow-md hover:scale-[1.01] transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 text-sm`}>
                            {loadingForm ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div> Processando...</> : <><FaSave /> Salvar Alterações</>}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}

export default EditarUsuarioMaster;