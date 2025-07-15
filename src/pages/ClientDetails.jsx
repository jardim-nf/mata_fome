// src/pages/ClientDetails.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function ClientDetails() {
  const { clientId } = useParams(); // Pega o ID do cliente da URL
  const navigate = useNavigate();
  const { currentUser, isAdmin, loading: authLoading } = useAuth();

  const [clientData, setClientData] = useState(null);
  const [clientOrders, setClientOrders] = useState([]);
  const [loadingClient, setLoadingClient] = useState(true);
  const [error, setError] = useState('');

  // Efeito para redirecionar se não for admin
  useEffect(() => {
    if (!authLoading && (!currentUser || !isAdmin)) {
      alert('Acesso negado. Você precisa ser um administrador para acessar esta página.');
      navigate('/');
    }
  }, [currentUser, isAdmin, authLoading, navigate]);

  // Efeito para carregar dados do cliente e seus pedidos
  useEffect(() => {
    if (authLoading === false && currentUser && isAdmin && clientId) {
      const fetchClientDetails = async () => {
        try {
          // 1. Buscar os dados do cliente
          const clientDocRef = doc(db, 'clientes', clientId);
          const clientDocSnap = await getDoc(clientDocRef);

          if (clientDocSnap.exists()) {
            setClientData({ id: clientDocSnap.id, ...clientDocSnap.data() });
          } else {
            setError('Dados do cliente não encontrados.');
            setClientData(null);
          }

          // 2. Buscar o histórico de pedidos deste cliente
          const ordersCollectionRef = collection(db, 'pedidos');
          const qOrders = query(
            ordersCollectionRef,
            where('cliente.userId', '==', clientId), // Filtra por pedidos feitos por este cliente
            orderBy('criadoEm', 'desc')
          );
          const ordersSnapshot = await getDocs(qOrders);
          const ordersList = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setClientOrders(ordersList);

        } catch (err) {
          console.error("Erro ao carregar detalhes do cliente ou pedidos:", err);
          setError("Erro ao carregar os detalhes do cliente. Verifique a conexão e permissões.");
        } finally {
          setLoadingClient(false);
        }
      };
      fetchClientDetails();
    } else if (authLoading === false && (!currentUser || !isAdmin)) {
      setLoadingClient(false); // Já foi redirecionado
    } else if (!clientId) {
      setError("ID do cliente não fornecido na URL.");
      setLoadingClient(false);
    }
  }, [clientId, currentUser, isAdmin, authLoading]); // Dependências

  if (loadingClient || authLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <p className="text-xl text-gray-700">Carregando detalhes do cliente...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-red-100 text-red-700 p-4 text-center">
        <p className="text-xl font-semibold">Erro:</p>
        <p className="mt-2">{error}</p>
        <button onClick={() => navigate('/painel')} className="mt-6 bg-blue-500 text-white px-4 py-2 rounded">
          Voltar para o Painel de Pedidos
        </button>
      </div>
    );
  }

  if (!clientData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100 text-gray-700 p-4 text-center">
        <p className="text-xl font-semibold">Cliente não encontrado ou dados indisponíveis.</p>
        <button onClick={() => navigate('/painel')} className="mt-6 bg-blue-500 text-white px-4 py-2 rounded">
          Voltar para o Painel de Pedidos
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-8">
        <Link to="/painel" className="inline-flex items-center px-4 py-2 bg-gray-200 text-[var(--marrom-escuro)] rounded-lg font-semibold hover:bg-gray-300 transition duration-300 mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Voltar para o Painel de Pedidos
        </Link>

        <h1 className="text-3xl font-bold text-center text-[var(--vermelho-principal)] mb-8">
          Detalhes do Cliente: {clientData.nome || clientData.email}
        </h1>

        <div className="mb-8 border-b pb-4">
          <h2 className="text-xl font-semibold text-[var(--marrom-escuro)] mb-4">Informações de Contato</h2>
          <p className="text-gray-700 mb-2"><strong>Nome:</strong> {clientData.nome || 'Não informado'}</p>
          <p className="text-gray-700 mb-2"><strong>Email:</strong> {clientData.email || 'Não informado'}</p>
          <p className="text-gray-700 mb-2"><strong>Telefone:</strong> {clientData.telefone || 'Não informado'}</p>
          {clientData.criadoEm && <p className="text-gray-700 mb-2"><strong>Membro desde:</strong> {format(clientData.criadoEm.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>}
        </div>

        {clientData.endereco && (
          <div className="mb-8 border-b pb-4">
            <h2 className="text-xl font-semibold text-[var(--marrom-escuro)] mb-4">Endereço Principal</h2>
            <p className="text-gray-700 mb-2"><strong>Rua:</strong> {clientData.endereco.rua || 'Não informado'}</p>
            <p className="text-gray-700 mb-2"><strong>Número:</strong> {clientData.endereco.numero || 'Não informado'}</p>
            <p className="text-gray-700 mb-2"><strong>Bairro:</strong> {clientData.endereco.bairro || 'Não informado'}</p>
            {clientData.endereco.complemento && <p className="text-gray-700 mb-2"><strong>Complemento:</strong> {clientData.endereco.complemento}</p>}
            {clientData.endereco.cidade && <p className="text-gray-700 mb-2"><strong>Cidade:</strong> {clientData.endereco.cidade}</p>}
            {clientData.endereco.estado && <p className="text-gray-700 mb-2"><strong>Estado:</strong> {clientData.endereco.estado}</p>}
            {clientData.endereco.cep && <p className="text-gray-700 mb-2"><strong>CEP:</strong> {clientData.endereco.cep}</p>}
          </div>
        )}

        <div>
          <h2 className="text-xl font-semibold text-[var(--marrom-escuro)] mb-4">Histórico de Pedidos ({clientOrders.length})</h2>
          {clientOrders.length === 0 ? (
            <p className="text-gray-500 italic">Este cliente não possui histórico de pedidos.</p>
          ) : (
            <ul className="space-y-4">
              {clientOrders.map(order => (
                <li key={order.id} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-lg text-gray-800">Pedido #{order.id.substring(0, 8)}...</h3>
                    {order.criadoEm && <span className="text-sm text-gray-500">{format(order.criadoEm.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>}
                  </div>
                  <p className="text-gray-700 mb-1"><strong>Total:</strong> R$ {order.totalFinal ? order.totalFinal.toFixed(2).replace('.', ',') : 'N/A'}</p>
                  <p className="text-gray-700 mb-1"><strong>Status:</strong> {order.status ? order.status.replace('_', ' ') : 'N/A'}</p>
                  <p className="text-gray-700"><strong>Pagamento:</strong> {order.formaPagamento || 'N/A'}</p>
                  <div className="mt-2 text-right">
                    <Link to={`/comanda/${order.id}`} className="text-blue-600 hover:underline text-sm">Ver Comanda</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}


export default ClientDetails;