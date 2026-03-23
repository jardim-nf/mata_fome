// src/pages/HomeRedirector.jsx
import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaSpinner } from 'react-icons/fa';

function HomeRedirector() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, isAdmin, isMasterAdmin, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;

    // Normaliza o cargo removendo acentos e convertendo para minúsculas
    const cargoRaw = currentUser?.cargo || '';
    const cargoNorm = cargoRaw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

    console.log('🔍 HomeRedirector - Analisando usuário:', {
      email: currentUser?.email,
      cargo: cargoRaw,
      cargoNorm,
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
    // Funcionários com cargo - redireciona para a rota adequada
    else if (['gerente'].includes(cargoNorm)) {
      // Gerente tem acesso similar ao admin
      targetPath = '/painel';
    }
    else if (['garcom', 'garçom'].includes(cargoNorm) || cargoRaw.toLowerCase() === 'garçom') {
      targetPath = '/controle-salao';
    }
    else if (['cozinheiro', 'cozinha'].includes(cargoNorm)) {
      targetPath = '/painel';
    }
    else if (['caixa'].includes(cargoNorm)) {
      targetPath = '/painel';
    }
    else if (['atendente'].includes(cargoNorm)) {
      targetPath = '/painel';
    }
    else if (['entregador'].includes(cargoNorm)) {
      targetPath = '/painel';
    }
    else if (['auxiliar'].includes(cargoNorm)) {
      targetPath = '/painel';
    }
    // Se tem qualquer cargo (é funcionário), manda pro painel
    else if (cargoNorm) {
      targetPath = '/painel';
    }
    else {
      // Cliente normal (sem cargo)
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