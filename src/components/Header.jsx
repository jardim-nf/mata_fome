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

    let homeLink = "/";
    if (currentUser) {
        if (isMasterAdmin) homeLink = "/master-dashboard";
        else if (isAdmin) homeLink = "/dashboard";
    }

    // ALTERAÇÃO 2: Lógica de logout ajustada
    const handleLogout = async () => {
        try {
            await logout();
            toast.info('Você foi desconectado.');
            // A LINHA 'navigate('/')' FOI REMOVIDA DAQUI
        } catch (error) {
            toast.error('Não foi possível fazer logout.');
        }
    };

    const userEmailPrefix = currentUser?.email ? currentUser.email.split('@')[0] : 'Usuário';
}

export default Header;