// src/hocs/withAuth.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

// Componente de Loading Unificado
const AuthLoading = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p className="mt-4 text-gray-600">Verificando acesso...</p>
    </div>
  </div>
);

// HOC Principal
const withAuth = (Component, options = {}) => {
  const {
    requireAuth = true,          // Requer autenticação
    requireAdmin = false,        // Requer permissão de admin
    requireMaster = false,       // Requer permissão de master
    redirectTo = '/login-admin', // Redirecionamento padrão
    message = 'Acesso restrito'  // Mensagem padrão
  } = options;

  return function AuthenticatedComponent(props) {
    const navigate = useNavigate();
    const { 
      currentUser, 
      isAdmin, 
      isMaster, 
      authLoading, 
      estabelecimentoIdPrincipal 
    } = useAuth();

    // Debug (apenas desenvolvimento)
    if (process.env.NODE_ENV === 'development') {
      console.log('🔐 Debug Auth HOC:', {
        currentUser: !!currentUser,
        isAdmin,
        isMaster,
        authLoading,
        estabelecimentoIdPrincipal,
        options
      });
    }

    // 1. Verificar se está carregando
    if (authLoading) {
      return <AuthLoading />;
    }

    // 2. Verificar se requer autenticação
    if (requireAuth && !currentUser) {
      toast.error('🔒 Faça login para acessar esta página.');
      navigate(redirectTo);
      return null;
    }

    // 3. Verificar permissões hierárquicas
    if (requireMaster && !isMaster) {
      console.warn('❌ Acesso negado: Requer permissão Master');
      toast.error('🔒 Acesso restrito à administração master.');
      navigate('/dashboard');
      return null;
    }

    if (requireAdmin && !isAdmin && !isMaster) {
      console.warn('❌ Acesso negado: Requer permissão Admin');
      toast.error('🔒 Acesso restrito à administração do estabelecimento.');
      navigate('/dashboard');
      return null;
    }

    // 4. Verificar estabelecimento para admins não-master
    if ((isAdmin && !isMaster) && !estabelecimentoIdPrincipal) {
      console.warn('❌ Admin sem estabelecimento configurado');
      toast.error('❌ Configuração de acesso incompleta.');
      navigate('/dashboard');
      return null;
    }

    // 5. Tudo verificado - renderizar componente
    return <Component {...props} />;
  };
};

export default withAuth;