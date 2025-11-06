// src/pages/admin/ClientDetails.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, orderBy, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from "../context/AuthContext";
import withAuth from '../hocs/withAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';

function ClientDetails() {
  const { clientId } = useParams();
  const { isMasterAdmin } = useAuth();

  const [clientData, setClientData] = useState(null);
  const [clientOrders, setClientOrders] = useState([]);
  const [loadingClient, setLoadingClient] = useState(true);
  const [error, setError] = useState('');

  // Estados para o modo de edição
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [userCollection, setUserCollection] = useState(null); // Para saber se é 'clientes' ou 'usuarios'

  useEffect(() => {
    if (clientId) {
      const fetchClientDetails = async () => {
        try {
          let dataRef = doc(db, 'clientes', clientId);
          let dataSnap = await getDoc(dataRef);
          let sourceCollection = 'clientes';

          if (!dataSnap.exists()) {
            console.log(`ID ${clientId} não encontrado em 'clientes'. Tentando em 'usuarios'...`);
            dataRef = doc(db, 'usuarios', clientId);
            dataSnap = await getDoc(dataRef);
            sourceCollection = 'usuarios';
          }

          if (dataSnap.exists()) {
            const clientData = { id: dataSnap.id, ...dataSnap.data() };
            setClientData(clientData);
            setFormData(clientData); // Preenche o formData também
            setUserCollection(sourceCollection); // Salva a origem dos dados
          } else {
            setError('Dados do cliente ou usuário não encontrados.');
            toast.error('Dados do cliente ou usuário não encontrados.');
            setClientData(null);
          }

          // Buscar pedidos do cliente
          const ordersCollectionRef = collection(db, 'pedidos');
          const qOrders = query(ordersCollectionRef, where('cliente.userId', '==', clientId), orderBy('criadoEm', 'desc'));
          const ordersSnapshot = await getDocs(qOrders);
          const ordersList = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setClientOrders(ordersList);

        } catch (err) {
          console.error("Erro ao carregar detalhes:", err);
          setError("Erro ao carregar os detalhes. Verifique a conexão e permissões.");
          toast.error("Erro ao carregar os detalhes.");
        } finally {
          setLoadingClient(false);
        }
      };
      fetchClientDetails();
    }
  }, [clientId]);
  
  // Funções para controlar a edição
  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setFormData(clientData); // Restaura os dados originais
    setIsEditing(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // Lida com campos de endereço aninhados
    if (name.startsWith('endereco.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        endereco: { ...prev.endereco, [field]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    if (!userCollection) {
      toast.error("Erro: Não foi possível determinar onde salvar os dados.");
      return;
    }
    try {
      const userDocRef = doc(db, userCollection, clientId);
      
      // Prepara os dados para salvar (remove campos que não devem ser atualizados)
      const { id, email, criadoEm, ...dataToUpdate } = formData;
      
      await updateDoc(userDocRef, dataToUpdate);
      setClientData(formData); // Atualiza os dados na tela
      setIsEditing(false); // Sai do modo de edição
      toast.success("Dados do usuário atualizados com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar as alterações:", error);
      toast.error("Ocorreu um erro ao salvar. Tente novamente.");
    }
  };

  if (loadingClient) { 
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <p className="text-xl text-gray-700">Carregando detalhes...</p>
      </div>
    ); 
  }

  if (error) { 
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-red-100 text-red-700 p-4 text-center">
        <p className="text-xl font-semibold">Erro:</p>
        <p className="mt-2">{error}</p>
        <Link 
          to={isMasterAdmin ? "/admin/usuarios" : "/painel"} 
          className="mt-6 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
        >
          Voltar para o Painel
        </Link>
      </div>
    ); 
  }

  if (!clientData) { 
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100 text-gray-700 p-4 text-center">
        <p className="text-xl font-semibold">Usuário não encontrado.</p>
        <Link 
          to={isMasterAdmin ? "/admin/usuarios" : "/painel"} 
          className="mt-6 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
        >
          Voltar para o Painel
        </Link>
      </div>
    ); 
  }

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-8">
        <div className="flex justify-between items-center mb-6">
            <Link 
              to={isMasterAdmin ? "/admin/usuarios" : "/painel"} 
              className="inline-flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition duration-300"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Voltar
            </Link>
            
            {/* Botões de ação (Editar / Salvar / Cancelar) */}
            <div className="flex gap-4">
                {isEditing ? (
                    <>
                        <button 
                          onClick={handleSave} 
                          className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition duration-300"
                        >
                          Salvar
                        </button>
                        <button 
                          onClick={handleCancel} 
                          className="px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition duration-300"
                        >
                          Cancelar
                        </button>
                    </>
                ) : (
                    <button 
                      onClick={handleEdit} 
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition duration-300"
                    >
                      Editar
                    </button>
                )}
            </div>
        </div>

        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">
          Detalhes de: {clientData.nome || clientData.email}
        </h1>

        {/* Informações de Contato */}
        <div className="mb-8 border-b pb-4 space-y-4">
          <h2 className="text-xl font-semibold text-gray-700">Informações de Contato</h2>
          <div>
            <label className="text-sm font-medium text-gray-500">Nome</label>
            {isEditing ? (
              <input 
                type="text" 
                name="nome" 
                value={formData.nome || ''} 
                onChange={handleInputChange} 
                className="w-full border border-gray-300 rounded-md p-2 mt-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <p className="text-gray-700">{clientData.nome || 'Não informado'}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Email</label>
            <p className="text-gray-500 bg-gray-100 p-2 rounded-md mt-1">
              {clientData.email || 'Não informado'}
            </p> {/* Email não é editável */}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Telefone</label>
            {isEditing ? (
              <input 
                type="tel" 
                name="telefone" 
                value={formData.telefone || ''} 
                onChange={handleInputChange} 
                className="w-full border border-gray-300 rounded-md p-2 mt-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <p className="text-gray-700">{clientData.telefone || 'Não informado'}</p>
            )}
          </div>
          {clientData.criadoEm && (
            <p className="text-sm text-gray-500">
              <strong>Membro desde:</strong> {format(clientData.criadoEm.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
            </p>
          )}
        </div>

        {/* Endereço Principal */}
        {clientData.endereco && (
          <div className="mb-8 border-b pb-4 space-y-4">
            <h2 className="text-xl font-semibold text-gray-700">Endereço Principal</h2>
            <div>
                <label className="text-sm font-medium text-gray-500">Rua</label>
                {isEditing ? (
                  <input 
                    type="text" 
                    name="endereco.rua" 
                    value={formData.endereco?.rua || ''} 
                    onChange={handleInputChange} 
                    className="w-full border border-gray-300 rounded-md p-2 mt-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-700">{clientData.endereco.rua || 'Não informado'}</p>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="text-sm font-medium text-gray-500">Número</label>
                    {isEditing ? (
                      <input 
                        type="text" 
                        name="endereco.numero" 
                        value={formData.endereco?.numero || ''} 
                        onChange={handleInputChange} 
                        className="w-full border border-gray-300 rounded-md p-2 mt-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <p className="text-gray-700">{clientData.endereco.numero || 'Não informado'}</p>
                    )}
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-500">Bairro</label>
                    {isEditing ? (
                      <input 
                        type="text" 
                        name="endereco.bairro" 
                        value={formData.endereco?.bairro || ''} 
                        onChange={handleInputChange} 
                        className="w-full border border-gray-300 rounded-md p-2 mt-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    ) : (
                      <p className="text-gray-700">{clientData.endereco.bairro || 'Não informado'}</p>
                    )}
                </div>
            </div>
             <div>
                <label className="text-sm font-medium text-gray-500">Complemento</label>
                {isEditing ? (
                  <input 
                    type="text" 
                    name="endereco.complemento" 
                    value={formData.endereco?.complemento || ''} 
                    onChange={handleInputChange} 
                    className="w-full border border-gray-300 rounded-md p-2 mt-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-700">{clientData.endereco.complemento || 'Não informado'}</p>
                )}
            </div>
            <div>
                <label className="text-sm font-medium text-gray-500">Cidade</label>
                {isEditing ? (
                  <input 
                    type="text" 
                    name="endereco.cidade" 
                    value={formData.endereco?.cidade || ''} 
                    onChange={handleInputChange} 
                    className="w-full border border-gray-300 rounded-md p-2 mt-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-700">{clientData.endereco.cidade || 'Não informado'}</p>
                )}
            </div>
          </div>
        )}

        {/* Histórico de Pedidos */}
        <div>
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Histórico de Pedidos ({clientOrders.length})
          </h2>
          {clientOrders.length === 0 ? (
            <p className="text-gray-500 italic">Este usuário não possui histórico de pedidos.</p>
          ) : (
            <ul className="space-y-4">
              {clientOrders.map(order => ( 
                <li key={order.id} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-lg text-gray-800">
                      Pedido #{order.id.substring(0, 8)}...
                    </h3>
                    {order.criadoEm && (
                      <span className="text-sm text-gray-500">
                        {format(order.criadoEm.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700 mb-1">
                    <strong>Total:</strong> R$ {order.totalFinal ? order.totalFinal.toFixed(2).replace('.', ',') : 'N/A'}
                  </p>
                  <p className="text-gray-700 mb-1">
                    <strong>Status:</strong> {order.status ? order.status.replace('_', ' ') : 'N/A'}
                  </p>
                  <p className="text-gray-700">
                    <strong>Pagamento:</strong> {order.formaPagamento || 'N/A'}
                  </p>
                  <div className="mt-2 text-right">
                    <Link 
                      to={`/comanda/${order.id}`} 
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Ver Comanda
                    </Link>
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

// ✅ Aplica o HOC de autenticação
// - Requer autenticação E permissão de admin OU master
// - Esta página pode ser acessada por ambos (master e admin)
export default withAuth(ClientDetails, { 
  requireAdmin: true,
  message: 'Acesso aos detalhes do cliente restrito' 
});