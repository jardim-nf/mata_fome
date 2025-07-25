// src/pages/admin/AdminEstabelecimentoCadastro.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, addDoc, query, where, getDocs, orderBy, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger';
import { uploadFile } from '../../utils/firebaseStorageService'; //

// Componente FormInput (reutilizável para campos de texto)
function FormInput({ label, name, value, onChange, type = 'text', helpText = '', ...props }) {
    return (
        <div>
            <label htmlFor={name} className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
            <input
                id={name}
                name={name}
                value={value || ''}
                onChange={onChange}
                type={type}
                {...props}
                className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5 focus:border-indigo-500 focus:ring-indigo-500"
            />
            {helpText && <p className="mt-1 text-xs text-slate-500">{helpText}</p>}
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
        imageUrl: '', // Campo para a URL do logo no Firestore
        rating: 0,
        adminUID: '',
        ativo: true,
        currentPlanId: '',
        nextBillingDate: null,
        endereco: {
            rua: '',
            numero: '',
            bairro: '',
            cidade: ''
        },
        informacoes_contato: {
            telefone_whatsapp: '',
            instagram: '',
            horario_funcionamento: ''
        }
    });

    const [logoImage, setLogoImage] = useState(null); // Estado para o arquivo de logo selecionado
    const [logoPreview, setLogoPreview] = useState(''); // Estado para pré-visualização do logo

    const [availableAdmins, setAvailableAdmins] = useState([]);
    const [availablePlans, setAvailablePlans] = useState([]);
    const [loadingForm, setLoadingForm] = useState(false);
    const [loadingAdmins, setLoadingAdmins] = useState(true);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [formError, setFormError] = useState('');

    const slugify = useCallback((text) =>
        text.toString().toLowerCase().trim()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-')
            .replace(/[^\w-]+/g, '')
            .replace(/--+/g, '-'),
    []);

    const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

    // Efeito para controle de acesso
    useEffect(() => {
        if (!authLoading) {
            if (!currentUser || !isMasterAdmin) {
                toast.error('Acesso negado. Você não tem permissões de Master Administrador.');
                navigate('/master-dashboard');
                return;
            }
        }
    }, [currentUser, isMasterAdmin, authLoading, navigate]);

    // Efeito para carregar admins disponíveis
    useEffect(() => {
        if (!isMasterAdmin || !currentUser) return;

        const fetchAdmins = async () => {
            try {
                const q = query(collection(db, 'usuarios'), where('isAdmin', '==', true), orderBy('nome', 'asc'));
                const querySnapshot = await getDocs(q);
                const admins = querySnapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome, email: doc.data().email }));
                setAvailableAdmins(admins);
            } catch (err) {
                console.error("Erro ao carregar administradores disponíveis:", err);
                setFormError("Erro ao carregar lista de administradores. Crie o índice no Firebase Firestore (Collection: 'usuarios', Fields: 'isAdmin' Asc, 'nome' Asc).");
                toast.error("Erro ao carregar lista de administradores.");
            } finally {
                setLoadingAdmins(false);
            }
        };
        fetchAdmins();
    }, [isMasterAdmin, currentUser]);

    // NOVO EFEITO: Carregar planos disponíveis
    useEffect(() => {
        if (!isMasterAdmin || !currentUser) return;

        const fetchPlans = async () => {
            try {
                const q = query(collection(db, 'plans'), where('isActive', '==', true), orderBy('price', 'asc'));
                const querySnapshot = await getDocs(q);
                const plans = querySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
                setAvailablePlans(plans);
            } catch (err) {
                console.error("Erro ao carregar planos disponíveis:", err);
                setFormError("Erro ao carregar lista de planos. Verifique a coleção 'plans' e permissões.");
                toast.error("Erro ao carregar lista de planos.");
            } finally {
                setLoadingPlans(false);
            }
        };
        fetchPlans();
    }, [isMasterAdmin, currentUser]);

    // Efeito para gerar slug automaticamente
    useEffect(() => {
        if (formData.nome && !slugManuallyEdited) {
            setFormData(prev => ({ ...prev, slug: slugify(prev.nome) }));
        }
    }, [formData.nome, slugManuallyEdited, slugify]);

    const handleInputChange = (e) => {
        const { name, value, type, checked, files } = e.target; // Adiciona 'files'

        if (name === 'slug') setSlugManuallyEdited(true);

        if (type === 'file') { // Novo tratamento para input de arquivo
            const file = files[0];
            setLogoImage(file);
            if (file) {
                setLogoPreview(URL.createObjectURL(file)); // Pré-visualização local
            } else {
                setLogoPreview('');
            }
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoadingForm(true);
        setFormError('');

        if (formData.adminUID === '') {
            setFormError('Por favor, selecione um administrador para o estabelecimento.');
            setLoadingForm(false);
            return;
        }
        if (formData.currentPlanId === '') {
            setFormError('Por favor, selecione um plano para o estabelecimento.');
            setLoadingForm(false);
            return;
        }

        let finalLogoUrl = formData.imageUrl; // Começa com a URL existente ou vazia

        try {
            // Se um logo foi selecionado para upload
            if (logoImage) {
                const logoName = `establishment_logos/${formData.slug || Date.now()}_${logoImage.name}`;
                finalLogoUrl = await uploadFile(logoImage, logoName); //
                toast.success('Logo enviado com sucesso!');
            }

            const slugQuery = query(collection(db, 'estabelecimentos'), where('slug', '==', formData.slug));
            const slugSnapshot = await getDocs(slugQuery);
            if (!slugSnapshot.empty) {
                setFormError('Este slug (URL) já está em uso. Por favor, escolha outro.');
                setLoadingForm(false);
                return;
            }

            const newEstabRef = doc(collection(db, 'estabelecimentos'));
            const newEstabId = newEstabRef.id;

            const nextBilling = new Date();
            nextBilling.setMonth(nextBilling.getMonth() + 1);

            await setDoc(newEstabRef, {
                ...formData,
                id: newEstabId,
                imageUrl: finalLogoUrl, // Salva a URL final do logo
                criadoEm: new Date(),
                rating: Number(formData.rating),
                nextBillingDate: nextBilling,
            });

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

            auditLogger(
                'ESTABELECIMENTO_CRIADO',
                { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
                { type: 'estabelecimento', id: newEstabId, name: formData.nome },
                { ...formData, rating: Number(formData.rating), imageUrl: finalLogoUrl } // Inclua a imageUrl no log
            );

            toast.success('Estabelecimento cadastrado com sucesso!');
            setFormData({ nome: '', slug: '', chavePix: '', imageUrl: '', rating: 0, adminUID: '', ativo: true, currentPlanId: '', nextBillingDate: null, endereco: { rua: '', numero: '', bairro: '', cidade: '' }, informacoes_contato: { telefone_whatsapp: '', instagram: '', horario_funcionamento: '' } });
            setLogoImage(null); // Limpa o arquivo selecionado
            setLogoPreview(''); // Limpa a pré-visualização
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
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
                <p className="text-xl text-gray-700">Carregando formulário...</p>
            </div>
        );
    }

    if (!isMasterAdmin) return null;

    return (
        <div className="bg-gray-100 min-h-screen p-4 sm:p-6 lg:p-8 font-sans">
            <div className="max-w-4xl mx-auto">
                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Cabeçalho com Ações */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                            <Link
                                to="/master-dashboard"
                                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md font-semibold hover:bg-gray-300 flex items-center gap-1 mb-4"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                                Voltar ao Dashboard Master
                            </Link>
                            <h1 className="text-3xl font-bold text-slate-800">Cadastrar Novo Estabelecimento</h1>
                        </div>
                        <button type="submit" disabled={loadingForm} className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white text-base font-bold rounded-lg shadow-md hover:bg-indigo-700 transition-colors duration-300">
                            {loadingForm ? 'Salvando...' : 'Cadastrar Estabelecimento'}
                        </button>
                    </div>

                    {formError && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                            <p className="font-bold">Erro de Cadastro:</p>
                            <p>{formError}</p>
                        </div>
                    )}

                    {/* Dados Principais */}
                    <div className="bg-white p-6 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-4 mb-6">Informações Gerais</h2>
                        <div className="space-y-4">
                            <FormInput label="Nome do Estabelecimento" name="nome" value={formData.nome} onChange={handleInputChange} required />
                            <FormInput label="Slug (URL amigável)" name="slug" value={formData.slug} onChange={handleInputChange} required helpText="Será a parte final da URL do cardápio (ex: /cardapios/seunome). Gerado automaticamente, mas pode ser editado."/>
                            <FormInput label="Chave PIX (Para Receber Pagamentos)" name="chavePix" value={formData.chavePix} onChange={handleInputChange} helpText="Chave PIX para pagamentos diretos."/>

                            {/* Campo de Upload de Imagem para o Logo */}
                            <div className="flex flex-col gap-2">
                                <label htmlFor="logoUpload" className="block text-sm font-medium text-slate-700">
                                    Logo do Estabelecimento (Opcional):
                                </label>
                                <input
                                    type="file"
                                    id="logoUpload"
                                    name="logoUpload"
                                    accept="image/*"
                                    onChange={handleInputChange}
                                    className="w-full border-slate-300 rounded-lg p-1"
                                />
                                {logoPreview && (
                                    <div className="mt-2 flex items-center gap-4">
                                        <p className="text-sm text-slate-600">Pré-visualização:</p>
                                        <img
                                            src={logoPreview}
                                            alt="Pré-visualização do Logo"
                                            className="w-24 h-24 object-cover rounded-lg shadow"
                                        />
                                    </div>
                                )}
                                {/* Campo URL do logo original (escondido) */}
                                <input
                                    name="imageUrl"
                                    value={formData.imageUrl}
                                    readOnly
                                    hidden
                                />
                            </div>
                            {/* Fim Campo de Upload de Imagem */}

                            <FormInput label="Avaliação Inicial (1-5, Opcional)" name="rating" value={formData.rating} onChange={handleInputChange} type="number" min="0" max="5" step="0.1" helpText="Avaliação média do estabelecimento."/>

                            {/* Seleção do Administrador */}
                            <div>
                                <label htmlFor="adminUID" className="block text-sm font-medium text-slate-600 mb-1">Admin Responsável *</label>
                                <select
                                    id="adminUID"
                                    name="adminUID"
                                    value={formData.adminUID}
                                    onChange={handleInputChange}
                                    required
                                    className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5 focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    <option value="">Selecione um administrador...</option>
                                    {loadingAdmins ? (
                                        <option value="" disabled>Carregando administradores...</option>
                                    ) : availableAdmins.length === 0 ? (
                                        <option value="" disabled>Nenhum admin disponível (crie um admin primeiro)</option>
                                    ) : (
                                        availableAdmins.map(admin => (
                                            <option key={admin.id} value={admin.id}>
                                                {admin.nome} ({admin.email})
                                            </option>
                                        ))
                                    )}
                                </select>
                                <p className="mt-1 text-xs text-slate-500">Vincule este estabelecimento a um administrador já existente. Apenas usuários com a permissão 'Admin Estabelecimento' aparecem aqui.</p>
                                <Link to="/master/usuarios/criar" className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 mt-2 block">
                                    Criar novo administrador
                                </Link>
                            </div>

                            {/* NOVO: Seleção do Plano */}
                            <div>
                                <label htmlFor="currentPlanId" className="block text-sm font-medium text-slate-600 mb-1">Plano de Assinatura *</label>
                                <select
                                    id="currentPlanId"
                                    name="currentPlanId"
                                    value={formData.currentPlanId}
                                    onChange={handleInputChange}
                                    required
                                    className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5 focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    <option value="">Selecione um plano...</option>
                                    {loadingPlans ? (
                                        <option value="" disabled>Carregando planos...</option>
                                    ) : availablePlans.length === 0 ? (
                                        <option value="" disabled>Nenhum plano ativo disponível (crie um plano primeiro)</option>
                                    ) : (
                                        availablePlans.map(plan => (
                                            <option key={plan.id} value={plan.id}>
                                                {plan.name}
                                            </option>
                                        ))
                                    )}
                                </select>
                                <p className="mt-1 text-xs text-slate-500">Selecione o plano de assinatura que este estabelecimento utilizará.</p>
                                <Link to="/master/plans" className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 mt-2 block">
                                    Gerenciar planos
                                </Link>
                            </div>

                        </div>
                    </div>

                    {/* Informações de Contato */}
                    <div className="bg-white p-6 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-4 mb-6">Informações de Contato</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormInput label="Telefone/WhatsApp" name="informacoes_contato.telefone_whatsapp" value={formData.informacoes_contato.telefone_whatsapp} onChange={handleInputChange} type="tel" placeholder="(XX) XXXXX-XXXX"/>
                            <FormInput label="Instagram" name="informacoes_contato.instagram" value={formData.informacoes_contato.instagram} onChange={handleInputChange} placeholder="@usuario_do_estabelecimento"/>
                        </div>
                        <div className="mt-4">
                            <FormInput label="Horário de Funcionamento" name="informacoes_contato.horario_funcionamento" value={formData.informacoes_contato.horario_funcionamento} onChange={handleInputChange} placeholder="Ex: Ter - Dom: 18h às 23h"/>
                        </div>
                    </div>

                    {/* Endereço */}
                    <div className="bg-white p-6 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-4 mb-6">Endereço Principal</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormInput label="Rua" name="endereco.rua" value={formData.endereco.rua} onChange={handleInputChange} />
                            <FormInput label="Número" name="endereco.numero" value={formData.endereco.numero} onChange={handleInputChange} />
                            <FormInput label="Bairro" name="endereco.bairro" value={formData.endereco.bairro} onChange={handleInputChange} />
                            <FormInput label="Cidade" name="endereco.cidade" value={formData.endereco.cidade} onChange={handleInputChange} />
                        </div>
                    </div>

                    {/* Status Ativo/Inativo */}
                    <div className="bg-white p-6 rounded-xl shadow-md">
                        <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-4 mb-6">Status</h2>
                        <label className="flex items-center cursor-pointer">
                            <div className="relative">
                                <input type="checkbox" name="ativo" className="sr-only" checked={formData.ativo} onChange={handleInputChange} />
                                <div className={`block w-14 h-8 rounded-full ${formData.ativo ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
                                <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${formData.ativo ? 'transform translate-x-full' : ''}`}></div>
                            </div>
                            <div className="ml-3 text-base font-semibold text-slate-700">{formData.ativo ? 'Ativo' : 'Inativo'}</div>
                        </label>
                        <p className="mt-2 text-xs text-slate-500">Estabelecimentos inativos não aparecerão para os clientes e não receberão pedidos.</p>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button type="submit" disabled={loadingForm} className="px-8 py-3 bg-indigo-600 text-white text-lg font-bold rounded-lg shadow-md hover:bg-indigo-700 transition-colors duration-300">
                            {loadingForm ? 'Cadastrando...' : 'Cadastrar Estabelecimento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default AdminEstabelecimentoCadastro;