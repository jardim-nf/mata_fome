import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; 
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'; 
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'; // Importar doc e getDoc
import { auth, db } from '../firebase'; 
import "../App.css"; // Importar o CSS global 
function Home() {
  const { currentUser, authLoading } = useAuth(); 
  const navigate = useNavigate();

  // Estados para o card de login do CLIENTE
  const [showClientLoginCard, setShowClientLoginCard] = useState(false); // Renomeado para cliente
  const [clientEmail, setClientEmail] = useState(''); // Renomeado
  const [clientPassword, setClientPassword] = useState(''); // Renomeado
  const [clientLoginError, setClientLoginError] = useState(''); // Renomeado
  const [loadingClientLogin, setLoadingClientLogin] = useState(false); // Renomeado

  // <<-- NOVOS ESTADOS PARA O CARD DE LOGIN DO ADMINISTRADOR -->>
  const [showAdminLoginCard, setShowAdminLoginCard] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');
  const [loadingAdminLogin, setLoadingAdminLogin] = useState(false);

  // Estados para os estabelecimentos em destaque
  const [estabelecimentosDestaque, setEstabelecimentosDestaque] = useState([]);
  const [loadingEstabelecimentos, setLoadingEstabelecimentos] = useState(true);
  const [errorEstabelecimentos, setErrorEstabelecimentos] = useState('');

  // Função para alternar a visibilidade do card de login do cliente
  const toggleClientLoginCard = () => { // Renomeado
    setShowClientLoginCard(!showClientLoginCard);
    setClientLoginError(''); 
    setClientEmail(''); 
    setClientPassword(''); 
  };

  // <<-- NOVA FUNÇÃO PARA ALTERNAR VISIBILIDADE DO CARD DE LOGIN DO ADMINISTRADOR -->>
  const toggleAdminLoginCard = () => {
    setShowAdminLoginCard(!showAdminLoginCard);
    setAdminLoginError('');
    setAdminEmail('');
    setAdminPassword('');
  };

  // Função para lidar com o login do CLIENTE (usado no card da Home)
  const handleClientLogin = async (e) => { // Renomeado
    e.preventDefault();
    setLoadingClientLogin(true);
    setClientLoginError('');

    try {
      await signInWithEmailAndPassword(auth, clientEmail, clientPassword); // Usando clientEmail e clientPassword
      setShowClientLoginCard(false); 
      navigate('/'); 
    } catch (error) {
      console.error("Erro ao fazer login do cliente:", error);
      let errorMessage = "Email ou senha incorretos.";
      if (error.code === 'auth/invalid-email') {
        errorMessage = "Formato de email inválido.";
      }
      setClientLoginError(errorMessage);
    } finally {
      setLoadingClientLogin(false);
    }
  };

  // <<-- NOVA FUNÇÃO PARA LIDAR COM O LOGIN DO ADMINISTRADOR -->>
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoadingAdminLogin(true);
    setAdminLoginError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      const user = userCredential.user;

      // Verifica se o usuário é um administrador (busca no Firestore)
      const userDocRef = doc(db, 'usuarios', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists() && userDocSnap.data()?.isAdmin) {
        setShowAdminLoginCard(false); // Fecha o card de login
        navigate('/dashboard'); // Redireciona para o Dashboard
      } else {
        // Não é admin, faz logout
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


  // Efeito para buscar estabelecimentos em destaque (mantido)
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
      } catch (err) {
        console.error("Erro ao buscar estabelecimentos:", err);
        setErrorEstabelecimentos("Não foi possível carregar os estabelecimentos em destaque.");
      } finally {
        setLoadingEstabelecimentos(false);
      }
    };

    fetchEstabelecimentosDestaque();
  }, []);

  // Espera o AuthContext carregar antes de renderizar o conteúdo principal
  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-[var(--bege-claro)]">
        <p className="text-[var(--marrom-escuro)]">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="relative bg-[var(--bege-claro)] min-h-screen"> 
      
      {/* Seção Hero: Fundo vermelho principal */}
      <section className="bg-[var(--vermelho-principal)] text-white py-20 text-center">
        <div className="container mx-auto">
          <h1 className="text-5xl font-bold mb-4">Mata Fome</h1>
          <p className="text-xl mb-8">Seu delivery favorito, rápido e fácil!</p>
          {/* O botão de login/cadastro principal agora está abaixo do Hero */}
        </div>
      </section>

      {/* Nova Seção: Escolha de Usuário */}
      {!currentUser && ( // Só mostra esta seção se não houver usuário logado
        <section className="container mx-auto mt-[-40px] mb-12 px-4 relative z-10"> {/* Margem negativa para sobrepor um pouco o Hero */}
          <div className="bg-white p-8 rounded-lg shadow-xl grid grid-cols-1 md:grid-cols-2 gap-8 text-center">
            {/* Opção Cliente */}
            <div className="flex flex-col items-center p-4">
              <h3 className="text-2xl font-bold text-[var(--marrom-escuro)] mb-4">Você é cliente?</h3>
              <p className="text-[var(--cinza-texto)] mb-6">Peça sua comida favorita em poucos cliques!</p>
              <button
                onClick={toggleClientLoginCard} // <<-- ALTERADO -->>
                className="bg-[var(--vermelho-principal)] text-white px-8 py-3 rounded-full text-lg font-semibold hover:bg-red-700 transition duration-300 shadow-md"
              >
                Fazer Login
              </button>
              <Link to="/login-cliente" className="text-[var(--vermelho-principal)] hover:underline mt-4">
                Não tem conta? Cadastre-se
              </Link>
            </div>
            
            {/* Divisor vertical (apenas para desktop) */}
            <div className="hidden md:block w-px bg-gray-300 mx-auto"></div> {/* Linha divisória */}

            {/* Opção Administrador */}
            <div className="flex flex-col items-center p-4">
              <h3 className="text-2xl font-bold text-[var(--marrom-escuro)] mb-4">Você é administrador?</h3>
              <p className="text-[var(--cinza-texto)] mb-6">Gerencie seus pedidos e seu negócio!</p>
              <button // <<-- ALTERADO: AGORA É UM BOTÃO QUE ABRE O CARD -->>
                onClick={toggleAdminLoginCard} 
                className="bg-[var(--marrom-escuro)] text-white px-8 py-3 rounded-full text-lg font-semibold hover:bg-gray-700 transition duration-300 shadow-md"
              >
                Acessar Painel
              </button>
              {/* Opcional: Link para cadastro de admin se for aberto (o Login.jsx pode ser só para admin register) */}
              <Link to="/login-admin" className="text-[var(--marrom-escuro)] hover:underline mt-4">
                Cadastrar Admin
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Card de Login do Cliente (aparece sobreposto) */}
      {showClientLoginCard && !currentUser && ( // Renomeado showLoginCard para showClientLoginCard
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full relative">
            <button
              onClick={toggleClientLoginCard} // Renomeado
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl"
            >
              &times; 
            </button>
            <h2 className="text-2xl font-bold text-[var(--marrom-escuro)] mb-6 text-center">Login do Cliente</h2>
            <form onSubmit={handleClientLogin}> {/* Renomeado */}
              <div className="mb-4">
                <label htmlFor="clientEmail" className="block text-gray-700 text-sm font-bold mb-2"> {/* Renomeado id */}
                  Email:
                </label>
                <input
                  type="email"
                  id="clientEmail" // Renomeado id
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  value={clientEmail} // Renomeado
                  onChange={(e) => setClientEmail(e.target.value)} // Renomeado
                  required
                />
              </div>
              <div className="mb-6">
                <label htmlFor="clientPassword" className="block text-gray-700 text-sm font-bold mb-2"> {/* Renomeado id */}
                  Senha:
                </label>
                <input
                  type="password"
                  id="clientPassword" // Renomeado id
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
                  value={clientPassword} // Renomeado
                  onChange={(e) => setClientPassword(e.target.value)} // Renomeado
                  required
                />
              </div>
              {clientLoginError && ( // Renomeado
                <p className="text-red-500 text-xs italic mb-4 text-center">{clientLoginError}</p> // Renomeado
              )}
              <div className="flex items-center justify-between">
                <button
                  type="submit"
                  className="bg-[var(--vermelho-principal)] hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full focus:outline-none focus:shadow-outline w-full"
                  disabled={loadingClientLogin} // Renomeado
                >
                  {loadingClientLogin ? 'Entrando...' : 'Entrar'} {/* Renomeado */}
                </button>
              </div>
            </form>
            <p className="text-center text-sm text-gray-600 mt-4">
              Não tem uma conta?{' '}
              <Link to="/login-cliente" className="text-[var(--vermelho-principal)] hover:underline" onClick={toggleClientLoginCard}>
                Cadastre-se aqui
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* <<-- NOVO CARD DE LOGIN DO ADMINISTRADOR (aparece sobreposto) -->> */}
      {showAdminLoginCard && !currentUser && ( 
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full relative">
            <button
              onClick={toggleAdminLoginCard} 
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
              <Link to="/login-admin" className="text-[var(--marrom-escuro)] hover:underline" onClick={toggleAdminLoginCard}>
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