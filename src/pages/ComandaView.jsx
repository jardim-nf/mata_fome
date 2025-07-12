// src/pages/ComandaView.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore'; // Importe doc e getDoc
import { db } from '../firebase'; // Importe a instância do Firestore

function ComandaView() {
  const { pedidoId } = useParams(); // Pega o ID do pedido da URL
  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pedidoId) {
      setError("ID do pedido não fornecido na URL.");
      setLoading(false);
      return;
    }

    const fetchPedido = async () => {
      try {
        const pedidoRef = doc(db, 'pedidos', pedidoId); // Referência ao documento do pedido
        const pedidoSnap = await getDoc(pedidoRef); // Busca o documento

        if (pedidoSnap.exists()) {
          setPedido({ id: pedidoSnap.id, ...pedidoSnap.data() }); // Salva o pedido no estado
        } else {
          setError("Pedido não encontrado no banco de dados.");
        }
      } catch (err) {
        console.error("Erro ao carregar pedido:", err);
        setError("Erro ao carregar os detalhes do pedido. Verifique o console para mais informações.");
      } finally {
        setLoading(false); // Finaliza o estado de carregamento
      }
    };

    fetchPedido(); // Chama a função para buscar o pedido
  }, [pedidoId]); // Roda novamente se o ID do pedido na URL mudar

  // Efeito para acionar a impressão automaticamente quando o pedido é carregado e a página está pronta
  useEffect(() => {
    if (pedido && !loading && !error) {
      // Pequeno atraso para garantir que o DOM foi renderizado antes de imprimir
      const timer = setTimeout(() => {
        window.print(); // Abre a caixa de diálogo de impressão
        // Opcional: window.close(); // Fecha a janela após a impressão (pode atrapalhar se o user quiser salvar como PDF)
      }, 500); 
      return () => clearTimeout(timer); // Limpa o timer se o componente for desmontado
    }
  }, [pedido, loading, error]); // Dependências para este useEffect

  if (loading) {
    return <div className="text-center p-4 text-[var(--marrom-escuro)]">Carregando comanda...</div>;
  }

  if (error) {
    return <div className="text-center p-4 text-red-600 font-semibold">{error}</div>;
  }

  if (!pedido) {
    return <div className="text-center p-4 text-gray-500 italic">Pedido não disponível.</div>;
  }

  // Calcula o total do pedido
  const totalPedido = pedido.itens ? pedido.itens.reduce((acc, item) => acc + (item.preco * item.quantidade), 0) : 0;
  // Formata a data do pedido
  const dataPedido = pedido.criadoEm && typeof pedido.criadoEm.toDate === 'function' 
                     ? pedido.criadoEm.toDate().toLocaleString('pt-BR') 
                     : 'Data não disponível';

  return (
    <div className="comanda-print-area p-6 bg-white max-w-sm mx-auto my-4 border border-gray-300 rounded-lg shadow-lg text-gray-800 font-mono">
      <h1 className="text-2xl font-bold text-center mb-4 border-b-2 border-gray-400 pb-2">COMANDA DO PEDIDO</h1>
      
      <div className="mb-4">
        <p className="font-semibold text-lg">Cliente: {pedido.cliente?.nome || 'N/A'}</p>
        <p className="text-sm">Telefone: {pedido.cliente?.telefone || 'N/A'}</p>
        <p className="text-sm">Pedido ID: {pedido.id}</p>
        <p className="text-sm">Data: {dataPedido}</p>
      </div>

      <div className="border-t border-b border-gray-300 py-3 mb-4">
        <h2 className="text-xl font-bold mb-2">Itens:</h2>
        <ul className="list-none p-0 m-0 space-y-2">
          {pedido.itens?.map((item, index) => (
            <li key={index} className="flex justify-between items-start text-base">
              <span>{item.quantidade}x {item.nome}</span>
              <span>R$ {(item.preco * item.quantidade).toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="text-right text-xl font-bold mt-4">
        <p>Total: R$ {totalPedido.toFixed(2)}</p>
      </div>

      <p className="text-center text-xs mt-6 text-gray-600">
        Aguardando preparo da cozinha.
      </p>
    </div>
  );
}

export default ComandaView;