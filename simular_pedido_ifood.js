// script para simular um evento de webhook enviado pelo iFood localmente
const webhookUrl = 'http://127.0.0.1:5001/matafome-98455/us-central1/ifoodWebhook';

// Você deve trocar este ID para o ID da sua loja (Merchant ID) cadastrado no sistema
const merchantId = "SEU_MERCHANT_ID_AQUI"; 
// Coloque um ID de pedido qualquer do iFood para teste (o sistema vai tentar bater na API para resgatar ele)
const testOrderId = "11111111-2222-3333-4444-555555555555";

const payload = [
  {
    "id": "event-12345678",
    "orderId": testOrderId,
    "merchantId": merchantId,
    "code": "PLC",
    "fullCode": "PLACED",
    "createdAt": new Date().toISOString()
  }
];

async function simularWebhook() {
  console.log(`Enviando evento simulado para ${webhookUrl}...`);
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log('✅ Webhook disparado com sucesso! (Status:', response.status, ')');
      console.log('Verifique o console do seu emulador do Firebase e o seu painel do Mata Fome.');
    } else {
      console.error('❌ Falha ao disparar Webhook. Status:', response.status);
      const text = await response.text();
      console.error('Resposta:', text);
    }
  } catch (error) {
    console.error('❌ Erro de conexão. Certifique-se de que o emulador do Firebase está rodando.');
    console.error(error.message);
  }
}

simularWebhook();
