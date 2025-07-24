// src/components/Layout.jsx
import React from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom"; // Importe useLocation
import { useAuth } from "../context/AuthContext";
import { toast } from 'react-toastify';

function Layout() {
  const navigate = useNavigate();
  const location = useLocation(); // Obtenha o objeto location para verificar a rota atual

  // === ALTERAÇÃO AQUI: Troquei 'signOutUser' por 'logout' ===
  const { currentUser, currentClientData, isAdmin, isMasterAdmin, logout } = useAuth();

  // NOVO: Verifica se a rota atual é uma rota de cardápio
  const isCardapioRoute = location.pathname.startsWith('/cardapio/');
  const isGenericCardapiosList = location.pathname === '/cardapio';

  const handleLogout = async () => {
    try {
      // === ALTERAÇÃO AQUI: Chamei 'logout()' em vez de 'signOutUser()' ===
      await logout();
      toast.info('Você foi desconectado.');
      navigate(location.pathname); // Permanece na mesma página, mas deslogado
    } catch (error) {
      console.error("Erro ao deslogar:", error);
      toast.error('Não foi possível fazer logout. Tente novamente.');
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Cabeçalho/Navegação */}
      <header className="bg-gray-800 text-white p-4 flex justify-between items-center">
        <Link to="/" className="text-xl font-bold">
          DeuFome
        </Link>
        <nav>
          {currentUser ? ( // Se há um usuário logado
            <div className="flex items-center gap-4">
              <span className="text-sm">Olá, {currentClientData?.nome || currentUser.email}!</span>
              
              {/* Links de navegação para usuários logados */}
              {isMasterAdmin && (
                <Link to="/master-dashboard" className="hover:text-gray-300">Master Dashboard</Link>
              )}
              {isAdmin && !isMasterAdmin && (
                <Link to="/painel" className="hover:text-gray-300">Painel de Pedidos</Link>
              )}
              {/* Links comuns para usuários logados, mesmo se forem admins */}
              {!isCardapioRoute && !isGenericCardapiosList && ( // Oculta "Cardápios" se já estiver na página de cardápio
                <Link to="/cardapios" className="hover:text-gray-300">Cardápios</Link>
              )}
              
              <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded">
                Sair
              </button>
            </div>
          ) : ( // Se NÃO há um usuário logado
            // MUDANÇA AQUI: Oculta o botão "Login Admin" em páginas de cardápio
            // Ou, se houver um login de cliente, ele apareceria aqui.
            !isCardapioRoute && !isGenericCardapiosList && (
              <Link to="/login-admin" className="bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded">
                Login Admin
              </Link>
            )
            // Se você tivesse um login para clientes comuns:
            // <Link to="/login-cliente" className="bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded">
            //   Login/Cadastro
            // </Link>
          )}
        </nav>
      </header>

      {/* Conteúdo Principal (rotas aninhadas serão renderizadas aqui) */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Rodapé (opcional) */}
      <footer className="bg-gray-800 text-white p-4 text-center">
        &copy; {new Date().getFullYear()} DeuFome. Todos os direitos reservados.
      </footer>
    </div>
  );
}

export default Layout;