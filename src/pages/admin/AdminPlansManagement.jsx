// src/pages/admin/AdminPlansManagement.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger'; 

// --- Componente de Header Master Dashboard (reutilizado) ---
// Normalmente, isso estaria em um Layout.jsx ou componente separado.
function DashboardHeader({ currentUser, logout, navigate }) {
  const userEmailPrefix = currentUser.email ? currentUser.email.split('@')[0] : 'Usuário';

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Você foi desconectado com sucesso!');
      navigate('/');
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      toast.error('Ocorreu um erro ao tentar desconectar.');
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-20 p-6 flex justify-between items-center bg-black shadow-md border-b border-gray-800">
      <div className="font-extrabold text-2xl text-white cursor-pointer hover:text-gray-200 transition-colors duration-300" onClick={() => navigate('/')}>
        DEU FOME <span className="text-yellow-500">.</span>
      </div>
      <div className="flex items-center space-x-4">
        <span className="text-white text-md font-medium">Olá, {userEmailPrefix}!</span>
        <Link to="/master-dashboard" className="px-4 py-2 rounded-full text-black bg-yellow-500 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-yellow-600 hover:shadow-md">
            Dashboard
        </Link>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-full text-white border border-gray-600 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-gray-800 hover:border-gray-500"
        >
          Sair
        </button>
      </div>
    </header>
  );
}
// --- Fim DashboardHeader ---

// Reusable FormInput component (ajustado para a paleta)
function FormInput({ label, name, value, onChange, type = 'text', helpText = '', ...props }) {
    return (
        <div>
            <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input
                id={name}
                name={name}
                value={value || ''}
                onChange={onChange}
                type={type}
                {...props}
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2.5 bg-white text-gray-800 focus:border-yellow-500 focus:ring-yellow-500 transition-colors duration-300"
            />
            {helpText && <p className="mt-1 text-xs text-gray-500">{helpText}</p>}
        </div>
    );
}

