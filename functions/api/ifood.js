import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firebaseCore.js';

// Get credentials from environment variables (Cloud Run or local .env)
const getIfoodCredentials = () => {
    const clientId = process.env.IFOOD_CLIENT_ID;
    const clientSecret = process.env.IFOOD_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
        console.error("Missing IFOOD_CLIENT_ID or IFOOD_CLIENT_SECRET in environment");
    }
    
    return { clientId, clientSecret };
};

// Autenticar com a API do iFood
const getIfoodToken = async () => {
    const { clientId, clientSecret } = getIfoodCredentials();
    
    if (!clientId || !clientSecret) {
        throw new Error("Credenciais do iFood não configuradas no servidor.");
    }

    try {
        const params = new URLSearchParams();
        params.append('grantType', 'client_credentials');
        params.append('clientId', clientId);
        params.append('clientSecret', clientSecret);

        const response = await fetch('https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(`Erro iFood Auth: ${JSON.stringify(data)}`);
        }

        return data.accessToken;
    } catch (error) {
        console.error('Erro ao gerar token do iFood:', error);
        throw error;
    }
};

// ==================================================================
// 1. TESTAR CONEXÃO E LISTAR MERCHANTS
// ==================================================================
export const ifoodTestarConexao = onCall({ maxInstances: 1 }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Faça login primeiro.');
    
    const { estabelecimentoId } = request.data || {};
    if (!estabelecimentoId) throw new HttpsError('invalid-argument', 'estabelecimentoId ausente.');

    try {
        const token = await getIfoodToken();
        
        // Vamos listar os merchants atrelados a esta aplicação para verificar
        const response = await fetch('https://merchant-api.ifood.com.br/merchant/v1.0/merchants', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(`Erro ao listar merchants: ${JSON.stringify(data)}`);
        }

        const merchantId = data?.length > 0 ? data[0].id : null;

        // Já vamos salvar no estabelecimento para que o polling funcione sem precisar do webhook ativado
        if (merchantId) {
            const platformRef = db.doc(`estabelecimentos/${estabelecimentoId}/config/platforms`);
            await platformRef.set({
                ifood: {
                    connected: true,
                    storeId: merchantId,
                    syncStatus: 'connected',
                    lastSync: FieldValue.serverTimestamp()
                }
            }, { merge: true });
        }

        return { 
            sucesso: true, 
            mensagem: 'Conexão com iFood bem-sucedida!',
            merchants: data
        };
    } catch (error) {
        console.error('Erro ifoodTestarConexao:', error);
        throw new HttpsError('internal', error.message || 'Erro ao conectar com iFood');
    }
});

// ==================================================================
// 2. CONFIGURAR WEBHOOK
// ==================================================================
export const ifoodConfigurarWebhook = onCall({ maxInstances: 1 }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Faça login primeiro.');
    
    const { estabelecimentoId, merchantId } = request.data || {};
    if (!estabelecimentoId || !merchantId) {
        throw new HttpsError('invalid-argument', 'estabelecimentoId e merchantId são obrigatórios.');
    }

    try {
        // O webhook URL será o nosso endpoint onRequest abaixo
        const projectId = process.env.GCLOUD_PROJECT || 'matafome-98455'; 
        const region = 'us-central1';
        const webhookUrl = `https://${region}-${projectId}.cloudfunctions.net/ifoodWebhook`;

        // Atualmente o webhook no iFood é gerenciado no Portal do Desenvolvedor, 
        // ou via API (dependendo da versão). Aqui podemos simular que salva na nossa config.
        const platformRef = db.doc(`estabelecimentos/${estabelecimentoId}/config/platforms`);
        await platformRef.set({
            ifood: {
                connected: true,
                storeId: merchantId,
                webhookUrl: webhookUrl,
                syncStatus: 'connected',
                lastSync: FieldValue.serverTimestamp()
            }
        }, { merge: true });

        return { 
            sucesso: true, 
            mensagem: 'Configuração do iFood ativada (Webhook URL configurado internamente).',
            webhookUrl
        };
    } catch (error) {
        console.error('Erro ifoodConfigurarWebhook:', error);
        throw new HttpsError('internal', error.message || 'Erro ao configurar webhook do iFood');
    }
});

