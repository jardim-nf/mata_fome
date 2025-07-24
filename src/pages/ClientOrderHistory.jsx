import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom'; // Importe useNavigate aqui!
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';

function ClientOrderHistory() {
  const { currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate(); // Inicialize useNavigate aqui!

  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Redireciona se não houver usuário logado (esta página é exclusiva para clientes)
    if (!authLoading && !currentUser) {
      toast.warn('Você precisa estar logado para ver seu histórico de pedidos.');
      navigate('/'); // Redireciona para a home ou tela de login
      return;
    }

    if (currentUser) {
      const fetchOrders = async () => {
        setLoadingOrders(true);
        setError('');
        try {
          // Busca pedidos do usuário logado
          const q = query(
            collection(db, 'pedidos'),
            where('cliente.userId', '==', currentUser.uid),
            orderBy('criadoEm', 'desc')
          );
          const querySnapshot = await getDocs(q);
          const fetchedOrders = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setOrders(fetchedOrders);
        } catch (err) {
          console.error("Erro ao buscar histórico de pedidos:", err);
          setError("Não foi possível carregar seu histórico de pedidos.");
          toast.error("Erro ao carregar histórico de pedidos. Tente novamente.");
        } finally {
          setLoadingOrders(false);
        }
      };

      fetchOrders();
    }
  }, [currentUser, authLoading, navigate]); // Dependências

  const handleReorder = async (order) => {
    if (!order.itens || order.itens.length === 0) {
      toast.error('Este pedido não possui itens para ser refeito.');
      return;
    }

    // A lógica de re-pedido redireciona para o cardápio
    // e o Menu.jsx lerá os itens do localStorage
    try {
      // 1. Converte os itens do pedido para um formato que o carrinho entende
      const reorderItems = order.itens.map(item => ({
        id: item.id, // O ID original do item no cardápio
        nome: item.nome,
        preco: item.preco,
        qtd: item.quantidade,
        imageUrl: item.imageUrl || '' // Inclui a imagem se disponível
      }));

      // 2. Salva os itens no localStorage
      localStorage.setItem('reorderItems', JSON.stringify(reorderItems));

      // 3. Redireciona para o cardápio do estabelecimento
      // Certifique-se de que o pedido.estabelecimentoId está salvo e que o slug existe
      if (order.estabelecimentoId) {
        // Para buscar o slug do estabelecimento pelo ID
        const estabelecimentoDocRef = doc(db, 'estabelecimentos', order.estabelecimentoId);
        const estabelecimentoSnap = await getDoc(estabelecimentoDocRef); // Usando getDoc Firestore

        if (estabelecimentoSnap.exists() && estabelecimentoSnap.data().slug) {
          toast.info('Seu pedido anterior está sendo carregado no carrinho!');
          navigate(`/cardapio/${estabelecimentoSnap.data().slug}`);
        } else {
          toast.error('Estabelecimento do pedido anterior não encontrado ou slug indisponível.');
          localStorage.removeItem('reorderItems'); // Limpa se não conseguir redirecionar
        }
      } else {
        toast.error('O estabelecimento deste pedido não foi encontrado.');
        localStorage.removeItem('reorderItems');
      }
    } catch (error) {
      console.error("Erro ao preparar re-pedido:", error);
      toast.error('Erro ao preparar re-pedido. Tente novamente.');
      localStorage.removeItem('reorderItems');
    }
  };


  if (authLoading || loadingOrders) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <p className="text-xl text-gray-700">Carregando histórico de pedidos...</p>
      </div>
    );
  }

  if (!currentUser) {
    return null; // Já redirecionado no useEffect
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-red-100 text-red-700 p-4 text-center">
        <p className="text-xl font-semibold">Erro:</p>
        <p className="mt-2">{error}</p>
        <Link to="/" className="mt-4 bg-blue-500 text-white px-4 py-2 rounded">
          Voltar para Home
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-8">
        {/* <<-- BOTÃO VOLTAR ALTERADO PARA navigate(-1) -->> */}
        <button
          onClick={() => navigate(-1)} // Use navigate(-1) para voltar à tela anterior
          className="inline-flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition duration-300 mb-6"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Voltar
        </button>

        <h1 className="text-3xl font-bold text-center text-[var(--vermelho-principal)] mb-8">
          Meu Histórico de Pedidos
        </h1>

        {orders.length === 0 ? (
          <p className="text-center text-gray-600 italic py-8">Você ainda não fez nenhum pedido.</p>
        ) : (
          <ul className="space-y-6">
            {orders.map(order => (
              <li key={order.id} className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">Pedido #{order.id.substring(0, 8)}...</h3>
                    {order.criadoEm && (
                      <p className="text-sm text-gray-500">
                        {format(order.criadoEm.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    order.status === 'finalizado' ? 'bg-green-100 text-green-800' :
                    order.status === 'em_entrega' ? 'bg-orange-100 text-orange-800' :
                    order.status === 'em_preparo' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {order.status ? order.status.replace('_', ' ').charAt(0).toUpperCase() + order.status.replace('_', ' ').slice(1) : 'Desconhecido'}
                  </span>
                </div>

                <div className="mb-4">
                  <p className="text-gray-700"><strong>Itens:</strong></p>
                  <ul className="list-disc list-inside text-sm text-gray-600 ml-4">
                    {order.itens?.map((item, index) => (
                      <li key={index}>{item.quantidade}x {item.nome} (R$ {item.preco.toFixed(2).replace('.', ',')})</li>
                    ))}
                  </ul>
                </div>

                <div className="text-right text-lg font-bold text-gray-900 mb-4">
                  <p>Subtotal: R$ {order.itens.reduce((acc, item) => acc + (item.preco * item.quantidade), 0).toFixed(2).replace('.', ',')}</p>
                  {order.taxaEntrega > 0 && <p>Taxa de Entrega: R$ {order.taxaEntrega.toFixed(2).replace('.', ',')}</p>}
                  {order.cupomAplicado && order.cupomAplicado.descontoCalculado > 0 && (
                      <p className="text-green-700">Desconto ({order.cupomAplicado.codigo}): - R$ {order.cupomAplicado.descontoCalculado.toFixed(2).replace('.', ',')}</p>
                  )}
                  <p className="mt-2">Total: R$ {order.totalFinal.toFixed(2).replace('.', ',')}</p>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => navigate(`/comanda/${order.id}`)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md font-semibold"
                  >
                    Ver Comanda
                  </button>
                  <button
                    onClick={() => handleReorder(order)}
                    className="bg-[var(--vermelho-principal)] hover:bg-red-700 text-white px-4 py-2 rounded-md font-semibold"
                  >
                    Re-pedido
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default ClientOrderHistory;