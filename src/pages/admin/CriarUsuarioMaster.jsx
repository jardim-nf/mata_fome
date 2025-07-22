// src/pages/admin/CriarUsuarioMaster.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, orderBy, getDocs } from 'firebase/firestore'; // Removido 'auth' e 'setDoc'
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger';
// NOVO: Importar para chamar Cloud Functions
import { getFunctions, httpsCallable } from 'firebase/functions';

// Componente para Inputs (mantido o mesmo)
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

function CriarUsuarioMaster() {
    const navigate = useNavigate();
    const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();

    const [formData, setFormData] = useState({
        nome: '',
        email: '',
        senha: '',
        isAdmin: false,
        isMasterAdmin: false,
        ativo: true,
        estabelecimentosGerenciados: [],
    });
    const [loadingForm, setLoadingForm] = useState(false);
    const [formError, setFormError] = useState('');
    const [estabelecimentosList, setEstabelecimentosList] = useState([]);
    const [loadingEstabelecimentos, setLoadingEstabelecimentos] = useState(true);

    // Inicializa Cloud Functions
    const functions = getFunctions();

    // Controle de acesso (mantido o mesmo)
    useEffect(() => {
        if (!authLoading) {
            if (!currentUser || !isMasterAdmin) {
                toast.error('Acesso negado. Você não tem permissões de Master Administrador.');
                navigate('/master-dashboard');
                return;
            }
        }
    }, [currentUser, isMasterAdmin, authLoading, navigate]);

    // Carregar lista de estabelecimentos (mantido o mesmo)
    useEffect(() => {
        if (!isMasterAdmin || !currentUser) return;

        const fetchEstabelecimentos = async () => {
            try {
                const q = query(collection(db, 'estabelecimentos'), orderBy('nome', 'asc'));
                const querySnapshot = await getDocs(q);
                const list = querySnapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }));
                setEstabelecimentosList(list);
            } catch (err) {
                console.error("Erro ao carregar lista de estabelecimentos:", err);
                toast.error("Erro ao carregar lista de estabelecimentos.");
            } finally {
                setLoadingEstabelecimentos(false);
            }
        };
        fetchEstabelecimentos();
    }, [isMasterAdmin, currentUser]);

    // Handlers (mantidos os mesmos, exceto handleSubmit)
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleEstabelecimentoChange = (e) => {
        const { options } = e.target;
        const selectedValues = [];
        for (let i = 0, l = options.length; i < l; i++) {
            if (options[i].selected) {
                selectedValues.push(options[i].value);
            }
        }
        setFormData(prev => ({
            ...prev,
            estabelecimentosGerenciados: selectedValues
        }));
    };

    // FUNÇÃO ATUALIZADA PARA CRIAR USUÁRIO VIA CLOUD FUNCTION
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoadingForm(true);
        setFormError('');

        try {
            // Prepara os dados para enviar para a Cloud Function
            const userDataForCF = {
                email: formData.email,
                password: formData.senha,
                name: formData.nome,
                isAdmin: formData.isAdmin,
                isMasterAdmin: formData.isMasterAdmin,
                estabelecimentosGerenciados: formData.estabelecimentosGerenciados,
                // Adicione outros campos de endereço/telefone se o createUserByMasterAdmin da CF precisar
                // phoneNumber, addressStreet, etc.
            };

            // Obtenha a função HTTP Callable
            const createUserCallable = httpsCallable(functions, 'createUserByMasterAdmin');
            
            // Chame a Cloud Function
            const result = await createUserCallable(userDataForCF);
            
            console.log('Resultado da Cloud Function:', result.data); // result.data contém o que a CF retorna
            
            // Log de auditoria para a ação de criação via CF
            auditLogger(
                'USUARIO_CRIADO_VIA_CF',
                { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
                { type: 'usuario', id: result.data.uid, name: formData.nome }, // Usa o UID retornado pela CF
                { ...userDataForCF, success: result.data.success }
            );

            toast.success(result.data.message || 'Usuário criado com sucesso!');
            navigate('/master/usuarios');
        } catch (error) {
            console.error("Erro ao criar usuário via Cloud Function:", error);
            let errorMessage = 'Erro ao criar usuário.';
            if (error.code === 'already-exists' || error.code === 'email-already-in-use') { // Códigos de erro da CF
                errorMessage = 'Este e-mail já está em uso.';
            } else if (error.code === 'invalid-argument') {
                errorMessage = 'Dados inválidos: ' + error.message;
            } else if (error.code === 'permission-denied') {
                errorMessage = 'Permissão negada: Você não é um Master Admin válido.';
            } else if (error.message) {
                errorMessage = `Erro: ${error.message}`;
            }
            setFormError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoadingForm(false);
        }
    };

    // ... (restante do componente permanece o mesmo) ...
    if (authLoading || loadingForm || loadingEstabelecimentos) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
                <p className="text-xl text-gray-700">Carregando...</p>
            </div>
        );
    }

    if (!isMasterAdmin) return null;

    return (
        <div className="bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8 font-sans">
            <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-6">
                <Link to="/master/usuarios" className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    Voltar para Gerenciar Usuários
                </Link>
                <h1 className="text-2xl font-bold text-slate-800 mb-6">Criar Novo Usuário</h1>

                {formError && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
                        <p className="font-bold">Erro ao Criar Usuário:</p>
                        <p>{formError}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <FormInput
                        label="Nome Completo"
                        name="nome"
                        value={formData.nome}
                        onChange={handleInputChange}
                        required
                    />
                    <FormInput
                        label="E-mail"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                    />
                    <FormInput
                        label="Senha Inicial"
                        name="senha"
                        type="password"
                        value={formData.senha}
                        onChange={handleInputChange}
                        required
                        helpText="Mínimo de 6 caracteres. O usuário deve alterá-la após o primeiro login."
                    />

                    <div className="flex items-center space-x-4">
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                name="isAdmin"
                                checked={formData.isAdmin}
                                onChange={handleInputChange}
                                className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm font-medium text-gray-700">Administrador de Estabelecimento</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                name="isMasterAdmin"
                                checked={formData.isMasterAdmin}
                                onChange={handleInputChange}
                                className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm font-medium text-gray-700">Master Administrador</span>
                        </label>
                    </div>

                    {formData.isAdmin && (
                        <div>
                            <label htmlFor="estabelecimentos" className="block text-sm font-medium text-slate-600">
                                Estabelecimentos Gerenciados:
                            </label>
                            <select
                                id="estabelecimentos"
                                name="estabelecimentosGerenciados"
                                multiple
                                value={formData.estabelecimentosGerenciados}
                                onChange={handleEstabelecimentoChange}
                                className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm p-2.5 focus:border-indigo-500 focus:ring-indigo-500 h-48"
                            >
                                {estabelecimentosList.map(estab => (
                                    <option key={estab.id} value={estab.id}>
                                        {estab.nome}
                                    </option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-slate-500">Mantenha 'Ctrl' (Windows) ou 'Cmd' (Mac) para selecionar múltiplos.</p>
                        </div>
                    )}

                    <div className="flex items-center">
                        <label className="flex items-center cursor-pointer">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    name="ativo"
                                    className="sr-only"
                                    checked={formData.ativo}
                                    onChange={handleInputChange}
                                />
                                <div className={`block w-14 h-8 rounded-full ${formData.ativo ? 'bg-green-600' : 'bg-gray-300'}`}></div>
                                <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${formData.ativo ? 'transform translate-x-full' : ''}`}></div>
                            </div>
                            <span className="ml-3 text-base font-semibold text-gray-700">{formData.ativo ? 'Usuário Ativo' : 'Usuário Inativo'}</span>
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={loadingForm}
                        className="w-full px-6 py-3 bg-indigo-600 text-white text-base font-bold rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors duration-300"
                    >
                        {loadingForm ? 'Criando Usuário...' : 'Criar Usuário'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default CriarUsuarioMaster;