// src/pages/Home.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import logo from '../assets/logo-deufome.png';


function Home() {
  const { currentUser, authLoading, currentClientData } = useAuth();
  const navigate = useNavigate();

  const whatsappNumber = "5511999999999";
  const messageSuporteAdmin = encodeURIComponent("Olá, estou com dificuldades para acessar/cadastrar como administrador no DeuFome. Poderiam me ajudar?");

  const [estabelecimentosDestaque, setEstabelecimentosDestaque] = useState([]);
  const [loadingEstabelecimentos, setLoadingEstabelecimentos] = useState(true);
  const [errorEstabelecimentos, setErrorEstabelecimentos] = useState('');

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
            setErrorEstabelecimentos("Nenhum estabelecimento em destaque encontrado.");
        }
      } catch (err) {
        console.error("Erro ao buscar estabelecimentos:", err);
        setErrorEstabelecimentos("Não foi possível carregar os estabelecimentos em destaque.");
      } finally {
        setLoadingEstabelecimentos(false);
      }
    };

    fetchEstabelecimentosDestaque();
  }, []);

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
          <div className="flex flex-col md:flex-row gap-4 mb-2">
            <Link
              to="/logincliente"
              className="bg-[var(--vermelho-principal)] hover:bg-red-700 text-white font-bold py-3 px-6 rounded-full shadow-md"
            >
              Login Cliente
            </Link>
            <Link
              to="/painel"
              className="bg-gray-800 hover:bg-black text-white font-bold py-3 px-6 rounded-full shadow-md"
            >
              Login Administrador
            </Link>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            Ainda não tem conta? <Link to="/logincliente" className="text-[var(--vermelho-principal)] underline">Cadastre-se</Link>
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--marrom-escuro)] mb-4">
            Tá com fome? Deixa com a gente!
          </h1>
          <p className="text-lg text-gray-700 max-w-xl mb-6">
            Peça dos melhores restaurantes, lanchonetes e açaís com poucos cliques.
          </p>
          <a
            href="/cardapios"
            className="bg-[var(--vermelho-principal)] text-white px-8 py-3 rounded-full font-semibold hover:bg-red-700 transition duration-300 shadow-md"
          >
            Ver Estabelecimentos
          </a>

          {/* Animações visuais */}
          <div className="mt-10 flex gap-10 items-center justify-center">
            <img src={clienteIcon} alt="Cliente com fome" className="w-24 animate-bounce" />
            <img src={cozinhaIcon} alt="Cozinheiro animado" className="w-24 animate-spin-slow" />
          </div>
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
              <Link to={`/cardapio/${estabelecimento.id}`} key={estabelecimento.id} className="block">
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
                    <div className="mt-2 text-right">
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
