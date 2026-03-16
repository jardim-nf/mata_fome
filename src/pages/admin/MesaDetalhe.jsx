import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../../firebase"; 
import PedidoItem from "../../components/PedidoItem";
import ModalPagamento from "../../components/ModalPagamento";

export default function MesaDetalhe() {
  // 🔥 CORREÇÃO 1: Pegar o estabelecimentoId da URL também
  const { estabelecimentoId, id } = useParams(); 
  const navigate = useNavigate();
  const [mesa, setMesa] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);

  useEffect(() => {
    // Evita rodar se a URL ainda não carregou os IDs
    if (!estabelecimentoId || !id) return;

    // 🔥 CORREÇÃO 2: Escutar a mesa dentro da pasta do estabelecimento correto
    const unsub = onSnapshot(doc(db, "estabelecimentos", estabelecimentoId, "mesas", id), (snap) => {
      if (snap.exists()) {
        setMesa({ id: snap.id, ...snap.data() });
      }
    });
    return () => unsub();
  }, [estabelecimentoId, id]);

  const adicionarItem = async () => {
    const nomeCliente = prompt("Nome do cliente (Deixe vazio para 'Mesa'):") || "Mesa";

    // 🔥 CORREÇÃO 3: Adicionar item na pasta do estabelecimento correto
    const mesaRef = doc(db, "estabelecimentos", estabelecimentoId, "mesas", id);
    await updateDoc(mesaRef, {
      pedidos: arrayUnion({
        nome: "Produto Exemplo", 
        qtd: 1,
        preco: 10,
        destinatario: nomeCliente, 
        criadoEm: new Date().toISOString(),
      }),
    });
  };

  const solicitarImpressao = async () => {
    try {
      // 🔥 CORREÇÃO 4: Solicitar impressão na pasta do estabelecimento correto
      const mesaRef = doc(db, "estabelecimentos", estabelecimentoId, "mesas", id);
      await updateDoc(mesaRef, {
        solicitarImpressaoConferencia: true,
        timestampImpressao: new Date().toISOString() 
      });
      alert("Conferência enviada para a impressora do caixa!");
    } catch (erro) {
      console.error("Erro ao solicitar impressão:", erro);
      alert("Erro ao comunicar com a impressora.");
    }
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

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={adicionarItem}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Adicionar Item
        </button>

        <button
          onClick={solicitarImpressao}
          className="px-4 py-2 bg-yellow-500 text-white rounded"
        >
          Imprimir Conferência
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
          // 🔥 BÔNUS: Agora o pagamento vai pro estabelecimento certo! (Tirei o SEU_ID_AQUI)
          estabelecimentoId={estabelecimentoId} 
          onClose={() => setModalAberto(false)}
          onSucesso={() => navigate(`/estabelecimento/${estabelecimentoId}/salao`)} 
        />
      )}
    </div>
  );
}
