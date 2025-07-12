// src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { db } from '../firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const auth = getAuth();

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setError('');

    try {
      let userCredential;
      if (isRegistering) {
        // Lógica de Cadastro (mantida)
        // ... (seu código de cadastro existente)
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, 'usuarios', user.uid), {
          email: user.email,
          nome: nome,
          isAdmin: false, 
          criadoEm: Timestamp.now() 
        });
        alert('Cadastro realizado com sucesso! Você pode fazer login agora.');
        setIsRegistering(false);
        setEmail('');
        setPassword('');
        setNome('');

      } else {
        // Lógica de Login
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Verificação de Admin no Firestore
        const userDocRef = doc(db, 'usuarios', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists() && userDocSnap.data()?.isAdmin) {
          // <<-- MUDANÇA AQUI: Redireciona para o Dashboard -->>
          navigate('/dashboard'); 
        } else {
          setError('Acesso negado. Você não tem permissões de administrador.');
          await auth.signOut();
        }
      }
    } catch (error) {
      // Tratamento de Erros (mantido)
      // ...
      switch (error.code) {
        case 'auth/user-not-found':
          setError('Usuário não encontrado. Verifique seu email.');
          break;
        case 'auth/wrong-password':
          setError('Senha incorreta. Tente novamente.');
          break;
        case 'auth/invalid-email':
          setError('Email inválido.');
          break;
        case 'auth/email-already-in-use':
          setError('Este email já está cadastrado.');
          break;
        case 'auth/weak-password':
          setError('Senha muito fraca. Deve ter pelo menos 6 caracteres.');
          break;
        case 'auth/too-many-requests':
          setError('Muitas tentativas. Tente novamente mais tarde.');
          break;
        default:
          setError('Erro na operação. Verifique suas informações.');
          console.error("Erro de autenticação:", error.message);
      }
    }
  };

  return (
    // ... (restante do seu componente Login.jsx)
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bege-claro)] p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-[var(--vermelho-principal)] mb-6">
          {isRegistering ? 'Cadastro de Usuário' : 'Login Admin 🔐'}
        </h2>
        <form onSubmit={handleAuthAction} className="space-y-5">
          {isRegistering && (
            <div>
              <label htmlFor="nome" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Nome</label>
              <input
                type="text"
                id="nome"
                placeholder="Seu Nome Completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
                required={isRegistering}
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Email</label>
            <input
              type="email"
              id="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[var(--marrom-escuro)] mb-1">Senha</label>
            <input
              type="password"
              id="password"
              placeholder="Sua senha (mínimo 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            type="submit"
            className="w-full bg-[var(--vermelho-principal)] hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold text-lg transition duration-300 shadow-md"
          >
            {isRegistering ? 'Cadastrar' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-700">
          {isRegistering ? (
            <>Já tem uma conta?{' '}
              <button
                onClick={() => { setIsRegistering(false); setError(''); setNome(''); setEmail(''); setPassword(''); }}
                className="text-[var(--vermelho-principal)] hover:underline font-semibold"
              >
                Faça Login
              </button>
            </>
          ) : (
            <>Não tem uma conta?{' '}
              <button
                onClick={() => { setIsRegistering(true); setError(''); setNome(''); setEmail(''); setPassword(''); }}
                className="text-[var(--vermelho-principal)] hover:underline font-semibold"
              >
                Cadastre-se
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export default Login;