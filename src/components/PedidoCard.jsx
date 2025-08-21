// src/components/PedidoCard.jsx

import React, { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';
import ReactDOMServer from 'react-dom/server';
import ComandaParaImpressao from './ComandaParaImpressao';

const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>;
const PrintIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v3a2 2 0 002 2h6a2 2 0 002-2v-3h1a2 2 0 002-2v-3a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v3h6v-3z" clipRule="evenodd" /></svg>;
const MoveIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" /></svg>;

const PedidoCard = React.memo(({ pedido, onDeletePedido, onUpdateStatus, estabelecimentoInfo }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const handlePrint = () => {
        if (!pedido || !estabelecimentoInfo) {
            toast.error("Faltam dados para imprimir a comanda.");
            return;
        }
        const comandaHtml = ReactDOMServer.renderToString(
            <ComandaParaImpressao pedido={pedido} estabelecimento={estabelecimentoInfo} />
        );
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        iframe.contentDocument.write(comandaHtml);
        iframe.contentDocument.close();
        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            document.body.removeChild(iframe);
        }, 250);
    };

    const statusMap = {
        recebido: 'preparo',
        preparo: 'em_entrega',
        em_entrega: 'finalizado'
    };
    const nextStatus = statusMap[pedido.status];
    
    const nomeCliente = pedido.cliente?.nome || 'Cliente não informado';
    const telefoneCliente = pedido.cliente?.telefone || 'Telefone indisponível';

    const formatPhoneNumber = (phone) => {
        if (!phone) return 'N/A';
        const cleaned = ('' + phone).replace(/\D/g, '');
        if (cleaned.length === 11) return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
        if (cleaned.length === 10) return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`;
        return phone;
    };

    return (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 transition-shadow hover:shadow-lg">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h3 className="text-lg font-bold text-black truncate" title={nomeCliente}>
                        {nomeCliente}
                    </h3>
                    {/* ▼▼▼ DATA DO PEDIDO ADICIONADA AQUI ▼▼▼ */}
                    <span className="text-xs font-semibold text-gray-500">
                        {pedido.criadoEm ? format(pedido.criadoEm.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'Data indisponível'}
                    </span>
                </div>
                {/* O horário foi removido daqui para evitar duplicidade, mas pode ser mantido se preferir */}
            </div>

            <div className="space-y-1 text-sm text-gray-700 mb-4">
                <p><strong>Total:</strong> <span className="font-semibold text-green-600">R$ {pedido.totalFinal?.toFixed(2).replace('.', ',') || '0,00'}</span></p>
                <p><strong>Pagamento:</strong> {pedido.formaPagamento || 'Não informado'}</p>
                <p><strong>Telefone:</strong> <a href={`https://wa.me/55${telefoneCliente.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{formatPhoneNumber(telefoneCliente)}</a></p>
            </div>

            <button onClick={() => setIsExpanded(!isExpanded)} className="text-blue-600 text-sm font-semibold mb-3">
                {isExpanded ? 'Ver menos' : 'Ver mais detalhes...'}
            </button>

            {isExpanded && (
                <div className="border-t pt-3 mt-3 space-y-2 text-sm text-gray-600">
                    <h4 className="font-bold text-md text-black">Itens do Pedido:</h4>
                    <ul className="list-disc list-inside space-y-1">
                        {pedido.itens?.map((item, index) => (
                            <li key={index}>
                                {item.quantidade}x {item.nome}
                            </li>
                        ))}
                    </ul>
                    {pedido.endereco && (
                        <div className="border-t pt-2 mt-2">
                           <h4 className="font-bold text-md text-black">Endereço de Entrega:</h4>
                           <p>{pedido.endereco.rua}, {pedido.endereco.numero} - {pedido.endereco.bairro}</p>
                           {pedido.endereco.complemento && <p>Comp: {pedido.endereco.complemento}</p>}
                        </div>
                    )}
                </div>
            )}

            <div className="flex justify-between items-center mt-4 border-t pt-3">
                <div className="flex gap-2">
                    <button onClick={handlePrint} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full" title="Imprimir Comanda"><PrintIcon /></button>
                    {pedido.status !== 'finalizado' && (
                        <button onClick={() => onDeletePedido(pedido.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-full" title="Excluir Pedido">
                            <DeleteIcon />
                        </button>
                    )}
                </div>

                {nextStatus && (
                    <button
                        onClick={() => onUpdateStatus(pedido.id, nextStatus)}
                        className="px-4 py-2 bg-yellow-500 text-black font-bold rounded-lg shadow-sm hover:bg-yellow-400 transition-colors flex items-center gap-2"
                    >
                        Mover para {nextStatus.replace('_', ' ')}
                        <MoveIcon />
                    </button>
                )}
            </div>
        </div>
    );
});

export default PedidoCard;