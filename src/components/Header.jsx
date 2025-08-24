import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IoArrowBack } from 'react-icons/io5'; // Um ícone moderno para o botão "Voltar"

const Header = () => {
    const { currentUser, logout, isAdmin, isMasterAdmin } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error("Falha ao fazer logout:", error);
        }
    };

    // O botão "Voltar" não aparecerá nos dashboards principais
    const isDashboardPage = location.pathname === '/admin-dashboard' || location.pathname === '/master-dashboard';

    return (
        <header className="bg-gray-900 text-white shadow-lg">
            <div className="container mx-auto flex justify-between items-center p-4">
                <div className="flex items-center space-x-4">
                    {/* Botão Voltar Condicional */}
                    {!isDashboardPage && (
                        <button 
                            onClick={() => navigate(-1)} 
                            className="text-white hover:text-gray-300 transition-colors"
                            aria-label="Voltar"
                        >
                            <IoArrowBack size={24} />
                        </button>
                    )}
                    <Link to="/" className="text-xl font-bold tracking-wider">
                        Deu Fome.
                    
                    </Link>
                </div>
                <nav className="flex items-center space-x-4">
                    {currentUser ? (
                        <>
                            {isAdmin && !isMasterAdmin && (
                                <Link to="/admin-dashboard" className="font-semibold hover:text-gray-300">Dashboard</Link>
                            )}
                            {isMasterAdmin && (
                                <Link to="/master-dashboard" className="font-semibold hover:text-gray-300">Master</Link>
                            )}
                            <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition-colors">
                                Sair
                            </button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="font-semibold hover:text-gray-300">Login Cliente</Link>
                            <Link to="/login-admin" className="font-semibold hover:text-gray-300">Login Admin</Link>
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
};

export default Header;