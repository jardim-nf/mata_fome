import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../../firebase"; // Verifique se o caminho está correto (../ ou ../../)
import PedidoItem from "../../components/PedidoItem";
import ModalPagamento from "../../components/ModalPagamento";

export default function MesaDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [mesa, setMesa] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "mesas", id), (snap) => {
      if (snap.exists()) {
        setMesa({ id: snap.id, ...snap.data() });
      }
    });
    return () => unsub();
  }, [id]);

  const adicionarItem = async () => {
    // 1. PERGUNTA QUEM ESTÁ PEDINDO (Essencial para dividir a conta depois)
    const nomeCliente = prompt("Nome do cliente (Deixe vazio para 'Mesa'):") || "Mesa";

    const mesaRef = doc(db, "mesas", id);
    await updateDoc(mesaRef, {
      pedidos: arrayUnion({
        nome: "Produto Exemplo", // Aqui entraria a lógica de selecionar produto
        qtd: 1,
        preco: 10,
        destinatario: nomeCliente, // <--- CAMPO CHAVE PARA O PAGAMENTO
        criadoEm: new Date().toISOString(),
      }),
    });
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

      {/* Lista de Pedidos na Tela da Mesa */}
      <div className="space-y-2">
        {mesa.pedidos?.map((pedido, idx) => (
          <div key={idx} className="border p-2 rounded flex justify-between">
             <span>{pedido.qtd}x {pedido.nome} <small className="text-gray-500">({pedido.destinatario || 'Mesa'})</small></span>
             <span>R$ {pedido.preco}</span>
          </div>
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
          onClick={() => setModalAberto(true)}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Pagar / Finalizar
        </button>
      </div>

      {modalAberto && (
        <ModalPagamento 
          mesa={mesa} 
          estabelecimentoId="SEU_ID_AQUI" 
          onClose={() => setModalAberto(false)}
          onSucesso={() => navigate("/controle-salao")}
        />
      )}
    </div>
  );
}