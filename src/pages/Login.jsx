// src/pages/Login.jsx
import React, { useState, useEffect } from 'react'; // Adicionado useEffect
import { useNavigate } from 'react-router-dom';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { db } from '../firebase';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext'; // NOVO: Importe useAuth

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const auth = getAuth();

  // NOVO: Acessar os estados de autenticação do contexto

  const { currentUser, isAdmin, isMasterAdmin, loading: authLoading } = useAuth(); // Pega isMasterAdmin
  // NOVO: Efeito para lidar com o redirecionamento após o login
  useEffect(() => {
    if (!authLoading) { // Espera o AuthContext carregar
      if (currentUser) { // Se já há um usuário logado
        if (isMasterAdmin) {
          toast.success('Login Master Admin realizado com sucesso! Bem-vindo ao seu painel global. 🚀');
          navigate('/master-dashboard'); // Redireciona para o Dashboard Master (PRIORIDADE)
        } else if (isAdmin) {
          // Se não é Master Admin, mas é Admin de Estabelecimento
          toast.success('Login Administrador de Estabelecimento realizado com sucesso! Redirecionando para o painel de pedidos.');
          navigate('/painel-inicial'); // Redireciona para o Painel de Pedidos do estabelecimento
        } else {
          // Se não é nenhum tipo de administrador (usuário comum)
          toast.info('Login realizado com sucesso! Você foi redirecionado para a página inicial.');
          navigate('/'); // Ou para uma página de perfil de cliente
        }
      }
    }
  }, [currentUser, isAdmin, isMasterAdmin, authLoading, navigate]); // Dependências

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setError('');

    try {
      let userCredential;
      if (isRegistering) {
        // Lógica de Cadastro
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Ao cadastrar, o usuário é sempre comum por padrão. Permissões de admin são dadas manualmente.
        await setDoc(doc(db, 'usuarios', user.uid), {
          email: user.email,
          nome: nome,
          isAdmin: false,       // Novo usuário é sempre COMUM por padrão
          isMasterAdmin: false, // Novo usuário é sempre COMUM por padrão
          criadoEm: Timestamp.now()
        });
        
        toast.success('🎉 Cadastro realizado com sucesso! Por favor, faça login agora.');
        setIsRegistering(false);
        setEmail('');
        setPassword('');
        setNome('');

      } else {
        // Lógica de Login
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        // O redirecionamento será tratado pelo useEffect acima,
        // após o AuthContext atualizar o estado de currentUser, isAdmin, isMasterAdmin.
        toast.info('Login em andamento...'); // Feedback imediato para o usuário
      }
    } catch (error) {
      // Tratamento de Erros de Autenticação
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
    }
  };

  // Se o AuthContext ainda está carregando ou se o usuário já está logado
  if (authLoading) { /* ... */ }
  if (!currentUser || !isAdmin || isMasterAdmin) { // Também aqui para renderização inicial
      return null; // ou um componente de acesso negado
  }

  return (
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