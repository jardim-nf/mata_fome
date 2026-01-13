// src/pages/admin/EditarUsuarioMaster.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger'; // IMPORT DA FUNÇÃO DE LOG

// Componente para Inputs, para manter o código do formulário limpo
function FormInput({ label, name, value, onChange, type = 'text', helpText = '', ...props }) {
    return (
        <div>
            <label htmlFor={name} className="block text-sm font-medium text-slate-600">{label}</label>
            <input
                id={name}
                name={name}
                value={value || ''}
                onChange={onChange}
                type={type}
                {...props}
                className="mt-1 block flex-col sm:flex-row rounded-lg border-slate-300 shadow-sm p-2.5 focus:border-indigo-500 focus:ring-indigo-500"
            />
            {helpText && <p className="mt-1 text-xs text-slate-500">{helpText}</p>}
        </div>
    );
}

function EditarUsuarioMaster() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();

    const [formData, setFormData] = useState(null);
    const [loadingForm, setLoadingForm] = useState(true);
    const [formError, setFormError] = useState('');
    const [estabelecimentosList, setEstabelecimentosList] = useState([]);
    const [loadingEstabelecimentos, setLoadingEstabelecimentos] = useState(true);


    useEffect(() => {
        if (authLoading) return;

        if (!currentUser || !isMasterAdmin) {
            toast.error('Acesso negado. Você não tem permissões de Master Administrador.');
            navigate('/master-dashboard');
            return;
        }

        const fetchData = async () => {
            try {
                const userRef = doc(db, 'usuarios', id);
                const userSnap = await getDoc(userRef);

                if (!userSnap.exists()) {
                    throw new Error('Usuário não encontrado.');
                }
                setFormData(userSnap.data());

                const q = query(collection(db, 'estabelecimentos'), orderBy('nome', 'asc'));
                const querySnapshot = await getDocs(q);
                const list = querySnapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }));
                setEstabelecimentosList(list);

            } catch (err) {
                console.error("Erro ao carregar dados:", err);
                setFormError(err.message);
                toast.error(err.message);
            } finally {
                setLoadingForm(false);
                setLoadingEstabelecimentos(false);
            }
        };

        fetchData();
    }, [id, currentUser, isMasterAdmin, authLoading, navigate]);


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


    const handleUpdate = async (e) => {
        e.preventDefault();
        setLoadingForm(true);
        setFormError('');

        if (currentUser.uid === id && !formData.isMasterAdmin) {
            toast.error("Você não pode remover suas próprias permissões de Master Administrador.");
            setLoadingForm(false);
            return;
        }

        try {
            const userRef = doc(db, 'usuarios', id);
            const { senha, ...dataToUpdate } = formData;

            // Para logar mudanças específicas, você precisaria comparar dataToUpdate com o estado original
            // Simplificando para o log:
            const oldData = (await getDoc(userRef)).data(); // Pega os dados antes da atualização para comparação
            const changedFields = {};
            for (const key in dataToUpdate) {
                if (JSON.stringify(oldData[key]) !== JSON.stringify(dataToUpdate[key])) { // Comparação simples
                    changedFields[key] = { oldValue: oldData[key], newValue: dataToUpdate[key] };
                }
            }


            await updateDoc(userRef, dataToUpdate);

            // CHAMADA PARA AUDIT LOGGER
            auditLogger(
                'USUARIO_EDITADO',
                { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
                { type: 'usuario', id: id, name: formData.nome },
                { changes: changedFields } // Loga apenas os campos que mudaram
            );

            toast.success('Usuário atualizado com sucesso!');
            navigate('/master/usuarios');
        } catch (err) {
            console.error("Erro ao atualizar usuário:", err);
            setFormError(`Erro ao atualizar: ${err.message}`);
            toast.error(`Erro ao atualizar: ${err.message}`);
        } finally {
            setLoadingForm(false);
        }
    };

    const handleSendPasswordReset = async () => {
        if (!formData || !formData.email) {
            toast.error("E-mail do usuário não disponível para redefinição de senha.");
            return;
        }
        setLoadingForm(true);
        try {
            await sendPasswordResetEmail(auth, formData.email);

            // CHAMADA PARA AUDIT LOGGER
            auditLogger(
                'USUARIO_SENHA_RESET_SOLICITADO',
                { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
                { type: 'usuario', id: id, name: formData.nome },
                { emailSentTo: formData.email }
            );

            toast.info(`E-mail de redefinição de senha enviado para ${formData.email}.`);
        } catch (err) {
            console.error("Erro ao enviar redefinição de senha:", err);
            setFormError(`Erro ao enviar e-mail: ${err.message}`);
            toast.error(`Erro ao enviar e-mail de redefinição: ${err.message}`);
        } finally {
            setLoadingForm(false);
        }
    };

    if (authLoading || loadingForm || loadingEstabelecimentos || formData === null) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
                <p className="text-xl text-gray-700">Carregando formulário do usuário...</p>
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
                <h1 className="text-2xl font-bold text-slate-800 mb-6">Editar Usuário: {formData.nome || id.substring(0,8)}...</h1>

                {formError && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
                        <p className="font-bold">Erro ao Salvar:</p>
                        <p>{formError}</p>
                    </div>
                )}

                <form onSubmit={handleUpdate} className="space-y-5">
                    <FormInput
                        label="Nome Completo"
                        name="nome"
                        value={formData.nome}
                        onChange={handleInputChange}
                        required
                        disabled={loadingForm}
                    />
                    <FormInput
                        label="E-mail"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        disabled={loadingForm || (currentUser.uid === id)}
                        helpText={currentUser.uid === id ? "Você não pode mudar seu próprio e-mail por aqui." : ""}
                    />
                    
                    <button
                        type="button"
                        onClick={handleSendPasswordReset}
                        disabled={loadingForm}
                        className="flex-col sm:flex-row sm:w-auto px-4 py-2 bg-yellow-500 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-yellow-600 disabled:bg-yellow-300 transition-colors duration-300"
                    >
                        {loadingForm ? 'Enviando...' : 'Enviar E-mail de Redefinição de Senha'}
                    </button>

                    <div className="pt-4 border-t border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-700 mb-3">Permissões</h2>
                        <div className="flex items-center space-x-6">
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="isAdmin"
                                    checked={formData.isAdmin}
                                    onChange={handleInputChange}
                                    className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    disabled={loadingForm}
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
                                    disabled={loadingForm || (currentUser.uid === id)}
                                />
                                <span className="ml-2 text-sm font-medium text-gray-700">Master Administrador</span>
                            </label>
                        </div>
                        {currentUser.uid === id && <p className="mt-2 text-xs text-red-500">Você não pode remover sua própria permissão de Master Administrador.</p>}
                    </div>

                    {formData.isAdmin && (
                        <div className="pt-4 border-t border-gray-200">
                            <label htmlFor="estabelecimentos" className="block text-sm font-medium text-slate-600">
                                Estabelecimentos Gerenciados:
                            </label>
                            <select
                                id="estabelecimentos"
                                name="estabelecimentosGerenciados"
                                multiple
                                value={formData.estabelecimentosGerenciados}
                                onChange={handleEstabelecimentoChange}
                                className="mt-1 block flex-col sm:flex-row rounded-lg border-slate-300 shadow-sm p-2.5 focus:border-indigo-500 focus:ring-indigo-500 h-48"
                                disabled={loadingForm}
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

                    <div className="pt-4 border-t border-gray-200">
                         <h2 className="text-lg font-semibold text-gray-700 mb-3">Status do Usuário</h2>
                        <label className="flex items-center cursor-pointer">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    name="ativo"
                                    className="sr-only"
                                    checked={formData.ativo}
                                    onChange={handleInputChange}
                                    disabled={loadingForm || (currentUser.uid === id)}
                                />
                                <div className={`block w-14 h-8 rounded-full ${formData.ativo ? 'bg-green-600' : 'bg-gray-300'}`}></div>
                                <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${formData.ativo ? 'transform translate-x-full' : ''}`}></div>
                            </div>
                            <span className="ml-3 text-base font-semibold text-gray-700">{formData.ativo ? 'Usuário Ativo' : 'Usuário Inativo'}</span>
                        </label>
                         {currentUser.uid === id && <p className="mt-2 text-xs text-red-500">Você não pode desativar sua própria conta.</p>}
                    </div>
                   
                    <button
                        type="submit"
                        disabled={loadingForm}
                        className="flex-col sm:flex-row px-6 py-3 bg-indigo-600 text-white text-base font-bold rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors duration-300"
                    >
                        {loadingForm ? 'Salvando Alterações...' : 'Salvar Alterações'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default EditarUsuarioMaster;