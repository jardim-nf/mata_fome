import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

function ListarPedidosMaster() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nomesEstabelecimentos, setNomesEstabelecimentos] = useState({}); // ID -> Nome do Estabelecimento

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser || !isMasterAdmin) {
        toast.error('Acesso negado. Esta página é exclusiva do Administrador Master.');
        navigate('/master-dashboard');
        setLoading(false);
        return;
      }

      // Carregar Nomes dos Estabelecimentos (para exibir nome em vez de ID)
      const fetchNomesEstabelecimentos = async () => {
        try {
          const estabelecimentosSnapshot = await getDocs(collection(db, 'estabelecimentos'));
          const nomesMap = {};
          estabelecimentosSnapshot.forEach(doc => {
            nomesMap[doc.id] = doc.data().nome;
          });
          setNomesEstabelecimentos(nomesMap);
        } catch (err) {
          console.error("Erro ao carregar nomes dos estabelecimentos:", err);
          toast.error("Erro ao carregar nomes dos estabelecimentos.");
        }
      };
      fetchNomesEstabelecimentos();


      // Listener para Pedidos (todos)
      const q = query(collection(db, 'pedidos'), orderBy('criadoEm', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const lista = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setPedidos(lista);
        setLoading(false);
      }, (err) => {
        console.error("Erro ao carregar pedidos:", err);
        setError("Erro ao carregar lista de pedidos.");
        setLoading(false);
        toast.error("Erro ao carregar lista de pedidos.");
      });

      return () => unsubscribe();
    }
  }, [currentUser, isMasterAdmin, authLoading, navigate]);

  if (loading) {
    return <div className="text-center p-4">Carregando pedidos...</div>;
  }

  if (error) {
    return <div className="text-center p-4 text-red-600">Erro: {error}</div>;
  }

  return (
    <div className="p-6">
      <Link to="/master-dashboard" className="text-blue-600 hover:underline mb-4 inline-block">
        ← Voltar ao Dashboard Master
      </Link>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Todos os Pedidos ({pedidos.length})</h1>
      
      {pedidos.length === 0 ? (
        <p className="text-gray-500 italic">Nenhum pedido encontrado ainda.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow-md">
          <table className="min-w-full leading-normal">
            <thead>
              <tr>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  ID do Pedido
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Estabelecimento
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map(pedido => (
                <tr key={pedido.id}>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">{pedido.id.substring(0, 7)}...</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">{pedido.cliente?.nome || 'N/A'}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    {/* Usa o nome do estabelecimento mapeado */}
                    <p className="text-gray-900 whitespace-no-wrap">
                      {nomesEstabelecimentos[pedido.estabelecimentoId] || pedido.estabelecimentoId || 'N/A'}
                    </p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">R$ {pedido.totalFinal?.toFixed(2).replace('.', ',') || 'N/A'}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm capitalize">
                    <p className="text-gray-900 whitespace-no-wrap">{pedido.status || 'N/A'}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">
                      {pedido.criadoEm?.toDate().toLocaleDateString('pt-BR') || 'N/A'}
                    </p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <Link to={`/comanda/${pedido.id}`} className="text-indigo-600 hover:text-indigo-900" target="_blank">
                      Ver Comanda
                    </Link>
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

export default ListarPedidosMaster;