// src/components/AddUserModal.jsx
import React, { useState } from 'react';
import { doc, setDoc, Timestamp } from 'firebase/firestore'; 
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db } from '../firebase'; 
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
    addressReference: '', // Campo já estava aqui
  });
  const [addingUser, setAddingUser] = useState(false);
  const [addUserError, setAddUserError] = useState('');

  const auth = getAuth(); 

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

    // 1. Adicionado addressReference na desestruturação
    const { name, email, password, isAdmin, isMasterAdmin, phoneNumber, addressStreet, addressNumber, addressNeighborhood, addressCity, addressComplement, addressReference } = formData;

    if (!name.trim() || !email.trim() || !password.trim() || password.length < 6) {
      setAddUserError('Nome, Email e Senha (mín. 6 caracteres) são obrigatórios.');
      setAddingUser(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Adicionado a referência no Firestore
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
          referencia: addressReference.trim() || null, // <- SALVANDO NO BANCO
        },
        isAdmin: isAdmin,
        isMasterAdmin: isMasterAdmin,
        criadoEm: Timestamp.now(),
      });

      toast.success(`Usuário ${name} cadastrado com sucesso! A lista será atualizada.`);
      
      // 3. Adicionado addressReference para limpar o state
      setFormData({
        name: '', email: '', password: '', isAdmin: false, isMasterAdmin: false,
        phoneNumber: '', addressStreet: '', addressNumber: '', addressNeighborhood: '', addressCity: '', addressComplement: '', addressReference: '',
      });
      
      onClose(); 
      onUserAdded(); 

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
          {/* 4. Campo de Ponto de Referência adicionado no layout */}
          <div>
            <label htmlFor="addressReference" className="block text-sm font-medium text-gray-700">Ponto de Referência</label>
            <input type="text" id="addressReference" name="addressReference" value={formData.addressReference} onChange={handleChange}
                   placeholder="Ex: Próximo à padaria..."
                   className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
          </div>

          <button type="submit" disabled={addingUser}
                  className="w-full py-3 px-4 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 font-semibold text-lg mt-4">
            {addingUser ? 'Cadastrando...' : 'Cadastrar Usuário'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddUserModal;