// src/components/AddUserModal.jsx
import React, { useState } from 'react';
import { doc, setDoc, Timestamp } from 'firebase/firestore'; // Importante: Timestamp agora está aqui!
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db } from '../firebase'; // Verifique o caminho correto para o seu firebase.js
import { toast } from 'react-toastify';

function AddUserModal({ showModal, onClose, onUserAdded }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    isAdmin: false,
    isMasterAdmin: false,
    phoneNumber: '',
    addressStreet: '',
    addressNumber: '',
    addressNeighborhood: '',
    addressCity: '',
    addressComplement: '',
  });
  const [addingUser, setAddingUser] = useState(false);
  const [addUserError, setAddUserError] = useState('');

  const auth = getAuth(); // Instância do Auth para criar usuários

  // Função genérica para atualizar o estado do formulário
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddingUser(true);
    setAddUserError('');

    const { name, email, password, isAdmin, isMasterAdmin, phoneNumber, addressStreet, addressNumber, addressNeighborhood, addressCity, addressComplement } = formData;

    if (!name.trim() || !email.trim() || !password.trim() || password.length < 6) {
      setAddUserError('Nome, Email e Senha (mín. 6 caracteres) são obrigatórios.');
      setAddingUser(false);
      return;
    }

    try {
      // 1. Criar usuário no Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Salvar perfil do usuário no Firestore na coleção 'usuarios'
      await setDoc(doc(db, 'usuarios', user.uid), {
        nome: name.trim(),
        email: email.trim(),
        telefone: phoneNumber.trim() || null,
        endereco: {
          rua: addressStreet.trim() || null,
          numero: addressNumber.trim() || null,
          bairro: addressNeighborhood.trim() || null,
          cidade: addressCity.trim() || null,
          complemento: addressComplement.trim() || null,
        },
        isAdmin: isAdmin,
        isMasterAdmin: isMasterAdmin,
        criadoEm: Timestamp.now(), // Adiciona timestamp de criação
      });

      toast.success(`Usuário ${name} cadastrado com sucesso! A lista será atualizada.`);
      
      // Limpar formulário para que ele esteja pronto para um novo cadastro se o modal for reaberto
      setFormData({
        name: '', email: '', password: '', isAdmin: false, isMasterAdmin: false,
        phoneNumber: '', addressStreet: '', addressNumber: '', addressNeighborhood: '', addressCity: '', addressComplement: '',
      });
      
      onClose(); // Fecha o modal
      onUserAdded(); // Notifica o componente pai que um usuário foi adicionado

    } catch (err) {
      let msg = "Erro ao cadastrar usuário.";
      if (err.code === 'auth/email-already-in-use') {
        msg = "Este email já está cadastrado.";
      } else if (err.code === 'auth/weak-password') {
        msg = "Senha muito fraca (mín. 6 caracteres).";
      }
      setAddUserError(msg);
      toast.error(msg);
      console.error("Erro ao cadastrar usuário:", err);
    } finally {
      setAddingUser(false);
    }
  };

  // Não renderiza nada se o modal não deve ser exibido
  if (!showModal) return null; 

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full relative">
        <button onClick={() => { onClose(); setAddUserError(''); setAddingUser(false); }}
                className="absolute top-2 right-3 text-gray-600 hover:text-red-600 text-2xl">
          &times;
        </button>
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Cadastrar Novo Usuário</h2>
        {addUserError && <p className="text-red-500 text-sm text-center mb-4">{addUserError}</p>}
        <form onSubmit={handleAddUser} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nome *</label>
            <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required
                   className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email *</label>
            <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required
                   className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Senha * (mín. 6 caracteres)</label>
            <input type="password" id="password" name="password" value={formData.password} onChange={handleChange} required
                   className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
          </div>

          {/* Permissões */}
          <h3 className="text-lg font-semibold text-gray-700 mt-6">Permissões:</h3>
          <div className="flex items-center space-x-4">
            <input type="checkbox" id="isAdmin" name="isAdmin" checked={formData.isAdmin} onChange={handleChange}
                   className="h-4 w-4 text-indigo-600 border-gray-300 rounded" />
            <label htmlFor="isAdmin" className="text-sm font-medium text-gray-700">Administrador de Estabelecimento</label>
          </div>
          <div className="flex items-center space-x-4">
            <input type="checkbox" id="isMasterAdmin" name="isMasterAdmin" checked={formData.isMasterAdmin} onChange={handleChange}
                   className="h-4 w-4 text-purple-600 border-gray-300 rounded" />
            <label htmlFor="isMasterAdmin" className="text-sm font-medium text-gray-700">Master Admin (Acesso Total)</label>
          </div>
          <p className="text-xs text-gray-500 mt-2">Master Admin anula Administrador de Estabelecimento. Use com cautela.</p>

          {/* Dados Opcionais */}
          <h3 className="text-lg font-semibold text-gray-700 mt-6">Dados Opcionais:</h3>
          <div>
            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">Telefone</label>
            <input type="tel" id="phoneNumber" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange}
                   className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
          </div>
          <div>
            <label htmlFor="addressStreet" className="block text-sm font-medium text-gray-700">Rua</label>
            <input type="text" id="addressStreet" name="addressStreet" value={formData.addressStreet} onChange={handleChange}
                   className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
          </div>
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="addressNumber" className="block text-sm font-medium text-gray-700">Número</label>
              <input type="text" id="addressNumber" name="addressNumber" value={formData.addressNumber} onChange={handleChange}
                     className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
            </div>
            <div>
              <label htmlFor="addressNeighborhood" className="block text-sm font-medium text-gray-700">Bairro</label>
              <input type="text" id="addressNeighborhood" name="addressNeighborhood" value={formData.addressNeighborhood} onChange={handleChange}
                     className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
            </div>
          </div>
          <div>
            <label htmlFor="addressCity" className="block text-sm font-medium text-gray-700">Cidade</label>
            <input type="text" id="addressCity" name="addressCity" value={formData.addressCity} onChange={handleChange}
                   className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
          </div>
          <div>
            <label htmlFor="addressComplement" className="block text-sm font-medium text-gray-700">Complemento</label>
            <input type="text" id="addressComplement" name="addressComplement" value={formData.addressComplement} onChange={handleChange}
                   className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
          </div>

          <button type="submit" disabled={addingUser}
                  className="w-full py-3 px-4 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 font-semibold text-lg">
            {addingUser ? 'Cadastrando...' : 'Cadastrar Usuário'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddUserModal;