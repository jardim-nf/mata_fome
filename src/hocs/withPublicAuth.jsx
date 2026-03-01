// src/hocs/withPublicAuth.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Para páginas públicas que redirecionam se já estiver logado
const withPublicAuth = (Component, redirectPath = '/dashboard') => {
  return function PublicAuthComponent(props) {
    const { currentUser, authLoading } = useAuth();

    if (authLoading) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        </div>
      );
    }

    // Se já estiver autenticado, redireciona
    if (currentUser) {
      return <Navigate to={redirectPath} replace />;
    }

    return <Component {...props} />;
  };
};

export default withPublicAuth;