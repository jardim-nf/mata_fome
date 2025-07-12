/* eslint-disable no-unused-vars */
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Header() {
  const { currentUser, isAdmin, logout } = useAuth(); 
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/'); 
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  return (
    <header className="bg-white text-[var(--marrom-escuro)] p-4 shadow-md sticky top-0 z-50"> 
      <div className="container mx-auto flex justify-between items-center">
        {/* Logo/Nome do App - cor vermelha vibrante */}
        <Link to="/" className="text-2xl font-bold text-[var(--vermelho-principal)] hover:text-red-700 transition duration-300 ml-6 sm:ml-0">
          Mata Fome
        </Link>

        {/* Navegação Principal */}
        <nav>
          <ul className="flex space-x-6 items-center">
            <li>
              <Link to="/cardapios" className="hover:text-[var(--vermelho-principal)] transition duration-300">
                Estabelecimentos
              </Link>
            </li>
            
            <li>
              <Link to="/planos" className="hover:text-[var(--vermelho-principal)] transition duration-300">
                Planos
              </Link>
            </li>

            {/* Renderização Condicional dos Botões de Login/Painel */}
            {currentUser ? (
              <>
                <li>
                  {/* MUDANÇA AQUI: Se for admin, Dashboard. Se for cliente, Cardápio. */}
                  {isAdmin ? (
                    <Link to="/dashboard" className="hover:text-[var(--vermelho-principal)] transition duration-300">
                      Dashboard
                    </Link>
                  ) : (
                    <Link to="/cardapios" className="hover:text-[var(--vermelho-principal)] transition duration-300">
                      Cardápio {/* Texto alterado */}
                    </Link>
                  )}
                </li>
                <li>
                  <button 
                    onClick={handleLogout} 
                    className="bg-[var(--vermelho-principal)] px-4 py-2 rounded-full text-sm font-semibold text-white hover:bg-red-700 transition duration-300"
                  >
                    Sair
                  </button>
                </li>
              </>
            ) : (
              <>
                {/* Botões de login/admin quando não logado (removidos na Home.jsx) */}
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}

export default Header;
/* eslint-enable no-unused-vars */