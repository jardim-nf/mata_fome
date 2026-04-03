import { describe, it, expect } from 'vitest';

// Extrai a lógica de normalização do Painel.jsx (linhas 489-505)
export function normalizarFormaPagamento(raw) {
  const original = (raw || 'outros').toLowerCase().trim();
  
  // Mapeia variantes para o código fiscal correto
  const mapa = {
    'pix': 'pix',
    'pix_manual': 'pix',
    'pix manual': 'pix',
    'dinheiro': 'dinheiro',
    'cash': 'dinheiro',
    'cartao': 'cartao',
    'cartão': 'cartao',
    'credito': 'cartao',
    'crédito': 'cartao',
    'debito': 'cartao',
    'débito': 'cartao',
    'card': 'cartao',
    'a combinar': 'outros',
    'outros': 'outros',
    '': 'outros'
  };

  return mapa[original] || 'outros';
}

// Extrai lógica do Menu.jsx (linhas 543-548)
export function extrairFormaPagamentoDoResult(result) {
  let formaPagamento = 'A Combinar';
  let trocoPara = 0;

  if (result.method === 'pix') formaPagamento = 'pix';
  else if (result.method === 'pix_manual') formaPagamento = 'pix_manual';
  else if (result.method === 'card') formaPagamento = result.details?.type || 'cartao';
  else if (result.method === 'cash') {
    formaPagamento = 'dinheiro';
    trocoPara = Number(result.details?.trocoPara) || 0;
  }

  return { formaPagamento, trocoPara };
}

describe('💳 QA - Normalização de Formas de Pagamento', () => {
  it('Deve normalizar "pix_manual" para "pix" (fiscal NFC-e)', () => {
    expect(normalizarFormaPagamento('pix_manual')).toBe('pix');
  });

  it('Deve normalizar "cartão" com acento para "cartao"', () => {
    expect(normalizarFormaPagamento('cartão')).toBe('cartao');
  });

  it('Deve normalizar "crédito" e "débito" para "cartao"', () => {
    expect(normalizarFormaPagamento('crédito')).toBe('cartao');
    expect(normalizarFormaPagamento('débito')).toBe('cartao');
  });

  it('Deve tratar null/undefined como "outros" (sem crash)', () => {
    expect(normalizarFormaPagamento(null)).toBe('outros');
    expect(normalizarFormaPagamento(undefined)).toBe('outros');
  });

  it('Deve tratar "A Combinar" do WhatsApp como "outros"', () => {
    expect(normalizarFormaPagamento('a combinar')).toBe('outros');
  });
});

describe('💳 QA - Extração de Forma de Pagamento do Checkout', () => {
  it('Pagamento PIX Mercado Pago deve retornar "pix"', () => {
    const result = extrairFormaPagamentoDoResult({ method: 'pix' });
    expect(result.formaPagamento).toBe('pix');
    expect(result.trocoPara).toBe(0);
  });

  it('Pagamento em dinheiro com troco deve extrair valor correto', () => {
    const result = extrairFormaPagamentoDoResult({ method: 'cash', details: { trocoPara: '100' } });
    expect(result.formaPagamento).toBe('dinheiro');
    expect(result.trocoPara).toBe(100);
  });

  it('Pagamento em cartão deve pegar o tipo (credito/debito)', () => {
    const result = extrairFormaPagamentoDoResult({ method: 'card', details: { type: 'debito' } });
    expect(result.formaPagamento).toBe('debito');
  });

  it('Método desconhecido deve retornar "A Combinar"', () => {
    const result = extrairFormaPagamentoDoResult({ method: 'bitcoin' });
    expect(result.formaPagamento).toBe('A Combinar');
  });
});
