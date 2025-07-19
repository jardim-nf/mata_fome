import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase'; // Caminho relativo correto
import { useAuth } from '../../context/AuthContext'; // Caminho relativo correto
import { toast } from 'react-toastify';

function ListarEstabelecimentosMaster() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();
  const [estabelecimentos, setEstabelecimentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isMasterAdmin) {
        toast.error('Acesso negado. Esta página é exclusiva do Administrador Master.');
        navigate('/master-dashboard');
        setLoading(false);
        return;
      }

      const q = query(collection(db, 'estabelecimentos'), orderBy('nome', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const lista = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setEstabelecimentos(lista);
        setLoading(false);
      }, (err) => {
        console.error("Erro ao carregar estabelecimentos:", err);
        setError("Erro ao carregar lista de estabelecimentos.");
        setLoading(false);
        toast.error("Erro ao carregar lista de estabelecimentos.");
      });

      return () => unsubscribe();
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  const toggleAtivo = async (id, currentStatus) => {
    try {
      const estabRef = doc(db, 'estabelecimentos', id);
      await updateDoc(estabRef, { ativo: !currentStatus });
      toast.success(`Estabelecimento ${!currentStatus ? 'ativado' : 'desativado'} com sucesso!`);
    } catch (err) {
      console.error("Erro ao atualizar status do estabelecimento:", err);
      toast.error("Erro ao atualizar status. Tente novamente.");
    }
  };

  if (loading) {
    return <div className="text-center p-4">Carregando estabelecimentos...</div>;
  }

  if (error) {
    return <div className="text-center p-4 text-red-600">Erro: {error}</div>;
  }

  return (
    <div className="p-6">
      <Link to="/master-dashboard" className="text-blue-600 hover:underline mb-4 inline-block">
        ← Voltar ao Dashboard Master
      </Link>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Todos os Estabelecimentos ({estabelecimentos.length})</h1>
      
      {estabelecimentos.length === 0 ? (
        <p className="text-gray-500 italic">Nenhum estabelecimento cadastrado ainda.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow-md">
          <table className="min-w-full leading-normal">
            <thead>
              <tr>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Slug
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Admin UID
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {estabelecimentos.map(est => (
                <tr key={est.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">{est.nome}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">{est.slug}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">{est.adminUID}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <span className={`relative inline-block px-3 py-1 font-semibold leading-tight ${est.ativo ? 'text-green-900 bg-green-200' : 'text-red-900 bg-red-200'} rounded-full`}>
                      {est.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm flex gap-2">
                    <Link to={`/master/estabelecimentos/${est.id}/editar`} className="text-indigo-600 hover:text-indigo-900 font-medium">
                      Editar
                    </Link>
                    <button onClick={() => toggleAtivo(est.id, est.ativo)}
                            className={`font-medium ${est.ativo ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}>
                      {est.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                    {/* Botão de Excluir (com confirmação) */}
                    {/* <button onClick={() => handleDelete(est.id)} className="text-gray-600 hover:text-gray-900 ml-3">Excluir</button> */}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ListarEstabelecimentosMaster;