// ==================================================================
// 3. RECEBER EVENTOS (WEBHOOK)
// ==================================================================
export const ifoodWebhook = onRequest({ maxInstances: 1 }, async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    
    try {
        const events = req.body; // iFood envia array de eventos
        
        // Se não for um array ou estiver vazio, pode ser um ping de teste do Portal do Desenvolvedor
        if (!events || !Array.isArray(events) || events.length === 0) {
            console.log('Recebido ping de teste do iFood (ou formato inválido):', events);
            return res.status(200).send('OK');
        }

        // Reconhecer recebimento rápido para não dar timeout no iFood
        res.status(200).send('OK');

        const token = await getIfoodToken();

        for (const event of events) {
            const { orderId, code, merchantId, createdAt } = event;
            
            // code: PLC (Placed)
            if (code === 'PLC') {
                const orderDetailsResponse = await fetch(`https://merchant-api.ifood.com.br/order/v1.0/orders/${orderId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (orderDetailsResponse.ok) {
                    const orderData = await orderDetailsResponse.json();
                    
                    const estabsSnapshot = await db.collection('estabelecimentos')
                        .where('config.platforms.ifood.storeId', '==', merchantId)
                        .limit(1).get();

                    if (!estabsSnapshot.empty) {
                        const estabId = estabsSnapshot.docs[0].id;
                        
                        const pedidoMataFome = {
                            id: orderId,
                            origem: 'ifood',
                            source: 'delivery',
                            tipo: 'delivery',
                            status: 'recebido',
                            cliente: {
                                nome: orderData.customer?.name || 'Cliente iFood',
                                telefone: orderData.customer?.phone?.number || '',
                                endereco: orderData.delivery?.deliveryAddress ? 
                                    `${orderData.delivery.deliveryAddress.streetName}, ${orderData.delivery.deliveryAddress.streetNumber}` : ''
                            },
                            itens: orderData.items?.map(item => ({
                                nome: item.name,
                                quantidade: item.quantity,
                                preco: item.unitPrice
                            })) || [],
                            totalFinal: orderData.payments?.prepaid ? 0 : orderData.payments?.pending || 0,
                            metodoPagamento: 'ifood',
                            criadoEm: FieldValue.serverTimestamp(),
                            createdAt: FieldValue.serverTimestamp(),
                            dataPedido: FieldValue.serverTimestamp(),
                            updatedAt: FieldValue.serverTimestamp()
                        };

                        await db.doc(`estabelecimentos/${estabId}/pedidos/${orderId}`).set(pedidoMataFome, { merge: true });
                    }
                }
            }
        }

    } catch (error) {
        console.error('Erro ifoodWebhook:', error);
    }
});

// ==================================================================
// 4. POLLING MANUAL (FALLBACK)
// ==================================================================
export const ifoodPolling = onCall({ maxInstances: 1 }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Faça login primeiro.');
    
    const { estabelecimentoId } = request.data || {};
    if (!estabelecimentoId) throw new HttpsError('invalid-argument', 'estabelecimentoId ausente.');

    try {
        const platformDoc = await db.doc(`estabelecimentos/${estabelecimentoId}/config/platforms`).get();
        const config = platformDoc.data()?.ifood;

        if (!config || !config.connected || !config.storeId) {
            return { sucesso: false, pedidosNovos: 0, mensagem: 'iFood não configurado.' };
        }

        const token = await getIfoodToken();

        const response = await fetch('https://merchant-api.ifood.com.br/order/v1.0/events:polling', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 204) {
            return { sucesso: true, pedidosNovos: 0, mensagem: 'Nenhum novo evento.' };
        }

        if (!response.ok) {
            throw new Error('Falha no polling');
        }

        const events = await response.json();
        const ackIds = [];
        let novos = 0;

        const statusMap = {
            'PLC': 'recebido',
            'CFM': 'recebido',
            'PRS': 'preparo',
            'RDA': 'pronto_para_servir',
            'DSP': 'em_entrega',
            'CON': 'finalizado',
            'CAN': 'cancelado'
        };

        for (const event of events) {
            ackIds.push({ id: event.id });

            if (statusMap[event.code] && event.merchantId === config.storeId) {
                // Fetch the full order details
                const orderDetailsResponse = await fetch(`https://merchant-api.ifood.com.br/order/v1.0/orders/${event.orderId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (orderDetailsResponse.ok) {
                    const orderData = await orderDetailsResponse.json();
                    const statusMataFome = statusMap[event.code];
                    
                    const pedidoMataFome = {
                        id: event.orderId,
                        origem: 'ifood',
                        source: 'delivery',
                        tipo: 'delivery',
                        status: statusMataFome,
                        cliente: {
                            nome: orderData.customer?.name || 'Cliente iFood',
                            telefone: orderData.customer?.phone?.number || '',
                            endereco: orderData.delivery?.deliveryAddress ? 
                                `${orderData.delivery.deliveryAddress.streetName}, ${orderData.delivery.deliveryAddress.streetNumber}` : ''
                        },
                        itens: orderData.items?.map(item => ({
                            nome: item.name,
                            quantidade: item.quantity,
                            preco: item.unitPrice
                        })) || [],
                        totalFinal: orderData.payments?.prepaid ? 0 : orderData.payments?.pending || 0,
                        metodoPagamento: 'ifood',
                        atualizadoEm: FieldValue.serverTimestamp(),
                        updatedAt: FieldValue.serverTimestamp()
                    };

                    // Se for PLC (pedido novo de fato), definimos TODAS as datas de criação
                    // O Kanban filtra por createdAt, então este campo é OBRIGATÓRIO
                    if (event.code === 'PLC' || event.code === 'CFM') {
                        pedidoMataFome.criadoEm = FieldValue.serverTimestamp();
                        pedidoMataFome.createdAt = FieldValue.serverTimestamp();
                        pedidoMataFome.dataPedido = FieldValue.serverTimestamp();
                    }

                    await db.doc(`estabelecimentos/${estabelecimentoId}/pedidos/${event.orderId}`).set(pedidoMataFome, { merge: true });
                    novos++;

                    // Auto-aceite do pedido se configurado E se for um evento PLC
                    if (event.code === 'PLC' && config.autoAccept !== false) {
                        try {
                            await fetch(`https://merchant-api.ifood.com.br/order/v1.0/orders/${event.orderId}/confirm`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            // Atualiza localmente para mostrar que já confirmou no iFood
                            await db.doc(`estabelecimentos/${estabelecimentoId}/pedidos/${event.orderId}`).update({
                                status_ifood: 'CONFIRMED'
                            });
                        } catch (e) {
                            console.error('Erro ao auto-aceitar pedido', event.orderId, e);
                        }
                    }
                }
            }
        }

        if (ackIds.length > 0) {
            await fetch('https://merchant-api.ifood.com.br/order/v1.0/events/acknowledgment', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(ackIds)
            });
        }

        return { sucesso: true, pedidosNovos: novos, mensagem: `${novos} novos eventos processados.` };
    } catch (error) {
        console.error('Erro ifoodPolling:', error);
        throw new HttpsError('internal', error.message || 'Erro no polling do iFood');
    }
});

