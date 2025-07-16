// src/components/Layout.jsx
import React from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify'; // Importe o toast aqui!

function Layout() {
  const { logout, currentUser, currentClientData, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Você foi desconectado!'); // Substituição do alert()
      navigate('/'); // Redireciona para a tela inicial após o logout
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      toast.error('Erro ao sair. Tente novamente.'); // Substituição do alert()
    }
  };

  // Determine o nome a ser exibido: nome do cliente (se existir) ou email do usuário
  const displayName = currentUser
    ? (currentClientData?.nome || currentUser.email)
    : '';

  return (
    <div className="flex flex-col min-h-screen">
      {/* Cabeçalho do seu layout */}
      <header className="bg-white shadow-md py-4">
        <nav className="container mx-auto flex justify-between items-center px-4">
          <Link to="/" className="text-xl sm:text-2xl font-bold text-[var(--marrom-escuro)] flex-shrink-0">DeuFome</Link>
          <div className="flex flex-col sm:flex-row items-center sm:space-x-4 space-y-2 sm:space-y-0 ml-4 sm:ml-0"> {/* Ajustes para responsividade do cabeçalho */}
            {/* Outros links de navegação aqui */}
            <Link to="/cardapios" className="text-sm sm:text-base text-gray-700 hover:text-[var(--vermelho-principal)] px-2 py-1 rounded-md">
              Estabelecimentos
            </Link>
            
            {/* Condicionalmente renderiza o link "Planos" apenas para admins */}
            {isAdmin && (
              <Link to="/planos" className="text-gray-700 hover:text-[var(--vermelho-principal)] px-2 py-1 rounded-md">
                Planos
              </Link>
            )}

            {currentUser && ( // Mostra o nome e o botão de Sair apenas se houver um usuário logado
              <div className="flex flex-col sm:flex-row items-center space-y-1 sm:space-y-0 sm:space-x-4 w-full sm:w-auto"> {/* Garante que o nome e o botão Sair se ajustem */}
                {displayName && ( // Exibe o nome se ele existir
                  <span className="text-xs sm:text-sm text-gray-600 font-semibold truncate max-w-[150px] sm:max-w-none">Olá, {displayName}!</span> {/* Truncate para e-mails longos */}
                )}
                    <Link to="/historico-pedidos" className="text-gray-700 hover:text-[var(--vermelho-principal)] px-2 py-1 rounded-md">
                      Meus Pedidos
    </Link>
                <button
                  onClick={handleLogout}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md font-semibold"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* Conteúdo principal renderizado pelas rotas filhas */}
      <main className="flex-grow">
        <Outlet /> 
      </main>

      {/* Rodapé do seu layout */}
      <footer className="bg-[var(--marrom-escuro)] text-white py-6 text-center">
        <div className="container mx-auto px-4">
          © 2025 DeuFome. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}

export default Layout;