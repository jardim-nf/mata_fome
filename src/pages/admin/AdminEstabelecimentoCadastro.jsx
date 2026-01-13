import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore'; 
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext'; 
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger';
import { uploadFile } from '../../utils/firebaseStorageService'; 

// Componente FormInput Atualizado
function FormInput({ label, name, value, onChange, type = 'text', helpText = '', required = false, ...props }) {
    return (
        <div className="space-y-2">
            <label htmlFor={name} className="block text-sm font-semibold text-gray-700">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
                id={name}
                name={name}
                value={value || ''}
                onChange={onChange}
                type={type}
                required={required}
                className="w-full rounded-xl border-gray-300 bg-gray-50 px-4 py-3 text-gray-800 placeholder-gray-500 transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 focus:shadow-lg border-0"
                {...props}
            />
            {helpText && <p className="text-xs text-gray-500 mt-1">{helpText}</p>}
        </div>
    );
}

// Componente FormSection para agrupar campos
function FormSection({ title, children, icon }) {
    return (
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                {icon && (
                    <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center">
                        {icon}
                    </div>
                )}
                <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
            </div>
            <div className="space-y-6">
                {children}
            </div>
        </div>
    );
}

function AdminEstabelecimentoCadastro() {
    const navigate = useNavigate();
    const { currentUser, isMasterAdmin, loading: authLoading } = useAuth(); 

    const [formData, setFormData] = useState({
        nome: '',
        slug: '',
        chavePix: '',
        imageUrl: '',
        rating: 0,
        adminUID: '',
        ativo: true,
        currentPlanId: '',
        endereco: { rua: '', numero: '', bairro: '', cidade: '' },
        informacoes_contato: { telefone_whatsapp: '', instagram: '', horario_funcionamento: '' }
    });

    const [logoImage, setLogoImage] = useState(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [availableAdmins, setAvailableAdmins] = useState([]);
    const [availablePlans, setAvailablePlans] = useState([]);
    const [loadingForm, setLoadingForm] = useState(false);
    const [loadingAdmins, setLoadingAdmins] = useState(true);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [formError, setFormError] = useState('');
    const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

    const slugify = useCallback((text) =>
        text.toString().toLowerCase().trim()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-')
            .replace(/[^\w-]+/g, '')
            .replace(/--+/g, '-'),
    []);

    // --- EFEITOS DE CARREGAMENTO DE DADOS ---
    useEffect(() => {
        if (!authLoading && (!currentUser || !isMasterAdmin)) {
            toast.error('Acesso negado. Você não tem permissões de Master Administrador.');
            navigate('/master-dashboard');
            return;
        }

        if (isMasterAdmin && currentUser) {
            // Carrega Admins
            const fetchAdmins = async () => {
                try {
                    const q = query(collection(db, 'usuarios'), where('isAdmin', '==', true), orderBy('nome', 'asc'));
                    const querySnapshot = await getDocs(q);
                    const admins = querySnapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome, email: doc.data().email }));
                    setAvailableAdmins(admins);
                } catch (err) {
                    console.error("Erro ao carregar administradores:", err);
                    setFormError("Erro ao carregar lista de administradores. Crie o índice (usuarios: isAdmin, nome).");
                } finally {
                    setLoadingAdmins(false);
                }
            };
            fetchAdmins();

            // Carrega Planos
            const fetchPlans = async () => {
                try {
                    const q = query(collection(db, 'plans'), where('isActive', '==', true), orderBy('price', 'asc'));
                    const querySnapshot = await getDocs(q);
                    const plans = querySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
                    setAvailablePlans(plans);
                } catch (err) {
                    console.error("Erro ao carregar planos:", err);
                } finally {
                    setLoadingPlans(false);
                }
            };
            fetchPlans();
        }
    }, [currentUser, isMasterAdmin, authLoading, navigate]);

    // Efeito para gerar slug automaticamente
    useEffect(() => {
        if (formData.nome && !slugManuallyEdited) {
            setFormData(prev => ({ ...prev, slug: slugify(prev.nome) }));
        }
    }, [formData.nome, slugManuallyEdited, slugify]);

    // Handler de Input
    const handleInputChange = (e) => {
        const { name, value, type, checked, files } = e.target;
        if (name === 'slug') setSlugManuallyEdited(true);

        if (type === 'file') {
            const file = files[0];
            setLogoImage(file);
            if (file) setLogoPreview(URL.createObjectURL(file));
            else setLogoPreview('');
        } else if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({
                ...prev,
                [parent]: { ...prev[parent], [child]: type === 'checkbox' ? checked : value }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        }
    };

    // --- FUNÇÃO PRINCIPAL DE SUBMISSÃO ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoadingForm(true);
        setFormError('');

        // Validação de campos obrigatórios
// ... código anterior ...

// ... código anterior ...

// 4. Vincular o Estabelecimento ao Administrador
if (formData.adminUID) {
    const adminRef = doc(db, 'usuarios', formData.adminUID);
    const adminSnap = await getDoc(adminRef);
    
    if (adminSnap.exists()) {
        const adminData = adminSnap.data();
        
        // CORREÇÃO AQUI: Verificação defensiva de Array
        let currentManagedEstabs = adminData.estabelecimentosGerenciados;
        
        // Se não for um array (undefined, null, objeto, string), forçamos ser um array vazio
        if (!Array.isArray(currentManagedEstabs)) {
            currentManagedEstabs = [];
        }

        if (!currentManagedEstabs.includes(newEstabId)) {
            await updateDoc(adminRef, {
                // Agora é seguro usar o spread operator
                estabelecimentosGerenciados: [...currentManagedEstabs, newEstabId]
            });
            toast.info('Vínculo de estabelecimento com admin atualizado.');
        }
    }
}

// ... restante do código ...

// ... restante do código ...
        let finalLogoUrl = formData.imageUrl;

        try {
            // 1. Upload de Logo (se houver)
            if (logoImage) {
                const logoName = `establishment_logos/${formData.slug || Date.now()}_${logoImage.name}`;
                finalLogoUrl = await uploadFile(logoImage, logoName);
                toast.success('Logo enviado com sucesso!');
            }

            // 2. Validação de Slug (Unicidade)
            const slugQuery = query(collection(db, 'estabelecimentos'), where('slug', '==', formData.slug));
            const slugSnapshot = await getDocs(slugQuery);
            if (!slugSnapshot.empty) {
                setFormError('Este slug (URL) já está em uso. Por favor, escolha outro.');
                setLoadingForm(false);
                return;
            }

            // 3. Preparar e Criar o Documento do Estabelecimento
            const newEstabRef = doc(collection(db, 'estabelecimentos'));
            const newEstabId = newEstabRef.id;

            const nextBilling = new Date();
            nextBilling.setMonth(nextBilling.getMonth() + 1); 

            const planIdToSave = formData.currentPlanId === '' ? null : formData.currentPlanId;

            await setDoc(newEstabRef, {
                ...formData,
                id: newEstabId,
                imageUrl: finalLogoUrl,
                currentPlanId: planIdToSave,
                criadoEm: new Date(),
                rating: Number(formData.rating),
                nextBillingDate: nextBilling,
            });

            // 4. Vincular o Estabelecimento ao Administrador
            if (formData.adminUID) {
                const adminRef = doc(db, 'usuarios', formData.adminUID);
                const adminSnap = await getDoc(adminRef); 
                if (adminSnap.exists()) {
                    const adminData = adminSnap.data();
                    const currentManagedEstabs = adminData.estabelecimentosGerenciados || [];
                    if (!currentManagedEstabs.includes(newEstabId)) {
                        await updateDoc(adminRef, {
                            estabelecimentosGerenciados: [...currentManagedEstabs, newEstabId]
                        });
                        toast.info('Vínculo de estabelecimento com admin atualizado.');
                    }
                }
            }

            // 5. Log de Auditoria e Redirecionamento
            auditLogger('ESTABELECIMENTO_CRIADO', { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' }, { type: 'estabelecimento', id: newEstabId, name: formData.nome }, { ...formData, rating: Number(formData.rating), imageUrl: finalLogoUrl });
            toast.success('Estabelecimento cadastrado com sucesso!');
            
            // Limpa formulário antes de redirecionar
            setFormData({ nome: '', slug: '', chavePix: '', imageUrl: '', rating: 0, adminUID: '', ativo: true, currentPlanId: '', nextBillingDate: null, endereco: { rua: '', numero: '', bairro: '', cidade: '' }, informacoes_contato: { telefone_whatsapp: '', instagram: '', horario_funcionamento: '' } });
            setLogoImage(null); 
            setLogoPreview('');
            
            navigate('/master/estabelecimentos'); 
        } catch (err) {
            console.error("Erro ao cadastrar estabelecimento:", err);
            setFormError(`Erro ao cadastrar: ${err.message}`);
            toast.error(`Erro ao cadastrar: ${err.message}`);
        } finally {
            setLoadingForm(false);
        }
    };

    if (authLoading || loadingAdmins || loadingPlans) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-500 mb-4"></div>
                <p className="text-xl text-gray-600 font-medium">Carregando formulário...</p>
                <p className="text-sm text-gray-500 mt-2">Preparando dados iniciais</p>
            </div>
        );
    }

    if (!isMasterAdmin) return null;

    return (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen pt-24 pb-8 px-4">
            
            {/* Header Fixo */}
            <header className="fixed top-0 left-0 right-0 z-50 p-6 flex justify-between items-center bg-white shadow-lg border-b border-gray-200 backdrop-blur-sm bg-white/95">
                <div className="font-extrabold text-2xl text-gray-900 cursor-pointer hover:text-yellow-500 transition-colors duration-300 flex items-center gap-2" onClick={() => navigate('/')}>
                    <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">DF</span>
                    </div>
                    DEU FOME <span className="text-yellow-500">.</span>
                </div>
                <div className="flex items-center space-x-4">
                    <Link to="/master/estabelecimentos" className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-gray-200 hover:shadow-lg transform hover:-translate-y-0.5 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
                        </svg>
                        Voltar
                    </Link>
                </div>
            </header>

            <div className="max-w-4xl mx-auto">
                {/* Cabeçalho do Formulário */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-4">
                        Cadastrar Novo Estabelecimento
                    </h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Preencha as informações abaixo para cadastrar um novo estabelecimento no sistema
                    </p>
                    <div className="w-24 h-1 bg-gradient-to-r from-yellow-500 to-orange-500 mx-auto mt-4 rounded-full"></div>
                </div>

                {formError && (
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-6 mb-8 rounded-xl shadow-sm" role="alert">
                        <div className="flex items-center">
                            <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <div>
                                <p className="font-bold">Erro no formulário</p>
                                <p className="text-sm mt-1">{formError}</p>
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                    
                    {/* SEÇÃO 1: INFORMAÇÕES GERAIS */}
                    <FormSection 
                        title="Informações Gerais" 
                        icon={
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                            </svg>
                        }
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <FormInput 
                                label="Nome do Estabelecimento" 
                                name="nome" 
                                value={formData.nome} 
                                onChange={handleInputChange} 
                                required 
                                placeholder="Digite o nome completo do estabelecimento"
                            />
                            <FormInput 
                                label="Slug (URL amigável)" 
                                name="slug" 
                                value={formData.slug} 
                                onChange={handleInputChange} 
                                required 
                                helpText="Será usado na URL do cardápio (ex: /cardapios/seunome)"
                                placeholder="nome-do-estabelecimento"
                            />
                        </div>
                        
                        <FormInput 
                            label="Chave PIX" 
                            name="chavePix" 
                            value={formData.chavePix} 
                            onChange={handleInputChange} 
                            helpText="Chave PIX para recebimento de pagamentos"
                            placeholder="CPF/CNPJ, telefone, e-mail ou chave aleatória"
                        />

                        {/* Upload de Logo */}
                        <div className="space-y-3">
                            <label className="block text-sm font-semibold text-gray-700">
                                Logo do Estabelecimento
                            </label>
                            <div className="flex w-full gap-6 items-start">
                                <div className="flex-1">
                                    <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center transition-all duration-300 hover:border-yellow-400 hover:bg-yellow-50">
                                        <input 
                                            type="file" 
                                            id="logoUpload" 
                                            name="logoUpload" 
                                            accept="image/*" 
                                            onChange={handleInputChange} 
                                            className="hidden"
                                        />
                                        <label htmlFor="logoUpload" className="cursor-pointer block">
                                            <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                            </svg>
                                            <span className="text-sm text-gray-600 font-medium">
                                                Clique para fazer upload do logo
                                            </span>
                                            <p className="text-xs text-gray-500 mt-1">
                                                PNG, JPG, SVG até 5MB
                                            </p>
                                        </label>
                                    </div>
                                </div>
                                {logoPreview && (
                                    <div className="flex flex-col items-center">
                                        <p className="text-sm font-medium text-gray-700 mb-2">Pré-visualização:</p>
                                        <img 
                                            src={logoPreview} 
                                            alt="Pré-visualização do Logo" 
                                            className="w-32 h-32 object-cover rounded-2xl shadow-lg border border-gray-200"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <FormInput 
                            label="Avaliação Inicial" 
                            name="rating" 
                            value={formData.rating} 
                            onChange={handleInputChange} 
                            type="number" 
                            min="0" 
                            max="5" 
                            step="0.1" 
                            helpText="Avaliação média inicial do estabelecimento (0-5)"
                            placeholder="4.5"
                        />
                    </FormSection>

                    {/* SEÇÃO 2: CONFIGURAÇÕES ADMINISTRATIVAS */}
                    <FormSection 
                        title="Configurações Administrativas" 
                        icon={
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            </svg>
                        }
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Seleção do Administrador */}
                            <div className="space-y-2">
                                <label htmlFor="adminUID" className="block text-sm font-semibold text-gray-700">
                                    Admin Responsável <span className="text-red-500">*</span>
                                </label>
                                <select
                                    id="adminUID" 
                                    name="adminUID" 
                                    value={formData.adminUID} 
                                    onChange={handleInputChange} 
                                    required
                                    className="w-full rounded-xl border-gray-300 bg-gray-50 px-4 py-3 text-gray-800 transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 focus:shadow-lg border-0"
                                >
                                    <option value="">Selecione um administrador...</option>
                                    {availableAdmins.map(admin => (
                                        <option key={admin.id} value={admin.id}>
                                            {admin.nome} ({admin.email})
                                        </option>
                                    ))}
                                </select>
                                <div className="flex justify-between items-center">
                                    <p className="text-xs text-gray-500">Vincule este estabelecimento a um administrador</p>
                                    <Link to="/master/usuarios/criar" className="text-xs font-semibold text-yellow-600 hover:text-yellow-700 transition-colors">
                                        Criar novo admin
                                    </Link>
                                </div>
                            </div>

                            {/* Seleção do Plano */}
                            <div className="space-y-2">
                                <label htmlFor="currentPlanId" className="block text-sm font-semibold text-gray-700">
                                    Plano de Assinatura
                                </label>
                                <select
                                    id="currentPlanId" 
                                    name="currentPlanId" 
                                    value={formData.currentPlanId} 
                                    onChange={handleInputChange}
                                    className="w-full rounded-xl border-gray-300 bg-gray-50 px-4 py-3 text-gray-800 transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 focus:shadow-lg border-0"
                                >
                                    <option value="">Nenhum Plano (Definir depois)</option>
                                    {availablePlans.map(plan => (
                                        <option key={plan.id} value={plan.id}>{plan.name}</option>
                                    ))}
                                </select>
                                <div className="flex justify-between items-center">
                                    <p className="text-xs text-gray-500">Selecione o plano de assinatura</p>
                                    <Link to="/master/plans" className="text-xs font-semibold text-yellow-600 hover:text-yellow-700 transition-colors">
                                        Gerenciar planos
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </FormSection>

                    {/* SEÇÃO 3: INFORMAÇÕES DE CONTATO */}
                    <FormSection 
                        title="Informações de Contato" 
                        icon={
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                            </svg>
                        }
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <FormInput 
                                label="WhatsApp" 
                                name="informacoes_contato.telefone_whatsapp" 
                                value={formData.informacoes_contato.telefone_whatsapp} 
                                onChange={handleInputChange} 
                                placeholder="(11) 99999-9999"
                                helpText="Número para contato via WhatsApp"
                            />
                            <FormInput 
                                label="Instagram" 
                                name="informacoes_contato.instagram" 
                                value={formData.informacoes_contato.instagram} 
                                onChange={handleInputChange} 
                                placeholder="@nome-do-estabelecimento"
                                helpText="Perfil do Instagram"
                            />
                        </div>
                        <FormInput 
                            label="Horário de Funcionamento" 
                            name="informacoes_contato.horario_funcionamento" 
                            value={formData.informacoes_contato.horario_funcionamento} 
                            onChange={handleInputChange} 
                            placeholder="Segunda a Sexta: 11h-15h, 18h-23h | Sábado e Domingo: 12h-00h"
                            helpText="Horários de atendimento do estabelecimento"
                        />
                    </FormSection>

                    {/* SEÇÃO 4: ENDEREÇO */}
                    <FormSection 
                        title="Endereço" 
                        icon={
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            </svg>
                        }
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <FormInput 
                                label="Rua" 
                                name="endereco.rua" 
                                value={formData.endereco.rua} 
                                onChange={handleInputChange} 
                                placeholder="Nome da rua"
                            />
                            <FormInput 
                                label="Número" 
                                name="endereco.numero" 
                                value={formData.endereco.numero} 
                                onChange={handleInputChange} 
                                placeholder="Número"
                            />
                            <FormInput 
                                label="Bairro" 
                                name="endereco.bairro" 
                                value={formData.endereco.bairro} 
                                onChange={handleInputChange} 
                                placeholder="Nome do bairro"
                            />
                            <FormInput 
                                label="Cidade" 
                                name="endereco.cidade" 
                                value={formData.endereco.cidade} 
                                onChange={handleInputChange} 
                                placeholder="Nome da cidade"
                            />
                        </div>
                    </FormSection>

                    {/* BOTÕES DE AÇÃO */}
                    <div className="flex w-full gap-4 justify-end pt-6">
                        <Link
                            to="/master/estabelecimentos"
                            className="px-8 py-4 bg-white text-gray-700 border border-gray-300 rounded-xl font-bold hover:bg-gray-50 transition-all duration-300 flex items-center justify-center gap-3 shadow-md hover:shadow-lg"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                            Cancelar
                        </Link>
                        <button 
                            type="submit" 
                            disabled={loadingForm}
                            className="px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-bold hover:from-yellow-600 hover:to-orange-600 transition-all duration-300 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
                        >
                            {loadingForm ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    Cadastrando...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                    </svg>
                                    Cadastrar Estabelecimento
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default AdminEstabelecimentoCadastro;