function AdminPlansManagement() {
    const navigate = useNavigate();
    const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth(); // Importa logout para o header

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
                console.error("Erro ao buscar planos:", err);
                setError("Falha ao carregar planos.");
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
        if (!window.confirm(`Tem certeza que deseja deletar o plano "${planName}"? Esta ação é irreversível.`)) {
            return;
        }
        setFormLoading(true);
        try {
            await deleteDoc(doc(db, 'plans', planId));
            auditLogger(
                'PLANO_DELETADO',
                { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
                { type: 'plano', id: planId, name: planName }
            );
            toast.success('Plano deletado com sucesso!');
        } catch (err) {
            console.error("Erro ao deletar plano:", err);
            toast.error('Erro ao deletar plano.');
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
                    'PLANO_ATUALIZADO',
                    { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
                    { type: 'plano', id: currentPlan.id, name: currentPlan.name },
                    { changes: currentPlan } 
                );
                toast.success('Plano atualizado com sucesso!');
            } else {
                const newPlanRef = collection(db, 'plans');
                const docRef = await addDoc(newPlanRef, {
                    ...currentPlan,
                    createdAt: new Date(),
                    id: undefined 
                });
                await updateDoc(docRef, { id: docRef.id });

                auditLogger(
                    'PLANO_CRIADO',
                    { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
                    { type: 'plano', id: docRef.id, name: currentPlan.name },
                    { newPlanData: currentPlan }
                );
                toast.success('Plano criado com sucesso!');
            }
            resetForm();
        } catch (err) {
            console.error("Erro ao salvar plano:", err);
            setFormError(`Erro ao salvar plano: ${err.message}`);
            toast.error('Erro ao salvar plano.');
        } finally {
            setFormLoading(false);
        }
    };

    if (authLoading || loadingPlans) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <p className="text-xl text-black">Carregando planos...</p>
            </div>
        );
    }

    if (!isMasterAdmin) return null;

    return (
        <div className="bg-gray-50 min-h-screen pt-24 pb-8 px-4"> {/* Adiciona pt-24 para compensar o header fixo */}
            {/* Header (reutilizado do MasterDashboard) */}
            <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} />

            <div className="max-w-7xl mx-auto">
                {/* Título da Página e Botão Voltar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                    <h1 className="text-3xl font-extrabold text-black text-center sm:text-left">
                        💰 Gerenciar Planos de Assinatura
                        <div className="w-24 h-1 bg-yellow-500 mx-auto sm:mx-0 mt-2 rounded-full"></div>
                    </h1>
                    <Link
                        to="/master-dashboard"
                        className="bg-gray-200 text-gray-700 font-semibold px-5 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-300 flex items-center gap-2 shadow-md"
                    >
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"></path></svg>
                        Voltar
                    </Link>
                </div>

                {error && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md" role="alert">
                        <p className="font-bold">Erro ao Carregar Planos:</p>
                        <p>{error}</p>
                    </div>
                )}

                {/* Plan Form (Create/Edit) */}
                <div className="bg-white p-6 rounded-xl shadow-md mb-8 border border-gray-100">
                    <h2 className="text-xl font-bold text-black border-b border-gray-200 pb-4 mb-6">
                        {isEditing ? 'Editar Plano' : 'Criar Novo Plano'}
                    </h2>
                    {formError && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md" role="alert">
                            <p className="font-bold">Erro:</p>
                            <p>{formError}</p>
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-6"> {/* Aumentei o espaçamento */}
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
                            // Para textarea, você pode querer adicionar uma classe específica
                            className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2.5 bg-white text-gray-800 focus:border-yellow-500 focus:ring-yellow-500 transition-colors duration-300 h-24 resize-y" // Adicionado altura e redimensionamento
                        />
                        <FormInput
                            label="Preço (Mensal)"
                            name="price"
                            value={currentPlan.price}
                            onChange={handleInputChange}
                            type="number"
                            step="0.01"
                            required
                            min="0" // Garante que o preço não seja negativo
                        />

                        {/* Features Section */}
                        <div className="pt-6 border-t border-gray-100"> {/* Linha divisória mais sutil */}
                            <h3 className="text-lg font-bold text-black mb-4">Recursos & Limites</h3>
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
                                <label className="flex items-center cursor-pointer group"> {/* Checkbox de Acesso a Relatórios */}
                                    <input
                                        type="checkbox"
                                        name="features.accessReports"
                                        checked={currentPlan.features.accessReports}
                                        onChange={handleInputChange}
                                        className="h-5 w-5 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500 transition-colors duration-200"
                                    />
                                    <span className="ml-2 text-sm font-medium text-gray-700 group-hover:text-black transition-colors duration-200">Acesso a Relatórios Avançados</span>
                                </label>
                                <label className="flex items-center cursor-pointer group"> {/* Checkbox de Suporte Premium */}
                                    <input
                                        type="checkbox"
                                        name="features.premiumSupport"
                                        checked={currentPlan.features.premiumSupport}
                                        onChange={handleInputChange}
                                        className="h-5 w-5 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500 transition-colors duration-200"
                                    />
                                    <span className="ml-2 text-sm font-medium text-gray-700 group-hover:text-black transition-colors duration-200">Suporte Premium</span>
                                </label>
                            </div>
                        </div>

                        {/* Plan Status (Toggle) */}
                        <div className="pt-6 border-t border-gray-100"> {/* Linha divisória mais sutil */}
                            <label htmlFor="plan-active-toggle" className="flex items-center cursor-pointer">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        id="plan-active-toggle"
                                        name="isActive"
                                        className="sr-only"
                                        checked={currentPlan.isActive}
                                        onChange={handleInputChange}
                                    />
                                    {/* Pista do toggle: bg-yellow-500 para ativo, bg-gray-300 para inativo */}
                                    <div className={`block w-14 h-8 rounded-full ${currentPlan.isActive ? 'bg-yellow-500' : 'bg-gray-300'} transition-colors duration-300`}></div>
                                    {/* Ponto do toggle: bg-black para ativo, bg-white para inativo */}
                                    <div className={`dot absolute left-1 top-1 w-6 h-6 rounded-full transition-transform duration-300 ${currentPlan.isActive ? 'transform translate-x-full bg-black' : 'bg-white'}`}></div>
                                </div>
                                <span className="ml-3 text-base font-semibold text-gray-800">
                                    {currentPlan.isActive ? 'Plano Ativo' : 'Plano Inativo'}
                                </span>
                            </label>
                            <p className="mt-2 text-xs text-gray-500">Apenas planos ativos podem ser atribuídos a novos estabelecimentos.</p>
                        </div>

                        <div className="flex space-x-4 justify-end pt-4"> {/* Botões de ação do formulário */}
                            {isEditing && (
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="px-5 py-2 rounded-lg bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300 shadow-md"
                                    disabled={formLoading}
                                >
                                    Cancelar Edição
                                </button>
                            )}
                            <button
                                type="submit"
                                className="px-5 py-2 rounded-lg bg-yellow-500 text-black font-semibold hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-300 shadow-md"
                                disabled={formLoading}
                            >
                                {formLoading ? 'Salvando...' : (isEditing ? 'Atualizar Plano' : 'Criar Plano')}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Plans List Table */}
                <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
                    <h2 className="text-xl font-bold text-black border-b border-gray-200 pb-4 mb-6">
                        Planos Existentes ({plans.length})
                    </h2>
                    {plans.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">Nenhum plano encontrado.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">Nome do Plano</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">Preço</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">Máx. Produtos</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">Máx. Admins</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">Relatórios</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-black uppercase tracking-wider">Status</th>
                                        <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-black uppercase tracking-wider">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {plans.map(plan => (
                                        <tr key={plan.id} className="hover:bg-gray-50 transition-colors duration-150">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{plan.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">R$ {plan.price?.toFixed(2).replace('.', ',')}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{plan.features?.maxProducts || 0}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{plan.features?.maxAdmins || 0}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{plan.features?.accessReports ? 'Sim' : 'Não'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${plan.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {plan.isActive ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium space-x-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditClick(plan)}
                                                    className="px-3 py-1 rounded-md bg-black hover:bg-gray-800 text-white transition-colors duration-300 shadow-sm"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteClick(plan.id, plan.name)}
                                                    className="px-3 py-1 rounded-md bg-red-500 hover:bg-red-600 text-white transition-colors duration-300 shadow-sm"
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