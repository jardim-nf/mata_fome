// src/pages/admin/EditarEstabelecimentoMaster.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { uploadFile, deleteFileByUrl } from '../../utils/firebaseStorageService'; //
import { auditLogger } from '../../utils/auditLogger';


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

function EditarEstabelecimentoMaster() {
    const { id } = useParams(); // ID do estabelecimento da URL
    const navigate = useNavigate();
    const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();

    const [formData, setFormData] = useState({
        nome: '',
        endereco: { rua: '', numero: '', bairro: '', cidade: '' },
        informacoes_contato: { telefone_whatsapp: '', instagram: '', horario_funcionamento: '' },
        chavePix: '',
        slug: '',
        imageUrl: '', // Campo para a URL do logo
        rating: 0,
        adminUID: '',
        ativo: true,
        currentPlanId: '',
        nextBillingDate: null,
    });
    const [logoImage, setLogoImage] = useState(null); // Estado para o novo arquivo de logo
    const [logoPreview, setLogoPreview] = useState(''); // Estado para pré-visualização do logo
    const [loading, setLoading] = useState(true);
    const [formLoading, setFormLoading] = useState(false);
    const [error, setError] = useState('');
    const [availableAdmins, setAvailableAdmins] = useState([]);
    const [availablePlans, setAvailablePlans] = useState([]);
    const [loadingAdmins, setLoadingAdmins] = useState(true);
    const [loadingPlans, setLoadingPlans] = useState(true);

    const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

    // Efeito para controle de acesso e carregamento inicial do estabelecimento
    useEffect(() => {
        if (authLoading) return;
        if (!isMasterAdmin) {
            toast.error('Acesso negado. Apenas Master Admin pode editar estabelecimentos.');
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
                        // Garante que sub-objetos existam para evitar erros ao acessar
                        endereco: data.endereco || { rua: '', numero: '', bairro: '', cidade: '' },
                        informacoes_contato: data.informacoes_contato || { telefone_whatsapp: '', instagram: '', horario_funcionamento: '' },
                        // Converte Timestamp para Date se necessário (para nextBillingDate)
                        nextBillingDate: data.nextBillingDate?.toDate ? data.nextBillingDate.toDate() : null,
                    }));
                    setLogoPreview(data.imageUrl || ''); // Define a pré-visualização com a URL existente
                    // Se o slug já existe, consideramos que ele não foi editado manualmente
                    setSlugManuallyEdited(!!data.slug);
                } else {
                    setError("Estabelecimento não encontrado.");
                }
            } catch (err) {
                console.error("Erro ao buscar estabelecimento:", err);
                setError("Erro ao carregar dados do estabelecimento.");
            } finally {
                setLoading(false);
            }
        };

        fetchEstablishment();
    }, [id, isMasterAdmin, authLoading, navigate]);


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
                setError("Erro ao carregar lista de administradores.");
            } finally {
                setLoadingAdmins(false);
            }
        };
        fetchAdmins();
    }, [isMasterAdmin, currentUser]);

    // Efeito para carregar planos disponíveis
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
                setError("Erro ao carregar lista de planos.");
            } finally {
                setLoadingPlans(false);
            }
        };
        fetchPlans();
    }, [isMasterAdmin, currentUser]);

