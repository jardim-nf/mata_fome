// src/pages/HomeRedirector.jsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaSpinner } from 'react-icons/fa';

function HomeRedirector() {
  const navigate = useNavigate();
  // Inclua o loading do AuthContext
  const { currentUser, isAdmin, isMasterAdmin, loading: authLoading } = useAuth();

  useEffect(() => {
    // 🛑 Aguarda o AuthContext terminar de carregar TUDO (Auth e Firestore)
    if (authLoading) {
      return; 
    }

    console.log('🔄 HomeRedirector analisando usuário:', { 
      currentUser: !!currentUser, 
      isAdmin, 
      isMasterAdmin 
    });

    // Se não estiver logado, vai para a home padrão (ou login)
    if (!currentUser) {
      console.log('🔐 Usuário não logado -> /');
      navigate('/');
      return;
    }

    // Se estiver logado, direciona com base nas permissões
    if (isMasterAdmin) {
      console.log('👑 Master Admin -> /master-dashboard');
      // Redireciona imediatamente, sem delay desnecessário
      navigate('/master-dashboard', { replace: true }); 
    } else if (isAdmin) {
      // ✅ Redireciona para o painel de Admin
      console.log('⚡ Admin Estabelecimento -> /painel');
      navigate('/painel', { replace: true });
    } else {
      // Usuário logado sem permissão específica (ex: cliente)
      console.log('👤 Usuário normal logado -> /');
      navigate('/', { replace: true });
    }

  }, [currentUser, isAdmin, isMasterAdmin, authLoading, navigate]);

  // Exibe o spinner enquanto o AuthContext carrega
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-yellow-500 text-4xl mx-auto mb-4" />
          <p className="text-gray-400">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // Se o authLoading for falso, mas as condições não satisfizerem o redirect, ele renderiza a Home/Login
  return null; 
}

export default HomeRedirector;