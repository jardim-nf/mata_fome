// src/pages/ListaEstabelecimentos.jsx
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'; // Importe onSnapshot e query/orderBy
import { db } from '../firebase'; // Importe a instância do Firestore
import EstabelecimentoCard from '../components/EstabelecimentoCard'; // Importe o componente do card

function ListaEstabelecimentos() {
  const [estabelecimentos, setEstabelecimentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Referência à coleção de estabelecimentos
    const estabelecimentosRef = collection(db, 'estabelecimentos');
    
    // Opcional: Adicionar uma query para ordenar os estabelecimentos, por exemplo, por nome
    const q = query(estabelecimentosRef, orderBy('nome'));

    // onSnapshot para obter atualizações em tempo real da coleção
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id, // O ID do documento é crucial para o link do cardápio
          ...doc.data()
        }));
        setEstabelecimentos(data);
        setLoading(false);
      }, 
      (err) => {
        console.error("Erro ao carregar estabelecimentos:", err);
        setError("Não foi possível carregar os estabelecimentos. Tente novamente mais tarde.");
        setLoading(false);
      }
    );

    // Cleanup function: remove o listener quando o componente for desmontado
    return () => unsubscribe();
  }, []); // Array de dependências vazio para rodar apenas uma vez ao montar

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bege-claro)]">
        <p className="text-xl text-[var(--marrom-escuro)]">Carregando estabelecimentos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bege-claro)]">
        <p className="text-red-600 text-xl">{error}</p>
      </div>
    );
  }

  if (estabelecimentos.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bege-claro)]">
        <p className="text-gray-500 text-xl italic">Nenhum estabelecimento encontrado no momento.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bege-claro)] py-8 px-4">
      <div className="container mx-auto">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[var(--marrom-escuro)] text-center mb-10">
          Escolha seu Estabelecimento
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {estabelecimentos.map(estabelecimento => (
            <EstabelecimentoCard key={estabelecimento.id} estabelecimento={estabelecimento} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default ListaEstabelecimentos;