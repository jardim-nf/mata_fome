// src/pages/admin/EditarUsuarioMaster.jsx — Premium Light
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger';
import { FaArrowLeft, FaSave, FaSignOutAlt, FaBolt, FaCrown, FaKey, FaStore, FaUserShield, FaEnvelope, FaUser } from 'react-icons/fa';

function EditarUsuarioMaster() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();

    const [formData, setFormData] = useState(null);
    const [loadingForm, setLoadingForm] = useState(true);
    const [formError, setFormError] = useState('');
    const [estabelecimentosList, setEstabelecimentosList] = useState([]);
    const [loadingEstabelecimentos, setLoadingEstabelecimentos] = useState(true);

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
            finally { setLoadingForm(false); setLoadingEstabelecimentos(false); }
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

    if (authLoading || loadingForm || loadingEstabelecimentos || !formData) return (
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
                        <div className="w-8 h-8 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center justify-center"><FaCrown className="text-yellow-600 text-[10px]" /></div>
                        <button onClick={async () => { await logout(); navigate('/'); }} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"><FaSignOutAlt size={14} /></button>
                    </div>
                </div>
            </nav>

            <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-16">
                {/* HEADER */}
                <div className="mb-8">
                    <button onClick={() => navigate('/master/usuarios')} className="text-slate-400 hover:text-yellow-600 flex items-center gap-2 mb-4 text-sm font-bold transition-colors group">
                        <span className="bg-white p-1.5 rounded-lg shadow-sm border border-slate-100 group-hover:border-yellow-200 transition-colors"><FaArrowLeft /></span>
                        Voltar para Usuários
                    </button>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="bg-yellow-50 text-yellow-700 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-yellow-200">Edição</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Editar: {formData.nome || 'Usuário'}</h1>
                    <p className="text-slate-500 text-sm mt-1 font-medium">Atualize dados, permissões e status deste acesso.</p>
                </div>

                {/* FORM */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
                    {formError && <div className="bg-red-50 border border-red-200 text-red-700 p-4 mb-6 rounded-xl text-sm font-bold">⚠️ {formError}</div>}

                    <form onSubmit={handleUpdate} className="space-y-6">
                        <div>
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2"><FaUser className="inline mr-1.5 text-slate-300" /> Nome Completo</label>
                            <input name="nome" value={formData.nome || ''} onChange={handleInputChange} required disabled={loadingForm}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm font-semibold text-slate-700 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 focus:bg-white transition-all" />
                        </div>

                        <div>
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2"><FaEnvelope className="inline mr-1.5 text-slate-300" /> E-mail</label>
                            <input name="email" type="email" value={formData.email || ''} onChange={handleInputChange} required
                                disabled={loadingForm || currentUser.uid === id}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-sm font-semibold text-slate-700 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 focus:bg-white transition-all disabled:opacity-50" />
                            {currentUser.uid === id && <p className="text-[11px] text-slate-400 mt-1 ml-1">Não é possível alterar seu próprio e-mail.</p>}
                        </div>

                        {/* Reset Senha */}
                        <button type="button" onClick={handleSendPasswordReset} disabled={loadingForm}
                            className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl font-bold text-sm hover:bg-amber-100 transition-all active:scale-95 disabled:opacity-50">
                            <FaKey /> Enviar Reset de Senha
                        </button>

                        {/* Permissões */}
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3"><FaUserShield className="inline mr-1.5 text-slate-300" /> Permissões</p>
                            <div className="flex flex-wrap gap-4">
                                <label className="flex items-center gap-2.5 cursor-pointer group">
                                    <input type="checkbox" name="isAdmin" checked={formData.isAdmin} onChange={handleInputChange} disabled={loadingForm}
                                        className="h-4 w-4 rounded border-slate-300 text-yellow-500 focus:ring-yellow-500" />
                                    <span className="text-sm font-semibold text-slate-700">Admin de Loja</span>
                                </label>
                                <label className="flex items-center gap-2.5 cursor-pointer group">
                                    <input type="checkbox" name="isMasterAdmin" checked={formData.isMasterAdmin} onChange={handleInputChange}
                                        disabled={loadingForm || currentUser.uid === id}
                                        className="h-4 w-4 rounded border-slate-300 text-yellow-500 focus:ring-yellow-500" />
                                    <span className="text-sm font-semibold text-slate-700">Master Admin</span>
                                </label>
                            </div>
                            {currentUser.uid === id && <p className="text-[11px] text-red-500 mt-2">Não é possível remover sua própria permissão Master.</p>}
                        </div>

                        {/* Estabelecimentos */}
                        {formData.isAdmin && (
                            <div>
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2"><FaStore className="inline mr-1.5 text-slate-300" /> Lojas Gerenciadas</label>
                                <select name="estabelecimentosGerenciados" multiple value={formData.estabelecimentosGerenciados || []} onChange={handleEstabelecimentoChange} disabled={loadingForm}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-700 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 h-40 transition-all">
                                    {estabelecimentosList.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                                </select>
                                <p className="text-[11px] text-slate-400 mt-1.5 ml-1">Ctrl+click para selecionar múltiplos.</p>
                            </div>
                        )}

                        {/* Status */}
                        <div className="flex items-center justify-between bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <div>
                                <p className="text-sm font-bold text-slate-800">{formData.ativo ? 'Usuário Ativo' : 'Usuário Inativo'}</p>
                                <p className="text-[11px] text-slate-400">Controla acesso ao sistema.</p>
                            </div>
                            <label className="relative cursor-pointer">
                                <input type="checkbox" name="ativo" className="sr-only" checked={formData.ativo} onChange={handleInputChange}
                                    disabled={loadingForm || currentUser.uid === id} />
                                <div className={`block w-12 h-7 rounded-full transition-colors ${formData.ativo ? 'bg-emerald-400' : 'bg-slate-300'}`}></div>
                                <div className={`absolute left-1 top-1 bg-white w-5 h-5 rounded-full shadow transition-transform ${formData.ativo ? 'translate-x-5' : ''}`}></div>
                            </label>
                        </div>

                        {/* Submit */}
                        <button type="submit" disabled={loadingForm}
                            className="w-full py-4 bg-gradient-to-r from-yellow-400 to-amber-500 text-white font-black rounded-xl shadow-lg shadow-yellow-400/25 hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                            {loadingForm ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div> Salvando...</> : <><FaSave /> Salvar Alterações</>}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}

export default EditarUsuarioMaster;