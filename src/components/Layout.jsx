// src/components/Layout.jsx
import React from 'react';
import Header from './Header';
import Footer from './Footer';

function Layout({ children }) {
  return (
    <>
      <Header />
      <main className="flex-grow"> {/* Adicionado flex-grow para que o conteúdo preencha o espaço */}
        {children}
      </main>
      <Footer />
    </>
  );
}

export default Layout;