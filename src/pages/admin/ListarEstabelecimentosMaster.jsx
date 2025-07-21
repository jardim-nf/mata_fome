// src/pages/admin/ListarEstabelecimentosMaster.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
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
        toast.error('Acesso negado.');
        navigate('/master-dashboard');
        return;
      }

      const q = query(collection(db, 'estabelecimentos'), orderBy('nome', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setEstabelecimentos(lista);
        setLoading(false);
      }, (err) => {
        setError("Erro ao carregar estabelecimentos.");
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  const toggleAtivo = async (id, currentStatus) => {
    try {
      const estabRef = doc(db, 'estabelecimentos', id);
      await updateDoc(estabRef, { ativo: !currentStatus });
      toast.success(`Estabelecimento ${!currentStatus ? 'ativado' : 'desativado'}!`);
    } catch (err) {
      toast.error("Erro ao atualizar status.");
    }
  };

  if (loading || authLoading) {
    return <div className="text-center p-8">Carregando estabelecimentos...</div>;
  }

  if (error) {
    return <div className="text-center p-8 text-red-600">Erro: {error}</div>;
  }

  return (
    <div className="bg-[var(--fundo-pagina)] min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Cabeçalho da Página */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <Link to="/master-dashboard" className="text-sm font-semibold text-[var(--cor-principal)] hover:text-[var(--cor-principal-hover)] flex items-center mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              Voltar ao Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-[var(--texto-titulo)]">Gerenciar Estabelecimentos</h1>
          </div>
          <Link to="/admin/cadastrar-estabelecimento" className="mt-4 sm:mt-0 px-4 py-2 bg-[var(--cor-principal)] text-white rounded-lg shadow-md hover:bg-[var(--cor-principal-hover)] flex items-center gap-2 transition-colors duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" /></svg>
            Adicionar Novo
          </Link>
        </div>

        {/* Layout de Cards */}
        {estabelecimentos.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-md">
            <p className="text-lg text-gray-500">Nenhum estabelecimento cadastrado ainda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {estabelecimentos.map(est => (
              <div key={est.id} className="bg-white rounded-xl shadow-md p-6 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-bold text-[var(--texto-titulo)]">{est.nome}</h2>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${est.ativo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {est.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-[var(--texto-corpo)] border-t pt-4">
                    <p><strong>Slug:</strong> <span className="font-mono bg-slate-100 px-1 rounded">{est.slug}</span></p>
                    <p><strong>Admin UID:</strong> <span className="font-mono bg-slate-100 px-1 rounded text-xs" title={est.adminUID}>{est.adminUID ? `${est.adminUID.substring(0, 15)}...` : 'N/A'}</span></p>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t flex items-center justify-end gap-4">
                  <Link to={`/master/estabelecimentos/${est.id}/editar`} className="font-medium text-[var(--cor-principal)] hover:text-[var(--cor-principal-hover)]">
                    Editar
                  </Link>
                  <button onClick={() => toggleAtivo(est.id, est.ativo)}
                    className={`font-medium ${est.ativo ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}>
                    {est.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ListarEstabelecimentosMaster;