// src/pages/Home.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import logo from '../assets/logo-deufome.png';
import { toast } from 'react-toastify';

function Home() {
  const { authLoading, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const whatsappNumber = "5522999822324"; // Este número precisa ser do seu negócio
  const messageSuporteAdmin = encodeURIComponent("Olá, estou com dificuldades para acessar/cadastrar como administrador no DeuFome. Poderiam me ajudar?");

  const [estabelecimentosDestaque, setEstabelecimentosDestaque] = useState([]);
  const [loadingEstabelecimentos, setLoadingEstabelecimentos] = useState(true);
  const [errorEstabelecimentos, setErrorEstabelecimentos] = useState('');
  const [mostrarLoginCliente, setMostrarLoginCliente] = useState(false);
  const [mostrarLoginAdmin, setMostrarLoginAdmin] = useState(false);
  const [mostrarCadastroCliente, setMostrarCadastroCliente] = useState(false);

  // ESTADOS PARA OS FORMULÁRIOS DE LOGIN NO MODAL (OS QUE ESTAVAM FALTANDO)
  const [emailLogin, setEmailLogin] = useState(''); // <<-- ADICIONADO AQUI -->>
  const [senhaLogin, setSenhaLogin] = useState(''); // <<-- ADICIONADO AQUI -->>

  // Estados para o formulário de cadastro no modal
  const [emailCadastro, setEmailCadastro] = useState('');
  const [senhaCadastro, setSenhaCadastro] = useState('');
  const [nomeCadastro, setNomeCadastro] = useState('');
  const [telefoneCadastro, setTelefoneCadastro] = useState('');
  // <<-- NOVOS ESTADOS PARA ENDEREÇO NO CADASTRO -->>
  const [ruaCadastro, setRuaCadastro] = useState('');
  const [numeroCadastro, setNumeroCadastro] = useState('');
  const [bairroCadastro, setBairroCadastro] = useState('');
  const [complementoCadastro, setComplementoCadastro] = useState('');


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
        toast.error("Erro ao carregar estabelecimentos em destaque. Tente novamente mais tarde.");
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
      toast.success('Login Cliente realizado com sucesso!');
      setMostrarLoginCliente(false);
      setEmailLogin('');
      setSenhaLogin('');

      if (location.state?.from) {
        navigate(location.state.from, { replace: true });
      } else {
        navigate('/');
      }
    } catch (error) {
      let errorMessage = "Erro ao fazer login. Verifique as credenciais.";
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Usuário não encontrado. Crie uma conta.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Senha incorreta.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Email inválido.';
      }
      toast.error(errorMessage);
      console.error("Erro no login do cliente:", error);
    }
  };

  // Função para lidar com o login do administrador no modal
  const handleLoginAdmin = async (e) => {
    e.preventDefault();
    try {
      // Nota: Para segurança, a verificação de isAdmin deve ser feita no backend (Cloud Functions)
      // ou em uma página protegida após o login, não apenas no frontend.
      // Aqui, estamos assumindo que /painel é uma rota protegida que verificará a permissão.
      await signInWithEmailAndPassword(auth, emailLogin, senhaLogin);
      
      // O ideal seria verificar o 'isAdmin' após o login BEM SUCEDIDO e em um contexto SEGURO
      // Por exemplo, após o redirect, ou usando um hook useAuth que carrega os dados do usuário.
      // Se essa Home.jsx é a única porta de entrada, e o /painel valida a permissão, pode ser ok por enquanto.
      toast.success('Login Administrador realizado com sucesso!');
      setMostrarLoginAdmin(false);
      setEmailLogin('');
      setSenhaLogin('');
      navigate('/painel'); // Redireciona para o painel do administrador
    } catch (error) {
      let errorMessage = "Erro ao fazer login. Verifique as credenciais.";
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Usuário não encontrado.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Senha incorreta.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Email inválido.';
      }
      toast.error(errorMessage);
      console.error("Erro no login do admin:", error);
    }
  };

  // Função para lidar com o cadastro do cliente no modal
  const handleCadastroCliente = async (e) => {
    e.preventDefault();
    // <<-- NOVA VALIDAÇÃO PARA CAMPOS DE ENDEREÇO -->>
    if (!nomeCadastro.trim() || !telefoneCadastro.trim() || !ruaCadastro.trim() || !numeroCadastro.trim() || !bairroCadastro.trim()) {
      toast.warn('Por favor, preencha todos os campos obrigatórios, incluindo o endereço completo.');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, emailCadastro, senhaCadastro);
      const user = userCredential.user;

      // SALVAR DADOS ADICIONAIS DO CLIENTE NO FIRESTORE
      await setDoc(doc(db, 'usuarios', user.uid), { // <-- ALTERADO PARA 'usuarios'
        nome: nomeCadastro.trim(),
        telefone: telefoneCadastro.trim(),
        email: emailCadastro.trim(),
        endereco: { // <<-- SALVA OS DADOS DO ENDEREÇO COLETADOS -->>
          rua: ruaCadastro.trim(),
          numero: numeroCadastro.trim(),
          bairro: bairroCadastro.trim(),
          complemento: complementoCadastro.trim()
        },
        isAdmin: false,       // Adicionado para definir o papel como cliente
        isMasterAdmin: false, // Adicionado para definir o papel como cliente
        criadoEm: new Date(),
      });

      toast.success('Cadastro realizado com sucesso! Você está logado.');
      setMostrarCadastroCliente(false);
      setEmailCadastro('');
      setSenhaCadastro('');
      setNomeCadastro('');
      setTelefoneCadastro('');
      setRuaCadastro(''); // Limpa campos de endereço
      setNumeroCadastro('');
      setBairroCadastro('');
      setComplementoCadastro('');

      if (location.state?.from) {
        navigate(location.state.from, { replace: true });
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error("Erro no cadastro:", error);
      let errorMessage = 'Erro ao cadastrar. Por favor, tente novamente.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Este email já está cadastrado. Tente fazer login ou use outro email.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'A senha é muito fraca. Ela deve ter pelo menos 6 caracteres.';
      }
      toast.error(`Erro: ${errorMessage}`);
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
                setMostrarLoginCliente(true);
                setMostrarLoginAdmin(false);
                setMostrarCadastroCliente(false);
                setEmailLogin(''); // Limpa os campos de login ao abrir o modal
                setSenhaLogin(''); // Limpa os campos de login ao abrir o modal
              }}
              className="bg-yellow-200 text-black hover:bg-yellow-700 text-black font-bold py-3 px-6 rounded-full shadow-md"
            >
              Login Cliente
            </button>
            <button
              onClick={() => {
                setMostrarLoginAdmin(true);
                setMostrarLoginCliente(false);
                setMostrarCadastroCliente(false);
                setEmailLogin(''); // Limpa os campos de login ao abrir o modal
                setSenhaLogin(''); // Limpa os campos de login ao abrir o modal
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
                setMostrarCadastroCliente(true);
                setMostrarLoginCliente(false);
                setMostrarLoginAdmin(false);
                // Limpa os campos de cadastro ao abrir o modal
                setEmailCadastro('');
                setSenhaCadastro('');
                setNomeCadastro('');
                setTelefoneCadastro('');
                setRuaCadastro('');
                setNumeroCadastro('');
                setBairroCadastro('');
                setComplementoCadastro('');
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
                      <button type="submit" className="w-full bg-[var(--vermelho-principal)] py-2 rounded hover:bg-red-700 text-white"> {/* Adicionei text-white aqui */}
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
                    placeholder="Seu Nome Completo *"
                    className="w-full border rounded p-2"
                    value={nomeCadastro}
                    onChange={(e) => setNomeCadastro(e.target.value)}
                    required
                  />
                  <input
                    type="tel"
                    placeholder="Seu Telefone (com DDD) *"
                    className="w-full border rounded p-2"
                    value={telefoneCadastro}
                    onChange={(e) => setTelefoneCadastro(e.target.value)}
                    required
                  />
                  {/* <<-- NOVOS CAMPOS DE ENDEREÇO NO FORMULÁRIO -->> */}
                  <div>
                    <label htmlFor="ruaCadastro" className="block text-sm font-medium text-gray-700 mb-1 sr-only">Rua *</label>
                    <input
                      type="text"
                      id="ruaCadastro"
                      placeholder="Rua *"
                      value={ruaCadastro}
                      onChange={(e) => setRuaCadastro(e.target.value)}
                      className="w-full border rounded p-2"
                      required
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label htmlFor="numeroCadastro" className="block text-sm font-medium text-gray-700 mb-1 sr-only">Número *</label>
                      <input
                        type="text"
                        id="numeroCadastro"
                        placeholder="Número *"
                        value={numeroCadastro}
                        onChange={(e) => setNumeroCadastro(e.target.value)}
                        className="w-full border rounded p-2"
                        required
                      />
                    </div>
                    <div className="flex-1">
                      <label htmlFor="bairroCadastro" className="block text-sm font-medium text-gray-700 mb-1 sr-only">Bairro *</label>
                      <input
                        type="text"
                        id="bairroCadastro"
                        placeholder="Bairro *"
                        value={bairroCadastro}
                        onChange={(e) => setBairroCadastro(e.target.value)}
                        className="w-full border rounded p-2"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="complementoCadastro" className="block text-sm font-medium text-gray-700 mb-1 sr-only">Complemento / Ponto de Referência</label>
                    <input
                      type="text"
                      id="complementoCadastro"
                      placeholder="Complemento / Ponto de Referência"
                      value={complementoCadastro}
                      onChange={(e) => setComplementoCadastro(e.target.value)}
                      className="w-full border rounded p-2"
                    />
                  </div>
                  {/* <<-- FIM DOS NOVOS CAMPOS DE ENDEREÇO -->> */}

                  <input
                    type="email"
                    placeholder="Email *"
                    className="w-full border rounded p-2"
                    value={emailCadastro}
                    onChange={(e) => setEmailCadastro(e.target.value)}
                    required
                  />
                  <input
                    type="password"
                    placeholder="Senha (mín. 6 caracteres) *"
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