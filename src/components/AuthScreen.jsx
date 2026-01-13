// src/components/AuthScreen.jsx (Novo Componente)
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// Importe suas funções de autenticação do Firebase (login, cadastro, logout)
import { doSignInWithEmailAndPassword, doCreateUserWithEmailAndPassword, doSignOut } from '../firebase';
import { useAuth } from '../context/AuthContext';
// Importe Firestore se você armazena dados de usuário lá
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase'; // Certifique-se de que 'db' é exportado do seu firebase.js

const AuthScreen = ({ onClose, onAuthSuccess, initialMode = 'login', redirectTo = '/' }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // Apenas para cadastro de cliente
  const [phone, setPhone] = useState(''); // Apenas para cadastro de cliente
  const [address, setAddress] = useState(''); // Apenas para cadastro de cliente
  const [isRegister, setIsRegister] = useState(initialMode === 'register');
  const [isAdminAuth, setIsAdminAuth] = useState(false); // Alterna entre auth de admin/cliente
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setCurrentUser } = useAuth(); // Para atualizar o contexto de autenticação

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let userCredential;
      if (isRegister) {
        if (!isAdminAuth) { // Cadastro de Cliente
          userCredential = await doCreateUserWithEmailAndPassword(email, password);
          // Salva dados adicionais do cliente no Firestore
          await setDoc(doc(db, "users", userCredential.user.uid), {
            email: email,
            name: name,
            phone: phone,
            address: address,
            role: 'client', // Atribuir role de cliente
          });
        } else { // Administradores não podem se auto-registrar por aqui
          setError('Administradores não podem se registrar por esta interface. Contate o administrador master.');
          setLoading(false);
          return;
        }
      } else { // Login para Cliente ou Admin
        userCredential = await doSignInWithEmailAndPassword(email, password);
        const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));

        if (userDoc.exists()) {
          const userData = userDoc.data();
          setCurrentUser({ ...userCredential.user, role: userData.role }); // Atualiza contexto com a role

          if (isAdminAuth && (userData.role !== 'admin' && userData.role !== 'masterAdmin')) {
            setError('Credenciais de administrador inválidas.');
            await doSignOut(); // Desloga se não for admin
            setLoading(false);
            return;
          }
          if (!isAdminAuth && userData.role !== 'client') {
            setError('Credenciais de cliente inválidas. Por favor, use a área de administrador ou registre-se como cliente.');
            await doSignOut();
            setLoading(false);
            return;
          }
        } else {
          setError('Dados do usuário não encontrados. Por favor, tente novamente ou cadastre-se.');
          await doSignOut();
          setLoading(false);
          return;
        }
      }
      onAuthSuccess?.(); // Chama callback de sucesso
      navigate(redirectTo); // Redireciona após login bem-sucedido
      onClose?.(); // Fecha o modal se estiver sendo usado como tal
    } catch (err) {
      setError(err.message || 'Erro na autenticação. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen-container p-6 bg-white rounded-lg shadow-lg max-w-md mx-auto my-10">
      <h3 className="text-2xl font-bold mb-4 text-center">{isRegister ? 'Cadastre-se' : 'Entrar'}</h3>

      <div className="flex justify-center mb-6">
        <button
          className={`px-6 py-2 rounded-l-lg font-semibold transition-colors duration-200 ${!isAdminAuth ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          onClick={() => setIsAdminAuth(false)}
        >
          Cliente
        </button>
        <button
          className={`px-6 py-2 rounded-r-lg font-semibold transition-colors duration-200 ${isAdminAuth ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          onClick={() => setIsAdminAuth(true)}
        >
          Administrador
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-500 text-center mb-4">{error}</p>}

        {!isAdminAuth && isRegister && (
          <>
            <input
              type="text"
              placeholder="Nome Completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="flex-col sm:flex-row p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <input
              type="tel"
              placeholder="Telefone (DDNXXXXXXXXX)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="flex-col sm:flex-row p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <input
              type="text"
              placeholder="Endereço Completo (Rua, Número, Bairro, Cidade, Estado)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              className="flex-col sm:flex-row p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="flex-col sm:flex-row p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="flex-col sm:flex-row p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-400"
        />

        <button
          type="submit"
          disabled={loading}
          className="flex-col sm:flex-row bg-orange-500 text-white py-3 rounded-md font-bold hover:bg-orange-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Carregando...' : (isRegister ? 'Cadastrar' : 'Entrar')}
        </button>
      </form>

      <p className="text-center mt-4 text-gray-600">
        {isRegister ? (
          <>Já tem uma conta? <span className="text-orange-500 cursor-pointer hover:underline" onClick={() => setIsRegister(false)}>Faça login</span></>
        ) : (
          <>Não tem uma conta? <span className="text-orange-500 cursor-pointer hover:underline" onClick={() => setIsRegister(true)}>Cadastre-se</span></>
        )}
      </p>

      {onClose && (
        <button
          onClick={onClose}
          className="mt-4 flex-col sm:flex-row bg-gray-300 text-gray-800 py-2 rounded-md font-bold hover:bg-gray-400 transition-colors duration-200"
        >
          Fechar
        </button>
      )}
    </div>
  );
};

export default AuthScreen;