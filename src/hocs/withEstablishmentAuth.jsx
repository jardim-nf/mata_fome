// src/hocs/withEstablishmentAuth.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const withEstablishmentAuth = (Component) => {
  return function EstablishmentAuthComponent(props) {
    const navigate = useNavigate();
    const { 
      currentUser, 
      isAdmin, 
      isMaster, 
      authLoading, 
      estabelecimentoIdPrincipal 
    } = useAuth();

    if (authLoading) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando estabelecimento...</p>
          </div>
        </div>
      );
    }

    // Master não deve acessar páginas de estabelecimento específico
    if (isMaster) {
      console.log('🔐 Master redirecionado para MasterDashboard');
      toast.info('👑 Acesse o Master Dashboard para gerenciar múltiplos estabelecimentos.');
      navigate('/master-dashboard');
      return null;
    }

    // Admin sem estabelecimento configurado
    if (isAdmin && !estabelecimentoIdPrincipal) {
      toast.error('❌ Nenhum estabelecimento configurado para seu acesso.');
      navigate('/dashboard');
      return null;
    }

    // Usuário comum tentando acessar área admin
    if (!isAdmin && !isMaster) {
      toast.error('🔒 Acesso restrito à administração.');
      navigate('/');
      return null;
    }

    return <Component {...props} />;
  };
};

export default withEstablishmentAuth;