import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { uploadFile } from '../../utils/firebaseStorageService';
import { auditLogger } from '../../utils/auditLogger';
import { 
  FaStore, 
  FaArrowLeft, 
  FaSave, 
  FaCamera, 
  FaCheck, 
  FaTimes, 
  FaBuilding, 
  FaMapMarkerAlt, 
  FaPhone, 
  FaCreditCard 
} from 'react-icons/fa';

// --- Header Minimalista (Reutilizado para consistência) ---
const DashboardHeader = ({ navigate }) => (
  <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 h-16 transition-all duration-300">
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center">
      <div className="flex items-center gap-1 cursor-pointer" onClick={() => navigate('/')}>
          <div className="bg-yellow-400 text-black font-bold p-1 rounded-sm transform -skew-x-12">
              <FaStore />
          </div>
          <span className="text-gray-900 font-extrabold text-xl tracking-tight">
              Na<span className="text-yellow-500">Mão</span>
          </span>
      </div>
    </div>
  </header>
);

// --- Componente de Input Moderno ---
function FormInput({ label, name, value, onChange, type = 'text', helpText = '', icon: Icon, ...props }) {
    return (
        <div className="group">
            <label htmlFor={name} className="block text-xs font-bold text-gray-500 uppercase mb-1.5 flex items-center gap-2">
                {Icon && <Icon className="text-gray-400" />} {label}
            </label>
            <div className="relative">
                <input
                    id={name}
                    name={name}
                    value={value || ''}
                    onChange={onChange}
                    type={type}
                    {...props}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-black focus:border-transparent block p-3 transition-all placeholder-gray-400"
                />
            </div>
            {helpText && <p className="mt-1 text-xs text-gray-400">{helpText}</p>}
        </div>
    );
}

