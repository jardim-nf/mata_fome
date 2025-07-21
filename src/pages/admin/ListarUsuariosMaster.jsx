// src/pages/admin/ListarUsuariosMaster.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    collection,
    query,
    onSnapshot,
    orderBy,
    doc,
    updateDoc,
    getDocs
} from 'firebase/firestore';
import { db, functions } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';

const createUserByMasterAdminCallable = httpsCallable(functions, 'createUserByMasterAdmin');

function ListarUsuariosMaster() {
    const navigate = useNavigate();
    const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();
    const auth = getAuth();

    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [estabelecimentos, setEstabelecimentos] = useState([]);
    const [selectedEstabelecimentoId, setSelectedEstabelecimentoId] = useState('');
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [newUserName, setNewUserName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
    const [newUserIsMasterAdmin, setNewUserIsMasterAdmin] = useState(false);
    const [addingUser, setAddingUser] = useState(false);
    const [addUserError, setAddUserError] = useState('');

    useEffect(() => {
        if (authLoading) {
            return;
        }
        if (!isMasterAdmin) {
            toast.error('Acesso negado.');
            navigate('/master-dashboard');
            return;
        }

        const fetchEstabelecimentos = async () => {
            try {
                const estabRef = collection(db, 'estabelecimentos');
                const estabSnapshot = await getDocs(estabRef);
                const listaEstab = estabSnapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }));
                setEstabelecimentos(listaEstab);
            } catch (err) {
                toast.error("Não foi possível carregar os estabelecimentos.");
            }
        };
        fetchEstabelecimentos();

        const q = query(collection(db, 'usuarios'), orderBy('criadoEm', 'desc'));
        const unsubscribeUsers = onSnapshot(q, (snapshot) => {
            const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsuarios(lista);
            setLoading(false);
        }, (err) => {
            setError("Erro ao carregar lista de usuários.");
            setLoading(false);
        });

        return () => {
            unsubscribeUsers();
        };
    }, [authLoading, isMasterAdmin, navigate]);

    const resetForm = () => {
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserIsAdmin(false);
        setNewUserIsMasterAdmin(false);
        setSelectedEstabelecimentoId('');
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        setAddingUser(true);
        setAddUserError('');
        if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim() || newUserPassword.length < 6) {
            setAddUserError('Nome, Email e Senha (mín. 6 caracteres) são obrigatórios.');
            setAddingUser(false);
            return;
        }
        if (newUserIsAdmin && !newUserIsMasterAdmin && !selectedEstabelecimentoId) {
            setAddUserError('Por favor, selecione um estabelecimento para vincular a este administrador.');
            setAddingUser(false);
            return;
        }
        if (!auth.currentUser) {
            toast.error("Sua sessão expirou. Por favor, faça login novamente.");
            setAddingUser(false);
            return;
        }
        try {
            await auth.currentUser.getIdToken(true);
            const result = await createUserByMasterAdminCallable({
                email: newUserEmail.trim(),
                password: newUserPassword.trim(),
                name: newUserName.trim(),
                isAdmin: newUserIsAdmin,
                isMasterAdmin: newUserIsMasterAdmin,
                estabelecimentoId: newUserIsAdmin && !newUserIsMasterAdmin ? selectedEstabelecimentoId : null,
            });
            if (result.data && result.data.success) {
                toast.success(`Usuário ${newUserName} cadastrado com sucesso!`);
                setShowAddUserModal(false);
                resetForm();
            } else {
                setAddUserError(result.data?.message || "Erro desconhecido.");
                toast.error(result.data?.message || "Erro desconhecido.");
            }
        } catch (err) {
            const msg = err.message || "Erro ao cadastrar usuário.";
            setAddUserError(msg);
            toast.error(msg);
        } finally {
            setAddingUser(false);
        }
    };

    const toggleAdminStatus = async (userId, currentIsAdmin, currentIsMasterAdmin) => {
        // Implementar lógica se necessário
    };

    if (authLoading || loading) {
        return <div className="text-center p-4">Carregando dados...</div>;
    }
    if (error) {
        return <div className="text-center p-4 text-red-600">Erro: {error}</div>;
    }

    return (
        <div className="p-6">
            <Link to="/master-dashboard" className="text-blue-600 hover:underline mb-4 inline-block">
                ← Voltar ao Dashboard Master
            </Link>
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Todos os Usuários ({usuarios.length})</h1>
            
            <button onClick={() => setShowAddUserModal(true)} className="mb-6 px-4 py-2 bg-green-600 text-white rounded-md shadow-sm hover:bg-green-700 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5 mr-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Adicionar Novo Usuário
            </button>
            
            {/* ▼▼▼ CONTEÚDO DO MODAL RESTAURADO ▼▼▼ */}
            {showAddUserModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full relative">
                        <button onClick={() => { setShowAddUserModal(false); setAddUserError(''); setAddingUser(false); resetForm(); }}
                            className="absolute top-2 right-3 text-gray-600 hover:text-red-600 text-2xl">
                            &times;
                        </button>
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Cadastrar Novo Usuário</h2>
                        {addUserError && <p className="text-red-500 text-sm text-center mb-4">{addUserError}</p>}
                        
                        <form onSubmit={handleAddUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Nome *</label>
                                <input type="text" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email *</label>
                                <input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Senha * (mín. 6 caracteres)</label>
                                <input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-700 pt-4 border-t">Permissões:</h3>
                            <div className="flex items-center space-x-4">
                                <input type="checkbox" id="newUserIsAdmin" checked={newUserIsAdmin} onChange={(e) => setNewUserIsAdmin(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                                <label htmlFor="newUserIsAdmin">Administrador de Estabelecimento</label>
                            </div>
                            
                            {newUserIsAdmin && !newUserIsMasterAdmin && (
                                <div className="pl-6 pt-2">
                                    <label htmlFor="estabelecimentoSelect" className="block text-sm font-medium text-gray-700">Vincular ao Estabelecimento *</label>
                                    <select
                                        id="estabelecimentoSelect"
                                        value={selectedEstabelecimentoId}
                                        onChange={(e) => setSelectedEstabelecimentoId(e.target.value)}
                                        required
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" >
                                        <option value="">Selecione um estabelecimento</option>
                                        {estabelecimentos.map(estab => (
                                            <option key={estab.id} value={estab.id}>{estab.nome}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="flex items-center space-x-4">
                                <input type="checkbox" id="newUserIsMasterAdmin" checked={newUserIsMasterAdmin} onChange={(e) => setNewUserIsMasterAdmin(e.target.checked)} className="h-4 w-4 text-purple-600 border-gray-300 rounded" />
                                <label htmlFor="newUserIsMasterAdmin">Master Admin (Acesso Total)</label>
                            </div>
                            
                            <button type="submit" disabled={addingUser} className="w-full py-3 px-4 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 font-semibold text-lg">
                                {addingUser ? 'Cadastrando...' : 'Cadastrar Usuário'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
            
            <div className="overflow-x-auto bg-white rounded-lg shadow-md">
                <table className="min-w-full leading-normal">
                    <thead>
                        <tr>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nome</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Permissões</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {usuarios.map(usuario => (
                            <tr key={usuario.id}>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                    <p className="text-gray-900 whitespace-no-wrap">{usuario.nome || 'N/A'}</p>
                                </td>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                    <p className="text-gray-900 whitespace-no-wrap">{usuario.email || 'N/A'}</p>
                                </td>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                    <span className={`relative inline-block px-3 py-1 font-semibold leading-tight ${usuario.isMasterAdmin ? 'text-purple-900 bg-purple-200' : usuario.isAdmin ? 'text-blue-900 bg-blue-200' : 'text-gray-900 bg-gray-200'} rounded-full`}>
                                        {usuario.isMasterAdmin ? 'Master Admin' : usuario.isAdmin ? 'Admin Estab.' : 'Cliente'}
                                    </span>
                                </td>
                                <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm flex gap-2">
                                    <Link to={`/admin/clientes/${usuario.id}`} className="text-indigo-600 hover:text-indigo-900 font-medium">
                                        Ver Detalhes
                                    </Link>
                                    {/* Adicione o botão de toggle admin se necessário */}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default ListarUsuariosMaster;