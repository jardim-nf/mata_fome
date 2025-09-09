// src/components/Header.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { IoMenu, IoClose } from 'react-icons/io5';

function Header() {
    const navigate = useNavigate();
    const { currentUser, currentClientData, isAdmin, isMasterAdmin, logout } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Define o link principal (do logo) com base no tipo de usuário
    let homeLink = "/";
    if (currentUser) {
        if (isMasterAdmin) homeLink = "/master-dashboard";
        else if (isAdmin) homeLink = "/dashboard";
    }

    const handleLogout = async () => {
        try {
            await logout();
            toast.info('Você foi desconectado.');
            navigate('/');
        } catch (error) {
            toast.error('Não foi possível fazer logout.');
        }
    };

    const userEmailPrefix = currentUser?.email ? currentUser.email.split('@')[0] : 'Usuário';

    return (
        <header className="bg-black text-white p-4 flex justify-between items-center shadow-lg relative border-b border-gray-800">
            {/* Logo com o estilo preto e amarelo */}
            <div onClick={() => navigate(homeLink)} className="font-extrabold text-2xl text-white cursor-pointer hover:text-gray-200 transition-colors duration-300">
                DEU FOME <span className="text-yellow-500">.</span>
            </div>

            {/* Menu para Telas Grandes (Desktop) */}
            <nav className="hidden md:flex items-center gap-4">
                {currentUser ? (
                    <>
                        <span className="text-white text-md font-medium">Olá, {currentClientData?.nome || userEmailPrefix}!</span>
                        {isMasterAdmin && 
                            <Link to="/master-dashboard" className="px-4 py-2 rounded-full text-black bg-yellow-500 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-yellow-600 hover:shadow-md">
                                Master
                            </Link>}
                        {isAdmin && !isMasterAdmin && 
                            <Link to="/dashboard" className="px-4 py-2 rounded-full text-black bg-yellow-500 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-yellow-600 hover:shadow-md">
                                Dashboard
                            </Link>}
                        <Link to="/cardapio" className="text-gray-300 hover:text-yellow-500 transition-colors">Cardápios</Link>
                        <button 
                          onClick={handleLogout} 
                          className="px-4 py-2 rounded-full text-white border border-gray-600 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-gray-800 hover:border-gray-500"
                        >
                          Sair
                        </button>
                    </>
                ) : (
                    <Link to="/login-admin" className="px-4 py-2 rounded-full text-black bg-yellow-500 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-yellow-600 hover:shadow-md">
                        Login Admin
                    </Link>
                )}
            </nav>

            {/* Botão Sanduíche para Telas Pequenas (Mobile) */}
            <div className="md:hidden z-20">
                <button onClick={() => setIsMenuOpen(!isMenuOpen)}>
                    {isMenuOpen ? <IoClose size={28} /> : <IoMenu size={28} />}
                </button>
            </div>

            {/* Menu Dropdown para Telas Pequenas (Mobile) */}
            {isMenuOpen && (
                <nav className="md:hidden absolute top-0 left-0 w-full h-screen bg-black flex flex-col items-center justify-center gap-6 text-xl z-10">
                    {currentUser ? (
                        <>
                            {isMasterAdmin && <Link to="/master-dashboard" onClick={() => setIsMenuOpen(false)} className="hover:text-yellow-500">Master</Link>}
                            {isAdmin && !isMasterAdmin && <Link to="/dashboard" onClick={() => setIsMenuOpen(false)} className="hover:text-yellow-500">Dashboard</Link>}
                            <Link to="/cardapio" onClick={() => setIsMenuOpen(false)} className="hover:text-yellow-500">Cardápios</Link>
                            <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} className="px-5 py-3 mt-4 rounded-lg bg-yellow-500 text-black font-semibold">Sair</button>
                        </>
                    ) : (
                        <Link to="/login-admin" onClick={() => setIsMenuOpen(false)} className="px-5 py-3 rounded-lg bg-yellow-500 text-black font-semibold">Login Admin</Link>
                    )}
                </nav>
            )}
        </header>
    );
}

export default Header;