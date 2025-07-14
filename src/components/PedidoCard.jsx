// src/components/PedidoCard.jsx
import React from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from 'react-router-dom'; // IMPORTAR useNavigate AQUI

// REMOVER 'navigate' das props
function PedidoCard({ pedido, mudarStatus, excluirPedido, estabelecimentoPixKey, estabelecimento }) { 
  const navigate = useNavigate(); // <-- PEGAR O NAVIGATE DIRETAMENTE AQUI

  const status = (pedido?.status || "recebido").toLowerCase();
  const formaPagamento = (pedido?.formaPagamento || "").toLowerCase();
  const statusPagamentoPix = (pedido?.statusPagamentoPix || "").toLowerCase();

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
    // AGORA, 'navigate' SEMPRE ESTARÁ DISPONÍVEL AQUI
    navigate(`/comanda/${pedido.id}`); 
  };

  const showComandaButton = status === "recebido" || status === "entregando";

  const openWhatsAppLink = (message, phoneNumber, actionDescription = "mensagem") => {
    if (!phoneNumber) {
      alert(`Erro: Telefone do cliente não disponível para enviar ${actionDescription}.`);
      return false;
    }
    const numeroLimpo = phoneNumber.replace(/\D/g, "");
    if (!numeroLimpo) {
        alert(`Erro: Número de telefone inválido para enviar ${actionDescription}.`);
        return false;
    }

    const texto = encodeURIComponent(message);
    const url = `https://wa.me/55${numeroLimpo}?text=${texto}`;
    
    try {
      window.open(url, "_blank"); // WhatsApp ainda abre em nova aba/janela
      console.log(`📤 Abrindo WhatsApp para ${actionDescription}:`, url);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao abrir WhatsApp para ${actionDescription}:`, error);
      alert(`Não foi possível abrir o WhatsApp para ${actionDescription}. Verifique as configurações do seu navegador ou tente novamente.`);
      return false;
    }
  };

  const enviarMensagemPixComChave = async () => {
    if (!estabelecimentoPixKey) {
      alert("Chave PIX do estabelecimento não configurada. Por favor, adicione a chave PIX nas informações do estabelecimento no Firestore.");
      return;
    }

    const nomeCliente = pedido.cliente?.nome || "Cliente";
    const totalPedido = pedido.totalFinal ? pedido.totalFinal.toFixed(2).replace('.', ',') : (pedido.itens ? pedido.itens.reduce((acc, item) => acc + (item.preco * item.quantidade), 0).toFixed(2).replace('.', ',') : 'N/A');

    const mensagem = `Olá ${nomeCliente}, seu pedido no ${estabelecimento} está aguardando pagamento via PIX!
    
Valor total: R$ ${totalPedido}.

*Chave PIX:* ${estabelecimentoPixKey}

Por favor, faça o pagamento para que possamos iniciar o preparo do seu pedido. 😊
Obrigado!`;

    const success = openWhatsAppLink(mensagem, pedido.cliente?.telefone, "mensagem PIX");
    if (success) {
        console.log("Mensagem PIX solicitada. WhatsApp aberto.");
    }
  };

  const handleMudarStatus = async (id, novoStatus) => {
    try {
      const ref = doc(db, "pedidos", id);
      await updateDoc(ref, { status: novoStatus });

      const _pedido = pedido;
      const statusFormatado = novoStatus.toLowerCase();

      let mensagem = "";
      let shouldOpenWhatsApp = true; 
      const nomeCliente = _pedido.cliente?.nome || "Cliente";
      const nomeEstabelecimento = estabelecimento?.nome || "Mata Fome";

      const itensDoPedido = _pedido.itens
        ? _pedido.itens.map(item => `${item.quantidade}x ${item.nome}`).join('\n- ')
        : 'N/A';
      const valorTotal = _pedido.totalFinal ? _pedido.totalFinal.toFixed(2).replace('.', ',') : 'N/A';
      const formaPgto = _pedido.formaPagamento ? _pedido.formaPagamento.charAt(0).toUpperCase() + _pedido.formaPagamento.slice(1) : 'N/A';

      if (statusFormatado === "preparo") {
        mensagem = `Olá ${nomeCliente}, seu pedido no ${nomeEstabelecimento} acaba de entrar em preparo! 👨‍🍳
        
*Detalhes do Pedido:*
${itensDoPedido}

*Total:* R$ ${valorTotal}
*Pagamento:* ${formaPgto}

Logo mais ele estará pronto para você! Fique de olho nas próximas atualizações. #MataFome
`;
      } else if (statusFormatado === "entregando") {
        mensagem = `Oba! ${nomeCliente}, seu pedido saiu para a entrega! 🛵📦 Chega já! Bom Apetite! #DeuFome`;
      } else if (statusFormatado === "finalizado") {
        mensagem = `Olá ${nomeCliente}, seu pedido foi finalizado com sucesso! ✅ Muito obrigado!`;
      } else {
        shouldOpenWhatsApp = false; 
      }

      if (mensagem && shouldOpenWhatsApp) {
        const success = openWhatsAppLink(mensagem, _pedido.cliente?.telefone, `mudança de status para ${novoStatus}`);
        if (success) {
            // Feedback visual ao admin, se desejar
        }
      }

    } catch (error) {
      console.error("❌ Erro ao mudar status ou enviar mensagem:", error);
      alert("Ocorreu um erro ao atualizar o status ou enviar a mensagem.");
    }
  };

  const showPixButton = formaPagamento === 'pix' && statusPagamentoPix === 'aguardando_pagamento';

  return (
    <div className={`border ${bgColor} rounded-xl p-4 shadow-md`}>
      <p className="font-semibold text-lg text-[var(--marrom-escuro)]">
        {pedido?.cliente?.nome || "Cliente não informado"}
      </p>
      <p className="text-sm text-[var(--cinza-texto)] mb-2 capitalize">
        Status: {status}
        {formaPagamento === 'pix' && ` (PIX: ${statusPagamentoPix.replace('_', ' ')})`}
      </p>

      <ul className="text-sm text-[var(--cinza-texto)] mb-3 space-y-1">
        {pedido?.itens?.map((item, i) => (
          <li key={i}>
            • {item.nome} - {item.quantidade}
          </li>
        ))}
      </ul>

      {pedido?.itens && pedido.itens.length > 0 && (
        <p className="font-bold text-[var(--marrom-escuro)] text-right mb-2">
          Total: R$ {(pedido.totalFinal || pedido.itens.reduce((acc, item) => acc + (item.preco * item.quantidade), 0)).toFixed(2).replace('.', ',')}
        </p>
      )}

      <div className="flex gap-2 flex-wrap mt-2">
        {showPixButton && (
            <button
              onClick={enviarMensagemPixComChave}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm shadow transition duration-300"
            >
              🔑 Enviar PIX
            </button>
        )}

        <button
          onClick={() => handleMudarStatus(pedido.id, "preparo")}
          className="bg-[var(--marrom-escuro)] hover:bg-[var(--vermelho-principal)] text-white px-3 py-1 rounded text-sm shadow transition duration-300"
        >
          🔧 Preparo
        </button>

        <button
          onClick={() => handleMudarStatus(pedido.id, "entregando")}
          className="bg-[var(--vermelho-principal)] hover:bg-red-700 text-white px-3 py-1 rounded text-sm shadow transition duration-300"
        >
          🚚 Entregar
        </button>

        <button
          onClick={() => handleMudarStatus(pedido.id, "finalizado")}
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

        <button
          onClick={() => excluirPedido(pedido.id)}
          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm shadow transition duration-300"
        >
          🗑️ Excluir
        </button>
      </div>
    </div>
  );
}

export default PedidoCard;