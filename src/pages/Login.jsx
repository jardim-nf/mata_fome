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
      // 1. Login no Firebase Auth
      const userCredential = await login(email, password);
      const user = userCredential.user;

      // 2. Busca dados brutos no Firestore para decidir o redirecionamento
      // Fazemos isso aqui manualmente para ser mais rápido e garantir o dado atual
      const userDocRef = doc(db, 'usuarios', user.uid);
      const userSnap = await getDoc(userDocRef);
      
      const userData = userSnap.exists() ? userSnap.data() : {};

      console.log('--- DEBUG LOGIN ---');
      console.log('Dados Firestore:', userData);

      // 3. Lógica de Redirecionamento Inteligente
      
      // A) É Master Admin?
      if (userData.isMasterAdmin === true) {
        console.log('🚀 Redirecionando: Master Admin');
        toast.success('Bem-vindo, Master Admin!');
        navigate('/master/estabelecimentos'); // Ajuste para sua rota principal de Master
        return;
      }

      // B) É Admin de Estabelecimento?
      if (userData.isAdmin === true) {
        // TRATAMENTO DE ERRO: Verifica se é Array ou Objeto para pegar o ID
        let listaIds = [];
        const rawEstabs = userData.estabelecimentosGerenciados;

        if (Array.isArray(rawEstabs)) {
            listaIds = rawEstabs;
        } else if (rawEstabs && typeof rawEstabs === 'object') {
            listaIds = Object.keys(rawEstabs);
        }

        console.log('Estabs encontrados:', listaIds);

        if (listaIds.length > 0) {
            console.log('🚀 Redirecionando: Admin de Estabelecimento');
            toast.success('Login realizado com sucesso!');
            // Redireciona para o dashboard geral ou para o primeiro estabelecimento
            navigate('/admin/dashboard'); 
        } else {
            // É admin mas não tem estabelecimento vinculado
            toast.warning('Sua conta é Admin, mas não possui estabelecimentos vinculados.');
            navigate('/admin/dashboard');
        }
        return;
      }

      // C) É Usuário Comum (Cliente)
      console.log('🚀 Redirecionando: Cliente');
      toast.success('Login realizado! Bom apetite.');
      navigate('/'); // Vai para a Home/Cardápio

    } catch (error) {
      console.error('Erro no login:', error);

      let errorMessage = 'Falha no login. Verifique suas credenciais.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'Email ou senha incorretos.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'Conta desativada.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Muitas tentativas. Tente novamente mais tarde.';
      }

      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white shadow-2xl rounded-2xl p-8 w-full max-w-md border border-gray-200">
        
        {/* Cabeçalho */}
        <div className="text-center mb-8">
            <div className="w-16 h-16 bg-yellow-500 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg transform -rotate-3">
                <span className="text-2xl font-bold text-white">DF</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Bem-vindo</h1>
            <p className="text-gray-500 mt-2">Faça login para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemplo@email.com"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 text-gray-900 focus:bg-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all outline-none"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
              Senha
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 text-gray-900 focus:bg-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold py-3.5 rounded-xl hover:from-yellow-600 hover:to-orange-600 focus:ring-4 focus:ring-yellow-200 transition-all transform active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
                <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Entrando...
                </>
            ) : (
                'Entrar no Sistema'
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
                Esqueceu sua senha? <button className="text-yellow-600 font-bold hover:underline">Recuperar</button>
            </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;