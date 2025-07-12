import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import CardapioItem from '../components/CardapioItem';

function Cardapio() {
  const [itens, setItens] = useState([]);
  const [carrinho, setCarrinho] = useState([]);

  useEffect(() => {
    const fetchItens = async () => {
      const snap = await getDocs(collection(db, 'cardapio'));
      const lista = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setItens(lista);
    };
    fetchItens();
  }, []);

  const addToCart = (item) => {
    setCarrinho(prev => [...prev, item]);
  };

  const grouped = itens.reduce((acc, i) => {
    acc[i.categoria] = acc[i.categoria] || [];
    acc[i.categoria].push(i);
    return acc;
  }, {});

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Cardápio 🧾</h1>

      <div className="mb-6 p-4 border rounded bg-gray-100">
        <h2 className="font-bold text-xl mb-2">Carrinho 🛒</h2>
        {carrinho.length === 0 ? (
          <p>Seu carrinho está vazio.</p>
        ) : (
          <ul>
            {carrinho.map((i, idx) => (
              <li key={idx}>
                {i.nome} — R$ {i.preco.toFixed(2)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {Object.entries(grouped).map(([cat, lista]) => (
        <div key={cat} className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">{cat}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lista.map(item => (
              <CardapioItem key={item.id} item={item} addToCart={addToCart} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default Cardapio;
