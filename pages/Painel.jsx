
import React, { useState } from 'react';
import PedidoCard from '../components/PedidoCard';
import FormularioPedido from '../components/FormularioPedido';

const STATUS_FLOW = ['Recebido', 'Preparando', 'Em Entrega', 'Entregue'];

function Painel() {
  const [pedidos, setPedidos] = useState([
    {
      id: '1',
      cliente: 'João Silva',
      status: 'Recebido',
      itens: [
        { nome: 'X-Burguer', quantidade: 1 },
        { nome: 'Batata Frita', quantidade: 1 }
      ]
    },
    {
      id: '2',
      cliente: 'Maria Oliveira',
      status: 'Preparando',
      itens: [
        { nome: 'X-Salada', quantidade: 2 },
        { nome: 'Refrigerante', quantidade: 2 }
      ]
    },
    {
      id: '3',
      cliente: 'Carlos Souza',
      status: 'Em Entrega',
      itens: [
        { nome: 'X-Bacon', quantidade: 1 }
      ]
    },
    {
      id: '4',
      cliente: 'Ana Lima',
      status: 'Entregue',
      itens: [
        { nome: 'Suco Natural', quantidade: 1 }
      ]
    }
  ]);

  const colunas = STATUS_FLOW.map(status => ({
    titulo: status,
    pedidos: pedidos.filter(p => p.status === status)
  }));

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-3xl font-bold text-center text-purple-700 mb-6">Painel de Pedidos</h1>
      <FormularioPedido />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {colunas.map((coluna, index) => (
          <div key={index} className="bg-white p-4 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center border-b pb-2">{coluna.titulo}</h2>
            <div className="flex flex-col gap-3">
              {coluna.pedidos.length > 0 ? (
                coluna.pedidos.map(pedido => (
                  <div key={pedido.id} className="bg-gray-50 border rounded-md p-3 shadow-sm">
                    <p className="font-medium">{pedido.cliente}</p>
                    <ul className="text-sm mt-2">
                      {pedido.itens.map((item, i) => (
                        <li key={i}>• {item.nome} - {item.quantidade}</li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-400">Nenhum pedido</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Painel;
