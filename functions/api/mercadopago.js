import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { FieldValue } from 'firebase-admin/firestore';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { db } from '../firebaseCore.js';

const mercadoPagoToken = defineSecret('MP_ACCESS_TOKEN');
const mpClientSecret = defineSecret('MP_CLIENT_SECRET');
const mpClientIdSecret = defineSecret('MP_CLIENT_ID');

// ==================================================================
// 13. GERAR PIX MERCADO PAGO
// ==================================================================
export const gerarPixMercadoPago = onCall({ region: 'us-central1', secrets: [mercadoPagoToken], maxInstances: 1 }, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Faça login primeiro.');
    const { vendaId, valor, descricao, estabelecimentoId } = request.data || {};
    if (!vendaId || !valor || !estabelecimentoId) throw new HttpsError('invalid-argument', 'Dados ausentes.');

    try {
      const client = new MercadoPagoConfig({ accessToken: mercadoPagoToken.value() });
      const payment = new Payment(client);
      const webhookUrl = 'https://us-central1-matafome-98455.cloudfunctions.net/webhookMercadoPago'; 

      const result = await payment.create({
        body: {
          transaction_amount: Number(valor),
          description: descricao || `Pedido ${vendaId}`,
          payment_method_id: 'pix',
          payer: { email: request.auth.token.email || 'cliente@brocou.system' },
          external_reference: `${estabelecimentoId}|${vendaId}`,
          notification_url: webhookUrl 
        }
      });

      await db.collection('pagamentos_pix').doc(vendaId).set({
        idPagamentoMP: String(result.id), status: 'pending', valor: Number(valor), vendaId, estabelecimentoId, criadoEm: FieldValue.serverTimestamp()
      }, { merge: true });

      return {
        sucesso: true, qrCodeBase64: result.point_of_interaction.transaction_data.qr_code_base64,
        copiaECola: result.point_of_interaction.transaction_data.qr_code, idPagamento: String(result.id)
      };
    } catch (error) { throw new HttpsError('internal', 'Erro ao gerar PIX.'); }
});

// ==================================================================
// 12. WEBHOOK MERCADO PAGO
// ==================================================================
export const webhookMercadoPago = onRequest({ secrets: [mercadoPagoToken], maxInstances: 1 }, async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    try {
        const paymentId = req.body?.data?.id;
        if (!paymentId) return res.status(200).send('OK');

        const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${mercadoPagoToken.value()}` }
        });
        const pagamentoReal = await mpResponse.json();
        
        if (pagamentoReal.status === 'approved' && pagamentoReal.external_reference) {
            const [estabId, pedidoId] = pagamentoReal.external_reference.split('|');
            const batch = db.batch();
            batch.set(db.collection('pagamentos_pix').doc(pedidoId), { status: 'pago', pagoEm: FieldValue.serverTimestamp() }, { merge: true });
            batch.set(db.doc(`estabelecimentos/${estabId}/pedidos/${pedidoId}`), { status: 'pago', pago: true, pagoEm: FieldValue.serverTimestamp(), metodoPagamento: 'pix' }, { merge: true });
            await batch.commit();
        }
        res.status(200).send('OK');
    } catch (error) { res.status(200).send('OK'); }
});

// ==================================================================
// 13. VINCULAR CONTA DO LOJISTA (OAuth)
// ==================================================================
export const vincularMercadoPago = onCall({ secrets: [mpClientSecret, mpClientIdSecret] }, async (request) => {
    const { code, estabelecimentoId } = request.data;
    if (!code || !estabelecimentoId) throw new HttpsError('invalid-argument', 'Faltam dados.');

    try {
        const response = await fetch('https://api.mercadopago.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: mpClientIdSecret.value(), client_secret: mpClientSecret.value(),
                code: code, grant_type: 'authorization_code', redirect_uri: 'https://matafome-98455.web.app/admin/configuracoes'
            })
        });
        const data = await response.json();
        if (data.access_token) {
            await db.collection('estabelecimentos').doc(estabelecimentoId).update({
                mp_access_token: data.access_token, mp_refresh_token: data.refresh_token,
                mp_user_id: data.user_id, mp_conectado: true, mp_data_vinculo: FieldValue.serverTimestamp()
            });
            return { sucesso: true };
        }
        throw new Error(data.message || 'Falha ao obter access_token');
    } catch (error) { throw new HttpsError('internal', error.message); }
});

