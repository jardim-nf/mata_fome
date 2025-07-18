// src/pages/HistoricoCliente.jsx (Exemplo)
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';
import PedidoCard from '../components/PedidoCard'; // Reutilize o PedidoCard para exibir os pedidos

function HistoricoCliente() {
  const { telefone } = useParams(); // Pega o telefone da URL
  const [pedidosCliente, setPedidosCliente] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!telefone) {
      setError("Telefone do cliente não fornecido na URL.");
      setLoading(false);
      return;
    }

    const cleanPhone = telefone.replace(/\D/g, ""); // Garante que o telefone esteja limpo
    if (!cleanPhone) {
        setError("Telefone inválido na URL.");
        setLoading(false);
        return;
    }

    // Query para buscar pedidos pelo telefone do cliente
    const q = query(
      collection(db, "pedidos"),
      where("cliente.telefone", "==", cleanPhone), // Busca pedidos onde o telefone do cliente corresponde
      orderBy("criadoEm", "desc") // Ordena pelo mais recente
    );

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const pedidosData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setPedidosCliente(pedidosData);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Erro ao buscar histórico do cliente:", err);
        setError("Erro ao carregar histórico de pedidos.");
        setLoading(false);
        toast.error("Erro ao carregar histórico de pedidos.");
      }
    );

    return () => unsubscribe();
  }, [telefone]); // Re-executa se o telefone na URL mudar

  if (loading) {
    return <div className="text-center p-4">Carregando histórico de pedidos...</div>;
  }

  if (error) {
    return (
      <div className="text-center p-4 text-red-600">
        <p>Erro: {error}</p>
        <Link to="/painel" className="text-blue-500 hover:underline mt-4 block">Voltar ao Painel</Link>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <Link to="/painel" className="flex items-center text-gray-600 hover:text-gray-900 mb-6">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
        Voltar ao Painel
      </Link>
      <h1 className="text-3xl font-bold text-[var(--marrom-escuro)] mb-6 text-center">
        Histórico de Pedidos de {pedidosCliente[0]?.cliente?.nome || 'Cliente'} ({telefone})
      </h1>

      <div className="max-w-4xl mx-auto space-y-4">
        {pedidosCliente.length === 0 ? (
          <p className="text-center text-gray-500">Nenhum pedido encontrado para este cliente.</p>
        ) : (
          pedidosCliente.map(pedido => (
            // Reutiliza o PedidoCard para exibir cada pedido no histórico
            // Note que aqui os botões de ação do PedidoCard podem não ser relevantes,
            // ou você pode querer desabilitá-los/ocultá-los via props, dependendo do contexto.
            <PedidoCard
              key={pedido.id}
              pedido={pedido}
              // Você pode passar estabelecimento, autoPrintEnabled, etc., se forem relevantes aqui
              // Ou passar props para desabilitar botões de ação se este for um painel de "apenas visualização"
              estabelecimento={null} // Ou o objeto estabelecimento se disponível
              autoPrintEnabled={false}
              excluirPedido={() => toast.info('Exclusão desabilitada no histórico.')}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default HistoricoCliente;