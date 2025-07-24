// src/components/PedidoCard.jsx
import React, { useState, useCallback, memo } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db, app } from "../firebase"; // Certifique-se que 'app' está exportado do seu firebase.js
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth'; // Import para obter a instância de autenticação

// Botão de ação comum
const ActionButton = memo(({ onClick, children, className = '' }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-md font-semibold shadow-sm transition duration-200 ${className}`}
  >
    {children}
  </button>
));

function PedidoCard({ pedido, onDeletePedido, estabelecimento, autoPrintEnabled }) {
  const navigate = useNavigate();
  const [mostrarTodosItens, setMostrarTodosItens] = useState(false);
  const functions = getFunctions(app); // Obtém a instância das Cloud Functions
  const authInstance = getAuth(app); // Obtém a instância de autenticação para uso interno

  // Callable para a função PIX (já existe)
  const getPixKeyCallable = httpsCallable(functions, 'getEstablishmentPixKey');
  // Callable para a função de envio de mensagem WhatsApp
  const sendWhatsappMessageCallable = httpsCallable(functions, 'sendWhatsappMessage');

  const status = (pedido?.status || 'recebido').toLowerCase();
  const formaPagamento = (pedido?.formaPagamento || '').toLowerCase();
  const statusPagamentoPix = (pedido?.statusPagamentoPix || '').toLowerCase();

  const coresPorStatus = {
    recebido: 'bg-accent border-gray-200',
    preparo: 'bg-accent border-yellow-300',
    em_entrega: 'bg-accent border-blue-300',
    finalizado: 'bg-accent border-green-300',
  };
  const containerClasses = `border rounded-xl p-5 shadow-sm mb-4 ${coresPorStatus[status] || 'bg-accent border-gray-200'}`;

  // Abre a comanda
  const abrirComanda = useCallback(() => {
    console.log("PedidoCard Debug: Abrindo comanda para pedido ID:", pedido.id);
    const url = `/comanda/${pedido.id}${autoPrintEnabled ? '?print=true' : ''}`;
    window.open(url, '_blank');
  }, [pedido.id, autoPrintEnabled]);

  // Função para abrir o WhatsApp no navegador (para mensagens manuais como PIX ou quando a CF falhar)
  const openWhatsAppLink = useCallback((message, phone, desc) => {
    console.log("PedidoCard Debug: Tentando abrir link WhatsApp para:", desc, "Telefone:", phone);
    if (!phone) {
      toast.error(`Erro: telefone não disponível para ${desc}.`);
      console.error(`PedidoCard Debug: openWhatsAppLink: Telefone não disponível para ${desc}.`);
      return false;
    }
    const num = phone.replace(/\D/g, '');
    if (!num) {
      toast.error(`Número inválido para ${desc}.`);
      console.error(`PedidoCard Debug: openWhatsAppLink: Número inválido para ${desc}.`);
      return false;
    }
    const url = `https://wa.me/55${num}?text=${encodeURIComponent(message)}`;
    try {
      window.open(url, '_blank');
      return true;
    } catch (e) {
      console.error("PedidoCard Debug: openWhatsAppLink: Erro ao tentar abrir WhatsApp:", e);
      toast.error('Não foi possível abrir WhatsApp.');
      return false;
    }
  }, []);

  // Envia mensagem PIX (mantém a lógica atual pois é um link direto)
  const enviarMensagemPixComChave = useCallback(async () => {
    console.log("PedidoCard Debug: Iniciando envio de mensagem PIX com chave.");
    try {
      const { data } = await getPixKeyCallable({ establishmentId: pedido.estabelecimentoId });
      const chave = data.chavePix;
      if (!chave) {
        toast.error('Chave PIX não configurada.');
        console.error("PedidoCard Debug: Chave PIX não configurada.");
        return;
      }
      const nome = pedido.cliente?.nome || 'Cliente';
      const total = pedido.totalFinal
        ? pedido.totalFinal.toFixed(2).replace('.', ',')
        : pedido.itens?.reduce((acc, item) => acc + item.preco * item.quantidade, 0)
          .toFixed(2)
          .replace('.', ',');
      const msg = `🎉 Oi ${nome}! Seu pedido no ${estabelecimento.nome} está quase lá! 🚀

Para garantir tudo certinho, faça o pagamento de R$ ${total} via PIX:

🔑 Chave PIX: ${chave}

Assim que recebermos o pagamento, colocamos a mão na massa e deixamos tudo delicioso para você! 😋🍴`;
      if (openWhatsAppLink(msg, pedido.cliente?.telefone, 'mensagem PIX')) {
        toast.info('Mensagem PIX enviada.');
        console.log("PedidoCard Debug: Mensagem PIX enviada (via openWhatsAppLink).");
      }
    } catch (e) {
      console.error("PedidoCard Debug: enviarMensagemPixComChave: Erro ao solicitar PIX:", e);
      toast.error('Erro ao solicitar PIX.');
    }
  }, [pedido, estabelecimento.nome, openWhatsAppLink, getPixKeyCallable]);


  // Função unificada para mudar status E ENVIAR WHATSAPP via Cloud Function
  const handleMudarStatus = useCallback(async (novoStatus) => {
    console.log(`PedidoCard Debug: Tentando mudar status do pedido ${pedido.id} para: ${novoStatus}`);
    try {
      // 1. Atualizar status no Firestore
      await updateDoc(doc(db, 'pedidos', pedido.id), { status: novoStatus });
      toast.success(`Status alterado para ${novoStatus}.`);
      console.log(`PedidoCard Debug: Status do pedido ${pedido.id} atualizado para ${novoStatus} no Firestore.`);

      // 2. Preparar dados para a Cloud Function de WhatsApp
      const nomeCliente = pedido.cliente?.nome || 'Cliente';
      const valorTotal = (pedido.totalFinal ||
        pedido.itens?.reduce((a, i) => a + i.preco * i.quantidade, 0))
        .toFixed(2); // Deixa como ponto para a Cloud Function formatar

      const now = new Date();
      const formattedDateTime = now.toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
      });

      // Chamada da Cloud Function para enviar mensagem WhatsApp
      if (pedido.cliente?.telefone) { // Verifica se há telefone para enviar
        // --- INÍCIO: DEBUG DE AUTENTICAÇÃO ANTES DA CF ---
        console.log("PedidoCard Debug: Verificando status de autenticação antes de chamar CF.");
        if (authInstance.currentUser) {
            const token = await authInstance.currentUser.getIdToken(true); // Força um novo token
            console.log("PedidoCard Debug: Token de ID forçado a ser atualizado. UID:", authInstance.currentUser.uid);
            // O token não precisa ser passado explicitamente para httpsCallable,
            // mas forçar o refresh garante que o SDK use o mais recente.
        } else {
            console.warn("PedidoCard Debug: Sem currentUser no authInstance. Isso é inesperado para esta ação.");
            toast.error("Erro de autenticação local. Tente logar novamente.");
            return; // Interrompe a chamada se não houver usuário autenticado
        }
        // --- FIM: DEBUG DE AUTENTICAÇÃO ---

        const whatsappData = {
          to: pedido.cliente.telefone, // Número de telefone do cliente
          messageType: novoStatus,   // Tipo da mensagem (ex: 'preparo', 'em_entrega')
          clientName: nomeCliente,
          orderValue: parseFloat(valorTotal), // Envia como número, CF formata
          orderIdShort: pedido.id.substring(0, 5), // ID curto do pedido
          orderDateTime: formattedDateTime,
          estabelecimentoName: estabelecimento?.nome // Nome do estabelecimento
        };
        console.log("PedidoCard Debug: Dados preparados para a Cloud Function de WhatsApp:", whatsappData);

        try {
          console.log(`PedidoCard Debug: Chamando Cloud Function 'sendWhatsappMessage' para o status '${novoStatus}'.`);
          const result = await sendWhatsappMessageCallable(whatsappData);

          if (result.data.success) {
            toast.info(`Mensagem de ${novoStatus} enviada via WhatsApp!`);
            console.log("PedidoCard Debug: Resposta da Cloud Function de WhatsApp - SUCESSO:", result.data.message);
          } else {
            toast.error(`Falha ao enviar mensagem WhatsApp: ${result.data.error || 'Erro desconhecido.'}`);
            console.error("PedidoCard Debug: Cloud Function 'sendWhatsappMessage' falhou (retorno 'success: false'):", result.data.error);
          }
        } catch (whatsappFnError) {
          console.error("PedidoCard Debug: Erro ao chamar Cloud Function 'sendWhatsappMessage' (catch externo):", whatsappFnError);
          // Verificar se o erro é do tipo HttpsError para extrair mensagem mais específica
          if (whatsappFnError.code && whatsappFnError.message) {
            toast.error(`Erro CF (${whatsappFnError.code}): ${whatsappFnError.message}`);
          } else {
            toast.error(`Erro desconhecido ao chamar CF. Verifique o console.`);
          }
        }
      } else {
        toast.warn('Telefone do cliente não disponível para enviar mensagem.');
        console.warn('PedidoCard Debug: Telefone do cliente não disponível, mensagem WhatsApp não enviada.');
      }

    } catch (e) {
      console.error("PedidoCard Debug: handleMudarStatus: Erro ao atualizar status do pedido no Firestore (catch principal):", e);
      toast.error('Erro ao atualizar status do pedido.');
    }
  }, [pedido, estabelecimento, sendWhatsappMessageCallable, authInstance]); // Adicionada 'authInstance' nas dependências

  // Histórico do cliente
  const handleViewClientHistory = useCallback(() => {
    console.log("PedidoCard Debug: Visualizando histórico do cliente.");
    const tel = pedido.cliente?.telefone;
    const num = tel?.replace(/\D/g, '');
    if (num) navigate(`/historico-cliente/${num}`);
    else toast.error('Telefone inválido para histórico.');
  }, [pedido, navigate]);

  // Total do pedido para exibição
  const totalValorFormatado = (pedido.totalFinal ||
    pedido.itens?.reduce((a, i) => a + i.preco * i.quantidade, 0))
    .toFixed(2)
    .replace('.', ',');

  console.log(`PedidoCard Debug: Renderizando PedidoCard para pedido ID: ${pedido.id}, Status: ${status}`);

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h3
          className="text-xl font-heading text-secondary cursor-pointer hover:text-primary"
          onClick={handleViewClientHistory}
        >{pedido.cliente?.nome || 'Cliente não informado'}</h3>
        <span className="text-sm font-medium text-gray-600 capitalize">
          {status.replace('_', ' ')}{formaPagamento === 'pix' ? ` (PIX: ${statusPagamentoPix.replace('_', ' ')})` : ''}
        </span>
      </div>
      {/* Itens colapsáveis */}
      <div className={`overflow-hidden transition-all duration-300 ${mostrarTodosItens ? 'max-h-screen' : 'max-h-24'}`}>
        <ul className="space-y-1 text-sm text-gray-700">
          {pedido.itens?.map((item, idx) => (
            <li key={idx}>• {item.quantidade}x {item.nome}</li>
          ))}
        </ul>
      </div>
      {pedido.itens?.length > 3 && (
        <button
          className="mt-2 text-primary hover:underline text-sm"
          onClick={() => setMostrarTodosItens(!mostrarTodosItens)}
        >{mostrarTodosItens ? 'Mostrar menos' : 'Ver mais'}</button>
      )}
      {/* Footer */}
      <div className="mt-4 flex flex-col sm:flex-row sm:justify-between items-center gap-3">
        <p className="font-bold text-secondary text-lg">Total: R$ {totalValorFormatado}</p>
        <div className="flex flex-wrap gap-2">
          {formaPagamento === 'pix' && status === 'recebido' && (
            <ActionButton onClick={enviarMensagemPixComChave} className="bg-primary text-secondary hover:opacity-90">
              ⚡ PIX
            </ActionButton>
          )}
          {status === 'recebido' && (
            <>
              <ActionButton onClick={abrirComanda} className="bg-blue-300 text-secondary hover:opacity-90">
                📄 Comanda
              </ActionButton>
              <ActionButton onClick={() => handleMudarStatus('preparo')} className="bg-primary text-secondary hover:opacity-90">
                ☕ Enviar para Preparo
              </ActionButton>
              <ActionButton onClick={() => onDeletePedido(pedido.id)} className="bg-red-500 text-white hover:opacity-90">
                🗑️ Excluir
              </ActionButton>
            </>
          )}
          {status === 'preparo' && (
            <ActionButton onClick={() => handleMudarStatus('em_entrega')} className="bg-black text-white hover:opacity-90">
              🚚 Entregar
            </ActionButton>
          )}
          {status === 'em_entrega' && (
            <ActionButton onClick={() => handleMudarStatus('finalizado')} className="bg-primary text-secondary hover:opacity-90">
              ✔️ Finalizar
            </ActionButton>
          )}
          {status === 'finalizado' && (
            <span className="text-lg font-bold text-green-700">Pedido Finalizado!</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(PedidoCard);