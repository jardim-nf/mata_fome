import React, { useState, useMemo, useCallback } from 'react';
import { 
    IoPerson, IoTime, IoTrash, IoArrowForward, IoCheckmarkCircle, IoPrint,
    IoLocation, IoCard, IoCash, IoLogoWhatsapp
} from "react-icons/io5";

const PedidoCard = ({ 
    item, 
    onUpdateStatus, 
    onExcluir, 
    newOrderIds, 
    showMesaInfo = true,
    isAgrupado = false,
    estabelecimentoInfo = null
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    
    const isNew = newOrderIds && newOrderIds.has ? newOrderIds.has(item.id) : false;

    const nomesClientes = useMemo(() => {
        if (!item.itens) return [];
        const nomes = item.itens
            .map(i => i.clienteNome || i.destinatario)
            .filter(n => n && n !== 'Mesa');
        return [...new Set(nomes)];
    }, [item.itens]);

    const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

    const getStatusConfig = (status) => {
        switch (status) {
            case 'aguardando_pagamento': return { color: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: '💲', label: 'Pagamento', btn: 'bg-green-600 hover:bg-green-700' };
            case 'recebido': return { color: 'bg-red-50 text-red-700 border-red-200', icon: '📥', label: 'Recebido', btn: 'bg-orange-500 hover:bg-orange-600' };
            case 'preparo': return { color: 'bg-orange-50 text-orange-700 border-orange-200', icon: '👨‍🍳', label: 'Preparo', btn: 'bg-blue-500 hover:bg-blue-600' };
            case 'pronto_para_servir': return { color: 'bg-green-50 text-green-700 border-green-200', icon: '✅', label: 'Pronto', btn: 'bg-green-500 hover:bg-green-600' };
            case 'em_entrega': return { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: '🛵', label: 'Entrega', btn: 'bg-green-500 hover:bg-green-600' };
            case 'finalizado': return { color: 'bg-gray-50 text-gray-700 border-gray-200', icon: '📦', label: 'Finalizado', btn: 'bg-gray-500' };
            default: return { color: 'bg-gray-50 text-gray-700', icon: '?', label: status, btn: 'bg-gray-500' };
        }
    };

    const statusConfig = getStatusConfig(item.status);

    // FUNÇÃO PARA TRADUZIR FORMA DE PAGAMENTO
    const traduzirFormaPagamento = (forma) => {
        const traducoes = {
            'CREDIT_CARD': 'CARTÃO DE CRÉDITO',
            'DEBIT_CARD': 'CARTÃO DE DÉBITO',
            'CASH': 'DINHEIRO',
            'PIX': 'PIX',
            'credit_card': 'CARTÃO DE CRÉDITO',
            'debit_card': 'CARTÃO DE DÉBITO',
            'cash': 'DINHEIRO',
            'pix': 'PIX',
            'card': 'CARTÃO',
            'money': 'DINHEIRO'
        };
        return traducoes[forma] || forma.toUpperCase();
    };

    // FUNÇÃO PARA GERAR MENSAGEM DO WHATSAPP POR STATUS
    const gerarMensagemWhatsApp = (status) => {
        const pedidoId = item.id?.slice(0, 8).toUpperCase() || 'N/E';
        const clienteNome = item.cliente?.nome || item.clienteNome || 'Cliente';
        const telefoneCliente = item.cliente?.telefone || item.telefone;
        const estabelecimentoNome = estabelecimentoInfo?.nome || 'Restaurante';
        
        // Formatar itens do pedido
        const itensFormatados = item.itens?.map(item => 
            `• ${item.quantidade}x ${item.nome} - R$ ${(item.preco * item.quantidade).toFixed(2)}`
        ).join('\n') || '';

        // Informações de endereço para delivery
        const enderecoInfo = item.tipo !== 'salao' && item.cliente?.endereco ? `
*Endereço de entrega:*
${item.cliente.endereco.rua}, ${item.cliente.endereco.numero}
${item.cliente.endereco.bairro}${item.cliente.endereco.cidade ? ' - ' + item.cliente.endereco.cidade : ''}
${item.cliente.endereco.complemento ? 'Complemento: ' + item.cliente.endereco.complemento : ''}` : '';

        const mensagensPorStatus = {
            recebido: `
🎉 *PEDIDO RECEBIDO - ${estabelecimentoNome.toUpperCase()}* 🎉

*Pedido:* #${pedidoId}
*Cliente:* ${clienteNome}
*Total:* R$ ${item.total?.toFixed(2) || '0,00'}

*Itens:*
${itensFormatados}
${enderecoInfo}

✅ *Status:* PEDIDO RECEBIDO COM SUCESSO!
⏰ *Previsão de preparo:* 20-30 minutos

Agradecemos pela preferência! 🍕`,

            em_entrega: `
🚀 *PEDIDO SAIU PARA ENTREGA - ${estabelecimentoNome.toUpperCase()}* 🚀

*Pedido:* #${pedidoId}
*Cliente:* ${clienteNome}
*Total:* R$ ${item.total?.toFixed(2) || '0,00'}

*Itens:*
${itensFormatados}
${enderecoInfo}

🛵 *Status:* PEDIDO SAIU PARA ENTREGA!
⏰ *Previsão de entrega:* 15-25 minutos

Seu pedido está a caminho! 📦`,

            finalizado: `
✅ *PEDIDO FINALIZADO - ${estabelecimentoNome.toUpperCase()}* ✅

*Pedido:* #${pedidoId}
*Cliente:* ${clienteNome}
*Total:* R$ ${item.total?.toFixed(2) || '0,00'}

*Itens:*
${itensFormatados}

🏁 *Status:* PEDIDO ENTREGUE/FINALIZADO!

Agradecemos pela preferência! 
Volte sempre! 🍕❤️`,

            preparo: `
👨‍🍳 *PEDIDO EM PREPARO - ${estabelecimentoNome.toUpperCase()}* 👨‍🍳

*Pedido:* #${pedidoId}
*Cliente:* ${clienteNome}

*Itens:*
${itensFormatados}

🔥 *Status:* SEU PEDIDO ESTÁ SENDO PREPARADO!
⏰ *Previsão:* 15-25 minutos

Aguarde, em breve seu pedido estará pronto! 🍕`
        };

        return mensagensPorStatus[status] || '';
    };

    // FUNÇÃO PARA ENVIAR WHATSAPP
    const enviarWhatsApp = (status) => {
        const telefoneCliente = item.cliente?.telefone || item.telefone;
        
        if (!telefoneCliente) {
            alert('Telefone do cliente não encontrado!');
            return;
        }

        // Formatar telefone (55 + DDD + número)
        const telefoneFormatado = '55' + telefoneCliente.replace(/\D/g, '');
        
        // Gerar mensagem conforme o status
        const mensagem = gerarMensagemWhatsApp(status);
        
        if (!mensagem) {
            alert('Mensagem não disponível para este status!');
            return;
        }

        // Codificar mensagem para URL
        const mensagemCodificada = encodeURIComponent(mensagem.trim());
        
        // Gerar link do WhatsApp
        const whatsappUrl = `https://wa.me/${telefoneFormatado}?text=${mensagemCodificada}`;
        
        // Abrir WhatsApp
        window.open(whatsappUrl, '_blank');
    };

    // FUNÇÃO DE IMPRESSÃO MELHORADA
    const handlePrint = useCallback(() => {
        if (!item) {
            console.error('Item não disponível para impressão');
            return;
        }
        
        setIsPrinting(true);
        
        try {
            // Criar um iframe oculto para impressão
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = 'none';
            iframe.style.opacity = '0';
            iframe.style.pointerEvents = 'none';
            document.body.appendChild(iframe);
            
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            
            // Agrupar itens por cliente para salão
            const itensPorPessoa = {};
            if (item.itens) {
                item.itens.forEach(itemPedido => {
                    const nome = itemPedido.clienteNome || itemPedido.destinatario || 'Mesa';
                    if (!itensPorPessoa[nome]) itensPorPessoa[nome] = [];
                    itensPorPessoa[nome].push(itemPedido);
                });
            }

            // Formatar dados do cliente para delivery - CORREÇÃO COMPLETA
            const clienteNome = item.cliente?.nome || item.clienteNome || item.nomeCliente || item.userInfo?.nome || 'Cliente';
            const clienteTelefone = item.cliente?.telefone || item.telefone || item.clienteTelefone || item.userInfo?.telefone || 'Não informado';

            // CORREÇÃO: Acessar endereço corretamente
            const endereco = item.cliente?.endereco || item.endereco || item.userInfo?.endereco || {};
            const rua = endereco.rua || endereco.logradouro || endereco.endereco || 'Endereço não informado';
            const numero = endereco.numero || '';
            const bairro = endereco.bairro || '';
            const complemento = endereco.complemento || '';
            const cidade = endereco.cidade || '';
            const cep = endereco.cep || '';
            
            // Forma de pagamento - TRADUZIDA
            const formaPagamento = item.formaPagamento || item.metodoPagamento || item.pagamento?.tipo || 'Não informado';
            const formaPagamentoTraduzida = traduzirFormaPagamento(formaPagamento);
            const trocoPara = item.trocoPara || item.pagamento?.trocoPara ? 
                `Troco para: R$ ${parseFloat(item.trocoPara || item.pagamento?.trocoPara).toFixed(2)}` : '';
            
            // Tipo de entrega
            const tipoEntrega = item.tipo === 'retirada' ? '🛵 RETIRADA NO BALCÃO' : '🛵 DELIVERY';

            // ID do pedido
            const pedidoId = item.id || item.pedidoId || 'N/E';
            const pedidoIdShort = pedidoId.slice(0, 6).toUpperCase();

            // Data do pedido
            const dataPedido = item.createdAt?.toDate ? item.createdAt.toDate() : 
                              item.dataPedido?.toDate ? item.dataPedido.toDate() : 
                              new Date();

            // Conteúdo HTML direto para impressão
            const content = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Comanda - ${item.mesaNumero || 'Delivery'}</title>
                    <style>
                        @media print {
                            @page { 
                                margin: 0; 
                                size: 80mm auto; 
                            }
                            body { 
                                margin: 0; 
                                padding: 8px; 
                                background: white; 
                                font-size: 11px;
                                line-height: 1.2;
                            }
                        }
                        body { 
                            margin: 0; 
                            padding: 8px; 
                            font-family: 'Courier New', Courier, monospace; 
                            font-size: 11px;
                            background: white;
                            width: 80mm;
                            line-height: 1.2;
                        }
                        .text-center { text-align: center; }
                        .text-left { text-align: left; }
                        .font-bold { font-weight: bold; }
                        .text-xl { font-size: 18px; }
                        .text-lg { font-size: 14px; }
                        .text-sm { font-size: 10px; }
                        .divider { border-top: 1px dashed #000; margin: 6px 0; }
                        .item-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                        .cliente-header { 
                            background: #eee; 
                            font-weight: bold; 
                            padding: 2px 4px; 
                            margin: 6px 0 3px 0;
                            border-bottom: 1px solid #000;
                            text-transform: uppercase;
                            font-size: 10px;
                        }
                        .obs { font-size: 9px; font-style: italic; margin-left: 8px; color: #666; }
                        .mesa-grande { 
                            font-size: 22px; 
                            font-weight: bold; 
                            border: 2px solid #000; 
                            padding: 6px 10px; 
                            display: inline-block;
                            margin: 4px 0;
                        }
                        .info-cliente { 
                            background: #f8f8f8; 
                            padding: 6px; 
                            margin: 6px 0; 
                            border-left: 3px solid #000;
                            font-size: 10px;
                        }
                        .info-row { display: flex; align-items: flex-start; margin-bottom: 2px; }
                        .info-icon { width: 12px; margin-right: 4px; margin-top: 1px; }
                        .pagamento-info { 
                            background: #e8f5e8; 
                            padding: 4px; 
                            margin: 4px 0;
                            border: 1px solid #4caf50;
                            font-weight: bold;
                        }
                    </style>
                </head>
                <body>
                    <div class="text-center">
                        <h1 class="font-bold text-lg">${estabelecimentoInfo?.nome || 'RESTAURANTE'}</h1>
                        <div class="divider"></div>
                        
                        ${item.mesaNumero ? `
                            <p class="font-bold">MESA</p>
                            <div class="mesa-grande">${item.mesaNumero}</div>
                        ` : `
                            <p class="font-bold text-lg">${tipoEntrega}</p>
                        `}
                        
                        <p>Pedido #${pedidoIdShort}</p>
                        <p>${dataPedido.toLocaleString('pt-BR')}</p>
                    </div>

                    <!-- INFORMAÇÕES DO CLIENTE (APENAS DELIVERY/RETIRADA) -->
                    ${!item.mesaNumero ? `
                        <div class="divider"></div>
                        
                        <!-- INFORMAÇÕES DE PAGAMENTO -->
                        <div class="pagamento-info text-center">
                            💳 PAGAMENTO: ${formaPagamentoTraduzida}
                            ${trocoPara ? `<br>${trocoPara}` : ''}
                        </div>

                        <!-- DADOS DO CLIENTE -->
                        <div class="info-cliente">
                            <div class="info-row">
                                <span class="info-icon">👤</span>
                                <span><strong>${clienteNome}</strong></span>
                            </div>
                            <div class="info-row">
                                <span class="info-icon">📞</span>
                                <span>${clienteTelefone}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-icon">📍</span>
                                <span>
                                    ${rua}${numero ? ', ' + numero : ''}<br>
                                    ${bairro}${cidade ? ' - ' + cidade : ''}<br>
                                    ${complemento ? 'Comp: ' + complemento : ''}
                                    ${cep ? '<br>CEP: ' + cep : ''}
                                </span>
                            </div>
                            ${item.observacao ? `
                                <div class="info-row">
                                    <span class="info-icon">📝</span>
                                    <span><strong>Observação:</strong> ${item.observacao}</span>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}

                    <div class="divider"></div>

                    <!-- ITENS DO PEDIDO -->
                    <div class="items">
                        ${Object.entries(itensPorPessoa).map(([nomeCliente, itens]) => `
                            <div>
                                ${item.mesaNumero ? `
                                    <div class="cliente-header">
                                        👤 ${nomeCliente}
                                    </div>
                                ` : ''}
                                ${itens.map(itemPedido => `
                                    <div style="margin-bottom: 4px;">
                                        <div class="item-row">
                                            <span class="font-bold">${itemPedido.quantidade}x ${itemPedido.nome}</span>
                                            <span>R$ ${(itemPedido.preco * itemPedido.quantidade).toFixed(2)}</span>
                                        </div>
                                        ${itemPedido.observacao ? `
                                            <div class="obs">** ${itemPedido.observacao}</div>
                                        ` : ''}
                                        ${itemPedido.adicionais && itemPedido.adicionais.length > 0 ? `
                                            <div class="obs">
                                                + ${itemPedido.adicionais.map(a => a.nome).join(', ')}
                                            </div>
                                        ` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        `).join('')}
                    </div>

                    <div class="divider"></div>

                    <!-- RESUMO DO PEDIDO -->
                    <div style="margin: 8px 0;">
                        <div class="item-row">
                            <span>Subtotal:</span>
                            <span>R$ ${item.subtotal?.toFixed(2) || item.total?.toFixed(2)}</span>
                        </div>
                        ${item.taxaEntrega ? `
                            <div class="item-row">
                                <span>Taxa de Entrega:</span>
                                <span>R$ ${parseFloat(item.taxaEntrega).toFixed(2)}</span>
                            </div>
                        ` : ''}
                        <div class="item-row" style="font-weight: bold; font-size: 12px; margin-top: 4px; border-top: 1px solid #000; padding-top: 4px;">
                            <span>TOTAL:</span>
                            <span>R$ ${item.total?.toFixed(2) || '0,00'}</span>
                        </div>
                    </div>

                    <div class="divider"></div>

                    <div class="text-center">
                        <p class="font-bold">*** ${item.mesaNumero ? 'COMANDA MESA' : 'PEDIDO DELIVERY'} ***</p>
                        <p class="text-sm">Obrigado pela preferência!</p>
                        ${!item.mesaNumero ? `<p class="text-sm">⏰ Tempo estimado: 30-45 min</p>` : ''}
                    </div>

                    <script>
                        // Focar e imprimir automaticamente
                        setTimeout(() => {
                            window.print();
                        }, 300);
                    </script>
                </body>
                </html>
            `;

            doc.open();
            doc.write(content);
            doc.close();

            // Configurar evento para remover iframe após impressão
            const removeIframe = () => {
                setTimeout(() => {
                    if (document.body.contains(iframe)) {
                        document.body.removeChild(iframe);
                    }
                    setIsPrinting(false);
                }, 1000);
            };

            // Tentar detectar quando a impressão termina
            iframe.contentWindow.onafterprint = removeIframe;
            
            // Fallback: remover iframe após 5 segundos
            setTimeout(removeIframe, 5000);

        } catch (error) {
            console.error('Erro na impressão:', error);
            setIsPrinting(false);
            alert('Erro ao imprimir. Tente novamente.');
        }
    }, [item, estabelecimentoInfo]);

    const handleAction = async (enviarWhatsAppAutomático = true) => {
        if (isUpdating) return;
        
        let nextStatus = null;
        if (item.status === 'aguardando_pagamento') nextStatus = 'recebido';
        else if (item.status === 'recebido') nextStatus = 'preparo';
        else if (item.status === 'preparo') nextStatus = item.source === 'salao' ? 'pronto_para_servir' : 'em_entrega';
        else if (item.status === 'pronto_para_servir' || item.status === 'em_entrega') nextStatus = 'finalizado';

        if (nextStatus) {
            setIsUpdating(true);
            
            try {
                // Atualizar status primeiro
                await onUpdateStatus(item.id, nextStatus);
                
                // Enviar WhatsApp automaticamente se configurado
                if (enviarWhatsAppAutomático && item.cliente?.telefone) {
                    // Pequeno delay para garantir que o status foi atualizado
                    setTimeout(() => {
                        enviarWhatsApp(nextStatus);
                    }, 1000);
                }
            } catch (error) {
                console.error('Erro ao atualizar status:', error);
            } finally {
                setIsUpdating(false);
            }
        }
    };

    const getBtnText = () => {
        if (item.status === 'aguardando_pagamento') return 'Aprovar Pagamento';
        if (item.status === 'recebido') return 'Iniciar Preparo';
        if (item.status === 'preparo') return item.source === 'salao' ? 'Pronto p/ Servir' : 'Saiu p/ Entrega';
        return 'Finalizar';
    };

    // BOTÃO WHATSAPP INDIVIDUAL
    const WhatsAppButton = ({ status, className = "" }) => (
        <button 
            onClick={() => enviarWhatsApp(status)}
            className={`h-full aspect-square flex items-center justify-center bg-green-100 text-green-600 rounded-lg hover:bg-green-200 hover:text-green-700 transition-colors border border-green-200 ${className}`}
            title={`Enviar WhatsApp - ${status}`}
        >
            <IoLogoWhatsapp className="text-lg" />
        </button>
    );

    return (
        <div className={`relative bg-white rounded-xl transition-all duration-200 w-full border shadow-sm ${isNew ? 'ring-2 ring-red-400 animate-pulse border-red-200' : 'border-gray-200'} ${item.status === 'finalizado' ? 'opacity-75' : ''}`}>
            
            {/* CABEÇALHO DO CARD */}
            {showMesaInfo && !isAgrupado && (
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 rounded-t-xl">
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                            <span className="font-black text-gray-800 text-lg flex items-center gap-2">
                                {item.tipo === 'salao' ? `Mesa ${item.mesaNumero}` : '🛵 Delivery'}
                                {item.id && (
                                    <span className="text-xs font-normal text-gray-500">
                                        #${item.id.slice(0,6).toUpperCase()}
                                    </span>
                                )}
                            </span>
                            
                            {item.tipo === 'salao' && nomesClientes.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {nomesClientes.map((nome, idx) => (
                                        <span key={idx} className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                            <IoPerson className="text-[8px]" /> {nome}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Info cliente delivery */}
                            {item.tipo !== 'salao' && (
                                <div className="flex flex-col gap-1 mt-1">
                                    <span className="text-xs text-gray-600 flex items-center gap-1">
                                        <IoPerson className="w-3 h-3" /> 
                                        {item.cliente?.nome || item.clienteNome || item.userInfo?.nome || 'Cliente'}
                                    </span>
                                    <span className="text-xs text-gray-600 flex items-center gap-1">
                                        <IoLocation className="w-3 h-3" /> 
                                        {item.cliente?.telefone || item.telefone || item.userInfo?.telefone || 'Telefone não informado'}
                                    </span>
                                    {item.cliente?.endereco && (
                                        <span className="text-xs text-gray-600 flex items-start gap-1">
                                            <IoLocation className="w-3 h-3 mt-0.5 flex-shrink-0" /> 
                                            <span>
                                                {item.cliente.endereco.rua}, {item.cliente.endereco.numero} - {item.cliente.endereco.bairro}
                                                {item.cliente.endereco.complemento && ` (${item.cliente.endereco.complemento})`}
                                            </span>
                                        </span>
                                    )}
                                    <span className="text-xs text-gray-600 flex items-center gap-1">
                                        {item.formaPagamento === 'cash' || item.formaPagamento === 'dinheiro' ? <IoCash className="w-3 h-3" /> : <IoCard className="w-3 h-3" />}
                                        {traduzirFormaPagamento(item.formaPagamento || item.pagamento?.tipo || 'Pagamento')}
                                    </span>
                                </div>
                            )}

                            {item.loteHorario && (
                                <span className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                                    <IoTime className="w-3 h-3"/> {item.loteHorario}
                                </span>
                            )}
                        </div>
                        <div className="text-right">
                            <span className="text-sm font-medium text-gray-500 block">Total</span>
                            <span className="font-black text-gray-900 text-base">
                                {formatarMoeda(item.total)}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            <div className="p-4">
                {/* STATUS */}
                <div className="mb-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 w-fit ${statusConfig.color}`}>
                        <span>{statusConfig.icon}</span>
                        {statusConfig.label}
                    </span>
                </div>

                {/* LISTA DE ITENS */}
                <div className="space-y-3 mb-4">
                    {item.itens?.slice(0, isExpanded ? undefined : 4).map((it, idx) => (
                        <div key={idx} className="flex gap-2 text-sm border-b border-dashed border-gray-100 pb-2 last:border-0 last:pb-0">
                            <span className="font-bold text-gray-900 min-w-[20px]">{it.quantidade}x</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <p className="text-gray-700 font-medium leading-tight">{it.nome || it.nomeBase}</p>
                                    {(it.clienteNome || it.destinatario) && (it.clienteNome !== 'Mesa' && it.destinatario !== 'Mesa') && (
                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded ml-2 whitespace-nowrap">
                                            {it.clienteNome || it.destinatario}
                                        </span>
                                    )}
                                </div>
                                {it.observacao && <p className="text-xs text-red-500 mt-0.5 font-medium">Obs: {it.observacao}</p>}
                                {it.adicionais && it.adicionais.length > 0 && (
                                    <p className="text-xs text-gray-400 mt-0.5">+ {it.adicionais.map(a => a.nome).join(', ')}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {item.itens?.length > 4 && (
                    <button onClick={() => setIsExpanded(!isExpanded)} className="w-full text-center text-xs font-semibold text-gray-400 hover:text-blue-600 py-1 mb-2">
                        {isExpanded ? 'Ver menos' : `Ver mais ${item.itens.length - 4} itens...`}
                    </button>
                )}

                <div className="flex gap-2 mt-4 h-10">
                    {/* 🖨️ BOTÃO IMPRIMIR */}
                    <button 
                        onClick={handlePrint}
                        disabled={isPrinting}
                        className="h-full aspect-square flex items-center justify-center bg-gray-100 text-gray-500 rounded-lg hover:bg-blue-100 hover:text-blue-600 transition-colors border border-gray-200 disabled:opacity-50" 
                        title="Imprimir comanda"
                    >
                        {isPrinting ? (
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                        ) : (
                            <IoPrint className="text-lg" />
                        )}
                    </button>

                    {/* 📱 BOTÕES WHATSAPP POR STATUS */}
                    {item.status === 'recebido' && (
                        <WhatsAppButton status="recebido" />
                    )}
                    
                    {item.status === 'preparo' && (
                        <WhatsAppButton status="preparo" />
                    )}
                    
                    {item.status === 'em_entrega' && (
                        <WhatsAppButton status="em_entrega" />
                    )}
                    
                    {item.status === 'finalizado' && (
                        <WhatsAppButton status="finalizado" />
                    )}

                    {onExcluir && (item.status === 'recebido' || item.status === 'aguardando_pagamento') && (
                        <button onClick={() => onExcluir(item.id, item.source)} className="h-full aspect-square flex items-center justify-center bg-gray-100 text-gray-500 rounded-lg hover:bg-red-100 hover:text-red-600 transition-colors border border-gray-200">
                            <IoTrash className="text-lg" />
                        </button>
                    )}

                    {item.status !== 'finalizado' ? (
                        <button 
                            onClick={() => handleAction(true)} 
                            disabled={isUpdating} 
                            className={`flex-1 h-full rounded-lg font-bold text-white text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm ${statusConfig.btn}`}
                        >
                            {isUpdating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <><span>{getBtnText()}</span><IoArrowForward className="text-lg" /></>}
                        </button>
                    ) : (
                        <div className="flex-1 h-full flex items-center justify-center gap-2 bg-gray-100 text-gray-500 font-bold text-sm rounded-lg border border-gray-200">
                            <IoCheckmarkCircle className="text-green-500 text-lg"/> Concluído
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PedidoCard;