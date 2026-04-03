import { describe, it, expect } from 'vitest';

// Extrai lógica EXATA do Menu.jsx (linhas 234-240)
export function calcularTaxaAplicada(isRetirada, taxaEntregaCalculada, premioRaspadinha) {
  if (isRetirada || premioRaspadinha?.type === 'frete') return 0;
  return taxaEntregaCalculada;
}

export function calcularTotalFinalPedido(subtotal, taxaAplicada, discountAmount) {
  return Math.max(0, subtotal + taxaAplicada - discountAmount);
}

// Extrai lógica da raspadinha Menu.jsx (linhas 599-612)
export function processarPremioRaspadinha(premio, subtotal) {
  const resultado = { descontoAplicado: 0, freteGratis: false, brinde: null };

  if (premio.type === 'desconto') {
    resultado.descontoAplicado = subtotal * (premio.valor / 100);
  } else if (premio.type === 'frete') {
    resultado.freteGratis = true;
  } else if (premio.type === 'brinde') {
    resultado.brinde = { ...premio.produto, precoFinal: 0 };
  }

  return resultado;
}

// Extrai gatilho da raspadinha Menu.jsx (linhas 284-295)
export function deveAbrirRaspadinha(subtotal, valorGatilho, jaJogou, premioAplicado) {
  return subtotal >= valorGatilho && !jaJogou && !premioAplicado;
}

describe('🎰 QA - Motor da Raspadinha (Prêmios)', () => {
  it('Prêmio desconto 10% em pedido de R$100 = R$10 de desconto', () => {
    const result = processarPremioRaspadinha({ type: 'desconto', valor: 10 }, 100);
    expect(result.descontoAplicado).toBe(10);
  });

  it('Prêmio desconto 15% em pedido de R$80 = R$12 de desconto', () => {
    const result = processarPremioRaspadinha({ type: 'desconto', valor: 15 }, 80);
    expect(result.descontoAplicado).toBe(12);
  });

  it('Prêmio frete grátis deve zerar taxa', () => {
    const result = processarPremioRaspadinha({ type: 'frete' }, 50);
    expect(result.freteGratis).toBe(true);
    expect(result.descontoAplicado).toBe(0);
  });

  it('Prêmio brinde deve adicionar produto com preço 0', () => {
    const result = processarPremioRaspadinha({ type: 'brinde', produto: { nome: 'Batata', preco: 12 } }, 100);
    expect(result.brinde.precoFinal).toBe(0);
    expect(result.brinde.nome).toBe('Batata');
  });
});

describe('🎰 QA - Gatilho da Raspadinha', () => {
  it('Subtotal acima do gatilho deve abrir (R$120 >= R$100)', () => {
    expect(deveAbrirRaspadinha(120, 100, false, null)).toBe(true);
  });

  it('Subtotal abaixo do gatilho NÃO deve abrir (R$80 < R$100)', () => {
    expect(deveAbrirRaspadinha(80, 100, false, null)).toBe(false);
  });

  it('Já jogou = NÃO abrir de novo', () => {
    expect(deveAbrirRaspadinha(150, 100, true, null)).toBe(false);
  });

  it('Já tem prêmio = NÃO abrir de novo', () => {
    expect(deveAbrirRaspadinha(150, 100, false, { type: 'desconto' })).toBe(false);
  });
});

describe('🎰 QA - Cálculo de Total Final com Descontos e Taxa', () => {
  it('Subtotal R$100 + Taxa R$8 - Desconto R$0 = R$108', () => {
    expect(calcularTotalFinalPedido(100, 8, 0)).toBe(108);
  });

  it('Subtotal R$100 + Taxa R$8 - Desconto R$10 = R$98', () => {
    expect(calcularTotalFinalPedido(100, 8, 10)).toBe(98);
  });

  it('Desconto maior que total NÃO deve ficar negativo (Math.max 0)', () => {
    expect(calcularTotalFinalPedido(20, 5, 50)).toBe(0);
  });

  it('Retirada deve zerar taxa de entrega', () => {
    const taxa = calcularTaxaAplicada(true, 12, null);
    expect(taxa).toBe(0);
  });

  it('Raspadinha frete grátis deve zerar taxa de entrega', () => {
    const taxa = calcularTaxaAplicada(false, 12, { type: 'frete' });
    expect(taxa).toBe(0);
  });

  it('Delivery normal deve aplicar taxa calculada', () => {
    const taxa = calcularTaxaAplicada(false, 12, null);
    expect(taxa).toBe(12);
  });
});
