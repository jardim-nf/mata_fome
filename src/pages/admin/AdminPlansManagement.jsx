// src/pages/admin/AdminPlansManagement.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger'; // For logging actions

// Reusable FormInput component (assuming it's available or define it here if needed)
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

function AdminPlansManagement() {
    const navigate = useNavigate();
    const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();

    const [plans, setPlans] = useState([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [error, setError] = useState('');

    const [isEditing, setIsEditing] = useState(false);
    const [currentPlan, setCurrentPlan] = useState({
        id: '',
        name: '',
        description: '',
        price: 0,
        features: {
            maxProducts: 0,
            maxAdmins: 0,
            accessReports: false,
            premiumSupport: false
        },
        isActive: true
    });
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');

    // Access control
    useEffect(() => {
        if (!authLoading) {
            if (!currentUser || !isMasterAdmin) {
                toast.error('Acesso negado. Você não tem permissões de Master Administrador.');
                navigate('/master-dashboard');
            }
        }
    }, [currentUser, isMasterAdmin, authLoading, navigate]);

    // Fetch plans
    useEffect(() => {
        if (!isMasterAdmin || !currentUser) return;

        setLoadingPlans(true);
        const q = query(collection(db, 'plans'), orderBy('price', 'asc'));
        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const fetchedPlans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setPlans(fetchedPlans);
                setLoadingPlans(false);
            },
            (err) => {
                console.error("Erro ao buscar planos:", err); // Traduzido
                setError("Falha ao carregar planos."); // Traduzido
                setLoadingPlans(false);
            }
        );
        return () => unsubscribe();
    }, [isMasterAdmin, currentUser]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name.startsWith('features.')) {
            const featureName = name.split('.')[1];
            setCurrentPlan(prev => ({
                ...prev,
                features: {
                    ...prev.features,
                    [featureName]: type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value)
                }
            }));
        } else {
            setCurrentPlan(prev => ({
                ...prev,
                [name]: type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value)
            }));
        }
    };

    const resetForm = () => {
        setIsEditing(false);
        setCurrentPlan({
            id: '',
            name: '',
            description: '',
            price: 0,
            features: {
                maxProducts: 0,
                maxAdmins: 0,
                accessReports: false,
                premiumSupport: false
            },
            isActive: true
        });
        setFormError('');
    };

    const handleEditClick = (plan) => {
        setIsEditing(true);
        setCurrentPlan(plan);
        setFormError('');
    };

    const handleDeleteClick = async (planId, planName) => {
        if (!window.confirm(`Tem certeza que deseja deletar o plano "${planName}"? Esta ação é irreversível.`)) { // Traduzido
            return;
        }
        setFormLoading(true);
        try {
            await deleteDoc(doc(db, 'plans', planId));
            auditLogger(
                'PLANO_DELETADO', // Traduzido
                { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
                { type: 'plano', id: planId, name: planName } // Traduzido
            );
            toast.success('Plano deletado com sucesso!'); // Traduzido
        } catch (err) {
            console.error("Erro ao deletar plano:", err); // Traduzido
            toast.error('Erro ao deletar plano.'); // Traduzido
        } finally {
            setFormLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        setFormError('');

        try {
            if (isEditing) {
                const planRef = doc(db, 'plans', currentPlan.id);
                await updateDoc(planRef, currentPlan);
                auditLogger(
                    'PLANO_ATUALIZADO', // Traduzido
                    { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
                    { type: 'plano', id: currentPlan.id, name: currentPlan.name }, // Traduzido
                    { changes: currentPlan } // Log all changes for simplicity
                );
                toast.success('Plano atualizado com sucesso!'); // Traduzido
            } else {
                const newPlanRef = collection(db, 'plans');
                const docRef = await addDoc(newPlanRef, {
                    ...currentPlan,
                    createdAt: new Date(),
                    id: undefined // Firebase automatically creates an ID, so don't explicitly set 'id' in data
                });
                // After adding, update the document with its own ID if you need it explicitly inside
                await updateDoc(docRef, { id: docRef.id });

                auditLogger(
                    'PLANO_CRIADO', // Traduzido
                    { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
                    { type: 'plano', id: docRef.id, name: currentPlan.name }, // Traduzido
                    { newPlanData: currentPlan }
                );
                toast.success('Plano criado com sucesso!'); // Traduzido
            }
            resetForm();
        } catch (err) {
            console.error("Erro ao salvar plano:", err); // Traduzido
            setFormError(`Erro ao salvar plano: ${err.message}`); // Traduzido
            toast.error('Erro ao salvar plano.'); // Traduzido
        } finally {
            setFormLoading(false);
        }
    };

    if (authLoading || loadingPlans) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
                <p className="text-xl text-gray-700">Carregando planos...</p> {/* Traduzido */}
            </div>
        );
    }

    if (!isMasterAdmin) return null;

    return (
        <div className="p-4 bg-gray-100 min-h-screen">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                        💰 Gerenciar Planos de Assinatura {/* Traduzido */}
                    </h1>
                    {/* Standardized "Voltar" button */}
                    <Link
                        to="/master-dashboard"
                        className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md font-semibold hover:bg-gray-300 flex items-center gap-1"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                        Voltar
                    </Link>
                </div>

                {error && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
                        <p className="font-bold">Erro:</p>
                        <p>{error}</p>
                    </div>
                )}

                {/* Plan Form (Create/Edit) */}
                <div className="bg-white p-6 rounded-xl shadow-md mb-8">
                    <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-4 mb-6">
                        {isEditing ? 'Editar Plano' : 'Criar Novo Plano'}
                    </h2>
                    {formError && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
                            <p className="font-bold">Erro:</p>
                            <p>{formError}</p>
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <FormInput
                            label="Nome do Plano"
                            name="name"
                            value={currentPlan.name}
                            onChange={handleInputChange}
                            required
                        />
                        <FormInput
                            label="Descrição"
                            name="description"
                            value={currentPlan.description}
                            onChange={handleInputChange}
                            type="textarea"
                        />
                        <FormInput
                            label="Preço (Mensal)"
                            name="price"
                            value={currentPlan.price}
                            onChange={handleInputChange}
                            type="number"
                            step="0.01"
                            required
                        />

                        {/* Features Section */}
                        <div className="pt-4 border-t border-gray-200">
                            <h3 className="text-lg font-semibold text-slate-700 mb-3">Recursos & Limites</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormInput
                                    label="Máx. Produtos"
                                    name="features.maxProducts"
                                    value={currentPlan.features.maxProducts}
                                    onChange={handleInputChange}
                                    type="number"
                                    min="0"
                                />
                                <FormInput
                                    label="Máx. Admins por Estabelecimento"
                                    name="features.maxAdmins"
                                    value={currentPlan.features.maxAdmins}
                                    onChange={handleInputChange}
                                    type="number"
                                    min="0"
                                />
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="features.accessReports"
                                        checked={currentPlan.features.accessReports}
                                        onChange={handleInputChange}
                                        className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    />
                                    <span className="ml-2 text-sm font-medium text-gray-700">Acesso a Relatórios Avançados</span>
                                </label>
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="features.premiumSupport"
                                        checked={currentPlan.features.premiumSupport}
                                        onChange={handleInputChange}
                                        className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    />
                                    <span className="ml-2 text-sm font-medium text-gray-700">Suporte Premium</span>
                                </label>
                            </div>
                        </div>

                        {/* Plan Status */}
                        <div className="pt-4 border-t border-gray-200">
                            <label className="flex items-center cursor-pointer">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        name="isActive"
                                        className="sr-only"
                                        checked={currentPlan.isActive}
                                        onChange={handleInputChange}
                                    />
                                    <div className={`block w-14 h-8 rounded-full ${currentPlan.isActive ? 'bg-green-600' : 'bg-gray-300'}`}></div>
                                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${currentPlan.isActive ? 'transform translate-x-full' : ''}`}></div>
                                </div>
                                <span className="ml-3 text-base font-semibold text-gray-700">Plano Ativo</span>
                            </label>
                            <p className="mt-2 text-xs text-slate-500">Apenas planos ativos podem ser atribuídos a novos estabelecimentos.</p>
                        </div>

                        <div className="flex space-x-4 justify-end">
                            {isEditing && (
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="px-4 py-2 bg-gray-300 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                                    disabled={formLoading}
                                >
                                    Cancelar
                                </button>
                            )}
                            <button
                                type="submit"
                                className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                                disabled={formLoading}
                            >
                                {formLoading ? 'Salvando...' : (isEditing ? 'Atualizar Plano' : 'Criar Plano')}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Plans List Table */}
                <div className="bg-white p-6 rounded-xl shadow-md">
                    <h2 className="text-xl font-bold text-slate-800 border-b border-slate-200 pb-4 mb-6">
                        Planos Existentes ({plans.length})
                    </h2>
                    {plans.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">Nenhum plano encontrado.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome do Plano</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preço</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Máx. Produtos</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Máx. Admins</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Relatórios</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {plans.map(plan => (
                                        <tr key={plan.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{plan.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">R$ {plan.price?.toFixed(2).replace('.', ',')}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{plan.features?.maxProducts || 0}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{plan.features?.maxAdmins || 0}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{plan.features?.accessReports ? 'Sim' : 'Não'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${plan.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {plan.isActive ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditClick(plan)}
                                                    className="px-3 py-1 rounded-md bg-blue-500 hover:bg-blue-600 text-white"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteClick(plan.id, plan.name)}
                                                    className="px-3 py-1 rounded-md bg-red-500 hover:bg-red-600 text-white"
                                                    disabled={formLoading}
                                                >
                                                    Deletar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AdminPlansManagement;