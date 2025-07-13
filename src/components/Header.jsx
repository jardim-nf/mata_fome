// src/components/Header.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../App.css';

function Header() {
  const { currentUser, logout, currentClientData } = useAuth(); // Adicionado currentClientData

  return (
    <header className="bg-white text-white p-4 shadow-md sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold text-[var(--vermelho-principal)] hover:text-red-400 transition duration-300">
          Mata Fome
        </Link>

        <nav>
          <ul className="flex space-x-6 items-center">
            {/* Só mostra estes links se não houver usuário logado */}
            {!currentUser && (
              <>
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
              </>
            )}

            {/* Bloco de login/logout/painel */}
            {currentUser ? (
              // Se houver um usuário logado
              <>
                {currentClientData?.isAdmin ? ( // Se o usuário logado É um ADMINISTRADOR
                  <>
                    <li>
                      <Link to="/dashboard" className="hover:text-[var(--vermelho-principal)] transition duration-300">
                        Dashboard
                      </Link>
                    </li>
                    <li>
                      <Link to="/painel" className="hover:text-[var(--vermelho-principal)] transition duration-300">
                        Painel
                      </Link>
                    </li>
                  </>
                ) : (
                  // Se o usuário logado é APENAS um CLIENTE COMUM (não admin)
                  null // Não mostra Dashboard ou Painel
                )}
                {/* Botão de Sair (sempre visível quando logado) */}
                <li>
                  <button
                    onClick={logout}
                    className="bg-[var(--vermelho-principal)] px-4 py-2 rounded-full text-sm font-semibold hover:bg-red-700 transition duration-300"
                  >
                    Sair
                  </button>
                </li>
              </>
            ) : (
              // Se não houver usuário logado
              <>
                <li>
                  <Link to="/login-cliente" className="hover:text-[var(--vermelho-principal)] transition duration-300">
                    Login Cliente
                  </Link>
                </li>
                {/* REMOVIDO: O botão Login Admin estava aqui */}
                {/*
                <li>
                  <Link to="/login-admin" className="bg-[var(--vermelho-principal)] px-4 py-2 rounded-full text-sm font-semibold hover:bg-red-700 transition duration-300">
                    Login Admin
                  </Link>
                </li>
                */}
              </>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}

export default Header;