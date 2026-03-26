// src/utils/notifications.js — Push Notification Helper
// Envia notificações locais quando o status do pedido muda

const STATUS_MESSAGES = {
  'preparo': { title: '👨‍🍳 Pedido em preparo!', body: 'Seu pedido está sendo preparado' },
  'em_preparo': { title: '👨‍🍳 Pedido em preparo!', body: 'Seu pedido está sendo preparado' },
  'pronto': { title: '✅ Pedido pronto!', body: 'Seu pedido está pronto para retirada' },
  'pronto_para_servir': { title: '✅ Pedido pronto!', body: 'Seu pedido está pronto' },
  'em_entrega': { title: '🏍️ Saiu para entrega!', body: 'Seu pedido está a caminho' },
  'entregue': { title: '🎉 Pedido entregue!', body: 'Bom apetite! Avalie seu pedido' },
  'finalizado': { title: '🎉 Pedido finalizado!', body: 'Obrigado por pedir conosco!' },
  'cancelado': { title: '❌ Pedido cancelado', body: 'Seu pedido foi cancelado' },
};

// Pedir permissão
export async function pedirPermissaoNotificacao() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// Enviar notificação local (funciona sem backend push server)
export function notificarStatusPedido(novoStatus, pedidoId) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const msg = STATUS_MESSAGES[novoStatus];
  if (!msg) return;

  const shortId = pedidoId ? `#${pedidoId.slice(-6).toUpperCase()}` : '';

  // Tenta via Service Worker primeiro
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(msg.title, {
        body: `${msg.body} ${shortId}`,
        icon: '/food.png',
        badge: '/food.png',
        vibrate: [200, 100, 200],
        tag: `pedido-${pedidoId || 'update'}`,
        data: { url: '/meus-pedidos' }
      });
    }).catch(() => {
      // Fallback: notificação direta
      new Notification(msg.title, { body: `${msg.body} ${shortId}`, icon: '/food.png' });
    });
  } else {
    new Notification(msg.title, { body: `${msg.body} ${shortId}`, icon: '/food.png' });
  }
}

// Registrar Service Worker
export function registrarServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((err) => { console.error(err); });
  }
}
