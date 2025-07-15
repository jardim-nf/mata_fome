// src/pages/NossosClientes.jsx
import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase'; // Certifique-se de que o caminho para o seu 'db' está correto
import { Link } from 'react-router-dom'; // Para o botão de voltar, se desejar

function NossosClientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const clientesCollection = collection(db, 'users'); // Nome da sua coleção de usuários/clientes
        const clientesSnapshot = await getDocs(clientesCollection);
        const clientesList = clientesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setClientes(clientesList);
      } catch (err) {
        console.error("Erro ao buscar clientes:", err);
        setError("Não foi possível carregar a lista de clientes.");
      } finally {
        setLoading(false);
      }
    };

    fetchClientes();
  }, []); // O array vazio garante que o useEffect rode apenas uma vez ao montar o componente

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-white">
        <p className="text-[var(--marrom-escuro)]">Carregando clientes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-white text-red-500">
        <p>{error}</p>
        <Link to="/" className="mt-4 text-[var(--vermelho-principal)] underline">Voltar para a Home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fff8ec] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-[var(--marrom-escuro)] text-center mb-10">Nossos Clientes</h1>

        {clientes.length === 0 ? (
          <p className="text-center text-gray-600 text-lg">Nenhum cliente cadastrado ainda.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clientes.map((cliente) => (
              <div key={cliente.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition duration-300">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">{cliente.nome || 'Nome Indisponível'}</h2>
                <p className="text-gray-600 text-sm mb-1">Email: {cliente.email || 'Não informado'}</p>
                {/* Adicione mais informações do cliente aqui, se houver */}
                {/* Exemplo: <p className="text-gray-600 text-sm">Telefone: {cliente.telefone || 'Não informado'}</p> */}
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link
            to="/"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-full shadow-sm text-white bg-[var(--vermelho-principal)] hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--vermelho-principal)]"
          >
            Voltar para a Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NossosClientes;