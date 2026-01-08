// src/pages/HomeRedirector.jsx
import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaSpinner } from 'react-icons/fa';

function HomeRedirector() {
  const navigate = useNavigate();
  const location = useLocation();
  // 👇 Tente pegar 'isWaiter' ou 'isGarcom' se seu AuthContext exportar.
  // Se não, vamos usar o currentUser.role (veja abaixo)
  const { currentUser, isAdmin, isMasterAdmin, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;

    // 👇 DEBUG: Vamos ver o que a Aline é de verdade no console
    console.log('🔍 Analisando usuário:', {
      email: currentUser?.email,
      role: currentUser?.role, // Verifica se o campo role existe
      isAdmin,
      isMasterAdmin
    });

    let targetPath = '/';

    if (!currentUser) {
      targetPath = '/'; 
    } 
    else if (isMasterAdmin) {
      targetPath = '/master-dashboard';
    } 
    else if (isAdmin) {
      targetPath = '/painel';
    } 
    // 👇 AQUI ESTÁ A CORREÇÃO PARA A ALINE
    // Verifique se o role é 'garcom', 'waiter' ou como estiver no seu banco de dados
    else if (currentUser?.role === 'garcom' || currentUser?.role === 'waiter') {
      console.log('💁‍♀️ É Garçom -> /painel-garcom'); // Ajuste para a rota correta do garçom
      targetPath = '/painel-garcom'; 
    } 
    else {
      // Cliente normal
      targetPath = '/'; 
    }

    // Só navega se o destino for diferente de onde já estamos
    if (location.pathname !== targetPath) {
      navigate(targetPath, { replace: true });
    }

  }, [currentUser, isAdmin, isMasterAdmin, authLoading, navigate, location]);

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

  return null; 
}

export default HomeRedirector;