// src/pages/HomeRedirector.jsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Este componente não renderiza nada. Ele apenas decide para onde redirecionar.
function HomeRedirector() {
  const { isMasterAdmin, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Se ainda estiver carregando as informações do usuário, não faz nada.
    if (loading) {
      return;
    }

    // Lógica de decisão
    if (isMasterAdmin) {
      // Se for Master Admin, vai para o dashboard principal
      navigate('/master-dashboard');
    } else if (isAdmin) {
      // Se for um admin comum, vai para o painel de pedidos
      navigate('/painel');
    } else {
      // Se não for nenhum dos dois (ex: cliente comum), volta para a home
      navigate('/');
    }
  }, [loading, isMasterAdmin, isAdmin, navigate]); // Roda quando a autenticação terminar

  // Mostra uma mensagem de carregamento enquanto a lógica roda
  return <div className="text-center p-8">Redirecionando...</div>;
}

export default HomeRedirector;