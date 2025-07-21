// PedidoCard.jsx atualizado com lógica de "ver mais" para itens longos
import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db, app } from "../firebase";
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getFunctions, httpsCallable } from 'firebase/functions';

function PedidoCard({ pedido, mudarStatus, excluirPedido, estabelecimento, autoPrintEnabled }) {
  const navigate = useNavigate();
  const functions = getFunctions(app);
  const getPixKeyCallable = httpsCallable(functions, 'getEstablishmentPixKey');
  const status = (pedido?.status || "recebido").toLowerCase();
  const formaPagamento = (pedido?.formaPagamento || "").toLowerCase();
  const statusPagamentoPix = (pedido?.statusPagamentoPix || "").toLowerCase();
  const [mostrarTodosItens, setMostrarTodosItens] = useState(false);
  const coresPorStatus = {
    recebido: "bg-gray-50 border-gray-300",
    preparo: "bg-yellow-50 border-yellow-300",
    em_entrega: "bg-blue-50 border-blue-300",
    finalizado: "bg-green-50 border-green-300",
  };
  const bgColor = coresPorStatus[status] || "bg-white border-gray-200";

  const abrirComanda = () => {
    const comandaUrl = `/comanda/${pedido.id}${autoPrintEnabled ? '?print=true' : ''}`;
    window.open(comandaUrl, '_blank');
  };

  const openWhatsAppLink = (message, phoneNumber, actionDescription = "mensagem") => {
    if (!phoneNumber) {
      toast.error(`Erro: Telefone do cliente não disponível para enviar ${actionDescription}.`);
      return false;
    }
    const numeroLimpo = phoneNumber.replace(/\D/g, "");
    if (!numeroLimpo) {
      toast.error(`Erro: Número de telefone inválido para enviar ${actionDescription}.`);
      return false;
    }

    const texto = encodeURIComponent(message);
    const url = `https://wa.me/55${numeroLimpo}?text=${texto}`;

    try {
      window.open(url, "_blank");
      console.log(`📤 Abrindo WhatsApp para ${actionDescription}:`, url);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao abrir WhatsApp para ${actionDescription}:`, error);
      toast.error(`Não foi possível abrir o WhatsApp para ${actionDescription}. Verifique as configurações do seu navegador ou tente novamente.`);
      return false;
    }
  };

  const enviarMensagemPixComChave = async () => {
    const estabelecimentoIdDoPedido = pedido.estabelecimentoId;
    if (!estabelecimentoIdDoPedido) {
      toast.error("Erro: ID do estabelecimento não encontrado no pedido.");
      return;
    }

    try {
      const result = await getPixKeyCallable({ establishmentId: estabelecimentoIdDoPedido });
      const chavePixSegura = result.data.chavePix;

      if (!chavePixSegura) {
        toast.error("Chave PIX não configurada para este estabelecimento.");
        return;
      }

      const nomeCliente = pedido.cliente?.nome || "Cliente";
      const totalPedido = pedido.totalFinal ? pedido.totalFinal.toFixed(2).replace('.', ',') : (pedido.itens ? pedido.itens.reduce((acc, item) => acc + (item.preco * item.quantidade), 0).toFixed(2).replace('.', ',') : 'N/A');

      const mensagem = `Olá ${nomeCliente}, seu pedido no ${estabelecimento.nome} está aguardando pagamento via PIX!

Valor total: R$ ${totalPedido}.

*Chave PIX:* ${chavePixSegura}

Por favor, faça o pagamento para que possamos iniciar o preparo do seu pedido. 😊
Obrigado!`;

      const success = openWhatsAppLink(mensagem, pedido.cliente?.telefone, "mensagem PIX");
      if (success) {
        toast.info("Mensagem PIX solicitada. Verifique o WhatsApp do cliente.");
      }
    } catch (error) {
      console.error("Erro ao enviar mensagem PIX segura:", error);
      if (error.code === 'permission-denied') {
        toast.error("Você não tem permissão para acessar esta chave PIX.");
      } else if (error.code === 'not-found') {
        toast.error("Chave PIX ou estabelecimento não encontrado.");
      } else {
        toast.error("Ocorreu um erro ao buscar a chave PIX. Tente novamente.");
      }
    }
  };

  const handleMudarStatus = async (id, novoStatus) => {
    try {
      const ref = doc(db, "pedidos", id);
      await updateDoc(ref, { status: novoStatus });

      const _pedido = { ...pedido, status: novoStatus };
      const statusFormatado = novoStatus.toLowerCase();

      let mensagem = "";
      let shouldOpenWhatsApp = false;
      const nomeCliente = _pedido.cliente?.nome || "Cliente";
      const nomeEstabelecimento = estabelecimento?.nome || "Mata Fome";

      const itensDoPedido = _pedido.itens
        ? _pedido.itens.map(item => `${item.quantidade}x ${item.nome}`).join('\n- ')
        : 'N/A';
      const valorTotal = _pedido.totalFinal ? _pedido.totalFinal.toFixed(2).replace('.', ',') : 'N/A';
      const formaPgto = _pedido.formaPagamento ? _pedido.formaPagamento.charAt(0).toUpperCase() + _pedido.formaPagamento.slice(1) : 'N/A';

      switch (statusFormatado) {
        case "preparo":
          mensagem = `Olá ${nomeCliente}, seu pedido #${_pedido.id.substring(0, 5)} do ${nomeEstabelecimento} está AGORA EM PREPARO! 🧑‍🍳

*Detalhes do Pedido:*
- ${itensDoPedido}

*Total:* R$ ${valorTotal}
*Pagamento:* ${formaPgto}

Logo mais ele estará pronto para você! Fique de olho nas próximas atualizações. #MataFome
`;
          shouldOpenWhatsApp = true;
          toast.success(`Pedido em preparo: ${pedido.id.substring(0, 5)}...`);
          abrirComanda();
          break;
        case "em_entrega":
          mensagem = `Olá ${nomeCliente}, seu pedido #${_pedido.id.substring(0, 5)} do ${nomeEstabelecimento} está SAINDO PARA ENTREGA! 🚗💨

*Detalhes do Pedido:*
- ${itensDoPedido}

*Total:* R$ ${valorTotal}
*Pagamento:* ${formaPgto}

O entregador está a caminho. Prepare-se para saborear! 😋 #MataFome
`;
          shouldOpenWhatsApp = true;
          toast.success(`Pedido em entrega: ${pedido.id.substring(0, 5)}...`);
          break;
        case "finalizado":
          mensagem = `Olá ${nomeCliente}, seu pedido #${_pedido.id.substring(0, 5)} do ${nomeEstabelecimento} foi FINALIZADO! 🎉

Esperamos que tenha gostado. Agradecemos a preferência e esperamos vê-lo(a) novamente em breve! 😊 #MataFome
`;
          shouldOpenWhatsApp = true;
          toast.success(`Pedido finalizado: ${pedido.id.substring(0, 5)}...`);
          break;
        default:
          shouldOpenWhatsApp = false;
          break;
      }

      if (mensagem && shouldOpenWhatsApp) {
        const success = openWhatsAppLink(mensagem, _pedido.cliente?.telefone, `mudança de status para ${novoStatus}`);
        if (success) {
          // Feedback visual ao admin, se desejar (já feito com toast acima)
        }
      }

    } catch (error) {
      console.error("❌ Erro ao mudar status ou enviar mensagem:", error);
      toast.error("Ocorreu um erro ao atualizar o status ou enviar a mensagem.");
    }
  };

  // Nova função para navegar para o histórico do cliente
  const handleViewClientHistory = () => {
    // Certifique-se de que o telefone do cliente existe e é válido
    const clientPhone = pedido.cliente?.telefone;
    if (clientPhone) {
      // Remover caracteres não numéricos para a rota limpa
      const cleanPhone = clientPhone.replace(/\D/g, "");
      if (cleanPhone) {
        // Redireciona para a rota de histórico do cliente
        // Você precisará configurar esta rota no seu App.js ou Router.jsx
        navigate(`/historico-cliente/${cleanPhone}`);
      } else {
        toast.error("Telefone do cliente inválido para ver o histórico.");
      }
    } else {
      toast.error("Telefone do cliente não disponível para ver o histórico.");
    }
  };


  return (
    <div className={`border ${bgColor} rounded-xl p-5 shadow-md mb-4`}>
      {/* Nome do cliente agora é clicável */}
      <p
        className="font-semibold text-xl text-[var(--marrom-escuro)] mb-1 cursor-pointer hover:text-blue-700 hover:underline"
        onClick={handleViewClientHistory}
        title="Ver histórico de pedidos do cliente"
      >
        {pedido?.cliente?.nome || "Cliente não informado"}
      </p>
      <p className="text-sm text-gray-600 mb-3 capitalize">
        Status: <span className="font-medium">{status.replace('_', ' ')}</span>
        {formaPagamento === 'pix' && ` (PIX: ${statusPagamentoPix.replace('_', ' ')})`}
      </p>

      <ul className="text-sm text-[var(--cinza-texto)] mb-3 space-y-1">
        {pedido?.itens?.map((item, i) => (
          <li key={i}>
            • {item.quantidade}x {item.nome}
          </li>
        ))}
      </ul>

      {pedido?.itens && pedido.itens.length > 0 && (
        <p className="font-bold text-[var(--marrom-escuro)] text-right text-lg mb-2 pt-2 border-t border-gray-200">
          Total: R$ {(pedido.totalFinal || pedido.itens.reduce((acc, item) => acc + (item.preco * item.quantidade), 0)).toFixed(2).replace('.', ',')}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-start gap-2 mt-4">

        {/* Botão PIX */}
        {formaPagamento === 'pix' && statusPagamentoPix === 'aguardando_pagamento' && status === 'recebido' && (
          <button
            onClick={enviarMensagemPixComChave}
            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-md text-sm font-semibold shadow-sm transition duration-300 flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1"><path d="M11 6.5C11 7.328 10.328 8 9.5 8S8 7.328 8 6.5 8.672 5 9.5 5 11 5.672 11 6.5ZM10 0a10 10 0 100 20 10 10 0 000-20ZM8.5 3A1.5 1.5 0 007 4.5v11A1.5 1.5 0 008.5 17h3A1.5 1.5 0 0013 15.5v-11A1.5 1.5 0 0011.5 3h-3ZM9.5 9A1.5 1.5 0 008 10.5v3A1.5 1.5 0 009.5 15h1A1.5 1.5 0 0012 13.5v-3A1.5 1.5 0 0010.5 9h-1Z" clipRule="evenodd" /></svg>
            PIX
          </button>
        )}

        {/* Botões de Ação por Status */}
        {status === "recebido" && (
          <>
            <button
              onClick={abrirComanda}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm font-semibold shadow-sm transition duration-300 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1"><path fillRule="evenodd" d="M15.75 3.75A.75.75 0 0015 3H5.25a.75.75 0 000 1.5h.5c.276 0 .5.224.5.5v1.5a.75.75 0 00.75.75H8.25a.75.75 0 00.75-.75V5.5c0-.276.224-.5.5-.5h.5c.276 0 .5.224.5.5v1.5a.75.75 0 00.75.75H14.5a.75.75 0 00.75-.75V5.5c0-.276.224-.5.5-.5h.5a.75.75 0 00.75-.75V3.75zM12 9.25a.75.75 0 00-.75-.75H8.75a.75.75 0 00-.75.75v5.5c0 .414.336.75.75.75h2.5a.75.75 0 00.75-.75v-5.5z" clipRule="evenodd" /></svg>
              Comanda
            </button>
            <button
              onClick={() => handleMudarStatus(pedido.id, "preparo")}
              className="bg-black hover:bg-gray-800 text-white px-3 py-1.5 rounded-md text-sm font-semibold shadow-sm transition duration-300 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h1a.75.75 0 00.75-.75V9a.75.75 0 00-.75-.75H9z" clipRule="evenodd" /></svg>
              Enviar para Preparo
            </button>
            <button
              onClick={() => excluirPedido(pedido.id)}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-sm font-semibold shadow-sm transition duration-300 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.594 19h4.812a2.75 2.75 0 002.742-2.53l.841-10.518.149.022a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.068l.3 9a.75.75 0 001.5-.068l-.3-9zm4.34 0a.75.75 0 00-1.5-.068l.3 9a.75.75 0 001.5.068l-.3-9z" clipRule="evenodd" /></svg>
              Excluir
            </button>
          </>
        )}

        {status === "preparo" && (
          <button
            onClick={() => handleMudarStatus(pedido.id, "em_entrega")}
            className="bg-yellow-500 hover:bg-yellow-600 text-black px-3 py-1.5 rounded-md text-sm font-semibold shadow-sm transition duration-300 flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1"><path fillRule="evenodd" d="M5.5 2.5A.5.5 0 016 2h8a.5.5 0 01.5.5v1.25a.75.75 0 00.75.75h.75a.75.75 0 00.75-.75V2.5A2.5 2.5 0 0014 0H6A2.5 2.5 0 003.5 2.5v1.25c0 .414.336.75.75.75h.75a.75.75 0 00.75-.75V2.5zM3.75 6.5A.75.75 0 003 7.25v6.5c0 .414.336.75.75.75h.75a.75.75 0 00.75-.75V7.25a.75.75 0 00-.75-.75H3.75zM12.5 6.5h3.75a.75.75 0 01.75.75v6.5a.75.75 0 01-.75.75H12.5a.75.75 0 01-.75-.75V7.25a.75.75 0 01.75-.75zM10 8.75a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75V8a.75.75 0 01.75-.75h1.5a.75.75 0 01.75.75v.75z" clipRule="evenodd" /></svg>
            Entregar
          </button>
        )}

        {status === "em_entrega" && (
          <button
            onClick={() => handleMudarStatus(pedido.id, "finalizado")}
            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-md text-sm font-semibold shadow-sm transition duration-300 flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.052-.143z" clipRule="evenodd" /></svg>
            Finalizar
          </button>
        )}

        {status === "finalizado" && (
          <p className="text-lg font-bold text-green-700">Pedido Finalizado!</p>
        )}

      </div>
    </div>
  );
}

export default PedidoCard;