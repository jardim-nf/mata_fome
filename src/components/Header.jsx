// src/components/Header.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../App.css';

function Header() {
  const { currentUser, logout, currentClientData } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
      console.log('Usuário deslogado e redirecionado para a página inicial.');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      alert('Ocorreu um erro ao tentar sair. Por favor, tente novamente.');
    }
  };

  return (
    <header className="bg-[var(--cor-fundo-claro)] text-[var(--cor-texto-escuro)] p-4 shadow-md sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold text-[var(--cor-de-destaque-principal)] hover:text-[var(--cor-secundaria-laranja)] transition duration-300">
          DeuFome
        </Link>

        <nav>
          <ul className="flex space-x-6 items-center">
            {!currentUser && (
              <>
                <li>
                  <Link to="/cardapios" className="hover:text-[var(--cor-de-destaque-principal)] transition duration-300">
                    Estabelecimentos
                  </Link>
                </li>
                <li>
                  <Link to="/planos" className="hover:text-[var(--cor-de-destaque-principal)] transition duration-300">
                    Planos
                  </Link>
                </li>
              </>
            )}

            {currentUser ? (
              <>
                {currentClientData?.isAdmin ? (
                  <>
                    <li>
                      <Link to="/dashboard" className="hover:text-[var(--cor-de-destaque-principal)] transition duration-300">
                        Dashboard
                      </Link>
                    </li>
                    <li>
                      <Link to="/painel" className="hover:text-[var(--cor-de-destaque-principal)] transition duration-300">
                        Painel
                      </Link>
                    </li>
                  </>
                ) : (
                  null
                )}
                <li>
                  <button
                    onClick={handleLogout}
                    // AQUI ESTÁ A CLASSE QUE CAUSOU O ERRO. COLOQUEI EXATAMENTE COMO DEVERIA SER.
                    className="bg-[var(--cor-de-destaque-principal)] px-4 py-2 rounded-full text-sm font-semibold hover:bg-[var(--cor-secundaria-laranja)] text-[var(--cor-texto-escuro)] transition duration-300"
                  >
                    Sair
                  </button>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link to="/login-cliente" className="hover:text-[var(--cor-de-destaque-principal)] transition duration-300">
                    Login Cliente
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}

export default Header;