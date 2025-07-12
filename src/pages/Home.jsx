// src/pages/Home.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// Importa funções do Firebase para autenticação e Firestore
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase'; // Importa as instâncias de auth e db do seu arquivo de configuração do Firebase
import "../App.css"; // Importar o CSS global

function Home() {
  const { currentUser, authLoading } = useAuth();
  const navigate = useNavigate();

  // NÚMERO DE WHATSAPP PARA CONTATO ADMIN (SUBSTITUA POR UM NÚMERO REAL COM DDD, SEM ESPAÇOS OU TRAÇOS)
  const whatsappNumber = "5522999822324"; // Ex: 55 DDD NÚMERO (Ex: 5511987654321)
  // Mensagem para Acessar Painel (URL-encoded)
  const messageAcessarPainel = encodeURIComponent("Olá, gostaria de informações sobre como acessar o painel de administrador do Mata Fome.");
  // Mensagem para Cadastrar Admin (URL-encoded)
  const messageCadastrarAdmin = encodeURIComponent("Olá, gostaria de informações sobre como me cadastrar como administrador no Mata Fome.");


  // ESTADOS PARA O CARD DE LOGIN/CADASTRO DO CLIENTE (UNIFICADO)
  const [showClientModal, setShowClientModal] = useState(false); // Controla a visibilidade do modal
  const [isClientLoginView, setIsClientLoginView] = useState(true); // true = Login, false = Cadastro

  const [clientEmail, setClientEmail] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  const [clientLoginError, setClientLoginError] = useState('');
  const [loadingClientLogin, setLoadingClientLogin] = useState(false);
  const [clientName, setClientName] = useState(''); // Novo estado para nome (cadastro)
  const [clientConfirmPassword, setClientConfirmPassword] = useState(''); // Novo estado para confirmação de senha (cadastro)
  const [clientRegisterError, setClientRegisterError] = useState(''); // Novo estado para erros de cadastro
  const [loadingClientRegister, setLoadingClientRegister] = useState(false); // Novo estado para loading de cadastro

  // ESTADOS PARA O CARD DE LOGIN DO ADMINISTRADOR (AGORA SÓ APARECE SE CLICAR NO PRÓPRIO LOGIN MODAL DO HEADER)
  const [showAdminLoginCard, setShowAdminLoginCard] = useState(false); // Mantido caso o login admin seja chamado de outra forma
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');
  const [loadingAdminLogin, setLoadingAdminLogin] = useState(false);

  // ESTADOS PARA OS ESTABELECIMENTOS EM DESTAQUE
  const [estabelecimentosDestaque, setEstabelecimentosDestaque] = useState([]);
  const [loadingEstabelecimentos, setLoadingEstabelecimentos] = useState(true);
  const [errorEstabelecimentos, setErrorEstabelecimentos] = useState(''); // Estado para exibir erros

  // --- FUNÇÕES DE CONTROLE DE MODAL CLIENTE ---
  const openClientLoginModal = () => {
    setShowClientModal(true);
    setIsClientLoginView(true); // Abre no modo login
    setClientLoginError('');
    setClientEmail('');
    setClientPassword('');
    setClientName('');
    setClientConfirmPassword('');
    setClientRegisterError('');
  };

  const openClientRegisterModal = () => {
    setShowClientModal(true);
    setIsClientLoginView(false); // Abre no modo cadastro
    setClientRegisterError('');
    setClientName('');
    setClientEmail('');
    setClientPassword('');
    setClientConfirmPassword('');
    setClientLoginError('');
  };

  const closeClientModal = () => {
    setShowClientModal(false);
  };

  // --- FUNÇÕES DE LOGIN/CADASTRO CLIENTE ---
  const handleClientLogin = async (e) => {
    e.preventDefault();
    setLoadingClientLogin(true);
    setClientLoginError('');

    try {
      await signInWithEmailAndPassword(auth, clientEmail, clientPassword);
      closeClientModal();
      navigate('/');
    } catch (error) {
      console.error("Erro ao fazer login do cliente:", error);
      let errorMessage = "Email ou senha incorretos.";
      if (error.code === 'auth/invalid-email') {
        errorMessage = "Formato de email inválido.";
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = "Usuário não encontrado. Cadastre-se!";
      }
      setClientLoginError(errorMessage);
    } finally {
      setLoadingClientLogin(false);
    }
  };

  const handleClientRegister = async (e) => {
    e.preventDefault();
    setLoadingClientRegister(true);
    setClientRegisterError('');

    if (clientPassword !== clientConfirmPassword) {
      setClientRegisterError("As senhas não coincidem.");
      setLoadingClientRegister(false);
      return;
    }
    if (clientPassword.length < 6) {
      setClientRegisterError("A senha deve ter pelo menos 6 caracteres.");
      setLoadingClientRegister(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, clientEmail, clientPassword);
      const user = userCredential.user;

      await setDoc(doc(db, 'clientes', user.uid), {
        nome: clientName,
        email: clientEmail,
        telefone: '',
        dataCadastro: new Date(),
      });

      closeClientModal();
      navigate('/');

    } catch (error) {
      console.error("Erro ao fazer cadastro do cliente:", error);
      let errorMessage = "Erro ao cadastrar. Por favor, tente novamente.";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "Este email já está em uso.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "Senha muito fraca.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Formato de email inválido.";
      }
      setClientRegisterError(errorMessage);
    } finally {
      setLoadingClientRegister(false);
    }
  };

  // --- FUNÇÃO DE LOGIN ADMINISTRADOR (MANTIDA, AGORA CHAMADA APENAS PELO HEADER SE DESEJADO) ---
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoadingAdminLogin(true);
    setAdminLoginError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      const user = userCredential.user;

      const userDocRef = doc(db, 'usuarios', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists() && userDocSnap.data()?.isAdmin) {
        setShowAdminLoginCard(false);
        navigate('/dashboard');
      } else {
        await auth.signOut();
        setAdminLoginError('Acesso negado. Você não tem permissões de administrador.');
      }
    } catch (error) {
      console.error("Erro ao fazer login do administrador:", error);
      let errorMessage = "Erro ao fazer login. Por favor, tente novamente.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = "Email ou senha incorretos.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Formato de email inválido.";
      }
      setAdminLoginError(errorMessage);
    } finally {
      setLoadingAdminLogin(false);
    }
  };

  // --- EFEITO PARA BUSCAR ESTABELECIMENTOS EM DESTAQUE ---
  useEffect(() => {
    const fetchEstabelecimentosDestaque = async () => {
      try {
        const estabelecimentosCollection = collection(db, 'estabelecimentos');
        const estabelecimentosSnapshot = await getDocs(estabelecimentosCollection);
        const estabelecimentosList = estabelecimentosSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setEstabelecimentosDestaque(estabelecimentosList);
        if (estabelecimentosList.length === 0) {
            setErrorEstabelecimentos("Nenhum estabelecimento em destaque encontrado. Verifique seu banco de dados.");
        }
      } catch (err) {
        console.error("Erro ao buscar estabelecimentos:", err);
        setErrorEstabelecimentos("Não foi possível carregar os estabelecimentos em destaque. Por favor, tente novamente mais tarde ou verifique a conexão.");
      } finally {
        setLoadingEstabelecimentos(false);
      }
    };

    fetchEstabelecimentosDestaque();
  }, []);

  // Espera o AuthContext carregar antes de renderizar o conteúdo principal
  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-white">
        <p className="text-[var(--marrom-escuro)]">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="relative bg-white min-h-screen">
      
      {/* Seção Hero: Fundo vermelho principal */}
      <section className="bg-[var(--vermelho-principal)] text-white py-20 text-center">
        <div className="container mx-auto">
          <h1 className="text-5xl font-bold mb-4">Mata Fome</h1>
          <p className="text-xl mb-8">Seu delivery favorito, rápido e fácil!</p>
        </div>
      </section>

      {/* Nova Seção: Escolha de Usuário (Cliente/Administrador) */}
      {!currentUser && (
        <section className="container mx-auto mt-[-40px] mb-12 px-4 relative z-10">
          <div className="bg-white p-8 rounded-lg shadow-xl grid grid-cols-1 md:grid-cols-2 gap-8 text-center max-w-3xl mx-auto">
            {/* Opção Cliente */}
            <div className="flex flex-col items-center p-4">
              <h3 className="text-2xl font-bold text-[var(--marrom-escuro)] mb-4">Você é cliente?</h3>
              <p className="text-[var(--cinza-texto)] mb-6">Peça sua comida favorita em poucos cliques!</p>
              <button
                onClick={openClientLoginModal} // <-- Abre o modal em modo login
                className="bg-[var(--vermelho-principal)] text-white px-8 py-3 rounded-full text-lg font-semibold hover:bg-red-700 transition duration-300 shadow-md"
              >
                Fazer Login
              </button>
              <button
                onClick={openClientRegisterModal} // <-- Abre o modal em modo cadastro
                className="text-[var(--vermelho-principal)] hover:underline mt-4 bg-transparent border-none p-0 cursor-pointer"
              >
                Não tem conta? Cadastre-se
              </button>
            </div>
            
            {/* Divisor vertical (removido, mas o comentário pode ficar se quiser) */}
            {/* <div className="hidden md:block w-px bg-gray-300 mx-auto"></div> */}

            {/* Opção Administrador */}
            <div className="flex flex-col items-center p-4">
              <h3 className="text-2xl font-bold text-[var(--marrom-escuro)] mb-4">Você é administrador?</h3>
              <p className="text-[var(--cinza-texto)] mb-6">Gerencie seus pedidos e seu negócio!</p>
              <a // <-- ALTERADO: Agora é um link para WhatsApp
                href={`https://wa.me/${whatsappNumber}?text=${messageAcessarPainel}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[var(--marrom-escuro)] text-white px-8 py-3 rounded-full text-lg font-semibold hover:bg-gray-700 transition duration-300 shadow-md inline-block text-center"
              >
                Acessar Painel
              </a>
              <a // <-- ALTERADO: Agora é um link para WhatsApp
                href={`https://wa.me/${whatsappNumber}?text=${messageCadastrarAdmin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--marrom-escuro)] hover:underline mt-4 bg-transparent border-none p-0 cursor-pointer inline-block text-center"
              >
                Cadastrar Admin
              </a>
            </div>
          </div>
        </section>
      )}

      {/* --- NOVO MODAL UNIFICADO PARA LOGIN/CADASTRO DO CLIENTE --- */}
      {showClientModal && !currentUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full relative">
            <button
              onClick={closeClientModal}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl"
            >
              &times;
            </button>
            <h2 className="text-2xl font-bold text-[var(--vermelho-principal)] mb-6 text-center">
              {isClientLoginView ? 'Login do Cliente' : 'Cadastro de Cliente'}
            </h2>

            {/* Formulário de LOGIN */}
            {isClientLoginView ? (
              <form onSubmit={handleClientLogin}>
                <div className="mb-4">
                  <label htmlFor="clientEmailLogin" className="block text-gray-700 text-sm font-bold mb-2">
                    Email:
                  </label>
                  <input
                    type="email"
                    id="clientEmailLogin"
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-6">
                  <label htmlFor="clientPasswordLogin" className="block text-gray-700 text-sm font-bold mb-2">
                    Senha:
                  </label>
                  <input
                    type="password"
                    id="clientPasswordLogin"
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
                    value={clientPassword}
                    onChange={(e) => setClientPassword(e.target.value)}
                    required
                  />
                </div>
                {clientLoginError && (
                  <p className="text-red-500 text-xs italic mb-4 text-center">{clientLoginError}</p>
                )}
                <div className="flex items-center justify-between">
                  <button
                    type="submit"
                    className="bg-[var(--vermelho-principal)] hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline w-full"
                    disabled={loadingClientLogin}
                  >
                    {loadingClientLogin ? 'Entrando...' : 'Entrar'}
                  </button>
                </div>
                <p className="text-center text-sm text-gray-600 mt-4">
                  Não tem uma conta?{' '}
                  <button
                    type="button"
                    onClick={() => setIsClientLoginView(false)} // Alterna para cadastro
                    className="text-[var(--vermelho-principal)] hover:underline bg-transparent border-none p-0 cursor-pointer"
                  >
                    Cadastre-se aqui
                  </button>
                </p>
              </form>
            ) : (
              // --- Formulário de CADASTRO ---
              <form onSubmit={handleClientRegister}>
                <div className="mb-4">
                  <label htmlFor="clientNameRegister" className="block text-gray-700 text-sm font-bold mb-2">
                    Nome:
                  </label>
                  <input
                    type="text"
                    id="clientNameRegister"
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="clientEmailRegister" className="block text-gray-700 text-sm font-bold mb-2">
                    Email:
                  </label>
                  <input
                    type="email"
                    id="clientEmailRegister"
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="clientPasswordRegister" className="block text-gray-700 text-sm font-bold mb-2">
                    Senha:
                  </label>
                  <input
                    type="password"
                    id="clientPasswordRegister"
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    value={clientPassword}
                    onChange={(e) => setClientPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-6">
                  <label htmlFor="clientConfirmPasswordRegister" className="block text-gray-700 text-sm font-bold mb-2">
                    Confirmar Senha:
                  </label>
                  <input
                    type="password"
                    id="clientConfirmPasswordRegister"
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
                    value={clientConfirmPassword}
                    onChange={(e) => setClientConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                {clientRegisterError && (
                  <p className="text-red-500 text-xs italic mb-4 text-center">{clientRegisterError}</p>
                )}
                <div className="flex items-center justify-between">
                  <button
                    type="submit"
                    className="bg-[var(--vermelho-principal)] hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline w-full"
                    disabled={loadingClientRegister}
                  >
                    {loadingClientRegister ? 'Cadastrando...' : 'Cadastrar'}
                  </button>
                </div>
                <p className="text-center text-sm text-gray-600 mt-4">
                  Já tem uma conta?{' '}
                  <button
                    type="button"
                    onClick={() => setIsClientLoginView(true)} // Alterna para login
                    className="text-[var(--vermelho-principal)] hover:underline bg-transparent border-none p-0 cursor-pointer"
                  >
                    Fazer Login
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      )}

      {/* CARD DE LOGIN DO ADMINISTRADOR (AINDA EXISTE, MAS NÃO É ATIVADO PELOS BOTÕES DA HOME MAIS) */}
      {showAdminLoginCard && !currentUser && ( // Este modal só aparecerá se 'showAdminLoginCard' for true, que não é ativado por botões agora
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full relative">
            <button
              onClick={() => setShowAdminLoginCard(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl"
            >
              &times;
            </button>
            <h2 className="text-2xl font-bold text-[var(--marrom-escuro)] mb-6 text-center">Login do Administrador</h2>
            <form onSubmit={handleAdminLogin}>
              <div className="mb-4">
                <label htmlFor="adminEmail" className="block text-gray-700 text-sm font-bold mb-2">
                  Email:
                </label>
                <input
                  type="email"
                  id="adminEmail"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                />
              </div>
              <div className="mb-6">
                <label htmlFor="adminPassword" className="block text-gray-700 text-sm font-bold mb-2">
                  Senha:
                </label>
                <input
                  type="password"
                  id="adminPassword"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                />
              </div>
              {adminLoginError && (
                <p className="text-red-500 text-xs italic mb-4 text-center">{adminLoginError}</p>
              )}
              <div className="flex items-center justify-between">
                <button
                  type="submit"
                  className="bg-[var(--marrom-escuro)] hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline w-full"
                  disabled={loadingAdminLogin}
                >
                  {loadingAdminLogin ? 'Entrando...' : 'Entrar'}
                </button>
              </div>
            </form>
            <p className="text-center text-sm text-gray-600 mt-4">
              Não tem uma conta de admin?{' '}
              <Link to="/login-admin" className="text-[var(--marrom-escuro)] hover:underline" onClick={() => setShowAdminLoginCard(false)}>
                Cadastre-se aqui
              </Link>
            </p>
          </div>
        </div>
      )}
      {/* Seção de Categorias */}
      <section className="container mx-auto my-12 px-4">
        <h2 className="text-3xl font-bold text-[var(--marrom-escuro)] mb-8 text-center">Categorias Populares</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-gray-100 p-6 rounded-lg shadow-md text-center hover:shadow-lg transition duration-300">
            <h3 className="text-xl font-semibold text-[var(--marrom-escuro)] mb-2">Pizzas</h3>
            <p className="text-gray-600">As melhores pizzarias da cidade.</p>
          </div>
          <div className="bg-gray-100 p-6 rounded-lg shadow-md text-center hover:shadow-lg transition duration-300">
            <h3 className="text-xl font-semibold text-[var(--marrom-escuro)] mb-2">Hambúrgueres</h3>
            <p className="text-gray-600">Opções suculentas para seu lanche.</p>
          </div>
          <div className="bg-gray-100 p-6 rounded-lg shadow-md text-center hover:shadow-lg transition duration-300">
            <h3 className="text-xl font-semibold text-[var(--marrom-escuro)] mb-2">Comida Japonesa</h3>
            <p className="text-gray-600">Sabores orientais autênticos.</p>
          </div>
          <div className="bg-gray-100 p-6 rounded-lg shadow-md text-center hover:shadow-lg transition duration-300">
            <h3 className="text-xl font-semibold text-[var(--marrom-escuro)] mb-2">Marmitas</h3>
            <p className="text-gray-600">Refeições completas e saudáveis.</p>
          </div>
        </div>
      </section>

      {/* Estabelecimentos em Destaque */}
      <section className="container mx-auto my-12 px-4">
        <h2 className="text-3xl font-bold text-[var(--marrom-escuro)] mb-8 text-center">Estabelecimentos em Destaque</h2>
        {loadingEstabelecimentos ? (
          <p className="text-center text-[var(--marrom-escuro)]">Carregando estabelecimentos...</p>
        ) : errorEstabelecimentos ? (
          <p className="text-center text-red-500">{errorEstabelecimentos}</p>
        ) : estabelecimentosDestaque.length === 0 ? (
          <p className="text-center text-gray-600">Nenhum estabelecimento em destaque encontrado.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {estabelecimentosDestaque.map((estabelecimento) => (
              <Link to={`/cardapio/${estabelecimento.id}`} key={estabelecimento.id} className="block">
                <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition duration-300 transform hover:-translate-y-1">
                  {estabelecimento.imageUrl && (
                    <img
                      src={estabelecimento.imageUrl}
                      alt={estabelecimento.nome}
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-[var(--marrom-escuro)] mb-2">{estabelecimento.nome}</h3>
                    {estabelecimento.endereco && (
                      <p className="text-gray-600 mb-2">
                        {estabelecimento.endereco.rua || ''}, {estabelecimento.endereco.numero || ''} - {estabelecimento.endereco.bairro || ''}
                        {estabelecimento.endereco.complemento && ` (${estabelecimento.endereco.complemento})`}
                      </p>
                    )}
                    <div className="flex items-center text-yellow-500">
                      {'⭐'.repeat(Math.round(estabelecimento.rating || 0))}
                      <span className="text-gray-600 ml-2">({estabelecimento.rating?.toFixed(1) || 'N/A'})</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Home;