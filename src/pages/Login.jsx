// src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { db } from '../firebase';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [isAuthProcessing, setIsAuthProcessing] = useState(false); // Novo estado para controlar o processamento do login/cadastro

  const navigate = useNavigate();
  const auth = getAuth();

  const { currentUser, isAdmin, isMasterAdmin, loading: authLoading } = useAuth();

  // Efeito para lidar com o redirecionamento após o login/autenticação
  useEffect(() => {
    // Só age se o AuthContext terminou de carregar (não está mais "loading")
    // e se o currentUser já foi definido pelo AuthContext (ou seja, logou ou já estava logado)
    if (!authLoading && currentUser) {
      if (isMasterAdmin) {
        toast.success('Login Master Admin realizado com sucesso! Bem-vindo ao seu painel global. 🚀');
        navigate('/master-dashboard');
      } else if (isAdmin) {
        toast.success('Login Administrador de Estabelecimento realizado com sucesso! Redirecionando para o painel de pedidos.');
        navigate('/painel-inicial');
      } else {
        toast.info('Login realizado com sucesso! Você foi redirecionado para a página inicial.');
        navigate('/');
      }
    }
  }, [currentUser, isAdmin, isMasterAdmin, authLoading, navigate]); // Dependências

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setError('');
    setIsAuthProcessing(true); // Inicia o estado de processamento

    try {
      if (isRegistering) {
        // Lógica de Cadastro
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, 'usuarios', user.uid), {
          email: user.email,
          nome: nome,
          isAdmin: false,
          isMasterAdmin: false,
          criadoEm: Timestamp.now()
        });

        toast.success('🎉 Cadastro realizado com sucesso! Por favor, faça login agora.');
        setIsRegistering(false); // Volta para a tela de login
        setEmail('');
        setPassword('');
        setNome('');

      } else {
        // Lógica de Login
        await signInWithEmailAndPassword(auth, email, password);
        // O redirecionamento e a toast de sucesso serão tratados pelo useEffect
        // após o AuthContext atualizar o estado.
      }
    } catch (error) {
      let errorMessage = 'Erro na operação. Verifique suas informações.';
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'Usuário não encontrado. Verifique seu email.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Senha incorreta. Tente novamente.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Email inválido.';
          break;
        case 'auth/email-already-in-use':
          errorMessage = 'Este email já está cadastrado.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Senha muito fraca. Deve ter pelo menos 6 caracteres.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Muitas tentativas de login. Tente novamente mais tarde.';
          break;
        default:
          console.error("Erro de autenticação:", error.message);
      }
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsAuthProcessing(false); // Finaliza o estado de processamento
    }
  };

  // Se o AuthContext ainda está carregando o estado inicial (primeira vez que a página carrega)
  // OU se o usuário já está logado e o useEffect já está prestes a redirecionar
  // Não renderiza o formulário de login/cadastro, exibe uma mensagem de carregamento ou nada.
  if (authLoading || (currentUser && !isAuthProcessing)) { // Adicionei !isAuthProcessing aqui para não esconder o form enquanto o submit ainda está rolando
    return (
        <div className="flex items-center justify-center min-h-screen bg-[var(--bege-claro)]">
            <div className="text-center text-xl text-[var(--marrom-escuro)]">
                {authLoading ? "Verificando sessão..." : "Redirecionando..."}
            </div>
        </div>
    );
  }

  // Se chegou aqui, significa que:
  // 1. authLoading é false (AuthContext já processou)
  // 2. currentUser é null (não há ninguém logado)
  // OU 3. currentUser é true, mas está no meio de um processo de login/cadastro (isAuthProcessing)
  // Portanto, é o momento certo para exibir o formulário.

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bege-claro)] p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-[var(--vermelho-principal)] mb-6">
          {isRegistering ? 'Cadastro de Usuário' : 'Acesse Sua Conta'} {/* Título mais genérico */}
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
            disabled={isAuthProcessing} // Desabilita o botão durante o processamento
          >
            {isAuthProcessing ? (isRegistering ? 'Cadastrando...' : 'Entrando...') : (isRegistering ? 'Cadastrar' : 'Entrar')}
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