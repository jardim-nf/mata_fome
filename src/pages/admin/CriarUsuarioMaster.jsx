// src/pages/admin/CriarUsuarioMaster.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger';
import { getFunctions, httpsCallable } from 'firebase/functions';

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

// Componente para Inputs (melhorado com sua paleta)
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

function CriarUsuarioMaster() {
    const navigate = useNavigate();
    const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth(); // Importa logout para o header

    const [formData, setFormData] = useState({
        nome: '',
        email: '',
        senha: '',
        isAdmin: false,
        isMasterAdmin: false,
        ativo: true, // Default para ativo
        estabelecimentosGerenciados: [],
    });
    const [loadingForm, setLoadingForm] = useState(false);
    const [formError, setFormError] = useState('');
    const [estabelecimentosList, setEstabelecimentosList] = useState([]);
    const [loadingEstabelecimentos, setLoadingEstabelecimentos] = useState(true);

    const functions = getFunctions();

    // Controle de acesso
    useEffect(() => {
        if (!authLoading) {
            if (!currentUser || !isMasterAdmin) {
                toast.error('Acesso negado. Você não tem permissões de Master Administrador.');
                navigate('/master-dashboard');
                return;
            }
        }
    }, [currentUser, isMasterAdmin, authLoading, navigate]);

    // Carregar lista de estabelecimentos
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

    // Handlers
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
    const userDataForCF = {
      nome: formData.nome,
      email: formData.email,
      senha: formData.senha,
      estabelecimentos: formData.estabelecimentosGerenciados || [],
      isAdmin: formData.isAdmin,
      isMasterAdmin: formData.isMasterAdmin,
    };

    // 🌐 Chamada para nova Cloud Function (com CORS resolvido)
    const response = await fetch(
      'https://us-central1-matafome-98455.cloudfunctions.net/createUserByMasterAdminHttp',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userDataForCF),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Erro ao criar usuário');
    }

    console.log('✅ Usuário criado via CF:', result);

    toast.success(result.message || 'Usuário criado com sucesso!');
    navigate('/master/usuarios');
  } catch (error) {
    console.error('❌ Erro ao criar usuário via CF:', error);
    toast.error(error.message || 'Erro ao criar usuário');
    setFormError(error.message);
  } finally {
    setLoadingForm(false);
  }
};


    if (authLoading || loadingForm || loadingEstabelecimentos) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <p className="text-xl text-black">Carregando...</p>
            </div>
        );
    }

    if (!isMasterAdmin) return null; // O redirecionamento já é tratado no useEffect

    return (
        <div className="bg-gray-50 min-h-screen pt-24 pb-8 px-4 font-sans"> {/* Adiciona pt-24 para compensar o header fixo */}
            {/* Header (reutilizado do MasterDashboard) */}
            <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} />

            <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-6 sm:p-8 border border-gray-100">
                {/* Título da Página e Botão Voltar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                    <h1 className="text-3xl font-extrabold text-black text-center sm:text-left">
                        Criar Novo Usuário
                        <div className="w-24 h-1 bg-yellow-500 mx-auto sm:mx-0 mt-2 rounded-full"></div>
                    </h1>
                    <Link
                        to="/master/usuarios"
                        className="bg-gray-200 text-gray-700 font-semibold px-5 py-2 rounded-lg hover:bg-gray-300 transition-colors duration-300 flex items-center gap-2 shadow-md"
                    >
                        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"></path></svg>
                        Voltar para Gerenciar Usuários
                    </Link>
                </div>

                {formError && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md" role="alert">
                        <p className="font-bold">Erro ao Criar Usuário:</p>
                        <p>{formError}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6"> {/* Aumentei o espaçamento */}
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

                    {/* Checkboxes para Papéis */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-8 mt-5">
                        <label className="flex items-center cursor-pointer group">
                            <input
                                type="checkbox"
                                name="isAdmin"
                                checked={formData.isAdmin}
                                onChange={handleInputChange}
                                className="h-5 w-5 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500 transition-colors duration-200" // Cor amarela
                            />
                            <span className="ml-2 text-sm font-medium text-gray-700 group-hover:text-black transition-colors duration-200">Administrador de Estabelecimento</span>
                        </label>
                        <label className="flex items-center cursor-pointer group">
                            <input
                                type="checkbox"
                                name="isMasterAdmin"
                                checked={formData.isMasterAdmin}
                                onChange={handleInputChange}
                                className="h-5 w-5 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500 transition-colors duration-200" // Cor amarela
                            />
                            <span className="ml-2 text-sm font-medium text-gray-700 group-hover:text-black transition-colors duration-200">Master Administrador</span>
                        </label>
                    </div>

                    {/* Seleção de Estabelecimentos Gerenciados */}
                    {formData.isAdmin && (
                        <div>
                            <label htmlFor="estabelecimentos" className="block text-sm font-medium text-gray-700 mb-2">
                                Estabelecimentos Gerenciados:
                            </label>
                            <select
                                id="estabelecimentos"
                                name="estabelecimentosGerenciados"
                                multiple
                                value={formData.estabelecimentosGerenciados}
                                onChange={handleEstabelecimentoChange}
                                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm p-2.5 bg-white text-gray-800 focus:border-yellow-500 focus:ring-yellow-500 h-48 transition-colors duration-300"
                            >
                                {loadingEstabelecimentos ? (
                                    <option disabled>Carregando estabelecimentos...</option>
                                ) : estabelecimentosList.length === 0 ? (
                                    <option disabled>Nenhum estabelecimento disponível</option>
                                ) : (
                                    estabelecimentosList.map(estab => (
                                        <option key={estab.id} value={estab.id}>
                                            {estab.nome}
                                        </option>
                                    ))
                                )}
                            </select>
                            <p className="mt-1 text-xs text-gray-500">Mantenha 'Ctrl' (Windows) ou 'Cmd' (Mac) para selecionar múltiplos.</p>
                        </div>
                    )}

                    {/* Toggle de Usuário Ativo */}
                    <div className="flex items-center mt-5">
                        <label htmlFor="user-active-toggle" className="flex items-center cursor-pointer">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    id="user-active-toggle"
                                    name="ativo"
                                    className="sr-only"
                                    checked={formData.ativo}
                                    onChange={handleInputChange}
                                />
                                {/* Pista do toggle: bg-yellow-500 para ativo, bg-gray-300 para inativo */}
                                <div className={`block w-14 h-8 rounded-full ${formData.ativo ? 'bg-yellow-500' : 'bg-gray-300'} transition-colors duration-300`}></div>
                                {/* Ponto do toggle: bg-black para ativo, bg-white para inativo */}
                                <div className={`dot absolute left-1 top-1 w-6 h-6 rounded-full transition-transform duration-300 ${formData.ativo ? 'transform translate-x-full bg-black' : 'bg-white'}`}></div>
                            </div>
                            <span className="ml-3 text-base font-semibold text-gray-800">
                                {formData.ativo ? 'Usuário Ativo' : 'Usuário Inativo'}
                            </span>
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={loadingForm}
                        className="w-full px-6 py-3 bg-black text-white text-lg font-bold rounded-lg shadow-md hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-300 mt-8"
                    >
                        {loadingForm ? 'Criando Usuário...' : 'Criar Usuário'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default CriarUsuarioMaster;