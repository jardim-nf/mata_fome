// src/pages/Home.jsx
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

// --- AuthButtonElegant (Header/Navegação) - AGORA COM BOTÃO DE LOGOUT ---
function AuthButtonElegant({ onLoginClick }) {
  const { currentUser, loading, isAdmin, isMasterAdmin, logout } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="text-gray-700 text-sm font-light animate-pulse">Carregando...</div>
    );
  }

  if (currentUser) {
    const userEmailPrefix = currentUser.email ? currentUser.email.split('@')[0] : 'Usuário';

    const handleProfileClick = () => {
      if (isMasterAdmin) {
        navigate('/master-dashboard');
      } else if (isAdmin) {
        navigate('/painel-inicial');
      } else {
        navigate('/perfil');
      }
      toast.info(`Bem-vindo de volta, ${userEmailPrefix}.`);
    };

    const handleLogout = async () => {
      try {
        await logout();
        toast.success('Você foi desconectado com sucesso!');
        navigate('/');
      } catch (error) {
        console.error("Erro ao fazer logout:", error);
        toast.error('Ocorreu um erro ao tentar desconectar.');
      }
    };

    return (
      <div className="flex items-center space-x-3">
        <button
          onClick={handleProfileClick}
          className="px-4 py-2 rounded-full text-black bg-yellow-400 font-semibold text-sm transition-all duration-300 ease-in-out
                      hover:bg-yellow-500 hover:shadow-md"
        >
          Olá, {userEmailPrefix}!
        </button>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-full text-gray-700 border border-gray-400 font-semibold text-sm transition-all duration-300 ease-in-out
                      hover:bg-gray-100 hover:text-black hover:border-gray-500"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onLoginClick}
      className="px-5 py-2 rounded-full text-black bg-yellow-400 font-semibold text-sm transition-all duration-300 ease-in-out
                hover:bg-yellow-500 hover:shadow-md"
    >
      Login / Cadastre-se
    </button>
  );
}

// --- Hero Section - Inspirada no "Delivery Direto" com suas cores e imagem ---
function HeroSectionModern({ onExploreClick }) {
  return (
    <section className="relative w-full overflow-hidden bg-white pt-24 md:pt-32">
      <div className="container mx-auto flex flex-col lg:flex-row items-center justify-between py-12 md:py-20 px-4">
        {/* Lado Esquerdo: Conteúdo de Texto */}
        <div className="w-full lg:w-1/2 text-center lg:text-left mb-10 lg:mb-0 z-10">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-black mb-4 leading-tight">
            Deu Fome? <br className="hidden md:inline"/> Peça Agora!
          </h1>
          <p className="text-lg md:text-xl text-gray-700 mb-8 max-w-lg mx-auto lg:mx-0">
            Sua plataforma própria de delivery, com os melhores estabelecimentos da cidade, entregue rapidinho na sua porta.
          </p>
          <button
            onClick={onExploreClick}
            className="bg-yellow-500 text-black font-bold py-3 px-8 rounded-full text-lg shadow-lg
                        transition-all duration-300 transform hover:scale-105 hover:bg-yellow-600"
          >
            Ver Estabelecimentos
          </button>
        </div>

        {/* Lado Direito: Área Visual com Imagem de Pizza e Fundo Amarelo Vibrante */}
        <div className="relative w-full lg:w-1/2 flex justify-center items-center lg:h-[500px]">
          {/* Fundo Vibrante: O seu "laranja" do Delivery Direto */}
          <div className="absolute inset-y-0 right-0 w-full lg:w-[120%] bg-yellow-500 rounded-bl-[100px] lg:rounded-bl-[150px] transform lg:translate-x-1/4"></div>
          
          {/* Sua Imagem da Pizza - Centralizada sobre o fundo amarelo */}
          <img
            src="https://firebasestorage.googleapis.com/v0/b/matafome-98455.firebasestorage.app/o/pizza.png?alt=media&token=aac1a9a6-5381-41df-b728-c394fba7b762" 
            alt="Pizza Deliciosa"
            className="relative z-10 w-full max-w-md md:max-w-lg lg:max-w-none lg:w-auto h-auto rounded-xl shadow-2xl transform translate-y-8 lg:translate-y-0 rotate-3 transition-transform duration-500 ease-in-out hover:rotate-0"
          />
        </div>
      </div>
    </section>
  );
}

