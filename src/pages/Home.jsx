import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import logo from '../assets/logo-deufome.png';

function Home() {
  const { authLoading, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const whatsappNumber = "5522999822324";
  const messageSuporteAdmin = encodeURIComponent("Olá, estou com dificuldades para acessar/cadastrar como administrador no DeuFome. Poderiam me ajudar?");

  const [estabelecimentosDestaque, setEstabelecimentosDestaque] = useState([]);
  const [loadingEstabelecimentos, setLoadingEstabelecimentos] = useState(true);
  const [errorEstabelecimentos, setErrorEstabelecimentos] = useState('');
  const [mostrarLoginCliente, setMostrarLoginCliente] = useState(false);
  const [mostrarLoginAdmin, setMostrarLoginAdmin] = useState(false);
  const [mostrarCadastroCliente, setMostrarCadastroCliente] = useState(false);

  // Estados para o formulário de cadastro no modal
  const [emailCadastro, setEmailCadastro] = useState('');
  const [senhaCadastro, setSenhaCadastro] = useState('');
  const [nomeCadastro, setNomeCadastro] = useState('');
  const [telefoneCadastro, setTelefoneCadastro] = useState('');

  // Estados para o formulário de login no modal
  const [emailLogin, setEmailLogin] = useState('');
  const [senhaLogin, setSenhaLogin] = useState('');


  useEffect(() => {
    const fetchEstabelecimentosDestaque = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'estabelecimentos'));
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setEstabelecimentosDestaque(list);
        if (list.length === 0) {
          setErrorEstabelecimentos("Nenhum estabelecimento em destaque encontrado.");
        }
      } catch (err) {
        console.error("Erro ao carregar estabelecimentos:", err);
        setErrorEstabelecimentos("Erro ao carregar estabelecimentos.");
      } finally {
        setLoadingEstabelecimentos(false);
      }
    };

    fetchEstabelecimentosDestaque();
  }, []);

  // Efeito para fechar modais se o usuário já está logado
  useEffect(() => {
    if (currentUser) {
      setMostrarLoginCliente(false);
      setMostrarLoginAdmin(false);
      setMostrarCadastroCliente(false);
    }
  }, [currentUser]);

  // Efeito para abrir o modal automaticamente se vier de um redirect (do Menu.jsx)
  useEffect(() => {
    if (location.state?.openLoginModal) {
      setMostrarLoginCliente(true);
      navigate(location.pathname, { replace: true, state: { ...location.state, openLoginModal: false } });
    } else if (location.state?.openRegisterModal) {
      setMostrarCadastroCliente(true);
      navigate(location.pathname, { replace: true, state: { ...location.state, openRegisterModal: false } });
    }
  }, [location.state, location.pathname, navigate]);

  // Função para lidar com o login do cliente no modal
  const handleLoginCliente = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, emailLogin, senhaLogin);
      alert('Login Cliente realizado com sucesso!');
      setMostrarLoginCliente(false); // Fecha o modal
      setEmailLogin(''); // Limpa os campos do formulário
      setSenhaLogin('');

      if (location.state?.from) {
        navigate(location.state.from, { replace: true }); // Redireciona para o caminho de origem
      } else {
        navigate('/'); // Se não houver 'from' (login direto da Home), navega para a Home
      }
    } catch (error) {
      alert("Erro ao fazer login. Verifique as credenciais.");
      console.error("Erro no login do cliente:", error);
    }
  };

  // Função para lidar com o login do administrador no modal
  const handleLoginAdmin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, emailLogin, senhaLogin);
      alert('Login Administrador realizado com sucesso!');
      setMostrarLoginAdmin(false); // Fecha o modal
      setEmailLogin(''); // Limpa os campos do formulário
      setSenhaLogin('');
      navigate('/painel'); // Admin é redirecionado para o painel (comportamento desejado para admin)
    } catch (error) {
      alert("Erro ao fazer login. Verifique as credenciais.");
      console.error("Erro no login do admin:", error);
    }
  };

  // Função para lidar com o cadastro do cliente no modal
  const handleCadastroCliente = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, emailCadastro, senhaCadastro);
      const user = userCredential.user;

      // SALVAR DADOS ADICIONAIS DO CLIENTE NO FIRESTORE
      await setDoc(doc(db, 'clientes', user.uid), {
        nome: nomeCadastro,
        telefone: telefoneCadastro,
        email: emailCadastro,
        endereco: { // Endereço inicial vazio
          rua: '',
          numero: '',
          bairro: '',
          complemento: ''
        },
        criadoEm: new Date(),
      });

      alert('Cadastro realizado com sucesso! Você está logado.');
      setMostrarCadastroCliente(false); // Fecha o modal de cadastro
      setEmailCadastro('');
      setSenhaCadastro('');
      setNomeCadastro('');
      setTelefoneCadastro('');

      if (location.state?.from) {
        navigate(location.state.from, { replace: true }); // Redireciona para o caminho de origem
      } else {
        navigate('/'); // Se não houver 'from' (cadastro direto da Home), navega para a Home
      }
    } catch (error) {
      console.error("Erro no cadastro:", error);
      let errorMessage = 'Erro ao cadastrar. Por favor, tente novamente.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Este email já está cadastrado. Tente fazer login ou use outro email.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'A senha é muito fraca. Ela deve ter pelo menos 6 caracteres.';
      }
      alert(`Erro: ${errorMessage}`);
    }
  };


  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-white">
        <p className="text-[var(--marrom-escuro)]">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="relative bg-white min-h-screen">
      {/* HERO COM LOGO */}
      <section className="bg-[#fff8ec] py-16 text-center">
        <div className="container mx-auto px-4 flex flex-col items-center">
          <img
            src={logo}
            alt="Logo DeuFome"
            className="w-48 md:w-64 mb-6 drop-shadow-xl animate-pulse"
          />

          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <button
              onClick={() => {
                setMostrarLoginCliente(true); // Abre login cliente
                setMostrarLoginAdmin(false);
                setMostrarCadastroCliente(false);
                setEmailLogin(''); // Limpa campos ao abrir
                setSenhaLogin('');
              }}
              className="bg-[var(--vermelho-principal)] hover:bg-red-700 text-black font-bold py-3 px-6 rounded-full shadow-md"
            >
              Login Cliente
            </button>
            <button
              onClick={() => {
                setMostrarLoginAdmin(true); // Abre login admin
                setMostrarLoginCliente(false);
                setMostrarCadastroCliente(false);
                setEmailLogin(''); // Limpa campos ao abrir
                setSenhaLogin('');
              }}
              className="bg-gray-800 hover:bg-black text-white font-bold py-3 px-6 rounded-full shadow-md"
            >
              Login Administrador
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-6">
            Ainda não tem conta?{' '}
            <button
              onClick={() => {
                setMostrarCadastroCliente(true); // Abre o modal de cadastro
                setMostrarLoginCliente(false);
                setMostrarLoginAdmin(false);
                setEmailCadastro(''); // Limpa campos ao abrir
                setSenhaCadastro('');
                setNomeCadastro('');
                setTelefoneCadastro('');
              }}
              className="text-[var(--vermelho-principal)] underline focus:outline-none"
            >
              Cadastre-se
            </button>
          </p>

          {/* Pop-ups de Login (Modal) */}
          {(mostrarLoginCliente || mostrarLoginAdmin) && (
            <div className="fixed top-0 left-0 w-full h-full flex justify-center items-center bg-black bg-opacity-50 z-50">
              <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full relative">
                <button
                  onClick={() => {
                    setMostrarLoginCliente(false);
                    setMostrarLoginAdmin(false);
                  }}
                  className="absolute top-2 right-3 text-gray-600 hover:text-red-600 text-xl"
                >
                  &times;
                </button>

                {mostrarLoginCliente && (
                  <>
                    <h3 className="text-xl font-bold text-center mb-4">Login do Cliente</h3>
                    <form onSubmit={handleLoginCliente} className="space-y-4">
                      <input type="email" name="email" placeholder="Email" className="w-full border rounded p-2" value={emailLogin} onChange={(e) => setEmailLogin(e.target.value)} required />
                      <input type="password" name="senha" placeholder="Senha" className="w-full border rounded p-2" value={senhaLogin} onChange={(e) => setSenhaLogin(e.target.value)} required />
                      <button type="submit" className="w-full bg-[var(--vermelho-principal)] py-2 rounded hover:bg-red-700">
                        Entrar
                      </button>
                    </form>
                  </>
                )}

                {mostrarLoginAdmin && (
                  <>
                    <h3 className="text-xl font-bold text-center mb-4">Login do Administrador</h3>
                    <form onSubmit={handleLoginAdmin} className="space-y-4">
                      <input type="email" name="email" placeholder="Email" className="w-full border rounded p-2" value={emailLogin} onChange={(e) => setEmailLogin(e.target.value)} required />
                      <input type="password" name="senha" placeholder="Senha" className="w-full border rounded p-2" value={senhaLogin} onChange={(e) => setSenhaLogin(e.target.value)} required />
                      <button type="submit" className="w-full bg-gray-800 text-white py-2 rounded hover:bg-black">
                        Entrar
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Pop-up de Cadastro do Cliente */}
          {mostrarCadastroCliente && (
            <div className="fixed top-0 left-0 w-full h-full flex justify-center items-center bg-black bg-opacity-50 z-50">
              <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full relative">
                <button
                  onClick={() => setMostrarCadastroCliente(false)}
                  className="absolute top-2 right-3 text-gray-600 hover:text-red-600 text-xl"
                >
                  &times;
                </button>
                <h3 className="text-xl font-bold text-center mb-4">Cadastro de Cliente</h3>
                <form onSubmit={handleCadastroCliente} className="space-y-4">
                  <input
                    type="text"
                    placeholder="Seu Nome Completo"
                    className="w-full border rounded p-2"
                    value={nomeCadastro}
                    onChange={(e) => setNomeCadastro(e.target.value)}
                    required
                  />
                  <input
                    type="tel"
                    placeholder="Seu Telefone (com DDD)"
                    className="w-full border rounded p-2"
                    value={telefoneCadastro}
                    onChange={(e) => setTelefoneCadastro(e.target.value)}
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    className="w-full border rounded p-2"
                    value={emailCadastro}
                    onChange={(e) => setEmailCadastro(e.target.value)}
                    required
                  />
                  <input
                    type="password"
                    placeholder="Senha (mín. 6 caracteres)"
                    className="w-full border rounded p-2"
                    value={senhaCadastro}
                    onChange={(e) => setSenhaCadastro(e.target.value)}
                    required
                  />
                  <button type="submit" className="w-full bg-[var(--vermelho-principal)] text-white py-2 rounded hover:bg-red-700">
                    Cadastrar e Entrar
                  </button>
                </form>
              </div>
            </div>
          )}


          <h1 className="text-4xl md:text-5xl font-bold text-[var(--marrom-escuro)] mt-8 mb-4">
            Tá com fome? Deixa com a gente!
          </h1>
          <p className="text-lg text-gray-700 max-w-xl mb-6">
            Peça dos melhores restaurantes, lanchonetes e açaís com poucos cliques.
          </p>
        </div>
      </section>

      {/* ESTABELECIMENTOS EM DESTAQUE */}
      <section className="container mx-auto my-12 px-4">
        <h2 className="text-3xl font-bold text-[var(--marrom-escuro)] mb-8 text-center">Estabelecimentos em Destaque</h2>
        {loadingEstabelecimentos ? (
          <p className="text-center text-[var(--marrom-escuro)]">Carregando estabelecimentos...</p>
        ) : errorEstabelecimentos ? (
          <p className="text-center text-red-500">{errorEstabelecimentos}</p>
        ) : estabelecimentosDestaque.length === 0 ? (
          <p className="text-center text-gray-600">Nenhum estabelecimento em destaque encontrado.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {estabelecimentosDestaque.map((estabelecimento) => (
              <div key={estabelecimento.id} className="block">
                <Link to={`/cardapios/${estabelecimento.slug}`} className="block">
                  <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition duration-300 transform hover:-translate-y-1 w-full max-w-xs mx-auto">
                    <div className="h-36 overflow-hidden">
                      <img
                        src={estabelecimento.imageUrl || '/default-img.jpg'}
                        alt={estabelecimento.nome}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-4 space-y-1">
                      <h3 className="text-lg font-semibold text-gray-800 truncate">{estabelecimento.nome}</h3>
                      <div className="flex items-center gap-1 text-yellow-500 text-sm">
                        {'⭐'.repeat(Math.round(estabelecimento.rating || 0))}
                        <span className="text-gray-600 ml-1">({estabelecimento.rating?.toFixed(1) || 'N/A'})</span>
                      </div>
                    </div>
                  </div>
                </Link>
                <div className="mt-2 text-right max-w-xs mx-auto">
                  <a
                    href={`https://wa.me/${whatsappNumber}?text=${messageSuporteAdmin}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[var(--vermelho-principal)] underline"
                  >
                    Falar com o suporte
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Home;