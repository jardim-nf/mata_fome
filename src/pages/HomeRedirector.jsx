// src/pages/HomeRedirector.jsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaSpinner } from 'react-icons/fa';

function HomeRedirector() {
  const navigate = useNavigate();
  const { currentUser, isAdmin, isMasterAdmin } = useAuth();

  useEffect(() => {
    console.log('🔄 HomeRedirector analisando usuário:', { 
      currentUser: !!currentUser, 
      isAdmin, 
      isMasterAdmin 
    });

    // Pequeno delay para garantir que o auth context está carregado
    const timer = setTimeout(() => {
      if (!currentUser) {
        console.log('🔐 Usuário não logado -> /');
        navigate('/');
        return;
      }

      if (isMasterAdmin) {
        console.log('👑 Master Admin -> /master-dashboard');
        navigate('/master-dashboard');
      } else if (isAdmin) {
        console.log('⚡ Admin Estabelecimento -> /painel');
        navigate('/painel');
      } else {
        console.log('👤 Usuário normal -> /');
        navigate('/');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [currentUser, isAdmin, isMasterAdmin, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <FaSpinner className="animate-spin text-yellow-500 text-4xl mx-auto mb-4" />
        <p className="text-gray-600">Redirecionando...</p>
      </div>
    </div>
  );
}

export default HomeRedirector;