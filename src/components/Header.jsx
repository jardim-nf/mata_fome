// src/components/Header.jsx
import React from 'react';
import { Link } from 'react-router-dom';

const Header = () => {
  return (
    <header className="bg-white shadow-md py-4 px-6 flex justify-between items-center">
      <Link to="/" className="text-2xl font-bold text-black">
        DeuFome
      </Link>
      <nav className="space-x-6">
        <Link to="/cardapios" className="text-black hover:text-red-600">
          Estabelecimentos
        </Link>
        <Link to="/planos" className="text-black hover:text-red-600">
          Planos
        </Link>
      </nav>
    </header>
  );
};

export default Header;
