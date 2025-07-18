// src/pages/MasterDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

function MasterDashboard() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading } = useAuth(); // Usar isMasterAdmin
  
  const [totalEstabelecimentos, setTotalEstabelecimentos] = useState(0);
  const [totalPedidosGerais, setTotalPedidosGerais] = useState(0);
  const [totalUsuariosCadastrados, setTotalUsuariosCadastrados] = useState(0);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState('');

  // Importe a função de importação de cardápio (se for ter um botão para ela aqui)
  // import { importCardapioBlackBurguerAutomaticoClient } from '../utils/importMenuClient'; // Se usar a versão CLIENTE do script

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isMasterAdmin) { // Apenas Master Admin tem acesso
        toast.error('Acesso negado. Você precisa ser o Administrador Master para acessar esta página.');
        navigate('/');
        setLoadingDashboard(false);
      } else {
        setLoadingDashboard(true);
        setDashboardError('');

        // --- Listeners para dados em tempo real ---
        const unsubscribeEstabelecimentos = onSnapshot(collection(db, 'estabelecimentos'), (snapshot) => {
          setTotalEstabelecimentos(snapshot.size);
        }, (error) => console.error("Erro no listener de estabelecimentos:", error));

        const unsubscribePedidos = onSnapshot(collection(db, 'pedidos'), (snapshot) => {
          setTotalPedidosGerais(snapshot.size);
        }, (error) => console.error("Erro no listener de pedidos:", error));

        const unsubscribeClientes = onSnapshot(collection(db, 'clientes'), (snapshot) => {
          setTotalUsuariosCadastrados(snapshot.size);
        }, (error) => console.error("Erro no listener de clientes:", error));

        setLoadingDashboard(false);

        // Retorna função de limpeza
        return () => {
          unsubscribeEstabelecimentos();
          unsubscribePedidos();
          unsubscribeClientes();
        };
      }
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  // Função para importação (exemplo, se você quiser um botão aqui)
  const handleImportCardapio = async () => {
    // Você pode ter um modal para escolher o estabelecimentoId para importação
    // Por exemplo, para importar para um ID específico:
    // const estabelecimentoIdAlvo = prompt("Digite o ID do estabelecimento para importar o cardápio:");
    // if (estabelecimentoIdAlvo) {
    //   await importCardapioBlackBurguerAutomaticoClient(estabelecimentoIdAlvo); // Chamaria a função do cliente SDK
    // } else {
    //   toast.warn("Importação cancelada.");
    // }
    toast.info("A funcionalidade de importação de cardápio via UI será implementada aqui.");
  };

  if (authLoading || loadingDashboard) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <p className="text-lg text-gray-700">Carregando Dashboard Master...</p>
      </div>
    );
  }

  if (dashboardError) {
    return (
      <div className="text-center p-4 text-red-600">
        <p>Erro: {dashboardError}</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-4xl font-bold text-center text-indigo-800 mb-8">Dashboard Master</h1>
      <p className="text-center text-gray-600 mb-8">Bem-vindo, Administrador Master {currentUser?.email}!</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white rounded-lg shadow-md p-6 text-center border-l-4 border-blue-500">
          <h2 className="text-2xl font-semibold text-blue-800 mb-2">Total de Estabelecimentos</h2>
          <p className="text-5xl font-extrabold text-blue-600">{totalEstabelecimentos}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 text-center border-l-4 border-green-500">
          <h2 className="text-2xl font-semibold text-green-800 mb-2">Total de Pedidos (Geral)</h2>
          <p className="text-5xl font-extrabold text-green-600">{totalPedidosGerais}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 text-center border-l-4 border-purple-500">
          <h2 className="text-2xl font-semibold text-purple-800 mb-2">Total de Usuários Cadastrados</h2>
          <p className="text-5xl font-extrabold text-purple-600">{totalUsuariosCadastrados}</p>
        </div>
      </div>

      <div className="mt-10 p-6 bg-white rounded-lg shadow-lg border border-gray-200">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">Ferramentas Master</h2>
        <div className="flex flex-wrap gap-4">
          <Link to="/admin/cadastrar-estabelecimento" className="px-6 py-3 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition duration-300">
            ➕ Cadastrar Novo Estabelecimento
          </Link>
          <button onClick={handleImportCardapio} className="px-6 py-3 bg-purple-600 text-white rounded-lg shadow-md hover:bg-purple-700 transition duration-300">
            📊 Importar Cardápio para Estabelecimento (Via UI)
          </button>
          {/* Adicione mais links para outras ferramentas Master aqui */}
          {/* Ex: Gerenciar Usuários, Relatórios Avançados, etc. */}
          <Link to="/admin/gerenciar-cupons" className="px-6 py-3 bg-yellow-600 text-white rounded-lg shadow-md hover:bg-yellow-700 transition duration-300">
            🎫 Gerenciar Cupons
          </Link>
        </div>
      </div>
    </div>
  );
}

export default MasterDashboard;