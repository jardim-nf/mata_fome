import { describe, it, expect } from 'vitest';

// Extrai lógica EXATA do whatsappService.js (linhas 23-28)
export function formatarTelefoneUazapi(telefone) {
  let numero = String(telefone).replace(/\D/g, '');
  if (!numero || numero.length < 10) return { valido: false, motivo: 'Telefone inválido' };
  if (!numero.startsWith('55')) numero = '55' + numero;
  return { valido: true, numero: `${numero}@c.us` };
}

// Extrai lógica do whatsappService.js (linhas 13-21)
export function validarConfigUazapi(config) {
  if (!config?.ativo || !config?.serverUrl || !config?.apiKey) {
    return { valido: false, motivo: 'UAZAPI não configurado' };
  }
  if (config.serverUrl.includes('meunumero.uazapi.com')) {
    return { valido: false, motivo: 'URL UAZAPI não configurada (ainda é o padrão)' };
  }
  return { valido: true };
}

// Extrai lógica do whatsappService.js (linhas 64-88)
export function montarMensagemPedidoRecebido(pedido) {
  const nomeCliente = pedido.cliente?.nome || 'Cliente';
  const idCurto = pedido.id?.slice(0, 4).toUpperCase();
  const formaPag = (pedido.formaPagamento || '').toLowerCase();
  
  const total = pedido.totalFinal || pedido.total || 
    (pedido.itens || []).reduce((acc, it) => {
      const preco = Number(it.preco) || 0;
      const qtd = Number(it.quantidade) || 1;
      const adicionais = (it.adicionais || []).reduce((a, ad) => a + (Number(ad.preco) || 0), 0);
      return acc + ((preco + adicionais) * qtd);
    }, 0) || 0;

  let frasePrincipal = '';
  if (formaPag === 'pix_manual' || formaPag === 'pix') {
    frasePrincipal = `Seu pedido *#${idCurto}* foi recebido! ✅\n\n🧾 *Seu pagamento foi no PIX via chave* — por favor, envie o comprovante por aqui para confirmarmos.`;
  } else {
    frasePrincipal = `Seu pedido *#${idCurto}* foi recebido! ✅\n\nEm instantes você receberá atualizações sobre o preparo. 🍔`;
  }

  return { mensagem: `Olá, *${nomeCliente}*! 👋\n\n${frasePrincipal}`, total };
}

describe('📱 QA - WhatsApp UAZAPI (Formatação + Validação)', () => {
  it('Deve formatar telefone DDD+número (22998102575) para formato WhatsApp', () => {
    const result = formatarTelefoneUazapi('22998102575');
    expect(result.valido).toBe(true);
    expect(result.numero).toBe('5522998102575@c.us');
  });

  it('Deve adicionar 55 se o número NÃO começar com ele', () => {
    const result = formatarTelefoneUazapi('11999887766');
    expect(result.numero).toContain('5511999887766');
  });

  it('Deve aceitar número que JÁ tem 55 na frente', () => {
    const result = formatarTelefoneUazapi('5522998102575');
    expect(result.numero).toBe('5522998102575@c.us');
  });

  it('Deve limpar máscaras: (22) 99810-2575', () => {
    const result = formatarTelefoneUazapi('(22) 99810-2575');
    expect(result.valido).toBe(true);
    expect(result.numero).toContain('22998102575');
  });

  it('Deve rejeitar telefone curto (menos de 10 dígitos)', () => {
    const result = formatarTelefoneUazapi('12345');
    expect(result.valido).toBe(false);
  });

  it('Deve rejeitar telefone vazio/null', () => {
    expect(formatarTelefoneUazapi(''). valido).toBe(false);
    expect(formatarTelefoneUazapi(null).valido).toBe(false);
  });
});

describe('📱 QA - Validação de Config UAZAPI', () => {
  it('Deve rejeitar URL padrão placeholder', () => {
    const result = validarConfigUazapi({ ativo: true, serverUrl: 'https://meunumero.uazapi.com', apiKey: '123' });
    expect(result.valido).toBe(false);
    expect(result.motivo).toContain('padrão');
  });

  it('Deve rejeitar quando não está ativo', () => {
    const result = validarConfigUazapi({ ativo: false, serverUrl: 'https://real.api.com', apiKey: '123' });
    expect(result.valido).toBe(false);
  });

  it('Deve aceitar config real completa', () => {
    const result = validarConfigUazapi({ ativo: true, serverUrl: 'https://minhalojareal.uazapi.com', apiKey: 'token123' });
    // Esta URL NÃO contém "meunumero.uazapi.com", então deve ser aceita
    expect(result.valido).toBe(true);
  });
});

describe('📱 QA - Mensagem WhatsApp de Pedido Recebido', () => {
  it('Deve pedir comprovante quando pagamento é PIX', () => {
    const pedido = { id: 'ABC12345', cliente: { nome: 'João' }, formaPagamento: 'pix', totalFinal: 50 };
    const result = montarMensagemPedidoRecebido(pedido);
    expect(result.mensagem).toContain('comprovante');
    expect(result.mensagem).toContain('ABC1');
  });

  it('Deve NÃO pedir comprovante quando pagamento é dinheiro', () => {
    const pedido = { id: 'XYZ99999', cliente: { nome: 'Maria' }, formaPagamento: 'dinheiro', totalFinal: 30 };
    const result = montarMensagemPedidoRecebido(pedido);
    expect(result.mensagem).not.toContain('comprovante');
    expect(result.mensagem).toContain('atualizações');
  });

  it('Deve calcular total pelos itens quando totalFinal não existe', () => {
    const pedido = {
      id: 'CALC0001', cliente: { nome: 'Teste' }, formaPagamento: 'card',
      itens: [
        { preco: 25, quantidade: 2 },
        { preco: 10, quantidade: 1, adicionais: [{ preco: 3 }] }
      ]
    };
    const result = montarMensagemPedidoRecebido(pedido);
    expect(result.total).toBe(63); // (25*2) + ((10+3)*1) = 63
  });
});
