import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

export default function LoginPage() {
  const { login, currentUser, userData, authChecked } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingLocal, setLoadingLocal] = useState(false);

  // 1. A Lógica de Redirecionamento fica no useEffect
  // Ela reage assim que o AuthContext termina de carregar o userData
  useEffect(() => {
    if (authChecked && currentUser && userData) {
      if (userData.isMasterAdmin) {
        toast.success(`Olá Mestre, ${userData.nome}!`);
        navigate('/master/estabelecimentos', { replace: true });
      } else if (userData.isAdmin) {
        if (userData.estabelecimentosGerenciados?.length > 0) {
            toast.success('Painel Administrativo carregado.');
            navigate('/admin/dashboard', { replace: true });
        } else {
            toast.warning('Conta Admin sem estabelecimentos vinculados.');
            navigate('/admin/dashboard', { replace: true });
        }
      } else {
        // Cliente ou usuário comum
        navigate('/', { replace: true });
      }
    }
  }, [authChecked, currentUser, userData, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoadingLocal(true);

    try {
      // Apenas faz o login. O useEffect acima cuidará do resto.
      await login(email, password);
      // Não precisa de toast de sucesso aqui, o useEffect ou o contexto podem fazer, 
      // mas se quiser feedback imediato visual:
      // toast.info('Autenticando...'); 
    } catch (error) {
      console.error('Erro no login:', error);
      let msg = 'Falha ao entrar.';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        msg = 'Email ou senha incorretos.';
      } else if (error.code === 'auth/too-many-requests') {
        msg = 'Muitas tentativas. Aguarde um instante.';
      }
      toast.error(msg);
      setLoadingLocal(false); // Só destrava se der erro
    }
  };

  // Se já estiver logado e carregando dados, mostra loading para evitar piscar o form
  if (authChecked && currentUser && !userData) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="flex flex-col items-center">
                <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-gray-600 font-medium">Carregando perfil...</p>
            </div>
        </div>
      );
  }

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
            <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemplo@email.com"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-yellow-500 outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loadingLocal}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold py-3.5 rounded-xl hover:from-yellow-600 hover:to-orange-600 focus:ring-4 focus:ring-yellow-200 transition-all transform active:scale-95 shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loadingLocal ? (
                <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Verificando...
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