const handleInputChange = (e) => {

        const { name, value, type, checked, files } = e.target; // Adiciona 'files'

        if (name === 'slug') setSlugManuallyEdited(true);

        if (type === 'file') { // Novo tratamento para input de arquivo
            const file = files[0];
            setLogoImage(file);
            if (file) {
                setLogoPreview(URL.createObjectURL(file)); // Pré-visualização local
            } else {
                // Se o usuário limpar a seleção de arquivo, volta para a URL existente ou limpa
                setLogoPreview(formData.imageUrl || '');
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
        setFormLoading(true);
        setError('');

        const { nome, endereco, informacoes_contato, slug, adminUID, currentPlanId } = formData;
        if (!nome.trim() || !endereco.rua.trim() || !informacoes_contato.telefone_whatsapp.trim() || !slug.trim() || !adminUID.trim() || !currentPlanId.trim()) {
            toast.warn("Por favor, preencha todos os campos obrigatórios (Nome, Endereço, Telefone, Slug, Admin, Plano).");
            setFormLoading(false);
            return;
        }

        let finalLogoUrl = formData.imageUrl; // Inicia com a URL existente

        try {
            // Se um novo arquivo de logo foi selecionado
            if (logoImage) {
                const logoName = `establishment_logos/${formData.slug || id}_${Date.now()}_${logoImage.name}`;
                finalLogoUrl = await uploadFile(logoImage, logoName); //
                toast.success('Novo logo enviado com sucesso!');

                // Se havia um logo antigo e foi substituído, delete o antigo do Storage
                if (formData.imageUrl && formData.imageUrl !== finalLogoUrl) {
                    // await deleteFileByUrl(formData.imageUrl); // // Descomente para ativar a exclusão da imagem antiga
                    // console.log("Logo antigo deletado (se aplicável):", formData.imageUrl);
                }
            } else if (formData.imageUrl && !logoPreview && !logoImage) {
                 // Se não selecionou nova imagem e a pré-visualização está vazia (indicando que o usuário removeu a imagem)
                 // E havia uma URL no formData, significa que o usuário quer remover o logo existente.
                // await deleteFileByUrl(formData.imageUrl); // // Descomente para ativar a exclusão da imagem antiga
                finalLogoUrl = ''; // Limpa a URL no Firestore
            }

            // Verificar se o slug já existe para outro estabelecimento (se o slug foi alterado)
            if (formData.slug !== (await getDoc(doc(db, 'estabelecimentos', id))).data().slug) {
                const slugQuery = query(collection(db, 'estabelecimentos'), where('slug', '==', formData.slug));
                const slugSnapshot = await getDocs(slugQuery);
                if (!slugSnapshot.empty) {
                    // Verifica se o slug encontrado pertence ao próprio estabelecimento que está sendo editado
                    const existingSlugDoc = slugSnapshot.docs[0];
                    if (existingSlugDoc.id !== id) {
                        setError('Este slug (URL) já está em uso por outro estabelecimento. Por favor, escolha outro.');
                        setFormLoading(false);
                        return;
                    }
                }
            }

            // Tratar o nextBillingDate como um Timestamp do Firebase, se necessário.
            // Aqui estamos assumindo que formData.nextBillingDate já é um Date ou null
            const dataToUpdate = {
                ...formData,
                imageUrl: finalLogoUrl, // Atualiza a URL final do logo
                rating: Number(formData.rating),
                updatedAt: new Date(),
                nextBillingDate: formData.nextBillingDate, // Já deve ser um Date ou null
            };

            const docRef = doc(db, 'estabelecimentos', id);
            await updateDoc(docRef, dataToUpdate);

            // Atualizar o vínculo do administrador (se o adminUID mudou)
            const oldEstabData = (await getDoc(docRef)).data();
            if (oldEstabData.adminUID !== formData.adminUID) {
                // Remover o estabelecimento do admin antigo
                if (oldEstabData.adminUID) {
                    const oldAdminRef = doc(db, 'usuarios', oldEstabData.adminUID);
                    const oldAdminSnap = await getDoc(oldAdminRef);
                    if (oldAdminSnap.exists()) {
                        const oldAdminData = oldAdminSnap.data();
                        const updatedEstabs = (oldAdminData.estabelecimentosGerenciados || []).filter(estabId => estabId !== id);
                        await updateDoc(oldAdminRef, { estabelecimentosGerenciados: updatedEstabs });
                    }
                }
                // Adicionar o estabelecimento ao novo admin
                if (formData.adminUID) {
                    const newAdminRef = doc(db, 'usuarios', formData.adminUID);
                    const newAdminSnap = await getDoc(newAdminRef);
                    if (newAdminSnap.exists()) {
                        const newAdminData = newAdminSnap.data();
                        const currentManagedEstabs = newAdminData.estabelecimentosGerenciados || [];
                        if (!currentManagedEstabs.includes(id)) {
                            await updateDoc(newAdminRef, {
                                estabelecimentosGerenciados: [...currentManagedEstabs, id]
                            });
                        }
                    }
                }
                toast.info('Vínculo de administrador atualizado.');
            }

            auditLogger(
                'ESTABELECIMENTO_ATUALIZADO',
                { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
                { type: 'estabelecimento', id: id, name: formData.nome },
                { ...dataToUpdate, rating: Number(formData.rating) } // Inclua imageUrl no log
            );

            toast.success("Estabelecimento atualizado com sucesso!");
            navigate('/master/estabelecimentos');
        } catch (err) {
            console.error("Erro ao atualizar estabelecimento:", err);
            setError("Erro ao atualizar estabelecimento: " + err.message);
            toast.error("Erro ao atualizar estabelecimento.");
        } finally {
            setFormLoading(false);
        }
    };


    if (loading || authLoading || loadingAdmins || loadingPlans) return <div className="text-center p-8">Carregando...</div>;
    if (error) return <div className="text-center p-8 text-red-600">{error}</div>;

    return (
        <div className="bg-gray-100 min-h-screen p-4 sm:p-6 lg:p-8 font-sans">
            <div className="max-w-4xl mx-auto">
                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Cabeçalho com Ações */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                            <Link
                                to="/master/estabelecimentos"
                                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md font-semibold hover:bg-gray-300 flex items-center gap-1 mb-4"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                                Voltar para Estabelecimentos
                            </Link>
                            <h1 className="text-3xl font-bold text-slate-800">Editar Estabelecimento</h1>
                        </div>
                        <button type="submit" disabled={formLoading} className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white text-base font-bold rounded-lg shadow-md hover:bg-indigo-700 transition-colors duration-300">
                            {formLoading ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>

                    {error && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                            <p className="font-bold">Erro de Atualização:</p>
                            <p>{error}</p>
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
                                {(logoPreview || formData.imageUrl) && ( // Exibe pré-visualização ou URL existente
                                    <div className="mt-2 flex items-center gap-4">
                                        <p className="text-sm text-slate-600">Pré-visualização:</p>
                                        <img
                                            src={logoPreview || formData.imageUrl}
                                            alt="Pré-visualização do Logo"
                                            className="w-24 h-24 object-cover rounded-lg shadow"
                                        />
                                    </div>
                                )}
                                {/* Campo URL do logo original (escondido ou somente leitura) */}
                                <input
                                    name="imageUrl"
                                    value={formData.imageUrl}
                                    readOnly
                                    hidden // Opcional: Esconder se o upload é a única forma de gerenciar
                                />
                            </div>
                            {/* FIM CAMPO DE UPLOAD DE LOGO */}

                            <FormInput label="Avaliação (1-5)" name="rating" value={formData.rating} onChange={handleInputChange} type="number" min="0" max="5" step="0.1" helpText="Avaliação média do estabelecimento."/>

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

                            {/* Seleção do Plano */}
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

                            {/* Próxima Data de Cobrança */}
                            <div>
                                <label htmlFor="nextBillingDate" className="block text-sm font-medium text-slate-600 mb-1">Próxima Data de Cobrança:</label>
                                <input
                                    type="date"
                                    id="nextBillingDate"
                                    name="nextBillingDate"
                                    value={formData.nextBillingDate ? formData.nextBillingDate.toISOString().split('T')[0] : ''}
                                    onChange={handleInputChange}
                                    className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5 focus:border-indigo-500 focus:ring-indigo-500"
                                />
                                <p className="mt-1 text-xs text-slate-500">Define a data da próxima cobrança de assinatura. Deixe vazio para não definir.</p>
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
                        <button type="submit" disabled={formLoading} className="px-8 py-3 bg-indigo-600 text-white text-lg font-bold rounded-lg shadow-md hover:bg-indigo-700 transition-colors duration-300">
                            {formLoading ? 'Atualizando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default EditarEstabelecimentoMaster;