function EditarEstabelecimentoMaster() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();

    const [formData, setFormData] = useState({
        nome: '',
        endereco: { rua: '', numero: '', bairro: '', cidade: '' },
        informacoes_contato: { telefone_whatsapp: '', instagram: '', horario_funcionamento: '' },
        chavePix: '',
        slug: '',
        imageUrl: '',
        rating: 0,
        adminUID: '',
        ativo: true,
        currentPlanId: '',
        nextBillingDate: null,
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

    // --- CARREGAMENTO INICIAL ---
    useEffect(() => {
        if (authLoading) return;
        if (!isMasterAdmin) {
            toast.error('Acesso negado.');
            navigate('/painel');
            return;
        }

        const fetchEstablishment = async () => {
            try {
                const docRef = doc(db, 'estabelecimentos', id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setFormData(prev => ({
                        ...prev,
                        ...data,
                        endereco: data.endereco || { rua: '', numero: '', bairro: '', cidade: '' },
                        informacoes_contato: data.informacoes_contato || { telefone_whatsapp: '', instagram: '', horario_funcionamento: '' },
                        nextBillingDate: data.nextBillingDate?.toDate ? data.nextBillingDate.toDate() : null,
                        adminUID: data.adminUID || '',
                        currentPlanId: data.currentPlanId || '',
                        slug: data.slug || '',
                        chavePix: data.chavePix || '',
                        imageUrl: data.imageUrl || '',
                        nome: data.nome || '',
                    }));
                    setLogoPreview(data.imageUrl || '');
                    setSlugManuallyEdited(!!data.slug);
                } else {
                    setError("Estabelecimento não encontrado.");
                }
            } catch (err) {
                console.error("Erro ao buscar:", err);
                setError("Erro ao carregar dados.");
            } finally {
                setLoading(false);
            }
        };

        fetchEstablishment();
    }, [id, isMasterAdmin, authLoading, navigate]);

    // --- CARREGAR ADMINS ---
    useEffect(() => {
        if (!isMasterAdmin || !currentUser) return;
        const fetchAdmins = async () => {
            try {
                const q = query(collection(db, 'usuarios'), where('isAdmin', '==', true), orderBy('nome', 'asc'));
                const querySnapshot = await getDocs(q);
                setAvailableAdmins(querySnapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome, email: doc.data().email })));
            } catch (err) { console.error(err); } finally { setLoadingAdmins(false); }
        };
        fetchAdmins();
    }, [isMasterAdmin, currentUser]);

    // --- CARREGAR PLANOS ---
    useEffect(() => {
        if (!isMasterAdmin || !currentUser) return;
        const fetchPlans = async () => {
            try {
                let q = query(collection(db, 'planos'), orderBy('preco', 'asc'));
                let querySnapshot = await getDocs(q);
                
                if (querySnapshot.empty) {
                    q = query(collection(db, 'plans'), orderBy('preco', 'asc'));
                    querySnapshot = await getDocs(q);
                }
                
                const plans = querySnapshot.docs.map(doc => {
                    const d = doc.data();
                    return { id: doc.id, name: d.nome || d.name || 'Sem Nome', preco: d.preco || 0 };
                });
                setAvailablePlans(plans);
            } catch (err) { console.error(err); } finally { setLoadingPlans(false); }
        };
        fetchPlans();
    }, [isMasterAdmin, currentUser]);

    // --- HANDLERS ---
    const handleInputChange = (e) => {
        const { name, value, type, checked, files } = e.target;
        if (name === 'slug') setSlugManuallyEdited(true);

        if (type === 'file') {
            const file = files[0];
            setLogoImage(file);
            if (file) {
                setLogoPreview(URL.createObjectURL(file));
            } else {
                setLogoPreview(formData.imageUrl || '');
            }
        } else if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({
                ...prev,
                [parent]: { ...prev[parent], [child]: type === 'checkbox' ? checked : (value || '') }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : (value || '') }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        setError('');

        const { nome, slug } = formData;
        if (!nome.trim() || !slug.trim()) {
            toast.warn("Nome e Slug são obrigatórios.");
            setFormLoading(false);
            return;
        }

        let finalLogoUrl = formData.imageUrl;

        try {
            if (logoImage) {
                const logoName = `establishment_logos/${formData.slug || id}_${Date.now()}_${logoImage.name}`;
                finalLogoUrl = await uploadFile(logoImage, logoName);
            }

            // Validação de Slug Único
            const currentDoc = await getDoc(doc(db, 'estabelecimentos', id));
            const currentData = currentDoc.data();
            
            if (formData.slug !== currentData.slug) {
                const slugQuery = query(collection(db, 'estabelecimentos'), where('slug', '==', formData.slug));
                const slugSnapshot = await getDocs(slugQuery);
                if (!slugSnapshot.empty && slugSnapshot.docs[0].id !== id) {
                    setError('Este slug já está em uso.');
                    setFormLoading(false);
                    return;
                }
            }

            const dataToUpdate = {
                ...formData,
                imageUrl: finalLogoUrl,
                rating: Number(formData.rating) || 0,
                updatedAt: new Date(),
            };

            const docRef = doc(db, 'estabelecimentos', id);
            await updateDoc(docRef, dataToUpdate);

            // Atualização de vínculo de Admin (Lógica mantida do original)
            if (currentData.adminUID !== formData.adminUID) {
                 // ... (Lógica de atualizar array do usuário admin antigo e novo - mantida igual)
                 if (currentData.adminUID) {
                    const oldAdminRef = doc(db, 'usuarios', currentData.adminUID);
                    const oldSnap = await getDoc(oldAdminRef);
                    if (oldSnap.exists()) {
                        const oldData = oldSnap.data();
                        const updated = (oldData.estabelecimentosGerenciados || []).filter(eid => eid !== id);
                        await updateDoc(oldAdminRef, { estabelecimentosGerenciados: updated });
                    }
                }
                if (formData.adminUID) {
                    const newAdminRef = doc(db, 'usuarios', formData.adminUID);
                    const newSnap = await getDoc(newAdminRef);
                    if (newSnap.exists()) {
                        const newData = newSnap.data();
                        const current = newData.estabelecimentosGerenciados || [];
                        if (!current.includes(id)) {
                            await updateDoc(newAdminRef, { estabelecimentosGerenciados: [...current, id] });
                        }
                    }
                }
            }

            auditLogger('ESTABELECIMENTO_ATUALIZADO', { uid: currentUser.uid, email: currentUser.email }, { id: id, name: formData.nome });
            toast.success("Atualizado com sucesso!");
            navigate('/master/estabelecimentos');
        } catch (err) {
            console.error(err);
            setError("Erro ao salvar.");
            toast.error("Erro ao salvar.");
        } finally {
            setFormLoading(false);
        }
    };

    if (loading || authLoading) return <div className="flex h-screen items-center justify-center bg-gray-50"><div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div></div>;
    if (error && !formData.nome) return <div className="text-center p-8 text-red-600">{error}</div>;

    return (
        <div className="bg-gray-50 min-h-screen pt-20 pb-12 font-sans text-gray-900">
            <DashboardHeader navigate={navigate} />
            
            <div className="max-w-4xl mx-auto px-4 sm:px-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* Header da Página */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                        <div>
                            <button type="button" onClick={() => navigate('/master/estabelecimentos')} className="text-gray-400 hover:text-gray-600 flex items-center gap-2 mb-2 text-sm font-medium transition-colors">
                                <FaArrowLeft /> Cancelar e Voltar
                            </button>
                            <h1 className="text-3xl font-bold tracking-tight">Editar Estabelecimento</h1>
                            <p className="text-gray-500 text-sm mt-1">Atualize as informações da loja.</p>
                        </div>
                        <div className="flex gap-3">
                            <button 
                                type="submit" 
                                disabled={formLoading} 
                                className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg disabled:opacity-50"
                            >
                                {formLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <FaSave />}
                                {formLoading ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </div>
                    </div>

                    {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 flex items-center gap-2"><FaTimes /> {error}</div>}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* COLUNA ESQUERDA - INFOS PRINCIPAIS */}
                        <div className="lg:col-span-2 space-y-6">
                            
                            {/* Card Identificação */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><FaBuilding className="text-yellow-500"/> Identificação</h3>
                                <div className="space-y-4">
                                    <FormInput label="Nome da Loja" name="nome" value={formData.nome} onChange={handleInputChange} required placeholder="Ex: Pizzaria do João" />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormInput label="Slug (URL)" name="slug" value={formData.slug} onChange={handleInputChange} required helpText="Endereço do cardápio." placeholder="pizzaria-do-joao" />
                                        <FormInput label="Chave PIX" name="chavePix" value={formData.chavePix} onChange={handleInputChange} placeholder="CPF, Email ou Aleatória" />
                                    </div>
                                    <FormInput label="Avaliação Inicial (0-5)" name="rating" value={formData.rating} onChange={handleInputChange} type="number" min="0" max="5" step="0.1" />
                                </div>
                            </div>

                            {/* Card Endereço */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><FaMapMarkerAlt className="text-yellow-500"/> Localização</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                    <div className="sm:col-span-3">
                                        <FormInput label="Rua / Logradouro" name="endereco.rua" value={formData.endereco.rua} onChange={handleInputChange} />
                                    </div>
                                    <div className="sm:col-span-1">
                                        <FormInput label="Número" name="endereco.numero" value={formData.endereco.numero} onChange={handleInputChange} />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <FormInput label="Bairro" name="endereco.bairro" value={formData.endereco.bairro} onChange={handleInputChange} />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <FormInput label="Cidade" name="endereco.cidade" value={formData.endereco.cidade} onChange={handleInputChange} />
                                    </div>
                                </div>
                            </div>

                            {/* Card Contato */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><FaPhone className="text-yellow-500"/> Contato</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormInput label="WhatsApp" name="informacoes_contato.telefone_whatsapp" value={formData.informacoes_contato.telefone_whatsapp} onChange={handleInputChange} />
                                    <FormInput label="Instagram" name="informacoes_contato.instagram" value={formData.informacoes_contato.instagram} onChange={handleInputChange} />
                                </div>
                                <div className="mt-4">
                                    <FormInput label="Horário Funcionamento" name="informacoes_contato.horario_funcionamento" value={formData.informacoes_contato.horario_funcionamento} onChange={handleInputChange} />
                                </div>
                            </div>

                        </div>

                        {/* COLUNA DIREITA - CONFIGURAÇÕES */}
                        <div className="space-y-6">
                            
                            {/* Card Logo */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
                                <h3 className="text-sm font-bold uppercase text-gray-400 mb-4">Logo da Loja</h3>
                                <div className="relative inline-block group">
                                    <div className="w-32 h-32 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden mx-auto">
                                        {logoPreview || formData.imageUrl ? (
                                            <img src={logoPreview || formData.imageUrl} alt="Logo" className="w-full h-full object-cover" />
                                        ) : (
                                            <FaCamera className="text-3xl text-gray-300" />
                                        )}
                                    </div>
                                    <label htmlFor="logoUpload" className="absolute bottom-2 right-2 bg-black text-white p-2 rounded-full cursor-pointer hover:bg-gray-800 transition-colors shadow-lg">
                                        <FaCamera className="text-xs" />
                                    </label>
                                    <input type="file" id="logoUpload" name="logoUpload" accept="image/*" onChange={handleInputChange} className="hidden" />
                                </div>
                                <p className="text-xs text-gray-400 mt-2">Recomendado: 500x500px</p>
                            </div>

                            {/* Card Status */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="text-sm font-bold uppercase text-gray-400 mb-4">Status da Loja</h3>
                                <label className="flex items-center justify-between cursor-pointer p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                    <span className="font-semibold text-gray-700">{formData.ativo ? 'Loja Ativa' : 'Loja Inativa'}</span>
                                    <div className="relative">
                                        <input type="checkbox" name="ativo" className="sr-only" checked={formData.ativo} onChange={handleInputChange} />
                                        <div className={`block w-12 h-7 rounded-full transition-colors ${formData.ativo ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                        <div className={`absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${formData.ativo ? 'transform translate-x-5' : ''}`}></div>
                                    </div>
                                </label>
                            </div>

                            {/* Card Administrativo */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><FaCreditCard className="text-yellow-500"/> Administrativo</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Admin Responsável</label>
                                        <select name="adminUID" value={formData.adminUID} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 text-sm rounded-xl p-3 focus:ring-2 focus:ring-black">
                                            <option value="">Selecione...</option>
                                            {availableAdmins.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                                        </select>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Plano Atual</label>
                                        <select name="currentPlanId" value={formData.currentPlanId} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 text-sm rounded-xl p-3 focus:ring-2 focus:ring-black">
                                            <option value="">Selecione...</option>
                                            {availablePlans.map(p => <option key={p.id} value={p.id}>{p.name} - R$ {p.preco}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Próxima Cobrança</label>
                                        <input type="date" name="nextBillingDate" value={formData.nextBillingDate ? formData.nextBillingDate.toISOString().split('T')[0] : ''} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 text-sm rounded-xl p-3 focus:ring-2 focus:ring-black" />
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default EditarEstabelecimentoMaster;