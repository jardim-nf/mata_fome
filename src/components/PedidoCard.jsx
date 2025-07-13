// src/components/PedidoCard.jsx
import React from "react";

// Adicionado 'excluirPedido' nas props
function PedidoCard({ pedido, mudarStatus, excluirPedido }) {
  const status = (pedido?.status || "recebido").toLowerCase();

  const coresPorStatus = {
    recebido: "bg-gray-100 border-gray-300",
    preparo: "bg-yellow-100 border-yellow-300",
    preparando: "bg-yellow-100 border-yellow-300",
    "em entrega": "bg-blue-100 border-blue-300",
    entregando: "bg-blue-100 border-blue-300",
    finalizado: "bg-[var(--verde-destaque)] bg-opacity-20 border-[var(--verde-destaque)]",
  };

  const bgColor = coresPorStatus[status] || "bg-white border-gray-200";

  const abrirComanda = () => {
    window.open(`/comanda/${pedido.id}`, '_blank', 'width=400,height=600');
  };

  // Lógica para determinar a visibilidade do botão Comanda
  const showComandaButton = status === "recebido" || status === "entregando";

  return (
    <div className={`border ${bgColor} rounded-xl p-4 shadow-md`}>
      <p className="font-semibold text-lg text-[var(--marrom-escuro)]">
        {pedido?.cliente?.nome || "Cliente não informado"}
      </p>
      <p className="text-sm text-[var(--cinza-texto)] mb-2 capitalize">Status: {status}</p>

      <ul className="text-sm text-[var(--cinza-texto)] mb-3 space-y-1">
        {pedido?.itens?.map((item, i) => (
          <li key={i}>
            • {item.nome} - {item.quantidade}
          </li>
        ))}
      </ul>

      {pedido?.itens && pedido.itens.length > 0 && (
        <p className="font-bold text-[var(--marrom-escuro)] text-right mb-2">
          Total: R$ {(pedido.itens.reduce((acc, item) => acc + (item.preco * item.quantidade), 0)).toFixed(2)}
        </p>
      )}

      <div className="flex gap-2 flex-wrap mt-2">
        <button
          onClick={() => mudarStatus(pedido.id, "preparo")}
          className="bg-[var(--marrom-escuro)] hover:bg-[var(--vermelho-principal)] text-white px-3 py-1 rounded text-sm shadow transition duration-300"
        >
          🔧 Preparo
        </button>

        <button
          onClick={() => mudarStatus(pedido.id, "entregando")}
          className="bg-[var(--vermelho-principal)] hover:bg-red-700 text-white px-3 py-1 rounded text-sm shadow transition duration-300"
        >
          🚚 Entregar
        </button>

        <button
          onClick={() => mudarStatus(pedido.id, "finalizado")}
          className="bg-[var(--verde-destaque)] hover:bg-green-700 text-white px-3 py-1 rounded text-sm shadow transition duration-300"
        >
          ✅ Finalizar
        </button>

        {showComandaButton && (
          <button
            onClick={abrirComanda}
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm shadow transition duration-300"
          >
            📄 Comanda
          </button>
        )}

        {/* <<< NOVO BOTÃO DE EXCLUIR PEDIDO >>> */}
        <button
          onClick={() => excluirPedido(pedido.id)} // Chama a função passada via props
          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm shadow transition duration-300"
        >
          🗑️ Excluir
        </button>
      </div>
    </div>
  );
}

export default PedidoCard;