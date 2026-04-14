import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { uploadFile } from '../../utils/firebaseStorageService';
import { auditLogger } from '../../utils/auditLogger';
import { 
  FaArrowLeft, FaSave, FaCamera, FaBuilding, FaMapMarkerAlt, FaPhone, 
  FaCreditCard, FaSignOutAlt, FaBolt, FaCrown, FaTimes
} from 'react-icons/fa';
import { IoLogOutOutline } from 'react-icons/io5';

// --- Componente de Input (Bento Style) ---
function FormInput({ label, name, value, onChange, type = 'text', helpText = '', icon: Icon, ...props }) {
    return (
        <div className="group">
            <label htmlFor={name} className="block text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                {Icon && <Icon className="text-[#86868B]" />} {label}
            </label>
            <input
                id={name} name={name} value={value || ''} onChange={onChange} type={type} {...props}
                className="w-full bg-[#F5F5F7] border border-[#E5E5EA] text-[#1D1D1F] text-sm font-semibold rounded-3xl outline-none focus:bg-white focus:border-black block px-5 py-4 transition-all placeholder-[#86868B]"
            />
            {helpText && <p className="mt-2 text-[11px] text-[#86868B] ml-1 font-medium">{helpText}</p>}
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

    if (loading || authLoading) return <div className="flex h-screen items-center justify-center bg-[#F5F5F7]"><FaBolt className="text-[#86868B] text-4xl animate-pulse" /></div>;
    if (error && !formData.nome) return <div className="text-center p-8 text-red-600 font-bold bg-[#F5F5F7] min-h-screen pt-20">{error}</div>;

    return (
        <div className="bg-[#F5F5F7] min-h-screen font-sans text-[#1D1D1F] pb-24 pt-4 px-4 sm:px-8">
            
            {/* ─── FLOATING PILL NAVBAR ─── */}
            <nav className="max-w-[1400px] mx-auto bg-white/70 backdrop-blur-xl border border-white/50 shadow-sm rounded-full h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all">
                <div className="flex items-center gap-4">
                    <button type="button" onClick={() => navigate('/master/estabelecimentos')} className="w-9 h-9 bg-[#F5F5F7] hover:bg-[#E5E5EA] rounded-full flex items-center justify-center transition-colors">
                        <FaArrowLeft className="text-[#86868B] text-sm" />
                    </button>
                    <div className="hidden sm:block border-l border-[#E5E5EA] pl-4">
                        <h1 className="font-semibold text-sm tracking-tight text-black">Modificar Operação</h1>
                        <p className="text-[11px] text-[#86868B] font-medium truncate max-w-[200px]">{formData.nome}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="w-px h-6 bg-[#E5E5EA] hidden sm:block" />
                    <button onClick={async () => { await logout(); navigate('/'); }} className="w-9 h-9 bg-red-50 hover:bg-red-100 rounded-full flex items-center justify-center transition-colors">
                        <IoLogOutOutline className="text-red-500" size={16} />
                    </button>
                </div>
            </nav>

            <main className="max-w-[1400px] mx-auto mt-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* ─── HEADER ─── */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 px-2">
                        <div>
                            <h1 className="text-4xl font-bold tracking-tight text-[#1D1D1F]">Editar Especificações</h1>
                            <p className="text-[#86868B] text-sm mt-1 font-medium">Reescreva as regras, domínios e assinaturas desta praça.</p>
                        </div>
                        <button type="submit" disabled={formLoading}
                            className="flex items-center gap-2 px-8 py-3 bg-black text-white rounded-full font-bold shadow-md hover:bg-gray-800 transition-all active:scale-[0.98] disabled:opacity-50 text-sm">
                            {formLoading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div> : <FaSave />}
                            {formLoading ? 'Salvando...' : 'Processar Alteração'}
                        </button>
                    </div>

                    {error && <div className="bg-[#FFE6E6] text-[#D0021B] p-4 rounded-3xl text-sm border border-[#FFB3B3] font-bold flex items-center gap-2 px-6"><FaTimes /> {error}</div>}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                        {/* ─── COLUNA ESQUERDA ─── */}
                        <div className="lg:col-span-2 space-y-6 md:space-y-8">
                            
                            {/* Identificação */}
                            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-[#E5E5EA]">
                                <h3 className="text-lg font-bold text-[#1D1D1F] mb-6 flex items-center gap-2">Identidade</h3>
                                <div className="space-y-6">
                                    <FormInput label="Nome Oficial da Loja" name="nome" value={formData.nome} onChange={handleInputChange} required placeholder="Ex: Pizzaria do João" />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <FormInput label="Slug (Endereço Web)" name="slug" value={formData.slug} onChange={handleInputChange} required helpText="URL exclusiva da loja." placeholder="pizzaria-do-joao" />
                                        <FormInput label="Chave PIX Recebedora" name="chavePix" value={formData.chavePix} onChange={handleInputChange} placeholder="CNPJ, Celular ou Email" />
                                    </div>
                                    <FormInput label="Nota de Avaliação (Estrelas Visuais)" name="rating" value={formData.rating} onChange={handleInputChange} type="number" min="0" max="5" step="0.1" helpText="De 0 a 5 com decimal." />
                                </div>
                            </div>

                            {/* Endereço */}
                            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-[#E5E5EA]">
                                <h3 className="text-lg font-bold text-[#1D1D1F] mb-6 flex items-center gap-2">Geolocalização / Endereço</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                                    <div className="sm:col-span-3"><FormInput label="Via / Logradouro" name="endereco.rua" value={formData.endereco.rua} onChange={handleInputChange} /></div>
                                    <div className="sm:col-span-1"><FormInput label="Lote / N°" name="endereco.numero" value={formData.endereco.numero} onChange={handleInputChange} /></div>
                                    <div className="sm:col-span-2"><FormInput label="Bairro Original" name="endereco.bairro" value={formData.endereco.bairro} onChange={handleInputChange} /></div>
                                    <div className="sm:col-span-2"><FormInput label="Município / Cidade" name="endereco.cidade" value={formData.endereco.cidade} onChange={handleInputChange} /></div>
                                </div>
                            </div>

                            {/* Contato & Funcionamento */}
                            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-[#E5E5EA]">
                                <h3 className="text-lg font-bold text-[#1D1D1F] mb-6 flex items-center gap-2">Meios de Contato</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <FormInput label="Suporte via WhatsApp" name="informacoes_contato.telefone_whatsapp" value={formData.informacoes_contato.telefone_whatsapp} onChange={handleInputChange} placeholder="(11) 90000-0000" />
                                    <FormInput label="Usuário Instagram" name="informacoes_contato.instagram" value={formData.informacoes_contato.instagram} onChange={handleInputChange} placeholder="@loja" />
                                </div>
                                <div className="mt-6"><FormInput label="Faixas de Operação (Descritivo)" name="informacoes_contato.horario_funcionamento" value={formData.informacoes_contato.horario_funcionamento} onChange={handleInputChange} placeholder="Ex: Ter-Dom 18h às 23h" /></div>
                            </div>
                        </div>

                        {/* ─── COLUNA DIREITA ─── */}
                        <div className="space-y-6 md:space-y-8">
                            
                            {/* Logo */}
                            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-[#E5E5EA] text-center flex flex-col items-center">
                                <h3 className="text-sm font-bold text-[#1D1D1F] mb-6">Emblema Operacional</h3>
                                <div className="relative group w-40 h-40">
                                    <div className="w-full h-full rounded-[2rem] bg-[#F5F5F7] border border-[#E5E5EA] flex items-center justify-center overflow-hidden transition-all group-hover:border-black">
                                        {logoPreview || formData.imageUrl ? (
                                            <img src={logoPreview || formData.imageUrl} alt="Logo" className="w-full h-full object-cover" />
                                        ) : <FaCamera className="text-4xl text-[#86868B]" />}
                                    </div>
                                    <label htmlFor="logoUpload" className="absolute -bottom-3 -right-3 w-12 h-12 bg-black text-white rounded-full cursor-pointer hover:bg-gray-800 transition-colors shadow-lg flex items-center justify-center border-4 border-white">
                                        <FaCamera className="text-sm" />
                                    </label>
                                    <input type="file" id="logoUpload" name="logoUpload" accept="image/*" onChange={handleInputChange} className="hidden" />
                                </div>
                                <p className="text-[11px] text-[#86868B] mt-6 font-medium bg-[#F5F5F7] px-4 py-2 rounded-full">Recomendado: 500x500px</p>
                            </div>

                            {/* Status Sistêmico */}
                            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-[#E5E5EA]">
                                <h3 className="text-sm font-bold text-[#1D1D1F] mb-6">Bloqueio Proibitivo</h3>
                                <label className={`flex items-center justify-between cursor-pointer p-4 rounded-[1.5rem] transition-colors border ${formData.ativo ? 'bg-[#F2FCDA] border-[#D0F2A8]' : 'bg-[#F5F5F7] border-[#E5E5EA]'}`}>
                                    <span className={`font-bold text-sm ${formData.ativo ? 'text-[#1D7446]' : 'text-[#86868B]'}`}>
                                        {formData.ativo ? 'Funcionamento Livre' : 'Operação Congelada'}
                                    </span>
                                    <div className="relative">
                                        <input type="checkbox" name="ativo" className="sr-only" checked={formData.ativo} onChange={handleInputChange} />
                                        <div className={`block w-14 h-8 rounded-full transition-colors ${formData.ativo ? 'bg-[#1D7446]' : 'bg-[#E5E5EA]'}`}></div>
                                        <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full shadow-sm transition-transform duration-300 ${formData.ativo ? 'translate-x-6' : ''}`}></div>
                                    </div>
                                </label>
                            </div>

                            {/* Faturamento e Propriedade */}
                            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-[#E5E5EA]">
                                <h3 className="text-sm font-bold text-[#1D1D1F] mb-6">Patrimônio & Custódia</h3>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-bold text-[#86868B] uppercase tracking-wider mb-2">Conta Administrativa Mestre</label>
                                        <select name="adminUID" value={formData.adminUID} onChange={handleInputChange}
                                            className="w-full bg-[#F5F5F7] border border-[#E5E5EA] text-[#1D1D1F] text-sm font-semibold rounded-3xl p-4 focus:bg-white focus:border-black outline-none transition-all appearance-none cursor-pointer">
                                            <option value="">Livre / Órfã...</option>
                                            {availableAdmins.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-[#86868B] uppercase tracking-wider mb-2">Plano Contratado (BaaS)</label>
                                        <select name="currentPlanId" value={formData.currentPlanId} onChange={handleInputChange}
                                            className="w-full bg-[#F5F5F7] border border-[#E5E5EA] text-[#1D1D1F] text-sm font-semibold rounded-3xl p-4 focus:bg-white focus:border-black outline-none transition-all appearance-none cursor-pointer">
                                            <option value="">Off-Grid (Sem Contrato)</option>
                                            {availablePlans.map(p => <option key={p.id} value={p.id}>{p.name} - R$ {p.preco}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-[#86868B] uppercase tracking-wider mb-2">Vencimento de Fatura Gerada Automática</label>
                                        <input type="date" name="nextBillingDate" value={(() => {
                                            const d = formData.nextBillingDate;
                                            if (!d) return '';
                                            const dateObj = d instanceof Date ? d : (d.toDate ? d.toDate() : new Date(d));
                                            return isNaN(dateObj.getTime()) ? '' : dateObj.toISOString().split('T')[0];
                                        })()} onChange={handleInputChange}
                                            className="w-full bg-[#F5F5F7] border border-[#E5E5EA] text-[#1D1D1F] text-sm font-semibold rounded-3xl p-4 focus:bg-white focus:border-black outline-none transition-all" />
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </form>
            </main>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
                .tabular-nums { font-variant-numeric: tabular-nums; }
            `}</style>
        </div>
    );
}

export default EditarEstabelecimentoMaster;