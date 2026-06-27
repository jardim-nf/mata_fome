// src/services/whatsappService.js — Envio automático via UAZAPI
// Usado quando o estabelecimento tem UAZAPI configurado e ativo
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

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



        // Formatar número: só dígitos, com 55 se não tiver
        let numero = String(telefone).replace(/\D/g, '');
        if (!numero || numero.length < 10) {
            return { success: false, error: 'Telefone inválido' };
        }
        if (!numero.startsWith('55')) numero = '55' + numero;

        // Uazapi padrão correto de endpoint (idêntico ao backend)
        const urlBase = configWhatsApp.serverUrl.endsWith('/') ? configWhatsApp.serverUrl.slice(0, -1) : configWhatsApp.serverUrl;
        const url = `${urlBase}/send/text`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'token': configWhatsApp.apiKey
            },
            body: JSON.stringify({
                number: numero,
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
            const preco = Number(it.preco || it.price) || 0;
            const qtd = Number(it.quantidade || it.quantity || it.qtd) || 1;
            const adicionais = (it.adicionais || []).reduce((a, ad) => a + (Number(ad.preco || ad.price) || 0), 0);
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

/**
 * Envia notificação para o número administrativo configurado do estabelecimento
 * @param {string} estabelecimentoId
 * @param {'venda' | 'os_status' | 'os_pagamento'} tipo
 * @param {object} dados
 */
export const notificarAdmin = async (estabelecimentoId, tipo, dados) => {
    try {
        if (!estabelecimentoId) return { success: false, error: 'Sem estabelecimentoId' };
        
        // 1. Carrega as configurações de WhatsApp do estabelecimento
        const estabRef = doc(db, 'estabelecimentos', estabelecimentoId);
        const snap = await getDoc(estabRef);
        if (!snap.exists()) return { success: false, error: 'Estabelecimento não encontrado' };
        
        const wppConfig = snap.data()?.whatsapp;
        if (!wppConfig || !wppConfig.ativo || !wppConfig.telefoneNotificacao) {
            return { success: false, error: 'WhatsApp ou número de notificação não ativos/configurados' };
        }
        
        // 2. Verifica se a notificação para este tipo de evento está ativada
        if (tipo === 'venda' && !wppConfig.notificarVendas) return { success: false };
        if ((tipo === 'os_status' || tipo === 'os_pagamento') && !wppConfig.notificarOS) return { success: false };

        const telefone = wppConfig.telefoneNotificacao;
        let mensagem = '';
        
        if (tipo === 'venda') {
            const idCurto = dados.id?.slice(-6).toUpperCase() || 'PDV';
            const itensTxt = (dados.itens || []).map(it => {
                const qtd = it.quantidade || it.quantity || it.qtd || 1;
                const nome = it.nome || it.name || 'Item';
                return `- ${qtd}x ${nome}`;
            }).join('\n');
            
            mensagem = `🔔 *Nova Venda no PDV!* (#${idCurto})\n\n` +
                       `👤 *Cliente:* ${dados.cliente || 'Balcão'}\n` +
                       `💰 *Total:* ${dados.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n` +
                       `💳 *Pagamento:* ${dados.formaPagamento.toUpperCase()}\n\n` +
                       `📦 *Itens:* \n${itensTxt}`;
        } 
        else if (tipo === 'os_status') {
            const statusLabels = {
                em_analise: 'Em Análise',
                aguardando_orcamento: 'Aguardando Aprovação',
                orcamento_aprovado: 'Orçamento Aprovado',
                orcamento_rejeitado: 'Orçamento Rejeitado',
                em_manutencao: 'Em Manutenção',
                aguardando_peca: 'Aguardando Peça',
                garantia: 'Em Garantia',
                pronto: 'Pronto / Concluído',
                entregue: 'Entregue',
                sem_conserto: 'Sem Conserto'
            };
            const label = statusLabels[dados.status] || dados.status;
            
            mensagem = `🔔 *Atualização de Status de OS!* (#${dados.numeroOS || ''})\n\n` +
                       `👤 *Cliente:* ${dados.cliente?.nome || 'Cliente'}\n` +
                       `🔧 *Equipamento:* ${dados.equipamento?.marca || ''} ${dados.equipamento?.modelo || ''}\n` +
                       `🏷️ *Novo Status:* *${label}*\n` +
                       `✍️ *Técnico:* ${dados.tecnicoResponsavel?.nome || 'Não definido'}`;
        }
        else if (tipo === 'os_pagamento') {
            mensagem = `💰 *Baixa de Pagamento em OS!* (#${dados.numeroOS || ''})\n\n` +
                       `👤 *Cliente:* ${dados.cliente?.nome || 'Cliente'}\n` +
                       `🔧 *Equipamento:* ${dados.equipamento?.marca || ''} ${dados.equipamento?.modelo || ''}\n` +
                       `💵 *Situação:* *PAGO (BAIXA REALIZADA)*\n` +
                       `💰 *Valor:* ${(dados.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
        }
        
        if (!mensagem) return { success: false, error: 'Mensagem vazia' };
        
        return await enviarMensagemUazapi(wppConfig, telefone, mensagem);
    } catch (e) {
        console.error('[WhatsApp Admin Notify] Erro:', e);
        return { success: false, error: e.message };
    }
};
