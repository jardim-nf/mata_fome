import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { db } from "../../firebase"; 
import PedidoItem from "../../components/PedidoItem";
import ModalPagamento from "../../components/ModalPagamento";
import PromptDialog from "../../components/ui/PromptDialog";
import { toast } from "react-toastify";
import { getTerminology } from "../../utils/terminologyUtils";

export default function MesaDetalhe() {
  // 🔥 CORREÇÃO 1: Pegar o estabelecimentoId da URL também
  const { estabelecimentoId, id } = useParams(); 
  const navigate = useNavigate();
  const [mesa, setMesa] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [promptNome, setPromptNome] = useState({ open: false });
  const [tipoNegocio, setTipoNegocio] = useState("restaurante");

  useEffect(() => {
    if (!estabelecimentoId) return;
    const fetchTipo = async () => {
      try {
        const estDoc = await getDoc(doc(db, "estabelecimentos", estabelecimentoId));
        if (estDoc.exists()) {
          setTipoNegocio(estDoc.data().tipoNegocio || "restaurante");
        }
      } catch (e) {
        console.error("Erro ao buscar estabelecimento:", e);
      }
    };
    fetchTipo();
  }, [estabelecimentoId]);

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

  const adicionarItem = () => {
    setPromptNome({ open: true });
  };

  const executarAdicionarItem = async (nomeValor) => {
    setPromptNome({ open: false });
    const nomeCliente = nomeValor || getTerminology('mesa', tipoNegocio);

    // 🔥 CORREÇÃO 3: Adicionar item na pasta do estabelecimento correto
    const mesaRef = doc(db, "estabelecimentos", estabelecimentoId, "mesas", id);
    try {
      await updateDoc(mesaRef, {
        pedidos: arrayUnion({
          nome: "Produto Exemplo", 
          qtd: 1,
          preco: 10,
          destinatario: nomeCliente, 
          criadoEm: new Date().toISOString(),
        }),
      });
      toast.success("Item adicionado com sucesso!");
    } catch (e) {
      toast.error("Erro ao adicionar item.");
    }
  };

  const solicitarImpressao = async () => {
    try {
      // 🔥 CORREÇÃO 4: Solicitar impressão na pasta do estabelecimento correto
      const mesaRef = doc(db, "estabelecimentos", estabelecimentoId, "mesas", id);
      await updateDoc(mesaRef, {
        solicitarImpressaoConferencia: true,
        timestampImpressao: new Date().toISOString() 
      });
      toast.success("Conferência enviada para a impressora do caixa!");
    } catch (erro) {
      console.error("Erro ao solicitar impressão:", erro);
      toast.error("Erro ao comunicar com a impressora.");
    }
  };

  if (!mesa) return <p>Carregando...</p>;

  return (
    <div className="p-4">
      <PromptDialog
        open={promptNome.open}
        title="Nome do Cliente"
        message={`Nome do cliente (Deixe vazio para '${getTerminology('mesa', tipoNegocio)}'):`}
        placeholder="Ex: João"
        confirmText="Adicionar"
        cancelText="Cancelar"
        onConfirm={executarAdicionarItem}
        onCancel={() => setPromptNome({ open: false })}
      />

      <button
        onClick={() => navigate(-1)}
        className="mb-4 px-3 py-1 bg-gray-200 rounded"
      >
        Voltar
      </button>

      <h1 className="text-2xl font-bold mb-2">{getTerminology('mesa', tipoNegocio)} {mesa.numero}</h1>
      <p className="mb-4">Status: {mesa.status}</p>

      {/* Lista de Pedidos na Tela da Mesa */}
      <div className="space-y-2">
        {mesa.pedidos?.map((pedido, idx) => (
          <div key={idx} className="border p-2 rounded flex justify-between">
             <span>{pedido.qtd}x {pedido.nome} <small className="text-gray-500">({pedido.destinatario || getTerminology('mesa', tipoNegocio)})</small></span>
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
