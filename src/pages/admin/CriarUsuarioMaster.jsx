// src/pages/admin/CriarUsuarioMaster.jsx — Premium Light
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { 
  FaArrowLeft, FaUserPlus, FaSignOutAlt, FaStore, FaBolt, FaCrown,
  FaEnvelope, FaLock, FaUser, FaUserShield, FaToggleOn, FaToggleOff
} from 'react-icons/fa';

function CriarUsuarioMaster() {
    const navigate = useNavigate();
    const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();

    const [formData, setFormData] = useState({
        nome: '', email: '', senha: '',
        isAdmin: false, isMasterAdmin: false, ativo: true,
        estabelecimentosGerenciados: [],
    });
    const [loadingForm, setLoadingForm] = useState(false);
    const [formError, setFormError] = useState('');
    const [estabelecimentosList, setEstabelecimentosList] = useState([]);
    const [loadingEstabelecimentos, setLoadingEstabelecimentos] = useState(true);

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
            finally { setLoadingEstabelecimentos(false); }
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

    if (authLoading) return (
        <div className="flex h-screen items-center justify-center bg-slate-50">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-yellow-400 rounded-full animate-spin"></div>
        </div>
    );
    if (!isMasterAdmin) return null;

    return (
        <div className="bg-gradient-to-br from-slate-50 via-white to-amber-50/20 min-h-screen font-sans">
            {/* NAVBAR */}
            <nav className="sticky top-0 z-50 h-16 border-b border-slate-100 bg-white/80 backdrop-blur-xl shadow-sm">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-md shadow-yellow-400/25 group-hover:scale-105 transition-transform">
                            <FaBolt className="text-white text-xs" />
                        </div>
                        <span className="text-slate-900 font-black text-lg tracking-tight">Idea<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-amber-500">Food</span></span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center justify-center">
                            <FaCrown className="text-yellow-600 text-[10px]" />
                        </div>
                        <button onClick={async () => { await logout(); navigate('/'); }} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all" title="Sair">
                            <FaSignOutAlt size={14} />
                        </button>
                    </div>
                </div>
            </nav>

            {/* CONTENT */}
            <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-16">
                {/* HEADER */}
                <div className="mb-8">
                    <button onClick={() => navigate('/master/usuarios')} className="text-slate-400 hover:text-yellow-600 flex items-center gap-2 mb-4 text-sm font-bold transition-colors group">
                        <span className="bg-white p-1.5 rounded-lg shadow-sm border border-slate-100 group-hover:border-yellow-200 transition-colors"><FaArrowLeft /></span>
                        Voltar para Usuários
                    </button>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="bg-yellow-50 text-yellow-700 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-yellow-200">Novo Cadastro</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Criar Usuário</h1>
                    <p className="text-slate-500 text-sm mt-1 font-medium">Cadastre um novo acesso ao sistema IdeaFood.</p>
                </div>

                {/* FORM CARD */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
                    {formError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-4 mb-6 rounded-xl text-sm font-bold flex items-center gap-3">
                            ⚠️ {formError}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Nome */}
                        <div>
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                                <FaUser className="inline mr-1.5 text-slate-300" /> Nome Completo *
                            </label>
                            <input name="nome" value={formData.nome} onChange={handleInputChange} required placeholder="Ex: João Silva"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm font-semibold text-slate-700 placeholder-slate-400 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 focus:bg-white transition-all" />
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                                <FaEnvelope className="inline mr-1.5 text-slate-300" /> E-mail *
                            </label>
                            <input name="email" type="email" value={formData.email} onChange={handleInputChange} required placeholder="email@exemplo.com"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm font-semibold text-slate-700 placeholder-slate-400 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 focus:bg-white transition-all" />
                        </div>

                        {/* Senha */}
                        <div>
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                                <FaLock className="inline mr-1.5 text-slate-300" /> Senha Inicial *
                            </label>
                            <input name="senha" type="password" value={formData.senha} onChange={handleInputChange} required minLength="6" placeholder="Mínimo 6 caracteres" autoComplete="new-password"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm font-semibold text-slate-700 placeholder-slate-400 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 focus:bg-white transition-all" />
                            <p className="text-[11px] text-slate-400 mt-1.5 ml-1">O usuário deve alterá-la após o primeiro login.</p>
                        </div>

                        {/* Permissões */}
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3"><FaUserShield className="inline mr-1.5 text-slate-300" /> Permissões</p>
                            <div className="flex flex-wrap gap-4">
                                <label className="flex items-center gap-2.5 cursor-pointer group">
                                    <input type="checkbox" name="isAdmin" checked={formData.isAdmin} onChange={handleInputChange}
                                        className="h-4 w-4 rounded border-slate-300 text-yellow-500 focus:ring-yellow-500" />
                                    <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">Admin de Loja</span>
                                </label>
                                <label className="flex items-center gap-2.5 cursor-pointer group">
                                    <input type="checkbox" name="isMasterAdmin" checked={formData.isMasterAdmin} onChange={handleInputChange}
                                        className="h-4 w-4 rounded border-slate-300 text-yellow-500 focus:ring-yellow-500" />
                                    <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">Master Admin</span>
                                </label>
                            </div>
                        </div>

                        {/* Estabelecimentos */}
                        {formData.isAdmin && (
                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                                    <FaStore className="inline mr-1.5 text-slate-300" /> Lojas Gerenciadas *
                                </label>
                                <select name="estabelecimentosGerenciados" multiple value={formData.estabelecimentosGerenciados} onChange={handleEstabelecimentoChange} required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-700 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 h-40 transition-all">
                                    {loadingEstabelecimentos ? <option disabled>Carregando...</option> :
                                     estabelecimentosList.length === 0 ? <option disabled>Nenhum disponível</option> :
                                     estabelecimentosList.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                                </select>
                                <p className="text-[11px] text-slate-400 mt-1.5 ml-1">Ctrl+click para selecionar múltiplos.</p>
                            </div>
                        )}

                        {/* Status Ativo */}
                        <div className="flex items-center justify-between bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <div>
                                <p className="text-sm font-bold text-slate-800">{formData.ativo ? 'Usuário Ativo' : 'Usuário Inativo'}</p>
                                <p className="text-[11px] text-slate-400">O usuário poderá acessar o sistema imediatamente.</p>
                            </div>
                            <label className="relative cursor-pointer">
                                <input type="checkbox" name="ativo" className="sr-only" checked={formData.ativo} onChange={handleInputChange} />
                                <div className={`block w-12 h-7 rounded-full transition-colors ${formData.ativo ? 'bg-emerald-400' : 'bg-slate-300'}`}></div>
                                <div className={`absolute left-1 top-1 bg-white w-5 h-5 rounded-full shadow transition-transform ${formData.ativo ? 'translate-x-5' : ''}`}></div>
                            </label>
                        </div>

                        {/* Submit */}
                        <button type="submit" disabled={loadingForm}
                            className="w-full py-4 bg-gradient-to-r from-yellow-400 to-amber-500 text-white font-black rounded-xl shadow-lg shadow-yellow-400/25 hover:shadow-xl hover:shadow-yellow-400/40 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                            {loadingForm ? (
                                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div> Criando...</>
                            ) : (
                                <><FaUserPlus /> Criar Usuário</>
                            )}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}

export default CriarUsuarioMaster;
