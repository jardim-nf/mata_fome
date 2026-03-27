// src/pages/admin/EditarEstabelecimentoMaster.jsx — Premium Light
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { uploadFile } from '../../utils/firebaseStorageService';
import { auditLogger } from '../../utils/auditLogger';
import { 
  FaStore, FaArrowLeft, FaSave, FaCamera, FaBuilding, FaMapMarkerAlt, FaPhone, 
  FaCreditCard, FaSignOutAlt, FaBolt, FaCrown, FaTimes
} from 'react-icons/fa';

// --- Componente de Input ---
function FormInput({ label, name, value, onChange, type = 'text', helpText = '', icon: Icon, ...props }) {
    return (
        <div className="group">
            <label htmlFor={name} className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                {Icon && <Icon className="text-slate-300" />} {label}
            </label>
            <input
                id={name} name={name} value={value || ''} onChange={onChange} type={type} {...props}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold rounded-xl focus:ring-2 focus:ring-yellow-100 focus:border-yellow-400 focus:bg-white block p-3.5 transition-all placeholder-slate-400 outline-none"
            />
            {helpText && <p className="mt-1 text-[11px] text-slate-400 ml-1">{helpText}</p>}
        </div>
    );
}

function EditarEstabelecimentoMaster() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();

    const [formData, setFormData] = useState({
        nome: '', endereco: { rua: '', numero: '', bairro: '', cidade: '' },
        informacoes_contato: { telefone_whatsapp: '', instagram: '', horario_funcionamento: '' },
        chavePix: '', slug: '', imageUrl: '', rating: 0, adminUID: '', ativo: true,
        currentPlanId: '', nextBillingDate: null,
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
                    }));
                    setLogoPreview(data.imageUrl || '');
                    setSlugManuallyEdited(!!data.slug);
                } else { setError("Estabelecimento não encontrado."); }
            } catch (err) { setError("Erro ao carregar dados."); }
            finally { setLoading(false); }
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

    const handleInputChange = (e) => {
        const { name, value, type, checked, files } = e.target;
        if (name === 'slug') setSlugManuallyEdited(true);
        if (type === 'file') {
            const file = files[0]; setLogoImage(file);
            setLogoPreview(file ? URL.createObjectURL(file) : (formData.imageUrl || ''));
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
            const dataToUpdate = { ...formData, imageUrl: finalLogoUrl, rating: Number(formData.rating) || 0, updatedAt: new Date() };
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

    if (loading || authLoading) return <div className="flex h-screen items-center justify-center bg-slate-50"><div className="w-12 h-12 border-4 border-slate-200 border-t-yellow-400 rounded-full animate-spin"></div></div>;
    if (error && !formData.nome) return <div className="text-center p-8 text-red-600 font-bold">{error}</div>;

    return (
        <div className="bg-gradient-to-br from-slate-50 via-white to-amber-50/20 min-h-screen font-sans text-slate-900">
            {/* NAVBAR */}
            <nav className="sticky top-0 z-50 h-16 border-b border-slate-100 bg-white/80 backdrop-blur-xl shadow-sm">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
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

            <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-16">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* HEADER */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <div>
                            <button type="button" onClick={() => navigate('/master/estabelecimentos')} className="text-slate-400 hover:text-yellow-600 flex items-center gap-2 mb-3 text-sm font-bold transition-colors group">
                                <span className="bg-white p-1.5 rounded-lg shadow-sm border border-slate-100 group-hover:border-yellow-200 transition-colors"><FaArrowLeft /></span>
                                Cancelar e Voltar
                            </button>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="bg-yellow-50 text-yellow-700 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-yellow-200">Edição</span>
                            </div>
                            <h1 className="text-3xl font-black tracking-tight">Editar Estabelecimento</h1>
                            <p className="text-slate-500 text-sm mt-1 font-medium">Atualize as informações da loja.</p>
                        </div>
                        <button type="submit" disabled={formLoading}
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-400 to-amber-500 text-white rounded-xl font-black shadow-lg shadow-yellow-400/25 hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 text-sm">
                            {formLoading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div> : <FaSave />}
                            {formLoading ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>

                    {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-200 font-bold flex items-center gap-2"><FaTimes /> {error}</div>}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* COLUNA ESQUERDA */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Identificação */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2"><FaBuilding className="text-yellow-500" /> Identificação</h3>
                                <div className="space-y-4">
                                    <FormInput label="Nome da Loja" name="nome" value={formData.nome} onChange={handleInputChange} required placeholder="Ex: Pizzaria do João" />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormInput label="Slug (URL)" name="slug" value={formData.slug} onChange={handleInputChange} required helpText="Endereço do cardápio." placeholder="pizzaria-do-joao" />
                                        <FormInput label="Chave PIX" name="chavePix" value={formData.chavePix} onChange={handleInputChange} placeholder="CPF, Email ou Aleatória" />
                                    </div>
                                    <FormInput label="Avaliação (0-5)" name="rating" value={formData.rating} onChange={handleInputChange} type="number" min="0" max="5" step="0.1" />
                                </div>
                            </div>

                            {/* Endereço */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2"><FaMapMarkerAlt className="text-yellow-500" /> Localização</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                    <div className="sm:col-span-3"><FormInput label="Rua / Logradouro" name="endereco.rua" value={formData.endereco.rua} onChange={handleInputChange} /></div>
                                    <div className="sm:col-span-1"><FormInput label="Número" name="endereco.numero" value={formData.endereco.numero} onChange={handleInputChange} /></div>
                                    <div className="sm:col-span-2"><FormInput label="Bairro" name="endereco.bairro" value={formData.endereco.bairro} onChange={handleInputChange} /></div>
                                    <div className="sm:col-span-2"><FormInput label="Cidade" name="endereco.cidade" value={formData.endereco.cidade} onChange={handleInputChange} /></div>
                                </div>
                            </div>

                            {/* Contato */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2"><FaPhone className="text-yellow-500" /> Contato</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormInput label="WhatsApp" name="informacoes_contato.telefone_whatsapp" value={formData.informacoes_contato.telefone_whatsapp} onChange={handleInputChange} />
                                    <FormInput label="Instagram" name="informacoes_contato.instagram" value={formData.informacoes_contato.instagram} onChange={handleInputChange} />
                                </div>
                                <div className="mt-4"><FormInput label="Horário Funcionamento" name="informacoes_contato.horario_funcionamento" value={formData.informacoes_contato.horario_funcionamento} onChange={handleInputChange} /></div>
                            </div>
                        </div>

                        {/* COLUNA DIREITA */}
                        <div className="space-y-6">
                            {/* Logo */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center">
                                <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-wider mb-4">Logo da Loja</h3>
                                <div className="relative inline-block group">
                                    <div className="w-32 h-32 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden mx-auto">
                                        {logoPreview || formData.imageUrl ? (
                                            <img src={logoPreview || formData.imageUrl} alt="Logo" className="w-full h-full object-cover" />
                                        ) : <FaCamera className="text-3xl text-slate-300" />}
                                    </div>
                                    <label htmlFor="logoUpload" className="absolute bottom-2 right-2 bg-yellow-400 text-white p-2 rounded-full cursor-pointer hover:bg-yellow-500 transition-colors shadow-lg">
                                        <FaCamera className="text-xs" />
                                    </label>
                                    <input type="file" id="logoUpload" name="logoUpload" accept="image/*" onChange={handleInputChange} className="hidden" />
                                </div>
                                <p className="text-[11px] text-slate-400 mt-2">Recomendado: 500x500px</p>
                            </div>

                            {/* Status */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-wider mb-4">Status da Loja</h3>
                                <label className="flex items-center justify-between cursor-pointer p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                                    <span className="font-bold text-slate-700 text-sm">{formData.ativo ? 'Loja Ativa' : 'Loja Inativa'}</span>
                                    <div className="relative">
                                        <input type="checkbox" name="ativo" className="sr-only" checked={formData.ativo} onChange={handleInputChange} />
                                        <div className={`block w-12 h-7 rounded-full transition-colors ${formData.ativo ? 'bg-emerald-400' : 'bg-slate-300'}`}></div>
                                        <div className={`absolute left-1 top-1 bg-white w-5 h-5 rounded-full shadow transition-transform ${formData.ativo ? 'translate-x-5' : ''}`}></div>
                                    </div>
                                </label>
                            </div>

                            {/* Administrativo */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2"><FaCreditCard className="text-yellow-500" /> Administrativo</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Admin Responsável</label>
                                        <select name="adminUID" value={formData.adminUID} onChange={handleInputChange}
                                            className="w-full bg-slate-50 border border-slate-200 text-sm font-semibold rounded-xl p-3 focus:ring-2 focus:ring-yellow-100 focus:border-yellow-400 outline-none transition-all">
                                            <option value="">Selecione...</option>
                                            {availableAdmins.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Plano Atual</label>
                                        <select name="currentPlanId" value={formData.currentPlanId} onChange={handleInputChange}
                                            className="w-full bg-slate-50 border border-slate-200 text-sm font-semibold rounded-xl p-3 focus:ring-2 focus:ring-yellow-100 focus:border-yellow-400 outline-none transition-all">
                                            <option value="">Selecione...</option>
                                            {availablePlans.map(p => <option key={p.id} value={p.id}>{p.name} - R$ {p.preco}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Próxima Cobrança</label>
                                        <input type="date" name="nextBillingDate" value={(() => {
                                            const d = formData.nextBillingDate;
                                            if (!d) return '';
                                            const dateObj = d.toDate ? d.toDate() : new Date(d);
                                            return isNaN(dateObj.getTime()) ? '' : dateObj.toISOString().split('T')[0];
                                        })()} onChange={handleInputChange}
                                            className="w-full bg-slate-50 border border-slate-200 text-sm font-semibold rounded-xl p-3 focus:ring-2 focus:ring-yellow-100 focus:border-yellow-400 outline-none transition-all" />
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