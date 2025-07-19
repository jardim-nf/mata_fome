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
  Timestamp // Certifique-se que Timestamp está importado para o criadoEm
} from 'firebase/firestore';
import { db, app } from '../../firebase'; // Importe 'app' para usar com getFunctions
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
// Remova getAuth e createUserWithEmailAndPassword, pois a criação será via Cloud Function
// import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'; // <-- REMOVA ESTA LINHA

// Importe para chamar a Cloud Function
import { getFunctions, httpsCallable } from 'firebase/functions'; // <-- ADICIONE ESTA LINHA

// Inicialize as funções do Firebase aqui
const functions = getFunctions(app);
const createUserByMasterAdminCallable = httpsCallable(functions, 'createUserByMasterAdmin');


function ListarUsuariosMaster() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Estados para o formulário de cadastro de novo usuário (mantidos, mas manipulados de forma diferente)
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
  const [newUserIsMasterAdmin, setNewUserIsMasterAdmin] = useState(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [newAddressStreet, setNewAddressStreet] = useState('');
  const [newAddressNumber, setNewAddressNumber] = useState('');
  const [newAddressNeighborhood, setNewAddressNeighborhood] = useState('');
  const [newAddressCity, setNewAddressCity] = useState('');
  const [newAddressComplement, setNewAddressComplement] = useState('');
  const [addingUser, setAddingUser] = useState(false);
  const [addUserError, setAddUserError] = useState('');

  // Remova a instância do Auth aqui, ela não será usada para criar usuário
  // const auth = getAuth(); // <-- REMOVA ESTA LINHA


  useEffect(() => {
    // Debug para verificar o estado de autenticação
    console.log("MasterDashboard useEffect: authLoading=", authLoading, "isMasterAdmin=", isMasterAdmin, "currentUser=", currentUser);

    if (!authLoading) {
      if (!currentUser || !isMasterAdmin) {
        toast.error('Acesso negado. Esta página é exclusiva do Administrador Master.');
        navigate('/master-dashboard'); 
        setLoading(false);
        return;
      }

      // Se é Master Admin, inicia o listener para todos os usuários
      const q = query(collection(db, 'usuarios'), orderBy('criadoEm', 'desc')); 
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const lista = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setUsuarios(lista);
        setLoading(false);
      }, (err) => {
        console.error("Erro ao carregar usuários:", err);
        setError("Erro ao carregar lista de usuários.");
        setLoading(false);
        toast.error("Erro ao carregar lista de usuários.");
      });

      return () => unsubscribe(); // Limpa o listener ao desmontar
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  const toggleAdminStatus = async (userId, currentIsAdmin, currentIsMasterAdmin) => {
    if (currentIsMasterAdmin && !window.confirm("Atenção: Você está prestes a alterar o status de Master Admin de um usuário. Deseja continuar?")) {
      return;
    }
    if (currentIsAdmin && !window.confirm(`Deseja remover as permissões de administrador de estabelecimento de ${usuarios.find(u => u.id === userId)?.nome || 'este usuário'}?`)) {
      return;
    }
    if (!currentIsAdmin && !window.confirm(`Deseja conceder permissões de administrador de estabelecimento a ${usuarios.find(u => u.id === userId)?.nome || 'este usuário'}?`)) {
      return;
    }

    try {
      const userRef = doc(db, 'usuarios', userId);
      let updateData = {};

      if (currentIsMasterAdmin) {
        toast.warn("Alterações de Master Admin devem ser feitas com cautela e, talvez, em um painel específico de segurança.");
        return;
      } else {
        updateData = { isAdmin: !currentIsAdmin };
        await updateDoc(userRef, updateData);
        toast.success(`Permissão de administrador de estabelecimento ${!currentIsAdmin ? 'concedida' : 'removida'} para ${usuarios.find(u => u.id === userId)?.nome || 'o usuário'}!`);
      }
    } catch (err) {
      console.error("Erro ao atualizar status de admin:", err);
      toast.error("Erro ao atualizar status de administrador. Tente novamente.");
    }
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

    try {
      // 1. CHAMA A CLOUD FUNCTION PARA CRIAR O USUÁRIO NO BACKEND
      const result = await createUserByMasterAdminCallable({
        email: newUserEmail.trim(),
        password: newUserPassword.trim(),
        name: newUserName.trim(),
        phoneNumber: newPhoneNumber.trim(),
        addressStreet: newAddressStreet.trim(),
        addressNumber: newAddressNumber.trim(),
        addressNeighborhood: newAddressNeighborhood.trim(),
        addressCity: newAddressCity.trim(),
        addressComplement: newAddressComplement.trim(),
        isAdmin: newUserIsAdmin,
        isMasterAdmin: newUserIsMasterAdmin
      });

      // Se a Cloud Function retornou sucesso
      if (result.data.success) {
        toast.success(`Usuário ${newUserName} cadastrado com sucesso! A lista será atualizada.`);
        setShowAddUserModal(false); // Fecha o modal
        // Limpar formulário
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserIsAdmin(false);
        setNewUserIsMasterAdmin(false);
        setNewPhoneNumber('');
        setNewAddressStreet('');
        setNewAddressNumber('');
        setNewAddressNeighborhood('');
        setNewAddressCity('');
        setNewAddressComplement('');
      } else {
        // Tratar erros específicos retornados pela Cloud Function
        setAddUserError(result.data.message || "Erro desconhecido ao cadastrar usuário.");
        toast.error(result.data.message || "Erro desconhecido.");
      }

    } catch (err) {
      console.error("Erro ao cadastrar usuário via Cloud Function:", err);
      let msg = "Erro ao cadastrar usuário.";
      // Erros do HttpsError da Cloud Function
      if (err.code === 'functions/email-already-in-use') {
        msg = "Este email já está cadastrado.";
      } else if (err.code === 'functions/weak-password') {
        msg = "Senha muito fraca (mín. 6 caracteres).";
      } else if (err.code === 'functions/permission-denied') {
        msg = "Você não tem permissão para realizar esta ação (apenas Master Admin).";
      } else {
        msg = `Erro na Cloud Function: ${err.message}`;
      }
      setAddUserError(msg);
      toast.error(msg);
    } finally {
      setAddingUser(false);
    }
  };


  if (loading) {
    return <div className="text-center p-4">Carregando usuários...</div>;
  }

  if (error) {
    return <div className="text-center p-4 text-red-600">Erro: {error}</div>;
  }

  return (
    <div className="p-6">
      <Link to="/master-dashboard" className="text-blue-600 hover:underline mb-4 inline-block">
        ← Voltar ao Dashboard Master
      </Link>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Todos os Usuários Cadastrados ({usuarios.length})</h1>
      
      {/* Botão para abrir o modal de adicionar usuário */}
      <button onClick={() => setShowAddUserModal(true)}
              className="mb-6 px-4 py-2 bg-green-600 text-white rounded-md shadow-sm hover:bg-green-700 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5 mr-2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Adicionar Novo Usuário
      </button>

      {/* Modal para Adicionar Novo Usuário */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full relative">
            <button onClick={() => { setShowAddUserModal(false); setAddUserError(''); setAddingUser(false); }}
                    className="absolute top-2 right-3 text-gray-600 hover:text-red-600 text-2xl">
              &times;
            </button>
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Cadastrar Novo Usuário</h2>
            {addUserError && <p className="text-red-500 text-sm text-center mb-4">{addUserError}</p>}
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label htmlFor="addUserName" className="block text-sm font-medium text-gray-700">Nome *</label>
                <input type="text" id="addUserName" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} required
                       className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
              </div>
              <div>
                <label htmlFor="addUserEmail" className="block text-sm font-medium text-gray-700">Email *</label>
                <input type="email" id="addUserEmail" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} required
                       className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
              </div>
              <div>
                <label htmlFor="addUserPassword" className="block text-sm font-medium text-gray-700">Senha * (mín. 6 caracteres)</label>
                <input type="password" id="addUserPassword" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} required
                       className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
              </div>
              
              {/* Permissões */}
              <h3 className="text-lg font-semibold text-gray-700 mt-6">Permissões:</h3>
              <div className="flex items-center space-x-4">
                <input type="checkbox" id="newUserIsAdmin" checked={newUserIsAdmin} onChange={(e) => setNewUserIsAdmin(e.target.checked)}
                       className="h-4 w-4 text-indigo-600 border-gray-300 rounded" />
                <label htmlFor="newUserIsAdmin" className="text-sm font-medium text-gray-700">Administrador de Estabelecimento</label>
              </div>
              <div className="flex items-center space-x-4">
                <input type="checkbox" id="newUserIsMasterAdmin" checked={newUserIsMasterAdmin} onChange={(e) => setNewUserIsMasterAdmin(e.target.checked)}
                       className="h-4 w-4 text-purple-600 border-gray-300 rounded" />
                <label htmlFor="newUserIsMasterAdmin" className="text-sm font-medium text-gray-700">Master Admin (Acesso Total)</label>
              </div>
              <p className="text-xs text-gray-500 mt-2">Master Admin anula Administrador de Estabelecimento. Use com cautela.</p>

              {/* Dados Opcionais */}
              <h3 className="text-lg font-semibold text-gray-700 mt-6">Dados Opcionais:</h3>
              <div>
                <label htmlFor="newPhoneNumber" className="block text-sm font-medium text-gray-700">Telefone</label>
                <input type="tel" id="newPhoneNumber" value={newPhoneNumber} onChange={(e) => setNewPhoneNumber(e.target.value)}
                       className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
              </div>
              <div>
                <label htmlFor="newAddressStreet" className="block text-sm font-medium text-gray-700">Rua</label>
                <input type="text" id="newAddressStreet" value={newAddressStreet} onChange={(e) => setNewAddressStreet(e.target.value)}
                       className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="newAddressNumber" className="block text-sm font-medium text-gray-700">Número</label>
                  <input type="text" id="newAddressNumber" value={newAddressNumber} onChange={(e) => setNewAddressNumber(e.target.value)}
                         className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
                </div>
                <div>
                  <label htmlFor="newAddressNeighborhood" className="block text-sm font-medium text-gray-700">Bairro</label>
                  <input type="text" id="newAddressNeighborhood" value={newAddressNeighborhood} onChange={(e) => setNewAddressNeighborhood(e.target.value)}
                         className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
                </div>
              </div>
              <div>
                <label htmlFor="newAddressCity" className="block text-sm font-medium text-gray-700">Cidade</label>
                <input type="text" id="newAddressCity" value={newAddressCity} onChange={(e) => setNewAddressCity(e.target.value)}
                       className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
              </div>
              <div>
                <label htmlFor="newAddressComplement" className="block text-sm font-medium text-gray-700">Complemento</label>
                <input type="text" id="newAddressComplement" value={newAddressComplement} onChange={(e) => setNewAddressComplement(e.target.value)}
                       className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
              </div>

              <button type="submit" disabled={addingUser}
                      className="w-full py-3 px-4 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 font-semibold text-lg">
                {addingUser ? 'Cadastrando...' : 'Cadastrar Usuário'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tabela de Usuários Existentes */}
      {usuarios.length === 0 ? (
        <p className="text-gray-500 italic">Nenhum usuário cadastrado ainda.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow-md">
          <table className="min-w-full leading-normal">
            <thead>
              <tr>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Telefone
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Permissões
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Ações
                </th>
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
                    <p className="text-gray-900 whitespace-no-wrap">{usuario.telefone || 'N/A'}</p>
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
                    {/* Botão para alternar isAdmin (se não for o próprio Master Admin logado) */}
                    {currentUser.uid !== usuario.id && ( // Evita que o Master Admin logado mude a si mesmo para não-admin
                        <button onClick={() => toggleAdminStatus(usuario.id, usuario.isAdmin, usuario.isMasterAdmin)}
                                className={`font-medium ${usuario.isAdmin ? 'text-orange-600 hover:text-orange-900' : 'text-blue-600 hover:text-blue-900'}`}>
                            {usuario.isAdmin ? 'Remover Admin' : 'Tornar Admin'}
                        </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ListarUsuariosMaster;