""// src/components/PedidoCard.jsx
import React, { useState, useCallback, memo } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db, app } from "../firebase";
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';

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
  const functions = getFunctions(app);
  const getPixKeyCallable = httpsCallable(functions, 'getEstablishmentPixKey');
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

  const abrirComanda = useCallback(() => {
    const url = `/comanda/${pedido.id}${autoPrintEnabled ? '?print=true' : ''}`;
    window.open(url, '_blank');
  }, [pedido.id, autoPrintEnabled]);

  const openWhatsAppLink = useCallback((message, phone, desc) => {
    if (!phone) {
      toast.error(`Erro: telefone não disponível para ${desc}.`);
      return false;
    }
    const num = phone.replace(/\D/g, '');
    if (!num) {
      toast.error(`Número inválido para ${desc}.`);
      return false;
    }
    const url = `https://wa.me/55${num}?text=${encodeURIComponent(message)}`;
    try {
      window.open(url, '_blank');
      return true;
    } catch (e) {
      toast.error('Não foi possível abrir WhatsApp.');
      return false;
    }
  }, []);

  const enviarMensagemPixComChave = useCallback(async () => {
    try {
      const { data } = await getPixKeyCallable({ establishmentId: pedido.estabelecimentoId });
      const chave = data.chavePix;
      if (!chave) {
        toast.error('Chave PIX não configurada.');
        return;
      }
      const nome = pedido.cliente?.nome || 'Cliente';
      const total = pedido.totalFinal
        ? pedido.totalFinal.toFixed(2).replace('.', ',')
        : pedido.itens?.reduce((acc, item) => acc + item.preco * item.quantidade, 0)
            .toFixed(2)
            .replace('.', ',');
      const msg = `🎉 Oi ${nome}! Seu pedido no ${estabelecimento.nome} está quase lá! 🚀\n\nPara garantir tudo certinho, faça o pagamento de R$ ${total} via PIX:\n\n🔑 Chave PIX: ${chave}\n\nAssim que recebermos o pagamento, colocamos a mão na massa e deixamos tudo delicioso para você! 😋🍴`;
      if (openWhatsAppLink(msg, pedido.cliente?.telefone, 'mensagem PIX')) {
        toast.info('Mensagem PIX enviada.');
      }
    } catch (e) {
      toast.error('Erro ao solicitar PIX.');
    }
  }, [pedido, estabelecimento.nome, openWhatsAppLink, getPixKeyCallable]);

  const handleMudarStatus = useCallback(async (novoStatus) => {
    try {
      await updateDoc(doc(db, 'pedidos', pedido.id), { status: novoStatus });
      toast.success(`Status alterado para ${novoStatus}.`);

      const nomeCliente = pedido.cliente?.nome || 'Cliente';
      const valorTotal = (pedido.totalFinal || pedido.itens?.reduce((a, i) => a + i.preco * i.quantidade, 0)).toFixed(2);
      const now = new Date();
      const formattedDateTime = now.toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      const user = getAuth(app).currentUser;
      if (!user) {
        toast.error("Usuário não autenticado. Faça login novamente.");
        return;
      }
      await user.getIdToken(true);

      if (pedido.cliente?.telefone) {
        const whatsappData = {
          to: pedido.cliente.telefone,
          messageType: novoStatus,
          clientName: nomeCliente,
          orderValue: parseFloat(valorTotal),
          orderIdShort: pedido.id.substring(0, 5),
          orderDateTime: formattedDateTime,
          estabelecimentoName: estabelecimento?.nome
        };

        try {
          const result = await sendWhatsappMessageCallable(whatsappData);
          if (result.data.success) {
            toast.info(`Mensagem de ${novoStatus} enviada via WhatsApp!`);
          } else {
            toast.error(`Falha ao enviar mensagem WhatsApp: ${result.data.error || 'Erro desconhecido.'}`);
          }
        } catch (whatsappFnError) {
          if (whatsappFnError.code && whatsappFnError.message) {
            toast.error(`Erro CF (${whatsappFnError.code}): ${whatsappFnError.message}`);
          } else {
            toast.error(`Erro desconhecido ao chamar CF. Verifique o console.`);
          }
        }
      } else {
        toast.warn('Telefone do cliente não disponível para enviar mensagem.');
      }
    } catch (e) {
      toast.error('Erro ao atualizar status do pedido.');
    }
  }, [pedido, estabelecimento, sendWhatsappMessageCallable]);

  const handleViewClientHistory = useCallback(() => {
    const tel = pedido.cliente?.telefone;
    const num = tel?.replace(/\D/g, '');
    if (num) navigate(`/historico-cliente/${num}`);
    else toast.error('Telefone inválido para histórico.');
  }, [pedido, navigate]);

  const totalValorFormatado = (pedido.totalFinal || pedido.itens?.reduce((a, i) => a + i.preco * i.quantidade, 0))
    .toFixed(2)
    .replace('.', ',');

  return (
    <div className={containerClasses}>
      <div className="flex justify-between items-center mb-3">
        <h3
          className="text-xl font-heading text-secondary cursor-pointer hover:text-primary"
          onClick={handleViewClientHistory}
        >{pedido.cliente?.nome || 'Cliente não informado'}</h3>
        <span className="text-sm font-medium text-gray-600 capitalize">
          {status.replace('_', ' ')}{formaPagamento === 'pix' ? ` (PIX: ${statusPagamentoPix.replace('_', ' ')})` : ''}
        </span>
      </div>
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