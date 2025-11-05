// src/pages/Login.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 🔐 Login via Firebase Auth
      const userCredential = await login(email, password);
      const user = userCredential.user;

      // 🔍 Busca os dados do Firestore (coleção 'usuarios')
      const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};

      const isMaster = userData.isMasterAdmin === true;
      const isAdminEst = userData.isAdmin === true;
      const estabelecimentoId = userData.estabelecimentoId;

      // --- DEBUG NO CONSOLE ---
      console.log('--- DEBUG LOGIN ---');
      console.log('Email logado:', user.email);
      console.log('userData Firestore:', userData);
      console.log('isMaster:', isMaster);
      console.log('isAdminEst:', isAdminEst);
      console.log('estabelecimentoId:', estabelecimentoId);
      console.log('--------------------');

      toast.success('Login realizado com sucesso!');

      // 🚀 Redirecionamentos conforme o tipo de usuário
      if (isMaster) {
        console.log('Redirecionando para MASTER DASHBOARD');
        navigate('/master-dashboard');
      } else if (isAdminEst) {
        console.log('Redirecionando para DASHBOARD DO ESTABELECIMENTO');
        navigate('/dashboard');
      } else {
        console.log('Redirecionando para HOME (usuário comum)');
        navigate('/home');
      }

    } catch (error) {
      console.error('Erro no login:', error);

      let errorMessage = 'Falha no login. Verifique suas credenciais.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Email ou senha inválidos.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'Sua conta está desativada. Contate o suporte.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Problema de conexão. Verifique sua internet.';
      } else if (error.code === 'auth/quota-exceeded') {
        errorMessage = 'Cota de autenticação excedida. Tente novamente mais tarde.';
      }

      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md"
      >
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">
          Acesso ao Sistema
        </h1>

        <div className="mb-4">
          <label htmlFor="email" className="block text-gray-700 font-medium mb-1">
            Email:
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu.email@exemplo.com"
            required
            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-yellow-500 outline-none"
          />
        </div>

        <div className="mb-6">
          <label htmlFor="password" className="block text-gray-700 font-medium mb-1">
            Senha:
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Sua senha"
            required
            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-yellow-500 outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-yellow-500 text-black font-semibold py-2 rounded-lg hover:bg-yellow-600 transition-colors"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

export default LoginPage;
