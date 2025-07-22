// src/pages/admin/ListarEstabelecimentosMaster.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
// ADICIONE 'orderBy' aqui:
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore'; // Garanta que 'orderBy' está aqui
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger'; 

// Se você tiver um componente Layout, descomente a linha abaixo e as tags <Layout>
// import Layout from '../../Layout'; // Verifique o caminho exato!

function ListarEstabelecimentosMaster() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();

  const [estabelecimentos, setEstabelecimentos] = useState([]);
  const [loadingEstabs, setLoadingEstabs] = useState(true);
  const [error, setError] = useState('');

  // Estados para busca e filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');

  // Efeito para controle de acesso
  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isMasterAdmin) {
        toast.error('Acesso negado. Você não tem permissões de Master Administrador.');
        navigate('/master-dashboard');
        return;
      }
      setLoadingEstabs(false);
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  // Efeito para carregar estabelecimentos
  useEffect(() => {
    if (isMasterAdmin && currentUser) {
      setLoadingEstabs(true);
      setError('');

      const q = query(collection(db, 'estabelecimentos'), orderBy('nome', 'asc'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const fetchedEstabs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setEstabelecimentos(fetchedEstabs);
          setLoadingEstabs(false);
        },
        (err) => {
          console.error("Erro ao carregar estabelecimentos:", err);
          setError("Erro ao carregar a lista de estabelecimentos.");
          setLoadingEstabs(false);
        }
      );

      return () => unsubscribe();
    }
  }, [isMasterAdmin, currentUser]);

  // Função para Ativar/Desativar Estabelecimento
  const toggleEstabelecimentoAtivo = async (estabelecimentoId, currentStatus, estabelecimentoNome) => {
    try {
      const estabRef = doc(db, 'estabelecimentos', estabelecimentoId);
      await updateDoc(estabRef, {
        ativo: !currentStatus
      });
      // Chamada para auditLogger
      auditLogger(
          currentStatus ? 'ESTABELECIMENTO_DESATIVADO' : 'ESTABELECIMENTO_ATIVADO',
          { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
          { type: 'estabelecimento', id: estabelecimentoId, name: estabelecimentoNome },
          { oldValue: currentStatus, newValue: !currentStatus }
      );
      toast.success(`Estabelecimento ${estabelecimentoNome} ${currentStatus ? 'desativado' : 'ativado'} com sucesso!`);
    } catch (error) {
      console.error("Erro ao alternar status do estabelecimento:", error);
      toast.error("Erro ao alternar status do estabelecimento.");
    }
  };

  // Função para Deletar Estabelecimento
  const handleDeleteEstabelecimento = async (estabelecimentoId, estabelecimentoNome) => {
    if (window.confirm(`Tem certeza que deseja DELETAR o estabelecimento "${estabelecimentoNome}"? Esta ação é irreversível.`)) {
      try {
        await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId));
        // Chamada para auditLogger
        auditLogger(
            'ESTABELECIMENTO_DELETADO',
            { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' },
            { type: 'estabelecimento', id: estabelecimentoId, name: estabelecimentoNome }
        );
        toast.success(`Estabelecimento "${estabelecimentoNome}" deletado com sucesso!`);
      } catch (error) {
        console.error("Erro ao deletar estabelecimento:", error);
        toast.error(`Erro ao deletar o estabelecimento "${estabelecimentoNome}".`);
      }
    }
  };

  // Lógica de Filtro e Busca
  const filteredEstabelecimentos = estabelecimentos.filter(estab => {
    const matchesSearchTerm = estab.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (estab.adminUID && estab.adminUID.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = filterStatus === 'todos' ||
                          (filterStatus === 'ativos' && estab.ativo) ||
                          (filterStatus === 'inativos' && !estab.ativo);

    return matchesSearchTerm && matchesStatus;
  });


  if (authLoading || loadingEstabs) {
    return (
      // <Layout>
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
          <p className="text-xl text-gray-700">Carregando estabelecimentos...</p>
        </div>
      // </Layout>
    );
  }

  if (!currentUser || !isMasterAdmin) {
    return null;
  }

  return (
    // <Layout>
      <div className="p-4 bg-gray-100 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {/* Cabeçalho */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 text-center sm:text-left">
              Gerenciar Estabelecimentos
            </h1>
            {/* BOTÃO "VOLTAR" PADRONIZADO AQUI */}
            <Link 
              to="/master-dashboard" 
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md font-semibold hover:bg-gray-300 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
              Voltar ao Dashboard
            </Link>
          </div>

          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
              <p className="font-bold">Erro:</p>
              <p>{error}</p>
            </div>
          )}

          {/* Seção de Filtro e Busca */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Filtrar Estabelecimentos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">Buscar por Nome/Admin UID:</label>
                <input
                  type="text"
                  id="search"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                  placeholder="Pesquisar estabelecimentos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Status:</label>
                <select
                  id="statusFilter"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="todos">Todos</option>
                  <option value="ativos">Ativos</option>
                  <option value="inativos">Inativos</option>
                </select>
              </div>
            </div>
          </div>

          {/* Cards de Estabelecimentos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEstabelecimentos.length === 0 ? (
              <p className="text-gray-500 text-center py-8 col-span-full">Nenhum estabelecimento encontrado com os critérios de busca/filtro.</p>
            ) : (
              filteredEstabelecimentos.map(estab => (
                <div key={estab.id} className="bg-white rounded-lg shadow-md p-6 flex flex-col justify-between hover:shadow-lg transition-shadow duration-300">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800 mb-2 flex items-center justify-between">
                      {estab.nome}
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        estab.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {estab.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </h2>
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">Slug:</span> {estab.slug}
                    </p>
                    <p className="text-sm text-gray-600 mb-4">
                      <span className="font-medium">Admin UID:</span> {estab.adminUID ? estab.adminUID.substring(0, 10) + '...' : 'N/A'}
                    </p>
                  </div>
                  <div className="flex justify-end space-x-2 mt-4">
                    <Link
                      to={`/master/estabelecimentos/${estab.id}/editar`}
                      className="px-3 py-1 rounded-md bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => toggleEstabelecimentoAtivo(estab.id, estab.ativo, estab.nome)}
                      className={`px-3 py-1 rounded-md text-white ${
                        estab.ativo ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                      }`}
                    >
                      {estab.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      onClick={() => handleDeleteEstabelecimento(estab.id, estab.nome)}
                      className="px-3 py-1 rounded-md bg-gray-500 hover:bg-gray-600 text-white"
                    >
                      Deletar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    // </Layout>
  );
}

export default ListarEstabelecimentosMaster;