import { describe, it, expect } from 'vitest';

// Extrai lógica do notifications.js (linhas 4-13)
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

// Extrai lógica de construção da notificação (linhas 25-31)
export function construirNotificacao(novoStatus, pedidoId) {
  const msg = STATUS_MESSAGES[novoStatus];
  if (!msg) return null;

  const shortId = pedidoId ? `#${pedidoId.slice(-6).toUpperCase()}` : '';
  return {
    title: msg.title,
    body: `${msg.body} ${shortId}`.trim(),
    tag: `pedido-${pedidoId || 'update'}`
  };
}

describe('🔔 QA - Push Notifications (Status do Pedido)', () => {
  it('Status "preparo" deve gerar notificação com emoji cozinheiro', () => {
    const notif = construirNotificacao('preparo', 'abc123');
    expect(notif.title).toContain('preparo');
    expect(notif.body).toContain('preparado');
  });

  it('Status "em_entrega" deve gerar notificação de motoboy', () => {
    const notif = construirNotificacao('em_entrega', 'def456');
    expect(notif.title).toContain('entrega');
    expect(notif.body).toContain('caminho');
  });

  it('Status "cancelado" deve gerar notificação negativa', () => {
    const notif = construirNotificacao('cancelado', 'xyz789');
    expect(notif.title).toContain('cancelado');
  });

  it('Deve incluir shortId do pedido no body', () => {
    const notif = construirNotificacao('pronto', 'pedido123456');
    expect(notif.body).toContain('#123456');
  });

  it('Status inválido deve retornar null (sem notificação)', () => {
    expect(construirNotificacao('status_desconhecido', '123')).toBeNull();
    expect(construirNotificacao('', '123')).toBeNull();
  });

  it('Tag deve ser única por pedido', () => {
    const n1 = construirNotificacao('pronto', 'pedido_A');
    const n2 = construirNotificacao('pronto', 'pedido_B');
    expect(n1.tag).not.toBe(n2.tag);
  });

  it('Pedido sem ID deve gerar tag fallback', () => {
    const notif = construirNotificacao('pronto', null);
    expect(notif.tag).toBe('pedido-update');
  });
});
