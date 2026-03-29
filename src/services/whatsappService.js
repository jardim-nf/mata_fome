// src/services/whatsappService.js — Envio automático via UAZAPI
// Usado quando o estabelecimento tem UAZAPI configurado e ativo

/**
 * Envia mensagem de texto via UAZAPI
 * @param {object} configWhatsApp - { serverUrl, apiKey, instanceName, ativo }
 * @param {string} telefone - Número do cliente (ex: "22998102575")
 * @param {string} mensagem - Texto da mensagem
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const enviarMensagemUazapi = async (configWhatsApp, telefone, mensagem) => {
    try {
        if (!configWhatsApp?.ativo || !configWhatsApp?.serverUrl || !configWhatsApp?.apiKey) {
            return { success: false, error: 'UAZAPI não configurado' };
        }

        // Valida que não é a URL placeholder padrão
        if (configWhatsApp.serverUrl.includes('meunumero.uazapi.com')) {
            console.warn('[WhatsApp UAZAPI] URL padrão detectada, UAZAPI não configurado corretamente.');
            return { success: false, error: 'URL UAZAPI não configurada (ainda é o padrão)' };
        }

        // Formatar número: só dígitos, com 55 se não tiver
        let numero = String(telefone).replace(/\D/g, '');
        if (!numero || numero.length < 10) {
            return { success: false, error: 'Telefone inválido' };
        }
        if (!numero.startsWith('55')) numero = '55' + numero;

        // UAZAPI usa token como query parameter
        const url = `${configWhatsApp.serverUrl}/sendText?token=${configWhatsApp.apiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                number: `${numero}@c.us`,
                text: mensagem,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[WhatsApp UAZAPI] Erro:', response.status, errorText);
            return { success: false, error: `HTTP ${response.status}` };
        }

        const data = await response.json();
        console.log('[WhatsApp UAZAPI] ✅ Mensagem enviada:', data);
        return { success: true, data };
    } catch (error) {
        console.error('[WhatsApp UAZAPI] Falha ao enviar:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Monta a mensagem de pedido recebido baseada na forma de pagamento
 * @param {object} pedido - Dados do pedido
 * @returns {string} Mensagem formatada
 */
export const montarMensagemPedidoRecebido = (pedido) => {
    const nomeCliente = pedido.cliente?.nome || 'Cliente';
    const idCurto = pedido.id?.slice(0, 4).toUpperCase();
    const formaPag = (pedido.formaPagamento || '').toLowerCase();
    
    // Calcular total
    const total = pedido.totalFinal || pedido.total || 
        (pedido.itens || []).reduce((acc, it) => {
            const preco = Number(it.preco) || 0;
            const qtd = Number(it.quantidade) || 1;
            const adicionais = (it.adicionais || []).reduce((a, ad) => a + (Number(ad.preco) || 0), 0);
            return acc + ((preco + adicionais) * qtd);
        }, 0) || 0;
    
    const totalFormatado = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    let frasePrincipal = '';
    
    if (formaPag === 'pix_manual' || formaPag === 'pix') {
        frasePrincipal = `Seu pedido *#${idCurto}* foi recebido! ✅\n\n🧾 *Seu pagamento foi no PIX via chave* — por favor, envie o comprovante por aqui para confirmarmos.`;
    } else {
        frasePrincipal = `Seu pedido *#${idCurto}* foi recebido! ✅\n\nEm instantes você receberá atualizações sobre o preparo. 🍔`;
    }

    return `Olá, *${nomeCliente}*! 👋\n\n${frasePrincipal}\n\n💰 *Valor Total: ${totalFormatado}*`;
};

/**
 * Envia notificação automática de pedido recebido via UAZAPI
 * @param {object} configWhatsApp - Configuração do UAZAPI do estabelecimento
 * @param {object} pedido - Dados do pedido recebido
 * @returns {Promise<{success: boolean}>}
 */
export const notificarPedidoRecebido = async (configWhatsApp, pedido) => {
    const telefone = pedido.cliente?.telefone || pedido.telefone;
    if (!telefone) return { success: false, error: 'Sem telefone' };
    
    const mensagem = montarMensagemPedidoRecebido(pedido);
    return await enviarMensagemUazapi(configWhatsApp, telefone, mensagem);
};
