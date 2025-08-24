// src/components/Layout.jsx
import React from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from 'react-toastify';

function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser, currentClientData, isAdmin, isMasterAdmin, logout } = useAuth();

    // ========================================================================
    // CORREÇÃO APLICADA AQUI
    // ========================================================================
    // Unificamos todas as rotas que não devem ter o menu em uma única lista.
    // Verifique se os caminhos '/admin-dashboard' e '/admin/taxas-de-entrega' estão corretos.
    const rotasSemCabecalho = [
        '/admin/reports',
        '/admin-dashboard',
        '/admin/cupons',
        '/admin/gerenciar-cardapio',
        '/admin/taxas-de-entrega', // Adicione a rota correta da sua página de taxas aqui
    ];

    // A lógica agora verifica se a rota atual está nesta lista unificada.
    const exibirCabecalho = !rotasSemCabecalho.includes(location.pathname);
    // ========================================================================

    const isCardapioRoute = location.pathname.startsWith('/cardapio/');
    const isGenericCardapiosList = location.pathname === '/cardapio';

    let homeLink = "/";
    if (currentUser) {
        if (isMasterAdmin) {
            homeLink = "/master-dashboard";
        } else if (isAdmin) {
            homeLink = "/admin-dashboard";
        }
    }

    const handleLogout = async () => {
        try {
            await logout();
            toast.info('Você foi desconectado.');
            navigate('/login');
        } catch (error) {
            console.error("Erro ao deslogar:", error);
            toast.error('Não foi possível fazer logout.');
        }
    };

    return (
        <div className="flex flex-col min-h-screen">
            {/* O cabeçalho só é renderizado se a rota não estiver na lista de exceções */}
            {exibirCabecalho && (
                <header className="bg-gray-800 text-white p-4 flex justify-between items-center">
                    <Link to={homeLink} className="text-xl font-bold">
                        DeuFome
                    </Link>
                    <nav>
                        {currentUser ? (
                            <div className="flex items-center gap-4">
                                <span className="text-sm">Olá, {currentClientData?.nome || currentUser.email}!</span>
                                {isMasterAdmin && (
                                    <Link to="/master-dashboard" className="hover:text-gray-300">Master Dashboard</Link>
                                )}
                                {isAdmin && !isMasterAdmin && (
                                    <Link to="/admin-dashboard" className="hover:text-gray-300">Dashboard</Link>
                                )}
                                {!isCardapioRoute && !isGenericCardapiosList && (
                                    <Link to="/cardapios" className="hover:text-gray-300">Cardápios</Link>
                                )}
                                <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded">
                                    Sair
                                </button>
                            </div>
                        ) : (
                            !isCardapioRoute && !isGenericCardapiosList && (
                                <Link to="/login-admin" className="bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded">
                                    Login Admin
                                </Link>
                            )
                        )}
                    </nav>
                </header>
            )}

            <main className="flex-grow">
                <Outlet />
            </main>

            {/* O rodapé também pode ser condicional se você quiser */}
            {exibirCabecalho && (
                <footer className="bg-gray-800 text-white p-4 text-center">
                    &copy; {new Date().getFullYear()} DeuFome. Todos os direitos reservados.
                </footer>
            )}
        </div>
    );
}

export default Layout;