// --- Componente Modal de Login/Cadastro ---
function LoginModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [isAuthProcessing, setIsAuthProcessing] = useState(false);

  const authFirebase = getAuth();
  const { currentUser, isAdmin, isMasterAdmin, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && currentUser && isOpen) {
      onClose(); // Fecha o modal
      toast.success('Login realizado com sucesso! Redirecionando...');
    }
  }, [currentUser, isAdmin, isMasterAdmin, authLoading, isOpen, onClose]);

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setError('');
    setIsAuthProcessing(true);

    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(authFirebase, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, 'usuarios', user.uid), {
          email: user.email,
          nome: nome,
          isAdmin: false,
          isMasterAdmin: false,
          criadoEm: Timestamp.now()
        });
        
        toast.success('🎉 Cadastro realizado com sucesso! Por favor, faça login agora.');
        setIsRegistering(false);
        setEmail('');
        setPassword('');
        setNome('');

      } else {
        await signInWithEmailAndPassword(authFirebase, email, password);
      }
    } catch (error) {
      let errorMessage = 'Erro na operação. Verifique suas informações.';
      switch (error.code) {
        case 'auth/user-not-found': errorMessage = 'Usuário não encontrado. Verifique seu email.'; break;
        case 'auth/wrong-password': errorMessage = 'Senha incorreta. Tente novamente.'; break;
        case 'auth/invalid-email': errorMessage = 'Email inválido.'; break;
        case 'auth/email-already-in-use': errorMessage = 'Este email já está cadastrado.'; break;
        case 'auth/weak-password': errorMessage = 'Senha muito fraca. Deve ter pelo menos 6 caracteres.'; break;
        case 'auth/too-many-requests': errorMessage = 'Muitas tentativas. Tente novamente mais tarde.'; break;
        default: console.error("Erro de autenticação:", error.message);
      }
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsAuthProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white p-8 md:p-10 rounded-xl shadow-2xl w-full max-w-md border border-gray-200 animate-scale-in">
        <div className="flex justify-end mb-4">
          <button onClick={onClose} className="text-gray-500 hover:text-black text-2xl transition-colors duration-300">&times;</button>
        </div>
        <h2 className="font-sans text-3xl font-bold text-black text-center mb-8">
          {isRegistering ? 'Crie Sua Conta' : 'Acesse Sua Conta'}
        </h2>
        <form onSubmit={handleAuthAction} className="space-y-6">
          {isRegistering && (
            <div>
              <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-2">Nome Completo</label>
              <input
                type="text"
                id="nome"
                placeholder="Seu Nome Completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-1 focus:ring-yellow-500 transition-colors duration-300"
                required={isRegistering}
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              id="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-1 focus:ring-yellow-500 transition-colors duration-300"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Senha</label>
            <input
              type="password"
              id="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-1 focus:ring-yellow-500 transition-colors duration-300"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center font-sans mt-4">{error}</p>}
          <button
            type="submit"
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 rounded-lg text-lg transition-colors duration-300 shadow-md hover:shadow-lg"
            disabled={isAuthProcessing}
          >
            {isAuthProcessing ? (isRegistering ? 'Cadastrando...' : 'Entrando...') : (isRegistering ? 'Cadastrar' : 'Entrar')}
          </button>
        </form>

        <p className="mt-8 text-center text-gray-600 font-sans text-sm">
          {isRegistering ? (
            <>Já tem uma conta?{' '}
              <button
                onClick={() => { setIsRegistering(false); setError(''); setNome(''); setEmail(''); setPassword(''); }}
                className="text-yellow-600 hover:underline font-semibold transition-colors duration-300"
              >
                Faça Login
              </button>
            </>
          ) : (
            <>Não tem uma conta?{' '}
              <button
                onClick={() => { setIsRegistering(true); setError(''); setNome(''); setEmail(''); setPassword(''); }}
                className="text-yellow-600 hover:underline font-semibold transition-colors duration-300"
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


// --- Componente Principal da Página Home ---
function Home() {
  const [estabelecimentos, setEstabelecimentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const navigate = useNavigate();
  const estabelecimentosRef = useRef(null);

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);

  const scrollToEstabelecimentos = () => {
    estabelecimentosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
  };

  useEffect(() => {
    let isMounted = true;

    const fetchEstabelecimentos = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'estabelecimentos'));
        const listaEstabelecimentos = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        if (isMounted) {
          setEstabelecimentos(listaEstabelecimentos);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Erro ao carregar estabelecimentos (Home.jsx).", err);
          setError("Não foi possível carregar os estabelecimentos. Por favor, tente novamente mais tarde.");
          toast.error("Erro ao carregar estabelecimentos. " + (err.message || "Verifique sua conexão e tente novamente."));
        }
      }
    };

    fetchEstabelecimentos();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white text-black">
        <div className="text-2xl font-semibold animate-pulse">
          Deu Fome <span className="text-yellow-500">.</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white text-red-500">
        <p className="text-xl font-medium">{error}</p>
      </div>
    );
  }

  return (
    <>
      {/* Header Fixo e Transparente */}
      <header className="fixed top-0 left-0 right-0 z-20 p-6 flex justify-between items-center bg-white bg-opacity-90 backdrop-blur-sm shadow-sm border-b border-gray-100">
        <div className="font-extrabold text-2xl text-black cursor-pointer hover:text-gray-800 transition-colors duration-300" onClick={() => navigate('/')}>
          DEU FOME <span className="text-yellow-500">.</span>
        </div>
        <AuthButtonElegant onLoginClick={openLoginModal} />
      </header>

      {/* Hero Section */}
      <HeroSectionModern onExploreClick={scrollToEstabelecimentos} />

      {/* Seção "Como Funciona" - Baseada na imagem "Venda mais e aumente sua receita" */}
      <section className="bg-gray-50 py-16 md:py-24 px-4">
        <div className="container mx-auto">
          <h2 className="text-3xl md:text-4xl font-extrabold text-black text-center mb-12">
            Por que ter sua plataforma Deu Fome?
            <div className="w-24 h-1 bg-yellow-500 mx-auto mt-4 rounded-full"></div>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {/* Card 1: Venda Mais */}
            <div className="flex flex-col items-center text-center p-6 bg-white rounded-xl shadow-md border border-gray-100 transition-transform duration-300 hover:scale-105 hover:shadow-lg">
              {/* Substitua pela URL da sua ilustração */}
              <img src="https://assets.website-files.com/5f8c292193b2160d70425785/5f8c379a95ec6048d2a63273_feature-01.svg" alt="Venda Mais" className="h-28 w-28 mb-6" />
              <h3 className="text-xl font-bold text-black mb-3">Venda mais e aumente sua receita</h3>
              <p className="text-gray-700 text-base leading-relaxed">
                Crie cupons, programas de fidelidade, campanhas de email e push para fidelizar seus clientes.
              </p>
            </div>

            {/* Card 2: Organize Sua Operação */}
            <div className="flex flex-col items-center text-center p-6 bg-white rounded-xl shadow-md border border-gray-100 transition-transform duration-300 hover:scale-105 hover:shadow-lg">
              {/* Substitua pela URL da sua ilustração */}
              <img src="https://assets.website-files.com/5f8c292193b2160d70425785/5f8c379a1f73440e532a8138_feature-02.svg" alt="Organize Operação" className="h-28 w-28 mb-6" />
              <h3 className="text-xl font-bold text-black mb-3">Organize sua operação de delivery</h3>
              <p className="text-gray-700 text-base leading-relaxed">
                Centralize seus pedidos em uma só plataforma e organize suas operações de forma eficiente.
              </p>
            </div>

            {/* Card 3: Economize Dinheiro */}
            <div className="flex flex-col items-center text-center p-6 bg-white rounded-xl shadow-md border border-gray-100 transition-transform duration-300 hover:scale-105 hover:shadow-lg">
              {/* Substitua pela URL da sua ilustração */}
              <img src="https://assets.website-files.com/5f8c292193b2160d70425785/5f8c379a0b1273390c9b0e91_feature-03.svg" alt="Economize Dinheiro" className="h-28 w-28 mb-6" />
              <h3 className="text-xl font-bold text-black mb-3">Economize dinheiro com comissões</h3>
              <p className="text-gray-700 text-base leading-relaxed">
                Com seu canal próprio você não paga mais comissões altas e não fica dependente de marketplaces.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Seção "Nossos Planos" - Estrutura básica */}
      <section className="bg-white py-16 md:py-24 px-4">
        <div className="container mx-auto">
          <h2 className="text-3xl md:text-4xl font-extrabold text-black text-center mb-12">
            Escolha o Plano Ideal para Você
            <div className="w-24 h-1 bg-yellow-500 mx-auto mt-4 rounded-full"></div>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {/* Plano Básico */}
            <div className="flex flex-col items-center text-center p-8 bg-gray-50 rounded-xl shadow-lg border border-gray-200 transition-transform duration-300 hover:scale-105 hover:shadow-xl">
              <h3 className="text-2xl font-bold text-yellow-600 mb-4">Plano Essencial</h3>
              <p className="text-black text-4xl font-extrabold mb-4">
                R$99<span className="text-xl text-gray-700">/mês</span>
              </p>
              <p className="text-gray-700 text-base mb-6">Ideal para pequenos negócios que estão começando.</p>
              <ul className="text-gray-800 text-left mb-8 space-y-2">
                <li className="flex items-center"><svg className="w-5 h-5 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Pedidos ilimitados</li>
                <li className="flex items-center"><svg className="w-5 h-5 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Cardápio online</li>
                <li className="flex items-center"><svg className="w-5 h-5 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Suporte básico</li>
              </ul>
              <button className="w-full bg-black text-white font-bold py-3 rounded-lg hover:bg-gray-800 transition-colors duration-300 shadow-md">
                Assinar Plano
              </button>
            </div>

            {/* Plano Premium - Destaque */}
            <div className="flex flex-col items-center text-center p-8 bg-black text-white rounded-xl shadow-2xl border-2 border-yellow-500 transition-transform duration-300 hover:scale-105 hover:shadow-yellow-500/50">
              <h3 className="text-2xl font-bold text-yellow-500 mb-4">Plano Profissional</h3>
              <p className="text-white text-4xl font-extrabold mb-4">
                R$199<span className="text-xl text-gray-400">/mês</span>
              </p>
              <p className="text-gray-300 text-base mb-6">Para negócios que buscam crescer e otimizar.</p>
              <ul className="text-gray-200 text-left mb-8 space-y-2">
                <li className="flex items-center"><svg className="w-5 h-5 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Tudo do Essencial</li>
                <li className="flex items-center"><svg className="w-5 h-5 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Cupons e Fidelidade</li>
                <li className="flex items-center"><svg className="w-5 h-5 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Marketing por Email/Push</li>
                <li className="flex items-center"><svg className="w-5 h-5 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Relatórios avançados</li>
              </ul>
              <button className="w-full bg-yellow-500 text-black font-bold py-3 rounded-lg hover:bg-yellow-600 transition-colors duration-300 shadow-md">
                Assinar Plano
              </button>
            </div>

            {/* Plano Enterprise */}
            <div className="flex flex-col items-center text-center p-8 bg-gray-50 rounded-xl shadow-lg border border-gray-200 transition-transform duration-300 hover:scale-105 hover:shadow-xl">
              <h3 className="text-2xl font-bold text-black mb-4">Plano Empresarial</h3>
              <p className="text-black text-4xl font-extrabold mb-4">
                Personalizado
              </p>
              <p className="text-gray-700 text-base mb-6">Soluções sob medida para grandes redes.</p>
              <ul className="text-gray-800 text-left mb-8 space-y-2">
                <li className="flex items-center"><svg className="w-5 h-5 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Tudo do Profissional</li>
                <li className="flex items-center"><svg className="w-5 h-5 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Integrações personalizadas</li>
                <li className="flex items-center"><svg className="w-5 h-5 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>Gerente de conta dedicado</li>
              </ul>
              <button className="w-full bg-black text-white font-bold py-3 rounded-lg hover:bg-gray-800 transition-colors duration-300 shadow-md">
                Entrar em Contato
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Seção de Estabelecimentos Parceiros (já existente) */}
      <div ref={estabelecimentosRef} className="container mx-auto px-4 py-16 bg-white text-black">
        <h2 className="text-4xl md:text-5xl font-extrabold text-center mb-12 text-black">
          Nossos Estabelecimentos Parceiros
          <div className="w-24 h-1 bg-yellow-500 mx-auto mt-4 rounded-full"></div>
        </h2>

        {estabelecimentos.length === 0 ? (
          <div className="text-center p-16 text-gray-600 bg-gray-50 rounded-xl shadow-md border border-gray-200">
            <p className="font-medium text-lg mb-4">Nenhum estabelecimento disponível no momento.</p>
            <p className="font-normal text-md">Estamos trabalhando para trazer as melhores opções para você!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {estabelecimentos.map(estabelecimento => (
              // >>>>> CORREÇÃO AQUI: USANDO estab.slug PARA O LINK <<<<<
              <div
                key={estabelecimento.id}
                className="group bg-white rounded-xl shadow-lg overflow-hidden transform transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-xl cursor-pointer flex flex-col border border-gray-200 hover:border-yellow-500"
                // O onClick no div pai para navegacao (melhor usar o Link diretamente para SEO/Acessibilidade)
                onClick={() => {
                  if (estabelecimento.slug) { // Verifica se o slug existe
                    navigate(`/cardapio/${estabelecimento.slug}`);
                    toast.info(`Aguarde enquanto carregamos o cardápio de ${estabelecimento.nome}.`);
                  } else {
                    toast.error(`Slug do estabelecimento "${estabelecimento.nome}" não encontrado.`);
                    console.error("Home Debug: Estabelecimento sem slug:", estabelecimento.nome, estabelecimento.id);
                  }
                }}
              >
                {estabelecimento.imageUrl ? (
                  <img
                    src={estabelecimento.imageUrl}
                    alt={estabelecimento.nome || 'Estabelecimento'}
                    className="w-full h-56 object-cover object-center"
                  />
                ) : (
                  <div className="w-full h-56 bg-gray-100 flex items-center justify-center text-gray-400 text-lg font-medium">
                    <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                  </div>
                )}
                <div className="p-4 flex-grow">
                  <h3 className="text-xl font-bold text-black mb-2 leading-tight group-hover:text-yellow-600 transition-colors duration-300">{estabelecimento.nome}</h3>
                  {estabelecimento.endereco && typeof estabelecimento.endereco === 'object' ? (
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {estabelecimento.endereco.rua ? `${estabelecimento.endereco.rua}, ` : ''}
                      {estabelecimento.endereco.numero || ''}
                      {estabelecimento.endereco.bairro ? ` - ${estabelecimento.endereco.bairro}` : ''}
                      {estabelecimento.endereco.cidade ? `, ${estabelecimento.endereco.cidade}` : ''}
                    </p>
                  ) : (
                    <p className="text-gray-500 text-sm mb-3">Endereço não especificado.</p>
                  )}
                </div>
                <div className="p-4 border-t border-gray-100 group-hover:border-yellow-200 transition-colors duration-300">
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Previne o clique do div pai (se houver um Link ou onClick nele)
                      if (estabelecimento.slug) {
                        navigate(`/cardapio/${estabelecimento.slug}`);
                        toast.info(`Aguarde enquanto carregamos o cardápio de ${estabelecimento.nome}.`);
                      } else {
                        toast.error(`Slug do estabelecimento "${estabelecimento.nome}" não encontrado.`);
                        console.error("Home Debug: Botão 'Ver Cardápio' clicado, mas estabelecimento sem slug:", estabelecimento.nome, estabelecimento.id);
                      }
                    }}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 rounded-md text-lg transition-colors duration-300 shadow-md hover:shadow-lg"
                  >
                    Ver Cardápio
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rodapé Moderno */}
      <footer className="bg-black text-gray-400 text-center p-8 border-t border-gray-800">
        <p className="font-medium text-sm">&copy; {new Date().getFullYear()} Deu Fome. Todos os direitos reservados.</p>
        <p className="font-normal text-xs mt-2">Sua experiência de delivery, elevada.</p>
      </footer>

      {/* Renderiza o Modal de Login/Cadastro */}
      <LoginModal isOpen={isLoginModalOpen} onClose={closeLoginModal} />
    </>
  );
}

export default Home;