// ==================================================================
// 5. ATUALIZAR STATUS DO PEDIDO (PREPARO, PRONTO, DESPACHADO)
// ==================================================================
export const ifoodAtualizarStatus = onCall({ maxInstances: 1 }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Faça login primeiro.');
    
    const { orderId, status } = request.data || {};
    if (!orderId || !status) throw new HttpsError('invalid-argument', 'orderId e status são obrigatórios.');

    try {
        const token = await getIfoodToken();
        
        let endpoint = '';
        if (status === 'preparo') endpoint = 'startPreparation';
        else if (status === 'pronto') endpoint = 'readyToPickup';
        else if (status === 'despachado' || status === 'entrega') endpoint = 'dispatch';
        else if (status === 'finalizado') endpoint = 'conclude';
        else if (status === 'confirmado') endpoint = 'confirm';
        
        if (!endpoint) return { sucesso: false, mensagem: 'Status não mapeado para o iFood' };

        const response = await fetch(`https://merchant-api.ifood.com.br/order/v1.0/orders/${orderId}/${endpoint}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`Falha ao atualizar iFood: ${JSON.stringify(err)}`);
        }

        return { sucesso: true, mensagem: `Pedido ${orderId} atualizado para ${status} no iFood.` };
    } catch (error) {
        console.error('Erro ifoodAtualizarStatus:', error);
        throw new HttpsError('internal', error.message || 'Erro ao atualizar status no iFood');
    }
});
