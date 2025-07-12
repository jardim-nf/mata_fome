
import React, { useState, useEffect } from 'react';
import PedidosKanban from './components/PedidosKanban';
import { db } from './firebase';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  getDocs
} from 'firebase/firestore';

const App = () => {
  const [pedidos, setPedidos] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "pedidos"), (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPedidos(lista);
    });
    return () => unsub();
  }, []);

  const atualizarStatus = async (id, novoStatus) => {
    const ref = doc(db, "pedidos", id);
    await updateDoc(ref, { status: novoStatus });
  };

  return (
    <div className="min-h-screen bg-gray-200">
      <h1 className="text-3xl font-bold text-center p-6">Painel de Pedidos</h1>
      <PedidosKanban pedidos={pedidos} atualizarStatus={atualizarStatus} />
    </div>
  );
};

export default App;
