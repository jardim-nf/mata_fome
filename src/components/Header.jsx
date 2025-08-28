// src/components/Header.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { IoMenu, IoClose } from 'react-icons/io5'; // Ícones para o menu mobile

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
            navigate('/login');
        } catch (error) {
            toast.error('Não foi possível fazer logout.');
        }
    };

    return (
        <header className="bg-gray-800 text-white p-4 flex justify-between items-center shadow-lg relative">
                DeuFome

            {/* Menu para Telas Grandes (Desktop) */}
            <nav className="hidden md:flex items-center gap-4">
                {currentUser ? (
                    <>
                        <span className="text-sm">Olá, {currentClientData?.nome || currentUser.email}!</span>
                        {isMasterAdmin && <Link to="/master-dashboard" className="hover:text-amber-400">Master</Link>}
                        {isAdmin && !isMasterAdmin && <Link to="/dashboard" className="hover:text-amber-400">Dashboard</Link>}
                        <Link to="/cardapios" className="hover:text-amber-400">Cardápios</Link>
                        <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded">Sair</button>
                    </>
                ) : (
                    <Link to="/login-admin" className="bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded">Login Admin</Link>
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
                <nav className="md:hidden absolute top-0 left-0 w-full h-screen bg-gray-800 flex flex-col items-center justify-center gap-6 text-xl z-10">
                    {currentUser ? (
                        <>
                            {isMasterAdmin && <Link to="/master-dashboard" onClick={() => setIsMenuOpen(false)} className="hover:text-amber-400">Master</Link>}
                            {isAdmin && !isMasterAdmin && <Link to="/dashboard" onClick={() => setIsMenuOpen(false)} className="hover:text-amber-400">Dashboard</Link>}
                            <Link to="/cardapios" onClick={() => setIsMenuOpen(false)} className="hover:text-amber-400">Cardápios</Link>
                            <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded">Sair</button>
                        </>
                    ) : (
                        <Link to="/login-admin" onClick={() => setIsMenuOpen(false)} className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded">Login Admin</Link>
                    )}
                </nav>
            )}
        </header>
    );
}

export default Header;