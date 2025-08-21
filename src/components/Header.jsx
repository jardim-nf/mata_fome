// src/components/Header.jsx

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo-deufome.png';
import clienteIcon from '../assets/cliente-icon.gif';

const Header = () => {
    // Usamos o hook useAuth para saber o status do utilizador
    const { currentUser, currentClientData, logout, isAdmin, isMasterAdmin } = useAuth();
    const navigate = useNavigate();
    const [menuAberto, setMenuAberto] = useState(false);
    const menuRef = useRef(null);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/'); // Redireciona para a página inicial após o logout
        } catch (error) {
            console.error("Erro ao fazer logout:", error);
        }
    };

    // Efeito para fechar o menu se clicar fora dele
    useEffect(() => {
        const handleClickFora = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setMenuAberto(false);
            }
        };
        document.addEventListener("mousedown", handleClickFora);
        return () => {
            document.removeEventListener("mousedown", handleClickFora);
        };
    }, [menuRef]);

    const isCliente = currentUser && !isAdmin && !isMasterAdmin;

    return (
        <header className="bg-white shadow-md p-4 flex justify-between items-center sticky top-0 z-50">
            <div className="logo">
                <Link to="/">
                    <img src={logo} alt="DeuFome Logo" className="h-12" />
                </Link>
            </div>

            <nav className="flex items-center">
                {isCliente ? (
                    // Menu para CLIENTE LOGADO
                    <div className="relative" ref={menuRef}>
                        <button 
                            onClick={() => setMenuAberto(!menuAberto)} 
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                        >
                            <img src={clienteIcon} alt="Ícone do cliente" className="h-8 w-8 rounded-full object-cover" />
                            <span className="font-semibold text-gray-700 hidden sm:block">
                                Olá, {currentClientData?.nome?.split(' ')[0] || 'Cliente'}
                            </span>
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>

                        {menuAberto && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                                <Link
                                    to="/meus-pedidos"
                                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    onClick={() => setMenuAberto(false)}
                                >
                                    Meus Pedidos
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    Sair
                                </button>
                            </div>
                        )}
                    </div>
                ) : !currentUser ? (
                    // Botão de Login para visitante
                    <Link to="/login" className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700">
                        Login
                    </Link>
                ) : (
                    // Links para ADMIN ou MASTER ADMIN
                    <div className="flex items-center gap-4">
                         <Link to={isMasterAdmin ? "/master-dashboard" : "/admin"} className="font-semibold text-gray-700 hover:text-red-600">
                            Painel
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300"
                        >
                            Sair
                        </button>
                    </div>
                )}
            </nav>
        </header>
    );
};

export default Header;