import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";
import PedidoItem from "../components/PedidoItem";

export default function MesaDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [mesa, setMesa] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "mesas", id), (snap) => {
      if (snap.exists()) {
        setMesa({ id: snap.id, ...snap.data() });
      }
    });
    return () => unsub();
  }, [id]);

  const adicionarItem = async () => {
    // exemplo: adicionar produto manualmente
    const mesaRef = doc(db, "mesas", id);
    await updateDoc(mesaRef, {
      pedidos: arrayUnion({
        nome: "Produto Exemplo",
        qtd: 1,
        preco: 10,
        criadoEm: new Date().toISOString(),
      }),
    });
  };

  const finalizarMesa = async () => {
    const mesaRef = doc(db, "mesas", id);
    await updateDoc(mesaRef, {
      status: "fechada",
      fechadoEm: new Date().toISOString(),
    });
    navigate("/controle-salao");
  };

  if (!mesa) return <p>Carregando...</p>;

  return (
    <div className="p-4">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 px-3 py-1 bg-gray-200 rounded"
      >
        Voltar
      </button>

      <h1 className="text-2xl font-bold mb-2">Mesa {mesa.numero}</h1>
      <p className="mb-4">Status: {mesa.status}</p>

      <div className="space-y-2">
        {mesa.pedidos?.map((pedido, idx) => (
          <PedidoItem key={idx} pedido={pedido} />
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={adicionarItem}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Adicionar Item
        </button>
        <button
          onClick={finalizarMesa}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Finalizar Mesa
        </button>
      </div>
    </div>
  );
}
