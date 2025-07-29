import React, { useState, useCallback, memo } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db, app } from "../firebase"; // Importe 'app' para usar getFunctions e getAuth
import { useNavigate } from 'react-router-dom'; // <-- CORREÇÃO AQUI

import { toast } from 'react-toastify';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth'; // Importe getAuth para checar o usuário

// Componente para botões de ação com estilização comum
const ActionButton = memo(({ onClick, children, className = '' }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 rounded-md font-semibold shadow-sm transition duration-200 ${className}`}
    >
        {children}
    </button>
));

// Componente principal PedidoCard
function PedidoCard({ pedido, onDeletePedido, estabelecimento, autoPrintEnabled, onUpdateStatus }) { // Adicione onUpdateStatus como prop
    const navigate = useNavigate();
    const [mostrarTodosItens, setMostrarTodosItens] = useState(false);

    // Inicializa Firebase Functions e os callables
    const functions = getFunctions(app);
    const getPixKeyCallable = httpsCallable(functions, 'getEstablishmentPixKey');
    // REMOVIDO: sendWhatsappMessageCallable não é mais necessário aqui
    // const sendWhatsappMessageCallable = httpsCallable(functions, 'sendWhatsappMessage'); 

    const status = (pedido?.status || 'recebido').toLowerCase();
    const formaPagamento = (pedido?.formaPagamento || '').toLowerCase();
    const statusPagamentoPix = (pedido?.statusPagamentoPix || '').toLowerCase();

    // Classes CSS dinâmicas baseadas no status do pedido
    const coresPorStatus = {
        recebido: 'bg-accent border-gray-200',
        preparo: 'bg-accent border-yellow-300',
        em_entrega: 'bg-accent border-blue-300',
        finalizado: 'bg-accent border-green-300',
    };
    const containerClasses = `border rounded-xl p-5 shadow-sm mb-4 ${coresPorStatus[status] || 'bg-accent border-gray-200'}`;

    // Abre a comanda do pedido em uma nova aba
    const abrirComanda = useCallback(() => {
        const url = `/comanda/${pedido.id}${autoPrintEnabled ? '?print=true' : ''}`;
        window.open(url, '_blank');
    }, [pedido.id, autoPrintEnabled]);

    // Função para abrir link do WhatsApp (para mensagens PIX, por exemplo)
    const openWhatsAppLink = useCallback((message, phone, desc) => {
        if (!phone) {
            toast.error(`Erro: telefone não disponível para ${desc}.`);
            return false;
        }
        const num = phone.replace(/\D/g, ''); // Limpa o número
        if (!num) {
            toast.error(`Número inválido para ${desc}.`);
            return false;
        }
        // Construção do link wa.me para abrir o WhatsApp do cliente
        const url = `https://wa.me/55${num}?text=${encodeURIComponent(message)}`;
        try {
            window.open(url, '_blank');
            return true;
        } catch (e) {
            toast.error('Não foi possível abrir WhatsApp.');
            return false;
        }
    }, []);

    // Envia mensagem PIX com chave (usando link direto do WhatsApp)
    const enviarMensagemPixComChave = useCallback(async () => {
        try {
            // Chama Cloud Function para obter a chave PIX
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
            
            // Usa a função local para abrir o WhatsApp para o cliente
            if (openWhatsAppLink(msg, pedido.cliente?.telefone, 'mensagem PIX')) {
                toast.info('Mensagem PIX enviada (link aberto no WhatsApp).');
            }
        } catch (e) {
            console.error("Erro ao solicitar PIX:", e);
            toast.error('Erro ao solicitar PIX.');
        }
    }, [pedido, estabelecimento.nome, openWhatsAppLink, getPixKeyCallable]);

    // REMOVIDO/COMENTADO: Esta função não será mais chamada pelos botões de status.
    // A lógica de atualização e envio de WhatsApp agora está na prop onUpdateStatus do Painel.jsx
    /*
    const handleMudarStatus = useCallback(async (novoStatus) => {
        try {
            // Atualiza o status do pedido no Firestore
            await updateDoc(doc(db, 'pedidos', pedido.id), { status: novoStatus });
            toast.success(`Status alterado para ${novoStatus.replace('_', ' ')}.`);

            // Prepara dados para a mensagem do WhatsApp (Z-API)
            const nomeCliente = pedido.cliente?.nome || 'Cliente';
            const valorTotal = (pedido.totalFinal || pedido.itens?.reduce((a, i) => a + i.preco * i.quantidade, 0)).toFixed(2);
            const now = new Date();
            const formattedDateTime = now.toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            // Garante que o usuário está autenticado e seu token é válido para chamar a CF
            const user = getAuth(app).currentUser;
            if (!user) {
                toast.error("Usuário não autenticado. Faça login novamente.");
                return;
            }
            await user.getIdToken(true); // Força a atualização do token

            // Somente envia mensagem WhatsApp se o telefone do cliente estiver disponível
            if (pedido.cliente?.telefone) {
                const whatsappData = {
                    to: pedido.cliente.telefone, // <-- ATENÇÃO CRÍTICA AQUI: Caminho para o telefone
                    messageType: novoStatus, // Tipo de mensagem para a Cloud Function
                    clientName: nomeCliente,
                    orderValue: parseFloat(valorTotal),
                    orderIdShort: pedido.id.substring(0, 5), // IDs curtos são mais amigáveis
                    orderDateTime: formattedDateTime,
                    estabelecimentoName: estabelecimento?.nome
                };

                try {
                    // Chama a Cloud Function para enviar a mensagem via Z-API
                    const result = await sendWhatsappMessageCallable(whatsappData);
                    if (result.data.success) {
                        toast.info(`Mensagem de ${novoStatus.replace('_', ' ')} enviada via WhatsApp!`);
                    } else {
                        toast.error(`Falha ao enviar mensagem WhatsApp: ${result.data.error || 'Erro desconhecido.'}`);
                    }
                } catch (whatsappFnError) {
                    // Captura e exibe erros da Cloud Function
                    if (whatsappFnError.code && whatsappFnError.message) {
                        toast.error(`Erro CF (${whatsappFnError.code}): ${whatsappFnError.message}`);
                    } else {
                        toast.error(`Erro desconhecido ao chamar CF. Verifique o console.`);
                    }
                    console.error('Erro detalhado ao chamar sendWhatsappMessageCallable:', whatsappFnError);
                }
            } else {
                toast.warn('Telefone do cliente não disponível para enviar mensagem via WhatsApp.');
            }
        } catch (e) {
            console.error("Erro ao atualizar status do pedido:", e);
            toast.error('Erro ao atualizar status do pedido.');
        }
    }, [pedido, estabelecimento, sendWhatsappMessageCallable]); // Dependências do useCallback
    */

    // Lida com a visualização do histórico do cliente
    const handleViewClientHistory = useCallback(() => {
        const tel = pedido.cliente?.telefone;
        const num = tel?.replace(/\D/g, '');
        if (num) navigate(`/historico-cliente/${num}`);
        else toast.error('Telefone inválido para histórico.');
    }, [pedido, navigate]);

    // Formata o valor total do pedido para exibição
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
                            <ActionButton 
                                onClick={() => onUpdateStatus(pedido.id, 'preparo', pedido)} // <--- MODIFICADO
                                className="bg-yellow-500 text-black font-semibold text-sm hover:bg-yellow-600"
                            >
                                ☕ Enviar para Preparo
                            </ActionButton>
                            <ActionButton onClick={() => onDeletePedido(pedido.id)} className="bg-red-500 text-white hover:opacity-90">
                                🗑️ Excluir
                            </ActionButton>
                        </>
                    )}
                    {status === 'preparo' && (
                        <ActionButton 
                            onClick={() => onUpdateStatus(pedido.id, 'em_entrega', pedido)} // <--- MODIFICADO
                            className="bg-black text-white hover:opacity-90"
                        >
                            🚚 Entregar
                        </ActionButton>
                    )}
                    {status === 'em_entrega' && (
                        <ActionButton 
                            onClick={() => onUpdateStatus(pedido.id, 'finalizado', pedido)} // <--- MODIFICADO
                            className="bg-primary text-secondary hover:opacity-90"
                        >
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