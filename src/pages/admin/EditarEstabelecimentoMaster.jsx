// src/pages/admin/EditarEstabelecimentoMaster.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore'; // Importe orderBy
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
// ... other imports
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger';
import { format } from 'date-fns'; // Importe format para exibir a data

// Componente para Inputs
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
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();
    
    const [formData, setFormData] = useState(null);
    const [availableAdmins, setAvailableAdmins] = useState([]);
    const [availablePlans, setAvailablePlans] = useState([]); // NOVO: Lista de planos disponíveis
    const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const slugify = useCallback((text) => text.toString().toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-'), []);

    // Efeito para controle de acesso e carregamento de dados
    useEffect(() => {
        if (authLoading) return;
        if (!isMasterAdmin) {
            toast.error('Acesso negado.');
            navigate('/master-dashboard');
            return;
        }

        const fetchData = async () => {
            try {
                // Carregar dados do estabelecimento
                const docRef = doc(db, 'estabelecimentos', id);
                const docSnap = await getDoc(docRef);
                if (!docSnap.exists()) throw new Error('Estabelecimento não encontrado.');
                
                const data = docSnap.data();
                setFormData({
                    nome: data.nome || '', slug: data.slug || '', chavePix: data.chavePix || '',
                    imageUrl: data.imageUrl || '', rating: data.rating || 0, adminUID: data.adminUID || '',
                    ativo: data.ativo !== undefined ? data.ativo : true,
                    currentPlanId: data.currentPlanId || '', // Carrega o plano existente
                    nextBillingDate: data.nextBillingDate || null, // Carrega a data de cobrança
                    endereco: data.endereco || {}, informacoes_contato: data.informacoes_contato || {}
                });

                // Carregar admins
                const adminsQuery = query(collection(db, 'usuarios'), where('isAdmin', '==', true), orderBy('nome', 'asc'));
                const adminsSnapshot = await getDocs(adminsQuery);
                setAvailableAdmins(adminsSnapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome, email: doc.data().email })));

                // Carregar planos
                const plansQuery = query(collection(db, 'plans'), where('isActive', '==', true), orderBy('price', 'asc'));
                const plansSnapshot = await getDocs(plansQuery);
                setAvailablePlans(plansSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));

            } catch (err) {
                setError(err.message);
                toast.error(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, isMasterAdmin, authLoading, navigate]);

    // Efeito para gerar slug automaticamente
    useEffect(() => {
        if (formData && !slugManuallyEdited && formData.nome) {
            setFormData(prev => ({...prev, slug: slugify(prev.nome)}));
        }
    }, [formData?.nome, slugManuallyEdited, slugify]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        const val = type === 'checkbox' ? checked : value;
        if (name === 'slug') setSlugManuallyEdited(true);

        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({ ...prev, [parent]: { ...prev[parent], [child]: val } }));
        } else {
            setFormData(prev => ({ ...prev, [name]: val }));
        }
    };
    
    const handleUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (formData.adminUID === '') { // VALIDAÇÃO DO ADMIN
            setError('Por favor, selecione um administrador para o estabelecimento.');
            setLoading(false);
            return;
        }
        if (formData.currentPlanId === '') { // VALIDAÇÃO DO PLANO
            setError('Por favor, selecione um plano para o estabelecimento.');
            setLoading(false);
            return;
        }

        try {
            // Verificar se o slug já existe e pertence a outro estabelecimento
            const slugQuery = query(collection(db, 'estabelecimentos'), where('slug', '==', formData.slug));
            const slugSnapshot = await getDocs(slugQuery);
            if (!slugSnapshot.empty && slugSnapshot.docs[0].id !== id) {
                setError('Este slug (URL) já está em uso por outro estabelecimento. Por favor, escolha outro.');
                setLoading(false);
                return;
            }

            const estabRef = doc(db, 'estabelecimentos', id);
            const oldData = (await getDoc(estabRef)).data(); // Pega os dados antigos para o log
            
            // Remove o ID do formData para não sobrescrever o ID do documento no Firestore
            const { id: _, ...dataToUpdate } = formData; 

            await updateDoc(estabRef, {
                ...dataToUpdate,
                rating: Number(dataToUpdate.rating), // Garante que rating é número
                // nextBillingDate não é alterado aqui, pode ser em uma página de faturamento
            });

            // Opcional: Atualizar o vínculo de administrador se ele mudou
            if (oldData.adminUID !== formData.adminUID) {
                // Remover o vínculo antigo (opcional, mas bom para limpeza)
                if (oldData.adminUID) {
                    const oldAdminRef = doc(db, 'usuarios', oldData.adminUID);
                    const oldAdminSnap = await getDoc(oldAdminRef);
                    if (oldAdminSnap.exists()) {
                        const oldAdminData = oldAdminSnap.data();
                        const updatedManagedEstabs = (oldAdminData.estabelecimentosGerenciados || []).filter(estabId => estabId !== id);
                        await updateDoc(oldAdminRef, { estabelecimentosGerenciados: updatedManagedEstabs });
                    }
                }
                // Adicionar o novo vínculo
                if (formData.adminUID) {
                    const newAdminRef = doc(db, 'usuarios', formData.adminUID);
                    const newAdminSnap = await getDoc(newAdminRef);
                    if (newAdminSnap.exists()) {
                        const newAdminData = newAdminSnap.data();
                        const updatedManagedEstabs = [...(newAdminData.estabelecimentosGerenciados || []), id];
                        await updateDoc(newAdminRef, { estabelecimentosGerenciados: updatedManagedEstabs });
                    }
                }
                toast.info('Vínculo de administrador atualizado.');
            }


            // Log de auditoria
            const changedFields = {};
            for (const key in dataToUpdate) {
                if (JSON.stringify(oldData[key]) !== JSON.stringify(dataToUpdate[key])) {
                    changedFields[key] = { oldValue: oldData[key], newValue: dataToUpdate[key] };
                }
            }
            if (Object.keys(changedFields).length > 0) {
                auditLogger(
                    'ESTABELECIMENTO_EDITADO',
                    { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
                    { type: 'estabelecimento', id: id, name: formData.nome },
                    { changes: changedFields }
                );
            }

            toast.success('Estabelecimento atualizado com sucesso!');
            navigate('/master/estabelecimentos');
        } catch (err) {
            console.error("Erro ao atualizar o estabelecimento:", err);
            setError(`Erro ao atualizar o estabelecimento: ${err.message}`);
            toast.error('Erro ao atualizar o estabelecimento.');
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || loading || formData === null) return <div className="text-center p-8">Carregando...</div>;
    if (error && !loading) return <div className="text-center p-8 text-red-600">Erro: {error}</div>;

    return (
        <div className="bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8 font-sans">
            <div className="max-w-6xl mx-auto">
                <form onSubmit={handleUpdate}>
                    {/* Cabeçalho com Ações */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                        <div>
                            {/* BOTÃO "VOLTAR" PADRONIZADO AQUI */}
                            <Link 
                                to="/master/estabelecimentos" 
                                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md font-semibold hover:bg-gray-300 flex items-center gap-1 mb-4"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                                Voltar para a Lista
                            </Link>
                            <h1 className="text-3xl font-bold text-slate-800">Editar Estabelecimento</h1>
                            <p className="text-sm text-gray-600 mt-1">ID: {id}</p>
                        </div>
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <button type="submit" disabled={loading} className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white text-base font-bold rounded-lg shadow-md hover:bg-indigo-700 transition-colors duration-300">
                                {loading ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
                            <p className="font-bold">Erro de Edição:</p>
                            <p>{error}</p>
                        </div>
                    )}

                    {/* Layout Principal em Duas Colunas */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Coluna Esquerda */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm">
                                <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-4 mb-6">Dados Principais</h2>
                                <div className="space-y-4">
                                    <FormInput label="Nome do Estabelecimento" name="nome" value={formData.nome} onChange={handleInputChange} required />
                                    <FormInput label="Slug (URL)" name="slug" value={formData.slug} onChange={handleInputChange} required helpText="Gerado do nome, mas pode ser editado."/>
                                    <FormInput label="Chave PIX (Para Receber Pagamentos)" name="chavePix" value={formData.chavePix} onChange={handleInputChange} />
                                    <FormInput label="URL da Imagem/Logo" name="imageUrl" value={formData.imageUrl} onChange={handleInputChange} />
                                    <FormInput label="Avaliação (1-5)" name="rating" type="number" min="0" max="5" step="0.1" value={formData.rating} onChange={handleInputChange} />
                                    
                                    <div>
                                        <label htmlFor="adminUID" className="block text-sm font-medium text-slate-600 mb-1">Admin Vinculado *</label>
                                        <select id="adminUID" name="adminUID" value={formData.adminUID} onChange={handleInputChange} required className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5">
                                            <option value="">Selecione um administrador</option>
                                            {availableAdmins.map(admin => <option key={admin.id} value={admin.id}>{admin.nome} ({admin.email})</option>)}
                                        </select>
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
                                            {availablePlans.length === 0 ? (
                                                <option value="" disabled>Nenhum plano ativo disponível</option>
                                            ) : (
                                                availablePlans.map(plan => (
                                                    <option key={plan.id} value={plan.id}>
                                                        {plan.name}
                                                    </option>
                                                ))
                                            )}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm">
                                <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-4 mb-6">Contato e Horários</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormInput label="Telefone/WhatsApp" name="informacoes_contato.telefone_whatsapp" value={formData.informacoes_contato.telefone_whatsapp} onChange={handleInputChange} />
                                    <FormInput label="Instagram" name="informacoes_contato.instagram" value={formData.informacoes_contato.instagram} onChange={handleInputChange} placeholder="@usuario" />
                                </div>
                                <div className="mt-4">
                                    <FormInput label="Horário de Funcionamento" name="informacoes_contato.horario_funcionamento" value={formData.informacoes_contato.horario_funcionamento} onChange={handleInputChange} placeholder="Ex: Ter - Dom: 18h às 23h"/>
                                </div>
                            </div>
                        </div>

                        {/* Coluna Direita */}
                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm">
                                <h2 className="text-lg font-bold text-slate-800 mb-4">Status</h2>
                                <label className="flex items-center cursor-pointer">
                                    <div className="relative">
                                        <input type="checkbox" name="ativo" className="sr-only" checked={formData.ativo} onChange={handleInputChange} />
                                        <div className={`block w-14 h-8 rounded-full ${formData.ativo ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
                                        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${formData.ativo ? 'transform translate-x-full' : ''}`}></div>
                                    </div>
                                    <div className="ml-3 text-base font-semibold text-slate-700">{formData.ativo ? 'Ativo' : 'Inativo'}</div>
                                </label>
                            </div>
                            {/* NOVO: Informações de Cobrança */}
                            <div className="bg-white p-6 rounded-xl shadow-sm">
                                <h2 className="text-lg font-bold text-slate-800 mb-4">Informações de Cobrança</h2>
                                <p className="text-sm text-gray-700 mb-2">
                                    <strong>Próxima Cobrança:</strong>{' '}
                                    {formData.nextBillingDate && formData.nextBillingDate.toDate ? 
                                        format(formData.nextBillingDate.toDate(), 'dd/MM/yyyy', { locale: ptBR }) : 
                                        'N/A'}
                                </p>
                                <p className="text-sm text-gray-500">
                                    A data de cobrança é definida automaticamente na criação e pode ser ajustada via sistema de faturamento.
                                </p>
                                {/* Botão para forçar renovação ou ver detalhes da fatura aqui, se aplicável */}
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm">
                                <h2 className="text-lg font-bold text-slate-800 mb-4">Endereço</h2>
                                <div className="space-y-4">
                                    <FormInput label="Rua" name="endereco.rua" value={formData.endereco.rua} onChange={handleInputChange} />
                                    <FormInput label="Número" name="endereco.numero" value={formData.endereco.numero} onChange={handleInputChange} />
                                    <FormInput label="Bairro" name="endereco.bairro" value={formData.endereco.bairro} onChange={handleInputChange} />
                                    <FormInput label="Cidade" name="endereco.cidade" value={formData.endereco.cidade} onChange={handleInputChange} />
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