import { describe, it, expect } from 'vitest';

// Simula a lógica PURA do useCart.js sem React hooks (testes isolados)
export function simularAdicionarItem(carrinho, item) {
  const preco = Number(item.precoFinal !== undefined ? item.precoFinal : item.preco) || 0;
  return [...carrinho, {
    ...item,
    qtd: 1,
    cartItemId: `mock-${Date.now()}-${Math.random()}`,
    precoFinal: preco,
    observacao: item.observacao || ''
  }];
}

export function simularAlterarQuantidade(carrinho, cartItemId, delta) {
  return carrinho.map(item =>
    item.cartItemId === cartItemId
      ? { ...item, qtd: Math.max(1, item.qtd + delta) }
      : item
  );
}

export function calcularSubtotal(carrinho) {
  return carrinho.reduce((acc, item) => acc + (item.precoFinal || 0) * item.qtd, 0);
}

export function simularAdicionarBrinde(carrinho, produto) {
  return [...carrinho, {
    ...produto,
    qtd: 1,
    cartItemId: `brinde-${Date.now()}`,
    precoFinal: 0,
    nome: `${produto.nome} (Brinde)`,
    observacao: 'Ganho na raspadinha'
  }];
}

// Simula a expiração de carrinho (24h) do useCart.js linhas 14-18
export function checarExpiracaoCarrinho(savedTime) {
  const hoursAgo = (Date.now() - Number(savedTime)) / 3600000;
  return hoursAgo < 24;
}

describe('🛒 QA - Hook do Carrinho (useCart)', () => {
  it('Deve adicionar item com preço correto', () => {
    const carrinho = simularAdicionarItem([], { nome: 'X-Tudo', preco: 32.50 });
    expect(carrinho.length).toBe(1);
    expect(carrinho[0].precoFinal).toBe(32.50);
    expect(carrinho[0].qtd).toBe(1);
  });

  it('Deve preferir precoFinal sobre preco (item com variação)', () => {
    const carrinho = simularAdicionarItem([], { nome: 'Pizza GG', preco: 40, precoFinal: 55 });
    expect(carrinho[0].precoFinal).toBe(55);
  });

  it('Deve proteger contra preco undefined/null (item gratuito de brinde)', () => {
    const carrinho = simularAdicionarItem([], { nome: 'Brinquedo Kids', preco: undefined });
    expect(carrinho[0].precoFinal).toBe(0);
  });

  it('Deve aumentar quantidade sem ficar abaixo de 1', () => {
    const carrinho = [{ cartItemId: 'item-1', nome: 'Coca', precoFinal: 8, qtd: 1 }];
    const aumentado = simularAlterarQuantidade(carrinho, 'item-1', 1);
    expect(aumentado[0].qtd).toBe(2);

    // Tentar diminuir abaixo de 1 (deve travar em 1)
    const diminuido = simularAlterarQuantidade(carrinho, 'item-1', -5);
    expect(diminuido[0].qtd).toBe(1); // Math.max(1, 1-5) = 1
  });

  it('Deve calcular subtotal corretamente com múltiplos itens', () => {
    const carrinho = [
      { precoFinal: 32.50, qtd: 2 }, // 65 
      { precoFinal: 8, qtd: 3 },     // 24
      { precoFinal: 0, qtd: 1 }      // 0 (brinde)
    ];
    expect(calcularSubtotal(carrinho)).toBe(89);
  });

  it('Brinde da raspadinha deve ter preço ZERO e label correto', () => {
    const carrinho = simularAdicionarBrinde([], { nome: 'Batata Frita' });
    expect(carrinho[0].precoFinal).toBe(0);
    expect(carrinho[0].nome).toBe('Batata Frita (Brinde)');
    expect(carrinho[0].observacao).toBe('Ganho na raspadinha');
  });
});

describe('🛒 QA - Expiração de Carrinho (24h)', () => {
  it('Carrinho salvo há 2 horas deve ser recuperado', () => {
    const doisHorasAtras = Date.now() - (2 * 3600000);
    expect(checarExpiracaoCarrinho(doisHorasAtras)).toBe(true);
  });

  it('Carrinho salvo há 25 horas deve ser DESCARTADO', () => {
    const vinteEcincoHorasAtras = Date.now() - (25 * 3600000);
    expect(checarExpiracaoCarrinho(vinteEcincoHorasAtras)).toBe(false);
  });

  it('Carrinho exatamente no limite de 24h deve ser descartado', () => {
    const exatas24h = Date.now() - (24 * 3600000);
    expect(checarExpiracaoCarrinho(exatas24h)).toBe(false);
  });
});
